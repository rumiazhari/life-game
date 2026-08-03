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
