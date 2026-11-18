'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
function ui(seed){
 const c=createWorldContext(),els={};
 const make=()=>({classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){}},
  dataset:{},children:[],innerHTML:'',textContent:'',checked:false,disabled:false,scrollTop:0,scrollHeight:0,offsetWidth:100,
  appendChild(){},remove(){},addEventListener(){},removeEventListener(){},querySelector(){return null;},
  querySelectorAll(){return [];},closest(){return null;},getBoundingClientRect(){return {width:100,height:100};},focus(){}});
 c.document={querySelector(x){return els[x]||(els[x]=make());},querySelectorAll(){return [];},
  getElementById(x){return els['#'+x]||(els['#'+x]=make());},createElement(){return make();},
  addEventListener(){},body:make(),documentElement:make()};
 c.addEventListener=()=>{};c.setTimeout=()=>0;c.clearTimeout=()=>{};c.setInterval=()=>0;c.clearInterval=()=>{};
 loadGameFiles(c,['js/systems/world-gameplay.js','js/medical.js','js/illustration.js','js/ui/dossier-art.js','js/ui.js']);c.activeConditions=()=>[];
 expose(c,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();"+
  "S.age=30;World.year=S.dob+30;S.livingAtHome=false;S.assets=1400;S.health=70;"+
  "S.jobTier=0;S.jobName='Unemployed';S.career=null;S.eduStage=null;S.jailUntil=0;S.garnishUntil=0;"+
  "S.liabilities=[];S.kids=0;S.married=false;S.contacts=[];S.location={settlementId:World.activeSettlementId};");
 return c;
}
const html=(c,id)=>String(expose(c,"document.getElementById('"+id+"').innerHTML"));
test('Section C renders SVG household, three state gauges, actual budget, and existing actions',()=>{
 const c=ui('visual-house');expose(c,'renderInventory()');const h=html(c,'inventory');
 for(const x of ['lv-scene-svg','lv-home-grid','lv-gauges','lv-budget-track','lv-world-grid','lv-cost-personal'])assert.ok(h.includes(x),x);
 assert.ok((h.match(/class="lv-icon"/g)||[]).length>=10);
 assert.equal((h.match(/class="lv-gauge /g)||[]).length,3);
 for(const id of ['invOpenMedical','invOpenHousehold','invOpenFamilyHealth'])assert.ok(h.includes('id="'+id+'"'),id);
});
test('housing scene, child silhouettes and spending respond to actual choices without spending assets',()=>{
 const c=ui('visual-dynamic');expose(c,"S.lifestyle.housing='none';S.kids=2;renderInventory()");
 let h=html(c,'inventory');
 assert.match(h,/temporary shelter/);assert.match(h,/No Fixed Address/);assert.match(h,/CHILDCARE/);
 assert.equal((h.match(/class="lv-person"/g)||[]).length,3);
 assert.match(h,/PROJECTED TOTAL OUTLAY/);
 const before=expose(c,'S.assets');
 expose(c,"S.lifestyle.housing='flat';S.kids=0;renderInventory()");
 h=html(c,'inventory');
 assert.match(h,/Illustration of home/);assert.match(h,/Small Flat/);assert.doesNotMatch(h,/CHILDCARE/);
 assert.equal(expose(c,'S.assets'),before);
});
test('family-table dependent remains visible without inventing their annual spending',()=>{
 const c=ui('visual-child');expose(c,'S.age=12;S.livingAtHome=true;renderInventory()');
 const h=html(c,'inventory');assert.match(h,/AT THE FAMILY TABLE/);assert.match(h,/GUARDIANSHIP/);
 assert.doesNotMatch(h,/lv-budget-track/);
});
test('strategic and advanced actions use icons without removing their original handlers',()=>{
 const c=ui('visual-actions');expose(c,"planTab='focus';renderPlan();renderWorldBrief()");
 assert.match(html(c,'planSheet'),/class="rec-graphic"/);assert.match(html(c,'planSheet'),/data-p="lookwork"/);
 assert.match(html(c,'worldBrief'),/class="lv-icon"/);
 expose(c,"planTab='decisions';planShowUnavailable=true;renderPlan()");
 assert.match(html(c,'planSheet'),/class="sb-symbol"/);
});
test('annual record keeps full story behind compact visual beats',()=>{
 const c=ui('visual-report');
 const text='A deliberately long annual entry about payroll, households, government surveillance, layoffs and the hidden consequences of this individual choice.';
 expose(c,"reportAge=30;reportIdx=1;reportEntries=[{cls:'crisis',head:'CITY UNREST',text:"+JSON.stringify(text)+",chips:[]}];");
 const h=String(expose(c,'buildYearReportHtml()'));
 assert.match(h,/yr-visual/);assert.match(h,/READ FULL REPORT/);assert.match(h,/yr-details/);
 assert.match(h,/government surveillance/);
});
test('the live game uses illustrated cover, visual Section C and motion-accessible CSS',()=>{
 const h=fs.readFileSync(path.resolve(__dirname,'../life-game.html'),'utf8');
 const css=fs.readFileSync(path.resolve(__dirname,'../css/style.css'),'utf8');
 assert.match(h,/cover-world-art/);assert.match(h,/<h3 class="sec-h">Home &amp; world<\/h3>/);
 assert.match(h,/js\/ui\.js\?v=20261117-p12/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.lv-smoke/);assert.match(css,/\.lv-gauge-ring/);
});

test('housing art distinguishes every housing type and reacts separately to unrest and surveillance',()=>{
 const c=ui('visual-housing-types');
 const read=()=>{expose(c,'renderInventory()');return html(c,'inventory').match(/<svg class="lv-scene-svg"[\s\S]*?<\/svg>/)?.[0];};
 const images=['none','shelter','room','flat','house','townhouse','estate'].map(id=>{
  expose(c,'S.lifestyle.housing='+JSON.stringify(id));
  const svg=read();
  assert.match(svg,new RegExp('data-housing="'+id+'"'));
  return svg.replace(/data-housing="[^"]*"|aria-label="[^"]*"/g,'');
 });
 assert.equal(new Set(images).size,7);
 expose(c,'World.settlements[World.activeSettlementId].security.unrest=.86;World.settlements[World.activeSettlementId].security.surveillance=.15');
 assert.match(read(),/data-unrest="high"/);
 assert.doesNotMatch(read(),/class="lv-surveillance"/);
 expose(c,'World.settlements[World.activeSettlementId].security.unrest=.12;World.settlements[World.activeSettlementId].security.surveillance=.88');
 assert.doesNotMatch(read(),/class="lv-unrest"/);
 assert.match(read(),/class="lv-surveillance"/);
});

test('dossier illustration reads actual household membership and changes portrait without a new identity',()=>{
 const c=ui('visual-profile');
 expose(c,"S.age=9;S.eduStage='lower';S.livingAtHome=true;renderIdentity();renderInventory()");
 const first=html(c,'photo-art'),family=html(c,'inventory');
 assert.match(first,/data-attire="school"/);
 assert.match(first,/data-age="child"/);
 assert.match(family,/lv-person/);
 expose(c,"S.age=36;S.eduStage=null;S.jobName='Physician';S.jobTier=4;S.livingAtHome=false;S.assets=12000;renderDossierPortrait()");
 const older=html(c,'photo-art');
 assert.match(older,/data-attire="healthcare"/);
 assert.match(older,/data-age="adult"/);
 assert.match(older,/data-means="comfortable"/);
 assert.equal(first.match(/data-identity="([^"]+)"/)[1],older.match(/data-identity="([^"]+)"/)[1]);
 expose(c,"S.assets=-40;renderDossierPortrait()");
 assert.match(html(c,'photo-art'),/data-means="strained"/);
});

test('home illustration follows co-resident records instead of drawing absent parents',()=>{
 const c=ui('visual-residence');
 expose(c,"S.age=4;S.livingAtHome=true;S.mother.alive=true;S.mother.present=true;S.mother.estranged=false;World.npcs[S.mother.npcId].alive=true;renderInventory()");
 const count=()=> (html(c,'inventory').match(/class="lv-person"/g)||[]).length;
 const initial=count();
 assert.ok(initial>=2);
 expose(c,'S.mother.present=false;renderInventory()');
 assert.equal(count(),initial-1);
});

test('deterministic dossier art leaves the simulation and its RNG untouched',()=>{
 const c=ui('visual-view-only');
 const invariant=expose(c,`(function(){
   const state=()=>JSON.stringify([S,World,Lineage,Hold]);
   const expected=Random.create("art-isolation").next();
   Random.setSeed("art-isolation");
   const before=state(), house=currentHousing(), residents=dossierResidents(dossierHousehold(),null);
   const spec={housing:house,place:currentSettlement().name,kind:currentSettlement().kind,
     people:residents,means:'steady',unrest:.4,surveillance:.8};
   return DossierArt.scene(spec)===DossierArt.scene(spec)&&DossierArt.portrait(S)===DossierArt.portrait(S)&&state()===before&&Random.next()===expected;
 })()`);
 assert.equal(invariant,true);
});

test('the balance updates immediately after a same-year change in assets',()=>{
 const c=ui('visual-balance');
 c.requestAnimationFrame=()=>0;
 const amounts=expose(c,`(function(){
   const cell=$('#val-assets');
   renderAssetsValue(cell);
   S.assets=12000;
   renderAssetsValue(cell);
   return [cell.textContent,money(S.assets)];
 })()`);
 assert.equal(amounts[0],amounts[1]);
});
