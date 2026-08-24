'use strict';
/* ================= LIFE FILE — ILLUSTRATION SYSTEM (presentation only) ====
 *
 * Deterministic inline-SVG artwork for the dossier: persistent character
 * portraits, KARSEN FILES character busts, and contextual life-event scene
 * families. This module is STRICTLY PRESENTATION:
 *
 *   - it READS game state but never writes World/S/Lineage/Hold/NPCs;
 *   - it uses its own internal FNV-1a + xorshift hash streams keyed on
 *     stable visual inputs (ids, names, ages) -- never Math.random(),
 *     never the shared Random stream, never WorldSimulation.streamFor();
 *   - identical descriptors produce byte-identical SVG on every render;
 *   - generated art is cached by (identity | age band | context) and never
 *     caches mutable game objects themselves;
 *   - no network, no raster assets, no external libraries.
 *
 * The same person renders recognizably the same across household panels,
 * story episodes and later years; age bands alter proportions, hairline,
 * grey, wrinkles, clothing and photograph wear while keeping the identity.
 * ========================================================================= */
(function(root){

  /* ---------------- deterministic hashing (internal, isolated) ---------- */
  function fnv1a(str){
    var h=0x811c9dc5>>>0, s=String(str==null?'':str);
    for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; }
    return h>>>0;
  }
  function rngFor(seed){
    var h=fnv1a(seed)||0x9e3779b9;
    var next=function(){
      h^=h<<13; h>>>=0; h^=h>>>17; h^=h<<5; h>>>=0;
      return h/4294967296;
    };
    next.int=function(min,max){ return min+Math.floor(next()*(max-min+1)); };
    next.pick=function(arr){ return arr[Math.floor(next()*arr.length)%arr.length]; };
    next.range=function(a,b){ return a+next()*(b-a); };
    next.chance=function(p){ return next()<p; };
    return next;
  }

  /* ---------------- caches (bounded, keyed by stable strings) ----------- */
  var CACHE_MAX=512;
  var identityCache=new Map(), portraitCache=new Map(), sceneCache=new Map(), sigCache=new Map();
  function cacheSet(map,key,value){
    if(map.size>=CACHE_MAX){ var first=map.keys().next(); if(!first.done) map.delete(first.value); }
    map.set(key,value); return value;
  }

  /* ---------------- palette (belongs to the Bureau) --------------------- */
  var INK='#2b2318', DARK='#3a2f1e', RED='#a83226', BLUE='#31507e', OLIVE='#5a6640',
      AMBER='#b08a3e', PAPER='#e6dcc0', CREAM='#efe6cd';
  var SKIN=[['#dbC5A0'.toLowerCase(),'#b39a71'],['#d2b98e','#a8895f'],['#c9ad80','#9c7d52'],
            ['#b99872','#8f7048'],['#a5825d','#7a5a3a'],['#8a6746','#61452b']];
  var HAIRC=[['#241c12','#171008'],['#3a2c18','#251a0d'],['#57402a','#3a2a17'],
             ['#1d1a1c','#101012'],['#6e5335','#4d3820'],['#4a3a2e','#2f231b']];
  var CLOTH=[['#473a27','#2e2517'],['#5a4b34','#3d3121'],['#31507e','#22375a'],
             ['#2e6b46','#1d472e'],['#6e3f33','#492a20'],['#3f3a2c','#2a261c']];
  var GREY_TARGET=['#b9b2a4','#8f887a'];

  function lerpHex(hex,t,target){
    var a=parseInt(hex.slice(1),16), b=parseInt(target.slice(1),16);
    var r=Math.round(((a>>16)&255)+(((b>>16)&255)-((a>>16)&255))*t);
    var g=Math.round(((a>>8)&255)+(((b>>8)&255)-((a>>8)&255))*t);
    var bl=Math.round((a&255)+((b&255)-(a&255))*t);
    function hx(v){ var s=v.toString(16); return s.length<2?'0'+s:s; }
    return '#'+hx(r)+hx(g)+hx(bl);
  }
  function greyBlend(hex,t){ if(t<=0) return hex; return lerpHex(hex,Math.min(1,t),GREY_TARGET[0]); }
  function greyT(age){ var a=Number(age)||0; if(a<45) return 0; return Math.min(.78,(a-45)/34*.78+(a>=70?.15:0)); }

  /* ---------------- age bands ------------------------------------------- */
  function ageBandOf(age){
    var a=Number(age)||0;
    if(a<3) return 'infant'; if(a<13) return 'child'; if(a<18) return 'teen';
    if(a<29) return 'young'; if(a<45) return 'adult'; if(a<60) return 'middle';
    return 'elder';
  }
  var BAND_ORDER=['infant','child','teen','young','adult','middle','elder'];

  /* ---------------- stable visual identity per person id ---------------- */
  function visualIdentity(id){
    var key=String(id==null?'anon':id);
    if(identityCache.has(key)) return identityCache.get(key);
    var r=rngFor('lf-face:'+key);
    var f={
      key:key,
      skin:r.int(0,SKIN.length-1),
      hairColor:r.int(0,HAIRC.length-1),
      hairStyleM:r.int(0,5),
      hairStyleF:r.int(0,5),
      faceShape:r.int(0,3),
      eyes:r.int(0,2),
      nose:r.int(0,3),
      mouth:r.int(0,3),
      brows:r.int(0,2),
      beard:r.int(0,3),
      glasses:r.chance(.24),
      mole:r.chance(.16),
      freckles:r.chance(.3),
      cloth:r.int(0,CLOTH.length-1),
      tie:r.chance(.5),
      pendant:r.chance(.45),
      collar:r.int(0,2),
      earScale:r.range(.85,1.15),
      jaw:r.range(-1.4,1.4)
    };
    return cacheSet(identityCache,key,f);
  }
  /* Compact structural fingerprint of the identity (used by tests to prove
   * two different ids really differ, and that aging preserves identity). */
  function featureSignature(id){
    var f=visualIdentity(id);
    var key='skin'+f.skin+'|hc'+f.hairColor+'|hm'+f.hairStyleM+'|hf'+f.hairStyleF+
      '|fs'+f.faceShape+'|ey'+f.eyes+'|no'+f.nose+'|mo'+f.mouth+'|bw'+f.brows+
      '|bd'+f.beard+'|gl'+(f.glasses?1:0)+'|ml'+(f.mole?1:0)+'|fk'+(f.freckles?1:0)+
      '|cl'+f.cloth+'|ti'+(f.tie?1:0)+'|co'+f.collar;
    return key;
  }

  /* ---------------- descriptor normalization ---------------------------- */
  function normDescriptor(d){
    d=d||{};
    var sex=d.sex==='M'?'M':d.sex==='F'?'F':'X';
    return {
      id:String(d.id||d.identityId||'anon'),
      sex:sex, age:Math.max(0,Number(d.age)||0),
      role:String(d.role||''),
      name:String(d.name||''),
      deceased:!!d.deceased,
      clothing:String(d.clothing||''),
      band:ageBandOf(d.age)
    };
  }

  /* ---------------- hair renderers --------------------------------------- */
  /* Head box: cx=50, cy=46, rx/ry by face; hairline drops by `rec` px. */
  function maleHair(style,col,rec,band){
    var top=22+rec, s='';
    if(style===0) s='<path d="M31 '+(44+rec*.4)+' Q31 '+(top+3)+' 50 '+(top+1)+' Q69 '+(top+3)+' 69 '+(44+rec*.4)+' Q69 '+(top+11)+' 50 '+(top+10)+' Q31 '+(top+11)+' 31 '+(44+rec*.4)+' Z" fill="'+col+'"/>';
    else if(style===1) s='<path d="M30 '+(46+rec*.4)+' Q29 '+(top+2)+' 50 '+(top+1)+' Q71 '+(top+2)+' 70 '+(46+rec*.4)+' L68 '+(38+rec)+' Q60 '+(top+8)+' 44 '+(top+10)+' Q34 '+(top+12)+' 32 '+(40+rec)+' Z" fill="'+col+'"/><path d="M36 '+(top+9)+' Q48 '+(top+6)+' 60 '+(top+9)+'" stroke="'+col+'" stroke-width="2.2" fill="none"/>';
    else if(style===2) s='<path d="M34 '+(38+rec)+' Q37 '+(top+4)+' 50 '+(top+3)+' Q63 '+(top+4)+' 66 '+(38+rec)+' Q60 '+(top+9)+' 50 '+(top+9)+' Q40 '+(top+9)+' 34 '+(38+rec)+' Z" fill="'+col+'"/>';
    else if(style===3) s='<path d="M30 '+(42+rec*.5)+' L31 '+(top+2)+' Q50 '+(top-1)+' 69 '+(top+2)+' L70 '+(42+rec*.5)+' L67 '+(40+rec)+' L50 '+(top+9)+' L33 '+(40+rec)+' Z" fill="'+col+'"/>';
    else if(style===4){ var b=''; for(var i=0;i<5;i++){ var bx=34+i*8; b+='<circle cx="'+bx+'" cy="'+(top+5+((i%2)*2))+'" r="'+(5.5-(i===0||i===4?1:0))+'" fill="'+col+'"/>'; } s=b; }
    else s='<path d="M30 '+(46+rec*.5)+' Q30 '+(top+8)+' 36 '+(top+8)+' Q33 '+(top+14)+' 31 '+(48+rec)+' Z" fill="'+col+'"/><path d="M70 '+(46+rec*.5)+' Q70 '+(top+8)+' 64 '+(top+8)+' Q67 '+(top+14)+' 69 '+(48+rec)+' Z" fill="'+col+'"/>';
    return s;
  }
  function femaleHair(style,col,rec,band){
    var top=22+rec, s='';
    if(style===0) s='<path d="M27 '+(58+rec*.3)+' Q23 '+(top+2)+' 50 '+(top+1)+' Q77 '+(top+2)+' 73 '+(58+rec*.3)+' Q70 '+(44+rec)+' 64 '+(40+rec)+' Q60 '+(top+9)+' 50 '+(top+9)+' Q40 '+(top+9)+' 36 '+(40+rec)+' Q30 '+(44+rec)+' 27 '+(58+rec*.3)+' Z" fill="'+col+'"/>';
    else if(style===1) s='<path d="M28 '+(48+rec*.4)+' Q26 '+(top+2)+' 50 '+(top+1)+' Q74 '+(top+2)+' 72 '+(48+rec*.4)+' Q66 '+(top+8)+' 50 '+(top+8)+' Q34 '+(top+8)+' 28 '+(48+rec*.4)+' Z" fill="'+col+'"/><ellipse cx="50" cy="'+(top-3)+'" rx="11" ry="7" fill="'+col+'"/>';
    else if(style===2) s='<path d="M24 '+(76)+' Q20 '+(top+2)+' 50 '+(top+1)+' Q80 '+(top+2)+' 76 76 Q70 '+(50+rec)+' 65 '+(41+rec)+' Q60 '+(top+9)+' 50 '+(top+9)+' Q40 '+(top+9)+' 35 '+(41+rec)+' Q30 '+(50+rec)+' 24 76 Z" fill="'+col+'"/>';
    else if(style===3) s='<path d="M30 '+(44+rec*.4)+' Q30 '+(top+2)+' 50 '+(top+1)+' Q70 '+(top+2)+' 70 '+(44+rec*.4)+' Q68 '+(top+10)+' 50 '+(top+9)+' Q32 '+(top+10)+' 30 '+(44+rec*.4)+' Z" fill="'+col+'"/>';
    else if(style===4) s='<path d="M28 '+(54+rec*.3)+' Q24 '+(top+2)+' 50 '+(top+1)+' Q76 '+(top+2)+' 72 '+(54+rec*.3)+' Q68 '+(42+rec)+' 61 '+(39+rec)+' Q56 '+(top+8)+' 50 '+(top+8)+' Q44 '+(top+8)+' 39 '+(39+rec)+' Q32 '+(42+rec)+' 28 '+(54+rec*.3)+' Z" fill="'+col+'"/><path d="M28 '+(54+rec*.3)+' q-3 12 -1 22" stroke="'+col+'" stroke-width="5" fill="none"/><path d="M72 '+(54+rec*.3)+' q3 12 1 22" stroke="'+col+'" stroke-width="5" fill="none"/>';
    else s='<path d="M26 '+(60+rec*.3)+' Q22 '+(top+2)+' 50 '+(top+1)+' Q78 '+(top+2)+' 74 '+(60+rec*.3)+' Q72 '+(46+rec)+' 63 '+(39+rec)+' Q58 '+(top+8)+' 42 '+(top+8)+' Q37 '+(39+rec)+' 26 '+(60+rec*.3)+' Z" fill="'+col+'"/><path d="M40 '+(top+7)+' Q50 '+(top+3)+' 60 '+(top+7)+'" stroke="'+lerpHex(col,.5,GREY_TARGET[1])+'" stroke-width="1.4" fill="none"/>';
    return s;
  }

  /* ---------------- the portrait itself ---------------------------------- */
  function personPortrait(descriptor,options){
    var d=normDescriptor(descriptor), opts=options||{};
    var band=d.band, cacheKey='p|'+featureSignature(d.id)+'|'+band+'|'+d.sex+'|'+
      (d.deceased?'d':'a')+'|'+d.clothing+'|'+(opts.bust?'b':'card');
    if(portraitCache.has(cacheKey)) return portraitCache.get(cacheKey);

    var f=visualIdentity(d.id), r=rngFor('pose:'+d.id+':'+band);
    var isMale=d.sex==='M', knownSex=isMale||d.sex==='F';
    var skin=SKIN[f.skin], hairCol=greyBlend(HAIRC[f.hairColor][0],greyT(d.age));
    var cloth=CLOTH[f.cloth];
    var gid='lf'+fnv1a(cacheKey).toString(36);
    var rec=({infant:.5,child:0,teen:0,young:0,adult:1,middle:3,elder:5})[band];
    var wrinkleOpacity=({infant:0,child:0,teen:0,young:.06,adult:.16,middle:.28,elder:.4})[band];
    var wearOpacity=({infant:.04,child:.05,teen:.07,young:.09,adult:.13,middle:.19,elder:.26})[band];
    /* face geometry per band (same underlying identity, different age shell) */
    var fw,fh,cy;
    if(band==='infant'){fw=18.5;fh=18;cy=48;}
    else if(band==='child'){fw=19;fh=20;cy=47;}
    else if(band==='teen'){fw=19.5;fh=22.5;cy=46;}
    else if(band==='young'){fw=f.faceShape===3?21.5:20;fh=24;cy=46;}
    else if(band==='adult'){fw=(f.faceShape===3?22:20.5)+f.jaw*.4;fh=24;cy=46;}
    else if(band==='middle'){fw=21+f.jaw*.5;fh=23.5;cy=46.5;}
    else {fw=20+f.jaw*.6;fh=23;cy=47;}
    var figScale=band==='infant'?.8:band==='child'?.88:band==='teen'?.95:1;

    var parts=[];
    parts.push('<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">');
    parts.push('<defs>'+
      '<radialGradient id="'+gid+'v" cx="50%" cy="40%" r="78%"><stop offset="52%" stop-color="'+PAPER+'"/><stop offset="100%" stop-color="#c9bb97"/></radialGradient>'+
      '<linearGradient id="'+gid+'f" x1="0" y1="0" x2="1" y2="0"><stop offset="50%" stop-color="'+skin[0]+'"/><stop offset="100%" stop-color="'+skin[1]+'"/></linearGradient>'+
      '<filter id="'+gid+'n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer></filter>'+
      '</defs>');
    parts.push('<rect width="100" height="120" fill="url(#'+gid+'v)"/>');

    /* figure (scaled for children; slight stoop for elders) */
    var tf='translate(50 118) scale('+figScale+') translate(-50 -118)';
    if(band==='elder') tf+=' rotate(-1.6 50 118)';
    parts.push('<g transform="'+tf+'">');
    /* long hair behind (women, styles 2/4) */
    var hstyle=knownSex?(isMale?f.hairStyleM:f.hairStyleF):f.hairStyleM;
    if(!isMale&&(hstyle===2||hstyle===4)) parts.push(femaleHair(hstyle,hairCol,rec,band));
    /* shoulders + clothing */
    parts.push('<path d="M8 120 Q10 92 30 86 Q40 82 50 82 Q60 82 70 86 Q90 92 92 120 Z" fill="'+cloth[0]+'"/>');
    parts.push('<path d="M8 120 Q10 96 26 89 L26 120 Z" fill="'+cloth[1]+'"/><path d="M92 120 Q90 96 74 89 L74 120 Z" fill="'+cloth[1]+'"/>');
    if(opts.bust){ /* tighter framing crops lower torso */ }
    var collarCol=['#d8cba6','#efe6cd','#cfc19a'][f.collar];
    parts.push('<path d="M40 84 Q50 92 60 84 L57 104 L43 104 Z" fill="'+collarCol+'" opacity=".9"/>');
    if(isMale&&f.tie&&band!=='infant'&&band!=='child') parts.push('<path d="M50 90 L46.5 95 L50 112 L53.5 95 Z" fill="'+(f.beard===1?RED:DARK)+'"/>');
    if(!isMale&&f.pendant) parts.push('<circle cx="50" cy="99" r="2" fill="'+AMBER+'"/>');
    if(d.clothing==='uniform') parts.push('<circle cx="66" cy="97" r="2.6" fill="'+RED+'"/><line x1="30" y1="91" x2="38" y2="89" stroke="'+collarCol+'" stroke-width="3"/>');
    else if(d.clothing==='worker') parts.push('<rect x="41" y="92" width="18" height="28" fill="'+collarCol+'" opacity=".55"/>');
    else if(d.clothing==='gown') parts.push('<path d="M34 88 L50 116 L66 88" fill="none" stroke="'+AMBER+'" stroke-width="4" opacity=".7"/>');
    /* neck + head */
    parts.push('<rect x="42" y="64" width="16" height="22" rx="7" fill="'+skin[1]+'"/>');
    parts.push('<ellipse cx="'+(50-fw)+'" cy="'+(cy+2)+'" rx="'+(3.4*f.earScale)+'" ry="'+(5*f.earScale)+'" fill="'+skin[1]+'"/>'+
               '<ellipse cx="'+(50+fw)+'" cy="'+(cy+2)+'" rx="'+(3.4*f.earScale)+'" ry="'+(5*f.earScale)+'" fill="'+skin[1]+'"/>');
    parts.push('<ellipse cx="50" cy="'+cy+'" rx="'+fw+'" ry="'+fh+'" fill="url(#'+gid+'f)"/>');
    /* front hair */
    if(isMale||knownSex===false) parts.push(maleHair(hstyle,hairCol,rec,band));
    else parts.push(femaleHair(hstyle,hairCol,rec,band));
    /* face */
    var eyY=cy+3, exL=50-fw*.42, exR=50+fw*.42;
    var eyeSpread=f.eyes===1?1.12:f.eyes===2?.9:1;
    exL=50-(exL-50)*eyeSpread; exR=50+(exR-50)*eyeSpread;
    var lidDrop=band==='elder'?1.2:band==='middle'?.7:0;
    parts.push('<g>'+
      '<ellipse cx="'+exL+'" cy="'+eyY+'" rx="3" ry="2.1" fill="#f1ead6"/><ellipse cx="'+exR+'" cy="'+eyY+'" rx="3" ry="2.1" fill="#f1ead6"/>'+
      '<circle cx="'+exL+'" cy="'+(eyY+.2)+'" r="1.35" fill="'+INK+'"/><circle cx="'+exR+'" cy="'+(eyY+.2)+'" r="1.35" fill="'+INK+'"/>'+
      '<path d="M'+(exL-3)+' '+(eyY-lidDrop-.6)+' q3 -1.6 6 -.4" stroke="'+INK+'" stroke-width=".8" fill="none" opacity=".8"/>'+
      '<path d="M'+(exR-3)+' '+(eyY-lidDrop-.6)+' q3 -1.6 6 -.4" stroke="'+INK+'" stroke-width=".8" fill="none" opacity=".8"/>'+
      '</g>');
    var browY=eyY-3.6, bw=f.brows===2?2.6:3.2;
    parts.push('<path d="M'+(exL-3)+' '+(browY+(f.brows===1?.8:0))+' q3 -1.4 6 0" stroke="'+hairCol+'" stroke-width="'+(isMale?1.6:1.1)+'" fill="none"/>'+
      '<path d="M'+(exR-3)+' '+(browY+(f.brows===1?.8:0))+' q3 -1.4 6 0" stroke="'+hairCol+'" stroke-width="'+(isMale?1.6:1.1)+'" fill="none"/>');
    var nosePath=['M50 '+(cy+4)+' L48.6 '+(cy+11)+' Q50 '+(cy+13)+' 51.4 '+(cy+11),
                  'M50 '+(cy+4)+' Q48 '+(cy+9)+' 47.8 '+(cy+12)+' Q50 '+(cy+13.6)+' 52 '+(cy+11.6),
                  'M49 '+(cy+5)+' Q47 '+(cy+12)+' 51 '+(cy+13)+' Q53.5 '+(cy+12)+' 52 '+(cy+8),
                  'M50 '+(cy+4)+' L50 '+(cy+12)+' M47.8 '+(cy+12)+' Q50 '+(cy+13.8)+' 52.2 '+(cy+12)][f.nose];
    parts.push('<path d="'+nosePath+'" stroke="'+INK+'" stroke-width=".9" fill="none" opacity=".55"/>');
    var moY=cy+17.5, moW=band==='infant'||band==='child'?3.4:4.6;
    var mouthPath=['M'+(50-moW)+' '+moY+' Q50 '+(moY+2.4)+' '+(50+moW)+' '+moY,
                   'M'+(50-moW)+' '+(moY+.6)+' Q50 '+(moY+3)+' '+(50+moW)+' '+(moY+.6)+' Q50 '+(moY+1.4)+' '+(50-moW)+' '+(moY+.6),
                   'M'+(50-moW)+' '+(moY+1)+' L'+(50+moW)+' '+(moY+1),
                   'M'+(50-moW)+' '+(moY+1.2)+' Q50 '+(moY-1)+' '+(50+moW)+' '+(moY+1.2)][f.mouth];
    parts.push('<path d="'+mouthPath+'" stroke="'+INK+'" stroke-width="1.2" fill="none" opacity=".8"/>');
    /* facial hair (adult males only) */
    if(isMale&&band!=='infant'&&band!=='child'){
      if(f.beard===1&&band!=='teen') parts.push('<path d="M38 '+(cy+14)+' Q50 '+(cy+24)+' 62 '+(cy+14)+' Q58 '+(cy+26)+' 50 '+(cy+26)+' Q42 '+(cy+26)+' 38 '+(cy+14)+' Z" fill="'+hairCol+'" opacity=".28"/>');
      else if(f.beard===2) parts.push('<path d="M41 '+(cy+13.5)+' Q50 '+(cy+10.5)+' 59 '+(cy+13.5)+' Q50 '+(cy+16.5)+' 41 '+(cy+13.5)+' Z" fill="'+hairCol+'" opacity=".7"/>');
      else if(f.beard===3&&band!=='teen') parts.push('<path d="M37 '+(cy+10)+' Q50 '+(cy+30)+' 63 '+(cy+10)+' Q60 '+(cy+28)+' 50 '+(cy+28)+' Q40 '+(cy+28)+' 37 '+(cy+10)+' Z" fill="'+hairCol+'" opacity=".5"/><path d="M41 '+(cy+13.5)+' Q50 '+(cy+10.5)+' 59 '+(cy+13.5)+' Q50 '+(cy+16.5)+' 41 '+(cy+13.5)+' Z" fill="'+hairCol+'" opacity=".85"/>');
    }
    /* age marks: crow's feet, nasolabial folds, forehead lines, bags */
    if(wrinkleOpacity>0){
      var wg='<g stroke="'+INK+'" stroke-width=".8" fill="none" opacity="'+wrinkleOpacity.toFixed(2)+'">';
      if(band!=='young'){ wg+='<path d="M'+(exL-4.5)+' '+(eyY+2)+' q-1.6 1.6 -1.4 3.4"/><path d="M'+(exR+4.5)+' '+(eyY+2)+' q1.6 1.6 1.4 3.4"/>'; }
      wg+='<path d="M'+(50-moW-1)+' '+(moY+2.4)+' q-2.4 2.6 -1.8 5.4"/><path d="M'+(50+moW+1)+' '+(moY+2.4)+' q2.4 2.6 1.8 5.4"/>';
      if(band==='middle'||band==='elder') wg+='<path d="M40 '+(cy-12)+' q10 -3 20 0"/><path d="M41 '+(cy-15)+' q9 -2.6 18 0"/>';
      if(band==='elder') wg+='<path d="M'+(exL-3)+' '+(eyY+3.4)+' q3 1.4 6 .4"/><path d="M'+(exR-3)+' '+(eyY+3.4)+' q3 1.4 6 .4"/>';
      wg+='</g>';
      parts.push(wg);
    }
    if(band==='child'&&f.freckles) parts.push('<g fill="'+skin[1]+'"><circle cx="43" cy="'+(cy+9)+'" r=".7"/><circle cx="46" cy="'+(cy+10.5)+'" r=".7"/><circle cx="55" cy="'+(cy+10)+'" r=".7"/><circle cx="58" cy="'+(cy+9)+'" r=".7"/></g>');
    if(f.mole) parts.push('<circle cx="'+(50+fw*.55)+'" cy="'+(cy+13)+'" r=".8" fill="'+INK+'" opacity=".5"/>');
    if(f.glasses&&band!=='infant') parts.push('<g stroke="'+DARK+'" stroke-width="1" fill="none"><rect x="'+(exL-4)+'" y="'+(eyY-3)+'" width="8" height="6" rx="2"/><rect x="'+(exR-4)+'" y="'+(eyY-3)+'" width="8" height="6" rx="2"/><line x1="'+(exL+4)+'" y1="'+eyY+'" x2="'+(exR-4)+'" y2="'+eyY+'"/></g>');
    parts.push('</g>');

    /* archival photograph treatment */
    parts.push('<rect width="100" height="120" fill="#d8cba6" opacity="'+wearOpacity+'"/>');
    if(band==='elder'||band==='middle') parts.push('<rect width="100" height="120" fill="#8d8676" opacity="'+(d.deceased?'.2':'.08')+'"/>');
    parts.push('<rect width="100" height="120" filter="url(#'+gid+'n)" opacity="0.09"/>');
    parts.push('<g stroke="'+CREAM+'" stroke-width="0.5" opacity="0.22"><line x1="14" y1="6" x2="20" y2="40"/><line x1="82" y1="80" x2="88" y2="112"/></g>');
    parts.push('<rect width="100" height="120" fill="none" stroke="'+CREAM+'" stroke-width="6" opacity="0.3"/>');
    parts.push('</svg>');
    var out=parts.join('');
    return cacheSet(portraitCache,cacheKey,out);
  }

  /* ---------------- resolvers (READ-ONLY views of game state) ------------ */
  function subjectDescriptor(subject){
    if(!subject) return null;
    var clothing=Number(subject.jobTier)>=3?'clerk':Number(subject.jobTier)>=1?'worker':'';
    if(subject.jobName==='Conscript') clothing='uniform';
    return normDescriptor({id:String(subject.npcId||('subject:'+(subject.id||'sf'))),
      sex:subject.sex, age:subject.age, name:(subject.first||'')+' '+(subject.last||''),
      role:subject.jobName||'', deceased:subject.alive===false, clothing:clothing});
  }
  function npcDescriptor(npc,world){
    if(!npc) return null;
    var year=Number(world&&world.year)||0;
    var age=npc.birthYear!=null?Math.max(0,year-Number(npc.birthYear)):25;
    var sector=npc.employment&&npc.employment.status==='employed'?String(npc.employment.sector||''):'';
    var clothing=/militar|guard|police|garrison/i.test(sector)?'uniform':/labor|dock|foundry|rail|timber/i.test(sector)?'worker':'';
    var tags=Array.isArray(npc.roleTags)?npc.roleTags:[];
    return normDescriptor({id:String(npc.id),sex:npc.sex,age:age,name:npc.name||((npc.firstName||'')+' '+(npc.lastName||'')),
      role:tags[0]||(npc.isSubject?'subject':'acquaintance'),deceased:npc.alive===false,clothing:clothing});
  }
  function contactDescriptor(contact,year){
    if(!contact) return null;
    var y=Number(year)||(typeof root.World==='object'&&root.World?root.World.year:0);
    var age=contact.birthYear!=null&&y?Math.max(0,y-Number(contact.birthYear)):(Number(contact.metAge)||25)+(contact.__ageDrift||0);
    return normDescriptor({id:'contact:'+String(contact.cid||contact.name||'x'),sex:contact.sex,age:age,
      name:String(contact.name||''),role:String(contact.role||'contact'),deceased:contact.alive===false});
  }
  function kinDescriptor(member,year){
    if(!member) return null;
    var y=Number(year)||(typeof root.World==='object'&&root.World?root.World.year:0);
    return normDescriptor({id:'kin:'+String(member.mid||member.first||'k'),sex:member.sex,
      age:y&&member.dob?Math.max(0,y-Number(member.dob)):0,name:(member.first||'')+' '+(member.last||''),
      role:String(member.relation||'kin'),deceased:member.alive===false});
  }
  function parentDescriptor(parent,relation,subject){
    if(!parent) return null;
    var r=rngFor('parent-age:'+(parent.name||relation));
    var ageGuess=((subject&&Number(subject.age))||25)+28+r.int(0,10);
    return normDescriptor({id:'parent:'+relation+':'+String(parent.name||relation),sex:relation==='mother'?'F':'M',
      age:ageGuess,name:String(parent.name||''),role:relation,deceased:parent.alive===false});
  }
  /* Resolve a KARSEN FILES cast entry to a real person descriptor. */
  function resolveCastMember(entry,world,subject){
    if(!entry) return null;
    var bind=entry.bind==null?'':String(entry.bind);
    if(entry.npcId&&world&&world.npcs&&world.npcs[entry.npcId]) return npcDescriptor(world.npcs[entry.npcId],world);
    if(bind==='subject'||entry.key==='you') return subjectDescriptor(subject);
    if(bind.indexOf('kin:')===0&&root.Lineage&&Array.isArray(root.Lineage.members)){
      var kin=root.Lineage.members.find(function(m){return String(m&&m.mid)===bind.slice(4);});
      if(kin) return kinDescriptor(kin,world&&world.year);
    }
    if(bind.indexOf('contact:')===0&&subject&&Array.isArray(subject.contacts)){
      var c=subject.contacts.find(function(x){return String(x&&x.cid)===bind.slice(8);});
      if(c) return contactDescriptor(c,world&&world.year);
    }
    if(bind.indexOf('mother:')===0) return parentDescriptor(subject&&subject.mother,'mother',subject);
    if(bind.indexOf('father:')===0) return parentDescriptor(subject&&subject.father,'father',subject);
    /* stable fallback: the episode's own cast key is a stable visual handle */
    if(entry.key&&entry.key!=='narrator') return normDescriptor({id:'cast:'+String(runKeySalt(entry))+':'+String(entry.key),
      sex:/wife|spouse|mother|her|she|woman/i.test(String(entry.label||entry.key))?'F':'M',
      age:30+rngFor('cast-age:'+entry.key).int(0,25),name:String(entry.label||entry.key),role:entry.key});
    return null;
  }
  function runKeySalt(entry){ return String(entry.bind||'')+String(entry.label||''); }
  function storyPortraitDescriptor(run,speakerKey,label,world,subject){
    if(!run||!run.cast||speakerKey==='narrator'||speakerKey==='you'){
      if(speakerKey==='you') return subjectDescriptor(subject);
      return null;
    }
    var entry=run.cast[speakerKey];
    if(!entry) return null;
    return resolveCastMember({key:speakerKey,label:label||entry.label,bind:entry.bind,npcId:entry.npcId},world,subject);
  }

  /* ======================================================================
   *  EVENT SCENE FAMILIES — reusable illustrated evidence plates
   * ====================================================================== */
  var W=320,H=180;
  function el(tag,attrs){ var s='<'+tag; for(var k in attrs){ if(attrs[k]!=null) s+=' '+k+'="'+attrs[k]+'"'; } return s+'/>'; }
  function rect(x,y,w,h,fill,extra){ return el('rect',Object.assign({x:x,y:y,width:w,height:h,fill:fill},extra||{})); }
  function circ(cx,cy,r,fill,extra){ return el('circle',Object.assign({cx:cx,cy:cy,r:r,fill:fill},extra||{})); }
  function ell(cx,cy,rx,ry,fill,extra){ return el('ellipse',Object.assign({cx:cx,cy:cy,rx:rx,ry:ry,fill:fill},extra||{})); }
  function path(d,fill,extra){ return el('path',Object.assign({d:d,fill:fill},extra||{})); }
  function pth(d,stroke,w,extra){ return el('path',Object.assign({d:d,stroke:stroke,'stroke-width':w,fill:'none','stroke-linecap':'round'},extra||{})); }
  function line(x1,y1,x2,y2,stroke,w,extra){ return el('line',Object.assign({x1:x1,y1:y1,x2:x2,y2:y2,stroke:stroke,'stroke-width':w==null?2:w},extra||{})); }

  /* standing ink-figure silhouette */
  function figure(x,y,s,opts){
    opts=opts||{}; var coat=opts.coat||DARK, head=opts.head||DARK;
    var dress=!!opts.dress;
    var g='<g transform="translate('+x+' '+y+') scale('+s+')">';
    g+=circ(0,-46,6.4,head);
    if(opts.hat) g+=rect(-8,-56,16,4,head)+rect(-5,-61,10,6,head);
    if(dress) g+=path('M-9 -40 Q0 -44 9 -40 L13 4 L-13 4 Z',coat);
    else{
      g+=path('M-8 -40 Q0 -43 8 -40 L10 -14 L4 -14 L4 -40 L-4 -40 L-4 -14 L-10 -14 Z',coat);
      g+=rect(-9,-15,7,15,coat)+rect(2,-15,7,15,coat);
    }
    g+='</g>'; return g;
  }
  function childFigure(x,y,s,opts){ return figure(x,y,(s||1)*.62,Object.assign({},opts,{coat:(opts&&opts.coat)||OLIVE})); }
  function seatedFigure(x,y,s,opts){
    opts=opts||{}; var coat=opts.coat||DARK;
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+circ(0,-34,6,coat)+
      path('M-8 -28 Q0 -31 8 -28 L9 -6 L-9 -6 Z',coat)+
      path('M8 -26 L16 -14 L13 -11 L5 -22 Z',coat)+
      rect(-11,-6,22,4,DARK)+'</g>';
  }
  function ground(y,fill){ return rect(0,y,W,H-y,fill||'#cbbc93'); }
  function sky(fill){ return rect(0,0,W,H,fill); }
  function sunOrMoon(x,y,r,fill,glow){ return circ(x,y,r,fill,glow?{class:'glowp'}:{}); }
  function house(x,y,s,wall){
    wall=wall||'#8a7350';
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      rect(-22,-26,44,26,wall)+path('M-26 -26 L0 -44 L26 -26 Z','#5c4326')+
      rect(-7,-14,14,14,'#4a3a26')+rect(-17,-20,7,7,'#e8dfc0',{opacity:'.85'})+rect(10,-20,7,7,'#e8dfc0',{opacity:'.7'})+'</g>';
  }
  function factory(x,y,s){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      rect(-40,-34,80,34,'#3f3428')+rect(-6,-52,12,20,'#332a20')+
      ell(-6,-54,9,5,'#cbb89a',{class:'smoke'})+ell(-12,-62,7,4,'#d8c8ac',{class:'smoke s2'})+
      rect(-34,-22,9,10,'#e8c95c',{opacity:'.8'})+rect(-18,-22,9,10,'#e8c95c',{opacity:'.55'})+rect(8,-22,9,10,'#e8c95c',{opacity:'.7'})+
      '</g>';
  }
  function trees(x,y,n,s){
    var g='<g transform="translate('+x+' '+y+') scale('+(s||1)+')">';
    for(var i=0;i<(n||2);i++){ var ox=i*26; g+=rect(ox-2,-16,4,16,'#4a3826')+circ(ox,-22,12,i%2?'#4e6b41':'#557447')+circ(ox-7,-16,7,'#476039'); }
    return g+'</g>';
  }
  function trainEngine(x,y,s,night){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      ell(58,-40,10,6,night?'#9aa2b8':'#cbb89a',{class:'smoke'})+ell(50,-50,7,4,night?'#8a93ab':'#d8c8ac',{class:'smoke s2'})+
      rect(0,-22,52,22,night?'#20283a':'#33302a')+rect(40,-34,18,34,night?'#181f2e':'#2a2722')+
      circ(12,0,7,night?'#141a28':'#221f1b')+circ(34,0,5,night?'#141a28':'#221f1b')+
      rect(-16,-12,16,12,night?'#20283a':'#33302a')+circ(-8,0,4,night?'#141a28':'#221f1b')+
      line(-24,4,86,4,INK,2.4)+'</g>';
  }
  function bed(x,y,s,occupied){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      rect(-30,-16,60,6,DARK)+rect(-30,-10,4,12,DARK)+rect(26,-10,4,12,DARK)+
      rect(-24,-20,20,6,'#efe6cd')+(occupied?ell(2,-14,16,6,'#b8a67e'):rect(-24,-10,50,4,'#8a7350'))+'</g>';
  }
  function deskLamp(x,y,s){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      rect(-24,-8,48,8,'#4a3a26')+rect(-14,-30,28,20,'#e8dfc0',{opacity:'.9'})+
      path('M8 -30 L14 -44 L22 -38 L14 -28 Z','#4a3a26')+ell(17,-36,7,3,'#ffe9a8',{class:'glowp'})+
      rect(-10,-38,10,8,'#8a7350')+'</g>';
  }
  function cradle(x,y,s){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      path('M-18 -14 Q0 -30 18 -14 L18 -2 L-18 -2 Z','#7a5c3a')+
      rect(-20,-2,40,4,'#5c4326')+rect(-17,4,4,8,'#5c4326')+rect(13,4,4,8,'#5c4326')+
      ell(0,-12,10,5,'#efe6cd')+'</g>';
  }
  function suitcaseStack(x,y,s){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      rect(-20,-14,40,14,'#6e5638')+rect(-16,-26,32,12,'#7d6444')+rect(-10,-32,20,6,'#5c4326')+
      line(-20,-7,20,-7,'#4a3826',1.6)+'</g>';
  }
  function lily(x,y,s){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      pth('M0 0 Q6 -18 2 -34','#4e6b41',2)+
      '<g transform="translate(2 -40)"><path d="M0 -6 Q5 0 0 7 Q-5 0 0 -6 Z" fill="#efe6cd" stroke="#c9bb97" stroke-width=".8"/>'+
      '<g fill="#efe6cd"><ellipse cx="-5" cy="-1" rx="4" ry="1.8" transform="rotate(-38 -5 -1)"/><ellipse cx="5" cy="-1" rx="4" ry="1.8" transform="rotate(38 5 -1)"/><ellipse cx="-3.6" cy="4.6" rx="4" ry="1.8" transform="rotate(-70 -3.6 4.6)"/><ellipse cx="3.6" cy="4.6" rx="4" ry="1.8" transform="rotate(70 3.6 4.6)"/></g>'+
      '<circle cx="0" cy="1" r="1.4" fill="'+AMBER+'"/></g></g>';
  }
  function sealedFolder(x,y,s){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      rect(-24,-16,48,32,'#c9a86a',{stroke:'#6b5631','stroke-width':'1.5'})+
      rect(-18,-22,20,8,'#d8c49a',{stroke:'#6b5631','stroke-width':'1'})+
      circ(6,-2,7,'none',{stroke:RED,'stroke-width':'2'})+circ(6,-2,2.4,RED)+
      line(-16,8,2,8,'#8a7350',1.2)+'</g>';
  }
  function medalLaurel(x,y,s){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      path('M-16 6 Q-22 -8 -10 -16','none',0,{stroke:'#4e6b41','stroke-width':'2.4'})+
      path('M16 6 Q22 -8 10 -16','none',0,{stroke:'#4e6b41','stroke-width':'2.4'})+
      circ(0,-2,9,AMBER,{stroke:'#7a5a1e','stroke-width':'2'})+
      path('M0 -8 L2.4 -3 L8 -2.4 L4 1.6 L5 7 L0 4.2 L-5 7 L-4 1.6 L-8 -2.4 L-2.4 -3 Z','#7a5a1e')+
      pth('M-4 -16 L-6 -28 M4 -16 L6 -28',RED,3)+'</g>';
  }
  function ministryFacade(x,y,s){
    var cols='',i; for(i=0;i<4;i++) cols+=rect(-30+i*20,-34,8,34,'#cfc19a',{stroke:'#8a7350','stroke-width':'.8'});
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      rect(-40,0,80,5,'#8a7350')+cols+path('M-40 -34 L0 -48 L40 -34 Z','#8a7350')+
      circ(0,-30,6,'none',{stroke:INK,'stroke-width':'1.4'})+circ(0,-30,2,INK)+'</g>';
  }
  function locationBackdrop(settlementId){
    var id=String(settlementId||''), m='';
    var base='opacity=".14"';
    if(/veskar|sundervik|kamenor/.test(id)) m=line(0,H-26,W,H-26,BLUE,3,{opacity:'.18'})+pth('M20 '+(H-18)+' q20 -6 40 0 M240 '+(H-14)+' q20 -6 40 0',BLUE,2,{opacity:'.2'})+rect(250,H-58,44,20,'#3f3428',base);
    else if(/eisenmark|oberhain/.test(id)) m=factory(252,H-24,1).replace(/class="smoke[^"]*"/g,'opacity="0"');
    else if(/rudava|marec/.test(id)) m=line(210,H-20,320,H-20,INK,2,{opacity:'.2'})+line(216,H-16,320,H-16,INK,1.4,{opacity:'.16','stroke-dasharray':'8 6'});
    else if(/krasnava|brezin/.test(id)) m=trees(236,H-22,3,.9).replace(/opacity/g,'opacity');
    else if(/branec|dobraven/.test(id)) m=ministryFacade(268,H-22,.9).replace(/stroke-width":"1.4"/g,'stroke-width":"1"');
    else if(/kostrin|svetlin/.test(id)) m=path('M250 '+(H-22)+' l14 -18 l14 18 z','#8a7350',{opacity:'.16'})+line(264,H-22,264,H-6,INK,2,{opacity:'.16'})+line(258,H-6,270,H-6,INK,2,{opacity:'.16'});
    else m=house(266,H-22,.8).replace(/opacity="\.\d+"/g,'opacity=".2"');
    return '<g>'+m+'</g>';
  }

  /* Each family: array of variant builders (r = variant rng, X = extra ctx). */
  var FAMILIES={
    birth:[function(){ return sky('#2a2f42')+sunOrMoon(262,36,15,'#e8e2c9',true)+
        path('M0 128 L90 128 L120 108 L200 108 L230 128 L320 128 L320 180 L0 180 Z','#4a3a2c')+
        cradle(150,150,1.5)+ell(150,138,34,7,'#5c4a34')+
        rect(196,116,44,40,'#1d2233',{stroke:'#2a3044','stroke-width':3})+line(218,116,218,156,'#2a3044',2)+
        rect(60,132,26,20,'#3a2f22',{stroke:'#2b2318','stroke-width':1.5})+circ(73,142,2,'#e8c95c',{class:'glowp'}); },
      function(){ return sky('#3a3428')+
        deskLamp(96,158,1.4)+seatedFigure(170,152,1.5,{coat:'#5a4b34',dress:true})+
        ell(196,124,10,7,'#efe6cd')+circ(196,118,5.5,'#cdb78f')+
        rect(214,146,52,10,'#4a3a26')+ground(156,'#57503f'); },
      function(r){ var x=60+r.int(0,30); return sky('#c9b98f')+sunOrMoon(70,44,17,'#f2e3ae',true)+
        ground(126,'#a8926c')+house(x,126,1.2)+trees(220,128,2,1.1)+
        cradle(160,160,1.2)+rect(206,148,16,8,'#efe6cd')+rect(228,150,12,6,'#efe6cd'); },
      function(){ return sky('#232840')+
        rect(96,28,130,110,'#151827',{stroke:'#2a3044','stroke-width':5})+line(161,28,161,138,'#2a3044',4)+
        sunOrMoon(120,60,12,'#efe6c8',{class:'glowp'})+
        rect(40,120,240,60,'#0d101b')+cradle(150,166,1.4); }],
    childhood:[function(r){ var fx=90+r.int(0,40); return sky('#d8cba6')+ground(132,'#a8926c')+
        house(fx,132,1.3)+trees(240,134,1,1.2)+
        line(40,168,280,168,'#8a7350',3)+circ(120,158,8,'none',{stroke:DARK,'stroke-width':2})+
        childFigure(190,164,1.4,{coat:RED}); },
      function(){ return sky('#e0d3ae')+ground(140,'#b3a077')+
        rect(60,96,90,44,'#c9b083',{stroke:'#8a6f45','stroke-width':2.5})+path('M52 96 L105 66 L158 96 Z','#7a4e33')+
        rect(78,114,16,20,'#5c4326')+rect(112,114,16,20,'#5c4326')+
        childFigure(230,158,1.5,{coat:BLUE})+circ(256,140,7,RED)+line(244,146,252,142,INK,1.5); },
      function(){ return sky('#cfd8bc')+
        trees(80,150,1,2)+ground(150,'#9caf8c')+
        rect(196,120,26,32,'#7a5c3a',{stroke:'#5c4326','stroke-width':2})+
        childFigure(150,166,1.6,{coat:OLIVE})+circ(150,120,6,'#efe6cd'); },
      function(){ return rect(0,0,W,H,'#4a3a2c')+
        rect(30,40,120,90,'#5c4a34',{stroke:'#3a2f22','stroke-width':3})+
        ell(90,86,26,18,'#3a2f22')+ell(90,84,22,14,'#8a7350')+
        rect(180,50,110,80,'#c9b083',{stroke:'#8a6f45','stroke-width':2.5})+
        rect(200,66,20,16,'#e8dfc0')+rect(232,66,20,16,'#e8dfc0')+rect(200,92,20,16,'#e8dfc0')+
        ell(258,120,18,6,'#4a3a26'); }],
    school:[function(){ return sky('#a9c19f')+ground(146,'#7fa071')+
        rect(196,84,96,62,'#c9b083',{stroke:'#8a6f45','stroke-width':3})+path('M188 84 L244 52 L300 84 Z','#7a4e33')+
        rect(216,110,14,22,'#5c4326')+rect(244,110,14,22,'#5c4326')+rect(266,110,14,22,'#5c4326')+
        line(70,146,70,66,INK,5)+circ(70,54,26,'#4e6b41')+
        '<g class="flagwave">'+rect(74,72,26,14,RED)+'</g>'+childFigure(140,164,1.4)+childFigure(164,166,1.3,{coat:BLUE}); },
      function(){ return rect(0,0,W,H,'#4a3f2c')+
        rect(40,44,240,100,'#c9b083',{stroke:'#8a6f45','stroke-width':3})+
        rect(64,66,60,10,'#5c4326')+rect(64,92,60,10,'#5c4326')+rect(64,118,60,10,'#5c4326')+
        rect(180,66,60,10,'#5c4326')+rect(180,92,60,10,'#5c4326')+rect(180,118,60,10,'#5c4326')+
        rect(258,60,14,20,'#e8dfc0',{transform:'rotate(-6 265 70)'})+
        line(260,64,268,78,INK,1.2,{transform:'rotate(-6 265 70)'})+
        circ(90,58,3,'#e8c95c',{class:'glowp'}); },
      function(){ return sky('#c4cfba')+ground(144,'#93a583')+
        circ(120,140,13,'none',{stroke:DARK,'stroke-width':3})+
        childFigure(160,164,1.5,{coat:RED})+line(172,150,136,142,INK,1.6)+
        figure(230,162,1,{coat:'#5a4b34',dress:true,hat:true})+trees(40,146,1,1.1); },
      function(){ return sky('#8b93a8')+
        line(30,-10,18,26,'#5a617a',2,{class:'rainline'})+line(120,-10,108,26,'#5a617a',2,{class:'rainline r2'})+
        line(250,-10,238,26,'#5a617a',2,{class:'rainline r3'})+ground(140,'#7a7562')+
        house(250,140,1.1)+childFigure(120,164,1.5,{coat:DARK})+
        path('M104 132 Q120 116 136 132 L136 140 L104 140 Z',OLIVE)+suitcaseStack(176,164,.7); }],
    graduation:[function(){ return rect(0,0,W,H,'#ded0ac')+
        rect(96,52,50,64,'#efe6cd',{stroke:'#8a7350','stroke-width':2,transform:'rotate(-4 121 84)'})+
        path('M108 70 L150 66 M108 82 L146 79 M108 94 L138 92','#9c8c66',2,{transform:'rotate(-4 121 84)'})+
        '<g transform="rotate(-8 200 120)">'+rect(178,104,44,10,DARK)+path('M178 104 L222 104 L200 88 Z',DARK)+line(200,88,200,72,DARK,2.5)+circ(200,70,3,RED)+'</g>'+
        pth('M60 150 q14 -22 34 -6','#4e6b41',3)+pth('M260 150 q-14 -22 -34 -6','#4e6b41',3); },
      function(){ return sky('#cbbc93')+ministryFacade(160,150,1.7)+
        figure(120,166,1.15,{coat:DARK})+path('M111 122 L129 122 L125 112 L115 112 Z',DARK)+line(120,112,120,102,DARK,2.4)+
        figure(204,166,1.15,{coat:BLUE,hat:true})+ground(150,'#a8926c'); },
      function(){ return rect(0,0,W,H,'#d8cba6')+
        '<g transform="rotate(-3 160 90)">'+rect(90,50,140,84,'#efe6cd',{stroke:'#8a7350','stroke-width':2})+
        line(106,72,214,68,'#6b5631',3)+line(106,86,206,83,'#9c8c66',1.6)+line(106,98,210,95,'#9c8c66',1.6)+line(106,110,186,108,'#9c8c66',1.6)+
        circ(182,118,9,'none',{stroke:RED,'stroke-width':2})+circ(182,118,3,RED)+'</g>'+
        pth('M70 150 L84 128 M84 150 L70 128',RED,3); },
      function(){ return sky('#b9c4a8')+ground(140,'#8fa07e')+
        ministryFacade(160,140,1.5)+figure(140,158,1.05,{coat:DARK})+figure(184,158,1.05,{coat:BLUE})+
        rect(236,96,12,8,DARK,{transform:'rotate(14 242 100)'})+figure(60,158,.95,{coat:'#5a4b34',dress:true})+
        sunOrMoon(48,40,14,'#f2e3ae',true); }],
    firstjob:[function(){ return rect(0,0,W,H,'#ded0ac')+
        rect(70,58,180,70,'#c9b083',{stroke:'#8a6f45','stroke-width':3})+
        figure(120,150,1.2,{coat:BLUE,hat:true})+figure(210,150,1.15,{coat:'#5a4b34'})+
        rect(186,108,34,20,'#efe6cd',{stroke:'#8a7350','stroke-width':1.5})+line(192,116,214,114,'#9c8c66',1.4)+
        line(60,150,260,150,INK,3); },
      function(){ return sky('#b8a98a')+ground(140,'#8a7350')+
        factory(90,140,1.25)+line(190,140,320,140,INK,2.4,{opacity:'.5'})+
        figure(230,162,1.25,{coat:DARK,hat:true})+rect(244,138,14,10,'#7a5c3a')+
        sunOrMoon(286,38,13,'#e8ddba'); },
      function(){ return rect(0,0,W,H,'#4a4030')+
        rect(60,40,90,110,'#5c4a34',{stroke:'#3a2f22','stroke-width':2.5})+
        rect(74,54,62,84,'#efe6cd',{opacity:'.9'})+
        line(80,66,130,62,'#6b5631',1.6)+line(80,78,126,75,'#9c8c66',1.2)+line(80,90,130,87,'#9c8c66',1.2)+line(80,102,118,100,'#9c8c66',1.2)+
        deskLamp(220,150,1.3)+seatedFigure(180,152,1.2,{coat:'#31507e'}); },
      function(){ return sky('#c9b39a')+sunOrMoon(160,44,16,'#f2e3ae',true)+
        ground(136,'#a8926c')+line(0,136,320,136,'#6b5631',3)+
        trainEngine(190,132,.9,false)+figure(80,158,1.2,{coat:DARK,hat:true})+
        rect(94,136,16,12,'#7a5c3a')+line(40,158,66,158,INK,2); }],
    workplace:[function(r){ var wx=110+r.int(-20,30); return sky('#4a3324')+
        ell(250,30,30,12,'#cbb89a',{class:'smoke'})+ell(236,18,22,9,'#d8c8ac',{class:'smoke s2'})+
        path('M230 100 L246 34 L272 34 L288 100 Z','#171008')+
        circ(wx,120,34,'none',{stroke:'#3d2c1c','stroke-width':9})+circ(wx,120,5,'#3d2c1c')+
        pth('M'+wx+' 92 L'+wx+' 78 M'+wx+' 148 L'+wx+' 160 M'+(wx-28)+' 120 L'+(wx-40)+' 120 M'+(wx+28)+' 120 L'+(wx+40)+' 120','#3d2c1c',7)+
        ell(200,150,70,18,'#ff8c3a',{opacity:'.35',class:'glowp'})+ground(158,'#241811'); },
      function(){ return rect(0,0,W,H,'#3a3428')+
        rect(30,30,120,9,'#241f17')+rect(30,64,120,9,'#241f17')+rect(30,98,120,9,'#241f17')+
        rect(40,42,8,20,'#7a4a33')+rect(52,42,8,20,'#3f5a45')+rect(64,43,7,19,'#5a3f3f')+rect(76,42,8,20,'#46586e')+
        deskLamp(230,150,1.5)+rect(180,110,90,40,'#57503f')+circ(262,96,8,'#ffe9b0',{class:'flicker'})+
        '<polygon points="200,20 250,20 276,110 174,110" fill="#ffe9b0" opacity=".12"/>'; },
      function(){ return sky('#8b99a8')+ground(140,'#5f6a5c')+
        rect(60,96,60,44,'#7a4a33',{stroke:'#4a3a26','stroke-width':2})+line(60,110,120,110,'#4a3a26',2)+line(90,96,90,140,'#4a3a26',2)+
        rect(160,88,60,52,'#3f5a45',{stroke:'#26382b','stroke-width':2})+line(160,104,220,104,'#26382b',2)+
        pth('M250 140 L250 60 L290 60','#3a3f36',5)+
        line(280,60,306,84,'#3a3f36',3)+rect(296,84,22,14,'#6e3f33')+
        pth('M20 158 q16 -5 32 0 M240 164 q16 -5 32 0',BLUE,2.4,{opacity:'.6'}); },
      function(){ return rect(0,0,W,H,'#4a3f30')+
        rect(50,60,220,14,'#8a6f45',{stroke:'#5c4326','stroke-width':2})+
        rect(70,30,26,30,'#7a5c3a')+rect(120,24,26,36,'#5c6b52')+rect(170,32,26,28,'#6e5638')+rect(220,26,26,34,'#7a5c3a')+
        rect(96,74,50,60,'#c9b083',{stroke:'#8a6f45','stroke-width':2})+circ(121,104,9,'#e8c95c',{class:'glowp'})+
        line(60,134,260,134,'#5c4326',4); }],
    promotion:[function(){ return rect(0,0,W,H,'#ded0ac')+
        path('M60 150 L140 150 L140 118 L200 118 L200 86 L260 86','#8a7350',5)+
        line(150,140,150,128,DARK,3)+line(150,128,162,134,DARK,3)+line(150,128,138,134,DARK,3)+
        sunOrMoon(52,44,13,'#f2e3ae',true)+circ(212,72,5,RED); },
      function(){ return rect(0,0,W,H,'#4a4030')+
        rect(90,70,150,60,'#5c4a34',{stroke:'#3a2f22','stroke-width':2.5})+
        rect(104,84,80,26,'#e8dfc0',{opacity:'.95'})+line(112,94,168,92,'#6b5631',2.4)+
        deskLamp(210,150,1.4)+rect(150,116,60,8,'#8a6f45')+
        rect(158,120,44,4,'#efe6cd',{opacity:'.8'})+line(60,150,270,150,INK,3); },
      function(){ return sky('#c9b98f')+ground(146,'#a8926c')+
        rect(110,96,110,50,'#5c4a34',{stroke:'#3a2f22','stroke-width':2.5})+
        figure(84,158,1.2,{coat:BLUE,hat:true})+figure(246,158,1.2,{coat:'#5a4b34'})+
        pth('M148 128 Q160 120 172 128',INK,3)+house(30,146,.9); },
      function(){ return rect(0,0,W,H,'#3a3f52')+
        rect(80,40,160,100,'#20242c',{stroke:'#2a3044','stroke-width':4})+
        line(160,40,160,140,'#2a3044',3)+line(80,90,240,90,'#2a3044',3)+
        rect(30,120,260,60,'#151827')+
        rect(120,84,80,56,'#57503f')+rect(140,70,40,14,'#5c4a34')+
        sunOrMoon(210,64,10,'#efe6c8',{class:'glowp'})+circ(104,60,5,'#e8c95c',{class:'flicker'}); }],
    jobloss:[function(){ return sky('#9aa2b0')+ground(142,'#7a7562')+
        rect(120,70,90,72,'#5c5344',{stroke:'#3a352c','stroke-width':3})+
        line(120,70,210,142,'#3a352c',4)+line(210,70,120,142,'#3a352c',4)+
        line(165,70,165,142,'#3a352c',3)+line(120,106,210,106,'#3a352c',3)+
        rect(40,96,52,34,'#c9b083',{stroke:'#8a6f45','stroke-width':2})+
        line(48,106,84,104,'#6b5631',2)+line(48,114,80,113,'#9c8c66',1.4)+line(48,122,84,121,'#9c8c66',1.4)+
        figure(268,160,1.1,{coat:DARK,hat:true}); },
      function(){ return rect(0,0,W,H,'#4a4030')+
        rect(90,60,140,80,'#57503f',{stroke:'#3a2f22','stroke-width':2.5})+
        rect(104,74,50,40,'#e8dfc0',{opacity:'.85'})+
        rect(170,96,44,30,'#8a6f45')+circ(192,110,7,'none',{stroke:'#5c4326','stroke-width':2})+
        rect(240,120,40,30,'#7a5c3a',{stroke:'#5c4326','stroke-width':2})+line(240,128,280,128,'#5c4326',2)+
        circ(262,96,8,'#ffe9b0',{opacity:'.5'}); },
      function(){ return sky('#a8adb8')+ground(146,'#8a8574')+
        rect(70,120,70,10,'#5c4a34')+rect(80,130,6,18,'#5c4a34')+rect(124,130,6,18,'#5c4a34')+
        seatedFigure(105,120,1.15,{coat:DARK,hat:true})+suitcaseStack(180,150,1.1)+
        house(260,146,1)+line(0,146,320,146,'#6b5631',2.5); },
      function(){ return sky('#b3a58c')+
        rect(90,54,140,90,'#6e5638',{stroke:'#4a3826','stroke-width':3})+
        rect(104,68,50,62,'#c9b083',{stroke:'#8a6f45','stroke-width':2})+
        rect(168,68,48,62,'#c9b083',{stroke:'#8a6f45','stroke-width':2})+
        line(104,68,154,130,'#8a6f45',2)+line(154,68,104,130,'#8a6f45',2)+
        line(168,99,216,99,'#8a6f45',2)+ground(144,'#8a7350')+line(0,144,320,144,'#6b5631',3); }],
    friendship:[function(){ return sky('#3a3f52')+sunOrMoon(268,36,13,'#efe6c8',{class:'glowp'})+
        ground(140,'#33302a')+
        rect(90,116,120,8,'#5c4a34')+rect(100,124,8,22,'#5c4a34')+rect(192,124,8,22,'#5c4a34')+
        seatedFigure(126,116,1.1,{coat:BLUE})+seatedFigure(176,116,1.1,{coat:OLIVE})+
        line(120,96,240,60,INK,2.4)+path('M240 60 L286 74 L240 88 Z','#4a4536',{opacity:'.9'}); },
      function(){ return rect(0,0,W,H,'#5a4a38')+
        rect(60,60,200,80,'#c9b083',{stroke:'#8a6f45','stroke-width':3})+
        circ(120,96,9,'#e8c95c',{class:'glowp',opacity:'.7'})+circ(200,96,9,'#e8c95c',{class:'glowp',opacity:'.7'})+
        rect(140,110,40,10,'#5c4326')+rect(146,120,6,20,'#5c4326')+rect(168,120,6,20,'#5c4326')+
        rect(150,96,10,12,'#efe6cd')+rect(162,96,10,12,'#efe6cd'); },
      function(){ return sky('#c4cfba')+ground(146,'#93a583')+
        line(40,166,280,166,'#8a7350',3)+
        circ(96,150,7,'none',{stroke:DARK,'stroke-width':2.4})+circ(126,150,7,'none',{stroke:DARK,'stroke-width':2.4})+circ(111,135,7,'none',{stroke:DARK,'stroke-width':2.4})+
        childFigure(180,164,1.5,{coat:RED})+childFigure(208,166,1.5,{coat:BLUE})+
        trees(250,148,1,1.1); },
      function(){ return rect(0,0,W,H,'#ded0ac')+
        '<g transform="rotate(-3 160 90)">'+rect(100,52,120,76,'#efe6cd',{stroke:'#8a7350','stroke-width':2})+
        circ(136,86,14,'#cdb78f')+circ(184,86,14,'#b39a71')+path('M150 86 Q160 78 170 86','#9c8c66',2)+
        line(112,112,208,109,'#9c8c66',1.6)+'</g>'+
        rect(236,116,44,30,'#8a6f45',{stroke:'#5c4326','stroke-width':2})+
        line(244,124,272,122,'#efe6cd',1.4)+line(244,132,272,130,'#efe6cd',1.4)+
        circ(58,60,10,'none',{stroke:RED,'stroke-width':2}); }],
    romance:[function(){ return sky('#2a2f42')+sunOrMoon(60,40,13,'#efe6c8',{class:'glowp'})+
        ground(142,'#1d2030')+
        line(230,142,230,70,INK,4)+path('M218 70 Q230 56 242 70 Z','#ffe9a8',{class:'glowp'})+
        figure(140,164,1.25,{coat:BLUE,hat:true})+figure(184,164,1.25,{coat:'#6e3f33',dress:true})+
        pth('M158 128 Q162 122 166 128','#8a8574',1.6); },
      function(){ return rect(0,0,W,H,'#ded0ac')+
        '<g transform="rotate(-6 160 100)">'+rect(120,70,80,56,'#7a2f26',{stroke:'#4a1c16','stroke-width':2})+
        rect(120,70,80,18,'#8a3a30')+'</g>'+
        circ(140,120,10,'none',{stroke:AMBER,'stroke-width':3})+circ(166,120,10,'none',{stroke:AMBER,'stroke-width':3})+
        path('M148 116 Q153 110 158 116 Q153 122 148 116 Z',AMBER)+
        pth('M60 60 q10 -14 24 -6','#4e6b41',2.4); },
      function(){ return rect(0,0,W,H,'#3a2f3a')+
        sunOrMoon(80,50,10,'#ffe9a8',{class:'glowp'})+sunOrMoon(240,50,10,'#ffe9a8',{class:'glowp'})+
        ground(140,'#2a2230')+
        figure(146,162,1.25,{coat:DARK})+figure(178,162,1.25,{coat:'#6e3f33',dress:true})+
        pth('M152 132 Q162 140 172 132','#8a8574',1.8)+
        path('M100 60 Q160 30 220 60','#4a4050',{opacity:'.8'}); },
      function(){ return sky('#a8b5a0')+ground(120,'#7a9178')+
        path('M0 120 Q80 108 160 120 T320 120 L320 180 L0 180 Z','#5f7a86')+
        pth('M20 140 q14 -5 28 0 M240 150 q14 -5 28 0','#3f5866',2.2)+
        '<g transform="translate(160 128)"><path d="M-44 0 Q0 -14 44 0 L30 16 L-30 16 Z" fill="#6e5638"/>'+
        line(-44,0,44,0,'#4a3826',2.5)+line(0,-6,0,-26,'#4a3826',2)+rect(-14,-32,28,7,'#c9b083')+'</g>'+
        sunOrMoon(268,42,12,'#f2e3ae',true); }],
    family:[function(){ return rect(0,0,W,H,'#5a4a38')+
        rect(70,86,180,16,'#8a6f45',{stroke:'#5c4326','stroke-width':2})+
        rect(84,102,10,40,'#5c4326')+rect(226,102,10,40,'#5c4326')+
        ell(130,82,12,6,'#e8dfc0')+rect(160,76,20,10,'#7a5c3a')+
        figure(110,160,1.2,{coat:DARK})+figure(210,160,1.2,{coat:'#6e3f33',dress:true})+childFigure(160,164,1.5,{coat:BLUE}); },
      function(){ return sky('#b9c4a8')+ground(120,'#8fa07e')+
        path('M40 120 Q160 96 280 120 L320 132 L320 180 L0 180 L0 132 Z','#7a9178')+
        figure(140,150,1.2,{coat:OLIVE,hat:true})+childFigure(172,128,1.4,{coat:RED})+
        pth('M196 96 L216 76','#8a7350',1.6)+
        '<g transform="translate(224 66) rotate(12)">'+path('M0 0 L26 6 L0 14 L4 7 Z',RED)+'</g>'+
        sunOrMoon(60,42,14,'#f2e3ae',true); },
      function(){ return rect(0,0,W,H,'#cbbc93')+ground(130,'#a8926c')+
        cradle(110,150,1.3)+circ(160,142,7,'#efe6cd')+circ(178,148,5,'#efe6cd')+
        circ(160,140,2,RED)+rect(196,138,26,14,BLUE)+circ(240,144,6,OLIVE)+
        house(272,130,1)+trees(36,132,1,1.1); },
      function(){ return sky('#c4cfba')+ground(140,'#9caf8c')+
        trees(70,142,1,1.7)+trees(250,146,1,1.3)+
        rect(140,124,50,22,'#7a5c3a')+ell(165,120,26,8,'#e8dfc0')+
        circ(140,112,5,RED)+circ(190,112,5,BLUE)+
        childFigure(120,162,1.4)+childFigure(210,164,1.4,{coat:RED})+
        sunOrMoon(286,38,13,'#f2e3ae',true); }],
    conflict:[function(){ return sky('#6a7080')+
        line(40,-10,28,30,'#5a617a',2,{class:'rainline'})+line(140,-10,128,30,'#5a617a',2,{class:'rainline r2'})+
        line(240,-10,228,30,'#5a617a',2,{class:'rainline r3'})+line(300,-10,288,30,'#5a617a',2,{class:'rainline r2'})+
        ground(140,'#5c584c')+
        circ(140,110,9,'none',{stroke:INK,'stroke-width':2.4})+circ(180,110,9,'none',{stroke:INK,'stroke-width':2.4})+
        pth('M149 106 L171 114 M171 106 L149 114',INK,2)+
        rect(60,140,200,4,'#4a463c'); },
      function(){ return sky('#a8adb8')+ground(146,'#8a8574')+
        figure(110,160,1.15,{coat:DARK})+figure(215,160,1.15,{coat:'#5a4b34',dress:true})+
        pth('M140 140 L185 140','#8a8574',2,{opacity:'.6','stroke-dasharray':'6 5'})+
        pth('M125 150 L96 166 M199 150 L228 166','#8a8574',2,{opacity:'.6'})+
        house(30,146,.8)+house(286,146,.8); },
      function(){ return rect(0,0,W,H,'#4a4030')+
        rect(130,50,64,110,'#5c4a34',{stroke:'#3a2f22','stroke-width':3})+
        circ(168,108,3,'#e8c95c',{class:'glowp'})+
        suitcaseStack(70,150,1.3)+suitcaseStack(250,152,.9)+
        line(60,152,60,110,'#8a7350',2); },
      function(){ return rect(0,0,W,H,'#57503f')+
        rect(100,70,80,80,'#5c4a34',{stroke:'#3a2f22','stroke-width':2.5})+
        path('M100 70 L140 40 L180 70 Z','#4a3a2c')+
        rect(118,110,44,40,'#4a3a26',{transform:'rotate(8 140 130)'})+
        rect(220,120,36,10,'#c9b083')+ell(238,116,10,5,'#efe6cd')+
        pth('M238 106 q4 -8 -2 -12','#8a8574',1.6,{opacity:'.5'}); }],
    illness:[function(){ return rect(0,0,W,H,'#3a3428')+
        bed(160,140,1.5,true)+
        rect(230,96,16,44,'#efe6cd',{stroke:'#8a7350','stroke-width':1.5})+rect(232,110,12,10,'#8a3a30')+
        circ(70,60,8,'#ffe9b0',{class:'flicker',opacity:'.6'})+
        pth('M60 70 q10 8 20 0','#8a8574',1.6,{opacity:'.5'}); },
      function(){ return rect(0,0,W,H,'#4a4030')+
        bed(150,142,1.6,true)+seatedFigure(240,140,1.1,{coat:'#efe6cd'})+
        rect(226,120,28,20,'#efe6cd',{opacity:'.9'})+
        rect(60,100,20,40,'#c9b083',{stroke:'#8a6f45','stroke-width':1.6})+
        pth('M64 108 h12 M64 116 h12','#8a7350',1.2)+
        circ(70,60,7,'#ffe9b0',{class:'flicker',opacity:'.5'}); },
      function(){ return sky('#5a617a')+
        rect(110,40,100,90,'#20242c',{stroke:'#2a3044','stroke-width':4})+line(160,40,160,130,'#2a3044',3)+
        line(120,-10,108,30,'#5a617a',2,{class:'rainline'})+line(200,-10,188,30,'#5a617a',2,{class:'rainline r2'})+
        rect(240,96,18,26,'#6e3f33',{stroke:'#4a2a20','stroke-width':1.5})+rect(266,104,14,18,'#31507e',{stroke:'#1d3050','stroke-width':1.5})+
        rect(40,120,50,12,'#5c4a34')+rect(48,108,14,12,'#6e5638'); },
      function(){ return rect(0,0,W,H,'#4a3f30')+
        rect(110,80,100,60,'#3a2f22',{stroke:'#2b2318','stroke-width':2.5})+
        path('M110 80 L160 56 L210 80 Z','#2b2318')+
        rect(126,96,30,10,'#efe6cd')+rect(126,112,30,10,'#efe6cd')+
        circ(180,100,6,RED)+rect(176,106,8,20,'#8a7350')+
        rect(240,90,40,50,'#c9b083',{stroke:'#8a6f45','stroke-width':2})+pth('M248 100 h24 M248 110 h24 M248 120 h16','#8a7350',1.6); }],
    clinic:[function(){ return sky('#c4cfba')+ground(140,'#9caf8c')+
        rect(110,70,100,70,'#efe6cd',{stroke:'#8a7350','stroke-width':2.5})+
        path('M110 70 L160 44 L210 70 Z','#8a7350')+
        rect(148,86,24,24,'#efe6cd',{stroke:RED,'stroke-width':3})+line(160,90,160,106,RED,4)+line(152,98,168,98,RED,4)+
        rect(60,110,30,30,'#c9b083',{stroke:'#8a6f45','stroke-width':1.5})+figure(250,158,1,{coat:'#efe6cd'})+
        trees(36,140,1,1); },
      function(){ return rect(0,0,W,H,'#4a4030')+
        rect(40,60,240,14,'#8a6f45',{stroke:'#5c4326','stroke-width':2})+
        rect(56,74,10,70,'#5c4326')+rect(150,74,10,70,'#5c4326')+rect(244,74,10,70,'#5c4326')+
        seatedFigure(110,60,1,{coat:OLIVE})+seatedFigure(200,60,1,{coat:'#6e3f33'})+
        rect(262,120,34,22,'#efe6cd',{stroke:'#8a7350','stroke-width':1.5})+circ(279,131,7,'none',{stroke:RED,'stroke-width':1.6})+
        line(40,144,280,144,'#3a2f22',3); },
      function(){ return rect(0,0,W,H,'#2f3238')+
        path('M120 40 L200 40 L216 76 L104 76 Z','#4a505a')+
        ell(160,80,26,7,'#fff4d8',{class:'glowp'})+line(160,84,160,96,'#3a3f46',3)+
        bed(160,150,1.4,false)+rect(210,120,40,14,'#efe6cd')+
        pth('M216 127 h28','#8a3a30',2)+pth('M216 131 h20','#31507e',2); },
      function(){ return rect(0,0,W,H,'#5a4a38')+
        rect(50,50,220,16,'#8a6f45',{stroke:'#5c4326','stroke-width':2})+
        rect(70,26,18,24,'#6e3f33')+rect(100,20,18,30,'#31507e')+rect(130,28,18,22,'#2e6b46')+rect(160,22,18,28,'#9a6a1c')+rect(190,26,18,24,'#5a4b34')+
        rect(110,90,60,50,'#c9b083',{stroke:'#8a6f45','stroke-width':2})+
        path('M126 116 a14 14 0 0 1 28 0 Z','#8a7350')+rect(122,116,36,8,'#8a7350')+
        circ(210,110,4,'#efe6cd')+circ(222,102,4,'#efe6cd')+circ(216,118,4,'#efe6cd'); }],
    recovery:[function(){ return rect(0,0,W,H,'#c9b98f')+
        rect(100,40,120,100,'#efe6cd',{stroke:'#8a7350','stroke-width':4})+line(160,40,160,140,'#8a7350',3)+line(100,90,220,90,'#8a7350',3)+
        sunOrMoon(210,66,12,'#f2e3ae',{class:'glowp'})+
        rect(60,120,26,34,'#7a5c3a')+circ(73,112,10,'#4e6b41')+path('M73 122 q-8 10 -2 18','#4e6b41',2,{fill:'none'})+
        bed(250,150,.9,false); },
      function(){ return sky('#b9c4a8')+ground(130,'#8fa07e')+
        path('M0 130 Q80 116 160 130 T320 130 L320 180 L0 180 Z','#93a583')+
        figure(140,152,1.15,{coat:OLIVE,hat:true})+line(158,132,172,152,'#5c4326',3)+
        pth('M200 140 Q240 124 280 138','#8a7350',2,{opacity:'.7','stroke-dasharray':'8 6'})+
        trees(50,134,1,1.2)+sunOrMoon(280,40,14,'#f2e3ae',true); },
      function(){ return rect(0,0,W,H,'#5a4a38')+
        rect(90,90,70,50,'#c9b083',{stroke:'#8a6f45','stroke-width':2.5})+
        ell(125,88,26,8,'#efe6cd')+pth('M112 82 q6 -10 12 0 M126 82 q6 -10 12 0','#8a8574',2,{opacity:'.6'})+
        rect(180,104,44,36,'#7a5c3a',{stroke:'#5c4326','stroke-width':2})+ell(202,104,18,6,'#e8dfc0')+
        '<g transform="translate(250 132)"><ellipse cx="0" cy="8" rx="16" ry="7" fill="#8a6f45"/><circle cx="12" cy="2" r="5" fill="#6e5638"/><path d="M16 2 q4 -2 5 -5" stroke="#6e5638" stroke-width="1.4" fill="none"/></g>'+
        rect(60,60,20,30,'#e8c95c',{class:'flicker',opacity:'.5'}); },
      function(){ return sky('#c4cfba')+ground(140,'#9caf8c')+
        house(70,140,1.1)+trees(150,142,1,1.2)+
        rect(210,120,50,10,'#5c4a34')+rect(218,130,8,16,'#5c4a34')+rect(244,130,8,16,'#5c4a34')+
        ell(235,114,16,6,'#e8dfc0')+circ(228,110,3,RED)+circ(242,110,3,BLUE)+
        childFigure(180,160,1.3,{coat:RED})+sunOrMoon(288,40,13,'#f2e3ae',true); }],
    movinghome:[function(){ return sky('#b3a58c')+ground(146,'#8a7350')+
        suitcaseStack(120,150,1.6)+rect(190,120,50,30,'#7a5c3a',{stroke:'#5c4326','stroke-width':2})+
        pth('M190 126 q10 -8 20 0','#5c4326',2)+
        rect(60,60,80,86,'#c9b083',{stroke:'#8a6f45','stroke-width':2.5})+rect(88,96,24,50,'#5c4326')+
        circ(96,124,2,'#e8c95c',{class:'glowp'}); },
      function(){ return sky('#a8b5c0')+ground(140,'#7a7562')+
        rect(80,100,90,40,'#5c4a34',{stroke:'#3a2f22','stroke-width':2.5})+circ(100,144,9,'#3a2f22')+circ(150,144,9,'#3a2f22')+
        rect(96,84,58,16,'#7a5c3a')+circ(170,90,10,'#3a2f22')+line(170,80,170,60,'#3a2f22',2)+
        figure(240,158,1.15,{coat:DARK,hat:true})+line(254,136,270,120,'#3a2f22',2.4)+
        line(0,148,320,148,'#6b5631',2.5); },
      function(){ return sky('#6a7080')+sunOrMoon(70,44,12,'#efe6c8',{class:'glowp'})+
        ground(140,'#4a463c')+
        rect(40,132,240,8,'#3a3630')+trainEngine(200,128,.85,true)+
        suitcaseStack(90,140,1.2)+rect(60,110,30,22,'#6e5638',{stroke:'#4a3826','stroke-width':1.5})+
        figure(140,136,1.05,{coat:BLUE,hat:true}); },
      function(){ return rect(0,0,W,H,'#cbbc93')+
        rect(70,50,180,110,'#e0d3ae',{stroke:'#8a7350','stroke-width':3})+
        path('M70 50 L160 20 L250 50 Z','#8a7350')+
        rect(130,100,44,60,'#5c4326')+circ(166,132,2,'#e8c95c',{opacity:'.7'})+
        suitcaseStack(280,152,1)+rect(30,120,26,34,'#7a5c3a',{stroke:'#5c4326','stroke-width':1.5}); }],
    poverty:[function(){ return rect(0,0,W,H,'#4a4030')+
        rect(110,100,100,26,'#c9b083',{stroke:'#8a6f45','stroke-width':2})+
        path('M124 100 a36 14 0 0 0 72 0 Z','#8a7350')+
        rect(150,60,8,26,'#efe6cd')+ell(154,58,7,4,'#ffe9b0',{class:'flicker',opacity:'.7'})+
        pth('M226 118 q6 -10 0 -18','#8a8574',1.8,{opacity:'.5'}); },
      function(){ return sky('#8b93a8')+ground(146,'#6b6552')+
        rect(120,60,120,86,'#5c5344',{stroke:'#3a352c','stroke-width':3})+
        rect(150,86,60,60,'#4a4238')+rect(160,96,40,50,'#3a342c')+
        figure(70,158,1.1,{coat:DARK})+figure(262,158,1.05,{coat:'#5a4b34',dress:true})+
        line(0,146,320,146,'#4a463c',2.5); },
      function(){ return rect(0,0,W,H,'#5a4a38')+
        line(160,40,160,60,'#3a2f22',3)+path('M120 60 Q160 50 200 60 L196 130 Q160 142 124 130 Z','#6e5638')+
        path('M124 130 Q160 142 196 130 L198 160 Q160 172 122 160 Z','#5c4a34')+
        line(196,80,196,150,'#4a3826',2)+
        rect(230,120,30,26,'#8a7350',{stroke:'#5c4326','stroke-width':'1.5'})+
        circ(245,116,4,AMBER)+circ(238,110,3,AMBER); },
      function(){ return sky('#7a8296')+
        rect(90,50,140,96,'#20242c',{stroke:'#2a3044','stroke-width':4})+
        line(160,50,160,146,'#2a3044',3)+line(90,98,230,98,'#2a3044',3)+
        pth('M100 66 l8 8 M108 66 l-8 8 M180 114 l8 8 M188 114 l-8 8','#8a93ab',1.4,{opacity:'.7'})+
        rect(40,120,240,60,'#0d101b')+
        rect(70,132,60,10,'#3a3630')+rect(90,126,20,6,'#4a463c'); }],
    travel:[function(){ return sky('#a8adb8')+
        rect(0,120,320,60,'#6b6552')+
        path('M40 120 L40 84 Q160 56 280 84 L280 120','#8a8574')+
        line(30,120,290,120,'#3a3630',3)+
        trainEngine(120,116,1.05,false)+
        pth('M0 150 q20 -6 40 0 M240 158 q20 -6 40 0',BLUE,2.2,{opacity:'.5'}); },
      function(){ return sky('#c9b39a')+sunOrMoon(160,40,14,'#f2e3ae',true)+
        ground(134,'#8a7350')+
        rect(60,96,200,10,'#5c4a34')+rect(70,106,10,34,'#5c4a34')+rect(240,106,10,34,'#5c4a34')+
        circ(160,84,10,'none',{stroke:DARK,'stroke-width':2})+line(160,84,160,76,DARK,2)+line(160,74,172,77,DARK,1.6)+line(160,74,148,77,DARK,1.6)+
        trainEngine(240,128,.7,false)+figure(110,140,1.1,{coat:DARK,hat:true})+suitcaseStack(140,140,.8); },
      function(){ return sky('#8b99a8')+sunOrMoon(262,40,13,'#efe6c8',{class:'glowp'})+
        path('M0 110 Q80 98 160 110 T320 110 L320 180 L0 180 Z','#3f5866')+
        pth('M20 128 q16 -5 32 0 M120 140 q16 -5 32 0 M230 126 q16 -5 32 0','#2c4256',2.2)+
        '<g transform="translate(160 104)">'+rect(-50,0,100,10,'#33302a')+path('M-50 0 L50 0 L38 22 L-38 22 Z','#33302a')+
        rect(-14,-18,28,18,'#33302a')+'</g>'+
        line(160,86,160,64,'#33302a',3)+ell(160,60,8,6,'#e8dfc0')+
        pth('M60 60 q6 -8 12 0 M84 52 q6 -8 12 0','#d8d3c0',1.6,{opacity:'.8'}); },
      function(){ return rect(0,0,W,H,'#151827')+
        rect(60,40,200,80,'#20242c',{stroke:'#2a3044','stroke-width':4})+
        line(160,40,160,120,'#2a3044',3)+
        rect(80,60,40,40,'#e8c95c',{class:'flicker',opacity:'.8'})+rect(190,70,40,30,'#e8c95c',{class:'flicker k2',opacity:'.6'})+
        rect(30,120,260,60,'#0d101b')+
        line(0,132,320,132,'#2a3044',3)+line(0,140,320,140,'#232838',2); }],
    bureau:[function(){ return sky('#b3a58c')+ministryFacade(160,150,2)+
        ground(150,'#a8926c')+line(0,150,320,150,'#6b5631',2.5)+
        rect(60,158,200,6,'#8a7350',{opacity:'.5'}); },
      function(){ return rect(0,0,W,H,'#3a3428')+
        path('M140 20 L180 20 L200 70 L120 70 Z','#4a505a')+
        ell(160,74,22,6,'#ffe9b0',{class:'glowp'})+line(160,80,160,90,'#3a3f46',3)+
        rect(100,110,120,14,'#5c4a34')+rect(112,124,10,36,'#5c4a34')+rect(198,124,10,36,'#5c4a34')+
        figure(80,160,1.15,{coat:DARK})+figure(242,160,1.15,{coat:'#31507e',hat:true}); },
      function(){ return rect(0,0,W,H,'#4a4030')+
        rect(40,50,60,100,'#5c4a34',{stroke:'#3a2f22','stroke-width':2})+
        rect(52,64,36,20,'#c9b083',{stroke:'#8a6f45','stroke-width':1.2})+
        rect(52,94,36,20,'#c9b083',{stroke:'#8a6f45','stroke-width':1.2})+
        rect(52,124,36,20,'#c9b083',{stroke:'#8a6f45','stroke-width':1.2})+
        '<g><rect x="150" y="60" width="70" height="46" fill="#c9a86a" stroke="#6b5631" stroke-width="2" transform="rotate(-8 185 83)"/>'+
        line(160,74,208,68,'#6b5631',2,{transform:'rotate(-8 185 83)'})+line(160,86,204,81,'#9c8c66',1.4,{transform:'rotate(-8 185 83)'})+
        circ(224,110,10,'none',{stroke:RED,'stroke-width':2.4,transform:'rotate(-8 185 83)'})+circ(224,110,3.4,RED,{transform:'rotate(-8 185 83)'})+'</g>'+
        figure(280,150,.95,{coat:DARK}); },
      function(){ return sky('#3a3f52')+ground(140,'#2a2e3a')+
        line(230,140,230,50,'#1d2130',5)+rect(214,34,32,22,'#1d2130')+
        '<polygon points="230,40 130,120 150,132 236,58" fill="#ffe9a8" opacity=".14"/>'+
        circ(230,45,4,'#ffe9a8',{class:'flicker'})+
        line(40,140,200,140,'#3a3630',2.5)+pth('M60 140 v-14 M84 140 v-14 M108 140 v-14 M132 140 v-14','#3a3630',3)+
        sunOrMoon(70,50,10,'#efe6c8',{opacity:'.5'}); }],
    achievement:[function(){ return rect(0,0,W,H,'#ded0ac')+medalLaurel(160,100,2.2)+
        pth('M40 150 h240','#8a7350',2,{opacity:'.5'}); },
      function(){ return sky('#c9b98f')+ground(146,'#a8926c')+
        figure(160,158,1.5,{coat:BLUE})+pth('M160 96 L160 74','#3a2f1e',0,{})+
        pth('M148 104 L136 88 M172 104 L184 88',INK,3)+
        rect(60,120,10,16,'#efe6cd',{transform:'rotate(-14 65 128)'})+rect(250,110,10,16,'#efe6cd',{transform:'rotate(12 255 118)'})+
        rect(120,96,10,16,'#efe6cd',{transform:'rotate(-8 125 104)'})+rect(196,100,10,16,'#efe6cd',{transform:'rotate(16 201 108)'}); },
      function(){ return rect(0,0,W,H,'#d8cba6')+
        '<g transform="rotate(-2 160 90)">'+rect(80,46,160,88,'#efe6cd',{stroke:'#8a7350','stroke-width':2})+
        line(96,68,224,64,'#6b5631',3)+line(96,82,214,79,'#9c8c66',1.6)+line(96,96,220,93,'#9c8c66',1.6)+
        circ(196,116,10,'none',{stroke:RED,'stroke-width':2})+circ(196,116,3.4,RED)+
        pth('M108 112 q10 -10 22 -2',INK,1.6)+'</g>'; },
      function(){ return sky('#b9c4a8')+ground(146,'#8fa07e')+
        rect(110,130,100,16,'#8a7350',{stroke:'#5c4326','stroke-width':2})+
        rect(130,114,60,16,'#9c8c66',{stroke:'#5c4326','stroke-width':2})+
        rect(145,98,30,16,'#a8926c',{stroke:'#5c4326','stroke-width':2})+
        figure(160,96,1,{coat:BLUE})+pth('M148 66 L140 52 M172 66 L180 52',INK,2.6)+
        trees(40,148,1,1.1)+trees(280,150,1,1.3); }],
    oldage:[function(){ return rect(0,0,W,H,'#5a4a38')+
        rect(60,120,200,8,'#8a6f45',{stroke:'#5c4326','stroke-width':2})+
        '<g transform="translate(140 118)"><path d="M-20 -40 Q-26 -6 -14 0 L18 0 Q28 -6 22 -40 Z" fill="#6e5638"/><path d="M-20 -40 Q0 -52 22 -40" fill="none" stroke="#5c4326" stroke-width="3"/><path d="M-14 0 L-18 14 M18 0 L22 14" stroke="#5c4326" stroke-width="3"/></g>'+
        rect(196,96,30,26,'#7a2f26',{stroke:'#4a1c16','stroke-width':2})+
        circ(80,70,8,'#ffe9b0',{class:'flicker',opacity:'.6'})+
        rect(240,60,40,60,'#3a2f22',{stroke:'#2b2318','stroke-width':2})+ell(260,90,12,14,'#e8956a',{opacity:'.6',class:'glowp'}); },
      function(){ return sky('#c9b98f')+ground(146,'#a8926c')+
        rect(90,120,80,8,'#5c4a34')+rect(100,128,8,22,'#5c4a34')+rect(152,128,8,22,'#5c4a34')+
        seatedFigure(130,120,1.15,{coat:'#5a4b34',hat:true})+line(158,110,166,140,'#5c4326',2.6)+
        circ(230,140,5,'#8a7350')+circ(244,132,5,'#8a7350')+circ(256,142,4,'#8a7350')+
        circ(238,126,4,'#8a7350')+trees(40,146,1,1.1); },
      function(){ return rect(0,0,W,H,'#cbbc93')+
        rect(110,80,110,60,'#c9b083',{stroke:'#8a6f45','stroke-width':2.5})+
        ell(150,78,20,7,'#e8dfc0')+ell(150,74,14,5,'#efe6cd')+
        pth('M186 96 q14 -6 22 -14','#b3a077',2.4)+
        circ(230,60,10,'none',{stroke:AMBER,'stroke-width':2})+pth('M224 66 q6 8 12 0',AMBER,1.6)+
        rect(60,110,26,30,'#7a5c3a')+circ(73,102,9,'#4e6b41'); },
      function(){ return sky('#c4cfba')+ground(140,'#9caf8c')+
        house(60,140,1.1)+
        childFigure(160,160,1.3,{coat:RED})+circ(184,142,6,'none',{stroke:DARK,'stroke-width':2})+
        childFigure(220,162,1.35,{coat:BLUE})+line(232,148,252,138,INK,1.6)+
        circ(258,132,8,'none',{stroke:DARK,'stroke-width':2})+
        trees(280,142,1,1.2)+sunOrMoon(40,40,14,'#f2e3ae',true); }],
    death:[function(){ return rect(0,0,W,H,'#4a4030')+sealedFolder(120,100,1.9)+
        lily(220,140,1.6)+
        ell(160,150,110,10,'#3a2f22',{opacity:'.6'}); },
      function(){ return rect(0,0,W,H,'#33291c')+
        rect(130,90,14,34,'#efe6cd')+ell(137,86,7,5,'#ffe9b0',{class:'flicker'})+
        pth('M150 118 q14 -10 26 0','#8a8574',2,{opacity:'.4'})+
        rect(90,124,150,10,'#5c4a34')+
        circ(230,70,16,'none',{stroke:'#6b5631','stroke-width':2})+circ(230,70,5,'none',{stroke:'#6b5631','stroke-width':1.4})+
        pth('M60 60 q10 -12 22 -4','#8a8574',1.4,{opacity:'.35'}); },
      function(){ return sky('#4a4a5e')+
        rect(100,40,120,90,'#20242c',{stroke:'#2a3044','stroke-width':4})+line(160,40,160,130,'#2a3044',3)+
        sunOrMoon(130,70,11,'#efe6c8',{opacity:'.8'})+
        pth('M196 84 q10 -14 4 -26','#d8d3c0',1.6,{opacity:'.7'})+
        '<g transform="translate(196 58)"><path d="M0 0 Q6 -8 12 -4 Q6 -2 4 4 Z" fill="#d8d3c0"/></g>'+
        rect(40,130,240,50,'#151827')+
        rect(60,140,44,30,'#5c4a34')+rect(220,146,40,24,'#4a463c'); },
      function(){ return sky('#8b93a8')+ground(146,'#7a7562')+
        rect(120,116,80,10,'#5c4a34')+rect(130,126,8,24,'#5c4a34')+rect(182,126,8,24,'#5c4a34')+
        ell(160,112,12,5,'#6e5638')+pth('M160 96 L200 60','#8a8574',1.6)+
        path('M250 100 q14 -6 26 2 q-12 6 -26 -2 Z','#8a6f45')+
        line(250,100,274,78,'#3a3630',1.6)+
        line(0,146,320,146,'#6b5631',2.5)+
        pth('M60 120 q6 -10 0 -18 M74 124 q6 -10 0 -18','#8a8574',1.4,{opacity:'.5'}); }]
  };
  var SCENE_KEYS=Object.keys(FAMILIES);

  /* Keyword routing: head/text -> scene key (used for automatic milestone art). */
  function sceneKeyFromText(text){
    var t=String(text||'').toUpperCase();
    if(/FINAL ENTRY|ENTRY TERMINATED|DECEASED|PASSED AWAY|FILE CLOSED/.test(t)) return 'death';
    if(/PENSION OFFICE|YEAR 65|ELDER/.test(t)) return 'oldage';
    if(/UNION|WEDDING|MARRIED|PROPOSED|COURTSHIP|IN LOVE/.test(t)) return 'romance';
    if(/CHILD WAS BORN|BIRTH|BORN TO THE SUBJECT|NEW CHILD|SUB-FILE/.test(t)) return 'birth';
    if(/GRADUAT|LEAVING CERTIFICATE|UNIVERSITY|DEGREE|SCHOOL/.test(t)) return 'graduation';
    if(/PROMOT|MOVING UP|RAISE/.test(t)) return 'promotion';
    if(/LAID OFF|LET GO|DISMISSED|TERMINATED|POSITION (LOST|ENDED)|UNEMPLOYED/.test(t)) return 'jobloss';
    if(/HIRED|FIRST PAYING|NEW POSITION|STEADY WORK|CONTRACT/.test(t)) return 'firstjob';
    if(/CLINIC|HOSPITAL|TREATMENT|DOCTOR|SURGERY|DIAGNOS/.test(t)) return 'clinic';
    if(/RECOVER|RECOVERED|ON THE MEND|REMISSION/.test(t)) return 'recovery';
    if(/ILLNESS|ILL |SICK|FEVER|CONDITION|INFLUENZA|MEASLES/.test(t)) return 'illness';
    if(/DETENTION|GUARDIANSHIP|FORM 11-C|SCRUTINY|HEARING|BUREAU|INCARCERAT|SENTENC/.test(t)) return 'bureau';
    if(/ARRIVAL|TRAVEL|DEPARTED|ARRIVED|RAILWAY|TRAIN|CHECKPOINT|MOVED/.test(t)) return 'travel';
    if(/RELOCAT|NEW ADDRESS|MOVED INTO|HOUSING/.test(t)) return 'movinghome';
    if(/COMMENDATION|ACHIEVEMENT|AWARD|MEDAL|RECORD NOTATION|EXEMPLARY/.test(t)) return 'achievement';
    if(/FRIEND|CONTACT|COMPANION/.test(t)) return 'friendship';
    if(/DIVORC|SEPARAT|AFFAIR DISCOVERED|QUARREL|ESTRANGED/.test(t)) return 'conflict';
    if(/FAMILY|CHILDREN|KIDS|HOUSEHOLD/.test(t)) return 'family';
    if(/WORKPLACE|SHIFT|FACTORY|FOUNDRY|EMPLOYER/.test(t)) return 'workplace';
    if(/POVERTY|DEBT|RENT|HUNGER|SOUP|EVICTED/.test(t)) return 'poverty';
    if(/SCHOOL|LESSON|CLASSROOM|TEACHER/.test(t)) return 'school';
    if(/CHILDHOOD|CHILD |YOUNG/.test(t)) return 'childhood';
    return '';
  }

  /* Public: contextual scene artwork. ctx = {seed, settlementId, age, tone,
   * year, people:[descriptor,...]} — everything optional except seed. */
  function eventScene(key,ctx){
    ctx=ctx||{};
    var fam=FAMILIES[key];
    if(!fam||!fam.length) return '';
    var seedStr=key+'|'+String(ctx.seed==null?'lf':ctx.seed)+'|'+String(ctx.year==null?'':ctx.year);
    var vi=fnv1a(seedStr)%fam.length;
    var cacheKey='s|'+key+'|'+vi+'|'+String(ctx.settlementId||'');
    if(sceneCache.has(cacheKey)) return sceneCache.get(cacheKey);
    var r=rngFor('var:'+seedStr);
    var body=fam[vi](r,ctx);
    var gid='lfs'+fnv1a(cacheKey).toString(36);
    var svg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" class="lf-scene lf-scene-'+key+'">'+
      '<defs><filter id="'+gid+'n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer></filter></defs>'+
      locationBackdrop(ctx.settlementId)+
      body+
      '<rect width="'+W+'" height="'+H+'" filter="url(#'+gid+'n)" opacity="0.07"/>'+
      '<rect width="'+W+'" height="'+H+'" fill="none" stroke="#6b5631" stroke-width="3" opacity="0.4"/>'+
      '</svg>';
    return cacheSet(sceneCache,cacheKey,svg);
  }
  function milestoneScene(key,ctx){ return eventScene(key,ctx); }

  /* Convenience: scene key + svg for a Notice-like payload in one call. */
  function noticeArt(title,body,ctx){
    ctx=ctx||{};
    var key=ctx.sceneKey||sceneKeyFromText(String(title||'')+' '+String(body||''));
    if(!key) return null;
    return {key:key,svg:eventScene(key,ctx)};
  }

  root.IllustrationSystem={
    version:'1.0.0',
    SCENE_KEYS:SCENE_KEYS,
    ageBandOf:ageBandOf,
    visualIdentity:visualIdentity,
    featureSignature:featureSignature,
    personPortrait:personPortrait,
    subjectPortrait:function(subject,options){ var d=subjectDescriptor(subject); return d?personPortrait(d,options):''; },
    subjectDescriptor:subjectDescriptor,
    npcDescriptor:npcDescriptor,
    contactDescriptor:contactDescriptor,
    kinDescriptor:kinDescriptor,
    parentDescriptor:parentDescriptor,
    storyPortraitDescriptor:storyPortraitDescriptor,
    resolveCastMember:resolveCastMember,
    storyPortrait:function(run,speakerKey,label,world,subject){
      var d=storyPortraitDescriptor(run,speakerKey,label,world,subject);
      return d?personPortrait(d,{bust:true}):null;
    },
    eventScene:eventScene,
    milestoneScene:milestoneScene,
    sceneKeyFromText:sceneKeyFromText,
    noticeArt:noticeArt
  };
})(typeof globalThis!=='undefined'?globalThis:this);
