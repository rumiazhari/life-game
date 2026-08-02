'use strict';

(function(root){
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
  function create(settlement){
    const clinics=clinicCount(settlement);
    const sanitation=clamp(kindBase(settlement)+clinics*.035);
    const clinicCapacity=clamp(.18+clinics*.08+(settlement&&settlement.kind==='city'?.08:0));
    return {sanitation,clinicCapacity,clinicDemand:clamp(.12+(1-sanitation)*.18),outbreakRisk:clamp((1-sanitation)*.3)};
  }
  function national(context,key,fallback){
    const modifiers=context&&context.national||{};
    return Number.isFinite(Number(modifiers[key]))?Number(modifiers[key]):fallback;
  }
  function tick(runtime,settlement,context){
    const previous=runtime.publicHealth;
    const rng=context&&context.random;
    const population=runtime.demographics&&runtime.demographics.population||populationOf(settlement);
    const clinicDemand=clamp(previous.clinicDemand*.72+(0.1+(1-previous.sanitation)*.2+Math.min(.12,population/1000000*.12)+national(context,'healthDemand',0)+((rng&&rng.range)?rng.range(-.012,.012):0))*.28);
    const capacityTarget=clamp(previous.clinicCapacity*.86+(.16+clinicCount(settlement)*.085+(settlement&&settlement.kind==='city'?.08:0))* .14);
    const sanitationTarget=clamp(kindBase(settlement)+clinicCount(settlement)*.035-schoolCount(settlement)*.006+national(context,'sanitation',0));
    const sanitation=clamp(previous.sanitation*.84+sanitationTarget*.16+((rng&&rng.range)?rng.range(-.01,.01):0));
    const clinicCapacity=clamp(capacityTarget);
    const outbreakRisk=clamp(previous.outbreakRisk*.76+((1-sanitation)*.38+clinicDemand*.32-clinicCapacity*.22+national(context,'outbreak',0)+((rng&&rng.range)?rng.range(-.01,.01):0))*.24);
    runtime.publicHealth={sanitation,clinicCapacity,clinicDemand,outbreakRisk};
    return runtime.publicHealth;
  }
  function pressure(runtime){
    const health=runtime&&runtime.publicHealth;
    if(!health) return 0;
    return clamp((health.clinicDemand-health.clinicCapacity)*1.8+health.outbreakRisk*.35);
  }
  function pressureLabel(value){ const v=bounded(value); return v>=.7?'Critical':v>=.45?'Strained':v>=.22?'Watch':'Clear'; }
  root.PublicHealth={create,tick,pressure,pressureLabel};
})(typeof globalThis!=='undefined'?globalThis:this);
