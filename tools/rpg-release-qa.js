'use strict';
/* Phase 12: reproducible, synthetic release QA. No user data, no autosave or deployment. */
const fs=require('node:fs'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const {createWorldContext,loadGameFiles,expose}=require('../tests/helpers/vm-loader');
const ROOT=path.resolve(__dirname,'..');
const MODULES=['js/systems/story-quests.js','js/systems/story-consequence-arcs.js',
 'js/systems/story-rpg-checks.js','js/systems/rpg-progression.js',
 'js/systems/story-quest-engine.js','js/systems/story-context.js',
 'js/systems/story-social.js','js/systems/story-threads.js','js/systems/life-file-save.js'];
const value=(c,text)=>JSON.parse(expose(c,'JSON.stringify((()=>{'+text+'})())'));
function fixture(seed){
 const c=createWorldContext();loadGameFiles(c,MODULES);
 expose(c,"Random.setSeed("+JSON.stringify('release-seed-'+seed)+");"+
  "newWorld();newLineage();newHold();newSubject();"+
  "S.age=24;S.alive=true;S.mother.alive=true;S.assets=900;S.health=85;"+
  "World.year=S.dob+S.age;NpcSystem.syncLegacy(World,S,Lineage);StorySystem.ensure(World);"+
  "const business=BusinessSystem.create(World,{settlementId:World.activeSettlementId,"+
  "sector:'retail',name:'Release Test Workshop'});"+
  "EmploymentSystem.hire(World,{personId:'subject',businessId:business.id,"+
  "annualSalary:1500,occupationName:'Tester',jobTier:2});"+
  "RPG.recordFor(World,'subject');followups=[{at:S.age+2,t:'Saved pending reminder',fx:{happiness:1}}];");
 return c;
}
const CONTINUE=`(function(){
 const q=StorySystem.availableQuests(World,{subject:S,lineage:Lineage}).find(v=>v.id==='quest_kitchen_table');
 if(!q)return {ok:false,reason:'chapter_unavailable'};
 const start=StorySystem.startQuest(World,q.id,{subject:S,lineage:Lineage,year:World.year,remainingEnergy:3});
 if(!start.ok)return {ok:false,reason:start.reason};
 StorySystem.next(World,{subject:S,year:World.year});
 const archive=LifeFileSave.encode({world:World,subject:S,lineage:Lineage,hold:Hold,followups});
 if(!archive.ok)return {ok:false,reason:archive.reason};
 const before=World.seed,runId=StorySystem.liveRun(World).id;
 newWorld();newLineage();newHold();newSubject();
 const fresh=World.seed,restored=LifeFileSave.prepare(archive.text);
 if(!restored.ok)return {ok:false,reason:'restore_'+restored.reason};
 World=restored.snapshot.world;S=restored.snapshot.subject;
 Lineage=restored.snapshot.lineage;Hold=restored.snapshot.hold;followups=restored.snapshot.followups;
 let steps=0,view=null;
 for(;steps<24;steps++){
  view=StorySystem.currentView(World,{subject:S,lineage:Lineage,year:World.year});
  if(!view)break;
  if(view.type==='ending')break;
  if(view.type==='choice'){
   const choice=view.options.find(o=>o.available!==false&&!o.check)||
    view.options.find(o=>o.available!==false);
   if(!choice)break;
   const action=StorySystem.choose(World,choice.index,{subject:S,lineage:Lineage,year:World.year});
   if(!action.applied)break;
  }else StorySystem.next(World,{subject:S,lineage:Lineage,year:World.year});
 }
 if(!view||view.type!=='ending')return {ok:false,reason:'continuation_softlock'};
 const beforeMerit=RPG.meritOf(World,'subject');
 const file=StorySystem.fileAway(World,runId,{year:World.year});
 const extra=StorySystem.fileAway(World,runId,{year:World.year});
 return {ok:file.applied&&!extra.applied&&RPG.meritOf(World,'subject')-beforeMerit===20&&
  World.seed===before&&StorySystem.checkInvariants(World).length===0,
  steps,runId,seedStable:World.seed===before,merit:RPG.meritOf(World,'subject')-beforeMerit,
  followups:followups.length,archives:Object.keys(World.storyArchive).length,
  activeRuns:Object.keys(World.storyRuns).length,reason:''};
})`;
const YEAR=`(function(){
 World.year++;S.age++;
 WorldSimulation.migrate(World,{subject:S});
 NpcSystem.migrate(World,S,Lineage);
 StorySystem.ensure(World);RPG.migrate(World);
 const once=JSON.stringify(World);
 WorldSimulation.migrate(World,{subject:S});
 NpcSystem.migrate(World,S,Lineage);
 StorySystem.ensure(World);RPG.migrate(World);
 const consistent=once===JSON.stringify(World);
 const prepared=LifeFileSave.encode({world:World,subject:S,lineage:Lineage,hold:Hold,followups});
 if(!prepared.ok)return {ok:false,reason:prepared.reason};
 const migrated=LifeFileSave.prepare(prepared.text);
 const violations=[...StorySystem.checkInvariants(World),
  ...NpcSystem.checkInvariants(World,S,Lineage),
  ...EmploymentSystem.checkInvariants(World)];
 return {ok:consistent&&migrated.ok&&violations.length===0,
  consistent,verified:migrated.ok,violations,size:prepared.bytes,
  checksum:prepared.checksum,age:S.age,year:World.year,
  storyArchive:Object.keys(World.storyArchive||{}).length,
  npcCount:Object.keys(World.npcs||{}).length};
})`;
function runOnce(seed,years){
 const start=performance.now(),c=fixture(seed),errors=[];
 const continuation=JSON.parse(expose(c,'JSON.stringify(('+CONTINUE+')())'));
 if(!continuation.ok)errors.push('continuation_'+(continuation.reason||'failed'));
 let maxSnapshotBytes=0,lastChecksum='',maxArchive=0,peakCycleMs=0,cycles=0;
 for(let i=0;i<years;i++){
  const before=performance.now();
  const result=JSON.parse(expose(c,'JSON.stringify(('+YEAR+')())'));
  const elapsed=performance.now()-before;
  cycles++;peakCycleMs=Math.max(peakCycleMs,elapsed);
  if(!result.ok)errors.push('year_'+i+':'+(result.reason||result.violations.join(';')||'invariant'));
  maxSnapshotBytes=Math.max(maxSnapshotBytes,result.size||0);
  maxArchive=Math.max(maxArchive,result.storyArchive||0);
  lastChecksum=result.checksum||lastChecksum;
  if(result.storyArchive>64)errors.push('archive_overflow');
  if(result.size>20*1024*1024)errors.push('file_oversize');
 }
 return {seed,years,cycles,continuation:continuation.ok,maxSnapshotBytes,maxArchive,
  lastChecksum,peakCycleMs:Math.round(peakCycleMs*100)/100,
  durationMs:Math.round((performance.now()-start)*100)/100,errors};
}
function corruptions(){
 const c=fixture('corruption');
 const obj=value(c,"const good=LifeFileSave.encode({world:World,subject:S,lineage:Lineage,hold:Hold,followups});"+
  "const parsed=JSON.parse(good.text);"+
  "return {original:good.text,modified:good.text.replace('Release Test Workshop','Fake Workshop'),"+
  "wrongSchema:JSON.stringify(Object.assign({},parsed,{schema:'unsupported'}))};");
 const enc=JSON.parse(obj.original);
 const checks=[
  '{invalid_json',obj.modified,obj.wrongSchema,JSON.stringify(Object.assign({},enc,{checksum:'deadbeef'})),
  'too-large-placeholder'
 ];
 let rejected=0;
 for(const [i,text] of checks.entries()){
  const raw=i===4?'x'.repeat(20*1024*1024+10):text;
  if(value(c,'return LifeFileSave.decode('+JSON.stringify(raw)+').ok;')===false)rejected++;
 }
 return {probes:checks.length,rejected};
}
function runReleaseQa(options={}){
 const seeds=Array.isArray(options.seeds)?options.seeds:[1,2,3];
 const years=Number.isInteger(options.years)?options.years:100;
 if(!seeds.length||seeds.length>12||years<1||years>100)throw Error('invalid_release_scope');
 if(typeof global.gc==='function')global.gc();
 const startHeap=process.memoryUsage().heapUsed,begin=performance.now();
 let peakHeap=startHeap;const data=[],failures=[];
 for(const seed of seeds){
  const first=runOnce(seed,years);peakHeap=Math.max(peakHeap,process.memoryUsage().heapUsed);
  const replay=runOnce(seed,years);peakHeap=Math.max(peakHeap,process.memoryUsage().heapUsed);
  data.push(first,replay);
  if(first.lastChecksum!==replay.lastChecksum||first.maxSnapshotBytes!==replay.maxSnapshotBytes)
   failures.push('seed_'+seed+'_not_reproducible');
  for(const run of [first,replay])failures.push(...run.errors.map(e=>'seed_'+seed+':'+e));
 }
 const corrupted=corruptions();
 if(corrupted.probes!==corrupted.rejected)failures.push('corrupt_save_accepted');
 const durationMs=Math.round((performance.now()-begin)*100)/100;
 if(typeof global.gc==='function')global.gc();
 const endHeap=process.memoryUsage().heapUsed;peakHeap=Math.max(peakHeap,endHeap);
 const totalCycles=data.reduce((n,s)=>n+s.cycles,0);
 const maxCycle=Math.max(...data.map(s=>s.peakCycleMs));
 const maxSnap=Math.max(...data.map(s=>s.maxSnapshotBytes));
 const limits={maxCycleMs:1500,maxTotalMs:120000,maxSnapshotBytes:20*1024*1024,
  maxHeapBytes:384*1024*1024};
 if(maxCycle>limits.maxCycleMs)failures.push('cycle_latency_exceeded');
 if(durationMs>limits.maxTotalMs)failures.push('total_latency_exceeded');
 if(maxSnap>limits.maxSnapshotBytes)failures.push('snapshot_limit_exceeded');
 if(peakHeap>limits.maxHeapBytes)failures.push('heap_limit_exceeded');
 return {schema:'life-file-rpg-release-qa-v1',
  provenance:'automated_vm_and_browser_qa_not_human_testing',
  scope:'deterministic_vm_migration_aging_not_full_mortality_simulation',
  seedCount:seeds.length,yearsPerSeed:years,stressCycles:totalCycles,
  storyContinuations:data.filter(x=>x.continuation).length,
  reproducibleSeeds:seeds.filter((_,i)=>data[2*i].lastChecksum===data[2*i+1].lastChecksum).length,
  corruptionProbes:corrupted.probes,corruptionRejections:corrupted.rejected,
  performance:{totalMs:durationMs,maxCycleMs:maxCycle,maxSnapshotBytes:maxSnap,limits},
  memory:{startHeapBytes:startHeap,peakHeapBytes:peakHeap,endHeapBytes:endHeap},
  runs:data,failures};
}
function main(){
 const argv=process.argv.slice(2),report=runReleaseQa(),out=JSON.stringify(report,null,2)+'\n';
 if(argv.includes('--write')){
  const dir=path.join(ROOT,'reports');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'rpg-release-qa.json'),out,'utf8');
 }
 if(argv.includes('--json'))process.stdout.write(out);
 else console.log('RPG release QA '+report.storyContinuations+' resumptions, '+
  report.stressCycles+' aging/migration cycles, '+report.corruptionRejections+'/'+report.corruptionProbes+
  ' corruptions rejected, failures '+report.failures.length+', elapsed '+report.performance.totalMs+' ms');
 if(report.failures.length)process.exitCode=1;
}
if(require.main===module)main();
module.exports={runReleaseQa,runOnce};
