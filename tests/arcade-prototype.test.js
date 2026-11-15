'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../prototypes/arcade.html'),'utf8');
// Exercise the actual standalone script. This DOM stub checks state transitions,
// not CSS rendering or browser accessibility.
function game(){
  const elements={};
  const document={activeElement:null,addEventListener(){},getElementById(id){
    if(!elements[id])elements[id]={innerHTML:'',textContent:'',hidden:false,disabled:false,isConnected:true,setAttribute(){},addEventListener(){},querySelector(){return {focus(){}};},querySelectorAll(){return [];},focus(){document.activeElement=this;}};
    return elements[id];
  }};
  const c=vm.createContext({document,console});
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],c);
  return {run:code=>vm.runInContext(code,c),choose:i=>elements.dialog.onclick({target:{closest:()=>({disabled:false,dataset:{choice:String(i)}})}}),elements};
}
test('prototype: regular income is separate from action income; actions cannot repeat',()=>{
 const g=game();g.run("act('work');act('work')");
 assert.equal(g.run('s.ap'),2);assert.equal(g.run('s.cash'),270);
 g.run('endYear()');assert.equal(g.run('s.cash'),310);g.choose(0);
 assert.equal(g.run('s.year'),2);assert.equal(g.run('s.ap'),3);
});
test('prototype: a qualification changes salary exactly once',()=>{
 const g=game();
 for(let i=0;i<3;i++){g.run("act('learn')");if(i<2){g.run('endYear()');g.choose(0);}}
 assert.equal(g.run('s.study'),3);assert.equal(g.run('salary()'),560);
 const cash=g.run('s.cash');g.run("act('learn')");assert.equal(g.run('s.cash'),cash);
});
test('prototype: a kept promise changes a bond and future employment income',()=>{
 const g=game();g.run("act('connect')");g.choose(0);assert.equal(g.run('s.promise.due'),2);
 g.run('endYear()');g.choose(0);g.run("act('connect')");
 assert.equal(g.run('s.bond'),74);assert.equal(g.run('salary()'),450);
 assert.equal(g.run('s.promise'),null);assert.equal(g.run('s.promiseDone'),true);
});
test('prototype: ending early warns about a promise and applies loss once',()=>{
 const g=game();g.run("act('connect')");g.choose(0);g.run('endYear()');g.choose(0);
 g.run('endYear()');assert.match(g.elements.dialog.innerHTML,/Mara is still waiting/);
 g.choose(1);assert.equal(g.run('s.bond'),36);assert.equal(g.run('s.promise'),null);
 // Dialog prevents another year settlement until its explicit advance.
 const cash=g.run('s.cash');g.run('endYear()');assert.equal(g.run('s.cash'),cash);
});
test('prototype: stop banks an operation without consuming another action',()=>{
 const g=game();g.run("rng=()=>0;act('risk')");assert.equal(g.run('s.cash'),140);assert.equal(g.run('s.ap'),2);
 g.choose(0);assert.equal(g.run('s.cash'),230);assert.equal(g.run('s.ap'),2);assert.equal(g.run('s.op'),null);
 g.run("act('risk')");assert.equal(g.run('s.cash'),230);
});
test('prototype: continuation failure loses only the envelope and disclosed stake',()=>{
 const g=game();g.run("rng=()=>0;act('risk')");g.run('rng=()=>.99');g.choose(1);
 assert.equal(g.run('s.cash'),140);assert.equal(g.run('s.op'),null);assert.equal(g.run('s.ap'),1);
 assert.equal(g.run('s.health'),71);assert.equal(g.run('s.heat'),18);
});
test('prototype: last action leaves cash out available and no continuation',()=>{
 const g=game();g.run("act('work');act('learn');rng=()=>0;act('risk')");
 assert.equal(g.run('s.ap'),0);assert.doesNotMatch(g.elements.dialog.innerHTML,/data-choice="1"/);
 g.choose(0);assert.equal(g.run('s.op'),null);
});
test('prototype: pending operation is banked exactly once at year end',()=>{
 const g=game();g.run("rng=()=>0;act('risk')");g.run('closeDialog();endYear()');g.choose(0);
 assert.equal(g.run('s.cash'),270);g.run('endYear()');assert.equal(g.run('s.cash'),270);
});
test('prototype: all ambitions are reachable in five years without taking risks',()=>{
 const g=game();
 g.run("act('learn');act('connect')");g.choose(0);g.run("act('work');endYear()");g.choose(0);
 g.run("act('connect');act('learn');act('work');endYear()");g.choose(0);
 g.run("act('learn');act('work');act('recover');endYear()");g.choose(0);
 for(let i=0;i<2;i++){g.run("act('connect');act('work');act('recover');endYear()");if(i===0)g.choose(0);}
 assert.equal(g.run('s.year'),5);assert.equal(g.run('s.ended'),true);
 assert.equal(g.run('checkGoals().every(Boolean)'),true);assert.match(g.elements.dialog.innerHTML,/A future you built/);
 const cash=g.run('s.cash');g.run("act('work');endYear()");assert.equal(g.run('s.cash'),cash);
});
test('prototype: routine recovery remains feasible when health is low',()=>{
 const g=game();g.run("s.health=4;render();act('work');act('recover')");
 assert.equal(g.run('s.health'),20);assert.equal(g.run('s.ap'),2);
});
