'use strict';
/* Additive story quest adapter: no second quest state, no map dependencies. */
(function(root){
 const story=root.StorySystem, RPG=root.RPG;
 if(!story||!RPG)return;
 const nativeView=story.currentView,nativeChoose=story.choose,nativeFile=story.fileAway;
 const pickSubject=opts=>opts&&opts.subject||(typeof S!=='undefined'?S:null);
 const pickLineage=opts=>opts&&opts.lineage||(typeof Lineage!=='undefined'?Lineage:null);
 function lived(world,id){return Object.values(world.storyArchive||{}).some(a=>a&&a.episodeId===id);}
 function access(world,subject,option){
  const r=option.require||{};
  if(r.minAssets!=null&&(!subject||Number(subject.assets)<r.minAssets))
   return {available:false,reason:'NEED $'+r.minAssets};
  if(r.item&&(!world.storyItems||!world.storyItems[r.item]))
   return {available:false,reason:'NEED '+r.item.replace(/_/g,' ').toUpperCase()};
  if(r.skill&&(!subject||Number(subject.skills&&subject.skills[r.skill]||0)<Number(r.level||1)))
   return {available:false,reason:'NEED '+r.skill.toUpperCase()+' '+(r.level||1)};
  return {available:true,reason:''};
 }
 story.availableQuests=function(world,options){
  story.ensure(world);const subject=pickSubject(options),lineage=pickLineage(options);
  if(!subject||subject.alive===false)return [];
  return (root.StoryEpisodes||[]).filter(e=>e.quest&&!lived(world,e.id))
   .filter(e=>{try{return (!e.eligible||e.eligible(world,subject,lineage))&&(!e.cast||e.cast(world,subject,lineage)!=null);}catch(_){return false;}})
   .map(e=>({id:e.id,title:e.questTitle||e.id,hint:e.questHint||'',icon:e.questIcon||'🎲',
      arc:e.questArc||e.domain||'LIFE',domain:e.domain||'life',followup:!!e.followup}));
 };
 story.startQuest=function(world,id,options){
  story.ensure(world);
  if(story.hasLiveRun(world))return {ok:false,reason:'finish_current_episode'};
  const opts=options||{},subject=pickSubject(opts),lineage=pickLineage(opts);
  const def=(root.StoryEpisodes||[]).find(e=>e.quest&&e.id===id);
  if(!def||!story.availableQuests(world,{subject,lineage}).some(q=>q.id===id))
   return {ok:false,reason:'not_available'};
  const year=Number.isFinite(opts.year)?Math.round(opts.year):world.year;
  const rng=root.WorldSimulation&&root.WorldSimulation.streamFor?
   root.WorldSimulation.streamFor(world,year,'quest:'+id,'story'):
   root.Random.create([world.seed,year,id,'quest'].join('|'));
  const raw=def.cast?def.cast(world,subject,lineage):[];
  const bind=Array.isArray(raw)?raw.reduce((a,c)=>{if(c&&c.key)a[c.key]=c;return a;},{}):(raw||{});
  let body;
  try{body=def.build(bind,rng)||{};}catch(_){return {ok:false,reason:'invalid_episode'};}
  const start=body.startScene||Object.keys(body.scenes||{})[0];
  if(!start||!body.scenes[start])return {ok:false,reason:'no_scene'};
  const idRun='story:'+String(++world.storyCounter).padStart(5,'0');
  const cast={};Object.keys(bind).forEach(k=>{const b=bind[k];cast[k]={label:b.label||k,bind:b.bind,npcId:b.npcId};});
  const key=def.id+'|'+Object.keys(bind).map(k=>k+':'+String(bind[k].bind||'')).join('|');
  const run={id:idRun,episodeId:def.id,quest:true,domain:def.domain||'life',
   title:String(body.title||def.questTitle||'CHAPTER'),bg:body.bg||'street',
   castKey:key,signature:key,cast,scenes:body.scenes,startScene:start,sceneId:start,lineIndex:0,
   flags:{},tones:[],rememberNote:null,startedYear:year,status:'playing',finalizedEndingId:null,history:[]};
  world.storyRuns[idRun]=run;
  return {ok:true,runId:idRun,title:run.title};
 };
 story.currentView=function(world,options){
  const view=nativeView(world,options);
  if(!view||view.type!=='choice')return view;
  const run=story.liveRun(world),scene=run&&run.scenes[run.sceneId];
  const subject=pickSubject(options);
  if(!scene||!scene.choice)return view;
  view.options=view.options.map((row,i)=>{
   const choice=scene.choice.options[i],a=access(world,subject,choice);
   const check=choice.check&&RPG.previewCheck?
    RPG.previewCheck(world,Object.assign({actorId:'subject',subject},choice.check)):null;
   return Object.assign({},row,{
    available:a.available,unavailableReason:a.reason,
    check:check?{domain:check.domain,difficulty:check.difficulty,tn:check.tn,mod:check.mod,
      percent:check.percent,breakdown:check.breakdown}:null
   });
  });
  return view;
 };
 story.choose=function(world,index,options){
  const run=story.liveRun(world),scene=run&&run.scenes[run.sceneId],subject=pickSubject(options);
  if(!run||run.status==='ended'||!scene||!scene.choice)return nativeChoose(world,index,options);
  const choice=scene.choice.options[index];
  if(!choice)return {applied:false,reason:'bad_option'};
  if(run.history.some(h=>h.type==='choice'&&h.sceneId===run.sceneId))
   return {applied:false,reason:'already_resolved'};
  const a=access(world,subject,choice);
  if(!a.available)return {applied:false,reason:'unavailable',detail:a.reason};
  if(!choice.check)return nativeChoose(world,index,options);
  const opts=options||{},year=Number.isFinite(opts.year)?Math.round(opts.year):world.year;
  const rng=root.WorldSimulation&&root.WorldSimulation.streamFor?
   root.WorldSimulation.streamFor(world,year,run.id+':'+run.sceneId+':'+index,'story-dice'):
   root.Random.create([world.seed,year,run.id,run.sceneId,index].join('|'));
  const result=RPG.resolveCheck(world,Object.assign({actorId:'subject',subject,stream:rng},choice.check));
  if(!result.ok)return {applied:false,reason:'dice_error'};
  const originalGoto=choice.goto,originalEffects=choice.effects;
  const extra=result.success?(choice.check.successEffects||[]):(choice.check.failEffects||[]);
  choice.goto=result.success?(choice.check.successGoto||originalGoto):(choice.check.failGoto||originalGoto);
  choice.effects=(originalEffects||[]).concat(extra);
  let res;
  try{res=nativeChoose(world,index,options);}
  finally{choice.goto=originalGoto;choice.effects=originalEffects;}
  if(res.applied){
   const receipt={rolls:result.rolls.slice(),mod:result.mod,total:result.total,tn:result.tn,
    margin:result.margin,success:result.success,domain:result.domain,year};
   run.lastCheck=receipt;
   const last=run.history[run.history.length-1];
   if(last)last.check=receipt;
   res.check=result;
  }
  return res;
 };
 story.fileAway=function(world,runId,options){
  const run=world&&world.storyRuns&&world.storyRuns[runId];
  const out=nativeFile(world,runId,options);
  if(out&&out.applied&&run&&run.quest){
   const archive=Object.values(world.storyArchive||{}).find(a=>a&&a.episodeId===run.episodeId&&a.startedYear===run.startedYear);
   if(archive){archive.quest=true;archive.checkCount=run.history.filter(h=>h.check).length;}
   RPG.addMerit(world,'subject',20,'quest:'+run.id,options&&options.year!=null?options.year:world.year);
  }
  return out;
 };
 const nativeInvariants=story.checkInvariants;
 story.checkInvariants=function(world){
  const out=nativeInvariants(world);
  if(Object.keys(world.storyItems||{}).length>32)out.push('story items exceed bound');
  return out;
 };
})(typeof globalThis!=='undefined'?globalThis:this);
