'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
function ready(seed='threads'){
 const c=createWorldContext();
 loadGameFiles(c,['js/systems/story-quests.js','js/systems/story-rpg-checks.js',
  'js/systems/rpg-progression.js','js/systems/story-quest-engine.js','js/systems/story-context.js','js/systems/story-social.js']);
 if(fs.existsSync('js/systems/story-threads.js'))loadGameFiles(c,['js/systems/story-threads.js']);
 expose(c,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=28;S.alive=true;S.health=80;S.happiness=65;S.assets=900;"+
  "World.year=S.dob+S.age;NpcSystem.syncLegacy(World,S,Lineage);StorySystem.ensure(World);"+
  "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Real Workshop'});"+
  "const npc=Object.values(World.npcs).find(n=>n.id!==S.npcId);npc.alive=true;"+
  "const archive=(ep,ending,context,social)=>{const id='story-archive:'+String(++World.storyArchiveCounter).padStart(5,'0');"+
  "World.storyArchive[id]={id,episodeId:ep,endingId:ending,title:'Previous chapter',"+
  "startedYear:World.year-2,resolvedYear:World.year-1,quest:true,context,social};};"+
  "archive('context_employer_old','context_setback',{family:'employer',businessId:b.id,settlementId:World.activeSettlementId},null);"+
  "archive('context_civic_old','context_help',{family:'civic',settlementId:World.activeSettlementId},null);"+
  "archive('social_older','social_betrayed',null,{npcId:npc.id,stance:'ally',year:World.year-1});"+
  "archive('quest_night_market','market_profit',null,null);"+
  "globalThis.threadFixture={businessId:b.id,npcId:npc.id};");
 return c;
}
const j=(c,s)=>JSON.parse(expose(c,'JSON.stringify((()=>{'+s+'})())'));
const leads=c=>j(c,"return StorySystem.availableQuests(World,{subject:S}).filter(q=>q.thread);");
const start=(c,q)=>j(c,"const a=StorySystem.startQuest(World,"+JSON.stringify(q.id)+",{subject:S,remainingEnergy:1,year:World.year});"+
 "if(a.ok)StorySystem.next(World,{subject:S,year:World.year});return a;");
const decide=(c,index)=>j(c,"return StorySystem.choose(World,"+index+",{subject:S,year:World.year});");
const file=c=>j(c,"return StorySystem.fileAway(World,StorySystem.liveRun(World).id,{year:World.year});");
test('two distinct cross-domain opportunities require actual archived employer+civic and family+underworld histories',()=>{
 const c=ready();
 const avail=leads(c);
 assert.deepEqual(avail.map(x=>x.family).sort(),['household','work']);
 assert.ok(avail.every(x=>x.energyCost===1));
 const context=j(c,"return StoryThreads.candidates(World,S)");
 assert.equal(context.find(x=>x.family==='work').businessId,expose(c,'threadFixture.businessId'));
 assert.equal(context.find(x=>x.family==='household').npcId,expose(c,'threadFixture.npcId'));
 expose(c,"Object.keys(World.storyArchive).forEach(id=>{if(World.storyArchive[id].context&&World.storyArchive[id].context.family==='civic')delete World.storyArchive[id];});");
 assert.ok(!leads(c).some(x=>x.family==='work'));
});
test('both first chapters are playable with exact 3d6 choice preview and guaranteed exit',()=>{
 for(const family of ['work','household']){
  const c=ready('intro-'+family),q=leads(c).find(x=>x.family===family);
  assert.equal(start(c,q).ok,true);
  const view=j(c,"return StorySystem.currentView(World,{subject:S});");
  assert.equal(view.options.length,3);
  assert.equal(view.options[2].check,null);
  assert.equal(view.options[2].available,true);
  assert.equal(view.options[0].check.outcomes,undefined); // compact StorySystem check preview
  assert.ok(view.options[0].check.percent>=0);
  assert.equal(decide(c,2).applied,true);
  assert.equal(file(c).applied,true);
  assert.equal(j(c,"return StorySystem.checkInvariants(World);").length,0);
 }
});
test('workplace-to-civic event cannot award fictitious wages, even after replacing employer',()=>{
 const c=ready('career-replace'),q=leads(c).find(x=>x.family==='work');
 const initial=j(c,"return {assets:S.assets,contracts:Object.keys(World.employmentContracts).length,business:World.businesses[threadFixture.businessId].id};");
 assert.equal(start(c,q).ok,true);
 expose(c,"WorldSimulation.streamFor=()=>({next:()=>.999});");
 assert.equal(decide(c,0).check.success,true);
 assert.equal(file(c).applied,true);
 const state=j(c,"return {assets:S.assets,contracts:Object.keys(World.employmentContracts).length,ending:Object.values(World.storyArchive).find(a=>a.episodeId.startsWith('thread_work_')).endingId};");
 assert.equal(state.assets,initial.assets);
 assert.equal(state.contracts,initial.contracts);
 assert.equal(state.ending,'thread_work_public');
});
test('household-to-underworld truth and concealment apply actual NPC memory without inventing a replacement',()=>{
 const c=ready('home-crime'),q=leads(c).find(x=>x.family==='household');
 start(c,q);
 expose(c,'WorldSimulation.streamFor=()=>({next:()=>.999});');
 assert.equal(decide(c,0).check.success,true);
 const state=j(c,"return {ending:StorySystem.currentView(World).ending.id,"+
  "mem:RelationshipMemory.forPerson(World,S.npcId,threadFixture.npcId).map(m=>({type:m.type,valence:m.valence}))};");
 assert.equal(state.ending,'thread_household_honest');
 assert.ok(state.mem.some(x=>x.valence>.5));
 assert.equal(file(c).applied,true);
});
test('two callbacks appear only next year, remember exact archived outcomes, and never repeat',()=>{
 for(const family of ['work','household']){
  const c=ready('echo-'+family),q=leads(c).find(x=>x.family===family);
  start(c,q);decide(c,2);
  const first=j(c,"return StorySystem.liveRun(World).id;");
  assert.equal(j(c,"return StorySystem.fileAway(World,"+JSON.stringify(first)+");").applied,true);
  assert.equal(leads(c).filter(x=>x.family===family).length,0);
  expose(c,'World.year++;S.age++;');
  const after=leads(c).find(x=>x.family===family);
  assert.ok(after&&after.followup);
  assert.match(after.title,/Return|Reply|Testimony/);
  start(c,after);decide(c,2);assert.equal(file(c).applied,true);
  assert.equal(j(c,"return StorySystem.fileAway(World,"+JSON.stringify(first)+");").applied,false);
  expose(c,'World.storyArchive={};World.year++;S.age++;');
  assert.equal(leads(c).filter(x=>x.family===family).length,0);
 }
});
test('missing or dead true NPC suppresses household threads and protects guaranteed exit',()=>{
 const c=ready('family-death'),q=leads(c).find(x=>x.family==='household');
 start(c,q);expose(c,'World.npcs[threadFixture.npcId].alive=false;');
 const v=j(c,'return StorySystem.currentView(World,{subject:S});');
 assert.equal(v.options[0].available,false);
 assert.equal(v.options[1].available,false);
 assert.equal(v.options[2].available,true);
 assert.equal(decide(c,0).applied,false);
 assert.equal(decide(c,2).applied,true);
 assert.equal(file(c).applied,true);
 assert.ok(!leads(c).some(x=>x.family==='household'));
});
test('stale year and zero-energy attempts cannot roll, create chapters or advance thread markers',()=>{
 const c=ready('stale'),q=leads(c).find(x=>x.family==='work');
 const blocked=j(c,"return StorySystem.startQuest(World,"+JSON.stringify(q.id)+",{subject:S,remainingEnergy:0});");
 assert.equal(blocked.reason,'no_energy');
 assert.equal(Number(expose(c,'Object.keys(World.storyRuns).length')),0);
 assert.equal(start(c,q).ok,true);
 expose(c,'World.year--;');
 assert.equal(decide(c,2).applied,false);
 expose(c,'World.year++;');
 assert.equal(decide(c,2).applied,true);
 expose(c,'World.year--;');
 assert.equal(file(c).applied,false);
});
test('repeated deterministic years and archive pruning never duplicate terminal thread stages',()=>{
 function run(){
  const c=ready('long-threads');
  for(const family of ['work','household']){
   for(let stage=0;stage<2;stage++){
    const q=leads(c).find(x=>x.family===family);
    assert.ok(q);
    start(c,q);assert.equal(decide(c,2).applied,true);assert.equal(file(c).applied,true);
    expose(c,'World.year++;S.age++;');
   }
  }
  expose(c,"for(let i=0;i<80;i++){World.year++;S.age++;}");
  assert.equal(leads(c).length,0);
  assert.deepEqual(j(c,"return StorySystem.checkInvariants(World);"),[]);
  return j(c,"return {stages:World.storyThreadStages,archive:World.storyArchive,merit:RPG.meritOf(World,'subject')};");
 }
 assert.deepEqual(run(),run());
});
test('new thread source is loaded after NPC, social and story engines but before Stories UI',()=>{
 const html=fs.readFileSync('life-game.html','utf8');
 const at=p=>html.indexOf('src="'+p);
 assert.ok(at('js/systems/story-threads.js')>at('js/systems/story-social.js'));
 assert.ok(at('js/systems/story-threads.js')>at('js/systems/npc-system.js'));
 assert.ok(at('js/systems/story-threads.js')<at('js/ui/story-quest-ui.js'));
});
