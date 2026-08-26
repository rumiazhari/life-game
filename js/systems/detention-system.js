'use strict';

/* ================= DETENTION SYSTEM (Phase 5 — slice 4) =================
 *
 * The Bureau does not explain; it detains. This is the next player-facing
 * slice of the authoritarian-cruelty theme after the law registry: arbitrary
 * administrative detention, decided deterministically from the live regime
 * posture each year. A calm regime rarely reaches for the holding cell; a
 * surveillance-heavy, high-scrutiny regime reaches often, and a citizen the
 * Bureau already watches (high S.scrutiny) — or one it has not been paid to
 * overlook (low S.bureauFavor) — is reached for sooner.
 *
 * Owns World.detentions / World.detentionCounter / World.detentionSchemaVersion:
 *   { [detentionId]: {
 *       id, personId, reason, openedYear, releasedYear,
 *       term, stage, history[] } }
 *
 * Stage lifecycle: held -> released. A detention is opened by the annual
 * intake tick; it releases automatically term years later. Only one open
 * (held) detention per person is permitted at a time (idempotent guard).
 *
 * Interconnection (the directive's "interconnectedness first" rule): the
 * intake probability READS the live regime posture via
 * GovernmentSystem.summary (surveillancePosture / scrutinyPressure) and the
 * subject's own legacy fields (S.scrutiny, S.bureauFavor). The oppression it
 * imposes is expressed through S.detainedUntil (a new bounded flag) and
 * S.freedom — the same legacy field GovernmentSystem's posture tick already
 * writes. No second authoritative fact is created.
 *
 * Deterministic: the intake and term rolls use
 * WorldSimulation.streamFor(world, year, salt, 'detention'); same seed/year
 * -> identical outcome. Same-year idempotent tick; stale-year rejected;
 * bounded history; migration repairs malformed records; invariants return
 * strings.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='detention';
  const HISTORY_LIMIT=16;
  const ID_RE=/^detention:\d{5,}$/;

  const STAGES=['held','released'];
  const HELD='held';
  const RELEASED='released';

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const boundedYearOrNull=v=>v==null||!Number.isFinite(Number(v))?null:Math.round(Number(v));

  // Detention intake probability as a pure function of the live posture and
  // the subject's standing. A watchful regime + an already-watched citizen +
  // no paid-overlook (bureauFavor) raises the odds; capped so it is never a
  // certainty and never absurdly frequent.
  function intakeProbability(posture,subject){
    const scrutin=posture&&Number.isFinite(Number(posture.scrutinyPressure))?posture.scrutinyPressure:0.4;
    const surveillance=posture&&Number.isFinite(Number(posture.surveillancePosture))?posture.surveillancePosture:0.4;
    const s=subject&&typeof subject==='object'?subject:{};
    const subjectScrutiny=Number.isFinite(Number(s.scrutiny))?Number(s.scrutiny):0;
    const bureauFavor=Number.isFinite(Number(s.bureauFavor))?Number(s.bureauFavor):0;
    return clamp(0.04+0.30*scrutin+0.10*surveillance+0.0015*subjectScrutiny-0.12*bureauFavor,0,0.5);
  }

  function stream(world,year,salt){
    return root.WorldSimulation&&root.WorldSimulation.streamFor
      ?root.WorldSimulation.streamFor(world,year,'detention:'+salt,SUBSYSTEM)
      :root.Random.create([world.seed,year,'detention:'+salt,SUBSYSTEM].join('|'));
  }

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('DetentionSystem.ensure requires a world object');
    let c=world.detentions;
    if(!c||typeof c!=='object'||Array.isArray(c)) c={};
    let high=0;
    Object.keys(c).forEach(id=>{
      const m=/^detention:(\d+)$/.exec(id);
      if(m) high=Math.max(high,Number(m[1]));
    });
    Object.values(c).forEach(rec=>{
      if(rec&&rec.id){ const m=/^detention:(\d+)$/.exec(rec.id); if(m) high=Math.max(high,Number(m[1])); }
    });
    world.detentionCounter=Math.max(finite(world.detentionCounter,high),high);
    world.detentionSchemaVersion=SCHEMA_VERSION;
    const healed={};
    Object.keys(c).sort().forEach(id=>{
      let rec=c[id];
      if(!rec||typeof rec!=='object'||Array.isArray(rec)) rec={};
      let rid=String(rec.id||id);
      if(!ID_RE.test(rid)){
        world.detentionCounter=(world.detentionCounter||0)+1;
        rid='detention:'+String(world.detentionCounter).padStart(5,'0');
      }
      const stage=STAGES.includes(rec.stage)?rec.stage:HELD;
      healed[rid]={
        id:rid,
        personId:typeof rec.personId==='string'&&rec.personId?rec.personId:null,
        reason:typeof rec.reason==='string'&&rec.reason?rec.reason:'administrative',
        openedYear:boundedYearOrNull(rec.openedYear),
        releasedYear:boundedYearOrNull(rec.releasedYear),
        term:Math.max(1,Math.round(finite(rec.term,1))),
        stage,
        history:Array.isArray(rec.history)?rec.history.slice(-HISTORY_LIMIT):[]
      };
    });
    world.detentions=healed;
    return world;
  }
  function migrate(world){ return ensure(world); }

  function open(world,spec){
    if(!world||typeof world!=='object') return null;
    ensure(world);
    spec=spec||{};
    const personId=typeof spec.personId==='string'&&spec.personId?spec.personId:null;
    if(!personId) return null;
    // One open (held) detention per person at a time.
    const dup=Object.values(world.detentions).find(r=>r.personId===personId&&r.stage===HELD);
    if(dup) return dup;
    const year=spec.openedYear!=null?Math.round(Number(spec.openedYear)):0;
    const term=Math.max(1,Math.round(finite(spec.term,1)));
    world.detentionCounter=(world.detentionCounter||0)+1;
    const id='detention:'+String(world.detentionCounter).padStart(5,'0');
    const rec={id,personId,reason:typeof spec.reason==='string'&&spec.reason?spec.reason:'administrative',
      openedYear:year,releasedYear:null,term,stage:HELD,
      history:[{year,type:'detained',note:'Administrative detention: '+(spec.reason||'administrative')}]};
    world.detentions[id]=rec;
    return rec;
  }

  function get(world,id){
    ensure(world);
    return id&&world.detentions[id]?world.detentions[id]:null;
  }
  function all(world){
    ensure(world);
    return Object.values(world.detentions);
  }
  function forPerson(world,personId){
    return all(world).filter(r=>r.personId===personId);
  }
  function openForPerson(world,personId){
    return forPerson(world,personId).filter(r=>r.stage===HELD);
  }
  // The detention currently binding the subject this year (if any).
  function activeForPerson(world,personId,year){
    return openForPerson(world,personId).find(r=>{
      const opened=r.openedYear!=null?r.openedYear:0;
      const until=opened+(r.term||1);
      return year<=until;
    })||null;
  }

  /* Annual intake + release. Each year:
   *  - any held detention whose term has elapsed is released (freedom
   *    partially returned, exactly once);
   *  - if the subject is not already held, an intake roll (pure function of
   *    posture + the subject's standing) may open a new detention and express
   *    it on S.detainedUntil + S.freedom (bounded, deterministic). */
  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    const year=opts.year!=null?Math.round(Number(opts.year)):0;
    const result={year,applied:false,intakes:0,releases:0,chips:[]};
    if(world.detentionLastTickYear===year) return Object.assign(result,{applied:false,reason:'already_applied'});
    if(world.detentionLastTickYear!=null&&year<world.detentionLastTickYear) return Object.assign(result,{applied:false,reason:'stale_year'});

    const posture=(root.GovernmentSystem&&typeof root.GovernmentSystem.summary==='function'&&typeof world!=='undefined'&&world)
      ?root.GovernmentSystem.summary(world):null;

    // 1) Release any detention whose term has elapsed.
    Object.values(world.detentions).forEach(rec=>{
      if(rec.stage!==HELD) return;
      const opened=rec.openedYear!=null?rec.openedYear:0;
      if(year>=opened+(rec.term||1)){
        rec.stage=RELEASED;
        rec.releasedYear=year;
        rec.history.push({year,type:'released',note:'Released after '+(rec.term||1)+' year(s) held'});
        result.releases++;
        if(rec.history.length>HISTORY_LIMIT) rec.history=rec.history.slice(-HISTORY_LIMIT);
        // A released citizen recovers a little liberty (bounded).
        if(S&&S.alive!==false&&typeof S==='object'){
          const freedom=Number.isFinite(Number(S.freedom))?Number(S.freedom):0;
          S.freedom=clamp(freedom+3,0,100);
        }
      }
    });

    // 2) Intake: only if the subject is not currently held.
    if(S&&S.alive!==false&&typeof S==='object'){
      const alreadyHeld=activeForPerson(world,'subject',year);
      if(!alreadyHeld){
        const p=intakeProbability(posture,S);
        const rng=stream(world,year,'intake');
        if(rng.chance(p)){
          const term=1+Math.floor(rng.range(0,2)); // 1 or 2 years
          const rec=open(world,{personId:'subject',reason:'administrative',openedYear:year,term});
          // Express the detention on the subject's legacy file (bounded).
          S.detainedUntil=year+term;
          const freedom=Number.isFinite(Number(S.freedom))?Number(S.freedom):0;
          S.freedom=clamp(freedom-4*term,0,100);
          result.intakes++;
          result.chips.push({txt:'Detained by the Bureau for '+(term===1?'a year':term+' years')+' ('+rec.id+')',plus:false});
        }
      }
    }

    if(result.chips.length>HISTORY_LIMIT) result.chips=result.chips.slice(-HISTORY_LIMIT);
    world.detentionLastTickYear=year;
    result.applied=true;
    return result;
  }

  function summary(world){
    ensure(world);
    const list=Object.values(world.detentions);
    const open=list.filter(r=>r.stage===HELD);
    const byStage={};
    STAGES.forEach(s=>byStage[s]=0);
    list.forEach(r=>{ if(byStage[r.stage]!=null) byStage[r.stage]++; });
    return {count:list.length,open:open.length,byStage,stages:STAGES.slice()};
  }

  function checkInvariants(world){
    ensure(world);
    const issues=[];
    if(!Number.isFinite(Number(world.detentionCounter))||world.detentionCounter<0) issues.push('detentions.counter invalid');
    Object.values(world.detentions).forEach(rec=>{
      if(!ID_RE.test(rec.id)) issues.push('detention.id invalid: '+rec.id);
      if(!STAGES.includes(rec.stage)) issues.push('detention.stage invalid: '+rec.id+' -> '+rec.stage);
      if(rec.personId==null) issues.push('detention.personId missing: '+rec.id);
      if(!Number.isFinite(Number(rec.term))||rec.term<1) issues.push('detention.term invalid: '+rec.id);
      if(rec.stage===RELEASED&&rec.releasedYear==null) issues.push('detention.releasedYear missing: '+rec.id);
      if(!Array.isArray(rec.history)) issues.push('detention.history must be array: '+rec.id);
      else if(rec.history.length>HISTORY_LIMIT) issues.push('detention.history exceeds bound: '+rec.id);
    });
    return issues;
  }

  root.DetentionSystem={
    SCHEMA_VERSION, SUBSYSTEM, HISTORY_LIMIT, STAGES, HELD, RELEASED, ID_RE,
    ensure, migrate, open, get, all, forPerson, openForPerson, activeForPerson,
    tickWorld, intakeProbability, summary, checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
