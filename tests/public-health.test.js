'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

test('high clinic demand raises healthcare pressure',()=>{
  const context=createWorldContext();
  const result=expose(context,`Random.setSeed('health'); newWorld(); (function(){ const state=World.settlements.branec; const normal=WorldSimulation.getHealthcarePressure(World,'branec'); state.publicHealth.clinicDemand=.95; state.publicHealth.clinicCapacity=.05; state.publicHealth.outbreakRisk=.1; return JSON.stringify({normal,high:WorldSimulation.getHealthcarePressure(World,'branec'),label:PublicHealth.pressureLabel(WorldSimulation.getHealthcarePressure(World,'branec'))}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.high>parsed.normal);
  assert.equal(parsed.label,'Critical');
});

test('health indicators remain finite and bounded after annual updates',()=>{
  const context=createWorldContext();
  const result=expose(context,`Random.setSeed('health-bounds'); newWorld(); (function(){ for(let i=0;i<30;i++){ World.year++; WorldSimulation.tick(World,{random:Random,year:World.year}); } const health=World.settlements.svetlin.publicHealth; return JSON.stringify(health); })()`);
  const health=JSON.parse(result);
  for(const key of ['sanitation','clinicCapacity','clinicDemand','outbreakRisk']) assert.ok(Number.isFinite(health[key])&&health[key]>=0&&health[key]<=1);
});

test('clinic capacity reflects population coverage, not only clinic count',()=>{
  const context=createWorldContext();
  const result=expose(context,`(function(){ const small={kind:'town',population:'2,000',buildings:[{type:'clinic'}]}; const large={kind:'town',population:'300,000',buildings:[{type:'clinic'}]}; return JSON.stringify({small:PublicHealth.create(small).clinicCapacity,large:PublicHealth.create(large).clinicCapacity}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.small>parsed.large);
  assert.ok(parsed.small-parsed.large>.2);
});

test('public-health investment improves sanitation',()=>{
  const context=createWorldContext();
  const result=expose(context,`(function(){ Random.setSeed('investment'); newWorld(); const settlement=settlementById(World.activeSettlementId); const baseline=JSON.parse(JSON.stringify(World.settlements[World.activeSettlementId])); const invested=JSON.parse(JSON.stringify(baseline)); PublicHealth.triggerShock(invested,'investment',1,5,World.year); PublicHealth.tick(baseline,settlement,{year:World.year+1}); PublicHealth.tick(invested,settlement,{year:World.year+1}); return JSON.stringify({baseline:baseline.publicHealth.sanitation,invested:invested.publicHealth.sanitation}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.invested>parsed.baseline);
});
