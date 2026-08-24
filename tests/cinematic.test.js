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
  context.addEventListener=()=>{}; context.timers=[];
  context.setTimeout=(fn,ms)=>{context.timers.push({fn,ms});return context.timers.length;};
  context.clearTimeout=()=>{};
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
    var bc=c.beatCount, idx=c.index;
    c.skip();
    c.skip();
    return JSON.stringify({beatCount:bc,indexAfterStart:idx,doneCount});
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

test('cinematic renders with S still null — the real New Game click order',()=>{
  // In the browser, startNewLife() fires BEFORE newFile()/newSubject().
  // S is null. The old code passed beat text through fill() which reads
  // S.place and explodes, leaving a blank black overlay.
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,_listeners:[],
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
  context.addEventListener=()=>{}; context.timers=[];
  context.setTimeout=(fn,ms)=>{context.timers.push({fn,ms});return context.timers.length;};
  context.clearTimeout=()=>{};
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  // Deliberately NO newSubject() — S is null, exactly like a fresh page load.
  assert.equal(expose(context,'S===null'),true,'S must be null (fresh page)');
  // The critical assertion: playIntroCinematic must not throw with S=null.
  const out=expose(context,`(function(){
    var doneCount=0;
    var c=playIntroCinematic(function(){doneCount++;});
    return JSON.stringify({doneCount:doneCount,beatCount:c.beatCount,index:c.index,
      hasSkip:typeof c.skip==='function',hasAdvance:typeof c.advance==='function'});
  })()`);
  const r=JSON.parse(out);
  assert.equal(r.doneCount,0,'must not auto-finish');
  assert.ok(r.beatCount>=8,'substantial cinematic');
  assert.equal(r.index,0,'starts on beat 0');
  assert.equal(r.hasSkip,true,'skip is available');
});

test('cinematic slides advance ONLY on click — zero timers',()=>{
  const context=menuContext('cine-click');
  context.timers=[];
  const timersBefore=context.timers.length;
  expose(context,"var __doneCount=0; var __c=playIntroCinematic(function(){__doneCount++;});");
  const timersAfterStart=context.timers.length;
  expose(context,"__c.advance();");
  const idxAfterAdvance=expose(context,'__c.index');
  expose(context,"__c.skip();");
  const doneAfterSkip=expose(context,'__doneCount');
  assert.equal(timersAfterStart,timersBefore,'zero timers — slides move only on click');
  assert.equal(idxAfterAdvance,1,'advance() moves to the next beat');
  assert.equal(doneAfterSkip,1,'skip fires the handoff');
});

test('every cinematic beat has an SVG illustration',()=>{
  const context=menuContext('cine-art');
  const results=JSON.parse(expose(context,`(function(){
    return JSON.stringify(INTRO_BEATS.map(function(b){
      var svg=icArt(b.art);
      return {art:b.art,hasSvg:svg.indexOf('<svg')>=0,length:svg.length};
    }));
  })()`));
  results.forEach(r=>{
    assert.ok(r.hasSvg,'beat art "'+r.art+'" must render an SVG');
    assert.ok(r.length>100,'beat art "'+r.art+'" must have real illustration detail');
  });
});

test('every story backdrop has an illustrated SVG scene (no bare gradients)',()=>{
  const context=menuContext('vn-art');
  const keys=['night_flat','factory_floor','schoolyard','dock_night','office','street'];
  for(const key of keys){
    const svg=expose(context,"vnBackdropArt(" + JSON.stringify(key) + ")");
    assert.match(svg,/^\s*<svg/,'backdrop '+key+' renders an inline SVG scene');
    assert.ok(svg.length>300,'scene '+key+' carries real illustration detail');
  }
  const htmlProbe=expose(context,"vnBackdropArt('dock_night')");
  assert.match(htmlProbe,/waterline|glowp/,'the docks scene animates');
});
