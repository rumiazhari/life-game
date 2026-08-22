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
  assert.ok(result.ids.includes('soupkitchen'),'mission meal queued when broke');
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

test('autonomy tightens the household when broke and independent',()=>{
  const context=uiContext('auto-tighten');
  configureAdult(context,"S.assets=-900; S.jobTier=2; S.jobName='Clerk'; S.kids=1; S.lifestyle=Object.assign({},S.lifestyle,{housing:'flat',food:'basic',childcare:'comfortable'});");
  const result=JSON.parse(expose(context,`(function(){
    autoApplyLifestyleChoices();
    return JSON.stringify({housing:S.lifestyle.housing,food:S.lifestyle.food,childcare:S.lifestyle.childcare,log:ffActionLog.map(e=>e.label)});
  })()`));
  assert.equal(result.housing,'room','housing downgrades one rung when deeply broke');
  assert.equal(result.food,'meager','food downgrades one rung when broke');
  assert.equal(result.childcare,'basic','childcare falls back to basic');
  assert.ok(result.log.length>=3,'each tightening choice is recorded: '+JSON.stringify(result.log));
});

test('autonomy upgrades housing and food only when income clearly carries it',()=>{
  const context=uiContext('auto-upgrade');
  configureAdult(context,"S.assets=20000; S.jobTier=5; S.jobName='Magistrate'; S.lifestyle=Object.assign({},S.lifestyle,{housing:'flat',food:'basic'});");
  const result=JSON.parse(expose(context,`(function(){
    autoApplyLifestyleChoices();
    return JSON.stringify({housing:S.lifestyle.housing,food:S.lifestyle.food,log:ffActionLog.map(e=>e.label)});
  })()`));
  assert.equal(result.housing,'house','flat upgrades to house under INC[5]=7200 income');
  assert.equal(result.food,'decent','basic food upgrades to decent');
  assert.ok(result.log.length>=2);
});

test('autonomy proposes to a happy partner and never starts affairs while merely attached',()=>{
  const context=uiContext('auto-propose');
  configureAdult(context,"S.jobTier=2; S.jobName='Clerk'; S.status='Attached'; S.partner='Pat'; S.relations=60; S.happiness=60; S.health=80; if(S.lifestyle)S.lifestyle.food='basic'; S.contacts=[{cid:'c1',role:'partner',mood:85,name:'Pat',sex:'F'}]; S.mother=null; S.father=null;");
  const result=JSON.parse(expose(context,`(function(){
    autoQueueBestActions();
    return JSON.stringify({ids:S.queue.map(q=>q.id),used:S.queue.reduce((a,q)=>a+(PUR_MAP[q.id]?PUR_MAP[q.id].cost:(DEC_MAP[q.id]?DEC_MAP[q.id].cost:0)),0),budget:planHours()});
  })()`));
  assert.ok(result.ids.includes('court'),'courting an attached partner is queued');
  assert.ok(result.ids.includes('propose'),'proposal queued for a happy attached partner');
  assert.ok(!result.ids.includes('flirtsecret'),'no affair while unmarried/attached');
  assert.equal(result.used,result.budget,'hours filled to budget');
});

test('desperate unemployed subject turns to crime; miserable marriage may end in divorce',()=>{
  const crimeContext=uiContext('auto-crime');
  configureAdult(crimeContext,"S.assets=-1500; S.health=70; S.happiness=50;");
  const crimeIds=JSON.parse(expose(crimeContext,`(function(){ autoQueueBestActions(); return JSON.stringify(S.queue.map(q=>q.id)); })()`));
  assert.ok(crimeIds.includes('crime'),'crime queued out of desperation');

  const divorceContext=uiContext('auto-divorce');
  configureAdult(divorceContext,"S.married=true; S.partner='Sam'; S.partnerMood=15; S.happiness=30; S.jobTier=1; S.jobName='Porter'; S.contacts=[{cid:'c2',role:'spouse',mood:15,name:'Sam',sex:'M'}]; S.mother=null; S.father=null;");
  const divorceIds=JSON.parse(expose(divorceContext,`(function(){ autoQueueBestActions(); return JSON.stringify(S.queue.map(q=>q.id)); })()`));
  assert.ok(divorceIds.includes('divorce'),'divorce queued for a dead marriage');
});

test('fast-forward ends with a report popup listing every action taken',()=>{
  const context=uiContext('ff-report');
  configureAdult(context,"S.health=75; S.happiness=55; S.assets=4000;");
  seedOpening(context);
  // Keep random crisis/petition slips from piling up behind the report.
  expose(context,'maybeSlip=function(){};');
  expose(context,`(function(){
    fastForward();
    const card=document.querySelector('#slipCard');
    // If an event window interrupted the run (the loop stops while any
    // window is open), close it and surface the deferred report exactly as
    // resolving a notice would. If the report is already on screen -- or any
    // window at all -- leave it alone.
    if(!(slipOpen&&card.innerHTML.includes('THE YEARS ON FILE'))){
      $('#slipWrap').classList.add('hidden');
      slipOpen=false;
      document.body.classList.remove('slip-open');
      pendingSlips=[];
      if(S.__pendingFFReport){const rpt=S.__pendingFFReport;S.__pendingFFReport=null;openNotice(rpt);}
    }
    return null;
  })()`);
  const result=JSON.parse(expose(context,`(function(){
    const card=document.querySelector('#slipCard');
    return JSON.stringify({
      loggedActions:ffActionLog.length,
      slipOpen:slipOpen,
      head:card.innerHTML.includes('THE YEARS ON FILE'),
      ack:card.innerHTML.includes('Acknowledge'),
      hasEntries:card.innerHTML.indexOf('ffrpt-act')!==-1
    });
  })()`));
  assert.ok(result.loggedActions>0,'actions were recorded during fast-forward');
  assert.equal(result.slipOpen,true,'report popup is open after fast-forward');
  assert.equal(result.head,true,'report uses the notice template title');
  assert.equal(result.ack,true,'report closes via the Acknowledge button');
  assert.equal(result.hasEntries,true,'report lists captured actions');
  // Acknowledging closes the report window itself.
  expose(context,`$('#slipCard').onclick({target:{closest:function(sel){return sel==='[data-ack]'?{}:null;}}});`);
  const after=JSON.parse(expose(context,`JSON.stringify({slipOpen:slipOpen,pending:!S.__pendingFFReport})`));
  assert.equal(after.slipOpen,false,'acknowledge closes the report window');
  assert.equal(after.pending,true);
});

