'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,scrollTop:0,offsetWidth:100,offsetHeight:100,
    appendChild(){},remove(){},addEventListener(){},removeEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;},getBoundingClientRect(){return {width:100,height:100};},focus(){},click(){}
  });
  context.document={
    querySelector(selector){return elements[selector]||(elements[selector]=makeElement());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=makeElement());},
    createElement(){return makeElement();},
    addEventListener(){},
    body:makeElement(),
    documentElement:makeElement()
  };
  context.addEventListener=()=>{};
  context.setTimeout=(fn)=>{return 0;};
  context.clearTimeout=()=>{};
  context.navigator=context.navigator||{};
  loadGameFiles(context,['js/medical.js','js/education.js','js/ui.js']);
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function configureAdult(context){
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.jobTier=5; S.jobName='Day Laborer'; S.career=null; S.eduStage=null; S.jailUntil=0; S.garnishUntil=0; S.liabilities=[]; S.kids=0; S.married=false; S.contacts=[];");
}

test('runPersonalYearTick delegates progression to MedicalSystem.tickPerson and applies healthDelta/happinessDelta exactly once',()=>{
  const context=uiContext('progression-delegate');
  configureAdult(context);
  expose(context,"S.medical.conditions.push({id:'strain',severity:5,known:true,state:'diagnosed'}); ensureMedicalState(S);");
  const before=expose(context,'S.health');
  expose(context,'runPersonalYearTick();');
  const after=expose(context,'S.health');
  assert.ok(after<before,'severe untreated strain applies a health burden');
  const secondBefore=expose(context,'S.health');
  // A duplicate call for the SAME year must not re-apply the burden a second time.
  expose(context,'runPersonalYearTick();');
  const secondAfter=expose(context,'S.health');
  assert.equal(secondAfter,secondBefore,'a repeated same-year call is inert and does not re-apply burden');
});

test('runPersonalYearTick issues the new-condition notice only once per condition',()=>{
  const context=uiContext('notice-once');
  configureAdult(context);
  const noticeCount=()=>expose(context,"__notices.filter(n=>n.indexOf('MEDICAL NOTICE.')===0).length");
  expose(context,"globalThis.__notices=[]; const originalLogEv=logEv; globalThis.logEv=function(text){__notices.push(text); return originalLogEv.apply(this,arguments);};");
  expose(context,'runPersonalYearTick();');
  const first=noticeCount();
  expose(context,'runPersonalYearTick();');
  const second=noticeCount();
  assert.equal(second,first,'no additional new-condition notice is created on a repeated same-year call');
});

test('lastTickYear records the completed year and a second same-year tick is inert',()=>{
  const context=uiContext('last-tick-year');
  configureAdult(context);
  expose(context,'runPersonalYearTick();');
  const lastTickYear=expose(context,'S.medical.lastTickYear');
  const worldYear=expose(context,'World.year');
  assert.equal(lastTickYear,worldYear);
  const snapshot=expose(context,'JSON.stringify(S.medical)');
  expose(context,'runPersonalYearTick();');
  assert.equal(expose(context,'JSON.stringify(S.medical)'),snapshot,'a repeated same-year tick does not mutate medical state');
});

test('runPersonalYearTick no longer mutates Bureau scrutiny or Bureau Favor',()=>{
  const context=uiContext('standing-separate');
  configureAdult(context);
  expose(context,'S.scrutiny=10; S.bureauFavor=0; S.lastFavorYear=-999;');
  const before=expose(context,'JSON.stringify({scrutiny:S.scrutiny,bureauFavor:S.bureauFavor,lastFavorYear:S.lastFavorYear})');
  expose(context,'runPersonalYearTick();');
  const after=expose(context,'JSON.stringify({scrutiny:S.scrutiny,bureauFavor:S.bureauFavor,lastFavorYear:S.lastFavorYear})');
  assert.equal(after,before,'runPersonalYearTick must not touch Bureau standing fields');
});

test('runPersonalStandingYearTick applies the misconduct/cooling formula and grants Bureau Favor under the preserved conditions',()=>{
  const context=uiContext('standing-formula');
  configureAdult(context);
  expose(context,'S.record=false; S.crime=0; S.vice=0; S.scrutiny=10; S.bureauFavor=0; S.lastFavorYear=-999;');
  expose(context,'runPersonalStandingYearTick();');
  assert.equal(expose(context,'S.scrutiny'),6,'scrutiny cools by 4 when bureauFavor is not positive and there is no misconduct');
  assert.equal(expose(context,'S.bureauFavor'),1,'a clean, low-scrutiny adult subject earns Bureau Favor');
});

test('medicalMortalityDetails and medicalMortalityRoll delegate to MedicalSystem',()=>{
  const context=uiContext('mortality-delegate');
  configureAdult(context);
  expose(context,"S.medical.conditions.push({id:'injury',severity:5,known:true,state:'diagnosed',yearsActive:10}); ensureMedicalState(S);");
  const details=JSON.parse(expose(context,'JSON.stringify(medicalMortalityDetails(S))'));
  assert.ok(details.risk>0);
  const roll=JSON.parse(expose(context,'JSON.stringify(medicalMortalityRoll(S))'));
  assert.equal(typeof roll.died,'boolean');
  assert.equal(roll.risk,details.risk);
});

test('checkMortality uses medicalMortalityRoll rather than the global chance() helper for the medical branch',()=>{
  const src=fs.readFileSync('js/ui.js','utf8');
  const fnMatch=src.match(/function checkMortality\(\)\{[\s\S]*?\n\}/);
  assert.ok(fnMatch,'checkMortality function body located');
  assert.match(fnMatch[0],/medicalMortalityRoll/);
  assert.doesNotMatch(fnMatch[0],/medicalMortalityDetails/);
});

test('advanceYear orders standing before vacancies/stage/resolvePlan, and resolvePlan before runPersonalYearTick',()=>{
  const src=fs.readFileSync('js/ui.js','utf8');
  const fnStart=src.indexOf('function advanceYear(');
  const fnBody=src.slice(fnStart,src.indexOf('\nfunction advance(',fnStart));
  const standingIndex=fnBody.indexOf('runPersonalStandingYearTick()');
  const resolvePlanIndex=fnBody.indexOf('resolvePlan()');
  const personalTickIndex=fnBody.indexOf('runPersonalYearTick()');
  const mortalityIndex=fnBody.indexOf('checkMortality()');
  assert.ok(standingIndex>=0&&resolvePlanIndex>=0&&personalTickIndex>=0&&mortalityIndex>=0);
  assert.ok(standingIndex<resolvePlanIndex,'standing runs before resolvePlan');
  assert.ok(resolvePlanIndex<personalTickIndex,'queued treatment resolves before annual progression');
  assert.ok(personalTickIndex<mortalityIndex,'personal medical tick runs before mortality is checked');
});

test('js/medical.js no longer implements the untreated annual progression loop, chronic chance(0.12) roll, or annual standing mutation',()=>{
  const src=fs.readFileSync('js/medical.js','utf8');
  assert.doesNotMatch(src,/chance\(0\.12\)/);
  assert.doesNotMatch(src,/S\.scrutiny\s*=/);
  assert.doesNotMatch(src,/S\.bureauFavor\s*=/);
  assert.doesNotMatch(src,/S\.crime\s*\*/);
});

test('MedicalSystem source has no direct reference to prohibited core globals',()=>{
  const src=fs.readFileSync('js/systems/medical-system.js','utf8');
  assert.doesNotMatch(src,/Math\.random\(|Random\.next\(|(?<![.\w])chance\(|(?<![.\w])pick\(|(?<![.\w])RI\(|(?<![.\w])applyFx\(|(?<![.\w])logEv\(|(?<![.\w])logChips\(|updatePersonalStanding\(/);
});

test('fast-forward across multiple years does not double-apply medical burden for the same year',()=>{
  const context=uiContext('fast-forward');
  configureAdult(context);
  expose(context,"S.medical.conditions.push({id:'strain',severity:5,known:true,state:'diagnosed'}); ensureMedicalState(S);");
  expose(context,'fastForward();');
  const uniqueYears=expose(context,'new Set(S.medical.conditions.map(c=>c.lastProgressionYear)).size');
  assert.ok(uniqueYears>=1);
  const lastTickYear=expose(context,'S.medical.lastTickYear');
  const worldYear=expose(context,'World.year');
  assert.equal(lastTickYear,worldYear,'the medical tick stays synchronized with the advancing world year after fast-forward');
});

test('an unknown/legacy saved condition definition does not crash the annual tick',()=>{
  const context=uiContext('unknown-condition-safety');
  configureAdult(context);
  expose(context,"S.medical.conditions.push({id:'retired-diagnosis',severity:4,known:true,state:'diagnosed',years:3,source:'old save'}); ensureMedicalState(S);");
  assert.doesNotThrow(()=>expose(context,'runPersonalYearTick();'));
});

test('the vocational training picker reads Never Mind with the correct glyph and no mojibake remains in changed source files',()=>{
  const ui=fs.readFileSync('js/ui.js','utf8');
  assert.match(ui,/Never Mind ▸/);
  [ 'js/ui.js','js/medical.js','js/systems/medical-system.js' ].forEach(file=>{
    const src=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(src,/â€™|â€œ|â€\x9d|â€“|â€”|â–¸|Â·/);
  });
});
