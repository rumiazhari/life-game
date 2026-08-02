'use strict';
/* ================= EDUCATION WORLD =================
   Institutions are generated once from settlement-specific counts. The
   existing SCHOOL_STAGES remain the progression rules; this catalog supplies
   the actual place, price, quality, specialties, and university majors.
*/
const EDUCATION_CONFIG={
  branec:{lower:3,middle:2,upper:3,universities:[
    {name:'National University of Karsen',quality:1.08,tuition:620,majors:['law','education','business']},
    {name:'Branec Institute of Engineering',quality:1.04,tuition:680,majors:['engineering','architecture']},
    {name:'Civic and Arts College',quality:1.01,tuition:560,majors:['arts','business','education']}]},
  veskar:{lower:2,middle:2,upper:2,universities:[
    {name:'Veskar Maritime College',quality:1.03,tuition:540,majors:['maritime','business','engineering']},
    {name:'Coastal School of Commerce',quality:.96,tuition:480,majors:['business','law']}]},
  eisenmark:{lower:2,middle:2,upper:2,universities:[
    {name:'Eisenmark Technical Institute',quality:1.02,tuition:500,majors:['engineering','architecture']},
    {name:'Iron Country Polytechnic',quality:.94,tuition:430,majors:['engineering','business']}]},
  kostrin:{lower:2,middle:2,upper:2,universities:[
    {name:'Kostrin College of Medicine',quality:1.16,tuition:720,majors:['medicine','nursing']},
    {name:'Kostrin University of Letters',quality:1.10,tuition:610,majors:['law','education','arts']},
    {name:'Kostrin School of Public Health',quality:1.08,tuition:650,majors:['medicine','nursing','education']}]},
  rudava:{lower:2,middle:1,upper:2,universities:[
    {name:'Rudava Railway Institute',quality:.98,tuition:460,majors:['engineering','business']}]},
  dobraven:{lower:2,middle:1,upper:1},
  krasnava:{lower:2,middle:1,upper:1},
  brezin:{lower:2,middle:1,upper:1},
  lindava:{lower:2,middle:1,upper:1},
  sundervik:{lower:2,middle:1,upper:1},
  oberhain:{lower:1,middle:1,upper:1},
  marec:{lower:2,middle:1,upper:1},
  kamenor:{lower:2,middle:1,upper:1},
  svetlin:{lower:2,middle:1,upper:1}
};

const MAJORS={
  medicine:{name:'Medicine',skills:['care','academics'],careers:['medicine']},
  nursing:{name:'Nursing and Care',skills:['care'],careers:['medicine','care']},
  engineering:{name:'Engineering',skills:['craft','design'],careers:['engineering']},
  architecture:{name:'Architecture and Design',skills:['design','arts'],careers:['architecture']},
  law:{name:'Law and Civil Service',skills:['academics','social'],careers:['law','diplomacy']},
  education:{name:'Education',skills:['academics','care'],careers:['academia']},
  business:{name:'Business and Finance',skills:['academics','social'],careers:['business']},
  agriculture:{name:'Agriculture and Land',skills:['land','social'],careers:['agriculture']},
  maritime:{name:'Maritime Studies',skills:['craft','social'],careers:['transport']},
  arts:{name:'Arts and Performance',skills:['arts','social'],careers:['arts']}
};
const CAREER_MAJOR_REQUIREMENTS={
  medicine:'medicine',engineering:'engineering',architecture:'architecture',
  law:'law',diplomacy:'law',academia:'education'
};
const CAREER_STAGE_MAJOR_REQUIREMENTS={
  medicine:{0:null,1:['nursing','medicine'],2:'medicine',3:'medicine',4:'medicine'},
  care:{0:null,1:null,2:null,3:'nursing',4:'nursing'}
};
const CAREER_STAGE_EDUCATION_REQUIREMENTS={
  medicine:{0:'middle',1:'middle',2:'university',3:'university',4:'university'},
  law:{0:'university',1:'university',2:'university',3:'university',4:'university'},
  engineering:{0:'university',1:'university',2:'university',3:'university',4:'university'},
  architecture:{0:'university',1:'university',2:'university',3:'university',4:'university'},
  diplomacy:{0:'university',1:'university',2:'university',3:'university',4:'university'},
  academia:{0:'university',1:'university',2:'university',3:'university',4:'university'},
  care:{0:'middle',1:'middle',2:'middle',3:'middle',4:'middle'},
  business:{0:'upper',1:'upper',2:'upper',3:'upper',4:'upper'},
  trade:{0:null,1:null,2:null,3:null,4:null},
  transport:{0:null,1:null,2:null,3:null,4:null}
};
const CAREER_GENERAL_DEGREE_TRACKS=new Set(['business']);
const CAREER_PATH_LABELS={
  medicine:'Care support → Nursing or Medicine → Physician',
  care:'Care support → Nursing leadership',
  business:'General university degree → Business & Finance',
  trade:'Apprenticeship or skill route → Trade & Industry',
  transport:'Transport certificate or skill route → Transport & Logistics',
  engineering:'Engineering degree → Engineering',
  architecture:'Architecture degree → Architecture & Design',
  law:'Law degree → Law & Civil Service',
  diplomacy:'Law degree → Foreign Service',
  academia:'Education degree → Academia'
};
const EDUCATION_TRAINING_CAPS={lower:3,middle:5,upper:7,university:10};
const EDUCATION_SKILL_CAPS=[1,3,5,7,10];
const EDUCATION_FUNDING={
  family:{id:'family',label:'Family funding',short:'family pays',kind:'family',rate:0,desc:'Guardians cover the listed tuition while the subject remains supported.'},
  scholarship:{id:'scholarship',label:'Scholarship',short:'funded place',kind:'aid',rate:0,desc:'A funded place removes tuition, but admission is competitive.'},
  grant:{id:'grant',label:'Public grant',short:'public grant',kind:'aid',rate:.35,desc:'A public grant covers part of tuition and leaves a smaller bill.'},
  self:{id:'self',label:'Pay from assets',short:'self-funded',kind:'self',rate:1,desc:'Pay the full yearly tuition from the subject\'s assets.'},
  studentloan:{id:'studentloan',label:'Student loan',short:'loan-backed',kind:'debt',rate:0,desc:'The full tuition is borrowed and becomes a repayable education debt.'},
  workstudy:{id:'workstudy',label:'Work-study',short:'work-study',kind:'work',rate:.55,desc:'A reduced bill trades comfort and time for a partial tuition payment.'}
};
const VOCATIONAL_PROGRAMS=[
  {id:'care_certificate',name:'Care Certificate',career:'care',skill:'care',gain:2,tuition:180,minAge:16,requires:'middle',desc:'Practical patient care, ward routine, and supervised responsibility.'},
  {id:'trade_certificate',name:'Trade Certificate',career:'trade',skill:'craft',gain:2,tuition:210,minAge:16,requires:'middle',desc:'Workshop safety, tools, and the first reliable trade credential.'},
  {id:'transport_certificate',name:'Transport Certificate',career:'transport',skill:'craft',gain:2,tuition:200,minAge:16,requires:'middle',desc:'Route work, vehicle handling, and the paperwork behind movement.'},
  {id:'accounting_certificate',name:'Accounting Certificate',career:'business',skill:'academics',gain:2,tuition:240,minAge:17,requires:'upper',desc:'Ledgers, payroll, and the arithmetic employers trust.'}
];

const EDUCATION_INSTITUTIONS=[];
function educationSettlementName(id){ const s=settlementById(id); return s?s.name:id; }
function educationSchoolSpecialties(settlementId,stage,index){
  const s=settlementById(settlementId), region=(s&&s.region||'').toLowerCase();
  const pools=region.includes('farmland')?['land','care']:
    region.includes('forest')?['craft','land']:
    region.includes('iron')?['craft','design']:
    region.includes('coast')?['social','craft']:
    region.includes('eastern')?['academics','craft']:
    region.includes('parishes')?['care','academics']:
    ['academics','social','arts'];
  const first=pools[index%pools.length], second=pools[(index+1)%pools.length];
  return stage==='upper'?[first,second]:[first];
}
function buildEducationCatalog(){
  if(EDUCATION_INSTITUTIONS.length) return;
  KARSEN_SETTLEMENTS.forEach(s=>{
    const cfg=EDUCATION_CONFIG[s.id]||{lower:1,middle:1,upper:1};
    ['lower','middle','upper'].forEach(stage=>{
      const count=cfg[stage]||0;
      for(let i=0;i<count;i++){
        const base=stage==='lower'?42:stage==='middle'?68:stage==='upper'?110:0;
        EDUCATION_INSTITUTIONS.push({
          id:s.id+'-'+stage+'-'+(i+1),settlementId:s.id,type:stage,
          name:educationSettlementName(s.id)+' '+(stage==='lower'?'Lower School':stage==='middle'?'Middle School':'Upper School')+' '+(i+1),
          capacity:stage==='lower'?180:stage==='middle'?140:110,
          tuition:Math.round(base*(1+i*.08)),
          quality:clamp((s.kind==='city'?1.02:s.kind==='town'?.96:.90)+((i%3)-1)*.035,0.78,1.18),
          specialties:educationSchoolSpecialties(s.id,stage,i),majors:[],boarding:false
        });
      }
    });
    (cfg.universities||[]).forEach((u,i)=>EDUCATION_INSTITUTIONS.push({
      id:s.id+'-university-'+(i+1),settlementId:s.id,type:'university',name:u.name,
      capacity:240+i*80,tuition:u.tuition,quality:u.quality,specialties:[],majors:u.majors||[],boarding:true
    }));
  });
}
buildEducationCatalog();

function educationSyncLegacy(s){
  if(!s||!s.education) return null;
  const e=s.education;
  const legacyCompleted=s.eduCompleted&&typeof s.eduCompleted==='object'?s.eduCompleted:{};
  if(!e.completed||typeof e.completed!=='object'||(!Object.keys(e.completed).length&&Object.keys(legacyCompleted).length)) e.completed=Object.assign({},legacyCompleted);
  if(e.stageId==null&&s.eduStage&&e.status!=='graduated'&&e.status!=='withdrawn') e.stageId=s.eduStage;
  if(!e.yearsIn&&s.eduYearsIn&&e.stageId&&e.status!=='enrolled') e.yearsIn=s.eduYearsIn;
  if(e.withdrawn==null) e.withdrawn=!!s.eduDropped;
  if(e.stageId) e.status='enrolled';
  s.eduStage=e.stageId||null;
  s.eduYearsIn=Number(e.yearsIn)||0;
  s.eduCompleted=e.completed;
  s.eduDropped=!!e.withdrawn;
  s.edu=!!e.completed.university;
  return e;
}
function ensureEducationState(s){
  if(!s) return null;
  if(!Array.isArray(s.liabilities)) s.liabilities=[];
  if(!s.education) s.education={};
  const e=s.education;
  if(e.institutionId==null) e.institutionId=null;
  if(e.stageId==null) e.stageId=null;
  if(e.majorId==null) e.majorId=null;
  if(e.status==null) e.status=null;
  if(e.yearsIn==null) e.yearsIn=0;
  if(e.tuitionDebt==null) e.tuitionDebt=0;
  if(e.travelDebt==null) e.travelDebt=0;
  if(e.funding==null) e.funding=null;
  if(e.residenceMode==null) e.residenceMode=s.residenceMode||null;
  if(e.pendingResidenceSettlementId==null) e.pendingResidenceSettlementId=null;
  if(e.skillFloors==null) e.skillFloors={};
  if(e.smartsRemainder==null) e.smartsRemainder=0;
  if(e.completed==null) e.completed={};
  if(e.certificates==null) e.certificates={};
  if(e.history==null) e.history=[];
  if(e.lastOpportunityYear==null) e.lastOpportunityYear={};
  if(e.missedStages==null) e.missedStages={};
  if(e.performance==null) e.performance=50;
  if(e.attendance==null) e.attendance=100;
  if(s.birthSettlementId==null) s.birthSettlementId=s.location&&s.location.settlementId||World.activeSettlementId;
  if(s.familyHomeSettlementId==null) s.familyHomeSettlementId=s.birthSettlementId;
  if(s.residenceSettlementId==null) s.residenceSettlementId=World.activeSettlementId;
  if(s.residenceMode==null) s.residenceMode=s.livingAtHome===false?'independent':'family';
  educationSyncLegacy(s);
  return e;
}
function educationSkillCapFor(subject){
  const target=subject||S;
  if(!target) return 1;
  const e=target.education||{};
  let rank=0;
  SCHOOL_STAGES.forEach((st,index)=>{ if(e.completed&&e.completed[st.id]) rank=index+1; });
  const activeId=e.stageId||target.eduStage;
  if(activeId){
    const active=SCHOOL_STAGES.findIndex(st=>st.id===activeId);
    if(active>=0) rank=Math.max(rank,active+1);
  }
  return EDUCATION_SKILL_CAPS[clamp(rank,0,EDUCATION_SKILL_CAPS.length-1)];
}
function normalizeSkillsToEducationCap(subject){
  const target=subject||S;
  if(!target||!target.skills) return;
  const cap=educationSkillCapFor(target);
  Object.keys(target.skills).forEach(id=>{ target.skills[id]=clamp(target.skills[id]||0,0,cap); });
}
function educationStagePrerequisite(stage){
  const index=SCHOOL_STAGES.findIndex(s=>s.id===stage.id);
  return index>0?SCHOOL_STAGES[index-1]:null;
}
function educationStageAgeAvailable(stage,subject){
  const target=subject||S, age=target&&Number(target.age);
  return !!stage&&Number.isFinite(age)&&age>=stage.startAge&&age<=stage.endAge;
}
function educationStageAvailable(stage,subject){
  const target=subject||S, e=target&&target.education?target.education:ensureEducationState(target);
  const prerequisite=educationStagePrerequisite(stage);
  return !prerequisite||!!(e&&e.completed&&e.completed[prerequisite.id]);
}
function educationStageWasMissed(stage,subject){
  const target=subject||S, e=target&&target.education?target.education:ensureEducationState(target);
  return !!(stage&&e&&e.missedStages&&e.missedStages[stage.id]);
}
function educationMarkStageMissed(stage,subject,note){
  const target=subject||S, e=ensureEducationState(target);
  if(!stage||!e||e.missedStages[stage.id]) return false;
  e.missedStages[stage.id]=true;
  e.lastOpportunityYear[stage.id]=Number(target.age)||0;
  e.history.push({kind:'missed',stage:stage.id,year:currentYear(),age:Number(target.age)||0,note:note||'The enrollment window passed without a completed course.'});
  return true;
}
function educationMigratePassedOpportunity(stage,subject){
  const target=subject||S, e=ensureEducationState(target), age=Number(target&&target.age), prior=Number(e&&e.lastOpportunityYear&&e.lastOpportunityYear[stage&&stage.id]);
  if(!stage||!e||!Number.isFinite(age)||!Number.isFinite(prior)||prior<=0||prior>=age||e.completed[stage.id]||e.missedStages[stage.id]) return false;
  return educationMarkStageMissed(stage,target,'A previous enrollment opportunity was already passed before this record was updated.');
}
function educationSkillFloor(skillId,subject){
  const target=subject||S;
  return target&&target.education&&target.education.skillFloors?target.education.skillFloors[skillId]||0:0;
}
function educationRecordSkill(skillId,level){
  ensureEducationState(S);
  if(!skillId) return;
  S.education.skillFloors[skillId]=Math.max(educationSkillFloor(skillId),level||S.skills[skillId]||0);
}
function institutionById(id){ return EDUCATION_INSTITUTIONS.find(i=>i.id===id)||null; }
function institutionsForStage(stageId,settlementId){
  return EDUCATION_INSTITUTIONS.filter(i=>i.type===stageId&&(!settlementId||i.settlementId===settlementId));
}
function educationOptionsForStage(stage){
  if(!stage) return [];
  return stage.id==='university'?institutionsForStage('university'):institutionsForStage(stage.id,currentSettlement().id);
}
function educationMajorLabel(id){ return MAJORS[id]?MAJORS[id].name:id; }
function educationInstitutionLabel(id){ const i=institutionById(id); return i?i.name:'No institution recorded'; }
function educationMajorOptions(institution){
  return (institution&&institution.majors||[]).filter(id=>MAJORS[id]);
}
function educationParentChoice(stage,options){
  if(!options.length) return null;
  const affordable=options.filter(i=>stage.id!=='university'||schoolWealthOK()||i.tuition<=720);
  const pool=affordable.length?affordable:options;
  return pool.slice().sort((a,b)=>b.quality-a.quality||a.tuition-b.tuition)[0];
}
function educationSkillForInstitution(inst){
  if(!inst||!inst.specialties||!inst.specialties.length) return null;
  return inst.specialties.slice().sort((a,b)=>(S.skills[b]||0)-(S.skills[a]||0))[0];
}
function educationTrainingSkills(stage,inst,majorId){
  if(!stage) return [];
  const major=majorId&&MAJORS[majorId];
  return stage.id==='university'&&major&&major.skills?major.skills.slice():(inst&&inst.specialties||[]).slice();
}
function educationTrainingCap(stage){ return stage&&EDUCATION_TRAINING_CAPS[stage.id]||0; }
function educationTrainingLabel(stage,inst,majorId){
  const skills=educationTrainingSkills(stage,inst,majorId), cap=educationTrainingCap(stage);
  if(!skills.length||!cap) return 'No specialist training recorded';
  const names=skills.map(id=>SKILLS[id]?SKILLS[id].name:id).join(' + ');
  return stage.id==='university'?'Guaranteed +1 '+names+' each year · cap '+cap+'/10':'Guaranteed +1 specialty point/year · '+names+' · cap '+cap+'/10';
}
function educationFundingOptions(stage,inst,viaParent,viaScholar){
  const list=[];
  if(viaParent) list.push(EDUCATION_FUNDING.family);
  if(viaScholar) list.push(EDUCATION_FUNDING.scholarship);
  if(stage&&stage.id==='university'&&S.age>=18){
    list.push(EDUCATION_FUNDING.grant,EDUCATION_FUNDING.studentloan,EDUCATION_FUNDING.workstudy,EDUCATION_FUNDING.self);
  }else if(stage&&stage.id!=='university'&&S.age>=16&&S.age>=stage.startAge){
    list.push(EDUCATION_FUNDING.grant,EDUCATION_FUNDING.self);
  }
  const seen=new Set();
  return list.filter(item=>{ if(seen.has(item.id)) return false; seen.add(item.id); return true; });
}
function educationFundingCost(inst,funding){
  const fee=inst?Number(inst.tuition)||0:0, model=EDUCATION_FUNDING[funding]||EDUCATION_FUNDING.family;
  if(model.kind==='family'||(model.kind==='aid'&&funding==='scholarship')) return 0;
  if(model.kind==='debt') return fee;
  if(model.kind==='work') return Math.round(fee*model.rate);
  if(model.kind==='self') return fee;
  if(funding==='grant') return Math.round(fee*(1-model.rate));
  return 0;
}
function educationFundingLabel(inst,funding){
  const model=EDUCATION_FUNDING[funding]||EDUCATION_FUNDING.family;
  const cost=educationFundingCost(inst,funding);
  return model.label+(cost?' / '+money(cost)+'/yr':' / tuition covered');
}
function vocationalProgramById(id){ return VOCATIONAL_PROGRAMS.find(program=>program.id===id)||null; }
function educationProgramOptions(){
  ensureEducationState(S);
  return VOCATIONAL_PROGRAMS.filter(program=>S.age>=program.minAge&&eduRank()>=EDU_RANK[program.requires]&&!S.education.certificates[program.id]);
}
function educationCompleteProgram(programId){
  ensureEducationState(S);
  const program=vocationalProgramById(programId);
  if(!program||S.age<program.minAge||eduRank()<EDU_RANK[program.requires]||S.education.certificates[program.id]) return {ok:false,program};
  const paid=Math.min(Math.max(0,S.assets||0),program.tuition);
  S.assets-=paid;
  const shortfall=program.tuition-paid;
  if(shortfall){
    S.education.tuitionDebt+=shortfall;
    const template=LIABILITY_TYPES.studentloan;
    const financed=Object.assign({},template,{principal:Math.max(100,shortfall)});
    S.liabilities.push({id:'trainingloan',name:'Training Loan',icon:financed.icon,yearsLeft:5,annualPayment:liabilityPayment(financed)});
    S.education.tuitionDebt=0;
  }
  S.education.certificates[program.id]={id:program.id,name:program.name,year:currentYear(),career:program.career,skill:program.skill};
  S.skills[program.skill]=clamp((S.skills[program.skill]||0)+program.gain,0,10);
  educationRecordSkill(program.skill,S.skills[program.skill]);
  S.education.history.push({kind:'certificate',id:program.id,name:program.name,year:currentYear(),cost:program.tuition,debt:shortfall});
  return {ok:true,program,paid,shortfall};
}
function educationEnroll(stage,institution,majorId,funding,residenceMode){
  const e=ensureEducationState(S);
  const remote=stage.id==='university'&&institution.settlementId!==World.activeSettlementId;
  const commuting=remote&&residenceMode==='commute';
  e.institutionId=institution.id;
  e.stageId=stage.id;
  e.majorId=majorId||null;
  e.status='enrolled';
  e.yearsIn=0;
  S.eduYearsIn=0;
  e.funding=funding||'family';
  e.residenceMode=commuting?'commuter':remote?'student':(S.livingAtHome?'family':'independent');
  e.withdrawn=false;
  e.pendingResidenceSettlementId=null;
  e.performance=clamp(Math.round((S.smarts||50)*.55+(S.happiness||50)*.2+(S.health||50)*.15+(institution.quality||1)*10),0,100);
  e.attendance=100;
  educationSyncLegacy(S);
  if(remote&&!commuting){
    const from=currentSettlement(),to=settlementById(institution.settlementId),fare=travelCost(from,to);
    const available=Math.max(0,S.assets||0),shortfall=Math.max(0,fare-available);
    S.assets-=Math.min(available,fare);
    e.travelDebt+=shortfall;
    const residence=to.buildings.find(b=>b.type==='residence')||to.buildings[0];
    World.activeSettlementId=to.id; World.place=to.name; World.activeBuildingId=residence.id;
    World.map.selectedSettlementId=to.id; World.map.selectedBuildingId=residence.id; World.map.mode='settlement';
    if(!World.map.visitedSettlementIds.includes(to.id)) World.map.visitedSettlementIds.push(to.id);
    if(!World.map.discoveredSettlementIds.includes(to.id)) World.map.discoveredSettlementIds.push(to.id);
    S.place=to.name; S.location={settlementId:to.id,buildingId:residence.id};
    S.residenceSettlementId=to.id; S.residenceMode='student'; S.livingAtHome=false;
    logEv('EDUCATION TRANSFER. Subject relocated from '+from.name+' to '+to.name+' for study. Fare filed: '+money(fare)+'.',{},'milestone','EDUCATION TRANSFER · YEAR '+S.age);
    if(typeof updatePersonalStanding==='function') updatePersonalStanding();
    if(typeof renderIdentity==='function') renderIdentity();
    if(typeof renderMapIfOpen==='function') renderMapIfOpen();
  } else if(remote&&commuting){
    e.pendingResidenceSettlementId=institution.settlementId;
    logEv('EDUCATION COMMUTE. Subject stayed in '+currentSettlement().name+' and filed a yearly route to '+educationSettlementName(institution.settlementId)+' for study.',{},'plan','EDUCATION COMMUTE · YEAR '+S.age);
  } else if(stage.id==='university'){
    S.residenceMode=S.livingAtHome?'family':'independent';
  }
  e.history.push({kind:'enrollment',stage:stage.id,institutionId:institution.id,majorId:e.majorId,year:currentYear(),funding:e.funding});
  educationSyncLegacy(S);
  syncEduJobTitle();
}
function educationAnnualFee(){
  const inst=S&&S.education?institutionById(S.education.institutionId):null;
  return inst?inst.tuition:0;
}
function educationAnnualPayment(){
  const e=S&&S.education, inst=e&&institutionById(e.institutionId);
  return educationFundingCost(inst,e&&e.funding);
}
function educationAnnualCommuteCost(){
  const e=S&&S.education, inst=e&&institutionById(e&&e.institutionId);
  if(!e||e.residenceMode!=='commuter'||!inst) return 0;
  const from=currentSettlement(), to=settlementById(inst.settlementId);
  return from&&to&&from.id!==to.id?Math.max(25,Math.round(travelCost(from,to)*1.5)):0;
}
function educationCareerEducationRequirement(track,stageIdx){
  if(!track) return null;
  const stages=CAREER_STAGE_EDUCATION_REQUIREMENTS[track.id];
  if(stages&&Object.prototype.hasOwnProperty.call(stages,stageIdx)) return stages[stageIdx];
  return track.minEdu||null;
}
function educationCareerMajorRequirement(track,stageIdx){
  if(!track) return null;
  const stages=CAREER_STAGE_MAJOR_REQUIREMENTS[track.id];
  if(stages&&Object.prototype.hasOwnProperty.call(stages,stageIdx)) return stages[stageIdx];
  return track.requiredMajor||CAREER_MAJOR_REQUIREMENTS[track.id]||null;
}
function educationCareerMajorAllowed(track,stageIdx){
  const required=educationCareerMajorRequirement(track,stageIdx);
  if(!required) return true;
  const permitted=Array.isArray(required)?required:[required];
  return !!(S&&S.education&&permitted.includes(S.education.majorId)&&S.education.completed&&S.education.completed.university);
}
function educationCareerRequirement(track,stageIdx){
  const required=educationCareerMajorRequirement(track,stageIdx);
  if(!required) return '';
  return (Array.isArray(required)?required:[required]).map(educationMajorLabel).join(' or ');
}
function educationCareerAdvantage(track){
  const result={kind:'none',hiringBonus:0,promotionYears:0,signingBonus:0,label:'No degree-specific advantage'};
  if(!track||!S||!S.education) return result;
  const major=S.education.majorId&&MAJORS[S.education.majorId];
  if(S.education.completed&&S.education.completed.university&&major&&major.careers&&major.careers.includes(track.id)){
    return {kind:'specialist',hiringBonus:.22,promotionYears:1,signingBonus:300,label:educationMajorLabel(S.education.majorId)+' major match'};
  }
  const certificate=Object.values(S.education.certificates||{}).find(item=>item.career===track.id);
  if(certificate){
    return {kind:'certificate',hiringBonus:.16,promotionYears:0,signingBonus:180,label:certificate.name+' credential'};
  }
  if(S.education.completed&&S.education.completed.university&&CAREER_GENERAL_DEGREE_TRACKS.has(track.id)){
    return {kind:'general',hiringBonus:.12,promotionYears:0,signingBonus:150,label:'general university degree advantage'};
  }
  return result;
}
function careerYearsRequired(track,stageIdx){
  const base=CAREER_EXP[Math.max(0,stageIdx-1)]||0;
  const advantage=typeof educationCareerAdvantage==='function'?educationCareerAdvantage(track):null;
  return Math.max(1,base-(advantage?advantage.promotionYears:0));
}
function educationEventTick(){
  if(!S||!S.eduStage||!chance(.24)) return;
  ensureEducationState(S);
  const stage=SCHOOL_STAGES.find(item=>item.id===S.eduStage), inst=institutionById(S.education.institutionId);
  const pool=['mentor','illness','friend'];
  const kind=pick(pool);
  if(kind==='mentor'){
    const skills=educationTrainingSkills(stage,inst,S.education.majorId), skill=skills[0];
    if(skill&&SKILLS[skill]){
      const cap=educationTrainingCap(stage);
      S.skills[skill]=clamp((S.skills[skill]||0)+1,0,Math.min(10,cap));
      educationRecordSkill(skill,S.skills[skill]);
      S.education.performance=clamp(S.education.performance+7,0,100);
      logEv('A mentor took the subject aside after class. One practical point became easier to carry.',{relations:2,happiness:1},'milestone','EDUCATION EVENT · YEAR '+S.age);
    }
  }else if(kind==='illness'){
    S.education.attendance=clamp(S.education.attendance-12,40,100);
    S.education.performance=clamp(S.education.performance-8,0,100);
    logEv('Illness kept the subject away from lessons. The absence was recorded before the recovery.',{health:-2,happiness:-2},'ruling','EDUCATION EVENT · YEAR '+S.age);
  }else if(kind==='friend'){
    if(typeof makeContact==='function'&&S.contacts&&S.contacts.length<MAX_CONTACTS){
      const friend=makeContact(chance(.5)?'M':'F',{intellect:[55,90]});
      friend.metAge=S.age; friend.role='friend'; S.contacts.push(friend);
      logEv('A classmate became a name outside the classroom. The new contact entered the file.',{relations:3,happiness:2},'milestone','EDUCATION EVENT · YEAR '+S.age);
    }else{
      logEv('A classmate offered help after lessons. The subject did not forget the kindness.',{relations:2},'milestone','EDUCATION EVENT · YEAR '+S.age);
    }
  }
}
