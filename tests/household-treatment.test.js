'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function newContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function run(context,code){
  return JSON.parse(expose(context,`(function(){${code}})()`));
}

// Builds a household with no subject member (so autonomous decision-making
// applies) and one NPC with a single known condition, ready for either
// manual resolveDecision() calls or a full tickHousehold() pass.
const setupNpcHousehold=`
  const household=HouseholdSystem.create(World,{settlementId:World.activeSettlementId,memberIds:[],dependentIds:[]});
  const npc=NpcSystem.upsert(World,{id:'npc:patient',firstName:'Pat',lastName:'Ient',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
  HouseholdSystem.addMember(World,household.id,npc.id,false);
`;

// Procedurally generated settlements don't always roll a clinic building, and
// accessFor() falls back to a no-clinic default (quality .12) when none is
// present -- below every paid treatment's minQuality. Tests that need a
// deterministic, known-affordable clinical treatment pass this context
// override (matched by medicalContextForMember()'s early-return check) so
// hospital access doesn't depend on what a given seed happened to generate.
const CLINIC_CONTEXT=`{settlement:{buildings:[{type:'clinic',name:'City General'}],kind:'city'},healthcarePressure:0}`;
// A town clinic (quality .59) clears 'basic''s .25 minQuality but not
// 'specialist''s .65 -- used to test the severity-4/5 hospital-access
// fallback to 'basic' when a specialist tier genuinely isn't available.
const TOWN_CLINIC_CONTEXT=`{settlement:{buildings:[{type:'clinic',name:'Town Clinic'}],kind:'town'},healthcarePressure:0}`;

// --- Family decisions (player-facing resolveDecision, three outcomes) -----

test('family decision: fund-recommended-care treats the condition and creates exactly one charge',()=>{
  const context=newContext('decision-fund');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s1=HouseholdHealthSystem.ensure(household);
    const caseId=s1.cases[0].caseId;
    const res=HouseholdHealthSystem.resolveDecision(World,household,caseId,{decision:'fund-recommended-care'},Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s2=HouseholdHealthSystem.ensure(household);
    const finalCase=s2.cases.find(c=>c.caseId===caseId);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({applied:res.applied,cost:res.cost,costPositive:res.cost>0,status:finalCase.status,treated:condition.state==='treated',clinicalTreatment:condition.treatment==='basic',chargeCount:s2.pendingCharges.length});
  `);
  assert.equal(result.applied,true);
  assert.equal(result.costPositive,true,`cost was ${result.cost}`);
  assert.equal(result.status,'treated');
  assert.equal(result.treated,true);
  assert.equal(result.clinicalTreatment,true);
  assert.equal(result.chargeCount,1);
});

test('family decision: home-care uses rest treatment, allocates caregiving hours, and creates no charge',()=>{
  const context=newContext('decision-home-care');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'infection',5,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    const caseId=s1.cases[0].caseId;
    const res=HouseholdHealthSystem.resolveDecision(World,household,caseId,{decision:'home-care'},{year:World.year});
    const s2=HouseholdHealthSystem.ensure(household);
    const finalCase=s2.cases.find(c=>c.caseId===caseId);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({applied:res.applied,status:finalCase.status,restTreatment:condition.treatment==='rest',careHours:finalCase.selectedCareHours,chargeCount:s2.pendingCharges.length});
  `);
  assert.equal(result.applied,true);
  assert.equal(result.status,'home-care');
  assert.equal(result.restTreatment,true);
  assert.equal(result.careHours,3);
  assert.equal(result.chargeCount,0);
});

test('family decision: leave-untreated applies no treatment and creates no charge',()=>{
  const context=newContext('decision-untreated');
  const result=run(context,`
    ${setupNpcHousehold}
    MedicalSystem.addCondition(npc,'injury',2,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    const caseId=s1.cases[0].caseId;
    const res=HouseholdHealthSystem.resolveDecision(World,household,caseId,{decision:'leave-untreated'},{year:World.year});
    const s2=HouseholdHealthSystem.ensure(household);
    const finalCase=s2.cases.find(c=>c.caseId===caseId);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({applied:res.applied,status:finalCase.status,untouched:condition.treatment==null,chargeCount:s2.pendingCharges.length});
  `);
  assert.equal(result.applied,true);
  assert.equal(result.status,'untreated');
  assert.equal(result.untouched,true);
  assert.equal(result.chargeCount,0);
});

// --- Autonomous NPC treatment (exact severity tiers) -----------------------

test('autonomous rule: severity below 3 receives no paid treatment (and no rest either)',()=>{
  const context=newContext('auto-sev2');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',2,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,status:s.cases[0].status,untouched:condition.treatment==null,chargeCount:s.pendingCharges.length});
  `);
  assert.equal(result.decision,'leave-untreated');
  assert.equal(result.status,'untreated');
  assert.equal(result.untouched,true);
  assert.equal(result.chargeCount,0);
});

test('autonomous rule: severity 3 funds basic when affordable from savings',()=>{
  const context=newContext('auto-sev3-afford');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,status:s.cases[0].status,treatment:condition.treatment});
  `);
  assert.equal(result.decision,'fund-recommended-care');
  assert.equal(result.status,'treated');
  assert.equal(result.treatment,'basic');
});

test('autonomous rule: severity 3 falls back to rest (never debt) when basic is unaffordable',()=>{
  const context=newContext('auto-sev3-poor');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=0;
    household.finances.debt=0;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,status:s.cases[0].status,treatment:condition.treatment,chargeCount:s.pendingCharges.length});
  `);
  assert.equal(result.decision,'home-care');
  assert.equal(result.status,'home-care');
  assert.equal(result.treatment,'rest');
  assert.equal(result.chargeCount,0);
});

test('autonomous rule: severity 4 upgrades to specialist when hospital access and resources allow',()=>{
  const context=newContext('auto-sev4-specialist');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',4,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,status:s.cases[0].status,treatment:condition.treatment,settledCount:s.settledChargeKeys.length,treatmentCosts:s.annual.treatmentCosts});
  `);
  assert.equal(result.decision,'fund-recommended-care');
  assert.equal(result.status,'treated');
  assert.equal(result.treatment,'specialist');
  assert.equal(result.settledCount,1);
  assert.ok(result.treatmentCosts>0);
});

test('autonomous rule: severity 4 uses basic when hospital access does not reach specialist quality',()=>{
  const context=newContext('auto-sev4-townbasic');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',4,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${TOWN_CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,treatment:condition.treatment});
  `);
  assert.equal(result.decision,'fund-recommended-care');
  assert.equal(result.treatment,'basic');
});

test('autonomous rule: severity 4 falls back to rest (never debt) when even basic is unaffordable',()=>{
  const context=newContext('auto-sev4-poor');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=0;
    household.finances.debt=0;
    MedicalSystem.addCondition(npc,'respiratory',4,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,treatment:condition.treatment,chargeCount:s.pendingCharges.length});
  `);
  assert.equal(result.decision,'home-care');
  assert.equal(result.treatment,'rest');
  assert.equal(result.chargeCount,0);
});

test('autonomous rule: severity 5 funds specialist when hospital access and resources allow',()=>{
  const context=newContext('auto-sev5-specialist');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',5,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,treatment:condition.treatment});
  `);
  assert.equal(result.decision,'fund-recommended-care');
  assert.equal(result.treatment,'specialist');
});

test('autonomous rule: severity 5 funds basic when specialist is not available',()=>{
  const context=newContext('auto-sev5-basicfallback');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',5,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${TOWN_CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,treatment:condition.treatment});
  `);
  assert.equal(result.decision,'fund-recommended-care');
  assert.equal(result.treatment,'basic');
});

test('autonomous rule: severity 5 may intentionally borrow (within the debt cap) when savings are insufficient',()=>{
  const context=newContext('auto-sev5-debt');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=0;
    household.finances.debt=0;
    MedicalSystem.addCondition(npc,'respiratory',5,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,treatment:condition.treatment,chargeAmount:s.settledChargeKeys.length?s.annual.treatmentCosts:0});
  `);
  assert.equal(result.decision,'fund-recommended-care');
  assert.ok(['specialist','basic'].includes(result.treatment));
  assert.ok(result.chargeAmount>0);
});

test('autonomous rule: severity 5 falls back to rest when even debt-financed treatment would exceed the debt cap',()=>{
  const context=newContext('auto-sev5-cap-exceeded');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=0;
    household.finances.debt=2490;
    MedicalSystem.addCondition(npc,'respiratory',5,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,treatment:condition.treatment,chargeCount:s.pendingCharges.length});
  `);
  assert.equal(result.decision,'home-care');
  assert.equal(result.treatment,'rest');
  assert.equal(result.chargeCount,0);
});

test('autonomous rule: only severity 5 may intentionally create treatment debt (3 and 4 both refuse to borrow)',()=>{
  const context=newContext('auto-debt-tier-comparison');
  const result=run(context,`
    function brokeHouseholdOutcome(npcId,severity){
      const household=HouseholdSystem.create(World,{settlementId:World.activeSettlementId,memberIds:[],dependentIds:[]});
      household.finances.savings=0; household.finances.debt=0;
      const npc=NpcSystem.upsert(World,{id:npcId,firstName:'N',lastName:'Pc',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
      HouseholdSystem.addMember(World,household.id,npc.id,false);
      MedicalSystem.addCondition(npc,'respiratory',severity,{world:World,year:World.year,known:true});
      HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
      const s=HouseholdHealthSystem.ensure(household);
      return {decision:s.cases[0].decision,borrowed:s.annual.treatmentCosts>0};
    }
    const sev3=brokeHouseholdOutcome('npc:tier3',3);
    const sev4=brokeHouseholdOutcome('npc:tier4',4);
    const sev5=brokeHouseholdOutcome('npc:tier5',5);
    return JSON.stringify({sev3,sev4,sev5});
  `);
  assert.equal(result.sev3.decision,'home-care');
  assert.equal(result.sev3.borrowed,false);
  assert.equal(result.sev4.decision,'home-care');
  assert.equal(result.sev4.borrowed,false);
  assert.equal(result.sev5.decision,'fund-recommended-care');
  assert.equal(result.sev5.borrowed,true);
});

test('autonomous NPC treatment does not apply to a household the subject is a member of (cases stay pending)',()=>{
  const context=newContext('auto-subject-household');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:subjmate',firstName:'S',lastName:'Ubj',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',5,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.tickHousehold(World,household,{year:World.year,subject:S});
    const s=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({status:s.cases[0].status,decision:s.cases[0].decision});
  `);
  assert.equal(result.status,'pending');
  assert.equal(result.decision,null);
});

// A "chronic" condition has already passed into MedicalSystem's permanent
// state -- MedicalSystem's own mortality model only counts severity>=4
// conditions that are NOT in 'treated'/'remission' state, and applying rest
// or a clinic treatment would flip the condition into 'treated' and (after
// one more year of relief) below that threshold, permanently taking it out
// of reach of the untreated-illness mortality pathway the diagnostic suite
// (tools/npc-diagnostic.js's medical-severe-illness-death scenario) relies
// on. Autonomous NPCs leave chronic conditions to the separate caregiving
// pass instead of curing them via a single family/autonomous decision.
test('autonomous NPC treatment leaves an already-chronic condition untreated (caregiving handles it instead)',()=>{
  const context=newContext('auto-chronic-excluded');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'chronic',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    const condition=MedicalSystem.activeConditions(npc)[0];
    condition.yearsActive=50;
    HouseholdHealthSystem.tickHousehold(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s=HouseholdHealthSystem.ensure(household);
    const conditionAfter=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({decision:s.cases[0].decision,status:s.cases[0].status,severityUnchanged:conditionAfter.severity===5,stateUnchanged:conditionAfter.state==='diagnosed'});
  `);
  assert.equal(result.decision,'leave-untreated');
  assert.equal(result.status,'untreated');
  assert.equal(result.severityUnchanged,true);
  assert.equal(result.stateUnchanged,true);
});

// --- actionCounter and RNG isolation ---------------------------------------

test('MedicalSystem.actionCounter is unchanged after a household-driven treatment decision (family or autonomous)',()=>{
  const context=newContext('counter-isolation');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    const before=MedicalSystem.ensureMedicalState(npc,{world:World,year:World.year}).actionCounter;
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},{year:World.year});
    const afterFamily=MedicalSystem.ensureMedicalState(npc,{world:World,year:World.year}).actionCounter;
    return JSON.stringify({before,afterFamily,same:before===afterFamily});
  `);
  assert.equal(result.same,true);
});

test('MedicalSystem.actionCounter is unchanged after autonomous NPC treatment via tickHousehold',()=>{
  const context=newContext('counter-isolation-auto');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',4,{world:World,year:World.year,known:true});
    const before=MedicalSystem.ensureMedicalState(npc,{world:World,year:World.year}).actionCounter;
    HouseholdHealthSystem.tickHousehold(World,household,{year:World.year});
    const after=MedicalSystem.ensureMedicalState(npc,{world:World,year:World.year}).actionCounter;
    return JSON.stringify({before,after,same:before===after});
  `);
  assert.equal(result.same,true);
});

test('household treatment decisions do not consume the NPC own annual RNG stream',()=>{
  const context=newContext('rng-isolation-npc-stream');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    const expected=NpcSystem.stream(World,World.year,npc.id,'annual').next();
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},{year:World.year});
    const after=NpcSystem.stream(World,World.year,npc.id,'annual').next();
    return JSON.stringify({expected,after,equal:expected===after});
  `);
  assert.equal(result.equal,true);
});

test('household treatment decisions do not consume the global Random stream',()=>{
  const context=newContext('rng-isolation-global');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',4,{world:World,year:World.year,known:true});
    Random.setSeed('guard-seed');
    const first=Random.next();
    HouseholdHealthSystem.tickHousehold(World,household,{year:World.year});
    const after=Random.next();
    Random.setSeed('guard-seed'); Random.next();
    const expected=Random.next();
    return JSON.stringify({after,expected});
  `);
  assert.equal(result.after,result.expected);
});

// --- Exact-instance targeting -----------------------------------------------

test('exact-instance targeting: charge key includes the treated conditionInstanceId',()=>{
  const context=newContext('instance-key');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'infection',3,{world:World,year:World.year,known:true});
    const condition=MedicalSystem.activeConditions(npc)[0];
    const instanceId=condition.instanceId;
    HouseholdHealthSystem.prepareCases(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s2=HouseholdHealthSystem.ensure(household);
    const chargeKey=s2.pendingCharges[0].chargeKey;
    return JSON.stringify({chargeKey,instanceId,expected:'medical:'+World.year+':'+household.id+':'+npc.id+':'+instanceId+':basic',matches:chargeKey==='medical:'+World.year+':'+household.id+':'+npc.id+':'+instanceId+':basic'});
  `);
  assert.equal(result.matches,true,`chargeKey=${result.chargeKey} expected=${result.expected}`);
});

test('exact-instance targeting: two distinct conditions on the same NPC produce two distinct charges',()=>{
  const context=newContext('instance-two-conditions');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    MedicalSystem.addCondition(npc,'strain',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},{year:World.year});
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[1].caseId,{decision:'fund-recommended-care'},{year:World.year});
    const s2=HouseholdHealthSystem.ensure(household);
    const keys=s2.pendingCharges.map(c=>c.chargeKey);
    return JSON.stringify({chargeCount:s2.pendingCharges.length,distinct:new Set(keys).size===keys.length});
  `);
  assert.equal(result.chargeCount,2);
  assert.equal(result.distinct,true);
});

// --- Duplicate / reload idempotency -----------------------------------------

test('duplicate prevention: resolving an already-decided case a second time is a no-op with no extra charge',()=>{
  const context=newContext('dup-prevention');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    const caseId=s1.cases[0].caseId;
    const first=HouseholdHealthSystem.resolveDecision(World,household,caseId,{decision:'fund-recommended-care'},{year:World.year});
    const afterFirst=HouseholdHealthSystem.ensure(household);
    const second=HouseholdHealthSystem.resolveDecision(World,household,caseId,{decision:'fund-recommended-care'},{year:World.year});
    const afterSecond=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({firstApplied:first.applied,secondApplied:second.applied,secondReason:second.reason,chargeCountAfterFirst:afterFirst.pendingCharges.length,chargeCountAfterSecond:afterSecond.pendingCharges.length});
  `);
  assert.equal(result.firstApplied,true);
  assert.equal(result.secondApplied,false);
  assert.equal(result.secondReason,'already-decided');
  assert.equal(result.chargeCountAfterFirst,1);
  assert.equal(result.chargeCountAfterSecond,1);
});

test('reload idempotency: migrate() preserves cases and charges byte-for-byte after a resolved decision',()=>{
  const context=newContext('reload-idempotency');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},{year:World.year});
    const before=JSON.stringify(HouseholdHealthSystem.ensure(household));
    HouseholdHealthSystem.migrate(household);
    const after=JSON.stringify(HouseholdHealthSystem.ensure(household));
    HouseholdHealthSystem.migrate(household);
    const afterTwice=JSON.stringify(HouseholdHealthSystem.ensure(household));
    return JSON.stringify({match:before===after,idempotent:after===afterTwice});
  `);
  assert.equal(result.match,true);
  assert.equal(result.idempotent,true);
});

// --- Savings/assets/debt allocation and accounting identity ----------------

test('treatment cost is drawn from household savings before creating any new debt',()=>{
  const context=newContext('alloc-savings-first');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    household.finances.debt=0;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},Object.assign({year:World.year},${CLINIC_CONTEXT}));
    HouseholdHealthSystem.tickHousehold(World,household,{year:World.year});
    HouseholdSystem.tick(World,{year:World.year});
    const f=household.finances;
    const s2=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({treatmentCosts:s2.annual.treatmentCosts,debt:f.debt,medicalDebtAdded:s2.annual.medicalDebtAdded,savingsDropped:f.savings<100000});
  `);
  assert.ok(result.treatmentCosts>0);
  assert.equal(result.debt,0);
  assert.equal(result.medicalDebtAdded,0);
  assert.equal(result.savingsDropped,true);
});

test('household.finances mirrors treatmentCosts/medicalDebtAdded and expenseBreakdown.medicalTreatment after HouseholdSystem.tick',()=>{
  const context=newContext('finance-fields');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=50;
    household.finances.debt=0;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},Object.assign({year:World.year},${CLINIC_CONTEXT}));
    HouseholdHealthSystem.tickHousehold(World,household,{year:World.year});
    HouseholdSystem.tick(World,{year:World.year});
    const f=household.finances;
    const annual=HouseholdHealthSystem.ensure(household).annual;
    return JSON.stringify({
      financeTreatmentCosts:f.treatmentCosts,annualTreatmentCosts:annual.treatmentCosts,
      financeMedicalDebtAdded:f.medicalDebtAdded,annualMedicalDebtAdded:annual.medicalDebtAdded,
      breakdownMedicalTreatment:f.expenseBreakdown.medicalTreatment
    });
  `);
  assert.ok(result.financeTreatmentCosts>0);
  assert.equal(result.financeTreatmentCosts,result.annualTreatmentCosts);
  assert.ok(result.financeMedicalDebtAdded>0);
  assert.equal(result.financeMedicalDebtAdded,result.annualMedicalDebtAdded);
  assert.equal(result.breakdownMedicalTreatment,result.financeTreatmentCosts);
});

// household.finances is a single shared pool -- savings pay down the
// household's combined deficit (ordinary rent/food/health costs plus any
// treatment charge) together, not a medical-only bucket. So an underfunded
// household's medicalDebtAdded isn't simply "cost minus savings"; it's
// whatever portion of the (capped-at-cost) treatment charge the combined
// allocation left uncovered. This compares a broke household against an
// amply-funded one (same seed/settlement/condition/treatment, so identical
// treatmentCosts) to demonstrate medicalDebtAdded (a) never exceeds the
// actual treatment cost and (b) is genuinely driven by what's covered, not
// unconditionally set to the full cost regardless of resources.
test('an uncovered treatment cost becomes household debt capped at the actual charge, and drops to zero once resources cover it',()=>{
  const context=newContext('alloc-debt-remainder');
  const result=run(context,`
    const householdBroke=HouseholdSystem.create(World,{settlementId:World.activeSettlementId,memberIds:[],dependentIds:[]});
    householdBroke.finances.savings=0; householdBroke.finances.debt=0;
    const npcBroke=NpcSystem.upsert(World,{id:'npc:broke',firstName:'B',lastName:'Roke',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,householdBroke.id,npcBroke.id,false);
    MedicalSystem.addCondition(npcBroke,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,householdBroke,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const brokeCases=HouseholdHealthSystem.ensure(householdBroke);
    HouseholdHealthSystem.resolveDecision(World,householdBroke,brokeCases.cases[0].caseId,{decision:'fund-recommended-care'},Object.assign({year:World.year},${CLINIC_CONTEXT}));
    HouseholdHealthSystem.tickHousehold(World,householdBroke,{year:World.year});
    const treatmentCosts=HouseholdHealthSystem.ensure(householdBroke).annual.treatmentCosts;
    HouseholdSystem.tick(World,{year:World.year});
    const brokeDebtAdded=HouseholdHealthSystem.ensure(householdBroke).annual.medicalDebtAdded;
    const brokeDebt=householdBroke.finances.debt;

    const householdFunded=HouseholdSystem.create(World,{settlementId:World.activeSettlementId,memberIds:[],dependentIds:[]});
    householdFunded.finances.savings=100000; householdFunded.finances.debt=0;
    const npcFunded=NpcSystem.upsert(World,{id:'npc:funded',firstName:'F',lastName:'Unded',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,householdFunded.id,npcFunded.id,false);
    MedicalSystem.addCondition(npcFunded,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,householdFunded,Object.assign({year:World.year},${CLINIC_CONTEXT}));
    const fundedCases=HouseholdHealthSystem.ensure(householdFunded);
    HouseholdHealthSystem.resolveDecision(World,householdFunded,fundedCases.cases[0].caseId,{decision:'fund-recommended-care'},Object.assign({year:World.year},${CLINIC_CONTEXT}));
    HouseholdHealthSystem.tickHousehold(World,householdFunded,{year:World.year});
    HouseholdSystem.tick(World,{year:World.year});
    const fundedDebtAdded=HouseholdHealthSystem.ensure(householdFunded).annual.medicalDebtAdded;

    return JSON.stringify({treatmentCosts,brokeDebtAdded,brokeDebt,fundedDebtAdded,brokeCapped:brokeDebtAdded<=treatmentCosts,brokePositive:brokeDebtAdded>0,brokeWentIntoDebt:brokeDebt>0});
  `);
  assert.ok(result.treatmentCosts>0);
  assert.equal(result.brokePositive,true);
  assert.equal(result.brokeCapped,true,`medicalDebtAdded ${result.brokeDebtAdded} exceeded treatmentCosts ${result.treatmentCosts}`);
  assert.equal(result.brokeWentIntoDebt,true);
  assert.equal(result.fundedDebtAdded,0);
});

test('accounting identity holds after a household-year tick that includes a funded treatment charge',()=>{
  const context=newContext('accounting-identity');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    household.finances.savings=200;
    const npc=NpcSystem.upsert(World,{id:'npc:acct',firstName:'A',lastName:'Cct',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,Object.assign({year:World.year,subject:S},${CLINIC_CONTEXT}));
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},Object.assign({year:World.year,subject:S},${CLINIC_CONTEXT}));
    HouseholdHealthSystem.tickHousehold(World,household,{year:World.year,subject:S});
    HouseholdSystem.tick(World,{year:World.year,subject:S});
    const f=household.finances;
    const identity=f.personalAssetChange+f.sharedSavingsChange-f.householdDebtChange;
    return JSON.stringify({identity,balance:f.lastBalance,matches:Math.abs(identity-f.lastBalance)<0.01});
  `);
  assert.equal(result.matches,true,`identity=${result.identity} balance=${result.balance}`);
});

// --- Annual ordering ---------------------------------------------------------

test('annual ordering: advanceYear runs household health after both NPC tick and the player own medical tick',()=>{
  const src=fs.readFileSync('js/ui.js','utf8');
  const fnStart=src.indexOf('function advanceYear(');
  const fnBody=src.slice(fnStart,src.indexOf('\nfunction advance(',fnStart));
  const npcTickIndex=fnBody.indexOf('NpcSystem.tick(');
  const personalTickIndex=fnBody.indexOf('runPersonalYearTick()');
  const householdHealthIndex=fnBody.indexOf('NpcSystem.applyHouseholdHealthTick(');
  assert.ok(npcTickIndex>=0&&personalTickIndex>=0&&householdHealthIndex>=0);
  assert.ok(npcTickIndex<personalTickIndex,'NPC medical progression runs before the player own annual medical tick');
  assert.ok(personalTickIndex<householdHealthIndex,'household health (transmission/treatment) runs after the player own annual medical tick');
});

test('annual ordering: NPC tick defers household health so it can be run again explicitly afterward without double-applying',()=>{
  const src=fs.readFileSync('js/ui.js','utf8');
  const fnStart=src.indexOf('function advanceYear(');
  const fnBody=src.slice(fnStart,src.indexOf('\nfunction advance(',fnStart));
  assert.match(fnBody,/NpcSystem\.tick\(World,\{[^}]*deferHousehold:\s*true/);
});

test('annual ordering: household cases are prepared/resolved before NPC tick, and charges are settled after NPC tick but before HouseholdSystem.tick',()=>{
  const src=fs.readFileSync('js/ui.js','utf8');
  const fnStart=src.indexOf('function advanceYear(');
  const fnBody=src.slice(fnStart,src.indexOf('\nfunction advance(',fnStart));
  const prepareIndex=fnBody.indexOf('NpcSystem.prepareAndResolveHouseholdCases(');
  const npcTickIndex=fnBody.indexOf('NpcSystem.tick(');
  const settleIndex=fnBody.indexOf('NpcSystem.settleHouseholdTreatmentCharges(');
  const householdFinanceIndex=fnBody.indexOf('HouseholdSystem.tick(World,{year');
  assert.ok(prepareIndex>=0&&npcTickIndex>=0&&settleIndex>=0&&householdFinanceIndex>=0);
  assert.ok(prepareIndex<npcTickIndex,'household cases are prepared and resolved before NPC medical progression');
  assert.ok(npcTickIndex<settleIndex,'treatment charges are settled after NPC medical progression');
  assert.ok(settleIndex<householdFinanceIndex,'charges are settled before HouseholdSystem.tick reads treatmentCosts');
});

test('annual pipeline regression: a treatment resolved this year is reflected in HouseholdSystem.tick the same year, not one year late',()=>{
  const context=newContext('same-year-settlement');
  const result=run(context,`
    ${setupNpcHousehold}
    household.settlementId='kostrin';
    household.finances.savings=50;
    MedicalSystem.addCondition(npc,'respiratory',5,{world:World,year:World.year,known:true});
    World.year++;
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,deferHousehold:true});
    NpcSystem.settleHouseholdTreatmentCharges(World,World.year);
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const treatmentCostsThisYear=household.finances.treatmentCosts;
    const debtThisYear=household.finances.debt;
    return JSON.stringify({treatmentCostsThisYear,debtThisYear});
  `);
  assert.ok(result.treatmentCostsThisYear>0,'treatment resolved this year should already be reflected in this year finance settlement');
  assert.ok(result.debtThisYear>=0);
});

test('annual ordering: a household transmission proposed during the deferred window is only applied on the explicit household health call',()=>{
  const context=newContext('ordering-functional');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const source=NpcSystem.upsert(World,{id:'npc:order-source',firstName:'So',lastName:'Urce',sex:'F',birthYear:World.year-30,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:80,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,source.id,false);
    MedicalSystem.addCondition(source,'respiratory',5,{world:World,year:World.year,known:true,state:'symptomatic'});
    const target=NpcSystem.upsert(World,{id:'npc:order-target',firstName:'Ta',lastName:'Rget',sex:'M',birthYear:World.year-30,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:80,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,target.id,false);
    household.housing.rooms=1; household.foodSecurity=0.1;
    NpcSystem.syncLegacy(World,S,Lineage);
    let transmittedDuringDeferredNpcTick=false, transmittedAfterHouseholdCall=false;
    for(let i=0;i<200&&!transmittedAfterHouseholdCall;i++){
      World.year++; S.age++;
      NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,deferHousehold:true});
      const midSummary=HouseholdHealthSystem.summary(HouseholdSystem.findByMember(World,S.npcId));
      if(midSummary.transmissions>0) transmittedDuringDeferredNpcTick=true;
      NpcSystem.applyHouseholdHealthTick(World,World.year,S,Lineage,[],new Set());
      const afterSummary=HouseholdHealthSystem.summary(HouseholdSystem.findByMember(World,S.npcId));
      if(afterSummary.transmissions>0) transmittedAfterHouseholdCall=true;
    }
    return JSON.stringify({transmittedDuringDeferredNpcTick,transmittedAfterHouseholdCall});
  `);
  assert.equal(result.transmittedDuringDeferredNpcTick,false,'deferHousehold:true must not apply transmission by itself');
  assert.equal(result.transmittedAfterHouseholdCall,true,'transmission should eventually apply once household health is explicitly ticked');
});

// --- Household case lifecycle reconciliation (phase 4B-4 review fix #2) ----

test('reconcileCases closes a case whose condition has resolved',()=>{
  const context=newContext('reconcile-resolved');
  const result=run(context,`
    ${setupNpcHousehold}
    MedicalSystem.addCondition(npc,'injury',1,{world:World,year:World.year,known:true,state:'diagnosed'});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const condition=MedicalSystem.activeConditions(npc)[0];
    condition.state='resolved';condition.resolved=true;
    HouseholdHealthSystem.reconcileCases(World,household,{year:World.year});
    const s=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({status:s.cases[0].status,resolved:s.cases[0].resolved,pending:HouseholdHealthSystem.pendingCases(World,household,{year:World.year}).length});
  `);
  assert.equal(result.status,'closed');
  assert.equal(result.resolved,true);
  assert.equal(result.pending,0);
});

test('reconcileCases closes a case when the patient died',()=>{
  const context=newContext('reconcile-death');
  const result=run(context,`
    ${setupNpcHousehold}
    MedicalSystem.addCondition(npc,'injury',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    npc.alive=false;
    HouseholdHealthSystem.reconcileCases(World,household,{year:World.year});
    const s=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({status:s.cases[0].status,resolved:s.cases[0].resolved});
  `);
  assert.equal(result.status,'closed');
  assert.equal(result.resolved,true);
});

test('reconcileCases closes a case when the patient leaves the household (no longer a member)',()=>{
  const context=newContext('reconcile-left');
  const result=run(context,`
    ${setupNpcHousehold}
    MedicalSystem.addCondition(npc,'injury',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    HouseholdSystem.removeMember(World,household.id,npc.id);
    HouseholdHealthSystem.reconcileCases(World,household,{year:World.year});
    const s=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({status:s.cases[0].status,resolved:s.cases[0].resolved});
  `);
  assert.equal(result.status,'closed');
  assert.equal(result.resolved,true);
});

test('reconcileCases leaves a genuinely still-active case alone',()=>{
  const context=newContext('reconcile-active');
  const result=run(context,`
    ${setupNpcHousehold}
    MedicalSystem.addCondition(npc,'injury',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    HouseholdHealthSystem.reconcileCases(World,household,{year:World.year});
    const s=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({status:s.cases[0].status,resolved:s.cases[0].resolved});
  `);
  assert.equal(result.status,'pending');
  assert.equal(result.resolved,false);
});

test('reconcileCases is idempotent and closed cases disappear from pendingCases()/history is preserved',()=>{
  const context=newContext('reconcile-idempotent');
  const result=run(context,`
    ${setupNpcHousehold}
    MedicalSystem.addCondition(npc,'injury',1,{world:World,year:World.year,known:true,state:'diagnosed'});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const caseId=HouseholdHealthSystem.ensure(household).cases[0].caseId;
    const condition=MedicalSystem.activeConditions(npc)[0];
    condition.state='resolved';condition.resolved=true;
    HouseholdHealthSystem.reconcileCases(World,household,{year:World.year});
    const once=JSON.stringify(HouseholdHealthSystem.ensure(household).cases);
    HouseholdHealthSystem.reconcileCases(World,household,{year:World.year});
    const twice=JSON.stringify(HouseholdHealthSystem.ensure(household).cases);
    const violations=HouseholdHealthSystem.checkInvariants(household);
    return JSON.stringify({idempotent:once===twice,caseStillPresent:HouseholdHealthSystem.ensure(household).cases.some(c=>c.caseId===caseId),violations});
  `);
  assert.equal(result.idempotent,true);
  assert.equal(result.caseStillPresent,true,'closed cases preserve history rather than being deleted');
  assert.deepEqual(result.violations,[]);
});

test('NpcSystem.prepareAndResolveHouseholdCases reconciles a departed member before preparing new cases (integration)',()=>{
  const context=newContext('reconcile-integration');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:reconcile-integration',firstName:'R',lastName:'Econcile',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'injury',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    World.year++;
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    npc.alive=false;
    World.year++;
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    const s=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({status:s.cases[0].status,pendingCount:HouseholdHealthSystem.pendingCases(World,household,{year:World.year,subject:S}).length});
  `);
  assert.equal(result.status,'closed');
  assert.equal(result.pendingCount,0);
});

// --- Subject's own condition excluded from family-treatment cases (fix #5) -

test('prepareCases does not create a household case for the subject own condition',()=>{
  const context=newContext('subject-exclusion');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    MedicalSystem.addCondition(S,'respiratory',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year,subject:S});
    const s=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({caseCount:s.cases.filter(c=>c.npcId===String(S.npcId)).length});
  `);
  assert.equal(result.caseCount,0);
});

test('prepareCases still creates a case for another household member while excluding the subject',()=>{
  const context=newContext('subject-exclusion-sibling');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:subject-exclusion-sibling',firstName:'Sib',lastName:'Ling',sex:'M',birthYear:World.year-20,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(S,'respiratory',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    MedicalSystem.addCondition(npc,'injury',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year,subject:S});
    const s=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({subjectCases:s.cases.filter(c=>c.npcId===String(S.npcId)).length,otherCases:s.cases.filter(c=>c.npcId===npc.id).length});
  `);
  assert.equal(result.subjectCases,0);
  assert.equal(result.otherCases,1);
});

// --- settleTreatmentCharges idempotency (phase 4B-4 review fix #4) --------

test('settleTreatmentCharges called twice in the same year preserves annual.treatmentCosts instead of resetting it to zero',()=>{
  const context=newContext('settle-idempotent-same-year');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},{year:World.year});
    const first=HouseholdHealthSystem.settleTreatmentCharges(World,household,{year:World.year});
    const second=HouseholdHealthSystem.settleTreatmentCharges(World,household,{year:World.year});
    const s2=HouseholdHealthSystem.ensure(household);
    return JSON.stringify({firstCosts:first.treatmentCosts,secondCosts:second.treatmentCosts,annualCosts:s2.annual.treatmentCosts,firstPositive:first.treatmentCosts>0});
  `);
  assert.equal(result.firstPositive,true);
  assert.equal(result.secondCosts,result.firstCosts,'a repeated same-year call must preserve annual.treatmentCosts');
  assert.equal(result.annualCosts,result.firstCosts);
});

test('settleTreatmentCharges accumulates two separate treated cases settled within the same year',()=>{
  const context=newContext('settle-accumulate-same-year');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    MedicalSystem.addCondition(npc,'strain',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},{year:World.year});
    const afterFirstDecision=HouseholdHealthSystem.settleTreatmentCharges(World,household,{year:World.year});
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[1].caseId,{decision:'fund-recommended-care'},{year:World.year});
    const afterSecondDecision=HouseholdHealthSystem.settleTreatmentCharges(World,household,{year:World.year});
    return JSON.stringify({firstCosts:afterFirstDecision.treatmentCosts,secondCosts:afterSecondDecision.treatmentCosts,grew:afterSecondDecision.treatmentCosts>afterFirstDecision.treatmentCosts});
  `);
  assert.equal(result.grew,true,'settling a second case the same year should add to, not replace, the running total');
});

test('settleTreatmentCharges resets annual.treatmentCosts on a new year rather than carrying last year total forward',()=>{
  const context=newContext('settle-year-reset');
  const result=run(context,`
    ${setupNpcHousehold}
    household.finances.savings=100000;
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    HouseholdHealthSystem.prepareCases(World,household,{year:World.year});
    const s1=HouseholdHealthSystem.ensure(household);
    HouseholdHealthSystem.resolveDecision(World,household,s1.cases[0].caseId,{decision:'fund-recommended-care'},{year:World.year});
    const yearOne=HouseholdHealthSystem.settleTreatmentCharges(World,household,{year:World.year});
    const nextYear=World.year+1;
    const yearTwo=HouseholdHealthSystem.settleTreatmentCharges(World,household,{year:nextYear});
    return JSON.stringify({yearOneCosts:yearOne.treatmentCosts,yearTwoCosts:yearTwo.treatmentCosts});
  `);
  assert.ok(result.yearOneCosts>0);
  assert.equal(result.yearTwoCosts,0);
});

// --- Real home-care hours from queued decisions (phase 4B-4 review fix #3) -

test('applyHouseholdHealthTick feeds an explicit subjectCareHours value into real caregiving hours (not hardcoded 0)',()=>{
  const context=newContext('subject-care-hours-real');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:care-hours-patient',firstName:'C',lastName:'Are',sex:'F',birthYear:World.year-8,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'injury',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    NpcSystem.applyHouseholdHealthTick(World,World.year,S,Lineage,[],new Set(),2);
    const summary=HouseholdHealthSystem.summary(household);
    return JSON.stringify({provided:summary.caregivingHoursProvided});
  `);
  assert.ok(result.provided>0,'an explicit non-zero subjectCareHours should now feed real caregiving hours');
});

test('applyHouseholdHealthTick caps subjectCareHours at 3 even if a larger value is supplied',()=>{
  const context=newContext('subject-care-hours-cap');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:care-hours-cap',firstName:'C',lastName:'Ap',sex:'F',birthYear:World.year-8,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'chronic',5,{world:World,year:World.year,known:true,state:'chronic'});
    NpcSystem.applyHouseholdHealthTick(World,World.year,S,Lineage,[],new Set(),99);
    const summary=HouseholdHealthSystem.summary(household);
    return JSON.stringify({provided:summary.caregivingHoursProvided});
  `);
  assert.ok(result.provided<=3,'subjectCareHours must be capped at 3 regardless of the supplied value');
});

test('applyCaregiving does not let a patient count as their own automatic healthy caregiver',()=>{
  const context=newContext('patient-not-own-caregiver');
  const result=run(context,`
    const household=HouseholdSystem.create(World,{settlementId:World.activeSettlementId,memberIds:[],dependentIds:[]});
    const elder=NpcSystem.upsert(World,{id:'npc:elder-patient',firstName:'E',lastName:'Lder',sex:'M',birthYear:World.year-75,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,elder.id,false);
    MedicalSystem.addCondition(elder,'injury',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    const result=HouseholdHealthSystem.applyCaregiving(World,household,{year:World.year});
    return JSON.stringify({required:result.required,provided:result.provided});
  `);
  assert.ok(result.required>0);
  assert.equal(result.provided,0,'a lone elderly patient (severity 3, age>=70) must not count as their own automatic caregiver');
});

// --- ui.js source-level wiring for subjectCareHours (fix #3) ---------------

test('ui.js derives subjectCareHours from applied home-care decisions and the remaining planning-hour budget, not a hardcoded 0',()=>{
  const src=fs.readFileSync('js/ui.js','utf8');
  const fnStart=src.indexOf('function advanceYear(');
  const fnBody=src.slice(fnStart,src.indexOf('\nfunction advance(',fnStart));
  assert.ok(/reason===.home-care./.test(fnBody),'advanceYear should count applied home-care decisions from resolveQueuedFamilyDecisions');
  assert.ok(/planHours\(\)/.test(fnBody),'advanceYear should respect the remaining planning-hour budget for subject caregiving hours');
  assert.match(fnBody,/NpcSystem\.applyHouseholdHealthTick\(World,World\.year,S,Lineage,householdHealthNotices,new Set\(\),\s*__subjectHomeCareHours\)/);
});
