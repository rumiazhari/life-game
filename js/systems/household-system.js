'use strict';

(function(root){
  const SCHEMA_VERSION=1;
  const MAX_HOUSEHOLDS=120;
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const integer=value=>Math.max(0,Math.round(finite(value,0)));

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('HouseholdSystem.ensure requires a world object');
    if(!world.households||typeof world.households!=='object'||Array.isArray(world.households)) world.households={};
    if(!Number.isFinite(Number(world.householdCounter))||Number(world.householdCounter)<0) world.householdCounter=0;
    world.householdSchemaVersion=SCHEMA_VERSION;
    return world.households;
  }

  function nextId(world){
    ensure(world);
    world.householdCounter+=1;
    return 'household:'+String(world.householdCounter).padStart(5,'0');
  }

  function uniqueIds(values){ return [...new Set((Array.isArray(values)?values:[]).filter(Boolean).map(String))]; }

  function defaultHousing(){
    return {mode:'rented',buildingId:null,quality:.5,rooms:2};
  }

  function defaultFinances(){
    return {income:0,expenses:0,savings:0,debt:0,lastBalance:0,subjectIncome:0,otherMemberIncome:0,otherMemberGrossIncome:0,otherMemberPersonalExpenses:0,otherSubjectCashFlow:0,subjectExpenses:0,memberExpenses:0,sharedContributions:0,personalAssetChange:0,npcPersonalWealthChange:0,personalAssetsUsed:0,savingsUsed:0,householdDebtRepaid:0,newHouseholdDebt:0,sharedSavingsAdded:0,sharedSavingsChange:0,householdDebtChange:0,accountingIdentity:0,expenseBreakdown:{}};
  }

  function normalize(household,world){
    const out=household&&typeof household==='object'?household:{};
    out.id=String(out.id||nextId(world));
    out.settlementId=String(out.settlementId||world.activeSettlementId||'branec');
    out.memberIds=uniqueIds(out.memberIds);
    out.historicalMemberIds=uniqueIds(out.historicalMemberIds);
    out.dependentIds=uniqueIds(out.dependentIds).filter(id=>out.memberIds.includes(id));
    out.housing=Object.assign(defaultHousing(),out.housing||{});
    out.housing.mode=String(out.housing.mode||'rented');
    out.housing.buildingId=out.housing.buildingId==null?null:String(out.housing.buildingId);
    out.housing.quality=clamp(out.housing.quality==null?.5:out.housing.quality);
    out.housing.rooms=Math.max(1,integer(out.housing.rooms||1));
    out.finances=Object.assign(defaultFinances(),out.finances||{});
    ['income','expenses','savings','debt','lastBalance','subjectIncome','otherMemberIncome','otherMemberGrossIncome','otherMemberPersonalExpenses','otherSubjectCashFlow','subjectExpenses','memberExpenses','sharedContributions','personalAssetChange','npcPersonalWealthChange','personalAssetsUsed','savingsUsed','householdDebtRepaid','newHouseholdDebt','sharedSavingsAdded','sharedSavingsChange','householdDebtChange','accountingIdentity'].forEach(key=>{out.finances[key]=finite(out.finances[key],0);});
    out.finances.expenseBreakdown=out.finances.expenseBreakdown&&typeof out.finances.expenseBreakdown==='object'?out.finances.expenseBreakdown:{};
    out.finances.debt=Math.max(0,out.finances.debt);
    out.socialClass=String(out.socialClass||'working');
    out.foodSecurity=clamp(out.foodSecurity==null?.55:out.foodSecurity);
    out.stability=clamp(out.stability==null?.55:out.stability);
    out.origin=String(out.origin||'generated');
    out.createdYear=Number.isFinite(Number(out.createdYear))?Math.round(Number(out.createdYear)):Number(world.year)||0;
    out.lastMoveYear=Number.isFinite(Number(out.lastMoveYear))?Math.round(Number(out.lastMoveYear)):null;
    out.flags=out.flags&&typeof out.flags==='object'?out.flags:{};
    return out;
  }

  function create(world,input){
    const households=ensure(world);
    const household=normalize(Object.assign({},input||{}, {id:(input&&input.id)||nextId(world)}),world);
    households[household.id]=household;
    trim(world);
    return household;
  }

  function trim(world){
    const households=ensure(world);
    const ids=Object.keys(households);
    if(ids.length<=MAX_HOUSEHOLDS) return;
    ids.map(id=>households[id]).filter(h=>!h.memberIds.length)
      .sort((a,b)=>Number(a.createdYear)-Number(b.createdYear)||String(a.id).localeCompare(String(b.id)))
      .slice(0,ids.length-MAX_HOUSEHOLDS)
      .forEach(h=>delete households[h.id]);
  }

  function all(world){ return Object.values(ensure(world)); }

  function findByMember(world,memberId){
    const id=String(memberId||'');
    return all(world).find(household=>household.memberIds.includes(id))||null;
  }

  function addMember(world,householdId,memberId,dependent=false){
    const households=ensure(world), household=households[householdId];
    if(!household||!memberId) return null;
    const id=String(memberId);
    all(world).forEach(other=>{
      if(other.id===household.id) return;
      other.memberIds=other.memberIds.filter(value=>value!==id);
      other.dependentIds=other.dependentIds.filter(value=>value!==id);
    });
    if(!household.memberIds.includes(id)) household.memberIds.push(id);
    household.historicalMemberIds=household.historicalMemberIds.filter(value=>value!==id);
    if(dependent&&!household.dependentIds.includes(id)) household.dependentIds.push(id);
    if(!dependent) household.dependentIds=household.dependentIds.filter(value=>value!==id);
    return household;
  }

  function removeMember(world,householdId,memberId){
    const household=ensure(world)[householdId];
    if(!household) return null;
    const id=String(memberId||'');
    household.memberIds=household.memberIds.filter(value=>value!==id);
    household.dependentIds=household.dependentIds.filter(value=>value!==id);
    return household;
  }

  function merge(world,targetId,sourceId){
    const households=ensure(world), target=households[targetId], source=households[sourceId];
    if(!target||!source||target.id===source.id) return target||null;
    source.memberIds.forEach(id=>addMember(world,target.id,id,source.dependentIds.includes(id)));
    target.finances.savings+=source.finances.savings;
    target.finances.debt+=source.finances.debt;
    target.stability=clamp((target.stability+source.stability)/2);
    delete households[source.id];
    return target;
  }

  function settlementRuntime(world,settlementId){
    return world&&world.settlements&&world.settlements[settlementId]||null;
  }

  function healthPressure(runtime){
    if(root.PublicHealth&&typeof root.PublicHealth.pressure==='function') return root.PublicHealth.pressure(runtime);
    return 0;
  }

  function livingNpc(world,id){
    const npc=world&&world.npcs&&world.npcs[id];
    return npc&&npc.alive!==false&&!npc.isSubject?npc:null;
  }

  function livingMember(world,id,subject){
    if(subject&&String(subject.npcId||'')===String(id||'')) return subject.alive!==false?subject:null;
    return livingNpc(world,id);
  }

  function classify(finances){
    const net=finite(finances.savings,0)-finite(finances.debt,0);
    if(net>=8000) return 'affluent';
    if(net>=1800) return 'comfortable';
    if(net>=-500) return 'working';
    if(net>=-2500) return 'precarious';
    return 'destitute';
  }

  function baseLifestyle(world,subject,year,settlementId){
    if(!subject||subject.age<16||subject.livingAtHome) return {housing:0,food:0,childcare:0,debt:0,total:0};
    const settlement=world&&world.settlements&&world.settlements[settlementId||subject.location&&subject.location.settlementId||world.activeSettlementId];
    const economy=settlement&&settlement.economy||{};
    const housingFn=typeof root.currentHousing==='function'?root.currentHousing:(typeof currentHousing==='function'?currentHousing:null);
    const foodFn=typeof root.currentFood==='function'?root.currentFood:(typeof currentFood==='function'?currentFood:null);
    const childcareFn=typeof root.currentChildcare==='function'?root.currentChildcare:(typeof currentChildcare==='function'?currentChildcare:null);
    const housing=housingFn?housingFn():(typeof HOUSING!=='undefined'&&Array.isArray(HOUSING)?HOUSING.find(item=>item.id===subject.lifestyle.housing):null);
    const food=foodFn?foodFn():(typeof FOOD!=='undefined'&&Array.isArray(FOOD)?FOOD.find(item=>item.id===subject.lifestyle.food):null);
    const childcare=childcareFn?childcareFn():(typeof CHILDCARE!=='undefined'&&Array.isArray(CHILDCARE)?CHILDCARE.find(item=>item.id===subject.lifestyle.childcare):null);
    const wrapped=!!(root.WorldGameplay&&root.WorldGameplay.originals&&root.WorldGameplay.originals.currentHousing);
    const housingCost=Math.round(finite(housing&&housing.rent,0)*(wrapped?1:finite(economy.rentIndex,1)));
    const foodCost=Math.round(finite(food&&food.cost,0)*(wrapped?1:finite(economy.foodPriceIndex,1)));
    const childcareCost=subject.kids>0?finite(childcare&&childcare.costPerKid,0)*Math.max(0,Number(subject.kids)||0):0;
    const debtCost=(Array.isArray(subject.liabilities)?subject.liabilities:[]).reduce((sum,liability)=>sum+Math.max(0,finite(liability&&liability.annualPayment,0)),0);
    return {housing:housingCost,food:foodCost,childcare:Math.round(childcareCost),debt:Math.round(debtCost),total:Math.round(housingCost+foodCost+childcareCost+debtCost)};
  }

  function wartime(year){ return (year>=1914&&year<=1918)||(year>=1939&&year<=1945); }

  function estimateOutlay(world,household,subject,options){
    const year=Number(options&&options.year)||Number(world&&world.year)||0;
    const activeHousehold=household||findByMember(world,subject&&subject.npcId);
    if(!activeHousehold) return {personalLifestyleOutlay:0,additionalHouseholdCosts:0,projectedTotalOutlay:0,livingMemberCosts:0,healthcareCosts:0,breakdown:{rent:0,food:0,childcare:0,medical:0,debt:0,memberIncrement:0,wartimeSurcharge:0}};
    const runtime=settlementRuntime(world,activeHousehold.settlementId);
    const memberNpcs=activeHousehold.memberIds.map(id=>livingNpc(world,id)).filter(Boolean);
    const subjectPresent=!!(subject&&subject.npcId&&activeHousehold.memberIds.includes(subject.npcId)&&subject.alive!==false);
    if(!subjectPresent){
      const economy=runtime&&runtime.economy||{}, foodIndex=finite(economy.foodPriceIndex,1), rentIndex=finite(economy.rentIndex,1);
      const dependents=activeHousehold.dependentIds.filter(id=>!!livingMember(world,id,subject)).length;
      const people=Math.max(1,memberNpcs.length);
      const rent=Math.round((220+activeHousehold.housing.rooms*95)*rentIndex);
      const food=Math.round((110*people+35*dependents)*foodIndex);
      const healthcare=Math.round(90*healthPressure(runtime)*people);
      return {personalLifestyleOutlay:0,additionalHouseholdCosts:rent+food+healthcare,projectedTotalOutlay:rent+food+healthcare,livingMemberCosts:rent+food,healthcareCosts:healthcare,breakdown:{rent,food,childcare:0,medical:healthcare,debt:0,memberIncrement:0,wartimeSurcharge:0}};
    }
    const lifestyle=baseLifestyle(world,subject,year,activeHousehold.settlementId);
    const surcharge=wartime(year)?Math.round(lifestyle.total*.15):0;
    const economy=runtime&&runtime.economy||{}, foodIndex=finite(economy.foodPriceIndex,1);
    const livingOtherAdults=memberNpcs.filter(npc=>npc.id!==subject.npcId&&npc.alive!==false&&!activeHousehold.dependentIds.includes(npc.id)).length;
    const livingDependents=activeHousehold.dependentIds.filter(id=>id!==subject.npcId&&!!livingMember(world,id,subject)).length;
    const memberIncrement=Math.round((110*livingOtherAdults+35*livingDependents)*foodIndex);
    const healthcare=Math.round(90*healthPressure(runtime)*Math.max(1,memberNpcs.length+1));
    const personalLifestyleOutlay=lifestyle.total+surcharge;
    const additionalHouseholdCosts=memberIncrement+healthcare;
    return {personalLifestyleOutlay,additionalHouseholdCosts,projectedTotalOutlay:personalLifestyleOutlay+additionalHouseholdCosts,livingMemberCosts:memberIncrement,healthcareCosts:healthcare,breakdown:{rent:lifestyle.housing,food:lifestyle.food,childcare:lifestyle.childcare,medical:healthcare,debt:lifestyle.debt,memberIncrement,wartimeSurcharge:surcharge}};
  }

  function expenseModel(world,household,subject,memberNpcs,runtime){
    const estimate=estimateOutlay(world,household,subject,{year:world&&world.year});
    return {subjectExpenses:estimate.personalLifestyleOutlay,memberExpenses:estimate.additionalHouseholdCosts,breakdown:estimate.breakdown};
  }

  function memberContribution(npc,year){
    if(!npc||npc.alive===false||!npc.employment||npc.employment.status!=='employed') return {gross:0,contribution:0};
    const gross=Math.max(0,Math.round(finite(npc.employment.income,0)));
    if(Number(npc.__householdContributionYear)===Number(year)) return {gross,contribution:Math.max(0,Math.round(finite(npc.__householdContribution,0)))};
    return {gross,contribution:gross};
  }

  function householdAttractiveness(world,settlementId){
    const runtime=settlementRuntime(world,settlementId);
    if(!runtime) return 0;
    if(root.WorldSimulation&&typeof root.WorldSimulation.attractiveness==='function') return root.WorldSimulation.attractiveness(runtime);
    return clamp((runtime.economy&&runtime.economy.employmentIndex||.5)*.5+(runtime.publicHealth&&runtime.publicHealth.sanitation||.5)*.3+(1-(runtime.security&&runtime.security.unrest||.5))*.2);
  }

  function destinationFor(world,household,year){
    const definitions=root.WorldSimulation&&typeof root.WorldSimulation.definitions==='function'?root.WorldSimulation.definitions(world):[];
    const currentScore=householdAttractiveness(world,household.settlementId);
    const ranked=definitions
      .filter(settlement=>settlement&&settlement.id&&settlement.id!==household.settlementId)
      .map(settlement=>({id:settlement.id,score:householdAttractiveness(world,settlement.id)}))
      .sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
    const best=ranked[0];
    if(!best||best.score<currentScore+.08) return null;
    const rng=root.Random.create([world.seed,year,household.id,'household-migration'].join('|'));
    const pressure=clamp((.42-household.stability)*1.25+(best.score-currentScore));
    return rng.chance(clamp(.025+pressure*.16,0,.28))?best.id:null;
  }

  function move(world,household,destinationId,year){
    if(!household||!destinationId||destinationId===household.settlementId) return false;
    household.settlementId=String(destinationId);
    household.lastMoveYear=Number(year)||0;
    household.memberIds.forEach(id=>{
      const npc=world.npcs&&world.npcs[id];
      if(npc&&!npc.isSubject) npc.locationId=household.settlementId;
    });
    return true;
  }

  function reconcile(world,subject){
    const households=ensure(world), npcs=world.npcs||{};
    Object.keys(households).forEach(id=>{households[id]=normalize(households[id],world);});

    const seen=new Set();
    all(world).sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(household=>{
      household.memberIds=household.memberIds.filter(id=>{
        const npc=npcs[id];
        if(npc&&npc.alive===false){
          if(!household.historicalMemberIds.includes(id)) household.historicalMemberIds.push(id);
          return false;
        }
        return true;
      });
      household.memberIds=household.memberIds.filter(id=>{
        if(seen.has(id)) return false;
        if(!npcs[id]&&(!subject||subject.npcId!==id)) return false;
        seen.add(id);
        return true;
      });
      household.dependentIds=household.dependentIds.filter(id=>household.memberIds.includes(id)&&livingMember(world,id,subject));
      household.memberIds.forEach(id=>{if(npcs[id]) npcs[id].householdId=household.id;});
    });

    Object.values(npcs).forEach(npc=>{
      if(!npc||npc.alive===false||npc.isSubject) return;
      if(!seen.has(npc.id)){
        const household=create(world,{settlementId:npc.locationId||world.activeSettlementId,memberIds:[npc.id],dependentIds:[],origin:'orphan-repair'});
        npc.householdId=household.id;
        seen.add(npc.id);
      }
    });

    Object.keys(households).forEach(id=>{
      const household=households[id];
      if(!household.memberIds.length&&!household.flags.keepEmpty) delete households[id];
    });
    trim(world);
    return households;
  }

  function tick(world,context){
    const ctx=context||{}, subject=ctx.subject||null, year=Number(ctx.year)||Number(world.year)||0;
    reconcile(world,subject);
    const notices=[];
    all(world).sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(household=>{
      const runtime=settlementRuntime(world,household.settlementId);
      const economy=runtime&&runtime.economy||{};
      const memberNpcs=household.memberIds.map(id=>livingNpc(world,id)).filter(Boolean);
      const subjectMember=subject&&subject.npcId&&household.memberIds.includes(subject.npcId)&&subject.alive!==false?subject:null;
      const subjectIncome=subjectMember?Math.max(0,Math.round(finite(ctx.subjectIncome!=null?ctx.subjectIncome:(subjectMember.__worldWagePaidYear===year?subjectMember.__worldWagePaid:0),0))):0;
      const employed=memberNpcs.filter(npc=>npc.employment&&npc.employment.status==='employed');
      const memberIncome=employed.map(npc=>memberContribution(npc,year));
      const otherMemberIncome=memberIncome.reduce((sum,item)=>sum+item.contribution,0);
      const otherMemberGrossIncome=memberIncome.reduce((sum,item)=>sum+item.gross,0);
      const economyAssetChange=subjectMember&&ctx.subjectEconomySettled?Math.round(finite(ctx.subjectAssetsAfterEconomy,finite(subject.assets,0))-finite(ctx.subjectAssetsBefore,finite(subject.assets,0))):0;
      const model=expenseModel(world,household,subject,memberNpcs,runtime);
      const subjectExpenses=subjectMember&&ctx.subjectEconomySettled&&ctx.subjectExpensesPaid!=null?Math.max(0,Math.round(finite(ctx.subjectExpensesPaid,model.subjectExpenses))):model.subjectExpenses;
      const expenses=subjectExpenses+model.memberExpenses;
      const otherSubjectCashFlow=subjectMember&&ctx.subjectEconomySettled?Math.round(economyAssetChange-subjectIncome+subjectExpenses):0;
      const income=otherMemberIncome+subjectIncome+otherSubjectCashFlow;
      const startingSavings=Math.max(0,Math.round(finite(household.finances.savings,0)));
      const startingDebt=Math.max(0,Math.round(finite(household.finances.debt,0)));
      const subjectAssetsBefore=subjectMember?finite(ctx.subjectAssetsBefore,finite(subject.assets,0)):0;
      if(subjectMember&&!ctx.subjectEconomySettled){ subject.assets=finite(subject.assets,0)+subjectIncome-model.subjectExpenses; }
      let savingsUsed=0, personalAssetsUsed=0, householdDebtRepaid=0, newHouseholdDebt=0, sharedSavingsAdded=0;
      const subjectAssetsAfterEconomy=subjectMember?finite(subject.assets,0):0;
      const subjectDeficit=Math.max(0,-subjectAssetsAfterEconomy);
      const currentHouseholdDeficit=subjectDeficit+model.memberExpenses;
      const contributionApplied=Math.min(otherMemberIncome,currentHouseholdDeficit);
      const deficitAfterContribution=currentHouseholdDeficit-contributionApplied;
      savingsUsed=Math.min(startingSavings,deficitAfterContribution);
      let remainingDeficit=deficitAfterContribution-savingsUsed;
      if(subjectMember){
        personalAssetsUsed=Math.min(Math.max(0,subjectAssetsAfterEconomy),remainingDeficit);
        remainingDeficit-=personalAssetsUsed;
        subject.assets=Math.max(0,subjectAssetsAfterEconomy-personalAssetsUsed);
      }
      newHouseholdDebt=Math.max(0,remainingDeficit);
      const sharedSurplus=Math.max(0,otherMemberIncome-currentHouseholdDeficit);
      householdDebtRepaid=Math.min(startingDebt,sharedSurplus);
      sharedSavingsAdded=Math.max(0,sharedSurplus-householdDebtRepaid);
      const endingSavings=Math.max(0,startingSavings-savingsUsed+sharedSavingsAdded);
      const endingDebt=Math.max(0,startingDebt-householdDebtRepaid+newHouseholdDebt);
      const personalAssetChange=subjectMember?Math.round(finite(subject.assets,0)-subjectAssetsBefore):0;
      const npcPersonalWealthChange=memberNpcs.reduce((sum,npc)=>sum+(Number(npc.__householdPersonalWealthChangeYear)===year?finite(npc.__householdPersonalWealthChange,0):0),0);
      const otherMemberPersonalExpenses=memberNpcs.reduce((sum,npc)=>sum+(Number(npc.__householdPersonalExpensesYear)===year?finite(npc.__householdPersonalExpenses,0):0),0);
      const sharedSavingsChange=sharedSavingsAdded-savingsUsed;
      const householdDebtChange=newHouseholdDebt-householdDebtRepaid;
      const balance=income-expenses;
      const accountingIdentity=personalAssetChange+sharedSavingsChange-householdDebtChange;
      household.finances.income=income;
      household.finances.expenses=expenses;
      household.finances.lastBalance=balance;
      household.finances.subjectIncome=subjectIncome;
      household.finances.otherMemberIncome=otherMemberIncome;
      household.finances.otherMemberGrossIncome=otherMemberGrossIncome;
      household.finances.otherSubjectCashFlow=otherSubjectCashFlow;
      household.finances.subjectExpenses=subjectExpenses;
      household.finances.memberExpenses=model.memberExpenses;
      household.finances.sharedContributions=otherMemberIncome;
      household.finances.personalAssetChange=personalAssetChange;
      household.finances.npcPersonalWealthChange=npcPersonalWealthChange;
      household.finances.otherMemberPersonalExpenses=otherMemberPersonalExpenses;
      household.finances.personalAssetsUsed=personalAssetsUsed;
      household.finances.savingsUsed=savingsUsed;
      household.finances.householdDebtRepaid=householdDebtRepaid;
      household.finances.newHouseholdDebt=newHouseholdDebt;
      household.finances.sharedSavingsAdded=sharedSavingsAdded;
      household.finances.sharedSavingsChange=sharedSavingsChange;
      household.finances.householdDebtChange=householdDebtChange;
      household.finances.accountingIdentity=accountingIdentity;
      household.finances.expenseBreakdown=model.breakdown;
      household.finances.savings=endingSavings;
      household.finances.debt=endingDebt;
      const coverage=expenses?income/expenses:1;
      household.foodSecurity=clamp(household.foodSecurity*.72+clamp(.35+coverage*.35-healthPressure(runtime)*.18)*.28);
      household.stability=clamp(household.stability*.76+clamp(.38+coverage*.28+household.housing.quality*.18-healthPressure(runtime)*.12)*.24);
      household.socialClass=classify(household.finances);

      const containsSubject=!!(subject&&subject.npcId&&household.memberIds.includes(subject.npcId));
      if(!containsSubject&&household.lastMoveYear!==year){
        const destination=destinationFor(world,household,year);
        if(destination&&move(world,household,destination,year)) notices.push({type:'household_migration',householdId:household.id,settlementId:destination});
      }
    });
    reconcile(world,subject);
    return notices;
  }

  function checkInvariants(world,subject){
    const violations=[], households=world&&world.households||{}, npcs=world&&world.npcs||{}, memberships={};
    if(world&&Object.keys(households).length&&world.householdSchemaVersion!==SCHEMA_VERSION) violations.push('household schema must be version '+SCHEMA_VERSION);
    Object.keys(households).forEach(id=>{
      const h=households[id];
      if(!h||typeof h!=='object') {violations.push('household '+id+' must be an object');return;}
      if(h.id!==id) violations.push('household key and id must match for '+id);
      if(!Array.isArray(h.memberIds)||!Array.isArray(h.dependentIds)) violations.push('household '+id+' requires member and dependent arrays');
      ['foodSecurity','stability'].forEach(key=>{if(!Number.isFinite(Number(h[key]))||Number(h[key])<0||Number(h[key])>1) violations.push('household '+id+' '+key+' must be between 0 and 1');});
      ['income','expenses','savings','debt','lastBalance','subjectIncome','otherMemberIncome','otherMemberGrossIncome','otherMemberPersonalExpenses','otherSubjectCashFlow','subjectExpenses','memberExpenses','sharedContributions','personalAssetChange','npcPersonalWealthChange','personalAssetsUsed','savingsUsed','householdDebtRepaid','newHouseholdDebt','sharedSavingsAdded','sharedSavingsChange','householdDebtChange','accountingIdentity'].forEach(key=>{if(!Number.isFinite(Number(h.finances&&h.finances[key]))) violations.push('household '+id+' finances.'+key+' must be finite');});
      if(h.finances&&Number.isFinite(Number(h.finances.lastBalance))&&Number.isFinite(Number(h.finances.accountingIdentity))&&Math.abs(Number(h.finances.lastBalance)-Number(h.finances.accountingIdentity))>.001) violations.push('household '+id+' accounting identity must balance');
      if(!h.finances||!h.finances.expenseBreakdown||typeof h.finances.expenseBreakdown!=='object') violations.push('household '+id+' finances.expenseBreakdown must be an object');
      (h.memberIds||[]).forEach(memberId=>{
        memberships[memberId]=(memberships[memberId]||0)+1;
        if(!npcs[memberId]&&(!subject||subject.npcId!==memberId)) violations.push('household '+id+' references unknown member '+memberId);
      });
      (h.dependentIds||[]).forEach(memberId=>{if(!(h.memberIds||[]).includes(memberId)) violations.push('household '+id+' dependent '+memberId+' is not a member');});
    });
    Object.keys(memberships).forEach(id=>{if(memberships[id]>1) violations.push('member '+id+' belongs to more than one household');});
    Object.values(npcs).forEach(npc=>{
      if(!npc||npc.isSubject||npc.alive===false) return;
      if(!memberships[npc.id]) violations.push('living NPC '+npc.id+' has no household');
      if(npc.householdId&&!households[npc.householdId]) violations.push('NPC '+npc.id+' references missing household '+npc.householdId);
    });
    return violations;
  }

  root.HouseholdSystem={
    SCHEMA_VERSION,
    MAX_HOUSEHOLDS,
    ensure,
    normalize,
    create,
    all,
    findByMember,
    addMember,
    removeMember,
    merge,
    move,
    reconcile,
    tick,
    estimateOutlay,
    classify,
    householdAttractiveness,
    checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
