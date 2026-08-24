'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createWorldContext,createGameContext,loadGameFiles,expose}=require('./helpers/vm-loader');

const ILLUSTRATION='js/illustration.js';

function artContext(seed,extraFiles){
  const context=createGameContext(['js/lore.js','js/data.js','js/state.js','js/map.js']);
  loadGameFiles(context,[ILLUSTRATION].concat(extraFiles||[]));
  return context;
}
/* Full UI context: mock document + all systems + illustration + ui.js,
 * mirroring how cinematic.test.js builds its menu context. */
function fullUiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,
    scrollTop:0,scrollHeight:0,offsetWidth:1200,offsetHeight:900,clientWidth:1200,clientHeight:900,_listeners:[],
    appendChild(){},remove(){},addEventListener(){},removeEventListener(){},setAttribute(){},
    getBoundingClientRect(){return {left:0,top:0,width:1200,height:900};},focus(){},click(){},querySelectorAll(){return [];},querySelector(){return null;}
  });
  context.document={
    querySelector(s){return elements[s]||(elements[s]=makeElement());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=makeElement());},
    createElement(){return makeElement();},
    addEventListener(){}, body:makeElement(), documentElement:makeElement()
  };
  context.addEventListener=()=>{}; context.timers=[];
  context.setTimeout=(fn,ms)=>{context.timers.push({fn,ms});return context.timers.length;};
  context.clearTimeout=()=>{};
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js',ILLUSTRATION,'js/ui.js']);
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject();");
  return context;
}

/* ---------------- determinism ---------------- */
test('same person descriptor produces byte-identical SVG every render',()=>{
  const c=artContext('det');
  const d={id:'npc:000042',sex:'F',age:34};
  const runs=[1,2,3].map(()=>expose(c,"IllustrationSystem.personPortrait("+JSON.stringify(d)+")"));
  assert.equal(runs[0],runs[1]);
  assert.equal(runs[1],runs[2]);
  assert.match(runs[0],/^\s*<svg/);
});

test('same event context produces byte-identical scene artwork every render',()=>{
  const c=artContext('det-scene');
  const expr="IllustrationSystem.eventScene('romance',{seed:'sf-123',settlementId:'veskar',year:1934})";
  const runs=[1,2].map(()=>expose(c,expr));
  assert.equal(runs[0],runs[1]);
});

test('scene variants differ across seeds so repeated events do not repeat compositions',()=>{
  const c=artContext('variants');
  const seen=new Set();
  for(let i=0;i<6;i++){
    seen.add(expose(c,"IllustrationSystem.eventScene('workplace',{seed:"+JSON.stringify('seed'+i)+"})"));
  }
  assert.ok(seen.size>1,'different seeds should yield different variants, got '+seen.size);
});

/* ---------------- identity ---------------- */
test('distinct stable person IDs produce distinct visual identities',()=>{
  const c=artContext('identity');
  const sigs=[];
  for(let i=1;i<=12;i++){
    sigs.push(expose(c,"IllustrationSystem.featureSignature('npc:"+String(i).padStart(6,'0')+"')"));
  }
  assert.equal(new Set(sigs).size,sigs.length,'all sampled identities must differ');
});

test('aging keeps identity but changes presentation',()=>{
  const c=artContext('aging');
  const sigYoung=expose(c,"IllustrationSystem.featureSignature('kin:K77')");
  const p20=expose(c,"IllustrationSystem.personPortrait({id:'kin:K77',sex:'M',age:20})");
  const p45=expose(c,"IllustrationSystem.personPortrait({id:'kin:K77',sex:'M',age:45})");
  const p75=expose(c,"IllustrationSystem.personPortrait({id:'kin:K77',sex:'M',age:75})");
  const sigOld=expose(c,"IllustrationSystem.featureSignature('kin:K77')");
  assert.equal(sigYoung,sigOld,'the underlying face identity must not change with age');
  assert.notEqual(p20,p75);
  assert.notEqual(p20,p45);
  // structural age markers appear late, never early: forehead lines are
  // drawn only from middle age on, and photograph wear deepens with decades
  assert.doesNotMatch(p20,/q10 -3 20 0|opacity="0\.4"/);
  assert.match(p45,/opacity="0\.28"/,'middle-age wrinkle pass');
  assert.match(p45,/q10 -3 20 0/,'forehead lines begin in middle age');
  assert.match(p75,/q10 -3 20 0/,'elder forehead lines');
  assert.match(p75,/opacity="0\.26"/,'worn archival photo treatment');
});

test('every age band renders and bands are ordered sensibly',()=>{
  const c=artContext('bands');
  const out=expose(c,`(function(){
    var ages=[1,7,15,24,38,52,80], arts=[], bands=[];
    ages.forEach(function(a){ var d={id:'band-test',sex:'F',age:a}; arts.push(IllustrationSystem.personPortrait(d)); bands.push(IllustrationSystem.ageBandOf(a)); });
    return JSON.stringify({unique:new Set(arts).size,bands:bands});
  })()`);
  const r=JSON.parse(out);
  assert.equal(r.unique,7,'each life stage must look structurally different');
  assert.deepEqual(r.bands,['infant','child','teen','young','adult','middle','elder']);
});

/* ---------------- no state mutation ---------------- */
test('rendering portraits and scenes leaves World, S, Lineage and Hold byte-identical',()=>{
  const c=fullUiContext('nomutate');
  const snap=()=>expose(c,"JSON.stringify({w:World,s:S,l:Lineage,h:Hold})");
  const before=snap();
  expose(c,`(function(){
    // portraits from live state
    IllustrationSystem.subjectPortrait(S);
    Object.keys(World.npcs).slice(0,6).forEach(function(id){ IllustrationSystem.personPortrait(IllustrationSystem.npcDescriptor(World.npcs[id],World)); });
    if(S.mother) IllustrationSystem.personPortrait(IllustrationSystem.parentDescriptor(S.mother,'mother',S));
    if(S.contacts.length) IllustrationSystem.personPortrait(IllustrationSystem.contactDescriptor(S.contacts[0],World.year));
    // scenes
    ['birth','graduation','illness','death','bureau'].forEach(function(k){ IllustrationSystem.eventScene(k,{seed:S.id,settlementId:World.activeSettlementId}); });
    // notice routing helper
    IllustrationSystem.noticeArt('A child was born to the subject.','The Bureau congratulates.',{seed:S.id});
    return true;
  })()`);
  assert.equal(snap(),before,'illustrations must be pure reads of game state');
});

test('the illustration system never touches gameplay RNG streams',()=>{
  const c=fullUiContext('rngpure');
  const rngState=()=>expose(c,"(function(){var r=[];for(var k in Random){}return Random.next();})()");
  // Draw one value to advance the shared stream, remember the next three,
  // render lots of artwork, then verify the next three are unchanged.
  const seqBefore=expose(c,"(function(){Random.next();return [Random.next(),Random.next(),Random.next()].join(',');})()");
  // NOTE: reading advanced the stream by 4 total; reset to a known seed and
  // compare against an artwork-free run instead.
  const runWith=(withArt)=>{
    expose(c,"Random.setSeed('rng-check');");
    expose(c,"Random.next();"); // burn one, both runs identical so far
    if(withArt){
      expose(c,"IllustrationSystem.personPortrait({id:'x',sex:'M',age:30});IllustrationSystem.eventScene('travel',{seed:'q'});");
    }
    return expose(c,"[Random.next(),Random.next(),Random.next()].join(',')");
  };
  assert.equal(runWith(false),runWith(true),'artwork must consume zero RNG values');
  void rngState;
  void seqBefore;
});

/* ---------------- person resolution ---------------- */
test('portraits resolve for player, persistent NPC, story cast, and unknown fallback',()=>{
  const c=fullUiContext('resolve');
  const out=expose(c,`(function(){
    var r={};
    r.player=IllustrationSystem.subjectPortrait(S);
    var npcId=Object.keys(World.npcs)[0];
    r.npc=npcId?IllustrationSystem.personPortrait(IllustrationSystem.npcDescriptor(World.npcs[npcId],World)):'';
    var run={cast:{spouse:{label:'Ilonka Voss',bind:(S.contacts[0]?S.contacts[0].cid:'contact:none')},child:{label:'the child',bind:'kin:NOPE'},rival:{label:'Foreman Brakke'}}};
    r.castContact=IllustrationSystem.storyPortrait(run,'spouse','Ilonka Voss',World,S)||'';
    r.castFallback=IllustrationSystem.storyPortrait(run,'rival','Foreman Brakke',World,S)||'';
    r.unknown=IllustrationSystem.storyPortrait(run,'nobody','Nobody',World,S)||'';
    r.you=IllustrationSystem.storyPortrait(run,'you','YOU',World,S)||'';
    return JSON.stringify({
      playerSvg:r.player.indexOf('<svg')===0,playerLen:r.player.length,
      npcSvg:r.npc.indexOf('<svg')===0,npcLen:r.npc.length,
      castContact:r.castContact.indexOf('<svg')>=0,
      castFallback:r.castFallback.indexOf('<svg')>=0,
      unknownEmpty:r.unknown===''||r.unknown.indexOf('<svg')<0,
      youIsPlayerFace:r.you===r.player||r.you.indexOf('<svg')===0
    });
  })()`);
  const r=JSON.parse(out);
  assert.equal(r.playerSvg,true); assert.ok(r.playerLen>800,'player portrait must be substantial');
  assert.equal(r.npcSvg,true);   assert.ok(r.npcLen>800,'NPC portrait must be substantial');
  assert.equal(r.castContact,true,'cast bound to a real contact must resolve to a bust');
  assert.equal(r.castFallback,true,'unresolved-but-keyed cast falls back to stable identity art');
  assert.equal(r.youIsPlayerFace,true,'the "you" speaker uses the subject portrait');
});

test('contacts without NPC records get stable identity keyed by their bind ID',()=>{
  const c=fullUiContext('contact-stable');
  const expr=(cid)=>"(function(){var run={cast:{f:{label:'Old Halasz',bind:"+JSON.stringify(cid)+"}}};return IllustrationSystem.storyPortrait(run,'f','Old Halasz',null,S)||'';})()";
  const a=expose(c,expr('Nabc123'));
  const b=expose(c,expr('Nabc123'));
  const other=expose(c,expr('Nzzz999'));
  assert.equal(a,b,'same contact id -> same face');
  assert.notEqual(a,other,'different contacts must not share one face');
});

/* ---------------- event artwork ---------------- */
test('every supported scene family returns substantial multi-shape artwork',()=>{
  const c=artContext('scenes');
  const out=expose(c,`(function(){
    var keys=IllustrationSystem.SCENE_KEYS, report={};
    keys.forEach(function(k){
      var svg=IllustrationSystem.eventScene(k,{seed:'quality'});
      var shapes=(svg.match(/<(rect|path|circle|ellipse|line|polygon)/g)||[]).length;
      report[k]={len:svg.length,shapes:shapes,isSvg:svg.indexOf('<svg')===0};
    });
    return JSON.stringify(report);
  })()`);
  const report=JSON.parse(out);
  const expected=['birth','childhood','school','graduation','firstjob','workplace','promotion','jobloss',
    'friendship','romance','family','conflict','illness','clinic','recovery','movinghome','poverty',
    'travel','bureau','achievement','oldage','death'];
  expected.forEach(k=>assert.ok(report[k],'missing scene family: '+k));
  Object.keys(report).forEach(k=>{
    assert.equal(report[k].isSvg,true,k+' must render inline SVG');
    assert.ok(report[k].len>900,k+' must carry real illustration detail ('+report[k].len+' chars)');
    assert.ok(report[k].shapes>=10,k+' must be a composed scene, not a bare rectangle ('+report[k].shapes+' shapes)');
  });
});

test('milestone text routes to sensible scene families',()=>{
  const c=artContext('routing');
  const route=(t)=>expose(c,"IllustrationSystem.sceneKeyFromText("+JSON.stringify(t)+")");
  assert.equal(route('ENTRY TERMINATED. Subject deceased.'),'death');
  assert.equal(route('A child was born to the subject.'),'birth');
  assert.equal(route('Subject graduated from the University.'),'graduation');
  assert.equal(route('Subject was promoted to Chief Engineer.'),'promotion');
  assert.equal(route('FORM 11-C hearing scheduled.'),'bureau');
  assert.equal(route('Subject arrived in Rudava.'),'travel');
  assert.equal(route('The weather was ordinary.'),'');
});

/* ---------------- no external artwork dependency ---------------- */
test('generated artwork references no external images or URLs',()=>{
  const c=artContext('offline');
  const all=expose(c,`(function(){
    var s='';
    IllustrationSystem.SCENE_KEYS.forEach(function(k){ s+=IllustrationSystem.eventScene(k,{seed:'net'}); });
    ['npc:1','npc:2','subject:x'].forEach(function(id){ s+=IllustrationSystem.personPortrait({id:id,sex:id==='npc:2'?'F':'M',age:40}); });
    return s;
  })()`);
  const stripped=all.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g,'');
  assert.equal(/https?:\/\//.test(stripped),false,'no network URLs');
  assert.equal(/<image|xlink:href|\.png|\.jpg|\.gif|\.webp|@import/i.test(stripped),false,'no raster or imported assets');
  const urls=all.match(/url\([^)]*\)/g)||[];
  assert.ok(urls.every(u=>/\(?#/.test(u)&&u.indexOf('http')<0),"all url() references must be internal SVG fragments, got "+urls.filter(u=>u.indexOf('#')<0).join(','));
});

/* ---------------- people-card integration ---------------- */
test('memberCard embeds a compact portrait when the illustration system is loaded',()=>{
  const c=createWorldContext();
  loadGameFiles(c,[ILLUSTRATION,'js/systems/persistent-people-ui.js']);
  expose(c,"Random.setSeed('cards'); newWorld(); newLineage(); newHold(); newSubject();");
  const html=expose(c,`(function(){
    var id=Object.keys(World.npcs).find(function(k){return !World.npcs[k].isSubject;});
    var card=globalThis.PersistentPeopleUI.memberCard(World.npcs[id],World,S.npcId);
    return JSON.stringify({hasPortrait:card.indexOf('pp-portrait')>=0,hasSvg:card.indexOf('<svg')>=0,hasName:card.indexOf('persistent-person-head')>=0});
  })()`);
  const r=JSON.parse(html);
  assert.equal(r.hasPortrait,true);
  assert.equal(r.hasSvg,true);
  assert.equal(r.hasName,true,'card must keep its textual identity fields');
});

test('memberCard degrades gracefully when the illustration system is absent',()=>{
  const c=createWorldContext(); // no js/illustration.js
  loadGameFiles(c,['js/systems/persistent-people-ui.js']);
  expose(c,"Random.setSeed('cards2'); newWorld(); newLineage(); newHold(); newSubject();");
  const html=expose(c,`(function(){
    var id=Object.keys(World.npcs).find(function(k){return !World.npcs[k].isSubject;});
    var card=globalThis.PersistentPeopleUI.memberCard(World.npcs[id],World,S.npcId);
    return JSON.stringify({hasPortrait:card.indexOf('pp-portrait')>=0,hasName:card.indexOf('persistent-person-head')>=0});
  })()`);
  const r=JSON.parse(html);
  assert.equal(r.hasPortrait,false,'no artwork module -> no broken markup');
  assert.equal(r.hasName,true);
});

/* ---------------- cinematic regression (presentation coexistence) ------- */
test('cinematic and VN backdrops still work with the illustration system loaded',()=>{
  const c=fullUiContext('illus-coexist');
  assert.equal(expose(c,"typeof IllustrationSystem"),'object');
  assert.equal(expose(c,"typeof playIntroCinematic"),'function');
  const backdropOk=expose(c,"(function(){var s=vnBackdropArt('dock_night');return s.indexOf('<svg')===0&&s.indexOf('waterline')>=0;})()");
  assert.equal(backdropOk,true,'existing animated backdrops untouched');
  const cine=expose(c,"(function(){var done=0;var x=playIntroCinematic(function(){done++;});x.skip();return JSON.stringify({done:done,count:x.beatCount});})()");
  const r=JSON.parse(cine);
  assert.equal(r.done,1);
  assert.ok(r.count>=8);
});
/* ---------------- reduced motion / stylesheet contract ------------------ */
test('new presentation animations respect prefers-reduced-motion',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','css','style.css'),'utf8');
  // locate the final reduced-motion block and confirm our animated classes are covered there
  const idx=css.lastIndexOf('@media (prefers-reduced-motion:reduce)');
  assert.ok(idx>0,'a reduced-motion block must exist');
  const block=css.slice(idx);
  ['.ev-plate','.vn-bust','.photo.photo-swap','.photo-replace-mark'].forEach(cls=>{
    assert.ok(block.includes(cls),'reduced-motion block must neutralize '+cls);
  });
  assert.ok(block.includes('opacity:1!important'),'reduced motion must still SHOW the busts, not hide them');
  // mobile rules exist so narrow screens stay usable
  assert.ok(css.includes('.vn-backdrop.with-cast'),'VN cast backdrop sizing rule missing');
  assert.ok(/@media\(max-width:560px\)\{[^}]*\.pp-portrait/.test(css.replace(/\n/g,'')),'mobile portrait sizing rule missing');
});

test('script load order places the illustration system before its consumers',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','life-game.html'),'utf8');
  const pos=(name)=>html.indexOf(name);
  assert.ok(pos('js/illustration.js')>0,'life-game.html must load js/illustration.js');
  assert.ok(pos('js/illustration.js')<pos('js/systems/persistent-people-ui.js'),'illustration must load before persistent-people-ui');
  assert.ok(pos('js/illustration.js')<pos('js/ui.js'),'illustration must load before ui.js');
});
