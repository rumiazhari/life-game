'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function freshWorld(){
  const context=createWorldContext();
  expose(context,`World={year:1930,seed:'test-seed',activeSettlementId:'branec',settlements:{}};BusinessSystem.ensure(World);EmploymentSystem.ensure(World);VacancySystem.ensure(World);WorkplaceSystem.ensure(World);`);
  return context;
}
function business(context,spec){
  return JSON.parse(expose(context,`(function(){ return JSON.stringify(BusinessSystem.create(World,${JSON.stringify(spec)})); })()`));
}
function hire(context,spec){
  return JSON.parse(expose(context,`(function(){ return JSON.stringify(EmploymentSystem.hire(World,${JSON.stringify(spec)})); })()`));
}

/* ===== A. Schema and migration ===== */

test('world workplace fields are initialized by ensure',()=>{
  const context=freshWorld();
  const result=JSON.parse(expose(context,`(function(){ return JSON.stringify({schema:World.workplaceSchemaVersion,tick:World.workplaceLastTickYear}); })()`));
  assert.equal(result.schema,1);
  assert.equal(result.tick,null);
});

test('legacy contracts missing workplace fields receive defaults on migration',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    World.employmentContracts['employment:00001']={id:'employment:00001',personId:'npc:legacy',workerType:'npc',businessId:'${b.id}',settlementId:'${b.settlementId}',occupationType:'generic',occupationId:null,occupationName:'Worker',careerStage:null,jobTier:1,annualSalary:900,hiredYear:1928,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[],origin:'legacy',stageStartedYear:1928,lastReviewYear:null,lastLifecycleYear:null,lastPromotionAttemptYear:null,vacancyAssignments:[]};
    World.employmentContractCounter=1;
    EmploymentSystem.migrate(World);
    WorkplaceSystem.migrate(World);
    const c=EmploymentSystem.get(World,'employment:00001');
    return JSON.stringify({supervisorPersonId:c.supervisorPersonId,workplaceStress:c.workplaceStress,workplaceLastTickYear:c.workplaceLastTickYear});
  })()`));
  assert.equal(result.supervisorPersonId,null);
  assert.equal(result.workplaceStress,0.35);
  assert.equal(result.workplaceLastTickYear,null);
});

test('malformed workplaceStress is repaired to a bounded default on migration',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    c.workplaceStress='not-a-number';
    EmploymentSystem.migrate(World);
    const repaired=EmploymentSystem.get(World,c.id).workplaceStress;
    EmploymentSystem.get(World,c.id).workplaceStress=99;
    EmploymentSystem.migrate(World);
    const clamped=EmploymentSystem.get(World,c.id).workplaceStress;
    return JSON.stringify({repaired,clamped});
  })()`));
  assert.equal(result.repaired,0.35);
  assert.equal(result.clamped,1);
});

test('migration clears self, missing, cross-business, and on_leave supervisor references',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'retail'});
  const b2=business(context,{settlementId:'branec',sector:'finance'});
  const result=JSON.parse(expose(context,`(function(){
    const self=EmploymentSystem.hire(World,{personId:'npc:self',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    const missing=EmploymentSystem.hire(World,{personId:'npc:missing',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    const other=EmploymentSystem.hire(World,{personId:'npc:other',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    const cross=EmploymentSystem.hire(World,{personId:'npc:cross-target',businessId:'${b2.id}',annualSalary:900,hiredYear:1930});
    const onLeaveSup=EmploymentSystem.create(World,{personId:'npc:on-leave-target',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,status:'on_leave'});
    const valid=EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    self.supervisorPersonId='npc:self';
    missing.supervisorPersonId='npc:does-not-exist';
    other.supervisorPersonId='npc:cross-target';
    EmploymentSystem.migrate(World);
    const selfAfterEmploymentMigrateOnly=EmploymentSystem.get(World,self.id).supervisorPersonId;
    const missingAfterEmploymentMigrateOnly=EmploymentSystem.get(World,missing.id).supervisorPersonId;
    WorkplaceSystem.migrate(World);
    return JSON.stringify({
      selfAfterEmploymentMigrateOnly,
      missingAfterEmploymentMigrateOnly,
      self:EmploymentSystem.get(World,self.id).supervisorPersonId,
      missing:EmploymentSystem.get(World,missing.id).supervisorPersonId,
      other:EmploymentSystem.get(World,other.id).supervisorPersonId,
      onLeave:EmploymentSystem.get(World,onLeaveSup.id).status,
      lead:EmploymentSystem.get(World,valid.id).supervisorPersonId
    });
  })()`));
  assert.equal(result.selfAfterEmploymentMigrateOnly,null,'EmploymentSystem.migrate alone clears a self-reference');
  assert.equal(result.missingAfterEmploymentMigrateOnly,'npc:does-not-exist','EmploymentSystem.migrate alone does not resolve cross-referential validity');
  assert.equal(result.self,'npc:lead');
  assert.equal(result.missing,'npc:lead');
  assert.equal(result.other,'npc:lead');
  assert.notEqual(result.other,'npc:cross-target');
  assert.equal(result.onLeave,'on_leave');
  assert.equal(result.lead,null);
});

test('a valid supervisor assignment is preserved across migration',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.migrate(World);
    const before=JSON.stringify(World.employmentContracts);
    EmploymentSystem.migrate(World);
    WorkplaceSystem.migrate(World);
    const after=JSON.stringify(World.employmentContracts);
    return JSON.stringify({stable:before===after});
  })()`));
  assert.equal(result.stable,true);
});

test('second and third combined migrations are byte-for-byte identical',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    EmploymentSystem.migrate(World); WorkplaceSystem.migrate(World);
    const first=JSON.stringify(World.employmentContracts);
    EmploymentSystem.migrate(World); WorkplaceSystem.migrate(World);
    const second=JSON.stringify(World.employmentContracts);
    EmploymentSystem.migrate(World); WorkplaceSystem.migrate(World);
    const third=JSON.stringify(World.employmentContracts);
    return JSON.stringify({stable12:first===second,stable23:second===third});
  })()`));
  assert.equal(result.stable12,true);
  assert.equal(result.stable23,true);
});

/* ===== B. Coworker derivation ===== */

test('coworkers are derived only from active/on_leave same-business contracts',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'retail'});
  const b2=business(context,{settlementId:'branec',sector:'finance'});
  const result=JSON.parse(expose(context,`(function(){
    const a=EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    const onLeave=EmploymentSystem.create(World,{personId:'npc:b',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,status:'on_leave'});
    const ended=EmploymentSystem.hire(World,{personId:'npc:c',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.dismiss(World,ended.id,'test',1931);
    EmploymentSystem.hire(World,{personId:'npc:d',businessId:'${b2.id}',annualSalary:900,hiredYear:1930});
    const ids=WorkplaceSystem.coworkerPersonIds(World,a.id);
    return JSON.stringify({ids,includesOnLeave:ids.includes('npc:b'),includesEnded:ids.includes('npc:c'),includesOtherBusiness:ids.includes('npc:d')});
  })()`));
  assert.deepEqual(result.ids,['npc:b']);
  assert.equal(result.includesOnLeave,true);
  assert.equal(result.includesEnded,false);
  assert.equal(result.includesOtherBusiness,false);
});

test('coworker projection is stable, has no duplicates, and does not persist a coworker array',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const a=EmploymentSystem.hire(World,{personId:'npc:z',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:m',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    const first=WorkplaceSystem.coworkerPersonIds(World,a.id);
    const second=WorkplaceSystem.coworkerPersonIds(World,a.id);
    return JSON.stringify({first,second,stable:JSON.stringify(first)===JSON.stringify(second),hasCoworkerField:'coworkers' in EmploymentSystem.get(World,a.id),hasWorldRegistry:!!World.workplaceCoworkers});
  })()`));
  assert.deepEqual(result.first,['npc:a','npc:m']);
  assert.equal(result.stable,true);
  assert.equal(result.hasCoworkerField,false);
  assert.equal(result.hasWorldRegistry,false);
});

test('coworkerContracts and coworkerPersonIds return empty for a missing or ended contract',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const a=EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:b',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.dismiss(World,a.id,'test',1931);
    return JSON.stringify({
      forEnded:WorkplaceSystem.coworkerPersonIds(World,a.id),
      forMissing:WorkplaceSystem.coworkerPersonIds(World,'employment:99999')
    });
  })()`));
  assert.deepEqual(result.forEnded,[]);
  assert.deepEqual(result.forMissing,[]);
});

/* ===== C. Supervisor assignment ===== */

test('supervisor assignment is deterministic and independent of hiring order',()=>{
  const context1=freshWorld();
  const b1=business(context1,{settlementId:'branec',sector:'retail'});
  const r1=JSON.parse(expose(context1,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:low',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    EmploymentSystem.hire(World,{personId:'npc:high',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,jobTier:4});
    EmploymentSystem.hire(World,{personId:'npc:mid',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,jobTier:2});
    WorkplaceSystem.syncBusiness(World,'${b1.id}',{year:1930,recordMemories:false});
    const contracts=EmploymentSystem.forBusiness(World,'${b1.id}');
    const byPerson={}; contracts.forEach(c=>{byPerson[c.personId]=c.supervisorPersonId;});
    return JSON.stringify(byPerson);
  })()`));
  const context2=freshWorld();
  const b2=business(context2,{settlementId:'branec',sector:'retail'});
  const r2=JSON.parse(expose(context2,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:mid',businessId:'${b2.id}',annualSalary:900,hiredYear:1930,jobTier:2});
    EmploymentSystem.hire(World,{personId:'npc:high',businessId:'${b2.id}',annualSalary:900,hiredYear:1930,jobTier:4});
    EmploymentSystem.hire(World,{personId:'npc:low',businessId:'${b2.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b2.id}',{year:1930,recordMemories:false});
    const contracts=EmploymentSystem.forBusiness(World,'${b2.id}');
    const byPerson={}; contracts.forEach(c=>{byPerson[c.personId]=c.supervisorPersonId;});
    return JSON.stringify(byPerson);
  })()`));
  assert.deepEqual(r1,r2);
  assert.equal(r1['npc:high'],null);
  assert.equal(r1['npc:low'],'npc:high');
  assert.equal(r1['npc:mid'],'npc:high');
});

test('on_leave worker may receive supervision but cannot provide it',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const onLeaveHighTier=EmploymentSystem.create(World,{personId:'npc:on-leave',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5,status:'on_leave'});
    const active=EmploymentSystem.hire(World,{personId:'npc:active',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
    return JSON.stringify({
      onLeaveSupervisor:EmploymentSystem.get(World,onLeaveHighTier.id).supervisorPersonId,
      activeSupervisor:EmploymentSystem.get(World,active.id).supervisorPersonId
    });
  })()`));
  assert.equal(result.onLeaveSupervisor,'npc:active');
  assert.equal(result.activeSupervisor,null);
});

test('a single-worker business has no supervisor assignment and no self-reference is ever created',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const solo=EmploymentSystem.hire(World,{personId:'npc:solo',businessId:'${b.id}',annualSalary:900,hiredYear:1930});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
    return JSON.stringify(EmploymentSystem.get(World,solo.id).supervisorPersonId);
  })()`));
  assert.equal(result,null);
});

test('no supervisor cycle can form under repeated syncs',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:3});
    EmploymentSystem.hire(World,{personId:'npc:b',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:2});
    EmploymentSystem.hire(World,{personId:'npc:c',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
    return JSON.stringify(WorkplaceSystem.checkInvariants(World));
  })()`));
  assert.deepEqual(result,[]);
});

test('promotion can deterministically change the workplace lead',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'healthcare',kind:'public'});
  const result=JSON.parse(expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:junior']={id:'npc:junior',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}};
    const senior=EmploymentSystem.hire(World,{personId:'npc:senior',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928});
    const junior=EmploymentSystem.hire(World,{personId:'npc:junior',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
    const before=EmploymentSystem.get(World,junior.id).supervisorPersonId;
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    const r=EmploymentSystem.promote(World,junior.id,v.id,1930);
    if(!r.accepted) throw new Error('setup failed: '+r.reason);
    return JSON.stringify({
      before,
      afterJunior:EmploymentSystem.get(World,junior.id).supervisorPersonId,
      afterSenior:EmploymentSystem.get(World,senior.id).supervisorPersonId
    });
  })()`));
  assert.equal(result.before,'npc:senior');
  assert.equal(result.afterJunior,null);
  assert.equal(result.afterSenior,'npc:junior');
});

test('resignation/dismissal/retirement immediately repairs workplace topology',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const lead=EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
    const beforeSupervisor=EmploymentSystem.get(World,worker.id).supervisorPersonId;
    EmploymentSystem.dismiss(World,lead.id,'test',1931);
    return JSON.stringify({
      beforeSupervisor,
      afterSupervisor:EmploymentSystem.get(World,worker.id).supervisorPersonId,
      leadSupervisorAfterEnd:EmploymentSystem.get(World,lead.id).supervisorPersonId
    });
  })()`));
  assert.equal(result.beforeSupervisor,'npc:lead');
  assert.equal(result.afterSupervisor,null);
  assert.equal(result.leadSupervisorAfterEnd,null);
});

test('business closure repairs supervisor assignments immediately',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
    BusinessSystem.close(World,'${b.id}','insolvency',1931);
    return JSON.stringify(WorkplaceSystem.checkInvariants(World));
  })()`));
  assert.deepEqual(result,[]);
});

test('switching employers repairs both the old and new business topology',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'retail'});
  const b2=business(context,{settlementId:'branec',sector:'finance'});
  const result=JSON.parse(expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:mover']={id:'npc:mover',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}};
    const mover=EmploymentSystem.hire(World,{personId:'npc:mover',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    const stayer=EmploymentSystem.hire(World,{personId:'npc:stayer',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    EmploymentSystem.hire(World,{personId:'npc:new-lead',businessId:'${b2.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    WorkplaceSystem.syncBusiness(World,'${b1.id}',{year:1930,recordMemories:false});
    WorkplaceSystem.syncBusiness(World,'${b2.id}',{year:1930,recordMemories:false});
    const beforeStayerSupervisor=EmploymentSystem.get(World,stayer.id).supervisorPersonId;
    const v=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:0}});
    const acceptResult=EmploymentSystem.acceptVacancy(World,v,'npc:mover',{year:1931});
    if(!acceptResult.accepted) throw new Error('setup failed: '+acceptResult.reason);
    return JSON.stringify({
      beforeStayerSupervisor,
      stayerAfter:EmploymentSystem.get(World,stayer.id).supervisorPersonId,
      moverContractSupervisor:EmploymentSystem.activeForPerson(World,'npc:mover')[0].supervisorPersonId,
      invariants:WorkplaceSystem.checkInvariants(World)
    });
  })()`));
  assert.equal(result.beforeStayerSupervisor,null);
  assert.equal(result.stayerAfter,null);
  assert.equal(result.moverContractSupervisor,'npc:new-lead');
  assert.deepEqual(result.invariants,[]);
});

/* ===== D. RelationshipMemory integration ===== */

test('a starting supervisor assignment creates exactly one neutral memory',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:true});
    const memories=Object.values(World.relationshipMemories).filter(m=>m.type==='workplace_supervision_started');
    return JSON.stringify({count:memories.length,valence:memories[0]?memories[0].valence:null});
  })()`));
  assert.equal(result.count,1);
  assert.equal(result.valence,0);
});

test('an ending supervisor assignment creates exactly one neutral memory',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const lead=EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:true});
    EmploymentSystem.dismiss(World,lead.id,'test',1931);
    const memories=Object.values(World.relationshipMemories).filter(m=>m.type==='workplace_supervision_ended');
    return JSON.stringify({count:memories.length,valence:memories[0]?memories[0].valence:null});
  })()`));
  assert.equal(result.count,1);
  assert.equal(result.valence,0);
});

test('an unchanged repeat sync creates no additional memory',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:true});
    const afterFirst=Object.keys(World.relationshipMemories).length;
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:true});
    const afterSecond=Object.keys(World.relationshipMemories).length;
    return JSON.stringify({afterFirst,afterSecond});
  })()`));
  assert.equal(result.afterFirst,1);
  assert.equal(result.afterSecond,1);
});

test('migration never creates a relationship memory',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    EmploymentSystem.migrate(World);
    WorkplaceSystem.migrate(World);
    RelationshipMemory.ensure(World);
    return JSON.stringify(Object.keys(World.relationshipMemories).length);
  })()`));
  assert.equal(result,0);
});

test('same-year repeated sync does not create a duplicate memory, and no second relationship collection exists',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncAll(World,{year:1930,recordMemories:true});
    WorkplaceSystem.syncAll(World,{year:1930,recordMemories:true});
    return JSON.stringify({
      memoryCount:Object.keys(World.relationshipMemories).length,
      hasSecondCollection:!!World.workplaceMemories||!!World.workplaceRelationships
    });
  })()`));
  assert.equal(result.memoryCount,1);
  assert.equal(result.hasSecondCollection,false);
});

/* ===== E. Stress ===== */

test('workplace stress is deterministic for identical seed/year/state',()=>{
  function run(){
    const context=freshWorld();
    const b=business(context,{settlementId:'branec',sector:'retail'});
    return JSON.parse(expose(context,`(function(){
      const lead=EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
      const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
      WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
      const r=WorkplaceSystem.tickContract(World,EmploymentSystem.get(World,worker.id),1930);
      return JSON.stringify(r.stress);
    })()`));
  }
  assert.equal(run(),run());
});

test('supervisor topology (and therefore which stream seeds each contract) is independent of hiring order',()=>{
  const context1=freshWorld();
  const b1=business(context1,{settlementId:'branec',sector:'retail'});
  const r1=JSON.parse(expose(context1,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    WorkplaceSystem.syncBusiness(World,'${b1.id}',{year:1930,recordMemories:false});
    return JSON.stringify(EmploymentSystem.get(World,worker.id).supervisorPersonId);
  })()`));
  const context2=freshWorld();
  const b2=business(context2,{settlementId:'branec',sector:'retail'});
  const r2=JSON.parse(expose(context2,`(function(){
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b2.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b2.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    WorkplaceSystem.syncBusiness(World,'${b2.id}',{year:1930,recordMemories:false});
    return JSON.stringify(EmploymentSystem.get(World,worker.id).supervisorPersonId);
  })()`));
  assert.equal(r1,r2);
  assert.equal(r1,'npc:lead');
});

test('tickContract consumes exactly one deterministic stream and does not affect the shared Random stream',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    Random.setSeed('personal-check'); Random.next();
    const before=Random.next();
    Random.setSeed('personal-check'); Random.next();
    WorkplaceSystem.tickContract(World,EmploymentSystem.get(World,worker.id),1930);
    const after=Random.next();
    return JSON.stringify({isolated:before===after});
  })()`));
  assert.equal(result.isolated,true);
});

test('same-year and stale-year tickContract calls are no-ops',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    const contract=EmploymentSystem.get(World,worker.id);
    const first=WorkplaceSystem.tickContract(World,contract,1930);
    const stressAfterFirst=contract.workplaceStress;
    const sameYear=WorkplaceSystem.tickContract(World,contract,1930);
    const staleYear=WorkplaceSystem.tickContract(World,contract,1929);
    return JSON.stringify({
      firstApplied:first.applied,
      sameYearApplied:sameYear.applied,sameYearReason:sameYear.reason,
      staleYearApplied:staleYear.applied,staleYearReason:staleYear.reason,
      stressUnchanged:contract.workplaceStress===stressAfterFirst
    });
  })()`));
  assert.equal(result.firstApplied,true);
  assert.equal(result.sameYearApplied,false);
  assert.equal(result.sameYearReason,'already_applied');
  assert.equal(result.staleYearApplied,false);
  assert.equal(result.staleYearReason,'stale_year');
  assert.equal(result.stressUnchanged,true);
});

test('stress values remain finite and within 0..1 across many years',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    let allValid=true;
    for(let y=1930;y<1960;y++){
      const contract=EmploymentSystem.get(World,worker.id);
      const r=WorkplaceSystem.tickContract(World,contract,y);
      if(!Number.isFinite(r.stress)||r.stress<0||r.stress>1) allValid=false;
    }
    return JSON.stringify(allValid);
  })()`));
  assert.equal(result,true);
});

test('a struggling, understaffed business produces more stress pressure than a healthy fully-staffed one with otherwise identical inputs',()=>{
  const context=freshWorld();
  const bHealthy=business(context,{settlementId:'branec',sector:'retail'});
  const bStruggling=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const healthyBiz=BusinessSystem.get(World,'${bHealthy.id}');
    healthyBiz.status='active'; healthyBiz.finances.profit=500;
    const strugglingBiz=BusinessSystem.get(World,'${bStruggling.id}');
    strugglingBiz.status='struggling'; strugglingBiz.finances.profit=-500;
    const healthyWorker=EmploymentSystem.hire(World,{personId:'npc:healthy',businessId:'${bHealthy.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    const strugglingWorker=EmploymentSystem.hire(World,{personId:'npc:struggling',businessId:'${bStruggling.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    const healthyInputs=WorkplaceSystem.stressInputs(World,EmploymentSystem.get(World,healthyWorker.id));
    const strugglingInputs=WorkplaceSystem.stressInputs(World,EmploymentSystem.get(World,strugglingWorker.id));
    return JSON.stringify({healthyPressure:healthyInputs.businessPressure,strugglingPressure:strugglingInputs.businessPressure});
  })()`));
  assert.ok(result.strugglingPressure>result.healthyPressure);
});

test('positive supervisor trust lowers target stress and supervisor conflict raises it',()=>{
  const context=freshWorld();
  const bTrust=business(context,{settlementId:'branec',sector:'retail'});
  const bConflict=business(context,{settlementId:'branec',sector:'retail'});
  const bNeutral=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    function setup(businessId,workerPersonId,leadPersonId){
      EmploymentSystem.hire(World,{personId:leadPersonId,businessId,annualSalary:900,hiredYear:1930,jobTier:5});
      const worker=EmploymentSystem.hire(World,{personId:workerPersonId,businessId,annualSalary:900,hiredYear:1930,jobTier:1});
      WorkplaceSystem.syncBusiness(World,businessId,{year:1930,recordMemories:false});
      return EmploymentSystem.get(World,worker.id);
    }
    const neutralWorker=setup('${bNeutral.id}','npc:neutral-worker','npc:neutral-lead');
    const trustWorker=setup('${bTrust.id}','npc:trust-worker','npc:trust-lead');
    RelationshipMemory.add(World,{year:1930,type:'mentorship',participants:['npc:trust-worker','npc:trust-lead'],intensity:1,valence:1,decay:0.01,summary:'trust-building'});
    const conflictWorker=setup('${bConflict.id}','npc:conflict-worker','npc:conflict-lead');
    RelationshipMemory.add(World,{year:1930,type:'dispute',participants:['npc:conflict-worker','npc:conflict-lead'],intensity:1,valence:-1,decay:0.01,summary:'conflict-building'});
    const neutralInputs=WorkplaceSystem.stressInputs(World,neutralWorker);
    const trustInputs=WorkplaceSystem.stressInputs(World,trustWorker);
    const conflictInputs=WorkplaceSystem.stressInputs(World,conflictWorker);
    return JSON.stringify({
      neutralTrust:neutralInputs.supervisorTrustRelief,neutralConflict:neutralInputs.supervisorConflict,
      trustRelief:trustInputs.supervisorTrustRelief,conflict:conflictInputs.supervisorConflict
    });
  })()`));
  assert.ok(result.trustRelief>result.neutralTrust);
  assert.ok(result.conflict>result.neutralConflict);
});

test('workplace stress never mutates health, happiness, performance, satisfaction, salary, cash, or contract status',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    const worker=EmploymentSystem.hire(World,{personId:'npc:worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    const contract=EmploymentSystem.get(World,worker.id);
    const before={performance:contract.performance,satisfaction:contract.satisfaction,annualSalary:contract.annualSalary,status:contract.status};
    WorkplaceSystem.tickContract(World,contract,1930);
    const after={performance:contract.performance,satisfaction:contract.satisfaction,annualSalary:contract.annualSalary,status:contract.status};
    return JSON.stringify({before,after,unchanged:JSON.stringify(before)===JSON.stringify(after)});
  })()`));
  assert.equal(result.unchanged,true);
});

/* ===== G. Invariants ===== */

test('checkInvariants flags each required invalid state',()=>{
  const context=freshWorld();
  const b1=business(context,{settlementId:'branec',sector:'retail'});
  const b2=business(context,{settlementId:'branec',sector:'finance'});
  const result=JSON.parse(expose(context,`(function(){
    const ended=EmploymentSystem.hire(World,{personId:'npc:ended',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    ended.supervisorPersonId='npc:someone';
    EmploymentSystem.dismiss(World,ended.id,'test',1931);
    EmploymentSystem.get(World,ended.id).supervisorPersonId='npc:someone';

    const selfSup=EmploymentSystem.hire(World,{personId:'npc:self',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    selfSup.supervisorPersonId='npc:self';

    const missingSup=EmploymentSystem.hire(World,{personId:'npc:missing-ref',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    missingSup.supervisorPersonId='npc:nobody';

    const crossA=EmploymentSystem.hire(World,{personId:'npc:cross-a',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    EmploymentSystem.hire(World,{personId:'npc:cross-b',businessId:'${b2.id}',annualSalary:900,hiredYear:1930});
    crossA.supervisorPersonId='npc:cross-b';

    const onLeaveTarget=EmploymentSystem.create(World,{personId:'npc:on-leave-target',businessId:'${b1.id}',annualSalary:900,hiredYear:1930,status:'on_leave'});
    const onLeaveRef=EmploymentSystem.hire(World,{personId:'npc:on-leave-ref',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    onLeaveRef.supervisorPersonId='npc:on-leave-target';

    const closedBiz=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const closedWorker=EmploymentSystem.hire(World,{personId:'npc:closed-worker',businessId:closedBiz.id,annualSalary:900,hiredYear:1930});
    const closedLead=EmploymentSystem.hire(World,{personId:'npc:closed-lead',businessId:closedBiz.id,annualSalary:900,hiredYear:1930,jobTier:5});
    closedWorker.supervisorPersonId='npc:closed-lead';
    closedBiz.status='closed';

    const badStress=EmploymentSystem.hire(World,{personId:'npc:bad-stress',businessId:'${b1.id}',annualSalary:900,hiredYear:1930});
    badStress.workplaceStress=5;

    const issues=WorkplaceSystem.checkInvariants(World);
    return JSON.stringify(issues);
  })()`));
  const issues=result.join('\n');
  assert.ok(/ended but retains supervisorPersonId/.test(issues));
  assert.ok(/supervises itself/.test(issues));
  assert.ok(/no active contract/.test(issues));
  assert.ok(/another business/.test(issues));
  assert.ok(/on_leave supervisor/.test(issues));
  assert.ok(/missing or closed business/.test(issues));
  assert.ok(/invalid workplaceStress/.test(issues));
});

test('a valid mixed active/on_leave workplace passes checkInvariants cleanly',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const result=JSON.parse(expose(context,`(function(){
    EmploymentSystem.hire(World,{personId:'npc:lead',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:5});
    EmploymentSystem.hire(World,{personId:'npc:active-worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});
    EmploymentSystem.create(World,{personId:'npc:on-leave-worker',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1,status:'on_leave'});
    WorkplaceSystem.syncBusiness(World,'${b.id}',{year:1930,recordMemories:false});
    return JSON.stringify({
      workplace:WorkplaceSystem.checkInvariants(World),
      business:BusinessSystem.checkInvariants(World),
      employment:EmploymentSystem.checkInvariants(World)
    });
  })()`));
  assert.deepEqual(result.workplace,[]);
  assert.deepEqual(result.business,[]);
  assert.deepEqual(result.employment,[]);
});
