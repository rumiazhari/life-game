'use strict';

(function(root){
  const SCHEMA_VERSION=1;
  const MIN_YEAR=-5000;
  const MAX_YEAR=5000;
  const SUPERVISOR_MODIFIER_SCALE=10;
  const NOISE_RANGE=0.04;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clampUnit=(value,fallback)=>Number.isFinite(Number(value))?clamp(Number(value),0,1):fallback;
  const round4=value=>Math.round(value*10000)/10000;
  const boundedYear=(value,fallback)=>{
    const safeFallback=fallback!=null&&Number.isFinite(Number(fallback))?Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(fallback)))):0;
    if(value==null||!Number.isFinite(Number(value))) return safeFallback;
    return Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(value))));
  };
  const boundedYearOrNull=value=>value==null||!Number.isFinite(Number(value))?null:boundedYear(value,0);

  function isWorkforceStatus(status){
    return status==='active'||status==='on_leave';
  }

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('WorkplaceSystem.ensure requires a world object');
    world.workplaceLastTickYear=boundedYearOrNull(world.workplaceLastTickYear);
    world.workplaceSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function migrate(world){
    ensure(world);
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.all==='function'){
      root.EmploymentSystem.all(world).forEach(contract=>{
        if(typeof contract.workplaceStress!=='number'||!Number.isFinite(contract.workplaceStress)){
          contract.workplaceStress=0.35;
        }
        contract.workplaceStress=round4(clamp(contract.workplaceStress,0,1));
        contract.workplaceLastTickYear=boundedYearOrNull(contract.workplaceLastTickYear);
        if(contract.supervisorPersonId!=null&&(typeof contract.supervisorPersonId!=='string'||!contract.supervisorPersonId||contract.supervisorPersonId===contract.personId||!isWorkforceStatus(contract.status))){
          contract.supervisorPersonId=null;
        }
      });
    }
    syncAll(world,{year:boundedYear(world.year,0),recordMemories:false});
    world.workplaceSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function contractsForBusiness(world,businessId){
    if(!root.EmploymentSystem||typeof root.EmploymentSystem.activeForBusiness!=='function') return [];
    return root.EmploymentSystem.activeForBusiness(world,businessId).slice().sort((a,b)=>a.id.localeCompare(b.id));
  }

  function coworkerContracts(world,contractId){
    if(!root.EmploymentSystem||typeof root.EmploymentSystem.get!=='function') return [];
    const contract=root.EmploymentSystem.get(world,contractId);
    if(!contract||!isWorkforceStatus(contract.status)) return [];
    return contractsForBusiness(world,contract.businessId).filter(c=>c.id!==contract.id);
  }

  function coworkerPersonIds(world,contractId){
    if(!root.EmploymentSystem||typeof root.EmploymentSystem.get!=='function') return [];
    const contract=root.EmploymentSystem.get(world,contractId);
    const subjectPersonId=contract?contract.personId:null;
    const ids=new Set();
    coworkerContracts(world,contractId).forEach(c=>{
      if(c.personId!==subjectPersonId) ids.add(c.personId);
    });
    return Array.from(ids).sort();
  }

  function supervisorContract(world,contractId){
    if(!root.EmploymentSystem||typeof root.EmploymentSystem.get!=='function') return null;
    const contract=root.EmploymentSystem.get(world,contractId);
    if(!contract||!contract.supervisorPersonId) return null;
    const candidates=root.EmploymentSystem.activeForBusiness(world,contract.businessId);
    const match=candidates.find(c=>c.personId===contract.supervisorPersonId&&c.status==='active');
    return match||null;
  }

  function directReportContracts(world,contractId){
    if(!root.EmploymentSystem||typeof root.EmploymentSystem.get!=='function') return [];
    const contract=root.EmploymentSystem.get(world,contractId);
    if(!contract) return [];
    return contractsForBusiness(world,contract.businessId)
      .filter(c=>c.supervisorPersonId===contract.personId)
      .sort((a,b)=>a.id.localeCompare(b.id));
  }

  function careerStageRank(careerStage){
    return careerStage==null?-1:careerStage;
  }

  function rankSupervisorCandidates(workforce){
    return workforce.filter(c=>c.status==='active').slice().sort((a,b)=>
      (b.jobTier-a.jobTier)||
      (careerStageRank(b.careerStage)-careerStageRank(a.careerStage))||
      (b.performance-a.performance)||
      (a.hiredYear-b.hiredYear)||
      a.id.localeCompare(b.id)
    );
  }

  function syncBusiness(world,businessId,options){
    ensure(world);
    const opts=options||{};
    const year=boundedYear(opts.year,boundedYear(world.year,0));
    const recordMemories=opts.recordMemories===true;
    const result={assignmentsChanged:0,memoriesAdded:0};
    if(!root.EmploymentSystem||typeof root.EmploymentSystem.forBusiness!=='function'||!businessId) return result;

    const business=root.BusinessSystem&&typeof root.BusinessSystem.get==='function'?root.BusinessSystem.get(world,businessId):null;
    const allContracts=root.EmploymentSystem.forBusiness(world,businessId).slice().sort((a,b)=>a.id.localeCompare(b.id));
    const workforce=allContracts.filter(c=>isWorkforceStatus(c.status));
    const nonWorkforce=allContracts.filter(c=>!isWorkforceStatus(c.status));

    nonWorkforce.forEach(c=>{
      if(c.supervisorPersonId!=null) c.supervisorPersonId=null;
    });

    const businessClosed=!business||business.status==='closed';
    let leadPersonId=null;
    if(!businessClosed&&workforce.length>=2){
      const ranked=rankSupervisorCandidates(workforce);
      if(ranked.length) leadPersonId=ranked[0].personId;
    }

    workforce.forEach(worker=>{
      const desired=(!businessClosed&&leadPersonId&&leadPersonId!==worker.personId)?leadPersonId:null;
      const previous=worker.supervisorPersonId!=null?worker.supervisorPersonId:null;
      if(previous===desired) return;
      worker.supervisorPersonId=desired;
      result.assignmentsChanged++;
      if(recordMemories&&root.RelationshipMemory&&typeof root.RelationshipMemory.add==='function'){
        if(previous&&previous!==worker.personId){
          const added=root.RelationshipMemory.add(world,{
            year,
            type:'workplace_supervision_ended',
            participants:[worker.personId,previous],
            intensity:0.2,
            valence:0,
            decay:0.04,
            summary:'A workplace supervision assignment ended.',
            tags:['workplace','supervision']
          });
          if(added) result.memoriesAdded++;
        }
        if(desired&&desired!==worker.personId){
          const added=root.RelationshipMemory.add(world,{
            year,
            type:'workplace_supervision_started',
            participants:[worker.personId,desired],
            intensity:0.25,
            valence:0,
            decay:0.035,
            summary:'A workplace supervision assignment began.',
            tags:['workplace','supervision']
          });
          if(added) result.memoriesAdded++;
        }
      }
    });

    return result;
  }

  function syncAll(world,options){
    ensure(world);
    const opts=options||{};
    const businesses=root.BusinessSystem&&typeof root.BusinessSystem.all==='function'
      ?root.BusinessSystem.all(world).slice().sort((a,b)=>a.id.localeCompare(b.id)):[];
    let assignmentsChanged=0, memoriesAdded=0;
    businesses.forEach(business=>{
      const result=syncBusiness(world,business.id,opts);
      assignmentsChanged+=result.assignmentsChanged;
      memoriesAdded+=result.memoriesAdded;
    });
    return {businesses:businesses.length,assignmentsChanged,memoriesAdded};
  }

  function computeBusinessPressure(business){
    if(!business||business.status==='closed') return 1;
    if(business.status==='struggling') return 0.65;
    const profit=business.finances&&Number.isFinite(Number(business.finances.profit))?Number(business.finances.profit):0;
    return profit>=0?0.20:0.38;
  }

  function stressInputs(world,contract){
    const business=contract&&root.BusinessSystem&&typeof root.BusinessSystem.get==='function'?root.BusinessSystem.get(world,contract.businessId):null;
    const staffingCount=contract?contractsForBusiness(world,contract.businessId).length:0;
    const targetWorkers=(business&&root.VacancySystem&&typeof root.VacancySystem.targetWorkers==='function')
      ?root.VacancySystem.targetWorkers(world,business)
      :Math.max(1,staffingCount);
    const businessPressure=computeBusinessPressure(business);
    const understaffing=clamp(Math.max(0,targetWorkers-staffingCount)/Math.max(1,targetWorkers),0,1);

    let supervisorConflict=0, supervisorTrustRelief=0;
    const supervisorPersonId=contract?contract.supervisorPersonId:null;
    if(supervisorPersonId&&contract&&root.RelationshipMemory&&typeof root.RelationshipMemory.modifier==='function'){
      const mod=root.RelationshipMemory.modifier(world,contract.personId,supervisorPersonId,boundedYear(world.year,0));
      if(mod){
        supervisorConflict=clamp(Math.max(0,mod.conflict||0)/SUPERVISOR_MODIFIER_SCALE,0,1);
        supervisorTrustRelief=clamp(Math.max(0,mod.trust||0)/SUPERVISOR_MODIFIER_SCALE,0,1);
      }
    }

    return {
      currentStress:contract&&typeof contract.workplaceStress==='number'&&Number.isFinite(contract.workplaceStress)?contract.workplaceStress:0.35,
      businessPressure,
      understaffing,
      supervisorConflict,
      supervisorTrustRelief,
      staffingCount,
      targetWorkers,
      businessStatus:business?business.status:'missing',
      contractStatus:contract?contract.status:null
    };
  }

  function tickContract(world,contract,year){
    ensure(world);
    if(!contract) return {applied:false,reason:'missing_contract'};
    if(!isWorkforceStatus(contract.status)) return {applied:false,reason:'contract_ended'};
    const y=boundedYear(year,boundedYear(world.year,0));
    if(contract.workplaceLastTickYear===y) return {applied:false,reason:'already_applied'};
    if(contract.workplaceLastTickYear!=null&&y<contract.workplaceLastTickYear) return {applied:false,reason:'stale_year'};

    const inputs=stressInputs(world,contract);
    const stream=root.WorldSimulation&&typeof root.WorldSimulation.streamFor==='function'
      ?root.WorldSimulation.streamFor(world,y,contract.id,'workplace-stress'):null;
    const noise=stream?(stream.next()*NOISE_RANGE*2-NOISE_RANGE):0;

    let target=
      inputs.businessPressure*0.45+
      inputs.understaffing*0.25+
      inputs.supervisorConflict*0.20+
      inputs.supervisorTrustRelief*-0.10+
      noise;
    if(contract.status==='on_leave') target-=0.12;
    target=clamp(target,0,1);

    const nextStress=round4(clamp(inputs.currentStress*0.60+target*0.40,0,1));
    contract.workplaceStress=nextStress;
    contract.workplaceLastTickYear=y;

    return {applied:true,stress:nextStress,target:round4(target)};
  }

  function tickWorld(world,options){
    ensure(world);
    migrate(world);
    const opts=options||{};
    const year=boundedYear(opts.year,boundedYear(world.year,0));
    if(world.workplaceLastTickYear===year) return {applied:false,reason:'already_applied',year};
    if(world.workplaceLastTickYear!=null&&year<world.workplaceLastTickYear) return {applied:false,reason:'stale_year',year};

    const syncResult=syncAll(world,{year,recordMemories:true});

    let contractsTicked=0;
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.all==='function'){
      root.EmploymentSystem.all(world)
        .filter(c=>isWorkforceStatus(c.status))
        .slice().sort((a,b)=>a.id.localeCompare(b.id))
        .forEach(contract=>{
          const result=tickContract(world,contract,year);
          if(result.applied) contractsTicked++;
        });
    }

    world.workplaceLastTickYear=year;

    return {
      applied:true,year,
      businesses:syncResult.businesses,
      assignmentsChanged:syncResult.assignmentsChanged,
      contractsTicked,
      memoriesAdded:syncResult.memoriesAdded
    };
  }

  function summary(world,options){
    ensure(world);
    const businesses=root.BusinessSystem&&typeof root.BusinessSystem.all==='function'?root.BusinessSystem.all(world):[];
    const contracts=root.EmploymentSystem&&typeof root.EmploymentSystem.all==='function'?root.EmploymentSystem.all(world):[];
    const workforce=contracts.filter(c=>isWorkforceStatus(c.status));
    const withSupervisor=workforce.filter(c=>c.supervisorPersonId);
    const averageStress=workforce.length
      ?round4(workforce.reduce((sum,c)=>sum+(Number.isFinite(c.workplaceStress)?c.workplaceStress:0),0)/workforce.length)
      :0;
    return {
      businesses:businesses.length,
      workforceContracts:workforce.length,
      withSupervisor:withSupervisor.length,
      averageStress
    };
  }

  function checkInvariants(world){
    const issues=[];
    if(!world||typeof world!=='object'){
      issues.push('workplace: world must be an object');
      return issues;
    }
    if(typeof world.workplaceSchemaVersion!=='number'||!Number.isFinite(world.workplaceSchemaVersion)||world.workplaceSchemaVersion!==SCHEMA_VERSION){
      issues.push('workplaceSchemaVersion must equal '+SCHEMA_VERSION);
    }
    if(world.workplaceLastTickYear!=null&&(typeof world.workplaceLastTickYear!=='number'||!Number.isFinite(world.workplaceLastTickYear)||!Number.isInteger(world.workplaceLastTickYear)||world.workplaceLastTickYear<MIN_YEAR||world.workplaceLastTickYear>MAX_YEAR)){
      issues.push('workplaceLastTickYear must be null or a bounded integer');
    }
    if(!root.EmploymentSystem||typeof root.EmploymentSystem.all!=='function') return issues;

    const contracts=root.EmploymentSystem.all(world);

    contracts.forEach(c=>{
      if(typeof c.workplaceStress!=='number'||!Number.isFinite(c.workplaceStress)||c.workplaceStress<0||c.workplaceStress>1){
        issues.push('workplace contract '+c.id+' has invalid workplaceStress: '+c.workplaceStress);
      }
      if(c.workplaceLastTickYear!=null&&(typeof c.workplaceLastTickYear!=='number'||!Number.isFinite(c.workplaceLastTickYear)||!Number.isInteger(c.workplaceLastTickYear)||c.workplaceLastTickYear<MIN_YEAR||c.workplaceLastTickYear>MAX_YEAR)){
        issues.push('workplace contract '+c.id+' has invalid or out-of-bound workplaceLastTickYear');
      }
      const supervisorId=c.supervisorPersonId;
      if(supervisorId==null) return;

      if(!isWorkforceStatus(c.status)){
        issues.push('workplace contract '+c.id+' is ended but retains supervisorPersonId');
        return;
      }
      if(supervisorId===c.personId){
        issues.push('workplace contract '+c.id+' supervises itself');
        return;
      }
      const supervisorWorkforceContract=contracts.find(other=>other.personId===supervisorId&&isWorkforceStatus(other.status));
      if(!supervisorWorkforceContract){
        issues.push('workplace contract '+c.id+' references a supervisor with no active contract: '+supervisorId);
      } else {
        if(supervisorWorkforceContract.businessId!==c.businessId){
          issues.push('workplace contract '+c.id+' references a supervisor at another business: '+supervisorId);
        }
        if(supervisorWorkforceContract.status==='on_leave'){
          issues.push('workplace contract '+c.id+' references an on_leave supervisor: '+supervisorId);
        }
      }
      const business=root.BusinessSystem&&typeof root.BusinessSystem.get==='function'?root.BusinessSystem.get(world,c.businessId):null;
      if(!business||business.status==='closed'){
        issues.push('workplace contract '+c.id+' at a missing or closed business retains a supervisor assignment');
      }
    });

    contracts.filter(c=>isWorkforceStatus(c.status)&&c.supervisorPersonId).forEach(c=>{
      const seen=new Set([c.personId]);
      let current=c;
      let steps=0;
      while(current&&current.supervisorPersonId&&steps<=contracts.length){
        if(seen.has(current.supervisorPersonId)){
          issues.push('workplace supervisor cycle detected involving contract '+c.id);
          return;
        }
        seen.add(current.supervisorPersonId);
        current=contracts.find(other=>other.personId===current.supervisorPersonId&&isWorkforceStatus(other.status)&&other.businessId===c.businessId);
        steps++;
      }
    });

    contracts.filter(c=>isWorkforceStatus(c.status)).forEach(c=>{
      const ids=coworkerPersonIds(world,c.id);
      const unique=new Set(ids);
      if(unique.size!==ids.length) issues.push('workplace contract '+c.id+' coworker projection has duplicate person IDs');
      if(ids.includes(c.personId)) issues.push('workplace contract '+c.id+' coworker projection includes the queried worker');
    });

    return issues;
  }

  root.WorkplaceSystem={
    SCHEMA_VERSION,
    ensure,
    migrate,
    contractsForBusiness,
    coworkerContracts,
    coworkerPersonIds,
    supervisorContract,
    directReportContracts,
    syncBusiness,
    syncAll,
    stressInputs,
    tickContract,
    tickWorld,
    summary,
    checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
