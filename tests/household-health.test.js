'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGameContext}=require('./helpers/vm-loader');
function ctx(){return createGameContext(['js/systems/condition-registry.js','js/systems/medical-system.js','js/systems/household-system.js','js/systems/household-health.js']);}

test('ensure() creates the full default schema on a household with no medical field',()=>{
  const c=ctx(),h={id:'hh1'};
  const state=c.HouseholdHealthSystem.ensure(h);
  assert.equal(state.schemaVersion,1);
  assert.equal(state.lastPreparedYear,null);
  assert.equal(state.lastTickYear,null);
  assert.equal(state.lastTransmissionYear,null);
  assert.equal(state.caseCounter,0);
  assert.equal(JSON.stringify(state.cases),'[]');
  assert.equal(JSON.stringify(state.pendingCharges),'[]');
  assert.equal(JSON.stringify(state.settledChargeKeys),'[]');
  assert.equal(JSON.stringify(state.history),'[]');
  assert.equal(JSON.stringify(state.annual),JSON.stringify({year:null,activeCases:0,newConditions:0,transmissions:0,caregivingHoursRequired:0,caregivingHoursProvided:0,treatmentCosts:0,medicalDebtAdded:0}));
  assert.strictEqual(h.medical,state);
});

test('ensure() is idempotent',()=>{
  const c=ctx(),h={id:'hh2'};
  c.HouseholdHealthSystem.ensure(h);
  const first=JSON.stringify(h.medical);
  c.HouseholdHealthSystem.ensure(h);
  assert.equal(JSON.stringify(h.medical),first);
});

test('migrate() repairs a partially-populated household.medical missing annual object',()=>{
  const c=ctx(),h={id:'hh3',medical:{schemaVersion:1,cases:[],pendingCharges:[],settledChargeKeys:[],history:[]}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.ok(state.annual&&typeof state.annual==='object');
  assert.equal(state.annual.activeCases,0);
});

test('migrate() repairs household.medical with cases as undefined/wrong type',()=>{
  const c=ctx(),h={id:'hh4',medical:{cases:undefined}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.ok(Array.isArray(state.cases));
  const h2={id:'hh4b',medical:{cases:'not-an-array'}};
  const state2=c.HouseholdHealthSystem.migrate(h2);
  assert.ok(Array.isArray(state2.cases));
});

test('valid year zero is preserved',()=>{
  const c=ctx(),h={id:'hh5',medical:{lastTickYear:0,lastPreparedYear:0,lastTransmissionYear:0}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.strictEqual(state.lastTickYear,0);
  assert.strictEqual(state.lastPreparedYear,0);
  assert.strictEqual(state.lastTransmissionYear,0);
});

test('invalid/non-finite year values become null',()=>{
  const c=ctx(),h={id:'hh6',medical:{lastTickYear:Infinity,lastPreparedYear:NaN}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.strictEqual(state.lastTickYear,null);
  assert.strictEqual(state.lastPreparedYear,null);
});

test('unparseable string years become null',()=>{
  const c=ctx(),h={id:'hh7',medical:{lastTickYear:'not-a-year',lastTransmissionYear:''}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.strictEqual(state.lastTickYear,null);
  assert.strictEqual(state.lastTransmissionYear,null);
});

test('history is trimmed to newest 48 records',()=>{
  const c=ctx(),history=[];
  for(let i=0;i<60;i++)history.push({note:String(i)});
  const h={id:'hh8',medical:{history}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.equal(state.history.length,48);
  assert.equal(state.history[0].note,'12');
  assert.equal(state.history[47].note,'59');
});

test('settledChargeKeys is trimmed to newest 96 keys',()=>{
  const c=ctx(),keys=[];
  for(let i=0;i<120;i++)keys.push('key'+i);
  const h={id:'hh9',medical:{settledChargeKeys:keys}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.equal(state.settledChargeKeys.length,96);
  assert.equal(state.settledChargeKeys[0],'key24');
  assert.equal(state.settledChargeKeys[95],'key119');
});

test('duplicate active cases for same npcId+conditionInstanceId are deduplicated',()=>{
  const c=ctx(),h={id:'hh10',medical:{cases:[
    {caseId:'case-2',npcId:'npc1',conditionInstanceId:'inst1',status:'pending'},
    {caseId:'case-1',npcId:'npc1',conditionInstanceId:'inst1',status:'pending'}
  ]}};
  const state=c.HouseholdHealthSystem.migrate(h);
  const matching=state.cases.filter(x=>x.npcId==='npc1'&&x.conditionInstanceId==='inst1');
  assert.equal(matching.length,1);
  assert.equal(matching[0].caseId,'case-1');
});

test('unknown condition IDs in a case are retained, not dropped',()=>{
  const c=ctx(),h={id:'hh11',medical:{cases:[
    {caseId:'case-x',npcId:'npc1',conditionInstanceId:'inst1',conditionId:'mystery-illness',status:'pending'}
  ]}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.equal(state.cases[0].conditionId,'mystery-illness');
});

test('old save with no household.medical field loads safely via ensure()',()=>{
  const c=ctx(),h={id:'hh12',members:['npc1','npc2']};
  const state=c.HouseholdHealthSystem.ensure(h);
  assert.equal(state.schemaVersion,1);
  assert.equal(JSON.stringify(state.cases),'[]');
});

test('tickHousehold applies once for a given year and sets lastTickYear',()=>{
  const c=ctx(),h={id:'hh13'},w={year:1950};
  const result=c.HouseholdHealthSystem.tickHousehold(w,h,{year:1950});
  assert.equal(result.applied,true);
  assert.equal(result.year,1950);
  assert.equal(h.medical.lastTickYear,1950);
  assert.equal(h.medical.annual.year,1950);
});

test('repeated same-year tickHousehold call is a safe no-op',()=>{
  const c=ctx(),h={id:'hh14'},w={year:1950};
  c.HouseholdHealthSystem.tickHousehold(w,h,{year:1950});
  const before=JSON.stringify(h.medical);
  const result=c.HouseholdHealthSystem.tickHousehold(w,h,{year:1950});
  assert.equal(result.applied,false);
  assert.equal(result.reason,'already-applied');
  assert.equal(JSON.stringify(h.medical),before);
});

test('next-year tickHousehold call progresses again',()=>{
  const c=ctx(),h={id:'hh15'},w={year:1950};
  c.HouseholdHealthSystem.tickHousehold(w,h,{year:1950});
  const result=c.HouseholdHealthSystem.tickHousehold(w,h,{year:1951});
  assert.equal(result.applied,true);
  assert.equal(h.medical.lastTickYear,1951);
});

test('summary() returns the correct derived values from annual without mutating household',()=>{
  const c=ctx(),h={id:'hh16',medical:{annual:{year:1950,activeCases:2,newConditions:1,transmissions:0,caregivingHoursRequired:3,caregivingHoursProvided:2,treatmentCosts:100,medicalDebtAdded:50}}};
  c.HouseholdHealthSystem.migrate(h);
  const before=JSON.stringify(h.medical);
  const summary=c.HouseholdHealthSystem.summary(h);
  assert.equal(summary.year,1950);
  assert.equal(summary.activeCases,2);
  assert.equal(summary.treatmentCosts,100);
  assert.equal(JSON.stringify(h.medical),before);
});

test('checkInvariants() reports no violations on a freshly-ensured household',()=>{
  const c=ctx(),h={id:'hh17'};
  c.HouseholdHealthSystem.ensure(h);
  assert.equal(JSON.stringify(c.HouseholdHealthSystem.checkInvariants(h)),'[]');
});

test('checkInvariants() detects a duplicate active case violation',()=>{
  const c=ctx(),h={id:'hh18'};
  c.HouseholdHealthSystem.ensure(h);
  h.medical.cases.push({caseId:'a',npcId:'npc1',conditionInstanceId:'inst1',householdId:'hh18',status:'pending',resolved:false});
  h.medical.cases.push({caseId:'b',npcId:'npc1',conditionInstanceId:'inst1',householdId:'hh18',status:'pending',resolved:false});
  const violations=c.HouseholdHealthSystem.checkInvariants(h);
  assert.ok(violations.some(v=>v.includes('duplicate active case')));
});

test('checkInvariants() detects an out-of-range year field',()=>{
  const c=ctx(),h={id:'hh19'};
  c.HouseholdHealthSystem.ensure(h);
  h.medical.lastTickYear=1950.5;
  const violations=c.HouseholdHealthSystem.checkInvariants(h);
  assert.ok(violations.some(v=>v.includes('lastTickYear')));
});

test('checkInvariants() detects lastTransmissionYear exceeding lastTickYear',()=>{
  const c=ctx(),h={id:'hh20'};
  c.HouseholdHealthSystem.ensure(h);
  h.medical.lastTickYear=1950;
  h.medical.lastTransmissionYear=1955;
  const violations=c.HouseholdHealthSystem.checkInvariants(h);
  assert.ok(violations.some(v=>v.includes('lastTransmissionYear cannot exceed lastTickYear')));
});
