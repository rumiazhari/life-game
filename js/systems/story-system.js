'use strict';

/* Story & Dialogue engine (procedural life-stories).
 *
 * Owns World-persistent state:
 * - World.storyChains  ('story:NNNNN') -- live story arcs awaiting decisions
 * - World.storyArchive ('story-archive:NNNNN') -- resolved arcs kept for
 *   anti-repetition and epilogue flavor
 * - World.storyCounter / storySchemaVersion / storyLastTickYear / storySalt
 *
 * Design rules honored:
 * - Deterministic generation: every narrative draw comes from an isolated
 *   WorldSimulation.streamFor(world, year, 'story:'+salt, 'story') stream, so
 *   the same save replays byte-for-byte while different seeds/runs diverge.
 *   The salt counter increments per spawned arc, so the same archetype can
 *   never regenerate identical text even years apart.
 * - Anti-repetition: each resolved arc records a signature key
 *   (archetype|castKey). Signatures younger than SIGNATURE_FRESH_YEARS block
 *   respawning; older ones may recur only through a rare reuse roll.
 * - Consequences are declarative effect operations applied ONLY through
 *   authoritative state (S stats, contacts, Hold, NpcSystem relationships,
 *   RelationshipMemory). The system never writes EmploymentSystem/VacancySystem
 *   records directly -- workplace stories express outcomes through stats,
 *   bonds, memories, and Bureau scrutiny instead.
 * - Choices are consequential but their mechanical effects are hidden inside
 *   the dialogue window: the player sees flavor hints ("a generous lie",
 *   "the careful truth"), never the stat deltas, until the outcome is filed.
 * - Same-year idempotent tick with stale-year rejection; migration repairs
 *   malformed records without dropping any; bounded collections throughout.
 */

(function(root){
  const SCHEMA_VERSION=1;
  const SUBSYSTEM='story';
  const MAX_ACTIVE_CHAINS=3;
  const MAX_ARCHIVE=64;
  const MAX_CHAIN_HISTORY=24;
  const SPAWN_CHANCE=0.55;
  const SIGNATURE_FRESH_YEARS=6;
  const SIGNATURE_REUSE_CHANCE=0.15;
  const MIN_YEAR=-5000;
  const MAX_YEAR=5000;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const isValidCounter=value=>typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value)&&value>=0;
  const boundedYear=(value,fallback)=>{
    const safe=fallback!=null&&Number.isFinite(Number(fallback))?Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(fallback)))):0;
    if(value==null||!Number.isFinite(Number(value))) return safe;
    return Math.max(MIN_YEAR,Math.min(MAX_YEAR,Math.round(Number(value))));
  };
  const boundedYearOrNull=value=>value==null||!Number.isFinite(Number(value))?null:boundedYear(value,0);

  function ensure(world){
    if(!world||typeof world!=='object') throw new Error('StorySystem.ensure requires a world object');
    if(!world.storyChains||typeof world.storyChains!=='object'||Array.isArray(world.storyChains)) world.storyChains={};
    if(!world.storyArchive||typeof world.storyArchive!=='object'||Array.isArray(world.storyArchive)) world.storyArchive={};
    if(!isValidCounter(world.storyCounter)) world.storyCounter=0;
    if(!isValidCounter(world.storyArchiveCounter)) world.storyArchiveCounter=0;
    world.storyLastTickYear=boundedYearOrNull(world.storyLastTickYear);
    world.storySchemaVersion=SCHEMA_VERSION;
    return world;
  }

  /* ================= CAST RESOLUTION ================= */

  function subjectLabel(S){
    const first=S&&S.first||'The subject', last=S&&S.last||'';
    return (first+' '+last).trim();
  }
  function partnerContact(S){
    if(!S||!Array.isArray(S.contacts)) return null;
    return S.contacts.find(c=>c&&(c.role==='spouse'||c.role==='partner')&&c.alive!==false)||null;
  }
  function friendsOf(S){
    if(!S||!Array.isArray(S.contacts)) return [];
    return S.contacts.filter(c=>c&&c.role==='friend'&&c.alive!==false);
  }
  function parentsOf(S){
    const out=[];
    if(S&&S.mother&&S.mother.alive) out.push(Object.assign({relation:'mother'},S.mother));
    if(S&&S.father&&S.father.alive) out.push(Object.assign({relation:'father'},S.father));
    return out;
  }
  function childrenOf(lineage,S){
    const members=lineage&&Array.isArray(lineage.members)?lineage.members:[];
    const year=(typeof World!=='undefined'&&World&&World.year)||0;
    return members.filter(m=>m&&m.alive!==false&&m.relation==='child'&&year-m.dob>=5);
  }
  function colleaguesOf(world,S){
    const out=[];
    try{
      const ES=root.EmploymentSystem;
      if(!ES||typeof ES.activeForPerson!=='function') return out;
      const contract=ES.activeForPerson(world,'subject')[0];
      if(!contract) return out;
      const peers=ES.activeForBusiness(world,contract.businessId)||[];
      peers.forEach(peer=>{
        if(peer.personId==='subject'||out.length>=4) return;
        const npc=world.npcs&&world.npcs[peer.personId];
        if(npc&&npc.alive!==false) out.push({id:npc.id,name:npc.name||peer.personId});
      });
    }catch(e){}
    return out;
  }

  /* ================= EFFECT APPLICATION ================= */

  function clampStat(S,key,delta,chips){
    const cap=key==='health'&&S.healthCap!=null?S.healthCap:key==='looks'&&S.looksCap!=null?S.looksCap:100;
    const before=finite(S[key],50);
    const after=clamp(Math.round(before+delta),0,cap);
    S[key]=after;
    chips.push({txt:(delta>0?'+':'−')+Math.abs(delta)+' '+key.toUpperCase(),plus:delta>0});
    return after-before;
  }
  function clampMoney(S,delta,chips){
    const before=finite(S.assets,0);
    S.assets=clamp(before+delta,-200000,1000000);
    chips.push({txt:(delta>0?'+':'−')+'$'+Math.abs(delta).toLocaleString('en-US'),plus:delta>0});
  }
  function bump(target,field,delta,lo,hi,label,chips){
    const before=finite(target[field],lo+10);
    target[field]=clamp(before+delta,lo,hi);
    chips.push({txt:(delta>0?'+':'−')+Math.abs(delta)+' '+label,plus:delta>0});
  }

  function applyEffectOp(op,ctx){
    const S=ctx.S,chips=ctx.chips,world=ctx.world;
    switch(op.kind){
      case 'stat': clampStat(S,op.stat,op.delta,chips); break;
      case 'money': clampMoney(S,op.delta,chips); break;
      case 'partnerMood': {
        const p=partnerContact(S);
        if(p) bump(p,'mood',op.delta,0,100,'PARTNER',chips);
        else clampStat(S,'happiness',Math.round(op.delta*0.4),chips);
        break;
      }
      case 'familyMood': bump(S,'familyMood',op.delta,0,100,'FAMILY',chips); break;
      case 'parentMood': {
        const p=S[op.which];
        if(p&&p.alive) bump(p,'mood',op.delta,0,100,op.which==='mother'?'MOTHER':'FATHER',chips);
        break;
      }
      case 'contactMood': {
        const c=(S.contacts||[]).find(x=>x.cid===op.cid);
        if(c) bump(c,'mood',op.delta,0,100,'FRIEND',chips);
        break;
      }
      case 'vice': S.vice=clamp((S.vice||0)+op.delta,0,10); chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' VICE',plus:op.delta<0}); break;
      case 'scrutiny': S.scrutiny=clamp((S.scrutiny||0)+op.delta,0,100); chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' SCRUTINY',plus:op.delta<0}); break;
      case 'record': if(op.value===true&&!S.record){ S.record=true; chips.push({txt:'RECORD NOTATION',plus:false}); } break;
      case 'holdTrust': if(typeof Hold==='object'&&Hold) bump(Hold,'trust',op.delta,0,100,'HOLD TRUST',chips); break;
      case 'holdHeat': if(typeof Hold==='object'&&Hold) bump(Hold,'heat',op.delta,0,100,'HOLD HEAT',chips); break;
      case 'npcBond': {
        const npc=world.npcs&&world.npcs[op.npcId];
        if(npc&&root.NpcSystem&&typeof root.NpcSystem.relationship==='function'){
          const rel=root.NpcSystem.relationship(npc,String(S.npcId||'subject'),{closeness:50});
          const before=rel.closeness;
          rel.closeness=clamp(before+op.delta,0,100);
          chips.push({txt:(op.delta>0?'+':'−')+Math.abs(op.delta)+' BOND',plus:op.delta>0});
        }
        break;
      }
      case 'memory': {
        if(root.RelationshipMemory&&typeof root.RelationshipMemory.add==='function'){
          const participants=(op.participants||[]).filter(Boolean).map(String);
          while(participants.length<2) participants.push(participants.length?'karsen':'subject');
          root.RelationshipMemory.add(world,{
            year:ctx.year,
            type:op.type||'life_story',
            participants:[...new Set(participants)].sort(),
            intensity:clamp(finite(op.intensity,.6),0,1),
            valence:clamp(finite(op.valence,.4),-1,1),
            decay:.008,
            summary:String(op.summary||'A story left its mark.').slice(0,240),
            tags:['story'].concat(op.tags||[])
          });
        }
        break;
      }
      default: break;
    }
  }

  function outcomeTextFor(chain,choice,rng){
    const pool=choice.outcomes&&choice.outcomes.length?choice.outcomes:['The matter was filed away, one way or another.'];
    return rng.pick(pool);
  }

  function applyEffects(world,chainId,choiceIndex,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    const chain=world.storyChains[chainId];
    if(!chain) return {applied:false,reason:'missing_chain'};
    if(chain.status!=='decision') return {applied:false,reason:'already_resolved'};
    const year=boundedYear(opts.year,boundedYear(world.year,0));
    const chapter=chain.chapters[chain.chapterIndex];
    if(!chapter) return {applied:false,reason:'bad_chapter'};
    const choice=chapter.choices[choiceIndex];
    if(!choice) return {applied:false,reason:'bad_choice'};
    const rng=root.Random.create([world.seed||'seed',year,chain.id,chain.chapterIndex,choiceIndex,'outcome'].join('|'));
    const chips=[];
    const ctx={world,S,chips,year};
    (choice.effects||[]).forEach(op=>applyEffectOp(op,ctx));
    const outcome=outcomeTextFor(chain,choice,rng);
    chain.history.push({year,chapter:chain.chapterIndex,choice:choiceIndex,tone:choice.tone||'prudent'});
    if(chain.history.length>MAX_CHAIN_HISTORY) chain.history=chain.history.slice(-MAX_CHAIN_HISTORY);
    chain.lastTone=choice.tone||'prudent';
    chain.lastChoiceLabel=choice.label;
    chain.delivered=true;
    const isLast=chain.chapterIndex>=chain.chapters.length-1&&!archetypeNextChapter(chain);
    if(isLast){
      archiveChain(world,chain,year,outcome);
    }else{
      if(archetypeNextChapter(chain)){
        chain.pendingNext=true;       // next chapter is composed at next tick
      }
      chain.chapterIndex+=1;
      chain.status='awaiting_year';
      chain.readyYear=year+1;
    }
    return {applied:true,outcome,chips,completed:isLast,chain};
  }

  function archetypeById(id){ return STORIES.find(s=>s.id===id)||null; }
  function archetypeNextChapter(chain){
    const def=archetypeById(chain.archetypeId);
    return !!(def&&typeof def.nextChapter==='function');
  }

  /* ================= ARCHIVE ================= */

  function signatureKey(archetypeId,castKey){ return archetypeId+'|'+String(castKey||'subject'); }
  function archiveChain(world,chain,year,finalOutcome){
    const id='story-archive:'+String(++world.storyArchiveCounter).padStart(5,'0');
    world.storyArchive[id]={
      id,
      archetypeId:chain.archetypeId,
      domain:chain.domain,
      title:chain.title,
      castKey:chain.castKey||'',
      signature:signatureKey(chain.archetypeId,chain.castKey),
      startedYear:chain.startedYear,
      resolvedYear:year,
      tones:chain.history.map(h=>h.tone),
      finalOutcome:String(finalOutcome||'').slice(0,240)
    };
    delete world.storyChains[chain.id];
    trimArchive(world);
  }
  function trimArchive(world){
    const keys=Object.keys(world.storyArchive);
    if(keys.length<=MAX_ARCHIVE) return;
    keys.map(k=>world.storyArchive[k])
      .sort((a,b)=>a.resolvedYear-b.resolvedYear||String(a.id).localeCompare(String(b.id)))
      .slice(0,keys.length-MAX_ARCHIVE)
      .forEach(entry=>{delete world.storyArchive[entry.id];});
  }
  function signatureBlocked(world,signature,year){
    const entries=Object.values(world.storyArchive);
    for(const entry of entries){
      if(entry.signature!==signature) continue;
      if(year-(entry.resolvedYear||0)<SIGNATURE_FRESH_YEARS) return true;
    }
    return false;
  }

  /* ================= ARCHETYPE LIBRARY =================
   *
   * Each archetype: {id,domain,minAge,maxAge,eligible(ctx)->bool,
   *   weight(ctx),build(ctx)->chain-body}.
   * ctx={world,S,lineage,rng,year,cast:{...}}
   * A build() returns {title,castLabel,castKey,setup:[lines],prompt,choices:[
   *   {label,hint,tone,effects:[ops],outcomes:[lines]}]}
   * Optional nextChapter(ctx)->same shape, composed when the arc continues.
   * All pools are deliberately oversized: slots compose combinatorially, so
   * identical prose cannot repeat between occurrences.
   */

  function personLine(rng,pools){ return rng.pick(pools); }

  function spouseArc(ctx){
    const {rng,S}=ctx;
    const p=partnerContact(S);
    const name=p?p.name:'your partner';
    const frictions=[
      ['the same argument about money, worn smooth at the edges','the money talk that never lands anywhere except sideways'],
      ['the silence that sets in around nine each evening','the way the flat goes quiet an hour before bed lately'],
      ['the second job that keeps them out past dark','the overtime that has quietly eaten the month']
    ];
    const f=rng.pick(frictions);
    const setup=[
      rng.pick([
        'Winter came early this year, and '+name+' came home late with frost still in their collar. '+f[0]+' sat between you like a third chair nobody claims.',
        'There is a version of the evening where you ask about '+f[1]+'. '+name+' keeps almost starting it, then filing it away unspoken.',
        'You have both been very reasonable about '+f[1]+'. Reasonableness, it turns out, accumulates interest.'
      ]),
      rng.pick([
        'The Bureau’s marriage pamphlets call this “a communicable period.” The pamphlets have never met '+name+'.',
        'Your mother would say talk. Your father would say fix something. Neither of them ever met '+name+' on a Tuesday like this.',
        'The neighbours’ radio leaks a love song through the wall, badly timed, like most advice.'
      ])
    ];
    return {
      title:rng.pick(['THE QUIET IN FLAT '+(rng.int(2,58)),'WHAT WASN’T SAID IN YEAR '+ctx.year,'THE LONG WAY TO SAY IT']),
      castLabel:'with '+name,
      castKey:p?(p.cid||p.name):'ghost-partner',
      setup,
      prompt:rng.pick(['How does the subject play the evening?','What gets said, tonight?']),
      choices:[
        {label:'Sit down and say the true thing',hint:'it costs the rest of your composure',tone:'kind',
          effects:[{kind:'partnerMood',delta:14},{kind:'stat',stat:'happiness',delta:-3},
            {kind:'memory',type:'marriage_honesty',valence:.7,intensity:.7,summary:'Subject and '+name+' finally said the true thing about '+f[1]+'.'}],
          outcomes:['It went badly for ten minutes and then, all at once, well. '+name+' cried a little, laughed once, and stayed up with you past midnight.','The words came out crooked but they came out. Something in the flat unlocked; the door to the bedroom stopped sounding like a verdict.']},
        {label:'Fix something concrete instead',hint:'love, in installments',tone:'prudent',
          effects:[{kind:'partnerMood',delta:7},{kind:'money',delta:-90},{kind:'stat',stat:'relations',delta:2},
            {kind:'memory',type:'marriage_repair',valence:.45,intensity:.45,summary:'Subject answered '+f[1]+' with practical repairs instead of words.'}],
          outcomes:['You repaired the thing that squeaks and banked the gesture. '+name+' noticed. Most of it landed; some of it was just a fixed thing.','The practical route: new hinges, paid bill, warm supper. It buys peace the way coal buys heat — room by room, never the whole house.']},
        {label:'Let the silence keep',hint:'some debts compound quietly',tone:'cold',
          effects:[{kind:'partnerMood',delta:-9},{kind:'stat',stat:'happiness',delta:2},
            {kind:'memory',type:'marriage_distance',valence:-.4,intensity:.4,summary:'Subject let the silence about '+f[1]+' keep another year.'}],
          outcomes:['Nobody fought, which is a kind of score. The silence settled in like a tenant with a good references.','You got your evenings back, or the shape of them. The unsaid thing moved deeper into the walls.']}
      ]
    };
  }
  spouseArc.domain='spouse';
  spouseArc.eligible=ctx=>{
    const p=partnerContact(ctx.S);
    return !!(p&&(p.mood==null||p.mood<62));
  };
  spouseArc.weight=()=>3;

  function parentLoanArc(ctx){
    const {rng,S}=ctx;
    const parent=rng.pick(parentsOf(S));
    const who=parent.relation==='mother'?'Mother':'Father';
    const name=parent.name||who;
    const reasons=['the boiler finally died','a debt with a red stamp on it','the good coat, stolen on the tram','the dentist, again'];
    const reason=rng.pick(reasons);
    const amount=rng.pick([80,120,180,240]);
    const setup=[
      who+' telephones from the old district. The voice is smaller than the news: '+reason+', and the arithmetic does not work this month.',
      rng.pick([
        'There is a pause where a proud person decides, once, to stop being proud.',
        '“I’ll pay it back by spring,” says '+name+', in the tone of someone who has measured springs before.'
      ])
    ];
    return {
      title:'THE TELEPHONE LETTER FORM',
      castLabel:'with '+name,
      castKey:name,
      setup,
      prompt:rng.pick(['The receiver stays warm in your hand. What does the subject do?','Answer carefully.']),
      choices:[
        {label:'Send the full sum',hint:'your own envelope math suffers',tone:'kind',
          effects:[{kind:'money',delta:-amount},{kind:'parentMood',which:parent.relation,delta:16},{kind:'stat',stat:'happiness',delta:2},
            {kind:'memory',type:'family_aid',valence:.65,intensity:.6,summary:'Subject sent '+amount+' to '+name+' when '+reason+'.'}],
          outcomes:['The parcel goes out Tuesday. Sunday brings a letter in careful pencil: overpaid, it says, though nothing about that word is true.','You send it all. The thank-you note arrives folded like official paper and means considerably more.']},
        {label:'Send half, promise the rest',hint:'arithmetic as diplomacy',tone:'prudent',
          effects:[{kind:'money',delta:-Math.round(amount/2)},{kind:'parentMood',which:parent.relation,delta:6},{kind:'stat',stat:'relations',delta:1},
            {kind:'memory',type:'family_aid_partial',valence:.35,intensity:.35,summary:'Subject split the difference on '+name+'’s '+reason+'.'}],
          outcomes:['Half now, half in spring. Everyone signs on to a plan nobody believes fully, which is what plans are for.','You send what the budget surrenders. '+who+' says it is plenty. The pause before saying so is not.']},
        {label:'Explain that you cannot',hint:'the truth, unpaid',tone:'cold',
          effects:[{kind:'parentMood',which:parent.relation,delta:-8},{kind:'stat',stat:'happiness',delta:-3},
            {kind:'memory',type:'family_refusal',valence:-.35,intensity:.35,summary:'Subject could not help '+name+' with '+reason+'.'}],
          outcomes:['You tell the truth plainly. '+who+' takes it the way people of that generation take everything: completely, and silently.','The honest no costs more than the money would have. It stays on the line between you, collect.']}
      ]
    };
  }
  parentLoanArc.domain='family';
  parentLoanArc.eligible=ctx=>parentsOf(ctx.S).length>0&&ctx.S.age>=20&&ctx.S.age<=55;
  parentLoanArc.weight=()=>2;
  parentLoanArc.nextChapter=ctx=>{
    const parent=ctx.rng.pick(parentsOf(ctx.S));
    const who=parent.relation==='mother'?'Mother':'Father';
    const repaid=ctx.rng.pick([
      'An envelope arrives with exactly the promised sum and a pressed flower inside, which is unlike '+who+' entirely.',
      who+' repays it in installments of coins taped to postcards, each stamped as if the coins might escape.',
      'No money comes. Instead: jam, a scarf, a repaired photograph of you at seven. Repayment, apparently, is a currency exchange.'
    ]);
    return {
      title:'REPAYMENT, IN KIND OR OTHERWISE',
      castLabel:'from '+who.toLowerCase(),
      castKey:parent.name||who,
      setup:[repaid],
      prompt:'How does the subject answer?',
      choices:[
        {label:'Accept it gracefully',hint:'let the ledger stay emotional',tone:'kind',
          effects:[{kind:'parentMood',which:parent.relation,delta:8},{kind:'stat',stat:'happiness',delta:3}],
          outcomes:['You thank '+who+' properly. Somewhere in the exchange the debt stops being arithmetic and becomes what it always was.']},
        {label:'Refuse repayment quietly',hint:'a gift with the receipts removed',tone:'prudent',
          effects:[{kind:'parentMood',which:parent.relation,delta:12},{kind:'money',delta:0}],
          outcomes:['You wave it off. '+who+' argues. You win, which is the only acceptable outcome of arguing with '+who+'.']}
      ]
    };
  };

  function colleagueCoverArc(ctx){
    const {rng}=ctx;
    const peer=ctx.cast.colleague||colleaguesOf(ctx.world)[0]||null;
    const name=peer?peer.name:'a colleague';
    const mishaps=['a mislabeled shipment that went out wrong','an entry deleted that should have stood','the quarterly figures, transposed','a form signed with the wrong stamp'];
    const mishap=rng.pick(mishaps);
    const setup=[
      name+' catches you by the filing cabinets, grey as yesterday’s tea. There has been '+mishap+', and the trail leads to their desk, and the inspection is Thursday.',
      rng.pick([
        '“They don’t dismiss people for one mistake,” '+name+' says, which is the sort of sentence that needs saying quickly, before anyone tests it.',
        'Everyone in the section likes '+name+'. That is worth something, right up until it is worth nothing at all.'
      ])
    ];
    return {
      title:'THURSDAY PROBLEM',
      castLabel:'with '+name,
      castKey:name,
      setup,
      prompt:'What does the subject do with what they know?',
      choices:[
        {label:'Cover for them',hint:'one ledger lies a little',tone:'kind',
          effects:[{kind:'npcBond',npcId:peer?peer.id:null,delta:14},{kind:'stat',stat:'happiness',delta:-2},{kind:'scrutiny',delta:4},
            {kind:'memory',type:'workplace_loyalty',participants:peer?[String(peer.id)]:undefined,valence:.55,intensity:.55,summary:'Subject covered for '+name+' over '+mishap+'.'}],
          outcomes:['Thursday comes and goes. The correction “found” in the files is dated three days ago, and '+name+' owes you a debt with no due date.','You stay late retyping the record. Nobody thanks anybody out loud. On Friday, '+name+'’s coffee appears on your desk, unpurchased by you.']},
        {label:'Tell them to report it themselves',hint:'the clean road, uphill',tone:'prudent',
          effects:[{kind:'npcBond',npcId:peer?peer.id:null,delta:3},{kind:'stat',stat:'relations',delta:2},
            {kind:'memory',type:'workplace_integrity',participants:peer?[String(peer.id)]:undefined,valence:.3,intensity:.3,summary:'Subject made '+name+' own '+mishap+' honestly.'}],
          outcomes:['They self-report. The section head nods like a man accepting rain. '+name+' is colder for a month, then finer forever after — usually.']},
        {label:'Note it, and file it where files go',hint:'knowledge is a currency',tone:'greedy',
          effects:[{kind:'npcBond',npcId:peer?peer.id:null,delta:-6},{kind:'stat',stat:'smarts',delta:1},{kind:'scrutiny',delta:-2},
            {kind:'memory',type:'workplace_leverage',participants:peer?[String(peer.id)]:undefined,valence:-.25,intensity:.4,summary:'Subject kept quiet knowledge of '+mishap+' in reserve.'}],
          outcomes:['You say all the reassuring things and file the fact where you file useful things. It sits there, patient, drawing interest.']}
      ]
    };
  }
  colleagueCoverArc.domain='work';
  colleagueCoverArc.eligible=ctx=>{
    const contract=(function(){try{return root.EmploymentSystem.activeForPerson(ctx.world,'subject')[0];}catch(e){return null;}})();
    if(!contract) return false;
    ctx.cast.colleague=colleaguesOf(ctx.world)[0]||null;
    return !!ctx.cast.colleague;
  };
  colleagueCoverArc.weight=()=>2.5;

  function friendLoanArc(ctx){
    const {rng,S}=ctx;
    const friends=friendsOf(S);
    const friend=rng.pick(friends);
    const name=friend.name;
    const schemes=['a course that starts in autumn','tools for work that “starts Monday”','a deposit on a room with a real window','getting out of a lease with their skin intact'];
    const scheme=rng.pick(schemes);
    const amount=rng.pick([60,100,150]);
    const setup=[
      name+' turns up at the door with the particular smile of a person about to convert friendship into finance. They need '+amount+'. It is for '+scheme+'.',
      rng.pick([
        'You have known '+name+' since before either of you could spell “creditor.”',
        name+' has bailed you out exactly once, years ago, in weather neither of you has forgotten.'
      ])
    ];
    return {
      title:'A FRIEND IN NEED OF A SUM',
      castLabel:'with '+name,
      castKey:name,
      setup,
      prompt:rng.pick(['The kettle is doing its best to fill the pause.','Choose.']),
      choices:[
        {label:'Lend it freely',hint:'friendship as collateral',tone:'kind',
          effects:[{kind:'contactMood',cid:friend.cid,delta:15},{kind:'money',delta:-amount},
            {kind:'memory',type:'friendship_loan',participants:[String(S.npcId||'subject')],valence:.6,intensity:.55,summary:'Subject lent '+name+' '+amount+' for '+scheme+'.'}],
          outcomes:['The money changes hands with a handshake that lasts a second too long to be business. '+scheme+' happens, mostly because someone believed in it.','You lend it without writing anything down. Some months later a parcel arrives: no note, just excellent coffee and your faith vindicated.']},
        {label:'Offer half and honest doubt',hint:'help with conditions attached',tone:'prudent',
          effects:[{kind:'contactMood',cid:friend.cid,delta:5},{kind:'money',delta:-Math.round(amount/2)},{kind:'stat',stat:'smarts',delta:1},
            {kind:'memory',type:'friendship_halfloan',valence:.3,intensity:.3,summary:'Subject part-funded '+name+'’s '+scheme+' with reservations.'}],
          outcomes:['Half the sum, twice the lecture. '+name+' takes both, because that is what old friendships are engineered to carry.']},
        {label:'Say no, kindly',hint:'the expensive word',tone:'cold',
          effects:[{kind:'contactMood',cid:friend.cid,delta:-12},{kind:'stat',stat:'happiness',delta:-1},
            {kind:'memory',type:'friendship_refusal',valence:-.3,intensity:.3,summary:'Subject declined '+name+'’s request for '+amount+'.'}],
          outcomes:['You say no like removing a splinter: quickly, kindly, and it still hurts. '+name+' understands, eventually, in the way friends do — or don’t, for a season.']}
      ]
    };
  }
  friendLoanArc.domain='friend';
  friendLoanArc.eligible=ctx=>friendsOf(ctx.S).length>0;
  friendLoanArc.weight=()=>2.5;

  function bureauNoticeArc(ctx){
    const {rng,S}=ctx;
    const discrepancies=['a middle initial that belongs to somebody else','an employment date off by one year','a deceased uncle listed as a dependent','two addresses, both yours, one demolished'];
    const d=rng.pick(discrepancies);
    const clerkNames=['Clerk Havlik','Clerk Brandt','Clerk Ostrava','Clerk Meissner','Clerk Dvorak'];
    const clerk=rng.pick(clerkNames);
    const setup=[
      'A form arrives, grey as porridge. Somewhere in Column 14 there is '+d+'. The correction window closes in eleven days.',
      rng.pick([
        clerk+' handles corrections on alternate Thursdays, cash adjustments unofficially, and eye contact never.',
        'The form notes, helpfully, that inaccuracies discovered after the window “become features of the record.”'
      ])
    ];
    return {
      title:'NOTICE OF DISCREPANCY 11-B',
      castLabel:'from the Bureau of Records',
      castKey:d,
      setup,
      prompt:rng.pick(['Eleven days. Choose.','How does the subject proceed?']),
      choices:[
        {label:'Correct it through proper channels',hint:'queues, forms, patience',tone:'prudent',
          effects:[{kind:'scrutiny',delta:-4},{kind:'stat',stat:'happiness',delta:-1},
            {kind:'memory',type:'bureau_correction',valence:.2,intensity:.3,summary:'Subject corrected '+d+' through official channels.'}],
          outcomes:['Three queues and a supplementary form later, the record is accurate. Nobody says thank you. Accuracy is its own grey reward.','You spend a Wednesday being processed. The file emerges cleaner, which is the Bureau’s idea of a happy ending, and today it is yours too.']},
        {label:'Settle it privately with '+clerk,hint:'cash adjusts many columns',tone:'greedy',
          effects:[{kind:'money',delta:-60},{kind:'stat',stat:'happiness',delta:1},{kind:'record',value:true},{kind:'scrutiny',delta:6},
            {kind:'memory',type:'bureau_grease',valence:-.2,intensity:.4,summary:'Subject paid '+clerk+' privately over '+d+'.'}],
          outcomes:[clerk+' pockets the consideration with bureaucratic elegance and stamps CORRECTED. Two errors cancel; somewhere a ledger remembers both.','It works, which is the trouble with it. The file closes quiet as a bribe in a hymnbook.']},
        {label:'Ignore it — it is obviously trivial',hint:'the record disagrees',tone:'cold',
          effects:[{kind:'scrutiny',delta:10},{kind:'record',value:true},
            {kind:'memory',type:'bureau_neglect',valence:-.35,intensity:.35,summary:'Subject ignored Notice 11-B regarding '+d+'.'}],
          outcomes:['The window closes. The discrepancy, unsupported by paperwork, promotes itself to a feature of the record. You feel it watching.','Nothing happens immediately, which is the Bureau’s favorite kind of happening.']}
      ]
    };
  }
  bureauNoticeArc.domain='bureau';
  bureauNoticeArc.eligible=ctx=>ctx.S.age>=18;
  bureauNoticeArc.weight=()=>1.8;

  function neighborFeudArc(ctx){
    const {rng}=ctx;
    const sides=['the hedge that straddles everything','a shared stairwell and competing definitions of “tidy”','laundry lines and the physics of drips','the fence post moved one meter overnight'];
    const side=rng.pick(sides);
    const neighbors=['the Novaks from the third floor','old Halasz and his dog','the twins in the annex','the family with the loud clock'];
    const neighbor=rng.pick(neighbors);
    const setup=[
      'It has come to '+side+'. With '+neighbor+', it was always going to.',
      rng.pick([
        'The district mediator owns a folder labeled NEIGHBOURS, VOL. XII. Your building features prominently.',
        'Petitions circulate. Counter-petitions counter-circulate. Someone involves the Bureau, because someone always does.'
      ])
    ];
    return {
      title:'DISPUTE OVER SMALL TERRITORY',
      castLabel:'involving '+neighbor,
      castKey:neighbor,
      setup,
      prompt:rng.pick(['How does the subject play it?','Choose a posture.']),
      choices:[
        {label:'Broker peace with tea and concessions',hint:'diplomacy, lightly sugared',tone:'kind',
          effects:[{kind:'stat',stat:'relations',delta:5},{kind:'stat',stat:'happiness',delta:3},{kind:'money',delta:-15},
            {kind:'memory',type:'neighbor_peace',valence:.55,intensity:.4,summary:'Subject mediated the dispute over '+side+'.'}],
          outcomes:['Tea happens. Concessions happen, mostly yours, mostly symbolic. By month’s end '+neighbor+' is helping carry your stove upstairs. Peace is cheap at the price.']},
        {label:'Win the formal complaint',hint:'victory, notarized',tone:'prudent',
          effects:[{kind:'stat',stat:'happiness',delta:1},{kind:'scrutiny',delta:3},
            {kind:'memory',type:'neighbor_victory',valence:.15,intensity:.4,summary:'Subject prevailed formally over '+neighbor+' regarding '+side+'.'}],
          outcomes:['The ruling arrives with a blue stamp: yours. '+neighbor+' complies with the enthusiasm of a hostage. The stairwell has never been so precisely quiet.']}
        ,
        {label:'Escalate on principle',hint:'wars of small territory',tone:'greedy',
          effects:[{kind:'stat',stat:'happiness',delta:-3},{kind:'stat',stat:'health',delta:-2},{kind:'scrutiny',delta:4},
            {kind:'memory',type:'neighbor_feud',valence:-.45,intensity:.5,summary:'Subject escalated the feud over '+side+'.'}],
          outcomes:['Principle proves expensive. The feud acquires rules of engagement, then traditions, then anniversaries. The building watches like a stadium.']}
      ]
    };
  }
  neighborFeudArc.domain='neighbor';
  neighborFeudArc.eligible=ctx=>ctx.S.age>=18;
  neighborFeudArc.weight=()=>1.6;

  function holdErrandArc(ctx){
    const {rng}=ctx;
    const favors=['move a sealed crate across town, unasked questions waived','lend your address to a stranger for one winter','carry a verbal message to the docks, memorize then swallow it','sit in a waiting room looking ordinary for two hours'];
    const favor=rng.pick(favors);
    const setup=[
      'The fold sends word through the usual channel: a favor is needed. Nothing large. '+favor.charAt(0).toUpperCase()+favor.slice(1)+'.',
      rng.pick([
        'Trust in the fold is a ladder. This is one of the rungs.',
        'Refusals are remembered in the fold the way birthdays are remembered elsewhere: accurately.'
      ])
    ];
    return {
      title:'THE FOLD ASKS',
      castLabel:'from the Hold',
      castKey:favor,
      setup,
      prompt:'Well?',
      choices:[
        {label:'Do it without questions',hint:'rungs, climbed',tone:'kind',
          effects:[{kind:'holdTrust',delta:12},{kind:'holdHeat',delta:5},{kind:'stat',stat:'happiness',delta:2},
            {kind:'memory',type:'hold_service',tags:['underworld'],valence:.5,intensity:.5,summary:'Subject ran an errand for the fold: '+favor+'.'}],
          outcomes:['Done before dawn. By evening the fold knows, the way the fold knows everything: completely, and without paperwork. Your name moves up a rung.']},
        {label:'Ask what it is really for',hint:'curiosity, priced',tone:'prudent',
          effects:[{kind:'holdTrust',delta:3},{kind:'stat',stat:'smarts',delta:1},
            {kind:'memory',type:'hold_question',tags:['underworld'],valence:.1,intensity:.35,summary:'Subject asked pointed questions about a fold errand.'}],
          outcomes:['You get half an answer and a long look. The half-answer checks out. The look suggests the other half checked you out too.']},
        {label:'Plead a quiet year',hint:'the fold keeps books',tone:'cold',
          effects:[{kind:'holdTrust',delta:-10},{kind:'stat',stat:'happiness',delta:-1},
            {kind:'memory',type:'hold_declined',tags:['underworld'],valence:-.3,intensity:.35,summary:'Subject declined a fold request: '+favor+'.'}],
          outcomes:['The messenger nods, unsurprised, and leaves with your excuse wrapped carefully for delivery. Doors in the fold do not slam; they simply stop being mentioned.']}
      ]
    };
  }
  holdErrandArc.domain='hold';
  holdErrandArc.eligible=ctx=>!!ctx.S.holdMember;
  holdErrandArc.weight=()=>2;

  function childStruggleArc(ctx){
    const {rng,lineage,S}=ctx;
    const kids=childrenOf(lineage,S);
    const kid=rng.pick(kids);
    const name=kid.first||'the little one';
    const troubles=['numbers sit wrong in their head and stare back','a bully with seniority and sharp elbows','letters swimming on the page','a teacher who has decided, prematurely'];
    const trouble=rng.pick(troubles);
    const setup=[
      'The school sends a note about '+name+': '+trouble+'. The note is polite the way summonses are polite.',
      rng.pick([
        'At supper '+name+' pushes food around the plate and waits to see which kind of parent shows up.',
        'You remember being eight and enormous problems wearing small shoes.'
      ])
    ];
    return {
      title:'NOTE HOME FROM THE SCHOOL',
      castLabel:'about '+name,
      castKey:kid.mid||name,
      setup,
      prompt:'What does the subject do?',
      choices:[
        {label:'Take time off; sit with the school together',hint:'hours now, trust forever',tone:'kind',
          effects:[{kind:'familyMood',delta:14},{kind:'stat',stat:'happiness',delta:4},{kind:'stat',stat:'health',delta:-1},
            {kind:'memory',type:'parent_advocacy',participants:[kid.npcId].filter(Boolean),valence:.7,intensity:.6,summary:'Subject stood beside '+name+' over '+trouble+'.'}],
          outcomes:['You go down and sit small in a small chair and fight for your kid politely, thoroughly, and without leaving. '+name+' watches you do it. That is the lesson, and it takes.']},
        {label:'Pay for proper tutoring',hint:'money as advocacy',tone:'prudent',
          effects:[{kind:'money',delta:-120},{kind:'familyMood',delta:8},
            {kind:'memory',type:'parent_tutoring',participants:[kid.npcId].filter(Boolean),valence:.5,intensity:.5,summary:'Subject hired tutoring for '+name+'.'}],
          outcomes:['The tutor arrives Thursdays with soft chalk and firm methods. By spring the numbers stop staring. Money well spent has a sound; this was it.']},
        {label:'Let them fight their own battle',hint:'steel, or rust',tone:'cold',
          effects:[{kind:'familyMood',delta:-6},{kind:'stat',stat:'smarts',delta:1},
            {kind:'memory',type:'parent_hands_off',participants:[kid.npcId].filter(Boolean),valence:-.2,intensity:.3,summary:'Subject let '+name+' handle school alone.'}],
          outcomes:['You stay out of it. Some weeks it looks like wisdom. One evening '+name+' wins alone and doesn’t tell you until much later, and you learn what your absence charges.']}
      ]
    };
  }
  childStruggleArc.domain='child';
  childStruggleArc.eligible=ctx=>childrenOf(ctx.lineage,ctx.S).length>0;
  childStruggleArc.weight=()=>2.5;

  function studentTemptationArc(ctx){
    const {rng,S}=ctx;
    const exams=['the Middle examinations','the Upper School finals','the University colloquium','the entrance papers'];
    const exam=rng.pick(exams);
    const setup=[
      rng.pick([
        'The invigilator coughs, opens the window, and looks at the sky for exactly the length of an answer.',
        'The boy beside you — the one whose arithmetic sings — angles his paper by four degrees, a whole grammar of generosity in the angle.'
      ]),
      exam+' are here, and the subject is not ready. There is a version of this hour where the answers travel.'
    ];
    return {
      title:'EXAMINATION CONDITIONS APPLY',
      castLabel:'in the examination hall',
      castKey:exam,
      setup,
      prompt:'The clock over the door is a bureaucrat. Choose.',
      choices:[
        {label:'Stare at your own paper and bleed',hint:'honest marks, some of them red',tone:'prudent',
          effects:[{kind:'stat',stat:'smarts',delta:2},{kind:'stat',stat:'happiness',delta:-3},
            {kind:'memory',type:'exam_honest',valence:.35,intensity:.4,summary:'Subject sat '+exam+' honestly under-prepared.'}],
          outcomes:['You fail two sections and pass the rest with your name intact. The walk home is long, then shorter than expected. Knowledge bought at list price sticks.']},
        {label:'Copy the angled paper',hint:'borrowed light',tone:'greedy',
          effects:[{kind:'stat',stat:'happiness',delta:2},{kind:'scrutiny',delta:6},{kind:'record',value:true},
            {kind:'memory',type:'exam_copied',valence:-.3,intensity:.4,summary:'Subject copied answers during '+exam+'.'}],
          outcomes:['You pass cleanly, which is the problem. The mark follows you: bright, unearned, and faintly warm, like a coin from a stranger’s pocket.']},
        {label:'Angel the struggling neighbour instead',hint:'generosity, examinable',tone:'kind',
          effects:[{kind:'stat',stat:'relations',delta:4},{kind:'scrutiny',delta:8},{kind:'record',value:true},
            {kind:'memory',type:'exam_assisted',valence:.1,intensity:.4,summary:'Subject slipped answers to a classmate during '+exam+'.'}],
          outcomes:['Your classmate passes. You pass too, barely, honestly where it counted and nowhere else. An oath is sworn in the schoolyard involving blood, or at least ink.']}
      ]
    };
  }
  studentTemptationArc.domain='school';
  studentTemptationArc.eligible=ctx=>!!(ctx.S.eduStage||ctx.S.age<19);
  studentTemptationArc.minAge=12; studentTemptationArc.maxAge=26;
  studentTemptationArc.weight=()=>2;

  function strangerKindnessArc(ctx){
    const {rng}=ctx;
    const scenes=['at the tram shelter in horizontal sleet','outside the pawnshop at closing','on the bridge, in the wrong hour','behind the market among the crushed crates'];
    const scene=rng.pick(scenes);
    const strangers=['a girl holding an empty birdcage','an old man with a suitcase and no coat','a woman counting coins for the third time','a boy selling matches that smell of nothing'];
    const stranger=rng.pick(strangers);
    const setup=[
      rng.pick(['You encounter '+stranger+' '+scene+'.','The city introduces you, briefly, to '+stranger+' — '+scene+', where the city keeps its embarrassments.']),
      rng.pick(['Their situation requires no narration. You can do arithmetic by sight.','Some people are wet from the outside in. This is one of those hours.'])
    ];
    return {
      title:'ENCOUNTER ON THE RECORD, UNWITNESSED',
      castLabel:stranger,
      castKey:stranger,
      setup,
      prompt:'The moment is narrow. Choose.',
      choices:[
        {label:'Give what the pocket allows',hint:'warmth, transferable',tone:'kind',
          effects:[{kind:'money',delta:-40},{kind:'stat',stat:'happiness',delta:5},{kind:'stat',stat:'relations',delta:2},
            {kind:'memory',type:'kindness_stranger',valence:.75,intensity:.55,summary:'Subject helped '+stranger+' '+scene+'.'}],
          outcomes:['You give it. The thanks is one syllable and enormous. The tram arrives; the city resumes; something in your chest files this under assets.']},
        {label:'Share supper and the bench',hint:'time is the richer coin',tone:'kind',
          effects:[{kind:'money',delta:-20},{kind:'stat',stat:'happiness',delta:4},{kind:'stat',stat:'health',delta:-1},
            {kind:'memory',type:'kindness_company',valence:.7,intensity:.5,summary:'Subject shared supper with '+stranger+'.'}],
          outcomes:['You eat together hardly speaking. Their story surfaces in fragments, like laundry in bad weather. Parting feels wrong and is right.']},
        {label:'Walk on; the city is full of sorrows',hint:'self-preservation, cold-pressed',tone:'cold',
          effects:[{kind:'stat',stat:'happiness',delta:-2},
            {kind:'memory',type:'passed_by',valence:-.25,intensity:.3,summary:'Subject walked past '+stranger+' '+scene+'.'}],
          outcomes:['You walk. You are warm inside your coat, which fits better than it did an hour ago, or worse. The bridge keeps its own ledger.']}
      ]
    };
  }
  strangerKindnessArc.domain='stranger';
  strangerKindnessArc.eligible=ctx=>ctx.S.age>=14;
  strangerKindnessArc.weight=()=>1.7;

  function elderCareArc(ctx){
    const {rng,S}=ctx;
    const parent=rng.pick(parentsOf(S));
    const who=parent.relation==='mother'?'Mother':'Father';
    const declines=['the stairs have become an adversary','names arrive late and leave early','the winter took something mobility-shaped','the hands have developed a tremor with opinions'];
    const decline=rng.pick(declines);
    const setup=[
      who+' is failing in the specific way of '+decline+'. Not urgent, the doctor says, which in Bureau dialect means inevitable and slow.',
      rng.pick([
        'The question is not whether but where, and who, and how much of your life it costs.',
        'You grew up inside this person’s competence. Watching it pack its bags is its own education.'
      ])
    ];
    return {
      title:'ARRANGEMENTS FOR '+who.toUpperCase(),
      castLabel:'regarding '+who.toLowerCase(),
      castKey:parent.name||who,
      setup,
      prompt:rng.pick(['Choose the arrangement.','Decide.']),
      choices:[
        {label:'Move them in, whatever the crowding',hint:'rooms remember',tone:'kind',
          effects:[{kind:'parentMood',which:parent.relation,delta:18},{kind:'familyMood',delta:6},{kind:'money',delta:-150},{kind:'stat',stat:'happiness',delta:3},
            {kind:'memory',type:'elder_taken_in',valence:.7,intensity:.7,summary:'Subject took '+who+' in when '+decline+'.'}],
          outcomes:['It is cramped, loud, and occasionally holy. '+who+' teaches your kid cards and criticizes your cooking, and the house rearranges itself around added life.']},
        {label:'Fund the respectable home up the hill',hint:'care, outsourced with love',tone:'prudent',
          effects:[{kind:'money',delta:-260},{kind:'parentMood',which:parent.relation,delta:4},{kind:'stat',stat:'happiness',delta:-1},
            {kind:'memory',type:'elder_home',valence:.2,intensity:.5,summary:'Subject arranged care for '+who+' at a home.'}],
          outcomes:['The home is clean and kind in an institutional accent. Visiting Sundays, you drink weak tea from the good tray, and '+who+' pretends harder than you do.']},
        {label:'Leave arrangements to the family council',hint:'committees move slowly downhill',tone:'cold',
          effects:[{kind:'parentMood',which:parent.relation,delta:-10},{kind:'stat',stat:'relations',delta:-3},
            {kind:'memory',type:'elder_deferred',valence:-.35,intensity:.4,summary:'Subject deferred decisions about '+who+'’s care.'}],
          outcomes:['Letters circulate. Positions harden. Nothing is decided, which is a decision, and '+who+' knows it, and says nothing, which says it.']}
      ]
    };
  }
  elderCareArc.domain='family';
  elderCareArc.eligible=ctx=>parentsOf(ctx.S).length>0&&ctx.S.age>=28;
  elderCareArc.weight=()=>1.8;

  const STORIES=[spouseArc,parentLoanArc,colleagueCoverArc,friendLoanArc,bureauNoticeArc,neighborFeudArc,holdErrandArc,childStruggleArc,studentTemptationArc,strangerKindnessArc,elderCareArc];
  spouseArc.id='spouse_arc';
  parentLoanArc.id='parent_loan_arc';
  colleagueCoverArc.id='colleague_cover_arc';
  friendLoanArc.id='friend_loan_arc';
  bureauNoticeArc.id='bureau_notice_arc';
  neighborFeudArc.id='neighbor_feud_arc';
  holdErrandArc.id='hold_errand_arc';
  childStruggleArc.id='child_struggle_arc';
  studentTemptationArc.id='student_temptation_arc';
  strangerKindnessArc.id='stranger_kindness_arc';
  elderCareArc.id='elder_care_arc';
  // Each archetype function IS its builder; expose it uniformly as .build().
  [spouseArc,parentLoanArc,colleagueCoverArc,friendLoanArc,bureauNoticeArc,neighborFeudArc,holdErrandArc,childStruggleArc,studentTemptationArc,strangerKindnessArc,elderCareArc].forEach(def=>{def.build=def;});

  /* ================= SELECTION & TICK ================= */

  function eligibleArchetypes(world,S,lineage,year){
    const base={world,S,lineage,year,cast:{}};
    return STORIES.filter(def=>{
      if(def.minAge!=null&&S.age<def.minAge) return false;
      if(def.maxAge!=null&&S.age>def.maxAge) return false;
      try{
        const probe={world,S,lineage,year,cast:{}};
        if(!def.eligible(probe)) return false;
      }catch(e){ return false; }
      return true;
    }).map(def=>({def,base}));
  }

  function selectArchetype(world,S,lineage,year,rng){
    const candidates=[];
    eligibleArchetypes(world,S,lineage,year).forEach(({def})=>{
      if(signatureBlocked(world,signatureKey(def.id,def.domain),year)){
        if(!rng.chance(SIGNATURE_REUSE_CHANCE)) return;
      }
      let w=1;
      try{ w=Math.max(.1,def.weight()?def.weight():1); }catch(e){ w=1; }
      candidates.push({def,w});
    });
    if(!candidates.length) return null;
    const total=candidates.reduce((sum,c)=>sum+c.w,0);
    let roll=rng.next()*total;
    for(const candidate of candidates){ roll-=candidate.w; if(roll<=0) return candidate.def; }
    return candidates[candidates.length-1].def;
  }

  function normalizeChainBody(body){
    return {
      title:String(body.title||'AN UNLABELED CHAPTER').slice(0,80),
      castLabel:String(body.castLabel||'').slice(0,80),
      castKey:String(body.castKey||'subject').slice(0,64),
      setup:Array.isArray(body.setup)?body.setup.slice(0,3).map(l=>String(l).slice(0,400)):['The file contains a gap here.'],
      prompt:String(body.prompt||'Choose.').slice(0,160),
      choices:Array.isArray(body.choices)?body.choices.slice(0,3).map(c=>({
        label:String(c.label||'Proceed').slice(0,80),
        hint:c.hint?String(c.hint).slice(0,80):'',
        tone:['kind','prudent','greedy','cold'].includes(c.tone)?c.tone:'prudent',
        effects:Array.isArray(c.effects)?c.effects.slice(0,6):[],
        outcomes:Array.isArray(c.outcomes)?c.outcomes.slice(0,3).map(l=>String(l).slice(0,300)):[]
      })):[]
    };
  }

  function tickWorld(world,options){
    ensure(world);
    const opts=options||{};
    const S=opts.subject||(typeof root.S!=='undefined'?root.S:null);
    const lineage=opts.lineage||null;
    const year=boundedYear(opts.year!=null?opts.year:world.year,world.year);
    const result={year,applied:false,spawned:null,advanced:0,resolved:[]};
    if(world.storyLastTickYear===year) return Object.assign(result,{applied:false,reason:'already_applied'});
    if(world.storyLastTickYear!=null&&year<world.storyLastTickYear) return Object.assign(result,{applied:false,reason:'stale_year'});
    result.applied=true;

    // Advance arcs waiting on the calendar, composing any promised
    // continuation chapter so the dialogue is ready before delivery.
    Object.keys(world.storyChains).sort().forEach(id=>{
      const chain=world.storyChains[id];
      if(chain&&chain.status==='awaiting_year'&&chain.readyYear<=year){
        if(chain.pendingNext){
          const def=archetypeById(chain.archetypeId);
          if(def&&typeof def.nextChapter==='function'){
            const genRng=root.Random.create([world.seed||'seed',year,id,chain.chapterIndex,'continue'].join('|'));
            try{
              const body=normalizeChainBody(def.nextChapter({world,S,lineage,year,rng:genRng,cast:{lastTone:chain.lastTone}}));
              if(body.choices.length) chain.chapters.push(body);
            }catch(e){}
          }
          chain.pendingNext=false;
        }
        chain.status='decision';
        result.advanced++;
      }
    });

    // At most one live dialogue at a time.
    const liveDecision=Object.values(world.storyChains).some(c=>c&&c.status==='decision');

    // Fast-forward: resolve live dialogues by disposition heuristic.
    if(opts.autoResolve&&S){
      Object.keys(world.storyChains).sort().forEach(id=>{
        const chain=world.storyChains[id];
        if(!chain||chain.status!=='decision'||chain.readyYear>year) return;
        const chapter=chain.chapters[chain.chapterIndex];
        if(!chapter) return;
        const idx=autoChoiceIndex(chapter,opts.actorTone,root.Random.create([world.seed||'s',year,id,'auto'].join('|')));
        const applied=applyEffects(world,id,idx,{year,subject:S,lineage});
        result.resolved.push({
          title:chain.title,
          choiceLabel:chapter.choices[idx]?chapter.choices[idx].label:'',
          logText:'STORY RESOLVED ITSELF AS THESE YEARS DO. “'+chain.title+'”: '+chapter.choices[idx].label.toLowerCase()+'. '+(applied.outcome||'')
        });
      });
    }

    // Spawn a fresh arc.
    if(S&&S.alive!==false&&!liveDecision&&result.resolved.length===0&&Object.keys(world.storyChains).length<MAX_ACTIVE_CHAINS){
      const rng=root.WorldSimulation&&root.WorldSimulation.streamFor
        ?root.WorldSimulation.streamFor(world,year,'story-spawn','story')
        :root.Random.create([world.seed,year,'story-spawn','story'].join('|'));
      if(rng.chance(SPAWN_CHANCE)){
        const def=selectArchetype(world,S,lineage,year,rng);
        if(def){
          const salt=++world.storyCounter;
          const genRng=root.Random.create([world.seed||'seed',year,salt,def.id,'compose'].join('|'));
          const bodyRaw=def.build({world,S,lineage,year,rng:genRng,cast:{}});
          const body=normalizeChainBody(bodyRaw);
          const id='story:'+String(salt).padStart(5,'0');
          world.storyChains[id]={
            id,
            archetypeId:def.id,
            domain:def.domain||'life',
            title:body.title,
            castLabel:body.castLabel,
            castKey:body.castKey,
            signature:signatureKey(def.id,body.castKey),
            startedYear:year,
            readyYear:year,
            status:'decision',
            chapterIndex:0,
            delivered:false,
            lastTone:null,
            lastChoiceLabel:null,
            history:[],
            chapters:[body]
          };
          result.spawned=id;
        }
      }
    }

    world.storyLastTickYear=year;
    return result;
  }

  function autoChoiceIndex(chapter,actorTone,rng){
    const preference={
      saint:{kind:3,prudent:2,grey:1,cold:0,greedy:-1},
      gambler:{greedy:3,kind:1,prudent:1,cold:0,grey:1},
      hustler:{greedy:3,prudent:2,kind:1,cold:1,grey:1}
    }[actorTone]||{prudent:3,kind:2,grey:1,cold:1,greedy:0};
    let bestIdx=0,bestScore=-Infinity;
    chapter.choices.forEach((choice,index)=>{
      const score=(preference[choice.tone]!=null?preference[choice.tone]:1)+rng.range(-.5,.5);
      if(score>bestScore){bestScore=score;bestIdx=index;}
    });
    return bestIdx;
  }

  /* Compose continuation chapters lazily (called from applyEffects). */
  const _origApplyEffects=applyEffects;
  applyEffects=function(world,chainId,choiceIndex,options){
    // Patch: before finalizing, materialize pendingNext chapters.
    const worldChecked=(function(){try{ensure(world);}catch(e){}return world;})();
    const chain=worldChecked&&worldChecked.storyChains?worldChecked.storyChains[chainId]:null;
    if(chain&&chain.pendingNext&&chain.status==='decision'){
      const def=archetypeById(chain.archetypeId);
      if(def&&typeof def.nextChapter==='function'){
        const S=options&&options.subject;
        const year=boundedYear(options&&options.year,boundedYear(world.year,0));
        const genRng=root.Random.create([world.seed||'seed',year,chain.id,chain.chapterIndex,'continue'].join('|'));
        try{
          const body=normalizeChainBody(def.nextChapter({world,S,lineage:null,year,rng:genRng,cast:{lastTone:chain.lastTone}}));
          if(body.choices.length) chain.chapters.push(body);
        }catch(e){}
      }
      chain.pendingNext=false;
    }
    return _origApplyEffects(world,chainId,choiceIndex,options);
  };

  function pendingDecisionForUi(world,subject){
    ensure(world);
    void subject;
    const year=boundedYear(world.year,0);
    const ready=Object.keys(world.storyChains)
      .map(id=>world.storyChains[id])
      .filter(c=>c&&c.status==='decision'&&c.readyYear<=year&&!c.delivered)
      .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    return ready[0]||null;
  }

  /* ================= SUMMARY & INVARIANTS ================= */

  function summary(world){
    ensure(world);
    const chains=Object.values(world.storyChains);
    const archive=Object.values(world.storyArchive);
    return {
      active:chains.length,
      awaitingDecision:chains.filter(c=>c&&c.status==='decision').length,
      awaitingYears:chains.filter(c=>c&&c.status==='awaiting_year').length,
      archived:archive.length,
      domains:archive.reduce((acc,entry)=>{acc[entry.domain]=(acc[entry.domain]||0)+1;return acc;},{})
    };
  }

  function checkInvariants(world){
    ensure(world);
    const issues=[];
    if(!isValidCounter(world.storyCounter)) issues.push('storyCounter must be a finite non-negative integer');
    if(!isValidCounter(world.storyArchiveCounter)) issues.push('storyArchiveCounter must be a finite non-negative integer');
    if(Object.keys(world.storyChains).length>MAX_ACTIVE_CHAINS) issues.push('too many active story chains');
    if(Object.keys(world.storyArchive).length>MAX_ARCHIVE) issues.push('story archive exceeds bound');
    const signatures=new Set();
    Object.keys(world.storyChains).sort().forEach(key=>{
      const chain=world.storyChains[key];
      if(!chain||typeof chain!=='object'){issues.push('story chain '+key+' must be an object');return;}
      if(chain.id!==key) issues.push('story chain key/id mismatch: '+key);
      if(!/^story:\d{5,}$/.test(String(chain.id))) issues.push('story chain has malformed id: '+key);
      if(!Array.isArray(chain.chapters)||!chain.chapters.length) issues.push('story chain '+key+' has no chapters');
      else chain.chapters.forEach((chapter,ci)=>{
        if(!chapter||typeof chapter!=='object'){issues.push('story chain '+key+' chapter '+ci+' malformed');return;}
        if(!Array.isArray(chapter.choices)||!chapter.choices.length) issues.push('story chain '+key+' chapter '+ci+' has no choices');
      });
      if(signatures.has(key)) issues.push('duplicate chain key');
      signatures.add(key);
    });
    const archiveSignatures=new Set();
    Object.keys(world.storyArchive).sort().forEach(key=>{
      const entry=world.storyArchive[key];
      if(!entry||typeof entry!=='object'){issues.push('story archive '+key+' must be an object');return;}
      if(entry.id!==key) issues.push('archive key/id mismatch: '+key);
      if(!/^story-archive:\d{5,}$/.test(String(entry.id))) issues.push('archive malformed id: '+key);
      if(archiveSignatures.has(entry.signature)&&entry.signature) issues.push('duplicate archive signature: '+entry.signature);
      archiveSignatures.add(entry.signature);
    });
    return issues;
  }

  root.StorySystem={
    SCHEMA_VERSION,
    SUBSYSTEM,
    MAX_ACTIVE_CHAINS,
    MAX_ARCHIVE,
    SPAWN_CHANCE,
    SIGNATURE_FRESH_YEARS,
    ensure,
    migrate:ensure,
    tickWorld,
    applyEffects,
    pendingDecisionForUi,
    summary,
    checkInvariants,
    STORIES,
    signatureBlocked
  };
})(typeof globalThis!=='undefined'?globalThis:this);
