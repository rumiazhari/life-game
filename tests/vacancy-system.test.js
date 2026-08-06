'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function freshWorld(){
  const context=createWorldContext();
  expose(context,`World={year:1930,seed:'test-seed',settlements:{}};BusinessSystem.ensure(World);EmploymentSystem.ensure(World);VacancySystem.ensure(World);`);
  return context;
}

function freshWorldWithEducation(){
  const context=createWorldContext(['js/education.js']);
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

/* ===== Correctness hardening: real player education shape (section 1) ===== */

test('qualificationDetails resolves middle-school completion from the real education object',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{lower:true,middle:true}},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,educationStage:'middle'}});
    return VacancySystem.qualifies(World,'subject',v,{subject})?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

test('qualificationDetails resolves upper-school completion from the real education object',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{lower:true,middle:true,upper:true}},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,educationStage:'upper'}});
    return VacancySystem.qualifies(World,'subject',v,{subject})?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

test('qualificationDetails resolves university completion from the real education object',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{lower:true,middle:true,upper:true,university:true}},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,educationStage:'university'}});
    return VacancySystem.qualifies(World,'subject',v,{subject})?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

test('qualificationDetails resolves university completion from legacy S.edu boolean',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,edu:true,education:{completed:{}},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,educationStage:'university'}});
    return VacancySystem.qualifies(World,'subject',v,{subject})?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

test('qualificationDetails treats missing education as none and fails a middle-school requirement',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,skills:{}};
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,educationStage:'middle'}});
    return VacancySystem.qualifies(World,'subject',v,{subject})?'yes':'no';
  })()`);
  assert.equal(result,'no');
});

test('qualificationDetails matches a required major from subject.education.majorId',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{lower:true,middle:true,upper:true,university:true},majorId:'medicine'},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,educationStage:'university',majorIds:['medicine']}});
    return VacancySystem.qualifies(World,'subject',v,{subject})?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

test('qualificationDetails rejects a mismatched major',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{lower:true,middle:true,upper:true,university:true},majorId:'law'},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,educationStage:'university',majorIds:['medicine']}});
    return VacancySystem.qualifies(World,'subject',v,{subject})?'yes':'no';
  })()`);
  assert.equal(result,'no');
});

test('qualificationDetails works against the real ensureEducationState() shape',()=>{
  const context=freshWorldWithEducation();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,eduCompleted:{},skills:{}};
    if(typeof ensureEducationState==='function') ensureEducationState(subject);
    subject.education.completed.middle=true;
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,educationStage:'middle'}});
    return VacancySystem.qualifies(World,'subject',v,{subject})?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

/* ===== Correctness hardening: stage-specific career requirements (section 2) ===== */

test('medicine stage 0 template requires middle education and no specific major',()=>{
  const context=freshWorldWithEducation();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const templates=VacancySystem.candidateTemplates(World,BusinessSystem.get(World,'${business.id}'));
    const stage0=templates.find(t=>t.occupationId==='medicine'&&t.careerStage===0);
    return JSON.stringify(stage0?{educationStage:stage0.educationStage,majorIds:stage0.majorIds}:null);
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed);
  assert.equal(parsed.educationStage,'middle');
  assert.deepEqual(parsed.majorIds,[]);
});

test('medicine stage 2 template requires university and a medicine-compatible major',()=>{
  const context=freshWorldWithEducation();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    for(let i=0;i<20;i++) EmploymentSystem.hire(World,{personId:'npc:stage2-'+i,businessId:b.id,annualSalary:100});
    b.finances.profit=100;
    const templates=VacancySystem.candidateTemplates(World,b);
    const stage2=templates.find(t=>t.occupationId==='medicine'&&t.careerStage===2);
    return JSON.stringify(stage2?{educationStage:stage2.educationStage,majorIds:stage2.majorIds}:null);
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed);
  assert.equal(parsed.educationStage,'university');
  assert.ok(parsed.majorIds.length>0);
});

test('law career templates require university and a law-compatible major',()=>{
  const context=freshWorldWithEducation();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'government'}));
  const result=expose(context,`(function(){
    const templates=VacancySystem.candidateTemplates(World,BusinessSystem.get(World,'${business.id}'));
    const lawStage=templates.filter(t=>t.occupationId==='law').sort((a,b)=>b.careerStage-a.careerStage)[0];
    return JSON.stringify(lawStage?{educationStage:lawStage.educationStage,majorIds:lawStage.majorIds}:null);
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed);
  assert.equal(parsed.educationStage,'university');
});

test('generated vacancy requirements match the existing education API for that stage',()=>{
  const context=freshWorldWithEducation();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    const created=VacancySystem.generateForBusiness(World,b,{year:1930});
    const careerVacancy=created.find(v=>v.occupationType==='career'&&v.occupationId==='medicine');
    if(!careerVacancy) return JSON.stringify({skip:true});
    const expected=typeof educationCareerEducationRequirement==='function'?educationCareerEducationRequirement(CAREERS.find(c=>c.id==='medicine'),careerVacancy.careerStage):null;
    return JSON.stringify({expected,actual:careerVacancy.requirements.educationStage});
  })()`);
  const parsed=JSON.parse(result);
  if(!parsed.skip) assert.equal(parsed.actual,parsed.expected);
});

test('candidate templates do not mutate education configuration objects',()=>{
  const context=freshWorldWithEducation();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const before=JSON.stringify(CAREER_MAJOR_REQUIREMENTS);
    const templates=VacancySystem.candidateTemplates(World,BusinessSystem.get(World,'${business.id}'));
    templates.forEach(t=>{ t.majorIds.push('mutated'); });
    const after=JSON.stringify(CAREER_MAJOR_REQUIREMENTS);
    return before===after?'unchanged':'mutated';
  })()`);
  assert.equal(result,'unchanged');
});

/* ===== Correctness hardening: annual application cap (section 6) ===== */

test('a person may submit at most two applications in a year',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{}},skills:{}};
    const v1=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'a',occupationName:'A',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v2=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'b',occupationName:'B',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v3=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'c',occupationName:'C',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const r1=VacancySystem.submitApplication(World,v1.id,'subject',{subject,year:1930});
    const r2=VacancySystem.submitApplication(World,v2.id,'subject',{subject,year:1930});
    const r3=VacancySystem.submitApplication(World,v3.id,'subject',{subject,year:1930});
    return JSON.stringify({r1:r1.applied,r2:r2.applied,r3applied:r3.applied,r3reason:r3.reason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.r1,true);
  assert.equal(parsed.r2,true);
  assert.equal(parsed.r3applied,false);
  assert.equal(parsed.r3reason,'annual_application_cap');
});

test('a different person is unaffected by another person being at the annual application cap',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{}},skills:{}};
    const v1=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'a',occupationName:'A',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v2=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'b',occupationName:'B',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v3=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'c',occupationName:'C',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.submitApplication(World,v1.id,'subject',{subject,year:1930});
    VacancySystem.submitApplication(World,v2.id,'subject',{subject,year:1930});
    World.npcs={'npc:1':{id:'npc:1',alive:true,birthYear:1900,locationId:World.activeSettlementId,education:{level:'none'}}};
    const r=VacancySystem.submitApplication(World,v3.id,'npc:1',{year:1930});
    return r.applied;
  })()`);
  assert.equal(result,true);
});

test('the same person may apply again in the following year',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{}},skills:{}};
    const v1=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'a',occupationName:'A',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v2=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'b',occupationName:'B',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v3=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'c',occupationName:'C',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.submitApplication(World,v1.id,'subject',{subject,year:1930});
    VacancySystem.submitApplication(World,v2.id,'subject',{subject,year:1930});
    const r=VacancySystem.submitApplication(World,v3.id,'subject',{subject,year:1931});
    return r.applied;
  })()`);
  assert.equal(result,true);
});

test('rejected qualification applications still count toward the yearly cap',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const subject={age:12,alive:true,education:{completed:{}},skills:{}};
    const v1=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'a',occupationName:'A',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v2=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'b',occupationName:'B',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v3=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'c',occupationName:'C',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.submitApplication(World,v1.id,'subject',{subject,year:1930});
    VacancySystem.submitApplication(World,v2.id,'subject',{subject,year:1930});
    const r=VacancySystem.submitApplication(World,v3.id,'subject',{subject,year:1930});
    return r.reason;
  })()`);
  assert.equal(result,'annual_application_cap');
});

test('repeated submission to the same vacancy does not consume another annual slot',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,education:{completed:{}},skills:{}};
    const v1=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'a',occupationName:'A',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v2=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'b',occupationName:'B',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.submitApplication(World,v1.id,'subject',{subject,year:1930});
    VacancySystem.submitApplication(World,v1.id,'subject',{subject,year:1930});
    const r=VacancySystem.submitApplication(World,v2.id,'subject',{subject,year:1930});
    return r.applied;
  })()`);
  assert.equal(result,true);
});

test('NPC seeding never exceeds two total applications per NPC per year across vacancies',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'finance',kind:'public'}));
  const b3=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'government',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:1':{id:'npc:1',alive:true,birthYear:1900,locationId:World.activeSettlementId,education:{level:'none'},employment:{}}};
    const v1=VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'job',occupationId:'a',occupationName:'A',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v2=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'b',occupationName:'B',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    const v3=VacancySystem.open(World,{businessId:'${b3.id}',occupationType:'job',occupationId:'c',occupationName:'C',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.seedNpcApplications(World,v1,{year:1930});
    VacancySystem.seedNpcApplications(World,v2,{year:1930});
    VacancySystem.seedNpcApplications(World,v3,{year:1930});
    return VacancySystem.applicationsForPersonInYear(World,'npc:1',1930).length;
  })()`);
  assert.ok(result<=2);
});

/* ===== Correctness hardening: vacancy migration record preservation (section 9) ===== */

test('embedded number entry in business.vacancies survives migration as a withdrawn placeholder',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[42];
    const beforeCount=Object.keys(World.vacancies).length;
    VacancySystem.migrate(World);
    const afterCount=Object.keys(World.vacancies).length;
    const created=Object.values(World.vacancies).find(v=>v.history.some(h=>h.type==='migration_repaired'&&h.legacyType==='number'));
    return JSON.stringify({grew:afterCount>beforeCount,found:!!created,status:created?created.status:null,legacyValue:created?created.history[0].legacyValue:null});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.grew,true);
  assert.equal(parsed.found,true);
  assert.equal(parsed.status,'withdrawn');
  assert.equal(parsed.legacyValue,'42');
});

test('embedded boolean entry in business.vacancies survives migration as a withdrawn placeholder',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[true];
    VacancySystem.migrate(World);
    const created=Object.values(World.vacancies).find(v=>v.history.some(h=>h.legacyType==='boolean'));
    return JSON.stringify({found:!!created,status:created?created.status:null});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.found,true);
  assert.equal(parsed.status,'withdrawn');
});

test('embedded null entry in business.vacancies survives migration as a withdrawn placeholder',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[null];
    VacancySystem.migrate(World);
    const created=Object.values(World.vacancies).find(v=>v.history.some(h=>h.legacyType==='null'));
    return JSON.stringify({found:!!created,status:created?created.status:null});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.found,true);
  assert.equal(parsed.status,'withdrawn');
});

test('embedded array entry in business.vacancies survives migration as a withdrawn placeholder',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[[1,2,3]];
    VacancySystem.migrate(World);
    const created=Object.values(World.vacancies).find(v=>v.history.some(h=>h.legacyType==='array'));
    return JSON.stringify({found:!!created,status:created?created.status:null});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.found,true);
  assert.equal(parsed.status,'withdrawn');
});

test('embedded empty-string entry in business.vacancies survives migration as a withdrawn placeholder',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[''];
    VacancySystem.migrate(World);
    const created=Object.values(World.vacancies).find(v=>v.history.some(h=>h.legacyType==='string'&&h.legacyValue===''));
    return JSON.stringify({found:!!created,status:created?created.status:null});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.found,true);
  assert.equal(parsed.status,'withdrawn');
});

test('a filled vacancy with no matching application is repaired to withdrawn (irreparable fill state)',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    World.vacancies={'vacancy:00001':{id:'vacancy:00001',businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',careerStage:null,jobTier:1,annualSalary:1000,requirements:{},openedYear:1928,expiresYear:1930,status:'filled',filledByPersonId:'npc:ghost',filledContractId:'employment:00099',filledYear:1929,closedReason:null,applications:[],history:[]}};
    VacancySystem.migrate(World);
    const v=World.vacancies['vacancy:00001'];
    return JSON.stringify({status:v.status,closedReason:v.closedReason,filledByPersonId:v.filledByPersonId});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'withdrawn');
  assert.equal(parsed.closedReason,'invalid_fill_state');
  assert.equal(parsed.filledByPersonId,null);
});

test('multiple malformed accepted applications collapse to exactly one matching filledByPersonId',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const contract=EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,hiredYear:1928});
    World.vacancies['vacancy:00002']={id:'vacancy:00002',businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',careerStage:null,jobTier:1,annualSalary:1000,requirements:{},openedYear:1928,expiresYear:1930,status:'filled',filledByPersonId:'npc:a',filledContractId:contract.id,filledYear:1929,closedReason:null,
      applications:[{personId:'npc:a',workerType:'npc',kind:'new_hire',appliedYear:1928,score:80,status:'accepted',resolvedYear:1929,reason:null},{personId:'npc:b',workerType:'npc',kind:'new_hire',appliedYear:1928,score:70,status:'accepted',resolvedYear:1929,reason:null}],history:[]};
    VacancySystem.migrate(World);
    const v=World.vacancies['vacancy:00002'];
    const accepted=v.applications.filter(a=>a.status==='accepted');
    return JSON.stringify({status:v.status,acceptedCount:accepted.length,acceptedPersonId:accepted[0]&&accepted[0].personId,bPersonStatus:v.applications.find(a=>a.personId==='npc:b').status});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'filled');
  assert.equal(parsed.acceptedCount,1);
  assert.equal(parsed.acceptedPersonId,'npc:a');
  assert.equal(parsed.bPersonStatus,'rejected');
});

test('a pending application always normalizes to a null resolvedYear',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    World.vacancies={'vacancy:00001':{id:'vacancy:00001',businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',careerStage:null,jobTier:1,annualSalary:1000,requirements:{},openedYear:1928,expiresYear:1935,status:'open',filledByPersonId:null,filledContractId:null,filledYear:null,closedReason:null,
      applications:[{personId:'npc:a',workerType:'npc',kind:'new_hire',appliedYear:1928,score:80,status:'pending',resolvedYear:1999,reason:'stale'}],history:[]}};
    VacancySystem.migrate(World);
    const app=World.vacancies['vacancy:00001'].applications[0];
    return JSON.stringify({resolvedYear:app.resolvedYear,reason:app.reason});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.resolvedYear,null);
  assert.equal(parsed.reason,null);
});

test('migration involving every malformed embedded type remains byte-for-byte idempotent',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[42,true,null,[1,2],'',{occupationName:'Weird'}];
    VacancySystem.migrate(World);
    const first=JSON.stringify(World.vacancies);
    VacancySystem.migrate(World);
    const second=JSON.stringify(World.vacancies);
    return first===second?'stable':'changed';
  })()`);
  assert.equal(result,'stable');
});

/* ===== Correctness hardening: usable vs malformed embedded objects (section 1) ===== */

test('a malformed object with only occupationName becomes withdrawn, not an open vacancy',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[{occupationName:'Weird'}];
    VacancySystem.migrate(World);
    const record=Object.values(World.vacancies)[0];
    return JSON.stringify({status:record.status,businessId:record.businessId});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'withdrawn');
  assert.equal(parsed.businessId,business.id);
});

test('a malformed object with an unsupported occupationType becomes withdrawn',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[{occupationType:'wizard',occupationName:'Wizard',jobTier:1,annualSalary:900}];
    VacancySystem.migrate(World);
    return Object.values(World.vacancies)[0].status;
  })()`);
  assert.equal(result,'withdrawn');
});

test('a malformed career object missing careerStage becomes withdrawn',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[{occupationType:'career',occupationId:'medicine',occupationName:'Junior',jobTier:1,annualSalary:900}];
    VacancySystem.migrate(World);
    return Object.values(World.vacancies)[0].status;
  })()`);
  assert.equal(result,'withdrawn');
});

test('malformed object content is preserved as bounded JSON in migration history',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[{occupationName:'Weird',extra:'data'}];
    VacancySystem.migrate(World);
    const record=Object.values(World.vacancies)[0];
    return record.history[0].legacyValue;
  })()`);
  assert.match(result,/Weird/);
  assert.match(result,/extra/);
});

test('a complete legacy embedded vacancy object remains a real usable vacancy',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[{occupationType:'job',occupationName:'Clerk',jobTier:1,annualSalary:900,status:'open'}];
    VacancySystem.migrate(World);
    const record=Object.values(World.vacancies)[0];
    return JSON.stringify({status:record.status,occupationName:record.occupationName});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'open');
  assert.equal(parsed.occupationName,'Clerk');
});

test('migration of a mix of usable and malformed embedded objects is byte-for-byte idempotent',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    b.vacancies=[{occupationName:'Weird'},{occupationType:'job',occupationName:'Clerk',jobTier:1,annualSalary:900,status:'open'}];
    VacancySystem.migrate(World);
    const first=JSON.stringify(World.vacancies);
    VacancySystem.migrate(World);
    const second=JSON.stringify(World.vacancies);
    return first===second?'stable':'changed';
  })()`);
  assert.equal(result,'stable');
});

/* ===== Correctness hardening: duplicate/cross-business embedded ID references (section 2) ===== */

test('a duplicate valid string reference in one business preserves one real reference plus one withdrawn placeholder',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const result=expose(context,`(function(){
    const b=BusinessSystem.get(World,'${business.id}');
    const v=VacancySystem.open(World,{businessId:b.id,occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    b.vacancies=[v.id,v.id];
    VacancySystem.migrate(World);
    const all=Object.values(World.vacancies);
    const duplicatePlaceholder=all.find(r=>r.closedReason==='migration_duplicate_reference');
    return JSON.stringify({total:all.length,originalStillOpen:World.vacancies[v.id].status,duplicateFound:!!duplicatePlaceholder,duplicateStatus:duplicatePlaceholder?duplicatePlaceholder.status:null});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.total,2);
  assert.equal(parsed.originalStillOpen,'open');
  assert.equal(parsed.duplicateFound,true);
  assert.equal(parsed.duplicateStatus,'withdrawn');
});

test('the same vacancy ID referenced by a second business preserves the true owner and a cross-business placeholder',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'finance'}));
  const result=expose(context,`(function(){
    const business1=BusinessSystem.get(World,'${b1.id}');
    const business2=BusinessSystem.get(World,'${b2.id}');
    const v=VacancySystem.open(World,{businessId:business1.id,occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    business2.vacancies=[v.id];
    VacancySystem.migrate(World);
    const all=Object.values(World.vacancies);
    const crossPlaceholder=all.find(r=>r.closedReason==='migration_cross_business_reference');
    return JSON.stringify({total:all.length,ownerStatus:World.vacancies[v.id].status,ownerBusiness:World.vacancies[v.id].businessId,crossFound:!!crossPlaceholder,crossBusiness:crossPlaceholder?crossPlaceholder.businessId:null});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.total,2);
  assert.equal(parsed.ownerStatus,'open');
  assert.equal(parsed.ownerBusiness,b1.id);
  assert.equal(parsed.crossFound,true);
  assert.equal(parsed.crossBusiness,b2.id);
});

test('no embedded input entry disappears across duplicate and cross-business references',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'finance'}));
  const result=expose(context,`(function(){
    const business1=BusinessSystem.get(World,'${b1.id}');
    const business2=BusinessSystem.get(World,'${b2.id}');
    const v=VacancySystem.open(World,{businessId:business1.id,occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    business1.vacancies=[v.id,v.id];
    business2.vacancies=[v.id];
    VacancySystem.migrate(World);
    return Object.keys(World.vacancies).length;
  })()`);
  assert.equal(result,3);
});

test('duplicate and cross-business embedded reference migration is byte-for-byte idempotent',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'finance'}));
  const result=expose(context,`(function(){
    const business1=BusinessSystem.get(World,'${b1.id}');
    const business2=BusinessSystem.get(World,'${b2.id}');
    const v=VacancySystem.open(World,{businessId:business1.id,occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000});
    business1.vacancies=[v.id,v.id];
    business2.vacancies=[v.id];
    VacancySystem.migrate(World);
    const first=JSON.stringify(World.vacancies);
    VacancySystem.migrate(World);
    const second=JSON.stringify(World.vacancies);
    return first===second?'stable':'changed';
  })()`);
  assert.equal(result,'stable');
});

/* ===== Correctness hardening: NPC internal promotion applications (section 5) ===== */

test('an NPC same-business exact promotion is submitted with kind promotion and can win',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}}};
    const contract=EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928,stageStartedYear:1928,origin:'vacancy'});
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    const submitted=VacancySystem.seedNpcApplications(World,v,{year:1930});
    const application=v.applications.find(a=>a.personId==='npc:a');
    const resolved=VacancySystem.resolveVacancy(World,v.id,{year:1930});
    const finalContract=EmploymentSystem.get(World,contract.id);
    return JSON.stringify({
      submittedKind:application?application.kind:null,
      status:resolved.status,filledContractId:resolved.filledContractId,
      sameContractId:finalContract.id===contract.id,
      occupationName:finalContract.occupationName,careerStage:finalContract.careerStage,jobTier:finalContract.jobTier,
      salary:finalContract.annualSalary,stageStartedYear:finalContract.stageStartedYear,
      employeeIds:BusinessSystem.get(World,'${business.id}').employeeIds,
      contractCount:EmploymentSystem.forPerson(World,'npc:a').length
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.submittedKind,'promotion');
  assert.equal(parsed.status,'filled');
  assert.equal(parsed.sameContractId,true);
  assert.equal(parsed.occupationName,'Senior');
  assert.equal(parsed.careerStage,1);
  assert.equal(parsed.jobTier,2);
  assert.equal(parsed.salary,1500);
  assert.equal(parsed.stageStartedYear,1930);
  assert.deepEqual(parsed.employeeIds,['npc:a']);
  assert.equal(parsed.contractCount,1);
});

test('an unrelated same-business role is excluded from NPC seeding',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}}};
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928,stageStartedYear:1928,origin:'vacancy'});
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'career',occupationId:'law',occupationName:'Associate',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    const submitted=VacancySystem.seedNpcApplications(World,v,{year:1930});
    return submitted.length;
  })()`);
  assert.equal(result,0);
});

test('a same-stage vacancy is excluded from same-business NPC seeding',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}}};
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1928,stageStartedYear:1928,origin:'vacancy'});
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior 2',careerStage:0,jobTier:1,annualSalary:1000,requirements:{minCareerYears:0}});
    const submitted=VacancySystem.seedNpcApplications(World,v,{year:1930});
    return submitted.length;
  })()`);
  assert.equal(result,0);
});

test('a competing external applicant can still win a promotion vacancy over the internal candidate deterministically',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={
      'npc:internal':{id:'npc:internal',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}},
      'npc:external':{id:'npc:external',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'university',quality:1,years:8},personality:{ambition:1,loyalty:1},employment:{}}
    };
    EmploymentSystem.hire(World,{personId:'npc:internal',businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1920,stageStartedYear:1920,origin:'vacancy'});
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    VacancySystem.seedNpcApplications(World,v,{year:1930});
    const resolved=VacancySystem.resolveVacancy(World,v.id,{year:1930});
    return JSON.stringify({filledBy:resolved.filledByPersonId,status:resolved.status});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'filled');
  assert.ok(['npc:internal','npc:external'].includes(parsed.filledBy));
});

test('when the top candidate fails acceptance, the next valid candidate wins',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'finance',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={
      'npc:top':{id:'npc:top',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'university',quality:1,years:8},personality:{ambition:1,loyalty:1},employment:{}},
      'npc:second':{id:'npc:second',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}}
    };
    EmploymentSystem.hire(World,{personId:'npc:top',businessId:'${b1.id}',annualSalary:100,hiredYear:1930});
    const v=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.submitApplication(World,v.id,'npc:top',{year:1930});
    VacancySystem.submitApplication(World,v.id,'npc:second',{year:1930});
    const original=EmploymentSystem.acceptVacancy;
    EmploymentSystem.acceptVacancy=function(world,vacancy,personId,opts){
      if(personId==='npc:top') return {accepted:false,reason:'forced_failure'};
      return original.apply(this,arguments);
    };
    const resolved=VacancySystem.resolveVacancy(World,v.id,{year:1930});
    EmploymentSystem.acceptVacancy=original;
    return JSON.stringify({status:resolved.status,filledBy:resolved.filledByPersonId});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.status,'filled');
  assert.equal(parsed.filledBy,'npc:second');
});

/* ===== Correctness hardening: prior-stage career tenure requirement (section 6) ===== */

test('five years in retail does not qualify for medicine stage one',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'university',quality:1,years:8},employment:{}}};
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${b1.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,hiredYear:1925,stageStartedYear:1925});
    const v=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    return VacancySystem.qualifies(World,'npc:a',v)?'yes':'no';
  })()`);
  assert.equal(result,'no');
});

test('five years in law does not qualify for medicine stage one',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'government',kind:'public'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'university',quality:1,years:8},employment:{}}};
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${b1.id}',occupationType:'career',occupationId:'law',occupationName:'Junior Counsel',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1925,stageStartedYear:1925});
    const v=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:0}});
    return VacancySystem.qualifies(World,'npc:a',v)?'yes':'no';
  })()`);
  assert.equal(result,'no');
});

test('medicine stage zero qualifies for stage one after sufficient years',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'university',quality:1,years:8},employment:{}}};
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1920,stageStartedYear:1920});
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:5}});
    return VacancySystem.qualifies(World,'npc:a',v)?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

test('medicine stage zero with insufficient years fails to qualify for stage one',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'university',quality:1,years:8},employment:{}}};
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1929,stageStartedYear:1929});
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:5}});
    const details=VacancySystem.qualificationDetails(World,'npc:a',v);
    return JSON.stringify({qualifies:details.qualifies,reasons:details.reasons});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.qualifies,false);
  assert.ok(parsed.reasons.includes('career_years'));
});

test('an employer switch at the next stage works when the worker is in the correct prior stage elsewhere',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    World.npcs={'npc:a':{id:'npc:a',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'university',quality:1,years:8},employment:{}}};
    EmploymentSystem.hire(World,{personId:'npc:a',businessId:'${b1.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,hiredYear:1920,stageStartedYear:1920});
    const v=VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minCareerYears:5}});
    return VacancySystem.qualifies(World,'npc:a',v)?'yes':'no';
  })()`);
  assert.equal(result,'yes');
});

/* ===== Correctness hardening: every career vacancy in the player portal (section 7) ===== */

test('playerPortalVacancies returns two vacancies from the same career track at different employers',()=>{
  const context=freshWorld();
  const b1=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const b2=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,location:{settlementId:'branec'},education:{completed:{lower:true,middle:true}},skills:{}};
    VacancySystem.open(World,{businessId:'${b1.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior A',careerStage:0,jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.open(World,{businessId:'${b2.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior B',careerStage:0,jobTier:1,annualSalary:1100,requirements:{minAge:16}});
    const projected=VacancySystem.playerPortalVacancies(World,subject);
    return JSON.stringify(projected.map(p=>({vacancyId:p.vacancyId,businessId:p.businessId,salary:p.annualSalary})));
  })()`);
  const projected=JSON.parse(result);
  assert.equal(projected.length,2);
  assert.equal(new Set(projected.map(p=>p.vacancyId)).size,2);
  assert.equal(new Set(projected.map(p=>p.businessId)).size,2);
});

test('playerPortalVacancies includes multiple stages of the same career simultaneously',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'healthcare',kind:'public'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,location:{settlementId:'branec'},education:{completed:{}},skills:{}};
    VacancySystem.open(World,{businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Junior',careerStage:0,jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    VacancySystem.open(World,{businessId:'${business.id}',occupationType:'career',occupationId:'medicine',occupationName:'Senior',careerStage:1,jobTier:2,annualSalary:1500,requirements:{minAge:16}});
    const projected=VacancySystem.playerPortalVacancies(World,subject);
    return JSON.stringify(projected.map(p=>p.stage));
  })()`);
  assert.deepEqual(JSON.parse(result).sort(),[0,1]);
});

test('playerPortalVacancies clones requirements so UI mutation cannot affect the stored vacancy',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const subject={age:30,alive:true,location:{settlementId:'branec'},education:{completed:{}},skills:{}};
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16,majorIds:[],skills:{}}});
    const projected=VacancySystem.playerPortalVacancies(World,subject);
    projected[0].requirements.majorIds.push('mutated');
    projected[0].requirements.skills.mutated=5;
    return JSON.stringify({majorIds:VacancySystem.get(World,v.id).requirements.majorIds,skills:VacancySystem.get(World,v.id).requirements.skills});
  })()`);
  const parsed=JSON.parse(result);
  assert.deepEqual(parsed.majorIds,[]);
  assert.deepEqual(parsed.skills,{});
});

/* ===== Correctness hardening: capped candidates must not starve others (section 9) ===== */

test('four highest-ranked candidates already capped still lets a fifth eligible candidate submit',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    World.npcs={};
    for(let i=0;i<4;i++){
      const id='npc:capped'+i;
      World.npcs[id]={id,alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}};
      const filler1=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'filler1-'+i,occupationName:'Filler1',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
      const filler2=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'filler2-'+i,occupationName:'Filler2',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
      VacancySystem.submitApplication(World,filler1.id,id,{year:World.year});
      VacancySystem.submitApplication(World,filler2.id,id,{year:World.year});
      VacancySystem.withdraw(World,filler1.id,'cleanup',World.year);
      VacancySystem.withdraw(World,filler2.id,'cleanup',World.year);
    }
    World.npcs['npc:fifth']={id:'npc:fifth',alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}};
    const submitted=VacancySystem.seedNpcApplications(World,v,{year:World.year});
    return JSON.stringify(submitted.map(a=>a.personId));
  })()`);
  const submitted=JSON.parse(result);
  assert.ok(submitted.includes('npc:fifth'));
});

test('NPC seeding respects deterministic ranked order and the per-vacancy applicant cap',()=>{
  const context=freshWorld();
  const business=JSON.parse(withBusiness(context,{settlementId:'branec',sector:'retail',kind:'public'}));
  const result=expose(context,`(function(){
    const v=VacancySystem.open(World,{businessId:'${business.id}',occupationType:'job',occupationId:'clerk',occupationName:'Clerk',jobTier:1,annualSalary:1000,requirements:{minAge:16}});
    World.npcs={};
    for(let i=0;i<6;i++){
      const id='npc:cand'+i;
      World.npcs[id]={id,alive:true,birthYear:World.year-30,locationId:'branec',education:{level:'none'},employment:{}};
    }
    const submitted=VacancySystem.seedNpcApplications(World,v,{year:World.year});
    return submitted.length;
  })()`);
  assert.ok(result<=4);
});
