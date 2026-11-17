'use strict';
/* Phase 5: actual StorySystem synthetic-policy runs, never human participant data. */
const {createWorldContext,loadGameFiles,expose}=require('../tests/helpers/vm-loader');
const POLICIES=Object.freeze(['bold','prudent','safe']);
const SEEDS=Object.freeze([1,2,3,4,5]);
const QUEST_IDS=Object.freeze([
 'quest_wage_file','quest_wage_aftermath','quest_kitchen_table','quest_kitchen_return',
 'quest_ward_petition','quest_ward_return','quest_school_press','quest_night_market',
 'quest_reference_file','quest_reference_return','quest_grey_manifest','quest_grey_witness'
]);
const PREREQUISITES=Object.freeze({
 quest_wage_aftermath:['quest_wage_file','wages_restored'],
 quest_kitchen_return:['quest_kitchen_table','care_recovered'],
 quest_ward_return:['quest_ward_petition','ward_reopened'],
 quest_reference_file:['quest_wage_file','wages_restored'],
 quest_reference_return:['quest_reference_file','reference_raised'],
 quest_grey_manifest:['quest_night_market','market_profit'],
 quest_grey_witness:['quest_grey_manifest','grey_reported']
});
const FOLLOWUPS=Object.freeze([
 ['quest_wage_file','quest_wage_aftermath'],
 ['quest_kitchen_table','quest_kitchen_return'],
 ['quest_ward_petition','quest_ward_return'],
 ['quest_reference_file','quest_reference_return'],
 ['quest_grey_manifest','quest_grey_witness']
]);
const files=['js/systems/story-quests.js','js/systems/story-consequence-arcs.js',
 'js/systems/story-rpg-checks.js','js/systems/story-quest-engine.js'];
function context(seed){
 const ctx=createWorldContext();
 loadGameFiles(ctx,files);
 expose(ctx,`Random.setSeed(`+JSON.stringify(seed)+`);newWorld();newLineage();newHold();newSubject();
 S.age=28;S.alive=true;S.mother.alive=true;S.assets=800;S.health=85;
 S.smarts=65;S.happiness=70;S.relations=60;S.jailUntil=0;
 World.year=S.dob+S.age;StorySystem.ensure(World);
 const firm=BusinessSystem.create(World,{settlementId:World.activeSettlementId,
  sector:'retail',name:'Synthetic Scenario Workshop'});
 EmploymentSystem.hire(World,{personId:'subject',businessId:firm.id,
  annualSalary:1350,occupationName:'Worker',jobTier:1});`);
 return ctx;
}
const SETUP=`(function(params){
 const a=params.archive||null;
 if(a){
  const key='story-archive:'+String(++World.storyArchiveCounter).padStart(5,'0');
  World.storyArchive[key]={id:key,episodeId:a[0],endingId:a[1],endingTitle:'Previous outcome',
   startedYear:World.year-2,resolvedYear:World.year-1,quest:true};
 }
 if(params.id==='quest_school_press'){S.age=22;World.year=S.dob+S.age;}
 return true;
})`;
const PLAY=`(function(params){
 const id=params.id,policy=params.policy,year=World.year;
 const opts=()=>({subject:S,lineage:Lineage,year:World.year});
 const initial=StorySystem.availableQuests(World,opts()).map(q=>q.id);
 const before=RPG.meritOf(World,'subject');
 const started=StorySystem.startQuest(World,id,Object.assign({remainingEnergy:4},opts()));
 if(!started.ok)return {id,policy,started:false,reason:started.reason,initial};
 const applied=StorySystem.liveRun(World);
 const record=applied&&applied.id;
 const result={id,policy,started:true,initialAvailable:initial.includes(id),
  energyCost:started.energyCost,steps:0,rolls:0,successes:0,
  choices:0,endingId:null,meritDelta:null,duplicatePayouts:0,
  completed:false,filed:false,errors:[]};
 for(let k=0;k<32;k++){
  const view=StorySystem.currentView(World,opts());
  if(!view){result.errors.push('null_view');break;}
  if(view.type==='ending'){
   result.endingId=view.ending&&view.ending.id;
   result.completed=!!result.endingId&&result.endingId!=='unlabeled';
   const file=StorySystem.fileAway(World,view.runId,{year:World.year});
   result.filed=!!file.applied;
   result.meritDelta=RPG.meritOf(World,'subject')-before;
   const meritNow=RPG.meritOf(World,'subject');
   const repeated=StorySystem.fileAway(World,view.runId,{year:World.year});
   result.duplicatePayouts=meritNow!==RPG.meritOf(World,'subject')||repeated.applied?1:0;
   result.archiveCount=Object.values(World.storyArchive||{}).filter(a=>a.episodeId===id).length;
   result.invariants=StorySystem.checkInvariants(World);
   break;
  }
  if(view.type==='line'||view.type==='transition'){
   StorySystem.next(World,opts());result.steps++;continue;
  }
  if(view.type!=='choice'){result.errors.push('unexpected_view_'+view.type);break;}
  const options=view.options.filter(o=>o.available!==false);
  if(!options.length){result.errors.push('no_available_choice');break;}
  const safe=options.filter(o=>!o.check&&!o.unavailableReason);
  let picked;
  if(policy==='safe')picked=safe[0]||options[0];
  else if(policy==='bold')picked=options.filter(o=>o.check).sort((a,b)=>a.check.percent-b.check.percent)[0]||options[0];
  else picked=options.filter(o=>o.check&&o.check.percent>=60)
   .sort((a,b)=>b.check.percent-a.check.percent)[0]||safe[0]||options[0];
  if(!picked){result.errors.push('missing_choice');break;}
  const action=StorySystem.choose(World,picked.index,opts());
  if(!action||!action.applied){result.errors.push('choice_rejected_'+(action&&action.reason));break;}
  result.choices++;result.steps++;
  if(action.check){result.rolls++;if(action.check.success)result.successes++;}
 }
 if(!result.filed&&result.steps>=32)result.errors.push('step_guard');
 if(result.filed&&result.archiveCount!==1)result.errors.push('archive_duplicates');
 if(result.filed&&result.meritDelta!==(id==='quest_wage_file'?60:20))
  result.errors.push('merit_mismatch');
 if(result.invariants&&result.invariants.length)
  result.errors.push('story_invariants:'+result.invariants.join(';'));
 return result;
})`;
function execute(ctx,id,policy,archive){
 expose(ctx,'('+SETUP+')('+JSON.stringify({id,archive})+')');
 return JSON.parse(expose(ctx,'JSON.stringify(('+PLAY+')('+JSON.stringify({id,policy})+'))'));
}
const raw=[],failures=[];
for(const id of QUEST_IDS){
 for(const policy of POLICIES){
  for(const seed of SEEDS){
   const ctx=context('rpg-p5:'+id+':'+policy+':'+seed);
   const out=execute(ctx,id,policy,PREREQUISITES[id]||null);
   out.seedIndex=seed;
   raw.push(out);
   if(!out.started||!out.completed||!out.filed||!out.initialAvailable||
      out.duplicatePayouts||out.errors.length)
      failures.push({id,policy,seed,reason:out.reason||out.errors.join(',')||'incomplete'});
  }
 }
}
const followups=[];
for(const [first,next] of FOLLOWUPS){
 const ctx=context('followup:'+first);
 const prior=PREREQUISITES[first]||null;
 const firstResult=execute(ctx,first,'safe',prior);
 if(!firstResult.completed||!firstResult.filed){
  followups.push({id:next,failed:'first_chapter_incomplete'});continue;
 }
 const sameYear=JSON.parse(expose(ctx,`JSON.stringify(StorySystem.availableQuests(World,
  {subject:S,lineage:Lineage}).map(q=>q.id))`));
 expose(ctx,'World.year++;S.age++;');
 const nextYear=JSON.parse(expose(ctx,`JSON.stringify(StorySystem.availableQuests(World,
  {subject:S,lineage:Lineage}).map(q=>q.id))`));
 const second=execute(ctx,next,'prudent',null);
 const r={id:next,after:first,firstFiling:firstResult.filed,
  sameYearAvailable:sameYear.includes(next),
  nextYearAvailable:nextYear.includes(next),
  followupFiling:second.filed,
  duplicatedMerit:!!second.duplicatePayouts,
  firstEnding:firstResult.endingId,secondEnding:second.endingId};
 followups.push(r);
 if(r.sameYearAvailable||!r.nextYearAvailable||!r.followupFiling||r.duplicatedMerit)
  failures.push({id:next,policy:'followup',seed:0,reason:second.reason||second.errors.join(',')||'followup_gate'});
}
const results=[];
for(const id of QUEST_IDS)for(const policy of POLICIES){
 const a=raw.filter(r=>r.id===id&&r.policy===policy);
 const endings={};
 a.forEach(r=>{if(r.endingId)endings[r.endingId]=(endings[r.endingId]||0)+1;});
 results.push({
  id,policy,runs:a.length,
  completed:a.filter(r=>r.completed).length,
  filed:a.filter(r=>r.filed).length,
  checks:a.reduce((n,r)=>n+r.rolls,0),
  successes:a.reduce((n,r)=>n+r.successes,0),
  choices:a.reduce((n,r)=>n+r.choices,0),
  maxSteps:Math.max(...a.map(r=>r.steps)),
  duplicatePayouts:a.reduce((n,r)=>n+r.duplicatePayouts,0),
  endings
 });
}
const report={
 schema:'life-file-rpg-simulated-playthrough-v1',
 provenance:'automated_agent_simulation_not_human_testing',
 sessions:raw.length,terminalRuns:raw.filter(r=>r.completed&&r.filed).length,
 chapterCount:QUEST_IDS.length,seedsPerPolicy:SEEDS.length,
 policies:POLICIES.slice(),uniqueQuestIds:QUEST_IDS.slice(),
 results,followups,failures
};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 console.log('Synthetic engine playthroughs '+report.terminalRuns+'/'+report.sessions+
  ', failures '+failures.length);
 for(const r of results)console.log(r.id+' / '+r.policy+': '+r.completed+'/'+r.runs+
  ', rolls '+r.checks+', outcomes '+Object.entries(r.endings).map(([k,v])=>k+':'+v).join('; '));
}
if(failures.length||followups.length!==FOLLOWUPS.length)process.exitCode=1;
