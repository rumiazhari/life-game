'use strict';
/* Manual, local, opt-in RPG active-life export/import. NO autosave or network. */
(function(root){
 const SCHEMA='life-file-save-v1',MAX_BYTES=20*1024*1024;
 const forbidden=new Set(['__proto__','prototype','constructor']);
 const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const fail=reason=>({ok:false,reason});
 const bytes=s=>{
  if(s.length>MAX_BYTES)return MAX_BYTES+1;
  let n=0;
  for(const ch of s){
   const v=ch.codePointAt(0);
   n+=v<128?1:v<2048?2:v<65536?3:4;
   if(n>MAX_BYTES)return n;
  }
  return n;
 };
 const checksum=s=>{
  let hash=2166136261;
  for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}
  return hash.toString(16).padStart(8,'0');
 };
 function safeShape(obj){
  const work=[{v:obj,depth:0}];let nodes=0;
  while(work.length){
   const {v,depth}=work.pop();
   if(++nodes>125000||depth>65)return 'deep_or_large_structure';
   if(v==null||typeof v!=='object')continue;
   if(!Array.isArray(v)&&!plain(v))return 'invalid_object';
   const names=Object.keys(v);
   if(names.length>45000)return 'large_collection';
   for(const key of names){
    if(forbidden.has(key))return 'unsafe_key';
    const value=v[key];
    if(typeof value==='function'||typeof value==='symbol')return 'invalid_field';
    if(value&&typeof value==='object')work.push({v:value,depth:depth+1});
   }
  }
  return '';
 }
 function validate(x){
  if(!plain(x)||!plain(x.world)||!plain(x.subject)||!plain(x.lineage)||!plain(x.hold)||
   !Array.isArray(x.followups))return 'missing_state';
  const w=x.world,s=x.subject;
  if(typeof w.seed!=='string'||!w.seed||!Number.isInteger(w.year)||
   w.year< -5000||w.year>5000||!plain(w.settlements)||!plain(w.npcs)||
   !plain(w.storyRuns)||!plain(w.storyArchive))return 'invalid_world';
  if(!Number.isInteger(s.dob)||!Number.isInteger(s.age)||s.age<0||s.age>150||
   w.year!==s.dob+s.age||typeof s.npcId!=='string'||!plain(w.npcs[s.npcId]))
   return 'inconsistent_subject';
  if(x.followups.length>256)return 'large_followups';
  return safeShape(x);
 }
 function encode(snapshot){
  try{
   if(!snapshot)return fail('missing_state');
   const raw=JSON.stringify(snapshot);
   if(typeof raw!=='string'||raw.length>MAX_BYTES)return fail('too_large');
   const safe=JSON.parse(raw),bad=validate(safe);
   if(bad)return fail(bad);
   const payload=JSON.stringify(safe);
   const meta={schema:SCHEMA,version:1,checksum:checksum(payload),payload:safe};
   const text=JSON.stringify(meta);
   const length=bytes(text);
   if(length>MAX_BYTES)return fail('too_large');
   return {ok:true,text,bytes:length,checksum:meta.checksum};
  }catch(_){return fail('serialization_failed');}
 }
 function decode(text){
  if(typeof text!=='string')return fail('invalid_input');
  if(text.length>MAX_BYTES||bytes(text)>MAX_BYTES)return fail('too_large');
  let parsed;
  try{parsed=JSON.parse(text);}catch(_){return fail('malformed_json');}
  if(!plain(parsed)||parsed.schema!==SCHEMA||parsed.version!==1)return fail('unsupported_schema');
  if(!/^[0-9a-f]{8}$/.test(parsed.checksum||''))return fail('invalid_checksum');
  const bad=validate(parsed.payload);
  if(bad)return fail(bad);
  if(checksum(JSON.stringify(parsed.payload))!==parsed.checksum)return fail('checksum_mismatch');
  return {ok:true,snapshot:parsed.payload,checksum:parsed.checksum};
 }
 function prepare(text){
  const d=decode(text);
  if(!d.ok)return d;
  try{
   // Detached decoded data. Active game globals are never altered by validation/migration.
   const x=d.snapshot,w=x.world,s=x.subject,l=x.lineage;
   if(root.WorldSimulation&&root.WorldSimulation.migrate)
    root.WorldSimulation.migrate(w,{subject:s});
   if(root.NpcSystem&&root.NpcSystem.migrate)
    root.NpcSystem.migrate(w,s,l);
   if(root.StorySystem&&root.StorySystem.ensure)root.StorySystem.ensure(w);
   if(root.RPG&&root.RPG.migrate)root.RPG.migrate(w);
   const bad=validate(x);
   if(bad)return fail('migration_'+bad);
   if(root.StorySystem&&root.StorySystem.checkInvariants){
    const problems=root.StorySystem.checkInvariants(w);
    if(problems&&problems.length)return fail('invalid_story_state');
   }
   return {ok:true,snapshot:x,checksum:d.checksum};
  }catch(_){return fail('migration_failed');}
 }
 root.LifeFileSave=Object.freeze({SCHEMA,MAX_BYTES,encode,decode,prepare,checksum});
})(typeof globalThis!=='undefined'?globalThis:this);
