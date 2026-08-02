'use strict';

(function(root){
  const boundedKeys=new Set(['health','happiness','smarts','looks','relations','vice','crime','scrutiny','freedom','housingSecurity','financialSecurity']);
  const clampValue=(value,min,max)=>Math.max(min,Math.min(max,value));

  function normalize(effects){
    const normalized={};
    if(!effects||typeof effects!=='object') return normalized;
    Object.keys(effects).forEach(key=>{
      const amount=Number(effects[key]);
      if(Number.isFinite(amount)) normalized[key]=amount;
    });
    return normalized;
  }

  function apply(target,effects){
    const changes={};
    if(!target||typeof target!=='object') return changes;
    Object.keys(normalize(effects)).forEach(key=>{
      const amount=Number(effects[key]);
      const before=Number.isFinite(Number(target[key]))?Number(target[key]):0;
      const cap=key==='health'&&target.healthCap!=null?target.healthCap:key==='looks'&&target.looksCap!=null?target.looksCap:100;
      const next=boundedKeys.has(key)?clampValue(before+amount,0,cap):before+amount;
      target[key]=next;
      changes[key]=next-before;
    });
    return changes;
  }

  root.Effects={schemaVersion:1,normalize,apply,boundedKeys:Array.from(boundedKeys)};
})(typeof globalThis!=='undefined'?globalThis:this);
