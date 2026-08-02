'use strict';
/* ================= WIRING ================= */
function revealDossier(){
  const cw=$('#cover'); if(!cw.classList.contains('hidden')){ cw.classList.add('gone'); setTimeout(()=>cw.classList.add('hidden'),460); }
  const d=$('#dossier'); d.classList.remove('hidden','reveal'); void d.offsetWidth; d.classList.add('reveal');
  document.body.classList.add('playing');
  renderIdentity(); renderStats(null); renderYear(); updateBar(); renderStreak(); renderStage();
  checkAchievements('live');
  if(Lineage.generation>1){
    logEv('SUCCESSION. '+S.first+' '+S.last+' takes up the family file at age '+S.age+'. Generation '+Lineage.generation+' begins.',null,'open','RECORD CONTINUES · '+currentYear());
    logEv('The family record continues. Hold enrollment is optional.');
    return;
  }
  logEv('FILE OPENED. Subject registered: '+S.first+' '+S.last+', '+S.sex+', born '+S.dob+', '+S.place+'. The century ahead has plans.',null,'open','RECORD BEGINS · '+S.dob);
  logEv('Initial indices recorded. From age six the subject may spend their hours.');
  const famT=FAMILY_TIERS.find(f=>f.id===S.familyTier); if(famT) logEv('FAMILY OF ORIGIN. '+famT.label.toUpperCase()+'. '+famT.line+'.',null,'milestone','MILESTONE · YEAR 0');
  const gi=GUARD_INFO[guardTier()]; logEv('GUARDIANSHIP. '+gi.label+'. '+gi.line,null,'milestone','MILESTONE · YEAR 0');
}

function newFile(){
  queue=[]; typing=false; clearInterval(typeTimer); currentType=null;
  followups=[]; petitionNo=0; slipOpen=false;
  introRerolls=3;
  recentYearReports=[]; renderRecentRecord();
  document.body.classList.remove('slip-open','petition-open');
  newWorld(); newLineage(); newHold(); newSubject(); window.C={}; $('#log').innerHTML='';
  $('#slipWrap').classList.add('hidden'); $('#planWrap').classList.add('hidden'); $('#medicalWrap').classList.add('hidden');
  $('#mapWrap').classList.add('hidden');
  openIntro();
}
$('#btn-open').addEventListener('click',()=>{ snd('paper'); newFile(); });
$('#btn-reopen').addEventListener('click',()=>{ snd('paper'); $('#closedWrap').classList.add('hidden'); renderArchiveCount(); newFile(); });
$('#btn-archive').addEventListener('click',()=>{ snd('paper'); openArchive(); });
$('#btn-achieve').addEventListener('click',()=>{ snd('paper'); openAchievements(); });
$('#btn-achieve-cover').addEventListener('click',()=>{ snd('paper'); openAchievements(); });
$('#btn-map').addEventListener('click',()=>{ snd('paper'); openMap(); });
renderArchiveCount();
renderAchieveCount();
$('#btn-advance').addEventListener('click',advance);
$('#btn-fastforward').addEventListener('click',fastForward);
$('#btn-plan').addEventListener('click',openPlan);
$('#planWrap').addEventListener('click',e=>{ if(e.target.id==='planWrap') closePlan(); });
$('#medicalWrap').addEventListener('click',e=>{ if(e.target.id==='medicalWrap') $('#medicalWrap').classList.add('hidden'); });
$('#btn-sound').addEventListener('click',e=>{ soundOn=!soundOn; e.target.textContent='SOUND: '+(soundOn?'ON':'OFF'); if(soundOn) snd('paper'); });
$('#btn-hold').addEventListener('click',()=>{ snd('paper'); openHold(); });
$('#btn-caselog').addEventListener('click',()=>{ snd('paper'); openCaseLog(); });
$('#recentRecordOpen').addEventListener('click',()=>{ snd('paper'); openCaseLog(); });
$('#inventory').addEventListener('click',e=>{ if(e.target.closest('#invOpenHousehold')){ snd('paper'); openHousehold(); return; } if(e.target.closest('#invOpenMedical')){ snd('paper'); openMedicalFile(); } });
$('#logClose').addEventListener('click',()=>{ $('#logWrap').classList.add('hidden'); });
document.addEventListener('keydown',e=>{
  if(e.code==='Space'&&!$('#dossier').classList.contains('hidden')&&$('#planWrap').classList.contains('hidden')&&$('#slipWrap').classList.contains('hidden')&&$('#closedWrap').classList.contains('hidden')&&$('#intentWrap').classList.contains('hidden')&&$('#mapWrap').classList.contains('hidden')&&$('#medicalWrap').classList.contains('hidden')){ e.preventDefault(); advance(); }
});

(function(){
  const strip=$('#tabstrip'); if(!strip) return;
  let down=false, dragged=false, startX=0, startScroll=0, pid=null;
  strip.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse') return;
    down=true; dragged=false; startX=e.clientX; startScroll=strip.scrollLeft; pid=e.pointerId;
  });
  strip.addEventListener('pointermove',e=>{
    if(!down) return;
    const dx=e.clientX-startX;
    if(!dragged&&Math.abs(dx)>4){ dragged=true; strip.classList.add('dragging'); try{strip.setPointerCapture(pid);}catch(_){} }
    if(dragged) strip.scrollLeft=startScroll-dx;
  });
  function stopDrag(){ down=false; strip.classList.remove('dragging'); }
  strip.addEventListener('pointerup',stopDrag);
  strip.addEventListener('pointercancel',stopDrag);
  strip.addEventListener('click',e=>{ if(dragged){ e.preventDefault(); e.stopPropagation(); } dragged=false; },true);
})();

window.__lifeReady=true;
