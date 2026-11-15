'use strict';
/* Player-chosen, concurrent story arcs. Content is data; effects are interpreted by QuestEngine. */
(function(root){
  root.QuestArcs=[
    {
      id:'missing_wages',icon:'📑',title:'The Missing Wages',tag:'WORK',gate:'worker',
      hook:'The factory ledger does not match the pay envelopes.',
      prep:'Before confronting the foreman…',
      preparation:[
        {id:'copies',label:'Copy the ledger',detail:'Evidence for negotiation',cost:20,item:'documents',boost:'study'},
        {id:'allies',label:'Talk to the crew',detail:'Trust before confrontation',boost:'social',effect:{relations:2}},
        {id:'direct',label:'Go alone',detail:'No cost; fewer protections'}
      ],
      crisis:'What do you do with the discrepancy?',
      approaches:[
        {id:'audit',label:'Show the missing figures',domain:'study',ability:'smarts',skill:'academics',dc:13,item:'documents',
          success:{happiness:4,wage:180,relations:3},failure:{scrutiny:7,happiness:-4},
          win:'The figures survive inspection. The foreman signs a corrected contract.',
          lose:'The foreman disputes your figures and puts your name on his list.'},
        {id:'organize',label:'Bring the workers together',domain:'social',ability:'relations',skill:'social',dc:12,
          success:{relations:8,happiness:4},failure:{relations:-3,scrutiny:5},
          win:'The crew stands together. The threat of collective testimony wins concessions.',
          lose:'The crew hesitates. Several workers now know you challenged the office.'},
        {id:'walk',label:'Leave the ledger alone',safe:true,
          success:{scrutiny:-2,happiness:-2},win:'You protect your job for now. The missing wages remain missing.'}
      ],
      echo:'A year later, the payroll clerk recognizes your name.',
      after:[
        {id:'protect',label:'Protect the crew',detail:'Preserve relationships',effect:{relations:3,happiness:1}},
        {id:'advance',label:'Use your leverage',detail:'Career pressure; additional scrutiny',effect:{scrutiny:3,happiness:3}}
      ]
    },
    {
      id:'night_ward',icon:'🩺',title:'The Night Ward',tag:'HEALTH',gate:'adult',
      hook:'A crowded clinic needs help before morning.',
      prep:'The ward is short on supplies.',
      preparation:[
        {id:'supplies',label:'Buy a treatment kit',detail:'Useful in the ward',cost:35,item:'medical_kit',boost:'study'},
        {id:'volunteer',label:'Meet the nurse',detail:'Learn the patient list',boost:'social',effect:{relations:2}},
        {id:'rest',label:'Arrive rested',detail:'Keep your strength',effect:{health:2}}
      ],
      crisis:'Patients are waiting. The nurse points to the worst cases.',
      approaches:[
        {id:'triage',label:'Sort patients by urgency',domain:'study',ability:'smarts',skill:'care',dc:12,item:'medical_kit',
          success:{health:2,relations:6},failure:{health:-7,happiness:-4},
          win:'Every urgent patient reaches the right bed before dawn.',
          lose:'The shift overwhelms you. You help, but at a personal cost.'},
        {id:'calm',label:'Organize the waiting room',domain:'social',ability:'relations',skill:'social',dc:11,
          success:{relations:7,happiness:3},failure:{relations:-2,health:-3},
          win:'Families cooperate and the nurses reclaim precious time.',
          lose:'Tensions flare. You stay until the room is safe again.'},
        {id:'donate',label:'Fund a night of supplies',safe:true,cost:80,
          success:{relations:5,happiness:3},win:'The clinic receives supplies. Nobody needs a lucky roll.'}
      ],
      echo:'A familiar nurse finds you on the street.',
      after:[
        {id:'teach',label:'Teach basic care',detail:'A useful skill endures',effect:{skill:'care',happiness:2}},
        {id:'visit',label:'Visit former patients',detail:'Relationships endure',effect:{relations:4}}
      ]
    },
    {
      id:'vanished_name',icon:'🕯️',title:'A Name Crossed Out',tag:'MYSTERY',gate:'adult',
      hook:'A neighbor disappears from the registry overnight.',
      prep:'There is one day before the records are sealed.',
      preparation:[
        {id:'letter',label:'Ask for a signed testimony',detail:'Build a trail',cost:10,item:'witness_letter',boost:'social'},
        {id:'archive',label:'Study the registry',detail:'Learn the filing codes',boost:'study',effect:{smarts:2}},
        {id:'alone',label:'Follow the rumor',detail:'Keep others out of danger'}
      ],
      crisis:'The Bureau clerk slides the missing file toward the furnace.',
      approaches:[
        {id:'petition',label:'Demand a review',domain:'bureau',ability:'smarts',skill:'academics',dc:14,item:'witness_letter',
          success:{scrutiny:-3,relations:5},failure:{scrutiny:10,happiness:-4},
          win:'A hearing number appears. The neighbor can now be traced.',
          lose:'The Bureau logs your interest. The missing file is still missing.'},
        {id:'shadow',label:'Steal the registry carbon',domain:'crime',ability:'smarts',skill:'craft',dc:15,item:'documents',
          success:{smarts:3,scrutiny:5},failure:{scrutiny:15,health:-4},
          win:'A carbon copy reveals where the neighbor was sent.',
          lose:'You escape with an incomplete page. The watchman saw your coat.'},
        {id:'memorial',label:'Keep their name alive',safe:true,
          success:{relations:4,happiness:-1},win:'Neighbors remember the person even if the Bureau refuses.'}
      ],
      echo:'Someone has been watching who kept asking questions.',
      after:[
        {id:'disclose',label:'Share what you learned',detail:'Public trust; official scrutiny',effect:{relations:5,scrutiny:4}},
        {id:'shelter',label:'Help the family quietly',detail:'A quieter kind of resistance',effect:{relations:3,happiness:3}}
      ]
    },
    {
      id:'breadline',icon:'🍞',title:'Breadline Winter',tag:'COMMUNITY',gate:'adult',
      hook:'The bakery is closing just as the queues grow longer.',
      prep:'The market opens in an hour.',
      preparation:[
        {id:'rations',label:'Acquire ration vouchers',detail:'A scarce resource',cost:25,item:'ration_vouchers',boost:'hustle'},
        {id:'farmers',label:'Call the growers',detail:'Build a supply contact',boost:'social',effect:{relations:2}},
        {id:'queue',label:'Join the queue',detail:'See how bad it gets'}
      ],
      crisis:'An argument breaks out over the last sacks of flour.',
      approaches:[
        {id:'allocate',label:'Organize fair distribution',domain:'social',ability:'relations',skill:'social',dc:12,item:'ration_vouchers',
          success:{relations:8,happiness:4},failure:{relations:-3,happiness:-4},
          win:'The flour is measured and everyone receives a share.',
          lose:'The queue breaks apart, but you learn who has gone hungry.'},
        {id:'repair',label:'Repair the failed mill',domain:'labor',ability:'smarts',skill:'craft',dc:13,
          success:{assets:80,relations:5},failure:{health:-5,assets:-20},
          win:'The mill grinds again. Local bread prices begin to ease.',
          lose:'The mill still needs parts, and you leave with burned hands.'},
        {id:'give',label:'Buy food for the queue',safe:true,cost:65,
          success:{relations:6,happiness:3},win:'A few families eat tonight. The structural shortage remains.'}
      ],
      echo:'The neighborhood remembers who was there in winter.',
      after:[
        {id:'cooperative',label:'Start a food circle',detail:'Share provisions next winter',effect:{relations:4,skill:'land'}},
        {id:'savings',label:'Rebuild household savings',detail:'Practical recovery',effect:{assets:25,happiness:1}}
      ]
    },
    {
      id:'last_freight',icon:'🚂',title:'The Last Freight',tag:'TRADE',gate:'adult',
      hook:'A stranded freight wagon carries goods meant for tomorrow’s market.',
      prep:'A stationmaster asks for a solution.',
      preparation:[
        {id:'permit',label:'Secure a trade permit',detail:'Official paperwork',cost:30,item:'trade_permit',boost:'bureau'},
        {id:'estimate',label:'Inspect the cargo',detail:'Find what can be salvaged',boost:'study',effect:{smarts:2}},
        {id:'crew',label:'Recruit volunteers',detail:'The honest route',boost:'labor',effect:{relations:2}}
      ],
      crisis:'The stationmaster gives you one chance to move the shipment.',
      approaches:[
        {id:'broker',label:'Negotiate a legal transfer',domain:'bureau',ability:'relations',skill:'retail',dc:13,item:'trade_permit',
          success:{assets:140,relations:3},failure:{assets:-25,scrutiny:4},
          win:'The shipment reaches the market. You receive a lawful commission.',
          lose:'The paperwork stalls and you pay for wasted transport.'},
        {id:'work',label:'Repair the wagon coupling',domain:'labor',ability:'health',skill:'craft',dc:13,
          success:{assets:100,relations:5},failure:{health:-7,assets:-15},
          win:'The wagons move before the evening whistle.',
          lose:'The wagon stays put, but the station crew learns your name.'},
        {id:'abandon',label:'Walk away from the risk',safe:true,
          success:{health:1,happiness:-1},win:'The shipment waits. Your own finances remain intact.'}
      ],
      echo:'A merchant sends word about the freight you handled.',
      after:[
        {id:'invest',label:'Build a trade network',detail:'Connections accumulate',effect:{relations:4,skill:'retail'}},
        {id:'save',label:'Put the earnings aside',detail:'Secure a small reserve',effect:{assets:30}}
      ]
    },
    {
      id:'household_promise',icon:'🗝️',title:'The Household Promise',tag:'FAMILY',gate:'family',
      hook:'A family friend asks you to keep a difficult promise.',
      prep:'No one agrees on what the promise meant.',
      preparation:[
        {id:'diary',label:'Find the old correspondence',detail:'A personal record',cost:10,item:'family_diary',boost:'study'},
        {id:'listen',label:'Hear every account',detail:'Give everyone a voice',boost:'social',effect:{familyMood:3}},
        {id:'decide',label:'Trust your own judgment',detail:'No extra preparation'}
      ],
      crisis:'Two relatives demand incompatible answers.',
      approaches:[
        {id:'mediate',label:'Hold a family meeting',domain:'social',ability:'relations',skill:'social',dc:12,item:'family_diary',
          success:{familyMood:9,happiness:4},failure:{familyMood:-7,happiness:-4},
          win:'The family signs a compromise none would have reached alone.',
          lose:'The argument grows sharper, but hidden grievances finally surface.'},
        {id:'evidence',label:'Explain the written promise',domain:'study',ability:'smarts',skill:'academics',dc:13,item:'family_diary',
          success:{familyMood:6,smarts:2},failure:{familyMood:-5,relations:-2},
          win:'The old words settle what memory could not.',
          lose:'The paper is ambiguous. The family must live with uncertainty.'},
        {id:'release',label:'Release everyone from the promise',safe:true,
          success:{familyMood:-2,happiness:5},win:'The family may disagree, but the obligation is finished.'}
      ],
      echo:'Months pass; relatives still recall the choice.',
      after:[
        {id:'reconcile',label:'Reconnect with the family',detail:'Try to rebuild trust',effect:{familyMood:4,relations:2}},
        {id:'boundaries',label:'Keep healthy distance',detail:'Keep your own peace',effect:{happiness:4,familyMood:-1}}
      ]
    }
  ];
})(typeof window!=='undefined'?window:globalThis);
