'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
function ready(seed='story-quests'){
 const ctx=createWorldContext();
 loadGameFiles(ctx,['js/systems/story-quests.js','js/systems/story-rpg-checks.js','js/systems/story-quest-engine.js']);
 expose(ctx,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=24;S.alive=true;S.assets=600;S.mother.alive=true;S.health=83;S.happiness=60;"+
  "World.year=S.dob+S.age;");
 return ctx;
}
function action(ctx,js){return JSON.parse(expose(ctx,'JSON.stringify((function(){'+js+'})())'));}
const start=(ctx,id)=>action(ctx,"return StorySystem.startQuest(World,"+JSON.stringify(id)+",{subject:S,lineage:Lineage,year:World.year});");
const step=ctx=>expose(ctx,"StorySystem.next(World,{year:World.year,subject:S,lineage:Lineage});");
const choose=(ctx,i)=>action(ctx,"return StorySystem.choose(World,"+i+",{year:World.year,subject:S,lineage:Lineage});");
test('exact 3d6 baseline probability is counted over 216 outcomes',()=>{
 const ctx=ready('odds');
 const result=action(ctx,"return RPG.previewCheck(World,{actorId:'subject',domain:'social',difficulty:'standard'});");
 assert.equal(result.outcomes,216);
 assert.equal(result.successes,160);
 assert.equal(result.percent,74);
 assert.equal(result.mod,0);
});
test('character health, skills, career and story gear alter actual checks and preview identically',()=>{
 const ctx=ready('modifiers');
 const out=action(ctx,"var base=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard'});"+
  "S.skills.craft=8;S.jobTier=3;var skill=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard'});"+
  "S.health=28;var tired=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard'});"+
  "World.storyItems.test_tools={id:'test_tools'};var equipped=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard',item:'test_tools'});"+
  "return {base,skill,tired,equipped};");
 assert.ok(out.skill.percent>out.base.percent);
 assert.ok(out.tired.percent<out.skill.percent);
 assert.ok(out.equipped.percent>out.tired.percent);
 const actual=action(ctx,"return RPG.resolveCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard',item:'test_tools',stream:{next:()=>.5}});");
 assert.equal(actual.probability,out.equipped.probability);
 assert.equal(actual.mod,out.equipped.mod);
 assert.equal(actual.total,12+actual.mod);
});
test('quest board uses real stage, eligible stories and no duplicate start',()=>{
 const ctx=ready('board');
 const list=action(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage});");
 for(const id of ['quest_kitchen_table','quest_ward_petition','quest_school_press','quest_night_market'])
  assert.ok(list.some(q=>q.id===id),id);
 assert.equal(list.some(q=>q.followup),false);
 assert.equal(start(ctx,'quest_ward_petition').ok,true);
 assert.equal(start(ctx,'quest_school_press').reason,'finish_current_episode');
 assert.equal(expose(ctx,"Object.keys(World.storyRuns).length"),1);
 assert.deepEqual(JSON.parse(expose(ctx,"JSON.stringify(StorySystem.checkInvariants(World))")),[]);
});
test('successful check yields evidence, new branch, persistent archive and reward once',()=>{
 const ctx=ready('success');
 start(ctx,'quest_ward_petition');
 step(ctx);
 expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>.999});");
 const preview=action(ctx,"return StorySystem.currentView(World,{subject:S});");
 assert.equal(preview.type,'choice');
 assert.equal(preview.options[0].check.tn,9);
 const first=choose(ctx,0);
 assert.equal(first.applied,true);
 assert.equal(first.check.success,true);
 assert.equal(expose(ctx,"!!World.storyItems.ward_notice"),true);
 step(ctx);
 const proof=action(ctx,"return StorySystem.currentView(World,{subject:S}).options[0];");
 assert.equal(proof.available,true);
 assert.ok(proof.check.breakdown.some(x=>x.label==='GEAR / EVIDENCE'));
 const second=choose(ctx,0);
 assert.equal(second.applied,true);
 assert.equal(second.check.success,true);
 assert.equal(expose(ctx,"StorySystem.currentView(World).type"),'ending');
 const runId=expose(ctx,"StorySystem.liveRun(World).id");
 const before=expose(ctx,"RPG.meritOf(World,'subject')");
 const filed=action(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(runId)+",{year:World.year});");
 assert.equal(filed.applied,true);
 assert.equal(expose(ctx,"RPG.meritOf(World,'subject')"),before+20);
 assert.equal(action(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(runId)+",{year:World.year});").applied,false);
 assert.equal(expose(ctx,"RPG.meritOf(World,'subject')"),before+20);
 assert.equal(expose(ctx,"Object.values(World.storyArchive)[0].checkCount"),2);
 assert.deepEqual(JSON.parse(expose(ctx,"JSON.stringify(StorySystem.checkInvariants(World))")),[]);
});
test('failed 3d6 check follows authored setback and cannot reroll',()=>{
 const ctx=ready('failure');
 start(ctx,'quest_ward_petition');
 step(ctx);
 expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>0});");
 const first=choose(ctx,0);
 assert.equal(first.applied,true);
 assert.equal(first.check.success,false);
 assert.equal(first.check.rolls.join(','),'1,1,1');
 assert.equal(expose(ctx,"!!World.storyItems.ward_notice"),false);
 assert.equal(choose(ctx,0).applied,false);
 assert.equal(expose(ctx,"StorySystem.currentView(World).ending.id"),'ward_expired');
});
test('follow-up only appears after a completed previous quest in a subsequent year',()=>{
 const ctx=ready('follow');
 start(ctx,'quest_kitchen_table');
 step(ctx);
 const res=choose(ctx,1);
 assert.equal(res.applied,true);
 assert.equal(expose(ctx,"StorySystem.currentView(World).ending.id"),'care_clinic');
 const id=expose(ctx,"StorySystem.liveRun(World).id");
 action(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(id)+",{year:World.year});");
 assert.equal(action(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage});").some(q=>q.id==='quest_kitchen_return'),false);
 expose(ctx,"World.year+=1;");
 assert.equal(action(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage});").some(q=>q.id==='quest_kitchen_return'),true);
 assert.equal(start(ctx,'quest_kitchen_return').ok,true);
});
test('blocked gear-dependent option cannot consume a roll or mutate the story',()=>{
 const ctx=ready('blocked');
 start(ctx,'quest_ward_petition');
 step(ctx);
 expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>.999});");
 choose(ctx,0);
 step(ctx);
 expose(ctx,"delete World.storyItems.ward_notice;");
 const unavailable=action(ctx,"return StorySystem.currentView(World,{subject:S}).options[0];");
 assert.equal(unavailable.available,false);
 const before=expose(ctx,"StorySystem.liveRun(World).history.length");
 assert.equal(choose(ctx,0).applied,false);
 assert.equal(expose(ctx,"StorySystem.liveRun(World).history.length"),before);
});
test('core episodic stories remain unaffected by opt-in quest adapter',()=>{
 const ctx=ready('legacy');
 const other=action(ctx,"return StoryEpisodes.filter(e=>!e.quest).length;");
 assert.ok(other>5);
 assert.equal(action(ctx,"return StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage}).applied;"),true);
});
