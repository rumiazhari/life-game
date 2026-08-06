'use strict';
const $=s=>document.querySelector(s);
const R=(a,b)=>Random.range(a,b);
const RI=(a,b)=>Random.int(a,b);
const pick=a=>Random.pick(a);
const chance=p=>Random.chance(p);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const money=n=>(n<0?'−$':'$')+Math.abs(Math.round(n)).toLocaleString('en-US');
const P=p=>Math.round(clamp(p,0,1)*100)+'%';

const MALE=['Arthur','Elias','Hugo','Stanislaw','Dmitri','Tobias','Viktor','Oskar','Bruno','Milan','Anton','Felix','Rudolf','Janek','Caspar','Emil','Leopold','Otis','Pavel','Roman','Wilhelm','Karel','Boris','Anders','Gustav','Konrad','Tomas','Erik','Henrik','Ludwig','Adrian','Marek','Zoltan','Miklos','Ferenc','Aleksander','Nikolai','Ivo','Rasmus','Jozef','Vaclav','Matthias','Bernard','Lukas','Frantisek','Gunnar','Sten','Ingmar','Alois','Radek'];
const FEMALE=['Marta','Vera','Ingrid','Rosa','Alma','Leni','Greta','Nadia','Elsa','Thea','Petra','Dana','Sylvia','Olga','Beata','Wanda','Magda','Freya','Ida','June','Helene','Zofia','Anya','Sigrid','Klara','Milena','Renata','Ivana','Astrid','Liesl','Ottilie','Hanna','Ruth','Edith','Grazyna','Danuta','Bozena','Irenka','Katarina','Lotte','Signe','Ester','Marika','Yolanda','Berta','Agnes','Rozalia','Vesna','Zora','Alena'];
const LAST=['Kovacs','Lindqvist','Baran','Stein','Novak','Weiss','Petrov','Hale','Marek','Vogel','Sokol','Brandt','Orlov','Fischer','Zeman','Keller','Polak','Richter','Urban','Slezak','Meyer','Dvorak','Lang','Nemec','Hoffman','Kral','Bauer','Witkowski','Engel','Molnar'];
const PLACES=['Branec','Veskar','Krasnava','Eisenmark','Kostrin','Rudava','Dobraven','Brezin','Lindava','Sundervik','Oberhain','Marec','Kamenor','Svetlin'];
const INC={0:0,1:950,2:1650,3:2600,4:4300,5:7200};
const SKILLS={
 craft:{name:'Craft & Mechanics',icon:'🔧',minAge:10,tiers:[
   'Fix a wobbly chair, patch a fence',
   'Wire a lamp, unclog a drain',
   'Build simple furniture from scrap',
   'Overhaul a bicycle or motor',
   'Rewire a room, frame a wall',
   'Rebuild an engine from parts',
   'Forge and fit custom ironwork',
   'Renovate a house start to finish',
   'Run a full workshop, train apprentices',
   'Master tradesman — nothing built or broken beats you']},
 land:{name:'Land & Provisions',icon:'🌾',minAge:6,tiers:[
   'Keep a windowsill herb pot alive',
   'Grow a proper vegetable garden',
   'Bake bread from scratch',
   'Keep a beehive, brew simple cider',
   'Run a small home farm plot',
   'Fish and hunt for the table reliably',
   'Cater a neighbor’s wedding from your own kitchen',
   'Run a working smallholding — livestock, crop rotation',
   'Supply a local market stall regularly',
   'Own and operate a working estate farm']},
 care:{name:'Care & Medicine',icon:'🩺',minAge:10,tiers:[
   'Mind a neighbor’s child for an afternoon',
   'Nurse a cold, dress a scraped knee',
   'Cut hair passably',
   'Care for a bedridden relative',
   'Assist a doctor with routine rounds',
   'Run a household of dependents smoothly',
   'Handle emergencies calmly under pressure',
   'Manage a ward of patients',
   'Diagnose and treat serious illness',
   'Run a clinic — the town’s first call in a crisis']},
 academics:{name:'Academics',icon:'📚',minAge:6,tiers:[
   'Read and write competently',
   'Hold a conversation in a second tongue',
   'Keep tidy household accounts',
   'Write a coherent letter or essay',
   'Tutor a child through their lessons',
   'Argue a position and win it',
   'Draft a contract or legal brief',
   'Lecture a room and hold its attention',
   'Publish original research',
   'Recognized authority — consulted, cited, quoted']},
 design:{name:'Design & Engineering',icon:'📐',minAge:12,tiers:[
   'Sketch a floor plan to scale',
   'Draft basic technical drawings',
   'Calculate load and stress by hand',
   'Design a small structure start to finish',
   'Oversee a construction site’s technical plan',
   'Engineer a bridge or industrial system',
   'Design a public building',
   'Solve engineering failures under deadline',
   'Lead design on a landmark project',
   'Name behind buildings that outlive you']},
 arts:{name:'Arts & Performance',icon:'🎨',minAge:6,tiers:[
   'Doodle a decent likeness',
   'Carry a tune, keep basic time',
   'Take a photograph worth keeping',
   'Perform for friends without flinching',
   'Hold a small local audience',
   'Sell a piece of original work',
   'Headline a modest venue',
   'Exhibit or tour regionally',
   'Command a paying national audience',
   'A name people recognize on sight']},
 retail:{name:'Retail & Trade Service',icon:'🛒',minAge:10,tiers:[
   'Fold, stock, and sweep a shop floor',
   'Mend a torn hem',
   'Talk a customer into the sale',
   'Run a till and a stockroom alone',
   'Tailor a garment from measurements',
   'Manage a small storefront',
   'Keep a shop profitable through a bad season',
   'Supply and staff a full outlet',
   'Franchise the operation',
   'A name on the storefront everyone knows']},
 athletics:{name:'Athletics',icon:'🏃',minAge:6,tiers:[
   'Run further than you’d like to',
   'Swim a length without stopping',
   'Sit a horse without falling off',
   'Land a clean punch, and take one',
   'Train seriously, most mornings',
   'Compete and place locally',
   'Compete regionally',
   'Turn professional',
   'Compete nationally',
   'A name in the record books']},
 social:{name:'Social & Leadership',icon:'🤝',minAge:10,tiers:[
   'Hold a room’s attention for a minute',
   'Talk a stranger into a favor',
   'Talk a stranger into a purchase',
   'Run a small team without it falling apart',
   'Negotiate a fair deal for both sides',
   'Manage a department under pressure',
   'Broker a deal between rivals',
   'Run an organization of scale',
   'Represent interests at the highest table',
   'The name in the room decisions get made around']},
 underworld:{name:'Underworld',icon:'🗝',minAge:12,tiers:[
   'Pick a simple lock',
   'Move a small parcel, no questions asked',
   'Fake a signature convincingly',
   'Move goods past a checkpoint',
   'Forge a passable document',
   'Run a small smuggling route',
   'Launder money through a front',
   'Run a crew, keep it loyal',
   'Operate untouched by the law for years',
   'A name whispered, never written down']},
};
const SKILL_PRACTICE_FX={
 craft:{health:1,happiness:1},
 land:{health:1,happiness:1},
 care:{happiness:2},
 academics:{smarts:1},
 design:{smarts:1},
 arts:{happiness:2,looks:1},
 retail:{happiness:1},
 athletics:{health:2,looks:1},
 social:{happiness:1,looks:1},
 underworld:{smarts:1,happiness:-1},
};
const JOBLIST=[
 {name:'Day Laborer',tier:1,skill:null,req:0},{name:'File Clerk',tier:1,skill:'academics',req:1},{name:'Warehouse Hand',tier:1,skill:null,req:0},
 {name:'Street Sweeper',tier:1,skill:null,req:0},{name:'Farmhand',tier:1,skill:'land',req:1},{name:'Kitchen Hand',tier:1,skill:'land',req:1},
 {name:'Machinist',tier:2,skill:'craft',req:4},{name:'Schoolteacher',tier:2,skill:'academics',req:4},{name:'Postal Clerk',tier:2,skill:'academics',req:3},
 {name:'Electrician',tier:2,skill:'craft',req:4},{name:'Carpenter',tier:2,skill:'craft',req:4},{name:'Shopkeeper',tier:2,skill:'social',req:3},
 {name:'Accountant',tier:3,skill:'academics',req:6},{name:'Civil Engineer',tier:3,skill:'design',req:6},{name:'Physician',tier:3,skill:'care',req:7},
 {name:'Magistrate',tier:3,skill:'academics',req:7},{name:'Architect',tier:3,skill:'design',req:6},
 {name:'Branch Manager',tier:4,skill:'social',req:6},{name:'Chief Engineer',tier:4,skill:'design',req:8},{name:'Hospital Director',tier:4,skill:'care',req:8},
 {name:'Company Director',tier:5,skill:'social',req:8},{name:'Ministry Official',tier:5,skill:'academics',req:8},{name:'Bank President',tier:5,skill:'academics',req:9},
];
const TIER_MINAGE=[0,16,18,22,28,34];
function jobsForTier(t){return JOBLIST.filter(j=>j.tier===t);}
function jobQualifies(job){return S.age>=TIER_MINAGE[job.tier]&&(!job.skill||(S.skills[job.skill]||0)>=job.req);}
function bestJobForTier(t){const cands=jobsForTier(t).filter(jobQualifies); if(!cands.length)return null;
  cands.sort((a,b)=>(S.skills[b.skill]||0)-(S.skills[a.skill]||0)); return cands[0];}
function highestQualifyingTier(cap){const max=cap||5; let best=0; for(let t=1;t<=max;t++){ if(bestJobForTier(t)) best=t; } return best;}
const CAREERS=[
 {id:'academia',name:'Academia',icon:'🎓',minEdu:'university',stages:[
   {name:'Teaching Assistant',salary:900,req:{academics:2}},
   {name:'Lecturer',salary:1700,req:{academics:4}},
   {name:'Assistant Professor',salary:2800,req:{academics:6}},
   {name:'Associate Professor',salary:4500,req:{academics:8}},
   {name:'Professor',salary:7500,req:{academics:10}}]},
 {id:'medicine',name:'Medicine',icon:'⚕',minEdu:'university',stages:[
   {name:'Orderly',salary:1000,req:{care:2}},
   {name:'Registered Nurse',salary:1900,req:{care:4}},
   {name:'Resident Physician',salary:3100,req:{care:6,academics:4}},
   {name:'Attending Physician',salary:5000,req:{care:8,academics:6}},
   {name:'Chief of Medicine',salary:8200,req:{care:10,academics:8}}]},
 {id:'law',name:'Law & Civil Service',icon:'⚖',minEdu:'university',stages:[
   {name:'Court Clerk',salary:950,req:{academics:2}},
   {name:'Associate Counsel',salary:1800,req:{academics:4}},
   {name:'Attorney',salary:2900,req:{academics:6,social:4}},
   {name:'Magistrate',salary:4700,req:{academics:8,social:6}},
   {name:'Chief Magistrate',salary:7800,req:{academics:10,social:8}}]},
 {id:'engineering',name:'Engineering',icon:'⚙',minEdu:'university',stages:[
   {name:'Drafting Assistant',salary:950,req:{design:2}},
   {name:'Junior Engineer',salary:1750,req:{design:4}},
   {name:'Civil Engineer',salary:2800,req:{design:6,craft:4}},
   {name:'Chief Engineer',salary:4600,req:{design:8,craft:6}},
   {name:'Chief Architect',salary:7600,req:{design:10,social:6}}]},
 {id:'architecture',name:'Architecture & Design',icon:'📐',minEdu:'university',stages:[
   {name:'Draughtsman',salary:900,req:{design:2}},
   {name:'Junior Architect',salary:1700,req:{design:4}},
   {name:'Project Architect',salary:2900,req:{design:6,arts:3}},
   {name:'Senior Architect',salary:4700,req:{design:8,social:5}},
   {name:'Principal Architect',salary:7700,req:{design:10,social:7}}]},
 {id:'business',name:'Business & Finance',icon:'💼',minEdu:'upper',stages:[
   {name:'File Clerk',salary:900,req:{academics:2}},
   {name:'Bookkeeper',salary:1650,req:{academics:4}},
   {name:'Accountant',salary:2600,req:{academics:6,social:4}},
   {name:'Branch Manager',salary:4300,req:{academics:8,social:6}},
   {name:'Bank President',salary:7200,req:{academics:10,social:8}}]},
 {id:'trade',name:'Trade & Industry',icon:'🔧',stages:[
   {name:'Apprentice',salary:850,req:{craft:2}},
   {name:'Journeyman',salary:1550,req:{craft:4}},
   {name:'Tradesman',salary:2400,req:{craft:6}},
   {name:'Master Craftsman',salary:3900,req:{craft:8}},
   {name:'Shop Owner',salary:6500,req:{craft:10,social:6}}]},
 {id:'construction',name:'Construction & Craft',icon:'🧱',stages:[
   {name:'Laborer',salary:800,req:{craft:2}},
   {name:'Carpenter',salary:1500,req:{craft:4}},
   {name:'Foreman',salary:2500,req:{craft:6,design:3}},
   {name:'Site Manager',salary:4100,req:{craft:8,design:5,social:4}},
   {name:'Master Builder',salary:6800,req:{craft:10,design:7,social:6}}]},
 {id:'transport',name:'Transport & Logistics',icon:'🚚',stages:[
   {name:'Courier',salary:800,req:{craft:2}},
   {name:'Delivery Driver',salary:1450,req:{craft:4}},
   {name:'Dispatcher',salary:2300,req:{craft:6,social:4}},
   {name:'Fleet Manager',salary:3800,req:{craft:7,social:6,academics:4}},
   {name:'Transport Director',salary:6300,req:{craft:8,social:8,academics:6}}]},
 {id:'culinary',name:'Culinary Arts',icon:'🍳',stages:[
   {name:'Kitchen Hand',salary:800,req:{land:2}},
   {name:'Line Cook',salary:1500,req:{land:4}},
   {name:'Sous Chef',salary:2500,req:{land:6,retail:3}},
   {name:'Head Chef',salary:4100,req:{land:8,retail:5}},
   {name:'Executive Chef',salary:6900,req:{land:10,social:6}}]},
 {id:'agriculture',name:'Agriculture & Land',icon:'🌾',stages:[
   {name:'Farmhand',salary:750,req:{land:2}},
   {name:'Tenant Farmer',salary:1400,req:{land:4}},
   {name:'Estate Steward',salary:2300,req:{land:6,social:3}},
   {name:'Landholder',salary:3800,req:{land:8,social:5}},
   {name:'Estate Owner',salary:6400,req:{land:10,social:7}}]},
 {id:'care',name:'Care Services',icon:'🩺',minEdu:'middle',stages:[
   {name:'Attendant',salary:800,req:{care:2}},
   {name:'Nurse’s Aide',salary:1500,req:{care:4}},
   {name:'Senior Aide',salary:2400,req:{care:6}},
   {name:'Ward Sister',salary:3900,req:{care:8,social:4}},
   {name:'Matron',salary:6600,req:{care:10,social:6}}]},
 {id:'service',name:'Retail & Service',icon:'🛒',stages:[
   {name:'Shop Assistant',salary:800,req:{retail:2}},
   {name:'Sales Clerk',salary:1450,req:{retail:4}},
   {name:'Shopkeeper',salary:2400,req:{retail:6,social:4}},
   {name:'Store Manager',salary:3900,req:{retail:8,social:6}},
   {name:'Trade Magnate',salary:6700,req:{retail:10,social:8}}]},
 {id:'craftservice',name:'Fashion & Tailoring',icon:'🧵',stages:[
   {name:'Seamster’s Assistant',salary:800,req:{retail:2}},
   {name:'Tailor',salary:1500,req:{retail:4}},
   {name:'Master Tailor',salary:2500,req:{retail:6,arts:3}},
   {name:'Atelier Head',salary:4000,req:{retail:8,arts:5}},
   {name:'Fashion House Owner',salary:6700,req:{retail:10,social:6}}]},
 {id:'arts',name:'Arts & Performance',icon:'🎨',stages:[
   {name:'Busker',salary:700,req:{arts:2}},
   {name:'Performer',salary:1400,req:{arts:4}},
   {name:'Featured Artist',salary:2400,req:{arts:6}},
   {name:'Company Principal',salary:4000,req:{arts:8,social:4}},
   {name:'Celebrated Artist',salary:7000,req:{arts:10,social:6}}]},
 {id:'athletics',name:'Athletics & Sport',icon:'🏃',stages:[
   {name:'Amateur',salary:700,req:{athletics:2}},
   {name:'Semi-Pro',salary:1400,req:{athletics:4}},
   {name:'Professional Athlete',salary:2600,req:{athletics:6}},
   {name:'Champion',salary:4300,req:{athletics:8}},
   {name:'Legend',salary:7200,req:{athletics:10,social:5}}]},
 {id:'diplomacy',name:'Foreign Service',icon:'🤝',minEdu:'university',stages:[
   {name:'Attaché',salary:900,req:{academics:2,social:2}},
   {name:'Secretary',salary:1700,req:{academics:4,social:3}},
   {name:'Envoy',salary:2900,req:{social:6,academics:5}},
   {name:'Ambassador',salary:4800,req:{social:8,academics:6}},
   {name:'Minister Plenipotentiary',salary:7900,req:{social:10,academics:8}}]},
 {id:'underworld',name:'The Underworld',icon:'🗝',stages:[
   {name:'Runner',salary:700,req:{underworld:2}},
   {name:'Fence',salary:1500,req:{underworld:4}},
   {name:'Crew Lieutenant',salary:2800,req:{underworld:6,social:3}},
   {name:'Underboss',salary:4600,req:{underworld:8,social:5}},
   {name:'Kingpin',salary:8000,req:{underworld:10,social:7}}]},
];
const CAREER_EXP=[2,3,4,6];
function careerStageQualifies(track,stageIdx){ const st=track.stages[stageIdx]; if(!st) return false;
  const requiredEdu=typeof educationCareerEducationRequirement==='function'?educationCareerEducationRequirement(track,stageIdx):track.minEdu;
  if(requiredEdu && eduRank()<EDU_RANK[requiredEdu]) return false;
  if(typeof educationCareerMajorAllowed==='function'&&!educationCareerMajorAllowed(track,stageIdx)) return false;
  return S.age>=TIER_MINAGE[stageIdx+1] && Object.keys(st.req).every(k=>(S.skills[k]||0)>=st.req[k]); }
function careerMissingSkills(track,stageIdx){ const st=track.stages[stageIdx]; if(!st) return [];
  return Object.keys(st.req).filter(k=>(S.skills[k]||0)<st.req[k]).map(k=>SKILLS[k].name.toLowerCase()); }
function careerMissingRequirements(track,stageIdx){
  const missing=[];
  const requiredEdu=typeof educationCareerEducationRequirement==='function'?educationCareerEducationRequirement(track,stageIdx):track.minEdu;
  if(requiredEdu&&eduRank()<EDU_RANK[requiredEdu]) missing.push(SCHOOL_STAGES.find(x=>x.id===requiredEdu).name+' completed');
  if(typeof educationCareerMajorAllowed==='function'&&!educationCareerMajorAllowed(track,stageIdx)){
    const major=typeof educationCareerRequirement==='function'?educationCareerRequirement(track,stageIdx):'required degree';
    if(major) missing.push('degree in '+major);
  }
  if(S.age<TIER_MINAGE[stageIdx+1]) missing.push('age '+TIER_MINAGE[stageIdx+1]);
  return missing.concat(careerMissingSkills(track,stageIdx));
}
function readyForPromotion(track){ if(S.jobTier<1||S.jobTier>=5) return false;
  const requiredEdu=typeof educationCareerEducationRequirement==='function'?educationCareerEducationRequirement(track,S.jobTier):track.minEdu;
  const need=requiredEdu?EDU_RANK[requiredEdu]:0;
  const fast=eduRank()>need?1:0;
  const educationFast=typeof careerYearsRequired==='function'?careerYearsRequired(track,S.jobTier):CAREER_EXP[S.jobTier-1];
  return careerStageQualifies(track,S.jobTier) && S.careerYears>=Math.max(1,educationFast-fast); }
function rollJobVacancies(){
  if(typeof VacancySystem==='object'&&VacancySystem&&typeof VacancySystem.playerPortalVacancies==='function'&&typeof World!=='undefined'&&World){
    S.vacancies=VacancySystem.playerPortalVacancies(World,S);
    return S.vacancies;
  }
  // Legacy fallback: only reached when VacancySystem/World are unavailable
  // (isolated legacy execution). The normal runtime never uses this path.
  S.vacancies=CAREERS.map(track=>{
    const advantage=typeof educationCareerAdvantage==='function'?educationCareerAdvantage(track):{hiringBonus:0};
    const openingChance=clamp(0.6+(advantage.hiringBonus||0),0.1,0.95);
    return {track:track.id, stage:(chance(openingChance)&&careerStageQualifies(track,0))?0:-1};
  });
  return S.vacancies;
}
const STATKEYS={health:'HEALTH',happiness:'HAPPINESS',smarts:'SMARTS',looks:'LOOKS',relations:'RELATIONS'};
function lastAncestor(){ return (typeof Lineage!=='undefined'&&Lineage&&Lineage.pastSubjects&&Lineage.pastSubjects.length)?Lineage.pastSubjects[Lineage.pastSubjects.length-1]:null; }
function ancestorFateLine(a){
  if(!a) return '';
  const gv={A:'remembered as one of the good files',B:'remembered fondly enough',C:'remembered, adequately',D:'remembered mostly as a caution',F:'remembered mainly as a warning'}[a.grade]||'remembered';
  return gv+' — died at '+a.age+', '+a.cause;
}
function fill(t){const a=lastAncestor(); return t.replace(/\{place\}/g,S.place).replace(/\{n\}/g,()=>String(RI(2,9))).replace(/\{partner\}/g,S.partner||S.__partnerNameSnapshot||'—').replace(/\{other\}/g,S.__affairName||'—').replace(/\{friend\}/g,S.__lastContactName||'—').replace(/\{mother\}/g,S.mother?S.mother.name:'—').replace(/\{father\}/g,S.father?S.father.name:'—').replace(/\{ancestor\}/g,a?a.name:'—').replace(/\{ancestorFate\}/g,ancestorFateLine(a));}

/* ================= HOUSEHOLD LEDGER (housing, food, dependents, debt) ================= */
function pickWeighted(items){ const total=items.reduce((a,i)=>a+i.chance,0); let r=Random.next()*total;
  for(const it of items){ r-=it.chance; if(r<=0) return it; } return items[items.length-1]; }
function fxSummary(fx){
  const order=['health','happiness','smarts','looks','relations'];
  const parts=order.filter(k=>fx&&fx[k]).map(k=>(fx[k]>0?'+':'−')+Math.abs(fx[k])+' '+STATKEYS[k].charAt(0)+STATKEYS[k].slice(1).toLowerCase());
  return parts.length?parts.join(' · '):'no direct effect';
}
const HOUSING=[
 {id:'none',name:'No Fixed Address',icon:'🏚',rent:0,fx:{happiness:-14,health:-12},
   risk:'severe — a real, ongoing chance of dying unhoused, far worse for the very young and very old',desc:'a shelter bunk, a doorway, whatever holds'},
 {id:'room',name:'Rented Room',icon:'🛏',rent:350,fx:{happiness:-3,health:-2},
   risk:'a hard life, but a roof — survivable, rarely comfortable',desc:'one room, a shared bath down the hall'},
 {id:'flat',name:'Small Flat',icon:'🏠',rent:750,fx:{happiness:3,health:2},
   risk:'stable — nothing special, nothing dangerous',desc:'a door that locks, a window that opens'},
 {id:'house',name:'Family House',icon:'🏡',rent:1500,fx:{happiness:6,health:4,relations:3,smarts:1},
   risk:'genuinely good living — room to grow, room to breathe',desc:'room enough for a family, and the noise of one'},
 {id:'townhouse',name:'Townhouse',icon:'🏘',rent:2800,fx:{happiness:10,health:6,relations:4,looks:3,smarts:2},
   risk:'a real, compounding advantage — it shows in every index',desc:'a good street, a brass knocker'},
 {id:'estate',name:'The Estate',icon:'🏰',rent:5200,fx:{happiness:16,health:9,relations:6,looks:6,smarts:3},
   risk:'the good life, undeniably — every year here is a year ahead',desc:'grounds, staff, a name people recognize'},
];
const FOOD=[
 {id:'meager',name:'Scraps & Rationing',icon:'🥔',cost:180,fx:{health:-9,happiness:-5},
   risk:'malnourishment — a serious, compounding drag on the body',desc:'bread, potatoes, whatever is cheapest that day'},
 {id:'basic',name:'Basic Groceries',icon:'🥖',cost:420,fx:{},
   risk:'plain but sufficient — no harm, no help',desc:'plain, regular, enough'},
 {id:'decent',name:'Decent Table',icon:'🍲',cost:800,fx:{health:4,happiness:3},
   risk:'a genuinely healthy diet',desc:'meat twice a week, fresh greens'},
 {id:'fine',name:'Fine Dining',icon:'🍷',cost:1600,fx:{health:7,happiness:5,looks:2},
   risk:'thriving — the kind of table that adds years',desc:'the good butcher, wine with dinner'},
];
const CHILDCARE=[
 {id:'basic',name:'Basic Upbringing',icon:'🧸',costPerKid:260,fx:{},
   risk:'a plain but decent childhood',desc:'hand-me-downs and a place at the table'},
 {id:'comfortable',name:'Comfortable Upbringing',icon:'🎈',costPerKid:520,fx:{happiness:2,smarts:1,health:1},
   risk:'a genuinely good start in life',desc:'new shoes each year, a proper birthday'},
 {id:'private',name:'Private Tutors & Schooling',icon:'🎓',costPerKid:1100,fx:{happiness:2,smarts:3,looks:1,health:1},
   risk:'every advantage money can buy',desc:'private lessons, the best schools in the district'},
];
const LIABILITY_TYPES={
 bankloan:{id:'bankloan',name:'Bank Loan',icon:'🏦',principal:2500,years:6,totalMult:1.3,desc:'a formal loan, modest interest, a strict schedule'},
 storecredit:{id:'storecredit',name:'Store Credit',icon:'🧾',principal:500,years:2,totalMult:1.25,desc:'furniture and goods, paid off in installments'},
 studentloan:{id:'studentloan',name:'Student Loan',icon:'🎓',principal:3000,years:8,totalMult:1.35,desc:'a debt for the degree, paid down over years'},
};
function liabilityPayment(t){return Math.round(t.principal*t.totalMult/t.years);}
const FAMILY_TIERS=[
 {id:'destitute',label:'Destitute',chance:0.07,housing:'none',food:'meager',childcare:'basic',
   line:'born into a family with no fixed roof at all — the streets, a shelter, whatever held that winter'},
 {id:'poor',label:'Poor',chance:0.33,housing:'room',food:'meager',childcare:'basic',
   line:'born to a family that never got ahead — a rented room, a thin table'},
 {id:'modest',label:'Modest',chance:0.35,housing:'flat',food:'basic',childcare:'basic',
   line:'born to a family that made do — plain, steady, unremarkable'},
 {id:'comfortable',label:'Comfortable',chance:0.17,housing:'house',food:'decent',childcare:'comfortable',
   line:'born to a family with room to spare — a good house, a full table'},
 {id:'wealthy',label:'Wealthy',chance:0.08,housing:'townhouse',food:'fine',childcare:'private',
   line:'born to real money — every advantage, from the first day'},
];

/* ================= GUARDIANSHIP (parent quality → childhood safe zone) ================= */
function guardiansOf(){ return [S.mother,S.father].filter(p=>p&&p.alive&&p.present!==false&&!p.estranged); }
function guardTier(){
  const g=guardiansOf(); if(!g.length) return 'none';
  const q=g.reduce((a,p)=>a+(p.warmth*0.5+p.stability*0.5),0)/g.length;
  return q>=65?'nurturing':q>=42?'supported':q>=22?'neglectful':'toxic';
}
const GUARD_SCALE={none:0.85,toxic:0.65,neglectful:0.4,supported:0.22,nurturing:0.1};
const GUARD_MORT={none:1.4,toxic:1.15,neglectful:0.9,supported:0.55,nurturing:0.25};
const GUARD_INFO={
 none:{label:'NO GUARDIAN ON RECORD',line:'No one is minding the child. The world arrives early, and all at once.'},
 toxic:{label:'HARMFUL PRESENCE',line:'Present, but the presence itself is the danger — no shelter here, if anything the opposite.'},
 neglectful:{label:'MINIMAL SHELTER',line:'Fed and housed, mostly, but no one is really watching.'},
 supported:{label:'A REAL SAFE ZONE',line:'Hardship is softened while it lasts — the child is looked after.'},
 nurturing:{label:'A STRONG SAFE ZONE',line:'Attentive, capable parenting — the child is shielded, and taught.'},
};
function warmthLabel(w){return w>=80?'deeply warm and attentive':w>=60?'caring, mostly present':w>=40?'distant but not unkind':w>=20?'cold, quick to temper':'harsh, sometimes cruel';}
function stabilityLabel(s){return s>=80?'rock-steady, always provides':s>=60?'dependable, mostly':s>=40?'unpredictable':s>=20?'erratic, often absent when it counts':'chronically unreliable';}
function parentGrip(){ const g=guardiansOf(); return g.length?g.reduce((a,p)=>a+p.grip,0)/g.length:0; }
function avgWarmth(list){ return list.length?list.reduce((a,p)=>a+p.warmth,0)/list.length:0; }
function gripLabel(g){return g>=75?'fiercely protective — reluctant to ever let go':g>=55?'protective, a little clingy':g>=35?'easy-going about your independence':g>=15?'indifferent to whether you stay or go':'in a hurry to see you gone';}
function fidelityLabel(v){return v>=80?'devoted — not easily tempted':v>=60?'mostly faithful':v>=40?'a wandering eye, so far unindulged':v>=20?'unreliable — has strayed before':'a known flirt, faithful to no one long';}
function temperamentLabel(v){return v>=80?'combustible — reacts big, reacts fast':v>=60?'volatile, quick to feel it':v>=40?'even-keeled, mostly':v>=20?'slow to anger':'unshakably calm';}
function charmLabel(v){return v>=80?'dangerously charming':v>=60?'magnetic — people notice':v>=40?'easy to like':v>=20?'plain, steady company':'awkward, but genuine';}
function cascadeLine(){return S.__cascadeDiscovery?' It came out because {other}’s own marriage cracked open first, and the news didn’t stay contained.':'';}
function kindnessLabel(v){return v>=80?'warm, genuinely kind':v>=60?'friendly, easy company':v>=40?'decent enough, mostly neutral':v>=20?'prickly, hard to please':'toxic — draining to be around';}
function intellectLabel(v){return v>=80?'sharp — genuinely brilliant':v>=60?'quick-witted':v>=40?'about average':v>=20?'a bit slow on the uptake':'a lovable idiot, bless them';}
function kindnessHappinessBonus(k){return Math.round((k-50)/12);}
function kindnessHealthHit(k){return k<=15?-RI(4,9):(k<30?-RI(1,3):0);}
function intellectSmartsFx(iq){return iq>=82?1:(iq<=15?-1:0);}
function traitAdjustedFx(c,baseHappiness,baseRelations){
  const fx={};
  if(baseRelations) fx.relations=baseRelations;
  const healthEffort=S.health<30?-2:(S.health<45?-1:0);
  fx.happiness=clamp(baseHappiness+kindnessHappinessBonus(c.kindness)+healthEffort,-6,10);
  const healthHit=kindnessHealthHit(c.kindness); if(healthHit) fx.health=healthHit;
  const smartsFx=intellectSmartsFx(c.intellect); if(smartsFx) fx.smarts=smartsFx;
  return fx;
}
function traitFlavorSuffix(c){
  let s='';
  if(S.health<30) s+=' Subject barely had the energy to show up, let alone be good company.';
  if(c.kindness<=15) s+=' Something about their company leaves the subject a little worse than before — the toxic, hard-to-name kind of worse.';
  else if(c.kindness>=80) s+=' Their warmth is, frankly, contagious.';
  if(c.intellect<=15) s+=' The conversation, against all odds, left the subject a little dumber for it.';
  else if(c.intellect>=82) s+=' Some of their sharpness rubs off, in small doses.';
  return s;
}
function flirtSuccessChance(c){
  const base=meetP();
  const looksAdj=(S.looks-50)*0.003, smartsAdj=(S.smarts-50)*0.0015, healthAdj=(S.health-50)*0.001;
  const standardsAdj=-(c.charm-50)*0.003;
  return clamp(base+looksAdj+smartsAdj+healthAdj+standardsAdj,0.05,0.9);
}
function flirtSecretSuccessChance(c){
  const base=clamp(meetP()+0.15,0.1,0.85);
  const looksAdj=(S.looks-50)*0.002, smartsAdj=(S.smarts-50)*0.002, healthAdj=(S.health-50)*0.0008;
  const standardsAdj=-(c.charm-50)*0.002;
  return clamp(base+looksAdj+smartsAdj+healthAdj+standardsAdj,0.05,0.92);
}
function lowestMoodGuardian(){ const g=guardiansOf(); return g.length?g.slice().sort((a,b)=>a.mood-b.mood)[0]:null; }
function computeParentingLegacy(){
  const years=S.parentYears||0;
  if(!years) return {warmth:50,stability:50,years:0};
  const conf=clamp(years/8,0,1);
  const rawWarm=S.parentWarmAccum/years, rawStable=S.parentStableAccum/years;
  return {
    warmth:clamp(Math.round(50+(rawWarm-50)*conf),5,95),
    stability:clamp(Math.round(50+(rawStable-50)*conf),5,95),
    years
  };
}
function legacyGuardians(){ return [S.mother,S.father].filter(p=>p&&!p.alive&&typeof p.warmth==='number'); }

/* ---- toxic-parent abuse / good-parent care incidents (only while living at home) ---- */
const TOXIC_INCIDENTS=[
 {v:['{parent} struck the subject over something small. It went unspoken afterward, the way it always did.','{parent} lost their temper and hit the subject. No one mentioned it at breakfast.'],fx:{health:-6,happiness:-4}},
 {v:['{parent} screamed until the neighbors could hear it. The subject learned, again, to make themselves small.','{parent} tore into the subject over nothing much, at length, at volume.'],fx:{happiness:-6,relations:-2}},
 {v:['{parent} mocked the subject’s looks in front of company, and laughed like it was nothing.','{parent} made a joke of how the subject looked. It was not really a joke.'],fx:{looks:-5,happiness:-4}},
 {v:['{parent} let the subject go without dinner, as a lesson of some kind.','{parent} decided the subject hadn’t earned a meal that night.'],fx:{health:-4,happiness:-3}},
 {v:['{parent} humiliated the subject in front of the whole street. The street, for its part, said nothing.'],fx:{happiness:-5,relations:-3}},
 {v:['{parent} guilt-tripped the subject for wanting an evening alone, at length, until alone stopped feeling worth it.','{parent} made it clear, without quite saying so, that wanting space was a kind of betrayal.'],fx:{happiness:-3},side:p=>{p.grip=clamp(p.grip+4,0,100);}},
 {v:['{parent} read the subject’s letters before they were sent, “just to check.”','{parent} kept the only key to the subject’s door, “for safety,” and never once mentioned giving it back.'],fx:{happiness:-2,relations:-2},side:p=>{p.grip=clamp(p.grip+5,0,100);}},
 {v:['{parent} threatened, not for the first time, what would happen if the subject ever tried to leave.'],fx:{happiness:-4},side:p=>{p.grip=clamp(p.grip+6,0,100);}},
];
const CARING_INCIDENTS=[
 {v:['{parent} brought home something new to wear, just because.','{parent} surprised the subject with a small gift, unprompted.'],fx:{looks:3,happiness:3}},
 {v:['{parent} spent the whole evening just talking, unhurried, like there was nowhere else to be.','{parent} sat with the subject for hours, no particular reason needed.'],fx:{happiness:4,relations:3}},
 {v:['{parent} took the subject to see a doctor, just to be sure of things.','{parent} made sure of a proper meal, and then another.'],fx:{health:5}},
 {v:['{parent} praised the subject in front of company, plainly proud.','{parent} told the subject, without being asked, that they were proud of them.'],fx:{happiness:3,smarts:1}},
 {v:['{parent} slipped the subject a little money, no occasion required.'],fx:{assets:40,happiness:2}},
];

/* ---- a one-time reward for a genuinely well-loved childhood ---- */
const NURTURING_MILESTONES=[
 {v:'{parent} spent a whole season teaching the subject to swim, patiently, without once losing their temper.',fx:{health:5,happiness:4}},
 {v:'{parent} taught the subject to drive, badly at first, then not badly at all — a small, permanent kind of confidence.',fx:{health:3,happiness:5,smarts:1}},
 {v:'{parent} sat up with the subject through a long illness and did not leave the room until the fever broke.',fx:{health:6,happiness:3}},
 {v:'{parent} taught the subject everything they knew about {skill}, unhurried, over years, until it was truly the subject’s own.',fx:{happiness:4,smarts:2}},
];

/* ---- declared parenting style, chosen once at the birth of a first child ---- */
const PARENTING_STYLES=[
 {id:'strict',label:'Strict',desc:'rules, routine, no exceptions',warmBonus:-8,stableBonus:12,fx:{relations:-1,smarts:1}},
 {id:'warm',label:'Warm',desc:'affection first, structure second',warmBonus:14,stableBonus:-4,fx:{happiness:2,relations:2}},
 {id:'permissive',label:'Permissive',desc:'let them find their own way',warmBonus:6,stableBonus:-10,fx:{happiness:1}},
 {id:'handsoff',label:'Hands-off',desc:'present, but rarely involved',warmBonus:-10,stableBonus:-6,fx:{relations:-2}},
];
const PARENTING_STYLE_CHOICE={
  title:'What Kind Of Parent?',
  body:()=>'A first child changes the shape of a house. The subject must decide, at least roughly, what kind of parent they mean to be.',
  opts:()=>PARENTING_STYLES.map(st=>({
    label:st.label,cls:'maybe',sub:st.desc,fx:st.fx,
    side:s2=>{ s2.parentingStyle=st.id; },
    t:'Subject settled on it, more or less — '+st.desc+'. It would not be perfect. Whose parenting is?'
  })),
};

/* ---- asking a guardian to cover a debt (only while living at home) ---- */
function canAskParentForMoney(){ return (S.age<16||S.livingAtHome)&&guardiansOf().length>0; }
function askParentDebtChance(severity){
  const tier=guardTier();
  const base={toxic:0.10,neglectful:0.25,supported:0.5,nurturing:0.68}[tier]||0.2;
  return clamp(base+(S.relations-50)/250-severity*0.28,0.03,0.92);
}
function askParentDebtOption(severity){
  const g=guardiansOf(); const tier=guardTier();
  const p=askParentDebtChance(severity);
  return {label:'Ask '+(g.length>1?'the parents':g[0].name)+' to cover it',cls:'maybe',
    sub:P(p)+' chance they cover the debt'+(tier==='toxic'?' · they may turn ugly about it':''),
    side:s=>{
      const parent=pick(g);
      if(chance(p)){
        s.assets=0; parent.grip=clamp(parent.grip+5,0,100);
        S.__oppText=parent.name+' covered the debt without much ceremony, and without letting the subject forget it.';
        S.__oppFx={happiness:2,relations:2};
      } else if(tier==='toxic'&&chance(0.3+severity*0.3)){
        s.livingAtHome=false; s.lifestyle.housing='none'; s.lifestyle.food='meager';
        S.__oppText=parent.name+' refused, and made the refusal felt — the door shown, the debt still owed.';
        S.__oppFx={happiness:-10,health:-5,relations:-6};
      } else if(tier==='toxic'){
        S.__oppText=parent.name+' refused, loudly, and made sure the subject knew whose fault the debt was.';
        S.__oppFx={happiness:-6,health:-2,relations:-4};
      } else {
        S.__oppText=parent.name+' said no. The debt stayed exactly where it was.';
        S.__oppFx={happiness:-3,relations:-2};
      }
    },
    t:'',fx:{}};
}

/* ================= SCHOOLING (parent-gated education ladder) ================= */
const SCHOOL_STAGES=[
  {id:'lower',name:'Lower School',pupilTitle:'Pupil, Lower School',startAge:6,endAge:11,years:6,smartsPerYear:2,scholarSmarts:50,requireWealth:false,
   declineNote:'stay home instead',
   completeText:'Subject completed Lower School — sums, letters, and the first taste of sitting still.',completeFx:{smarts:4,happiness:2}},
  {id:'middle',name:'Middle School',pupilTitle:'Pupil, Middle School',startAge:12,endAge:15,years:3,smartsPerYear:3,scholarSmarts:52,requireWealth:false,
   declineNote:'go to work instead',
   completeText:'Subject completed Middle School, marks middling to fair.',completeFx:{smarts:5,happiness:2}},
  {id:'upper',name:'Upper School',pupilTitle:'Student, Upper School',startAge:15,endAge:18,years:3,smartsPerYear:3,scholarSmarts:56,requireWealth:false,
   declineNote:'go to work instead',
   completeText:'Subject completed Upper School — the leaving certificate, framed or not.',completeFx:{smarts:6,happiness:3}},
  {id:'university',name:'University',pupilTitle:'University Student',startAge:18,endAge:25,years:4,smartsPerYear:4,scholarSmarts:62,requireWealth:true,
   declineNote:'go straight to work instead',
   completeText:'Subject graduated from the University with a bachelor’s degree — the certificate framed, eventually, and hung a little crooked.',completeFx:{smarts:10,happiness:5}},
];
function schoolWealthOK(){ const fam=FAMILY_TIERS.find(f=>f.id===S.familyTier); return !!fam&&fam.id!=='destitute'&&fam.id!=='poor'; }
function schoolParentWilling(){ const t=guardTier(); return t==='supported'||t==='nurturing'; }
function schoolViaParent(stage){ return schoolParentWilling()&&(!stage.requireWealth||schoolWealthOK()); }
function schoolViaScholar(stage){ return S.smarts>=stage.scholarSmarts; }
const EDU_RANK={lower:1,middle:2,upper:3,university:4};
function eduRank(){ let r=0; SCHOOL_STAGES.forEach((st,i)=>{ if(S.eduCompleted&&S.eduCompleted[st.id]) r=i+1; }); return r; }

const DISPOSITIONS=[
 {id:'grind',name:'The Grind',desc:'steady, tough, unsentimental',b:{smarts:8,health:8,happiness:-4},
   score:s=>{let p=0;if(s.careerYears>=5)p++;if(s.jobTier>=2)p++;if(s.health>60)p++;if(s.smarts>60)p++;if(s.vice===0)p++;return p;}},
 {id:'gambler',name:'The Gambler',desc:'charming, restless, unlucky with luck',b:{looks:8,happiness:8,smarts:-3},
   score:s=>{let p=0;if(s.vice>=2)p++;if(s.assets<500&&s.acts>10)p++;if(s.looks>60)p++;if(!s.married&&s.acts>8)p++;if(s.crime>0)p++;return p;}},
 {id:'saint',name:'The Saint',desc:'kind, loyal, easily hurt',b:{relations:10,happiness:6,looks:-2},
   score:s=>{let p=0;if(s.relations>65)p++;if(s.familyMood>=65)p++;if(s.vice===0)p++;if(s.happiness<50&&s.relations>55)p++;if(!s.record)p++;return p;}},
 {id:'dreamer',name:'The Dreamer',desc:'bright head, thin skin, wanders',b:{smarts:10,happiness:5,health:-4},
   score:s=>{let p=0;if(s.smarts>65)p++;if(s.didLeave)p++;if(s.health<50)p++;if(Object.keys(s.skills).length>=2)p++;if(s.jobTier<=1&&s.smarts>60)p++;return p;}},
 {id:'hustler',name:'The Hustler',desc:'quick hands, quicker tongue',b:{looks:6,smarts:6,relations:-4},
   score:s=>{let p=0;if(s.assets>2000&&s.jobTier<=2)p++;if(s.crime>0||s.record)p++;if(s.relations<45)p++;if(s.looks>55&&s.smarts>55)p++;if(s.acts>12)p++;return p;}},
 {id:'stoic',name:'The Stoic',desc:'unbothered, patient, hard to read',b:{health:6,relations:4,happiness:-2},unlock:'Lose 2 Holds to unlock',
   score:s=>{let p=0;if(s.avgHap>=40&&s.avgHap<=60)p++;if(s.health>55)p++;if(s.vice===0&&s.crime===0)p++;if(s.careerYears>=6)p++;if(s.relations>=40&&s.relations<=60)p++;return p;}},
 {id:'aristo',name:'The Aristocrat',desc:'polished, entitled, a little hollow',b:{looks:10,smarts:4,relations:-6},unlock:'Earn a grade of A to unlock',
   score:s=>{let p=0;if(s.looks>70)p++;if(s.familyTier==='wealthy'||s.familyTier==='comfortable')p++;if(s.assets>3000)p++;if(s.relations<50)p++;if(s.smarts>50&&s.edu)p++;return p;}},
];
const INTENTS=[
 {id:'rich',name:'Die rich',scrawl:'leave a number with commas in it',
   score:s=>{const a=s.assets;return a>40000?5:a>10000?4:a>2000?3:a>=0?2:1},
   line:['Died owing the world. The ambition, at least, was large.','The ledger closed in the red, but only just.','A modest pile. The subject would have sniffed at it.','A proper fortune. The subject would have approved.','An obscene fortune. The subject, wherever they are, is counting it.']},
 {id:'family',name:'Raise a family',scrawl:'a loud house and a full table',
   score:s=>{let p=0;if(s.married)p+=2;else if(s.status==='Attached')p+=1;p+=Math.min(s.kids,3);if(s.partnerMood>50)p++;if(s.relations>55)p++;return clamp(p,1,5)},
   line:['No one waited up for the subject. The house stayed quiet.','A love, briefly. The table stayed small.','Some of it happened. Not all.','A full house, mostly warm. The subject would call it enough.','A loud, loved, overflowing house. Exactly the plan.']},
 {id:'clean',name:'Keep a clean record',scrawl:'no notations, no debts to dark men',
   score:s=>{let p=0;if(s.vice===0)p+=2;else if(s.vice<=2)p+=1;if(!s.record)p+=2;if(s.crime===0)p++;if(s.relations>50)p++;return clamp(p,1,5)},
   line:['The file is a catalogue of misdemeanours. The saint weeps.','Notations throughout. The clean page was never achieved.','A smudge or two. The subject told themselves it didn’t count.','Mostly clean. The Bureau found little to file.','Spotless. Not a notation. The Bureau is almost suspicious.']},
 {id:'free',name:'Stay unbound',scrawl:'no master, no mortgage, no map',
   score:s=>{let p=0;if(s.avgHap>60)p+=2;else if(s.avgHap>45)p++;if(s.didCoast)p++;if(s.didLeave)p++;if(!s.married)p++;if(s.jobTier<=1)p++;return clamp(p,1,5)},
   line:['Bound on every side — a desk, a spouse, a debt. The opposite of free.','Tethered, mostly. The road was never taken.','Some open years, then the cage closed.','Largely unbound. The subject kept their own hours.','Free as the file allows. No master, no map. The subject walked.']},
 {id:'legacy',name:'Leave something behind',scrawl:'a name, a tree, a child who remembers',
   score:s=>{let p=0;if(s.edu)p++;if(s.smarts>70)p++;if(s.kids>0)p++;if((s.skills.land||0)>0)p++;if(s.age>60)p++;return clamp(p,1,5)},
   line:['Nothing carried the name forward. The file is the only trace.','A small mark, soon faded.','Something was passed on. Some of it stuck.','A real legacy — taught, planted, remembered.','Enduring. The subject’s name outlasts the file. As intended.']},
 {id:'bright',name:'Burn bright, not long',scrawl:'feel all of it, pay the price gladly',
   score:s=>{let p=0;if(s.peakHap>80)p+=2;else if(s.peakHap>60)p++;if(s.acts>14)p++;if(s.vice>2)p++;if(s.avgHap>52)p++;return clamp(p,1,5)},
   line:['A grey, careful life. The flame was never lit.','A few bright nights in a long dim stretch.','Some fire, some ash. The subject felt a fair amount.','Bright indeed. The subject felt most of it, and paid, and would again.','Blazing. Every colour, every cost, gladly. The subject would not trade a year.']},
 {id:'outlast',name:'Outlast them all',scrawl:'become the oldest name in the file cabinet',unlock:'Lose 3 Holds to unlock',
   score:s=>{const best=Archive.bestAge();if(!best||s.age>=best)return 5;const r=s.age/best;return clamp(Math.ceil(r*5),1,5);},
   line:['Gone early. The cabinet barely noticed.','A shorter file than most. The record holds elsewhere.','A fair run. Not the longest in the drawer.','A long file. Close to the mark.','The oldest name in the cabinet. The record, as of this file, belongs to the subject.']},
];
function currentIntent(s){ return INTENTS.filter(x=>!x.unlock||unlockedIntentIds().includes(x.id))
  .reduce((best,it)=>{const sc=it.score(s); return (!best||sc>best.sc)?{it,sc}:best;},null); }
function currentDisposition(s){ return DISPOSITIONS.filter(x=>!x.unlock||unlockedDispIds().includes(x.id))
  .reduce((best,d)=>{const sc=d.score(s); return (!best||sc>best.sc)?{it:d,sc}:best;},null); }
function readableYet(s){ return s.age>=6 || s.acts>=3; }

const TINTS=[
 {bg:'#b6a585',bgd:'#6c5d44',skin:'#cdb78f',sh:'#a8926c',hair:'#33291b',cloth:'#473a27',collar:'#d8cba6',ink:'#3a2c1a'},
 {bg:'#a99a7e',bgd:'#5f5238',skin:'#c2ac84',sh:'#9c875f',hair:'#4a3a26',cloth:'#7d6e50',collar:'#e0d4b0',ink:'#33271a'},
 {bg:'#bcae90',bgd:'#74644a',skin:'#d2bd96',sh:'#ad9870',hair:'#2c2418',cloth:'#5a4b34',collar:'#cfc19a',ink:'#3a2c1a'},
 {bg:'#a4957a',bgd:'#574b34',skin:'#bfa880',sh:'#97825b',hair:'#3d3020',cloth:'#8a7a5c',collar:'#d8cba6',ink:'#2f2417'},
];
function portraitSVG(sex,seed,t){
  const gid='p'+seed+(sex==='M'?'m':'f');let hair='';
  if(sex==='M'){const h=seed%4;
    if(h===0)hair=`<path d="M30 46 Q30 24 50 22 Q70 24 70 46 Q70 36 50 34 Q30 36 30 46Z" fill="${t.hair}"/>`;
    else if(h===1)hair=`<path d="M28 48 Q28 20 50 20 Q72 20 72 48 L70 40 Q66 30 50 30 Q34 30 30 40Z" fill="${t.hair}"/><path d="M30 30 Q44 24 60 30" stroke="${t.hair}" stroke-width="3" fill="none"/>`;
    else if(h===2)hair=`<path d="M32 44 Q34 28 50 27 Q66 28 68 44 Q60 38 50 38 Q40 38 32 44Z" fill="${t.hair}"/>`;
    else hair=`<path d="M26 40 Q26 18 50 18 Q74 18 74 40 L74 50 L70 44 Q70 30 50 30 Q30 30 30 44 L26 50Z" fill="${t.hair}"/><rect x="24" y="37" width="52" height="6" rx="3" fill="${t.hair}"/>`;
  }else{const h=seed%4;
    if(h===0)hair=`<path d="M24 64 Q20 30 50 22 Q80 30 76 64 Q72 50 66 46 Q60 30 50 30 Q40 30 34 46 Q28 50 24 64Z" fill="${t.hair}"/>`;
    else if(h===1)hair=`<path d="M28 50 Q26 24 50 22 Q74 24 72 50 Q66 40 50 40 Q34 40 28 50Z" fill="${t.hair}"/><circle cx="50" cy="22" r="9" fill="${t.hair}"/>`;
    else if(h===2)hair=`<path d="M22 70 Q18 28 50 20 Q82 28 78 70 Q74 52 70 48 Q64 28 50 28 Q36 28 30 48 Q26 52 22 70Z" fill="${t.hair}"/>`;
    else hair=`<path d="M26 52 Q24 22 50 20 Q76 22 74 52 L72 30 Q50 14 28 30Z" fill="${t.cloth}"/><path d="M28 30 Q50 22 72 30" stroke="${t.hair}" stroke-width="2" fill="none"/>`;}
  const moust=(sex==='M'&&seed%3===0)?`<path d="M42 64 Q50 61 58 64 Q50 67 42 64Z" fill="${t.hair}" opacity="0.7"/>`:'';
  return `<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
   <defs><radialGradient id="${gid}v" cx="50%" cy="42%" r="75%"><stop offset="55%" stop-color="${t.bg}"/><stop offset="100%" stop-color="${t.bgd}"/></radialGradient>
   <linearGradient id="${gid}f" x1="0" y1="0" x2="1" y2="0"><stop offset="50%" stop-color="${t.skin}"/><stop offset="100%" stop-color="${t.sh}"/></linearGradient>
   <filter id="${gid}n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer></filter></defs>
   <rect width="100" height="120" fill="url(#${gid}v)"/>
   <path d="M8 120 Q10 92 30 86 Q40 82 50 82 Q60 82 70 86 Q90 92 92 120 Z" fill="${t.cloth}"/>
   <path d="M40 84 Q50 92 60 84 L58 102 L42 102 Z" fill="${t.collar}" opacity="0.8"/>
   <rect x="42" y="68" width="16" height="20" rx="7" fill="${t.sh}"/>
   <ellipse cx="50" cy="50" rx="20" ry="24" fill="url(#${gid}f)"/>
   <ellipse cx="30" cy="52" rx="3.5" ry="5" fill="${t.sh}"/><ellipse cx="70" cy="52" rx="3.5" ry="5" fill="${t.sh}"/>
   ${hair}
   <g opacity="0.34"><ellipse cx="42" cy="50" rx="2.4" ry="1.6" fill="${t.ink}"/><ellipse cx="58" cy="50" rx="2.4" ry="1.6" fill="${t.ink}"/><path d="M50 52 L48 60 L52 60 Z" fill="${t.ink}" opacity="0.5"/><path d="M44 66 Q50 69 56 66" stroke="${t.ink}" stroke-width="1.4" fill="none"/></g>
   ${moust}
   <rect width="100" height="120" filter="url(#${gid}n)" opacity="0.10"/>
   <g stroke="#efe6cd" stroke-width="0.5" opacity="0.22"><line x1="14" y1="6" x2="20" y2="40"/><line x1="82" y1="80" x2="88" y2="112"/></g>
   <rect width="100" height="120" fill="none" stroke="#efe6cd" stroke-width="6" opacity="0.32"/></svg>`;
}

/* ================= EVENTS ================= */
const EVENTS=[
 {id:'ancestorname',a:[0,6],once:1,if:s=>!!lastAncestor(),v:loreV('ancestorname'),fx:{relations:2}},
 {id:'ancestortale',a:[4,10],once:1,if:s=>!!lastAncestor(),v:loreV('ancestortale'),fx:{smarts:1,happiness:1}},
 {id:'firstword',a:[0,3],once:1,v:loreV('firstword'),fx:{smarts:2}},
 {id:'steps',a:[0,3],once:1,v:loreV('steps'),fx:{health:2}},
 {id:'measles',a:[0,5],cd:9,v:loreV('measles'),fx:{health:-4},medical:{conditionId:'infection',source:'childhood measles',severity:3}},
 {id:'argument',a:[1,5],v:loreV('argument'),fx:{happiness:-3}},
 {id:'crayon',a:[2,4],v:loreV('crayon'),fx:{smarts:1,happiness:1}},
 {id:'coin',a:[1,5],v:loreV('coin'),fx:{assets:5,relations:2}},
 {id:'spelling',a:[5,12],cd:9,v:loreV('spelling'),fx:{smarts:4,happiness:2}},
 {id:'marbles',a:[5,12],v:loreV('marbles'),fx:{smarts:1}},
 {id:'tree',a:[5,12],v:loreV('tree'),fx:{health:-5,happiness:-2}},
 {id:'friend',a:[5,110],if:s=>s.contacts.length<MAX_CONTACTS,fx:{happiness:4,relations:6},side:s=>{const c=makeContact(s.sex==='M'?'F':'M');c.mood=72;s.contacts.push(c);s.__lastContactName=c.name;},
   v:loreV('friend')},
 {id:'cane',a:[5,12],v:loreV('cane'),fx:{happiness:-3}},
 {id:'capable',a:[5,12],cd:9,v:loreV('capable'),fx:{smarts:2}},
 {id:'beetles',a:[5,12],v:loreV('beetles'),fx:{happiness:2,smarts:1}},
 {id:'growth',a:[13,17],v:loreV('growth'),fx:{looks:2,happiness:-1}},
 {id:'heartbreak1',a:[13,17],once:1,v:loreV('heartbreak1'),fx:{happiness:-6,smarts:1}},
 {id:'exams',a:[13,17],cd:4,if:s=>s.smarts>55,v:loreV('exams'),fx:{smarts:3}},
 {id:'examsfail',a:[13,17],cd:4,if:s=>s.smarts<=55,v:loreV('examsfail'),fx:{smarts:-2,happiness:-2}},
 {id:'smoking',a:[13,17],cd:6,v:loreV('smoking'),fx:{health:-3,happiness:-1}},
 {id:'acne',a:[13,16],cd:5,v:loreV('acne'),fx:{looks:-4,happiness:-2}},
 {id:'heartbreak2',a:[18,29],cd:7,v:loreV('heartbreak2'),fx:{happiness:-5,smarts:2}},
 {id:'motorcycle',a:[18,27],once:1,v:loreV('motorcycle'),fx:{assets:-400,happiness:6},
   follow:s=>chance(.28)?{in:1,t:'The motorcycle met a parked cart. The cart won.',fx:{health:-14,happiness:-3}}:null},
 {id:'rentroom',a:[18,29],once:1,v:loreV('rentroom'),fx:{assets:-100,happiness:-1}},
 {id:'books',a:[18,29],cd:8,v:loreV('books'),fx:{smarts:4}},
 {id:'cough',a:[30,52],cd:7,v:loreV('cough'),fx:{health:-4},medical:{conditionId:'respiratory',source:'persistent cough',severity:2}},
 {id:'back',a:[30,58],cd:7,v:loreV('back'),fx:{health:-5,happiness:-2},medical:{conditionId:'injury',source:'back injury',severity:3}},
 {id:'audit',a:[28,60],cd:9,v:loreV('audit'),fx:{happiness:-3}},
 {id:'uncle',a:[30,60],once:1,v:loreV('uncle'),fx:{assets:600}},
 {id:'hair',a:[35,55],once:1,v:loreV('hair'),fx:{looks:-4}},
 {id:'moderately',a:[50,64],cd:8,v:loreV('moderately'),fx:{health:-5,happiness:-1}},
 {id:'letters',a:[50,70],cd:9,v:loreV('letters'),fx:{happiness:-1,smarts:1}},
 {id:'pigeons',a:[65,110],cd:7,v:loreV('pigeons'),fx:{happiness:3}},
 {id:'knees',a:[65,110],cd:8,v:loreV('knees'),fx:{health:-3}},
 {id:'friendgone',a:[65,110],once:1,if:s=>s.contacts.some(c=>c.role==='friend'),v:loreV('friendgone'),fx:{happiness:-7},side:s=>{const c=worstFadingFriend();if(c){s.__lastContactName=c.name;s.contacts=s.contacts.filter(x=>x.cid!==c.cid);}}},
 {id:'hip',a:[68,110],cd:9,v:loreV('hip'),fx:{health:-16,happiness:-4}},
 {id:'grandvisit',a:[65,110],cd:6,if:s=>s.kids>0,v:loreV('grandvisit'),fx:{happiness:5,relations:3}},
 {id:'stories',a:[65,110],cd:8,v:loreV('stories'),fx:{happiness:2}},
 {id:'flu',a:[5,110],cd:6,v:loreV('flu'),fx:{health:-3},medical:{conditionId:'infection',source:'seasonal influenza',severity:2}},
 {id:'pickpocket',a:[12,110],cd:8,v:loreV('pickpocket'),fx:{assets:-80,happiness:-2}},
 {id:'lottery',a:[18,110],cd:9,v:loreV('lottery'),fx:{assets:250,happiness:3}},
 {id:'drinkalone',a:[16,110],dark:1,cd:5,v:loreV('drinkalone'),fx:{health:-4,happiness:-4},side:s=>{s.vice=Math.min(10,s.vice+1);}},
 {id:'gamble',a:[18,110],dark:1,cd:5,v:loreV('gamble'),fx:{assets:-250,happiness:-2},side:s=>{s.vice=Math.min(10,s.vice+1);}},
 {id:'paidcompany',a:[18,70],dark:1,cd:6,v:loreV('paidcompany'),fx:{assets:-60,happiness:-1},side:s=>{s.vice=Math.min(10,s.vice+1);},
   follow:()=>chance(.3)?{in:1,t:'The cost of the evening, and the shame of it, lingered longer than the evening did.',fx:{happiness:-4}}:null},
 {id:'theft',a:[16,60],dark:1,cd:7,v:loreV('theft'),fx:{assets:-120,happiness:-3},side:s=>{s.vice=Math.min(10,s.vice+1);s.record=true;}},
 {id:'contraband',a:[18,55],dark:1,cd:7,v:loreV('contraband'),fx:{assets:350},side:s=>{s.vice=Math.min(10,s.vice+1);s.crime=Math.max(s.crime,1);},
   follow:s=>chance(.25)?{in:2,t:'Subject was sentenced to eighteen months. The file was moved to a different shelf, alphabetically.',fx:{happiness:-10,health:-6,relations:-8},side:s2=>{s2.jobTier=0;s2.jobName='Unemployed';s2.career=null;s2.record=true;s2.jailUntil=s2.age+2;}}:null},
 {id:'shark',a:[22,60],dark:1,cd:8,v:loreV('shark'),fx:{assets:400},side:s=>{s.vice=Math.min(10,s.vice+1);},
   follow:()=>({in:2,t:'The man came to collect. He brought a friend and an abacus.',fx:{assets:-600,happiness:-4}})},
 {id:'scuffle',a:[16,50],dark:1,cd:7,v:loreV('scuffle'),fx:{health:-7,happiness:-3},medical:{conditionId:'injury',source:'street scuffle',severity:3}},
 {id:'backroom',a:[16,70],dark:1,cd:6,v:loreV('backroom'),fx:{health:-6,happiness:-2,assets:-150},side:s=>{s.vice=Math.min(10,s.vice+2);}},
 {id:'disturbance',a:[22,60],dark:1,once:1,if:s=>s.married,v:loreV('disturbance'),fx:{happiness:-6,relations:-5},side:s=>{const p=activePartnerContact();if(p){p.mood=Math.max(0,p.mood-18);syncPartnerMirror();}}},
 {id:'bridge',a:[16,110],once:1,if:s=>s.happiness<25,v:loreV('bridge'),fx:{happiness:5,relations:2}},

 /* ---- career-flavor events (scoped to S.career) ---- */
 {id:'academiccite',a:[16,65],cd:8,if:s=>s.career==='academia',v:loreV('academiccite'),fx:{happiness:3,smarts:1}},
 {id:'academiagrant',a:[16,65],cd:9,if:s=>s.career==='academia',v:loreV('academiagrant'),fx:{assets:200,happiness:2}},
 {id:'medsave',a:[16,65],cd:7,if:s=>s.career==='medicine',v:loreV('medsave'),fx:{happiness:5,relations:2}},
 {id:'medshift',a:[16,65],cd:6,if:s=>s.career==='medicine',v:loreV('medshift'),fx:{health:-4,happiness:-2}},
 {id:'lawwin',a:[16,65],cd:6,if:s=>s.career==='law',v:loreV('lawwin'),fx:{happiness:4,relations:2}},
 {id:'lawlose',a:[16,65],cd:6,if:s=>s.career==='law',v:loreV('lawlose'),fx:{happiness:-3,relations:-1}},
 {id:'engfix',a:[16,65],cd:7,if:s=>s.career==='engineering',v:loreV('engfix'),fx:{happiness:4,smarts:1}},
 {id:'engoverrun',a:[16,65],cd:7,if:s=>s.career==='engineering',v:loreV('engoverrun'),fx:{happiness:-3,assets:-80}},
 {id:'archwin',a:[16,65],cd:7,if:s=>s.career==='architecture',v:loreV('archwin'),fx:{happiness:4,smarts:1}},
 {id:'archredesign',a:[16,65],cd:7,if:s=>s.career==='architecture',v:loreV('archredesign'),fx:{happiness:-3,health:-1}},
 {id:'bizdeal',a:[16,65],cd:7,if:s=>s.career==='business',v:loreV('bizdeal'),fx:{assets:150,happiness:3}},
 {id:'bizaudit',a:[16,65],cd:8,if:s=>s.career==='business',v:loreV('bizaudit'),fx:{happiness:-2,health:-2}},
 {id:'labaccident',a:[16,65],cd:8,if:s=>s.career==='trade'||s.career==='construction',v:loreV('labaccident'),fx:{health:-5,happiness:-1}},
 {id:'tradeorder',a:[16,65],cd:7,if:s=>s.career==='trade',v:loreV('tradeorder'),fx:{happiness:3,assets:100}},
 {id:'transdelay',a:[16,65],cd:6,if:s=>s.career==='transport',v:loreV('transdelay'),fx:{happiness:-2,health:-2}},
 {id:'transrecord',a:[16,65],cd:7,if:s=>s.career==='transport',v:loreV('transrecord'),fx:{happiness:3,assets:60}},
 {id:'culinaryreview',a:[16,65],cd:7,if:s=>s.career==='culinary',v:loreV('culinaryreview'),fx:{happiness:4,assets:50}},
 {id:'culinarydisaster',a:[16,65],cd:7,if:s=>s.career==='culinary',v:loreV('culinarydisaster'),fx:{happiness:-3,health:-2}},
 {id:'agriharvest',a:[16,65],cd:7,if:s=>s.career==='agriculture',v:loreV('agriharvest'),fx:{assets:180,happiness:3}},
 {id:'agriblight',a:[16,65],cd:8,if:s=>s.career==='agriculture',v:loreV('agriblight'),fx:{assets:-150,happiness:-3}},
 {id:'carethanks',a:[16,65],cd:6,if:s=>s.career==='care',v:loreV('carethanks'),fx:{happiness:5,relations:2}},
 {id:'careexhaust',a:[16,65],cd:6,if:s=>s.career==='care',v:loreV('careexhaust'),fx:{health:-4,happiness:-3}},
 {id:'retailrush',a:[16,65],cd:6,if:s=>s.career==='service',v:loreV('retailrush'),fx:{assets:90,happiness:2}},
 {id:'retailtheft',a:[16,65],cd:7,if:s=>s.career==='service',v:loreV('retailtheft'),fx:{assets:-70,happiness:-2}},
 {id:'fashioncommission',a:[16,65],cd:7,if:s=>s.career==='craftservice',v:loreV('fashioncommission'),fx:{assets:120,happiness:3}},
 {id:'fashioncopy',a:[16,65],cd:7,if:s=>s.career==='craftservice',v:loreV('fashioncopy'),fx:{happiness:-3}},
 {id:'artsrave',a:[16,65],cd:7,if:s=>s.career==='arts',v:loreV('artsrave'),fx:{happiness:5,relations:2}},
 {id:'artsflop',a:[16,65],cd:7,if:s=>s.career==='arts',v:loreV('artsflop'),fx:{happiness:-4}},
 {id:'athleticswin',a:[16,65],cd:6,if:s=>s.career==='athletics',v:loreV('athleticswin'),fx:{happiness:4,health:-2}},
 {id:'athleticsinjury',a:[16,65],cd:8,if:s=>s.career==='athletics',v:loreV('athleticsinjury'),fx:{health:-8,happiness:-3}},
 {id:'diplowin',a:[16,65],cd:7,if:s=>s.career==='diplomacy',v:loreV('diplowin'),fx:{happiness:4,relations:2}},
 {id:'diplotense',a:[16,65],cd:7,if:s=>s.career==='diplomacy',v:loreV('diplotense'),fx:{happiness:-3,relations:-1}},
 {id:'underworldscore',a:[16,65],cd:7,if:s=>s.career==='underworld',v:loreV('underworldscore'),fx:{assets:220,happiness:3},side:s=>{s.vice=Math.min(10,s.vice+1);}},
 {id:'underworldheat',a:[16,65],cd:7,if:s=>s.career==='underworld',v:loreV('underworldheat'),fx:{happiness:-4},side:s=>{s.vice=Math.min(10,s.vice+1);}},
];

/* ================= PURSUITS ================= */
function studyGain(){return Math.max(1,Math.round((100-S.smarts)/14));}
function skillSpeedMult(smarts){return clamp(0.6+(smarts!=null?smarts:S.smarts)/125,0.6,1.4);}
function skillBaseGain(level){return level>=8?1:level>=4?2:3;}
function skillCapFor(){return typeof educationSkillCapFor==='function'?educationSkillCapFor():10;}
function skillGainFor(level,smarts){
  const room=Math.max(0,skillCapFor()-(level||0));
  return room?Math.min(room,Math.max(1,Math.round(skillBaseGain(level)*skillSpeedMult(smarts)))):0;
}
function promoP(){return clamp(0.22+S.smarts*0.003+S.relations*0.003,0.05,0.8);}
function proposeP(){return clamp(0.25+S.partnerMood*0.005+S.relations*0.002+S.looks*0.001,0.08,0.92);}
function childP(){return S.married&&S.age>=20&&S.age<=43?clamp(0.55-(S.age>38?0.2:0),0.1,0.7):0;}
function meetP(){return clamp(0.3+(S.looks>55?0.12:0)+(S.happiness>55?0.08:0),0.1,0.7);}
function catchP(t){
  const base=[0.18,0.22,0.28,0.34,0.45][t]||0.3;
  const scrutiny=typeof S!=='undefined'&&S&&S.scrutiny!=null?S.scrutiny*0.003:0;
  return clamp(base+scrutiny,0.05,0.9);
}
function hireP(){return clamp(0.35+S.smarts*0.004+(S.looks>60?0.06:0),0.15,0.85);}
const PUR_CATS=[{id:'work',label:'WORK & MONEY'},{id:'rel',label:'RELATIONSHIPS'},{id:'health',label:'HEALTH & LEISURE'},{id:'vice',label:'VICE'},{id:'hold',label:'THE HOLD'}];
const DEC_CATS=[{id:'work',label:'WORK & MONEY'},{id:'lifestyle',label:'HOUSEHOLD & CREDIT'},{id:'rel',label:'RELATIONSHIPS & FAMILY'},{id:'personal',label:'PERSONAL'},{id:'vice',label:'RISK & VICE'},{id:'hold',label:'THE HOLD'}];
const PURSUITS=[
 {id:'study',cat:'work',icon:'📖',cost:1,avail:s=>s.age>=6,note:()=>`+~${studyGain()} SMARTS · steadies the work ladder`,
   apply:()=>{const g=studyGain();return{fx:{smarts:g},text:pick(['Subject hit the books. The lamp burned late. Something stuck.','Subject studied. The page that had been a wall became a door.'])}}},
 {id:'practice',cat:'work',icon:'🎓',cost:1,avail:s=>s.age>=6,note:()=>`choose a skill to train · SMARTS sets the pace · practice keeps it, idle lets it fade`,
   apply:(S2,item)=>{const id=item&&item.skill; if(!id||!SKILLS[id]) return{fx:{},text:'Subject meant to practice something. The year passed anyway.'};
     const before=S.skills[id]||0, gain=skillGainFor(before);
     if(!gain) return{fx:{},text:'Subject practiced '+SKILLS[id].name.toLowerCase()+', but the current education ceiling held at '+skillCapFor()+'/10. Further schooling would open the next bars.'};
     S.skills[id]=Math.min(skillCapFor(),before+gain); S.practicedSkill=id;
     return{fx:SKILL_PRACTICE_FX[id]||{happiness:1},text:'Subject spent the year deliberately building a skill: '+SKILLS[id].name.toLowerCase()+'.'};}},
 {id:'lookwork',cat:'work',icon:'🚪',cost:1,avail:s=>!s.eduStage&&s.age>=16&&s.age<65&&s.jailUntil<=s.age&&!s.jobName.startsWith('Pensioner'),
   note:s=>s.jobTier>0?'browse other careers · switching costs the year’s momentum':'browse this year’s openings · the portal',
   apply:(S2,item)=>{
     if(typeof VacancySystem==='object'&&VacancySystem&&typeof VacancySystem.applyAndResolve==='function'&&typeof World!=='undefined'&&World){
       if(!item||!item.vacancyId) return{fx:{happiness:-2},text:'Subject went back to the portal, but that opening had already closed.',reason:'vacancy_unavailable'};
       const vacancy=VacancySystem.get(World,item.vacancyId);
       if(!vacancy||vacancy.status!=='open') return{fx:{happiness:-2},text:'Subject went back to the portal, but that opening had already closed.',reason:'vacancy_unavailable'};
       const stageIdx=vacancy.careerStage;
       const baseBonus=(stageIdx===0&&vacancy.occupationType==='career'&&vacancy.requirements&&vacancy.requirements.educationStage&&eduRank()>=(EDU_RANK[vacancy.requirements.educationStage]||0))
         ?{lower:100,middle:150,upper:250,university:500}[vacancy.requirements.educationStage]:0;
       const track=vacancy.occupationType==='career'?CAREERS.find(c=>c.id===vacancy.occupationId):null;
       const advantage=(stageIdx===0&&track&&typeof educationCareerAdvantage==='function')?educationCareerAdvantage(track):{signingBonus:0};
       const signingBonus=baseBonus+(stageIdx===0?(advantage.signingBonus||0):0);
       const result=VacancySystem.applyAndResolve(World,item.vacancyId,'subject',{subject:S,year:World.year});
       const application=result.application;
       if(application&&application.status==='accepted'){
         const business=BusinessSystem&&typeof BusinessSystem.get==='function'?BusinessSystem.get(World,vacancy.businessId):null;
         return{fx:{happiness:4,assets:signingBonus-100},text:'Subject applied through the portal and was taken on as '+vacancy.occupationName+(track?', '+track.name:'')+' at '+(business?business.name:'a new employer')+'. '+money(vacancy.annualSalary)+' a year.'+(signingBonus?' A signing bonus of '+money(signingBonus)+' reflected the subject’s credentials.':'')};
       }
       const reason=result.reason||(application?application.reason:'unfilled');
       if(reason==='annual_application_cap') return{fx:{happiness:-2},text:'Subject had already used this year’s application allowance. The portal would not accept another form.',reason};
       if(reason==='vacancy_full') return{fx:{happiness:-2},text:'Subject applied through the portal, but the employer had already stopped accepting forms for that opening.',reason};
       if(reason==='vacancy_unavailable') return{fx:{happiness:-2},text:'Subject went back to the portal, but that opening had already closed.',reason};
       if(reason==='better_candidate') return{fx:{happiness:-4},text:'Subject applied through the portal, but the position went to a stronger candidate.',reason};
       if(reason==='qualification') return{fx:{happiness:-2},text:'Subject applied through the portal, but did not meet what the position required.',reason};
       if(reason==='duplicate_application') return{fx:{happiness:-1},text:'Subject already had an application on file for that opening — it remains pending.',reason};
       return{fx:{happiness:-2},text:'Subject applied through the portal. Nothing came of it this year.',reason:'unfilled'};
     }
     // Legacy fallback: only reached when VacancySystem/World are unavailable.
     const track=item&&CAREERS.find(c=>c.id===item.track); const stageIdx=item?item.stage:-1;
     if(!track||stageIdx<0) return{fx:{happiness:-2},text:'Subject visited the job portal and found nothing worth the walk this year.'};
     const st=track.stages[stageIdx];
     S.jobTier=stageIdx+1; S.jobName=st.name; S.career=track.id; S.careerYears=0;
     const baseBonus=(stageIdx===0&&track.minEdu&&eduRank()>=EDU_RANK[track.minEdu])?{lower:100,middle:150,upper:250,university:500}[track.minEdu]:0;
     const advantage=typeof educationCareerAdvantage==='function'?educationCareerAdvantage(track):{signingBonus:0,label:''};
     const bonus=baseBonus+(stageIdx===0?(advantage.signingBonus||0):0);
     return{fx:{happiness:4,assets:bonus-100},text:'Subject applied through the portal and was taken on as '+st.name+', '+track.name+'. '+money(st.salary)+' a year, and somewhere new to be on Mondays.'+(bonus?' A signing bonus of '+money(bonus)+' reflected the subject’s credentials.':'')};
   }},
 {id:'overtime',cat:'work',icon:'💼',cost:1,avail:s=>s.jobTier>0&&s.jobName!=='Unemployed'&&s.age<65&&s.jailUntil<=s.age,note:()=>`+~$${200+S.jobTier*120} · −HEALTH/HAPPINESS`,
   apply:()=>({fx:{assets:200+S.jobTier*120,health:-3,happiness:-3},text:pick(['Subject worked the overtime. The pay arrived. So did the exhaustion.','Subject took every extra shift. The coin stack grew; the subject shrank.'])})},
 {id:'court',cat:'rel',icon:'🌹',cost:1,avail:s=>s.partner&&!s.married,note:()=>`tend {partner} · proposal odds rise`,
   apply:()=>{const p=activePartnerContact();if(p){p.mood=clamp(p.mood+12,0,100);syncPartnerMirror();}
     const fx=p?traitAdjustedFx(p,2,3):{relations:3,happiness:2};
     const text=pick(['Subject courted {partner} properly — small kindnesses, no grand gestures. It worked.','Subject took {partner} out and actually listened. The evening was, against odds, lovely.'])+(p?traitFlavorSuffix(p):'');
     return{fx,text}}},
 {id:'tendspouse',cat:'rel',icon:'💍',cost:1,avail:s=>s.married,note:()=>`tend the marriage · +{partner}`,
   apply:()=>{const p=activePartnerContact();if(p){p.mood=clamp(p.mood+14,0,100);syncPartnerMirror();}
     const fx=p?traitAdjustedFx(p,2,3):{relations:3,happiness:2};
     const text=pick(['Subject tended the marriage — the unglamorous work of it. The house warmed.','Subject remembered, this week, to be kind to {partner}. It registered.'])+(p?traitFlavorSuffix(p):'');
     return{fx,text}}},
 {id:'meetsomeone',cat:'rel',icon:'👋',cost:1,avail:s=>s.age>=14&&s.contacts.length<MAX_CONTACTS,note:()=>`choose how — several ways to meet someone, each with its own odds & cost`,
   apply:(S2,item)=>{const v=MEETING_VENUES.find(x=>x.id===(item&&item.venue)); if(!v||!v.req(S)) return{fx:{},text:'Subject meant to go out and meet someone. The year passed anyway.'};
     return resolveMeetOutcome(v);}},
 {id:'tendcontact',cat:'rel',icon:'☎',cost:1,avail:(s,cid)=>!!cid&&s.contacts.some(c=>c.cid===cid&&c.role==='friend'),note:()=>`spend time together · +mood`,
   apply:(S2,item)=>{const c=S.contacts.find(x=>x.cid===item.cid);if(!c)return{fx:{},text:'Subject meant to spend time with someone. The year passed anyway.'};
     c.mood=clamp(c.mood+16,0,100);
     return{fx:traitAdjustedFx(c,2,3),text:'Subject spent real time with '+c.name+' — talked too long, laughed too easily. Worth it.'+traitFlavorSuffix(c)}}},
 {id:'flirt',cat:'rel',icon:'💐',cost:1,avail:(s,cid)=>!!cid&&s.age>=14&&s.contacts.some(c=>c.cid===cid&&c.role==='friend')&&!hasPartner(s),note:()=>`chance rises with your looks, wit & health`,
   apply:(S2,item)=>{const c=S.contacts.find(x=>x.cid===item.cid);if(!c)return{fx:{},text:'Subject meant to flirt with someone. The moment passed.'};
     if(hasPartner(S)) return{fx:{happiness:1},text:'Subject flirted a little with '+c.name+', but matters at home had already moved on by then.'};
     if(chance(flirtSuccessChance(c))){const wasMarried=c.npcMarried,exName=c.npcSpouseName; c.role='partner';c.mood=clamp(c.mood+15,70,100);c.npcMarried=false;c.npcSpouseName=null;c.npcSpouseTemperament=null;S.status='Attached';syncPartnerMirror();
       return{fx:{happiness:8,relations:6},text:'Subject flirted with '+c.name+', and it landed. Something new began, unhurried and a little giddy.'+(wasMarried?' '+c.name+' had, until recently, been married to '+exName+' — a detail that came out later, and complicated things less than it should have.':'')};}
     return{fx:{happiness:-2},text:'Subject flirted with '+c.name+'. It was pleasant. It was not, this year, anything more.'};}},
 {id:'flirtsecret',cat:'rel',icon:'🖤',dark:1,cost:1,avail:(s,cid)=>!!cid&&s.age>=16&&hasPartner(s)&&!(s.activeAffairCids||[]).includes(cid)&&s.contacts.some(c=>c.cid===cid&&c.role==='friend'&&c.cid!==((activePartnerContact()||{}).cid)),note:()=>`begin seeing them behind {partner}'s back · juggling more than one raises the odds of getting caught`,
   apply:(S2,item)=>{const c=S.contacts.find(x=>x.cid===item.cid);if(!c)return{fx:{},text:'Subject meant to see someone, secretly. Nothing came of it, this year.'};
     if(chance(flirtSecretSuccessChance(c))){
       startAffairWith(c,6);
       return{fx:{happiness:5},text:'Subject began seeing '+c.name+', quietly, on the side. No one, for now, was any the wiser.'+(c.npcMarried?' '+c.name+' had, it turned out, someone of their own to be careful of too.':'')};}
     return{fx:{happiness:-1},text:'Subject tried to start something with '+c.name+' on the side. It fizzled before it began, which — this once — was for the best.'};}},
 {id:'covertracks',cat:'rel',icon:'🕵',cost:1,avail:(s,cid)=>!!cid&&s.age>=16&&(s.activeAffairCids||[]).includes(cid),note:()=>`lower the odds of discovery, this year`,
   apply:(S2,item)=>{const c=S.contacts.find(x=>x.cid===item.cid);if(c&&c.affair){c.affair.coverTracksThisYear=true;}
     return{fx:{happiness:-2},text:'Subject was careful. Receipts vanished. Alibis were rehearsed until they sounded true.'};}},
 {id:'family',cat:'rel',icon:'👪',cost:1,avail:s=>s.kids>0,note:()=>`tend the children · +family`,
   apply:()=>{S.familyMood=clamp(S.familyMood+14,0,100);return{fx:{relations:3,happiness:3},text:pick(['Subject gave the children an undivided afternoon. They noticed.','Subject showed up to the thing. The children, for once, did not have to ask twice.'])}}},
 {id:'writemother',cat:'rel',icon:'✉',cost:1,avail:s=>s.age>=8&&s.age<=45&&s.mother&&s.mother.alive&&!s.mother.estranged,note:()=>`write to {mother} · +family`,
   apply:()=>{S.mother.mood=clamp(S.mother.mood+14,0,100);return{fx:{relations:2,happiness:1},text:pick(['Subject wrote to {mother}. The letter was short. The reply was not.','Subject visited home and let {mother} feed them. Both pretended it was ordinary.'])}}},
 {id:'writefather',cat:'rel',icon:'✉',cost:1,avail:s=>s.age>=8&&s.age<=45&&s.father&&s.father.alive&&!s.father.estranged,note:()=>`write to {father} · +family`,
   apply:()=>{S.father.mood=clamp(S.father.mood+14,0,100);return{fx:{relations:2,happiness:1},text:pick(['Subject wrote to {father}. Gruff replies, always answered anyway.','Subject visited home. {father} pretended not to be pleased. He was.'])}}},
 {id:'favor',cat:'rel',icon:'🤝',cost:1,avail:s=>!s.eduStage&&s.relations>=70&&s.age>=16&&s.age>=s.favorCool&&s.jailUntil<=s.age,note:()=>S.jobTier===0?`call in a favor · a friend knows a job`:`call in a favor · a friend knows a way`,
   apply:()=>{S.favorCool=S.age+4;
     if(S.jobTier===0){const tier=Math.max(1,highestQualifyingTier(3)); const job=bestJobForTier(tier)||bestJobForTier(1); S.jobTier=tier;S.jobName=job.name;
       return{fx:{happiness:3},text:'Subject called in a favor. A friend of a friend needed someone reliable — subject started as '+job.name+' the following Monday.'};}
     return{fx:{assets:350,happiness:2},text:'Subject called in a favor. It was repaid, discreetly and in full, no questions asked on either side.'};}},
 {id:'doctor',cat:'health',icon:'⚕',cost:1,avail:s=>s.age>=10,note:()=>`exam · treatment if needed · −$90`,
   apply:()=>{const exam=medicalExamination('doctor'); return {fx:{health:exam.found?3:7,assets:-90},text:'Subject saw the doctor. '+exam.text};}},
 {id:'walk',cat:'health',icon:'🚶',cost:1,avail:s=>s.age>=25,note:()=>`+HEALTH/HAPPINESS (slow, free)`,
   apply:()=>({fx:{health:3,happiness:2},text:pick(['Subject walked it off. The road had opinions, mostly kind.','Subject took the long way home on purpose. It helped, the way it always does.'])})},
 {id:'rest',cat:'health',icon:'💤',cost:0,avail:s=>s.age>=6&&!S.queue.some(q=>q.id==='rest'),note:()=>`do nothing · recover a little`,
   apply:()=>({fx:{health:1,happiness:2},text:pick(['Subject did nothing, on purpose, for a day. The Bureau has no form for this, which is why it worked.','Subject rested. The ceiling beams were counted. The subject was, briefly, not tired.'])})},
 {id:'bottle',cat:'vice',icon:'🍺',cost:1,avail:s=>s.age>=16,dark:1,note:()=>`+HAPPINESS now · −HEALTH · +VICE`,
   apply:()=>{S.vice=Math.min(10,S.vice+1);return{fx:{happiness:3,health:-3},text:pick(['Subject drank to feel better. It worked, briefly, then charged interest.','Subject and the bottle kept an appointment. The bottle was punctual.'])}}},
 {id:'track',cat:'vice',icon:'🎲',cost:1,avail:s=>s.age>=18,dark:1,note:()=>`50/50 money · +VICE`,
   apply:()=>{S.vice=Math.min(10,S.vice+1);if(chance(.5)){return{fx:{assets:300,happiness:3},text:'Subject backed a winner at the track. For one golden afternoon, the system worked.'};}return{fx:{assets:-300,happiness:-2},text:'Subject backed a loser at the track. The horse, like the institution, disappointed.'}}},
 {id:'backroom2',cat:'vice',icon:'🕯',cost:1,avail:s=>s.age>=16,dark:1,note:()=>`−HEALTH/ASSETS · +VICE · a numb hour`,
   apply:()=>{S.vice=Math.min(10,S.vice+2);return{fx:{health:-4,assets:-120,happiness:1},text:pick(['Subject kept the late, lamp-lit hours. The numbness was the point, and the cost.','Subject’s thin polite friends took the money and the health and left the numbness.'])}}},
 {id:'tendmember',cat:'hold',icon:'🤝',cost:1,avail:s=>s.holdMember&&livingHoldMembers().length>0,note:()=>`choose someone in the fold to look after · +their loyalty`,
   apply:(S2,item)=>{const mid=item&&item.member; const m=findHoldMember(mid);
     if(!m) return{fx:{},text:'Subject meant to look in on someone. The year passed anyway.'};
     changeHoldLoyalty(m,14);
     return{fx:{relations:2,happiness:2},text:'Subject spent the year looking after '+m.first+' '+m.last+' — small kindnesses, steady attention. It was noticed.'};}},
 {id:'gig',cat:'work',icon:'🕶',cost:1,avail:s=>!s.eduStage&&s.age>=10&&GIGS.some(g=>g.req(s)),note:()=>'off the books — nasty, unlicensed, no guarantee of pay',
   apply:(S2,item)=>{const g=GIGS.find(x=>x.id===(item&&item.gig)); if(!g||!g.req(S)) return{fx:{},text:'Subject went looking for off-book work and found nothing worth the risk this year.'};
     return resolveGigOutcome(g);}},
];

/* ================= MEETING VENUES (ways to meet someone new) ================= */
const MEETING_VENUES=[
 {id:'dancehall',name:'The Dance Hall',icon:'💃',blurb:'music, punch, a crowded floor',
   req:s=>s.age>=14,reqLabel:'age 14+',meetChance:0.55,cost:0,fx:{happiness:3},
   bias:{charm:[40,90],kindness:[30,90],intellect:[15,75],fidelity:[20,90]},
   missText:'Subject went to the dance and came home with sore feet and no one’s name.',
   hitText:'Subject went to the dance and met {name}, more or less by accident.'},
 {id:'library',name:'The Public Library',icon:'📚',blurb:'quiet, studious, a little shy',
   req:s=>s.age>=10,reqLabel:'age 10+',meetChance:0.4,cost:0,fx:{smarts:1},
   bias:{intellect:[60,95],charm:[15,55],kindness:[35,85],fidelity:[50,95]},
   missText:'Subject spent the afternoon reading. Good company, if you count the book.',
   hitText:'Subject struck up a quiet conversation with {name} over the returns cart.'},
 {id:'tavern',name:'The Tavern',icon:'🍺',dark:1,blurb:'cheap drinks, loud company, looser morals',
   req:s=>s.age>=16,reqLabel:'age 16+',meetChance:0.6,cost:25,fx:{happiness:2,health:-2},
   bias:{charm:[30,90],kindness:[10,55],intellect:[10,55],fidelity:[5,45]},
   missText:'Subject drank, alone, at a bar full of strangers who stayed that way.',
   hitText:'Subject fell into conversation with {name} somewhere around the third round.'},
 {id:'congregation',name:'The Congregation',icon:'⛪',blurb:'sunday best, familiar faces, gentle company',
   req:s=>s.age>=10,reqLabel:'age 10+',meetChance:0.45,cost:0,fx:{relations:2},
   bias:{kindness:[60,95],fidelity:[55,95],charm:[20,65],intellect:[30,80]},
   missText:'Subject attended, sang along, and went home the same as they came.',
   hitText:'Subject was introduced to {name} after the service, over weak coffee.'},
 {id:'gym',name:'The Athletic Club',icon:'🏋',blurb:'sweat, competition, good health showing',
   req:s=>s.age>=14,reqLabel:'age 14+',meetChance:0.5,cost:20,fx:{health:3,looks:1},
   bias:{charm:[40,90],kindness:[30,80],intellect:[15,65],fidelity:[30,90]},
   missText:'Subject trained hard and alone. The mirrors were, at least, good company.',
   hitText:'Subject sparred, or tried to, with {name}, who turned out to be worth talking to after.'},
 {id:'gallery',name:'An Art Opening',icon:'🎨',blurb:'wine, pretension, interesting people',
   req:s=>s.age>=18,reqLabel:'age 18+',meetChance:0.5,cost:45,fx:{happiness:2,looks:1},
   bias:{charm:[50,95],intellect:[50,95],kindness:[20,70],fidelity:[15,65]},
   missText:'Subject looked at the paintings, mostly, and left with opinions and no one to share them with.',
   hitText:'Subject got into an argument about the third painting with {name}. It went well.'},
 {id:'backroom',name:'A Backroom Introduction',icon:'🗝',dark:1,blurb:'a friend of a friend, no names on paper',
   req:s=>s.age>=18,reqLabel:'age 18+',meetChance:0.4,moneyRange:[40,180],fx:{happiness:-1},
   bias:{charm:[30,90],kindness:[5,45],intellect:[30,80],fidelity:[5,35]},
   missText:'Subject waited in the back room for an introduction that never came. The evening, at least, was profitable.',
   hitText:'Subject was introduced to {name}, no last name offered, and none asked for.'},
 {id:'charity',name:'A Charity Drive',icon:'🤍',blurb:'volunteering, good company, a clean conscience',
   req:s=>s.age>=16,reqLabel:'age 16+',meetChance:0.5,cost:30,fx:{happiness:4,relations:3},
   bias:{kindness:[60,95],fidelity:[50,90],charm:[30,80],intellect:[30,80]},
   missText:'Subject volunteered the whole afternoon and mostly moved boxes.',
   hitText:'Subject worked the whole drive alongside {name}, boxes and all.'},
];
function meetVenueStatusLine(v){
  if(!v.req(S)) return v.reqLabel;
  const costText=v.moneyRange?('+'+money(v.moneyRange[0])+'–'+money(v.moneyRange[1])):(v.cost?('−'+money(v.cost)):'free');
  return P(v.meetChance)+' chance to meet someone · '+costText+' · '+fxSummary(v.fx)+' · '+v.blurb;
}
function resolveMeetOutcome(v){
  const moneyDelta=v.moneyRange?RI(v.moneyRange[0],v.moneyRange[1]):-(v.cost||0);
  const fx=Object.assign({},v.fx);
  if(moneyDelta) fx.assets=(fx.assets||0)+moneyDelta;
  if(v.dark&&v.moneyRange) S.vice=Math.min(10,S.vice+1);
  if(S.contacts.length>=MAX_CONTACTS||!chance(v.meetChance)) return{fx,text:v.missText};
  const c=makeContact(S.sex==='M'?'F':'M',v.bias);
  S.contacts.push(c);
  return{fx,text:v.hitText.replace('{name}',c.name)};
}

/* ================= GIGS (off-the-books work — no skills, no references, no questions) ================= */
const GIGS=[
 {id:'ratcatcher',name:'Rat Catcher',icon:'🐀',cat:'labor',blurb:'clearing cellars and granaries of vermin, paid by the tail',
   req:s=>s.age>=12,reqLabel:'age 12+',pay:[20,70],happiness:-2,scam:.06,dangerP:.05,dangerFx:{health:-4},
   dangerText:'Cornered rats do not go quietly. Subject came home bitten and unpaid.',
   okText:'Subject cleared three cellars of vermin and was paid, more or less, by the tail.'},
 {id:'ragbone',name:'Rag-and-Bone',icon:'🧺',cat:'labor',blurb:'hauling scrap, bones, and bottles for whatever the yard will pay',
   req:s=>s.age>=10,reqLabel:'age 10+',pay:[15,55],happiness:-1,scam:.05,dangerP:.03,dangerFx:{health:-3},
   dangerText:'The cart tipped on a bad cobble. Subject and the scrap both hit the ground.',
   okText:'Subject dragged a cart of scrap and bone through the streets and sold the lot to the yard.'},
 {id:'sewer',name:'Sewer Scavenger',icon:'🕳',cat:'labor',blurb:'wading the drains for dropped coin, lost rings, anything the city flushed away',
   req:s=>s.age>=14,reqLabel:'age 14+',pay:[20,170],happiness:-4,scam:.08,dangerP:.09,dangerFx:{health:-7},
   dangerText:'Something in the water disagreed with the subject, badly.',
   okText:'Subject came up from the drains with a pocketful of things the city thought it had lost for good.'},
 {id:'corpsecart',name:'Mortuary Hauler',icon:'💀',cat:'labor',blurb:'moving the dead, no questions, cash on delivery',
   req:s=>s.age>=16,reqLabel:'age 16+',pay:[60,150],happiness:-6,scam:.10,dangerP:.05,dangerFx:{health:-4,happiness:-3},
   dangerText:'The work found a way to follow the subject home, in the quiet hours.',
   okText:'Subject moved the dead where they needed to go and did not look too closely at any of them.'},
 {id:'scab',name:'Picket-Line Muscle',icon:'🪓',cat:'labor',blurb:'crossing another union’s line for someone else’s wage',
   req:s=>s.age>=16&&s.health>=35,reqLabel:'age 16+ · HEALTH 35+',pay:[80,220],happiness:-7,baseFx:{relations:-2},scam:.12,dangerP:.15,dangerFx:{health:-10,relations:-4},
   dangerText:'The line did not part quietly. Subject was recognized, and remembered, and hit.',
   okText:'Subject crossed the line, took the wage, and did not tell the neighbors where it came from.'},
 {id:'trial',name:'Human Trial Subject',icon:'💊',cat:'labor',blurb:'letting a University lab try something new on you, for a fee',
   req:s=>s.age>=18,reqLabel:'age 18+',pay:[60,260],happiness:-3,scam:.08,dangerP:.12,dangerFx:{health:-9},
   dangerText:'Whatever they were testing did not agree with the subject at all.',
   okText:'Subject sat through the trial, filled out the forms, and left with the fee and no obvious new symptoms.'},
 {id:'bloodseller',name:'Blood & Plasma',icon:'🩸',cat:'labor',blurb:'a pint at a time, for a modest but reliable fee',
   req:s=>s.age>=16&&s.health>=30,reqLabel:'age 16+ · HEALTH 30+',pay:[15,45],happiness:-1,baseFx:{health:-2},scam:.03,dangerP:.02,dangerFx:{health:-6},
   dangerText:'A bad draw left the subject light-headed for days.',
   okText:'Subject sold a pint, ate the free biscuit, and pocketed the modest fee.'},
 {id:'nightwork',name:'Night Work',icon:'🌙',cat:'body',blurb:'company for hire, by the hour, arranged discreetly',
   req:s=>s.age>=18&&s.looks>=50,reqLabel:'age 18+ · LOOKS 50+',pay:[150,450],happiness:-7,viceTag:2,scam:.18,dangerP:.10,dangerFx:{health:-10},
   dangerText:'The client was not what was arranged, nor was the evening what was promised.',
   okText:'Subject kept the appointment, kept the details private, and was paid — this time — as agreed.'},
 {id:'companion',name:'A Discreet Companion',icon:'💋',cat:'body',blurb:'a higher class of arrangement, for a higher class of client',
   req:s=>s.age>=21&&s.looks>=72,reqLabel:'age 21+ · LOOKS 72+',pay:[300,800],happiness:-6,viceTag:2,scam:.10,dangerP:.07,dangerFx:{relations:-6},
   dangerText:'Discretion failed someone tonight. It was not the subject who chose to talk.',
   okText:'Subject was, for one evening, extremely good company, and extremely well paid for it.'},
 {id:'longcon',name:'The Long Con',icon:'🎭',cat:'smart',blurb:'a slow, elaborate swindle, played out over weeks',
   req:s=>s.age>=18&&s.smarts>=58&&s.looks>=42,reqLabel:'age 18+ · SMARTS 58+ · LOOKS 42+',pay:[250,700],happiness:-5,crimeTag:1,scam:.10,dangerP:.18,dangerFx:{},
   dangerText:'The mark figured it out one step from the finish. The magistrate was not charmed at all.',
   okText:'Subject ran the long game to its quiet, profitable end, and the mark never quite worked out how.'},
 {id:'forger',name:'Forger’s Hand',icon:'✒',cat:'smart',blurb:'papers, signatures, and seals that hold up to a quick glance',
   req:s=>s.age>=16&&s.smarts>=52,reqLabel:'age 16+ · SMARTS 52+',pay:[180,550],happiness:-5,crimeTag:1,scam:.12,dangerP:.12,dangerFx:{},
   dangerText:'A clerk looked twice. The second look is the one that matters.',
   okText:'Subject’s work passed every glance it needed to pass, and was paid in the usual unmarked way.'},
 {id:'fence',name:'Fence',icon:'💰',cat:'smart',blurb:'appraising and moving goods that fell off the back of something',
   req:s=>s.age>=16&&s.smarts>=48,reqLabel:'age 16+ · SMARTS 48+',pay:[140,420],happiness:-4,crimeTag:1,scam:.15,dangerP:.10,dangerFx:{},
   dangerText:'The goods, it turned out, were being watched. So, briefly, was the subject.',
   okText:'Subject named a fair price, moved the goods along, and took the usual cut.'},
 {id:'runner',name:'Numbers Runner',icon:'🔢',cat:'smart',blurb:'collecting bets and carrying slips for the illegal lottery',
   req:s=>s.age>=14&&s.smarts>=42,reqLabel:'age 14+ · SMARTS 42+',pay:[90,320],happiness:-3,crimeTag:1,scam:.10,dangerP:.08,dangerFx:{},
   dangerText:'A raid caught the subject mid-round, slips in hand.',
   okText:'Subject carried the slips, collected the bets, and kept the ledger straight in their head.'},
 {id:'navigator',name:'Smuggler’s Navigator',icon:'🗺',cat:'smart',blurb:'plotting routes past checkpoints for people moving goods that shouldn’t move',
   req:s=>s.age>=18&&s.smarts>=55,reqLabel:'age 18+ · SMARTS 55+',pay:[200,550],happiness:-5,crimeTag:2,scam:.14,dangerP:.12,dangerFx:{},
   dangerText:'The route was good. The tip-off was better. Subject was waiting for them at the checkpoint.',
   okText:'Subject plotted a route clean past every checkpoint that mattered, and was paid for the cleverness of it.'},
 {id:'backalleymed',name:'Back-Alley Medicine',icon:'⚕',cat:'skilled',blurb:'stitches, set bones, and quiet diagnoses for people who can’t afford a licensed doctor',
   req:s=>s.age>=18&&(s.skills.care||0)>=3,reqLabel:'CARE & MEDICINE 3+',pay:[150,400],happiness:-4,crimeTag:1,scam:.10,dangerP:.10,dangerFx:{relations:-4},
   dangerText:'Something went wrong on the table, and the patient’s family did not forgive quietly.',
   okText:'Subject patched them up well enough, took the fee, and left before anyone asked for a license.'},
 {id:'chopshop',name:'Chop-Shop Mechanic',icon:'🔧',cat:'skilled',blurb:'stripping cars that were, until recently, someone else’s',
   req:s=>s.age>=16&&(s.skills.craft||0)>=3,reqLabel:'CRAFT & MECHANICS 3+',pay:[120,350],happiness:-4,crimeTag:2,scam:.12,dangerP:.10,dangerFx:{},
   dangerText:'The car’s owner turned up looking for it rather sooner than expected.',
   okText:'Subject stripped the car for parts, quick and clean, and moved the pieces along.'},
 {id:'moonshine',name:'Moonshine Brewer',icon:'🍺',cat:'skilled',blurb:'a still in the cellar and a market that never asks where it came from',
   req:s=>s.age>=18&&(s.skills.land||0)>=2,reqLabel:'LAND & PROVISIONS 2+',pay:[70,240],happiness:-3,crimeTag:1,scam:.08,dangerP:.08,dangerFx:{health:-8},
   dangerText:'A bad batch nearly took the cellar, and the subject’s eyebrows, with it.',
   okText:'Subject ran off a clean batch and sold it quietly, jar by jar.'},
 {id:'fightclub',name:'Underground Fight Club',icon:'🥊',cat:'skilled',blurb:'unlicensed bouts, cash on the ropes, no doctor at ringside',
   req:s=>s.age>=16&&(s.skills.athletics||0)>=3,reqLabel:'ATHLETICS 3+',pay:[80,400],happiness:-5,scam:.08,dangerP:.30,dangerFx:{health:-12},
   dangerText:'Subject lost the bout, badly, and left with bruises instead of a purse.',
   okText:'Subject won the bout, took the purse off the ropes, and iced everything on the way home.'},
 {id:'poacher',name:'Poacher',icon:'🏹',cat:'skilled',blurb:'taking game off land that isn’t yours to hunt',
   req:s=>s.age>=14&&(s.skills.land||0)>=3,reqLabel:'LAND & PROVISIONS 3+',pay:[70,260],happiness:-3,crimeTag:1,scam:.10,dangerP:.10,dangerFx:{health:-5},
   dangerText:'A gamekeeper’s trap caught more than game this time.',
   okText:'Subject brought back a good haul from land that wasn’t theirs to hunt, and sold it before anyone asked.'},
 {id:'knockoff',name:'Knockoff Tailor',icon:'🪡',cat:'skilled',blurb:'stitching convincing fakes of labels that cost a great deal more than thread',
   req:s=>s.age>=14&&(s.skills.retail||0)>=3,reqLabel:'RETAIL & TRADE SERVICE 3+',pay:[80,280],happiness:-2,crimeTag:1,scam:.10,dangerP:.06,dangerFx:{},
   dangerText:'An inspector had a very good eye for stitching, as it turned out.',
   okText:'Subject stitched a batch of very convincing fakes and sold them at a very convincing markup.'},
];
const GIG_CATS=[{id:'labor',label:'DESPERATE LABOR'},{id:'body',label:'BODY FOR HIRE'},{id:'smart',label:'CLEVER & CRIMINAL'},{id:'skilled',label:'UNDER-THE-TABLE TRADE'}];
const GIG_SCAM_TEXT=['Stiffed — no pay, no apology, and no one to complain to who’d care.','Paid in promises. The promises did not cash.','The client vanished before the money did.','Told to come back tomorrow for payment. Tomorrow, no one answered.'];
const GIG_SHORT_TEXT=['Paid a fraction of what was promised. Familiar, by now.','Talked down to half the agreed rate, with no real leverage to argue.','Paid late, and light, and with an excuse attached.'];
function resolveGigOutcome(g){
  const base=g.baseFx||{};
  if(g.crimeTag&&chance((S.scrutiny||0)*0.004)){
    S.record=true; S.scrutiny=clamp((S.scrutiny||0)+12,0,100);
    return {fx:Object.assign({happiness:g.happiness-6,assets:0},base),text:'An inspector was already watching. The work ended without pay and with a fresh notation in the file.'};
  }
  if(chance(g.dangerP)){
    if(g.crimeTag){S.crime=Math.min(10,(S.crime||0)+1); if(chance(.65)) S.record=true;}
    if(g.viceTag) S.vice=Math.min(10,(S.vice||0)+g.viceTag);
    const fx=Object.assign({happiness:g.happiness-4},base,g.dangerFx||{});
    return{fx,text:g.dangerText};
  }
  if(chance(g.scam)){
    const partial=chance(.5);
    const pay=partial?Math.round(RI(g.pay[0],g.pay[1])*R(.15,.45)):0;
    if(g.crimeTag) S.crime=Math.min(10,(S.crime||0)+1);
    if(g.viceTag) S.vice=Math.min(10,(S.vice||0)+g.viceTag);
    const fx=Object.assign({happiness:g.happiness-2,assets:pay},base);
    return{fx,text:pick(partial?GIG_SHORT_TEXT:GIG_SCAM_TEXT)};
  }
  let pay=RI(g.pay[0],g.pay[1]), jackpot=false;
  if(chance(.1)){pay=Math.round(pay*R(1.4,2.1)); jackpot=true;}
  if(g.crimeTag) S.crime=Math.min(10,(S.crime||0)+1);
  if(g.viceTag) S.vice=Math.min(10,(S.vice||0)+g.viceTag);
  const fx=Object.assign({happiness:g.happiness,assets:pay},base);
  return{fx,text:g.okText+(jackpot?' The client, unexpectedly, paid well over the going rate.':'')};
}

/* ================= DECISIONS ================= */
const DECISIONS=[
 {id:'propose',cost:1,cat:'rel',avail:s=>s.partner&&!s.married&&s.age>=18,note:()=>`{partner} says yes ${P(proposeP())}`,
   apply:()=>{const p=activePartnerContact();
     if(chance(proposeP())){S.married=true;S.status='Married';if(p){p.role='spouse';p.mood=85;}syncPartnerMirror();return{fx:{happiness:12,relations:10,assets:-250},text:'Subject proposed to {partner}. The answer was yes. The Bureau found the subject’s smile excessive, and filed it.'};}
     if(p){p.mood=clamp(p.mood-12,0,100);syncPartnerMirror();}return{fx:{happiness:-8},text:'Subject proposed to {partner}. The answer was not yet, which in the subject’s ear sounded like no. The ring went back in the box.'}}},
 {id:'trychild',cost:1,cat:'rel',avail:s=>s.married&&s.kids<4&&s.age>=20&&s.age<=43,note:()=>`a child ${P(childP())}`,
   apply:()=>{if(chance(childP())){S.kids++;S.familyMood=72;bearChild();return{fx:{happiness:6,assets:-300,relations:6,health:-2},text:'A child was born to the subject. The Bureau congratulates the subject, cautiously, and opens a new sub-file.'};}
     return{fx:{happiness:-4},text:'Subject hoped for a child. The year passed without news. The Bureau files the silence gently.'}}},
 {id:'presspromo',cost:1,cat:'work',avail:s=>s.jobTier>=1&&s.jobTier<5,note:()=>`climb the ladder ${P(promoP())}`,
   apply:()=>{
    if(typeof EmploymentSystem==='object'&&EmploymentSystem&&typeof EmploymentSystem.requestPromotion==='function'&&typeof World!=='undefined'&&World){
      const contract=EmploymentSystem.activeForPerson(World,'subject')[0];
      if(!contract) return{fx:{happiness:-2},text:'Subject pressed for the promotion, but is not currently employed anywhere.',reason:'no_active_contract'};
      const result=EmploymentSystem.requestPromotion(World,contract.id,{year:World.year,subject:S});
      if(result.accepted){
        const business=BusinessSystem&&typeof BusinessSystem.get==='function'?BusinessSystem.get(World,contract.businessId):null;
        return{fx:{happiness:5,assets:150},text:'Subject pressed for the promotion — and got it: '+contract.occupationName+' at '+(business?business.name:'the same employer')+'. '+money(contract.annualSalary)+' now, on paper.'};
      }
      if(result.reason==='annual_application_cap') return{fx:{happiness:-2},text:'Subject had already used this year’s application allowance. The promotion form was not accepted.',reason:'annual_application_cap'};
      if(result.reason==='vacancy_full') return{fx:{happiness:-2},text:'Subject pressed for the promotion, but the employer had already stopped accepting forms for that opening.',reason:'vacancy_full'};
      if(result.reason==='vacancy_unavailable') return{fx:{happiness:-2},text:'Subject pressed for the promotion, but the opening had already closed.',reason:'vacancy_unavailable'};
      if(result.reason==='no_opening') return{fx:{happiness:-2},text:'Subject pressed for the promotion. There is no higher opening at this employer right now.',reason:'no_opening'};
      if(result.reason==='not_qualified'||result.reason==='insufficient_tenure') return{fx:{happiness:-2},text:'Subject pressed for the promotion. Not without more time or qualification, they said.',reason:result.reason};
      if(result.reason==='rejected') return{fx:{happiness:-4},text:'Subject pressed for the promotion. It went to a stronger candidate instead.',reason:'rejected'};
      return{fx:{happiness:-2},text:'Subject pressed for the promotion. Nothing came of it this year.',reason:result.reason||'unfilled'};
    }
    if(S.career){ const track=CAREERS.find(c=>c.id===S.career);
      if(!careerStageQualifies(track,S.jobTier)){ const missing=careerMissingRequirements(track,S.jobTier);
         return{fx:{happiness:-2},text:'Subject pressed for the promotion. Not without more '+(missing.length?missing.join(' and '):'time')+', they said.'}; }
       const yearsNeeded=typeof careerYearsRequired==='function'?careerYearsRequired(track,S.jobTier):CAREER_EXP[S.jobTier-1];
       if(S.careerYears<yearsNeeded) return{fx:{happiness:-2},text:'Subject pressed for the promotion. “You have not been here long enough,” said the man with the stamps. '+yearsNeeded+' year'+(yearsNeeded===1?'':'s')+' in the current rung is the usual measure.'};
       if(chance(promoP())){ const next=track.stages[S.jobTier]; S.jobTier++; S.jobName=next.name; S.careerYears=0;
         return{fx:{happiness:5,assets:150},text:'Subject pressed for the promotion — and got it: '+next.name+'. '+money(next.salary)+' now, on paper.'}; }
       return{fx:{happiness:-4},text:'Subject pressed for the promotion. The promotion pressed back, downward. Subject said it was fine. It was not.'};
     }
     if(chance(promoP())){const job=bestJobForTier(S.jobTier+1);
       if(job){S.jobTier++;S.jobName=job.name;return{fx:{happiness:5,assets:150},text:'Subject pressed for the promotion — and got it. New office. Same clock, somehow louder.'};}
       return{fx:{happiness:-3},text:'Subject pressed for the promotion. The answer was “when you’re ready” — a polite no, dressed as patience.'};}
     return{fx:{happiness:-4},text:'Subject pressed for the promotion. The promotion pressed back, downward. Subject said it was fine. It was not.'}}},
 {id:'learntrade',cost:2,cat:'work',avail:s=>s.age>=16&&typeof educationProgramOptions==='function'&&educationProgramOptions().length>0,note:()=>`choose a vocational course · certificate, skill, and a clearer work route`,
   apply:()=>({fx:{smarts:6,assets:-150,happiness:1},text:pick(['Subject took night classes. The daytime self was tired; the nighttime self was sharper.','Subject learned a trade by lamplight. The certificate, when it came, was worth the squint.'])})},
 {id:'nightshift',cost:1,cat:'work',avail:s=>s.jobTier>0&&s.jobName!=='Unemployed',note:()=>`+overtime pay · −HEALTH`,
   apply:()=>({fx:{assets:400,health:-3},text:'Subject took the night shift. The overtime was real. So was the permanent shadow under the eyes.'})},
 {id:'quitjob',cost:0,cat:'work',avail:s=>s.jobTier>0&&s.freedom>=30,note:()=>`walk out · requires freedom 30+`,
   apply:()=>{
    if(typeof EmploymentSystem==='object'&&EmploymentSystem&&typeof EmploymentSystem.resign==='function'&&typeof World!=='undefined'&&World){
      const contract=EmploymentSystem.activeForPerson(World,'subject')[0];
      if(!contract) return{fx:{},text:'Subject meant to quit, but there was no job left to quit.',reason:'already_unemployed'};
      EmploymentSystem.resign(World,contract.id,'voluntary_resignation',World.year,{subject:S});
      return{fx:{happiness:3},text:'Subject quit, on a Tuesday, at noon. The walk home was the best part. The rent, the worst.'};
    }
    S.jobTier=0;S.jobName='Unemployed';S.career=null;return{fx:{happiness:3},text:'Subject quit, on a Tuesday, at noon. The walk home was the best part. The rent, the worst.'}}},
 {id:'relocate',cost:2,cat:'personal',avail:s=>s.age>=18&&s.freedom>=40,note:()=>`the coast · freedom 40+ · +HAPPINESS/HEALTH · −$`,
   apply:()=>{S.didCoast=true;return{fx:{assets:-500,happiness:6,health:2},text:'Subject relocated to the coastal district. The sea did not fix everything. It fixed some, which was the deal.'}}},
 {id:'leave',cost:1,cat:'personal',avail:s=>s.age>=20&&s.age<55&&s.freedom>=50,note:()=>`a year to wander · freedom 50+ · +HAPPINESS −$`,
   apply:()=>{S.didLeave=true;return{fx:{assets:-300,happiness:8},text:'Subject took a year off to “find themselves.” They returned with a beard and a theory about rivers.'}}},
  {id:'leaveschool',cost:0,cat:'personal',avail:s=>!!s.eduStage,note:()=>{const st=SCHOOL_STAGES.find(x=>x.id===S.eduStage);return `leave ${st?st.name:'school'} now · +HAPPINESS · stunts SMARTS growth`;},
    apply:()=>{const st=SCHOOL_STAGES.find(x=>x.id===S.eduStage); S.eduDropped=true; S.eduStage=null; if(typeof ensureEducationState==='function'){ensureEducationState(S);S.education.withdrawn=true;S.education.stageId=null;S.education.status='withdrawn';if(typeof educationSyncLegacy==='function')educationSyncLegacy(S);} S.pendingSchoolStage=null; syncEduJobTitle();
     return{fx:{smarts:-5,happiness:3},text:'Subject walked out of '+(st?st.name:'school')+' for good. No ceremony, no diploma, and — for now — no regrets.'};}},
 {id:'loan',cost:1,cat:'work',avail:s=>s.jobTier>0,note:()=>`+$2,000 now · a venture (risky)`,
   apply:()=>{const ok=chance(.55);pushFollow({at:S.age+3,t:ok?'The venture turned a profit. The subject bought new shoes and a better mood.':'The venture failed in the manner of most ventures.',fx:ok?{assets:3800,happiness:6}:{assets:-600,happiness:-7}});return{fx:{assets:2000,happiness:3},text:'Subject took the loan and signed four times, in slightly different handwriting. The venture began.'}}},
 {id:'gamblelic',cost:1,cat:'vice',avail:s=>s.age>=25,note:()=>`a gambling hall · +money · +VICE`,
   apply:()=>{S.vice=Math.min(10,S.vice+2);return{fx:{assets:800,happiness:3},text:'Subject opened a gambling hall. The name appeared in two newspapers, in different sections.'}}},
 {id:'expunge',cost:1,cat:'personal',avail:s=>!!s.record,note:()=>`clear the record · −$`,
   apply:()=>{S.record=false;return{fx:{assets:-200},text:'Subject paid to have the record expunged. The file remembers, but the file is professional.'}}},
 {id:'treatment',cost:1,cat:'personal',avail:s=>activeConditions().some(c=>c.known),note:()=>`treat a condition on file · −$`,
   apply:(S2,item)=>{const c=(item&&item.condition?conditionById(item.condition):activeConditions().filter(x=>x.known).sort((a,b)=>b.severity-a.severity)[0]); const r=c&&treatCondition(c.instanceId,item&&item.treatment); if(!r) return {fx:{},text:'The treatment order could not be matched to an active medical file.'}; if(r.blocked) return {fx:{happiness:-1},text:r.text}; return {fx:{health:r.health,happiness:1,assets:-r.cost},text:r.text};}},
 {id:'usefavor',cost:1,cat:'personal',avail:s=>s.bureauFavor>0&&(s.scrutiny>0||s.record),note:()=>`spend 1 Bureau Favor · lower scrutiny`,
   apply:()=>{S.bureauFavor--; S.scrutiny=Math.max(0,S.scrutiny-30); if(S.record&&chance(.35)) S.record=false; updatePersonalStanding(); return {fx:{happiness:2},text:'Subject spent a Bureau Favor on an administrative correction. The red ink lightened, though the paper remembers.'};}},
 {id:'earlyret',cost:1,cat:'work',avail:s=>s.age>=55&&s.age<=64&&s.jobTier>0,note:()=>`retire early · +HAPPINESS, pension`,
   apply:()=>{S.pensionBase=300+S.jobTier*300;S.jobTier=0;S.jobName='Pensioner (early)';S.career=null;return{fx:{happiness:6},text:'Subject retired early, at noon on a Tuesday, and never went back. The pension paperwork arrived eventually.'}}},
 {id:'namechange',cost:1,cat:'personal',avail:s=>s.age>=18,note:()=>`a new name · +HAPPINESS`,
   apply:()=>{S.first=pickName(S.sex==='M'?MALE:FEMALE);renderIdentity();return{fx:{happiness:4},text:'Subject changed their name, citing “a new era.” The Bureau updated its records under protest. The subject seemed lighter.'}}},
 {id:'crime',cost:1,cat:'vice',avail:s=>s.age>=14&&s.crime<=3&&s.jailUntil<=s.age,
   note:()=>{const L=['lift a wallet','run the numbers','fence the goods','the big score'];return `${L[S.crime]} · caught ${P(catchP(S.crime))}`;},dark:1,
   apply:()=>{const tier=S.crime, cp=catchP(tier), reward=[120,400,900,4000][tier];
     if(chance(cp)){S.record=true;S.vice=Math.min(10,S.vice+1);
       if(tier>=2){const ju=S.age+2;pushFollow({at:S.age+1,t:'Subject was caught and put away. The file was moved to a different shelf.',fx:{happiness:-8,health:-5,relations:-8},side:s2=>{s2.jobTier=0;s2.jobName='Unemployed';s2.career=null;s2.jailUntil=ju;}});}
       return{fx:{happiness:-6,health:-3},text:pick(['Subject was caught mid-act. The magistrate was not in a “youthful” mood this time.','Subject’s luck, such as it was, ran out behind the market. The cuffs were cold.'])};}
     S.crime++;S.vice=Math.min(10,S.vice+1);return{fx:{assets:reward,happiness:3},text:pick(['Subject pulled it off clean. The coin was good; the sleep afterward was not.','The job went smooth as a filed form. Subject pocketed the take and checked the exits twice.'])}}},
 {id:'breakup',cost:1,cat:'rel',avail:s=>s.partner&&!s.married,note:()=>`end it with {partner} · relief or regret, depending`,
   apply:()=>{const wasGood=S.partnerMood>55, p=S.partner; endMarriageSide(S,'Single');
     return wasGood
       ?{fx:{happiness:-6,relations:-3},text:'Subject ended it with '+p+', cleanly, for reasons that sounded better rehearsed than lived. It was, by most measures, still good. Subject left anyway.'}
       :{fx:{happiness:4,relations:-1},text:'Subject ended it with '+p+'. The relief arrived first, ahead of every other feeling, and stayed longest.'};}},
 {id:'divorce',cost:2,cat:'rel',avail:s=>s.married,note:()=>`file for divorce · a settlement · relief or regret`,
   apply:()=>{const wasGood=S.partnerMood>55, settlement=Math.round(Math.max(0,S.assets)*0.25), p=S.partner;
     endMarriageSide(S,'Divorced');
     return wasGood
       ?{fx:{assets:-settlement,happiness:-10,relations:-5},text:'Subject filed for divorce from '+p+'. The lawyers did the arithmetic; the settlement took the rest. There was no villain in it, which somehow made it worse.'}
       :{fx:{assets:-settlement,happiness:6,relations:-2},text:'Subject filed for divorce from '+p+'. The settlement was expensive. The quiet that followed was not.'};}},
 {id:'cutcontact',cost:1,cat:'rel',avail:(s,cid)=>!!cid&&s.contacts.some(c=>c.cid===cid&&c.role==='friend'),note:()=>`cut them off · a clean, cold break`,
   apply:(S2,item)=>{const c=S.contacts.find(x=>x.cid===item.cid);if(!c)return{fx:{},text:'Subject meant to cut someone off. There was, this year, no one left to cut.'};
     const name=c.name; S.contacts=S.contacts.filter(x=>x.cid!==c.cid);
     return{fx:{happiness:-2,relations:-2},text:'Subject stopped answering when '+name+' called. Eventually '+name+' stopped calling. Nothing was said aloud, which was the whole method.'};}},
 {id:'endaffair',cost:1,cat:'rel',avail:(s,cid)=>!!cid&&(s.activeAffairCids||[]).includes(cid),note:()=>`end it with {other}, quietly · no one need know`,
   apply:(S2,item)=>{const c=S.contacts.find(x=>x.cid===item.cid); const name=c?c.name:'them';
     endAffairSide(S,item.cid,false);
     return{fx:{happiness:-3},text:'Subject ended it with '+name+', quietly, before it could become anything else. The better angel won, for now, and it cost something to listen to it.'};}},
 {id:'estrangemother',cost:1,cat:'rel',avail:s=>s.age<50&&s.mother&&s.mother.alive&&!s.mother.estranged,note:()=>`go no-contact with {mother} · the quiet kind of leaving`,
   apply:()=>{const wasGood=S.mother.mood>55; S.mother.estranged=true;S.mother.mood=0;
     return wasGood
       ?{fx:{happiness:-8,relations:-4},text:'Subject stopped writing home. No fight prompted it, exactly — just a long, gathering silence the subject finally let win.'}
       :{fx:{happiness:3,relations:-2},text:'Subject stopped writing home. The silence, for once, felt like the subject’s own choice, and not a wound.'};}},
 {id:'estrangefather',cost:1,cat:'rel',avail:s=>s.age<50&&s.father&&s.father.alive&&!s.father.estranged,note:()=>`go no-contact with {father} · the quiet kind of leaving`,
   apply:()=>{const wasGood=S.father.mood>55; S.father.estranged=true;S.father.mood=0;
     return wasGood
       ?{fx:{happiness:-8,relations:-4},text:'Subject stopped answering {father}’s calls. No fight prompted it, exactly — just a long, gathering silence the subject finally let win.'}
       :{fx:{happiness:3,relations:-2},text:'Subject stopped answering {father}’s calls. The silence, for once, felt like the subject’s own choice, and not a wound.'};}},
 {id:'recruit',cost:1,cat:'hold',avail:s=>s.holdMember&&s.age>=18&&s.relations>=40&&livingHoldMembers().filter(m=>m.relation==='recruit').length<6,note:()=>`bring someone into the fold · a risk, a trust · +HEAT`,
   apply:()=>{const sex=chance(.5)?'M':'F'; const first=pick(sex==='M'?MALE:FEMALE); const last=pick(LAST);
     const m=addHoldMember({first,last,sex,dob:currentYear()-RI(18,40),relation:'recruit',loyalty:RI(35,60)});
     Hold.heat=clamp(Hold.heat+8,0,100);
     return{fx:{happiness:2,relations:2},text:'Subject brought '+m.first+' '+m.last+' into the fold, on trust and little else. Trust, so far, is holding.'};}},
 {id:'bankloan',cost:1,cat:'lifestyle',avail:s=>s.age>=18&&!s.liabilities.some(l=>l.id==='bankloan'),
   note:()=>{const t=LIABILITY_TYPES.bankloan; return `+${money(t.principal)} now · ${money(liabilityPayment(t))}/yr for ${t.years}y`;},
   apply:()=>{const t=LIABILITY_TYPES.bankloan; S.liabilities.push({id:t.id,name:t.name,icon:t.icon,yearsLeft:t.years,annualPayment:liabilityPayment(t)});
     return{fx:{assets:t.principal},text:'Subject took out a bank loan — a formal thing, four signatures and a schedule taped to the icebox.'};}},
 {id:'storecredit',cost:1,cat:'lifestyle',avail:s=>!s.liabilities.some(l=>l.id==='storecredit'),
   note:()=>{const t=LIABILITY_TYPES.storecredit; return `+${money(t.principal)} of goods now · ${money(liabilityPayment(t))}/yr for ${t.years}y`;},
   apply:()=>{const t=LIABILITY_TYPES.storecredit; S.liabilities.push({id:t.id,name:t.name,icon:t.icon,yearsLeft:t.years,annualPayment:liabilityPayment(t)});
     return{fx:{assets:t.principal,happiness:2},text:'Subject bought what was needed on store credit. The installment book went on the shelf by the door.'};}},
 {id:'payoffdebt',cost:1,cat:'lifestyle',avail:s=>s.liabilities.length>0&&s.assets>=s.liabilities[0].annualPayment*2,note:()=>'clear the oldest debt in one lump sum',
   apply:()=>{if(!S.liabilities.length) return{fx:{},text:'Subject meant to pay off a debt, but the last of it had already cleared on its own this year.'};
     const l=S.liabilities[0]; const remaining=l.annualPayment*l.yearsLeft; S.liabilities.shift();
     return{fx:{assets:-remaining,happiness:3},text:'Subject paid off the '+l.name.toLowerCase()+' in one sitting, in cash, and watched the clerk stamp it “SETTLED.”'};}},
];

/* ================= HOTSPOT SHORTCUTS (dossier field → Plan the Year actions) ================= */
const FIELD_ACTIONS={
 job:['lookwork','gig','presspromo','overtime','nightshift','quitjob','earlyret','leaveschool'],
 vice:['bottle','track','backroom2','crime','gamblelic'],
 skills:['practice','study','learntrade'],
 partner:['court','propose','tendspouse','breakup','divorce'],
 npc:['tendcontact','flirt','flirtsecret','cutcontact','covertracks','endaffair'],
 children:['family','trychild'],
 mother:['writemother','estrangemother'],
 father:['writefather','estrangefather'],
 relations:['meetsomeone','tendspouse','family','favor','recruit'],
 health:['doctor','walk','rest','bottle','overtime','nightshift','backroom2'],
 happiness:['meetsomeone','walk','rest','bottle','track','backroom2','leave','relocate'],
 smarts:['study','practice','learntrade'],
 looks:[],
 assets:['lookwork','gig','overtime','favor','loan','bankloan','storecredit','payoffdebt','gamblelic','track','crime'],
 outlay:['lookwork','gig','overtime','favor','loan','gamblelic','crime'],
};

/* ================= PETITIONS ================= */
const PETITIONS=[
 {id:'reserve',avail:s=>s.sex==='M'&&s.age>=20&&s.age<=45&&s.jailUntil<=s.age,
   body:()=>'The Bureau recalls the subject to the reserves for six months of drill and bad coffee.',
   yes:{fx:{happiness:-4,health:-3,assets:200,relations:2},t:()=>'Subject served the recall. The uniform still fit wrong. The coffee was, as promised, bad.'},
   no:{fx:{happiness:2},t:s=>chance(.4)?(s.vice=Math.min(10,s.vice+1),s.record=true,'Subject evaded the recall. The Bureau noted the absence in a red pen that does not fade.'):'Subject evaded the recall and got away with it, this time, which is its own kind of sentence.'}},
 {id:'loyalty',once:1,avail:s=>s.age>=18,
   body:()=>'The Bureau requires the subject sign a paper affirming they have never, even privately, held a wrong opinion.',
   yes:{fx:{happiness:-2},t:()=>'Subject signed. The compromise was small and sat in the chest like a pebble that would not dissolve.'},
   no:{fx:{happiness:2,relations:-2},t:s=>chance(.25)?(s.record=true,'Subject refused to sign. The Bureau, impressed and annoyed, opened a thicker file.'):'Subject refused to sign. The Bureau filed the refusal and, for now, nothing more. The subject slept well.'}},
 {id:'medal',avail:s=>!s.record&&s.vice<=2&&s.age>=16,
   body:()=>'The Bureau considers the subject for a civic medal, pending a full and intrusive review of an otherwise clean file.',
   yes:{fx:{happiness:4,relations:3,assets:100},t:s=>(s.vice>0&&chance(.15))?(s.vice=Math.min(10,s.vice+1),'The review found the one notation the subject thought buried. The medal was rescinded. The shame was not.'):(s.bureauFavor=Math.min(3,(s.bureauFavor||0)+1),'The review found nothing. The medal was pinned on, along with one Bureau Favor for later use.')},
   no:{fx:{happiness:1},t:()=>'Subject declined the scrutiny out of modesty, or suspicion. The Bureau respected it, which was suspicious in itself.'}},
 {id:'posting',avail:s=>s.jobTier>0,
   body:()=>'The Bureau offers a transfer to a greyer town: more pay, fewer souls, a window onto a wall.',
   yes:{fx:{assets:500,happiness:-4,relations:-3},t:()=>'Subject took the posting. The pay was better. The wall was, indeed, the view.'},
   no:{fx:{happiness:1},t:()=>'Subject stayed, near the people and the noise and the leaky roof. The Bureau shrugged and offered it to someone greyer.'}},
 {id:'eviction',avail:s=>s.assets<300&&s.age>=16,
   body:()=>'The subject’s landlord petitions the Bureau to evict. The pen, for once, is in your hand.',
   yes:{fx:{assets:-150,happiness:-5,health:-2},t:()=>'You signed the eviction. The subject’s things went onto the cart. The file does not record the look on the subject’s face, mercifully.'},
   no:{fx:{relations:2,happiness:-1},t:()=>'You sided with the subject and denied it. The landlord made trouble afterward, small and persistent, the way landlords do.'}},
 {id:'inspection',avail:s=>s.age>=16&&s.scrutiny>=35,
   body:()=>'A Bureau inspector requests a full accounting of the subject’s work, movements, and acquaintances. The request is marked routine in red ink.',
   yes:{fx:{happiness:-3},t:s=>{s.scrutiny=Math.max(0,s.scrutiny-18); return 'Subject opened the ledgers and answered every question. The inspector left with fewer questions and more paper.';}},
   no:{fx:{happiness:2},t:s=>{s.scrutiny=clamp(s.scrutiny+15,0,100); if(chance(.3)) s.record=true; return 'Subject declined the inspection. The inspector left alone. The file did not.';}}},
 {id:'bureaudemand',avail:s=>s.holdMember&&Hold.heat>=20,
   body:()=>'The Bureau requests a list of known associates, “for the record.” Compliance is voluntary. Everything is voluntary.',
   yes:{fx:{happiness:-4,relations:-3},t:()=>{Hold.heat=clamp(Hold.heat-15,0,100); return 'Subject supplied a list — thin, mostly names already known. The Bureau seemed satisfied, or bored.';}},
   no:{fx:{happiness:1},t:()=>{Hold.heat=clamp(Hold.heat+10,0,100); return 'Subject supplied nothing. The Bureau made a note of the silence, in the file that grows regardless.';}}},
 {id:'informant',once:1,avail:s=>s.holdMember&&livingHoldMembers().length>=2&&Hold.heat>=15,
   body:()=>'A stranger offers, for a price, to name the informant already inside the fold. Whether one exists is not stated.',
   yes:{fx:{assets:-200},t:()=>{Hold.heat=clamp(Hold.heat-10,0,100); return 'Subject paid. A name was given. Whether it was the right one, the file does not say — but the leak, real or imagined, stopped.';}},
   no:{fx:{happiness:1},t:()=>'Subject declined to pay a stranger for a rumor. The rumor, unpaid, kept circulating.'}},
];

/* ---- short, bold titles shown atop each slip window — what's actually happening, at a glance ---- */
const PETITION_TITLES={
 reserve:'Called Back To The Reserves',
 loyalty:'A Loyalty Oath Required',
 medal:'Considered For A Civic Medal',
 posting:'Offered A Transfer',
  eviction:'A Landlord Seeks Eviction',
  inspection:'A Routine Inspection',
 bureaudemand:'The Bureau Wants Names',
 informant:'Name The Informant?',
};
const CRISIS_TITLES={
 bankruptcy:'Debts Have Come Due',
 childsick:'Your Child Is Ill',
 moneycrunch:'The Money Has Run Out',
 marriagetrouble:'The Marriage Has Gone Quiet',
 friendfading:'A Friendship Is Fading',
 familydrift:'The Family Has Drifted Apart',
 motherdrift:'Mother Has Gone Quiet',
 fatherdrift:'Father Has Gone Quiet',
 homeChores:'Patience Is Wearing Thin',
 homeEmbarrass:'An Old Embarrassment Lingers',
 homeAsk:'Asking For More Freedom',
 homeDinner:'Dinner Has Gone Quiet',
 breakingPoint:'A Breaking Point At Home',
 healthscare:'A Health Scare',
 friendneed:'A Friend Needs Help',
 isolation:'Drifting Into Isolation',
 fundsseized:'The Hold’s Funds Seized',
 memberarrested:'One Of The Fold Arrested',
 regimeraid:'The Bureau Raids The Hold',
 holdgrumbling:'The Fold Is Grumbling',
 holdcoup:'A Coup Within The Hold',
 holdRecruitYou:'A Quiet Recruitment Offer',
 holdInviteFamily:'Bring Your Child Into The Hold?',
 contactMakesAMove:'{other} Makes A Move',
 partnersuspicion:'Something Feels Off',
};
/* ================= CRISES ================= */
const CRISES=[
 {id:'bankruptcy',avail:s=>s.assets<=-3000&&s.age>=16&&!s.bankrupt,
   body:()=>'The subject’s debts have grown past any reasonable hope of repayment. The Bureau convenes an emergency hearing. This will not be optional.',
   opts:s=>{
     const list=[
       {label:'Declare bankruptcy',cls:'ok',sub:'debts wiped · a permanent mark on the record',fx:{happiness:-6,relations:-8},side:s2=>{s2.assets=-200;s2.record=true;s2.bankrupt=true;},t:'Subject declared bankruptcy. The debts vanished on paper. The file remembers what the paper forgets.'},
       {label:'Garnished wages',cls:'maybe',sub:'debts wiped slowly · income cut for 5 years',fx:{happiness:-4},side:s2=>{s2.assets=Math.max(s2.assets,-500);s2.garnishUntil=s2.age+5;s2.bankrupt=true;},t:'Subject agreed to the garnishment. A slice of every wage, for years, would go to the hole already dug.'},
       {label:'Sell everything of value',cls:'no',sub:'debts cleared now · looks & happiness take the hit',fx:{happiness:-8,looks:-3},side:s2=>{s2.assets=0;s2.bankrupt=true;},t:'Subject sold what could be sold and some of what shouldn’t have been. The rooms echoed differently after.'},
     ];
     if(canAskParentForMoney()) list.push(askParentDebtOption(1));
     return list;
   }},
 {id:'childsick',avail:s=>s.kids>0,
   body:()=>'The subject’s child is ill. The doctor wants a fee the subject does not comfortably have.',
   opts:[
     {label:'Pay the doctor',cls:'ok',sub:'−$ · child recovers · +family',fx:{assets:-200,happiness:1},side:s=>{s.familyMood=clamp(s.familyMood+12,0,100);},t:'Subject paid the doctor without blinking. The child recovered. The coin, the subject decided, was the easy part.'},
     {label:'Stay home, tend them',cls:'maybe',sub:'no pay · +family · a risk',fx:{happiness:1,health:-1},side:s=>{s.familyMood=clamp(s.familyMood+10,0,100);if(chance(.3))s.health=clamp(s.health-2,0,100);},t:'Subject stayed home and nursed the child through the night. The fever broke by morning. So did the subject, a little.'},
     {label:'Borrow from the shark',cls:'no',sub:'+$ now · +VICE · he collects later',fx:{assets:200},side:s=>{s.vice=Math.min(10,s.vice+1);pushFollow({at:s.age+2,t:'The man came to collect on the child’s illness. He brought the abacus.',fx:{assets:-350,happiness:-4}});},t:'Subject borrowed from the man with the abacus. The child got the doctor. The debt got the subject.'}]},
 {id:'moneycrunch',avail:s=>s.assets<0&&s.assets>-3000&&s.age>=16,
   body:()=>'The debts have outrun the subject. Something has to give, this year.',
   opts:s=>{
     const list=[];
     if(s.jobTier===0&&!s.eduStage) list.push({label:'Take any work',cls:'ok',sub:'a job, any job · −HAPPINESS',fx:{happiness:-3},side:s2=>{const job=bestJobForTier(1); if(job){s2.jobTier=1;s2.jobName=job.name;}},t:'Subject took whatever work was going. The work was not proud. The subject, that month, neither.'});
     else if(s.jobTier>0) list.push({label:'Work extra hours',cls:'ok',sub:'+$ · −HEALTH/HAPPINESS',fx:{assets:250,happiness:-4,health:-2},t:'Subject picked up every extra shift the job would allow. It helped the number in the ledger. It cost something else.'});
     list.push({label:'Sell something dear',cls:'maybe',sub:'+$ · −HAPPINESS',fx:{assets:300,happiness:-3},t:'Subject sold the thing they had been keeping. The money solved the month. The gap on the shelf solved nothing.'});
     if(canAskParentForMoney()) list.push(askParentDebtOption(0.4));
     list.push({label:'Ask the shark',cls:'no',sub:'+$ · +VICE · he collects later',fx:{assets:350},side:s2=>{s2.vice=Math.min(10,s2.vice+1);pushFollow({at:s2.age+2,t:'The man collected, with a friend and an abacus and no patience.',fx:{assets:-500,happiness:-4}});},t:'Subject asked the man with the abacus. The relief was instant. The terms were not.'});
     return list;
   }},
 {id:'marriagetrouble',avail:s=>s.married&&s.partnerMood<25,
   body:()=>'The marriage has gone quiet in the bad way. {partner} is barely in the same room.',
   opts:[
     {label:'Sit down and talk',cls:'ok',sub:'+marriage · −HAPPINESS (hard)',fx:{happiness:-2},side:s=>{const p=activePartnerContact();if(p){p.mood=clamp(p.mood+22,0,100);syncPartnerMirror();}},t:'Subject sat {partner} down and said the true thing, all of it. It was awful. It was also, the file notes, the first honest sentence in a year.'},
     {label:'A night out, flowers',cls:'maybe',sub:'−$ · +marriage',fx:{assets:-120},side:s=>{const p=activePartnerContact();if(p){p.mood=clamp(p.mood+16,0,100);syncPartnerMirror();}},t:'Subject bought flowers and a table by the window. {partner} accepted both. The thaw was small, but a thaw.'},
     {label:'Let it rot',cls:'no',sub:'marriage sours further',fx:{happiness:-3},side:s=>{const p=activePartnerContact();if(p){p.mood=clamp(p.mood-15,0,100);syncPartnerMirror();if(p.mood<12){endMarriageSide(s,'Separated');}}},t:'Subject let it rot. The silence grew teeth. The file begins, quietly, to use the word “separation.”'}]},
 {id:'friendfading',avail:s=>{const c=worstFadingFriend();return !!c&&c.mood<25;},
   body:()=>{const c=worstFadingFriend(); S.__affairName=c?c.name:'—'; return 'The friendship with {other} has gone quiet. Calls go unanswered; the excuses are wearing thin on both sides.';},
   opts:[
     {label:'Show up in person',cls:'ok',sub:'+friendship · −HAPPINESS (effort)',fx:{happiness:-1},side:s=>{const c=worstFadingFriend();if(c)c.mood=clamp(c.mood+22,0,100);},t:'Subject showed up unannounced, which was either exactly right or exactly wrong. {other} let them in.'},
     {label:'Send word, keep distance',cls:'maybe',sub:'−$ · +friendship (modest)',fx:{assets:-60},side:s=>{const c=worstFadingFriend();if(c)c.mood=clamp(c.mood+13,0,100);},t:'Subject sent a small gift and a shorter note. {other} wrote back, eventually, which was something.'},
     {label:'Let it fade',cls:'no',sub:'the friendship keeps cooling',fx:{happiness:-2},side:s=>{const c=worstFadingFriend();if(c){c.mood=clamp(c.mood-15,0,100);if(c.mood<12)s.contacts=s.contacts.filter(x=>x.cid!==c.cid);}},t:'Subject let it fade, the way these things fade — not with an argument, just with fewer and fewer reasons to call.'}]},
 {id:'familydrift',avail:s=>s.kids>0&&s.familyMood<25,
   body:()=>'The house has gone distant. The children answer in single words, if they answer at all.',
   opts:[
     {label:'Make the time',cls:'ok',sub:'+family · −HAPPINESS (effort)',fx:{happiness:-2},side:s=>{s.familyMood=clamp(s.familyMood+22,0,100);},t:'Subject cleared an entire Sunday and did not once check the clock. It was noticed, and not forgotten.'},
     {label:'A trip, a treat',cls:'maybe',sub:'−$ · +family',fx:{assets:-150},side:s=>{s.familyMood=clamp(s.familyMood+15,0,100);},t:'Subject spent more than planned on a day out. The complaints stopped for exactly that long, and started again after, more quietly.'},
     {label:'Let it be',cls:'no',sub:'the distance grows',fx:{relations:-3},side:s=>{s.familyMood=clamp(s.familyMood-15,0,100);},t:'Subject let it be, telling themselves there would be time later. The children grew up on that promise, mostly.'}]},
 {id:'motherdrift',avail:s=>s.mother&&s.mother.alive&&!s.mother.estranged&&s.mother.mood<25&&s.age>=14&&s.age<50&&!s.livingAtHome,
   body:()=>'The letters to {mother} have gone unanswered long enough that even the subject has noticed the silence.',
   opts:[
     {label:'Write, properly',cls:'ok',sub:'+family · −HAPPINESS (hard)',fx:{happiness:-1},side:s=>{s.mother.mood=clamp(s.mother.mood+22,0,100);},t:'Subject wrote the letter that had been owed for months — the honest kind, not the easy kind. It was answered by return post.'},
     {label:'Send money instead',cls:'maybe',sub:'−$ · +family (modest)',fx:{assets:-100},side:s=>{s.mother.mood=clamp(s.mother.mood+13,0,100);},t:'Subject sent money instead of words. It was accepted, and the silence continued underneath it, a little quieter.'},
     {label:'Let the silence hold',cls:'no',sub:'the distance becomes permanent',fx:{relations:-4},side:s=>{s.mother.mood=clamp(s.mother.mood-15,0,100);if(s.mother.mood<12){s.mother.estranged=true;}},t:'Subject let the silence hold, and it hardened into something that no longer felt temporary.'}]},
 {id:'fatherdrift',avail:s=>s.father&&s.father.alive&&!s.father.estranged&&s.father.mood<25&&s.age>=14&&s.age<50&&!s.livingAtHome,
   body:()=>'The calls to {father} have gone unreturned long enough that even the subject has noticed the silence.',
   opts:[
     {label:'Call, properly',cls:'ok',sub:'+family · −HAPPINESS (hard)',fx:{happiness:-1},side:s=>{s.father.mood=clamp(s.father.mood+22,0,100);},t:'Subject called and said the thing that had been owed for months. It landed better than expected.'},
     {label:'Send money instead',cls:'maybe',sub:'−$ · +family (modest)',fx:{assets:-100},side:s=>{s.father.mood=clamp(s.father.mood+13,0,100);},t:'Subject sent money instead of words. It was accepted without comment, which was, itself, a kind of comment.'},
     {label:'Let the silence hold',cls:'no',sub:'the distance becomes permanent',fx:{relations:-4},side:s=>{s.father.mood=clamp(s.father.mood-15,0,100);if(s.father.mood<12){s.father.estranged=true;}},t:'Subject let the silence hold, and it hardened into something that no longer felt temporary.'}]},
 {id:'homeChores',avail:s=>(s.age<16||s.livingAtHome)&&s.age>=8&&!!lowestMoodGuardian()&&lowestMoodGuardian().mood<32,
   body:()=>{const p=lowestMoodGuardian(); return p.name+'’s patience has worn thin under this roof — the mess, the unfinished chores, the general disorder of a life still being learned.';},
   opts:s=>{
     const p=lowestMoodGuardian(), tier=guardTier();
     return [
       {label:'Do it properly, no complaints',cls:'ok',sub:'+relationship · a little dull',fx:{happiness:-1},side:s2=>{p.mood=clamp(p.mood+16,0,100);},t:'Subject did the chores properly, without being asked twice. It was noticed, in the quiet way these things are noticed.'},
       {label:'Promise to do better',cls:'maybe',sub:'cheap, and it shows',fx:{},side:s2=>{p.mood=clamp(p.mood+6,0,100);},t:'Subject promised to do better. The promise was, technically, kept — for about a week.'},
       {label:'Roll your eyes and walk off',cls:'no',sub:'the tension holds',fx:{},side:s2=>{ p.mood=clamp(p.mood-12,0,100);
           if(tier==='toxic'&&chance(.4)){ S.__oppText=p.name+' did not let the eye-roll go. What followed was loud, and left more than a mood behind.'; S.__oppFx={happiness:-8,health:-3,relations:-3}; }
           else { S.__oppText='Subject rolled their eyes and walked off. The mess stayed. So did the mood.'; S.__oppFx={relations:-2}; } },
         t:'',fx:{}},
     ];
   }},
 {id:'homeEmbarrass',avail:s=>(s.age<16||s.livingAtHome)&&s.age>=8&&!!lowestMoodGuardian()&&lowestMoodGuardian().mood<30,
   body:()=>{const p=lowestMoodGuardian(); return p.name+' has not let go of something the subject did in front of others — small, at the time, and apparently not.';},
   opts:s=>{
     const p=lowestMoodGuardian(), tier=guardTier();
     return [
       {label:'Apologize, and mean it',cls:'ok',sub:'+relationship · −HAPPINESS',fx:{happiness:-2},side:s2=>{p.mood=clamp(p.mood+18,0,100);},t:'Subject apologized properly, without the usual dodge built into apologies. It landed.'},
       {label:'Laugh it off',cls:'maybe',sub:'might land, might not',side:s2=>{
           if(chance(.5)){ p.mood=clamp(p.mood+8,0,100); S.__oppText='Subject laughed it off, and — for once — it worked. '+p.name+' let it go.'; S.__oppFx={happiness:1}; }
           else { p.mood=clamp(p.mood-8,0,100); S.__oppText='Subject laughed it off. '+p.name+' did not find it funny, not even a little.'; S.__oppFx={happiness:-2}; } },
         t:'',fx:{}},
       {label:'Dig in, refuse to apologize',cls:'no',sub:'the tension holds, maybe worse',side:s2=>{ p.mood=clamp(p.mood-14,0,100);
           if(tier==='toxic'&&chance(.4)){ S.__oppText=p.name+' would not let it drop, and made sure the subject felt every bit of it.'; S.__oppFx={happiness:-9,health:-3,relations:-4}; }
           else { S.__oppText='Subject refused to apologize. The tension sat in the house like a smell that would not air out.'; S.__oppFx={relations:-3}; } },
         t:'',fx:{}},
     ];
   }},
 {id:'homeAsk',avail:s=>(s.age<16||s.livingAtHome)&&s.age>=10&&s.age<=25&&!!lowestMoodGuardian()&&lowestMoodGuardian().mood<45,
   body:()=>{const p=lowestMoodGuardian(); return 'The subject asked '+p.name+' for a little more freedom — a later curfew, a night out, something small that felt enormous.';},
   opts:s=>{
     const p=lowestMoodGuardian(), tier=guardTier();
     const okChance=clamp(0.3+(s.relations-50)/200+(p.mood-40)/200,0.05,0.85);
     return [
       {label:'Push for it, respectfully',cls:'ok',sub:P(okChance)+' chance they say yes',side:s2=>{
           if(chance(okChance)){ p.mood=clamp(p.mood+10,0,100); S.__oppText=p.name+' thought about it, and actually said yes. It felt like a small door opening.'; S.__oppFx={happiness:5,relations:2}; }
           else { p.mood=clamp(p.mood-8,0,100); S.__oppText=p.name+' said no, flatly, and the asking made it worse somehow.'; S.__oppFx={happiness:-4}; } },
         t:'',fx:{}},
       {label:'Let it go for now',cls:'maybe',sub:'no risk · nothing changes',fx:{happiness:-1},t:'Subject let it go, for now, and told themselves “for now” like it meant something.'},
       {label:'Sneak out anyway',cls:'no',sub:'risky · worse if caught',side:s2=>{
           const caught=chance(.45);
           if(!caught){ S.__oppText='Subject slipped out unnoticed, and back in the same way. Just this once, it worked.'; S.__oppFx={happiness:4}; }
           else if(tier==='toxic'){ p.mood=clamp(p.mood-20,0,100);
             if(chance(.3)){ s2.livingAtHome=false; s2.lifestyle.housing='none'; s2.lifestyle.food='meager';
               S.__oppText=p.name+' caught the subject sneaking back in, and it ended with the door shown, for good.'; S.__oppFx={happiness:-12,health:-6,relations:-6}; }
             else { S.__oppText=p.name+' caught the subject sneaking back in. What followed was ugly, and left a mark.'; S.__oppFx={happiness:-8,health:-4,relations:-4}; } }
           else { p.mood=clamp(p.mood-15,0,100); S.__oppText=p.name+' caught the subject sneaking back in. The lecture lasted longer than the night out did.'; S.__oppFx={happiness:-5,relations:-2}; } },
         t:'',fx:{}},
     ];
   }},
 {id:'homeDinner',avail:s=>(s.age<16||s.livingAtHome)&&s.age>=8&&!!lowestMoodGuardian()&&lowestMoodGuardian().mood<27,
   body:()=>{const p=lowestMoodGuardian(); return 'Dinner with '+p.name+' has gone quiet in the bad way — plates cleared, nothing said.';},
   opts:s=>{
     const p=lowestMoodGuardian(), tier=guardTier();
     return [
       {label:'Break the silence first',cls:'ok',sub:'+relationship · −HAPPINESS (hard)',fx:{happiness:-1},side:s2=>{p.mood=clamp(p.mood+20,0,100);},t:'Subject said something first, however small, and the table loosened by a degree.'},
       {label:'Help clear up without being asked',cls:'maybe',sub:'+relationship (modest)',fx:{},side:s2=>{p.mood=clamp(p.mood+10,0,100);},t:'Subject cleared the plates without a word about it. Nobody said thank you. Somebody noticed anyway.'},
       {label:'Let the silence hold',cls:'no',sub:'the distance grows',fx:{},side:s2=>{ p.mood=clamp(p.mood-12,0,100);
           if(tier==='toxic'&&chance(.35)){ S.__oppText='The silence finally broke, badly, and not in the subject’s favor.'; S.__oppFx={happiness:-8,health:-3,relations:-3}; }
           else { S.__oppText='Subject let the silence hold. It filled the room like weather.'; S.__oppFx={relations:-3}; } },
         t:'',fx:{}},
     ];
   }},
 {id:'breakingPoint',avail:s=>!s.breakingPointDone&&(s.toxicIncidentCount||0)>=4&&(s.age<16||s.livingAtHome)&&guardiansOf().length>0,
   body:()=>{const p=guardiansOf().slice().sort((a,b)=>b.grip-a.grip)[0];
     return 'It has happened enough times now that the subject can no longer call it an isolated thing. Something has to give — '+p.name+', the house, or the subject.';},
   opts:s=>{
     const p=guardiansOf().slice().sort((a,b)=>b.grip-a.grip)[0];
     const reportChance=clamp(0.35+(s.relations-50)/200,0.1,0.75);
     return [
       {label:'Report it, formally',cls:'ok',sub:P(reportChance)+' chance the Bureau actually acts',side:s2=>{
           s2.breakingPointDone=true;
           if(chance(reportChance)){ moveOutNow(true);
             S.__oppText='The Bureau, for once, moved fast. The subject was placed elsewhere within the week, and '+p.name+' was left to explain the file to someone else.'; S.__oppFx={happiness:6,health:4,relations:3}; }
           else { p.grip=clamp(p.grip+15,0,100);
             S.__oppText='The report went in and, as far as the subject could tell, nowhere after that. '+p.name+' found out. It was worse, after.'; S.__oppFx={happiness:-10,health:-5,relations:-4}; }
         },t:'',fx:{}},
       {label:'Run',cls:'maybe',sub:'guaranteed — but you leave with nothing settled',side:s2=>{
           s2.breakingPointDone=true; moveOutNow(false);
           S.__oppText='The subject left in the night, with what would fit in one bag, and did not look back to check if anyone had noticed yet.'; S.__oppFx={happiness:2,health:-3};
         },t:'',fx:{}},
       {label:'Endure it, for now',cls:'no',sub:'nothing changes — and it keeps happening',side:s2=>{
           s2.breakingPointDone=true; p.grip=clamp(p.grip+8,0,100);
           S.__oppText='Subject decided, again, that now was not the time. '+p.name+' took the decision as a kind of victory.'; S.__oppFx={happiness:-6,relations:-2};
         },t:'',fx:{}},
     ];
   }},
 {id:'healthscare',avail:s=>s.health<30&&s.age>40,
   body:()=>'The subject’s body has issued a formal complaint. The doctor is not optimistic in his phrasing.',
   opts:[
     {label:'Rest a full year',cls:'ok',sub:'+HEALTH · −$ · no work',fx:{health:14,assets:-300},t:'Subject rested, properly, for a year. The body, surprised to be listened to, repaid some of the debt.'},
     {label:'Push through it',cls:'maybe',sub:'+work · −HEALTH',fx:{assets:300,health:-6},t:'Subject pushed through. The work got done. The body added a clause to its complaint.'},
     {label:'The specialist',cls:'no',sub:'−$ · +HEALTH',fx:{assets:-250,health:10},t:'Subject paid for the specialist nobody could afford to skip. The specialist found the thing early, which is the only win there is.'}]},
 {id:'friendneed',avail:s=>{const cands=s.contacts.filter(c=>c.role==='friend'&&c.mood>30);return cands.length>0&&s.age>=14;},
   body:()=>{const cands=S.contacts.filter(c=>c.role==='friend'&&c.mood>30); const c=pick(cands); S.__affairName=c?c.name:'—'; S.__friendNeedCid=c?c.cid:null; return 'The old friend {other} is in trouble and has, for the first time, asked.';},
   opts:[
     {label:'Lend the money',cls:'ok',sub:'−$ · +friendship',fx:{assets:-200},side:s=>{const c=s.contacts.find(x=>x.cid===s.__friendNeedCid);if(c)c.mood=clamp(c.mood+20,0,100);},t:'Subject lent {other} the money and did not mention it again. {other} mentioned it forever, which was the point.'},
     {label:'Lend the time',cls:'maybe',sub:'+friendship · −HAPPINESS',fx:{happiness:-1},side:s=>{const c=s.contacts.find(x=>x.cid===s.__friendNeedCid);if(c)c.mood=clamp(c.mood+16,0,100);},t:'Subject had no money, so gave {other} the next three Sundays instead. It turned out to be the currency that mattered.'},
     {label:'Turn away',cls:'no',sub:'friendship cools',fx:{relations:-3},side:s=>{const c=s.contacts.find(x=>x.cid===s.__friendNeedCid);if(c){c.mood=clamp(c.mood-30,0,100);if(c.mood<15)s.contacts=s.contacts.filter(x=>x.cid!==c.cid);}},t:'Subject turned away, with reasons that sounded like reasons. {other} stopped calling. The reasons stopped sounding like reasons.'}]},
 {id:'isolation',avail:s=>s.relations<25&&s.age>=14,
   body:()=>'The subject has drifted out of every circle worth naming. The Bureau notes the silence is becoming a habit.',
   opts:[
     {label:'Reach out, awkwardly',cls:'ok',sub:'−HAPPINESS now · +STANDING',fx:{happiness:-3,relations:8},t:'Subject made the first move, badly, and made it anyway. It did not fix everything. It fixed the first thing.'},
     {label:'Join something — a hall, a union, a choir',cls:'maybe',sub:'−$ · +STANDING',fx:{assets:-100,relations:6},t:'Subject showed up somewhere with other people in it, on purpose, more than once. Slowly, it stopped feeling like an experiment.'},
     {label:'Let the silence hold',cls:'no',sub:'numb relief · STANDING falls further',fx:{happiness:2,relations:-6},side:s=>{s.vice=Math.min(10,s.vice+1);},t:'Subject let the silence hold. It was, for a while, easier than the alternative. The while got longer.'}]},
 {id:'fundsseized',avail:s=>s.holdMember&&Hold.heat>=25&&Hold.resources.funds>50,
   body:()=>'A “routine inspection” empties a strongbox the Bureau was not supposed to know about.',
   opts:[
     {label:'Let it go',cls:'ok',sub:'funds seized · heat drops',fx:{happiness:-3},side:s=>{Hold.resources.funds=Math.floor(Hold.resources.funds*0.4);Hold.heat=clamp(Hold.heat-18,0,100);},t:'Subject let it go, all of it, without a word. The inspectors left satisfied. The strongbox did not.'},
     {label:'Hide what you can',cls:'maybe',sub:'save some funds · heat stays high',fx:{happiness:-1},side:s=>{Hold.resources.funds=Math.floor(Hold.resources.funds*0.7);},t:'Subject moved what could be moved, fast and quiet. Most of it got out. The inspectors noticed the gaps.'},
     {label:'Argue the paperwork',cls:'no',sub:'a risk · could go either way',fx:{},side:s=>{if(chance(.4)){Hold.heat=clamp(Hold.heat-10,0,100);}else{Hold.resources.funds=Math.floor(Hold.resources.funds*0.2);Hold.heat=clamp(Hold.heat+10,0,100);s.happiness=clamp(s.happiness-5,0,100);}},t:'Subject argued the paperwork, form by form, clause by clause. It was either a masterstroke or a mistake. The file does not yet say which.'}]},
 {id:'memberarrested',avail:s=>s.holdMember&&livingHoldMembers().length>0&&Hold.heat>=35,
   body:()=>'One of the fold was picked up on some pretext. The Bureau is, for now, only asking questions.',
   opts:[
     {label:'Say nothing, wait',cls:'ok',sub:'a tense wait · usually fine',fx:{happiness:-4},side:s=>{if(chance(.75)){Hold.heat=clamp(Hold.heat-8,0,100);}else{const alive=livingHoldMembers(); if(alive.length){killHoldMember(pick(alive));} Hold.heat=clamp(Hold.heat+10,0,100);}},t:'Subject said nothing and waited, which is its own kind of courage. Mostly, it held.'},
     {label:'Pay for their release',cls:'maybe',sub:'−funds · they come home',fx:{},side:s=>{Hold.resources.funds=Math.max(0,Hold.resources.funds-200);},t:'Subject paid what was asked, to whoever was asking. They came home. The math, this time, worked.'},
     {label:'Cut them loose',cls:'no',sub:'heat drops hard · trust does not',fx:{relations:-6,happiness:-5},side:s=>{const alive=livingHoldMembers(); if(alive.length) changeHoldLoyalty(pick(alive),-40); Hold.heat=clamp(Hold.heat-25,0,100);},t:'Subject let it be known: no ties, no claim. The Bureau lost interest. So, a little, did everyone left in the fold.'}]},
 {id:'regimeraid',avail:s=>s.holdMember&&Hold.heat>=55,
   body:()=>'Boots on the stairs before dawn. The Bureau has come for the Hold itself, not just a name in a file.',
   opts:[
     {label:'Scatter and hide',cls:'ok',sub:'lose funds/supplies · Hold survives, heat drops hard',fx:{happiness:-6,health:-3},
       side:s=>{Hold.resources.funds=Math.floor(Hold.resources.funds*0.3);Hold.resources.supplies=Math.floor(Hold.resources.supplies*0.3);Hold.heat=clamp(Hold.heat-40,0,100);
         const alive=livingHoldMembers(); if(alive.length&&chance(.35)){killHoldMember(pick(alive));}},
       t:'The Hold scattered into the alleys and the dark. Most made it. Not all. What was left behind, the Bureau kept.'},
     {label:'Stand and resist',cls:'maybe',sub:'a fight · casualties either way',fx:{happiness:-8,health:-10},
       side:s=>{const alive=livingHoldMembers();
         if(chance(.5)){ Hold.heat=clamp(Hold.heat-20,0,100); if(alive.length&&chance(.4)){killHoldMember(pick(alive));} }
         else { Hold.heat=clamp(Hold.heat-10,0,100); alive.forEach(m=>{ if(chance(.3)) killHoldMember(m); }); s.health=clamp(s.health-15,0,100); }},
       t:'The Hold fought at the door. Some of them are not filing anything, ever again. The rest are, for now, still standing.'},
     {label:'Surrender the leader',cls:'no',sub:'the leader is taken · the Hold, mostly, survives',fx:{happiness:-20},
       side:s=>{Hold.heat=clamp(Hold.heat-45,0,100); s.jailUntil=s.age+RI(8,20); s.jobTier=0; s.jobName='Unemployed'; s.career=null;},
       t:'Subject stepped forward and let the door close behind them. The others went quiet, and stayed that way. Whether the file reopens is up to the years that are left.'}]},
 {id:'holdgrumbling',avail:s=>s.holdMember&&Hold.trust<40&&Hold.trust>=20&&livingHoldMembers().length>0,
   body:()=>'Word reaches you sideways: the fold is talking, and not kindly. Someone thinks you’ve been taking more than your share.',
   opts:[
     {label:'Address it openly',cls:'ok',sub:'+trust · a hard conversation',fx:{happiness:-3},side:s=>{Hold.trust=clamp(Hold.trust+15,0,100);},t:'Subject called the fold together and said the true thing. It did not fix everything. It bought time.'},
     {label:'Buy their silence',cls:'maybe',sub:'−funds · trust steadies, doesn’t grow',fx:{},side:s=>{Hold.resources.funds=Math.max(0,Hold.resources.funds-150);Hold.trust=clamp(Hold.trust+6,0,100);},t:'Subject spread a little money around, generously and pointedly. The talking quieted, for now.'},
     {label:'Ignore it',cls:'no',sub:'trust keeps falling',fx:{},side:s=>{Hold.trust=clamp(Hold.trust-8,0,100);},t:'Subject ignored it. The talking did not stop. It got quieter, which was worse.'}]},
 {id:'holdcoup',avail:s=>s.holdMember&&Hold.trust<20&&livingHoldMembers().length>0,
   body:()=>'It comes to a head. Some of the fold have decided you are the problem, not the Bureau. They are in the room. They are not smiling.',
   opts:[
     {label:'Fight to keep control',cls:'no',sub:'a real risk — could cost everything',fx:{},
       side:s=>{ const alive=livingHoldMembers();
         if(chance(0.35+Hold.trust*0.01)){ Hold.trust=clamp(Hold.trust+30,0,100); if(alive.length){ killHoldMember(pick(alive)); } }
         else { s.alive=false; s.cause='put down by his own fold, in the room where it happened'; } },
       t:'Subject refused to yield the room. It went the way these things go.'},
     {label:'Try to talk them down',cls:'maybe',sub:'a gamble — exile or forgiveness',fx:{},
       side:s=>{ if(chance(0.4+Hold.trust*0.015)){ Hold.trust=clamp(Hold.trust+20,0,100); } else { s.jailUntil=s.age+RI(3,10); s.jobTier=0;s.jobName='Unemployed';s.career=null; Hold.heat=clamp(Hold.heat+20,0,100); } },
       t:'Subject tried to talk the room down. Whether it worked depended on people who had already made up their minds.'},
     {label:'Step down quietly',cls:'ok',sub:'lose the chair · keep your life',fx:{happiness:-15},
       side:s=>{ s.alive=false; s.cause='stepped down and walked away — alive, which is not nothing'; },
       t:'Subject handed over the chair before it could be taken. It was, in its way, the bravest thing they did all file.'}]},
 {id:'holdRecruitYou',avail:s=>!s.holdMember&&s.age>=18&&s.age<=45&&s.jailUntil<=s.age&&s.age>=(s.holdRecruitCooldown||0),
   body:()=>'A quiet approach, in a doorway that shouldn’t have anyone in it: someone believes the subject might be worth trusting with more than small talk. They do not say the word “Hold.” They don’t have to.',
   opts:s=>{
     const riskBonus={grind:.05,gambler:.10,saint:-.08,dreamer:-.03,hustler:.10,stoic:.08,aristo:-.12}[s.disp]||0;
     const p=clamp(0.35+(s.relations-50)/200+riskBonus-(s.record?0.15:0)-(Hold.heat||0)*0.002,0.08,0.85);
     return [
       {label:'Hear them out, and say yes',cls:'ok',sub:P(p)+' chance they actually trust it',side:s2=>{
           if(chance(p)){ s2.holdMember=true; Hold.heat=clamp(Hold.heat+5,0,100);
             S.__oppText='Subject said yes. What followed was quieter than expected — a name, a place, a warning about doors. The Hold has one more, now.'; S.__oppFx={happiness:3,relations:2}; }
           else { s2.holdRecruitCooldown=s2.age+RI(3,6);
             S.__oppText='Subject said yes, and it wasn’t enough. They thanked the subject for their time and left without saying what “later” meant.'; S.__oppFx={happiness:-1}; } },
         t:'',fx:{}},
       {label:'Turn them away',cls:'no',sub:'no risk · they may come back',side:s2=>{ s2.holdRecruitCooldown=s2.age+RI(4,7); },
         t:'Subject turned them away, politely, and watched the doorway stay empty afterward for longer than felt natural.'},
     ];
   }},
 {id:'holdInviteFamily',avail:s=>s.holdMember&&!!(function(){ const g=livingKin().find(m=>m.relation==='child'&&!m.holdMember&&(currentYear()-m.dob)>=16&&currentYear()>=(m.holdInviteCooldown||0)); return g; })(),
   body:()=>{ const c=livingKin().find(m=>m.relation==='child'&&!m.holdMember&&(currentYear()-m.dob)>=16&&currentYear()>=(m.holdInviteCooldown||0));
     return 'The subject has been turning something over: whether '+c.first+' is old enough, and steady enough, to be told what the Hold actually is.'; },
   opts:s=>{
     const c=livingKin().find(m=>m.relation==='child'&&!m.holdMember&&(currentYear()-m.dob)>=16&&currentYear()>=(m.holdInviteCooldown||0));
     const p=clamp(0.3+((c.bond||50)-50)/150+(s.relations-50)/200,0.05,0.85);
     return [
       {label:'Tell '+c.first+' everything, and ask',cls:'ok',sub:P(p)+' chance they say yes',side:s2=>{
           if(chance(p)){ enrollKinInHold(c,clamp(45+(c.bond||50)*0.4,30,90)); Hold.heat=clamp(Hold.heat+3,0,100);
             S.__oppText=c.first+' listened to all of it, asked exactly one hard question, and said yes. The Hold is, now, one generation wider.'; S.__oppFx={happiness:4,relations:3}; }
           else { c.holdInviteCooldown=currentYear()+RI(3,5); c.bond=Math.max(0,(c.bond||50)-6);
             S.__oppText=c.first+' heard all of it and said no — not yet, maybe not ever. Something in the room changed anyway, just from the asking.'; S.__oppFx={happiness:-2}; } },
         t:'',fx:{}},
       {label:'Leave them out of it',cls:'no',sub:'no risk · they stay clear',side:s2=>{ c.holdInviteCooldown=currentYear()+RI(2,4); },
         t:'Subject decided some risks are not theirs to hand down, not yet, and said nothing to '+c.first+' at all.'},
     ];
   }},
 {id:'contactMakesAMove',avail:s=>s.age>=16&&hasPartner(s)&&s.contacts.some(c=>c.role==='friend'&&!(s.activeAffairCids||[]).includes(c.cid)),
   body:()=>{
     const cands=S.contacts.filter(c=>c.role==='friend'&&!(S.activeAffairCids||[]).includes(c.cid));
     const weighted=cands.map(c=>({c,w:Math.max(1,c.charm*(S.partnerMood<50?1.6:1)*(1+(S.looks-50)/250))}));
     const total=weighted.reduce((a,x)=>a+x.w,0); let r=Random.next()*total, chosen=cands[0];
     for(const x of weighted){ r-=x.w; if(r<=0){chosen=x.c;break;} }
     S.__pickContactCid=chosen.cid; S.__affairName=chosen.name;
     const marriedNote=chosen.npcMarried?' {other} is already married, apparently — which hasn’t stopped them.':'';
     return '{other} let something slip that was less than subtle — an offer, more or less, of exactly the kind the subject is not supposed to want.'+marriedNote;
   },
   opts:[
     {label:'Let it happen',cls:'no',sub:'begin something secret with {other}',fx:{happiness:6},
       side:s=>{ const c=s.contacts.find(x=>x.cid===s.__pickContactCid); if(c) startAffairWith(c,8); },
       t:'Subject let it happen. Something began that had no business beginning, and both of them knew it going in.'},
     {label:'Turn them down',cls:'ok',sub:'stay faithful · {other} may take it personally',fx:{happiness:-1},
       side:s=>{ const c=s.contacts.find(x=>x.cid===s.__pickContactCid); if(c) c.mood=clamp(c.mood-10,0,100); },
       t:'Subject turned {other} down, plainly. It was, afterward, a little awkward between them.'}]},
 {id:'partnersuspicion',avail:s=>{const p=activePartnerContact(); return !!(p&&p.reverseAffair&&p.reverseAffair.active&&p.reverseAffair.heat>=28);},
   body:()=>{const p=activePartnerContact(); S.__partnerNameSnapshot=p.name; return 'Something has been off with {partner} lately — distracted, elsewhere, careful in a way that itself seems careful.';},
   opts:s=>{
     const p=activePartnerContact();
     return [
       {label:'Confront them directly',cls:'ok',sub:'force the truth out, one way or another',
         side:s2=>{
           if(chance(0.6)){
             const aff=p.reverseAffair; aff.discovered=true; aff.active=false;
             S.__affairName=aff.rivalName; S.__partnerNameSnapshot=p.name; S.__cascadeDiscovery=false;
             const married=s2.married;
             const happHit=married?-RI(28,42):-RI(14,24), healthHit=married?-RI(8,16):-RI(2,7);
             s2.happiness=clamp(s2.happiness+happHit,0,100); s2.health=clamp(s2.health+healthHit,0,s2.healthCap||100);
             S.__oppText='Subject pressed, and {partner} finally said it, plainly. It was worse to hear than to suspect.';
             S.__oppFx={};
             openCrisis(NPC_CHEAT_CRISES.discovered);
           } else {
             S.__oppText='Subject pressed. {partner} denied it, calmly enough that the subject almost believed it. Almost.';
             S.__oppFx={happiness:-3};
           }
         },t:'',fx:{}},
       {label:'Let it go, for now',cls:'no',sub:'the feeling stays, unresolved',fx:{happiness:-2},
         t:'Subject let it go, for now, and carried the feeling around all the same.'},
     ];
   }},
];

/* ---- affair discovery dilemmas (dispatched directly by runAffairs(), NOT scanned by maybeSlip) ---- */
const AFFAIR_CRISES={
 divorceOrStop:{
   title:()=>'{partner} Found The Affair',
   body:()=>'{partner} found the letters. There is a version of this where the subject stops seeing {other}. There is a version where there isn’t a marriage left to discuss it in.'+cascadeLine(),
   opts:[
     {label:'End it with {other}, stay',cls:'ok',sub:'affair ends · marriage strained but intact',fx:{happiness:-6,relations:-4},side:s=>{endAffairSide(s,s.__discoveredAffairCid,true);},
       t:'Subject chose the marriage. {other} was told, plainly, that it was over. {partner} did not forgive quickly. The file notes the choice was made anyway.'},
     {label:'Refuse to stop',cls:'no',sub:'the marriage ends here',fx:{happiness:-10,relations:-6},side:s=>{endMarriageSide(s,'Separated');},
       t:'Subject would not stop. {partner} did not stay to watch. The paperwork followed within the year.'},
   ]},
 killThreat:{
   title:()=>'{partner} Threatens Your Life',
   body:()=>'{partner} did not shout. {partner} explained, very calmly, what would happen to the subject if this continued. The Bureau’s file does not use the word “threat.” It uses the word “promise.”'+cascadeLine(),
   opts:[
     {label:'End it, immediately',cls:'ok',sub:'affair ends · the marriage survives, altered',fx:{happiness:-8},side:s=>{endAffairSide(s,s.__discoveredAffairCid,true);},
       t:'Subject ended it with {other} that same evening. {partner} said nothing further about it. The file records only that nothing further happened.'},
     {label:'Continue seeing {other}',cls:'no',sub:'a serious risk — the promise may be kept',fx:{},
       side:s=>{ if(chance(0.35)){ s.alive=false; s.cause='an incident the file declines to describe in full'; } else { endMarriageSide(s,'Separated'); } },
       t:s=>s.alive?'Subject continued anyway. {partner} was gone within the week — no note, no forwarding address, no more promises.':'The promise was kept. The file ends here, without further comment, as these files sometimes do.'},
   ]},
 suicideThreat:{
   title:()=>'{partner} Threatens Themselves',
   body:()=>'{partner} found out, and said one thing that could not be unsaid: that they did not know what they would do to themselves if this went on. The file marks this, carefully, as a threat and not a fact.'+cascadeLine(),
   opts:[
     {label:'End it, immediately',cls:'ok',sub:'affair ends · a fragile peace',fx:{happiness:-9},side:s=>{endAffairSide(s,s.__discoveredAffairCid,true);},
       t:'Subject ended it with {other}. {partner} did not thank them for it. The house was quiet in the careful way, afterward.'},
     {label:'Continue seeing {other}',cls:'no',sub:'a real risk to {partner}',fx:{},
       side:s=>{ if(chance(0.22)){ endMarriageSide(s,'Widowed'); } else { endMarriageSide(s,'Separated'); } },
       t:s=>s.status==='Widowed'?'{partner} meant it. The Bureau’s condolence letter arrived before the subject had finished reading the first one. The file does not speculate further.':'Subject continued. {partner} did not go through with it, but did not stay either. The marriage ended before anything worse could.'},
   ]},
};

/* ---- the NPC cheats on the subject — dispatched directly by runReverseAffairs()/the suspicion crisis ---- */
const NPC_CHEAT_CRISES={
 discovered:{
   title:()=>'{partner} Was Unfaithful',
   body:()=>'The proof was almost mundane — a note, a look held too long, a story that no longer added up. {partner} had been seeing {other}. The knowing does not go away just because the subject has stopped crying about it; the mind does not take betrayal quietly, and the body billed for it too.'+cascadeLine(),
   opts:[
     {label:'Talk it through, try to stay',cls:'ok',sub:'the marriage continues, changed',fx:{relations:-4},
       side:s=>{const p=activePartnerContact(); if(p){p.mood=clamp(p.mood+8,0,100);p.reverseAffair=null;syncPartnerMirror();} s.__betrayedSurvived=true;},
       t:'Subject stayed, and said so out loud, which was its own kind of difficult. {partner} did not have an easy answer for why. There wasn’t one.'},
     {label:'This ends it',cls:'no',sub:'leave — no settlement penalty, the subject was wronged',fx:{happiness:-6},
       side:s=>{ endMarriageSide(s, s.married?'Divorced':'Single'); },
       t:'Subject packed what mattered and left the rest. For once, the leaving felt like the correct thing rather than the hard one.'},
     {label:'Say nothing, stay anyway',cls:'maybe',sub:'endure it quietly',fx:{happiness:-8},
       side:s=>{const p=activePartnerContact(); if(p){p.mood=clamp(p.mood-5,0,100);p.reverseAffair=null;syncPartnerMirror();}},
       t:'Subject said nothing, and kept saying nothing, every day after. The house stayed standing. Something else did not.'},
   ]},
};

const OPPORTUNITY_TITLES={
 oppSabotage:'A Chance To Sabotage',
 oppRaid:'A Chance To Raid',
 oppSeize:'A Chance To Seize Ground',
};
/* ================= OPPORTUNITIES (Hold offense, off the personal clock) ================= */
const OPPORTUNITIES=[
 {id:'oppSabotage',avail:s=>s.holdMember&&s.age>=18&&s.jailUntil<=s.age&&Hold.heat<90,
   body:()=>'Word reaches the Hold: a supply line runs light-guarded this month. It won’t stay that way.',
   opts:[
     {label:'Hit it, fund the Hold',cls:'ok',sub:'low risk · +trust',
       side:s=>{ if(chance(.72)){ opReward(RI(120,280),true); s.__oppText='A small sabotage, clean and quiet. The take went straight into the Hold’s strongbox.'; s.__oppFx={happiness:3,relations:2}; }
         else { const idx=operationFailure(0); const r=applyOperationFailure(idx); s.__oppText=r.text; s.__oppFx=r.fx; } }},
     {label:'Hit it, keep the take',cls:'maybe',sub:'low risk · −trust',
       side:s=>{ if(chance(.72)){ opReward(RI(120,280),false); s.__oppText='A small sabotage, clean and quiet. The take went into a pocket, not the ledger.'; s.__oppFx={happiness:4}; }
         else { const idx=operationFailure(0); const r=applyOperationFailure(idx); s.__oppText=r.text; s.__oppFx=r.fx; } }},
     {label:'Let it pass',cls:'no',sub:'nothing risked, nothing gained',fx:{},side:()=>{},t:'Subject let it pass. There will be others.'}]},
 {id:'oppRaid',avail:s=>s.holdMember&&s.age>=18&&s.jailUntil<=s.age&&livingHoldMembers().length>=1&&Hold.heat<80,
   body:()=>'A depot, a real one, sits within reach — if the fold moves fast and quiet.',
   opts:[
     {label:'Raid it, fund the Hold',cls:'ok',sub:'real risk · +trust',
       side:s=>{ if(chance(.55)){ opReward(RI(350,700),true); s.__oppText='The raid landed. Everything taken went to the Hold, in full view of the fold.'; s.__oppFx={happiness:5,relations:3}; }
         else { const idx=operationFailure(1); const r=applyOperationFailure(idx); s.__oppText=r.text; s.__oppFx=r.fx; } }},
     {label:'Raid it, keep the take',cls:'maybe',sub:'real risk · −trust',
       side:s=>{ if(chance(.55)){ opReward(RI(350,700),false); s.__oppText='The raid landed. Subject kept it quiet — and kept it.'; s.__oppFx={happiness:7}; }
         else { const idx=operationFailure(1); const r=applyOperationFailure(idx); s.__oppText=r.text; s.__oppFx=r.fx; } }},
     {label:'Let it pass',cls:'no',sub:'nothing risked, nothing gained',fx:{},side:()=>{},t:'Subject let it pass. The depot would still be there another day — or it wouldn’t.'}]},
 {id:'oppSeize',avail:s=>s.holdMember&&s.age>=18&&s.jailUntil<=s.age&&Hold.districts.length<DISTRICTS.length&&Hold.heat<70,
   body:()=>{const t=DISTRICTS.find(d=>!Hold.districts.includes(d.id)); return 'The regime’s grip on '+(t?t.name:'new ground')+' looks thinner than usual. It might be time.';},
   opts:[
     {label:'Move on it',cls:'no',sub:'high risk · claims territory',
       side:s=>{ if(chance(.42)){ const target=DISTRICTS.find(d=>!Hold.districts.includes(d.id));
           if(!target){ s.__oppText='There was nothing left to take.'; s.__oppFx={}; }
           else{ Hold.districts.push(target.id); Hold.trust=clamp(Hold.trust+10,0,100);
             s.__oppText='The Hold now holds '+target.name+'. '+target.desc.charAt(0).toUpperCase()+target.desc.slice(1)+' — and now, it’s yours.'; s.__oppFx={happiness:10,relations:6}; } }
         else { const idx=operationFailure(2); const r=applyOperationFailure(idx); s.__oppText=r.text; s.__oppFx=r.fx; } }},
     {label:'Not yet',cls:'ok',sub:'wait for a better moment',fx:{},side:()=>{},t:'Subject waited. The moment, if it was one, passed untaken.'}]},
];

/* ================= HISTORY ================= */
const HISTORY=[
 {y:1914,if:s=>s.age>=3,t:'Archduke Franz Ferdinand was shot in a faraway motorcade. In {place}, the bread noticed first.',fx:{assets:-15}},
 {y:1916,if:s=>s.sex==='M'&&s.age>=18&&s.age<=42,t:'Conscription notice. Subject was issued a uniform two sizes wrong and a rifle with opinions.',fx:{happiness:-6,health:-3},
   side:s=>{s.jobTier=0;s.jobName='Conscript';s.career=null;pushFollow({at:s.age+2,t:chance(.35)?'Subject returned with a limp and a medal that did not match the limp.':'Subject returned with fewer words and all limbs. The Bureau counts this as a win.',fx:chance(.5)?{health:-16,happiness:-4}:{happiness:-2},side:s2=>{s2.jobTier=0;s2.jobName='Unemployed';s2.career=null;}});}},
 {y:1918,if:s=>s.age>=4,t:'The Spanish Lady arrived by train and left by coffin. Subject was ill a month and quiet a year after.',fx:{health:-9},medical:{conditionId:'infection',source:'Spanish Lady',severity:4},outbreak:{id:'influenza',severity:3,years:2}},
 {y:1919,if:s=>s.age>=8,t:'The war ended. Bells, mostly. Subject’s street drank for two days; the Bureau deducted them, then returned them.',fx:{happiness:3}},
 {y:1923,if:s=>s.age>=10,t:'A wheelbarrow of money bought a loaf of bread, and the loaf was the better investment.',fx:{happiness:-3},side:s=>{s.assets=Math.floor(s.assets*0.2);}},
 {y:1929,if:s=>s.age>=12,t:'Black Thursday. The subject’s bank failed on a Tuesday, which the subject felt was unfair to Thursdays.',fx:{happiness:-6},side:s=>{s.assets=Math.floor(s.assets*0.45);if(s.jobTier>1&&chance(.5)){s.jobTier=0;s.jobName='Unemployed';s.career=null;}}},
 {y:1933,if:s=>s.age>=12,t:'In a neighboring country, a failed painter took power. Subject’s uncle said it would pass. The file notes the uncle was wrong.',fx:{happiness:-2}},
 {y:1936,if:s=>s.age>=10,t:'Across the border, brothers shot brothers over which flag to hang. Subject’s church collected bandages.',fx:{happiness:-2}},
 {y:1939,if:s=>s.age>=10,t:'The wireless announced war. Subject’s mother put the good silver in the garden, where it remains.',fx:{happiness:-4}},
 {y:1940,if:s=>s.sex==='M'&&s.age>=18&&s.age<=40,t:'Conscription, again. The uniform fit worse. The rifle had more opinions.',fx:{happiness:-6,health:-3},
   side:s=>{s.jobTier=0;s.jobName='Conscript';s.career=null;pushFollow({at:s.age+2,t:chance(.35)?'Subject was wounded and came home to a quieter house and a louder memory.':'Subject came home. The street threw a parade. Subject slept through most of it.',fx:chance(.5)?{health:-16,happiness:-4}:{happiness:-2},side:s2=>{s2.jobTier=0;s2.jobName='Unemployed';s2.career=null;}});}},
 {y:1941,if:s=>s.age>=10,t:'A harbor far away was attacked on a Sunday. On Monday, the world was different.',fx:{happiness:-2}},
 {y:1943,if:s=>s.age>=10,t:'Rationing tightened. Subject’s butter became a rumor, then a memory, then a topic of conversation.',fx:{happiness:-2,assets:-40}},
 {y:1944,if:s=>s.age>=8,t:'Rockets fell on the capital. In {place}, the windows learned to rattle on cue.',fx:{health:-2,happiness:-3}},
 {y:1945,if:s=>s.age>=8,t:'The war ended. Subject’s street drank for two days; the Bureau deducted them, then, quietly, returned them.',fx:{happiness:6}},
 {y:1945,if:s=>s.age<8,t:'The war ended. Subject did not understand why the grown-ups were crying and laughing at the same time, but joined in anyway.',fx:{happiness:4}},
 {y:1948,if:s=>s.age>=14,t:'The currency was reformed. Subject’s savings were reformed with it, downward.',fx:{happiness:-3},side:s=>{s.assets=Math.floor(s.assets*0.5);}},
 {y:1953,if:s=>s.age>=10,t:'A dictator died far away. The statues fell faster than the snow.',fx:{}},
 {y:1957,if:s=>s.age>=10,t:'A beeping sphere crossed the night sky. Subject’s dog howled at it. Subject, privately, did too.',fx:{smarts:1}},
 {y:1961,if:s=>s.age>=14,t:'A wall went up overnight in a city the subject had once visited. The postcards stopped coming.',fx:{happiness:-3}},
 {y:1962,t:'For thirteen days, the file was nearly the last of its kind. Then, abruptly, it was not.',fx:{happiness:-2}},
 {y:1963,if:s=>s.age>=10,t:'A president was shot in a motorcade. Subject remembered where they were standing. Everyone did.',fx:{happiness:-4}},
 {y:1968,if:s=>s.age>=16&&s.age<=30,t:'The young took the streets, and the streets took the young. Subject’s file notes the subject was, technically, young.',fx:{happiness:2,relations:3}},
 {y:1968,if:s=>s.age>30,t:'The young took the streets. Subject took the other side of the street.',fx:{happiness:-1}},
 {y:1969,if:s=>s.age>=10,t:'A man walked on the moon. Subject went to work on Monday. The moon did not.',fx:{smarts:1}},
 {y:1973,if:s=>s.age>=14,t:'The oil stopped flowing. Subject’s bicycle had its best year.',fx:{assets:-60}},
 {y:1977,if:s=>s.age>=14,t:'The city went dark for one night. Nine months later, the registry office was very busy.',fx:{}},
 {y:1986,t:'A reactor far to the east opened its roof. The Bureau advised against the mushrooms. Subject ate the mushrooms.',fx:{health:-4}},
 {y:1989,if:s=>s.age>=14,t:'A wall came down on the wireless. Subject’s cousin emigrated and sent postcards with colors in them.',fx:{happiness:3}},
 {y:1991,if:s=>s.age>=14,t:'An empire dissolved itself quietly, like an aspirin in water.',fx:{}},
 {y:2001,if:s=>s.age>=10,t:'Planes, towers, a Tuesday that stopped. Subject called everyone they had not called in years.',fx:{happiness:-3,relations:4}},
 {y:2008,if:s=>s.age>=18,t:'The banks fell like dominoes in expensive suits. Subject’s pension looked away.',fx:{happiness:-5},side:s=>{s.assets=Math.floor(s.assets*0.65);if(s.jobTier>1&&chance(.4)){s.jobTier=0;s.jobName='Unemployed';s.career=null;}}},
 {y:2020,t:'A sickness went around the world in a suitcase. Subject was instructed to stay indoors. Subject complied, loudly.',fx:s=>({health:s.age>=65?-6:-2,happiness:-3}),medical:{conditionId:'infection',source:'2020 outbreak',severity:3},outbreak:{id:'influenza',severity:2,years:1}},
];
