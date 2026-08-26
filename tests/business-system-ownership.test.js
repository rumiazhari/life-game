const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldContext, expose } = require('./helpers/vm-loader');

function freshWorld(){
  const context = createWorldContext();
  expose(context, 'World={year:1930,settlements:{}};');
  return context;
}

test('create uses explicit ownerNpcId when provided (not auto-assigned)', () => {
  const context = freshWorld();
  const result = expose(context, "(function(){ World.npcs = { 'npc:1': { npcId: 'npc:1', isSubject: false, alive: true }, 'subject': { npcId: 'subject', isSubject: true, alive: true } }; BusinessSystem.ensure(World); const b = BusinessSystem.create(World, { settlementId: 'branec', sector: 'retail', ownerNpcId: 'npc:1' }); return JSON.stringify(b.ownerNpcId); })()");
  assert.equal(JSON.parse(result), 'npc:1');
});

test('create auto-assigns ownerNpcId when not provided', () => {
  const context = freshWorld();
  const result = expose(context, "(function(){ World.npcs = { 'npc:1': { npcId: 'npc:1', isSubject: false, alive: true }, 'subject': { npcId: 'subject', isSubject: true, alive: true } }; BusinessSystem.ensure(World); const b = BusinessSystem.create(World, { settlementId: 'branec', sector: 'retail' }); return JSON.stringify(b.ownerNpcId); })()");
  assert.equal(JSON.parse(result), 'npc:1');
});

test('create sets ownerNpcId to null when no non-subject NPCs exist', () => {
  const context = freshWorld();
  const result = expose(context, "(function(){ World.npcs = { 'subject': { npcId: 'subject', isSubject: true, alive: true } }; BusinessSystem.ensure(World); const b = BusinessSystem.create(World, { settlementId: 'branec', sector: 'retail' }); return JSON.stringify(b.ownerNpcId); })()");
  assert.equal(JSON.parse(result), null);
});

test('dividend flow distributes profit to owner NPC via full annual tick', () => {
  const context = freshWorld();
  const result = expose(context, "(function(){ World.npcs = { 'npc:1': { npcId: 'npc:1', isSubject: false, alive: true, employment: { income: 1000, status: 'employed' } }, 'subject': { npcId: 'subject', isSubject: true, alive: true, employment: { income: 0, status: 'unemployed' } } }; World.settlements = { branec: { id: 'branec', name: 'Branec', kind: 'town', population: '25,000', foundedYear: 1900 } }; WorldSimulation.migrate(World); const b = BusinessSystem.create(World, { settlementId: 'branec', sector: 'retail', ownerNpcId: 'npc:1' }); b.finances.cash = 100000; b.finances.revenue = 50000; b.finances.expenses = 20000; b.finances.profit = 30000; b.lastTickYear = null; b.finances.lastYear = null; BusinessSystem.tickWorld(World, { year: 1930 }); const bAfter = World.businesses[b.id]; return JSON.stringify({ ownerIncome: World.npcs['npc:1'].employment.income, dividendRecorded: bAfter.history.some(h => h.type === 'dividend'), dividendAmount: (bAfter.history.find(h => h.type === 'dividend') || {}).amount }); })()");
  const parsed = JSON.parse(result);
  assert.ok(parsed.ownerIncome > 1000, 'owner NPC income should increase from dividend');
  assert.ok(parsed.dividendRecorded, 'dividend should be recorded in business history');
  assert.ok(parsed.dividendAmount > 0, 'dividend amount should be positive');
});
