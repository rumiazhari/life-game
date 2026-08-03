'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function newContext(seed,files=[]){
  const context=createWorldContext(files);
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function assertUnifiedAccounting(result){
  assert.equal(result.balance,result.subjectIncome+result.otherMemberIncome+result.otherSubjectCashFlow-result.subjectExpenses-result.memberExpenses);
  assert.equal(result.identity,result.balance);
  assert.equal(result.violations.length,0);
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
  assert.equal(result.personalAssets,900+result.finances.personalAssetChange);
  assert.equal(result.finances.lastBalance,result.income-result.expenses);
  assert.equal(result.finances.accountingIdentity,result.finances.lastBalance);
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
    return JSON.stringify({members:household.memberIds.includes(spouse.npcId),income:household.finances.income,expenses:household.finances.expenses,memberExpenses:household.finances.memberExpenses,balance:household.finances.lastBalance,personalAssetChange:household.finances.personalAssetChange,assets:S.assets,savings:household.finances.savings,debt:household.finances.debt,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.members,true);
  assert.equal(result.income,1140);
  assert.ok(result.memberExpenses>0);
  assert.equal(result.balance,result.income-result.expenses);
  assert.equal(result.personalAssetChange,result.assets-1000);
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
    return JSON.stringify({income:household.finances.income,otherMemberIncome:household.finances.otherMemberIncome,subjectExpenses:household.finances.subjectExpenses,savingsChange:household.finances.sharedSavingsChange,personalAssetChange:household.finances.personalAssetChange,accountingIdentity:household.finances.accountingIdentity,balance:household.finances.lastBalance,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.income,1640);
  assert.equal(result.otherMemberIncome,500);
  assert.ok(result.savingsChange>0);
  assert.equal(result.accountingIdentity,result.balance);
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

test('zero-income subject household funds a deficit explicitly',()=>{
  const context=newContext('household-zero-income-deficit');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=0; S.lifestyle.housing='room'; S.lifestyle.food='basic'; NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:0});
    return JSON.stringify({balance:household.finances.lastBalance,assets:S.assets,newDebt:household.finances.newHouseholdDebt,debt:household.finances.debt,identity:household.finances.accountingIdentity,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.ok(result.balance<0);
  assert.ok(result.newDebt>0);
  assert.equal(result.assets,0);
  assert.equal(result.identity,result.balance);
  assert.equal(result.violations.length,0);
});

test('existing household debt is repaid before shared savings are added',()=>{
  const context=newContext('household-debt-priority');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.lifestyle.housing='room'; S.lifestyle.food='basic'; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; spouse.npcMarried=false; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); const npc=World.npcs[spouse.npcId]; npc.employment.status='employed'; npc.employment.income=1000; household.finances.debt=100;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:1140});
    return JSON.stringify({repaid:household.finances.householdDebtRepaid,added:household.finances.sharedSavingsAdded,debt:household.finances.debt,savings:household.finances.savings,identity:household.finances.accountingIdentity,balance:household.finances.lastBalance,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.repaid,100);
  assert.ok(result.added>0);
  assert.equal(result.debt,0);
  assert.ok(result.savings>0);
  assert.equal(result.identity,result.balance);
  assert.equal(result.violations.length,0);
});

test('shared savings covers a subject lifestyle deficit before new household debt',()=>{
  const context=newContext('allocation-subject-savings');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=0; S.lifestyle.housing='room'; S.lifestyle.food='basic'; NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); household.finances.savings=10000; const before=household.finances.savings;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:0}); const f=household.finances;
    return JSON.stringify({before,savings:f.savings,savingsUsed:f.savingsUsed,newDebt:f.newHouseholdDebt,subjectIncome:f.subjectIncome,otherMemberIncome:f.otherMemberIncome,otherSubjectCashFlow:f.otherSubjectCashFlow,subjectExpenses:f.subjectExpenses,memberExpenses:f.memberExpenses,balance:f.lastBalance,identity:f.accountingIdentity,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.ok(result.savingsUsed>0);
  assert.ok(result.savings<result.before);
  assert.equal(result.newDebt,0);
  assertUnifiedAccounting(result);
});

test('spouse contribution covers zero-income subject and member costs before savings',()=>{
  const context=newContext('allocation-spouse-covers-all');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=0; S.lifestyle.housing='room'; S.lifestyle.food='basic'; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId), npc=World.npcs[spouse.npcId]; npc.employment.status='employed'; npc.employment.income=10000; npc.__householdContributionYear=World.year; npc.__householdContribution=10000;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:0}); const f=household.finances;
    return JSON.stringify({savings:f.savings,added:f.sharedSavingsAdded,newDebt:f.newHouseholdDebt,subjectIncome:f.subjectIncome,otherMemberIncome:f.otherMemberIncome,otherSubjectCashFlow:f.otherSubjectCashFlow,subjectExpenses:f.subjectExpenses,memberExpenses:f.memberExpenses,balance:f.lastBalance,identity:f.accountingIdentity,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.newDebt,0);
  assert.equal(result.added,result.otherMemberIncome-result.subjectExpenses-result.memberExpenses);
  assert.equal(result.savings,result.added);
  assertUnifiedAccounting(result);
});

test('positive total household balance never creates new debt',()=>{
  const context=newContext('allocation-positive-balance');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=5000; S.lifestyle.housing='room'; S.lifestyle.food='basic'; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId), npc=World.npcs[spouse.npcId]; npc.employment.status='employed'; npc.employment.income=2000; npc.__householdContributionYear=World.year; npc.__householdContribution=2000;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:2000}); const f=household.finances;
    return JSON.stringify({newDebt:f.newHouseholdDebt,subjectIncome:f.subjectIncome,otherMemberIncome:f.otherMemberIncome,otherSubjectCashFlow:f.otherSubjectCashFlow,subjectExpenses:f.subjectExpenses,memberExpenses:f.memberExpenses,balance:f.lastBalance,identity:f.accountingIdentity,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.ok(result.balance>0);
  assert.equal(result.newDebt,0);
  assertUnifiedAccounting(result);
});

test('shared savings covers combined subject and member deficit once',()=>{
  const context=newContext('allocation-combined-deficit');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=0; S.lifestyle.housing='room'; S.lifestyle.food='basic'; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId), npc=World.npcs[spouse.npcId]; npc.employment.status='unemployed'; npc.employment.income=0; household.finances.savings=10000; const before=household.finances.savings;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:0}); const f=household.finances;
    return JSON.stringify({before,savings:f.savings,savingsUsed:f.savingsUsed,newDebt:f.newHouseholdDebt,subjectIncome:f.subjectIncome,otherMemberIncome:f.otherMemberIncome,otherSubjectCashFlow:f.otherSubjectCashFlow,subjectExpenses:f.subjectExpenses,memberExpenses:f.memberExpenses,balance:f.lastBalance,identity:f.accountingIdentity,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.savingsUsed,result.subjectExpenses+result.memberExpenses);
  assert.equal(result.savings,result.before-result.savingsUsed);
  assert.equal(result.newDebt,0);
  assertUnifiedAccounting(result);
});

test('genuine surplus repays existing debt only after current expenses',()=>{
  const context=newContext('allocation-debt-then-savings');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=5000; S.lifestyle.housing='room'; S.lifestyle.food='basic'; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId), npc=World.npcs[spouse.npcId]; npc.employment.status='employed'; npc.employment.income=10000; npc.__householdContributionYear=World.year; npc.__householdContribution=10000; household.finances.debt=250;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:1000}); const f=household.finances;
    return JSON.stringify({repaid:f.householdDebtRepaid,added:f.sharedSavingsAdded,debt:f.debt,newDebt:f.newHouseholdDebt,subjectIncome:f.subjectIncome,otherMemberIncome:f.otherMemberIncome,otherSubjectCashFlow:f.otherSubjectCashFlow,subjectExpenses:f.subjectExpenses,memberExpenses:f.memberExpenses,balance:f.lastBalance,identity:f.accountingIdentity,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.newDebt,0);
  assert.equal(result.repaid,250);
  assert.equal(result.added,result.otherMemberIncome-result.memberExpenses-result.repaid);
  assert.equal(result.debt,0);
  assertUnifiedAccounting(result);
});

test('NPC-only household creates debt when contribution is below expenses',()=>{
  const context=newContext('household-npc-deficit');
  const result=JSON.parse(expose(context,`(function(){
    const npc=Object.values(World.npcs).find(n=>!n.isSubject&&n.alive); const old=HouseholdSystem.findByMember(World,npc.id); old.memberIds=old.memberIds.filter(id=>id!==npc.id); old.dependentIds=[];
    const household=HouseholdSystem.create(World,{settlementId:npc.locationId,memberIds:[npc.id],dependentIds:[],origin:'npc-deficit'}); npc.householdId=household.id; npc.employment.status='employed'; npc.employment.income=10;
    HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:0});
    const actual=HouseholdSystem.findByMember(World,npc.id); return JSON.stringify({expenses:actual.finances.expenses,income:actual.finances.income,newDebt:actual.finances.newHouseholdDebt,debt:actual.finances.debt,identity:actual.finances.accountingIdentity,balance:actual.finances.lastBalance,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.ok(result.income<result.expenses);
  assert.ok(result.newDebt>0);
  assert.equal(result.debt,result.newDebt);
  assert.equal(result.identity,result.balance);
  assert.equal(result.violations.length,0);
});

test('employed spouse salary is split between personal expenses and one household contribution',()=>{
  const context=newContext('household-spouse-contribution');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; spouse.npcMarried=false; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); const npc=World.npcs[spouse.npcId]; npc.employment.status='employed'; npc.employment.income=900; npc.health.general=100; const before=npc.wealth.cash-npc.wealth.debt;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,deferHousehold:true}); HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:1000}); const after=npc.wealth.cash-npc.wealth.debt; const runtime=World.settlements[npc.locationId].economy; const personalExpenses=Math.round(360*runtime.foodPriceIndex+210*runtime.rentIndex);
    return JSON.stringify({salary:npc.employment.income,wealthChange:after-before,contribution:household.finances.otherMemberIncome,personalExpenses,householdSavings:household.finances.sharedSavingsAdded,identity:household.finances.accountingIdentity,balance:household.finances.lastBalance,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.salary,result.wealthChange+result.contribution+result.personalExpenses);
  assert.ok(result.householdSavings>=0);
  assert.equal(result.identity,result.balance);
  assert.equal(result.violations.length,0);
});

test('low-income spouse keeps a negative personal wealth change outside the household balance',()=>{
  const context=newContext('household-low-income-spouse',['js/systems/persistent-people-ui.js']);
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; spouse.npcMarried=false; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId), npc=World.npcs[spouse.npcId]; npc.employment.status='employed'; npc.employment.income=10; npc.wealth.cash=0; npc.wealth.debt=0;
    const before=npc.wealth.cash-npc.wealth.debt; NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,deferHousehold:true}); HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:1000}); const after=npc.wealth.cash-npc.wealth.debt;
    const html=PersistentPeopleUI.householdPanel(World,S);
    return JSON.stringify({gross:household.finances.otherMemberGrossIncome,personalExpenses:household.finances.otherMemberPersonalExpenses,contribution:household.finances.otherMemberIncome,wealthChange:after-before,reported:household.finances.npcPersonalWealthChange,html,balance:household.finances.lastBalance,identity:household.finances.accountingIdentity,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.contribution,0);
  assert.ok(result.wealthChange<0);
  assert.equal(result.reported,result.wealthChange);
  assert.equal(result.gross-result.personalExpenses-result.contribution,result.wealthChange);
  assert.ok(result.html.includes('NPC personal wealth change -$'));
  assert.equal(result.balance,result.identity);
  assert.equal(result.violations.length,0);
});

test('member and healthcare costs are deducted from actual subject assets',()=>{
  const context=newContext('household-actual-member-costs');
  const result=JSON.parse(expose(context,`(function(){
    S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=5000; S.lifestyle.housing='room'; S.lifestyle.food='basic'; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; spouse.npcMarried=false; S.contacts.push(spouse); syncPartnerMirror(); NpcSystem.syncLegacy(World,S,Lineage);
    const household=HouseholdSystem.findByMember(World,S.npcId); const before=S.assets; HouseholdSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,subjectIncome:1140});
    return JSON.stringify({assetsBefore:before,assetsAfter:S.assets,personalChange:household.finances.personalAssetChange,memberExpenses:household.finances.memberExpenses,personalAssetsUsed:household.finances.personalAssetsUsed,identity:household.finances.accountingIdentity,balance:household.finances.lastBalance,violations:HouseholdSystem.checkInvariants(World,S)});
  })()`));
  assert.equal(result.assetsAfter-result.assetsBefore,result.personalChange);
  assert.equal(result.personalAssetsUsed,result.memberExpenses);
  assert.equal(result.identity,result.balance);
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
