'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function session(seed='arcade-1'){
  const ctx=createWorldContext();
  const elements={};
  const make=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    style:{},dataset:{},innerHTML:'',textContent:'',disabled:false,handlers:{},
    addEventListener(t,fn){this.handlers[t]=fn;},removeEventListener(){},
    appendChild(){},remove(){},focus(){},setAttribute(){},
    querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;}
  });
  ctx.document={
    querySelector(k){return elements[k]||(elements[k]=make());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=make());},
    createElement(){return make();},addEventListener(){},
    body:make(),documentElement:make()
  };
  ctx.addEventListener=()=>{};ctx.setTimeout=()=>0;ctx.clearTimeout=()=>{};
  ctx.setInterval=()=>0;ctx.clearInterval=()=>{};
  loadGameFiles(ctx,['js/systems/story-quests.js','js/systems/story-rpg-checks.js','js/systems/story-quest-engine.js','js/systems/world-gameplay.js','js/medical.js','js/ui.js','js/ui/story-quest-ui.js']);
  expose(ctx,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
    "S.age=30;S.alive=true;S.assets=600;S.health=85;S.happiness=65;S.jailUntil=0;World.year=S.dob+S.age;StorySystem.ensure(World);");
  return {ctx,elements};
}
function click(ctx,attribute,id){
  const expr="(function(){const b=document.getElementById('storySheet');"+
    "b.handlers.click({target:{closest:(selector)=>selector==='["+attribute+"]'?"+
    "{dataset:{"+(attribute==='data-qs-bg'?'qsBg':'qsPerk')+":"+JSON.stringify(id)+"}}:null}});})();";
  return expose(ctx,expr);
}
test('new subject chooses an existing RPG background once, with immediate check consequences',()=>{
  const {ctx}=session('arcade-background');
  expose(ctx,'renderStoryBoard()');
  let page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.match(page,/data-qs-bg="scholar"/);
  assert.match(page,/data-qs-bg="streets"/);
  const before=expose(ctx,"RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'study',difficulty:'hard'}).successes");
  click(ctx,'data-qs-bg','scholar');
  const after=expose(ctx,"RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'study',difficulty:'hard'}).successes");
  assert.equal(expose(ctx,"RPG.recordFor(World,'subject').background"),'scholar');
  assert.ok(after>before);
  page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.doesNotMatch(page,/data-qs-bg="streets"/);
  assert.equal(expose(ctx,"RPG.setBackground(World,'subject','streets').reason"),'set');
});
test('grade II offers exactly one eligible earned perk selection, never a second slot',()=>{
  const {ctx}=session('arcade-perk');
  expose(ctx,"RPG.addMerit(World,'subject',60,'setup',World.year);renderStoryBoard()");
  let page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.match(page,/data-qs-perk="silvertongue"/);
  const before=expose(ctx,"RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'social',difficulty:'hard'}).successes");
  click(ctx,'data-qs-perk','silvertongue');
  const after=expose(ctx,"RPG.previewCheck(World,{actorId:'subject',subject:S,domain:'social',difficulty:'hard'}).successes");
  assert.ok(after>before);
  assert.equal(expose(ctx,"RPG.recordFor(World,'subject').perks.silvertongue"),true);
  page=expose(ctx,"document.getElementById('storySheet').innerHTML");
  assert.doesNotMatch(page,/data-qs-perk="ironstomach"/);
  assert.equal(expose(ctx,"RPG.unlockPerk(World,'subject','ironstomach').reason"),'slots');
});
test('existing character background survives old-state initialization',()=>{
  const {ctx}=session('arcade-legacy');
  expose(ctx,"RPG.setBackground(World,'subject','veteran');renderStoryBoard()");
  assert.equal(expose(ctx,"RPG.recordFor(World,'subject').background"),'veteran');
  assert.doesNotMatch(expose(ctx,"document.getElementById('storySheet').innerHTML"),/data-qs-bg="/);
});

