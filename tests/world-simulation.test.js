'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function history(seed,years=50){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld();`);
  return expose(context,`(function(){ const rows=[]; for(let i=0;i<${years};i++){ World.year++; WorldSimulation.tick(World,{random:Random,year:World.year}); rows.push(JSON.stringify(World.settlements)); } return JSON.stringify(rows); })()`);
}

test('every settlement receives canonical finite runtime state',()=>{
  const context=createWorldContext();
  const result=expose(context,`Random.setSeed('runtime'); newWorld(); JSON.stringify({ids:Object.keys(World.settlements),check:Invariants.check(null,World)})`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.ids.length,14);
  assert.deepEqual(parsed.check,{ok:true,violations:[]});
});

test('the same seed produces the same multi-year settlement history',()=>{
  assert.equal(history('same-seed'),history('same-seed'));
  assert.notEqual(history('same-seed',8),history('different-seed',8));
});

test('settlement traits produce meaningfully different outcomes',()=>{
  const context=createWorldContext();
  const output=expose(context,`Random.setSeed('traits'); newWorld(); (function(){ for(let i=0;i<20;i++){ World.year++; WorldSimulation.tick(World,{random:Random,year:World.year}); } const city=World.settlements.branec, village=World.settlements.krasnava; return JSON.stringify({city:city.economy.employmentIndex,village:village.economy.employmentIndex,cityRent:city.economy.rentIndex,villageRent:village.economy.rentIndex}); })()`);
  const parsed=JSON.parse(output);
  assert.ok(Math.abs(parsed.city-parsed.village)>.05);
  assert.ok(Math.abs(parsed.cityRent-parsed.villageRent)>.05);
});

test('population and migration feed rent pressure',()=>{
  const context=createWorldContext();
  const output=expose(context,`Random.setSeed('rent'); newWorld(); (function(){ const state=World.settlements.branec; const baseline=state.economy.rentIndex; state.demographics.population=state.demographics.initialPopulation*1.3; state.demographics.netMigration=state.demographics.initialPopulation*.01; WorldSimulation.tick(World,{random:Random,year:World.year+1}); return JSON.stringify({baseline,rent:state.economy.rentIndex}); })()`);
  const parsed=JSON.parse(output);
  assert.ok(parsed.rent>parsed.baseline);
});

test('unemployment contributes to unrest and unrest increases surveillance',()=>{
  const context=createWorldContext();
  const output=expose(context,`Random.setSeed('security'); newWorld(); (function(){ const state=World.settlements.branec; state.economy.employmentIndex=.05; state.security.unrest=.8; const before=state.security.surveillance; World.year++; WorldSimulation.tick(World,{random:Random,year:World.year}); return JSON.stringify({unrest:state.security.unrest,surveillance:state.security.surveillance,before}); })()`);
  const parsed=JSON.parse(output);
  assert.ok(parsed.unrest>.2);
  assert.ok(parsed.surveillance>parsed.before);
});

test('multi-decade simulation remains bounded',()=>{
  const context=createWorldContext();
  const result=expose(context,`Random.setSeed('decades'); newWorld(); (function(){ for(let i=0;i<75;i++){ World.year++; WorldSimulation.tick(World,{random:Random,year:World.year}); const check=Invariants.check(null,World); if(!check.ok) return JSON.stringify(check); } return JSON.stringify({ok:true}); })()`);
  assert.deepEqual(JSON.parse(result),{ok:true});
});
