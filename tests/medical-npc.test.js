'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function newContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function run(context,code){
  return JSON.parse(expose(context,`(function(){${code}})()`));
}

test('alive non-subject NPC is medically ticked (tickPerson called, effects applied)',()=>{
  const context=newContext('npc-tick-1');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    npc.health.medical.lastTickYear=null;
    const before=JSON.stringify(npc.health.medical);
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    return JSON.stringify({lastTickYear:World.npcs[npc.id].health.medical.lastTickYear,year:World.year,changed:JSON.stringify(World.npcs[npc.id].health.medical)!==before});
  `);
  assert.equal(result.lastTickYear,result.year);
});

test('subject-mirror NPC (isSubject:true) is excluded from medical tick and mortality roll',()=>{
  const context=newContext('npc-tick-2');
  const result=run(context,`
    const subjectNpc=World.npcs[S.npcId];
    MedicalSystem.addCondition(subjectNpc,'injury',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    subjectNpc.health.medical.conditions[0].yearsActive=20;
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    return JSON.stringify({lastTickYearUnchanged:World.npcs[S.npcId].health.medical.lastTickYear===null,alive:World.npcs[S.npcId].alive});
  `);
  assert.equal(result.lastTickYearUnchanged,true);
  assert.equal(result.alive,true);
});

test('health burden from tickPerson applies exactly once per year',()=>{
  const context=newContext('npc-tick-3');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    MedicalSystem.addCondition(npc,'strain',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const healthAfterOnce=World.npcs[npc.id].health.general;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const healthAfterTwice=World.npcs[npc.id].health.general;
    return JSON.stringify({healthAfterOnce,healthAfterTwice,same:healthAfterOnce===healthAfterTwice});
  `);
  assert.equal(result.same,true);
});

test('repeated same-year NPC annual tick does not double-apply medical effects (idempotency)',()=>{
  const context=newContext('npc-tick-4');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    MedicalSystem.addCondition(npc,'strain',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const snapshot=JSON.stringify(World.npcs[npc.id].health);
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    return JSON.stringify({unchanged:JSON.stringify(World.npcs[npc.id].health)===snapshot});
  `);
  assert.equal(result.unchanged,true);
});

test('existing baseline health drift still occurs alongside the new medical step',()=>{
  const context=newContext('npc-tick-5');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    const before=npc.health.lastChangeYear;
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    return JSON.stringify({lastChangeYear:World.npcs[npc.id].health.lastChangeYear,year:World.year,before});
  `);
  assert.equal(result.lastChangeYear,result.year);
});

test('NPC medical mortality with a condition-aware cause kills via the existing death pathway',()=>{
  const context=newContext('npc-tick-6');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    MedicalSystem.addCondition(npc,'injury',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    npc.health.medical.conditions[0].yearsActive=40;
    let died=false,cause=null,noticeCause=null;
    for(let i=0;i<80&&!died;i++){
      World.year++; S.age++;
      NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
      const notices=NpcSystem.drainNotices(World);
      const hit=notices.find(n=>n.type==='death'&&n.npcId===npc.id);
      if(hit){ died=true; noticeCause=hit.cause; cause=World.npcs[npc.id].deathCause; }
    }
    return JSON.stringify({died,cause,noticeCause});
  `);
  assert.equal(result.died,true);
  assert.equal(result.cause,'complications from an untreated injury');
  assert.equal(result.noticeCause,'complications from an untreated injury');
});

test('when medical mortality does not kill, the existing generic mortality roll still runs',()=>{
  const context=newContext('npc-tick-7');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    npc.health.general=1;
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const after=World.npcs[npc.id];
    return JSON.stringify({stillExists:!!after,generic:true});
  `);
  assert.equal(result.stillExists,true);
});

test('when medical mortality DOES kill, the existing generic mortality roll is skipped that year',()=>{
  const context=newContext('npc-tick-8');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    MedicalSystem.addCondition(npc,'injury',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    npc.health.medical.conditions[0].yearsActive=40;
    const originalRoll=MedicalSystem.rollMortality;
    MedicalSystem.rollMortality=function(w,person,ctx,opts){
      if(person===npc) return {died:true,roll:0,risk:1,cause:'complications from an untreated injury',conditionInstanceId:null,definitionId:'injury'};
      return originalRoll.apply(this,arguments);
    };
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    MedicalSystem.rollMortality=originalRoll;
    const notices=NpcSystem.drainNotices(World);
    const deathNoticesForNpc=notices.filter(n=>n.type==='death'&&n.npcId===npc.id);
    return JSON.stringify({deathNoticeCount:deathNoticesForNpc.length,cause:deathNoticesForNpc[0]&&deathNoticesForNpc[0].cause,alive:World.npcs[npc.id].alive});
  `);
  assert.equal(result.deathNoticeCount,1);
  assert.equal(result.cause,'complications from an untreated injury');
  assert.equal(result.alive,false);
});

test('medical progression does not consume NpcSystem own annual RNG stream',()=>{
  const context=newContext('npc-tick-9');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    MedicalSystem.addCondition(npc,'strain',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    World.year++; S.age++;
    const expected=NpcSystem.stream(World,World.year,npc.id,'annual').next();
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const after=NpcSystem.stream(World,World.year,npc.id,'annual').next();
    return JSON.stringify({expected,after,equal:expected===after});
  `);
  assert.equal(result.equal,true);
});

test('medical progression does not consume global Random',()=>{
  const context=newContext('npc-tick-10');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    MedicalSystem.addCondition(npc,'strain',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    Random.setSeed('personal-guard');
    const first=Random.next();
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const after=Random.next();
    Random.setSeed('personal-guard'); Random.next();
    const expected=Random.next();
    return JSON.stringify({after,expected});
  `);
  assert.equal(result.after,result.expected);
});

test('MedicalSystem.actionCounter unchanged after NPC annual medical processing',()=>{
  const context=newContext('npc-tick-11');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    MedicalSystem.addCondition(npc,'strain',5,{world:World,year:World.year,known:true,state:'diagnosed'});
    const counterBefore=npc.health.medical.actionCounter;
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    return JSON.stringify({counterBefore,counterAfter:World.npcs[npc.id].health.medical.actionCounter});
  `);
  assert.equal(result.counterBefore,result.counterAfter);
});

test('NPC iteration/insertion order does not change medical outcomes',()=>{
  const a=newContext('npc-order-seed');
  const b=newContext('npc-order-seed');
  run(a,`const friend=makeContact(S.sex==='M'?'F':'M'); S.contacts.push(friend); NpcSystem.syncLegacy(World,S,Lineage); return JSON.stringify({});`);
  run(b,`const friend=makeContact(S.sex==='M'?'F':'M'); S.contacts.push(friend); NpcSystem.syncLegacy(World,S,Lineage); return JSON.stringify({});`);
  const resultA=run(a,`World.year++; S.age++; NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage}); return JSON.stringify({npcs:World.npcs});`);
  const resultB=run(b,`World.year++; S.age++; NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage}); return JSON.stringify({npcs:World.npcs});`);
  assert.deepEqual(resultA,resultB);
});

test('unknown/unrecognized condition definitions on an NPC progress safely without crashing',()=>{
  const context=newContext('npc-unknown');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    npc.health.medical.conditions.push({id:'retired-diagnosis',definitionId:'retired-diagnosis',severity:4,state:'diagnosed',known:true,source:'old save'});
    MedicalSystem.migrate(npc,{world:World,year:World.year});
    World.year++; S.age++;
    let threw=false;
    try{ NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage}); }catch(e){ threw=true; }
    return JSON.stringify({threw});
  `);
  assert.equal(result.threw,false);
});

test('relevant NPC (parent of subject) developing a new condition creates a medical_condition notice with exact text',()=>{
  const context=newContext('npc-notice-1');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    npc.health.medical.exposure.currentRisk=0;
    for(let i=0;i<40;i++){
      World.year++; S.age++;
      NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
      const notices=NpcSystem.drainNotices(World);
      const hit=notices.find(n=>n.type==='medical_condition'&&n.npcId===npc.id);
      if(hit) return JSON.stringify({found:true,text:hit.text,name:NpcSystem.fullName(npc)});
      if(World.npcs[npc.id].alive===false) return JSON.stringify({found:false,died:true});
    }
    return JSON.stringify({found:false});
  `);
  assert.equal(result.found,true);
  assert.ok(/ developed .+\.$/.test(result.text));
  assert.equal(result.text,result.name+' developed '+result.text.split(' developed ')[1]);
});

test('relevant NPC condition reaching symptomatic creates a medical_symptom notice with exact text',()=>{
  const context=newContext('npc-notice-2');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    const cond=MedicalSystem.addCondition(npc,'infection',3,{world:World,year:World.year,state:'latent',incubation:1});
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const notices=NpcSystem.drainNotices(World);
    const hit=notices.find(n=>n.type==='medical_symptom'&&n.npcId===npc.id);
    return JSON.stringify({found:!!hit,text:hit&&hit.text,expected:NpcSystem.fullName(npc)+' began showing symptoms of acute infection.'});
  `);
  assert.equal(result.found,true);
  assert.equal(result.text,result.expected);
});

test('relevant NPC condition becoming chronic creates a medical_chronic notice with exact text',()=>{
  const context=newContext('npc-notice-3');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true,state:'diagnosed'});
    npc.health.medical.conditions[0].yearsActive=3;
    let found=false,text=null;
    for(let i=0;i<60;i++){
      World.year++; S.age++;
      NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
      const notices=NpcSystem.drainNotices(World);
      const hit=notices.find(n=>n.type==='medical_chronic'&&n.npcId===npc.id);
      if(hit){ found=true; text=hit.text; break; }
      if(!World.npcs[npc.id].alive) break;
    }
    return JSON.stringify({found,text,expected:NpcSystem.fullName(npc)+' now has a chronic condition on file.'});
  `);
  assert.equal(result.found,true);
  assert.equal(result.text,result.expected);
});

test('relevant NPC condition recovering creates a medical_recovery notice with exact text',()=>{
  const context=newContext('npc-notice-4');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    const cond=MedicalSystem.addCondition(npc,'injury',1,{world:World,year:World.year,known:true,state:'diagnosed'});
    cond.state='treated';cond.treated=true;cond.treatment='basic';cond.adherence=1;cond.lastTreatmentYear=World.year-1;
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const notices=NpcSystem.drainNotices(World);
    const hit=notices.find(n=>n.type==='medical_recovery'&&n.npcId===npc.id);
    return JSON.stringify({found:!!hit,text:hit&&hit.text,expected:NpcSystem.fullName(npc)+' recovered from lingering injury.'});
  `);
  assert.equal(result.found,true);
  assert.equal(result.text,result.expected);
});

test('irrelevant/unrelated generated NPC illness creates no player-facing notice',()=>{
  const context=newContext('npc-notice-5');
  const result=run(context,`
    const stranger=NpcSystem.upsert(World,{id:'npc:stranger-1',firstName:'Odd',lastName:'Stranger',sex:'M',birthYear:World.year-30,alive:true,locationId:World.activeSettlementId,roleTags:['unrelated'],source:'test'});
    const cond=MedicalSystem.addCondition(stranger,'injury',1,{world:World,year:World.year,known:true,state:'diagnosed'});
    stranger.health.medical.conditions[0].state='treated';stranger.health.medical.conditions[0].treated=true;stranger.health.medical.conditions[0].treatment='basic';stranger.health.medical.conditions[0].lastTreatmentYear=World.year-1;
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const notices=NpcSystem.drainNotices(World);
    const hit=notices.filter(n=>n.npcId==='npc:stranger-1'&&String(n.type).indexOf('medical_')===0);
    return JSON.stringify({count:hit.length});
  `);
  assert.equal(result.count,0);
});

test('duplicate notices (same NPC+condition instance+type+year) are suppressed',()=>{
  const context=newContext('npc-notice-6');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    const cond=MedicalSystem.addCondition(npc,'infection',3,{world:World,year:World.year,state:'latent',incubation:1});
    World.year++; S.age++;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const notices1=NpcSystem.drainNotices(World);
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage});
    const notices2=NpcSystem.drainNotices(World);
    const symptomFirst=notices1.filter(n=>n.type==='medical_symptom'&&n.npcId===npc.id).length;
    const symptomSecond=notices2.filter(n=>n.type==='medical_symptom'&&n.npcId===npc.id).length;
    return JSON.stringify({symptomFirst,symptomSecond});
  `);
  assert.equal(result.symptomFirst,1);
  assert.equal(result.symptomSecond,0);
});

test('NpcSystem.checkInvariants surfaces a MedicalSystem violation with the NPC id prefix',()=>{
  const context=newContext('npc-invariant-1');
  const result=run(context,`
    const npc=(World.npcs[S.mother.npcId]&&World.npcs[S.mother.npcId].alive!==false)?World.npcs[S.mother.npcId]:Object.values(World.npcs).find(n=>!n.isSubject&&n.alive!==false);
    npc.health.medical.conditions.push({id:'not-a-real-condition',definitionId:'not-a-real-condition',severity:2,state:'diagnosed',known:true,source:'test'});
    MedicalSystem.ensureMedicalState(npc,{world:World,year:World.year});
    const violations=NpcSystem.checkInvariants(World,S,Lineage);
    return JSON.stringify({violations,prefixed:violations.some(v=>v.indexOf('NPC '+npc.id+' medical:')===0)});
  `);
  assert.equal(result.prefixed,true);
});
