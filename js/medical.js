'use strict';

/* ================= MEDICAL FILE =================
   S.health remains the visible wellness index. This module owns the cause,
   progression, care, and consequences behind that number. */
const MEDICAL_CONDITIONS={
  respiratory:{name:'Respiratory complaint',note:'breath catches in cold weather',minAge:4,base:2,contagious:true,incubation:0,kind:'illness'},
  infection:{name:'Acute infection',note:'fever and exhaustion take hold',minAge:1,base:3,contagious:true,incubation:1,kind:'illness'},
  injury:{name:'Lingering injury',note:'pain returns with work and weather',minAge:6,base:3,contagious:false,incubation:0,kind:'injury'},
  strain:{name:'Nervous strain',note:'sleep is thin and easily broken',minAge:12,base:2,contagious:false,incubation:0,kind:'strain'},
  chronic:{name:'Chronic condition',note:'requires regular treatment',minAge:38,base:3,contagious:false,incubation:0,kind:'chronic'}
};

const MEDICAL_TREATMENTS={
  rest:{name:'Rest and recovery',baseCost:0,minQuality:0,relief:1,annualRelief:1,health:3,success:0.48,workPenalty:1},
  basic:{name:'Clinic treatment',baseCost:70,minQuality:0.25,relief:1,annualRelief:1,health:5,success:0.7,workPenalty:0},
  specialist:{name:'Specialist treatment',baseCost:200,minQuality:0.65,relief:2,annualRelief:1,health:9,success:0.9,workPenalty:0},
  unofficial:{name:'Unofficial care',baseCost:35,minQuality:0,relief:1,annualRelief:0,health:3,success:0.48,workPenalty:0,complicationRisk:0.14}
};

function medicalNow(){ return typeof currentYear==='function'?currentYear():(S?S.dob+S.age:0); }
function medicalRandom(random){ return random?random():Random.next(); }
function medicalInfo(id){ return MEDICAL_CONDITIONS[id]||MEDICAL_CONDITIONS.chronic; }
function medicalStateLabel(condition){
  const labels={latent:'not yet apparent',symptomatic:'symptomatic',diagnosed:'diagnosed',treated:'under treatment',remission:'in remission',chronic:'chronic',resolved:'resolved'};
  return labels[condition&&condition.state]||'on file';
}
function medicalSeverityLabel(value){ return value>=5?'critical':value>=4?'severe':value>=3?'moderate':value>=2?'mild':'slight'; }

function ensureMedicalState(subject){
  const s=subject||S; if(!s) return null;
  if(!s.medical||typeof s.medical!=='object') s.medical=typeof baseMedicalState==='function'?baseMedicalState(s.conditions):{schemaVersion:1,conditions:Array.isArray(s.conditions)?s.conditions:[]};
  const m=s.medical;
  if(m.schemaVersion==null) m.schemaVersion=1;
  if(m.resilience==null) m.resilience=50;
  if(!m.prevention) m.prevention={sanitation:0,vaccination:0,screening:0};
  if(!m.exposure) m.exposure={currentRisk:0,lastSource:null,lastYear:null};
  if(!Array.isArray(m.history)) m.history=[];
  if(!Array.isArray(m.conditions)) m.conditions=Array.isArray(s.conditions)?s.conditions:[];
  if(m.yearHoursPenalty==null) m.yearHoursPenalty=0;
  m.conditions.forEach(c=>medicalNormalizeCondition(c));
  s.conditions=m.conditions;
  return m;
}
function medicalNormalizeCondition(c){
  if(!c) return c;
  const info=medicalInfo(c.id);
  if(c.severity==null) c.severity=info.base;
  c.severity=clamp(Number(c.severity)||info.base,0,5);
  if(c.yearsActive==null) c.yearsActive=Number(c.years)||0;
  if(c.onsetAge==null) c.onsetAge=S?S.age:0;
  if(c.state==null) c.state=c.resolved?'resolved':(c.known?'diagnosed':'symptomatic');
  if(c.known==null) c.known=['diagnosed','treated','remission','chronic'].includes(c.state);
  if(c.treated==null) c.treated=c.state==='treated';
  if(c.resolved==null) c.resolved=c.state==='resolved';
  if(c.incubationLeft==null) c.incubationLeft=c.state==='latent'?(info.incubation||0):0;
  if(!Array.isArray(c.complications)) c.complications=[];
  return c;
}
function medicalSyncLegacy(subject){
  const s=subject||S, m=ensureMedicalState(s); if(!m) return;
  m.conditions.forEach(c=>{c.known=['diagnosed','treated','remission','chronic'].includes(c.state)||!!c.known;c.treated=c.state==='treated';c.resolved=c.state==='resolved';c.years=c.yearsActive;});
  s.conditions=m.conditions;
}
function activeConditions(subject){ const m=ensureMedicalState(subject||S); return m?m.conditions.filter(c=>c&&c.state!=='resolved'&&!c.resolved):[]; }
function conditionById(id,subject){ return activeConditions(subject||S).find(c=>c.id===id)||null; }
function medicalHistory(subject,kind,condition,note){
  const s=subject||S, m=ensureMedicalState(s); if(!m) return;
  m.history.push({year:medicalNow(),age:s.age,kind,conditionId:condition&&condition.id||null,note:note||''});
  if(m.history.length>24) m.history=m.history.slice(-24);
}

function medicalContext(subject){
  const s=subject||S; ensureMedicalState(s);
  const settlement=typeof currentSettlement==='function'?currentSettlement():null;
  const building=typeof currentBuilding==='function'?currentBuilding():null;
  const housing=typeof currentHousing==='function'?currentHousing():{id:s&&s.lifestyle&&s.lifestyle.housing||'basic'};
  const food=typeof currentFood==='function'?currentFood():{id:s&&s.lifestyle&&s.lifestyle.food||'basic'};
  return {subject:s,settlement,building,housing,food,year:medicalNow(),outbreak:World&&World.publicHealth&&World.publicHealth.outbreak||null};
}
function medicalAccessFor(subject,context){
  const ctx=context||medicalContext(subject), settlement=ctx.settlement, building=ctx.building;
  const facilities=settlement&&settlement.buildings?settlement.buildings.filter(b=>b.type==='clinic'):[];
  const atClinic=building&&building.type==='clinic';
  const selected=atClinic?building:(facilities&&facilities[0]);
  if(!selected) return {facility:'No local care',quality:0.12,costMultiplier:1.35,delay:1,atFacility:false};
  const hospital=/hospital/i.test(selected.name), city=settlement&&settlement.kind==='city', town=settlement&&settlement.kind==='town';
  const quality=hospital?0.9:(city?0.74:(town?0.59:0.45));
  return {facility:selected.name,quality,costMultiplier:hospital?1.25:(city?1:0.78),delay:atClinic?0:(quality<0.55?1:0),atFacility:!!atClinic};
}
function medicalExposureRisk(subject,conditionId,context){
  const s=subject||S, m=ensureMedicalState(s), ctx=context||medicalContext(s), house=ctx.housing||{}, food=ctx.food||{};
  let risk=0;
  if(conditionId==='respiratory'||conditionId==='infection'){
    risk+=house.id==='none'?0.12:house.id==='room'?0.04:0;
    risk+=food.id==='meager'?0.055:0;
    if(ctx.outbreak&&(ctx.outbreak.conditions||[]).includes(conditionId)) risk+=0.06*(ctx.outbreak.severity||1);
    if(s.age<6||s.age>=65) risk+=0.018;
    if(s.kids>0) risk+=0.012;
  }
  if(conditionId==='strain'){
    risk+=(s.jobTier>0?0.012:0)+(s.vice>=4?0.018:0)+(s.happiness<35?0.018:0);
    if(s.career==='medicine'||s.career==='care') risk+=0.018;
  }
  if(conditionId==='injury'){
    const job=(s.jobName||'').toLowerCase();
    if(/machin|carpent|factory|foundry|driver|transport|farm|athlet|warehouse|constr|conscript/.test(job)) risk+=0.022;
    if(s.career==='trade'||s.career==='transport'||s.career==='athletics'||s.career==='agriculture') risk+=0.018;
  }
  if(conditionId==='chronic'&&s.age>=45) risk+=0.008+(s.age-45)*0.0008;
  risk-=((m.resilience||50)-50)*0.0007;
  risk-=(m.prevention.sanitation||0)*0.008+(m.prevention.vaccination||0)*0.01;
  return clamp(risk,0,0.32);
}
function addCondition(id,severity,options){
  const opts=options||{}, s=opts.subject||S; if(!s||!MEDICAL_CONDITIONS[id]) return null;
  const m=ensureMedicalState(s), existing=conditionById(id,s), info=medicalInfo(id);
  if(existing){ existing.severity=clamp(Math.max(existing.severity||1,severity||1),1,5); if(opts.source) existing.source=opts.source; return existing; }
  const latent=opts.state==='latent'||opts.incubation>0;
  const rec={id,severity:clamp(severity||info.base,1,5),state:latent?'latent':(opts.state||'symptomatic'),known:opts.known===true,treated:false,resolved:false,
    onsetAge:s.age,diagnosedAge:null,resolvedAge:null,source:opts.source||'unclassified',exposureType:opts.exposureType||info.kind,
    contagious:opts.contagious==null?!!info.contagious:opts.contagious,treatment:null,adherence:0,yearsActive:0,years:0,
    incubationLeft:opts.incubation==null?(latent?(info.incubation||1):0):opts.incubation,complications:[]};
  m.conditions.push(rec); medicalSyncLegacy(s); medicalHistory(s,'onset',rec,rec.source); return rec;
}
function medicalExpose(subject,spec,context,random){
  const s=subject||S, cfg=typeof spec==='string'?{conditionId:spec}:(spec||{}), id=cfg.conditionId||cfg.id;
  if(!s||!MEDICAL_CONDITIONS[id]) return null;
  const risk=cfg.force?1:(cfg.risk==null?medicalExposureRisk(s,id,context):cfg.risk);
  if(medicalRandom(random)>=risk) return null;
  const c=addCondition(id,cfg.severity,{subject:s,source:cfg.source||'exposure',exposureType:cfg.exposureType,incubation:cfg.incubation,known:cfg.known});
  const m=ensureMedicalState(s); m.exposure={currentRisk:risk,lastSource:cfg.source||id,lastYear:medicalNow()};
  return c;
}
function medicalEventExposure(spec,subject){ return medicalExpose(subject||S,Object.assign({force:true},spec||{}),medicalContext(subject||S)); }

function medicalExamination(source){
  if(!S) return {condition:null,found:false,text:'No subject is currently on file.'};
  const m=ensureMedicalState(S), ctx=medicalContext(S); S.medicalRecord=true; m.lastCheckupAge=S.age;
  let condition=activeConditions(S).filter(c=>!c.known).sort((a,b)=>b.severity-a.severity)[0];
  if(!condition){
    const risk=(S.health<58?0.35:0)+(S.age>=45?0.15:0)+(S.vice>=4?0.12:0)+(ctx.food.id==='meager'?0.15:0)+(m.exposure.currentRisk||0);
    if(chance(Math.min(.68,.08+risk))){
      const choices=Object.keys(MEDICAL_CONDITIONS).filter(id=>S.age>=MEDICAL_CONDITIONS[id].minAge);
      condition=addCondition(pick(choices),S.health<38?4:undefined,{source:'screening examination'});
    }
  }
  if(condition){
    condition.known=true; condition.diagnosedAge=S.age; if(condition.state==='latent') condition.state='diagnosed'; else if(condition.state!=='chronic') condition.state='diagnosed';
    medicalHistory(S,'diagnosis',condition,source||'doctor'); medicalSyncLegacy(S);
    const access=medicalAccessFor(S,ctx);
    return {condition,found:true,access,text:'The examination entered '+medicalInfo(condition.id).name.toLowerCase()+' in the medical file. '+access.facility+' can offer care.'};
  }
  return {condition:null,found:false,access:medicalAccessFor(S,ctx),text:source==='desk'?'The inspection found no condition requiring a treatment order. The Bureau filed the clean page.':'The doctor found nothing urgent. The visit still goes into the medical file.'};
}
function medicalTreatmentOptions(id,subject){
  const s=subject||S, c=conditionById(id,s); if(!c||!c.known) return [];
  const access=medicalAccessFor(s,medicalContext(s));
  return Object.entries(MEDICAL_TREATMENTS).filter(([id,t])=>t.minQuality<=access.quality||id==='rest').map(([id,t])=>Object.assign({id,cost:medicalTreatmentCost(c,t,access)},t));
}
function medicalTreatmentCost(condition,treatment,access){ return Math.round((treatment.baseCost||0)*(1+(Math.max(1,condition.severity)-1)*0.24)*(access.costMultiplier||1)); }
function treatCondition(id,treatmentId){
  const c=conditionById(id,S); if(!c||!c.known) return null;
  const access=medicalAccessFor(S,medicalContext(S));
  const treatment=MEDICAL_TREATMENTS[treatmentId||'basic']||MEDICAL_TREATMENTS.basic;
  if(treatment.minQuality>access.quality) return {blocked:true,cost:0,resolved:false,text:'That treatment is not available through '+access.facility+'.'};
  const cost=medicalTreatmentCost(c,treatment,access);
  c.treatment=treatmentId||'basic'; c.treated=true; c.adherence=1; c.state='treated'; c.severity=Math.max(0,c.severity-treatment.relief);
  const success=chance(treatment.success);
  if(success&&c.severity===0){ c.state='resolved'; c.resolved=true; c.resolvedAge=S.age; medicalHistory(S,'recovery',c,treatment.name); }
  else if(!success&&treatment.complicationRisk&&chance(treatment.complicationRisk)){ c.complications.push('treatment setback'); c.severity=clamp(c.severity+1,1,5); }
  ensureMedicalState(S).lastTreatmentAge=S.age; medicalHistory(S,'treatment',c,treatment.name); medicalSyncLegacy(S);
  const info=medicalInfo(c.id);
  if(c.resolved) return {cost,health:treatment.health+2,resolved:true,condition:c,treatment,text:treatment.name+' cleared the '+info.name.toLowerCase()+'. The medical file is amended, not erased.'};
  return {cost,health:treatment.health,resolved:false,condition:c,treatment,text:treatment.name+' eased the '+info.name.toLowerCase()+'. It remains on file, but no longer has the whole say.'};
}

function medicalApplyHealthDelta(subject,amount,source){
  const s=subject||S; if(!s||!amount) return;
  const cap=s.healthCap==null?100:s.healthCap; s.health=clamp(s.health+amount,0,cap);
  const m=ensureMedicalState(s); if(m){ m.lastHealthSource=source||'general'; m.lastHealthAge=s.age; }
}
function medicalHoursPenalty(subject){ const m=ensureMedicalState(subject||S); return m?clamp(m.yearHoursPenalty||0,0,2):0; }
function medicalEducationPenalty(subject){ return activeConditions(subject||S).reduce((n,c)=>n+(c.state==='symptomatic'||c.state==='diagnosed'?Math.max(0,c.severity-2)*3:0),0); }
function medicalWorkPenalty(subject){ return activeConditions(subject||S).reduce((n,c)=>n+(c.severity>=4?1:0),0); }
function medicalSummary(subject){
  const s=subject||S, conditions=activeConditions(s), access=medicalAccessFor(s,medicalContext(s));
  return {conditions,access,resilience:ensureMedicalState(s).resilience,penalty:medicalHoursPenalty(s)};
}

function medicalStartOutbreak(id,severity,years){
  if(!World) return null;
  const conditions=id==='influenza'?['respiratory','infection']:(id==='waterborne'?['infection']:[id||'respiratory']);
  World.publicHealth={outbreak:{id:id||'seasonal illness',severity:severity||1,conditions,endYear:medicalNow()+(years||1)},lastNoticeYear:medicalNow()};
  return World.publicHealth.outbreak;
}
function medicalTickOutbreak(){
  if(!World||!World.publicHealth||!World.publicHealth.outbreak) return;
  if(medicalNow()>World.publicHealth.outbreak.endYear) World.publicHealth.outbreak=null;
}

function runPersonalYearTick(){
  if(!S) return; ensurePersonalSystems(S); const m=ensureMedicalState(S), ctx=medicalContext(S); m.yearHoursPenalty=0; medicalTickOutbreak();
  const newConditions=[];
  ['respiratory','infection','injury','strain','chronic'].forEach(id=>{ if(conditionById(id,S)) return; const source=id==='injury'?'occupational strain':(ctx.outbreak?'public-health outbreak':'living conditions'); const c=medicalExpose(S,{conditionId:id,source},ctx); if(c) newConditions.push(c); });
  let healthHit=0, happinessHit=0;
  activeConditions(S).forEach(c=>{
    const info=medicalInfo(c.id); c.yearsActive++; c.years=c.yearsActive;
    if(c.state==='latent'){
      c.incubationLeft--;
      if(c.incubationLeft<=0){ c.state='symptomatic'; c.known=false; medicalHistory(S,'symptom',c,info.name); }
      return;
    }
    if(c.state==='treated'&&c.treated){
      c.severity=Math.max(0,c.severity-(MEDICAL_TREATMENTS[c.treatment]||MEDICAL_TREATMENTS.basic).annualRelief);
      c.treated=false;
      if(c.severity===0){ c.state='resolved'; c.resolved=true; c.resolvedAge=S.age; medicalHistory(S,'recovery',c,'treatment held'); return; }
      c.state=c.id==='chronic'?'chronic':'remission';
      return;
    }
    const burden=Math.max(1,Math.ceil(c.severity/2));
    healthHit-=burden; happinessHit-=c.id==='strain'?burden:Math.max(0,burden-1);
    if(c.severity>=4) m.yearHoursPenalty=Math.max(m.yearHoursPenalty,1);
    if(c.severity>=5) m.yearHoursPenalty=2;
    if((c.id==='respiratory'||c.id==='infection')&&c.yearsActive>=3&&chance(0.12)){ c.state='chronic'; c.id='chronic'; c.severity=Math.max(2,c.severity-1); c.known=true; medicalHistory(S,'chronic',c,'repeated untreated illness'); }
  });
  if(healthHit||happinessHit){
    const fx={}; if(healthHit) fx.health=healthHit; if(happinessHit) fx.happiness=happinessHit;
    if(typeof applyFx==='function'){
      const chips=applyFx(fx); if(typeof logChips==='function') logChips('The medical file recorded an ongoing burden on the subject’s body.',chips,'medical','MEDICAL REVIEW · YEAR '+S.age);
    }else { if(healthHit) medicalApplyHealthDelta(S,healthHit,'medical progression'); if(happinessHit) S.happiness=clamp(S.happiness+happinessHit,0,100); }
  }
  newConditions.filter(c=>c.state!=='latent').forEach(c=>{ if(typeof logEv==='function') logEv('MEDICAL NOTICE. '+medicalInfo(c.id).name+' was entered as a new concern. The symptoms are not yet fully understood.',{},'medical','MEDICAL REVIEW · YEAR '+S.age); });
  const misconduct=(S.record?7:0)+S.crime*4+S.vice*1.5;
  const cooling=S.bureauFavor>0?2:4;
  S.scrutiny=clamp(Math.round(S.scrutiny+misconduct-cooling),0,100);
  if(S.age>=18&&!S.record&&S.vice<=1&&S.scrutiny<20&&medicalNow()-S.lastFavorYear>=5){
    S.bureauFavor=Math.min(3,S.bureauFavor+1); S.lastFavorYear=medicalNow();
    if(typeof logEv==='function') logEv('The file remained unremarkable long enough to earn a small Bureau Favor. It is not kindness, but it can be spent.',{},'ruling','PERSONAL STANDING');
  }
  medicalSyncLegacy(S); updatePersonalStanding();
}

function medicalMortalityDetails(subject){
  const s=subject||S, conditions=activeConditions(s); let risk=0, cause=null;
  conditions.forEach(c=>{
    const severe=c.severity>=4, untreated=c.state!=='treated'&&c.state!=='remission';
    if(severe&&untreated){ risk+=(c.severity-3)*0.007+(c.yearsActive||0)*0.0015; cause=c.id==='injury'?'complications from an untreated injury':c.id==='chronic'?'complications from a chronic condition':'an untreated '+medicalInfo(c.id).name.toLowerCase(); }
  });
  return {risk:clamp(risk,0,0.16),cause};
}
