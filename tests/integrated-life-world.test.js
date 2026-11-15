'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,expose}=require('./helpers/vm-loader');

function scene(seed){
 const ctx=createWorldContext();
 expose(ctx,"Random.setSeed("+JSON.stringify(seed)+");newWorld();newLineage();newHold();newSubject();");
 expose(ctx,"S.age=30;World.year=S.dob+S.age;S.jobTier=1;S.jobName='Worker';"+
   "const b=BusinessSystem.create(World,{settlementId:World.activeSettlementId,sector:'manufacturing',name:'Shared Industrial Works'});"+
   "World.npcs=World.npcs||{};"+
   "World.npcs['npc:colleague']={id:'npc:colleague',alive:true,birthYear:World.year-30,locationId:World.activeSettlementId,education:{level:'none'},employment:{},health:{general:70}};"+
   "EmploymentSystem.hire(World,{personId:'subject',businessId:b.id,annualSalary:1200,jobTier:1,occupationName:'Machinist'});"+
   "EmploymentSystem.hire(World,{personId:'npc:colleague',businessId:b.id,annualSalary:1000,jobTier:1,occupationName:'Machinist'});"+
   "EmploymentSystem.syncPlayerLegacy(World,S);World.__bargainBusiness=b.id;");
 return ctx;
}
function json(ctx,code){return JSON.parse(expose(ctx,'JSON.stringify('+code+')'));}

test('the workplace situation depends on authoritative employer and coworker records',()=>{
 const ctx=scene('labor-context');
 const situation=json(ctx,'WorkplaceSystem.laborSituation(World)');
 assert.equal(situation.available,true);
 assert.equal(situation.salary,1200);
 assert.ok(situation.choices.some(c=>c.id==='organize'));
 assert.equal(situation.peers,1);
 assert.ok(situation.choices.every(c=>c.odds>0&&c.odds<=1));
});
test('collective bargaining alters salaries, company profit, NPC memory, and cannot repeat',()=>{
 const ctx=scene('labor-success');
 const data=json(ctx,"(function(){"+
   "const b=BusinessSystem.get(World,World.__bargainBusiness);"+
   "const before=BusinessSystem.calculateAnnualResult(World,b,{year:World.year+1});"+
   "const stream=WorldSimulation.streamFor;"+
   "WorldSimulation.streamFor=function(w,y,id,sub){return sub.indexOf('labor-action-')===0?{next:()=>0}:stream(w,y,id,sub);};"+
   "const result=WorkplaceSystem.resolveLaborAction(World,{strategy:'organize',year:World.year,subject:S});"+
   "const after=BusinessSystem.calculateAnnualResult(World,b,{year:World.year+1});"+
   "const duplicate=WorkplaceSystem.resolveLaborAction(World,{strategy:'organize',year:World.year,subject:S});"+
   "return {result,duplicate,beforeProfit:before.profit,afterProfit:after.profit,"+
   "playerSalary:EmploymentSystem.activeForPerson(World,'subject')[0].annualSalary,"+
   "colleagueSalary:EmploymentSystem.activeForPerson(World,'npc:colleague')[0].annualSalary,"+
   "memories:RelationshipMemory.forPerson(World,'subject','npc:colleague').length,"+
   "invariants:EmploymentSystem.checkInvariants(World)};})()");
 assert.equal(data.result.ok,true);
 assert.equal(data.result.success,true);
 assert.ok(data.playerSalary>1200&&data.colleagueSalary>1000);
 assert.ok(data.afterProfit<data.beforeProfit);
 assert.equal(data.duplicate.ok,false);
 assert.ok(data.memories>0);
 assert.deepEqual(data.invariants,[]);
});
test('failed collective bargaining increases unrest, scrutiny and stress, without increasing pay',()=>{
 const ctx=scene('labor-failure');
 const data=json(ctx,"(function(){"+
   "const sid=World.activeSettlementId,before=World.settlements[sid].security.unrest;"+
   "const stream=WorldSimulation.streamFor;"+
   "WorldSimulation.streamFor=function(w,y,id,sub){return sub.indexOf('labor-action-')===0?{next:()=>.999}:stream(w,y,id,sub);};"+
   "const res=WorkplaceSystem.resolveLaborAction(World,{strategy:'organize',year:World.year,subject:S});"+
   "return {res,unrestChange:World.settlements[sid].security.unrest-before,"+
   "stress:EmploymentSystem.activeForPerson(World,'subject')[0].workplace.stress,scrutiny:S.scrutiny};})()");
 assert.equal(data.res.success,false);
 assert.ok(data.unrestChange>.06);
 assert.equal(data.scrutiny,8);
 assert.ok(data.stress>.25);
 assert.equal(data.res.salaryAfter,1200);
});
test('business distress and layoffs affect real local employment and wage indices',()=>{
 const ctx=scene('regional-feedback');
 const data=json(ctx,"(function(){"+
   "const sid=World.activeSettlementId,def=KARSEN_SETTLEMENTS.find(s=>s.id===sid);"+
   "const base=World.settlements[sid];"+
   "const calm=JSON.parse(JSON.stringify(base)),distressed=JSON.parse(JSON.stringify(base));"+
   "const stable={random:{range:()=>0},national:{},laborMarket:{businesses:6,distressRate:0,layoffRate:0,opportunityRate:.2}};"+
   "const shock={random:{range:()=>0},national:{},laborMarket:{businesses:6,distressRate:1,layoffRate:.4,opportunityRate:0}};"+
   "SettlementEconomy.tick(calm,def,stable);SettlementEconomy.tick(distressed,def,shock);"+
   "return {calm:calm.economy,distressed:distressed.economy};})()");
 assert.ok(data.distressed.employmentIndex<data.calm.employmentIndex);
 assert.ok(data.distressed.wageIndex<data.calm.wageIndex);
 assert.ok(data.distressed.industryDemand.manufacturing<data.calm.industryDemand.manufacturing);
});
test('labor-market figures derive from contracts and layoffs, rather than duplicate state',()=>{
 const ctx=scene('labor-derived');
 const data=json(ctx,"(function(){"+
   "const sid=World.activeSettlementId,year=World.year;"+
   "const initial=WorldSimulation.laborMarketFor(World,sid,year+1);"+
   "const c=EmploymentSystem.activeForPerson(World,'npc:colleague')[0];"+
   "EmploymentSystem.dismiss(World,c.id,'layoff_financial',year);"+
   "const after=WorldSimulation.laborMarketFor(World,sid,year+1);"+
   "return {initial,after};})()");
 assert.ok(data.after.layoffRate>data.initial.layoffRate);
 assert.ok(data.after.employees<data.initial.employees);
});
