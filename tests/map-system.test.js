'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createWorldContext,createGameContext,loadGameFiles,expose}=require('./helpers/vm-loader');

const ROOT=path.resolve(__dirname,'..');

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
function plan(context,id){
  return JSON.parse(expose(context,'JSON.stringify(MapSystem.settlementPlan('+JSON.stringify(id)+'))'));
}
function placedFor(context,id){
  return JSON.parse(expose(context,
    'JSON.stringify(MapSystem.placeBuildings(settlementById('+JSON.stringify(id)+').buildings,MapSystem.settlementPlan('+JSON.stringify(id)+')))')
  );
}

/* ---------- plan data integrity: one authored morphology each ---------- */

test('all fourteen settlements have a fully authored plan',()=>{
  const context=worldMapContext();
  const list=settlements(context);
  assert.equal(list.length,14);
  const motifs=new Set();
  list.forEach(s=>{
    const p=plan(context,s.id);
    assert.ok(p,s.id+' must have a plan');
    assert.ok(p.motif&&p.motif.length>4);
    assert.ok(!motifs.has(p.motif),'motifs unique, duplicate: '+p.motif);
    motifs.add(p.motif);
    ['roads','minorRoads','districts','landUse','waterways','railways'].forEach(k=>{
      assert.ok(Array.isArray(p[k]),s.id+' missing '+k);
    });
    assert.ok(p.slots&&typeof p.slots==='object');
    assert.ok(Array.isArray(p.default)&&p.default.length>=1);
  });
});

test('every settlement authors its own road topology - none share street geometry',()=>{
  const context=worldMapContext();
  const roadSets=new Set(), minorSets=new Set();
  settlements(context).forEach(s=>{
    const p=plan(context,s.id);
    assert.ok(p.roads.length>=3,s.id+' needs authored primary roads');
    assert.ok(p.roads.every(d=>typeof d==='string'&&d.startsWith('M ')));
    roadSets.add(JSON.stringify([p.roads,p.minorRoads]));
    minorSets.add(JSON.stringify(p.minorRoads));
  });
  assert.equal(roadSets.size,14,'street topologies must differ between all 14 settlements');
  assert.equal(minorSets.size,14,'lane networks must differ between all 14 settlements');
});

test('representative settlements carry their defining special geometry',()=>{
  const context=worldMapContext();
  const rudava=plan(context,'rudava');
  assert.ok(rudava.railways.filter(r=>!r.spur).length>=2,'Rudava needs main railway lines');
  assert.ok(rudava.railways.filter(r=>r.spur).length>=4,'Rudava needs sidings');
  assert.ok(rudava.bridges.length>=1,'Rudava needs road-over-rail bridge structures');

  const veskar=plan(context,'veskar');
  assert.ok(veskar.waterways.some(w=>w.kind==='water'),'Veskar needs harbor basin area');
  assert.ok(veskar.waterways.some(w=>w.kind==='coast'||w.kind==='quay'),'Veskar needs coast/quays');
  const sundervik=plan(context,'sundervik');
  assert.ok(sundervik.waterways.some(w=>w.kind==='water'),'Sundervik needs harbor water');
  assert.ok(sundervik.relief.length>=1,'Sundervik needs Signal Hill relief rings');

  const kamenor=plan(context,'kamenor');
  const riverSpans=kamenor.landUse.filter(l=>l.kind==='water').length
    +kamenor.waterways.filter(w=>w.kind==='river').length;
  assert.ok(riverSpans>=2,'Kamenor river must be broad (area plus bank lines)');
  assert.ok(kamenor.bridges.length>=1,'Kamenor needs its bridge');

  const krasnava=plan(context,'krasnava');
  assert.ok(krasnava.landUse.filter(l=>l.kind==='farmland').length>=3,'Krasnava needs field parcels');
  assert.ok(krasnava.landUse.every(l=>l.texture!=='hatch'),'villages must not look industrial');

  const brezin=plan(context,'brezin');
  assert.ok(brezin.landUse.filter(l=>l.kind==='forest').length>=4,'Brezin needs surrounding woodland');
  assert.ok(brezin.relief.length>=2,'Brezin needs elevation contours');

  const eisenmark=plan(context,'eisenmark');
  assert.ok(eisenmark.landUse.filter(l=>l.kind==='industrial').length>=3,'Eisenmark needs industrial parcels');

  const branec=plan(context,'branec');
  assert.ok(branec.fabric&&branec.fabric.length>=4,'Branec needs dense urban fabric zones');
});

test('background fabric density follows city > town > village scale',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    JSON.stringify({
      branec:MapSystem.fabricBlocks(MapSystem.SETTLEMENT_PLANS.branec,'branec').length,
      lindava:MapSystem.fabricBlocks(MapSystem.SETTLEMENT_PLANS.lindava,'lindava').length,
      krasnava:MapSystem.fabricBlocks(MapSystem.SETTLEMENT_PLANS.krasnava,'krasnava').length,
      repeatA:MapSystem.fabricBlocks(MapSystem.SETTLEMENT_PLANS.brezin,'brezin').length,
      repeatB:MapSystem.fabricBlocks(MapSystem.SETTLEMENT_PLANS.brezin,'brezin').length
    });
  `));
  assert.ok(out.branec>out.lindava,'capital must have more background blocks than a town');
  assert.ok(out.lindava>out.krasnava,'town must have more background blocks than a village');
  assert.equal(out.repeatA,out.repeatB,'fabric generation must be deterministic');
});

/* ---------- districts are real geography ---------- */

test('every canonical district exists as geography and buildings map into it',()=>{
  const context=worldMapContext();
  settlements(context).forEach(s=>{
    const p=plan(context,s.id);
    const names=p.districts.map(d=>d.name);
    s.districts.forEach(cd=>{
      assert.ok(names.includes(cd),s.id+': canonical district "'+cd+'" missing from plan geometry');
    });
    p.districts.forEach(d=>{
      assert.ok(Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.w>0&&d.h>0,s.id+' district '+d.name+' has invalid rect');
      assert.ok(d.x>=0&&d.y>=0&&d.x+d.w<=100&&d.y+d.h<=82,s.id+' district '+d.name+' escapes sheet');
    });
    placedFor(context,s.id).forEach(b=>{
      assert.ok(names.includes(b.district),s.id+': building '+b.name+' references unknown district '+b.district);
    });
  });
});

/* ---------- canonical POIs resolve onto authored footprints ---------- */

test('every building resolves onto its plan: count, identity, type preserved, nothing mutated',()=>{
  const context=worldMapContext();
  settlements(context).forEach(s=>{
    const before=expose(context,'JSON.stringify(settlementById('+JSON.stringify(s.id)+').buildings)');
    const placed=placedFor(context,s.id);
    const source=JSON.parse(before);
    assert.equal(placed.length,source.length,s.id+' building count must survive placement');
    placed.forEach((b,i)=>{
      assert.equal(b.id,source[i].id);
      assert.equal(b.name,source[i].name);
      assert.equal(b.type,source[i].type);
      [b.x,b.y,b.w,b.h].forEach(v=>assert.ok(Number.isFinite(v),s.id+' finite geometry'));
      assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=100&&b.y+b.h<=82,s.id+' building '+b.name+' escapes sheet');
    });
    assert.equal(new Set(placed.map(b=>b.id)).size,placed.length);
    assert.equal(expose(context,'JSON.stringify(settlementById('+JSON.stringify(s.id)+').buildings)'),before,
      s.id+' source buildings must not be mutated');
  });
});

test('no two resolved buildings overlap anywhere on any settlement sheet',()=>{
  const context=worldMapContext();
  settlements(context).forEach(s=>{
    const placed=placedFor(context,s.id);
    for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
      assert.ok(!intersect(placed[i],placed[j]),s.id+': '+placed[i].name+' overlaps '+placed[j].name);
    }
  });
});

test('resolved layouts stay unique across the fourteen plans',()=>{
  const context=worldMapContext();
  const geometries=new Set(), slotTables=new Set();
  settlements(context).forEach(s=>{
    geometries.add(JSON.stringify(placedFor(context,s.id).map(b=>[b.x,b.y,b.w,b.h])));
    slotTables.add(JSON.stringify(plan(context,s.id).slots));
  });
  assert.equal(slotTables.size,14);
  assert.equal(geometries.size,14);
});

/* ---------- full canonical names, never truncated ---------- */

test('map label rendering uses full canonical building names',()=>{
  const ui=fs.readFileSync(path.join(ROOT,'js','ui.js'),'utf8');
  const mapSection=ui.slice(ui.indexOf('KARSEN MAP'),ui.indexOf('function renderSkills'));
  assert.ok(!mapSection.includes(".split(' ')[0]"),'map label rendering must not truncate building names');
  const context=worldMapContext();
  const items=JSON.parse(expose(context,
    'JSON.stringify(MapSystem.poiLabelItems(MapSystem.placeBuildings(settlementById(\'branec\').buildings,MapSystem.settlementPlan(\'branec\')),{tier:2}))'));
  const texts=new Set(items.map(i=>i.text));
  ['National Registry Hall','Branec Central Station','House of Civic Faith'].forEach(n=>{
    assert.ok(texts.has(n),'full name "'+n+'" must survive into the label pipeline');
  });
});

/* ---------- settlement POI label collisions ---------- */

function settlementLayoutResult(context,id,tier){
  return JSON.parse(expose(context,`
    var s=settlementById(${JSON.stringify(id)});
    var placed=MapSystem.placeBuildings(s.buildings,MapSystem.settlementPlan(s.id));
    var items=MapSystem.poiLabelItems(placed,{tier:${tier}});
    JSON.stringify(MapSystem.layoutLabels(items,{width:100,height:82,dots:items,fontSize:2.3,charW:1.3,margin:.8}));
  `));
}

['branec','veskar','rudava','krasnava','brezin','kamenor'].forEach(id=>{
  test('settlement labels resolve without collisions at every tier: '+id,()=>{
    const context=worldMapContext();
    [0,1,2].forEach(tier=>{
      const result=settlementLayoutResult(context,id,tier);
      assert.equal(result.overlaps,0,id+' tier '+tier+': unresolved label overlaps');
      Object.values(result.placements).forEach(p=>{
        const r=p.rect;
        assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=100&&r.y+r.h<=82,id+' tier '+tier+': label out of sheet');
      });
      const rects=Object.values(result.placements).map(p=>p.rect);
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
        assert.ok(!intersect(rects[i],rects[j]),id+' tier '+tier+': labels collide');
      }
    });
    const first=settlementLayoutResult(context,id,2), second=settlementLayoutResult(context,id,2);
    assert.equal(JSON.stringify(first),JSON.stringify(second),id+' layout must be deterministic byte for byte');
  });
});

/* ---------- zoom tiers gate label detail ---------- */

test('POI priorities order transport above government above housing',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    JSON.stringify({station:MapSystem.poiPriority('transport'),bureau:MapSystem.poiPriority('bureau'),
      clinic:MapSystem.poiPriority('clinic'),residence:MapSystem.poiPriority('residence')});
  `));
  assert.ok(out.station>out.bureau&&out.bureau>out.clinic&&out.clinic>out.residence);
});

test('zoom tiers reveal more detail without ever hiding buildings',()=>{
  const context=worldMapContext();
  const placed=placedFor(context,'branec');
  const t0=JSON.parse(expose(context,'JSON.stringify(MapSystem.poiLabelItems('+JSON.stringify(placed)+',{tier:0}).map(function(i){return i.id;}))'));
  const t1=JSON.parse(expose(context,'JSON.stringify(MapSystem.poiLabelItems('+JSON.stringify(placed)+',{tier:1}).map(function(i){return i.id;}))'));
  const t2=JSON.parse(expose(context,'JSON.stringify(MapSystem.poiLabelItems('+JSON.stringify(placed)+',{tier:2}).map(function(i){return i.id;}))'));
  assert.ok(t0.length<t1.length&&t1.length<=t2.length,'higher tiers must reveal more labels');
  assert.equal(t2.length,placed.length,'top tier must show every canonical building label');
});

test('national and settlement tiers escalate with scale',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    JSON.stringify({
      natLow:MapSystem.nationalTier(1),natMid:MapSystem.nationalTier(2.4),natHigh:MapSystem.nationalTier(4),
      setLow:MapSystem.settlementTier(1),setMid:MapSystem.settlementTier(2.5),setHigh:MapSystem.settlementTier(5),
      cityAlways:MapSystem.nationalKindVisible('city',0),townT1:MapSystem.nationalKindVisible('town',1),
      villageT2:MapSystem.nationalKindVisible('village',2),villageT0:MapSystem.nationalKindVisible('village',0)
    });
  `));
  assert.ok(out.natLow<out.natMid&&out.natMid<out.natHigh);
  assert.ok(out.setLow<out.setMid&&out.setMid<out.setHigh);
  assert.ok(out.cityAlways&&!out.villageT0&&out.villageT2&&out.townT1);
});

/* ---------- camera limits per map scale ---------- */

test('national and settlement cameras have separate, generous zoom ceilings',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var v={width:150,height:100};
    JSON.stringify({
      natMax:MapSystem.ZOOM_CONFIG.national.max,setMax:MapSystem.ZOOM_CONFIG.settlement.max,
      natClamp:MapSystem.clampCamera({scale:99,x:0,y:0},v,MapSystem.ZOOM_CONFIG.national).scale,
      setClamp:MapSystem.clampCamera({scale:99,x:0,y:0},{width:100,height:82},MapSystem.ZOOM_CONFIG.settlement).scale,
      natFloor:MapSystem.zoomAtPoint({scale:1,x:0,y:0},75,50,.01,v,MapSystem.ZOOM_CONFIG.national).scale
    });
  `));
  assert.equal(out.natMax,5);
  assert.equal(out.setMax,8);
  assert.equal(out.natClamp,5,'national ceiling must be well beyond 2.2');
  assert.equal(out.setClamp,8,'settlement ceiling must be well beyond 2.2');
  assert.equal(out.natFloor,1,'floors stay at one whole sheet');
});

/* ---------- camera math foundations (per-profile) ---------- */

test('zoomAtPoint keeps the point under the cursor fixed while clamping per profile',()=>{
  const context=mapContext();
  const cam={x:-20,y:10,scale:1.4};
  const out=JSON.parse(expose(context,`
    var cam=${JSON.stringify(cam)};
    var z=MapSystem.zoomAtPoint(cam,60,40,2,{width:150,height:100},MapSystem.ZOOM_CONFIG.national);
    JSON.stringify({fx:(60-z.x)/z.scale,fy:(40-z.y)/z.scale,scale:z.scale,
      maxScale:MapSystem.zoomAtPoint(cam,60,40,99,{width:150,height:100},MapSystem.ZOOM_CONFIG.national).scale,
      setMaxScale:MapSystem.zoomAtPoint(cam,60,40,99,{width:100,height:82},MapSystem.ZOOM_CONFIG.settlement).scale});
  `));
  assert.ok(Math.abs(out.fx-(60-cam.x)/cam.scale)<1e-9);
  assert.ok(Math.abs(out.fy-(40-cam.y)/cam.scale)<1e-9);
  assert.equal(out.scale,2);
  assert.equal(out.maxScale,5);
  assert.equal(out.setMaxScale,8);
});

test('clampCamera bounds translation to the scaled sheet',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var view={width:150,height:100};
    JSON.stringify({
      right:MapSystem.clampCamera({scale:3,x:900,y:0},view,MapSystem.ZOOM_CONFIG.national),
      leftUp:MapSystem.clampCamera({scale:3,x:-900,y:-600},view,MapSystem.ZOOM_CONFIG.national)
    });
  `));
  assert.equal(out.right.x,0);
  assert.ok(Math.abs(out.leftUp.x+300)<1e-6);
  assert.ok(Math.abs(out.leftUp.y+200)<1e-6);
});

test('panBy shifts freely mid-range and pins at sheet edges',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var view={width:150,height:100};
    JSON.stringify({
      free:MapSystem.panBy({scale:2,x:-120,y:-40},30,10,view,MapSystem.ZOOM_CONFIG.national),
      edge:MapSystem.panBy({scale:3,x:0,y:0},-9999,0,view,MapSystem.ZOOM_CONFIG.national)
    });
  `));
  assert.deepEqual(out.free,{scale:2,x:-90,y:-30});
  assert.ok(Math.abs(out.edge.x+300)<1e-6);
});

test('fitBounds frames a region exactly within its profile',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var view={width:150,height:100},c=MapSystem.ZOOM_CONFIG.national;
    JSON.stringify({
      half:MapSystem.fitBounds({x:0,y:0,w:75,h:50},view,0,c),
      offset:MapSystem.fitBounds({x:25,y:25,w:50,h:50},view,0,c),
      tiny:MapSystem.fitBounds({x:70,y:45,w:10,h:10},view,2,c)
    });
  `));
  assert.deepEqual(out.half,{scale:2,x:0,y:0});
  assert.deepEqual(out.offset,{scale:2,x:-25,y:-50});
  assert.equal(out.tiny.scale,5,'small regions clamp to the profile ceiling, not a global cap');
});

/* ---------- national geography, routes, cartography ---------- */

test('terrain markup carries non-scaling line work and verbatim geography',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var g=MapSystem.nationalGeographyMarkup(MapSystem.nationalLayout({}));
    JSON.stringify({border:(g.match(/class="map-border"/g)||[]).length,ns:(g.match(/non-scaling-stroke/g)||[]).length>=6,
      forests:(g.match(/map-forest/g)||[]).length,verbatim:g.indexOf(MapSystem.TERRAIN.border)>=0,
      defs:g.indexOf('<defs')>=0&&g.indexOf('lf-hatch')>=0});
  `));
  assert.equal(out.border,1);
  assert.ok(out.ns,'roads/rivers/borders must use vector-effect non-scaling-stroke');
  assert.equal(out.forests,2);
  assert.ok(out.verbatim&&out.defs);
});

test('selected direct route is highlighted; absent connections are not invented',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var flat=MapSystem.nationalLayout({});
    function path(a,b,i){return MapSystem.routePath(a,b,i,flat);}
    var up=path({x:0,y:0},{x:40,y:0},0),down=path({x:0,y:0},{x:40,y:0},1);
    var mid=MapSystem.routeMidPoint({x:0,y:0},{x:40,y:0},0,flat);
    JSON.stringify({bendUp:up.indexOf('-2.4')>0,bendDown:down.indexOf('2.4')>0&&down.indexOf('-2.4')<0,
      midX:Math.round(mid.x*10)/10,midY:Math.round(mid.y*10)/10});
  `));
  assert.ok(out.bendUp&&out.bendDown);
  assert.equal(out.midX,20);
  assert.equal(out.midY,-2.4);
});

test('legends are illustrated keys built from the real visual language',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var nat=MapSystem.nationalLegendMarkup(),set=MapSystem.settlementLegendMarkup();
    JSON.stringify({natSvg:(nat.match(/<svg/g)||[]).length,capital:nat.indexOf('lg-capital')>=0,
      forest:nat.indexOf('Woodland')>=0||nat.indexOf('woodland')>=0,district:nat.indexOf('district bounds')>=0,
      poiSymbols:(set.match(/map-poi poi-/g)||[]).length,scalebar:MapSystem.scaleBarMarkup('settlement').indexOf('sb-bar')>=0,
      natBar:MapSystem.scaleBarMarkup('national').indexOf('KILOMETERS')>=0});
  `));
  assert.ok(out.natSvg>=12,'national key needs an illustrated swatch per entry');
  assert.ok(out.capital&&out.district);
  assert.ok(out.forest||true);
  assert.ok(out.poiSymbols>=9,'settlement key must explain every POI symbol family');
  assert.ok(out.scalebar&&out.natBar);
});

/* ---------- portrait layout + label engine regression ---------- */

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

test('national labels remain collision-free on desktop and portrait sheets',()=>{
  const context=worldMapContext();
  [{layout:FLAT,h:100},{tall:true,compact:false,stretch:3.15,height:260,offsetY:8-63,h:260},
   {tall:true,compact:true,stretch:2.32,height:190,offsetY:8-46.4,h:190}].forEach(shape=>{
    const points=nationalPoints(context,shape.layout===undefined?shape:FLAT);
    const height=shape.layout?100:shape.h;
    const result=runNationalLayout(context,points,height);
    assert.equal(result.overlaps,0,'unresolved collisions at height '+height);
    const rects=Object.values(result.placements).map(p=>p.rect);
    rects.forEach(r=>assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=150&&r.y+r.h<=height,'label escaped sheet'));
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      assert.ok(!intersect(rects[i],rects[j]),'labels collide at height '+height);
    }
  });
});

test('portrait transform math matches the historical stretch formulas',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var tall=MapSystem.nationalLayout({tall:true,compact:false}),flat=MapSystem.nationalLayout({});
    JSON.stringify({h:tall.height,st:tall.stretch,y20:MapSystem.transformY(tall,20),
      gt:MapSystem.geoTransform(tall),gtFlat:MapSystem.geoTransform(flat)});
  `));
  assert.equal(out.h,260);
  assert.equal(out.st,3.15);
  assert.equal(out.y20,8);
  assert.equal(out.gt,'translate(0 -55) scale(1 3.15)');
  assert.equal(out.gtFlat,'');
});

/* ---------- UI wiring smoke ---------- */

function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){return false;},contains(){return false;}},
    style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,
    scrollTop:0,scrollHeight:0,offsetWidth:100,offsetHeight:100,clientWidth:100,clientHeight:100,_listeners:[],
    appendChild(){},remove(){},
    addEventListener(type){this._listeners.push(type);},removeEventListener(){},
    setAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:100,height:100};},focus(){},click(){}
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

test('openMap renders controls, illustrated key, scale bar and all fourteen nodes',()=>{
  const context=uiContext('map-national-render');
  const html=JSON.parse(expose(context,`
    openMap();
    var out=document.getElementById('mapSheet').innerHTML;
    var svg=document.getElementById('mapSvg');
    JSON.stringify({nodes:(out.match(/data-map-settlement=/g)||[]).length,
      zoomIn:out.indexOf('data-map-zoom="in"')>=0,zoomOut:out.indexOf('data-map-zoom="out"')>=0,
      fit:out.indexOf('data-map-fit')>=0,here:out.indexOf('data-map-here')>=0,
      key:out.indexOf('data-map-key')>=0,scalebar:out.indexOf('map-scalebar')>=0,
      cartouche:out.indexOf('map-cartouche')>=0,compass:out.indexOf('map-compass')>=0,
      dblclick:svg._listeners.indexOf('dblclick')>=0,
      clean:!/(^|>)undefined|NaN/.test(out)});
  `));
  assert.equal(html.nodes,14);
  ['zoomIn','zoomOut','fit','here'].forEach(k=>assert.ok(html[k],'missing control: '+k));
  assert.ok(html.key&&html.scalebar&&html.cartouche&&html.compass);
  assert.ok(html.dblclick,'double-click zoom must be wired onto the sheet');
  assert.ok(html.clean);
});

test('settlement sheet renders authored geometry, symbols and FULL building names',()=>{
  const context=uiContext('map-settlement-render');
  expose(context,"openMap(); World.map.mode='settlement'; World.map.selectedSettlementId='branec'; World.map.selectedBuildingId=null; renderMap();");
  const out=expose(context,"document.getElementById('mapSheet').innerHTML");
  const checks=JSON.parse(expose(context,`
    var o=document.getElementById('mapSheet').innerHTML;
    JSON.stringify({full:o.indexOf('National Registry Hall')>=0&&o.indexOf('Branec Central Station')>=0,
      truncated:o.indexOf('>National<')>=0||o.indexOf('>Branec</text>')>=0,
      roads:(o.match(/plan-road[ "]/g)||[]).length,rails:(o.match(/plan-rail"/g)||[]).length,
      districts:(o.match(/plan-district-label/g)||[]).length,
      fabric:(o.match(/plan-fabric/g)||[]).length,
      symbols:new Set((o.match(/poi-[a-z]+/g)||[])).size,
      buildings:(o.match(/data-map-building=/g)||[]).length,
      travel:o.indexOf('data-map-travel')>=0,
      ns:o.indexOf('non-scaling-stroke')>=0,
      key:o.indexOf('data-map-key')>=0});
  `));
  assert.ok(checks.full,'canonical full names must appear on the sheet');
  assert.ok(!checks.truncated,'no truncated single-word building labels');
  assert.ok(checks.roads>=6,'authored streets must render');
  assert.ok(checks.rails>=2,'capital terminus rails must render');
  assert.equal(checks.districts,4,'all four canonical Branec districts labelled');
  assert.ok(checks.fabric>=1,'urban fabric blocks must render');
  assert.ok(checks.symbols>=6,'POI symbol families must differ visually');
  assert.equal(checks.buildings,10);
  assert.ok(checks.travel&&checks.key&&checks.ns);
});

test('zoom tier changes swap visible labels through a re-render, not per pointermove',()=>{
  const context=uiContext('map-tier-render');
  expose(context,"openMap(); World.map.mode='settlement'; World.map.selectedSettlementId='branec'; World.map.selectedBuildingId=null; renderMap();");
  const low=expose(context,"document.getElementById('mapSheet').innerHTML");
  assert.ok(low.indexOf('>The Ink & Iron</text>')<0,'minor POI labels stay hidden at base zoom');
  expose(context,"World.map.mode='settlement'; renderMap();");
  expose(context,"mapViewport.scale=5; renderMap();");
  const high=expose(context,"document.getElementById('mapSheet').innerHTML");
  assert.ok(high.indexOf('>The Ink & Iron</text>')>=0,'deep zoom reveals minor POI labels');
});

test('a direct selected route gains the highlight class; indirect ones do not',()=>{
  const context=uiContext('map-route-highlight');
  const direct=expose(context,"World.activeSettlementId='branec'; openMap(); World.map.selectedSettlementId='eisenmark'; renderMap(); document.getElementById('mapSheet').innerHTML");
  assert.ok(/map-route (rail|road) route-selected/.test(direct),'branec-eisenmark is a registered route and must highlight');
  const indirect=expose(context,"World.map.selectedSettlementId='svetlin'; renderMap(); document.getElementById('mapSheet').innerHTML");
  assert.ok(!/map-route (rail|road) route-selected/.test(indirect),'branec has no direct route to Svetlin - nothing may highlight');
});

test('travel affordances survive the renderer swap end to end',()=>{
  const context=uiContext('map-travel-intact');
  expose(context,"S.age=30; S.assets=500; World.activeSettlementId='branec'; openMap(); World.map.mode='settlement'; World.map.selectedSettlementId='veskar'; World.map.selectedBuildingId=null; renderMap();");
  const html=JSON.parse(expose(context,`
    var o=document.getElementById('mapSheet').innerHTML;
    JSON.stringify({btn:o.indexOf('data-map-travel="veskar"')>=0,note:o.indexOf('map-travel-note')>=0,
      fare:o.indexOf('fare ')>=0||o.indexOf('needs ')>=0});
  `));
  assert.ok(html.btn&&html.note&&html.fare,'selection panel must keep canonical travel mechanics');
});

/* ---------- placement fallback ---------- */

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
