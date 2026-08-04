'use strict';
(function(root){
  const SCHEMA_VERSION=2;
  const STATES=new Set(['latent','symptomatic','diagnosed','treated','remission','chronic','resolved']);
  const KNOWN_STATES=new Set(['diagnosed','treated','remission','chronic']);
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const integer=(value,fallback=0)=>Math.round(number(value,fallback));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,number(value,min)));
  const subjectLike=person=>!!person&&typeof person.health==='number';
  const personKey=person=>String(person&&(person.npcId||person.id)||'subject').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'subject';
  const yearOf=(person,worldOrYear)=>number(worldOrYear&&typeof worldOrYear==='object'?worldOrYear.year:worldOrYear,number(person&&person.dob)+number(person&&person.age));
  const ageOf=(person,worldOrYear)=>subjectLike(person)?number(person.age):Math.max(0,yearOf(person,worldOrYear)-number(person&&person.birthYear,yearOf(person,worldOrYear)));
  const medical=person=>subjectLike(person)?person.medical:person&&person.health&&person.health.medical;
  const setMedical=(person,value)=>{if(subjectLike(person))person.medical=value;else person.health.medical=value;};
  const getHealth=person=>subjectLike(person)?person.health:person&&person.health&&person.health.general;
  const getHealthCap=person=>subjectLike(person)?number(person.healthCap,100):100;
  function normalizePersonHealth(person){if(subjectLike(person)){person.health=Number.isFinite(Number(person.health))?clamp(person.health,0,getHealthCap(person)):50;}else{person.health.general=Number.isFinite(Number(person.health.general))?clamp(person.health.general,0,100):70;}return getHealth(person);}
  function normalizeCondition(person,condition,options){
    const rawDefinitionId=String(condition.definitionId||condition.id||'').trim();
    const info=root.ConditionRegistry.condition(rawDefinitionId);
    const world=options&&options.world||options;
    condition.definitionId=info?info.id:rawDefinitionId;condition.id=condition.definitionId;condition.severity=clamp(number(condition.severity,info?info.base:1),0,5);
    condition.state=STATES.has(condition.state)?condition.state:(condition.resolved?'resolved':condition.known?'diagnosed':'symptomatic');
    condition.known=KNOWN_STATES.has(condition.state)?true:Boolean(condition.known);
    condition.treated=condition.state==='treated';condition.resolved=condition.state==='resolved';
    condition.onsetAge=number(condition.onsetAge,ageOf(person,world));condition.onsetYear=integer(condition.onsetYear,yearOf(person,world));
    ['diagnosedAge','diagnosedYear','resolvedAge','resolvedYear','lastProgressionYear','lastTreatmentYear'].forEach(key=>{condition[key]=condition[key]==null?null:number(condition[key]);});
    condition.source=String(condition.source||'unclassified');condition.exposureType=String(condition.exposureType||(info?info.kind:'unknown'));condition.contagious=condition.contagious==null?(info?!!info.contagious:false):!!condition.contagious;
    condition.treatment=condition.treatment||null;condition.adherence=number(condition.adherence);condition.yearsActive=Math.max(0,number(condition.yearsActive,condition.years));condition.years=condition.yearsActive;
    condition.incubationLeft=Math.max(0,number(condition.incubationLeft,condition.state==='latent'&&info?info.incubation:0));condition.complications=Array.isArray(condition.complications)?condition.complications:[];
    return condition;
  }
  function reconcileInstanceIds(person,conditions,state){
    const key=personKey(person), escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), pattern=new RegExp('^condition:'+escaped+':(-?\\d+):(\\d+)$');
    let counter=Math.max(0,Math.floor(number(state.instanceCounter)));
    conditions.forEach(condition=>{const match=pattern.exec(String(condition.instanceId||''));if(match&&Number(match[2])>counter)counter=Number(match[2]);});
    const used=new Set();conditions.forEach(condition=>{const match=pattern.exec(String(condition.instanceId||''));if(match&&Number(match[2])>=1&&!used.has(condition.instanceId)){used.add(condition.instanceId);return;}do{counter+=1;condition.instanceId='condition:'+key+':'+integer(condition.onsetYear)+':'+String(counter).padStart(4,'0');}while(used.has(condition.instanceId));used.add(condition.instanceId);});state.instanceCounter=counter;
  }
  function ensureMedicalState(person,options){
    if(!person||typeof person!=='object')throw new Error('MedicalSystem requires a person');
    if(!subjectLike(person)&&(!person.health||typeof person.health!=='object'))person.health={general:70,conditions:[]};
    normalizePersonHealth(person);let state=medical(person);const legacy=subjectLike(person)?person.conditions:person.health.conditions;
    if(!state||typeof state!=='object'){state={conditions:Array.isArray(legacy)?legacy:[]};setMedical(person,state);}
    state.schemaVersion=SCHEMA_VERSION;state.resilience=clamp(number(state.resilience,50),0,100);state.prevention=Object.assign({sanitation:0,vaccination:0,screening:0},state.prevention||{});state.exposure=Object.assign({currentRisk:0,lastSource:null,lastYear:null},state.exposure||{});
    state.history=Array.isArray(state.history)?state.history.slice(-24):[];state.conditions=Array.isArray(state.conditions)?state.conditions:(Array.isArray(legacy)?legacy:[]);state.yearHoursPenalty=Math.max(0,Math.min(2,number(state.yearHoursPenalty)));
    ['lastCheckupAge','lastTreatmentAge','lastHealthSource','lastHealthAge','lastTickYear'].forEach(key=>{if(state[key]===undefined)state[key]=null;});state.instanceCounter=Math.max(0,Math.floor(number(state.instanceCounter)));state.actionCounter=Math.max(0,Math.floor(number(state.actionCounter)));
    state.conditions.forEach(condition=>normalizeCondition(person,condition,options));reconcileInstanceIds(person,state.conditions,state);return syncLegacy(person);
  }
  function syncLegacy(person){const state=medical(person)||ensureMedicalState(person);state.conditions.forEach(condition=>{condition.id=condition.definitionId;condition.years=condition.yearsActive;condition.treated=condition.state==='treated';condition.resolved=condition.state==='resolved';});if(subjectLike(person))person.conditions=state.conditions;else person.health.conditions=state.conditions;return state;}
  function setHealth(person,value,source,worldOrYear){if(subjectLike(person))person.health=clamp(value,0,getHealthCap(person));else person.health.general=clamp(value,0,100);const state=ensureMedicalState(person,{year:yearOf(person,worldOrYear)});state.lastHealthSource=source||'general';state.lastHealthAge=ageOf(person,worldOrYear);return getHealth(person);}
  function activeConditions(person){return ensureMedicalState(person).conditions.filter(condition=>condition.state!=='resolved');}
  function conditionByRef(person,reference){return activeConditions(person).find(condition=>condition.instanceId===reference||condition.id===reference)||null;}
  function history(person,kind,condition,note,options){const state=ensureMedicalState(person,options);const world=options&&options.world||options;state.history.push({year:yearOf(person,world),age:ageOf(person,world),kind,conditionId:condition&&condition.id||null,conditionInstanceId:condition&&condition.instanceId||null,note:note||''});if(state.history.length>24)state.history=state.history.slice(-24);}
  function addCondition(person,definitionId,severity,options={}){if(!root.ConditionRegistry.isConditionId(definitionId))return null;const state=ensureMedicalState(person,options),existing=activeConditions(person).find(condition=>condition.definitionId===definitionId),supplied=Number.isFinite(Number(severity))?Number(severity):null;if(existing){if(supplied!=null)existing.severity=Math.max(existing.severity,clamp(supplied,0,5));if(options.source)existing.source=options.source;return existing;}const definition=root.ConditionRegistry.condition(definitionId),world=options.world,requested=supplied==null?definition.base:supplied;const condition=normalizeCondition(person,{definitionId,id:definitionId,severity:clamp(requested,0,5),state:options.state==='latent'||options.incubation>0?'latent':options.state||'symptomatic',known:options.known===true,onsetAge:ageOf(person,world),onsetYear:yearOf(person,world),source:options.source||'unclassified',exposureType:options.exposureType||definition.kind,contagious:options.contagious,incubationLeft:options.incubation==null?0:options.incubation},options);state.conditions.push(condition);reconcileInstanceIds(person,state.conditions,state);history(person,'onset',condition,condition.source,options);syncLegacy(person);return condition;}
  function stream(world,person,year,phase,salt){return root.Random.create([(world&&world.seed)!=null?world.seed:'medical',year,personKey(person),'medical',phase,salt||''].join('|'));}
  const readRandom=rng=>typeof rng==='function'?rng():rng&&typeof rng.next==='function'?rng.next():0;
  const actionStream=(world,person,year,phase,salt,rng)=>{const state=ensureMedicalState(person,{world,year}),counter=state.actionCounter;state.actionCounter=counter+1;return rng||stream(world,person,year,phase,String(salt||'')+':'+counter);};
  const lifestyleId=(person,key)=>person&&person.lifestyle&&person.lifestyle[key]||'basic';
  function contextFor(world,person,options={}){const opts=Object.assign({},options),year=opts.year==null?yearOf(person,world):number(opts.year),age=opts.age==null?ageOf(person,year):number(opts.age),pressure=clamp(opts.healthcarePressure==null?0:opts.healthcarePressure,0,1);return {world,person,year,age,settlement:opts.settlement||null,runtime:opts.runtime||null,building:opts.building||null,housing:opts.housing||{id:lifestyleId(person,'housing')},food:opts.food||{id:lifestyleId(person,'food')},outbreak:opts.outbreak||null,healthcarePressure:pressure};}
  function accessFor(world,person,context){const ctx=context||contextFor(world,person),settlement=ctx.settlement||{},building=ctx.building,clinics=Array.isArray(settlement.buildings)?settlement.buildings.filter(item=>item&&item.type==='clinic'):[],selected=building&&building.type==='clinic'?building:clinics[0],atFacility=!!(building&&building.type==='clinic');let facility='No local care',quality=.12,costMultiplier=1.35,delay=1;if(selected){const hospital=/hospital/i.test(String(selected.name||'')),city=settlement.kind==='city',town=settlement.kind==='town';facility=selected.name||'Clinic';quality=hospital?.90:city?.74:town?.59:.45;costMultiplier=hospital?1.25:city?1:.78;delay=atFacility?0:quality<.55?1:0;}const pressure=ctx.healthcarePressure;return {facility,quality:clamp(quality*(1-pressure*.62),.03,1),costMultiplier:costMultiplier*(1+pressure*.90),delay:delay+(pressure>=.40?1:0),atFacility,exposureRisk:clamp(pressure*.55,0,.70),healthcarePressure:pressure};}
  function exposureRisk(world,person,definitionId,context){const definition=root.ConditionRegistry.condition(definitionId);if(!definition)return 0;const state=ensureMedicalState(person,{world}),ctx=context||contextFor(world,person),housing=ctx.housing||{},food=ctx.food||{},age=ctx.age,career=String(person&&person.career||'');let risk=0;if(definitionId==='respiratory'||definitionId==='infection'){risk+=housing.id==='none'?.12:housing.id==='room'?.04:0;risk+=food.id==='meager'?.055:0;if(ctx.outbreak&&Array.isArray(ctx.outbreak.conditions)&&ctx.outbreak.conditions.includes(definitionId))risk+=.06*number(ctx.outbreak.severity,1);if(age<6||age>=65)risk+=.018;if(number(person&&person.kids)>0)risk+=.012;}if(definitionId==='strain'){risk+=number(person&&person.jobTier)>0?.012:0;risk+=number(person&&person.vice)>=4?.018:0;risk+=number(person&&person.happiness,100)<35?.018:0;risk+=career==='medicine'||career==='care'?.018:0;}if(definitionId==='injury'){if(/machin|carpent|factory|foundry|driver|transport|farm|athlet|warehouse|constr|conscript/.test(String(person&&person.jobName||'').toLowerCase()))risk+=.022;if(['trade','transport','athletics','agriculture'].includes(career))risk+=.018;}if(definitionId==='chronic'&&age>=45)risk+=.008+(age-45)*.0008;risk-=(state.resilience-50)*.0007;risk-=number(state.prevention.sanitation)*.008+number(state.prevention.vaccination)*.010;risk+=ctx.healthcarePressure*.12;return clamp(risk,0,.50);}
  function expose(world,person,spec,context,options={}){const cfg=typeof spec==='string'?{conditionId:spec}:Object.assign({},spec||{}),id=cfg.conditionId||cfg.id,definition=root.ConditionRegistry.condition(id);if(!definition)return null;const ctx=context||contextFor(world,person),risk=cfg.force?1:Number.isFinite(Number(cfg.risk))?clamp(cfg.risk,0,1):exposureRisk(world,person,id,ctx);if(!cfg.force){const rng=actionStream(world,person,ctx.year,'exposure',id,options.rng);if(readRandom(rng)>=risk)return null;}const condition=addCondition(person,id,cfg.severity,{world,year:ctx.year,source:cfg.source||'exposure',exposureType:cfg.exposureType,incubation:cfg.incubation,known:cfg.known,state:cfg.state,contagious:cfg.contagious});const state=ensureMedicalState(person,{world,year:ctx.year});state.exposure={currentRisk:risk,lastSource:cfg.source||id,lastYear:ctx.year};return condition;}
  function examine(world,person,context,options={}){const ctx=context||contextFor(world,person),state=ensureMedicalState(person,{world,year:ctx.year}),access=accessFor(world,person,ctx),rng=actionStream(world,person,ctx.year,'examination','checkup',options.rng);person.medicalRecord=true;state.lastCheckupAge=ctx.age;let condition=activeConditions(person).filter(item=>!item.known).sort((a,b)=>b.severity-a.severity||a.onsetYear-b.onsetYear||String(a.instanceId).localeCompare(String(b.instanceId)))[0],created=false;if(!condition){const chance=clamp(.08+(getHealth(person)<58?.35:0)+(ctx.age>=45?.15:0)+(number(person.vice)>=4?.12:0)+(ctx.food.id==='meager'?.15:0)+number(state.exposure.currentRisk),0,.68);if(readRandom(rng)<chance){const eligible=root.ConditionRegistry.allConditions().filter(item=>ctx.age>=item.minAge&&!activeConditions(person).some(active=>active.definitionId===item.id));if(eligible.length){condition=eligible[Math.floor(readRandom(rng)*eligible.length)]||eligible[0];condition=addCondition(person,condition.id,getHealth(person)<38?4:undefined,{world,year:ctx.year,source:'screening examination'});created=true;}}}if(condition){condition.known=true;condition.diagnosedAge=ctx.age;condition.diagnosedYear=ctx.year;if(condition.state!=='chronic')condition.state='diagnosed';history(person,'diagnosis',condition,options.source||'doctor',{world,year:ctx.year});syncLegacy(person);return {condition,found:true,created,access};}return {condition:null,found:false,created:false,access};}
  function treatmentCost(condition,treatment,access){return Math.round(number(treatment&&treatment.baseCost)* (1+(Math.max(1,number(condition&&condition.severity))-1)*.24)*number(access&&access.costMultiplier,1));}
  function treatmentOptions(world,person,reference,context){const condition=conditionByRef(person,reference);if(!condition||!condition.known)return [];const access=accessFor(world,person,context||contextFor(world,person));return root.ConditionRegistry.allTreatments().filter(treatment=>treatment.id==='rest'||treatment.minQuality<=access.quality).map(treatment=>Object.assign({},treatment,{cost:treatmentCost(condition,treatment,access)}));}
  function treat(world,person,reference,treatmentId,context,options={}){const ctx=context||contextFor(world,person),condition=conditionByRef(person,reference),access=accessFor(world,person,ctx),treatment=root.ConditionRegistry.treatment(root.ConditionRegistry.isTreatmentId(treatmentId)?treatmentId:'basic');if(!condition||condition.resolved||!condition.known)return {blocked:true,reason:'condition unavailable',cost:0,resolved:false,condition:condition||null,treatment,access};if(treatment.minQuality>access.quality)return {blocked:true,reason:'treatment unavailable',cost:0,resolved:false,condition,treatment,access};const rng=actionStream(world,person,ctx.year,'treatment',condition.instanceId,options.rng),cost=treatmentCost(condition,treatment,access);condition.treatment=treatment.id;condition.adherence=1;condition.treated=true;condition.state='treated';condition.lastTreatmentYear=ctx.year;condition.severity=clamp(condition.severity-treatment.relief,0,5);const success=readRandom(rng)<treatment.success;let complication=false;if(success&&condition.severity===0){condition.state='resolved';condition.resolved=true;condition.resolvedAge=ctx.age;condition.resolvedYear=ctx.year;history(person,'recovery',condition,treatment.name,{world,year:ctx.year});}else if(!success&&treatment.complicationRisk&&readRandom(rng)<treatment.complicationRisk){complication=true;if(!condition.complications.includes('treatment setback'))condition.complications.push('treatment setback');condition.severity=clamp(condition.severity+1,1,5);}const state=ensureMedicalState(person,{world,year:ctx.year});state.lastTreatmentAge=ctx.age;history(person,'treatment',condition,treatment.name,{world,year:ctx.year});syncLegacy(person);return {blocked:false,cost,health:treatment.health+(condition.resolved?2:0),resolved:condition.resolved,condition,treatment,access,success,complication};}
  const hoursPenalty=person=>clamp(ensureMedicalState(person).yearHoursPenalty,0,2);
  const educationPenalty=person=>activeConditions(person).reduce((total,condition)=>total+((condition.state==='symptomatic'||condition.state==='diagnosed')?Math.max(0,condition.severity-2)*3:0),0);
  const workPenalty=person=>activeConditions(person).reduce((total,condition)=>total+(condition.severity>=4?1:0),0);
  function summary(world,person,context){const state=ensureMedicalState(person,{world});return {conditions:activeConditions(person),access:accessFor(world,person,context||contextFor(world,person)),resilience:state.resilience,penalty:hoursPenalty(person)};}
  function toRngStream(streamFor,world,person,year,phase,salt){
    if(typeof streamFor==='function'){
      const custom=streamFor(phase,salt);
      if(custom)return custom;
    }
    return stream(world,person,year,phase,salt);
  }
  function progressionResult(overrides){
    return Object.assign({
      applied:false,reason:null,year:null,
      newConditions:[],progressedConditions:[],transitions:[],
      healthDelta:0,happinessDelta:0,yearHoursPenalty:0
    },overrides);
  }
  function sortedActiveConditions(person){
    return activeConditions(person).slice().sort((a,b)=>{
      const byInstance=String(a.instanceId||'').localeCompare(String(b.instanceId||''));
      if(byInstance!==0)return byInstance;
      return String(a.definitionId||'').localeCompare(String(b.definitionId||''));
    });
  }
  function attemptAnnualExposures(world,person,ctx,year,options,state,newConditions){
    ['respiratory','infection','injury','strain','chronic'].forEach(definitionId=>{
      const alreadyActive=activeConditions(person).some(condition=>condition.definitionId===definitionId);
      if(alreadyActive)return;
      const definition=root.ConditionRegistry.condition(definitionId);
      if(!definition)return;
      const risk=exposureRisk(world,person,definitionId,ctx);
      const rng=toRngStream(options.streamFor,world,person,year,'annual-exposure',definitionId);
      if(readRandom(rng)>=risk)return;
      const source=definitionId==='injury'?'occupational strain':(ctx.outbreak?'public-health outbreak':'living conditions');
      const condition=addCondition(person,definitionId,undefined,{world,year,source,incubation:definition.incubation});
      if(!condition)return;
      newConditions.push(condition);
      state.exposure={currentRisk:risk,lastSource:source,lastYear:year};
    });
  }
  function progressTreatedCondition(person,condition,ctx,year,transitions){
    if(condition.lastTreatmentYear===year){
      transitions.push({instanceId:condition.instanceId,kind:'treatment-started',from:'treated',to:'treated'});
      return;
    }
    const treatment=root.ConditionRegistry.isTreatmentId(condition.treatment)?root.ConditionRegistry.treatment(condition.treatment):root.ConditionRegistry.treatment('basic');
    condition.severity=clamp(condition.severity-treatment.annualRelief,0,5);
    condition.treated=false;
    if(condition.severity===0){
      condition.state='resolved';condition.resolved=true;condition.resolvedAge=ctx.age;condition.resolvedYear=year;
      history(person,'recovery',condition,'treatment held',{world:ctx.world,year});
      transitions.push({instanceId:condition.instanceId,kind:'resolved',from:'treated',to:'resolved'});
    }else{
      condition.state=condition.definitionId==='chronic'?'chronic':'remission';
      condition.resolved=false;
      transitions.push({instanceId:condition.instanceId,kind:condition.state,from:'treated',to:condition.state});
    }
  }
  function applyUntreatedBurden(condition,state,result){
    const burden=Math.max(1,Math.ceil(condition.severity/2));
    result.healthDelta-=burden;
    result.happinessDelta-=condition.definitionId==='strain'?burden:Math.max(0,burden-1);
    let penalty=0;
    if(condition.severity>=5)penalty=2;else if(condition.severity>=4)penalty=1;
    state.yearHoursPenalty=Math.max(state.yearHoursPenalty,penalty);
  }
  function attemptChronicConversion(world,person,condition,ctx,year,options,transitions){
    if(condition.definitionId!=='respiratory'&&condition.definitionId!=='infection')return false;
    if(condition.yearsActive<3)return false;
    const rng=toRngStream(options.streamFor,world,person,year,'annual-chronic',condition.instanceId);
    if(readRandom(rng)>=0.12)return false;
    const originalDefinitionId=condition.definitionId;
    const convertedSeverity=Math.max(2,condition.severity-1);
    const existingChronic=activeConditions(person).find(other=>other.definitionId==='chronic'&&other.instanceId!==condition.instanceId);
    if(!existingChronic){
      condition.definitionId='chronic';condition.id='chronic';condition.state='chronic';condition.known=true;
      condition.treated=false;condition.resolved=false;condition.contagious=false;condition.exposureType='chronic';
      condition.incubationLeft=0;condition.severity=convertedSeverity;
      history(person,'chronic',condition,'repeated untreated illness',{world,year});
      transitions.push({instanceId:condition.instanceId,kind:'chronic',from:originalDefinitionId,to:'chronic'});
      return true;
    }
    existingChronic.severity=Math.max(existingChronic.severity,convertedSeverity);
    existingChronic.state='chronic';existingChronic.known=true;existingChronic.treated=false;existingChronic.resolved=false;
    condition.state='resolved';condition.resolved=true;condition.treated=false;condition.resolvedAge=ctx.age;condition.resolvedYear=year;
    history(person,'chronic',existingChronic,'merged from instance '+condition.instanceId+' ('+originalDefinitionId+')',{world,year});
    history(person,'resolved',condition,'absorbed into chronic condition '+existingChronic.instanceId,{world,year});
    transitions.push({instanceId:condition.instanceId,kind:'chronic-merged',from:originalDefinitionId,to:'resolved'});
    transitions.push({instanceId:existingChronic.instanceId,kind:'chronic-merged',from:'chronic',to:'chronic'});
    return true;
  }
  function tickPerson(world,person,context,options={}){
    const ctx=context||contextFor(world,person);
    const year=integer(ctx.year);
    const state=ensureMedicalState(person,{world,year});
    if(state.lastTickYear===year)return progressionResult({applied:false,reason:'already-applied',year,yearHoursPenalty:state.yearHoursPenalty});
    if(state.lastTickYear!=null&&year<state.lastTickYear)return progressionResult({applied:false,reason:'stale-year',year,yearHoursPenalty:state.yearHoursPenalty});
    const newConditions=[],progressedConditions=[],transitions=[];
    const result=progressionResult({applied:true,reason:'applied',year,newConditions,progressedConditions,transitions});
    attemptAnnualExposures(world,person,ctx,year,options,state,newConditions);
    state.yearHoursPenalty=0;
    sortedActiveConditions(person).forEach(condition=>{
      if(condition.lastProgressionYear===year)return;
      condition.yearsActive+=1;condition.years=condition.yearsActive;
      if(condition.state==='latent'){
        condition.incubationLeft=Math.max(0,condition.incubationLeft-1);
        if(condition.incubationLeft===0){
          condition.state='symptomatic';condition.known=false;condition.treated=false;condition.resolved=false;
          const info=root.ConditionRegistry.condition(condition.definitionId);
          history(person,'symptom',condition,info?info.name:'Unrecognized condition',{world,year});
          transitions.push({instanceId:condition.instanceId,kind:'symptom',from:'latent',to:'symptomatic'});
        }
        condition.lastProgressionYear=year;progressedConditions.push(condition.instanceId);
        return;
      }
      if(condition.state==='treated'){
        progressTreatedCondition(person,condition,ctx,year,transitions);
        condition.lastProgressionYear=year;progressedConditions.push(condition.instanceId);
        return;
      }
      applyUntreatedBurden(condition,state,result);
      attemptChronicConversion(world,person,condition,ctx,year,options,transitions);
      condition.lastProgressionYear=year;progressedConditions.push(condition.instanceId);
    });
    state.lastTickYear=year;
    syncLegacy(person);
    result.yearHoursPenalty=state.yearHoursPenalty;
    return result;
  }
  function mortalityCauseText(definitionId){
    if(definitionId==='injury')return 'complications from an untreated injury';
    if(definitionId==='chronic')return 'complications from a chronic condition';
    const info=root.ConditionRegistry.condition(definitionId);
    return info?'an untreated '+info.name.toLowerCase():'complications from an unrecognized condition';
  }
  function mortalityContribution(condition){
    if(condition.severity<4)return 0;
    if(condition.state==='treated'||condition.state==='remission')return 0;
    return (condition.severity-3)*0.007+(condition.yearsActive||0)*0.0015;
  }
  function mortalityDetails(world,person,context){
    const conditions=activeConditions(person);
    let best=null,bestContribution=0,total=0;
    conditions.forEach(condition=>{
      const contribution=mortalityContribution(condition);
      if(contribution<=0)return;
      total+=contribution;
      const better=!best
        ||contribution>bestContribution
        ||(contribution===bestContribution&&condition.severity>best.severity)
        ||(contribution===bestContribution&&condition.severity===best.severity&&condition.yearsActive>best.yearsActive)
        ||(contribution===bestContribution&&condition.severity===best.severity&&condition.yearsActive===best.yearsActive&&String(condition.instanceId).localeCompare(String(best.instanceId))<0);
      if(better){best=condition;bestContribution=contribution;}
    });
    if(!best)return {risk:0,cause:null,conditionInstanceId:null,definitionId:null};
    return {risk:clamp(total,0,0.16),cause:mortalityCauseText(best.definitionId),conditionInstanceId:best.instanceId,definitionId:best.definitionId};
  }
  function rollMortality(world,person,context,options={}){
    const details=mortalityDetails(world,person,context);
    if(details.risk<=0)return Object.assign({died:false,roll:null},details);
    const ctx=context||contextFor(world,person);
    const rng=options.rng||stream(world,person,integer(ctx.year),'annual-mortality','medical');
    const roll=readRandom(rng);
    return Object.assign({died:roll<details.risk,roll},details);
  }
  function checkInvariants(person){const state=ensureMedicalState(person),violations=[],key=personKey(person),pattern=new RegExp('^condition:'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':-?\\d+:\\d+$');if(state.schemaVersion!==SCHEMA_VERSION)violations.push('medical schema must be version 2');if((subjectLike(person)?person.conditions:person.health.conditions)!==state.conditions)violations.push('compatibility condition array is not synchronized');const ids=new Set();state.conditions.forEach((condition,index)=>{const tag=condition.instanceId||'index '+index;if(!root.ConditionRegistry.isConditionId(condition.definitionId))violations.push('unknown condition definition: '+condition.definitionId);if(!pattern.test(String(condition.instanceId))||ids.has(condition.instanceId))violations.push('invalid or duplicate instance ID: '+tag);ids.add(condition.instanceId);if(!Number.isFinite(condition.severity)||condition.severity<0||condition.severity>5)violations.push('condition severity must be bounded: '+tag);if(!STATES.has(condition.state))violations.push('condition has invalid state: '+tag);if(condition.resolved!==(condition.state==='resolved')||condition.treated!==(condition.state==='treated')||(KNOWN_STATES.has(condition.state)&&condition.known!==true))violations.push('condition state flags inconsistent: '+tag);if(condition.years!==condition.yearsActive||!Number.isFinite(condition.yearsActive)||condition.yearsActive<0||!Number.isFinite(condition.incubationLeft)||condition.incubationLeft<0||!Array.isArray(condition.complications))violations.push('condition lifecycle fields invalid: '+tag);});if(!Array.isArray(state.history)||state.history.length>24)violations.push('medical history must contain at most 24 entries');if(!Number.isInteger(state.instanceCounter)||state.instanceCounter<0||!Number.isInteger(state.actionCounter)||state.actionCounter<0)violations.push('medical counters must be nonnegative integers');if(!Number.isFinite(getHealth(person))||getHealth(person)<0||getHealth(person)>getHealthCap(person))violations.push('health must be within bounds');if(state.lastTickYear!==null&&!Number.isInteger(state.lastTickYear))violations.push('medical.lastTickYear must be null or a finite integer');state.conditions.forEach((condition,index)=>{const tag=condition.instanceId||'index '+index;if(condition.lastProgressionYear!==null&&!Number.isInteger(condition.lastProgressionYear))violations.push('condition.lastProgressionYear must be null or a finite integer: '+tag);if(state.lastTickYear!=null&&condition.lastProgressionYear!=null&&condition.lastProgressionYear>state.lastTickYear)violations.push('condition.lastProgressionYear cannot be later than medical.lastTickYear: '+tag);});return violations;}
  root.MedicalSystem={SCHEMA_VERSION,personKey,ageOf,yearOf,isSubjectLike:subjectLike,getHealth,getHealthCap,setHealth,applyHealthDelta:(person,amount,source,worldOrYear)=>setHealth(person,getHealth(person)+amount,source,worldOrYear),ensureMedicalState,normalizeCondition,syncLegacy,migrate:ensureMedicalState,checkInvariants,activeConditions,conditionByRef,addCondition,history,stream,contextFor,accessFor,exposureRisk,expose,examine,treatmentOptions,treatmentCost,treat,hoursPenalty,educationPenalty,workPenalty,summary,tickPerson,mortalityDetails,rollMortality};
})(globalThis);
