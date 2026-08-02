'use strict';

(function(root){
  let state=null;

  function hashSeed(seed){
    if(typeof seed==='number'&&Number.isFinite(seed)){
      const numeric=(Math.floor(seed)>>>0);
      return numeric||0x6d2b79f5;
    }
    const text=String(seed==null?'':seed);
    let hash=2166136261;
    for(let i=0;i<text.length;i++){
      hash^=text.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return (hash>>>0)||0x6d2b79f5;
  }

  function seededNext(){
    let x=state;
    x^=x<<13;
    x^=x>>>17;
    x^=x<<5;
    state=x>>>0;
    return state/0x100000000;
  }

  const api={
    next(){ return state==null?Math.random():seededNext(); },
    range(min,max){ return min+api.next()*(max-min); },
    int(min,max){ return Math.floor(api.range(min,max+1)); },
    pick(items){ return items[Math.floor(api.next()*items.length)]; },
    chance(probability){ return api.next()<probability; },
    setSeed(seed){ state=hashSeed(seed); return api; },
    reset(){ state=null; return api; },
    isSeeded(){ return state!=null; }
  };

  root.Random=api;
})(typeof globalThis!=='undefined'?globalThis:this);
