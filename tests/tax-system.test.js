'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
// Phase 5 slice 7 (sub-phase 5D) — tax and public budgets. TaxSystem owns
// World.publicBudget: annual revenue extracted from books BusinessSystem
// already ticked (profits + payrolls) plus a levy on the subject's assets,
// then posture-driven spending written into the EXISTING nationalModifiers
// policy keys the settlement sim reads. Everything is pure arithmetic — no
// Math.random, no shared Random — so replaying a year reproduces every cent.

const {createWorldContext,expose}=require('./helpers/vm-loader');

function taxContext(seed){
  const context=createWorldContext(['js/systems/government-system.js','js/systems/tax-system.js']);
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject(); GovernmentSystem.ensure(World); BusinessSystem.ensure(World); TaxSystem.ensure(World);");
  return context;
}
const get=(c,expr)=>expose(c,expr);

test('public budget is created valid and self-heals in checkInvariants',()=>{
  const c=taxContext('tax-ensure');
  const fresh=JSON.parse(get(c,'JSON.stringify(TaxSystem.ensure(World))'));
  assert.equal(fresh.schemaVersion,1,'schema version set');
  assert.equal(fresh.treasury,0,'treasury starts empty');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(TaxSystem.checkInvariants(World))')),[],'invariants clean when fresh');
  // Corrupt it, then ensure must repair.
  get(c,'World.publicBudget={schemaVersion:"x",treasury:-99,lastTickYear:"soon",lastRevenue:42,history:"nope"};');
  const repaired=JSON.parse(get(c,'JSON.stringify(TaxSystem.ensure(World))'));
  assert.equal(repaired.schemaVersion,1,'schema repaired');
  assert.equal(repaired.treasury,0,'negative treasury clamped to 0');
  assert.equal(repaired.lastRevenue,null,'malformed ledger dropped');
  assert.ok(Array.isArray(repaired.history),'history healed to an array');
  assert.equal(Number(get(c,'World.publicBudget.lastTickYear'))||0,0,'lastTickYear null after repair');
  assert.ok(get(c,'World.publicBudget.lastTickYear===null'),'lastTickYear is null, not a string');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(TaxSystem.checkInvariants(World))')),[],'clean after repair');
});

test('WorldSimulation.migrate wires the public budget into the world',()=>{
  const c=taxContext('tax-migrate');
  get(c,'delete World.publicBudget; WorldSimulation.migrate(World);');
  assert.ok(JSON.parse(get(c,'"publicBudget" in World')),'World.publicBudget exists after migrate');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(TaxSystem.checkInvariants(World))')),[],'invariants clean post-migrate');
  // Migration is idempotent byte-for-byte.
  const once=get(c,'JSON.stringify(World.publicBudget)');
  get(c,'WorldSimulation.migrate(World);');
  assert.equal(get(c,'JSON.stringify(World.publicBudget)'),once,'second migrate is identical');
});

test('extraction rises as regime legitimacy falls',()=>{
  const c=taxContext('tax-rates');
  const low=JSON.parse(get(c,'World.government.legitimacy=0.05; JSON.stringify(TaxSystem.ratesFor(World))'));
  const high=JSON.parse(get(c,'World.government.legitimacy=0.95; JSON.stringify(TaxSystem.ratesFor(World))'));
  assert.ok(low.business>high.business,'weak regime taxes businesses harder');
  assert.ok(low.income>high.income,'weak regime levies payrolls harder');
  assert.ok(low.subject>high.subject,'weak regime squeezes subjects harder');
  for(const r of [low,high]){
    for(const k of ['business','income','subject']){
      assert.ok(r[k]>=0&&r[k]<=0.35,k+' rate bounded');
    }
  }
});

test('the annual tick collects business tax, payroll levy and subject levy',()=>{
  const c=taxContext('tax-revenue');
  // Two operating businesses with fresh books + one closed (must be skipped).
  // var (not const): expose() runs raw statements in the vm context, so only
  // top-level var declarations become visible globals for later expressions.
  const mk="BusinessSystem.create(World,{settlementId:'settlement:00001',sector:'professional'})";
  get(c,"var b1="+mk+",b2="+mk+",dead="+mk+"; b1.status='active'; b2.status='struggling'; dead.status='closed';"+
    "b1.finances.profit=5000; b1.finances.payroll=10000; b1.finances.lastYear=World.year;"+
    "b2.finances.profit=2000; b2.finances.payroll=4000; b2.finances.lastYear=World.year;"+
    "S.assets=10000;");
  const rates=JSON.parse(get(c,'JSON.stringify(TaxSystem.ratesFor(World))'));
  const expBiz=Math.floor(Math.floor(5000*1)*rates.business)+Math.floor(Math.floor(2000*1)*rates.business);
  const expIncome=Math.floor(10000*rates.income)+Math.floor(4000*rates.income);
  const expLevy=Math.min(Math.floor((10000-2000)*rates.subject),250000);
  const result=JSON.parse(get(c,'JSON.stringify(TaxSystem.tickWorld(World,{year:World.year,subject:S}))'));
  assert.equal(result.applied,true,'tick applied');
  assert.equal(result.revenue.subjectLevy,expLevy,'subject levy exact');
  assert.equal(result.revenue.businessTax,expBiz,'business tax exact (closed business skipped)');
  assert.equal(result.revenue.incomeLevy,expIncome,'payroll levy exact');
  assert.equal(result.revenue.total,expBiz+expIncome+expLevy,'total adds up');
  assert.ok(result.spending.total>=0&&result.spending.total<=result.revenue.total,'spending bounded by revenue');
  assert.ok(result.spending.security>0&&result.spending.health>0,'spending split across categories');
  assert.equal(Number(get(c,'S.assets')),10000-expLevy,'assets deducted by exactly the levy');
  const ledger=JSON.parse(get(c,'JSON.stringify(World.publicBudget)'));
  assert.equal(ledger.treasury,result.revenue.total-result.spending.total,'treasury = collected − spent');
  assert.equal(ledger.lastTickYear,get(c,'World.year'),'year marker set');
  assert.equal(ledger.history.length,1,'one history entry');
  assert.ok(/Revenue/.test(ledger.history[0].note),'history note summarizes the ledger');
  assert.ok(result.chips.some(ch=>/STATE LEVY/.test(ch.txt)),'player sees the levy chip');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(TaxSystem.checkInvariants(World))')),[],'invariants clean after tick');
});

test('spending policy writes bounded nationalModifiers, harsher under a weak regime',()=>{
  const weakCtx=taxContext('tax-policy-weak');
  weakCtx&&get(weakCtx,'World.government.legitimacy=0.05; TaxSystem.tickWorld(World,{year:World.year,subject:S});');
  const weak=JSON.parse(get(weakCtx,'JSON.stringify(World.nationalModifiers)'));
  const strongCtx=taxContext('tax-policy-strong');
  get(strongCtx,'World.government.legitimacy=0.95; TaxSystem.tickWorld(World,{year:World.year,subject:S});');
  const strong=JSON.parse(get(strongCtx,'JSON.stringify(World.nationalModifiers)'));
  for(const mods of [weak,strong]){
    for(const k of ['surveillancePressure','healthSupport','employmentSupport']){
      assert.ok(Number.isFinite(mods[k])&&mods[k]>=0&&mods[k]<=1,k+' bounded in [0,1]');
    }
  }
  assert.ok(weak.surveillancePressure>strong.surveillancePressure,'weak regime polices harder');
  assert.ok(strong.healthSupport>=weak.healthSupport,'confident regime invests more in health');
});

test('same-year tick is a no-op and stale years are rejected without double taxation',()=>{
  const c=taxContext('tax-idem');
  get(c,'S.assets=9000; TaxSystem.tickWorld(World,{year:World.year,subject:S});');
  const afterFirst=get(c,'S.assets');
  const dup=JSON.parse(get(c,'JSON.stringify(TaxSystem.tickWorld(World,{year:World.year,subject:S}))'));
  assert.equal(dup.applied,false,'duplicate year not applied');
  assert.equal(dup.reason,'already_applied','reports already_applied');
  assert.equal(get(c,'S.assets'),afterFirst,'no double levy');
  const stale=JSON.parse(get(c,'JSON.stringify(TaxSystem.tickWorld(World,{year:World.year-5,subject:S}))'));
  assert.equal(stale.reason,'stale_year','earlier year rejected');
  assert.equal(get(c,'S.assets'),afterFirst,'stale call did not touch assets');
});

test('absurd inputs stay finite and saturate instead of exploding',()=>{
  const c=taxContext('tax-saturation');
  const mk="BusinessSystem.create(World,{settlementId:'settlement:00001',sector:'manufacturing'})";
  get(c,mk+"&&0; var biz=World.businesses[Object.keys(World.businesses)[0]];"+
    "biz.status='active'; biz.finances.profit=9e9; biz.finances.payroll=9e9; biz.finances.lastYear=World.year;"+
    "S.assets=1e12;");
  const result=JSON.parse(get(c,'JSON.stringify(TaxSystem.tickWorld(World,{year:World.year,subject:S}))'));
  const ledger=JSON.parse(get(c,'JSON.stringify(World.publicBudget)'));
  assert.ok(Number.isFinite(ledger.treasury)&&ledger.treasury<=50000000,'treasury finite and capped');
  assert.equal(result.revenue.subjectLevy,250000,'subject levy saturates at its ceiling');
  assert.ok(result.revenue.businessTax<=5000000*0.35+1,'per-business tax clamped by item bound');
  assert.deepEqual(JSON.parse(get(c,'JSON.stringify(TaxSystem.checkInvariants(World))')),[],'invariants clean under saturation');
});
