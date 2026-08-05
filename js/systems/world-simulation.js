'use strict';

(function(root){
  const SIMULATION_SCHEMA_VERSION=2;
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const bounded=value=>clamp(Number.isFinite(Number(value))?Number(value):0);
  const integer=value=>Math.max(0,Math.round(Number.isFinite(Number(value))?Number(value):0));
  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const RANGES={unit:[0,1],index:[.65,1.55],population:[0,Infinity]};

  function baseDefinitions(){
    return typeof KARSEN_SETTLEMENTS!=='undefined'&&Array.isArray(KARSEN_SETTLEMENTS)?KARSEN_SETTLEMENTS.slice():[];
  }
  function definitions(world){
    const list=baseDefinitions();
    const known=new Set(list.map(item=>item.id));
    const extra=world&&Array.isArray(world.settlementDefinitions)?world.settlementDefinitions:[];
    extra.forEach(item=>{if(item&&item.id&&!known.has(item.id)){list.push(item);known.add(item.id);}});
    return list.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  }
  function populationOf(settlement){
    const text=String(settlement&&settlement.population||'0').replace(/[^0-9]/g,'');
    return Math.max(0,Number(text)||0);
  }
  function cloneValue(value){
    if(Array.isArray(value)) return value.slice();
    if(value&&typeof value==='object') return Object.assign({},value);
    return value;
  }
  function mergeField(target,key,fallback,repair){
    const current=target[key];
    if(current==null||repair&&!repair(current)) target[key]=cloneValue(fallback);
  }
  function runtimeState(settlement){
    return {
      economy:root.SettlementEconomy.create(settlement),
      publicHealth:root.PublicHealth.create(settlement),
      education:{schoolCapacity:integer(populationOf(settlement)*(settlement&&settlement.kind==='city'?.11:settlement&&settlement.kind==='town'?.09:.07)),enrolledStudents:integer(populationOf(settlement)*.055),capacityPressure:0},
      security:{unrest:bounded((settlement&&settlement.surveillance||0)/100*.22),surveillance:bounded((settlement&&settlement.surveillance||0)/100),checkpointPressure:0},
      demographics:{population:populationOf(settlement),initialPopulation:populationOf(settlement),populationBefore:populationOf(settlement),naturalPopulation:populationOf(settlement),populationAfter:populationOf(settlement),births:0,deaths:0,internalIn:0,internalOut:0,externalMigration:0,netMigration:0}
    };
  }
  function repairRuntime(runtime,settlement){
    const defaults=runtimeState(settlement);
    if(!runtime||typeof runtime!=='object') runtime={};
    ['economy','publicHealth','education','security','demographics'].forEach(group=>{
      if(!runtime[group]||typeof runtime[group]!=='object') runtime[group]={};
    });
    const e=runtime.economy, de=defaults.economy;
    ['employmentIndex'].forEach(key=>mergeField(e,key,de[key],v=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1));
    ['wageIndex','foodPriceIndex','rentIndex'].forEach(key=>mergeField(e,key,de[key],v=>Number.isFinite(Number(v))&&Number(v)>=.65&&Number(v)<=1.55));
    if(!e.industryDemand||typeof e.industryDemand!=='object') e.industryDemand={};
    Object.keys(de.industryDemand).forEach(key=>mergeField(e.industryDemand,key,de.industryDemand[key],v=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1));
    const h=runtime.publicHealth, dh=defaults.publicHealth;
    ['sanitation','clinicCapacity','clinicDemand','outbreakRisk'].forEach(key=>mergeField(h,key,dh[key],v=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1));
    if(!h.shocks||typeof h.shocks!=='object') h.shocks={};
    root.PublicHealth.SHOCK_TYPES.forEach(key=>mergeField(h.shocks,key,0,v=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1));
    if(!h.shockExpiry||typeof h.shockExpiry!=='object') h.shockExpiry={};
    const ed=runtime.education, ded=defaults.education;
    ['schoolCapacity','enrolledStudents'].forEach(key=>mergeField(ed,key,ded[key]||0,v=>Number.isFinite(Number(v))&&Number(v)>=0));
    ed.enrolledStudents=Math.min(ed.enrolledStudents,Math.max(0,finite(runtime.demographics&&runtime.demographics.population,populationOf(settlement))));
    mergeField(ed,'capacityPressure',0,v=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1);
    const sec=runtime.security, ds=defaults.security;
    ['unrest','surveillance','checkpointPressure'].forEach(key=>mergeField(sec,key,ds[key],v=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1));
    const d=runtime.demographics, dd=defaults.demographics;
    ['population','initialPopulation','populationBefore','naturalPopulation','populationAfter','births','deaths','internalIn','internalOut','externalMigration','netMigration'].forEach(key=>mergeField(d,key,dd[key],v=>Number.isFinite(Number(v))&&Number(v)>=0||key==='netMigration'||key==='externalMigration'));
    d.population=Math.max(0,finite(d.population,dd.population));
    d.initialPopulation=Math.max(0,finite(d.initialPopulation,dd.initialPopulation));
    d.populationBefore=Math.max(0,finite(d.populationBefore,d.population));
    d.naturalPopulation=Math.max(0,finite(d.naturalPopulation,d.population));
    d.populationAfter=Math.max(0,finite(d.populationAfter,d.population));
    d.births=Math.max(0,finite(d.births,0)); d.deaths=Math.max(0,finite(d.deaths,0));
    d.internalIn=Math.max(0,finite(d.internalIn,0)); d.internalOut=Math.max(0,finite(d.internalOut,0));
    d.externalMigration=finite(d.externalMigration,0); d.netMigration=finite(d.netMigration,0);
    const expectedNatural=d.populationBefore+d.births-d.deaths;
    const expectedAfter=d.naturalPopulation+d.internalIn-d.internalOut+d.externalMigration;
    if(d.naturalPopulation!==expectedNatural||d.populationAfter!==expectedAfter||d.populationAfter!==d.population){
      d.populationBefore=d.population; d.naturalPopulation=d.population; d.populationAfter=d.population;
    }
    ed.capacityPressure=bounded(ed.enrolledStudents/Math.max(1,ed.schoolCapacity));
    return runtime;
  }
  function migrate(world){
    if(!world||typeof world!=='object') throw new Error('WorldSimulation.migrate requires a world object');
    if(!world.settlements||typeof world.settlements!=='object'||Array.isArray(world.settlements)) world.settlements={};
    if(!world.seed) world.seed='karsen:'+String(world.year||0)+':'+String(world.activeSettlementId||'unknown');
    if(!world.publicHealth||typeof world.publicHealth!=='object') world.publicHealth={};
    if(!world.nationalModifiers||typeof world.nationalModifiers!=='object') world.nationalModifiers={};
    const defs=definitions(world), valid=new Set(defs.map(item=>item.id));
    if(!world.settlementArchive||typeof world.settlementArchive!=='object') world.settlementArchive={};
    Object.keys(world.settlements).forEach(id=>{
      if(!valid.has(id)){
        world.settlementArchive[id]=world.settlements[id];
        delete world.settlements[id];
      }
    });
    defs.forEach(settlement=>{world.settlements[settlement.id]=repairRuntime(world.settlements[settlement.id]||runtimeState(settlement),settlement);});
    world.simulationSchemaVersion=SIMULATION_SCHEMA_VERSION;
    if(root.BusinessSystem&&typeof root.BusinessSystem.migrate==='function') root.BusinessSystem.migrate(world,defs);
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.migrate==='function') root.EmploymentSystem.migrate(world);
    return world;
  }
  function initialize(world){ return migrate(world).settlements; }
  function streamFor(world,year,settlementId,subsystem){
    return root.Random.create([world.seed,year,settlementId,subsystem].join('|'));
  }
  function nationalValue(modifiers,keys,fallback){
    for(const key of keys){if(Number.isFinite(Number(modifiers&&modifiers[key])))return Number(modifiers[key]);}
    return fallback;
  }
  function attractiveness(runtime){
    const economy=runtime.economy, health=runtime.publicHealth, security=runtime.security;
    const healthcarePressure=root.PublicHealth.pressure(runtime);
    const wageAttractiveness=clamp((economy.wageIndex-.65)/.9);
    const rentAttractiveness=clamp(1-(economy.rentIndex-.65)/.9);
    return clamp(economy.employmentIndex*.22+wageAttractiveness*.18+rentAttractiveness*.14+
      health.sanitation*.18+(1-healthcarePressure)*.14+(1-security.unrest)*.14);
  }
  function allocateInteger(total,items,weight,capacity){
    const result={}; items.forEach(item=>{result[item.id]=0;});
    let remaining=Math.max(0,Math.round(total));
    const active=items.filter(item=>(capacity?capacity(item):Infinity)>0);
    while(remaining>0&&active.length){
      const totalWeight=active.reduce((sum,item)=>sum+Math.max(.0001,weight(item)),0);
      const shares=active.map(item=>({item,exact:remaining*Math.max(.0001,weight(item))/totalWeight}));
      shares.sort((a,b)=>b.exact-Math.floor(b.exact)-(a.exact-Math.floor(a.exact))||String(a.item.id).localeCompare(String(b.item.id)));
      let placed=0;
      shares.forEach(part=>{
        if(remaining<=0)return;
        const room=(capacity?capacity(part.item):Infinity)-result[part.item.id];
        const amount=Math.min(room,Math.max(1,Math.floor(part.exact)));
        if(amount>0){result[part.item.id]+=amount;remaining-=amount;placed+=amount;}
      });
      if(!placed){const part=shares[0]; result[part.item.id]++; remaining--;}
    }
    return result;
  }
  function updateDemographics(runtime,settlement,world,year,national){
    const previous=runtime.demographics, economy=runtime.economy, health=runtime.publicHealth;
    const rng=streamFor(world,year,settlement.id,'demography');
    const population=Math.max(0,previous.population);
    previous.populationBefore=population;
    const rural=settlement&&settlement.kind==='village'?1:settlement&&settlement.kind==='town'?.55:0;
    const birthRate=clamp(.006+rural*.003+rng.range(-.00035,.00035),.002,.014);
    const deathRate=clamp(.008+(1-health.sanitation)*.006+health.outbreakRisk*.004-nationalValue(national,['healthSupport','health'],0)*.002,.002,.022);
    const births=Math.min(Number.MAX_SAFE_INTEGER,Math.round(population*birthRate));
    const deaths=Math.min(population,Math.round(population*deathRate));
    previous.births=births; previous.deaths=deaths;
    previous.internalIn=0; previous.internalOut=0; previous.externalMigration=0; previous.netMigration=0;
    previous.naturalPopulation=Math.max(0,population+births-deaths);
    previous.population=previous.naturalPopulation;
    return previous;
  }
  function applyInternalMigration(world,defs,year){
    const items=defs.map(settlement=>({id:settlement.id,settlement,runtime:world.settlements[settlement.id]}));
    const totalPopulation=items.reduce((sum,item)=>sum+item.runtime.demographics.population,0);
    const availableOut=items.reduce((sum,item)=>sum+Math.max(0,item.runtime.demographics.population-1),0);
    const pool=Math.min(availableOut,Math.max(0,Math.round(totalPopulation*.0018)));
    const inbound=allocateInteger(pool,items,item=>.05+attractiveness(item.runtime));
    const outbound=allocateInteger(pool,items,item=>.05+(1-attractiveness(item.runtime)),item=>Math.max(0,item.runtime.demographics.population-1));
    const totalIn=Object.values(inbound).reduce((sum,value)=>sum+value,0), totalOut=Object.values(outbound).reduce((sum,value)=>sum+value,0);
    const correction=totalIn-totalOut;
    if(correction>0){
      const extra=allocateInteger(correction,items,item=>.05+(1-attractiveness(item.runtime)),item=>Math.max(0,item.runtime.demographics.population-1-outbound[item.id]));
      items.forEach(item=>{outbound[item.id]+=extra[item.id];});
    } else if(correction<0){
      const extra=allocateInteger(-correction,items,item=>.05+attractiveness(item.runtime));
      items.forEach(item=>{inbound[item.id]+=extra[item.id];});
    }
    const finalIn=Object.values(inbound).reduce((sum,value)=>sum+value,0), finalOut=Object.values(outbound).reduce((sum,value)=>sum+value,0);
    items.forEach(item=>{
      const d=item.runtime.demographics;
      d.internalIn=inbound[item.id]; d.internalOut=outbound[item.id];
      d.population=Math.max(0,d.population+d.internalIn-d.internalOut);
      d.netMigration=d.internalIn-d.internalOut;
    });
    return {internalIn:finalIn,internalOut:finalOut,balance:finalIn-finalOut};
  }
  function externalFor(world,context,id){
    const source=context&&context.externalMigration!=null?context.externalMigration:world.externalMigration;
    if(source&&typeof source==='object'&&Number.isFinite(Number(source[id])))return Number(source[id]);
    return Number.isFinite(Number(source))?Number(source):0;
  }
  function updateEducation(runtime,settlement){
    const population=runtime.demographics.population, kind=settlement&&settlement.kind;
    const capacityTarget=Math.max(0,Math.round(population*(kind==='city'?.11:kind==='town'?.09:.07)));
    const enrolledTarget=Math.max(0,Math.round(population*(kind==='city'?.06:kind==='town'?.055:.045)));
    runtime.education.schoolCapacity=Math.max(0,Math.round(runtime.education.schoolCapacity*.85+capacityTarget*.15));
    runtime.education.enrolledStudents=Math.max(0,Math.min(population,Math.round(runtime.education.enrolledStudents*.8+enrolledTarget*.2)));
    runtime.education.capacityPressure=bounded(runtime.education.enrolledStudents/Math.max(1,runtime.education.schoolCapacity));
    return runtime.education;
  }
  function updateSecurity(runtime,settlement,world,year,national){
    const economy=runtime.economy, health=runtime.publicHealth, previous=runtime.security;
    const rng=streamFor(world,year,settlement.id,'security');
    const unemployment=1-economy.employmentIndex;
    const targetUnrest=clamp(unemployment*.55+(1-health.sanitation)*.18+health.outbreakRisk*.12+previous.unrest*.12+
      nationalValue(national,['unrestPressure','unrest'],0)-nationalValue(national,['stability'],0)+rng.range(-.012,.012));
    const unrest=bounded(previous.unrest*.7+targetUnrest*.3);
    const base=bounded((settlement&&settlement.surveillance||0)/100);
    const surveillanceTarget=clamp(base+unrest*.26+nationalValue(national,['surveillancePressure','surveillance'],0));
    const surveillance=bounded(previous.surveillance*.72+surveillanceTarget*.28);
    const checkpointPressure=bounded(surveillance*.58+(settlement&&settlement.travelDifficulty||1)*.08+unrest*.18);
    runtime.security={unrest,surveillance,checkpointPressure};
    return runtime.security;
  }
  function tick(world,context){
    if(!world) throw new Error('WorldSimulation.tick requires a world object');
    const ctx=context||{}, year=Number.isFinite(Number(ctx.year))?Number(ctx.year):Number(world.year)||0;
    const national=Object.assign({},world.nationalModifiers||{},ctx.national||{});
    const defs=definitions(migrate(world));
    const before=defs.reduce((sum,settlement)=>sum+world.settlements[settlement.id].demographics.population,0);
    defs.forEach(settlement=>{
      const runtime=repairRuntime(world.settlements[settlement.id],settlement);
      const globalOutbreak=world.publicHealth&&world.publicHealth.outbreak;
      if(globalOutbreak&&(!globalOutbreak.endYear||year<=globalOutbreak.endYear)){
        const activeId=world.publicHealth.activeSettlementId;
        if(!activeId||activeId===settlement.id) root.PublicHealth.triggerShock(runtime,'outbreak',clamp((globalOutbreak.severity||1)*.38),1,year);
      }
      root.SettlementEconomy.tick(runtime,settlement,{random:streamFor(world,year,settlement.id,'economy'),national});
      root.PublicHealth.tick(runtime,settlement,{random:streamFor(world,year,settlement.id,'health'),national,year});
      updateDemographics(runtime,settlement,world,year,national);
      world.settlements[settlement.id]=runtime;
    });
    const naturalPopulation=defs.reduce((sum,settlement)=>sum+world.settlements[settlement.id].demographics.population,0);
    const internal=applyInternalMigration(world,defs,year);
    let externalNet=0;
    defs.forEach(settlement=>{
      const runtime=world.settlements[settlement.id];
      const requestedExternal=externalFor(world,ctx,settlement.id);
      const external=requestedExternal<0?-Math.min(Math.abs(requestedExternal),runtime.demographics.population):requestedExternal;
      runtime.demographics.externalMigration=external;
      runtime.demographics.population=Math.max(0,runtime.demographics.population+external);
      runtime.demographics.populationAfter=runtime.demographics.population;
      runtime.demographics.netMigration=runtime.demographics.internalIn-runtime.demographics.internalOut+external;
      externalNet+=external;
      updateEducation(runtime,settlement);
      updateSecurity(runtime,settlement,world,year,national);
    });
    const after=defs.reduce((sum,settlement)=>sum+world.settlements[settlement.id].demographics.population,0);
    world.totalPopulation=after;
    world.lastMigrationAccounting={year,populationBefore:before,naturalPopulation,populationAfter:after,internalIn:internal.internalIn,internalOut:internal.internalOut,balance:internal.balance,externalNet};
    return world.settlements;
  }
  function getSettlementState(world,id){ return world&&world.settlements&&world.settlements[id]||null; }
  function getCostOfLiving(world,id){ return root.SettlementEconomy.costOfLiving(getSettlementState(world,id)); }
  function getEmploymentConditions(world,id){ return root.SettlementEconomy.employmentConditions(getSettlementState(world,id)); }
  function getHealthcarePressure(world,id){ return root.PublicHealth.pressure(getSettlementState(world,id)); }
  function label(value,low,high,labels){ return value>=high?labels[2]:value>=low?labels[1]:labels[0]; }
  function costLabel(value){ return label(value,1.02,1.2,['Low','Moderate','High']); }
  function securityLabel(value){ return label(value,.35,.68,['Low','Elevated','Severe']); }
  function unrestLabel(value){ return label(value,.25,.58,['Low','Elevated','High']); }
  function getSettlementConditions(world,id){
    const state=getSettlementState(world,id);
    if(!state)return {employment:'Unknown',costOfLiving:'Unknown',healthcare:'Unknown',unrest:'Unknown',surveillance:'Unknown'};
    return {employment:getEmploymentConditions(world,id),costOfLiving:costLabel(getCostOfLiving(world,id)),healthcare:root.PublicHealth.pressureLabel(getHealthcarePressure(world,id)),unrest:unrestLabel(state.security.unrest),surveillance:securityLabel(state.security.surveillance)};
  }
  root.WorldSimulation={SIMULATION_SCHEMA_VERSION,RANGES,migrate,initialize,tick,getSettlementState,getCostOfLiving,getEmploymentConditions,getHealthcarePressure,getSettlementConditions,definitions,streamFor,attractiveness};
})(typeof globalThis!=='undefined'?globalThis:this);
