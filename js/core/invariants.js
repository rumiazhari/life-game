'use strict';

(function(root){
  const boundedStats=['health','happiness','smarts','looks','relations','vice','crime','scrutiny','freedom','housingSecurity','financialSecurity'];
  const runtimeUnitFields=[
    ['publicHealth','sanitation'],['publicHealth','clinicCapacity'],['publicHealth','clinicDemand'],['publicHealth','outbreakRisk'],
    ['security','unrest'],['security','surveillance'],['security','checkpointPressure'],['education','capacityPressure']
  ];
  const requiredGroups=['economy','publicHealth','education','security','demographics'];
  const expectedNestedFields={
    economy:['employmentIndex','wageIndex','foodPriceIndex','rentIndex'],
    publicHealth:['sanitation','clinicCapacity','clinicDemand','outbreakRisk'],
    education:['schoolCapacity','enrolledStudents','capacityPressure'],
    security:['unrest','surveillance','checkpointPressure'],
    demographics:['population','initialPopulation','populationBefore','naturalPopulation','populationAfter','births','deaths','internalIn','internalOut','externalMigration','netMigration']
  };
  function knownSettlementIds(world){
    const ids=new Set();
    if(typeof KARSEN_SETTLEMENTS!=='undefined'&&Array.isArray(KARSEN_SETTLEMENTS)) KARSEN_SETTLEMENTS.forEach(item=>{if(item&&item.id)ids.add(item.id);});
    if(world&&Array.isArray(world.settlementDefinitions)) world.settlementDefinitions.forEach(item=>{if(item&&item.id)ids.add(item.id);});
    return ids;
  }

  function checkSettlementRuntimeState(world){
    const violations=[];
    const settlements=world&&world.settlements||{};
    if(world&&Object.keys(settlements).length&&world.simulationSchemaVersion!==2) violations.push('world simulation schema must be version 2');
    const knownIds=knownSettlementIds(world);
    if(world&&typeof KARSEN_SETTLEMENTS!=='undefined'&&Array.isArray(KARSEN_SETTLEMENTS)) KARSEN_SETTLEMENTS.forEach(item=>{
      if(item&&item.id&&!Object.prototype.hasOwnProperty.call(settlements,item.id)) violations.push('missing runtime state for settlement '+item.id);
    });
    Object.keys(settlements).forEach(id=>{
      const state=settlements[id]||{};
      if(!knownIds.has(id)) violations.push('runtime settlement '+id+' is not a static or explicit settlement definition');
      requiredGroups.forEach(group=>{
        if(!state[group]||typeof state[group]!=='object'||Array.isArray(state[group])) violations.push('settlement '+id+' requires '+group+' runtime state');
      });
      runtimeUnitFields.forEach(([group,key])=>{
        const value=state[group]&&state[group][key];
        if(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1) violations.push('settlement '+id+' '+group+'.'+key+' must be between 0 and 1');
      });
      const economy=state.economy||{};
      ['employmentIndex'].forEach(key=>{
        if(!Number.isFinite(Number(economy[key]))||Number(economy[key])<0||Number(economy[key])>1) violations.push('settlement '+id+' economy.'+key+' must be between 0 and 1');
      });
      ['wageIndex','foodPriceIndex','rentIndex'].forEach(key=>{
        if(!Number.isFinite(Number(economy[key]))||Number(economy[key])<.65||Number(economy[key])>1.55) violations.push('settlement '+id+' economy.'+key+' must be between 0.65 and 1.55');
      });
      Object.values(economy.industryDemand||{}).forEach(value=>{
        if(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1) violations.push('settlement '+id+' industry demand must be between 0 and 1');
      });
      ['agriculture','manufacturing','services'].forEach(key=>{
        if(!Number.isFinite(Number(economy.industryDemand&&economy.industryDemand[key]))) violations.push('settlement '+id+' economy.industryDemand.'+key+' must be finite');
      });
      const shocks=state.publicHealth&&state.publicHealth.shocks||{};
      const shockTypes=typeof PublicHealth!=='undefined'&&Array.isArray(PublicHealth.SHOCK_TYPES)?PublicHealth.SHOCK_TYPES:[];
      shockTypes.forEach(key=>{
        if(!Number.isFinite(Number(shocks[key]))||Number(shocks[key])<0||Number(shocks[key])>1) violations.push('settlement '+id+' publicHealth.shocks.'+key+' must be between 0 and 1');
      });
      const education=state.education||{}, demographics=state.demographics||{};
      Object.keys(expectedNestedFields).forEach(group=>{
        const target=state[group]||{};
        expectedNestedFields[group].forEach(key=>{
          if(!Number.isFinite(Number(target[key]))) violations.push('settlement '+id+' '+group+'.'+key+' must be finite');
        });
      });
      if(Number(demographics.population)<0||Number(demographics.initialPopulation)<0) violations.push('settlement '+id+' population must not be negative');
      if(Number(education.schoolCapacity)<0||Number(education.enrolledStudents)<0) violations.push('settlement '+id+' education counts must not be negative');
      if(Number(education.enrolledStudents)>Number(demographics.population)) violations.push('settlement '+id+' enrolled students cannot exceed population');
      const hasAnnualAccounting=['populationBefore','naturalPopulation','populationAfter'].every(key=>Number.isFinite(Number(demographics[key])));
      if(hasAnnualAccounting){
        const expectedNatural=Number(demographics.populationBefore)+Number(demographics.births)-Number(demographics.deaths);
        const expectedAfter=Number(demographics.naturalPopulation)+Number(demographics.internalIn)-Number(demographics.internalOut)+Number(demographics.externalMigration);
        if(Number(demographics.naturalPopulation)!==expectedNatural) violations.push('settlement '+id+' natural population equation does not balance');
        if(Number(demographics.populationAfter)!==expectedAfter||Number(demographics.population)!==Number(demographics.populationAfter)) violations.push('settlement '+id+' annual population equation does not balance');
        if(Number(demographics.internalOut)>Number(demographics.naturalPopulation)) violations.push('settlement '+id+' internalOut exceeds available pre-migration population');
      }
    });
    const accounting=world&&world.lastMigrationAccounting;
    if(accounting){
      if(!Number.isFinite(Number(accounting.balance))||Number(accounting.balance)!==0) violations.push('internal migration must balance nationally at zero');
      ['populationBefore','naturalPopulation','populationAfter','internalIn','internalOut','externalNet'].forEach(key=>{
        if(!Number.isFinite(Number(accounting[key]))) violations.push('migration accounting '+key+' must be finite');
      });
      if(Number.isFinite(Number(accounting.populationAfter))&&Number.isFinite(Number(accounting.naturalPopulation))&&Number.isFinite(Number(accounting.externalNet))&&
        Number(accounting.populationAfter)!==Number(accounting.naturalPopulation)+Number(accounting.externalNet)){
        violations.push('population after migration must equal natural population plus external migration');
      }
      if(Number.isFinite(Number(accounting.internalIn))&&Number.isFinite(Number(accounting.internalOut))&&Number(accounting.internalIn)!==Number(accounting.internalOut)){
        violations.push('internal migration inflow and outflow must match nationally');
      }
    }
    return violations;
  }

  function check(subject,world){
    const violations=[];
    const s=subject||null;
    const w=world||null;
    if(s&&w&&Number.isFinite(s.dob)&&Number.isFinite(s.age)&&Number.isFinite(w.year)&&w.year!==s.dob+s.age){
      violations.push('world year must equal subject birth year plus age');
    }
    violations.push(...checkSettlementRuntimeState(w));
    if(w&&typeof NpcSystem==='object'&&NpcSystem&&typeof NpcSystem.checkInvariants==='function'){
      violations.push(...NpcSystem.checkInvariants(w,s,typeof Lineage!=='undefined'?Lineage:null));
    }
    if(s&&s.assets!=null&&!Number.isFinite(Number(s.assets))) violations.push('assets must be finite');
    if(s){
      boundedStats.forEach(key=>{
        if(s[key]!=null&&(!Number.isFinite(Number(s[key]))||Number(s[key])<0||Number(s[key])>100)) violations.push(key+' must be between 0 and 100');
      });
      const conditions=s.medical&&Array.isArray(s.medical.conditions)?s.medical.conditions:(Array.isArray(s.conditions)?s.conditions:[]);
      const active=conditions.filter(c=>c&&!c.resolved&&c.state!=='resolved');
      const seen=new Set();
      active.forEach(c=>{
        const key=String(c.id||c.name||'unknown');
        if(seen.has(key)) violations.push('active medical conditions must not contain duplicate '+key);
        seen.add(key);
      });
      const enrolled=!!(s.eduStage||(s.education&&s.education.stageId));
      if(enrolled&&s.traveling) violations.push('an enrolled subject must not have an active journey');
      if(s.alive===false&&!String(s.cause||'').trim()) violations.push('a deceased subject must have a death cause');
    }
    return {ok:violations.length===0,violations};
  }

  function assertValid(subject,world){
    const result=check(subject,world);
    if(!result.ok) throw new Error('Invariant violation: '+result.violations.join('; '));
    return result;
  }

  root.Invariants={boundedStats,check,assertValid,checkSettlementRuntimeState};
})(typeof globalThis!=='undefined'?globalThis:this);
