'use strict';
/* Character-first, lightweight quest journal: derived entirely from StorySystem.
 * No independent quest save, action currency, or world/map mutations. */
(function(root){
 const el=id=>document.getElementById(id);
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
 const artFor=arc=>({WORK:'factory_floor',FAMILY:'night_flat',BUREAU:'office',SCHOOL:'schoolyard',TRADE:'dock_night'})[arc]||'street';
 function closeBoard(){const w=el('storyWrap');if(w)w.classList.add('hidden');}
 function renderBoard(){
  const sheet=el('storySheet');if(!sheet)return;
  if(typeof root.StorySystem!=='object'||!root.World||!root.S){
   sheet.innerHTML='<p>No subject file open.</p>';return;
  }
  const live=root.StorySystem.currentView(root.World,{year:root.World.year,subject:root.S});
  const leads=root.StorySystem.availableQuests(root.World,{subject:root.S,lineage:root.Lineage});
  const archive=Object.values(root.World.storyArchive||{}).filter(a=>a&&a.quest)
    .sort((a,b)=>b.resolvedYear-a.resolvedYear).slice(0,9);
  const kit=Object.values(root.World.storyItems||{}).slice(0,15);
  const rpg=root.RPG&&root.RPG.recordFor?root.RPG.recordFor(root.World,'subject'):null;
  let html='<div class="qs-head"><div><small>KARSEN · PERSONAL CHRONICLE</small><h2>YOUR STORIES <span>🎲</span></h2></div><button type="button" class="qs-x" data-qs-close aria-label="Close stories">×</button></div>';
  html+='<div class="qs-stats"><span>⚔️ GRADE <b>'+ (rpg&&root.RPG.roman?root.RPG.roman(rpg.grade):'I')+'</b></span><span>✦ MERIT <b>'+(rpg?rpg.merit:0)+'</b></span><span>📜 STORIES <b>'+archive.length+'</b></span></div>';
  if(live){
    html+='<button class="qs-current" data-qs-resume type="button"><span class="qs-live-glyph">🎭</span><span><small>IN PROGRESS</small><strong>'+esc(live.title)+'</strong></span><b>CONTINUE ▸</b></button>';
  }
  html+='<div class="qs-section"><b>CHOOSE YOUR NEXT STORY</b><small>'+leads.length+' AVAILABLE</small></div>';
  if(!leads.length&&!live)html+='<div class="qs-blank">🕯️ <strong>No open leads</strong><span>New stories emerge as your life changes.</span></div>';
  else if(!leads.length)html+='<div class="qs-blank">Finish the current chapter to see new leads.</div>';
  else html+='<div class="qs-grid">'+leads.map((lead,i)=>{
    const img=typeof root.vnBackdropArt==='function'?root.vnBackdropArt(artFor(lead.arc)):'';
    return '<button class="qs-card" type="button" data-qs-start="'+esc(lead.id)+'" '+(live?'disabled title="Finish the active story first"':'')+'>'+
      '<div class="qs-art">'+img+'<span class="qs-arc">'+esc(lead.arc)+'</span><span class="qs-glyph">'+esc(lead.icon)+'</span></div>'+
      '<div class="qs-cardbody"><strong>'+esc(lead.title)+'</strong><small>'+esc(lead.hint)+'</small>'+
      '<span class="qs-play">'+(lead.followup?'↩ CONTINUATION':'▶ PLAY STORY')+'</span></div></button>';
   }).join('')+'</div>';
  html+='<div class="qs-section"><b>STORY GEAR</b><small>'+kit.length+' ITEMS</small></div>';
  html+='<div class="qs-kit">'+(kit.length?kit.map(k=>'<span title="'+esc(k.label)+'">'+esc(k.icon||'📜')+' '+esc(k.label)+'</span>').join(''):
    '<span class="qs-muted">Earn evidence and tools through choices.</span>')+'</div>';
  if(archive.length)html+='<div class="qs-section"><b>CONSEQUENCES</b><small>YOUR RECENT CHAPTERS</small></div>'+
    '<div class="qs-timeline">'+archive.map(a=>'<div class="qs-history"><span>✧</span><div><strong>'+esc(a.endingTitle||a.title)+'</strong><small>'+esc(a.title)+' · '+esc(a.resolvedYear)+'</small></div></div>').join('')+'</div>';
  sheet.innerHTML=html;
 }
 function openBoard(){
  if(!root.S||!root.World||!root.S.alive)return;
  renderBoard();el('storyWrap').classList.remove('hidden');
 }
 const button=el('btn-stories'),wrap=el('storyWrap'),sheet=el('storySheet');
 if(button)button.addEventListener('click',openBoard);
 if(wrap)wrap.addEventListener('click',e=>{if(e.target===wrap)closeBoard();});
 if(sheet)sheet.addEventListener('click',e=>{
  if(e.target.closest('[data-qs-close]')){closeBoard();return;}
  if(e.target.closest('[data-qs-resume]')){closeBoard();if(typeof root.openStorySlip==='function')root.openStorySlip(true);return;}
  const start=e.target.closest('[data-qs-start]');if(!start||start.disabled)return;
  const result=root.StorySystem.startQuest(root.World,start.dataset.qsStart,{subject:root.S,lineage:root.Lineage,year:root.World.year});
  if(!result.ok){renderBoard();return;}
  closeBoard();
  if(typeof root.openStorySlip==='function')root.openStorySlip(true);
 });
 root.openStoryBoard=openBoard;
 root.renderStoryBoard=renderBoard;
})(typeof globalThis!=='undefined'?globalThis:this);
