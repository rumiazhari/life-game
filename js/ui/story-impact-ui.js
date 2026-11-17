'use strict';
/* RPG Visual (Phase 10): purely reads canonical StorySystem/NPC state. */
(function(root){
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):lo));
 const escape=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 }[ch]));
 const ICON=Object.freeze({stat:'✦',scrutiny:'⚖',money:'◈',skill:'◇',npcBond:'♥',
  memory:'♧',storyItem:'▤',takeStoryItem:'▤',jobRaise:'⚒',jobEnd:'⛓',record:'◉'});
 const STATS=new Set(['health','happiness','relations','smarts','familyMood','freedom','looks']);
 const num=n=>Number.isFinite(Number(n))?Math.round(Number(n)):0;
 function describe(e){
  if(!e||typeof e!=='object'||!ICON[e.kind])return null;
  const d=num(e.delta);
  const sign=d>0?'+':d<0?'−':'';
  const value=Math.abs(d);
  switch(e.kind){
   case 'stat':return STATS.has(e.stat)?
    {icon:ICON.stat,text:e.stat.toUpperCase()+' '+sign+value,positive:d>0}:null;
   case 'scrutiny':return {icon:ICON.scrutiny,text:'SCRUTINY '+sign+value,positive:d<0};
   case 'money':return {icon:ICON.money,text:'CASH '+sign+'$'+value,positive:d>0};
   case 'skill':return /^[a-z]{2,20}$/.test(String(e.skill))?
    {icon:ICON.skill,text:e.skill.toUpperCase()+' +'+Math.max(0,value),positive:true}:null;
   case 'npcBond':return {icon:ICON.npcBond,text:'NPC BOND '+sign+value,positive:d>0};
   case 'memory':return {icon:ICON.memory,text:'RELATIONSHIP MEMORY',positive:Number(e.valence)>0};
   case 'storyItem':return {icon:ICON.storyItem,text:'EVIDENCE',positive:true};
   case 'takeStoryItem':return {icon:ICON.takeStoryItem,text:'EVIDENCE USED',positive:false};
   case 'jobRaise':return {icon:ICON.jobRaise,text:'CONTRACT REVIEW',positive:true};
   case 'jobEnd':return {icon:ICON.jobEnd,text:'POSITION CHANGE',positive:false};
   case 'record':return {icon:ICON.record,text:'OFFICIAL RECORD',positive:false};
   default:return null;
  }
 }
 function branch(scene,run,target){
  if(!target)return 'UNKNOWN';
  const node=run&&run.scenes&&Object.prototype.hasOwnProperty.call(run.scenes,target)?run.scenes[target]:null;
  if(!node||!node.ending)return 'STORY CONTINUES';
  const effects=(node.ending.effects||[]).map(describe).filter(Boolean).slice(0,4);
  return effects.length?effects.map(e=>
   '<span class="vn-impact-chip '+(e.positive?'up':'down')+'"><i aria-hidden="true">'+
   escape(e.icon)+'</i>'+escape(e.text)+'</span>').join(''):
   '<span class="vn-impact-chip neutral">NO DIRECT STAT CHANGE</span>';
 }
 function effectStrip(run,option){
  if(!run||!option)return '';
  const scene=run.scenes&&run.scenes[run.sceneId];
  const def=scene&&scene.choice&&scene.choice.options&&scene.choice.options[option.index];
  if(!def)return '';
  const possible=def.check&&option.check;
  const goto=def.goto;
  const fail=def.check&&def.check.failGoto;
  if(!possible){
   return '<div class="vn-impact" aria-label="Guaranteed choice preview">'+
    '<span class="vn-impact-label" aria-label="Guaranteed choice without dice">NO DICE · GUARANTEED</span>'+
    '<div class="vn-impact-outcome">'+branch(scene,run,goto)+'</div></div>';
  }
  const chance=Math.round(clamp(option.check.percent,0,100));
  const first=branch(scene,run,goto);
  const second=branch(scene,run,fail||goto);
  return '<div class="vn-impact" aria-label="3d6 chance and possible outcomes">'+
   '<span class="vn-impact-label">CHANCE TO PASS · '+chance+'%</span>'+
   '<div class="vn-chance-track" role="img" aria-label="Chance to pass this check: '+chance+' percent">'+
   '<span class="vn-chance-fill" style="--vn-chance:'+chance+'%"></span></div>'+
   '<div class="vn-impact-branches"><span class="vn-impact-branch"><strong>SUCCESS</strong>'+
   first+'</span><span class="vn-impact-branch"><strong>SETBACK</strong>'+second+'</span></div></div>';
 }
 function relationshipStrip(w,s,run){
  const ref=run&&((run.social&&run.social.npcId)||(run.thread&&run.thread.npcId)||
   (run.context&&run.context.npcId));
  const id=String(s&&s.npcId||'subject');
  const npc=ref&&w&&w.npcs&&w.npcs[ref];
  const r=npc&&npc.relationships&&npc.relationships[id];
  if(!r||npc.alive===false)return '';
  const name=escape(String(npc.name||'Known person').slice(0,72));
  const data=[
   {key:'TRUST',value:Math.round(clamp(r.trust,0,100))},
   {key:'CLOSENESS',value:Math.round(clamp(r.closeness,0,100))},
   {key:'CONFLICT',value:Math.round(clamp(r.conflict,0,100))}
  ];
  return '<section class="vn-relation" aria-label="Current recorded NPC relationship">'+
   '<div class="vn-relation-heading"><span aria-hidden="true">♥</span><strong>'+name+
   '</strong><small>RECORDED RELATIONSHIP</small></div>'+
   '<div class="vn-relation-meters">'+data.map(entry=>
    '<div class="vn-relation-meter"><span>'+entry.key+'</span>'+
    '<div class="vn-relation-track" role="img" aria-label="'+entry.key.toLowerCase()+' '+entry.value+
     ' of 100"><span style="--vn-relation:'+entry.value+'%"></span></div>'+
    '<b>'+entry.value+'</b></div>').join('')+'</div></section>';
 }
 function beatMarker(run,view){
  if(!run||!view)return '';
  const decisionCount=Array.isArray(run.history)?run.history.filter(e=>e.type==='choice').length:0;
  const beat=Math.min(99,decisionCount+1);
  return '<div class="vn-beat" role="status" aria-label="Story beat '+beat+'">'+
   '<span aria-hidden="true">▰ ▰ ▰</span><b>BEAT '+beat+'</b><small>'+
    (view.type==='choice'?'CHOICE':view.type==='ending'?'CONSEQUENCE':'SCENE')+
   '</small></div>';
 }
 root.RPGVisual=Object.freeze({describe,effectStrip,relationshipStrip,beatMarker});
})(typeof globalThis!=='undefined'?globalThis:this);
