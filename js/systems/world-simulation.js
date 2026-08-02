'use strict';

(function(root){
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const bounded=value=>clamp(Number.isFinite(Number(value))?Number(value):0);
  const integer=value=>Math.max(0,Math.round(Number.isFinite(Number(value))?Number(value):0));
  const RANGES={unit:[0,1],index:[.65,1.55],population:[0,Infinity]};

  function definitions(){
    return typeof KARSEN_SETTLEMENTS!=='undefined'&&Array.isArray(KARSEN_SETTLEMENTS)?KARSEN_SETTLEMENTS:[];
  }
  function populationOf(settlement){
    const text=String(settlement&&settlement.population||'0').replace(/[^0-9]/g,'');
    return Math.max(0,Number(text)||0);
  }
  function runtimeState(settlement){
    const population=populationOf(settlement);
    return {
      economy:root.SettlementEconomy.create(settlement),
      publicHealth:root.PublicHealth.create(settlement),
      education:{schoolCapacity:integer(population*(settlement&&settlement.kind==='city'?.11:settlement&&settlement.kind==='town'?.09:.07)),enrolledStudents:integer(population*.055),capacityPressure:0},
      security:{unrest:bounded((settlement&&settlement.surveillance||0)/100*.22),surveillance:bounded((settlement&&settlement.surveillance||0)/100),checkpointPressure:0},
      demographics:{population,initialPopulation:population,births:0,deaths:0,netMigration:0}
    };
  }
  function ensureRuntime(world,settlement){
    if(!world.settlements) world.settlements={};
    if(!world.settlements[settlement.id]) world.settlements[settlement.id]=runtimeState(settlement);
    return world.settlements[settlement.id];
  }
  function initialize(world){
    if(!world) throw new Error('WorldSimulation.initialize requires a world object');
    definitions().forEach(settlement=>ensureRuntime(world,settlement));
    return world.settlements;
  }
  function randomDelta(rng,amount){ return rng&&typeof rng.range==='function'?rng.range(-amount,amount):0; }
  function national(context,key,fallback){
    const modifiers=context&&context.national||{};
    return Number.isFinite(Number(modifiers[key]))?Number(modifiers[key]):fallback;
  }
  function updateDemographics(runtime,settlement,context){
    const rng=context&&context.random;
    const previous=runtime.demographics;
    const economy=runtime.economy;
    const health=runtime.publicHealth;
    const population=Math.max(0,previous.population);
    const rural=settlement&&settlement.kind==='village'?1:settlement&&settlement.kind==='town'?.55:0;
    const birthRate=clamp(.006+rural*.003+randomDelta(rng,.00035),.002,.014);
    const deathRate=clamp(.008+(1-health.sanitation)*.006+health.outbreakRisk*.004-national(context,'health',0),.002,.022);
    const births=integer(population*birthRate);
    const deaths=Math.min(population,integer(population*deathRate));
    const migrationRate=clamp((economy.employmentIndex-.5)*.007-(economy.rentIndex-1)*.004+(health.sanitation-.5)*.002+randomDelta(rng,.0005),-.012,.012);
    const netMigration=Math.round(population*migrationRate);
    previous.births=births; previous.deaths=deaths; previous.netMigration=netMigration;
    previous.population=Math.max(0,population+births-deaths+netMigration);
    return previous;
  }
  function updateEducation(runtime,settlement){
    const population=runtime.demographics.population;
    const kind=settlement&&settlement.kind;
    const capacityTarget=integer(population*(kind==='city'?.11:kind==='town'?.09:.07));
    const enrolledTarget=integer(population*(kind==='city'?.06:kind==='town'?.055:.045));
    runtime.education.schoolCapacity=Math.max(0,Math.round(runtime.education.schoolCapacity*.85+capacityTarget*.15));
    runtime.education.enrolledStudents=Math.max(0,Math.min(population,Math.round(runtime.education.enrolledStudents*.8+enrolledTarget*.2)));
    runtime.education.capacityPressure=bounded(runtime.education.enrolledStudents/Math.max(1,runtime.education.schoolCapacity));
    return runtime.education;
  }
  function updateSecurity(runtime,settlement,context){
    const rng=context&&context.random;
    const economy=runtime.economy;
    const health=runtime.publicHealth;
    const previous=runtime.security;
    const unemployment=1-economy.employmentIndex;
    const targetUnrest=clamp(unemployment*.55+(1-health.sanitation)*.18+health.outbreakRisk*.12+previous.unrest*.12-national(context,'unrest',0)+randomDelta(rng,.012));
    const unrest=bounded(previous.unrest*.7+targetUnrest*.3);
    const base=bounded((settlement&&settlement.surveillance||0)/100);
    const surveillanceTarget=clamp(base+unrest*.26+national(context,'surveillance',0));
    const surveillance=bounded(previous.surveillance*.72+surveillanceTarget*.28);
    const checkpointPressure=bounded(surveillance*.58+(settlement&&settlement.travelDifficulty||1)*.08+unrest*.18);
    runtime.security={unrest,surveillance,checkpointPressure};
    return runtime.security;
  }
  function tick(world,context){
    if(!world) throw new Error('WorldSimulation.tick requires a world object');
    const ctx=context||{};
    const rng=ctx.random||root.Random;
    initialize(world);
    definitions().forEach(settlement=>{
      const runtime=ensureRuntime(world,settlement);
      runtime.demographics.population=Math.max(0,runtime.demographics.population);
      root.SettlementEconomy.tick(runtime,settlement,{random:rng,national:ctx.national||{}});
      root.PublicHealth.tick(runtime,settlement,{random:rng,national:ctx.national||{}});
      updateDemographics(runtime,settlement,{random:rng,national:ctx.national||{}});
      updateEducation(runtime,settlement);
      updateSecurity(runtime,settlement,{random:rng,national:ctx.national||{}});
    });
    return world.settlements;
  }
  function getSettlementState(world,id){ return world&&world.settlements&&world.settlements[id]||null; }
  function getCostOfLiving(world,id){ const state=getSettlementState(world,id); return root.SettlementEconomy.costOfLiving(state); }
  function getEmploymentConditions(world,id){ const state=getSettlementState(world,id); return root.SettlementEconomy.employmentConditions(state); }
  function getHealthcarePressure(world,id){ const state=getSettlementState(world,id); return root.PublicHealth.pressure(state); }
  function label(value,low,high,labels){ return value>=high?labels[2]:value>=low?labels[1]:labels[0]; }
  function costLabel(value){ return label(value,1.02,1.2,['Low','Moderate','High']); }
  function securityLabel(value){ return label(value,.35,.68,['Low','Elevated','Severe']); }
  function unrestLabel(value){ return label(value,.25,.58,['Low','Elevated','High']); }
  function getSettlementConditions(world,id){
    const state=getSettlementState(world,id);
    if(!state) return {employment:'Unknown',costOfLiving:'Unknown',healthcare:'Unknown',unrest:'Unknown',surveillance:'Unknown'};
    return {
      employment:getEmploymentConditions(world,id),
      costOfLiving:costLabel(getCostOfLiving(world,id)),
      healthcare:root.PublicHealth.pressureLabel(getHealthcarePressure(world,id)),
      unrest:unrestLabel(state.security.unrest),
      surveillance:securityLabel(state.security.surveillance)
    };
  }
  root.WorldSimulation={RANGES,initialize,tick,getSettlementState,getCostOfLiving,getEmploymentConditions,getHealthcarePressure,getSettlementConditions};
})(typeof globalThis!=='undefined'?globalThis:this);
