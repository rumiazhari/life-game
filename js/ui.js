'use strict';
/* ================= FX / LOG ================= */
function applyFx(fx){
  const out=[];
  for(const k in fx){const v=fx[k]; if(!v) continue;
    if(k==='assets'){S.assets+=v; out.push({txt:(v>0?'+':'−')+'$'+Math.abs(v).toLocaleString('en-US'),plus:v>0});}
    else{ const cap=(k==='health'&&S.healthCap!=null)?S.healthCap:(k==='looks'&&S.looksCap!=null)?S.looksCap:100;
      if(k==='health'&&typeof medicalApplyHealthDelta==='function') medicalApplyHealthDelta(S,v,'game effect');
      else S[k]=clamp(S[k]+v,0,cap);
      window.C[k]=(window.C[k]||0)+v;
      if(S.yearAccum) S.yearAccum[k]=(S.yearAccum[k]||0)+v;
      out.push({txt:(v>0?'+':'−')+Math.abs(v)+' '+STATKEYS[k],plus:v>0});}}
  return out;
}
function operationFailure(tier){
  const table=[[0.65,0.27,0.07,0.01],[0.40,0.35,0.18,0.07],[0.20,0.32,0.30,0.18]][tier];
  const r=Random.next(); let acc=0;
  for(let i=0;i<table.length;i++){ acc+=table[i]; if(r<=acc) return i; }
  return table.length-1;
}
function applyOperationFailure(idx){
  Hold.heat=clamp(Hold.heat+RI(10,20),0,100);
  if(idx===0){
    const alive=livingHoldMembers(); if(alive.length&&chance(.5)) changeHoldLoyalty(pick(alive),-25);
    return {fx:{happiness:-6,relations:-2},text:'The Bureau made an example nearby — nobody arrested, nothing broken, just a very clear message. The fold felt it.'};
  }
  if(idx===1){
    S.record=true; S.jailUntil=S.age+RI(2,6); S.jobTier=0; S.jobName='Unemployed'; S.career=null;
    return {fx:{happiness:-10,health:-5},text:'Subject was taken in for questioning and did not come home for a long while.'};
  }
  if(idx===2){
    markLeader();
    return {fx:{happiness:-16},text:'What the Bureau did to make its point does not heal. Subject carries '+S.markedNote+', now and for the rest of the file.'};
  }
  S.alive=false; S.cause='made an example of, by the Bureau, in public';
  return {fx:{},text:'The operation did not just fail — it was made an example of. The file ends here, publicly, on the Bureau’s schedule, not the subject’s.'};
}
function opReward(fundsAmt,forHold){
  if(forHold){ Hold.resources.funds+=fundsAmt; Hold.trust=clamp(Hold.trust+6,0,100); }
  else { S.assets+=fundsAmt; }
}
function markLeader(){
  S.marked=true;
  S.markedNote=pick(['a hand that no longer closes right','a limp that never fully left','a voice that catches where it used to be steady','a face the Bureau made sure people would remember','a tremor that shows up when it’s quiet']);
  S.health=clamp(S.health-18,0,100); S.looks=clamp(S.looks-20,0,100);
  S.healthCap=Math.min(S.healthCap,S.health+15); S.looksCap=Math.min(S.looksCap,S.looks+10);
}
let yearLog=[], collectingYear=false, recentYearReports=[], introRerolls=3;
const HIGHLIGHT_CLS=new Set(['milestone','crisis','opportunity','guardian-bad','guardian-good']);
function recordHighlight(text,cls,force){
  if(!S||!S.highlights) return;
  if(!force&&!(HIGHLIGHT_CLS.has(cls))) return;
  S.highlights.push({text,age:S.age});
  if(S.highlights.length>8) S.highlights=S.highlights.slice(0,2).concat(S.highlights.slice(-6));
}
function logChips(text,chips,cls,head,highlight){
  const entry={text,cls:cls||'',chips:chips||[],head:head||('YEAR '+S.age+' · '+(S.dob+S.age))};
  queue.push(entry);
  if(collectingYear) yearLog.push(entry);
  recordHighlight(text,cls,highlight);
  typeNext();
  triggerJuice(chips,cls);
}
function logEv(text,fx,cls,head,highlight){ logChips(text, fx?applyFx(fx):[], cls, head, highlight); }

function renderRecentRecord(){
  const el=$('#recentRecordBody'); if(!el) return;
  const latest=recentYearReports[0];
  if(!latest){ el.textContent='No annual report filed yet.'; return; }
  const count=recentYearReports.length;
  el.innerHTML='<span class="record-year">YEAR '+latest.age+'</span>'+latest.text+
    (latest.cause?'<span class="record-cause"> · '+latest.cause+'</span>':'')+
    (count>1?' <span class="record-cause"> · '+(count-1)+' earlier report'+(count===2?'':'s')+' in CASE LOG</span>':'');
}

function fileRecentYearReport(){
  if(!yearLog.length||!S) return;
  const notable=yearLog.find(e=>e.cls==='crisis'||e.cls==='opportunity'||e.cls==='milestone'||e.cls==='final')||yearLog[yearLog.length-1];
  const cause=notable&&notable.chips&&notable.chips.length?notable.chips.slice(0,2).map(c=>c.txt).join(', '):'';
  recentYearReports.unshift({age:S.age,text:notable.text,cause:cause});
  recentYearReports=recentYearReports.slice(0,8);
  renderRecentRecord();
}
const JUICY_CLS=new Set(['plan','decision','crisis','opportunity','ruling','milestone','guardian-bad','guardian-good']);
function triggerJuice(chips,cls){
  if(quietMode||!chips||!chips.length||!JUICY_CLS.has(cls)) return;
  let weighted=0,net=0;
  chips.forEach(c=>{ const raw=parseFloat((c.txt||'').replace(/[^0-9.]/g,''))||1;
    const w=c.txt.indexOf('$')>=0?raw/40:raw; weighted+=w; net+=c.plus?w:-w; });
  if(weighted<3) return;
  const tier=weighted>=15?'large':weighted>=7?'medium':'small';
  const good=net>0;
  snd(good?(tier==='large'?'chimebig':'chime'):(tier==='large'?'buzzbig':'buzz'));
  spawnParticles(tier,good,false);
  if(navigator.vibrate){
    navigator.vibrate(good ? Math.min(15+weighted*2,70) : Math.min(10+weighted,40));
  }
}
function typeNext(){
  let item; const logEl=$('#log');
  while(item=queue.shift()){
    const el=document.createElement('div');
    el.className='entry done'+(item.cls?' '+item.cls:'');
    el.innerHTML='<div class="ehead">'+item.head+'</div><div class="etext">'+item.text+'</div>'+
      (item.chips.length?'<div class="echips">'+item.chips.map(c=>'<span class="fx '+(c.plus?'plus':'minus')+'">'+c.txt+'</span>').join('')+'</div>':'');
    logEl.appendChild(el);
  }
  logEl.scrollTop=logEl.scrollHeight;
}

/* ================= RENDER ================= */
function syncHoldTab(){ const b=$('#btn-hold'); if(b) b.classList.toggle('hidden',!S.holdMember); }
function renderIdentity(){
  $('#id-name').textContent=S.last.toUpperCase()+', '+S.first;
  $('#id-file').textContent=S.sex+' · '+S.id;
  $('#id-dob').textContent=S.dob+' · '+S.place;
  $('#tab-name').textContent='FILE: '+S.last.toUpperCase()+', '+S.first.toUpperCase();
  $('#photo-art').innerHTML=portraitSVG(S.sex,S.photoSeed,S.photoTint);
  $('#photo-cap').textContent='FILE PHOTO · '+S.dob;
}
function viceText(v){return v===0?'none on record':v<=2?'minor notations':v<=5?'a pattern':'the Bureau has a folder on the folder';}
function standingText(v){return v<25?'a name people avoid':v<45?'unremarkable':v<65?'well liked':v<85?'well regarded':'the toast of the district';}
function moodPips(m){const f=Math.round(m/100*3);let h='';for(let i=0;i<3;i++){const on=i<f;const cls=on?(m<30?'bad':m<55?'warn':'on'):'';h+='<i class="'+cls+'"></i>';}return h;}
function abbrevName(full,maxLen){
  if(!full||full.length<=maxLen) return full;
  const parts=full.trim().split(' ');
  if(parts.length<2) return full;
  const first=parts[0];
  const rest=parts.slice(1).map(w=>w.split('-').map(seg=>seg?seg[0].toUpperCase()+'.':'').join('-')).join(' ');
  return first+' '+rest;
}
function sexSym(sex){return '<span class="sex-sym sex-'+(sex==='M'?'m':'f')+'">'+(sex==='M'?'♂':'♀')+'</span>';}
function renderKin(changed){
  let h='';
  if(S.married){ const p=activePartnerContact(); h+='<div class="kinrow compact hotspot" data-hotspot="partner"><span class="kr-l">SPOUSE</span><span class="kr-n">'+(p?sexSym(p.sex):'')+abbrevName(S.partner||'—',16)+'</span><span class="pips">'+moodPips(S.partnerMood)+'</span></div>'; }
  if(S.kids>0){
    const fullName=S.first+' '+S.last;
    const myKids=livingKin().filter(m=>m.relation==='child'&&(m.motherName===fullName||m.fatherName===fullName));
    if(myKids.length){
      myKids.forEach(kid=>{ h+='<div class="kinrow compact"><span class="kr-l">CHILD</span><span class="kr-n">'+sexSym(kid.sex)+abbrevName(kid.first+' '+kid.last,16)+'</span><span class="pips">'+moodPips(kid.bond||S.familyMood)+'</span></div>'; });
    } else {
      h+='<div class="kinrow compact hotspot" data-hotspot="children"><span class="kr-l">CHILDREN</span><span class="kr-n">'+S.kids+(S.kids>1?' kids':' kid')+'</span><span class="pips">'+moodPips(S.familyMood)+'</span></div>';
    }
  }
  if(S.mother&&S.mother.alive&&!S.mother.estranged){ const abs=S.mother.present===false;
    h+='<div class="kinrow compact hotspot" data-hotspot="mother"><span class="kr-l">MOTHER</span><span class="kr-n">'+sexSym('F')+abbrevName(S.mother.name,16)+(abs?' <i class="absent-tag">not in the picture</i>':'')+'</span><span class="pips">'+moodPips(abs?0:S.mother.mood)+'</span></div>'; }
  if(S.father&&S.father.alive&&!S.father.estranged){ const abs=S.father.present===false;
    h+='<div class="kinrow compact hotspot" data-hotspot="father"><span class="kr-l">FATHER</span><span class="kr-n">'+sexSym('M')+abbrevName(S.father.name,16)+(abs?' <i class="absent-tag">not in the picture</i>':'')+'</span><span class="pips">'+moodPips(abs?0:S.father.mood)+'</span></div>'; }
  if(!h) h='<div class="kinempty">No kin on record. The subject is, for now, their own company.</div>';
  $('#kin').innerHTML=h;

  let a='';
  if(S.status==='Attached'&&!S.married){ const p=activePartnerContact(); a+='<div class="kinrow compact hotspot" data-hotspot="partner"><span class="kr-l">PARTNER</span><span class="kr-n">'+(p?sexSym(p.sex):'')+abbrevName(S.partner||'—',16)+'</span><span class="pips">'+moodPips(S.partnerMood)+'</span></div>'; }
  S.contacts.filter(c=>c.role==='friend').forEach(c=>{
    a+='<div class="kinrow compact hotspot" data-hotspot="npc-'+c.cid+'"><span class="kr-l">CONTACT</span><span class="kr-n">'+sexSym(c.sex)+abbrevName(c.name,16)+'</span><span class="pips">'+moodPips(c.mood)+'</span></div>';
  });
  if(!a) a='<div class="kinempty">No outside ties on record.</div>';
  $('#assoc').innerHTML=a;

  $('#standing').innerHTML='<div class="kinrow standingrow hotspot" data-hotspot="relations"><span class="kr-l">STANDING</span><span class="kr-n">'+standingText(S.relations)+'</span><b class="sval standing-val" id="standing-val">'+S.relations+'</b></div>';
  if(changed&&changed.relations){ const sv=$('#standing-val'); sv.classList.add(changed.relations>0?'up':'down'); }
}
function renderStats(changed){
  ensurePersonalSystems(S); updatePersonalStanding();
  for(const k of ['health','happiness','smarts','looks']){
    $('#fill-'+k).style.width=S[k]+'%';
    const val=$('#val-'+k); val.textContent=S[k];
    if(changed&&changed[k]){val.classList.remove('up','down'); void val.offsetWidth; val.classList.add(changed[k]>0?'up':'down');
      const chip=document.createElement('span'); chip.className='chip '+(changed[k]>0?'plus':'minus');
      chip.textContent=(changed[k]>0?'+':'−')+Math.abs(Math.round(changed[k])); $('#row-'+k).appendChild(chip);
      chip.addEventListener('animationend',()=>chip.remove());}}
  const a=$('#val-assets'); a.textContent=money(S.assets); a.classList.toggle('debt',S.assets<0);
  $('#val-job').textContent=S.jailUntil>S.age?'IN CUSTODY':S.jobName;
  $('#val-status').textContent=S.status+(S.kids?' · '+S.kids+(S.kids>1?' children':' child'):'');
  $('#val-vice').textContent=viceText(S.vice);
  $('#val-marked').textContent=S.marked?S.markedNote:'none';
  renderEducationSummary();
  renderSkills();
  renderKin(changed);
  renderIntent();
  renderDisposition();
  renderInventory();
  syncHoldTab();
}
function renderInventory(){
  const el=$('#inventory'); if(!el) return;
  ensurePersonalSystems(S); updatePersonalStanding();
  const house=currentHousing(), food=currentFood();
  const conditions=activeConditions();
  const location=currentSettlement(), building=currentBuilding(), travel=S.traveling?settlementById(S.traveling.to):null;
  const settlementConditions=typeof WorldSimulation==='object'&&WorldSimulation&&World?WorldSimulation.getSettlementConditions(World,location.id):null;
  const standing='<div class="personal-ledger"><div class="sec-h">PERSONAL STANDING <span>LIVE FILE</span></div>'+ 
    '<div class="standing-grid"><div><b>FREEDOM</b><span>'+S.freedom+' · '+freedomLabel(S.freedom)+'</span></div><div><b>SCRUTINY</b><span>'+S.scrutiny+' · '+scrutinyLabel(S.scrutiny)+'</span></div>'+ 
    '<div><b>BUREAU FAVOR</b><span>'+S.bureauFavor+' / 3</span></div><div><b>SECURITY</b><span>'+securityLabel(Math.min(S.housingSecurity,S.financialSecurity))+'</span></div></div>'+ 
    '<div class="medical-line"><b>MEDICAL FILE</b><span>'+(conditions.length?conditions.map(c=>medicalInfo(c.id).name+(c.known?'':' · unexamined')).join(' · '):(S.medicalRecord?'no active condition':'not yet opened'))+'</span></div>'+
    '<div class="location-line"><b>LOCATION</b><span>'+location.name+' · '+(building?building.name:'address pending')+(travel?' · travelling to '+travel.name:'')+'</span></div>'+
    (settlementConditions?'<div class="settlement-conditions"><div class="sec-h">SETTLEMENT CONDITIONS <span>SIMULATION</span></div><div class="condition-grid"><div><b>EMPLOYMENT</b><span>'+settlementConditions.employment+'</span></div><div><b>COST OF LIVING</b><span>'+settlementConditions.costOfLiving+'</span></div><div><b>HEALTHCARE PRESSURE</b><span>'+settlementConditions.healthcare+'</span></div><div><b>UNREST</b><span>'+settlementConditions.unrest+'</span></div><div><b>SURVEILLANCE</b><span>'+settlementConditions.surveillance+'</span></div></div></div>':'')+'</div>';
  if(S.age<16||S.livingAtHome){
    const famT=FAMILY_TIERS.find(f=>f.id===S.familyTier);
    let hc='<div class="aempty">'+(S.age<16?'Dependent on parents — the family provides. No ledger of their own until sixteen.':'Still living at home — rent-free, fed at the family table, for as long as that lasts.')+'</div>';
    if(S.age<16) hc+='<div class="frow"><span class="flabel">FAMILY OF ORIGIN</span><span class="fval">'+(famT?famT.label:'—')+'</span></div>';
    hc+='<div class="frow"><span class="flabel">HOUSING</span><span class="fval">'+house.icon+' '+house.name+'</span></div>';
    hc+='<div class="hh-risk">'+fxSummary(house.fx)+' · '+house.risk+'</div>';
    hc+='<div class="frow"><span class="flabel">FOOD</span><span class="fval">'+food.icon+' '+food.name+'</span></div>';
    hc+='<div class="hh-risk">'+fxSummary(food.fx)+' · '+food.risk+'</div>';
    const gt=guardTier(), gi=GUARD_INFO[gt];
    hc+='<div class="frow"><span class="flabel">GUARDIANSHIP</span><span class="fval">'+gi.label+'</span></div>';
    hc+='<div class="hh-risk">'+gi.line+'</div>';
    el.innerHTML=standing+hc; return;
  }
  let h='';
  h+='<div class="hotspot" data-hotspot="housing"><div class="frow"><span class="flabel">HOUSING</span><span class="fval">'+house.icon+' '+house.name+' · '+(house.rent?money(house.rent)+'/yr':'free')+'</span></div>'+
    '<div class="hh-risk">'+fxSummary(house.fx)+' · '+house.risk+'</div></div>';
  h+='<div class="hotspot" data-hotspot="food"><div class="frow"><span class="flabel">FOOD</span><span class="fval">'+food.icon+' '+food.name+' · '+money(food.cost)+'/yr</span></div>'+
    '<div class="hh-risk">'+fxSummary(food.fx)+' · '+food.risk+'</div></div>';
  if(S.kids>0){ const care=currentChildcare();
    h+='<div class="frow"><span class="flabel">DEPENDENTS</span><span class="fval">'+care.icon+' '+care.name+' · '+money(care.costPerKid)+'/yr × '+S.kids+'</span></div>';
    h+='<div class="hh-risk">'+fxSummary(care.fx)+' · '+care.risk+'</div>'; }
  const subjectHousehold=typeof HouseholdSystem==='object'&&HouseholdSystem&&typeof HouseholdSystem.findByMember==='function'?HouseholdSystem.findByMember(World,S.npcId):null;
  const outlay=typeof HouseholdSystem==='object'&&HouseholdSystem&&typeof HouseholdSystem.estimateOutlay==='function'?HouseholdSystem.estimateOutlay(World,subjectHousehold,S,{year:currentYear()}):{personalLifestyleOutlay:0,additionalHouseholdCosts:0,projectedTotalOutlay:0};
  h+='<div class="sec-h">LIABILITIES <span>'+(S.liabilities.length||'NONE')+'</span></div>';
  if(S.liabilities.length){
    S.liabilities.forEach(l=>{ h+='<div class="arow"><div class="ar-grade">'+l.icon+'</div><div style="flex:1"><div class="ar-name">'+l.name+'</div><div class="ar-meta">'+money(l.annualPayment)+'/yr · '+l.yearsLeft+'y remaining</div></div></div>'; });
  } else {
    h+='<div class="aempty">No debts on file.</div>';
  }
  h+='<div class="frow moneyrow hotspot" data-hotspot="outlay"><span class="flabel">PERSONAL LIFESTYLE OUTLAY</span><span class="fval big">'+money(outlay.personalLifestyleOutlay)+'</span></div>';
  h+='<div class="frow moneyrow"><span class="flabel">ADDITIONAL HOUSEHOLD COSTS</span><span class="fval big">'+money(outlay.additionalHouseholdCosts)+'</span></div>';
  h+='<div class="frow moneyrow"><span class="flabel">PROJECTED TOTAL OUTLAY</span><span class="fval big">'+money(outlay.projectedTotalOutlay)+'</span></div>';
  h+='<button class="btn small" id="invOpenMedical" style="width:100%;margin-top:8px">Open Medical File ▸</button>';
  h+='<button class="btn small" id="invOpenHousehold" style="width:100%;margin-top:8px">Manage the Household ▸</button>';
  el.innerHTML=standing+h;
}
function openMedicalTreatmentPicker(conditionId){
  const condition=conditionById(conditionId||((activeConditions()[0]||{}).instanceId));
  if(!condition||!condition.known) return;
  const options=medicalTreatmentOptions(condition.instanceId);
  const access=medicalAccessFor(S,medicalContext(S));
  const rows=options.length?options.map(option=>'<button class="chipbtn" data-medical-treatment="'+option.id+'"><b>'+option.name+'</b><span>'+money(option.cost)+' · '+Math.round(option.success*100)+'% course success</span></button>').join(''):'<div class="qempty">No treatment is available through '+access.facility+'.</div>';
  $('#skillSheet').innerHTML='<div class="ps-head"><span>TREATMENT ORDER</span><span>'+medicalInfo(condition.id).name.toUpperCase()+'</span></div>'+
    '<div class="aempty" style="margin:6px 2px 10px">'+medicalSeverityLabel(condition.severity)+' · '+medicalStateLabel(condition)+' · care through '+access.facility+'. Filing treatment reserves one plan hour this year.</div>'+
    '<div class="chips">'+rows+'</div><div class="ps-foot"><button class="btn" id="medicalTreatmentCancel">Back ▸</button></div>';
  $('#skillSheet').onclick=e=>{
    const choice=e.target.closest('[data-medical-treatment]');
    if(choice){ queueAdd('d','treatment',{condition:condition.instanceId,treatment:choice.dataset.medicalTreatment}); $('#skillWrap').classList.add('hidden'); return; }
    if(e.target.id==='medicalTreatmentCancel') $('#skillWrap').classList.add('hidden');
  };
  $('#skillWrap').classList.remove('hidden');
}
function openMedicalFile(){
  if(!S) return;
  const summary=medicalSummary(S), conditions=summary.conditions, access=summary.access;
  const rows=conditions.length?conditions.map(c=>{
    const treatment=c.known?'<button class="btn small" data-medical-treat="'+c.instanceId+'">File treatment · 1h ▸</button>':'<span class="ar-meta">Diagnosis required before treatment.</span>';
    return '<div class="medical-card"><div class="arow"><div class="ar-grade">'+c.severity+'</div><div style="flex:1"><div class="ar-name">'+medicalInfo(c.id).name+'</div><div class="ar-meta">'+medicalSeverityLabel(c.severity)+' · '+medicalStateLabel(c)+' · since age '+c.onsetAge+'</div><div class="ar-meta">'+(c.source||'unclassified')+(c.treatment?' · last care: '+(MEDICAL_TREATMENTS[c.treatment]||{}).name:'')+'</div></div></div>'+treatment+'</div>';
  }).join(''):'<div class="aempty">No active condition is recorded. A healthy-looking file is still only a file; use a doctor visit when something feels wrong.</div>';
  $('#medicalSheet').innerHTML='<div class="ps-head"><span>MEDICAL FILE</span><span>FORM M-2</span></div>'+
    '<div class="medical-overview"><b>WELLNESS '+S.health+'/'+(S.healthCap||100)+'</b><span>resilience '+Math.round(summary.resilience)+' · '+access.facility+' · care quality '+Math.round(access.quality*100)+'%</span></div>'+
    '<div class="ps-sub"><span>ACTIVE CONDITIONS</span><span>'+conditions.length+'</span></div>'+rows+
    '<div class="ps-sub"><span>RECENT RECORD</span></div><div class="medical-history">'+(S.medical.history.slice(-4).reverse().map(h=>'AGE '+h.age+' · '+h.kind.toUpperCase()+(h.note?' · '+h.note:'')).join('<br>')||'No medical entry has been filed yet.')+'</div>'+
    '<div class="ps-foot"><button class="btn" id="medicalClose">Close the File ▸</button></div>';
  $('#medicalWrap').classList.remove('hidden');
}
$('#medicalSheet').addEventListener('click',e=>{
  const treatment=e.target.closest('[data-medical-treat]');
  if(treatment){ openMedicalTreatmentPicker(treatment.dataset.medicalTreat); return; }
  if(e.target.id==='medicalClose') $('#medicalWrap').classList.add('hidden');
});
function setLifestyle(cat,id){
  if(!S||!S.lifestyle) return;
  const prev=S.lifestyle[cat]; if(prev===id) return;
  S.lifestyle[cat]=id;
  if(cat==='housing'){
    const prevT=HOUSING.find(h=>h.id===prev), nextT=HOUSING.find(h=>h.id===id);
    if(prevT&&nextT&&nextT.rent>prevT.rent){ const moveCost=Math.round(nextT.rent*0.2); S.assets-=moveCost;
      logEv('Subject moved to '+nextT.name.toLowerCase()+'. '+(moveCost?'The move itself cost '+money(moveCost)+' extra.':''),{});
    } else if(nextT){ logEv(nextT.id==='none'?'Subject gave up the lease. There was nowhere in particular to be, now.':'Subject moved to '+nextT.name.toLowerCase()+', and it was, at least, cheaper.',{}); }
  } else if(cat==='food'){
    const nextT=FOOD.find(f=>f.id===id); logEv('The household diet changed — '+nextT.name.toLowerCase()+', from now on.',{});
  } else if(cat==='childcare'){
    const nextT=CHILDCARE.find(c=>c.id===id); logEv('Subject changed how the children are raised — '+nextT.name.toLowerCase()+', from now on.',{});
  }
  renderPlan(); renderInventory(); updateBar();
  if(!$('#householdWrap').classList.contains('hidden')) renderHousehold();
}
let householdFilter=null;
function openHousehold(filterCat){ householdFilter=filterCat||null; renderHousehold(); $('#householdWrap').classList.remove('hidden'); }
function renderHousehold(){
  const filterCat=householdFilter;
  let h='';
  if(!filterCat||filterCat==='housing') h+='<div class="ps-catlab">HOUSING</div><div class="lifegrid">'+lifeToggle(HOUSING,S.lifestyle.housing,'house',it=>it.rent?money(it.rent)+'/yr':'free')+'</div>';
  if(!filterCat||filterCat==='food') h+='<div class="ps-catlab">FOOD</div><div class="lifegrid">'+lifeToggle(FOOD,S.lifestyle.food,'food',it=>money(it.cost)+'/yr')+'</div>';
  if(!filterCat&&S.kids>0) h+='<div class="ps-catlab">CHILDCARE</div><div class="lifegrid">'+lifeToggle(CHILDCARE,S.lifestyle.childcare,'childcare',it=>money(it.costPerKid)+'/yr per kid')+'</div>';
  if(!filterCat&&typeof PersistentPeopleUI==='object'&&PersistentPeopleUI&&typeof PersistentPeopleUI.householdPanel==='function'){
    h+=PersistentPeopleUI.householdPanel(World,S);
  }
  const title=filterCat==='housing'?'HOUSING':filterCat==='food'?'FOOD':'HOUSEHOLD & GROCERIES';
  $('#householdSheet').innerHTML='<div class="ps-head"><span>'+title+'</span><span>FORM H-1</span></div>'+
    '<div class="aempty" style="margin:6px 2px 12px">Standing choices — no hours spent, changed as often as you like. Every rung shows what it costs, and what it does to the subject, every single year.</div>'+
    h+
    '<div class="ps-foot">'+(filterCat?'<button class="btn small" id="householdShowAll" style="margin-bottom:8px;width:100%">Show Full Household ▸</button>':'')+'<button class="btn" id="householdClose">Back to the Ledger ▸</button></div>';
  $('#householdWrap').classList.remove('hidden');
}
$('#householdWrap').addEventListener('click',e=>{
  if(e.target.id==='householdClose'||e.target.id==='householdWrap'){ householdFilter=null; $('#householdWrap').classList.add('hidden'); return; }
  if(e.target.id==='householdShowAll'){ householdFilter=null; renderHousehold(); return; }
  const houseb=e.target.closest('[data-house]'); if(houseb){ snd('stamp'); setLifestyle('housing',houseb.dataset.house); return; }
  const foodb=e.target.closest('[data-food]'); if(foodb){ snd('stamp'); setLifestyle('food',foodb.dataset.food); return; }
  const carebd=e.target.closest('[data-childcare]'); if(carebd){ snd('stamp'); setLifestyle('childcare',carebd.dataset.childcare); return; }
});
/* ================= KARSEN MAP ================= */
const MAP_ZOOM_MIN=1, MAP_ZOOM_MAX=2.2;
let mapViewport={x:0,y:0,scale:1}, mapDragging=null, mapPointers=new Map(), mapTouchState=null;
function applyMapTransform(){
  const plane=$('#mapPlane');
  if(plane) plane.setAttribute('transform','translate('+mapViewport.x+' '+mapViewport.y+') scale('+mapViewport.scale+')');
}
function mapPoint(e,svg){
  const r=svg.getBoundingClientRect();
  const view=svg.viewBox?.baseVal||{width:100,height:82};
  return {x:(e.clientX-r.left)/r.width*view.width,y:(e.clientY-r.top)/r.height*view.height};
}
function mapViewSize(svg){
  const view=svg.viewBox?.baseVal||{width:100,height:82};
  return {width:view.width||100,height:view.height||82};
}
function mapPinchState(){
  const pts=Array.from(mapPointers.values());
  if(pts.length<2) return null;
  const a=pts[0],b=pts[1],dx=b.x-a.x,dy=b.y-a.y;
  return {center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(1,Math.hypot(dx,dy))};
}
function mapSettlementBadge(s){ return s.kind==='village'?'VILLAGE':s.kind==='town'?'TOWN':'CITY'; }
function mapNodeClass(s){
  const current=World&&World.activeSettlementId===s.id, known=World&&World.map&&World.map.discoveredSettlementIds.includes(s.id);
  return 'map-node '+(current?'current ':'')+(known?'known':'unverified');
}
function mapRoutesSvg(){
  return KARSEN_ROUTES.map(r=>{const a=settlementById(r.from),b=settlementById(r.to);return '<line class="map-route '+r.mode+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"></line>';}).join('');
}
function renderNationalMap(){
  const selected=settlementById(World.map.selectedSettlementId)||currentSettlement();
  const nodes=KARSEN_SETTLEMENTS.map(s=>{const radius=s.kind==='city'?2.6:s.kind==='town'?2:1.5;return '<g class="'+mapNodeClass(s)+'" data-map-settlement="'+s.id+'" tabindex="0" role="button" aria-label="'+(World.map.discoveredSettlementIds.includes(s.id)?s.name:'Unverified settlement')+'"><circle class="map-node-hit" cx="'+s.x+'" cy="'+s.y+'" r="4.2"></circle><circle class="map-node-dot" cx="'+s.x+'" cy="'+s.y+'" r="'+radius+'"></circle><text x="'+(s.x+3)+'" y="'+(s.y+1)+'">'+(World.map.discoveredSettlementIds.includes(s.id)?s.name:'UNVERIFIED')+'</text></g>';}).join('');
  return '<div class="map-kicker"><span>COMMONWEALTH OF KARSEN</span><span>OFFICIAL SURVEY · '+currentYear()+'</span></div>'+
    '<div class="map-toolbar"><button class="map-tool active" data-map-mode="national">NATIONAL</button><span>'+KARSEN_SETTLEMENTS.length+' SETTLEMENTS · '+World.map.visitedSettlementIds.length+' VISITED</span></div>'+
    '<div class="map-canvas" id="mapCanvas"><svg id="mapSvg" viewBox="0 0 100 82" aria-label="National map of Karsen"><g id="mapPlane" transform="translate('+mapViewport.x+' '+mapViewport.y+') scale('+mapViewport.scale+')"><path class="map-border" d="M8 12 L25 5 L45 7 L67 4 L91 16 L96 42 L89 74 L65 80 L42 76 L17 80 L5 58 Z"></path><path class="map-river" d="M12 43 C29 34 36 47 50 38 S72 29 91 35"></path>'+mapRoutesSvg()+nodes+'</g></svg><div class="map-compass">N</div></div>'+
    '<div class="map-legend"><span><i class="legend-city"></i> city</span><span><i class="legend-town"></i> town</span><span><i class="legend-route"></i> official route</span><span><i class="legend-hidden"></i> unverified</span></div>'+
    '<div class="map-selection"><div class="map-selection-copy"><b>'+selected.name+'</b><span>'+mapSettlementBadge(selected)+' · '+selected.region+' · population '+selected.population+'</span><em>'+selected.description+'</em></div><button class="btn small" data-map-open="'+selected.id+'">Open Settlement Map ▸</button></div>';
}
function settlementRoadsSvg(){
  return '<path class="settlement-road" d="M5 18 H95 M5 42 H95 M5 66 H95 M20 5 V77 M49 5 V77 M78 5 V77"></path><path class="settlement-road minor" d="M5 30 H95 M5 54 H95 M34 5 V77 M64 5 V77"></path>';
}
function renderSettlementMap(){
  const s=settlementById(World.map.selectedSettlementId)||currentSettlement();
  if(!s) return '';
  const selectedId=World.map.selectedBuildingId||s.buildings[0].id;
  const buildings=s.buildings.map(b=>'<g class="map-building '+b.type+(b.id===selectedId?' selected':'')+'" data-map-building="'+b.id+'" tabindex="0" role="button"><rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx=".7"></rect><text x="'+(b.x+b.w/2)+'" y="'+(b.y+b.h/2+1)+'">'+b.name.split(' ')[0]+'</text></g>').join('');
  const selected=buildingById(s.id,selectedId)||s.buildings[0], same=World.activeSettlementId===s.id;
  const currentLabel=same?'CURRENT SETTLEMENT':'OFFICIAL LOCATION FILE';
  const route=routeBetween(currentSettlement().id,s.id), cost=same?0:travelCost(currentSettlement(),s);
  const travelNote=S.traveling?'already travelling to '+settlementById(S.traveling.to).name:S.age<16?'independent travel begins at age 16':same?'already here':S.assets<cost?'needs '+money(cost):'fare '+money(cost)+' · arrives next year';
  const travelButton=!same?'<button class="btn small map-travel-btn" data-map-travel="'+s.id+'" '+(S.traveling||S.age<16||S.assets<cost?'disabled':'')+'>Travel Here ▸</button>':'';
  return '<div class="map-kicker"><button class="map-back" data-map-mode="national">← NATIONAL MAP</button><span>'+s.name.toUpperCase()+' · '+mapSettlementBadge(s)+'</span></div>'+
    '<div class="map-toolbar"><button class="map-tool active" data-map-mode="settlement">SETTLEMENT</button><span>'+s.region+' · '+s.population+' residents</span></div>'+
    '<div class="map-canvas settlement-canvas" id="mapCanvas"><svg id="mapSvg" viewBox="0 0 100 82" aria-label="Map of '+s.name+'"><g id="mapPlane" transform="translate('+mapViewport.x+' '+mapViewport.y+') scale('+mapViewport.scale+')"><rect class="settlement-ground" x="1" y="1" width="98" height="80" rx="2"></rect>'+settlementRoadsSvg()+buildings+'</g></svg><div class="map-compass">N</div></div>'+
    '<div class="map-selection building-selection"><div class="map-selection-copy"><small>'+currentLabel+'</small><b>'+selected.name+'</b><span>'+selected.type.toUpperCase()+' · '+selected.district+'</span><em>'+selected.description+'</em></div><div class="map-actions">'+travelButton+'<span class="map-travel-note">'+travelNote+'</span></div></div>';
}
const KARSEN_MAP_LABELS={
 branec:{x:86,y:49,anchor:'start',leader:true},
 veskar:{x:29,y:64,anchor:'start',leader:true},
 eisenmark:{x:112,y:73,anchor:'start',leader:true},
 kostrin:{x:72,y:73,anchor:'start',leader:true},
 rudava:{x:126,y:57,anchor:'start'},
 dobraven:{x:45,y:35,anchor:'start',leader:true},
 krasnava:{x:83,y:86,anchor:'start'},
 brezin:{x:60,y:25,anchor:'start'},
 lindava:{x:27,y:38,anchor:'middle'},
 sundervik:{x:117,y:23,anchor:'middle'},
 oberhain:{x:129,y:84,anchor:'middle'},
 marec:{x:134,y:37,anchor:'middle'},
 kamenor:{x:48,y:62,anchor:'start'},
 svetlin:{x:104,y:86,anchor:'start'}
};
function nationalMapLayout(){
  const tall=window.matchMedia?.('(max-width: 700px)').matches;
  const compact=window.matchMedia?.('(max-width: 520px)').matches;
  const stretch=tall?(compact?2.32:3.15):1;
  const height=tall?(compact?190:260):100;
  return {height,tall,y:y=>tall?8+(y-20)*stretch:y,geoTransform:tall?'translate(0 '+(8-20*stretch)+') scale(1 '+stretch+')':''};
}
function mapRouteClean(r,i,layout=nationalMapLayout()){
  const a=settlementById(r.from),b=settlementById(r.to),ay=layout.y(a.y),by=layout.y(b.y),dx=b.x-a.x,dy=by-ay,len=Math.max(1,Math.sqrt(dx*dx+dy*dy)),bend=(i%2?2.4:-2.4),cx=(a.x+b.x)/2+(-dy/len*bend),cy=(ay+by)/2+(dx/len*bend);
  return '<path class="map-route '+r.mode+'" d="M '+a.x+' '+ay+' Q '+cx+' '+cy+' '+b.x+' '+by+'"></path>';
}
function renderNationalMapClean(){
  const selected=settlementById(World.map.selectedSettlementId)||currentSettlement();
  World.map.discoveredSettlementIds=KARSEN_SETTLEMENTS.map(s=>s.id);
  const nodes=KARSEN_SETTLEMENTS.map(s=>{const p=KARSEN_MAP_LABELS[s.id]||{dx:3,dy:1,anchor:'start'},radius=s.kind==='city'?2.35:s.kind==='town'?1.85:1.35,current=World.activeSettlementId===s.id;return '<g class="map-node '+s.kind+(current?' current':'')+'" data-map-settlement="'+s.id+'" tabindex="0" role="button" aria-label="'+s.name+'"><circle class="map-node-hit" cx="'+s.x+'" cy="'+s.y+'" r="4.2"></circle><circle class="map-node-dot" cx="'+s.x+'" cy="'+s.y+'" r="'+radius+'"></circle><text x="'+(s.x+p.dx)+'" y="'+(s.y+p.dy)+'" text-anchor="'+p.anchor+'">'+s.name+'</text></g>';}).join('');
  const regionLabels='<g class="map-region-labels" aria-hidden="true"><text x="18" y="35">WESTERN MARCHES</text><text x="52" y="22">CENTRAL KARSEN</text><text x="73" y="38">EASTERN LINE</text><text x="50" y="64">SOUTHERN FARMLAND</text></g>';
  const routes=KARSEN_ROUTES.map(mapRouteClean).join('');
  return '<div class="map-kicker"><span>COMMONWEALTH OF KARSEN</span><span>OFFICIAL SURVEY · '+currentYear()+'</span></div>'+
    '<div class="map-toolbar"><button class="map-tool active" data-map-mode="national">NATIONAL</button><span>'+KARSEN_SETTLEMENTS.length+' SETTLEMENTS · '+World.map.visitedSettlementIds.length+' VISITED</span></div>'+
    '<div class="map-canvas" id="mapCanvas"><svg id="mapSvg" viewBox="0 0 100 82" aria-label="National map of Karsen"><g id="mapPlane" transform="translate('+mapViewport.x+' '+mapViewport.y+') scale('+mapViewport.scale+')"><path class="map-border" d="M 10 17 C 20 9 34 8 47 10 C 60 7 76 8 89 17 C 95 27 96 43 92 57 C 88 70 77 76 63 77 C 49 80 34 77 20 78 C 10 70 6 56 7 42 C 6 30 7 22 10 17 Z"></path><path class="map-relief" d="M 13 31 C 23 26 33 27 42 31 S 61 36 72 27 S 85 22 92 26 M 11 60 C 24 55 35 59 45 63 S 67 68 87 59"></path><path class="map-river" d="M 7 47 C 20 40 29 42 39 47 C 50 53 59 49 67 40 C 76 30 84 31 95 25"></path>'+regionLabels+routes+nodes+'</g></svg><div class="map-compass">N</div></div>'+ 
    '<div class="map-legend"><span><i class="legend-city"></i> city</span><span><i class="legend-town"></i> town</span><span><i class="legend-village"></i> village</span><span><i class="legend-road"></i> road</span><span><i class="legend-rail"></i> rail</span><span><i class="legend-river"></i> river</span></div>'+ 
    '<div class="map-selection"><div class="map-selection-copy"><b>'+selected.name+'</b><span>'+mapSettlementBadge(selected)+' · '+selected.region+' · population '+selected.population+'</span><em>'+selected.description+'</em></div><button class="btn small" data-map-open="'+selected.id+'">Open Settlement Map ▸</button></div>';
}
function cleanNationalMapMarkup(markup){return markup.replace(/·/g,' - ').replace(/▸/g,' > ');}
function mapMinorRoadsSvg(){
  const roads=[
    'M 18 49 C 24 45 30 42 38 40 C 43 38 45 38 48 37',
    'M 22 59 C 29 58 36 57 43 58 C 54 57 68 53 82 52',
    'M 43 58 C 53 64 64 73 78 81',
    'M 82 52 C 77 45 70 37 68 31 C 64 28 60 28 56 28',
    'M 68 31 C 81 28 98 28 117 29',
    'M 108 69 C 115 70 122 74 128 78',
    'M 122 57 C 127 52 131 47 134 43',
    'M 122 57 C 122 47 119 37 117 29'
  ];
  return roads.map(d=>'<path class="map-minor-road" d="'+d+'"></path>').join('');
}
function mapSeaSvg(showLabels=true){
  return '<g class="map-sea-details" aria-hidden="true">'+
    '<path class="map-shore" d="M 18 49 C 11 52 11 57 14 61 C 20 66 16 74 24 78"></path>'+
    '<path class="map-sea-line" d="M 3 12 C 22 7 39 13 57 9 S 92 6 110 11 S 137 8 148 14"></path>'+
    '<path class="map-sea-line" d="M 1 88 C 20 83 35 91 53 88 S 91 88 108 93 S 136 91 149 86"></path>'+
    '<path class="map-sea-line" d="M 6 23 C 14 19 22 20 29 17 M 5 28 C 14 24 21 25 28 22"></path>'+
    '<path class="map-sea-line" d="M 122 15 C 132 12 140 15 147 20 M 124 19 C 133 16 141 19 147 24"></path>'+
    '<path class="map-sea-island" d="M 8 73 C 11 69 17 69 19 73 C 18 77 13 79 9 77 Z"></path>'+
    '<path class="map-sea-island" d="M 136 72 C 139 68 145 69 146 73 C 144 77 139 78 136 76 Z"></path>'+
    (showLabels?'<text class="map-sea-label" x="8" y="17" text-anchor="start">WESTERN SEA</text><text class="map-sea-label" x="107" y="96" text-anchor="middle">SOUTHERN SEA</text>':'')+
    '</g>';
}
function mapGreenerySvg(showSeaLabels=true){
  return mapSeaSvg(showSeaLabels)+'<g class="map-greenery" aria-hidden="true">'+
    '<path class="map-forest" d="M 35 27 C 41 20 52 19 62 23 C 67 28 64 37 56 41 C 47 42 38 38 35 32 Z"></path>'+
    '<path class="map-forest" d="M 99 31 C 107 26 119 27 126 34 C 128 41 123 48 114 50 C 105 48 100 42 99 31 Z"></path>'+
    '<path class="map-meadow" d="M 55 45 C 64 40 75 41 84 46 C 87 52 79 58 69 59 C 60 57 54 52 55 45 Z"></path>'+
    '<path class="map-meadow" d="M 60 68 C 70 62 83 64 91 70 C 91 77 82 81 72 80 C 64 78 59 74 60 68 Z"></path>'+
    '<path class="map-wetland" d="M 112 52 C 120 49 129 51 134 57 C 133 64 125 68 117 66 C 112 63 110 58 112 52 Z"></path>'+
    '<path class="map-industrial" d="M 97 61 C 104 58 114 60 119 66 C 118 73 110 76 102 73 C 98 70 96 66 97 61 Z"></path>'+
    '</g>';
}
function renderNationalMapNatural(){
  const selected=settlementById(World.map.selectedSettlementId)||currentSettlement();
  World.map.discoveredSettlementIds=KARSEN_SETTLEMENTS.map(s=>s.id);
  const layout=nationalMapLayout();
  // Phones receive a true portrait survey sheet: geography and routes spread
  // vertically, while settlement dots and type remain circular and readable.
  const mapPreserve='xMidYMid meet';
  const labelLeaders=KARSEN_SETTLEMENTS.map(s=>{const p=KARSEN_MAP_LABELS[s.id];return p?.leader?'<path class="map-label-leader" d="M '+s.x+' '+layout.y(s.y)+' L '+p.x+' '+layout.y(p.y-.9)+'"></path>':'';}).join('');
  const nodes=KARSEN_SETTLEMENTS.map(s=>{const p=KARSEN_MAP_LABELS[s.id]||{x:s.x+4,y:s.y+1,anchor:'start'},radius=s.kind==='city'?2.65:s.kind==='town'?2.05:1.55,current=World.activeSettlementId===s.id;return '<g class="map-node '+s.kind+(current?' current':'')+'" data-map-settlement="'+s.id+'" tabindex="0" role="button" aria-label="'+s.name+'"><circle class="map-node-hit" cx="'+s.x+'" cy="'+layout.y(s.y)+'" r="5.2"></circle><circle class="map-node-dot" cx="'+s.x+'" cy="'+layout.y(s.y)+'" r="'+radius+'"></circle><text x="'+p.x+'" y="'+layout.y(p.y)+'" text-anchor="'+p.anchor+'">'+s.name+'</text></g>';}).join('');
  const regionLabels='<g class="map-region-labels" aria-hidden="true"><text x="30" y="'+layout.y(69)+'">WESTERN COAST</text><text x="52" y="'+layout.y(22)+'">NORTH WOODS</text><text x="82" y="'+layout.y(46)+'">CENTRAL LOWLAND</text><text x="111" y="'+layout.y(61)+'">IRON COUNTRY</text><text x="75" y="'+layout.y(77)+'">SOUTHERN FARMLAND</text><text x="126" y="'+layout.y(49)+'">EASTERN GRAIN PLAIN</text></g>';
  const seaLabels='<g class="map-sea-details" aria-hidden="true"><text class="map-sea-label" x="8" y="'+layout.y(17)+'" text-anchor="start">WESTERN SEA</text><text class="map-sea-label" x="107" y="'+layout.y(96)+'" text-anchor="middle">SOUTHERN SEA</text></g>';
  const routes=KARSEN_ROUTES.map((r,i)=>mapRouteClean(r,i,layout)).join('');
  const border='M 18 49 C 14 41 22 31 38 29 C 52 27 58 18 75 20 C 91 21 99 30 111 27 C 125 23 138 28 145 38 C 150 46 147 55 139 60 C 147 68 141 78 130 82 C 116 86 105 78 93 84 C 81 91 69 82 56 86 C 43 91 30 86 24 78 C 16 74 20 66 14 61 C 9 57 11 52 18 49 Z';
  return '<div class="map-kicker"><span>COMMONWEALTH OF KARSEN</span><span>OFFICIAL SURVEY - '+currentYear()+'</span></div>'+ 
    '<div class="map-toolbar"><button class="map-tool active" data-map-mode="national">NATIONAL</button><span>'+KARSEN_SETTLEMENTS.length+' SETTLEMENTS - '+World.map.visitedSettlementIds.length+' VISITED</span></div>'+
    '<div class="map-canvas national-map-canvas" id="mapCanvas"><svg id="mapSvg" viewBox="0 0 150 '+layout.height+'" preserveAspectRatio="'+mapPreserve+'" aria-label="National map of Karsen"><g id="mapPlane" transform="translate('+mapViewport.x+' '+mapViewport.y+') scale('+mapViewport.scale+')"><g transform="'+layout.geoTransform+'"><path class="map-border" d="'+border+'"></path><path class="map-shore" d="M 18 49 C 14 41 22 31 38 29"></path>'+mapGreenerySvg(!layout.tall)+'<path class="map-river-main" d="M 56 28 C 61 36 68 43 76 48 C 83 53 91 58 102 60 C 112 62 121 59 132 54"></path><path class="map-river" d="M 43 58 C 53 54 62 51 76 48 M 68 68 C 73 60 77 54 76 48 M 117 29 C 111 37 106 45 102 60 M 108 69 C 113 66 119 62 124 58"></path><path class="map-river-small" d="M 24 62 C 31 61 37 59 43 58 M 78 81 C 84 73 91 67 102 60 M 126 78 C 123 71 123 64 124 58"></path>'+mapMinorRoadsSvg()+'</g>'+(layout.tall?seaLabels:'')+regionLabels+routes+labelLeaders+nodes+'</g></svg><div class="map-compass">N</div></div>'+
    '<div class="map-legend"><span><i class="legend-city"></i> city</span><span><i class="legend-town"></i> town</span><span><i class="legend-village"></i> village</span><span><i class="legend-road"></i> road</span><span><i class="legend-rail"></i> rail</span><span><i class="legend-river"></i> river</span><span><i class="legend-green"></i> terrain</span></div>'+
    '<div class="map-selection"><div class="map-selection-copy"><b>'+selected.name+'</b><span>'+mapSettlementBadge(selected)+' - '+selected.region+' - population '+selected.population+'</span><em>'+selected.description+'</em></div><button class="btn small" data-map-open="'+selected.id+'">Open Settlement Map &gt;</button></div>';
}
renderNationalMap=renderNationalMapNatural;
function renderMap(){
  const sheet=$('#mapSheet'); if(!sheet||!World||!World.map) return;
  mapViewport.scale=clamp(mapViewport.scale,MAP_ZOOM_MIN,MAP_ZOOM_MAX);
  sheet.innerHTML=(World.map.mode==='settlement'?renderSettlementMap():renderNationalMap())+'<div class="ps-foot"><button class="btn" id="mapClose">Close the Map ▸</button></div>';
  const svg=$('#mapSvg'); if(!svg) return;
  const viewSize=mapViewSize(svg);
  svg.addEventListener('wheel',e=>{e.preventDefault();mapViewport.scale=clamp(mapViewport.scale+(e.deltaY<0?.12:-.12),MAP_ZOOM_MIN,MAP_ZOOM_MAX);applyMapTransform();},{passive:false});
  svg.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch') return;
    const interactive=!!e.target.closest?.('[data-map-settlement],[data-map-building]');
    const point=mapPoint(e,svg);
    mapPointers.set(e.pointerId,{x:point.x,y:point.y,cx:e.clientX,cy:e.clientY,interactive});
    svg.setPointerCapture?.(e.pointerId);
    if(mapPointers.size===1){ mapDragging=interactive?null:{x:e.clientX,y:e.clientY,ox:mapViewport.x,oy:mapViewport.y}; }
    else if(mapPointers.size===2){
      const pinch=mapPinchState();
      mapDragging={pinch,scale:mapViewport.scale,x:mapViewport.x,y:mapViewport.y};
    }
  });
  svg.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch') return;
    if(!mapPointers.has(e.pointerId)) return;
    e.preventDefault();
    const previous=mapPointers.get(e.pointerId), point=mapPoint(e,svg);
    mapPointers.set(e.pointerId,{x:point.x,y:point.y,cx:e.clientX,cy:e.clientY,interactive:previous?.interactive});
    if(mapPointers.size>=2){
      const pinch=mapPinchState(); if(!pinch||!mapDragging?.pinch) return;
      const oldScale=mapDragging.scale, newScale=clamp(oldScale*(pinch.distance/mapDragging.pinch.distance),MAP_ZOOM_MIN,MAP_ZOOM_MAX);
      const focal=mapDragging.pinch.center;
      mapViewport.scale=newScale;
      mapViewport.x=focal.x-(focal.x-mapDragging.x)*newScale/oldScale+(pinch.center.x-focal.x);
      mapViewport.y=focal.y-(focal.y-mapDragging.y)*newScale/oldScale+(pinch.center.y-focal.y);
      applyMapTransform(); return;
    }
    if(!mapDragging) return;
    mapViewport.x=mapDragging.ox+(e.clientX-mapDragging.x)/svg.clientWidth*viewSize.width;
    mapViewport.y=mapDragging.oy+(e.clientY-mapDragging.y)/svg.clientHeight*viewSize.height;
    applyMapTransform();
  });
  function endMapPointer(e){
    if(e.pointerType==='touch') return;
    mapPointers.delete(e.pointerId);
    if(mapPointers.size===1){
      const [point]=mapPointers.values();
      mapDragging=point.interactive?null:{x:point.cx,y:point.cy,ox:mapViewport.x,oy:mapViewport.y};
    } else if(!mapPointers.size) mapDragging=null;
  }
  svg.addEventListener('pointerup',endMapPointer);
  svg.addEventListener('pointercancel',endMapPointer);

  // Mobile browsers can retarget pointer events to SVG objects during a pinch.
  // Handle native touch events separately so dots/buildings never block zoom.
  function touchCenter(touches){
    const a=touches[0],b=touches[1]||touches[0];
    return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};
  }
  function touchDistance(touches){
    if(touches.length<2) return 1;
    return Math.max(1,Math.hypot(touches[1].clientX-touches[0].clientX,touches[1].clientY-touches[0].clientY));
  }
  svg.addEventListener('touchstart',e=>{
    const center=touchCenter(e.touches);
    if(e.touches.length>=2){
      e.preventDefault();
      const p=mapPoint({clientX:center.x,clientY:center.y},svg);
      mapTouchState={mode:'pinch',center:p,distance:touchDistance(e.touches),scale:mapViewport.scale,x:mapViewport.x,y:mapViewport.y};
    } else if(e.touches.length===1){
      mapTouchState={mode:'pan',x:e.touches[0].clientX,y:e.touches[0].clientY,ox:mapViewport.x,oy:mapViewport.y};
    }
  },{passive:false});
  svg.addEventListener('touchmove',e=>{
    e.preventDefault();
    if(e.touches.length>=2){
      const center=touchCenter(e.touches), current=mapPoint({clientX:center.x,clientY:center.y},svg);
      if(!mapTouchState||mapTouchState.mode!=='pinch'){
        mapTouchState={mode:'pinch',center:current,distance:touchDistance(e.touches),scale:mapViewport.scale,x:mapViewport.x,y:mapViewport.y};
        return;
      }
      const oldScale=mapTouchState.scale;
      const newScale=clamp(oldScale*(touchDistance(e.touches)/mapTouchState.distance),MAP_ZOOM_MIN,MAP_ZOOM_MAX);
      mapViewport.scale=newScale;
      mapViewport.x=mapTouchState.center.x-(mapTouchState.center.x-mapTouchState.x)*newScale/oldScale+(current.x-mapTouchState.center.x);
      mapViewport.y=mapTouchState.center.y-(mapTouchState.center.y-mapTouchState.y)*newScale/oldScale+(current.y-mapTouchState.center.y);
      applyMapTransform();
    } else if(e.touches.length===1&&mapTouchState?.mode==='pan'){
      const t=e.touches[0];
      mapViewport.x=mapTouchState.ox+(t.clientX-mapTouchState.x)/svg.clientWidth*viewSize.width;
      mapViewport.y=mapTouchState.oy+(t.clientY-mapTouchState.y)/svg.clientHeight*viewSize.height;
      applyMapTransform();
    }
  },{passive:false});
  function endMapTouch(e){
    if(e.touches.length===0){ mapTouchState=null; return; }
    if(e.touches.length===1){
      mapTouchState={mode:'pan',x:e.touches[0].clientX,y:e.touches[0].clientY,ox:mapViewport.x,oy:mapViewport.y};
    }
  }
  svg.addEventListener('touchend',endMapTouch,{passive:false});
  svg.addEventListener('touchcancel',endMapTouch,{passive:false});
}
function openMap(){
  if(!S||!World) return; if(!World.map) World.map={discoveredSettlementIds:[World.activeSettlementId],visitedSettlementIds:[World.activeSettlementId],selectedSettlementId:World.activeSettlementId,selectedBuildingId:World.activeBuildingId,mode:'national'};
  World.map.mode='national'; World.map.selectedSettlementId=World.activeSettlementId; mapViewport={x:0,y:0,scale:1}; renderMap(); $('#mapWrap').classList.remove('hidden');
}
$('#mapWrap').addEventListener('click',e=>{
  if(e.target.id==='mapWrap'||e.target.id==='mapClose'){ $('#mapWrap').classList.add('hidden'); return; }
  const mode=e.target.closest('[data-map-mode]'); if(mode){ World.map.mode=mode.dataset.mapMode; mapViewport={x:0,y:0,scale:1}; renderMap(); return; }
  const settlement=e.target.closest('[data-map-settlement]'); if(settlement){ World.map.selectedSettlementId=settlement.dataset.mapSettlement; World.map.mode='national'; renderMap(); return; }
  const building=e.target.closest('[data-map-building]'); if(building){ World.map.selectedBuildingId=building.dataset.mapBuilding; moveWithinSettlement(building.dataset.mapBuilding); return; }
  const open=e.target.closest('[data-map-open]'); if(open){ World.map.selectedSettlementId=open.dataset.mapOpen; World.map.mode='settlement'; const s=settlementById(open.dataset.mapOpen); World.map.selectedBuildingId=s.buildings[0].id; mapViewport={x:0,y:0,scale:1}; renderMap(); return; }
  const travel=e.target.closest('[data-map-travel]'); if(travel){ const result=scheduleTravel(travel.dataset.mapTravel); if(!result.ok) openNotice({title:'Travel Denied',body:result.reason+'. The map remains open; the route does not.'}); else renderMap(); return; }
});
$('#mapWrap').addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ') return;
  const target=e.target.closest('[data-map-settlement],[data-map-building]');
  if(!target) return;
  e.preventDefault(); target.click();
});
function renderSkills(){
  const top=Object.entries(S.skills).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const cap=typeof skillCapFor==='function'?skillCapFor():10;
  $('#val-skills').textContent = top.length ? top.map(([id,v])=>SKILLS[id].icon+' '+SKILLS[id].name+' '+Math.min(v,cap)+'/'+cap).join(' · ') : 'none developed';
}
function renderEducationSummary(){
  const el=$('#val-education'); if(!el||!S) return;
  if(!S.education&&typeof ensureEducationState==='function') ensureEducationState(S);
  if(S.eduStage){
    const stage=SCHOOL_STAGES.find(x=>x.id===S.eduStage), inst=typeof institutionById==='function'?institutionById(S.education.institutionId):null;
    el.textContent=(stage?stage.name:'Enrolled')+' · year '+((S.eduYearsIn||0)+1)+'/'+(stage?stage.years:'?')+(inst?' · '+inst.name:'');
    return;
  }
  const completed=SCHOOL_STAGES.filter(st=>S.eduCompleted&&S.eduCompleted[st.id]);
  const debt=S.education?Math.round((S.education.tuitionDebt||0)+(S.education.travelDebt||0)):0;
  const next=S.pendingSchoolStage&&SCHOOL_STAGES.find(st=>st.id===S.pendingSchoolStage);
  const major=S.education&&S.education.majorId?educationMajorLabel(S.education.majorId):'';
  el.textContent=completed.length?(completed[completed.length-1].name+(major?' · '+major:'')+' completed'+(debt?' · debt '+money(debt):'')):(next?next.name+' available':'no formal record');
}
function renderIntent(){
  if(!readableYet(S)){ $('#d-intent').textContent='undetermined — too soon to tell'; return; }
  const {it}=currentIntent(S); const st=it.score(S);
  let stars=''; for(let i=0;i<5;i++) stars+= i<st?'★':'<span class="off">☆</span>';
  $('#d-intent').innerHTML=it.name+' — “'+it.scrawl+'” <span class="intent-live">'+stars+'</span>';
}
function renderDisposition(){
  const el=$('#d-disp'); if(!el) return;
  if(!readableYet(S)){ el.textContent='undetermined — too soon to tell'; return; }
  const {it}=currentDisposition(S);
  el.innerHTML=it.name+' — '+it.desc;
}
function renderYear(){
  const ds=$('#datestamp'); ds.innerHTML='<b>YEAR '+S.age+'</b><span>'+(S.dob+S.age)+'</span>';
  ds.classList.remove('stampin'); void ds.offsetWidth; ds.classList.add('stampin');
}
function evaluateYearStreak(quiet){
  const a=S.yearAccum||{};
  const wellbeingNet=(a.health||0)+(a.happiness||0)+(a.relations||0)*0.7+(a.smarts||0)*0.3+(a.looks||0)*0.3;
  const good = S.alive && wellbeingNet>=0 && S.health>=35 && S.happiness>=40;
  if(good){
    S.streak++; S.bestStreak=Math.max(S.bestStreak,S.streak);
    if(!quiet && S.streak>1) triggerStreakFx(S.streak,true);
    if(S.streak>(Achievements.meta().bestStreakEver||0)) Achievements.setMeta({bestStreakEver:S.streak});
    checkAchievements('streak');
  } else if(S.streak>0){
    S.streak=0;
    if(!quiet) triggerStreakFx(0,false);
  }
  S.yearAccum={};
  renderStreak();
}
function triggerStreakFx(n,isGrow){
  if(isGrow){
    snd('streak',n);
    if(navigator.vibrate) navigator.vibrate(Math.min(20+n*4,80));
    if(n>=3) spawnParticles(n>=10?'large':n>=6?'medium':'small',true,true);
  } else {
    snd('streaksoft');
  }
}
function renderStreak(){
  const el=$('#streakBadge'); if(!el||!S) return;
  el.classList.toggle('hidden', S.streak<2);
  if(S.streak<2) return;
  $('#streak-n').textContent=S.streak;
  el.classList.remove('tier2','tier3');
  if(S.streak>=10) el.classList.add('tier3'); else if(S.streak>=5) el.classList.add('tier2');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function renderStage(){
  const el=$('#d-stage'); if(!el||!S) return;
  el.textContent=STAGE_INFO[S.stage].name;
}
function computeHours(){
  if(S.age<6||S.jailUntil>S.age) return 0;
  let h=S.age<14?2:S.age<65?3:2;
  if(S.health>72)h++; if(S.health<30)h--;
  if(typeof medicalHoursPenalty==='function') h-=medicalHoursPenalty(S);
  return clamp(h,0,4);
}
function planHours(){ const total=computeHours(); return Math.max(0,total-(S.autoTrain&&total>=1?1:0)); }
function updateBar(){
  const total=computeHours(), h=planHours(), used=S.queue.reduce((a,q)=>a+(PUR_MAP[q.id]?PUR_MAP[q.id].cost:(DEC_MAP[q.id]?DEC_MAP[q.id].cost:0)),0);
  const rem=Math.max(0,h-used), btn=$('#btn-plan'), lab=$('#plan-label'), pips=$('#plan-pips');
  pips.innerHTML=''; for(let i=0;i<h;i++){const e=document.createElement('i'); if(i<rem)e.className='on'; pips.appendChild(e);}
  const disabled = slipOpen || total===0 || !S.alive;
  btn.classList.toggle('disabled',disabled); btn.classList.toggle('ready',!disabled);
  if(slipOpen) lab.textContent='RESOLVE SLIP FIRST';
  else if(total===0) lab.textContent=(S.jailUntil>S.age?'IN CUSTODY':'NO AGENCY YET');
  else lab.textContent='PLAN THE YEAR';
  $('#bar-micro').textContent = h===0 ? (S.jailUntil>S.age?'the subject is in custody — stamp the years':'the subject is too young to choose — stamp the years until they can') : 'plan the year, then stamp it · the record only moves forward';
}

/* ================= PLAN SHEET ================= */
function openPlan(){
  if(computeHours()===0||slipOpen||!S.alive) return;
  snd('paper'); renderPlan(); $('#planWrap').classList.remove('hidden');
}
function closePlan(){ $('#planWrap').classList.add('hidden'); }
function actionReservedThisYear(id){ return S.queue.some(q=>q.id===id)||(id==='practice'&&S.autoTrain); }
function actionReservedNote(id){ return id==='practice'&&S.autoTrain?'reserved for auto-training':'already filed this year'; }
function planActionButton(def,type,rem){
  const isP=type==='p', id=def.id, ok=def.avail(S), afford=rem>=def.cost;
  const dup=actionReservedThisYear(id);
  const cant=!ok||!afford||dup;
  const label=isP?pursuitLabel(def):decisionLabel(def);
  const note=ok?(dup?actionReservedNote(id):fillLabel(def.note(S))):(isP?'— not available this year':'— not available');
  return '<button class="slipbtn'+(def.dark?' dark':'')+(cant?' cant':'')+(dup?' queued':'')+'" data-'+type+'="'+id+'" '+(cant?'disabled':'')+'><div class="sb-top"><span class="sb-name">'+(def.icon?'<span class="sb-icon">'+def.icon+'</span> ':'')+fillLabel(label)+'</span><span class="sb-cost">'+(def.cost?def.cost+'h':'free')+'</span></div><div class="sb-note">'+note+'</div></button>';
}
function renderPlan(){
  const h=planHours(), used=S.queue.reduce((a,q)=>a+(PUR_MAP[q.id]?PUR_MAP[q.id].cost:(DEC_MAP[q.id]?DEC_MAP[q.id].cost:0)),0);
  const rem=Math.max(0,h-used);
  let qh='';
  if(S.queue.length){ S.queue.forEach((q,i)=>{const d=PUR_MAP[q.id]||DEC_MAP[q.id]; qh+='<div class="qitem">'+(d.icon?d.icon+' ':'')+(d.dark?'⚑ ':'')+fillLabel(labelOf(q))+'<button class="qx" data-rm="'+i+'">✕</button></div>';}); }
  else qh='<div class="qempty">No slips filed yet. Choose pursuits &amp; decisions below, then seal the year.</div>';
  const autoRow='<button class="autotrain-toggle'+(S.autoTrain?' on':'')+'" id="autoTrainBtn"><b>AUTO-TRAIN A SKILL</b><span>'+(S.autoTrain?'ON · 1h/year reserved, best skill auto-picked':'OFF · tap to reserve 1h/year for automatic training')+'</span></button>';
  let ph='';
  PUR_CATS.forEach(cat=>{
    if(cat.id==='hold') return;
    const items=PURSUITS.filter(p=>p.cat===cat.id); if(!items.length) return;
    let ih='';
    items.forEach(p=>{const ok=p.avail(S); const afford=rem>=p.cost;
      const dup=actionReservedThisYear(p.id); const cant=!ok||!afford||dup;
      ih+='<button class="slipbtn'+(p.dark?' dark':'')+(cant?' cant':'')+(dup?' queued':'')+'" data-p="'+p.id+'" '+(cant?'disabled':'')+'><div class="sb-top"><span class="sb-name">'+(p.icon?'<span class="sb-icon">'+p.icon+'</span> ':'')+fillLabel(pursuitLabel(p))+'</span><span class="sb-cost">'+(p.cost?p.cost+'h':'free')+'</span></div><div class="sb-note">'+(ok?(dup?actionReservedNote(p.id):fillLabel(p.note(S))):'— not available this year')+'</div></button>';});
    ph+='<div class="ps-catlab">'+cat.label+'</div><div class="sliplist">'+ih+'</div>';
  });
  let hh='';
  if(S.holdMember){
    const holdItems=PURSUITS.filter(p=>p.cat==='hold').map(p=>({def:p,type:'p'})).concat(DECISIONS.filter(d=>d.cat==='hold').map(d=>({def:d,type:'d'})));
    const holdButtons=holdItems.map(item=>planActionButton(item.def,item.type,rem)).join('');
    if(holdButtons) hh='<div class="ps-catlab">THE HOLD</div><div class="sliplist hold-action-list">'+holdButtons+'</div>';
  }
  let dh='';
  DEC_CATS.forEach(cat=>{
    if(cat.id==='hold') return;
    const items=DECISIONS.filter(d=>d.cat===cat.id); if(!items.length) return;
    let ih='';
    items.forEach(d=>{const ok=d.avail(S); const afford=rem>=d.cost; const dup=actionReservedThisYear(d.id); const cant=!ok||!afford||dup;
      ih+='<button class="slipbtn'+(d.dark?' dark':'')+(cant?' cant':'')+(dup?' queued':'')+'" data-d="'+d.id+'" '+(cant?'disabled':'')+'><div class="sb-top"><span class="sb-name">'+fillLabel(decisionLabel(d))+'</span><span class="sb-cost">'+(d.cost?d.cost+'h':'free')+'</span></div><div class="sb-note">'+(dup?actionReservedNote(d.id):(ok?fillLabel(d.note(S)):'— not available'))+'</div></button>';});
    dh+='<div class="ps-catlab">'+cat.label+'</div><div class="sliplist">'+ih+'</div>';
  });
  let ch='';
  ['subsidy','checkup','censure'].forEach(k=>{const ready=S.age>=S.desk[k]; ch+='<button class="cstamp '+(ready?'ready':'sealed')+'" data-c="'+k+'"><b>'+k.toUpperCase()+'</b><span>'+(ready?'CLERK ACT':('SEALED '+(S.desk[k]-S.age)+'Y'))+'</span></button>';});
  let lh='';
  if(S.age>=16){
    if(S.livingAtHome){
      const guardians=guardiansOf();
      const namesList=guardians.length?guardians.map(p=>p.name).join(' & '):'the family';
      lh='<div class="ps-sub"><span>LIVING SITUATION — a standing act, no hours spent</span></div>'+
        '<button class="household-tile" id="askMoveOut"><b>🏠 Living With '+namesList+'</b>'+
        '<span>Rent-free, fed at their table — for now.</span>'+
        '<i>Tap to ask about moving out on your own.</i></button>';
    } else {
      const house=currentHousing(), food=currentFood();
      const kidsLine=S.kids>0?' · '+currentChildcare().icon+' '+currentChildcare().name:'';
      lh='<div class="ps-sub"><span>HOUSEHOLD & CREDIT — a standing act, no hours spent</span></div>'+
        '<button class="household-tile" id="openHousehold"><b>🏠 Manage the Household</b>'+
        '<span>'+house.icon+' '+house.name+' · '+food.icon+' '+food.name+kidsLine+'</span>'+
        '<i>'+money(house.rent+food.cost+(S.kids>0?currentChildcare().costPerKid*S.kids:0))+'/yr before debts — tap to shop</i></button>';
    }
  }
  $('#planSheet').innerHTML=
    '<div class="ps-head"><span>SCHEDULE OF PURSUITS · FORM 7</span><span style="display:flex;align-items:center;gap:10px"><span class="hrs">'+rem+'/'+h+' HOURS '+pipsHTML(rem,h)+'</span><button class="ps-close" id="planClose" aria-label="Close">✕</button></span></div>'+
    '<div class="ps-sub"><span>THIS YEAR’S PLAN</span>'+(S.queue.length?'<button class="voidbtn" id="voidLast">VOID LAST SLIP</button>':'')+'</div>'+qh+
    lh+
    '<div class="ps-sub"><span>PURSUITS — spend the hours</span></div>'+autoRow+ph+hh+
    '<div class="ps-sub"><span>DECISIONS — the big verbs</span></div>'+dh+
    '<div class="ps-sub"><span>CLERK’S DISCRETION — your stamps, outside the subject’s year</span></div><div class="ps-clerk">'+ch+'</div>'+
    '<div class="ps-foot"><button class="btn" id="sealAdvance">Seal &amp; Advance the Year ▸</button></div>';
}
function pipsHTML(rem,h){let s='';for(let i=0;i<h;i++)s+='<i class="'+(i<rem?'on':'')+'"></i>';return s;}
function lifeToggle(items,current,dataAttr,priceFn){
  return items.map(it=>'<button class="lifebtn'+(it.id===current?' active':'')+'" data-'+dataAttr+'="'+it.id+'"><b>'+it.icon+' '+it.name+'</b><span>'+priceFn(it)+'</span>'+
    '<i class="lifedesc">'+it.desc+'</i><i class="liferisk">'+fxSummary(it.fx)+' · '+it.risk+'</i></button>').join('');
}
function labelOf(q){if(q.id==='practice'&&q.skill&&SKILLS[q.skill])return 'Practice: '+SKILLS[q.skill].name;
  if(q.id==='learntrade'&&q.program&&typeof vocationalProgramById==='function'){const program=vocationalProgramById(q.program);if(program)return 'Training: '+program.name;}
  if(q.id==='tendmember'&&q.member){const m=findHoldMember(q.member); if(m) return 'Look after: '+m.first+' '+m.last;}
  if(q.id==='lookwork'&&q.track){const t=CAREERS.find(c=>c.id===q.track); return t?'Apply: '+t.stages[q.stage].name:'Apply for work';}
  if(q.id==='gig'&&q.gig){const g=GIGS.find(x=>x.id===q.gig); if(g) return 'Off the Books: '+g.name;}
  if(q.cid&&PER_CONTACT_IDS.has(q.id)){const c=S.contacts.find(x=>x.cid===q.cid); if(c) return npcActionLabel({id:q.id,type:PUR_MAP[q.id]?'p':'d'},q.cid);}
  if(q.id==='cutcontact'&&q.cid){const c=S.contacts.find(x=>x.cid===q.cid); if(c) return 'Cut off: '+c.name;}
  if(q.id==='meetsomeone'&&q.venue){const v=MEETING_VENUES.find(x=>x.id===q.venue); if(v) return 'Meet Someone: '+v.name;}
  const d=PUR_MAP[q.id]||DEC_MAP[q.id];return (PUR_MAP[q.id]?pursuitLabel(d):decisionLabel(d));}
function pursuitLabel(p){return {study:'Hit the books',lookwork:'Look for work',overtime:'Work overtime',court:'Court {partner}',tendspouse:'Tend the marriage',family:'Visit the children',writemother:'Write to {mother}',writefather:'Write to {father}',doctor:'See the doctor',walk:'Walk it off',bottle:'The bottle',track:'The racetrack',backroom2:'The back room',rest:'Do nothing',favor:'Call in a favor',practice:'Practice a skill',tendmember:'Look after a member',gig:'Off the books',meetsomeone:'Meet someone new',flirt:'Flirt',flirtsecret:'See them, secretly',tendcontact:'Spend time together',covertracks:'Cover your tracks'}[p.id]||p.id;}
function decisionLabel(d){if(d.id==='crime'){return ['Lift a wallet','Run the numbers','Fence the goods','The big score','Lie low'][S.crime]||'Crime';}return {propose:'Propose to {partner}',trychild:'Try for a child',presspromo:'Press for promotion',learntrade:'Take vocational training',nightshift:'Take night shift',quitjob:'Quit the job',relocate:'Move to the coast',leave:'Take a year off',leaveschool:'Leave school now',loan:'Take the loan',gamblelic:'Open a gambling hall',expunge:'Expunge record',treatment:'File treatment',earlyret:'Retire early',namechange:'Change name',breakup:'End it with {partner}',divorce:'File for divorce',estrangemother:'Go no-contact with {mother}',estrangefather:'Go no-contact with {father}',recruit:'Bring someone into the fold',bankloan:'Take out a bank loan',storecredit:'Buy on store credit',payoffdebt:'Pay off a debt early',endaffair:'End it, quietly',cutcontact:'Cut them off'}[d.id]||d.id;}
function fillLabel(t){return t.replace(/\{partner\}/g,S.partner||S.__partnerNameSnapshot||'—').replace(/\{other\}/g,S.__affairName||'—').replace(/\{mother\}/g,S.mother?S.mother.name:'—').replace(/\{father\}/g,S.father?S.father.name:'—');}
let pressTimer=null, longPressActive=false, pressedBtn=null;
function startPress(btn){ pressedBtn=btn; longPressActive=false; clearTimeout(pressTimer); pressTimer=setTimeout(()=>{ longPressActive=true; btn.classList.add('show-note'); },380); }
function endPress(){ clearTimeout(pressTimer); if(pressedBtn) pressedBtn.classList.remove('show-note'); pressedBtn=null; }
$('#planSheet').addEventListener('pointerdown',e=>{ const btn=e.target.closest('.slipbtn'); if(btn) startPress(btn); });
$('#planSheet').addEventListener('pointerup',()=>{ endPress(); });
$('#planSheet').addEventListener('pointercancel',()=>{ endPress(); });
$('#planSheet').addEventListener('click',e=>{
  if(longPressActive){ longPressActive=false; return; }
  if(e.target.closest('#planClose')){ closePlan(); return; }
  if(e.target.closest('#autoTrainBtn')){
    if(!S.autoTrain&&S.queue.some(q=>q.id==='practice')){ shake(); return; }
    S.autoTrain=!S.autoTrain; snd('stamp'); renderPlan(); updateBar(); return;
  }
  const rm=e.target.closest('[data-rm]'); if(rm){S.queue.splice(+rm.dataset.rm,1);snd('paper');renderPlan();updateBar();return;}
  const pb=e.target.closest('[data-p]'); if(pb&&!pb.classList.contains('cant')){ triggerAction('p',pb.dataset.p); return; }
  const db=e.target.closest('[data-d]'); if(db&&!db.classList.contains('cant')){ triggerAction('d',db.dataset.d); return; }
  const cb=e.target.closest('[data-c]'); if(cb&&cb.classList.contains('ready')){deskAction(cb.dataset.c);renderPlan();return;}
  if(e.target.closest('#openHousehold')){ snd('paper'); openHousehold(); return; }
  if(e.target.closest('#askMoveOut')){ snd('paper'); closePlan(); openLivingDilemma('leave-request'); return; }
  if(e.target.id==='voidLast'){S.queue.pop();snd('paper');renderPlan();updateBar();return;}
  if(e.target.id==='sealAdvance'){closePlan();advance();return;}
});
function queueAdd(type,id,extra){
  const d=type==='p'?PUR_MAP[id]:DEC_MAP[id]; if(!d) return;
  if(actionReservedThisYear(id)){ shake(); return; }
  const h=planHours(), used=S.queue.reduce((a,q)=>a+(PUR_MAP[q.id]?PUR_MAP[q.id].cost:(DEC_MAP[q.id]?DEC_MAP[q.id].cost:0)),0);
  if(used+d.cost>h){shake();return;}
  S.queue.push(Object.assign({id,type},extra||{})); snd('stamp'); renderPlan(); updateBar();
}
function triggerAction(type,id,extra){
  if(actionReservedThisYear(id)){ shake(); return; }
  if(type==='p'){
    if(id==='practice'){openSkillPick();return;}
    if(id==='tendmember'){openMemberPick();return;}
    if(id==='lookwork'){openJobPortal();return;}
    if(id==='gig'){openGigPicker();return;}
    if(id==='meetsomeone'){openMeetPicker();return;}
    queueAdd('p',id,extra);
  } else {
    if(id==='learntrade'){openTrainingPicker();return;}
    if(id==='treatment'){openMedicalTreatmentPicker();return;}
    queueAdd('d',id,extra);
  }
}
const PER_CONTACT_IDS=new Set(['flirt','flirtsecret','tendcontact','covertracks']);
function candidateActions(fieldKey,cid){
  const ids=FIELD_ACTIONS[fieldKey]||[];
  const h=planHours(), used=S.queue.reduce((a,q)=>a+(PUR_MAP[q.id]?PUR_MAP[q.id].cost:(DEC_MAP[q.id]?DEC_MAP[q.id].cost:0)),0);
  const rem=Math.max(0,h-used);
  const out=[];
  ids.forEach(id=>{
    const p=PUR_MAP[id], d=!p?DEC_MAP[id]:null, def=p||d; if(!def) return;
    if(!def.avail(S,cid)) return;
    if(def.cost>rem) return;
    const dup=actionReservedThisYear(id);
    if(dup) return;
    out.push({id,type:p?'p':'d',def});
  });
  return out;
}
function npcActionLabel(a,cid){
  const c=S.contacts.find(x=>x.cid===cid);
  const name=c?c.name.split(' ')[0]:'them';
  const map={flirt:'Flirt with '+name,flirtsecret:'See '+name+', secretly',tendcontact:'Spend time with '+name,
    covertracks:'Cover tracks — '+name,cutcontact:'Cut off '+name,endaffair:'End it with '+name};
  return map[a.id]||(a.type==='p'?pursuitLabel(a.def):decisionLabel(a.def));
}
let bubbleOpenField=null;
function positionBubble(el,x,y){
  el.style.left='-9999px'; el.style.top='-9999px';
  const rect=el.getBoundingClientRect();
  const vw=window.innerWidth, vh=window.innerHeight;
  let left=x+10, top=y+10;
  if(left+rect.width>vw-8) left=Math.max(8,x-rect.width-10);
  if(top+rect.height>vh-8) top=Math.max(8,y-rect.height-10);
  el.style.left=left+'px'; el.style.top=top+'px';
}
function smartsTipHTML(){
  const mult=skillSpeedMult(S.smarts), pct=Math.round(mult*100);
  const tiers=[{lo:0,hi:3,label:'Novice (0–3)'},{lo:4,hi:7,label:'Developing (4–7)'},{lo:8,hi:9,label:'Advanced (8–9)'}];
  let rows=tiers.map(t=>'<div class="st-row"><span>'+t.label+'</span><b>+'+skillGainFor(t.lo)+' lvl/yr</b></div>').join('');
  return '<div class="st-h">SMARTS '+S.smarts+' — SKILL LEARNING SPEED '+pct+'%</div>'+rows+
    '<div class="st-note">Higher SMARTS speeds up practice on every skill — study or train it up to learn faster.</div>';
}
function parentInfoHTML(which){
  const p=S[which]; if(!p) return '';
  const label=which==='mother'?'MOTHER':'FATHER';
  if(!p.alive) return '<div class="hs-info"><b>'+label+' — '+sexSym(which==='mother'?'F':'M')+p.name+'</b><div class="hs-info-row"><i>deceased</i></div></div>';
  const sk=SKILLS[p.skill];
  const tier=guardTier(), gi=GUARD_INFO[tier];
  return '<div class="hs-info"><b>'+label+' — '+sexSym(which==='mother'?'F':'M')+p.name+'</b>'+
    '<div class="hs-info-row">'+warmthLabel(p.warmth)+' · '+stabilityLabel(p.stability)+'</div>'+
    (S.age>=14&&S.livingAtHome?'<div class="hs-info-row">On letting you go: '+gripLabel(p.grip)+'</div>':'')+
    (sk?'<div class="hs-info-row">'+sk.icon+' knows '+sk.name.toLowerCase()+' well (level '+p.skillLvl+'/10)</div>':'')+
    (p.present===false?'<div class="hs-info-row">Not really in the picture — present on paper, absent in practice.</div>':'')+
    '<div class="hs-info-tier">'+gi.label+' — '+gi.line+'</div></div>';
}
function contactInfoHTML(cid){
  const c=S.contacts.find(x=>x.cid===cid); if(!c) return '';
  const roleLabel={friend:'CONTACT',partner:'PARTNER',spouse:'SPOUSE',ex:'FORMER TIE'}[c.role]||'CONTACT';
  const maritalLine = (c.role==='partner'||c.role==='spouse') ? '' :
    (c.npcMarried ? 'Already spoken for — married to '+c.npcSpouseName+', as far as anyone can tell.' : 'Unattached, as far as anyone knows.');
  return '<div class="hs-info"><b>'+roleLabel+' — '+sexSym(c.sex)+c.name+'</b>'+
    '<div class="hs-info-row">'+kindnessLabel(c.kindness)+' · '+intellectLabel(c.intellect)+'</div>'+
    '<div class="hs-info-row">'+fidelityLabel(c.fidelity)+' · '+temperamentLabel(c.temperament)+'</div>'+
    '<div class="hs-info-row">'+charmLabel(c.charm)+'</div>'+
    (maritalLine?'<div class="hs-info-row">'+maritalLine+'</div>':'')+
    '</div>';
}
function openHotspotBubble(fieldKey,x,y){
  const isNpc=fieldKey.startsWith('npc-');
  const cid=isNpc?fieldKey.slice(4):null;
  const acts=candidateActions(isNpc?'npc':fieldKey,cid);
  const wrap=$('#hotspotBubble'); if(!wrap) return;
  let html='';
  if(fieldKey==='mother'||fieldKey==='father') html+=parentInfoHTML(fieldKey);
  if(isNpc) html+=contactInfoHTML(cid);
  else if(fieldKey==='partner'){ const p=activePartnerContact(); if(p) html+=contactInfoHTML(p.cid); }
  if(fieldKey==='smarts') html+='<button class="hs-chip hs-infobtn" data-hs-info="smarts">📊 <span class="hs-label">Skill Learning Speed</span></button><div class="hs-infopanel hidden"></div>';
  if(fieldKey==='job') html+=schoolInfoHTML();
  if(!acts.length){ html+='<div class="hs-empty">Nothing to do here right now.</div>'; }
  else { acts.forEach(a=>{ const label=isNpc?npcActionLabel(a,cid):(a.type==='p'?pursuitLabel(a.def):decisionLabel(a.def));
    html+='<button class="hs-chip" data-hs-type="'+a.type+'" data-hs-id="'+a.id+'"'+(cid?' data-hs-cid="'+cid+'"':'')+'>'+(a.def.icon?'<span class="hs-icon">'+a.def.icon+'</span>':'')+'<span class="hs-label">'+fillLabel(label)+'</span><span class="hs-cost">'+(a.def.cost?a.def.cost+'h':'free')+'</span></button>'; }); }
  wrap.innerHTML=html;
  wrap.classList.remove('hidden','popping');
  positionBubble(wrap,x,y);
  wrap.querySelectorAll('.hs-chip').forEach(btn=>btn.addEventListener('pointerenter',()=>snd('bubblehover')));
  bubbleOpenField=fieldKey;
}
function closeHotspotBubble(withPop){
  const wrap=$('#hotspotBubble'); if(!wrap||wrap.classList.contains('hidden')) return;
  bubbleOpenField=null;
  if(withPop){ snd('bubblepop'); wrap.classList.add('popping'); setTimeout(()=>{ wrap.classList.add('hidden'); wrap.classList.remove('popping'); },140); }
  else { wrap.classList.add('hidden'); }
}
document.addEventListener('click',e=>{
  const wrap=$('#hotspotBubble'); if(!wrap) return;
  const infoBtn=e.target.closest('[data-hs-info]');
  if(infoBtn&&!wrap.classList.contains('hidden')){
    const panel=wrap.querySelector('.hs-infopanel');
    if(panel){ const show=panel.classList.contains('hidden'); panel.classList.toggle('hidden'); if(show) panel.innerHTML=smartsTipHTML(); }
    return;
  }
  const chip=e.target.closest('.hs-chip');
  if(chip&&!chip.hasAttribute('data-hs-info')&&!wrap.classList.contains('hidden')){ triggerAction(chip.dataset.hsType,chip.dataset.hsId,chip.dataset.hsCid?{cid:chip.dataset.hsCid}:undefined); closeHotspotBubble(false); return; }
  const hotspot=e.target.closest('.hotspot');
  if(hotspot){
    if(!S||!S.alive||slipOpen) return;
    const key=hotspot.dataset.hotspot;
    if(key==='health'){ closeHotspotBubble(false); openMedicalFile(); return; }
    if(key==='job'){
      if(S.career){ closeHotspotBubble(false); openJobDetail(S.career); return; }
      if(S.jobTier>0&&S.jailUntil<=S.age){ closeHotspotBubble(false); openGenericJobLadder(); return; }
      if(!S.eduStage&&S.age>=16&&S.jailUntil<=S.age){ closeHotspotBubble(false); openJobPortal(); return; }
    }
    if(key==='education'){ closeHotspotBubble(false); openEducationDossier(); return; }
    if(key==='housing'){ closeHotspotBubble(false); openHousehold('housing'); return; }
    if(key==='food'){ closeHotspotBubble(false); openHousehold('food'); return; }
    if(bubbleOpenField===key){ closeHotspotBubble(true); return; }
    openHotspotBubble(key,e.clientX,e.clientY);
    return;
  }
  if(!wrap.classList.contains('hidden')) closeHotspotBubble(true);
});
function openSkillPick(){
  let ih='';
  const cap=typeof skillCapFor==='function'?skillCapFor():10;
  Object.entries(SKILLS).forEach(([id,sk])=>{
    const tooYoung=S.age<sk.minAge;
    const queued=actionReservedThisYear('practice');
    const lvl=Math.min(cap,S.skills[id]||0);
    const atCap=lvl>=cap;
    const locked=tooYoung||queued||atCap;
    const cur=lvl>0?sk.tiers[lvl-1]:null;
    const next=lvl<cap?sk.tiers[lvl]:null;
    let sub;
    if(queued) sub=actionReservedNote('practice');
    else if(tooYoung) sub='unlocks at age '+sk.minAge;
    else if(atCap) sub='education ceiling reached · '+cap+'/10 · continue schooling to unlock more';
    else sub=(cur?'now: '+cur+' · ':'')+(next?'next: '+next:'mastered');
    const fxLine='Trains: '+fxSummary(SKILL_PRACTICE_FX[id]);
    ih+='<div class="arow clickable'+(locked?' locked':'')+'" data-skill-row="'+id+'">'+
      '<div class="ar-grade">'+sk.icon+'</div><div style="flex:1"><div class="ar-name">'+sk.name+' · '+lvl+'/'+cap+' (max 10)</div><div class="ar-meta">'+sub+'</div><div class="ar-meta">'+fxLine+'</div></div>'+
      (locked?'':'<button class="btn small" data-skill="'+id+'">Train ▸</button>')+
      '</div>';
  });
  $('#skillSheet').innerHTML='<div class="ps-head"><span>CHOOSE A SKILL TO PRACTICE</span></div>'+
    '<div class="aempty" style="margin:6px 2px 10px">Ten skills, ten bars each. Each bar opens a little more of what the subject can do. Tap a skill for the full breakdown.</div>'+
    '<div style="margin:0 2px">'+ih+'</div>'+
    '<div class="ps-foot"><button class="btn" id="skillCancel">Never Mind ▸</button></div>';
  $('#skillSheet').onclick=e=>{
    const sb=e.target.closest('[data-skill]'); if(sb){queueAdd('p','practice',{skill:sb.dataset.skill}); $('#skillWrap').classList.add('hidden'); return;}
    if(e.target.id==='skillCancel'){$('#skillWrap').classList.add('hidden');}
    const row=e.target.closest('[data-skill-row]'); if(row){openSkillDetail(row.dataset.skillRow);return;}
  };
  $('#skillWrap').classList.remove('hidden');
}
function openSkillDetail(skillId){
  const sk=SKILLS[skillId]; if(!sk) return;
  const lvl=S.skills[skillId]||0;
  const cap=typeof skillCapFor==='function'?skillCapFor():10;
  const tooYoung=S.age<sk.minAge;
  const queued=actionReservedThisYear('practice');
  const fx=SKILL_PRACTICE_FX[skillId]||{happiness:1};
  const canTrain=!tooYoung&&!queued&&lvl<cap;
  const statusLine=tooYoung?'Unlocks at age '+sk.minAge+'.':queued?actionReservedNote('practice')+'.':lvl>=cap?(cap>=10?'Mastered — bar 10 of 10.':'Education ceiling reached at '+cap+'/10. Continue schooling to unlock the next bars.'):'Each year practiced advances this skill toward its current education ceiling, paced by SMARTS.';
  let rows='';
  sk.tiers.forEach((tier,idx)=>{
    const tierLvl=idx+1, reached=lvl>=tierLvl, isNext=lvl===idx&&tierLvl<=cap, aboveCap=tierLvl>cap;
    const tag=reached?'<span class="ar-tag current">REACHED</span>':isNext?'<span class="ar-tag open">NEXT</span>':'';
    rows+='<div class="arow'+(reached?'': ' locked')+'"><div class="ar-grade">'+tierLvl+'</div>'+
      '<div style="flex:1"><div class="ar-name">Bar '+tierLvl+' '+tag+(aboveCap?' <span class="ar-tag">EDUCATION LOCK</span>':'')+'</div><div class="ar-meta">'+tier+'</div></div></div>';
  });
  $('#jobDetailSheet').innerHTML='<div class="ps-head"><span>'+sk.icon+' '+sk.name.toUpperCase()+'</span><span>'+lvl+'/'+cap+' · ceiling '+cap+'/10</span></div>'+
    '<div class="aempty" style="margin:6px 2px 8px">'+statusLine+'</div>'+
    '<div class="ps-catlab">EACH YEAR PRACTICED, THIS SKILL ALSO TRAINS</div>'+
    '<div class="aempty" style="margin:0 2px 12px;font-weight:600">'+fxSummary(fx)+'</div>'+
    '<div class="ps-catlab">THE TEN BARS</div>'+
    '<div style="margin:4px 2px 0">'+rows+'</div>'+
    '<div class="ps-foot">'+(canTrain?'<button class="btn" style="margin-bottom:8px" data-train="'+skillId+'">Train This Year ▸</button>':'')+'<button class="btn" id="skillDetailClose">Close ▸</button></div>';
  $('#jobDetailSheet').onclick=e=>{
    const b=e.target.closest('[data-train]'); if(b){queueAdd('p','practice',{skill:b.dataset.train}); $('#jobDetailWrap').classList.add('hidden'); $('#skillWrap').classList.add('hidden'); return;}
    if(e.target.id==='skillDetailClose'){$('#jobDetailWrap').classList.add('hidden');}
  };
  $('#jobDetailWrap').classList.remove('hidden');
}
function openTrainingPicker(){
  const programs=typeof educationProgramOptions==='function'?educationProgramOptions():[];
  let body='';
  if(programs.length){
    body=programs.map(program=>'<button class="household-tile" data-training="'+program.id+'"><b>TRAIN '+program.name+'</b><span>'+program.desc+'</span><i>'+money(program.tuition)+' / course · +'+program.gain+' '+SKILLS[program.skill].name+' · '+program.minAge+'+ · requires '+SCHOOL_STAGES.find(st=>st.id===program.requires).name+'</i></button>').join('');
  }else{
    body='<div class="aempty">No vocational course is currently available. Complete the listed school stage, reach the required age, or finish an existing certificate first.</div>';
  }
  $('#skillSheet').innerHTML='<div class="ps-head"><span>VOCATIONAL TRAINING</span><span>DECISION · 2 HOURS</span></div>'+
    '<div class="aempty" style="margin:6px 2px 10px">Short credentials turn practical skills into a clearer route through care, trade, transport, and business. The fee is paid from assets first; any shortfall becomes education debt.</div>'+body+
    '<div class="ps-foot"><button class="btn" id="trainingCancel">Never Mind â–¸</button></div>';
  $('#skillSheet').onclick=e=>{
    const b=e.target.closest('[data-training]');
    if(b){queueAdd('d','learntrade',{program:b.dataset.training});$('#skillWrap').classList.add('hidden');return;}
    if(e.target.id==='trainingCancel')$('#skillWrap').classList.add('hidden');
  };
  $('#skillWrap').classList.remove('hidden');
}
function primarySkillOf(track){ return Object.keys(track.stages[0].req)[0]; }
function reqLine(req){ return Object.keys(req).map(k=>SKILLS[k].icon+' '+SKILLS[k].name+' '+req[k]+'/10').join(' · '); }
function careerEducationRequirementHTML(track,stageIdx){
  const requiredEdu=typeof educationCareerEducationRequirement==='function'?educationCareerEducationRequirement(track,stageIdx):track.minEdu;
  const schoolOk=!requiredEdu||eduRank()>=EDU_RANK[requiredEdu];
  const major=typeof educationCareerRequirement==='function'?educationCareerRequirement(track,stageIdx):'';
  const majorOk=typeof educationCareerMajorAllowed==='function'?educationCareerMajorAllowed(track,stageIdx):true;
  let text='',ok=true;
  if(major){ text='Specific degree: '+major; ok=majorOk; }
  else if(requiredEdu==='university'){ text='Any university degree accepted'; ok=schoolOk; }
  else if(requiredEdu){ text=SCHOOL_STAGES.find(x=>x.id===requiredEdu).name+' completed (higher degrees accepted)'; ok=schoolOk; }
  else { text='No formal education requirement'; }
  return '<div class="reqrow"><span class="'+(ok?'reqok':'reqno')+'">🎓 '+text+'</span></div>';
}
function openJobPortal(){
  let rows='';
  CAREERS.forEach(track=>{
    const v=S.vacancies.find(x=>x.track===track.id);
    const sk=SKILLS[primarySkillOf(track)];
    const advantage=typeof educationCareerAdvantage==='function'?educationCareerAdvantage(track):{kind:'none',label:''};
    if(!v||v.stage<0){
      const qualifies=careerStageQualifies(track,0);
      const requiredEdu=typeof educationCareerEducationRequirement==='function'?educationCareerEducationRequirement(track,0):track.minEdu;
      const eduBlocked=!qualifies&&requiredEdu&&eduRank()<EDU_RANK[requiredEdu];
      const majorBlocked=!qualifies&&typeof educationCareerMajorAllowed==='function'&&!educationCareerMajorAllowed(track,0);
      const sub=qualifies?'You qualify for this track — just no opening this year.'+(advantage.kind!=='none'?' · '+advantage.label:''):
        majorBlocked?'Requires specific degree: '+educationCareerRequirement(track,0)+'.':
        eduBlocked?'Requires: '+SCHOOL_STAGES.find(x=>x.id===requiredEdu).name+' completed.':
        sk.icon+' '+sk.name+'-led · requirements not met yet.';
      rows+='<div class="arow locked'+(qualifies?' qualified':'')+' clickable" data-track-row="'+track.id+'"><div class="ar-grade">'+track.icon+'</div><div style="flex:1"><div class="ar-name">'+track.name+'</div><div class="ar-meta">'+sub+'</div></div><div class="ar-chev">VIEW LADDER ›</div></div>';
    } else {
      const st=track.stages[v.stage];
      rows+='<div class="arow clickable" data-track-row="'+track.id+'"><div class="ar-grade">'+track.icon+'</div><div style="flex:1"><div class="ar-name">'+st.name+'</div>'+
        '<div class="ar-meta">'+track.name+' · '+reqLine(st.req)+' · '+money(st.salary)+'/yr'+(advantage.kind!=='none'?' · '+advantage.label:'')+'</div></div>'+
        '<button class="btn small" data-apply data-track="'+track.id+'" data-stage="'+v.stage+'">Apply ▸</button></div>';
    }
  });
  $('#jobSheet').innerHTML='<div class="ps-head"><span>THIS YEAR’S OPENINGS</span><span>FORM W-2</span></div>'+
    '<div class="aempty" style="margin:6px 2px 10px">Tap a career for the full ladder — stages, skills needed, and pay at each rung. Top rungs call for several skills at once, and years served below them.</div>'+
    '<div style="margin:10px 2px">'+rows+'</div>'+
    '<div class="ps-sub"><span>OR — SKIP THE LADDER ENTIRELY</span></div>'+
    '<button class="household-tile" id="openGigs"><b>🕶 Off the Books</b><span>Nasty, unlicensed, paid in cash — maybe</span><i>No résumé required. Just nerve.</i></button>'+
    '<div class="ps-foot"><button class="btn" id="jobCancel">Keep Looking ▸</button></div>';
  $('#jobSheet').onclick=e=>{
    const b=e.target.closest('[data-apply]'); if(b){ queueAdd('p','lookwork',{track:b.dataset.track,stage:+b.dataset.stage}); $('#jobWrap').classList.add('hidden'); return; }
    if(e.target.id==='jobCancel'){ $('#jobWrap').classList.add('hidden'); return; }
    if(e.target.closest('#openGigs')){ $('#jobWrap').classList.add('hidden'); openGigPicker(); return; }
    const row=e.target.closest('[data-track-row]'); if(row){ openJobDetail(row.dataset.trackRow); }
  };
  $('#jobWrap').classList.remove('hidden');
}
function gigStatusLine(g){
  if(!g.req(S)) return g.reqLabel;
  return money(g.pay[0])+'–'+money(g.pay[1])+' · '+P(g.scam)+' scam risk · '+g.blurb;
}
function openGigPicker(){
  let ch='';
  GIG_CATS.forEach(cat=>{
    const items=GIGS.filter(g=>g.cat===cat.id); if(!items.length) return;
    let ih='';
    items.forEach(g=>{
      const locked=!g.req(S);
      const queued=actionReservedThisYear('gig');
      const dis=locked||queued;
      ih+='<button class="chipbtn'+(dis?' locked':'')+'" '+(dis?'disabled':'data-gig="'+g.id+'"')+'><b>'+g.icon+' '+g.name+'</b><span>'+(queued?'already filed this year':gigStatusLine(g))+'</span></button>';
    });
    ch+='<div class="ps-catlab">'+cat.label+'</div><div class="chips">'+ih+'</div>';
  });
  $('#skillSheet').innerHTML='<div class="ps-head"><span>OFF THE BOOKS — NO QUESTIONS ASKED</span></div>'+
    '<div class="aempty" style="margin:6px 2px 10px">No license, no ledger, no guarantee of payment. The Bureau does not recognize any of this as employment — and will not help if it goes wrong.</div>'+
    ch+
    '<div class="ps-foot"><button class="btn" id="skillCancel">Never Mind ▸</button></div>';
  $('#skillSheet').onclick=e=>{
    const gb=e.target.closest('[data-gig]'); if(gb){queueAdd('p','gig',{gig:gb.dataset.gig}); $('#skillWrap').classList.add('hidden'); return;}
    if(e.target.id==='skillCancel'){$('#skillWrap').classList.add('hidden');}
  };
  $('#skillWrap').classList.remove('hidden');
}
function openMeetPicker(){
  let ch='';
  MEETING_VENUES.forEach(v=>{
    const locked=!v.req(S)||S.contacts.length>=MAX_CONTACTS;
    const queued=actionReservedThisYear('meetsomeone');
    const dis=locked||queued;
    const sub=queued?'already filed this year':(S.contacts.length>=MAX_CONTACTS?'your circle is full — tend or cut someone loose first':meetVenueStatusLine(v));
    ch+='<button class="chipbtn'+(dis?' locked':'')+'" '+(dis?'disabled':'data-venue="'+v.id+'"')+'><b>'+v.icon+' '+v.name+'</b><span>'+sub+'</span></button>';
  });
  $('#skillSheet').innerHTML='<div class="ps-head"><span>MEET SOMEONE NEW — CHOOSE HOW</span></div>'+
    '<div class="aempty" style="margin:6px 2px 10px">Different rooms, different people. Some cost a little, or a lot; some pay, if you don’t mind who’s buying.</div>'+
    '<div class="chips">'+ch+'</div>'+
    '<div class="ps-foot"><button class="btn" id="skillCancel">Never Mind ▸</button></div>';
  $('#skillSheet').onclick=e=>{
    const vb=e.target.closest('[data-venue]'); if(vb){queueAdd('p','meetsomeone',{venue:vb.dataset.venue}); $('#skillWrap').classList.add('hidden'); return;}
    if(e.target.id==='skillCancel'){$('#skillWrap').classList.add('hidden');}
  };
  $('#skillWrap').classList.remove('hidden');
}
function openJobDetail(trackId){
  const track=CAREERS.find(c=>c.id===trackId); if(!track) return;
  const careerAdvantage=typeof educationCareerAdvantage==='function'?educationCareerAdvantage(track):{kind:'none',label:'No degree-specific advantage'};
  const v=S.vacancies.find(x=>x.track===trackId);
  const openStage=(v&&v.stage>=0)?v.stage:-1;
  let rows='';
  track.stages.forEach((st,idx)=>{
    const minAge=TIER_MINAGE[idx+1], expYears=idx>0?(typeof careerYearsRequired==='function'?careerYearsRequired(track,idx):CAREER_EXP[idx-1]):0;
    const isCurrent=S.career===trackId && S.jobTier===idx+1;
    const requiredEdu=typeof educationCareerEducationRequirement==='function'?educationCareerEducationRequirement(track,idx):track.minEdu;
    const eduOk=!requiredEdu||eduRank()>=EDU_RANK[requiredEdu];
    const majorOk=typeof educationCareerMajorAllowed==='function'?educationCareerMajorAllowed(track,idx):true;
    const qualifies=eduOk && majorOk && S.age>=minAge && Object.keys(st.req).every(k=>(S.skills[k]||0)>=st.req[k]);
    const isOpen=openStage===idx;
    const tag=isCurrent?'<span class="ar-tag current">YOUR STAGE</span>':isOpen?'<span class="ar-tag open">OPEN NOW</span>':'';
    const eduRow=careerEducationRequirementHTML(track,idx);
    const reqParts=eduRow+Object.keys(st.req).map(k=>{const have=S.skills[k]||0,need=st.req[k],ok=have>=need,pct=Math.min(100,Math.round(have/need*100));
      return '<div class="reqrow"><span class="'+(ok?'reqok':'reqno')+'">'+SKILLS[k].icon+' '+SKILLS[k].name+' '+have+'/'+need+'</span>'+
        '<div class="sbar mini"><div class="sfill" style="width:'+pct+'%;background:'+(ok?'var(--green)':'var(--blue)')+'"></div></div></div>';}).join('');
    rows+='<div class="arow'+(qualifies?'':' locked')+'"><div class="ar-grade">'+(idx+1)+'</div>'+
      '<div style="flex:1"><div class="ar-name">'+st.name+' '+tag+'</div>'+
      '<div class="ar-meta">'+money(st.salary)+'/yr · age '+minAge+'+'+(idx>0?' · '+expYears+'y served in prior stage':'')+'</div>'+
      '<div class="ar-meta">'+reqParts+(S.age<minAge?' · too young yet':'')+'</div></div>'+
      (isOpen?'<button class="btn small" data-apply data-track="'+trackId+'" data-stage="'+idx+'">Apply ▸</button>':'')+
      '</div>';
  });
  $('#jobDetailSheet').innerHTML='<div class="ps-head"><span>'+track.icon+' '+track.name.toUpperCase()+'</span><span>CAREER LADDER</span></div>'+
    '<div class="aempty" style="margin:6px 2px 12px">'+(typeof CAREER_PATH_LABELS!=='undefined'&&CAREER_PATH_LABELS[track.id]?CAREER_PATH_LABELS[track.id]+'. ':'')+(careerAdvantage.kind!=='none'?careerAdvantage.label+' · improves hiring and progression. ':'')+'Each rung states its education rule: no degree, a general degree, or a specific major. Higher rungs also call for more skill and years served below.</div>'+
    '<div style="margin:0 2px">'+rows+'</div>'+
    '<div class="ps-foot"><button class="btn" id="jobDetailClose">Close ▸</button></div>';
  $('#jobDetailSheet').onclick=e=>{
    const b=e.target.closest('[data-apply]'); if(b){ queueAdd('p','lookwork',{track:b.dataset.track,stage:+b.dataset.stage}); $('#jobDetailWrap').classList.add('hidden'); $('#jobWrap').classList.add('hidden'); return; }
    if(e.target.id==='jobDetailClose'){ $('#jobDetailWrap').classList.add('hidden'); }
  };
  $('#jobDetailWrap').classList.remove('hidden');
}
function openEducationDossier(){
  if(typeof ensureEducationState==='function') ensureEducationState(S);
  const e=S.education, active=e.stageId&&SCHOOL_STAGES.find(x=>x.id===e.stageId), inst=typeof institutionById==='function'?institutionById(e.institutionId):null;
  const completed=SCHOOL_STAGES.filter(st=>e.completed&&e.completed[st.id]);
  const certificates=Object.values(e.certificates||{});
  const nextStage=SCHOOL_STAGES.find(st=>!e.completed[st.id]&&S.age<=st.endAge);
  const debt=(e.tuitionDebt||0)+(e.travelDebt||0);
  const transcript=completed.length?completed.map(st=>'<div class="arow"><div class="ar-grade">✓</div><div style="flex:1"><div class="ar-name">'+st.name+'</div><div class="ar-meta">completed</div></div></div>').join(''):'<div class="aempty">No school completion is on file yet.</div>';
  const activeBlock=active?'<div class="aempty" style="margin:8px 2px">Currently enrolled: <b>'+active.name+'</b> · year '+((S.eduYearsIn||0)+1)+'/'+active.years+(inst?' · '+inst.name:'')+'<br>'+educationTrainingLabel(active,inst,e.majorId)+'<br>Attendance '+(e.attendance==null?100:e.attendance)+'% · performance '+(e.performance==null?50:e.performance)+'<br>Funding: '+educationFundingLabel(inst,e.funding)+'<br>Residence: '+(e.residenceMode||S.residenceMode||'not recorded')+'</div>':'';
  const educationStatus=active?'IN STUDY / '+active.name.toUpperCase():(completed.length?'LAST COMPLETED / '+completed[completed.length-1].name.toUpperCase():'NO FORMAL RECORD');
  const nextMove=active?'Continue the current course.':nextStage?'Next possible route: '+nextStage.name+'.':'No standard school stage remains in the current age window.';
  const certificateBlock=certificates.length?certificates.map(item=>'<div class="arow"><div class="ar-grade">CERT</div><div style="flex:1"><div class="ar-name">'+item.name+'</div><div class="ar-meta">'+item.year+' · '+(CAREERS.find(t=>t.id===item.career)?.name||item.career)+' route</div></div></div>').join(''):'<div class="aempty">No vocational certificates are on file.</div>';
  const trainingAction=typeof educationProgramOptions==='function'&&educationProgramOptions().length?'<button class="household-tile" data-ed-training="1"><b>OPEN VOCATIONAL TRAINING</b><span>Short credentials can strengthen care, trade, transport, or business routes.</span><i>Compare available courses and their fees.</i></button>':'';
  const majorDef=e.majorId&&MAJORS[e.majorId];
  const majorBlock=majorDef?'<div class="aempty" style="margin:8px 2px"><b>Degree major:</b> '+educationMajorLabel(e.majorId)+' · specialist paths: '+(majorDef.careers||[]).map(id=>{const t=CAREERS.find(c=>c.id===id);return t?t.name:id;}).join(', ')+'</div>':'';
  const skillRows=Object.entries(SKILLS).filter(([id])=>(S.skills[id]||0)>0||educationSkillFloor(id)>0).map(([id,skill])=>{
    const level=S.skills[id]||0,floor=educationSkillFloor(id),safe=floor?' · certified floor '+floor:'/10';
    return '<div class="arow"><div class="ar-grade">'+skill.icon+'</div><div style="flex:1"><div class="ar-name">'+skill.name+' '+level+'/10</div><div class="ar-meta">'+(floor?'School-trained'+safe:'No education protection')+'</div></div></div>';
  }).join('')||'<div class="aempty">No skills have been recorded.</div>';
  $('#educationSheet').innerHTML='<div class="ps-head"><span>EDUCATION & CAREER DOSSIER</span><span>FORM 3</span></div>'+
    '<div class="aempty" style="margin:6px 2px 10px"><b>'+educationStatus+'</b> · '+nextMove+(debt?'<br>Education debt on record: '+money(debt):'')+'</div>'+
    '<div class="ps-sub"><span>TRANSCRIPT</span></div>'+transcript+activeBlock+majorBlock+
    '<div class="ps-sub"><span>VOCATIONAL CREDENTIALS</span></div>'+certificateBlock+trainingAction+
    '<div class="ps-sub"><span>SKILLS & CERTIFIED KNOWLEDGE</span></div>'+skillRows+
    '<div class="ps-foot"><button class="btn" id="educationClose">Close ▸</button></div>';
  $('#educationSheet').onclick=e=>{if(e.target.closest('[data-ed-training]')){$('#educationWrap').classList.add('hidden');openTrainingPicker();return;} if(e.target.id==='educationClose')$('#educationWrap').classList.add('hidden');};
  $('#educationWrap').classList.remove('hidden');
  $('#educationSheet').scrollTop=0;
}
function openGenericJobLadder(){
  let rows='';
  for(let t=1;t<=5;t++){
    const isCurrent=S.jobTier===t;
    const examples=jobsForTier(t).map(j=>j.name).slice(0,3).join(', ')+(jobsForTier(t).length>3?'…':'');
    const minAge=TIER_MINAGE[t];
    const tag=isCurrent?'<span class="ar-tag current">YOUR STAGE</span>':'';
    rows+='<div class="arow'+(S.age<minAge?' locked':'')+'"><div class="ar-grade">'+t+'</div>'+
      '<div style="flex:1"><div class="ar-name">'+(isCurrent?S.jobName:('Tier '+t))+' '+tag+'</div>'+
      '<div class="ar-meta">'+examples+' · age '+minAge+'+</div></div></div>';
  }
  $('#jobDetailSheet').innerHTML='<div class="ps-head"><span>'+(S.jobName||'WORK').toUpperCase()+'</span><span>CAREER LADDER</span></div>'+
    '<div class="aempty" style="margin:6px 2px 12px">No single track committed to yet — just the general run of work, tier by tier. Press for promotion, or find a proper career track through the portal when ready.</div>'+
    '<div style="margin:0 2px">'+rows+'</div>'+
    '<div class="ps-foot"><button class="btn" id="jobDetailClose">Close ▸</button></div>';
  $('#jobDetailSheet').onclick=e=>{ if(e.target.id==='jobDetailClose'){ $('#jobDetailWrap').classList.add('hidden'); } };
  $('#jobDetailWrap').classList.remove('hidden');
}
function relationLabel(r){return {child:'child',spouse:'spouse',recruit:'recruit'}[r]||r;}
function openMemberPick(){
  const alive=livingHoldMembers();
  let ch='';
  if(!alive.length){ ch='<div class="qempty">No one in the fold yet to look after.</div>'; }
  else{
    alive.forEach(m=>{const queued=actionReservedThisYear('tendmember');
      ch+='<button class="chipbtn'+(queued?' locked':'')+'" '+(queued?'disabled':'data-member="'+m.mid+'"')+'><b>'+m.first+' '+m.last+'</b><span>'+(queued?'already filed this year':relationLabel(m.relation)+' · loyalty '+holdLoyalty(m))+'</span></button>';});
  }
  $('#skillSheet').innerHTML='<div class="ps-head"><span>CHOOSE WHO TO LOOK AFTER</span></div><div class="chips">'+ch+'</div>'+
    '<div class="ps-foot"><button class="btn" id="skillCancel">Never Mind ▸</button></div>';
  $('#skillSheet').onclick=e=>{
    const mb=e.target.closest('[data-member]'); if(mb){queueAdd('p','tendmember',{member:mb.dataset.member}); $('#skillWrap').classList.add('hidden'); return;}
    if(e.target.id==='skillCancel'){$('#skillWrap').classList.add('hidden');}
  };
  $('#skillWrap').classList.remove('hidden');
}
/* ================= CLERK DESK ================= */
function deskAction(kind){
  if(!S||!S.alive||slipOpen||S.age<S.desk[kind]) return;
  snd('stamp'); shake(); window.C={};
  if(kind==='subsidy'){S.desk.subsidy=S.age+6; logEv('CLERK’S DISCRETION — A cost-of-living subsidy was approved, over the objections of three departments and one loud committee.',{assets:250,happiness:4},'ruling','CLERK RULING · YEAR '+S.age);}
  else if(kind==='checkup'){S.desk.checkup=S.age+6; const exam=medicalExamination('desk'); logEv('CLERK’S DISCRETION — Subject was ordered to a medical inspection. '+exam.text,{health:exam.found?3:7,assets:-80,happiness:-1},'ruling','CLERK RULING · YEAR '+S.age);}
  else if(kind==='censure'){S.desk.censure=S.age+8;
    if(S.vice>0){S.vice=Math.max(0,S.vice-4); logEv('CLERK’S DISCRETION — A formal censure was issued, laminated and in triplicate. The subject’s questionable acquaintances dispersed, alphabetically.',{happiness:-4},'ruling','CLERK RULING · YEAR '+S.age);}
    else logEv('CLERK’S DISCRETION — The censure found nothing to censure. The clerk filed the silence, disappointed.',{},'ruling','CLERK RULING · YEAR '+S.age);}
  renderStats(window.C);
}
function holdAction(kind){
  if(!S||!S.alive||slipOpen||currentYear()<Hold.cooldowns[kind]) return;
  if(kind==='liequiet'&&Hold.heat<10) return;
  if(kind==='fortify'&&Hold.resources.funds<150) return;
  snd('stamp'); shake(); window.C={};
  if(kind==='liequiet'){
    Hold.heat=clamp(Hold.heat-RI(10,20),0,100); Hold.cooldowns.liequiet=currentYear()+2;
    logEv('Subject called for quiet — no meetings, no movement, nothing to see. The Bureau, for a while, saw nothing.',{happiness:-1},'plan','HOLD ACTION · YEAR '+S.age);
  } else if(kind==='fortify'){
    Hold.resources.funds=Math.max(0,Hold.resources.funds-150); Hold.heat=clamp(Hold.heat-12,0,100); Hold.resources.supplies+=10; Hold.cooldowns.fortify=currentYear()+3;
    logEv('Subject spent the Hold’s coin on false walls and a better lock. It won’t stop everything. It might stop enough.',{happiness:2},'plan','HOLD ACTION · YEAR '+S.age);
  }
  renderStats(window.C);
  openHold();
}

/* ================= SLIP OVERLAY ================= */
function openPetition(p){
  slipOpen=true; document.body.classList.add('slip-open'); petitionNo++;
  const card=$('#slipCard'); card.className='slipcard';
  const title=fill(p.title?(typeof p.title==='function'?p.title(S):p.title):(PETITION_TITLES[p.id]||'A Petition Arrives'));
  card.innerHTML='<div class="sl-head petition"><span>PETITION № '+String(petitionNo).padStart(3,'0')+'</span><span class="sl-req">THE BUREAU RULES</span></div>'+
    '<div class="sl-title petition">'+title+'</div>'+
    '<p class="sl-body">'+fill(p.body(S))+'</p><p class="sl-note">You hold the pen. There is no appeal.</p>'+
    '<div class="sl-actions"><button class="sl-btn ok" data-r="1">Approved</button><button class="sl-btn no" data-r="0">Denied</button></div>'+
    '<div class="sl-stampmark" id="slStamp"></div>';
  card.onclick=e=>{const b=e.target.closest('[data-r]'); if(!b)return; resolvePetition(p,b.dataset.r==='1');};
  $('#slipWrap').classList.remove('hidden'); snd('paper'); updateBar();
}
function resolvePetition(p,approved){
  snd('stamp'); const m=$('#slStamp'); m.textContent=approved?'APPROVED':'DENIED'; m.className='sl-stampmark show '+(approved?'ok':'no');
  $('#slipCard').onclick=null;
  setTimeout(()=>{ $('#slipWrap').classList.add('hidden'); slipOpen=false; document.body.classList.remove('slip-open');
    window.C={}; const br=approved?p.yes:p.no; if(br.side)br.side(S);
    if(p.once) S.petDone[p.id]=true;
    logEv('Petition № '+String(petitionNo).padStart(3,'0')+' '+(approved?'APPROVED':'DENIED')+'. '+fill(br.t(S)),br.fx,'ruling','CLERK RULING · YEAR '+S.age);
    renderStats(window.C); updateBar();
    checkAchievements('live');
  },760);
}
function openCrisis(c){
  slipOpen=true; document.body.classList.add('slip-open');
  const card=$('#slipCard'); card.className='slipcard crisis';
  const copts=typeof c.opts==='function'?c.opts(S):c.opts;
  const title=fill(c.title?(typeof c.title==='function'?c.title(S):c.title):(CRISIS_TITLES[c.id]||'A Decision To Make'));
  let opts=''; copts.forEach((o,i)=>{opts+='<button class="sl-btn '+o.cls+'" data-o="'+i+'">'+fill(o.label)+(o.sub?'<small>'+fill(o.sub)+'</small>':'')+'</button>';});
  card.innerHTML='<div class="sl-head crisis"><span>URGENT SLIP · YEAR '+S.age+'</span><span class="sl-req">SUBJECT MUST CHOOSE</span></div>'+
    '<div class="sl-title crisis">'+title+'</div>'+
    '<p class="sl-body">'+fill(c.body(S))+'</p><p class="sl-note">Three doors. None of them clean. The subject waits.</p>'+
    '<div class="sl-actions">'+opts+'</div>';
  card.onclick=e=>{const b=e.target.closest('[data-o]'); if(!b)return; resolveCrisis(c,+b.dataset.o);};
  $('#slipWrap').classList.remove('hidden'); snd('paper'); updateBar();
}
function resolveCrisis(c,i){
  snd('stamp'); const copts=typeof c.opts==='function'?c.opts(S):c.opts; const o=copts[i]; $('#slipCard').onclick=null;
  $('#slipWrap').classList.add('hidden'); slipOpen=false; document.body.classList.remove('slip-open');
  window.C={}; S.__oppText=null; S.__oppFx=null; if(o.side)o.side(S);
  const text = S.__oppText!=null ? S.__oppText : (typeof o.t==='function'?o.t(S):o.t);
  const fx = S.__oppFx!=null ? S.__oppFx : o.fx;
  logEv('SUBJECT CHOSE — “'+fill(o.label)+'.” '+fill(text),fx,'crisis','CRISIS · YEAR '+S.age);
  renderStats(window.C); updateBar();
  checkAchievements('live');
  if(!S.alive) handleDeath();
}
function openOpportunity(o){
  slipOpen=true; document.body.classList.add('slip-open');
  const card=$('#slipCard'); card.className='slipcard opportunity';
  const title=fill(o.title?(typeof o.title==='function'?o.title(S):o.title):(OPPORTUNITY_TITLES[o.id]||'An Opportunity'));
  let opts=''; o.opts.forEach((opt,i)=>{opts+='<button class="sl-btn '+opt.cls+'" data-o="'+i+'">'+fill(opt.label)+(opt.sub?'<small>'+fill(opt.sub)+'</small>':'')+'</button>';});
  card.innerHTML='<div class="sl-head opportunity"><span>AN OPPORTUNITY · YEAR '+S.age+'</span><span class="sl-req">THE HOLD PROPOSES</span></div>'+
    '<div class="sl-title opportunity">'+title+'</div>'+
    '<p class="sl-body">'+fill(o.body(S))+'</p><p class="sl-note">No one is forcing this. The subject decides.</p>'+
    '<div class="sl-actions">'+opts+'</div>';
  card.onclick=e=>{const b=e.target.closest('[data-o]'); if(!b)return; resolveOpportunity(o,+b.dataset.o);};
  $('#slipWrap').classList.remove('hidden'); snd('paper'); updateBar();
}
function resolveOpportunity(o,i){
  const opt=o.opts[i]; if(!opt) return;
  snd('stamp'); $('#slipCard').onclick=null;
  $('#slipWrap').classList.add('hidden'); slipOpen=false; document.body.classList.remove('slip-open');
  window.C={}; S.__oppText=null; S.__oppFx=null;
  if(opt.side) opt.side(S);
  const text = S.__oppText!=null ? S.__oppText : opt.t;
  const fx = S.__oppFx!=null ? S.__oppFx : opt.fx;
  logEv('SUBJECT CHOSE — “'+fill(opt.label)+'.” '+fill(text),fx,'opportunity','OPPORTUNITY · YEAR '+S.age);
  renderStats(window.C); updateBar();
  checkAchievements('live');
  if(!S.alive) handleDeath();
}
function openNotice(n){
  slipOpen=true; document.body.classList.add('slip-open');
  const card=$('#slipCard'); card.className='slipcard notice';
  const title=fill(n.title||'For The Record');
  const chipsHtml=(n.chips&&n.chips.length)?'<div class="sl-chips">'+n.chips.map(c=>'<span class="fx '+(c.plus?'plus':'minus')+'">'+c.txt+'</span>').join('')+'</div>':'';
  card.innerHTML='<div class="sl-head notice"><span>NOTICE · YEAR '+S.age+'</span><span class="sl-req">FOR THE RECORD</span></div>'+
    '<div class="sl-title notice">'+title+'</div>'+
    '<p class="sl-body">'+fill(n.body)+'</p>'+chipsHtml+'<p class="sl-note">Nothing to decide here. Just to know.</p>'+
    '<div class="sl-actions"><button class="sl-btn ok" data-ack="1">Acknowledge ▸</button></div>';
  card.onclick=e=>{ if(e.target.closest('[data-ack]')) resolveNotice(n); };
  $('#slipWrap').classList.remove('hidden'); snd('paper'); updateBar();
}
function resolveNotice(n){
  snd('stamp'); $('#slipCard').onclick=null;
  $('#slipWrap').classList.add('hidden'); slipOpen=false; document.body.classList.remove('slip-open');
  window.C={};
  if(n.onAck) n.onAck(S);
  logEv(fill(n.body),{},'crisis','NOTICE · YEAR '+S.age);
  renderStats(window.C); updateBar();
  checkAchievements('live');
  if(!S.alive) handleDeath();
}

/* ================= YEAR RESOLUTION ================= */
function vtext(e){
  S.usedV[e.id]=S.usedV[e.id]||[];
  let avail=e.v.map((_,i)=>i).filter(i=>!S.usedV[e.id].includes(i));
  if(!avail.length){S.usedV[e.id]=[];avail=e.v.map((_,i)=>i);}
  const i=pick(avail); S.usedV[e.id].push(i); return fill(e.v[i]);
}
function pushFollow(f){ if(f) followups.push({at:S.age+f.in,t:fill(f.t),fx:f.fx,side:f.side}); }
function runFollowups(){ followups=followups.filter(f=>{ if(f.at<=S.age){ if(f.side)f.side(S); logEv(f.t,f.fx); return false;} return true; }); }

/* ================= AFFAIRS / DISCOVERY ================= */
function endAffairSide(s,cid,discovered){
  const c=s.contacts.find(x=>x.cid===cid);
  if(c) c.affair = discovered ? Object.assign(c.affair||{},{active:false,discovered:true}) : null;
  s.activeAffairCids=(s.activeAffairCids||[]).filter(x=>x!==cid);
}
function endMarriageSide(s,newStatus){
  const p=activePartnerContact();
  if(p){ p.role='ex'; }
  // divorce/death/separation ends the marriage and, with it, whatever was secret about any ongoing affairs —
  // they simply stop being "cheating" once there's no one left to cheat on.
  (s.activeAffairCids||[]).forEach(cid=>{ const c=s.contacts.find(x=>x.cid===cid); if(c) c.affair=null; });
  s.activeAffairCids=[];
  s.married=false; s.status=newStatus; syncPartnerMirror();
}
function buildTheirSpouseDiscoveryNotice(c){
  c.npcMarried=false;
  const doorstep=chance(0.3);
  const text = doorstep
    ? c.name+'’s spouse showed up at the door and said several true things, loudly, in front of the neighbors. The subject’s standing took a hit that wasn’t, strictly, the subject’s marriage to absorb.'
    : c.name+'’s marriage ended, quietly, over something the subject was part of but was never named for. Word, somehow, still got around.';
  if(doorstep){ S.relations=clamp(S.relations-10,0,100); S.happiness=clamp(S.happiness-6,0,100); }
  return text;
}
function runAffairs(){
  if(!S.activeAffairCids||!S.activeAffairCids.length) return;
  const juggling=Math.max(0,S.activeAffairCids.length-1); // more people on the go = harder to keep the story straight
  const cids=S.activeAffairCids.slice();
  for(const cid of cids){
    if(S.__pendingDiscovery) break; // this year's discovery slot is already claimed; the rest just wait their turn
    const c=S.contacts.find(x=>x.cid===cid);
    if(!c||!c.affair||!c.affair.active){ S.activeAffairCids=S.activeAffairCids.filter(x=>x!==cid); continue; }
    const aff=c.affair;
    aff.yearsActive++;
    aff.heat=clamp(aff.heat+4+juggling*3+(S.vice>=6?2:0)-(aff.coverTracksThisYear?5:0)-(S.smarts>=75?1:0),0,60);
    let cascade=false;
    if(c.npcMarried&&!aff.theirDiscovered){
      aff.theirHeat=clamp((aff.theirHeat||0)+4+juggling*2-(aff.coverTracksThisYear?5:0),0,60);
      const theirChance=clamp(0.03+aff.theirHeat*0.008,0.02,0.5);
      if(chance(theirChance)){
        aff.theirDiscovered=true;
        const noticeText=buildTheirSpouseDiscoveryNotice(c);
        if(S.married&&chance(0.5)) cascade=true;
        // if it cascades, the main discovery dilemma already narrates it (cascadeLine()) — only queue
        // this standalone notice when it does NOT cascade, to avoid two slips fighting for the same year.
        if(!cascade) S.__pendingTheirSpouseNotice={title:'Their Marriage Has Ended',body:noticeText};
      }
    }
    aff.coverTracksThisYear=false;
    const discoveryChance=clamp(0.03+aff.heat*0.008-(S.relations>60?0.03:0)-(S.smarts>=75?0.015:0)+juggling*0.02,0.02,0.6);
    if(cascade||chance(discoveryChance)){ aff.discovered=true; aff.active=false; S.__pendingDiscovery={cid:c.cid,cascaded:cascade}; }
  }
}
function affairSeverityWeights(spouseContact,wasMarried){
  const t=spouseContact.temperament, marriedBoost=wasMarried?12:0;
  return {
    divorceDilemma: clamp(50-t*0.2,10,60),
    killDilemma: clamp((t-40)*0.6+marriedBoost,2,45),
    suicideDilemma: clamp((t-55)*0.5+marriedBoost*0.6,2,35),
    divorceDirect: clamp(35-t*0.15,5,45),
    killDirect: clamp((t-60)*0.35+marriedBoost*0.5,1,20),
    suicideDirect: clamp((t-65)*0.3+marriedBoost*0.4,1,15),
  };
}
function pickWeightedKey(weights){
  const total=Object.values(weights).reduce((a,b)=>a+b,0);
  let r=Random.next()*total;
  for(const k in weights){ r-=weights[k]; if(r<=0) return k; }
  return Object.keys(weights)[0];
}
function dispatchDirectDivorce(){
  const wasMarried=S.married; endAffairSide(S,S.__discoveredAffairCid,true);
  const settlement=Math.round(Math.max(0,S.assets)*0.25);
  endMarriageSide(S,wasMarried?'Divorced':'Single');
  S.assets-=settlement;
  openNotice({title:'Divorced Without Warning',body:'{partner} did not ask for an explanation. The papers were filed within the week, uncontested. The Bureau notes the matter as concluded, {other}’s name absent from the record entirely.'+cascadeLine()});
}
function dispatchDirectKill(){
  endAffairSide(S,S.__discoveredAffairCid,true);
  openNotice({title:'The File Closes Abruptly',body:'{partner} did not shout, did not warn, did not wait. The file ends here — not a court matter, the Bureau made certain of that, quietly and completely.'+cascadeLine(),
    onAck:s=>{ s.alive=false; s.cause='a domestic matter the Bureau declined to make public'; }});
}
function dispatchDirectSuicide(){
  endAffairSide(S,S.__discoveredAffairCid,true); endMarriageSide(S,'Widowed');
  S.happiness=clamp(S.happiness-20,0,100);
  openNotice({title:'{partner}’s Own File Closes',body:'{partner} said nothing further. There was, in the end, nothing further to say. The subject’s own file continues; {partner}’s does not.'+cascadeLine()});
}
function dispatchDiscoveryReaction(ctx){
  const other=S.contacts.find(x=>x.cid===ctx.cid);
  const spouse=activePartnerContact();
  if(!spouse){ if(other) other.affair=null; S.activeAffairCids=(S.activeAffairCids||[]).filter(x=>x!==ctx.cid); return; }
  S.__affairName=other?other.name:'someone';
  S.__partnerNameSnapshot=spouse.name;
  S.__cascadeDiscovery=!!ctx.cascaded;
  S.__discoveredAffairCid=ctx.cid;
  const weights=affairSeverityWeights(spouse,S.married);
  const key=pickWeightedKey(weights);
  if(key==='divorceDilemma') openCrisis(AFFAIR_CRISES.divorceOrStop);
  else if(key==='killDilemma') openCrisis(AFFAIR_CRISES.killThreat);
  else if(key==='suicideDilemma') openCrisis(AFFAIR_CRISES.suicideThreat);
  else if(key==='divorceDirect') dispatchDirectDivorce();
  else if(key==='killDirect') dispatchDirectKill();
  else dispatchDirectSuicide();
}
/* ================= REVERSE AFFAIRS (the NPC cheats on the player) ================= */
function runReverseAffairs(){
  const p=activePartnerContact(); if(!p||S.age<16) return;
  if(!p.reverseAffair||!p.reverseAffair.active){
    const neglect=p.mood<40?0.02:0;
    const selfNeglect=(S.looks<30?0.006:0)+(S.health<30?0.005:0);
    const startChance=clamp(0.004+(100-p.fidelity)*0.0013+neglect+selfNeglect+(p.npcMarried?0.003:0),0.002,0.06);
    if(chance(startChance)){
      p.reverseAffair={active:true,heat:6,yearsActive:0,discovered:false,rivalName:pick(p.sex==='M'?FEMALE:MALE)+' '+pick(LAST)};
    }
    return;
  }
  const aff=p.reverseAffair;
  aff.yearsActive++;
  aff.heat=clamp(aff.heat+5,0,60);
  const discoveryChance=clamp(0.04+aff.heat*0.009+(S.relations>65?0.03:0)+(S.smarts>=75?0.02:0),0.02,0.55);
  if(chance(discoveryChance)){ aff.discovered=true; aff.active=false; S.__pendingReverseDiscovery={cid:p.cid}; }
}
function dispatchReverseDiscoveryReaction(ctx){
  const p=S.contacts.find(c=>c.cid===ctx.cid);
  if(!p||!p.reverseAffair) return;
  S.__partnerNameSnapshot=p.name; S.__affairName=p.reverseAffair.rivalName; S.__cascadeDiscovery=false;
  const married=S.married;
  const happHit=married?-RI(28,42):-RI(14,24), healthHit=married?-RI(8,16):-RI(2,7);
  S.happiness=clamp(S.happiness+happHit,0,100); S.health=clamp(S.health+healthHit,0,S.healthCap||100);
  openCrisis(NPC_CHEAT_CRISES.discovered);
}
function runHistory(){ const y=currentYear();
  for(const h of HISTORY){ if(h.y!==y) continue; if(h.if&&!h.if(S)) continue;
    if(h.medical&&typeof medicalEventExposure==='function') medicalEventExposure(h.medical,S);
    if(h.outbreak&&typeof medicalStartOutbreak==='function') medicalStartOutbreak(h.outbreak.id,h.outbreak.severity,h.outbreak.years);
    const fx=typeof h.fx==='function'?h.fx(S):(h.fx||{}); if(h.side)h.side(S); logEv(fill(h.t),fx,'history','HISTORY · '+y); } }
const STAGE_INFO={
 infancy:{name:'INFANCY',blurb:'The file opens. Everything is still being decided for the subject.'},
 childhood:{name:'CHILDHOOD',blurb:'Lower and Middle School, if the family can manage it. Small chores, the world still enormous.'},
 adolescence:{name:'ADOLESCENCE',blurb:'Upper School, for those still enrolled. The subject may now work, court, and misbehave, formally.'},
 youngadult:{name:'YOUNG ADULTHOOD',blurb:'Full legal standing. Marriage, a trade, a University seat — the paperwork of adulthood begins.'},
 adulthood:{name:'ADULTHOOD',blurb:'Career, family, and the file thicken together.'},
 elder:{name:'ELDER YEARS',blurb:'The working file closes. Whatever comes next is unhurried.'}
};
function stageForAge(age){
  if(age>=65) return 'elder';
  if(age>=22) return 'adulthood';
  if(age>=18) return 'youngadult';
  if(age>=16) return 'adolescence';
  if(age>=6) return 'childhood';
  return 'infancy';
}
function stageUnlocks(stageId){
  const minAge={childhood:6,adolescence:16,youngadult:18,adulthood:22,elder:65}[stageId];
  const jobs=JOBLIST.filter(j=>TIER_MINAGE[j.tier]===minAge).map(j=>j.name);
  const skills=Object.values(SKILLS).filter(sk=>sk.minAge===minAge).map(sk=>sk.name);
  return jobs.concat(skills);
}
function runMilestones(){ const m=S.age;
  if(m===65&&S.jobTier>0){S.pensionBase=500+S.jobTier*380;S.jobTier=0;S.jobName='Pensioner (retired)';S.career=null; logEv('Subject’s file was transferred to the Pension Office. A small cake was permitted.',{happiness:2},'milestone','MILESTONE · YEAR 65');}
}
function runEconomy(){
  const y=currentYear(), WAR=(y>=1914&&y<=1918)||(y>=1939&&y<=1945), student=!!S.eduStage;
  S.__householdAssetsBeforeEconomy=S.assets; S.__householdSubjectExpensesPaid=0;
  S.__worldWagePaid=0; S.__worldWagePaidYear=y;
  if(S.age>=16&&S.age<65&&!student&&S.jobName!=='Conscript'&&S.jailUntil<=S.age){
    if(S.jobTier===0){ const p=(0.04+S.smarts*0.0006)*(WAR?0.6:1);
      if(chance(p)){const job=bestJobForTier(1); if(job){S.jobTier=1; S.jobName=job.name; logEv('Subject stumbled into work — '+job.name+' — without much looking. Beginner’s luck, filed as such.',{happiness:2});}} }
    else if(S.career){ S.careerYears++;
      if(chance(0.03+(S.happiness<30?0.03:0)+(WAR?0.03:0))){ S.jobTier=0;S.jobName='Unemployed';S.career=null; logEv('Subject’s position was eliminated. Subject left with a box of pencils and a firm handshake.',{happiness:-6}); } }
    else { if(S.jobTier<5&&chance(0.008+S.smarts*0.0003)){const job=bestJobForTier(S.jobTier+1);
        if(job){S.jobTier++;S.jobName=job.name; logEv('Subject was promoted to '+job.name+', unasked. New office. Same clock.',{happiness:4,assets:150});}}
      else if(chance(0.03+(S.happiness<30?0.03:0)+(WAR?0.03:0))){S.jobTier=0;S.jobName='Unemployed'; logEv('Subject’s position was eliminated. Subject left with a box of pencils and a firm handshake.',{happiness:-6});} } }
  if(S.age>=16&&S.jailUntil<=S.age){ let income=0;
    if(S.jobName==='Conscript')income=400; else if(S.career)income=CAREERS.find(c=>c.id===S.career).stages[S.jobTier-1].salary; else if(S.jobTier>0)income=INC[S.jobTier]; else if(S.jobName.startsWith('Pensioner'))income=S.pensionBase;
    if(S.garnishUntil>S.age) income=Math.round(income*0.6);
    if(typeof medicalWorkPenalty==='function'){ const medicalPenalty=medicalWorkPenalty(S); if(medicalPenalty) income=Math.round(income*Math.max(.55,1-medicalPenalty*.14)); }
    if(typeof WorldGameplay==='object'&&WorldGameplay&&typeof WorldGameplay.adjustPaidIncome==='function') income=WorldGameplay.adjustPaidIncome(income,S);
    S.__worldWagePaid=Math.max(0,Math.round(income)); S.__worldWagePaidYear=y; S.assets+=income; }
  if(S.jailUntil<=S.age) runBudget(WAR);
  if(S.jailUntil>S.age){ S.assets-=200; }
  if(WAR&&!S.warned['war'+(y>=1939?'2':'1')]){S.warned['war'+(y>=1939?'2':'1')]=1; logEv('Ration books were issued. Subject’s butter became a rumor.',{happiness:-2});}
  if(!hasPartner(S)&&S.age>=17&&S.age<=45&&chance(0.015+(S.looks>55?0.01:0))){
    const c=makeContact(S.sex==='M'?'F':'M'); c.role='partner'; c.mood=66; c.npcMarried=false; c.npcSpouseName=null; c.npcSpouseTemperament=null; S.contacts.push(c); syncPartnerMirror();
    S.status='Attached';
    logEv('Subject fell in love with '+S.partner+', unlooked-for. It was, initially, reciprocated.',{happiness:8,relations:8}); }
  if(S.married&&S.kids<4&&S.age>=20&&S.age<=42&&chance(0.025)){ S.kids++; S.familyMood=70; bearChild();
    logEv('A child was born to the subject. The Bureau congratulates the subject, cautiously.',{happiness:6,assets:-300,relations:6,health:-2}); }
  if(S.married&&S.age>=55&&chance(0.02+(S.age-55)*0.002)){
    logEv('Subject’s spouse, '+S.partner+', passed away. The Bureau extends its formal condolences.',{happiness:-12,relations:-10});
    markSpouseDeath(S,'natural causes'); }
  if(S.married){ const p=activePartnerContact(); if(p){ p.mood=clamp(p.mood-3,0,100); syncPartnerMirror(); } }
  else if(S.partner){ const p=activePartnerContact(); if(p){ p.mood=clamp(p.mood-1,0,100); syncPartnerMirror(); } }
  S.contacts.filter(c=>c.role==='friend').forEach(c=>{ c.mood=clamp(c.mood-2,0,100); });
  if(S.kids>0) S.familyMood=clamp(S.familyMood-2,0,100);
  if(S.kids>0){
    S.parentYears++;
    const cc=currentChildcare().id;
    const style=PARENTING_STYLES.find(x=>x.id===S.parentingStyle)||{warmBonus:0,stableBonus:0};
    const warmBonus={basic:0,comfortable:12,private:22}[cc]||0;
    S.parentWarmAccum+=clamp(S.familyMood*0.7+warmBonus+style.warmBonus,0,100);
    const jailPenalty=S.jailUntil>S.age?-25:0;
    const stabPts=(S.assets<0?-10:S.assets>2000?8:0)+({basic:0,comfortable:5,private:10}[cc]||0)+jailPenalty+(S.liabilities.length?-5:0)+style.stableBonus;
    S.parentStableAccum+=clamp(50+stabPts,0,100);
  }
  if(S.mother&&S.mother.alive&&!S.mother.estranged&&S.age<50) S.mother.mood=clamp(S.mother.mood-2,0,100);
  if(S.father&&S.father.alive&&!S.father.estranged&&S.age<50) S.father.mood=clamp(S.father.mood-2,0,100);
  if(S.mother&&S.mother.alive&&chance(0.008+Math.max(0,S.age-15)*0.0009)){ logEv('Word came that {mother} had passed. Subject sat with it a while before telling anyone.',{happiness:-6}); S.mother.alive=false; }
  if(S.father&&S.father.alive&&chance(0.008+Math.max(0,S.age-15)*0.0009)){ logEv('Word came that {father} had passed. Subject sat with it a while.',{happiness:-6}); S.father.alive=false; }
  S.contacts.slice().forEach(c=>{
    if(c.role==='friend'&&c.mood<15){ logEv('The old contact '+c.name+' drifted off, the way friends do when the calls stop.',{relations:-3});
      S.contacts=S.contacts.filter(x=>x.cid!==c.cid); }
  });
  const friendMoods=S.contacts.filter(c=>c.role==='friend').map(c=>c.mood);
  const avgFriendMood=friendMoods.length?friendMoods.reduce((a,b)=>a+b,0)/friendMoods.length:null;
  const moods=[S.married||S.partner?S.partnerMood:null, avgFriendMood, S.kids>0?S.familyMood:null,
    (S.mother&&S.mother.alive&&!S.mother.estranged)?S.mother.mood:null,
    (S.father&&S.father.alive&&!S.father.estranged)?S.father.mood:null].filter(x=>x!==null);
  if(moods.length){ const avg=moods.reduce((a,b)=>a+b,0)/moods.length; S.relations=clamp(Math.round(0.55*S.relations+0.45*avg),0,100); }
  if(S.age>45) S.health=clamp(S.health-Math.floor((S.age-45)/8),0,100);
  if(S.age>40) S.looks=clamp(S.looks-(chance(.4)?1:0),0,100);
  if(S.happiness<50&&chance(.3)) S.happiness=clamp(S.happiness+1,0,100);
  if(S.vice>0&&S.happiness>60&&chance(.3)) S.vice--;
}
function checkCareerProgress(){
  if(!S.career||S.jobTier<1) return;
  const track=CAREERS.find(c=>c.id===S.career); if(!track) return;
  if(S.jobTier<5 && readyForPromotion(track)){
    const next=track.stages[S.jobTier];
    S.jobTier++; S.jobName=next.name; S.careerYears=0;
    logEv('Subject was promoted to '+next.name+'.',{happiness:4,assets:150});
    queuePromotionToast(track,next);
    return;
  }
  const st=track.stages[S.jobTier-1]; if(!st) return;
  const overage=Object.keys(st.req).reduce((sum,k)=>sum+Math.max(0,(S.skills[k]||0)-st.req[k]),0);
  if(overage>0 && chance(clamp(0.04*overage,0,0.35))){
    const bonus=Math.round(st.salary*R(0.05,0.15));
    logEv('Subject’s work did not go unnoticed — a small bonus arrived with the usual pay.',{assets:bonus});
  }
}
function currentHousing(){return HOUSING.find(h=>h.id===S.lifestyle.housing)||HOUSING[0];}
function currentFood(){return FOOD.find(f=>f.id===S.lifestyle.food)||FOOD[0];}
function currentChildcare(){return CHILDCARE.find(c=>c.id===S.lifestyle.childcare)||CHILDCARE[0];}
function applyAmbient(fx,scale){ if(!fx) return; for(const k in fx){ const v=fx[k]; if(!v) continue;
  const sv=scale&&scale!==1?Math.round(v*scale):v;
  if(!sv) continue;
  if(k==='assets'){ S.assets+=sv; } else { const cap=(k==='health'&&S.healthCap!=null)?S.healthCap:(k==='looks'&&S.looksCap!=null)?S.looksCap:100; if(k==='health'&&typeof medicalApplyHealthDelta==='function') medicalApplyHealthDelta(S,sv,'household'); else S[k]=clamp(S[k]+sv,0,cap); } } }
function runBudget(WAR){
  const house=currentHousing(), food=currentFood();
  const atHome=S.age<16||S.livingAtHome;
  const childScale=atHome?(GUARD_SCALE[guardTier()]||0.4):1;
  applyAmbient(house.fx,childScale); applyAmbient(food.fx,childScale);
  if(S.kids>0){ applyAmbient(currentChildcare().fx,childScale); }
  if(atHome) return;
  const household=typeof HouseholdSystem==='object'&&HouseholdSystem&&typeof HouseholdSystem.findByMember==='function'?HouseholdSystem.findByMember(World,S.npcId):null;
  const projection=typeof HouseholdSystem==='object'&&HouseholdSystem&&typeof HouseholdSystem.estimateOutlay==='function'?HouseholdSystem.estimateOutlay(World,household,S,{year:currentYear()}):null;
  const outlay=projection?projection.personalLifestyleOutlay:Math.round((house.rent+food.cost+(S.kids>0?currentChildcare().costPerKid*S.kids:0)+S.liabilities.reduce((sum,l)=>sum+l.annualPayment,0))*(WAR?1.15:1));
  S.__householdSubjectExpensesPaid=Math.round(outlay);
  S.assets-=outlay;
  S.liabilities.forEach(l=>{ l.yearsLeft--; });
  const paidOff=S.liabilities.filter(l=>l.yearsLeft<=0);
  S.liabilities=S.liabilities.filter(l=>l.yearsLeft>0);
  paidOff.forEach(l=>logEv('The last payment on the '+l.name.toLowerCase()+' went through. One fewer envelope in the post.',{happiness:3}));
  if(S.assets<-1200 && house.id!=='none'){
    const idx=HOUSING.findIndex(h=>h.id===house.id), down=HOUSING[Math.max(0,idx-1)];
    S.lifestyle.housing=down.id;
    logEv(down.id==='none'?'Subject could not make rent. The door was changed, the key was not. Subject slept where they could.':'Subject could not make rent and moved somewhere smaller, and cheaper, and colder.',{happiness:-8,health:-3});
  }
}
function resolvePlan(){
  const q=S.queue.slice(); S.queue=[];
  let autoTrained=false;
  if(S.autoTrain&&computeHours()>=1){
    const skillId=autoPickSkill();
    if(skillId){ autoTrained=true; window.C={}; const r=PUR_MAP['practice'].apply(S,{skill:skillId}); const chips=r.fx?applyFx(r.fx):[];
      logChips(fill(r.text)+' (auto-trained)',chips,'plan','PURSUIT · YEAR '+S.age);
      renderStats(window.C); }
  }
  if(!q.length&&!autoTrained&&computeHours()>0){
    window.C={};
    logChips('A quiet year. Not every one needs a headline.',[],'idle','YEAR '+S.age);
  }
  q.forEach(item=>{ const def=item.type==='p'?PUR_MAP[item.id]:DEC_MAP[item.id]; if(!def)return;
    S.acts++; window.C={};
    let r;
    if(item.id==='learntrade'&&item.program&&typeof educationCompleteProgram==='function'){
      const result=educationCompleteProgram(item.program);
      r=result.ok?{fx:{happiness:2},text:'Subject completed '+result.program.name+'. '+result.program.desc+(result.shortfall?' The unpaid '+money(result.shortfall)+' was entered as education debt.':' The certificate was paid from assets.') }:{fx:{happiness:-1},text:'Subject reached for vocational training, but the course was not available on the current record.'};
    }else r=def.apply(S,item);
    const chips=r.fx?applyFx(r.fx):[];
    if(r.follow) pushFollow(r.follow);
    logChips(fill(r.text),chips,item.type==='p'?'plan':'decision',(item.type==='p'?'PURSUIT':'DECISION')+' · YEAR '+S.age);
    renderStats(window.C); });
}
function runRandomEvents(){
  if(typeof educationEventTick==='function') educationEventTick();
  let n=chance(.5)?1:0; if(S.age>10&&chance(.12))n++;
  const dispId=currentDisposition(S).it.id;
  const darkMult = dispId==='saint'?0.5:(dispId==='gambler'||dispId==='hustler')?1.4:1;
  for(let i=0;i<n;i++){
    const pool=EVENTS.filter(e=>S.age>=e.a[0]&&S.age<=e.a[1]&&(!e.if||e.if(S))&&(!S.cool[e.id]||S.age>=S.cool[e.id]));
    if(!pool.length) break;
    const weighted=pool.map(e=>{let w=e.w||2; if(e.dark)w*=(0.3+S.vice*0.4+(S.happiness<40?1.1:0))*darkMult; return {e,w:Math.max(w,0.05)};});
    const tot=weighted.reduce((a,x)=>a+x.w,0); let r=Random.next()*tot, e=weighted[weighted.length-1].e;
    for(const x of weighted){r-=x.w; if(r<=0){e=x.e;break;}}
    if(e.medical&&typeof medicalEventExposure==='function') medicalEventExposure(e.medical,S);
    if(e.side)e.side(S); logEv(vtext(e), typeof e.fx==='function'?e.fx(S):e.fx, undefined, undefined, !!e.once);
    if(e.follow) pushFollow(e.follow(S)); S.cool[e.id]=S.age+(e.once?999:(e.cd||6));
  }
}
function checkMortality(){
  let dead=false, cause='';
  if(S.jailUntil<=S.age){
    const house=currentHousing(), food=currentFood();
    let povRisk=0;
    if(house.id==='none') povRisk+=0.012;
    if(food.id==='meager') povRisk+=0.003;
    if(house.id==='none'&&food.id==='meager') povRisk+=0.01;
    if(S.age>=16&&Math.min(S.housingSecurity||50,S.financialSecurity||50)<25) povRisk+=0.006;
    if(S.age<16||S.livingAtHome) povRisk*=1.6*(GUARD_MORT[guardTier()]||1);
    else if(S.age>65) povRisk*=1.6;
    if(povRisk>0&&chance(povRisk)){ dead=true;
      cause = house.id==='none'
        ? pick(['exposure, found behind the depot at first light','a fever no shelter was there to catch','the kind of winter the streets do not forgive'])
        : pick(['a hunger the body could not recover from','a sickness a fuller table might have survived']);
    }
  }
  const medicalMortality=typeof medicalMortalityDetails==='function'?medicalMortalityDetails(S):null;
  if(!dead&&medicalMortality&&medicalMortality.risk>0&&chance(medicalMortality.risk)){dead=true;cause=medicalMortality.cause||'complications from a long illness';}
  if(!dead&&S.health<=0){dead=true;cause=pick(['heart failure','a long illness, patiently endured','sudden collapse at the kitchen table']);}
  else if(!dead&&S.happiness<=0&&chance(0.07)){dead=true;cause='a despair the file does not fully document';}
  else if(!dead&&S.age>=56){const p=0.006*(S.age-55)+Math.max(0,70-S.health)*0.0012; if(chance(p)){dead=true;cause=S.age>=84?'natural causes, in sleep':'heart failure';}}
  if(!dead&&S.age>=104){dead=true;cause='the extreme and improbable age of '+S.age;}
  if(dead){S.alive=false;S.cause=cause; logEv('ENTRY TERMINATED. Subject deceased — '+cause+'. The record ends mid-sentence, as these things do.',{},'final','FINAL ENTRY · YEAR '+S.age);}
}
function maybeSlip(){
  const bk=CRISES.find(c=>c.id==='bankruptcy');
  if(bk&&bk.avail(S)){ openCrisis(bk); return; }
  const raid=CRISES.find(c=>c.id==='regimeraid');
  if(raid&&raid.avail(S)&&chance(clamp((Hold.heat-55)/130,0,0.35))){ openCrisis(raid); return; }
  const holdExposure=S.holdMember?Hold.heat*0.0035:0;
  const hardship = (S.assets<0?0.12+clamp(Math.abs(S.assets)/2000,0,0.4):0)+(S.health<30?0.1:0)+(S.married&&S.partnerMood<25?0.12:0)+(S.kids>0?0.04:0)+holdExposure;
  const cpool=CRISES.filter(c=>c.avail(S)&&c.id!=='regimeraid');
  if(cpool.length && chance(0.10+hardship)){ openCrisis(pick(cpool)); return; }
  const ppool=PETITIONS.filter(p=>p.avail(S)&&!(p.once&&S.petDone[p.id]));
  if(ppool.length && chance(0.12)){ openPetition(pick(ppool)); return; }
  const opool=OPPORTUNITIES.filter(o=>o.avail(S));
  if(opool.length && chance(0.16)){ openOpportunity(pick(opool)); }
}
function autoPickSkill(){
  const cap=typeof skillCapFor==='function'?skillCapFor():10;
  if(S.career){
    const track=CAREERS.find(c=>c.id===S.career), stage=track&&track.stages[Math.max(0,S.jobTier-1)], next=track&&track.stages[S.jobTier];
    const needed=[...(stage?Object.keys(stage.req):[]),...(next?Object.keys(next.req):[])].filter((id,i,a)=>a.indexOf(id)===i)
      .filter(id=>S.age>=SKILLS[id].minAge&&(S.skills[id]||0)<cap);
    if(needed.length) return needed.sort((a,b)=>(S.skills[a]||0)-(S.skills[b]||0))[0];
  }
  const jobDef=JOBLIST.find(j=>j.name===S.jobName);
  if(jobDef&&jobDef.skill&&S.age>=SKILLS[jobDef.skill].minAge&&(S.skills[jobDef.skill]||0)<cap) return jobDef.skill;
  const eligible=Object.entries(SKILLS).filter(([id,sk])=>S.age>=sk.minAge&&(S.skills[id]||0)<cap);
  if(!eligible.length) return null;
  eligible.sort((a,b)=>(S.skills[b[0]]||0)-(S.skills[a[0]]||0));
  return eligible[0][0];
}
function tickSkills(){
  const jobDef=JOBLIST.find(j=>j.name===S.jobName);
  const workedSkill=jobDef?jobDef.skill:null;
  const career=CAREERS.find(track=>track.id===S.career);
  const careerStage=career&&career.stages[Math.max(0,S.jobTier-1)];
  const careerSkills=new Set(careerStage?Object.keys(careerStage.req):[]);
  for(const id in S.skills){
    if(S.skills[id]<=0){delete S.skills[id];continue;}
    const reinforced=(id===workedSkill)||(id===S.practicedSkill)||careerSkills.has(id);
    if(reinforced){ if(S.skills[id]<skillCapFor()&&chance(.28)) S.skills[id]++; }
    else if(chance(.18)){ S.skills[id]=Math.max(educationSkillFloor(id),S.skills[id]-1); }
  }
  S.practicedSkill=null;
}
function guardianTeachTick(){
  if(!S||S.age<6||S.age>=16) return;
  const tier=guardTier();
  if(tier!=='nurturing'&&tier!=='supported') return;
  const g=guardiansOf(); if(!g.length) return;
  const teacher=g.slice().sort((a,b)=>b.skillLvl-a.skillLvl)[0];
  const sk=SKILLS[teacher.skill]; if(!sk||S.age<sk.minAge) return;
  const cap=tier==='nurturing'?4:2, pTeach=tier==='nurturing'?0.4:0.2;
  const before=S.skills[teacher.skill]||0, educationCap=typeof skillCapFor==='function'?skillCapFor():10;
  if(before<Math.min(cap,educationCap)&&chance(pTeach)) S.skills[teacher.skill]=before+1;
}
function guardianAmbientTick(){
  if(!S) return;
  [S.mother,S.father].forEach(p=>{
    if(!p||!p.alive||p.estranged||p.present===false) return;
    if(p.warmth<20) applyAmbient({happiness:-1,relations:-1}, S.age<16?1:0.4);
    else if(p.warmth>=80&&p.mood>60) applyAmbient({happiness:1}, S.age<16?1:0.3);
  });
}
function guardianIncidentTick(){
  if(!S) return;
  const atHome=S.age<16||S.livingAtHome;
  if(!atHome) return;
  const g=guardiansOf(); if(!g.length) return;
  const tier=guardTier();
  if(tier==='toxic') S.wasToxicHome=true;
  let pool=null,p=0;
  if(tier==='toxic'){ pool=TOXIC_INCIDENTS; p=0.4; }
  else if(tier==='nurturing'){ pool=CARING_INCIDENTS; p=0.4; }
  else if(tier==='supported'){ pool=CARING_INCIDENTS; p=0.22; }
  if(!pool||!chance(p)) return;
  const parent=pick(g), inc=pick(pool);
  const text=pick(inc.v).replace(/\{parent\}/g,parent.name);
  if(inc.side) inc.side(parent);
  const kind=tier==='toxic'?'bad':'good';
  if(kind==='bad') S.toxicIncidentCount=(S.toxicIncidentCount||0)+1;
  else S.warmIncidentCount=(S.warmIncidentCount||0)+1;
  const chips=applyFx(inc.fx);
  logChips(text, chips, 'guardian-'+kind);
  if(!quietMode) queueGuardianNotice(kind, text, chips);
  checkNurturingMilestone();
}
function checkNurturingMilestone(){
  if(S.nurturingMilestoneDone) return;
  if((S.warmIncidentCount||0)<4) return;
  if(!(S.age<16||S.livingAtHome)) return;
  const g=guardiansOf(); if(!g.length) return;
  S.nurturingMilestoneDone=true;
  const parent=g.slice().sort((a,b)=>b.warmth-a.warmth)[0];
  const milestone=pick(NURTURING_MILESTONES);
  const skillName=SKILLS[parent.skill]?SKILLS[parent.skill].name.toLowerCase():'the trade';
  const text=milestone.v.replace(/\{parent\}/g,parent.name).replace(/\{skill\}/g,skillName);
  S.healthCap=clamp((S.healthCap||100)+5,0,120);
  S.looksCap=clamp((S.looksCap||100)+3,0,120);
  const chips=applyFx(milestone.fx);
  logChips(text, chips, 'guardian-good');
  if(!quietMode) queueGuardianNotice('good', text, chips);
}
/* ================= LIVING SITUATION (leaving / being cast out of the parental home) ================= */
function moveOutNow(voluntary){
  const g=guardiansOf();
  const q=g.length?g.reduce((a,p)=>a+(p.warmth*0.5+p.stability*0.5),0)/g.length:0;
  S.livingAtHome=false;
  if(S.wasToxicHome&&S.age<=18) S.leftBeforeBroke=true;
  if(voluntary){
    S.assets+=Math.round(80+q*6);
    S.lifestyle.housing='room'; S.lifestyle.food='basic';
  } else {
    S.lifestyle.housing='none'; S.lifestyle.food='meager';
  }
}
function resolveLivingLine(text,fx,moved,voluntary){
  window.C={};
  if(moved) moveOutNow(voluntary);
  const chips=fx?applyFx(fx):[];
  logChips(fill(text),chips,'crisis','LIVING SITUATION · YEAR '+S.age);
  renderStats(window.C); updateBar();
  checkAchievements('live');
}
function openLivingDilemma(kind){
  slipOpen=true; document.body.classList.add('slip-open');
  const guardians=guardiansOf(), grip=parentGrip(), warmthAvg=avgWarmth(guardians);
  const names=guardians.length?guardians.map(p=>p.name).join(' and '):'no one left to ask';
  const card=$('#slipCard'); card.className='slipcard crisis';
  let body='', title='', opts=[];
  if(kind==='leave-request'){
    if(!guardians.length){ slipOpen=false; document.body.classList.remove('slip-open'); resolveLivingLine('There was no one left to ask. Subject simply went.',{},true,true); return; }
    if(grip>=55){
      title='They Don’t Want You To Go';
      body=names+(guardians.length>1?' do':' does')+' not want you to go. Not yet. Maybe not ever.';
      opts=[
        {label:'Insist and leave anyway',cls:'no',sub:'guaranteed — but it costs you',
          run:()=>{ const sev=Math.round(grip/12); resolveLivingLine('Subject left anyway, over every objection. The door did not close gently.',{happiness:-4-sev,relations:-6-sev},true,true); }},
        {label:'Talk it through',cls:'maybe',sub:P(clamp(0.3+(S.relations-50)/200,0.1,0.85))+' chance to leave on good terms',
          run:()=>{ const p=clamp(0.3+(S.relations-50)/200,0.1,0.85);
            if(chance(p)) resolveLivingLine('Subject talked it through, patiently, and it worked. A blessing of sorts, and a door left open behind them.',{happiness:3,relations:2},true,true);
            else resolveLivingLine('Subject tried to talk it through. It did not land, not this year. Subject stayed, for now.',{happiness:-2},false,false); }},
        {label:'Stay a while longer',cls:'ok',sub:'no move — try again another year',
          run:()=>{ resolveLivingLine('Subject let the matter rest, for now, and stayed under the old roof a while longer.',{},false,false); }},
      ];
    } else {
      title='Time To Move Out?';
      body=names+' won’t stand in your way.';
      opts=[
        {label:'Move out',cls:'ok',sub:'a clean, amicable start',
          run:()=>{ resolveLivingLine('Subject packed what there was to pack and left with well-wishes, such as they were.',{happiness:2},true,true); }},
        {label:'Stay a while longer',cls:'maybe',sub:'no rush — the door stays open',
          run:()=>{ resolveLivingLine('Subject stayed a while longer. No one seemed to mind either way.',{},false,false); }},
      ];
    }
  } else if(kind==='age-out'){
    title='Time To Move Out';
    body='Old enough now that the house has quietly run out of reasons to keep you.';
    opts=[{label:'Move out',cls:'ok',sub:'time to go, on decent terms',
      run:()=>{ resolveLivingLine('Subject moved out at last — no drama, just the ordinary math of growing up.',{happiness:1},true,true); }}];
  } else if(kind==='orphaned'){
    title='No One Left To Keep The House';
    body='With no one left to keep the house, the child is now, in every practical sense, alone.';
    opts=[{label:'(no one left to ask)',cls:'no',sub:'',
      run:()=>{ resolveLivingLine('Subject was left to fend for themselves, with no one left to keep the house. Some kind soul might help. Most years, none did.',{happiness:-8,health:-3},true,false); }}];
  } else { // evict
    if(S.age<10){
      title='Put Out, Too Young';
      body='There is no more room at home for you. No one asked what you wanted.';
      opts=[{label:'(too young to have any say)',cls:'no',sub:'',
        run:()=>{ resolveLivingLine('Subject was put out of the house, small and much too young for it, and the record does not soften what that meant.',{happiness:-14,health:-6},true,false); }}];
    } else {
      title='Told To Leave';
      body=names+' decided you’re on your own now.';
      const p=clamp(0.15+(S.relations-40)/150+(warmthAvg-40)/200,0.03,0.7);
      opts=[
        {label:'Plead to stay',cls:'maybe',sub:P(p)+' chance to be let stay',
          run:()=>{ if(chance(p)) resolveLivingLine('Subject pleaded, and — against odds — was let stay a while longer.',{happiness:-1,relations:2},false,false);
            else resolveLivingLine('Subject pleaded. It did not move them. Out the door, whether ready or not.',{happiness:-8,relations:-3},true,false); }},
        {label:'Accept it',cls:'no',sub:'go, with whatever you can carry',
          run:()=>{ resolveLivingLine('Subject accepted it without a scene, and went, with whatever could be carried.',{happiness:-4},true,false); }},
      ];
    }
  }
  let optsHtml=''; opts.forEach((o,i)=>{ optsHtml+='<button class="sl-btn '+o.cls+'" data-o="'+i+'">'+o.label+(o.sub?'<small>'+o.sub+'</small>':'')+'</button>'; });
  card.innerHTML='<div class="sl-head crisis"><span>LIVING SITUATION · YEAR '+S.age+'</span><span class="sl-req">SUBJECT MUST CHOOSE</span></div>'+
    '<div class="sl-title crisis">'+title+'</div>'+
    '<p class="sl-body">'+body+'</p><p class="sl-note">However this goes, the record moves forward.</p>'+
    '<div class="sl-actions">'+optsHtml+'</div>';
  card.onclick=e=>{ const b=e.target.closest('[data-o]'); if(!b) return; const idx=+b.dataset.o;
    $('#slipWrap').classList.add('hidden'); slipOpen=false; document.body.classList.remove('slip-open'); card.onclick=null;
    opts[idx].run(); updateBar(); if(!S.alive) handleDeath(); };
  $('#slipWrap').classList.remove('hidden'); snd('paper'); updateBar();
}
function checkGuardianEviction(){
  if(!S.livingAtHome) return false;
  if(guardTier()==='none'){ openLivingDilemma('orphaned'); return true; }
  if(S.age>=26){ openLivingDilemma('age-out'); return true; }
  if(guardTier()!=='toxic') return false;
  let p=0.025; if(S.age<16) p*=0.6;
  if(!chance(p)) return false;
  openLivingDilemma('evict');
  return true;
}
function checkParentingStyleChoice(){
  if(!S.alive||S.kids<1||S.parentingStyle) return false;
  openCrisis(PARENTING_STYLE_CHOICE);
  return true;
}
/* ================= SCHOOLING (lower/middle/upper/university, gated by parenting) ================= */
function syncEduJobTitle(){
  const activeStage=S.eduStage||(S.education&&S.education.stageId);
  if(activeStage){ const st=SCHOOL_STAGES.find(x=>x.id===activeStage); if(st){ S.jobName=st.pupilTitle; S.jobTier=0; S.career=null; } return; }
  if(S.jobTier>0) return;
  if(S.jailUntil>S.age) return;
  if(S.jobName&&S.jobName.startsWith('Pensioner')) return;
  S.jobName=S.age<16?'Minor':'Unemployed';
}
function schoolYearTick(){
  if(typeof ensureEducationState!=='function') return;
  const e=ensureEducationState(S);
  if(!e.stageId) return;
  const stage=SCHOOL_STAGES.find(x=>x.id===e.stageId); if(!stage) return;
  const inst=typeof institutionById==='function'?institutionById(e.institutionId):null;
  const quality=inst?inst.quality:1;
  const attendanceShift=(S.health<35?-10:0)+(S.happiness<30?-8:0)+(S.assets<0?-4:0)-(typeof medicalEducationPenalty==='function'?medicalEducationPenalty(S):0);
  e.attendance=clamp((e.attendance==null?100:e.attendance)+attendanceShift,40,100);
  e.performance=clamp(Math.round((e.performance||50)*.65+(S.smarts||50)*.2+(S.happiness||50)*.08+(S.health||50)*.07),0,100);
  const academicPoints=stage.smartsPerYear*quality*(.72+e.performance/360)+(e.smartsRemainder||0);
  const gain=Math.max(1,Math.floor(academicPoints));
  e.smartsRemainder=academicPoints-gain;
  S.smarts=clamp(S.smarts+gain,0,100);
  const skillPool=typeof educationTrainingSkills==='function'?educationTrainingSkills(stage,inst,e.majorId):[];
  const skillCap=typeof educationTrainingCap==='function'?educationTrainingCap(stage):0;
  const trained=[];
  const thisYearsSkills=stage.id==='university'?skillPool:skillPool.length?[skillPool[(e.yearsIn||0)%skillPool.length]]:[];
  thisYearsSkills.forEach(skill=>{
    if(SKILLS[skill]&&S.age>=SKILLS[skill].minAge&&(S.skills[skill]||0)<skillCap){
      const point=chance(clamp(.7+e.performance/300,.7,.98))?1:0;
      if(!point) return;
      S.skills[skill]=clamp((S.skills[skill]||0)+point,0,10);
      if(typeof educationRecordSkill==='function') educationRecordSkill(skill,S.skills[skill]);
      trained.push(skill);
    }
  });
  if(trained.length) logEv('EDUCATION TRAINING. '+trained.map(id=>SKILLS[id].name).join(' + ')+' improved through '+(inst?inst.name:stage.name)+'.',{},'milestone','SCHOOLING · YEAR '+S.age);
  const fee=typeof educationAnnualPayment==='function'?educationAnnualPayment():0;
  if(fee){
    if(e.funding==='studentloan') e.tuitionDebt=(e.tuitionDebt||0)+fee;
    else if(S.assets>=fee) S.assets-=fee;
    else { e.tuitionDebt=(e.tuitionDebt||0)+(fee-Math.max(0,S.assets||0)); S.assets=Math.max(0,S.assets||0); }
  }
  const commuteFee=typeof educationAnnualCommuteCost==='function'?educationAnnualCommuteCost():0;
  if(commuteFee){
    if(S.assets>=commuteFee) S.assets-=commuteFee;
    else { e.travelDebt=(e.travelDebt||0)+(commuteFee-Math.max(0,S.assets||0)); S.assets=Math.max(0,S.assets||0); }
  }
  e.yearsIn=(e.yearsIn||0)+1;
  if(e.yearsIn>=stage.years){
    e.completed=e.completed||{}; e.completed[stage.id]=true;
    if(stage.id==='university') S.edu=true;
    e.history.push({kind:'graduation',stage:stage.id,institutionId:e.institutionId,majorId:e.majorId,year:currentYear(),performance:e.performance,attendance:e.attendance});
    logEv(stage.completeText,stage.completeFx,'milestone','MILESTONE · YEAR '+S.age);
    const educationDebt=Math.round((e.tuitionDebt||0)+(e.travelDebt||0));
    if(educationDebt>0){
      const t=LIABILITY_TYPES.studentloan;
      const financed=Object.assign({},t,{principal:Math.max(t.principal,educationDebt)});
      S.liabilities.push({id:financed.id,name:financed.name,icon:financed.icon,yearsLeft:financed.years,annualPayment:liabilityPayment(financed)});
      e.tuitionDebt=0; e.travelDebt=0;
      logEv('The bursar’s office sent along the bill for the degree, payable over the years ahead.',{});
    }
    e.stageId=null; e.yearsIn=stage.years; e.status='graduated';
    S.eduStage=null;
    if(typeof educationSyncLegacy==='function') educationSyncLegacy(S);
    const idx=SCHOOL_STAGES.findIndex(x=>x.id===stage.id), next=SCHOOL_STAGES[idx+1];
    if(next&&!S.eduCompleted[next.id]) S.pendingSchoolStage=next.id;
    syncEduJobTitle();
    return;
  }
  if(typeof educationSyncLegacy==='function') educationSyncLegacy(S);
}
function schoolInfoHTML(){
  if(!S.eduStage) return '';
  if(typeof ensureEducationState==='function') ensureEducationState(S);
  const e=S.education||{};
  const stage=SCHOOL_STAGES.find(x=>x.id===S.eduStage); if(!stage) return '';
  const inst=typeof institutionById==='function'?institutionById(S.education&&S.education.institutionId):null;
  const major=S.education&&S.education.majorId&&MAJORS[S.education.majorId];
  const training=typeof educationTrainingLabel==='function'?educationTrainingLabel(stage,inst,S.education&&S.education.majorId):'';
  return '<div class="hs-info"><b>'+stage.name+'</b>'+
    (inst?'<div class="hs-info-row">'+inst.name+' · quality '+Math.round(inst.quality*100)+'%</div>':'')+
     (major?'<div class="hs-info-row">Major: '+major.name+'</div>':'')+
     '<div class="hs-info-row">Year '+((S.eduYearsIn||0)+1)+' of '+stage.years+'</div>'+
     '<div class="hs-info-row">Attendance '+(e.attendance==null?100:e.attendance)+'% · performance '+(e.performance==null?50:e.performance)+'</div>'+
     '<div class="hs-info-row">Funding: '+(typeof educationFundingLabel==='function'?educationFundingLabel(inst,e.funding):e.funding||'not recorded')+'</div>'+
     '<div class="hs-info-row">Residence: '+(e.residenceMode||S.residenceMode||'not recorded')+'</div>'+
     ((e.tuitionDebt||e.travelDebt)?'<div class="hs-info-row">Education debt '+money((e.tuitionDebt||0)+(e.travelDebt||0))+'</div>':'')+
    '<div class="hs-info-row">~'+(stage.smartsPerYear*(inst?inst.quality:1)).toFixed(1)+' SMARTS/yr from quality — no work while attending</div>'+
    '<div class="hs-info-row">Training: '+training+'</div></div>';
}
function resolveSchoolLine(text,fx){
  window.C={};
  const chips=fx?applyFx(fx):[];
  logChips(fill(text),chips,'crisis','SCHOOLING · YEAR '+S.age);
  renderStats(window.C); updateBar();
  checkAchievements('live');
}
function openSchoolSlipLegacy(stage){
  slipOpen=true; document.body.classList.add('slip-open');
  const guardians=guardiansOf(), grip=parentGrip();
  const names=guardians.length?guardians.map(p=>p.name).join(' and '):'no one';
  const viaParent=schoolViaParent(stage);
  const viaScholar=!viaParent&&schoolViaScholar(stage);
  const card=$('#slipCard'); card.className='slipcard crisis';
  let body='', title='', opts=[];
  function enroll(text,fx){ return ()=>{ S.eduStage=stage.id; S.eduYearsIn=0; syncEduJobTitle(); resolveSchoolLine(text,fx||{}); }; }
  function skip(text,fx){ return ()=>{ if(typeof educationMarkStageMissed==='function') educationMarkStageMissed(stage,S,'The subject declined or could not secure this school place.'); return resolveSchoolLine(text,fx||{}); }; }
  if(viaParent){
    if(grip>=55){
      title='Enrolled, No Say In It';
      body=names+' enrolled you at '+stage.name+'. No one asked what you wanted.';
      opts=[{label:'(no say in the matter)',cls:'ok',sub:'',run:enroll('Subject was enrolled at '+stage.name+', whether they liked it or not.',{happiness:-1})}];
    } else {
      title=stage.name+'? Your Choice';
      body=names+' left the choice up to you. Attend '+stage.name+'?';
      opts=[
        {label:'Attend '+stage.name,cls:'ok',sub:'+SMARTS over time · no work while enrolled',run:enroll('Subject chose to attend '+stage.name+'.',{happiness:2})},
        {label:'Decline — '+stage.declineNote,cls:'no',sub:'+HAPPINESS now · SMARTS growth slows',run:skip('Subject chose to skip '+stage.name+'. Better, for now, to '+stage.declineNote+'.',{happiness:3})},
      ];
    }
  } else if(viaScholar){
    const p=clamp(0.3+(S.smarts-stage.scholarSmarts)/100,0.15,0.75);
    title='A Scholarship Chance';
    body='No one at home is arranging school — but '+stage.name+' keeps places open for bright students who can’t otherwise afford it. Try for it?';
    opts=[
      {label:'Try for the scholarship',cls:'maybe',sub:P(p)+' chance',run:()=>{ if(chance(p)) enroll('Subject won a scholarship to '+stage.name+' — the one door that opened on its own.',{happiness:4})();
        else skip('Subject tried for a scholarship to '+stage.name+' and did not get it. The door stayed shut.',{happiness:-3})(); }},
      {label:'Don’t bother',cls:'no',sub:'',run:skip('Subject didn’t bother trying for a place at '+stage.name+'. No one would have paid for it anyway.',{})},
    ];
  } else {
    title='No School This Year';
    body='No one is arranging school for you — not this year, maybe not ever.';
    opts=[{label:'(no school this year)',cls:'no',sub:'',run:skip('No one arranged schooling. Subject stayed home, and the years kept moving anyway.',{happiness:-2})}];
  }
  let optsHtml=''; opts.forEach((o,i)=>{ optsHtml+='<button class="sl-btn '+o.cls+'" data-o="'+i+'">'+o.label+(o.sub?'<small>'+o.sub+'</small>':'')+'</button>'; });
  card.innerHTML='<div class="sl-head crisis"><span>SCHOOLING · YEAR '+S.age+'</span><span class="sl-req">'+(viaParent&&grip>=55?'THE FAMILY DECIDES':'SUBJECT MUST CHOOSE')+'</span></div>'+
    '<div class="sl-title crisis">'+title+'</div>'+
    '<p class="sl-body">'+body+'</p><p class="sl-note">However this goes, the record moves forward.</p>'+
    '<div class="sl-actions">'+optsHtml+'</div>';
  card.onclick=e=>{ const b=e.target.closest('[data-o]'); if(!b) return; const idx=+b.dataset.o;
    $('#slipWrap').classList.add('hidden'); slipOpen=false; document.body.classList.remove('slip-open'); card.onclick=null;
    opts[idx].run(); updateBar(); if(!S.alive) handleDeath(); };
  $('#slipWrap').classList.remove('hidden'); snd('paper'); updateBar();
}
function openSchoolSlip(stage){
  slipOpen=true; document.body.classList.add('slip-open');
  if(typeof ensureEducationState==='function') ensureEducationState(S);
  const guardians=guardiansOf(), grip=parentGrip();
  const names=guardians.length?guardians.map(p=>p.name).join(' and '):'no one';
  const viaParent=schoolViaParent(stage);
  const viaScholar=!viaParent&&schoolViaScholar(stage);
  const options=typeof educationOptionsForStage==='function'?educationOptionsForStage(stage):[];
  const card=$('#slipCard'); card.className='slipcard crisis';
  function optionSub(pair){
    const inst=pair.inst, remote=inst.settlementId!==World.activeSettlementId;
    const specialty=inst.specialties&&inst.specialties.length?' · '+inst.specialties.map(id=>SKILLS[id]?SKILLS[id].name:id).join(', '):'';
    const major=pair.major?' · '+educationMajorLabel(pair.major):'';
    const training=typeof educationTrainingLabel==='function'?educationTrainingLabel(stage,inst,pair.major):'';
    return money(inst.tuition)+'/yr · quality '+Math.round(inst.quality*100)+'%'+specialty+major+' · '+(remote?'relocation required':'local')+' · '+training;
  }
  function enroll(pair,funding,allowFunding,residenceMode){ return ()=>{
    if(!allowFunding&&(!funding||(funding==='family'&&viaParent&&grip<55))){
      renderFundingForPair(pair,null);
      $('#slipWrap').classList.remove('hidden');
      return;
    }
    const remote=pair.inst.settlementId!==World.activeSettlementId;
    if(remote&&stage.id==='university'&&!residenceMode){
      renderResidenceForPair(pair,funding);
      $('#slipWrap').classList.remove('hidden');
      return;
    }
    S.eduStage=stage.id; S.eduYearsIn=0;
    educationEnroll(stage,pair.inst,pair.major,funding,residenceMode);
    const residenceText=remote?(residenceMode==='commute'?' A commuter route was filed.':' Residence transferred immediately for study.'):'';
    resolveSchoolLine('Subject enrolled at '+pair.inst.name+(pair.major?' to study '+educationMajorLabel(pair.major):'')+'.'+residenceText,{happiness:stage.id==='university'?2:1});
  }; }
  function skip(text,fx){ return ()=>{ if(typeof educationMarkStageMissed==='function') educationMarkStageMissed(stage,S,'The subject declined or could not secure this school place.'); return resolveSchoolLine(text,fx||{}); }; }
  function closeAndRun(run){
    $('#slipWrap').classList.add('hidden'); slipOpen=false; document.body.classList.remove('slip-open'); card.onclick=null;
    run(); updateBar(); if(!S.alive) handleDeath();
  }
  function renderFundingForPair(pair,back){
    const funds=typeof educationFundingOptions==='function'?educationFundingOptions(stage,pair.inst,viaParent,viaScholar):[];
    const opts=funds.map(fund=>({label:fund.label,cls:fund.kind==='debt'?'maybe':'ok',sub:educationFundingLabel(pair.inst,fund.id)+' · '+fund.desc,run:enroll(pair,fund.id,true)}));
    if(back) opts.push({label:'Back to institutions',cls:'maybe',sub:'Choose a different place',show:back});
    render('How Will This Be Funded?',pair.inst.name+' is available. Select the payment route before the record is filed.',stage.id==='university'?'The selected route affects yearly assets and education debt.':'The listed tuition is the institution\'s annual cost.',opts,'SUBJECT MUST CHOOSE');
  }
  function renderResidenceForPair(pair,funding){
    const to=settlementById(pair.inst.settlementId), fare=to?travelCost(currentSettlement(),to):0;
    const opts=[
      {label:'Move to campus',cls:'ok',sub:'one transfer fare '+money(fare)+' · student residence follows the institution',run:enroll(pair,funding,true,'relocate')},
      {label:'Commute to campus',cls:'maybe',sub:'stay here · yearly route cost estimated at '+money(Math.round(fare*1.5))+' · may become travel debt',run:enroll(pair,funding,true,'commute')}
    ];
    render('Where Will You Live?',pair.inst.name+' is outside the current settlement. Choose the residence plan before enrollment.', 'Campus residence is simpler. Commuting preserves the current home but adds a yearly route cost.',opts,'SUBJECT MUST CHOOSE');
  }
  function render(title,body,note,opts,req){
    let optsHtml=''; opts.forEach((o,i)=>{optsHtml+='<button class="sl-btn '+o.cls+'" data-o="'+i+'">'+o.label+(o.sub?'<small>'+o.sub+'</small>':'')+'</button>';});
    card.innerHTML='<div class="sl-head crisis"><span>SCHOOLING · YEAR '+S.age+'</span><span class="sl-req">'+req+'</span></div>'+
      '<div class="sl-title crisis">'+title+'</div><p class="sl-body">'+body+'</p>'+
      '<p class="sl-note">'+note+'</p><div class="sl-actions school-choice-actions">'+optsHtml+'</div>';
    card.onclick=e=>{const b=e.target.closest('[data-o]');if(!b)return;const option=opts[+b.dataset.o];if(option.run) closeAndRun(option.run);else if(option.show) option.show();};
  }
  function renderUniversityInstitutions(major){
    const matching=options.filter(inst=>educationMajorOptions(inst).includes(major));
    const funding=viaParent?'family':viaScholar?'scholarship':null;
    const pBase=clamp(0.3+(S.smarts-stage.scholarSmarts)/100,0.15,0.75);
    const opts=matching.map(inst=>{
      const pair={inst,major};
      if(viaScholar){
        const p=clamp(pBase+(inst.quality-1)*.35-(inst.tuition-500)/3000,.10,.82);
        return {label:inst.name,cls:'maybe',sub:P(p)+' chance · '+optionSub(pair),run:()=>{if(chance(p)) enroll(pair,funding)();else skip('Subject tried for a scholarship to '+inst.name+' and did not get it. The door stayed shut.',{happiness:-3})();}};
      }
      return {label:inst.name,cls:'ok',sub:optionSub(pair),run:enroll(pair,funding)};
    });
    opts.push({label:'← Back to majors',cls:'maybe',sub:'Choose a different course of study',show:renderUniversityMajors});
    render('Study '+educationMajorLabel(major),viaScholar?'Choose a university offering this major and apply for its funded seat.':'Choose where to study '+educationMajorLabel(major)+'.','University options are scrollable. A campus outside your residence requires relocation.',opts,'SUBJECT MUST CHOOSE');
  }
  function renderUniversityMajors(){
    const majors=[...new Set(options.flatMap(inst=>educationMajorOptions(inst)))];
    const opts=majors.map(major=>{
      const count=options.filter(inst=>educationMajorOptions(inst).includes(major)).length;
      const careers=(MAJORS[major]&&MAJORS[major].careers||[]).map(id=>{const track=CAREERS.find(c=>c.id===id);return track?track.name:id;}).join(', ');
      return {label:educationMajorLabel(major),cls:'ok',sub:count+' university '+(count===1?'option':'options')+' · trains '+MAJORS[major].skills.map(id=>SKILLS[id].name).join(' + ')+' · specialist paths: '+(careers||'none'),show:()=>renderUniversityInstitutions(major)};
    });
    if(viaParent) opts.push({label:'Decline — '+stage.declineNote,cls:'no',sub:'+HAPPINESS now · education opportunity lost',run:skip('Subject chose to skip '+stage.name+'. Better, for now, to '+stage.declineNote+'.',{happiness:3})});
    else opts.push({label:'Do not bother',cls:'no',sub:'',run:skip('Subject did not try for a funded university place. No one would have paid for it anyway.',{})});
    render('Choose Your Major',viaScholar?'No one at home is arranging university. First choose a field, then a campus offering it.':names+' left the university decision to you. First choose a field of study.','Your major controls which specialist careers you can enter after graduation.',opts,'SUBJECT MUST CHOOSE');
  }
  const canSelfFund=stage.id==='university'&&S.age>=18&&options.length;
  if(stage.id==='university'&&(viaParent||viaScholar||canSelfFund)&&!(viaParent&&grip>=55)){
    if(!options.length) render('No University Available','There is no qualifying university available from the current residence.','The year kept moving anyway.',[{label:'(no university this year)',cls:'no',sub:'',run:skip('No qualifying university was available. The year kept moving anyway.',{happiness:-2})}],'SUBJECT MUST CHOOSE');
    else renderUniversityMajors();
    $('#slipWrap').classList.remove('hidden'); snd('paper'); updateBar();
    return;
  }
  const pairs=options.map(inst=>({inst,major:null}));
  let title='',body='',opts=[];
  if(!pairs.length){
    title='No Institution Available';
    body='There is no qualifying institution available from the current residence.';
    opts=[{label:'(no school this year)',cls:'no',sub:'',run:skip('No qualifying institution was available. The year kept moving anyway.',{happiness:-2})}];
  }else if(viaParent&&grip>=55){
    const chosen=educationParentChoice(stage,options);
    const major=stage.id==='university'?educationMajorOptions(chosen)[0]:null;
    const pair={inst:chosen,major};
    title='Enrolled, No Say In It';
    body=names+' selected the institution. No one asked what you wanted.';
    opts=[{label:chosen.name+(major?' · '+educationMajorLabel(major):''),cls:'ok',sub:optionSub(pair),run:enroll(pair,'family')}];
  }else if(viaParent){
    title=stage.id==='university'?'University? Your Choice':'Choose Your '+stage.name;
    body=names+' left the choice up to you. Select an institution or decline.';
    opts=pairs.map(pair=>({label:pair.inst.name+(pair.major?' · '+educationMajorLabel(pair.major):''),cls:'ok',sub:optionSub(pair),run:enroll(pair,'family')}));
    opts.push({label:'Decline — '+stage.declineNote,cls:'no',sub:'+HAPPINESS now · education opportunity lost',run:skip('Subject chose to skip '+stage.name+'. Better, for now, to '+stage.declineNote+'.',{happiness:3})});
  }else if(viaScholar){
    const pBase=clamp(0.3+(S.smarts-stage.scholarSmarts)/100,0.15,0.75);
    title='A Scholarship Chance';
    body='No one at home is arranging school. Choose a place and try to win its funded seat.';
    opts=pairs.map(pair=>{
      const p=clamp(pBase+(pair.inst.quality-1)*.35-(pair.inst.tuition-500)/3000,.10,.82);
      return {label:'Try '+pair.inst.name+(pair.major?' · '+educationMajorLabel(pair.major):''),cls:'maybe',sub:P(p)+' chance · '+optionSub(pair),run:()=>{if(chance(p)) enroll(pair,'scholarship')();else skip('Subject tried for a scholarship to '+pair.inst.name+' and did not get it. The door stayed shut.',{happiness:-3})();}};
    });
    opts.push({label:'Do not bother',cls:'no',sub:'',run:skip('Subject did not try for a funded place. No one would have paid for it anyway.',{})});
  }else{
    title='No School This Year';
    body='No one is arranging school for you — not this year, maybe not ever.';
    opts=[{label:'(no school this year)',cls:'no',sub:'',run:skip('No one arranged schooling. Subject stayed home, and the years kept moving anyway.',{happiness:-2})}];
  }
  render(title,body,'Quality affects learning. Cost, funding, and residence are filed before enrollment.',opts,viaParent&&grip>=55?'THE FAMILY DECIDES':'SUBJECT MUST CHOOSE');
  $('#slipWrap').classList.remove('hidden'); snd('paper'); updateBar();
}
function checkSchoolTransition(){
  if(!S.alive||S.eduStage||(S.education&&S.education.stageId)) return false;
  let stage=null;
  if(S.pendingSchoolStage){
    const pending=SCHOOL_STAGES.find(x=>x.id===S.pendingSchoolStage);
    if(pending&&S.age<pending.startAge) return false;
    if(pending&&S.age<=pending.endAge){ stage=pending; S.pendingSchoolStage=null; }
    else S.pendingSchoolStage=null;
  }
  if(stage&&typeof educationStageWasMissed==='function'&&educationStageWasMissed(stage,S)) stage=null;
  if(!stage) stage=SCHOOL_STAGES.find(x=>S.age>=x.startAge&&S.age<=x.endAge&&!(S.eduCompleted&&S.eduCompleted[x.id])&&!(typeof educationStageWasMissed==='function'&&educationStageWasMissed(x,S)));
  if(!stage) return false;
  if(typeof educationStageAgeAvailable==='function'&&!educationStageAgeAvailable(stage,S)) return false;
  if(S.eduCompleted&&S.eduCompleted[stage.id]) return false;
  if(typeof ensureEducationState==='function') ensureEducationState(S);
  if(S.education.lastOpportunityYear&&S.education.lastOpportunityYear[stage.id]===S.age) return false;
  if(typeof educationMigratePassedOpportunity==='function'&&educationMigratePassedOpportunity(stage,S)) return false;
  if(S.education.lastOpportunityYear) S.education.lastOpportunityYear[stage.id]=S.age;
  if(typeof educationStageAvailable==='function'&&!educationStageAvailable(stage,S)){
    const prerequisite=typeof educationStagePrerequisite==='function'?educationStagePrerequisite(stage):null;
    if(typeof educationMarkStageMissed==='function') educationMarkStageMissed(stage,S,'A required prior school stage was not completed.');
    logEv('EDUCATION BLOCKED. '+stage.name+' could not begin because '+(prerequisite?prerequisite.name:'the required prior course')+' was not completed.',{happiness:-1},'milestone','SCHOOLING · YEAR '+S.age);
    renderStats(window.C||{}); updateBar();
    openNotice({title:'PREREQUISITE NOT MET',body:(prerequisite?prerequisite.name:'The prior school stage')+' must be completed before '+stage.name+'. This enrollment opportunity has passed.'});
    return true;
  }
  const options=typeof educationOptionsForStage==='function'?educationOptionsForStage(stage):[];
  const guardians=guardiansOf(), parentEnrolling=schoolViaParent(stage);
  if(parentEnrolling&&parentGrip()>=55&&options.length){
    const institution=educationParentChoice(stage,options);
    const major=stage.id==='university'?educationMajorOptions(institution)[0]:null;
    S.eduStage=stage.id; S.eduYearsIn=0;
    educationEnroll(stage,institution,major,'family');
    logEv('FAMILY ENROLLMENT. '+guardians.map(p=>p.name).join(' and ')+' enrolled the subject at '+institution.name+(major?' for '+educationMajorLabel(major):'')+'.',{happiness:-1},'milestone','SCHOOLING · YEAR '+S.age);
    syncEduJobTitle();
    renderIdentity(); renderStats(window.C||{}); updateBar();
    openNotice({
      title:'SCHOOL ENROLLMENT FILED',
      body:guardians.map(p=>p.name).join(' and ')+' enrolled you at '+institution.name+(major?' for '+educationMajorLabel(major):'')+'. Their decision was made without asking you.'
    });
    return true;
  }
  if(guardians.length&&!parentEnrolling&&!schoolViaScholar(stage)){
    if(typeof educationMarkStageMissed==='function') educationMarkStageMissed(stage,S,'The family did not arrange enrollment.');
    logEv('FAMILY RULING. '+guardians.map(p=>p.name).join(' and ')+' did not enroll the subject in '+stage.name+'.',{happiness:-2},'milestone','SCHOOLING · YEAR '+S.age);
    renderStats(window.C||{}); updateBar();
    openNotice({
      title:'SCHOOLING WITHHELD',
      body:guardians.map(p=>p.name).join(' and ')+' decided not to enroll you in '+stage.name+'.'
    });
    return true;
  }
  openSchoolSlip(stage);
  return true;
}
function runHoldTick(){
  if(!S.holdMember) return;
  const memberCount=livingHoldMembers().length;
  let districtFunds=0, districtSupplies=0, districtHeat=0;
  Hold.districts.forEach(id=>{const d=DISTRICTS.find(x=>x.id===id); if(d){districtFunds+=d.funds;districtSupplies+=d.supplies;districtHeat+=d.heat;}});
  Hold.heat=clamp(Hold.heat+(memberCount>0?memberCount*0.4:0)+districtHeat-1.5,0,100);
  Hold.resources.funds=Math.max(0,Hold.resources.funds+districtFunds-(5+memberCount*3));
  Hold.resources.supplies=Math.max(0,Hold.resources.supplies+districtSupplies);
  const alive=livingHoldMembers();
  if(alive.length){ const avgLoy=alive.reduce((a,m)=>a+holdLoyalty(m),0)/alive.length; Hold.trust=clamp(Math.round(Hold.trust*0.95+avgLoy*0.05),0,100); }
}
function advanceYear(suppressBurst,quiet){
  if(!S||!S.alive||slipOpen) return;
  if(S.age>0) evaluateYearStreak(quiet);
  yearLog=[]; collectingYear=true;
  S.age++; World.year++;
  // The world tick runs after the calendar advances and before travel, economy,
  // and personal systems. It establishes this year's settlement conditions;
  // every existing yearly call remains in its original order after this point.
  if(typeof WorldSimulation==='object'&&WorldSimulation&&typeof WorldSimulation.tick==='function') WorldSimulation.tick(World,{random:Random,year:World.year});
  if(typeof NpcSystem==='object'&&NpcSystem&&typeof NpcSystem.tick==='function'){
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,deferHousehold:true});
    const npcNotices=typeof NpcSystem.drainNotices==='function'?NpcSystem.drainNotices(World):[];
    npcNotices.slice(0,4).forEach(notice=>{
      const cls=notice.type==='death'?'crisis':'milestone';
      logEv('CONNECTED LIFE. '+NpcSystem.noticeText(World,notice),{},cls,'HOUSEHOLD FILE · YEAR '+S.age);
    });
    if(npcNotices.length>4) logEv((npcNotices.length-4)+' other connected-life changes were filed in summary.',{},'milestone','HOUSEHOLD FILE · YEAR '+S.age);
  }
  resolveTravel(); runHoldTick(); snd('stamp'); shake(); window.C={};
  runFollowups(); runHistory(); runMilestones(); runEconomy();
  if(typeof HouseholdSystem==='object'&&HouseholdSystem&&typeof HouseholdSystem.tick==='function') HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid,subjectAssetsBefore:S.__householdAssetsBeforeEconomy,subjectAssetsAfterEconomy:S.assets,subjectExpensesPaid:S.__householdSubjectExpensesPaid,subjectEconomySettled:true}).forEach(notice=>{
    if(typeof NpcSystem==='object'&&NpcSystem&&typeof NpcSystem.noticeText==='function') logEv('CONNECTED LIFE. '+NpcSystem.noticeText(World,notice),{},'milestone','HOUSEHOLD FILE · YEAR '+S.age);
  });
  runPersonalYearTick();
  if(S.jobTier===0&&S.age>=16&&S.age<65) rollJobVacancies();
  const __newStage=stageForAge(S.age);
  if(__newStage!==S.stage){ S.stage=__newStage; queueChapterCard(__newStage); renderStage(); }
  resolvePlan();
  runAffairs();
  runReverseAffairs();
  tickSkills();
  checkCareerProgress();
  guardianTeachTick();
  guardianAmbientTick();
  guardianIncidentTick();
  schoolYearTick();
  runRandomEvents();
  if(S.alive) checkMortality();
  if(S.alive){ S.hapSum+=S.happiness; S.hapYears++; S.peakHap=Math.max(S.peakHap,S.happiness); }
  collectingYear=false;
  fileRecentYearReport();
  renderStats(window.C); renderYear(); updateBar();
  checkAchievements('live');
  if(S.alive){
    if(checkSchoolTransition()){}
    else if(S.__pendingDiscovery){ const ctx=S.__pendingDiscovery; S.__pendingDiscovery=null; dispatchDiscoveryReaction(ctx); }
    else if(S.__pendingReverseDiscovery){ const ctx=S.__pendingReverseDiscovery; S.__pendingReverseDiscovery=null; dispatchReverseDiscoveryReaction(ctx); }
    else if(S.__pendingTheirSpouseNotice){ const n=S.__pendingTheirSpouseNotice; S.__pendingTheirSpouseNotice=null; openNotice(n); }
    else if(S.__pendingGuardianNotice){ const gp=S.__pendingGuardianNotice; S.__pendingGuardianNotice=null; openGuardianNotice(gp); }
    else if(!checkGuardianEviction()&&!checkParentingStyleChoice()) maybeSlip();
  }
  if(!S.alive) handleDeath();
}
YearEngine.configure((suppressBurst,quiet)=>advanceYear(suppressBurst,quiet));
function advance(suppressBurst,quiet){ return YearEngine.advance({suppressBurst,quiet}); }
function fastForward(){
  if(!S||!S.alive||slipOpen) return;
  let years=0; quietMode=true;
  while(S.alive && !slipOpen && years<15){ advance(true,true); years++; }
  quietMode=false;
}
function queueGuardianNotice(kind,text,chips){ S.__pendingGuardianNotice={kind,text,chips}; }
function openGuardianNotice(gp){
  openNotice({title: gp.kind==='bad'?'It Happened Again':'A Good Moment At Home', body: gp.text, chips: gp.chips});
  if(gp.kind==='bad'&&navigator.vibrate) navigator.vibrate([50,40,50,40,80]);
}
function spawnParticles(tier,good,tape){
  const counts={small:8,medium:18,large:32}; const n=counts[tier]||8;
  const wrap=$('#fxParticles'); if(!wrap) return;
  for(let i=0;i<n;i++){
    const s=document.createElement('span');
    s.className='scrap'+(tape?' tape':'')+(good?(chance(.3)?' gold':''):' ink');
    s.style.left=R(8,92)+'%';
    s.style.setProperty('--fall',R(220,420)+'px');
    s.style.setProperty('--spin',(chance(.5)?1:-1)*R(300,720)+'deg');
    s.style.animationDuration=R(0.9,1.6)+'s';
    s.style.animationDelay=R(0,0.25)+'s';
    wrap.appendChild(s);
    s.addEventListener('animationend',()=>s.remove());
  }
}
let toastQueue=[], toastTimer=null;
function queueAchievementToasts(list){ toastQueue.push(...list.map(a=>({type:'achievement',data:a}))); if(!toastTimer) showNextToast(); }
function queueChapterCard(stageId){ toastQueue.push({type:'chapter',data:{id:stageId,info:STAGE_INFO[stageId],unlocks:stageUnlocks(stageId)}}); if(!toastTimer) showNextToast(); }
function queuePromotionToast(track,stage){ toastQueue.push({type:'promotion',data:{track,stage}}); if(!toastTimer) showNextToast(); }
function showNextToast(){
  const item=toastQueue.shift();
  if(!item){ toastTimer=null; return; }
  const card=$('#achieveCard'), wrap=$('#achieveWrap');
  if(item.type==='chapter'){
    const st=item.data;
    const unlocksHtml=st.unlocks.length?'<div class="achieve-unlocks">Now open: '+st.unlocks.slice(0,5).join(', ')+(st.unlocks.length>5?'…':'')+'</div>':'';
    card.innerHTML='<div class="achieve-kicker">Section Opened</div>'+
      '<div class="achieve-name">'+st.info.name+'</div><div class="achieve-desc">'+st.info.blurb+'</div>'+unlocksHtml+'<div class="achieve-ribbon"></div>';
    card.classList.remove('promotion','discovery'); wrap.classList.remove('promotion','discovery');
    card.classList.add('chapter'); wrap.classList.add('chapter');
    wrap.classList.remove('hidden');
    snd('paper'); snd('chapter'); spawnParticles('medium',true,true);
    if(navigator.vibrate) navigator.vibrate([20,30,20,30,50]);
  } else if(item.type==='promotion'){
    const {track,stage}=item.data;
    card.innerHTML='<div class="achieve-kicker">Promoted</div>'+
      '<div class="achieve-name">'+stage.name+'</div><div class="achieve-desc">'+track.name+' · '+money(stage.salary)+'/yr</div><div class="achieve-ribbon"></div>';
    card.classList.remove('chapter'); card.classList.add('promotion'); wrap.classList.remove('chapter'); wrap.classList.add('promotion');
    wrap.classList.remove('hidden');
    snd('fanfare'); spawnParticles('large',true,true);
    if(navigator.vibrate) navigator.vibrate([30,40,30,40,70]);
  } else {
    const a=item.data;
    card.innerHTML='<div class="achieve-kicker">Commendation Issued</div>'+
      '<div class="achieve-name">'+a.name+'</div><div class="achieve-desc">'+a.desc+'</div><div class="achieve-ribbon"></div>';
    card.classList.remove('chapter','promotion'); wrap.classList.remove('chapter','promotion');
    wrap.classList.remove('hidden');
    snd('fanfare'); spawnParticles('large',true,true);
    if(navigator.vibrate) navigator.vibrate([30,40,30,40,70]);
  }
  toastTimer=setTimeout(()=>{ wrap.classList.add('hidden'); setTimeout(showNextToast,300); },4200);
}
/* ================= SUCCESSION ================= */
function handleDeath(){
  evaluateYearStreak(true);
  const g=grade(), ir=intentResult(), legacy=computeParentingLegacy();
  if(typeof NpcSystem==='object'&&NpcSystem&&typeof NpcSystem.markSubjectDeath==='function') NpcSystem.markSubjectDeath(World,S,Lineage);
  Lineage.pastSubjects.push({name:S.first+' '+S.last,dob:S.dob,deathYear:currentYear(),age:S.age,cause:S.cause,grade:g.g,intentName:ir.lab,intentStars:ir.stars,
    parentWarmth:legacy.warmth,parentStability:legacy.stability,parentYears:legacy.years,
    education:S.education?{completed:Object.assign({},S.education.completed||{}),majorId:S.education.majorId||null,certificates:Object.keys(S.education.certificates||{})}:null});
  const candidates=livingKin().filter(m=>(currentYear()-m.dob)>=16);
  if(candidates.length){ openSuccession(candidates); }
  else { closeFile(); }
}
function promoteToLeader(member){
  const previousSubjectNpcId=S&&S.npcId?S.npcId:null;
  const age=currentYear()-member.dob;
  const inheritedLocation=S&&S.location?Object.assign({},S.location):{settlementId:World.activeSettlementId,buildingId:World.activeBuildingId};
  const departedName=S?(S.first+' '+S.last):null, departedSex=S?S.sex:null;
  const legacy=S?computeParentingLegacy():{warmth:50,stability:50,years:0};
  const departedSkills=S&&S.skills?S.skills:{};
  const inheritedLifestyle=S&&S.lifestyle?Object.assign({},S.lifestyle):null;
  const newFam=inheritedLifestyle?null:pickWeighted(FAMILY_TIERS);
  const startLifestyle=inheritedLifestyle||{housing:newFam.housing,food:newFam.food,childcare:newFam.childcare};
  const lastRecord=Lineage.pastSubjects[Lineage.pastSubjects.length-1];
  const gradeBonus=lastRecord?({A:8,B:5,C:2,D:0,F:-3}[lastRecord.grade]||0):0;
  Lineage.members=Lineage.members.filter(m=>m.mid!==member.mid);
  S={sex:member.sex,first:member.first,last:member.last,dob:member.dob,age,alive:true,cause:'',relation:member.relation,
    health:RI(50,85),happiness:RI(45,75),smarts:clamp(RI(28,82)+gradeBonus,0,100),looks:RI(28,80),relations:clamp(member.bond||60,20,90),
    assets:0,jobTier:0,jobName:'Unemployed',pensionBase:0,
    status:'Single',partner:null,married:false,kids:0,
    partnerMood:0,friendMood:0,familyMood:0,
    friend:null,contacts:[],activeAffairCids:[],edu:false,record:false,vice:0,crime:0,jailUntil:0,favorCool:0,
    didCoast:false,didLeave:false,planted:false,peakHap:0,avgHap:0,hapSum:0,hapYears:0,acts:0,
    base:null,
    photoSeed:RI(0,99),photoTint:pick(TINTS),
    usedV:{},cool:{},desk:{subsidy:0,checkup:0,censure:0},warned:{},queue:[],usedNames:[],skills:{},practicedSkill:null,petDone:{},garnishUntil:0,bankrupt:false,autoTrain:false,marked:false,markedNote:'',healthCap:100,looksCap:100,
    streak:0,bestStreak:0,yearAccum:{},stage:stageForAge(age),career:null,vacancies:[],careerYears:0,
    eduStage:null,eduYearsIn:0,eduDropped:false,eduCompleted:{},pendingSchoolStage:null,
    familyTier:newFam?newFam.id:null,lifestyle:startLifestyle,liabilities:[],livingAtHome:false,
    freedom:70,bureauFavor:0,scrutiny:0,housingSecurity:55,financialSecurity:50,medicalRecord:false,conditions:[],lastFavorYear:currentYear(),
    holdMember:!!member.holdMember,holdRecruitCooldown:0,
    location:inheritedLocation,traveling:null,
    wasToxicHome:false,leftBeforeBroke:false,parentWarmAccum:0,parentStableAccum:0,parentYears:0,
    toxicIncidentCount:0,warmIncidentCount:0,breakingPointDone:false,nurturingMilestoneDone:false,parentingStyle:null,
    highlights:[]};
  S.id='SF-'+S.dob+'-'+String(RI(1,99999)).padStart(5,'0');
  S.place=World.place;
  if(typeof ensureEducationState==='function'){
    ensureEducationState(S);
    S.education.completed={lower:age>=12,middle:age>=15,upper:age>=18,university:false};
    S.education.status='inherited';
    S.education.history.push({kind:'inherited',year:currentYear(),note:'Prior family years were carried into the new subject record.'});
    if(typeof educationSyncLegacy==='function') educationSyncLegacy(S);
  }
  S.usedNames.push(S.first);
  S.base={health:S.health,happiness:S.happiness,smarts:S.smarts,looks:S.looks,relations:S.relations};
  if(member.relation==='child'&&departedName&&(member.motherName===departedName||member.fatherName===departedName)){
    const departedWasMother=departedSex==='F';
    const trained=Object.entries(departedSkills).sort((a,b)=>b[1]-a[1]);
    const legacySkill=trained.length?trained[0][0]:pick(Object.keys(SKILLS));
    const legacySkillLvl=trained.length?clamp(trained[0][1],2,10):RI(2,6);
    const loyaltyBias=((member.bond??70)-70)/70;
    const rememberedWarmth=legacy.years?clamp(Math.round(legacy.warmth+loyaltyBias*15),5,95):legacy.warmth;
    const knownParent={name:departedName,alive:false,mood:0,estranged:false,
      warmth:rememberedWarmth,stability:legacy.stability,
      skill:legacySkill,skillLvl:legacySkillLvl,
      grip:clamp(Math.round(30+legacy.stability*0.4),5,95)};
    const other=randomParent(departedWasMother?'M':'F',member.last);
    if(legacy.years>0){
      other.warmth=clamp(Math.round(other.warmth*0.65+legacy.warmth*0.35),5,95);
      other.stability=clamp(Math.round(other.stability*0.65+legacy.stability*0.35),5,95);
    }
    S.mother=departedWasMother?knownParent:other;
    S.father=departedWasMother?other:knownParent;
  } else {
    S.mother=randomParent('F'); S.father=randomParent('M',member.last);
  }
  Lineage.activeSubjectId=S.id; Lineage.generation++; updatePersonalStanding();
  if(typeof NpcSystem==='object'&&NpcSystem&&typeof NpcSystem.promoteSubject==='function') NpcSystem.promoteSubject(World,S,member,Lineage,previousSubjectNpcId);
}
function openSuccession(candidates){
  const slip=$('#intentSlip');
  const ranked=candidates.slice().sort((a,b)=>(b.bond||50)-(a.bond||50));
  const choices=ranked.map(m=>{
    const age=currentYear()-m.dob;
    return '<button class="chipbtn" data-mid="'+m.mid+'"><b>'+m.first+' '+m.last+'</b><span>'+relationLabel(m.relation)+' · age '+age+' · family bond '+(m.bond||50)+'</span></button>';
  }).join('');
  slip.innerHTML='<div class="is-head">SUCCESSION · FORM 0-S</div>'+
    '<p class="is-name">The family record continues.</p>'+
    '<p class="is-intro">Choose who takes up the personal file. Hold enrollment is neither required nor inherited.</p>'+
    '<div class="is-lab">Eligible family members</div><div class="chips" id="succChips">'+choices+'</div>';
  slip.onclick=e=>{
    const b=e.target.closest('[data-mid]'); if(!b)return;
    const m=Lineage.members.find(x=>x.mid===b.dataset.mid); if(!m)return;
    promoteToLeader(m); slip.onclick=null; openIntro();
  };
  $('#intentWrap').classList.remove('hidden');
}

/* Compact subject card with three optional randomized rolls. */
function openIntro(){
  const slip=$('#intentSlip'), famT=FAMILY_TIERS.find(f=>f.id===S.familyTier), gi=GUARD_INFO[guardTier()];
  const parentScore=p=>p?Math.round((p.warmth+p.stability)/2):50;
  const tone=p=>parentScore(p)>=60?'good':'bad';
  const guardGood=/safe|warm|steady|good|kind|secure/i.test((gi.label||'')+' '+(gi.line||''));
  const mother=S.mother?S.mother.name+' · '+warmthLabel(S.mother.warmth)+', '+stabilityLabel(S.mother.stability):'';
  const father=S.father?S.father.name+' · '+warmthLabel(S.father.warmth)+', '+stabilityLabel(S.father.stability):'';
  const famGood=famT&&!/hard|neglect|poor/i.test(famT.label+' '+(famT.line||''));
  const disabled=introRerolls<=0;
  slip.innerHTML='<div class="is-head">SUBJECT FILE · FORM 0</div>'+
    '<div class="intro-identity-row"><div class="photo intro-photo"><div class="photo-art">'+portraitSVG(S.sex,S.photoSeed,S.photoTint)+'</div><em class="photo-cap">FILE PHOTO · '+S.dob+'</em></div><div class="subject-identity"><div class="subject-name">'+S.first+' '+S.last+'</div><div class="subject-meta"><span><b>SEX</b> '+sexSym(S.sex)+'</span><span><b>BORN</b> '+S.dob+'</span><span><b>PLACE</b> '+S.place+'</span></div></div></div>'+ 
    '<div class="subject-grid">'+
      '<div class="subject-chip origin '+(famGood?'good':'bad')+'"><b><span class="subject-icon">&#8962;</span> ORIGIN</b><span>'+(famT?famT.label:'Unknown household')+'</span></div>'+ 
      '<div class="subject-chip outlook '+(guardGood?'good':'bad')+'"><b><span class="subject-icon">&#9881;</span> OUTLOOK</b><span>'+gi.label+'</span></div>'+ 
      (mother?'<div class="subject-chip mother '+tone(S.mother)+'"><b><span class="subject-icon">&#9825;</span> MOTHER</b><span>'+mother+'</span></div>':'')+
      (father?'<div class="subject-chip father '+tone(S.father)+'"><b><span class="subject-icon">&#9824;</span> FATHER</b><span>'+father+'</span></div>':'')+
    '</div>'+ 
    '<p class="subject-note '+(guardGood?'good':'bad')+'"><b>'+(guardGood?'GOOD PROSPECT':'RISK FLAG')+'</b> · '+gi.line+'</p>'+ 
    '<div class="is-actions"><button class="btn btn-dice" id="introReroll" '+(disabled?'disabled':'')+'><span class="dice-icon" aria-hidden="true"><i class="dice-face front"><span class="dice-pips p1"></span></i><i class="dice-face back"><span class="dice-pips p6"></span></i><i class="dice-face right"><span class="dice-pips p2"></span></i><i class="dice-face left"><span class="dice-pips p5"></span></i><i class="dice-face top"><span class="dice-pips p3"></span></i><i class="dice-face bottom"><span class="dice-pips p4"></span></i></span> ROLL <small>'+introRerolls+'/3</small></button><button class="btn" id="introBegin">BEGIN THE FILE &#9656;</button></div>';
  slip.onclick=e=>{
    if(e.target.closest('#introReroll')&&!disabled){ introRerolls--; newSubject(); snd('paper'); openIntro(); return; }
    if(e.target.closest('#introBegin')){ $('#intentWrap').classList.add('hidden'); revealDossier(); }
  };
  $('#intentWrap').classList.remove('hidden');
}

/* ================= DEATH / GRADE ================= */
function grade(){
  const avgHap=S.hapYears?S.hapSum/S.hapYears:50; S.avgHap=avgHap;
  let sc=Math.min(S.age/85,1)*38 + avgHap*0.22 + (S.married?8:S.status==='Attached'?5:0) + Math.min(S.kids,3)*4
    + (S.assets>2000?10:S.assets>0?7:S.assets>-1000?3:0) + S.relations*0.06 + (S.edu?4:0) - S.vice*0.8 - (S.record?4:0) - S.crime*1;
  if(S.age<30) sc-=15;
  const tiers=[[78,'A','An exemplary file. The Bureau is quietly proud.'],[64,'B','A life in good order. Minor discrepancies forgiven.'],[50,'C','An adequate file. The Bureau has seen worse.'],[36,'D','The Bureau recommends a full audit of this life.'],[-999,'F','This file should never have been opened. Filed anyway.']];
  for(const [min,g,v] of tiers) if(sc>=min) return {g,v};
}
function intentResult(){ const {it}=currentIntent(S); const st=it.score(S); return {lab:it.name, stars:st, line:it.line[st-1]}; }
function closeFile(){
  snd('close');
  setTimeout(()=>{
    const g=grade(), ir=intentResult(), past=Lineage.pastSubjects;
    $('#c-name').textContent=S.first+' '+S.last; $('#c-file').textContent=S.id;
    $('#c-years').textContent=S.dob+' - '+currentYear()+' (aged '+S.age+')';
    $('#c-job').textContent=S.jailUntil>S.age?'In custody':S.jobName;
    $('#c-estate').textContent=money(S.assets);
    $('#c-kin').textContent=(S.married?'Married to '+S.partner:S.status)+(S.kids?' · '+S.kids+(S.kids>1?' children':' child'):' · no dependents on record');
    $('#c-cause').textContent=S.cause; $('#grade').textContent=g.g; $('#verdict').textContent=g.v;
    let stars=''; for(let i=0;i<5;i++) stars+=i<ir.stars?'*':'<span class="off">o</span>';
    $('#c-stars').innerHTML=stars; $('#c-intent-lab').textContent='BY THEIR OWN MEASURE · '+ir.lab.toUpperCase(); $('#c-intent-line').textContent=ir.line;
    const lineageEl=$('#c-lineage'); if(lineageEl) lineageEl.textContent=(Lineage.name||'Unnamed Family')+' · generation '+Lineage.generation+' · founded '+Lineage.founded;
    const order=['F','D','C','B','A'], grades=past.map(x=>x.grade).concat([g.g]);
    const bestGrade=grades.reduce((best,value)=>order.indexOf(value)>order.indexOf(best)?value:best,'F');
    const bestAge=Math.max(S.age,...past.map(x=>x.age),0);
    Archive.record({lineageName:Lineage.name||'Unnamed Family',place:Lineage.place,founded:Lineage.founded,fell:currentYear(),generations:Lineage.generation,subjects:past.length+1,finalSubject:S.first+' '+S.last,cause:S.cause,grade:bestGrade,bestAge,finalGrade:g.g,finalIntentName:ir.lab,finalIntentStars:ir.stars,highlights:(S.highlights||[]).slice()});
    checkAchievements('close',{grade:g,intentResult:ir}); checkAchievements('archive'); $('#closedWrap').classList.remove('hidden');
  },1500);
}

/* ================= SOUND ================= */
let AC=null;
function ac(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
function thud(c,t,freq,gain){ const b=c.createBuffer(1,c.sampleRate*0.09,c.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
  const src=c.createBufferSource(); src.buffer=b; const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900;
  const g=c.createGain(); g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09);
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
  const o=c.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(freq/2,t+0.1);
  const og=c.createGain(); og.gain.setValueAtTime(gain*0.7,t); og.gain.exponentialRampToValueAtTime(0.001,t+0.12);
  o.connect(og); og.connect(c.destination); o.start(t); o.stop(t+0.13); }
function chime(c,t,freqs,gain){
  freqs.forEach((f,i)=>{ const o=c.createOscillator(); o.type='sine';
    const g=c.createGain(); g.gain.setValueAtTime(0,t+i*0.07); g.gain.linearRampToValueAtTime(gain,t+i*0.07+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,t+i*0.07+0.32);
    o.frequency.setValueAtTime(f,t+i*0.07); o.connect(g); g.connect(c.destination);
    o.start(t+i*0.07); o.stop(t+i*0.07+0.34); }); }
function buzz(c,t,freq,gain){
  const o=c.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(freq,t);
  const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=500;
  const g=c.createGain(); g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.22);
  o.connect(f); f.connect(g); g.connect(c.destination); o.start(t); o.stop(t+0.24); }
function bubbleTick(c,t){
  const o=c.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(1500,t);
  const g=c.createGain(); g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.04);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+0.05); }
function bubblePop(c,t){
  const o=c.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(900,t); o.frequency.exponentialRampToValueAtTime(120,t+0.09);
  const g=c.createGain(); g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+0.11); }
function snd(kind,intensity){ if(!soundOn) return; const c=ac(); if(!c) return; const t=c.currentTime;
  if(kind==='stamp') thud(c,t,110,0.5);
  else if(kind==='close'){ thud(c,t,90,0.5); thud(c,t+0.28,70,0.45); }
  else if(kind==='paper'){ const b=c.createBuffer(1,c.sampleRate*0.16,c.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const src=c.createBufferSource(); src.buffer=b; const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1600; f.Q.value=0.7;
    const g=c.createGain(); g.gain.setValueAtTime(0.14,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.16);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(t); }
  else if(kind==='chime') chime(c,t,[660,880],0.22);
  else if(kind==='chimebig') chime(c,t,[523,659,784],0.3);
  else if(kind==='buzz') buzz(c,t,140,0.22);
  else if(kind==='buzzbig') buzz(c,t,90,0.32);
  else if(kind==='fanfare'){ chime(c,t,[523,659,784,1047],0.32); thud(c,t+0.05,120,0.25); }
  else if(kind==='streak'){ const p=440+Math.min(intensity||1,10)*22; chime(c,t,[p],0.14); }
  else if(kind==='streaksoft') chime(c,t,[300],0.08);
  else if(kind==='chapter') chime(c,t,[440,554,659,880],0.26);
  else if(kind==='bubblehover') bubbleTick(c,t);
  else if(kind==='bubblepop') bubblePop(c,t); }
function shake(){ const d=$('#dossier'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }

/* ================= ARCHIVE UI ================= */
function renderArchiveCount(){
  const n=Archive.count(); const el=$('#archive-count'); if(el) el.textContent=n?('('+n+')'):'';
}
function openArchive(){
  const files=Archive.all().slice().reverse();
  let rows='';
  files.forEach(f=>{
    const highlights=(f.highlights||[]);
    const hlHtml=highlights.length
      ?'<div class="ar-highlights">'+highlights.map(h=>'<div class="ar-meta">· age '+h.age+' — '+h.text+'</div>').join('')+'</div>'
      :'';
    const lineageName=f.lineageName||f.holdName||'Unnamed Family';
    const subjects=f.subjects||f.leaders||1;
    const finalSubject=f.finalSubject||f.finalLeader||'unknown subject';
    rows+='<div class="arow"><div class="ar-grade">'+f.grade+'</div><div style="flex:1"><div class="ar-name">'+lineageName+'</div>'+
      '<div class="ar-meta">'+f.founded+' – '+f.fell+' · '+f.generations+' gen. · '+subjects+' subject'+(subjects===1?'':'s')+' · closed by: '+f.cause+'</div>'+
      '<div class="ar-meta">final subject '+finalSubject+' — '+f.finalIntentName+' '+'★'.repeat(f.finalIntentStars)+'☆'.repeat(5-f.finalIntentStars)+'</div>'+hlHtml+'</div></div>';
  });
  if(!files.length) rows='<div class="aempty">No family lines have closed yet. The drawer is empty.</div>';
  $('#archiveSheet').innerHTML='<div class="ps-head"><span>THE BUREAU ARCHIVE</span><span>'+files.length+' FAMILY LINE'+(files.length===1?'':'S')+'</span></div>'+
    '<div style="margin:10px 2px">'+rows+'</div>'+
    '<div class="ps-foot"><button class="btn" id="archiveClose">Close the Drawer ▸</button></div>';
  $('#archiveClose').onclick=()=>{ $('#archiveWrap').classList.add('hidden'); };
  $('#archiveWrap').classList.remove('hidden');
}
function renderAchieveCount(){
  const n=Achievements.count(); const el=$('#achieve-count'); if(el) el.textContent=n?('('+n+')'):'';
}
function openAchievements(){
  const unlocked=Achievements.all();
  let rows='';
  ACHIEVEMENTS.forEach(a=>{
    const got=unlocked[a.id];
    rows+='<div class="arow'+(got?'':' locked')+'"><div class="ar-grade">'+(got?'✓':'?')+'</div>'+
      '<div style="flex:1"><div class="ar-name">'+(got?a.name:'SEALED COMMENDATION')+'</div>'+
      '<div class="ar-meta">'+(got?a.desc+(got.ctx?' — '+got.ctx:''):'Requirements confidential until earned.')+'</div></div></div>';
  });
  $('#achieveListSheet').innerHTML='<div class="ps-head"><span>COMMENDATIONS ON FILE</span><span>'+Achievements.count()+' / '+ACHIEVEMENTS.length+'</span></div>'+
    '<div style="margin:10px 2px">'+rows+'</div>'+
    '<div class="ps-foot"><button class="btn" id="achieveListClose">Close the Drawer ▸</button></div>';
  $('#achieveListClose').onclick=()=>{ $('#achieveListWrap').classList.add('hidden'); };
  $('#achieveListWrap').classList.remove('hidden');
}
function trustText(t){return t<20?'turning on you':t<40?'grumbling, restless':t<60?'steady, watchful':t<80?'loyal':'devoted';}
function openCaseLog(){ $('#logWrap').classList.remove('hidden'); const el=$('#log'); el.scrollTop=el.scrollHeight; }
/* Hold UI owns organization data only. Family continuity lives in Lineage. */
function openHold(){
  const members=livingHoldMembers();
  const roster=members.length
    ?members.slice().sort((a,b)=>holdLoyalty(b)-holdLoyalty(a)).map(m=>{
      const loyalty=holdLoyalty(m);
      return '<div class="arow"><div class="ar-grade">'+(m.relation==='child'?'K':'R')+'</div><div style="flex:1"><div class="ar-name">'+m.first+' '+m.last+'</div><div class="ar-meta">'+(m.relation==='child'?'enrolled kin':'recruit')+' · loyalty '+loyalty+' <span class="pips">'+moodPips(loyalty)+'</span></div></div></div>';
    }).join('')
    :'<div class="aempty">No one is enrolled in the Hold besides the subject.</div>';
  const actions=[['liequiet','LIE LOW'],['fortify','FORTIFY']].map(([id,label])=>{
    const cooling=currentYear()<Hold.cooldowns[id];
    const blocked=id==='liequiet'?Hold.heat<10:Hold.resources.funds<150;
    const note=cooling?'cooling · '+(Hold.cooldowns[id]-currentYear())+'y':blocked?(id==='liequiet'?'heat already low':'needs $150+'):(id==='liequiet'?'reduce heat':'spend $150, reduce heat');
    return '<button class="cstamp '+(!cooling&&!blocked?'ready':'sealed')+'" data-hold-act="'+id+'"><b>'+label+'</b><span>'+note+'</span></button>';
  }).join('');
  const districts=DISTRICTS.map(d=>{
    const owned=Hold.districts.includes(d.id);
    return '<div class="arow'+(owned?'':' locked')+'"><div class="ar-grade">'+(owned?'Y':'N')+'</div><div style="flex:1"><div class="ar-name">'+d.name+'</div><div class="ar-meta">'+d.desc+'</div></div></div>';
  }).join('');
  $('#holdSheet').innerHTML='<div class="ps-head"><span>'+(Hold.name||'UNNAMED HOLD').toUpperCase()+'</span><span>ORGANIZATION FILE</span></div>'+ 
    '<div class="aempty" style="margin:6px 2px 12px">Founded '+Hold.founded+' · '+Hold.place+' · '+(currentYear()-Hold.founded)+' years active</div>'+ 
    '<div class="stat"><span class="slabel">FUNDS</span><div class="sbar"><div class="sfill f-health" style="width:'+clamp(Hold.resources.funds/1000*100,0,100)+'%"></div></div><b class="sval">'+money(Hold.resources.funds)+'</b></div>'+ 
    '<div class="stat"><span class="slabel">SUPPLIES</span><div class="sbar"><div class="sfill f-happiness" style="width:'+clamp(Hold.resources.supplies/200*100,0,100)+'%"></div></div><b class="sval">'+Hold.resources.supplies+'</b></div>'+ 
    '<div class="stat"><span class="slabel">HEAT</span><div class="sbar"><div class="sfill f-health" style="width:'+clamp(Hold.heat,0,100)+'%"></div></div><b class="sval">'+Math.round(Hold.heat)+'</b></div>'+ 
    '<div class="stat"><span class="slabel">TRUST</span><div class="sbar"><div class="sfill f-happiness" style="width:'+clamp(Hold.trust,0,100)+'%"></div></div><b class="sval">'+Math.round(Hold.trust)+'</b></div>'+ 
    '<div class="ps-sub"><span>HOLD ACTIONS</span></div><div class="ps-clerk">'+actions+'</div>'+ 
    '<div class="ps-sub"><span>DISTRICTS · '+Hold.districts.length+'/'+DISTRICTS.length+' HELD</span></div><div style="margin:0 2px 8px">'+districts+'</div>'+ 
    '<div class="ps-sub"><span>ENROLLED ROSTER · '+members.length+'</span></div><div style="margin:0 2px">'+roster+'</div>'+ 
    '<div class="ps-foot"><button class="btn" id="holdClose">Close the File</button></div>';
  $('#holdClose').onclick=()=>$('#holdWrap').classList.add('hidden');
  $('#holdSheet').onclick=e=>{ const b=e.target.closest('[data-hold-act]'); if(b&&b.classList.contains('ready')) holdAction(b.dataset.holdAct); };
  $('#holdWrap').classList.remove('hidden');
}
