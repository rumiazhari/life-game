'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,createGameContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function mapContext(){
  return createGameContext(['js/map.js']);
}
function worldMapContext(){
  const context=createWorldContext();
  expose(context,'newWorld(); newLineage(); newHold(); newSubject();');
  return context;
}
function settlements(context){
  return JSON.parse(expose(context,'JSON.stringify(KARSEN_SETTLEMENTS)'));
}
function intersect(a,b){
  return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
}

/* ---------- data integrity: one authored plan per settlement ---------- */

test('all fourteen settlements have an authored plan with a unique motif',()=>{
  const context=worldMapContext();
  const list=settlements(context);
  assert.equal(list.length,14);
  const motifs=new Set();
  list.forEach(s=>{
    const plan=JSON.parse(expose(context,'JSON.stringify(MapSystem.settlementPlan('+JSON.stringify(s.id)+'))'));
    assert.ok(plan,s.id+' must have a plan');
    assert.equal(typeof plan.motif,'string');
    assert.ok(plan.motif.length>4,s.id+' motif must be lore text');
    assert.ok(!motifs.has(plan.motif),'motifs must be unique, duplicate: '+plan.motif);
    motifs.add(plan.motif);
    assert.ok(plan.slots&&typeof plan.slots==='object');
    Object.keys(plan.slots).forEach(type=>assert.ok(Array.isArray(plan.slots[type])&&plan.slots[type].length,type+' slots on '+s.id));
    assert.ok(Array.isArray(plan.default)&&plan.default.length>=1,s.id+' needs spare default plots');
    assert.ok(Array.isArray(plan.water));
  });
});

test('every building resolves onto its plan: count, identity, type preserved, nothing mutated',()=>{
  const context=worldMapContext();
  settlements(context).forEach(s=>{
    const before=expose(context,'JSON.stringify(settlementById('+JSON.stringify(s.id)+').buildings)');
    const placed=JSON.parse(expose(context,
      'JSON.stringify(MapSystem.placeBuildings(settlementById('+JSON.stringify(s.id)+').buildings,MapSystem.settlementPlan('+JSON.stringify(s.id)+')))'));
    const source=JSON.parse(before);
    assert.equal(placed.length,source.length,s.id+' building count must survive placement');
    placed.forEach((b,i)=>{
      assert.equal(b.id,source[i].id,s.id+' building '+i+' id/order preserved');
      assert.equal(b.name,source[i].name);
      assert.equal(b.type,source[i].type);
      [b.x,b.y,b.w,b.h].every(v=>Number.isFinite(v));
      [b.x,b.y,b.w,b.h].forEach(v=>assert.ok(Number.isFinite(v),s.id+' geometry must be finite'));
      assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=100&&b.y+b.h<=82,s.id+' building '+b.name+' escapes the sheet: '+JSON.stringify([b.x,b.y,b.w,b.h]));
    });
    assert.equal(new Set(placed.map(b=>b.id)).size,placed.length,s.id+' ids must stay unique');
    assert.equal(expose(context,'JSON.stringify(settlementById('+JSON.stringify(s.id)+').buildings)'),before,
      s.id+' source buildings must not be mutated');
  });
});

test('no two resolved buildings overlap anywhere on any settlement sheet',()=>{
  const context=worldMapContext();
  settlements(context).forEach(s=>{
    const placed=JSON.parse(expose(context,
      'JSON.stringify(MapSystem.placeBuildings(settlementById('+JSON.stringify(s.id)+').buildings,MapSystem.settlementPlan('+JSON.stringify(s.id)+')))')
    );
    for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
      assert.ok(!intersect(placed[i],placed[j]),s.id+': '+placed[i].name+' overlaps '+placed[j].name);
    }
  });
});

test('the fourteen layouts are unique - no settlement reuses another ground plan',()=>{
  const context=worldMapContext();
  const list=settlements(context);
  const geometries=new Set(), slotTables=new Set();
  list.forEach(s=>{
    const placed=JSON.parse(expose(context,
      'JSON.stringify(MapSystem.placeBuildings(settlementById('+JSON.stringify(s.id)+').buildings,MapSystem.settlementPlan('+JSON.stringify(s.id)+')).map(function(b){return [b.x,b.y,b.w,b.h];}))'));
    geometries.add(JSON.stringify(placed));
    slotTables.add(expose(context,'JSON.stringify(MapSystem.SETTLEMENT_PLANS['+JSON.stringify(s.id)+'].slots)'));
  });
  assert.equal(slotTables.size,14,'slot tables must differ between all 14 plans');
  assert.equal(geometries.size,14,'resolved geometry must differ between all 14 settlements');
  const planIds=Object.keys(JSON.parse(expose(context,'JSON.stringify(MapSystem.SETTLEMENT_PLANS)')));
  assert.deepEqual(planIds.sort(),list.map(s=>s.id).sort(),'plans must exist for exactly the fourteen settlements');
});

test('placeBuildings falls back to the legacy grid when a settlement has no plan',()=>{
  const context=mapContext();
  const rows=JSON.parse(expose(context,`
    var fake=[];for(var i=0;i<7;i++)fake.push({id:'f'+i,type:'public'});
    JSON.stringify({legacy:MapSystem.placeBuildings(fake,null),rects:[0,1,2,3,4,5,6].map(MapSystem.legacyRect)});
  `));
  rows.rects.forEach((r,i)=>{
    assert.deepEqual(r,{x:12+(i%5)*18+(Math.floor(i/5)%2)*4,y:15+Math.floor(i/5)*31,w:10+(i%3)*2,h:8+(i%2)*2},
      'legacy rect '+i+' drifted from the historical grid');
  });
  rows.legacy.forEach((b,i)=>assert.deepEqual([b.x,b.y,b.w,b.h],[rows.rects[i].x,rows.rects[i].y,rows.rects[i].w,rows.rects[i].h]));
});

/* ---------------------- label layout engine --------------------------- */

const FLAT={tall:false,compact:false,stretch:1,height:100,offsetY:-12};
function nationalPoints(context,layout){
  return JSON.parse(expose(context,`
    JSON.stringify(KARSEN_SETTLEMENTS.map(function(s){
      return {id:s.id,x:s.x,y:MapSystem.transformY(${JSON.stringify(layout)},s.y),text:s.name,
        r:s.kind==='city'?2.65:s.kind==='town'?2.05:1.55,priority:s.kind==='city'?3:s.kind==='town'?2:1};
    }));
  `));
}
function runNationalLayout(context,points,height){
  return JSON.parse(expose(context,
    'JSON.stringify(MapSystem.layoutLabels('+JSON.stringify(points)+',{width:150,height:'+(height||100)+',dots:'+JSON.stringify(points)+'}))'));
}

test('national labels place every settlement without collisions in desktop layout',()=>{
  const context=worldMapContext();
  const points=nationalPoints(context,FLAT);
  const result=runNationalLayout(context,points,100);
  assert.equal(result.overlaps,0,'unresolved collisions on the desktop sheet');
  assert.deepEqual(Object.keys(result.placements).sort(),points.map(p=>p.id).sort(),'every settlement needs exactly one label');
  const rects=Object.values(result.placements).map(p=>p.rect);
  rects.forEach(r=>assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=150&&r.y+r.h<=100,'label escaped the survey sheet: '+JSON.stringify(r)));
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
    assert.ok(!intersect(rects[i],rects[j]),'labels collide: '+JSON.stringify(rects[i])+' vs '+JSON.stringify(rects[j]));
  }
  rects.forEach(r=>{
    points.forEach(p=>{
      assert.ok(!intersect({x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2},r),'label sits on the dot of '+p.id);
    });
  });
});

test('national labels stay collision-free in portrait phone layouts too',()=>{
  const context=worldMapContext();
  [{tall:true,compact:false,stretch:3.15,height:260},{tall:true,compact:true,stretch:2.32,height:190}].forEach(shape=>{
    const layout={...shape,offsetY:8-20*shape.stretch};
    const points=nationalPoints(context,layout);
    const result=runNationalLayout(context,points,shape.height);
    assert.equal(result.overlaps,0,'collisions at height '+shape.height);
    const rects=Object.values(result.placements).map(p=>p.rect);
    rects.forEach(r=>assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=150&&r.y+r.h<=shape.height,'label out of portrait sheet'));
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      assert.ok(!intersect(rects[i],rects[j]),'portrait labels collide at height '+shape.height);
    }
  });
});

test('layout is deterministic and processes higher priority settlements first',()=>{
  const context=worldMapContext();
  const points=nationalPoints(context,FLAT);
  const run=()=>expose(context,'JSON.stringify(MapSystem.layoutLabels('+JSON.stringify(points)+',{width:150,height:100,dots:'+JSON.stringify(points)+'}))');
  assert.equal(run(),run(),'two runs must agree byte for byte');
  assert.deepEqual(JSON.parse(run()).order,
    ['branec','eisenmark','kostrin','rudava','veskar','dobraven','kamenor','lindava','marec','sundervik','brezin','krasnava','oberhain','svetlin']);
});

test('crowded synthetic points still receive a placement for every item',()=>{
  const context=mapContext();
  const result=JSON.parse(expose(context,`
    var tight=[1,2,3,4,5,6,7,8].map(function(n){return {id:'t'+n,x:75,y:50,text:'LABEL'+n,r:1.4,priority:n};});
    JSON.stringify(MapSystem.layoutLabels(tight,{width:150,height:100}));
  `));
  assert.equal(Object.keys(result.placements).length,8);
  Object.values(result.placements).forEach(p=>{
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
    assert.ok(['start','middle','end'].includes(p.anchor));
    assert.equal(typeof p.leader,'boolean');
    assert.ok(Number.isFinite(p.rect.x)&&Number.isFinite(p.rect.w)&&p.rect.w>0);
  });
});

/* --------------------------- camera math ------------------------------ */

test('zoomAtPoint keeps the point under the cursor fixed while clamping scale',()=>{
  const context=mapContext();
  const cam={x:-20,y:10,scale:1.4};
  const out=JSON.parse(expose(context,`
    var cam=${JSON.stringify(cam)};
    var z=MapSystem.zoomAtPoint(cam,60,40,2);
    JSON.stringify({fx:(60-z.x)/z.scale,fy:(40-z.y)/z.scale,scale:z.scale,
      maxScale:MapSystem.zoomAtPoint(cam,60,40,99).scale,minScale:MapSystem.zoomAtPoint(cam,60,40,0).scale});
  `));
  assert.ok(Math.abs(out.fx-(60-cam.x)/cam.scale)<1e-9,'content point under cursor must not move');
  assert.ok(Math.abs(out.fy-(40-cam.y)/cam.scale)<1e-9);
  assert.equal(out.scale,2);
  assert.equal(out.maxScale,2.2);
  assert.equal(out.minScale,1);
});

test('clampCamera bounds translation to the scaled sheet and repairs garbage values',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var view={width:150,height:100};
    JSON.stringify({
      panRight:MapSystem.clampCamera({scale:2.2,x:500,y:0},view),
      panLeftUp:MapSystem.clampCamera({scale:2.2,x:-500,y:-400},view),
      center:MapSystem.clampCamera({scale:1,x:-70,y:80},view),
      garbage:MapSystem.clampCamera({scale:'x',x:NaN,y:null},view)
    });
  `));
  assert.equal(out.panRight.scale,2.2);
  assert.equal(out.panRight.x,0,'overflow to the right pins at the origin edge');
  assert.ok(Math.abs(out.panLeftUp.x+180)<1e-6,'left overflow stops at the right sheet edge');
  assert.ok(Math.abs(out.panLeftUp.y+120)<1e-6);
  assert.deepEqual(out.center,{scale:1,x:0,y:0});
  assert.deepEqual(out.garbage,{scale:1,x:0,y:0});
});

test('panBy shifts the camera and stops at the sheet edges',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var view={width:150,height:100};
    JSON.stringify({
      free:MapSystem.panBy({scale:1.5,x:-60,y:-20},30,10,view),
      edgeLeft:MapSystem.panBy({scale:2.2,x:0,y:0},-9999,0,view),
      edgeRight:MapSystem.panBy({scale:2.2,x:0,y:0},10000,0,view),
      edgeTop:MapSystem.panBy({scale:2.2,x:0,y:0},0,-9999,view)
    });
  `));
  assert.deepEqual(out.free,{scale:1.5,x:-30,y:-10},'mid-range pans move freely');
  assert.ok(Math.abs(out.edgeLeft.x+180)<1e-6);
  assert.equal(out.edgeRight.x,0,'rightward pan pins at the origin edge');
  assert.ok(Math.abs(out.edgeTop.y+120)<1e-6);
});

test('fitBounds frames a region exactly and respects the zoom ceiling',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var view={width:150,height:100};
    JSON.stringify({
      half:MapSystem.fitBounds({x:0,y:0,w:75,h:50},view),
      offset:MapSystem.fitBounds({x:25,y:25,w:50,h:50},view),
      padded:MapSystem.fitBounds({x:0,y:0,w:75,h:50},view,25)
    });
  `));
  assert.deepEqual(out.half,{scale:2,x:0,y:0});
  assert.deepEqual(out.offset,{scale:2,x:-25,y:-50});
  assert.deepEqual(out.padded,{scale:1,x:0,y:0},'a 25-unit pad pushes the fit past the zoom floor, which clamps');
});

test('pinch composition - zoomAtPoint plus focal translate - tracks the fingers',()=>{
  const context=mapContext();
  const base={scale:1.2,x:5,y:-8}, focal={x:70,y:40}, newCenter={x:74,y:38};
  const out=JSON.parse(expose(context,`
    var base=${JSON.stringify(base)}, focal=${JSON.stringify(focal)}, nc=${JSON.stringify(newCenter)};
    var zoomed=MapSystem.zoomAtPoint(base,focal.x,focal.y,1.8);
    var composed=MapSystem.clampCamera({scale:zoomed.scale,x:zoomed.x+(nc.x-focal.x),y:zoomed.y+(nc.y-focal.y)},{width:150,height:100});
    JSON.stringify({fx:(nc.x-composed.x)/composed.scale,fy:(nc.y-composed.y)/composed.scale});
  `));
  assert.ok(Math.abs(out.fx-(focal.x-base.x)/base.scale)<1e-9,
    'the content that sat under the pinch start must follow the fingers to the new midpoint');
  assert.ok(Math.abs(out.fy-(focal.y-base.y)/base.scale)<1e-9);
});

/* --------------------- terrain and layout transforms ------------------- */

test('portrait layout math matches the historical stretch formulas',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var tall=MapSystem.nationalLayout({tall:true,compact:false}),small=MapSystem.nationalLayout({tall:true,compact:true}),flat=MapSystem.nationalLayout({});
    JSON.stringify({tallH:tall.height,tallStretch:tall.stretch,smallH:small.height,smallStretch:small.stretch,flatH:flat.height,
      y20:MapSystem.transformY(tall,20),y96:MapSystem.transformY(tall,96),flatY:MapSystem.transformY(flat,52),
      gt:MapSystem.geoTransform(tall),gtFlat:MapSystem.geoTransform(flat)});
  `));
  assert.equal(out.tallH,260);
  assert.equal(out.tallStretch,3.15);
  assert.equal(out.smallH,190);
  assert.equal(out.smallStretch,2.32);
  assert.equal(out.flatH,100);
  assert.equal(out.y20,8);
  assert.ok(Math.abs(out.y96-(8+76*3.15))<1e-9);
  assert.equal(out.flatY,52);
  assert.equal(out.gt,'translate(0 -55) scale(1 3.15)');
  assert.equal(out.gtFlat,'');
});

test('terrain markup carries the national geography verbatim',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var g=MapSystem.nationalGeographyMarkup(MapSystem.nationalLayout({}));
    JSON.stringify({border:(g.match(/class="map-border"/g)||[]).length,
      forests:(g.match(/map-forest/g)||[]).length,meadows:(g.match(/map-meadow/g)||[]).length,
      wetlands:(g.match(/map-wetland/g)||[]).length,industrial:(g.match(/map-industrial/g)||[]).length,
      minorRoads:(g.match(/map-minor-road/g)||[]).length,islands:(g.match(/map-sea-island/g)||[]).length,
      seaLines:(g.match(/map-sea-line/g)||[]).length,seaLabels:(g.match(/map-sea-label/g)||[]).length,
      riverMain:g.indexOf('map-river-main')>=0,verbatim:g.indexOf(MapSystem.TERRAIN.border)>=0,wrapped:g.indexOf('<g>')===0});
  `));
  assert.equal(out.border,1);
  assert.equal(out.forests,2);
  assert.equal(out.meadows,2);
  assert.equal(out.wetlands,1);
  assert.equal(out.industrial,1);
  assert.equal(out.minorRoads,8);
  assert.equal(out.islands,2);
  assert.equal(out.seaLines,4);
  assert.equal(out.seaLabels,2,'desktop sheet embeds sea labels inside the geography group');
  assert.ok(out.riverMain&&out.verbatim&&out.wrapped);
});

test('region and sea labels transform into portrait space; routes alternate their bend',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var tall=MapSystem.nationalLayout({tall:true,compact:false}),flat=MapSystem.nationalLayout({});
    var regions=MapSystem.regionLabelsMarkup(flat);
    var a=MapSystem.routePath({x:0,y:0},{x:40,y:0},0,flat),b=MapSystem.routePath({x:0,y:0},{x:40,y:0},1,flat);
    var seaTall=MapSystem.seaLabelsMarkup(tall);
    JSON.stringify({coast:regions.indexOf('WESTERN COAST')>=0,count:(regions.match(/<text /g)||[]).length,
      seaFlat:MapSystem.seaLabelsMarkup(flat),seaTall:seaTall.indexOf('SOUTHERN SEA')>=0,
      seaTallY:seaTall.indexOf('y="'+MapSystem.transformY(tall,96)+'"')>=0,
      bendUp:a.indexOf('-2.4')>0,bendDown:b.indexOf('2.4')>0&&b.indexOf('-2.4')<0,
      curve:a.charAt(0)==='M'&&a.indexOf('Q')>0});
  `));
  assert.ok(out.coast);
  assert.equal(out.count,6);
  assert.equal(out.seaFlat,'','desktop sea labels live inside the geography group only');
  assert.ok(out.seaTall&&out.seaTallY,'portrait sheets re-emit sea labels in stretched space');
  assert.ok(out.bendUp&&out.bendDown&&out.curve);
});

/* ------------------------- UI wiring smoke ---------------------------- */

function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,scrollTop:0,scrollHeight:0,offsetWidth:100,offsetHeight:100,clientWidth:100,clientHeight:100,
    appendChild(){},remove(){},addEventListener(){},removeEventListener(){},setAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:100,height:100};},focus(){},click(){}
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
  context.setTimeout=(fn)=>0;
  context.clearTimeout=()=>{};
  context.setInterval=()=>0;
  context.clearInterval=()=>{};
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  context.activeConditions=()=>[];
  expose(context,'Random.setSeed('+JSON.stringify(seed)+'); newWorld(); newLineage(); newHold(); newSubject();');
  return context;
}

test('openMap renders the national survey with all fourteen interactive nodes',()=>{
  const context=uiContext('map-national-render');
  const html=JSON.parse(expose(context,`
    openMap();
    var out=document.getElementById('mapSheet').innerHTML;
    JSON.stringify({nodes:(out.match(/data-map-settlement=/g)||[]).length,
      border:out.indexOf('map-border')>=0,routes:(out.match(/class="map-route/g)||[]).length,
      openBtn:out.indexOf('data-map-open')>=0,clean:!/(^|>)undefined|NaN/.test(out)});
  `));
  assert.equal(html.nodes,14);
  assert.equal(html.routes,14);
  assert.ok(html.border&&html.openBtn&&html.clean,'survey html incomplete or dirty');
});

test('settlement mode renders authored buildings and plan water features',()=>{
  const context=uiContext('map-settlement-render');
  expose(context,"openMap(); World.map.mode='settlement'; World.map.selectedSettlementId='branec'; World.map.selectedBuildingId=null; renderMap();");
  const branec=JSON.parse(expose(context,`
    var out=document.getElementById('mapSheet').innerHTML;
    JSON.stringify({buildings:(out.match(/data-map-building=/g)||[]).length,
      ground:out.indexOf('settlement-ground')>=0,roads:out.indexOf('settlement-road')>=0,
      travel:out.indexOf('data-map-travel')>=0,note:out.indexOf('map-travel-note')>=0});
  `));
  assert.equal(branec.buildings,10);
  assert.ok(branec.ground&&branec.roads,'ground and roads must survive the renderer swap');
  assert.ok(branec.travel&&branec.note,'travel affordances must survive the renderer swap');
  expose(context,"World.map.selectedSettlementId='veskar'; renderMap();");
  const veskar=expose(context,"document.getElementById('mapSheet').innerHTML");
  assert.ok(veskar.indexOf('map-river')>=0,'harbor water must be drawn on the Veskar sheet');
  assert.equal((veskar.match(/data-map-building=/g)||[]).length,10);
});

test('camera resets through MapSystem when switching modes and views',()=>{
  const context=uiContext('map-camera-reset');
  const out=JSON.parse(expose(context,`
    openMap();
    var afterOpen={x:mapViewport.x,y:mapViewport.y,scale:mapViewport.scale};
    mapViewport={x:40,y:40,scale:2.1};
    World.map.mode='settlement'; World.map.selectedSettlementId='kostrin'; World.map.selectedBuildingId=null; renderMap();
    var afterFit={x:mapViewport.x,y:mapViewport.y,scale:mapViewport.scale};
    JSON.stringify({afterOpen:afterOpen,afterFit:afterFit,
      fitted:afterFit.scale>=MapSystem.ZOOM_MIN&&afterFit.scale<=MapSystem.ZOOM_MAX&&afterFit.x<=0&&afterFit.y<=0});
  `));
  assert.deepEqual(out.afterOpen,{x:0,y:0,scale:1});
  assert.ok(out.fitted,'settlement entry must produce a clamped fitted camera: '+JSON.stringify(out.afterFit));
});
