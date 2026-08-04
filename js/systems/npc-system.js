'use strict';

(function(root){
  const SCHEMA_VERSION=1;
  const MAX_NPCS=96;
  const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
  const unit=value=>clamp(value,0,1);
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const integer=value=>Math.max(0,Math.round(finite(value,0)));

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('NpcSystem.ensure requires a world object');
    if(!world.npcs||typeof world.npcs!=='object'||Array.isArray(world.npcs)) world.npcs={};
    if(!Number.isFinite(Number(world.npcCounter))||Number(world.npcCounter)<0) world.npcCounter=0;
    if(!Array.isArray(world.npcNotices)) world.npcNotices=[];
    world.npcSchemaVersion=SCHEMA_VERSION;
    if(root.RelationshipMemory) root.RelationshipMemory.ensure(world);
    if(root.HouseholdSystem) root.HouseholdSystem.ensure(world);
    return world.npcs;
  }

  function sanitize(value){ return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'unknown'; }
  function nextId(world,prefix='npc'){
    ensure(world);
    world.npcCounter+=1;
    return prefix+':'+String(world.npcCounter).padStart(6,'0');
  }
  function legacyId(kind,value){ return 'npc:'+sanitize(kind)+':'+sanitize(value); }
  function splitName(name){
    const parts=String(name||'Unknown').trim().split(/\s+/).filter(Boolean);
    return {firstName:parts.shift()||'Unknown',lastName:parts.join(' ')||''};
  }
  function fullName(npc){ return [npc&&npc.firstName,npc&&npc.lastName].filter(Boolean).join(' ').trim()||'Unknown'; }
  function roleSet(values){ return [...new Set((Array.isArray(values)?values:[]).filter(Boolean).map(String))]; }
  function historyPush(npc,entry){
    if(!Array.isArray(npc.history)) npc.history=[];
    npc.history.push(Object.assign({year:0,type:'note',summary:''},entry||{}));
    if(npc.history.length>36) npc.history=npc.history.slice(-36);
  }

  function defaultPersonality(){ return {warmth:.5,ambition:.5,loyalty:.5,volatility:.3}; }
  function defaultEducation(){ return {level:'none',status:'none',years:0,quality:.5}; }
  function defaultEmployment(){ return {status:'unemployed',sector:null,careerId:null,income:0,lastChangeYear:null}; }
  function defaultHealth(){ return {general:70,medical:null,conditions:[],lastChangeYear:null}; }
  function defaultWealth(){ return {cash:0,debt:0}; }

  function normalize(npc,world){
    const out=npc&&typeof npc==='object'?npc:{};
    out.id=String(out.id||nextId(world));
    out.firstName=String(out.firstName||splitName(out.name).firstName||'Unknown');
    out.lastName=String(out.lastName||splitName(out.name).lastName||'');
    out.name=fullName(out);
    out.sex=out.sex==='M'?'M':out.sex==='F'?'F':'X';
    out.birthYear=Number.isFinite(Number(out.birthYear))?Math.round(Number(out.birthYear)):Number(world.year)||0;
    out.alive=out.alive!==false;
    out.deathYear=out.deathYear==null?null:Math.round(finite(out.deathYear,Number(world.year)||0));
    out.deathCause=out.deathCause==null?null:String(out.deathCause);
    out.locationId=String(out.locationId||world.activeSettlementId||'branec');
    out.householdId=out.householdId==null?null:String(out.householdId);
    out.partnerId=out.partnerId==null?null:String(out.partnerId);
    out.roleTags=roleSet(out.roleTags);
    out.notable=out.notable!==false;
    out.isSubject=!!out.isSubject;
    out.source=String(out.source||'generated');
    out.personality=Object.assign(defaultPersonality(),out.personality||{});
    Object.keys(out.personality).forEach(key=>{out.personality[key]=unit(out.personality[key]);});
    out.education=Object.assign(defaultEducation(),out.education||{});
    out.education.level=String(out.education.level||'none');
    out.education.status=String(out.education.status||'none');
    out.education.years=integer(out.education.years);
    out.education.quality=unit(out.education.quality==null?.5:out.education.quality);
    out.employment=Object.assign(defaultEmployment(),out.employment||{});
    out.employment.status=String(out.employment.status||'unemployed');
    out.employment.sector=out.employment.sector==null?null:String(out.employment.sector);
    out.employment.careerId=out.employment.careerId==null?null:String(out.employment.careerId);
    out.employment.income=Math.max(0,Math.round(finite(out.employment.income,0)));
    out.health=Object.assign(defaultHealth(),out.health||{});
    out.health.general=clamp(out.health.general,0,100);
    out.health.conditions=Array.isArray(out.health.conditions)?out.health.conditions:[];
    if(root.MedicalSystem){ root.MedicalSystem.ensureMedicalState(out,{world,year:world.year}); out.health.conditions=out.health.medical.conditions; }
    out.wealth=Object.assign(defaultWealth(),out.wealth||{});
    out.wealth.cash=Math.round(finite(out.wealth.cash,0));
    out.wealth.debt=Math.max(0,Math.round(finite(out.wealth.debt,0)));
    out.relationships=out.relationships&&typeof out.relationships==='object'&&!Array.isArray(out.relationships)?out.relationships:{};
    Object.keys(out.relationships).forEach(id=>{
      const rel=out.relationships[id]&&typeof out.relationships[id]==='object'?out.relationships[id]:{};
      out.relationships[id]={closeness:clamp(rel.closeness==null?50:rel.closeness),trust:clamp(rel.trust==null?50:rel.trust),conflict:clamp(rel.conflict==null?10:rel.conflict),lastYear:rel.lastYear==null?null:(Number.isFinite(Number(rel.lastYear))?Math.round(Number(rel.lastYear)):null)};
    });
    out.flags=out.flags&&typeof out.flags==='object'?out.flags:{};
    out.history=Array.isArray(out.history)?out.history:[];
    return out;
  }

  function upsert(world,input){
    const npcs=ensure(world), normalized=normalize(input,world), existing=npcs[normalized.id];
    const merged=existing?Object.assign(existing,normalized):normalized;
    if(existing&&existing.alive===false){
      merged.alive=false;
      merged.deathYear=existing.deathYear||merged.deathYear;
      merged.deathCause=existing.deathCause||merged.deathCause;
      merged.employment=Object.assign({},merged.employment,{status:'deceased',income:0});
    }
    npcs[normalized.id]=normalize(merged,world);
    trim(world);
    return npcs[normalized.id];
  }

  function trim(world){
    const npcs=ensure(world), values=Object.values(npcs);
    if(values.length<=MAX_NPCS) return;
    values.filter(npc=>npc.alive===false&&!npc.isSubject)
      .sort((a,b)=>Number(a.deathYear||0)-Number(b.deathYear||0)||String(a.id).localeCompare(String(b.id)))
      .slice(0,values.length-MAX_NPCS)
      .forEach(npc=>{delete npcs[npc.id];});
  }

  function preservedHealth(world,id,general){
    const existing=world&&world.npcs&&world.npcs[id];
    if(existing&&existing.health&&typeof existing.health==='object') return Object.assign({},existing.health,{general});
    return {general,conditions:[]};
  }

  function relationship(npc,otherId,defaults){
    const id=String(otherId||'');
    if(!id) return null;
    if(!npc.relationships||typeof npc.relationships!=='object') npc.relationships={};
    const prior=npc.relationships[id]||{};
    npc.relationships[id]={
      closeness:clamp(prior.closeness==null?(defaults&&defaults.closeness==null?50:defaults&&defaults.closeness):prior.closeness),
      trust:clamp(prior.trust==null?(defaults&&defaults.trust==null?50:defaults&&defaults.trust):prior.trust),
      conflict:clamp(prior.conflict==null?(defaults&&defaults.conflict==null?10:defaults&&defaults.conflict):prior.conflict),
      lastYear:prior.lastYear==null?null:Math.round(finite(prior.lastYear,0))
    };
    return npc.relationships[id];
  }

  function stream(world,year,id,subsystem){ return root.Random.create([world.seed,year,id,subsystem].join('|')); }

  function detachPartner(world,npc){
    if(!npc) return;
    const partner=world&&world.npcs&&npc.partnerId&&world.npcs[npc.partnerId];
    npc.partnerId=null;
    if(partner&&partner.partnerId===npc.id) partner.partnerId=null;
  }

  function repairPartnerLinks(world){
    const npcs=world&&world.npcs||{};
    Object.values(npcs).forEach(npc=>{
      if(!npc) return;
      if(npc.alive===false){ detachPartner(world,npc); return; }
      if(!npc.partnerId) return;
      const partner=npcs[npc.partnerId];
      if(!partner||partner.alive===false||partner.id===npc.id){ npc.partnerId=null; return; }
      if(!partner.partnerId) partner.partnerId=npc.id;
      else if(partner.partnerId!==npc.id) npc.partnerId=null;
    });
  }

  function subjectRecord(world,subject){
    if(!subject) return null;
    const id=String(subject.npcId||legacyId('subject',subject.id||[subject.first,subject.last,subject.dob].join('-')));
    subject.npcId=id;
    Object.values(ensure(world)).forEach(npc=>{if(npc.isSubject&&npc.id!==id) npc.isSubject=false;});
    const record=upsert(world,{
      id,
      firstName:subject.first,
      lastName:subject.last,
      sex:subject.sex,
      birthYear:subject.dob,
      alive:subject.alive!==false,
      deathYear:subject.alive===false?Number(world.year)||subject.dob+subject.age:null,
      deathCause:subject.alive===false?subject.cause:null,
      locationId:subject.location&&subject.location.settlementId||world.activeSettlementId,
      householdId:null,
      roleTags:['subject'],
      isSubject:true,
      notable:true,
      source:'subject',
      health:{general:subject.health,conditions:[],lastChangeYear:Number(world.year)||null},
      wealth:{cash:subject.assets||0,debt:Math.max(0,-(subject.assets||0))},
      flags:{fileId:subject.id}
    });
    world.activeSubjectNpcId=id;
    return record;
  }

  function parentBirthYear(world,subject,relation){
    const rng=stream(world,subject.dob,subject.id||subject.npcId,relation+'-birth');
    return subject.dob-rng.int(19,39);
  }

  function registerParent(world,subject,parent,relation){
    if(!subject||!parent) return null;
    const id=String(parent.npcId||legacyId(relation,(subject.id||subject.npcId)+'-'+parent.name));
    parent.npcId=id;
    const names=splitName(parent.name), subjectId=subject.npcId;
    const npc=upsert(world,{
      id,
      firstName:names.firstName,
      lastName:names.lastName,
      sex:relation==='mother'?'F':'M',
      birthYear:Number.isFinite(Number(parent.birthYear))?parent.birthYear:parentBirthYear(world,subject,relation),
      alive:parent.alive!==false,
      deathYear:parent.alive===false?(parent.deathYear||Number(world.year)||subject.dob):null,
      locationId:parent.locationId||subject.location&&subject.location.settlementId||world.activeSettlementId,
      roleTags:[relation,'parent','family'],
      notable:true,
      source:'legacy-parent',
      personality:{warmth:finite(parent.warmth,50)/100,ambition:finite(parent.grip,50)/100,loyalty:finite(parent.stability,50)/100,volatility:1-finite(parent.stability,50)/100},
      health:preservedHealth(world,id,parent.alive===false?0:clamp(finite(parent.health,72))),
      employment:{status:parent.alive===false?'deceased':'employed',sector:parent.skill||null,income:parent.alive===false?0:650},
      flags:{present:parent.present!==false,estranged:!!parent.estranged,legacyRelation:relation}
    });
    const rel=relationship(npc,subjectId,{closeness:finite(parent.mood,60),trust:(finite(parent.warmth,50)+finite(parent.stability,50))/2,conflict:Math.max(0,finite(parent.grip,50)-55)});
    rel.closeness=clamp(parent.present===false?Math.min(rel.closeness,25):finite(parent.mood,rel.closeness));
    rel.trust=clamp((finite(parent.warmth,50)+finite(parent.stability,50))/2);
    rel.conflict=clamp(Math.max(0,finite(parent.grip,50)-55));
    return npc;
  }

  function registerKin(world,subject,kin){
    if(!kin) return null;
    const id=String(kin.npcId||legacyId('kin',kin.mid||[kin.first,kin.last,kin.dob].join('-')));
    kin.npcId=id;
    const npc=upsert(world,{
      id,
      firstName:kin.first,
      lastName:kin.last,
      sex:kin.sex,
      birthYear:kin.dob,
      alive:kin.alive!==false,
      deathYear:kin.alive===false?(kin.deathYear||Number(world.year)||0):null,
      locationId:kin.locationId||world.activeSettlementId,
      roleTags:[kin.relation||'relative','family'],
      notable:true,
      source:'legacy-kin',
      health:preservedHealth(world,id,kin.alive===false?0:finite(kin.health,72)),
      employment:{status:kin.alive===false?'deceased':'unemployed',sector:null,income:0},
      flags:{legacyMid:kin.mid||null,motherName:kin.motherName||null,fatherName:kin.fatherName||null,parentSubjectId:kin.relation==='child'&&subject?subject.npcId:null,allowAutonomousFamily:true}
    });
    if(subject){
      const rel=relationship(npc,subject.npcId,{closeness:finite(kin.bond,60),trust:finite(kin.bond,60),conflict:Math.max(0,50-finite(kin.bond,60))});
      rel.closeness=clamp(finite(kin.bond,rel.closeness));
      rel.trust=clamp(finite(kin.bond,rel.trust));
    }
    return npc;
  }

  function registerContactSpouse(world,subject,contact,npc){
    if(!contact||!contact.npcMarried||!contact.npcSpouseName||contact.role==='partner'||contact.role==='spouse') return null;
    const id=String(contact.npcSpouseId||legacyId('contact-spouse',(contact.cid||npc.id)+'-'+contact.npcSpouseName));
    contact.npcSpouseId=id;
    const names=splitName(contact.npcSpouseName), rng=stream(world,world.year,id,'identity');
    const spouse=upsert(world,{
      id,
      firstName:names.firstName,
      lastName:names.lastName,
      sex:contact.sex==='M'?'F':'M',
      birthYear:npc.birthYear+rng.int(-4,4),
      alive:true,
      locationId:npc.locationId,
      roleTags:['contact-spouse'],
      notable:true,
      source:'legacy-contact-spouse',
      personality:{warmth:.5,ambition:.5,loyalty:unit(finite(contact.fidelity,50)/100),volatility:unit(finite(contact.npcSpouseTemperament,50)/100)},
      health:preservedHealth(world,id,(world.npcs&&world.npcs[id]&&world.npcs[id].health&&world.npcs[id].health.general)!=null?world.npcs[id].health.general:74),
      flags:{allowAutonomousFamily:true}
    });
    npc.partnerId=spouse.id;
    spouse.partnerId=npc.id;
    relationship(npc,spouse.id,{closeness:62,trust:finite(contact.fidelity,55),conflict:finite(contact.npcSpouseTemperament,40)*.25});
    relationship(spouse,npc.id,{closeness:62,trust:55,conflict:finite(contact.npcSpouseTemperament,40)*.25});
    return spouse;
  }

  function registerContact(world,subject,contact){
    if(!contact) return null;
    const id=String(contact.npcId||legacyId('contact',contact.cid||contact.name));
    contact.npcId=id;
    const names=splitName(contact.name), current=Number(world.year)||subject&&subject.dob+subject.age||0;
    const rng=stream(world,current,id,'identity');
    const existing=world.npcs&&world.npcs[id];
    const npc=upsert(world,{
      id,
      firstName:names.firstName,
      lastName:names.lastName,
      sex:contact.sex,
      birthYear:Number.isFinite(Number(contact.birthYear))?contact.birthYear:current-Math.max(16,(subject&&subject.age||25)+rng.int(-4,4)),
      alive:contact.alive!==false,
      deathYear:contact.alive===false?(contact.deathYear||current):null,
      locationId:contact.locationId||world.activeSettlementId,
      roleTags:[contact.role||'friend','associate'],
      notable:true,
      source:'legacy-contact',
      personality:{warmth:finite(contact.kindness,50)/100,ambition:finite(contact.charm,50)/100,loyalty:finite(contact.fidelity,50)/100,volatility:finite(contact.temperament,50)/100},
      health:preservedHealth(world,id,contact.alive===false?0:finite(contact.health,74)),
      employment:{status:contact.alive===false?'deceased':'unemployed',sector:null,income:0},
      householdId:existing&&existing.householdId||null,
      partnerId:existing&&existing.partnerId||null,
      flags:{legacyCid:contact.cid||null,allowAutonomousFamily:true,npcMarried:!!contact.npcMarried}
    });
    npc.roleTags=roleSet([contact.role||'friend','associate']);
    if(subject){
      const subjectNpc=world.npcs[subject.npcId];
      const rel=relationship(npc,subject.npcId,{closeness:finite(contact.mood,60),trust:finite(contact.fidelity,50),conflict:Math.max(0,50-finite(contact.mood,60))});
      rel.closeness=clamp(finite(contact.mood,rel.closeness));
      rel.trust=clamp(finite(contact.fidelity,rel.trust));
      rel.conflict=clamp(Math.max(0,50-finite(contact.mood,60)));
      if((contact.role==='partner'||contact.role==='spouse')&&npc.alive!==false&&subjectNpc&&subjectNpc.alive!==false){
        if(npc.partnerId&&npc.partnerId!==subject.npcId&&world.npcs[npc.partnerId]) world.npcs[npc.partnerId].partnerId=null;
        npc.partnerId=subject.npcId;
        const subjectNpc=world.npcs[subject.npcId];
        if(subjectNpc) subjectNpc.partnerId=npc.id;
      } else if(npc.alive===false) detachPartner(world,npc);
    }
    registerContactSpouse(world,subject,contact,npc);
    return npc;
  }

  function openingReset(world){
    world.npcs={};
    world.npcCounter=0;
    world.npcNotices=[];
    world.activeSubjectNpcId=null;
    world.npcLastTickYear=null;
    world.households={};
    world.householdCounter=0;
    world.subjectBirthHouseholdId=null;
    world.relationshipMemories={};
    world.relationshipMemoryCounter=0;
    ensure(world);
  }

  function bootstrapSubject(world,subject,lineage,options){
    const opts=options||{};
    ensure(world);
    if(opts.openingReset) openingReset(world);
    const subjectNpc=subjectRecord(world,subject);
    const mother=registerParent(world,subject,subject.mother,'mother');
    const father=registerParent(world,subject,subject.father,'father');
    if(mother&&father&&mother.alive&&father.alive){ mother.partnerId=father.id; father.partnerId=mother.id; }
    if(root.HouseholdSystem){
      let birth=world.subjectBirthHouseholdId&&world.households[world.subjectBirthHouseholdId];
      if(!birth) birth=root.HouseholdSystem.create(world,{settlementId:subjectNpc.locationId,memberIds:[subjectNpc.id].concat([mother&&mother.id,father&&father.id].filter(Boolean)),dependentIds:[subjectNpc.id],origin:'birth-household',flags:{birthHousehold:true}});
      world.subjectBirthHouseholdId=birth.id;
      subjectNpc.householdId=birth.id;
      if(mother) mother.householdId=birth.id;
      if(father) father.householdId=birth.id;
    }
    if(lineage&&typeof lineage==='object') lineage.activeSubjectNpcId=subjectNpc.id;
    syncLegacy(world,subject,lineage,{skipSubjectHousehold:false});
    return subjectNpc;
  }

  function activePartnerNpc(world,subject){
    if(!subject||!Array.isArray(subject.contacts)) return null;
    const contact=subject.contacts.find(item=>item&&item.alive!==false&&(item.role==='partner'||item.role==='spouse'));
    const npc=contact?registerContact(world,subject,contact):null;
    return npc&&npc.alive!==false?npc:null;
  }

  function childNpcs(world,subject,lineage){
    if(!lineage||!Array.isArray(lineage.members)) return [];
    const full=[subject.first,subject.last].filter(Boolean).join(' ');
    return lineage.members.filter(member=>member&&member.relation==='child'&&(member.motherName===full||member.fatherName===full)).map(member=>registerKin(world,subject,member)).filter(Boolean);
  }

  function ensureSubjectHousehold(world,subject,lineage){
    if(!root.HouseholdSystem||!subject||!subject.npcId) return null;
    const subjectNpc=world.npcs[subject.npcId], birth=world.subjectBirthHouseholdId&&world.households[world.subjectBirthHouseholdId];
    const partner=activePartnerNpc(world,subject), children=childNpcs(world,subject,lineage);
    const dependent=subject.age<16||subject.livingAtHome;
    let target=null;
    if(dependent&&birth) target=birth;
    else {
      const current=root.HouseholdSystem.findByMember(world,subject.npcId);
      if(current&&current.id!==world.subjectBirthHouseholdId) target=current;
      if(!target) target=root.HouseholdSystem.create(world,{settlementId:subject.location&&subject.location.settlementId||world.activeSettlementId,memberIds:[subject.npcId],dependentIds:[],origin:'subject-household'});
    }
    root.HouseholdSystem.addMember(world,target.id,subject.npcId,dependent);
    if(partner&&(subject.married||subject.status==='Attached')) root.HouseholdSystem.addMember(world,target.id,partner.id,false);
    children.forEach(child=>root.HouseholdSystem.addMember(world,target.id,child.id,true));
    if(!partner){
      Object.values(world.npcs).filter(npc=>npc.partnerId===subject.npcId&&!npc.isSubject&&npc.alive!==false).forEach(npc=>{
        detachPartner(world,npc);
        root.HouseholdSystem.removeMember(world,target.id,npc.id);
        if(!root.HouseholdSystem.findByMember(world,npc.id)) root.HouseholdSystem.create(world,{settlementId:npc.locationId,memberIds:[npc.id],dependentIds:[],origin:'separation'});
      });
      if(subjectNpc) subjectNpc.partnerId=null;
    }
    if(subjectNpc){ subjectNpc.householdId=target.id; subjectNpc.locationId=target.settlementId; }
    root.HouseholdSystem.reconcile(world,subject);
    return target;
  }

  function syncLegacyToRegistry(world,subject,lineage){
    const subjectNpc=subjectRecord(world,subject);
    if(subject.mother) registerParent(world,subject,subject.mother,'mother');
    if(subject.father) registerParent(world,subject,subject.father,'father');
    if(lineage&&Array.isArray(lineage.members)) lineage.members.forEach(member=>registerKin(world,subject,member));
    if(Array.isArray(subject.contacts)) subject.contacts.forEach(contact=>registerContact(world,subject,contact));
    ensureSubjectHousehold(world,subject,lineage);
    return subjectNpc;
  }

  function syncRegistryToLegacy(world,subject,lineage){
    if(!subject) return;
    const subjectId=subject.npcId;
    ['mother','father'].forEach(relation=>{
      const legacy=subject[relation]; if(!legacy||!legacy.npcId) return;
      const npc=world.npcs[legacy.npcId]; if(!npc) return;
      const rel=npc.relationships&&npc.relationships[subjectId];
      legacy.alive=npc.alive;
      legacy.mood=clamp(rel?rel.closeness:legacy.mood);
      legacy.locationId=npc.locationId;
      legacy.health=npc.health.general;
      if(npc.alive===false) legacy.deathYear=npc.deathYear;
    });
    if(lineage&&Array.isArray(lineage.members)) lineage.members.forEach(member=>{
      const npc=member.npcId&&world.npcs[member.npcId]; if(!npc) return;
      const rel=npc.relationships&&npc.relationships[subjectId];
      member.alive=npc.alive;
      member.bond=clamp(rel?rel.closeness:member.bond);
      member.locationId=npc.locationId;
      member.health=npc.health.general;
      if(npc.alive===false) member.deathYear=npc.deathYear;
    });
    if(Array.isArray(subject.contacts)) subject.contacts.forEach(contact=>{
      const npc=contact.npcId&&world.npcs[contact.npcId]; if(!npc) return;
      const rel=npc.relationships&&npc.relationships[subjectId];
      contact.alive=npc.alive;
      contact.mood=clamp(rel?rel.closeness:contact.mood);
      contact.locationId=npc.locationId;
      contact.health=npc.health.general;
      if(npc.alive===false){
        contact.deathYear=npc.deathYear;
        if(contact.role==='partner'||contact.role==='spouse'){
          contact.role='ex';
          if(subject.partner===contact.name||subject.married){ subject.married=false;subject.status='Widowed';subject.partner=null;subject.partnerMood=0; }
        }
      }
    });
    const active=world.npcs[subjectId];
    if(active){active.health.general=clamp(subject.health);active.wealth.cash=Math.round(finite(subject.assets,0));active.locationId=subject.location&&subject.location.settlementId||world.activeSettlementId;active.alive=subject.alive!==false;}
  }

  function migrate(world,subject,lineage){
    ensure(world);
    Object.keys(world.npcs).forEach(id=>{
      const npc=normalize(world.npcs[id],world);
      if(npc.id!==id){delete world.npcs[id];world.npcs[npc.id]=npc;} else world.npcs[id]=npc;
    });
    const deceasedSnapshots=Object.values(world.npcs).filter(npc=>npc&&npc.alive===false).map(npc=>({id:npc.id,snapshot:JSON.stringify(npc)}));
    if(subject) syncLegacyToRegistry(world,subject,lineage);
    deceasedSnapshots.forEach(item=>{if(world.npcs[item.id]) Object.assign(world.npcs[item.id],JSON.parse(item.snapshot));});
    repairPartnerLinks(world);
    if(root.HouseholdSystem) root.HouseholdSystem.reconcile(world,subject||null);
    world.npcSchemaVersion=SCHEMA_VERSION;
    return world.npcs;
  }

  function settlementState(world,npc){ return world&&world.settlements&&world.settlements[npc.locationId]||null; }
  function healthPressure(runtime){ return root.PublicHealth&&typeof root.PublicHealth.pressure==='function'?root.PublicHealth.pressure(runtime):0; }

  function educationRank(level){ return {none:0,primary:1,secondary:2,vocational:3,university:4}[level]||0; }
  function educationTick(npc,age,runtime,rng,year){
    if(age<6){npc.education.status='too-young';return;}
    const pressure=runtime&&runtime.education?unit(runtime.education.capacityPressure):.5;
    let target='none';
    if(age>=6) target='primary';
    if(age>=12) target='secondary';
    if(age>=18&&npc.personality.ambition>.62&&pressure<.82) target=rng.chance(.32+(1-pressure)*.3)?'university':'vocational';
    if(age>=23&&educationRank(npc.education.level)>=educationRank(target)){npc.education.status='completed';return;}
    if(educationRank(target)>educationRank(npc.education.level)){
      const access=unit(.9-pressure*.55);
      if(rng.chance(access)){
        npc.education.level=target;
        npc.education.status='enrolled';
        npc.education.years+=1;
        npc.education.quality=unit((npc.education.quality*.7)+(1-pressure*.45)*.3);
        npc.education.lastChangeYear=year;
      } else npc.education.status='waiting';
    } else if(npc.education.status==='enrolled') npc.education.years+=1;
  }

  function chooseSector(runtime,rng){
    const demand=runtime&&runtime.economy&&runtime.economy.industryDemand||{};
    const entries=[['agriculture',finite(demand.agriculture,.33)],['manufacturing',finite(demand.manufacturing,.33)],['services',finite(demand.services,.34)]];
    const total=entries.reduce((sum,item)=>sum+Math.max(.01,item[1]),0), roll=rng.range(0,total);
    let cursor=0;
    for(const item of entries){cursor+=Math.max(.01,item[1]);if(roll<=cursor)return item[0];}
    return 'services';
  }

  function employmentTick(npc,age,runtime,rng,year,notices){
    const economy=runtime&&runtime.economy||{}, employmentIndex=unit(finite(economy.employmentIndex,.5));
    if(age<16){npc.employment={status:'dependent',sector:null,careerId:null,income:0,lastChangeYear:npc.employment.lastChangeYear};return;}
    if(age>=67){
      if(npc.employment.status!=='retired') notices.push({type:'retirement',npcId:npc.id,name:fullName(npc)});
      npc.employment.status='retired';npc.employment.income=Math.round(npc.employment.income*.35);npc.employment.lastChangeYear=year;return;
    }
    const employed=npc.employment.status==='employed';
    if(employed&&rng.chance(clamp(.035+(1-employmentIndex)*.16+(npc.health.general<35?.08:0),0,.28))){
      npc.employment.status='unemployed';npc.employment.income=0;npc.employment.lastChangeYear=year;
      notices.push({type:'job_loss',npcId:npc.id,name:fullName(npc)});
    } else if(!employed&&rng.chance(clamp(.12+employmentIndex*.62+npc.personality.ambition*.08,0,.88))){
      npc.employment.status='employed';npc.employment.sector=chooseSector(runtime,rng);npc.employment.lastChangeYear=year;
      notices.push({type:'employment',npcId:npc.id,name:fullName(npc),sector:npc.employment.sector});
    }
    if(npc.employment.status==='employed'){
      const wageIndex=finite(economy.wageIndex,1), educationMultiplier=1+educationRank(npc.education.level)*.12;
      const experience=1+Math.min(.4,Math.max(0,age-18)*.008);
      npc.employment.income=Math.max(180,Math.round((460+npc.personality.ambition*220)*wageIndex*educationMultiplier*experience));
    }
  }

  function healthTick(npc,age,runtime,rng,year){
    const health=runtime&&runtime.publicHealth||{}, pressure=healthPressure(runtime), sanitation=unit(finite(health.sanitation,.5));
    const ageLoss=age<45?0:age<60?.45:age<75?1.1:age<90?2.2:4;
    const recovery=(sanitation-.5)*1.4+(1-pressure)*.35;
    const drift=recovery-ageLoss-pressure*1.8+rng.range(-1.2,1.2);
    npc.health.general=clamp(npc.health.general+drift,0,100);
    npc.health.lastChangeYear=year;
  }

  function medicalContextFor(world,npc,runtime,year){
    if(!root.MedicalSystem) return null;
    return root.MedicalSystem.contextFor(world,npc,{year,runtime,healthcarePressure:healthPressure(runtime)});
  }

  function applyMedicalTick(world,npc,runtime,year){
    if(!root.MedicalSystem) return null;
    const ctx=medicalContextFor(world,npc,runtime,year);
    const result=root.MedicalSystem.tickPerson(world,npc,ctx);
    if(result.applied&&result.healthDelta){
      npc.health.general=clamp(npc.health.general+result.healthDelta,0,100);
      npc.health.lastChangeYear=year;
    }
    return result;
  }

  const RELEVANT_ROLE_TAGS=new Set(['mother','father','parent','spouse','partner','child','sibling','relative','friend']);

  function isRelevantToSubject(world,npc,subject,lineage){
    if(!subject||!subject.npcId||!npc) return false;
    const subjectNpc=world.npcs&&world.npcs[subject.npcId];
    if(subjectNpc&&npc.householdId&&subjectNpc.householdId&&npc.householdId===subjectNpc.householdId) return true;
    if(npc.relationships&&npc.relationships[subject.npcId]) return true;
    if(subjectNpc&&subjectNpc.relationships&&subjectNpc.relationships[npc.id]) return true;
    if(Array.isArray(npc.roleTags)&&npc.roleTags.some(tag=>RELEVANT_ROLE_TAGS.has(tag))) return true;
    if(subject.mother&&subject.mother.npcId===npc.id) return true;
    if(subject.father&&subject.father.npcId===npc.id) return true;
    if(Array.isArray(subject.contacts)&&subject.contacts.some(contact=>contact&&contact.npcId===npc.id)) return true;
    if(lineage&&Array.isArray(lineage.members)&&lineage.members.some(member=>member&&member.npcId===npc.id)) return true;
    return false;
  }

  function conditionName(definitionId){
    const info=root.ConditionRegistry&&root.ConditionRegistry.condition(definitionId);
    return (info?info.name:'Unrecognized condition').toLowerCase();
  }

  function findCondition(npc,instanceId){
    const conditions=npc.health&&npc.health.medical&&Array.isArray(npc.health.medical.conditions)?npc.health.medical.conditions:[];
    return conditions.find(condition=>condition.instanceId===instanceId)||null;
  }

  function emitMedicalNotices(npc,relevant,year,result,notices,seenKeys){
    if(!relevant||!result||!result.applied) return;
    const name=fullName(npc);
    const emit=(type,instanceId,text)=>{
      const key=npc.id+'|'+instanceId+'|'+type+'|'+year;
      if(seenKeys.has(key)) return;
      seenKeys.add(key);
      notices.push({type,npcId:npc.id,name,conditionInstanceId:instanceId,text});
      historyPush(npc,{year,type,summary:text});
    };
    (result.newConditions||[]).filter(condition=>condition.state!=='latent').forEach(condition=>{
      emit('medical_condition',condition.instanceId,name+' developed '+conditionName(condition.definitionId)+'.');
    });
    (result.transitions||[]).forEach(transition=>{
      if(transition.kind==='symptom'){
        const condition=findCondition(npc,transition.instanceId);
        emit('medical_symptom',transition.instanceId,name+' began showing symptoms of '+conditionName(condition&&condition.definitionId)+'.');
      } else if(transition.kind==='chronic'){
        emit('medical_chronic',transition.instanceId,name+' now has a chronic condition on file.');
      } else if(transition.kind==='resolved'){
        const condition=findCondition(npc,transition.instanceId);
        emit('medical_recovery',transition.instanceId,name+' recovered from '+conditionName(condition&&condition.definitionId)+'.');
      }
    });
  }

  function mortalityProbability(npc,age,runtime){
    let base=age<1?.012:age<16?.0008:age<45?.0015:age<60?.005:age<70?.016:age<80?.045:age<90?.11:.24;
    base+=(100-npc.health.general)/100*.08+healthPressure(runtime)*.035;
    return unit(base);
  }

  function personalExpenses(runtime,age){
    const economy=runtime&&runtime.economy||{};
    return Math.round((age<16?160:360)*finite(economy.foodPriceIndex,1)+(age>=18?210*finite(economy.rentIndex,1):0));
  }

  function relationshipTick(world,npc,year){
    Object.keys(npc.relationships||{}).sort().forEach(otherId=>{
      const rel=npc.relationships[otherId], memory=root.RelationshipMemory?root.RelationshipMemory.modifier(world,npc.id,otherId,year):{closeness:0,trust:0,conflict:0};
      const baseline=45+npc.personality.warmth*25-npc.personality.volatility*8;
      rel.closeness=clamp(rel.closeness*.92+baseline*.08+memory.closeness*.025);
      rel.trust=clamp(rel.trust*.94+(40+npc.personality.loyalty*35)*.06+memory.trust*.025);
      rel.conflict=clamp(rel.conflict*.9+(npc.personality.volatility*30)*.1+memory.conflict*.025);
      rel.lastYear=year;
    });
  }

  function markDeath(world,npc,year,cause,notices){
    if(!npc||npc.alive===false) return false;
    npc.alive=false;npc.deathYear=year;npc.deathCause=cause||'natural causes';npc.health.general=0;
    npc.employment.status='deceased';npc.employment.income=0;
    historyPush(npc,{year,type:'death',summary:'Died: '+npc.deathCause+'.'});
    detachPartner(world,npc);
    notices.push({type:'death',npcId:npc.id,name:fullName(npc),cause:npc.deathCause});
    return true;
  }

  function nameFromPool(pool,rng,fallback){ return Array.isArray(pool)&&pool.length?String(pool[rng.int(0,pool.length-1)]):fallback; }

  function createAutonomousChild(world,mother,father,year,household,notices){
    if(Object.keys(world.npcs).length>=MAX_NPCS) return null;
    const rng=stream(world,year,household.id,'autonomous-child');
    const sex=rng.chance(.5)?'M':'F', first=nameFromPool(sex==='M'?root.MALE:root.FEMALE,rng,sex==='M'?'Alex':'Mira');
    const lastName=(father&&father.lastName)||(mother&&mother.lastName)||'Unknown';
    const child=upsert(world,{id:nextId(world,'npc-child'),firstName:first,lastName,sex,birthYear:year,alive:true,locationId:household.settlementId,householdId:household.id,roleTags:['child','family'],source:'autonomous-birth',health:{general:rng.int(65,90),conditions:[]},flags:{motherId:mother&&mother.id,fatherId:father&&father.id,allowAutonomousFamily:true}});
    root.HouseholdSystem.addMember(world,household.id,child.id,true);
    [mother,father].filter(Boolean).forEach(parent=>{
      relationship(parent,child.id,{closeness:78,trust:75,conflict:5});
      relationship(child,parent.id,{closeness:82,trust:80,conflict:3});
    });
    if(root.RelationshipMemory) root.RelationshipMemory.add(world,{year,type:'birth',participants:[mother&&mother.id,father&&father.id,child.id].filter(Boolean),intensity:1,valence:.9,decay:.006,summary:fullName(child)+' was born.'});
    notices.push({type:'birth',npcId:child.id,name:fullName(child),householdId:household.id});
    return child;
  }

  function autonomousFamilyTransitions(world,year,notices){
    if(!root.HouseholdSystem) return;
    const npcs=Object.values(world.npcs).filter(npc=>npc.alive&&!npc.isSubject&&npc.flags&&npc.flags.allowAutonomousFamily);
    const singles=npcs.filter(npc=>!npc.partnerId&&(year-npc.birthYear)>=20&&(year-npc.birthYear)<=55).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const paired=new Set();
    for(const npc of singles){
      if(paired.has(npc.id)||npc.partnerId) continue;
      const candidate=singles.find(other=>other.id!==npc.id&&!paired.has(other.id)&&!other.partnerId&&other.locationId===npc.locationId&&other.sex!==npc.sex);
      if(!candidate) continue;
      const rng=stream(world,year,npc.id+'|'+candidate.id,'autonomous-marriage');
      if(!rng.chance(.018)) continue;
      npc.partnerId=candidate.id;candidate.partnerId=npc.id;paired.add(npc.id);paired.add(candidate.id);
      relationship(npc,candidate.id,{closeness:68,trust:65,conflict:8});relationship(candidate,npc.id,{closeness:68,trust:65,conflict:8});
      const a=root.HouseholdSystem.findByMember(world,npc.id), b=root.HouseholdSystem.findByMember(world,candidate.id);
      const household=a&&b?root.HouseholdSystem.merge(world,a.id,b.id):(a||b||root.HouseholdSystem.create(world,{settlementId:npc.locationId,memberIds:[npc.id,candidate.id],origin:'autonomous-marriage'}));
      root.HouseholdSystem.addMember(world,household.id,npc.id,false);root.HouseholdSystem.addMember(world,household.id,candidate.id,false);
      if(root.RelationshipMemory) root.RelationshipMemory.add(world,{year,type:'marriage',participants:[npc.id,candidate.id],intensity:.9,valence:.8,decay:.008,summary:fullName(npc)+' and '+fullName(candidate)+' formed a household.'});
      notices.push({type:'marriage',npcId:npc.id,otherId:candidate.id,name:fullName(npc),otherName:fullName(candidate)});
    }

    Object.values(world.npcs).filter(npc=>npc.alive&&npc.partnerId&&npc.sex==='F').sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(mother=>{
      const age=year-mother.birthYear, father=world.npcs[mother.partnerId];
      if(age<20||age>42||!father||!father.alive) return;
      const household=root.HouseholdSystem.findByMember(world,mother.id); if(!household) return;
      const children=household.memberIds.map(id=>world.npcs[id]).filter(npc=>npc&&npc.roleTags.includes('child')&&npc.flags&&(npc.flags.motherId===mother.id||npc.flags.fatherId===father.id));
      if(children.length>=3||Object.keys(world.npcs).length>=MAX_NPCS) return;
      const rng=stream(world,year,household.id,'autonomous-birth');
      if(rng.chance(.045)) createAutonomousChild(world,mother,father,year,household,notices);
    });
  }

  function tick(world,context){
    const ctx=context||{}, subject=ctx.subject||null, lineage=ctx.lineage||null, year=Number(ctx.year)||Number(world.year)||0;
    migrate(world,subject,lineage);
    if(world.npcLastTickYear===year){syncRegistryToLegacy(world,subject,lineage);return world.npcs;}
    const notices=[], medicalNoticeKeys=new Set();
    Object.values(world.npcs).sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(npc=>{
      if(!npc||npc.isSubject||npc.alive===false) return;
      const age=Math.max(0,year-npc.birthYear), runtime=settlementState(world,npc), rng=stream(world,year,npc.id,'annual');
      healthTick(npc,age,runtime,rng,year);
      const medicalResult=applyMedicalTick(world,npc,runtime,year);
      if(medicalResult) emitMedicalNotices(npc,isRelevantToSubject(world,npc,subject,lineage),year,medicalResult,notices,medicalNoticeKeys);
      educationTick(npc,age,runtime,rng,year);
      employmentTick(npc,age,runtime,rng,year,notices);
      const expenses=personalExpenses(runtime,age), balance=npc.employment.income-expenses;
      const household=root.HouseholdSystem&&root.HouseholdSystem.findByMember?root.HouseholdSystem.findByMember(world,npc.id):null;
      const contributesThroughHousehold=!!(household&&household.memberIds.includes(npc.id));
      const beforeNet=finite(npc.wealth.cash,0)-finite(npc.wealth.debt,0);
      npc.__householdContributionYear=year;
      npc.__householdContribution=contributesThroughHousehold?Math.max(0,Math.round(balance)):0;
      npc.__householdPersonalExpensesYear=year;
      npc.__householdPersonalExpenses=contributesThroughHousehold?Math.round(expenses):0;
      if(balance>=0) { if(!contributesThroughHousehold) npc.wealth.cash+=balance; } else {
        const paid=Math.min(Math.max(0,npc.wealth.cash),Math.abs(balance));
        npc.wealth.cash-=paid;npc.wealth.debt+=Math.abs(balance)-paid;
      }
      npc.wealth.cash=Math.round(finite(npc.wealth.cash,0));npc.wealth.debt=Math.max(0,Math.round(finite(npc.wealth.debt,0)));
      const afterNet=npc.wealth.cash-npc.wealth.debt;
      npc.__householdPersonalWealthChangeYear=year;
      npc.__householdPersonalWealthChange=contributesThroughHousehold?Math.round(afterNet-beforeNet):0;
      relationshipTick(world,npc,year);
      let medicalDied=false;
      if(root.MedicalSystem){
        const mortalityCtx=medicalContextFor(world,npc,runtime,year);
        const mortalityRoll=root.MedicalSystem.rollMortality(world,npc,mortalityCtx);
        if(mortalityRoll.died){
          medicalDied=true;
          markDeath(world,npc,year,mortalityRoll.cause||'complications from a long illness',notices);
        }
      }
      if(!medicalDied&&rng.chance(mortalityProbability(npc,age,runtime))) markDeath(world,npc,year,age<1?'infant illness':healthPressure(runtime)>.55?'illness during a healthcare crisis':'natural causes',notices);
    });
    autonomousFamilyTransitions(world,year,notices);
    if(root.HouseholdSystem&&!ctx.deferHousehold){
      root.HouseholdSystem.tick(world,{year,subject,lineage}).forEach(notice=>notices.push(notice));
    }
    if(root.RelationshipMemory) root.RelationshipMemory.tick(world,year);
    repairPartnerLinks(world);
    world.npcNotices.push(...notices);
    if(world.npcNotices.length>120) world.npcNotices=world.npcNotices.slice(-120);
    world.npcLastTickYear=year;
    syncRegistryToLegacy(world,subject,lineage);
    trim(world);
    return world.npcs;
  }

  function registerKinNow(world,subject,lineage,kin){
    ensure(world);subjectRecord(world,subject);const npc=registerKin(world,subject,kin);ensureSubjectHousehold(world,subject,lineage);return npc;
  }

  function markLegacyKinDeath(world,subject,lineage,kin){
    if(!world||!kin) return;
    const npc=registerKin(world,subject,kin);
    if(npc&&kin.alive===false) markDeath(world,npc,Number(world.year)||0,kin.deathCause||'recorded death',world.npcNotices);
    syncRegistryToLegacy(world,subject,lineage);
  }

  function markNpcDeath(world,npc,year,cause,notices){
    ensure(world);
    const result=markDeath(world,npc,Number(year)||Number(world.year)||0,cause,notices||world.npcNotices);
    repairPartnerLinks(world);
    return result;
  }

  function markSubjectDeath(world,subject,lineage){
    if(!world||!subject) return null;
    migrate(world,subject,lineage);
    const npc=world.npcs[subject.npcId];
    if(npc){npc.alive=false;npc.deathYear=Number(world.year)||subject.dob+subject.age;npc.deathCause=subject.cause||'recorded death';npc.health.general=0;npc.employment.status='deceased';npc.employment.income=0;historyPush(npc,{year:npc.deathYear,type:'death',summary:'Subject file closed: '+npc.deathCause+'.'});detachPartner(world,npc);}
    repairPartnerLinks(world);
    return npc;
  }

  function syncAfterTravel(world,subject,lineage,destinationId){
    ensure(world);
    if(!root.HouseholdSystem||!subject||!subject.npcId||subject.alive===false) return null;
    const settlementId=String(destinationId||subject.location&&subject.location.settlementId||world.activeSettlementId||'');
    let household=root.HouseholdSystem.findByMember(world,subject.npcId);
    if(!household) household=root.HouseholdSystem.create(world,{settlementId,memberIds:[subject.npcId],dependentIds:[],origin:'travel-repair'});
    household.settlementId=settlementId;
    household.lastMoveYear=Number(world.year)||0;
    const subjectNpc=world.npcs[subject.npcId];
    if(subjectNpc){subjectNpc.locationId=settlementId;subjectNpc.householdId=household.id;}
    syncLegacyToRegistry(world,subject,lineage);
    household=root.HouseholdSystem.findByMember(world,subject.npcId)||household;
    household.settlementId=settlementId;
    household.memberIds.forEach(id=>{
      const npc=world.npcs[id];
      if(npc&&npc.alive!==false) npc.locationId=settlementId;
    });
    root.HouseholdSystem.reconcile(world,subject);
    repairPartnerLinks(world);
    syncRegistryToLegacy(world,subject,lineage);
    return household;
  }

  function promoteSubject(world,subject,member,lineage,previousSubjectId){
    ensure(world);
    const candidateId=member&&member.npcId||legacyId('kin',member&&member.mid||subject.id);
    let candidate=world.npcs[candidateId];
    if(!candidate&&member) candidate=registerKin(world,subject,member);
    if(previousSubjectId&&world.npcs[previousSubjectId]) world.npcs[previousSubjectId].isSubject=false;
    subject.npcId=candidate?candidate.id:candidateId;
    const active=subjectRecord(world,subject);
    if(candidate){
      active.householdId=candidate.householdId;
      active.locationId=subject.location&&subject.location.settlementId||candidate.locationId;
      active.roleTags=['subject'];
    }
    if(root.RelationshipMemory&&previousSubjectId) root.RelationshipMemory.add(world,{year:Number(world.year)||0,type:'succession',participants:[previousSubjectId,active.id],intensity:1,valence:.35,decay:.004,summary:fullName(active)+' took up the family file.'});
    ensureSubjectHousehold(world,subject,lineage);
    if(lineage) lineage.activeSubjectNpcId=active.id;
    return active;
  }

  function drainNotices(world){
    ensure(world);
    const notices=world.npcNotices.slice();world.npcNotices.length=0;return notices;
  }

  function noticeText(world,notice){
    const settlement=notice.settlementId&&root.settlementById?root.settlementById(notice.settlementId):null;
    if(notice.type==='death') return notice.name+' died of '+notice.cause+'.';
    if(notice.type==='birth') return notice.name+' was born into a connected household.';
    if(notice.type==='marriage') return notice.name+' and '+notice.otherName+' formed a household.';
    if(notice.type==='employment') return notice.name+' found work in '+notice.sector+'.';
    if(notice.type==='job_loss') return notice.name+' lost their work.';
    if(notice.type==='retirement') return notice.name+' retired from paid work.';
    if(notice.type==='household_migration') return 'A connected household moved to '+(settlement?settlement.name:notice.settlementId)+'.';
    return 'A connected life changed.';
  }

  function subjectSummary(world,subject){
    migrate(world,subject,null);
    const household=root.HouseholdSystem&&root.HouseholdSystem.findByMember(world,subject.npcId);
    const members=household?household.memberIds.map(id=>world.npcs[id]).filter(Boolean):[];
    return {subjectId:subject.npcId,household,members,memories:root.RelationshipMemory?root.RelationshipMemory.forPerson(world,subject.npcId).slice(0,8):[]};
  }

  function checkInvariants(world,subject,lineage){
    const violations=[], npcs=world&&world.npcs||{};
    if(world&&Object.keys(npcs).length&&world.npcSchemaVersion!==SCHEMA_VERSION) violations.push('NPC schema must be version '+SCHEMA_VERSION);
    if(Object.keys(npcs).length>MAX_NPCS) violations.push('NPC registry exceeds '+MAX_NPCS+' records');
    Object.keys(npcs).forEach(id=>{
      const npc=npcs[id];
      if(!npc||typeof npc!=='object'){violations.push('NPC '+id+' must be an object');return;}
      if(npc.id!==id) violations.push('NPC key and id must match for '+id);
      if(!Number.isFinite(Number(npc.birthYear))) violations.push('NPC '+id+' birthYear must be finite');
      if(!Number.isFinite(Number(npc.health&&npc.health.general))||Number(npc.health.general)<0||Number(npc.health.general)>100) violations.push('NPC '+id+' health must be between 0 and 100');
      if(!Number.isFinite(Number(npc.wealth&&npc.wealth.cash))||!Number.isFinite(Number(npc.wealth&&npc.wealth.debt))) violations.push('NPC '+id+' wealth must be finite');
      if(npc.alive===false&&npc.employment&&npc.employment.status!=='deceased') violations.push('deceased NPC '+id+' must not retain normal employment');
      if(npc.alive===false&&!Number.isFinite(Number(npc.deathYear))) violations.push('deceased NPC '+id+' requires deathYear');
      if(npc.partnerId&&(!npcs[npc.partnerId]||npcs[npc.partnerId].partnerId!==id)) violations.push('NPC '+id+' partner link must be reciprocal');
      if(root.MedicalSystem) root.MedicalSystem.checkInvariants(npc).forEach(v=>violations.push('NPC '+id+' medical: '+v));
      Object.keys(npc.relationships||{}).forEach(otherId=>{
        const rel=npc.relationships[otherId];
        ['closeness','trust','conflict'].forEach(key=>{if(!Number.isFinite(Number(rel[key]))||Number(rel[key])<0||Number(rel[key])>100) violations.push('NPC '+id+' relationship '+otherId+' '+key+' must be between 0 and 100');});
      });
    });
    const active=Object.values(npcs).filter(npc=>npc.isSubject);
    if(subject&&active.length!==1) violations.push('exactly one NPC must mirror the active subject');
    if(subject&&subject.npcId&&!npcs[subject.npcId]) violations.push('subject NPC id must exist in registry');
    if(subject&&npcs[subject.npcId]&&Number(world.year)!==Number(subject.dob)+Number(subject.age)) violations.push('subject age must match world year');
    if(root.HouseholdSystem) violations.push(...root.HouseholdSystem.checkInvariants(world,subject));
    if(lineage&&Array.isArray(lineage.members)) lineage.members.forEach(member=>{if(member.npcId&&!npcs[member.npcId]) violations.push('legacy kin '+member.mid+' references missing NPC '+member.npcId);});
    return violations;
  }

  root.NpcSystem={
    SCHEMA_VERSION,
    MAX_NPCS,
    ensure,
    normalize,
    upsert,
    migrate,
    bootstrapSubject,
    subjectRecord,
    registerParent,
    registerKin,
    registerContact,
    registerKinNow,
    markLegacyKinDeath,
    markNpcDeath,
    markSubjectDeath,
    promoteSubject,
    syncAfterTravel,
    syncLegacy,
    syncLegacyToRegistry,
    syncRegistryToLegacy,
    ensureSubjectHousehold,
    tick,
    drainNotices,
    noticeText,
    subjectSummary,
    relationship,
    checkInvariants,
    fullName,
    stream
  };

  function syncLegacy(world,subject,lineage,options){
    if(!world||!subject) return null;
    ensure(world);
    const result=syncLegacyToRegistry(world,subject,lineage);
    if(!(options&&options.skipSubjectHousehold)) ensureSubjectHousehold(world,subject,lineage);
    syncRegistryToLegacy(world,subject,lineage);
    return result;
  }
})(typeof globalThis!=='undefined'?globalThis:this);
