'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'life-game.html'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

assert.doesNotMatch(html,/(?:src|href)=['"]\//,'the game must not use root-absolute asset paths');
assert.doesNotMatch(html,/url\(['"]?\//,'the game CSS and inline URLs must not assume the domain root');
assert.match(html,/href="css\/style\.css/,'the stylesheet path must remain relative');
assert.match(html,/src="js\/main\.js(?:\?[^"']+)?"/,'the main script path must remain relative');
assert.match(index,/url=life-game\.html/,'index.html must redirect with a relative URL');
assert.match(index,/href="life-game\.html"/,'index.html must provide a relative fallback link');

console.log('Pages path checks: ok');
