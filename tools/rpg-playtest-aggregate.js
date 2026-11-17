'use strict';
/* Offline-only aggregation of user-provided anonymous formative reports.
 * Validates complete schema before stdout; never interprets reports as proof of human identity. */
const fs=require('node:fs');
const EXPECT={
 report:['schema','form','transfer','ratings','snapshot'],
 ratings:['agency','clarity','enjoyment'],
 snapshot:['scope','archivedChapters','uniqueEndings','documentedChecks',
  'zeroCheckArchives','unknownCheckArchives','activeChapters','arcs',
  'grade','merit','availableLeads','energyUsed','energyTotal']
};
const ARC=new Set(['WORK','FAMILY','BUREAU','SCHOOL','TRADE','CAREER','UNDERWORLD','OTHER']);
function invalid(reason){const e=new Error('INVALID REPORT: '+reason);e.code='BAD_REPORT';throw e;}
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function keys(v,allowed,label){
 if(!object(v))invalid(label+' must be an object');
 const got=Object.keys(v).sort();
 const want=allowed.slice().sort();
 if(got.length!==want.length||got.some((k,i)=>k!==want[i]))
  invalid(label+' has missing or unrecognized fields');
}
function integer(v,lo,hi,tag,nullable=false){
 if(nullable&&v===null)return;
 if(!Number.isSafeInteger(v)||v<lo||v>hi)invalid(tag+' out of range');
}
function checkReport(item){
 keys(item,EXPECT.report,'top-level');
 if(item.schema!=='life-file-playtest-v1'||
    item.form!=='unvalidated_formative_3_item'||
    item.transfer!=='user_initiated_export_only')
  invalid('unsupported schema or provenance');
 keys(item.ratings,EXPECT.ratings,'ratings');
 for(const k of EXPECT.ratings){
  const val=item.ratings[k];
  if(val!==null)integer(val,1,5,'rating '+k);
 }
 const s=item.snapshot;
 keys(s,EXPECT.snapshot,'snapshot');
 if(s.scope!=='retained_archive')invalid('unexpected archive scope');
 integer(s.archivedChapters,0,64,'archives');
 integer(s.uniqueEndings,0,64,'endings');
 if(s.uniqueEndings>s.archivedChapters)invalid('endings exceed archive count');
 integer(s.documentedChecks,0,6400000,'documented checks');
 integer(s.zeroCheckArchives,0,64,'zero rolls');
 integer(s.unknownCheckArchives,0,64,'unknown rolls');
 if(s.zeroCheckArchives+s.unknownCheckArchives>s.archivedChapters)
  invalid('archive counts inconsistent');
 integer(s.activeChapters,0,1,'active stories');
 integer(s.grade,1,8,'grade',true);
 integer(s.merit,0,9999,'merit',true);
 integer(s.availableLeads,0,12,'open leads',true);
 integer(s.energyUsed,0,12,'energy used',true);
 integer(s.energyTotal,0,12,'energy total',true);
 if(s.energyUsed!==null&&s.energyTotal!==null&&s.energyUsed>s.energyTotal)
  invalid('energy counts inconsistent');
 if(!object(s.arcs))invalid('arcs must be an object');
 let sum=0;
 for(const [key,val] of Object.entries(s.arcs)){
  if(!ARC.has(key))invalid('unrecognized arc');
  integer(val,0,64,'arc count');sum+=val;
 }
 if(sum!==s.archivedChapters)invalid('arc counts inconsistent');
 return true;
}
function median(sorted){
 if(!sorted.length)return null;
 return sorted.length%2?sorted[(sorted.length-1)/2]:
  (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
}
function summarize(items){
 if(!Array.isArray(items)||items.length<1||items.length>256)
  invalid('expected nonempty report array of at most 256');
 items.forEach(checkReport);
 const answer={};
 for(const key of EXPECT.ratings){
  const values=items.map(x=>x.ratings[key]).filter(x=>x!==null).sort((a,b)=>a-b);
  const distribution=[1,2,3,4,5].map(value=>values.filter(n=>n===value).length);
  answer[key]={n:values.length,missing:items.length-values.length,
   median:median(values),distribution};
 }
 const chapters=items.map(x=>x.snapshot.archivedChapters).sort((a,b)=>a-b);
 return{
  schema:'life-file-rpg-aggregate-v1',
  provenance:'user_supplied_anonymous_reports_unverified',
  reports:items.length,
  items:answer,
  retainedArchive:{
   nWithArchive:chapters.filter(x=>x>0).length,
   medianChapters:median(chapters)
  },
  limitation:'Descriptive results only; no identity, independence or human-participant status verified'
 };
}
function main(){
 const argv=process.argv.slice(2);
 if(argv.length!==2||argv[0]!=='--file'||!argv[1]){
  process.stderr.write('Usage: node tools/rpg-playtest-aggregate.js --file <local-json-file>\n');
  process.exitCode=2;return;
 }
 try{
  const path=argv[1],stat=fs.statSync(path);
  if(!stat.isFile()||stat.size>1024*1024||stat.size<2)
   invalid('input size or type unsupported');
  const doc=JSON.parse(fs.readFileSync(path,'utf8'));
  const result=summarize(doc);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }catch(e){
  process.stderr.write('INVALID REPORT: '+(e&&e.code==='BAD_REPORT'?
   e.message.replace(/^INVALID REPORT: /,''):'unable to parse local JSON file')+'\n');
  process.exitCode=1;
 }
}
if(require.main===module)main();
module.exports={checkReport,summarize};
