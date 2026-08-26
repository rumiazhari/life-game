'use strict';

/* ================= DISSENT SYSTEM (Phase 5 — slice 6, 5G-lite) =================
 *
 * The regime's posture does not only press down on the subject — it presses
 * on everyone, and sometimes the street answers back. This slice adds public
 * dissent: deterministic annual protest waves that rise when legitimacy sags
 * and the propaganda machine fails to drown the grievance, and a player-facing
 * decision to join them.
 *
 * Owns World.dissent / World.dissentCounter / World.dissentSchemaVersion:
 *   { waves: { [waveId]: {
 *       id, year, strength, attended, crackdown,
 *       stage ('active'|'resolved'), crushed, resolvedYear, history[] } },
 *     lastTickYear }
 *
 * One wave per year maximum (idempotent guard). Waves opened by the annual
 * tick are resolved by the NEXT annual tick: under heavy surveillance they are
 * recorded as crushed; otherwise they fade having been felt.
 *
 * Interconnection (no second authority):
 *  - wave probability/strength READ the live posture via GovernmentSystem.summary
 *    (legitimacy / propaganda / surveillancePosture / unrest);
 *  - attending expresses ONLY on the subject's legacy fields (S.scrutiny,
 *    S.freedom, S.bureauFavor) through the decision layer;
 *  - a crackdown on an attended wave can open a real Bureau inquiry through
 *    LawSystem.open (category 'sedition'), feeding the existing law -> verdict
 *    -> detention pipeline from slices 3-4. DissentSystem never writes
 *    World.government, World.legalCases, or World.detentions itself beyond
 *    asking LawSystem to open a case it owns.
 *
 * Deterministic: every roll uses WorldSimulation.streamFor(world, year, salt,
 * 'dissent'); same seed/year -> identical outcome. Same-year idempotent tick;
 * stale-year rejected; bounded history; migration repairs malformed records;
 * invariants return strings.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='dissent';
  const HISTORY_LIMIT=16;
  const ID_RE=/^dissent:\d{5,}$/;

  const STAGES=['active','resolved'];
  const ACTIVE='active';
  const RESOLVED='resolved';

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const unit=v=>clamp(finite(v,0),0,1);

  function stream(world,year,salt){
    return root.WorldSimulation&&root.WorldSimulation.streamFor
      ?root.WorldSimulation.streamFor(world,year,'dissent:'+salt,SUBSYSTEM)
      :root.Random.create([world.seed,year,'dissent:'+salt,SUBSYSTEM].join('|'));
  }

  /* Wave probability as a pure function of the live posture. A illegitimate,
   * unloved regime faces the street; propaganda buys calm; unrest fuels it. */
  function waveProbability(posture){
    const p=posture&&typeof posture==='object'?posture:{};
    const legitimacy=unit(p.legitimacy!=null?p.legitimacy:0.55);
    const propaganda=unit(p.propaganda!=null?p.propaganda:0.4);
    const unrest=unit(p.unrest!=null?p.unrest:0.3);
    return clamp(0.04+0.50*(1-legitimacy)+0.20*unrest-0.18*propaganda,0,0.6);
  }

  /* Wave strength: how many streets, how loud. Pure function of posture +
   * the year's roll (rng passed in by the caller so this stays testable). */
  function strengthRoll(rng,posture){
    const p=posture&&typeof posture==='object'?posture:{};
    const legitimacy=unit(p.legitimacy!=null?p.legitimacy:0.55);
    const unrest=unit(p.unrest!=null?p.unrest:0.3);
    const base=0.30+0.40*(1-legitimacy)+0.20*unrest+(rng?rng.range(-0.12,0.12):0);
    return clamp(base,0.1,1);
  }

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('DissentSystem.ensure requires a world object');
    let c=world.dissent;
    if(!c||typeof c!=='object'||Array.isArray(c)) c={};
    let waves=c.waves;
    if(!waves||typeof waves!=='object'||Array.isArray(waves)) waves={};
    let high=0;
    Object.keys(waves).forEach(id=>{
      const m=/^dissent:(\d+)$/.exec(id);
      if(m) high=Math.max(high,Number(m[1]));
    });
    Object.values(waves).forEach(rec=>{
      if(rec&&rec.id){ const m=/^dissent:(\d+)$/.exec(rec.id); if(m) high=Math.max(high,Number(m[1])); }
    });
    world.dissentCounter=Math.max(finite(world.dissentCounter,high),high);
    world.dissentSchemaVersion=SCHEMA_VERSION;
    const healed={};
    Object.keys(waves).sort().forEach(id=>{
      let rec=waves[id];
      if(!rec||typeof rec!=='object'||Array.isArray(rec)) rec={};
      let rid=String(rec.id||id);
      if(!ID_RE.test(rid)){
        world.dissentCounter=(world.dissentCounter||0)+1;
        rid='dissent:'+String(world.dissentCounter).padStart(5,'0');
      }
      const stage=STAGES.includes(rec.stage)?rec.stage:ACTIVE;
      healed[rid]={
        id:rid,
        year:Math.round(finite(rec.year,0)),
        strength:unit(rec.strength),
        attended:!!rec.attended,
        crackdown:typeof rec.crackdown==='boolean'?rec.crackdown:null,
        stage,
        crushed:typeof rec.crushed==='boolean'?rec.crushed:null,
        resolvedYear:rec.resolvedYear!=null?Math.round(Number(rec.resolvedYear)):null,
        history:Array.isArray(rec.history)?rec.history.slice(-HISTORY_LIMIT):[]
      };
    });
    world.dissent={waves:healed,lastTickYear:c.lastTickYear!=null?Math.round(Number(c.lastTickYear)):null};
    return world;
  }
  function migrate(world){ return ensure(world); }

  function all(world){
    ensure(world);
    return Object.values(world.dissent.waves);
  }
  function get(world,id){
    ensure(world);
    return id&&world.dissent.waves[id]?world.dissent.waves[id]:null;
  }
  function forYear(world,year){
    return all(world).filter(w=>w.year===Math.round(Number(year)));
  }
  /* The wave currently giving the player their window to act. */
  function currentWave(world,year){
    return forYear(world,year).find(w=>w.stage===ACTIVE)||null;
  }

  function open(world,spec){
    if(!world||typeof world!=='object') return null;
    ensure(world);
    spec=spec||{};
    const year=Math.round(finite(spec.year,0));
    // One wave per year: idempotent guard returns the existing record.
    const dup=forYear(world,year)[0];
    if(dup) return dup;
    world.dissentCounter=(world.dissentCounter||0)+1;
    const id='dissent:'+String(world.dissentCounter).padStart(5,'0');
    const rec={id,year,strength:unit(spec.strength),attended:false,crackdown:null,
      stage:ACTIVE,crushed:null,resolvedYear:null,
      history:[{year,type:'wave',note:'Protest wave rises · strength '+(unit(spec.strength)*100|0)+'%'}]};
    world.dissent.waves[id]=rec;
    return rec;
  }

  /* Player action surface (routed here by the attendProtest decision). Marks
   * attendance and rolls the regime's answer deterministically. A crackdown
   * is written onto the wave AND expressed on the subject's legacy fields by
   * the CALLER via the returned result; the optional LawSystem inquiry keeps
   * the whole Phase-5 pipeline interconnected. Never touches World.government. */
  function attend(world,spec){
    if(!world||typeof world!=='object') return {ok:false,reason:'no_world'};
    ensure(world);
    spec=spec||{};
    const year=Math.round(finite(spec.year,0));
    const wave=currentWave(world,year);
    if(!wave) return {ok:false,reason:'no_wave'};
    if(wave.attended) return {ok:false,reason:'already_attended',wave};
    const posture=root.GovernmentSystem&&typeof root.GovernmentSystem.summary==='function'
      ?root.GovernmentSystem.summary(world):null;
    const surveillance=unit(posture&&posture.surveillancePosture!=null?posture.surveillancePosture:0.4);
    const propaganda=unit(posture&&posture.propaganda!=null?posture.propaganda:0.4);
    const crackdownP=clamp(0.15+0.45*surveillance+0.35*wave.strength-0.10*propaganda,0.05,0.9);
    const rng=stream(world,year,'attend:'+wave.id);
    const crackdown=rng.chance(crackdownP);
    wave.attended=true;
    wave.crackdown=crackdown;
    wave.history.push({year,type:'attended',note:crackdown
      ?'Subject attended · the square was taken by force'
      :'Subject attended · the crowd held the street'});
    if(wave.history.length>HISTORY_LIMIT) wave.history=wave.history.slice(-HISTORY_LIMIT);
    let inquiry=null;
    if(crackdown&&spec.subject&&typeof root.LawSystem==='object'&&root.LawSystem&&typeof root.LawSystem.open==='function'){
      const existing=root.LawSystem.openForPerson(world,'subject').filter(c=>c.category==='sedition');
      if(!existing.length){
        inquiry=root.LawSystem.open(world,{personId:'subject',category:'sedition',openedYear:year})||null;
      }
    }
    return {ok:true,wave,crackdown,crackdownP,inquiryId:inquiry?inquiry.id:null};
  }

  /* Annual step:
   *  - resolve any still-active waves from EARLIER years (crushed under heavy
   *    surveillance, faded otherwise — deterministic, exactly once);
   *  - possibly raise this year's wave (pure function of the live posture).
   * Writes only World.dissent (+ chips for the year log). */
  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    void S; // posture-only tick: the subject is touched by decisions, not by the wave itself
    const year=opts.year!=null?Math.round(Number(opts.year)):0;
    const result={year,applied:false,opened:null,resolved:0,chips:[]};
    if(world.dissent.lastTickYear!=null&&world.dissent.lastTickYear===year) return Object.assign(result,{reason:'already_applied'});
    if(world.dissent.lastTickYear!=null&&year<world.dissent.lastTickYear) return Object.assign(result,{reason:'stale_year'});

    const posture=(root.GovernmentSystem&&typeof root.GovernmentSystem.summary==='function')
      ?root.GovernmentSystem.summary(world):null;
    const surveillance=unit(posture&&posture.surveillancePosture!=null?posture.surveillancePosture:0.4);

    // 1) Resolve earlier active waves.
    all(world).forEach(rec=>{
      if(rec.stage!==ACTIVE||rec.year>=year) return;
      rec.stage=RESOLVED;
      rec.resolvedYear=year;
      rec.crushed=surveillance>0.55;
      rec.history.push({year,type:'resolved',note:rec.crushed
        ?'The wave was crushed by surveillance and arrests'
        :'The wave faded, but it was felt'});
      if(rec.history.length>HISTORY_LIMIT) rec.history=rec.history.slice(-HISTORY_LIMIT);
      result.resolved++;
    });

    // 2) Possibly raise this year's wave.
    const p=waveProbability(posture);
    const rng=stream(world,year,'wave');
    if(rng.chance(p)){
      const strength=strengthRoll(rng,posture);
      const rec=open(world,{year,strength});
      if(rec) result.chips.push({txt:'Protest crowds fill the squares ('+rec.id+')',plus:false});
      result.opened=rec?rec.id:null;
    }

    world.dissent.lastTickYear=year;
    result.applied=true;
    return result;
  }

  function summary(world){
    ensure(world);
    const list=all(world);
    const active=list.filter(w=>w.stage===ACTIVE);
    return {count:list.length,active:active.length,stages:STAGES.slice(),
      lastActive:active.length?active[active.length-1]:null};
  }

  function checkInvariants(world){
    ensure(world);
    const issues=[];
    if(!Number.isFinite(Number(world.dissentCounter))||world.dissentCounter<0) issues.push('dissent.counter invalid');
    const seenYears=new Set();
    Object.values(world.dissent.waves).forEach(rec=>{
      if(!ID_RE.test(rec.id)) issues.push('dissent.id invalid: '+rec.id);
      if(!STAGES.includes(rec.stage)) issues.push('dissent.stage invalid: '+rec.id+' -> '+rec.stage);
      if(!(rec.strength>=0&&rec.strength<=1)) issues.push('dissent.strength out of range: '+rec.id);
      if(rec.stage===RESOLVED&&rec.crushed==null) issues.push('dissent.crushed missing on resolved: '+rec.id);
      if(rec.attended&&rec.crackdown==null) issues.push('dissent.attended without crackdown outcome: '+rec.id);
      if(seenYears.has(rec.year)) issues.push('dissent.duplicate year wave: '+rec.id+' @ '+rec.year);
      seenYears.add(rec.year);
      if(!Array.isArray(rec.history)) issues.push('dissent.history must be array: '+rec.id);
      else if(rec.history.length>HISTORY_LIMIT) issues.push('dissent.history exceeds bound: '+rec.id);
    });
    return issues;
  }

  root.DissentSystem={
    SCHEMA_VERSION, SUBSYSTEM, HISTORY_LIMIT, STAGES, ACTIVE, RESOLVED, ID_RE,
    ensure, migrate, open, get, all, forYear, currentWave, attend,
    tickWorld, waveProbability, strengthRoll, summary, checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
