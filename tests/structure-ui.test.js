'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,scrollTop:0,scrollHeight:0,offsetWidth:100,offsetHeight:100,
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
  context.setTimeout=(fn)=>0;
  context.clearTimeout=()=>{};
  context.setInterval=()=>0;
  context.clearInterval=()=>{};
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  context.activeConditions=()=>[];
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function configureAdult(context,extra){
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.jobTier=0; S.jobName='Unemployed'; S.career=null; S.eduStage=null; S.jailUntil=0; S.garnishUntil=0; S.liabilities=[]; S.kids=0; S.married=false; S.contacts=[]; S.location={settlementId:World.activeSettlementId};"+(extra||''));
}

function sheetHtml(context,id){
  return JSON.parse(expose(context,"JSON.stringify(document.getElementById('"+id+"').innerHTML)"));
}

test('plan sheet renders three tabs with the sticky seal always present',()=>{
  const context=uiContext('plan-tabs-render');
  configureAdult(context);
  const html=sheetHtml(context,'planSheet').slice(1,-1);
  const result=JSON.parse(expose(context,`(function(){
    renderPlan();
    const html=document.getElementById('planSheet').innerHTML;
    return JSON.stringify({
      tabs:['pursuits','decisions','desk'].every(t=>html.includes('data-plan-tab="'+t+'"')),
      activePursuits:html.includes('ptab on" data-plan-tab="pursuits"'),
      seal:html.includes('id="sealAdvance"'),
      queueDock:html.includes('FILED THIS YEAR'),
      noDecisionsYet:!html.includes('data-d="presspromo"')
    });
  })()`));
  assert.equal(result.tabs,true);
  assert.equal(result.activePursuits,true);
  assert.equal(result.seal,true);
  assert.equal(result.queueDock,true);
  assert.equal(result.noDecisionsYet,true);
});

test('switching to the desk tab shows living acts and clerk stamps without pursuit buttons',()=>{
  const context=uiContext('plan-tabs-desk');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    planTab='desk';
    renderPlan();
    const html=document.getElementById('planSheet').innerHTML;
    return JSON.stringify({
      activeDesk:html.includes('ptab on" data-plan-tab="desk"'),
      clerkStamps:html.includes('data-c="subsidy"'),
      householdTile:S.age>=16?html.includes('openHousehold')||html.includes('askMoveOut'):true,
      noPursuits:!html.includes('autoTrainBtn')
    });
  })()`));
  assert.equal(result.activeDesk,true);
  assert.equal(result.clerkStamps,true);
  assert.equal(result.householdTile,true);
  assert.equal(result.noPursuits,true);
});

test('decisions tab lists decision slips, not pursuits',()=>{
  const context=uiContext('plan-tabs-decisions');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    planTab='decisions';
    renderPlan();
    const html=document.getElementById('planSheet').innerHTML;
    return JSON.stringify({
      hasDecisionSlips:html.includes('data-d="'),
      hasPursuitSlips:html.includes('data-p="'),
      seal:html.includes('id="sealAdvance"')
    });
  })()`));
  assert.equal(result.hasDecisionSlips,true);
  assert.equal(result.hasPursuitSlips,false);
  assert.equal(result.seal,true);
});

test('inventory groups the right page into boxed sections with pinned labels intact',()=>{
  const context=uiContext('inventory-groups');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    renderInventory();
    const html=document.getElementById('inventory').innerHTML;
    return JSON.stringify({
      lifestyleBox:html.includes('HOUSEHOLD & LIFESTYLE'),
      liabilitiesBox:html.includes('LIABILITIES'),
      outlayBox:html.includes('ANNUAL OUTLAY'),
      personalOutlay:html.includes('PERSONAL LIFESTYLE OUTLAY'),
      additionalCosts:html.includes('ADDITIONAL HOUSEHOLD COSTS'),
      projectedTotal:html.includes('PROJECTED TOTAL OUTLAY'),
      actionGrid:html.includes('inv-actions')&&html.includes('id="invOpenMedical"')&&html.includes('id="invOpenHousehold"')&&html.includes('id="invOpenFamilyHealth"'),
      standingLive:html.includes('PERSONAL STANDING')
    });
  })()`));
  assert.equal(result.lifestyleBox,true);
  assert.equal(result.liabilitiesBox,true);
  assert.equal(result.outlayBox,true);
  assert.equal(result.personalOutlay,true);
  assert.equal(result.additionalCosts,true);
  assert.equal(result.projectedTotal,true);
  assert.equal(result.actionGrid,true);
  assert.equal(result.standingLive,true);
});

test('at-home inventory uses the family-table group box',()=>{
  const context=uiContext('inventory-athome');
  configureAdult(context,'S.age=14; S.livingAtHome=true;');
  const result=JSON.parse(expose(context,`(function(){
    renderInventory();
    const html=document.getElementById('inventory').innerHTML;
    return JSON.stringify({familyBox:html.includes('AT THE FAMILY TABLE'),guardianship:html.includes('GUARDIANSHIP')});
  })()`));
  assert.equal(result.familyBox,true);
  assert.equal(result.guardianship,true);
});

test('medical file renders grouped condition and history boxes',()=>{
  const context=uiContext('medical-groups');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    openMedicalFile();
    const html=document.getElementById('medicalSheet').innerHTML;
    return JSON.stringify({
      conditionsBox:html.includes('ACTIVE CONDITIONS'),
      historyBox:html.includes('RECENT ENTRIES'),
      overview:html.includes('WELLNESS')
    });
  })()`));
  assert.equal(result.conditionsBox,true);
  assert.equal(result.historyBox,true);
  assert.equal(result.overview,true);
});

test('persistent job portal stays pinned to GENERAL OPENINGS while adding the short work label',()=>{
  const context=uiContext('job-portal-labels');
  configureAdult(context);
  const b=expose(context,`(function(){
    const settlementId=World.activeSettlementId;
    const biz=BusinessSystem.create(World,{settlementId,sector:'retail',kind:'public'});
    VacancySystem.open(World,{businessId:biz.id,occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    rollJobVacancies();
    openJobPortal();
    return document.getElementById('jobSheet').innerHTML;
  })()`);
  assert.ok(b.includes('GENERAL OPENINGS'));
  assert.ok(b.includes('UNLICENSED WORK'));
  assert.ok(!b.includes('SKIP THE LADDER'));
});

test('action-bar micro copy uses the tightened phrasing',()=>{
  const context=uiContext('bar-micro');
  configureAdult(context);
  const micro=expose(context,`(function(){
    updateBar();
    return document.getElementById('bar-micro').textContent;
  })()`);
  assert.equal(micro,'plan the year · stamp it forward');
});
