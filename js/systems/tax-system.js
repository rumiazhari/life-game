'use strict';

/* ================= TAX SYSTEM (Phase 5 — slice 7, sub-phase 5D) =================
 *
 * The state must eat before it can watch. This system owns the public budget:
 * every year it extracts revenue from the productive sim that already exists
 * (business profits and payrolls recorded by BusinessSystem's annual tick, plus
 * a levy on the subject's own assets), then spends it across categories whose
 * weights are a pure function of the regime's live posture (GovernmentSystem).
 * A frightened regime taxes harder and polices more — cruelty expressed as
 * arithmetic, not gore (per the ⭐ USER DIRECTIVE).
 *
 * Owns World.publicBudget:
 *   {schemaVersion, treasury:[0,TREASURY_MAX], lastTickYear,
 *    lastRevenue:{businessTax,incomeLevy,subjectLevy,total}|null,
 *    lastSpending:{security,propaganda,health,relief,total}|null,
 *    history[]}
 *
 * Interconnection ("interconnectedness first"):
 *  - READS BusinessSystem's already-computed annual results (finances.payroll /
 *    finances.profit / finances.lastYear) — never recomputes them.
 *  - READS the live regime posture from World.government (fallback baseline
 *    when GovernmentSystem is absent) — never duplicates it.
 *  - WRITES policy into the EXISTING World.nationalModifiers keys that
 *    WorldSimulation.tick / SettlementEconomy already consume via
 *    nationalValue(): 'surveillancePressure', 'healthSupport',
 *    'employmentSupport'. Overwrite semantics: each year's budget SETS the
 *    policy line applied to the following year's settlement ticks — no
 *    accumulation, no second settlement model (Engineering Rules 5D note).
 *  - WRITES the subject's levy through S.assets only (a deduction, not an
 *    income path — no duplicate payment route is created).
 *
 * Determinism: there is NO randomness anywhere in this tick — revenue,
 * rates, weights and spending are pure arithmetic over existing authoritative
 * state, so replaying the same seed/year reproduces every cent. Same-year
 * tick is a no-op ('already_applied'); stale years are rejected
 * ('stale_year'); history is bounded; migration repairs malformed saves and
 * is byte-for-byte idempotent; checkInvariants returns strings, never throws.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='tax';
  const HISTORY_LIMIT=32;

  // Bounded-state constants (Engineering Rules: every number has a bound).
  const TREASURY_MAX=50000000;      // saturating cap on the public purse
  const MONEY_ITEM_MAX=5000000;     // per-item clamp before accumulation
  const SUBJECT_LEVY_MAX=250000;    // single-year levy ceiling on the subject
  const LEVY_FREE_FLOOR=2000;       // assets below this are not assessed

  // Extraction rates: base + hardship multiplier as legitimacy falls.
  // Documented bounds keep even a collapsed regime inside sane tax law.
  const BUSINESS_RATE_MIN=0.08, BUSINESS_RATE_MAX=0.35;
  const INCOME_RATE_MIN=0.04,   INCOME_RATE_MAX=0.25;
  const SUBJECT_RATE_MIN=0.05,  SUBJECT_RATE_MAX=0.22;
  const BASE_LEGITIMACY=0.55;     // fallback posture when government absent

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const boundedYearOrNull=v=>v==null||!Number.isFinite(Number(v))?null:Math.round(Number(v));
  const money=v=>{const n=Math.floor(finite(v,0));return Number.isFinite(n)&&n>0?Math.min(n,MONEY_ITEM_MAX):0;};
  const r2=v=>Math.round(v*100)/100;

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('TaxSystem.ensure requires a world object');
    let b=world.publicBudget;
    if(!b||typeof b!=='object'||Array.isArray(b)) b={};
    b.schemaVersion=SCHEMA_VERSION;
    b.treasury=clamp(Math.floor(finite(b.treasury,0)),0,TREASURY_MAX);
    b.lastTickYear=boundedYearOrNull(b.lastTickYear);
    b.lastRevenue=repairLedger(b.lastRevenue,['businessTax','incomeLevy','subjectLevy','total']);
    b.lastSpending=repairLedger(b.lastSpending,['security','propaganda','health','relief','total']);
    b.history=Array.isArray(b.history)?b.history.slice(-HISTORY_LIMIT):[];
    world.publicBudget=b;
    return b;
  }
  function repairLedger(v,keys){
    if(!v||typeof v!=='object'||Array.isArray(v)) return null;
    const out={};
    let ok=false;
    for(const k of keys){ out[k]=clamp(Math.floor(finite(v[k],0)),0,TREASURY_MAX); if(out[k]!==0) ok=true; }
    return ok?out:null;
  }
  function migrate(world){ return ensure(world); }

  /* ---- live extraction rates: a pure function of regime legitimacy ---- */
  function readLegitimacy(world){
    const g=world&&world.government;
    return g&&Number.isFinite(Number(g.legitimacy))?clamp(Number(g.legitimacy),0,1):BASE_LEGITIMACY;
  }
  function readPosture(world){
    const g=world&&world.government;
    const leg=readLegitimacy(world);
    return {
      legitimacy:leg,
      propaganda:g&&Number.isFinite(Number(g.propaganda))?clamp(Number(g.propaganda),0,1):BASE_LEGITIMACY*0
    };
  }
  function ratesFor(world){
    const leg=readLegitimacy(world);
    const hardship=1-leg;
    return {
      legitimacy:leg,
      business:clamp(0.12+0.18*hardship,BUSINESS_RATE_MIN,BUSINESS_RATE_MAX),
      income:clamp(0.06+0.14*hardship,INCOME_RATE_MIN,INCOME_RATE_MAX),
      subject:clamp(0.05+0.15*hardship,SUBJECT_RATE_MIN,SUBJECT_RATE_MAX)
    };
  }

  /* ---- spending policy: posture-driven weights, written as next year's line ---- */
  function spendingWeights(world){
    const p=readPosture(world);
    const leg=p.legitimacy;
    const security=0.34+0.36*(1-leg);
    const propaganda=0.14+0.26*p.propaganda;
    const health=0.22+0.10*leg;
    const relief=Math.max(1-(security+propaganda+health),0.05);
    const sum=security+propaganda+health+relief;
    return {
      security:security/sum,
      propaganda:propaganda/sum,
      health:health/sum,
      relief:relief/sum
    };
  }
  function applyPolicyModifiers(world,weights){
    if(!world||typeof world!=='object') return;
    const mods=(world.nationalModifiers&&typeof world.nationalModifiers==='object')?world.nationalModifiers:{};
    // Overwrite semantics — the budget sets the policy line the settlement sim
    // reads next year via nationalValue(). Clamped to [0,1].
    mods.surveillancePressure=r2(clamp(0.10+0.60*weights.security,0,1));
    mods.healthSupport=r2(clamp(1.6*weights.health,0,1));
    mods.employmentSupport=r2(clamp(1.6*weights.relief,0,1));
    world.nationalModifiers=mods;
  }

  /* ---- revenue: read-only over the businesses BusinessSystem already ticked ---- */
  function collectBusinessRevenue(world,rates){
    let businessTax=0,incomeLevy=0,counted=0;
    const businesses=world.businesses&&typeof world.businesses==='object'?world.businesses:null;
    if(businesses){
      const year=boundedYearOrNull(world.year);
      for(const key of Object.keys(businesses)){
        const biz=businesses[key];
        if(!biz||typeof biz!=='object'||biz.status==='closed') continue;
        const fin=biz.finances;
        if(!fin||typeof fin!=='object'||boundedYearOrNull(fin.lastYear)==null) continue;
        // Only this year's freshly ticked books feed the exchequer.
        if(year!=null&&boundedYearOrNull(fin.lastYear)!==year) continue;
        businessTax=satAdd(businessTax,Math.floor(money(fin.profit)*rates.business));
        incomeLevy=satAdd(incomeLevy,Math.floor(money(fin.payroll)*rates.income));
        counted++;
      }
    }
    return {businessTax:satClamp(businessTax),incomeLevy:satClamp(incomeLevy),counted};
  }
  const satAdd=(a,b)=>Math.min(a+b,TREASURY_MAX);
  const satClamp=v=>clamp(Math.floor(finite(v,0)),0,TREASURY_MAX);

  function assessSubjectLevy(world,subject,rates){
    if(!subject||typeof subject!=='object'||subject.alive===false) return 0;
    const assets=Math.floor(finite(subject.assets,0));
    if(assets<=LEVY_FREE_FLOOR) return 0;
    const levy=clamp(Math.floor((assets-LEVY_FREE_FLOOR)*rates.subject),0,SUBJECT_LEVY_MAX);
    if(levy<=0) return 0;
    subject.assets=Math.max(0,assets-levy); // deduction, never below zero
    return levy;
  }

  /* ---- annual tick ---- */
  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    const year=opts.year!=null?Math.round(Number(opts.year)):boundedYearOrNull(world&&world.year)||0;
    const b=world.publicBudget;
    const result={year,applied:false,chips:[],revenue:null,spending:null};
    if(b.lastTickYear===year) return Object.assign(result,{applied:false,reason:'already_applied'});
    if(b.lastTickYear!=null&&year<b.lastTickYear) return Object.assign(result,{applied:false,reason:'stale_year'});
    result.applied=true;

    const rates=ratesFor(world);

    // 1. Extract: businesses first, then the subject's own pocket.
    const bizRev=collectBusinessRevenue(world,rates);
    const subjectLevy=satClamp(assessSubjectLevy(world,S,rates));
    const totalRevenue=satClamp(bizRev.businessTax+bizRev.incomeLevy+subjectLevy);
    b.treasury=satClamp(b.treasury+totalRevenue);
    b.lastRevenue={
      businessTax:bizRev.businessTax,
      incomeLevy:bizRev.incomeLevy,
      subjectLevy:subjectLevy,
      total:totalRevenue
    };
    if(subjectLevy>0){
      result.chips.push({txt:'−$'+subjectLevy+' STATE LEVY (assessed on your assets)',plus:false});
    }

    // 2. Spend: the whole purse, split by the posture's priorities, and set
    //    next year's policy line for the settlement sim.
    const weights=spendingWeights(world);
    const spendable=b.treasury;
    const spending={};
    let spentTotal=0;
    for(const cat of Object.keys(weights)){
      const amt=spendable>0?Math.min(Math.floor(spendable*weights[cat]),spendable-spentTotal):0;
      spending[cat]=satClamp(amt);
      spentTotal=satAdd(spentTotal,amt);
    }
    spending.total=spentTotal;
    b.lastSpending=spending;
    b.treasury=satClamp(b.treasury-spentTotal);
    applyPolicyModifiers(world,weights);

    const fmt=n=>'$'+n;
    b.history.push({
      year:year,
      type:'budget',
      note:'Revenue '+fmt(totalRevenue)+' (business '+fmt(bizRev.businessTax)+
        ', payrolls '+fmt(bizRev.incomeLevy)+', levies '+fmt(subjectLevy)+
        '); spent security '+fmt(spending.security)+' · propaganda '+fmt(spending.propaganda)+
        ' · health '+fmt(spending.health)+' · relief '+fmt(spending.relief)
    });
    if(b.history.length>HISTORY_LIMIT) b.history=b.history.slice(-HISTORY_LIMIT);
    b.lastTickYear=year;
    result.revenue=b.lastRevenue;
    result.spending=b.lastSpending;
    return result;
  }

  function summary(world){
    const b=ensure(world);
    const rates=ratesFor(world);
    return {
      treasury:b.treasury,
      lastRevenue:b.lastRevenue,
      lastSpending:b.lastSpending,
      rates:{business:rates.business,income:rates.income,subject:rates.subject},
      entries:b.history.length
    };
  }

  function checkInvariants(world){
    const b=ensure(world);
    const issues=[];
    if(!Number.isFinite(Number(b.treasury))||b.treasury<0||b.treasury>TREASURY_MAX) issues.push('publicBudget.treasury out of bounds');
    if(b.lastTickYear!=null&&!Number.isFinite(Number(b.lastTickYear))) issues.push('publicBudget.lastTickYear invalid');
    for(const [name,led] of [['lastRevenue',b.lastRevenue],['lastSpending',b.lastSpending]]){
      if(led==null) continue;
      if(typeof led!=='object') issues.push('publicBudget.'+name+' malformed');
      else for(const k of Object.keys(led)){
        if(!Number.isFinite(Number(led[k]))||Number(led[k])<0||Number(led[k])>TREASURY_MAX) issues.push('publicBudget.'+name+'.'+k+' out of bounds');
      }
    }
    if(!Array.isArray(b.history)) issues.push('publicBudget.history must be an array');
    else if(b.history.length>HISTORY_LIMIT) issues.push('publicBudget.history exceeds bound');
    return issues;
  }

  root.TaxSystem={
    SCHEMA_VERSION, SUBSYSTEM, HISTORY_LIMIT,
    TREASURY_MAX, MONEY_ITEM_MAX, SUBJECT_LEVY_MAX, LEVY_FREE_FLOOR,
    BASE_LEGITIMACY,
    ensure, migrate, tickWorld, ratesFor, spendingWeights, summary, checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
