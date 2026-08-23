'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {createWorldContext,loadGameFiles,expose}=require('./helpers/vm-loader');

function healthContext(seed){
  const context=createWorldContext();
  loadGameFiles(context,['js/medical.js']);
  expose(context,"Random.setSeed("+JSON.stringify(seed)+"); newWorld(); newLineage(); newHold(); newSubject();");
  return context;
}

function makePerson(context,profile){
  expose(context,`S.age=${profile.age||30}; World.year=S.dob+S.age; S.health=90; S.happiness=70;
    S.livingAtHome=false; S.assets=800; S.jobTier=${profile.jobTier!=null?profile.jobTier:1};
    S.jobName=${JSON.stringify(profile.jobName||'Clerk')}; S.career=null; S.eduStage=null; S.jailUntil=0;
    S.kids=0; S.married=false; S.contacts=[]; S.liabilities=[]; S.vice=${profile.vice||0};
    S.lifestyle={housing:${JSON.stringify(profile.housing||'flat')},food:${JSON.stringify(profile.food||'basic')},childcare:'basic'};
    S.location={settlementId:World.activeSettlementId}; ensureMedicalState(S);`);
}

test('sickness risk is dominated by living conditions, not fortune',()=>{
  const context=healthContext('sick-lifestyle');
  const riskFor=(profile,conditionId)=>{
    makePerson(context,profile);
    return expose(context,"MedicalSystem.exposureRisk(World,S,"+JSON.stringify(conditionId)+",medicalContext(S))");
  };
  const dampRoom=riskFor({housing:'room',food:'meager',jobName:'Factory Hand'},'respiratory');
  const comfortable=riskFor({housing:'house',food:'fine',jobName:'Clerk'},'respiratory');
  assert.ok(dampRoom>comfortable*2,'a cold room and a thin table must outweigh luck, '+dampRoom.toFixed(3)+' vs '+comfortable.toFixed(3));
  const laborer=riskFor({housing:'flat',food:'decent',jobName:'Foundry Worker'},'injury');
  const clerk=riskFor({housing:'flat',food:'decent',jobName:'Clerk'},'injury');
  assert.ok(laborer>clerk*2,'dangerous livelihoods carry the injury risk, '+laborer.toFixed(3)+' vs '+clerk.toFixed(3));
});

test('the sickness dial is exported and capped low',()=>{
  const context=healthContext('sick-tuning');
  const T=JSON.parse(expose(context,"JSON.stringify(MedicalSystem.SICKNESS_TUNING)"));
  assert.ok(T.globalScale<=0.5&&T.riskCap<=0.35,'sickness stays rare by construction');
  // Even the worst squalor never exceeds the cap.
  makePerson(context,{housing:'none',food:'meager',jobName:'Warehouse Hand'});
  const worst=['respiratory','infection','injury','strain','chronic'].map(id=>
    expose(context,"MedicalSystem.exposureRisk(World,S,'"+id+"',medicalContext(S))")).reduce((a,b)=>Math.max(a,b),0);
  assert.ok(worst<=T.riskCap,'worst-case exposure respects the cap, got '+worst.toFixed(3));
});

test('at most one new condition arrives per year, chosen from the body\'s actual circumstances',()=>{
  const context=healthContext('sick-single');
  makePerson(context,{housing:'none',food:'meager',jobName:'Factory Hand'});
  let gainedTotal=0;
  for(let i=0;i<40;i++){
    expose(context,"World.year+=1; S.age+=1;");
    expose(context,"S.medical.lastTickYear=null;"); // allow the year's progression under this probe
    const before=expose(context,"S.medical.conditions.length");
    expose(context,"runPersonalYearTick();");
    const after=expose(context,"S.medical.conditions.length");
    gainedTotal+=(after-before);
    assert.ok(after-before<=1,'never more than one new condition per year');
  }
  assert.ok(gainedTotal>0,'this profile should catch something across 40 years');
});
