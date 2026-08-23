'use strict';

/* ================= KARSEN FILES: EPISODE ENGINE =================
 *
 * A visual-novel runtime over hand-authored episode scripts
 * (js/systems/story-episodes.js). Episodes are selected because your LIFE
 * earns them -- a cold marriage summons THE VOSS LETTER, a struggling
 * foundry summons THE THURSDAY LEDGER -- and played as branching scenes of
 * quoted dialogue with multiple endings whose consequences land on your
 * real file: marriage, job, family mood, Bureau scrutiny, Hold trust/heat,
 * NPC bonds, RelationshipMemory.
 *
 * World-persistent state (owned here, bounded, migrated):
 * - World.storyRuns      ('story:NNNNN')  at most ONE live episode run
 * - World.storyArchive   ('story-archive:NNNNN') completed episodes:
 *   ending ids, tones, and an echo line later episodes can quote
 * - counters + schema version + lastTickYear
 *
 * Rules honored: deterministic selection via WorldSimulation.streamFor;
 * same-year idempotent tick with stale-year rejection; effects applied
 * exactly once per choice/ending (guarded); malformed records repaired in
 * migration without being dropped; checkInvariants returns strings.
 */

(function(root){
  const SCHEMA_VERSION=2;
  const SUBSYSTEM='story';
  const MAX_ARCHIVE=64;
  const SPAWN_CHANCE=0.5;
  const SIGNATURE_FRESH_YEARS=8;
  const SIGNATURE_REUSE_CHANCE=0.12;
  const MIN_YEAR=-5000;
  const MAX_YEAR=5000;

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const isValidCounter=v=>typeof v==='number'&&Number.isFinite(v)&&Number.isInteger(v)&&v>=0;
  const boundedYear=(value,fallback)=>{
    const safe=fallback!=null&&Number.isFinite(Number(fallback))?Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(fallback)))):0;
    if(value==null||!Number.isFinite(Number(value))) return safe;
    return Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(value))));
  };
  const boundedYearOrNull=value=>value==null||!Number.isFinite(Number(value))?null:boundedYear(value,0);

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('StorySystem.ensure requires a world object');
    if(!world.storyRuns||typeof world.storyRuns!=='object'||Array.isArray(world.storyRuns)) world.storyRuns={};
    if(!world.storyArchive||typeof world.storyArchive!=='object'||Array.isArray(world.storyArchive)) world.storyArchive={};
    if(!isValidCounter(world.storyCounter)) world.storyCounter=0;
    if(!isValidCounter(world.storyArchiveCounter)) world.storyArchiveCounter=0;
    world.storyLastTickYear=boundedYearOrNull(world.storyLastTickYear);
    world.storySchemaVersion=SCHEMA_VERSION;
    return world;
  }
  function migrate(world){ return ensure(world); }

  /* ================= EFFECTS ================= */

  function partnerContact(S){
    if(!S||!Array.isArray(S.contacts)) return null;
    return S.contacts.find(c=>c&&(c.role==='spouse'||c.role==='partner')&&c.alive!==false)||null;
  }
  function clampStat(S,key,delta,chips){
    const cap=key==='health'&&S.healthCap!=null?S.healthCap:key==='looks'&&S.looksCap!=null?S.looksCap:100;
    const before=finite(S[key],50);
    const delta2=clamp(delta,-40,40);
    const after=clamp(Math.round(before+delta2),0,cap);
    S[key]=after;
    chips.push({txt:(delta2>0?'+':'−')+Math.abs(delta2)+' '+key.toUpperCase(),plus:delta2>0});
  }
  function applyOps(world,S,lineage,ops,chips,year){
    (ops||[]).forEach(op=>{
      if(!op||typeof op!=='object') return;
      switch(op.kind){
        case 'stat': clampStat(S,op.stat,op.delta,chips); break;
        case 'money': {
          const d=clamp(op.delta,-50000,20000);
          S.assets=clamp(finite(S.assets,0)+d,-200000,1000000);
          chips.push({txt:(d>0?'+':'−')+'$'+Math.abs(d).toLocaleString('en-US'),plus:d>0});
          break;
        }
        case 'partnerMood': {
          const p=partnerContact(S);
          if(p){ p.mood=clamp(finite(p.mood,50)+clamp(op.delta,-40,40),0,100); chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' PARTNER',plus:op.delta>0}); }
          else clampStat(S,'happiness',Math.round((op.delta||0)*0.4),chips);
          break;
        }
        case 'familyMood': {
          const before=finite(S.familyMood,50);
          S.familyMood=clamp(before+clamp(op.delta,-40,40),0,100);
          chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' FAMILY',plus:op.delta>0});
          break;
        }
        case 'contactMood': {
          const c=(S.contacts||[]).find(x=>x.cid===op.cid);
          if(c){ c.mood=clamp(finite(c.mood,50)+clamp(op.delta,-40,40),0,100); chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' FRIEND',plus:op.delta>0}); }
          break;
        }
        case 'npcBond': {
          if(!op.npcId) break;
          const npc=world.npcs&&world.npcs[op.npcId];
          if(npc&&root.NpcSystem&&typeof root.NpcSystem.relationship==='function'){
            const rel=root.NpcSystem.relationship(npc,String(S.npcId||'subject'),{closeness:50});
            rel.closeness=clamp(finite(rel.closeness,50)+clamp(op.delta,-30,30),0,100);
            chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' BOND',plus:op.delta>0});
          }
          break;
        }
        case 'scrutiny':
          S.scrutiny=clamp((S.scrutiny||0)+clamp(op.delta,-30,30),0,100);
          chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' SCRUTINY',plus:op.delta<0});
          break;
        case 'record': if(op.value===true&&!S.record){ S.record=true; chips.push({txt:'RECORD NOTATION',plus:false}); } break;
        case 'vice': S.vice=clamp((S.vice||0)+clamp(op.delta||1,0,3),0,10); break;
        case 'holdTrust': if(typeof Hold==='object'&&Hold){ Hold.trust=clamp(finite(Hold.trust,50)+clamp(op.delta,-30,30),0,100); chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' HOLD TRUST',plus:op.delta>0}); } break;
        case 'holdHeat': if(typeof Hold==='object'&&Hold){ Hold.heat=clamp(finite(Hold.heat,0)+clamp(op.delta,-30,30),0,100); chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' HEAT',plus:op.delta<0}); } break;
        case 'holdMember': if(op.value===false&&S.holdMember){ S.holdMember=false; chips.push({txt:'OUT OF THE FOLD',plus:false}); } break;
        case 'marriageEnd': {
          const p=partnerContact(S);
          if(p){
            p.role='ex';
            if(Array.isArray(S.activeAffairCids)&&p.cid) S.activeAffairCids=S.activeAffairCids.filter(x=>x!==p.cid);
          }
          if(S.married||S.partner){
            S.married=false; S.status=op.status||'Divorced'; S.partner=null; S.partnerMood=0;
            chips.push({txt:'MARRIAGE ENDED',plus:false});
          }
          break;
        }
        case 'jobRaise': {
          try{
            const c=root.EmploymentSystem&&root.EmploymentSystem.activeForPerson?root.EmploymentSystem.activeForPerson(world,'subject')[0]:null;
            if(c&&typeof root.EmploymentSystem.adjustSalary==='function'){
              root.EmploymentSystem.adjustSalary(world,c.id,c.annualSalary+clamp(finite(op.amount,150),50,800),'episode_merit',year);
              chips.push({txt:'+'+(op.amount||220).toLocaleString('en-US')+'/YR WAGE',plus:true});
            } else { clampMoneyDirect(S,op.amount||220,chips); }
          }catch(e){ clampMoneyDirect(S,op.amount||220,chips); }
          break;
        }
        case 'jobEnd': {
          try{
            const c=root.EmploymentSystem&&root.EmploymentSystem.activeForPerson?root.EmploymentSystem.activeForPerson(world,'subject')[0]:null;
            if(c&&typeof root.EmploymentSystem.dismiss==='function'){
              root.EmploymentSystem.end(world,c.id,'terminated',String(op.reason||'episode').slice(0,32),year,{subject:S});
            } else { S.jobTier=0; S.jobName='Unemployed'; S.career=null; }
            chips.push({txt:'POSITION LOST',plus:false});
          }catch(e){}
          break;
        }
        case 'fixerBurn': {
          try{
            if(op.fixerId&&root.SurvivalSystem&&typeof root.SurvivalSystem.burnFixer==='function'){
              root.SurvivalSystem.burnFixer(world,op.fixerId,'episode',year);
              chips.push({txt:'OPERATION BURNED',plus:false});
            }
          }catch(e){}
          break;
        }
        case 'memory': {
          if(root.RelationshipMemory&&typeof root.RelationshipMemory.add==='function'){
            const participants=[...new Set([String(S.npcId||'subject')].concat((op.participants||[]).filter(Boolean).map(String)))];
            while(participants.length<2) participants.push('karsen');
            root.RelationshipMemory.add(world,{
              year, type:String(op.type||'life_story').slice(0,48),
              participants:participants.sort(),
              intensity:clamp(finite(op.intensity,.6),0,1),
              valence:clamp(finite(op.valence,.4),-1,1),
              decay:.006,
              summary:String(op.summary||'A chapter left its mark.').slice(0,240),
              tags:['story'].concat((op.tags||[]).map(t=>String(t).slice(0,24)))
            });
          }
          break;
        }
        default: break;
      }
    });
  }
  function clampMoneyDirect(S,delta,chips){
    S.assets=clamp(finite(S.assets,0)+clamp(delta,-50000,20000),-200000,1000000);
    if(chips) chips.push({txt:(delta>0?'+':'−')+'$'+Math.abs(delta).toLocaleString('en-US'),plus:delta>0});
  }

  /* ================= SELECTION ================= */

  function episodes(){ return Array.isArray(root.StoryEpisodes)?root.StoryEpisodes:[]; }
  function signatureKey(epId,castKey){ return epId+'|'+String(castKey||'life'); }
  function signatureBlocked(world,signature,year){
    for(const entry of Object.values(world.storyArchive)){
      if(entry.signature===signature&&year-(entry.resolvedYear||0)<SIGNATURE_FRESH_YEARS) return true;
    }
    return false;
  }

  function selectEpisode(world,S,lineage,year,rng){
    const candidates=[];
    episodes().forEach(def=>{
      if(typeof def.eligible!=='function') return;
      let bind=null;
      try{ bind=def.cast?def.cast.call(def,world,S,lineage):{}; }catch(e){ bind=null; }
      if(bind==null) return;
      let ok=false;
      try{ ok=!!def.eligible(world,S,lineage); }catch(e){ ok=false; }
      if(!ok) return;
      const castKey=(bind&&bind.length)?bind.map(b=>b.key+':'+(b.bind==null?'':b.bind)).join('|'):def.id;
      if(signatureBlocked(world,signatureKey(def.id,castKey),year)){
        if(!rng.chance(SIGNATURE_REUSE_CHANCE)) return;
      }
      let w=1; try{ w=Math.max(.05,def.weight?def.weight():1); }catch(e){}
      candidates.push({def,bind,castKey,w});
    });
    if(!candidates.length) return null;
    const total=candidates.reduce((s,c)=>s+c.w,0);
    let roll=rng.next()*total;
    for(const c of candidates){ roll-=c.w; if(roll<=0) return c; }
    return candidates[candidates.length-1];
  }

  /* ================= RUN LIFECYCLE ================= */

  function startRun(world,selection,year){
    const body=selection.def.build(selection.bind);
    const id='story:'+String(++world.storyCounter).padStart(5,'0');
    const castMap={};
    (selection.bind||[]).forEach(b=>{castMap[b.key]={label:b.label,bind:b.bind,npcId:b.npcId};});
    world.storyRuns[id]={
      id, episodeId:selection.def.id, domain:selection.def.domain||'life',
      title:body.title, bg:body.bg||'street',
      castKey:selection.castKey, signature:signatureKey(selection.def.id,selection.castKey),
      cast:castMap,
      scenes:body.scenes, startScene:body.startScene||Object.keys(body.scenes)[0],
      sceneId:null, lineIndex:0,
      flags:{}, tones:[], rememberNote:null,
      startedYear:year, status:'playing',
      finalizedEndingId:null, history:[]
    };
    // Enter the first scene immediately so currentView() is valid.
    enterScene(world.storyRuns[id],world.storyRuns[id].startScene,year);
    trimArchive(world);
    return world.storyRuns[id];
  }

  function enterScene(run,sceneId,year){
    if(!run.scenes[sceneId]) { run.sceneId=null; run.status='ended'; return; }
    run.sceneId=sceneId; run.lineIndex=0;
    const scene=run.scenes[sceneId];
    if(scene.ending&&!run.finalizedEndingId){
      finalizeEnding(sceneId,scene,run,year);
    }
  }

  function finalizeEnding(sceneId,scene,run,year){
    const e=scene.ending;
    run.finalizedEndingId=e.id;
    run.status='ended';
    run.ending={id:e.id,title:e.title,tone:e.tone||'prudent',epilogue:(e.epilogue||[]).slice(0,4)};
  }

  function liveRun(world){
    ensure(world);
    const runs=Object.values(world.storyRuns).filter(r=>r&&r.status!=='filed');
    return runs[0]||null;
  }
  function hasLiveRun(world){ return !!liveRun(world); }

  function currentView(world,options){
    ensure(world);
    const opts=options||{};
    void opts.year;
    const run=liveRun(world);
    if(!run) return null;
    if(run.status==='ended'&&run.ending){
      return {type:'ending',runId:run.id,title:run.title,domain:run.domain,
        ending:run.ending,chips:run.pendingChips||[],remember:run.rememberNote||null,
        sceneNo:Object.keys(run.scenes).length};
    }
    const scene=run.scenes[run.sceneId];
    if(!scene) return null;
    const lines=Array.isArray(scene.lines)?scene.lines:[];
    if(run.lineIndex<lines.length){
      const line=lines[run.lineIndex];
      return {type:'line',runId:run.id,title:run.title,bg:run.bg,domain:run.domain,
        speaker:speakerOf(run,line.sp),text:line.t,
        sceneNo:sceneNumber(run),lineIndex:run.lineIndex,lineCount:lines.length,
        isLastLine:run.lineIndex>=lines.length-1&&!scene.choice&&!scene.goto&&!scene.ending,
        remember:run.rememberNote||null};
    }
    if(scene.choice){
      return {type:'choice',runId:run.id,title:run.title,bg:run.bg,domain:run.domain,
        prompt:scene.choice.prompt,
        options:scene.choice.options.map((o,i)=>({index:i,t:o.t,note:o.note||'',tone:o.tone||'prudent'})),
        sceneNo:sceneNumber(run)};
    }
    if(scene.goto){
      return {type:'transition',runId:run.id};
    }
    // Dead-end safety: treat as quiet close.
    return {type:'ending',runId:run.id,title:run.title,domain:run.domain,
      ending:{id:'unlabeled',title:'THE FILE CLOSES ITSELF',tone:'prudent',epilogue:['Some chapters refuse their own ending. This one simply stops.']},
      chips:[],sceneNo:sceneNumber(run)};
  }
  function speakerOf(run,key){
    if(key==='narrator') return {key:'narrator',label:''};
    if(key==='you') return {key:'you',label:'YOU'};
    const c=run.cast[key];
    return {key,label:c?c.label:key.toUpperCase()};
  }
  function sceneNumber(run){
    const keys=Object.keys(run.scenes);
    return keys.indexOf(run.sceneId)+1+'/'+keys.length;
  }

  /* Advance one beat. Returns the next view (never null while a run exists). */
  function next(world,options){
    ensure(world);
    const year=boundedYear(options&&options.year,boundedYear(world.year,0));
    const run=liveRun(world); if(!run) return null;
    if(run.status==='ended') return currentView(world,{year});
    const scene=run.scenes[run.sceneId]; if(!scene) return currentView(world,{year});
    const lines=Array.isArray(scene.lines)?scene.lines:[];
    if(run.lineIndex<lines.length-1){ run.lineIndex++; return currentView(world,{year}); }
    // At or past the final line: resolve what follows.
    if(lines.length&&run.lineIndex===lines.length-1&&(scene.choice||scene.goto)){
      run.lineIndex++; // move past lines into choice/transition zone
    }
    if(scene.goto&&!scene.choice){
      enterScene(run,scene.goto,year);
      return currentView(world,{year});
    }
    return currentView(world,{year});
  }

  /* Choose an option at the current choice point. */
  function choose(world,index,options){
    ensure(world);
    const year=boundedYear(options&&options.year,boundedYear(world.year,0));
    const run=liveRun(world); if(!run||run.status==='ended') return {applied:false,reason:'no_choice'};
    const scene=run.scenes[run.sceneId]; if(!scene||!scene.choice) return {applied:false,reason:'no_choice'};
    const option=scene.choice.options[index];
    if(!option) return {applied:false,reason:'bad_option'};
    if(run.history.some(h=>h.type==='choice'&&h.sceneId===run.sceneId)) return {applied:false,reason:'already_resolved'};
    const S=options&&options.subject;
    const lineage=options&&options.lineage;
    const chips=[];
    applyOps(world,S,lineage,option.effects,chips,year);
    if(option.flag) run.flags[String(option.flag).slice(0,40)]=true;
    run.tones.push(option.tone||'prudent');
    run.rememberNote=option.note||null;
    run.history.push({type:'choice',sceneId:run.sceneId,option:index,tone:option.tone||'prudent'});
    if(option.goto&&run.scenes[option.goto]) enterScene(run,option.goto,year);
    else run.status='ended';
    return {applied:true,chips,view:currentView(world,{year})};
  }

  /* File a finished episode away (UI acknowledges THE END). Idempotent. */
  function fileAway(world,runId,options){
    ensure(world);
    const year=boundedYear(options&&options.year,boundedYear(world.year,0));
    const run=world.storyRuns[runId];
    if(!run||run.status==='filed') return {applied:false,reason:'already_filed'};
    run.status='filed';
    const aid='story-archive:'+String(++world.storyArchiveCounter).padStart(5,'0');
    const endingTone=run.ending?run.ending.tone:(run.tones[run.tones.length-1]||'prudent');
    world.storyArchive[aid]={
      id:aid, episodeId:run.episodeId, domain:run.domain, title:run.title,
      castKey:run.castKey, signature:run.signature,
      startedYear:run.startedYear, resolvedYear:year,
      endingId:run.finalizedEndingId||'unlabeled',
      endingTitle:run.ending?run.ending.title:'',
      tone:endingTone,
      echoLine:'The city still tells the '+run.title.toLowerCase()+' its own way.'
    };
    delete world.storyRuns[runId];
    trimArchive(world);
    return {applied:true};
  }
  function trimArchive(world){
    const keys=Object.keys(world.storyArchive);
    if(keys.length<=MAX_ARCHIVE) return;
    keys.map(k=>world.storyArchive[k])
      .sort((a,b)=>a.resolvedYear-b.resolvedYear||String(a.id).localeCompare(String(b.id)))
      .slice(0,keys.length-MAX_ARCHIVE)
      .forEach(e=>{delete world.storyArchive[e.id];});
  }

  /* Prologue echo from a prior episode's ending, when one exists. */
  function echoLineFor(world){
    const entries=Object.values(world.storyArchive);
    if(!entries.length) return null;
    const latest=entries.sort((a,b)=>b.resolvedYear-a.resolvedYear||String(b.id).localeCompare(String(a.id)))[0];
    return latest&&latest.echoLine?latest.echoLine:null;
  }

  /* ================= TICK ================= */

  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    const lineage=opts.lineage||null;
    const year=boundedYear(opts.year!=null?opts.year:world.year,world.year);
    const result={year,applied:false,spawned:null,resolved:[]};
    if(world.storyLastTickYear===year) return Object.assign(result,{applied:false,reason:'already_applied'});
    if(world.storyLastTickYear!=null&&year<world.storyLastTickYear) return Object.assign(result,{applied:false,reason:'stale_year'});
    result.applied=true;

    // Fast-forward: auto-play any live episode to its ending.
    if(opts.autoResolve){
      const run=liveRun(world);
      if(run){
        let guard=0;
        while(liveRun(world)&&guard++<64){
          const view=currentView(world,{year});
          if(view.type==='ending'){ fileAway(world,view.runId,{year}); result.resolved.push({
            title:view.title, endingTitle:view.ending.title,
            logText:'EPISODE — “'+view.title+'” closed as “'+view.ending.title+'”.'
          }); continue; }
          if(view.type==='choice'){
            const pick=autoPick(view,opts.actorTone);
            choose(world,pick.index,{year,subject:S,lineage});
            continue;
          }
          next(world,{year});
        }
      }
    }

    // Spawn at most one new episode, and only when nothing is live.
    if(S&&S.alive!==false&&!liveRun(world)){
      const rng=root.WorldSimulation&&root.WorldSimulation.streamFor
        ?root.WorldSimulation.streamFor(world,year,'story-spawn','story')
        :root.Random.create([world.seed,year,'story-spawn','story'].join('|'));
      if(rng.chance(SPAWN_CHANCE)){
        const sel=selectEpisode(world,S,lineage,year,rng);
        if(sel){ const run=startRun(world,sel,year); result.spawned=run.id; }
      }
    }

    world.storyLastTickYear=year;
    return result;
  }

  function autoPick(view,tone){
    const pref={
      saint:{kind:3,prudent:2,grey:1,cold:0,greedy:-1},
      gambler:{greedy:3,kind:1,prudent:1,cold:1,grey:1},
      hustler:{greedy:3,prudent:2,kind:1,cold:1,grey:1}
    }[tone]||{prudent:3,kind:2,grey:1,cold:1,greedy:0};
    let best=view.options[0],bestScore=-Infinity;
    view.options.forEach(o=>{
      const score=(pref[o.tone]!=null?pref[o.tone]:1)+(o.index%2)*0.01;
      if(score>bestScore){bestScore=score;best=o;}
    });
    return best;
  }

  /* ================= SUMMARY & INVARIANTS ================= */

  function summary(world){
    ensure(world);
    const archive=Object.values(world.storyArchive);
    return {
      active:Object.values(world.storyRuns).filter(r=>r&&r.status!=='filed').length,
      archived:archive.length,
      endings:archive.reduce((acc,e)=>{acc[e.endingId]=(acc[e.endingId]||0)+1;return acc;},{})
    };
  }

  function checkInvariants(world){
    ensure(world);
    const issues=[];
    if(!isValidCounter(world.storyCounter)) issues.push('storyCounter must be a finite non-negative integer');
    if(!isValidCounter(world.storyArchiveCounter)) issues.push('storyArchiveCounter must be a finite non-negative integer');
    const live=Object.values(world.storyRuns).filter(r=>r&&r.status!=='filed');
    if(live.length>1) issues.push('more than one live episode run');
    Object.keys(world.storyRuns).sort().forEach(key=>{
      const r=world.storyRuns[key];
      if(!r||typeof r!=='object'){issues.push('story run '+key+' must be an object');return;}
      if(r.id!==key) issues.push('story run key/id mismatch: '+key);
      if(!/^story:\d{5,}$/.test(String(r.id))) issues.push('malformed run id: '+key);
      if(!r.scenes||typeof r.scenes!=='object') issues.push('run '+key+' has no scenes');
      if(!Array.isArray(r.history)) issues.push('run '+key+' history must be an array');
      if(r.status==='ended'&&!r.finalizedEndingId&&r.sceneId) {} // dead-end runs are legal
    });
    const sigs=new Set();
    Object.keys(world.storyArchive).sort().forEach(key=>{
      const a=world.storyArchive[key];
      if(!a||typeof a!=='object'){issues.push('archive '+key+' must be an object');return;}
      if(a.id!==key) issues.push('archive key/id mismatch: '+key);
      if(!/^story-archive:\d{5,}$/.test(String(a.id))) issues.push('malformed archive id: '+key);
      if(sigs.has(a.signature)&&a.signature) issues.push('duplicate archive signature: '+a.signature);
      sigs.add(a.signature);
    });
    if(Object.keys(world.storyArchive).length>MAX_ARCHIVE) issues.push('archive exceeds bound');
    return issues;
  }

  root.StorySystem={
    SCHEMA_VERSION, SUBSYSTEM, MAX_ARCHIVE, SPAWN_CHANCE, SIGNATURE_FRESH_YEARS,
    ensure, migrate,
    tickWorld, currentView, next, choose, fileAway,
    hasLiveRun, liveRun, echoLineFor, signatureBlocked,
    summary, checkInvariants
  };
})(typeof globalThis!=='undefined'?globalThis:this);
