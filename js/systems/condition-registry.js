'use strict';
(function(root){
  const freeze=o=>Object.freeze(o);
  const CONDITIONS=freeze({
    respiratory:freeze({id:'respiratory',name:'Respiratory complaint',note:'breath catches in cold weather',minAge:4,base:2,contagious:true,incubation:0,kind:'illness',stackPolicy:'merge'}),
    infection:freeze({id:'infection',name:'Acute infection',note:'fever and exhaustion take hold',minAge:1,base:3,contagious:true,incubation:1,kind:'illness',stackPolicy:'merge'}),
    injury:freeze({id:'injury',name:'Lingering injury',note:'pain returns with work and weather',minAge:6,base:3,contagious:false,incubation:0,kind:'injury',stackPolicy:'merge'}),
    strain:freeze({id:'strain',name:'Nervous strain',note:'sleep is thin and easily broken',minAge:12,base:2,contagious:false,incubation:0,kind:'strain',stackPolicy:'merge'}),
    chronic:freeze({id:'chronic',name:'Chronic condition',note:'requires regular treatment',minAge:38,base:3,contagious:false,incubation:0,kind:'chronic',stackPolicy:'merge'})
  });
  const TREATMENTS=freeze({
    rest:freeze({id:'rest',name:'Rest and recovery',baseCost:0,minQuality:0,relief:1,annualRelief:1,health:3,success:.48,workPenalty:1}),
    basic:freeze({id:'basic',name:'Clinic treatment',baseCost:70,minQuality:.25,relief:1,annualRelief:1,health:5,success:.70,workPenalty:0}),
    specialist:freeze({id:'specialist',name:'Specialist treatment',baseCost:200,minQuality:.65,relief:2,annualRelief:1,health:9,success:.90,workPenalty:0}),
    unofficial:freeze({id:'unofficial',name:'Unofficial care',baseCost:35,minQuality:0,relief:1,annualRelief:0,health:3,success:.48,workPenalty:0,complicationRisk:.14})
  });
  const copy=x=>x?Object.assign({},x):null;
  root.ConditionRegistry=freeze({SCHEMA_VERSION:2,CONDITIONS,TREATMENTS,condition:id=>copy(CONDITIONS[id]),treatment:id=>copy(TREATMENTS[id]),allConditions:()=>Object.values(CONDITIONS).map(copy),allTreatments:()=>Object.values(TREATMENTS).map(copy),isConditionId:id=>!!CONDITIONS[id],isTreatmentId:id=>!!TREATMENTS[id]});
})(globalThis);
