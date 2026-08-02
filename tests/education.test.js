'use strict';

const assert=require('node:assert/strict');
const {createGameContext,expose}=require('./helpers/vm-loader');

const context=createGameContext(['js/lore.js','js/data.js','js/state.js','js/education.js']);
expose(context,'globalThis.__educationInstitutions=EDUCATION_INSTITUTIONS;globalThis.__schoolStages=SCHOOL_STAGES;globalThis.__careers=CAREERS;');

context.newWorld();
context.newLineage();
context.newSubject();
expose(context,'globalThis.__S=S;');

assert.ok(context.__educationInstitutions.length>0,'education catalog should be generated');
assert.equal(context.__S.education.stageId,null,'new subjects start without an active course');
assert.deepEqual(context.__S.eduCompleted,context.__S.education.completed,'legacy completion mirror should match canonical state');
assert.equal(context.educationStageAvailable(context.__schoolStages[0],context.__S),true,'lower school should be available');
assert.equal(context.educationStageAvailable(context.__schoolStages[1],context.__S),false,'middle school should wait for lower school');
assert.equal(context.educationStageAgeAvailable(context.__schoolStages[0],Object.assign({},context.__S,{age:6})),true,'lower school should open at age six');
assert.equal(context.educationStageAgeAvailable(context.__schoolStages[1],Object.assign({},context.__S,{age:11})),false,'middle school should not chain before age twelve');
assert.equal(context.educationStageAgeAvailable(context.__schoolStages[3],Object.assign({},context.__S,{age:14})),false,'university should not open before age eighteen');
assert.equal(Object.keys(context.__S.education.missedStages).length,0,'new subjects should have no missed school windows');
const missedSubject=Object.assign({},context.__S,{age:16,eduStage:null,eduYearsIn:0,eduCompleted:{},education:{completed:{},missedStages:{}}});
context.ensureEducationState(missedSubject);
assert.equal(context.educationStageWasMissed(context.__schoolStages[2],missedSubject),false,'an available school window should start unmarked');
assert.equal(context.educationMarkStageMissed(context.__schoolStages[2],missedSubject,'test'),true,'a missed school window should be recorded once');
assert.equal(context.educationStageWasMissed(context.__schoolStages[2],missedSubject),true,'a missed school window should remain marked');
assert.equal(context.educationMarkStageMissed(context.__schoolStages[2],missedSubject,'test'),false,'recording the same missed window twice should be a no-op');
assert.equal(missedSubject.education.history.filter(item=>item.kind==='missed').length,1,'missed school windows should create one education history record');
const migratedSubject=Object.assign({},context.__S,{age:17,education:{completed:{},lastOpportunityYear:{upper:16},missedStages:{},history:[]}});
context.ensureEducationState(migratedSubject);
assert.equal(context.educationMigratePassedOpportunity(context.__schoolStages[2],migratedSubject),true,'older records should migrate a passed school window silently');
assert.equal(context.educationStageWasMissed(context.__schoolStages[2],migratedSubject),true,'migrated school windows should remain marked');
assert.equal(context.educationMigratePassedOpportunity(context.__schoolStages[2],migratedSubject),false,'migrated school windows should not be recorded twice');
assert.equal(context.__schoolStages[0].startAge+context.__schoolStages[0].years-1,11,'lower school should occupy ages six through eleven');
assert.equal(context.__schoolStages[1].startAge+context.__schoolStages[1].years-1,14,'middle school should occupy ages twelve through fourteen');
assert.equal(context.__schoolStages[2].startAge+context.__schoolStages[2].years-1,17,'upper school should occupy ages fifteen through seventeen');
assert.equal(context.__schoolStages[3].startAge+context.__schoolStages[3].years-1,21,'university should occupy ages eighteen through twenty-one');

context.__S.age=18;
context.__S.education.completed={lower:true,middle:true,upper:true};
context.educationSyncLegacy(context.__S);
const university=context.institutionsForStage('university')[0];
const funds=context.educationFundingOptions(context.__schoolStages[3],university,false,false).map(item=>item.id);
assert.ok(funds.includes('studentloan'),'independent university applicants should see student loans');
assert.ok(funds.includes('self'),'independent university applicants should see self-funding');
context.__S.education.institutionId=university.id;
context.__S.education.funding='studentloan';
assert.equal(context.educationAnnualPayment(),university.tuition,'student loans should accrue the full yearly tuition');

context.__S.age=16;
context.__S.education.completed={lower:true,middle:true};
context.__S.education.certificates={};
context.__S.education.tuitionDebt=0;
context.__S.assets=50;
context.educationSyncLegacy(context.__S);
const careProgram=context.vocationalProgramById('care_certificate');
const programResult=context.educationCompleteProgram(careProgram.id);
assert.equal(programResult.ok,true,'eligible subjects should be able to complete a vocational course');
assert.equal(context.__S.education.certificates[careProgram.id].career,'care');
assert.equal(context.__S.education.tuitionDebt,0,'vocational shortfalls should be moved into the liability ledger');
assert.ok(context.__S.liabilities.some(item=>item.id==='trainingloan'&&item.annualPayment>0),'vocational shortfalls should create a repayment schedule');
delete context.__S.liabilities;
context.ensureEducationState(context.__S);
assert.ok(Array.isArray(context.__S.liabilities),'education migration should restore a missing liability ledger');

context.__S.education.stageId='lower';
context.__S.education.yearsIn=6;
context.__S.education.status='graduated';
context.__S.eduStage='lower';
context.__S.eduYearsIn=6;
context.__S.education.stageId=null;
context.educationSyncLegacy(context.__S);
assert.equal(context.__S.education.stageId,null,'graduation must not rehydrate a cleared legacy stage');
assert.equal(context.__S.eduStage,null,'graduation must clear the legacy active-stage mirror');

context.syncEduJobTitle=()=>{};
context.__S.age=12;
context.__S.education.completed={lower:true};
context.__S.education.stageId=null;
context.__S.education.status='graduated';
context.__S.eduStage=null;
context.__S.eduYearsIn=6;
context.educationEnroll(context.__schoolStages[1],context.institutionsForStage('middle','branec')[0],null,'scholarship');
assert.equal(context.__S.education.yearsIn,0,'a new school stage must start at year zero');
assert.equal(context.__S.eduYearsIn,0,'the legacy school-year mirror must reset for a new stage');
context.__S.education.stageId=null;
context.__S.education.status='graduated';
context.__S.education.completed={lower:true,middle:true};
context.__S.eduStage=null;
context.educationSyncLegacy(context.__S);

const medicine=context.__careers.find(track=>track.id==='medicine');
context.__S.age=16;
context.__S.skills.care=2;
assert.equal(context.educationCareerEducationRequirement(medicine,0),'middle','medicine entry should use its stage-specific education rule');
assert.equal(context.careerStageQualifies(medicine,0),true,'care-support medicine entry should not require university');

console.log('education scenarios: ok');
