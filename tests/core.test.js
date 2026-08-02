'use strict';

const assert=require('node:assert/strict');
const {createGameContext}=require('./helpers/vm-loader');

const context=createGameContext();
const calls=[];
context.YearEngine.configure((suppressBurst,quiet)=>{calls.push({suppressBurst,quiet});return 'advanced';});
assert.equal(context.YearEngine.advance({suppressBurst:true,quiet:false}),'advanced');
assert.deepEqual(calls,[{suppressBurst:true,quiet:false}]);
assert.equal(context.YearEngine.isConfigured(),true);

context.Random.setSeed(42);
const first=context.Random.next();
context.Random.setSeed(42);
assert.equal(context.Random.next(),first);
context.Random.reset();

console.log('core services: ok');
