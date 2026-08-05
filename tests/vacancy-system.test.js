'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function freshWorld(){
  const context=createWorldContext();
  expose(context,`World={year:1930,seed:'test-seed',settlements:{}};BusinessSystem.ensure(World);EmploymentSystem.ensure(World);VacancySystem.ensure(World);`);
  return context;
}

function withBusiness(context,spec){
  return expose(context,`(function(){ return JSON.stringify(BusinessSystem.create(World,${JSON.stringify(spec)})); })()`);
}

test('ensure initializes state',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ return JSON.stringify({v:World.vacancies,c:World.vacancyCounter,s:World.vacancySchemaVersion,t:World.vacancyLastTickYear}); })()`);
  const parsed=JSON.parse(result);
  assert.deepEqual(parsed.v,{});
  assert.equal(parsed.c,0);
  assert.equal(parsed.s,1);
  assert.equal(parsed.t,null);
});

test('counter normalization repairs invalid values',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ World.vacancyCounter='bad'; VacancySystem.ensure(World); return World.vacancyCounter; })()`);
  assert.equal(result,0);
});

test('vacancyLastTickYear normalization repairs invalid values',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ World.vacancyLastTickYear='bad'; VacancySystem.ensure(World); return World.vacancyLastTickYear; })()`);
  assert.equal(result,null);
});

test('create generates sequential stable IDs',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const a=VacancySystem.create(World,{businessId:'${business.id}',occupationType:'job',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    const b=VacancySystem.create(World,{businessId:'${business.id}',occupationType:'job',occupationName:'Clerk 2',jobTier:1,annualSalary:1000});
    return JSON.stringify([a.id,b.id]);
  })()`);
  const [a,b]=JSON.parse(result);
  assert.equal(a,'vacancy:00001');
  assert.equal(b,'vacancy:00002');
});

test('create requires an existing business',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ try { VacancySystem.create(World,{businessId:'business:99999',occupationType:'job',occupationName:'X',jobTier:1,annualSalary:1}); return 'no-throw'; } catch(e){ return e.message; } })()`);
  assert.match(result,/existing business/i);
});

test('create rejects closed business',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    BusinessSystem.close(World,'${business.id}','test',1930);
    try { VacancySystem.create(World,{businessId:'${business.id}',occupationType:'job',occupationName:'X',jobTier:1,annualSalary:1}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/closed/i);
});

test('settlement derives from business, not caller',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const v=VacancySystem.create(World,{businessId:'${business.id}',settlementId:'other',occupationType:'job',occupationName:'X',jobTier:1,annualSalary:1});
    return v.settlementId;
  })()`);
  assert.equal(result,'branec');
});

test('negative salary rejects',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    try { VacancySystem.create(World,{businessId:'${business.id}',occupationType:'job',occupationName:'X',jobTier:1,annualSalary:-5}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/annualSalary/i);
});

test('open inserts business vacancy ID exactly once',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    const b=BusinessSystem.get(World,'${business.id}');
    return JSON.stringify(b.vacancies);
  })()`);
  assert.deepEqual(JSON.parse(result),['vacancy:00001']);
});

test('open rejects duplicate open role at same business',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    try { VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/duplicate/i);
});

test('open enforces business open-vacancy cap',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    for(let i=0;i<3;i++) VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'role'+i,occupationName:'Role'+i,jobTier:1,annualSalary:1000});
    try { VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'role4',occupationName:'Role4',jobTier:1,annualSalary:1000}); return 'no-throw'; } catch(e){ return e.message; }
  })()`);
  assert.match(result,/cap/i);
});

test('withdraw removes business reference and is idempotent',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    VacancySystem.withdraw(World,v.id,'test',1930);
    VacancySystem.withdraw(World,v.id,'test2',1931);
    const b=BusinessSystem.get(World,'${business.id}');
    const record=VacancySystem.get(World,v.id);
    return JSON.stringify({vacancies:b.vacancies,status:record.status,reason:record.closedReason});
  })()`);
  const parsed=JSON.parse(result);
  assert.deepEqual(parsed.vacancies,[]);
  assert.equal(parsed.status,'withdrawn');
  assert.equal(parsed.reason,'test');
});

test('expiry only occurs after expiresYear',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,openedYear:1930,expiresYear:1932});
    VacancySystem.expire(World,v.id,1931);
    const notYet=VacancySystem.get(World,v.id).status;
    VacancySystem.expire(World,v.id,1933);
    const now=VacancySystem.get(World,v.id).status;
    return JSON.stringify({notYet,now});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.notYet,'open');
  assert.equal(parsed.now,'expired');
});

test('business close withdraws open vacancies',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    BusinessSystem.close(World,'${business.id}','insolvency',1930);
    return VacancySystem.get(World,v.id).status;
  })()`);
  assert.equal(result,'withdrawn');
});

test('target worker count respects lower bound',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){ return VacancySystem.targetWorkers(World,BusinessSystem.get(World,'${business.id}')); })()`);
  assert.ok(result>=1);
});

test('closed business has zero target workers',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    BusinessSystem.close(World,'${business.id}','insolvency',1930);
    return VacancySystem.targetWorkers(World,BusinessSystem.get(World,'${business.id}'));
  })()`);
  assert.equal(result,0);
});

test('public/nonprofit businesses have a minimum target of 2',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'government',kind:'public'}));
  const result=expose(context,`(function(){ return VacancySystem.targetWorkers(World,BusinessSystem.get(World,'${business.id}')); })()`);
  assert.ok(result>=2);
});

test('candidate templates do not mutate CAREERS/JOBLIST',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const before=JSON.stringify(CAREERS);
    const templates=VacancySystem.candidateTemplates(World,BusinessSystem.get(World,'${business.id}'));
    templates.forEach(t=>{ t.skills.mutated=true; t.occupationName='mutated'; });
    const after=JSON.stringify(CAREERS);
    return before===after?'unchanged':'mutated';
  })()`);
  assert.equal(result,'unchanged');
});

test('candidate templates follow sector mapping (healthcare -> medicine)',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const templates=VacancySystem.candidateTemplates(World,BusinessSystem.get(World,'${business.id}'));
    return templates.some(t=>t.occupationType==='career'&&t.occupationId==='medicine')?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

test('generation does not create duplicate role keys at one business',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    VacancySystem.generateForBusiness(World,b,{year:1930});
    const open=VacancySystem.openVacancies(World,{businessId:b.id});
    const keys=open.map(v=>v.occupationType+'|'+v.occupationId+'|'+v.careerStage+'|'+v.jobTier);
    return new Set(keys).size===keys.length?'unique':'duplicate';
  })()`);
  assert.equal(result,'unique');
});

test('generation is deterministic for identical state',()=>{
  const context1=freshWorld();
  const b1=JSON.parse(withBusiness(context1,{settlementId:'branec',sector:'retail',kind:'public'}));
  const r1=expose(context1,`(function(){
    const b=BusinessSystem.get(World,'${b1.id}');
    const created=VacancySystem.generateForBusiness(World,b,{year:1930});
    return JSON.stringify(created.map(v=>v.occupationName));
  })()`);

  const context2=freshWorld();
  const b2=JSON.parse(withBusiness(context2,{settlementId:'branec',sector:'retail',kind:'public'}));
  const r2=expose(context2,`(function(){
    const b=BusinessSystem.get(World,'${b2.id}');
    const created=VacancySystem.generateForBusiness(World,b,{year:1930});
    return JSON.stringify(created.map(v=>v.occupationName));
  })()`);
  assert.equal(r1,r2);
});

test('losing struggling business does not generate new vacancies',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.status='struggling'; b.finances.profit=-100;
    const created=VacancySystem.generateForBusiness(World,b,{year:1930});
    return created.length;
  })()`);
  assert.equal(result,0);
});

test('generation subtracts active employees from target',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    EmploymentSystem.hire(World,{personId:'npc:1',businessId:b.id,occupationType:'job',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    const withOne=VacancySystem.targetWorkers(World,b)-1;
    const created=VacancySystem.generateForBusiness(World,b,{year:1930});
    return created.length<=Math.max(0,withOne)+1?'ok':'too-many';
  })()`);
  assert.equal(result,'ok');
});

test('same-year tick is a no-op',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    VacancySystem.tickWorld(World,{year:1930});
    const second=VacancySystem.tickWorld(World,{year:1930});
    return JSON.stringify(second);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,false);
  assert.equal(parsed.reason,'already_applied');
});

test('stale-year tick is a no-op',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    VacancySystem.tickWorld(World,{year:1930});
    const stale=VacancySystem.tickWorld(World,{year:1929});
    return JSON.stringify(stale);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,false);
  assert.equal(parsed.reason,'stale_year');
});

test('tickWorld generates vacancies deterministically for seeded businesses',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const r=VacancySystem.tickWorld(World,{year:1930});
    return JSON.stringify(r);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.applied,true);
  assert.ok(parsed.open>=0);
});

test('summary counts vacancies by status',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    const s=VacancySystem.summary(World);
    return JSON.stringify(s);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.total,1);
  assert.equal(parsed.open,1);
});

test('WorldSimulation.migrate initializes vacancy state',()=>{
  const context=createWorldContext();
  expose(context,`World={year:1930,settlements:{}};`);
  const result=expose(context,`(function(){ WorldSimulation.migrate(World); return JSON.stringify({v:typeof World.vacancies,c:World.vacancyCounter}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.v,'object');
  assert.equal(parsed.c,0);
});

test('malformed top-level vacancy record survives migration as withdrawn placeholder',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    World.vacancies={'bad-key':'a raw string value'};
    VacancySystem.migrate(World);
    const ids=Object.keys(World.vacancies);
    const record=World.vacancies[ids[0]];
    return JSON.stringify({status:record.status,legacyValue:record.history[0].legacyValue});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'withdrawn');
  assert.equal(parsed.legacyValue,'a raw string value');
});

test('migration is byte-for-byte idempotent',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    VacancySystem.migrate(World);
    const first=JSON.stringify(World.vacancies);
    VacancySystem.migrate(World);
    const second=JSON.stringify(World.vacancies);
    return first===second?'stable':'changed';
  })()`);
  assert.equal(result,'stable');
});

test('embedded object vacancy on a business is lifted into World.vacancies',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[{businessId:b.id,occupationType:'job',occupationName:'Legacy Role',jobTier:1,annualSalary:900,status:'open',openedYear:1930,expiresYear:1932}];
    VacancySystem.migrate(World);
    const ids=Object.keys(World.vacancies);
    return JSON.stringify({count:ids.length,name:World.vacancies[ids[0]].occupationName});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.count,1);
  assert.equal(parsed.name,'Legacy Role');
});

test('dangling embedded vacancy ID string without a top-level record becomes a withdrawn placeholder',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=['vacancy:00007'];
    VacancySystem.migrate(World);
    const record=World.vacancies['vacancy:00007'];
    return JSON.stringify({exists:!!record,status:record?record.status:null});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.exists,true);
  assert.equal(parsed.status,'withdrawn');
});

test('clean invariants after migration and generation',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    VacancySystem.tickWorld(World,{year:1930});
    return JSON.stringify(VacancySystem.checkInvariants(World));
  })()`);
  assert.deepEqual(JSON.parse(result),[]);
});

test('invariant detects a business/open-vacancy array mismatch',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[];
    return JSON.stringify(VacancySystem.checkInvariants(World));
  })()`);
  const issues=JSON.parse(result);
  assert.ok(issues.some(i=>/does not match its open vacancy records/.test(i)));
});

test('invariant detects business open-vacancy cap violation',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    for(let i=0;i<4;i++){
      const v=VacancySystem.create(World,{businessId:b.id,occupationType:'job',occupationId:'role'+i,occupationName:'Role'+i,jobTier:1,annualSalary:1000,status:'open'});
    }
    VacancySystem.syncBusinessVacancyIds(World,b.id);
    return JSON.stringify(VacancySystem.checkInvariants(World));
  })()`);
  const issues=JSON.parse(result);
  assert.ok(issues.some(i=>/more than 3 open vacancies/.test(i)));
});

test('script-loader order places vacancy-system before world-simulation',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'..','life-game.html'),'utf8');
  const vacancyIdx=html.indexOf('js/systems/vacancy-system.js');
  const worldSimIdx=html.indexOf('js/systems/world-simulation.js');
  assert.ok(vacancyIdx>-1&&worldSimIdx>-1&&vacancyIdx<worldSimIdx);
});
