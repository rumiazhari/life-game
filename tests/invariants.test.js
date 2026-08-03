'use strict';

const assert=require('node:assert/strict');
const {createGameContext,expose}=require('./helpers/vm-loader');

const context=createGameContext(['js/lore.js','js/data.js','js/state.js','js/medical.js','js/education.js','js/systems/settlement-economy.js','js/systems/public-health.js','js/systems/world-simulation.js']);
context.newWorld();
context.newLineage();
context.newHold();
context.newSubject();
expose(context,'globalThis.__S=S;globalThis.__World=World;');

context.Random.setSeed('phase-1');
const seededA=Array.from({length:5},()=>context.Random.next());
context.Random.setSeed('phase-1');
const seededB=Array.from({length:5},()=>context.Random.next());
assert.deepEqual(seededA,seededB,'seeded RNG sequence should be deterministic');
context.Random.reset();

assert.equal(context.Invariants.check(context.__S,context.__World).ok,true,'new subject should satisfy baseline invariants');
context.__World.year=context.__S.dob+context.__S.age+1;
assert.throws(()=>context.Invariants.assertValid(context.__S,context.__World),/Invariant violation/);
context.__World.year=context.__S.dob+context.__S.age;

context.__S.assets=Number.POSITIVE_INFINITY;
assert.equal(context.Invariants.check(context.__S,context.__World).violations.includes('assets must be finite'),true);
context.__S.assets=0;
context.__S.health=101;
assert.equal(context.Invariants.check(context.__S,context.__World).violations.includes('health must be between 0 and 100'),true);
context.__S.health=70;

context.__S.medical.conditions=[{id:'injury',state:'symptomatic',resolved:false},{id:'injury',state:'diagnosed',resolved:false}];
assert.ok(context.Invariants.check(context.__S,context.__World).violations.some(v=>v.includes('duplicate injury')));
context.__S.medical.conditions=[];

context.__S.eduStage='middle';
context.__S.traveling={to:'veskar'};
assert.ok(context.Invariants.check(context.__S,context.__World).violations.some(v=>v.includes('active journey')));
context.__S.eduStage=null;
context.__S.traveling=null;

context.__S.alive=false;
context.__S.cause='';
assert.ok(context.Invariants.check(context.__S,context.__World).violations.some(v=>v.includes('death cause')));
context.__S.cause='heart failure';
assert.equal(context.Invariants.check(context.__S,context.__World).ok,true);

const effectsSubject={health:98,assets:10};
const effectChanges=context.Effects.apply(effectsSubject,{health:10,assets:5});
assert.equal(effectChanges.health,2);
assert.equal(effectChanges.assets,5);
assert.equal(effectsSubject.health,100);
assert.equal(effectsSubject.assets,15);

console.log('invariants scenarios: ok');
