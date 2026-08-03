'use strict';
(function(root){
  const SCHEMA_VERSION=2;
  const STATES=new Set(['latent','symptomatic','diagnosed','treated','remission','chronic','resolved']);
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,number(value,min)));
  const subjectLike=person=>!!person&&typeof person.health==='number';
  const personKey=person=>String(person&&(person.npcId||person.id)||'subject').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'subject';
  const yearOf=(person,worldOrYear)=>number(worldOrYear&&typeof worldOrYear==='object'?worldOrYear.year:worldOrYear,number(person&&person.dob)+number(person&&person.age));
  const ageOf=(person,worldOrYear)=>subjectLike(person)?number(person.age):Math.max(0,yearOf(person,worldOrYear)-number(person&&person.birthYear,yearOf(person,worldOrYear)));
  const medical=person=>subjectLike(person)?person.medical:person&&person.health&&person.health.medical;
  const setMedical=(person,value)=>{if(subjectLike(person))person.medical=value;else person.health.medical=value;};
  const getHealth=person=>subjectLike(person)?number(person.health):number(person&&person.health&&person.health.general);
  const getHealthCap=person=>subjectLike(person)?number(person.healthCap,100):100;
  function normalizeCondition(person,condition,options){
    const rawDefinitionId=String(condition.definitionId||condition.id||'').trim();
    const info=root.ConditionRegistry.condition(rawDefinitionId);
    const world=options&&options.world||options;
    condition.definitionId=info?info.id:rawDefinitionId;condition.id=condition.definitionId;condition.severity=clamp(number(condition.severity,info?info.base:1),0,5);
    condition.state=STATES.has(condition.state)?condition.state:(condition.resolved?'resolved':condition.known?'diagnosed':'symptomatic');
    condition.known=condition.known==null?['diagnosed','treated','remission','chronic'].includes(condition.state):!!condition.known;
    condition.treated=condition.state==='treated';condition.resolved=condition.state==='resolved';
    condition.onsetAge=number(condition.onsetAge,ageOf(person,world));condition.onsetYear=number(condition.onsetYear,yearOf(person,world));
    ['diagnosedAge','diagnosedYear','resolvedAge','resolvedYear','lastProgressionYear','lastTreatmentYear'].forEach(key=>{condition[key]=condition[key]==null?null:number(condition[key]);});
    condition.source=String(condition.source||'unclassified');condition.exposureType=String(condition.exposureType||(info?info.kind:'unknown'));condition.contagious=condition.contagious==null?(info?!!info.contagious:false):!!condition.contagious;
    condition.treatment=condition.treatment||null;condition.adherence=number(condition.adherence);condition.yearsActive=Math.max(0,number(condition.yearsActive,condition.years));condition.years=condition.yearsActive;
    condition.incubationLeft=Math.max(0,number(condition.incubationLeft,condition.state==='latent'&&info?info.incubation:0));condition.complications=Array.isArray(condition.complications)?condition.complications:[];
    if(!condition.instanceId){const state=medical(person);state.instanceCounter+=1;condition.instanceId='condition:'+personKey(person)+':'+condition.onsetYear+':'+String(state.instanceCounter).padStart(4,'0');}
    return condition;
  }
  function ensureMedicalState(person,options){
    if(!person||typeof person!=='object')throw new Error('MedicalSystem requires a person');
    if(!subjectLike(person)&&(!person.health||typeof person.health!=='object'))person.health={general:70,conditions:[]};
    let state=medical(person);const legacy=subjectLike(person)?person.conditions:person.health.conditions;
    if(!state||typeof state!=='object'){state={conditions:Array.isArray(legacy)?legacy:[]};setMedical(person,state);}
    state.schemaVersion=SCHEMA_VERSION;state.resilience=clamp(number(state.resilience,50),0,100);state.prevention=Object.assign({sanitation:0,vaccination:0,screening:0},state.prevention||{});state.exposure=Object.assign({currentRisk:0,lastSource:null,lastYear:null},state.exposure||{});
    state.history=Array.isArray(state.history)?state.history.slice(-24):[];state.conditions=Array.isArray(state.conditions)?state.conditions:(Array.isArray(legacy)?legacy:[]);state.yearHoursPenalty=Math.max(0,Math.min(2,number(state.yearHoursPenalty)));
    ['lastCheckupAge','lastTreatmentAge','lastHealthSource','lastHealthAge','lastTickYear'].forEach(key=>{if(state[key]===undefined)state[key]=null;});state.instanceCounter=Math.max(0,Math.floor(number(state.instanceCounter)));state.actionCounter=Math.max(0,Math.floor(number(state.actionCounter)));
    state.conditions.forEach(condition=>normalizeCondition(person,condition,options));return syncLegacy(person);
  }
  function syncLegacy(person){const state=medical(person)||ensureMedicalState(person);state.conditions.forEach(condition=>{condition.id=condition.definitionId;condition.years=condition.yearsActive;condition.treated=condition.state==='treated';condition.resolved=condition.state==='resolved';});if(subjectLike(person))person.conditions=state.conditions;else person.health.conditions=state.conditions;return state;}
  function setHealth(person,value,source,worldOrYear){if(subjectLike(person))person.health=clamp(value,0,getHealthCap(person));else person.health.general=clamp(value,0,100);const state=ensureMedicalState(person,{year:yearOf(person,worldOrYear)});state.lastHealthSource=source||'general';state.lastHealthAge=ageOf(person,worldOrYear);return getHealth(person);}
  function activeConditions(person){return ensureMedicalState(person).conditions.filter(condition=>condition.state!=='resolved');}
  function conditionByRef(person,reference){return activeConditions(person).find(condition=>condition.instanceId===reference||condition.id===reference)||null;}
  function history(person,kind,condition,note,options){const state=ensureMedicalState(person,options);const world=options&&options.world||options;state.history.push({year:yearOf(person,world),age:ageOf(person,world),kind,conditionId:condition&&condition.id||null,note:note||''});if(state.history.length>24)state.history=state.history.slice(-24);}
  function addCondition(person,definitionId,severity,options={}){if(!root.ConditionRegistry.isConditionId(definitionId))return null;const state=ensureMedicalState(person,options),existing=activeConditions(person).find(condition=>condition.definitionId===definitionId);if(existing){existing.severity=Math.max(existing.severity,clamp(severity||1,1,5));if(options.source)existing.source=options.source;return existing;}const definition=root.ConditionRegistry.condition(definitionId),world=options.world;const condition=normalizeCondition(person,{definitionId,id:definitionId,severity:severity||definition.base,state:options.state==='latent'||options.incubation>0?'latent':options.state||'symptomatic',known:options.known===true,onsetAge:ageOf(person,world),onsetYear:yearOf(person,world),source:options.source||'unclassified',exposureType:options.exposureType||definition.kind,contagious:options.contagious,incubationLeft:options.incubation==null?0:options.incubation},options);state.conditions.push(condition);history(person,'onset',condition,condition.source,options);syncLegacy(person);return condition;}
  function stream(world,person,year,phase,salt){return root.Random.create([(world&&world.seed)!=null?world.seed:'medical',year,personKey(person),'medical',phase,salt||''].join('|'));}
  function checkInvariants(person){const state=ensureMedicalState(person),violations=[];if(state.schemaVersion!==SCHEMA_VERSION)violations.push('medical schema must be version 2');if(!Array.isArray(state.conditions))violations.push('conditions must be an array');if((subjectLike(person)?person.conditions:person.health.conditions)!==state.conditions)violations.push('compatibility condition array is not synchronized');const ids=new Set();state.conditions.forEach(condition=>{if(!condition.definitionId)violations.push('condition requires a definition ID');if(!condition.instanceId||ids.has(condition.instanceId))violations.push('condition instance IDs must be unique');ids.add(condition.instanceId);if(!Number.isFinite(condition.severity)||condition.severity<0||condition.severity>5)violations.push('condition severity must be bounded');if(!STATES.has(condition.state))violations.push('condition has invalid state');});if(!Array.isArray(state.history)||state.history.length>24)violations.push('medical history must contain at most 24 entries');if(!Number.isInteger(state.instanceCounter)||state.instanceCounter<0||!Number.isInteger(state.actionCounter)||state.actionCounter<0)violations.push('medical counters must be nonnegative integers');if(!Number.isFinite(getHealth(person))||getHealth(person)<0||getHealth(person)>getHealthCap(person))violations.push('health must be within bounds');return violations;}
  root.MedicalSystem={SCHEMA_VERSION,personKey,ageOf,yearOf,isSubjectLike:subjectLike,getHealth,getHealthCap,setHealth,applyHealthDelta:(person,amount,source,worldOrYear)=>setHealth(person,getHealth(person)+amount,source,worldOrYear),ensureMedicalState,normalizeCondition,syncLegacy,migrate:ensureMedicalState,checkInvariants,activeConditions,conditionByRef,addCondition,history,stream};
})(globalThis);
