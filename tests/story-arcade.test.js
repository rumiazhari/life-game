'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function session(seed='arcade-1'){
  const ctx=createWorldContext();
  const elements={};
  const make=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    style:{},dataset:{},innerHTML:'',textContent:'',disabled:false,handlers:{},
    addEventListener(t,fn){this.handlers[t]=fn;},removeEventListener(){},
    appendChild(){},remove(){},focus(){},setAttribute(){},
    querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;}
  });
  ctx.document={
    querySelector(k){return elements[k]||(elements[k]=make());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=make());},
    createElement(){return make();},addEventListener(){},
    body:make(),documentElement:make()
  };
  ctx.addEventListener=()=>{};ctx.setTimeout=()=>0;ctx.clearTimeout=()=>{};
  ctx.setInterval=()=>0;ctx.clearInterval=()=>{};
  loadGameFiles(ctx,['js/systems/story-quests.js','js/systems/story-rpg-checks.js','js/systems/story-quest-engine.js','js/systems/world-gameplay.js','js/medical.js','js/ui.js','js/ui/story-quest-ui.js']);
  expose(ctx,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
    "S.age=30;S.alive=true;S.assets=600;S.health=85;S.happiness=65;S.jailUntil=0;World.year=S.dob+S.age;StorySystem.ensure(World);");
  return {ctx,elements};
}
function click(ctx,attribute,id){
  const expr="(function(){const b=document.getElementById('storySheet');"+
    "b.handlers.click({target:{closest:(selector)=>selector==='["+attribute+"]'?"+
    "{dataset:{"+(attribute==='data-qs-bg'?'qsBg':'qsPerk')+":"+JSON.stringify(id)+"}}:null}});})();";
  return expose(ctx,expr);
}
test('new subject chooses an existing RPG background once, with immediate check consequences',()=>{
  const {ctx}=session('arcade-background');
  expose(ctx,'renderStoryBoard()');
  let page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.match(page,/data-qs-bg="scholar"/);
  assert.match(page,/data-qs-bg="streets"/);
  const before=expose(ctx,"RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'study',difficulty:'hard'}).successes");
  click(ctx,'data-qs-bg','scholar');
  const after=expose(ctx,"RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'study',difficulty:'hard'}).successes");
  assert.equal(expose(ctx,"RPG.recordFor(World,'subject').background"),'scholar');
  assert.ok(after>before);
  page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.doesNotMatch(page,/data-qs-bg="streets"/);
  assert.equal(expose(ctx,"RPG.setBackground(World,'subject','streets').reason"),'set');
});
test('grade II offers exactly one eligible earned perk selection, never a second slot',()=>{
  const {ctx}=session('arcade-perk');
  expose(ctx,"RPG.addMerit(World,'subject',60,'setup',World.year);renderStoryBoard()");
  let page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.match(page,/data-qs-perk="silvertongue"/);
  const before=expose(ctx,"RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'social',difficulty:'hard'}).successes");
  click(ctx,'data-qs-perk','silvertongue');
  const after=expose(ctx,"RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'social',difficulty:'hard'}).successes");
  assert.ok(after>before);
  assert.equal(expose(ctx,"RPG.recordFor(World,'subject').perks.silvertongue"),true);
  page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.doesNotMatch(page,/data-qs-perk="ironstomach"/);
  assert.equal(expose(ctx,"RPG.unlockPerk(World,'subject','ironstomach').reason"),'slots');
});
test('existing character background survives old-state initialization',()=>{
  const {ctx}=session('arcade-legacy');
  expose(ctx,"RPG.setBackground(World,'subject','veteran');renderStoryBoard()");
  assert.equal(expose(ctx,"RPG.recordFor(World,'subject').background"),'veteran');
  assert.doesNotMatch(expose(ctx,"document.getElementById('storySheet').innerHTML"),/data-qs-bg="/);
});


test('wage chapter preflights annual energy before creating a persistent story run',()=>{
  const {ctx}=session('arcade-energy');
  expose(ctx,"const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Workshop'});"+
    "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1200,occupationName:'Worker',jobTier:1});");
  const data=JSON.parse(expose(ctx,"JSON.stringify((function(){"+
    "const lead=StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).find(q=>q.id==='quest_wage_file');"+
    "const before=World.storyCounter;"+
    "const blocked=StorySystem.startQuest(World,'quest_wage_file',{subject:S,lineage:Lineage,year:World.year,remainingEnergy:0});"+
    "return {lead,blocked,before,after:World.storyCounter,runs:Object.keys(World.storyRuns).length};})())"));
  assert.equal(data.lead.energyCost,1);
  assert.equal(data.blocked.reason,'no_energy');
  assert.equal(data.before,data.after);
  assert.equal(data.runs,0);
  assert.equal(expose(ctx,"StorySystem.startQuest(World,'quest_wage_file',{subject:S,lineage:Lineage,year:World.year,remainingEnergy:1}).ok"),true);
  assert.equal(expose(ctx,"StorySystem.startQuest(World,'quest_wage_file',{subject:S,lineage:Lineage,year:World.year,remainingEnergy:1}).reason"),'finish_current_episode');
});
test('successful story card start consumes the same energy budget as routine actions',()=>{
  const {ctx}=session('arcade-card-energy');
  expose(ctx,"const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Foundry'});"+
    "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1300,occupationName:'Worker',jobTier:1});"+
    "openStorySlip=function(){};renderStoryBoard();");
  const before=expose(ctx,'energyUsed()');
  const page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.match(page,/data-qs-start="quest_wage_file"/);
  assert.match(page,/1 ENERGY/);
  expose(ctx,"document.getElementById('storySheet').handlers.click({target:{closest:function(sel){"+
    "return sel==='[data-qs-start]'?{disabled:false,dataset:{qsStart:'quest_wage_file'}}:null;}}});");
  assert.equal(expose(ctx,'energyUsed()'),before+1);
  assert.equal(expose(ctx,'Object.keys(World.storyRuns).length'),1);
  assert.equal(expose(ctx,"doneActionsThisYear().filter(x=>x.startsWith('story-chapter:')).length"),1);
});
test('a detained player cannot start a wage story with zero discretionary energy',()=>{
  const {ctx}=session('arcade-custody');
  expose(ctx,"const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Workshop'});"+
    "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1300,occupationName:'Worker',jobTier:1});"+
    "S.jailUntil=S.age+1;renderStoryBoard();");
  const page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.match(page,/data-qs-start="quest_wage_file" disabled/);
  assert.equal(expose(ctx,'Object.keys(World.storyRuns).length'),0);
});


test('wage restoration changes the original employment contract and records the actual coworker',()=>{
  const {ctx}=session('arcade-worker-memory');
  const out=JSON.parse(expose(ctx,"JSON.stringify((function(){"+
    "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'manufacturing',name:'Foundry A'});"+
    "const peer=NpcSystem.upsert(World,{id:'npc:830001',firstName:'Mira',lastName:'Tor',birthYear:World.year-25,locationId:World.activeSettlementId});"+
    "const me=EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1450,occupationName:'Worker',jobTier:1});const beforeSalary=me.annualSalary;"+
    "EmploymentSystem.hire(World,{personId:peer.id,businessId:b.id,annualSalary:1100,occupationName:'Worker',jobTier:1});"+
    "StorySystem.startQuest(World,'quest_wage_file',{subject:S,lineage:Lineage,year:World.year});"+
    "const run=StorySystem.liveRun(World);"+
    "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
    "WorldSimulation.streamFor=()=>({next:()=>.999});"+
    "StorySystem.choose(World,0,{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.choose(World,0,{subject:S,lineage:Lineage,year:World.year});"+
    "const changed=EmploymentSystem.activeForPerson(World,'subject')[0];"+
    "const participants=Object.values(World.relationshipMemories||{}).flatMap(m=>m.participants);"+
    "return {before:beforeSalary,after:changed.annualSalary,peer:peer.id,participants,ending:StorySystem.currentView(World).ending.id};})())"));
  assert.equal(out.ending,'wages_restored');
  assert.equal(out.after,out.before+260);
  assert.ok(out.participants.includes(out.peer),'coworker memory must reference the stable NPC');
});
test('changing employer mid-case never raises the new contract or awards imaginary cash',()=>{
  const {ctx}=session('arcade-switch');
  const out=JSON.parse(expose(ctx,"JSON.stringify((function(){"+
    "const a=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'First Workshop'});"+
    "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Second Workshop'});"+
    "EmploymentSystem.hire(World,{personId:'subject',businessId:a.id,annualSalary:1250,occupationName:'Worker',jobTier:1});"+
    "StorySystem.startQuest(World,'quest_wage_file',{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
    "WorldSimulation.streamFor=()=>({next:()=>.999});"+
    "StorySystem.choose(World,1,{subject:S,lineage:Lineage,year:World.year});"+
    "const old=EmploymentSystem.activeForPerson(World,'subject')[0];"+
    "EmploymentSystem.end(World,old.id,'terminated','switched',World.year,{subject:S});"+
    "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1700,occupationName:'Clerk',jobTier:1});"+
    "const before=EmploymentSystem.activeForPerson(World,'subject')[0].annualSalary,assets=S.assets;"+
    "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.choose(World,0,{subject:S,lineage:Lineage,year:World.year});"+
    "return {before,after:EmploymentSystem.activeForPerson(World,'subject')[0].annualSalary,assets,cash:S.assets,ending:StorySystem.currentView(World).ending.id};})())"));
  assert.equal(out.ending,'wages_compromise');
  assert.equal(out.after,out.before,'raise must not jump to replacement employer');
  assert.equal(out.cash,out.assets,'wage raise is not direct cash/arrears');
});


test('completed wage chapter awards sixty merit once and unlocks an existing grade-II perk',()=>{
  const {ctx}=session('arcade-wage-reward');
  const r=JSON.parse(expose(ctx,"JSON.stringify((function(){"+
    "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Wage Works'});"+
    "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1300,occupationName:'Worker',jobTier:1});"+
    "const begin=StorySystem.startQuest(World,'quest_wage_file',{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
    "WorldSimulation.streamFor=()=>({next:()=>.999});"+
    "StorySystem.choose(World,1,{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.choose(World,0,{subject:S,lineage:Lineage,year:World.year});"+
    "const before=RPG.meritOf(World,'subject');"+
    "const first=StorySystem.fileAway(World,begin.runId,{year:World.year});"+
    "const second=StorySystem.fileAway(World,begin.runId,{year:World.year});"+
    "const now=StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).some(q=>q.id==='quest_wage_aftermath');"+
    "const perk=RPG.unlockPerk(World,'subject','silvertongue');"+
    "World.year++;"+
    "const later=StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).some(q=>q.id==='quest_wage_aftermath');"+
    "return {before,first:first.applied,second:second.applied,merit:RPG.meritOf(World,'subject'),grade:RPG.gradeOf(World,'subject'),perk,now,later};})())"));
  assert.equal(r.first,true);
  assert.equal(r.second,false);
  assert.equal(r.merit-r.before,60);
  assert.equal(r.grade,2);
  assert.equal(r.perk.ok,true);
  assert.equal(r.now,false);
  assert.equal(r.later,true);
});
test('unfinished wage story cannot be filed early for an unearned RPG reward',()=>{
  const {ctx}=session('arcade-no-early-file');
  const r=JSON.parse(expose(ctx,"JSON.stringify((function(){"+
    "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Workshop'});"+
    "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1300,occupationName:'Worker',jobTier:1});"+
    "const start=StorySystem.startQuest(World,'quest_wage_file',{subject:S,lineage:Lineage,year:World.year});"+
    "const out=StorySystem.fileAway(World,start.runId,{year:World.year});"+
    "return {out,merit:RPG.meritOf(World,'subject'),status:World.storyRuns[start.runId].status};})())"));
  assert.equal(r.out.applied,false);
  assert.equal(r.merit,0);
  assert.equal(r.status,'playing');
});
test('failed wage route still gives the same chapter reward and a later playable callback',()=>{
  const {ctx}=session('arcade-failed-route');
  const r=JSON.parse(expose(ctx,"JSON.stringify((function(){"+
    "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Workshop'});"+
    "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1400,occupationName:'Worker',jobTier:1});"+
    "const start=StorySystem.startQuest(World,'quest_wage_file',{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
    "WorldSimulation.streamFor=()=>({next:()=>0});"+
    "StorySystem.choose(World,0,{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
    "StorySystem.choose(World,1,{subject:S,lineage:Lineage,year:World.year});"+
    "const ending=StorySystem.currentView(World).ending.id;"+
    "StorySystem.fileAway(World,start.runId,{year:World.year});World.year++;"+
    "return {ending,merit:RPG.meritOf(World,'subject'),followup:StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).some(q=>q.id==='quest_wage_aftermath')};})())"));
  assert.equal(r.ending,'wages_quiet');
  assert.equal(r.merit,60);
  assert.equal(r.followup,true);
});

