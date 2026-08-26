'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
// Phase 5 slice 6 — public dissent (5G-lite). DissentSystem owns World.dissent
// (stable dissent:NNNNN IDs) with deterministic annual protest waves that are
// a pure function of the live regime posture (GovernmentSystem.summary), and
// a player-facing attend() that marks attendance exactly once and can route a
// crackdown into a real LawSystem inquiry (category 'sedition'). No
// Math.random anywhere — every roll uses WorldSimulation.streamFor.

const {createWorldContext,expose}=require('./helpers/vm-loader');

function dissentContext(seed){
  const context=createWorldContext(['js/systems/government-system.js','js/systems/law-system.js','js/systems/dissent-system.js']);
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject(); GovernmentSystem.ensure(World); LawSystem.ensure(World);");
  return context;
}
const get=(c,expr)=>expose(c,expr);
const snap=c=>JSON.parse(get(c,'JSON.stringify({dissent:World.dissent,invariants:DissentSystem.checkInvariants(World)})'));

test('dissent state is created valid and self-heals in checkInvariants',()=>{
  const c=dissentContext('dis-ensure');
  const fresh=JSON.parse(get(c,'JSON.stringify(DissentSystem.ensure(World))'));
  assert.equal(fresh.dissentSchemaVersion,1,'schema version set');
  assert.ok(Number.isFinite(Number(fresh.dissentCounter)),'counter finite');
  assert.deepEqual(snap(c).invariants,[],'invariants clean when empty');
  // Corrupt it, then ensure must repair.
  get(c,'World.dissent={waves:{"dissent:000x":{id:"dissent:000x",year:5,stage:"bogus",strength:9}}};World.dissentCounter=null;');
  const repaired=snap(c);
  assert.equal(repaired.invariants.length,0,'invariants clean after repair');
  assert.ok(Number.isFinite(Number(get(c,'World.dissentCounter'))),'counter repaired to a number');
  const ids=JSON.parse(get(c,'JSON.stringify(Object.keys(World.dissent.waves))'));
  assert.equal(ids.length,1,'corrupt record survived migration');
  assert.ok(/^dissent:\d{5,}$/.test(ids[0]),'malformed id repaired');
  const rec=JSON.parse(get(c,'JSON.stringify(World.dissent.waves['+JSON.stringify(ids[0])+'])'));
  assert.equal(rec.stage,'active','invalid stage reset to active');
  assert.ok(rec.strength>=0&&rec.strength<=1,'strength clamped to [0,1]');
});

test('WorldSimulation.migrate wires the dissent state into the world',()=>{
  const c=dissentContext('dis-migrate');
  get(c,'WorldSimulation.migrate(World);');
  assert.ok(JSON.parse(get(c,'"dissent" in World')),'World.dissent exists after migrate');
  assert.deepEqual(snap(c).invariants,[],'invariants clean post-migrate');
});

test('wave probability falls as legitimacy and propaganda rise',()=>{
  const c=dissentContext('dis-prob');
  const weak=JSON.parse(get(c,'JSON.stringify(DissentSystem.waveProbability({legitimacy:0,propaganda:0,unrest:0.8}))'));
  const strong=JSON.parse(get(c,'JSON.stringify(DissentSystem.waveProbability({legitimacy:1,propaganda:1,unrest:0}))'));
  assert.ok(weak>strong,'weak regimes face more protest');
  assert.equal(strong,0,'a legitimate regime with full propaganda has no wave chance floor above zero');
  assert.ok(weak<=0.6,'probability capped');
});

test('the annual tick is idempotent, stale-year safe, deterministic, and opens at most one wave per year',()=>{
  const c=dissentContext('dis-tick');
  get(c,'World.government.legitimacy=0; World.government.propaganda=0; GovernmentSystem.ensure(World);');
  const r1=JSON.parse(get(c,'JSON.stringify(DissentSystem.tickWorld(World,{year:30}))'));
  assert.equal(r1.applied,true,'first tick applies');
  const r2=JSON.parse(get(c,'JSON.stringify(DissentSystem.tickWorld(World,{year:30}))'));
  assert.equal(r2.applied,false,'same-year tick is idempotent');
  assert.equal(r2.reason,'already_applied','idempotence reason reported');
  const stale=JSON.parse(get(c,'JSON.stringify(DissentSystem.tickWorld(World,{year:29}))'));
  assert.equal(stale.applied,false,'stale year rejected');
  // Same seed + same posture from a fresh world -> identical outcome.
  const c2=dissentContext('dis-tick');
  get(c2,'World.government.legitimacy=0; World.government.propaganda=0; GovernmentSystem.ensure(World);');
  const r1b=JSON.parse(get(c2,'JSON.stringify(DissentSystem.tickWorld(World,{year:30}))'));
  assert.equal(r1.opened,r1b.opened,'same seed -> same wave outcome');
  const waves=JSON.parse(get(c,'JSON.stringify(Object.keys(World.dissent.waves))'));
  assert.ok(waves.length<=1,'at most one wave exists for the ticked year');
  if(r1.opened){
    const rec=JSON.parse(get(c,'JSON.stringify(DissentSystem.currentWave(World,30))'));
    assert.ok(rec.strength>=0.1&&rec.strength<=1,'wave strength bounded');
    assert.deepEqual(snap(c).invariants,[],'invariants clean after a wave opens');
  }
});

test('attend() requires an open wave, fires once, and never writes S or the government posture',()=>{
  const c=dissentContext('dis-attend');
  const quiet=JSON.parse(get(c,'JSON.stringify(DissentSystem.attend(World,{year:10,subject:S}))'));
  assert.equal(quiet.ok,false,'no wave -> no attendance');
  assert.equal(quiet.reason,'no_wave','reason reported');
  // Open this year's wave directly (as the annual tick would).
  const w=JSON.parse(get(c,'JSON.stringify(DissentSystem.open(World,{year:10,strength:0.7}))'));
  assert.ok(/^dissent:\d{5,}$/.test(w.id),'stable id allocated');
  const govBefore=get(c,'JSON.stringify(World.government)');
  const sBefore=get(c,'JSON.stringify(S)');
  const res=JSON.parse(get(c,'JSON.stringify(DissentSystem.attend(World,{year:10,subject:S}))'));
  assert.equal(res.ok,true,'attendance recorded on an open wave');
  assert.equal(res.wave.id,w.id,'attendance lands on this year\'s wave');
  assert.equal(typeof res.crackdown,'boolean','crackdown decided deterministically');
  assert.equal(JSON.parse(get(c,'DissentSystem.currentWave(World,10).attended')),true,'wave marked attended');
  const again=JSON.parse(get(c,'JSON.stringify(DissentSystem.attend(World,{year:10,subject:S}))'));
  assert.equal(again.ok,false,'second attendance refused');
  assert.equal(again.reason,'already_attended','one attendance per wave');
  assert.equal(get(c,'JSON.stringify(World.government)'),govBefore,'government posture untouched by dissent');
  assert.equal(get(c,'JSON.stringify(S)'),sBefore,'S untouched by the system itself (the decision layer expresses it)');
  assert.deepEqual(snap(c).invariants,[],'invariants clean after attendance');
});

test('a crackdown can open a sedition inquiry; waves resolve next year (crushed under heavy surveillance)',()=>{
  const c=dissentContext('dis-resolve');
  get(c,'World.government.surveillancePosture=1; GovernmentSystem.ensure(World);');
  get(c,'DissentSystem.open(World,{year:40,strength:0.9}); DissentSystem.attend(World,{year:40,subject:S});');
  const attendedWave=JSON.parse(get(c,'JSON.stringify(DissentSystem.currentWave(World,40))'));
  assert.equal(attendedWave.crackdown,attendedWave.crackdown===true,'crackdown flag consistent');
  if(attendedWave.crackdown){
    const inquiries=JSON.parse(get(c,'JSON.stringify(LawSystem.openForPerson(World,"subject").filter(function(x){return x.category==="sedition";}).map(function(x){return x.id;}))'));
    assert.equal(inquiries.length,1,'crackdown opened exactly one sedition inquiry through LawSystem');
  }
  // Next annual tick resolves last year's wave; heavy surveillance crushes it.
  const r=JSON.parse(get(c,'JSON.stringify(DissentSystem.tickWorld(World,{year:41}))'));
  assert.equal(r.applied,true,'next-year tick applies');
  assert.equal(r.resolved,1,'prior wave resolved exactly once');
  const resolved=JSON.parse(get(c,'JSON.stringify(Object.values(World.dissent.waves).find(function(w){return w.year===40;}))'));
  assert.equal(resolved.stage,'resolved','resolved stage set');
  assert.equal(resolved.crushed,true,'heavy surveillance crushes the wave');
  assert.equal(resolved.resolvedYear,41,'resolution year recorded');
  assert.deepEqual(snap(c).invariants,[],'invariants clean after resolution');
});
