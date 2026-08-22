'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,scrollTop:0,scrollHeight:0,offsetWidth:100,offsetHeight:100,
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
  context.timers=[];
  context.setTimeout=(fn)=>{context.timers.push(fn);return context.timers.length;};
  context.clearTimeout=()=>{};
  context.setInterval=()=>0;
  context.clearInterval=()=>{};
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  context.activeConditions=()=>[];
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function configureAdult(context,extra){
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.jobTier=0; S.jobName='Unemployed'; S.career=null; S.eduStage=null; S.jailUntil=0; S.garnishUntil=0; S.liabilities=[]; S.kids=0; S.married=false; S.status='Single'; S.contacts=[]; S.location={settlementId:World.activeSettlementId};"+(extra||''));
}

function seedOpening(context){
  expose(context,`(function(){
    WorldSimulation.migrate(World);
    const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail'});
    VacancySystem.open(World,{businessId:b.id,occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    return null;
  })()`);
}

test('auto-plan queues a real qualifying opening for an unemployed adult',()=>{
  const context=uiContext('autoplan-job');
  configureAdult(context);
  seedOpening(context);
  const result=JSON.parse(expose(context,`(function(){
    autoQueueBestActions();
    return JSON.stringify(S.queue);
  })()`));
  const lookwork=result.find(q=>q.id==='lookwork');
  assert.ok(lookwork,'lookwork should be queued when a qualifying opening exists');
  assert.equal(lookwork.type,'p');
  assert.ok(/^vacancy:\d{5,}$/.test(String(lookwork.vacancyId)),'lookwork must carry a persistent vacancy id');
});

test('auto-plan skips lookwork instead of wasting the hour when nothing qualifies',()=>{
  const context=uiContext('autoplan-nojob');
  configureAdult(context);
  const ids=JSON.parse(expose(context,`(function(){
    autoQueueBestActions();
    return JSON.stringify(S.queue.map(q=>q.id));
  })()`));
  assert.ok(!ids.includes('lookwork'),'no doomed application should be queued');
});

test('auto-plan keeps player-queued items and fills remaining hours by priority',()=>{
  const context=uiContext('autoplan-fill');
  configureAdult(context,'S.health=30; S.happiness=25; S.assets=-900; S.jobTier=2; S.jobName=\'Warehouse Hand\'; S.married=true;');
  const result=JSON.parse(expose(context,`(function(){
    S.queue.push({id:'doctor',type:'p'});
    autoQueueBestActions();
    return JSON.stringify({
      first:S.queue[0]&&S.queue[0].id,
      ids:S.queue.map(q=>q.id),
      used:S.queue.reduce((a,q)=>a+(PUR_MAP[q.id]?PUR_MAP[q.id].cost:(DEC_MAP[q.id]?DEC_MAP[q.id].cost:0)),0),
      budget:planHours()
    });
  })()`));
  assert.equal(result.first,'doctor','player-queued action stays first');
  assert.ok(result.ids.includes('overtime'),'overtime queued for negative assets while employed');
  assert.ok(result.ids.includes('walk'),'walk queued for low mood');
  assert.ok(!result.ids.includes('family'),'family not queued without children');
  assert.equal(result.used,result.budget,'the yearly hour budget is filled to the brim');
});

test('auto-plan queues nothing in custody or before the age of agency',()=>{
  const context=uiContext('autoplan-guards');
  configureAdult(context,'S.jailUntil=S.age+5;');
  const jailed=JSON.parse(expose(context,`(function(){
    autoQueueBestActions();
    return JSON.stringify({queue:S.queue.length,budget:planHours()});
  })()`));
  assert.equal(jailed.budget,0);
  assert.equal(jailed.queue,0);
  const context2=uiContext('autoplan-child');
  expose(context2,`newWorld(); newLineage(); newHold(); newSubject(); S.age=5; World.year=S.dob+S.age;`);
  const child=JSON.parse(expose(context2,`(function(){
    autoQueueBestActions();
    return JSON.stringify({queue:S.queue.length,budget:planHours()});
  })()`));
  assert.equal(child.budget,0);
  assert.equal(child.queue,0);
});

test('fast-forward auto-plans every advanced year',()=>{
  const context=uiContext('ff-autoplan');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    const before=S.acts||0;
    fastForward();
    return JSON.stringify({years:S.age-30,acts:S.acts||0,quietRestored:quietMode===false});
  })()`));
  assert.ok(result.years>=1);
  assert.ok(result.acts>0,'fast-forwarded years executed auto-planned actions');
  assert.equal(result.quietRestored,true);
});
