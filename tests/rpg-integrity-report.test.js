'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const coreFile=path.join(ROOT,'tools/rpg-integrity-core.js');
const reportFile=path.join(ROOT,'tools/rpg-integrity-report.js');
function modules(){
 assert.ok(fs.existsSync(coreFile),'RPG integrity core must exist');
 assert.ok(fs.existsSync(reportFile),'RPG integrity report runner must exist');
 return {core:require(coreFile),report:require(reportFile)};
}
test('integrity report exposes automated provenance, exact denominators and 216-state odds',()=>{
 const {core,report}=modules();
 const data=report.createReport({seeds:[1,2],policies:['safe','bold'],includeLegacy:false});
 assert.equal(data.schema,'life-file-rpg-integrity-v1');
 assert.equal(data.provenance,'automated_simulation_not_human_playtest');
 assert.equal(data.dynamic.sessions,16);
 assert.equal(data.dynamic.completed,16);
 assert.equal(data.dynamic.softlocks,0);
 assert.ok(data.odds.length>=4);
 for(const x of data.odds){
  assert.equal(x.outcomes,216);
  assert.ok(x.samples>=1200);
  assert.ok(x.exactPercent>=0&&x.exactPercent<=100);
  assert.ok(Math.abs(x.exactPercent-x.samplePercent)<=x.maxToleratedDeviation);
 }
 assert.deepEqual(core.collectFailures(data),[]);
});
test('deterministic safe and bold policies preserve real salary, no phantom cash and only 1 energy per chapter',()=>{
 const {report}=modules();
 const data=report.createReport({seeds:[3],policies:['safe','bold'],includeLegacy:false});
 assert.equal(data.dynamic.sessions,8);
 assert.equal(data.dynamic.energyCost,8);
 assert.equal(data.dynamic.meritEarned,160);
 for(const row of data.dynamic.scenarios){
  assert.equal(row.cost,1);
  assert.equal(row.meritDelta,20);
  assert.equal(row.duplicatePayouts,0);
  assert.equal(row.archiveCount,1);
  assert.equal(row.salaryAfter,row.salaryBefore);
  assert.equal(row.contractAfter,row.contractBefore);
  assert.equal(row.cashDelta,0);
  assert.ok(row.steps<=32);
  assert.equal(row.complete,true);
  assert.equal(row.energyRejectedBeforeStart,true);
  assert.deepEqual(row.invariants,[]);
 }
});
test('reproducible simulations and multi-year progression preserve exact scenario outputs',()=>{
 const {report}=modules();
 const a=report.createReport({seeds:[4],policies:['safe'],includeLegacy:false});
 const b=report.createReport({seeds:[4],policies:['safe'],includeLegacy:false});
 assert.deepEqual(a,b);
 assert.deepEqual(a.dynamic.scenarios.map(x=>x.stage),[0,1,0,1]);
 assert.ok(a.dynamic.scenarios.every(x=>x.followupVisibleSameYear===false));
 assert.ok(a.dynamic.scenarios.filter(x=>x.stage===1).every(x=>x.followupVisibleNextYear===true));
});
test('softlock detector rejects simulated route failures and contradictory economic records',()=>{
 const {core}=modules();
 const valid={schema:'life-file-rpg-integrity-v1',dynamic:{scenarios:[{complete:true,cost:1,meritDelta:20,archiveCount:1,duplicatePayouts:0,steps:4,invariants:[],cashDelta:0,contractBefore:'c:1',contractAfter:'c:1',salaryBefore:800,salaryAfter:800,energyRejectedBeforeStart:true}]},odds:[]};
 assert.deepEqual(core.collectFailures(valid),[]);
 const invalid=structuredClone(valid);
 invalid.dynamic.scenarios[0].complete=false;
 invalid.dynamic.scenarios[0].contractAfter='c:2';
 invalid.dynamic.scenarios[0].cost=2;
 assert.ok(core.collectFailures(invalid).length>=3);
});
test('HTML dashboard is self-contained, numerically tied to JSON and safe from injection',()=>{
 const {core,report}=modules();
 const data=report.createReport({seeds:[6],policies:['safe'],includeLegacy:false});
 const html=core.renderHtml(data);
 assert.match(html,/RPG Integrity|RPG INTEGRITY/);
 assert.match(html,/automated_simulation_not_human_playtest/);
 assert.match(html,new RegExp(String(data.dynamic.sessions)+''));
 assert.match(html,/Exact odds|EXACT ODDS/i);
 assert.match(html,/Econ|ECON/);
 assert.match(html,/<table/);
 assert.match(html,/tabindex="0" role="region"/);
 assert.match(html,/@media\s*\(max-width:\s*600px\)/);
 assert.doesNotMatch(html,/cdn\.|<script src=|localStorage|fictitious human/);
 assert.equal(core.escapeHtml('<img src=x onerror=evil()>'),'&lt;img src=x onerror=evil()&gt;');
});
test('existing audit and playthrough reports are included as independent quantitative sources',()=>{
 const {report}=modules();
 const data=report.createReport({seeds:[8],policies:['safe'],includeLegacy:true});
 assert.equal(data.authored.questCount,12);
 assert.equal(data.authored.safeOpenings,12);
 assert.deepEqual(data.authored.brokenEdges,[]);
 assert.equal(data.playthrough.sessions,180);
 assert.equal(data.playthrough.terminalRuns,180);
 assert.deepEqual(data.playthrough.failures,[]);
});

test('canonical World migration is idempotent and NPC invariants remain valid in scenario fixtures',()=>{
 const {report}=modules();
 const {expose}=require('./helpers/vm-loader');
 const c=report.startContext('migration-check','safe');
 const state=JSON.parse(expose(c,"JSON.stringify((()=>{"+
  "WorldSimulation.migrate(World,{subject:S});const once=JSON.stringify(World);"+
  "WorldSimulation.migrate(World,{subject:S});const twice=JSON.stringify(World);"+
  "return {stable:once===twice,npc:NpcSystem.checkInvariants(World,S,Lineage),"+
  "story:StorySystem.checkInvariants(World),contracts:EmploymentSystem.checkInvariants(World)};"+
  "})())"));
 assert.equal(state.stable,true);
 assert.deepEqual(state.npc,[]);
 assert.deepEqual(state.story,[]);
 assert.deepEqual(state.contracts,[]);
});
test('saved World and S JSON exactly replay dynamic decisions and do not create extra merit',()=>{
 const {report}=modules(),{expose}=require('./helpers/vm-loader');
 const c=report.startContext(17,'bold');
 const state=expose(c,"JSON.stringify({world:World,subject:S})");
 const first=report.runScenario(c,'household',0,'bold',17);
 expose(c,"const before=JSON.parse("+JSON.stringify(state)+");World=before.world;S=before.subject;simEnergyUsed=0;");
 const second=report.runScenario(c,'household',0,'bold',17);
 assert.deepEqual(second,first);
 assert.equal(second.duplicatePayouts,0);
});
