'use strict';

/* Stateless illustrations for the live dossier. The simulation supplies the
 * address, residents and conditions. Nothing generated here is saved. */
(function(root){
  const skies={
    low:['#e5dbc0','#bbcec2','#7e9b87','#e0a75d'],
    elevated:['#d6c9ad','#9fa99a','#747d70','#bc7759'],
    high:['#c4a795','#8b9291','#606b68','#ab5647']
  };
  const skin=['#dbc5a0','#d2b98e','#c9ad80','#b99872','#a5825d','#8a6746'];
  const coats=['#514e3e','#8c5543','#315960','#4e6b50','#6e3f37','#3c5551'];

  function escape(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function meansOf(assets){
    return assets<500?'strained':assets>=6000?'comfortable':'steady';
  }

  function attireFor(subject,sector){
    const job=String(subject.jobName||'');
    if(subject.age<3)return 'infant';
    if(subject.jailUntil>subject.age)return 'custody';
    if(/conscript|soldier|police|military|garrison/i.test(job))return 'uniform';
    if(sector==='healthcare'||/physician|nurs|medic|surgeon/i.test(job))return 'healthcare';
    if(subject.eduStage)return subject.eduStage==='university'?'university':'school';
    if(/manufacturing|construction|transport|agriculture|mining/i.test(sector||'')||
      /machinist|farmer|laborer|dock|carpenter|driver|sweeper/i.test(job))return 'workwear';
    if(/finance|government|education|professional/i.test(sector||'')||
      /clerk|lawyer|teacher|professor|architect|manager|engineer/i.test(job)||subject.jobTier>=3)return 'office';
    return subject.jobTier>=1?'workwear':'civilian';
  }

  function portrait(subject,sector,means=meansOf(subject.assets)){
    return root.IllustrationSystem.subjectPortrait(subject,{
      dossier:true, attire:attireFor(subject,sector), means,
      graduate:!!(subject.education?.completed?.university||subject.eduCompleted?.university)
    });
  }

  function windows(xs,ys,w=24,h=27){
    return ys.flatMap(y=>xs.map(x=>'<g transform="translate('+x+' '+y+')">'+
      '<rect x="-3" y="-3" width="'+(w+6)+'" height="'+(h+6)+'" fill="#e5d5b5"/>'+
      '<rect width="'+w+'" height="'+h+'" fill="#294747"/>'+
      '<path d="M2 '+(h-3)+'V2h'+(w-4)+'z" fill="#b7c4ad" opacity=".68"/>'+
      '<path d="M'+w/2+' 0v'+h+'M0 '+Math.round(h*.44)+'h'+w+'" stroke="#dcc9a5" stroke-width="1.6"/>'+
      '<path d="M-5 '+(h+2)+'h'+(w+10)+'" stroke="#4c5145" stroke-width="2.4"/></g>')).join('');
  }

  function door(x,y,w,h,color='#384e45'){
    return '<g transform="translate('+x+' '+y+')"><rect x="-4" y="-5" width="'+(w+8)+'" height="'+(h+5)+'" fill="#d6c4a2"/>'+
      '<rect width="'+w+'" height="'+h+'" rx="1" fill="'+color+'"/><path d="M4 4h'+(w-8)+'v'+(h-11)+'H4z" fill="none" stroke="#e0c6a1" opacity=".5"/>'+
      '<circle cx="'+(w-6)+'" cy="'+Math.round(h*.6)+'" r="1.7" fill="#e6b570"/><path d="M-6 '+h+'h'+(w+12)+'l5 4h-'+(w+22)+'z" fill="#9b957c"/></g>';
  }

  const homes={
    none:()=>'<path d="M103 179h235l-28-68h-36l-15 15h-58l-12-15h-50z" fill="#8b8171"/>'+
      '<path d="M123 180h193l-11-15H133z" fill="#5c5e52"/><path d="M138 178l67-61 77 61z" fill="#ad8e61" stroke="#494f43" stroke-width="3"/>'+
      '<path d="M176 178l29-61 39 61z" fill="#544d40"/><path d="M261 173h34v7h-34z" fill="#6e4336"/><path d="M110 153h24m161-11h17" stroke="#a19780" stroke-width="3"/>',
    shelter:()=>'<path d="M112 104h253v76H112z" fill="#aa8467"/><path d="M102 105l29-28h213l32 28z" fill="#4e5246"/>'+
      '<path d="M112 113h253m-253 8h253m-253 37h253" stroke="#714f42" opacity=".42"/>'+windows([140,310],[129],24,24)+
      door(219,131,37,49)+'<rect x="205" y="108" width="65" height="16" fill="#e4d5b1"/><path d="M214 116h47m-38-3h29" stroke="#665947" stroke-width="1.3"/>',
    room:()=>'<path d="M126 62h202v118H126z" fill="#ba9273"/><path d="M122 66l19-20h175l18 20z" fill="#525348"/>'+
      '<path d="M328 62l42 21v97h-42z" fill="#7f6a56"/><path d="M131 105h195m-195 31h195" stroke="#8b624f" stroke-width="2"/>'+
      '<path d="M119 173h216v8H119z" fill="#746652"/>'+windows([150,194,239,284],[77,116],20,20)+door(215,143,25,37)+
      '<path d="M146 144h44m76 0h44m44-48v58" stroke="#545c51" stroke-width="2"/><path d="M138 60v-20h16v20m144 0V36h12v24" fill="#775549"/>',
    flat:()=>'<path d="M107 49h249v131H107z" fill="#aaa998"/><path d="M356 49l35 15v116h-35z" fill="#727f72"/>'+
      '<path d="M101 47h260v8H101zm6 43h249v4H107zm0 42h249v4H107z" fill="#66776a"/>'+
      windows([122,168,215,264,311],[63,104],24,19)+windows([148,291],[145],30,20)+door(225,145,27,35)+
      '<path d="M118 86h221m-221 42h221m-222 21h17m232-65h15m-15 26h15" stroke="#d3d0b3" stroke-width="2"/>',
    house:()=>'<path d="M135 97h210v83H135z" fill="#cbbb95"/><path d="M345 97l30 15v68h-30z" fill="#96896e"/>'+
      '<path d="M114 101l125-71 124 71-9 12-115-63-116 63z" fill="#764b42" stroke="#5e4538" stroke-width="2"/>'+
      '<path d="M309 66V40h16v35" fill="#8d6552"/><path d="M135 151h210m-210 9h210" stroke="#b4a27f" stroke-width="2"/>'+
      windows([158,296],[120],25,27)+windows([231],[74],16,16)+door(221,125,33,55),
    townhouse:()=>'<path d="M127 50h227v130H127z" fill="#ba816a"/><path d="M350 50l35 17v113h-35z" fill="#886759"/>'+
      '<path d="M122 53l18-17h206l15 17z" fill="#4b5145"/><path d="M124 88h233v6H124zm0 43h233v5H124z" fill="#d9bb95"/>'+
      windows([149,203,256,309],[64,105],20,18)+windows([149,309],[144],22,23)+door(229,140,31,40,'#3d564c')+
      '<path d="M216 141q28-24 56 0M219 180v-38m50 38v-38" fill="none" stroke="#e9cda8" stroke-width="4"/>',
    estate:()=>'<path d="M94 106h76v74H94zm221 0h72v74h-72z" fill="#aa9d81"/><path d="M89 106l16-22h55l16 22zm219 0 16-22h55l14 22z" fill="#4b594d"/>'+
      '<path d="M155 74h174v106H155z" fill="#dac8a5"/><path d="M144 76l98-44 99 44z" fill="#566055"/>'+
      '<path d="M198 83h89l-45-28z" fill="#ecdfbc"/><path d="M152 109h180m-180 59h180" stroke="#9a8f73" stroke-width="3"/>'+
      windows([111,353],[123],19,30)+windows([170,292],[90,127],20,25)+door(228,123,29,57,'#4d5948')+
      '<path d="M210 114v62m65-62v62" stroke="#f0e2c1" stroke-width="7"/><path d="M201 113h81m-85 63h88m-91 5h94" stroke="#ad9c7d" stroke-width="3"/>'
  };

  function streetscape(kind){
    if(kind==='village')return '<path d="M0 123l31-20 30 20v44H0zm560-8 31-21 49 21v52h-80z" fill="#6e8678"/><path d="M0 123l31-20 36 20m487-8 37-21 49 22" fill="none" stroke="#576d65" stroke-width="5"/>';
    if(kind==='city')return '<path d="M0 104h55V80h53v81H0zm404 57V99h40V78h53v83zm102 0V65h37V52h54v31h43v78z" fill="#648177"/><path d="M10 119h82m-70 12h70m329-14h61m49-25h92m-92 13h92m-92 15h92" stroke="#b4c2a5" stroke-width="4" stroke-dasharray="8 8" opacity=".6"/>';
    return '<path d="M0 132h34v-27h57v52H0zm401 25v-39h65V96h52v61zm124 0v-25l53-27 62 26v26z" fill="#718b7e"/>';
  }

  function figure(person,index,count,viewMeans){
    const style=root.IllustrationSystem.visualIdentity(person.id), age=Number(person.age)||0;
    const scale=age<3?.40:age<7?.52:age<13?.68:age<18?.83:age>=65?.91:1;
    const x=410+(index+.5)*Math.min(42,182/count);
    const y=201+(index%2)*7;
    const coat=person.attire==='healthcare'?'#e7e0c9':person.attire==='uniform'?'#58624a':coats[style.cloth];
    const hat=person.attire==='workwear'?'<path d="M-7-47q7-7 13 1l5 2H-7z" fill="#334945"/>':'';
    const bag=/school|university/.test(person.attire||'')?'<path d="M8-31h8v13H8z" fill="#9b6648" stroke="#514c3e"/>':'';
    const buttons=viewMeans==='comfortable'?'<path d="M0-30v13" stroke="#ddbc80" stroke-dasharray="1 3"/>':'';
    const swaddle=age<3?'<path d="M-9-28q9-9 18 0L6-3Q0 1-6-3z" fill="'+coat+'"/><path d="M-7-23l14 10m-13-4 11 7" fill="none" stroke="#eee0bc" opacity=".63"/>':
      '<path d="M-6-15l-2 14m13-14 3 14" stroke="#333d36" stroke-width="4" stroke-linecap="round"/>'+
      '<path d="M-4-34h8q5 2 7 8l-2 13H-9l-2-13q2-6 7-8z" fill="'+coat+'"/>'+
      '<path d="M-5-32l5 6 5-6" fill="none" stroke="#d0b493" opacity=".7"/>'+buttons+bag;
    return '<g class="lv-person" transform="translate('+x+' '+y+') scale('+scale+')"><ellipse rx="13" ry="3" fill="#263c36" opacity=".28"/>'+
      swaddle+'<ellipse cy="-41" rx="6" ry="7" fill="'+skin[style.skin]+'"/><path d="M-6-41q-2-8 6-8 7 0 6 6l-4-2-8 4" fill="#41362d"/>'+hat+'</g>';
  }

  function scene({housing,place,kind,means,people,unrest,surveillance}){
    const type=Object.hasOwn(homes,housing.id)?housing.id:'none';
    const severity=unrest>=.58?'high':unrest>=.25?'elevated':'low';
    const watched=surveillance>=.68;
    const palette=skies[severity];
    const residents=people.slice(0,6);
    const label='Illustration of '+(type==='none'?'temporary shelter':'home')+' in '+place+'. '+
      housing.name+' with '+people.length+' '+(people.length===1?'resident':'residents')+'.';
    const foliage=means==='comfortable'&&['house','townhouse','estate'].includes(type)?
      '<path d="M80 183q-7-24 11-35 16 6 13 35m267 0q-7-25 11-36 15 7 13 36" fill="#526b50"/><path d="M74 183h35m256 0h37" stroke="#a88b69" stroke-width="4"/>':'';
    const repairs=means==='strained'&&['room','flat','house'].includes(type)?
      '<path d="M137 166l12-7 12 5m147-11 11 6-8 8" fill="none" stroke="#67594e" opacity=".6"/>':'';
    return '<svg class="lv-scene-svg" viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+escape(label)+'" data-housing="'+type+'" data-unrest="'+severity+'">'+
      '<defs><pattern id="dossier-street-grain" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M1 2h1m2 2h1" stroke="#2b443a" stroke-width=".55" opacity=".25"/></pattern></defs>'+
      '<rect width="640" height="220" fill="'+palette[0]+'"/><circle cx="491" cy="47" r="32" fill="'+palette[3]+'"/>'+
      '<path d="M0 118 75 83l60 21 89-43 104 48 73-28 61 14 46-30 132 47v52H0z" fill="'+palette[1]+'"/>'+
      '<path d="M0 141l79-22 99 8 142-16 79 25 111-18 130 10v51H0z" fill="'+palette[2]+'"/>'+
      streetscape(kind)+'<path d="M0 166l640-6v60H0z" fill="#9caa8e"/>'+
      '<path d="M0 188l640-14v31L0 220z" fill="#b8af91"/><path d="M0 207l640-14" stroke="#777f6c" stroke-width="2"/>'+
      '<path d="M50 181v-61" stroke="#5d5845" stroke-width="4"/><path d="M23 123q0-25 21-34 31 1 33 32-26 24-54 2" fill="#607c61"/>'+
      '<path d="M25 130q25 4 48-14m-24-16v32" fill="none" stroke="#425e50" opacity=".65"/>'+
      '<g class="lv-house">'+homes[type]()+'</g>'+foliage+repairs+
      (watched?'<g class="lv-surveillance"><path d="M602 170V66" stroke="#47554c" stroke-width="4"/><path d="M601 67h-15l-10 8h26" fill="#47554c"/><path d="M576 75l-22 72h48z" fill="#ddd0a4" opacity=".3"/><path d="M604 90h19v31h-19z" fill="#9e5948"/><path d="M610 98h8m-8 5h8" stroke="#eed3ad" stroke-width="1.3"/></g>':'')+
      (severity==='high'?'<g class="lv-unrest" fill="#72564d"><path d="M395 168l-7-21m4 8 26-9m-31 2 25 8m-10 12 8-20" stroke="#72564d" stroke-width="3"/><path d="M381 145l35 5-1 4-35-5z"/></g>':'')+
      residents.map((person,index)=>figure(person,index,residents.length,means)).join('')+
      '<rect width="640" height="220" fill="url(#dossier-street-grain)" pointer-events="none"/></svg>';
  }

  root.DossierArt={portrait,scene,attireFor,meansOf};
})(typeof globalThis!=='undefined'?globalThis:this);
