'use strict';

/* Player compatibility adapter. Reusable care mechanics live in MedicalSystem. */
const MEDICAL_CONDITIONS=ConditionRegistry.CONDITIONS;
const MEDICAL_TREATMENTS=ConditionRegistry.TREATMENTS;
function medicalNow(){ return typeof currentYear==='function'?currentYear():(typeof S!=='undefined'&&S?S.dob+S.age:0); }
function medicalInfo(id){ return ConditionRegistry.condition(id)||{id:String(id||''),name:'Unrecognized condition',note:'legacy medical entry',minAge:0,base:1,contagious:false,incubation:0,kind:'unknown',stackPolicy:'merge'}; }
function medicalStateLabel(condition){ const labels={latent:'not yet apparent',symptomatic:'symptomatic',diagnosed:'diagnosed',treated:'under treatment',remission:'in remission',chronic:'chronic',resolved:'resolved'}; return labels[condition&&condition.state]||'on file'; }
function medicalSeverityLabel(value){ return value>=5?'critical':value>=4?'severe':value>=3?'moderate':value>=2?'mild':'slight'; }
function medicalWorld(){ return typeof World!=='undefined'?World:null; }
function medicalSubject(subject){ return subject||(typeof S!=='undefined'?S:null); }
function ensureMedicalState(subject){ const person=medicalSubject(subject); return person?MedicalSystem.ensureMedicalState(person,{world:medicalWorld(),year:medicalNow()}):null; }
function medicalNormalizeCondition(condition,subject){ const person=medicalSubject(subject); return person&&condition?MedicalSystem.normalizeCondition(person,condition,{world:medicalWorld(),year:medicalNow()}):condition; }
function medicalSyncLegacy(subject){ const person=medicalSubject(subject); return person?MedicalSystem.syncLegacy(person):null; }
function activeConditions(subject){ const person=medicalSubject(subject); return person?MedicalSystem.activeConditions(person):[]; }
function conditionById(reference,subject){ const person=medicalSubject(subject); return person?MedicalSystem.conditionByRef(person,reference):null; }
function medicalHistory(subject,kind,condition,note){ const person=medicalSubject(subject); return person?MedicalSystem.history(person,kind,condition,note,{world:medicalWorld(),year:medicalNow()}):null; }
function medicalContext(subject){ const person=medicalSubject(subject); if(!person)return MedicalSystem.contextFor(medicalWorld(),person,{}); ensureMedicalState(person); const world=medicalWorld(),settlement=typeof currentSettlement==='function'?currentSettlement():null,building=typeof currentBuilding==='function'?currentBuilding():null,housing=typeof currentHousing==='function'?currentHousing():{id:person.lifestyle&&person.lifestyle.housing||'basic'},food=typeof currentFood==='function'?currentFood():{id:person.lifestyle&&person.lifestyle.food||'basic'},runtime=world&&settlement&&typeof WorldSimulation!=='undefined'&&WorldSimulation&&typeof WorldSimulation.getSettlementState==='function'?WorldSimulation.getSettlementState(world,settlement.id):null,pressure=runtime&&typeof PublicHealth!=='undefined'&&PublicHealth&&typeof PublicHealth.pressure==='function'?PublicHealth.pressure(runtime):0,outbreak=world&&world.publicHealth&&world.publicHealth.outbreak||null; return MedicalSystem.contextFor(world,person,{year:medicalNow(),settlement,runtime,building,housing,food,outbreak,healthcarePressure:pressure}); }
function medicalAccessFor(subject,context){ const person=medicalSubject(subject); return person?MedicalSystem.accessFor(medicalWorld(),person,context||medicalContext(person)):null; }
function medicalExposureRisk(subject,conditionId,context){ const person=medicalSubject(subject); return person?MedicalSystem.exposureRisk(medicalWorld(),person,conditionId,context||medicalContext(person)):0; }
function addCondition(id,severity,options){ const opts=options||{},person=opts.subject||medicalSubject(); return person?MedicalSystem.addCondition(person,id,severity,Object.assign({},opts,{world:medicalWorld(),year:medicalNow()})):null; }
function medicalExpose(subject,spec,context,random){ const person=medicalSubject(subject); return person?MedicalSystem.expose(medicalWorld(),person,spec,context||medicalContext(person),random?{rng:random}:{}):null; }
function medicalEventExposure(spec,subject){ return medicalExpose(subject||medicalSubject(),Object.assign({force:true},spec||{}),medicalContext(subject||medicalSubject())); }
function medicalExamination(source){ const person=medicalSubject(); if(!person)return {condition:null,found:false,text:'No subject is currently on file.'}; const result=MedicalSystem.examine(medicalWorld(),person,medicalContext(person),{source:source||'doctor'}),access=result.access;if(result.found)return Object.assign(result,{text:'The examination entered '+medicalInfo(result.condition.id).name.toLowerCase()+' in the medical file. '+access.facility+' can offer care.'});return Object.assign(result,{text:source==='desk'?'The inspection found no condition requiring a treatment order. The Bureau filed the clean page.':'The doctor found nothing urgent. The visit still goes into the medical file.'}); }
function medicalTreatmentOptions(reference,subject){ const person=medicalSubject(subject); return person?MedicalSystem.treatmentOptions(medicalWorld(),person,reference,medicalContext(person)):[]; }
function medicalTreatmentCost(condition,treatment,access){ return MedicalSystem.treatmentCost(condition,treatment,access); }
function treatCondition(reference,treatmentId){ const person=medicalSubject(); if(!person)return null; const result=MedicalSystem.treat(medicalWorld(),person,reference,treatmentId,medicalContext(person)); if(result.blocked)return Object.assign(result,{text:'That treatment is not available through '+result.access.facility+'.'}); const info=medicalInfo(result.condition.id),text=result.resolved?result.treatment.name+' cleared the '+info.name.toLowerCase()+'. The medical file is amended, not erased.':result.treatment.name+' eased the '+info.name.toLowerCase()+'. It remains on file, but no longer has the whole say.'; return Object.assign(result,{text}); }
function medicalApplyHealthDelta(subject,amount,source){ const person=medicalSubject(subject); return person?MedicalSystem.applyHealthDelta(person,amount,source,medicalWorld()||medicalNow()):null; }
function medicalHoursPenalty(subject){ const person=medicalSubject(subject); return person?MedicalSystem.hoursPenalty(person):0; }
function medicalEducationPenalty(subject){ const person=medicalSubject(subject); return person?MedicalSystem.educationPenalty(person):0; }
function medicalWorkPenalty(subject){ const person=medicalSubject(subject); return person?MedicalSystem.workPenalty(person):0; }
function medicalSummary(subject){ const person=medicalSubject(subject); return person?MedicalSystem.summary(medicalWorld(),person,medicalContext(person)):null; }

function medicalStartOutbreak(id,severity,years){ if(!medicalWorld()) return null; const conditions=id==='influenza'?['respiratory','infection']:(id==='waterborne'?['infection']:[id||'respiratory']); World.publicHealth={outbreak:{id:id||'seasonal illness',severity:severity||1,conditions,endYear:medicalNow()+(years||1)},lastNoticeYear:medicalNow()}; return World.publicHealth.outbreak; }
function medicalTickOutbreak(){ if(!medicalWorld()||!World.publicHealth||!World.publicHealth.outbreak) return; if(medicalNow()>World.publicHealth.outbreak.endYear) World.publicHealth.outbreak=null; }
function runPersonalYearTick(){
  if(!S) return;
  if(typeof ensurePersonalSystems==='function') ensurePersonalSystems(S);
  medicalTickOutbreak();
  const ctx=medicalContext(S);
  const result=MedicalSystem.tickPerson(medicalWorld(),S,ctx);
  if(!result.applied) return result;
  const healthHit=result.healthDelta, happinessHit=result.happinessDelta;
  if(healthHit||happinessHit){
    const fx={};
    if(healthHit) fx.health=healthHit;
    if(happinessHit) fx.happiness=happinessHit;
    if(typeof applyFx==='function'){
      const chips=applyFx(fx);
      if(typeof logChips==='function') logChips('The medical file recorded an ongoing burden on the subject’s body.',chips,'medical','MEDICAL REVIEW · YEAR '+S.age);
    }else{
      if(healthHit) medicalApplyHealthDelta(S,healthHit,'medical progression');
      if(happinessHit) S.happiness=clamp(S.happiness+happinessHit,0,100);
    }
  }
  result.newConditions.filter(c=>c.state!=='latent').forEach(c=>{
    if(typeof logEv==='function') logEv('MEDICAL NOTICE. '+medicalInfo(c.id).name+' was entered as a new concern. The symptoms are not yet fully understood.',{},'medical','MEDICAL REVIEW · YEAR '+S.age);
  });
  medicalSyncLegacy(S);
  return result;
}
function medicalMortalityDetails(subject){ const person=medicalSubject(subject); return MedicalSystem.mortalityDetails(medicalWorld(),person,medicalContext(person)); }
function medicalMortalityRoll(subject){ const person=medicalSubject(subject); return MedicalSystem.rollMortality(medicalWorld(),person,medicalContext(person)); }
