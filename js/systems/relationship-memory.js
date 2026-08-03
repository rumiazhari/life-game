'use strict';

(function(root){
  const SCHEMA_VERSION=1;
  const MAX_TOTAL_MEMORIES=600;
  const MAX_PAIR_MEMORIES=48;
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('RelationshipMemory.ensure requires a world object');
    if(!world.relationshipMemories||typeof world.relationshipMemories!=='object'||Array.isArray(world.relationshipMemories)) world.relationshipMemories={};
    if(!Number.isFinite(Number(world.relationshipMemoryCounter))||Number(world.relationshipMemoryCounter)<0) world.relationshipMemoryCounter=0;
    world.relationshipMemorySchemaVersion=SCHEMA_VERSION;
    return world.relationshipMemories;
  }

  function normalizedParticipants(participants){
    return [...new Set((Array.isArray(participants)?participants:[]).filter(Boolean).map(String))].sort();
  }

  function pairKey(a,b){
    const ids=[String(a||''),String(b||'')].filter(Boolean).sort();
    return ids.join('|');
  }

  function nextId(world,year){
    ensure(world);
    world.relationshipMemoryCounter+=1;
    return 'memory:'+String(year||0)+':'+String(world.relationshipMemoryCounter).padStart(6,'0');
  }

  function signature(memory){
    return [memory.year,memory.type,normalizedParticipants(memory.participants).join('|'),memory.summary||''].join('::');
  }

  function normalize(memory){
    const out=Object.assign({},memory||{});
    out.id=String(out.id||'');
    out.year=Number.isFinite(Number(out.year))?Math.round(Number(out.year)):0;
    out.type=String(out.type||'relationship_event');
    out.participants=normalizedParticipants(out.participants);
    out.intensity=clamp(out.intensity==null?.5:out.intensity);
    out.valence=Math.max(-1,Math.min(1,Number.isFinite(Number(out.valence))?Number(out.valence):0));
    out.decay=clamp(out.decay==null?.035:out.decay,0,.5);
    out.summary=String(out.summary||'').slice(0,240);
    out.tags=Array.isArray(out.tags)?[...new Set(out.tags.filter(Boolean).map(String))].slice(0,12):[];
    out.expired=!!out.expired;
    return out;
  }

  function add(world,input){
    const store=ensure(world);
    const memory=normalize(input);
    if(memory.participants.length<2) return null;
    const duplicate=Object.values(store).find(existing=>signature(existing)===signature(memory));
    if(duplicate) return duplicate;
    memory.id=memory.id||nextId(world,memory.year);
    store[memory.id]=memory;
    prune(world,memory.year);
    return memory;
  }

  function remainingIntensity(memory,currentYear){
    const age=Math.max(0,(Number(currentYear)||0)-(Number(memory.year)||0));
    return Math.max(0,clamp(memory.intensity)-clamp(memory.decay,0,.5)*age);
  }

  function effect(memory,currentYear){
    const strength=remainingIntensity(memory,currentYear);
    const valence=Math.max(-1,Math.min(1,Number(memory.valence)||0));
    return {
      strength,
      closeness:valence*strength*18,
      trust:valence*strength*14,
      conflict:-valence*strength*12
    };
  }

  function forPerson(world,personId,otherId){
    const store=ensure(world);
    const person=String(personId||''), other=otherId==null?null:String(otherId);
    return Object.values(store).filter(memory=>{
      const participants=normalizedParticipants(memory.participants);
      return participants.includes(person)&&(!other||participants.includes(other));
    }).sort((a,b)=>Number(b.year)-Number(a.year)||String(b.id).localeCompare(String(a.id)));
  }

  function modifier(world,personId,otherId,currentYear){
    return forPerson(world,personId,otherId).reduce((total,memory)=>{
      const delta=effect(memory,currentYear);
      total.closeness+=delta.closeness;
      total.trust+=delta.trust;
      total.conflict+=delta.conflict;
      return total;
    },{closeness:0,trust:0,conflict:0});
  }

  function prune(world,currentYear){
    const store=ensure(world);
    const entries=Object.values(store);
    entries.forEach(memory=>{ memory.expired=remainingIntensity(memory,currentYear)<=.01; });

    const byPair={};
    entries.forEach(memory=>{
      const participants=normalizedParticipants(memory.participants);
      const key=participants.length===2?pairKey(participants[0],participants[1]):participants.join('|');
      if(!byPair[key]) byPair[key]=[];
      byPair[key].push(memory);
    });
    Object.values(byPair).forEach(group=>{
      group.sort((a,b)=>Number(b.year)-Number(a.year)||String(b.id).localeCompare(String(a.id)));
      group.slice(MAX_PAIR_MEMORIES).forEach(memory=>{delete store[memory.id];});
    });

    const remaining=Object.values(store).sort((a,b)=>{
      const aScore=remainingIntensity(a,currentYear)+(a.expired?0:.5);
      const bScore=remainingIntensity(b,currentYear)+(b.expired?0:.5);
      return bScore-aScore||Number(b.year)-Number(a.year)||String(b.id).localeCompare(String(a.id));
    });
    remaining.slice(MAX_TOTAL_MEMORIES).forEach(memory=>{delete store[memory.id];});
    return store;
  }

  function tick(world,currentYear){
    prune(world,currentYear);
    return ensure(world);
  }

  function latestSummary(world,personId,otherId,limit=3){
    return forPerson(world,personId,otherId)
      .filter(memory=>!memory.expired)
      .slice(0,Math.max(0,limit))
      .map(memory=>memory.summary)
      .filter(Boolean);
  }

  root.RelationshipMemory={
    SCHEMA_VERSION,
    MAX_TOTAL_MEMORIES,
    MAX_PAIR_MEMORIES,
    ensure,
    add,
    normalize,
    pairKey,
    forPerson,
    effect,
    modifier,
    remainingIntensity,
    prune,
    tick,
    latestSummary
  };
})(typeof globalThis!=='undefined'?globalThis:this);
