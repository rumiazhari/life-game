'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');
function fixture(seed){
 const c=createWorldContext(['js/data/quest-arcs.js','js/systems/quest-engine.js']);
 expose(c,"Random.setSeed("+JSON.stringify(seed||'quest-fixture')+");newWorld();newLineage();newHold();newSubject();S.age=29;World.year=S.dob+29;S.assets=800;S.health=75;S.relations=60;S.happiness=65;S.livingAtHome=false;S.skills={academics:2,care:2,craft:3,social:2,retail:2};");
 return c;
}
function run(c,body){return JSON.parse(expose(c,"JSON.stringify((function(){"+body+"})())"));}

test('six stories and a three-thread active limit; work requires employment',()=>{
 const c=fixture();
 const r=run(c,"const first=QuestEngine.catalog(World,S);S.jobTier=1;const eligible=QuestEngine.catalog(World,S).find(x=>x.id==='missing_wages').canStart;"+
 "const a=QuestEngine.start(World,S,'night_ward'),b=QuestEngine.start(World,S,'breadline'),d=QuestEngine.start(World,S,'last_freight');"+
 "return {count:first.length,locked:first.find(x=>x.id==='missing_wages').canStart,eligible,ids:[a.runId,b.runId,d.runId],cap:QuestEngine.start(World,S,'vanished_name').reason};");
 assert.equal(r.count,6);assert.equal(r.locked,false);assert.equal(r.eligible,true);
 assert.deepEqual(r.ids,['quest:00001','quest:00002','quest:00003']);assert.equal(r.cap,'active_limit');
});
test('d20 chance shows exact probability and bonuses from items, skill and health',()=>{
 const c=fixture();
 const r=run(c,"const id=QuestEngine.start(World,S,'night_ward').runId;"+
 "const a=QuestEngine.byId('night_ward').approaches[0];const base=QuestEngine.chanceProfile(World,S,QuestEngine.get(World,id),a);"+
 "QuestEngine.choose(World,S,id,'supplies');const prep=QuestEngine.chanceProfile(World,S,QuestEngine.get(World,id),a);"+
 "const cash=S.assets,kit=QuestEngine.kitCount(World,'medical_kit');S.health=25;"+
 "const hurt=QuestEngine.chanceProfile(World,S,QuestEngine.get(World,id),a);return {base:base.modifier,prep:prep.modifier,hurt:hurt.modifier,cash,kit,odds:prep.odds,dc:prep.dc};");
 assert.equal(r.cash,765);assert.equal(r.kit,1);assert.ok(r.prep>r.base);assert.ok(r.hurt<=r.prep-2);
 assert.equal(r.odds,Array.from({length:20},(_,i)=>i+1+r.prep>=r.dc).filter(Boolean).length*5);
});
test('dice outcomes replay exactly and committed choices cannot be rerolled',()=>{
 function replay(){
  const c=fixture('fixed-quest');
  return run(c,"const id=QuestEngine.start(World,S,'vanished_name').runId;QuestEngine.choose(World,S,id,'letter');"+
  "const first=QuestEngine.choose(World,S,id,'petition'),snap=JSON.stringify(World.storyQuest),assets=S.assets,scrutiny=S.scrutiny;"+
  "const repeat=QuestEngine.choose(World,S,id,'petition');return {first,repeat:repeat.reason,same:snap===JSON.stringify(World.storyQuest),assetsSame:assets===S.assets,scrutinySame:scrutiny===S.scrutiny};");
 }
 const a=replay(),b=replay();assert.deepEqual(a,b);assert.equal(a.first.applied,true);
 assert.ok(a.first.roll.face>=1&&a.first.roll.face<=20);assert.equal(a.repeat,'unavailable_choice');
 assert.equal(a.same,true);assert.equal(a.assetsSame,true);assert.equal(a.scrutinySame,true);
});
test('guaranteed route has a fixed cost but no dice',()=>{
 const c=fixture();
 const r=run(c,"const id=QuestEngine.start(World,S,'breadline').runId;QuestEngine.choose(World,S,id,'queue');"+
 "const before=S.assets,v=QuestEngine.view(World,S,id);const result=QuestEngine.choose(World,S,id,'give');"+
 "return {preview:v.options.find(x=>x.id==='give').profile,roll:result.roll,success:result.success,stage:result.stage,cost:before-S.assets};");
 assert.equal(r.preview,null);assert.equal(r.roll,null);assert.equal(r.success,true);assert.equal(r.stage,'waiting');assert.equal(r.cost,65);
});
test('year-delayed callbacks are idempotent, and a quest grants merit only once',()=>{
 const c=fixture();
 const r=run(c,"const id=QuestEngine.start(World,S,'household_promise').runId;QuestEngine.choose(World,S,id,'listen');QuestEngine.choose(World,S,id,'release');"+
 "const now=QuestEngine.tickWorld(World,{year:World.year,subject:S});World.year++;const next=QuestEngine.tickWorld(World,{year:World.year,subject:S});"+
 "const repeat=QuestEngine.tickWorld(World,{year:World.year,subject:S}),stale=QuestEngine.tickWorld(World,{year:World.year-1,subject:S});"+
 "const before=RPG.meritOf(World,'subject'),end=QuestEngine.choose(World,S,id,'reconcile'),after=RPG.meritOf(World,'subject');"+
 "return {now:now.callbacks,next:next.callbacks,repeat:repeat.reason,stale:stale.reason,merit:after-before,stage:end.stage,again:QuestEngine.choose(World,S,id,'reconcile').reason};");
 assert.equal(r.now,0);assert.equal(r.next,1);assert.equal(r.repeat,'already_applied');assert.equal(r.stale,'stale_year');
 assert.equal(r.merit,45);assert.equal(r.stage,'completed');assert.equal(r.again,'unavailable_choice');
});
test('migrate preserves malformed records and is byte-for-byte idempotent',()=>{
 const c=fixture();
 const r=run(c,"World.storyQuest={counter:0,runs:{'old-null':null,'quest:00940':{id:'quest:00940',stage:'waiting',readyYear:World.year,history:[{text:'x'}]},'old-dupe':{id:'quest:00940',stage:'broken'}},kit:{medical_kit:999,trade_permit:999,unknown:44}};"+
 "QuestEngine.migrate(World);const one=JSON.stringify(World.storyQuest);QuestEngine.migrate(World);return {same:one===JSON.stringify(World.storyQuest),ids:Object.keys(World.storyQuest.runs),counter:World.storyQuest.counter,issues:QuestEngine.checkInvariants(World)};");
 assert.equal(r.same,true);assert.equal(r.ids.length,3);assert.ok(r.counter>=942);assert.deepEqual(r.issues,[]);
});
test('quests do not touch map state and leave no invariants after three chapters',()=>{
 const c=fixture();
 const r=run(c,"const old=JSON.stringify(World.map);const id=QuestEngine.start(World,S,'last_freight').runId;"+
 "QuestEngine.choose(World,S,id,'crew');QuestEngine.choose(World,S,id,'work');World.year++;QuestEngine.tickWorld(World,{year:World.year,subject:S});"+
 "QuestEngine.choose(World,S,id,'invest');return {same:old===JSON.stringify(World.map),invariants:QuestEngine.checkInvariants(World),completed:QuestEngine.summary(World,S).completed};");
 assert.equal(r.same,true);assert.deepEqual(r.invariants,[]);assert.equal(r.completed,1);
});
