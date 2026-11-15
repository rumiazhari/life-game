'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createGameContext,createWorldContext,expose}=require('./helpers/vm-loader');
const ROOT=path.resolve(__dirname,'..');
const geo=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/maps/lithuania-outline.geojson'),'utf8'));
const parse=(c,expr)=>JSON.parse(expose(c,'JSON.stringify('+expr+')'));
function pointInRing(x,y,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>y)!=(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function onLithuania(x,y){
 const lon=20.92457+(x-14)/122*(26.80072-20.92457);
 const lat=56.44260-(y-13)/74*(56.44260-53.88684);
 const g=geo.features[0].geometry,polys=g.type==='MultiPolygon'?g.coordinates:[g.coordinates];
 return polys.some(p=>pointInRing(lon,lat,p[0])&&!p.slice(1).some(h=>pointInRing(lon,lat,h)));
}
function world(seed){
 const c=createWorldContext();
 expose(c,"Random.setSeed("+JSON.stringify(seed||'lt-25d')+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=30;World.year=S.dob+30;S.assets=5000;S.scrutiny=18;S.health=80;"+
  "World.activeSettlementId='branec';World.place='Branec';"+
  "function logEv(){};function renderStats(){};function renderIdentity(){};");
 return c;
}
test('country geography is genuine offline Natural Earth Lithuania shape',()=>{
 assert.equal(geo.features.length,1);
 assert.equal(geo.features[0].properties.name,'Lithuania');
 assert.equal(geo.features[0].properties.license,'public domain');
 const polygons=geo.features[0].geometry.coordinates;
 assert.ok(polygons.flat(2).length>=400);
 const c=createGameContext(['js/map.js']);
 const pathData=expose(c,'MapSystem.TERRAIN.border');
 assert.ok(pathData.length>1000);
 const h=expose(c,'MapSystem.nationalGeographyMarkup(MapSystem.nationalLayout({tall:false}))');
 for(const term of ['lf-real-lithuania-clip','map-land-side','map-geographic-relief','map-land-surface'])assert.ok(h.includes(term),term);
});
test('all 14 Karsen cities are within real country outline',()=>{
 const towns=parse(world(),'KARSEN_SETTLEMENTS.map(s=>({id:s.id,x:s.x,y:s.y}))');
 assert.equal(towns.length,14);
 for(const s of towns)assert.equal(onLithuania(s.x,s.y),true,s.id+' outside geography');
});
test('14 districts have actual 3D building vertices and batched visible roofs',()=>{
 const c=createGameContext(['js/map.js']);
 const ids=['branec','veskar','eisenmark','kostrin','rudava','dobraven','lindava','marec','kamenor','sundervik','krasnava','brezin','svetlin','oberhain'];
 for(const id of ids){
  const expr="(function(){const scene=MapSystem.settlementScene("+JSON.stringify(id)+");"+
   "const v=scene.visuals[0],mesh=MapSystem.meshForVisual(v);"+
   "const raised=MapSystem.settlementExtrusionsMarkup(scene,{maxBuildings:650});"+
   "const canonical=MapSystem.extrudedBuildingMarkup(scene.canonical["+JSON.stringify(id+'-b1')+"]);"+
   "return {footprint:v.poly.length,height:mesh.height,vertices:mesh.vertices.length,walls:mesh.walls.length,"+
   "rendered:raised.includes('map-mesh-batch'),canonical:canonical.includes('map-mesh-building'),"+
   "above:MapSystem.meshProject([0,0,mesh.height])[1]<0};})()";
  const v=parse(c,expr);
  assert.ok(v.height>0&&v.above,id+' missing 3D height');
  assert.equal(v.vertices,v.footprint*2,id+' 3D vertices');
  assert.equal(v.walls,v.footprint,id+' walls');
  assert.ok(v.rendered&&v.canonical,id+' missing raised building geometry');
 }
});
test('all routes traverse canonical roads and no settlement is disconnected',()=>{
 const c=world(),from='branec';
 const routes=parse(c,"KARSEN_SETTLEMENTS.filter(s=>s.id!=='branec').map(s=>({id:s.id,route:routePlan(settlementById('branec'),s,'economy')}))");
 assert.equal(routes.length,13);
 for(const p of routes){
  assert.ok(p.route&&p.route.legs.length>0,p.id+' unreachable');
  assert.equal(p.route.stops[0],from);
  assert.equal(p.route.stops.at(-1),p.id);
  for(const leg of p.route.legs){
    const q=JSON.stringify(leg.from),r=JSON.stringify(leg.to);
    assert.equal(parse(c,'KARSEN_ROUTES.some(e=>(e.from==='+q+'&&e.to==='+r+')||(e.to==='+q+'&&e.from==='+r+'))'),true);
  }
 }
});
test('route strategies exchange fare and fatigue for checkpoint risk',()=>{
 const c=world();
 const v=parse(c,"['economy','express','discreet'].map(x=>routePlan(settlementById('branec'),settlementById('veskar'),x))");
 assert.deepEqual(v.map(x=>x.choice),['economy','express','discreet']);
 assert.ok(v[0].fare<v[1].fare&&v[0].fare<v[2].fare);
 assert.ok(v[2].permitRisk<v[0].permitRisk);
 assert.ok(v[1].fatigue<v[0].fatigue);
 const risk=parse(c,"(function(){let a=routePlan(settlementById('branec'),settlementById('veskar'),'economy').permitRisk;World.settlements.branec.security.checkpointPressure=.9;return {a,b:routePlan(settlementById('branec'),settlementById('veskar'),'economy').permitRisk};})()");
 assert.ok(risk.b>risk.a);
});
test('booking charges once, persists stops and resolves one arrival',()=>{
 const c=world('one-ticket');
 const v=parse(c,"(function(){const from=settlementById('branec'),to=settlementById('marec');const fare=travelCost(from,to,'discreet'),start=S.assets;"+
  "const first=scheduleTravel('marec','discreet'),second=scheduleTravel('marec','discreet');"+
  "const ticket=JSON.parse(JSON.stringify(S.traveling));S.traveling.arriveYear=World.year;resolveTravel();"+
  "return {fare,start,first,second,ticket,assets:S.assets,destination:World.activeSettlementId,clear:!S.traveling};})()");
 assert.equal(v.first.ok,true);
 assert.equal(v.second.ok,false);
 assert.equal(v.start-v.assets,v.fare);
 assert.ok(v.ticket.route.length>=2);
 assert.equal(v.ticket.preference,'discreet');
 assert.equal(v.destination,'marec');
 assert.equal(v.clear,true);
});
test('original map UI retains canonical handlers with visible 2.5D and route controls',()=>{
 const s=fs.readFileSync(path.join(ROOT,'js/ui.js'),'utf8');
 const h=fs.readFileSync(path.join(ROOT,'life-game.html'),'utf8');
 const css=fs.readFileSync(path.join(ROOT,'css/style.css'),'utf8');
 for(const n of ['data-map-building','data-map-settlement','settlementExtrusionsMarkup','extrudedBuildingMarkup',
   'data-map-depth','data-map-travel-style','mapTownEconomicSummary'])assert.ok(s.includes(n),n);
 assert.match(h,/js\/map\.js\?v=20261116-map7/);
 assert.match(css,/map-mesh-city/);assert.match(css,/map-land-surface/);
 assert.match(css,/\.lu-green\{fill:#dfe8c2/,'village green land use must never be black');
 assert.match(css,/prefers-reduced-motion/);
});


test('a cross-city relocation ends the actual employment contract on arrival, not purchase',()=>{
 const c=world('relocate-employed');
 const state=parse(c,"(function(){"+
  "const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail',name:'Current Employer'});"+
  "const contract=EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1900,occupationName:'Clerk',jobTier:1});"+
  "EmploymentSystem.syncPlayerLegacy(World,S);"+
  "const purchased=scheduleTravel('veskar','economy');"+
  "const before=EmploymentSystem.activeForPerson(World,'subject').map(x=>x.id);"+
  "S.traveling.arriveYear=World.year;resolveTravel();"+
  "return {purchased,contract:contract.id,before,after:EmploymentSystem.activeForPerson(World,'subject').map(x=>x.id),"+
  "contractStatus:World.employmentContracts[contract.id].status,jobTier:S.jobTier,work:S.jobName,where:World.activeSettlementId};"+
  "})()");
 assert.equal(state.purchased.ok,true);
 assert.ok(state.before.includes(state.contract),'employment remains active until arrival');
 assert.equal(state.after.length,0);
 assert.equal(state.contractStatus,'resigned');
 assert.equal(state.jobTier,0);
 assert.equal(state.work,'Unemployed');
 assert.equal(state.where,'veskar');
});
test('annual demography and political conditions become visible map data, not static decoration',()=>{
 const c=world('atlas-dynamic');
 // Map implementation loads with the same world and hooks as actual UI.
 const {loadGameFiles}=require('./helpers/vm-loader');
 const elements={};
 const make=()=>({innerHTML:'',classList:{add(){},remove(){},contains(){return false;}},
  addEventListener(){},removeEventListener(){},appendChild(){},remove(){},focus(){},setAttribute(){},querySelector(){return null;},querySelectorAll(){return [];},
  style:{},dataset:{},getBoundingClientRect(){return {width:1400,height:930,left:0,top:0}}});
 c.document={querySelector(k){return elements[k]||(elements[k]=make())},
 getElementById(k){return elements['#'+k]||(elements['#'+k]=make())},
 createElement(){return make()},addEventListener(){},body:make()};
 c.setTimeout=()=>1;c.clearTimeout=()=>{};
 loadGameFiles(c,['js/medical.js','js/ui.js']);
 const baseline=parse(c,"(function(){"+
  "World.settlements.veskar.demographics.population=1111;"+
  "mapStrategicMode='economy';"+
  "const count=mapResidentCount(settlementById('veskar'));"+
  "const initial=mapCityIndicator(settlementById('veskar'));"+
  "World.settlements.veskar.economy.employmentIndex=.05;"+
  "const low=mapCityIndicator(settlementById('veskar'));"+
  "World.settlements.veskar.security.unrest=.9;"+
  "mapStrategicMode='security';"+
  "const unrest=mapCityIndicator(settlementById('veskar'));"+
  "mapStrategicMode='health';"+
  "const health=mapCityIndicator(settlementById('veskar'));"+
  "return {count,initial,low,unrest,health,buttons:mapLensControlsMarkup()};"+
  "})()");
 assert.equal(baseline.count,'1,111');
 assert.equal(baseline.low.cls,'danger');
 assert.equal(baseline.unrest.cls,'danger');
 assert.ok(baseline.initial.value>baseline.low.value);
 assert.match(baseline.buttons,/data-map-lens="economy"/);
 assert.match(baseline.buttons,/data-map-lens="security"/);
 assert.match(baseline.buttons,/data-map-lens="health"/);
});
test('the risk quoted to the traveler equals the yearly checkpoint event probability',()=>{
 const c=world('risk-parity');
 const data=parse(c,"(function(){"+
  "const a=routePlan(settlementById('branec'),settlementById('rudava'),'discreet');"+
  "World.settlements.rudava.security.checkpointPressure=.9;"+
  "const b=routePlan(settlementById('branec'),settlementById('rudava'),'discreet');"+
  "return {a,b};"+
  "})()");
 assert.ok(Math.abs(data.a.checkpointProbability-data.a.permitRisk*.45)<1e-12);
 assert.ok(Math.abs(data.b.checkpointProbability-data.b.permitRisk*.45)<1e-12);
 assert.ok(data.b.permitRisk>data.a.permitRisk,'destination security must modify travel exposure');
});
