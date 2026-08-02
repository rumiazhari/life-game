'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function gameplayContext(){
  const context=createWorldContext();
  expose(context,`newWorld(); S={assets:1000,age:30,scrutiny:10,traveling:null,education:{},skills:{},jobTier:1,jobName:'Day Laborer',vacancies:[]};
    function currentSettlement(){return settlementById(World.activeSettlementId);}
    function currentHousing(){return {id:'flat',rent:100,fx:{}};}
    function currentFood(){return {id:'basic',cost:50,fx:{}};}
    function runEconomy(){}
    function rollJobVacancies(){S.vacancies=[{track:'trade',stage:0},{track:'medicine',stage:0},{track:'business',stage:0}];}
    function travelCost(){return 100;}
    function scheduleTravel(){S.traveling={permitRisk:.1};return {ok:true};}
    function medicalAccessFor(){return {facility:'Clinic',quality:.9,costMultiplier:1,delay:0};}
    function medicalExposureRisk(){return .1;}
    function medicalStartOutbreak(id,severity,years){World.publicHealth.outbreak={id,severity,endYear:World.year+years};}
    function educationOptionsForStage(){return [{id:'a',quality:.5},{id:'b',quality:.7},{id:'c',quality:.9}];}
    function educationAnnualPayment(){return 100;}
    function educationAnnualCommuteCost(){return 100;}`);
  loadGameFiles(context,['js/systems/world-gameplay.js']);
  return context;
}

test('world gameplay adapter applies local economy, vacancies, travel, health, and education effects',()=>{
  const context=gameplayContext();
  const result=expose(context,`(function(){ const id=World.activeSettlementId, state=World.settlements[id]; state.economy.foodPriceIndex=1.4; state.economy.rentIndex=1.35; state.economy.employmentIndex=.9; state.economy.wageIndex=1.3; state.security.checkpointPressure=.8; state.publicHealth.shocks.outbreak=1; state.publicHealth.shocks.clinicClosure=.9; const highFood=currentFood().cost, highRent=currentHousing().rent; rollJobVacancies(); const highOpenings=S.vacancies.filter(v=>v.stage>=0).length; state.economy.employmentIndex=.1; rollJobVacancies(); const lowOpenings=S.vacancies.filter(v=>v.stage>=0).length; state.economy.employmentIndex=.9; scheduleTravel('veskar'); const trip=S.traveling; const access=medicalAccessFor(S,{}); const risk=medicalExposureRisk(S,'infection',{}); const stage={id:'university'}; const options=educationOptionsForStage(stage); return JSON.stringify({highFood,highRent,highOpenings,lowOpenings,trip,access,risk,optionCount:options.length}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.highFood>50);
  assert.ok(parsed.highRent>100);
  assert.ok(parsed.highOpenings>=parsed.lowOpenings);
  assert.ok(parsed.trip.checkpointPressure>.7&&parsed.trip.permitRisk>.1);
  assert.ok(parsed.access.quality<.9&&parsed.access.costMultiplier>1&&parsed.access.delay>0);
  assert.ok(parsed.risk>.1);
  assert.ok(parsed.optionCount>=1);
});
