'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,scrollTop:0,offsetWidth:100,offsetHeight:100,
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
  loadGameFiles(context,['js/ui.js']);
  context.activeConditions=()=>[];
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return {context,elements};
}

function configureAdult(context){
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.jobTier=5; S.jobName='Day Laborer'; S.career=null; S.eduStage=null; S.jailUntil=0; S.garnishUntil=0; S.liabilities=[]; S.kids=0; S.married=false; S.contacts=[];");
}

function settle(context,setup=''){
  return JSON.parse(expose(context,`(function(){
    ${setup}
    const before=S.assets;
    runEconomy();
    const afterEconomy=S.assets;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid,subjectAssetsBefore:S.__householdAssetsBeforeEconomy,subjectAssetsAfterEconomy:afterEconomy,subjectExpensesPaid:S.__householdSubjectExpensesPaid,subjectEconomySettled:true});
    const f=HouseholdSystem.findByMember(World,S.npcId).finances;
    return JSON.stringify({before,afterEconomy,after:S.assets,subjectExpensesPaid:S.__householdSubjectExpensesPaid,finances:f,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
}

function assertSettled(result,extraCashFlow){
  const f=result.finances;
  assert.equal(f.otherSubjectCashFlow,extraCashFlow);
  assert.equal(f.lastBalance,f.subjectIncome+f.otherMemberIncome+f.otherSubjectCashFlow-f.subjectExpenses-f.memberExpenses);
  assert.equal(f.accountingIdentity,f.lastBalance);
  assert.equal(result.after-result.before,f.personalAssetChange);
  assert.equal(f.otherMemberIncome+f.otherSubjectCashFlow-f.otherMemberIncome,extraCashFlow);
  assert.equal(result.violations.length,0);
}

test('normal runEconomy year has no other-subject cash flow',()=>{
  const {context}=uiContext('real-household-economy');
  configureAdult(context);
  const result=settle(context,'Random.chance=()=>false;');
  assert.ok(result.finances.subjectIncome>0);
  assert.equal(result.finances.subjectExpenses,result.subjectExpensesPaid);
  assertSettled(result,0);
});

test('runEconomy no longer applies a random promotion bonus (moved to EmploymentSystem/checkCareerProgress)',()=>{
  const {context}=uiContext('promotion-household-economy');
  configureAdult(context);
  const result=settle(context,"S.jobTier=1; S.jobName='Clerk'; bestJobForTier=()=>({name:'Forced Promotion'}); Random.chance=()=>true;");
  assertSettled(result,0);
});

test('childbirth cost is counted once as other-subject cash flow',()=>{
  const {context}=uiContext('birth-household-economy');
  configureAdult(context);
  const result=settle(context,`S.married=true; S.status='Married'; const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage); let calls=0; Random.chance=()=>++calls===1;`);
  assertSettled(result,-300);
});

test('custody cost is counted once as other-subject cash flow',()=>{
  const {context}=uiContext('custody-household-economy');
  configureAdult(context);
  const result=settle(context,'S.jailUntil=S.age+1; Random.chance=()=>false;');
  assertSettled(result,-200);
});

test('projected outlay uses current pre-tick household state after marriage, childbirth, travel, and wartime',()=>{
  const {context,elements}=uiContext('projected-household-outlay');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    S.married=true; S.status='Married'; const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId), afterMarriage=HouseholdSystem.estimateOutlay(World,household,S,{year:World.year});
    S.kids=1; const child=bearChild(); NpcSystem.syncLegacy(World,S,Lineage); const afterChild=HouseholdSystem.estimateOutlay(World,household,S,{year:World.year});
    scheduleTravel('veskar'); S.traveling.arriveYear=World.year; resolveTravel(); const afterTravel=HouseholdSystem.estimateOutlay(World,household,S,{year:World.year});
    World.year=1914; const wartime=HouseholdSystem.estimateOutlay(World,household,S,{year:World.year});
    renderInventory();
    return JSON.stringify({afterMarriage,afterChild,afterTravel,wartime,html:document.querySelector('#inventory').innerHTML,previousRecord:household.finances.memberExpenses,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.previousRecord,0);
  assert.ok(result.afterMarriage.additionalHouseholdCosts>0);
  assert.ok(result.afterChild.projectedTotalOutlay>result.afterMarriage.projectedTotalOutlay);
  assert.notEqual(result.afterTravel.personalLifestyleOutlay,result.afterChild.personalLifestyleOutlay);
  assert.equal(result.wartime.personalLifestyleOutlay,result.afterTravel.personalLifestyleOutlay+Math.round(result.afterTravel.personalLifestyleOutlay*.15));
  assert.ok(result.html.includes('PERSONAL LIFESTYLE OUTLAY'));
  assert.ok(result.html.includes('ADDITIONAL HOUSEHOLD COSTS'));
  assert.ok(result.html.includes('PROJECTED TOTAL OUTLAY'));
  assert.ok(result.html.includes('$'+result.wartime.projectedTotalOutlay.toLocaleString('en-US')));
  assert.equal(result.violations.length,0);
});
