'use strict';
/* Two interlocking cross-domain story chains; StorySystem owns runs/choices/archive. */
(function(root){
 const story=root.StorySystem;
 if(!story||!root.RelationshipMemory||!root.NpcSystem)return;
 const native={ensure:story.ensure,available:story.availableQuests,start:story.startQuest,
  view:story.currentView,choose:story.choose,file:story.fileAway};
 const pick=o=>o&&o.subject||(typeof S!=='undefined'?S:null);
 const year=w=>Math.max(-5000,Math.min(5000,Math.round(Number(w.year)||0)));
 const safeStage=v=>Number.isInteger(v)?Math.max(0,Math.min(2,v)):0;
 story.ensure=function(w){
  native.ensure(w);
  const prev=w.storyThreadStages&&typeof w.storyThreadStages==='object'&&!Array.isArray(w.storyThreadStages)?
   w.storyThreadStages:{};
  w.storyThreadStages={work:safeStage(prev.work),household:safeStage(prev.household)};
  return w;
 };
 const archive=(w,filter)=>Object.values(w.storyArchive||{}).filter(a=>a&&filter(a))
  .sort((a,b)=>Number(b.resolvedYear)-Number(a.resolvedYear)||String(a.id).localeCompare(String(b.id)))[0]||null;
 function subjectId(s){return String(s&&s.npcId||'subject');}
 function actualPerson(w,s,id){
  const n=w.npcs&&w.npcs[id];
  return n&&n.alive!==false&&id!==subjectId(s)&&n.relationships&&n.relationships[subjectId(s)]?n:null;
 }
 function candidates(w,s){
  story.ensure(w);
  if(!s||s.alive===false||s.age<18)return [];
  const out=[];
  const company=w.storyThreadStages.work;
  if(company===0){
   const employer=archive(w,a=>a.context&&a.context.family==='employer'&&
    a.resolvedYear<year(w)&&a.context.businessId&&w.businesses&&w.businesses[a.context.businessId]);
   const civic=archive(w,a=>(a.context&&a.context.family==='civic'||a.episodeId==='quest_ward_petition')&&
    a.resolvedYear<year(w));
   if(employer&&civic)out.push({id:'thread_work_'+year(w),family:'work',stage:0,year:year(w),
    businessId:employer.context.businessId,employerEnding:employer.endingId,civicEnding:civic.endingId});
  }else if(company===1){
   const prior=archive(w,a=>a.thread&&a.thread.family==='work'&&a.thread.stage===0&&
    a.resolvedYear<year(w));
   if(prior)out.push({id:'thread_work_echo_'+year(w),family:'work',stage:1,year:year(w),
    businessId:prior.thread.businessId,priorId:prior.id,priorEnding:prior.endingId});
  }
  const family=w.storyThreadStages.household;
  if(family===0){
   const social=archive(w,a=>a.social&&a.social.npcId&&a.resolvedYear<year(w)&&
    actualPerson(w,s,a.social.npcId));
   const market=archive(w,a=>(a.episodeId==='quest_night_market'||a.episodeId==='quest_grey_manifest')&&
    a.resolvedYear<year(w));
   if(social&&market)out.push({id:'thread_household_'+year(w),family:'household',stage:0,year:year(w),
    npcId:social.social.npcId,priorSocial:social.endingId,priorMarket:market.endingId,
    settlementId:(w.npcs[social.social.npcId].settlementId||w.npcs[social.social.npcId].locationId||w.activeSettlementId)});
  }else if(family===1){
   const prior=archive(w,a=>a.thread&&a.thread.family==='household'&&a.thread.stage===0&&
    a.resolvedYear<year(w));
   if(prior&&actualPerson(w,s,prior.thread.npcId))
    out.push({id:'thread_household_echo_'+year(w),family:'household',stage:1,year:year(w),
     npcId:prior.thread.npcId,settlementId:prior.thread.settlementId,
     priorId:prior.id,priorEnding:prior.endingId});
  }
  return out;
 }
 const s=(stat,delta)=>({kind:'stat',stat,delta});
 const scr=delta=>({kind:'scrutiny',delta});
 const bond=(id,delta)=>({kind:'npcBond',npcId:id,delta});
 const mem=(id,npcId,valence)=>({kind:'memory',type:'thread_'+id,participants:[npcId],
  summary:'A shared household choice changed a relationship.',valence,intensity:.7});
 const end=(id,title,copy,effects,tone='prudent')=>({lines:[{sp:'narrator',t:copy}],
  ending:{id,title,epilogue:[copy],tone,effects}});
 function definition(w,c){
  const business=w.businesses&&w.businesses[c.businessId];
  const npc=w.npcs&&w.npcs[c.npcId];
  const label=c.family==='work'?
   (business&&business.name||'The former workshop'):
   (npc&&npc.name||'The relative');
  const content=c.stage===1?
   'The earlier '+String(c.priorEnding||'decision').replace(/_/g,' ')+' has returned.':
   c.family==='work'?
    'An employer '+String(c.employerEnding).replace(/_/g,' ')+
     ' and a civic '+String(c.civicEnding).replace(/_/g,' ')+' now intersect.':
    'A family '+String(c.priorSocial).replace(/_/g,' ')+
     ' meets the night-market '+String(c.priorMarket).replace(/_/g,' ')+'.';
  const work=c.family==='work';
  const evidence={kind:'storyItem',id:'thread_public_record',label:'Public hearing record',icon:'📜'};
  const workFirst={
   open:{lines:[{sp:'narrator',t:label+'. '+content}],
    choice:{prompt:'Who should see the old account?',options:[
     {t:'Submit documents to the Ward',tone:'kind',goto:'public',
      check:{domain:'bureau',difficulty:c.employerEnding==='context_setback'?'hard':'standard',failGoto:'rebuffed'}},
     {t:'Ask for workplace mediation',tone:'prudent',goto:'mediated',
      check:{domain:'labor',difficulty:'hard',failGoto:'rebuffed'}},
     {t:'Protect the private file',note:'Guaranteed · no roll',tone:'grey',goto:'quiet'}
    ]}},
   public:end('thread_work_public','THE PUBLIC RECORD','An official receives the old work account.',
    [evidence,s('relations',4),scr(-3)],'kind'),
   mediated:end('thread_work_mediated','A PRACTICAL AGREEMENT','The concern stays between the worker and the office.',
    [s('relations',3),{kind:'skill',skill:'craft',delta:1}]),
   rebuffed:end('thread_work_rebuffed','THE OFFICE REFUSES','An older complaint has not disappeared.',
    [scr(4),s('happiness',-2)],'grey'),
   quiet:end('thread_work_quiet','THE ACCOUNT RESTS','You refuse to reopen the dispute.',
    [s('health',2)])
  };
  const workEcho={
   open:{lines:[{sp:'narrator',t:label+'. '+content}],
    choice:{prompt:'How will you handle the council reply?',options:[
     {t:'Show the public hearing record',tone:'kind',goto:'public',
      check:{domain:'bureau',difficulty:'standard',item:'thread_public_record',itemBonus:2,failGoto:'rebuffed'}},
     {t:'Teach coworkers what happened',tone:'prudent',goto:'mediated',
      check:{domain:'labor',difficulty:'standard',failGoto:'rebuffed'}},
     {t:'Leave the council to its files',note:'Guaranteed · no roll',goto:'quiet'}
    ]}},
   public:end('thread_work_echo_public','A WIDER HEARING','The old report helps the office hear another claim.',
    [scr(-5),{kind:'skill',skill:'academics',delta:1},s('relations',3)],'kind'),
   mediated:end('thread_work_echo_mentor','A LESSON RECORDED','Other workers learn how to document their conditions.',
    [{kind:'skill',skill:'craft',delta:2},s('relations',3)]),
   rebuffed:end('thread_work_echo_rebuffed','THE COUNCIL ADJOURNS','The hearing closes without a decision.',
    [scr(3),s('happiness',-1)],'grey'),
   quiet:end('thread_work_echo_quiet','THE COUNCIL MOVES ON','You set the account aside.',
    [s('health',2)])
  };
  const houseFirst={
   open:{lines:[{sp:'narrator',t:label+'. '+content}],
    choice:{prompt:'The missing shipment has reached the household. What now?',options:[
     {t:'Tell the relative the truth',tone:'kind',goto:'honest',
      check:{domain:'social',difficulty:c.priorSocial==='social_betrayed'?'hard':'standard',failGoto:'rebuffed'}},
     {t:'Hide the ledger from the household',tone:'grey',goto:'hidden',
      check:{domain:'hustle',difficulty:'hard',failGoto:'rebuffed'}},
     {t:'Step away from the dispute',note:'Guaranteed · no roll',goto:'quiet'}
    ]}},
   honest:end('thread_household_honest','TRUTH AT HOME','You put the story on the family table.',
    [bond(c.npcId,9),mem('honest',c.npcId,.8),s('relations',2)],'kind'),
   hidden:end('thread_household_hidden','THE ACCOUNT IS HIDDEN','The record is hidden; the relationship suffers.',
    [bond(c.npcId,-8),mem('hidden',c.npcId,-.8),scr(5)],'grey'),
   rebuffed:end('thread_household_rebuffed','A DIVIDED HOUSEHOLD','The family does not accept the account.',
    [bond(c.npcId,-5),mem('rebuffed',c.npcId,-.55),s('happiness',-2)],'grey'),
   quiet:end('thread_household_quiet','A PRIVATE PAUSE','You leave the difficult conversation for another year.',
    [s('health',1)])
  };
  const houseEcho={
   open:{lines:[{sp:'narrator',t:label+'. '+content}],
    choice:{prompt:'A year later, what can repair this trust?',options:[
     {t:'Rebuild the household account',tone:'kind',goto:'honest',
      check:{domain:'social',difficulty:c.priorEnding==='thread_household_hidden'?'hard':'standard',failGoto:'rebuffed'}},
     {t:'Keep the dangerous details private',tone:'grey',goto:'hidden',
      check:{domain:'hustle',difficulty:'hard',failGoto:'rebuffed'}},
     {t:'End the conversation peacefully',note:'Guaranteed · no roll',goto:'quiet'}
    ]}},
   honest:end('thread_household_echo_reconciled','A NAME RESTORED','The family has a clearer understanding.',
    [bond(c.npcId,8),mem('echo_reconciled',c.npcId,.7),s('relations',4)],'kind'),
   hidden:end('thread_household_echo_hidden','THE SHADOW REMAINS','The secret is kept, at a cost.',
    [bond(c.npcId,-6),mem('echo_hidden',c.npcId,-.65),scr(3)],'grey'),
   rebuffed:end('thread_household_echo_rebuffed','A SECOND REJECTION','The conversation remains unfinished.',
    [bond(c.npcId,-4),mem('echo_rebuffed',c.npcId,-.45),s('happiness',-2)],'grey'),
   quiet:end('thread_household_echo_quiet','A QUIET ENDING','The household moves on.',
    [s('health',2)])
  };
  return {
   id:c.id,quest:true,energyCost:1,followup:c.stage===1,
   questTitle:work?(c.stage===0?'The Public Record':'Return: The Council Reply'):
    (c.stage===0?'The Debt at Home':'Return: Family Testimony'),
   questHint:label+' · '+(c.stage===1?'Previous outcome remembered':content),
   questIcon:work?'🗂️':'🕯️',questArc:work?'BUREAU':'FAMILY',domain:work?'bureau':'social',
   cast:()=>[],eligible:()=>true,
   build(){return {title:work?'THE PUBLIC RECORD':'THE FAMILY ACCOUNT',
    bg:work?'office':'night_flat',
    scenes:work?(c.stage===0?workFirst:workEcho):(c.stage===0?houseFirst:houseEcho)};}
  };
 }
 function withDef(def,fn){
  root.StoryEpisodes.push(def);
  try{return fn();}finally{const i=root.StoryEpisodes.indexOf(def);if(i>=0)root.StoryEpisodes.splice(i,1);}
 }
 story.availableQuests=function(w,o){
  const base=native.available(w,o),s=pick(o);
  return base.concat(candidates(w,s).map(c=>{
   const def=definition(w,c);
   return {id:c.id,title:def.questTitle,hint:def.questHint,icon:def.questIcon,
    arc:def.questArc,domain:def.domain,energyCost:1,thread:true,
    family:c.family,followup:c.stage===1};
  }));
 };
 story.startQuest=function(w,id,o){
  if(!String(id).startsWith('thread_'))return native.start(w,id,o);
  const s=pick(o),c=candidates(w,s).find(x=>x.id===id);
  if(!c)return {ok:false,reason:'not_available'};
  const out=withDef(definition(w,c),()=>native.start(w,id,o));
  if(out.ok){
   w.storyRuns[out.runId].thread=Object.assign({},c);
   w.storyThreadStages[c.family]=c.stage+1;
  }
  return out;
 };
 function unavailable(w,c,s){
  if(c.family!=='household')return '';
  const npc=actualPerson(w,s,c.npcId);
  if(!npc)return 'Relative is no longer available';
  if(c.settlementId&&(npc.settlementId||npc.locationId)&&
    (npc.settlementId||npc.locationId)!==c.settlementId)return 'Household moved';
  return '';
 }
 story.currentView=function(w,o){
  const v=native.view(w,o),r=story.liveRun(w);
  if(v&&v.type==='choice'&&r&&r.thread){
   const reason=unavailable(w,r.thread,pick(o));
   if(reason)v.options=v.options.map((x,i)=>i===2?x:Object.assign({},x,{
    available:false,unavailableReason:reason}));
  }
  return v;
 };
 story.choose=function(w,i,o){
  const r=story.liveRun(w);
  if(r&&r.thread){
   if(year(w)<r.startedYear||o&&Number.isFinite(o.year)&&o.year<r.startedYear)
    return {applied:false,reason:'stale_year'};
   if(i!==2&&unavailable(w,r.thread,pick(o)))
    return {applied:false,reason:'relative_unavailable'};
  }
  return native.choose(w,i,o);
 };
 story.fileAway=function(w,id,o){
  const r=w.storyRuns&&w.storyRuns[id],c=r&&r.thread;
  if(c&&(year(w)<r.startedYear||o&&Number.isFinite(o.year)&&o.year<r.startedYear))
   return {applied:false,reason:'stale_year'};
  const out=native.file(w,id,o);
  if(out&&out.applied&&c){
   const a=Object.values(w.storyArchive||{}).find(a=>a.episodeId===r.episodeId&&a.startedYear===r.startedYear);
   if(a)a.thread=Object.assign({},c);
   if(c.priorId&&w.storyArchive[c.priorId])w.storyArchive[c.priorId].callbackFiled=true;
  }
  return out;
 };
 root.StoryThreads={candidates};
})(globalThis);
