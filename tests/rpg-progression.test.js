'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
function ready(seed='progression'){
 const ctx=createWorldContext();
 loadGameFiles(ctx,['js/systems/story-rpg-checks.js']);
 if(fs.existsSync('js/systems/rpg-progression.js'))
  loadGameFiles(ctx,['js/systems/rpg-progression.js']);
 expose(ctx,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=28;S.alive=true;S.health=85;S.smarts=60;S.happiness=60;S.jobTier=0;"+
  "S.skills={craft:0,academics:0,social:0};World.year=S.dob+S.age;StorySystem.ensure(World);RPG.recordFor(World,'subject');");
 return ctx;
}
const j=(c,s)=>JSON.parse(expose(c,'JSON.stringify((()=>{'+s+'})())'));
test('real owned portfolio automatically improves labor quality without explicit item argument',()=>{
 const c=ready();
 const out=j(c,"const before=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard'});"+
  "World.storyItems.career_portfolio={id:'career_portfolio',label:'Work portfolio'};"+
  "const after=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard'});"+
  "return {before,after,inventory:RPGProgression.evidenceFor(World,S)};");
 assert.equal(out.after.mod-out.before.mod,2);
 assert.ok(out.after.successes>out.before.successes);
 assert.equal(out.after.equippedEvidence,'career_portfolio');
 assert.ok(out.after.breakdown.some(x=>x.label==='GEAR / EVIDENCE'&&x.value===2));
 assert.equal(out.inventory.find(x=>x.id==='career_portfolio').bonus,2);
 assert.equal(out.after.outcomes,216);
});
test('highest matching Bureau evidence wins, without stacking or duplicating ownership',()=>{
 const c=ready();
 const out=j(c,"World.storyItems.grey_testimony={id:'grey_testimony'};"+
  "World.storyItems.grey_duplicate={id:'grey_duplicate'};"+
  "return {owned:RPGProgression.evidenceFor(World,S),check:RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'bureau',difficulty:'hard'})};");
 assert.equal(out.check.equippedEvidence,'grey_duplicate');
 assert.equal(out.check.breakdown.find(x=>x.label==='GEAR / EVIDENCE').value,2);
 assert.equal(out.owned.length,2);
 assert.equal(out.check.hasItem,true);
});
test('explicit evidence takes priority and missing explicit evidence does not silently auto-select',()=>{
 const c=ready();
 const out=j(c,"World.storyItems.grey_duplicate={id:'grey_duplicate'};"+
  "const auto=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'bureau',difficulty:'hard'});"+
  "const missing=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'bureau',difficulty:'hard',item:'absent'});"+
  "const disabled=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'bureau',difficulty:'hard',autoEvidence:false});"+
  "const explicit=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'bureau',difficulty:'hard',item:'grey_duplicate',itemBonus:1});"+
  "return {auto,missing,disabled,explicit};");
 assert.equal(out.auto.mod-out.missing.mod,2);
 assert.equal(out.missing.mod,out.disabled.mod);
 assert.equal(out.missing.hasItem,false);
 assert.equal(out.missing.equippedEvidence,null);
 assert.equal(out.explicit.mod-out.missing.mod,1);
});
test('professional modifier follows real employment contract, not stale legacy job tier',()=>{
 const c=ready('profession');
 const out=j(c,"S.jobTier=5;const ghost=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor'});"+
  "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Master Workshop'});"+
  "const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1300,occupationName:'Foreman',jobTier:3});"+
  "S.jobTier=0;const employed=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor'});"+
  "EmploymentSystem.end(World,contract.id,'terminated','test',World.year,{subject:S});"+
  "S.jobTier=5;const after=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor'});"+
  "return {ghost,employed,after};");
 assert.equal(out.employed.mod-out.ghost.mod,1);
 assert.equal(out.after.mod,out.ghost.mod);
 assert.ok(out.employed.breakdown.some(x=>x.label==='PROFESSION'));
 assert.ok(!out.ghost.breakdown.some(x=>x.label==='PROFESSION'));
});
test('auto evidence preview and seeded resolver have exactly matching 216-outcome odds and 3 dice',()=>{
 const c=ready('exact-gear');
 const out=j(c,"World.storyItems.career_letter={id:'career_letter'};"+
  "const preview=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'social',difficulty:'hard'});"+
  "const low=RPG.resolveCheck(World,{actorId:'subject',subject:S,domain:'social',difficulty:'hard',stream:{next:()=>0}});"+
  "const high=RPG.resolveCheck(World,{actorId:'subject',subject:S,domain:'social',difficulty:'hard',stream:{next:()=>.999}});"+
  "return {preview,low,high};");
 assert.equal(out.low.mod,out.preview.mod);
 assert.equal(out.high.mod,out.preview.mod);
 assert.equal(out.low.probability,out.preview.probability);
 assert.deepEqual(out.high.rolls,[6,6,6]);
 assert.deepEqual(out.low.rolls,[1,1,1]);
 assert.equal(out.high.equippedEvidence,'career_letter');
});
test('grade/skill/perk, profession, and evidence never exceed the standard modifier caps',()=>{
 const c=ready('caps');
 const out=j(c,"S.jobTier=5;S.skills.craft=10;RPG.addMerit(World,'subject',2000,'setup',World.year);"+
  "RPG.setBackground(World,'subject','veteran');"+
  "World.storyItems.career_portfolio={id:'career_portfolio'};"+
  "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail'});"+
  "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1400,occupationName:'Foreman',jobTier:4});"+
  "const p=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard',bonus:4});"+
  "return {p};");
 assert.equal(out.p.mod,4);
 assert.ok(out.p.uncappedModifier>4);
 assert.equal(out.p.outcomes,216);
});
test('evidence and labor preview remain deterministic after save/reload',()=>{
 const c=ready('save-evidence');
 expose(c,"World.storyItems.career_portfolio={id:'career_portfolio'};");
 const saved=expose(c,'JSON.stringify(World)');
 const before=j(c,"return RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard'});");
 expose(c,'World=JSON.parse('+JSON.stringify(saved)+')');
 assert.deepEqual(j(c,"return RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'labor',difficulty:'hard'});"),before);
});
test('browser loads progression between RPG checks and actions',()=>{
 const html=fs.readFileSync('life-game.html','utf8');
 const at=s=>html.indexOf('src="'+s);
 assert.ok(at('js/systems/rpg-progression.js')>at('js/systems/story-rpg-checks.js'));
 assert.ok(at('js/systems/rpg-progression.js')<at('js/systems/contextual-actions.js'));
});

test('Stories inventory visibly identifies the domain and bonus of actual owned evidence',()=>{
 const c=createWorldContext();
 const nodes={},make=()=>({classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  style:{},dataset:{},innerHTML:'',textContent:'',disabled:false,handlers:{},
  addEventListener(t,fn){this.handlers[t]=fn;},removeEventListener(){},
  appendChild(){},remove(){},focus(){},setAttribute(){},
  querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;}});
 c.document={getElementById(k){return nodes[k]||(nodes[k]=make());},
  querySelector(k){return nodes[k]||(nodes[k]=make());},querySelectorAll(){return [];},
  createElement(){return make();},addEventListener(){},body:make(),documentElement:make()};
 c.addEventListener=()=>{};c.setTimeout=()=>0;c.clearTimeout=()=>{};
 c.setInterval=()=>0;c.clearInterval=()=>{};
 loadGameFiles(c,['js/systems/story-quests.js','js/systems/story-rpg-checks.js',
  'js/systems/rpg-progression.js','js/systems/story-quest-engine.js',
  'js/systems/world-gameplay.js','js/medical.js','js/ui.js','js/ui/story-quest-ui.js']);
 const html=expose(c,"Random.setSeed('gear-panel');newWorld();newLineage();newHold();newSubject();"+
  "S.age=29;S.alive=true;S.health=85;World.year=S.dob+S.age;StorySystem.ensure(World);"+
  "World.storyItems.career_portfolio={id:'career_portfolio',icon:'📑',label:'Work portfolio'};"+
  "renderStoryBoard();document.getElementById('storySheet').innerHTML;");
 assert.match(html,/STORY GEAR/);
 assert.match(html,/Work portfolio/);
 assert.match(html,/LABOR \+2/);
});
