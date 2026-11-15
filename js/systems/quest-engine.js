'use strict';
/* QuestEngine: player-selected multi-year threads. World owns quest state; S owns player stats.
 * Distinct from StorySystem's one-at-a-time cinematic episodes. No map mutations. */
(function(root){
 const VERSION=1,MAX_ACTIVE=3,MAX_HISTORY=16,MAX_KIT=12,MAX_ITEM=4,MAX_RUNS=48;
 const STAGES=['prepare','crisis','waiting','aftermath','completed','closed'];
 const bounded=(v,lo,hi,f=lo)=>{const n=Number(v);return Number.isFinite(n)?Math.max(lo,Math.min(hi,Math.round(n))):f;};
 const defs=()=>Array.isArray(root.QuestArcs)?root.QuestArcs:[];
 const byId=id=>defs().find(d=>d.id===id)||null;
 function repair(world){
   if(!world||typeof world!=='object')return null;
   if(!world.storyQuest||typeof world.storyQuest!=='object'||Array.isArray(world.storyQuest))world.storyQuest={};
   const q=world.storyQuest;
   if(!q.runs||typeof q.runs!=='object'||Array.isArray(q.runs))q.runs={};
   if(!q.kit||typeof q.kit!=='object'||Array.isArray(q.kit))q.kit={};
   q.counter=bounded(q.counter,0,99999999,0);
   q.lastTickYear=q.lastTickYear==null?null:bounded(q.lastTickYear,-5000,5000,null);
   q.schemaVersion=VERSION;
   return q;
 }
 const validId=x=>/^quest:[0-9]{5,}$/.test(String(x||''));
 const allKit=['documents','medical_kit','witness_letter','ration_vouchers','trade_permit','family_diary'];
 function migrate(world){
   const q=repair(world);if(!q)return null;
   const src=q.runs,ids=Object.keys(src).sort();
   let highest=q.counter;
   ids.forEach(k=>{const v=src[k];[k,v&&v.id].forEach(id=>{if(validId(id))highest=Math.max(highest,bounded(Number(id.split(':')[1]),0,99999999));});});
   const clean={},claimed=new Set();
   ids.forEach(k=>{
     const raw=src[k]&&typeof src[k]==='object'&&!Array.isArray(src[k])?src[k]:{};
     let id=validId(raw.id)&&!claimed.has(raw.id)?raw.id:validId(k)&&!claimed.has(k)?k:null;
     if(!id)id='quest:'+String(++highest).padStart(5,'0');
     claimed.add(id);
     const stage=STAGES.includes(raw.stage)?raw.stage:'closed';
     clean[id]={
       id,definitionId:String(raw.definitionId||'unknown').slice(0,64),
       startedYear:bounded(raw.startedYear,-5000,5000,0),
       updatedYear:bounded(raw.updatedYear,-5000,5000,0),
       readyYear:raw.readyYear==null?null:bounded(raw.readyYear,-5000,5000),
       stage,preparation:String(raw.preparation||'').slice(0,48),
       outcome:String(raw.outcome||'').slice(0,16),lastText:String(raw.lastText||'').slice(0,280),
       choiceId:String(raw.choiceId||'').slice(0,48),
       roll:raw.roll&&typeof raw.roll==='object'?{
         face:bounded(raw.roll.face,1,20),modifier:bounded(raw.roll.modifier,-4,8,0),
         total:bounded(raw.roll.total,-4,28,0),dc:bounded(raw.roll.dc,5,24,12),
         odds:bounded(raw.roll.odds,0,100,50)}:null,
       history:(Array.isArray(raw.history)?raw.history:[]).slice(-MAX_HISTORY).map(h=>({
         year:bounded(h&&h.year,-5000,5000,0),
         text:String(h&&h.text||'').slice(0,180),
         tone:['good','bad','neutral'].includes(h&&h.tone)?h.tone:'neutral'
       }))
     };
   });
   q.runs=clean;q.counter=Math.max(q.counter,highest);
   const kit={};let total=0;
   allKit.forEach(id=>{const n=bounded(q.kit[id],0,MAX_ITEM,0);if(n&&total<MAX_KIT){kit[id]=Math.min(n,MAX_KIT-total);total+=kit[id];}});
   q.kit=kit;
   return q;
 }
 function ensure(world){const q=repair(world);if(q&&!q.__normalized){migrate(world);q.__normalized=true;}return q;}
 function active(world){const q=ensure(world);return q?Object.values(q.runs).filter(r=>!['completed','closed'].includes(r.stage)):[];}
 function allowed(def,S,world){
   if(!def||!S||S.alive===false)return false;
   if(bounded(S.age,0,150,0)<16)return false;
   if(def.gate==='worker'){
     const job=root.EmploymentSystem&&root.EmploymentSystem.activeForPerson?root.EmploymentSystem.activeForPerson(world,'subject')[0]:null;
     return !!job||bounded(S.jobTier,0,5,0)>0;
   }
   if(def.gate==='family')return !!(S.married||S.contacts&&S.contacts.length||S.age>=18);
   return true;
 }
 function catalog(world,S){
   const q=ensure(world);if(!q)return[];
   return defs().map(d=>{
     const run=Object.values(q.runs).find(r=>r.definitionId===d.id)||null;
     return {id:d.id,title:d.title,icon:d.icon,tag:d.tag,hook:d.hook,
       stage:run?run.stage:'available',runId:run&&run.id,
       canStart:!run&&active(world).length<MAX_ACTIVE&&allowed(d,S,world)};
   });
 }
 function log(run,year,text,tone){
   run.history.push({year:bounded(year,-5000,5000,0),text:String(text||'').slice(0,180),tone:tone||'neutral'});
   if(run.history.length>MAX_HISTORY)run.history=run.history.slice(-MAX_HISTORY);
 }
 function start(world,S,definitionId){
   const q=ensure(world),def=byId(definitionId);
   if(!q||!def||!allowed(def,S,world))return {applied:false,reason:'unavailable'};
   if(Object.values(q.runs).some(r=>r.definitionId===def.id))return {applied:false,reason:'already_started'};
   if(active(world).length>=MAX_ACTIVE)return {applied:false,reason:'active_limit'};
   const year=bounded(world.year,-5000,5000,0);
   const id='quest:'+String(++q.counter).padStart(5,'0');
   const run={id,definitionId:def.id,startedYear:year,updatedYear:year,readyYear:null,
    stage:'prepare',preparation:'',outcome:'',lastText:def.hook,choiceId:'',roll:null,history:[]};
   log(run,year,def.hook,'neutral');q.runs[id]=run;
   return {applied:true,runId:id};
 }
 function get(world,id){const q=ensure(world);return q&&q.runs[id]||null;}
 function kitCount(world,id){return bounded(ensure(world).kit[id],0,MAX_ITEM,0);}
 function addKit(world,id){
   if(!allKit.includes(id))return false;
   const kit=ensure(world).kit,total=Object.values(kit).reduce((s,n)=>s+n,0);
   if(total>=MAX_KIT||kitCount(world,id)>=MAX_ITEM)return false;
   kit[id]=kitCount(world,id)+1;return true;
 }
 function useKit(world,id){const q=ensure(world);if(!id||kitCount(world,id)<1)return false;q.kit[id]--;if(q.kit[id]<=0)delete q.kit[id];return true;}
 function chanceProfile(world,S,run,action){
   const parts=[];let raw=0;
   const put=(label,n)=>{if(n){parts.push({label,value:n});raw+=n;}};
   const domain=action.domain||'social';
   if(root.RPG&&root.RPG.modifierFor){
     const r=root.RPG.modifierFor(world,'subject',domain);
     put('GRADE / PERKS / ORIGIN',bounded(r.total,-2,6,0));
   }
   const stat=bounded(S&&S[action.ability],0,100,50);
   put(String(action.ability||'ABILITY').toUpperCase(),bounded(Math.floor((stat-50)/20),-2,2,0));
   const skill=bounded(S&&S.skills&&S.skills[action.skill],0,10,0);
   put('SKILL · '+String(action.skill||'').toUpperCase(),bounded(Math.floor(skill/3),0,3,0));
   if(domain==='labor'&&S&&bounded(S.jobTier,0,5,0)>0)put('EMPLOYED',1);
   if(domain==='social'&&S&&S.married)put('HOUSEHOLD SUPPORT',1);
   if((domain==='hustle'||domain==='crime')&&S&&S.holdMember)put('HOLD CONNECTION',1);
   if(S&&S.health<35)put('LOW HEALTH',-2);
   if(domain==='bureau'&&S&&S.record)put('OFFICIAL RECORD',-1);
   if(domain==='bureau'&&S&&S.scrutiny>75)put('UNDER SCRUTINY',-1);
   if(run&&run.preparation&&run.preparation===action.domain)put('PREPARATION',1);
   if(action.item&&kitCount(world,action.item)>0)put('QUEST ITEM',2);
   const mod=bounded(raw,-4,8,0),dc=bounded(action.dc,5,24,12);
   let successes=0;for(let face=1;face<=20;face++)if(face+mod>=dc)successes++;
   return {dc,modifier:mod,odds:successes*5,parts,itemReady:!!(action.item&&kitCount(world,action.item)>0)};
 }
 function view(world,S,id){
   const run=get(world,id);if(!run)return null;
   const def=byId(run.definitionId);
   if(!def)return {run,missing:true,options:[]};
   const stage=run.stage;
   const entries=stage==='prepare'?def.preparation:stage==='crisis'?def.approaches:stage==='aftermath'?def.after:[];
   const options=entries.map(a=>{
     const profile=stage==='crisis'&&!a.safe?chanceProfile(world,S,run,a):null;
     const cost=bounded(a.cost,0,50000,0);
     return {id:a.id,label:a.label,detail:a.detail||'',cost,unaffordable:cost>bounded(S&&S.assets,-200000,1000000,0),
       safe:stage==='crisis'&&!!a.safe,profile};
   });
   return {id:run.id,title:def.title,icon:def.icon,tag:def.tag,hook:def.hook,stage,
     prompt:stage==='prepare'?def.prep:stage==='crisis'?def.crisis:stage==='waiting'?'The world moves. Return next year.':stage==='aftermath'?def.echo:'This chapter is filed.',
     options,run};
 }
 function apply(world,S,delta,year,run){
   if(!S||!delta)return;
   const statCaps={health:[0,S.healthCap||100],happiness:[0,100],relations:[0,100],
     smarts:[0,100],scrutiny:[0,100],familyMood:[0,100],assets:[-200000,1000000]};
   Object.keys(statCaps).forEach(k=>{if(Object.prototype.hasOwnProperty.call(delta,k)){
     const [lo,hi]=statCaps[k],change=bounded(delta[k],-50000,50000,0);
     S[k]=bounded(bounded(S[k],lo,hi,k==='assets'?0:50)+change,lo,hi);
   }});
   if(delta.skill&&S.skills&&Object.prototype.hasOwnProperty.call(S.skills,delta.skill))
     S.skills[delta.skill]=bounded(S.skills[delta.skill]+1,0,10,0);
   else if(delta.skill&&S.skills&&['craft','land','care','academics','design','arts','retail','athletics','social'].includes(delta.skill))
     S.skills[delta.skill]=1;
   if(delta.wage&&root.EmploymentSystem&&root.EmploymentSystem.activeForPerson&&root.EmploymentSystem.adjustSalary){
     const c=root.EmploymentSystem.activeForPerson(world,'subject')[0];
     if(c)root.EmploymentSystem.adjustSalary(world,c.id,c.annualSalary+bounded(delta.wage,0,500,0),'quest:'+run.definitionId,year);
   }
 }
 function remember(world,run,year,outcome){
   if(!root.RelationshipMemory||typeof root.RelationshipMemory.add!=='function')return;
   let other='karsen';
   const ids=Object.keys(world.npcs||{}).sort();
   const npc=ids.map(id=>world.npcs[id]).find(n=>n&&n.id!=='subject'&&n.alive!==false&&(!n.settlementId||n.settlementId===world.activeSettlementId));
   if(npc)other=String(npc.id);
   root.RelationshipMemory.add(world,{year,type:'quest_'+run.definitionId,
     participants:['subject',other],intensity:0.65,valence:outcome==='success'?0.6:-0.3,decay:0.006,
     summary:run.lastText.slice(0,240),tags:['quest',run.definitionId]});
   if(npc&&root.NpcSystem&&root.NpcSystem.relationship){
     const rel=root.NpcSystem.relationship(npc,'subject',{closeness:50});
     rel.closeness=bounded(rel.closeness+(outcome==='success'?4:-2),0,100,50);
   }
 }
 function choose(world,S,id,choiceId){
   const q=ensure(world),run=q&&q.runs[id],def=run&&byId(run.definitionId);
   if(!run||!def)return {applied:false,reason:'unknown_quest'};
   const stage=run.stage,options=stage==='prepare'?def.preparation:stage==='crisis'?def.approaches:stage==='aftermath'?def.after:[];
   const action=options.find(a=>a.id===choiceId);
   if(!action)return {applied:false,reason:'unavailable_choice'};
   const cost=bounded(action.cost,0,50000,0);
   if(cost>bounded(S&&S.assets,-200000,1000000,0))return {applied:false,reason:'insufficient_funds'};
   const year=bounded(world.year,-5000,5000,0);
   if(cost)apply(world,S,{assets:-cost},year,run);
   run.updatedYear=year;run.choiceId=action.id;
   if(stage==='prepare'){
     if(action.item)addKit(world,action.item);
     if(action.effect)apply(world,S,action.effect,year,run);
     run.preparation=action.boost||'';
     run.stage='crisis';run.lastText='Preparation: '+action.label;
     log(run,year,run.lastText,'neutral');
     return {applied:true,stage:run.stage};
   }
   if(stage==='crisis'){
     const profile=action.safe?null:chanceProfile(world,S,run,action);
     let face=null,success=true,roll=null;
     if(profile){
       const rng=root.WorldSimulation&&root.WorldSimulation.streamFor
         ?root.WorldSimulation.streamFor(world,year,id,'quest:'+action.id)
         :root.Random.create([world.seed,year,id,action.id].join('|'));
       face=1+Math.floor(rng.next()*20);
       success=face+profile.modifier>=profile.dc;
       roll={face,modifier:profile.modifier,total:face+profile.modifier,dc:profile.dc,odds:profile.odds};
       // No automatic success/failure for a natural 20/1 on ability checks.
       if(profile.itemReady)useKit(world,action.item);
     }
     run.roll=roll;run.outcome=success?'success':'failure';
     run.lastText=String(success?action.win:action.lose||'A setback changes the situation.');
     apply(world,S,success?action.success:action.failure,year,run);
     if(success&&profile&&roll.total-profile.dc<2)apply(world,S,{happiness:-1},year,run);
     run.stage='waiting';run.readyYear=year+1;
     log(run,year,run.lastText,success?'good':'bad');
     remember(world,run,year,run.outcome);
     return {applied:true,stage:run.stage,success,roll,text:run.lastText};
   }
   if(stage==='aftermath'){
     apply(world,S,action.effect,year,run);
     run.stage='completed';run.readyYear=null;
     run.lastText='Aftermath: '+action.label;
     log(run,year,run.lastText,'good');
     if(root.RPG&&root.RPG.addMerit)
       root.RPG.addMerit(world,'subject',run.outcome==='success'?45:30,'quest:'+run.id,year);
     return {applied:true,stage:'completed',text:run.lastText};
   }
   return {applied:false,reason:'not_actionable'};
 }
 function tickWorld(world,opts){
   const q=ensure(world);if(!q)return {applied:false,reason:'no-world'};
   const year=bounded(opts&&opts.year!=null?opts.year:world.year,-5000,5000,0);
   if(q.lastTickYear!=null&&year<=q.lastTickYear)return {applied:false,reason:year===q.lastTickYear?'already_applied':'stale_year'};
   let callbacks=0;
   Object.values(q.runs).forEach(run=>{
     if(run.stage==='waiting'&&run.readyYear!=null&&year>=run.readyYear){
       run.stage='aftermath';run.updatedYear=year;callbacks++;
       const def=byId(run.definitionId);
       run.lastText=def?def.echo:'The consequences arrive.';
       log(run,year,run.lastText,'neutral');
       // Follow-up pressure is not a second wage/payment source.
       if(opts&&opts.subject)apply(world,opts.subject,run.outcome==='failure'?{happiness:-1}:{happiness:1},year,run);
     }
   });
   q.lastTickYear=year;
   return {applied:true,callbacks};
 }
 function summary(world,S){
   const q=ensure(world),runs=Object.values(q.runs);
   return {active:active(world).length,completed:runs.filter(r=>r.stage==='completed').length,
     available:catalog(world,S).filter(c=>c.canStart).length,kit:Object.assign({},q.kit)};
 }
 function checkInvariants(world){
   const q=ensure(world);if(!q)return ['quest:missing'];
   const issues=[],ids=Object.keys(q.runs),seen=new Set();
   if(ids.length>MAX_RUNS)issues.push('quest:run-cap');
   if(active(world).length>MAX_ACTIVE)issues.push('quest:active-cap');
   ids.forEach(id=>{
     const r=q.runs[id];
     if(!validId(id)||r.id!==id||seen.has(id))issues.push('quest:bad-id:'+id);
     seen.add(id);
     if(!STAGES.includes(r.stage))issues.push('quest:bad-stage:'+id);
     if(r.history.length>MAX_HISTORY)issues.push('quest:history-cap:'+id);
     if(r.stage==='waiting'&&r.readyYear==null)issues.push('quest:missing-deadline:'+id);
   });
   if(Object.values(q.kit).reduce((s,v)=>s+v,0)>MAX_KIT)issues.push('quest:kit-cap');
   return issues;
 }
 root.QuestEngine={VERSION,MAX_ACTIVE,ensure,migrate,byId,active,catalog,start,get,view,choose,
   chanceProfile,kitCount,tickWorld,summary,checkInvariants};
})(typeof window!=='undefined'?window:globalThis);
