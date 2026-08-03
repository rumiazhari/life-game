'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext}=require('./helpers/vm-loader');

test('relationship memories deduplicate and decay deterministically',()=>{
  const context=createWorldContext();
  const world={year:1950};
  const first=context.RelationshipMemory.add(world,{year:1950,type:'support',participants:['a','b'],intensity:.8,valence:.9,decay:.1,summary:'Helped during illness.'});
  const duplicate=context.RelationshipMemory.add(world,{year:1950,type:'support',participants:['b','a'],intensity:.8,valence:.9,decay:.1,summary:'Helped during illness.'});
  assert.equal(first.id,duplicate.id);
  assert.ok(context.RelationshipMemory.remainingIntensity(first,1952)<context.RelationshipMemory.remainingIntensity(first,1950));
  assert.ok(context.RelationshipMemory.modifier(world,'a','b',1950).trust>0);
});

test('relationship memory registry remains bounded',()=>{
  const context=createWorldContext();
  const world={year:2000};
  for(let i=0;i<700;i++) context.RelationshipMemory.add(world,{year:1900+i%100,type:'event-'+i,participants:['a','b'],intensity:.2,valence:i%2?.5:-.5,decay:.1,summary:'event '+i});
  context.RelationshipMemory.tick(world,2000);
  assert.ok(Object.keys(world.relationshipMemories).length<=context.RelationshipMemory.MAX_TOTAL_MEMORIES);
  assert.ok(context.RelationshipMemory.forPerson(world,'a','b').length<=context.RelationshipMemory.MAX_PAIR_MEMORIES);
});
