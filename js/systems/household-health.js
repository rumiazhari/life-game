'use strict';
(function(root){
  const SCHEMA_VERSION=1;
  const HISTORY_LIMIT=48;
  const SETTLED_KEYS_LIMIT=96;
  const CARE_HOURS_CAP=6;
  const AUTOMATIC_CARE_CAP=3;
  const SUBJECT_CARE_CAP=3;
  const TRANSMISSION_BASE_RISK={respiratory:0.16,infection:0.12};
  const TRANSMISSION_STATE_MULTIPLIERS={latent:0.35,symptomatic:1.00,diagnosed:0.90,treated:0.40};
  // Autonomous NPC treatment tiers, by condition severity:
  //   <3: no paid treatment.
  //   3:  'basic' if affordable from savings, otherwise 'rest'.
  //   4:  'basic', or 'specialist' if hospital access and savings allow it.
  //   5:  'specialist' when available, otherwise 'basic'; the only tier
  //       allowed to intentionally take on new household debt for care.
  // "Affordable"/"resources" at severities 3-4 means covered by existing
  // savings alone -- only severity 5 may push the household into new debt,
  // and even then only up to AUTONOMOUS_DEBT_CAP.
  const AUTONOMOUS_DEBT_CAP=2500;
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  function optionalInteger(value){
    if(
      value==null||
      (typeof value==='string'&&value.trim()==='')
    ){
      return null;
    }
    const numeric=Number(value);
    return Number.isFinite(numeric)
      ?Math.round(numeric)
      :null;
  }
  const nonNegNumber=(value,fallback=0)=>{const numeric=number(value,fallback);return Number.isFinite(numeric)&&numeric>=0?numeric:fallback;};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,number(value,min)));

  function normalizeAnnual(annual){
    const source=annual&&typeof annual==='object'?annual:{};
    return {
      year:optionalInteger(source.year),
      activeCases:Math.max(0,Math.floor(number(source.activeCases,0))),
      newConditions:Math.max(0,Math.floor(number(source.newConditions,0))),
      transmissions:Math.max(0,Math.floor(number(source.transmissions,0))),
      caregivingHoursRequired:nonNegNumber(source.caregivingHoursRequired,0),
      caregivingHoursProvided:nonNegNumber(source.caregivingHoursProvided,0),
      treatmentCosts:nonNegNumber(source.treatmentCosts,0),
      medicalDebtAdded:nonNegNumber(source.medicalDebtAdded,0)
    };
  }

  function normalizeCase(raw,householdId){
    const source=raw&&typeof raw==='object'?raw:{};
    return {
      caseId:String(source.caseId||''),
      year:optionalInteger(source.year),
      householdId:String(source.householdId||householdId||''),
      npcId:String(source.npcId||''),
      conditionInstanceId:String(source.conditionInstanceId||''),
      conditionId:String(source.conditionId||''),
      status:String(source.status||'pending'),
      careHoursRequired:nonNegNumber(source.careHoursRequired,0),
      recommendedTreatmentId:source.recommendedTreatmentId==null?null:String(source.recommendedTreatmentId),
      selectedTreatmentId:source.selectedTreatmentId==null?null:String(source.selectedTreatmentId),
      selectedCareHours:nonNegNumber(source.selectedCareHours,0),
      decision:source.decision==null?null:source.decision,
      chargeKey:source.chargeKey==null?null:String(source.chargeKey),
      resolved:Boolean(source.resolved)
    };
  }

  // Deduplicate active cases sharing the same npcId+conditionInstanceId pair.
  // Tie-break: keep the case with the lowest caseId (string compare); this is
  // deterministic regardless of array order, matching the reconciliation
  // convention used by MedicalSystem for chronic condition duplicates.
  function dedupeCases(cases){
    const activeStatuses=new Set(['pending','active','diagnosed']);
    const byKey=new Map();
    const kept=[];
    cases.forEach(caseRecord=>{
      const isActive=!caseRecord.resolved&&activeStatuses.has(caseRecord.status);
      if(!isActive||!caseRecord.npcId||!caseRecord.conditionInstanceId){
        kept.push(caseRecord);
        return;
      }
      const key=caseRecord.npcId+'::'+caseRecord.conditionInstanceId;
      const existing=byKey.get(key);
      if(!existing){
        byKey.set(key,caseRecord);
        kept.push(caseRecord);
        return;
      }
      if(String(caseRecord.caseId).localeCompare(String(existing.caseId))<0){
        const index=kept.indexOf(existing);
        if(index!==-1)kept.splice(index,1);
        byKey.set(key,caseRecord);
        kept.push(caseRecord);
      }
      // else: drop caseRecord (existing wins), do not push
    });
    return kept;
  }

  function ensure(household){
    if(!household||typeof household!=='object')throw new Error('HouseholdHealthSystem requires a household');
    let state=household.medical;
    if(!state||typeof state!=='object'){
      state={};
    }
    const householdId=household.id!=null?String(household.id):'';
    const rawCases=Array.isArray(state.cases)?state.cases:[];
    const normalizedCases=rawCases.map(entry=>normalizeCase(entry,householdId));
    const rawPending=Array.isArray(state.pendingCharges)?state.pendingCharges:[];
    const seenChargeKeys=new Set();
    const pendingCharges=rawPending.filter(charge=>{
      if(!charge||typeof charge!=='object')return false;
      const key=charge.chargeKey==null?null:String(charge.chargeKey);
      if(key==null)return true;
      if(seenChargeKeys.has(key))return false;
      seenChargeKeys.add(key);
      return true;
    });
    const rawSettled=Array.isArray(state.settledChargeKeys)?state.settledChargeKeys:[];
    const settledChargeKeys=rawSettled.map(String).slice(-SETTLED_KEYS_LIMIT);
    const rawHistory=Array.isArray(state.history)?state.history:[];
    const history=rawHistory.slice(-HISTORY_LIMIT);

    const normalized={
      schemaVersion:SCHEMA_VERSION,
      lastPreparedYear:optionalInteger(state.lastPreparedYear),
      lastTickYear:optionalInteger(state.lastTickYear),
      lastTransmissionYear:optionalInteger(state.lastTransmissionYear),
      lastCaregivingYear:optionalInteger(state.lastCaregivingYear),
      caseCounter:Math.max(0,Math.floor(number(state.caseCounter,0))),
      cases:normalizedCases,
      pendingCharges,
      settledChargeKeys,
      history,
      annual:normalizeAnnual(state.annual)
    };
    household.medical=normalized;
    return normalized;
  }

  function migrate(household){
    const state=ensure(household);
    state.cases=dedupeCases(state.cases);
    return state;
  }

  // household-health.js's callers (NpcSystem.applyHouseholdHealthTick) pass a
  // plain {year,subject,lineage,...} context with no settlement/pressure
  // fields, unlike js/medical.js's medicalContext() for the player. Without
  // resolving the household's real settlement here, accessFor() always falls
  // back to its no-clinic default (quality .12), so hospital-access checks
  // could never see an actual local clinic. settlementById is the global
  // settlement-definition lookup from state.js (has .buildings/.kind);
  // world.settlements[id] is the WorldSimulation runtime (economy/publicHealth)
  // used for healthcare pressure, matching household-system.js's own lookup.
  function medicalContextForMember(world,household,context){
    const base=context&&typeof context==='object'?context:{};
    if(base.settlement&&base.healthcarePressure!=null)return base;
    const settlement=base.settlement||(typeof root.settlementById==='function'?root.settlementById(household.settlementId):null);
    const runtime=base.runtime||(world&&world.settlements&&world.settlements[household.settlementId])||null;
    const pressure=base.healthcarePressure!=null?base.healthcarePressure:(runtime&&root.PublicHealth&&typeof root.PublicHealth.pressure==='function'?root.PublicHealth.pressure(runtime):0);
    return Object.assign({},base,{settlement,runtime,healthcarePressure:pressure});
  }

  function prepareNewCases(world,household,context){
    const ctx=medicalContextForMember(world,household,context);
    const state=ensure(household), year=resolvedYearOf(world,ctx), members=livingHouseholdMembers(world,household,ctx);
    if(state.lastPreparedYear===year) return state.cases;
    const newCases=[];
    const subjectId=ctx.subject&&ctx.subject.npcId!=null?String(ctx.subject.npcId):null;
    members.forEach(member=>{
      // The subject's own condition is deliberately excluded here -- it's
      // already handled by the player's personal medical system (js/medical.js
      // / the MEDICAL REVIEW sheet), and creating a household case for it too
      // would let the same condition receive double treatment.
      if(subjectId&&member.id===subjectId)return;
      root.MedicalSystem.activeConditions(member.person).forEach(condition=>{
        if(!condition.known||condition.resolved)return;
        const existing=state.cases.find(c=>c.npcId===member.id&&c.conditionInstanceId===condition.instanceId&&!c.resolved);
        if(existing)return;
        const definition=root.ConditionRegistry.condition(condition.definitionId);
        const treatments=root.MedicalSystem.treatmentOptions(world,member.person,condition.instanceId,ctx);
        const recommended=treatments.find(t=>t.id==='basic')||treatments[0];
        const caseId='case:'+String(state.caseCounter+1).padStart(5,'0');
        state.caseCounter+=1;
        const caseRecord=normalizeCase({
          caseId,year,householdId:household.id,npcId:member.id,conditionInstanceId:condition.instanceId,
          conditionId:condition.definitionId,status:'pending',
          careHoursRequired:conditionCareNeed(condition,root.MedicalSystem.ageOf(member.person,world)),
          recommendedTreatmentId:recommended?recommended.id:null
        },household.id);
        state.cases.push(caseRecord);
        newCases.push(caseRecord);
      });
    });
    state.lastPreparedYear=year;
    return newCases;
  }

  // Closes any household case whose underlying situation is no longer valid:
  // the referenced condition instance has resolved or vanished, the patient
  // died, or the patient no longer lives in this household. Closed cases keep
  // their history (status:'closed', resolved:true) but disappear from
  // getActiveDecisions()/pendingCases() (only 'pending'/'active'/'diagnosed'
  // count as active there) and are exempt from checkInvariants()'s
  // conditionInstanceId requirement (see checkInvariants below). Naturally
  // idempotent: an already-closed/resolved case is skipped, so calling this
  // more than once per year (or once per phase-split call site) is harmless.
  function reconcileCases(world,household,context){
    const state=ensure(household);
    const ctx=context||{};
    const memberIds=Array.isArray(household.memberIds)?household.memberIds.map(String):[];
    let closed=0;
    state.cases.forEach(caseRecord=>{
      if(caseRecord.resolved||caseRecord.status==='closed')return;
      const person=resolvePerson(world,ctx,caseRecord.npcId);
      if(!person){caseRecord.status='closed';caseRecord.resolved=true;closed+=1;return;}
      if(!memberIds.includes(String(caseRecord.npcId))){caseRecord.status='closed';caseRecord.resolved=true;closed+=1;return;}
      const condition=root.MedicalSystem.conditionByRef(person,caseRecord.conditionInstanceId);
      if(!condition){caseRecord.status='closed';caseRecord.resolved=true;closed+=1;}
    });
    return {closed};
  }

  function getActiveDecisions(state,year){
    return (Array.isArray(state.cases)?state.cases:[])
      .filter(c=>!c.resolved&&['pending','active','diagnosed'].includes(c.status)&&resolvedYearOf(null,{year:c.year})<=year);
  }

  function applyFundedCareDecision(world,household,state,caseRecord,context){
    const ctx=medicalContextForMember(world,household,context);
    const year=resolvedYearOf(world,ctx), members=livingHouseholdMembers(world,household,ctx);
    const member=members.find(m=>m.id===caseRecord.npcId);
    if(!member)return {applied:false,reason:'member-not-found'};
    const condition=root.MedicalSystem.conditionByRef(member.person,caseRecord.conditionInstanceId);
    if(!condition)return {applied:false,reason:'condition-not-found'};
    const treatments=root.MedicalSystem.treatmentOptions(world,member.person,condition.instanceId,ctx);
    const treatment=treatments.find(t=>t.id===caseRecord.selectedTreatmentId)||treatments.find(t=>t.id==='basic')||treatments[0];
    if(!treatment)return {applied:false,reason:'no-treatment-available'};
    const cost=root.MedicalSystem.treatmentCost(condition,treatment,root.MedicalSystem.accessFor(world,member.person,ctx));
    const isolatedRng=root.Random.create([world.seed,year,household.id,caseRecord.npcId,caseRecord.conditionInstanceId,'household-treatment'].join('|'));
    const result=root.MedicalSystem.treat(world,member.person,condition.instanceId,treatment.id,ctx,{rng:isolatedRng,incrementActionCounter:false});
    if(result.blocked)return {applied:false,reason:'treatment-blocked'};
    const chargeKey='medical:'+year+':'+household.id+':'+caseRecord.npcId+':'+caseRecord.conditionInstanceId+':'+treatment.id;
    if(state.pendingCharges.find(pc=>pc.chargeKey===chargeKey))return {applied:false,reason:'duplicate-charge'};
    caseRecord.chargeKey=chargeKey;
    caseRecord.selectedTreatmentId=treatment.id;
    caseRecord.status='treated';
    caseRecord.decision='fund-recommended-care';
    const charge={chargeKey,caseId:caseRecord.caseId,year,amount:cost,npcId:caseRecord.npcId,conditionInstanceId:caseRecord.conditionInstanceId,treatmentId:treatment.id};
    state.pendingCharges.push(charge);
    pushHistory(state,{year,kind:'treatment',amount:cost,note:'Treatment cost of '+cost+' (uncovered portion becomes household debt).'});
    return {applied:true,reason:'funded-care',cost};
  }

  function applyHomeCareDecision(world,household,state,caseRecord,context){
    const ctx=medicalContextForMember(world,household,context);
    const year=resolvedYearOf(world,ctx), members=livingHouseholdMembers(world,household,ctx);
    const member=members.find(m=>m.id===caseRecord.npcId);
    if(!member)return {applied:false,reason:'member-not-found'};
    const condition=root.MedicalSystem.conditionByRef(member.person,caseRecord.conditionInstanceId);
    if(!condition)return {applied:false,reason:'condition-not-found'};
    const treatments=root.MedicalSystem.treatmentOptions(world,member.person,condition.instanceId,ctx);
    const restTreatment=treatments.find(t=>t.id==='rest');
    if(!restTreatment)return {applied:false,reason:'rest-not-available'};
    const isolatedRng=root.Random.create([world.seed,year,household.id,caseRecord.npcId,caseRecord.conditionInstanceId,'household-home-care'].join('|'));
    const result=root.MedicalSystem.treat(world,member.person,condition.instanceId,'rest',ctx,{rng:isolatedRng,incrementActionCounter:false});
    if(result.blocked)return {applied:false,reason:'treatment-blocked'};
    caseRecord.selectedTreatmentId='rest';
    caseRecord.status='home-care';
    caseRecord.decision='home-care';
    caseRecord.selectedCareHours=Math.min(3,caseRecord.careHoursRequired);
    pushHistory(state,{year,kind:'home-care',hours:caseRecord.selectedCareHours,note:'Home rest treatment with '+caseRecord.selectedCareHours+' caregiving hours allocated.'});
    return {applied:true,reason:'home-care'};
  }

  function applyUntreatedDecision(world,household,state,caseRecord,context){
    caseRecord.status='untreated';
    caseRecord.decision='leave-untreated';
    return {applied:true,reason:'untreated'};
  }

  function prepareCases(world,household,context){
    return prepareNewCases(world,household,context);
  }

  function pendingCases(world,household,context){
    const state=ensure(household), year=resolvedYearOf(world,context);
    return getActiveDecisions(state,year);
  }

  // Public read for UI callers: the treatment options (with cost) actually
  // available for one case, resolved through the household's real settlement
  // (see medicalContextForMember above) rather than whatever the caller
  // happens to be looking at -- a family medical decision window must not
  // silently price a member's care using the player's own location.
  function treatmentOptionsFor(world,household,caseRecord,context){
    if(!household||!caseRecord)return [];
    const ctx=medicalContextForMember(world,household,context);
    const members=livingHouseholdMembers(world,household,ctx);
    const member=members.find(m=>m.id===caseRecord.npcId);
    if(!member)return [];
    return root.MedicalSystem.treatmentOptions(world,member.person,caseRecord.conditionInstanceId,ctx);
  }

  // Household savings alone (never debt) back a severity 3-4 decision;
  // "resources" for those tiers means the treatment's cost fits inside what
  // the household already has saved.
  function affordableFromSavings(household,cost){
    const savings=Math.max(0,number(household.finances&&household.finances.savings,0));
    return cost<=savings;
  }

  // Autonomous NPC treatment: households the subject is not a member of have
  // no player to review pendingCases()/resolveDecision(), so each case must
  // decide for itself. An already-chronic condition is left to the existing
  // caregiving pass (applyCaregiving) rather than MedicalSystem.treat() --
  // "chronic" here specifically means an illness that already passed through
  // (or was created past) the acute-treatment window into a permanent
  // condition; a single home/family care decision realistically manages it
  // rather than curing it, and this keeps it within reach of MedicalSystem's
  // own untreated-condition mortality pathway. For acute conditions, the
  // tiers are (see AUTONOMOUS_DEBT_CAP comment above for the full rule):
  // severity <3 no paid treatment; 3 basic-if-affordable else rest; 4 basic,
  // upgraded to specialist if hospital access and savings allow it; 5
  // specialist when available else basic, the only tier allowed to borrow.
  // Returns {decision, treatmentId} so the caller can hand the chosen tier
  // (not just 'basic') to resolveDecision.
  function autonomousDecisionFor(world,household,caseRecord,context){
    const ctx=medicalContextForMember(world,household,context);
    const members=livingHouseholdMembers(world,household,ctx);
    const member=members.find(m=>m.id===caseRecord.npcId);
    if(!member)return {decision:'leave-untreated',treatmentId:null};
    const condition=root.MedicalSystem.conditionByRef(member.person,caseRecord.conditionInstanceId);
    if(!condition)return {decision:'leave-untreated',treatmentId:null};
    if(condition.definitionId==='chronic')return {decision:'leave-untreated',treatmentId:null};
    const severity=number(condition.severity,0);
    if(severity<3)return {decision:'leave-untreated',treatmentId:null};
    const treatments=root.MedicalSystem.treatmentOptions(world,member.person,condition.instanceId,ctx);
    const restAvailable=treatments.some(t=>t.id==='rest');
    const basic=treatments.find(t=>t.id==='basic');
    const specialist=treatments.find(t=>t.id==='specialist');
    const access=root.MedicalSystem.accessFor(world,member.person,ctx);
    const costOf=treatment=>root.MedicalSystem.treatmentCost(condition,treatment,access);
    const fallback=()=>restAvailable?{decision:'home-care',treatmentId:'rest'}:{decision:'leave-untreated',treatmentId:null};

    if(severity===3){
      if(basic&&affordableFromSavings(household,costOf(basic)))return {decision:'fund-recommended-care',treatmentId:'basic'};
      return fallback();
    }
    if(severity===4){
      if(specialist&&affordableFromSavings(household,costOf(specialist)))return {decision:'fund-recommended-care',treatmentId:'specialist'};
      if(basic&&affordableFromSavings(household,costOf(basic)))return {decision:'fund-recommended-care',treatmentId:'basic'};
      return fallback();
    }
    // severity>=5: specialist when available, otherwise basic; the only
    // tier permitted to intentionally create new household debt, and even
    // then only up to AUTONOMOUS_DEBT_CAP.
    const chosen=specialist||basic;
    if(chosen){
      const cost=costOf(chosen);
      const currentDebt=Math.max(0,number(household.finances&&household.finances.debt,0));
      const savings=Math.max(0,number(household.finances&&household.finances.savings,0));
      const shortfall=Math.max(0,cost-savings);
      const projectedDebt=currentDebt+shortfall;
      if(projectedDebt<=AUTONOMOUS_DEBT_CAP)return {decision:'fund-recommended-care',treatmentId:chosen.id};
    }
    return fallback();
  }

  // Applies autonomousDecisionFor() to every still-pending case in households
  // the subject is not a member of. Player households keep their cases
  // pending for pendingCases()/resolveDecision() (a family medical-decision
  // UI, not part of this slice) rather than deciding on the player's behalf.
  //
  // ensure() always rebuilds and reassigns household.medical with fresh case
  // objects (see ensure() above), so a state snapshot taken before another
  // ensure()-calling function ran (e.g. prepareNewCases()) would miss cases
  // that function just added. This calls ensure() itself, right before
  // reading pending cases, rather than accepting a state object from the
  // caller, so it always sees the current household.medical.
  function applyAutonomousDecisions(world,household,resolvedYear,opts){
    const subject=opts&&opts.subject;
    const memberIds=Array.isArray(household.memberIds)?household.memberIds:[];
    const containsSubject=!!(subject&&subject.npcId!=null&&subject.alive!==false&&memberIds.includes(String(subject.npcId)));
    if(containsSubject)return [];
    const state=ensure(household);
    const pending=getActiveDecisions(state,resolvedYear).filter(c=>c.status==='pending');
    return pending.map(caseRecord=>{
      const outcome=autonomousDecisionFor(world,household,caseRecord,Object.assign({},opts,{year:resolvedYear}));
      return resolveDecision(world,household,caseRecord.caseId,{decision:outcome.decision,treatmentId:outcome.treatmentId},Object.assign({},opts,{year:resolvedYear}));
    });
  }

  function resolveDecision(world,household,caseId,decisionData,context){
    const state=ensure(household), year=resolvedYearOf(world,context);
    const caseRecord=state.cases.find(c=>c.caseId===caseId&&!c.resolved);
    if(!caseRecord)return {applied:false,reason:'case-not-found'};
    if(['treated','home-care','untreated'].includes(caseRecord.status))return {applied:false,reason:'already-decided'};
    const decision=decisionData&&decisionData.decision||'leave-untreated';
    caseRecord.selectedTreatmentId=decisionData&&decisionData.treatmentId||caseRecord.recommendedTreatmentId;
    if(decision==='fund-recommended-care'){
      return applyFundedCareDecision(world,household,state,caseRecord,Object.assign({},context,{year}));
    }else if(decision==='home-care'){
      return applyHomeCareDecision(world,household,state,caseRecord,Object.assign({},context,{year}));
    }else{
      return applyUntreatedDecision(world,household,state,caseRecord,Object.assign({},context,{year}));
    }
  }

  function resolvedYearOf(world,opts){
    const year=optionalInteger(opts&&opts.year==null?(world&&typeof world==='object'?world.year:null):opts&&opts.year);
    return year==null?0:year;
  }

  // Resolves a household memberId to its live person object: the real subject
  // state object (S) when the id matches context.subject.npcId, otherwise the
  // live NPC record from world.npcs. Returns null for dead/unknown members so
  // callers can filter them out uniformly.
  function resolvePerson(world,context,memberId){
    const id=String(memberId);
    const subject=context&&context.subject;
    if(subject&&String(subject.npcId||'')===id)return subject.alive!==false?subject:null;
    const npc=world&&world.npcs&&world.npcs[id];
    return npc&&npc.alive!==false&&!npc.isSubject?npc:null;
  }

  function livingHouseholdMembers(world,household,context){
    const memberIds=Array.isArray(household.memberIds)?household.memberIds:[];
    return memberIds.map(id=>({id:String(id),person:resolvePerson(world,context,id)})).filter(entry=>!!entry.person);
  }

  function sanitationFor(world,household){
    const settlement=world&&world.settlements&&world.settlements[household.settlementId];
    const publicHealth=settlement&&settlement.publicHealth;
    const value=publicHealth&&Number(publicHealth.sanitation);
    return Number.isFinite(value)?clamp(value,0,1):0.5;
  }

  function foodSecurityFor(household){
    const value=Number(household.foodSecurity);
    return Number.isFinite(value)?clamp(value,0,1):0.55;
  }

  function roomsFor(household){
    const value=household.housing&&Number(household.housing.rooms);
    return Number.isFinite(value)&&value>0?value:1;
  }

  function transmissionRisk(params){
    const base=TRANSMISSION_BASE_RISK[params.definitionId]||0;
    if(base<=0)return 0;
    const multiplier=TRANSMISSION_STATE_MULTIPLIERS[params.state];
    if(!multiplier)return 0;
    const crowding=Math.max(0,params.livingMembers-params.rooms);
    const risk=base*multiplier
      *(0.70+params.severity*0.12)
      *(1+Math.min(0.50,crowding*0.12))
      *(1+Math.max(0,0.50-params.foodSecurity)*0.60)
      *(1+(1-params.sanitation)*0.35)
      *(1-((params.targetResilience-50)/200))
      *(1-params.targetVaccination*0.45);
    return clamp(risk,0,0.65);
  }

  // Real transmission pass: only contagious active conditions in eligible
  // states can spread, and only between members of the same household. All
  // proposals are collected first (so member array order never affects the
  // outcome), sorted deterministically, then resolved one at a time with an
  // isolated stream per source/target/condition combination.
  function transmit(world,household,context){
    const state=ensure(household);
    const opts=context||{};
    const resolvedYear=resolvedYearOf(world,opts);
    if(state.lastTransmissionYear===resolvedYear){
      return {applied:false,reason:'already-applied',year:resolvedYear,transmissions:[]};
    }
    const members=livingHouseholdMembers(world,household,opts);
    const livingMembers=members.length;
    const rooms=roomsFor(household);
    const foodSecurity=foodSecurityFor(household);
    const sanitation=sanitationFor(world,household);

    const proposals=[];
    members.forEach(source=>{
      root.MedicalSystem.activeConditions(source.person).forEach(condition=>{
        if(!condition.contagious)return;
        if(!TRANSMISSION_BASE_RISK[condition.definitionId])return;
        if(!TRANSMISSION_STATE_MULTIPLIERS[condition.state])return;
        members.forEach(target=>{
          if(target.id===source.id)return;
          const alreadyActive=root.MedicalSystem.activeConditions(target.person).some(existing=>existing.definitionId===condition.definitionId);
          if(alreadyActive)return;
          const targetState=root.MedicalSystem.ensureMedicalState(target.person,{world,year:resolvedYear});
          const targetResilience=Number.isFinite(Number(targetState.resilience))?Number(targetState.resilience):50;
          const targetVaccination=Number.isFinite(Number(targetState.prevention&&targetState.prevention.vaccination))?Number(targetState.prevention.vaccination):0;
          const risk=transmissionRisk({
            definitionId:condition.definitionId,state:condition.state,severity:condition.severity,
            livingMembers,rooms,foodSecurity,sanitation,targetResilience,targetVaccination
          });
          if(risk<=0)return;
          const definition=root.ConditionRegistry.condition(condition.definitionId);
          proposals.push({
            sourceId:source.id,targetId:target.id,sourceInstanceId:condition.instanceId,
            definitionId:condition.definitionId,risk,targetPerson:target.person,
            incubation:definition?definition.incubation:0
          });
        });
      });
    });

    proposals.sort((a,b)=>
      a.sourceId.localeCompare(b.sourceId)
      ||a.targetId.localeCompare(b.targetId)
      ||a.definitionId.localeCompare(b.definitionId)
    );

    const settled=new Set();
    const transmissions=[];
    proposals.forEach(proposal=>{
      const key=proposal.targetId+'::'+proposal.definitionId;
      if(settled.has(key))return;
      const alreadyActive=root.MedicalSystem.activeConditions(proposal.targetPerson).some(existing=>existing.definitionId===proposal.definitionId);
      if(alreadyActive){settled.add(key);return;}
      const seed=[(world&&world.seed)!=null?world.seed:'medical',resolvedYear,household.id,proposal.sourceId,proposal.sourceInstanceId,proposal.targetId,proposal.definitionId,'household-transmission'].join('|');
      const rng=root.Random.create(seed);
      settled.add(key);
      if(rng.next()>=proposal.risk)return;
      const condition=root.MedicalSystem.addCondition(proposal.targetPerson,proposal.definitionId,undefined,{
        world,year:resolvedYear,source:'household transmission',incubation:proposal.incubation
      });
      if(!condition)return;
      // Newly transmitted conditions must not progress until next year's tick;
      // marking this year as already-progressed makes this year's already-
      // completed progression pass (which ran before transmission) a no-op
      // for this instance, regardless of exact call ordering in the sequence.
      condition.lastProgressionYear=resolvedYear;
      transmissions.push({sourceId:proposal.sourceId,targetId:proposal.targetId,definitionId:proposal.definitionId,instanceId:condition.instanceId});
    });

    state.lastTransmissionYear=resolvedYear;
    return {applied:true,reason:'applied',year:resolvedYear,transmissions};
  }

  function conditionCareNeed(condition,age){
    let need=0;
    if(condition.severity>=5)need=3;
    else if(condition.severity>=4)need=2;
    else if(condition.severity>=3&&(age<12||age>=70))need=1;
    if(condition.state==='treated')need=Math.max(0,need-1);
    return need;
  }

  // Real caregiving pass: computes per-patient care need (max across active
  // conditions), automatic capacity from healthy adult household members,
  // subject-provided hours (a plain parameter for this slice -- see report),
  // then allocates hours in the specified priority order and applies
  // adherence/health effects.
  function applyCaregiving(world,household,context){
    const state=ensure(household);
    const opts=context||{};
    const resolvedYear=resolvedYearOf(world,opts);
    if(state.lastCaregivingYear===resolvedYear){
      return {applied:false,reason:'already-applied',year:resolvedYear,required:0,provided:0};
    }
    const members=livingHouseholdMembers(world,household,opts);
    const subjectId=opts.subject&&opts.subject.npcId!=null?String(opts.subject.npcId):null;

    const patients=[];
    members.forEach(member=>{
      const age=root.MedicalSystem.ageOf(member.person,world);
      let best=null,bestNeed=0;
      root.MedicalSystem.activeConditions(member.person).forEach(condition=>{
        const need=conditionCareNeed(condition,age);
        if(need<=0)return;
        const onset=Number.isFinite(Number(condition.onsetYear))?Number(condition.onsetYear):Infinity;
        const bestOnset=best&&Number.isFinite(Number(best.onsetYear))?Number(best.onsetYear):Infinity;
        const better=!best
          ||need>bestNeed
          ||(need===bestNeed&&condition.severity>best.severity)
          ||(need===bestNeed&&condition.severity===best.severity&&onset<bestOnset)
          ||(need===bestNeed&&condition.severity===best.severity&&onset===bestOnset&&String(condition.instanceId).localeCompare(String(best.instanceId))<0);
        if(better){best=condition;bestNeed=need;}
      });
      if(best)patients.push({id:member.id,person:member.person,age,condition:best,need:bestNeed});
    });

    const requiredRaw=patients.reduce((sum,patient)=>sum+patient.need,0);
    const required=Math.min(CARE_HOURS_CAP,requiredRaw);

    const patientIds=new Set(patients.map(patient=>patient.id));
    let automatic=0;
    members.forEach(member=>{
      if(subjectId&&member.id===subjectId)return;
      // A member who is themselves a patient (any care need > 0, not just
      // severity>=4) cannot also count as one of the household's automatic
      // healthy caregivers -- otherwise a mildly-ill child/elder would be
      // treated as caring for themselves.
      if(patientIds.has(member.id))return;
      const age=root.MedicalSystem.ageOf(member.person,world);
      if(age<18)return;
      const severelyIll=root.MedicalSystem.activeConditions(member.person).some(condition=>condition.severity>=4);
      if(severelyIll)return;
      automatic+=1;
    });
    automatic=Math.min(AUTOMATIC_CARE_CAP,automatic);
    const subjectHours=Math.max(0,Math.min(SUBJECT_CARE_CAP,number(opts.subjectCareHours,0)));
    let pool=Math.min(CARE_HOURS_CAP,automatic+subjectHours);

    patients.sort((a,b)=>{
      if(b.condition.severity!==a.condition.severity)return b.condition.severity-a.condition.severity;
      const aChild=a.age<12,bChild=b.age<12;
      if(aChild!==bChild)return aChild?-1:1;
      const aElder=a.age>=70,bElder=b.age>=70;
      if(aElder!==bElder)return aElder?-1:1;
      const aOnset=Number.isFinite(Number(a.condition.onsetYear))?Number(a.condition.onsetYear):Infinity;
      const bOnset=Number.isFinite(Number(b.condition.onsetYear))?Number(b.condition.onsetYear):Infinity;
      if(aOnset!==bOnset)return aOnset-bOnset;
      return String(a.id).localeCompare(String(b.id));
    });

    let providedTotal=0;
    patients.forEach(patient=>{
      if(pool<=0)return;
      const give=Math.min(patient.need,pool);
      if(give<=0)return;
      pool-=give;
      providedTotal+=give;
      const condition=patient.condition;
      condition.adherence=clamp(number(condition.adherence,0)+0.15*give,0,1);
      if(condition.state!=='treated'){
        const gain=Math.min(2,give);
        root.MedicalSystem.applyHealthDelta(patient.person,gain,'household caregiving',world);
      }
    });

    const provided=Math.min(CARE_HOURS_CAP,providedTotal);
    state.lastCaregivingYear=resolvedYear;
    state.annual.caregivingHoursRequired=required;
    state.annual.caregivingHoursProvided=provided;
    return {applied:true,reason:'applied',year:resolvedYear,required,provided};
  }

  function pushHistory(state,entry){
    state.history.push(entry);
    if(state.history.length>HISTORY_LIMIT)state.history=state.history.slice(-HISTORY_LIMIT);
  }

  // Moves every charge behind a 'treated' case from pendingCharges into
  // settledChargeKeys and adds their total into annual.treatmentCosts, so
  // that whatever calls HouseholdSystem.tick() next (the household's finance
  // settlement) sees this year's charges rather than last year's. Naturally
  // idempotent: a charge already in settledChargeKeys is skipped, and
  // annual.treatmentCosts is accumulated (not overwritten) so a repeated
  // same-year call -- from another phase-split call site, or simply called
  // twice -- adds zero newly-settled charges the second time rather than
  // resetting the year's total back to zero. annual.year gates the actual
  // year boundary: a call for a new year zeroes the running total first
  // (it belongs to last year's household-health tick, already read by that
  // year's HouseholdSystem.tick), then accumulates only this year's charges.
  function settleTreatmentCharges(world,household,context){
    const state=ensure(household), year=resolvedYearOf(world,context);
    if(state.annual.year!==year){
      state.annual.treatmentCosts=0;
      state.annual.year=year;
    }
    let totalTreatmentCosts=0;
    state.cases.forEach(caseRecord=>{
      if(caseRecord.status==='treated'&&caseRecord.chargeKey){
        const charge=state.pendingCharges.find(c=>c.chargeKey===caseRecord.chargeKey);
        if(charge&&!state.settledChargeKeys.includes(charge.chargeKey)){
          totalTreatmentCosts+=charge.amount;
          state.settledChargeKeys.push(charge.chargeKey);
          const pendingIndex=state.pendingCharges.indexOf(charge);
          if(pendingIndex!==-1) state.pendingCharges.splice(pendingIndex,1);
        }
      }
    });
    state.annual.treatmentCosts=nonNegNumber(state.annual.treatmentCosts,0)+totalTreatmentCosts;
    return {treatmentCosts:state.annual.treatmentCosts};
  }

  // Late phase of the household-year cycle: caregiving + transmission only.
  // Case preparation, autonomous/family treatment decisions, and charge
  // settlement (prepareCases/applyAutonomousDecisions/settleTreatmentCharges)
  // now run earlier in the annual pipeline -- before the household's own
  // NPC medical progression and before HouseholdSystem.tick()'s finance pass
  // -- so treatment charges land in the same year they were incurred and a
  // condition treated this year doesn't also take a full year of untreated
  // burden in that same year. This phase deliberately runs after BOTH the
  // household's NPC medical progression and the player's own annual medical
  // tick, so transmission risk reflects everyone's post-progression state.
  // See NpcSystem.applyHouseholdHealthTick for the production call site.
  function tickHouseholdCaregivingAndTransmission(world,household,context){
    const state=ensure(household);
    const opts=context||{};
    const resolvedYear=resolvedYearOf(world,opts);
    if(state.lastTickYear===resolvedYear){
      return {applied:false,reason:'already-applied',year:resolvedYear};
    }
    const careResult=applyCaregiving(world,household,Object.assign({},opts,{year:resolvedYear}));
    const transmitResult=transmit(world,household,Object.assign({},opts,{year:resolvedYear}));
    const transmissions=transmitResult.transmissions||[];

    const finalState=ensure(household);
    finalState.annual.transmissions=transmissions.length;
    finalState.annual.newConditions=transmissions.length;

    if(careResult.applied&&(careResult.required>0||careResult.provided>0)){
      pushHistory(finalState,{year:resolvedYear,kind:'caregiving',required:careResult.required,provided:careResult.provided,
        note:'Caregiving allocated '+careResult.provided+' of '+careResult.required+' required hours.'});
    }
    transmissions.forEach(entry=>{
      pushHistory(finalState,{year:resolvedYear,kind:'transmission',sourceId:entry.sourceId,targetId:entry.targetId,conditionId:entry.definitionId,
        note:'Illness ('+entry.definitionId+') spread from '+entry.sourceId+' to '+entry.targetId+'.'});
    });

    finalState.lastTickYear=resolvedYear;
    finalState.annual.year=resolvedYear;
    return {applied:true,reason:'applied',year:resolvedYear,caregiving:careResult,transmissions};
  }

  // Convenience wrapper running every phase (prepare -> resolve treatment ->
  // settle charges -> caregiving -> transmission) in the correct relative
  // order within a single call. Production code (ui.js's advanceYear via
  // NpcSystem) calls the phases separately so household treatment can be
  // interleaved with NPC and player medical progression and with
  // HouseholdSystem's finance settlement; this wrapper is for callers (tests,
  // diagnostics) that don't need that interleaving and just want one
  // household-year of health processing applied at once.
  function tickHousehold(world,household,context){
    const opts=context||{};
    const resolvedYear=resolvedYearOf(world,opts);
    reconcileCases(world,household,Object.assign({},opts,{year:resolvedYear}));
    prepareNewCases(world,household,Object.assign({},opts,{year:resolvedYear}));
    applyAutonomousDecisions(world,household,resolvedYear,opts);
    const chargeResult=settleTreatmentCharges(world,household,Object.assign({},opts,{year:resolvedYear}));
    const lateResult=tickHouseholdCaregivingAndTransmission(world,household,opts);
    if(!lateResult.applied)return lateResult;
    return Object.assign({},lateResult,{charges:chargeResult});
  }

  // Read-only view of household.medical, used by summary()/checkInvariants() so
  // neither function mutates the household even when its medical state is
  // missing or malformed. Falls back to normalized-shape defaults for reading
  // only; does not write anything back onto the household.
  function readState(household){
    const raw=household&&household.medical;
    if(raw&&typeof raw==='object')return raw;
    return {
      schemaVersion:SCHEMA_VERSION,lastPreparedYear:null,lastTickYear:null,lastTransmissionYear:null,lastCaregivingYear:null,
      caseCounter:0,cases:[],pendingCharges:[],settledChargeKeys:[],history:[],annual:normalizeAnnual(null)
    };
  }

  function summary(household){
    const state=readState(household);
    const annual=state.annual&&typeof state.annual==='object'?state.annual:normalizeAnnual(null);
    return {
      year:annual.year==null?null:annual.year,
      activeCases:nonNegNumber(annual.activeCases,0),
      newConditions:nonNegNumber(annual.newConditions,0),
      transmissions:nonNegNumber(annual.transmissions,0),
      caregivingHoursRequired:nonNegNumber(annual.caregivingHoursRequired,0),
      caregivingHoursProvided:nonNegNumber(annual.caregivingHoursProvided,0),
      treatmentCosts:nonNegNumber(annual.treatmentCosts,0),
      medicalDebtAdded:nonNegNumber(annual.medicalDebtAdded,0)
    };
  }

  function checkInvariants(household){
    const state=readState(household);
    const violations=[];
    if(state.schemaVersion!==SCHEMA_VERSION)violations.push('household medical schema must be version '+SCHEMA_VERSION);
    ['lastPreparedYear','lastTickYear','lastTransmissionYear','lastCaregivingYear'].forEach(key=>{
      const value=state[key];
      if(value!==null&&!Number.isInteger(value))violations.push('household medical.'+key+' must be null or a finite integer');
    });

    const activeStatuses=new Set(['pending','active','diagnosed']);
    const activeKeys=new Set();
    const householdId=household&&household.id!=null?String(household.id):'';
    const cases=Array.isArray(state.cases)?state.cases:[];
    cases.forEach((caseRecord,index)=>{
      if(!caseRecord||typeof caseRecord!=='object')return;
      const tag=caseRecord.caseId||'index '+index;
      const isActive=!caseRecord.resolved&&activeStatuses.has(caseRecord.status);
      if(isActive){
        const key=caseRecord.npcId+'::'+caseRecord.conditionInstanceId;
        if(activeKeys.has(key))violations.push('duplicate active case for npc/condition pair: '+tag);
        activeKeys.add(key);
      }
      if(householdId&&caseRecord.householdId&&caseRecord.householdId!==householdId)violations.push('case references a different household: '+tag);
      if(caseRecord.status!=='unknown-condition'&&caseRecord.status!=='closed'&&!caseRecord.conditionInstanceId)violations.push('case is missing its condition instance reference: '+tag);
    });

    const settledChargeKeys=Array.isArray(state.settledChargeKeys)?state.settledChargeKeys.map(String):[];
    const pendingCharges=Array.isArray(state.pendingCharges)?state.pendingCharges:[];
    const chargeKeys=new Set();
    pendingCharges.forEach((charge,index)=>{
      const tag=charge&&charge.chargeKey||'index '+index;
      const key=charge&&charge.chargeKey==null?null:String(charge&&charge.chargeKey);
      if(key!=null){
        if(chargeKeys.has(key))violations.push('duplicate pending charge key: '+tag);
        chargeKeys.add(key);
      }
      if(charge&&charge.settled!==true&&key!=null&&settledChargeKeys.includes(key)){
        violations.push('pending charge conflicts with settled charge key: '+tag);
      }
    });

    const annual=state.annual&&typeof state.annual==='object'?state.annual:{};
    ['caregivingHoursRequired','caregivingHoursProvided','treatmentCosts','medicalDebtAdded'].forEach(key=>{
      const value=annual[key];
      if(!Number.isFinite(value)||value<0)violations.push('household medical.annual.'+key+' must be finite and nonnegative');
    });
    if(!Number.isFinite(annual.caregivingHoursRequired)||annual.caregivingHoursRequired>CARE_HOURS_CAP)violations.push('household medical.annual.caregivingHoursRequired must not exceed '+CARE_HOURS_CAP);
    if(!Number.isFinite(annual.caregivingHoursProvided)||annual.caregivingHoursProvided>CARE_HOURS_CAP)violations.push('household medical.annual.caregivingHoursProvided must not exceed '+CARE_HOURS_CAP);

    if(state.lastTransmissionYear!=null&&state.lastTickYear!=null&&state.lastTransmissionYear>state.lastTickYear){
      violations.push('household medical.lastTransmissionYear cannot exceed lastTickYear');
    }
    if(state.lastCaregivingYear!=null&&state.lastTickYear!=null&&state.lastCaregivingYear>state.lastTickYear){
      violations.push('household medical.lastCaregivingYear cannot exceed lastTickYear');
    }

    return violations;
  }

  root.HouseholdHealthSystem={
    SCHEMA_VERSION,
    ensure,
    migrate,
    prepareCases,
    reconcileCases,
    pendingCases,
    treatmentOptionsFor,
    resolveDecision,
    autonomousDecisionFor,
    applyAutonomousDecisions,
    settleTreatmentCharges,
    tickHouseholdCaregivingAndTransmission,
    tickHousehold,
    transmit,
    applyCaregiving,
    transmissionRisk,
    conditionCareNeed,
    summary,
    checkInvariants
  };
})(globalThis);
