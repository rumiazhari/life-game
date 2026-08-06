'use strict';

(function(root){
  let installed=false;
  const originals={};
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  function world(){ return typeof World!=='undefined'&&World&&root.WorldSimulation?World:null; }
  function settlement(){
    const w=world();
    return w&&typeof root.currentSettlement==='function'?root.currentSettlement():null;
  }
  function state(){
    const w=world(), s=settlement();
    return w&&s?root.WorldSimulation.getSettlementState(w,s.id):null;
  }
  function healthPressure(runtime){ return runtime?root.PublicHealth.pressure(runtime):0; }
  function currentYear(){ return world()&&Number(world().year)||0; }
  function localCost(field,fallback){
    const runtime=state(), economy=runtime&&runtime.economy;
    return economy&&Number.isFinite(Number(economy[field]))?Number(economy[field]):fallback;
  }
  function adjustPaidIncome(nominal,subject){
    const paid=Math.max(0,Number(nominal)||0), wageIndex=localCost('wageIndex',1);
    if(subject){ subject.__worldWageIndex=wageIndex; subject.__worldWageNominal=paid; subject.__worldWagePaid=Math.round(paid*wageIndex); }
    return Math.round(paid*wageIndex);
  }
  function wrapLiving(original,field){
    if(typeof original!=='function') return original;
    return function(){
      const base=original.apply(this,arguments);
      if(!base||!world()) return base;
      const copy=Object.assign({},base);
      copy[field]=Math.round(Number(base[field]||0)*localCost(field==='rent'?'rentIndex':'foodPriceIndex',1));
      return copy;
    };
  }
  function localVacancyScore(trackId,index){
    const runtime=state(), employment=runtime&&runtime.economy?runtime.economy.employmentIndex:.5;
    const demand=runtime&&runtime.economy&&runtime.economy.industryDemand||{};
    const demandBias=trackId==='agriculture'?demand.agriculture:trackId==='trade'||trackId==='business'?demand.services:demand.manufacturing;
    const threshold=clamp(.16+employment*.68+(Number(demandBias)||.5)*.12,0.08,.96);
    const stream=root.WorldSimulation.streamFor(world(),currentYear(),trackId,'vacancy');
    return stream.next()<threshold;
  }
  function install(){
    if(installed) return root.WorldGameplay;
    installed=true;
    originals.currentHousing=root.currentHousing;
    originals.currentFood=root.currentFood;
    originals.runEconomy=root.runEconomy;
    originals.rollJobVacancies=root.rollJobVacancies;
    originals.travelCost=root.travelCost;
    originals.scheduleTravel=root.scheduleTravel;
    originals.medicalStartOutbreak=root.medicalStartOutbreak;
    originals.educationOptionsForStage=root.educationOptionsForStage;
    originals.educationAnnualPayment=root.educationAnnualPayment;
    originals.educationAnnualCommuteCost=root.educationAnnualCommuteCost;

    if(originals.currentHousing) root.currentHousing=wrapLiving(originals.currentHousing,'rent');
    if(originals.currentFood) root.currentFood=wrapLiving(originals.currentFood,'cost');
    if(typeof originals.runEconomy==='function') root.runEconomy=function(){ originals.runEconomy.apply(this,arguments); };
    if(typeof originals.rollJobVacancies==='function') root.rollJobVacancies=function(){
      originals.rollJobVacancies.apply(this,arguments);
      const subject=typeof S!=='undefined'?S:null;
      if(!subject||!world()||!Array.isArray(subject.vacancies)) return subject?subject.vacancies:undefined;
      const persistent=typeof root.VacancySystem==='object'&&root.VacancySystem&&subject.vacancies.some(v=>v&&v.vacancyId);
      if(persistent){
        // Persistent vacancy records are authoritative openings — do not run
        // a second random filter over them.
        subject.vacancies=subject.vacancies.map(vacancy=>Object.assign({},vacancy,{employmentIndex:localCost('employmentIndex',.5)}));
        return subject.vacancies;
      }
      subject.vacancies=subject.vacancies.map((vacancy,index)=>{
        if(!vacancy||vacancy.stage<0) return vacancy;
        const trackId=vacancy.track||String(index);
        return Object.assign({},vacancy,{stage:localVacancyScore(trackId,index)?vacancy.stage:-1,employmentIndex:localCost('employmentIndex',.5)});
      });
      return subject.vacancies;
    };
    if(typeof originals.travelCost==='function') root.travelCost=function(from,to){
      const base=originals.travelCost.apply(this,arguments);
      const runtime=state(), friction=runtime&&runtime.security?runtime.security.checkpointPressure:0;
      return Math.max(25,Math.round(base*(1+friction*.22)));
    };
    if(typeof originals.scheduleTravel==='function') root.scheduleTravel=function(id){
      const result=originals.scheduleTravel.apply(this,arguments);
      const subject=typeof S!=='undefined'?S:null, runtime=state();
      if(result&&result.ok&&subject&&subject.traveling&&runtime&&runtime.security){
        const pressure=runtime.security.checkpointPressure;
        subject.traveling.checkpointPressure=pressure;
        subject.traveling.permitRisk=clamp((subject.traveling.permitRisk||0)+pressure*.42,0,.95);
      }
      return result;
    };
    if(typeof originals.medicalStartOutbreak==='function') root.medicalStartOutbreak=function(id,severity,years){
      const result=originals.medicalStartOutbreak.apply(this,arguments);
      const w=world(), runtime=state();
      if(w&&runtime){ w.publicHealth.activeSettlementId=settlement()&&settlement().id; root.PublicHealth.triggerShock(runtime,'outbreak',clamp((Number(severity)||1)*.38),years||2,w.year); }
      return result;
    };
    if(typeof originals.educationOptionsForStage==='function') root.educationOptionsForStage=function(stage){
      if(!stage) return [];
      let options=originals.educationOptionsForStage.apply(this,arguments)||[];
      const runtime=state(), capacityPressure=runtime&&runtime.education?clamp(runtime.education.capacityPressure):0;
      const basicStage=['lower','middle','upper'].includes(stage.id);
      if(!options.length&&basicStage&&typeof root.institutionsForStage==='function') options=root.institutionsForStage(stage.id);
      if(!options.length) return options;
      const qualityFactor=1-capacityPressure*.4;
      const adjusted=options.map(option=>Object.assign({},option,{quality:clamp((Number(option.quality)||0)*qualityFactor,0,1)}));
      const keep=Math.max(1,Math.ceil(adjusted.length-capacityPressure*(adjusted.length-1)));
      return adjusted.slice().sort((a,b)=>(Number(b.quality)||0)-(Number(a.quality)||0)||String(a.id).localeCompare(String(b.id))).slice(0,keep);
    };
    if(typeof originals.educationAnnualPayment==='function') root.educationAnnualPayment=function(){
      const base=Number(originals.educationAnnualPayment.apply(this,arguments))||0;
      return Math.round(base*root.WorldSimulation.getCostOfLiving(world(),settlement()&&settlement().id));
    };
    if(typeof originals.educationAnnualCommuteCost==='function') root.educationAnnualCommuteCost=function(){
      const base=Number(originals.educationAnnualCommuteCost.apply(this,arguments))||0;
      const runtime=state(), friction=runtime&&runtime.security?runtime.security.checkpointPressure:0;
      return Math.round(base*(1+friction*.3));
    };
    return root.WorldGameplay;
  }
  root.WorldGameplay={install,originals,localCost,healthPressure,adjustPaidIncome};
  install();
})(typeof globalThis!=='undefined'?globalThis:this);
