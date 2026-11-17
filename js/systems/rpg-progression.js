'use strict';
/* Phase 8: read-only evidence selection and authoritative professional standing.
 * No duplicate gear inventory. World.storyItems and EmploymentSystem remain owners. */
(function(root){
 const rpg=root.RPG;
 if(!rpg||typeof rpg.previewCheck!=='function')return;
 const rawPreview=rpg.previewCheck,rawResolve=rpg.resolveCheck;
 const CATALOG=Object.freeze([
  Object.freeze({id:'career_portfolio',domain:'labor',bonus:2,label:'Work portfolio'}),
  Object.freeze({id:'career_letter',domain:'social',bonus:1,label:'Signed reference'}),
  Object.freeze({id:'grey_duplicate',domain:'bureau',bonus:2,label:'Ledger duplicate'}),
  Object.freeze({id:'grey_testimony',domain:'bureau',bonus:1,label:'Recorded testimony'}),
  Object.freeze({id:'ward_notice',domain:'bureau',bonus:1,label:'Ward notice'})
 ]);
 function evidenceFor(w,s){
  if(!w||!s||!w.storyItems)return [];
  return CATALOG.filter(g=>Object.prototype.hasOwnProperty.call(w.storyItems,g.id)&&
   !!w.storyItems[g.id]).sort((a,b)=>b.bonus-a.bonus||a.id.localeCompare(b.id))
   .map(g=>({id:g.id,domain:g.domain,bonus:g.bonus,label:g.label}));
 }
 function professionalTier(w){
  if(!w||!root.EmploymentSystem||typeof root.EmploymentSystem.activeForPerson!=='function')return 0;
  try{
   const active=root.EmploymentSystem.activeForPerson(w,'subject')[0];
   return active&&active.status==='active'?Math.max(0,Math.min(10,Number(active.jobTier)||0)):0;
  }catch(_){return 0;}
 }
 function prepared(w,options){
  const src=options||{},opt=Object.assign({},src);
  if(opt.subject&&opt.domain==='labor'){
   opt.subject=Object.assign({},opt.subject,{jobTier:professionalTier(w)});
  }
  let auto=null;
  // Explicit equipment choice wins, even if the selected item is not owned.
  if(opt.subject&&!opt.item&&opt.item==null&&opt.autoEvidence!==false){
   const eligible=evidenceFor(w,opt.subject).filter(x=>x.domain===opt.domain);
   if(eligible.length){
    auto=eligible[0];
    opt.item=auto.id;
    if(opt.itemBonus==null)opt.itemBonus=auto.bonus;
   }
  }
  return {opt,evidence:auto};
 }
 function decorate(result,evidence){
  if(!result||!result.ok)return result;
  result.equippedEvidence=evidence?evidence.id:null;
  return result;
 }
 rpg.previewCheck=function(w,options){
  const {opt,evidence}=prepared(w,options);
  return decorate(rawPreview(w,opt),evidence);
 };
 rpg.resolveCheck=function(w,options){
  const {opt,evidence}=prepared(w,options);
  return decorate(rawResolve(w,opt),evidence);
 };
 root.RPGProgression=Object.freeze({CATALOG,evidenceFor,professionalTier});
})(typeof globalThis!=='undefined'?globalThis:this);
