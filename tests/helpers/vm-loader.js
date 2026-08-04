'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..','..');
const coreFiles=['js/core/random.js','js/core/year-engine.js','js/core/effects.js','js/core/invariants.js'];
const worldFiles=['js/lore.js','js/data.js','js/state.js','js/systems/settlement-economy.js','js/systems/public-health.js','js/systems/world-simulation.js','js/systems/relationship-memory.js','js/systems/condition-registry.js','js/systems/medical-system.js','js/systems/household-system.js','js/systems/household-health.js','js/systems/npc-system.js'];

function createGameContext(files=[]){
  const context={console,Math,Date,JSON,Set,Map,Object,Array,String,Number,Boolean,parseInt,parseFloat,isNaN};
  context.globalThis=context;
  context.window=context;
  context.document={};
  context.navigator={};
  vm.createContext(context);
  loadGameFiles(context,files);
  return context;
}

function loadGameFiles(context,files){
  const requested=[...files];
  if(requested.includes('js/medical.js')) ['js/systems/condition-registry.js','js/systems/medical-system.js'].reverse().forEach(file=>{if(!requested.includes(file))requested.unshift(file);});
  [...coreFiles,...requested].forEach(file=>{
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  });
  return context;
}

function createWorldContext(files=[]){
  const context=createGameContext();
  loadGameFiles(context,[...worldFiles,...files]);
  return context;
}

function expose(context,code){
  return vm.runInContext(code,context);
}

module.exports={createGameContext,createWorldContext,loadGameFiles,expose,root,worldFiles};
