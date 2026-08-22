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
  context.setTimeout=(fn)=>0;
  context.clearTimeout=()=>{};
  context.setInterval=()=>0;
  context.clearInterval=()=>{};
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  context.activeConditions=()=>[];
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function configureAdult(context,extra){
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.jobTier=0; S.jobName='Unemployed'; S.career=null; S.eduStage=null; S.jailUntil=0; S.garnishUntil=0; S.liabilities=[]; S.kids=0; S.married=false; S.contacts=[]; S.location={settlementId:World.activeSettlementId};"+(extra||''));
}

function reportBody(context){
  return JSON.parse(expose(context,"JSON.stringify(document.getElementById('recentRecordBody').innerHTML)"));
}

test('non-quiet annual advance builds the annual report with staged pending entries',()=>{
  const context=uiContext('report-staged');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    advanceYear(false,false);
    const html=document.getElementById('recentRecordBody').innerHTML;
    return JSON.stringify({
      hasStamp:html.includes('rr-yearstamp'),
      hasYear:html.includes('YEAR '+S.age),
      pendingCount:(html.match(/yr-pending/g)||[]).length,
      filedShown:html.includes('rr-filed show'),
      receiptHidden:!html.includes('rr-receipt')
    });
  })()`));
  assert.equal(result.hasStamp,true);
  assert.equal(result.hasYear,true);
  assert.ok(result.pendingCount>0,'entries should start hidden while the ceremony paces them');
  assert.equal(result.filedShown,false);
  assert.equal(result.receiptHidden,true);
});

test('quiet advance keeps the legacy single-line record (no ceremony)',()=>{
  const context=uiContext('report-quiet');
  configureAdult(context);
  expose(context,'advanceYear(true,true);');
  const html=reportBody(context);
  assert.equal(html.includes('rr-yearstamp'),false);
});

test('fast-forward leaves no staged report behind',()=>{
  const context=uiContext('report-fastforward');
  configureAdult(context);
  expose(context,'fastForward();');
  const state=JSON.parse(expose(context,`JSON.stringify({pending:(document.getElementById('recentRecordBody').innerHTML.match(/yr-pending/g)||[]).length,entriesLen:typeof reportEntries!=='undefined'?reportEntries.length:-1})`));
  assert.equal(state.entriesLen,0);
  assert.equal(state.pending,0);
});

test('skip path completes instantly and reveals receipt plus FILED stamp',()=>{
  const context=uiContext('report-skip');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    advanceYear(false,false);
    skipReportReveal();
    const html=document.getElementById('recentRecordBody').innerHTML;
    return JSON.stringify({
      pendingCount:(html.match(/yr-pending/g)||[]).length,
      filedShown:html.includes('rr-filed show')
    });
  })()`));
  assert.equal(result.pendingCount,0);
  assert.equal(result.filedShown,true);
});

test('receipt chips reflect net stat and money deltas for the year',()=>{
  const context=uiContext('report-receipt');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    reportSnap={health:S.health,happiness:S.happiness,smarts:S.smarts,looks:S.looks,relations:S.relations,money:S.assets};
    S.health=Math.max(0,S.health-4); S.happiness=Math.min(100,S.happiness+3); S.assets=S.assets+250;
    reportEntries=[{head:'TEST · YEAR '+S.age,text:'entry',chips:[],cls:''}];
    reportIdx=1;
    const chips=yearReceiptChips();
    return JSON.stringify(chips);
  })()`));
  assert.deepEqual(result,[{txt:'−4 HEALTH',plus:false},{txt:'+3 HAPPINESS',plus:true},{txt:'+$250',plus:true}]);
});

test('slip queue presents notices sequentially instead of last-one-wins',()=>{
  const context=uiContext('slip-queue');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    const opened=[];
    const realOpen=openPetition;
    openPetition=function(p){opened.push(1);slipOpen=true;};
    pendingSlips=[];
    pendingSlips.push({kind:'petition',def:{}},{kind:'petition',def:{}});
    drainNextSlip();
    const first=opened.length;
    slipOpen=false;
    drainNextSlip();
    openPetition=realOpen;
    return JSON.stringify({first,second:opened.length});
  })()`));
  assert.equal(result.first,1);
  assert.equal(result.second,2);
});

test('drain is inert when a slip is already open or the subject is dead',()=>{
  const context=uiContext('slip-queue-guards');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    let opened=0;
    const real=openPetition;
    openPetition=function(){opened++;slipOpen=true;};
    pendingSlips=[{kind:'petition',def:{}}];
    slipOpen=true; drainNextSlip();
    const whileOpen=opened;
    slipOpen=false; S.alive=false; drainNextSlip();
    const whileDead=opened;
    S.alive=true; openPetition=real; pendingSlips=[];
    return JSON.stringify({whileOpen,whileDead});
  })()`));
  assert.equal(result.whileOpen,0);
  assert.equal(result.whileDead,0);
});
