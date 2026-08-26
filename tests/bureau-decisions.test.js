'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
// Phase 5 slice 3 — the "bribe the Bureau" decision routes through the real
// posture (GovernmentSystem.summary) and, on refusal, opens a real
// LawSystem inquiry for the subject. It mutates only legacy S fields
// (scrutiny/freedom/bureauFavor) and the authoritative World.legalCases —
// never a second authority. Outcomes are a pure function of posture so the
// refusal path is reproducible (we pin scrutinyPressure high to force a miss).

const {createGameContext,expose}=require('./helpers/vm-loader');

function ctx(){
  const c=createGameContext(['js/lore.js','js/data.js','js/state.js','js/systems/business-system.js','js/systems/employment-system.js','js/systems/government-system.js','js/systems/law-system.js']);
  expose(c,'globalThis.__DECISIONS=DECISIONS;globalThis.__findDecision=id=>DECISIONS.find(d=>d.id===id);');
  c.newWorld();
  c.newLineage();
  c.newSubject();
  expose(c,'if(typeof GovernmentSystem==="object"&&GovernmentSystem)GovernmentSystem.ensure(World);');
  return c;
}

function applyDecision(c,id){
  return JSON.parse(expose(c,`(function(){const d=__findDecision(${JSON.stringify(id)});const before=JSON.parse(JSON.stringify(S));const r=d.apply();return JSON.stringify({r,before,after:JSON.parse(JSON.stringify(S))});})()`));
}

test('bribeBureau exists and is gated on scrutiny/record and funds',()=>{
  const c=ctx();
  const d=c.__findDecision('bribeBureau');
  assert.ok(d,'bribeBureau decision present');
  const hidden=expose(c,'S.age=30;S.assets=100;S.scrutiny=0;S.record=false;JSON.stringify(__findDecision("bribeBureau").avail(S));');
  assert.equal(JSON.parse(hidden),false,'hidden when clean and poor');
  const shown=expose(c,'S.assets=1000;S.scrutiny=20;JSON.stringify(__findDecision("bribeBureau").avail(S));');
  assert.equal(JSON.parse(shown),true,'shown when watched and able to pay');
});

test('a refused bribe opens a real Bureau inquiry and raises scrutiny',()=>{
  const c=ctx();
  expose(c,'S.age=30;S.assets=1000;S.scrutiny=20;S.record=false;World.government.scrutinyPressure=1;LawSystem.ensure(World);World.legalCaseLastTickYear=null;');
  // Pin the global stream so the 40% success floor cannot flip this into the
  // acceptance branch run-to-run (unseeded Random falls back to Math.random).
  // First draw for this seed is 0.4149 >= successP (0.40) -> guaranteed miss.
  expose(c,"Random.setSeed('bureau-fixed-0');");
  const out=applyDecision(c,'bribeBureau');
  assert.equal(out.r.reason,'bribe_refused_inquiry_opened','refusal path taken under watchful regime');
  assert.equal(out.r.fx.assets,-250,'bribe cost deducted even on refusal');
  const check=JSON.parse(expose(c,`(function(){const open=LawSystem.openForPerson(World,"subject").filter(x=>x.category==="bribery");return JSON.stringify({open:open.length,stage:open[0]?open[0].stage:null});})()`));
  assert.equal(check.open,1,'a real bribery inquiry was opened for the subject');
  assert.equal(check.stage,'reported','inquiry starts at reported');
  assert.deepEqual(JSON.parse(expose(c,'JSON.stringify(LawSystem.checkInvariants(World))')),[],'law invariants clean after the decision');
});

test('an accepted bribe lowers scrutiny and grants Bureau Favor',()=>{
  const c=ctx();
  expose(c,'S.age=30;S.assets=1000;S.scrutiny=40;S.bureauFavor=0;S.record=true;World.government.scrutinyPressure=0;LawSystem.ensure(World);World.legalCaseLastTickYear=null;');
  // Force acceptance by pinning the random stream low so chance(0.85) passes
  // (first draw for this seed is 0.0932 < 0.85) — the accepted-branch asserts
  // below therefore ALWAYS run instead of being silently skipped.
  expose(c,"Random.setSeed('bureau-fixed-6');");
  const out=applyDecision(c,'bribeBureau');
  // successP at scrutiny=0 is 0.85; the pinned seed guarantees acceptance.
  assert.equal(out.r.reason,'bribe_accepted','accepted branch taken under the pinned stream');
  assert.ok(out.after.scrutiny<=15,'scrutiny dropped sharply on success');
  assert.ok(out.after.bureauFavor>=1,'Bureau Favor granted');
  assert.equal(out.r.fx.assets,-250,'bribe cost deducted on success');
});
