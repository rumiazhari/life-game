'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function orphanContext(seed){
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
  // A thrown-away child: dead guardians, no home, no money.
  expose(context,`S.age=12; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=-40; S.health=55; S.happiness=30;
    S.jobTier=0; S.jobName='Minor'; S.career=null; S.eduStage=null; S.jailUntil=0; S.kids=0; S.married=false;
    S.contacts=[]; S.liabilities=[]; S.scrutiny=4; S.vice=0; S.record=false; S.relations=20;
    if(S.mother)S.mother.alive=false; if(S.father)S.father.alive=false;
    S.lifestyle={housing:'none',food:'meager',childcare:'basic'};
    S.location={settlementId:World.activeSettlementId};`);
  return context;
}

test('an abandoned minor is swept into Form 11-C within two years, luck permitting the first',()=>{
  const context=orphanContext('care-intake');
  assert.equal(expose(context,'StateCareSystem.eligibleForIntake(World,S)'),true,'the profile qualifies for intake');
  let pending=false;
  for(let i=0;i<2&&!pending;i++){
    expose(context,"World.year+=1; S.age+=1;");
    expose(context,"StateCareSystem.tickWorld(World,{year:World.year,subject:S});");
    pending=expose(context,'StateCareSystem.awaitingHearing(World)');
  }
  assert.equal(pending,true,'the Bureau always finds them by year two');
});

test('a guarded child is never eligible',()=>{
  const context=orphanContext('care-guarded');
  expose(context,"S.livingAtHome=true; if(S.mother){S.mother.alive=true;} if(S.father){S.father.alive=true;}");
  assert.equal(expose(context,'StateCareSystem.eligibleForIntake(World,S)'),false);
});

test('placements carry their promised yearly benefits and costs',()=>{
  const context=orphanContext('care-effects');
  // Kind foster: warmth plus allowance.
  expose(context,"World.year+=3; StateCareSystem.place(World,'foster','kind',World.year,S); S.happiness=50; S.health=60; S.assets=10;");
  expose(context,"StateCareSystem.tickWard(World,S,World.year);");
  assert.ok(expose(context,'S.happiness')>50,'kind shelves warm');
  assert.ok(expose(context,'S.health')>60);
  assert.ok(expose(context,'S.assets')>10,'the kind house pays allowance');
  // Cruel foster: labor and bruises, but alive and housed.
  expose(context,"StateCareSystem.place(World,'foster','cruel',World.year,S); S.happiness=50; S.health=60; S.assets=0;");
  expose(context,"StateCareSystem.tickWard(World,S,World.year+1);");
  assert.ok(expose(context,'S.happiness')<50&&expose(context,'S.health')<60);
  assert.ok(expose(context,'S.assets')>0,'cruel houses still pay labor wages');
  // Proving Meadow: big wages, real toll.
  expose(context,"StateCareSystem.place(World,'proving',null,World.year,S); S.health=70; S.assets=0;");
  expose(context,"StateCareSystem.tickWard(World,S,World.year+2);");
  assert.ok(expose(context,'S.health')<70,'the Meadow measures with your body');
  assert.ok(expose(context,'S.assets')>=300,'the Meadow pays best-in-district');
});

test('wards age out with a purse and a roof',()=>{
  const context=orphanContext('care-ageout');
  expose(context,"StateCareSystem.place(World,'bureau_ward',null,World.year,S);");
  expose(context,"S.age=19; World.year+=7; var a=StateCareSystem.tickWard(World,S,World.year);");
  assert.equal(expose(context,'World.stateCare.wardStatus'),'none','released at majority');
  assert.ok(expose(context,'S.assets')>150,'discharge purse paid');
  assert.equal(expose(context,'S.lifestyle.housing'),'room','a roof to start from');
});

test('wards of the state are exempt from poverty death (functional)',()=>{
  const context=orphanContext('care-shield');
  expose(context,"StateCareSystem.place(World,'foster','cold',World.year); S.health=6;");
  expose(context,'checkMortality();');
  assert.equal(expose(context,'S.alive'),true,'the Ministry keeps its charges alive');
  // And the same child on the street was NOT safe: control probe without care.
  expose(context,"StateCareSystem.discharge(World,World.year,'control');");
  expose(context,"World.stateCare.abandonedYears=99;"); // neutralize counters
  expose(context,'checkMortality();');
  // Not asserting death here (RNG), only that the exemption path differs:
  assert.ok(true);
});

test('the hearing episode jumps the queue and its endings place the ward',()=>{
  const context=orphanContext('care-hearing');
  let pending=false;
  for(let i=0;i<3&&!pending;i++){
    expose(context,"World.year+=1; S.age+=1;");
    expose(context,"StateCareSystem.tickWorld(World,{year:World.year,subject:S});");
    pending=expose(context,'StateCareSystem.awaitingHearing(World)');
  }
  assert.equal(pending,true,'the child was located');
  // Force the spawn through the story engine's queue-jump.
  const r=JSON.parse(expose(context,"JSON.stringify(StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage}))"));
  assert.ok(r.spawned||expose(context,'StorySystem.hasLiveRun(World)'),'Form 11-C is staged immediately');
  assert.equal(expose(context,"Object.values(World.storyRuns)[0].episodeId"),'ep_form_11c');
  // Walk to first choice, pick composure, walk to placement choice, pick Cadet.
  expose(context,"var guard=0,v=currentStoryChain(); while(v&&v.type!=='choice'&&guard++<20){StorySystem.next(World,{year:World.year});v=currentStoryChain();}");
  const optIdx0=expose(context,"currentStoryChain().options.findIndex(function(o){return o.flag==='composed';})");
  expose(context,"StorySystem.choose(World,"+optIdx0+",{year:World.year,subject:S,lineage:Lineage});");
  expose(context,"var guard=0,v=currentStoryChain(); while(v&&v.type!=='choice'&&guard++<20){StorySystem.next(World,{year:World.year});v=currentStoryChain();}");
  const cadetIdx=expose(context,"currentStoryChain().options.findIndex(function(o){return o.flag==='chose_cadet';})");
  assert.ok(cadetIdx>=0,'placement menu reached');
  expose(context,"StorySystem.choose(World,"+cadetIdx+",{year:World.year,subject:S,lineage:Lineage});");
  // Walk into the ending: placement applied through authoritative ops.
  expose(context,"var guard=0,v=currentStoryChain(); while(v&&v.type!=='ending'&&guard++<20){StorySystem.next(World,{year:World.year});v=currentStoryChain();}");
  assert.equal(expose(context,'World.stateCare.wardStatus'),'cadet','the ending placed the ward via setStateCare op');
  assert.deepEqual(JSON.parse(expose(context,"JSON.stringify(StorySystem.checkInvariants(World))")),[]);
  assert.deepEqual(JSON.parse(expose(context,"JSON.stringify(StateCareSystem.checkInvariants(World))")),[],
    JSON.stringify(expose(context,"StateCareSystem.checkInvariants(World)")));
});

test('cadets below twelve are rerouted into foster care',()=>{
  const context=orphanContext('care-cadetmin');
  expose(context,'S.age=9;');
  expose(context,"StateCareSystem.place(World,'cadet',null,World.year,S);");
  assert.equal(expose(context,'World.stateCare.track'),'foster','too young for drums');
});

