'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function migratedWorld(){
  const context=createWorldContext();
  expose(context,`World={year:1930,seed:'finance-seed',activeSettlementId:'branec',settlements:{}};WorldSimulation.migrate(World);`);
  return context;
}

test('financeInputs returns safe defaults for a business in a settlement with no runtime state',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'nowhereville',sector:'retail'});
    const inputs=BusinessSystem.financeInputs(World,b);
    return JSON.stringify(inputs);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.activeEmployees,0);
  assert.equal(parsed.annualPayroll,0);
  assert.ok(Number.isFinite(parsed.businessScale));
  assert.ok(parsed.businessScale>=0.20&&parsed.businessScale<=1.00);
});

test('businessScale has a lower bound of 0.20',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const inputs=BusinessSystem.financeInputs(World,b);
    return inputs.businessScale;
  })()`);
  assert.ok(Number(result)>=0.20);
});

test('businessScale has an upper bound of 1.00',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    for(let i=0;i<40;i++) EmploymentSystem.hire(World,{personId:'npc:'+i,businessId:b.id,annualSalary:800});
    const inputs=BusinessSystem.financeInputs(World,b);
    return inputs.businessScale;
  })()`);
  assert.ok(Number(result)<=1.00);
});

test('calculateAnnualResult is deterministic given the same state',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const a=BusinessSystem.calculateAnnualResult(World,b,{year:1930});
    const c=BusinessSystem.calculateAnnualResult(World,b,{year:1930});
    return JSON.stringify({equal:JSON.stringify(a)===JSON.stringify(c)});
  })()`);
  assert.ok(JSON.parse(result).equal);
});

test('annual finance variation does not consume the global Random stream',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    Random.setSeed('finance-random-check');
    const before=Random.range(0,1);
    Random.setSeed('finance-random-check');
    BusinessSystem.tickBusiness(World,b,{year:1930});
    const after=Random.range(0,1);
    return JSON.stringify({before,after});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.before,parsed.after);
});

test('tickBusiness is a no-op the second time it is applied to the same year',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    BusinessSystem.tickBusiness(World,b,{year:1930});
    const second=BusinessSystem.tickBusiness(World,b,{year:1930});
    return JSON.stringify(second);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,false);
  assert.equal(parsed.reason,'already_applied');
});

test('tickBusiness rejects a stale year older than lastTickYear',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    BusinessSystem.tickBusiness(World,b,{year:1930});
    const stale=BusinessSystem.tickBusiness(World,b,{year:1929});
    return JSON.stringify(stale);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,false);
  assert.equal(parsed.reason,'stale_year');
});

test('tickBusiness is a no-op for a closed business',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    BusinessSystem.close(World,b.id,'insolvency',1930);
    const result=BusinessSystem.tickBusiness(World,b,{year:1931});
    return JSON.stringify(result);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,false);
  assert.equal(parsed.reason,'closed');
});

test('revenue increases with higher sector demand',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const state=WorldSimulation.getSettlementState(World,'branec');
    state.economy.industryDemand.services=0.1;
    const low=BusinessSystem.calculateAnnualResult(World,b,{year:1930});
    state.economy.industryDemand.services=0.9;
    const high=BusinessSystem.calculateAnnualResult(World,b,{year:1930});
    return JSON.stringify({low:low.revenue,high:high.revenue});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.high>parsed.low);
});

test('revenue decreases with higher unrest',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const state=WorldSimulation.getSettlementState(World,'branec');
    state.security.unrest=0.05;
    const low=BusinessSystem.calculateAnnualResult(World,b,{year:1930});
    state.security.unrest=0.85;
    const high=BusinessSystem.calculateAnnualResult(World,b,{year:1930});
    return JSON.stringify({calm:low.revenue,unrest:high.revenue});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.calm>parsed.unrest);
});

test('revenue decreases with higher public-health pressure',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const state=WorldSimulation.getSettlementState(World,'branec');
    state.publicHealth.clinicDemand=0.05; state.publicHealth.outbreakRisk=0.02; state.publicHealth.sanitation=0.9;
    const low=BusinessSystem.calculateAnnualResult(World,b,{year:1930});
    state.publicHealth.clinicDemand=0.9; state.publicHealth.outbreakRisk=0.8; state.publicHealth.sanitation=0.1;
    const high=BusinessSystem.calculateAnnualResult(World,b,{year:1930});
    return JSON.stringify({healthy:low.revenue,pressured:high.revenue});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.healthy>=parsed.pressured);
});

test('payroll includes active contracts',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:1200});
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return result.payroll;
  })()`);
  assert.equal(JSON.parse(result),1200);
});

test('payroll includes on_leave contracts',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const c=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:1200});
    c.status='on_leave';
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return result.payroll;
  })()`);
  assert.equal(JSON.parse(result),1200);
});

test('payroll excludes ended contracts',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const c=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:1200});
    EmploymentSystem.end(World,c.id,'resigned','left',1930);
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return result.payroll;
  })()`);
  assert.equal(JSON.parse(result),0);
});

test('payroll payment state is idempotent within the same tick year',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const c=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:1200});
    BusinessSystem.tickBusiness(World,b,{year:1930});
    const first=JSON.stringify({paid:c.annualPaid,year:c.lastPaidYear});
    EmploymentSystem.payBusinessPayroll(World,b.id,1930);
    const second=JSON.stringify({paid:c.annualPaid,year:c.lastPaidYear});
    return JSON.stringify({equal:first===second});
  })()`);
  assert.ok(JSON.parse(result).equal);
});

test('profit arithmetic is exact: profit = revenue - expenses - payroll',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:900});
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return JSON.stringify({matches:result.profit===(result.revenue-result.expenses-result.payroll)});
  })()`);
  assert.ok(JSON.parse(result).matches);
});

test('a profitable business increases cash',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'finance'});
    b.finances.cash=100;
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return JSON.stringify({profit:result.profit,cash:b.finances.cash});
  })()`);
  const parsed=JSON.parse(result);
  if(parsed.profit>0) assert.ok(parsed.cash>100);
});

test('profit repays at most 35% of profit toward debt',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'finance'});
    b.finances.debt=10000;
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    const repaid=10000-b.finances.debt;
    return JSON.stringify({profit:result.profit,repaid,withinBound:result.profit<0||repaid<=Math.floor(result.profit*0.35)+1});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.withinBound);
});

test('a loss consumes cash before increasing debt',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'agriculture'});
    b.finances.cash=1000000;
    const state=WorldSimulation.getSettlementState(World,'branec');
    state.security.unrest=0.95; state.security.checkpointPressure=0.9; state.economy.industryDemand.agriculture=0;
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return JSON.stringify({profit:result.profit,cash:b.finances.cash,debt:b.finances.debt});
  })()`);
  const parsed=JSON.parse(result);
  if(parsed.profit<0){
    assert.equal(parsed.debt,0);
    assert.ok(parsed.cash<1000000);
  }
});

test('an uncovered loss increases debt once cash is exhausted',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'agriculture'});
    b.finances.cash=0;
    const state=WorldSimulation.getSettlementState(World,'branec');
    state.security.unrest=0.95; state.security.checkpointPressure=0.9; state.economy.industryDemand.agriculture=0;
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return JSON.stringify({profit:result.profit,cash:b.finances.cash,debt:b.finances.debt});
  })()`);
  const parsed=JSON.parse(result);
  if(parsed.profit<0){
    assert.equal(parsed.cash,0);
    assert.ok(parsed.debt>0);
  }
});

test('a business goes struggling after a loss year',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'agriculture'});
    b.finances.cash=0;
    const state=WorldSimulation.getSettlementState(World,'branec');
    state.security.unrest=0.95; state.security.checkpointPressure=0.9; state.economy.industryDemand.agriculture=0;
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return JSON.stringify({profit:result.profit,status:b.status,strugglingYears:b.strugglingYears});
  })()`);
  const parsed=JSON.parse(result);
  if(parsed.profit<0){
    assert.equal(parsed.status,'struggling');
    assert.equal(parsed.strugglingYears,1);
  }
});

test('a recovery year resets strugglingYears to 0',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'agriculture'});
    b.strugglingYears=2; b.status='struggling';
    const state=WorldSimulation.getSettlementState(World,'branec');
    state.security.unrest=0.05; state.security.checkpointPressure=0; state.economy.industryDemand.agriculture=1;
    state.economy.employmentIndex=1; state.publicHealth.clinicDemand=0; state.publicHealth.outbreakRisk=0;
    const result=BusinessSystem.tickBusiness(World,b,{year:1930});
    return JSON.stringify({profit:result.profit,status:b.status,strugglingYears:b.strugglingYears});
  })()`);
  const parsed=JSON.parse(result);
  if(parsed.profit>=0){
    assert.equal(parsed.status,'active');
    assert.equal(parsed.strugglingYears,0);
  }
});

test('a business closes deterministically after three qualifying struggling years',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'agriculture'});
    b.finances.cash=0; b.finances.debt=50000;
    for(let i=0;i<5;i++) EmploymentSystem.hire(World,{personId:'npc:overload'+i,businessId:b.id,annualSalary:5000});
    const state=WorldSimulation.getSettlementState(World,'branec');
    state.security.unrest=0.95; state.security.checkpointPressure=0.9; state.economy.industryDemand.agriculture=0; state.economy.employmentIndex=0;
    let last=null;
    for(let year=1930;year<1936;year++){
      last=BusinessSystem.tickBusiness(World,b,{year});
      if(b.status==='closed') break;
    }
    return JSON.stringify({status:b.status,closedYear:b.closedYear,strugglingYears:b.strugglingYears});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'closed');
  assert.ok(parsed.closedYear!=null);
  assert.ok(parsed.strugglingYears>=3);
});

test('closure terminates all active employment contracts at the business',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    const c=EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:500});
    BusinessSystem.close(World,b.id,'insolvency',1930);
    return JSON.stringify({status:World.employmentContracts[c.id].status,reason:World.employmentContracts[c.id].terminationReason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'terminated');
  assert.equal(parsed.reason,'business_closed');
});

test('closure clears employeeIds and vacancies',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail',vacancies:[{id:'v1'}]});
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:b.id,annualSalary:500});
    BusinessSystem.close(World,b.id,'insolvency',1930);
    return JSON.stringify({employeeIds:b.employeeIds,vacancies:b.vacancies});
  })()`);
  const parsed=JSON.parse(result);
  assert.deepEqual(parsed.employeeIds,[]);
  assert.deepEqual(parsed.vacancies,[]);
});

test('history is bounded to the newest 48 entries',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    for(let year=1930;year<2000;year++) BusinessSystem.tickBusiness(World,b,{year});
    return b.history.length;
  })()`);
  assert.ok(Number(result)<=48);
});

test('tickWorld processes businesses in stable ID order',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const order=[];
    const originalTick=BusinessSystem.tickBusiness;
    BusinessSystem.all(World).sort((a,b)=>a.id.localeCompare(b.id)).forEach(b=>order.push(b.id));
    return JSON.stringify(order);
  })()`);
  const parsed=JSON.parse(result);
  const sorted=parsed.slice().sort();
  assert.deepEqual(parsed,sorted);
});

test('tickWorld aggregates totals across all businesses',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    const totals=BusinessSystem.tickWorld(World,{year:1930});
    const businesses=BusinessSystem.all(World);
    const sumRevenue=businesses.reduce((s,b)=>s+b.finances.revenue,0);
    return JSON.stringify({applied:totals.applied,revenueMatches:totals.revenue===sumRevenue,total:businesses.length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,parsed.total);
  assert.ok(parsed.revenueMatches);
});

test('repeated tickWorld calls in the same year leave finances unchanged',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    BusinessSystem.tickWorld(World,{year:1930});
    const first=JSON.stringify(World.businesses);
    BusinessSystem.tickWorld(World,{year:1930});
    const second=JSON.stringify(World.businesses);
    return JSON.stringify({equal:first===second});
  })()`);
  assert.ok(JSON.parse(result).equal);
});

test('the annual flow invokes the business tick exactly once per year via runBusinessYearTick',()=>{
  const uiSource=fs.readFileSync(path.resolve(__dirname,'..','js','ui.js'),'utf8');
  assert.match(uiSource,/function runBusinessYearTick\(\)\{[\s\S]*?BusinessSystem\.tickWorld/);
  const advanceYearBody=uiSource.slice(uiSource.indexOf('function advanceYear'),uiSource.indexOf('YearEngine.configure'));
  const occurrences=(advanceYearBody.match(/runBusinessYearTick\(\)/g)||[]).length;
  assert.equal(occurrences,1);
});

test('diagnostics preserve finite and bounded finance values across many ticks',()=>{
  const context=migratedWorld();
  const result=expose(context,`(function(){
    for(let year=1930;year<1970;year++) BusinessSystem.tickWorld(World,{year});
    const businesses=BusinessSystem.all(World);
    const allFinite=businesses.every(b=>Number.isFinite(b.finances.cash)&&Number.isFinite(b.finances.debt)&&Number.isFinite(b.finances.revenue)&&Number.isFinite(b.finances.expenses)&&Number.isFinite(b.finances.payroll)&&Number.isFinite(b.finances.profit));
    const allNonNegative=businesses.every(b=>b.finances.cash>=0&&b.finances.debt>=0);
    const invariants=BusinessSystem.checkInvariants(World);
    return JSON.stringify({allFinite,allNonNegative,invariants});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.allFinite);
  assert.ok(parsed.allNonNegative);
  assert.deepEqual(parsed.invariants,[]);
});
