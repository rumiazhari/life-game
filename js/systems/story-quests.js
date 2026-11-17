'use strict';
/* Life File: opt-in story quests. All consequences are existing StorySystem operations,
 * evidence is held in World.storyItems and progress is read from World.storyArchive. */
(function(root){
 const lived=(w,id)=>Object.values(w.storyArchive||{}).filter(a=>a.episodeId===id)
   .sort((a,b)=>b.resolvedYear-a.resolvedYear)[0]||null;
 const adult=s=>!!s&&s.alive!==false&&s.age>=18;
 const oldEnough=s=>!!s&&s.alive!==false&&s.age>=12;
 const contract=w=>{try{return root.EmploymentSystem.activeForPerson(w,'subject')[0]||null;}catch(_){return null;}};
 const homeCast=(w,s)=>{const p=s&&s.mother&&s.mother.alive?s.mother:s&&s.father&&s.father.alive?s.father:null;
   return p?[{key:'relative',label:p.first||p.name||'A parent',bind:p.npcId||null}]:null;};
 const employerCast=(w)=>{const c=contract(w);if(!c)return null;
   const company=w.businesses&&w.businesses[c.businessId];
   const peers=Object.values(w.employmentContracts||{}).filter(x=>x.businessId===c.businessId&&x.personId!=='subject'&&x.status==='active');
   const peer=peers.map(x=>w.npcs&&w.npcs[x.personId]).find(n=>n&&n.alive!==false);
   return [{key:'employer',label:company&&company.name||'The employer',bind:c.businessId,contractId:c.id},
     {key:'coworker',label:peer&&peer.name||'A colleague',bind:peer&&peer.id||null}];};
 const one=(t)=>[{sp:'narrator',t}];
 const ending=(id,title,epilogue,effects,tone='prudent')=>({
   lines:one(epilogue),ending:{id,title,tone,epilogue:[epilogue],effects:effects||[]}
 });
 const M=(delta)=>({kind:'money',delta});
 const F=(delta)=>({kind:'familyMood',delta});
 const S=(stat,delta)=>({kind:'stat',stat,delta});
 const R=(delta)=>({kind:'scrutiny',delta});
 const I=(id,label,icon)=>({kind:'storyItem',id,label,icon});
 const mem=(type,summary,valence,participants=[])=>({kind:'memory',type,summary,valence,intensity:.65,participants:participants.filter(Boolean)});
 const episodes=[

  {id:'quest_wage_file',quest:true,questTitle:'The Missing Wages',questHint:'A payroll discrepancy puts the whole workshop at risk.',
   questIcon:'📒',questArc:'WORK',domain:'work',weight:4,cast:employerCast,
   eligible:(w,s)=>adult(s)&&!!contract(w),
   build(bind){const company=bind.employer.label,peer=bind.coworker.label,peerIds=bind.coworker.bind?[bind.coworker.bind]:[];return {
    title:'THE MISSING WAGES',bg:'factory_floor',scenes:{
      open:{lines:one('A pay packet comes up short at '+company+'. '+peer+' asks you to look into the ledger.'),
       choice:{prompt:'How will you respond?',options:[
        {t:'Copy the accounts',note:'Find evidence',tone:'prudent',goto:'proof',check:{domain:'study',skill:'academics',difficulty:'easy',failGoto:'caught',
          successEffects:[I('wage_copy','Payroll copy','📒')],failEffects:[R(3)]}},
        {t:'Negotiate directly',note:'No evidence yet',tone:'kind',goto:'offer',check:{domain:'social',difficulty:'standard',failGoto:'refused',
          successEffects:[S('relations',2)]}},
        {t:'Organize the workers',note:'Risk retaliation',tone:'kind',goto:'solidarity',check:{domain:'labor',skill:'social',difficulty:'hard',failGoto:'refused'}},
        {t:'Leave the complaint alone',note:'Guaranteed · no roll',tone:'grey',goto:'quiet'}
       ]}},
      proof:{lines:one('The numbers are copied. Someone has been pocketing the difference.'),
       choice:{prompt:'Now what?',options:[
        {t:'Submit the evidence',note:'Proof strengthens the case',tone:'prudent',require:{item:'wage_copy'},goto:'restored',
         check:{domain:'bureau',difficulty:'hard',item:'wage_copy',itemBonus:2,failGoto:'reprisal',successEffects:[S('relations',3)],failEffects:[R(5)]}},
        {t:'Demand a private settlement',note:'Secure a smaller raise',tone:'grey',goto:'compromise'}
       ]}},
      caught:{lines:one('The accounts disappear before you can photograph them. The office is watching.'),
       choice:{prompt:'Continue without documents?',options:[
        {t:'Ask for a hearing',note:'Unprepared but lawful',tone:'prudent',goto:'restored',
         check:{domain:'bureau',difficulty:'severe',failGoto:'reprisal'}},
        {t:'Protect your position',note:'No further scrutiny',tone:'cold',goto:'quiet'}
       ]}},
      offer:{lines:one('Management offers a modest increase, provided the matter stays private.'),
       choice:{prompt:'Take the offer?',options:[
        {t:'Accept the compromise',tone:'prudent',goto:'compromise'},
        {t:'Insist on full accounting',note:'Higher stakes',tone:'kind',goto:'restored',
         check:{domain:'labor',difficulty:'hard',failGoto:'reprisal'}}
       ]}},
      solidarity:{lines:one('The floor stands together. Management requests one spokesperson.'),
       choice:{prompt:'How will you lead?',options:[
        {t:'Insist on a written agreement',tone:'kind',goto:'restored',check:{domain:'social',difficulty:'standard',failGoto:'compromise'}},
        {t:'Accept an immediate partial settlement',tone:'prudent',goto:'compromise'}
       ]}},
      refused:{lines:one('The response is cold. Your colleagues now know where you stand.'),
       choice:{prompt:'One last decision.',options:[
        {t:'Appeal to the Bureau',tone:'prudent',goto:'restored',check:{domain:'bureau',difficulty:'severe',failGoto:'reprisal'}},
        {t:'Leave the dispute alone',tone:'cold',goto:'quiet'}
       ]}},
      restored:ending('wages_restored','THE LEDGER HOLDS','Management signs a future salary increase. The old missing wages remain disputed.',
        [{kind:'jobRaise',amount:260,requireBusinessId:bind.employer.bind,requireContractId:bind.employer.contractId},S('happiness',5),mem('wage_restored','The wage dispute was resolved through a recorded agreement.',.7,peerIds)],'kind'),
      compromise:ending('wages_compromise','A SMALLER VICTORY','A smaller future raise is agreed. The old pay packet remains unresolved.',
        [{kind:'jobRaise',amount:110,requireBusinessId:bind.employer.bind,requireContractId:bind.employer.contractId},S('happiness',2),mem('wage_compromise','A limited agreement settled the wage dispute.',.3,peerIds)]),
      reprisal:ending('wages_reprisals','THE WATCH LIST','The complaint fails. The employer keeps the ledger; the Bureau keeps your name.',
        [R(12),S('happiness',-7),mem('wage_reprisals','A disputed wage claim drew unwanted scrutiny.',-.7,peerIds)],'cold'),
      quiet:ending('wages_quiet','NOTHING IN WRITING','The job survives. The missing wages do not return.',
        [S('happiness',-3),mem('wage_quiet','The missing wages went unchallenged.',-.2,peerIds)],'grey')
    }
   }; }
  },

  {id:'quest_wage_aftermath',quest:true,followup:true,questTitle:'The Next Pay Packet',questHint:'Last year’s wage dispute returns to the floor.',
   questIcon:'⚖️',questArc:'WORK',domain:'work',cast(w,s){const a=lived(w,'quest_wage_file');return a?[{key:'record',label:a.endingTitle||'The dispute',bind:a.endingId}]:null;},
   eligible:(w,s)=>adult(s)&&!!lived(w,'quest_wage_file')&&w.year>lived(w,'quest_wage_file').resolvedYear,
   build(bind){const previous=bind.record.bind;return{title:'THE NEXT PAY PACKET',bg:'office',scenes:{
    open:{lines:one(previous==='wages_restored'?'The promised increase arrives. A coworker asks who will be protected next.':
        previous==='wages_reprisals'?'An investigator reopens the complaint. There is one chance to provide testimony.':
        'The old wage dispute is back. A new manager wants it settled permanently.'),
      choice:{prompt:'The file can still change.',options:[
       {t:'Back a colleague',note:'Earn lasting trust',tone:'kind',goto:'solid',check:{domain:'social',difficulty:'standard',failGoto:'cost',
        successEffects:[S('relations',5)]}},
       {t:'Accept the written settlement',note:'Close the matter',tone:'prudent',goto:'settle'},
       {t:'Challenge management publicly',note:'High risk',tone:'grey',goto:'solid',check:{domain:'bureau',difficulty:'severe',failGoto:'cost'}}
      ]}},
    solid:ending('wage_follow_solid','A STRONGER FLOOR','The crew now has someone willing to speak for it.',
      [S('relations',6),S('happiness',3),mem('wage_follow_solid','Workers trusted one another after the pay dispute.',.8)],'kind'),
    settle:ending('wage_follow_settle','A SIGNED PAGE','The dispute closes with a final signature.',[S('happiness',2),R(-2)]),
    cost:ending('wage_follow_cost','THE COST OF SPEAKING','Your intervention fails, but others saw who took the risk.',[R(5),S('relations',1)],'grey')
   }};}
  },

  {id:'quest_kitchen_table',quest:true,questTitle:'A Place at the Table',questHint:'A family emergency calls for care, cash, or connections.',
   questIcon:'🩺',questArc:'FAMILY',domain:'family',cast:homeCast,
   eligible:(w,s)=>oldEnough(s)&&!!homeCast(w,s),
   build(bind){const parent=bind.relative.label;return {title:'A PLACE AT THE TABLE',bg:'night_flat',scenes:{
    open:{lines:one(parent+' has missed two meals. The local clinic requests payment before arranging a visit.'),
      choice:{prompt:'Who carries this burden?',options:[
       {t:'Take charge of care',note:'Care skill helps',tone:'kind',goto:'recover',check:{domain:'study',skill:'care',difficulty:'standard',failGoto:'overworked',
        successEffects:[F(8)],failEffects:[S('health',-4)]}},
       {t:'Pay the clinic',note:'Guaranteed treatment · $60',tone:'prudent',require:{minAssets:60},goto:'clinic',effects:[M(-60)]},
       {t:'Ask neighbors for help',note:'Social approach',tone:'kind',goto:'clinic',check:{domain:'social',difficulty:'hard',failGoto:'alone'}},
        {t:'Stay and keep watch',note:'Guaranteed · tiring',tone:'kind',goto:'overworked'}
      ]}},
    recover:ending('care_recovered','CARE AT HOME','The care is difficult, but the household pulls together.',
     [F(10),S('happiness',4),I('home_remedy','Care notes','🩺'),mem('care_recovered','The family carried a difficult illness together.',.7)],'kind'),
    clinic:ending('care_clinic','THE DOCTOR CALLS','Professional care arrives. The family remembers who found it.',
     [F(7),S('happiness',3),mem('care_clinic','The household found help in a difficult season.',.5)],'prudent'),
    overworked:ending('care_overwork','AN EXHAUSTED VIGIL','You keep watch, but the strain shows. Another visit will be needed.',
     [S('health',-5),F(3),mem('care_overwork','Caregiving came at a personal cost.',.1)],'grey'),
    alone:ending('care_alone','ONE MORE EMPTY CHAIR','No help comes tonight. The household makes do.',
     [F(-5),S('happiness',-5),mem('care_alone','The household faced hardship without outside support.',-.4)],'cold')
   }};}
  },

  {id:'quest_kitchen_return',quest:true,followup:true,questTitle:'The Family Returns',questHint:'Your earlier decision shaped what the household now expects.',
   questIcon:'🏠',questArc:'FAMILY',domain:'family',cast(w,s){const a=lived(w,'quest_kitchen_table');return a?[{key:'record',label:a.endingTitle,bind:a.endingId}]:null;},
   eligible:(w,s)=>oldEnough(s)&&!!lived(w,'quest_kitchen_table')&&w.year>lived(w,'quest_kitchen_table').resolvedYear,
   build(bind){const c=bind.record.bind;return{title:'THE FAMILY RETURNS',bg:'night_flat',scenes:{
    open:{lines:one(c==='care_recovered'?'The household is stronger, but someone asks if you can teach them to care for others.':
      c==='care_overwork'?'A new fever arrives. This time you know the cost of carrying everything alone.':
      'Another relative knocks on the door asking for help.'),
     choice:{prompt:'What lesson survives?',options:[
      {t:'Share what you learned',tone:'kind',goto:'taught',check:{domain:'study',skill:'care',difficulty:'standard',item:'home_remedy',failGoto:'rest'}},
      {t:'Set a boundary',note:'Guaranteed · protects health',tone:'prudent',goto:'rest'},
      {t:'Fund another clinic visit',note:'$40',tone:'kind',require:{minAssets:40},goto:'helped',effects:[M(-40)]}
     ]}},
    taught:ending('family_taught','THE LESSON SPREADS','The household learns how to share its burdens.',[F(8),S('relations',3),mem('family_taught','Caregiving knowledge was passed through the household.',.8)],'kind'),
    rest:ending('family_rest','A BOUNDARY KEPT','You refuse to become the only person who can say yes.',[S('health',4),F(2)],'prudent'),
    helped:ending('family_helped','THE DOOR STAYS OPEN','The next visit is paid. So is the trust behind it.',[F(7),S('happiness',3)],'kind')
   }};}
  },

  {id:'quest_ward_petition',quest:true,questTitle:'The Ward Petition',questHint:'A civic notice threatens a neighborhood workshop.',
   questIcon:'🏛️',questArc:'BUREAU',domain:'bureau',cast(){return[{key:'clerk',label:'Ward Office'}];},
   eligible:(w,s)=>adult(s),
   build(){return{title:'THE WARD PETITION',bg:'office',scenes:{
    open:{lines:one('The Ward Office has ordered a workshop closed. Its workers gather signatures in the rain.'),
     choice:{prompt:'Choose your influence.',options:[
      {t:'Examine the legal notice',note:'Prepare a petition',tone:'prudent',goto:'draft',check:{domain:'study',difficulty:'standard',failGoto:'expired',
       successEffects:[I('ward_notice','Annotated notice','📃')]}},
      {t:'Rally the neighborhood',note:'Win supporters',tone:'kind',goto:'rally',check:{domain:'social',difficulty:'hard',failGoto:'expired'}},
      {t:'Seek a private exemption',note:'Faster, but costly',tone:'grey',goto:'exempt',check:{domain:'bureau',difficulty:'hard',failGoto:'expired'}},
       {t:'Decline to sign',note:'Guaranteed · no roll',tone:'grey',goto:'expired'}
     ]}},
    draft:{lines:one('You find a procedural error: the workshop never received a hearing.'),
     choice:{prompt:'File now?',options:[
      {t:'Submit the annotated notice',tone:'prudent',require:{item:'ward_notice'},goto:'reopened',
       check:{domain:'bureau',difficulty:'hard',item:'ward_notice',itemBonus:2,failGoto:'retaliation'}},
      {t:'Trade the evidence for protection',tone:'grey',goto:'exempt'}
     ]}},
    rally:{lines:one('A line of workers waits beneath the Ward Office windows.'),
     choice:{prompt:'What will they do?',options:[
      {t:'Demand an open hearing',tone:'kind',goto:'reopened',check:{domain:'social',difficulty:'standard',failGoto:'retaliation'}},
      {t:'Disperse before arrest',tone:'prudent',goto:'exempt'}
     ]}},
    reopened:ending('ward_reopened','THE DOORS REOPEN','An official hearing stops the closure order for now.',
      [S('relations',6),R(4),mem('ward_reopened','A community workshop secured a hearing.',.7)],'kind'),
    exempt:ending('ward_exempt','ONE SHOP SURVIVES','The workshop survives under a narrow exemption. Others do not.',
      [S('happiness',2),S('relations',-2),mem('ward_exempt','A selective concession spared one shop.',.1)],'grey'),
    retaliation:ending('ward_retaliation','A NAME ON THE LIST','The petition fails. The Bureau files your signature for future reference.',
      [R(12),S('happiness',-4),mem('ward_retaliation','A public petition drew official attention.',-.6)],'cold'),
    expired:ending('ward_expired','THE DEADLINE PASSES','The workshop is shuttered. The street keeps its memory.',
      [S('relations',-2),S('happiness',-5)],'grey')
   }};}
  },

  {id:'quest_ward_return',quest:true,followup:true,questTitle:'The Ward Remembers',questHint:'The Bureau has not forgotten last year.',
   questIcon:'🕯️',questArc:'BUREAU',domain:'bureau',cast(w){const a=lived(w,'quest_ward_petition');return a?[{key:'record',label:a.endingTitle,bind:a.endingId}]:null;},
   eligible:(w,s)=>adult(s)&&!!lived(w,'quest_ward_petition')&&w.year>lived(w,'quest_ward_petition').resolvedYear,
   build(bind){const id=bind.record.bind;return{title:'THE WARD REMEMBERS',bg:'office',scenes:{
    open:{lines:one(id==='ward_reopened'?'The promised hearing arrives. The workers ask you to testify.':
      id==='ward_retaliation'?'The Bureau sends another letter. A witness offers to help clear your name.':
      'The former workers ask you to help rebuild their network.'),
     choice:{prompt:'Do you reopen the file?',options:[
       {t:'Testify publicly',note:'High stakes',tone:'kind',goto:'cleared',check:{domain:'bureau',difficulty:'hard',item:'ward_notice',failGoto:'noticed'}},
       {t:'Keep organizing privately',tone:'prudent',goto:'organized',check:{domain:'social',difficulty:'standard',failGoto:'noticed'}},
       {t:'Walk away',tone:'cold',goto:'depart'}
     ]}},
    cleared:ending('ward_cleared','ON THE RECORD','The hearing accepts your testimony. An old accusation weakens.',[R(-10),S('relations',5)],'kind'),
    organized:ending('ward_organized','A QUIET NETWORK','The neighbors build support beyond the reach of a single hearing.',[S('relations',6),S('happiness',3)],'prudent'),
    noticed:ending('ward_noticed','TWO MORE FILES','The attempt fails, but support grows even under scrutiny.',[R(6),S('relations',2)],'grey'),
    depart:ending('ward_depart','THE DOOR CLOSES','The issue remains; you choose not to carry it any longer.',[R(-3),S('happiness',1)],'cold')
   }};}
  },

  {id:'quest_school_press',quest:true,questTitle:'The Secret Printing Press',questHint:'A classmate asks for help printing an underground paper.',
   questIcon:'📰',questArc:'SCHOOL',domain:'study',cast(){return[{key:'editor',label:'Student Editor'}];},
   eligible:(w,s)=>oldEnough(s)&&s.age<=25,
   build(){return{title:'THE SECRET PRINTING PRESS',bg:'schoolyard',scenes:{
    open:{lines:one('A student editor needs one more pair of hands to publish a school paper. The headmaster forbids the topic.'),
     choice:{prompt:'How do you help?',options:[
      {t:'Write the editorial',tone:'prudent',goto:'printed',check:{domain:'study',difficulty:'standard',failGoto:'revision',
       successEffects:[I('press_proof','Printer proof','📰')]}},
      {t:'Persuade the headmaster',tone:'kind',goto:'approved',check:{domain:'social',difficulty:'hard',failGoto:'revision'}},
      {t:'Print anonymously',note:'Risk being caught',tone:'grey',goto:'secret',check:{domain:'hustle',difficulty:'standard',failGoto:'caught'}},
       {t:'Leave the paper unwritten',note:'Guaranteed · no roll',tone:'grey',goto:'quiet'}
     ]}},
    revision:{lines:one('The first attempt fails. The typesetter leaves one blank column on the page.'),
     choice:{prompt:'You still have the press.',options:[
      {t:'Revise the story',tone:'prudent',goto:'approved',check:{domain:'study',difficulty:'easy',failGoto:'quiet'}},
      {t:'End the project',tone:'cold',goto:'quiet'}
     ]}},
    printed:ending('press_published','THE PAGE CIRCULATES','The student paper finds readers in every class.',[S('smarts',3),S('relations',3)],'kind'),
    approved:ending('press_approved','A PERMITTED VOICE','The paper prints with compromise and a careful signature.',[S('smarts',2),S('happiness',3)]),
    secret:ending('press_secret','INK AFTER MIDNIGHT','The paper appears without a name. Some readers start asking questions.',[S('happiness',4),R(3)],'grey'),
    caught:ending('press_caught','CONFISCATED TYPE','The presses are sealed. You learn what secrecy actually costs.',[R(8),S('happiness',-4)],'cold'),
    quiet:ending('press_quiet','A BLANK COLUMN','The edition never appears. A future writer may try again.',[S('happiness',-2)],'grey')
   }};}
  },

  {id:'quest_night_market',quest:true,questTitle:'Night Market Bargain',questHint:'An unusual offer tests your instincts and integrity.',
   questIcon:'🪙',questArc:'TRADE',domain:'trade',cast(){return[{key:'trader',label:'Night Vendor'}];},
   eligible:(w,s)=>adult(s)&&s.assets>=20,
   build(){return{title:'NIGHT MARKET BARGAIN',bg:'dock_night',scenes:{
    open:{lines:one('A night vendor offers a crate of tools at half price. The origin stamp has been scraped away.'),
     choice:{prompt:'An opportunity, or evidence?',options:[
      {t:'Inspect the crate',note:'Trade skill helps',tone:'prudent',goto:'marked',check:{domain:'hustle',skill:'retail',difficulty:'standard',failGoto:'baddeal',
       successEffects:[I('market_receipt','Original receipt','🧾')]}},
      {t:'Buy immediately',note:'$40 · no roll',tone:'greedy',require:{minAssets:40},effects:[M(-40)],goto:'profit'},
      {t:'Walk away and report it',note:'No purchase',tone:'kind',goto:'reported',check:{domain:'bureau',difficulty:'standard',failGoto:'followed'}},
       {t:'Walk past the stall',note:'Guaranteed · no roll',tone:'prudent',goto:'safe'}
     ]}},
    marked:{lines:one('The stamp matches a recent warehouse theft. You now hold the original receipt.'),
      choice:{prompt:'Decide what the receipt is worth.',options:[
       {t:'Return it to the owner',tone:'kind',goto:'returned',check:{domain:'social',difficulty:'easy',item:'market_receipt',failGoto:'followed'}},
       {t:'Sell the information',tone:'grey',goto:'profit',check:{domain:'hustle',difficulty:'hard',item:'market_receipt',failGoto:'baddeal'}},
       {t:'Leave quietly',tone:'prudent',goto:'safe'}
      ]}},
    returned:ending('market_returned','THE RIGHT OWNER','The stolen goods return. A merchant offers a modest reward.',[M(55),S('relations',4)],'kind'),
    profit:ending('market_profit','AN UNCERTAIN PROFIT','The deal pays today. Its origins remain difficult to explain.',[M(70),R(8),S('happiness',2)],'grey'),
    reported:ending('market_reported','A USEFUL TIP','Officials recover part of the shipment. Your name is not entered.',[S('relations',3),R(-2)]),
    followed:ending('market_followed','A LONG WALK HOME','Someone follows you through two alleys. You make it home safely, but shaken.',[S('health',-3),S('happiness',-4)],'cold'),
    baddeal:ending('market_baddeal','THE CRATE IS EMPTY','A costly lesson in the markets after dark.',[M(-20),S('happiness',-3)],'grey'),
    safe:ending('market_safe','NOT TONIGHT','You keep your money, and the knowledge of what you nearly bought.',[S('smarts',1)],'prudent')
   }};}
  }
 ];
 root.StoryEpisodes=(root.StoryEpisodes||[]).concat(episodes);
 root.StoryQuestCatalogue=Object.freeze(episodes.map(e=>Object.freeze({id:e.id,title:e.questTitle,arc:e.questArc})));
})(typeof globalThis!=='undefined'?globalThis:this);
