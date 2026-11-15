'use strict';

/* Workplace life (Phase 4C-6).
 *
 * Owns the annual workplace-life simulation for every active/on_leave
 * employment contract: stress dynamics, safety incidents, interpersonal
 * bonds/conflicts (recorded through RelationshipMemory -- never a second
 * relationship store), misconduct strikes, and burnout/medical leave
 * transitions (via EmploymentSystem.beginLeave/endLeave feeding
 * ContractRecord.status='on_leave').
 *
 * Authority rules:
 * - Contract fields live on the contract record; this system mutates ONLY
 *   contract.workplace.* and calls EmploymentSystem APIs for status changes
 *   and terminations. It never writes performance/satisfaction directly --
 *   those stay single-writer inside EmploymentSystem.reviewContract (which
 *   consumes workplace.stress as a small bias).
 * - Person-to-person state goes through RelationshipMemory.add/modifier.
 * - Medical consequences go through MedicalSystem.addCondition.
 * - All annual rolls draw from WorldSimulation.streamFor seeded per
 *   (world.seed, year, contract.id, 'workplace-life') -- never Math.random,
 *   never the shared Random stream.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='workplace-life';

  const STRESS_HIGH_THRESHOLD=0.80;
  const LEAVE_ENTER_STRESS=0.85;
  const LEAVE_EXIT_STRESS=0.55;
  const HIGH_STRESS_YEARS_REQUIRED=2;
  const MEDICAL_LEAVE_MAX_YEARS=4;

  const SECTOR_SAFETY_RISK={
    construction:.16,
    manufacturing:.14,
    transport:.12,
    agriculture:.10,
    healthcare:.08,
    retail:.05,
    government:.04,
    professional:.04,
    education:.03,
    finance:.03
  };
  const DEFAULT_SAFETY_RISK=.06;

  const INCIDENT_KINDS=['minor_injury','serious_injury','severe_injury','strain'];
  const MAX_ROSTER_PEERS=8;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clampUnit=(value,fallback)=>Number.isFinite(Number(value))?clamp(Number(value),0,1):fallback;
  const round4=value=>Math.round(value*10000)/10000;
  const MIN_YEAR=-5000;
  const MAX_YEAR=5000;
  const boundedYear=(value,fallback)=>{
    const safe=fallback!=null&&Number.isFinite(Number(fallback))?Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(fallback)))):0;
    if(value==null||!Number.isFinite(Number(value))) return safe;
    return Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(value))));
  };
  const boundedYearOrNull=value=>value==null||!Number.isFinite(Number(value))?null:boundedYear(value,0);

  const ACTIVE_STATUSES=new Set(['active','on_leave']);

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('WorkplaceSystem.ensure requires a world object');
    world.workplaceLastTickYear=boundedYearOrNull(world.workplaceLastTickYear);
    world.workplaceSchemaVersion=SCHEMA_VERSION;
    return world;
  }

  function migrate(world){
    ensure(world);
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.normalizeWorkplace==='function'){
      root.EmploymentSystem.all(world).forEach(contract=>{
        contract.workplace=root.EmploymentSystem.normalizeWorkplace(contract.workplace);
      });
    }
    return world;
  }

  function getBusiness(world,businessId){
    return root.BusinessSystem&&typeof root.BusinessSystem.get==='function'?root.BusinessSystem.get(world,businessId):null;
  }

  function businessName(business){
    return business&&business.name?String(business.name):'the workplace';
  }

  // Derived view, never persisted: who supervises this contract and who the
  // peers are, computed from current active contracts at the same business.
  // Supervisor = highest jobTier, ties broken by lowest contract id.
  function rosterFor(world,contractId){
    const contract=root.EmploymentSystem.get(world,contractId);
    if(!contract||!ACTIVE_STATUSES.has(contract.status)) return {supervisorPersonId:null,coworkerContracts:[]};
    const peers=root.EmploymentSystem.activeForBusiness(world,contract.businessId)
      .filter(c=>c.id!==contract.id)
      .sort((a,b)=>(b.jobTier-a.jobTier)||a.id.localeCompare(b.id));
    return {
      supervisorPersonId:peers.length?peers[0].personId:null,
      coworkerContracts:peers.slice(0,MAX_ROSTER_PEERS)
    };
  }

  function personFor(world,personId,options){
    const opts=options||{};
    if(personId==='subject'){
      const subject=opts.subject||(typeof S!=='undefined'?S:null);
      return subject||null;
    }
    const npc=world.npcs&&world.npcs[personId];
    return npc&&npc.alive!==false?npc:null;
  }

  function recentIncidentPenalty(workplace,year){
    const list=Array.isArray(workplace.incidents)?workplace.incidents:[];
    const recent=list.filter(entry=>entry&&entry.year<=year&&(year-entry.year)<=3).length;
    return Math.min(.15,recent*.05);
  }

  function stressTargetFor(world,contract,business,year,roster){
    let target=.30+(clamp(contract.jobTier||1,0,5))*.02;
    if(business){
      if(business.status==='struggling') target+=.15;
      if(business.finances&&Number(business.finances.profit)<0) target+=.03;
    }
    target+=recentIncidentPenalty(contract.workplace,year);
    let conflictSum=0,trustSum=0;
    roster.coworkerContracts.slice(0,3).forEach(peer=>{
      if(!root.RelationshipMemory||typeof root.RelationshipMemory.modifier!=='function') return;
      const m=root.RelationshipMemory.modifier(world,contract.personId,peer.personId,year);
      conflictSum+=m.conflict;
      trustSum+=m.trust;
    });
    target+=clamp(conflictSum/50,-.10,.15)-clamp(trustSum/70,-.10,.10);
    target-=((Number.isFinite(Number(contract.satisfaction))?Number(contract.satisfaction):.5)-.5)*.30;
    return clamp(target,.05,.95);
  }

  function applyIncident(world,contract,wp,rng,year,opts,counts){
    const roll=rng.next();
    let kind,severity,definitionId;
    if(roll<.45){ kind='minor_injury'; severity=1+Math.floor(rng.next()*2); definitionId='injury'; }
    else if(roll<.75){ kind='serious_injury'; severity=2+Math.floor(rng.next()*2); definitionId='injury'; }
    else if(roll<.90){ kind='severe_injury'; severity=3+Math.floor(rng.next()*2); definitionId='injury'; }
    else { kind='strain'; severity=2+Math.floor(rng.next()*2); definitionId='strain'; }
    const limit=root.EmploymentSystem.WORKPLACE_INCIDENT_LIMIT||8;
    wp.incidents=(Array.isArray(wp.incidents)?wp.incidents:[])
      .concat([{year,kind}])
      .sort((a,b)=>(a.year-b.year)||(String(a.kind).localeCompare(String(b.kind))))
      .slice(-limit);
    wp.lastIncidentYear=year;
    counts.incidents++;
    const person=personFor(world,contract.personId,opts);
    if(person&&root.MedicalSystem&&typeof root.MedicalSystem.addCondition==='function'){
      root.MedicalSystem.addCondition(person,definitionId,severity,{world,year,source:'workplace accident'});
    }
  }

  function applyRelationshipEvent(world,contract,rng,year,opts,counts){
    if(!root.RelationshipMemory||typeof root.RelationshipMemory.add!=='function') return;
    const roster=rosterFor(world,contract.id);
    if(!roster.coworkerContracts.length) return;
    const peerContract=roster.coworkerContracts[Math.floor(rng.next()*roster.coworkerContracts.length)];
    if(!peerContract||peerContract.personId===contract.personId) return;
    const m=root.RelationshipMemory.modifier(world,contract.personId,peerContract.personId,year);
    const satisfaction=Number.isFinite(Number(contract.satisfaction))?Number(contract.satisfaction):.5;
    const business=getBusiness(world,contract.businessId);
    const place=businessName(business);
    const pConflict=clamp(.05+m.conflict/60+(.5-satisfaction)*.04,0,.30);
    const pBond=clamp(.08+m.trust/80+(satisfaction-.5)*.04,0,.25);
    const r=rng.next();
    if(r<pConflict){
      root.RelationshipMemory.add(world,{
        year,
        type:'workplace_conflict',
        participants:[contract.personId,peerContract.personId],
        intensity:.40,
        valence:-.55,
        summary:'A dispute at '+place+' left marks on how '+contract.personId+' and '+peerContract.personId+' work together.',
        tags:['workplace']
      });
      counts.conflicts++;
    } else if(r<pConflict+pBond){
      root.RelationshipMemory.add(world,{
        year,
        type:'workplace_bond',
        participants:[contract.personId,peerContract.personId],
        intensity:.35,
        valence:.55,
        summary:'Shared shifts at '+place+' turned '+contract.personId+' and '+peerContract.personId+' into trusted colleagues.',
        tags:['workplace']
      });
      counts.bonds++;
    }
  }

  function severeUntreatedInjury(person){
    if(!person||!root.MedicalSystem||typeof root.MedicalSystem.activeConditions!=='function') return false;
    return root.MedicalSystem.activeConditions(person).some(condition=>{
      const id=condition.definitionId;
      return (id==='injury'||id==='strain')&&condition.severity>=4&&!condition.resolved;
    });
  }

  function tickContract(world,contract,year,opts,counts){
    if(!contract.workplace||typeof contract.workplace!=='object'){
      contract.workplace=root.EmploymentSystem.normalizeWorkplace?root.EmploymentSystem.normalizeWorkplace(null):{stress:.25,highStressYears:0,lastTickYear:null,lastIncidentYear:null,strikes:0,incidents:[],leaveKind:null,leaveStartedYear:null};
    }
    const wp=contract.workplace;
    if(wp.lastTickYear===year) return;
    if(wp.lastTickYear!=null&&year<wp.lastTickYear) return;
    wp.lastTickYear=year;
    const streamFor=root.WorldSimulation&&typeof root.WorldSimulation.streamFor==='function'?root.WorldSimulation.streamFor:null;
    const rng=streamFor?streamFor(world,year,contract.id,SUBSYSTEM):root.Random.create([world.seed,year,contract.id,SUBSYSTEM].join('|'));
    const business=getBusiness(world,contract.businessId);

    if(contract.status==='on_leave'){
      // Rest recovers stress deterministically downward.
      const drift=rng.range(-.04,.02)-.22;
      wp.stress=round4(clamp(wp.stress+drift,0,1));
      const yearsOnLeave=Math.max(0,year-(wp.leaveStartedYear!=null?wp.leaveStartedYear:year));
      let canReturn=yearsOnLeave>=1;
      if(canReturn&&wp.leaveKind==='medical'&&yearsOnLeave<MEDICAL_LEAVE_MAX_YEARS){
        if(severeUntreatedInjury(personFor(world,contract.personId,opts))) canReturn=false;
      }
      if(canReturn&&(wp.stress<LEAVE_EXIT_STRESS||yearsOnLeave>=MEDICAL_LEAVE_MAX_YEARS)){
        const ended=root.EmploymentSystem.endLeave(world,contract.id,year,{subject:opts.subject});
        if(!ended||ended.changed!==false) counts.leavesEnded++;
      }
      return;
    }

    /* ---- active contract ---- */

    // 1. Stress drift toward a contextual target.
    const target=stressTargetFor(world,contract,business,year,rosterFor(world,contract.id));
    const nextStress=round4(clamp(wp.stress+(target-wp.stress)*.35+rng.range(-.06,.06),0,1));
    wp.stress=nextStress;
    wp.highStressYears=nextStress>=STRESS_HIGH_THRESHOLD?(wp.highStressYears||0)+1:0;
    counts.stressUpdates++;

    // 2. Burnout leave after repeated high-stress years.
    if(nextStress>=LEAVE_ENTER_STRESS&&wp.highStressYears>=HIGH_STRESS_YEARS_REQUIRED){
      root.EmploymentSystem.beginLeave(world,contract.id,'burnout',year,{subject:opts.subject});
      counts.leavesStarted++;
      return;
    }

    // 3. Safety incident roll (sector risk scaled by stress).
    const sectorRisk=business&&Object.prototype.hasOwnProperty.call(SECTOR_SAFETY_RISK,business.sector)?SECTOR_SAFETY_RISK[business.sector]:DEFAULT_SAFETY_RISK;
    const incidentProbability=Math.min(.35,sectorRisk*(.35+.85*nextStress));
    if(rng.next()<incidentProbability) applyIncident(world,contract,wp,rng,year,opts,counts);

    // 4. Interpersonal bond/conflict with one deterministically chosen peer.
    applyRelationshipEvent(world,contract,rng,year,opts,counts);

    // 5. Misconduct strikes: accumulate under low satisfaction/high stress,
    //    decay on clean years, dismissal at the cap (same rule for player
    //    and NPCs, routed through EmploymentSystem.dismiss).
    const satisfaction=Number.isFinite(Number(contract.satisfaction))?Number(contract.satisfaction):.5;
    const maxStrikes=root.EmploymentSystem.MAX_MISCONDUCT_STRIKES||3;
    const misconductProbability=clamp((.5-satisfaction)*.10+nextStress*.06-.02,0,.12);
    if(rng.next()<misconductProbability){
      wp.strikes=Math.min(maxStrikes,(wp.strikes||0)+1);
      counts.misconductStrikes++;
      contract.history.push({type:'misconduct_warning',year,strikes:wp.strikes});
      contract.history=contract.history.slice(-64);
      if(wp.strikes>=maxStrikes){
        root.EmploymentSystem.dismiss(world,contract.id,'misconduct',year,{subject:opts.subject});
        counts.dismissals++;
        return;
      }
    } else {
      wp.strikes=Math.max(0,(wp.strikes||0)-1);
    }

    // 6. Severe untreated occupational injury forces medical leave.
    if(severeUntreatedInjury(personFor(world,contract.personId,opts))){
      root.EmploymentSystem.beginLeave(world,contract.id,'medical',year,{subject:opts.subject});
      counts.leavesStarted++;
    }
  }

  function zeroCounts(){
    return {stressUpdates:0,incidents:0,bonds:0,conflicts:0,misconductStrikes:0,dismissals:0,leavesStarted:0,leavesEnded:0};
  }

  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const year=boundedYear(opts.year!=null?opts.year:world.year,world.year);
    const counts=zeroCounts();
    if(world.workplaceLastTickYear===year){
      return Object.assign({year,applied:false,reason:'already_applied',skipped:true},counts);
    }
    if(world.workplaceLastTickYear!=null&&year<world.workplaceLastTickYear){
      return Object.assign({year,applied:false,reason:'stale_year',skipped:true},counts);
    }
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.all==='function'){
      const contracts=root.EmploymentSystem.all(world)
        .filter(c=>ACTIVE_STATUSES.has(c.status))
        .sort((a,b)=>a.id.localeCompare(b.id));
      contracts.forEach(contract=>{ tickContract(world,contract,year,opts,counts); });
    }
    world.workplaceLastTickYear=year;
    return Object.assign({year,applied:true},counts);
  }

  // Derive the player's workplace situation from live, single-owner records.
  function laborSituation(world){
    const es=root.EmploymentSystem;
    if(!world||!es||typeof es.activeForPerson!=='function')return {available:false};
    const contract=es.activeForPerson(world,'subject')[0];
    if(!contract||contract.status!=='active'||(contract.history||[]).some(h=>h.type==='labor_dispute'&&h.year===world.year))return {available:false};
    const business=getBusiness(world,contract.businessId);
    if(!business||business.status==='closed')return {available:false};
    const peers=rosterFor(world,contract.id).coworkerContracts.filter(p=>p&&p.status==='active'&&p.personId!=='subject');
    const finance=business.finances||{};
    const margin=clamp((Number(finance.profit)||0)/Math.max(1,Number(finance.revenue)||0),-.5,.5);
    const surveillance=clampUnit(world.government&&world.government.surveillancePosture,.4);
    const trust=root.RelationshipMemory&&peers.length?peers.reduce((n,p)=>n+root.RelationshipMemory.modifier(world,'subject',p.personId,world.year).trust,0)/peers.length:0;
    const individual=round4(clamp(.25+clampUnit(contract.performance,.5)*.43+margin*.35-(business.status==='struggling'?.1:0),.08,.86));
    const collective=round4(clamp(.16+Math.min(5,peers.length)*.1+trust/110+margin*.22-surveillance*.12,.08,.85));
    return {available:true,contractId:contract.id,businessId:business.id,businessName:businessName(business),
      salary:contract.annualSalary,profit:Number(finance.profit)||0,peers:peers.length,surveillance,
      choices:[{id:'petition',label:'Request a raise',odds:individual,note:'Individual wage negotiation'},
        ...(peers.length?[{id:'organize',label:'Organize coworkers',odds:collective,note:'Collective bargaining; public scrutiny if refused'}]:[]),
        {id:'cooperate',label:'Cooperate with management',odds:1,note:'Reduce stress without a raise'}]};
  }
  function resolveLaborAction(world,options){
    const opts=options||{},ctx=laborSituation(world),strategy=String(opts.strategy||'');
    if(!ctx.available)return {ok:false,reason:'unavailable'};
    const choice=ctx.choices.find(c=>c.id===strategy);
    if(!choice||opts.year!=null&&opts.year!==world.year)return {ok:false,reason:'invalid_choice'};
    const es=root.EmploymentSystem,c=es.get(world,ctx.contractId),b=getBusiness(world,ctx.businessId),year=world.year;
    const peers=rosterFor(world,c.id).coworkerContracts.filter(p=>p.status==='active'&&p.personId!=='subject').slice(0,5);
    const success=strategy==='cooperate'||root.WorldSimulation.streamFor(world,year,c.id,'labor-action-'+strategy).next()<choice.odds;
    const before=c.annualSalary;let peersRaised=0,attention=0,unrest=0;
    const grant=(contract,rate,min)=>{const old=contract.annualSalary;es.adjustSalary(world,contract.id,Math.min(5000000,old+Math.max(min,Math.round(old*rate))),'labor_'+strategy,year);return contract.annualSalary>old;};
    if(strategy==='petition'){
      if(success){grant(c,.075,60);c.workplace.stress=round4(clamp(c.workplace.stress-.045,0,1));}
      else c.workplace.stress=round4(clamp(c.workplace.stress+.055,0,1));
    }else if(strategy==='organize'){
      if(success){grant(c,.05,45);peers.forEach(p=>{if(grant(p,.05,45))peersRaised++;});c.workplace.stress=round4(clamp(c.workplace.stress-.065,0,1));unrest=-.025;}
      else{c.workplace.stress=round4(clamp(c.workplace.stress+.10,0,1));unrest=.07;attention=8;}
    }else c.workplace.stress=round4(clamp(c.workplace.stress-.12,0,1));
    if(unrest&&root.WorldSimulation.applyUnrestShock)root.WorldSimulation.applyUnrestShock(world,b.settlementId,unrest);
    if(attention&&opts.subject)opts.subject.scrutiny=clamp((Number(opts.subject.scrutiny)||0)+attention,0,100);
    const other=strategy==='organize'?(peers[0]&&peers[0].personId):(b.ownerNpcId&&b.ownerNpcId!=='subject'?b.ownerNpcId:(peers[0]&&peers[0].personId));
    if(other&&root.RelationshipMemory)root.RelationshipMemory.add(world,{year,type:'labor_bargaining',participants:['subject',other],
      intensity:.7,valence:strategy==='cooperate'?.3:success?.6:-.6,decay:.025,summary:'Labor negotiations at '+businessName(b)+': '+strategy, tags:['workplace','labor']});
    c.history.push({type:'labor_dispute',year,strategy,success,salaryBefore:before,salaryAfter:c.annualSalary,peersRaised});c.history=c.history.slice(-64);
    const text=strategy==='cooperate'?'Cooperated with management: workplace stress fell, salary unchanged.'
      :success?'Wage negotiation accepted at '+businessName(b)+'. Your annual pay: $'+before+' to $'+c.annualSalary+
        (strategy==='organize'?'; '+peersRaised+' coworkers received raises.':'')+' Employer payroll will reflect the change next year.'
      :strategy==='organize'?'Collective demand rejected. Stress, public unrest, and Bureau scrutiny rose.':'Individual raise refused. Workplace stress rose.';
    return {ok:true,strategy,success,peersRaised,attention,unrest,salaryBefore:before,salaryAfter:c.annualSalary,text,fx:{happiness:strategy==='cooperate'?2:success?4:-4}};
  }

  function summary(world,options){
    ensure(world);
    const result={active:0,onLeave:0,averageStress:0,totalIncidents:0,totalStrikes:0,onLeaveBurnout:0,onLeaveMedical:0};
    if(!root.EmploymentSystem||typeof root.EmploymentSystem.activeForPerson!=='function') return result;
    let stressSum=0,stressN=0;
    root.EmploymentSystem.all(world).forEach(contract=>{
      if(!ACTIVE_STATUSES.has(contract.status)) return;
      const wp=contract.workplace&&typeof contract.workplace==='object'?contract.workplace:{};
      if(contract.status==='on_leave'){
        result.onLeave++;
        if(wp.leaveKind==='burnout') result.onLeaveBurnout++;
        else if(wp.leaveKind==='medical') result.onLeaveMedical++;
      } else {
        result.active++;
      }
      stressSum+=clampUnit(wp.stress,.25); stressN++;
      result.totalIncidents+=Array.isArray(wp.incidents)?wp.incidents.length:0;
      result.totalStrikes+=wp.strikes||0;
    });
    result.averageStress=stressN?round4(stressSum/stressN):0;
    return result;
  }

  function checkInvariants(world){
    const issues=[];
    if(!world||typeof world!=='object') return ['world must be an object'];
    if(typeof world.workplaceSchemaVersion!=='number'||world.workplaceSchemaVersion!==SCHEMA_VERSION) issues.push('workplaceSchemaVersion must be '+SCHEMA_VERSION);
    const tickYear=world.workplaceLastTickYear;
    if(tickYear!=null&&(typeof tickYear!=='number'||!Number.isFinite(tickYear)||!Number.isInteger(tickYear)||tickYear<MIN_YEAR||tickYear>MAX_YEAR)){
      issues.push('workplaceLastTickYear must be null or a bounded integer');
    }
    if(root.EmploymentSystem&&typeof root.EmploymentSystem.normalizeWorkplace==='function'&&typeof root.EmploymentSystem.all==='function'){
      root.EmploymentSystem.all(world).forEach(contract=>{
        const wp=contract.workplace;
        if(!wp||typeof wp!=='object'||Array.isArray(wp)){
          issues.push('employment contract '+contract.id+' is missing its workplace object');
          return;
        }
        const expected=root.EmploymentSystem.normalizeWorkplace(wp);
        if(JSON.stringify(expected)!==JSON.stringify(wp)){
          issues.push('employment contract '+contract.id+' workplace object is not in normalized form');
        }
        if(ACTIVE_STATUSES.has(contract.status)&&wp.lastTickYear!=null&&world.workplaceLastTickYear!=null&&wp.lastTickYear>world.workplaceLastTickYear){
          issues.push('employment contract '+contract.id+' workplace lastTickYear is ahead of the world tick year');
        }
      });
    }
    return issues;
  }

  root.WorkplaceSystem={
    SCHEMA_VERSION,
    SUBSYSTEM,
    STRESS_HIGH_THRESHOLD,
    LEAVE_ENTER_STRESS,
    LEAVE_EXIT_STRESS,
    HIGH_STRESS_YEARS_REQUIRED,
    MEDICAL_LEAVE_MAX_YEARS,
    SECTOR_SAFETY_RISK,
    INCIDENT_KINDS,
    MAX_ROSTER_PEERS,
    ensure,
    migrate,
    rosterFor,
    tickWorld,
    summary,
    laborSituation,resolveLaborAction,
    checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
