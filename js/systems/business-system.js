'use strict';

(function(root){
  const SCHEMA_VERSION=1;
  const MAX_BUSINESSES_PER_SETTLEMENT=12;
  const HISTORY_LIMIT=48;

  const SECTOR_DEMAND_GROUPS={
    agriculture:'agriculture',
    manufacturing:'manufacturing',
    construction:'manufacturing',
    transport:'services',
    retail:'services',
    finance:'services',
    healthcare:'services',
    education:'services',
    government:'services',
    professional:'services'
  };
  const SECTORS=Object.keys(SECTOR_DEMAND_GROUPS);
  const SECTOR_SET=new Set(SECTORS);

  const KINDS=['private','cooperative','public','nonprofit'];
  const STATUSES=['active','struggling','closed'];

  const SECTOR_SUFFIXES={
    agriculture:'Agricultural Cooperative',
    manufacturing:'Industrial Works',
    construction:'Construction Company',
    transport:'Transit Company',
    retail:'Market Company',
    finance:'Savings Bank',
    healthcare:'Medical Cooperative',
    education:'Education Authority',
    government:'Municipal Office',
    professional:'Professional Bureau'
  };

  const SEED_SECTOR_ORDER=['agriculture','retail','transport','manufacturing','construction','healthcare','education','finance','professional','government'];

  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;

  function isValidCounter(value){
    return typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value)&&value>=0;
  }

  function populationOf(settlement){
    const text=String(settlement&&settlement.population||'0').replace(/[^0-9]/g,'');
    return Math.max(0,Number(text)||0);
  }

  function targetCountForPopulation(population){
    let count;
    if(population<5000) count=3;
    else if(population<20000) count=5;
    else if(population<100000) count=8;
    else count=12;
    return Math.min(MAX_BUSINESSES_PER_SETTLEMENT,count);
  }

  function defaultKindForSector(sector){
    if(sector==='government'||sector==='education') return 'public';
    if(sector==='healthcare') return 'nonprofit';
    if(sector==='agriculture') return 'cooperative';
    return 'private';
  }

  function emptyFinances(){
    return {cash:0,debt:0,revenue:0,expenses:0,payroll:0,profit:0,lastYear:null};
  }

  function normalizeFinances(source){
    const defaults=emptyFinances();
    const finances=source&&typeof source==='object'?source:{};
    return {
      cash:finite(finances.cash,defaults.cash),
      debt:finite(finances.debt,defaults.debt),
      revenue:finite(finances.revenue,defaults.revenue),
      expenses:finite(finances.expenses,defaults.expenses),
      payroll:finite(finances.payroll,defaults.payroll),
      profit:finite(finances.profit,defaults.profit),
      lastYear:finances.lastYear!=null&&Number.isFinite(Number(finances.lastYear))?Number(finances.lastYear):null
    };
  }

  function uniqueStringArray(source){
    if(!Array.isArray(source)) return [];
    const seen=new Set(), out=[];
    source.forEach(item=>{
      if(item==null) return;
      const key=String(item);
      if(seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  function uniqueVacancies(source){
    if(!Array.isArray(source)) return [];
    const seen=new Set(), out=[];
    source.forEach(item=>{
      if(item&&typeof item==='object'&&item.id!=null){
        const key=String(item.id);
        if(seen.has(key)) return;
        seen.add(key);
      }
      out.push(item);
    });
    return out;
  }

  function businessIdNumber(id){
    const match=/^business:(\d{5,})$/.exec(String(id||''));
    return match?Number(match[1]):null;
  }

  function isValidBusinessId(id){
    return typeof id==='string'&&/^business:\d{5,}$/.test(id);
  }

  function highestBusinessIdNumber(world){
    let highest=0;
    Object.keys(world.businesses).forEach(key=>{
      const record=world.businesses[key];
      const keyNum=businessIdNumber(key);
      if(keyNum!=null) highest=Math.max(highest,keyNum);
      const idNum=businessIdNumber(record&&record.id);
      if(idNum!=null) highest=Math.max(highest,idNum);
    });
    return highest;
  }

  function nextBusinessId(world){
    const highest=highestBusinessIdNumber(world);
    let counter=Number.isFinite(Number(world.businessCounter))?Number(world.businessCounter):0;
    if(counter<highest) counter=highest;
    let id;
    do{
      counter+=1;
      id='business:'+String(counter).padStart(5,'0');
    } while(Object.prototype.hasOwnProperty.call(world.businesses,id));
    world.businessCounter=counter;
    return id;
  }

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('BusinessSystem.ensure requires a world object');
    if(!world.businesses||typeof world.businesses!=='object'||Array.isArray(world.businesses)) world.businesses={};
    if(!isValidCounter(world.businessCounter)) world.businessCounter=0;
    world.businessSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function normalizeRecord(id,record,settlementId){
    const sector=SECTOR_SET.has(record&&record.sector)?record.sector:'professional';
    const kind=KINDS.includes(record&&record.kind)?record.kind:defaultKindForSector(sector);
    const status=STATUSES.includes(record&&record.status)?record.status:'active';
    const history=Array.isArray(record&&record.history)?record.history.slice(-HISTORY_LIMIT):[];
    return {
      id,
      name:typeof (record&&record.name)==='string'&&record.name?record.name:id,
      settlementId:(record&&record.settlementId)||settlementId||'',
      sector,
      demandGroup:SECTOR_DEMAND_GROUPS[sector],
      kind,
      status,
      foundedYear:(record&&record.foundedYear)!=null&&Number.isFinite(Number(record.foundedYear))?Number(record.foundedYear):null,
      ownerNpcId:(record&&record.ownerNpcId)!=null?record.ownerNpcId:null,
      employeeIds:uniqueStringArray(record&&record.employeeIds),
      vacancies:uniqueVacancies(record&&record.vacancies),
      finances:normalizeFinances(record&&record.finances),
      history
    };
  }

  function create(world,spec){
    ensure(world);
    spec=spec||{};
    const settlementId=spec.settlementId;
    if(!settlementId||typeof settlementId!=='string') throw new Error('BusinessSystem.create requires a settlementId');
    const sector=spec.sector;
    if(!SECTOR_SET.has(sector)) throw new Error('BusinessSystem.create requires a supported sector, got: '+sector);
    const id=nextBusinessId(world);
    const record={
      id,
      name:typeof spec.name==='string'&&spec.name?spec.name:id,
      settlementId,
      sector,
      demandGroup:SECTOR_DEMAND_GROUPS[sector],
      kind:KINDS.includes(spec.kind)?spec.kind:defaultKindForSector(sector),
      status:STATUSES.includes(spec.status)?spec.status:'active',
      foundedYear:Number.isFinite(Number(spec.foundedYear))?Number(spec.foundedYear):finite(world.year,null),
      ownerNpcId:spec.ownerNpcId!=null?spec.ownerNpcId:null,
      employeeIds:uniqueStringArray(spec.employeeIds),
      vacancies:uniqueVacancies(spec.vacancies).map(v=>v&&typeof v==='object'?Object.assign({},v):v),
      finances:normalizeFinances(spec.finances),
      history:Array.isArray(spec.history)?spec.history.slice(-HISTORY_LIMIT).map(h=>h&&typeof h==='object'?Object.assign({},h):h):[]
    };
    world.businesses[id]=record;
    return record;
  }

  function get(world,businessId){
    ensure(world);
    return world.businesses[businessId]||null;
  }

  function all(world){
    ensure(world);
    return Object.keys(world.businesses).map(id=>world.businesses[id]);
  }

  function forSettlement(world,settlementId){
    return all(world).filter(business=>business.settlementId===settlementId);
  }

  function seedName(settlementName,sector,occurrence){
    const suffix=SECTOR_SUFFIXES[sector]||'Professional Bureau';
    const base=settlementName+' '+suffix;
    return occurrence>1?base+' No. '+occurrence:base;
  }

  function sectorOccurrenceKeys(settlementId,businesses){
    const sorted=businesses.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const occupiedKeys=new Set();
    const sectorCounts={};
    sorted.forEach(business=>{
      sectorCounts[business.sector]=(sectorCounts[business.sector]||0)+1;
      const occurrence=sectorCounts[business.sector];
      occupiedKeys.add(settlementId+'|'+business.sector+'|'+occurrence);
    });
    return occupiedKeys;
  }

  function seedSettlement(world,settlement){
    ensure(world);
    if(!settlement||!settlement.id) return [];
    const settlementId=settlement.id;
    const existing=forSettlement(world,settlementId);
    const target=targetCountForPopulation(populationOf(settlement));
    if(existing.length>=target) return existing;

    const occupiedKeys=sectorOccurrenceKeys(settlementId,existing);
    const created=existing.slice();
    let sectorIndex=0;
    const occurrenceBySector={};
    while(created.length<target){
      const sector=SEED_SECTOR_ORDER[sectorIndex%SEED_SECTOR_ORDER.length];
      sectorIndex++;
      occurrenceBySector[sector]=(occurrenceBySector[sector]||0)+1;
      const occurrence=occurrenceBySector[sector];
      const key=settlementId+'|'+sector+'|'+occurrence;
      if(occupiedKeys.has(key)) continue;
      const name=seedName(settlement.name||settlementId,sector,occurrence);
      const record=create(world,{settlementId,sector,name,foundedYear:settlement.foundedYear});
      occupiedKeys.add(key);
      created.push(record);
    }
    return created;
  }

  function seedWorld(world,settlementDefinitions){
    ensure(world);
    const defs=Array.isArray(settlementDefinitions)?settlementDefinitions:[];
    defs.forEach(settlement=>{ if(settlement&&settlement.id) seedSettlement(world,settlement); });
    return world;
  }

  function summary(world,settlementId){
    ensure(world);
    const businesses=settlementId?forSettlement(world,settlementId):all(world);
    const result={total:0,active:0,struggling:0,closed:0,employees:0,vacancies:0,bySector:{}};
    const employeeSet=new Set();
    businesses.forEach(business=>{
      result.total++;
      if(business.status==='active') result.active++;
      else if(business.status==='struggling') result.struggling++;
      else if(business.status==='closed') result.closed++;
      (business.employeeIds||[]).forEach(id=>employeeSet.add(id));
      result.vacancies+=Array.isArray(business.vacancies)?business.vacancies.length:0;
      result.bySector[business.sector]=(result.bySector[business.sector]||0)+1;
    });
    result.employees=employeeSet.size;
    return result;
  }

  function migrate(world,settlementDefinitions){
    ensure(world);

    const rawKeys=Object.keys(world.businesses).sort();
    const normalized={};
    const usedIds=new Set();

    function allocateId(){
      let candidate;
      do{
        world.businessCounter+=1;
        candidate='business:'+String(world.businessCounter).padStart(5,'0');
      } while(usedIds.has(candidate));
      return candidate;
    }

    rawKeys.forEach(key=>{
      const raw=world.businesses[key];
      const record=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:Object.assign({settlementId:'unassigned'},typeof raw==='string'&&raw?{name:raw}:{});
      const recordId=record.id;
      let finalId;
      if(isValidBusinessId(recordId)&&!usedIds.has(recordId)){
        finalId=recordId;
      } else if(isValidBusinessId(key)&&!usedIds.has(key)){
        finalId=key;
      } else {
        finalId=allocateId();
      }
      usedIds.add(finalId);
      normalized[finalId]=normalizeRecord(finalId,record,record.settlementId);
    });
    world.businesses=normalized;
    const defs=Array.isArray(settlementDefinitions)?settlementDefinitions:[];
    seedWorld(world,defs);

    const highest=highestBusinessIdNumber(world);
    if(world.businessCounter<highest) world.businessCounter=highest;
    world.businessSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function checkInvariants(world){
    const issues=[];
    if(!world||typeof world!=='object'||!world.businesses||typeof world.businesses!=='object'||Array.isArray(world.businesses)){
      issues.push('businesses must be an object');
      return issues;
    }
    if(typeof world.businessCounter!=='number'||!Number.isFinite(world.businessCounter)||world.businessCounter<0||!Number.isInteger(world.businessCounter)){
      issues.push('businessCounter must be a finite non-negative integer');
    }
    const ids=new Set();
    const perSettlementCount={};
    Object.keys(world.businesses).forEach(key=>{
      const business=world.businesses[key];
      if(!business||typeof business!=='object'){ issues.push('business at key '+key+' is not an object'); return; }
      if(!/^business:\d{5,}$/.test(String(business.id))) issues.push('business '+key+' has invalid id format: '+business.id);
      if(business.id!==key) issues.push('business key '+key+' does not match record id '+business.id);
      if(ids.has(business.id)) issues.push('duplicate business id: '+business.id);
      ids.add(business.id);
      if(!SECTOR_SET.has(business.sector)) issues.push('business '+key+' has unsupported sector: '+business.sector);
      else if(business.demandGroup!==SECTOR_DEMAND_GROUPS[business.sector]) issues.push('business '+key+' has mismatched demandGroup');
      if(!business.settlementId||typeof business.settlementId!=='string') issues.push('business '+key+' missing settlementId');
      if(!KINDS.includes(business.kind)) issues.push('business '+key+' has invalid kind: '+business.kind);
      if(!STATUSES.includes(business.status)) issues.push('business '+key+' has invalid status: '+business.status);
      if(!Array.isArray(business.employeeIds)) issues.push('business '+key+' employeeIds must be an array');
      else if(new Set(business.employeeIds.map(String)).size!==business.employeeIds.length) issues.push('business '+key+' has duplicate employeeIds');
      if(!Array.isArray(business.vacancies)) issues.push('business '+key+' vacancies must be an array');
      if(!business.finances||typeof business.finances!=='object') issues.push('business '+key+' missing finances');
      else {
        ['cash','debt','revenue','expenses','payroll','profit'].forEach(field=>{
          const value=business.finances[field];
          if(typeof value!=='number'||!Number.isFinite(value)) issues.push('business '+key+' has non-finite finances.'+field);
        });
        const lastYear=business.finances.lastYear;
        if(lastYear!=null&&(typeof lastYear!=='number'||!Number.isFinite(lastYear))) issues.push('business '+key+' has invalid finances.lastYear');
      }
      if(!Array.isArray(business.history)) issues.push('business '+key+' history must be an array');
      else if(business.history.length>HISTORY_LIMIT) issues.push('business '+key+' history exceeds limit of '+HISTORY_LIMIT);
      if(business.settlementId){
        perSettlementCount[business.settlementId]=(perSettlementCount[business.settlementId]||0)+1;
      }
    });
    Object.keys(perSettlementCount).forEach(settlementId=>{
      if(perSettlementCount[settlementId]>MAX_BUSINESSES_PER_SETTLEMENT) issues.push('settlement '+settlementId+' has more than '+MAX_BUSINESSES_PER_SETTLEMENT+' businesses');
    });
    let highestId=0;
    ids.forEach(id=>{ const num=businessIdNumber(id); if(num!=null) highestId=Math.max(highestId,num); });
    if(Number(world.businessCounter)<highestId) issues.push('businessCounter is behind the highest business id');
    return issues;
  }

  root.BusinessSystem={
    SECTORS,
    SCHEMA_VERSION,
    ensure,
    migrate,
    create,
    get,
    all,
    forSettlement,
    seedSettlement,
    seedWorld,
    summary,
    checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
