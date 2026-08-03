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

test('real runEconomy cash flow feeds the household ledger once',()=>{
  const {context}=uiContext('real-household-economy');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    const before=S.assets;
    runEconomy();
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid,subjectAssetsBefore:S.__householdAssetsBeforeEconomy,subjectExpensesPaid:S.__householdSubjectExpensesPaid,subjectEconomySettled:true});
    const household=HouseholdSystem.findByMember(World,S.npcId);
    return JSON.stringify({before,after:S.assets,wage:S.__worldWagePaid,subjectExpensesPaid:S.__householdSubjectExpensesPaid,subjectIncome:household.finances.subjectIncome,subjectExpenses:household.finances.subjectExpenses,otherSubjectCashFlow:household.finances.otherSubjectCashFlow,otherMemberIncome:household.finances.otherMemberIncome,personalAssetChange:household.finances.personalAssetChange,identity:household.finances.accountingIdentity,balance:household.finances.lastBalance,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.ok(result.wage>0);
  assert.ok(result.subjectExpensesPaid>0);
  assert.equal(result.subjectIncome,result.wage);
  assert.equal(result.subjectExpenses,result.subjectExpensesPaid);
  assert.equal(result.otherSubjectCashFlow,result.otherMemberIncome);
  assert.equal(result.after-result.before,result.personalAssetChange);
  assert.equal(result.identity,result.balance);
  assert.equal(result.violations.length,0);
});

test('projected household outlay includes additional household costs in the live ledger',()=>{
  const {context,elements}=uiContext('projected-household-outlay');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    runEconomy();
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid,subjectAssetsBefore:S.__householdAssetsBeforeEconomy,subjectExpensesPaid:S.__householdSubjectExpensesPaid,subjectEconomySettled:true});
    renderInventory();
    const household=HouseholdSystem.findByMember(World,S.npcId), totalOutlay=currentHousing().rent+currentFood().cost+(S.kids>0?currentChildcare().costPerKid*S.kids:0)+S.liabilities.reduce((sum,item)=>sum+item.annualPayment,0), projected=totalOutlay+household.finances.memberExpenses;
    return JSON.stringify({additional:household.finances.memberExpenses,projectedText:money(projected),html:document.querySelector('#inventory').innerHTML,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.ok(result.additional>0);
  assert.ok(result.html.includes('PROJECTED HOUSEHOLD OUTLAY'));
  assert.ok(result.html.includes(result.projectedText));
  assert.equal(result.violations.length,0);
});
