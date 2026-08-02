'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createGameContext}=require('./helpers/vm-loader');

const context=createGameContext();
const uiSource=fs.readFileSync(path.resolve(__dirname,'..','js','ui.js'),'utf8');

assert.match(uiSource,/function thud\([\s\S]*?Math\.random\(\)/,'thud audio noise must use cosmetic Math.random');
assert.match(uiSource,/kind==='paper'[\s\S]*?Math\.random\(\)/,'paper audio noise must use cosmetic Math.random');
assert.doesNotMatch(uiSource,/function thud\([\s\S]*?Random\.next\(\)/,'thud audio noise must not consume gameplay RNG');
assert.doesNotMatch(uiSource,/kind==='paper'[\s\S]*?Random\.next\(\)/,'paper audio noise must not consume gameplay RNG');

function gameplayTrace(withSound){
  context.Random.setSeed('sound-isolation');
  if(withSound){
    // This models any number of audio samples. Cosmetic calls use Math.random,
    // so they must not move the seeded gameplay stream.
    for(let i=0;i<256;i++) Math.random();
  }
  return Array.from({length:8},()=>context.Random.next());
}

assert.deepEqual(gameplayTrace(false),gameplayTrace(true),'enabling sound must not alter seeded gameplay outcomes');

console.log('random/audio isolation: ok');
