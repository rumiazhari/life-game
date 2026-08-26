'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function governmentContext(seed){
  const context=createWorldContext(['js/systems/government-system.js']);
  // A live world + subject, same shape the annual pipeline sees.
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject();");
  return context;
}

test('government state is created valid and self-heals in checkInvariants',()=>{
  const context=governmentContext('gov-ensure');
  const fresh=JSON.parse(expose(context,'JSON.stringify(GovernmentSystem.ensure(World))'));
  assert.equal(fresh.schemaVersion,1,'schema version set');
  assert.equal(fresh.regime,'bureaucratic_authoritarian','default regime');
  assert.ok(fresh.legitimacy>=0&&fresh.legitimacy<=1,'legitimacy bounded');
  assert.ok(fresh.propaganda>=0&&fresh.propaganda<=1,'propaganda bounded');
  assert.ok(fresh.surveillancePosture>=0&&fresh.surveillancePosture<=1,'posture bounded');
  assert.ok(fresh.scrutinyPressure>=0&&fresh.scrutinyPressure<=1,'pressure bounded');
  assert.deepEqual(JSON.parse(expose(context,'JSON.stringify(GovernmentSystem.checkInvariants(World))')),[],
    JSON.stringify(expose(context,'JSON.stringify(GovernmentSystem.checkInvariants(World))')));
  // Corrupt it, then ensure must repair.
  expose(context,'World.government.regime="void"; World.government.legitimacy=2; World.government.propaganda=-1;');
  const healed=JSON.parse(expose(context,'JSON.stringify(GovernmentSystem.ensure(World))'));
  assert.equal(healed.regime,'bureaucratic_authoritarian','regime repaired');
  assert.ok(healed.legitimacy<=1,'legitimacy clamped');
  assert.ok(healed.propaganda>=0,'propaganda clamped');
  assert.deepEqual(JSON.parse(expose(context,'JSON.stringify(GovernmentSystem.checkInvariants(World))')),[],'clean after repair');
});

test('WorldSimulation.migrate wires the government state into the world',()=>{
  const context=governmentContext('gov-migrate');
  expose(context,'WorldSimulation.migrate(World);');
  assert.ok(JSON.parse(expose(context,'"government" in World')),'World.government exists after migrate');
  assert.deepEqual(JSON.parse(expose(context,'JSON.stringify(GovernmentSystem.checkInvariants(World))')),[],'invariants clean post-migrate');
});

test('the annual tick is deterministic and same-year idempotent',()=>{
  const a=governmentContext('gov-det');
  const b=governmentContext('gov-det');
  expose(a,'GovernmentSystem.tickWorld(World,{year:World.year,subject:S});');
  expose(b,'GovernmentSystem.tickWorld(World,{year:World.year,subject:S});');
  const ja=expose(a,'JSON.stringify(World.government)');
  const jb=expose(b,'JSON.stringify(World.government)');
  assert.equal(ja,jb,'identical seed yields identical government state (no Math.random)');

  // Second tick for the same year must be a no-op.
  const before=expose(a,'World.government.lastTickYear');
  const dup=JSON.parse(expose(a,'JSON.stringify(GovernmentSystem.tickWorld(World,{year:World.year,subject:S}))'));
  assert.equal(dup.applied,false,'duplicate year is not applied');
  assert.equal(dup.reason,'already_applied','reports already_applied');
  assert.equal(expose(a,'World.government.lastTickYear'),before,'lastTickYear unchanged on no-op');
});

test('a stale (earlier) year is rejected without mutation',()=>{
  const context=governmentContext('gov-stale');
  expose(context,'GovernmentSystem.tickWorld(World,{year:World.year,subject:S});');
  const before=expose(context,'JSON.stringify(World.government)');
  const replay=JSON.parse(expose(context,'JSON.stringify(GovernmentSystem.tickWorld(World,{year:World.year-1,subject:S}))'));
  assert.equal(replay.applied,false,'stale year not applied');
  assert.equal(replay.reason,'stale_year','reports stale_year');
  assert.equal(expose(context,'JSON.stringify(World.government)'),before,'state untouched on stale replay');
});

test('posture is an expression of settlement surveillance, not a duplicate source',()=>{
  const context=governmentContext('gov-posture');
  // Crank the watched settlement's surveillance to maximum.
  expose(context,'World.settlements[World.activeSettlementId].security.surveillance=1; World.settlements[World.activeSettlementId].security.unrest=0;');
  const posture=JSON.parse(expose(context,'JSON.stringify(GovernmentSystem.computePosture(World,World.year))'));
  assert.ok(posture.surveillancePosture>0.9,'high local surveillance drives a heavy posture');
});

test('the regime expresses its grip on the subject, bounded and deterministic in its gating',()=>{
  const context=governmentContext('gov-grip');
  // A subject the eye has not yet noticed: no scrutiny bump, regardless of RNG.
  expose(context,'S.scrutiny=0; S.freedom=50;');
  expose(context,'GovernmentSystem.tickWorld(World,{year:World.year,subject:S});');
  assert.equal(expose(context,'S.scrutiny'),0,'below the watched threshold, scrutiny is untouched');

  // A weak regime grips harder: freedom falls, within its documented bound.
  expose(context,'World.government.legitimacy=0.30;');
  const freedomBefore=Number(expose(context,'S.freedom'));
  expose(context,'GovernmentSystem.tickWorld(World,{year:World.year+1,subject:S});');
  const freedomAfter=Number(expose(context,'S.freedom'));
  assert.ok(freedomAfter<freedomBefore,'freedom dropped under a weak regime');
  assert.ok(freedomBefore-freedomAfter>=1&&freedomBefore-freedomAfter<=2,'freedom drop within FREEDOM_BUMP_MAX');
  assert.ok(freedomAfter>=0,'freedom never negative');
});

test('multi-year run keeps invariants clean and history bounded',()=>{
  const context=governmentContext('gov-multi');
  let problems=[];
  for(let y=0;y<10;y++){
    expose(context,'World.year+=1; S.age+=1;');
    expose(context,'GovernmentSystem.tickWorld(World,{year:World.year,subject:S});');
    const inv=JSON.parse(expose(context,'JSON.stringify(GovernmentSystem.checkInvariants(World))'));
    if(inv.length) problems.push('year '+expose(context,'World.year')+': '+JSON.stringify(inv));
  }
  assert.deepEqual(problems,[],'no invariant failures across 10 years');
  assert.ok(Number(expose(context,'World.government.history.length'))<=32,'history within HISTORY_LIMIT');
});
