'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function newContext(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}
function run(context,code){
  return JSON.parse(expose(context,`(function(){${code}})()`));
}

// Stub-DOM harness (matches tests/medical-progression.test.js and
// tests/household-economy-integration.test.js): loads the real js/ui.js
// (plus persistent-people-ui.js/medical.js/education.js, its dependencies)
// against a minimal fake `document`, and returns the {context,elements} map
// so a test can inspect rendered innerHTML or invoke a dynamically-assigned
// onclick handler directly.
function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,scrollTop:0,offsetWidth:100,offsetHeight:100,
    appendChild(){},remove(){},addEventListener(){},removeEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;},getBoundingClientRect(){return {width:100,height:100};},focus(){},click(){}
  });
  context.document={
    querySelector(selector){return elements[selector]||(elements[selector]=makeElement());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=makeElement());},
    createElement(){return makeElement();},
    addEventListener(){},
    body:makeElement(),
    documentElement:makeElement()
  };
  context.addEventListener=()=>{};
  context.setTimeout=()=>0;
  context.clearTimeout=()=>{};
  context.navigator=context.navigator||{};
  loadGameFiles(context,['js/systems/persistent-people-ui.js','js/medical.js','js/education.js','js/ui.js']);
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return {context,elements};
}
function configureAdult(context){
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.jobTier=5; S.jobName='Day Laborer'; S.career=null; S.eduStage=null; S.jailUntil=0; S.garnishUntil=0; S.liabilities=[]; S.kids=0; S.married=false; S.contacts=[];");
}
// A fake click target whose closest() answers based on its own dataset,
// matching the real DOM contract just enough to exercise a delegated
// [data-xxx] click handler without a real document.
function fakeTarget(dataset,id){
  return {
    id:id||'',
    dataset:dataset||{},
    closest(selector){
      const attrMatch=/\[data-([a-z-]+)/.exec(selector);
      if(!attrMatch) return null;
      const camel=attrMatch[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
      return (this.dataset&&this.dataset[camel]!=null)?this:null;
    }
  };
}

const CLINIC_CONTEXT_SETTLEMENT="'kostrin'";

// --- noticeText() surfaces pre-built notice text ---------------------------

test('noticeText: medical/household notice types return their pre-built text instead of the generic fallback',()=>{
  const context=newContext('notice-text-medical');
  const result=run(context,`
    const types=['medical_condition','medical_symptom','medical_chronic','medical_recovery','medical_transmission','medical_diagnosis','medical_treatment'];
    const results=types.map(type=>{
      const notice={type,npcId:'npc:x',name:'Test Person',conditionInstanceId:'condition:x:1900:0001',text:'CUSTOM TEXT FOR '+type};
      return {type,text:NpcSystem.noticeText(World,notice)};
    });
    return JSON.stringify(results);
  `);
  result.forEach(entry=>{
    assert.equal(entry.text,'CUSTOM TEXT FOR '+entry.type);
  });
});

test('noticeText: notice types without pre-built text still use their dedicated branch',()=>{
  const context=newContext('notice-text-legacy');
  const result=run(context,`
    const death=NpcSystem.noticeText(World,{type:'death',name:'Ada',cause:'a long illness'});
    const marriage=NpcSystem.noticeText(World,{type:'marriage',name:'Ada',otherName:'Ben'});
    const unknown=NpcSystem.noticeText(World,{type:'something-unhandled'});
    return JSON.stringify({death,marriage,unknown});
  `);
  assert.equal(result.death,'Ada died of a long illness.');
  assert.equal(result.marriage,'Ada and Ben formed a household.');
  assert.equal(result.unknown,'A connected life changed.');
});

// --- prepareAndResolveHouseholdCases: diagnosis/treatment notices ---------

test('prepareAndResolveHouseholdCases: emits a medical_diagnosis notice for a new case on a relevant NPC',()=>{
  const context=newContext('diagnosis-notice');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:kin1',firstName:'Kin',lastName:'One',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',2,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    const notices=NpcSystem.drainNotices(World);
    const diag=notices.find(n=>n.type==='medical_diagnosis'&&n.npcId==='npc:kin1');
    return JSON.stringify({found:!!diag,text:diag&&diag.text});
  `);
  assert.equal(result.found,true);
  assert.equal(result.text,'Kin One was diagnosed with respiratory complaint.');
});

test('prepareAndResolveHouseholdCases: emits an "Unrecognized condition" diagnosis notice for an unknown definitionId',()=>{
  const context=newContext('diagnosis-unrecognized');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:kin2',firstName:'Kin',lastName:'Two',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    npc.health.medical=npc.health.medical||{conditions:[]};
    MedicalSystem.ensureMedicalState(npc,{world:World,year:World.year});
    npc.health.medical.conditions.push({instanceId:'condition:kin2:'+World.year+':0099',definitionId:'made-up-illness',id:'made-up-illness',severity:2,state:'diagnosed',known:true,onsetAge:40,onsetYear:World.year,source:'test',exposureType:'unknown',contagious:false,treatment:null,adherence:0,yearsActive:0,years:0,incubationLeft:0,complications:[]});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    const notices=NpcSystem.drainNotices(World);
    const diag=notices.find(n=>n.type==='medical_diagnosis'&&n.npcId==='npc:kin2');
    return JSON.stringify({found:!!diag,text:diag&&diag.text});
  `);
  assert.equal(result.found,true);
  assert.equal(result.text,'Kin Two was diagnosed with unrecognized condition.');
});

test('prepareAndResolveHouseholdCases: emits medical_treatment when an autonomous (non-subject) household funds care',()=>{
  const context=newContext('treatment-notice-autonomous');
  const result=run(context,`
    const household=HouseholdSystem.create(World,{settlementId:${CLINIC_CONTEXT_SETTLEMENT},memberIds:[],dependentIds:[]});
    household.finances.savings=100000;
    const npc=NpcSystem.upsert(World,{id:'npc:auto1',firstName:'Auto',lastName:'One',sex:'M',birthYear:World.year-40,alive:true,locationId:${CLINIC_CONTEXT_SETTLEMENT},roleTags:['friend'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    S.contacts.push({npcId:'npc:auto1',cid:'c1',name:'Auto One',sex:'M',mood:60});
    MedicalSystem.addCondition(npc,'respiratory',4,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    const notices=NpcSystem.drainNotices(World);
    const t=notices.find(n=>n.type==='medical_treatment'&&n.npcId==='npc:auto1');
    return JSON.stringify({found:!!t,text:t&&t.text});
  `);
  assert.equal(result.found,true);
  assert.equal(result.text,'Auto One received treatment for respiratory complaint.');
});

test('prepareAndResolveHouseholdCases: does not notice an irrelevant NPC\'s diagnosis',()=>{
  const context=newContext('diagnosis-irrelevant');
  const result=run(context,`
    const household=HouseholdSystem.create(World,{settlementId:World.activeSettlementId,memberIds:[],dependentIds:[]});
    const npc=NpcSystem.upsert(World,{id:'npc:stranger1',firstName:'Stranger',lastName:'One',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:[],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',2,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    const notices=NpcSystem.drainNotices(World);
    return JSON.stringify({found:!!notices.find(n=>n.npcId==='npc:stranger1')});
  `);
  assert.equal(result.found,false);
});

test('prepareAndResolveHouseholdCases: does not notice the subject\'s own case (surfaced via the personal medical file instead)',()=>{
  const context=newContext('diagnosis-subject-excluded');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    MedicalSystem.addCondition(S,'respiratory',2,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    const notices=NpcSystem.drainNotices(World);
    return JSON.stringify({found:!!notices.find(n=>n.npcId===S.npcId)});
  `);
  assert.equal(result.found,false);
});

// --- resolveQueuedFamilyDecisions ------------------------------------------

test('resolveQueuedFamilyDecisions: resolves a queued decision and emits a medical_treatment notice',()=>{
  const context=newContext('queued-decision-resolve');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    household.settlementId=${CLINIC_CONTEXT_SETTLEMENT};
    household.finances.savings=100000;
    const npc=NpcSystem.upsert(World,{id:'npc:spouse1',firstName:'Spo',lastName:'Use',sex:'F',birthYear:World.year-30,alive:true,locationId:${CLINIC_CONTEXT_SETTLEMENT},roleTags:['spouse'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'infection',3,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    NpcSystem.drainNotices(World);
    const state=HouseholdHealthSystem.ensure(household);
    const caseRecord=state.cases.find(c=>c.npcId==='npc:spouse1');
    const results=NpcSystem.resolveQueuedFamilyDecisions(World,World.year,S,Lineage,[{npcId:caseRecord.npcId,conditionInstanceId:caseRecord.conditionInstanceId,decision:'fund-recommended-care',treatmentId:'basic'}]);
    const notices=NpcSystem.drainNotices(World);
    const t=notices.find(n=>n.type==='medical_treatment'&&n.npcId==='npc:spouse1');
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({applied:results[0].applied,reason:results[0].reason,noticeFound:!!t,conditionTreated:condition.state==='treated'});
  `);
  assert.equal(result.applied,true);
  assert.equal(result.reason,'funded-care');
  assert.equal(result.noticeFound,true);
  assert.equal(result.conditionTreated,true);
});

test('resolveQueuedFamilyDecisions: leave-untreated resolves without a medical_treatment notice',()=>{
  const context=newContext('queued-decision-untreated');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:kid1',firstName:'Kid',lastName:'One',sex:'M',birthYear:World.year-8,alive:true,locationId:World.activeSettlementId,roleTags:['child'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'injury',2,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    NpcSystem.drainNotices(World);
    const state=HouseholdHealthSystem.ensure(household);
    const caseRecord=state.cases.find(c=>c.npcId==='npc:kid1');
    const results=NpcSystem.resolveQueuedFamilyDecisions(World,World.year,S,Lineage,[{npcId:caseRecord.npcId,conditionInstanceId:caseRecord.conditionInstanceId,decision:'leave-untreated',treatmentId:null}]);
    const notices=NpcSystem.drainNotices(World);
    return JSON.stringify({applied:results[0].applied,reason:results[0].reason,noticeCount:notices.filter(n=>n.npcId==='npc:kid1').length});
  `);
  assert.equal(result.applied,true);
  assert.equal(result.reason,'untreated');
  assert.equal(result.noticeCount,0);
});

test('resolveQueuedFamilyDecisions: a stale queue entry (npc no longer exists) is skipped, not thrown',()=>{
  const context=newContext('queued-decision-stale');
  const result=run(context,`
    const results=NpcSystem.resolveQueuedFamilyDecisions(World,World.year,S,Lineage,[{npcId:'npc:not-real',conditionInstanceId:'condition:not-real:1900:0001',decision:'fund-recommended-care',treatmentId:'basic'}]);
    return JSON.stringify({applied:results[0].applied,reason:results[0].reason});
  `);
  assert.equal(result.applied,false);
  assert.equal(result.reason,'household-not-found');
});

test('resolveQueuedFamilyDecisions: household churn between queueing and resolution does not orphan the decision (regression)',()=>{
  const context=newContext('queued-decision-household-churn');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    household.settlementId=${CLINIC_CONTEXT_SETTLEMENT};
    household.finances.savings=100000;
    const npc=NpcSystem.upsert(World,{id:'npc:churn1',firstName:'Chu',lastName:'Rn',sex:'M',birthYear:World.year-40,alive:true,locationId:${CLINIC_CONTEXT_SETTLEMENT},roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    NpcSystem.drainNotices(World);
    const state=HouseholdHealthSystem.ensure(household);
    const caseRecord=state.cases.find(c=>c.npcId==='npc:churn1');
    const queueItem={npcId:caseRecord.npcId,conditionInstanceId:caseRecord.conditionInstanceId,decision:'fund-recommended-care',treatmentId:'basic'};
    // Simulate the household the case was queued against being torn down and
    // rebuilt under a new id before the queue is resolved -- e.g. the
    // subject moving out between planning and the next advanceYear -- by
    // moving the member (and their case, which travels with household.medical)
    // into a brand-new household with a different id.
    const newHousehold=HouseholdSystem.create(World,{settlementId:${CLINIC_CONTEXT_SETTLEMENT},memberIds:[],dependentIds:[]});
    newHousehold.finances.savings=100000;
    HouseholdSystem.addMember(World,newHousehold.id,'npc:churn1',false);
    newHousehold.medical=household.medical;
    household.medical=undefined;
    const results=NpcSystem.resolveQueuedFamilyDecisions(World,World.year,S,Lineage,[queueItem]);
    const condition=MedicalSystem.activeConditions(npc)[0];
    return JSON.stringify({applied:results[0].applied,reason:results[0].reason,resolvedHouseholdId:results[0].householdId,newHouseholdId:newHousehold.id,conditionTreated:condition.state==='treated'});
  `);
  assert.equal(result.applied,true);
  assert.equal(result.reason,'funded-care');
  assert.equal(result.resolvedHouseholdId,result.newHouseholdId);
  assert.equal(result.conditionTreated,true);
});

test('integration: a queued family decision resolves before that NPC\'s own annual medical progression this same year',()=>{
  const context=newContext('queued-before-progression');
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    household.settlementId=${CLINIC_CONTEXT_SETTLEMENT};
    household.finances.savings=100000;
    const npc=NpcSystem.upsert(World,{id:'npc:member1',firstName:'Mem',lastName:'Ber',sex:'M',birthYear:World.year-40,alive:true,locationId:${CLINIC_CONTEXT_SETTLEMENT},roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    NpcSystem.syncLegacy(World,S,Lineage);
    World.year++;
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    NpcSystem.drainNotices(World);
    const state=HouseholdHealthSystem.ensure(household);
    const caseRecord=state.cases.find(c=>c.npcId==='npc:member1');
    NpcSystem.resolveQueuedFamilyDecisions(World,World.year,S,Lineage,[{npcId:caseRecord.npcId,conditionInstanceId:caseRecord.conditionInstanceId,decision:'fund-recommended-care',treatmentId:'basic'}]);
    const conditionAfterDecision=MedicalSystem.activeConditions(npc)[0];
    const treatedBeforeProgression=conditionAfterDecision.state==='treated';
    const lastTreatmentYear=conditionAfterDecision.lastTreatmentYear;
    NpcSystem.tick(World,{year:World.year,subject:S,lineage:Lineage,deferHousehold:true});
    const conditionAfterProgression=MedicalSystem.activeConditions(npc).find(c=>c.instanceId===conditionAfterDecision.instanceId);
    return JSON.stringify({
      treatedBeforeProgression,lastTreatmentYear,resolvedYear:World.year,
      protectedFromUntreatedBurdenThisYear:conditionAfterProgression&&conditionAfterProgression.lastTreatmentYear===World.year
    });
  `);
  assert.equal(result.treatedBeforeProgression,true);
  assert.equal(result.lastTreatmentYear,result.resolvedYear);
  assert.equal(result.protectedFromUntreatedBurdenThisYear,true);
});

// --- Annual ordering (source-text) ------------------------------------------

test('annual ordering: the queued family decision resolves between prepareAndResolveHouseholdCases and NpcSystem.tick',()=>{
  const src=fs.readFileSync('js/ui.js','utf8');
  const fnStart=src.indexOf('function advanceYear(');
  const fnBody=src.slice(fnStart,src.indexOf('\nfunction advance(',fnStart));
  const prepareIndex=fnBody.indexOf('NpcSystem.prepareAndResolveHouseholdCases(');
  const resolveQueueIndex=fnBody.indexOf('NpcSystem.resolveQueuedFamilyDecisions(');
  const npcTickIndex=fnBody.indexOf('NpcSystem.tick(');
  assert.ok(prepareIndex>=0&&resolveQueueIndex>=0&&npcTickIndex>=0);
  assert.ok(prepareIndex<resolveQueueIndex,'household cases are prepared before the queued family decision resolves');
  assert.ok(resolveQueueIndex<npcTickIndex,'the queued family decision resolves before NPC medical progression');
});

// --- PersistentPeopleUI: condition display ----------------------------------

test('PersistentPeopleUI.conditionName: known ids resolve to their registry name, unknown ids fall back to "Unrecognized condition"',()=>{
  const context=newContext('condition-name-fallback');
  loadGameFiles(context,['js/systems/persistent-people-ui.js']);
  const result=run(context,`
    return JSON.stringify({known:PersistentPeopleUI.conditionName('respiratory'),unknown:PersistentPeopleUI.conditionName('made-up-illness')});
  `);
  assert.equal(result.known,'Respiratory complaint');
  assert.equal(result.unknown,'Unrecognized condition');
});

test('PersistentPeopleUI.memberCard: shows at most two active conditions, worst severity first, with a "+more" indicator',()=>{
  const context=newContext('member-card-conditions');
  loadGameFiles(context,['js/systems/persistent-people-ui.js']);
  const result=run(context,`
    const npc=NpcSystem.upsert(World,{id:'npc:many',firstName:'Many',lastName:'Conditions',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    MedicalSystem.addCondition(npc,'respiratory',2,{world:World,year:World.year,known:true});
    MedicalSystem.addCondition(npc,'strain',5,{world:World,year:World.year,known:true});
    MedicalSystem.addCondition(npc,'injury',3,{world:World,year:World.year,known:true});
    const html=PersistentPeopleUI.memberCard(npc,World,S.npcId);
    return JSON.stringify({
      hasStrainFirst:html.indexOf('Nervous strain')<html.indexOf('Lingering injury'),
      hasMore:html.includes('+1 more'),
      mentionsRespiratory:html.includes('Respiratory complaint')
    });
  `);
  assert.equal(result.hasStrainFirst,true,'the most severe condition (strain, severity 5) should be listed before a less severe one');
  assert.equal(result.hasMore,true);
  assert.equal(result.mentionsRespiratory,false,'only the top two conditions by severity should be named');
});

test('PersistentPeopleUI.memberCard: a deceased member shows no condition tags',()=>{
  const context=newContext('member-card-deceased');
  loadGameFiles(context,['js/systems/persistent-people-ui.js']);
  const result=run(context,`
    const npc=NpcSystem.upsert(World,{id:'npc:dead1',firstName:'Dead',lastName:'One',sex:'M',birthYear:World.year-40,alive:false,deathYear:World.year,deathCause:'a long illness',locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:0,conditions:[]}});
    const html=PersistentPeopleUI.memberCard(npc,World,S.npcId);
    return JSON.stringify({hasConditionsBlock:html.includes('persistent-person-conditions')});
  `);
  assert.equal(result.hasConditionsBlock,false);
});

// --- PersistentPeopleUI: FAMILY HEALTH panel content ------------------------

test('PersistentPeopleUI.householdHealthPanel: shows treatment costs, medical debt, and a pending-decision case row',()=>{
  const context=newContext('panel-pending');
  loadGameFiles(context,['js/systems/persistent-people-ui.js']);
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:panelmember',firstName:'Panel',lastName:'Member',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true,state:'symptomatic'});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    household.finances.treatmentCosts=140;
    household.finances.medicalDebtAdded=60;
    const html=PersistentPeopleUI.householdHealthPanel(World,S);
    return JSON.stringify({
      mentionsMember:html.includes('Panel Member'),
      mentionsCondition:html.includes('Respiratory complaint'),
      mentionsCost:html.includes('$140'),
      mentionsDebt:html.includes('$60'),
      mentionsDecide:html.includes('Decide')
    });
  `);
  assert.equal(result.mentionsMember,true);
  assert.equal(result.mentionsCondition,true);
  assert.equal(result.mentionsCost,true);
  assert.equal(result.mentionsDebt,true);
  assert.equal(result.mentionsDecide,true);
});

test('PersistentPeopleUI.householdHealthPanel: a queued (not-yet-resolved) decision shows as queued, not pending',()=>{
  const context=newContext('panel-queued');
  loadGameFiles(context,['js/systems/persistent-people-ui.js']);
  const result=run(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:queuedmember',firstName:'Queued',lastName:'Member',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    const state=HouseholdHealthSystem.ensure(household);
    const caseRecord=state.cases.find(c=>c.npcId==='npc:queuedmember');
    const queue={};
    queue[caseRecord.npcId+'|'+caseRecord.conditionInstanceId]={npcId:caseRecord.npcId,conditionInstanceId:caseRecord.conditionInstanceId,decision:'fund-recommended-care',treatmentId:'basic'};
    const html=PersistentPeopleUI.householdHealthPanel(World,S,queue);
    return JSON.stringify({mentionsQueued:html.includes('decision queued'),mentionsAwaiting:html.includes('awaiting a family decision')});
  `);
  assert.equal(result.mentionsQueued,true);
  assert.equal(result.mentionsAwaiting,false);
});

test('PersistentPeopleUI.householdHealthPanel: no household on file renders an empty state rather than throwing',()=>{
  const context=newContext('panel-no-household');
  loadGameFiles(context,['js/systems/persistent-people-ui.js']);
  const result=run(context,`
    const fakeSubject={npcId:'npc:nowhere',alive:true};
    const html=PersistentPeopleUI.householdHealthPanel(World,fakeSubject);
    return JSON.stringify({html});
  `);
  assert.match(result.html,/No household record is on file yet\./);
});

// --- Stub-DOM UI integration --------------------------------------------------

test('renderFamilyHealth: writes the household health panel into #familyMedicalSheet',()=>{
  const {context,elements}=uiContext('ui-render-family-health');
  configureAdult(context);
  // configureAdult() only sets S.livingAtHome=false as a raw field; the
  // subject doesn't actually move to their own new household until the next
  // reconcile pass (inside migrate(), which prepareAndResolveHouseholdCases
  // triggers below). Settling that first keeps the household this test adds
  // a member to in sync with the one the subject (and the panel) will read.
  expose(context,'NpcSystem.migrate(World,S,Lineage);');
  expose(context,`
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:uipanel',firstName:'Ui',lastName:'Panel',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    NpcSystem.drainNotices(World);
    renderFamilyHealth();
  `);
  const html=elements['#familyMedicalSheet'].innerHTML;
  assert.match(html,/FAMILY HEALTH/);
  assert.match(html,/Ui Panel/);
});

test('openFamilyMedicalDecision -> picking "Fund Recommended Care" queues the decision on S.__familyMedicalQueue',()=>{
  const {context,elements}=uiContext('ui-decision-queue');
  configureAdult(context);
  expose(context,'NpcSystem.migrate(World,S,Lineage);');
  const setup=expose(context,`(function(){
    const household=HouseholdSystem.findByMember(World,S.npcId);
    household.settlementId='kostrin';
    household.finances.savings=100000;
    const npc=NpcSystem.upsert(World,{id:'npc:uidecision',firstName:'Ui',lastName:'Decision',sex:'M',birthYear:World.year-40,alive:true,locationId:'kostrin',roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    NpcSystem.drainNotices(World);
    const state=HouseholdHealthSystem.ensure(household);
    const caseRecord=state.cases.find(c=>c.npcId==='npc:uidecision');
    openFamilyMedicalDecision(household.id,caseRecord.caseId);
    return JSON.stringify({npcId:caseRecord.npcId,conditionInstanceId:caseRecord.conditionInstanceId});
  })()`);
  const ids=JSON.parse(setup);
  const skillSheet=elements['#skillSheet'];
  assert.equal(typeof skillSheet.onclick,'function','openFamilyMedicalDecision should have wired an onclick handler on #skillSheet');
  const fundChip={closest(selector){ return selector==="[data-family-decision]"?{dataset:{familyDecision:'fund-recommended-care',familyTreatment:'basic'}}:null; }};
  skillSheet.onclick({target:fundChip});
  const queued=JSON.parse(expose(context,'JSON.stringify(S.__familyMedicalQueue||{})'));
  const key=ids.npcId+'|'+ids.conditionInstanceId;
  assert.ok(queued[key],'the decision should be queued under npcId|conditionInstanceId (stable across household churn)');
  assert.equal(queued[key].decision,'fund-recommended-care');
  assert.equal(queued[key].treatmentId,'basic');
});

test('familyHealthPendingCount: counts pending cases not yet queued, and drops to zero once queued',()=>{
  const {context}=uiContext('ui-pending-count');
  configureAdult(context);
  expose(context,'NpcSystem.migrate(World,S,Lineage);');
  const before=JSON.parse(expose(context,`(function(){
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const npc=NpcSystem.upsert(World,{id:'npc:uicount',firstName:'Ui',lastName:'Count',sex:'M',birthYear:World.year-40,alive:true,locationId:World.activeSettlementId,roleTags:['relative'],source:'test',health:{general:50,conditions:[]}});
    HouseholdSystem.addMember(World,household.id,npc.id,false);
    MedicalSystem.addCondition(npc,'respiratory',3,{world:World,year:World.year,known:true});
    NpcSystem.prepareAndResolveHouseholdCases(World,World.year,S,Lineage);
    NpcSystem.drainNotices(World);
    return JSON.stringify({count:familyHealthPendingCount()});
  })()`));
  assert.equal(before.count,1);
  const after=JSON.parse(expose(context,`(function(){
    const household=HouseholdSystem.findByMember(World,S.npcId);
    const state=HouseholdHealthSystem.ensure(household);
    const caseRecord=state.cases.find(c=>c.npcId==='npc:uicount');
    familyMedicalQueue()[familyMedicalQueueKey(caseRecord.npcId,caseRecord.conditionInstanceId)]={npcId:caseRecord.npcId,conditionInstanceId:caseRecord.conditionInstanceId,decision:'fund-recommended-care',treatmentId:'basic'};
    return JSON.stringify({count:familyHealthPendingCount()});
  })()`));
  assert.equal(after.count,0);
});
