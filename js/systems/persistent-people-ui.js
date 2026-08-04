'use strict';

(function(root){
  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function money(value){
    const amount=Math.round(Number(value)||0), sign=amount<0?'-':'';
    return sign+'$'+Math.abs(amount).toLocaleString('en-US');
  }
  function ageOf(npc,world){ return Math.max(0,(Number(world&&world.year)||0)-(Number(npc&&npc.birthYear)||0)); }
  function healthLabel(value){ const n=Number(value)||0; return n>=80?'strong':n>=60?'steady':n>=40?'frail':'critical'; }
  function relationLabel(tags){
    const ordered=['mother','father','parent','spouse','partner','child','sibling','relative','friend','associate','contact-spouse'];
    return ordered.find(tag=>(tags||[]).includes(tag))||'connected person';
  }
  function occupation(npc){
    if(!npc.alive) return 'deceased';
    const employment=npc.employment||{};
    if(employment.status==='employed') return (employment.sector||'general')+' work · '+money(employment.income)+'/yr';
    if(employment.status==='retired') return 'retired';
    if(employment.status==='dependent') return 'dependent';
    return employment.status||'unemployed';
  }
  function locationName(npc){
    if(typeof root.settlementById==='function'){
      const settlement=root.settlementById(npc.locationId);
      if(settlement) return settlement.name;
    }
    return npc.locationId||'unknown';
  }
  // A deliberately independent fallback -- mirrors js/medical.js's
  // medicalInfo()/NpcSystem's conditionName(), but this module stays
  // self-sufficient (no hard dependency on the player medical adapter, and
  // testable without js/medical.js loaded) rather than importing it.
  function conditionName(definitionId){
    const info=root.ConditionRegistry&&typeof root.ConditionRegistry.condition==='function'?root.ConditionRegistry.condition(definitionId):null;
    return info?info.name:'Unrecognized condition';
  }
  function severityLabel(value){
    const n=Number(value)||0;
    return n>=5?'critical':n>=4?'severe':n>=3?'moderate':n>=2?'mild':'slight';
  }
  const STATE_LABELS={latent:'not yet apparent',symptomatic:'symptomatic',diagnosed:'diagnosed',treated:'under treatment',remission:'in remission',chronic:'chronic',resolved:'resolved'};
  function stateLabel(condition){ return STATE_LABELS[condition&&condition.state]||'on file'; }
  function activeConditionsFor(npc){
    return typeof root.MedicalSystem==='object'&&root.MedicalSystem&&typeof root.MedicalSystem.activeConditions==='function'?root.MedicalSystem.activeConditions(npc):[];
  }
  // Up to two active conditions, worst severity first, so a profile card
  // stays scannable even for a member carrying several conditions at once.
  function conditionTags(npc){
    const conditions=activeConditionsFor(npc).slice().sort((a,b)=>(Number(b.severity)||0)-(Number(a.severity)||0));
    if(!conditions.length) return '';
    const shown=conditions.slice(0,2).map(c=>'<span>'+esc(conditionName(c.definitionId))+' · '+severityLabel(c.severity)+'</span>').join('');
    const more=conditions.length>2?'<span class="persistent-person-conditions-more">+'+(conditions.length-2)+' more</span>':'';
    return '<div class="persistent-person-conditions">'+shown+more+'</div>';
  }
  function memberCard(npc,world,subjectId){
    const rel=npc.relationships&&npc.relationships[subjectId];
    const bond=rel?Math.round(rel.closeness):null;
    return '<div class="persistent-person '+(npc.alive?'':'is-deceased')+'">'+
      '<div class="persistent-person-head"><b>'+esc(root.NpcSystem.fullName(npc))+'</b><span>'+esc(relationLabel(npc.roleTags))+'</span></div>'+
      '<div class="persistent-person-meta"><span>age '+ageOf(npc,world)+'</span><span>'+esc(locationName(npc))+'</span><span>'+esc(healthLabel(npc.health&&npc.health.general))+'</span></div>'+
      '<div class="persistent-person-work">'+esc(occupation(npc))+(bond==null?'':' · bond '+bond)+'</div>'+
      (npc.alive?conditionTags(npc):'')+
      (!npc.alive&&npc.deathYear?'<div class="persistent-person-note">died '+esc(npc.deathYear)+(npc.deathCause?' · '+esc(npc.deathCause):'')+'</div>':'')+
    '</div>';
  }
  function householdPanel(world,subject){
    if(!world||!subject||!root.NpcSystem||!root.HouseholdSystem) return '';
    const summary=root.NpcSystem.subjectSummary(world,subject), household=summary.household;
    if(!household) return '<div class="ps-catlab">PERSISTENT HOUSEHOLD</div><div class="aempty">No persistent household record is available.</div>';
    const people=summary.members.filter(npc=>npc.id!==subject.npcId).sort((a,b)=>{
      if(a.alive!==b.alive) return a.alive?-1:1;
      return String(root.NpcSystem.fullName(a)).localeCompare(String(root.NpcSystem.fullName(b)));
    });
    const finances=household.finances||{};
    const memberMarkup=people.length?people.map(npc=>memberCard(npc,world,subject.npcId)).join(''):'<div class="aempty">No other persistent member is attached to this household.</div>';
    const memories=summary.memories.filter(memory=>memory.summary).slice(0,4);
    const memoryMarkup=memories.length?'<div class="persistent-memory-list">'+memories.map(memory=>'<div><b>'+esc(memory.year)+'</b><span>'+esc(memory.summary)+'</span></div>').join('')+'</div>':'<div class="aempty">No major shared memory has been filed yet.</div>';
    return '<div class="ps-catlab">PERSISTENT HOUSEHOLD</div>'+
      '<div class="persistent-household-summary"><div><b>CLASS</b><span>'+esc(household.socialClass)+'</span></div><div><b>STABILITY</b><span>'+Math.round((Number(household.stability)||0)*100)+'%</span></div><div><b>FOOD SECURITY</b><span>'+Math.round((Number(household.foodSecurity)||0)*100)+'%</span></div><div><b>SETTLEMENT</b><span>'+esc(locationName({locationId:household.settlementId}))+'</span></div></div>'+
      '<div class="persistent-household-finance"><span>income '+money(finances.income)+'</span><span>expenses '+money(finances.expenses)+'</span><span>savings '+money(finances.savings)+'</span><span>debt '+money(finances.debt)+'</span></div>'+
      '<div class="persistent-household-ledger"><div><b>ANNUAL FLOW</b><span>balance '+money(finances.lastBalance)+'</span><span>subject income '+money(finances.subjectIncome)+'</span><span>other-member contribution '+money(finances.otherMemberIncome)+'</span><span>other-subject cash flow '+money(finances.otherSubjectCashFlow)+'</span><span>subject expenses '+money(finances.subjectExpenses)+'</span><span>member and medical costs '+money(finances.memberExpenses)+'</span></div><div><b>NPC SALARY DECOMPOSITION</b><span>other-member gross income '+money(finances.otherMemberGrossIncome)+'</span><span>other-member personal expenses '+money(finances.otherMemberPersonalExpenses)+'</span><span>other-member household contribution '+money(finances.otherMemberIncome)+'</span><span>NPC personal wealth change '+money(finances.npcPersonalWealthChange)+'</span></div><div><b>ACTUAL ALLOCATION</b><span>personal-assets change '+money(finances.personalAssetChange)+'</span><span>shared savings added '+money(finances.sharedSavingsAdded)+'</span><span>shared savings used '+money(finances.savingsUsed)+'</span><span>household debt repaid '+money(finances.householdDebtRepaid)+'</span><span>new household debt '+money(finances.newHouseholdDebt)+'</span></div></div>'+
      '<div class="persistent-household-note">Selected subject costs are paid in the main annual economy transaction. Other-member contribution is gross pay after that NPC’s personal expenses; living-member and medical costs are funded once from shared savings, subject assets, or new household debt. The allocation identity is '+money(finances.lastBalance)+' = '+money(finances.accountingIdentity)+'.</div>'+
      '<div class="ps-catlab">CONNECTED PEOPLE</div><div class="persistent-people-grid">'+memberMarkup+'</div>'+
      '<div class="ps-catlab">SHARED MEMORY</div>'+memoryMarkup;
  }

  // One case row for the FAMILY HEALTH panel: patient name, condition +
  // symptom/state label + severity, care-hours line when relevant, and
  // (for still-pending cases) a "Decide" button carrying enough data-*
  // attributes for the UI layer to open the family medical decision window
  // without needing to re-derive anything here.
  // queuedDecision is the player's not-yet-resolved pick for this case (from
  // ui.js's S.__familyMedicalQueue), if any -- distinct from caseRecord's own
  // 'decision' field, which is only set once resolveDecision() has actually
  // run (next time NpcSystem.resolveQueuedFamilyDecisions executes).
  function caseRow(caseRecord,memberName,condition,pending,queuedDecision){
    const severity=condition?Number(condition.severity)||0:0;
    const label=condition?severityLabel(severity)+' · '+stateLabel(condition):'severity unknown';
    const careLine=caseRecord.careHoursRequired>0?'<div class="ar-meta">care needed '+caseRecord.careHoursRequired+'h'+(caseRecord.selectedCareHours>0?' · '+caseRecord.selectedCareHours+'h provided':'')+'</div>':'';
    const statusLine='<div class="ar-meta">'+esc(familyCaseStatusText(caseRecord,queuedDecision))+'</div>';
    const action=pending?'<button class="btn small" data-family-case="'+esc(caseRecord.caseId)+'" data-family-household="'+esc(caseRecord.householdId)+'">'+(queuedDecision?'Change Decision ▸':'Decide ▸')+'</button>':'';
    return '<div class="medical-card family-case-card'+(pending?' family-case-pending':'')+(queuedDecision?' family-case-queued':'')+'"><div class="arow">'+
      '<div class="ar-grade">'+(severity||'?')+'</div>'+
      '<div style="flex:1"><div class="ar-name">'+esc(memberName)+' · '+esc(conditionName(caseRecord.conditionId))+'</div>'+
      '<div class="ar-meta">'+esc(label)+'</div>'+careLine+statusLine+'</div></div>'+action+'</div>';
  }
  const QUEUED_DECISION_LABELS={'fund-recommended-care':'funding recommended care','home-care':'home care','leave-untreated':'leaving it untreated'};
  function familyCaseStatusText(caseRecord,queuedDecision){
    if(queuedDecision) return 'decision queued: '+(QUEUED_DECISION_LABELS[queuedDecision.decision]||queuedDecision.decision)+' — settles next year';
    if(caseRecord.status==='pending') return 'awaiting a family decision';
    if(caseRecord.status==='treated') return 'under treatment ('+(caseRecord.selectedTreatmentId||'care')+')';
    if(caseRecord.status==='home-care') return 'receiving home care';
    if(caseRecord.status==='untreated') return 'left untreated, by decision';
    return caseRecord.status;
  }
  function memberNameFor(world,subject,npcId){
    if(subject&&String(subject.npcId||'')===String(npcId)) return 'the subject';
    const npc=world&&world.npcs&&world.npcs[npcId];
    return npc&&root.NpcSystem&&typeof root.NpcSystem.fullName==='function'?root.NpcSystem.fullName(npc):'Unknown';
  }
  function conditionFor(world,subject,caseRecord){
    const npcId=caseRecord.npcId;
    const person=subject&&String(subject.npcId||'')===String(npcId)?subject:world&&world.npcs&&world.npcs[npcId];
    if(!person||!root.MedicalSystem||typeof root.MedicalSystem.conditionByRef!=='function') return null;
    return root.MedicalSystem.conditionByRef(person,caseRecord.conditionInstanceId);
  }

  // FAMILY HEALTH panel: household-wide medical summary (transmissions,
  // caregiving hours, this-year treatment cost/medical debt from
  // household.finances -- the household-system-settled figures, not the
  // household-health annual snapshot, since the former is what actually
  // reflects the shared-pool allocation) plus every open case, grouped
  // pending-decision-first so the player sees what needs attention.
  function householdHealthPanel(world,subject,queue){
    if(!world||!subject||!root.HouseholdSystem||!root.HouseholdHealthSystem) return '<div class="aempty">Household health records are unavailable.</div>';
    const household=typeof root.HouseholdSystem.findByMember==='function'?root.HouseholdSystem.findByMember(world,subject.npcId):null;
    if(!household) return '<div class="ps-catlab">FAMILY HEALTH</div><div class="aempty">No household record is on file yet.</div>';
    const medicalSummary=root.HouseholdHealthSystem.summary(household);
    const finances=household.finances||{};
    const state=root.HouseholdHealthSystem.ensure(household);
    const cases=(state.cases||[]).filter(c=>!c.resolved);
    const pending=cases.filter(c=>c.status==='pending').sort((a,b)=>String(a.caseId).localeCompare(String(b.caseId)));
    const active=cases.filter(c=>c.status==='treated'||c.status==='home-care').sort((a,b)=>String(a.caseId).localeCompare(String(b.caseId)));
    const untreated=cases.filter(c=>c.status==='untreated').sort((a,b)=>String(a.caseId).localeCompare(String(b.caseId)));
    // Keyed by npcId+conditionInstanceId, matching ui.js's
    // familyMedicalQueueKey() -- a household/case id pair captured while the
    // player was planning can go stale by the household's next reconcile
    // pass (see NpcSystem.resolveQueuedFamilyDecisions), so the queue itself
    // never stores those, only the id that stays valid across it.
    const rowsFor=(list,pendingFlag)=>list.map(caseRecord=>caseRow(caseRecord,memberNameFor(world,subject,caseRecord.npcId),conditionFor(world,subject,caseRecord),pendingFlag,queue&&queue[caseRecord.npcId+'|'+caseRecord.conditionInstanceId])).join('');
    return '<div class="ps-catlab">FAMILY HEALTH</div>'+
      '<div class="persistent-household-summary"><div><b>TRANSMISSIONS THIS YEAR</b><span>'+medicalSummary.transmissions+'</span></div>'+
      '<div><b>CAREGIVING HOURS</b><span>'+medicalSummary.caregivingHoursProvided+' of '+medicalSummary.caregivingHoursRequired+' needed</span></div>'+
      '<div><b>TREATMENT COSTS</b><span>'+money(finances.treatmentCosts)+'</span></div>'+
      '<div><b>MEDICAL DEBT ADDED</b><span>'+money(finances.medicalDebtAdded)+'</span></div></div>'+
      '<div class="ps-sub"><span>PENDING DECISIONS</span><span>'+pending.length+'</span></div>'+
      (pending.length?rowsFor(pending,true):'<div class="aempty">No family medical decision is waiting on you.</div>')+
      '<div class="ps-sub"><span>UNDER CARE</span><span>'+active.length+'</span></div>'+
      (active.length?rowsFor(active,false):'<div class="aempty">No family member is currently under treatment or home care.</div>')+
      (untreated.length?'<div class="ps-sub"><span>LEFT UNTREATED</span><span>'+untreated.length+'</span></div>'+rowsFor(untreated,false):'');
  }

  root.PersistentPeopleUI={esc,money,householdPanel,memberCard,ageOf,healthLabel,relationLabel,conditionName,severityLabel,stateLabel,householdHealthPanel,familyCaseStatusText,memberNameFor,conditionFor};
})(typeof globalThis!=='undefined'?globalThis:this);
