'use strict';

const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('../tests/helpers/vm-loader');

const scenarios=[
  {name:'baseline',setup:''},
  {name:'employment-support',setup:"World.nationalModifiers={employmentSupport:.18};"},
  {name:'outbreak-recovery',setup:"const st=World.settlements[World.activeSettlementId]; PublicHealth.triggerShock(st,'outbreak',1,4,World.year); PublicHealth.triggerShock(st,'clinicClosure',.9,4,World.year);"},
  {name:'clinic-closure',setup:"const st=World.settlements[World.activeSettlementId]; PublicHealth.triggerShock(st,'clinicClosure',1,8,World.year); PublicHealth.triggerShock(st,'medicineShortage',.7,8,World.year);"},
  {name:'migration-surge',setup:"World.externalMigration={}; Object.keys(World.settlements).forEach(id=>World.externalMigration[id]=id===World.activeSettlementId?240:-12);"},
  {name:'high-security',setup:"World.nationalModifiers={unrestPressure:.2,surveillancePressure:.24};"}
];

function runScenario(scenario){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify('diagnostic:'+scenario.name)}); newWorld(); ${scenario.setup}`);
  const result=JSON.parse(expose(context,`(function(){
    Random.setSeed('personal-stream'); Random.next(); World.year++; WorldSimulation.tick(World,{year:World.year});
    const personalAfter=Random.next(); Random.setSeed('personal-stream'); Random.next(); const personalExpected=Random.next();
    let peakHealthcarePressure=0, peakUnrest=0, maxMigrationBalance=0;
    const ids=Object.keys(World.settlements).sort();
    for(let i=0;i<99;i++){
      World.year++; WorldSimulation.tick(World,{year:World.year});
      const check=Invariants.check(null,World); if(!check.ok) throw new Error(check.violations.join('; '));
      maxMigrationBalance=Math.max(maxMigrationBalance,Math.abs(World.lastMigrationAccounting.balance));
      ids.forEach(id=>{ const state=World.settlements[id]; peakHealthcarePressure=Math.max(peakHealthcarePressure,WorldSimulation.getHealthcarePressure(World,id)); peakUnrest=Math.max(peakUnrest,state.security.unrest); });
    }
    const focus=World.settlements[World.activeSettlementId];
    return JSON.stringify({scenario:${JSON.stringify(scenario.name)},years:100,settlements:ids.length,beginningPopulation:World.lastMigrationAccounting.populationBefore,endingPopulation:World.totalPopulation,migrationBalance:World.lastMigrationAccounting.balance,maxMigrationBalance,personalRngIsolated:personalAfter===personalExpected,peakHealthcarePressure,peakUnrest,endingFoodPriceIndex:focus.economy.foodPriceIndex,endingRentIndex:focus.economy.rentIndex,endingHealthcare:PublicHealth.pressureLabel(WorldSimulation.getHealthcarePressure(World,World.activeSettlementId))});
  })()`));
  assert.equal(result.settlements,14);
  assert.equal(result.years,100);
  assert.equal(result.migrationBalance,0);
  assert.equal(result.maxMigrationBalance,0);
  assert.equal(result.personalRngIsolated,true);
  return result;
}

const results=scenarios.map(runScenario);
const outbreak=results.find(item=>item.scenario==='outbreak-recovery');
assert.ok(outbreak.peakHealthcarePressure>=.45,'an outbreak must reach Strained or Critical');
assert.ok(['Watch','Clear'].includes(outbreak.endingHealthcare),'the recovery scenario must return toward Watch or Clear');
console.log(JSON.stringify(results,null,2));
