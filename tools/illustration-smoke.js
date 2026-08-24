'use strict';
/* One-off end-to-end smoke of the presentation pass in the vm harness:
 * exercises the REAL ui.js functions (renderIdentity, openNotice,
 * openStorySlip, buildYearReportHtml, showNextToast, closeFile) with the
 * illustration system loaded — the exact runtime composition of
 * life-game.html. Not part of npm test; run manually:
 *   node tools/illustration-smoke.js
 */
const {createWorldContext,loadGameFiles,expose}=require('../tests/helpers/vm-loader');

function makeElement(){return {
  className:'',innerHTML:'',textContent:'',
  classList:{add(c){this._cl=(this._cl||new Set());this._cl.add(c);},remove(c){if(this._cl)this._cl.delete(c);},toggle(){},contains(){return false;}},
  style:{setProperty(){}},dataset:{},children:[],value:'',checked:false,disabled:false,
  scrollTop:0,scrollHeight:0,offsetWidth:1200,offsetHeight:900,clientWidth:1200,clientHeight:900,_listeners:[],
  appendChild(){},remove(){},addEventListener(){},removeEventListener(){},setAttribute(){},
  insertAdjacentHTML(pos,html){this.innerHTML+=html;},
  getBoundingClientRect(){return {left:0,top:0,width:1200,height:900};},focus(){},click(){},
  querySelector(){return null;},querySelectorAll(){return []}};}

const context=createWorldContext();
const elements={};
const closedFileEl=makeElement();
const sumcardEl=makeElement();
closedFileEl.querySelector=function(sel){ return sel==='.sumcard'?sumcardEl:null; };
context.document={
  querySelector(s){ if(s==='.closedfile') return closedFileEl; return elements[s]||(elements[s]=makeElement()); },
  querySelectorAll(){return [];},
  getElementById(id){ return id==='slipCard'?elements['#'+id]||(elements['#'+id]=makeElement()) : elements['#'+id]||(elements['#'+id]=makeElement()); },
  createElement(){return makeElement();},
  addEventListener(){}, body:makeElement(), documentElement:makeElement()
};
context.addEventListener=()=>{};
context.timers=[];
context.setTimeout=(fn)=>{context.timers.push(fn);try{fn();}catch(e){console.error('[deferred threw]',e&&e.message,e&&String(e.stack).split('\n')[1]);}return context.timers.length;};
context.clearTimeout=()=>{};
loadGameFiles(context,['js/systems/world-gameplay.js','js/medical.js','js/illustration.js','js/ui.js']);
expose(context,"Random.setSeed('smoke'); newWorld(); newLineage(); newHold(); newSubject();");

// --- subject photo ages across bands ---
expose(context,"S.age=30; World.year=S.dob+S.age;");
console.log('identity @30:',expose(context,"(function(){renderIdentity();return document.getElementById('photo-art').innerHTML.indexOf('<svg')===0?'ok':'MISSING';})()"));
expose(context,"S.age=72; World.year=S.dob+S.age;");
console.log('identity @72:',expose(context,"(function(){renderIdentity();var p=document.querySelector('.photo');var cls=p?p.className:'(no .photo mock)';return JSON.stringify({hasSvg:document.getElementById('photo-art').innerHTML.indexOf('<svg')===0,cls:cls});})()"));

// --- notice slip with routed scene art ---
console.log('notice slip:',expose(context,"(function(){\
  S.age=33;\
  openNotice({title:'A child was born to the subject.',body:'The Bureau congratulates the subject, cautiously.'});\
  var card=document.getElementById('slipCard');\
  var out={hasPlate:card.innerHTML.indexOf('ev-plate')>=0,hasScene:card.innerHTML.indexOf('lf-scene-birth')>=0};\
  document.getElementById('slipWrap').classList.add('hidden'); slipOpen=false;\
  return JSON.stringify(out);})()"));

// --- story slip: busts, speaker emphasis, ending keeps classic treatment ---
expose(context,"World.storyRuns=World.storyRuns||{}; World.storyCounter=1;");
expose(context,"World.storyRuns['story:99999']={id:'story:99999',episodeId:'smoke',domain:'life',title:'T',bg:'street',castKey:'k',signature:'s',startedYear:World.year,status:'playing',cast:{rival:{label:'Foreman Brakke'}},scenes:{a:{lines:[{sp:'narrator',t:'One.'},{sp:'you',t:'Two.'}],goto:'b'},b:{ending:{id:'e1',title:'QUIETLY',tone:'prudent',epilogue:['So.']}}},startScene:'a',sceneId:'a',lineIndex:0,flags:{},tones:[],history:[],finalizedEndingId:null}");
console.log('story line view:',expose(context,"(function(){\
  openStorySlip(true);\
  var card=document.getElementById('slipCard').innerHTML;\
  return JSON.stringify({withCast:card.indexOf('with-cast')>=0,busts:(card.match(/vn-bust /g)||[]).length,\
    activeSpeaker:card.indexOf('active')>=0,dimmed:card.indexOf('dim')>=0,tag:card.indexOf('vn-speaker-tag')>=0});})()"));
console.log('story you-speaker view:',expose(context,"(function(){\
  StorySystem.next(World,{year:World.year,subject:S,lineage:Lineage});\
  openStorySlip(true);\
  var card=document.getElementById('slipCard').innerHTML;\
  return JSON.stringify({youActive:(card.match(/vn-bust[^\\\"]*active/g)||[]).length===1});})()"));
console.log('story ending view:',expose(context,"(function(){\
  StorySystem.next(World,{year:World.year,subject:S,lineage:Lineage});\
  openStorySlip(true);\
  var card=document.getElementById('slipCard').innerHTML;\
  return JSON.stringify({reachedEnding:card.indexOf('THE END')>=0,noBustLayerOnEnding:card.indexOf('with-cast')<0});})()"));
expose(context,"delete World.storyRuns['story:99999'];");

// --- annual report milestone art ---
console.log('annual report art:',expose(context,"(function(){\
  collectingYear=true; yearLog=[];\
  logEv('MILESTONE · Subject was promoted to Chief Engineer.',{happiness:4},'milestone','MILESTONE · YEAR 34');\
  collectingYear=false;\
  reportEntries=yearLog.slice(0,6); reportExtra=0; reportIdx=reportEntries.length; reportAge=S.age;\
  document.getElementById('recentRecordBody').innerHTML=buildYearReportHtml();\
  var h=document.getElementById('recentRecordBody').innerHTML;\
  return JSON.stringify({hasPlate:h.indexOf('ev-plate')>=0,routedScene:/lf-scene-(promotion|firstjob|workplace)/.test(h)});})()"));

// --- chapter + promotion toasts ---
console.log('chapter toast art:',expose(context,"queueChapterCard('elder'); document.getElementById('achieveCard').innerHTML.indexOf('ev-plate')>=0"));
console.log('promotion toast art:',expose(context,"queuePromotionToast({name:'Engineering'},{name:'Chief Engineer',salary:1200}); document.getElementById('achieveCard').innerHTML.indexOf('ev-plate')>=0"));

// --- closed file final plate ---
console.log('closed-file plate:',expose(context,"(function(){\
  closeFile();\
  return JSON.stringify({plateInserted:true});})()"));
console.log('  plate content present:',sumcardEl.innerHTML.indexOf('c-finalPlate')>=0,'| cap:',sumcardEl.innerHTML.indexOf('FINAL RECORD')>=0);

setTimeout(()=>{ console.log('done'); process.exit(0); },1500);
