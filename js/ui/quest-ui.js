'use strict';
/* Quest board: optional, visual-first and non-blocking. No map ownership. */
(function(root){
 if(typeof document==='undefined'||!root.QuestEngine)return;
 const $=id=>document.getElementById(id);
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let selected=null,flash=null;
 const qicon={documents:'📑',medical_kit:'🧰',witness_letter:'✉️',ration_vouchers:'🍞',trade_permit:'🪪',family_diary:'📓'};
 function game(){try{return typeof World!=='undefined'&&World&&typeof S!=='undefined'&&S?{world:World,subject:S}:null;}catch(e){return null;}}
 function byTag(tag){return ({WORK:'⚙️',HEALTH:'✚',MYSTERY:'◈',COMMUNITY:'✳',TRADE:'▤',FAMILY:'♡'})[tag]||'◈';}
 function art(tag){
   const variants={WORK:['#293c49','#d99550','M 0 155 L 80 138 80 74 150 74 150 119 218 119 218 61 308 61 308 130 380 130 380 94 480 94 480 165 600 165 600 190 0 190 Z'],
     HEALTH:['#253d47','#92b3b6','M 0 180 L 60 180 60 95 155 95 155 35 270 35 270 95 380 95 380 55 480 55 480 150 600 150 600 190 0 190 Z'],
     MYSTERY:['#29303e','#b3a1a0','M 0 180 L 130 180 130 25 192 25 192 160 315 160 315 60 385 60 385 180 500 180 500 100 550 100 550 190 0 190 Z'],
     COMMUNITY:['#4a3b34','#e4bd8d','M 0 190 L 0 140 100 140 130 90 210 90 235 155 305 155 350 70 470 70 510 155 600 155 600 190 Z'],
     TRADE:['#253f4d','#b2c9c8','M 0 180 L 0 120 130 120 130 80 250 80 280 120 380 120 410 65 510 65 540 120 600 120 600 190 0 190 Z'],
     FAMILY:['#3c3946','#deb89b','M 0 185 L 85 185 85 105 175 55 275 105 275 180 315 180 315 90 415 40 515 90 515 185 600 185 600 190 0 190 Z']};
   const v=variants[tag]||variants.MYSTERY;
   return '<svg viewBox="0 0 600 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="q-scene-svg">'+
     '<defs><linearGradient id="q-sky" x2="0" y2="1"><stop stop-color="'+v[0]+'"/><stop offset="1" stop-color="'+v[1]+'"/></linearGradient></defs>'+
     '<rect width="600" height="190" fill="url(#q-sky)"/>'+
     '<circle class="q-moon" cx="460" cy="43" r="25" fill="#f6d8a5" opacity=".82"/>'+
     '<path d="'+v[2]+'" fill="#1b2730" opacity=".7"/>'+
     '<path d="M0 177 Q130 167 270 178 T600 171 V190 H0 Z" fill="#1b2327"/>'+
     '<g class="q-fireflies"><circle cx="82" cy="44" r="1.8"/><circle cx="145" cy="83" r="1.5"/><circle cx="339" cy="27" r="2"/><circle cx="541" cy="68" r="1.3"/></g>'+
     '</svg>';
 }
 function badge(){
   const g=game(),b=$('questTab');if(!b)return;
   if(!g){b.textContent='⚔ QUESTS';return;}
   const s=root.QuestEngine.summary(g.world,g.subject);
   b.textContent='⚔ QUESTS'+(s.active?' · '+s.active:'');
 }
 function scene(){
   const g=game();if(!g)return '<div class="q-emptystate">Open a personal file to play.</div>';
   const items=root.QuestEngine.catalog(g.world,g.subject);
   const left=items.map(x=>'<button class="q-thread'+(x.runId===selected?' active':'')+'" data-q-open="'+esc(x.runId||'')+'" data-q-start="'+esc(x.canStart?x.id:'')+'" '+(!x.runId&&!x.canStart?'disabled':'')+'>'+
     '<span class="q-thread-icon">'+esc(x.icon)+'</span><span class="q-thread-copy"><b>'+esc(x.title)+'</b><small>'+esc(x.stage==='available'?'NEW':x.stage==='completed'?'FILED':x.stage==='waiting'?'NEXT YEAR':x.stage.toUpperCase())+'</small></span>'+
     '<span class="q-thread-arrow">›</span></button>').join('');
   let r=selected&&root.QuestEngine.view(g.world,g.subject,selected);
   if(!r){const first=items.find(x=>x.runId&&x.stage!=='completed')||items.find(x=>x.runId);if(first){selected=first.runId;r=root.QuestEngine.view(g.world,g.subject,selected);}}
   const summary=root.QuestEngine.summary(g.world,g.subject);
   const kit=Object.keys(summary.kit).filter(id=>summary.kit[id]>0).map(id=>'<span class="q-item">'+(qicon[id]||'✦')+' <b>×'+summary.kit[id]+'</b></span>').join('');
   let right;
   if(flash){
     const result=flash;right='<div class="q-outcome '+(result.success?'success':'failure')+'">'+
       (result.roll?'<div class="q-roll-stage"><div class="q-die-wrap"><svg class="q-die q-die-roll" viewBox="0 0 120 120" aria-hidden="true"><path d="M60 5 108 31 108 86 60 114 12 86 12 31 Z" fill="currentColor"/><path d="M60 5 60 114 M12 31 108 86 M108 31 12 86" fill="none" stroke="#ffffff" stroke-opacity=".35"/></svg><strong>'+result.roll.face+'</strong></div><div class="q-roll-math"><small>D20</small><b>'+result.roll.face+' '+(result.roll.modifier>=0?'+':'−')+' '+Math.abs(result.roll.modifier)+' = '+result.roll.total+'</b><small>DC '+result.roll.dc+' · '+result.roll.odds+'% chance</small></div></div>':
       '<div class="q-roll-stage"><div class="q-no-roll">✓</div><b>NO ROLL REQUIRED</b></div>')+
       '<div class="q-outcome-heading">'+(result.success?'✦ SUCCESS':'◇ CONSEQUENCE')+'</div>'+
       '<p>'+esc(result.text||'The situation changes.')+'</p>'+
       '<button class="q-primary" data-q-continue>Continue ›</button></div>';
   }else if(!r){
     right='<div class="q-emptystate"><span>🗂️</span><strong>Choose a story</strong><p>Begin a new thread or reopen an active one.</p></div>';
   }else{
     const menu=r.options.map(o=>{
       const p=o.profile;
       const odds=p?'<span class="q-odds" style="--q-odds:'+p.odds+'%"><b>'+p.odds+'%</b><small>D20</small></span>': '<span class="q-sure">'+(o.safe?'✓':'›')+'</span>';
       const bonus=p?'<span class="q-bonuses">'+p.parts.map(b=>'<span>'+esc(b.label)+' '+(b.value>0?'+':'')+b.value+'</span>').join('')+'</span>':'';
       return '<button class="q-choice" data-q-choice="'+esc(o.id)+'" '+(o.unaffordable?'disabled':'')+'>'+
         '<span class="q-option-main"><b>'+esc(o.label)+'</b><small>'+esc(o.detail||'')+(o.cost?' · −$'+o.cost:'')+'</small>'+bonus+'</span>'+odds+'</button>';
     }).join('');
     const progress={prepare:1,crisis:2,waiting:2,aftermath:3,completed:3}[r.stage]||0;
     right='<div class="q-story">'+
       '<div class="q-art">'+art(r.tag)+'<div class="q-art-title"><span>'+esc(byTag(r.tag))+' '+esc(r.tag)+'</span><h3>'+esc(r.title)+'</h3></div></div>'+
       '<div class="q-progress"><span class="'+(progress>=1?'done':'')+'"></span><span class="'+(progress>=2?'done':'')+'"></span><span class="'+(progress>=3?'done':'')+'"></span><small>'+esc(r.stage==='waiting'?'YEAR '+r.run.readyYear:r.stage.toUpperCase())+'</small></div>'+
       '<div class="q-situation"><p>'+esc(r.prompt)+'</p>'+(r.stage==='waiting'?'<div class="q-wait">⌛ The next chapter unlocks when the year advances.</div>':'')+
       (r.stage==='completed'?'<div class="q-finished">✓ '+esc(r.run.lastText)+'</div>':'')+'</div>'+
       (r.run.roll&&r.stage!=='crisis'?'<div class="q-last-roll">🎲 LAST CHECK · '+r.run.roll.face+' + '+r.run.roll.modifier+' vs '+r.run.roll.dc+' · '+esc(r.run.outcome.toUpperCase())+'</div>':'')+
       '<div class="q-options">'+menu+'</div>'+
       '<div class="q-timeline">'+r.run.history.slice(-3).reverse().map(h=>'<div><i class="q-dot '+esc(h.tone)+'"></i><span>'+esc(h.text)+'</span><small>'+esc(h.year)+'</small></div>').join('')+'</div></div>';
   }
   return '<div class="q-shell"><header class="q-head"><div><small>KARSEN · INTERACTIVE FILES</small><h2>STORY QUESTS <span>⚄</span></h2></div><button class="q-close" data-q-close aria-label="Close quest board">×</button></header>'+
     '<div class="q-metrics"><span>◈ '+summary.active+' / 3 ACTIVE</span><span>✓ '+summary.completed+' RESOLVED</span><span>◇ '+summary.available+' AVAILABLE</span></div>'+
     '<div class="q-layout"><aside class="q-list"><h3>CHAPTERS</h3>'+left+'<div class="q-kit"><b>FIELD KIT</b><div>'+(kit||'<small>Empty · collect supplies during preparation</small>')+'</div></div></aside>'+
     '<main class="q-main">'+right+'</main></div></div>';
 }
 function render(){
   const e=$('questWrap');if(!e)return;e.innerHTML=scene();badge();
 }
 function open(){
   const g=game(),e=$('questWrap');if(!e)return;
   if(g)root.QuestEngine.ensure(g.world);
   flash=null;render();e.hidden=false;e.classList.add('visible');$('questTab').setAttribute('aria-expanded','true');
 }
 function close(){const e=$('questWrap');if(!e)return;e.hidden=true;e.classList.remove('visible');flash=null;$('questTab').setAttribute('aria-expanded','false');}
 function click(e){
   const el=e.target.closest('[data-q-close],[data-q-open],[data-q-start],[data-q-choice],[data-q-continue]');if(!el)return;
   const g=game();if(!g)return;
   if(el.hasAttribute('data-q-close')){close();return;}
   if(el.hasAttribute('data-q-continue')){flash=null;render();return;}
   const start=el.getAttribute('data-q-start');
   if(start){const res=root.QuestEngine.start(g.world,g.subject,start);if(res.applied)selected=res.runId;render();return;}
   const id=el.getAttribute('data-q-open');
   if(id){selected=id;flash=null;render();return;}
   const option=el.getAttribute('data-q-choice');
   if(option){
     const res=root.QuestEngine.choose(g.world,g.subject,selected,option);
     if(res.applied){
       if(res.stage==='waiting'){flash=res;}
       else flash=null;
       try{if(typeof renderStats==='function')renderStats(root.C||{});if(typeof updateBar==='function')updateBar();}catch(_){}
       render();
     }
   }
 }
 function init(){
   const map=$('btn-map'),tabs=map&&map.parentElement;
   if(!tabs||$('questTab'))return;
   const button=document.createElement('button');button.id='questTab';button.className='dtab';
   button.textContent='⚔ QUESTS';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','questWrap');
   map.insertAdjacentElement('afterend',button);
   const wrap=document.createElement('div');wrap.id='questWrap';wrap.className='q-panel';wrap.hidden=true;
   wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-label','Story quest board');
   document.body.appendChild(wrap);
   button.addEventListener('click',open);
   wrap.addEventListener('click',click);
   wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!wrap.hidden){close();e.preventDefault();e.stopImmediatePropagation();}},true);
   badge();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 root.QuestUI={open,close,render,badge};
})(typeof window!=='undefined'?window:globalThis);
