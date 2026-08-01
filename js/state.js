'use strict';
/* ================= ARCHIVE (cross-life meta-progression) ================= */
const Archive=(function(){
  const KEY='lifefile.archive.v2';
  function load(){ try{ const raw=localStorage.getItem(KEY); const d=raw?JSON.parse(raw):null; return (d&&d.files)?d:{files:[]}; }catch(e){ return {files:[]}; } }
  function save(data){ try{ localStorage.setItem(KEY,JSON.stringify(data)); }catch(e){} }
  function record(entry){ const data=load(); data.files.push(entry); save(data); return data; }
  function all(){ return load().files; }
  const GORDER=['F','D','C','B','A'];
  function bestGrade(){ return all().reduce((m,f)=>GORDER.indexOf(f.grade)>GORDER.indexOf(m)?f.grade:m,'F'); }
  function bestAge(){ return all().reduce((m,f)=>Math.max(m,f.bestAge||0),0); }
  function count(){ return all().length; }
  return {record, all, bestGrade, bestAge, count};
})();
function unlockedDispIds(){ const ids=[]; if(Archive.count()>=2) ids.push('stoic'); if(Archive.bestGrade()==='A') ids.push('aristo'); return ids; }
function unlockedIntentIds(){ return Archive.count()>=3?['outlast']:[]; }

/* ================= ACHIEVEMENTS (cross-life meta-progression) ================= */
const Achievements=(function(){
  const KEY='lifefile.achievements.v1';
  function load(){ try{ const raw=localStorage.getItem(KEY); const d=raw?JSON.parse(raw):null;
    return (d&&d.unlocked)?d:{unlocked:{},meta:{bestStreakEver:0}}; }catch(e){ return {unlocked:{},meta:{bestStreakEver:0}}; } }
  function save(data){ try{ localStorage.setItem(KEY,JSON.stringify(data)); }catch(e){} }
  function has(id){ return !!load().unlocked[id]; }
  function unlock(id,ctx){ const data=load(); if(data.unlocked[id]) return false;
    data.unlocked[id]={at:Date.now(),ctx:ctx||''}; save(data); return true; }
  function all(){ return load().unlocked; }
  function count(){ return Object.keys(load().unlocked).length; }
  function meta(){ return load().meta||{bestStreakEver:0}; }
  function setMeta(patch){ const data=load(); data.meta=Object.assign(data.meta||{},patch); save(data); }
  return {has,unlock,all,count,meta,setMeta};
})();

const ACHIEVEMENTS=[
 {id:'firstfile',name:'FORM 1: FIRST FILE OPENED',desc:'Open your first subject file.',trigger:'live',test:()=>true},
 {id:'firstclose',name:'FORM 2: FILE PROPERLY CLOSED',desc:'See a subject through to the end of their file.',trigger:'close',test:()=>true},
 {id:'gradeA',name:'COMMENDATION: EXEMPLARY FILE',desc:'Close a file graded A.',trigger:'close',test:g=>g.g==='A'},
 {id:'fivestar',name:'COMMENDATION: TRUE TO INTENT',desc:'Earn a 5-star rating on declared intent.',trigger:'close',test:(g,ir)=>ir&&ir.stars===5},
 {id:'married',name:'FORM 12-M: UNION RECORDED',desc:'Marry.',trigger:'live',test:s=>s.married},
 {id:'threekids',name:'FORM 12-C: A FULL HOUSE',desc:'Raise three or more children in one file.',trigger:'live',test:s=>s.kids>=3},
 {id:'centenarian',name:'FORM 7: THE HUNDRED-YEAR FILE',desc:'Reach the age of 100.',trigger:'live',test:s=>s.age>=100},
 {id:'wealthy',name:'FORM 4-W: A COMFORTABLE ESTATE',desc:'Accumulate assets over $5,000.',trigger:'live',test:s=>s.assets>=5000},
 {id:'maxstat',name:'COMMENDATION: PEAK CONDITION',desc:'Max out any vital index at 100.',trigger:'live',test:s=>[s.health,s.happiness,s.smarts,s.looks].some(v=>v>=100)},
 {id:'marked',name:'FORM 9-B: MARKED, NOT BROKEN',desc:'Survive being marked by the Bureau and keep the file open.',trigger:'live',test:s=>s.marked&&s.alive},
 {id:'gen3',name:'THE FAMILY RECORD · GEN. III',desc:'Reach the third generation of one family line.',trigger:'live',test:(s,ctx)=>ctx.lineage&&ctx.lineage.generation>=3},
 {id:'gen5',name:'THE FAMILY RECORD · GEN. V',desc:'Reach the fifth generation of one family line.',trigger:'live',test:(s,ctx)=>ctx.lineage&&ctx.lineage.generation>=5},
 {id:'alldistricts',name:'FORM 6-D: THE WHOLE MAP',desc:'Bring the Hold into all five districts at once.',trigger:'live',test:(s,ctx)=>ctx.hold&&ctx.hold.districts.length>=5},
 {id:'archive3',name:'THE ARCHIVE GROWS · 3 FILES',desc:'Have three closed files in the Bureau Archive.',trigger:'archive',test:()=>Archive.count()>=3},
 {id:'archive10',name:'THE ARCHIVE GROWS · 10 FILES',desc:'Have ten closed files in the Bureau Archive.',trigger:'archive',test:()=>Archive.count()>=10},
 {id:'streak5',name:'COMMENDATION: FIVE STRAIGHT',desc:'String together 5 consecutive good years.',trigger:'streak',test:s=>s.streak>=5},
 {id:'streak10',name:'COMMENDATION: TEN STRAIGHT',desc:'String together 10 consecutive good years.',trigger:'streak',test:s=>s.streak>=10},
 {id:'grownup',name:'FORM 3: OF AGE',desc:'Reach Young Adulthood.',trigger:'live',test:s=>s.stage==='youngadult'||s.stage==='adulthood'||s.stage==='elder'},
 {id:'fullterm',name:'FORM 8: THE FULL TERM SERVED',desc:'Reach the Elder Years.',trigger:'live',test:s=>s.stage==='elder'},
 {id:'topladder',name:'FORM 5: TOP OF THE LADDER',desc:'Reach the top stage of a career track.',trigger:'live',test:s=>s.career&&s.jobTier===5},
 {id:'firstjob',name:'FORM 5-A: STEADY WORK',desc:'Take a first paying position.',trigger:'live',test:s=>s.jobTier>0},
 {id:'firstpromo',name:'FORM 5-B: MOVING UP',desc:'Earn a first promotion within a career track.',trigger:'live',test:s=>s.career&&s.jobTier>=2},
 {id:'eduupper',name:'FORM 3-E: LEAVING CERTIFICATE',desc:'Complete Upper School.',trigger:'live',test:s=>s.eduCompleted&&s.eduCompleted.upper},
 {id:'edudegree',name:'FORM 3-U: THE FULL COURSE',desc:'Graduate from University.',trigger:'live',test:s=>s.eduCompleted&&s.eduCompleted.university},
 {id:'brokecycle',name:'COMMENDATION: THE CYCLE BROKEN',desc:'Grow up under a harmful guardian, then raise a family of your own that is warm and full.',trigger:'live',test:s=>s.wasToxicHome&&s.kids>0&&s.familyMood>=70},
 {id:'leftintime',name:'FORM 12-L: LEFT IN TIME',desc:'Leave a harmful home before the age of eighteen.',trigger:'live',test:s=>s.leftBeforeBroke},
 {id:'warmfullhouse',name:'FORM 12-W: A FULL HOUSE, WARMLY KEPT',desc:'Raise three or more children in one file, and keep the house a warm one.',trigger:'live',test:s=>s.kids>=3&&s.familyMood>=70},
 {id:'gen3clean',name:'THE FAMILY RECORD · CLEAN LINE',desc:'Close three consecutive family files at a grade of B or better.',trigger:'live',test:(s,ctx)=>ctx.lineage&&ctx.lineage.pastSubjects.length>=3&&ctx.lineage.pastSubjects.slice(-3).every(l=>l.grade==='A'||l.grade==='B')},
 {id:'betrayed',name:'FORM 12-B: BETRAYED, STILL STANDING',desc:'Learn of a spouse’s infidelity, and stay married anyway.',trigger:'live',test:s=>s.__betrayedSurvived===true},
 {id:'doublecross',name:'FORM 9-D: THE DOUBLE CROSS',desc:'Carry on with someone who was, themselves, already married.',trigger:'live',test:s=>s.__hadDoubleAffair===true},
];
function checkAchievements(trigger,ctx){
  const newly=[];
  ACHIEVEMENTS.filter(a=>a.trigger===trigger).forEach(a=>{
    if(Achievements.has(a.id)) return;
    let ok=false;
    try{
      if(trigger==='close') ok=a.test(ctx.grade,ctx.intentResult);
      else if(trigger==='archive') ok=a.test();
      else if(trigger==='streak') ok=a.test(S);
      else ok=a.test(S,{world:World,lineage:Lineage,hold:Hold});
    }catch(e){}
    if(ok && Achievements.unlock(a.id, S?(S.first+' '+S.last+', age '+S.age):'')) newly.push(a);
  });
  if(newly.length) queueAchievementToasts(newly);
}

/* ================= STATE ================= */
let S=null, soundOn=true, slipOpen=false, petitionNo=0, followups=[], quietMode=false;
let typing=false, queue=[], typeTimer=null, currentType=null;
window.C={};
const PUR_MAP={}, DEC_MAP={};
PURSUITS.forEach(p=>PUR_MAP[p.id]=p); DECISIONS.forEach(d=>DEC_MAP[d.id]=d);

/* ================= WORLD, LINEAGE, AND HOLD ================= */
let World=null, Lineage=null, Hold=null;
const DISTRICTS=[
 {id:'millquarter',name:'the Mill Quarter',desc:'tenements and textile floors, thick with informants',funds:70,supplies:12,heat:0.3},
 {id:'railyards',name:'the Railway Yards',desc:'freight, smugglers, and men who ask no questions',funds:110,supplies:8,heat:0.4},
 {id:'harborside',name:'Harborside',desc:'docks, black-market goods, papers with someone else’s name',funds:90,supplies:20,heat:0.3},
 {id:'oldtown',name:'Old Town',desc:'the original city, poor, proud, and sympathetic to the cause',funds:40,supplies:8,heat:0.15},
 {id:'garrison',name:'the Garrison District',desc:'under the regime’s own nose — dangerous, lucrative',funds:160,supplies:4,heat:0.6},
];
const KARSEN_SETTLEMENTS=[
 {id:'branec',name:'Branec',kind:'city',region:'Central Karsen',x:49,y:39,population:'312,000',surveillance:82,travelDifficulty:1,description:'The capital’s registry halls, ministries, tenements, and quiet rooms where a request becomes a ruling.',districts:['Registry Quarter','Old Market','Workers’ Ring','North Offices']},
 {id:'veskar',name:'Veskar',kind:'city',region:'Western Coast',x:18,y:49,population:'184,000',surveillance:58,travelDifficulty:1.1,description:'A salt-wet port where foreign cargo, rumors, and customs forms arrive together.',districts:['Old Docks','Customs Ward','Fishermen’s Row','Salt Market']},
 {id:'eisenmark',name:'Eisenmark',kind:'city',region:'Iron Country',x:64,y:56,population:'226,000',surveillance:74,travelDifficulty:1.25,description:'Factories, barracks, company housing, and the smoke that makes the sky look officially approved.',districts:['Foundry Ward','Barracks','Company Row','Ash Market']},
 {id:'kostrin',name:'Kostrin',kind:'city',region:'South Parishes',x:67,y:27,population:'141,000',surveillance:49,travelDifficulty:.95,description:'Hospitals, colleges, old chapels, and institutions that know how to make a person disappear politely.',districts:['College Hill','Hospital Ward','Chapel District','South Gardens']},
 {id:'rudava',name:'Rudava',kind:'city',region:'Eastern Line',x:84,y:45,population:'98,000',surveillance:68,travelDifficulty:1.05,description:'A railway city built around timetables, freight yards, and people who know which platform is unwatched.',districts:['Junction Ward','Freight Yards','Railway Homes','East Barracks']},
 {id:'dobraven',name:'Dobraven',kind:'town',region:'Western Marches',x:31,y:23,population:'42,000',surveillance:36,travelDifficulty:1.15,description:'An old administrative town whose stone buildings remember governments the Bureau refuses to name.',districts:['County Square','Old Estates','River Road','Lower Town']},
 {id:'krasnava',name:'Krasnava',kind:'village',region:'Southern Farmland',x:55,y:75,population:'3,800',surveillance:24,travelDifficulty:1.3,description:'A farming village of kin, fields, and memories that travel farther than official notices.',districts:['Village Green','North Fields','Mill Road']},
 {id:'brezin',name:'Brezin',kind:'village',region:'Northern Forest',x:29,y:72,population:'2,100',surveillance:31,travelDifficulty:1.45,description:'Forest work, thin roads, and winters that make every missing person look like weather.',districts:['Lower Road','Timber Yard','Hill Houses']},
 {id:'lindava',name:'Lindava',kind:'town',region:'Western Marches',x:10,y:27,population:'12,600',surveillance:28,travelDifficulty:1.2,description:'A market town with old Germanic street names and a newer Karsenian registry over every door.',districts:['Market Row','Bell Quarter','West Fields']},
 {id:'sundervik',name:'Sundervik',kind:'town',region:'Northern Coast',x:73,y:10,population:'8,900',surveillance:44,travelDifficulty:1.6,description:'A northern fishing town where the sea is open in every direction except the one that matters.',districts:['Harbor Steps','Netmakers’ Row','Signal Hill']},
 {id:'oberhain',name:'Oberhain',kind:'village',region:'Iron Country',x:88,y:70,population:'1,700',surveillance:40,travelDifficulty:1.5,description:'A former estate settlement beside a military road, too small to matter and too close to ignore.',districts:['Upper Hain','Chapel Lane','South Yards']},
 {id:'marec',name:'Marec',kind:'town',region:'Eastern Line',x:92,y:25,population:'18,400',surveillance:52,travelDifficulty:1.2,description:'A county seat of grain offices, courthouse steps, and landlords who understand forms very well.',districts:['County Offices','Grain Market','Low Road']},
 {id:'kamenor',name:'Kamenor',kind:'town',region:'Western Coast',x:27,y:54,population:'9,700',surveillance:35,travelDifficulty:1.25,description:'A river crossing with a mill, a customs bridge, and three competing stories about who built it.',districts:['Bridge Ward','Mill Bank','Old Quays']},
 {id:'svetlin',name:'Svetlin',kind:'village',region:'South Parishes',x:81,y:15,population:'2,900',surveillance:21,travelDifficulty:1.35,description:'A village around a clinic and a monastery, both of which insist they are not political.',districts:['Monastery Close','Clinic Road','East Gardens']},
];
const KARSEN_MAP_POSITIONS={
 branec:{x:49,y:42},veskar:{x:14,y:43},eisenmark:{x:66,y:55},kostrin:{x:64,y:29},rudava:{x:83,y:44},
 dobraven:{x:32,y:25},krasnava:{x:51,y:71},brezin:{x:29,y:69},lindava:{x:14,y:23},sundervik:{x:72,y:11},
 oberhain:{x:84,y:69},marec:{x:90,y:27},kamenor:{x:25,y:56},svetlin:{x:82,y:17}
};
KARSEN_SETTLEMENTS.forEach(s=>Object.assign(s,KARSEN_MAP_POSITIONS[s.id]));
const KARSEN_BUILDING_NAMES={
 branec:['National Registry Hall','Bureau Directorate','Branec Central Station','Workers’ Ring Homes','Civic Clinic','Old Market Arcade','Karsenian School','Archive Annex','House of Civic Faith','The Ink & Iron'],
 veskar:['Customs House','Veskar Docks','Harbor Station','Fishermen’s Row Homes','Salt Clinic','Foreign Goods Market','Dock School','Maritime Bureau','The Net & Nail','Warehouse 19'],
 eisenmark:['Foundry Gate','Labor Assignment Office','Ironmark Station','Company Row Homes','Smelter Clinic','Ash Market','Factory School','Military Stores','Workers’ Hall','The Black Kettle'],
 kostrin:['Kostrin College','Medical Registry','South Station','Garden Apartments','Central Hospital','Chapel Market','Parish School','Archive of Measures','Old Chapel','The Quiet Bell'],
 rudava:['Junction Office','Rudava Station','Freight Yard Gate','Railway Homes','Rail Clinic','East Market','Signal School','Transport Bureau','Night Platform','The Last Carriage'],
 dobraven:['County Hall','Old Estates Registry','River Road Station','Lower Town Homes','County Clinic','Dobraven Market','Parish School','Land Office','Old Chapel','The Brass Stag'],
 krasnava:['Village Green Hall','North Field Farm','Mill Road Cottage','Krasnava Clinic','Village School','Grain Store','Old Mill','Parish Chapel','Registry Kiosk','The Red Plough'],
 brezin:['Lower Road House','Timber Yard Office','Hill House','Brezin Clinic','Forest School','Saw Mill','Ranger Station','Chapel Store','Registry Hut','The Winter Room'],
 lindava:['Market Hall','Bell Quarter Homes','West Fields Farm','Lindava Clinic','Market School','Grain Exchange','Old Bell Chapel','County Kiosk','The Green Cart','Coach Yard'],
 sundervik:['Harbor Steps House','Netmakers’ Yard','Signal Hill Station','Sundervik Clinic','Fisher School','Salt Shed','Signal Office','North Chapel','Registry Hut','The Gull & Hook'],
 oberhain:['Upper Hain Estate','Chapel Lane House','South Yards Office','Oberhain Clinic','Garrison School','Military Store','Old Chapel','Road Checkpoint','Registry Hut','The Hain Stag'],
 marec:['County Offices','Grain Market Hall','Low Road Homes','Marec Clinic','County School','Land Registry','Courthouse Chapel','Rail Depot','Bureau Annex','The Filed Deed'],
 kamenor:['Bridge Customs House','Mill Bank Home','Old Quays Warehouse','Kamenor Clinic','River School','Stone Mill','Ferry Office','Quayside Chapel','Registry Kiosk','The Bent Nail'],
 svetlin:['Monastery Close','Clinic Road House','East Gardens Farm','Svetlin Clinic','Parish School','Monastery Store','Pilgrim House','Bureau Health Desk','Old Shrine','The White Lantern'],
};
function inferBuildingType(name){
  const n=name.toLowerCase();
  if(/bureau|registry|customs|courthouse|county|office|hall|archive/.test(n)) return n.includes('bureau')||n.includes('registry')||n.includes('archive')?'bureau':'civic';
  if(/station|depot|rail|yard|platform|junction|checkpoint|ferry/.test(n)) return 'transport';
  if(/clinic|hospital|medical/.test(n)) return 'clinic';
  if(/school|college/.test(n)) return 'school';
  if(/market|exchange|store|goods|shed/.test(n)) return 'market';
  if(/chapel|monastery|shrine|parish/.test(n)) return 'worship';
  if(/home|house|cottage|apartments|row|estate|farm|gardens/.test(n)) return 'residence';
  if(/factory|foundry|mill|warehouse|works|timber|quays|docks|smelter/.test(n)) return 'workplace';
  return 'public';
}
function buildSettlementBuildings(s){
  const names=KARSEN_BUILDING_NAMES[s.id]||[];
  s.buildings=names.map((name,i)=>{const type=inferBuildingType(name);return {id:s.id+'-b'+(i+1),name,type,district:s.districts[i%s.districts.length],x:12+(i%5)*18+(Math.floor(i/5)%2)*4,y:15+Math.floor(i/5)*31,w:10+(i%3)*2,h:8+(i%2)*2,surveillance:clamp(s.surveillance+(type==='bureau'?14:-8)+((i*7)%12),0,100),description:buildingDescription(name,type,s)};});
  return s;
}
function buildingDescription(name,type,s){
  const lines={civic:'Forms are accepted here, eventually.',residence:'A door, a ledger, and somebody who knows the rent.',workplace:'Work is available when the office says it is.',transport:'Arrivals, departures, and papers checked at the gate.',clinic:'Treatment, classification, and a waiting room.',school:'Lessons are given. The curriculum is not optional.',market:'Goods are present, in quantities the Bureau considers sufficient.',bureau:'The state’s hand is closest here.',worship:'A place of quiet, watched more carefully than it admits.',public:'People gather here and pretend that is ordinary.'};
  return lines[type]+' Local surveillance: '+(s.surveillance>65?'high':s.surveillance>35?'present':'light')+'.';
}
KARSEN_SETTLEMENTS.forEach(buildSettlementBuildings);
const KARSEN_ROUTES=[
 {from:'branec',to:'veskar',mode:'rail',distance:34}, {from:'branec',to:'eisenmark',mode:'rail',distance:29},
 {from:'branec',to:'kostrin',mode:'road',distance:24}, {from:'branec',to:'dobraven',mode:'road',distance:27},
 {from:'branec',to:'rudava',mode:'rail',distance:39}, {from:'veskar',to:'kamenor',mode:'road',distance:18},
 {from:'kamenor',to:'krasnava',mode:'road',distance:25}, {from:'dobraven',to:'lindava',mode:'road',distance:18},
 {from:'dobraven',to:'brezin',mode:'road',distance:31}, {from:'eisenmark',to:'rudava',mode:'rail',distance:26},
 {from:'eisenmark',to:'oberhain',mode:'road',distance:22}, {from:'kostrin',to:'svetlin',mode:'road',distance:17},
 {from:'rudava',to:'marec',mode:'rail',distance:21}, {from:'rudava',to:'sundervik',mode:'road',distance:34},
];
function settlementById(id){ return KARSEN_SETTLEMENTS.find(s=>s.id===id)||null; }
function buildingById(settlementId,id){ const s=settlementById(settlementId); return s&&s.buildings.find(b=>b.id===id)||null; }
function routeBetween(a,b){ return KARSEN_ROUTES.find(r=>(r.from===a&&r.to===b)||(r.from===b&&r.to===a))||null; }
function newWorld(){
  const home=settlementById('branec');
  const year=RI(1917,1936);
  World={year,place:home.name,activeSettlementId:home.id,activeBuildingId:home.id+'-b4',map:{discoveredSettlementIds:[home.id],visitedSettlementIds:[home.id],selectedSettlementId:home.id,selectedBuildingId:home.id+'-b4',mode:'national'},mandate:'continuity'};
}
function currentYear(){ return World?World.year:(S?S.dob+S.age:0); }
function currentSettlement(){ return World&&World.activeSettlementId?settlementById(World.activeSettlementId):settlementById('branec'); }
function currentBuilding(){ const s=currentSettlement(); return s&&World?buildingById(s.id,World.activeBuildingId)||s.buildings[0]:null; }
function mapDistance(a,b){ const dx=a.x-b.x,dy=a.y-b.y; return Math.round(Math.sqrt(dx*dx+dy*dy)); }
function travelDestination(id){ return settlementById(id); }
function travelCost(from,to){
  const route=routeBetween(from.id,to.id); const distance=route?route.distance:mapDistance(from,to)*1.7;
  return Math.max(25,Math.round(distance*to.travelDifficulty*1.35));
}
function moveWithinSettlement(buildingId){
  const viewed=settlementById(World&&World.map&&World.map.selectedSettlementId)||currentSettlement();
  const b=viewed&&buildingById(viewed.id,buildingId); if(!viewed||!b||!S) return false;
  World.map.selectedSettlementId=viewed.id; World.map.selectedBuildingId=b.id; World.map.mode='settlement';
  if(World.activeSettlementId===viewed.id){ World.activeBuildingId=b.id; if(S.location) S.location.buildingId=b.id; }
  renderMapIfOpen(); return true;
}
function scheduleTravel(id){
  if(!S||!World||S.traveling) return {ok:false,reason:'already travelling'};
  const from=currentSettlement(), to=travelDestination(id); if(!from||!to||from.id===to.id) return {ok:false,reason:'already there'};
  if(S.age<16) return {ok:false,reason:'no independent travel before age 16'};
  const cost=travelCost(from,to); if(S.assets<cost) return {ok:false,reason:'needs '+money(cost)};
  const route=routeBetween(from.id,to.id); const permitRisk=clamp((to.surveillance+S.scrutiny)/250,0.05,.7);
  S.assets-=cost;
  S.traveling={from:from.id,to:to.id,departYear:currentYear(),arriveYear:currentYear()+1,cost,mode:route?route.mode:'unregistered road',permitRisk};
  S.scrutiny=clamp(S.scrutiny+(route?2:6),0,100);
  updatePersonalStanding();
  logEv('TRAVEL FILE. Subject departed '+from.name+' for '+to.name+' by '+(route?route.mode:'an unregistered road')+'. Fare paid: '+money(cost)+'. Arrival is filed for next year.',{assets:0,happiness:-1},'plan','MOVEMENT · YEAR '+S.age);
  renderStats(window.C||{}); return {ok:true};
}
function resolveTravel(){
  if(!S||!S.traveling||S.traveling.arriveYear>currentYear()) return;
  const trip=S.traveling, to=settlementById(trip.to); S.traveling=null;
  if(!to) return;
  const delayed=chance(trip.permitRisk*.45);
  if(delayed){ S.scrutiny=clamp(S.scrutiny+10,0,100); S.happiness=clamp(S.happiness-4,0,100);
    logEv('The train was held at a checkpoint. The subject arrived late, searched, and with one more note in the margin.',{happiness:-4},'ruling','CHECKPOINT · YEAR '+S.age);
  }
  World.activeSettlementId=to.id; World.place=to.name; World.activeBuildingId=to.buildings.find(b=>b.type==='residence')?.id||to.buildings[0].id;
  World.map.selectedSettlementId=to.id; World.map.selectedBuildingId=World.activeBuildingId; World.map.mode='settlement';
  if(!World.map.visitedSettlementIds.includes(to.id)) World.map.visitedSettlementIds.push(to.id);
  if(!World.map.discoveredSettlementIds.includes(to.id)) World.map.discoveredSettlementIds.push(to.id);
  S.place=to.name; S.location={settlementId:to.id,buildingId:World.activeBuildingId};
  logEv('Subject arrived in '+to.name+'. The new address was entered on the file.',{},'milestone','ARRIVAL · YEAR '+S.age);
  updatePersonalStanding(); renderIdentity(); renderStats(window.C||{});
}
function renderMapIfOpen(){ if(typeof renderMap==='function'&&$('#mapWrap')&&!$('#mapWrap').classList.contains('hidden')) renderMap(); }
function newLineage(){
  Lineage={id:'LINE-'+currentYear()+'-'+String(RI(1,9999)).padStart(4,'0'),name:null,place:World.place,
    founded:currentYear(),members:[],activeSubjectId:null,generation:1,pastSubjects:[]};
}
function newHold(){
  Hold={id:'HOLD-'+currentYear()+'-'+String(RI(1,9999)).padStart(4,'0'),name:null,place:World.place,
    founded:currentYear(),resources:{funds:200,supplies:40},heat:0,trust:60,districts:[],cooldowns:{liequiet:0,fortify:0},members:[]};
}

/* Personal systems intentionally do not depend on Hold enrollment. */
const MEDICAL_CONDITIONS={
  respiratory:{name:'Respiratory complaint',note:'breath catches in cold weather',minAge:8,base:2},
  injury:{name:'Lingering injury',note:'pain returns with work and weather',minAge:12,base:3},
  strain:{name:'Nervous strain',note:'sleep is thin and easily broken',minAge:16,base:2},
  chronic:{name:'Chronic condition',note:'requires regular treatment',minAge:38,base:3},
};
function ensurePersonalSystems(s){
  if(!s) return;
  if(s.freedom==null) s.freedom=70;
  if(s.bureauFavor==null) s.bureauFavor=0;
  if(s.scrutiny==null) s.scrutiny=0;
  if(s.housingSecurity==null) s.housingSecurity=50;
  if(s.financialSecurity==null) s.financialSecurity=50;
  if(s.medicalRecord==null) s.medicalRecord=false;
  if(!Array.isArray(s.conditions)) s.conditions=[];
  if(s.lastFavorYear==null) s.lastFavorYear=currentYear();
}
function securityLabel(value){ return value>=75?'secure':value>=50?'steady':value>=28?'precarious':'at risk'; }
function freedomLabel(value){ return value>=75?'largely unrestrained':value>=50?'limited but workable':value>=28?'closely limited':'under constraint'; }
function scrutinyLabel(value){ return value>=70?'active attention':value>=40?'under review':value>=15?'noted':'no current attention'; }
function updatePersonalStanding(){
  if(!S) return; ensurePersonalSystems(S);
  const house=typeof currentHousing==='function'?currentHousing():null;
  const food=typeof currentFood==='function'?currentFood():null;
  const atHome=S.age<16||S.livingAtHome;
  let housing=atHome?60:({none:4,room:35,flat:62,house:80,townhouse:90,estate:98}[house&&house.id]||45);
  let financial=atHome?55:50;
  if(!atHome){
    const outlay=(house?house.rent:0)+(food?food.cost:0)+(S.kids&&typeof currentChildcare==='function'?currentChildcare().costPerKid*S.kids:0)+(S.liabilities||[]).reduce((n,l)=>n+l.annualPayment,0);
    financial=clamp(50+Math.min(30,S.assets/180)+Math.min(20,Math.max(0,S.jobTier)*5)-Math.min(35,outlay/110)-Math.min(25,Math.max(0,-S.assets)/180),0,100);
  }
  S.housingSecurity=clamp(Math.round(housing),0,100);
  S.financialSecurity=clamp(Math.round(financial),0,100);
  const medicalLoad=S.conditions.reduce((n,c)=>n+(c.severity||0)*3,0);
  const ageRestriction=S.age<16?Math.max(0,62-S.age*4):0;
  const restriction=ageRestriction+(S.record?13:0)+S.scrutiny*.42+Math.max(0,35-S.financialSecurity)*.28+(S.jailUntil>S.age?55:0)+medicalLoad;
  S.freedom=clamp(Math.round(88-restriction+Math.min(8,S.bureauFavor*2)),0,100);
}
function activeConditions(){ return S&&S.conditions?S.conditions.filter(c=>!c.resolved):[]; }
function conditionById(id){ return S&&S.conditions?S.conditions.find(c=>c.id===id&&!c.resolved):null; }
function addCondition(id,severity){
  if(!S||!MEDICAL_CONDITIONS[id]) return null;
  const existing=conditionById(id);
  if(existing){ existing.severity=clamp(Math.max(existing.severity||1,severity||1),1,5); return existing; }
  const rec={id,severity:clamp(severity||MEDICAL_CONDITIONS[id].base,1,5),known:false,treated:false,years:0,resolved:false};
  S.conditions.push(rec); return rec;
}
function medicalExamination(source){
  ensurePersonalSystems(S); S.medicalRecord=true;
  let condition=activeConditions().find(c=>!c.known);
  if(!condition){
    const risk=(S.health<58?0.55:0)+(S.age>=45?0.18:0)+(S.vice>=4?0.16:0)+(S.lifestyle&&S.lifestyle.food==='meager'?0.18:0);
    if(chance(Math.min(.72,.12+risk))){
      const choices=Object.keys(MEDICAL_CONDITIONS).filter(id=>S.age>=MEDICAL_CONDITIONS[id].minAge);
      condition=addCondition(pick(choices),S.health<38?4:undefined);
    }
  }
  if(condition){ condition.known=true; condition.treated=false; const info=MEDICAL_CONDITIONS[condition.id];
    return {condition,found:true,text:'The examination entered '+info.name.toLowerCase()+' in the medical file. Treatment is now available.'}; }
  return {condition:null,found:false,text:source==='desk'?'The inspection found no condition requiring a treatment order. The Bureau filed the clean page.':'The doctor found nothing urgent. The visit still goes into the medical file.'};
}
function treatCondition(id){
  const c=conditionById(id); if(!c||!c.known) return null;
  const info=MEDICAL_CONDITIONS[c.id]; const cost=70+c.severity*55;
  c.treated=true; c.severity=Math.max(0,c.severity-2); c.years++;
  if(c.severity===0){ c.resolved=true; return {cost,resolved:true,text:'Treatment cleared the '+info.name.toLowerCase()+'. The medical file is amended, not erased.'}; }
  return {cost,resolved:false,text:'Treatment eased the '+info.name.toLowerCase()+'. It remains on file, but no longer has the whole say.'};
}
function runPersonalYearTick(){
  if(!S) return; ensurePersonalSystems(S);
  const conditions=activeConditions(); let healthHit=0;
  conditions.forEach(c=>{
    c.years++;
    if(c.treated){ c.severity=Math.max(0,c.severity-1); c.treated=false; if(c.severity===0) c.resolved=true; }
    else healthHit-=Math.max(1,Math.ceil(c.severity/2));
  });
  if(healthHit&&typeof applyFx==='function') applyFx({health:healthHit});
  const misconduct=(S.record?7:0)+S.crime*4+S.vice*1.5;
  const cooling=S.bureauFavor>0?2:4;
  S.scrutiny=clamp(Math.round(S.scrutiny+misconduct-cooling),0,100);
  if(S.age>=18&&!S.record&&S.vice<=1&&S.scrutiny<20&&currentYear()-S.lastFavorYear>=5){
    S.bureauFavor=Math.min(3,S.bureauFavor+1); S.lastFavorYear=currentYear();
    logEv('The file remained unremarkable long enough to earn a small Bureau Favor. It is not kindness, but it can be spent.',{},'ruling','PERSONAL STANDING');
  }
  updatePersonalStanding();
}
function makeKin(m){ return Object.assign({mid:'K'+Math.random().toString(36).slice(2,9),alive:true,bond:70,holdMember:false,holdLoyalty:0,holdInviteCooldown:0},m); }
function addKin(m){ const rec=makeKin(m); Lineage.members.push(rec); return rec; }
function makeHoldMember(m){ return Object.assign({mid:'H'+Math.random().toString(36).slice(2,9),alive:true,loyalty:50,role:'',holdMember:true,holdInviteCooldown:0},m); }
function addHoldMember(m){ const rec=makeHoldMember(m); Hold.members.push(rec); return rec; }
function bearChild(){
  const sex=chance(.5)?'M':'F'; const first=pick(sex==='M'?MALE:FEMALE);
  const leaderName=S.first+' '+S.last;
  const motherName = S.sex==='F' ? leaderName : (S.partner||null);
  const fatherName = S.sex==='M' ? leaderName : (S.partner||null);
  return addKin({first,last:S.last,sex,dob:currentYear(),relation:'child',bond:70,motherName,fatherName});
}
function livingKin(){ return Lineage?Lineage.members.filter(m=>m.alive):[]; }
function livingHoldMembers(){ return Hold?Hold.members.filter(m=>m.alive).concat(livingKin().filter(m=>m.holdMember)):[]; }
function findHoldMember(mid){ return (Hold&&Hold.members.find(m=>m.mid===mid))||livingKin().find(m=>m.mid===mid&&m.holdMember)||null; }
function holdLoyalty(m){ return m?(m.holdMember&&m.holdLoyalty!=null?m.holdLoyalty:(m.loyalty??50)):0; }
function changeHoldLoyalty(m,delta){ if(!m) return; if(m.holdMember&&m.holdLoyalty!=null) m.holdLoyalty=clamp(m.holdLoyalty+delta,0,100); else m.loyalty=clamp((m.loyalty||50)+delta,0,100); }
function enrollKinInHold(m,loyalty){ if(!m) return; m.holdMember=true; m.holdLoyalty=loyalty==null?50:loyalty; }
function killKin(m){ if(!m||!m.alive) return; m.alive=false; if(m.relation==='child'&&S.kids>0) S.kids--; }
function killHoldMember(m){
  if(!m||!m.alive) return;
  if(m.relation==='child'&&Lineage&&Lineage.members.includes(m)){ killKin(m); return; }
  m.alive=false;
}
function randomParent(sex,lastName){
  const warmth=RI(5,95), stability=RI(5,95), present=chance(.88), grip=RI(5,95);
  const skillIds=Object.keys(SKILLS), skill=pick(skillIds), skillLvl=RI(2,9);
  return {name:pick(sex==='M'?MALE:FEMALE)+' '+(lastName||pick(LAST)), alive:chance(.85),
    mood:clamp(Math.round(warmth*0.6)+RI(10,30),0,100), estranged:false,
    warmth,stability,present,grip,skill,skillLvl};
}
window.__debug=()=>({World,Lineage,S,Hold});

/* ================= CONTACTS (romance/friendship roster) ================= */
const MAX_CONTACTS=5;
function makeContact(sex,bias){
  const last=pick(LAST);
  const npcMarried=chance(0.3);
  const b=bias||{};
  const rt=(key,def)=>b[key]?RI(b[key][0],b[key][1]):RI(def[0],def[1]);
  return {cid:'N'+Math.random().toString(36).slice(2,9), name:pick(sex==='M'?MALE:FEMALE)+' '+last, sex,
    role:'friend', mood:RI(55,75), metAge:S.age,
    temperament:rt('temperament',[0,100]), fidelity:rt('fidelity',[15,95]), charm:rt('charm',[15,95]),
    kindness:rt('kindness',[5,95]), intellect:rt('intellect',[5,95]),
    npcMarried, npcSpouseName: npcMarried?(pick(sex==='M'?FEMALE:MALE)+' '+pick(LAST)):null,
    npcSpouseTemperament: npcMarried?RI(0,100):null,
    affair:null, reverseAffair:null};
}
function startAffairWith(c,heat){
  if(!S.activeAffairCids) S.activeAffairCids=[];
  if(!S.activeAffairCids.includes(c.cid)) S.activeAffairCids.push(c.cid);
  c.affair={active:true,startAge:S.age,startYear:currentYear(),heat:heat,theirHeat:c.npcMarried?heat:0,
    yearsActive:0,coverTracksThisYear:false,discovered:false,theirDiscovered:false};
  S.vice=Math.min(10,S.vice+1);
  if(c.npcMarried) S.__hadDoubleAffair=true;
}
function syncPartnerMirror(){
  const p=S.contacts.find(c=>c.role==='partner'||c.role==='spouse');
  S.partner=p?p.name:null; S.partnerMood=p?p.mood:0;
}
function activePartnerContact(){ return S.contacts.find(c=>c.role==='partner'||c.role==='spouse')||null; }
function hasPartner(s){ return !!activePartnerContact(); }
function worstFadingFriend(){
  const cands=S.contacts.filter(c=>c.role==='friend');
  if(!cands.length) return null;
  return cands.reduce((worst,c)=>(!worst||c.mood<worst.mood)?c:worst,null);
}

function pickName(pool){
  const avail=pool.filter(n=>!S.usedNames.includes(n));
  const chosen=pick(avail.length?avail:pool);
  S.usedNames.push(chosen);
  return chosen;
}
function newSubject(){
  const sex=chance(.5)?'M':'F', last=pick(LAST);
  const fam=pickWeighted(FAMILY_TIERS);
  S={sex,first:pick(sex==='M'?MALE:FEMALE),last,dob:currentYear(),age:0,alive:true,cause:'',
    health:RI(58,88),happiness:RI(48,78),smarts:RI(28,82),looks:RI(28,80),relations:RI(35,70),
    assets:0,jobTier:0,jobName:'Minor',pensionBase:0,
    status:'Single',partner:null,married:false,kids:0,
    partnerMood:0,friendMood:0,familyMood:0,
    friend:null,contacts:[],activeAffairCids:[],edu:false,record:false,vice:0,crime:0,jailUntil:0,favorCool:0,
    didCoast:false,didLeave:false,planted:false,peakHap:0,avgHap:0,hapSum:0,hapYears:0,acts:0,
    base:null,
    photoSeed:RI(0,99),photoTint:pick(TINTS),
    usedV:{},cool:{},desk:{subsidy:0,checkup:0,censure:0},warned:{},queue:[],usedNames:[],skills:{},practicedSkill:null,petDone:{},garnishUntil:0,bankrupt:false,autoTrain:false,marked:false,markedNote:'',healthCap:100,looksCap:100,
    streak:0,bestStreak:0,yearAccum:{},stage:'infancy',career:null,vacancies:[],careerYears:0,
    eduStage:null,eduYearsIn:0,eduDropped:false,eduCompleted:{},pendingSchoolStage:null,
    familyTier:fam.id,lifestyle:{housing:fam.housing,food:fam.food,childcare:fam.childcare},liabilities:[],livingAtHome:true,
    freedom:70,bureauFavor:0,scrutiny:0,housingSecurity:60,financialSecurity:55,medicalRecord:false,conditions:[],lastFavorYear:currentYear(),
    holdMember:false,holdRecruitCooldown:0,
    location:{settlementId:World.activeSettlementId,buildingId:World.activeBuildingId},traveling:null,
    wasToxicHome:false,leftBeforeBroke:false,parentWarmAccum:0,parentStableAccum:0,parentYears:0,
    toxicIncidentCount:0,warmIncidentCount:0,breakingPointDone:false,nurturingMilestoneDone:false,parentingStyle:null,
    highlights:[]};
  S.id='SF-'+S.dob+'-'+String(RI(1,99999)).padStart(5,'0');
  S.place=Lineage.place;
  S.place=World.place;
  S.usedNames.push(S.first);
  S.base={health:S.health,happiness:S.happiness,smarts:S.smarts,looks:S.looks,relations:S.relations};
  S.mother=randomParent('F'); S.father=randomParent('M',last);
  if(!Lineage.name) Lineage.name='The '+last+' Family';
  Lineage.activeSubjectId=S.id;
  updatePersonalStanding();
}
