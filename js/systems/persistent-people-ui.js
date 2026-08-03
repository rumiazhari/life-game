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
  function memberCard(npc,world,subjectId){
    const rel=npc.relationships&&npc.relationships[subjectId];
    const bond=rel?Math.round(rel.closeness):null;
    return '<div class="persistent-person '+(npc.alive?'':'is-deceased')+'">'+
      '<div class="persistent-person-head"><b>'+esc(root.NpcSystem.fullName(npc))+'</b><span>'+esc(relationLabel(npc.roleTags))+'</span></div>'+
      '<div class="persistent-person-meta"><span>age '+ageOf(npc,world)+'</span><span>'+esc(locationName(npc))+'</span><span>'+esc(healthLabel(npc.health&&npc.health.general))+'</span></div>'+
      '<div class="persistent-person-work">'+esc(occupation(npc))+(bond==null?'':' · bond '+bond)+'</div>'+
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
      '<div class="persistent-household-ledger"><div><b>ANNUAL FLOW</b><span>balance '+money(finances.lastBalance)+'</span><span>subject income '+money(finances.subjectIncome)+'</span><span>other-member contribution '+money(finances.otherMemberIncome)+'</span><span>other-member gross income '+money(finances.otherMemberGrossIncome)+'</span><span>subject expenses '+money(finances.subjectExpenses)+'</span><span>member and medical costs '+money(finances.memberExpenses)+'</span></div><div><b>ACTUAL ALLOCATION</b><span>personal-assets change '+money(finances.personalAssetChange)+'</span><span>NPC wealth retained '+money(finances.npcPersonalWealthChange)+'</span><span>shared savings added '+money(finances.sharedSavingsAdded)+'</span><span>shared savings used '+money(finances.savingsUsed)+'</span><span>household debt repaid '+money(finances.householdDebtRepaid)+'</span><span>new household debt '+money(finances.newHouseholdDebt)+'</span></div></div>'+
      '<div class="persistent-household-note">Selected subject costs are paid in the main annual economy transaction. Other-member contribution is gross pay after that NPC’s personal expenses; living-member and medical costs are funded once from shared savings, subject assets, or new household debt. The allocation identity is '+money(finances.lastBalance)+' = '+money(finances.accountingIdentity)+'.</div>'+
      '<div class="ps-catlab">CONNECTED PEOPLE</div><div class="persistent-people-grid">'+memberMarkup+'</div>'+
      '<div class="ps-catlab">SHARED MEMORY</div>'+memoryMarkup;
  }
  root.PersistentPeopleUI={esc,money,householdPanel,memberCard,ageOf,healthLabel,relationLabel};
})(typeof globalThis!=='undefined'?globalThis:this);
