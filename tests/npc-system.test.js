'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function newContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function snapshot(context){
  return expose(context,`JSON.stringify({npcs:World.npcs,households:World.households,memories:World.relationshipMemories,subject:S.npcId})`);
}

test('the same seed creates the same persistent opening family',()=>{
  const first=newContext('same-family'), second=newContext('same-family');
  assert.equal(snapshot(first),snapshot(second));
});

test('NPC ids remain stable across repeated schema migration',()=>{
  const context=newContext('stable-ids');
  const result=JSON.parse(expose(context,`(function(){
    const before=Object.keys(World.npcs).sort(); NpcSystem.migrate(World,S,Lineage); const once=Object.keys(World.npcs).sort(); NpcSystem.migrate(World,S,Lineage); const twice=Object.keys(World.npcs).sort();
    return JSON.stringify({before,once,twice,violations:NpcSystem.checkInvariants(World,S,Lineage)});
  })()`));
  assert.deepEqual(result.before,result.once);
  assert.deepEqual(result.once,result.twice);
  assert.equal(result.violations.length,0);
});

test('partial legacy state is repaired without losing valid people',()=>{
  const context=newContext('legacy-repair');
  const result=JSON.parse(expose(context,`(function(){
    const parentId=S.mother.npcId; World.npcs[parentId].health.general=NaN; World.npcs[parentId].employment.income=Infinity;
    delete World.npcs[parentId].education; delete World.npcSchemaVersion;
    NpcSystem.migrate(World,S,Lineage);
    return JSON.stringify({parentId,exists:!!World.npcs[parentId],health:World.npcs[parentId].health.general,income:World.npcs[parentId].employment.income,education:World.npcs[parentId].education,violations:NpcSystem.checkInvariants(World,S,Lineage)});
  })()`));
  assert.equal(result.exists,true);
  assert.ok(Number.isFinite(result.health));
  assert.ok(Number.isFinite(result.income));
  assert.ok(result.education&&typeof result.education==='object');
  assert.equal(result.violations.length,0);
});

test('world NPC tick does not consume the personal RNG stream',()=>{
  const context=newContext('npc-rng');
  const result=JSON.parse(expose(context,`(function(){
    Random.setSeed('personal'); const first=Random.next(); S.age++; World.year++; WorldSimulation.tick(World,{year:World.year}); NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage}); const after=Random.next();
    Random.setSeed('personal'); Random.next(); const expected=Random.next(); return JSON.stringify({first,after,expected});
  })()`));
  assert.equal(result.after,result.expected);
});

test('legacy children and contacts receive persistent records',()=>{
  const context=newContext('legacy-roster');
  const result=JSON.parse(expose(context,`(function(){
    S.age=25; World.year=S.dob+S.age; S.livingAtHome=false;
    const child=bearChild(); const contact=makeContact(S.sex==='M'?'F':'M'); S.contacts.push(contact); NpcSystem.syncLegacy(World,S,Lineage);
    return JSON.stringify({childNpc:child.npcId,contactNpc:contact.npcId,childExists:!!World.npcs[child.npcId],contactExists:!!World.npcs[contact.npcId],violations:NpcSystem.checkInvariants(World,S,Lineage)});
  })()`));
  assert.ok(result.childNpc&&result.contactNpc);
  assert.equal(result.childExists,true);
  assert.equal(result.contactExists,true);
  assert.equal(result.violations.length,0);
});

test('deceased NPCs stop receiving normal employment',()=>{
  const context=newContext('npc-death');
  const result=JSON.parse(expose(context,`(function(){
    const npc=Object.values(World.npcs).find(n=>!n.isSubject); npc.alive=false; npc.deathYear=World.year; npc.deathCause='test'; npc.employment.status='deceased'; npc.employment.income=0;
    const before=JSON.stringify(npc); S.age++; World.year++; WorldSimulation.tick(World,{year:World.year}); NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    return JSON.stringify({before,after:JSON.stringify(npc),status:npc.employment.status,income:npc.employment.income,violations:NpcSystem.checkInvariants(World,S,Lineage)});
  })()`));
  assert.equal(result.before,result.after);
  assert.equal(result.status,'deceased');
  assert.equal(result.income,0);
  assert.equal(result.violations.length,0);
});

test('a 100-year persistent NPC simulation remains finite and bounded',()=>{
  const context=newContext('npc-century');
  const result=JSON.parse(expose(context,`(function(){
    S.age=20; World.year=S.dob+S.age; S.livingAtHome=false;
    for(let i=0;i<100;i++){ World.year++; S.age++; WorldSimulation.tick(World,{year:World.year}); NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage}); const check=Invariants.check(S,World); if(!check.ok) return JSON.stringify({ok:false,violations:check.violations}); }
    return JSON.stringify({ok:true,npcs:Object.keys(World.npcs).length,households:Object.keys(World.households).length,memories:Object.keys(World.relationshipMemories).length,violations:NpcSystem.checkInvariants(World,S,Lineage)});
  })()`));
  assert.equal(result.ok,true,result.violations&&result.violations.join('; '));
  assert.ok(result.npcs<=96);
  assert.equal(result.violations.length,0);
});
