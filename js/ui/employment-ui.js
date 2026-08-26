'use strict';

/* EmploymentUI — Phase 4C-8 employer/business presentation layer.
 *
 * Read-only: renders business status, finances summaries, employee lists and
 * contract history from BusinessSystem / EmploymentSystem records. This module
 * never mutates World or S; it holds no state of its own and duplicates no
 * authoritative data (every fact on screen is read live from the systems).
 *
 * Helpers are self-contained (mirroring js/systems/persistent-people-ui.js)
 * so the module renders correctly when loaded alone in focused tests or
 * older loaders without the full page present.
 */

(function(root){
  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function money(value){
    const amount=Math.round(Number(value)||0), sign=amount<0?'-':'';
    return sign+'$'+Math.abs(amount).toLocaleString('en-US');
  }
  function system(name){
    return typeof root[name]==='object'&&root[name]?root[name]:null;
  }
  function personName(world,personId,options){
    options=options||{};
    const npc=(world&&world.npcs&&world.npcs[personId])||null;
    if(npc&&npc.name!=null&&npc.name!=='') return String(npc.name);
    if(personId==='subject') return options.subjectName||'You';
    return personId!=null?String(personId):'Unknown person';
  }
  function settlementName(world,settlementId){
    const settlement=(world&&world.settlements&&world.settlements[settlementId])||null;
    if(settlement&&settlement.name) return String(settlement.name);
    return settlementId?String(settlementId):'unknown settlement';
  }
  function statusLabel(status){
    const labels={active:'Active',struggling:'Struggling',closed:'Closed','on_leave':'On leave',terminated:'Terminated',resigned:'Resigned',retired:'Retired'};
    return labels[status]||(status?String(status):'Unknown');
  }
  function capitalize(text){
    const value=String(text==null?'':text);
    return value.charAt(0).toUpperCase()+value.slice(1);
  }
  function unavailablePanel(reasonText){
    return '<div class="employer-panel employer-panel-unavailable"><div class="employer-empty">'+esc(reasonText||'Employer records are not available in this view.')+'</div></div>';
  }

  /* Employer panel: status, finances summary, owner, staff list, vacancies.
   * Returns an HTML string; throws nothing and mutates nothing. */
  function businessPanel(world,businessId,options){
    options=options||{};
    const businessSystem=system('BusinessSystem');
    if(!businessSystem||typeof businessSystem.get!=='function'||!world||typeof world!=='object'){
      return unavailablePanel(options.unavailableText);
    }
    const business=businessSystem.get(world,businessId);
    if(!business) return unavailablePanel(options.emptyText||'No employer record was found for this workplace.');

    const employmentSystem=system('EmploymentSystem');
    const activeContracts=(employmentSystem&&typeof employmentSystem.activeForBusiness==='function')
      ?employmentSystem.activeForBusiness(world,business.id):[];
    const formerContracts=(employmentSystem&&typeof employmentSystem.forBusiness==='function')
      ?employmentSystem.forBusiness(world,business.id).filter(contract=>contract.status!=='active'&&contract.status!=='on_leave'):[];
    const finances=business.finances||{};
    const openVacancies=Array.isArray(business.vacancies)?business.vacancies.length:0;

    const metaParts=[];
    metaParts.push(esc(settlementName(world,business.settlementId)));
    if(business.foundedYear!=null) metaParts.push('founded '+esc(business.foundedYear));
    metaParts.push(esc(capitalize(business.kind))+' · '+esc(capitalize(business.sector)));

    let ownerLine='';
    if(business.ownerNpcId!=null){
      ownerLine='<div class="employer-owner">Owner · '+esc(personName(world,business.ownerNpcId,options))+'</div>';
    } else {
      ownerLine='<div class="employer-owner employer-owner-unknown">Owner · unrecorded</div>';
    }

    let financesHtml='<div class="employer-finances"><div class="ps-catlab">FINANCES</div>';
    financesHtml+='<div class="employer-finance-grid">'+
      '<div><b>CASH</b><span>'+money(finances.cash)+'</span></div>'+
      '<div><b>DEBT</b><span>'+money(finances.debt)+'</span></div>'+
      '</div>';
    if(finances.lastYear!=null){
      financesHtml+='<div class="employer-finance-year">'+esc(finances.lastYear)+' result</div>'+
        '<div class="employer-finance-grid">'+
        '<div><b>REVENUE</b><span>'+money(finances.revenue)+'</span></div>'+
        '<div><b>EXPENSES</b><span>'+money(finances.expenses)+'</span></div>'+
        '<div><b>PAYROLL</b><span>'+money(finances.payroll)+'</span></div>'+
        '<div><b>PROFIT</b><span>'+money(finances.profit)+'</span></div>'+
        '</div>';
    } else {
      financesHtml+='<div class="employer-finance-year employer-finance-none">No annual result has been recorded yet.</div>';
    }
    financesHtml+='</div>';

    const staffRows=activeContracts.slice().sort((a,b)=>personName(world,a.personId,options).localeCompare(personName(world,b.personId,options))).map(contract=>
      '<div class="employer-staff-row'+(contract.status==='on_leave'?' employer-staff-onleave':'')+'">'+
      '<b>'+esc(personName(world,contract.personId,options))+'</b>'+
      '<span>'+esc(contract.occupationName||'Worker')+' · tier '+esc(contract.jobTier)+' · '+money(contract.annualSalary)+'/yr'+
      (contract.status==='on_leave'?' · '+statusLabel('on_leave'):'')+
      '</span></div>'
    ).join('');
    let staffHtml='<div class="employer-staff"><div class="ps-catlab">STAFF <span>'+activeContracts.length+(openVacancies?' · '+openVacancies+' OPEN VACANC'+(openVacancies===1?'Y':'IES'):'')+'</span></div>'+
      (staffRows||'<div class="employer-empty">No employees are currently on staff.</div>')+'</div>';

    let historyHtml='';
    const history=Array.isArray(business.history)?business.history.slice(-3):[];
    if(history.length){
      historyHtml='<div class="employer-history"><div class="ps-catlab">RECENT RECORD</div>'+
        history.map(entry=>{
          const label=entry&&entry.type==='struggling'?'Entered struggling':entry&&entry.type==='recovered'?'Recovered':entry&&entry.type==='closed'?'Closed':entry&&entry.type==='founded'?'Founded':capitalize(entry&&entry.type);
          return '<div class="employer-history-row">'+esc(label)+(entry&&entry.year!=null?' · '+esc(entry.year):'')+'</div>';
        }).join('')+'</div>';
    }

    const formerNote=formersCount(formerContracts);

    return '<div class="employer-panel" data-business-id="'+esc(business.id)+'">'+
      '<div class="employer-head"><b class="employer-name">'+esc(business.name)+'</b>'+
      '<span class="employer-status employer-status-'+esc(business.status)+'">'+statusLabel(business.status)+'</span></div>'+
      '<div class="employer-meta">'+metaParts.join(' · ')+'</div>'+
      ownerLine+financesHtml+staffHtml+formerNote+historyHtml+
      '</div>';
  }
  function formersCount(formerContracts){
    if(!formerContracts.length) return '';
    return '<div class="employer-former"><div class="ps-catlab">PAST STAFF <span>'+formerContracts.length+'</span></div></div>';
  }

  /* Contract history view for one person: every contract they have ever held,
   * newest first, with status, dates, salary and termination reason. */
  function contractHistoryView(world,personId,options){
    options=options||{};
    const employmentSystem=system('EmploymentSystem');
    if(!employmentSystem||typeof employmentSystem.forPerson!=='function'||!world||typeof world!=='object'){
      return unavailablePanel(options.unavailableText);
    }
    const contracts=employmentSystem.forPerson(world,personId).slice()
      .sort((a,b)=>(Number(b.hiredYear)||0)-(Number(a.hiredYear)||0)||String(b.id).localeCompare(String(a.id)));
    if(!contracts.length) return '<div class="contract-history contract-history-empty"><div class="employer-empty">'+esc(options.emptyText||'No employment contracts are on file.')+'</div></div>';
    const businessSystem=system('BusinessSystem');
    const rows=contracts.map(contract=>{
      const business=businessSystem&&typeof businessSystem.get==='function'?businessSystem.get(world,contract.businessId):null;
      const employerName=business?business.name:contract.businessId;
      const years=contract.endedYear!=null
        ?esc(contract.hiredYear)+'–'+esc(contract.endedYear)
        :'since '+esc(contract.hiredYear);
      return '<div class="contract-history-row contract-status-'+esc(contract.status)+'">'+
        '<b>'+esc(contract.occupationName||'Worker')+'</b> at '+esc(employerName)+
        '<span>'+years+' · '+money(contract.annualSalary)+'/yr · '+statusLabel(contract.status)+
        (contract.terminationReason?' ('+esc(contract.terminationReason)+')':'')+
        '</span></div>';
    }).join('');
    return '<div class="contract-history">'+rows+'</div>';
  }

  /* Ownership panel for one person: every business they own (active first,
   * then closed, ids ascending), each with status, location, last annual
   * result and a running total of dividends that business paid to them.
   * Read-only like the rest of this module. */
  function ownershipPanel(world,personId,options){
    options=options||{};
    const businessSystem=system('BusinessSystem');
    if(!businessSystem||typeof businessSystem.all!=='function'||!world||typeof world!=='object'){
      return unavailablePanel(options.unavailableText);
    }
    const owned=businessSystem.all(world)
      .filter(business=>business&&business.ownerNpcId===personId)
      .sort((a,b)=>(a.status==='closed'?1:0)-(b.status==='closed'?1:0)||String(a.id).localeCompare(String(b.id)));
    if(!owned.length){
      return '<div class="ownership-panel ownership-panel-empty"><div class="employer-empty">'+
        esc(options.emptyText||'No businesses are owned by this person.')+'</div></div>';
    }
    const rows=owned.map(business=>{
      const finances=business.finances||{};
      const dividends=(Array.isArray(business.history)?business.history:[])
        .filter(entry=>entry&&entry.type==='dividend'&&entry.recipient===personId);
      const total=dividends.reduce((sum,entry)=>sum+(Number(entry&&entry.amount)||0),0);
      const last=dividends.length?dividends[dividends.length-1]:null;
      const resultLine=(finances.lastYear!=null)
        ?esc(finances.lastYear)+' result · '+money(finances.profit)+' profit'
        :'no annual result yet';
      const dividendLine=(total>0)
        ?'Dividends received: '+money(total)+
          (last&&last.year!=null?' · last '+esc(last.year)+' '+money(last.amount):'')
        :'No dividends received yet.';
      return '<div class="ownership-row ownership-status-'+esc(business.status)+'">'+
        '<b class="ownership-name">'+esc(business.name)+'</b>'+
        '<span class="employer-status employer-status-'+esc(business.status)+'">'+statusLabel(business.status)+'</span>'+
        '<span>'+esc(settlementName(world,business.settlementId))+' · '+esc(capitalize(business.kind))+' · '+esc(capitalize(business.sector))+'</span>'+
        '<span>'+resultLine+'</span>'+
        '<span class="ownership-dividend">'+dividendLine+'</span>'+
        '</div>';
    }).join('');
    return '<div class="ownership-panel"><div class="ps-catlab">BUSINESS OWNERSHIP <span>'+owned.length+'</span></div>'+rows+'</div>';
  }

  /* Workplace-life panel for one person: stress, leave status, misconduct
   * strikes and recent safety incidents from the contract's workplace record,
   * plus the colleague roster from WorkplaceSystem and recent workplace-tagged
   * relationship memories. Read-only like the rest of this module: it never
   * mutates World or S, and it only touches RelationshipMemory when a store
   * already exists (forPerson lazily creates one otherwise). */
  const LEAVE_LABELS={burnout:'Burnout leave',medical:'Medical leave'};
  const INCIDENT_LABELS={minor_injury:'Minor injury',serious_injury:'Serious injury',severe_injury:'Severe injury',strain:'Strain'};
  function clamp01(value){
    const n=Number(value);
    if(!Number.isFinite(n)) return .25;
    return Math.max(0,Math.min(1,n));
  }
  function peerTone(world,personId,peerId,year){
    const relationshipMemory=system('RelationshipMemory');
    if(!world.relationshipMemories||typeof world.relationshipMemories!=='object') return null;
    if(!relationshipMemory||typeof relationshipMemory.modifier!=='function') return null;
    const m=relationshipMemory.modifier(world,personId,peerId,year);
    const score=(Number(m&&m.trust)||0)-(Number(m&&m.conflict)||0);
    return score>6?'warm':score<-6?'strained':'cordial';
  }
  function workplaceMemories(world,personId){
    const relationshipMemory=system('RelationshipMemory');
    if(!world.relationshipMemories||typeof world.relationshipMemories!=='object') return [];
    if(!relationshipMemory||typeof relationshipMemory.forPerson!=='function') return [];
    return relationshipMemory.forPerson(world,personId)
      .filter(memory=>memory&&!memory.expired&&Array.isArray(memory.tags)&&memory.tags.includes('workplace'))
      .slice(0,3);
  }
  function workplacePanel(world,personId,options){
    options=options||{};
    const employmentSystem=system('EmploymentSystem');
    if(!employmentSystem||typeof employmentSystem.activeForPerson!=='function'||!world||typeof world!=='object'){
      return unavailablePanel(options.unavailableText);
    }
    const active=employmentSystem.activeForPerson(world,personId);
    const contract=Array.isArray(active)?active[0]:null;
    if(!contract){
      return '<div class="workplace-panel workplace-panel-empty"><div class="employer-empty">'+
        esc(options.emptyText||'No active workplace.')+'</div></div>';
    }
    const wp=contract.workplace&&typeof contract.workplace==='object'?contract.workplace:{};
    const workplaceSystem=system('WorkplaceSystem');

    let headHtml='<div class="employer-head"><b class="employer-name">';
    const businessSystem=system('BusinessSystem');
    const business=(businessSystem&&typeof businessSystem.get==='function')?businessSystem.get(world,contract.businessId):null;
    headHtml+=esc(business?business.name:contract.businessId)+'</b>';
    if(contract.status==='on_leave'){
      headHtml+='<span class="employer-status employer-status-on_leave">'+esc(LEAVE_LABELS[wp.leaveKind]||'On leave')+'</span>';
      const sinceYear=wp.leaveStartedYear!=null?' since '+esc(wp.leaveStartedYear):'';
      headHtml+='</div><div class="employer-meta">On leave'+esc(sinceYear)+'</div>';
    } else {
      headHtml+='<span class="employer-status employer-status-active">At work</span></div>';
    }

    const stress=clamp01(wp.stress);
    const pct=Math.round(stress*100);
    const stressClass=stress>=.7?' wp-stress-high':stress>=.5?' wp-stress-mid':'';
    const maxStrikes=employmentSystem.MAX_MISCONDUCT_STRIKES||3;
    let wellbeingHtml='<div class="ps-catlab">WELL-BEING</div>'+
      '<div class="wp-stress"><div class="wp-stress-track"><div class="wp-stress-fill'+stressClass+'" style="width:'+pct+'%"></div></div>'+
      '<span class="wp-stress-num">'+pct+'% stress</span></div>'+
      '<div class="wp-meta-row">Misconduct strikes · '+esc(wp.strikes||0)+' of '+esc(maxStrikes)+'</div>';
    const incidents=(Array.isArray(wp.incidents)?wp.incidents:[]).slice(-3).reverse();
    if(incidents.length){
      wellbeingHtml+='<div class="wp-incidents">'+incidents.map(entry=>
        '<div class="wp-incident-row">'+esc(entry&&entry.year!=null?entry.year:'?')+' · '+
        esc(INCIDENT_LABELS[entry&&entry.kind]||capitalize(entry&&entry.kind)||'Incident')+'</div>'
      ).join('')+'</div>';
    } else {
      wellbeingHtml+='<div class="wp-meta-row wp-meta-muted">No recorded accidents.</div>';
    }
    if(contract.status==='on_leave'&&wp.leaveKind==null){
      wellbeingHtml+='<div class="wp-meta-row wp-meta-muted">Leave reason not recorded.</div>';
    }

    let rosterHtml='';
    if(workplaceSystem&&typeof workplaceSystem.rosterFor==='function'){
      const roster=workplaceSystem.rosterFor(world,contract.id);
      const peers=Array.isArray(roster.coworkerContracts)?roster.coworkerContracts:[];
      if(roster.supervisorPersonId||peers.length){
        rosterHtml='<div class="ps-catlab">COLLEAGUES <span>'+peers.length+'</span></div>';
        if(roster.supervisorPersonId&&roster.supervisorPersonId!==personId){
          rosterHtml+='<div class="wp-peer-row wp-peer-supervisor"><b>'+esc(personName(world,roster.supervisorPersonId,options))+'</b>'+
            '<span>Senior colleague</span></div>';
        }
        rosterHtml+=peers.map(peer=>{
          if(!peer||peer.personId===personId) return '';
          const tone=peerTone(world,personId,peer.personId,world.year);
          return '<div class="wp-peer-row"><b>'+esc(personName(world,peer.personId,options))+'</b>'+
            '<span>'+esc(peer.occupationName||'Worker')+' · tier '+esc(peer.jobTier)+
            (tone?' · '+esc(tone):'')+'</span></div>';
        }).join('');
      }
    }

    const memories=workplaceMemories(world,personId);
    let memoriesHtml='';
    if(memories.length){
      memoriesHtml='<div class="ps-catlab">WORKPLACE RECORD</div>'+memories.map(memory=>
        '<div class="wp-memory-row'+(Number(memory.valence)<0?' wp-memory-bad':' wp-memory-good')+'">'+
        esc(memory.year!=null?memory.year:'?')+' · '+esc(memory.summary||capitalize(String(memory.type||'').replace(/_/g,' ')))+
        '</div>').join('');
    }

    return '<div class="workplace-panel" data-contract-id="'+esc(contract.id)+'">'+headHtml+
      wellbeingHtml+rosterHtml+memoriesHtml+'</div>';
  }

  /* Regime-posture panel (Phase 5 slice 2): the first player-facing surface
   * for the authoritarian-cruelty theme. It is a read-only readout of the
   * authoritative World.government aggregate (the state's grip expressed as
   * posture numbers, not prose). Never mutates World or S. Degrades to a
   * friendly unavailable panel when GovernmentSystem is absent. */
  function pctOf(value){ return Math.round(clamp01(value)*100); }
  function postureBar(label,value,extraClass){
    const p=pctOf(value);
    const tone=p>=66?' regime-bar-high':p>=33?' regime-bar-mid':'';
    return '<div class="regime-row'+(extraClass?(' '+esc(extraClass)):'')+'">'+
      '<span class="regime-lab">'+esc(label)+'</span>'+
      '<span class="regime-track"><span class="regime-fill'+tone+'" style="width:'+p+'%"></span></span>'+
      '<span class="regime-val">'+p+'%</span>'+
      '</div>';
  }
  /* Bureau-inquiries panel (Phase 5 slice 3): the player-facing surface for
   * the law registry. Read-only readout of the authoritative World.legalCases
   * for the subject — open inquiries and their stage, plus a running cleared/
   * guilty tally. Never mutates World or S; degrades gracefully when absent. */
  const LAW_STAGE_LABELS={reported:'Reported',investigation:'Under investigation',charged:'Charged',hearing:'Awaiting hearing',verdict:'Verdict delivered',sentence:'Sentenced',closed:'Closed'};
  function bureauInquiriesPanel(world,options){
    options=options||{};
    const law=system('LawSystem');
    if(!law||typeof law.forPerson!=='function'||!world||typeof world!=='object'){
      return unavailablePanel(options.unavailableText||'The Bureau keeps no ledger here yet.');
    }
    const personId=(options.personId==='subject'||(S&&options.personId==null))?'subject':(options.personId||'subject');
    const cases=law.forPerson(world,personId);
    if(!cases.length){
      return '<div class="bureau-panel"><div class="sec-h">BUREAU INQUIRIES <span>FORM L-7</span></div>'+
        '<div class="employer-empty">No inquiry bears the subject’s name. The Bureau is, for now, not writing.</div></div>';
    }
    const open=cases.filter(c=>c.stage!=='closed');
    const sorted=cases.slice().sort((a,b)=>(b.lastStageYear||0)-(a.lastStageYear||0));
    const rows=sorted.map(c=>{
      const tone=c.outcome==='guilty'?' bureau-row-guilty':c.outcome==='cleared'?' bureau-row-cleared':c.stage==='closed'?' bureau-row-closed':' bureau-row-open';
      const stageTxt=LAW_STAGE_LABELS[c.stage]||c.stage;
      const outcomeTxt=c.outcome?(' · '+(c.outcome==='guilty'?'Guilty':'Cleared')):'';
      return '<div class="bureau-row'+tone+'"><span class="bureau-row-cat">'+esc(c.category||'general')+'</span>'+
        '<span class="bureau-row-stage">'+esc(stageTxt)+esc(outcomeTxt)+'</span>'+
        '<span class="bureau-row-year">'+(c.lastStageYear!=null?c.lastStageYear:'?')+'</span></div>';
    }).join('');
    return '<div class="bureau-panel"><div class="sec-h">BUREAU INQUIRIES <span>FORM L-7</span></div>'+
      '<div class="bureau-sub">'+open.length+' open of '+cases.length+' filed</div>'+rows+'</div>';
  }

  /* Detention panel (Phase 5 slice 4): the player-facing surface for the
   * Bureau's arbitrary detention mechanic. Read-only readout of the
   * authoritative World.detentions for the subject — whether they are
   * currently held, for how long, and the running tally of detentions filed.
   * Never mutates World or S; degrades gracefully when DetentionSystem is
   * absent. */
  function detentionPanel(world,options){
    options=options||{};
    const detention=system('DetentionSystem');
    if(!detention||typeof detention.forPerson!=='function'||!world||typeof world!=='object'){
      return unavailablePanel(options.unavailableText||'The holding cells have no ledger here yet.');
    }
    const personId=(options.personId==='subject')?'subject':(options.personId||'subject');
    const cases=detention.forPerson(world,personId);
    const held=cases.filter(c=>c.stage==='held');
    const heldNow=held.find(c=>{
      const opened=c.openedYear!=null?c.openedYear:0;
      const until=opened+(c.term||1);
      const year=(typeof root.World==='object'&&root.World&&Number.isFinite(Number(root.World.year)))?root.World.year:0;
      return year<=until;
    })||null;
    const sorted=cases.slice().sort((a,b)=>(b.lastStageYear||b.openedYear||0)-(a.lastStageYear||a.openedYear||0));
    const rows=sorted.map(c=>{
      const tone=c.stage==='held'?' detention-row-held':' detention-row-released';
      const statusTxt=c.stage==='held'
        ?('Held · '+(c.term||1)+'y of '+(c.openedYear!=null?c.openedYear:'?'))
        :('Released '+(c.releasedYear!=null?c.releasedYear:'?'));
      return '<div class=\"detention-row'+tone+'\"><span class=\"detention-row-cat\">'+esc(c.reason||'administrative')+'</span>'+
        '<span class=\"detention-row-status\">'+esc(statusTxt)+'</span>'+
        '<span class=\"detention-row-year\">'+(c.openedYear!=null?c.openedYear:'?')+'</span></div>';
    }).join('');
    const head=heldNow
      ?'<div class=\"detention-sub detention-sub-held\">HELD BY THE BUREAU · '+(heldNow.term||1)+' year(s) from '+esc(heldNow.openedYear!=null?heldNow.openedYear:'?')+'</div>'
      :'<div class=\"detention-sub\">Not currently held</div>';
    return '<div class=\"detention-panel\"><div class=\"sec-h\">BUREAU DETENTION <span>FORM D-1</span></div>'+
      head+(rows?'<div class=\"detention-rows\">'+rows+'</div>':'<div class=\"employer-empty\">The Bureau has never taken the subject into custody.</div>')+'</div>';
  }

  function regimePanel(world,options){
    options=options||{};
    const gov=system('GovernmentSystem');
    if(!gov||typeof gov.summary!=='function'||!world||typeof world!=='object'){
      return unavailablePanel(options.unavailableText||'The regime has not yet taken its posture.');
    }
    gov.ensure(world);
    const summary=gov.summary(world);
    const s=(typeof root.S==='object'&&root.S)?root.S:null;
    let html='<div class="regime-panel"><div class="sec-h">REGIME · LIVE POSTURE <span>FORM G-1</span></div>'+
      '<div class="regime-label">'+esc(summary.label)+'</div>'+
      '<div class="regime-bars">'+
      postureBar('Legitimacy',summary.legitimacy,'regime-row-leg')+
      postureBar('Propaganda',summary.propaganda,'regime-row-prop')+
      postureBar('Surveillance',summary.surveillancePosture,'regime-row-surv')+
      postureBar('Scrutiny pressure',summary.scrutinyPressure,'regime-row-scrut')+
      '</div>';
    if(s){
      const sc=Number.isFinite(Number(s.scrutiny))?Number(s.scrutiny):0;
      const fr=Number.isFinite(Number(s.freedom))?Number(s.freedom):0;
      const scTxt=(typeof root.scrutinyLabel==='function')?scrutinyLabel(sc):'';
      const frTxt=(typeof root.freedomLabel==='function')?freedomLabel(fr):'';
      html+='<div class="regime-file"><div class="ps-catlab">YOUR FILE</div>'+
        '<div class="regime-row regime-row-file"><span class="regime-lab">Scrutiny</span>'+
        '<span class="regime-track"><span class="regime-fill regime-bar-high" style="width:'+pctOf(sc/100)+'%"></span></span>'+
        '<span class="regime-val">'+esc(sc)+' · '+esc(scTxt)+'</span></div>'+
        '<div class="regime-row regime-row-file"><span class="regime-lab">Freedom</span>'+
        '<span class="regime-track"><span class="regime-fill regime-bar-low" style="width:'+pctOf(fr/100)+'%"></span></span>'+
        '<span class="regime-val">'+esc(fr)+' · '+esc(frTxt)+'</span></div>'+
        '</div>';
    }
    const entries=Array.isArray(world.government.history)?world.government.history:[];
    if(entries.length){
      const rows=entries.slice(-6).reverse().map(entry=>
        '<div class="regime-hist-row"><span class="regime-hist-year">'+esc(entry.year!=null?entry.year:'?')+'</span>'+
        '<span class="regime-hist-note">'+esc(entry.note||capitalize(String(entry.type||'').replace(/_/g,' ')))+'</span></div>'
      ).join('');
      html+='<div class="regime-history"><div class="ps-catlab">POSTURE HISTORY <span>'+entries.length+'</span></div>'+rows+'</div>';
    }
    // Derived threat assessment: how likely the Bureau is to take notice of
    // the subject this year. Pure function of the authoritative posture; the
    // player-facing expression of slice-1's surveillance + scrutiny pressure.
    const threat=clamp01(0.55*summary.surveillancePosture+0.45*summary.scrutinyPressure);
    const threatLabel=threat>=0.66?'HIGH — the Bureau is watching':threat>=0.33?'ELEVATED — files are being cross-checked':'LOW — routine oversight';
    const threatTone=threat>=0.66?' regime-threat-high':threat>=0.33?' regime-threat-mid':' regime-threat-low';
    html+='<div class="regime-threat'+threatTone+'"><span class="regime-threat-lab">BUREAU ATTENTION</span>'+
      '<span class="regime-threat-val">'+esc(threatLabel)+'</span></div>';
    html+='</div>';
    return html;
  }

  root.EmploymentUI={esc,money,personName,settlementName,statusLabel,businessPanel,contractHistoryView,ownershipPanel,workplacePanel,bureauInquiriesPanel,detentionPanel,regimePanel};
})(typeof globalThis!=='undefined'?globalThis:this);
