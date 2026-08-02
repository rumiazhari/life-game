'use strict';

const {createWorldContext,expose}=require('../tests/helpers/vm-loader');

const context=createWorldContext();
const summary=expose(context,`Random.setSeed('diagnostic'); newWorld(); (function(){ const ids=Object.keys(World.settlements); const start=ids.reduce((sum,id)=>sum+World.settlements[id].demographics.population,0); let employment=0,peakHealth=0,peakUnrest=0; for(let year=0;year<50;year++){ World.year++; WorldSimulation.tick(World,{random:Random,year:World.year}); ids.forEach(id=>{ const state=World.settlements[id]; employment+=state.economy.employmentIndex; peakHealth=Math.max(peakHealth,WorldSimulation.getHealthcarePressure(World,id)); peakUnrest=Math.max(peakUnrest,state.security.unrest); }); } const end=ids.reduce((sum,id)=>sum+World.settlements[id].demographics.population,0); const focus=World.settlements[World.activeSettlementId]; return JSON.stringify({settlements:ids.length,beginningPopulation:start,endingPopulation:end,averageEmploymentIndex:employment/(ids.length*50),endingFoodPriceIndex:focus.economy.foodPriceIndex,endingRentIndex:focus.economy.rentIndex,peakHealthcarePressure:peakHealth,peakUnrest:peakUnrest,endingSurveillance:focus.security.surveillance}); })()`);
console.log(JSON.stringify(JSON.parse(summary),null,2));
