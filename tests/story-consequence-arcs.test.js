'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
const MODULE='js/systems/story-consequence-arcs.js';
const IDS=['quest_reference_file','quest_reference_return','quest_grey_manifest','quest_grey_witness'];
function ready(seed='cross-arc'){
 const ctx=createWorldContext(),files=['js/systems/story-quests.js'];
 if(fs.existsSync(path.join(__dirname,'..',MODULE)))files.push(MODULE);
 files.push('js/systems/story-rpg-checks.js','js/systems/story-quest-engine.js');
 loadGameFiles(ctx,files);
 expose(ctx,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=28;S.alive=true;S.assets=600;S.health=80;S.happiness=62;S.mother.alive=true;"+
  "World.year=S.dob+S.age;StorySystem.ensure(World);");
 return ctx;
}
const run=(ctx,body)=>JSON.parse(expose(ctx,"JSON.stringify((function(){"+body+"})())"));
const step=ctx=>expose(ctx,"StorySystem.next(World,{year:World.year,subject:S,lineage:Lineage});");
const start=(ctx,id)=>run(ctx,"return StorySystem.startQuest(World,"+JSON.stringify(id)+",{subject:S,lineage:Lineage,year:World.year});");
const choose=(ctx,i)=>run(ctx,"return StorySystem.choose(World,"+i+",{year:World.year,subject:S,lineage:Lineage});");
function archive(ctx,id,ending,delta=-1){
 const js="(function(){const id='story-archive:test:'+Object.keys(World.storyArchive).length;"+
  "World.storyArchive[id]={id,episodeId:"+JSON.stringify(id)+",endingId:"+JSON.stringify(ending)+
  ",endingTitle:'Recorded',startedYear:World.year+"+delta+",resolvedYear:World.year+"+delta+
  ",quest:true};})();";
 expose(ctx,js);
}
function hire(ctx,withPeer=false){
 return run(ctx,"const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Riverside Works'});"+
  "const c=EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1370,occupationName:'Worker',jobTier:1});"+
  (withPeer?"const peer=NpcSystem.upsert(World,{id:'npc:940001',name:'Iona Marin',birthYear:World.year-29,locationId:World.activeSettlementId});"+
  "EmploymentSystem.hire(World,{personId:peer.id,businessId:b.id,annualSalary:1180,occupationName:'Worker',jobTier:1});":"")+
  "return {businessId:b.id,contractId:c.id,annualSalary:c.annualSalary"+(withPeer?",peerId:peer.id":"")+"};");
}
test('four connected career and underworld chapters register once without replacing existing episodes',()=>{
 const ctx=ready('register');
 const ids=run(ctx,"return StoryEpisodes.filter(e=>e.quest).map(e=>e.id);");
 assert.equal(ids.length,12,'eight existing quests plus four interconnected chapters');
 for(const id of IDS)assert.equal(ids.filter(x=>x===id).length,1,id);
 for(const id of ['quest_kitchen_table','quest_ward_petition','quest_night_market'])assert.ok(ids.includes(id));
});
test('career requires actual employment and earlier wage/civic history; crime requires night market archive',()=>{
 const ctx=ready('gating');
 const initial=run(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).map(q=>q.id)");
 assert.ok(!initial.includes('quest_reference_file'));
 assert.ok(!initial.includes('quest_grey_manifest'));
 hire(ctx);
 const onlyJob=run(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).map(q=>q.id)");
 assert.ok(!onlyJob.includes('quest_reference_file'));
 archive(ctx,'quest_wage_file','wages_restored');
 archive(ctx,'quest_night_market','market_profit');
 const now=run(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).map(q=>q.id)");
 assert.ok(now.includes('quest_reference_file'));
 assert.ok(now.includes('quest_grey_manifest'));
 assert.ok(!now.includes('quest_reference_return'));
 assert.ok(!now.includes('quest_grey_witness'));
});
test('career opening inherits actual wage and household histories; grey manifest inherits market and Ward outcomes',()=>{
 const ctx=ready('context');
 hire(ctx,true);
 archive(ctx,'quest_wage_file','wages_reprisals');
 archive(ctx,'quest_kitchen_table','care_recovered');
 archive(ctx,'quest_night_market','market_profit');
 archive(ctx,'quest_ward_petition','ward_reopened');
 const out=run(ctx,"const by=id=>{const def=StoryEpisodes.find(x=>x.id===id);const cast=def.cast(World,S,Lineage);"+
  "const map=cast.reduce((m,c)=>(m[c.key]=c,m),{});return def.build(map)};"+
  "const career=by('quest_reference_file'),crime=by('quest_grey_manifest');"+
  "return {careerText:career.scenes.open.lines[0].t,crimeText:crime.scenes.open.lines[0].t,"+
  "coworkerId:StoryEpisodes.find(x=>x.id==='quest_reference_file').cast(World,S,Lineage).find(x=>x.key==='coworker').bind,"+
  "bureauDifficulty:crime.scenes.open.choice.options[0].check.difficulty};");
 assert.match(out.careerText,/reprisal|complaint|Bureau|dispute/i);
 assert.match(out.careerText,/care|household|family/i);
 assert.match(out.crimeText,/profit|crate|vendor|shipment/i);
 assert.equal(out.coworkerId,'npc:940001');
 assert.equal(out.bureauDifficulty,'easy');
});
test('every cross-arc choice points to a real scene, including 3d6 fail-forward branches',()=>{
 const ctx=ready('graphs');
 hire(ctx);
 archive(ctx,'quest_wage_file','wages_restored');
 archive(ctx,'quest_night_market','market_safe');
 archive(ctx,'quest_reference_file','reference_raised');
 archive(ctx,'quest_grey_manifest','grey_reported');
 const report=run(ctx,"return StoryEpisodes.filter(e=>e.id.startsWith('quest_reference_')||e.id.startsWith('quest_grey_')).map(e=>{"+
  "const cast=e.cast(World,S,Lineage)||[];const bind=cast.reduce((o,x)=>(o[x.key]=x,o),{});const body=e.build(bind);"+
  "const scenes=body.scenes||{};let bad=[];Object.entries(scenes).forEach(([name,scene])=>(scene.choice&&scene.choice.options||[]).forEach((x,i)=>{"+
  "for(const next of [x.goto,x.check&&x.check.failGoto,x.check&&x.check.successGoto])"+
  "if(next&&!scenes[next])bad.push(name+':'+i+':'+next);}));"+
  "return {id:e.id,count:Object.keys(scenes).length,bad,options:scenes.open.choice.options.length};});");
 assert.equal(report.length,4);
 assert.ok(report.every(x=>x.count>=4&&x.options>=3&&x.bad.length===0),JSON.stringify(report));
});

