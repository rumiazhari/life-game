'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,scrollTop:0,offsetWidth:100,offsetHeight:100,
    appendChild(){},remove(){},addEventListener(){},removeEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;},getBoundingClientRect(){return {width:100,height:100};},focus(){},click(){}
  });
  context.document={
    querySelector(selector){return elements[selector]||(elements[selector]=makeElement());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=makeElement());},
    createElement(){return makeElement();},
    addEventListener(){},
    body:makeElement(),
    documentElement:makeElement()
  };
  context.addEventListener=()=>{};
  context.setTimeout=(fn)=>0;
  context.clearTimeout=()=>{};
  context.setInterval=()=>0;
  context.clearInterval=()=>{};
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  context.activeConditions=()=>[];
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function configureAdult(context,extra){
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.jobTier=0; S.jobName='Unemployed'; S.career=null; S.eduStage=null; S.jailUntil=0; S.garnishUntil=0; S.liabilities=[]; S.kids=0; S.married=false; S.contacts=[]; S.location={settlementId:World.activeSettlementId};"+(extra||''));
}

function seedPublicBusiness(context,sector){
  return JSON.parse(expose(context,`(function(){
    const settlementId=World.activeSettlementId;
    const b=BusinessSystem.create(World,{settlementId,sector:'${sector}',kind:'public'});
    return JSON.stringify(b);
  })()`));
}

test('rollJobVacancies uses the persistent VacancySystem projection as the normal runtime path',()=>{
  const context=uiContext('portal-normal-path');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v=rollJobVacancies();
    return JSON.stringify({hasVacancyId:v.some(x=>x.vacancyId),count:v.length});
  })()`));
  assert.equal(result.hasVacancyId,true);
});

test('employed subjects still see switching/promotion vacancies (refresh is not gated on jobTier===0)',()=>{
  const context=uiContext('portal-employed-refresh');
  configureAdult(context);
  const b=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.career='medicine'; S.jobName='Junior';
    VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    syncPlayerVacancyPortal();
    return JSON.stringify(S.vacancies.map(v=>v.vacancyId));
  })()`));
  assert.ok(result.length>=1);
});

test('WorldGameplay preserves every persistent opening (no second random filter)',()=>{
  const context=uiContext('worldgameplay-preserve');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    WorldGameplay.install();
    rollJobVacancies();
    return JSON.stringify(S.vacancies.length);
  })()`));
  assert.equal(result,1);
});

test('career portal entries carry a stable vacancyId',()=>{
  const context=uiContext('portal-career-id');
  configureAdult(context);
  const b=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v=rollJobVacancies();
    return JSON.stringify(v.filter(x=>x.occupationType==='career').map(x=>x.vacancyId));
  })()`));
  assert.deepEqual(result,['vacancy:00001']);
});

test('general JOBLIST openings render in the GENERAL OPENINGS section',()=>{
  const context=uiContext('portal-general');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    rollJobVacancies();
    openJobPortal();
    return JSON.stringify($('#jobSheet').innerHTML.includes('GENERAL OPENINGS'));
  })()`));
  assert.equal(result,true);
});

test('lookwork accepted creates an authoritative contract and pays the signing bonus minus cost',()=>{
  const context=uiContext('lookwork-accept');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const before=S.assets;
    const r=PUR_MAP['lookwork'].apply(S,{vacancyId:v.id});
    applyFx(r.fx);
    return JSON.stringify({jobTier:S.jobTier,contractId:S.employmentContractId,assetsDelta:S.assets-before});
  })()`));
  assert.equal(result.jobTier,1);
  assert.ok(result.contractId);
  assert.equal(result.assetsDelta,-100);
});

test('lookwork rejected (closed vacancy) leaves employment unchanged',()=>{
  const context=uiContext('lookwork-reject');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.withdraw(World,v.id,'test',World.year);
    const before=S.jobTier;
    const r=PUR_MAP['lookwork'].apply(S,{vacancyId:v.id});
    return JSON.stringify({jobTierBefore:before,jobTierAfter:S.jobTier,happiness:r.fx.happiness});
  })()`));
  assert.equal(result.jobTierAfter,result.jobTierBefore);
  assert.equal(result.happiness,-2);
});

test('presspromo delegates to EmploymentSystem.requestPromotion',()=>{
  const context=uiContext('presspromo-delegate');
  configureAdult(context);
  const b=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.career='medicine'; S.jobName='Junior';
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    const before=S.assets;
    const r=DEC_MAP['presspromo'].apply(S,{});
    applyFx(r.fx);
    return JSON.stringify({sameContract:EmploymentSystem.get(World,contract.id).status==='active',jobTier:EmploymentSystem.get(World,contract.id).jobTier,assetsDelta:S.assets-before});
  })()`));
  assert.equal(result.sameContract,true);
  assert.equal(result.jobTier,2);
  assert.equal(result.assetsDelta,150);
});

test('promotion retains the same contract ID through the pursuit path',()=>{
  const context=uiContext('presspromo-same-id');
  configureAdult(context);
  const b=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.career='medicine'; S.jobName='Junior';
    VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    DEC_MAP['presspromo'].apply(S,{});
    return JSON.stringify(EmploymentSystem.forPerson(World,'subject').length);
  })()`));
  assert.equal(result,1);
});

test('quitjob ends the active contract instead of only clearing S',()=>{
  const context=uiContext('quitjob-ends-contract');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Worker'; S.freedom=60;
    DEC_MAP['quitjob'].apply(S,{});
    return JSON.stringify({status:EmploymentSystem.get(World,contract.id).status,activeCount:EmploymentSystem.activeForPerson(World,'subject').length});
  })()`));
  assert.equal(result.status,'resigned');
  assert.equal(result.activeCount,0);
});

test('retirement milestone ends the active contract',()=>{
  const context=uiContext('retirement-ends-contract');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:World.year-30});
    S.employmentContractId=contract.id; S.jobTier=3; S.age=65;
    runMilestones();
    return JSON.stringify({status:EmploymentSystem.get(World,contract.id).status,jobTier:S.jobTier,jobName:S.jobName,contractPtr:S.employmentContractId});
  })()`));
  assert.equal(result.status,'retired');
  assert.equal(result.jobTier,0);
  assert.equal(result.jobName,'Pensioner (retired)');
  assert.equal(result.contractPtr,null);
});

test('runEconomy uses the active contract salary, not the legacy CAREERS/INC table',()=>{
  const context=uiContext('runeconomy-contract-salary');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:987654,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Clerk';
    const before=S.assets;
    runEconomy();
    return JSON.stringify({paid:S.__worldWagePaid,before,after:S.assets});
  })()`));
  // WorldGameplay.adjustPaidIncome scales income by the settlement wage index
  // (bounded ~0.65..1.55), so the paid amount is proportional to, not
  // exactly equal to, the raw contract salary -- but it must be nowhere
  // near the small flat INC[] tier fallback (a few hundred).
  assert.ok(result.paid>500000&&result.paid<1600000);
});

test('exactly one player salary payment occurs per year',()=>{
  const context=uiContext('runeconomy-single-payment');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Worker';
    const before=S.assets;
    runEconomy();
    const paidOnce=S.assets-before;
    return JSON.stringify({paidOnce,wagePaid:S.__worldWagePaid});
  })()`));
  assert.equal(result.wagePaid,1000);
});

test('business payroll accounting never adds to player assets',()=>{
  const context=uiContext('payroll-no-player-cash');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Worker';
    const before=S.assets;
    EmploymentSystem.payBusinessPayroll(World,'${b.id}',World.year);
    return JSON.stringify(S.assets-before);
  })()`));
  assert.equal(result,0);
});

test('no normal-runtime random auto-hire block remains in runEconomy',()=>{
  const context=uiContext('no-random-autohire');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    S.jobTier=0; S.jobName='Unemployed'; Random.chance=()=>true;
    runEconomy();
    return JSON.stringify({jobTier:S.jobTier,jobName:S.jobName});
  })()`));
  assert.equal(result.jobTier,0);
  assert.equal(result.jobName,'Unemployed');
});

test('no normal-runtime random auto-promotion block remains in runEconomy',()=>{
  const context=uiContext('no-random-autopromote');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Clerk'; S.career=null;
    bestJobForTier=()=>({name:'Forced'});
    Random.chance=()=>true;
    const before=S.assets;
    runEconomy();
    return JSON.stringify({jobTier:S.jobTier,assetsGain:S.assets-before-1000});
  })()`));
  assert.equal(result.jobTier,1);
});

test('no normal-runtime random position-elimination block remains in runEconomy',()=>{
  const context=uiContext('no-random-elimination');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Worker';
    Random.chance=()=>true;
    runEconomy();
    return JSON.stringify({status:EmploymentSystem.get(World,contract.id).status,jobTier:S.jobTier});
  })()`));
  assert.equal(result.status,'active');
  assert.equal(result.jobTier,1);
});

test('advanceYear runs the business tick exactly once per year',()=>{
  const context=uiContext('business-tick-once');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    let calls=0; const original=BusinessSystem.tickWorld;
    BusinessSystem.tickWorld=function(){calls++; return original.apply(this,arguments);};
    advanceYear(true,true);
    BusinessSystem.tickWorld=original;
    return calls;
  })()`));
  assert.equal(result,1);
});

test('advanceYear runs the employment lifecycle tick exactly once per year',()=>{
  const context=uiContext('lifecycle-tick-once');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    let calls=0; const original=EmploymentSystem.tickWorld;
    EmploymentSystem.tickWorld=function(){calls++; return original.apply(this,arguments);};
    advanceYear(true,true);
    EmploymentSystem.tickWorld=original;
    return calls;
  })()`));
  assert.equal(result,1);
});

test('advanceYear runs the vacancy tick exactly once per year',()=>{
  const context=uiContext('vacancy-tick-once');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    let calls=0; const original=VacancySystem.tickWorld;
    VacancySystem.tickWorld=function(){calls++; return original.apply(this,arguments);};
    advanceYear(true,true);
    VacancySystem.tickWorld=original;
    return calls;
  })()`));
  assert.equal(result,1);
});

test('resolvePending runs after resolvePlan in the annual pipeline',()=>{
  const context=uiContext('resolvepending-after-plan');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const order=JSON.parse(expose(context,`(function(){
    let order=[];
    const originalResolvePlan=resolvePlan, originalResolvePending=VacancySystem.resolvePending;
    window.resolvePlan=function(){order.push('resolvePlan'); return originalResolvePlan.apply(this,arguments);};
    VacancySystem.resolvePending=function(){order.push('resolvePending'); return originalResolvePending.apply(this,arguments);};
    advanceYear(true,true);
    window.resolvePlan=originalResolvePlan;
    VacancySystem.resolvePending=originalResolvePending;
    return JSON.stringify(order);
  })()`));
  const planIdx=order.indexOf('resolvePlan'), pendingIdx=order.indexOf('resolvePending');
  assert.ok(planIdx>=0&&pendingIdx>planIdx);
});

test('a vacancy opened in the current year is not auto-resolved during that year\'s tick',()=>{
  const context=uiContext('current-year-not-resolved');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'basic',quality:0.6,years:2},employment:{}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    runVacancyYearTick();
    resolvePendingVacancies();
    return JSON.stringify(VacancySystem.get(World,v.id).status);
  })()`));
  assert.equal(result,'open');
});

test('a vacancy from a prior year is resolved by the pipeline\'s resolvePendingVacancies call',()=>{
  const context=uiContext('prior-year-resolved');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'basic',quality:0.6,years:2},employment:{}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:World.year,requirements:{minAge:16}});
    VacancySystem.seedNpcApplications(World,v,{year:World.year});
    World.year+=1;
    resolvePendingVacancies();
    return JSON.stringify(VacancySystem.get(World,v.id).status);
  })()`));
  assert.ok(['filled','open'].includes(result));
});

test('medical progression remains scheduled after resolvePlan in the pipeline order',()=>{
  const context=uiContext('medical-after-resolveplan');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const order=JSON.parse(expose(context,`(function(){
    let order=[];
    const originalResolvePlan=resolvePlan;
    window.resolvePlan=function(){order.push('resolvePlan'); return originalResolvePlan.apply(this,arguments);};
    const originalTick=NpcSystem.applyHouseholdHealthTick;
    NpcSystem.applyHouseholdHealthTick=function(){order.push('householdHealthTick'); return originalTick.apply(this,arguments);};
    advanceYear(true,true);
    window.resolvePlan=originalResolvePlan;
    NpcSystem.applyHouseholdHealthTick=originalTick;
    return JSON.stringify(order);
  })()`));
  const planIdx=order.indexOf('resolvePlan'), healthIdx=order.indexOf('householdHealthTick');
  assert.ok(planIdx>=0&&healthIdx>planIdx);
});

test('fast-forward does not duplicate annual employment operations',()=>{
  const context=uiContext('fastforward-no-dup');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Worker';
    for(let i=0;i<3;i++) advanceYear(true,true);
    return JSON.stringify({activeCount:EmploymentSystem.activeForPerson(World,'subject').length,invariants:EmploymentSystem.checkInvariants(World)});
  })()`));
  assert.equal(result.activeCount,1);
  assert.deepEqual(result.invariants,[]);
});

test('business closure synchronizes the player to unemployment',()=>{
  const context=uiContext('closure-syncs-player');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Worker'; S.career=null;
    BusinessSystem.close(World,'${b.id}','insolvency',World.year,{subject:S});
    EmploymentSystem.syncPersonLegacy(World,'subject',{subject:S,terminal:true});
    return JSON.stringify({status:EmploymentSystem.get(World,contract.id).status,jobTier:S.jobTier,jobName:S.jobName});
  })()`));
  assert.equal(result.status,'terminated');
  assert.equal(result.jobTier,0);
  assert.equal(result.jobName,'Unemployed');
});

test('clean vacancy, employment, and business invariants after a full annual pipeline run',()=>{
  const context=uiContext('clean-invariants-pipeline');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    WorldSimulation.migrate(World);
    const business=BusinessSystem.forSettlement(World,World.activeSettlementId)[0];
    const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:business.id,annualSalary:1000,hiredYear:World.year});
    S.employmentContractId=contract.id; S.jobTier=1; S.jobName='Worker';
    advanceYear(true,true);
    return JSON.stringify({
      vacancy:VacancySystem.checkInvariants(World),
      employment:EmploymentSystem.checkInvariants(World),
      business:BusinessSystem.checkInvariants(World)
    });
  })()`));
  assert.deepEqual(result.vacancy,[]);
  assert.deepEqual(result.employment,[]);
  assert.deepEqual(result.business,[]);
});

/* ===== Correctness hardening: no legacy random fallback when systems are available (section 10) ===== */

test('a queued presspromo after a layoff returns a non-mutating no_active_contract result',()=>{
  const context=uiContext('presspromo-after-layoff');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const biz=BusinessSystem.get(World,'${b.id}');
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:World.year});
    EmploymentSystem.hire(World,{personId:'npc:coworker',businessId:'${b.id}',annualSalary:100,hiredYear:World.year});
    S.employmentContractId=c.id; S.jobTier=1; S.jobName='Worker'; S.career=null;
    biz.status='struggling'; biz.finances.payroll=1000; biz.finances.revenue=1000; biz.finances.profit=-200;
    EmploymentSystem.tickWorld(World,{year:World.year,subject:S});
    EmploymentSystem.reconcilePlayer(World,S);
    Random.chance=()=>true;
    const r=DEC_MAP['presspromo'].apply(S,{});
    return JSON.stringify({reason:r.reason,jobTier:S.jobTier});
  })()`));
  assert.equal(result.reason,'no_active_contract');
  assert.equal(result.jobTier,0);
});

test('a queued presspromo after business closure returns a non-mutating no_active_contract result',()=>{
  const context=uiContext('presspromo-after-closure');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:World.year});
    S.employmentContractId=c.id; S.jobTier=1; S.jobName='Worker'; S.career=null;
    BusinessSystem.close(World,'${b.id}','insolvency',World.year,{subject:S});
    Random.chance=()=>true;
    const r=DEC_MAP['presspromo'].apply(S,{});
    return JSON.stringify({reason:r.reason,jobTier:S.jobTier});
  })()`));
  assert.equal(result.reason,'no_active_contract');
  assert.equal(result.jobTier,0);
});

test('a queued quitjob after business closure returns a non-mutating already_unemployed result',()=>{
  const context=uiContext('quitjob-after-closure');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',annualSalary:900,hiredYear:World.year});
    S.employmentContractId=c.id; S.jobTier=1; S.jobName='Worker'; S.freedom=60;
    BusinessSystem.close(World,'${b.id}','insolvency',World.year,{subject:S});
    const r=DEC_MAP['quitjob'].apply(S,{});
    return JSON.stringify({reason:r.reason,jobTier:S.jobTier,jobName:S.jobName});
  })()`));
  assert.equal(result.reason,'already_unemployed');
  assert.equal(result.jobTier,0);
  assert.equal(result.jobName,'Unemployed');
});

test('a stale queued lookwork with no vacancyId returns a non-mutating vacancy_unavailable result',()=>{
  const context=uiContext('lookwork-stale-no-id');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    const before=JSON.stringify({jobTier:S.jobTier,jobName:S.jobName,career:S.career});
    const r=PUR_MAP['lookwork'].apply(S,{});
    const after=JSON.stringify({jobTier:S.jobTier,jobName:S.jobName,career:S.career});
    return JSON.stringify({reason:r.reason,unchanged:before===after});
  })()`));
  assert.equal(result.reason,'vacancy_unavailable');
  assert.equal(result.unchanged,true);
});

test('no random hiring or promotion occurs across a queued presspromo/lookwork replay with chance forced true',()=>{
  const context=uiContext('no-random-replay');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    Random.chance=()=>true;
    const promoResult=DEC_MAP['presspromo'].apply(S,{});
    const lookResult=PUR_MAP['lookwork'].apply(S,{});
    return JSON.stringify({jobTier:S.jobTier,jobName:S.jobName,promoReason:promoResult.reason,lookReason:lookResult.reason});
  })()`));
  assert.equal(result.jobTier,0);
  assert.equal(result.jobName,'Unemployed');
});

/* ===== Correctness hardening: seed NPC applications for every open vacancy (section 11) ===== */

test('a prior-year still-open vacancy receives new applications from newly eligible NPCs',()=>{
  const context=uiContext('prior-year-new-applicants');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    World.npcs={};
    runVacancyYearTick();
    const beforeApps=VacancySystem.get(World,v.id).applications.length;
    World.npcs['npc:new']={id:'npc:new',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{}};
    runVacancyYearTick();
    const afterApps=VacancySystem.get(World,v.id).applications.length;
    return JSON.stringify({beforeApps,afterApps});
  })()`));
  assert.ok(result.afterApps>=result.beforeApps);
});

test('a current-year vacancy receives applicants but remains unresolved',()=>{
  const context=uiContext('current-year-receives-applicants');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:World.year,requirements:{minAge:16}});
    runVacancyYearTick();
    resolvePendingVacancies();
    const record=VacancySystem.get(World,v.id);
    return JSON.stringify({status:record.status,applicationCount:record.applications.length});
  })()`));
  assert.equal(result.status,'open');
});

test('vacancy application seeding processes open vacancies in stable ID order',()=>{
  const context=uiContext('stable-seed-order');
  configureAdult(context);
  const b1=seedPublicBusiness(context,'retail');
  const b2=seedPublicBusiness(context,'finance');
  const result=JSON.parse(expose(context,`(function(){
    let order=[];
    const original=VacancySystem.seedNpcApplications;
    VacancySystem.seedNpcApplications=function(world,vacancy,opts){ order.push(vacancy.id); return original.apply(this,arguments); };
    VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'job',occupationId:'a',occupationName:'A',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'b',occupationName:'B',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    runVacancyYearTick();
    VacancySystem.seedNpcApplications=original;
    const sorted=order.slice().sort();
    return JSON.stringify({orderMatchesSorted:JSON.stringify(order)===JSON.stringify(sorted)});
  })()`));
  assert.equal(result.orderMatchesSorted,true);
});

test('application caps remain respected while seeding across every open vacancy each year',()=>{
  const context=uiContext('caps-respected-full-seed');
  configureAdult(context);
  const b1=seedPublicBusiness(context,'retail');
  const b2=seedPublicBusiness(context,'finance');
  const b3=seedPublicBusiness(context,'government');
  const result=JSON.parse(expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{}}};
    VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'job',occupationId:'a',occupationName:'A',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'b',occupationName:'B',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    VacancySystem.open(World,{businessId:'${b3.id}',occupationType:'job',occupationId:'c',occupationName:'C',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    runVacancyYearTick();
    return VacancySystem.applicationsForPersonInYear(World,'npc:a',World.year).length;
  })()`));
  assert.ok(result<=2);
});

/* ===== Correctness hardening: job portal shows every opening (section 8) ===== */

test('two same-track vacancies from different businesses both render with their own vacancy IDs',()=>{
  const context=uiContext('portal-two-employers');
  configureAdult(context);
  const b1=seedPublicBusiness(context,'healthcare');
  const b2=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior A',careerStage:0,jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior B',careerStage:0,jobTier:1,annualSalary:1100,requirements:{minAge:16}});
    rollJobVacancies();
    openJobPortal();
    const html=$('#jobSheet').innerHTML;
    return JSON.stringify({
      vacancyCount:S.vacancies.filter(v=>v.occupationType==='career').length,
      hasBothIds:html.includes('data-vacancy-row=')&&S.vacancies.every(v=>html.includes(v.vacancyId))
    });
  })()`));
  assert.equal(result.vacancyCount,2);
  assert.equal(result.hasBothIds,true);
});

test('selecting a specific vacancy detail marks only that vacancy stage OPEN NOW',()=>{
  const context=uiContext('detail-marks-correct-stage');
  configureAdult(context);
  const b1=seedPublicBusiness(context,'healthcare');
  const b2=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior A',careerStage:0,jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior B',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:World.year-2,stageStartedYear:World.year-2});
    S.employmentContractId=c.id; S.jobTier=1; S.career='medicine'; S.jobName='Junior B';
    const v2=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior B',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minAge:16,minCareerYears:0}});
    rollJobVacancies();
    openJobDetail('medicine',v2.id);
    const html=$('#jobDetailSheet').innerHTML;
    const openNowCount=(html.match(/OPEN NOW/g)||[]).length;
    return JSON.stringify({openNowCount,hasApplyForV2:html.includes('data-vacancy="'+v2.id+'"')});
  })()`));
  assert.equal(result.openNowCount,1);
  assert.equal(result.hasApplyForV2,true);
});

test('an unqualified selected opening has no Apply button',()=>{
  const context=uiContext('unqualified-no-apply');
  configureAdult(context);
  const b=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minAge:16}});
    rollJobVacancies();
    openJobDetail('medicine',v.id);
    const html=$('#jobDetailSheet').innerHTML;
    return html.includes('data-vacancy="'+v.id+'"');
  })()`));
  assert.equal(result,false);
});

test('a pending application on the selected opening has no second Apply button',()=>{
  const context=uiContext('pending-no-second-apply');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'business',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.submitApplication(World,v.id,'subject',{subject:S,year:World.year});
    rollJobVacancies();
    openJobDetail('business',v.id);
    const html=$('#jobDetailSheet').innerHTML;
    return html.includes('data-vacancy="'+v.id+'"');
  })()`));
  assert.equal(result,false);
});

test('applying from each row targets the correct business',()=>{
  const context=uiContext('apply-targets-correct-business');
  configureAdult(context);
  const b1=seedPublicBusiness(context,'retail');
  const b2=seedPublicBusiness(context,'finance');
  const result=JSON.parse(expose(context,`(function(){
    const v1=VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'job',occupationId:'clerk1',occupationName:'Clerk A',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v2=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'clerk2',occupationName:'Clerk B',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const r1=PUR_MAP['lookwork'].apply(S,{vacancyId:v1.id});
    applyFx(r1.fx);
    const businessId=EmploymentSystem.activeForPerson(World,'subject')[0].businessId;
    return JSON.stringify({businessId,expected:'${b1.id}'});
  })()`));
  assert.equal(result.businessId,result.expected);
});

test('a general opening shows explicit requirements in its rendered row',()=>{
  const context=uiContext('general-opening-requirements');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:21,skills:{retail:3}}});
    rollJobVacancies();
    openJobPortal();
    const html=$('#jobSheet').innerHTML;
    return JSON.stringify({hasAge:html.includes('age 21'),hasSkill:html.includes('3/10')});
  })()`));
  assert.equal(result.hasAge,true);
  assert.equal(result.hasSkill,true);
});

test('no real career vacancy disappears from S.vacancies with multiple stages and employers open',()=>{
  const context=uiContext('no-vacancy-disappears');
  configureAdult(context);
  const b1=seedPublicBusiness(context,'healthcare');
  const b2=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minAge:16}});
    rollJobVacancies();
    return S.vacancies.filter(v=>v.occupationType==='career').length;
  })()`));
  assert.equal(result,2);
});

/* ===== Correctness hardening: vacancy seeding robust to already-applied tick (section 10) ===== */

test('calling VacancySystem.tickWorld directly then runVacancyYearTick in the same year still seeds applications',()=>{
  const context=uiContext('already-applied-still-seeds');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    VacancySystem.tickWorld(World,{year:World.year});
    const beforeApps=VacancySystem.get(World,v.id).applications.length;
    const result=runVacancyYearTick();
    const afterApps=VacancySystem.get(World,v.id).applications.length;
    return JSON.stringify({reason:result.reason,beforeApps,afterApps});
  })()`));
  assert.equal(result.reason,'already_applied');
  assert.ok(result.afterApps>=result.beforeApps);
  assert.ok(result.afterApps>0);
});

test('no duplicate applications are created when seeding runs after an already-applied tick',()=>{
  const context=uiContext('no-duplicate-after-already-applied');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    VacancySystem.tickWorld(World,{year:World.year});
    runVacancyYearTick();
    runVacancyYearTick();
    const applications=VacancySystem.get(World,v.id).applications.filter(a=>a.personId==='npc:a');
    return applications.length;
  })()`));
  assert.equal(result,1);
});

test('a stale-year tickWorld result does not trigger seeding',()=>{
  const context=uiContext('stale-year-no-seed');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:World.year-1,requirements:{minAge:16}});
    VacancySystem.tickWorld(World,{year:World.year});
    World.year-=1;
    const result=runVacancyYearTick();
    World.year+=1;
    return JSON.stringify({reason:result.reason,apps:VacancySystem.get(World,v.id).applications.length});
  })()`));
  assert.equal(result.reason,'stale_year');
  assert.equal(result.apps,0);
});

test('current-year vacancy remains unresolved after seeding via an already-applied tick',()=>{
  const context=uiContext('current-year-still-unresolved');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{}}};
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:World.year,requirements:{minAge:16}});
    VacancySystem.tickWorld(World,{year:World.year});
    runVacancyYearTick();
    resolvePendingVacancies();
    return JSON.stringify(VacancySystem.get(World,v.id).status);
  })()`));
  assert.equal(result,'open');
});

/* ===== Correctness hardening: failed application submission must not resolve (section 11) ===== */

test('presspromo delegation reports annual_application_cap without resolving the vacancy',()=>{
  const context=uiContext('presspromo-cap-reason');
  configureAdult(context);
  const b=seedPublicBusiness(context,'healthcare');
  const b2=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:World.year-5,stageStartedYear:World.year-5});
    S.employmentContractId=c.id; S.jobTier=1; S.career='medicine'; S.jobName='Junior';
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    const filler1=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'filler1',occupationName:'Filler1',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    const filler2=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'filler2',occupationName:'Filler2',jobTier:1,annualSalary:900,requirements:{minAge:16}});
    VacancySystem.submitApplication(World,filler1.id,'subject',{subject:S,year:World.year});
    VacancySystem.submitApplication(World,filler2.id,'subject',{subject:S,year:World.year});
    const result=EmploymentSystem.requestPromotion(World,c.id,{year:World.year,subject:S});
    return JSON.stringify({reason:result.reason,accepted:result.accepted,vacancyStatus:VacancySystem.get(World,v.id).status});
  })()`));
  assert.equal(result.accepted,false);
  assert.equal(result.reason,'annual_application_cap');
  assert.equal(result.vacancyStatus,'open');
});

test('a qualification-failed promotion attempt reports not_qualified and leaves the vacancy open',()=>{
  const context=uiContext('qualification-fail-no-resolve');
  configureAdult(context);
  const b=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:World.year,stageStartedYear:World.year});
    S.employmentContractId=c.id; S.jobTier=1; S.career='medicine'; S.jobName='Junior';
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:10}});
    const result=EmploymentSystem.requestPromotion(World,c.id,{year:World.year,subject:S});
    return JSON.stringify({reason:result.reason,accepted:result.accepted,vacancyStatus:VacancySystem.get(World,v.id).status});
  })()`));
  assert.equal(result.accepted,false);
  assert.equal(result.reason,'insufficient_tenure');
  assert.equal(result.vacancyStatus,'open');
});

test('lookwork reports vacancy_full through the actual pursuit path without mutating employment',()=>{
  const context=uiContext('lookwork-vacancy-full');
  configureAdult(context);
  const b=seedPublicBusiness(context,'retail');
  const result=JSON.parse(expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    for(let i=0;i<VacancySystem.MAX_APPLICATIONS_PER_VACANCY;i++){
      const id='npc:full'+i;
      World.npcs=World.npcs||{};
      World.npcs[id]={id,alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}};
      VacancySystem.submitApplication(World,v.id,id,{year:World.year});
    }
    const jobTierBefore=S.jobTier;
    const r=PUR_MAP['lookwork'].apply(S,{vacancyId:v.id});
    return JSON.stringify({reason:r.reason,jobTierBefore,jobTierAfter:S.jobTier,vacancyStatus:VacancySystem.get(World,v.id).status});
  })()`));
  assert.equal(result.reason,'vacancy_full');
  assert.equal(result.jobTierAfter,result.jobTierBefore);
  assert.equal(result.vacancyStatus,'open');
});

test('presspromo reports vacancy_full through the actual decision path without resolving the vacancy',()=>{
  const context=uiContext('presspromo-vacancy-full');
  configureAdult(context);
  const b=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    const c=EmploymentSystem.hire(World,{personId:'subject',businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:World.year-5,stageStartedYear:World.year-5});
    S.employmentContractId=c.id; S.jobTier=1; S.career='medicine'; S.jobName='Junior';
    const v=VacancySystem.open(World,{businessId:'${b.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    for(let i=0;i<VacancySystem.MAX_APPLICATIONS_PER_VACANCY;i++){
      const id='npc:full'+i;
      World.npcs=World.npcs||{};
      World.npcs[id]={id,alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}};
      VacancySystem.submitApplication(World,v.id,id,{year:World.year});
    }
    const r=DEC_MAP['presspromo'].apply(S,{});
    return JSON.stringify({reason:r.reason,jobTier:EmploymentSystem.get(World,c.id).jobTier,vacancyStatus:VacancySystem.get(World,v.id).status});
  })()`));
  assert.equal(result.reason,'vacancy_full');
  assert.equal(result.jobTier,1);
  assert.equal(result.vacancyStatus,'open');
});

/* ===== Correctness hardening: employer-specific career detail banner (section 8) ===== */

test('selecting employer A vs employer B shows only that employer\'s salary, requirements, and vacancyId in the banner',()=>{
  const context=uiContext('banner-employer-specific');
  configureAdult(context);
  const b1=seedPublicBusiness(context,'healthcare');
  const b2=seedPublicBusiness(context,'healthcare');
  const result=JSON.parse(expose(context,`(function(){
    const vA=VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior A',careerStage:0,jobTier:1,annualSalary:1200,requirements:{minAge:16}});
    const vB=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior B',careerStage:0,jobTier:1,annualSalary:1800,requirements:{minAge:16}});
    rollJobVacancies();
    openJobDetail('medicine',vA.id);
    const htmlA=$('#jobDetailSheet').innerHTML;
    openJobDetail('medicine',vB.id);
    const htmlB=$('#jobDetailSheet').innerHTML;
    return JSON.stringify({
      aHasOwnSalary:htmlA.includes('1,200')||htmlA.includes('1200'),
      aExcludesOtherSalary:!htmlA.includes('1,800')&&!htmlA.includes('1800'),
      bHasOwnSalary:htmlB.includes('1,800')||htmlB.includes('1800'),
      bExcludesOtherSalary:!htmlB.includes('1,200')&&!htmlB.includes('1200'),
      aHasOwnVacancyId:htmlA.includes(vA.id),
      bHasOwnVacancyId:htmlB.includes(vB.id)
    });
  })()`));
  assert.equal(result.aHasOwnSalary,true);
  assert.equal(result.aExcludesOtherSalary,true);
  assert.equal(result.bHasOwnSalary,true);
  assert.equal(result.bExcludesOtherSalary,true);
  assert.equal(result.aHasOwnVacancyId,true);
  assert.equal(result.bHasOwnVacancyId,true);
});
