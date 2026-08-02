'use strict';

const assert=require('node:assert/strict');
const {createGameContext,expose}=require('./helpers/vm-loader');

const context=createGameContext(['js/lore.js','js/data.js','js/state.js','js/medical.js']);

context.newWorld();
context.newLineage();
context.newHold();
context.newSubject();
expose(context,'globalThis.__S=S;globalThis.__World=World;');

assert.ok(context.__S.medical,'new subjects receive canonical medical state');
assert.strictEqual(context.__S.conditions,context.__S.medical.conditions,'legacy conditions remain a synchronized compatibility view');
assert.equal(context.activeConditions().length,0,'new subjects start without an active condition');

const injury=context.addCondition('injury',3,{source:'test injury'});
assert.equal(injury.state,'symptomatic');
assert.equal(injury.source,'test injury');
assert.strictEqual(context.addCondition('injury',4,{source:'worsened injury'}),injury,'duplicate conditions merge rather than duplicate');
assert.equal(injury.severity,4,'duplicate condition keeps the greater severity');

const exam=context.medicalExamination('doctor');
assert.equal(exam.found,true,'an examination discovers an existing unknown condition');
assert.equal(injury.known,true,'diagnosis marks the condition known');
assert.equal(injury.state,'diagnosed','diagnosis advances the lifecycle state');

const options=context.medicalTreatmentOptions('injury');
assert.ok(options.some(option=>option.id==='rest'),'rest is always a treatment option');
const treatment=context.treatCondition('injury','rest');
assert.equal(treatment.cost,0,'rest is free');
assert.ok(treatment.health>0,'treatment returns immediate recovery effect');
assert.ok(['treated','resolved'].includes(injury.state),'treatment advances the condition lifecycle');

const respiratory=context.medicalEventExposure({conditionId:'respiratory',source:'test outbreak',severity:3},context.__S);
assert.ok(respiratory,'forced medical event exposure creates a condition');
assert.equal(respiratory.source,'test outbreak');

context.medicalStartOutbreak('influenza',3,2);
assert.equal(context.__World.publicHealth.outbreak.id,'influenza','world outbreaks are stored on the existing World record');
assert.ok(context.medicalExposureRisk(context.__S,'respiratory',context.medicalContext(context.__S))>0,'an outbreak raises respiratory exposure risk');

const before=context.__S.health;
respiratory.state='symptomatic';
respiratory.known=false;
respiratory.severity=4;
context.runPersonalYearTick();
assert.ok(context.__S.health<=before,'untreated symptomatic conditions impose a yearly health burden');
assert.ok(context.medicalHoursPenalty(context.__S)>=1,'severe conditions reduce available yearly hours');

const mortality=context.medicalMortalityDetails(context.__S);
assert.ok(mortality.risk>0,'severe untreated conditions add medical mortality risk');
assert.ok(mortality.cause,'medical mortality supplies a condition-aware cause');

const legacy={age:40,health:60,healthCap:100,conditions:[{id:'strain',severity:2,known:true,treated:false,years:2,resolved:false}],medicalRecord:true};
context.ensureMedicalState(legacy);
assert.ok(legacy.medical,'legacy subjects migrate to canonical medical state');
assert.strictEqual(legacy.conditions,legacy.medical.conditions,'legacy migration preserves the old conditions array contract');
assert.equal(legacy.medical.conditions[0].state,'diagnosed','legacy known conditions migrate to diagnosed state');

console.log('medical scenarios: ok');
