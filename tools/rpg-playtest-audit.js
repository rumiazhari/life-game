'use strict';
/* Development-only RPG catalogue and probability audit. No save file writes. */
const path=require('node:path');
const {createWorldContext,loadGameFiles,expose}=require('../tests/helpers/vm-loader');
const ctx=createWorldContext();
loadGameFiles(ctx,[
 'js/systems/story-quests.js',
 'js/systems/story-consequence-arcs.js',
 'js/systems/story-rpg-checks.js',
 'js/systems/story-quest-engine.js'
]);
expose(ctx,`(function(){
 Random.setSeed('phase4-author-audit');
 newWorld();newLineage();newHold();newSubject();
 S.age=28;S.alive=true;S.mother.alive=true;S.assets=650;S.health=75;
 S.smarts=55;S.relations=55;S.happiness=65;World.year=S.dob+S.age;
 StorySystem.ensure(World);
 const shop=BusinessSystem.create(World,{
  settlementId:World.activeSettlementId,sector:'retail',name:'Audit Workshop'
 });
 EmploymentSystem.hire(World,{
  personId:'subject',businessId:shop.id,annualSalary:1350,occupationName:'Worker',jobTier:1
 });
 for(const [id,ending] of [
  ['quest_wage_file','wages_restored'],
  ['quest_kitchen_table','care_recovered'],
  ['quest_ward_petition','ward_reopened'],
  ['quest_school_press','press_published'],
  ['quest_night_market','market_profit'],
  ['quest_reference_file','reference_raised'],
  ['quest_grey_manifest','grey_reported']
 ]){
  World.storyArchive['audit:'+id]={id:'audit:'+id,episodeId:id,
   endingId:ending,startedYear:World.year-2,resolvedYear:World.year-1,quest:true};
 }
})()`);
const CATALOG_CODE=`(function(){
 return StoryEpisodes.filter(e=>e.quest).map(e=>{
  try{
   const cast=e.cast?e.cast(World,S,Lineage):[];
   if(cast==null)throw new Error('missing cast');
   const bind=Array.isArray(cast)?cast.reduce((m,v)=>(m[v.key]=v,m),{}):cast;
   const body=e.build(bind),scenes={};
   for(const [key,scene] of Object.entries(body.scenes||{})){
    scenes[key]={
     ending:!!scene.ending,
     goto:scene.goto||null,
     choices:scene.choice?(scene.choice.options||[]).map(o=>({
      goto:o.goto||null,
      failGoto:o.check&&o.check.failGoto||null,
      successGoto:o.check&&o.check.successGoto||null,
      check:!!o.check,
      unconditional:!o.check&&!o.require&&
       !(o.effects||[]).some(effect=>effect.kind==='money'&&effect.delta<0)
     })):[]
    };
   }
   return{id:e.id,arc:e.questArc||'OTHER',
    start:body.startScene||Object.keys(body.scenes||{})[0],scenes};
  }catch(err){return{id:e.id,arc:e.questArc||'OTHER',buildError:String(err)};}
 });
})()`;
const catalog=JSON.parse(expose(ctx,'JSON.stringify('+CATALOG_CODE+')'));
const ODDS_CODE=`(function(){
 return ['easy','standard','hard','severe'].map(difficulty=>{
  const p=RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'social',difficulty});
  const total=1200;let hits=0;
  for(let i=0;i<total;i++){
   const stream=WorldSimulation.streamFor(World,World.year,
    'audit-roll:'+difficulty+':'+i,'rpg-playtest');
   const result=RPG.resolveCheck(World,{actorId:'subject',
    subject:S,domain:'social',difficulty,stream});
   if(result.success)hits++;
  }
  return{difficulty,tn:p.tn,percent:p.percent,successes:p.successes,
   outcomes:p.outcomes,empiricalPercent:Math.round(hits/total*100),samples:total};
 });
})()`;
const odds=JSON.parse(expose(ctx,'JSON.stringify('+ODDS_CODE+')'));
function analyze(episode){
 const graph=episode.scenes||{},keys=Object.keys(graph);
 const broken=[];
 const allOptions=keys.reduce((n,k)=>n+(graph[k].choices||[]).length,0);
 for(const name of keys){
  const node=graph[name];
  const destinations=[node.goto];
  for(const opt of node.choices||[])
   destinations.push(opt.goto,opt.failGoto,opt.successGoto);
  destinations.filter(Boolean).forEach(target=>{
   if(!Object.prototype.hasOwnProperty.call(graph,target))
    broken.push(episode.id+':'+name+'->'+target);
  });
 }
 const paths=[],cycles=[];
 function walk(node,depth,stack){
  if(depth>24||stack.has(node)){cycles.push(episode.id+':'+node);return;}
  const scene=graph[node];
  if(!scene)return;
  if(scene.ending){paths.push({decisions:depth,ending:node});return;}
  const next=new Set(stack);next.add(node);
  if(scene.goto)walk(scene.goto,depth,next);
  for(const opt of scene.choices||[]){
   const unique=new Set([opt.goto,opt.failGoto,opt.successGoto].filter(Boolean));
   for(const dest of unique)walk(dest,depth+1,next);
  }
 }
 if(!episode.buildError)walk(episode.start,0,new Set());
 const opener=graph[episode.start]||{choices:[]};
 const first=opener.choices||[];
 const mean=paths.length?Math.round(paths.reduce((n,p)=>n+p.decisions,0)/paths.length*100)/100:null;
 return{
  id:episode.id,arc:episode.arc,
  firstChoices:first.length,
  safeFirstChoices:first.filter(x=>x.unconditional).length,
  sceneCount:keys.length,
  authoredOptions:allOptions,
  reachableEndings:new Set(paths.map(p=>p.ending)).size,
  minDecisions:paths.length?Math.min(...paths.map(p=>p.decisions)):null,
  maxDecisions:paths.length?Math.max(...paths.map(p=>p.decisions)):null,
  meanAuthoredDecisions:mean,
  broken,cycles,buildError:episode.buildError||null
 };
}
const byQuest=catalog.map(analyze);
const authored={
 questCount:byQuest.length,
 safeOpenings:byQuest.filter(x=>x.safeFirstChoices>=1).length,
 unsafeOpenings:byQuest.filter(x=>!x.safeFirstChoices).map(x=>x.id),
 brokenEdges:byQuest.flatMap(x=>x.broken),
 cycles:byQuest.flatMap(x=>x.cycles),
 buildFailures:byQuest.filter(x=>x.buildError).map(x=>x.id),
 authoredChoices:byQuest.reduce((n,x)=>n+x.authoredOptions,0),
 byQuest:byQuest.map(({broken,cycles,buildError,...safe})=>safe)
};
const report={schema:'life-file-rpg-audit-v1',
 provenance:'deterministic_simulation_not_human_playtesting',
 authored,odds};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('QUESTS '+authored.questCount+' SAFE OPENINGS '+authored.safeOpenings+
  ' BROKEN EDGES '+authored.brokenEdges.length);
 for(const x of byQuest)
  console.log(x.id+' | '+x.safeFirstChoices+'/'+x.firstChoices+
   ' guaranteed | '+x.reachableEndings+' endings | '+x.meanAuthoredDecisions+' authored decisions');
 console.log('EXACT 3d6 '+odds.map(x=>x.difficulty+':'+x.percent+'%').join('  '));
}
if(authored.questCount!==12||authored.safeOpenings!==12||
 authored.brokenEdges.length||authored.cycles.length||authored.buildFailures.length||
 byQuest.some(x=>x.reachableEndings<2||x.maxDecisions<1)||
 odds.some(x=>x.outcomes!==216||Math.abs(x.empiricalPercent-x.percent)>5))process.exitCode=1;
