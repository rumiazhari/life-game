'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function freshWorld(){
  const context=createWorldContext();
  expose(context,`World={year:1930,seed:'test-seed',activeSettlementId:'branec',settlements:{}};`);
  return context;
}

function migratedWorld(){
  const context=freshWorld();
  expose(context,`WorldSimulation.migrate(World);`);
  return context;
}

test('ensure creates valid empty employment state',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ EmploymentSystem.ensure(World); return JSON.stringify({contracts:World.employmentContracts,counter:World.employmentContractCounter,schema:World.employmentSchemaVersion}); })()`);
  const parsed=JSON.parse(result);
  assert.deepEqual(parsed.contracts,{});
  assert.equal(parsed.counter,0);
  assert.equal(parsed.schema,3);
});

test('ensure strictly normalizes a malformed employmentContractCounter',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ World.employmentContractCounter='7'; EmploymentSystem.ensure(World); return World.employmentContractCounter; })()`);
  assert.equal(result,0);
});

test('hire generates sequential stable contract IDs',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const a=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id});
    const c=EmploymentSystem.hire(World,{personId:'npc:b',businessId:b.id});
    return JSON.stringify([a.id,c.id]);
  })()`);
  const [a,c]=JSON.parse(result);
  assert.equal(a,'employment:00001');
  assert.equal(c,'employment:00002');
});

test('IDs are never reused even with a stale counter',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    World.employmentContracts['employment:00007']={id:'employment:00007',personId:'npc:existing',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'Worker',careerStage:null,jobTier:1,annualSalary:0,hiredYear:1930,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    b.employeeIds=['npc:existing'];
    World.employmentContractCounter=0;
    const created=EmploymentSystem.hire(World,{personId:'npc:new',businessId:b.id});
    return created.id;
  })()`);
  assert.equal(result,'employment:00008');
});

test('migration repairs malformed and duplicate contract IDs',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    World.employmentContracts['not-a-valid-id']={id:'not-a-valid-id',personId:'npc:x',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationName:'Odd Job',status:'active',history:[]};
    EmploymentSystem.migrate(World);
    const ids=Object.keys(World.employmentContracts);
    const allValid=ids.every(id=>/^employment:\\d{5,}$/.test(id));
    return JSON.stringify({allValid});
  })()`);
  assert.ok(JSON.parse(result).allValid);
});

test('primitive employment contract records survive migration',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.employmentContracts['legacy-null']=null;
    World.employmentContracts['legacy-string']='oops';
    World.employmentContracts['legacy-number']=5;
    World.employmentContracts['legacy-bool']=true;
    World.employmentContracts['legacy-array']=['x'];
    const before=Object.keys(World.employmentContracts).length;
    EmploymentSystem.migrate(World);
    const after=Object.keys(World.employmentContracts).length;
    return JSON.stringify({before,after});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.before,5);
  assert.equal(parsed.after,5);
});

test('migration is byte-for-byte idempotent',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:1200});
    EmploymentSystem.migrate(World);
    const first=JSON.stringify(World.employmentContracts);
    const firstCounter=World.employmentContractCounter;
    EmploymentSystem.migrate(World);
    EmploymentSystem.migrate(World);
    const second=JSON.stringify(World.employmentContracts);
    return JSON.stringify({equal:first===second,counterEqual:firstCounter===World.employmentContractCounter});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.equal);
  assert.ok(parsed.counterEqual);
});

test('create requires a personId',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    try { EmploymentSystem.create(World,{businessId:b.id}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/personId/i);
});

test('create requires a valid existing business',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    try { EmploymentSystem.create(World,{personId:'npc:a',businessId:'business:99999'}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/business/i);
});

test('closed business rejects hiring',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    b.status='closed';
    try { EmploymentSystem.create(World,{personId:'npc:a',businessId:b.id}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/closed/i);
});

test('negative annualSalary is rejected',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    try { EmploymentSystem.create(World,{personId:'npc:a',businessId:b.id,annualSalary:-5}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/annualSalary/i);
});

test('hire adds the employee to business.employeeIds exactly once',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id});
    return JSON.stringify(World.businesses[b.id].employeeIds.filter(id=>id==='npc:a').length);
  })()`);
  assert.equal(JSON.parse(result),1);
});

test('hiring a person who already has an active contract is rejected',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id});
    try { EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/active/i);
});

test('end removes the employee from business.employeeIds',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id});
    EmploymentSystem.end(World,contract.id,'resigned','left',1931);
    return JSON.stringify(World.businesses[b.id].employeeIds);
  })()`);
  assert.deepEqual(JSON.parse(result),[]);
});

test('repeated end calls are idempotent',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id});
    EmploymentSystem.end(World,contract.id,'resigned','left',1931);
    const first=JSON.stringify(World.employmentContracts[contract.id]);
    EmploymentSystem.end(World,contract.id,'terminated','again',1932);
    const second=JSON.stringify(World.employmentContracts[contract.id]);
    return JSON.stringify({equal:first===second});
  })()`);
  assert.ok(JSON.parse(result).equal);
});

test('on_leave counts as active employment for the single-contract rule',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id});
    contract.status='on_leave';
    try { EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/active/i);
});

test('migration keeps the newest of several duplicate active contracts for one person',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    World.employmentContracts['employment:00001']={id:'employment:00001',personId:'npc:dup',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'Old Job',careerStage:null,jobTier:1,annualSalary:500,hiredYear:1925,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    World.employmentContracts['employment:00002']={id:'employment:00002',personId:'npc:dup',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'New Job',careerStage:null,jobTier:1,annualSalary:900,hiredYear:1929,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    EmploymentSystem.migrate(World);
    const active=EmploymentSystem.activeForPerson(World,'npc:dup');
    return JSON.stringify({count:active.length,name:active[0]&&active[0].occupationName});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.count,1);
  assert.equal(parsed.name,'New Job');
});

test('migration terminates a contract pointing to a missing business',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.employmentContracts['employment:00001']={id:'employment:00001',personId:'npc:orphan',workerType:'npc',businessId:'business:99999',settlementId:'branec',occupationType:'generic',occupationId:null,occupationName:'Ghost Job',careerStage:null,jobTier:1,annualSalary:500,hiredYear:1925,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    EmploymentSystem.migrate(World);
    const contract=EmploymentSystem.forPerson(World,'npc:orphan')[0];
    return JSON.stringify({status:contract.status,reason:contract.terminationReason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'terminated');
  assert.equal(parsed.reason,'missing_business');
});

test('migration terminates a contract pointing to a closed business',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    b.status='closed';
    World.employmentContracts['employment:00001']={id:'employment:00001',personId:'npc:x',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'Closed Shop Job',careerStage:null,jobTier:1,annualSalary:500,hiredYear:1925,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    EmploymentSystem.migrate(World);
    const contract=EmploymentSystem.forPerson(World,'npc:x')[0];
    return JSON.stringify({status:contract.status,reason:contract.terminationReason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'terminated');
  assert.equal(parsed.reason,'business_closed');
});

test('syncBusinessEmployees removes stale employee IDs',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    b.employeeIds=['npc:stale'];
    EmploymentSystem.syncBusinessEmployees(World,b.id);
    return JSON.stringify(World.businesses[b.id].employeeIds);
  })()`);
  assert.deepEqual(JSON.parse(result),[]);
});

test('summary reports counts and payroll correctly',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const a=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:1000});
    EmploymentSystem.hire(World,{personId:'npc:b',businessId:b.id,annualSalary:2000});
    const c=EmploymentSystem.hire(World,{personId:'npc:c',businessId:b.id,annualSalary:500});
    EmploymentSystem.end(World,c.id,'resigned','left',1931);
    return JSON.stringify(EmploymentSystem.summary(World,{businessId:b.id}));
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.total,3);
  assert.equal(parsed.active,2);
  assert.equal(parsed.resigned,1);
  assert.equal(parsed.annualPayroll,3000);
  assert.equal(parsed.uniqueWorkers,2);
});

test('player career reconciliation creates a matching career contract',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null}; S.career='medicine'; S.jobTier=2; S.jobName='Registered Nurse'; S.location={settlementId:'branec'};
    const contract=EmploymentSystem.reconcilePlayer(World,S);
    return JSON.stringify({occupationType:contract.occupationType,occupationId:contract.occupationId,occupationName:contract.occupationName,annualSalary:contract.annualSalary,contractId:S.employmentContractId});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.occupationType,'career');
  assert.equal(parsed.occupationId,'medicine');
  assert.equal(parsed.occupationName,'Registered Nurse');
  assert.equal(parsed.annualSalary,1900);
  assert.ok(parsed.contractId);
});

test('player standalone-job reconciliation creates a matching job contract',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null}; S.career=null; S.jobTier=1; S.jobName='Farmhand'; S.location={settlementId:'branec'};
    const contract=EmploymentSystem.reconcilePlayer(World,S);
    return JSON.stringify({occupationType:contract.occupationType,occupationName:contract.occupationName,annualSalary:contract.annualSalary});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.occupationType,'job');
  assert.equal(parsed.occupationName,'Farmhand');
  assert.equal(parsed.annualSalary,950);
});

test('player unemployment ends the active player contract',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null}; S.career=null; S.jobTier=1; S.jobName='Farmhand'; S.location={settlementId:'branec'};
    EmploymentSystem.reconcilePlayer(World,S);
    S={employmentContractId:null}; S.career=null; S.jobTier=0; S.jobName='Unemployed';
    EmploymentSystem.reconcilePlayer(World,S);
    return JSON.stringify({contractId:S.employmentContractId,active:EmploymentSystem.activeForPerson(World,'subject').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.contractId,null);
  assert.equal(parsed.active,0);
});

test('player reconciliation is idempotent for an unchanged employment state',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null}; S.career='medicine'; S.jobTier=2; S.jobName='Registered Nurse'; S.location={settlementId:'branec'};
    const first=EmploymentSystem.reconcilePlayer(World,S);
    const second=EmploymentSystem.reconcilePlayer(World,S);
    return JSON.stringify({sameId:first.id===second.id,total:EmploymentSystem.forPerson(World,'subject').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.sameId);
  assert.equal(parsed.total,1);
});

test('employer assignment is deterministic for the same seed and person',()=>{
  const contextA=migratedWorld();
  const contextB=migratedWorld();
  const resultA=expose(contextA,`(function(){
    S={employmentContractId:null}; S.career='medicine'; S.jobTier=2; S.jobName='Registered Nurse'; S.location={settlementId:'branec'};
    const contract=EmploymentSystem.reconcilePlayer(World,S);
    return contract.businessId;
  })()`);
  const resultB=expose(contextB,`(function(){
    S={employmentContractId:null}; S.career='medicine'; S.jobTier=2; S.jobName='Registered Nurse'; S.location={settlementId:'branec'};
    const contract=EmploymentSystem.reconcilePlayer(World,S);
    return contract.businessId;
  })()`);
  assert.equal(resultA,resultB);
});

test('NPC reconciliation ignores children and dead NPCs',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:child']={id:'npc:child',isSubject:false,alive:true,birthYear:World.year-5,locationId:'branec',employment:{status:'employed',sector:'retail',income:500}};
    World.npcs['npc:dead']={id:'npc:dead',isSubject:false,alive:false,birthYear:World.year-40,locationId:'branec',employment:{status:'employed',sector:'retail',income:500}};
    EmploymentSystem.reconcileNpcs(World);
    return JSON.stringify({child:EmploymentSystem.activeForPerson(World,'npc:child').length,dead:EmploymentSystem.activeForPerson(World,'npc:dead').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.child,0);
  assert.equal(parsed.dead,0);
});

test('NPC reconciliation hires an employed adult NPC',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:adult']={id:'npc:adult',isSubject:false,alive:true,birthYear:World.year-30,locationId:'branec',employment:{status:'employed',sector:'shop',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    return JSON.stringify(EmploymentSystem.activeForPerson(World,'npc:adult').length);
  })()`);
  assert.equal(JSON.parse(result),1);
});

test('WorldSimulation.migrate initializes employment state',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    WorldSimulation.migrate(World);
    return JSON.stringify({hasContracts:!!World.employmentContracts,schema:World.employmentSchemaVersion});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.hasContracts);
  assert.equal(parsed.schema,3);
});

test('checkInvariants returns no violations after a clean migration with contracts',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:1000});
    EmploymentSystem.migrate(World);
    return JSON.stringify(EmploymentSystem.checkInvariants(World));
  })()`);
  assert.deepEqual(JSON.parse(result),[]);
});

test('checkInvariants detects a business employeeIds mismatch',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id});
    World.businesses[b.id].employeeIds=['npc:a','npc:phantom'];
    return JSON.stringify(EmploymentSystem.checkInvariants(World));
  })()`);
  const issues=JSON.parse(result);
  assert.ok(issues.some(msg=>/employeeIds/i.test(msg)));
});

test('checkInvariants detects multiple active contracts for the same person',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    World.employmentContracts['employment:00001']={id:'employment:00001',personId:'npc:dup',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'Job One',careerStage:null,jobTier:1,annualSalary:500,hiredYear:1925,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    World.employmentContracts['employment:00002']={id:'employment:00002',personId:'npc:dup',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'Job Two',careerStage:null,jobTier:1,annualSalary:500,hiredYear:1926,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    World.employmentContractCounter=2;
    return JSON.stringify(EmploymentSystem.checkInvariants(World));
  })()`);
  const issues=JSON.parse(result);
  assert.ok(issues.some(msg=>/multiple active/i.test(msg)));
});

test('payBusinessPayroll pays every active and on_leave contract and is idempotent within a year',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const a=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:1000});
    const c=EmploymentSystem.hire(World,{personId:'npc:c',businessId:b.id,annualSalary:800});
    c.status='on_leave';
    const d=EmploymentSystem.hire(World,{personId:'npc:d',businessId:b.id,annualSalary:400});
    EmploymentSystem.end(World,d.id,'resigned','left',1930);
    const first=EmploymentSystem.payBusinessPayroll(World,b.id,1930);
    const second=EmploymentSystem.payBusinessPayroll(World,b.id,1930);
    return JSON.stringify({first,second,aPaid:a.annualPaid,aYear:a.lastPaidYear,cPaid:c.annualPaid,dPaid:d.annualPaid});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.first,1800);
  assert.equal(parsed.second,1800);
  assert.equal(parsed.aPaid,1000);
  assert.equal(parsed.aYear,1930);
  assert.equal(parsed.cPaid,800);
  assert.equal(parsed.dPaid,0);
});

test('player relocation transfers the contract to a new settlement and updates both businesses',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null}; S.career=null; S.jobTier=1; S.jobName='Farmhand'; S.location={settlementId:'branec'};
    const first=EmploymentSystem.reconcilePlayer(World,S);
    const oldBusinessId=first.businessId;
    S.location={settlementId:'veskar'};
    const second=EmploymentSystem.reconcilePlayer(World,S);
    return JSON.stringify({
      differentContract:first.id!==second.id,
      newSettlement:second.settlementId,
      oldStatus:World.employmentContracts[first.id].status,
      oldReason:World.employmentContracts[first.id].terminationReason,
      oldBusinessEmployees:World.businesses[oldBusinessId].employeeIds,
      newBusinessEmployees:World.businesses[second.businessId].employeeIds,
      subjectContractId:S.employmentContractId,
      secondId:second.id,
      activeCount:EmploymentSystem.activeForPerson(World,'subject').length
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.differentContract);
  assert.equal(parsed.newSettlement,'veskar');
  assert.equal(parsed.oldStatus,'terminated');
  assert.equal(parsed.oldReason,'worker_relocated');
  assert.ok(!parsed.oldBusinessEmployees.includes('subject'));
  assert.ok(parsed.newBusinessEmployees.includes('subject'));
  assert.equal(parsed.subjectContractId,parsed.secondId);
  assert.equal(parsed.activeCount,1);
});

test('player career change to a different occupation identity transfers the contract',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null}; S.career='medicine'; S.jobTier=2; S.jobName='Registered Nurse'; S.location={settlementId:'branec'};
    const first=EmploymentSystem.reconcilePlayer(World,S);
    S.career='law'; S.jobTier=1; S.jobName='Court Clerk';
    const second=EmploymentSystem.reconcilePlayer(World,S);
    return JSON.stringify({
      differentContract:first.id!==second.id,
      newOccupationId:second.occupationId,
      oldStatus:World.employmentContracts[first.id].status,
      oldReason:World.employmentContracts[first.id].terminationReason,
      subjectContractId:S.employmentContractId,
      secondId:second.id,
      activeCount:EmploymentSystem.activeForPerson(World,'subject').length
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.differentContract);
  assert.equal(parsed.newOccupationId,'law');
  assert.equal(parsed.oldStatus,'terminated');
  assert.equal(parsed.oldReason,'employment_changed');
  assert.equal(parsed.subjectContractId,parsed.secondId);
  assert.equal(parsed.activeCount,1);
});

test('a standalone job identity change transfers the contract',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null}; S.career=null; S.jobTier=1; S.jobName='Farmhand'; S.location={settlementId:'branec'};
    const first=EmploymentSystem.reconcilePlayer(World,S);
    S.jobTier=1; S.jobName='Warehouse Hand';
    const second=EmploymentSystem.reconcilePlayer(World,S);
    return JSON.stringify({
      differentContract:first.id!==second.id,
      firstOccupationId:first.occupationId,
      secondOccupationId:second.occupationId,
      subjectContractId:S.employmentContractId,
      secondId:second.id,
      activeCount:EmploymentSystem.activeForPerson(World,'subject').length
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.differentContract);
  assert.notEqual(parsed.firstOccupationId,parsed.secondOccupationId);
  assert.equal(parsed.subjectContractId,parsed.secondId);
  assert.equal(parsed.activeCount,1);
});

test('a promotion within the same career retains the existing contract ID',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null}; S.career='medicine'; S.jobTier=1; S.jobName='Orderly'; S.location={settlementId:'branec'};
    const first=EmploymentSystem.reconcilePlayer(World,S);
    S.jobTier=2; S.jobName='Registered Nurse';
    const second=EmploymentSystem.reconcilePlayer(World,S);
    return JSON.stringify({sameId:first.id===second.id,salary:second.annualSalary,jobTier:second.jobTier});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.sameId);
  assert.equal(parsed.salary,1900);
  assert.equal(parsed.jobTier,2);
});

test('NPC relocation transfers the contract to a business in the new settlement',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:mover']={id:'npc:mover',isSubject:false,alive:true,birthYear:World.year-30,locationId:'branec',employment:{status:'employed',sector:'shop',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const first=EmploymentSystem.activeForPerson(World,'npc:mover')[0];
    World.npcs['npc:mover'].locationId='veskar';
    EmploymentSystem.reconcileNpcs(World);
    const second=EmploymentSystem.activeForPerson(World,'npc:mover')[0];
    return JSON.stringify({differentContract:first.id!==second.id,newSettlement:second&&second.settlementId,activeCount:EmploymentSystem.activeForPerson(World,'npc:mover').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.differentContract);
  assert.equal(parsed.newSettlement,'veskar');
  assert.equal(parsed.activeCount,1);
});

test('NPC sector change transfers the contract to a compatible business',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:switcher']={id:'npc:switcher',isSubject:false,alive:true,birthYear:World.year-30,locationId:'branec',employment:{status:'employed',sector:'shop',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const first=EmploymentSystem.activeForPerson(World,'npc:switcher')[0];
    World.npcs['npc:switcher'].employment.sector='hospital';
    EmploymentSystem.reconcileNpcs(World);
    const second=EmploymentSystem.activeForPerson(World,'npc:switcher')[0];
    const secondBusiness=BusinessSystem.get(World,second.businessId);
    return JSON.stringify({differentContract:first.id!==second.id,activeCount:EmploymentSystem.activeForPerson(World,'npc:switcher').length,secondSector:secondBusiness.sector});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.differentContract);
  assert.equal(parsed.activeCount,1);
  assert.equal(parsed.secondSector,'healthcare');
});

test('public create() rejects a duplicate active/on_leave contract for the same person',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    EmploymentSystem.create(World,{personId:'npc:dup',businessId:b.id,status:'active'});
    try { EmploymentSystem.create(World,{personId:'npc:dup',businessId:b.id,status:'active'}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/active/i);
});

test('create() synchronizes employeeIds for active/on_leave contracts',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    EmploymentSystem.create(World,{personId:'npc:onleave',businessId:b.id,status:'on_leave'});
    return JSON.stringify(World.businesses[b.id].employeeIds);
  })()`);
  assert.deepEqual(JSON.parse(result),['npc:onleave']);
});

test('create() with an ended status defaults a valid endedYear and does not add to employeeIds',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.create(World,{personId:'npc:already-gone',businessId:b.id,status:'resigned'});
    return JSON.stringify({endedYear:contract.endedYear,employeeIds:World.businesses[b.id].employeeIds});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(Number.isInteger(parsed.endedYear));
  assert.deepEqual(parsed.employeeIds,[]);
});

test('create() bounds huge salary and year values to documented finite bounds',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.create(World,{personId:'npc:huge',businessId:b.id,status:'active',annualSalary:1e30,hiredYear:1e20});
    return JSON.stringify({salary:contract.annualSalary,hiredYear:contract.hiredYear,salaryFinite:Number.isFinite(contract.annualSalary),yearFinite:Number.isFinite(contract.hiredYear)});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.salaryFinite);
  assert.ok(parsed.yearFinite);
  assert.ok(parsed.salary<=5000000);
});

test('checkInvariants detects an active contract at a closed business',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    EmploymentSystem.hire(World,{personId:'npc:stuck',businessId:b.id,annualSalary:500});
    b.status='closed';
    return JSON.stringify(EmploymentSystem.checkInvariants(World));
  })()`);
  const issues=JSON.parse(result);
  assert.ok(issues.some(msg=>/closed business/i.test(msg)));
});

test('contract accounting does not directly modify player assets or NPC wealth',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    S={employmentContractId:null,assets:500}; S.career='medicine'; S.jobTier=1; S.jobName='Orderly'; S.location={settlementId:'branec'};
    EmploymentSystem.reconcilePlayer(World,S);
    World.npcs=World.npcs||{};
    World.npcs['npc:wealthcheck']={id:'npc:wealthcheck',isSubject:false,alive:true,birthYear:World.year-30,locationId:'branec',employment:{status:'employed',sector:'shop',income:900},wealth:{cash:250,debt:0}};
    EmploymentSystem.reconcileNpcs(World);
    const contract=EmploymentSystem.activeForPerson(World,'npc:wealthcheck')[0];
    EmploymentSystem.payBusinessPayroll(World,contract.businessId,World.year);
    return JSON.stringify({subjectAssets:S.assets,npcCash:World.npcs['npc:wealthcheck'].wealth.cash});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.subjectAssets,500);
  assert.equal(parsed.npcCash,250);
});

test('a healthcare worker in a small settlement without a seeded healthcare business gets a compatible fallback employer',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:nurse']={id:'npc:nurse',isSubject:false,alive:true,birthYear:World.year-30,locationId:'oberhain',employment:{status:'employed',sector:'hospital',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const contract=EmploymentSystem.activeForPerson(World,'npc:nurse')[0];
    const business=BusinessSystem.get(World,contract.businessId);
    return JSON.stringify({sector:business.sector,seededHealthcareCount:BusinessSystem.forSettlement(World,'oberhain').filter(b=>b.sector==='healthcare').length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.sector,'healthcare');
});

test('two consecutive reconciliations into a fallback employer retain the same contract ID',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:nurse']={id:'npc:nurse',isSubject:false,alive:true,birthYear:World.year-30,locationId:'oberhain',employment:{status:'employed',sector:'hospital',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const first=EmploymentSystem.activeForPerson(World,'npc:nurse')[0];
    EmploymentSystem.reconcileNpcs(World);
    const second=EmploymentSystem.activeForPerson(World,'npc:nurse')[0];
    return JSON.stringify({sameId:first.id===second.id});
  })()`);
  assert.ok(JSON.parse(result).sameId);
});

test('no duplicate fallback business is created across repeated reconciliations for multiple workers',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:nurse-a']={id:'npc:nurse-a',isSubject:false,alive:true,birthYear:World.year-30,locationId:'oberhain',employment:{status:'employed',sector:'hospital',income:900}};
    World.npcs['npc:nurse-b']={id:'npc:nurse-b',isSubject:false,alive:true,birthYear:World.year-28,locationId:'oberhain',employment:{status:'employed',sector:'medical',income:850}};
    EmploymentSystem.reconcileNpcs(World);
    EmploymentSystem.reconcileNpcs(World);
    EmploymentSystem.reconcileNpcs(World);
    const healthcareBusinesses=BusinessSystem.forSettlement(World,'oberhain').filter(b=>b.sector==='healthcare');
    return JSON.stringify({count:healthcareBusinesses.length});
  })()`);
  assert.equal(JSON.parse(result).count,1);
});

test('the fallback-assigned business passes the same compatibility rule used by isContractCompatible',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.npcs=World.npcs||{};
    World.npcs['npc:nurse']={id:'npc:nurse',isSubject:false,alive:true,birthYear:World.year-30,locationId:'oberhain',employment:{status:'employed',sector:'hospital',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const contract=EmploymentSystem.activeForPerson(World,'npc:nurse')[0];
    const business=BusinessSystem.get(World,contract.businessId);
    return JSON.stringify({sectorMatchesHealthcareMapping:business.sector==='healthcare'});
  })()`);
  assert.ok(JSON.parse(result).sectorMatchesHealthcareMapping);
});

test('ended contract creation with a future hired year bounds hiredYear and defaults a valid endedYear',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.create(World,{personId:'npc:future',businessId:b.id,status:'resigned',hiredYear:1e8});
    return JSON.stringify({hiredYear:contract.hiredYear,endedYear:contract.endedYear,valid:contract.endedYear>=contract.hiredYear});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(Number.isFinite(parsed.hiredYear));
  assert.ok(parsed.valid);
});

test('an explicit endedYear earlier than hiredYear is repaired to be no earlier than hiredYear',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.create(World,{personId:'npc:backwards',businessId:b.id,status:'resigned',hiredYear:1930,endedYear:1900});
    return JSON.stringify({hiredYear:contract.hiredYear,endedYear:contract.endedYear});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.endedYear>=parsed.hiredYear);
});

test('end() called with an earlier or extreme year never produces an endedYear before hiredYear',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.hire(World,{personId:'npc:early-end',businessId:b.id,hiredYear:1930});
    EmploymentSystem.end(World,contract.id,'resigned','left',1800);
    const earlyEndedYear=contract.endedYear;
    const contract2=EmploymentSystem.hire(World,{personId:'npc:extreme-end',businessId:b.id,hiredYear:1930});
    EmploymentSystem.end(World,contract2.id,'resigned','left',1e20);
    return JSON.stringify({earlyEndedYear,earlyValid:earlyEndedYear>=1930,extremeEndedYear:contract2.endedYear,extremeFinite:Number.isFinite(contract2.endedYear)});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.earlyValid);
  assert.ok(parsed.extremeFinite);
});

test('payBusinessPayroll called with an extreme payment year bounds lastPaidYear',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.hire(World,{personId:'npc:extreme-pay',businessId:b.id,annualSalary:1000});
    EmploymentSystem.payBusinessPayroll(World,b.id,1e30);
    return JSON.stringify({lastPaidYear:contract.lastPaidYear,finite:Number.isFinite(contract.lastPaidYear)});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.finite);
});

test('malformed/extreme world.year with omitted year fields still bounds hiredYear, endedYear, and lastPaidYear',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    World.year=Infinity;
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    const contract=EmploymentSystem.create(World,{personId:'npc:no-year',businessId:b.id,status:'resigned'});
    World.year=1930;
    EmploymentSystem.payBusinessPayroll(World,b.id,undefined);
    return JSON.stringify({hiredYear:contract.hiredYear,endedYear:contract.endedYear,allFinite:[contract.hiredYear,contract.endedYear].every(Number.isFinite)});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.allFinite);
});

test('malformed manually-injected contracts with huge but finite salaries never overflow payBusinessPayroll',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    World.employmentContracts['employment:00001']={id:'employment:00001',personId:'npc:whale-1',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'Worker',careerStage:null,jobTier:1,annualSalary:1e15,hiredYear:1930,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    World.employmentContractCounter=1;
    b.employeeIds=['npc:whale-1'];
    World.employmentContracts['employment:00002']={id:'employment:00002',personId:'npc:whale-2',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'Worker',careerStage:null,jobTier:1,annualSalary:1e15,hiredYear:1930,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[]};
    World.employmentContractCounter=2;
    b.employeeIds.push('npc:whale-2');
    const total=EmploymentSystem.payBusinessPayroll(World,b.id,1930);
    const c1=World.employmentContracts['employment:00001'];
    const c2=World.employmentContracts['employment:00002'];
    return JSON.stringify({total,totalFinite:Number.isFinite(total),c1Salary:c1.annualSalary,c2Salary:c2.annualSalary,c1AnnualPaid:c1.annualPaid,c2AnnualPaid:c2.annualPaid,allFinite:[total,c1.annualSalary,c2.annualSalary,c1.annualPaid,c2.annualPaid].every(Number.isFinite)});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.totalFinite);
  assert.ok(parsed.allFinite);
  assert.ok(parsed.total<=1000000000);
  assert.ok(parsed.c1Salary<=5000000);
  assert.ok(parsed.c2Salary<=5000000);
});

test('checkInvariants stays clean after repairing manually-injected huge-salary contracts',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.forSettlement(World,'branec')[0];
    World.employmentContracts['employment:00001']={id:'employment:00001',personId:'npc:whale',workerType:'npc',businessId:b.id,settlementId:b.settlementId,occupationType:'generic',occupationId:null,occupationName:'Worker',careerStage:null,jobTier:1,annualSalary:1e15,hiredYear:1930,endedYear:null,status:'active',terminationReason:null,performance:0.5,satisfaction:0.5,lastPaidYear:null,annualPaid:0,history:[],origin:'legacy',stageStartedYear:1930,lastReviewYear:null,lastLifecycleYear:null,lastPromotionAttemptYear:null,vacancyAssignments:[],supervisorPersonId:null,workplaceStress:0.35,workplaceLastTickYear:null};
    World.employmentContractCounter=1;
    b.employeeIds=['npc:whale'];
    EmploymentSystem.payBusinessPayroll(World,b.id,1930);
    return JSON.stringify(EmploymentSystem.checkInvariants(World));
  })()`);
  assert.deepEqual(JSON.parse(result),[]);
});

test('at capacity with 11 closed and 1 open incompatible business, the stable open fallback is used without creating a 13th business',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const settlementId='branec';
    const businesses=BusinessSystem.forSettlement(World,settlementId).slice().sort((a,b)=>a.id.localeCompare(b.id));
    const initialCount=businesses.length;
    const remainOpen=businesses.find(b=>b.sector!=='healthcare');
    businesses.forEach(b=>{ if(b.id!==remainOpen.id) BusinessSystem.close(World,b.id,'insolvency',1930); });
    World.npcs=World.npcs||{};
    World.npcs['npc:doc']={id:'npc:doc',isSubject:false,alive:true,birthYear:World.year-30,locationId:settlementId,employment:{status:'employed',sector:'hospital',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const first=EmploymentSystem.activeForPerson(World,'npc:doc')[0];
    const totalAfterFirst=BusinessSystem.forSettlement(World,settlementId).length;
    EmploymentSystem.reconcileNpcs(World);
    const second=EmploymentSystem.activeForPerson(World,'npc:doc')[0];
    const totalAfterSecond=BusinessSystem.forSettlement(World,settlementId).length;
    return JSON.stringify({
      initialCount,
      totalAfterFirst,totalAfterSecond,
      assignedBusinessId:first.businessId,
      remainOpenId:remainOpen.id,
      sameContract:first.id===second.id,
      businessInvariants:BusinessSystem.checkInvariants(World),
      employmentInvariants:EmploymentSystem.checkInvariants(World)
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.initialCount,12);
  assert.equal(parsed.totalAfterFirst,12);
  assert.equal(parsed.totalAfterSecond,12);
  assert.equal(parsed.assignedBusinessId,parsed.remainOpenId);
  assert.ok(parsed.sameContract);
  assert.deepEqual(parsed.businessInvariants,[]);
  assert.deepEqual(parsed.employmentInvariants,[]);
});

test('at capacity with all 12 businesses closed, no employer is assigned and no 13th business is created',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const settlementId='branec';
    const businesses=BusinessSystem.forSettlement(World,settlementId);
    const initialCount=businesses.length;
    businesses.forEach(b=>BusinessSystem.close(World,b.id,'insolvency',1930));
    World.npcs=World.npcs||{};
    World.npcs['npc:doc']={id:'npc:doc',isSubject:false,alive:true,birthYear:World.year-30,locationId:settlementId,employment:{status:'employed',sector:'hospital',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const totalAfter=BusinessSystem.forSettlement(World,settlementId).length;
    return JSON.stringify({
      initialCount,totalAfter,
      activeCount:EmploymentSystem.activeForPerson(World,'npc:doc').length,
      businessInvariants:BusinessSystem.checkInvariants(World),
      employmentInvariants:EmploymentSystem.checkInvariants(World)
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.initialCount,12);
  assert.equal(parsed.totalAfter,12);
  assert.equal(parsed.activeCount,0);
  assert.deepEqual(parsed.businessInvariants,[]);
  assert.deepEqual(parsed.employmentInvariants,[]);
});

test('with 11 total businesses (including closed) and capacity remaining, exactly one compatible fallback is created and the total becomes 12',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const settlementId='oberhain';
    let businesses=BusinessSystem.forSettlement(World,settlementId);
    let filler=0;
    while(businesses.length<11){
      BusinessSystem.create(World,{settlementId,sector:'retail',name:'Filler Co '+(filler++)});
      businesses=BusinessSystem.forSettlement(World,settlementId);
    }
    const sorted=businesses.slice().sort((a,b)=>a.id.localeCompare(b.id));
    for(let i=0;i<4;i++) BusinessSystem.close(World,sorted[i].id,'insolvency',1930);
    const initialCount=BusinessSystem.forSettlement(World,settlementId).length;
    World.npcs=World.npcs||{};
    World.npcs['npc:doc']={id:'npc:doc',isSubject:false,alive:true,birthYear:World.year-30,locationId:settlementId,employment:{status:'employed',sector:'hospital',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const totalAfterFirst=BusinessSystem.forSettlement(World,settlementId).length;
    EmploymentSystem.reconcileNpcs(World);
    const totalAfterSecond=BusinessSystem.forSettlement(World,settlementId).length;
    return JSON.stringify({initialCount,totalAfterFirst,totalAfterSecond});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.initialCount,11);
  assert.equal(parsed.totalAfterFirst,12);
  assert.equal(parsed.totalAfterSecond,12);
});

test('compatibility evaluation on an already-assigned fallback does not change World.businesses or businessCounter',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const settlementId='branec';
    const businesses=BusinessSystem.forSettlement(World,settlementId).slice().sort((a,b)=>a.id.localeCompare(b.id));
    const remainOpen=businesses.find(b=>b.sector!=='healthcare');
    businesses.forEach(b=>{ if(b.id!==remainOpen.id) BusinessSystem.close(World,b.id,'insolvency',1930); });
    World.npcs=World.npcs||{};
    World.npcs['npc:doc']={id:'npc:doc',isSubject:false,alive:true,birthYear:World.year-30,locationId:settlementId,employment:{status:'employed',sector:'hospital',income:900}};
    EmploymentSystem.reconcileNpcs(World);
    const beforeBusinesses=JSON.stringify(World.businesses);
    const beforeCounter=World.businessCounter;
    EmploymentSystem.reconcileNpcs(World);
    EmploymentSystem.reconcileNpcs(World);
    const afterBusinesses=JSON.stringify(World.businesses);
    const afterCounter=World.businessCounter;
    return JSON.stringify({businessesUnchanged:beforeBusinesses===afterBusinesses,counterUnchanged:beforeCounter===afterCounter});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.businessesUnchanged);
  assert.ok(parsed.counterUnchanged);
});
