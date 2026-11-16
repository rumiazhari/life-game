'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'life-game.html'),'utf8');
const responsive=fs.readFileSync(path.join(root,'css/mobile-adaptive.css'),'utf8');
const original=fs.readFileSync(path.join(root,'css/style.css'),'utf8');
const rpg=fs.readFileSync(path.join(root,'css/story-rpg.css'),'utf8');

test('adaptive stylesheet overrides the old desktop and story rules without masking the page',()=>{
 const base=html.indexOf('href="css/style.css');
 const story=html.indexOf('href="css/story-rpg.css');
 const mobile=html.indexOf('href="css/mobile-adaptive.css?v=20261116-android1"');
 assert.ok(base>0 && story>base && mobile>story);
 assert.match(html,/name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/);
 assert.match(original,/\.wb-main\{grid-template-columns:minmax\(170px/);
 assert.match(responsive,/\.wb-main\{grid-template-columns:minmax\(0,1fr\)!important\}/);
 assert.doesNotMatch(responsive,/body\s*\{[^}]*overflow-x:\s*hidden/);
});
test('dossier navigation reflows without removing original button handlers',()=>{
 for(const id of ['btn-stories','btn-map','btn-hold','btn-caselog','btn-achieve','btn-sound']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(responsive,/\.tabstrip\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(responsive,/\.tabstrip \.dtab-file\{[\s\S]*?grid-column:span 2/);
 assert.match(responsive,/\.tabstrip \.dtab\{min-height:44px\}/);
 assert.match(html,/id="btn-achieve"[^>]*aria-label="Commendations and achievements"/);
});
test('world status and Section C adapt to component width and small screens',()=>{
 assert.match(responsive,/\.world-brief\{container-type:inline-size\}/);
 assert.match(responsive,/\.lv-ledger\{container-type:inline-size\}/);
 for(const x of [640,360,335])assert.match(responsive,new RegExp('@container \\(max-width:'+x+'px\\)'));
 assert.match(responsive,/\.wb-metrics\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}/);
 assert.match(responsive,/\.lv-world-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});
test('decision sheets vertically scroll with no sticky footer overshoot',()=>{
 assert.match(responsive,/\.overlay \.plansheet\{[\s\S]*?max-height:100dvh;overflow-y:auto;overflow-x:hidden/);
 assert.match(responsive,/#planWrap \.ps-foot\.sticky\{[\s\S]*?margin-inline:0!important/);
 assert.match(responsive,/#planWrap \.focus-choice-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(responsive,/body:has\(\.overlay:not\(\.hidden\)\) \.actionbar/);
 for(const id of ['planWrap','storyWrap','mapWrap','jobWrap','medicalWrap','householdWrap']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(rpg,/@media\(max-width:580px\)/);
});
test('map retains interactive height and an independently scrollable panel',()=>{
 assert.match(responsive,/#mapWrap \.map-sheet\{[\s\S]*?height:100dvh;min-height:0;max-height:100dvh;[\s\S]*?overflow-y:auto/);
 assert.match(responsive,/#mapWrap \.map-canvas,#mapWrap \.national-map-canvas\{[\s\S]*?height:clamp\(205px,37dvh,360px\)!important/);
 assert.match(responsive,/#mapWrap \.map-controls \.map-ctl\{min-width:42px;min-height:44px\}/);
 assert.match(responsive,/@media \(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(responsive,/overscroll-behavior:contain/);
});
test('Android safe area, reduced motion, and dynamic-value wrapping are accounted for',()=>{
 assert.match(responsive,/env\(safe-area-inset-bottom\)/);
 assert.match(responsive,/overflow-wrap:anywhere/);
 assert.match(responsive,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(responsive,/-webkit-text-size-adjust:100%/);
 assert.match(responsive,/max-inline-size:100%/);
});
