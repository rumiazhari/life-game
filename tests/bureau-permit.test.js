'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
// Phase 5 slice 5 — Bureau travel permit. `bureauPermit` keeps the bounded
// compatibility field S.permitUntil fresh; DetentionSystem's annual intake
// reads it: a citizen travelling WITHOUT a valid permit is detained for
// exactly one year longer than a permitted peer under the same posture/seed.
// Determinism: intake rolls via WorldSimulation.streamFor(world,year,salt,
// 'detention'); the permit decision only sets S.permitUntil (no RNG).

const {createGameContext,createWorldContext,expose}=require('./helpers/vm-loader');

function gameCtx(){
  const c=createGameContext(['js/lore.js','js/data.js','js/state.js']);
  expose(c,'globalThis.__DECISIONS=DECISIONS;globalThis.__findDecision=id=>DECISIONS.find(d=>d.id===id);');
  c.newWorld();c.newLineage();c.newSubject();
  return c;
}
function detCtx(seed){
  const context=createWorldContext(['js/systems/government-system.js','js/systems/detention-system.js']);
  expose(context,'Random.setSeed('+JSON.stringify(seed)+'); newWorld(); newLineage(); newHold(); newSubject(); GovernmentSystem.ensure(World);');
  return context;
}

test('bureauPermit exists and renews coverage from lapsed and valid states',()=>{
  const c=gameCtx();
  const d=c.__findDecision('bureauPermit');
  assert.ok(d,'bureauPermit decision present');
  expose(c,'S.age=30;S.assets=500;');
  assert.equal(JSON.parse(expose(c,'JSON.stringify(__findDecision(\"bureauPermit\").avail(S))')),true,'available when adult with funds');
  const y=Number(expose(c,'World.year'));
  const r1=JSON.parse(expose(c,'JSON.stringify(__findDecision(\"bureauPermit\").apply())'));
  assert.equal(r1.reason,'permit_renewed','reason reported (no duplicate text key)');
  assert.equal(r1.fx.assets,-100,'costs $100');
  assert.equal(Number(expose(c,'S.permitUntil')),y+1,'lapsed -> one year of coverage from this year');
  // Renew while the permit is still valid -> coverage extended by one more year.
  expose(c,'S.age=30;S.assets=500;');
  expose(c,'__findDecision(\"bureauPermit\").apply();');
  assert.equal(Number(expose(c,'S.permitUntil')),y+2,'valid -> coverage extended beyond current expiry');
});

test('lacking a permit lengthens the intake term by exactly one year, deterministically',()=>{
  const withPermit=detCtx('permit-term');
  const withoutPermit=detCtx('permit-term');
  const setup='World.government.scrutinyPressure=1;World.government.surveillancePosture=1;S.scrutiny=50;';
  expose(withPermit,setup+'S.permitUntil=World.year;');
  expose(withoutPermit,setup+'S.permitUntil=0;');
  const rw=JSON.parse(expose(withPermit,'JSON.stringify(DetentionSystem.tickWorld(World,{year:World.year,subject:S}))'));
  const ro=JSON.parse(expose(withoutPermit,'JSON.stringify(DetentionSystem.tickWorld(World,{year:World.year,subject:S}))'));
  // Same seed + posture -> identical rng draw, so both intake or both don't.
  assert.equal(rw.intakes,ro.intakes,'identical seed yields identical intake outcome');
  assert.equal(rw.intakes,1,'an intake fired under max posture for this seed');
  const tw=JSON.parse(expose(withPermit,'JSON.stringify(DetentionSystem.openForPerson(World,\"subject\")[0])'));
  const to=JSON.parse(expose(withoutPermit,'JSON.stringify(DetentionSystem.openForPerson(World,\"subject\")[0])'));
  assert.equal(tw.subjectHasPermit,true,'permitted record flagged true');
  assert.equal(to.subjectHasPermit,false,'unpermitted record flagged false');
  assert.equal(to.term,tw.term+1,'missing permit -> exactly one extra year of detention');
  assert.ok(/no permit on file/.test(to.history[0].note),'the ledger names the missing permit');
  // Both must leave the authoritative ledger invariant-clean.
  assert.deepEqual(JSON.parse(expose(withPermit,'JSON.stringify(DetentionSystem.checkInvariants(World))')),[]);
  assert.deepEqual(JSON.parse(expose(withoutPermit,'JSON.stringify(DetentionSystem.checkInvariants(World))')),[]);
});

test('migration preserves subjectHasPermit and normalizes malformed flags idempotently',()=>{
  const c=detCtx('permit-migrate');
  expose(c,'DetentionSystem.open(World,{personId:\"subject\",openedYear:World.year,term:2,subjectHasPermit:false});');
  const s1=expose(c,'WorldSimulation.migrate(World);JSON.stringify(World.detentions);');
  const s2=expose(c,'WorldSimulation.migrate(World);JSON.stringify(World.detentions);');
  assert.equal(s1,s2,'migration output is byte-for-byte idempotent');
  const rec=JSON.parse(expose(c,'JSON.stringify(Object.values(World.detentions)[0])'));
  assert.equal(rec.subjectHasPermit,false,'boolean flag survives migration');
  // A record created without the flag (legacy pre-slice save) is back-filled to null.
  const bare=detCtx('permit-migrate-bare');
  expose(bare,'DetentionSystem.open(World,{personId:\"subject\",openedYear:World.year,term:1});');
  const bre=JSON.parse(expose(bare,'WorldSimulation.migrate(World);JSON.stringify(Object.values(World.detentions)[0])'));
  assert.equal(bre.subjectHasPermit,null,'legacy record back-filled to null');
  // Malformed flag is repaired to null and stays so.
  const corrupt=detCtx('permit-corrupt');
  expose(corrupt,'DetentionSystem.open(World,{personId:\"subject\",openedYear:World.year,term:1,subjectHasPermit:false});');
  expose(corrupt,'Object.values(World.detentions)[0].subjectHasPermit=\"yes\";');
  const cr=JSON.parse(expose(corrupt,'WorldSimulation.migrate(World);JSON.stringify(Object.values(World.detentions)[0])'));
  assert.equal(cr.subjectHasPermit,null,'non-boolean flag repaired');
  assert.deepEqual(JSON.parse(expose(corrupt,'JSON.stringify(DetentionSystem.checkInvariants(World))')),[],'invariants clean post-repair');
});
