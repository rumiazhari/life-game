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

  function nextFromState(stream){
    let x=stream.state;
    x^=x<<13;
    x^=x>>>17;
    x^=x<<5;
    stream.state=x>>>0;
    return stream.state/0x100000000;
  }

  function makeStream(seed){
    const stream={state:hashSeed(seed)};
    stream.next=()=>nextFromState(stream);
    stream.range=(min,max)=>min+stream.next()*(max-min);
    stream.int=(min,max)=>Math.floor(stream.range(min,max+1));
    stream.pick=items=>items[Math.floor(stream.next()*items.length)];
    stream.chance=probability=>stream.next()<probability;
    stream.setSeed=nextSeed=>{stream.state=hashSeed(nextSeed);return stream;};
    stream.reset=()=>{stream.state=hashSeed(seed);return stream;};
    stream.isSeeded=()=>true;
    return stream;
  }

  const api={
    next(){ return state==null?Math.random():nextFromState({get state(){return state;},set state(value){state=value;}}); },
    range(min,max){ return min+api.next()*(max-min); },
    int(min,max){ return Math.floor(api.range(min,max+1)); },
    pick(items){ return items[Math.floor(api.next()*items.length)]; },
    chance(probability){ return api.next()<probability; },
    setSeed(seed){ state=hashSeed(seed); return api; },
    reset(){ state=null; return api; },
    isSeeded(){ return state!=null; },
    create(seed){ return makeStream(seed); },
    hashSeed
  };

  root.Random=api;
})(typeof globalThis!=='undefined'?globalThis:this);
