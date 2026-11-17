'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
function session(seed='recovery'){
 const c=createWorldContext();
 loadGameFiles(c,['js/systems/story-quests.js','js/systems/story-consequence-arcs.js',
  'js/systems/story-rpg-checks.js','js/systems/rpg-progression.js','js/systems/story-quest-engine.js',
  'js/systems/story-context.js','js/systems/story-social.js','js/systems/story-threads.js']);
 if(fs.existsSync('js/systems/life-file-save.js'))loadGameFiles(c,['js/systems/life-file-save.js']);
 expose(c,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=28;S.alive=true;S.assets=800;S.health=82;World.year=S.dob+S.age;"+
  "NpcSystem.syncLegacy(World,S,Lineage);StorySystem.ensure(World);"+
  "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Current Job'});"+
  "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1450,occupationName:'Worker',jobTier:2});"+
  "S.__doneActions={[World.year]:['story-chapter:story:00001']};followups=[{at:S.age+2,t:'A scheduled reminder',fx:{happiness:1}}];");
 return c;
}
const j=(c,s)=>JSON.parse(expose(c,'JSON.stringify((()=>{'+s+'})())'));
const snap='({world:World,subject:S,lineage:Lineage,hold:Hold,followups})';
test('canonical active file exports reproducibly without mutation or external storage',()=>{
 const c=session();
 const result=j(c,"const before=JSON.stringify("+snap+");"+
  "const first=LifeFileSave.encode("+snap+");const second=LifeFileSave.encode("+snap+");"+
  "return {same:first.text===second.text,checksum:first.checksum,size:first.bytes,"+
  "valid:LifeFileSave.decode(first.text).ok,unchanged:JSON.stringify("+snap+")===before};");
 assert.equal(result.same,true);
 assert.equal(result.valid,true);
 assert.equal(result.unchanged,true);
 assert.match(result.checksum,/^[0-9a-f]{8}$/);
 assert.ok(result.size>1000&&result.size<20*1024*1024);
});
test('unsupported/corrupt/malformed/oversized files reject atomically and return reasons',()=>{
 const c=session();
 const result=j(c,"const saved=LifeFileSave.encode("+snap+").text;"+
  "const changed=saved.replace('Current Job','Counterfeit Job');"+
  "const badSchema=JSON.stringify(Object.assign(JSON.parse(saved),{schema:'unknown-v2'}));"+
  "const before=JSON.stringify(World);"+
  "return {corrupt:LifeFileSave.decode(changed),schema:LifeFileSave.decode(badSchema),"+
  "malformed:LifeFileSave.decode('{broken'),big:LifeFileSave.decode('x'.repeat(21*1024*1024)),unchanged:before===JSON.stringify(World)};");
 assert.equal(result.corrupt.ok,false);
 assert.equal(result.schema.ok,false);
 assert.equal(result.malformed.ok,false);
 assert.equal(result.big.ok,false);
 assert.equal(result.unchanged,true);
});
test('tampered saved world year, missing person link or malformed payload is rejected before restore',()=>{
 const c=session();
 const result=j(c,"const saved=LifeFileSave.encode("+snap+");"+
  "const bad={world:JSON.parse(JSON.stringify(World)),subject:JSON.parse(JSON.stringify(S)),"+
  "lineage:Lineage,hold:Hold,followups};bad.subject.age+=5;"+
  "const oldAge=LifeFileSave.encode(bad);bad.subject.age-=5;bad.subject.npcId='npc:imaginary';"+
  "const missingPerson=LifeFileSave.encode(bad);"+
  "return {age:oldAge,person:missingPerson};");
 assert.equal(result.age.ok,false);
 assert.equal(result.person.ok,false);
});
test('prepared imported file preserves active StorySystem run, RNG, NPC and employment after migrations',()=>{
 const c=session('persist-story');
 const result=j(c,"const q=StorySystem.availableQuests(World,{subject:S}).find(q=>q.id==='quest_kitchen_table');"+
  "const started=StorySystem.startQuest(World,q.id,{subject:S,remainingEnergy:3,year:World.year});"+
  "if(started.ok)StorySystem.next(World,{subject:S,year:World.year});"+
  "const output=LifeFileSave.encode("+snap+");const restored=LifeFileSave.prepare(output.text);"+
  "const savedRun=Object.values(restored.snapshot.world.storyRuns)[0];"+
  "return {ok:restored.ok,scene:savedRun.sceneId,runs:Object.keys(restored.snapshot.world.storyRuns).length,"+
  "year:restored.snapshot.world.year,age:restored.snapshot.subject.age,"+
  "followups:restored.snapshot.followups.length,energy:restored.snapshot.subject.__doneActions[World.year].length,"+
  "contracts:Object.keys(restored.snapshot.world.employmentContracts).length};");
 assert.equal(result.ok,true);
 assert.equal(result.scene,'open');
 assert.equal(result.runs,1);
 assert.equal(result.followups,1);
 assert.equal(result.energy,1);
 assert.equal(result.contracts,1);
 assert.equal(result.year-result.age,Number(expose(c,'S.dob')));
});
test('importing a live chapter after a brand-new life resumes its exact previous 3d6 path, once only',()=>{
 const c=session('restore-quest');
 const before=j(c,"const q=StorySystem.availableQuests(World,{subject:S}).find(x=>x.id==='quest_kitchen_table');"+
  "const a=StorySystem.startQuest(World,q.id,{subject:S,remainingEnergy:2});StorySystem.next(World,{subject:S});"+
  "const data=LifeFileSave.encode("+snap+").text;"+
  "const oldSeed=World.seed;const run=StorySystem.liveRun(World).id;"+
  "newWorld();newLineage();newHold();newSubject();const fresh=World.seed;"+
  "const ready=LifeFileSave.prepare(data);"+
  "if(!ready.ok)throw new Error(ready.reason);"+
  "({world:World,subject:S,lineage:Lineage,hold:Hold,followups}=ready.snapshot);"+
  "return {oldSeed,fresh,after:World.seed,run,restored:StorySystem.liveRun(World).id};");
 assert.equal(before.after,before.oldSeed);
 assert.equal(before.restored,before.run);
 const result=j(c,"let steps=0;while(steps++<16){const v=StorySystem.currentView(World,{subject:S});"+
  "if(v.type==='ending')break;if(v.type==='choice')StorySystem.choose(World,v.options[v.options.length-1].index,{subject:S});"+
  "else StorySystem.next(World,{subject:S});}"+
  "const view=StorySystem.currentView(World,{subject:S});const meritBefore=RPG.meritOf(World,'subject');"+
  "const r=StorySystem.fileAway(World,view.runId,{year:World.year});"+
  "const second=StorySystem.fileAway(World,view.runId,{year:World.year});"+
  "return {ending:view.type,filed:r.applied,twice:second.applied,merit:RPG.meritOf(World,'subject')-meritBefore,"+
  "invariants:StorySystem.checkInvariants(World)};");
 assert.equal(result.ending,'ending');
 assert.equal(result.filed,true);
 assert.equal(result.twice,false);
 assert.equal(result.merit,20);
 assert.deepEqual(result.invariants,[]);
});
test('saved file can be re-decoded/prepared repeatedly without extra world migration or merit',()=>{
 const c=session('migrations');
 const result=j(c,"const f=LifeFileSave.encode("+snap+").text;"+
  "const first=LifeFileSave.prepare(f);const second=LifeFileSave.prepare(f);"+
  "const r=first.snapshot;const before=JSON.stringify(r.world);"+
  "WorldSimulation.migrate(r.world,{subject:r.subject});NpcSystem.migrate(r.world,r.subject,r.lineage);"+
  "StorySystem.ensure(r.world);"+
  "return {same:JSON.stringify(first.snapshot)===JSON.stringify(second.snapshot),"+
  "afterSame:before===JSON.stringify(r.world),merit:RPG.meritOf(r.world,'subject')};");
 assert.equal(result.same,true);
 assert.equal(result.afterSame,true);
 assert.equal(result.merit,0);
});
test('live browser entrypoint declares save engine and player import/export controls',()=>{
 const html=fs.readFileSync('life-game.html','utf8');
 assert.ok(html.indexOf('js/systems/life-file-save.js')>html.indexOf('js/systems/story-threads.js'));
 assert.ok(html.indexOf('js/systems/life-file-save.js')<html.indexOf('js/ui/story-quest-ui.js'));
 const ui=fs.readFileSync('js/ui/story-quest-ui.js','utf8');
 assert.match(ui,/data-qs-save-export/);
 assert.match(ui,/data-qs-save-import/);
 const main=fs.readFileSync('js/main.js','utf8');
 assert.match(main,/restoreLifeFileSnapshot/);
});

test('ongoing visual-novel story exposes a direct local-save action without exiting the scene',()=>{
 const ui=fs.readFileSync('js/ui.js','utf8');
 assert.match(ui,/data-vn="backup"/);
 assert.match(ui,/exportLifeFileBackup/);
 const story=fs.readFileSync('js/ui/story-quest-ui.js','utf8');
 assert.match(story,/root\.exportLifeFileBackup=exportSaveFile/);
});
