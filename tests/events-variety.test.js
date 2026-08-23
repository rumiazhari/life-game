'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function contextWithLife(seed){
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
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js','js/education.js']);
  context.activeConditions=()=>[];
  return context;
}

test('every event is structurally sound: unique id, variant lines, sane age band',()=>{
  const context=contextWithLife('events-structure');
  expose(context,"Random.setSeed('events-structure'); newWorld(); newLineage(); newHold(); newSubject();");
  const problems=JSON.parse(expose(context,`(function(){
    const seen=new Set(), issues=[];
    EVENTS.forEach(e=>{
      if(seen.has(e.id)) issues.push('duplicate id '+e.id);
      seen.add(e.id);
      if(!Array.isArray(e.v)||e.v.length<1||!e.v.every(t=>typeof t==='string'&&t.length>4)) issues.push(e.id+' has no usable v[] lines');
      if(!Array.isArray(e.a)||e.a.length!==2||!(e.a[0]<=e.a[1])||e.a[0]<0||e.a[1]>130) issues.push(e.id+' has an invalid age band');
      if(e.if&&typeof e.if!=='function') issues.push(e.id+' if must be a function');
      if(e.fx&&typeof e.fx!=='function'&&typeof e.fx!=='object') issues.push(e.id+' fx must be object or function');
    });
    return JSON.stringify(issues);
  })()`));
  assert.deepEqual(problems,[]);
});

test('event pool is large and world-gated events exist',()=>{
  const context=contextWithLife('events-pool');
  expose(context,"Random.setSeed('events-pool'); newWorld(); newLineage(); newHold(); newSubject();");
  const stats=JSON.parse(expose(context,`JSON.stringify({
    total:EVENTS.length,
    worldGated:EVENTS.filter(function(e){return /settlements|EmploymentSystem|BusinessSystem|Hold\\.|holdMember/.test(String(e.if));}).length
  })`));
  assert.ok(stats.total>=100,'the annual event pool keeps growing, got '+stats.total);
  assert.ok(stats.worldGated>=9,'world-state gating drives playthrough divergence, got '+stats.worldGated);
});

test('every event gate can be evaluated safely across a full synthetic lifetime',()=>{
  const context=contextWithLife('events-fuzz');
  expose(context,"Random.setSeed('events-fuzz'); newWorld(); newLineage(); newHold(); newSubject();");
  const failures=JSON.parse(expose(context,`(function(){
    const bad=[];
    const base={assets:400,lifestyle:{housing:'flat',food:'basic',childcare:'basic'},jobTier:1,jobName:'Clerk',
      career:null,kids:0,married:false,contacts:[],liabilities:[],scrutiny:10,jailUntil:0,vice:0,happiness:55,
      record:false,eduStage:null,location:{settlementId:'branec'},mother:null,father:null};
    for(let age=0;age<=110;age+=2){
      const s=Object.assign({},base,{age});
      EVENTS.forEach(e=>{
        if(age<e.a[0]||age>e.a[1])return;
        try{ if(e.if&&!e.if(s))return; }catch(err){ bad.push(e.id+'@'+age+': '+err.message); }
      });
    }
    return JSON.stringify(bad.slice(0,10));
  })()`));
  assert.deepEqual(failures,[],'event gates must never throw on any subject shape');
});

test('lives diverge: the pulse surfaces different event mixes across seeds',()=>{
  const idsFor=seed=>{
    const context=contextWithLife(seed);
    expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject();");
    expose(context,"S.age=17; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=250; S.jobTier=0; S.jobName='Unemployed'; S.career=null; S.eduStage=null; S.jailUntil=0; S.kids=0; S.married=false; S.contacts=[]; S.liabilities=[]; S.location={settlementId:World.activeSettlementId};");
    for(let i=0;i<12;i++){ expose(context,'slipOpen=false;'); expose(context,'advance(true,true)'); }
    return JSON.parse(expose(context,"JSON.stringify(Object.keys(S.usedV))"));
  };
  const a=idsFor('divergence-alpha'), b=idsFor('divergence-beta'), c=idsFor('divergence-gamma');
  [a,b,c].forEach(list=>assert.ok(list.length>=4,'a life should log several distinct events, got '+list.length));
  const union=new Set([...a,...b,...c]);
  assert.ok(union.size>=10,'different seeds must sample different mixes, union '+union.size);
});
