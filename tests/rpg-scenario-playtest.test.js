'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const script=path.resolve(__dirname,'../tools/rpg-scenario-playtest.js');
const run=()=>spawnSync(process.execPath,[script,'--json'],{encoding:'utf8',timeout:120000});
test('real-engine simulated playthroughs finish 12 chapters for 3 policies and 5 seeds',()=>{
 const r=run();
 assert.equal(r.status,0,(r.stderr||r.stdout).slice(0,3000));
 const data=JSON.parse(r.stdout);
 assert.equal(data.schema,'life-file-rpg-simulated-playthrough-v1');
 assert.equal(data.provenance,'automated_agent_simulation_not_human_testing');
 assert.equal(data.sessions,180);
 assert.deepEqual(data.policies,['bold','prudent','safe']);
 assert.equal(data.chapterCount,12);
 assert.equal(data.seedsPerPolicy,5);
 assert.equal(data.results.length,36,'chapter-policy aggregates');
 assert.equal(data.failures.length,0,JSON.stringify(data.failures));
 assert.equal(data.terminalRuns,180);
 assert.equal(data.uniqueQuestIds.length,12);
 assert.ok(data.results.every(x=>x.completed===5&&x.filed===5&&x.duplicatePayouts===0));
 assert.ok(data.results.every(x=>x.maxSteps<=32));
});
test('all five multi-year follow-ups are unavailable in the same year and playable in next year',()=>{
 const r=run();
 assert.equal(r.status,0,r.stderr);
 const data=JSON.parse(r.stdout);
 assert.equal(data.followups.length,5);
 for(const row of data.followups){
  assert.equal(row.sameYearAvailable,false,row.id);
  assert.equal(row.nextYearAvailable,true,row.id);
  assert.equal(row.firstFiling,true,row.id);
  assert.equal(row.followupFiling,true,row.id);
  assert.equal(row.duplicatedMerit,false,row.id);
 }
});
test('simulated policy outcomes are byte-identical across repeated invocations',()=>{
 const one=run(),two=run();
 assert.equal(one.status,0,one.stderr);
 assert.equal(two.status,0,two.stderr);
 assert.equal(one.stdout,two.stdout);
});
test('simulate:rpg npm script points to the deterministic scenario CLI',()=>{
 const pkg=require('../package.json');
 assert.equal(pkg.scripts['simulate:rpg'],'node tools/rpg-scenario-playtest.js --json');
});
