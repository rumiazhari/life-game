'use strict';

/* ================= STATE CARE SYSTEM (Form 11-C) =================
 *
 * When the state takes a child — orphaned, evicted, abandoned — the file
 * says "protective custody." The file lies politely. The Bureau does not
 * spend marks on children out of kindness; it spends them because children
 * are future conscripts, informants, and test data.
 *
 * Owns World.stateCare:
 *   {schemaVersion, wardStatus:'none'|'pending_hearing'|'foster'|'cadet'|
 *    'bureau_ward'|'proving', placementQuality:null|'kind'|'cold'|'cruel',
 *    placedYear, abandonedYears, history[]}
 *
 * Tracks (benefits / costs, all applied deterministically each year):
 * - foster/kind  : fed & housed free, warmth (+happiness/+health), small
 *                  allowance. Cost: none material. Rare.
 * - foster/cold  : fed & housed free, emotional neglect (-happiness),
 *                  allowance skimmed by the household head.
 * - foster/cruel : fed barely, housed barely, used as labor (+tiny wages,
 *                  -health/-happiness yearly). Survival guaranteed, comfort not.
 * - cadet        : military boarding. +health/+discipline, stipend, uniform;
 *                  yearly training injuries; freedom curtailed. Ages out at 18.
 * - bureau_ward  : the secret-service nursery. Stipend, tutoring (+smarts),
 *                  scrubbed scrutiny, Bureau Favor accrual — and a lifelong
 *                  debt to a watching employer.
 * - proving      : the Proving Meadow. The best-paid minors in Karsen and
 *                  the worst-measured: yearly health toll, occasional chronic
 *                  conditions, "graduation" at sixteen with a sealed file.
 *
 * Deterministic: all rolls via WorldSimulation.streamFor(world, year,
 * 'state-care'). Same-year idempotent tick; stale-year rejection; bounded
 * history; migration repairs malformed records; invariants return strings.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='state-care';
  const HISTORY_LIMIT=32;

  const TRACKS=['foster','cadet','bureau_ward','proving'];
  const QUALITIES=['kind','cold','cruel'];
  const DISCHARGE_AGE={foster:18,cadet:18,bureau_ward:19,proving:16};
  const INTAKE_FIRST_YEAR_CHANCE=0.55;
  const STIPEND={foster:40,cadet:140,bureau_ward:220,proving:300};
  const CADET_MIN_AGE=12;
  const PROVING_MIN_AGE=10;

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const boundedYearOrNull=v=>v==null||!Number.isFinite(Number(v))?null:Math.round(Number(v));

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('StateCareSystem.ensure requires a world object');
    let sc=world.stateCare;
    if(!sc||typeof sc!=='object'||Array.isArray(sc)) sc={};
    sc.schemaVersion=SCHEMA_VERSION;
    if(typeof sc.wardStatus!=='string') sc.wardStatus='none';
    if(!TRACKS.includes(sc.track)&&sc.track!==undefined&&sc.track!=null) sc.track=null;
    if(sc.placementQuality!=null&&!QUALITIES.includes(sc.placementQuality)) sc.placementQuality=null;
    sc.placedYear=boundedYearOrNull(sc.placedYear);
    sc.abandonedYears=Math.max(0,Math.round(finite(sc.abandonedYears,0)));
    sc.history=Array.isArray(sc.history)?sc.history.slice(-HISTORY_LIMIT):[];
    sc.lastTickYear=boundedYearOrNull(sc.lastTickYear);
    world.stateCare=sc;
    return sc;
  }
  function migrate(world){ return ensure(world); }

  function stream(world,year,salt){
    return root.WorldSimulation&&root.WorldSimulation.streamFor
      ?root.WorldSimulation.streamFor(world,year,'state-care:'+salt,SUBSYSTEM)
      :root.Random.create([world.seed,year,'state-care:'+salt,SUBSYSTEM].join('|'));
  }

  /* ---- queries ---- */
  function active(world){
    const sc=ensure(world);
    return sc.wardStatus==='foster'||sc.wardStatus==='cadet'||sc.wardStatus==='bureau_ward'||sc.wardStatus==='proving';
  }
  function awaitingHearing(world){ return ensure(world).wardStatus==='pending_hearing'; }
  function summaryLabel(world){
    const sc=ensure(world);
    switch(sc.wardStatus){
      case 'foster': return 'STATE WARD · FOSTER PLACEMENT ('+(sc.placementQuality||'cold')+')';
      case 'cadet': return 'STATE WARD · CADET CORPS';
      case 'bureau_ward': return 'WARD OF THE BUREAU';
      case 'proving': return 'PROVING MEADOW PROGRAM';
      default: return null;
    }
  }

  /* ---- intake ---- */
  // A minor with no guardian and no roof is exactly who Form 11-C was
  // printed for. First year: luck decides. Every year after: the Bureau
  // always finds you eventually — the streets are a waiting room.
  function eligibleForIntake(world,S){
    if(!S||typeof S!=='object') return false;
    if(!Number.isFinite(Number(S.age))||Number(S.age)>=16||Number(S.age)<6) return false;
    if(S.alive===false) return false;
    if(active(world)||awaitingHearing(world)) return false;
    const hasGuardian=(Array.isArray(S.contacts)&&S.contacts.some(c=>c&&(c.role==='spouse'||c.role==='partner')));
    if(S.married) return false;
    void hasGuardian;
    const guardiansAlive=(function(){
      try{ return typeof root.guardiansOf==='function'&&root.guardiansOf(S).length>0; }catch(e){ return false; }
    })();
    if(guardiansAlive||S.livingAtHome) return false;
    const roofless=S.lifestyle&&(S.lifestyle.housing==='none'||S.lifestyle.housing==='shelter');
    const destitute=(Number(S.assets)||0)<0;
    return !!(roofless||destitute);
  }

  function beginIntake(world,year){
    const sc=ensure(world);
    sc.wardStatus='pending_hearing';
    sc.history.push({year,type:'intake',note:'Form 11-C issued. Protective custody pending assessment.'});
    trimHistory(sc);
    return sc;
  }

  function tickIntake(world,S,year){
    if(!eligibleForIntake(world,S)) { ensure(world).abandonedYears=0; return null; }
    const sc=ensure(world);
    if(awaitingHearing(world)||active(world)) return null;
    sc.abandonedYears+=1;
    if(sc.abandonedYears<=1){
      if(!stream(world,year,'intake').chance(INTAKE_FIRST_YEAR_CHANCE)){
        sc.history.push({year,type:'eluded',note:'The Bureau\u2019s wagon passed. This time.'});
        trimHistory(sc);
        return null;
      }
    } else {
      sc.history.push({year,type:'located',note:'Found by the sweep, as everyone is found eventually.'});
      trimHistory(sc);
    }
    beginIntake(world,year);
    return sc.wardStatus;
  }

  /* ---- placement (called from the episode's ending ops) ---- */
  function place(world,track,quality,year,subject){
    ensure(world);
    if(!TRACKS.includes(track)) return {placed:false,reason:'bad_track'};
    const S=subject||(typeof root.S!=='undefined'?root.S:null);
    const age=S?Number(S.age)||0:99;
    if(track==='cadet'&&age<CADET_MIN_AGE) track='foster';
    if(track==='proving'&&age<PROVING_MIN_AGE) track='foster';
    const sc=world.stateCare;
    sc.wardStatus=track;
    sc.track=track;
    sc.placementQuality=track==='foster'?(QUALITIES.includes(quality)?quality:'cold'):null;
    sc.placedYear=year;
    sc.history.push({year,type:'placed',note:'Placed: '+track+(sc.placementQuality?' ('+sc.placementQuality+')':'')+'.'});
    trimHistory(sc);
    return {placed:true,track};
  }

  function discharge(world,year,reason){
    ensure(world);
    const sc=world.stateCare;
    if(!active(world)) return null;
    sc.wardStatus='none'; sc.track=null; sc.placementQuality=null; sc.placedYear=null;
    sc.history.push({year,type:'discharged',note:String(reason||'Released from care.').slice(0,120)});
    trimHistory(sc);
    return sc;
  }

  /* ---- annual effects while in care ---- */
  function tickWard(world,S,year){
    const sc=ensure(world);
    if(!active(world)) return null;
    const rng=stream(world,year,'annual');
    const chips=[];
    const bumpStat=(k,d)=>{ const cap=k==='health'&&S.healthCap!=null?S.healthCap:100; const b=finite(S[k],50); S[k]=clamp(Math.round(b+d),0,cap); };
    const pay=(amt)=>{ S.assets=clamp(finite(S.assets,0)+amt,-200000,1000000); };

    if(sc.wardStatus==='foster'){
      if(sc.placementQuality==='kind'){
        bumpStat('happiness',4); bumpStat('health',3); pay(STIPEND.foster);
        chips.push({txt:'+4 HAPPINESS · +3 HEALTH · +$'+STIPEND.foster,plus:true});
      }else if(sc.placementQuality==='cold'){
        bumpStat('happiness',-3); pay(Math.round(STIPEND.foster/2));
        chips.push({txt:'−3 HAPPINESS · +$'+Math.round(STIPEND.foster/2)+' (skimmed)',plus:true});
      }else{ // cruel
        bumpStat('health',-3); bumpStat('happiness',-5); pay(60);
        chips.push({txt:'−3 HEALTH · −5 HAPPINESS · +$60 (labor)',plus:true});
      }
    }else if(sc.wardStatus==='cadet'){
      bumpStat('health',3); bumpStat('smarts',1); pay(STIPEND.cadet);
      let inj=null;
      if(rng.chance(0.22)){ inj='injury'; }
      else if(rng.chance(0.10)){ inj='strain'; }
      if(inj&&root.MedicalSystem){
        root.MedicalSystem.addCondition(S,inj,2,{world,year,source:'cadet drills'});
        chips.push({txt:'TRAINING INJURY',plus:false});
      }
      chips.push({txt:'+3 HEALTH · +1 SMARTS · +$'+STIPEND.cadet,plus:true});
    }else if(sc.wardStatus==='bureau_ward'){
      bumpStat('smarts',2); pay(STIPEND.bureau_ward);
      S.scrutiny=clamp((S.scrutiny||0)-8,0,100);
      S.bureauFavor=clamp((S.bureauFavor||0)+1,0,3);
      chips.push({txt:'+2 SMARTS · +$'+STIPEND.bureau_ward+' · SCRUTINY SCRUBBED · +FAVOR',plus:true});
    }else if(sc.wardStatus==='proving'){
      bumpStat('health',-6); pay(STIPEND.proving);
      if(rng.chance(0.30)){ bumpStat('smarts',1); chips.push({txt:'+1 SMARTS (they measure everything)',plus:true}); }
      if(rng.chance(0.14)&&root.MedicalSystem){
        root.MedicalSystem.addCondition(S,'chronic',2,{world,year,source:'the Proving Meadow'});
        chips.push({txt:'CHRONIC CONDITION NOTED',plus:false});
      }
      chips.push({txt:'−6 HEALTH · +$'+STIPEND.proving,plus:true});
    }

    // Age-out / spent.
    const dischargeAge=DISCHARGE_AGE[sc.wardStatus]||18;
    if((Number(S.age)||0)>=dischargeAge){
      const purse=sc.wardStatus==='proving'?120:(sc.wardStatus==='bureau_ward'?200:100);
      pay(purse);
      S.lifestyle=S.lifestyle||{};
      S.lifestyle.housing=sc.wardStatus==='proving'?'shelter':'room';
      S.lifestyle.food='basic';
      sc.history.push({year,type:'discharged',note:'Aged out of '+sc.wardStatus+' with a purse of '+purse+'.'});
      sc.wardStatus='none'; sc.track=null; sc.placementQuality=null; sc.placedYear=null;
      chips.push({txt:'RELEASED FROM CARE · +$'+purse,plus:true});
    }
    sc.lastTickYear=year;
    return {applied:true,chips};
  }

  function pushHistory(sc,entry){ sc.history.push(entry); if(sc.history.length>HISTORY_LIMIT) sc.history=sc.history.slice(-HISTORY_LIMIT); }
  function trimHistory(sc){ if(sc.history.length>HISTORY_LIMIT) sc.history=sc.history.slice(-HISTORY_LIMIT); }

  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    const year=opts.year!=null?Math.round(Number(opts.year)):0;
    const result={year,applied:false,intake:null,ward:null};
    if(world.stateCare.lastTickYear===year) return Object.assign(result,{applied:false,reason:'already_applied'});
    if(world.stateCare.lastTickYear!=null&&year<world.stateCare.lastTickYear) return Object.assign(result,{applied:false,reason:'stale_year'});
    result.applied=true;
    result.intake=tickIntake(world,S,year)?'pending_hearing':null;
    result.ward=tickWard(world,S,year);
    world.stateCare.lastTickYear=year;
    return result;
  }

  function summary(world){
    const sc=ensure(world);
    return {status:sc.wardStatus,quality:sc.placementQuality,placedYear:sc.placedYear,
      entries:sc.history.length};
  }

  function checkInvariants(world){
    const sc=ensure(world);
    const issues=[];
    const validStates=['none','pending_hearing','foster','cadet','bureau_ward','proving'];
    if(!validStates.includes(sc.wardStatus)) issues.push('stateCare.wardStatus invalid: '+sc.wardStatus);
    if(sc.placementQuality!=null&&!QUALITIES.includes(sc.placementQuality)) issues.push('stateCare placementQuality invalid');
    if(sc.wardStatus==='foster'&&!sc.placementQuality) issues.push('foster placement missing quality');
    if(sc.wardStatus!=='foster'&&sc.placementQuality) issues.push('non-foster placement carries a quality');
    if(sc.wardStatus==='none'&&(sc.track!=null||sc.placedYear!=null)) issues.push('cleared ward retains placement fields');
    if(!Array.isArray(sc.history)) issues.push('history must be an array');
    else if(sc.history.length>HISTORY_LIMIT) issues.push('history exceeds bound');
    return issues;
  }

  root.StateCareSystem={
    SCHEMA_VERSION, SUBSYSTEM, TRACKS, QUALITIES, STIPEND, DISCHARGE_AGE,
    ensure, migrate, tickWorld, place, discharge, tickIntake, tickWard,
    eligibleForIntake, active, awaitingHearing, summaryLabel, summary, checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
