'use strict';
/* NPC-specific trust/rivalry encounters. NpcSystem and RelationshipMemory remain authoritative. */
(function(root){
 const story=root.StorySystem;
 if(!story||!root.NpcSystem||!root.RelationshipMemory)return;
 const original={
  ensure:story.ensure,available:story.availableQuests,start:story.startQuest,
  view:story.currentView,choose:story.choose,file:story.fileAway
 };
 const pick=o=>o&&o.subject||(typeof S!=='undefined'?S:null);
 const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 const safeYear=n=>clamp(Math.round(Number(n)||0),-5000,5000);
 const year=w=>safeYear(w.year);
 const personKey=s=>String(s&&s.npcId||'subject');
 story.ensure=function(w){
  original.ensure(w);
  w.storySocialYear=Number.isFinite(w.storySocialYear)?safeYear(w.storySocialYear):null;
  return w;
 };
 const validNpc=(w,s,id)=>{
  const n=w.npcs&&w.npcs[id];
  if(!n||n.alive===false||id===personKey(s))return null;
  const rel=n.relationships&&n.relationships[personKey(s)];
  return rel&&typeof rel==='object'?n:null;
 };
 function candidates(w,s){
  story.ensure(w);
  if(!s||s.alive===false||s.age<18||(w.storySocialYear!==null&&w.storySocialYear>=year(w)))return [];
  const person=personKey(s);
  const list=Object.values(w.npcs||{}).filter(n=>n&&validNpc(w,s,n.id)).map(n=>{
   const rel=n.relationships[person],echo=root.RelationshipMemory.modifier(w,person,n.id,year(w));
   const trust=clamp((Number(rel.trust)||0)+echo.trust,0,100);
   const conflict=clamp((Number(rel.conflict)||0)+echo.conflict,0,100);
   const stance=trust<40||conflict>52?'rival':trust>=65&&conflict<35?'ally':'uncertain';
   const prior=Object.values(w.storyArchive||{}).filter(a=>a&&a.social&&
    a.social.npcId===n.id&&!a.social.followup&&!a.callbackFiled&&a.resolvedYear<year(w))
    .sort((a,b)=>b.resolvedYear-a.resolvedYear||String(a.id).localeCompare(String(b.id)))[0];
   return {
    id:'social_'+year(w)+'_'+String(n.id).replace(/[^A-Za-z0-9]/g,'_'),
    npcId:n.id,year:year(w),stance,trust,conflict,score:stance==='rival'?3:stance==='ally'?2:1,
    followup:!!prior,priorId:prior&&prior.id||null,
    priorEnding:prior&&prior.endingId||null,
    settlementId:n.settlementId||n.locationId||w.activeSettlementId
   };
  });
  list.sort((a,b)=>b.score-a.score||a.trust-b.trust||a.npcId.localeCompare(b.npcId));
  return list.slice(0,1);
 }
 const memory=(id,npcId,valence)=>({kind:'memory',type:'social_'+id,
  summary:'A personal '+id.replace(/_/g,' ')+' shaped a relationship.',
  participants:[npcId],valence,intensity:.8});
 function definition(w,s,c){
  const npc=w.npcs[c.npcId];
  const name=String(npc.name||npc.fullName||'A familiar person').slice(0,70);
  const intro=c.followup?
   'Your earlier '+String(c.priorEnding||'decision').replace(/_/g,' ')+' is still remembered.':
   c.stance==='rival'?'A disagreement has pushed this relationship close to breaking.':
   c.stance==='ally'?'A trusted ally asks whether that trust will be returned.':
   'A familiar person wants to know where your loyalty stands.';
  const safe=(id,title,copy,effects)=>({
   lines:[{sp:'narrator',t:copy}],
   ending:{id,title,epilogue:[copy],tone:id==='social_betrayed'?'grey':'prudent',effects}
  });
  return {
   id:c.id,quest:true,energyCost:1,questTitle:c.followup?'Return: A Personal Reckoning':
    c.stance==='rival'?'A Rival’s Reckoning':c.stance==='ally'?'A Trusted Favor':'A Question of Trust',
   questHint:name+' · '+(c.followup?'An earlier choice is remembered.':
    'Trust '+Math.round(c.trust)+' / conflict '+Math.round(c.conflict)),
   questIcon:'🤝',questArc:'FAMILY',domain:'social',followup:c.followup,
   cast:()=>[],eligible:()=>true,
   build(){return {title:'A QUESTION OF TRUST',bg:'night_flat',scenes:{
    open:{lines:[{sp:'narrator',t:name+'. '+intro}],
     choice:{prompt:'How will you respond?',options:[
      {t:c.stance==='rival'?'Offer a genuine reconciliation':'Return the trust',tone:'kind',
       goto:'reconciled',check:{domain:'social',difficulty:c.stance==='rival'?'hard':c.stance==='ally'?'easy':'standard',
        failGoto:'rebuffed'}},
      {t:c.stance==='ally'?'Exploit their trust':'Challenge their account',tone:'grey',
       goto:'betrayed',check:{domain:'hustle',difficulty:'hard',failGoto:'rebuffed'}},
      {t:'Leave without escalating',note:'Guaranteed · no roll',tone:'prudent',goto:'withdrawn'}
     ]}},
    reconciled:safe('social_reconciled','TRUST REBUILT',
     name+' accepts your attempt to repair the relationship.',
     [{kind:'npcBond',npcId:c.npcId,delta:10},memory('reconciled',c.npcId,.8),
      {kind:'stat',stat:'relations',delta:2}]),
    betrayed:safe('social_betrayed','TRUST BROKEN',
     'Your confrontation changes how '+name+' sees you.',
     [{kind:'npcBond',npcId:c.npcId,delta:-12},memory('betrayed',c.npcId,-.85),
      {kind:'scrutiny',delta:2}]),
    rebuffed:safe('social_rebuffed','A HARDER DIVIDE',
     name+' rejects the appeal; the disagreement is not forgotten.',
     [{kind:'npcBond',npcId:c.npcId,delta:-5},memory('rebuffed',c.npcId,-.65),
      {kind:'stat',stat:'happiness',delta:-2}]),
    withdrawn:safe('social_withdrawn','TIME TO THINK',
     'You give the relationship room rather than forcing a confrontation.',
     [{kind:'stat',stat:'health',delta:1}])
   }};}
  };
 }
 function withDef(def,fn){root.StoryEpisodes.push(def);
  try{return fn();}finally{const i=root.StoryEpisodes.indexOf(def);if(i>=0)root.StoryEpisodes.splice(i,1);}
 }
 story.availableQuests=function(w,o){
  const base=original.available(w,o),s=pick(o);
  return base.concat(candidates(w,s).map(c=>{
   const d=definition(w,s,c);return {
    id:c.id,title:d.questTitle,hint:d.questHint,icon:d.questIcon,arc:d.questArc,
    domain:'social',energyCost:1,social:true,followup:!!c.followup,personId:c.npcId
   };
  }));
 };
 story.startQuest=function(w,id,o){
  if(!String(id).startsWith('social_'))return original.start(w,id,o);
  const s=pick(o),c=candidates(w,s).find(x=>x.id===id);
  if(!c)return {ok:false,reason:'not_available'};
  const result=withDef(definition(w,s,c),()=>original.start(w,id,o));
  if(result&&result.ok){
   w.storyRuns[result.runId].social=Object.assign({},c);
   w.storySocialYear=c.year;
  }
  return result;
 };
 function invalid(w,c,s){
  if(!c||!s)return 'Actor unavailable';
  const n=validNpc(w,s,c.npcId);
  if(!n)return 'Person or relationship unavailable';
  if(c.settlementId&&(n.settlementId||n.locationId)&&
     (n.settlementId||n.locationId)!==c.settlementId)return 'Person moved away';
  return '';
 }
 story.currentView=function(w,o){
  const view=original.view(w,o),r=story.liveRun(w);
  if(view&&view.type==='choice'&&r&&r.social){
   const reason=invalid(w,r.social,pick(o));
   if(reason)view.options=view.options.map((v,i)=>i===2?v:
    Object.assign({},v,{available:false,unavailableReason:reason}));
  }
  return view;
 };
 story.choose=function(w,i,o){
  const r=story.liveRun(w);
  if(r&&r.social){
   if(year(w)<r.startedYear||o&&Number.isFinite(o.year)&&o.year<r.startedYear)
    return {applied:false,reason:'stale_year'};
   if(i!==2&&invalid(w,r.social,pick(o)))
    return {applied:false,reason:'person_unavailable'};
  }
  return original.choose(w,i,o);
 };
 story.fileAway=function(w,id,o){
  const r=w.storyRuns&&w.storyRuns[id],c=r&&r.social;
  if(c&&(year(w)<r.startedYear||o&&Number.isFinite(o.year)&&o.year<r.startedYear))
   return {applied:false,reason:'stale_year'};
  const out=original.file(w,id,o);
  if(out&&out.applied&&c){
   const a=Object.values(w.storyArchive||{}).find(a=>a.episodeId===r.episodeId&&a.startedYear===r.startedYear);
   if(a)a.social=Object.assign({},c);
   if(c.priorId&&w.storyArchive[c.priorId])w.storyArchive[c.priorId].callbackFiled=true;
  }
  return out;
 };
 root.StorySocial={candidates};
})(globalThis);
