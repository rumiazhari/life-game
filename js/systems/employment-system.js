'use strict';

(function(root){
  const SCHEMA_VERSION=1;
  const HISTORY_LIMIT=64;
  const CONTRACT_STATUSES=['active','on_leave','terminated','resigned','retired'];
  const WORKER_TYPES=['player','npc'];
  const ACTIVE_STATUSES=new Set(['active','on_leave']);
  const END_STATUSES=new Set(['terminated','resigned','retired']);
  const OCCUPATION_TYPES=['career','job','generic'];

  const MAX_SALARY=5000000;
  const MAX_PAYROLL=1000000000;
  const MIN_YEAR=-5000;
  const MAX_YEAR=5000;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clampUnit=(value,fallback)=>Number.isFinite(Number(value))?clamp(Number(value),0,1):fallback;
  const clampInt=(value,min,max,fallback)=>{
    if(value==null||!Number.isFinite(Number(value))) return fallback;
    return Math.max(min,Math.min(max,Math.round(Number(value))));
  };
  const nonNegInt=(value,fallback)=>{
    if(value==null||!Number.isFinite(Number(value))) return fallback;
    const n=Math.round(Number(value));
    return n>=0?n:fallback;
  };
  const nonNegNumber=(value,fallback)=>{
    const n=Number(value);
    return Number.isFinite(n)&&n>=0?n:fallback;
  };
  const boundedSalary=(value,fallback)=>{
    const n=Number(value);
    if(!Number.isFinite(n)||n<0) return fallback;
    return Math.min(MAX_SALARY,Math.round(n));
  };
  const boundedYear=(value,fallback)=>{
    const safeFallback=fallback!=null&&Number.isFinite(Number(fallback))?Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(fallback)))):0;
    if(value==null||!Number.isFinite(Number(value))) return safeFallback;
    return Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(value))));
  };
  const boundedYearOrNull=value=>value==null||!Number.isFinite(Number(value))?null:boundedYear(value,0);
  const isValidCounter=value=>typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value)&&value>=0;
  const cloneEntry=entry=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.assign({},entry):entry;
  const trimHistory=history=>Array.isArray(history)?history.slice(-HISTORY_LIMIT).map(cloneEntry):[];

  function contractIdNumber(id){
    const match=/^employment:(\d{5,})$/.exec(String(id||''));
    return match?Number(match[1]):null;
  }
  function isValidContractId(id){
    return typeof id==='string'&&/^employment:\d{5,}$/.test(id);
  }
  function workerTypeForPerson(personId){
    return personId==='subject'?'player':'npc';
  }

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('EmploymentSystem.ensure requires a world object');
    if(!world.employmentContracts||typeof world.employmentContracts!=='object'||Array.isArray(world.employmentContracts)) world.employmentContracts={};
    if(!isValidCounter(world.employmentContractCounter)) world.employmentContractCounter=0;
    world.employmentSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function highestContractIdNumber(world){
    let highest=0;
    Object.keys(world.employmentContracts).forEach(key=>{
      const record=world.employmentContracts[key];
      const keyNum=contractIdNumber(key);
      if(keyNum!=null) highest=Math.max(highest,keyNum);
      if(record&&typeof record==='object'&&!Array.isArray(record)){
        const idNum=contractIdNumber(record.id);
        if(idNum!=null) highest=Math.max(highest,idNum);
      }
    });
    return highest;
  }

  function nextContractId(world){
    const highest=highestContractIdNumber(world);
    if(world.employmentContractCounter<highest) world.employmentContractCounter=highest;
    let id;
    do{
      world.employmentContractCounter+=1;
      id='employment:'+String(world.employmentContractCounter).padStart(5,'0');
    } while(Object.prototype.hasOwnProperty.call(world.employmentContracts,id));
    return id;
  }

  function getBusiness(world,businessId){
    return root.BusinessSystem&&typeof root.BusinessSystem.get==='function'?root.BusinessSystem.get(world,businessId):null;
  }

  function buildRecord(id,spec,business,world){
    const personId=String(spec.personId);
    const workerType=workerTypeForPerson(personId);
    const occupationType=OCCUPATION_TYPES.includes(spec.occupationType)?spec.occupationType:'generic';
    const careerStage=(spec.careerStage!=null&&Number.isFinite(Number(spec.careerStage))&&Number(spec.careerStage)>=0)?Math.round(Number(spec.careerStage)):null;
    const jobTier=clampInt(spec.jobTier,0,5,1);
    const annualSalary=boundedSalary(spec.annualSalary,0);
    const currentYear=boundedYear(world.year,0);
    const hiredYear=boundedYear(spec.hiredYear,currentYear);
    const status=CONTRACT_STATUSES.includes(spec.status)?spec.status:'active';
    let endedYear=null;
    if(!ACTIVE_STATUSES.has(status)){
      const suppliedEndedYear=boundedYearOrNull(spec.endedYear);
      const candidateEndedYear=suppliedEndedYear!=null?suppliedEndedYear:currentYear;
      endedYear=Math.max(candidateEndedYear,hiredYear);
    }
    return {
      id,
      personId,
      workerType,
      businessId:business.id,
      settlementId:business.settlementId,
      occupationType,
      occupationId:spec.occupationId!=null?String(spec.occupationId):null,
      occupationName:typeof spec.occupationName==='string'&&spec.occupationName?spec.occupationName:'Worker',
      careerStage,
      jobTier,
      annualSalary,
      hiredYear,
      endedYear,
      status,
      terminationReason:ACTIVE_STATUSES.has(status)?null:(spec.terminationReason!=null?String(spec.terminationReason):null),
      performance:clampUnit(spec.performance,0.5),
      satisfaction:clampUnit(spec.satisfaction,0.5),
      lastPaidYear:boundedYearOrNull(spec.lastPaidYear),
      annualPaid:boundedSalary(spec.annualPaid,0),
      history:trimHistory(spec.history)
    };
  }

  function create(world,spec){
    ensure(world);
    spec=spec||{};
    if(spec.personId==null||String(spec.personId)==='') throw new Error('EmploymentSystem.create requires a personId');
    if(!spec.businessId) throw new Error('EmploymentSystem.create requires a businessId');
    const business=getBusiness(world,spec.businessId);
    if(!business) throw new Error('EmploymentSystem.create requires an existing business, got: '+spec.businessId);
    if(business.status==='closed') throw new Error('EmploymentSystem.create cannot hire into a closed business: '+spec.businessId);
    if(spec.annualSalary!=null){
      const salary=Number(spec.annualSalary);
      if(!Number.isFinite(salary)||salary<0) throw new Error('EmploymentSystem.create requires a finite non-negative annualSalary');
    }
    const personId=String(spec.personId);
    const status=CONTRACT_STATUSES.includes(spec.status)?spec.status:'active';
    if(ACTIVE_STATUSES.has(status)&&activeForPerson(world,personId).length>0){
      throw new Error('EmploymentSystem.create: person already has an active or on_leave contract');
    }
    const id=nextContractId(world);
    const record=buildRecord(id,spec,business,world);
    world.employmentContracts[id]=record;
    if(ACTIVE_STATUSES.has(record.status)){
      if(!Array.isArray(business.employeeIds)) business.employeeIds=[];
      if(!business.employeeIds.includes(record.personId)) business.employeeIds.push(record.personId);
    }
    return record;
  }

  function get(world,contractId){
    ensure(world);
    return world.employmentContracts[contractId]||null;
  }
  function all(world){
    ensure(world);
    return Object.keys(world.employmentContracts).map(id=>world.employmentContracts[id]);
  }
  function forPerson(world,personId){
    return all(world).filter(c=>c.personId===personId);
  }
  function forBusiness(world,businessId){
    return all(world).filter(c=>c.businessId===businessId);
  }
  function activeForPerson(world,personId){
    return forPerson(world,personId).filter(c=>ACTIVE_STATUSES.has(c.status));
  }
  function activeForBusiness(world,businessId){
    return forBusiness(world,businessId).filter(c=>ACTIVE_STATUSES.has(c.status));
  }

  function hire(world,spec){
    ensure(world);
    spec=spec||{};
    const contract=create(world,Object.assign({},spec,{status:'active'}));
    contract.history.push(cloneEntry({type:'hired',year:contract.hiredYear,businessId:contract.businessId,annualSalary:contract.annualSalary,occupationName:contract.occupationName}));
    contract.history=trimHistory(contract.history);
    return contract;
  }

  function endInternal(world,contract,status,reason,year){
    if(!ACTIVE_STATUSES.has(contract.status)) return contract;
    const finalStatus=END_STATUSES.has(status)?status:'terminated';
    contract.status=finalStatus;
    const fallbackYear=boundedYear(world.year,contract.hiredYear);
    contract.endedYear=Math.max(boundedYear(year,fallbackYear),contract.hiredYear);
    contract.terminationReason=reason!=null?String(reason):null;
    contract.history.push(cloneEntry({type:finalStatus,year:contract.endedYear,reason:contract.terminationReason}));
    contract.history=trimHistory(contract.history);
    const business=getBusiness(world,contract.businessId);
    if(business&&Array.isArray(business.employeeIds)){
      const stillActive=all(world).some(c=>c.personId===contract.personId&&c.businessId===contract.businessId&&ACTIVE_STATUSES.has(c.status));
      if(!stillActive) business.employeeIds=business.employeeIds.filter(id=>id!==contract.personId);
    }
    return contract;
  }

  function end(world,contractId,status,reason,year){
    ensure(world);
    const contract=world.employmentContracts[contractId];
    if(!contract) throw new Error('EmploymentSystem.end requires an existing contractId, got: '+contractId);
    return endInternal(world,contract,status,reason,year);
  }

  function syncBusinessEmployees(world,businessId){
    ensure(world);
    const business=getBusiness(world,businessId);
    if(!business) return null;
    const unique=[...new Set(activeForBusiness(world,businessId).map(c=>c.personId))].sort();
    business.employeeIds=unique;
    return unique;
  }

  function payBusinessPayroll(world,businessId,year){
    ensure(world);
    const payYear=boundedYear(year,boundedYear(world.year,0));
    const contracts=activeForBusiness(world,businessId);
    let total=0;
    contracts.forEach(contract=>{
      const salary=boundedSalary(contract.annualSalary,0);
      contract.annualSalary=salary;
      total=Math.min(MAX_PAYROLL,total+salary);
      contract.annualPaid=salary;
      contract.lastPaidYear=payYear;
    });
    return Math.round(total);
  }

  function syncAllBusinessEmployees(world){
    ensure(world);
    if(!root.BusinessSystem||typeof root.BusinessSystem.all!=='function') return;
    root.BusinessSystem.all(world).forEach(business=>syncBusinessEmployees(world,business.id));
  }

  function terminateOrphanedContracts(world,year){
    all(world).forEach(contract=>{
      if(!ACTIVE_STATUSES.has(contract.status)) return;
      const business=getBusiness(world,contract.businessId);
      if(!business) endInternal(world,contract,'terminated','missing_business',year);
      else if(business.status==='closed') endInternal(world,contract,'terminated','business_closed',year);
    });
  }

  function resolveDuplicateActiveContracts(world,year){
    const byPerson={};
    all(world).forEach(contract=>{
      if(!ACTIVE_STATUSES.has(contract.status)) return;
      (byPerson[contract.personId]=byPerson[contract.personId]||[]).push(contract);
    });
    Object.keys(byPerson).forEach(personId=>{
      const list=byPerson[personId];
      if(list.length<=1) return;
      list.sort((a,b)=>(b.hiredYear-a.hiredYear)||String(b.id).localeCompare(String(a.id)));
      list.slice(1).forEach(contract=>endInternal(world,contract,'terminated','migration_duplicate_active_contract',year));
    });
  }

  function migrate(world){
    ensure(world);
    const rawKeys=Object.keys(world.employmentContracts).sort();

    let reserveHighest=0;
    rawKeys.forEach(key=>{
      const raw=world.employmentContracts[key];
      const keyNum=contractIdNumber(key);
      if(keyNum!=null) reserveHighest=Math.max(reserveHighest,keyNum);
      if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
        const idNum=contractIdNumber(raw.id);
        if(idNum!=null) reserveHighest=Math.max(reserveHighest,idNum);
      }
    });
    if(world.employmentContractCounter<reserveHighest) world.employmentContractCounter=reserveHighest;

    const usedIds=new Set();
    const assignments=[];
    function allocateId(){
      let candidate;
      do{
        world.employmentContractCounter+=1;
        candidate='employment:'+String(world.employmentContractCounter).padStart(5,'0');
      } while(usedIds.has(candidate));
      return candidate;
    }
    rawKeys.forEach(key=>{
      const raw=world.employmentContracts[key];
      const source=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:{};
      const recordId=source.id;
      let finalId;
      if(isValidContractId(recordId)&&!usedIds.has(recordId)) finalId=recordId;
      else if(isValidContractId(key)&&!usedIds.has(key)) finalId=key;
      else finalId=allocateId();
      usedIds.add(finalId);
      assignments.push({finalId,source});
    });
    assignments.sort((a,b)=>a.finalId.localeCompare(b.finalId));

    const year=boundedYear(world.year,0);
    const normalized={};
    assignments.forEach(({finalId,source})=>{
      const business=getBusiness(world,source.businessId);
      const personId=source.personId!=null&&String(source.personId)!==''?String(source.personId):'unknown';
      const workerType=workerTypeForPerson(personId);
      const businessId=business?business.id:(typeof source.businessId==='string'&&source.businessId?source.businessId:null);
      const settlementId=business?business.settlementId:(typeof source.settlementId==='string'&&source.settlementId?source.settlementId:'unassigned');
      const occupationType=OCCUPATION_TYPES.includes(source.occupationType)?source.occupationType:'generic';
      const careerStage=(source.careerStage!=null&&Number.isFinite(Number(source.careerStage))&&Number(source.careerStage)>=0)?Math.round(Number(source.careerStage)):null;
      const jobTier=clampInt(source.jobTier,0,5,1);
      const annualSalary=boundedSalary(source.annualSalary,0);
      const hiredYear=boundedYear(source.hiredYear,year);
      let status=CONTRACT_STATUSES.includes(source.status)?source.status:'active';
      let endedYear=boundedYearOrNull(source.endedYear);
      let terminationReason=source.terminationReason!=null?String(source.terminationReason):null;
      if(ACTIVE_STATUSES.has(status)){ endedYear=null; terminationReason=null; }
      else { endedYear=Math.max(endedYear!=null?endedYear:year,hiredYear); }
      normalized[finalId]={
        id:finalId,
        personId,
        workerType,
        businessId,
        settlementId,
        occupationType,
        occupationId:source.occupationId!=null?String(source.occupationId):null,
        occupationName:typeof source.occupationName==='string'&&source.occupationName?source.occupationName:'Worker',
        careerStage,
        jobTier,
        annualSalary,
        hiredYear,
        endedYear,
        status,
        terminationReason,
        performance:clampUnit(source.performance,0.5),
        satisfaction:clampUnit(source.satisfaction,0.5),
        lastPaidYear:boundedYearOrNull(source.lastPaidYear),
        annualPaid:boundedSalary(source.annualPaid,0),
        history:trimHistory(source.history)
      };
    });
    world.employmentContracts=normalized;

    terminateOrphanedContracts(world,year);
    resolveDuplicateActiveContracts(world,year);

    const highest=highestContractIdNumber(world);
    if(world.employmentContractCounter<highest) world.employmentContractCounter=highest;

    syncAllBusinessEmployees(world);
    world.employmentSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function summary(world,options){
    ensure(world);
    const opts=options||{};
    const list=all(world).filter(c=>
      (!opts.businessId||c.businessId===opts.businessId)&&
      (!opts.personId||c.personId===opts.personId)&&
      (!opts.settlementId||c.settlementId===opts.settlementId)
    );
    const result={total:0,active:0,onLeave:0,terminated:0,resigned:0,retired:0,annualPayroll:0,uniqueWorkers:0};
    const workers=new Set();
    list.forEach(c=>{
      result.total++;
      if(c.status==='active') result.active++;
      else if(c.status==='on_leave') result.onLeave++;
      else if(c.status==='terminated') result.terminated++;
      else if(c.status==='resigned') result.resigned++;
      else if(c.status==='retired') result.retired++;
      if(ACTIVE_STATUSES.has(c.status)){ result.annualPayroll+=c.annualSalary; workers.add(c.personId); }
    });
    result.uniqueWorkers=workers.size;
    return result;
  }

  function checkInvariants(world){
    const issues=[];
    if(!world||typeof world!=='object'||!world.employmentContracts||typeof world.employmentContracts!=='object'||Array.isArray(world.employmentContracts)){
      issues.push('employmentContracts must be an object');
      return issues;
    }
    if(typeof world.employmentContractCounter!=='number'||!Number.isFinite(world.employmentContractCounter)||world.employmentContractCounter<0||!Number.isInteger(world.employmentContractCounter)){
      issues.push('employmentContractCounter must be a finite non-negative integer');
    }
    const ids=new Set();
    const activeByPerson={};
    const businessEmployeeExpectation={};
    let highestId=0;
    Object.keys(world.employmentContracts).forEach(key=>{
      const c=world.employmentContracts[key];
      if(!c||typeof c!=='object'){ issues.push('employment contract at key '+key+' is not an object'); return; }
      if(!/^employment:\d{5,}$/.test(String(c.id))) issues.push('employment contract '+key+' has invalid id format: '+c.id);
      if(c.id!==key) issues.push('employment contract key '+key+' does not match record id '+c.id);
      if(ids.has(c.id)) issues.push('duplicate employment contract id: '+c.id);
      ids.add(c.id);
      const num=contractIdNumber(c.id); if(num!=null) highestId=Math.max(highestId,num);
      if(!c.personId||typeof c.personId!=='string') issues.push('employment contract '+key+' missing personId');
      const expectedWorkerType=workerTypeForPerson(c.personId);
      if(!WORKER_TYPES.includes(c.workerType)||c.workerType!==expectedWorkerType) issues.push('employment contract '+key+' has invalid/mismatched workerType');
      const business=getBusiness(world,c.businessId);
      if(!business) issues.push('employment contract '+key+' references missing business: '+c.businessId);
      else if(c.settlementId!==business.settlementId) issues.push('employment contract '+key+' settlementId does not match business settlementId');
      if(!OCCUPATION_TYPES.includes(c.occupationType)) issues.push('employment contract '+key+' has invalid occupationType: '+c.occupationType);
      if(c.careerStage!=null&&(typeof c.careerStage!=='number'||!Number.isInteger(c.careerStage)||c.careerStage<0)) issues.push('employment contract '+key+' has invalid careerStage');
      if(typeof c.jobTier!=='number'||!Number.isInteger(c.jobTier)||c.jobTier<0||c.jobTier>5) issues.push('employment contract '+key+' has invalid jobTier');
      if(typeof c.annualSalary!=='number'||!Number.isFinite(c.annualSalary)||c.annualSalary<0||c.annualSalary>MAX_SALARY) issues.push('employment contract '+key+' has invalid or out-of-bound annualSalary');
      if(typeof c.hiredYear!=='number'||!Number.isFinite(c.hiredYear)||!Number.isInteger(c.hiredYear)||c.hiredYear<MIN_YEAR||c.hiredYear>MAX_YEAR) issues.push('employment contract '+key+' has invalid or out-of-bound hiredYear');
      if(c.endedYear!=null&&(typeof c.endedYear!=='number'||!Number.isFinite(c.endedYear)||!Number.isInteger(c.endedYear)||c.endedYear<MIN_YEAR||c.endedYear>MAX_YEAR)) issues.push('employment contract '+key+' has invalid or out-of-bound endedYear');
      if(c.endedYear!=null&&typeof c.hiredYear==='number'&&c.endedYear<c.hiredYear) issues.push('employment contract '+key+' has endedYear before hiredYear');
      if(!CONTRACT_STATUSES.includes(c.status)) issues.push('employment contract '+key+' has invalid status: '+c.status);
      else {
        if(END_STATUSES.has(c.status)&&c.endedYear==null) issues.push('employment contract '+key+' is ended but missing endedYear');
        if(ACTIVE_STATUSES.has(c.status)&&c.endedYear!=null) issues.push('employment contract '+key+' is active but has an endedYear');
        if(ACTIVE_STATUSES.has(c.status)&&business&&business.status==='closed') issues.push('employment contract '+key+' is active at a closed business');
      }
      if(typeof c.performance!=='number'||!Number.isFinite(c.performance)||c.performance<0||c.performance>1) issues.push('employment contract '+key+' has invalid performance');
      if(typeof c.satisfaction!=='number'||!Number.isFinite(c.satisfaction)||c.satisfaction<0||c.satisfaction>1) issues.push('employment contract '+key+' has invalid satisfaction');
      if(typeof c.annualPaid!=='number'||!Number.isFinite(c.annualPaid)||c.annualPaid<0||c.annualPaid>MAX_SALARY) issues.push('employment contract '+key+' has invalid or out-of-bound annualPaid');
      if(c.lastPaidYear!=null&&(typeof c.lastPaidYear!=='number'||!Number.isFinite(c.lastPaidYear)||!Number.isInteger(c.lastPaidYear)||c.lastPaidYear<MIN_YEAR||c.lastPaidYear>MAX_YEAR)) issues.push('employment contract '+key+' has invalid or out-of-bound lastPaidYear');
      if(!Array.isArray(c.history)) issues.push('employment contract '+key+' history must be an array');
      else if(c.history.length>HISTORY_LIMIT) issues.push('employment contract '+key+' history exceeds limit of '+HISTORY_LIMIT);
      if(ACTIVE_STATUSES.has(c.status)){
        (activeByPerson[c.personId]=activeByPerson[c.personId]||[]).push(c.id);
        if(business){ (businessEmployeeExpectation[business.id]=businessEmployeeExpectation[business.id]||new Set()).add(c.personId); }
      }
    });
    Object.keys(activeByPerson).forEach(personId=>{
      if(activeByPerson[personId].length>1) issues.push('person '+personId+' has multiple active/on_leave employment contracts: '+activeByPerson[personId].join(','));
    });
    if(world.businesses&&typeof world.businesses==='object'){
      Object.keys(world.businesses).forEach(businessId=>{
        const business=world.businesses[businessId];
        if(!business||typeof business!=='object') return;
        const expected=businessEmployeeExpectation[businessId]?[...businessEmployeeExpectation[businessId]].sort():[];
        const actual=Array.isArray(business.employeeIds)?business.employeeIds.slice().sort():[];
        if(JSON.stringify(expected)!==JSON.stringify(actual)) issues.push('business '+businessId+' employeeIds do not match active employment contracts');
      });
    }
    if(Number(world.employmentContractCounter)<highestId) issues.push('employmentContractCounter is behind the highest employment contract id');
    return issues;
  }

  /* ---- legacy reconciliation ---- */

  const CAREER_SECTOR_MAP={
    academia:['education'],medicine:['healthcare'],law:['government','professional'],
    engineering:['construction','manufacturing'],architecture:['professional','construction'],
    business:['finance','professional'],trade:['manufacturing'],construction:['construction'],
    transport:['transport'],agriculture:['agriculture'],retail:['retail'],public:['government'],
    arts:['professional'],athletics:['professional'],underworld:['professional']
  };
  function sectorsForCareer(careerId){
    return CAREER_SECTOR_MAP[careerId]||['professional'];
  }

  const JOB_NAME_SECTOR_RULES=[
    {sector:'agriculture',keywords:['farm','agricultural']},
    {sector:'manufacturing',keywords:['warehouse','machinist','factory']},
    {sector:'construction',keywords:['carpenter','construction','builder']},
    {sector:'transport',keywords:['courier','transport','driver','postal']},
    {sector:'retail',keywords:['shop','retail','kitchen','market']},
    {sector:'finance',keywords:['bank','accountant','finance']},
    {sector:'healthcare',keywords:['physician','hospital','nurse','medical']},
    {sector:'education',keywords:['teacher','school','professor','education']},
    {sector:'government',keywords:['clerk','ministry','magistrate','official','sweeper']}
  ];
  function sectorForJobName(name){
    const lower=String(name||'').toLowerCase();
    for(let i=0;i<JOB_NAME_SECTOR_RULES.length;i++){
      const rule=JOB_NAME_SECTOR_RULES[i];
      if(rule.keywords.some(keyword=>lower.indexOf(keyword)!==-1)) return rule.sector;
    }
    return 'professional';
  }
  function normalizedJobSlug(name){
    return String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'worker';
  }

  function deterministicIndex(key,length){
    if(length<=0) return -1;
    return root.Random.hashSeed(key)%length;
  }

  function settlementNameOf(settlementId){
    if(typeof settlementById==='function'){
      const settlement=settlementById(settlementId);
      if(settlement&&settlement.name) return settlement.name;
    }
    return settlementId;
  }

  const SECTOR_FALLBACK_LABEL={
    agriculture:'Agricultural Placement Office',
    manufacturing:'Industrial Placement Office',
    construction:'Construction Placement Office',
    transport:'Transport Placement Office',
    retail:'Retail Placement Office',
    finance:'Finance Placement Office',
    healthcare:'Healthcare Placement Office',
    education:'Education Placement Office',
    government:'Civil Placement Office',
    professional:'Employment Bureau'
  };

  function settlementBusinessInventory(world,settlementId){
    const all=root.BusinessSystem?root.BusinessSystem.forSettlement(world,settlementId):[];
    const open=all.filter(b=>b.status!=='closed');
    return {all,open};
  }

  function maxBusinessesPerSettlement(){
    return Number.isFinite(root.BusinessSystem&&root.BusinessSystem.MAX_BUSINESSES_PER_SETTLEMENT)?root.BusinessSystem.MAX_BUSINESSES_PER_SETTLEMENT:12;
  }

  function fallbackBusinessName(settlementId,primarySector){
    return settlementNameOf(settlementId)+' '+(SECTOR_FALLBACK_LABEL[primarySector]||'Employment Bureau');
  }

  // Pure lookup: never creates a business. Used both by employer selection and
  // by compatibility checks, so evaluating compatibility can never have the
  // side effect of creating a fallback business.
  function resolveExistingEmployer(world,personId,settlementId,occupationType,occupationId,sectors){
    if(!root.BusinessSystem) return null;
    const {all,open}=settlementBusinessInventory(world,settlementId);
    const compatibleOpen=open.filter(b=>sectors.includes(b.sector)).sort((a,b)=>a.id.localeCompare(b.id));
    if(compatibleOpen.length){
      const key=[world.seed,personId,occupationType,occupationId||''].join('|');
      const idx=deterministicIndex(key,compatibleOpen.length);
      return compatibleOpen[idx];
    }
    if(all.length>=maxBusinessesPerSettlement()){
      const stableSorted=open.slice().sort((a,b)=>a.id.localeCompare(b.id));
      return stableSorted.length?stableSorted[0]:null;
    }
    const primarySector=sectors[0];
    const fallbackName=fallbackBusinessName(settlementId,primarySector);
    return open.find(b=>b.name===fallbackName&&b.sector===primarySector)||null;
  }

  function chooseEmployer(world,personId,settlementId,occupationType,occupationId,sectors){
    if(!root.BusinessSystem) return null;
    const existing=resolveExistingEmployer(world,personId,settlementId,occupationType,occupationId,sectors);
    if(existing) return existing;
    const {all}=settlementBusinessInventory(world,settlementId);
    if(all.length>=maxBusinessesPerSettlement()) return null;
    const primarySector=sectors[0];
    return root.BusinessSystem.create(world,{settlementId,sector:primarySector,name:fallbackBusinessName(settlementId,primarySector)});
  }

  function occupationIdsMatch(a,b){
    const an=a==null?null:String(a);
    const bn=b==null?null:String(b);
    return an===bn;
  }

  function isContractCompatible(world,existing,descriptor,sectors){
    if(existing.settlementId!==descriptor.settlementId) return false;
    if(existing.occupationType!==descriptor.occupationType) return false;
    if(!occupationIdsMatch(existing.occupationId,descriptor.occupationId)) return false;
    const business=getBusiness(world,existing.businessId);
    if(!business||business.status==='closed') return false;
    if(sectors.includes(business.sector)) return true;
    const candidate=resolveExistingEmployer(world,String(descriptor.personId),descriptor.settlementId,descriptor.occupationType,descriptor.occupationId,sectors);
    return !!candidate&&candidate.id===business.id;
  }

  function reconcilePerson(world,descriptor,options){
    ensure(world);
    const opts=options||{};
    const personId=String(descriptor.personId);
    const year=boundedYear(descriptor.year,boundedYear(world.year,0));
    let existing=activeForPerson(world,personId)[0]||null;
    if(!descriptor.employed){
      if(existing) endInternal(world,existing,'resigned',opts.unemployedReason||'legacy_unemployed',year);
      return existing?get(world,existing.id):null;
    }
    const sectors=Array.isArray(descriptor.sectors)&&descriptor.sectors.length?descriptor.sectors:['professional'];
    if(existing){
      if(isContractCompatible(world,existing,descriptor,sectors)){
        existing.occupationName=descriptor.occupationName||existing.occupationName;
        existing.careerStage=(descriptor.careerStage!=null&&Number.isFinite(Number(descriptor.careerStage))&&Number(descriptor.careerStage)>=0)?Math.round(Number(descriptor.careerStage)):null;
        existing.jobTier=clampInt(descriptor.jobTier,0,5,existing.jobTier);
        existing.annualSalary=boundedSalary(descriptor.annualSalary,existing.annualSalary);
        return existing;
      }
      const reason=existing.settlementId!==descriptor.settlementId?'worker_relocated':'employment_changed';
      endInternal(world,existing,'terminated',reason,year);
      existing=null;
    }
    const business=chooseEmployer(world,personId,descriptor.settlementId,descriptor.occupationType,descriptor.occupationId,sectors);
    if(!business) return null;
    return hire(world,{
      personId,
      businessId:business.id,
      occupationType:descriptor.occupationType,
      occupationId:descriptor.occupationId,
      occupationName:descriptor.occupationName,
      careerStage:descriptor.careerStage,
      jobTier:descriptor.jobTier,
      annualSalary:descriptor.annualSalary,
      hiredYear:year
    });
  }

  function reconcilePlayer(world,subject){
    ensure(world);
    if(!subject) return null;
    const settlementId=(subject.location&&subject.location.settlementId)||world.activeSettlementId;
    const employed=!!subject.career||Number(subject.jobTier)>0;
    let descriptor;
    if(!employed){
      descriptor={personId:'subject',employed:false,year:world.year};
    } else if(subject.career){
      const track=typeof CAREERS!=='undefined'?CAREERS.find(c=>c.id===subject.career):null;
      const stageIdx=Math.max(0,Number(subject.jobTier)-1);
      const stage=track&&track.stages&&track.stages[stageIdx];
      descriptor={
        personId:'subject',employed:true,settlementId,
        occupationType:'career',occupationId:subject.career,
        occupationName:stage?stage.name:(subject.jobName||'Worker'),
        careerStage:stageIdx,jobTier:clampInt(subject.jobTier,1,5,1),
        annualSalary:stage?stage.salary:(typeof INC!=='undefined'?(INC[subject.jobTier]||0):0),
        sectors:sectorsForCareer(subject.career),year:world.year
      };
    } else {
      descriptor={
        personId:'subject',employed:true,settlementId,
        occupationType:'job',occupationId:normalizedJobSlug(subject.jobName),
        occupationName:subject.jobName||'Worker',careerStage:null,
        jobTier:clampInt(subject.jobTier,1,5,1),
        annualSalary:typeof INC!=='undefined'?(INC[subject.jobTier]||0):0,
        sectors:[sectorForJobName(subject.jobName)],year:world.year
      };
    }
    const contract=reconcilePerson(world,descriptor,{unemployedReason:'legacy_unemployed'});
    subject.employmentContractId=(contract&&ACTIVE_STATUSES.has(contract.status))?contract.id:null;
    return contract;
  }

  function reconcileNpcs(world){
    ensure(world);
    if(!world.npcs||typeof world.npcs!=='object') return [];
    const results=[];
    Object.keys(world.npcs).sort().forEach(id=>{
      const npc=world.npcs[id];
      if(!npc||npc.isSubject) return;
      const year=boundedYear(world.year,0);
      if(npc.alive===false){
        const existing=activeForPerson(world,id)[0];
        if(existing) endInternal(world,existing,'terminated','npc_deceased',year);
        return;
      }
      const age=Number.isFinite(Number(npc.birthYear))?year-Number(npc.birthYear):null;
      if(age==null||age<16){
        const existing=activeForPerson(world,id)[0];
        if(existing) endInternal(world,existing,'terminated','npc_underage',year);
        return;
      }
      const employment=npc.employment||{};
      if(employment.status!=='employed'){
        const existing=activeForPerson(world,id)[0];
        if(existing) endInternal(world,existing,'resigned','legacy_unemployed',year);
        return;
      }
      const jobTier=1;
      const salary=nonNegNumber(employment.income,typeof INC!=='undefined'?(INC[jobTier]||0):0)||(typeof INC!=='undefined'?(INC[jobTier]||0):0);
      const descriptor={
        personId:id,employed:true,settlementId:npc.locationId||world.activeSettlementId,
        occupationType:'generic',occupationId:employment.careerId||null,
        occupationName:employment.sector?String(employment.sector):'Worker',
        careerStage:null,jobTier,annualSalary:salary,
        sectors:[sectorForJobName(employment.sector)],year
      };
      const contract=reconcilePerson(world,descriptor,{unemployedReason:'legacy_unemployed'});
      if(contract) results.push(contract);
    });
    return results;
  }

  root.EmploymentSystem={
    SCHEMA_VERSION,
    CONTRACT_STATUSES,
    WORKER_TYPES,
    ensure,
    migrate,
    create,
    get,
    all,
    forPerson,
    forBusiness,
    activeForPerson,
    activeForBusiness,
    hire,
    end,
    payBusinessPayroll,
    syncBusinessEmployees,
    syncAllBusinessEmployees,
    reconcilePerson,
    reconcilePlayer,
    reconcileNpcs,
    summary,
    checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
