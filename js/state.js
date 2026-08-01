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
 {id:'gen3',name:'THE HOLD ENDURES · GEN. III',desc:'Reach the third generation of one Hold.',trigger:'live',test:(s,h)=>h&&h.generation>=3},
 {id:'gen5',name:'THE HOLD ENDURES · GEN. V',desc:'Reach the fifth generation of one Hold.',trigger:'live',test:(s,h)=>h&&h.generation>=5},
 {id:'alldistricts',name:'FORM 6-D: THE WHOLE MAP',desc:'Hold all five districts at once.',trigger:'live',test:(s,h)=>h&&h.districts.length>=5},
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
 {id:'gen3clean',name:'THE HOLD ENDURES · CLEAN LINE',desc:'Close three consecutive generations of one Hold at a grade of B or better.',trigger:'live',test:(s,h)=>h&&h.pastLeaders.length>=3&&h.pastLeaders.slice(-3).every(l=>l.grade==='A'||l.grade==='B')},
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
      else ok=a.test(S,Hold);
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

/* ================= HOLD (persistent campaign) ================= */
let Hold=null;
const DISTRICTS=[
 {id:'millquarter',name:'the Mill Quarter',desc:'tenements and textile floors, thick with informants',funds:70,supplies:12,heat:0.3},
 {id:'railyards',name:'the Railway Yards',desc:'freight, smugglers, and men who ask no questions',funds:110,supplies:8,heat:0.4},
 {id:'harborside',name:'Harborside',desc:'docks, black-market goods, papers with someone else’s name',funds:90,supplies:20,heat:0.3},
 {id:'oldtown',name:'Old Town',desc:'the original city, poor, proud, and sympathetic to the cause',funds:40,supplies:8,heat:0.15},
 {id:'garrison',name:'the Garrison District',desc:'under the regime’s own nose — dangerous, lucrative',funds:160,supplies:4,heat:0.6},
];
function newHold(){
  const foundedYear=RI(1917,1936);
  Hold={id:'HOLD-'+foundedYear+'-'+String(RI(1,9999)).padStart(4,'0'),name:null,place:pick(PLACES),
    founded:foundedYear,year:foundedYear,resources:{funds:200,supplies:40},heat:0,trust:60,districts:[],
    cooldowns:{liequiet:0,fortify:0},
    members:[],leaderId:null,generation:1,pastLeaders:[]};
}
function makeMember(m){ return Object.assign({mid:'M'+Math.random().toString(36).slice(2,9),alive:true,loyalty:50,role:'',holdMember:false,holdInviteCooldown:0},m); }
function addMember(m){ const rec=makeMember(m); Hold.members.push(rec); return rec; }
function bearChild(){
  const sex=chance(.5)?'M':'F'; const first=pick(sex==='M'?MALE:FEMALE);
  const leaderName=S.first+' '+S.last;
  const motherName = S.sex==='F' ? leaderName : (S.partner||null);
  const fatherName = S.sex==='M' ? leaderName : (S.partner||null);
  return addMember({first,last:S.last,sex,dob:Hold.year,relation:'child',loyalty:70,motherName,fatherName});
}
function livingMembers(){ return Hold?Hold.members.filter(m=>m.alive):[]; }
function killMember(m){ if(!m||!m.alive) return; m.alive=false; if(m.relation==='child'&&S.kids>0) S.kids--; }
function randomParent(sex,lastName){
  const warmth=RI(5,95), stability=RI(5,95), present=chance(.88), grip=RI(5,95);
  const skillIds=Object.keys(SKILLS), skill=pick(skillIds), skillLvl=RI(2,9);
  return {name:pick(sex==='M'?MALE:FEMALE)+' '+(lastName||pick(LAST)), alive:chance(.85),
    mood:clamp(Math.round(warmth*0.6)+RI(10,30),0,100), estranged:false,
    warmth,stability,present,grip,skill,skillLvl};
}
window.__debug=()=>({S,Hold});

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
  c.affair={active:true,startAge:S.age,startYear:Hold.year,heat:heat,theirHeat:c.npcMarried?heat:0,
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
  S={sex,first:pick(sex==='M'?MALE:FEMALE),last,dob:Hold.year,age:0,alive:true,cause:'',
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
    holdMember:false,holdRecruitCooldown:0,
    wasToxicHome:false,leftBeforeBroke:false,parentWarmAccum:0,parentStableAccum:0,parentYears:0,
    toxicIncidentCount:0,warmIncidentCount:0,breakingPointDone:false,nurturingMilestoneDone:false,parentingStyle:null,
    highlights:[]};
  S.id='SF-'+S.dob+'-'+String(RI(1,99999)).padStart(5,'0');
  S.place=Hold.place;
  S.usedNames.push(S.first);
  S.base={health:S.health,happiness:S.happiness,smarts:S.smarts,looks:S.looks,relations:S.relations};
  S.mother=randomParent('F'); S.father=randomParent('M',last);
  if(!Hold.name) Hold.name='The '+last+' Circle';
  Hold.leaderId=S.id;
}

