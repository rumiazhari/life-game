'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
function ready(seed='social'){
 const c=createWorldContext();
 loadGameFiles(c,['js/systems/story-quests.js','js/systems/story-rpg-checks.js','js/systems/story-quest-engine.js','js/systems/story-context.js']);
 if(fs.existsSync('js/systems/story-social.js'))loadGameFiles(c,['js/systems/story-social.js']);
 expose(c,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();S.age=28;S.alive=true;World.year=S.dob+S.age;NpcSystem.syncLegacy(World,S,Lineage);StorySystem.ensure(World);");
 return c;
}
const j=(c,s)=>JSON.parse(expose(c,'JSON.stringify((()=>{'+s+'})())'));
const leads=c=>j(c,"return StorySystem.availableQuests(World,{subject:S}).filter(q=>q.social);");
function choose(c,i,opts={}){
 return j(c,"return StorySystem.choose(World,"+i+",{subject:S,year:World.year});");
}
function begin(c,q){
 return j(c,"const a=StorySystem.startQuest(World,"+JSON.stringify(q.id)+",{subject:S,remainingEnergy:1});if(a.ok)StorySystem.next(World,{subject:S});return a;");
}
test('real connected NPC exposes contextual social episode with rival and ally variants',()=>{
 const c=ready('rival');
 const out=j(c,"const mother=Object.values(World.npcs).find(n=>n.id.includes(':mother:'));"+
  "const father=Object.values(World.npcs).find(n=>n.id.includes(':father:'));"+
  "const k=String(S.npcId);NpcSystem.relationship(mother,k).trust=15;"+
  "NpcSystem.relationship(mother,k).conflict=85;NpcSystem.relationship(father,k).trust=85;"+
  "return {motherId:mother.id,leads:StorySocial.candidates(World,S)};");
 assert.ok(out.leads.length>=1);
 assert.equal(out.leads[0].npcId,out.motherId);
 assert.equal(out.leads[0].stance,'rival');
 const available=leads(c);
 assert.equal(available.length,1);
 assert.match(available[0].title,/Rival|Reckoning|Trust/);
 const start=begin(c,available[0]);assert.equal(start.ok,true);
 const view=j(c,'return StorySystem.currentView(World,{subject:S});');
 assert.equal(view.options.length,3);
 assert.equal(view.options[2].check,null);
 assert.equal(view.options[2].available,true);
});
test('successful reconciliation modifies only a real NPC bond and canonical memory',()=>{
 const c=ready('reconcile');
 const q=leads(c)[0];const before=j(c,'return {id:StorySocial.candidates(World,S)[0].npcId,year:World.year};');
 const start=begin(c,q);assert.equal(start.ok,true);
 expose(c,'WorldSimulation.streamFor=()=>({next:()=>.999});');
 const result=choose(c,0);assert.equal(result.applied,true);assert.equal(result.check.success,true);
 const out=j(c,"const npc=World.npcs["+JSON.stringify(before.id)+"];const rel=npc.relationships[String(S.npcId)];"+
  "return {ending:StorySystem.currentView(World).ending.id,closeness:rel.closeness,"+
  "memories:RelationshipMemory.forPerson(World,S.npcId,npc.id).map(m=>({valence:m.valence,type:m.type}))};");
 assert.equal(out.ending,'social_reconciled');
 assert.ok(out.memories.some(m=>m.valence>0.5));
 const id=expose(c,'StorySystem.liveRun(World).id');
 assert.equal(j(c,'return StorySystem.fileAway(World,'+JSON.stringify(id)+',{year:World.year});').applied,true);
 assert.equal(j(c,'return StorySystem.fileAway(World,'+JSON.stringify(id)+',{year:World.year});').applied,false);
 assert.ok(!leads(c).length);
 expose(c,'World.year++;S.age++;');
 assert.equal(leads(c)[0].followup,true);
 assert.equal(leads(c)[0].personId,before.id);
});
test('failure records rivalry and fail-forwards without reroll or duplicated effects',()=>{
 const c=ready('failed');const lead=leads(c)[0];begin(c,lead);
 expose(c,'WorldSimulation.streamFor=()=>({next:()=>0});');
 const one=choose(c,0);assert.equal(one.check.success,false);
 assert.equal(j(c,'return StorySystem.currentView(World).ending.id;'),'social_rebuffed');
 assert.equal(choose(c,0).applied,false);
 assert.ok(j(c,'return RelationshipMemory.forPerson(World,S.npcId,StorySystem.liveRun(World).social.npcId).some(m=>m.valence<0);'));
});
test('dead or departed NPC cannot receive a bond effect, but a guaranteed exit survives',()=>{
 const c=ready('death');const q=leads(c)[0];begin(c,q);
 expose(c,'World.npcs[StorySystem.liveRun(World).social.npcId].alive=false;');
 const v=j(c,'return StorySystem.currentView(World,{subject:S});');
 assert.equal(v.options[0].available,false);
 assert.equal(v.options[1].available,false);
 assert.equal(v.options[2].available,true);
 assert.equal(choose(c,0).applied,false);
 assert.equal(choose(c,2).applied,true);
});
test('save/load and annual continuation are deterministic and archive remains bounded',()=>{
 function play(){const c=ready('long-social');expose(c,"const n=Object.values(World.npcs).find(n=>n.id!==S.npcId);n.alive=true;");for(let y=0;y<65;y++){
  const q=leads(c)[0];assert.ok(q,'missing year '+y);
  begin(c,q);const response=choose(c,2);assert.equal(response.applied,true);
  const runId=expose(c,'StorySystem.liveRun(World).id');
  assert.equal(j(c,'return StorySystem.fileAway(World,'+JSON.stringify(runId)+',{year:World.year});').applied,true);
  expose(c,'World.year++;S.age++;');
 }assert.ok(Number(expose(c,'Object.keys(World.storyArchive).length'))<=64);
 assert.deepEqual(j(c,'return StorySystem.checkInvariants(World);'),[]);
 return j(c,'return {socialYear:World.storySocialYear,archive:World.storyArchive,merit:RPG.meritOf(World,"subject")};');}
 assert.deepEqual(play(),play());
});
test('no real relationship means no social story and no fabricated NPCs',()=>{
 const c=ready('absent');
 expose(c,"Object.values(World.npcs).forEach(n=>{if(n.id!==S.npcId)n.alive=false;});");
 assert.equal(leads(c).length,0);
 assert.equal(j(c,"return StorySocial.candidates(World,S).length;"),0);
});

test('browser loads social layer after NPC and relationship authorities but before UI',()=>{
 const html=fs.readFileSync('life-game.html','utf8');
 const at=file=>html.indexOf('src="'+file);
 assert.ok(at('js/systems/story-social.js')>at('js/systems/npc-system.js'));
 assert.ok(at('js/systems/story-social.js')>at('js/systems/relationship-memory.js'));
 assert.ok(at('js/systems/story-social.js')<at('js/ui/story-quest-ui.js'));
});
test('a social chapter costs the existing energy and cannot be started twice in the year',()=>{
 const c=ready('energy'),q=leads(c)[0];assert.ok(q);
 assert.equal(j(c,"return StorySystem.startQuest(World,"+JSON.stringify(q.id)+",{subject:S,remainingEnergy:0});").reason,'no_energy');
 assert.equal(Number(expose(c,'Object.keys(World.storyRuns).length')),0);
 assert.equal(begin(c,q).ok,true);
 assert.equal(j(c,"return StorySystem.startQuest(World,"+JSON.stringify(q.id)+",{subject:S,remainingEnergy:1});").ok,false);
 assert.equal(choose(c,2).applied,true);
 const id=expose(c,'StorySystem.liveRun(World).id');
 assert.equal(j(c,'return StorySystem.fileAway(World,'+JSON.stringify(id)+');').applied,true);
 assert.ok(!leads(c).length);
});
test('reload of a half-completed social story retains person and 3d6 choice outcome',()=>{
 const c=ready('persist'),q=leads(c)[0];begin(c,q);
 const before=expose(c,'JSON.stringify(World)');
 function act(){
  expose(c,'WorldSimulation.streamFor=()=>({next:()=>.999});');
  return j(c,"const yes=StorySystem.choose(World,0,{subject:S});const id=StorySystem.liveRun(World).id;const target=StorySystem.liveRun(World).social.npcId;"+
   "const no=StorySystem.fileAway(World,id,{year:World.year});return {yes,no,memories:RelationshipMemory.forPerson(World,S.npcId,target).map(m=>m.type),merit:RPG.meritOf(World,'subject')};");
 }
 const one=act();
 expose(c,'World=JSON.parse('+JSON.stringify(before)+');');
 assert.deepEqual(act(),one);
});
