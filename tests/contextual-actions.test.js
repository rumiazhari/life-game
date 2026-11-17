'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
const MODULE='js/systems/contextual-actions.js';
function ready(seed='phase2'){
 const ctx=createWorldContext();
 const files=['js/systems/story-rpg-checks.js'];
 if(fs.existsSync(path.join(__dirname,'..',MODULE)))files.push(MODULE);
 loadGameFiles(ctx,files);
 expose(ctx,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
   "S.age=32;S.alive=true;S.jailUntil=0;S.health=85;S.smarts=55;S.happiness=60;S.assets=1500;"+
   "S.jobTier=2;S.jobName='Worker';S.married=true;S.kids=1;S.relations=55;S.mother.alive=true;S.father.alive=true;World.year=S.dob+S.age;");
 return ctx;
}
const run=(ctx,script)=>JSON.parse(expose(ctx,"JSON.stringify((function(){"+script+"})())"));
const plan="return ContextualActions.lanes(World,S,{getAction:(t,id)=>t==='p'?PUR_MAP[id]:DEC_MAP[id],reserved:id=>false,remainingEnergy:4});";
test('five action families select real immediately playable entries',()=>{
 const ctx=ready();
 assert.equal(expose(ctx,"typeof ContextualActions"),'object');
 const rows=run(ctx,plan);
 assert.deepEqual(rows.map(x=>x.family),['work','learn','connect','recover','risk']);
 assert.deepEqual(rows.map(x=>x.id),['overtime','study','tendspouse','walk','track']);
 assert.ok(rows.every(x=>x.available&&x.cost===1));
 assert.ok(rows.every(x=>x.check&&x.check.outcomes===216));
});
test('unemployed and unmarried character gets existing portal and family fallbacks without synthetic 3d6 odds',()=>{
 const ctx=ready('fallback');
 expose(ctx,"S.jobTier=0;S.jobName='Unemployed';S.married=false;S.kids=0;");
 const rows=run(ctx,plan);
 assert.equal(rows[0].id,'lookwork');
 assert.equal(rows[0].check,null);
 assert.equal(rows[2].id,'writemother');
 assert.equal(rows[2].check.outcomes,216);
});
test('age restrictions, custody, budget and repeated-action exclusion all suppress invalid buttons',()=>{
 const ctx=ready('availability');
 expose(ctx,"S.age=12;S.jobTier=0;S.jobName='Unemployed';S.married=false;S.kids=0;");
 const teen=run(ctx,plan);
 assert.equal(teen[4].available,false);
 assert.equal(teen[4].id,null);
 const spent=run(ctx,"return ContextualActions.lanes(World,S,{getAction:(t,id)=>t==='p'?PUR_MAP[id]:DEC_MAP[id],reserved:id=>id==='study',remainingEnergy:4});");
 assert.equal(spent[1].available,false);
 const broke=run(ctx,"return ContextualActions.lanes(World,S,{getAction:(t,id)=>t==='p'?PUR_MAP[id]:DEC_MAP[id],reserved:()=>false,remainingEnergy:0});");
 assert.ok(broke.filter(x=>x.cost>0).every(x=>!x.available&&x.reason==='no_energy'));
 expose(ctx,'S.jailUntil=S.age+2;');
 const jailed=run(ctx,plan);
 assert.ok(jailed.every(x=>!x.available&&x.reason==='in_custody'));
});
test('quality preview reuses canonical 216-outcome probability and character modifiers',()=>{
 const ctx=ready('quality');
 const out=run(ctx,"const before=ContextualActions.preview(World,S,'p','study');"+
  "S.skills.academics=8;const trained=ContextualActions.preview(World,S,'p','study');"+
  "S.health=24;const sick=ContextualActions.preview(World,S,'p','study');"+
  "return {before,trained,sick};");
 assert.equal(out.before.outcomes,216);
 assert.equal(out.before.domain,'study');
 assert.ok(out.trained.successes>out.before.successes);
 assert.ok(out.sick.successes<out.trained.successes);
});
test('quality roll uses injected deterministic three dice and shares preview modifiers',()=>{
 const ctx=ready('quality-dice');
 const out=run(ctx,"const preview=ContextualActions.preview(World,S,'p','overtime');"+
  "const yes=ContextualActions.resolve(World,S,'p','overtime',{year:World.year,stream:{next:()=>.999}});"+
  "const no=ContextualActions.resolve(World,S,'p','overtime',{year:World.year,stream:{next:()=>0}});"+
  "return {preview,yes,no};");
 assert.deepEqual(out.yes.check.rolls,[6,6,6]);
 assert.deepEqual(out.no.check.rolls,[1,1,1]);
 assert.equal(out.preview.mod,out.yes.check.mod);
 assert.equal(out.preview.probability,out.no.check.probability);
 assert.equal(out.yes.check.success,true);
 assert.equal(out.no.check.success,false);
});
test('small supplemental effects respect risk handling, not the independent 50/50 bet outcome',()=>{
 const ctx=ready('bet-control');
 const out=run(ctx,"const yes=ContextualActions.resolve(World,S,'p','track',{year:World.year,stream:{next:()=>.999}});"+
  "const no=ContextualActions.resolve(World,S,'p','track',{year:World.year,stream:{next:()=>0}});"+
  "return {win:ContextualActions.bonusFor(yes,{assets:300,happiness:3}),"+
  "lose:ContextualActions.bonusFor(yes,{assets:-300,happiness:-2}),"+
  "setback:ContextualActions.bonusFor(no,{assets:-300,happiness:-2}),"+
  "combined:ContextualActions.combineFx({assets:-300,happiness:-2},ContextualActions.bonusFor(yes,{assets:-300,happiness:-2}))};");
 assert.deepEqual(out.win,{assets:40});
 assert.deepEqual(out.lose,{assets:75});
 assert.deepEqual(out.setback,{happiness:-1});
 assert.deepEqual(out.combined,{assets:-225,happiness:-2});
});
test('unmapped registry actions keep their native execution without a quality roll',()=>{
 const ctx=ready('unmapped');
 assert.equal(expose(ctx,"ContextualActions.preview(World,S,'p','doctor')"),null);
 assert.equal(expose(ctx,"ContextualActions.resolve(World,S,'p','doctor',{year:World.year})"),null);
});

