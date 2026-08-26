'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createGameContext,loadGameFiles,expose}=require('./helpers/vm-loader');

// Focused Phase 4C-8 tests for js/ui/employment-ui.js: the employer panel and
// contract-history view must render real BusinessSystem/EmploymentSystem
// records, never mutate World state, and degrade gracefully when the systems
// are unavailable (older loaders, partial page loads).

function contextWithUi(files){
  const context=createGameContext();
  loadGameFiles(context,['js/systems/business-system.js','js/systems/employment-system.js','js/ui/employment-ui.js'].concat(files||[]));
  return context;
}
function runJson(context,code){
  return JSON.parse(expose(context,`(function(){${code}})()`));
}
const runRaw=(context,code)=>expose(context,`(function(){${code}})()`);
function seededWorld(context){
  // Minimal persistent-world fixture: two NPCs (the first alive non-subject
  // NPC becomes the auto-assigned owner), one created business, one hired
  // employee, and one completed annual finance result.
  expose(context,`
    globalThis.World={
      year:1904,
      businesses:{},businessCounter:0,businessSchemaVersion:0,
      employmentContracts:{},employmentContractCounter:0,employmentSchemaVersion:0,
      npcs:{
        'npc:00001':{npcId:'npc:00001',name:'Mara Vell',alive:true},
        'npc:00002':{npcId:'npc:00002',name:'Tomas Reeve',alive:true}
      },
      settlements:{kostrin:{id:'kostrin',name:'Kostrin'}}
    };
    globalThis.Business=BusinessSystem.create(World,{settlementId:'kostrin',sector:'transport',name:'Vell Freight Depot',foundedYear:1899});
    globalThis.ContractA=EmploymentSystem.hire(World,{personId:'npc:00002',businessId:Business.id,occupationName:'Cargo Clerk',annualSalary:520,jobTier:2});
    Business.finances={cash:1200,debt:300,revenue:2000,expenses:1500,payroll:900,profit:-80,lastYear:1903};
  `);
  return context;
}

test('employment-ui: businessPanel renders status, owner, staff and annual finances from the live records',()=>{
  const context=seededWorld(contextWithUi());
  const panel=runRaw(context,'return EmploymentUI.businessPanel(World,Business.id);');
  assert.match(panel,/Vell Freight Depot/,'panel shows the business name');
  assert.match(panel,/employer-status-active/,'panel carries an Active status badge');
  assert.match(panel,/Owner · Mara Vell/,'auto-assigned owner is resolved to a person name');
  assert.match(panel,/Kostrin/,'settlement resolves by name');
  assert.match(panel,/Cargo Clerk/,'employee occupation appears');
  assert.match(panel,/Tomas Reeve/,'employee name appears');
  assert.match(panel,/\$520\/yr/,'employee salary appears');
  assert.match(panel,/\$1,200/,'cash appears formatted');
  assert.match(panel,/1903 result/,'last annual year is labelled');
  assert.match(panel,/PROFIT/,'profit row exists');
  assert.match(panel,/-\$80/,'negative profit formats with a sign');
});

test('employment-ui: businessPanel reports missing annual results, unknown ids, and never mutates World',()=>{
  const context=seededWorld(contextWithUi());
  // Fixture setup (a second business) happens BEFORE the baseline snapshot so
  // any before/after delta can only come from the panel renders themselves.
  expose(context,"BusinessSystem.create(World,{settlementId:'kostrin',sector:'agriculture',name:'Southfield Cooperative'});");
  const freshId=expose(context,"Object.keys(World.businesses).find(id=>World.businesses[id].name==='Southfield Cooperative')");
  const before=expose(context,'JSON.stringify(World)');
  const panels=runJson(context,`
    return JSON.stringify([
      EmploymentUI.businessPanel(World,'business:00001'),
      EmploymentUI.businessPanel(World,'business:99999'),
      EmploymentUI.businessPanel(World,${JSON.stringify(freshId)})
    ]);
  `);
  const after=expose(context,'JSON.stringify(World)');
  assert.equal(before,after,'rendering must not mutate World state');
  assert.match(panels[0],/\$1,200/,'financed business still shows its recorded cash');
  assert.match(panels[1],/No employer record was found/,'unknown business id degrades to a friendly empty panel');
  assert.match(panels[2],/No annual result has been recorded yet/,'unticked business says so instead of presenting zeros as a year result');
});

test('employment-ui: contractHistoryView lists every contract newest-first with statuses and termination reasons',()=>{
  const context=seededWorld(contextWithUi());
  expose(context,`
    World.year=1907;
    EmploymentSystem.resign(World,ContractA.id,'moved_away',1906);
    globalThis.ContractB=EmploymentSystem.hire(World,{personId:'npc:00002',businessId:Business.id,occupationName:'Yard Master',annualSalary:760,jobTier:3,hiredYear:1907});
  `);
  const html=runRaw(context,"return EmploymentUI.contractHistoryView(World,'npc:00002');");
  assert.match(html,/Cargo Clerk/,'former contract appears');
  assert.match(html,/Yard Master/,'current contract appears');
  assert.match(html,/Resigned \(moved_away\)/,'resigned status carries its reason');
  assert.match(html,/since 1907/,'active contract shows open-ended range');
  assert.ok(html.indexOf('Yard Master')<html.indexOf('Cargo Clerk'),'newest contract sorts first');
  const empty=runRaw(context,"return EmploymentUI.contractHistoryView(World,'npc:00001',{emptyText:'NO HISTORY'});");
  assert.match(empty,/NO HISTORY/,'person with no contracts gets the configured empty text');
});

test('employment-ui: panels degrade gracefully when the backing systems are absent',()=>{
  const context=createGameContext();
  loadGameFiles(context,['js/ui/employment-ui.js']);
  const world={year:1900,npcs:{},settlements:{}};
  expose(context,'globalThis.World='+JSON.stringify(world)+';');
  const panel=runRaw(context,"return EmploymentUI.businessPanel(World,'business:00001',{unavailableText:'SYSTEMS OFFLINE'});");
  const history=runRaw(context,"return EmploymentUI.contractHistoryView(World,'subject',{unavailableText:'HISTORY OFFLINE'});");
  assert.match(panel,/SYSTEMS OFFLINE/,'businessPanel reports unavailability without throwing');
  assert.match(history,/HISTORY OFFLINE/,'contractHistoryView reports unavailability without throwing');
});

test('employment-ui: ownershipPanel lists owned businesses with dividend totals from live records',()=>{
  const context=seededWorld(contextWithUi());
  expose(context,`
    World.npcs['subject']={npcId:'subject',isSubject:true,alive:true};
    globalThis.Mine=BusinessSystem.create(World,{settlementId:'kostrin',sector:'manufacturing',name:'Reeve Works',ownerNpcId:'npc:00002',foundedYear:1903});
    Mine.finances={cash:400,debt:0,revenue:900,expenses:500,payroll:200,profit:200,lastYear:1904};
    Mine.history.push({type:'dividend',year:1904,amount:30,recipient:'npc:00002'});
    Mine.history.push({type:'dividend',year:1905,amount:45,recipient:'npc:00002'});
  `);
  const before=expose(context,'JSON.stringify(World)');
  const html=runRaw(context,"return EmploymentUI.ownershipPanel(World,'npc:00002');");
  const after=expose(context,'JSON.stringify(World)');
  assert.equal(before,after,'rendering must not mutate World state');
  assert.match(html,/BUSINESS OWNERSHIP <span>1</,'panel header carries owned count');
  assert.match(html,/Reeve Works/,'owned business name appears');
  assert.match(html,/Kostrin · \w+ · Manufacturing/,'settlement, kind and sector meta appear');
  assert.match(html,/1904 result · \$200 profit/,'last annual result line renders');
  assert.match(html,/Dividends received: \$75/,'dividend total sums across years');
  assert.match(html,/last 1905 \$45/,'most recent dividend year and amount render');
  const empty=runRaw(context,"return EmploymentUI.ownershipPanel(World,'subject',{emptyText:'NO HOLDINGS'});");
  assert.match(empty,/NO HOLDINGS/,'person with no businesses gets configured empty text');
});

test('employment-ui: ownershipPanel degrades gracefully when BusinessSystem is absent',()=>{
  const context=createGameContext();
  loadGameFiles(context,['js/ui/employment-ui.js']);
  expose(context,'globalThis.World={year:1900,npcs:{},settlements:{}};');
  const panel=runRaw(context,"return EmploymentUI.ownershipPanel(World,'subject',{unavailableText:'OWNERSHIP OFFLINE'});");
  assert.match(panel,/OWNERSHIP OFFLINE/,'reports unavailability without throwing');
});
