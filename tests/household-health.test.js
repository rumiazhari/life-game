'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGameContext}=require('./helpers/vm-loader');
function ctx(){return createGameContext(['js/systems/condition-registry.js','js/systems/medical-system.js','js/systems/household-system.js','js/systems/household-health.js']);}

// --- 4B-3 fixtures -------------------------------------------------------
// Subject-like fixture: MedicalSystem treats a person as the subject when
// typeof person.health==='number' (see medical-system.js subjectLike()).
function makeSubject(id,overrides){return Object.assign({npcId:id,health:80,alive:true,dob:1900,age:30},overrides||{});}
// NPC-like fixture: health is an object with .general/.conditions.
function makeNpc(id,birthYear,overrides){return Object.assign({id,alive:true,birthYear:birthYear||1905,health:{general:80,conditions:[]}},overrides||{});}
function makeWorld(year,npcs,overrides){return Object.assign({year,seed:'seed-4b3',npcs:npcs||{},settlements:{}},overrides||{});}
function makeHousehold(id,memberIds,overrides){return Object.assign({id,memberIds,housing:{rooms:2},foodSecurity:0.6},overrides||{});}

function addCondition(c,person,definitionId,severity,state,world,year,extra){
  return c.MedicalSystem.addCondition(person,definitionId,severity,Object.assign({world,year,known:true,state},extra||{}));
}

function findTransmissionSuccess(c,build,maxYears){
  for(let year=1950;year<1950+(maxYears||300);year++){
    const {household,world,sourcePerson,targetPerson}=build(year);
    const result=c.HouseholdHealthSystem.transmit(world,household,{year,subject:world.__subject});
    if(result.transmissions.length)return {year,result,sourcePerson,targetPerson};
  }
  return null;
}

test('4B-3: contagious respiratory can transmit between household members',()=>{
  const c=ctx();
  const found=findTransmissionSuccess(c,year=>{
    const source=makeNpc('src',1905);
    const target=makeNpc('tgt',1905);
    addCondition(c,source,'respiratory',5,'symptomatic',{year},year);
    const household=makeHousehold('hh',['src','tgt'],{housing:{rooms:1},foodSecurity:0.2});
    const world=makeWorld(year,{src:source,tgt:target});
    return {household,world,sourcePerson:source,targetPerson:target};
  });
  assert.ok(found,'expected respiratory transmission to eventually succeed');
  assert.equal(found.result.transmissions[0].definitionId,'respiratory');
});

test('4B-3: noncontagious injury never transmits',()=>{
  const c=ctx();
  for(let year=1950;year<1950+150;year++){
    const source=makeNpc('src',1905);
    const target=makeNpc('tgt',1905);
    addCondition(c,source,'injury',5,'diagnosed',{year},year);
    const household=makeHousehold('hh',['src','tgt'],{housing:{rooms:1},foodSecurity:0.1});
    const world=makeWorld(year,{src:source,tgt:target});
    const result=c.HouseholdHealthSystem.transmit(world,household,{year});
    assert.equal(result.transmissions.length,0);
  }
});

test('4B-3: transmissionRisk - treated source has lower risk than symptomatic source',()=>{
  const c=ctx();
  const base={definitionId:'respiratory',severity:3,livingMembers:2,rooms:2,foodSecurity:0.6,sanitation:0.6,targetResilience:50,targetVaccination:0};
  const treated=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{state:'treated'}));
  const symptomatic=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{state:'symptomatic'}));
  assert.ok(treated<symptomatic,'treated risk '+treated+' should be less than symptomatic risk '+symptomatic);
});

test('4B-3: transmissionRisk - overcrowding (livingMembers>rooms) raises risk',()=>{
  const c=ctx();
  const base={definitionId:'respiratory',state:'symptomatic',severity:3,foodSecurity:0.6,sanitation:0.6,targetResilience:50,targetVaccination:0};
  const crowded=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{livingMembers:6,rooms:1}));
  const spacious=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{livingMembers:2,rooms:4}));
  assert.ok(crowded>spacious);
});

test('4B-3: transmissionRisk - poor food security raises risk',()=>{
  const c=ctx();
  const base={definitionId:'respiratory',state:'symptomatic',severity:3,livingMembers:2,rooms:2,sanitation:0.6,targetResilience:50,targetVaccination:0};
  const poor=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{foodSecurity:0.1}));
  const good=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{foodSecurity:0.9}));
  assert.ok(poor>good);
});

test('4B-3: transmissionRisk - poor sanitation raises risk',()=>{
  const c=ctx();
  const base={definitionId:'respiratory',state:'symptomatic',severity:3,livingMembers:2,rooms:2,foodSecurity:0.6,targetResilience:50,targetVaccination:0};
  const poor=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{sanitation:0.1}));
  const good=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{sanitation:0.9}));
  assert.ok(poor>good);
});

test('4B-3: transmissionRisk - low resilience raises risk and vaccination lowers risk',()=>{
  const c=ctx();
  const base={definitionId:'respiratory',state:'symptomatic',severity:3,livingMembers:2,rooms:2,foodSecurity:0.6,sanitation:0.6};
  const lowResilience=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{targetResilience:10,targetVaccination:0}));
  const highResilience=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{targetResilience:90,targetVaccination:0}));
  assert.ok(lowResilience>highResilience);
  const unvaccinated=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{targetResilience:50,targetVaccination:0}));
  const vaccinated=c.HouseholdHealthSystem.transmissionRisk(Object.assign({},base,{targetResilience:50,targetVaccination:1}));
  assert.ok(vaccinated<unvaccinated);
});

test('4B-3: transmission outcome is deterministic for a fixed seed/context',()=>{
  function run(){
    const c=ctx();
    const source=makeNpc('src',1905);
    const target=makeNpc('tgt',1905);
    addCondition(c,source,'infection',4,'symptomatic',{year:2000},2000);
    const household=makeHousehold('hh',['src','tgt'],{housing:{rooms:1},foodSecurity:0.2});
    const world=makeWorld(2000,{src:source,tgt:target});
    return c.HouseholdHealthSystem.transmit(world,household,{year:2000});
  }
  const a=run(),b=run();
  assert.equal(JSON.stringify(a),JSON.stringify(b));
});

test('4B-3: household-member array insertion order does not change transmission results',()=>{
  function run(order){
    const c=ctx();
    const npcs={};
    const persons={};
    order.forEach(id=>{
      const npc=makeNpc(id,1905);
      npcs[id]=npc;persons[id]=npc;
    });
    addCondition(c,persons.a,'respiratory',5,'symptomatic',{year:2010},2010);
    addCondition(c,persons.b,'infection',4,'symptomatic',{year:2010},2010);
    const household=makeHousehold('hh',order,{housing:{rooms:1},foodSecurity:0.1});
    const world=makeWorld(2010,npcs);
    return c.HouseholdHealthSystem.transmit(world,household,{year:2010});
  }
  const forward=run(['a','b','c']);
  const reversed=run(['c','b','a']);
  const sortedForward=JSON.stringify(forward.transmissions.slice().sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y))));
  const sortedReversed=JSON.stringify(reversed.transmissions.slice().sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y))));
  assert.equal(sortedForward,sortedReversed);
});

test('4B-3: a target with an already-active condition of the same definition cannot get a duplicate',()=>{
  const c=ctx();
  for(let year=1950;year<1950+150;year++){
    const source=makeNpc('src',1905);
    const target=makeNpc('tgt',1905);
    addCondition(c,source,'respiratory',5,'symptomatic',{year},year);
    addCondition(c,target,'respiratory',1,'symptomatic',{year},year);
    const household=makeHousehold('hh',['src','tgt'],{housing:{rooms:1},foodSecurity:0.1});
    const world=makeWorld(year,{src:source,tgt:target});
    const result=c.HouseholdHealthSystem.transmit(world,household,{year});
    assert.equal(result.transmissions.length,0);
    assert.equal(c.MedicalSystem.activeConditions(target).filter(x=>x.definitionId==='respiratory').length,1);
  }
});

test('4B-3: a newly transmitted condition does not progress in the same year it was created',()=>{
  const c=ctx();
  const found=findTransmissionSuccess(c,year=>{
    const source=makeNpc('src',1905);
    const target=makeNpc('tgt',1905);
    addCondition(c,source,'infection',5,'symptomatic',{year},year);
    const household=makeHousehold('hh',['src','tgt'],{housing:{rooms:1},foodSecurity:0.1});
    const world=makeWorld(year,{src:source,tgt:target});
    return {household,world,sourcePerson:source,targetPerson:target};
  });
  assert.ok(found);
  const condition=c.MedicalSystem.activeConditions(found.targetPerson)[0];
  assert.equal(condition.lastProgressionYear,found.year);
});

test('4B-3: subject can transmit to an NPC',()=>{
  const c=ctx();
  let found=null;
  for(let year=1950;year<1950+300&&!found;year++){
    const subject=makeSubject('subject1');
    addCondition(c,subject,'respiratory',5,'symptomatic',{year},year);
    const target=makeNpc('tgt',1905);
    const household=makeHousehold('hh',['subject1','tgt'],{housing:{rooms:1},foodSecurity:0.1});
    const world=makeWorld(year,{tgt:target});
    const result=c.HouseholdHealthSystem.transmit(world,household,{year,subject});
    if(result.transmissions.length)found={year,result};
  }
  assert.ok(found,'expected subject-to-NPC transmission to succeed');
  assert.equal(found.result.transmissions[0].sourceId,'subject1');
  assert.equal(found.result.transmissions[0].targetId,'tgt');
});

test('4B-3: an NPC can transmit to the subject',()=>{
  const c=ctx();
  let found=null;
  for(let year=1950;year<1950+300&&!found;year++){
    const subject=makeSubject('subject1');
    const source=makeNpc('src',1905);
    addCondition(c,source,'respiratory',5,'symptomatic',{year},year);
    const household=makeHousehold('hh',['subject1','src'],{housing:{rooms:1},foodSecurity:0.1});
    const world=makeWorld(year,{src:source});
    const result=c.HouseholdHealthSystem.transmit(world,household,{year,subject});
    if(result.transmissions.length)found={year,result};
  }
  assert.ok(found,'expected NPC-to-subject transmission to succeed');
  assert.equal(found.result.transmissions[0].sourceId,'src');
  assert.equal(found.result.transmissions[0].targetId,'subject1');
});

test('4B-3: repeated same-year transmission call is inert (no second exposure attempt)',()=>{
  const c=ctx();
  let found=null;
  for(let year=1950;year<1950+300&&!found;year++){
    const source=makeNpc('src',1905);
    const target=makeNpc('tgt',1905);
    addCondition(c,source,'respiratory',5,'symptomatic',{year},year);
    const household=makeHousehold('hh',['src','tgt'],{housing:{rooms:1},foodSecurity:0.1});
    const world=makeWorld(year,{src:source,tgt:target});
    const first=c.HouseholdHealthSystem.transmit(world,household,{year});
    if(first.transmissions.length){
      const before=JSON.stringify(target.health.medical);
      const second=c.HouseholdHealthSystem.transmit(world,household,{year});
      found={first,second,unchanged:JSON.stringify(target.health.medical)===before};
    }
  }
  assert.ok(found);
  assert.equal(found.second.applied,false);
  assert.equal(found.second.reason,'already-applied');
  assert.equal(found.unchanged,true);
});

// --- Caregiving unit tests -----------------------------------------------

test('4B-3: severity-5 illness requires 3 care hours',()=>{
  const c=ctx();
  assert.equal(c.HouseholdHealthSystem.conditionCareNeed({severity:5,state:'diagnosed'},30),3);
});
test('4B-3: severity-4 illness requires 2 care hours',()=>{
  const c=ctx();
  assert.equal(c.HouseholdHealthSystem.conditionCareNeed({severity:4,state:'diagnosed'},30),2);
});
test('4B-3: severity-3 in a child under 12 requires 1 care hour',()=>{
  const c=ctx();
  assert.equal(c.HouseholdHealthSystem.conditionCareNeed({severity:3,state:'diagnosed'},8),1);
});
test('4B-3: severity-3 in an elder 70+ requires 1 care hour',()=>{
  const c=ctx();
  assert.equal(c.HouseholdHealthSystem.conditionCareNeed({severity:3,state:'diagnosed'},75),1);
});
test('4B-3: severity-3 in a working-age adult requires 0 care hours',()=>{
  const c=ctx();
  assert.equal(c.HouseholdHealthSystem.conditionCareNeed({severity:3,state:'diagnosed'},35),0);
});
test('4B-3: a treated condition\'s need is reduced by 1 (floor 0)',()=>{
  const c=ctx();
  assert.equal(c.HouseholdHealthSystem.conditionCareNeed({severity:5,state:'treated'},30),2);
  assert.equal(c.HouseholdHealthSystem.conditionCareNeed({severity:3,state:'treated'},8),0);
});

test('4B-3: other healthy adults provide automatic capacity',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const caregiver=makeNpc('caregiver',1905);
  const patient=makeNpc('patient',1920);
  addCondition(c,patient,'injury',5,'diagnosed',{year:1950},1950);
  const household=makeHousehold('hh',['subject1','caregiver','patient']);
  const world=makeWorld(1950,{caregiver,patient});
  const result=c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:0});
  assert.equal(result.required,3);
  assert.equal(result.provided,1);
});

test('4B-3: total required care is capped at 6',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const p1=makeNpc('p1',1920),p2=makeNpc('p2',1920),p3=makeNpc('p3',1920);
  [p1,p2,p3].forEach(p=>addCondition(c,p,'infection',5,'diagnosed',{year:1950},1950));
  const household=makeHousehold('hh',['subject1','p1','p2','p3']);
  const world=makeWorld(1950,{p1,p2,p3});
  const result=c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:0});
  assert.equal(result.required,6);
});

test('4B-3: automatic capacity is capped at 3',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const caregivers=['g1','g2','g3','g4','g5'].map(id=>makeNpc(id,1905));
  const patient=makeNpc('patient',1920);
  addCondition(c,patient,'injury',5,'diagnosed',{year:1950},1950);
  const npcs={};caregivers.forEach(g=>npcs[g.id]=g);npcs.patient=patient;
  const household=makeHousehold('hh',['subject1',...caregivers.map(g=>g.id),'patient']);
  const world=makeWorld(1950,npcs);
  const result=c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:0});
  assert.equal(result.provided,3);
});

test('4B-3: subject caregiving is capped at 3',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const patient=makeNpc('patient',1920);
  addCondition(c,patient,'injury',5,'diagnosed',{year:1950},1950);
  const household=makeHousehold('hh',['subject1','patient']);
  const world=makeWorld(1950,{patient});
  const result=c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:99});
  assert.equal(result.provided,3);
});

test('4B-3: allocation priority order is deterministic (severity, child, elder, onset, id)',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const caregiver=makeNpc('caregiver',1905);
  const mild=makeNpc('mild',1920);
  const severe=makeNpc('severe',1920);
  addCondition(c,mild,'infection',5,'diagnosed',{year:1950},1949);
  addCondition(c,severe,'infection',5,'diagnosed',{year:1950},1950);
  const household=makeHousehold('hh',['subject1','caregiver','mild','severe']);
  const world=makeWorld(1950,{caregiver,mild,severe});
  const result=c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:0});
  assert.equal(result.provided,1);
  const mildCond=c.MedicalSystem.activeConditions(mild)[0];
  const severeCond=c.MedicalSystem.activeConditions(severe)[0];
  assert.ok(mildCond.adherence>0,'the earlier-onset patient (mild) should be prioritized and receive the single hour');
  assert.equal(severeCond.adherence,0);
});

test('4B-3: adherence improvement from care is capped at 1',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const caregiver1=makeNpc('g1',1905),caregiver2=makeNpc('g2',1905),caregiver3=makeNpc('g3',1905);
  const patient=makeNpc('patient',1920);
  const cond=addCondition(c,patient,'injury',5,'diagnosed',{year:1950},1950);
  cond.adherence=0.95;
  const household=makeHousehold('hh',['subject1','g1','g2','g3','patient']);
  const world=makeWorld(1950,{g1:caregiver1,g2:caregiver2,g3:caregiver3,patient});
  c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:0});
  const after=c.MedicalSystem.activeConditions(patient)[0];
  assert.equal(after.adherence,1);
});

test('4B-3: untreated-patient health relief from care is capped at +2/patient-year',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const caregiver1=makeNpc('g1',1905),caregiver2=makeNpc('g2',1905),caregiver3=makeNpc('g3',1905);
  const patient=makeNpc('patient',1920);
  addCondition(c,patient,'injury',5,'diagnosed',{year:1950},1950);
  const household=makeHousehold('hh',['subject1','g1','g2','g3','patient']);
  const world=makeWorld(1950,{g1:caregiver1,g2:caregiver2,g3:caregiver3,patient});
  const before=patient.health.general;
  const result=c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:0});
  assert.equal(result.provided,3);
  assert.equal(patient.health.general,before+2);
});

test('4B-3: repeated same-year caregiving call is inert (no double-application)',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const caregiver=makeNpc('caregiver',1905);
  const patient=makeNpc('patient',1920);
  addCondition(c,patient,'injury',5,'diagnosed',{year:1950},1950);
  const household=makeHousehold('hh',['subject1','caregiver','patient']);
  const world=makeWorld(1950,{caregiver,patient});
  c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:0});
  const before=JSON.stringify(patient.health);
  const second=c.HouseholdHealthSystem.applyCaregiving(world,household,{year:1950,subject,subjectCareHours:0});
  assert.equal(second.applied,false);
  assert.equal(JSON.stringify(patient.health),before);
});

test('4B-3: summary() reflects transmissions and caregiving hours after tickHousehold',()=>{
  const c=ctx();
  const subject=makeSubject('subject1');
  const caregiver=makeNpc('caregiver',1905);
  const patient=makeNpc('patient',1920);
  addCondition(c,patient,'injury',5,'diagnosed',{year:1950},1950);
  const household=makeHousehold('hh',['subject1','caregiver','patient']);
  const world=makeWorld(1950,{caregiver,patient});
  c.HouseholdHealthSystem.tickHousehold(world,household,{year:1950,subject,subjectCareHours:0});
  const summary=c.HouseholdHealthSystem.summary(household);
  assert.equal(summary.caregivingHoursRequired,3);
  assert.equal(summary.caregivingHoursProvided,1);
});

test('ensure() creates the full default schema on a household with no medical field',()=>{
  const c=ctx(),h={id:'hh1'};
  const state=c.HouseholdHealthSystem.ensure(h);
  assert.equal(state.schemaVersion,1);
  assert.equal(state.lastPreparedYear,null);
  assert.equal(state.lastTickYear,null);
  assert.equal(state.lastTransmissionYear,null);
  assert.equal(state.caseCounter,0);
  assert.equal(JSON.stringify(state.cases),'[]');
  assert.equal(JSON.stringify(state.pendingCharges),'[]');
  assert.equal(JSON.stringify(state.settledChargeKeys),'[]');
  assert.equal(JSON.stringify(state.history),'[]');
  assert.equal(JSON.stringify(state.annual),JSON.stringify({year:null,activeCases:0,newConditions:0,transmissions:0,caregivingHoursRequired:0,caregivingHoursProvided:0,treatmentCosts:0,medicalDebtAdded:0}));
  assert.strictEqual(h.medical,state);
});

test('ensure() is idempotent',()=>{
  const c=ctx(),h={id:'hh2'};
  c.HouseholdHealthSystem.ensure(h);
  const first=JSON.stringify(h.medical);
  c.HouseholdHealthSystem.ensure(h);
  assert.equal(JSON.stringify(h.medical),first);
});

test('migrate() repairs a partially-populated household.medical missing annual object',()=>{
  const c=ctx(),h={id:'hh3',medical:{schemaVersion:1,cases:[],pendingCharges:[],settledChargeKeys:[],history:[]}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.ok(state.annual&&typeof state.annual==='object');
  assert.equal(state.annual.activeCases,0);
});

test('migrate() repairs household.medical with cases as undefined/wrong type',()=>{
  const c=ctx(),h={id:'hh4',medical:{cases:undefined}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.ok(Array.isArray(state.cases));
  const h2={id:'hh4b',medical:{cases:'not-an-array'}};
  const state2=c.HouseholdHealthSystem.migrate(h2);
  assert.ok(Array.isArray(state2.cases));
});

test('valid year zero is preserved',()=>{
  const c=ctx(),h={id:'hh5',medical:{lastTickYear:0,lastPreparedYear:0,lastTransmissionYear:0}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.strictEqual(state.lastTickYear,0);
  assert.strictEqual(state.lastPreparedYear,0);
  assert.strictEqual(state.lastTransmissionYear,0);
});

test('invalid/non-finite year values become null',()=>{
  const c=ctx(),h={id:'hh6',medical:{lastTickYear:Infinity,lastPreparedYear:NaN}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.strictEqual(state.lastTickYear,null);
  assert.strictEqual(state.lastPreparedYear,null);
});

test('unparseable string years become null',()=>{
  const c=ctx(),h={id:'hh7',medical:{lastTickYear:'not-a-year',lastTransmissionYear:''}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.strictEqual(state.lastTickYear,null);
  assert.strictEqual(state.lastTransmissionYear,null);
});

test('history is trimmed to newest 48 records',()=>{
  const c=ctx(),history=[];
  for(let i=0;i<60;i++)history.push({note:String(i)});
  const h={id:'hh8',medical:{history}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.equal(state.history.length,48);
  assert.equal(state.history[0].note,'12');
  assert.equal(state.history[47].note,'59');
});

test('settledChargeKeys is trimmed to newest 96 keys',()=>{
  const c=ctx(),keys=[];
  for(let i=0;i<120;i++)keys.push('key'+i);
  const h={id:'hh9',medical:{settledChargeKeys:keys}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.equal(state.settledChargeKeys.length,96);
  assert.equal(state.settledChargeKeys[0],'key24');
  assert.equal(state.settledChargeKeys[95],'key119');
});

test('duplicate active cases for same npcId+conditionInstanceId are deduplicated',()=>{
  const c=ctx(),h={id:'hh10',medical:{cases:[
    {caseId:'case-2',npcId:'npc1',conditionInstanceId:'inst1',status:'pending'},
    {caseId:'case-1',npcId:'npc1',conditionInstanceId:'inst1',status:'pending'}
  ]}};
  const state=c.HouseholdHealthSystem.migrate(h);
  const matching=state.cases.filter(x=>x.npcId==='npc1'&&x.conditionInstanceId==='inst1');
  assert.equal(matching.length,1);
  assert.equal(matching[0].caseId,'case-1');
});

test('unknown condition IDs in a case are retained, not dropped',()=>{
  const c=ctx(),h={id:'hh11',medical:{cases:[
    {caseId:'case-x',npcId:'npc1',conditionInstanceId:'inst1',conditionId:'mystery-illness',status:'pending'}
  ]}};
  const state=c.HouseholdHealthSystem.migrate(h);
  assert.equal(state.cases[0].conditionId,'mystery-illness');
});

test('old save with no household.medical field loads safely via ensure()',()=>{
  const c=ctx(),h={id:'hh12',members:['npc1','npc2']};
  const state=c.HouseholdHealthSystem.ensure(h);
  assert.equal(state.schemaVersion,1);
  assert.equal(JSON.stringify(state.cases),'[]');
});

test('tickHousehold applies once for a given year and sets lastTickYear',()=>{
  const c=ctx(),h={id:'hh13'},w={year:1950};
  const result=c.HouseholdHealthSystem.tickHousehold(w,h,{year:1950});
  assert.equal(result.applied,true);
  assert.equal(result.year,1950);
  assert.equal(h.medical.lastTickYear,1950);
  assert.equal(h.medical.annual.year,1950);
});

test('repeated same-year tickHousehold call is a safe no-op',()=>{
  const c=ctx(),h={id:'hh14'},w={year:1950};
  c.HouseholdHealthSystem.tickHousehold(w,h,{year:1950});
  const before=JSON.stringify(h.medical);
  const result=c.HouseholdHealthSystem.tickHousehold(w,h,{year:1950});
  assert.equal(result.applied,false);
  assert.equal(result.reason,'already-applied');
  assert.equal(JSON.stringify(h.medical),before);
});

test('next-year tickHousehold call progresses again',()=>{
  const c=ctx(),h={id:'hh15'},w={year:1950};
  c.HouseholdHealthSystem.tickHousehold(w,h,{year:1950});
  const result=c.HouseholdHealthSystem.tickHousehold(w,h,{year:1951});
  assert.equal(result.applied,true);
  assert.equal(h.medical.lastTickYear,1951);
});

test('summary() returns the correct derived values from annual without mutating household',()=>{
  const c=ctx(),h={id:'hh16',medical:{annual:{year:1950,activeCases:2,newConditions:1,transmissions:0,caregivingHoursRequired:3,caregivingHoursProvided:2,treatmentCosts:100,medicalDebtAdded:50}}};
  c.HouseholdHealthSystem.migrate(h);
  const before=JSON.stringify(h.medical);
  const summary=c.HouseholdHealthSystem.summary(h);
  assert.equal(summary.year,1950);
  assert.equal(summary.activeCases,2);
  assert.equal(summary.treatmentCosts,100);
  assert.equal(JSON.stringify(h.medical),before);
});

test('checkInvariants() reports no violations on a freshly-ensured household',()=>{
  const c=ctx(),h={id:'hh17'};
  c.HouseholdHealthSystem.ensure(h);
  assert.equal(JSON.stringify(c.HouseholdHealthSystem.checkInvariants(h)),'[]');
});

test('checkInvariants() detects a duplicate active case violation',()=>{
  const c=ctx(),h={id:'hh18'};
  c.HouseholdHealthSystem.ensure(h);
  h.medical.cases.push({caseId:'a',npcId:'npc1',conditionInstanceId:'inst1',householdId:'hh18',status:'pending',resolved:false});
  h.medical.cases.push({caseId:'b',npcId:'npc1',conditionInstanceId:'inst1',householdId:'hh18',status:'pending',resolved:false});
  const violations=c.HouseholdHealthSystem.checkInvariants(h);
  assert.ok(violations.some(v=>v.includes('duplicate active case')));
});

test('checkInvariants() detects an out-of-range year field',()=>{
  const c=ctx(),h={id:'hh19'};
  c.HouseholdHealthSystem.ensure(h);
  h.medical.lastTickYear=1950.5;
  const violations=c.HouseholdHealthSystem.checkInvariants(h);
  assert.ok(violations.some(v=>v.includes('lastTickYear')));
});

test('checkInvariants() detects lastTransmissionYear exceeding lastTickYear',()=>{
  const c=ctx(),h={id:'hh20'};
  c.HouseholdHealthSystem.ensure(h);
  h.medical.lastTickYear=1950;
  h.medical.lastTransmissionYear=1955;
  const violations=c.HouseholdHealthSystem.checkInvariants(h);
  assert.ok(violations.some(v=>v.includes('lastTransmissionYear cannot exceed lastTickYear')));
});
