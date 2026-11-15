'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../prototypes/arcade.html'),'utf8');
// Verify the standalone game state using the real script. This DOM stub does
// not replace visual browser testing or player enjoyment measurement.
function game(){
 const elements={},listeners={};
 const document={activeElement:null,addEventListener(type,fn){(listeners[type]??=[]).push(fn);},getElementById(id){
  if(!elements[id])elements[id]={innerHTML:'',textContent:'',hidden:false,disabled:false,isConnected:true,setAttribute(){},addEventListener(){},querySelector(){return {focus(){}};},querySelectorAll(){return [];},focus(){document.activeElement=this;}};
  return elements[id];
 }};
 const c=vm.createContext({document,console});
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],c);
 return {
  run:code=>vm.runInContext(code,c),
  choose:i=>elements.dialog.onclick({target:{closest:()=>({disabled:false,dataset:{choice:String(i)}})}}),
  key:key=>(listeners.keydown||[]).forEach(fn=>fn({key,repeat:false,ctrlKey:false,altKey:false,metaKey:false,target:{tagName:'BODY',closest:()=>null},preventDefault(){}})),
  elements
 };
}
test('regular income is separate from action income and actions cannot repeat',()=>{
 const g=game();g.run("act('work');act('work')");
 assert.equal(g.run('s.ap'),2);assert.equal(g.run('s.cash'),310);
 g.run('endYear()');assert.equal(g.run('s.cash'),350);
 assert.equal(g.run('s.year'),2);assert.equal(g.run('s.ap'),3);
});
test('a qualification changes salary exactly once',()=>{
 const g=game();
 for(let i=0;i<3;i++){g.run("act('learn')");if(i<2)g.run('endYear()');}
 assert.equal(g.run('s.study'),3);assert.equal(g.run('salary()'),560);
 const cash=g.run('s.cash');g.run("act('learn')");assert.equal(g.run('s.cash'),cash);
});
test('a kept promise changes a bond and future employment income',()=>{
 const g=game();g.run("act('connect')");g.choose(0);assert.equal(g.run('s.promise.due'),2);
 g.run('endYear()');g.run("act('connect')");
 assert.equal(g.run('s.bond'),74);assert.equal(g.run('salary()'),450);
 assert.equal(g.run('s.promise'),null);assert.equal(g.run('s.promiseDone'),true);
});
test('ending early warns about a promise and applies its penalty once',()=>{
 const g=game();g.run("act('connect')");g.choose(0);g.run('endYear()');
 g.run('endYear()');assert.match(g.elements.dialog.innerHTML,/Mara is still waiting/);
 g.choose(1);assert.equal(g.run('s.bond'),36);assert.equal(g.run('s.promise'),null);
 assert.equal(g.run('s.year'),3);
 const cash=g.run('s.cash');g.run('endYear()');
 assert.equal(g.run('s.cash'),cash-5);assert.equal(g.run('s.bond'),36);
});
test('stop banks an operation without consuming another action',()=>{
 const g=game();g.run("rng=()=>0;act('risk')");assert.equal(g.run('s.cash'),140);assert.equal(g.run('s.ap'),2);
 g.choose(0);assert.equal(g.run('s.cash'),230);assert.equal(g.run('s.ap'),2);assert.equal(g.run('s.op'),null);
 g.run("act('risk')");assert.equal(g.run('s.cash'),230);
});
test('continuation failure loses only the envelope and disclosed stake',()=>{
 const g=game();g.run("rng=()=>0;act('risk')");g.run('rng=()=>.99');g.choose(1);
 assert.equal(g.run('s.cash'),140);assert.equal(g.run('s.op'),null);assert.equal(g.run('s.ap'),1);
 assert.equal(g.run('s.health'),71);assert.equal(g.run('s.heat'),18);
});
test('last action leaves cash out available and no continuation',()=>{
 const g=game();g.run("act('work');act('learn');rng=()=>0;act('risk')");
 assert.equal(g.run('s.ap'),0);assert.doesNotMatch(g.elements.dialog.innerHTML,/data-choice="1"/);
 g.choose(0);assert.equal(g.run('s.op'),null);
});
test('pending operation banks exactly once at nonmodal year end',()=>{
 const g=game();g.run("rng=()=>0;act('risk')");g.run('closeDialog();endYear()');
 assert.equal(g.run('s.cash'),270);assert.equal(g.run('s.year'),2);
 assert.equal(g.run('s.op'),null);assert.equal(g.run('s.receipt.opMoney'),90);
 assert.equal(g.run('modal'),false);
});
test('all ambitions are reachable in five years without taking risks',()=>{
 const g=game();
 g.run("act('learn');act('connect')");g.choose(0);g.run("act('work');endYear()");
 g.run("act('connect');act('learn');act('work');endYear()");
 g.run("act('learn');act('work');act('recover');endYear()");
 for(let i=0;i<2;i++)g.run("act('connect');act('work');act('recover');endYear()");
 assert.equal(g.run('s.year'),5);assert.equal(g.run('s.ended'),true);
 assert.equal(g.run('checkGoals().every(Boolean)'),true);
 assert.match(g.elements.dialog.innerHTML,/A future you built/);
 const cash=g.run('s.cash');g.run("act('work');endYear()");assert.equal(g.run('s.cash'),cash);
});
test('routine recovery remains feasible when health is low',()=>{
 const g=game();g.run("s.health=4;render();act('work');act('recover')");
 assert.equal(g.run('s.health'),20);assert.equal(g.run('s.ap'),2);
});
test('city pulses are disclosed, change outcomes and preserve budget accuracy',()=>{
 const g=game();assert.match(g.elements.cityPulse.innerHTML,/Foundry rush/);
 assert.equal(g.run('workPay()'),130);g.run("act('work')");
 assert.equal(g.run('s.cash'),310);assert.equal(g.run('s.health'),68);
 g.run('endYear()');assert.equal(g.run('s.year'),2);assert.equal(g.run('s.cash'),350);
 assert.equal(g.run('s.receipt.net'),40);assert.equal(g.elements.yearReceipt.hidden,false);
 assert.match(g.elements.yearReceipt.innerHTML,/1962 filed/);
 assert.match(g.elements.cityPulse.innerHTML,/Training grant/);
 assert.equal(g.run('learnCost()'),15);g.run("act('learn')");assert.equal(g.run('s.cash'),335);
 g.run('s.year=3;render()');assert.equal(g.run('budget()'),-5);
 assert.match(g.elements.cityPulse.innerHTML,/Housing squeeze/);
 assert.match(g.elements.sidebar.innerHTML,/\$425/);
 g.run('s.year=4;s.promiseDone=true;render()');g.run("act('connect')");
 assert.equal(g.run('s.bond'),62);
});
test('inspection year discloses lowered initial risk odds and enforces them',()=>{
 const g=game();g.run('s.year=5;render()');
 assert.ok(Math.abs(g.run('firstRiskOdds()')-.65)<1e-10);
 assert.match(g.elements.actions.innerHTML,/65% for \$90/);
 g.run("rng=()=>.7;act('risk')");
 assert.equal(g.run('s.op'),null);assert.equal(g.run('s.cash'),140);
 assert.equal(g.run('s.heat'),12);
});
test('keyboard action and end-year shortcuts remain within action limits',()=>{
 const g=game();g.key('1');g.key('1');
 assert.equal(g.run('s.ap'),2);assert.equal(g.run('s.cash'),310);
 g.key('Enter');assert.equal(g.run('s.year'),2);
 assert.equal(g.run('modal'),false);assert.equal(g.run('s.ap'),3);
 assert.match(g.elements.yearReceipt.innerHTML,/1962 filed/);
});
