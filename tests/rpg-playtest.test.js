'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
const fs=require('node:fs'),path=require('node:path');
const modulePath='js/systems/rpg-playtest.js';
const files=['js/systems/story-quests.js','js/systems/story-consequence-arcs.js',
 'js/systems/story-rpg-checks.js','js/systems/story-quest-engine.js'];
if(fs.existsSync(path.join(__dirname,'..',modulePath)))files.push(modulePath);
function scenario(seed='phase4-agency'){
 const ctx=createWorldContext();
 loadGameFiles(ctx,files);
 expose(ctx,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=28;S.alive=true;S.mother.alive=true;S.assets=600;S.health=80;S.happiness=66;"+
  "World.year=S.dob+S.age;StorySystem.ensure(World);"+
  "const firm=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'QA Shop'});"+
  "EmploymentSystem.hire(World,{personId:'subject',businessId:firm.id,annualSalary:1400,occupationName:'Worker',jobTier:1});"+
  "for(const [id,ending] of [['quest_wage_file','wages_restored'],['quest_kitchen_table','care_recovered'],"+
  "['quest_ward_petition','ward_reopened'],['quest_school_press','press_published'],"+
  "['quest_night_market','market_profit'],['quest_reference_file','reference_raised'],['quest_grey_manifest','grey_reported']]){"+
  "World.storyArchive['qa:'+id]={episodeId:id,endingId:ending,resolvedYear:World.year-1,startedYear:World.year-2,quest:true};}");
 return ctx;
}
const run=(ctx,js)=>JSON.parse(expose(ctx,'JSON.stringify((function(){'+js+'})())'));
test('all twelve opt-in quests have an unconditional no-dice, no-fee opening alternative',()=>{
 const ctx=scenario('opening-agency');
 const rows=run(ctx,"return StoryEpisodes.filter(e=>e.quest).map(e=>{"+
  "const cast=e.cast?e.cast(World,S,Lineage):[];const map=Array.isArray(cast)?cast.reduce((m,x)=>(m[x.key]=x,m),{}):cast;"+
  "const body=e.build(map);const scene=body.scenes[body.startScene||'open'];"+
  "const choices=scene.choice&&scene.choice.options||[];return {id:e.id,choices:choices.length,"+
  "optouts:choices.filter(x=>!x.check&&!x.require&&!((x.effects||[]).some(y=>y.kind==='money'&&y.delta<0))).length};});");
 assert.equal(rows.length,12);
 assert.ok(rows.every(r=>r.optouts>=1),JSON.stringify(rows.filter(r=>r.optouts<1)));
});
test('five formerly forced 3d6 openings expose one appended no-roll route without changing existing options',()=>{
 const ctx=scenario('old-indices');
 const expectations={
  quest_wage_file:['Copy the accounts','Negotiate directly','Organize the workers'],
  quest_kitchen_table:['Take charge of care','Pay the clinic','Ask neighbors for help'],
  quest_ward_petition:['Examine the legal notice','Rally the neighborhood','Seek a private exemption'],
  quest_school_press:['Write the editorial','Persuade the headmaster','Print anonymously'],
  quest_night_market:['Inspect the crate','Buy immediately','Walk away and report it']
 };
 const rows=run(ctx,"return "+JSON.stringify(Object.keys(expectations))+".map(id=>{const e=StoryEpisodes.find(x=>x.id===id);"+
  "const raw=e.cast?e.cast(World,S,Lineage):[];const bind=raw.reduce((a,c)=>(a[c.key]=c,a),{});"+
  "const o=e.build(bind).scenes.open.choice.options;return {id,options:o.map(x=>({title:x.t,roll:!!x.check,fee:!!x.require,goto:x.goto}))};});");
 for(const {id,options} of rows){
  assert.deepEqual(options.slice(0,3).map(x=>x.title),expectations[id]);
  assert.equal(options.length,4,id);
  assert.equal(options[3].roll,false,id);
  assert.equal(options[3].fee,false,id);
  assert.ok(options[3].goto,id);
 }
});
test('low-budget night-market and family stories can withdraw without gambling or a payment',()=>{
 for(const [id,asset,expected] of [['quest_night_market',25,'market_safe'],['quest_kitchen_table',0,'care_overwork']]){
  const ctx=scenario('low-budget-'+id);
  const result=run(ctx,"S.assets="+asset+";delete World.storyArchive['qa:'+ "+JSON.stringify(id)+"];const started=StorySystem.startQuest(World,"+JSON.stringify(id)+
   ",{subject:S,lineage:Lineage,year:World.year});"+
   "StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});"+
   "const view=StorySystem.currentView(World,{subject:S});"+
   "const choice=view.options[3];const before=S.assets;"+
   "const done=StorySystem.choose(World,3,{subject:S,lineage:Lineage,year:World.year});"+
   "return {started,choice,done,ending:StorySystem.currentView(World).ending.id,assets:S.assets,before};");
  assert.equal(result.started.ok,true,id);
  assert.equal(result.choice.available,true,id);
  assert.equal(result.choice.check,null,id);
  assert.equal(result.done.applied,true,id);
  assert.equal(result.ending,expected,id);
  assert.equal(result.assets,result.before,id);
 }
});

test('read-only playtest snapshot distinguishes known rolls, zero rolls and unknown historical roll counts',()=>{
 const ctx=scenario('playtest-snapshot');
 const result=run(ctx,"const base=World.storyArchive;"+
  "World.storyArchive={a:{quest:true,episodeId:'quest_wage_file',checkCount:2,endingId:'wages_restored',resolvedYear:World.year-1},"+
  "b:{quest:true,episodeId:'quest_ward_petition',checkCount:0,endingId:'ward_expired',resolvedYear:World.year-2},"+
  "c:{quest:true,episodeId:'quest_night_market',endingId:'market_safe',resolvedYear:World.year-3},"+
  "d:{quest:false,episodeId:'ep_nonquest',checkCount:7}};"+
  "const before=JSON.stringify(World),snapshot=RPGPlaytest.snapshot(World,S,{availableLeads:5,energyUsed:2,energyTotal:4});"+
  "return {snapshot,mutated:JSON.stringify(World)!==before};");
 assert.equal(result.mutated,false,'telemetry must not modify game save');
 assert.equal(result.snapshot.scope,'retained_archive');
 assert.equal(result.snapshot.archivedChapters,3);
 assert.equal(result.snapshot.documentedChecks,2);
 assert.equal(result.snapshot.unknownCheckArchives,1);
 assert.equal(result.snapshot.zeroCheckArchives,1);
 assert.equal(result.snapshot.availableLeads,5);
 assert.equal(result.snapshot.energyUsed,2);
 assert.equal(result.snapshot.energyTotal,4);
 assert.equal(result.snapshot.arcs.WORK,1);
 assert.equal(result.snapshot.arcs.BUREAU,1);
 assert.equal(result.snapshot.arcs.TRADE,1);
});
test('three voluntary formative scores accept only integers 1–5 and can be reset without game-state writes',()=>{
 const ctx=scenario('ratings');
 const data=run(ctx,"const before=JSON.stringify(World);RPGPlaytest.reset();"+
  "const invalid=[RPGPlaytest.rate('enjoyment',0),RPGPlaytest.rate('agency',9),RPGPlaytest.rate('clarity',1.5),"+
  "RPGPlaytest.rate('invalid',3),RPGPlaytest.rate('agency',false)];"+
  "const valid=[RPGPlaytest.rate('enjoyment',4),RPGPlaytest.rate('agency','5'),RPGPlaytest.rate('clarity',3)];"+
  "const ratings=RPGPlaytest.ratings();RPGPlaytest.reset();"+
  "return {invalid,valid,ratings,empty:RPGPlaytest.ratings(),mutated:JSON.stringify(World)!==before};");
 assert.ok(data.invalid.every(x=>!x.ok));
 assert.ok(data.valid.every(x=>x.ok));
 assert.deepEqual(data.ratings,{enjoyment:4,agency:5,clarity:3});
 assert.deepEqual(data.empty,{enjoyment:null,agency:null,clarity:null});
 assert.equal(data.mutated,false);
});
test('anonymous report excludes player identity, world seed, raw story text and personal relationships',()=>{
 const ctx=scenario('report-privacy');
 const data=run(ctx,"S.name='PRIVATE_PLAYER_NAME';S.partner='PRIVATE_PARTNER';"+
  "World.seed='PRIVATE_RANDOM_SEED';World.storyArchive['qa:secret']={quest:true,episodeId:'quest_wage_file',"+
  "endingTitle:'PRIVATE_STORY_TEXT',resolvedYear:World.year-2,checkCount:3};"+
  "RPGPlaytest.reset();RPGPlaytest.rate('agency',4);const before=JSON.stringify(World);"+
  "const report=RPGPlaytest.report(World,S,{availableLeads:2});"+
  "return {report,json:RPGPlaytest.exportJSON(World,S,{availableLeads:2}),mutated:JSON.stringify(World)!==before};");
 assert.equal(data.mutated,false);
 assert.equal(data.report.form,'unvalidated_formative_3_item');
 assert.equal(data.report.ratings.agency,4);
 assert.equal(data.report.ratings.enjoyment,null);
 assert.ok(!data.json.includes('PRIVATE_'));
 assert.ok(!data.json.includes('npc:'));
 assert.equal(data.report.snapshot.archivedChapters,8);
});

test('playtest helper is loaded after StorySystem and before the Stories UI with fresh cache version',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../life-game.html'),'utf8');
 const engine='js/systems/story-quest-engine.js?v=20261117-p3';
 const helper='js/systems/rpg-playtest.js?v=20261117-p4';
 const ui='js/ui/story-quest-ui.js';
 assert.ok(html.includes(engine));
 assert.ok(html.includes(helper));
 assert.ok(html.indexOf(engine)<html.indexOf(helper));
 assert.ok(html.indexOf(helper)<html.indexOf(ui));
});
