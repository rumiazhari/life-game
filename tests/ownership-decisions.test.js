'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
// player decisions must route through BusinessSystem (never fabricate state),
// deduct the stake into business finances, and close owned businesses with
// their employment contracts terminated. Mutating only through the system API
// preserves the authoritative World/S model.

const {createGameContext,expose}=require('./helpers/vm-loader');

function ctx(){
  const c=createGameContext(['js/lore.js','js/data.js','js/state.js','js/systems/business-system.js','js/systems/employment-system.js']);
  expose(c,'globalThis.__DECISIONS=DECISIONS;globalThis.__findDecision=id=>DECISIONS.find(d=>d.id===id);');
  c.newWorld();
  c.newLineage();
  c.newSubject();
  // The subject needs a settlement to register a business against.
  expose(c,'World.activeSettlementId="kostrin";World.settlements=World.settlements||{};World.settlements.kostrin={id:"kostrin",name:"Kostrin"};');
  return c;
}

function applyDecision(c,id,subjectOverride){
  const ov=subjectOverride?','+JSON.stringify(subjectOverride):'';
  return JSON.parse(expose(c,`(function(){const d=__findDecision(${JSON.stringify(id)});const before=JSON.parse(JSON.stringify(S));const r=d.apply();return JSON.stringify({r,before,after:JSON.parse(JSON.stringify(S))});})()`));
}

test('ownership decisions exist and are gated correctly',()=>{
  const c=ctx();
  const found=c.__findDecision('foundBusiness');
  const shut=c.__findDecision('shutDownBusiness');
  assert.ok(found,'foundBusiness decision present');
  assert.ok(shut,'shutDownBusiness decision present');
  // Without assets/age the found option is hidden; with assets it opens;
  // shut is hidden with no owned business. avail() is a VM closure over S,
  // so it must be evaluated inside the VM context.
  const r1=expose(c,'S.age=20;S.freedom=30;S.assets=100;S.eduStage=null;JSON.stringify({found:__findDecision("foundBusiness").avail(S),shut:__findDecision("shutDownBusiness").avail(S)});');
  assert.equal(JSON.parse(r1).found,false,'foundBusiness hidden when assets < 5000');
  const r2=expose(c,'S.assets=8000;S.freedom=50;JSON.stringify({found:__findDecision("foundBusiness").avail(S),shut:__findDecision("shutDownBusiness").avail(S)});');
  assert.equal(JSON.parse(r2).found,true,'foundBusiness available when eligible');
  assert.equal(JSON.parse(r2).shut,false,'shutDownBusiness hidden with no owned business');
});

test('foundBusiness creates a real BusinessSystem record owned by subject with the stake deposited',()=>{
  const c=ctx();
  expose(c,'S.age=22;S.freedom=55;S.assets=9000;S.eduStage=null;World.activeSettlementId="kostrin";');
  const out=applyDecision(c,'foundBusiness');
  assert.equal(out.r.reason,'found_business','foundation succeeded');
  assert.equal(out.r.fx.assets,-5000,'subject cash drops by the stake');
  assert.equal(out.r.fx.freedom,-5,'freedom cost applied');
  // World must now hold exactly one active subject-owned business.
  const check=expose(c,`(function(){const owned=Object.keys(World.businesses).filter(id=>World.businesses[id].ownerNpcId==='subject'&&World.businesses[id].status!=='closed');return JSON.stringify({count:owned.length,id:owned[0],cash:owned[0]?World.businesses[owned[0]].finances.cash:null,owner:owned[0]?World.businesses[owned[0]].ownerNpcId:null});})()`);
  const parsed=JSON.parse(check);
  assert.equal(parsed.count,1,'one subject-owned business exists');
  assert.equal(parsed.cash,5000,'stake deposited into business cash');
  assert.equal(parsed.owner,'subject','owner recorded as subject');
});

test('shutDownBusiness closes the owned business and ends its contracts',()=>{
  const c=ctx();
  expose(c,'S.age=22;S.freedom=55;S.assets=9000;S.eduStage=null;World.activeSettlementId="kostrin";');
  applyDecision(c,'foundBusiness');
  // Hire a worker so the closure must also terminate a contract.
  expose(c,`globalThis.B=Object.values(World.businesses).find(b=>b.ownerNpcId==='subject');World.npcs=World.npcs||{};World.npcs['npc:00001']={npcId:'npc:00001',name:'Worker',alive:true};EmploymentSystem.hire(World,{personId:'npc:00001',businessId:B.id,occupationName:'Clerk',annualSalary:400,jobTier:1});`);
  const beforeCount=expose(c,"Object.values(World.employmentContracts).filter(x=>x.status==='active').length");
  const out=applyDecision(c,'shutDownBusiness');
  assert.equal(out.r.reason,'business_shut_down','closure succeeded');
  const after=expose(c,`(function(){const b=Object.values(World.businesses).find(x=>x.ownerNpcId==='subject');const activeContracts=Object.values(World.employmentContracts).filter(x=>x.status==='active').length;return JSON.stringify({status:b.status,closedYear:b.closedYear,activeContracts});})()`);
  const parsed=JSON.parse(after);
  assert.equal(parsed.status,'closed','owned business is closed');
  assert.ok(parsed.closedYear!=null,'closure year recorded');
  assert.equal(parsed.activeContracts,0,'active employment contracts terminated by closure');
});

test('shutDownBusiness is inert when the subject owns nothing',()=>{
  const c=ctx();
  expose(c,'S.age=22;S.freedom=55;S.assets=9000;S.eduStage=null;');
  const out=applyDecision(c,'shutDownBusiness');
  assert.equal(out.r.reason,'no_owned_business','closure reports nothing to shut');
  assert.equal(Object.keys(out.r.fx).length,0,'no effects applied');
});
