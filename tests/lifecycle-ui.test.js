'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function uiContext(seed,extraFiles){
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
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js'].concat(extraFiles||[]));
  context.activeConditions=()=>[];
  expose(context,`Random.setSeed(${JSON.stringify(seed)}); newWorld(); newLineage(); newHold(); newSubject();`);
  return context;
}

function configureAdult(context,extra){
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.jobTier=0; S.jobName='Unemployed'; S.career=null; S.eduStage=null; S.jailUntil=0; S.garnishUntil=0; S.liabilities=[]; S.kids=0; S.married=false; S.contacts=[]; S.location={settlementId:World.activeSettlementId};"+(extra||''));
}

test('why-not reasons resolve for gated actions',()=>{
  const context=uiContext('whynot');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    S.age=14;
    const gated={crime:whyNotFor('crime'),bottle:whyNotFor('bottle')};
    S.age=30;
    return JSON.stringify({
      quitjob:whyNotFor('quitjob'),
      propose:whyNotFor('propose'),
      divorce:whyNotFor('divorce'),
      crime:gated.crime,
      bottle:gated.bottle,
      payoffdebt:whyNotFor('payoffdebt')
    });
  })()`));
  assert.equal(result.quitjob,'no job');
  assert.equal(result.propose,'not attached');
  assert.equal(result.divorce,'not married');
  assert.equal(result.crime,'from age 16');
  assert.equal(result.bottle,'from age 16');
  assert.equal(result.payoffdebt,'no debts on file');
});

test('disabled plan buttons surface the reason instead of a bare not-available',()=>{
  const context=uiContext('whynot-ui');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    planTab='decisions';
    renderPlan();
    const html=document.getElementById('planSheet').innerHTML;
    return JSON.stringify({hasReasons:/— (no job|needs marriage|record already clean|no debts on file)/.test(html)});
  })()`));
  assert.equal(result.hasReasons,true);
});

test('fx previews render as mini chips on enabled buttons',()=>{
  const context=uiContext('fx-preview');
  configureAdult(context);
  const result=JSON.parse(expose(context,`JSON.stringify({
    chips:fxPreviewChips({smarts:1,happiness:-2}),
    safe:typeof fxPreviewHtmlSafe==='function'?fxPreviewHtmlSafe({id:'x',note:()=>'n',avail:()=>true}):''
  })`));
  assert.ok(result.chips.includes('+1 SMARTS'));
  assert.ok(result.chips.includes('−2 HAPPINESS'));
  assert.equal(result.safe,'');
});

test('recommended strip appears for a struggling subject and queues real actions',()=>{
  const context=uiContext('rec-strip');
  configureAdult(context,'S.health=30; S.happiness=25;');
  const result=JSON.parse(expose(context,`(function(){
    planTab='pursuits';
    renderPlan();
    const html=document.getElementById('planSheet').innerHTML;
    return JSON.stringify({
      strip:html.includes('SUGGESTED NOW'),
      doctor:html.includes('data-p="doctor"'),
      mood:html.includes('data-p="walk"')||html.includes('data-p="family"')
    });
  })()`));
  assert.equal(result.strip,true);
  assert.equal(result.doctor,true);
  assert.equal(result.mood,true);
});

test('fast-forward runs synchronously and leaves a recap card with per-year beats',()=>{
  const context=uiContext('ff-recap');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    fastForward();
    const el=document.getElementById('ffRecap');
    return JSON.stringify({
      years:S.age-30,
      recapShown:!el.classList.contains('hidden'),
      head:el.innerHTML.includes('FAST-FORWARD'),
      rows:(el.innerHTML.split('<b>Y').length-1),
      reportClean:reportEntries.length===0
    });
  })()`));
  assert.ok(result.years>=1);
  assert.equal(result.recapShown,true);
  assert.equal(result.head,true);
  assert.equal(result.rows,result.years);
  assert.equal(result.reportClean,true);
});

test('life ribbon renders stage bands, decade ticks, and the current-age marker',()=>{
  const context=uiContext('ribbon');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    S.highlights=[{text:'Started work at the docks',age:19},{text:'Married in spring',age:26}];
    renderLifeRibbon();
    const html=document.getElementById('lifeRibbon').innerHTML;
    return JSON.stringify({
      bands:html.includes('rb-band c3'),
      ticks:(html.match(/rb-tick/g)||[]).length>=6,
      dots:(html.match(/rb-dot/g)||[]).length===2,
      now:html.includes('rb-now')
    });
  })()`));
  assert.equal(result.bands,true);
  assert.equal(result.ticks,true);
  assert.equal(result.dots,true);
  assert.equal(result.now,true);
});

test('sparklines grow one point per year and render as polylines',()=>{
  const context=uiContext('sparks');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    for(let i=0;i<4&&(S.statHistory||[]).length<3;i++){ slipOpen=false; pendingSlips=[]; advanceYear(true,true); }
    renderSparks();
    const row=document.getElementById('sparkRow').innerHTML;
    return JSON.stringify({
      historyLen:S.statHistory.length,
      polylines:(row.match(/<polyline/g)||[]).length,
      labels:row.includes('HEALTH')&&row.includes('HAPPINESS')&&row.includes('ASSETS')
    });
  })()`));
  assert.equal(result.historyLen,3);
  assert.equal(result.polylines,3);
  assert.equal(result.labels,true);
});

test('portrait ages with grey veil and wrinkle overlays',()=>{
  const context=uiContext('portrait-age');
  const young=expose(context,"Random.setSeed('p'); portraitSVG('M',1,TINTS[0],20)");
  const old=expose(context,"Random.setSeed('p'); portraitSVG('M',1,TINTS[0],72)");
  assert.equal(young.includes('#cfc9ba'),false);
  assert.ok(old.includes('#cfc9ba'));
  assert.ok(old.length>young.length);
});

test('closeTopOverlay hides decision-safe sheets only and reports success',()=>{
  const context=uiContext('esc-close');
  configureAdult(context);
  const result=JSON.parse(expose(context,`JSON.stringify({
    closedSomething:closeTopOverlay(),
    slipNeverInList:OVERLAY_CLOSE_ORDER.indexOf('slipWrap')<0&&OVERLAY_CLOSE_ORDER.indexOf('closedWrap')<0&&OVERLAY_CLOSE_ORDER.indexOf('intentWrap')<0
  })`));
  assert.equal(result.closedSomething,true);
  assert.equal(result.slipNeverInList,true);
});

test('coach marks advance through plan, seal, and report steps',()=>{
  const context=uiContext('coach');
  configureAdult(context);
  const result=JSON.parse(expose(context,`(function(){
    renderCoach();
    const bar=document.getElementById('coachBar');
    const step1=bar.innerHTML.includes('STEP 1 · PLAN');
    coachSet('plan');
    const step2=bar.innerHTML.includes('STEP 2 · SEAL');
    coachSet('seal');
    const step3=bar.innerHTML.includes('STEP 3 · THE REPORT');
    coachSet('report');
    const hiddenAfter=bar.classList.contains('hidden');
    return JSON.stringify({step1,step2,step3,hiddenAfter});
  })()`));
  assert.equal(result.step1,true);
  assert.equal(result.step2,true);
  assert.equal(result.step3,true);
  assert.equal(result.hiddenAfter,false);
});

test('followups fire for both the relative (in:) and absolute (at:) shapes',()=>{
  const context=uiContext('followups');
  configureAdult(context);
  expose(context,`window.__hits={absolute:0,delta:0};
    pushFollow({at:S.age+1,t:'absolute',side:function(){window.__hits.absolute++;}});
    pushFollow({in:2,t:'delta',side:function(){window.__hits.delta++;}});`);
  for(let i=0;i<4;i++){
    expose(context,'slipOpen=false;');
    expose(context,'advance(true,true)');
  }
  const result=JSON.parse(expose(context,"JSON.stringify({hits:window.__hits,stale:followups.filter(function(f){return !(f.at>S.age);}).length})"));
  assert.equal(result.hits.absolute,1,'an absolute-age followup must fire at its scheduled age');
  assert.equal(result.hits.delta,1,'a relative-delay followup must fire after its delay');
  assert.equal(result.stale,0,'no due-but-unfired followup may linger in the queue');
});

test('death closes the subject employment file so the heir is not paid a ghost salary',()=>{
  const context=uiContext('ghost-pay',['js/education.js']);
  configureAdult(context);
  expose(context,"S.jobTier=1; S.jobName='Clerk'; EmploymentSystem.reconcilePlayer(World,S);");
  const contractId=expose(context,"EmploymentSystem.activeForPerson(World,'subject')[0].id");
  expose(context,"addKin({first:'Ada',last:S.last,sex:'F',dob:currentYear()-20,relation:'child',bond:70});");
  expose(context,"S.alive=false; S.cause='heart failure'; handleDeath();");
  expose(context,"(function(){var m=Lineage.members.find(function(x){return x.first==='Ada';}); promoteToLeader(m);})()");
  expose(context,'slipOpen=false;');
  expose(context,'advance(true,true)');
  assert.equal(expose(context,"S.__worldWagePaid||0"),0,
    'an unemployed heir must not receive the predecessor\'s wage in their first year');
  const ended=JSON.parse(expose(context,"(function(){var c=EmploymentSystem.get(World,"+JSON.stringify(contractId)+");return JSON.stringify({status:c.status,reason:c.terminationReason});})()"));
  assert.equal(ended.status,'terminated','the deceased subject\'s contract must be terminated at death');
  assert.equal(ended.reason,'subject_deceased');
});
