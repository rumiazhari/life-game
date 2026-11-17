'use strict';
/* Phase 11 quantitative reproducible report. Never human satisfaction data. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {createWorldContext,loadGameFiles,expose}=require('../tests/helpers/vm-loader');
const {renderHtml,collectFailures}=require('./rpg-integrity-core');
const ROOT=path.resolve(__dirname,'..');
const MODULES=[
 'js/systems/story-quests.js','js/systems/story-consequence-arcs.js',
 'js/systems/story-rpg-checks.js','js/systems/rpg-progression.js',
 'js/systems/story-quest-engine.js','js/systems/story-context.js',
 'js/systems/story-social.js','js/systems/story-threads.js'
];
function startContext(seed,policy){
 const c=createWorldContext();loadGameFiles(c,MODULES);
 expose(c,"Random.setSeed("+JSON.stringify('integrity-'+seed+'-'+policy)+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=30;S.alive=true;S.health=82;S.assets=1200;S.happiness=72;S.relations=60;"+
  "World.year=S.dob+S.age;NpcSystem.syncLegacy(World,S,Lineage);StorySystem.ensure(World);"+
  "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Scenario Workshop'});"+
  "const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1440,occupationName:'Worker',jobTier:2});"+
  "const npc=Object.values(World.npcs).find(n=>n.id!==S.npcId);npc.alive=true;"+
  "const rel=NpcSystem.relationship(npc,S.npcId);rel.trust=61;rel.closeness=54;rel.conflict=11;"+
  "const old=(ep,ending,context,social)=>{const id='story-archive:'+String(++World.storyArchiveCounter).padStart(5,'0');"+
  "World.storyArchive[id]={id,episodeId:ep,endingId:ending,endingTitle:'Test prerequisite',"+
  "startedYear:World.year-2,resolvedYear:World.year-1,context,social,quest:true};};"+
  "old('context_employer_old','context_help',{family:'employer',businessId:b.id,settlementId:World.activeSettlementId},null);"+
  "old('context_civic_old','context_discuss',{family:'civic',settlementId:World.activeSettlementId},null);"+
  "old('social_prior','social_reconciled',null,{npcId:npc.id,year:World.year-1});"+
  "old('quest_night_market','market_profit',null,null);"+
  "globalThis.simEnergyUsed=0;globalThis.fixture={firm:b.id,npc:npc.id,contract:contract.id};");
 return c;
}
const RUN=`(function(family,stage,policy,seed){
 const opts=()=>({subject:S,lineage:Lineage,year:World.year});
 const previous=Object.values(World.storyArchive).filter(a=>a&&a.thread&&a.thread.family===family&&a.thread.stage===0);
 const available=StorySystem.availableQuests(World,opts());
 const lead=available.find(x=>x.thread&&x.family===family&&(x.followup?1:0)===stage);
 const baseline=EmploymentSystem.activeForPerson(World,'subject')[0];
 const result={family,stage,policy,seed,complete:false,reason:'',
  contractBefore:baseline&&baseline.id||null,salaryBefore:baseline&&baseline.annualSalary||0,
  assetsBefore:S.assets,steps:0,rolls:0,checkPreviewMismatch:0,
  meritDelta:0,cost:0,energyRejectedBeforeStart:false,choiceAvailable:true,
  followupVisibleSameYear:false,followupVisibleNextYear:false,duplicatePayouts:0,
  endingId:null,archiveCount:0,invariants:[]};
 if(!lead){result.reason='no_lead';return result;}
 result.followupVisibleNextYear=stage===1;
 const countBefore=Object.keys(World.storyRuns).length;
 const blocked=StorySystem.startQuest(World,lead.id,Object.assign({remainingEnergy:0},opts()));
 result.energyRejectedBeforeStart=blocked.reason==='no_energy'&&Object.keys(World.storyRuns).length===countBefore;
 const meritBefore=RPG.meritOf(World,'subject'),budget=3-simEnergyUsed;
 const opened=StorySystem.startQuest(World,lead.id,Object.assign({remainingEnergy:budget},opts()));
 if(!opened.ok){result.reason='start_'+opened.reason;return result;}
 result.cost=opened.energyCost;simEnergyUsed+=result.cost;
 const runId=opened.runId;
 for(let i=0;i<32;i++){
  const view=StorySystem.currentView(World,opts());result.steps++;
  if(!view){result.reason='null_view';break;}
  if(view.type==='ending'){
   result.endingId=view.ending&&view.ending.id||null;
   const saved=StorySystem.fileAway(World,runId,{year:World.year});
   result.complete=!!saved.applied&&!!result.endingId;
   const beforeAgain=RPG.meritOf(World,'subject');
   const dup=StorySystem.fileAway(World,runId,{year:World.year});
   result.duplicatePayouts=dup.applied||RPG.meritOf(World,'subject')!==beforeAgain?1:0;
   result.archiveCount=Object.values(World.storyArchive).filter(a=>a.episodeId===lead.id).length;
   break;
  }
  if(view.type==='line'||view.type==='transition'){StorySystem.next(World,opts());continue;}
  if(view.type!=='choice'){result.reason='unknown_view';break;}
  const options=view.options.filter(o=>o.available!==false);
  if(!options.length){result.choiceAvailable=false;result.reason='no_available_choices';break;}
  const safe=options.filter(o=>!o.check);
  const selected=policy==='safe'?(safe[safe.length-1]||options[options.length-1]):
   (options.find(o=>o.check)||safe[safe.length-1]||options[0]);
  const resolution=StorySystem.choose(World,selected.index,opts());
  if(!resolution.applied){result.reason='choice_rejected_'+resolution.reason;break;}
  if(resolution.check){
   result.rolls++;
   if(Math.round(100*resolution.check.probability)!==selected.check.percent)result.checkPreviewMismatch++;
  }
 }
 result.meritDelta=RPG.meritOf(World,'subject')-meritBefore;
 const current=EmploymentSystem.activeForPerson(World,'subject')[0];
 result.contractAfter=current&&current.id||null;result.salaryAfter=current&&current.annualSalary||0;
 result.cashDelta=S.assets-result.assetsBefore;result.invariants=StorySystem.checkInvariants(World);
 if(result.complete){
  result.followupVisibleSameYear=StorySystem.availableQuests(World,opts())
   .some(x=>x.thread&&x.family===family&&x.followup);
 }
 World.year++;S.age++;simEnergyUsed=0;
 if(result.complete&&stage===0)
  result.followupVisibleNextYear=StorySystem.availableQuests(World,opts())
    .some(x=>x.thread&&x.family===family&&x.followup);
 return result;
})`;
function runScenario(c,family,stage,policy,seed){
 return JSON.parse(expose(c,'JSON.stringify(('+RUN+')('+JSON.stringify(family)+','+
  stage+','+JSON.stringify(policy)+','+JSON.stringify(seed)+'))'));
}
function exactOdds(){
 const c=startContext('odds','standard');
 const expression=`(function(){
 const rows=[];
 for(const difficulty of ['easy','standard','hard','severe']){
  const opts={actorId:'subject',subject:S,domain:'social',difficulty};
  const exact=RPG.previewCheck(World,opts);
  const trials=1200;let successes=0;
  for(let i=0;i<trials;i++){
   const stream=WorldSimulation.streamFor(World,World.year,'integrity:'+difficulty+':'+i,'rpg-dice');
   const out=RPG.resolveCheck(World,Object.assign({},opts,{stream}));
   if(out.success)successes++;
  }
  const p=exact.successes/216;
  const tolerance=Math.round((1+4*Math.sqrt(p*(1-p)/trials)*100)*100)/100;
  rows.push({difficulty,tn:exact.tn,outcomes:exact.outcomes,successes:exact.successes,
   exactPercent:Math.round(p*10000)/100,samplePercent:Math.round(successes/trials*10000)/100,
   samples:trials,maxToleratedDeviation:tolerance});
 }
 return rows;
})`;
 return JSON.parse(expose(c,'JSON.stringify(('+expression+')())'));
}
function legacyReport(script){
 return JSON.parse(cp.execFileSync(process.execPath,[path.join(ROOT,'tools',script),'--json'],
  {cwd:ROOT,encoding:'utf8',maxBuffer:20*1024*1024,timeout:180000}));
}
function createReport(options={}){
 const seeds=Array.isArray(options.seeds)?options.seeds:[1,2,3,4,5];
 const policies=Array.isArray(options.policies)?options.policies:['safe','bold'];
 const scenarios=[];
 for(const seed of seeds)for(const policy of policies){
  const c=startContext(seed,policy);
  for(const family of ['work','household'])
   for(let stage=0;stage<2;stage++)scenarios.push(runScenario(c,family,stage,policy,seed));
 }
 const outcomes={};
 for(const s of scenarios)if(s.endingId)outcomes[s.endingId]=(outcomes[s.endingId]||0)+1;
 const sum=pred=>scenarios.filter(pred).length;
 const output={schema:'life-file-rpg-integrity-v1',
  provenance:'automated_simulation_not_human_playtest',
  fixture:'engine_created_business_and_npc_with_injected_archived_prerequisites',
  scenarioSeeds:seeds,policies,odds:exactOdds(),
  dynamic:{sessions:scenarios.length,completed:sum(s=>s.complete),
   softlocks:sum(s=>!s.complete||!s.choiceAvailable),
   energyCost:scenarios.reduce((n,s)=>n+s.cost,0),
   meritEarned:scenarios.reduce((n,s)=>n+s.meritDelta,0),
   economicViolations:sum(s=>s.contractBefore!==s.contractAfter||s.salaryBefore!==s.salaryAfter||s.cashDelta!==0),
   meritViolations:sum(s=>s.meritDelta!==20||s.duplicatePayouts!==0),
   energyViolations:sum(s=>s.cost!==1||!s.energyRejectedBeforeStart),
   outcomes,scenarios}
 };
 if(options.includeLegacy!==false){
  output.authored=legacyReport('rpg-playtest-audit.js').authored;
  const p=legacyReport('rpg-scenario-playtest.js');
  output.playthrough={sessions:p.sessions,terminalRuns:p.terminalRuns,chapterCount:p.chapterCount,
   seedsPerPolicy:p.seedsPerPolicy,policies:p.policies,failures:p.failures,followups:p.followups};
 }
 output.failures=collectFailures(output);
 return output;
}
function main(){
 const args=process.argv.slice(2),write=args.includes('--write'),json=args.includes('--json');
 const report=createReport(),body=JSON.stringify(report,null,2)+'\n';
 if(write){
  const dest=path.join(ROOT,'reports');fs.mkdirSync(dest,{recursive:true});
  fs.writeFileSync(path.join(dest,'rpg-integrity.json'),body,'utf8');
  fs.writeFileSync(path.join(dest,'rpg-integrity.html'),renderHtml(report),'utf8');
 }
 if(json)process.stdout.write(body);
 else console.log('RPG integration '+report.dynamic.completed+'/'+report.dynamic.sessions+
  ', softlocks '+report.dynamic.softlocks+', exact 3d6 '+report.odds.length+
  ', findings '+report.failures.length+(write?', reports/rpg-integrity.{json,html}':''));
 if(report.failures.length)process.exitCode=1;
}
if(require.main===module)main();
module.exports={createReport,runScenario,startContext,exactOdds};
