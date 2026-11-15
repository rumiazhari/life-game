'use strict';
/* Exact odds for the existing 3d6 RPG, with live character circumstances.
 * Keeps RPG's grades/perks/backgrounds and uses its existing check semantics.
 * Story items are unique evidence; ordinary lifestyle inventory is not copied. */
(function(root){
 const RPG=root.RPG;if(!RPG)return;
 const original=RPG.resolveCheck;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.round(Number(v)||0)));
 const SKILL={crime:'athletics',hustle:'retail',social:'social',labor:'craft',study:'academics',bureau:'academics'};
 function hasItem(world,subject,id){
  if(!id)return false;
  if(world&&world.storyItems&&world.storyItems[id])return true;
  const inv=subject&&(subject.inventory||subject.items||subject.equipment);
  if(Array.isArray(inv))return inv.some(x=>x===id||(x&&x.id===id));
  if(!inv||typeof inv!=='object')return false;
  return !!inv[id]||(Array.isArray(inv.items)&&inv.items.some(x=>x===id||(x&&x.id===id)));
 }
 function previewCheck(world,options){
  const opts=options||{},domain=RPG.DOMAINS.includes(opts.domain)?opts.domain:'grit';
  const difficulty=RPG.TN[opts.difficulty]?opts.difficulty:'standard';
  const tn=RPG.TN[difficulty],base=RPG.modifierFor(world,opts.actorId,domain);
  const breakdown=[],push=(label,value)=>{if(value)breakdown.push({label,value});};
  push('GRADE',base.grade);push('PERKS / BACKGROUND',base.perks+base.bias);
  let situational=0;
  const s=opts.subject;
  if(s){
   const level=clamp(s.skills&&(s.skills[opts.skill||SKILL[domain]]||0),0,10);
   const skill=level>=7?2:level>=3?1:0;
   situational+=skill;push('SKILL',skill);
   if((domain==='study'||domain==='bureau')&&s.smarts>=75){situational++;push('INTELLECT',1);}
   if(domain==='social'&&s.relations>=70){situational++;push('RELATIONSHIPS',1);}
   if(domain==='labor'&&s.jobTier>=3){situational++;push('PROFESSION',1);}
   if(s.health<35){situational-=2;push('HEALTH',-2);}
   else if(s.health<55){situational--;push('HEALTH',-1);}
   else if(domain==='labor'&&s.health>=80){situational++;push('FITNESS',1);}
   if(s.happiness<20){situational--;push('MORALE',-1);}
   let temperament='';
   try{const d=typeof root.currentDisposition==='function'?root.currentDisposition(s):null;temperament=d&&d.it&&d.it.id||'';}catch(_){}
   if((domain==='social'&&temperament==='saint')||(domain==='hustle'&&temperament==='hustler')||
      (domain==='study'&&temperament==='dreamer')||(domain==='labor'&&temperament==='grind')){
      situational++;push('TEMPERAMENT',1);
   }
  }
  const gear=hasItem(world,s,opts.item);
  if(gear){const b=clamp(opts.itemBonus==null?2:opts.itemBonus,0,4);situational+=b;push('GEAR / EVIDENCE',b);}
  const other=clamp(opts.bonus||0,-4,4);situational+=other;push('CIRCUMSTANCE',other);
  const mod=Math.max(-4,Math.min(4,base.total+situational));
  let wins=0;
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a+b+c+mod>=tn)wins++;
  return {ok:true,domain,difficulty,tn,mod,probability:wins/216,percent:Math.round(wins/216*100),
   successes:wins,outcomes:216,breakdown,hasItem:gear,uncappedModifier:base.total+situational};
 }
 RPG.previewCheck=previewCheck;
 RPG.resolveCheck=function(world,options){
  const opts=options||{};
  if(!opts.subject&&!opts.item&&!opts.skill)return original(world,opts);
  if(!opts.stream||typeof opts.stream.next!=='function')return {ok:false,reason:'no-stream'};
  const p=previewCheck(world,opts),rolls=[];
  for(let i=0;i<3;i++)rolls.push(1+Math.floor(opts.stream.next()*6));
  const nat=rolls.reduce((a,b)=>a+b,0),total=nat+p.mod;
  return {ok:true,domain:p.domain,difficulty:p.difficulty,rolls,nat,mod:p.mod,total,tn:p.tn,
   probability:p.probability,margin:total-p.tn,success:total>=p.tn,critical:nat===18,fumble:nat===3,
   breakdown:p.breakdown};
 };
})(typeof globalThis!=='undefined'?globalThis:this);
