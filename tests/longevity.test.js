'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function lifeContext(seed){
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
  expose(context,"S.age=30; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=1000; S.health=80; S.happiness=55;"+
    "S.jobTier=1; S.jobName='Clerk'; S.career=null; S.eduStage=null; S.jailUntil=0; S.kids=0; S.married=false;"+
    "S.contacts=[]; S.liabilities=[]; S.scrutiny=5; S.vice=0; S.record=false; S.relations=60;"+
    "S.lifestyle={housing:'flat',food:'basic',childcare:'basic'}; S.location={settlementId:World.activeSettlementId};");
  return context;
}

test('the old-age curve is capped, health-aware, and strictly gentler than the legacy linear dial',()=>{
  const context=lifeContext('oldage-curve');
  const riskAt=(age,health)=>expose(context,"SurvivalSystem.playerOldAgeRiskOf("+age+","+health+")");
  // Monotonic in age.
  assert.ok(riskAt(70,70)>riskAt(65,70));
  assert.ok(riskAt(90,70)>riskAt(80,70));
  // Health matters but cannot blow the cap.
  assert.ok(riskAt(75,30)>riskAt(75,85),'worn bodies age faster');
  for(const age of [60,70,80,95]){
    const r=riskAt(age,40);
    const cap=age>=85?0.085:0.05;
    assert.ok(r<=cap+1e-9,'risk respects its band cap at '+age+' ('+r.toFixed(4)+' vs '+cap+')');
  }
  // Legacy formula (0.0042*(age-55)+max(0,70-h)*0.0008) at representative points.
  const legacy=(age,h)=>0.0042*(age-55)+Math.max(0,70-h)*0.0008;
  for(const [age,h] of [[68,55],[75,45],[82,35]]){
    assert.ok(riskAt(age,h)<legacy(age,h),'new curve must be gentler than legacy at '+age+'/'+h+
      ' ('+riskAt(age,h).toFixed(4)+' vs '+legacy(age,h).toFixed(4)+')');
  }
});

test('a collapsed body gets a crisis rescue before it gets a funeral',()=>{
  const context=lifeContext('critical-rescue');
  expose(context,'S.health=0;');
  expose(context,'checkMortality();');
  assert.equal(expose(context,'S.alive'),true,'health<=0 alone must not kill outright anymore');
  assert.ok(expose(context,'(Number(S.__criticalYears)||0)')===1,'first collapse starts the critical countdown');
  assert.ok(expose(context,'S.health')>=8,'the rescue raises health off zero');
  // Second consecutive year at zero: the file closes.
  expose(context,'World.year+=1; S.health=0;');
  expose(context,'checkMortality();');
  assert.equal(expose(context,'S.alive'),false,'two consecutive collapsed years do close the file');
});

test('recovery resets the critical countdown',()=>{
  const context=lifeContext('critical-reset');
  expose(context,'S.health=0; checkMortality();'); // rescued, critical=1
  expose(context,'S.health=60; checkMortality();'); // recovered
  assert.equal(expose(context,'(Number(S.__criticalYears)||0)'),0);
  expose(context,'S.health=0; checkMortality();'); // collapses again later
  assert.equal(expose(context,'S.alive'),true,'a fresh crisis after recovery starts fresh, not fatal');
});

test('despair requires isolation as well as emptiness (structural pin)',()=>{
  const src=fs.readFileSync('js/ui.js','utf8');
  const m=src.match(/S\.happiness<=0[^\n]*despairChance/);
  assert.ok(m,'despair branch located');
  assert.match(m[0],/relations/,'despair must be gated on low relations too');
});

test('scripted spouse loss now waits for real old age (structural pin)',()=>{
  const ui=fs.readFileSync('js/ui.js','utf8');
  const m=ui.match(/if\(S\.married&&S\.age>=62&&chance\(0\.012\+\(S\.age-62\)\*0\.0012\)\)/);
  assert.ok(m,'spouse natural-loss gate moved to 62 with a gentler curve');
});

test('NPC annual mortality table sits below every legacy value',()=>{
  const context=lifeContext('npc-table');
  const table=JSON.parse(expose(context,"JSON.stringify(NpcSystem.MORTALITY_TABLE)"));
  const legacy=[.010,.0005,.0011,.0038,.012,.034,.085,.19];
  table.forEach((v,i)=>assert.ok(v<legacy[i],'band '+i+' rarer than legacy'));
});
