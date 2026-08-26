'use strict';

/* ================= LAW SYSTEM (Phase 5 — slice 3) =================
 *
 * The Bureau does not argue; it files. This is the smallest real slice of
 * the Phase 5 law registry: a persistent collection of Bureau inquiries
 * (`World.legalCases`) with a stable-ID lifecycle, an annual deterministic
 * advancement tick, and invariant checks. It is the foundation 5C/5E will
 * grow from — not yet a full justice system (no officers, no sentences
 * ledger), but every case it opens is real, referenceable, and bounded.
 *
 * Owns World.legalCases / World.legalCaseCounter / World.legalCaseSchemaVersion:
 *   { [legalCaseId]: {
 *       id, personId, category, stage, openedYear, lastStageYear,
 *       outcome, history[] } }
 *
 * Stage lifecycle (deterministic, one step per year):
 *   reported -> investigation -> charged -> hearing -> verdict -> sentence -> closed
 *
 * Interconnection (the directive's "interconnectedness first" rule): the
 * verdict outcome and the annual advancement both READ the live regime
 * posture via `GovernmentSystem.summary` — a high-surveillance, high-scrutiny
 * regime convicts more readily. The player's lived oppression (a guilty
 * verdict on the subject's own file) is expressed through `S.scrutiny`, the
 * same legacy field the regime-posture tick already writes — never a second
 * authority.
 *
 * Deterministic: the verdict roll uses WorldSimulation.streamFor(world, year,
 * caseId, 'law'); same seed/year/case -> identical outcome. Same-year
 * idempotent tick; stale-year rejected; bounded history; migration repairs
 * malformed records; invariants return strings.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='law';
  const HISTORY_LIMIT=16;
  const ID_RE=/^legal-case:\d{5,}$/;

  // Ordered lifecycle. A verdict's outcome is decided when a case reaches
  // 'verdict'; after that it is terminal and only closes.
  const STAGES=['reported','investigation','charged','hearing','verdict','sentence','closed'];
  const TERMINAL='closed';

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const boundedYearOrNull=v=>v==null||!Number.isFinite(Number(v))?null:Math.round(Number(v));

  function stageIndex(stage){ return STAGES.indexOf(stage); }

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('LawSystem.ensure requires a world object');
    let c=world.legalCases;
    if(!c||typeof c!=='object'||Array.isArray(c)) c={};
    // Reserve the high-water mark for ID allocation.
    let high=0;
    Object.keys(c).forEach(id=>{
      const m=/^legal-case:(\d+)$/.exec(id);
      if(m) high=Math.max(high,Number(m[1]));
    });
    Object.values(c).forEach(rec=>{
      if(rec&&rec.id){ const m=/^legal-case:(\d+)$/.exec(rec.id); if(m) high=Math.max(high,Number(m[1])); }
    });
    world.legalCaseCounter=Math.max(finite(world.legalCaseCounter,high),high);
    world.legalCaseSchemaVersion=SCHEMA_VERSION;
    // Heal each record.
    const healed={};
    Object.keys(c).sort().forEach(id=>{
      let rec=c[id];
      if(!rec||typeof rec!=='object'||Array.isArray(rec)) rec={};
      let rid=String(rec.id||id);
      if(!ID_RE.test(rid)){
        world.legalCaseCounter=(world.legalCaseCounter||0)+1;
        rid='legal-case:'+String(world.legalCaseCounter).padStart(5,'0');
      }
      const stage=STAGES.includes(rec.stage)?rec.stage:'reported';
      healed[rid]={
        id:rid,
        personId:typeof rec.personId==='string'&&rec.personId?rec.personId:null,
        category:typeof rec.category==='string'&&rec.category?rec.category:'general',
        stage,
        openedYear:boundedYearOrNull(rec.openedYear),
        lastStageYear:boundedYearOrNull(rec.lastStageYear),
        outcome:rec.outcome==='guilty'||rec.outcome==='cleared'?rec.outcome:null,
        history:Array.isArray(rec.history)?rec.history.slice(-HISTORY_LIMIT):[]
      };
    });
    world.legalCases=healed;
    return world;
  }
  function migrate(world){ return ensure(world); }

  function stream(world,year,salt){
    return root.WorldSimulation&&root.WorldSimulation.streamFor
      ?root.WorldSimulation.streamFor(world,year,'law:'+salt,SUBSYSTEM)
      :root.Random.create([world.seed,year,'law:'+salt,SUBSYSTEM].join('|'));
  }

  /* Open a new Bureau inquiry. Returns the new record or null when the
   * world/system is unavailable. Never overwrites an existing open case for
   * the same person+category in the same year (idempotent seeding guard). */
  function open(world,spec){
    if(!world||typeof world!=='object') return null;
    ensure(world);
    spec=spec||{};
    const personId=typeof spec.personId==='string'&&spec.personId?spec.personId:null;
    if(!personId) return null;
    const category=typeof spec.category==='string'&&spec.category?spec.category:'general';
    const year=spec.openedYear!=null?Math.round(Number(spec.openedYear)):0;
    // Avoid duplicate open cases for the same person+category (year-agnostic:
    // a live inquiry already covers it).
    const dup=Object.values(world.legalCases).find(r=>r.personId===personId&&r.category===category&&r.stage!==TERMINAL);
    if(dup) return dup;
    world.legalCaseCounter=(world.legalCaseCounter||0)+1;
    const id='legal-case:'+String(world.legalCaseCounter).padStart(5,'0');
    const rec={id,personId,category,stage:'reported',openedYear:year,lastStageYear:year,outcome:null,history:[{year,type:'opened',note:'Bureau inquiry opened: '+category}]};
    world.legalCases[id]=rec;
    return rec;
  }

  function get(world,id){
    ensure(world);
    return id&&world.legalCases[id]?world.legalCases[id]:null;
  }
  function all(world){
    ensure(world);
    return Object.values(world.legalCases);
  }
  function forPerson(world,personId){
    return all(world).filter(r=>r.personId===personId);
  }
  function openForPerson(world,personId){
    return forPerson(world,personId).filter(r=>r.stage!==TERMINAL);
  }

  /* Annual advancement: each year every non-closed case steps one stage. At
   * 'verdict' the outcome is decided deterministically from the regime
   * posture (high scrutiny => more convictions). When a 'subject' case is
   * found guilty, the verdict is expressed on S.scrutiny (bounded). */
  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    const year=opts.year!=null?Math.round(Number(opts.year)):0;
    const result={year,applied:false,advanced:0,verdicts:[]};
    if(world.legalCaseLastTickYear===year) return Object.assign(result,{applied:false,reason:'already_applied'});
    if(world.legalCaseLastTickYear!=null&&year<world.legalCaseLastTickYear) return Object.assign(result,{applied:false,reason:'stale_year'});

    // Posture drives verdict outcomes (interconnected, never duplicated).
    let posture=null;
    if(root.GovernmentSystem&&typeof root.GovernmentSystem.summary==='function') posture=root.GovernmentSystem.summary(world);
    const scrutinyPressure=posture&&Number.isFinite(Number(posture.scrutinyPressure))?posture.scrutinyPressure:0.4;

    Object.values(world.legalCases).forEach(rec=>{
      if(rec.stage===TERMINAL) return;
      const idx=stageIndex(rec.stage);
      if(idx<0||idx>=STAGES.length-1) return;
      const next=STAGES[idx+1];
      rec.stage=next;
      rec.lastStageYear=year;
      result.advanced++;
      if(next==='verdict'){
        const rng=stream(world,year,rec.id);
        // Conviction probability rises with the regime's scrutiny pressure.
        const guiltyP=clamp(0.25+0.5*scrutinyPressure,0,0.95);
        const guilty=rng.chance(guiltyP);
        rec.outcome=guilty?'guilty':'cleared';
        rec.history.push({year,type:'verdict',note:guilty?'Verdict: guilty':'Verdict: cleared'});
        result.verdicts.push({id:rec.id,outcome:rec.outcome});
        // A guilty verdict on the subject's own file is felt as scrutiny.
        if(guilty&&rec.personId==='subject'&&S&&typeof S==='object'&&S.alive!==false){
          const cur=Number.isFinite(Number(S.scrutiny))?Number(S.scrutiny):0;
          S.scrutiny=clamp(cur+6,0,100);
        }
      } else {
        rec.history.push({year,type:'stage',note:'Advanced to '+next});
      }
      if(rec.history.length>HISTORY_LIMIT) rec.history=rec.history.slice(-HISTORY_LIMIT);
    });
    world.legalCaseLastTickYear=year;
    result.applied=true;
    return result;
  }

  function summary(world){
    ensure(world);
    const list=Object.values(world.legalCases);
    const open=list.filter(r=>r.stage!==TERMINAL);
    const byStage={};
    STAGES.forEach(s=>byStage[s]=0);
    list.forEach(r=>{ if(byStage[r.stage]!=null) byStage[r.stage]++; });
    return {count:list.length,open:open.length,byStage,stages:STAGES.slice()};
  }

  function checkInvariants(world){
    ensure(world);
    const issues=[];
    if(!Number.isFinite(Number(world.legalCaseCounter))||world.legalCaseCounter<0) issues.push('legalCases.counter invalid');
    Object.values(world.legalCases).forEach(rec=>{
      if(!ID_RE.test(rec.id)) issues.push('legalCase.id invalid: '+rec.id);
      if(!STAGES.includes(rec.stage)) issues.push('legalCase.stage invalid: '+rec.id+' -> '+rec.stage);
      if(rec.personId==null) issues.push('legalCase.personId missing: '+rec.id);
      if(rec.outcome!=null&&rec.outcome!=='guilty'&&rec.outcome!=='cleared') issues.push('legalCase.outcome invalid: '+rec.id);
      if(!Array.isArray(rec.history)) issues.push('legalCase.history must be array: '+rec.id);
      else if(rec.history.length>HISTORY_LIMIT) issues.push('legalCase.history exceeds bound: '+rec.id);
    });
    return issues;
  }

  root.LawSystem={
    SCHEMA_VERSION, SUBSYSTEM, HISTORY_LIMIT, STAGES, TERMINAL, ID_RE,
    ensure, migrate, open, get, all, forPerson, openForPerson, tickWorld,
    summary, checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
