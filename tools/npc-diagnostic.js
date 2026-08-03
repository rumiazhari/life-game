'use strict';

const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('../tests/helpers/vm-loader');

const scenarios=[
  {name:'baseline',setup:''},
  {name:'recession',setup:"World.nationalModifiers={employmentSupport:-.25,pricePressure:.2,unrestPressure:.16};"},
  {name:'outbreak',setup:"const rt=World.settlements[World.activeSettlementId]; PublicHealth.triggerShock(rt,'outbreak',1,8,World.year); PublicHealth.triggerShock(rt,'clinicClosure',.8,6,World.year);"},
  {name:'prosperous-destination',setup:"World.settlements.veskar.economy.employmentIndex=1; World.settlements.veskar.economy.wageIndex=1.5; World.settlements.veskar.economy.rentIndex=.65; World.settlements.veskar.publicHealth.sanitation=1; World.settlements.veskar.security.unrest=0;"},
  {name:'high-surveillance',setup:"World.nationalModifiers={surveillancePressure:.3,unrestPressure:.18};"},
  {name:'legacy-repair',setup:"World.npcSchemaVersion=0; World.npcs={broken:{id:'broken',birthYear:'bad',health:{general:NaN},employment:{status:'employed',income:Infinity}}}; World.households={bad:{id:'bad',settlementId:World.activeSettlementId,memberIds:['broken','broken'],dependentIds:['missing'],finances:{income:NaN}}};"}
];

function runScenario(scenario){
  const context=createWorldContext();
  const payload=expose(context,`(function(){
    Random.setSeed(${JSON.stringify('phase3-diagnostic:'+scenario.name)});
    newWorld(); newLineage(); newHold(); newSubject();
    ${scenario.setup}
    NpcSystem.migrate(World,S,Lineage);
    const openingIds=Object.keys(World.npcs).sort().join('|');
    const friend=makeContact(S.sex==='M'?'F':'M'); S.contacts.push(friend);
    const friend2=makeContact(S.sex==='M'?'F':'M'); S.contacts.push(friend2);
    S.age=24; World.year=S.dob+S.age; S.livingAtHome=false;
    bearChild();
    NpcSystem.syncLegacy(World,S,Lineage);
    Random.setSeed('personal-phase3'); Random.next();
    World.year++; S.age++;
    WorldSimulation.tick(World,{year:World.year});
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const personalAfter=Random.next();
    Random.setSeed('personal-phase3'); Random.next(); const personalExpected=Random.next();
    let peakNpcs=Object.keys(World.npcs).length, peakHouseholds=Object.keys(World.households).length, deaths=0, births=0, moves=0, invariantFailures=[];
    for(let i=0;i<99;i++){
      World.year++; S.age++;
      WorldSimulation.tick(World,{year:World.year});
      NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
      const notices=NpcSystem.drainNotices(World);
      deaths+=notices.filter(n=>n.type==='death').length;
      births+=notices.filter(n=>n.type==='birth').length;
      moves+=notices.filter(n=>n.type==='household_migration').length;
      peakNpcs=Math.max(peakNpcs,Object.keys(World.npcs).length);
      peakHouseholds=Math.max(peakHouseholds,Object.keys(World.households).length);
      const check=Invariants.check(S,World);
      if(!check.ok) invariantFailures.push(...check.violations.map(v=>'year '+World.year+': '+v));
    }
    const stableBefore=JSON.stringify({npcs:World.npcs,households:World.households,memories:World.relationshipMemories});
    NpcSystem.migrate(World,S,Lineage);
    const stableAfter=JSON.stringify({npcs:World.npcs,households:World.households,memories:World.relationshipMemories});
    return JSON.stringify({
      scenario:${JSON.stringify(scenario.name)},years:100,openingIds,
      npcCount:Object.keys(World.npcs).length,householdCount:Object.keys(World.households).length,memoryCount:Object.keys(World.relationshipMemories).length,
      peakNpcs,peakHouseholds,deaths,births,moves,personalRngIsolated:personalAfter===personalExpected,
      migrationIdempotent:stableBefore===stableAfter,invariantFailures,
      deceasedWithJobs:Object.values(World.npcs).filter(n=>!n.alive&&n.employment.status!=='deceased').length,
      duplicateMemberships:(function(){const c={};Object.values(World.households).forEach(h=>h.memberIds.forEach(id=>c[id]=(c[id]||0)+1));return Object.values(c).filter(n=>n>1).length;})()
    });
  })()`);
  const result=JSON.parse(payload);
  assert.equal(result.years,100);
  assert.equal(result.personalRngIsolated,true);
  assert.equal(result.migrationIdempotent,true);
  assert.equal(result.invariantFailures.length,0,result.invariantFailures.join('\n'));
  assert.equal(result.deceasedWithJobs,0);
  assert.equal(result.duplicateMemberships,0);
  assert.ok(result.peakNpcs<=96);
  return result;
}

const first=scenarios.map(runScenario);
const second=scenarios.map(runScenario);
assert.deepEqual(first,second,'Phase 3 diagnostic must be deterministic');
console.log(JSON.stringify(first,null,2));
