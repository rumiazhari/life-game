'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function menuContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,
    scrollTop:0,scrollHeight:0,offsetWidth:1200,offsetHeight:900,clientWidth:1200,clientHeight:900,_listeners:[],
    appendChild(){},remove(){},addEventListener(t){this._listeners.push(t);},removeEventListener(){},setAttribute(){},
    getBoundingClientRect(){return {left:0,top:0,width:1200,height:900};},focus(){},click(){},querySelectorAll(){return [];}
  });
  context.document={
    querySelector(s){return elements[s]||(elements[s]=makeElement());},
    querySelectorAll(){return [];},
    getElementById(id){return elements['#'+id]||(elements['#'+id]=makeElement());},
    createElement(){return makeElement();},
    addEventListener(){}, body:makeElement(), documentElement:makeElement()
  };
  context.addEventListener=()=>{}; context.setTimeout=(fn,ms)=>{context.timers.push({fn,ms});return context.timers.length;};
  context.clearTimeout=()=>{}; context.timers=[];
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject();");
  return context;
}

test('the New Game cinematic exists, is substantial, and hands off exactly once',()=>{
  const context=menuContext('cine');
  assert.equal(expose(context,'typeof playIntroCinematic'), 'function');
  assert.equal(expose(context,'typeof startNewLife'), 'function');
  const out=expose(context,`(function(){
    var doneCount=0; var c=playIntroCinematic(function(){doneCount++;});
    var first={beatCount:c.beatCount,indexAfterStart:c.index};
    c.skip();
    c.skip();
    return JSON.stringify({beatCount:first.beatCount,idxType:typeof c.index,indexAfterStart:c.index,doneCount});
  })()`);
  const r=JSON.parse(out);
  assert.ok(r.beatCount>=8,'the cinematic tells a real story, got '+r.beatCount+' beats');
  assert.equal(r.indexAfterStart,0,'it starts on the opening beat');
  assert.equal(r.doneCount,1,'skip fires the handoff exactly once, even pressed twice');
});

test('cinematic beats carry the Bureau voice: what-will-you-be framing',()=>{
  const context=menuContext('cine-voice');
  const beats=JSON.parse(expose(context,"JSON.stringify(INTRO_BEATS)"));
  const joined=beats.map(b=>(b.main||'')+' '+(b.sub||'')).join('\n').toUpperCase();
  assert.ok(joined.includes('WHAT WILL YOU BE'),'the central question is asked');
  assert.ok(joined.includes('FILE'),'the file motif opens the story');
  assert.ok(joined.includes('CHILD IS BORN'),'the cinematic ends at a birth');
  assert.ok(beats[beats.length-1].stamp,'the final beat stamps the file open');
});

test('every story backdrop has an illustrated SVG scene (no bare gradients)',()=>{
  const context=menuContext('vn-art');
  const keys=['night_flat','factory_floor','schoolyard','dock_night','office','street'];
  for(const key of keys){
    const svg=expose(context,"vnBackdropArt(" + JSON.stringify(key) + ")");
    assert.match(svg,/^\s*<svg/,'backdrop '+key+' renders an inline SVG scene');
    assert.ok(svg.length>300,'scene '+key+' carries real illustration detail');
  }
  // And the VN window injects the art.
  const htmlProbe=expose(context,"vnBackdropArt('dock_night')");
  assert.match(htmlProbe,/waterline|glowp/,'the docks scene animates');
});
