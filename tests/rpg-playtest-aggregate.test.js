'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const cli=path.resolve(__dirname,'../tools/rpg-playtest-aggregate.js');
function fixture(overrides={}){
 return Object.assign({
  schema:'life-file-playtest-v1',
  form:'unvalidated_formative_3_item',
  transfer:'user_initiated_export_only',
  ratings:{enjoyment:5,agency:4,clarity:null},
  snapshot:{
   scope:'retained_archive',archivedChapters:3,uniqueEndings:3,
   documentedChecks:2,zeroCheckArchives:1,unknownCheckArchives:1,
   activeChapters:0,arcs:{BUREAU:1,CAREER:1,WORK:1},
   grade:2,merit:60,availableLeads:3,energyUsed:1,energyTotal:4
  }
 },overrides);
}
function invoke(reports){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'life-rpg-aggregate-'));
 try{
  const file=path.join(dir,'reports.json');
  fs.writeFileSync(file,JSON.stringify(reports),'utf8');
  return spawnSync(process.execPath,[cli,'--file',file],{encoding:'utf8',timeout:5000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('offline anonymous reports aggregate missing ratings and exact ordinal distributions',()=>{
 const a=fixture();
 const b=fixture({ratings:{enjoyment:2,agency:3,clarity:3},
  snapshot:{...fixture().snapshot,archivedChapters:1,uniqueEndings:1,
   unknownCheckArchives:0,zeroCheckArchives:0,arcs:{WORK:1}}});
 const c=fixture({ratings:{enjoyment:null,agency:5,clarity:1},
  snapshot:{...fixture().snapshot,archivedChapters:0,uniqueEndings:0,
   documentedChecks:0,zeroCheckArchives:0,unknownCheckArchives:0,
   arcs:{},activeChapters:1}});
 const r=invoke([a,b,c]);
 assert.equal(r.status,0,(r.stderr||r.stdout).slice(0,1500));
 const out=JSON.parse(r.stdout);
 assert.equal(out.schema,'life-file-rpg-aggregate-v1');
 assert.equal(out.provenance,'user_supplied_anonymous_reports_unverified');
 assert.equal(out.reports,3);
 assert.deepEqual(out.items.enjoyment,{n:2,missing:1,median:3.5,distribution:[0,1,0,0,1]});
 assert.deepEqual(out.items.agency,{n:3,missing:0,median:4,distribution:[0,0,1,1,1]});
 assert.deepEqual(out.items.clarity,{n:2,missing:1,median:2,distribution:[1,0,1,0,0]});
 assert.equal(out.retainedArchive.nWithArchive,2);
 assert.equal(out.retainedArchive.medianChapters,1);
 assert.doesNotMatch(r.stdout,/persona|player name|seed|birthYear/);
});
test('malformed/unknown report fields or identifying material are rejected instead of silently leaked',()=>{
 const bad=[
  fixture({name:'PERSONAL_NAME'}),
  fixture({ratings:{enjoyment:9,agency:2,clarity:2}}),
  fixture({ratings:{enjoyment:true,agency:2,clarity:2}}),
  fixture({ratings:{enjoyment:2,agency:3,clarity:2,realName:'PRIVATE'}}),
  fixture({snapshot:{...fixture().snapshot,seed:'PRIVATE_SEED'}}),
  fixture({snapshot:{...fixture().snapshot,archivedChapters:3,arcs:{BUREAU:99}}}),
  fixture({schema:'unknown-v1'})
 ];
 for(const [i,item] of bad.entries()){
  const r=invoke([item]);
  assert.notEqual(r.status,0,'case '+i);
  assert.equal(r.stdout,'','must not output invalid or private input');
  assert.match(r.stderr,/INVALID REPORT/i);
  assert.doesNotMatch(r.stderr,/PERSONAL_NAME|PRIVATE_SEED|PRIVATE/);
 }
});
test('malformed file and absent --file argument exit without creating results',()=>{
 const r=spawnSync(process.execPath,[cli],{encoding:'utf8',timeout:5000});
 assert.notEqual(r.status,0);
 assert.equal(r.stdout,'');
 assert.match(r.stderr,/--file/i);
 const other=invoke({not:'an array'});
 assert.notEqual(other.status,0);
 assert.equal(other.stdout,'');
});
test('aggregate CLI is deterministic and has a discoverable npm command',()=>{
 const reports=[fixture(),fixture({ratings:{enjoyment:null,agency:3,clarity:2}})];
 const a=invoke(reports),b=invoke(reports);
 assert.equal(a.status,0,a.stderr);
 assert.equal(b.status,0,b.stderr);
 assert.equal(a.stdout,b.stdout);
 const pkg=require('../package.json');
 assert.equal(pkg.scripts['aggregate:rpg'],
  'node tools/rpg-playtest-aggregate.js --file');
});
