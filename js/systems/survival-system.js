'use strict';

/* Survival economy (informal street market + underworld).
 *
 * Owns two World-persistent collections:
 * - World.survivalOpenings ('informal:NNNNN'): per-settlement street listings
 *   that gate informal work. kind='gig' references an entry of the existing
 *   GIGS table (single payment/risk path -- never reimplemented here);
 *   kind='fixerwork' references a fixer entity plus a crime tier.
 * - World.fixers ('fixer:NNNNN'): underworld employers seeded where
 *   corruption (unrest minus surveillance) is high enough.
 *
 * Also owns desperationOf(): the pure Desperation Index D derived from
 * authoritative S/World state. D gates opportunity visibility, scales
 * poverty mortality, and orders the fast-forward autopilot's survival
 * ladder. It is computed, never stored.
 *
 * House rules honored: deterministic annual generation via
 * WorldSimulation.streamFor(world, year, settlementId, 'survival'); same-year
 * idempotent tick with stale-year rejection; stable monotonic IDs; sorted-key
 * byte-idempotent migration; bounded records; checkInvariants returning
 * strings; no Math.random / shared Random anywhere in replayable paths.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='survival';

  const OPENING_KINDS=['gig','fixerwork'];
  const OPENING_STATUSES=['open','taken','expired'];
  const MAX_OPEN_PER_SETTLEMENT=10;
  const OPENING_TTL_YEARS=2;
  const FIXER_SECTORS=['fencing','labor','vice','smuggling'];
  const FIXER_STATUSES=['active','burned'];
  const MAX_FIXERS_PER_SETTLEMENT=2;
  const FIXER_HEAT_BURN=80;
  const FIXER_HEAT_DECAY=5;

  // Street-listable informal work per settlement kind (subset of GIGS ids).
  const STREET_GIGS_BY_KIND={
    city:['ragbone','ratcatcher','sewer','corpsecart','scab','trial','bloodseller','nightwork'],
    town:['ragbone','ratcatcher','sewer','corpsecart','trial','bloodseller'],
    village:['ragbone','ratcatcher']
  };

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clampUnit=(value,fallback)=>Number.isFinite(Number(value))?clamp(Number(value),0,1):fallback;
  const MIN_YEAR=-5000;
  const MAX_YEAR=5000;
  const boundedYear=(value,fallback)=>{
    const safe=fallback!=null&&Number.isFinite(Number(fallback))?Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(fallback)))):0;
    if(value==null||!Number.isFinite(Number(value))) return safe;
    return Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(value))));
  };
  const boundedYearOrNull=value=>value==null||!Number.isFinite(Number(value))?null:boundedYear(value,0);
  const isValidCounter=value=>typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value)&&value>=0;

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('SurvivalSystem.ensure requires a world object');
    if(!world.survivalOpenings||typeof world.survivalOpenings!=='object'||Array.isArray(world.survivalOpenings)) world.survivalOpenings={};
    if(!isValidCounter(world.survivalCounter)) world.survivalCounter=0;
    if(!world.fixers||typeof world.fixers!=='object'||Array.isArray(world.fixers)) world.fixers={};
    if(!isValidCounter(world.fixerCounter)) world.fixerCounter=0;
    world.survivalLastTickYear=boundedYearOrNull(world.survivalLastTickYear);
    world.survivalSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function idNumber(id,prefix){
    const m=new RegExp('^'+prefix+':(\\d{5,})$').exec(String(id||''));
    return m?Number(m[1]):null;
  }
  function highestIdNumber(records,prefix){
    let highest=0;
    Object.keys(records).forEach(key=>{
      const keyNum=idNumber(key,prefix);
      if(keyNum!=null) highest=Math.max(highest,keyNum);
      const rec=records[key];
      if(rec&&typeof rec==='object'&&!Array.isArray(rec)){
        const idNum=idNumber(rec.id,prefix);
        if(idNum!=null) highest=Math.max(highest,idNum);
      }
    });
    return highest;
  }

  function normalizeOpening(raw){
    const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const knownKind=OPENING_KINDS.includes(source.kind);
    // Unrecoverable ghosts repair to a baseline street gig, marked expired so
    // they never interfere with the live market.
    const kind=knownKind?source.kind:((typeof source.fixerId==='string'&&source.fixerId)?'fixerwork':'gig');
    const status=knownKind?(OPENING_STATUSES.includes(source.status)?source.status:'open'):'expired';
    return {
      id:String(source.id||''),
      settlementId:typeof source.settlementId==='string'&&source.settlementId?source.settlementId:null,
      kind,
      gigId:kind==='gig'?((typeof source.gigId==='string'&&source.gigId)?source.gigId:(knownKind?null:'ragbone')):null,
      fixerId:kind==='fixerwork'&&typeof source.fixerId==='string'&&source.fixerId?source.fixerId:null,
      jobTier:kind==='fixerwork'?clamp(Number.isFinite(Number(source.jobTier))?Math.round(Number(source.jobTier)):0,0,3):null,
      openedYear:boundedYear(source.openedYear,0),
      expiresYear:boundedYear(source.expiresYear,boundedYear(source.openedYear,0)+OPENING_TTL_YEARS),
      status,
      takenByPersonId:status==='taken'&&typeof source.takenByPersonId==='string'&&source.takenByPersonId?source.takenByPersonId:null
    };
  }

  function normalizeFixer(raw){
    const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const heatRaw=Number(source.heat);
    return {
      id:String(source.id||''),
      name:typeof source.name==='string'&&source.name?String(source.name).slice(0,60):'Unnamed Fixer',
      settlementId:typeof source.settlementId==='string'&&source.settlementId?source.settlementId:null,
      sector:FIXER_SECTORS.includes(source.sector)?source.sector:'fencing',
      status:FIXER_STATUSES.includes(source.status)?source.status:'active',
      heat:Number.isFinite(heatRaw)?clamp(Math.round(heatRaw),0,100):0,
      trustRequired:clampUnit(source.trustRequired,0),
      openedYear:boundedYear(source.openedYear,0),
      history:Array.isArray(source.history)?source.history.slice(-16).map(h=>h&&typeof h==='object'?Object.assign({},h):{note:String(h)}):[]
    };
  }

  function migrate(world){
    ensure(world);
    ['survivalOpenings:informal','fixers:fixer'].forEach(spec=>{
      const [field,prefix]=spec.split(':');
      const reserve=highestIdNumber(world[field],prefix);
      const counterField=prefix==='informal'?'survivalCounter':'fixerCounter';
      if(world[counterField]<reserve) world[counterField]=reserve;
    });
    const fallbackSettlement=(typeof world.activeSettlementId==='string'&&world.activeSettlementId)?world.activeSettlementId:null;
    const openings={};
    Object.keys(world.survivalOpenings).sort().forEach(key=>{
      const rec=normalizeOpening(world.survivalOpenings[key]);
      if(!rec.settlementId) rec.settlementId=fallbackSettlement;
      if(!rec.id){
        const keyNum=idNumber(key,'informal');
        rec.id=(keyNum!=null&&/^informal:\d{5,}$/.test(key))?key:'informal:'+String(++world.survivalCounter).padStart(5,'0');
      }else{
        const idNum=idNumber(rec.id,'informal');
        if(idNum!=null&&world.survivalCounter<idNum) world.survivalCounter=idNum;
      }
      openings[rec.id]=rec;
    });
    world.survivalOpenings=openings;
    const fixers={};
    Object.keys(world.fixers).sort().forEach(key=>{
      const rec=normalizeFixer(world.fixers[key]);
      if(!rec.settlementId) rec.settlementId=fallbackSettlement;
      if(!rec.id){
        const keyNum=idNumber(key,'fixer');
        rec.id=(keyNum!=null&&/^fixer:\d{5,}$/.test(key))?key:'fixer:'+String(++world.fixerCounter).padStart(5,'0');
      }else{
        const idNum=idNumber(rec.id,'fixer');
        if(idNum!=null&&world.fixerCounter<idNum) world.fixerCounter=idNum;
      }
      fixers[rec.id]=rec;
    });
    world.fixers=fixers;
    return world;
  }

  /* ---- Desperation Index (pure; never stored) ---- */

  // Tuning table for player-facing poverty mortality (ui.js checkMortality
  // reads this). Exported so the "deaths should be rare" dial has one
  // documented, testable home instead of magic numbers in UI code.
  const MORTALITY_TUNING={
    povertyBaseHouseNone:0.009,
    povertyMeagerFood:0.002,
    povertyBoth:0.007,
    povertyInsecurity:0.004,
    desperationFloor:0.30,
    desperationScale:0.70,
    childGuardFactor:1.35,
    elderFactor:1.30
  };

  function desperationOf(world,S){
    if(!S||typeof S!=='object') return 0;
    const age=Number(S.age)||0;
    const jobless=(age>=16&&age<65&&!S.eduStage&&(Number(S.jobTier)||0)<1&&!(S.jailUntil>age))?1:0;
    const debtDepth=clamp((-(Number(S.assets)||0))/1500,0,1);
    const housingRung={none:1,shelter:.8,room:.55,flat:.25}[S.lifestyle&&S.lifestyle.housing]||0;
    const foodInsecurity=S.lifestyle&&S.lifestyle.food==='meager'?1:(S.lifestyle&&S.lifestyle.food==='basic'?.35:0);
    const fragility=clamp((60-(Number(S.health)||60))/60,0,1);
    return clamp(.30*jobless+.25*debtDepth+.20*housingRung+.15*foodInsecurity+.10*fragility,0,1);
  }

  /* ---- Ways Out: prioritized, actionable survival advice ----
   *
   * Pure read over authoritative state (S + World systems). Returns an array
   * of {id,priority,title,why,risky,action} sorted by descending priority.
   * `action` names a PURSUITS/DECISIONS entry by id (+type) -- the Plan sheet
   * renders these as queueable chips and re-validates availability there, so
   * guidance itself stays availability-loose but intent-exact. Risky steps
   * (the underworld hatch) are flagged and never outrank honest ones unless
   * desperation is genuinely extreme.
   */
  function guidanceFor(world,S,options){
    if(!S||typeof S!=='object') return [];
    const opts=options||{};
    const out=[];
    const add=(id,priority,title,why,action,risky)=>out.push({id,priority,title,why,risky:!!risky,action:action||null});
    const age=Number(S.age)||0;
    const desperate=desperationOf(world,S);
    const jailed=S.jailUntil>age;
    const adultWorkingAge=age>=16&&age<65&&!S.eduStage;
    const jobless=adultWorkingAge&&(Number(S.jobTier)||0)<1;
    const broke=(Number(S.assets)||0)<0;
    const foodMeager=S.lifestyle&&S.lifestyle.food==='meager';
    const housedWell=S.lifestyle&&['flat','house','townhouse','estate'].includes(S.lifestyle.housing);

    if(jailed) return [];

    // 1. Eat. A mission meal is free and blunts the hunger penalty outright.
    if(foodMeager||(Number(S.assets)||0)<30&&age>=10){
      add('eat',96,'The mission line','A hot meal costs nothing and quiets the hunger penalty for the year.',{type:'p',id:'soupkitchen'});
    }
    // 2. Work beats everything else that isn't eating.
    if(jobless){
      const settlementId=(S.location&&S.location.settlementId)||(typeof World!=='undefined'&&World?World.activeSettlementId:null);
      let opening=null;
      try{
        opening=bestOpeningFor(world,S,{settlementId});
      }catch(e){ opening=null; }
      if(opening){
        if(opening.kind==='gig'){
          add('worklisting',92,'Take honest street work','A listed opening is open to you right now; it pays today and asks no papers.',{type:'p',id:'gig',extra:{openingId:opening.id,gigId:opening.gigId}});
        }else{
          add('workfixerlisting',88,'A fixer has work posted','Listed underworld work: better pay than the yard, and a heat all its own.',{type:'p',id:'gig',extra:{openingId:opening.id}},true);
        }
        void settlementId;
      }else{
        add('workportal',90,'Work the portal','A proper vacancy beats a hard year of drift. Apply even if the pickings look thin.',{type:'p',id:'lookwork'});
      }
      add('gigline',78,'Off-the-books labour','Nasty, unlicensed, no guarantee of pay -- but the yard always needs another pair of hands.',{type:'p',id:'gig'});
      if((Number(S.relations)||0)>=70&&!foodMeager){
        add('favor',70,'Call in a favor','Someone who owes you knows someone who is hiring. It spends a friendship cheaply, once.',{type:'p',id:'favor'});
      }
    }
    // 3. Stop the bleeding: cut the lifestyle before the debt cuts you.
    if(broke&&housedWell){
      add('downsize',88,'Downsize the roof','Rent is the loudest envelope on the table. Move somewhere smaller before it writes cheques of its own.',{type:'ui',id:'household'});
    }
    if(broke&&(Number(S.jobTier)||0)>0){
      add('overtime',76,'Work overtime','Extra shifts pay real coin and cost real body. Spend both deliberately.',{type:'p',id:'overtime'});
      add('nightshift',62,'Take the night shift','Better money, worse hours, a permanent shadow under the eyes.',{type:'p',id:'nightshift'});
    }
    // 4. The body is an asset too; the dispensary bills what the poor can pay.
    if((Number(S.health)||100)<42&&age>=10){
      add('doctor',84,'See the doctor','Untreated conditions compound. When you are on the bottom rung the parish dispensary bills what you can actually pay.',{type:'p',id:'doctor'});
    }
    // 5. Mood keeps people alive; walking is free.
    if((Number(S.happiness)||50)<32){
      add('walk',52,'Walk it off','Costs nothing, helps more than the file will ever record.',{type:'p',id:'walk'});
      add('rest',44,'Do nothing, on purpose','Recovery is also a plan.',{type:'p',id:'rest'});
    }
    // 6. Paper cleanup once there is slack.
    if(S.record&&(Number(S.assets)||0)>=250){
      add('expunge',54,'Expunge the record','A clean page widens every later door, and quiet files earn Bureau Favor.',{type:'d',id:'expunge'});
    }
    // 7. The underworld hatch -- real money, real heat, flagged as such.
    if(desperate>=0.60&&age>=16&&!jailed){
      if(S.holdMember){
        add('fixerjob',60,'Work for the fixer','Organized pay, organized risk. Every capture raises the heat until the operation folds.',{type:'d',id:'fixerjob'},true);
      }else{
        const sid=(S.location&&S.location.settlementId)||(typeof World!=='undefined'&&World?World.activeSettlementId:null);
        let fixers=0;
        try{ fixers=activeLocalFixers(world,sid).length; }catch(e){ fixers=0; }
        if(fixers>0){
          add('seekfixer',58,'Meet a fixer','The fold has a door open to the desperate. What it charges later is not printed anywhere.',{type:'d',id:'seekfixer'},true);
        }
      }
    }
    void opts;
    return out.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,7);
  }

  /* ---- Settlement street-market profile ---- */

  function definitionsOf(world){
    if(root.WorldSimulation&&typeof root.WorldSimulation.definitions==='function'){
      try{ return root.WorldSimulation.definitions(world)||[]; }catch(e){}
    }
    return typeof KARSEN_SETTLEMENTS!=='undefined'&&Array.isArray(KARSEN_SETTLEMENTS)?KARSEN_SETTLEMENTS:[];
  }

  function settlementProfile(world,settlementId){
    const def=definitionsOf(world).find(s=>s.id===settlementId)||null;
    const runtime=world.settlements&&world.settlements[settlementId]||null;
    const emp=runtime&&runtime.economy&&Number.isFinite(Number(runtime.economy.employmentIndex))?clamp(Number(runtime.economy.employmentIndex),0,1):.6;
    const unrest=runtime&&runtime.security&&Number.isFinite(Number(runtime.security.unrest))?clamp(Number(runtime.security.unrest),0,1):.2;
    const wageIndex=runtime&&runtime.economy&&Number.isFinite(Number(runtime.economy.wageIndex))?clamp(Number(runtime.economy.wageIndex),.65,1.55):1;
    const kind=def&&def.kind||'town';
    const popScale=kind==='city'?1:kind==='town'?.75:.5;
    const surveillanceBasis=runtime&&runtime.security&&Number.isFinite(Number(runtime.security.surveillance))?clamp(Number(runtime.security.surveillance),0,1):(def?clamp((Number(def.surveillance)||50)/100,0,1):.5);
    const streetEconomy=clamp((1.3-emp)*1.2*(0.6+0.7*unrest)*(1-surveillanceBasis*.25),0,1);
    const corruption=clamp(unrest*1.4-surveillanceBasis*.45+.3,0,1);
    return {def,runtime,kind,wageIndex,streetEconomy,corruption,popScale,surveillance:surveillanceBasis};
  }

  /* ---- Annual tick ---- */

  function streamFor(world,year,key){
    if(root.WorldSimulation&&typeof root.WorldSimulation.streamFor==='function'){
      return root.WorldSimulation.streamFor(world,year,key,SUBSYSTEM);
    }
    return root.Random.create([world.seed,year,key,SUBSYSTEM].join('|'));
  }

  // GIGS is a top-level const in js/data.js: it is reachable as a bare
  // identifier through the global lexical scope but never as root.GIGS.
  function gigCatalog(){
    return typeof GIGS!=='undefined'&&Array.isArray(GIGS)?GIGS:[];
  }

  function activeLocalFixers(world,settlementId){
    return Object.values(world.fixers).filter(f=>f.settlementId===settlementId&&f.status==='active')
      .sort((a,b)=>a.id.localeCompare(b.id));
  }

  function openCountForSettlement(world,settlementId){
    return Object.values(world.survivalOpenings).filter(o=>o.settlementId===settlementId&&o.status==='open').length;
  }

  function makeFixerName(rng){
    const male=typeof MALE!=='undefined'&&MALE.length?MALE:['Oskar'];
    const female=typeof FEMALE!=='undefined'&&FEMALE.length?FEMALE:['Mira'];
    const last=typeof LAST!=='undefined'&&LAST.length?LAST:['Voss'];
    const first=rng.next()<.5?male[Math.floor(rng.next()*male.length)]:female[Math.floor(rng.next()*female.length)];
    return first+' '+last[Math.floor(rng.next()*last.length)];
  }

  function seedFixer(world,settlementId,year,rng,profile){
    const count=Object.values(world.fixers).filter(f=>f.settlementId===settlementId).length;
    if(count>=MAX_FIXERS_PER_SETTLEMENT) return null;
    world.fixerCounter+=1;
    const id='fixer:'+String(world.fixerCounter).padStart(5,'0');
    const fixer={
      id,
      name:makeFixerName(rng),
      settlementId,
      sector:FIXER_SECTORS[Math.floor(rng.next()*FIXER_SECTORS.length)],
      status:'active',
      heat:Math.round(clampUnit(profile.corruption,0)*10),
      trustRequired:clampUnit(rng.range(0,.35),0),
      openedYear:boundedYear(year,0),
      history:[{year:boundedYear(year,0),type:'appeared',summary:'First heard of in '+settlementId+'.'}]
    };
    world.fixers[id]=fixer;
    return fixer;
  }

  function generateForSettlement(world,settlementId,year){
    const profile=settlementProfile(world,settlementId);
    const rng=streamFor(world,year,settlementId);
    // Underworld seeding follows corruption.
    if(profile.corruption>=.45&&rng.next()<profile.corruption*.55){
      seedFixer(world,settlementId,year,rng,profile);
    }
    const activeFixers=activeLocalFixers(world,settlementId);
    // Street pressure drives how many informal listings exist this year.
    const streetPressure=profile.streetEconomy;
    let count=Math.round(clamp(streetPressure*4*profile.popScale,0,MAX_OPEN_PER_SETTLEMENT));
    if(streetPressure>=.3&&count<1) count=1;
    const catalog=(typeof STREET_GIGS_BY_KIND!=='undefined'?STREET_GIGS_BY_KIND[profile.kind]:null)||[];
    const gigs=catalog.filter(gid=>gigCatalog().some(g=>g.id===gid));
    const openGigIds=new Set(Object.values(world.survivalOpenings)
      .filter(o=>o.settlementId===settlementId&&o.kind==='gig'&&o.status==='open')
      .map(o=>o.gigId));
    let created=0;
    for(let i=0;i<count&&openCountForSettlement(world,settlementId)<MAX_OPEN_PER_SETTLEMENT;i++){
      let opening=null;
      if(activeFixers.length&&rng.next()<profile.corruption*.5){
        const fixer=activeFixers[Math.floor(rng.next()*activeFixers.length)];
        const tier=Math.floor(clamp(rng.next()*(1+profile.corruption*3),0,3.999));
        opening={settlementId,kind:'fixerwork',fixerId:fixer.id,tier};
      }else if(gigs.length){
        const pool=gigs.filter(gid=>!openGigIds.has(gid));
        if(!pool.length) continue;
        const gigId=pool[Math.floor(rng.next()*pool.length)];
        openGigIds.add(gigId);
        opening={settlementId,kind:'gig',gigId};
      }
      if(!opening) continue;
      world.survivalCounter+=1;
      const id='informal:'+String(world.survivalCounter).padStart(5,'0');
      world.survivalOpenings[id]=normalizeOpening({
        id,
        settlementId,
        kind:opening.kind,
        gigId:opening.gigId||null,
        fixerId:opening.fixerId||null,
        jobTier:opening.tier!=null?opening.tier:null,
        openedYear:year,
        expiresYear:year+OPENING_TTL_YEARS,
        status:'open'
      });
      created++;
    }
    return created;
  }

  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const year=boundedYear(opts.year!=null?opts.year:world.year,world.year);
    if(world.survivalLastTickYear===year){
      return {year,applied:false,reason:'already_applied',generated:0,expired:0,burned:0};
    }
    if(world.survivalLastTickYear!=null&&year<world.survivalLastTickYear){
      return {year,applied:false,reason:'stale_year',generated:0,expired:0,burned:0};
    }
    let expired=0,burned=0;
    // Expiry pass.
    Object.values(world.survivalOpenings).forEach(opening=>{
      if(opening.status==='open'&&year>opening.expiresYear){
        opening.status='expired'; expired++;
      }
    });
    // Fixer heat decay, burnouts, and withdrawal of their listings.
    Object.values(world.fixers).forEach(fixer=>{
      if(fixer.status!=='active') return;
      fixer.heat=clamp(fixer.heat-FIXER_HEAT_DECAY,0,100);
      if(fixer.heat>=FIXER_HEAT_BURN){ burnFixer(world,fixer.id,year); burned++; }
    });
    // Generation pass over every known settlement definition.
    let generated=0;
    definitionsOf(world).forEach(def=>{ generated+=generateForSettlement(world,def.id,year); });
    world.survivalLastTickYear=year;
    return {year,applied:true,generated,expired,burned};
  }

  /* ---- Player-facing transitions ---- */

  function takeOpening(world,openingId,personId,options){
    ensure(world);
    const opts=options||{};
    const year=boundedYear(opts.year!=null?opts.year:world.year,world.year);
    const opening=world.survivalOpenings[openingId];
    if(!opening) return {taken:false,reason:'missing_opening'};
    if(opening.status!=='open') return {taken:false,reason:opening.status==='taken'?'already_taken':'not_available'};
    if(year>opening.expiresYear){ opening.status='expired'; return {taken:false,reason:'listing_expired'}; }
    if(opts.settlementId&&opts.settlementId!==opening.settlementId) return {taken:false,reason:'wrong_settlement'};
    if(opening.kind==='fixerwork'){
      const fixer=world.fixers[opening.fixerId];
      if(!fixer||fixer.status!=='active'){ opening.status='expired'; return {taken:false,reason:'fixer_unavailable'}; }
    }else if(opening.kind==='gig'&&opts.subject){
      const gig=gigCatalog().find(g=>g.id===opening.gigId);
      if(gig&&typeof gig.req==='function'&&!gig.req(opts.subject)) return {taken:false,reason:'not_qualified'};
    }
    opening.status='taken';
    opening.takenByPersonId=String(personId||'subject');
    return {taken:true,reason:null,opening};
  }

  function reportCapture(world,fixerId,tier,year){
    ensure(world);
    const fixer=world.fixers[fixerId];
    if(!fixer||fixer.status!=='active') return {heat:0,burned:false};
    fixer.heat=clamp(fixer.heat+10+(Number(tier)||0)*8,0,100);
    fixer.history.push({year:boundedYear(year,world.year),type:'capture',summary:'A worker was taken on a job.'});
    fixer.history=fixer.history.slice(-16);
    if(fixer.heat>=FIXER_HEAT_BURN){ burnFixer(world,fixerId,year); return {heat:fixer.heat,burned:true}; }
    return {heat:fixer.heat,burned:false};
  }

  function burnFixer(world,fixerId,year){
    ensure(world);
    const fixer=world.fixers[fixerId];
    if(!fixer) return null;
    fixer.status='burned';
    fixer.heat=Math.max(fixer.heat,FIXER_HEAT_BURN);
    fixer.history.push({year:boundedYear(year,world.year),type:'burned',summary:'The operation folded under heat.'});
    fixer.history=fixer.history.slice(-16);
    Object.values(world.survivalOpenings).forEach(opening=>{
      if(opening.kind==='fixerwork'&&opening.fixerId===fixerId&&opening.status==='open') opening.status='expired';
    });
    return fixer;
  }

  /* ---- Queries ---- */

  function get(world,id){ ensure(world); return world.survivalOpenings[id]||null; }
  function getFixer(world,id){ ensure(world); return world.fixers[id]||null; }

  function openingsFor(world,settlementId,filters){
    ensure(world);
    const f=filters||{};
    return Object.values(world.survivalOpenings)
      .filter(o=>o.settlementId===settlementId)
      .filter(o=>!f.status||o.status===f.status)
      .filter(o=>!f.kind||o.kind===f.kind)
      .sort((a,b)=>a.id.localeCompare(b.id));
  }

  // True once the person has any underworld introduction memory or Hold tie.
  function introducedToWorld(world,S){
    if(!S) return false;
    if(S.holdMember) return true;
    if(root.RelationshipMemory&&typeof root.RelationshipMemory.forPerson==='function'&&typeof World!=='undefined'&&World){
      return root.RelationshipMemory.forPerson(World,S.npcId||'subject').some(m=>m&&m.tags&&m.tags.includes('underworld'));
    }
    return false;
  }

  // Best available listing for the subject right now (autopilot + UI hints).
  // opts.kinds restricts to specific opening kinds.
  function bestOpeningFor(world,S,options){
    ensure(world);
    if(!S) return null;
    const opts=options||{};
    const settlementId=opts.settlementId||(S.location&&S.location.settlementId)||(typeof World!=='undefined'&&World?World.activeSettlementId:null);
    if(!settlementId) return null;
    const year=boundedYear(opts.year!=null?opts.year:world.year,world.year);
    const profile=settlementProfile(world,settlementId);
    const kinds=Array.isArray(opts.kinds)&&opts.kinds.length?opts.kinds:OPENING_KINDS;
    let best=null,bestScore=-1;
    openingsFor(world,settlementId,{status:'open'}).forEach(opening=>{
      if(!kinds.includes(opening.kind)) return;
      if(year>opening.expiresYear) return;
      let score=-1;
      if(opening.kind==='gig'){
        const gig=gigCatalog().find(g=>g.id===opening.gigId);
        if(!gig) return;
        if(typeof gig.req==='function'&&!gig.req(S)) return;
        score=((gig.pay?gig.pay[1]:40)+(gig.pay?gig.pay[0]:20))/2*profile.wageIndex*(1/(1+(gig.dangerP||0)));
      }else if(opening.kind==='fixerwork'){
        if(!introducedToWorld(world,S)) return;
        const fixer=world.fixers[opening.fixerId];
        if(!fixer||fixer.status!=='active') return;
        const reward=[120,400,900,4000][opening.jobTier||0]||120;
        score=reward*(0.8+profile.corruption*.4)/(1+(opening.jobTier||0)*.6);
      }
      if(score>bestScore){ bestScore=score; best=opening; }
    });
    return best;
  }

  /* ---- Summary & invariants ---- */

  function summary(world){
    ensure(world);
    const result={openings:0,open:0,taken:0,expired:0,gigs:0,fixerwork:0,fixersActive:0,fixersBurned:0};
    Object.values(world.survivalOpenings).forEach(o=>{
      result.openings++; result[o.status]=(result[o.status]||0)+1;
      if(o.kind==='gig') result.gigs++; else result.fixerwork++;
    });
    Object.values(world.fixers).forEach(f=>{
      if(f.status==='active') result.fixersActive++; else result.fixersBurned++;
    });
    return result;
  }

  function checkInvariants(world){
    const issues=[];
    if(!world||typeof world!=='object') return ['world must be an object'];
    if(world.survivalSchemaVersion!==SCHEMA_VERSION) issues.push('survivalSchemaVersion must be '+SCHEMA_VERSION);
    ['survivalOpenings','fixers'].forEach(field=>{
      if(!world[field]||typeof world[field]!=='object'||Array.isArray(world[field])) issues.push(field+' must be an object');
    });
    if(typeof world.survivalLastTickYear!=='undefined'&&world.survivalLastTickYear!=null&&(!Number.isInteger(world.survivalLastTickYear))) issues.push('survivalLastTickYear must be null or an integer');
    if(!isValidCounter(world.survivalCounter)) issues.push('survivalCounter must be a finite non-negative integer');
    if(!isValidCounter(world.fixerCounter)) issues.push('fixerCounter must be a finite non-negative integer');
    if(isValidCounter(world.survivalCounter)&&world.survivalCounter<highestIdNumber(world.survivalOpenings,'informal')) issues.push('survivalCounter is behind the highest opening id');
    if(isValidCounter(world.fixerCounter)&&world.fixerCounter<highestIdNumber(world.fixers,'fixer')) issues.push('fixerCounter is behind the highest fixer id');
    if(!issues.length){
      const gigIds=gigCatalog().length?new Set(gigCatalog().map(g=>g.id)):null;
      Object.keys(world.survivalOpenings).sort().forEach(key=>{
        const o=world.survivalOpenings[key];
        if(!o||typeof o!=='object'||Array.isArray(o)){ issues.push('survival opening '+key+' is not an object'); return; }
        const expected=normalizeOpening(o);
        if(JSON.stringify(expected)!==JSON.stringify(o)) issues.push('survival opening '+key+' is not in normalized form');
        if(o.id!==key) issues.push('survival opening key '+key+' does not match record id');
        if(!o.settlementId) issues.push('survival opening '+key+' missing settlementId');
        if(o.kind==='gig'&&!o.gigId) issues.push('survival opening '+key+' of kind gig missing gigId');
        if(o.kind==='gig'&&gigIds&&!gigIds.has(o.gigId)) issues.push('survival opening '+key+' references unknown gig '+o.gigId);
        if(o.kind==='fixerwork'){
          if(!o.fixerId) issues.push('survival opening '+key+' of kind fixerwork missing fixerId');
          else if(!world.fixers[o.fixerId]) issues.push('survival opening '+key+' references missing fixer '+o.fixerId);
          else if(world.fixers[o.fixerId].status==='burned'&&o.status==='open') issues.push('survival opening '+key+' open against burned fixer');
        }
        if(o.status==='taken'&&!o.takenByPersonId) issues.push('survival opening '+key+' taken without taker');
      });
      Object.keys(world.fixers).sort().forEach(key=>{
        const f=world.fixers[key];
        if(!f||typeof f!=='object'){ issues.push('fixer '+key+' is not an object'); return; }
        const expected=normalizeFixer(f);
        if(JSON.stringify(expected)!==JSON.stringify(f)) issues.push('fixer '+key+' is not in normalized form');
        if(f.id!==key) issues.push('fixer key '+key+' does not match record id');
        if(!f.settlementId) issues.push('fixer '+key+' missing settlementId');
      });
    }
    return issues;
  }

  root.SurvivalSystem={
    SCHEMA_VERSION,
    SUBSYSTEM,
    OPENING_KINDS,
    OPENING_STATUSES,
    MAX_OPEN_PER_SETTLEMENT,
    OPENING_TTL_YEARS,
    FIXER_SECTORS,
    MAX_FIXERS_PER_SETTLEMENT,
    FIXER_HEAT_BURN,
    MORTALITY_TUNING,
    ensure,
    migrate,
    desperationOf,
    guidanceFor,
    settlementProfile,
    tickWorld,
    takeOpening,
    reportCapture,
    burnFixer,
    get,
    getFixer,
    localFixers: activeLocalFixers,
    openingsFor,
    introducedToWorld,
    bestOpeningFor,
    summary,
    checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);

