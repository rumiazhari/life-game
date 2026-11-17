'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'../tools/rpg-release-qa.js');
function mod(){assert.ok(fs.existsSync(file),'release QA runner is required');return require(file);}
test('release audit stress-replays identical save/migration chronology and bounded snapshots',()=>{
 const {runReleaseQa}=mod();
 const report=runReleaseQa({seeds:[1,2],years:12});
 assert.equal(report.schema,'life-file-rpg-release-qa-v1');
 assert.equal(report.provenance,'automated_vm_and_browser_qa_not_human_testing');
 assert.equal(report.yearsPerSeed,12);
 assert.equal(report.seedCount,2);
 assert.equal(report.stressCycles,48);
 assert.equal(report.storyContinuations,4);
 assert.equal(report.reproducibleSeeds,2);
 assert.equal(report.failures.length,0);
 assert.ok(report.performance.totalMs>=0);
 assert.ok(report.performance.maxSnapshotBytes>1000);
 assert.ok(report.performance.maxSnapshotBytes<20*1024*1024);
 assert.ok(report.memory.peakHeapBytes>=report.memory.startHeapBytes);
});
test('release runner fails visibly on deliberately malformed/corrupted save payloads',()=>{
 const {runReleaseQa}=mod();
 const report=runReleaseQa({seeds:[9],years:3});
 assert.equal(report.corruptionRejections,report.corruptionProbes);
 assert.ok(report.corruptionProbes>=4);
 assert.deepEqual(report.failures,[]);
});
test('release QA source includes real StorySystem continuation and canonical migrations',()=>{
 const code=fs.readFileSync(file,'utf8');
 assert.match(code,/LifeFileSave\.(encode|prepare)/);
 assert.match(code,/StorySystem\.(startQuest|fileAway)/);
 assert.match(code,/WorldSimulation\.migrate/);
 assert.match(code,/NpcSystem\.checkInvariants/);
 assert.doesNotMatch(code,/Math\.random/);
});
test('release artifacts are explicitly labeled non-deployed and include known Android limitation',()=>{
 assert.ok(fs.existsSync('docs/releases/2026-11-17-rpg-phases-6-12.md'));
 const notes=fs.readFileSync('docs/releases/2026-11-17-rpg-phases-6-12.md','utf8');
 assert.match(notes,/Phases 6–12|Phases 6-12/);
 assert.match(notes,/Android/i);
 assert.match(notes,/not deployed|no deployment|deployment not/i);
 assert.match(notes,/manual/i);
});
