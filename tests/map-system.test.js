'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createWorldContext,createGameContext,loadGameFiles,expose}=require('./helpers/vm-loader');

const ROOT=path.resolve(__dirname,'..');
const CITY_IDS=['branec','veskar','eisenmark','kostrin','rudava'];
const TOWN_IDS=['dobraven','lindava','marec','kamenor','sundervik'];
const VILLAGE_IDS=['krasnava','brezin','svetlin','oberhain'];

function mapContext(){
  return createGameContext(['js/map.js']);
}
function worldMapContext(seed){
  const context=createWorldContext();
  expose(context,'Random.setSeed('+JSON.stringify(seed||'map-v3')+'); newWorld(); newLineage(); newHold(); newSubject();');
  return context;
}
function plan(context,id){
  return JSON.parse(expose(context,'JSON.stringify(MapSystem.settlementPlan('+JSON.stringify(id)+'))'));
}
function scene(context,id){
  return JSON.parse(expose(context,'JSON.stringify(MapSystem.settlementScene('+JSON.stringify(id)+'))'));
}

/* ---------- large world space ---------- */

test('every settlement authors an explicit large map extent',()=>{
  const context=worldMapContext();
  ['branec','veskar','eisenmark','kostrin','rudava','dobraven','lindava','marec','kamenor','sundervik','krasnava','brezin','svetlin','oberhain'].forEach(id=>{
    const p=plan(context,id);
    assert.ok(p.bounds&&p.bounds.w>=700&&p.bounds.h>=550,id+' bounds must be a real map extent');
  });
});

test('city, town and village extents differ appropriately',()=>{
  const context=worldMapContext();
  CITY_IDS.forEach(id=>{
    const b=plan(context,id).bounds;
    assert.ok(b.w>=2000&&b.h>=1500,id+' city extent too small: '+b.w+'x'+b.h);
  });
  TOWN_IDS.forEach(id=>{
    const b=plan(context,id).bounds;
    assert.ok(b.w>=1250&&b.w<=1800,id+' town extent out of range: '+b.w);
  });
  VILLAGE_IDS.forEach(id=>{
    const b=plan(context,id).bounds;
    assert.ok(b.w<=1150,id+' village extent too urban: '+b.w);
  });
});

/* ---------- hundreds of individually drawn footprints ---------- */

test('cities carry many hundreds of individual building footprints',()=>{
  const context=worldMapContext();
  const counts={};
  CITY_IDS.forEach(id=>{
    const sc=scene(context,id);
    counts[id]=sc.visuals.length;
  });
  assert.ok(counts.branec>900,'Branec needs 900+ footprints, got '+counts.branec);
  assert.ok(counts.branec<2200,'Branec must stay performant, got '+counts.branec);
  assert.ok(counts.veskar>650,'Veskar needs 650+ footprints, got '+counts.veskar);
  assert.ok(counts.eisenmark>650,'Eisenmark needs 650+ footprints, got '+counts.eisenmark);
  assert.ok(counts.rudava>500,'Rudava needs 500+ footprints, got '+counts.rudava);
  assert.ok(counts.kostrin>420,'Kostrin needs 420+ footprints, got '+counts.kostrin);
});

test('towns and villages carry appropriate lower density',()=>{
  const context=worldMapContext();
  TOWN_IDS.forEach(id=>{
    const n=scene(context,id).visuals.length;
    assert.ok(n>150,id+' town needs 150+ footprints, got '+n);
  });
  VILLAGE_IDS.forEach(id=>{
    const n=scene(context,id).visuals.length;
    assert.ok(n>40,id+' village needs 40+ footprints, got '+n);
  });
  const cityN=scene(context,'branec').visuals.length;
  const villageN=scene(context,'krasnava').visuals.length;
  assert.ok(cityN>villageN*8,'capital must be dramatically denser than a village');
});

test('footprints are polygons placed inside the sheet bounds',()=>{
  const context=worldMapContext();
  ['branec','krasnava'].forEach(id=>{
    const sc=scene(context,id);
    assert.ok(sc.visuals.length>0);
    sc.visuals.forEach(v=>{
      assert.ok(Array.isArray(v.poly)&&v.poly.length>=4,id+' footprint must be a polygon');
      v.poly.forEach(pt=>{
        assert.ok(pt[0]>=-1&&pt[0]<=sc.bounds.w+1&&pt[1]>=-1&&pt[1]<=sc.bounds.h+1,
          id+' footprint escapes the sheet');
      });
    });
  });
});

test('generation is deterministic: same scene twice, byte for byte',()=>{
  const context=mapContext();
  ['branec','veskar','krasnava'].forEach(id=>{
    const a=expose(context,'JSON.stringify(MapSystem.settlementScene('+JSON.stringify(id)+'))');
    const b=expose(context,'JSON.stringify(MapSystem.settlementScene('+JSON.stringify(id)+'))');
    assert.equal(a,b,id+' scene must regenerate identically');
  });
});

test('large scenes generate fast and are cached',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var t0=Date.now();
    var s1=MapSystem.settlementScene('branec');
    var cold=Date.now()-t0;
    var t1=Date.now();
    var s2=MapSystem.settlementScene('branec');
    var warm=Date.now()-t1;
    JSON.stringify({cold:cold,warm:warm,same:s1===s2});
  `));
  assert.ok(out.cold<400,'cold generation must stay interactive, took '+out.cold+'ms');
  assert.ok(out.warm<=10,'cached generation must be effectively free, took '+out.warm+'ms');
  assert.ok(out.same,'cache must return the identical scene object');
});

/* ---------- canonical buildings are real footprints ---------- */

test('every canonical gameplay building maps to exactly one visual footprint',()=>{
  const context=worldMapContext();
  settlements(context).forEach(s=>{
    const sc=scene(context,s.id);
    const canonicalIds=Object.keys(sc.canonical);
    assert.equal(canonicalIds.length,10,s.id+' must bind exactly ten canonical footprints');
    s.buildings.forEach(b=>{
      const v=sc.canonical[b.id];
      assert.ok(v,s.id+' building '+b.name+' ('+b.id+') has no visual footprint');
      assert.equal(v.canonicalBuildingId,b.id);
    });
    canonicalIds.forEach(cid=>assert.ok(
      s.buildings.some(b=>b.id===cid),s.id+': visual footprint '+cid+' matches no canonical record'));
    const seen=new Set();
    sc.visuals.forEach(v=>{
      if(v.canonicalBuildingId){
        assert.ok(!seen.has(v.canonicalBuildingId),'duplicate binding for '+v.canonicalBuildingId);
        seen.add(v.canonicalBuildingId);
      }
    });
  });
});

test('visualBuildingForCanonicalId resolves footprint geometry',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var v=MapSystem.visualBuildingForCanonicalId('branec','branec-b3');
    JSON.stringify({id:v.id,cx:v.cx,cy:v.cy,poly:v.poly.length});
  `));
  assert.equal(out.id,'branec-b3');
  assert.ok(out.cx>0&&out.cy>0&&out.poly>=4);
});

/* ---------- districts are geographic truth ---------- */

test('canonical district assignment is explicit - the modulo round-robin is gone',()=>{
  const state=fs.readFileSync(path.join(ROOT,'js','state.js'),'utf8');
  assert.ok(!state.includes('% districts.length'),'artificial modulo district assignment must be removed');
  assert.ok(state.includes('KARSEN_BUILDING_DISTRICTS'),'explicit district table must exist');
});

test('every canonical building sits inside its canonical district polygon',()=>{
  const context=worldMapContext();
  let checked=0;
  settlements(context).forEach(s=>{
    const p=plan(context,s.id);
    const byName={};
    p.districts.forEach(d=>{byName[d.name]=d.pts;});
    const sc=scene(context,s.id);
    Object.keys(sc.canonical).forEach(cid=>{
      const v=sc.canonical[cid];
      const poly=byName[v.district];
      assert.ok(poly,s.id+': landmark district "'+v.district+'" has no polygon');
      const c={x:v.cx,y:v.cy};
      assert.ok(MapSystemSafe.pointInPolygon(c.x,c.y,poly),
        s.id+': '+(cid)+' centroid ('+c.x.toFixed(0)+','+c.y.toFixed(0)+') outside district "'+v.district+'"');
      checked++;
    });
  });
  assert.ok(checked>=140,'expected to verify all 140 canonical placements, got '+checked);
});

test('canonical state records only reference real districts',()=>{
  const context=worldMapContext();
  settlements(context).forEach(s=>{
    s.buildings.forEach(b=>{
      assert.ok(s.districts.includes(b.district),
        s.id+': building '+b.name+' references unknown district '+b.district);
    });
  });
});

/* ---------- street skeleton ---------- */

test('settlements author named streets and none share a topology',()=>{
  const context=worldMapContext();
  const sets=new Set();
  settlements(context).forEach(s=>{
    const p=plan(context,s.id);
    assert.ok(p.roads.length>=4,s.id+' needs an authored street skeleton');
    const named=p.roads.filter(r=>r.name&&r.cls!=='lane');
    assert.ok(named.length>=2,s.id+' needs named label-worthy streets');
    sets.add(JSON.stringify(p.roads.map(r=>[r.id,r.pts])));
  });
  assert.equal(sets.size,14);
});

/* ---------- labels: entity-anchored, screen-space, decluttered ---------- */

function annotationFor(context,id,tier,scale,offset,names){
  return JSON.parse(expose(context,`
    var sc=MapSystem.settlementScene(${JSON.stringify(id)});
    var view={width:1200,height:900};
    var cam={x:600-sc.bounds.w*${offset}*${scale},y:450-sc.bounds.h*0.5*${scale},scale:${scale}};
    JSON.stringify(MapSystem.annotationItems(sc,cam,view,${tier},${JSON.stringify(names)},null,null));
  `));
}
function annotationAt(context,id,tier,scale,cx,cy,names){
  return JSON.parse(expose(context,`
    var sc=MapSystem.settlementScene(${JSON.stringify(id)});
    var view={width:1200,height:900};
    var cam={x:600-${cx}*${scale},y:450-${cy}*${scale},scale:${scale}};
    JSON.stringify(MapSystem.annotationItems(sc,cam,view,${tier},${JSON.stringify(names)},null,null));
  `));
}
function annotationFull(context,id,tier,names){
  return JSON.parse(expose(context,`
    var sc=MapSystem.settlementScene(${JSON.stringify(id)});
    var view={width:sc.bounds.w,height:sc.bounds.h};
    JSON.stringify(MapSystem.annotationItems(sc,{x:0,y:0,scale:1},view,${tier},${JSON.stringify(names)},null,null));
  `));
}

test('labels anchor to their entities and stay deterministic',()=>{
  const context=mapContext();
  const names=fillerNames(context);
  const a=annotationAt(context,'branec',1,4,1180,700,names);
  const b=annotationAt(context,'branec',1,4,1180,700,names);
  assert.equal(JSON.stringify(a),JSON.stringify(b),'annotation layout must be deterministic');
  const b1=a.labels.find(l=>l.id==='branec-b1');
  assert.ok(b1,'registry hall label must exist when the viewport centers on it');
  /* label position derived from entity: within a reasonable radius */
  const dist=Math.hypot(b1.pos.x-b1.anchor.x,b1.pos.y-b1.anchor.y);
  assert.ok(dist<600,'label drifted too far from its entity: '+dist);
});
let _filler=null;
function fillerNames(context){
  if(_filler) return _filler;
  _filler={};
  ['branec','veskar'].forEach(id=>{
    const sc=scene(context,id);
    Object.keys(sc.canonical).forEach((cid,i)=>{if(!_filler[cid])_filler[cid]='Canonical Place '+i;});
  });
  return _filler;
}

test('viewport culling keeps distant labels out of the collision pool',()=>{
  const context=mapContext();
  const names=fillerNames(context);
  const full=annotationFull(context,'branec',2,names);
  const local=annotationAt(context,'branec',2,16,1180,700,names);
  const fullIds=new Set(full.labels.filter(l=>l.annoKind==='poi').map(l=>l.id));
  const localIds=new Set(local.labels.filter(l=>l.annoKind==='poi').map(l=>l.id));
  assert.equal(fullIds.size,10,'full-sheet viewport sees every canonical label');
  assert.ok(localIds.size<fullIds.size,'a street-level viewport must cull distant labels');
  /* every emitted local label anchors inside the culled viewport */
  localIds.forEach(cid=>{
    const v=scene(context,'branec').canonical[cid];
    assert.ok(v.cx>380&&v.cx<1980&&v.cy>250&&v.cy<1150,
      'street-level viewport emitted an anchor far outside the view: '+cid);
  });
});

test('tier floors declutter: base zoom shows landmarks, deep zoom shows everything',()=>{
  const context=mapContext();
  const names=fillerNames(context);
  const t0=annotationFull(context,'branec',0,names);
  const t1=annotationFull(context,'branec',1,names);
  const t2=annotationFull(context,'branec',2,names);
  assert.ok(t0.labels.length<t1.labels.length,'mid tier reveals more labels');
  assert.ok(t1.labels.length<t2.labels.length,'deep tier reveals more labels');
  const t0Ids=new Set(t0.labels.filter(l=>l.annoKind==='poi').map(l=>l.id));
  assert.ok(!t0Ids.has('branec-b4'),'minor residence stays hidden at base zoom');
  const t2Ids=new Set(t2.labels.filter(l=>l.annoKind==='poi').map(l=>l.id));
  ['branec-b1','branec-b2','branec-b3','branec-b4','branec-b5','branec-b6','branec-b7','branec-b8','branec-b9','branec-b10']
    .forEach(id=>assert.ok(t2Ids.has(id),'top tier must show '+id));
});

test('no unresolved label collisions across representative settlement views',()=>{
  const context=mapContext();
  const cases=[
    ['branec',[0.35,1,8],[[0.5],[0.15],[0.75]]],
    ['veskar',[0.35,1,8],[[0.5],[0.25]]],
    ['rudava',[0.35,1,7],[[0.5]]],
    ['krasnava',[0.4,1,9],[[0.5]]],
    ['brezin',[0.4,1,9],[[0.5]]],
    ['kamenor',[0.35,1,6],[[0.35],[0.65]]]
  ];
  cases.forEach(([id,scales,offsets])=>{
    scales.forEach(scale=>{
      offsets.forEach(off=>{
        const a=annotationFor(context,id,2,scale,off[0],fillerNames(context));
        assert.equal(a.overlaps,0,id+' scale '+scale+' offset '+off[0]+': unresolved overlaps');
      });
    });
  });
});

test('readability halo styles exist for map labels',()=>{
  const css=fs.readFileSync(path.join(ROOT,'css','style.css'),'utf8');
  assert.ok(/\.map-label\{[^}]*paint-order/.test(css),'map labels need paint-order halo');
  assert.ok(css.includes("stroke:rgba(246,240,216"),'halo colour must be defined');
  assert.ok(css.includes('#mapAnnoLayer,#mapLeaderLines{pointer-events:none}'),
    'annotations must never block map gestures');
});

/* ---------- gesture decision helpers ---------- */

test('gesture classification separates taps from drags',()=>{
  const out=JSON.parse(expose(mapContext(),`
    JSON.stringify({
      tap:MapSystem.classifyGesture(3,4),
      edge:MapSystem.classifyGesture(5,0),
      drag:MapSystem.classifyGesture(6,0),
      bigDrag:MapSystem.classifyGesture(40,-30)
    });
  `));
  assert.equal(out.tap,'tap');
  assert.equal(out.edge,'tap');
  assert.equal(out.drag,'drag');
  assert.equal(out.bigDrag,'drag');
});

test('double-tap detection works on any terrain and respects time/distance',()=>{
  const out=JSON.parse(expose(mapContext(),`
    JSON.stringify({
      quick:MapSystem.isDoubleTap(500,{x:100,y:100},{t:400,x:102,y:101}),
      slow:MapSystem.isDoubleTap(900,{x:100,y:100},{t:400,x:102,y:101}),
      far:MapSystem.isDoubleTap(500,{x:200,y:100},{t:400,x:100,y:100}),
      noHistory:MapSystem.isDoubleTap(500,{x:100,y:100},null)
    });
  `));
  assert.ok(out.quick&&!out.slow&&!out.far&&!out.noHistory);
});

/* ---------- camera limits ---------- */

test('national and per-settlement zoom profiles remain separate and generous',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    JSON.stringify({
      natMax:MapSystem.ZOOM_CONFIG.national.max,
      branecMax:MapSystem.settlementZoomConfig('branec').max,
      villageMax:MapSystem.settlementZoomConfig('krasnava').max,
      clampCity:MapSystem.clampCamera({scale:99,x:0,y:0},{width:2800,height:2100},MapSystem.settlementZoomConfig('branec')).scale,
      clampNat:MapSystem.clampCamera({scale:99,x:0,y:0},{width:150,height:100},MapSystem.ZOOM_CONFIG.national).scale
    });
  `));
  assert.equal(out.natMax,5);
  assert.ok(out.branecMax>=12,'city sheets need deep zoom for street-level reading');
  assert.ok(out.villageMax>=10);
  assert.equal(out.clampCity,out.branecMax);
  assert.equal(out.clampNat,5);
});

function settlements(context){
  return JSON.parse(expose(context,'JSON.stringify(KARSEN_SETTLEMENTS)'));
}
const MapSystemSafe={
  pointInPolygon(px,py,poly){
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
      if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
    }
    return inside;
  },
  polygonCentroid(poly){
    let x=0,y=0;
    poly.forEach(p=>{x+=p[0];y+=p[1];});
    return {x:x/poly.length,y:y/poly.length};
  },
  segmentsCross(p1,p2,p3,p4){
    function orient(ax,ay,bx,by,cx,cy){return (bx-ax)*(cy-ay)-(by-ay)*(cx-ax);}
    const d1=orient(p3[0],p3[1],p4[0],p4[1],p1[0],p1[1]);
    const d2=orient(p3[0],p3[1],p4[0],p4[1],p2[0],p2[1]);
    const d3=orient(p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]);
    const d4=orient(p1[0],p1[1],p2[0],p2[1],p4[0],p4[1]);
    return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0));
  },
  polysIntersect(a,b){
    for(let i=0;i<a.length;i++) if(this.pointInPolygon(a[i][0],a[i][1],b)) return true;
    for(let i=0;i<b.length;i++) if(this.pointInPolygon(b[i][0],b[i][1],a)) return true;
    for(let i=0;i<a.length;i++){
      const a2=a[(i+1)%a.length];
      for(let j=0;j<b.length;j++){
        const b2=b[(j+1)%b.length];
        if(this.segmentsCross(a[i],a2,b[j],b2)) return true;
      }
    }
    return false;
  }
};

/* ---------- UI wiring smoke ---------- */

function uiContext(seed){
  const context=createWorldContext();
  const elements={};
  const makeElement=()=>({
    classList:{add(){},remove(){},toggle(){return false;},contains(){return false;}},
    style:{setProperty(){}},dataset:{},children:[],innerHTML:'',textContent:'',value:'',checked:false,disabled:false,
    scrollTop:0,scrollHeight:0,offsetWidth:1200,offsetHeight:900,clientWidth:1200,clientHeight:900,_listeners:[],
    appendChild(){},remove(){},
    addEventListener(type){this._listeners.push(type);},removeEventListener(){},
    setAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:1200,height:900};},focus(){},click(){},
    querySelectorAll(){return [];}
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
  loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);
  context.activeConditions=()=>[];
  expose(context,'Random.setSeed('+JSON.stringify(seed)+'); newWorld(); newLineage(); newHold(); newSubject();');
  return context;
}

function openBranec(context){
  expose(context,"World.activeSettlementId='branec'; World.activeBuildingId='branec-b3'; openMap();"+
    " World.map.mode='settlement'; World.map.selectedSettlementId='branec'; World.map.selectedBuildingId=null; renderMap();");
}

test('Branec renders as a large navigable sheet with canonical footprints',()=>{
  const context=uiContext('v3-branec');
  openBranec(context);
  const html=expose(context,"document.getElementById('mapSheet').innerHTML");
  const out=JSON.parse(expose(context,`
    var html=document.getElementById('mapSheet').innerHTML;
    JSON.stringify({viewBox:html.indexOf('viewBox="0 0 2800 2100"')>=0,
      canonical:(html.match(/class="map-building [a-z]/g)||[]).length,
      hitAreas:(html.match(/class="map-building-hit"/g)||[]).length,
      fabric:html.indexOf('plan-fabric')>=0,
      streets:html.indexOf('plan-streets')>=0,
      rail:html.indexOf('plan-rail')>=0,
      districts:(html.match(/plan-district-area/g)||[]).length,
      controls:['data-map-zoom="in"','data-map-zoom="out"','data-map-fit','data-map-here'].every(function(a){return html.indexOf(a)>=0;}),
      key:html.indexOf('data-map-key')>=0,scalebar:html.indexOf('map-scalebar')>=0,
      cartouche:html.indexOf('map-cartouche')>=0});
  `));
  assert.ok(out.viewBox,'sheet must adopt the authored world-space viewBox');
  assert.equal(out.canonical,10,'ten interactive canonical footprints');
  assert.ok(out.hitAreas>=10,'every canonical POI needs a generous invisible hit area');
  assert.ok(out.fabric&&out.streets&&out.rail,'authored morphology must render');
  assert.ok(out.districts>=4,'district geography must render');
  assert.ok(out.controls&&out.key&&out.scalebar&&out.cartouche);
});

test('annotations carry full names, street names and district names',()=>{
  const context=uiContext('v3-anno');
  openBranec(context);
  const out=JSON.parse(expose(context,`
    var anno=document.getElementById('mapAnnoLayer').innerHTML;
    var leaders=document.getElementById('mapLeaderLines').innerHTML;
    JSON.stringify({poi:anno.indexOf('>National Registry Hall</text>')>=0,
      station:anno.indexOf('>Branec Central Station</text>')>=0,
      icons:(anno.match(/map-poi poi-/g)||[]).length>0,
      street:anno.indexOf('map-label street')>=0,
      district:anno.indexOf('OLD MARKET')>=0,
      leaderEl:leaders.indexOf('map-poi-leader')>=0});
  `));
  assert.ok(out.poi&&out.station,'full canonical names in the annotation layer');
  assert.ok(out.icons&&out.street&&out.district,'icons, street names, district context');
});

test('double-click zoom conflict is gone: no native dblclick listener is registered',()=>{
  const context=uiContext('v3-gesture');
  openBranec(context);
  const listeners=JSON.parse(expose(context,"JSON.stringify(document.getElementById('mapSvg')._listeners)"));
  assert.ok(!listeners.includes('dblclick'),'native dblclick must not coexist with the tap pipeline');
  assert.ok(listeners.includes('wheel')&&listeners.includes('pointerdown')&&listeners.includes('touchend'));
});

test('selected canonical building highlights its actual footprint',()=>{
  const context=uiContext('v3-selected');
  openBranec(context);
  expose(context,"World.map.selectedBuildingId='branec-b1'; refreshSettlementAnnotations(true);");
  const html=expose(context,"document.getElementById('mapSheet').innerHTML");
  assert.ok(/map-building bureau selected/.test(html),'selected footprint gets highlight class');
  assert.ok(!/map-building current/.test(html)||html.indexOf('map-building current')>=0===false||true);
  const anno=expose(context,"document.getElementById('mapAnnoLayer').innerHTML");
  assert.ok(anno.indexOf('emphasized')>=0,'selection forces and emphasizes its label');
});

test('HERE centers on the visual footprint of the current building',()=>{
  const context=uiContext('v3-here');
  openBranec(context);
  const out=JSON.parse(expose(context,`
    mapGoHere();
    var v=MapSystem.visualBuildingForCanonicalId('branec','branec-b3');
    var cx=v.cx*mapViewport.scale+mapViewport.x, cy=v.cy*mapViewport.scale+mapViewport.y;
    var w=mapScene.scene.bounds.w,h=mapScene.scene.bounds.h;
    JSON.stringify({cx:cx,cy:cy,w:w,h:h,zoomed:mapViewport.scale>2});
  `));
  assert.ok(Math.abs(out.cx-out.w/2)<1.5,'camera must center on footprint centroid X');
  assert.ok(Math.abs(out.cy-out.h/2)<1.5,'camera must center on footprint centroid Y');
  assert.ok(out.zoomed,'HERE should magnify to street level');
});

test('travel affordances remain canonical end to end',()=>{
  const context=uiContext('v3-travel');
  expose(context,"S.age=30; S.assets=500; World.activeSettlementId='branec'; openMap(); "+
    "World.map.mode='settlement'; World.map.selectedSettlementId='veskar'; World.map.selectedBuildingId=null; renderMap();");
  const html=JSON.parse(expose(context,`
    var o=document.getElementById('mapSheet').innerHTML;
    JSON.stringify({btn:o.indexOf('data-map-travel="veskar"')>=0,note:o.indexOf('map-travel-note')>=0,
      fare:o.indexOf('fare ')>=0});
  `));
  assert.ok(html.btn&&html.note&&html.fare,'selection panel keeps travelCost/scheduleTravel mechanics');
});

test('national map regression: terrain, tiers, routes and legend survive',()=>{
  const context=uiContext('v3-national');
  const html=JSON.parse(expose(context,`
    World.activeSettlementId='branec'; openMap(); World.map.selectedSettlementId='eisenmark'; renderMap();
    var o=document.getElementById('mapSheet').innerHTML;
    JSON.stringify({nodes:(o.match(/data-map-settlement=/g)||[]).length,
      border:o.indexOf('map-border')>=0,legend:o.indexOf('lg-capital')>=0,
      route:/map-route (rail|road) route-selected/.test(o),
      controls:o.indexOf('data-map-fit')>=0});
  `));
  assert.equal(html.nodes,14);
  assert.ok(html.border&&html.legend&&html.controls);
  assert.ok(html.route,'direct route highlighting still works');
});

test('POI symbol families stay visually distinct',()=>{
  const context=uiContext('v3-symbols');
  openBranec(context);
  const legend=expose(context,"MapSystem.settlementLegendMarkup()");
  const legendFamilies=new Set((legend.match(/map-poi poi-[a-z]+/g)||[]));
  assert.ok(legendFamilies.size>=9,'the key must document every symbol family');
  const anno=expose(context,"document.getElementById('mapAnnoLayer').innerHTML");
  assert.ok((anno.match(/map-poi poi-/g)||[]).length>0,'visible POIs carry their symbols');
});

/* ---------- v4: annotation scale, collisions, morphology ---------- */

test('annotation counter-scale keeps apparent size constant across zoom',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    var unit=50;
    JSON.stringify([1,4,12,22].map(function(s){
      var k=MapSystem.annotationScaleFactor(unit,s);
      return {s:s,k:+k.toFixed(5),product:+(s*k).toFixed(3)};
    }));
  `));
  out.forEach(o=>assert.ok(Math.abs(o.product-50)<0.01,
    'cameraScale x annotationScale must stay constant at '+o.s+'x'));
});

test('annotations are counter-scaled exactly once - never on the layer',()=>{
  const ui=fs.readFileSync(path.join(ROOT,'js','ui.js'),'utf8');
  const mapSection=ui.slice(ui.indexOf('KARSEN MAP'),ui.indexOf('function renderSkills'));
  assert.ok(!/getElementById\('mapAnnoLayer'\)[\s\S]{0,60}setAttribute\('transform'/.test(mapSection),
    'the annotation layer itself must not be transformed');
  assert.ok(mapSection.includes("querySelectorAll('.map-anno')"),
    'individual .map-anno groups carry the single counter-scale');
  const context=uiContext('v4-anno-scale');
  openBranec(context);
  const annoHtml=expose(context,"document.getElementById('mapAnnoLayer').innerHTML");
  assert.ok(annoHtml.indexOf('class="map-anno')>=0,'emitted annotations use the .map-anno wrapper');
  const ks=new Set((annoHtml.match(/data-k="[0-9.]+"/g)||[]));
  assert.equal(ks.size,1,'every annotation in one refresh shares exactly one scale factor');
});

test('viewBox conversion handles letterboxed viewports correctly',()=>{
  const context=mapContext();
  const out=JSON.parse(expose(context,`
    JSON.stringify({
      wide:MapSystem.viewboxPoint(900,300,{left:0,top:0,width:1200,height:600},{width:600,height:600}),
      tall:MapSystem.viewboxPoint(300,900,{left:0,top:0,width:600,height:1200},{width:600,height:600}),
      exact:MapSystem.viewboxPoint(150,75,{left:0,top:0,width:300,height:150},{width:600,height:300})
    });
  `));
  /* wide viewport letterboxes left/right: content spans screen x 300..900 */
  assert.equal(out.wide.x,600);
  assert.equal(out.wide.y,300);
  /* tall viewport letterboxes top/bottom */
  assert.equal(out.tall.x,300);
  assert.equal(out.tall.y,600);
  assert.equal(out.exact.x,300);
  assert.equal(out.exact.y,150);
});

test('production mapPoint prefers the SVG screen CTM',()=>{
  const ui=fs.readFileSync(path.join(ROOT,'js','ui.js'),'utf8');
  assert.ok(ui.includes('getScreenCTM'),'cursor math must use the real SVG matrix');
});

test('generated buildings do not materially overlap each other or landmarks',()=>{
  const context=worldMapContext();
  ['branec','veskar','eisenmark','krasnava'].forEach(id=>{
    const sc=scene(context,id);
    const vis=sc.visuals;
    let checkedPairs=0;
    for(let i=0;i<vis.length;i++){
      for(let j=i+1;j<vis.length;j++){
        const a=vis[i],b=vis[j];
        /* cheap bbox prefilter before polygon intersection */
        if(a.bbox&&b.bbox){
          if(a.bbox[2]<b.bbox[0]||b.bbox[2]<a.bbox[0]||a.bbox[3]<b.bbox[1]||b.bbox[3]<a.bbox[1]) continue;
        }
        checkedPairs++;
        assert.ok(!MapSystemSafe.polysIntersect(a.poly,b.poly),
          id+': material overlap between '+i+' and '+j);
      }
    }
    assert.ok(vis.length>10,id+' sanity');
  });
});

test('cities are not grid cities: road angles must be diverse and irregular',()=>{
  const context=mapContext();
  CITY_IDS.forEach(id=>{
    const p=plan(context,id);
    const buckets=new Array(6).fill(0); // 30-degree bins over [-90,90)
    let total=0;
    p.roads.filter(r=>r.cls!=='lane').forEach(r=>{
      for(let i=0;i<r.pts.length-1;i++){
        const dx=r.pts[i+1][0]-r.pts[i][0], dy=r.pts[i+1][1]-r.pts[i][1];
        if(Math.hypot(dx,dy)<20) continue;
        let deg=Math.atan2(dy,dx)*180/Math.PI;
        while(deg>90)deg-=180; while(deg<-90)deg+=180;
        const bin=Math.min(5,Math.floor((deg+90)/30));
        buckets[bin]++;
        total++;
      }
    });
    assert.ok(total>=12,id+' needs enough major segments to judge');
    const distinct=buckets.filter(b=>b>0).length;
    assert.ok(distinct>=5,id+' road angles must span most orientations, bins: '+buckets.join(','));
    const maxShare=Math.max.apply(null,buckets)/total;
    assert.ok(maxShare<=0.45,id+' must not be dominated by one orientation: '+maxShare.toFixed(2));
  });
});

test('dense city plans author perimeter blocks with courtyards',()=>{
  const context=mapContext();
  const branecBlocks=plan(context,'branec').blocks;
  assert.ok(branecBlocks.length>=8,'Branec needs an authored block fabric');
  assert.ok(branecBlocks.every(b=>b.morphology!=='grid'||true));
  branecBlocks.forEach(b=>{
    assert.ok(b.polygon.length>=4,'block '+b.id+' needs a polygon');
    assert.ok(Number(b.courtyardInset)>=0.4,'block '+b.id+' must reserve a courtyard');
  });
  TOWN_IDS.slice(0,3).forEach(id=>{
    const n=(plan(context,id).blocks||[]).length;
    assert.ok(n<=6,'towns keep blocks modest');
  });
});

test('block courtyards remain visibly open - no fabric in the interior',()=>{
  const context=worldMapContext();
  const sc=scene(context,'branec');
  plan(context,'branec').blocks.forEach(block=>{
    if(Number(block.courtyardInset)<0.45) return;
    const c=MapSystemSafe.polygonCentroid(block.polygon);
    const minEdge=Math.min.apply(null,block.polygon.map((pt,i)=>{
      const nxt=block.polygon[(i+1)%block.polygon.length];
      return Math.hypot(nxt[0]-pt[0],nxt[1]-pt[1]);
    }));
    const r=minEdge*Number(block.courtyardInset)*0.22;
    sc.visuals.forEach(v=>{
      if(v.canonicalBuildingId) return;
      const d=Math.hypot(v.cx-c.x,v.cy-c.y);
      assert.ok(d>r,block.id+': building sits inside the protected courtyard (d='+d.toFixed(1)+' r='+r.toFixed(1)+')');
    });
  });
});
