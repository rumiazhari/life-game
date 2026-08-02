'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function newContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld();`);
  return context;
}

test('world simulation has an independent deterministic random stream',()=>{
  const context=newContext('rng-isolation');
  const result=expose(context,`(function(){ Random.setSeed('personal'); const first=Random.next(); World.year++; WorldSimulation.tick(World,{random:Random,year:World.year}); const after=Random.next(); Random.setSeed('personal'); Random.next(); const expected=Random.next(); return JSON.stringify({first,after,expected}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.after,parsed.expected);
});

test('settlement order does not change a seeded world tick',()=>{
  const context=newContext('order-independent');
  const result=expose(context,`(function(){ const snapshot=JSON.stringify(World.settlements); const first=JSON.parse(snapshot); const canonical=()=>JSON.stringify(Object.keys(World.settlements).sort().reduce((out,id)=>(out[id]=World.settlements[id],out),{})); World.year++; WorldSimulation.tick(World,{year:World.year}); const a=canonical(); World=Object.assign({},World,{year:World.year-1,settlements:{}}); Object.keys(first).reverse().forEach(id=>World.settlements[id]=first[id]); WorldSimulation.migrate(World); World.year++; WorldSimulation.tick(World,{year:World.year}); return JSON.stringify({a,b:canonical()}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.a,parsed.b);
});

test('explicit settlement definitions are active while runtime-only IDs are archived',()=>{
  const context=newContext('migration');
  const result=expose(context,`(function(){ World.settlementDefinitions=[{id:'dummy',name:'Dummy',kind:'town',region:'Test',population:'900',surveillance:40,travelDifficulty:1,buildings:[]}]; World.settlements.dummy={demographics:{population:900,initialPopulation:900}}; World.settlements.legacy={demographics:{population:700,initialPopulation:700}}; WorldSimulation.migrate(World); World.year++; WorldSimulation.tick(World,{year:World.year}); return JSON.stringify({dummy:World.settlements.dummy,legacyActive:!!World.settlements.legacy,legacyArchived:!!World.settlementArchive.legacy,accounting:World.lastMigrationAccounting,check:Invariants.check(null,World)}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.accounting.balance,0);
  assert.equal(parsed.check.ok,true);
  assert.ok(parsed.dummy.demographics.population>=0);
  assert.equal(parsed.legacyActive,false);
  assert.equal(parsed.legacyArchived,true);
});

test('migration bounds external outflow and preserves the national population equation',()=>{
  const context=newContext('external-bound');
  const result=expose(context,`(function(){ const id=World.activeSettlementId; World.externalMigration={}; Object.keys(World.settlements).forEach(key=>World.externalMigration[key]=key===id?-999999:0); World.year++; WorldSimulation.tick(World,{year:World.year}); const d=World.settlements[id].demographics; const a=World.lastMigrationAccounting; return JSON.stringify({population:d.population,external:d.externalMigration,accounting:a,check:Invariants.check(null,World)}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.population,0);
  assert.ok(parsed.external<0);
  assert.equal(parsed.accounting.populationAfter,parsed.accounting.naturalPopulation+parsed.accounting.externalNet);
  assert.equal(parsed.check.ok,true);
});

test('schema migration preserves valid values and repairs invalid values idempotently',()=>{
  const context=newContext('migration-schema');
  const result=expose(context,`(function(){ const before=World.settlements.branec; before.economy.wageIndex=1.24; before.demographics.population=123456; before.publicHealth.sanitation=NaN; before.education.schoolCapacity=NaN; before.education.enrolledStudents=NaN; delete World.simulationSchemaVersion; WorldSimulation.migrate(World); const once=JSON.stringify(World); WorldSimulation.migrate(World); const twice=JSON.stringify(World); return JSON.stringify({wage:World.settlements.branec.economy.wageIndex,population:World.settlements.branec.demographics.population,schoolCapacity:World.settlements.branec.education.schoolCapacity,enrolledStudents:World.settlements.branec.education.enrolledStudents,stable:once===twice,check:Invariants.check(null,World)}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.wage,1.24);
  assert.equal(parsed.population,123456);
  assert.ok(parsed.schoolCapacity>0);
  assert.ok(parsed.enrolledStudents>0);
  assert.equal(parsed.stable,true);
  assert.equal(parsed.check.ok,true);
});

test('migration attractiveness responds to employment, wages, rent, health, and unrest',()=>{
  const context=newContext('attractiveness');
  const result=expose(context,`(function(){ const base=World.settlements.branec; const clone=JSON.parse(JSON.stringify(base)); clone.economy.employmentIndex=1; clone.economy.wageIndex=1.5; clone.economy.rentIndex=.7; clone.publicHealth.sanitation=1; clone.publicHealth.clinicDemand=.1; clone.publicHealth.clinicCapacity=.9; clone.publicHealth.outbreakRisk=0; clone.security.unrest=0; const low=JSON.parse(JSON.stringify(clone)); low.economy.employmentIndex=0; low.economy.wageIndex=.65; low.economy.rentIndex=1.55; low.publicHealth.sanitation=0; low.publicHealth.clinicDemand=1; low.publicHealth.clinicCapacity=0; low.publicHealth.outbreakRisk=1; low.security.unrest=1; return JSON.stringify({high:WorldSimulation.attractiveness(clone),low:WorldSimulation.attractiveness(low)}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.high>parsed.low);
});

test('invariants reject missing, unknown, and unbalanced settlement runtime state',()=>{
  const context=newContext('invariant-audit');
  const result=expose(context,`(function(){ const missing=World.settlements.branec; delete World.settlements.branec; const missingViolations=Invariants.check(null,World).violations; World.settlements.branec=missing; World.settlements.ghost=JSON.parse(JSON.stringify(missing)); const unknownViolations=Invariants.check(null,World).violations; delete World.settlements.ghost; const d=World.settlements.branec.demographics; d.populationBefore=100; d.naturalPopulation=90; d.populationAfter=90; d.population=90; d.births=0; d.deaths=10; d.internalIn=0; d.internalOut=100; d.externalMigration=0; const equationViolations=Invariants.check(null,World).violations; return JSON.stringify({missing:missingViolations,unknown:unknownViolations,equation:equationViolations}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.missing.some(item=>item.includes('missing runtime state for settlement branec')));
  assert.ok(parsed.unknown.some(item=>item.includes('not a static or explicit settlement definition')));
  assert.ok(parsed.equation.some(item=>item.includes('internalOut exceeds available pre-migration population')));
  assert.ok(parsed.equation.some(item=>item.includes('annual population equation does not balance')));
});

test('outbreak pressure reaches critical and decays during recovery',()=>{
  const context=newContext('outbreak-recovery');
  const result=expose(context,`(function(){ const id=World.activeSettlementId; const state=World.settlements[id]; PublicHealth.triggerShock(state,'outbreak',1,3,World.year); PublicHealth.triggerShock(state,'clinicClosure',.95,3,World.year); const peak=[]; for(let i=0;i<20;i++){ World.year++; WorldSimulation.tick(World,{year:World.year}); peak.push(WorldSimulation.getHealthcarePressure(World,id)); } return JSON.stringify({peak:Math.max(...peak),last:peak[peak.length-1],label:PublicHealth.pressureLabel(peak[peak.length-1])}); })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.peak>=.45);
  assert.ok(parsed.last<parsed.peak);
  assert.ok(['Watch','Clear'].includes(parsed.label));
});
