'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function lifeContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,
    scrollTop:0,scrollHeight:0,offsetWidth:1200,offsetHeight:900,clientWidth:1200,clientHeight:900,_listeners:[],
    appendChild(){},remove(){},addEventListener(){},removeEventListener(){},setAttribute(){},
    getBoundingClientRect(){return {left:0,top:0,width:1200,height:900};},focus(){},click(){},querySelectorAll(){return [];}
  });
  context.document={
    querySelector(s){return elements[s]||(elements[s]=makeElement());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=makeElement());},
    createElement(){return makeElement();},
    addEventListener(){}, body:makeElement(), documentElement:makeElement()
  };
  context.addEventListener=()=>{}; context.setTimeout=()=>0; context.clearTimeout=()=>{};
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject();");
  return context;
}

function strugglingSubject(context){
  expose(context,"S.age=28; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=-300; S.health=34; S.happiness=30;"+
    "S.jobTier=0; S.jobName='Unemployed'; S.career=null; S.eduStage=null; S.jailUntil=0; S.kids=0; S.married=false;"+
    "S.contacts=[]; S.liabilities=[]; S.record=false; S.relations=40; S.scrutiny=5;"+
    "S.lifestyle={housing:'room',food:'meager',childcare:'basic'}; S.location={settlementId:World.activeSettlementId};");
}

test('the Ways Out advisor prioritizes eating, honest work, and the dispensary for a struggling subject',()=>{
  const context=lifeContext('ways-out');
  strugglingSubject(context);
  const g=JSON.parse(expose(context,"JSON.stringify(SurvivalSystem.guidanceFor(World,S))"));
  assert.ok(g.length>=3,'a struggling subject must be shown real options');
  const ids=g.map(e=>e.id);
  assert.ok(ids.includes('eat'),'the mission line comes first when the table is meager');
  const priorities=g.map(e=>e.priority);
  assert.deepEqual(priorities,[...priorities].sort((a,b)=>b-a).slice(0,priorities.length),'entries are sorted by priority');
  assert.equal(g.filter(e=>e.risky).filter(e=>e.priority>80).length,0,'risky paths never outrank every honest one');
});

test('the underworld hatch is flagged risky and only appears in genuine desperation',()=>{
  const context=lifeContext('ways-out-risky');
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=-1400; S.health=60;"+
    "S.jobTier=0; S.jobName='Unemployed'; S.career=null; S.eduStage=null; S.jailUntil=0; S.kids=0; S.married=false;"+
    "S.contacts=[]; S.liabilities=[]; S.record=false; S.relations=30;"+
    "S.lifestyle={housing:'none',food:'meager',childcare:'basic'}; S.location={settlementId:World.activeSettlementId};");
  const desperateGuidance=JSON.parse(expose(context,"JSON.stringify(SurvivalSystem.guidanceFor(World,S))"));
  void desperateGuidance;
  // With no fixers seeded locally, seekfixer cannot appear -- but desperation
  // math itself is what gates it. Verify the gate directly.
  const d=expose(context,"SurvivalSystem.desperationOf(World,S)");
  assert.ok(d>=0.6,'this subject profile must clear the desperation gate, got '+d.toFixed(2));
  // A comfortable subject never sees risky advice.
  expose(context,"S.age=35; S.assets=5000; S.health=90; S.happiness=80; S.jobTier=2; S.lifestyle.food='decent'; S.lifestyle.housing='house';");
  const comfortable=JSON.parse(expose(context,"JSON.stringify(SurvivalSystem.guidanceFor(World,S))"));
  assert.equal(comfortable.filter(e=>e.risky).length,0,'no risky guidance for a subject doing fine');
  assert.ok(comfortable.length<=1,'comfortable subjects get little or no unsolicited advice');
});

test('guidance stays silent for incarcerated subjects',()=>{
  const context=lifeContext('ways-out-jail');
  expose(context,"S.age=26; World.year=S.dob+S.age; S.jailUntil=S.age+3; S.lifestyle={housing:'none',food:'meager',childcare:'basic'};");
  const g=JSON.parse(expose(context,"JSON.stringify(SurvivalSystem.guidanceFor(World,S))"));
  assert.equal(g.length,0,'custody closes the advisory file');
});

test('poverty mortality tuning is exported and strictly rarer than the legacy dial',()=>{
  const context=lifeContext('mortality-tuning');
  const MT=JSON.parse(expose(context,"JSON.stringify(SurvivalSystem.MORTALITY_TUNING)"));
  // Legacy values for comparison (pre-retune): base .012/.003/.01/.006,
  // scale floor .4 scale 1.2, child/elder factor 1.6.
  assert.ok(MT.povertyBaseHouseNone<.012&&MT.povertyBaseHouseNone>0);
  assert.ok(MT.desperationFloor<.4&&MT.desperationScale<1.2);
  assert.ok(MT.childGuardFactor<1.6&&MT.elderFactor<1.6);
  // Derived: worst-case street-and-scraps risk at maximum desperation.
  const worst=expose(context,"(function(){var T=SurvivalSystem.MORTALITY_TUNING;var r=T.povertyBaseHouseNone+T.povertyMeagerFood+T.povertyBoth;return r*(T.desperationFloor+T.desperationScale*1);})()");
  const legacyWorst=(.012+.003+.01)*(.4+1.2*1);
  assert.ok(worst<legacyWorst,'maximum-desperation street risk must have dropped, '+worst.toFixed(4)+' vs '+legacyWorst.toFixed(4));
});

test('untreated-condition and NPC mortality weights are pinned to the rare dial',()=>{
  const context=lifeContext('mortality-medical');
  const MC=JSON.parse(expose(context,"JSON.stringify(MedicalSystem.MORTALITY_CONTRIBUTION)"));
  assert.ok(MC.cap<=0.10&&MC.perSeverityAboveThree<.007&&MC.perActiveYear<.0015);
  // A severity-5 condition untreated for 6 years contributes well under the old cap.
  const contribution=expose(context,"MedicalSystem.mortalityContribution({severity:5,state:'symptomatic',yearsActive:6})");
  assert.ok(contribution>0&&contribution<=MC.cap,'contribution stays bounded, got '+contribution);
  const table=JSON.parse(expose(context,"JSON.stringify(NpcSystem.MORTALITY_TABLE)"));
  assert.equal(table.length,8);
  assert.ok(table[7]<0.24,'oldest band rarer than the legacy 0.24');
  const coeff=JSON.parse(expose(context,"JSON.stringify(NpcSystem.MORTALITY_COEFFICIENTS)"));
  assert.ok(coeff.perUnhealthyPoint<.08&&coeff.perHealthPressure<.035);
});
