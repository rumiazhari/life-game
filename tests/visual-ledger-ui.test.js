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
 loadGameFiles(c,['js/systems/world-gameplay.js','js/medical.js','js/ui.js']);c.activeConditions=()=>[];
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
 assert.match(h,/cover-world-art/);assert.match(h,/SECTION C — HOME &amp; WORLD/);
 assert.match(h,/js\/ui\.js\?v=20261117-p12/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.lv-smoke/);assert.match(css,/\.lv-gauge-ring/);
});
