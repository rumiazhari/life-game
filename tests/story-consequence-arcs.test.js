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


test('career review uses original contract only and remembers the actual coworker',()=>{
 const ctx=ready('career-end');const hired=hire(ctx,true);archive(ctx,'quest_wage_file','wages_restored');
 assert.equal(start(ctx,'quest_reference_file').ok,true);
 step(ctx);expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>.999});");
 const first=choose(ctx,0);
 assert.equal(first.applied,true);assert.equal(first.check.success,true);
 assert.equal(expose(ctx,"!!World.storyItems.career_letter"),true);
 step(ctx);const second=choose(ctx,0);
 assert.equal(second.applied,true);assert.equal(second.check.success,true);
 const state=run(ctx,"return {ending:StorySystem.currentView(World).ending.id,"+
  "salary:EmploymentSystem.activeForPerson(World,'subject')[0].annualSalary,"+
  "coworkerMem:Object.values(World.relationshipMemories||{}).some(m=>m.participants.includes('npc:940001')),"+
  "bond:World.npcs['npc:940001'].relationships[String(S.npcId||'subject')]||null};");
 assert.equal(state.ending,'reference_raised');
 assert.equal(state.salary,hired.annualSalary+180);
 assert.equal(state.coworkerMem,true);
 assert.ok(state.bond&&state.bond.closeness>=50);
 const id=expose(ctx,"StorySystem.liveRun(World).id");
 const before=expose(ctx,"RPG.meritOf(World,'subject')");
 const filed=run(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(id)+",{year:World.year});");
 assert.equal(filed.applied,true);
 assert.equal(expose(ctx,"RPG.meritOf(World,'subject')"),before+20);
 assert.equal(run(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(id)+",{year:World.year});").applied,false);
 assert.equal(expose(ctx,"RPG.meritOf(World,'subject')"),before+20);
 const same=run(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).map(q=>q.id)");
 assert.ok(!same.includes('quest_reference_return'));
 expose(ctx,"World.year++;");
 assert.ok(run(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).map(q=>q.id)").includes('quest_reference_return'));
});
test('career review cannot raise a replacement contract or a rehire at the same employer',()=>{
 for(const rehire of [false,true]){
  const ctx=ready('career-switch-'+rehire);const hired=hire(ctx);
  archive(ctx,'quest_wage_file','wages_compromise');
  start(ctx,'quest_reference_file');step(ctx);
  expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>.999});");
  assert.equal(choose(ctx,0).check.success,true);
  const company=run(ctx,"return {id:EmploymentSystem.activeForPerson(World,'subject')[0].businessId,"+
    "contract:EmploymentSystem.activeForPerson(World,'subject')[0].id};");
  const after=run(ctx,"const old=EmploymentSystem.activeForPerson(World,'subject')[0];"+
   "EmploymentSystem.end(World,old.id,'terminated','career_swap',World.year,{subject:S});"+
   "const b="+(rehire?"BusinessSystem.get(World,old.businessId)":
    "BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'New Firm'})")+";"+
   "const newer=EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1980,occupationName:'Worker',jobTier:1});"+
   "return {id:newer.id,salary:newer.annualSalary,assets:S.assets};");
  assert.notEqual(after.id,company.contract);
  step(ctx);assert.equal(choose(ctx,0).check.success,true);
  const end=run(ctx,"return {salary:EmploymentSystem.activeForPerson(World,'subject')[0].annualSalary,"+
    "assets:S.assets,ending:StorySystem.currentView(World).ending.id};");
  assert.equal(end.ending,'reference_raised');
  assert.equal(end.salary,after.salary);
  assert.equal(end.assets,after.assets);
 }
});
test('career without a real coworker never invents NPC bonds and still has a guaranteed route',()=>{
 const ctx=ready('career-nopeer');hire(ctx);archive(ctx,'quest_ward_petition','ward_expired');
 assert.equal(start(ctx,'quest_reference_file').ok,true);step(ctx);
 const startView=run(ctx,"return StorySystem.currentView(World,{subject:S});");
 assert.equal(startView.options.length,3);
 assert.equal(startView.options[2].check,null);
 assert.equal(choose(ctx,2).applied,true);
 const state=run(ctx,"return {ending:StorySystem.currentView(World).ending.id,"+
  "mem:Object.values(World.relationshipMemories||{}).filter(x=>x.participants.includes('npc:0')),"+
  "npcs:Object.keys(World.npcs||{}).length};");
 assert.equal(state.ending,'reference_quiet');
 assert.equal(state.mem.length,0);
});
test('underworld report yields canonical evidence, changes scrutiny and opens next-year witness',()=>{
 const ctx=ready('grey-good');archive(ctx,'quest_night_market','market_profit');
 archive(ctx,'quest_ward_petition','ward_reopened');
 expose(ctx,'S.scrutiny=25;');
 assert.equal(start(ctx,'quest_grey_manifest').ok,true);step(ctx);
 expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>.999});");
 const first=choose(ctx,0);
 assert.equal(first.check.success,true);
 const state=run(ctx,"return {ending:StorySystem.currentView(World).ending.id,"+
  "scrutiny:S.scrutiny,assets:S.assets,evidence:!!World.storyItems.grey_testimony};");
 assert.equal(state.ending,'grey_reported');
 assert.equal(state.scrutiny,16);
 assert.equal(state.evidence,true);
 const id=expose(ctx,"StorySystem.liveRun(World).id");
 assert.equal(run(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(id)+",{year:World.year});").applied,true);
 assert.ok(!run(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).map(e=>e.id)").includes('quest_grey_witness'));
 expose(ctx,"World.year++;");
 assert.ok(run(ctx,"return StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).map(e=>e.id)").includes('quest_grey_witness'));
 assert.equal(start(ctx,'quest_grey_witness').ok,true);step(ctx);
 const witness=run(ctx,"return StorySystem.currentView(World,{subject:S}).options[0]");
 assert.equal(witness.available,true);
 assert.equal(choose(ctx,0).check.success,true);
 const conclusion=run(ctx,"return {ending:StorySystem.currentView(World).ending.id,scrutiny:S.scrutiny}");
 assert.equal(conclusion.ending,'grey_witness_cleared');
 assert.equal(conclusion.scrutiny,4);
});
test('underworld failed checks fail forward, without rerolls or unearned evidence',()=>{
 const ctx=ready('grey-fail');archive(ctx,'quest_night_market','market_safe');
 expose(ctx,'S.scrutiny=12;');
 start(ctx,'quest_grey_manifest');step(ctx);
 expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>0});");
 const first=choose(ctx,0);
 assert.equal(first.applied,true);
 assert.equal(first.check.success,false);
 assert.equal(first.check.rolls.join(','),'1,1,1');
 assert.equal(choose(ctx,0).applied,false);
 const state=run(ctx,"return {ending:StorySystem.currentView(World).ending.id,"+
  "scrutiny:S.scrutiny,evidence:!!World.storyItems.grey_testimony}");
 assert.equal(state.ending,'grey_exposed');
 assert.equal(state.scrutiny,23);
 assert.equal(state.evidence,false);
});
test('underworld concealed outcome pays only once and a later witness can always refuse',()=>{
 const ctx=ready('grey-cash');archive(ctx,'quest_night_market','market_profit');
 const initial=expose(ctx,'S.assets');
 start(ctx,'quest_grey_manifest');step(ctx);
 expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>.999});");
 assert.equal(choose(ctx,1).check.success,true);
 assert.equal(expose(ctx,'S.assets'),initial+80);
 const id=expose(ctx,"StorySystem.liveRun(World).id");
 assert.equal(run(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(id)+",{year:World.year});").applied,true);
 assert.equal(run(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(id)+",{year:World.year});").applied,false);
 assert.equal(expose(ctx,'S.assets'),initial+80);
 expose(ctx,"World.year++;");
 start(ctx,'quest_grey_witness');step(ctx);
 const view=run(ctx,"return StorySystem.currentView(World,{subject:S})");
 assert.equal(view.options[0].available,false);
 assert.equal(view.options[2].available,true);
 assert.equal(choose(ctx,2).applied,true);
 assert.equal(expose(ctx,'StorySystem.currentView(World).ending.id'),'grey_witness_depart');
});
test('an unfinished quest cannot be archived prematurely for merit or a follow-up',()=>{
 const ctx=ready('early-file');hire(ctx);archive(ctx,'quest_wage_file','wages_restored');
 const started=start(ctx,'quest_reference_file');
 const before=run(ctx,"return {count:Object.keys(World.storyArchive).length,merit:RPG.meritOf(World,'subject')}");
 const result=run(ctx,"return StorySystem.fileAway(World,"+JSON.stringify(started.runId)+",{year:World.year});");
 const after=run(ctx,"return {count:Object.keys(World.storyArchive).length,merit:RPG.meritOf(World,'subject'),"+
  "status:World.storyRuns["+JSON.stringify(started.runId)+"]&&World.storyRuns["+JSON.stringify(started.runId)+"].status}");
 assert.equal(result.applied,false);
 assert.deepEqual(after,{...before,status:'playing'});
});

test('an employment-system error cannot turn a scoped salary review into free cash',()=>{
 const ctx=ready('salary-failure');hire(ctx);
 archive(ctx,'quest_wage_file','wages_restored');
 const initial=expose(ctx,"S.assets");
 start(ctx,'quest_reference_file');step(ctx);
 expose(ctx,"WorldSimulation.streamFor=()=>({next:()=>.999});");
 assert.equal(choose(ctx,0).check.success,true);
 expose(ctx,"EmploymentSystem.adjustSalary=()=>{throw Error('simulated payroll failure')};");
 step(ctx);assert.equal(choose(ctx,0).check.success,true);
 const actual=run(ctx,"return {cash:S.assets,ending:StorySystem.currentView(World).ending.id}");
 assert.equal(actual.ending,'reference_raised');
 assert.equal(actual.cash,initial,'scoped raises never create a cash payment on exception');
});

test('new chapters advertise a one-energy cost while older non-wage quests remain free',()=>{
 const ctx=ready('energy-meta');hire(ctx);archive(ctx,'quest_wage_file','wages_restored');
 archive(ctx,'quest_night_market','market_safe');
 const out=run(ctx,"const leads=StorySystem.availableQuests(World,{subject:S,lineage:Lineage});"+
  "return Object.fromEntries(leads.map(x=>[x.id,x.energyCost]));");
 assert.equal(out.quest_reference_file,1);
 assert.equal(out.quest_grey_manifest,1);
 assert.equal(out.quest_kitchen_table,0);
 assert.equal(out.quest_wage_aftermath,1);
});
test('new chapter start rejects zero energy without mutating story state, then accepts one',()=>{
 const ctx=ready('energy-preflight');hire(ctx);archive(ctx,'quest_wage_file','wages_restored');
 const out=run(ctx,"const before=World.storyCounter;const blocked=StorySystem.startQuest(World,'quest_reference_file',"+
  "{subject:S,lineage:Lineage,year:World.year,remainingEnergy:0});"+
  "const middle=World.storyCounter;const success=StorySystem.startQuest(World,'quest_reference_file',"+
  "{subject:S,lineage:Lineage,year:World.year,remainingEnergy:1});"+
  "return {before,middle,blocked,success,after:World.storyCounter,live:Object.keys(World.storyRuns).length};");
 assert.equal(out.blocked.ok,false);
 assert.equal(out.blocked.reason,'no_energy');
 assert.equal(out.before,out.middle);
 assert.equal(out.success.ok,true);
 assert.equal(out.success.energyCost,1);
 assert.equal(out.live,1);
 assert.equal(out.after,out.before+1);
});
function boardSession(){
 const ctx=createWorldContext();
 const elements={};
 const make=()=>({classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  style:{},dataset:{},innerHTML:'',textContent:'',disabled:false,handlers:{},
  addEventListener(t,fn){this.handlers[t]=fn;},removeEventListener(){},
  appendChild(){},remove(){},focus(){},setAttribute(){},
  querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;}});
 ctx.document={querySelector(k){return elements[k]||(elements[k]=make());},
  querySelectorAll(){return [];},getElementById(k){return elements['#'+k]||(elements['#'+k]=make());},
  createElement(){return make();},addEventListener(){},body:make(),documentElement:make()};
 ctx.addEventListener=()=>{};ctx.setTimeout=()=>0;ctx.clearTimeout=()=>{};
 ctx.setInterval=()=>0;ctx.clearInterval=()=>{};
 loadGameFiles(ctx,['js/systems/story-quests.js',MODULE,'js/systems/story-rpg-checks.js',
  'js/systems/story-quest-engine.js','js/systems/world-gameplay.js',
  'js/medical.js','js/ui.js','js/ui/story-quest-ui.js']);
 expose(ctx,"Random.setSeed('ui-p3');newWorld();newLineage();newHold();newSubject();"+
  "S.age=28;S.alive=true;S.jailUntil=0;S.assets=700;S.health=88;World.year=S.dob+S.age;StorySystem.ensure(World);"+
  "openStorySlip=function(){};");
 return ctx;
}
test('Stories card for new career chapter spends exactly one existing annual energy',()=>{
 const ctx=boardSession();
 run(ctx,"const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Riverside'});"+
  "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1500,occupationName:'Worker',jobTier:1});"+
  "World.storyArchive.test={episodeId:'quest_wage_file',endingId:'wages_restored',resolvedYear:World.year-1};return true;");
 const out=run(ctx,"renderStoryBoard();const page=document.getElementById('storySheet').innerHTML;"+
  "const before=energyUsed();document.getElementById('storySheet').handlers.click({target:{closest(sel){"+
  "return sel==='[data-qs-start]'?{disabled:false,dataset:{qsStart:'quest_reference_file'}}:null;}}});"+
  "return {page,before,after:energyUsed(),runs:Object.keys(World.storyRuns).length,"+
  "ledger:doneActionsThisYear().filter(x=>x.startsWith('story-chapter:')).length};");
 assert.match(out.page,/data-qs-start="quest_reference_file"/);
 assert.match(out.page,/1 ENERGY/);
 assert.match(out.page,/CAREER/);
 assert.equal(out.after-out.before,1);
 assert.equal(out.ledger,1);
 assert.equal(out.runs,1);
});

test('browser entrypoint loads Phase 3 arc and changed story runtime with fresh cache keys',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../life-game.html'),'utf8');
 const arcs='js/systems/story-consequence-arcs.js?v=20261117-p3';
 const engine='js/systems/story-quest-engine.js?v=20261117-p3';
 const runtime='js/systems/story-system.js?v=20261117-p3';
 const ui='js/ui/story-quest-ui.js?v=20261117-p4';
 for(const f of [arcs,engine,runtime,ui])assert.ok(html.includes(f),f);
 assert.ok(html.indexOf('js/systems/story-quests.js')<html.indexOf(arcs));
 assert.ok(html.indexOf(arcs)<html.indexOf(runtime));
 assert.ok(html.indexOf(runtime)<html.indexOf(engine));
 assert.ok(html.indexOf(engine)<html.indexOf(ui));
});
