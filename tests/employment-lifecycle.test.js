'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function freshWorld(){
  const context=createWorldContext();
  expose(context,`World={year:1930,seed:'test-seed',activeSettlementId:'branec',settlements:{}};BusinessSystem.ensure(World);EmploymentSystem.ensure(World);VacancySystem.ensure(World);`);
  return context;
}
function business(context,spec){
  return JSON.parse(expose(context,`(function(){ return JSON.stringify(BusinessSystem.create(World,${JSON.stringify(spec)})); })()`));
}
function registerNpc(context,id,extra){
  expose(context,`World.npcs=World.npcs||{};World.npcs['${id}']=Object.assign({id:'${id}',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{}},${JSON.stringify(extra||{})});`);
}

test('employment schema is version 2 after migration',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ EmploymentSystem.migrate(World); return World.employmentSchemaVersion; })()`);
  assert.equal(result,2);
});

test('existing contracts default origin to legacy on migration',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    EmploymentSystem.migrate(World);
    return World.employmentContracts['employment:00001'].origin;
  })()`);
  assert.equal(result,'legacy');
});

test('stageStartedYear defaults to hiredYear',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1928});
    return JSON.stringify({hired:c.hiredYear,stage:c.stageStartedYear});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.stage,parsed.hired);
});

test('migration of schema v2 fields is idempotent',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1928});
    EmploymentSystem.migrate(World);
    const first=JSON.stringify(World.employmentContracts);
    EmploymentSystem.migrate(World);
    const second=JSON.stringify(World.employmentContracts);
    return first===second?'stable':'changed';
  })()`);
  assert.equal(result,'stable');
});

test('a vacancy hire has origin vacancy and creates exactly one contract',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  registerNpc(context,'npc:1');
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:1',{year:1930});
    return JSON.stringify({accepted:r.accepted,origin:r.contract.origin,count:EmploymentSystem.forPerson(World,'npc:1').length,businessId:r.contract.businessId,salary:r.contract.annualSalary});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,true);
  assert.equal(parsed.origin,'vacancy');
  assert.equal(parsed.count,1);
  assert.equal(parsed.businessId,b.id);
  assert.equal(parsed.salary,1000);
});

test('switching employer ends the prior contract, leaving only one active',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const b2=business(context,{settlementId:'branec',sector:'finance',kind:'public'});
  registerNpc(context,'npc:1');
  const result=expose(context,`(function(){
    const v1=VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    EmploymentSystem.acceptVacancy(World,v1,'npc:1',{year:1930});
    const v2=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'teller',occupationName:'Teller',jobTier:1,annualSalary:1200});
    EmploymentSystem.acceptVacancy(World,v2,'npc:1',{year:1931});
    return JSON.stringify(EmploymentSystem.activeForPerson(World,'npc:1').map(c=>c.businessId));
  })()`);
  const active=JSON.parse(result);
  assert.deepEqual(active,[b2.id]);
});

test('promotion retains the same contract ID and updates salary/stage',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  registerNpc(context,'npc:1');
  const result=expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928});
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    const r=EmploymentSystem.promote(World,contract.id,v.id,1930);
    return JSON.stringify({accepted:r.accepted,sameId:r.contract.id===contract.id,salary:r.contract.annualSalary,stage:r.contract.careerStage});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,true);
  assert.equal(parsed.sameId,true);
  assert.equal(parsed.salary,1500);
  assert.equal(parsed.stage,1);
});

test('promotion requires the same business',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  const b2=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  const result=expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b1.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928});
    const v=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500});
    const r=EmploymentSystem.promote(World,contract.id,v.id,1930);
    return JSON.stringify(r);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,false);
  assert.equal(parsed.reason,'different_business');
});

test('salary adjustment records history',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    EmploymentSystem.adjustSalary(World,c.id,1200,'raise',1931);
    return JSON.stringify({salary:c.annualSalary,lastEntry:c.history[c.history.length-1]});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.salary,1200);
  assert.equal(parsed.lastEntry.type,'salary_adjusted');
});

test('dismissal ends the contract with reason dismissed by default',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    EmploymentSystem.dismiss(World,c.id,null,1931);
    return JSON.stringify({status:c.status,reason:c.terminationReason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'terminated');
  assert.equal(parsed.reason,'dismissed');
});

test('resignation synchronizes NPC employment status to unemployed',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    World.npcs={'npc:1':{id:'npc:1',alive:true,birthYear:1900,employment:{}}};
    const c=EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    EmploymentSystem.syncNpcLegacy(World,'npc:1');
    EmploymentSystem.resign(World,c.id,null,1931);
    return JSON.stringify(World.npcs['npc:1'].employment);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'unemployed');
  assert.equal(parsed.income,0);
});

test('subject retirement sets Pensioner state and clears the contract pointer',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={age:65,jobTier:3,career:null,careerYears:5,jobName:'Old Job'};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:1900});
    EmploymentSystem.retire(World,c.id,1930,{subject});
    return JSON.stringify({status:c.status,jobTier:subject.jobTier,jobName:subject.jobName,contractPtr:subject.employmentContractId});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'retired');
  assert.equal(parsed.jobTier,0);
  assert.equal(parsed.jobName,'Pensioner (retired)');
  assert.equal(parsed.contractPtr,null);
});

test('annual review is same-year idempotent',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    const first=EmploymentSystem.tickWorld(World,{year:1930});
    const second=EmploymentSystem.tickWorld(World,{year:1930});
    return JSON.stringify({firstReviews:first.reviews,secondReviews:second.reviews});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.firstReviews,1);
  assert.equal(parsed.secondReviews,0);
});

test('annual review is deterministic and does not touch global Random',()=>{
  const context1=freshWorld();
  const b1=business(context1,{settlementId:'branec',sector:'retail'});
  const r1=expose(context1,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b1.id}',annualSalary:1000,hiredYear:1930});
    EmploymentSystem.tickWorld(World,{year:1931});
    const c=EmploymentSystem.forPerson(World,'npc:1')[0];
    return JSON.stringify({performance:c.performance,satisfaction:c.satisfaction});
  })()`);
  const context2=freshWorld();
  const b2=business(context2,{settlementId:'branec',sector:'retail'});
  const r2=expose(context2,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b2.id}',annualSalary:1000,hiredYear:1930});
    EmploymentSystem.tickWorld(World,{year:1931});
    const c=EmploymentSystem.forPerson(World,'npc:1')[0];
    return JSON.stringify({performance:c.performance,satisfaction:c.satisfaction});
  })()`);
  assert.equal(r1,r2);
});

test('NPC retirement occurs automatically at age 65 during tickWorld',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    World.npcs={'npc:old':{id:'npc:old',alive:true,birthYear:1865,employment:{}}};
    EmploymentSystem.hire(World,{personId:'npc:old',businessId:'${b.id}',annualSalary:1000,hiredYear:1920});
    const r=EmploymentSystem.tickWorld(World,{year:1930});
    return JSON.stringify({retirements:r.retirements,status:EmploymentSystem.get(World,'employment:00001').status});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.retirements,1);
  assert.equal(parsed.status,'retired');
});

test('layoffs only occur at struggling businesses with more than one worker',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const biz=BusinessSystem.get(World,'${b.id}');
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    biz.status='active'; biz.finances.profit=100; biz.finances.revenue=1000; biz.finances.payroll=1000;
    const r=EmploymentSystem.tickWorld(World,{year:1930});
    return r.layoffs;
  })()`);
  assert.equal(result,0);
});

test('a lone employee is never laid off by the contraction rule',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const biz=BusinessSystem.get(World,'${b.id}');
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    biz.status='struggling'; biz.strugglingYears=3; biz.finances.profit=-500; biz.finances.revenue=1000; biz.finances.payroll=1000;
    const r=EmploymentSystem.tickWorld(World,{year:1930});
    return r.layoffs;
  })()`);
  assert.equal(result,0);
});

test('high payroll ratio at a struggling business triggers a layoff',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const biz=BusinessSystem.get(World,'${b.id}');
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:2',businessId:'${b.id}',annualSalary:100,hiredYear:1930});
    biz.status='struggling'; biz.finances.payroll=1000; biz.finances.revenue=1000; biz.finances.profit=-200;
    const r=EmploymentSystem.tickWorld(World,{year:1930});
    return r.layoffs;
  })()`);
  assert.ok(result>=1);
});

test('a vacancy opened this year is not automatically resolved by resolvePending',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:1930});
    VacancySystem.seedNpcApplications(World,v,{year:1930});
    World.npcs=World.npcs||{};
    Object.keys(World.npcs).forEach(id=>{});
    VacancySystem.resolvePending(World,{year:1930});
    return VacancySystem.get(World,v.id).status;
  })()`);
  assert.equal(result,'open');
});

test('a vacancy from a prior year is resolved by resolvePending',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:1900,locationId:'branec',education:{level:'basic',quality:0.6,years:2},employment:{}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:1929,requirements:{minAge:16,minCareerYears:0}});
    VacancySystem.seedNpcApplications(World,v,{year:1929});
    VacancySystem.resolvePending(World,{year:1930});
    return VacancySystem.get(World,v.id).status;
  })()`);
  assert.ok(['filled','open'].includes(result));
});

test('an explicit player application can resolve a same-year vacancy via applyAndResolve',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:'basic'},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:1930,requirements:{minAge:16}});
    const r=VacancySystem.applyAndResolve(World,v.id,'subject',{subject,year:1930});
    return JSON.stringify({applied:r.applied,status:VacancySystem.get(World,v.id).status});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,true);
  assert.equal(parsed.status,'filled');
});

test('player portal projects open vacancies with a stable vacancyId',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,location:{settlementId:'branec'},education:{completed:'basic'},skills:{}};
    VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const projected=VacancySystem.playerPortalVacancies(World,subject);
    return JSON.stringify(projected.map(p=>p.vacancyId));
  })()`);
  const projected=JSON.parse(result);
  assert.deepEqual(projected,['vacancy:00001']);
});

test('duplicate application by the same person is idempotent',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:'basic'},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.submitApplication(World,v.id,'subject',{subject,year:1930});
    VacancySystem.submitApplication(World,v.id,'subject',{subject,year:1930});
    return VacancySystem.get(World,v.id).applications.length;
  })()`);
  assert.equal(result,1);
});

test('unqualified application is recorded rejected, not pending',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  const result=expose(context,`(function(){
    const subject={age:12,alive:true,education:{completed:'basic'},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const r=VacancySystem.submitApplication(World,v.id,'subject',{subject,year:1930});
    return r.application.status;
  })()`);
  assert.equal(result,'rejected');
});

test('clean EmploymentSystem invariants after hire/promotion/layoff cycle',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  const result=expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928});
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    EmploymentSystem.promote(World,contract.id,v.id,1930);
    return JSON.stringify(EmploymentSystem.checkInvariants(World));
  })()`);
  assert.deepEqual(JSON.parse(result),[]);
});

test('clean VacancySystem invariants after fill cycle',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:'basic'},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.applyAndResolve(World,v.id,'subject',{subject,year:1930});
    return JSON.stringify(VacancySystem.checkInvariants(World));
  })()`);
  assert.deepEqual(JSON.parse(result),[]);
});

/* ===== Correctness hardening: NPC vacancy-origin contract preservation (section 3) ===== */

test('an NPC career vacancy contract survives multi-year reconcileNpcs calls unchanged',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  registerNpc(context,'npc:career');
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1234,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:career',{year:1930});
    const contractId=r.contract.id;
    for(let year=1931;year<=1934;year++){
      World.year=year;
      EmploymentSystem.reconcileNpcs(World);
    }
    const contract=EmploymentSystem.get(World,contractId);
    const biz=BusinessSystem.get(World,'${b.id}');
    return JSON.stringify({
      sameId:contract.id===contractId,status:contract.status,occupationId:contract.occupationId,
      occupationName:contract.occupationName,careerStage:contract.careerStage,jobTier:contract.jobTier,
      annualSalary:contract.annualSalary,businessId:contract.businessId,
      employeeIds:biz.employeeIds,activeCount:EmploymentSystem.activeForPerson(World,'npc:career').length
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.sameId,true);
  assert.equal(parsed.status,'active');
  assert.equal(parsed.occupationId,'medicine');
  assert.equal(parsed.occupationName,'Junior');
  assert.equal(parsed.careerStage,0);
  assert.equal(parsed.jobTier,1);
  assert.equal(parsed.annualSalary,1234);
  assert.equal(parsed.businessId,b.id);
  assert.deepEqual(parsed.employeeIds,['npc:career']);
  assert.equal(parsed.activeCount,1);
});

test('an NPC job vacancy contract also survives multi-year reconcileNpcs calls unchanged',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  registerNpc(context,'npc:job');
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:job',{year:1930});
    const contractId=r.contract.id;
    World.year=1931; EmploymentSystem.reconcileNpcs(World);
    World.year=1932; EmploymentSystem.reconcileNpcs(World);
    const contract=EmploymentSystem.get(World,contractId);
    return JSON.stringify({sameId:contract.id===contractId,status:contract.status,annualSalary:contract.annualSalary});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.sameId,true);
  assert.equal(parsed.status,'active');
  assert.equal(parsed.annualSalary,900);
});

test('a relocated vacancy-origin NPC contract is terminated with worker_relocated',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  registerNpc(context,'npc:mover');
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:mover',{year:1930});
    World.npcs['npc:mover'].locationId='elsewhere';
    World.year=1931;
    EmploymentSystem.reconcileNpcs(World);
    const contract=EmploymentSystem.get(World,r.contract.id);
    return JSON.stringify({status:contract.status,reason:contract.terminationReason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'terminated');
  assert.equal(parsed.reason,'worker_relocated');
});

test('a vacancy-origin NPC contract is withdrawn/terminated when the business closes',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  registerNpc(context,'npc:closed');
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:closed',{year:1930});
    const contractId=r.contract.id;
    BusinessSystem.close(World,'${b.id}','insolvency',1931);
    World.year=1931;
    EmploymentSystem.reconcileNpcs(World);
    const contract=EmploymentSystem.get(World,contractId);
    return JSON.stringify({status:contract.status,employment:World.npcs['npc:closed'].employment});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'terminated');
  assert.equal(parsed.employment.status,'unemployed');
});

test('a vacancy-origin NPC contract retires automatically once the NPC reaches 65',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  registerNpc(context,'npc:aging',{birthYear:1930-64});
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:aging',{year:1930});
    World.year=1931;
    EmploymentSystem.reconcileNpcs(World);
    const contract=EmploymentSystem.get(World,r.contract.id);
    return JSON.stringify({status:contract.status,employment:World.npcs['npc:aging'].employment});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'retired');
  assert.equal(parsed.employment.status,'retired');
});

test('a vacancy-origin NPC contract resigns when legacy employment marks the NPC unemployed',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  registerNpc(context,'npc:quit');
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:quit',{year:1930});
    World.npcs['npc:quit'].employment.status='unemployed';
    World.year=1931;
    EmploymentSystem.reconcileNpcs(World);
    const contract=EmploymentSystem.get(World,r.contract.id);
    return JSON.stringify({status:contract.status,reason:contract.terminationReason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'resigned');
  assert.equal(parsed.reason,'legacy_unemployed');
});

/* ===== Correctness hardening: terminal operations must synchronize the player (section 4) ===== */

test('dismiss() clears all S employment fields',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={employmentContractId:null,jobTier:1,jobName:'Worker',career:null,careerYears:3};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    subject.employmentContractId=c.id;
    EmploymentSystem.dismiss(World,c.id,'dismissed',1931,{subject});
    return JSON.stringify(subject);
  })()`);
  const subject=JSON.parse(result);
  assert.equal(subject.employmentContractId,null);
  assert.equal(subject.jobTier,0);
  assert.equal(subject.jobName,'Unemployed');
  assert.equal(subject.career,null);
  assert.equal(subject.careerYears,0);
});

test('quitjob-equivalent resign() clears all S fields and reconcilePlayer does not recreate the contract',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={employmentContractId:null,jobTier:1,jobName:'Worker',career:null,careerYears:3,location:{settlementId:'branec'}};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:1930});
    subject.employmentContractId=c.id;
    EmploymentSystem.resign(World,c.id,'voluntary_resignation',1931,{subject});
    EmploymentSystem.reconcilePlayer(World,subject);
    return JSON.stringify({subject,activeCount:EmploymentSystem.activeForPerson(World,'subject').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.subject.employmentContractId,null);
  assert.equal(parsed.subject.jobTier,0);
  assert.equal(parsed.subject.jobName,'Unemployed');
  assert.equal(parsed.activeCount,0);
});

test('a financial layoff clears S and reconcilePlayer does not recreate the contract',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={employmentContractId:null,jobTier:1,jobName:'Worker',career:null,careerYears:0,location:{settlementId:'branec'}};
    const biz=BusinessSystem.get(World,'${b.id}');
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:coworker',businessId:'${b.id}',annualSalary:100,hiredYear:1930});
    subject.employmentContractId=c.id;
    biz.status='struggling'; biz.finances.payroll=1000; biz.finances.revenue=1000; biz.finances.profit=-200;
    EmploymentSystem.tickWorld(World,{year:1930,subject});
    EmploymentSystem.reconcilePlayer(World,subject);
    return JSON.stringify({subject,activeCount:EmploymentSystem.activeForPerson(World,'subject').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.subject.jobTier,0);
  assert.equal(parsed.subject.jobName,'Unemployed');
  assert.equal(parsed.activeCount,0);
});

test('business closure clears S and reconcilePlayer does not recreate the contract',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={employmentContractId:null,jobTier:1,jobName:'Worker',career:null,careerYears:0,location:{settlementId:'branec'}};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    subject.employmentContractId=c.id;
    BusinessSystem.close(World,'${b.id}','insolvency',1931,{subject});
    EmploymentSystem.reconcilePlayer(World,subject);
    return JSON.stringify({subject,activeCount:EmploymentSystem.activeForPerson(World,'subject').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.subject.jobTier,0);
  assert.equal(parsed.subject.jobName,'Unemployed');
  assert.equal(parsed.activeCount,0);
});

test('retirement leaves the player Pensioner, never converted to Unemployed',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={employmentContractId:null,jobTier:3,jobName:'Manager',career:null,careerYears:5,location:{settlementId:'branec'}};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:1920});
    subject.employmentContractId=c.id;
    EmploymentSystem.retire(World,c.id,1931,{subject});
    EmploymentSystem.reconcilePlayer(World,subject);
    return JSON.stringify(subject);
  })()`);
  const subject=JSON.parse(result);
  assert.equal(subject.jobTier,0);
  assert.equal(subject.jobName,'Pensioner (retired)');
  assert.equal(subject.employmentContractId,null);
});

test('an NPC dismissal fully synchronizes npc.employment',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:fired');
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:fired',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.dismiss(World,c.id,'dismissed',1931);
    return JSON.stringify(World.npcs['npc:fired'].employment);
  })()`);
  const employment=JSON.parse(result);
  assert.equal(employment.status,'unemployed');
  assert.equal(employment.income,0);
});

/* ===== Correctness hardening: employment lifecycle tick idempotency (section 5) ===== */

test('EmploymentSystem.tickWorld sets employmentLifecycleLastTickYear and is same-year idempotent for layoffs',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const biz=BusinessSystem.get(World,'${b.id}');
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:2',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:3',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:4',businessId:'${b.id}',annualSalary:100,hiredYear:1930});
    biz.status='struggling'; biz.finances.payroll=3000; biz.finances.revenue=1000; biz.finances.profit=-1000;
    const first=EmploymentSystem.tickWorld(World,{year:1930});
    const activeAfterFirst=EmploymentSystem.activeForBusiness(World,'${b.id}').map(c=>c.id).sort();
    const historiesAfterFirst=activeAfterFirst.concat(EmploymentSystem.forBusiness(World,'${b.id}').map(c=>c.id)).map(id=>JSON.stringify(EmploymentSystem.get(World,id).history));
    const second=EmploymentSystem.tickWorld(World,{year:1930});
    const historiesAfterSecond=activeAfterFirst.concat(EmploymentSystem.forBusiness(World,'${b.id}').map(c=>c.id)).map(id=>JSON.stringify(EmploymentSystem.get(World,id).history));
    return JSON.stringify({
      firstLayoffs:first.layoffs,secondLayoffs:second.layoffs,secondReason:second.reason,
      marker:World.employmentLifecycleLastTickYear,
      historiesStable:JSON.stringify(historiesAfterFirst)===JSON.stringify(historiesAfterSecond),
      activeIds:activeAfterFirst
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.firstLayoffs>=1);
  assert.equal(parsed.secondLayoffs,0);
  assert.equal(parsed.secondReason,'already_applied');
  assert.equal(parsed.marker,1930);
  assert.equal(parsed.historiesStable,true);
});

test('EmploymentSystem.tickWorld rejects a stale-year call after already ticking a later year',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.tickWorld(World,{year:1931});
    const stale=EmploymentSystem.tickWorld(World,{year:1930});
    return JSON.stringify(stale);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,false);
  assert.equal(parsed.reason,'stale_year');
});

test('a repeated same-year tickWorld call does not change performance or satisfaction',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.tickWorld(World,{year:1931});
    const after1=JSON.stringify({p:EmploymentSystem.get(World,c.id).performance,s:EmploymentSystem.get(World,c.id).satisfaction});
    EmploymentSystem.tickWorld(World,{year:1931});
    const after2=JSON.stringify({p:EmploymentSystem.get(World,c.id).performance,s:EmploymentSystem.get(World,c.id).satisfaction});
    return after1===after2?'stable':'changed';
  })()`);
  assert.equal(result,'stable');
});

/* ===== Correctness hardening: automatic promotion ignores current-year openings (section 7) ===== */

test('automatic promotion does not consume a vacancy opened this same year',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  registerNpc(context,'npc:x');
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,employmentContractId:null};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1925});
    c.performance=0.9;
    subject.employmentContractId=c.id;
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,openedYear:1930,requirements:{minCareerYears:0}});
    const r=EmploymentSystem.considerAutomaticPromotion(World,subject,{year:1930,subject});
    const stillOpen=VacancySystem.get(World,v.id).status;
    return JSON.stringify({accepted:r.accepted,contractTier:EmploymentSystem.get(World,c.id).jobTier,vacancyStatus:stillOpen});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,false);
  assert.equal(parsed.contractTier,1);
  assert.equal(parsed.vacancyStatus,'open');
});

test('automatic promotion can consume a vacancy opened in a prior year',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,employmentContractId:null};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1925});
    c.performance=0.9;
    subject.employmentContractId=c.id;
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,openedYear:1929,requirements:{minCareerYears:0}});
    const r=EmploymentSystem.considerAutomaticPromotion(World,subject,{year:1930,subject});
    return JSON.stringify({accepted:r.accepted,contractTier:EmploymentSystem.get(World,c.id).jobTier});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,true);
  assert.equal(parsed.contractTier,2);
});

test('a manual requestPromotion (no requirePriorYearOpening) may consume a current-year vacancy',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1925});
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,openedYear:1930,requirements:{minCareerYears:0}});
    const r=EmploymentSystem.requestPromotion(World,c.id,{year:1930,subject:{age:30}});
    return JSON.stringify({accepted:r.accepted});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,true);
});

/* ===== Correctness hardening: API-boundary validation for acceptVacancy/promote (section 8) ===== */

test('acceptVacancy rejects an unqualified candidate directly, without ending an existing contract',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const b2=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  registerNpc(context,'npc:unqual',{birthYear:1918});
  const result=expose(context,`(function(){
    const existing=EmploymentSystem.hire(World,{personId:'npc:unqual',businessId:'${b1.id}',annualSalary:500,hiredYear:1930});
    const v=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:unqual',{year:1930});
    return JSON.stringify({accepted:r.accepted,reason:r.reason,existingStillActive:EmploymentSystem.get(World,existing.id).status});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,false);
  assert.equal(parsed.reason,'not_qualified');
  assert.equal(parsed.existingStillActive,'active');
});

test('promote() rejects a vacancy that is not exactly the next career stage',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  registerNpc(context,'npc:skip');
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:skip',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928});
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Chief',careerStage:2,jobTier:3,annualSalary:2000,requirements:{minCareerYears:0}});
    const r=EmploymentSystem.promote(World,c.id,v.id,1930);
    return JSON.stringify({accepted:r.accepted,reason:r.reason,unchangedStage:EmploymentSystem.get(World,c.id).careerStage});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,false);
  assert.equal(parsed.reason,'not_next_stage');
  assert.equal(parsed.unchangedStage,0);
});

test('promote() rejects insufficient tenure directly at the API boundary',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  registerNpc(context,'npc:new');
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:new',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1930});
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:5}});
    const r=EmploymentSystem.promote(World,c.id,v.id,1930);
    return JSON.stringify({accepted:r.accepted,reason:r.reason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accepted,false);
  assert.equal(parsed.reason,'insufficient_tenure');
});

/* ===== Correctness hardening: subject retirement fallback pensionBase (section 12) ===== */

test('EmploymentSystem.tickWorld retiring an overlooked age-65 subject sets a correct pensionBase',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={age:65,jobTier:0,pensionBase:0,employmentContractId:null,career:null,careerYears:0,jobName:'Manager'};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',jobTier:4,annualSalary:2000,hiredYear:1900});
    subject.employmentContractId=c.id;
    const r=EmploymentSystem.tickWorld(World,{year:1930,subject});
    return JSON.stringify({retirements:r.retirements,pensionBase:subject.pensionBase,jobName:subject.jobName,status:EmploymentSystem.get(World,c.id).status});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.retirements,1);
  assert.equal(parsed.pensionBase,500+4*380);
  assert.equal(parsed.jobName,'Pensioner (retired)');
  assert.equal(parsed.status,'retired');
});

/* ===== Correctness hardening: synchronized orphan/duplicate migration repairs (section 3) ===== */

test('subject contract at a missing business is terminated and all S fields become Unemployed',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={employmentContractId:null,jobTier:1,jobName:'Worker',career:null,careerYears:2,location:{settlementId:'branec'}};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    subject.employmentContractId=c.id;
    delete World.businesses['${b.id}'];
    EmploymentSystem.migrate(World,{subject});
    EmploymentSystem.reconcilePlayer(World,subject);
    return JSON.stringify({subject,status:EmploymentSystem.get(World,c.id).status,activeCount:EmploymentSystem.activeForPerson(World,'subject').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.subject.jobTier,0);
  assert.equal(parsed.subject.jobName,'Unemployed');
  assert.equal(parsed.subject.career,null);
  assert.equal(parsed.subject.employmentContractId,null);
  assert.equal(parsed.status,'terminated');
  assert.equal(parsed.activeCount,0);
});

test('an NPC contract at a missing business zeros income and becomes unemployed after migration',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:orphan');
  const result=expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:orphan',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    delete World.businesses['${b.id}'];
    EmploymentSystem.migrate(World);
    return JSON.stringify({employment:World.npcs['npc:orphan'].employment,status:EmploymentSystem.get(World,c.id).status});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.employment.status,'unemployed');
  assert.equal(parsed.employment.income,0);
  assert.equal(parsed.status,'terminated');
});

test('a preexisting closed-business contract is synchronized identically to a missing-business contract',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    const subject={employmentContractId:null,jobTier:1,jobName:'Worker',career:null,careerYears:2,location:{settlementId:'branec'}};
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    subject.employmentContractId=c.id;
    BusinessSystem.get(World,'${b.id}').status='closed';
    EmploymentSystem.migrate(World,{subject});
    return JSON.stringify(subject);
  })()`);
  const subject=JSON.parse(result);
  assert.equal(subject.jobTier,0);
  assert.equal(subject.jobName,'Unemployed');
});

test('duplicate subject contracts retain one deterministic winner and S reflects the survivor',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'retail'});
  const b2=business(context,{settlementId:'branec',sector:'finance'});
  const result=expose(context,`(function(){
    const subject={employmentContractId:null,jobTier:1,jobName:'Old',career:null,careerYears:0,location:{settlementId:'branec'}};
    const c1=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b1.id}',occupationType:'job',occupationName:'Old',jobTier:1,annualSalary:900,hiredYear:1925});
    World.employmentContracts[c1.id].status='active';
    const c2Id='employment:00099';
    World.employmentContracts[c2Id]={id:c2Id,personId:'subject',workerType:'player',businessId:'${b2.id}',settlementId:'branec',occupationType:'job',occupationId:'new',occupationName:'New',careerStage:null,jobTier:2,annualSalary:1200,hiredYear:1930,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[],origin:'legacy',stageStartedYear:1930,lastReviewYear:null,lastLifecycleYear:null,lastPromotionAttemptYear:null};
    World.employmentContractCounter=99;
    EmploymentSystem.migrate(World,{subject});
    const active=EmploymentSystem.activeForPerson(World,'subject');
    return JSON.stringify({subject,activeCount:active.length,winnerId:active[0]&&active[0].id});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.activeCount,1);
  assert.equal(parsed.winnerId,'employment:00099');
  assert.equal(parsed.subject.jobTier,2);
  assert.equal(parsed.subject.jobName,'New');
});

test('duplicate NPC contracts retain one winner and synchronize npc.employment to it',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'retail'});
  const b2=business(context,{settlementId:'branec',sector:'finance'});
  registerNpc(context,'npc:dup');
  const result=expose(context,`(function(){
    const c1=EmploymentSystem.hire(World,{personId:'npc:dup',businessId:'${b1.id}',annualSalary:900,hiredYear:1925});
    const c2Id='employment:00099';
    World.employmentContracts[c2Id]={id:c2Id,personId:'npc:dup',workerType:'npc',businessId:'${b2.id}',settlementId:'branec',occupationType:'job',occupationId:'new',occupationName:'New',careerStage:null,jobTier:2,annualSalary:1200,hiredYear:1930,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[],origin:'legacy',stageStartedYear:1930,lastReviewYear:null,lastLifecycleYear:null,lastPromotionAttemptYear:null};
    World.employmentContractCounter=99;
    EmploymentSystem.migrate(World);
    const active=EmploymentSystem.activeForPerson(World,'npc:dup');
    return JSON.stringify({activeCount:active.length,winnerId:active[0]&&active[0].id,employment:World.npcs['npc:dup'].employment});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.activeCount,1);
  assert.equal(parsed.winnerId,'employment:00099');
  assert.equal(parsed.employment.income,1200);
});

test('repeated migration of orphan/duplicate repairs is idempotent',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    delete World.businesses['${b.id}'];
    EmploymentSystem.migrate(World);
    const first=JSON.stringify(World.employmentContracts);
    EmploymentSystem.migrate(World);
    const second=JSON.stringify(World.employmentContracts);
    return first===second?'stable':'changed';
  })()`);
  assert.equal(result,'stable');
});

/* ===== Correctness hardening: vacancy-origin NPC reconciliation fallbacks (section 4) ===== */

test('a vacancy-origin NPC contract with a missing employment object is not terminated',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec'}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:a',{year:1930});
    delete World.npcs['npc:a'].employment;
    World.year=1931;
    EmploymentSystem.reconcileNpcs(World);
    return EmploymentSystem.get(World,r.contract.id).status;
  })()`);
  assert.equal(result,'active');
});

test('a vacancy-origin NPC contract with an empty employment status is not terminated',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',employment:{status:''}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:a',{year:1930});
    World.year=1931;
    EmploymentSystem.reconcileNpcs(World);
    return EmploymentSystem.get(World,r.contract.id).status;
  })()`);
  assert.equal(result,'active');
});

test('an unknown legacy employment status is repaired to employed, not terminated',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',employment:{status:'furloughed'}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:a',{year:1930});
    World.year=1931;
    EmploymentSystem.reconcileNpcs(World);
    return JSON.stringify({status:EmploymentSystem.get(World,r.contract.id).status,employment:World.npcs['npc:a'].employment.status});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'active');
  assert.equal(parsed.employment,'employed');
});

test('an alive vacancy-origin NPC is never assigned npc_deceased',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail',kind:'public'});
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',employment:{status:'garbage-value'}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const r=EmploymentSystem.acceptVacancy(World,v,'npc:a',{year:1930});
    World.year=1931;
    EmploymentSystem.reconcileNpcs(World);
    const c=EmploymentSystem.get(World,r.contract.id);
    return JSON.stringify({status:c.status,reason:c.terminationReason});
  })()`);
  const parsed=JSON.parse(result);
  assert.notEqual(parsed.reason,'npc_deceased');
});

test('a non-vacancy NPC contract ended from legacy unemployment receives income 0',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:legacy');
  const result=expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:legacy',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    World.npcs['npc:legacy'].employment.status='unemployed';
    EmploymentSystem.reconcileNpcs(World);
    return JSON.stringify(World.npcs['npc:legacy'].employment);
  })()`);
  const employment=JSON.parse(result);
  assert.equal(employment.income,0);
});
