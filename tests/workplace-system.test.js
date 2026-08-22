'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function freshWorld(seed){
  const context=createWorldContext();
  expose(context,`World={year:1930,seed:${JSON.stringify(seed||'test-seed')},activeSettlementId:'branec',settlements:{}};BusinessSystem.ensure(World);EmploymentSystem.ensure(World);VacancySystem.ensure(World);WorkplaceSystem.ensure(World);`);
  return context;
}
function business(context,spec){
  return JSON.parse(expose(context,`(function(){ return JSON.stringify(BusinessSystem.create(World,${JSON.stringify(spec)})); })()`));
}
function registerNpc(context,id,extra){
  expose(context,`World.npcs=World.npcs||{};World.npcs['${id}']=Object.assign({id:'${id}',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{},health:{general:70}},${JSON.stringify(extra||{})});`);
}
function hire(context,npcId,businessId,extra){
  const spec=Object.assign({personId:npcId,businessId,annualSalary:1000,hiredYear:1930,jobTier:1},extra||{});
  expose(context,`EmploymentSystem.hire(World,${JSON.stringify(spec)})`);
}
function activeContract(context,personId){
  const raw=expose(context,`(function(){ const c=EmploymentSystem.activeForPerson(World,'${personId}')[0]||null; return c?JSON.stringify(c):'null'; })()`);
  return raw==='null'?null:JSON.parse(raw);
}
function tick(context,year){
  return JSON.parse(expose(context,`(function(){ return JSON.stringify(WorkplaceSystem.tickWorld(World,{year:${year}})); })()`));
}

test('workplace ensure initializes schema version and a null tick guard',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ WorkplaceSystem.ensure(World); return {v:World.workplaceSchemaVersion,tick:World.workplaceLastTickYear}; })()`);
  assert.equal(result.v,1);
  assert.equal(result.tick,null);
});

test('new contracts carry a normalized default workplace object',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  const wp=activeContract(context,'npc:1').workplace;
  assert.equal(wp.stress,0.25);
  assert.equal(wp.highStressYears,0);
  assert.equal(wp.strikes,0);
  assert.deepEqual(wp.incidents,[]);
  assert.equal(wp.leaveKind,null);
});

test('migration repairs missing workplace objects and is byte-idempotent',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  const result=JSON.parse(expose(context,`(function(){
    delete EmploymentSystem.activeForPerson(World,'npc:1')[0].workplace;
    WorkplaceSystem.migrate(World);
    const first=JSON.stringify(World.employmentContracts);
    WorkplaceSystem.migrate(World);
    const second=JSON.stringify(World.employmentContracts);
    return JSON.stringify({stable:first===second,hasWorkplace:!!EmploymentSystem.activeForPerson(World,'npc:1')[0].workplace,invariants:WorkplaceSystem.checkInvariants(World)});
  })()`));
  assert.equal(result.stable,true);
  assert.equal(result.hasWorkplace,true);
  assert.deepEqual(result.invariants,[]);
});

test('migration repairs malformed workplace fields into bounded form',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  const result=JSON.parse(expose(context,`(function(){
    const c=EmploymentSystem.activeForPerson(World,'npc:1')[0];
    c.workplace={stress:'oops',highStressYears:-4,lastTickYear:'x',lastIncidentYear:1e12,strikes:99,incidents:Array.from({length:20},(_,i)=>({year:i,kind:'k'})),leaveKind:'vacation'};
    WorkplaceSystem.migrate(World);
    const wp=c.workplace;
    return JSON.stringify({stress:wp.stress,years:wp.highStressYears,tick:wp.lastTickYear,incidentYear:wp.lastIncidentYear,strikes:wp.strikes,incidents:wp.incidents.length,leaveKind:wp.leaveKind,invariants:WorkplaceSystem.checkInvariants(World)});
  })()`));
  assert.equal(result.stress,0.25);
  assert.equal(result.years,0);
  assert.equal(result.tick,null);
  assert.equal(result.incidentYear,5000);
  assert.equal(result.strikes,3);
  assert.equal(result.incidents,8);
  assert.equal(result.leaveKind,null);
  assert.deepEqual(result.invariants,[]);
});

test('tickWorld is same-year idempotent and rejects stale years without mutating state',()=>{
  const context=freshWorld();
  const b=business(context,{settlementId:'branec',sector:'construction'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  const result=JSON.parse(expose(context,`(function(){
    const before=JSON.stringify(World.employmentContracts);
    const first=WorkplaceSystem.tickWorld(World,{year:1932});
    const afterFirst=JSON.stringify(World.employmentContracts);
    const second=WorkplaceSystem.tickWorld(World,{year:1932});
    const stale=WorkplaceSystem.tickWorld(World,{year:1929});
    const afterStale=JSON.stringify(World.employmentContracts);
    return JSON.stringify({firstApplied:first.applied,idempotent:second.reason,staleReason:stale.reason,unchangedByStale:before!==afterFirst&&afterStale===afterFirst});
  })()`));
  assert.equal(result.firstApplied,true);
  assert.equal(result.idempotent,'already_applied');
  assert.equal(result.staleReason,'stale_year');
  assert.equal(result.unchangedByStale,true);
});

test('annual tick is fully deterministic for the same seed and inputs',()=>{
  function run(seed){
    const context=freshWorld(seed);
    const b=business(context,{settlementId:'branec',sector:'construction'});
    registerNpc(context,'npc:1',{birthYear:1895});
    registerNpc(context,'npc:2',{birthYear:1900});
    hire(context,'npc:1',b.id,{jobTier:3});
    hire(context,'npc:2',b.id,{jobTier:2});
    expose(context,`(function(){
      for(let y=1931;y<=1936;y++){
        World.year=y;
        WorkplaceSystem.tickWorld(World,{year:y});
      }
      return null;
    })()`);
    return expose(context,`JSON.stringify({c:Object.values(World.employmentContracts),m:World.relationshipMemories,w:[World.workplaceLastTickYear,World.workplaceSchemaVersion]})`);
  }
  const a=run('det-seed-1');
  const b=run('det-seed-1');
  assert.equal(a,b);
});

test('sustained extreme stress triggers a burnout leave through the annual tick',()=>{
  const context=freshWorld('burnout-seed');
  const b=business(context,{settlementId:'branec',sector:'construction'});
  registerNpc(context,'npc:1');
  registerNpc(context,'npc:2');
  hire(context,'npc:1',b.id,{jobTier:5});
  hire(context,'npc:2',b.id,{jobTier:1});
  expose(context,`(function(){
    const businessId='${b.id}';
    BusinessSystem.get(World,businessId).status='struggling';
    BusinessSystem.get(World,businessId).finances.profit=-500;
    const c=EmploymentSystem.activeForPerson(World,'npc:1')[0];
    c.satisfaction=0;
    c.workplace.stress=0.96;
    c.workplace.highStressYears=1;
    c.workplace.incidents=[{year:1928,kind:'minor_injury'},{year:1929,kind:'serious_injury'}];
    RelationshipMemory.add(World,{year:1929,type:'workplace_conflict',participants:['npc:1','npc:2'],intensity:.45,valence:-.55,summary:'feud',tags:['workplace']});
    return null;
  })()`);
  tick(context,1930);
  let contract=activeContract(context,'npc:1');
  if(contract.status==='active'){ // burnout fires on the first or second high-stress year
    assert.ok(contract.workplace.stress>=0.85,'stress must stay in the high band, got '+contract.workplace.stress);
    tick(context,1931);
  }
  const finalContract=activeContract(context,'npc:1');
  assert.equal(finalContract.status,'on_leave');
  assert.equal(finalContract.workplace.leaveKind,'burnout');
  assert.ok(finalContract.history.some(h=>h.type==='leave_started'));
  // on_leave is still an ACTIVE status: the employee stays on the roster.
  const roster=JSON.parse(expose(context,`(function(){ return JSON.stringify(BusinessSystem.get(World,'${b.id}').employeeIds); })()`));
  assert.ok(roster.includes('npc:1'));
  assert.deepEqual(JSON.parse(expose(context,'JSON.stringify(WorkplaceSystem.checkInvariants(World))')),[]);
});

test('burnout leave recovers and returns the worker to active status',()=>{
  const context=freshWorld('recover-seed');
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  expose(context,`(function(){
    const r=EmploymentSystem.beginLeave(World,EmploymentSystem.activeForPerson(World,'npc:1')[0].id,'burnout',1928);
    if(!r.changed) throw new Error('beginLeave failed: '+r.reason);
    const c=EmploymentSystem.activeForPerson(World,'npc:1')[0];
    c.workplace.stress=0.40;
    return null;
  })()`);
  const result=tick(context,1931);
  const contract=activeContract(context,'npc:1');
  assert.ok(result.leavesEnded>=1);
  assert.equal(contract.status,'active');
  assert.equal(contract.workplace.leaveKind,null);
  assert.ok(contract.history.some(h=>h.type==='leave_ended'));
});

test('a severe untreated occupational injury forces medical leave and recovery ends it',()=>{
  const context=freshWorld('medical-seed');
  const b=business(context,{settlementId:'branec',sector:'manufacturing'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  expose(context,`(function(){
    MedicalSystem.addCondition(World.npcs['npc:1'],'injury',4,{world:World,year:1930,source:'workplace accident'});
    return null;
  })()`);
  const started=activeContract(context,'npc:1').status;
  assert.equal(started,'active');
  tick(context,1930);
  const onLeave=activeContract(context,'npc:1');
  assert.equal(onLeave.status,'on_leave');
  assert.equal(onLeave.workplace.leaveKind,'medical');
  // Recover the injury; a later year's tick returns the worker to duty.
  expose(context,`(function(){
    MedicalSystem.activeConditions(World.npcs['npc:1']).forEach(c=>{c.state='resolved';c.resolved=true;c.resolvedYear=1930;});
    World.year=1932;
    return null;
  })()`);
  tick(context,1932);
  const returned=activeContract(context,'npc:1');
  assert.equal(returned.status,'active');
  assert.equal(returned.workplace.leaveKind,null);
});

test('player contracts take medical leave through the same path via subject option',()=>{
  const context=freshWorld('player-medical-seed');
  const b=business(context,{settlementId:'branec',sector:'retail'});
  const subject={health:70,age:30,dob:1900,career:null,jobTier:1,jobName:'Clerk'};
  expose(context,`EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:1930,jobTier:1});`);
  // Prepare ONE subject instance inside the vm so the medical condition and
  // the tick share the same object identity.
  expose(context,`globalThis.__subject=${JSON.stringify(subject)};MedicalSystem.addCondition(globalThis.__subject,'injury',5,{world:World,year:1930,source:'workplace accident'});`);
  const result=JSON.parse(expose(context,`(function(){
    const r=WorkplaceSystem.tickWorld(World,{year:1930,subject:globalThis.__subject});
    const c=EmploymentSystem.activeForPerson(World,'subject')[0];
    return JSON.stringify({leaves:r.leavesStarted,status:c.status,kind:c.workplace.leaveKind});
  })()`));
  assert.equal(result.leaves,1);
  assert.equal(result.status,'on_leave');
  assert.equal(result.kind,'medical');
});

test('workplace conflict memories raise next-year stress versus an identical world without them',()=>{
  function stressWithMemory(withMemory){
    const context=freshWorld('memory-probe-seed');
    const b=business(context,{settlementId:'branec',sector:'retail'});
    registerNpc(context,'npc:1');
    registerNpc(context,'npc:2');
    hire(context,'npc:1',b.id,{jobTier:2});
    hire(context,'npc:2',b.id,{jobTier:1});
    expose(context,`(function(){
      ${withMemory?`RelationshipMemory.add(World,{year:1929,type:'workplace_conflict',participants:['npc:1','npc:2'],intensity:.45,valence:-.55,summary:'grudge',tags:['workplace']});`:''}
      const c=EmploymentSystem.activeForPerson(World,'npc:1')[0];
      c.satisfaction=.5;
      c.workplace.stress=.40;
      return null;
    })()`);
    tick(context,1930);
    return activeContract(context,'npc:1').workplace.stress;
  }
  const withConflict=stressWithMemory(true);
  const without=stressWithMemory(false);
  assert.ok(withConflict>without,'conflict memory should raise stress: '+withConflict+' vs '+without);
  assert.ok(withConflict<=1&&without>=0);
});

test('misconduct strikes stay bounded across many years and dismissal uses the employment API',()=>{
  const context=freshWorld('strikes-seed');
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  const result=JSON.parse(expose(context,`(function(){
    let maxStrikes=0,dismissed=false;
    for(let y=1930;y<1990;y++){
      World.year=y;
      WorkplaceSystem.tickWorld(World,{year:y});
      const c=EmploymentSystem.forPerson(World,'npc:1').sort((a,b)=>b.hiredYear-a.hiredYear)[0];
      maxStrikes=Math.max(maxStrikes,c.workplace?c.workplace.strikes||0:0);
      if(c.status==='terminated'&&c.terminationReason==='misconduct'){dismissed=true;break;}
    }
    return JSON.stringify({maxStrikes,dismissed,invariants:WorkplaceSystem.checkInvariants(World)});
  })()`));
  assert.ok(result.maxStrikes<=3,'strikes exceeded cap');
  if(result.dismissed){
    const ended=JSON.parse(expose(context,`(function(){ const c=EmploymentSystem.forPerson(World,'npc:1').find(c=>c.status==='terminated'); return JSON.stringify({reason:c.terminationReason,history:c.history.map(h=>h.type)}); })()`));
    assert.equal(ended.reason,'misconduct');
    assert.ok(ended.history.includes('misconduct_warning'));
  }
  assert.deepEqual(JSON.parse(expose(context,'JSON.stringify(WorkplaceSystem.checkInvariants(World))')),[]);
});

test('incident history stays bounded under forced maximum stress',()=>{
  const context=freshWorld('incident-bound-seed');
  const b=business(context,{settlementId:'branec',sector:'construction'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  const result=JSON.parse(expose(context,`(function(){
    let incidentsSeen=0;
    for(let y=1930;y<1960;y++){
      World.year=y;
      WorkplaceSystem.tickWorld(World,{year:y});
      const c=EmploymentSystem.forPerson(World,'npc:1').sort((a,b)=>b.hiredYear-a.hiredYear)[0];
      if(!c.workplace) continue;
      // Keep the worker active and maximally stressed so every year draws
      // from the incident stream (leave transitions would pause it).
      if(c.status==='on_leave'){ c.status='active'; c.workplace.leaveKind=null; c.workplace.leaveStartedYear=null; }
      c.workplace.stress=1;
      c.workplace.highStressYears=0;
      incidentsSeen=Math.max(incidentsSeen,c.workplace.incidents.length);
    }
    return JSON.stringify({incidentsSeen,invariants:WorkplaceSystem.checkInvariants(World)});
  })()`));
  assert.ok(result.incidentsSeen>0,'at least one incident should occur over 30 stressed construction years');
  assert.ok(result.incidentsSeen<=8,'incident history must stay bounded');
  assert.deepEqual(result.invariants,[]);
});

test('summary reports workplace aggregates',()=>{
  const context=freshWorld('summary-seed');
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:1');
  registerNpc(context,'npc:2');
  hire(context,'npc:1',b.id);
  hire(context,'npc:2',b.id);
  const parsed=JSON.parse(expose(context,`(function(){
    EmploymentSystem.beginLeave(World,EmploymentSystem.activeForPerson(World,'npc:2')[0].id,'medical',1930);
    return JSON.stringify(WorkplaceSystem.summary(World));
  })()`));
  assert.equal(parsed.active,1);
  assert.equal(parsed.onLeave,1);
  assert.equal(parsed.onLeaveMedical,1);
  assert.ok(typeof parsed.averageStress==='number');
});

test('checkInvariants flags a non-normalized workplace object',()=>{
  const context=freshWorld('invariant-seed');
  const b=business(context,{settlementId:'branec',sector:'retail'});
  registerNpc(context,'npc:1');
  hire(context,'npc:1',b.id);
  const issues=JSON.parse(expose(context,`(function(){
    EmploymentSystem.activeForPerson(World,'npc:1')[0].workplace.stress='corrupt';
    return JSON.stringify(WorkplaceSystem.checkInvariants(World));
  })()`));
  assert.ok(Array.isArray(issues)&&issues.length>0,'expected invariant violations');
  assert.ok(issues.some(issue=>/normalized form|stress/.test(issue)),'expected a normalization violation, got: '+JSON.stringify(issues));
});
