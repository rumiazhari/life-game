'use strict';
/* Generated definitions are transient. StorySystem owns all persistent runs/outcomes. */
(function(root){
 const story=root.StorySystem;if(!story)return;
 const families=['employer','household','civic'];
 const native={ensure:story.ensure,available:story.availableQuests,start:story.startQuest,
  file:story.fileAway,view:story.currentView,choose:story.choose};
 const subject=o=>o&&o.subject||(typeof S!=='undefined'?S:null);
 const year=w=>Math.max(-5000,Math.min(5000,Math.round(Number(w.year)||0)));
 story.ensure=function(w){native.ensure(w);
  const old=w.storyContextYears||{},next={};
  for(const f of families)if(Number.isFinite(old[f]))next[f]=Math.max(-5000,Math.min(5000,Math.round(old[f])));
  w.storyContextYears=next;return w;
 };
 const alive=(w,id)=>w.npcs&&w.npcs[id]&&w.npcs[id].alive!==false;
 function candidates(w,s){
  story.ensure(w);if(!s||s.alive===false||s.age<18)return [];
  const settlement=w.settlements&&w.settlements[w.activeSettlementId];if(!settlement)return [];
  const contract=root.EmploymentSystem.activeForPerson(w,'subject')[0];
  const household=root.HouseholdSystem.findByMember(w,s.npcId||'subject');
  const member=household&&(household.memberIds||[]).filter(id=>id!==(s.npcId||'subject')&&alive(w,id)).sort()[0];
  const bases=[{family:'civic',settlementId:settlement.id||w.activeSettlementId}];
  if(contract&&w.businesses[contract.businessId]&&w.businesses[contract.businessId].status!=='closed')bases.push({family:'employer',businessId:contract.businessId,contractId:contract.id,settlementId:contract.settlementId||w.businesses[contract.businessId].settlementId});
  if(member)bases.push({family:'household',householdId:household.id,npcId:member,settlementId:household.settlementId});
  return bases.filter(b=>w.settlements[b.settlementId]&&!(w.storyContextYears[b.family]>=year(w))).map(b=>{
   const previous=Object.values(w.storyArchive).filter(a=>a&&a.context&&a.context.family===b.family&&!a.context.followup&&a.resolvedYear<year(w)&&!a.callbackFiled)
    .sort((a,b)=>b.resolvedYear-a.resolvedYear||String(a.id).localeCompare(String(b.id)))[0];
   if(previous){b.followup=true;b.priorId=previous.id;b.priorEnding=previous.endingId;}
   b.year=year(w);b.id='context_'+b.family+'_'+b.year;return b;
  });
 }
 const title={employer:'The Shift Review',household:'The Shared Burden',civic:'The Local Hearing'};
 function definition(w,s,c){
  const domain={employer:'labor',household:'social',civic:'bureau'}[c.family];
  const label=c.businessId?w.businesses[c.businessId].name:c.npcId?w.npcs[c.npcId].name:w.settlements[c.settlementId].name;
  const rng=root.WorldSimulation.streamFor(w,c.year,c.family,'context-template');
  const detail=['A practical concern needs an answer.','A familiar problem has returned.'][rng.next()<.5?0:1];
  const difficult=Number(s.scrutiny)>40?'hard':'standard';
  const memory=(kind,valence)=>c.npcId?[{kind:'memory',type:'context_'+kind,summary:title[c.family]+': '+kind,participants:[c.npcId],valence}]:[];
  const end=(id,t,effects)=>({lines:[{sp:'narrator',t}],ending:{id,title:t,tone:'prudent',epilogue:[t],effects}});
  return {id:c.id,quest:true,energyCost:1,domain,questTitle:(c.followup?'Return: ':'')+title[c.family],
   questHint:String(label||c.settlementId)+' · '+(c.followup?'Your earlier '+c.priorEnding.replace('context_','').replace(/_/g,' ')+' is remembered.':detail),
   questIcon:{employer:'⚒',household:'⌂',civic:'⚖'}[c.family],questArc:{employer:'CAREER',household:'FAMILY',civic:'BUREAU'}[c.family],
   followup:!!c.followup,eligible:()=>true,cast:()=>[],build(){return {title:(c.followup?'RETURN: ':'')+title[c.family].toUpperCase(),bg:c.family==='employer'?'factory_floor':c.family==='household'?'night_flat':'office',scenes:{
    open:{lines:[{sp:'narrator',t:String(label||c.settlementId)+'. '+(c.followup?'Last time: '+c.priorEnding.replace(/_/g,' ')+'. ':detail)}],choice:{prompt:'How will you respond?',options:[
     {t:c.family==='employer'?'Demonstrate a better method':c.family==='household'?'Offer practical support':'Present the evidence',goto:'help',check:{domain,difficulty:difficult,failGoto:'setback'}},
     {t:c.family==='employer'?'Negotiate the workload':c.family==='household'?'Discuss sharing the burden':'Request a public discussion',goto:'discuss',check:{domain:'social',difficulty:'hard',failGoto:'setback'}},
     {t:'Decline and protect your time',note:'Guaranteed · no roll',goto:'rest'}]}},
    help:end('context_help','A practical improvement',[{kind:'skill',skill:c.family==='employer'?'craft':c.family==='household'?'social':'academics',delta:1},...memory('help',.6)]),
    discuss:end('context_discuss','An agreement to continue',[{kind:'stat',stat:'relations',delta:2},...memory('discuss',.4)]),
    setback:end('context_setback','The request stalls; you can move on',[{kind:'stat',stat:'happiness',delta:-1},...memory('setback',-.2)]),
    rest:end('context_decline','Time protected',[])
   }};}};
 }
 function withDef(def,fn){root.StoryEpisodes.push(def);try{return fn();}finally{root.StoryEpisodes.splice(root.StoryEpisodes.indexOf(def),1);}}
 story.availableQuests=function(w,o){const s=subject(o),base=native.available(w,o);return base.concat(candidates(w,s).map(c=>{const d=definition(w,s,c);return {id:c.id,title:d.questTitle,hint:d.questHint,icon:d.questIcon,arc:d.questArc,domain:d.domain,energyCost:1,followup:!!c.followup,contextual:true,family:c.family};}));};
 story.startQuest=function(w,id,o){
  if(!String(id).startsWith('context_'))return native.start(w,id,o);
  const s=subject(o),c=candidates(w,s).find(c=>c.id===id);if(!c)return {ok:false,reason:'not_available'};
  const out=withDef(definition(w,s,c),()=>native.start(w,id,o));
  if(out.ok){w.storyRuns[out.runId].context=c;w.storyContextYears[c.family]=c.year;}
  return out;
 };
 function unavailable(w,c){
  if(c.npcId&&!alive(w,c.npcId))return 'Person is no longer available';
  if(c.householdId&&(!w.households[c.householdId]||!w.households[c.householdId].memberIds.includes(c.npcId)))return 'Household changed';
  if(c.contractId){const a=root.EmploymentSystem.activeForPerson(w,'subject')[0];if(!a||a.id!==c.contractId)return 'Employment changed';}
  return '';
 }
 story.currentView=function(w,o){const v=native.view(w,o),r=story.liveRun(w);if(v&&v.type==='choice'&&r.context){const reason=unavailable(w,r.context);if(reason)v.options=v.options.map((x,i)=>i<2?Object.assign({},x,{available:false,unavailableReason:reason}):x);}return v;};
 story.choose=function(w,i,o){const r=story.liveRun(w);if(r&&r.context&&i<2&&unavailable(w,r.context))return {applied:false,reason:'context_changed'};return native.choose(w,i,o);};
 story.fileAway=function(w,id,o){const r=w.storyRuns&&w.storyRuns[id],c=r&&r.context;const out=native.file(w,id,o);if(out.applied&&c){const a=Object.values(w.storyArchive).find(a=>a.episodeId===r.episodeId&&a.startedYear===r.startedYear);if(a)a.context=Object.assign({},c);if(c.priorId&&w.storyArchive[c.priorId])w.storyArchive[c.priorId].callbackFiled=true;}return out;};
 root.StoryContext={candidates};
})(globalThis);
