'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function liveContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,
    scrollTop:0,scrollHeight:0,offsetWidth:1200,offsetHeight:900,clientWidth:1200,clientHeight:900,_listeners:[],
    appendChild(){},remove(){},addEventListener(){},removeEventListener(){},setAttribute(){},
    getBoundingClientRect(){return {left:0,top:0,width:1200,height:900};},focus(){},click(){},querySelectorAll(){return [];}
  });
  context.document={
    querySelector(s){return elements[s]||(elements[s]=makeElement());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=makeElement());},
    createElement(){return makeElement();},
    addEventListener(){}, body:makeElement(), documentElement:makeElement()
  };
  context.addEventListener=()=>{}; context.setTimeout=()=>0; context.clearTimeout=()=>{};
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  context.activeConditions=()=>[];
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject();");
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.health=80; S.happiness=50;"+
    "S.jobTier=1; S.jobName='Clerk'; S.career=null; S.eduStage=null; S.jailUntil=0; S.kids=0; S.married=false;"+
    "S.contacts=[]; S.liabilities=[]; S.scrutiny=5; S.vice=0; S.record=false;"+
    "S.lifestyle={housing:'flat',food:'basic',childcare:'basic'}; S.location={settlementId:World.activeSettlementId};");
  return context;
}

test('clicking an action performs it immediately: stats, log, and energy land now',()=>{
  const context=liveContext('live-now');
  const beforeHap=expose(context,'S.happiness');
  expose(context,"performActionNow('p','walk');");
  assert.ok(expose(context,'S.happiness')>beforeHap,'the walk applied its happiness effect instantly');
  assert.equal(expose(context,"doneActionsThisYear().includes('walk')"),true,'the act is on this year\'s done ledger');
  assert.ok(expose(context,'S.acts')>=1,'the act counted toward the subject\'s record');
});

test('once-per-year actions cannot be repeated after being performed',()=>{
  const context=liveContext('live-once');
  expose(context,"performActionNow('p','walk');");
  const hapAfterFirst=expose(context,'S.happiness');
  expose(context,"performActionNow('p','walk');");
  assert.equal(expose(context,'S.happiness'),hapAfterFirst,'the second walk is rejected outright');
  assert.equal(expose(context,"whyNotFor('rest')===null&&true"),true,'sanity');
});

test('energy budget blocks actions beyond what the body can afford',()=>{
  const context=liveContext('live-budget');
  // Drive energy to exactly 2: health<30 removes one, medical penalty none.
  expose(context,"S.health=20;");
  const budget=expose(context,'planHours()');
  assert.ok(budget>=2&&budget<=3,'test expectation: a worn body carries 2-3 energy, got '+budget);
  // Spend the whole quota on distinct cost-1 pursuits.
  expose(context,"performActionNow('p','walk');");
  expose(context,"performActionNow('p','study');");
  assert.equal(expose(context,"doneActionsThisYear().length"),2,'two acts consumed the quota');
  const hapBefore=expose(context,'S.happiness');
  expose(context,"performActionNow('p','doctor');"); // costs ⚡1
  assert.equal(expose(context,'S.happiness'),hapBefore,'an action beyond the energy quota is refused');
  assert.equal(expose(context,"doneActionsThisYear().filter(function(id){return id==='doctor';}).length"),0);
});

test('the year-end quiet note only fires when nothing at all was done',()=>{
  const context=liveContext('live-quietgate');
  expose(context,"performActionNow('p','walk');");
  expose(context,'slipOpen=false;');
  expose(context,'advance(true,true)');
  const idleLogged=expose(context,"(yearLog.some(function(e){return e.cls==='idle';}))");
  assert.equal(idleLogged,false,'a year with direct acts is not filed as quiet');
});

test('the plan sheet is now LIVE: renames and energy units are in place',()=>{
  const context=liveContext('live-renames');
  expose(context,'renderPlan();');
  const html=expose(context,"document.getElementById('planSheet').innerHTML");
  assert.ok(html.includes('DIRECT ORDERS'),'the sheet is retitled DIRECT ORDERS');
  assert.ok(html.includes('ENERGY'),'the budget reads as ENERGY');
  assert.ok(html.includes('⚡'),'costs carry the energy mark');
  assert.ok(!html.includes('VOID LAST'),'the queue-era void control is gone');
  assert.ok(html.includes('End the Year'),'the footer ends the year instead of sealing a queue');
  expose(context,'updateBar();');
  assert.equal(expose(context,"document.getElementById('plan-label').textContent"),'LIVE THE YEAR','the main button is renamed');
});

test('venture financing enters the debt schedule rather than gifting cash',()=>{
 const context=liveContext('venture-debt');
 expose(context,"S.assets=1200; S.skills.retail=2; S.liabilities=[];");
 const cash=expose(context,"S.assets");
 expose(context,"performActionNow('d','loan')");
 assert.equal(expose(context,"S.assets"),cash);
 assert.equal(expose(context,"S.liabilities.length"),1);
 assert.equal(expose(context,"S.liabilities[0].id"),'ventureloan');
 assert.equal(expose(context,"S.liabilities[0].annualPayment"),520);
 assert.equal(expose(context,"S.liabilities[0].yearsLeft"),5);
});
test('gambling hall enters the real business registry and risks scrutiny',()=>{
 const context=liveContext('real-ownership');
 expose(context,"S.assets=6000;S.freedom=70;");
 const old=expose(context,"ownedActiveBusinesses().length");
 assert.equal(old,0);
 expose(context,"performActionNow('d','gamblelic')");
 assert.equal(expose(context,"ownedActiveBusinesses().length"),1);
 assert.equal(expose(context,"S.assets"),2500);
 assert.ok(expose(context,"S.scrutiny")>5);
 const b=JSON.parse(expose(context,"JSON.stringify(BusinessSystem.get(World,ownedActiveBusinesses()[0]))"));
 assert.equal(b.sector,'retail');
 assert.equal(b.ownerNpcId,'subject');
 assert.equal(b.finances.cash,3500);
});
test('relocate uses the map journey and changes place only upon arrival',()=>{
 const context=liveContext('coastal-route');
 expose(context,"World.activeSettlementId='branec';World.place='Branec';S.location={settlementId:'branec'};S.assets=5000;S.freedom=70;S.didCoast=false;S.traveling=null;");
 expose(context,"performActionNow('d','relocate')");
 assert.equal(expose(context,"World.activeSettlementId"),'branec');
 assert.equal(expose(context,"S.traveling.to"),'veskar');
 assert.equal(expose(context,"S.didCoast"),false);
 expose(context,"World.year++; resolveTravel()");
 assert.equal(expose(context,"World.activeSettlementId"),'veskar');
 assert.equal(expose(context,"S.didCoast"),true);
});
