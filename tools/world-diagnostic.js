'use strict';

const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('../tests/helpers/vm-loader');

const scenarios=[
  {name:'baseline',setup:''},
  {name:'employment-support',setup:"World.nationalModifiers={employmentSupport:.18};"},
  {name:'recession',setup:"World.nationalModifiers={employmentSupport:-.2,pricePressure:.2,unrestPressure:.14};"},
  {name:'prosperous-city-internal-migration',setup:"const city=World.settlements.branec; city.economy.employmentIndex=1; city.economy.wageIndex=1.5; city.economy.rentIndex=.65; city.publicHealth.sanitation=1; city.publicHealth.clinicCapacity=1; city.publicHealth.clinicDemand=0; city.security.unrest=0; World.nationalModifiers={employmentSupport:.12};"},
  {name:'outbreak-recovery',setup:"const st=World.settlements[World.activeSettlementId]; PublicHealth.triggerShock(st,'outbreak',1,4,World.year); PublicHealth.triggerShock(st,'clinicClosure',.9,4,World.year);"},
  {name:'clinic-closure',setup:"const st=World.settlements[World.activeSettlementId]; PublicHealth.triggerShock(st,'clinicClosure',1,8,World.year); PublicHealth.triggerShock(st,'medicineShortage',.7,8,World.year);"},
  {name:'clinic-investment-recovery',setup:"const st=World.settlements[World.activeSettlementId]; PublicHealth.triggerShock(st,'outbreak',1,5,World.year); PublicHealth.triggerShock(st,'clinicClosure',.8,5,World.year); PublicHealth.triggerShock(st,'investment',1,12,World.year);"},
  {name:'migration-surge',setup:"World.externalMigration={}; Object.keys(World.settlements).forEach(id=>World.externalMigration[id]=id===World.activeSettlementId?240:-12);"},
  {name:'high-security',setup:"World.nationalModifiers={unrestPressure:.2,surveillancePressure:.24};"}
];

function runScenario(scenario){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify('diagnostic:'+scenario.name)}); newWorld(); ${scenario.setup}`);
  const result=JSON.parse(expose(context,`(function(){
    const ids=Object.keys(World.settlements).sort();
    const initialPopulation=ids.reduce((sum,id)=>sum+World.settlements[id].demographics.population,0);
    const totals={births:0,deaths:0,internalIn:0,internalOut:0,externalMigration:0};
    let peakHealthcarePressure=0, peakUnrest=0, maxMigrationBalance=0, accountingComplete=true;
    let prosperousCityInternalIn=0, prosperousCityInternalOut=0;
    function recordTick(){
      const check=Invariants.check(null,World); if(!check.ok) throw new Error(check.violations.join('; '));
      const accounting=World.lastMigrationAccounting;
      if(accounting.populationAfter!==accounting.naturalPopulation+accounting.externalNet||accounting.internalIn!==accounting.internalOut||accounting.balance!==0) accountingComplete=false;
      maxMigrationBalance=Math.max(maxMigrationBalance,Math.abs(accounting.balance));
      ids.forEach(id=>{
        const state=World.settlements[id], d=state.demographics;
        totals.births+=d.births; totals.deaths+=d.deaths; totals.internalIn+=d.internalIn; totals.internalOut+=d.internalOut; totals.externalMigration+=d.externalMigration;
        peakHealthcarePressure=Math.max(peakHealthcarePressure,WorldSimulation.getHealthcarePressure(World,id));
        peakUnrest=Math.max(peakUnrest,state.security.unrest);
        if(id==='branec'){ prosperousCityInternalIn+=d.internalIn; prosperousCityInternalOut+=d.internalOut; }
      });
    }
    Random.setSeed('personal-stream'); Random.next(); World.year++; WorldSimulation.tick(World,{year:World.year});
    const personalAfter=Random.next(); Random.setSeed('personal-stream'); Random.next(); const personalExpected=Random.next();
    recordTick();
    for(let i=0;i<99;i++){ World.year++; WorldSimulation.tick(World,{year:World.year}); recordTick(); }
    const focus=World.settlements[World.activeSettlementId], accounting=World.lastMigrationAccounting;
    return JSON.stringify({scenario:${JSON.stringify(scenario.name)},years:100,settlements:ids.length,initialPopulation,beginningPopulation:initialPopulation,populationBeforeLastTick:accounting.populationBefore,endingPopulation:World.totalPopulation,births:totals.births,deaths:totals.deaths,internalIn:totals.internalIn,internalOut:totals.internalOut,externalMigration:totals.externalMigration,migrationBalance:accounting.balance,maxMigrationBalance,accountingComplete,personalRngIsolated:personalAfter===personalExpected,prosperousCityInternalIn,prosperousCityInternalOut,peakHealthcarePressure,peakUnrest,endingFoodPriceIndex:focus.economy.foodPriceIndex,endingRentIndex:focus.economy.rentIndex,endingHealthcare:PublicHealth.pressureLabel(WorldSimulation.getHealthcarePressure(World,World.activeSettlementId))});
  })()`));
  assert.equal(result.settlements,14);
  assert.equal(result.years,100);
  assert.equal(result.initialPopulation,result.beginningPopulation);
  assert.equal(result.migrationBalance,0);
  assert.equal(result.maxMigrationBalance,0);
  assert.equal(result.accountingComplete,true);
  assert.equal(result.internalIn,result.internalOut);
  assert.equal(result.personalRngIsolated,true);
  return result;
}

const results=scenarios.map(runScenario);
const outbreak=results.find(item=>item.scenario==='outbreak-recovery');
const prosperous=results.find(item=>item.scenario==='prosperous-city-internal-migration');
assert.ok(outbreak.peakHealthcarePressure>=.45,'an outbreak must reach Strained or Critical');
assert.ok(['Watch','Clear'].includes(outbreak.endingHealthcare),'the recovery scenario must return toward Watch or Clear');
assert.ok(prosperous.prosperousCityInternalIn>prosperous.prosperousCityInternalOut,'a prosperous city must attract internal migration');
console.log(JSON.stringify(results,null,2));
