'use strict';
/* Phase 3: linked career and underworld stories. Persistent authority is StorySystem. */
(function(root){
 const lived=(w,id)=>Object.values(w.storyArchive||{}).filter(a=>a&&a.episodeId===id)
   .sort((a,b)=>(b.resolvedYear||0)-(a.resolvedYear||0))[0]||null;
 const adult=s=>!!s&&s.alive!==false&&s.age>=18;
 const contract=w=>{try{return root.EmploymentSystem.activeForPerson(w,'subject')[0]||null;}catch(_){return null;}};
 const one=t=>[{sp:'narrator',t}];
 const end=(id,title,t,effects,tone='prudent')=>({lines:one(t),ending:{id,title,tone,epilogue:[t],effects}});
 const S=(stat,delta)=>({kind:'stat',stat,delta});
 const R=delta=>({kind:'scrutiny',delta});
 const M=delta=>({kind:'money',delta});
 const I=(id,label,icon)=>({kind:'storyItem',id,label,icon});
 const memory=(type,summary,valence,participants=[])=>({kind:'memory',type,summary,valence,intensity:.65,participants:participants.filter(Boolean)});
 const careerCast=w=>{
   const c=contract(w);if(!c)return null;
   const business=w.businesses&&w.businesses[c.businessId];
   const peers=root.EmploymentSystem.activeForBusiness(w,c.businessId)||[];
   const npc=peers.filter(p=>p.personId!=='subject').map(p=>w.npcs&&w.npcs[p.personId]).find(n=>n&&n.alive!==false);
   const wage=lived(w,'quest_wage_file'),family=lived(w,'quest_kitchen_table');
   return [{key:'employer',label:business&&business.name||'The employer',bind:c.businessId,contractId:c.id},
     {key:'coworker',label:npc&&npc.name||'A colleague',bind:npc&&npc.id||null},
     {key:'wage',label:'Wage record',bind:wage&&wage.endingId||null},
     {key:'family',label:'Family record',bind:family&&family.endingId||null}];
 };
 const manifestCast=w=>{
   const market=lived(w,'quest_night_market'),ward=lived(w,'quest_ward_petition');
   if(!market)return null;
   const npc=Object.values(w.npcs||{}).find(n=>n&&n.alive!==false&&Array.isArray(n.roleTags)&&n.roleTags.includes('fixer'));
   return [{key:'market',label:'Market file',bind:market.endingId},
    {key:'ward',label:'Ward file',bind:ward&&ward.endingId||null},
    {key:'broker',label:npc&&npc.name||'Unknown courier',bind:npc&&npc.id||null}];
 };
 const episodes=[
  {id:'quest_reference_file',quest:true,energyCost:1,questTitle:'The Reference File',
   questHint:'A former dispute changes who will support your career.',questIcon:'📋',questArc:'CAREER',domain:'work',
   cast:careerCast,eligible:(w,s)=>adult(s)&&!!contract(w)&&
    (!!lived(w,'quest_wage_file')||!!lived(w,'quest_ward_petition')),
   build(bind){
    const employer=bind.employer,wage=bind.wage.bind,family=bind.family.bind,peer=bind.coworker;
    const peers=peer.bind?[peer.bind]:[];
    const bonds=peer.bind?[{kind:'npcBond',npcId:peer.bind,delta:8}]:[];
    const wageLine=wage==='wages_reprisals'?'The failed wage complaint and Bureau reprisal still follow your name.':
      wage?'The earlier wage dispute has made management remember you.':
      'Your past Ward petition brought you to the attention of the office.';
    const familyLine=family==='care_recovered'||family==='care_clinic'?
      ' Your household care record also says something about your reliability.':
      family?' An unresolved family burden has also cost you time.':'';
    return {title:'THE REFERENCE FILE',bg:'factory_floor',scenes:{
     open:{lines:one(wageLine+familyLine+' '+peer.label+' offers a reference at '+employer.label+'.'),
      choice:{prompt:'What will support your next pay review?',options:[
       {t:'Ask your coworker to endorse you',note:'Social · 3d6',tone:'kind',goto:'letter',
        check:{domain:'social',difficulty:wage==='wages_reprisals'?'hard':'standard',
         failGoto:'delay',successEffects:[I('career_letter','Signed recommendation','📜'),...bonds]}},
       {t:'Document your best work',note:'Study · 3d6',tone:'prudent',goto:'portfolio',
        check:{domain:'study',difficulty:'standard',failGoto:'delay',
         successEffects:[I('career_portfolio','Work portfolio','📑')]}},
       {t:'Leave the dispute behind',note:'Guaranteed · no roll',tone:'grey',goto:'quiet'}
      ]}},
     letter:{lines:one('The recommendation is signed. Someone must now decide how it will be used.'),
      choice:{prompt:'Take the letter where?',options:[
       {t:'Request a documented salary review',require:{item:'career_letter'},tone:'prudent',
        goto:'raise',check:{domain:'bureau',difficulty:'hard',
         item:'career_letter',itemBonus:2,failGoto:'delay'}},
       {t:'Recommend a newer worker instead',note:'Guaranteed · mentor',tone:'kind',goto:'mentor'}
      ]}},
     portfolio:{lines:one('Your work record is complete. The details are hard to dismiss.'),
      choice:{prompt:'What will the portfolio accomplish?',options:[
       {t:'Present the evidence to management',require:{item:'career_portfolio'},tone:'prudent',
        goto:'raise',check:{domain:'labor',difficulty:'hard',
         item:'career_portfolio',itemBonus:2,failGoto:'delay'}},
       {t:'Train the newest workers',note:'Guaranteed · mentor',tone:'kind',goto:'mentor'}
      ]}},
     delay:{lines:one('The request is delayed. The other workers offer to help you train.'),
      choice:{prompt:'There is still a way forward.',options:[
       {t:'Train with the others',note:'Guaranteed · skill',tone:'prudent',goto:'trained'},
       {t:'Appeal the delay publicly',tone:'grey',goto:'raise',
        check:{domain:'bureau',difficulty:'severe',failGoto:'watchlist'}}
      ]}},
     raise:end('reference_raised','A RAISE ON RECORD','A future salary increase is entered against your original contract.',
      [{kind:'jobRaise',amount:180,requireBusinessId:employer.bind,
        requireContractId:employer.contractId},S('happiness',3),
       memory('reference_raised','A recommendation led to a documented pay review.',.6,peers)],'kind'),
     mentor:end('reference_mentor','THE LESSON PASSES ON','The recommendation helps another worker develop a trade.',
      [{kind:'skill',skill:'craft',delta:1},S('relations',4),...bonds,
       memory('reference_mentor','Coworkers supported one another after an old dispute.',.8,peers)],'kind'),
     trained:end('reference_trained','A BETTER CRAFT','You continue to improve without a promise from management.',
      [{kind:'skill',skill:'craft',delta:2},S('happiness',1)]),
     watchlist:end('reference_watchlist','AN OFFICE NOTATION','The appeal fails and draws attention.',
      [R(7),S('happiness',-4),memory('reference_watchlist','A career appeal drew official scrutiny.',-.4,peers)],'grey'),
     quiet:end('reference_quiet','AN UNWRITTEN REFERENCE','You avoid further conflict and protect your time.',
      [S('health',2),S('happiness',-1)])
    }};
   }
  },
  {id:'quest_reference_return',quest:true,followup:true,energyCost:1,
   questTitle:'The Next Interview',questHint:'One year later, the recommendation has consequences.',
   questIcon:'🪪',questArc:'CAREER',domain:'work',
   cast(w){const a=lived(w,'quest_reference_file');return a?
    [{key:'prior',label:a.endingTitle||'Earlier reference',bind:a.endingId}]:null;},
   eligible:(w,s)=>adult(s)&&!!lived(w,'quest_reference_file')&&
    w.year>lived(w,'quest_reference_file').resolvedYear,
   build(bind){
    const p=bind.prior.bind;
    const intro=p==='reference_raised'?'Your previous pay review is remembered. A younger apprentice needs guidance.':
      p==='reference_watchlist'?'The Bureau still remembers the last appeal. A colleague offers to speak for you.':
      p==='reference_mentor'?'The worker you once trained now helps somebody else.':
      'A second opportunity to explain your work appears.';
    return {title:'THE NEXT INTERVIEW',bg:'office',scenes:{
     open:{lines:one(intro),choice:{prompt:'What should this record mean for someone else?',options:[
      {t:'Prepare a colleague for the panel',tone:'kind',goto:'community',
       check:{domain:'social',difficulty:'standard',failGoto:'setback'}},
      {t:'Explain the work you completed',tone:'prudent',goto:'recognized',
       check:{domain:'study',difficulty:'hard',failGoto:'setback'}},
      {t:'Close the file',note:'Guaranteed',tone:'grey',goto:'rest'}
     ]}},
     community:end('reference_return_community','THE NEXT PERSON','You become a reference for another worker.',
      [{kind:'skill',skill:'social',delta:1},S('relations',6),
       memory('reference_return_community','An old employment dispute led to lasting help.',.6)],'kind'),
     recognized:end('reference_return_recognized','THE WORK STANDS','Your experience becomes training, not an invented job.',
      [{kind:'skill',skill:'craft',delta:2},S('happiness',4)]),
     setback:end('reference_return_setback','A HARDER CONVERSATION','The panel is unmoved, but the work continues.',
      [{kind:'skill',skill:'craft',delta:1},S('happiness',-2)],'grey'),
     rest:end('reference_return_rest','THE FILE CLOSES','You leave the bureau behind.',
      [S('health',3),S('happiness',2)])
    }};
   }
  },
  {id:'quest_grey_manifest',quest:true,energyCost:1,
   questTitle:'The Grey Manifest',questHint:'A night-market shipment reappears in an official ledger.',
   questIcon:'🧾',questArc:'UNDERWORLD',domain:'trade',cast:manifestCast,
   eligible:(w,s)=>adult(s)&&!!lived(w,'quest_night_market'),
   build(bind){
    const market=bind.market.bind,ward=bind.ward.bind,broker=bind.broker;
    const peers=broker.bind?[broker.bind]:[];
    const bond=broker.bind?[{kind:'npcBond',npcId:broker.bind,delta:6}]:[];
    const marketLine=market==='market_profit'?'The profitable crate from the night-market vendor appears in a shipment audit.':
      market==='market_returned'||market==='market_reported'?
       'The shipment you helped recover appears again on an altered manifest.':
       'A night-market vendor has connected your name to a disputed crate.';
    const wardLine=ward==='ward_reopened'?' The Ward Office recalls your earlier hearing.':
      ward==='ward_retaliation'?' The Ward Office still holds your name on its list.':'';
    const official=ward==='ward_reopened'||ward==='ward_cleared';
    return {title:'THE GREY MANIFEST',bg:'dock_night',scenes:{
     open:{lines:one(marketLine+wardLine+' A courier offers a copy of the missing ledger.'),
      choice:{prompt:'Who should control the paper?',options:[
       {t:'Report it to the Ward Office',tone:'kind',goto:'reported',
        check:{domain:'bureau',difficulty:official?'easy':'hard',
         item:'ward_notice',itemBonus:2,failGoto:'exposed',
         successEffects:[I('grey_testimony','Recorded testimony','📜')]}},
       {t:'Hide the shipment trail',tone:'grey',goto:'concealed',
        check:{domain:'hustle',difficulty:'hard',failGoto:'exposed'}},
       {t:'Pay for a duplicate',note:'$40 · evidence',tone:'prudent',
        require:{minAssets:40},effects:[M(-40),I('grey_duplicate','Ledger copy','🧾')],goto:'copy'},
       {t:'Walk away',note:'Guaranteed',tone:'cold',goto:'quiet'}
      ]}},
     copy:{lines:one('The ledger marks belong to a missing shipment.'),
      choice:{prompt:'Keep or file the duplicate?',options:[
       {t:'File it with the Ward',require:{item:'grey_duplicate'},tone:'kind',goto:'reported',
        check:{domain:'bureau',difficulty:'hard',item:'grey_duplicate',itemBonus:2,failGoto:'exposed'}},
       {t:'Preserve it privately',note:'Guaranteed',tone:'prudent',goto:'quiet'}
      ]}},
     reported:end('grey_reported','THE LEDGER OPENS','An official inquiry records the shipment dispute.',
      [R(-9),S('relations',3),
       memory('grey_reported','A night-market shipment was reported to the Ward.',.5,peers)],'kind'),
     concealed:end('grey_concealed','OFF THE BOOKS','A quiet payment arrives, but the warehouse attracts scrutiny.',
      [M(80),R(6),{kind:'vice',delta:1},S('happiness',-2),...bond,
       memory('grey_concealed','A shipment remained off the books.',-.5,peers)],'grey'),
     exposed:end('grey_exposed','UNDER SUSPICION','The courier disappears; the office keeps your name.',
      [R(11),S('happiness',-5),
       memory('grey_exposed','Explaining a shipment brought scrutiny.',-.6,peers)],'cold'),
     quiet:end('grey_quiet','THE COPY IS FOLDED','You avoid another confrontation.',
      [R(-1),S('happiness',1)])
    }};
   }
  },
  {id:'quest_grey_witness',quest:true,followup:true,energyCost:1,
   questTitle:'The Witness List',questHint:'Your handling of the manifest determines who trusts you.',
   questIcon:'🕯️',questArc:'UNDERWORLD',domain:'trade',
   cast(w){const p=lived(w,'quest_grey_manifest'),ward=lived(w,'quest_ward_petition');return p?
    [{key:'prior',label:p.endingTitle||'Manifest',bind:p.endingId},
     {key:'ward',label:ward&&ward.endingTitle||'Ward',bind:ward&&ward.endingId||null}]:null;},
   eligible:(w,s)=>adult(s)&&!!lived(w,'quest_grey_manifest')&&
    w.year>lived(w,'quest_grey_manifest').resolvedYear,
   build(bind){
    const p=bind.prior.bind,ward=bind.ward.bind;
    const line=p==='grey_concealed'?'A courier remembers your hidden shipment. Somebody wants an answer.':
      p==='grey_reported'?'The Ward Office calls a witness after your earlier report.':
      p==='grey_exposed'?'The suspicion beside your name attracts an investigator.':
       'A saved ledger page appears without a signature.';
    const civic=ward==='ward_reopened'?' Your prior petition still matters.':'';
    return {title:'THE WITNESS LIST',bg:'office',scenes:{
     open:{lines:one(line+civic),choice:{prompt:'The witness is waiting. What can you offer?',options:[
      {t:'Submit your recorded testimony',require:{item:'grey_testimony'},tone:'prudent',
       goto:'vindicated',check:{domain:'bureau',difficulty:'standard',
        item:'grey_testimony',itemBonus:2,failGoto:'noticed'}},
      {t:'Protect the witness',tone:'kind',goto:'protected',
       check:{domain:'social',difficulty:'hard',failGoto:'noticed'}},
      {t:'Refuse to reopen the case',note:'Guaranteed',tone:'grey',goto:'depart'}
     ]}},
     vindicated:end('grey_witness_cleared','A NAME CLEARED','A later testimony lessens the original suspicion.',
      [R(-12),S('relations',4),
       memory('grey_witness_cleared','A later testimony restored some public trust.',.6)],'kind'),
     protected:end('grey_witness_protected','THE WITNESS IS SAFE','The witness is protected, though the shipment is still missing.',
      [S('relations',6),S('happiness',2),
       memory('grey_witness_protected','A private act of solidarity protected a witness.',.7)],'kind'),
     noticed:end('grey_witness_noticed','STILL ON THE LIST','An attempt to help attracts another notation.',
      [R(5),S('relations',1)],'grey'),
     depart:end('grey_witness_depart','AN UNSIGNED ACCOUNT','You choose not to reopen the record.',
      [R(-2),S('health',2)])
    }};
   }
  }
 ];
 root.StoryEpisodes=(root.StoryEpisodes||[]).concat(episodes);
 root.StoryQuestCatalogue=Object.freeze((root.StoryQuestCatalogue||[])
   .concat(episodes.map(e=>Object.freeze({id:e.id,title:e.questTitle,arc:e.questArc}))));
 root.StoryConsequenceArcs=Object.freeze(episodes.map(e=>e.id));
})(typeof globalThis!=='undefined'?globalThis:this);
