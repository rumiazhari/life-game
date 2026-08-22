'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function freshWorld(seed){
  const context=createWorldContext();
  expose(context,`Random.setSeed(${JSON.stringify(seed||'surv-seed')});newWorld();newLineage();newHold();newSubject();BusinessSystem.ensure(World);EmploymentSystem.ensure(World);VacancySystem.ensure(World);WorkplaceSystem.ensure(World);SurvivalSystem.ensure(World);WorldSimulation.migrate(World);World.year=1930;`);
  return context;
}

const NORMAL_OPENING={id:'informal:00001',settlementId:'branec',kind:'gig',gigId:'ratcatcher',fixerId:null,jobTier:null,openedYear:1930,expiresYear:1932,status:'open',takenByPersonId:null};

test('survival ensure initializes schema version, counters, and tick guard',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){ SurvivalSystem.ensure(World); return JSON.stringify({v:World.survivalSchemaVersion,tick:World.survivalLastTickYear,o:Object.keys(World.survivalOpenings).length,f:Object.keys(World.fixers).length}); })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.v,1);
  assert.equal(parsed.tick,null);
});

test('migration repairs malformed records and is byte-idempotent',()=>{
  const context=freshWorld();
  const result=JSON.parse(expose(context,`(function(){
    World.survivalOpenings['informal:00001']={id:'',kind:'nonsense',status:'floating',openedYear:'x'};
    World.fixers['fixer:00001']={name:'',sector:'piracy',heat:999};
    SurvivalSystem.migrate(World);
    const first=JSON.stringify({o:World.survivalOpenings,f:World.fixers});
    SurvivalSystem.migrate(World);
    const second=JSON.stringify({o:World.survivalOpenings,f:World.fixers});
    return JSON.stringify({stable:first===second,invariants:SurvivalSystem.checkInvariants(World)});
  })()`));
  assert.equal(result.stable,true);
  assert.deepEqual(result.invariants,[]);
});

test('tickWorld is same-year idempotent and rejects stale years without mutation',()=>{
  const context=freshWorld();
  const result=expose(context,`(function(){
    World.settlements.branec.economy.employmentIndex=0.25;
    const before=JSON.stringify({o:World.survivalOpenings,f:World.fixers});
    const first=SurvivalSystem.tickWorld(World,{year:1932});
    const afterFirst=JSON.stringify({o:World.survivalOpenings,f:World.fixers});
    const second=SurvivalSystem.tickWorld(World,{year:1932});
    const stale=SurvivalSystem.tickWorld(World,{year:1929});
    return JSON.stringify({firstApplied:first.applied,idempotent:second.reason,staleReason:stale.reason,changed:before!==afterFirst,frozenAfterStale:JSON.stringify({o:World.survivalOpenings,f:World.fixers})===afterFirst});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.firstApplied,true);
  assert.equal(parsed.idempotent,'already_applied');
  assert.equal(parsed.staleReason,'stale_year');
  assert.equal(parsed.changed,true);
  assert.equal(parsed.frozenAfterStale,true);
});

test('street supply scales with settlement distress under the same seed',()=>{
  function run(emp){
    const context=freshWorld('supply-seed');
    expose(context,`World.settlements.branec.economy.employmentIndex=${emp};`);
    expose(context,`SurvivalSystem.tickWorld(World,{year:1930});`);
    return JSON.parse(expose(context,`JSON.stringify(SurvivalSystem.openingsFor(World,'branec').map(o=>({k:o.kind,s:o.status})))`));
  }
  const poor=run(0.2);
  const rich=run(0.95);
  assert.ok(poor.length>rich.length,'distressed Branec should list more street work than a prosperous one: '+poor.length+' vs '+rich.length);
  // Same seed twice -> identical outcome.
  const again=run(0.2);
  assert.deepEqual(poor,again);
});

test('generation respects the per-settlement cap',()=>{
  const context=freshWorld('cap-seed');
  const result=expose(context,`(function(){
    for(let i=0;i<SurvivalSystem.MAX_OPEN_PER_SETTLEMENT+4;i++){
      World.survivalOpenings['informal:'+String(i+1).padStart(5,'0')]={id:'informal:'+String(i+1).padStart(5,'0'),settlementId:'branec',kind:'gig',gigId:'ragbone',fixerId:null,jobTier:null,openedYear:1930,expiresYear:1932,status:'open',takenByPersonId:null};
    }
    SurvivalSystem.tickWorld(World,{year:1930});
    return JSON.stringify({openCount:SurvivalSystem.openingsFor(World,'branec',{status:'open'}).length,cap:SurvivalSystem.MAX_OPEN_PER_SETTLEMENT});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.openCount<=parsed.cap);
});

test('stale listings expire after their window',()=>{
  const context=freshWorld('expiry-seed');
  expose(context,`World.survivalOpenings['${JSON.stringify('informal:00001').slice(1,-1)}']=${JSON.stringify(NORMAL_OPENING)};SurvivalSystem.migrate(World);`);
  const result=JSON.parse(expose(context,`(function(){
    SurvivalSystem.tickWorld(World,{year:1931}); // not yet expired (1930+2)
    const still=openingsState();
    function openingsState(){ return World.survivalOpenings['informal:00001'].status; }
    SurvivalSystem.tickWorld(World,{year:1933});
    return JSON.stringify({stillOpen:still==='open',nowExpired:World.survivalOpenings['informal:00001'].status==='expired'});
  })()`));
  assert.equal(result.stillOpen,true);
  assert.equal(result.nowExpired,true);
});

test('desperation index separates stable lives from destitute ones',()=>{
  const context=freshWorld('d-index');
  const result=expose(context,`(function(){
    const stable={age:30,health:80,assets:2000,jobTier:2,jailUntil:0,lifestyle:{housing:'flat',food:'decent'}};
    const broke={age:30,health:30,assets:-900,jobTier:0,jailUntil:0,lifestyle:{housing:'none',food:'meager'}};
    return JSON.stringify({stable:SurvivalSystem.desperationOf(World,stable),broke:SurvivalSystem.desperationOf(World,broke)});
  })()`);
  const parsed=JSON.parse(result);
  assert.ok(parsed.stable<0.35,'stable life should read low desperation: '+parsed.stable);
  assert.ok(parsed.broke>0.75,'destitute life should read high desperation: '+parsed.broke);
});

test('taking an opening consumes it exactly once and enforces qualification',()=>{
  const context=freshWorld('take-seed');
  expose(context,`World.survivalOpenings['informal:00001']=${JSON.stringify(NORMAL_OPENING)};SurvivalSystem.migrate(World);`);
  const result=expose(context,`(function(){
    const adult={age:30}; // ratcatcher requires age 12+
    const ok=SurvivalSystem.takeOpening(World,'informal:00001','subject',{year:1930,subject:adult});
    const again=SurvivalSystem.takeOpening(World,'informal:00001','subject',{year:1930,subject:adult});
    const missing=SurvivalSystem.takeOpening(World,'informal:99999','subject',{year:1930,subject:adult});
    const child={age:8};
    World.survivalOpenings['informal:00002']={id:'informal:00002',settlementId:'branec',kind:'gig',gigId:'ratcatcher',fixerId:null,jobTier:null,openedYear:1930,expiresYear:1932,status:'open',takenByPersonId:null};
    SurvivalSystem.migrate(World);
    const unqualified=SurvivalSystem.takeOpening(World,'informal:00002','subject',{year:1930,subject:child});
    return JSON.stringify({ok:ok.taken,again:again.reason,missing:missing.reason,unqualified:unqualified.reason,status:ok.opening.status,taker:ok.opening.takenByPersonId});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.again,'already_taken');
  assert.equal(parsed.missing,'missing_opening');
  assert.equal(parsed.unqualified,'not_qualified');
  assert.equal(parsed.status,'taken');
  assert.equal(parsed.taker,'subject');
});

test('the underworld ladder: introduction gates fixer work, captures burn fixers',()=>{
  const context=freshWorld('underworld-seed');
  expose(context,`(function(){
    World.fixers['fixer:00001']={id:'fixer:00001',name:'Mira Voss',settlementId:'branec',sector:'fencing',status:'active',heat:60,trustRequired:0,openedYear:1928,history:[]};
    World.survivalOpenings['informal:00001']={id:'informal:00001',settlementId:'branec',kind:'fixerwork',gigId:null,fixerId:'fixer:00001',jobTier:0,openedYear:1930,expiresYear:1932,status:'open',takenByPersonId:null};
    SurvivalSystem.migrate(World);
    return null;
  })()`);
  const result=expose(context,`(function(){
    const outsider={age:30,holdMember:false,npcId:'subject'};
    const hidden=SurvivalSystem.bestOpeningFor(World,outsider,{settlementId:'branec'});
    const insider={age:30,holdMember:true,npcId:'subject'};
    const visible=SurvivalSystem.bestOpeningFor(World,insider,{settlementId:'branec'});
    const cap=SurvivalSystem.reportCapture(World,'fixer:00001',2,1931); // 60+10+16=86 >= burn threshold
    const burned=World.fixers['fixer:00001'].status;
    const withdrawn=World.survivalOpenings['informal:00001'].status;
    return JSON.stringify({hiddenNull:hidden===null,visibleIsListing:!!visible&&visible.kind==='fixerwork',burnedFlag:cap.burned,burnedStatus:burned,withdrawn:withdrawn,invariants:SurvivalSystem.checkInvariants(World)});
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.hiddenNull,true,'unintroduced subjects see no fixer work');
  assert.equal(parsed.visibleIsListing,true);
  assert.equal(parsed.burnedFlag,true);
  assert.equal(parsed.burnedStatus,'burned');
  assert.equal(parsed.withdrawn,'expired','a burned fixer\'s listings are pulled off the street');
  assert.deepEqual(parsed.invariants,[]);
});

test('checkInvariants flags tampered records',()=>{
  const context=freshWorld('tamper-seed');
  expose(context,`World.fixers['fixer:00001']={id:'fixer:00001',name:'X',settlementId:'branec',sector:'fencing',status:'active',heat:10,trustRequired:0,openedYear:1928,history:[]};
    World.survivalOpenings['informal:00001']={id:'informal:00001',settlementId:'branec',kind:'fixerwork',gigId:null,fixerId:'fixer:99999',jobTier:0,openedYear:1930,expiresYear:1932,status:'open',takenByPersonId:null};
    SurvivalSystem.migrate(World);`);
  const parsed=JSON.parse(expose(context,`JSON.stringify(SurvivalSystem.checkInvariants(World))`));
  assert.ok(Array.isArray(parsed)&&parsed.some(i=>i.includes('missing fixer')||i.includes('references missing fixer')),'expected dangling-fixer violation: '+JSON.stringify(parsed));
});

test('seekfixer introduces a desperate subject to the fold',()=>{
  const context=freshWorld('fold-seed');
  expose(context,`(function(){
    World.fixers['fixer:00001']={id:'fixer:00001',name:'Mira Voss',settlementId:'branec',sector:'labor',status:'active',heat:5,trustRequired:0,openedYear:1928,history:[]};
    SurvivalSystem.migrate(World);
    return null;
  })()`);
  const result=expose(context,`(function(){
    S.age=30; S.health=40; S.assets=-900; S.jobTier=0; S.jobName='Unemployed'; S.eduStage=null; S.jailUntil=0;
    S.lifestyle.housing='shelter'; S.lifestyle.food='meager'; S.location={settlementId:'branec'}; S.first='Avery';
    if(typeof DEC_MAP!=='object'||!DEC_MAP.seekfixer) return JSON.stringify({err:'no decision'});
    const ok=DEC_MAP.seekfixer.avail(S);
    if(!ok) return JSON.stringify({err:'avail false',d:SurvivalSystem.desperationOf(World,S)});
    DEC_MAP.seekfixer.apply(S,{});
    return JSON.stringify({
      hold:S.holdMember,
      trust:Hold.trust,
      memoryTags:(RelationshipMemory.forPerson(World,'subject')[0]||{tags:[]}).tags,
      err:null
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.err,null,parsed.err||'');
  assert.equal(parsed.hold,true,'subject enters the fold');
  assert.ok(parsed.memoryTags.includes('underworld'),'introduction is remembered');
});

test('fixerjob pays corruption-scaled organized money and consumes the listing',()=>{
  const context=freshWorld('fixerjob-seed');
  expose(context,`(function(){
    World.fixers['fixer:00001']={id:'fixer:00001',name:'Oskar Helm',settlementId:'branec',sector:'smuggling',status:'active',heat:8,trustRequired:0,openedYear:1928,history:[]};
    World.survivalOpenings['informal:00001']={id:'informal:00001',settlementId:'branec',kind:'fixerwork',gigId:null,fixerId:'fixer:00001',jobTier:1,openedYear:1930,expiresYear:1932,status:'open',takenByPersonId:null};
    SurvivalSystem.migrate(World);
    S.age=30; S.assets=0; S.holdMember=true; S.record=false; S.crime=0; S.vice=0; S.jailUntil=0;
    S.location={settlementId:'branec'}; S.lifestyle={housing:'room',food:'basic'};
    return null;
  })()`);
  const result=expose(context,`(function(){
    Random.setSeed('fixerjob-roll'); // shared stream: player-action resolution may use it
    const def=DEC_MAP.fixerjob;
    if(!def||!def.avail(S)) return JSON.stringify({err:'unavailable'});
    const before=S.assets;
    const r=def.apply(S,{openingId:'informal:00001'});
    return JSON.stringify({
      err:null,gained:(r.fx&&r.fx.assets)||0,text:String(r.text||'').slice(0,40),
      consumed:World.survivalOpenings['informal:00001'].status,
      heat:Hold.heat,
      invariants:SurvivalSystem.checkInvariants(World)
    });
  })()`);
  const parsed=JSON.parse(result);
  assert.equal(parsed.err,null);
  assert.ok(parsed.gained>0,'organized work pays: '+JSON.stringify(parsed));
  assert.equal(parsed.consumed,'taken');
  assert.ok(parsed.heat>=3,'Hold heat rises from fold work');
  assert.deepEqual(parsed.invariants,[]);
});



