'use strict';
/* Privacy-preserving formative playtest snapshot.
 * No telemetry, persistent save changes, or validated-survey claims. */
(function(root){
  const KEYS=Object.freeze(['enjoyment','agency','clarity']);
  const QUESTIONS=Object.freeze([
    Object.freeze({id:'enjoyment',title:'ENJOYMENT',prompt:'I wanted to keep playing'}),
    Object.freeze({id:'agency',title:'CHOICE AGENCY',prompt:'My decisions changed what happened'}),
    Object.freeze({id:'clarity',title:'OUTCOME CLARITY',prompt:'I understood the odds and results'})
  ]);
  const ALLOWED_ARCS=new Set(['WORK','FAMILY','BUREAU','SCHOOL','TRADE','CAREER','UNDERWORLD']);
  let answered={};
  function ratingValue(value){
    if(typeof value==='string'&&!/^[1-5]$/.test(value))return null;
    if(typeof value!=='number'&&typeof value!=='string')return null;
    const n=Number(value);
    return Number.isInteger(n)&&n>=1&&n<=5?n:null;
  }
  function rate(id,value){
    if(!KEYS.includes(id))return {ok:false,reason:'invalid_question'};
    const n=ratingValue(value);
    if(n===null)return {ok:false,reason:'invalid_score'};
    answered[id]=n;
    return {ok:true,id,value:n};
  }
  function ratings(){
    return {enjoyment:answered.enjoyment||null,agency:answered.agency||null,clarity:answered.clarity||null};
  }
  function reset(){answered={};}
  function boundedCount(value){
    return Number.isInteger(value)&&value>=0?Math.min(value,100000):null;
  }
  function snapshot(world,subject,options){
    const w=world&&typeof world==='object'?world:{},o=options||{};
    const archived=Object.values(w.storyArchive||{}).filter(a=>a&&a.quest===true);
    const known=archived.filter(a=>boundedCount(a.checkCount)!==null);
    const defs=Object.create(null);
    (root.StoryEpisodes||[]).filter(e=>e&&e.quest&&typeof e.id==='string').forEach(e=>{
      if(!Object.prototype.hasOwnProperty.call(defs,e.id))
        defs[e.id]=ALLOWED_ARCS.has(e.questArc)?e.questArc:'OTHER';
    });
    const arcs={};
    archived.forEach(a=>{
      const arc=Object.prototype.hasOwnProperty.call(defs,a.episodeId)?defs[a.episodeId]:'OTHER';
      arcs[arc]=(arcs[arc]||0)+1;
    });
    const ordered={};
    Object.keys(arcs).sort().forEach(k=>{ordered[k]=arcs[k];});
    const r=w.rpg&&w.rpg.subjects&&w.rpg.subjects.subject||null;
    const active=Object.values(w.storyRuns||{}).filter(x=>x&&x.quest&&x.status!=='filed').length;
    return {
      scope:'retained_archive',
      archivedChapters:archived.length,
      uniqueEndings:new Set(archived.filter(a=>typeof a.endingId==='string').map(a=>a.endingId)).size,
      documentedChecks:known.reduce((n,a)=>n+boundedCount(a.checkCount),0),
      zeroCheckArchives:known.filter(a=>a.checkCount===0).length,
      unknownCheckArchives:archived.length-known.length,
      activeChapters:active,
      arcs:ordered,
      grade:r&&Number.isInteger(r.grade)?r.grade:null,
      merit:r&&Number.isInteger(r.merit)?r.merit:null,
      availableLeads:boundedCount(o.availableLeads),
      energyUsed:boundedCount(o.energyUsed),
      energyTotal:boundedCount(o.energyTotal)
    };
  }
  function report(world,subject,options){
    return {schema:'life-file-playtest-v1',form:'unvalidated_formative_3_item',
      transfer:'user_initiated_copy_only',ratings:ratings(),snapshot:snapshot(world,subject,options)};
  }
  function exportJSON(world,subject,options){return JSON.stringify(report(world,subject,options),null,2);}
  root.RPGPlaytest=Object.freeze({QUESTIONS,rate,ratings,reset,snapshot,report,exportJSON});
})(typeof globalThis!=='undefined'?globalThis:this);
