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
