'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..','..');
const coreFiles=['js/core/random.js','js/core/year-engine.js','js/core/effects.js','js/core/invariants.js'];

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
  [...coreFiles,...files].forEach(file=>{
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  });
  return context;
}

function expose(context,code){
  return vm.runInContext(code,context);
}

module.exports={createGameContext,loadGameFiles,expose,root};
