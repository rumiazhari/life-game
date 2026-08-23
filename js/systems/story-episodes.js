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
     EPISODE 4 — THE HOLD LEDGER (loyalty, suspicion, a name)
     ================================================================ */
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
