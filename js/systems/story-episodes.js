'use strict';

/* ================= KARSEN FILES: EPISODE SCRIPTS =================
 *
 * Hand-authored branching episodes in a visual-novel format. Each episode
 * is a tree of scenes; scenes contain spoken lines and, optionally, a
 * choice point; some scenes are endings. The EpisodeEngine in
 * story-system.js interprets this data; nothing here runs game logic --
 * consequences are declarative operation lists applied (and clamped) by
 * the engine through authoritative state.
 *
 * Line shape:      {sp:'<castKey>|narrator|you', t:'text'}
 * Choice point:    {prompt, options:[{t, note, tone, flag, goto, effects}]}
 * Ending scene:    {ending:{id,title,tone,epilogue:[lines],effects}}
 *
 * Cast binding: episode.cast(world,S,lineage) resolves the REAL people of
 * this life (partner contact, colleague from live contracts, kin child,
 * local fixer) into {key,label}. Eligibility gates on the same truth, so
 * episodes trigger because your life earns them -- never at random alone.
 */

(function(root){
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;

  /* ---- shared cast resolvers ---- */
  function partnerOf(S){
    if(!S||!Array.isArray(S.contacts)) return null;
    return S.contacts.find(c=>c&&(c.role==='spouse'||c.role==='partner')&&c.alive!==false)||null;
  }
  function friendOf(S){
    if(!S||!Array.isArray(S.contacts)) return null;
    return S.contacts.find(c=>c&&c.role==='friend'&&c.alive!==false)||null;
  }
  function motherOf(S){ return S&&S.mother&&S.mother.alive&&!S.mother.estranged?S.mother:null; }

  /* Small helper used by episode 9's cast binding. */
  function rngName(){
    const names=['Old','Young','Auntie','Widow'];
    return names[(typeof Random!=='undefined'&&Random.hashSeed?Random.hashSeed('novak'):3)%names.length];
  }
  function contractOf(world){
    try{ return root.EmploymentSystem&&root.EmploymentSystem.activeForPerson?root.EmploymentSystem.activeForPerson(world,'subject')[0]||null:null; }
    catch(e){ return null; }
  }
  function colleagueOf(world,S){
    const c=contractOf(world); if(!c) return null;
    try{
      const peers=root.EmploymentSystem.activeForBusiness(world,c.businessId)||[];
      const peer=peers.find(p=>p.personId!=='subject');
      if(!peer) return null;
      const npc=world.npcs&&world.npcs[peer.personId];
      return npc&&npc.alive!==false?{id:npc.id,name:npc.name}:null;
    }catch(e){ return null; }
  }
  function childrenOf(lineage,S){
    const members=lineage&&Array.isArray(lineage.members)?lineage.members:[];
    const year=(typeof World!=='undefined'&&World&&World.year)||0;
    return members.filter(m=>m&&m.alive!==false&&m.relation==='child'&&year-m.dob>=6&&year-m.dob<=16);
  }
  function fixerOf(world,settlementId){
    try{
      const list=root.SurvivalSystem&&root.SurvivalSystem.localFixers?root.SurvivalSystem.localFixers(world,settlementId):[];
      return list[0]||null;
    }catch(e){ return null; }

  }

  const EPISODES=[

  /* ================================================================
     EPISODE 1 — THE VOSS LETTER (a marriage, a sealed envelope)
     ================================================================ */
  {
    id:'ep_voss_letter',
    domain:'spouse',
    cast(world,S){
      const p=partnerOf(S); if(!p) return null;
      const f=friendOf(S);
      return [
        {key:'spouse',label:p.name,bind:p.cid},
        {key:'friend',label:f?f.name:'Old Halasz'}
      ];
    },
    eligible(world,S){
      const p=partnerOf(S);
      return !!(p&&S.married===true&&S.age>=20&&p.mood!=null&&p.mood<62);
    },
    weight(){ return 3; },
    build(bind){
      const sp=bind.spouse, fr=bind.friend;
      return {
      title:'THE '+String(sp.label.split(' ').pop()).toUpperCase()+' LETTER',
      bg:'night_flat',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'The flat after ten has its own weather. The radiator ticks like a slow clock. '+sp.label+' has gone down to the laundry room, and their coat — hung carelessly, for once — has a letter folded into the inner pocket.'},
            {sp:'narrator',t:'Heavy paper. A wax seal someone thought looked official. The return corner says only: COMMITTEE OF ADJUSTMENT, WARD 9.'},
            {sp:'you',t:'"Committee of Adjustment," you read, quietly. "Ward 9 doesn\'t adjust anything. Ward 9 makes lists."'}
          ],
          choice:{
            prompt:'The stairs creak. '+sp.label+' is coming back up.',
            options:[
              {t:'Hold the letter out. "Explain this."',note:'The direct road',tone:'prudent',flag:'confronted_direct',goto:'confront',effects:[{kind:'stat',stat:'smarts',delta:1}]},
              {t:'Slide it back, warm the kettle, say nothing.',note:'Some doors open inward',tone:'cold',flag:'stayed_silent',goto:'silent',effects:[]},
              {t:'Pocket it. Read it properly later, under the streetlamp.',note:'Knowledge first, faces second',tone:'greedy',flag:'took_letter',goto:'streetlamp',effects:[{kind:'scrutiny',delta:3}]}
            ]
          }
        },

        confront:{
          lines:[
            {sp:'narrator',t:sp.label+' stops on the top stair, a bundle of cold laundry against their chest, and sees the letter in your hand. Neither of you speaks. The radiator ticks twice.'},
            {sp:sp.key,t:'"It isn\'t what you think," they say — and then, quieter, which is worse: "All right. It is partly what you think."'},
            {sp:'you',t:'"Which part? The meetings in the back of the print shop, or the man from Ward 9 who writes to you like a cousin?"'}
          ],
          choice:{
            prompt:'Their eyes go to the window, then the door, then you.',
            options:[
              {t:'"Whatever it is, we face it together."',note:'The vow, tested tonight',tone:'kind',flag:'offered_hand',goto:'together_ending_path',effects:[{kind:'partnerMood',delta:10},{kind:'stat',stat:'happiness',delta:3}]},
              {t:'"You\'ll stop. Tonight. Or I walk to Ward 9 myself."',note:'An ultimatum, stamped',tone:'cold',flag:'issued_threat',goto:'ultimatum',effects:[{kind:'partnerMood',delta:-12},{kind:'scrutiny',delta:4}]},
              {t:'Sit down. "Start from the beginning. All of it."',note:'The long way around the table',tone:'prudent',flag:'demanded_truth',goto:'confession',effects:[{kind:'partnerMood',delta:5},{kind:'stat',stat:'smarts',delta:1}]}
            ]
          }
        },

        silent:{
          lines:[
            {sp:'narrator',t:'You are stirring tea when the door opens. '+sp.label+' hangs the coat, glances once at the pocket, once at you. Nothing in the room admits anything happened.'},
            {sp:sp.key,t:'"You\'re up late," they say, and the ordinariness of it is a kind of accusation aimed at nobody.'},
            {sp:'narrator',t:'Weeks pass the way water passes through cloth — slowly, and carrying things with it. The letter stays folded wherever you put it, learning your secrets by touch.'}
          ],
          choice:{
            prompt:'The silence has a price. Who pays it?',
            options:[
              {t:'Leave it be. Married people are allowed one sealed room each.',note:'Peace, mortgaged',tone:'cold',flag:'permanent_silence',goto:'ending_coldpeace',effects:[{kind:'partnerMood',delta:-4}]},
              {t:'Ask '+fr.label+' what the Committee of Adjustment is.',note:'Friends know ward gossip',tone:'prudent',flag:'asked_friend',goto:'friend_intel',effects:[{kind:'contactMood',cid:fr.bind,delta:5},{kind:'stat',stat:'smarts',delta:1}]}
            ]
          }
        },

        streetlamp:{
          lines:[
            {sp:'narrator',t:'Under the streetlamp, with your breath hanging in front of you, you read it properly. It is not love letters. It is worse and better at once: receipts. Dues paid monthly to a mutual-aid fund — the kind the Ministry banned two winters ago and half the district still pays into anyway.'},
            {sp:'narrator',t:'At the bottom, in pencil: "Dues owed: 40. The Committee remembers its friends."'},
            {sp:'you',t:'"Forty marks of trouble," you tell the lamplight. "Cheaper than most."'}
          ],
          choice:{
            prompt:'Now you know. Knowing is the expensive part.',
            options:[
              {t:'Pay the dues yourself, anonymously, and burn the letter.',note:'Love, laundered',tone:'kind',flag:'paid_secretly',goto:'ending_renewal',effects:[{kind:'money',delta:-40},{kind:'partnerMood',delta:8}]},
              {t:'Confront them tomorrow, calmly, with the facts.',note:'Armed, not angry',tone:'prudent',flag:'armed_talk',goto:'confession',effects:[{kind:'stat',stat:'smarts',delta:1}]},
              {t:'Keep the letter. Leverage is leverage.',note:'A drawer with teeth',tone:'greedy',flag:'kept_leverage',goto:'ending_leverage',effects:[{kind:'stat',stat:'smarts',delta:2},{kind:'stat',stat:'happiness',delta:-2}]}
            ]
          }
        },

        friend_intel:{
          lines:[
            {sp:'narrator',t:fr.label+' hears the name Committee of Adjustment and sets down their glass very carefully, the way people set down things that might go off.'},
            {sp:'friend',t:'"It\'s the aid fund. The one that isn\'t supposed to exist. Half the tram drivers pay into it — my brother-in-law, your neighbor with the dog. It\'s not sedition, it\'s... neighbors." A pause. "But Ward 9 likes to call things whatever gets them promoted."'},
            {sp:fr.key,t:'"If it were my house," they add, "I\'d rather hear it from my own spouse than the Ministry."'}
          ],
          goto:'confession'
        },

        confession:{
          lines:[
            {sp:sp.key,t:'"It\'s the fund," '+sp.label+' says at last, hands flat on the table like a student at a hearing. "Everyone from the works pays in. When Osip\'s lung gave out, the fund paid the doctor. Nobody was making speeches."'},
            {sp:sp.key,t:'"I didn\'t tell you because you\'d worry. And because saying it aloud makes it real." A breath. "There. Now it\'s real."'},
            {sp:'narrator',t:'The radiator ticks. Somewhere below, a tram sighs around the corner, carrying people home to their own sealed rooms.'}
          ],
          choice:{
            prompt:'This is the moment the marriage is made of.',
            options:[
              {t:'"Then we pay the dues together. And you never carry this alone again."',note:'Two signatures, one life',tone:'kind',flag:'joined_fund',goto:'ending_renewal',effects:[{kind:'partnerMood',delta:16},{kind:'familyMood',delta:5},{kind:'money',delta:-40},{kind:'memory',type:'vow_renewed',valence:.8,intensity:.7,summary:'Subject and '+sp.label+' faced the secret fund together and chose each other.'}]},
              {t:'"Never again without telling me. Swear it properly."',note:'Trust, on probation',tone:'prudent',flag:'conditional_pardon',goto:'ending_coldpeace',effects:[{kind:'partnerMood',delta:6},{kind:'memory',type:'trust_probation',valence:.25,intensity:.45,summary:'Subject forgave '+sp.label+'\'s secret fund — with conditions attached.'}]},
              {t:'"You lied every month for a year. I don\'t know who sleeps beside me."',note:'The door, held open',tone:'cold',flag:'withdrew',goto:'ending_betrayal',effects:[{kind:'partnerMood',delta:-20},{kind:'stat',stat:'happiness',delta:-4},{kind:'memory',type:'marriage_wound',valence:-.6,intensity:.7,summary:'Subject called '+sp.label+' a stranger over the secret fund.'}]}
            ]
          }
        },

        ultimatum:{
          lines:[
            {sp:'narrator',t:'The word "Ward 9" lands between you like a dropped iron. '+sp.label+' goes very still, the way the honest do when the dishonesty of the world arrives wearing uniforms.'},
            {sp:sp.key,t:'"You would inform on me." Not a question. An inventory. "Twelve years, and you would file me."'},
            {sp:'narrator',t:'They take their coat from the hook — the coat, with its empty pocket now — and stand in the doorway long enough for you to stop them. The lamp behind them makes a halo of the crack in the plaster.'}
          ],
          choice:{
            prompt:'The doorway is narrow. Only one of you fits through it unchanged.',
            options:[
              {t:'Take their hand off the latch. "I\'m sorry. Stay."',note:'Pride, abandoned at the pass',tone:'kind',flag:'retracted',goto:'confession',effects:[{kind:'partnerMood',delta:12},{kind:'stat',stat:'happiness',delta:2}]},
              {t:'Say nothing. Let the door teach its lesson.',note:'Silence, weaponized',tone:'cold',flag:'let_walk',goto:'ending_betrayal',effects:[{kind:'partnerMood',delta:-15},{kind:'stat',stat:'happiness',delta:-6}]}
            ]
          }
        },

        together_ending_path:{
          lines:[
            {sp:'narrator',t:'Something unclenches in '+sp.label+'\'s shoulders — the specific loosening of a person who has been carrying a bucket of water in each hand for a year and is finally allowed to set one down.'},
            {sp:sp.key,t:'"Together," they repeat, tasting it. "You have no idea how long I\'ve wanted to be told that by somebody who wasn\'t being watched when they said it."'}
          ],
          goto:'confession'
        },

        ending_renewal:{
          ending:{
            id:'renewal',title:'WHAT THE LETTER WAS FOR',tone:'kind',
            epilogue:['The dues were paid on the first of the month, both names on the receipt, which is not how the fund does things but is how marriages should.','Years on, '+sp.label+' will still take your hand in crowds sometimes — thumb pressed twice against your knuckles, the old signal: together, together.'],
            effects:[{kind:'partnerMood',delta:18},{kind:'stat',stat:'happiness',delta:6},{kind:'memory',type:'episode_voss_renewal',valence:.85,intensity:.8,summary:'THE VOSS LETTER ended in renewal: the secret fund became a thing they carried side by side.'}]
          }
        },

        ending_coldpeace:{
          ending:{
            id:'cold_peace',title:'A COLD PEACE, PROPERLY FILED',tone:'prudent',
            epilogue:['You did not inform, and you did not join, and the marriage resumed its shape the way a dented pot still boils.','Some nights the word "Committee" crosses '+sp.label+'\'s face like a shadow under a door. You let it pass. Most of love is letting it pass.'],
            effects:[{kind:'partnerMood',delta:2},{kind:'stat',stat:'happiness',delta:-2},{kind:'memory',type:'episode_voss_coldpeace',valence:.1,intensity:.5,summary:'THE VOSS LETTER ended in a cold peace: truths managed, not mended.'}]
          }
        },

        ending_betrayal:{
          ending:{
            id:'betrayal',title:'THE SEPARATE SHELVES',tone:'cold',
            epilogue:[''+sp.label+' moved to their sister\'s in the New Quarter "temporarily," a word that settled in like furniture.','The divorce papers come through channels, grey and correct. In Column 14, where the form asks for cause, somebody types: IRRECONCILABLE FILES.'],
            effects:[{kind:'partnerMood',delta:-30},{kind:'stat',stat:'happiness',delta:-10},{kind:'marriageEnd',status:'Divorced'},{kind:'memory',type:'episode_voss_betrayal',valence:-.75,intensity:.85,summary:'THE VOSS LETTER ended in separation: the secret fund was the wedge, the silence the hammer.'}]
          }
        },

        ending_leverage:{
          ending:{
            id:'leverage',title:'THE DRAWER WITH TEETH',tone:'greedy',
            epilogue:['The letter lives in the drawer under the false bottom, and it is amazing how agreeable a household becomes when one drawer has teeth.','You tell yourself it is protection. The drawer agrees. Drawers are famous for agreeing.'],
            effects:[{kind:'partnerMood',delta:-8},{kind:'stat',stat:'happiness',delta:-4},{kind:'stat',stat:'smarts',delta:1},{kind:'scrutiny',delta:5},{kind:'memory',type:'episode_voss_leverage',valence:-.4,intensity:.6,summary:'THE VOSS LETTER ended with Subject keeping '+sp.label+'\'s secret as leverage.'}]
          }
        }
      }};
    }
  },

  /* ================================================================
     EPISODE 2 — THE FOUNDRY FOREMAN (a ledger, an inspector, a choice)
     ================================================================ */
  {
    id:'ep_foreman_ledger',
    domain:'work',
    cast(world,S){
      const col=colleagueOf(world,S); if(!col) return null;
      return [{key:'foreman',label:'Foreman Brakke'},{key:'mate',label:col.name,bind:col.id}];
    },
    eligible(world,S){
      if(S.age<18||S.age>64) return false;
      const c=contractOf(world); if(!c) return false;
      try{
        const b=root.BusinessSystem.get(world,c.businessId);
        const stressed=c.workplace&&c.workplace.stress>0.55;
        return !!b&&(b.status==='struggling'||stressed);
      }catch(e){ return false; }
    },
    weight(){ return 3; },
    build(bind){
      const fm=bind.foreman, mate=bind.mate;
      return {
      title:'THE THURSDAY LEDGER',
      bg:'factory_floor',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'Thursday, second shift. The foundry exhales its heat through the roof vents, and Foreman Brakke finds you at the coolant pumps with a ledger under his arm and a smile that has been rehearsed in front of a mirror.'},
            {sp:fm.key,t:'"Good news and bad news." He taps the ledger. "Inspection Friday. Bad news: the safety column for March got... creative. My fault, mostly. Good news: you have steady hands and no witnesses."'},
            {sp:'you',t:'"Those are both bad news, Foreman."'},
            {sp:fm.key,t:'"See, that\'s why you\'re my favorite." He sets the pen down between you like a dare. "Fix March, and April writes itself. Everyone keeps their jobs. Everybody\'s a winner."'},
            {sp:'narrator',t:'Across the floor, '+mate.label+' catches your eye over a sheet of bending tin — and looks away too carefully.'}
          ],
          choice:{
            prompt:'The pen sits there. The shift whistle is eleven minutes out.',
            options:[
              {t:'Take the pen. Fix March.',note:'The machine eats one more page',tone:'greedy',flag:'forged',goto:'forged',effects:[{kind:'stat',stat:'smarts',delta:1},{kind:'scrutiny',delta:4}]},
              {t:'"No. Report it yourself, tonight, in writing."',note:'The clean road, uphill',tone:'prudent',flag:'refused_report',goto:'reported_self',effects:[{kind:'stat',stat:'relations',delta:2}]},
              {t:'Say nothing tonight. Warn '+mate.label+' instead.',note:'Solidarity, quietly',tone:'kind',flag:'warned_mate',goto:'warned',effects:[{kind:'npcBond',npcId:mate.bind,delta:12}]}
            ]
          }
        },

        forged:{
          lines:[
            {sp:'narrator',t:'March acquires a better memory. Your hand is steady because your hands are always steady, and that is suddenly a terrible thing to know about yourself.'},
            {sp:'narrator',t:'Friday\'s inspector is a gray woman who reads columns like weather. She nods at March, smiles at April, and pauses — one beat too long — on your initials in the margin. Then she moves on.'},
            {sp:fm.key,t:'(that evening, pressing a folded banknote into your pocket) "For the missus. Don\'t argue, it\'s tradition."'}
          ],
          choice:{
            prompt:'The banknote is warm from his pocket. The month is cold.',
            options:[
              {t:'Keep it. A wage is a wage; paper is paper.',note:'Complicity, salaried',tone:'greedy',flag:'kept_blood_money',goto:'ending_blackmail',effects:[{kind:'money',delta:120},{kind:'stat',stat:'happiness',delta:-3}]},
              {t:'Refuse it. "I fixed the page. I don\'t want pay for it."',note:'Lines, drawn thin',tone:'prudent',flag:'refused_money',goto:'foreman_respect',effects:[{kind:'stat',stat:'relations',delta:2}]}
            ]
          }
        },

        reported_self:{
          lines:[
            {sp:'narrator',t:'Brakke reads your written report Friday morning and ages a fiscal quarter in silence. The inspector reads it Friday afternoon and writes three lines in her own book, none of them about safety columns.'},
            {sp:fm.key,t:'"You hung me with my own ledger." He almost sounds impressed, which is somehow worse than anger. "Well. Some men sleep well. I hope you\'re one of them."'},
            {sp:'narrator',t:'The section runs Monday with a new foreman and the same old noise. March stays ugly in the record — and true, which is the entire point of records.'}
          ],
          goto:'verdict'
        },

        warned:{
          lines:[
            {sp:'narrator',t:'You catch '+mate.label+' at the coat racks. "Friday\'s inspection. March is rewritten. Don\'t sign anything near it, and check your own tickets."'},
            {sp:mate.key,t:'"...You\'re serious." A long look toward the office glass, where Brakke\'s silhouette pretends to read. "Right. Right. There are others I should — the Tuesday crew, at least."'},
            {sp:'narrator',t:'By end of shift, the warning has traveled the floor the way warnings do: silently, completely, attached to no names. Friday, the inspector finds a ledger everyone quotes verbatim and nobody signs blind.'}
          ],
          choice:{
            prompt:'Brakke summons you Saturday. His door is open; his jaw is set.',
            options:[
              {t:'"The floor protects itself. Learn to work inside that."',note:'The floor, united',tone:'kind',flag:'stood_united',goto:'ending_solidarity',effects:[{kind:'npcBond',npcId:mate.bind,delta:8}]},
              {t:'Apologize for overstepping. A foreman is a foreman.',note:'Bend, survive',tone:'cold',flag:'backed_down',goto:'verdict',effects:[{kind:'stat',stat:'happiness',delta:-2}]}
            ]
          }
        },

        foreman_respect:{
          lines:[
            {sp:fm.key,t:'Brakke looks at the refused banknote a long moment, then pockets it slowly. "Steady hands and standards. Your father must be a disappointed saint." He almost laughs. "Fine. March stays ugly. But I owe you — and I hate owing."'}
          ],
          goto:'verdict'
        },

        verdict:{
          lines:[
            {sp:'narrator',t:'Monday brings the verdicts that offices hand down instead of judgments. The foundry hums. Life, indifferent to ledgers, continues at nine gross per minute.'}
          ],
          choice:{
            prompt:'How does the subject carry what Thursday taught them?',
            options:[
              {t:'Head up. The record is clean and so are your hands.',note:'Intact, all parts',tone:'prudent',flag:'clean_exit',goto:'ending_clean',effects:[]},
              {t:'Ask for the vacant shift-lead badge.',note:'Ambition, unstained',tone:'greedy',flag:'asked_promotion',goto:'ending_promotion',effects:[]}
            ]
          }
        },

        ending_blackmail:{
          ending:{
            id:'blackmail',title:'THE PAGE THAT REMEMBERS',tone:'greedy',
            epilogue:['The money was good. The silence was better, and cheaper, and lasted exactly as long as Brakke needed it to.','Months later, when the foundry\'s numbers sag again, a copy of March — your initials, your hand — surfaces in a folder marked POTENTIAL IRREGULARITIES. Brakke never threatens. Brakke files.'],
            effects:[{kind:'money',delta:180},{kind:'stat',stat:'happiness',delta:-6},{kind:'scrutiny',delta:10},{kind:'record',value:true},{kind:'memory',type:'episode_forge_blackmail',valence:-.5,intensity:.7,summary:'THE THURSDAY LEDGER ended in blackmail: Subject\'s forged March came back with interest.'}]
          }
        },

        ending_promotion:{
          ending:{
            id:'promotion',title:'SHIFT LEAD, WITH MARGINS',tone:'prudent',
            epilogue:['The badge is brass and the raise is modest and neither is the point. The point is what the floor saw: a worker who would not forge a page and would not sell a mate.','Brakke transfers out by summer. His replacement asks you, privately, how inspections really work here. You tell her the truth, at length, and the floor notices that too.'],
            effects:[{kind:'stat',stat:'happiness',delta:8},{kind:'jobRaise',amount:220},{kind:'npcBond',npcId:mate.bind,delta:6},{kind:'memory',type:'episode_forge_promotion',valence:.65,intensity:.7,summary:'THE THURSDAY LEDGER ended in promotion: honesty turned out to be a career strategy.'}]
          }
        },

        ending_dismissed:{
          ending:{
            id:'dismissed',title:'DISMISSED, WITH REFERENCES WITHHELD',tone:'cold',
            epilogue:['"Consolidation," the letter says. The foundry\'s way of spelling revenge. Your tools come home in the same bag; the bag feels heavier by the third tram stop.','Brakke holds the door open himself. "Give my best to March," he says, and smiles his rehearsed smile.'],
            effects:[{kind:'jobEnd',reason:'consolidation',tone:'terminated'},{kind:'stat',stat:'happiness',delta:-8},{kind:'memory',type:'episode_forge_dismissed',valence:-.6,intensity:.7,summary:'THE THURSDAY LEDGER ended in dismissal: Subject refused to forge, and Foreman Brakke remembered.'}]
          }
        },

        ending_clean:{
          ending:{
            id:'clean',title:'CLEAN HANDS, QUIET YEAR',tone:'prudent',
            epilogue:['Nothing glittering happens. That is the reward: a year with no folder marked POTENTIAL IRREGULARITIES, no favors accruing in drawers, no initials in margins that might grow teeth.','On the tram home you realize the whistles sound different when you haven\'t helped anyone lie. Higher, somehow.'],
            effects:[{kind:'stat',stat:'happiness',delta:4},{kind:'stat',stat:'health',delta:1},{kind:'memory',type:'episode_forge_clean',valence:.4,intensity:.5,summary:'THE THURSDAY LEDGER ended quietly: Subject kept their hands clean and their year calm.'}]
          }
        },

        ending_solidarity:{
          ending:{
            id:'solidarity',title:'THE TUESDAY CREW REMEMBERS',tone:'kind',
            epilogue:['Brakke transfers out by spring — "for health reasons," meaning the floor\'s health, meaning its opinion.','For years afterward, Tuesday crew men nod to you at the gate, and once, unforgettably, somebody\'s kid calls you "the one who warned the coats." Legends on a foundry floor are small, and permanent.'],
            effects:[{kind:'stat',stat:'happiness',delta:6},{kind:'stat',stat:'relations',delta:4},{kind:'npcBond',npcId:mate.bind,delta:10},{kind:'memory',type:'episode_forge_solidarity',valence:.75,intensity:.7,summary:'THE THURSDAY LEDGER ended in solidarity: the floor stood together, and Brakke left.'}]
          }
        }
      }};
    }
  },

  /* ================================================================
     EPISODE 3 — THE ORPHAN'S TALENT (a child, a theft, a future)
     ================================================================ */
  {
    id:'ep_orphan_talent',
    domain:'child',
    cast(world,S,lineage){
      const kids=childrenOf(lineage,S);
      if(!kids.length) return null;
      const k=kids[0];
      return [{key:'child',label:k.first||'the child',bind:k.mid,npcId:k.npcId}];
    },
    eligible(world,S,lineage){
      if(S.age<24) return false;
      return !!childrenOf(lineage,S).length;
    },
    weight(){ return 3; },
    build(bind){
      const ch=bind.child;
      return {
      title:'THE ARITHMETIC OF BREAD',
      bg:'schoolyard',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'The schoolmaster\'s note is brief and smells of ink discipline. '+ch.label+' was caught at the bakery counter: three rolls in a satchel, no coin. Caught, moreover, brilliantly — a sleight worthy of a fairground — which the master notes with something dangerously close to admiration.'},
            {sp:'narrator',t:'At home, the satchel sits on the table between you. '+ch.label+' stands at parade rest, chin up, eyes wet, refusing absolutely to cry.'},
            {sp:ch.key,t:'"They throw away the end-of-day rolls anyway. I did the sums. Waste versus hunger. My arithmetic is right, Papa—" a catch, "—the arithmetic is RIGHT, only the bread isn\'t ours."'}
          ],
          choice:{
            prompt:'The satchel sits between you like an exam paper.',
            options:[
              {t:'"Show me the sums." Work the problem together — then repay the baker.',note:'Rigor, plus amends',tone:'prudent',flag:'did_sums',goto:'sums',effects:[{kind:'money',delta:-15},{kind:'familyMood',delta:6}]},
              {t:'"Stealing is stealing. You apologize tomorrow, in front of the shop."',note:'The hard, clean lesson',tone:'cold',flag:'forced_apology',goto:'apology',effects:[{kind:'familyMood',delta:-3}]},
              {t:'Say nothing about the shop. Ask instead what else those clever hands can do.',note:'A talent, redirected',tone:'kind',flag:'redirected',goto:'talent',effects:[{kind:'familyMood',delta:4}]}
            ]
          }
        },

        sums:{
          lines:[
            {sp:'narrator',t:'The sums are immaculate. Waste: forty rolls weekly. Hunger: present. Risk of capture: underestimated, you note, and '+ch.label+' concedes the variable with a scholar\'s grimace.'},
            {sp:'narrator',t:'At the bakery, your coin repays the rolls and your presence signs for the sin. The baker, a widower with flour in his eyebrows, watches '+ch.label+' recalculate his change unprompted — and slides a battered exercise book across the counter. "My late boy\'s," he says. "Numbers want owners."'}

          ],
          goto:'branch_point'
        },

        apology:{
          lines:[
            {sp:'narrator',t:'Tomorrow, in front of God, the baker, and two sniggering shopgirls, '+ch.label+' delivers an apology of perfect formal correctness — spine straight, voice level, dying inside by degrees.'},
            {sp:'narrator',t:'The baker accepts gravely, waives payment, and adds, terribly: "Good posture. Pity about the vocation." '+ch.label+' says nothing the whole way home, and that night studies arithmetic until the lamp gutters.'}
          ],
          goto:'branch_point'
        },

        talent:{
          lines:[
            {sp:ch.key,t:'The list, produced from the satchel\'s second pocket, is alarming in scope: card counting at the Sunday market, lock difficulty ratings for every shed on Kessel Row, "the tram inspectors\' rotation (incomplete)."'},
            {sp:'you',t:'"These are criminal\'s notes." A pause. "Very well-organized criminal\'s notes."'},
            {sp:'narrator',t:'But underneath the larceny sits something rarer: a mind that cannot leave numbers alone. The question is what pond you throw it into.'}
          ],
          goto:'branch_point'
        },

        branch_point:{
          lines:[
            {sp:'narrator',t:'Weeks later, a flyer comes home in the satchel, official cream paper among the rough sheets: the District Mathematics Prize. Examination in spring. Winner takes a scholarship, a plaque, and the attention of people whose attention has edges.'}
          ],
          choice:{
            prompt:'Talent wants a direction. Choose the wind.',
            options:[
              {t:'Enter the prize. Study like it\'s a job — because it is.',note:'Legitimate doors, forced open',tone:'prudent',flag:'entered_prize',goto:'ending_scholar',effects:[{kind:'money',delta:-60},{kind:'familyMood',delta:8}]},
              {t:'Apprentice them to the bookkeeper at the co-op instead.',note:'Safe trade, sharp mind',tone:'kind',flag:'apprenticed',goto:'ending_bookkeeper',effects:[{kind:'money',delta:-30},{kind:'familyMood',delta:5}]},
              {t:'Let the streets finish the education they started.',note:'The school with no lamps',tone:'greedy',flag:'streets_finished',goto:'ending_streets',effects:[{kind:'familyMood',delta:-6}]}
            ]
          }
        },

        ending_scholar:{
          ending:{
            id:'scholar',title:'FIRST IN THE DISTRICT',tone:'prudent',
            epilogue:['Spring: '+ch.label+' places first, and the examiners\' letter uses the word "exceptional" twice, which examiners ration like sugar.','The plaque goes over the stove because that is where the light is. Sometimes at dinner, unprompted, '+ch.label+' explains some beautiful useless theorem with total sincerity, and the whole table is briefly richer.'],
            effects:[{kind:'familyMood',delta:14},{kind:'stat',stat:'happiness',delta:8},{kind:'memory',type:'episode_orphan_scholar',participants:[ch.npcId].filter(Boolean),valence:.85,intensity:.8,summary:'THE ARITHMETIC OF BREAD ended in scholarship: '+ch.label+' took first in the district.'}]
          }
        },

        ending_bookkeeper:{
          ending:{
            id:'bookkeeper',title:'THE CO-OP\'S SHARPEST COLUMNS',tone:'kind',
            epilogue:['By winter '+ch.label+' balances the co-op books faster than the man they apprenticed under, and the man says so loudly, at the tavern, to anyone holding a glass.','It is not a plaque. It is steadier than one. Every fortnight there are wages; every ledger, a future with margins.'],
            effects:[{kind:'familyMood',delta:10},{kind:'money',delta:120},{kind:'memory',type:'episode_orphan_bookkeeper',participants:[ch.npcId].filter(Boolean),valence:.7,intensity:.65,summary:'THE ARITHMETIC OF BREAD ended in trade: '+ch.label+' became the co-op\'s youngest bookkeeper.'}]
          }
        },

        ending_streets:{
          ending:{
            id:'streets',title:'NUMBERS THAT STAY OUT LATE',tone:'greedy',
            epilogue:['The streets were always going to claim the sharpest tool in the drawer. By fifteen '+ch.label+' knows every dice game\'s weakness and every watchman\'s supper hour.','The money comes home irregular and generous. So do the bruises, eventually, and once — a night you do not ask about — a silence.'],
            effects:[{kind:'familyMood',delta:-10},{kind:'money',delta:200},{kind:'stat',stat:'happiness',delta:-5},{kind:'memory',type:'episode_orphan_streets',participants:[ch.npcId].filter(Boolean),valence:-.4,intensity:.7,summary:'THE ARITHMETIC OF BREAD ended in the streets: '+ch.label+'\'s gifts went to work after dark.'}]
          }
        },

        ending_honesty:{
          ending:{
            id:'honesty',title:'THE HARD LESSON, PROPERLY LEARNED',tone:'cold',
            epilogue:[''+ch.label+' hates you for a season, thoroughly and at volume, exactly as designed.','And years later, managing other people\'s money with unbending precision, they will tell the story themselves — the stolen rolls, the public apology, the parent who chose their character over their affection. The telling is always gentle. The debt was paid early.'],
            effects:[{kind:'familyMood',delta:4},{kind:'stat',stat:'happiness',delta:2},{kind:'memory',type:'episode_orphan_honesty',participants:[ch.npcId].filter(Boolean),valence:.45,intensity:.6,summary:'THE ARITHMETIC OF BREAD ended in a hard lesson: '+ch.label+' apologized in public and grew straight.'}]
          }
        }
      }};
    }
  },

  /* ================================================================
     EPISODE 5 — MOTHER'S SILENCE (the letters stopped)
     ================================================================ */
  {
    id:'ep_mother_silence',
    domain:'family',
    cast(world,S){
      const m=motherOf(S); if(!m) return null;
      return [{key:'mother',label:m.name||'Mother'}];
    },
    eligible(world,S){ return !!motherOf(S)&&S.age>=16; },
    weight(){ return 2.5; },
    build(bind,rng){
      const m=bind.mother;
      const sum=rng?rng.int(120,260):180;
      return {
      title:'NO LETTER THIS MONTH',
      bg:'office',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'The envelope arrives on a Tuesday, franked with the Bureau\'s grey thumb. Not '+m.label+'\'s looping hand — the Ministry\'s. Inside, one sheet: NOTICE OF ASSESSED DEPENDENCY. Your name is in the "responsible party" column.'},
            {sp:'you',t:'"Responsible party." Mother has been telling the Bureau I support her. Which would be touching, if she were not also — you do the sums twice — quietly short of rent for three months.'}
          ],
          choice:{
            prompt:'The form wants an answer by Friday. Mother\'s telephone wants it sooner.',
            options:[
              {t:'Call her tonight. Ask nothing on the phone; just say "I\'m coming Sunday."',note:'Questions travel badly on wires',tone:'prudent',flag:'visited',goto:'visit',effects:[]},
              {t:'Pay what the form demands, and let her keep her pride.',note:'Money as tact',tone:'kind',flag:'paid_quietly',goto:'ending_paidquiet',effects:[{kind:'money',delta:-sum}]},
              {t:'Write back correcting the record. She must not lie to the Bureau.',note:'Accuracy first',tone:'cold',flag:'corrected_record',goto:'ending_correction',effects:[{kind:'scrutiny',delta:2}]}
            ]
          }
        },

        visit:{
          lines:[
            {sp:'narrator',t:'Her flat is smaller than memory keeps insisting. The good clock is gone from the mantel; there is a receipt nail where it used to hang. She makes tea like nothing is owed anywhere in the world.'},
            {sp:'mother',t:'"The Bureau likes its forms," she says. "And I like my son un-worried. Between those two appetites, somebody was always going to tell a fib."'},
            {sp:'mother',t:'"I sold the clock because your father\'s lungs needed proper medicine that winter, and because you were nineteen and proud and I could not—" The sentence finds somewhere else to be.'}
          ],
          choice:{
            prompt:'The tea goes cold between you, which is traditional.',
            options:[
              {t:'"Move the worry to my table. Permanently."',note:'Room made, room kept',tone:'kind',flag:'took_her_in',goto:'ending_tookin',effects:[{kind:'money',delta:-sum/2},{kind:'parentMood',which:'mother',delta:18},{kind:'familyMood',delta:8}]},
              {t:'Set up a standing order — hers to spend, yours to bleed.',note:'Dignity at distance',tone:'prudent',flag:'standing_order',goto:'ending_standing',effects:[{kind:'money',delta:-Math.round(sum*0.6)},{kind:'parentMood',which:'mother',delta:10}]},
              {t:'"No more lies to clerks, Ma. Even kind ones."',note:'A boundary, lovingly',tone:'cold',flag:'boundary_set',goto:'ending_boundary',effects:[{kind:'parentMood',which:'mother',delta:4}]}
            ]
          }
        },

        ending_paidquiet:{
          ending:{
            id:'paidquiet',title:'PAID, AND UNSAID',tone:'kind',
            epilogue:['The Bureau stamps ACCEPTED. Somewhere across town a woman burns your correction of her arithmetic and calls it filial piety.','You never speak of it. Every family is built on exactly one such silence, load-bearing.'],
            effects:[{kind:'parentMood',which:'mother',delta:8},{kind:'memory',type:'episode_mother_paidquiet',valence:.5,intensity:.5,summary:'NO LETTER THIS MONTH ended paid and unsaid: Subject covered '+m.name+'\'s debts without a word.'}]
          }
        },

        ending_correction:{
          ending:{
            id:'correction',title:'THE RECORD, SET STRAIGHT',tone:'cold',
            epilogue:['Your letter is precise, courteous, and devastating. The dependency claim dissolves; so, for a while, does something in her weekly calls — shorter now, brighter performed.','The Bureau thanks you for your accuracy. Accuracy has never once thanked anybody back.'],
            effects:[{kind:'parentMood',which:'mother',delta:-12},{kind:'stat',stat:'happiness',delta:-3},{kind:'memory',type:'episode_mother_correction',valence:-.35,intensity:.55,summary:'NO LETTER THIS MONTH ended in corrections: Subject chose the record over '+m.name+'\'s pride.'}]
          }
        },

        ending_tookin:{
          ending:{
            id:'tookin',title:'ANOTHER CHAIR AT THE TABLE',tone:'kind',
            epilogue:['She arrives with two suitcases and the replacement clock, which she pretends is the original, which everyone permits.','The flat learns her footsteps. The children learn her stories have second, longer editions. It costs, all of it, and the arithmetic finally works for everybody.'],
            effects:[{kind:'memory',type:'episode_mother_tookin',valence:.75,intensity:.75,summary:'NO LETTER THIS MONTH ended under one roof: Subject took '+m.name+' in.'}]
          }
        },

        ending_standing:{
          ending:{
            id:'standing',title:'THE STANDING ORDER',tone:'prudent',
            epilogue:['First of every month, the bank moves the sum before breakfast, like weather.','She signs her letters the same as ever. Only the postscript changes, once a year, on the anniversary of the form: "Still solvent. Still proud of you. Stop worrying."'],
            effects:[{kind:'memory',type:'episode_mother_standing',valence:.45,intensity:.5,summary:'NO LETTER THIS MONTH ended in a quiet standing order to '+m.name+'.'}]
          }
        },

        ending_boundary:{
          ending:{
            id:'boundary',title:'LOVE WITH A LEDGER LINE',tone:'cold',
            epilogue:['She agrees to honesty the way people agree to diets — sincerely, until tempted.','But the letters change too: no more fiction in either direction. What comes now is true, small, and addressed in her real hand. It turns out that was the currency you actually missed.'],
            effects:[{kind:'parentMood',which:'mother',delta:6},{kind:'stat',stat:'happiness',delta:1},{kind:'memory',type:'episode_mother_boundary',valence:.25,intensity:.45,summary:'NO LETTER THIS MONTH ended in boundaries: truth over comfort with '+m.name+'.'}]
          }
        }
      }};
    }
  },

  /* ================================================================
     EPISODE 6 — FATHER'S HANDS (a trade, an inheritance of skill)
     ================================================================ */
  {
    id:'ep_father_hands',
    domain:'family',
    cast(world,S){
      const f=fatherOf(S); if(!f) return null;
      return [{key:'father',label:f.name||'Father'}];
    },
    eligible(world,S){
      const f=fatherOf(S);
      return !!f&&S.age>=17&&S.age<=50&&!!(S.mother===null||true);
    },
    weight(){ return 2.5; },
    build(bind,rng){
      const f=bind.father;
      const yearsWorked=rng?rng.int(28,44):36;
      return {
      title:''+yearsWorked+' YEARS IN THE HANDS',
      bg:'factory_floor',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'He summons you to the shed behind the old house, where the smell of oil and iron filings has been constant since before you had words for either. On the bench: his tools, wrapped in flannel like surgery.'},
            {sp:'father',t:'"'+yearsWorked+' years," he says, unwrapping them one by one. "Every nick on this handle is a lesson somebody paid for. My father left me these hands\u2019 worth of judgment. I intend to leave you mine \u2014 properly, before the tremor takes the option off the table."'},
            {sp:'father',t:'One condition. A year at my bench, evenings, no excuses. The trade doesn\'t live in books, and it doesn\'t share a man with ambitions."'}
          ],
          choice:{
            prompt:'The tools wait. So does he, worse than the tools.',
            options:[
              {t:'Take the year. The bench gets your evenings.',note:'Inheritance, earned hourly',tone:'kind',flag:'took_year',goto:'year_bench',effects:[{kind:'stat',stat:'health',delta:-2},{kind:'parentMood',which:'father',delta:15}]},
              {t:'"Teach me the judgment, Pa — Sundays only. My ladder needs climbing too."',note:'Both ladders',tone:'prudent',flag:'sundays_only',goto:'sundays',effects:[{kind:'stat',stat:'smarts',delta:1}]},
              {t:'"Sell the tools instead. Put the money where it feeds people."',note:'Practicality, sharpened',tone:'greedy',flag:'sell_tools',goto:'sold',effects:[{kind:'money',delta:200},{kind:'parentMood',which:'father',delta:-18}]}
            ]
          }
        },

        year_bench:{
          lines:[
            {sp:'narrator',t:'The year passes in calluses. He teaches the way rain teaches roofs: relentlessly, and mostly by falling on you. By winter your hands anticipate mistakes; by spring they correct them before he can open his mouth, and his silence then is the loudest praise he owns.'},
            {sp:'father',t:'On the last evening he does not wrap the tools back up. "They know you now," is all he says, which in this dialect is a knighthood.'}
          ],
          goto:'branch_tools'
        },

        sundays:{
          lines:[
            {sp:'narrator',t:'Fifty-two Sundays. He grumbles about it to anyone who will hold still, but the shed light burns late every Saturday night, preparing lessons sized for one morning apiece.'},
            {sp:'father',t:'At year\'s end: "Slow. But slow in both directions counts double, or some such arithmetic. Your mother says you get it from her."'}
          ],
          goto:'branch_tools'
        },

        sold:{
          lines:[
            {sp:'narrator',t:'The buyer pays well and leaves quickly. Your father shakes your hand at the gate like a stranger closing an account, and the shed stands empty the rest of the summer, breathing dust.'}
          ],
          choice:{
            prompt:'Some purchases cannot be shelved.',
            options:[
              {t:'Buy the tools back, whatever the cost now.',note:'Reversal, at premium',tone:'kind',flag:'bought_back',goto:'bought_back',effects:[{kind:'money',delta:-320}]},
              {t:'Let the sale stand. Learn the trade from books instead.',note:'Cold scholarship',tone:'cold',flag:'from_books',goto:'ending_books',effects:[{kind:'stat',stat:'smarts',delta:2}]}
            ]
          }
        },

        branch_tools:{
          lines:[
            {sp:'narrator',t:'With the year\'s learning comes a question the whole district can see coming: the guild bench at the exhibition this autumn takes one apprentice entry per family name.'}
          ],
          choice:{
            prompt:'Enter under whose name?',
            options:[
              {t:'Under his. Let the old lion take the bow.',note:'Glory, redirected upstream',tone:'kind',flag:'entered_for_father',goto:'ending_ribbon',effects:[{kind:'parentMood',which:'father',delta:10}]},
              {t:'Under your own. He taught you to sign honest work.',note:'A signature, at last',tone:'prudent',flag:'own_name',goto:'ending_ownname',effects:[{kind:'stat',stat:'relations',delta:3}]}
            ]
          }
        },

        bought_back:{
          lines:[
            {sp:'narrator',t:'It costs nearly double and one humiliating afternoon of gratitude toward a pawnbroker. The flannel wrapping smells of your childhood anyway. Your father says nothing when they come home — just clears half the bench, and leaves the lamp lit past midnight more than once.'}
          ],
          goto:'branch_tools'
        },

        ending_ribbon:{
          ending:{
            id:'ribbon',title:'THE RIBBON ON THE OLD WALL',tone:'kind',
            epilogue:['Second place, exhibition class — the judges note the "unusual maturity of hand." The certificate hangs in his shed, not yours, which was the entire submission strategy.','He polishes the glass weekly. Neighbors are shown. Tea is involved. Some inheritances are paid out in afternoons like these.'],
            effects:[{kind:'parentMood',which:'father',delta:12},{kind:'familyMood',delta:6},{kind:'skill',skill:'craft',delta:2},{kind:'memory',type:'episode_father_ribbon',valence:.8,intensity:.7,summary:""+yearsWorked+' YEARS IN THE HANDS ended on the exhibition wall: Subject entered under the old man\u2019s name.'}]
          }
        },

        ending_ownname:{
          ending:{
            id:'ownname',title:'SIGNED, IN YOUR OWN HAND',tone:'prudent',
            epilogue:['Third place — and the judge, a dry old master, asks who trained you and nods at the answer like a man balancing books. "Lineage shows," he says. "So does independence. Both are lineage."','Two certificates now exist in the family. His hangs in the shed. Yours travels in your tool roll, which tells you everything about how each of you stores pride.'],
            effects:[{kind:'stat',stat:'happiness',delta:4},{kind:'skill',skill:'craft',delta:2},{kind:'memory',type:'episode_father_ownname',valence:.6,intensity:.65,summary:""+yearsWorked+' YEARS IN THE HANDS ended signed: Subject entered the exhibition under their own name.'}]
          }
        },

        ending_books:{
          ending:{
            id:'books',title:'THE TRADE FROM BOOKS',tone:'cold',
            epilogue:['You learn the theory beautifully. Measurements, metallurgy, the mathematics of load. But the hands keep another alphabet, the one written only by years, and yours spell it with an accent nobody in the guild can quite place.','Your father reads your published notes on joint strength — twice — and mails them back with two pencil corrections and no letter. It is the closest thing to blessing the sale will ever receive.'],
            effects:[{kind:'stat',stat:'smarts',delta:2},{kind:'parentMood',which:'father',delta:-4},{kind:'memory',type:'episode_father_books',valence:-.2,intensity:.5,summary:""+yearsWorked+' YEARS IN THE HANDS ended in print: Subject traded the bench for the book.'}]
          }
        }
      }};
    }
  },

  /* ================================================================
     EPISODE 7 — THE FRIEND IN WARD 9 (loyalty versus the file)
     ================================================================ */
  {
    id:'ep_friend_ward',
    domain:'friend',
    cast(world,S){
      const f=friendOf(S); if(!f) return null;
      return [{key:'friend',label:f.name,bind:f.cid}];
    },
    eligible(world,S){ return !!friendOf(S)&&S.age>=18; },
    weight(){ return 2.5; },
    build(bind,rng){
      const fr=bind.friend;
      const bribe=rng?rng.int(150,300):220;
      return {
      title:'WITNESS '+String.fromCharCode(65+(rng?rng.int(0,25):7)),
      bg:'office',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'The summons names you as "character reference, secondary contact" — bureaucratic Latin for close enough to be useful. In the corridor of Ward 9, under a portrait of somebody vigilant, sits '+fr.label+', collar wrong, smile assembled from spare parts.'},
            {sp:'friend',t:'"Before you say anything — I printed a pamphlet. One pamphlet. It quoted a law, correctly, and the law disagreed with a decree." A breath. "They want me to name the print shop\'s Thursday crowd. You\'re in that crowd."'}
          ],
          choice:{
            prompt:'The clerk\'s pen is already moving. Choose your testimony.',
            options:[
              {t:'Testify truly, narrowly: "He printed. I read. That is all I know."',note:'Truth, trimmed to fit',tone:'prudent',flag:'narrow_truth',goto:'verdict_narrow',effects:[{kind:'contactMood',cid:fr.bind,delta:4}]},
              {t:'Lie generously. Vouch him into a monk\'s biography.',note:'Perjury, affectionate',tone:'greedy',flag:'lied_generously',goto:'lie_risk',effects:[{kind:'contactMood',cid:fr.bind,delta:15},{kind:'scrutiny',delta:6}]},
              {t:'Slip the clerk an envelope with your statement.',note:'Speed, papered',tone:'greedy',flag:'bribed_clerk',goto:'envelope',effects:[{kind:'money',delta:-bribe}]}
            ]
          }
        },

        verdict_narrow:{
          lines:[
            {sp:'narrator',t:'The narrow truth satisfies the form and damns the friend: six months\' administrative residence "at the Ministry\'s convenience." They take it standing. At the door, turned halfway:'},
            {sp:'friend',t:'"You told the truth like a craftsman. Fit the wood, spare the varnish." A nod. "I\'ll write. Watch the Thursday crowd for me — somebody should know the score."'}
          ],
          goto:'branch_after'
        },

        lie_risk:{
          lines:[
            {sp:'narrator',t:'Your biography of '+fr.label+' is florid, unverifiable, and — the inspector notes, tapping one date — contradicted by a tram ticket. The room acquires walls. Then, abruptly, doors: a supervisor with better numbers to chase waves the matter onward. Sloppy mercy.'}
          ],
          goto:'branch_after'
        },

        envelope:{
          lines:[
            {sp:'narrator',t:'The statement vanishes into a folder with the envelope, and the folder into a drawer with history. The clerk\'s stamp falls twice: RECEIVED, and, softer, RESOLVED.'}
          ],
          goto:'branch_after'
        },

        branch_after:{
          lines:[
            {sp:'narrator',t:'Weeks later the ward settles, but Ward 9 keeps carbon copies of everyone, and yours has grown a page.'}
          ],
          choice:{
            prompt:'What does the subject do with being noticed?',
            options:[
              {t:'Nothing. Live cleanly and let the page yellow.',note:'Quiet as maintenance',tone:'prudent',flag:'lived_quiet',goto:'ending_quietpage',effects:[]},
              {t:'Visit the print shop\'s Thursday crowd, once, with bread and news.',note:'The seat he kept warm',tone:'kind',flag:'visited_crowd',goto:'ending_thursday',effects:[{kind:'stat',stat:'relations',delta:4},{kind:'scrutiny',delta:3}]}
            ]
          }
        },

        ending_quietpage:{
          ending:{
            id:'quietpage',title:'THE PAGE THAT YELLOWED',tone:'prudent',
            epilogue:['Six months pass. The carbon page yellows exactly on schedule. When '+fr.label+' returns — thinner, reading glasses new — the first thing you do together is argue about football, at volume, in public, like free men.'],
            effects:[{kind:'contactMood',cid:fr.bind,delta:8},{kind:'stat',stat:'happiness',delta:2},{kind:'memory',type:'episode_friend_quietpage',valence:.4,intensity:.55,summary:'WITNESS testimony ended quietly: Subject testified narrowly and kept the page clean.'}]
          }
        },

        ending_thursday:{
          ending:{
            id:'thursday',title:'KEEPING THE SEAT WARM',tone:'kind',
            epilogue:['The crowd votes you in without a vote — you simply keep being there, passing bread and news, until the pamphlets learn your handwriting too.','When '+fr.label+' walks back in early (good behavior, bribes, history — the usual recipe), the chair is warm and the argument mid-sentence. That is what loyalty sounds like afterward: continuation.'],
            effects:[{kind:'contactMood',cid:fr.bind,delta:14},{kind:'stat',stat:'happiness',delta:4},{kind:'memory',type:'episode_friend_thursday',valence:.7,intensity:.7,summary:'WITNESS testimony ended among printers: Subject kept the Thursday crowd alive for '+fr.name+'.'}]
          }
        },

        ending_envelope:{
          ending:{
            id:'envelope',title:'RESOLVED, BY PAPERWEIGHT',tone:'greedy',
            epilogue:['Nobody serves time; nobody asks questions; the envelope buys a silence that holds, the way oiled hinges hold — quietly, with occasional looks.','You and '+fr.label+' never discuss the fee. It sits between you like furniture bought together: useful, jointly owned, impossible to mention.'],
            effects:[{kind:'contactMood',cid:fr.bind,delta:10},{kind:'stat',stat:'happiness',delta:-1},{kind:'memory',type:'episode_friend_envelope',valence:.15,intensity:.55,summary:'WITNESS testimony was purchased: an envelope resolved '+fr.name+'\'s case.'}]
          }
        },

        ending_perjury:{
          ending:{
            id:'perjury',title:'FLORID, UNVERIFIABLE, YOURS',tone:'greedy',
            epilogue:['The tram-ticket discrepancy dies in a drawer, but not in memory. Inspectors have long memories for florid witnesses.',''+fr.label+' walks free and knows precisely what it cost. The debt makes them gentler at cards and quieter in arguments — being loved that visibly is a weight, and they carry it kindly.'],
            effects:[{kind:'contactMood',cid:fr.bind,delta:12},{kind:'stat',stat:'happiness',delta:1},{kind:'record',value:true},{kind:'memory',type:'episode_friend_perjury',valence:.3,intensity:.65,summary:'WITNESS testimony was perjured generously for '+fr.name+', and the file remembers.'}]
          }
        }
      }};
    }
  },

  /* ================================================================
     EPISODE 8 — THE DIRECTOR'S TABLE (power sets a place for you)
     ================================================================ */
  {
    id:'ep_director_table',
    domain:'work',
    cast(world,S){
      if(S.age<20||S.age>63) return null;
      const c=contractOf(world); if(!c) return null;
      const col=colleagueOf(world,S); if(!col) return null;
      return [{key:'director',label:'Deputy Director Lemech'},{key:'rival',label:col.name,bind:col.id}];
    },
    eligible(world,S){
      if(S.age<20||S.age>63) return false;
      try{
        const c=contractOf(world); if(!c) return false;
        return c.performance>0.62;
      }catch(e){ return false; }
    },
    weight(){ return 2.2; },
    build(bind,rng){
      const dir=bind.director, rival=bind.rival;
      return {
      title:'SEATS AT THE LONG TABLE',
      bg:'office',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'The invitation arrives on card stock heavy enough to stop a door: dinner, private room, the Restaurant of Three Soups. Deputy Director Lemech hosts twelve guests a year and promotes nine of them.'},
            {sp:'director',t:'"Sit, sit. You know '+rival.label+' — splendid technician, dreadful instinct. The ministry requires a report on certain irregularities in their section. I thought: someone with clean columns should draft it." He refills your glass himself, which in this building is practically coronation.'},
            {sp:'rival',t:'(across the soup, quietly, smiling for the room) "Whatever he\'s offered, count who pays the bill."'}
          ],
          choice:{
            prompt:'Soup gets cold. Careers get decided.',
            options:[
              {t:'Draft the report. Factually. Whatever it lands on.',note:'The instrument, played straight',tone:'prudent',flag:'drafted_report',goto:'report',effects:[{kind:'stat',stat:'smarts',delta:1}]},
              {t:'Refuse gently — "I audit figures, not colleagues."',note:'A spine, politely',tone:'kind',flag:'declined',goto:'refusal',effects:[{kind:'npcBond',npcId:rival.bind,delta:10}]},
              {t:'Agree warmly — then warn '+rival.label+' tonight.',note:'Both tables fed',tone:'greedy',flag:'double_agent',goto:'doublegame',effects:[{kind:'scrutiny',delta:3}]}
            ]
          }
        },

        report:{
          lines:[
            {sp:'narrator',t:'You write it the way you total columns: exact, sourced, merciless in neither direction. Two irregularities stand; eleven rumors die on evidence. Lemech wanted a scalpel and receives a scale.'},
            {sp:'director',t:'"Precise," he says, tasting disappointment and finding it nourishing. "Precision is its own promotion, they tell me. We shall see whose precision the ministry prefers."'}
          ],
          goto:'aftermath'
        },

        refusal:{
          lines:[
            {sp:'director',t:'Lemech hears the refusal the way stone hears rain. "Loyalty to sections is very touching at section level." The dessert arrives; your career does not. Or so the room believes.'}
          ],
          goto:'aftermath'
        },

        doublegame:{
          lines:[
            {sp:'narrator',t:'You promise Lemech diligence and deliver, within the hour, a warning dressed as gossip: "They\'re looking at your section. Fix your March tickets." '+rival.label+' listens twice, asks nothing, and shakes your hand like a man accepting rope, unsure whether it is for pulling or hanging.'}
          ],
          goto:'aftermath'
        },

        aftermath:{
          lines:[
            {sp:'narrator',t:'Spring reorganizes the ministry the way springs do. Names move. Desks swap. Somewhere a long table is reset for next year\'s twelve.'}
          ],
          choice:{
            prompt:'Where does the subject sit when the music stops?',
            options:[
              {t:'Apply for the vacant deputy-desk. Ambition owes no apologies.',note:'Upward, openly',tone:'greedy',flag:'sought_desk',goto:'ending_desk',effects:[]},
              {t:'Stay put, guard your section\'s people.',note:'Roots over branches',tone:'kind',flag:'stayed_put',goto:'ending_guardian',effects:[]},
              {t:'Request transfer to the archives. Distance from tables.',note:'Quiet as strategy',tone:'cold',flag:'chose_archives',goto:'ending_archives',effects:[]}
            ]
          }
        },

        ending_desk:{
          ending:{
            id:'desk',title:'THE DEPUTY DESK, WITH ITS OWN SOUP',tone:'greedy',
            epilogue:['You get the desk. The first thing on it is a request to draft a report on somebody else\'s section — the ministry recycles even irony.','You keep '+rival.label+'\'s warning taped inside the blotter: COUNT WHO PAYS THE BILL. So far, you pay your own. The soup, notably, tastes better on this side, and slightly of iron.'],
            effects:[{kind:'jobRaise',amount:340},{kind:'stat',stat:'happiness',delta:2},{kind:'scrutiny',delta:6},{kind:'memory',type:'episode_director_desk',valence:.35,intensity:.65,summary:'SEATS AT THE LONG TABLE ended upstairs: Subject accepted the deputy desk and its menu.'}]
          }
        },

        ending_guardian:{
          ending:{
            id:'guardian',title:'THE SECTION\'S UMBRELLA',tone:'kind',
            epilogue:['Promotions pass you by with full honors, and your section quietly becomes the place where work is done honestly and nobody vanishes in April.','Years on, juniors fight to be posted to you. Lemech, retired and harmless, once asks what your secret was. "Umbrellas," you tell him. He dines out on the word for months.'],
            effects:[{kind:'npcBond',npcId:rival.bind,delta:8},{kind:'stat',stat:'happiness',delta:5},{kind:'stat',stat:'relations',delta:3},{kind:'memory',type:'episode_director_guardian',valence:.7,intensity:.6,summary:'SEATS AT THE LONG TABLE ended grounded: Subject guarded the section instead of the ladder.'}]
          }
        },

        ending_archives:{
          ending:{
            id:'archives',title:'THE ARCHIVES ARE LOVELY THIS TIME OF YEAR',tone:'cold',
            epilogue:['Basement level two: constant temperature, no windows, no dinners. The files ask nothing and remember everything — colleagues after your own heart, in a manner of speaking.','Lemech forgets your face within the quarter, which is the finest review the archives can confer. You sleep like filed paper.'],
            effects:[{kind:'stat',stat:'happiness',delta:3},{kind:'stat',stat:'smarts',delta:1},{kind:'scrutiny',delta:-6},{kind:'memory',type:'episode_director_archives',valence:.3,intensity:.5,summary:'SEATS AT THE LONG TABLE ended below ground: Subject chose the archives and their silence.'}]
          }
        },

        ending_shielded:{
          ending:{
            id:'shielded',title:'THE REPORT THAT WASN\'T',tone:'kind',
            epilogue:['Your draft lists irregularities and exonerations in equal measure, each sourced. Lemech files it with the expression of a man served decaf at an execution.','The ministry rotates him somewhere humid. '+rival.label+' survives intact and never mentions the warning — but every March, anonymously, your desk receives coffee from the good shop. The one across from the print shop.'],
            effects:[{kind:'npcBond',npcId:rival.bind,delta:14},{kind:'stat',stat:'happiness',delta:4},{kind:'memory',type:'episode_director_shielded',valence:.65,intensity:.65,summary:'SEATS AT THE LONG TABLE ended mercifully: Subject\u2019s precise report shielded '+rival.name+'.'}]
          }
        }
      }};
    }
  },

  /* ================================================================
     EPISODE 9 — THE WALL HAS EARS (a neighbor, a forbidden frequency)
     ================================================================ */
  {
    id:'ep_wall_ears',
    domain:'neighbor',
    cast(world,S){
      if(S.age<16) return null;
      return [
        {key:'neighbor',label:(rngName('N'))+' Novak'},
        {key:'watcher',label:'Inspector Pelz'}
      ];
    },
    eligible(world,S){ return S.age>=16; },
    weight(){ return 2; },
    build(bind,rng){
      const nb=bind.neighbor, insp=bind.watcher;
      return {
      title:'STATIC AFTER MIDNIGHT',
      bg:'street',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'The wall between your flats is thin as bureaucracy. Most nights it delivers arguments and accordion practice. Lately, after midnight, it delivers something else: static, then a voice reading shipping tonnages in a foreign accent, then jazz — actual, forbidden, glorious jazz.'},
            {sp:'neighbor',t:'(through the wall, muffled, unaware) "...and if the fish catch holds, brother, we hold too. Over."'},
            {sp:'narrator',t:'A shortwave set. A fish-market network. And you, one plaster thickness from becoming either a witness or a wall yourself.'}
          ],
          choice:{
            prompt:'The set crackles on, oblivious.',
            options:[
              {t:'Knock on their door with a bottle. Join the audience.',note:'Static is better shared',tone:'kind',flag:'joined_listeners',goto:'joined',effects:[{kind:'stat',stat:'happiness',delta:3},{kind:'scrutiny',delta:3}]},
              {t:'Note the hours and the frequency. Information keeps.',note:'A notebook with teeth',tone:'greedy',flag:'logged_hours',goto:'logged',effects:[{kind:'stat',stat:'smarts',delta:1}]},
              {t:'Say nothing and buy thicker pillows.',note:'Plaster diplomacy',tone:'cold',flag:'ignored',goto:'ending_pillows',effects:[]}
            ]
          }
        },

        joined:{
          lines:[
            {sp:'neighbor',t:'Novak pours tea like contraband and explains in half-sentences: brothers along the coast, prices, weather, songs the radio here forgot existed. "We don\'t plot," they say. "We count. Counting is legal." Their eyes add: usually.'},
            {sp:'narrator',t:'The jazz comes through clear that night. You own no opinion on jazz. You develop one immediately and permanently.'}
          ],
          goto:'inspector'
        },

        logged:{
          lines:[
            {sp:'narrator',t:'Twelve nights of data: 00:40 to 01:55, frequency steady, accent coastal. The notebook weighs nothing. That is the problem with notebooks — the heavy ones are always somebody else\'s.'}
          ],
          goto:'inspector'
        },

        inspector:{
          lines:[
            {sp:'watcher',t:'Inspector Pelz appears at your door doing civic rounds, ears practically in his lapels. "Complaints of foreign broadcasts. Disturbances after midnight. You hear anything... statistical?" The pause around the last word is professionally furnished.'}
          ],
          choice:{
            prompt:'Pelz waits. Bureaus hate silence almost as much as music.',
            options:[
              {t:'"Only accordions, Inspector. Terrible ones."',note:'Plaster holds',tone:'kind',flag:'shielded_neighbor',goto:'ending_shield',effects:[{kind:'stat',stat:'relations',delta:3}]},
              {t:'Hand over everything. Hours, frequencies, all of it.',note:'Citizenship, loud',tone:'cold',flag:'handed_notes',goto:'ending_report',effects:[{kind:'scrutiny',delta:-8},{kind:'money',delta:80}]},
              {t:'Sell ambiguity: "Might be fish prices. Might be ghosts. Worth a look upstairs."',note:'A nudge, deniable',tone:'greedy',flag:'nudged',goto:'ending_ghost',effects:[{kind:'stat',stat:'smarts',delta:1}]}
            ]
          }
        },

        ending_shield:{
          ending:{
            id:'shield',title:'THE ACCORDION ALIBI',tone:'kind',
            epilogue:['Pelz departs unsatisfied but unfurnished. That night, the jazz plays a fraction louder — a thank-you at broadcast strength.','For years the wall carries music and fish futures and, once, your birthday requested over the air from three hundred kilometers away by strangers who know you only as "the accordion neighbor."'],
            effects:[{kind:'stat',stat:'happiness',delta:5},{kind:'memory',type:'episode_wall_shield',valence:.7,intensity:.6,summary:'STATIC AFTER MIDNIGHT ended behind plaster: Subject shielded Novak\u2019s coast network from Inspector Pelz.'}]
          }
        },

        ending_report:{
          ending:{
            id:'report',title:'EXHIBIT A: FREQUENCIES',tone:'cold',
            epilogue:['The raid is polite and total. The set goes in a evidence bag; Novak goes in a van, waving at no one, counting on no one.','The reward voucher spends fine. The jazz, however, has ruined other music for you permanently — every shop song now sounds like testimony.'],
            effects:[{kind:'stat',stat:'happiness',delta:-6},{kind:'memory',type:'episode_wall_report',valence:-.55,intensity:.7,summary:'STATIC AFTER MIDNIGHT ended in exhibits: Subject reported Novak\u2019s network and took the voucher.'}]
          }
        },

        ending_ghost:{
          ending:{
            id:'ghost',title:'GHOSTS UPSTAIRS, GHOSTS DOWNSTAIRS',tone:'greedy',
            epilogue:['Pelz finds the antenna and loses the operator — Novak, warned by the very visit your ambiguity caused, has gone visiting cousins indefinitely.','The bureau logs GHOSTS, PROBABLE. Novak sends no postcard. The wall stays silent at midnight now, and you discover you had grown fond of the traffic — of being adjacent, safely, to other people\'s courage.'],
            effects:[{kind:'stat',stat:'happiness',delta:-2},{kind:'stat',stat:'smarts',delta:1},{kind:'memory',type:'episode_wall_ghost',valence:-.1,intensity:.55,summary:'STATIC AFTER MIDNIGHT ended in ghosts: Subject nudged the inspection and emptied the flat upstairs.'}]
          }
        },

        ending_pillows:{
          ending:{
            id:'pillows',title:'THICKER PILLOWS',tone:'cold',
            epilogue:['You hear nothing further, officially. Unofficially: one dawn arrest van, one new tenant, one accordion student with modern opinions.','The pillow strategy wins every battle it fights and every one of them costs exactly nothing except, eventually, a name in somebody else\u2019s memoir — listed under FURNITURE.'],
            effects:[{kind:'stat',stat:'happiness',delta:-1},{kind:'memory',type:'episode_wall_pillows',valence:-.15,intensity:.4,summary:'STATIC AFTER MIDNIGHT ended in upholstery: Subject heard everything and did nothing at all.'}]
          }
        }
      }};
    }
  },

  /* ================================================================
     EPISODE 10 — THE EMPTY CHAIR (a spouse variant: debt at the door)
     ================================================================ */
  {
    id:'ep_empty_chair',
    domain:'spouse',
    cast(world,S){
      const p=partnerOf(S); if(!p) return null;
      return [{key:'spouse',label:p.name,bind:p.cid}];
    },
    eligible(world,S){
      const p=partnerOf(S);
      return !!(p&&S.married&&S.age>=21&&(Number(S.assets)||0)<900);
    },
    weight(){ return 2.4; },
    build(bind,rng){
      const sp=bind.spouse;
      const debt=rng?rng.int(280,520):400;
      return {
      title:'THE MAN WITH THE ABACUS COMES TO DINNER',
      bg:'night_flat',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'He arrives punctually, hat in hand, abacus in the other: a collector of the old school, courteous as frost. The debt is '+debt+'. The debtor, apparently, is '+sp.label+', who has been losing afternoons at the track since spring and paying losses with money arranged in installments from a lender whose interest has interest.'},
            {sp:sp.key,t:'"I was going to win it back before you ever—" The sentence surrenders. "No. I was going to keep losing it, one secret month at a time, until the arithmetic ate us."'}

          ],
          choice:{
            prompt:'The abacus man taps one bead, patient as furniture.',
            options:[
              {t:'Pay in full, once, with both of you watching.',note:'End it in daylight',tone:'prudent',flag:'paid_full',goto:'pay_scene',effects:[{kind:'money',delta:-debt}]},
              {t:'Renegotiate terms — installment, witnessed, stamped.',note:'Structure over shame',tone:'cold',flag:'renegotiated',goto:'terms',effects:[{kind:'money',delta:-Math.round(debt*0.3)}]},
              {t:'Show him the door. Debts of honor stay outside.',note:'Defiance, expensive',tone:'greedy',flag:'door_shown',goto:'defiance',effects:[{kind:'stat',stat:'happiness',delta:-2}]}
            ]
          }
        },

        pay_scene:{
          lines:[
            {sp:'narrator',t:'Coins counted aloud, receipt torn on the dotted line, abacus closed with a click like a tiny cell door. At the threshold the collector allows himself one professional kindness: "Marriages recover. Track records don\'t. Good evening."'}
          ],
          goto:'aftermath_debt'
        },

        terms:{
          lines:[
            {sp:'narrator',t:'New schedule: quarterly, witnessed, a penalty clause in plain language. The collector respects structure the way cats respect closed doors — resentfully, and only briefly. The abacus leaves; its shadow agrees to visit four more times.'}
          ],
          goto:'aftermath_debt'
        },

        defiance:{
          lines:[
            {sp:'narrator',t:'The door shuts. Silence arranges itself around the room like new furniture. '+sp.label+' looks at the shut door, then at you, and you watch two calculations finish behind their eyes — relief arriving third, after terror and gratitude, which is the usual podium for relief.'},
            {sp:'narrator',t:'The debt, of course, remains. Debts are not vampires; doors do not apply. But now it is YOUR debt, openly held, and there is a strange nutrition in that.'}
          ],
          choice:{
            prompt:'Own it how?',
            options:[
              {t:'Take extra shifts until it bleeds dry.',note:'Labor, applied topically',tone:'kind',flag:'extra_shifts',goto:'ending_shifts',effects:[{kind:'stat',stat:'health',delta:-3},{kind:'partnerMood',delta:10}]},
              {t:'Both of you go down to the track together — to watch, never bet, as penance education.',note:'The museum of temptation',tone:'prudent',flag:'track_lessons',goto:'ending_museum',effects:[{kind:'partnerMood',delta:6}]}
            ]
          }
        },

        aftermath_debt:{
          lines:[
            {sp:sp.key,t:'"I want to say it was the track," '+sp.label+' says to the table, "but the track is just where hiding went to exercise." They slide something across: a betting slip, blank, framed years ago by a parent who lost slower. "My mother\u2019s. I kept it as a warning. Then as a permission."'},
            {sp:'narrator',t:'The slip goes into the stove that night, whichever path you choose. Paper burns fast; permissions take longer.'}
          ],
          choice:{
            prompt:'What does the household vow, formally?',
            options:[
              {t:'No secrets above ten marks. Audit each other yearly, lovingly.',note:'Transparency, ratified',tone:'prudent',flag:'audited_vow',goto:'ending_audit',effects:[{kind:'partnerMood',delta:12}]},
              {t:'Burn the slip, forgive fully, never speak of it again.',note:'Amnesty, total',tone:'kind',flag:'amnesty',goto:'ending_amnesty',effects:[{kind:'partnerMood',delta:8},{kind:'stat',stat:'happiness',delta:2}]}
            ]
          }
        },

        ending_shifts:{
          ending:{
            id:'shifts',title:'PAID IN CALLUSES',tone:'kind',
            epilogue:['Nine weeks of doubled shifts retire the debt and age your hands five years. '+sp.label+' packs your suppers with notes of escalating absurdity — the ninth just says HOLD ON, LANDLORD OF MY HEART.','The last coin goes clink into the tin. You sleep like labor, which is the best-tasting sleep there is.'],
            effects:[{kind:'partnerMood',delta:12},{kind:'stat',stat:'happiness',delta:3},{kind:'memory',type:'episode_chair_shifts',valence:.65,intensity:.65,summary:'THE ABACUS DINNER ended in calluses: Subject worked '+sp.name+'\u2019s debt off personally.'}]
          }
        },

        ending_museum:{
          ending:{
            id:'museum',title:'THE MUSEUM OF TEMPTATION',tone:'prudent',
            epilogue:['Every Sunday, two spectators at the rail: watching the horses ruin other families, holding hands like survivors of the same ship.','Betting slips become extinct in the house. The track becomes free theater. '+sp.label+'\u2019s afternoons relocate to kitchens and libraries, which are duller venues for doom and considerably cheaper.'],
            effects:[{kind:'partnerMood',delta:9},{kind:'memory',type:'episode_chair_museum',valence:.5,intensity:.55,summary:'THE ABACUS DINNER ended in spectatorship: the couple studied the track without feeding it.'}]
          }
        },

        ending_audit:{
          ending:{
            id:'audit',title:'THE YEARLY AUDIT OF US',tone:'prudent',
            epilogue:['Each anniversary: one candle, two ledgers, total disclosure, and a bottle of the cheap good wine. It is the least romantic ritual ever invented and it functions like architecture.','Friends notice the marriage got calmer and credit maturity. It was accounting, but maturity is close enough.'],
            effects:[{kind:'partnerMood',delta:10},{kind:'stat',stat:'smarts',delta:1},{kind:'memory',type:'episode_chair_audit',valence:.55,intensity:.6,summary:'THE ABACUS DINNER ended in ledgers: the couple instituted their yearly audit of us.'}]
          }
        },

        ending_amnesty:{
          ending:{
            id:'amnesty',title:'AMNESTY, TOTAL AND IMMEDIATE',tone:'kind',
            epilogue:['The slip burns green and quick. Forgiveness arrives before apology finishes asking — an advance payment against future sins, which is either wisdom or recklessness wearing wisdom\u2019s coat.','Time rules on appeal. Years later '+sp.label+' confesses the strangest part: that being forgiven first made cheating impossible. Trust, it turns out, is also surveillance — the kind nobody minds.'],
            effects:[{kind:'partnerMood',delta:11},{kind:'stat',stat:'happiness',delta:3},{kind:'memory',type:'episode_chair_amnesty',valence:.6,intensity:.6,summary:'THE ABACUS DINNER ended in amnesty: forgiveness arrived ahead of apology and rearranged the marriage.'}]
          }
        },

        ending_interest:{
          ending:{
            id:'interest',title:'THE SHADOW VISITS QUARTERLY',tone:'cold',
            epilogue:['Installments hold. The abacus shadow crosses the doorway four times a year, always punctual, always polite, always costing exactly what was promised plus the special tax of remembering it.',''+sp.label+' keeps the penalty clause pinned inside the cupboard like an icon. Marriage adapts to anything, even arithmetic — though some nights the beads still click in dreams, both your dreams, taking attendance.'],
            effects:[{kind:'partnerMood',delta:4},{kind:'stat',stat:'happiness',delta:-2},{kind:'memory',type:'episode_chair_interest',valence:.05,intensity:.55,summary:'THE ABACUS DINNER ended on installments: the shadow agreed to visit quarterly.'}]
          }
        }
      }};
    }
  },

  {
    id:'ep_hold_ledger',
    domain:'hold',
    cast(world,S){
      if(!S.holdMember) return null;
      const settlementId=(S.location&&S.location.settlementId)||world.activeSettlementId;
      const fx=fixerOf(world,settlementId);
      return [
        {key:'elder',label:'Uncle Vasik, the fold\'s elder'},
        {key:'outsider',label:S.first?S.first+"'s own "+(S.kids>0?'brother':'cousin'):'a relative'}
      ].concat(fx?[{key:'fixer',label:fx.name,bind:fx.id}]:[]);
    },
    eligible(world,S){ return !!S.holdMember&&S.age>=17; },
    weight(){ return 2.5; },
    build(bind){
      const el=bind.elder;
      const outsider=bind.outsider;
      const fx=bind.fixer;
      return {
      title:'ENTRIES IN SOMEBODY ELSE\'S HAND',
      bg:'dock_night',
      scenes:{
        opening:{
          lines:[
            {sp:'narrator',t:'The fold meets where the fish crates make benches. Uncle Vasik presides over a ledger no bureaucrat ever printed: debts, favors, silences. Tonight he reads it differently — slowly, twice — while the dock lights swing.'},
            {sp:el.key,t:'"Someone wrote outside the book." His voice never rises; it doesn\'t need to. "Routes. Dates. Two of our people nearly met the checkpoint calendar last week." The ledger turns to face the circle. "Entries in somebody else\'s hand."'},
            {sp:'narrator',t:'He lets the silence do its work, then says the terrible part, gently, the way you euthanize something: "The handwriting resembles a hand some of us love."'}
          ],
          choice:{
            prompt:'Every eye arrives at you, one after another, like lamps being lit.',
            options:[
              {t:'"Name them, and I\'ll handle it — family to family."',note:'The knife, offered loyally',tone:'greedy',flag:'volunteered_knife',goto:'tasked',effects:[{kind:'holdTrust',delta:8},{kind:'holdHeat',delta:4}]},
              {t:'"Accusations need proof. Give me a week."',note:'Due process, underworld edition',tone:'prudent',flag:'demanded_proof',goto:'week',effects:[{kind:'stat',stat:'smarts',delta:1}]},
              {t:'Say nothing. Watch the watcher.',note:'Count the exits first',tone:'cold',flag:'watchful',goto:'watch',effects:[]}
            ]
          }
        },

        tasked:{
          lines:[
            {sp:'elder',t:'Vasik writes an address on a scrap and burns it after you memorize it. "Talk first. If talk fails—" he shrugs, an entire curriculum in one shoulder. "The fold provides. The fold also collects."'},
            {sp:'narrator',t:'The address is '+outsider.label+'\'s building. Third floor, the good window, where a lamp already burns for somebody who has no idea the fold is coming up the stairs.'}
          ],
          choice:{
            prompt:'Third-floor landing. The stairs creak a warning behind you.',
            options:[
              {t:'Knock. Talk, as ordered — and steer it toward exile, not graves.',note:'Mercy, smuggled',tone:'kind',flag:'talked_first',goto:'talk_outcome',effects:[{kind:'stat',stat:'happiness',delta:-2}]},
              {t:'Warn them instead. "Tonight, pack. The fold knows."',note:'Blood over brotherhood',tone:'cold',flag:'warned_target',goto:'betray_fold',effects:[{kind:'holdTrust',delta:-20},{kind:'holdHeat',delta:8}]}
            ]
          }
        },

        week:{
          lines:[
            {sp:'narrator',t:'A week of small detections. The checkpoint calendar in the post office lobby, annotated in pencil that matches — almost matches — the ledger\'s intruder hand. Almost. Pencil is a coward\'s fingerprint.'},
            {sp:'narrator',t:'What you actually find is smaller and larger: '+outsider.label+' paying a stranger\'s clinic bill in cash, and the stranger, coughing, wearing a fold courier\'s coat.'}
          ],
          goto:'truth_choice'
        },

        watch:{
          lines:[
            {sp:'narrator',t:'You say nothing at the crates and everything with your eyes. Over the following days the fold conducts its own quiet theater: routes changed, messages poisoned with harmless lies, one meeting moved twice.'},
            {sp:'narrator',t:'The bait works. The leak follows the poison — straight to a dead drop behind the tannery, and the hand that services it belongs to neither '+outsider.label+' nor anyone the ledger loves: a Ward 9 clerk on freelance wages.'}
          ],
          goto:'truth_choice'
        },

        talk_outcome:{
          lines:[
            {sp:'narrator',t:''+outsider.label+' listens to the fold\'s complaint with the pale attention of someone doing arithmetic with their own life. Then, astonishingly, produces the actual leak: letters kept as insurance against the day the fold decided a relative was expendable.'},
            {sp:'narrator',t:'Not treachery. Deterrence. The oldest insurance there is.'}
          ],
          goto:'truth_choice'
        },

        betray_fold:{
          lines:[
            {sp:'narrator',t:'They vanish on the night boat with two suitcases and your warning in their pocket. Three days later the fold knows that too, and knows it the only way the fold learns anything: completely.'},
            {sp:el.key,t:'(at the crates, quietly) "We loved you, little one. That\'s what makes this bookkeeping sad instead of simple."'}
          ],
          choice:{
            prompt:'The circle waits. The harbor air tastes of tar and endings.',
            options:[
              {t:'Leave the fold tonight, before the books close on you.',note:'Exit, pursued by sea',tone:'cold',flag:'left_fold',goto:'ending_exile',effects:[{kind:'holdTrust',delta:-25}]},
              {t:'Stay and accept whatever the ledger decides.',note:'Face the arithmetic',tone:'prudent',flag:'faced_judgment',goto:'judgment',effects:[]}
            ]
          }
        },

        truth_choice:{
          lines:[
            {sp:'narrator',t:'Now you hold the true entry, and it implicates no one who loves you — and inconveniences someone the fold fears, which is a different commodity entirely.'}
          ],
          choice:{
            prompt:'Ledgers reward accuracy. Politics reward otherwise.',
            options:[
              {t:'Deliver the truth whole, whoever it inconveniences.',note:'The clean entry',tone:'prudent',flag:'delivered_truth',goto:'ending_clear',effects:[{kind:'holdTrust',delta:12}]},
              {t:'Deliver the truth, minus the clerk\'s name. Keep that drawer.',note:'Insurance, filed darkly',tone:'greedy',flag:'held_name',goto:'ending_insurance',effects:[{kind:'stat',stat:'smarts',delta:2},{kind:'scrutiny',delta:3}]}
            ]
          }
        },

        judgment:{
          lines:[
            {sp:el.key,t:'Vasik studies you across the crates for a long time. "The fold expels traitors and buries fools," he says finally. "You\'re neither. You\'re family, which is harder to book." The sentence, when it comes, is a fine paid from your own pocket and a winter of the worst jobs. Survivable. Deliberate. "Earn back the margin," he says. "Margins forgive."'}
          ],
          goto:'ending_margin'
        },

        ending_clear:{
          ending:{
            id:'clear',title:'THE LEDGER, CORRECTED',tone:'prudent',
            epilogue:[
              'The clerk\'s freelance arrangement ends abruptly and officially, with forms — the Bureau\'s preferred murder weapons.',
              'Vasik closes the matter with one line repeated at the fish crates for years afterward: "The fold keeps faith, because it audits everything else." Your standing rises like dough — quick, warm, and impossible to hide.'
            ],
            effects:[{kind:'holdTrust',delta:10},{kind:'stat',stat:'happiness',delta:4},{kind:'memory',type:'episode_hold_clear',tags:['underworld'],valence:.6,intensity:.7,summary:'THE HOLD LEDGER ended corrected: Subject found the true leak and entered it whole.'}]
          }
        },

        ending_insurance:{
          ending:{
            id:'insurance',title:'THE DARK DRAWER POLICY',tone:'greedy',
            epilogue:['The fold thanks you warmly and believes you fully, which is the most dangerous thing it could have done.','In a tin beneath your floorboards, a clerk\'s name ripens. Policies like that don\'t pay out often. When they pay, they pay everything.'],
            effects:[{kind:'holdTrust',delta:6},{kind:'stat',stat:'happiness',delta:-2},{kind:'scrutiny',delta:4},{kind:'memory',type:'episode_hold_insurance',tags:['underworld'],valence:-.2,intensity:.6,summary:'THE HOLD LEDGER ended in insurance: Subject kept the true name in a dark drawer.'}]
          }
        },

        ending_exile:{
          ending:{
            id:'exile',title:'OUTSIDE THE BOOK',tone:'cold',
            epilogue:['The fold does not hunt you — hunting is for threats, and you stopped being one when you stopped being inside. Doors that opened sideways before now require knocking. Some never answer.',''+outsider.label+' sends one letter, unsigned, from a southern port: a drawing of two suitcases and a sun. You keep it in the tin where dangerous names go.'],
            effects:[{kind:'stat',stat:'happiness',delta:-8},{kind:'holdMember',value:false},{kind:'memory',type:'episode_hold_exile',tags:['underworld'],valence:-.6,intensity:.8,summary:'THE HOLD LEDGER ended in exile: Subject chose blood over brotherhood and left the book.'}]
          }
        },

        ending_burn:{
          ending:{
            id:'burn',title:'EVERYTHING BURNS SOMEDAY',tone:'greedy',
            void:false,
            epilogue:[],
            effects:[]
          }
        },

        ending_margin:{
          ending:{
            id:'margin',title:'EARNING BACK THE MARGIN',tone:'kind',
            epilogue:['A winter of worst jobs teaches you what the fold\'s worst jobs are for: remembering. By spring the crates laugh at your jokes again, and Vasik hands you the ledger to read aloud — an honor disguised as a chore, which is the only kind the fold issues.'],
            effects:[{kind:'holdTrust',delta:8},{kind:'stat',stat:'happiness',delta:2},{kind:'memory',type:'episode_hold_margin',tags:['underworld'],valence:.35,intensity:.6,summary:'THE HOLD LEDGER ended in restitution: Subject paid the fine and earned back the margin.'}]
          }
        }
      }};
    }
  }
  ];

  // The 'burn' variant ending wires the fold arc to a real local fixer when
  // one exists; it replaces ending_burn's empty payload at build time.
  const holdEpisode=EPISODES.find(e=>e.id==='ep_hold_ledger');
  const originalHoldBuild=holdEpisode.build;
  holdEpisode.build=function(bind){
    const body=originalHoldBuild.call(this,bind);
    const fx=bind.fixer;
    if(fx&&body.scenes.truth_choice){
      body.scenes.truth_choice.choice.options.push({
        t:'Feed the clerk\'s trail to the checkpoint captains instead.',
        note:'Heat, weaponized',tone:'greedy',flag:'weaponized_heat',goto:'ending_burn',
        effects:[{kind:'holdHeat',delta:10},{kind:'stat',stat:'happiness',delta:1}]
      });
      body.scenes.ending_burn={
        ending:{
          id:'burn',title:'EVERYTHING BURNS SOMEDAY',tone:'greedy',
          epilogue:[
            'You do not expose the clerk to the fold. You expose the fold\'s routes to the clerk\'s masters, carefully, through three intermediaries, and let Ward 9 do what Ward 9 does.',
            (fx?('When it comes, it comes for '+fx.label+' first: a quiet raid, a folded operation, a name chalked off no list anywhere.'):'When it comes, it comes for the couriers first: quiet raids, folded operations, names chalked off no list anywhere.'),
            'The fold survives, diminished and furious and ignorant. You attend every meeting for a year, nodding, pouring, loyal as a candle — and every night the tin under the floorboards feels one degree warmer.'
          ],
          effects:[
            {kind:'holdHeat',delta:8},
            fx?{kind:'fixerBurn',fixerId:fx.id}:{kind:'stat',stat:'happiness',delta:2},
            {kind:'memory',type:'episode_hold_burn',tags:['underworld'],valence:-.35,intensity:.75,summary:'THE HOLD LEDGER ended in fire: Subject fed the fold\'s routes to Ward 9 and burned the competition.'}
          ]
        }
      };
    }
    return body;
  };

  root.StoryEpisodes=EPISODES;
})(typeof globalThis!=='undefined'?globalThis:this);
