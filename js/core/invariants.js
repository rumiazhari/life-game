'use strict';

(function(root){
  const boundedStats=['health','happiness','smarts','looks','relations','vice','crime','scrutiny','freedom','housingSecurity','financialSecurity'];

  function check(subject,world){
    const violations=[];
    const s=subject||null;
    const w=world||null;
    if(s&&w&&Number.isFinite(s.dob)&&Number.isFinite(s.age)&&Number.isFinite(w.year)&&w.year!==s.dob+s.age){
      violations.push('world year must equal subject birth year plus age');
    }
    if(s&&s.assets!=null&&!Number.isFinite(Number(s.assets))) violations.push('assets must be finite');
    if(s){
      boundedStats.forEach(key=>{
        if(s[key]!=null&&(!Number.isFinite(Number(s[key]))||Number(s[key])<0||Number(s[key])>100)) violations.push(key+' must be between 0 and 100');
      });
      const conditions=s.medical&&Array.isArray(s.medical.conditions)?s.medical.conditions:(Array.isArray(s.conditions)?s.conditions:[]);
      const active=conditions.filter(c=>c&&!c.resolved&&c.state!=='resolved');
      const seen=new Set();
      active.forEach(c=>{
        const key=String(c.id||c.name||'unknown');
        if(seen.has(key)) violations.push('active medical conditions must not contain duplicate '+key);
        seen.add(key);
      });
      const enrolled=!!(s.eduStage||(s.education&&s.education.stageId));
      if(enrolled&&s.traveling) violations.push('an enrolled subject must not have an active journey');
      if(s.alive===false&&!String(s.cause||'').trim()) violations.push('a deceased subject must have a death cause');
    }
    return {ok:violations.length===0,violations};
  }

  function assertValid(subject,world){
    const result=check(subject,world);
    if(!result.ok) throw new Error('Invariant violation: '+result.violations.join('; '));
    return result;
  }

  root.Invariants={boundedStats,check,assertValid};
})(typeof globalThis!=='undefined'?globalThis:this);
