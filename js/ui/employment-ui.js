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

  root.EmploymentUI={esc,money,personName,settlementName,statusLabel,businessPanel,contractHistoryView,ownershipPanel};
})(typeof globalThis!=='undefined'?globalThis:this);
