'use strict';
(function(root){
  const SCHEMA_VERSION=1;
  const HISTORY_LIMIT=48;
  const SETTLED_KEYS_LIMIT=96;
  const CARE_HOURS_CAP=6;
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

  // Extended in a later Phase 4B slice: real case preparation logic.
  function prepareCases(){
    return [];
  }

  // Extended in a later Phase 4B slice: real pending-case retrieval.
  function pendingCases(){
    return [];
  }

  // Extended in a later Phase 4B slice: real decision resolution (treatment/care selection).
  function resolveDecision(){
    return {applied:false,reason:'not-implemented'};
  }

  function tickHousehold(world,household,context){
    const state=ensure(household);
    const opts=context||{};
    const year=optionalInteger(opts.year==null?(world&&typeof world==='object'?world.year:null):opts.year);
    const resolvedYear=year==null?0:year;
    if(state.lastTickYear===resolvedYear){
      return {applied:false,reason:'already-applied',year:resolvedYear};
    }
    // Extended in a later Phase 4B slice: real case/transmission/caregiving progression.
    state.lastTickYear=resolvedYear;
    state.annual.year=resolvedYear;
    return {applied:true,reason:'applied',year:resolvedYear};
  }

  // Extended in a later Phase 4B slice: real transmission logic between household members.
  function transmit(){
    return [];
  }

  // Read-only view of household.medical, used by summary()/checkInvariants() so
  // neither function mutates the household even when its medical state is
  // missing or malformed. Falls back to normalized-shape defaults for reading
  // only; does not write anything back onto the household.
  function readState(household){
    const raw=household&&household.medical;
    if(raw&&typeof raw==='object')return raw;
    return {
      schemaVersion:SCHEMA_VERSION,lastPreparedYear:null,lastTickYear:null,lastTransmissionYear:null,
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
    ['lastPreparedYear','lastTickYear','lastTransmissionYear'].forEach(key=>{
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

    return violations;
  }

  root.HouseholdHealthSystem={
    SCHEMA_VERSION,
    ensure,
    migrate,
    prepareCases,
    pendingCases,
    resolveDecision,
    tickHousehold,
    transmit,
    summary,
    checkInvariants
  };
})(globalThis);
