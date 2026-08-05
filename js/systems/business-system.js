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

  const SECTOR_BASE_REVENUE={
    agriculture:10500,
    manufacturing:18000,
    construction:16500,
    transport:13000,
    retail:12500,
    finance:22000,
    healthcare:14500,
    education:12000,
    government:13500,
    professional:17500
  };

  const SECTOR_OPERATING_RATIO={
    agriculture:0.42,
    manufacturing:0.50,
    construction:0.46,
    transport:0.44,
    retail:0.38,
    finance:0.30,
    healthcare:0.48,
    education:0.44,
    government:0.46,
    professional:0.32
  };

  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  function isValidCounter(value){
    return typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value)&&value>=0;
  }

  function nonNegInt(value,fallback){
    if(value==null||!Number.isFinite(Number(value))) return fallback;
    const n=Math.round(Number(value));
    return n>=0?n:fallback;
  }
  function finiteIntOrNull(value){
    return value!=null&&Number.isFinite(Number(value))?Math.round(Number(value)):null;
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

  function normalizeRecord(id,record,settlementId,year){
    const sector=SECTOR_SET.has(record&&record.sector)?record.sector:'professional';
    const kind=KINDS.includes(record&&record.kind)?record.kind:defaultKindForSector(sector);
    const status=STATUSES.includes(record&&record.status)?record.status:'active';
    const history=Array.isArray(record&&record.history)?record.history.slice(-HISTORY_LIMIT):[];
    let closedYear=finiteIntOrNull(record&&record.closedYear);
    if(status==='closed'){ if(closedYear==null) closedYear=finiteIntOrNull(year); } else closedYear=null;
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
      lastTickYear:finiteIntOrNull(record&&record.lastTickYear),
      strugglingYears:nonNegInt(record&&record.strugglingYears,0),
      closedYear,
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
      lastTickYear:finiteIntOrNull(spec.lastTickYear),
      strugglingYears:nonNegInt(spec.strugglingYears,0),
      closedYear:STATUSES.includes(spec.status)&&spec.status==='closed'?finiteIntOrNull(spec.closedYear!=null?spec.closedYear:world.year):null,
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
    let reserveHighest=0;
    rawKeys.forEach(key=>{
      const raw=world.businesses[key];
      const keyNum=businessIdNumber(key);
      if(keyNum!=null) reserveHighest=Math.max(reserveHighest,keyNum);
      if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
        const idNum=businessIdNumber(raw.id);
        if(idNum!=null) reserveHighest=Math.max(reserveHighest,idNum);
      }
    });
    if(world.businessCounter<reserveHighest) world.businessCounter=reserveHighest;

    const usedIds=new Set();
    const assignments=[];

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
      assignments.push({finalId,record});
    });
    assignments.sort((a,b)=>a.finalId.localeCompare(b.finalId));
    const migrationYear=Math.round(finite(world.year,0));
    const normalized={};
    assignments.forEach(({finalId,record})=>{
      normalized[finalId]=normalizeRecord(finalId,record,record.settlementId,migrationYear);
    });
    world.businesses=normalized;
    const defs=Array.isArray(settlementDefinitions)?settlementDefinitions:[];
    seedWorld(world,defs);

    const highest=highestBusinessIdNumber(world);
    if(world.businessCounter<highest) world.businessCounter=highest;
    world.businessSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function businessScaleFor(activeEmployees,population){
    const employeeScale=Math.min(1,activeEmployees/20);
    const populationScale=Math.min(1,Math.log10(Math.max(10,population))/6);
    return clamp(0.20+employeeScale*0.45+populationScale*0.35,0.20,1.00);
  }

  function financeInputs(world,business){
    ensure(world);
    const runtime=root.WorldSimulation&&typeof root.WorldSimulation.getSettlementState==='function'?root.WorldSimulation.getSettlementState(world,business.settlementId):null;
    const economy=runtime&&runtime.economy||{};
    const security=runtime&&runtime.security||{};
    const demographics=runtime&&runtime.demographics||{};
    const employmentIndex=finite(economy.employmentIndex,0.5);
    const wageIndex=finite(economy.wageIndex,1);
    const rentIndex=finite(economy.rentIndex,1);
    const foodPriceIndex=finite(economy.foodPriceIndex,1);
    const sectorDemand=economy.industryDemand&&economy.industryDemand[business.demandGroup]!=null?finite(economy.industryDemand[business.demandGroup],0.5):0.5;
    const population=finite(demographics.population,0);
    const unrest=finite(security.unrest,0);
    const checkpointPressure=finite(security.checkpointPressure,0);
    const publicHealthPressure=runtime&&root.PublicHealth&&typeof root.PublicHealth.pressure==='function'?finite(root.PublicHealth.pressure(runtime),0):0;
    const activeContracts=root.EmploymentSystem&&typeof root.EmploymentSystem.activeForBusiness==='function'?root.EmploymentSystem.activeForBusiness(world,business.id):[];
    const activeEmployees=activeContracts.length;
    const annualPayroll=activeContracts.reduce((sum,c)=>sum+finite(c.annualSalary,0),0);
    return {
      year:Math.round(finite(world.year,0)),
      employmentIndex,wageIndex,rentIndex,foodPriceIndex,sectorDemand,population,unrest,checkpointPressure,publicHealthPressure,
      activeEmployees,annualPayroll,
      businessScale:businessScaleFor(activeEmployees,population)
    };
  }

  function calculateAnnualResult(world,business,options){
    const opts=options||{};
    const year=Number.isFinite(Number(opts.year))?Math.round(Number(opts.year)):Math.round(finite(world.year,0));
    const inputs=financeInputs(world,business);
    const stream=root.WorldSimulation.streamFor(world,year,business.id,'business-finance');
    const variation=0.92+stream.next()*0.16;
    const sectorBase=SECTOR_BASE_REVENUE[business.sector]||SECTOR_BASE_REVENUE.professional;
    const demandFactor=0.55+inputs.sectorDemand*0.70;
    const employmentFactor=0.70+inputs.employmentIndex*0.45;
    const stabilityFactor=1-inputs.unrest*0.30-inputs.checkpointPressure*0.12;
    const healthFactor=1-inputs.publicHealthPressure*0.18;
    const grossRevenue=sectorBase*inputs.businessScale*demandFactor*employmentFactor*Math.max(0.35,stabilityFactor)*Math.max(0.55,healthFactor)*variation;
    const revenue=Math.max(0,Math.round(grossRevenue));
    const payroll=Math.round(inputs.annualPayroll);
    const ratio=SECTOR_OPERATING_RATIO[business.sector]||SECTOR_OPERATING_RATIO.professional;
    const fixedCost=900*inputs.businessScale*inputs.rentIndex;
    const variableCost=revenue*ratio*(0.80+inputs.foodPriceIndex*0.20);
    const expenses=Math.max(0,Math.round(fixedCost+variableCost));
    const profit=revenue-expenses-payroll;
    const startingCash=Math.max(0,finite(business.finances.cash,0));
    const startingDebt=Math.max(0,finite(business.finances.debt,0));
    let cash=startingCash, debt=startingDebt;
    if(profit>=0){
      cash+=profit;
      const repay=Math.min(debt,Math.floor(profit*0.35));
      cash-=repay; debt-=repay;
    } else {
      const loss=-profit;
      const fromCash=Math.min(cash,loss);
      cash-=fromCash;
      debt+=(loss-fromCash);
    }
    cash=Math.max(0,Math.round(cash));
    debt=Math.max(0,Math.round(debt));
    return {year,revenue,expenses,payroll,profit:Math.round(profit),cash,debt,variation,inputs};
  }

  function close(world,businessId,reason,year){
    ensure(world);
    const business=get(world,businessId);
    if(!business) return null;
    if(business.status==='closed') return business;
    const closeYear=Number.isFinite(Number(year))?Math.round(Number(year)):Math.round(finite(world.year,business.closedYear||0));
    business.status='closed';
    business.closedYear=closeYear;
    business.history=business.history.slice(-HISTORY_LIMIT+1);
    business.history.push({type:'closed',year:closeYear,reason:reason||'insolvency'});
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.activeForBusiness==='function'){
      root.EmploymentSystem.activeForBusiness(world,businessId).forEach(contract=>{
        root.EmploymentSystem.end(world,contract.id,'terminated','business_closed',closeYear);
      });
    }
    business.employeeIds=[];
    business.vacancies=[];
    return business;
  }

  function tickBusiness(world,business,options){
    ensure(world);
    const opts=options||{};
    const year=Number.isFinite(Number(opts.year))?Math.round(Number(opts.year)):Math.round(finite(world.year,0));
    if(business.lastTickYear===year) return {applied:false,reason:'already_applied',businessId:business.id,year};
    if(business.lastTickYear!=null&&year<business.lastTickYear) return {applied:false,reason:'stale_year',businessId:business.id,year};
    if(business.status==='closed') return {applied:false,reason:'closed',businessId:business.id,year};

    if(root.EmploymentSystem&&typeof root.EmploymentSystem.payBusinessPayroll==='function'){
      root.EmploymentSystem.payBusinessPayroll(world,business.id,year);
    }
    const result=calculateAnnualResult(world,business,{year});
    business.finances.revenue=result.revenue;
    business.finances.expenses=result.expenses;
    business.finances.payroll=result.payroll;
    business.finances.profit=result.profit;
    business.finances.cash=result.cash;
    business.finances.debt=result.debt;
    business.finances.lastYear=year;
    business.lastTickYear=year;

    const debtStruggleThreshold=Math.max(5000,result.revenue*1.5);
    const strugglingNow=result.profit<0||result.debt>debtStruggleThreshold;
    if(strugglingNow){
      business.status='struggling';
      business.strugglingYears=(business.strugglingYears||0)+1;
    } else {
      business.status='active';
      business.strugglingYears=0;
    }

    business.history=business.history.slice(-HISTORY_LIMIT+1);
    business.history.push({type:'annual_finance',year,revenue:result.revenue,expenses:result.expenses,payroll:result.payroll,profit:result.profit,cash:result.cash,debt:result.debt,status:business.status});

    const closureDebtThreshold=Math.max(10000,result.revenue*2.25);
    if(business.strugglingYears>=3&&business.finances.debt>closureDebtThreshold&&business.finances.cash<=0){
      close(world,business.id,'insolvency',year);
    }

    return {applied:true,businessId:business.id,year,revenue:business.finances.revenue,expenses:business.finances.expenses,payroll:business.finances.payroll,profit:business.finances.profit,status:business.status};
  }

  function tickSettlement(world,settlementId,options){
    ensure(world);
    const list=forSettlement(world,settlementId).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const opts=options||{};
    const year=Number.isFinite(Number(opts.year))?Math.round(Number(opts.year)):Math.round(finite(world.year,0));
    const totals={year,applied:0,skipped:0,closed:0,revenue:0,expenses:0,payroll:0,profit:0};
    list.forEach(business=>{
      const before=business.status;
      const result=tickBusiness(world,business,{year});
      if(result.applied){
        totals.applied++;
        totals.revenue+=business.finances.revenue;
        totals.expenses+=business.finances.expenses;
        totals.payroll+=business.finances.payroll;
        totals.profit+=business.finances.profit;
        if(business.status==='closed'&&before!=='closed') totals.closed++;
      } else totals.skipped++;
    });
    return totals;
  }

  function tickWorld(world,options){
    ensure(world);
    const defs=root.WorldSimulation&&typeof root.WorldSimulation.definitions==='function'?root.WorldSimulation.definitions(world):[];
    migrate(world,defs);
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.migrate==='function') root.EmploymentSystem.migrate(world);
    const opts=options||{};
    const year=Number.isFinite(Number(opts.year))?Math.round(Number(opts.year)):Math.round(finite(world.year,0));
    const list=all(world).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const totals={year,applied:0,skipped:0,closed:0,revenue:0,expenses:0,payroll:0,profit:0};
    list.forEach(business=>{
      const before=business.status;
      const result=tickBusiness(world,business,{year});
      if(result.applied){
        totals.applied++;
        totals.revenue+=business.finances.revenue;
        totals.expenses+=business.finances.expenses;
        totals.payroll+=business.finances.payroll;
        totals.profit+=business.finances.profit;
        if(business.status==='closed'&&before!=='closed') totals.closed++;
      } else totals.skipped++;
    });
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.syncAllBusinessEmployees==='function') root.EmploymentSystem.syncAllBusinessEmployees(world);
    return totals;
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
        if(typeof business.finances.cash==='number'&&business.finances.cash<0) issues.push('business '+key+' has negative finances.cash');
        if(typeof business.finances.debt==='number'&&business.finances.debt<0) issues.push('business '+key+' has negative finances.debt');
        if(business.lastTickYear!=null&&lastYear!=null&&business.lastTickYear!==lastYear) issues.push('business '+key+' lastTickYear does not match finances.lastYear');
      }
      if(!Array.isArray(business.history)) issues.push('business '+key+' history must be an array');
      else if(business.history.length>HISTORY_LIMIT) issues.push('business '+key+' history exceeds limit of '+HISTORY_LIMIT);
      if(business.lastTickYear!=null&&(typeof business.lastTickYear!=='number'||!Number.isFinite(business.lastTickYear)||!Number.isInteger(business.lastTickYear))) issues.push('business '+key+' has invalid lastTickYear');
      if(typeof business.strugglingYears!=='number'||!Number.isFinite(business.strugglingYears)||business.strugglingYears<0||!Number.isInteger(business.strugglingYears)) issues.push('business '+key+' has invalid strugglingYears');
      if(business.closedYear!=null&&(typeof business.closedYear!=='number'||!Number.isFinite(business.closedYear)||!Number.isInteger(business.closedYear))) issues.push('business '+key+' has invalid closedYear');
      if(business.status==='closed'){
        if(business.closedYear==null) issues.push('business '+key+' is closed but missing closedYear');
        if(Array.isArray(business.employeeIds)&&business.employeeIds.length>0) issues.push('business '+key+' is closed but still has employeeIds');
        if(root.EmploymentSystem&&typeof root.EmploymentSystem.activeForBusiness==='function'&&root.EmploymentSystem.activeForBusiness(world,business.id).length>0){
          issues.push('business '+key+' is closed but has active employment contracts');
        }
      } else if(business.closedYear!=null){
        issues.push('business '+key+' is not closed but has a closedYear');
      }
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
    MAX_BUSINESSES_PER_SETTLEMENT,
    ensure,
    migrate,
    create,
    get,
    all,
    forSettlement,
    seedSettlement,
    seedWorld,
    summary,
    checkInvariants,
    financeInputs,
    calculateAnnualResult,
    tickBusiness,
    tickSettlement,
    tickWorld,
    close
  };
})(typeof globalThis!=='undefined'?globalThis:this);
