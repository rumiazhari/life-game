'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function freshWorld(){
  const context=createWorldContext();
  expose(context,`World={year:1930,settlements:{}};`);
  return context;
}

test('ensure creates valid empty state',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ BusinessSystem.ensure(World); return JSON.stringify({businesses:World.businesses,counter:World.businessCounter,schema:World.businessSchemaVersion}); })()`);
  const parsed=JSON.parse(result);
  assert.deepEqual(parsed.businesses,{});
  assert.equal(parsed.counter,0);
  assert.equal(parsed.schema,1);
});

test('create generates sequential stable IDs',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ BusinessSystem.ensure(World); const a=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'}); const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'}); return JSON.stringify([a.id,b.id]); })()`);
  const [a,b]=JSON.parse(result);
  assert.equal(a,'business:00001');
  assert.equal(b,'business:00002');
});

test('create copies employeeIds, vacancies, finances, and history instead of retaining references',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    const employeeIds=['npc:1'];
    const vacancies=[{id:'vac:1'}];
    const finances={cash:100};
    const history=[{year:1930}];
    const business=BusinessSystem.create(World,{settlementId:'branec',sector:'retail',employeeIds,vacancies,finances,history});
    employeeIds.push('npc:2');
    vacancies.push({id:'vac:2'});
    history.push({year:1931});
    return JSON.stringify({employeeIds:business.employeeIds,vacancyCount:business.vacancies.length,historyCount:business.history.length});
  })()`);
  const parsed=JSON.parse(result);
  assert.deepEqual(parsed.employeeIds,['npc:1']);
  assert.equal(parsed.vacancyCount,1);
  assert.equal(parsed.historyCount,1);
});

test('invalid sectors throw',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ BusinessSystem.ensure(World); try { BusinessSystem.create(World,{settlementId:'branec',sector:'space-mining'}); return 'no-throw'; } catch(e){ return e.message; } })()`);
  assert.match(result,/sector/i);
});

test('missing settlementId throws',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ BusinessSystem.ensure(World); try { BusinessSystem.create(World,{sector:'retail'}); return 'no-throw'; } catch(e){ return e.message; } })()`);
  assert.match(result,/settlementId/i);
});

test('sector defaults produce the correct kinds',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    const kinds={};
    ['government','education','healthcare','agriculture','retail'].forEach(sector=>{
      kinds[sector]=BusinessSystem.create(World,{settlementId:'branec',sector}).kind;
    });
    return JSON.stringify(kinds);
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.government,'public');
  assert.equal(parsed.education,'public');
  assert.equal(parsed.healthcare,'nonprofit');
  assert.equal(parsed.agriculture,'cooperative');
  assert.equal(parsed.retail,'private');
});

test('seedWorld creates businesses for every settlement',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS);
    const missing=KARSEN_SETTLEMENTS.filter(s=>BusinessSystem.forSettlement(World,s.id).length===0);
    return JSON.stringify({missing:missing.length,settlementCount:KARSEN_SETTLEMENTS.length});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.missing,0);
  assert.ok(parsed.settlementCount>0);
});

test('seeded counts follow the exact population thresholds',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS);
    const counts={};
    KARSEN_SETTLEMENTS.forEach(s=>{ counts[s.id]=BusinessSystem.forSettlement(World,s.id).length; });
    return JSON.stringify({counts,populations:Object.fromEntries(KARSEN_SETTLEMENTS.map(s=>[s.id,s.population]))});
  })()`);
  const parsed=JSON.parse(result);
  function expectedCount(populationText){
    const pop=Number(String(populationText).replace(/[^0-9]/g,''))||0;
    if(pop<5000) return 3;
    if(pop<20000) return 5;
    if(pop<100000) return 8;
    return 12;
  }
  Object.keys(parsed.counts).forEach(id=>{
    assert.equal(parsed.counts[id],expectedCount(parsed.populations[id]),'mismatch for '+id);
  });
});

test('no settlement exceeds 12 businesses',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS);
    const max=Math.max(...KARSEN_SETTLEMENTS.map(s=>BusinessSystem.forSettlement(World,s.id).length));
    return JSON.stringify(max);
  })()`);
  assert.ok(JSON.parse(result)<=12);
});

test('seedWorld is idempotent',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS);
    const first=JSON.stringify(World.businesses);
    const firstCounter=World.businessCounter;
    BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS);
    BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS);
    const second=JSON.stringify(World.businesses);
    return JSON.stringify({equal:first===second,counterEqual:firstCounter===World.businessCounter});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.equal);
  assert.ok(parsed.counterEqual);
});

test('seeded names and IDs are deterministic across worlds with the same state',()=>{
  const contextA=freshWorld();
  const contextB=freshWorld();
  const resultA=expose(contextA,`(function(){ BusinessSystem.ensure(World); BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS); return JSON.stringify(World.businesses); })()`);
  const resultB=expose(contextB,`(function(){ BusinessSystem.ensure(World); BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS); return JSON.stringify(World.businesses); })()`);
  assert.equal(resultA,resultB);
});

test('seeding does not consume global Random',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    Random.setSeed('business-seed-check');
    const before=Random.range(0,1);
    Random.setSeed('business-seed-check');
    BusinessSystem.ensure(World);
    BusinessSystem.seedWorld(World,KARSEN_SETTLEMENTS);
    const after=Random.range(0,1);
    return JSON.stringify({before,after});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.before,parsed.after);
});

test('migration preserves custom existing businesses',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    World.businesses['business:00001']={id:'business:00001',name:'Custom Forge',settlementId:'branec',sector:'manufacturing',demandGroup:'manufacturing',kind:'private',status:'active',foundedYear:1920,ownerNpcId:null,employeeIds:[],vacancies:[],finances:{cash:5,debt:0,revenue:0,expenses:0,payroll:0,profit:0,lastYear:null},history:[]};
    World.businessCounter=1;
    BusinessSystem.migrate(World,KARSEN_SETTLEMENTS);
    const record=World.businesses['business:00001'];
    return JSON.stringify({name:record.name,id:record.id,sector:record.sector});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.name,'Custom Forge');
  assert.equal(parsed.id,'business:00001');
  assert.equal(parsed.sector,'manufacturing');
});

test('migration repairs malformed arrays and financial values',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    World.businesses['business:00001']={id:'business:00001',name:'Broken Co',settlementId:'branec',sector:'retail',demandGroup:'services',kind:'private',status:'active',foundedYear:1920,ownerNpcId:null,employeeIds:['npc:1','npc:1','npc:2'],vacancies:'not-an-array',finances:{cash:NaN,debt:'oops',revenue:Infinity,expenses:0,payroll:0,profit:0,lastYear:null},history:null};
    World.businessCounter=1;
    BusinessSystem.migrate(World,KARSEN_SETTLEMENTS);
    const record=World.businesses['business:00001'];
    return JSON.stringify({employeeIds:record.employeeIds,vacancies:record.vacancies,finances:record.finances,history:record.history});
  })()`);
  const parsed=JSON.parse(result);
  assert.deepEqual(parsed.employeeIds,['npc:1','npc:2']);
  assert.deepEqual(parsed.vacancies,[]);
  assert.equal(parsed.finances.cash,0);
  assert.equal(parsed.finances.debt,0);
  assert.equal(parsed.finances.revenue,0);
  assert.deepEqual(parsed.history,[]);
});

test('migration advances businessCounter past existing IDs',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    World.businesses['business:00007']={id:'business:00007',name:'Odd Co',settlementId:'branec',sector:'retail',demandGroup:'services',kind:'private',status:'active',foundedYear:1920,ownerNpcId:null,employeeIds:[],vacancies:[],finances:{cash:0,debt:0,revenue:0,expenses:0,payroll:0,profit:0,lastYear:null},history:[]};
    World.businessCounter=0;
    BusinessSystem.migrate(World,[]);
    const next=BusinessSystem.create(World,{settlementId:'branec',sector:'retail'});
    return JSON.stringify({counterAfterMigrate:World.businessCounter>=7,nextId:next.id});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.counterAfterMigrate);
  assert.equal(parsed.nextId,'business:00008');
});

test('summary reports correct status, sector, employee, and vacancy counts',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    const a=BusinessSystem.create(World,{settlementId:'branec',sector:'retail',employeeIds:['npc:1','npc:2'],vacancies:[{id:'v1'},{id:'v2'}]});
    a.status='active';
    const b=BusinessSystem.create(World,{settlementId:'branec',sector:'retail',employeeIds:['npc:2','npc:3']});
    b.status='struggling';
    const c=BusinessSystem.create(World,{settlementId:'branec',sector:'finance'});
    c.status='closed';
    return JSON.stringify(BusinessSystem.summary(World,'branec'));
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.total,3);
  assert.equal(parsed.active,1);
  assert.equal(parsed.struggling,1);
  assert.equal(parsed.closed,1);
  assert.equal(parsed.employees,3);
  assert.equal(parsed.vacancies,2);
  assert.equal(parsed.bySector.retail,2);
  assert.equal(parsed.bySector.finance,1);
});

test('checkInvariants returns no violations for a migrated fresh world',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.migrate(World,KARSEN_SETTLEMENTS);
    return JSON.stringify(BusinessSystem.checkInvariants(World));
  })()`);
  assert.deepEqual(JSON.parse(result),[]);
});

test('checkInvariants detects duplicate employees and invalid sectors',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    BusinessSystem.ensure(World);
    World.businesses['business:00001']={id:'business:00001',name:'Bad Co',settlementId:'branec',sector:'nonsense',demandGroup:'services',kind:'private',status:'active',foundedYear:1920,ownerNpcId:null,employeeIds:['npc:1','npc:1'],vacancies:[],finances:{cash:0,debt:0,revenue:0,expenses:0,payroll:0,profit:0,lastYear:null},history:[]};
    World.businessCounter=1;
    return JSON.stringify(BusinessSystem.checkInvariants(World));
  })()`);
  const issues=JSON.parse(result);
  assert.ok(issues.some(msg=>/sector/i.test(msg)));
  assert.ok(issues.some(msg=>/duplicate employeeIds/i.test(msg)));
});

test('WorldSimulation.migrate automatically seeds businesses',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    WorldSimulation.migrate(World);
    return JSON.stringify({hasBusinesses:!!World.businesses,total:BusinessSystem.summary(World).total});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.hasBusinesses);
  assert.ok(parsed.total>0);
});

test('repeated WorldSimulation.migrate calls do not change serialized business state',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    WorldSimulation.migrate(World);
    const first=JSON.stringify(World.businesses);
    WorldSimulation.migrate(World);
    WorldSimulation.migrate(World);
    const second=JSON.stringify(World.businesses);
    return JSON.stringify(first===second);
  })()`);
  assert.equal(JSON.parse(result),true);
});
