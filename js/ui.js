'use strict';
/* ================= FX / LOG ================= */
function applyFx(fx){
  const out=[];
  for(const k in fx){const v=fx[k]; if(!v) continue;
    if(k==='assets'){S.assets+=v; out.push({txt:(v>0?'+':'−')+'$'+Math.abs(v).toLocaleString('en-US'),plus:v>0});}
    else{ const cap=(k==='health'&&S.healthCap!=null)?S.healthCap:(k==='looks'&&S.looksCap!=null)?S.looksCap:100;
      S[k]=clamp(S[k]+v,0,cap); window.C[k]=(window.C[k]||0)+v;
      if(S.yearAccum) S.yearAccum[k]=(S.yearAccum[k]||0)+v;
      out.push({txt:(v>0?'+':'−')+Math.abs(v)+' '+STATKEYS[k],plus:v>0});}}
  return out;
}
function operationFailure(tier){
  const table=[[0.65,0.27,0.07,0.01],[0.40,0.35,0.18,0.07],[0.20,0.32,0.30,0.18]][tier];
  const r=Math.random(); let acc=0;
  for(let i=0;i<table.length;i++){ acc+=table[i]; if(r<=acc) return i; }
  return table.length-1;
}
function applyOperationFailure(idx){
  Hold.heat=clamp(Hold.heat+RI(10,20),0,100);
  if(idx===0){
    const alive=livingMembers(); if(alive.length&&chance(.5)){ const v=pick(alive); v.loyalty=Math.max(0,v.loyalty-25); }
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
  else { S.assets+=fundsAmt; Hold.trust=clamp(Hold.trust-8,0,100); }
}
function markLeader(){
  S.marked=true;
  S.markedNote=pick(['a hand that no longer closes right','a limp that never fully left','a voice that catches where it used to be steady','a face the Bureau made sure people would remember','a tremor that shows up when it’s quiet']);
  S.health=clamp(S.health-18,0,100); S.looks=clamp(S.looks-20,0,100);
  S.healthCap=Math.min(S.healthCap,S.health+15); S.looksCap=Math.min(S.looksCap,S.looks+10);
}
let yearLog=[], collectingYear=false;
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
    const myKids=livingMembers().filter(m=>m.relation==='child'&&(m.motherName===fullName||m.fatherName===fullName));
    if(myKids.length){
      myKids.forEach(kid=>{ h+='<div class="kinrow compact"><span class="kr-l">CHILD</span><span class="kr-n">'+sexSym(kid.sex)+abbrevName(kid.first+' '+kid.last,16)+'</span><span class="pips">'+moodPips(kid.loyalty)+'</span></div>'; });
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
  renderSkills();
  renderKin(changed);
  renderIntent();
  renderDisposition();
  renderInventory();
  syncHoldTab();
}
function renderInventory(){
  const el=$('#inventory'); if(!el) return;
  const house=currentHousing(), food=currentFood();
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
    el.innerHTML=hc; return;
  }
  let h='';
  h+='<div class="hotspot" data-hotspot="housing"><div class="frow"><span class="flabel">HOUSING</span><span class="fval">'+house.icon+' '+house.name+' · '+(house.rent?money(house.rent)+'/yr':'free')+'</span></div>'+
    '<div class="hh-risk">'+fxSummary(house.fx)+' · '+house.risk+'</div></div>';
  h+='<div class="hotspot" data-hotspot="food"><div class="frow"><span class="flabel">FOOD</span><span class="fval">'+food.icon+' '+food.name+' · '+money(food.cost)+'/yr</span></div>'+
    '<div class="hh-risk">'+fxSummary(food.fx)+' · '+food.risk+'</div></div>';
  if(S.kids>0){ const care=currentChildcare();
    h+='<div class="frow"><span class="flabel">DEPENDENTS</span><span class="fval">'+care.icon+' '+care.name+' · '+money(care.costPerKid)+'/yr × '+S.kids+'</span></div>';
    h+='<div class="hh-risk">'+fxSummary(care.fx)+' · '+care.risk+'</div>'; }
  const totalOutlay=house.rent+food.cost+(S.kids>0?currentChildcare().costPerKid*S.kids:0)+S.liabilities.reduce((a,l)=>a+l.annualPayment,0);
  h+='<div class="sec-h">LIABILITIES <span>'+(S.liabilities.length||'NONE')+'</span></div>';
  if(S.liabilities.length){
    S.liabilities.forEach(l=>{ h+='<div class="arow"><div class="ar-grade">'+l.icon+'</div><div style="flex:1"><div class="ar-name">'+l.name+'</div><div class="ar-meta">'+money(l.annualPayment)+'/yr · '+l.yearsLeft+'y remaining</div></div></div>'; });
  } else {
    h+='<div class="aempty">No debts on file.</div>';
  }
  h+='<div class="frow moneyrow hotspot" data-hotspot="outlay"><span class="flabel">ANNUAL OUTLAY</span><span class="fval big">'+money(totalOutlay)+'</span></div>';
  h+='<button class="btn small" id="invOpenHousehold" style="width:100%;margin-top:8px">Manage the Household ▸</button>';
  el.innerHTML=h;
}
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
function renderSkills(){
  const top=Object.entries(S.skills).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,3);
  $('#val-skills').textContent = top.length ? top.map(([id,v])=>SKILLS[id].icon+' '+SKILLS[id].name+' '+v).join(' · ') : 'none developed';
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
function renderPlan(){
  const h=planHours(), used=S.queue.reduce((a,q)=>a+(PUR_MAP[q.id]?PUR_MAP[q.id].cost:(DEC_MAP[q.id]?DEC_MAP[q.id].cost:0)),0);
  const rem=Math.max(0,h-used);
  let qh='';
  if(S.queue.length){ S.queue.forEach((q,i)=>{const d=PUR_MAP[q.id]||DEC_MAP[q.id]; qh+='<div class="qitem">'+(d.icon?d.icon+' ':'')+(d.dark?'⚑ ':'')+fillLabel(labelOf(q))+'<button class="qx" data-rm="'+i+'">✕</button></div>';}); }
  else qh='<div class="qempty">No slips filed yet. Choose pursuits &amp; decisions below, then seal the year.</div>';
  const autoRow='<button class="autotrain-toggle'+(S.autoTrain?' on':'')+'" id="autoTrainBtn"><b>AUTO-TRAIN A SKILL</b><span>'+(S.autoTrain?'ON · 1h/year reserved, best skill auto-picked':'OFF · tap to reserve 1h/year for automatic training')+'</span></button>';
  let ph='';
  PUR_CATS.forEach(cat=>{
    const items=PURSUITS.filter(p=>p.cat===cat.id); if(!items.length) return;
    let ih='';
    items.forEach(p=>{const ok=p.avail(S); const afford=rem>=p.cost;
      const dup=p.id!=='rest'&&p.id!=='practice'&&p.id!=='tendmember'&&p.id!=='gig'&&!PER_CONTACT_IDS.has(p.id)&&S.queue.some(q=>q.id===p.id); const cant=!ok||!afford||dup;
      ih+='<button class="slipbtn'+(p.dark?' dark':'')+(cant?' cant':'')+(dup?' queued':'')+'" data-p="'+p.id+'" '+(cant?'disabled':'')+'><div class="sb-top"><span class="sb-name">'+(p.icon?'<span class="sb-icon">'+p.icon+'</span> ':'')+fillLabel(pursuitLabel(p))+'</span><span class="sb-cost">'+(p.cost?p.cost+'h':'free')+'</span></div><div class="sb-note">'+(ok?(dup?'already filed this year':fillLabel(p.note(S))):'— not available this year')+'</div></button>';});
    ph+='<div class="ps-catlab">'+cat.label+'</div><div class="sliplist">'+ih+'</div>';
  });
  let dh='';
  DEC_CATS.forEach(cat=>{
    const items=DECISIONS.filter(d=>d.cat===cat.id); if(!items.length) return;
    let ih='';
    items.forEach(d=>{const ok=d.avail(S); const afford=rem>=d.cost; const dup=S.queue.some(q=>q.id===d.id); const cant=!ok||!afford||dup;
      ih+='<button class="slipbtn'+(d.dark?' dark':'')+(cant?' cant':'')+(dup?' queued':'')+'" data-d="'+d.id+'" '+(cant?'disabled':'')+'><div class="sb-top"><span class="sb-name">'+fillLabel(decisionLabel(d))+'</span><span class="sb-cost">'+(d.cost?d.cost+'h':'free')+'</span></div><div class="sb-note">'+(ok?fillLabel(d.note(S)):(dup?'already filed this year':'— not available'))+'</div></button>';});
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
    '<div class="ps-sub"><span>PURSUITS — spend the hours</span></div>'+autoRow+ph+
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
  if(q.id==='tendmember'&&q.member){const m=Hold.members.find(x=>x.mid===q.member); if(m) return 'Look after: '+m.first+' '+m.last;}
  if(q.id==='lookwork'&&q.track){const t=CAREERS.find(c=>c.id===q.track); return t?'Apply: '+t.stages[q.stage].name:'Apply for work';}
  if(q.id==='gig'&&q.gig){const g=GIGS.find(x=>x.id===q.gig); if(g) return 'Off the Books: '+g.name;}
  if(q.cid&&PER_CONTACT_IDS.has(q.id)){const c=S.contacts.find(x=>x.cid===q.cid); if(c) return npcActionLabel({id:q.id,type:PUR_MAP[q.id]?'p':'d'},q.cid);}
  if(q.id==='cutcontact'&&q.cid){const c=S.contacts.find(x=>x.cid===q.cid); if(c) return 'Cut off: '+c.name;}
  if(q.id==='meetsomeone'&&q.venue){const v=MEETING_VENUES.find(x=>x.id===q.venue); if(v) return 'Meet Someone: '+v.name;}
  const d=PUR_MAP[q.id]||DEC_MAP[q.id];return (PUR_MAP[q.id]?pursuitLabel(d):decisionLabel(d));}
function pursuitLabel(p){return {study:'Hit the books',lookwork:'Look for work',overtime:'Work overtime',court:'Court {partner}',tendspouse:'Tend the marriage',family:'Visit the children',writemother:'Write to {mother}',writefather:'Write to {father}',doctor:'See the doctor',walk:'Walk it off',bottle:'The bottle',track:'The racetrack',backroom2:'The back room',rest:'Do nothing',favor:'Call in a favor',practice:'Practice a skill',tendmember:'Look after a member',gig:'Off the books',meetsomeone:'Meet someone new',flirt:'Flirt',flirtsecret:'See them, secretly',tendcontact:'Spend time together',covertracks:'Cover your tracks'}[p.id]||p.id;}
function decisionLabel(d){if(d.id==='crime'){return ['Lift a wallet','Run the numbers','Fence the goods','The big score','Lie low'][S.crime]||'Crime';}return {propose:'Propose to {partner}',trychild:'Try for a child',presspromo:'Press for promotion',learntrade:'Night school',nightshift:'Take night shift',quitjob:'Quit the job',relocate:'Move to the coast',leave:'Take a year off',leaveschool:'Leave school now',loan:'Take the loan',gamblelic:'Open a gambling hall',expunge:'Expunge record',earlyret:'Retire early',namechange:'Change name',breakup:'End it with {partner}',divorce:'File for divorce',estrangemother:'Go no-contact with {mother}',estrangefather:'Go no-contact with {father}',recruit:'Bring someone into the fold',bankloan:'Take out a bank loan',storecredit:'Buy on store credit',payoffdebt:'Pay off a debt early',endaffair:'End it, quietly',cutcontact:'Cut them off'}[d.id]||d.id;}
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
  if(e.target.closest('#autoTrainBtn')){ S.autoTrain=!S.autoTrain; snd('stamp'); renderPlan(); updateBar(); return; }
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
  const h=planHours(), used=S.queue.reduce((a,q)=>a+(PUR_MAP[q.id]?PUR_MAP[q.id].cost:(DEC_MAP[q.id]?DEC_MAP[q.id].cost:0)),0);
  if(used+d.cost>h){shake();return;}
  S.queue.push(Object.assign({id,type},extra||{})); snd('stamp'); renderPlan(); updateBar();
}
function triggerAction(type,id,extra){
  if(type==='p'){
    if(id==='practice'){openSkillPick();return;}
    if(id==='tendmember'){openMemberPick();return;}
    if(id==='lookwork'){openJobPortal();return;}
    if(id==='gig'){openGigPicker();return;}
    if(id==='meetsomeone'){openMeetPicker();return;}
    queueAdd('p',id,extra);
  } else {
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
    const dup = p ? (id!=='rest'&&id!=='practice'&&id!=='tendmember'&&id!=='gig'&&!PER_CONTACT_IDS.has(id)&&S.queue.some(q=>q.id===id))
      : (id==='cutcontact'?S.queue.some(q=>q.id===id&&q.cid===cid):S.queue.some(q=>q.id===id));
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
    if(key==='job'){
      if(S.career){ closeHotspotBubble(false); openJobDetail(S.career); return; }
      if(S.jobTier>0&&S.jailUntil<=S.age){ closeHotspotBubble(false); openGenericJobLadder(); return; }
      if(!S.eduStage&&S.age>=16&&S.jailUntil<=S.age){ closeHotspotBubble(false); openJobPortal(); return; }
    }
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
  Object.entries(SKILLS).forEach(([id,sk])=>{
    const tooYoung=S.age<sk.minAge;
    const queued=S.queue.some(q=>q.id==='practice'&&q.skill===id);
    const locked=tooYoung||queued;
    const lvl=S.skills[id]||0;
    const cur=lvl>0?sk.tiers[lvl-1]:null;
    const next=lvl<10?sk.tiers[lvl]:null;
    let sub;
    if(queued) sub='already filed this year';
    else if(tooYoung) sub='unlocks at age '+sk.minAge;
    else sub=(cur?'now: '+cur+' · ':'')+(next?'next: '+next:'mastered');
    const fxLine='Trains: '+fxSummary(SKILL_PRACTICE_FX[id]);
    ih+='<div class="arow clickable'+(locked?' locked':'')+'" data-skill-row="'+id+'">'+
      '<div class="ar-grade">'+sk.icon+'</div><div style="flex:1"><div class="ar-name">'+sk.name+' · '+lvl+'/10</div><div class="ar-meta">'+sub+'</div><div class="ar-meta">'+fxLine+'</div></div>'+
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
  const tooYoung=S.age<sk.minAge;
  const queued=S.queue.some(q=>q.id==='practice'&&q.skill===skillId);
  const fx=SKILL_PRACTICE_FX[skillId]||{happiness:1};
  const canTrain=!tooYoung&&!queued&&lvl<10;
  const statusLine=tooYoung?'Unlocks at age '+sk.minAge+'.':queued?'Already filed this year.':lvl>=10?'Mastered — bar 10 of 10.':'Each year practiced advances this skill toward its next bar, paced by SMARTS.';
  let rows='';
  sk.tiers.forEach((tier,idx)=>{
    const tierLvl=idx+1, reached=lvl>=tierLvl, isNext=lvl===idx;
    const tag=reached?'<span class="ar-tag current">REACHED</span>':isNext?'<span class="ar-tag open">NEXT</span>':'';
    rows+='<div class="arow'+(reached?'':' locked')+'"><div class="ar-grade">'+tierLvl+'</div>'+
      '<div style="flex:1"><div class="ar-name">Bar '+tierLvl+' '+tag+'</div><div class="ar-meta">'+tier+'</div></div></div>';
  });
  $('#jobDetailSheet').innerHTML='<div class="ps-head"><span>'+sk.icon+' '+sk.name.toUpperCase()+'</span><span>'+lvl+'/10</span></div>'+
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
function primarySkillOf(track){ return Object.keys(track.stages[0].req)[0]; }
function reqLine(req){ return Object.keys(req).map(k=>SKILLS[k].icon+' '+SKILLS[k].name+' '+req[k]+'/10').join(' · '); }
function openJobPortal(){
  let rows='';
  CAREERS.forEach(track=>{
    const v=S.vacancies.find(x=>x.track===track.id);
    const sk=SKILLS[primarySkillOf(track)];
    if(!v||v.stage<0){
      const qualifies=careerStageQualifies(track,0);
      const eduBlocked=!qualifies&&track.minEdu&&eduRank()<EDU_RANK[track.minEdu];
      const sub=qualifies?'You qualify for this track — just no opening this year.':
        eduBlocked?'Requires: '+SCHOOL_STAGES.find(x=>x.id===track.minEdu).name+' completed.':
        sk.icon+' '+sk.name+'-led · requirements not met yet.';
      rows+='<div class="arow locked'+(qualifies?' qualified':'')+' clickable" data-track-row="'+track.id+'"><div class="ar-grade">'+track.icon+'</div><div style="flex:1"><div class="ar-name">'+track.name+'</div><div class="ar-meta">'+sub+'</div></div><div class="ar-chev">VIEW LADDER ›</div></div>';
    } else {
      const st=track.stages[v.stage];
      rows+='<div class="arow clickable" data-track-row="'+track.id+'"><div class="ar-grade">'+track.icon+'</div><div style="flex:1"><div class="ar-name">'+st.name+'</div>'+
        '<div class="ar-meta">'+track.name+' · '+reqLine(st.req)+' · '+money(st.salary)+'/yr</div></div>'+
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
      const queued=S.queue.some(q=>q.id==='gig'&&q.gig===g.id);
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
    const queued=S.queue.some(q=>q.id==='meetsomeone'&&q.venue===v.id);
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
  const v=S.vacancies.find(x=>x.track===trackId);
  const openStage=(v&&v.stage>=0)?v.stage:-1;
  let rows='';
  track.stages.forEach((st,idx)=>{
    const minAge=TIER_MINAGE[idx+1], expYears=CAREER_EXP[idx-1];
    const isCurrent=S.career===trackId && S.jobTier===idx+1;
    const eduOk=!track.minEdu||eduRank()>=EDU_RANK[track.minEdu];
    const qualifies=eduOk && S.age>=minAge && Object.keys(st.req).every(k=>(S.skills[k]||0)>=st.req[k]);
    const isOpen=openStage===idx;
    const tag=isCurrent?'<span class="ar-tag current">YOUR STAGE</span>':isOpen?'<span class="ar-tag open">OPEN NOW</span>':'';
    const eduRow=track.minEdu?'<div class="reqrow"><span class="'+(eduOk?'reqok':'reqno')+'">🎓 '+SCHOOL_STAGES.find(x=>x.id===track.minEdu).name+' completed</span></div>':'';
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
    '<div class="aempty" style="margin:6px 2px 12px">Higher rungs call for more skill, more of it at once, and years served in the seat below.</div>'+
    '<div style="margin:0 2px">'+rows+'</div>'+
    '<div class="ps-foot"><button class="btn" id="jobDetailClose">Close ▸</button></div>';
  $('#jobDetailSheet').onclick=e=>{
    const b=e.target.closest('[data-apply]'); if(b){ queueAdd('p','lookwork',{track:b.dataset.track,stage:+b.dataset.stage}); $('#jobDetailWrap').classList.add('hidden'); $('#jobWrap').classList.add('hidden'); return; }
    if(e.target.id==='jobDetailClose'){ $('#jobDetailWrap').classList.add('hidden'); }
  };
  $('#jobDetailWrap').classList.remove('hidden');
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
  const alive=livingMembers();
  let ch='';
  if(!alive.length){ ch='<div class="qempty">No one in the fold yet to look after.</div>'; }
  else{
    alive.forEach(m=>{const queued=S.queue.some(q=>q.id==='tendmember'&&q.member===m.mid);
      ch+='<button class="chipbtn'+(queued?' locked':'')+'" '+(queued?'disabled':'data-member="'+m.mid+'"')+'><b>'+m.first+' '+m.last+'</b><span>'+(queued?'already filed this year':relationLabel(m.relation)+' · loyalty '+m.loyalty)+'</span></button>';});
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
  else if(kind==='checkup'){S.desk.checkup=S.age+6; logEv('CLERK’S DISCRETION — Subject was ordered to a medical inspection. The doctor said “hmm” four times and prescribed walking and disappointment.',{health:7,assets:-80,happiness:-1},'ruling','CLERK RULING · YEAR '+S.age);}
  else if(kind==='censure'){S.desk.censure=S.age+8;
    if(S.vice>0){S.vice=Math.max(0,S.vice-4); logEv('CLERK’S DISCRETION — A formal censure was issued, laminated and in triplicate. The subject’s questionable acquaintances dispersed, alphabetically.',{happiness:-4},'ruling','CLERK RULING · YEAR '+S.age);}
    else logEv('CLERK’S DISCRETION — The censure found nothing to censure. The clerk filed the silence, disappointed.',{},'ruling','CLERK RULING · YEAR '+S.age);}
  renderStats(window.C);
}
function holdAction(kind){
  if(!S||!S.alive||slipOpen||Hold.year<Hold.cooldowns[kind]) return;
  if(kind==='liequiet'&&Hold.heat<10) return;
  if(kind==='fortify'&&Hold.resources.funds<150) return;
  snd('stamp'); shake(); window.C={};
  if(kind==='liequiet'){
    Hold.heat=clamp(Hold.heat-RI(10,20),0,100); Hold.cooldowns.liequiet=Hold.year+2;
    logEv('Subject called for quiet — no meetings, no movement, nothing to see. The Bureau, for a while, saw nothing.',{happiness:-1},'plan','HOLD ACTION · YEAR '+S.age);
  } else if(kind==='fortify'){
    Hold.resources.funds=Math.max(0,Hold.resources.funds-150); Hold.heat=clamp(Hold.heat-12,0,100); Hold.resources.supplies+=10; Hold.cooldowns.fortify=Hold.year+3;
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
  let r=Math.random()*total;
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
function runHistory(){ const y=Hold.year;
  for(const h of HISTORY){ if(h.y!==y) continue; if(h.if&&!h.if(S)) continue;
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
  const y=Hold.year, WAR=(y>=1914&&y<=1918)||(y>=1939&&y<=1945), student=!!S.eduStage;
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
    S.assets+=income; }
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
    endMarriageSide(S,'Widowed'); }
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
  if(k==='assets'){ S.assets+=sv; } else { const cap=(k==='health'&&S.healthCap!=null)?S.healthCap:(k==='looks'&&S.looksCap!=null)?S.looksCap:100; S[k]=clamp(S[k]+sv,0,cap); } } }
function runBudget(WAR){
  const house=currentHousing(), food=currentFood();
  const atHome=S.age<16||S.livingAtHome;
  const childScale=atHome?(GUARD_SCALE[guardTier()]||0.4):1;
  applyAmbient(house.fx,childScale); applyAmbient(food.fx,childScale);
  if(S.kids>0){ applyAmbient(currentChildcare().fx,childScale); }
  if(atHome) return;
  let outlay=house.rent+food.cost;
  if(S.kids>0) outlay+=currentChildcare().costPerKid*S.kids;
  S.liabilities.forEach(l=>{ outlay+=l.annualPayment; });
  if(WAR) outlay=Math.round(outlay*1.15);
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
    S.acts++; window.C={}; const r=def.apply(S,item); const chips=r.fx?applyFx(r.fx):[];
    if(r.follow) pushFollow(r.follow);
    logChips(fill(r.text),chips,item.type==='p'?'plan':'decision',(item.type==='p'?'PURSUIT':'DECISION')+' · YEAR '+S.age);
    renderStats(window.C); });
}
function runRandomEvents(){
  let n=chance(.5)?1:0; if(S.age>10&&chance(.12))n++;
  const dispId=currentDisposition(S).it.id;
  const darkMult = dispId==='saint'?0.5:(dispId==='gambler'||dispId==='hustler')?1.4:1;
  for(let i=0;i<n;i++){
    const pool=EVENTS.filter(e=>S.age>=e.a[0]&&S.age<=e.a[1]&&(!e.if||e.if(S))&&(!S.cool[e.id]||S.age>=S.cool[e.id]));
    if(!pool.length) break;
    const weighted=pool.map(e=>{let w=e.w||2; if(e.dark)w*=(0.3+S.vice*0.4+(S.happiness<40?1.1:0))*darkMult; return {e,w:Math.max(w,0.05)};});
    const tot=weighted.reduce((a,x)=>a+x.w,0); let r=Math.random()*tot, e=weighted[weighted.length-1].e;
    for(const x of weighted){r-=x.w; if(r<=0){e=x.e;break;}}
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
    if(S.age<16||S.livingAtHome) povRisk*=1.6*(GUARD_MORT[guardTier()]||1);
    else if(S.age>65) povRisk*=1.6;
    if(povRisk>0&&chance(povRisk)){ dead=true;
      cause = house.id==='none'
        ? pick(['exposure, found behind the depot at first light','a fever no shelter was there to catch','the kind of winter the streets do not forgive'])
        : pick(['a hunger the body could not recover from','a sickness a fuller table might have survived']);
    }
  }
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
  const hardship = (S.assets<0?0.12+clamp(Math.abs(S.assets)/2000,0,0.4):0)+(S.health<30?0.1:0)+(S.married&&S.partnerMood<25?0.12:0)+(S.kids>0?0.04:0)+Hold.heat*0.0035;
  const cpool=CRISES.filter(c=>c.avail(S)&&c.id!=='regimeraid');
  if(cpool.length && chance(0.10+hardship)){ openCrisis(pick(cpool)); return; }
  const ppool=PETITIONS.filter(p=>p.avail(S)&&!(p.once&&S.petDone[p.id]));
  if(ppool.length && chance(0.12)){ openPetition(pick(ppool)); return; }
  const opool=OPPORTUNITIES.filter(o=>o.avail(S));
  if(opool.length && chance(0.16)){ openOpportunity(pick(opool)); }
}
function autoPickSkill(){
  const jobDef=JOBLIST.find(j=>j.name===S.jobName);
  if(jobDef&&jobDef.skill&&S.age>=SKILLS[jobDef.skill].minAge&&(S.skills[jobDef.skill]||0)<10) return jobDef.skill;
  const eligible=Object.entries(SKILLS).filter(([id,sk])=>S.age>=sk.minAge&&(S.skills[id]||0)<10);
  if(!eligible.length) return null;
  eligible.sort((a,b)=>(S.skills[b[0]]||0)-(S.skills[a[0]]||0));
  return eligible[0][0];
}
function tickSkills(){
  const jobDef=JOBLIST.find(j=>j.name===S.jobName);
  const workedSkill=jobDef?jobDef.skill:null;
  for(const id in S.skills){
    if(S.skills[id]<=0){delete S.skills[id];continue;}
    const reinforced=(id===workedSkill)||(id===S.practicedSkill);
    if(reinforced){ if(S.skills[id]<10&&chance(.28)) S.skills[id]++; }
    else if(chance(.18)){ S.skills[id]=Math.max(0,S.skills[id]-1); }
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
  const before=S.skills[teacher.skill]||0;
  if(before<cap&&chance(pTeach)) S.skills[teacher.skill]=before+1;
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
  if(S.eduStage){ const st=SCHOOL_STAGES.find(x=>x.id===S.eduStage); if(st){ S.jobName=st.pupilTitle; S.jobTier=0; S.career=null; } return; }
  if(S.jobTier>0) return;
  if(S.jailUntil>S.age) return;
  if(S.jobName&&S.jobName.startsWith('Pensioner')) return;
  S.jobName=S.age<16?'Minor':'Unemployed';
}
function schoolYearTick(){
  if(!S.eduStage) return;
  const stage=SCHOOL_STAGES.find(x=>x.id===S.eduStage); if(!stage) return;
  S.smarts=clamp(S.smarts+stage.smartsPerYear,0,100);
  S.eduYearsIn=(S.eduYearsIn||0)+1;
  if(S.eduYearsIn>=stage.years){
    S.eduCompleted=S.eduCompleted||{}; S.eduCompleted[stage.id]=true;
    if(stage.id==='university') S.edu=true;
    logEv(stage.completeText,stage.completeFx,'milestone','MILESTONE · YEAR '+S.age);
    if(stage.id==='university'&&!schoolWealthOK()){
      const t=LIABILITY_TYPES.studentloan;
      S.liabilities.push({id:t.id,name:t.name,icon:t.icon,yearsLeft:t.years,annualPayment:liabilityPayment(t)});
      logEv('The bursar’s office sent along the bill for the degree, payable over the years ahead.',{});
    }
    S.eduStage=null; S.eduYearsIn=0;
    const idx=SCHOOL_STAGES.findIndex(x=>x.id===stage.id), next=SCHOOL_STAGES[idx+1];
    if(next&&!S.eduCompleted[next.id]) S.pendingSchoolStage=next.id;
    syncEduJobTitle();
  }
}
function schoolInfoHTML(){
  if(!S.eduStage) return '';
  const stage=SCHOOL_STAGES.find(x=>x.id===S.eduStage); if(!stage) return '';
  return '<div class="hs-info"><b>'+stage.name+'</b>'+
    '<div class="hs-info-row">Year '+((S.eduYearsIn||0)+1)+' of '+stage.years+'</div>'+
    '<div class="hs-info-row">+'+stage.smartsPerYear+' SMARTS/yr while enrolled — no work while attending</div></div>';
}
function resolveSchoolLine(text,fx){
  window.C={};
  const chips=fx?applyFx(fx):[];
  logChips(fill(text),chips,'crisis','SCHOOLING · YEAR '+S.age);
  renderStats(window.C); updateBar();
  checkAchievements('live');
}
function openSchoolSlip(stage){
  slipOpen=true; document.body.classList.add('slip-open');
  const guardians=guardiansOf(), grip=parentGrip();
  const names=guardians.length?guardians.map(p=>p.name).join(' and '):'no one';
  const viaParent=schoolViaParent(stage);
  const viaScholar=!viaParent&&schoolViaScholar(stage);
  const card=$('#slipCard'); card.className='slipcard crisis';
  let body='', title='', opts=[];
  function enroll(text,fx){ return ()=>{ S.eduStage=stage.id; S.eduYearsIn=0; syncEduJobTitle(); resolveSchoolLine(text,fx||{}); }; }
  function skip(text,fx){ return ()=>{ resolveSchoolLine(text,fx||{}); }; }
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
function checkSchoolTransition(){
  if(!S.alive||S.eduStage||S.eduDropped) return false;
  let stage=null;
  if(S.pendingSchoolStage){ stage=SCHOOL_STAGES.find(x=>x.id===S.pendingSchoolStage); S.pendingSchoolStage=null; }
  else stage=SCHOOL_STAGES.find(x=>x.startAge===S.age);
  if(!stage) return false;
  if(S.eduCompleted&&S.eduCompleted[stage.id]) return false;
  openSchoolSlip(stage);
  return true;
}
function runHoldTick(){
  if(!S.holdMember) return;
  const memberCount=livingMembers().length;
  let districtFunds=0, districtSupplies=0, districtHeat=0;
  Hold.districts.forEach(id=>{const d=DISTRICTS.find(x=>x.id===id); if(d){districtFunds+=d.funds;districtSupplies+=d.supplies;districtHeat+=d.heat;}});
  Hold.heat=clamp(Hold.heat+(memberCount>0?memberCount*0.4:0)+districtHeat-1.5,0,100);
  Hold.resources.funds=Math.max(0,Hold.resources.funds+districtFunds-(5+memberCount*3));
  Hold.resources.supplies=Math.max(0,Hold.resources.supplies+districtSupplies);
  const alive=livingMembers();
  if(alive.length){ const avgLoy=alive.reduce((a,m)=>a+m.loyalty,0)/alive.length; Hold.trust=clamp(Math.round(Hold.trust*0.95+avgLoy*0.05),0,100); }
}
function advance(suppressBurst,quiet){
  if(!S||!S.alive||slipOpen) return;
  if(S.age>0) evaluateYearStreak(quiet);
  yearLog=[]; collectingYear=true;
  S.age++; Hold.year++; runHoldTick(); snd('stamp'); shake(); window.C={};
  runFollowups(); runHistory(); runMilestones(); runEconomy();
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
  renderStats(window.C); renderYear(); updateBar();
  checkAchievements('live');
  if(S.alive){
    if(S.__pendingDiscovery){ const ctx=S.__pendingDiscovery; S.__pendingDiscovery=null; dispatchDiscoveryReaction(ctx); }
    else if(S.__pendingReverseDiscovery){ const ctx=S.__pendingReverseDiscovery; S.__pendingReverseDiscovery=null; dispatchReverseDiscoveryReaction(ctx); }
    else if(S.__pendingTheirSpouseNotice){ const n=S.__pendingTheirSpouseNotice; S.__pendingTheirSpouseNotice=null; openNotice(n); }
    else if(S.__pendingGuardianNotice){ const gp=S.__pendingGuardianNotice; S.__pendingGuardianNotice=null; openGuardianNotice(gp); }
    else if(!checkGuardianEviction()&&!checkSchoolTransition()&&!checkParentingStyleChoice()) maybeSlip();
  }
  if(!S.alive) handleDeath();
  if(!suppressBurst && S.alive && !slipOpen && yearLog.length) showYearBurst(yearLog);
}
function fastForward(){
  if(!S||!S.alive||slipOpen) return;
  let years=0; quietMode=true;
  while(S.alive && !slipOpen && years<15){ advance(true,true); years++; }
  quietMode=false;
}
let burstTimer=null, burstDeck=[], burstOrder=[], burstPaused=false, burstRemaining=0, burstStartedAt=0, burstDragState=null;
const BURST_STACK_MS=3200;
const BURST_STACK_OFFSETS=[0,-16,-30,-42,-53,-63,-72];
const BURST_STACK_SCALE=[1,.97,.94,.92,.9,.88,.86];
function stackFor(pos){ const i=Math.min(pos,BURST_STACK_OFFSETS.length-1); return {dy:BURST_STACK_OFFSETS[i],sc:BURST_STACK_SCALE[i]}; }
function positionBurstWrap(){
  const wrap=$('#burstWrap'), bar=document.querySelector('.actionbar');
  if(wrap&&bar) wrap.style.bottom=Math.round(bar.getBoundingClientRect().height)+'px';
}
function showYearBurst(entries){
  if(!entries||!entries.length) return;
  burstDeck=entries; burstOrder=entries.map((_,i)=>i); burstPaused=false;
  positionBurstWrap();
  renderBurstStack();
  $('#burstWrap').classList.remove('hidden');
  const bar=$('#burstTimerBar'); if(bar){ bar.classList.remove('paused'); bar.style.animation='none'; void bar.offsetWidth; bar.style.animation=''; }
  burstRemaining=BURST_STACK_MS; armBurstTimer(BURST_STACK_MS);
  const bad=entries.some(e=>e.cls==='guardian-bad');
  const good=!bad&&entries.some(e=>e.cls==='guardian-good');
  if(bad){ snd('buzzbig'); if(navigator.vibrate) navigator.vibrate([40,30,40,30,60]); }
  else if(good){ snd('chime'); }
}
function renderBurstStack(){
  const stack=$('#burstStack'); if(!stack) return;
  stack.innerHTML='';
  burstOrder.forEach((entryIdx,pos)=>{
    const e=burstDeck[entryIdx], f=stackFor(pos);
    const bad=e.cls==='guardian-bad', good=e.cls==='guardian-good';
    const card=document.createElement('div');
    card.className='burstcard'+(bad?' bad':good?' good':'');
    card.dataset.entryIdx=entryIdx;
    card.style.setProperty('--dy',f.dy+'px');
    card.style.setProperty('--sc',f.sc);
    card.style.zIndex=String(burstOrder.length-pos);
    let chips=''; e.chips.forEach((c,i)=>{ chips+='<span class="fx '+(c.plus?'plus':'minus')+'" style="animation-delay:'+(i*0.03)+'s">'+c.txt+'</span>'; });
    card.innerHTML='<div class="burst-head">YEAR '+S.age+(Hold?' · '+Hold.year:'')+(burstOrder.length>1?' · '+(pos+1)+'/'+burstOrder.length:'')+'</div>'+
      '<div class="burst-lines"><div>'+e.text+'</div></div>'+
      (chips?'<div class="burst-chips">'+chips+'</div>':'');
    stack.appendChild(card);
  });
}
function armBurstTimer(ms){ clearTimeout(burstTimer); burstStartedAt=Date.now(); burstTimer=setTimeout(hideBurst,ms); }
function hideBurst(){ $('#burstWrap').classList.add('hidden'); clearTimeout(burstTimer); burstDeck=[]; burstOrder=[]; burstPaused=false; }
function pauseBurst(){ if($('#burstWrap').classList.contains('hidden')||burstPaused)return; burstPaused=true;
  burstRemaining=Math.max(300,burstRemaining-(Date.now()-burstStartedAt)); clearTimeout(burstTimer);
  const bar=$('#burstTimerBar'); if(bar) bar.classList.add('paused'); }
function resumeBurst(){ if($('#burstWrap').classList.contains('hidden')||!burstPaused)return; burstPaused=false;
  armBurstTimer(burstRemaining); const bar=$('#burstTimerBar'); if(bar) bar.classList.remove('paused'); }
function burstStackPointerDown(ev){
  if(!burstOrder.length) return;
  const card=ev.target.closest('.burstcard'); if(!card) return;
  if(+card.dataset.entryIdx!==burstOrder[0]) return;
  pauseBurst();
  card.classList.add('dragging');
  burstDragState={card,startY:ev.clientY};
  if(card.setPointerCapture) try{card.setPointerCapture(ev.pointerId);}catch(_){}
}
function burstStackPointerMove(ev){
  if(!burstDragState) return;
  const dy=ev.clientY-burstDragState.startY;
  burstDragState.card.style.setProperty('--dy',dy+'px');
}
function burstStackPointerUp(ev){
  if(!burstDragState) return;
  const card=burstDragState.card, startY=burstDragState.startY;
  const dy=(ev.clientY||startY)-startY;
  card.classList.remove('dragging');
  burstDragState=null;
  if(Math.abs(dy)>60&&burstOrder.length>1){
    card.style.setProperty('--dy',(dy<0?-360:220)+'px');
    card.style.opacity='0';
    setTimeout(()=>{ burstOrder.push(burstOrder.shift()); renderBurstStack(); resumeBurst(); },260);
  } else { renderBurstStack(); resumeBurst(); }
}
const __burstStackEl=$('#burstStack');
if(__burstStackEl){
  __burstStackEl.addEventListener('pointerdown',burstStackPointerDown);
  __burstStackEl.addEventListener('pointermove',burstStackPointerMove);
  __burstStackEl.addEventListener('pointerup',burstStackPointerUp);
  __burstStackEl.addEventListener('pointercancel',burstStackPointerUp);
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
  Hold.pastLeaders.push({name:S.first+' '+S.last,dob:S.dob,deathYear:Hold.year,age:S.age,cause:S.cause,grade:g.g,intentName:ir.lab,intentStars:ir.stars,
    parentWarmth:legacy.warmth,parentStability:legacy.stability,parentYears:legacy.years});
  const candidates=livingMembers().filter(m=>(Hold.year-m.dob)>=16);
  if(candidates.length){ openSuccession(candidates); }
  else { closeFile(); }
}
function promoteToLeader(member){
  const age=Hold.year-member.dob;
  const departedName=S?(S.first+' '+S.last):null, departedSex=S?S.sex:null;
  const legacy=S?computeParentingLegacy():{warmth:50,stability:50,years:0};
  const departedSkills=S&&S.skills?S.skills:{};
  const inheritedLifestyle=S&&S.lifestyle?Object.assign({},S.lifestyle):null;
  const newFam=inheritedLifestyle?null:pickWeighted(FAMILY_TIERS);
  const startLifestyle=inheritedLifestyle||{housing:newFam.housing,food:newFam.food,childcare:newFam.childcare};
  const lastRecord=Hold.pastLeaders[Hold.pastLeaders.length-1];
  const gradeBonus=lastRecord?({A:8,B:5,C:2,D:0,F:-3}[lastRecord.grade]||0):0;
  Hold.members=Hold.members.filter(m=>m.mid!==member.mid);
  S={sex:member.sex,first:member.first,last:member.last,dob:member.dob,age,alive:true,cause:'',relation:member.relation,
    health:RI(50,85),happiness:RI(45,75),smarts:clamp(RI(28,82)+gradeBonus,0,100),looks:RI(28,80),relations:clamp(member.loyalty,20,90),
    assets:0,jobTier:0,jobName:'Unemployed',pensionBase:0,
    status:'Single',partner:null,married:false,kids:0,
    partnerMood:0,friendMood:0,familyMood:0,
    friend:null,contacts:[],activeAffairCids:[],edu:false,record:false,vice:0,crime:0,jailUntil:0,favorCool:0,
    didCoast:false,didLeave:false,planted:false,peakHap:0,avgHap:0,hapSum:0,hapYears:0,acts:0,
    base:null,
    photoSeed:RI(0,99),photoTint:pick(TINTS),
    usedV:{},cool:{},desk:{subsidy:0,checkup:0,censure:0},warned:{},queue:[],usedNames:[],skills:{},practicedSkill:null,petDone:{},garnishUntil:0,bankrupt:false,autoTrain:false,marked:false,markedNote:'',healthCap:100,looksCap:100,
    streak:0,bestStreak:0,yearAccum:{},stage:stageForAge(age),career:null,vacancies:[],careerYears:0,
    eduStage:null,eduYearsIn:0,eduDropped:true,eduCompleted:{},pendingSchoolStage:null,
    familyTier:newFam?newFam.id:null,lifestyle:startLifestyle,liabilities:[],livingAtHome:false,
    holdMember:!!member.holdMember,holdRecruitCooldown:0,
    wasToxicHome:false,leftBeforeBroke:false,parentWarmAccum:0,parentStableAccum:0,parentYears:0,
    toxicIncidentCount:0,warmIncidentCount:0,breakingPointDone:false,nurturingMilestoneDone:false,parentingStyle:null,
    highlights:[]};
  S.id='SF-'+S.dob+'-'+String(RI(1,99999)).padStart(5,'0');
  S.place=Hold.place;
  S.usedNames.push(S.first);
  S.base={health:S.health,happiness:S.happiness,smarts:S.smarts,looks:S.looks,relations:S.relations};
  if(member.relation==='child'&&departedName&&(member.motherName===departedName||member.fatherName===departedName)){
    const departedWasMother=departedSex==='F';
    const trained=Object.entries(departedSkills).sort((a,b)=>b[1]-a[1]);
    const legacySkill=trained.length?trained[0][0]:pick(Object.keys(SKILLS));
    const legacySkillLvl=trained.length?clamp(trained[0][1],2,10):RI(2,6);
    const loyaltyBias=((member.loyalty??70)-70)/70;
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
  Hold.leaderId=S.id; Hold.generation++;
}
function openSuccession(candidates){
  const slip=$('#intentSlip');
  const ranked=candidates.slice().sort((a,b)=>b.loyalty-a.loyalty);
  let cc=''; ranked.forEach(m=>{const age=Hold.year-m.dob;
    cc+='<button class="chipbtn" data-mid="'+m.mid+'"><b>'+m.first+' '+m.last+'</b><span>'+relationLabel(m.relation)+' · age '+age+' · loyalty '+m.loyalty+'</span></button>';});
  slip.innerHTML=
    '<div class="is-head">SUCCESSION · FORM 0-S</div>'+
    '<p class="is-name">The Hold endures — for now.</p>'+
    '<p class="is-intro">Someone must take up the mantle. The Bureau does not care who leads. You do.</p>'+
    '<div class="is-lab">Eligible successors</div><div class="chips" id="succChips">'+cc+'</div>';
  slip.onclick=e=>{
    const b=e.target.closest('[data-mid]'); if(!b)return;
    const m=Hold.members.find(x=>x.mid===b.dataset.mid); if(!m)return;
    promoteToLeader(m); slip.onclick=null; openIntro();
  };
  $('#intentWrap').classList.remove('hidden');
}

/* ================= INTRODUCTION ================= */
function openIntro(){
  const slip=$('#intentSlip');
  const last=Hold.generation>1?Hold.pastLeaders[Hold.pastLeaders.length-1]:null;
  let reviewHtml='';
  if(last){
    let stars=''; for(let i=0;i<5;i++) stars+= i<last.intentStars?'★':'<span class="off">☆</span>';
    const gv={A:'An exemplary file. The Bureau is quietly proud.',B:'A life in good order. Minor discrepancies forgiven.',C:'An adequate file. The Bureau has seen worse.',D:'The Bureau recommends a full audit of this life.',F:'This file should never have been opened. Filed anyway.'}[last.grade]||'';
    const isParent=(S.mother&&S.mother.name===last.name)||(S.father&&S.father.name===last.name);
    const parentLine=last.parentYears>0
      ?'<div class="selfrow"><div class="stxt"><b>AS A PARENT</b> — '+warmthLabel(last.parentWarmth)+', and '+stabilityLabel(last.parentStability)+'.</div></div>'
      :'';
    reviewHtml='<div class="is-head">'+(isParent?'YOUR PARENT, ON FILE':'YOUR PREDECESSOR, ON FILE')+' · FORM 0-R</div>'+
      '<p class="is-name">'+last.name+', '+last.dob+' – '+last.deathYear+' (aged '+last.age+') · '+last.cause+'</p>'+
      '<div class="assess"><div class="grade">'+last.grade+'</div><div><p class="flabel2">THE BUREAU’S ASSESSMENT</p><p class="verdict">'+gv+'</p></div></div>'+
      '<div class="selfrow"><div class="stars">'+stars+'</div><div class="stxt"><b>BY THEIR OWN MEASURE — '+last.intentName.toUpperCase()+'</b></div></div>'+parentLine;
  }
  const famT=FAMILY_TIERS.find(f=>f.id===S.familyTier);
  const famLine=famT?('Subject was '+famT.line+'.'):'Raised in the household left behind — the old arrangements simply carried over.';
  const motherLine=S.mother?(S.mother.name+' — '+warmthLabel(S.mother.warmth)+', '+stabilityLabel(S.mother.stability)+'.'):'';
  const fatherLine=S.father?(S.father.name+' — '+warmthLabel(S.father.warmth)+', '+stabilityLabel(S.father.stability)+'.'):'';
  const gi=GUARD_INFO[guardTier()];
  slip.innerHTML=reviewHtml+
    '<div class="is-head">SUBJECT FILE · FORM 0</div>'+
    '<p class="is-name">'+S.first+' '+S.last+', '+S.sex+', born '+S.dob+', '+S.place+'.</p>'+
    '<p class="is-intro">'+famLine+'</p>'+
    (motherLine?'<p class="is-intro"><b>MOTHER</b> — '+motherLine+'</p>':'')+
    (fatherLine?'<p class="is-intro"><b>FATHER</b> — '+fatherLine+'</p>':'')+
    '<p class="is-intro">On balance: <b>'+gi.label+'</b>. '+gi.line+'</p>'+
    '<div class="is-seal"><button class="btn" id="introBegin">'+(last?'Take Up the File ▸':'Begin the File ▸')+'</button></div>';
  slip.onclick=e=>{
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
    $('#c-name').textContent=S.first+' '+S.last; $('#c-file').textContent=S.id;
    $('#c-years').textContent=S.dob+' – '+(S.dob+S.age)+'  (aged '+S.age+')';
    $('#c-job').textContent=S.jailUntil>S.age?'In custody':S.jobName;
    $('#c-estate').textContent=money(S.assets);
    $('#c-kin').textContent=(S.married?'Married to '+S.partner:S.status)+(S.kids?' · '+S.kids+(S.kids>1?' children':' child'):' · no dependents on record');
    $('#c-cause').textContent=S.cause;
    const g=grade(); $('#grade').textContent=g.g; $('#verdict').textContent=g.v;
    const ir=intentResult(); let stars=''; for(let i=0;i<5;i++) stars+= i<ir.stars?'★':'<span class="off">☆</span>';
    $('#c-stars').innerHTML=stars; $('#c-intent-lab').textContent='BY THEIR OWN MEASURE — '+ir.lab.toUpperCase(); $('#c-intent-line').textContent=ir.line;
    const holdEl=$('#c-hold'); if(holdEl) holdEl.textContent=(Hold.name||'Unnamed Hold')+' · Gen. '+Hold.generation+' of '+(Hold.pastLeaders.length+1)+' · founded '+Hold.founded;
    const GORDER=['F','D','C','B','A'];
    const allGrades=Hold.pastLeaders.map(l=>l.grade).concat([g.g]);
    const bestGrade=allGrades.reduce((m,gr)=>GORDER.indexOf(gr)>GORDER.indexOf(m)?gr:m,'F');
    const bestAge=Math.max(S.age,...Hold.pastLeaders.map(l=>l.age),0);
    Archive.record({holdName:Hold.name||'Unnamed Hold', place:Hold.place, founded:Hold.founded, fell:Hold.year,
      generations:Hold.generation, leaders:Hold.pastLeaders.length+1, finalLeader:S.first+' '+S.last, cause:S.cause,
      grade:bestGrade, bestAge, finalGrade:g.g, finalIntentName:ir.lab, finalIntentStars:ir.stars,
      highlights:(S.highlights||[]).slice()});
    checkAchievements('close',{grade:g,intentResult:ir});
    checkAchievements('archive');
    $('#closedWrap').classList.remove('hidden');
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
    rows+='<div class="arow"><div class="ar-grade">'+f.grade+'</div><div style="flex:1"><div class="ar-name">'+f.holdName+'</div>'+
      '<div class="ar-meta">'+f.founded+' – '+f.fell+' · '+f.generations+' gen. · '+f.leaders+' leader'+(f.leaders===1?'':'s')+' · fell to: '+f.cause+'</div>'+
      '<div class="ar-meta">last leader '+f.finalLeader+' — '+f.finalIntentName+' '+'★'.repeat(f.finalIntentStars)+'☆'.repeat(5-f.finalIntentStars)+'</div>'+hlHtml+'</div></div>';
  });
  if(!files.length) rows='<div class="aempty">No Holds have fallen yet. The drawer is empty.</div>';
  $('#archiveSheet').innerHTML='<div class="ps-head"><span>THE BUREAU ARCHIVE</span><span>'+files.length+' HOLD'+(files.length===1?'':'S')+'</span></div>'+
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
function openHold(){
  const alive=livingMembers();
  let mh='';
  if(alive.length){
    alive.slice().sort((a,b)=>b.loyalty-a.loyalty).forEach(m=>{
      const age=Hold.year-m.dob, initial=m.relation==='child'?'C':m.relation==='spouse'?'S':'R';
      mh+='<div class="arow"><div class="ar-grade">'+initial+'</div><div style="flex:1"><div class="ar-name">'+m.first+' '+m.last+'</div>'+
        '<div class="ar-meta">'+relationLabel(m.relation)+' · age '+age+' · loyalty '+m.loyalty+' <span class="pips">'+moodPips(m.loyalty)+'</span></div></div></div>';
    });
  } else {
    mh='<div class="aempty">No one else is in the fold. If the leader falls now, the Hold falls with them.</div>';
  }
  let dh='';
  DISTRICTS.forEach(d=>{
    const owned=Hold.districts.includes(d.id);
    dh+='<div class="arow'+(owned?'':' locked')+'"><div class="ar-grade">'+(owned?'✓':'—')+'</div><div style="flex:1"><div class="ar-name">'+d.name+'</div>'+
      '<div class="ar-meta">'+d.desc+'</div>'+
      (owned?'<div class="ar-meta">yielding '+money(d.funds)+' · '+d.supplies+' supplies, every year</div>':'<div class="ar-meta">unclaimed — an opportunity to seize it may present itself</div>')+
      '</div></div>';
  });
  const trustRisk = Hold.trust<20?'the fold may move against you':Hold.trust<40?'grumbling could turn into worse':'no sign of trouble';
  let ah='';
  [['liequiet','LIE LOW'],['fortify','FORTIFY']].forEach(([k,label])=>{
    const cooling = Hold.year<Hold.cooldowns[k];
    const blocked = k==='liequiet' ? Hold.heat<10 : Hold.resources.funds<150;
    const ready = !cooling && !blocked;
    const note = cooling ? 'cooling · '+(Hold.cooldowns[k]-Hold.year)+'y' : blocked ? (k==='liequiet'?'heat already low':'needs $150+') : (k==='liequiet'?'−HEAT · free':'−$150 · −HEAT · free');
    ah+='<button class="cstamp '+(ready?'ready':'sealed')+'" data-hold-act="'+k+'"><b>'+label+'</b><span>'+note+'</span></button>';
  });
  $('#holdSheet').innerHTML=
    '<div class="ps-head"><span>'+(Hold.name||'UNNAMED HOLD').toUpperCase()+'</span><span>GEN. '+Hold.generation+'</span></div>'+
    '<div class="aempty" style="margin:6px 2px 12px">Founded '+Hold.founded+' · '+Hold.place+' · '+(Hold.year-Hold.founded)+' years running · '+(Hold.pastLeaders.length)+' leader'+(Hold.pastLeaders.length===1?'':'s')+' before this one</div>'+
    '<div class="stat"><span class="slabel">FUNDS</span><div class="sbar"><div class="sfill f-health" style="width:'+clamp(Hold.resources.funds/1000*100,0,100)+'%"></div></div><b class="sval">'+money(Hold.resources.funds)+'</b></div>'+
    '<div class="stat"><span class="slabel">SUPPLIES</span><div class="sbar"><div class="sfill f-happiness" style="width:'+clamp(Hold.resources.supplies/200*100,0,100)+'%"></div></div><b class="sval">'+Hold.resources.supplies+'</b></div>'+
    '<div class="stat"><span class="slabel">HEAT</span><div class="sbar"><div class="sfill f-health" style="width:'+clamp(Hold.heat,0,100)+'%"></div></div><b class="sval">'+Math.round(Hold.heat)+'</b></div>'+
    '<div class="stat"><span class="slabel">TRUST</span><div class="sbar"><div class="sfill f-happiness" style="width:'+clamp(Hold.trust,0,100)+'%"></div></div><b class="sval">'+Math.round(Hold.trust)+'</b></div>'+
    '<div class="aempty" style="margin:2px 2px 10px">The fold is '+trustText(Hold.trust)+' — '+trustRisk+'.</div>'+
    '<div class="ps-sub"><span>HOLD ACTIONS · FREE, NO PERSONAL HOURS</span></div><div class="ps-clerk">'+ah+'</div>'+
    '<div class="ps-sub"><span>DISTRICTS · '+Hold.districts.length+'/'+DISTRICTS.length+' HELD</span></div>'+
    '<div style="margin:0 2px 8px">'+dh+'</div>'+
    '<div class="ps-sub"><span>THE FOLD · '+alive.length+' MEMBER'+(alive.length===1?'':'S')+'</span></div>'+
    '<div style="margin:0 2px">'+mh+'</div>'+
    '<div class="ps-foot"><button class="btn" id="holdClose">Close the File ▸</button></div>';
  $('#holdClose').onclick=()=>{ $('#holdWrap').classList.add('hidden'); };
  $('#holdSheet').onclick=e=>{ const b=e.target.closest('[data-hold-act]'); if(b&&b.classList.contains('ready')){ holdAction(b.dataset.holdAct); } };
  $('#holdWrap').classList.remove('hidden');
}

