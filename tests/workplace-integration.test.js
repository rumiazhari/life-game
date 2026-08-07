'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
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

function seedPublicBusiness(context,sector){
  return JSON.parse(expose(context,`(function(){
    const settlementId=World.activeSettlementId;
    const b=BusinessSystem.create(World,{settlementId,sector:'${sector}',kind:'public'});
    return JSON.stringify(b);
  })()`));
}

test('runWorkplaceYearTick runs after resolvePendingVacancies and post-resolution employment/vacancy synchronization',()=>{
  const context=uiContext('workplace-order');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const order=JSON.parse(expose(context,`(function(){
    let order=[];
    const originalResolvePending=VacancySystem.resolvePending;
    const originalSyncEmployees=EmploymentSystem.syncAllBusinessEmployees;
    const originalSyncVacancies=VacancySystem.syncAllBusinessVacancyIds;
    const originalWorkplaceTick=WorkplaceSystem.tickWorld;
    VacancySystem.resolvePending=function(){order.push('resolvePendingVacancies'); return originalResolvePending.apply(this,arguments);};
    EmploymentSystem.syncAllBusinessEmployees=function(){order.push('syncAllBusinessEmployees'); return originalSyncEmployees.apply(this,arguments);};
    VacancySystem.syncAllBusinessVacancyIds=function(){order.push('syncAllBusinessVacancyIds'); return originalSyncVacancies.apply(this,arguments);};
    WorkplaceSystem.tickWorld=function(){order.push('workplaceTick'); return originalWorkplaceTick.apply(this,arguments);};
    advanceYear(true,true);
    VacancySystem.resolvePending=originalResolvePending;
    EmploymentSystem.syncAllBusinessEmployees=originalSyncEmployees;
    VacancySystem.syncAllBusinessVacancyIds=originalSyncVacancies;
    WorkplaceSystem.tickWorld=originalWorkplaceTick;
    return JSON.stringify(order);
  })()`));
  const resolvePendingIdx=order.indexOf('resolvePendingVacancies');
  const syncEmployeesIdx=order.lastIndexOf('syncAllBusinessEmployees');
  const syncVacanciesIdx=order.indexOf('syncAllBusinessVacancyIds');
  const workplaceIdx=order.indexOf('workplaceTick');
  assert.ok(resolvePendingIdx>=0&&workplaceIdx>resolvePendingIdx,'workplace tick must run after resolvePendingVacancies');
  assert.ok(syncEmployeesIdx>=0&&workplaceIdx>syncEmployeesIdx,'workplace tick must run after post-resolution employment synchronization');
  assert.ok(syncVacanciesIdx>=0&&workplaceIdx>syncVacanciesIdx,'workplace tick must run after vacancy business-ID synchronization');
});

test('a subject hired during resolvePlan receives a same-year workplace assignment and stress tick',()=>{
  const context=uiContext('workplace-same-year-hire');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:coworker',businessId:'${b.id}',annualSalary:900,hiredYear:World.year,jobTier:5});
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    S.queue.push({type:'p',id:'lookwork',vacancyId:v.id});
    advanceYear(true,true);
    const contract=EmploymentSystem.activeForPerson(World,'subject')[0];
    const coworkerIds=contract?WorkplaceSystem.coworkerPersonIds(World,contract.id):[];
    return JSON.stringify({
      hired:!!contract,
      workplaceLastTickYear:contract?contract.workplaceLastTickYear:null,
      workplaceStress:contract?contract.workplaceStress:null,
      hasSupervisorOrNoCoworkers:contract?(!!contract.supervisorPersonId||coworkerIds.length===0):null,
      year:World.year,
      invariants:WorkplaceSystem.checkInvariants(World)
    });
  })()`));
  assert.equal(result.hired,true);
  assert.equal(result.workplaceLastTickYear,result.year);
  assert.ok(Number.isFinite(result.workplaceStress));
  assert.ok(result.workplaceStress>=0&&result.workplaceStress<=1);
  assert.equal(result.hasSupervisorOrNoCoworkers,true);
  assert.deepEqual(result.invariants,[]);
});

test('a same-year promotion updates supervisor topology before the workplace tick runs',()=>{
  const context=uiContext('workplace-same-year-promotion');
  configureAdult(context,"S.assets=5000;");
  const b=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:World.year-3,stageStartedYear:World.year-3});
    S.employmentContractId=contract.id; S.jobTier=1; S.career='medicine'; S.jobName='Junior'; S.careerYears=3;
    EmploymentSystem.hire(World,{personId:'npc:junior-peer',businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,hiredYear:World.year});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:World.year,recordMemories:false});
    const beforeSubjectSupervisor=EmploymentSystem.get(World,contract.id).supervisorPersonId;
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    S.queue.push({type:'d',id:'presspromo'});
    advanceYear(true,true);
    const afterContract=EmploymentSystem.activeForPerson(World,'subject')[0];
    return JSON.stringify({
      beforeSubjectSupervisor,
      afterJobTier:afterContract.jobTier,
      afterSupervisorPersonId:afterContract.supervisorPersonId,
      peerSupervisorPersonId:EmploymentSystem.forBusiness(World,'${b.id}').find(c=>c.personId==='npc:junior-peer').supervisorPersonId
    });
  })()`));
  assert.equal(result.beforeSubjectSupervisor,null);
  assert.equal(result.afterJobTier,2);
  assert.equal(result.afterSupervisorPersonId,null);
  assert.equal(result.peerSupervisorPersonId,'subject');
});

test('fast-forward does not double-apply a workplace contract-year',()=>{
  const context=uiContext('workplace-fast-forward');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:World.year,jobTier:1});
    let calls=0; const original=WorkplaceSystem.tickWorld;
    WorkplaceSystem.tickWorld=function(){calls++; return original.apply(this,arguments);};
    for(let i=0;i<3;i++) advanceYear(true,true);
    WorkplaceSystem.tickWorld=original;
    return JSON.stringify({calls,tickYear:World.workplaceLastTickYear,worldYear:World.year});
  })()`));
  assert.equal(result.calls,3);
  assert.equal(result.tickYear,result.worldYear);
});

test('player salary remains paid exactly once per year with the workplace tick installed',()=>{
  const context=uiContext('workplace-salary-once');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Clerk'; S.career=null;
    let calls=0; const original=WorldGameplay&&typeof WorldGameplay.adjustPaidIncome==='function'?WorldGameplay.adjustPaidIncome:null;
    if(original) WorldGameplay.adjustPaidIncome=function(){calls++; return original.apply(this,arguments);};
    advanceYear(true,true);
    if(original) WorldGameplay.adjustPaidIncome=original;
    return JSON.stringify({calls,paidWage:S.__worldWagePaid});
  })()`));
  assert.equal(result.calls,1);
  assert.ok(result.paidWage>0);
});

test('no employment contract or vacancy is duplicated across several years with the workplace tick installed',()=>{
  const context=uiContext('workplace-no-duplication');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:worker-a',businessId:'${b.id}',annualSalary:900,hiredYear:World.year,jobTier:2});
    EmploymentSystem.hire(World,{personId:'npc:worker-b',businessId:'${b.id}',annualSalary:900,hiredYear:World.year,jobTier:1});
    for(let i=0;i<5;i++) advanceYear(true,true);
    return JSON.stringify({
      employment:EmploymentSystem.checkInvariants(World),
      vacancy:VacancySystem.checkInvariants(World),
      business:BusinessSystem.checkInvariants(World),
      workplace:WorkplaceSystem.checkInvariants(World)
    });
  })()`));
  assert.deepEqual(result.employment,[]);
  assert.deepEqual(result.vacancy,[]);
  assert.deepEqual(result.business,[]);
  assert.deepEqual(result.workplace,[]);
});
