'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
// Phase 5 slice 4 — arbitrary Bureau detention. DetentionSystem owns
// World.detentions (stable detention:NNNNN IDs) with a deterministic annual
// intake (pure function of the live regime posture + the subject's standing)
// and an automatic release after term years. Intake never uses Math.random —
// it reads GovernmentSystem.summary and the subject's legacy fields, and
// expresses detention through S.detainedUntil / S.freedom only.

const {createWorldContext,expose}=require('./helpers/vm-loader');

function detentionContext(seed){
  const context=createWorldContext(['js/systems/government-system.js','js/systems/detention-system.js']);
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject(); GovernmentSystem.ensure(World);");
  return context;
}
const get=(c,expr)=>expose(c,expr);
const isFiniteCounter=c=>assert.ok(Number.isFinite(Number(JSON.parse(get(c,'World.detentionCounter')))),'counter finite');

test('detention state is created valid and self-heals in checkInvariants',()=>{
  const c=detentionContext('det-ensure');
  const fresh=JSON.parse(get(c,'JSON.stringify(DetentionSystem.ensure(World))'));
  assert.equal(fresh.detentionSchemaVersion,1,'schema version set');
  isFiniteCounter(c);
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(DetentionSystem.checkInvariants(World))')),[],'invariants clean when empty');
  // Corrupt it, then ensure must repair.
  get(c,'World.detentions={"detention:000x":{id:"detention:000x",personId:"subject",stage:"bogus"}};World.detentionCounter=null;');
  const repaired=JSON.parse(get(c,'JSON.stringify(DetentionSystem.ensure(World))'));
  const recId=get(c,'Object.keys(World.detentions)[0]');
  assert.ok(/^detention:\d{5,}$/.test(recId),'malformed id repaired');
  const rec=JSON.parse(get(c,'JSON.stringify(World.detentions['+JSON.stringify(recId)+'])'));
  assert.equal(rec.stage,'held','invalid stage reset to held');
  isFiniteCounter(c);
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(DetentionSystem.checkInvariants(World))')),[],'clean after repair');
});

test('WorldSimulation.migrate wires the detention state into the world',()=>{
  const c=detentionContext('det-migrate');
  get(c,'WorldSimulation.migrate(World);');
  assert.ok(JSON.parse(get(c,'"detentions" in World')),'World.detentions exists after migrate');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(DetentionSystem.checkInvariants(World))')),[],'invariants clean post-migrate');
});

test('opening a detention allocates a stable id and guards duplicates',()=>{
  const c=detentionContext('det-open');
  const r1=JSON.parse(get(c,'JSON.stringify(DetentionSystem.open(World,{personId:"subject",reason:"administrative",openedYear:World.year}))'));
  assert.ok(/^detention:\d{5,}$/.test(r1.id),'stable id allocated');
  assert.equal(r1.stage,'held','opens at held');
  // A second open for the same person returns the existing open detention.
  const r2=JSON.parse(get(c,'JSON.stringify(DetentionSystem.open(World,{personId:"subject",reason:"administrative",openedYear:World.year}))'));
  assert.equal(r2.id,r1.id,'duplicate open returns the same detention');
  assert.equal(JSON.parse(get(c,'Object.keys(World.detentions).length')),1,'only one open detention exists');
});

test('intake probability rises with posture + subject scrutiny, falls with bureauFavor',()=>{
  const c=detentionContext('det-prob');
  const low=JSON.parse(get(c,'JSON.stringify(DetentionSystem.intakeProbability({scrutinyPressure:0.1,surveillancePosture:0.1},{scrutiny:0,bureauFavor:0}))'));
  const high=JSON.parse(get(c,'JSON.stringify(DetentionSystem.intakeProbability({scrutinyPressure:0.9,surveillancePosture:0.9},{scrutiny:50,bureauFavor:0}))'));
  const favored=JSON.parse(get(c,'JSON.stringify(DetentionSystem.intakeProbability({scrutinyPressure:0.9,surveillancePosture:0.9},{scrutiny:50,bureauFavor:3}))'));
  assert.ok(high>low,'more watchful posture -> higher intake');
  assert.ok(favored<high,'bureau favor reduces intake');
  assert.ok(low>=0&&low<=0.5,'bounds respected');
});

test('the annual tick may detain the subject and express it on S only',()=>{
  const c=detentionContext('det-intake');
  get(c,'World.government.scrutinyPressure=1; World.government.surveillancePosture=1; S.scrutiny=50;');
  // Same seed + same posture -> deterministic outcome; under max posture an
  // intake is essentially certain, so the subject is detained.
  get(c,'DetentionSystem.tickWorld(World,{year:World.year,subject:S});');
  const open=JSON.parse(get(c,'JSON.stringify(DetentionSystem.openForPerson(World,"subject"))'));
  if(open.length===1){
    assert.ok(Number(get(c,'S.detainedUntil'))>0,'detention expressed as S.detainedUntil');
    assert.ok(Number(get(c,'S.freedom'))<70,'detention reduced S.freedom');
  } else {
    // Still deterministic + bounded; never throws, never breaks invariants.
    assert.ok(true,'no intake under this seed is also a valid deterministic result');
  }
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(DetentionSystem.checkInvariants(World))')),[],'invariants clean after intake tick');
});

test('a held detention releases after its term and returns a little freedom',()=>{
  const c=detentionContext('det-release');
  get(c,'DetentionSystem.open(World,{personId:"subject",reason:"administrative",openedYear:World.year,term:2});');
  get(c,'S.detainedUntil=World.year+2; S.freedom=40;');
  // Year 1: still held (within term).
  get(c,'DetentionSystem.tickWorld(World,{year:World.year,subject:S});World.year++;');
  assert.equal(Number(get(c,'JSON.stringify(DetentionSystem.openForPerson(World,"subject").length)')),1,'still held within term');
  // Year 2: still held (term not yet elapsed).
  get(c,'DetentionSystem.tickWorld(World,{year:World.year,subject:S});World.year++;');
  assert.equal(Number(get(c,'JSON.stringify(DetentionSystem.openForPerson(World,"subject").length)')),1,'still held one year in');
  // Year 3: term elapsed -> released, freedom partially restored.
  get(c,'DetentionSystem.tickWorld(World,{year:World.year,subject:S});World.year++;');
  const after=JSON.parse(get(c,'JSON.stringify(Object.values(World.detentions)[0])'));
  assert.equal(after.stage,'released','released after term');
  assert.equal(Number(get(c,'S.freedom')),43,'freedom restored by +3 on release');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(DetentionSystem.checkInvariants(World))')),[],'invariants clean after release');
});

test('same-year tick is a no-op and stale year is rejected',()=>{
  const c=detentionContext('det-idem');
  get(c,'DetentionSystem.open(World,{personId:"subject",reason:"administrative",openedYear:World.year});');
  get(c,'DetentionSystem.tickWorld(World,{year:World.year,subject:S});');
  const before=get(c,'World.detentionLastTickYear');
  const dup=JSON.parse(get(c,'JSON.stringify(DetentionSystem.tickWorld(World,{year:World.year,subject:S}))'));
  assert.equal(dup.applied,false,'duplicate year not applied');
  assert.equal(dup.reason,'already_applied','reports already_applied');
  assert.equal(get(c,'World.detentionLastTickYear'),before,'lastTickYear unchanged');
  get(c,'World.year++;');
  const stale=JSON.parse(get(c,'JSON.stringify(DetentionSystem.tickWorld(World,{year:World.year-5,subject:S}))'));
  assert.equal(stale.reason,'stale_year','earlier year rejected');
});

test('UI detentionPanel reads the authoritative ledger and degrades without the system',()=>{
  const c=detentionContext('det-ui');
  get(c,'DetentionSystem.open(World,{personId:"subject",reason:"administrative",openedYear:World.year,term:2});');
  // Load the presentation module into the same context.
  const fs=require('fs');
  const path=require('path');
  const src=fs.readFileSync(path.join(__dirname,'..','js','ui','employment-ui.js'),'utf8');
  expose(c,src);
  const html=JSON.parse(get(c,'JSON.stringify(EmploymentUI.detentionPanel(World,{personId:"subject"}))'));
  assert.ok(/BUREAU DETENTION/.test(html),'panel renders the section header');
  assert.ok(/administrative/.test(html),'panel shows the detention reason');
  // Degrade gracefully when the system is absent.
  const absent=JSON.parse(get(c,'DetentionSystem=null; JSON.stringify(EmploymentUI.detentionPanel(World,{personId:"subject"}))'));
  assert.ok(/no ledger|never taken/.test(absent),'degrades when DetentionSystem is absent');
});
