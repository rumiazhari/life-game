'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function storyContext(seed){
  const context=createWorldContext();
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject();");
  expose(context,`S.age=32; World.year=S.dob+S.age; S.livingAtHome=false; S.assets=600; S.health=80; S.happiness=55;
    S.jobTier=1; S.jobName='Clerk'; S.career=null; S.eduStage=null; S.jailUntil=0; S.kids=0; S.married=true;
    S.scrutiny=8; S.vice=1; S.record=false; S.relations=58;
    S.lifestyle={housing:'flat',food:'basic',childcare:'basic'};
    S.location={settlementId:World.activeSettlementId};
    var p=makeContact('F'); p.role='spouse'; p.name='Mira Voss'; p.mood=48; S.contacts.push(p); S.partner='Mira Voss';
    addKin({first:'Tomas',last:S.last,sex:'M',dob:currentYear()-9,relation:'child',bond:72});`);
  return context;
}
// A dominant test episode so selection is fully deterministic.
function installTestEpisode(context){
  expose(context,`StoryEpisodes.push({
    id:'ep_zztest',domain:'test',
    cast:function(){return [{key:'x',label:'Xander Quill'}];},
    eligible:function(){return true;}, weight:function(){return 100;},
    build:function(bind){return {
      title:'THE TEST EPISODE', bg:'office',
      scenes:{
        a:{lines:[
             {sp:'narrator',t:'A room. A man named '+bind[0].label+'. A decision.'},
             {sp:'x',t:'"Choose wisely," he said.'}],
           choice:{prompt:'Pick one.',options:[
             {t:'The greedy door',note:'greedy note',tone:'greedy',flag:'took_greedy',goto:'end1',effects:[{kind:'money',delta:-999999},{kind:'scrutiny',delta:500}]},
             {t:'The kind door',tone:'kind',flag:'took_kind',goto:'end2',effects:[{kind:'partnerMood',delta:30}]}]}},
        end1:{ending:{id:'greedy_end',title:'GREEDY ENDING',tone:'greedy',epilogue:['It is done, greedily.'],effects:[{kind:'stat',stat:'happiness',delta:-3}]}},
        end2:{ending:{id:'kind_end',title:'KIND ENDING',tone:'kind',epilogue:['It is done, kindly.'],effects:[{kind:'stat',stat:'happiness',delta:99}]}}
      }};}
  });`);
}

test('tick is same-year idempotent, stale-year safe, and hosts at most one live episode',()=>{
  const context=storyContext('vn-idem');
  const r1=JSON.parse(expose(context,"JSON.stringify(StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage}))"));
  const r2=JSON.parse(expose(context,"JSON.stringify(StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage}))"));
  const stale=JSON.parse(expose(context,"JSON.stringify(StorySystem.tickWorld(World,{year:World.year-4,subject:S,lineage:Lineage}))"));
  assert.equal(r2.reason,'already_applied');
  assert.equal(stale.reason,'stale_year');
  if(r1.spawned) assert.equal(expose(context,"Object.keys(World.storyRuns).length"),1);
});

test('episode selection is life-driven and deterministic per seed',()=>{
  // The cold-marriage subject makes the spouse episode eligible.
  const context=storyContext('vn-select');
  installTestEpisode(context);
  let spawned=null;
  for(let i=0;i<12&&!spawned;i++){
    expose(context,'World.year+=1;');
    spawned=expose(context,"(function(){var r=StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage});return r.spawned||null;})()");
  }
  assert.ok(spawned,'an episode must spawn for an earned life-state');
  const title=expose(context,"World.storyRuns['"+spawned+"'].title");
  assert.equal(title,'THE TEST EPISODE','the dominant eligible episode wins deterministically');
  // Same seed rebuild reproduces it byte-for-byte.
  const context2=storyContext('vn-select');
  installTestEpisode(context2);
  let s2=null;
  for(let i=0;i<12&&!s2;i++){
    expose(context2,'World.year+=1;');
    s2=expose(context2,"(function(){var r=StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage});return r.spawned||null;})()");
  }
  assert.equal(expose(context2,"World.storyRuns['"+s2+"'].title"),title);
});

test('a full playthrough walks lines, branches at choices, lands an ending exactly once',()=>{
  const context=storyContext('vn-play');
  installTestEpisode(context);
  expose(context,"StorySystem.ensure(World); World.year+=1;");
  const spawned=expose(context,"(function(){var r=StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage});return r.spawned||null;})()");
  assert.ok(spawned);
  // Beat 1: narrator line
  let v=JSON.parse(expose(context,"JSON.stringify(StorySystem.currentView(World,{year:World.year}))"));
  assert.equal(v.type,'line'); assert.equal(v.speaker.key,'narrator');
  // Beat 2: quoted dialogue
  v=JSON.parse(expose(context,"JSON.stringify((StorySystem.next(World,{year:World.year}),StorySystem.currentView(World,{year:World.year})))"));
  assert.equal(v.type,'line'); assert.equal(v.speaker.key,'x'); assert.match(v.text,/Choose wisely/);
  // Beat 3: choice point
  v=JSON.parse(expose(context,"JSON.stringify((StorySystem.next(World,{year:World.year}),StorySystem.currentView(World,{year:World.year})))"));
  assert.equal(v.type,'choice'); assert.equal(v.options.length,2);
  // Choose the greedy branch: consequences clamp hard, once.
  const res=JSON.parse(expose(context,"JSON.stringify(StorySystem.choose(World,0,{year:World.year,subject:S}))"));
  assert.equal(res.applied,true);
  assert.ok(expose(context,'S.assets')>-200000,'money op respects its documented floor');
  const scrutinyBefore=expose(context,'S.scrutiny');
  void scrutinyBefore;
  assert.ok(expose(context,'S.scrutiny')>=30&&expose(context,'S.scrutiny')<=100,'scrutiny surged under the per-op bound');
  const twice=JSON.parse(expose(context,"JSON.stringify(StorySystem.choose(World,0,{year:World.year,subject:S}))"));
  assert.equal(twice.applied,false,'the same choice cannot be applied twice');
  // Ending view then filing
  const end=JSON.parse(expose(context,"JSON.stringify((StorySystem.next(World,{year:World.year}),StorySystem.currentView(World,{year:World.year})))"));
  assert.equal(end.type,'ending'); assert.equal(end.ending.id,'greedy_end');
  const filed=JSON.parse(expose(context,"JSON.stringify(StorySystem.fileAway(World,"+JSON.stringify(end.runId)+",{year:World.year}))"));
  assert.equal(filed.applied,true);
  const again=JSON.parse(expose(context,"JSON.stringify(StorySystem.fileAway(World,"+JSON.stringify(end.runId)+",{year:World.year}))"));
  assert.equal(again.applied,false);
  const arch=JSON.parse(expose(context,"JSON.stringify(Object.values(World.storyArchive)[0])"));
  assert.equal(arch.endingId,'greedy_end');
  assert.deepEqual(JSON.parse(expose(context,"JSON.stringify(StorySystem.checkInvariants(World))")),[]);
});

test('archive signatures block quick reruns of the same episode+cast',()=>{
  const context=storyContext('vn-repeat');
  expose(context,"StorySystem.ensure(World);"+
    "World.storyArchive['story-archive:00001']={id:'story-archive:00001',episodeId:'ep_voss_letter',domain:'spouse',title:'X',castKey:'',signature:'ep_voss_letter|spouse:p1',startedYear:World.year-1,resolvedYear:World.year-1,endingId:'renewal',endingTitle:'',tone:'kind',echoLine:''}; World.storyArchiveCounter=1;");
  assert.equal(expose(context,"StorySystem.signatureBlocked(World,'ep_voss_letter|spouse:p1',World.year)"),true);
  assert.equal(expose(context,"StorySystem.signatureBlocked(World,'ep_voss_letter|other',World.year)"),false);
});

test('fast-forward auto-plays the whole episode to its ending without UI',()=>{
  const context=storyContext('vn-ff');
  installTestEpisode(context);
  expose(context,"World.year+=1;");
  expose(context,"StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage});"); // may or may not spawn
  expose(context,"if(!StorySystem.hasLiveRun(World)){World.year+=1;StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage});}");
  assert.ok(expose(context,'StorySystem.hasLiveRun(World)'),'a live run exists before auto-resolution');
  expose(context,"S.__ffLog=[]; var r=StorySystem.tickWorld(World,{year:World.year+1,subject:S,lineage:Lineage,autoResolve:true,actorTone:'hustler'}); window.__res=r; World.year+=1;");
  const resolvedCount=expose(context,'window.__res.resolved.length');
  assert.equal(resolvedCount,1,'the live episode auto-completed');
  assert.equal(expose(context,'StorySystem.hasLiveRun(World)'),false,'nothing stays live under fast-forward');
  assert.equal(expose(context,"Object.values(World.storyArchive).length"),1);
  assert.deepEqual(JSON.parse(expose(context,"JSON.stringify(StorySystem.checkInvariants(World))")),[]);
});

/* ---------- UI: the visual novel window ---------- */
function uiContext(seed){
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
  return context;
}

test('the VN window renders speaker plates, quoted lines, choices, and the END card',()=>{
  const context=uiContext('vn-ui');
  loadGameFiles(context,[]); // no-op guard for readers
  expose(context,"S.age=30; World.year=S.dob+S.age; slipOpen=false;");
  installTestEpisode(context);
  expose(context,"StorySystem.ensure(World); World.year+=1;");
  expose(context,"StorySystem.tickWorld(World,{year:World.year,subject:S,lineage:Lineage});");
  assert.ok(expose(context,'StorySystem.hasLiveRun(World)'),'episode staged for the window');
  expose(context,'openStorySlip(true);');
  let html=expose(context,"document.getElementById('slipCard').innerHTML");
  assert.ok(html.includes('KARSEN FILES'),'the series header shows');
  assert.ok(html.includes('vn-backdrop'),'a backdrop stage renders');
  assert.ok(html.includes('Xander Quill'),'the cast plate names the speaker');
  assert.ok(html.includes('NEXT'),'lines advance with NEXT');
  // Walk to the choice through the real UI handlers.
  expose(context,"while(currentStoryChain()&&currentStoryChain().type==='line'){StorySystem.next(World,{year:World.year});} openStorySlip(true);");
  html=expose(context,"document.getElementById('slipCard').innerHTML");
  assert.match(html,/data-vn-opt="\d"/,'choice cards render');
  assert.ok(html.includes('will be remembered'),'choices carry Telltale-style notes');
  // Pick branch 0 through the engine, re-render: END card appears.
  expose(context,"var v=currentStoryChain(); StorySystem.choose(World,v.options[0].index,{year:World.year,subject:S});");
  expose(context,"while(currentStoryChain()&&currentStoryChain().type!=='ending'){StorySystem.next(World,{year:World.year});} openStorySlip(true);");
  html=expose(context,"document.getElementById('slipCard').innerHTML");
  assert.ok(html.includes('THE END'),'the endcard stamps the finale');
  assert.ok(html.includes('File It Away'),'filing control present');
  // Filing closes and archives.
  expose(context,'closeStorySlip();');
  assert.equal(expose(context,'slipOpen'),false);
  assert.equal(expose(context,'StorySystem.hasLiveRun(World)'),false);
  assert.equal(expose(context,'Object.values(World.storyArchive).length'),1);
});

test('the old popup-era APIs are gone from the runtime surface',()=>{
  const src=fs.readFileSync('js/systems/story-system.js','utf8');
  assert.ok(!src.includes('pendingDecisionForUi'));
  assert.ok(!src.includes('applyEffects'));
});
