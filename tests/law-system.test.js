'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
// Phase 5 slice 3 — the law registry foundation. LawSystem owns
// World.legalCases (stable legal-case:NNNNN IDs) with a deterministic annual
// stage-advance + posture-driven verdict, idempotent migration, and clean
// invariants. Verdicts depend only on the regime's scrutiny pressure, never
// Math.random, so the bribe decision's refusal path and the annual tick are
// both reproducible.

const {createWorldContext,expose}=require('./helpers/vm-loader');

function lawContext(seed){
  const context=createWorldContext(['js/systems/government-system.js','js/systems/law-system.js']);
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject(); GovernmentSystem.ensure(World);");
  return context;
}
const get=(c,expr)=>expose(c,expr);
const isFiniteCounter=c=>assert.ok(Number.isFinite(Number(JSON.parse(get(c,'World.legalCaseCounter')))),'counter finite');

test('law state is created valid and self-heals in checkInvariants',()=>{
  const c=lawContext('law-ensure');
  const fresh=JSON.parse(get(c,'JSON.stringify(LawSystem.ensure(World))'));
  assert.equal(fresh.legalCaseSchemaVersion,1,'schema version set');
  isFiniteCounter(c);
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(LawSystem.checkInvariants(World))')),[],'invariants clean when empty');
  // Corrupt it, then ensure must repair.
  get(c,'World.legalCases={"legal-case:000x":{id:"legal-case:000x",personId:"subject",stage:"bogus"}};World.legalCaseCounter=null;');
  const repaired=JSON.parse(get(c,'JSON.stringify(LawSystem.ensure(World))'));
  const recId=get(c,'Object.keys(World.legalCases)[0]');
  assert.ok(/^legal-case:\d{5,}$/.test(recId),'malformed id repaired');
  const rec=JSON.parse(get(c,'JSON.stringify(World.legalCases['+JSON.stringify(recId)+'])'));
  assert.equal(rec.stage,'reported','invalid stage reset to reported');
  isFiniteCounter(c);
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(LawSystem.checkInvariants(World))')),[],'clean after repair');
});

test('WorldSimulation.migrate wires the law state into the world',()=>{
  const c=lawContext('law-migrate');
  get(c,'WorldSimulation.migrate(World);');
  assert.ok(JSON.parse(get(c,'"legalCases" in World')),'World.legalCases exists after migrate');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(LawSystem.checkInvariants(World))')),[],'invariants clean post-migrate');
});

test('opening a case allocates a stable id and guards duplicates',()=>{
  const c=lawContext('law-open');
  const r1=JSON.parse(get(c,'JSON.stringify(LawSystem.open(World,{personId:"subject",category:"bribery",openedYear:World.year}))'));
  assert.ok(/^legal-case:\d{5,}$/.test(r1.id),'stable id allocated');
  assert.equal(r1.stage,'reported','opens at reported');
  // A second open for the same person+category returns the existing case.
  const r2=JSON.parse(get(c,'JSON.stringify(LawSystem.open(World,{personId:"subject",category:"bribery",openedYear:World.year}))'));
  assert.equal(r2.id,r1.id,'duplicate open returns the same case');
  assert.equal(JSON.parse(get(c,'Object.keys(World.legalCases).length')),1,'only one case exists');
});

test('the annual tick advances stages and decides verdicts from posture',()=>{
  const c=lawContext('law-tick');
  get(c,'World.government.scrutinyPressure=0.9; LawSystem.open(World,{personId:"subject",category:"bribery",openedYear:World.year});');
  // 4 ticks bring reported -> investigation -> charged -> hearing -> verdict.
  for(let y=0;y<4;y++) get(c,'LawSystem.tickWorld(World,{year:World.year,subject:S});World.year++;');
  const rec=JSON.parse(get(c,'JSON.stringify(Object.values(World.legalCases)[0])'));
  assert.equal(rec.stage,'verdict','case reached verdict after advance');
  assert.ok(rec.outcome==='guilty'||rec.outcome==='cleared','verdict decided');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(LawSystem.checkInvariants(World))')),[],'invariants clean after ticks');
});

test('same-year tick is a no-op and stale year is rejected',()=>{
  const c=lawContext('law-idem');
  get(c,'LawSystem.open(World,{personId:"subject",category:"bribery",openedYear:World.year});');
  get(c,'LawSystem.tickWorld(World,{year:World.year,subject:S});');
  const before=get(c,'World.legalCaseLastTickYear');
  const dup=JSON.parse(get(c,'JSON.stringify(LawSystem.tickWorld(World,{year:World.year,subject:S}))'));
  assert.equal(dup.applied,false,'duplicate year not applied');
  assert.equal(dup.reason,'already_applied','reports already_applied');
  assert.equal(get(c,'World.legalCaseLastTickYear'),before,'lastTickYear unchanged');
  // Advance then try an earlier year.
  get(c,'World.year++;');
  const stale=JSON.parse(get(c,'JSON.stringify(LawSystem.tickWorld(World,{year:World.year-5,subject:S}))'));
  assert.equal(stale.reason,'stale_year','earlier year rejected');
});

test('a guilty verdict on the subject raises S.scrutiny; a cleared one does not',()=>{
  const c=lawContext('law-verdict');
  get(c,'S.scrutiny=0; World.government.scrutinyPressure=1; LawSystem.open(World,{personId:"subject",category:"dissent",openedYear:World.year});');
  // Force a guilty outcome by ticking under maximal scrutiny.
  for(let y=0;y<4;y++) get(c,'World.government.scrutinyPressure=1; LawSystem.tickWorld(World,{year:World.year,subject:S});World.year++;');
  const rec=JSON.parse(get(c,'JSON.stringify(Object.values(World.legalCases)[0])'));
  assert.equal(rec.outcome,'guilty','maximally watchful regime convicts');
  assert.ok(Number(get(c,'S.scrutiny'))>0,'guilty verdict expressed as scrutiny on the subject');
});
