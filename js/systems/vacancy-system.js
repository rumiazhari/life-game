'use strict';

(function(root){
  const SCHEMA_VERSION=1;
  const HISTORY_LIMIT=48;
  const MAX_APPLICATIONS_PER_VACANCY=12;
  const MAX_OPEN_PER_BUSINESS=3;
  const MAX_OPEN_PER_SETTLEMENT=24;
  const MAX_NPC_APPLICANTS_PER_VACANCY=4;
  const MAX_APPLICATIONS_PER_PERSON_PER_YEAR=2;

  const VACANCY_STATUSES=['open','filled','expired','withdrawn'];
  const APPLICATION_STATUSES=['pending','accepted','rejected','withdrawn'];
  const APPLICATION_KINDS=['new_hire','switch','promotion'];
  const OCCUPATION_TYPES=['career','job','generic'];

  const MAX_SALARY=5000000;
  const MIN_YEAR=-5000;
  const MAX_YEAR=5000;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const isValidCounter=value=>typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value)&&value>=0;
  const boundedYear=(value,fallback)=>{
    const safeFallback=fallback!=null&&Number.isFinite(Number(fallback))?Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(fallback)))):0;
    if(value==null||!Number.isFinite(Number(value))) return safeFallback;
    return Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(value))));
  };
  const boundedYearOrNull=value=>value==null||!Number.isFinite(Number(value))?null:boundedYear(value,0);
  const boundedSalary=(value,fallback)=>{
    const n=Number(value);
    if(!Number.isFinite(n)||n<0) return fallback;
    return Math.min(MAX_SALARY,Math.round(n));
  };
  const cloneEntry=entry=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.assign({},entry):entry;
  const trimHistory=history=>Array.isArray(history)?history.slice(-HISTORY_LIMIT).map(cloneEntry):[];

  const EDUCATION_STAGES=[null,'lower','basic','middle','upper','university'];
  const EDUCATION_RANK={none:0,lower:1,basic:1,middle:2,upper:3,university:4};

  function isValidEducationStage(value){
    return value===null||['lower','basic','middle','upper','university'].includes(value);
  }

  function normalizeMajorIds(source){
    if(!Array.isArray(source)) return [];
    const seen=new Set();
    source.forEach(item=>{ if(item!=null&&String(item)!=='') seen.add(String(item)); });
    return [...seen].sort().slice(0,8);
  }

  function normalizeSkills(source){
    const out={};
    if(!source||typeof source!=='object') return out;
    const skillIds=typeof SKILLS!=='undefined'&&SKILLS?Object.keys(SKILLS):null;
    Object.keys(source).sort().forEach(key=>{
      if(skillIds&&!skillIds.includes(key)) return;
      const n=Number(source[key]);
      if(!Number.isFinite(n)) return;
      const v=Math.round(clamp(n,0,10));
      out[key]=v;
    });
    return out;
  }

  function normalizeRequirements(source){
    const req=source&&typeof source==='object'?source:{};
    return {
      minAge:Math.round(clamp(finite(req.minAge,16),0,100)),
      educationStage:isValidEducationStage(req.educationStage)?req.educationStage:null,
      majorIds:normalizeMajorIds(req.majorIds),
      skills:normalizeSkills(req.skills),
      minCareerYears:Math.round(clamp(finite(req.minCareerYears,0),0,50))
    };
  }

  function vacancyIdNumber(id){
    const match=/^vacancy:(\d{5,})$/.exec(String(id||''));
    return match?Number(match[1]):null;
  }
  function isValidVacancyId(id){
    return typeof id==='string'&&/^vacancy:\d{5,}$/.test(id);
  }

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('VacancySystem.ensure requires a world object');
    if(!world.vacancies||typeof world.vacancies!=='object'||Array.isArray(world.vacancies)) world.vacancies={};
    if(!isValidCounter(world.vacancyCounter)) world.vacancyCounter=0;
    world.vacancyLastTickYear=boundedYearOrNull(world.vacancyLastTickYear);
    world.vacancySchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function highestVacancyIdNumber(world){
    let highest=0;
    Object.keys(world.vacancies).forEach(key=>{
      const record=world.vacancies[key];
      const keyNum=vacancyIdNumber(key);
      if(keyNum!=null) highest=Math.max(highest,keyNum);
      if(record&&typeof record==='object'&&!Array.isArray(record)){
        const idNum=vacancyIdNumber(record.id);
        if(idNum!=null) highest=Math.max(highest,idNum);
      }
    });
    if(root.BusinessSystem&&typeof root.BusinessSystem.all==='function'){
      root.BusinessSystem.all(world).forEach(business=>{
        (Array.isArray(business.vacancies)?business.vacancies:[]).forEach(item=>{
          if(typeof item==='string'){
            const n=vacancyIdNumber(item);
            if(n!=null) highest=Math.max(highest,n);
          } else if(item&&typeof item==='object'){
            const n=vacancyIdNumber(item.id);
            if(n!=null) highest=Math.max(highest,n);
          }
        });
      });
    }
    return highest;
  }

  function nextVacancyId(world,usedIds){
    const used=usedIds||new Set(Object.keys(world.vacancies));
    let id;
    do{
      world.vacancyCounter+=1;
      id='vacancy:'+String(world.vacancyCounter).padStart(5,'0');
    } while(used.has(id));
    return id;
  }

  function getBusiness(world,businessId){
    return root.BusinessSystem&&typeof root.BusinessSystem.get==='function'?root.BusinessSystem.get(world,businessId):null;
  }

  function get(world,vacancyId){
    ensure(world);
    return world.vacancies[vacancyId]||null;
  }
  function all(world){
    ensure(world);
    return Object.keys(world.vacancies).map(id=>world.vacancies[id]);
  }
  function forBusiness(world,businessId){
    return all(world).filter(v=>v.businessId===businessId);
  }
  function forSettlement(world,settlementId){
    return all(world).filter(v=>v.settlementId===settlementId);
  }
  function openVacancies(world,options){
    const opts=options||{};
    return all(world).filter(v=>v.status==='open'
      &&(!opts.businessId||v.businessId===opts.businessId)
      &&(!opts.settlementId||v.settlementId===opts.settlementId));
  }

  function normalizeApplication(app){
    if(!app||typeof app!=='object') return null;
    const personId=app.personId!=null?String(app.personId):null;
    if(!personId) return null;
    const workerType=personId==='subject'?'player':'npc';
    return {
      personId,
      workerType,
      kind:APPLICATION_KINDS.includes(app.kind)?app.kind:'new_hire',
      appliedYear:boundedYear(app.appliedYear,0),
      score:Math.round(clamp(finite(app.score,0),0,100)*100)/100,
      status:APPLICATION_STATUSES.includes(app.status)?app.status:'pending',
      resolvedYear:boundedYearOrNull(app.resolvedYear),
      reason:app.reason!=null?String(app.reason):null
    };
  }

  function normalizeApplications(source){
    if(!Array.isArray(source)) return [];
    const seen=new Set();
    const out=[];
    source.forEach(raw=>{
      const app=normalizeApplication(raw);
      if(!app||seen.has(app.personId)) return;
      seen.add(app.personId);
      out.push(app);
    });
    return out.slice(-MAX_APPLICATIONS_PER_VACANCY);
  }

  function normalizeVacancyRecord(id,record,world,options){
    const opts=options||{};
    record=record&&typeof record==='object'?record:{};
    const businessId=typeof record.businessId==='string'&&record.businessId?record.businessId:null;
    const business=businessId?getBusiness(world,businessId):null;
    const occupationType=OCCUPATION_TYPES.includes(record.occupationType)?record.occupationType:'generic';
    const careerStage=(record.careerStage!=null&&Number.isFinite(Number(record.careerStage))&&Number(record.careerStage)>=0&&Number(record.careerStage)<=4)?Math.round(Number(record.careerStage)):null;
    const jobTier=Math.round(clamp(finite(record.jobTier,1),1,5));
    const annualSalary=boundedSalary(record.annualSalary,0);
    const openedYear=boundedYear(record.openedYear,boundedYear(world.year,0));
    let expiresYear=boundedYear(record.expiresYear,openedYear+2);
    if(expiresYear<openedYear) expiresYear=openedYear+2;

    let status=VACANCY_STATUSES.includes(record.status)?record.status:'open';
    let closedReason=record.closedReason!=null?String(record.closedReason):null;

    if(!business){
      if(status==='open'||status==='filled'){ status='withdrawn'; closedReason=closedReason||'missing_business'; }
    } else if(business.status==='closed'){
      if(status==='open'){ status='withdrawn'; closedReason=closedReason||'business_closed'; }
    }

    let applications=normalizeApplications(record.applications);
    let filledByPersonId=status==='filled'?(record.filledByPersonId!=null?String(record.filledByPersonId):null):null;
    let filledContractId=status==='filled'?(record.filledContractId!=null?String(record.filledContractId):null):null;
    let filledYear=status==='filled'?boundedYearOrNull(record.filledYear):null;
    if(status==='filled'&&(!filledByPersonId||!filledContractId)){
      status='withdrawn';
      closedReason=closedReason||'invalid_fill_state';
      filledByPersonId=null; filledContractId=null; filledYear=null;
    }

    if(status!=='open'){
      applications=applications.map(app=>{
        if(app.status!=='pending') return app;
        if(status==='filled'&&app.personId===filledByPersonId){
          return Object.assign({},app,{status:'accepted',resolvedYear:app.resolvedYear!=null?app.resolvedYear:(filledYear!=null?filledYear:boundedYear(world.year,0))});
        }
        return Object.assign({},app,{status:'rejected',resolvedYear:app.resolvedYear!=null?app.resolvedYear:boundedYear(world.year,0),reason:app.reason||(status==='filled'?'better_candidate':status)});
      });
    }

    const accepted=applications.filter(a=>a.status==='accepted');
    if(status==='filled'&&accepted.length===0&&filledByPersonId){
      applications=applications.map(a=>a.personId===filledByPersonId?Object.assign({},a,{status:'accepted',resolvedYear:a.resolvedYear!=null?a.resolvedYear:boundedYear(world.year,0)}):a);
    }

    return {
      id,
      businessId,
      settlementId:business?business.settlementId:(typeof record.settlementId==='string'&&record.settlementId?record.settlementId:'unassigned'),
      occupationType,
      occupationId:record.occupationId!=null?String(record.occupationId):null,
      occupationName:typeof record.occupationName==='string'&&record.occupationName?record.occupationName:'Worker',
      careerStage,
      jobTier,
      annualSalary,
      requirements:normalizeRequirements(record.requirements),
      openedYear,
      expiresYear,
      status,
      filledByPersonId,
      filledContractId,
      filledYear,
      closedReason,
      applications,
      history:trimHistory(record.history)
    };
  }

  function withdrawnPlaceholder(id,world,legacyValue,legacyType){
    return {
      id,
      businessId:null,
      settlementId:'unassigned',
      occupationType:'generic',
      occupationId:null,
      occupationName:'Worker',
      careerStage:null,
      jobTier:1,
      annualSalary:0,
      requirements:normalizeRequirements(null),
      openedYear:boundedYear(world.year,0),
      expiresYear:boundedYear(world.year,0)+2,
      status:'withdrawn',
      filledByPersonId:null,
      filledContractId:null,
      filledYear:null,
      closedReason:'migration_invalid_record',
      applications:[],
      history:[{type:'migration_repaired',year:boundedYear(world.year,0),legacyType,legacyValue:String(legacyValue).slice(0,120)}]
    };
  }

  function syncBusinessVacancyIds(world,businessId){
    ensure(world);
    const business=getBusiness(world,businessId);
    if(!business) return null;
    const openIds=openVacancies(world,{businessId}).map(v=>v.id).sort();
    business.vacancies=openIds;
    return openIds;
  }
  function syncAllBusinessVacancyIds(world){
    ensure(world);
    if(!root.BusinessSystem||typeof root.BusinessSystem.all!=='function') return;
    root.BusinessSystem.all(world).forEach(business=>syncBusinessVacancyIds(world,business.id));
  }

  function migrate(world){
    ensure(world);

    const usedIds=new Set();
    const assignments=[];

    let reserveHighest=highestVacancyIdNumber(world);
    if(world.vacancyCounter<reserveHighest) world.vacancyCounter=reserveHighest;

    function allocateId(){ return nextVacancyId(world,usedIds); }

    function assignId(candidateId,record){
      let finalId;
      if(isValidVacancyId(candidateId)&&!usedIds.has(candidateId)) finalId=candidateId;
      else finalId=allocateId();
      usedIds.add(finalId);
      assignments.push({finalId,record});
      return finalId;
    }

    const topKeys=Object.keys(world.vacancies).sort();
    topKeys.forEach(key=>{
      const raw=world.vacancies[key];
      if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
        const recordId=raw.id;
        let finalId;
        if(isValidVacancyId(recordId)&&!usedIds.has(recordId)) finalId=recordId;
        else if(isValidVacancyId(key)&&!usedIds.has(key)) finalId=key;
        else finalId=allocateId();
        usedIds.add(finalId);
        assignments.push({finalId,record:raw});
      } else {
        if(isValidVacancyId(key)&&!usedIds.has(key)){
          usedIds.add(key);
          assignments.push({finalId:key,record:{__placeholder:true,legacyType:typeof raw,legacyValue:raw}});
        } else {
          const finalId=allocateId();
          usedIds.add(finalId);
          assignments.push({finalId,record:{__placeholder:true,legacyType:typeof raw,legacyValue:raw}});
        }
      }
    });

    if(root.BusinessSystem&&typeof root.BusinessSystem.all==='function'){
      root.BusinessSystem.all(world).slice().sort((a,b)=>a.id.localeCompare(b.id)).forEach(business=>{
        const embedded=Array.isArray(business.vacancies)?business.vacancies:[];
        embedded.forEach(item=>{
          if(item&&typeof item==='object'&&!Array.isArray(item)){
            const recordId=item.id;
            if(isValidVacancyId(recordId)&&!usedIds.has(recordId)){
              usedIds.add(recordId);
              assignments.push({finalId:recordId,record:Object.assign({},item,{businessId:item.businessId||business.id})});
            } else {
              const finalId=allocateId();
              usedIds.add(finalId);
              assignments.push({finalId,record:Object.assign({},item,{businessId:item.businessId||business.id})});
            }
          } else if(typeof item==='string'){
            if(isValidVacancyId(item)){
              if(usedIds.has(item)) return; // already linked to a top-level or earlier record
              usedIds.add(item);
              assignments.push({finalId:item,record:{__danglingPlaceholder:true,businessId:business.id}});
            }
          }
        });
      });
    }

    assignments.sort((a,b)=>a.finalId.localeCompare(b.finalId));
    const normalized={};
    assignments.forEach(({finalId,record})=>{
      if(record&&record.__placeholder){
        normalized[finalId]=withdrawnPlaceholder(finalId,world,record.legacyValue,record.legacyType);
      } else if(record&&record.__danglingPlaceholder){
        normalized[finalId]=Object.assign(withdrawnPlaceholder(finalId,world,'','string'),{businessId:record.businessId,closedReason:'migration_dangling_reference'});
      } else {
        normalized[finalId]=normalizeVacancyRecord(finalId,record,world);
      }
    });
    world.vacancies=normalized;

    const highest=highestVacancyIdNumber(world);
    if(world.vacancyCounter<highest) world.vacancyCounter=highest;

    syncAllBusinessVacancyIds(world);
    world.vacancySchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function roleKey(occupationType,occupationId,careerStage,jobTier){
    return occupationType+'|'+String(occupationId||'')+'|'+String(careerStage==null?'':careerStage)+'|'+String(jobTier);
  }

  function create(world,spec){
    ensure(world);
    spec=spec||{};
    if(!spec.businessId) throw new Error('VacancySystem.create requires a businessId');
    const business=getBusiness(world,spec.businessId);
    if(!business) throw new Error('VacancySystem.create requires an existing business, got: '+spec.businessId);
    if(business.status==='closed') throw new Error('VacancySystem.create cannot open a vacancy at a closed business: '+spec.businessId);
    if(!OCCUPATION_TYPES.includes(spec.occupationType)&&spec.occupationType!=null&&!['career','job'].includes(spec.occupationType)){
      // unsupported occupationType becomes generic
    }
    if(spec.annualSalary!=null){
      const salary=Number(spec.annualSalary);
      if(!Number.isFinite(salary)||salary<0) throw new Error('VacancySystem.create requires a finite non-negative annualSalary');
    }
    const id=nextVacancyId(world);
    const openedYear=boundedYear(spec.openedYear,boundedYear(world.year,0));
    const status=VACANCY_STATUSES.includes(spec.status)?spec.status:'open';
    const record=normalizeVacancyRecord(id,Object.assign({},spec,{id,businessId:business.id,status,openedYear,history:spec.history||[{type:'opened',year:openedYear,businessId:business.id,occupationName:spec.occupationName}]}),world);
    world.vacancies[id]=record;
    if(record.status==='open') syncBusinessVacancyIds(world,business.id);
    return record;
  }

  function open(world,spec){
    ensure(world);
    spec=spec||{};
    const business=getBusiness(world,spec.businessId);
    if(!business) throw new Error('VacancySystem.open requires an existing business, got: '+spec.businessId);
    if(business.status==='closed') throw new Error('VacancySystem.open cannot open a vacancy at a closed business: '+spec.businessId);
    const openBusinessCount=openVacancies(world,{businessId:business.id}).length;
    if(openBusinessCount>=MAX_OPEN_PER_BUSINESS) throw new Error('VacancySystem.open: business open-vacancy cap reached for '+business.id);
    const openSettlementCount=openVacancies(world,{settlementId:business.settlementId}).length;
    if(openSettlementCount>=MAX_OPEN_PER_SETTLEMENT) throw new Error('VacancySystem.open: settlement open-vacancy cap reached for '+business.settlementId);
    const key=roleKey(spec.occupationType,spec.occupationId,spec.careerStage,spec.jobTier);
    const duplicate=openVacancies(world,{businessId:business.id}).some(v=>roleKey(v.occupationType,v.occupationId,v.careerStage,v.jobTier)===key);
    if(duplicate) throw new Error('VacancySystem.open: duplicate open role at business '+business.id);
    return create(world,Object.assign({},spec,{status:'open'}));
  }

  function withdraw(world,vacancyId,reason,year){
    ensure(world);
    const vacancy=get(world,vacancyId);
    if(!vacancy) return null;
    if(vacancy.status!=='open') return vacancy;
    const y=boundedYear(year,boundedYear(world.year,0));
    vacancy.status='withdrawn';
    vacancy.closedReason=reason||'withdrawn';
    vacancy.applications=vacancy.applications.map(app=>app.status==='pending'
      ?Object.assign({},app,{status:'withdrawn',resolvedYear:y,reason:vacancy.closedReason})
      :app);
    vacancy.history=trimHistory(vacancy.history.concat([{type:'withdrawn',year:y,reason:vacancy.closedReason}]));
    if(vacancy.businessId) syncBusinessVacancyIds(world,vacancy.businessId);
    return vacancy;
  }

  function expire(world,vacancyId,year){
    ensure(world);
    const vacancy=get(world,vacancyId);
    if(!vacancy) return null;
    if(vacancy.status!=='open') return vacancy;
    const y=boundedYear(year,boundedYear(world.year,0));
    if(y<=vacancy.expiresYear) return vacancy;
    vacancy.status='expired';
    vacancy.closedReason='expired';
    vacancy.applications=vacancy.applications.map(app=>app.status==='pending'
      ?Object.assign({},app,{status:'rejected',resolvedYear:y,reason:'vacancy_expired'})
      :app);
    vacancy.history=trimHistory(vacancy.history.concat([{type:'expired',year:y}]));
    if(vacancy.businessId) syncBusinessVacancyIds(world,vacancy.businessId);
    return vacancy;
  }

  function withdrawForBusiness(world,businessId,reason,year){
    ensure(world);
    const opened=openVacancies(world,{businessId});
    opened.forEach(v=>withdraw(world,v.id,reason,year));
    return opened.length;
  }

  /* ---- occupation templates ---- */

  const SECTOR_CAREERS={
    agriculture:['agriculture'],
    manufacturing:['trade','engineering'],
    construction:['construction','engineering','architecture'],
    transport:['transport'],
    retail:['retail','business'],
    finance:['business'],
    healthcare:['medicine'],
    education:['academia','public'],
    government:['law','public'],
    professional:['business','arts','architecture','law','athletics']
  };

  function careerTemplatesForSector(sector){
    if(typeof CAREERS==='undefined'||!Array.isArray(CAREERS)) return [];
    const ids=SECTOR_CAREERS[sector]||[];
    const templates=[];
    CAREERS.filter(track=>ids.includes(track.id)).forEach(track=>{
      (track.stages||[]).forEach((stage,idx)=>{
        templates.push({
          occupationType:'career',
          occupationId:track.id,
          occupationName:stage.name,
          careerStage:idx,
          jobTier:idx+1,
          annualSalary:stage.salary,
          minAge:(typeof TIER_MINAGE!=='undefined'&&TIER_MINAGE[idx+1])||16,
          educationStage:(typeof track.minEdu==='string')?track.minEdu:null,
          majorIds:[],
          skills:Object.assign({},stage.req||{}),
          minCareerYears:idx===0?0:((typeof CAREER_EXP!=='undefined'&&CAREER_EXP[idx-1])||1)
        });
      });
    });
    return templates;
  }

  function jobTemplatesForSector(sector){
    if(typeof JOBLIST==='undefined'||!Array.isArray(JOBLIST)) return [];
    const EmploymentSystem=root.EmploymentSystem;
    return JOBLIST.filter(job=>{
      const jobSector=EmploymentSystem&&typeof EmploymentSystem.sectorForJobName==='function'?EmploymentSystem.sectorForJobName(job.name):'professional';
      return jobSector===sector;
    }).map(job=>({
      occupationType:'job',
      occupationId:EmploymentSystem&&typeof EmploymentSystem.normalizedJobSlug==='function'?EmploymentSystem.normalizedJobSlug(job.name):String(job.name).toLowerCase(),
      occupationName:job.name,
      careerStage:null,
      jobTier:job.tier,
      annualSalary:(typeof INC!=='undefined'&&INC[job.tier])||0,
      minAge:(typeof TIER_MINAGE!=='undefined'&&TIER_MINAGE[job.tier])||16,
      educationStage:null,
      majorIds:[],
      skills:job.skill?{[job.skill]:job.req}:{},
      minCareerYears:0
    }));
  }

  function candidateTemplates(world,business){
    const maxTier=clamp(1+Math.floor(businessMaxTierScale(world,business)*3)+(business.finances.profit>0?1:0),1,5);
    const templates=[]
      .concat(careerTemplatesForSector(business.sector).filter(t=>t.jobTier<=maxTier))
      .concat(jobTemplatesForSector(business.sector).filter(t=>t.jobTier<=maxTier));
    const seen=new Set();
    const unique=[];
    templates.forEach(t=>{
      const key=roleKey(t.occupationType,t.occupationId,t.careerStage,t.jobTier);
      if(seen.has(key)) return;
      seen.add(key);
      unique.push(t);
    });
    unique.sort((a,b)=>
      a.occupationType.localeCompare(b.occupationType)||
      String(a.occupationId||'').localeCompare(String(b.occupationId||''))||
      (a.careerStage==null?-1:a.careerStage)-(b.careerStage==null?-1:b.careerStage)||
      a.jobTier-b.jobTier||
      a.occupationName.localeCompare(b.occupationName)
    );
    if(!unique.length){
      const fallback=careerTemplatesForSector('professional').filter(t=>t.careerStage===0);
      if(fallback.length) return [Object.assign({},fallback[0])];
    }
    return unique.map(t=>Object.assign({},t,{skills:Object.assign({},t.skills)}));
  }

  function businessMaxTierScale(world,business){
    if(!root.BusinessSystem||typeof root.BusinessSystem.financeInputs!=='function') return 0.2;
    return root.BusinessSystem.financeInputs(world,business).businessScale;
  }

  function targetWorkers(world,business){
    if(!root.BusinessSystem||typeof root.BusinessSystem.financeInputs!=='function') return 1;
    const inputs=root.BusinessSystem.financeInputs(world,business);
    const base=1+Math.round(inputs.businessScale*4);
    const demandAdjustment=inputs.sectorDemand>=0.75?1:(inputs.sectorDemand<0.35?-1:0);
    const profitAdjustment=business.finances.lastYear==null?0:(business.finances.profit>0?1:(business.finances.profit<0?-1:0));
    const statusAdjustment=business.status==='struggling'?-1:0;
    let target=clamp(base+demandAdjustment+profitAdjustment+statusAdjustment,1,8);
    if(business.kind==='public'||business.kind==='nonprofit') target=Math.max(2,target);
    if(business.status==='closed') target=0;
    return target;
  }

  function generateForBusiness(world,business,options){
    ensure(world);
    const opts=options||{};
    const year=boundedYear(opts.year,boundedYear(world.year,0));
    if(business.status==='closed') return [];
    if(business.status==='struggling'&&business.finances.profit<0) return [];

    const activeCount=root.EmploymentSystem&&typeof root.EmploymentSystem.activeForBusiness==='function'
      ?root.EmploymentSystem.activeForBusiness(world,business.id).length:0;
    const openCount=openVacancies(world,{businessId:business.id}).length;
    let desired=targetWorkers(world,business)-activeCount-openCount;
    desired=Math.max(0,desired);
    desired=Math.min(desired,MAX_OPEN_PER_BUSINESS-openCount);
    desired=Math.min(desired,MAX_OPEN_PER_SETTLEMENT-openVacancies(world,{settlementId:business.settlementId}).length);
    if(desired<=0) return [];

    const templates=candidateTemplates(world,business);
    if(!templates.length) return [];

    const openKeys=new Set(openVacancies(world,{businessId:business.id}).map(v=>roleKey(v.occupationType,v.occupationId,v.careerStage,v.jobTier)));
    const created=[];
    for(let slotIndex=0;slotIndex<desired;slotIndex++){
      if(openKeys.size>=templates.length) break;
      const salt=world.seed+'|'+year+'|'+business.id+'|vacancy-template|'+slotIndex;
      const startIndex=root.Random.hashSeed(salt)%templates.length;
      let picked=null;
      for(let step=0;step<templates.length;step++){
        const template=templates[(startIndex+step)%templates.length];
        const key=roleKey(template.occupationType,template.occupationId,template.careerStage,template.jobTier);
        if(openKeys.has(key)) continue;
        picked=template; openKeys.add(key);
        break;
      }
      if(!picked) break;
      const record=create(world,{
        businessId:business.id,
        occupationType:picked.occupationType,
        occupationId:picked.occupationId,
        occupationName:picked.occupationName,
        careerStage:picked.careerStage,
        jobTier:picked.jobTier,
        annualSalary:picked.annualSalary,
        requirements:{
          minAge:picked.minAge,
          educationStage:picked.educationStage,
          majorIds:picked.majorIds,
          skills:picked.skills,
          minCareerYears:picked.minCareerYears
        },
        openedYear:year,
        expiresYear:year+2,
        status:'open'
      });
      created.push(record);
    }
    if(created.length) syncBusinessVacancyIds(world,business.id);
    return created;
  }

  function tickWorld(world,options){
    ensure(world);
    migrate(world);
    const opts=options||{};
    const year=boundedYear(opts.year,boundedYear(world.year,0));
    if(world.vacancyLastTickYear===year) return {applied:false,reason:'already_applied',year};
    if(world.vacancyLastTickYear!=null&&year<world.vacancyLastTickYear) return {applied:false,reason:'stale_year',year};

    let expired=0, withdrawn=0, opened=0;

    Object.keys(world.vacancies).sort().forEach(id=>{
      const vacancy=world.vacancies[id];
      if(vacancy.status!=='open') return;
      const business=getBusiness(world,vacancy.businessId);
      if(!business){ withdraw(world,id,'missing_business',year); withdrawn++; return; }
      if(business.status==='closed'){ withdraw(world,id,'business_closed',year); withdrawn++; return; }
      if(year>vacancy.expiresYear){ expire(world,id,year); expired++; }
    });

    const businesses=root.BusinessSystem&&typeof root.BusinessSystem.all==='function'
      ?root.BusinessSystem.all(world).slice().sort((a,b)=>a.id.localeCompare(b.id)):[];
    businesses.forEach(business=>{
      const created=generateForBusiness(world,business,{year});
      opened+=created.length;
    });

    syncAllBusinessVacancyIds(world);

    const bySettlement={};
    all(world).filter(v=>v.status==='open').forEach(v=>{
      bySettlement[v.settlementId]=(bySettlement[v.settlementId]||0)+1;
    });

    world.vacancyLastTickYear=year;

    return {
      applied:true,year,opened,expired,withdrawn,
      open:openVacancies(world).length,
      bySettlement
    };
  }

  function summary(world,options){
    ensure(world);
    const opts=options||{};
    const list=all(world).filter(v=>
      (!opts.businessId||v.businessId===opts.businessId)&&
      (!opts.settlementId||v.settlementId===opts.settlementId));
    const result={total:0,open:0,filled:0,expired:0,withdrawn:0,applications:0};
    list.forEach(v=>{
      result.total++;
      if(v.status==='open') result.open++;
      else if(v.status==='filled') result.filled++;
      else if(v.status==='expired') result.expired++;
      else if(v.status==='withdrawn') result.withdrawn++;
      result.applications+=v.applications.length;
    });
    return result;
  }

  function checkInvariants(world){
    const issues=[];
    if(!world||typeof world!=='object'||!world.vacancies||typeof world.vacancies!=='object'||Array.isArray(world.vacancies)){
      issues.push('vacancies must be an object');
      return issues;
    }
    if(!isValidCounter(world.vacancyCounter)) issues.push('vacancyCounter must be a finite non-negative integer');
    if(world.vacancyLastTickYear!=null&&(typeof world.vacancyLastTickYear!=='number'||!Number.isFinite(world.vacancyLastTickYear)||!Number.isInteger(world.vacancyLastTickYear)||world.vacancyLastTickYear<MIN_YEAR||world.vacancyLastTickYear>MAX_YEAR)){
      issues.push('vacancyLastTickYear must be null or a bounded integer');
    }
    const ids=new Set();
    let highestId=0;
    const perBusinessOpen={}, perSettlementOpen={};
    Object.keys(world.vacancies).forEach(key=>{
      const v=world.vacancies[key];
      if(!v||typeof v!=='object'){ issues.push('vacancy at key '+key+' is not an object'); return; }
      if(!isValidVacancyId(v.id)) issues.push('vacancy '+key+' has invalid id format: '+v.id);
      if(v.id!==key) issues.push('vacancy key '+key+' does not match record id '+v.id);
      if(ids.has(v.id)) issues.push('duplicate vacancy id: '+v.id);
      ids.add(v.id);
      const num=vacancyIdNumber(v.id); if(num!=null) highestId=Math.max(highestId,num);
      if(!VACANCY_STATUSES.includes(v.status)) issues.push('vacancy '+key+' has invalid status: '+v.status);
      if(!OCCUPATION_TYPES.includes(v.occupationType)) issues.push('vacancy '+key+' has invalid occupationType: '+v.occupationType);
      if(typeof v.jobTier!=='number'||!Number.isInteger(v.jobTier)||v.jobTier<1||v.jobTier>5) issues.push('vacancy '+key+' has invalid jobTier');
      if(v.careerStage!=null&&(typeof v.careerStage!=='number'||!Number.isInteger(v.careerStage)||v.careerStage<0||v.careerStage>4)) issues.push('vacancy '+key+' has invalid careerStage');
      if(typeof v.annualSalary!=='number'||!Number.isFinite(v.annualSalary)||!Number.isInteger(v.annualSalary)||v.annualSalary<0||v.annualSalary>MAX_SALARY) issues.push('vacancy '+key+' has invalid or out-of-bound annualSalary');
      if(!v.requirements||typeof v.requirements!=='object') issues.push('vacancy '+key+' missing requirements');
      if(typeof v.openedYear!=='number'||!Number.isInteger(v.openedYear)||v.openedYear<MIN_YEAR||v.openedYear>MAX_YEAR) issues.push('vacancy '+key+' has invalid openedYear');
      if(typeof v.expiresYear!=='number'||!Number.isInteger(v.expiresYear)||v.expiresYear<MIN_YEAR||v.expiresYear>MAX_YEAR) issues.push('vacancy '+key+' has invalid expiresYear');
      if(v.expiresYear<v.openedYear) issues.push('vacancy '+key+' expiresYear is before openedYear');
      const business=v.businessId?getBusiness(world,v.businessId):null;
      if((v.status==='open'||v.status==='filled')){
        if(!business) issues.push('vacancy '+key+' requires a valid business but businessId is missing/invalid');
        else {
          if(v.settlementId!==business.settlementId) issues.push('vacancy '+key+' settlementId does not match business settlementId');
          if(v.status==='open'&&business.status==='closed') issues.push('vacancy '+key+' is open but references a closed business');
        }
      }
      if(v.status==='filled'){
        if(!v.filledByPersonId||!v.filledContractId||v.filledYear==null) issues.push('vacancy '+key+' is filled but missing filled fields');
      } else if(v.filledByPersonId!=null||v.filledContractId!=null||v.filledYear!=null){
        issues.push('vacancy '+key+' is not filled but has filled fields set');
      }
      if(!Array.isArray(v.applications)) issues.push('vacancy '+key+' applications must be an array');
      else {
        if(v.applications.length>MAX_APPLICATIONS_PER_VACANCY) issues.push('vacancy '+key+' exceeds application cap');
        const seenPersons=new Set();
        let acceptedCount=0;
        v.applications.forEach(app=>{
          if(!app||typeof app!=='object'){ issues.push('vacancy '+key+' has an invalid application entry'); return; }
          if(seenPersons.has(app.personId)) issues.push('vacancy '+key+' has duplicate application personId: '+app.personId);
          seenPersons.add(app.personId);
          const expectedType=app.personId==='subject'?'player':'npc';
          if(app.workerType!==expectedType) issues.push('vacancy '+key+' application '+app.personId+' has mismatched workerType');
          if(!APPLICATION_KINDS.includes(app.kind)) issues.push('vacancy '+key+' application '+app.personId+' has invalid kind');
          if(!APPLICATION_STATUSES.includes(app.status)) issues.push('vacancy '+key+' application '+app.personId+' has invalid status');
          if(typeof app.score!=='number'||!Number.isFinite(app.score)||app.score<0||app.score>100) issues.push('vacancy '+key+' application '+app.personId+' has invalid score');
          if(app.status!=='pending'&&app.resolvedYear==null) issues.push('vacancy '+key+' application '+app.personId+' is resolved but missing resolvedYear');
          if(app.status==='pending'&&app.resolvedYear!=null) issues.push('vacancy '+key+' application '+app.personId+' is pending but has resolvedYear');
          if(app.status==='accepted'){
            acceptedCount++;
            if(app.personId!==v.filledByPersonId) issues.push('vacancy '+key+' accepted applicant does not match filledByPersonId');
          }
          if(v.status!=='open'&&app.status==='pending') issues.push('vacancy '+key+' is terminal but retains a pending application');
        });
        if(acceptedCount>1) issues.push('vacancy '+key+' has more than one accepted application');
      }
      if(!Array.isArray(v.history)) issues.push('vacancy '+key+' history must be an array');
      else if(v.history.length>HISTORY_LIMIT) issues.push('vacancy '+key+' history exceeds limit of '+HISTORY_LIMIT);
      if(v.status==='open'){
        if(v.businessId){ perBusinessOpen[v.businessId]=(perBusinessOpen[v.businessId]||0)+1; }
        perSettlementOpen[v.settlementId]=(perSettlementOpen[v.settlementId]||0)+1;
      }
    });
    Object.keys(perBusinessOpen).forEach(businessId=>{
      if(perBusinessOpen[businessId]>MAX_OPEN_PER_BUSINESS) issues.push('business '+businessId+' has more than '+MAX_OPEN_PER_BUSINESS+' open vacancies');
    });
    Object.keys(perSettlementOpen).forEach(settlementId=>{
      if(perSettlementOpen[settlementId]>MAX_OPEN_PER_SETTLEMENT) issues.push('settlement '+settlementId+' has more than '+MAX_OPEN_PER_SETTLEMENT+' open vacancies');
    });
    if(Number(world.vacancyCounter)<highestId) issues.push('vacancyCounter is behind the highest vacancy id');

    if(world.businesses&&typeof world.businesses==='object'){
      Object.keys(world.businesses).forEach(businessId=>{
        const business=world.businesses[businessId];
        if(!business||typeof business!=='object') return;
        const actual=Array.isArray(business.vacancies)?business.vacancies.slice().sort():[];
        const expected=all(world).filter(v=>v.businessId===businessId&&v.status==='open').map(v=>v.id).sort();
        if(JSON.stringify(actual)!==JSON.stringify(expected)) issues.push('business '+businessId+' vacancies array does not match its open vacancy records');
        actual.forEach(id=>{ if(!isValidVacancyId(id)) issues.push('business '+businessId+' vacancies contains a non-ID value: '+id); });
        if(new Set(actual).size!==actual.length) issues.push('business '+businessId+' vacancies contains duplicate IDs');
      });
    }
    return issues;
  }

  root.VacancySystem={
    SCHEMA_VERSION,
    VACANCY_STATUSES,
    APPLICATION_STATUSES,
    APPLICATION_KINDS,
    MAX_APPLICATIONS_PER_VACANCY,
    MAX_OPEN_PER_BUSINESS,
    MAX_OPEN_PER_SETTLEMENT,
    MAX_NPC_APPLICANTS_PER_VACANCY,
    MAX_APPLICATIONS_PER_PERSON_PER_YEAR,
    EDUCATION_RANK,
    ensure,
    migrate,
    create,
    open,
    get,
    all,
    forBusiness,
    forSettlement,
    openVacancies,
    withdraw,
    expire,
    withdrawForBusiness,
    syncBusinessVacancyIds,
    syncAllBusinessVacancyIds,
    targetWorkers,
    candidateTemplates,
    generateForBusiness,
    tickWorld,
    summary,
    checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
