'use strict';
/* Character-first, lightweight quest journal: derived entirely from StorySystem.
 * No independent quest save, action currency, or world/map mutations. */
(function(root){
 const el=id=>document.getElementById(id);
 const player=()=>typeof S!=='undefined'?S:null;
 const gameWorld=()=>typeof World!=='undefined'?World:null;
 const lineage=()=>typeof Lineage!=='undefined'?Lineage:null;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let playtestOpen=false,copyStatus='';
 const artFor=arc=>({WORK:'factory_floor',FAMILY:'night_flat',BUREAU:'office',SCHOOL:'schoolyard',TRADE:'dock_night',CAREER:'factory_floor',UNDERWORLD:'dock_night'})[arc]||'street';
 function closeBoard(){const w=el('storyWrap');if(w)w.classList.add('hidden');}
 function playtestOptions(leads){
  return {availableLeads:leads.length,
   energyUsed:typeof energyUsed==='function'?energyUsed():null,
   energyTotal:typeof planHours==='function'?planHours():null};
 }
 function playtestHtml(leads){
  const m=root.RPGPlaytest.snapshot(gameWorld(),player(),playtestOptions(leads));
  const answered=root.RPGPlaytest.ratings();
  const summaries=[
   ['ARCHIVED',m.archivedChapters],
   ['KNOWN ROLLS',m.documentedChecks],
   ['OPEN LEADS',m.availableLeads]
  ];
  return '<section class="qs-eval" aria-label="Optional formative playtest">'+
   '<div class="qs-eval-metrics">'+summaries.map(([key,n])=>
     '<div class="qs-eval-metric"><b>'+esc(n==null?'—':n)+'</b><small>'+esc(key)+'</small></div>').join('')+'</div>'+
   (m.unknownCheckArchives?'<small class="qs-eval-warn">'+esc(m.unknownCheckArchives)+' past chapters have unrecorded roll counts</small>':'')+
   '<p class="qs-eval-privacy">FORMATIVE · UNVALIDATED · PAGE MEMORY ONLY · NO TRACKING</p>'+
   '<p class="qs-eval-scale">1 = STRONGLY DISAGREE · 5 = STRONGLY AGREE</p>'+
   root.RPGPlaytest.QUESTIONS.map(q=>
    '<div class="qs-eval-row"><div><strong>'+esc(q.title)+'</strong><small>'+esc(q.prompt)+'</small></div>'+
    '<div class="qs-eval-numbers" role="group" aria-label="'+esc(q.title)+' rating 1 to 5">'+
    [1,2,3,4,5].map(n=>
     '<button type="button" data-qs-rate="'+esc(q.id)+'" data-qs-value="'+n+'" aria-pressed="'+(answered[q.id]===n?'true':'false')+'">'+n+'</button>'
    ).join('')+'</div></div>'
   ).join('')+
   '<div class="qs-eval-actions"><button type="button" class="qs-eval-copy" data-qs-pt-copy>COPY ANONYMOUS REPORT</button>'+
   '<a class="qs-eval-save" download="life-file-playtest.json" href="'+
    esc('data:application/json;charset=utf-8,'+
      encodeURIComponent(root.RPGPlaytest.exportJSON(gameWorld(),player(),playtestOptions(leads))))+
    '">SAVE JSON</a>'+
   '<button type="button" class="qs-eval-reset" data-qs-pt-reset>RESET</button></div>'+
   '<small class="qs-eval-copy-status" role="status">'+esc(copyStatus)+'</small></section>';
 }
 function copyPlaytest(){
  if(!root.RPGPlaytest)return;
  const available=root.StorySystem.availableQuests(gameWorld(),{subject:player(),lineage:lineage()});
  const json=root.RPGPlaytest.exportJSON(gameWorld(),player(),playtestOptions(available));
  const clipboard=typeof navigator!=='undefined'&&navigator.clipboard;
  if(!clipboard||typeof clipboard.writeText!=='function'){
   copyStatus='COPY UNAVAILABLE';renderBoard();return;
  }
  try{
   Promise.resolve(clipboard.writeText(json)).then(()=>{
    copyStatus='REPORT COPIED';renderBoard();
   },()=>{
    copyStatus='COPY FAILED';renderBoard();
   });
  }catch(_){copyStatus='COPY FAILED';renderBoard();}
 }
 function renderBoard(){
  const sheet=el('storySheet');if(!sheet)return;
  if(typeof root.StorySystem!=='object'||!gameWorld()||!player()){
   sheet.innerHTML='<p>No subject file open.</p>';return;
  }
  if(root.RPGPlaytest&&typeof root.RPGPlaytest.bindWorld==='function')
    root.RPGPlaytest.bindWorld(gameWorld());
  const live=root.StorySystem.currentView(gameWorld(),{year:gameWorld().year,subject:player()});
  const leads=root.StorySystem.availableQuests(gameWorld(),{subject:player(),lineage:lineage()});
  const archive=Object.values(gameWorld().storyArchive||{}).filter(a=>a&&a.quest)
    .sort((a,b)=>b.resolvedYear-a.resolvedYear).slice(0,9);
  const kit=Object.values(gameWorld().storyItems||{}).slice(0,15);
  const energyLeft=typeof planHours==='function'&&typeof energyUsed==='function'?Math.max(0,planHours()-energyUsed()):Infinity;
  const rpg=root.RPG&&root.RPG.recordFor?root.RPG.recordFor(gameWorld(),'subject'):null;
  let html='<div class="qs-head"><div><small>KARSEN · PERSONAL CHRONICLE</small><h2>YOUR STORIES <span>🎲</span></h2></div><button type="button" class="qs-x" data-qs-close aria-label="Close stories">×</button></div>';
  html+='<div class="qs-stats"><span>⚔️ GRADE <b>'+ (rpg&&root.RPG.roman?root.RPG.roman(rpg.grade):'I')+'</b></span><span>✦ MERIT <b>'+(rpg?rpg.merit:0)+'</b></span><span>📜 STORIES <b>'+archive.length+'</b></span></div>';
  if(root.RPGPlaytest){
    html+='<div class="qs-pt-bar"><button type="button" data-qs-pt-toggle aria-expanded="'+
     (playtestOpen?'true':'false')+'">◉ PLAYTEST</button>'+
     '<small>OPTIONAL · LOCAL ONLY</small></div>';
    if(playtestOpen)html+=playtestHtml(leads);
  }
  if(live){
    html+='<button class="qs-current" data-qs-resume type="button"><span class="qs-live-glyph">🎭</span><span><small>IN PROGRESS</small><strong>'+esc(live.title)+'</strong></span><b>CONTINUE ▸</b></button>';
  }
  if(rpg&&root.RPG&&!rpg.background){
    html+='<div class="qs-section"><b>YOUR BACKGROUND</b><small>CHOOSE ONCE · FREE</small></div>';
    html+='<div class="qs-picks">'+root.RPG.BACKGROUNDS.map(b=>
      '<button class="qs-pick" type="button" data-qs-bg="'+esc(b.id)+'"><strong>'+esc(b.name)+'</strong><small>'+esc(b.line)+'</small></button>').join('')+'</div>';
  }
  if(rpg&&root.RPG&&rpg.grade>=2){
    const held=Object.keys(rpg.perks||{}).filter(id=>rpg.perks[id]);
    const nativeBackground=root.RPG.BACKGROUNDS.find(b=>b.id===rpg.background);
    const used=held.filter(id=>!nativeBackground||id!==nativeBackground.perk).length;
    const capacity=rpg.grade>=6?3:rpg.grade>=4?2:1;
    const eligible=root.RPG.PERKS.filter(p=>p.minGrade<=rpg.grade&&!rpg.perks[p.id]);
    if(used<capacity&&eligible.length){
      html+='<div class="qs-section"><b>EARNED PERK</b><small>'+(capacity-used)+' SLOT AVAILABLE</small></div>';
      html+='<div class="qs-picks">'+eligible.map(p=>
        '<button class="qs-pick" type="button" data-qs-perk="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong><small>'+esc(p.desc)+'</small></button>').join('')+'</div>';
    }
  }
  html+='<div class="qs-section"><b>CHOOSE YOUR NEXT STORY</b><small>'+leads.length+' AVAILABLE</small></div>';
  if(!leads.length&&!live)html+='<div class="qs-blank">🕯️ <strong>No open leads</strong><span>New stories emerge as your life changes.</span></div>';
  else if(!leads.length)html+='<div class="qs-blank">Finish the current chapter to see new leads.</div>';
  else html+='<div class="qs-grid">'+leads.map((lead,i)=>{
    const img=typeof root.vnBackdropArt==='function'?root.vnBackdropArt(artFor(lead.arc)):'';
    const depleted=lead.energyCost>energyLeft;
    return '<button class="qs-card" type="button" data-qs-start="'+esc(lead.id)+'" '+(live?'disabled title="Finish the active story first"':depleted?'disabled title="No annual energy remaining"':'')+'>'+
      '<div class="qs-art">'+img+'<span class="qs-arc">'+esc(lead.arc)+'</span><span class="qs-glyph">'+esc(lead.icon)+'</span></div>'+
      '<div class="qs-cardbody"><strong>'+esc(lead.title)+'</strong><small>'+esc(lead.hint)+'</small>'+
      '<span class="qs-play">'+(depleted?'🔒 NO ENERGY':lead.energyCost?'🔋 '+lead.energyCost+' ENERGY':lead.followup?'↩ CONTINUATION':'▶ PLAY STORY')+'</span></div></button>';
   }).join('')+'</div>';
  html+='<div class="qs-section"><b>STORY GEAR</b><small>'+kit.length+' ITEMS</small></div>';
  const gear=root.RPGProgression?root.RPGProgression.evidenceFor(gameWorld(),player()):[];
  html+='<div class="qs-kit">'+(kit.length?kit.map(k=>{
    const bonus=gear.find(g=>g.id===k.id);
    return '<span title="'+esc(k.label)+'">'+esc(k.icon||'\u{1F4DC}')+' '+esc(k.label)+
      (bonus?'<small class="qs-gear-bonus">'+esc(bonus.domain.toUpperCase()+' +'+bonus.bonus)+'</small>':'')+'</span>';
  }).join(''):'<span class="qs-muted">Earn evidence and tools through choices.</span>')+'</div>';
  if(archive.length)html+='<div class="qs-section"><b>CONSEQUENCES</b><small>YOUR RECENT CHAPTERS</small></div>'+
    '<div class="qs-timeline">'+archive.map(a=>'<div class="qs-history"><span>✧</span><div><strong>'+esc(a.endingTitle||a.title)+'</strong><small>'+esc(a.title)+' · '+esc(a.resolvedYear)+'</small></div></div>').join('')+'</div>';
  sheet.innerHTML=html;
 }
 function openBoard(){
  if(!player()||!gameWorld()||!player().alive)return;
  renderBoard();el('storyWrap').classList.remove('hidden');
 }
 const button=el('btn-stories'),wrap=el('storyWrap'),sheet=el('storySheet');
 if(button)button.addEventListener('click',openBoard);
 if(wrap)wrap.addEventListener('click',e=>{if(e.target===wrap)closeBoard();});
 if(sheet)sheet.addEventListener('click',e=>{
  if(e.target.closest('[data-qs-close]')){closeBoard();return;}
  if(e.target.closest('[data-qs-pt-toggle]')){
   playtestOpen=!playtestOpen;copyStatus='';renderBoard();return;
  }
  if(e.target.closest('[data-qs-pt-reset]')){
   if(root.RPGPlaytest)root.RPGPlaytest.reset();
   copyStatus='';renderBoard();return;
  }
  const rate=e.target.closest('[data-qs-rate]');
  if(rate){
   if(root.RPGPlaytest)root.RPGPlaytest.rate(rate.dataset.qsRate,rate.dataset.qsValue);
   copyStatus='';renderBoard();return;
  }
  if(e.target.closest('[data-qs-pt-copy]')){copyPlaytest();return;}
  if(e.target.closest('[data-qs-resume]')){closeBoard();if(typeof root.openStorySlip==='function')root.openStorySlip(true);return;}
  const bg=e.target.closest('[data-qs-bg]');
  if(bg){if(root.RPG&&root.RPG.setBackground(gameWorld(),'subject',bg.dataset.qsBg).ok)renderBoard();return;}
  const perk=e.target.closest('[data-qs-perk]');
  if(perk){if(root.RPG&&root.RPG.unlockPerk(gameWorld(),'subject',perk.dataset.qsPerk).ok)renderBoard();return;}
  const start=e.target.closest('[data-qs-start]');if(!start||start.disabled)return;
  const left=typeof planHours==='function'&&typeof energyUsed==='function'?Math.max(0,planHours()-energyUsed()):Infinity;
  const result=root.StorySystem.startQuest(gameWorld(),start.dataset.qsStart,{subject:player(),lineage:lineage(),year:gameWorld().year,remainingEnergy:left});
  if(!result.ok){renderBoard();return;}
  const cost=Math.min(1,Math.max(0,Number(result.energyCost)||0));
  if(cost&&typeof markActionDone==='function')markActionDone('story-chapter:'+result.runId);
  closeBoard();
  if(typeof root.openStorySlip==='function')root.openStorySlip(true);
 });
 root.openStoryBoard=openBoard;
 root.renderStoryBoard=renderBoard;
})(typeof globalThis!=='undefined'?globalThis:this);
