'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

test('gameplay spouse death closes the persistent NPC and preserves household history',()=>{
  const context=createWorldContext();
  expose(context,`Random.setSeed('gameplay-spouse-death'); newWorld(); newLineage(); newHold(); newSubject();
    S.age=58; World.year=S.dob+S.age; S.livingAtHome=false; S.married=true; S.status='Married';
    const spouse=makeContact(S.sex==='M'?'F':'M'); spouse.role='spouse'; spouse.npcMarried=false; spouse.npcSpouseName=null; spouse.npcSpouseTemperament=null; S.contacts.push(spouse); syncPartnerMirror();
    NpcSystem.syncLegacy(World,S,Lineage);`);
  const result=JSON.parse(expose(context,`(function(){
    const spouse=activePartnerContact(), npc=World.npcs[spouse.npcId], subjectNpc=World.npcs[S.npcId], household=HouseholdSystem.findByMember(World,S.npcId), year=World.year;
    npc.employment.status='employed'; npc.employment.income=875;
    markSpouseDeath(S,'controlled gameplay spouse death');
    const afterHousehold=HouseholdSystem.findByMember(World,S.npcId);
    const spouseDeathNotices=()=>World.npcNotices.filter(notice=>notice&&notice.type==='death'&&notice.npcId===spouse.npcId);
    const beforeTick={alive:spouse.alive,npcAlive:npc.alive,deathYear:npc.deathYear,contactDeathYear:spouse.deathYear,status:npc.employment.status,income:npc.employment.income,subjectPartner:subjectNpc.partnerId,spousePartner:npc.partnerId,playerStatus:S.status,current:afterHousehold.memberIds.includes(spouse.npcId),historical:afterHousehold.historicalMemberIds.includes(spouse.npcId),spouseDeathNoticeCount:spouseDeathNotices().length};
    S.age++;World.year++;WorldSimulation.tick(World,{year:World.year});NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const afterOneYearSpouseNoticeCount=spouseDeathNotices().length;
    for(let i=1;i<4;i++){S.age++;World.year++;WorldSimulation.tick(World,{year:World.year});NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});}
    const laterHousehold=HouseholdSystem.findByMember(World,S.npcId);
    return JSON.stringify({beforeTick,afterOneYearSpouseNoticeCount,later:{alive:spouse.alive,npcAlive:npc.alive,status:npc.employment.status,income:npc.employment.income,subjectPartner:World.npcs[S.npcId].partnerId,spousePartner:npc.partnerId,playerStatus:S.status,current:laterHousehold.memberIds.includes(spouse.npcId),historical:laterHousehold.historicalMemberIds.includes(spouse.npcId)},violations:NpcSystem.checkInvariants(World,S,Lineage)});
  })()`));
  assert.equal(result.beforeTick.alive,false);
  assert.equal(result.beforeTick.npcAlive,false);
  assert.equal(result.beforeTick.deathYear,result.beforeTick.contactDeathYear);
  assert.equal(result.beforeTick.status,'deceased');
  assert.equal(result.beforeTick.income,0);
  assert.equal(result.beforeTick.subjectPartner,null);
  assert.equal(result.beforeTick.spousePartner,null);
  assert.equal(result.beforeTick.playerStatus,'Widowed');
  assert.equal(result.beforeTick.current,false);
  assert.equal(result.beforeTick.historical,true);
  assert.equal(result.beforeTick.spouseDeathNoticeCount,0);
  assert.equal(result.afterOneYearSpouseNoticeCount,0);
  assert.equal(result.later.npcAlive,false);
  assert.equal(result.later.status,'deceased');
  assert.equal(result.later.income,0);
  assert.equal(result.later.subjectPartner,null);
  assert.equal(result.later.spousePartner,null);
  assert.equal(result.later.playerStatus,'Widowed');
  assert.equal(result.later.current,false);
  assert.equal(result.later.historical,true);
  assert.equal(result.violations.length,0);
});
