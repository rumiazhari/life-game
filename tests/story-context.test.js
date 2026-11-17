'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
function ready(seed='context'){
 const c=createWorldContext();loadGameFiles(c,['js/systems/story-quests.js','js/systems/story-rpg-checks.js','js/systems/story-quest-engine.js']);
 if(fs.existsSync('js/systems/story-context.js'))loadGameFiles(c,['js/systems/story-context.js']);
 expose(c,`Random.setSeed(${JSON.stringify(seed)});newWorld();newLineage();newHold();newSubject();S.age=28;S.alive=true;S.health=80;World.year=S.dob+28;NpcSystem.syncLegacy(World,S,Lineage);StorySystem.ensure(World);`);
 return c;
}
const json=(c,s)=>JSON.parse(expose(c,`JSON.stringify((()=>{${s}})())`));
const leads=c=>json(c,'return StorySystem.availableQuests(World,{subject:S}).filter(q=>q.contextual);');
function play(c,id,index=2){return json(c,`const a=StorySystem.startQuest(World,${JSON.stringify(id)},{subject:S,remainingEnergy:1});if(!a.ok)return a;StorySystem.next(World,{subject:S});const v=StorySystem.currentView(World,{subject:S});const r=StorySystem.choose(World,${index},{subject:S});const run=StorySystem.liveRun(World);return {a,v,r,run};`);}
test('reusable context families expose real settlement and household references with three routes',()=>{
 const c=ready(),ls=leads(c);assert.ok(ls.length>=2);
 for(const q of ls){const out=play(c,q.id);assert.equal(out.v.options.length,3);assert.equal(out.v.options[2].check,null);assert.equal(out.r.applied,true);assert.ok(out.run.context.settlementId);expose(c,`StorySystem.fileAway(World,${JSON.stringify(out.run.id)},{year:World.year});`);}
});
test('context choices replay exactly after save/reload and fail forward without duplicate merit',()=>{
 const c=ready();const q=leads(c)[0];assert.ok(q);
 expose(c,`StorySystem.startQuest(World,${JSON.stringify(q&&q.id)},{subject:S});StorySystem.next(World,{subject:S});`);
 const saved=expose(c,'JSON.stringify(World)');
 const run=()=>json(c,'WorldSimulation.streamFor=()=>({next:()=>0});const r=StorySystem.choose(World,0,{subject:S});const id=StorySystem.liveRun(World).id;const a=StorySystem.fileAway(World,id);const merit=RPG.meritOf(World,"subject");const b=StorySystem.fileAway(World,id);return {r,a,b,merit,after:RPG.meritOf(World,"subject")};');
 const a=run();expose(c,`World=JSON.parse(${JSON.stringify(saved)});`);assert.deepEqual(run(),a);assert.equal(a.r.check.success,false);assert.equal(a.b.applied,false);assert.equal(a.merit,a.after);
});
test('callbacks open next year and family cooldown survives archive eviction and stale years',()=>{
 const c=ready(),q=leads(c)[0];assert.ok(q);const out=play(c,q.id);expose(c,`StorySystem.fileAway(World,${JSON.stringify(out.run.id)});`);
 assert.ok(!leads(c).some(x=>x.family===q.family));expose(c,'World.year++;');assert.ok(leads(c).find(x=>x.family===q.family).followup);
 expose(c,'World.storyArchive={};World.year-=1;');assert.ok(!leads(c).some(x=>x.family===q.family));
});
test('missing actors suppress household family and zero energy cannot create a run',()=>{
 const c=ready();expose(c,'Object.values(World.npcs).forEach(n=>n.alive=false);');assert.ok(!leads(c).some(x=>x.family==='household'));
 const q=leads(c)[0];assert.ok(q);assert.equal(json(c,`return StorySystem.startQuest(World,${JSON.stringify(q.id)},{subject:S,remainingEnergy:0});`).reason,'no_energy');assert.equal(expose(c,'Object.keys(World.storyRuns).length'),0);
});
test('actor death during a chapter preserves guaranteed exit and disables NPC routes',()=>{
 const c=ready(),q=leads(c).find(x=>x.family==='household');assert.ok(q);
 expose(c,`StorySystem.startQuest(World,${JSON.stringify(q&&q.id)},{subject:S});StorySystem.next(World,{subject:S});Object.values(World.npcs).forEach(n=>n.alive=false);`);
 const v=json(c,'return StorySystem.currentView(World,{subject:S});');assert.equal(v.options[0].available,false);assert.equal(v.options[2].available,true);assert.equal(json(c,'return StorySystem.choose(World,0,{subject:S});').applied,false);assert.equal(json(c,'return StorySystem.choose(World,2,{subject:S});').applied,true);
});
module.exports={ready,json,leads,play};
test('seed replay and eighty years preserve archive bound and canonical invariants',()=>{
 function sequence(){const c=ready('long-context');for(let i=0;i<80;i++){const q=leads(c).find(q=>q.family==='civic');assert.ok(q);const r=play(c,q.id,i%3);assert.equal(r.r.applied,true);expose(c,`StorySystem.fileAway(World,${JSON.stringify(r.run.id)});World.year++;`);}assert.equal(expose(c,'Object.keys(World.storyArchive).length'),64);assert.deepEqual(json(c,'return StorySystem.checkInvariants(World);'),[]);return json(c,'return {archive:World.storyArchive,merit:RPG.meritOf(World,"subject")};');}
 assert.deepEqual(sequence(),sequence());
});
test('employer chapter requires a real contract and never pays salary or changes replacement contract',()=>{
 const c=ready();assert.ok(!leads(c).some(q=>q.family==='employer'));
 expose(c,`const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Actual Employer'});EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1200,occupationName:'Worker',jobTier:1});`);
 const q=leads(c).find(q=>q.family==='employer');assert.ok(q);
 expose(c,`StorySystem.startQuest(World,${JSON.stringify(q.id)},{subject:S});StorySystem.next(World,{subject:S});const old=EmploymentSystem.activeForPerson(World,'subject')[0];EmploymentSystem.end(World,old.id,'terminated','test',World.year,{subject:S});`);
 assert.equal(json(c,'return StorySystem.choose(World,0,{subject:S});').applied,false);
 assert.equal(json(c,'return StorySystem.choose(World,2,{subject:S});').applied,true);
});
