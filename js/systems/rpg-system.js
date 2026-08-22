'use strict';
/* ================= RPG SYSTEM (root.RPG) ================= */
const RPG_GRADE_THRESHOLDS=[0,60,180,420,900,1800,3600,7200];
const RPG_MERIT_CAP=9999;
const RPG_HISTORY_CAP=24;
const RPG_SUBJECT_CAP=64;
const RPG_DOMAINS=['crime','hustle','social','labor','study','bureau'];
const RPG_PERKS=[
 {id:'cleanboots',name:'Clean Boots',desc:'Bureau eyes slide off you.',minGrade:1,mods:{bureau:1}},
 {id:'silvertongue',name:'Silver Tongue',desc:'Doors open before you knock.',minGrade:2,mods:{social:2}},
 {id:'ironstomach',name:'Iron Stomach',desc:'Nerve for dirty work.',minGrade:2,mods:{hustle:1}},
 {id:'bookkeeper',name:'Bookkeeper',desc:'Numbers never turn on you.',minGrade:3,mods:{labor:1,bureau:1}},
 {id:'nighteyes',name:'Night Eyes',desc:'The dark works for you.',minGrade:3,mods:{crime:1}},
 {id:'hardhands',name:'Hard Hands',desc:'Respect, earned early.',minGrade:4,mods:{labor:2}},
 {id:'fixer',name:'Fixer',desc:'Every problem has a price.',minGrade:4,mods:{crime:1,hustle:1}},
 {id:'silverink',name:'Silver Ink',desc:'Paper obeys the pen.',minGrade:5,mods:{study:2}},
 {id:'oldboys',name:"Old Boys' Ring",desc:'Favors compound quietly.',minGrade:5,mods:{bureau:2}},
 {id:'ghost',name:'The Ghost',desc:'Records misfile themselves.',minGrade:6,mods:{crime:2}}
];
const RPG_BACKGROUNDS=[
 {id:'streets',name:'Street Raised',line:'Learned the city before its laws.',perk:'nighteyes',bias:'crime'},
 {id:'scholar',name:"Scholar's Child",line:'Books were the only inheritance.',perk:'silverink',bias:'study'},
 {id:'veteran',name:'Veteran Household',line:'Discipline first, questions later.',perk:'hardhands',bias:'labor'}
];
const RPG_TN={easy:7,standard:9,hard:11,severe:13};
const RPG_PERK_IDS=RPG_PERKS.map(p=>p.id);
function romanGrade(g){return ['I','II','III','IV','V','VI','VII','VIII'][Math.max(1,Math.min(8,g|0))-1];}
(function(root){
 function ensure(world){
  if(!world||typeof world!=='object')return null;
  let r=world.rpg;
  if(!r||typeof r!=='object'||Array.isArray(r)){r={};world.rpg=r;}
  if(!r.subjects||typeof r.subjects!=='object'||Array.isArray(r.subjects))r.subjects={};
  if(typeof r.schemaVersion!=='number'||!isFinite(r.schemaVersion))r.schemaVersion=1;
  if(typeof r.counter!=='number'||!isFinite(r.counter)||r.counter<0)r.counter=0;
  return r;
 }
 function perkById(id){for(let i=0;i<RPG_PERKS.length;i++)if(RPG_PERKS[i].id===id)return RPG_PERKS[i];return null;}
 function bgById(id){for(let i=0;i<RPG_BACKGROUNDS.length;i++)if(RPG_BACKGROUNDS[i].id===id)return RPG_BACKGROUNDS[i];return null;}
 function clampInt(v,lo,hi){v=Number(v);if(!isFinite(v))return lo;return Math.max(lo,Math.min(hi,Math.round(v)));}
 function normalizeRecord(rec,id){
  const merit=clampInt(rec.merit,0,RPG_MERIT_CAP);
  const out={personId:id,merit:merit,grade:gradeForMerit(merit),
   perks:{},background:bgById(rec.background)?rec.background:null,
   lastTickYear:(typeof rec.lastTickYear==='number'&&isFinite(rec.lastTickYear))?Math.round(rec.lastTickYear):null,
   history:[]};
  Object.keys(rec.perks||{}).sort().forEach(k=>{if(k&&RPG_PERK_IDS.indexOf(k)>=0&&rec.perks[k])out.perks[k]=true;});
  const hist=Array.isArray(rec.history)?rec.history:[];
  for(let i=Math.max(0,hist.length-RPG_HISTORY_CAP);i<hist.length;i++){
   const h=hist[i];if(!h||typeof h!=='object')continue;
   out.history.push({year:clampInt(h.year,0,99999),delta:clampInt(h.delta,-999,999),reason:String(h.reason||'').slice(0,48)});
  }
  return out;
 }
 function gradeForMerit(m){let g=1;for(let i=0;i<RPG_GRADE_THRESHOLDS.length;i++){if(m>=RPG_GRADE_THRESHOLDS[i])g=i+1;}return Math.min(g,8);}
 function recordFor(world,personId){
  ensure(world);
  const id=String(personId||'subject');
  let rec=world.rpg.subjects[id];
  if(rec&&!rec.__normalized){const n=normalizeRecord(rec,id);world.rpg.subjects[id]=n;rec=n;rec.__normalized=true;}
  if(!rec){
   if(Object.keys(world.rpg.subjects).length>=RPG_SUBJECT_CAP)return null;
   rec={personId:id,merit:0,grade:1,perks:{},background:null,lastTickYear:null,history:[],__normalized:true};
   world.rpg.subjects[id]=rec;
   world.rpg.counter++;
  }
  return rec;
 }
 function migrate(world){
  ensure(world);
  const src=world.rpg.subjects,fresh={};
  Object.keys(src).sort().forEach(id=>{
   if(Object.keys(fresh).length>=RPG_SUBJECT_CAP)return;
   const raw=src[id];
   if(!raw||typeof raw!=='object'){fresh[id]={personId:id,merit:0,grade:1,perks:{},background:null,lastTickYear:null,history:[],__normalized:true};return;}
   fresh[id]=normalizeRecord(raw,id);fresh[id].__normalized=true;
  });
  world.rpg.subjects=fresh;
  return world.rpg;
 }
 function addMerit(world,personId,amount,reason,year){
  const rec=recordFor(world,personId);if(!rec)return {applied:false,reason:'cap'};
  const y=(typeof year==='number'&&isFinite(year))?Math.round(year):null;
  if(y!=null&&rec.history.some(h=>h.year===y&&h.reason===String(reason).slice(0,48)))return {applied:false,reason:'duplicate'};
  const delta=clampInt(amount,0,500);
  const before=rec.grade;
  rec.merit=clampInt(rec.merit+delta,0,RPG_MERIT_CAP);
  rec.grade=gradeForMerit(rec.merit);
  rec.history.push({year:y==null?0:y,delta,reason:String(reason||'').slice(0,48)});
  if(rec.history.length>RPG_HISTORY_CAP)rec.history=rec.history.slice(-RPG_HISTORY_CAP);
  return {applied:true,delta,merit:rec.merit,grade:rec.grade,leveledTo:rec.grade>before?rec.grade:null};
 }
 function perksFor(world,personId){
  const rec=world.rpg&&world.rpg.subjects&&world.rpg.subjects[String(personId||'subject')];
  if(!rec)return [];
  return Object.keys(rec.perks).filter(k=>rec.perks[k]).map(perkById).filter(Boolean);
 }
 function perkSlotCapacity(grade){return grade>=6?3:grade>=4?2:grade>=2?1:0;}
 function unlockPerk(world,personId,perkId){
  const rec=recordFor(world,personId);if(!rec)return {ok:false,reason:'cap'};
  const p=perkById(perkId);
  if(!p)return {ok:false,reason:'unknown'};
  if(rec.perks[p.id])return {ok:false,reason:'held'};
  if(rec.grade<p.minGrade)return {ok:false,reason:'grade'};
  const spent=Object.keys(rec.perks).filter(k=>{const def=perkById(k);return def&&!(rec.background&&bgById(rec.background)&&bgById(rec.background).perk===k);}).length;
  if(spent>=perkSlotCapacity(rec.grade))return {ok:false,reason:'slots'};
  rec.perks[p.id]=true;
  return {ok:true};
 }
 function modifierFor(world,personId,domain){
  const rec=recordFor(world,personId);
  const base=rec?Math.floor((rec.grade-1)/3):0;
  let perk=0;
  if(rec)perksFor(world,personId).forEach(p=>{if(p.mods&&p.mods[domain])perk+=p.mods[domain];});
  let bias=0;
  if(rec&&rec.background){const b=bgById(rec.background);if(b&&b.bias===domain)bias=1;}
  return {grade:base,perks:perk,bias,total:Math.max(-2,Math.min(6,base+perk+bias))};
 }
 function resolveCheck(world,opts){
  opts=opts||{};
  const stream=opts.stream;
  if(!stream||typeof stream.next!=='function')return {ok:false,reason:'no-stream'};
  const domain=RPG_DOMAINS.indexOf(opts.domain)>=0?opts.domain:'grit';
  const tn=RPG_TN[opts.difficulty]||RPG_TN.standard;
  const m=modifierFor(world,opts.actorId,domain);
  const bonus=clampInt(opts.bonus||0,-4,4);
  const rolls=[];
  for(let i=0;i<3;i++)rolls.push(1+Math.floor(stream.next()*6));
  const nat=rolls[0]+rolls[1]+rolls[2];
  const mod=Math.max(-4,Math.min(4,m.total+bonus));
  const total=nat+mod;
  const breakdown=[
   {label:'GRADE',value:m.grade},
   {label:'DISCRETIONS',value:m.perks+m.bias},
   {label:'CIRCUMSTANCE',value:bonus}
  ].filter(x=>x.value!==0);
  return {ok:true,domain,difficulty:opts.difficulty||'standard',rolls,nat,mod,total,tn,
   margin:total-tn,success:total>=tn,critical:nat===18,fumble:nat===3,breakdown};
 }
 function tickWorld(world,opts){
  opts=opts||{};
  const r=ensure(world);if(!r)return {applied:false,reason:'no-world'};
  const year=(typeof opts.year==='number'&&isFinite(opts.year))?Math.round(opts.year):null;
  if(year==null)return {applied:false,reason:'bad-year'};
  if(r.lastTickYear===year)return {applied:false,reason:'already_applied'};
  if(typeof year==='number'&&r.lastTickYear!=null&&year<r.lastTickYear)return {applied:false,reason:'stale_year'};
  const ids=['subject'].concat(Array.isArray(opts.familyIds)?opts.familyIds.slice(0,12):[]);
  ids.forEach(id=>{
   const rec=recordFor(world,id);if(!rec)return;
   rec.grade=gradeForMerit(rec.merit);
   let stipend=1;
   try{
    if(typeof EmploymentSystem==='object'&&EmploymentSystem&&typeof EmploymentSystem.activeForPerson==='function'&&id!=='subject'){
     stipend=EmploymentSystem.activeForPerson(world,id).length>0?2:0;
    }
   }catch(e){stipend=id==='subject'?1:0;}
   if(stipend>0)addMerit(world,id,stipend,'annual-stipend',year);
   rec.lastTickYear=year;
  });
  r.lastTickYear=year;
  return {applied:true,count:ids.length,year};
 }
 function summary(world){
  const r=ensure(world);if(!r)return {subjects:0};
  const keys=Object.keys(r.subjects);
  const grades={};
  keys.forEach(id=>{const g=r.subjects[id].grade;grades['G'+g]=(grades['G'+g]||0)+1;});
  return {subjects:keys.length,grades};
 }
 function checkInvariants(world){
  const out=[],r=ensure(world);
  if(!r)return ['rpg:missing'];
  const keys=Object.keys(r.subjects);
  if(keys.length>RPG_SUBJECT_CAP)out.push('rpg:subject-cap-exceeded');
  keys.forEach(id=>{
   const s=r.subjects[id];
   if(!isFinite(s.merit)||s.merit<0||s.merit>RPG_MERIT_CAP)out.push('rpg:merit-bounds:'+id);
   if(!isFinite(s.grade)||s.grade<1||s.grade>8)out.push('rpg:grade-bounds:'+id);
   Object.keys(s.perks||{}).forEach(k=>{if(s.perks[k]&&RPG_PERK_IDS.indexOf(k)<0)out.push('rpg:unknown-perk:'+id+':'+k);});
   if(s.background&&!bgById(s.background))out.push('rpg:unknown-background:'+id);
   if((s.history||[]).length>RPG_HISTORY_CAP)out.push('rpg:history-cap:'+id);
   if(gradeForMerit(s.merit)!==s.grade)out.push('rpg:grade-drift:'+id);
  });
  return out;
 }
 root.RPG={
  ensure,migrate,recordFor,addMerit,unlockPerk,perksFor,modifierFor,resolveCheck,tickWorld,summary,checkInvariants,
  gradeOf:(w,id)=>{const r=w&&w.rpg&&w.rpg.subjects[String(id||'subject')];return r?r.grade:1;},
  meritOf:(w,id)=>{const r=w&&w.rpg&&w.rpg.subjects[String(id||'subject')];return r?r.merit:0;},
  recordOf:w=>w&&w.rpg&&w.rpg.subjects.subject,
  setBackground:(w,id,bgId)=>{
   const rec=recordFor(w,id);if(!rec)return {ok:false,reason:'cap'};
   if(!bgById(bgId))return {ok:false,reason:'unknown'};
   if(rec.background)return {ok:false,reason:'set'};
   rec.background=bgId;
   const b=bgById(bgId);
   if(b&&b.perk&&!rec.perks[b.perk])rec.perks[b.perk]=true;
   return {ok:true};
  },
  GRADE_THRESHOLDS:RPG_GRADE_THRESHOLDS,MERIT_CAP:RPG_MERIT_CAP,PERKS:RPG_PERKS,BACKGROUNDS:RPG_BACKGROUNDS,TN:RPG_TN,DOMAINS:RPG_DOMAINS,roman:romanGrade
 };
})(typeof window!=='undefined'?window:globalThis);
