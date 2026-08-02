'use strict';

(function(root){
  const SHOCK_TYPES=['outbreak','clinicClosure','sanitationFailure','medicineShortage','populationInflux','investment'];
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const bounded=value=>clamp(Number.isFinite(Number(value))?Number(value):0);

  function kindBase(settlement){
    return settlement&&settlement.kind==='city'?.58:settlement&&settlement.kind==='town'?.48:.36;
  }
  function clinicCount(settlement){
    return Array.isArray(settlement&&settlement.buildings)?settlement.buildings.filter(b=>b.type==='clinic').length:0;
  }
  function schoolCount(settlement){
    return Array.isArray(settlement&&settlement.buildings)?settlement.buildings.filter(b=>b.type==='school').length:0;
  }
  function populationOf(settlement){
    const text=String(settlement&&settlement.population||'0').replace(/[^0-9]/g,'');
    return Math.max(0,Number(text)||0);
  }
  function emptyShocks(){
    const shocks={}; SHOCK_TYPES.forEach(type=>{shocks[type]=0;}); return shocks;
  }
  function create(settlement){
    const clinics=clinicCount(settlement);
    const sanitation=clamp(kindBase(settlement)+clinics*.035);
    const clinicCapacity=clamp(.18+clinics*.08+(settlement&&settlement.kind==='city'?.08:0));
    return {sanitation,clinicCapacity,clinicDemand:clamp(.12+(1-sanitation)*.18),outbreakRisk:clamp((1-sanitation)*.3),shocks:emptyShocks(),lastShockYear:null};
  }
  function nationalValue(context,keys,fallback){
    const modifiers=context&&context.national||{};
    for(const key of keys){ if(Number.isFinite(Number(modifiers[key]))) return Number(modifiers[key]); }
    return fallback;
  }
  function normalizeShocks(health){
    if(!health.shocks||typeof health.shocks!=='object') health.shocks=emptyShocks();
    SHOCK_TYPES.forEach(type=>{health.shocks[type]=bounded(health.shocks[type]);});
    return health.shocks;
  }
  function triggerShock(runtime,type,severity,years,year){
    if(!runtime||!runtime.publicHealth||!SHOCK_TYPES.includes(type)) return false;
    const health=runtime.publicHealth, shocks=normalizeShocks(health);
    shocks[type]=Math.max(shocks[type],bounded(severity));
    health.lastShockYear=Number.isFinite(Number(year))?Number(year):health.lastShockYear;
    if(Number.isFinite(Number(years))&&years>0){
      if(!health.shockExpiry||typeof health.shockExpiry!=='object') health.shockExpiry={};
      health.shockExpiry[type]=(Number(year)||0)+Math.round(years);
    }
    return true;
  }
  function decayShocks(health,year){
    const shocks=normalizeShocks(health);
    Object.keys(shocks).forEach(type=>{
      if(health.shockExpiry&&health.shockExpiry[type]!=null&&Number(year)>=health.shockExpiry[type]) shocks[type]=0;
      else shocks[type]=bounded(shocks[type]*.82);
    });
    return shocks;
  }
  function tick(runtime,settlement,context){
    const previous=runtime.publicHealth||create(settlement);
    normalizeShocks(previous);
    const shocks=decayShocks(previous,context&&context.year);
    const rng=context&&context.random;
    const population=runtime.demographics&&runtime.demographics.population||populationOf(settlement);
    const healthSupport=nationalValue(context,['healthSupport','health'],0);
    const sanitationSupport=nationalValue(context,['sanitation','healthSupport'],0);
    const clinicClosure=shocks.clinicClosure;
    const medicineShortage=shocks.medicineShortage;
    const influx=shocks.populationInflux;
    const investment=shocks.investment;
    const clinicDemand=clamp(previous.clinicDemand*.72+(
      .1+(1-previous.sanitation)*.2+Math.min(.12,population/1000000*.12)+influx*.2+medicineShortage*.04+
      nationalValue(context,['healthDemand'],0)+((rng&&rng.range)?rng.range(-.012,.012):0)
    )*.28);
    const capacityBase=.16+clinicCount(settlement)*.085+(settlement&&settlement.kind==='city'?.08:0);
    const capacityTarget=clamp(capacityBase+investment*.2-clinicClosure*.55);
    const clinicCapacity=clamp(previous.clinicCapacity*.86+capacityTarget*.14);
    const sanitationTarget=clamp(kindBase(settlement)+clinicCount(settlement)*.035-schoolCount(settlement)*.006+sanitationSupport-investment*.02-shocks.sanitationFailure*.55);
    const sanitation=clamp(previous.sanitation*.84+sanitationTarget*.16+((rng&&rng.range)?rng.range(-.01,.01):0));
    const outbreakPressure=shocks.outbreak*.8+shocks.sanitationFailure*.22+medicineShortage*.12;
    const outbreakRisk=clamp(previous.outbreakRisk*.76+(
      (1-sanitation)*.38+clinicDemand*.32-clinicCapacity*.22+outbreakPressure-healthSupport*.08+
      ((rng&&rng.range)?rng.range(-.01,.01):0)
    )*.24);
    runtime.publicHealth={sanitation,clinicCapacity,clinicDemand,outbreakRisk,shocks,lastShockYear:previous.lastShockYear,shockExpiry:previous.shockExpiry||{}};
    return runtime.publicHealth;
  }
  function pressure(runtime){
    const health=runtime&&runtime.publicHealth;
    if(!health) return 0;
    const shocks=normalizeShocks(health);
    return clamp((health.clinicDemand-health.clinicCapacity)*1.8+health.outbreakRisk*.35+
      shocks.outbreak*.58+shocks.clinicClosure*.5+shocks.sanitationFailure*.18+shocks.medicineShortage*.12);
  }
  function pressureLabel(value){ const v=bounded(value); return v>=.7?'Critical':v>=.45?'Strained':v>=.22?'Watch':'Clear'; }
  root.PublicHealth={SHOCK_TYPES,create,tick,pressure,pressureLabel,triggerShock,normalizeShocks};
})(typeof globalThis!=='undefined'?globalThis:this);
