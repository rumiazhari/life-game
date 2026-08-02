'use strict';

(function(root){
  const MIN_INDEX=.65, MAX_INDEX=1.55;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const bounded=(value,min=0,max=1)=>clamp(Number.isFinite(Number(value))?Number(value):min,min,max);

  function populationOf(settlement){
    const text=String(settlement&&settlement.population||'0').replace(/[^0-9]/g,'');
    return Math.max(0,Number(text)||0);
  }

  function traitProfile(settlement){
    const kind=settlement&&settlement.kind;
    const buildings=Array.isArray(settlement&&settlement.buildings)?settlement.buildings:[];
    const workplaces=buildings.filter(b=>b.type==='workplace').length;
    const markets=buildings.filter(b=>b.type==='market').length;
    const schools=buildings.filter(b=>b.type==='school').length;
    const clinics=buildings.filter(b=>b.type==='clinic').length;
    const kindBase=kind==='city'?0.68:kind==='town'?0.56:0.44;
    const industryBase=kind==='city'?0.72:kind==='town'?0.58:0.38;
    return {
      population:populationOf(settlement),
      urbanity:kind==='city'?1:kind==='town'?.62:.3,
      employmentBase:kindBase+workplaces*.015+markets*.012,
      industryBase:industryBase+workplaces*.025,
      foodBase:kind==='village'?.86:kind==='town'?.98:1.08,
      rentBase:kind==='city'?1.12:kind==='town'?1:.82,
      wageBase:kind==='city'?1.12:kind==='town'?1:.9,
      schoolCount:schools,
      clinicCount:clinics,
      surveillance:bounded((settlement&&settlement.surveillance||0)/100),
      travelDifficulty:Number(settlement&&settlement.travelDifficulty)||1
    };
  }

  function create(settlement){
    const traits=traitProfile(settlement);
    const industryDemand={};
    const types=['agriculture','manufacturing','services'];
    types.forEach((type,index)=>{ industryDemand[type]=bounded(traits.industryBase-(index===0?traits.urbanity*.12:0)+(index===1?traits.urbanity*.08:0)); });
    return {
      employmentIndex:bounded(traits.employmentBase),
      wageIndex:clamp(traits.wageBase,MIN_INDEX,MAX_INDEX),
      foodPriceIndex:clamp(traits.foodBase,MIN_INDEX,MAX_INDEX),
      rentIndex:clamp(traits.rentBase,MIN_INDEX,MAX_INDEX),
      industryDemand
    };
  }

  function randomDelta(rng,amount){ return rng&&typeof rng.range==='function'?rng.range(-amount,amount):0; }
  function national(context,key,fallback){
    const modifiers=context&&context.national||{};
    return Number.isFinite(Number(modifiers[key]))?Number(modifiers[key]):fallback;
  }

  function tick(runtime,settlement,context){
    const previous=runtime.economy;
    const traits=traitProfile(settlement);
    const rng=context&&context.random;
    const nationalEmployment=national(context,'employment',0);
    const nationalPrices=national(context,'prices',0);
    const population=runtime.demographics&&runtime.demographics.population||traits.population;
    const initial=runtime.demographics&&runtime.demographics.initialPopulation||traits.population||1;
    const populationPressure=clamp(population/initial-1,-.35,.35);
    const migrationPressure=clamp((runtime.demographics&&runtime.demographics.netMigration||0)/Math.max(1,population),-.02,.02);
    const industryDemand={};
    Object.keys(previous.industryDemand||{}).forEach(type=>{
      const target=type==='agriculture'?traits.industryBase-traits.urbanity*.12:type==='manufacturing'?traits.industryBase+traits.urbanity*.08:traits.employmentBase;
      industryDemand[type]=bounded(previous.industryDemand[type]*.82+target*.18+nationalEmployment*.08+randomDelta(rng,.018));
    });
    const industryAverage=Object.values(industryDemand).reduce((sum,value)=>sum+value,0)/Math.max(1,Object.keys(industryDemand).length);
    const employmentTarget=clamp(traits.employmentBase*.62+industryAverage*.35+nationalEmployment+randomDelta(rng,.018),0,1);
    const employmentIndex=bounded(previous.employmentIndex*.72+employmentTarget*.28);
    const wageTarget=clamp(traits.wageBase+employmentIndex*.12+nationalEmployment*.08,MIN_INDEX,MAX_INDEX);
    const wageIndex=clamp(previous.wageIndex*.8+wageTarget*.2+randomDelta(rng,.012),MIN_INDEX,MAX_INDEX);
    const foodTarget=clamp(traits.foodBase+(1-employmentIndex)*.08+nationalPrices*.12,MIN_INDEX,MAX_INDEX);
    const foodPriceIndex=clamp(previous.foodPriceIndex*.82+foodTarget*.18+randomDelta(rng,.01),MIN_INDEX,MAX_INDEX);
    const rentTarget=clamp(traits.rentBase+populationPressure*.38+migrationPressure*4+employmentIndex*.06+nationalPrices*.06,MIN_INDEX,MAX_INDEX);
    const rentIndex=clamp(previous.rentIndex*.78+rentTarget*.22+randomDelta(rng,.012),MIN_INDEX,MAX_INDEX);
    runtime.economy={employmentIndex,wageIndex,foodPriceIndex,rentIndex,industryDemand};
    return runtime.economy;
  }

  function costOfLiving(runtime){
    const economy=runtime&&runtime.economy;
    if(!economy) return 1;
    return clamp((economy.foodPriceIndex*.55+economy.rentIndex*.45),MIN_INDEX,MAX_INDEX);
  }

  function employmentConditions(runtime){
    const value=bounded(runtime&&runtime.economy&&runtime.economy.employmentIndex);
    return value>=.7?'Strong':value>=.5?'Stable':value>=.32?'Tight':'Scarce';
  }

  root.SettlementEconomy={MIN_INDEX,MAX_INDEX,traitProfile,create,tick,costOfLiving,employmentConditions};
})(typeof globalThis!=='undefined'?globalThis:this);
