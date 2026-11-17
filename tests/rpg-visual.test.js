'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');
function ctx(){
 const c=createWorldContext();
 if(fs.existsSync(path.join(__dirname,'../js/ui/story-impact-ui.js')))loadGameFiles(c,['js/ui/story-impact-ui.js']);
 expose(c,"Random.setSeed('visual');newWorld();newLineage();newHold();newSubject();"+
  "S.age=28;S.alive=true;World.year=S.dob+S.age;NpcSystem.syncLegacy(World,S,Lineage);");
 return c;
}
const j=(c,s)=>JSON.parse(expose(c,'JSON.stringify((()=>{'+s+'})())'));
test('terminal option shows bounded canonical effect chips without spoiling ending prose',()=>{
 const c=ctx();
 const out=j(c,"const run={sceneId:'open',scenes:{open:{choice:{options:[{goto:'done'}]}},"+
  "done:{ending:{id:'ending_secret',title:'A Hidden Ending',effects:[{kind:'stat',stat:'relations',delta:4},"+
  "{kind:'scrutiny',delta:-6},{kind:'storyItem',id:'proof',label:'Proof File'},{kind:'skill',skill:'craft',delta:1}]}}}};"+
  "const before=JSON.stringify(run);const html=RPGVisual.effectStrip(run,{index:0},World,S);"+
  "return {html,mutated:JSON.stringify(run)!==before};");
 assert.equal(out.mutated,false);
 assert.match(out.html,/RELATIONS \+4/);
 assert.match(out.html,/SCRUTINY −6/);
 assert.match(out.html,/EVIDENCE/);
 assert.match(out.html,/CRAFT \+1/);
 assert.doesNotMatch(out.html,/A Hidden Ending|ending_secret/);
});
test('3d6 odds meter has accurate chance and alternate setback preview',()=>{
 const c=ctx();
 const run={sceneId:'open',scenes:{
  open:{choice:{options:[{goto:'pass',check:{failGoto:'fail'}}]}},
  pass:{ending:{effects:[{kind:'npcBond',delta:8}]}},
  fail:{ending:{effects:[{kind:'stat',stat:'happiness',delta:-2}]}}
 }};
 const html=expose(c,"RPGVisual.effectStrip("+JSON.stringify(run)+
  ",{index:0,check:{percent:74,mod:1,tn:9,domain:'social',difficulty:'standard'}},World,S)");
 assert.match(html,/74%/);
 assert.match(html,/CHANCE TO PASS/);
 assert.match(html,/style="--vn-chance:74%"/);
 assert.match(html,/SUCCESS/);
 assert.match(html,/SETBACK/);
 assert.match(html,/HAPPINESS −2/);
});
test('unknown intermediate branch shows CONTINUES rather than falsely claiming a reward',()=>{
 const c=ctx();
 const html=expose(c,"RPGVisual.effectStrip({sceneId:'open',scenes:{open:{choice:{options:[{goto:'talk'}]}},"+
  "talk:{lines:[{t:'No ending yet'}],choice:{options:[]}}}},{index:0},World,S)");
 assert.match(html,/STORY CONTINUES/);
 assert.doesNotMatch(html,/CHANCE TO PASS|EVIDENCE/);
});
test('guaranteed route is explicitly marked no-dice with appropriate accessibility label',()=>{
 const c=ctx();
 const html=expose(c,"RPGVisual.effectStrip({sceneId:'open',scenes:{open:{choice:{options:[{goto:'quiet'}]}},"+
  "quiet:{ending:{effects:[]}}}},{index:0},World,S)");
 assert.match(html,/NO DICE · GUARANTEED/);
 assert.match(html,/aria-label="Guaranteed choice without dice"/);
});
test('visual presentation escapes untrusted labels and clamps chance safely',()=>{
 const c=ctx();
 const run={sceneId:'open',scenes:{
  open:{choice:{options:[{goto:'done',check:{failGoto:'done'}}]}},
  done:{ending:{effects:[{kind:'storyItem',label:'<img src=x onerror=alert(1)>',id:'safe'}]}}
 }};
 const html=expose(c,"RPGVisual.effectStrip("+JSON.stringify(run)+
  ",{index:0,check:{percent:500}},World,S)");
 assert.doesNotMatch(html,/<img|onerror=/);
 assert.match(html,/100%/);
});
test('actual NPC trust/closeness/conflict strips use canonical relationship, not invented values',()=>{
 const c=ctx();
 const out=j(c,"const n=Object.values(World.npcs).find(n=>n.id!==S.npcId);n.alive=true;"+
  "const r=NpcSystem.relationship(n,S.npcId);r.closeness=66;r.trust=72;r.conflict=13;"+
  "const before=JSON.stringify(World);"+
  "const html=RPGVisual.relationshipStrip(World,S,{social:{npcId:n.id}});"+
  "return {html,mutated:JSON.stringify(World)!==before};");
 assert.equal(out.mutated,false);
 assert.match(out.html,/TRUST/);
 assert.match(out.html,/72/);
 assert.match(out.html,/CONFLICT/);
 assert.match(out.html,/13/);
 assert.match(out.html,/CLOSENESS/);
 assert.match(out.html,/66/);
});
test('dead/unrelated NPC and missing run have no fabricated relationship strip',()=>{
 const c=ctx();
 const out=j(c,"const n=Object.values(World.npcs).find(n=>n.id!==S.npcId);n.alive=false;"+
  "return {dead:RPGVisual.relationshipStrip(World,S,{social:{npcId:n.id}}),"+
  "missing:RPGVisual.relationshipStrip(World,S,{social:{npcId:'npc:nonexistent'}}),"+
  "empty:RPGVisual.relationshipStrip(World,S,null)};");
 assert.equal(out.dead,'');
 assert.equal(out.missing,'');
 assert.equal(out.empty,'');
});
test('story beat marker reports consumed choices, not a fabricated overall completion percent',()=>{
 const c=ctx();
 const html=expose(c,"RPGVisual.beatMarker({history:[{type:'choice'},{type:'line'},{type:'choice'}]},{type:'choice'})");
 assert.match(html,/BEAT 3/);
 assert.doesNotMatch(html,/%|100|TOTAL/);
});
test('browser loads visual adapter after NPC authority and before main UI, reduced motion preserved',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../life-game.html'),'utf8');
 const a=html.indexOf('js/ui/story-impact-ui.js'),n=html.indexOf('js/systems/npc-system.js'),u=html.indexOf('js/ui.js');
 assert.ok(a>n&&a<u);
 const ui=fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8');
 assert.match(ui,/RPGVisual\.effectStrip/);
 assert.match(ui,/RPGVisual\.relationshipStrip/);
 const css=fs.readFileSync(path.join(__dirname,'../css/story-rpg.css'),'utf8');
 assert.match(css,/prefers-reduced-motion:reduce/);
});
