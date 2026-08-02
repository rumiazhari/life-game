'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

test('economy exposes bounded indices and readable employment conditions',()=>{
  const context=createWorldContext();
  const result=expose(context,`Random.setSeed('economy'); newWorld(); (function(){ const state=WorldSimulation.getSettlementState(World,'branec'); const before=JSON.stringify(state.economy); WorldSimulation.tick(World,{random:Random,year:World.year+1}); return JSON.stringify({before:JSON.parse(before),after:state.economy,employment:WorldSimulation.getEmploymentConditions(World,'branec'),cost:WorldSimulation.getCostOfLiving(World,'branec')}); })()`);
  const parsed=JSON.parse(result);
  for(const value of [parsed.after.employmentIndex,parsed.after.wageIndex,parsed.after.foodPriceIndex,parsed.after.rentIndex,parsed.cost]) assert.ok(Number.isFinite(value));
  assert.ok(['Strong','Stable','Tight','Scarce'].includes(parsed.employment));
  assert.ok(parsed.cost>=.65&&parsed.cost<=1.55);
});

test('national modifiers and seeded variation are deterministic inputs',()=>{
  const context=createWorldContext();
  const result=expose(context,`Random.setSeed('modifiers'); newWorld(); (function(){ const state=World.settlements.eisenmark; const first=state.economy.employmentIndex; World.year++; WorldSimulation.tick(World,{random:Random,national:{employment:-.15,prices:.2},year:World.year}); return JSON.stringify({first,second:state.economy.employmentIndex,food:state.economy.foodPriceIndex}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.second>=0&&parsed.second<=1);
  assert.ok(parsed.food>=.65&&parsed.food<=1.55);
});
