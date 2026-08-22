'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function rpgContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld();`);
  return context;
}
function jrun(context,body){
  return JSON.parse(expose(context,'JSON.stringify((function(){'+body+'})())'));
}

test('ensure initializes and is idempotent',()=>{
  const context=rpgContext('rpg-ensure');
  const r=jrun(context,"RPG.ensure(World);RPG.ensure(World);return {v:World.rpg.schemaVersion,n:Object.keys(World.rpg.subjects).length};");
  assert.equal(r.v,1);
  assert.equal(r.n,0);
});

test('migration repairs garbage and is byte-for-byte idempotent',()=>{
  const context=rpgContext('rpg-migrate');
  const r=jrun(context,
    "World.rpg={schemaVersion:'x',counter:-5,subjects:{z:{merit:NaN,grade:99,perks:{bogus:true,nope:false},background:'wizard',history:[{year:1,delta:'x'},{},null]}},y:{merit:10}};"+
    "RPG.migrate(World);const one=JSON.stringify(World.rpg);RPG.migrate(World);const two=JSON.stringify(World.rpg);"+
    "return {same:one===two,merit:World.rpg.subjects.z.merit,grade:World.rpg.subjects.z.grade,bogusDropped:!World.rpg.subjects.z.perks.bogus};");
  assert.equal(r.same,true);
  assert.equal(r.merit,0);
  assert.equal(r.grade,1);
  assert.equal(r.bogusDropped,true);
});

test('merit awards dedupe by year+reason and clamp per award',()=>{
  const context=rpgContext('rpg-merit');
  const r=jrun(context,
    "const a=RPG.addMerit(World,'subject',120,'promotion',50);"+
    "const dup=RPG.addMerit(World,'subject',120,'promotion',50);"+
    "const other=RPG.addMerit(World,'subject',120,'promotion',51);"+
    "RPG.addMerit(World,'subject',99999,'huge',52);"+
    "return {a:a.applied,dup:dup.applied,other:other.applied,capped:RPG.meritOf(World,'subject')};");
  assert.equal(r.a,true);
  assert.equal(r.dup,false);
  assert.equal(r.other,true);
  assert.equal(r.capped,740);
});

test('grades advance along thresholds only upward via merit',()=>{
  const context=rpgContext('rpg-grades');
  const r=jrun(context,
    "RPG.addMerit(World,'subject',60,'g2',1);const g2=RPG.gradeOf(World,'subject');"+
    "for(let y=2;y<6;y++)RPG.addMerit(World,'subject',100,'climb'+y,y);"+
    "const g4ish=RPG.gradeOf(World,'subject');"+
    "for(let y=6;y<26;y++)RPG.addMerit(World,'subject',400,'climb'+y,y);"+
    "const g8=RPG.gradeOf(World,'subject');"+
    "return {g2,g4ish,g8};");
  assert.deepEqual(r,{g2:2,g4ish:4,g8:8});
});

test('perk unlocks gate on grade and slot capacity; background perk is free',()=>{
  const context=rpgContext('rpg-perks');
  const r=jrun(context,
    "const lowGrade=RPG.unlockPerk(World,'subject','ghost');"+
    "RPG.addMerit(World,'subject',250,'m1',1);RPG.addMerit(World,'subject',170,'m2',2);"+
    "const okG4=RPG.unlockPerk(World,'subject','fixer');"+
    "const okG4b=RPG.unlockPerk(World,'subject','hardhands');"+
    "const slotsFull=RPG.unlockPerk(World,'subject','nighteyes');"+
    "const bg=RPG.setBackground(World,'subject','streets');"+
    "const heldAgain=RPG.unlockPerk(World,'subject','nighteyes');"+
    "return {lowGrade:lowGrade.reason,okG4:okG4.ok,okG4b:okG4b.ok,slotsFull:slotsFull.reason,bg:bg.ok,heldAgain:heldAgain.reason,perkCount:RPG.perksFor(World,'subject').length};");
  assert.equal(r.lowGrade,'grade');
  assert.equal(r.okG4,true);
  assert.equal(r.okG4b,true);
  assert.equal(r.slotsFull,'slots');
  assert.equal(r.bg,true);
  assert.equal(r.heldAgain,'held');
  assert.equal(r.perkCount,3);
});

test('modifier math combines grade, perks, and background bias with clamps',()=>{
  const context=rpgContext('rpg-mods');
  const r=jrun(context,
    "const base=RPG.modifierFor(World,'subject','crime').total;"+
    "RPG.setBackground(World,'subject','streets');"+
    "RPG.addMerit(World,'subject',900,'g5',1);"+
    "RPG.unlockPerk(World,'subject','fixer');"+
    "const buffed=RPG.modifierFor(World,'subject','crime').total;"+
    "const studyBase=RPG.modifierFor(World,'subject','study').grade;"+
    "return {baseZero:base===0,buffed,studyBase};");
  assert.equal(r.baseZero,true);
  assert.ok(r.buffed>=3&&r.buffed<=6);
  assert.equal(r.studyBase,1);
});

test('resolveCheck is deterministic per seed/year/purpose and carries a breakdown',()=>{
  const context=rpgContext('rpg-check');
  const r=jrun(context,
    "const mk=()=>WorldSimulation.streamFor(World,77,'subject','rpg:probe');"+
    "const a=RPG.resolveCheck(World,{actorId:'subject',domain:'social',difficulty:'standard',stream:mk(),purpose:'probe'});"+
    "const b=RPG.resolveCheck(World,{actorId:'subject',domain:'social',difficulty:'standard',stream:mk(),purpose:'probe'});"+
    "const hard=RPG.resolveCheck(World,{actorId:'subject',domain:'crime',difficulty:'severe',stream:mk(),purpose:'probe2'});"+
    "return {same:a.total===b.total&&a.nat===b.nat,tnHard:hard.tn,hasBreakdown:Array.isArray(a.breakdown),range:a.nat>=3&&a.nat<=18};");
  assert.equal(r.same,true);
  assert.equal(r.tnHard,13);
  assert.equal(r.hasBreakdown,true);
  assert.equal(r.range,true);
});

test('tick consolidates grades, pays stipends, and rejects stale/duplicate years',()=>{
  const context=rpgContext('rpg-tick');
  const r=jrun(context,
    "RPG.addMerit(World,'subject',70,'seed',49);"+
    "const first=RPG.tickWorld(World,{year:50});"+
    "const again=RPG.tickWorld(World,{year:50});"+
    "const stale=RPG.tickWorld(World,{year:49});"+
    "const stipendEntries=World.rpg.subjects.subject.history.filter(h=>h.reason==='annual-stipend').length;"+
    "return {first:first.applied,again:again.reason,stale:stale.reason,stipendEntries};");
  assert.equal(r.first,true);
  assert.equal(r.again,'already_applied');
  assert.equal(r.stale,'stale_year');
  assert.equal(r.stipendEntries,1);
});

test('invariants catch drift and unknown entries; migration repairs them',()=>{
  const context=rpgContext('rpg-invariants');
  const r=jrun(context,
    "RPG.tickWorld(World,{year:50});"+
    "const clean=RPG.checkInvariants(World);"+
    "World.rpg.subjects.subject.perks.wizard=true;World.rpg.subjects.subject.merit=-40;"+
    "const dirty=RPG.checkInvariants(World);"+
    "RPG.migrate(World);"+
    "const repaired=RPG.checkInvariants(World);"+
    "return {clean:clean.length,dirty:dirty.length,repaired:repaired.length};");
  assert.equal(r.clean,0);
  assert.ok(r.dirty>=2);
  assert.equal(r.repaired,0);
});
