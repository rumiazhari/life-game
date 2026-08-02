'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function newContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld();`);
  return context;
}

test('world simulation has an independent deterministic random stream',()=>{
  const context=newContext('rng-isolation');
  const result=expose(context,`(function(){ Random.setSeed('personal'); const first=Random.next(); World.year++; WorldSimulation.tick(World,{random:Random,year:World.year}); const after=Random.next(); Random.setSeed('personal'); Random.next(); const expected=Random.next(); return JSON.stringify({first,after,expected}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.after,parsed.expected);
});

test('settlement order does not change a seeded world tick',()=>{
  const context=newContext('order-independent');
  const result=expose(context,`(function(){ const snapshot=JSON.stringify(World.settlements); const first=JSON.parse(snapshot); const canonical=()=>JSON.stringify(Object.keys(World.settlements).sort().reduce((out,id)=>(out[id]=World.settlements[id],out),{})); World.year++; WorldSimulation.tick(World,{year:World.year}); const a=canonical(); World=Object.assign({},World,{year:World.year-1,settlements:{}}); Object.keys(first).reverse().forEach(id=>World.settlements[id]=first[id]); WorldSimulation.migrate(World); World.year++; WorldSimulation.tick(World,{year:World.year}); return JSON.stringify({a,b:canonical()}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.a,parsed.b);
});

test('migration is nationally zero-sum and dummy settlements are repaired',()=>{
  const context=newContext('migration');
  const result=expose(context,`(function(){ World.settlements.dummy={demographics:{population:900,initialPopulation:900}}; WorldSimulation.migrate(World); World.year++; WorldSimulation.tick(World,{year:World.year}); return JSON.stringify({dummy:World.settlements.dummy,accounting:World.lastMigrationAccounting,check:Invariants.check(null,World)}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accounting.balance,0);
  assert.equal(parsed.check.ok,true);
  assert.ok(parsed.dummy.demographics.population>=0);
});

test('schema migration preserves valid values and repairs invalid values idempotently',()=>{
  const context=newContext('migration-schema');
  const result=expose(context,`(function(){ const before=World.settlements.branec; before.economy.wageIndex=1.24; before.demographics.population=123456; before.publicHealth.sanitation=NaN; delete World.simulationSchemaVersion; WorldSimulation.migrate(World); const once=JSON.stringify(World); WorldSimulation.migrate(World); const twice=JSON.stringify(World); return JSON.stringify({wage:World.settlements.branec.economy.wageIndex,population:World.settlements.branec.demographics.population,stable:once===twice,check:Invariants.check(null,World)}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.wage,1.24);
  assert.equal(parsed.population,123456);
  assert.equal(parsed.stable,true);
  assert.equal(parsed.check.ok,true);
});

test('outbreak pressure reaches critical and decays during recovery',()=>{
  const context=newContext('outbreak-recovery');
  const result=expose(context,`(function(){ const id=World.activeSettlementId; const state=World.settlements[id]; PublicHealth.triggerShock(state,'outbreak',1,3,World.year); PublicHealth.triggerShock(state,'clinicClosure',.95,3,World.year); const peak=[]; for(let i=0;i<20;i++){ World.year++; WorldSimulation.tick(World,{year:World.year}); peak.push(WorldSimulation.getHealthcarePressure(World,id)); } return JSON.stringify({peak:Math.max(...peak),last:peak[peak.length-1],label:PublicHealth.pressureLabel(peak[peak.length-1])}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.peak>=.45);
  assert.ok(parsed.last<parsed.peak);
  assert.ok(['Watch','Clear'].includes(parsed.label));
});
