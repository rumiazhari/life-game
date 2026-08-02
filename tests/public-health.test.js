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
