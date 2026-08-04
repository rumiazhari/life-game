'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function newContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function run(context,code){
  return JSON.parse(expose(context,`(function(){${code}})()`));
}

test('4B-3 integration: a full household-year tick runs caregiving before transmission and produces combined results',()=>{
  const context=newContext('hh-int-1');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const caregiver=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false&&n.id!==S.npcId);
    HouseholdSystem.addMember(World,household.id,caregiver.id,false);
    const patient=NpcSystem.upsert(World,{id:'npc:patient-1',firstName:'Pat',lastName:'Ient',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:60,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,patient.id,false);
    MedicalSystem.addCondition(patient,'injury',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    const source=NpcSystem.upsert(World,{id:'npc:source-1',firstName:'So',lastName:'Urce',sex:'F',birthYear:World.year-30,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:80,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,source.id,false);
    MedicalSystem.addCondition(source,'respiratory',5,{world:World,year:World.year,known:true,state:'symptomatic'});
    household.housing.rooms=1; household.foodSecurity=0.1;
    NpcSystem.syncLegacy(World,S,Lineage);
    let transmitted=false, caregivingSeen=false;
    for(let i=0;i<200&&!(transmitted&&caregivingSeen);i++){
      World.year++; S.age++;
      NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
      const h=HouseholdSystem.findByMember(World,S.npcId);
      const summary=HouseholdHealthSystem.summary(h);
      if(summary.transmissions>0) transmitted=true;
      if(summary.caregivingHoursProvided>0) caregivingSeen=true;
    }
    return JSON.stringify({transmitted,caregivingSeen});
  `);
  assert.equal(result.transmitted,true);
  assert.equal(result.caregivingSeen,true);
});

test('4B-3 integration: an NPC newly infected via transmission does not progress until the following year',()=>{
  const context=newContext('hh-int-2');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const target=NpcSystem.upsert(World,{id:'npc:target-1',firstName:'Tar',lastName:'Get',sex:'M',birthYear:World.year-30,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:80,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,target.id,false);
    const source=NpcSystem.upsert(World,{id:'npc:source-2',firstName:'So',lastName:'Urce',sex:'F',birthYear:World.year-30,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:80,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,source.id,false);
    MedicalSystem.addCondition(source,'respiratory',5,{world:World,year:World.year,known:true,state:'symptomatic'});
    household.housing.rooms=1; household.foodSecurity=0.1;
    NpcSystem.syncLegacy(World,S,Lineage);
    let found=null;
    for(let i=0;i<250&&!found;i++){
      World.year++; S.age++;
      const yearOfTick=World.year;
      NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
      const targetNow=World.npcs['npc:target-1'];
      const cond=targetNow.health.medical.conditions.find(c=>c.definitionId==='respiratory');
      if(cond&&!found){
        found={year:yearOfTick,lastProgressionYear:cond.lastProgressionYear,yearsActive:cond.yearsActive};
      }
    }
    return JSON.stringify({found});
  `);
  assert.ok(result.found,'expected the target NPC to eventually receive a transmitted respiratory condition');
  assert.equal(result.found.lastProgressionYear,result.found.year);
  assert.equal(result.found.yearsActive,0);
});

test('4B-3 integration: save/reload-style repeated migrate+tick sequences remain deterministic',()=>{
  function build(seed){
    const context=newContext(seed);
    run(context,`
      const household=HouseholdSystem.findByMember(World,S.npcId);
      const patient=NpcSystem.upsert(World,{id:'npc:patient-2',firstName:'Pat',lastName:'Ient',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:60,conditions:[]}});
      HouseholdSystem.addMember(World,household.id,patient.id,false);
      MedicalSystem.addCondition(patient,'injury',5,{world:World,year:World.year,known:true,state:'diagnosed'});
      const source=NpcSystem.upsert(World,{id:'npc:source-3',firstName:'So',lastName:'Urce',sex:'F',birthYear:World.year-30,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:80,conditions:[]}});
      HouseholdSystem.addMember(World,household.id,source.id,false);
      MedicalSystem.addCondition(source,'respiratory',5,{world:World,year:World.year,known:true,state:'symptomatic'});
      household.housing.rooms=1; household.foodSecurity=0.1;
      NpcSystem.syncLegacy(World,S,Lineage);
      return JSON.stringify({});
    `);
    for(let i=0;i<15;i++){
      run(context,`World.year++; S.age++; NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage}); NpcSystem.migrate(World,S,Lineage); return JSON.stringify({});`);
    }
    return run(context,`return JSON.stringify({npcs:World.npcs,households:World.households});`);
  }
  const a=build('hh-int-3'),b=build('hh-int-3');
  assert.equal(JSON.stringify(a),JSON.stringify(b));
});

test('4B-3 integration: a household with no eligible transmission/caregiving scenario is a safe no-op',()=>{
  const context=newContext('hh-int-4');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const h=HouseholdSystem.findByMember(World,S.npcId);
    const summary=HouseholdHealthSystem.summary(h);
    const check=Invariants.check(S,World);
    return JSON.stringify({summary,ok:check.ok,violations:check.violations});
  `);
  assert.equal(result.summary.transmissions,0);
  assert.equal(result.summary.caregivingHoursProvided,0);
  assert.equal(result.ok,true,JSON.stringify(result.violations));
});

test('4B-3 integration: repeated same-year NpcSystem.tick does not double-apply household transmission/caregiving',()=>{
  const context=newContext('hh-int-5');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const patient=NpcSystem.upsert(World,{id:'npc:patient-3',firstName:'Pat',lastName:'Ient',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:60,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,patient.id,false);
    MedicalSystem.addCondition(patient,'injury',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    household.housing.rooms=1; household.foodSecurity=0.1;
    NpcSystem.syncLegacy(World,S,Lineage);
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const h=HouseholdSystem.findByMember(World,S.npcId);
    const before=JSON.stringify(HouseholdHealthSystem.summary(h));
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const after=JSON.stringify(HouseholdHealthSystem.summary(h));
    return JSON.stringify({unchanged:before===after});
  `);
  assert.equal(result.unchanged,true);
});
