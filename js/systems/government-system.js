'use strict';

/* ================= GOVERNMENT SYSTEM (Phase 5 — slice 1) =================
 *
 * The regime is not a person; it is a posture. Every year it recomputes how
 * hard it watches, how much it is believed, and how loudly it insists — and
 * that posture is felt on the subject's own file. This is the Phase 5
 * foundation: an authoritative `World.government` aggregate that the
 * authoritarian-cruelty theme (the active USER DIRECTIVE) and all later
 * Phase 5/7/8 systems will grow FROM.
 *
 * Owns World.government:
 *   {schemaVersion, regime:'bureaucratic_authoritarian',
 *    legitimacy:[0,1], propaganda:[0,1], surveillancePosture:[0,1],
 *    scrutinyPressure:[0,1], lastTickYear, history[]}
 *
 * Interconnection (the directive's "interconnectedness first" rule):
 *  - READS the existing settlement-security sim (`settlement.security.
 *    surveillance` / `.unrest`) and `world.nationalModifiers` — never
 *    duplicates them; it is a downstream expression of them.
 *  - WRITES small, bounded amounts to the player's own `S` (scrutiny up when
 *    the watched are watched harder; freedom down when the regime feels weak)
 *    — exactly the established StateCare pattern: the system owns World.*,
 *    the player's lived oppression is expressed through S. Other systems
 *    already read S.scrutiny/S.freedom, so the grip propagates naturally.
 *
 * Deterministic: all rolls via WorldSimulation.streamFor(world, year,
 * 'government'). Same-year idempotent tick; stale-year rejection; bounded
 * history; migration repairs malformed records; invariants return strings.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='government';
  const HISTORY_LIMIT=32;

  const REGIMES=['bureaucratic_authoritarian'];
  const LEGITIMACY_MIN=0, LEGITIMACY_MAX=1;
  const PROPAGANDA_MIN=0, PROPAGANDA_MAX=1;
  const POSTURE_MIN=0, POSTURE_MAX=1;
  const PRESSURE_MIN=0, PRESSURE_MAX=1;
  // Bounds on the player-facing expression of the regime's grip.
  const SCRUTINY_BUMP_MAX=3;
  const FREEDOM_BUMP_MAX=2;
  const WATCHED_THRESHOLD=40;     // S.scrutiny above which the eye tightens
  const WEAK_REGIME_THRESHOLD=0.45; // legitimacy below which the grip tightens

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const boundedYearOrNull=v=>v==null||!Number.isFinite(Number(v))?null:Math.round(Number(v));
  const nat=mods=>mods&&typeof mods==='object'?mods:{};

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('GovernmentSystem.ensure requires a world object');
    let g=world.government;
    if(!g||typeof g!=='object'||Array.isArray(g)) g={};
    g.schemaVersion=SCHEMA_VERSION;
    if(!REGIMES.includes(g.regime)) g.regime='bureaucratic_authoritarian';
    g.legitimacy=clamp(finite(g.legitimacy,0.55),LEGITIMACY_MIN,LEGITIMACY_MAX);
    g.propaganda=clamp(finite(g.propaganda,0.40),PROPAGANDA_MIN,PROPAGANDA_MAX);
    g.surveillancePosture=clamp(finite(g.surveillancePosture,0),POSTURE_MIN,POSTURE_MAX);
    g.scrutinyPressure=clamp(finite(g.scrutinyPressure,0),PRESSURE_MIN,PRESSURE_MAX);
    g.lastTickYear=boundedYearOrNull(g.lastTickYear);
    g.history=Array.isArray(g.history)?g.history.slice(-HISTORY_LIMIT):[];
    world.government=g;
    return g;
  }
  function migrate(world){ return ensure(world); }

  function stream(world,year,salt){
    return root.WorldSimulation&&root.WorldSimulation.streamFor
      ?root.WorldSimulation.streamFor(world,year,'government:'+salt,SUBSYSTEM)
      :root.Random.create([world.seed,year,'government:'+salt,SUBSYSTEM].join('|'));
  }

  /* ---- the posture the regime takes this year (read-only over the sim) ---- */
  function readSurveillance(world){
    const sid=world&&world.activeSettlementId;
    const runtime=world&&world.settlements&&sid?world.settlements[sid]:null;
    const sec=runtime&&runtime.security?runtime.security:null;
    return {
      surveillance:sec&&Number.isFinite(Number(sec.surveillance))?clamp(Number(sec.surveillance),0,1):0,
      unrest:sec&&Number.isFinite(Number(sec.unrest))?clamp(Number(sec.unrest),0,1):0
    };
  }

  function computePosture(world,year){
    const mods=nat(world.nationalModifiers);
    const sv=readSurveillance(world);
    const nationalSurveillance=Number.isFinite(Number(mods.surveillance))?clamp(Number(mods.surveillance),0,1):sv.surveillance;
    const surveillancePosture=clamp(0.6*sv.surveillance+0.4*nationalSurveillance,POSTURE_MIN,POSTURE_MAX);
    // Legitimacy erodes as unrest rises; the machine never quite recovers it
    // on its own — only later systems (and player resistance) can restore it.
    const prior=ensure(world).legitimacy;
    const legitimacy=clamp(prior*0.9+0.1*(1-sv.unrest),LEGITIMACY_MIN,LEGITIMACY_MAX);
    // Propaganda ratchets up with the posture: more watching, more insisting.
    const propagandaTarget=clamp(0.5+0.3*surveillancePosture,PROPAGANDA_MIN,PROPAGANDA_MAX);
    const propaganda=clamp(ensure(world).propaganda*0.92+0.08*propagandaTarget,PROPAGANDA_MIN,PROPAGANDA_MAX);
    const scrutinyPressure=clamp(0.5*surveillancePosture+0.5*(prior),PRESSURE_MIN,PRESSURE_MAX);
    return {surveillancePosture,legitimacy,propaganda,scrutinyPressure,unrest:sv.unrest};
  }

  function summaryLabel(world){
    const g=ensure(world);
    if(g.legitimacy<WEAK_REGIME_THRESHOLD) return 'REGIME · TIGHTENING GRIP';
    if(g.surveillancePosture>0.6) return 'REGIME · HEAVY SURVEILLANCE';
    if(g.propaganda>0.6) return 'REGIME · PROPAGANDA OFFENSIVE';
    return 'REGIME · BUREAUCRATIC ORDER';
  }

  /* ---- annual tick: recompute posture, express it on the subject ---- */
  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    const year=opts.year!=null?Math.round(Number(opts.year)):0;
    const g=world.government;
    const result={year,applied:false,intake:null,ward:null,chips:[]};
    if(g.lastTickYear===year) return Object.assign(result,{applied:false,reason:'already_applied'});
    if(g.lastTickYear!=null&&year<g.lastTickYear) return Object.assign(result,{applied:false,reason:'stale_year'});
    result.applied=true;

    const posture=computePosture(world,year);
    g.surveillancePosture=posture.surveillancePosture;
    g.legitimacy=posture.legitimacy;
    g.propaganda=posture.propaganda;
    g.scrutinyPressure=posture.scrutinyPressure;

    const notes=[];
    // Express the posture on the subject's own file (bounded, deterministic).
    if(S&&S.alive!==false&&typeof S==='object'){
      const rng=stream(world,year,'subject');
      const scrutiny=Number.isFinite(Number(S.scrutiny))?Number(S.scrutiny):0;
      const freedom=Number.isFinite(Number(S.freedom))?Number(S.freedom):0;
      // The already-watched are watched harder, but only sometimes.
      if(scrutiny>WATCHED_THRESHOLD && rng.chance(clamp(g.scrutinyPressure*0.6,0,1))){
        const bump=1+Math.floor(rng.range(0,SCRUTINY_BUMP_MAX));
        S.scrutiny=clamp(scrutiny+bump,0,100);
        result.chips.push({txt:'+'+bump+' SCRUTINY (the eye tightens on the already-watched)',plus:false});
        notes.push('scrutiny '+bump);
      }
      // A weak regime grips harder — freedom costs more.
      if(g.legitimacy<WEAK_REGIME_THRESHOLD){
        const bump=1+Math.floor(rng.range(0,FREEDOM_BUMP_MAX));
        S.freedom=clamp(freedom-bump,0,100);
        result.chips.push({txt:'−'+bump+' FREEDOM (the grip tightens)',plus:false});
        notes.push('freedom -'+bump);
      }
    }

    const logNote='Posture: surveillance '+g.surveillancePosture.toFixed(2)+
      ', legitimacy '+g.legitimacy.toFixed(2)+
      ', propaganda '+g.propaganda.toFixed(2)+
      (notes.length?('; '+notes.join(', ')):'');
    g.history.push({year,type:'posture',note:logNote});
    if(g.history.length>HISTORY_LIMIT) g.history=g.history.slice(-HISTORY_LIMIT);
    g.lastTickYear=year;
    return result;
  }

  function summary(world){
    const g=ensure(world);
    return {
      regime:g.regime,
      legitimacy:g.legitimacy,
      propaganda:g.propaganda,
      surveillancePosture:g.surveillancePosture,
      scrutinyPressure:g.scrutinyPressure,
      label:summaryLabel(world),
      entries:g.history.length
    };
  }

  function checkInvariants(world){
    const g=ensure(world);
    const issues=[];
    if(!REGIMES.includes(g.regime)) issues.push('government.regime invalid: '+g.regime);
    if(!Number.isFinite(Number(g.legitimacy))||g.legitimacy<LEGITIMACY_MIN||g.legitimacy>LEGITIMACY_MAX) issues.push('government.legitimacy out of bounds');
    if(!Number.isFinite(Number(g.propaganda))||g.propaganda<PROPAGANDA_MIN||g.propaganda>PROPAGANDA_MAX) issues.push('government.propaganda out of bounds');
    if(!Number.isFinite(Number(g.surveillancePosture))||g.surveillancePosture<POSTURE_MIN||g.surveillancePosture>POSTURE_MAX) issues.push('government.surveillancePosture out of bounds');
    if(!Number.isFinite(Number(g.scrutinyPressure))||g.scrutinyPressure<PRESSURE_MIN||g.scrutinyPressure>PRESSURE_MAX) issues.push('government.scrutinyPressure out of bounds');
    if(!Array.isArray(g.history)) issues.push('government.history must be an array');
    else if(g.history.length>HISTORY_LIMIT) issues.push('government.history exceeds bound');
    return issues;
  }

  root.GovernmentSystem={
    SCHEMA_VERSION, SUBSYSTEM, REGIMES, HISTORY_LIMIT,
    WEAK_REGIME_THRESHOLD, WATCHED_THRESHOLD,
    ensure, migrate, tickWorld, computePosture, readSurveillance,
    summaryLabel, summary, checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
