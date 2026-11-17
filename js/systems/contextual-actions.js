'use strict';
/* Phase 2: five contextual choices from existing action registries.
 * The sole action/energy authority remains performActionNow and __doneActions.
 * RPG's existing 3d6 is used for a small execution-quality modifier only. */
(function(root){
  const RPG=root.RPG;
  const FAMILIES=[
    {family:'work',title:'WORK',icon:'work',candidates:[['p','overtime'],['p','lookwork']]},
    {family:'learn',title:'LEARN',icon:'book',candidates:[['p','study']]},
    {family:'connect',title:'CONNECT',icon:'family',candidates:[['p','tendspouse'],['p','family'],['p','court'],['p','writemother'],['p','writefather'],['p','meetsomeone']]},
    {family:'recover',title:'RECOVER',icon:'med',candidates:[['p','walk'],['p','doctor'],['p','rest']]},
    {family:'risk',title:'RISK',icon:'alert',candidates:[['p','track'],['p','bottle'],['d','crime']]}
  ];
  const CHECKS={
    'p:overtime':{category:'work',domain:'labor',difficulty:'standard'},
    'p:study':{category:'learn',domain:'study',difficulty:'standard'},
    'p:tendspouse':{category:'connect',domain:'social',difficulty:'standard'},
    'p:family':{category:'connect',domain:'social',difficulty:'standard'},
    'p:court':{category:'connect',domain:'social',difficulty:'standard'},
    'p:writemother':{category:'connect',domain:'social',difficulty:'standard'},
    'p:writefather':{category:'connect',domain:'social',difficulty:'standard'},
    'p:walk':{category:'recover',domain:'grit',difficulty:'standard'},
    'p:track':{category:'risk',domain:'hustle',difficulty:'hard'}
  };
  const config=(type,id)=>CHECKS[type+':'+id]||null;
  function preview(world,subject,type,id){
    const cfg=config(type,id);
    if(!cfg||!RPG||typeof RPG.previewCheck!=='function'||!world||!subject)return null;
    return RPG.previewCheck(world,{actorId:'subject',subject,domain:cfg.domain,difficulty:cfg.difficulty});
  }
  function lanes(world,subject,options){
    const opts=options||{},getAction=opts.getAction||(()=>null);
    const reserved=opts.reserved||(()=>false);
    const budget=Number.isFinite(opts.remainingEnergy)?Math.max(0,opts.remainingEnergy):Infinity;
    const jailed=!!subject&&Number(subject.jailUntil)>Number(subject.age);
    const playerReady=!!subject&&subject.alive!==false&&!jailed;
    return FAMILIES.map(f=>{
      const candidates=f.candidates.map(pair=>{
        const type=pair[0],id=pair[1],action=getAction(type,id);
        if(!action||typeof action.avail!=='function')return null;
        let eligible=false;
        try{eligible=!!action.avail(subject)&&!reserved(id);}catch(_){}
        return eligible?{type,id,action,cost:Number(action.cost)||0}:null;
      }).filter(Boolean);
      const selected=candidates.find(c=>c.cost<=budget)||candidates[0]||null;
      const affordable=!!selected&&selected.cost<=budget;
      const available=playerReady&&affordable;
      return {
        family:f.family,title:f.title,icon:f.icon,
        type:selected?selected.type:null,id:selected?selected.id:null,
        cost:selected?selected.cost:0,available,
        reason:!playerReady?(jailed?'in_custody':'unavailable'):
          !selected?'unavailable':!affordable?'no_energy':'',
        check:selected?preview(world,subject,selected.type,selected.id):null
      };
    });
  }
  function resolve(world,subject,type,id,options){
    const cfg=config(type,id),opts=options||{};
    if(!cfg||!RPG||typeof RPG.resolveCheck!=='function'||!world||!subject)return null;
    const year=Number.isFinite(opts.year)?Math.round(opts.year):world.year;
    const stream=opts.stream||(
      root.WorldSimulation&&typeof root.WorldSimulation.streamFor==='function'
        ?root.WorldSimulation.streamFor(world,year,'context:'+type+':'+id,'arcade-actions')
        :root.Random.create([world.seed,year,'context',type,id].join('|'))
    );
    const check=RPG.resolveCheck(world,{actorId:'subject',subject,domain:cfg.domain,difficulty:cfg.difficulty,stream});
    return check&&check.ok?{category:cfg.category,check}:null;
  }
  function bonusFor(outcome,baseFx){
    if(!outcome||!outcome.check)return {};
    const ok=outcome.check.success;
    switch(outcome.category){
      case 'work':return ok?{assets:50}:{health:-1};
      case 'learn':return ok?{smarts:2}:{};
      case 'connect':return ok?{relations:2}:{};
      case 'recover':return ok?{health:2}:{};
      case 'risk':return ok?{assets:Number(baseFx&&baseFx.assets)<0?75:40}:{happiness:-1};
      default:return {};
    }
  }
  function combineFx(base,extra){
    const out=Object.assign({},base||{});
    Object.entries(extra||{}).forEach(([key,value])=>{
      if(Number.isFinite(value))out[key]=(Number(out[key])||0)+value;
    });
    return out;
  }
  root.ContextualActions={FAMILIES,config,lanes,preview,resolve,bonusFor,combineFx};
})(typeof globalThis!=='undefined'?globalThis:this);
