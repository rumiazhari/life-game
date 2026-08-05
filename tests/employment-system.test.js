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
  assert.equal(parsed.schema,1);
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
  assert.equal(parsed.schema,1);
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
