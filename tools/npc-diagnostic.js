'use strict';

const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('../tests/helpers/vm-loader');

const scenarios=[
  {name:'baseline',setup:''},
  {name:'recession',setup:"World.nationalModifiers={employmentSupport:-.25,pricePressure:.2,unrestPressure:.16};"},
  {name:'outbreak',setup:"const rt=World.settlements[World.activeSettlementId]; PublicHealth.triggerShock(rt,'outbreak',1,8,World.year); PublicHealth.triggerShock(rt,'clinicClosure',.8,6,World.year);"},
  {name:'prosperous-destination',setup:"World.settlements.veskar.economy.employmentIndex=1; World.settlements.veskar.economy.wageIndex=1.5; World.settlements.veskar.economy.rentIndex=.65; World.settlements.veskar.publicHealth.sanitation=1; World.settlements.veskar.security.unrest=0;"},
  {name:'high-surveillance',setup:"World.nationalModifiers={surveillancePressure:.3,unrestPressure:.18};"},
  {name:'legacy-repair',setup:"World.npcSchemaVersion=0; World.npcs={broken:{id:'broken',birthYear:'bad',health:{general:NaN},employment:{status:'employed',income:Infinity}}}; World.households={bad:{id:'bad',settlementId:World.activeSettlementId,memberIds:['broken','broken'],dependentIds:['missing'],finances:{income:NaN}}};"},
  // 4B-2: minimal persistent NPC medical progression scenarios. A healthy household with no
  // pre-existing conditions (medical progression should run quietly, no forced deaths), and a
  // household where a connected NPC carries a severe untreated condition that is expected to
  // eventually produce a condition-aware medical death via NpcSystem's existing death pathway.
  {name:'medical-healthy-household',setup:''},
  {name:'medical-severe-illness-death',setup:'',postMigrateSetup:"if(S.mother&&S.mother.npcId&&World.npcs[S.mother.npcId]){ const sick=World.npcs[S.mother.npcId]; MedicalSystem.addCondition(sick,'chronic',5,{world:World,year:World.year,known:true,state:'diagnosed'}); const cond=MedicalSystem.activeConditions(sick).find(c=>c.definitionId==='chronic'); if(cond) cond.yearsActive=200; }"},
  // 4B-3: household transmission (a contagious condition spreading to a co-resident over one or
  // more years) and caregiving (a severe illness in a household with an available caregiver
  // reducing burden / improving adherence over time).
  // These two use preLoopSetup (not postMigrateSetup) because the shared harness calls
  // bearChild()/livingAtHome=false between postMigrateSetup and the main loop, which can
  // rebuild the subject's household membership; adding the co-resident afterward guarantees
  // it actually shares the household the loop below will observe.
  // A comfortable crowding/food-security margin (extra co-residents, zero
  // food security) keeps this scenario robust to the phase 4B-4 natural
  // NPC diagnosis feature: a naturally-diagnosed contagious NPC now correctly
  // transmits at a reduced multiplier (TRANSMISSION_STATE_MULTIPLIERS.diagnosed
  // = 0.90 vs .symptomatic = 1.00), which trims risk enough to occasionally
  // flip a razor-thin-margin scenario's outcome for a given seed; the wider
  // margin here keeps the eventual-transmission expectation reliable either way.
  {name:'household-transmission',setup:'',preLoopSetup:"const household=HouseholdSystem.findByMember(World,S.npcId); household.housing.rooms=1; household.foodSecurity=0; const carrier=NpcSystem.upsert(World,{id:'npc:diag-carrier',firstName:'Cass',lastName:'Carrier',sex:'F',birthYear:World.year-28,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'diagnostic',health:{general:80,conditions:[]}}); HouseholdSystem.addMember(World,household.id,carrier.id,false); MedicalSystem.addCondition(carrier,'respiratory',5,{world:World,year:World.year,known:true,state:'symptomatic'}); ['npc:diag-cohabitant-1','npc:diag-cohabitant-2','npc:diag-cohabitant-3'].forEach(id=>{ const cohabitant=NpcSystem.upsert(World,{id,firstName:'Co',lastName:'Habitant',sex:'M',birthYear:World.year-30,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'diagnostic',health:{general:80,conditions:[]}}); HouseholdSystem.addMember(World,household.id,cohabitant.id,false); }); NpcSystem.syncLegacy(World,S,Lineage);"},
  // An explicit healthy adult co-resident is added alongside the patient so
  // this scenario tests genuine second-party caregiving. Before the phase
  // 4B-4 review fix, a lone patient (no other adult present) could count as
  // their own "automatic healthy caregiver" and this scenario's nonzero
  // caregivingHoursProvidedTotal was actually coming from that self-care bug
  // being tripped elsewhere in the simulation, not from real caregiving of
  // this patient -- adding a dedicated caregiver here makes the assertion
  // mean what it says.
  {name:'household-caregiving',setup:'',preLoopSetup:"const household=HouseholdSystem.findByMember(World,S.npcId); const patient=NpcSystem.upsert(World,{id:'npc:diag-patient',firstName:'Pat',lastName:'Patient',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'diagnostic',health:{general:60,conditions:[]}}); HouseholdSystem.addMember(World,household.id,patient.id,false); MedicalSystem.addCondition(patient,'injury',5,{world:World,year:World.year,known:true,state:'diagnosed'}); const caregiver=NpcSystem.upsert(World,{id:'npc:diag-caregiver',firstName:'Car',lastName:'Egiver',sex:'F',birthYear:World.year-38,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'diagnostic',health:{general:90,conditions:[]}}); HouseholdSystem.addMember(World,household.id,caregiver.id,false); NpcSystem.syncLegacy(World,S,Lineage);"}
];

function runScenario(scenario){
  const context=createWorldContext();
  const payload=expose(context,`(function(){
    Random.setSeed(${JSON.stringify('phase3-diagnostic:'+scenario.name)});
    newWorld(); newLineage(); newHold(); newSubject();
    ${scenario.setup}
    NpcSystem.migrate(World,S,Lineage);
    ${scenario.postMigrateSetup||''}
    const openingIds=Object.keys(World.npcs).sort().join('|');
    const friend=makeContact(S.sex==='M'?'F':'M'); S.contacts.push(friend);
    const friend2=makeContact(S.sex==='M'?'F':'M'); S.contacts.push(friend2);
    S.age=24; World.year=S.dob+S.age; S.livingAtHome=false;
    bearChild();
    NpcSystem.syncLegacy(World,S,Lineage);
    ${scenario.preLoopSetup||''}
    Random.setSeed('personal-phase3'); Random.next();
    World.year++; S.age++;
    WorldSimulation.tick(World,{year:World.year});
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const personalAfter=Random.next();
    Random.setSeed('personal-phase3'); Random.next(); const personalExpected=Random.next();
    const genericCauses=new Set(['infant illness','illness during a healthcare crisis','natural causes']);
    let peakNpcs=Object.keys(World.npcs).length, peakHouseholds=Object.keys(World.households).length, deaths=0, births=0, moves=0, invariantFailures=[], medicalDeaths=0, medicalNotices=0;
    let householdTransmissions=0, householdTransmissionNotices=0, caregivingHoursRequiredTotal=0, caregivingHoursProvidedTotal=0;
    for(let i=0;i<99;i++){
      World.year++; S.age++;
      WorldSimulation.tick(World,{year:World.year});
      NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
      const notices=NpcSystem.drainNotices(World);
      deaths+=notices.filter(n=>n.type==='death').length;
      medicalDeaths+=notices.filter(n=>n.type==='death'&&!genericCauses.has(n.cause)).length;
      medicalNotices+=notices.filter(n=>String(n.type).indexOf('medical_')===0).length;
      householdTransmissionNotices+=notices.filter(n=>n.type==='medical_transmission').length;
      births+=notices.filter(n=>n.type==='birth').length;
      moves+=notices.filter(n=>n.type==='household_migration').length;
      peakNpcs=Math.max(peakNpcs,Object.keys(World.npcs).length);
      peakHouseholds=Math.max(peakHouseholds,Object.keys(World.households).length);
      Object.values(World.households).forEach(h=>{
        const summary=HouseholdHealthSystem.summary(h);
        if(summary.year===World.year){
          householdTransmissions+=summary.transmissions;
          caregivingHoursRequiredTotal+=summary.caregivingHoursRequired;
          caregivingHoursProvidedTotal+=summary.caregivingHoursProvided;
        }
      });
      const check=Invariants.check(S,World);
      if(!check.ok) invariantFailures.push(...check.violations.map(v=>'year '+World.year+': '+v));
      if(typeof WorkplaceSystem==='object'&&WorkplaceSystem&&typeof WorkplaceSystem.checkInvariants==='function'){
        const workplaceIssues=WorkplaceSystem.checkInvariants(World);
        if(workplaceIssues.length) invariantFailures.push(...workplaceIssues.map(v=>'year '+World.year+': workplace: '+v));
      }
    }
    const medicalInvariantFailures=invariantFailures.filter(v=>v.indexOf(' medical: ')!==-1).length;
    const stableBefore=JSON.stringify({npcs:World.npcs,households:World.households,memories:World.relationshipMemories});
    NpcSystem.migrate(World,S,Lineage);
    const stableAfter=JSON.stringify({npcs:World.npcs,households:World.households,memories:World.relationshipMemories});
    return JSON.stringify({
      scenario:${JSON.stringify(scenario.name)},years:100,openingIds,
      npcCount:Object.keys(World.npcs).length,householdCount:Object.keys(World.households).length,memoryCount:Object.keys(World.relationshipMemories).length,
      peakNpcs,peakHouseholds,deaths,births,moves,personalRngIsolated:personalAfter===personalExpected,
      migrationIdempotent:stableBefore===stableAfter,invariantFailures,
      deceasedWithJobs:Object.values(World.npcs).filter(n=>!n.alive&&n.employment.status!=='deceased').length,
      duplicateMemberships:(function(){const c={};Object.values(World.households).forEach(h=>h.memberIds.forEach(id=>c[id]=(c[id]||0)+1));return Object.values(c).filter(n=>n>1).length;})(),
      medicalDeaths,medicalNotices,medicalInvariantFailures,
      householdTransmissions,householdTransmissionNotices,caregivingHoursRequiredTotal,caregivingHoursProvidedTotal
    });
  })()`);
  const result=JSON.parse(payload);
  assert.equal(result.years,100);
  assert.equal(result.personalRngIsolated,true);
  assert.equal(result.migrationIdempotent,true);
  assert.equal(result.invariantFailures.length,0,result.invariantFailures.join('\n'));
  assert.equal(result.deceasedWithJobs,0);
  assert.equal(result.duplicateMemberships,0);
  assert.equal(result.medicalInvariantFailures,0);
  assert.ok(result.peakNpcs<=96);
  if(scenario.name==='medical-severe-illness-death') assert.ok(result.medicalDeaths>0,'expected the severe illness scenario to eventually produce a condition-aware medical death');
  if(scenario.name==='household-transmission') assert.ok(result.householdTransmissions>0,'expected the household-transmission scenario to eventually spread a contagious condition to a co-resident');
  if(scenario.name==='household-caregiving') assert.ok(result.caregivingHoursProvidedTotal>0,'expected the household-caregiving scenario to allocate caregiving hours to the severely ill patient');
  return result;
}

const first=scenarios.map(runScenario);
const second=scenarios.map(runScenario);
assert.deepEqual(first,second,'Phase 3 diagnostic must be deterministic');
console.log(JSON.stringify(first,null,2));
