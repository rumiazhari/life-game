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
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=900; S.lifestyle.housing='room'; S.lifestyle.food='basic';
    NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); household.finances.savings=0; household.finances.debt=0;
    S.__worldWagePaid=900; S.__worldWagePaidYear=World.year;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid});
    return JSON.stringify({income:household.finances.income,expenses:household.finances.expenses,savings:household.finances.savings,debt:household.finances.debt,personalAssets:S.assets,finances:household.finances,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.income,900);
  assert.ok(result.expenses>0);
  assert.equal(result.debt,0);
  assert.equal(result.savings,0);
  assert.equal(result.personalAssets,900);
  assert.equal(result.finances.lastBalance,result.income-result.expenses);
  assert.equal(result.finances.personalAssetsRetained,Math.max(0,result.income-result.expenses));
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
    const beforeMemberIncrement=household.finances.expenseBreakdown.memberIncrement;
    child.alive=false; NpcSystem.markLegacyKinDeath(World,S,Lineage,child);
    NpcSystem.migrate(World,S,Lineage);
    const after=HouseholdSystem.findByMember(World,S.npcId);
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    return JSON.stringify({beforeDependent,afterMember:after.memberIds.includes(child.npcId),afterDependent:after.dependentIds.includes(child.npcId),historical:after.historicalMemberIds.includes(child.npcId),beforeExpenses,afterExpenses:after.finances.expenses,beforeMemberIncrement,afterMemberIncrement:after.finances.expenseBreakdown.memberIncrement,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.beforeDependent,true);
  assert.equal(result.afterMember,false);
  assert.equal(result.afterDependent,false);
  assert.equal(result.historical,true);
  assert.ok(result.afterExpenses<result.beforeExpenses);
  assert.ok(result.afterMemberIncrement<result.beforeMemberIncrement);
  assert.equal(result.violations.length,0);
});

test('an employed subject with an unemployed spouse shows member costs and a reconciled balance',()=>{
  const context=newContext('household-unemployed-spouse');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.lifestyle.housing='room'; S.lifestyle.food='basic'; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; spouse.npcMarried=false; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); const npc=World.npcs[spouse.npcId]; npc.employment.status='unemployed'; npc.employment.income=0;
    S.__worldWagePaid=1140; S.__worldWagePaidYear=World.year; HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid});
    return JSON.stringify({members:household.memberIds.includes(spouse.npcId),income:household.finances.income,expenses:household.finances.expenses,memberExpenses:household.finances.memberExpenses,balance:household.finances.lastBalance,personalAssetsRetained:household.finances.personalAssetsRetained,savings:household.finances.savings,debt:household.finances.debt,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.members,true);
  assert.equal(result.income,1140);
  assert.ok(result.memberExpenses>0);
  assert.equal(result.balance,result.income-result.expenses);
  assert.equal(result.personalAssetsRetained,Math.max(0,result.balance));
  assert.equal(result.savings,0);
  assert.equal(result.debt,0);
  assert.equal(result.violations.length,0);
});

test('subject and employed spouse incomes are each counted once',()=>{
  const context=newContext('household-employed-spouse');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.lifestyle.housing='room'; S.lifestyle.food='basic'; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; spouse.npcMarried=false; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); const npc=World.npcs[spouse.npcId]; npc.employment.status='employed'; npc.employment.income=500;
    S.__worldWagePaid=1140; S.__worldWagePaidYear=World.year; HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid});
    return JSON.stringify({income:household.finances.income,otherMemberIncome:household.finances.otherMemberIncome,subjectExpenses:household.finances.subjectExpenses,savingsChange:household.finances.sharedSavingsChange,personalAssetsRetained:household.finances.personalAssetsRetained,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.income,1640);
  assert.equal(result.otherMemberIncome,500);
  assert.ok(result.savingsChange>0);
  assert.equal(result.personalAssetsRetained,1140-result.subjectExpenses);
  assert.equal(result.violations.length,0);
});

test('changing housing and food updates subject household costs at local indices',()=>{
  const context=newContext('household-lifestyle-update');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.lifestyle.housing='room'; S.lifestyle.food='basic'; NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); S.__worldWagePaid=2000; S.__worldWagePaidYear=World.year; HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid}); const before=household.finances.expenseBreakdown;
    World.settlements[household.settlementId].economy.rentIndex=1.4; World.settlements[household.settlementId].economy.foodPriceIndex=1.3; S.lifestyle.housing='flat'; S.lifestyle.food='fine'; HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid}); const after=household.finances.expenseBreakdown;
    return JSON.stringify({before,after,expenses:household.finances.expenses,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.ok(result.after.rent>result.before.rent);
  assert.ok(result.after.food>result.before.food);
  assert.equal(result.expenses,result.after.rent+result.after.food+result.after.childcare+result.after.medical+result.after.debt+result.after.memberIncrement);
  assert.equal(result.violations.length,0);
});

test('household finance fields survive save and reload without changing',()=>{
  const context=newContext('household-save-reload');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.lifestyle.housing='room'; S.lifestyle.food='basic'; NpcSystem.syncLegacy(World,S,Lineage); const household=HouseholdSystem.findByMember(World,S.npcId); S.__worldWagePaid=1200; S.__worldWagePaidYear=World.year; HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid}); const saved=JSON.parse(JSON.stringify(household.finances)); World.households=JSON.parse(JSON.stringify(World.households)); HouseholdSystem.reconcile(World,S); const reloaded=HouseholdSystem.findByMember(World,S.npcId); return JSON.stringify({same:JSON.stringify(saved)===JSON.stringify(reloaded.finances),violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.same,true);
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
    S.__worldWagePaid=2000; S.__worldWagePaidYear=World.year; HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:S.__worldWagePaid});
    const runtime=World.settlements.veskar;
    return JSON.stringify({scheduled:scheduled.ok,legacy:S.location.settlementId,world:World.activeSettlementId,beforeMigration,afterHousehold:after&&after.settlementId,afterSubject:World.npcs[S.npcId]&&World.npcs[S.npcId].locationId,afterPartner:World.npcs[partner.npcId]&&World.npcs[partner.npcId].locationId,afterChild:World.npcs[child.npcId]&&World.npcs[child.npcId].locationId,rent:after.finances.expenseBreakdown.rent,food:after.finances.expenseBreakdown.food,expectedRent:Math.round(HOUSING.find(h=>h.id===S.lifestyle.housing).rent*runtime.economy.rentIndex),expectedFood:Math.round(FOOD.find(f=>f.id===S.lifestyle.food).cost*runtime.economy.foodPriceIndex),violations:NpcSystem.checkInvariants(World,S,Lineage)});
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
  assert.equal(result.rent,result.expectedRent);
  assert.equal(result.food,result.expectedFood);
  assert.equal(result.violations.length,0);
});
