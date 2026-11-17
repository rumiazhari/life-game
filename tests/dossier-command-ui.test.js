'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function contextFor(seed){
 const ctx=createWorldContext(),elements={};
 const make=()=>({
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,
  disabled:false,scrollTop:0,scrollHeight:0,offsetWidth:900,offsetHeight:800,
  addEventListener(){},removeEventListener(){},appendChild(){},remove(){},focus(){},
  setAttribute(){},querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;},
  getBoundingClientRect(){return {left:0,top:0,width:900,height:800};}
 });
 ctx.document={querySelector(k){return elements[k]||(elements[k]=make());},
   querySelectorAll(){return [];},getElementById(k){return elements['#'+k]||(elements['#'+k]=make());},
   createElement(){return make();},addEventListener(){},body:make(),documentElement:make()};
 ctx.addEventListener=()=>{};ctx.setTimeout=()=>0;ctx.clearTimeout=()=>{};
 ctx.setInterval=()=>0;ctx.clearInterval=()=>{};
 loadGameFiles(ctx,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
 ctx.activeConditions=()=>[];
 expose(ctx,'Random.setSeed('+JSON.stringify(seed)+');newWorld();newLineage();newHold();newSubject();');
 expose(ctx,"S.age=30;World.year=S.dob+S.age;S.livingAtHome=false;S.assets=1400;S.health=80;"+
  "S.happiness=58;S.jobTier=0;S.jobName='Unemployed';S.career=null;S.eduStage=null;S.jailUntil=0;"+
  "S.liabilities=[];S.kids=0;S.contacts=[];S.married=false;S.scrutiny=0;S.vice=0;S.record=false;"+
  "S.lifestyle={housing:'flat',food:'basic',childcare:'basic'};S.location={settlementId:World.activeSettlementId};");
 return {ctx,elements};
}
function get(ctx,expr){return expose(ctx,expr);}
function html(ctx,id){return get(ctx,"document.getElementById('"+id+"').innerHTML");}

test('dossier contains a persistent world briefing, direct action receipt, and versioned assets',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../life-game.html'),'utf8');
 assert.match(source,/id="worldBrief"/);
 assert.match(source,/id="actionReceipt"/);
 assert.match(source,/css\/style.css\?v=20261116-map7/);
 assert.match(source,/js\/ui.js\?v=20261117-phase2/);
 assert.match(source,/js\/main.js\?v=20261115-command1/);
});
test('world briefing renders actual employment, company and security indicators without changing the world',()=>{
 const {ctx}=contextFor('brief-status');
 const sid=get(ctx,'World.activeSettlementId');
 get(ctx,'renderWorldBrief()');
 const display=html(ctx,'worldBrief');
 assert.match(display,/LIVE WORLD RECORD/);
 assert.match(display,/LABOR MARKET/);
 assert.match(display,/Employment/);
 assert.match(display,/PUBLIC UNREST/);
 assert.match(display,/EMPLOYERS UNDER STRAIN/);
 assert.match(display,/REVIEW YOUR CHOICES/);
 assert.ok(display.includes(String(get(ctx,'World.year'))));
 assert.ok(display.includes(get(ctx,'World.place')));
 assert.ok(typeof sid==='string');
});
test('priorities shows playable contextual options and meaningful stakes, not a duplicate action catalog',()=>{
 const {ctx}=contextFor('brief-decisions');
 get(ctx,"planTab='focus';renderPlan()");
 const display=html(ctx,'planSheet');
 assert.match(display,/class="focus-lead"/);
 assert.match(display,/DECISION BRIEF/);
 assert.match(display,/focus-signal-grid/);
 assert.match(display,/OPTIONS YOU CAN TAKE NOW/);
 assert.match(display,/data-plan-tab="pursuits"/);
 assert.match(display,/data-plan-tab="decisions"/);
 assert.ok(display.includes('data-p="lookwork"'),'job search should be suggested when unemployed');
 assert.doesNotMatch(display,/data-d="loan"/,'the entire old action registry must not fill the priorities screen');
});
test('advanced action registry hides unavailable actions until explicitly requested',()=>{
 const {ctx}=contextFor('browse-registry');
 get(ctx,"planTab='decisions';planShowUnavailable=false;renderPlan()");
 const compact=html(ctx,'planSheet');
 assert.match(compact,/SHOW ALL ACTIONS/);
 assert.doesNotMatch(compact,/data-d="gamblelic"/,'a broke/unemployed character cannot found a gambling hall');
 get(ctx,"planShowUnavailable=true;renderPlan()");
 const full=html(ctx,'planSheet');
 assert.match(full,/HIDE UNAVAILABLE/);
 assert.match(full,/data-d="gamblelic"/,'disabled action must remain discoverable in the advanced registry');
 assert.ok(full.length>compact.length);
});
test('every immediate action generates legible in-dossier feedback and year-end clears it',()=>{
 const {ctx}=contextFor('instant-receipt');
 get(ctx,"performActionNow('p','walk')");
 const receipt=html(ctx,'actionReceipt');
 assert.match(receipt,/ACTION ENTERED/);
 assert.match(receipt,/Walk it off/);
 assert.match(receipt,/FULL CASE LOG/);
 get(ctx,"planTab='focus';renderPlan()");
 assert.match(html(ctx,'planSheet'),/LAST ACTION/);
 get(ctx,'clearActionReceipt()');
 assert.equal(html(ctx,'actionReceipt'),'');
});
test('workplace negotiation displays state-derived odds and consequences before committing',()=>{
 const {ctx}=contextFor('labor-choices');
 const r=JSON.parse(get(ctx,"(function(){"+
  "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'retail',name:'Local Market'});"+
  "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1350,occupationName:'Clerk',jobTier:1});"+
  "EmploymentSystem.syncPlayerLegacy(World,S);"+
  "const situation=WorkplaceSystem.laborSituation(World);openLaborDecision();"+
  "return JSON.stringify({situation,markup:document.getElementById('skillSheet').innerHTML});})()"));
 assert.equal(r.situation.available,true);
 assert.match(r.markup,/ACCEPTANCE/);
 assert.match(r.markup,/Request a raise/);
 assert.match(r.markup,/Cooperate with management/);
 assert.match(r.markup,/business finances/);
 assert.match(r.markup,/strategy-option/);
});
