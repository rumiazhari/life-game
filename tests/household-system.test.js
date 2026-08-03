'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function newContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

test('an NPC cannot belong to two households',()=>{
  const context=newContext('household-unique');
  const result=JSON.parse(expose(context,`(function(){
    const npc=Object.values(World.npcs).find(n=>!n.isSubject);
    const first=HouseholdSystem.findByMember(World,npc.id);
    const second=HouseholdSystem.create(World,{settlementId:npc.locationId,memberIds:[],origin:'test'});
    HouseholdSystem.addMember(World,second.id,npc.id,false);
    const memberships=Object.values(World.households).filter(h=>h.memberIds.includes(npc.id));
    return JSON.stringify({first:first&&first.id,second:second.id,memberships:memberships.length,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.memberships,1);
  assert.equal(result.violations.length,0);
});

test('marriage and separation reconcile subject household membership',()=>{
  const context=newContext('household-marriage');
  const result=JSON.parse(expose(context,`(function(){
    S.age=25; World.year=S.dob+S.age; S.livingAtHome=false;
    const contact=makeContact(S.sex==='M'?'F':'M'); contact.role='spouse'; contact.npcMarried=false; S.contacts.push(contact); S.married=true; S.status='Married'; syncPartnerMirror();
    NpcSystem.syncLegacy(World,S,Lineage);
    const marriedHouse=HouseholdSystem.findByMember(World,S.npcId);
    const together=marriedHouse.memberIds.includes(contact.npcId);
    contact.role='friend'; S.married=false; S.status='Single'; syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const subjectHouse=HouseholdSystem.findByMember(World,S.npcId);
    const partnerHouse=HouseholdSystem.findByMember(World,contact.npcId);
    return JSON.stringify({together,separated:subjectHouse.id!==partnerHouse.id,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.together,true);
  assert.equal(result.separated,true);
  assert.equal(result.violations.length,0);
});

test('moving a household updates every non-subject member location',()=>{
  const context=newContext('household-move');
  const result=JSON.parse(expose(context,`(function(){
    const members=Object.values(World.npcs).filter(n=>!n.isSubject&&n.alive).slice(0,2);
    const household=HouseholdSystem.create(World,{settlementId:'branec',memberIds:members.map(n=>n.id),origin:'move-test'});
    members.forEach(n=>HouseholdSystem.addMember(World,household.id,n.id,false));
    HouseholdSystem.move(World,household,'veskar',World.year);
    return JSON.stringify({settlement:household.settlementId,locations:members.map(n=>n.locationId),violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.settlement,'veskar');
  assert.ok(result.locations.every(id=>id==='veskar'));
  assert.equal(result.violations.length,0);
});

test('an employed subject contributes take-home without duplicating personal savings',()=>{
  const context=newContext('household-income');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=900;
    NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); household.finances.savings=0; household.finances.debt=0;
    S.__worldWagePaid=900; S.__worldWagePaidYear=World.year;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid});
    return JSON.stringify({income:household.finances.income,expenses:household.finances.expenses,savings:household.finances.savings,debt:household.finances.debt,personalAssets:S.assets,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.income,900);
  assert.ok(result.expenses>0);
  assert.equal(result.debt,0);
  assert.equal(result.savings,0);
  assert.equal(result.personalAssets,900);
  assert.equal(result.violations.length,0);
});

test('a deceased dependent is historical only and no longer creates food expenses',()=>{
  const context=newContext('deceased-dependent');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.kids=1;
    const child=bearChild(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const before=HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage})[0]||null;
    const beforeDependent=household.dependentIds.includes(child.npcId);
    const beforeExpenses=household.finances.expenses;
    child.alive=false; NpcSystem.markLegacyKinDeath(World,S,Lineage,child);
    NpcSystem.migrate(World,S,Lineage);
    const after=HouseholdSystem.findByMember(World,S.npcId);
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const runtime=World.settlements[after.settlementId], foodIndex=runtime.economy.foodPriceIndex, rentIndex=runtime.economy.rentIndex, pressure=PublicHealth.pressure(runtime);
    const expected=Math.round((220+after.housing.rooms*95)*rentIndex)+Math.round(110*foodIndex)+Math.round(90*pressure);
    return JSON.stringify({beforeDependent,afterMember:after.memberIds.includes(child.npcId),afterDependent:after.dependentIds.includes(child.npcId),historical:after.historicalMemberIds.includes(child.npcId),beforeExpenses,afterExpenses:after.finances.expenses,expected,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.beforeDependent,true);
  assert.equal(result.afterMember,false);
  assert.equal(result.afterDependent,false);
  assert.equal(result.historical,true);
  assert.ok(result.afterExpenses<result.beforeExpenses);
  assert.equal(result.afterExpenses,result.expected);
  assert.equal(result.violations.length,0);
});

test('real travel resolution moves the subject household and survives registry migration',()=>{
  const context=newContext('household-travel');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=10000; S.married=true; S.status='Married';
    logEv=function(){}; renderStats=function(){}; updatePersonalStanding=function(){}; renderIdentity=function(){};
    const partner=makeContact(S.sex==='M'?'F':'M'); partner.role='spouse'; partner.npcMarried=false; partner.npcSpouseName=null; partner.npcSpouseTemperament=null; S.contacts.push(partner); syncPartnerMirror();
    S.kids=1; const child=bearChild(); NpcSystem.syncLegacy(World,S,Lineage);
    const scheduled=scheduleTravel('veskar'); const trip=S.traveling; if(trip) trip.arriveYear=World.year; resolveTravel();
    const household=HouseholdSystem.findByMember(World,S.npcId); const beforeMigration={household:household&&household.settlementId,subject:World.npcs[S.npcId]&&World.npcs[S.npcId].locationId,partner:World.npcs[partner.npcId]&&World.npcs[partner.npcId].locationId,child:World.npcs[child.npcId]&&World.npcs[child.npcId].locationId};
    NpcSystem.migrate(World,S,Lineage);
    const after=HouseholdSystem.findByMember(World,S.npcId);
    return JSON.stringify({scheduled:scheduled.ok,legacy:S.location.settlementId,world:World.activeSettlementId,beforeMigration,afterHousehold:after&&after.settlementId,afterSubject:World.npcs[S.npcId]&&World.npcs[S.npcId].locationId,afterPartner:World.npcs[partner.npcId]&&World.npcs[partner.npcId].locationId,afterChild:World.npcs[child.npcId]&&World.npcs[child.npcId].locationId,violations:NpcSystem.checkInvariants(World,S,Lineage)});
  })()`));
  assert.equal(result.scheduled,true);
  assert.equal(result.legacy,'veskar');
  assert.equal(result.world,'veskar');
  assert.equal(result.beforeMigration.household,'veskar');
  assert.equal(result.beforeMigration.subject,'veskar');
  assert.equal(result.beforeMigration.partner,'veskar');
  assert.equal(result.beforeMigration.child,'veskar');
  assert.equal(result.afterHousehold,'veskar');
  assert.equal(result.afterSubject,'veskar');
  assert.equal(result.afterPartner,'veskar');
  assert.equal(result.afterChild,'veskar');
  assert.equal(result.violations.length,0);
});
