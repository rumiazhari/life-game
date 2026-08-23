'use strict';
/* ================= MAP SYSTEM ===========================================
   DOM-free module behind the Karsen map screens. Pure data and math only:
   no document/window/$ access, no random, no World/S coupling.

   Contents:
   - camera math        createCamera / zoomAtPoint / clampCamera / panBy /
                        fitBounds, with per-scale zoom profiles
                        (NATIONAL_ZOOM / SETTLEMENT_ZOOM - never one global cap)
   - zoom tiers         nationalTier / settlementTier / poiPriority /
                        poiLabelItems - label detail is a function of tier;
                        callers recompute only when the tier or map changes,
                        never on pointermove
   - portrait layout    nationalLayout / transformY / geoTransform
   - national terrain   TERRAIN data + SVG string builders
   - label layout       layoutLabels collision engine (deterministic,
                        priority-ordered, leader-line fallback)
   - settlement plans   SETTLEMENT_PLANS: fourteen authored municipal survey
                        sheets. Every settlement owns its own road topology,
                        railways, waterways, districts, land-use parcels,
                        relief line work and background-fabric zones. There is
                        no shared generic street grid anywhere in this module.
   - cartography        POI symbols, illustrated legends, scale bars,
                        non-scaling-stroke line work

   Presentation-only: nothing here owns persistent state; canonical gameplay
   authority stays in js/state.js (KARSEN_SETTLEMENTS, KARSEN_ROUTES,
   travelCost, routeBetween, World.map). Geometry produced here is derived on
   demand and never mutates game records.
   ========================================================================= */
const MapSystem=(function(){
  const VERSION='map-2';
  const NATIONAL_VIEWBOX={width:150,height:100};
  const SETTLEMENT_VIEWBOX={width:100,height:82};

  const NATIONAL_ZOOM={min:1,max:5};
  const SETTLEMENT_ZOOM={min:1,max:8};
  const ZOOM_CONFIG={national:NATIONAL_ZOOM,settlement:SETTLEMENT_ZOOM};

  function clamp(v,a,b){ return v<a?a:v>b?b:v; }
  function num(v,fallback){ const n=typeof v==='number'?v:parseFloat(v); return isFinite(n)?n:fallback; }
  function limits(zoom){
    const z=zoom||NATIONAL_ZOOM;
    return {min:num(z.min,1),max:num(z.max,NATIONAL_ZOOM.max)};
  }

  /* ---- deterministic PRNG for decorative fabric (never Math.random) ---- */
  function hashSeed(str){
    let h=2166136261;
    String(str).split('').forEach(ch=>{ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); });
    return h>>>0;
  }
  function seeded(seed){
    let s=(seed>>>0)||1;
    return function(){
      s=(s+0x6D2B79F5)|0;
      let t=Math.imul(s^(s>>>15),1|s);
      t=(t+Math.imul(t^(t>>>7),61|t))^t;
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  /* ======================= CAMERA MATH ================================ */
  function createCamera(){ return {x:0,y:0,scale:1}; }
  function axisLimits(extent,scale){
    return {lo:Math.min(0,extent-extent*scale),hi:Math.max(0,extent-extent*scale)};
  }
  function clampCamera(camera,view,zoom){
    const lim=limits(zoom);
    const scale=clamp(num(camera.scale,lim.min),lim.min,lim.max);
    const width=num(view&&view.width,NATIONAL_VIEWBOX.width);
    const height=num(view&&view.height,NATIONAL_VIEWBOX.height);
    const lx=axisLimits(width,scale), ly=axisLimits(height,scale);
    return {scale,x:clamp(num(camera.x,0),lx.lo,lx.hi),y:clamp(num(camera.y,0),ly.lo,ly.hi)};
  }
  function zoomAtPoint(camera,px,py,targetScale,view,zoom){
    const lim=limits(zoom);
    const scale=clamp(num(targetScale,camera.scale),lim.min,lim.max);
    const k=scale/(num(camera.scale,1)||1);
    const next={scale,x:px-(px-num(camera.x,0))*k,y:py-(py-num(camera.y,0))*k};
    return view?clampCamera(next,view,zoom):next;
  }
  function panBy(camera,dx,dy,view,zoom){
    const next={scale:num(camera.scale,limits(zoom).min),x:num(camera.x,0)+num(dx,0),y:num(camera.y,0)+num(dy,0)};
    return view?clampCamera(next,view,zoom):next;
  }
  function fitBounds(bounds,view,pad,zoom){
    const lim=limits(zoom);
    const width=num(view&&view.width,NATIONAL_VIEWBOX.width);
    const height=num(view&&view.height,NATIONAL_VIEWBOX.height);
    const m=num(pad,0);
    const bw=Math.max(num(bounds&&bounds.w,0)+m*2,0.001), bh=Math.max(num(bounds&&bounds.h,0)+m*2,0.001);
    const scale=clamp(Math.min(width/bw,height/bh),lim.min,lim.max);
    const cx=num(bounds&&bounds.x,0)+num(bounds&&bounds.w,0)/2, cy=num(bounds&&bounds.y,0)+num(bounds&&bounds.h,0)/2;
    return clampCamera({scale,x:width/2-cx*scale,y:height/2-cy*scale},view,zoom);
  }

  /* ======================= ZOOM TIERS ==================================
     Label detail is decided by discrete tiers so collision layout runs only
     when the tier, map or selection changes - never on pointermove.
     --------------------------------------------------------------------- */
  function nationalTier(scale){ return num(scale,1)>=3.2?2:num(scale,1)>=1.7?1:0; }
  function nationalKindVisible(kind,tier){ return kind==='city'?true:kind==='town'?tier>=1:tier>=2; }
  function settlementTier(scale){ return num(scale,1)>=3.4?2:num(scale,1)>=1.8?1:0; }
  const POI_PRIORITY={transport:9,bureau:8,civic:8,clinic:7,market:6,school:5,worship:4,workplace:3,residence:2,public:1};
  const POI_TIER_FLOOR=[6,3,1];
  function poiPriority(type){ return POI_PRIORITY[type]||1; }
  function poiVisible(type,tier){ return poiPriority(type)>=POI_TIER_FLOOR[clamp(num(tier,2),0,2)]; }
  function poiLabelItems(placed,opts){
    const tier=clamp(num(opts&&opts.tier,2),0,2);
    return placed.map(b=>{
      const pr=poiPriority(b.type);
      const forced=b.id===(opts&&opts.selectedId)||b.id===(opts&&opts.currentId);
      return {id:b.id,x:b.x+b.w/2,y:b.y+b.h/2,text:b.name,r:Math.max(b.w,b.h)*0.16+0.3,priority:pr,forced};
    }).filter(item=>item.forced||item.priority>=POI_TIER_FLOOR[tier]);
  }

  /* ======================= PORTRAIT LAYOUT ============================ */
  function nationalLayout(flags){
    const tall=!!(flags&&flags.tall), compact=tall&&!!(flags&&flags.compact);
    const stretch=tall?(compact?2.32:3.15):1;
    const height=tall?(compact?190:260):100;
    return {tall,compact,stretch,height,offsetY:8-20*stretch};
  }
  function transformY(layout,y){ return layout&&layout.tall?layout.offsetY+y*layout.stretch:y; }
  function geoTransform(layout){
    return layout&&layout.tall?'translate(0 '+layout.offsetY+') scale(1 '+layout.stretch+')':'';
  }

  /* ======================= NATIONAL TERRAIN DATA ====================== */
  const TERRAIN={
    border:'M 18 49 C 14 41 22 31 38 29 C 52 27 58 18 75 20 C 91 21 99 30 111 27 C 125 23 138 28 145 38 C 150 46 147 55 139 60 C 147 68 141 78 130 82 C 116 86 105 78 93 84 C 81 91 69 82 56 86 C 43 91 30 86 24 78 C 16 74 20 66 14 61 C 9 57 11 52 18 49 Z',
    shore:'M 18 49 C 14 41 22 31 38 29',
    rivers:{
      main:'M 56 28 C 61 36 68 43 76 48 C 83 53 91 58 102 60 C 112 62 121 59 132 54',
      branches:['M 43 58 C 53 54 62 51 76 48','M 68 68 C 73 60 77 54 76 48','M 117 29 C 111 37 106 45 102 60','M 108 69 C 113 66 119 62 124 58'],
      small:['M 24 62 C 31 61 37 59 43 58','M 78 81 C 84 73 91 67 102 60','M 126 78 C 123 71 123 64 124 58']
    },
    minorRoads:[
      'M 18 49 C 24 45 30 42 38 40 C 43 38 45 38 48 37',
      'M 22 59 C 29 58 36 57 43 58 C 54 57 68 53 82 52',
      'M 43 58 C 53 64 64 73 78 81',
      'M 82 52 C 77 45 70 37 68 31 C 64 28 60 28 56 28',
      'M 68 31 C 81 28 98 28 117 29',
      'M 108 69 C 115 70 122 74 128 78',
      'M 122 57 C 127 52 131 47 134 43',
      'M 122 57 C 122 47 119 37 117 29'
    ],
    forests:[
      'M 35 27 C 41 20 52 19 62 23 C 67 28 64 37 56 41 C 47 42 38 38 35 32 Z',
      'M 99 31 C 107 26 119 27 126 34 C 128 41 123 48 114 50 C 105 48 100 42 99 31 Z'
    ],
    meadows:[
      'M 55 45 C 64 40 75 41 84 46 C 87 52 79 58 69 59 C 60 57 54 52 55 45 Z',
      'M 60 68 C 70 62 83 64 91 70 C 91 77 82 81 72 80 C 64 78 59 74 60 68 Z'
    ],
    wetlands:['M 112 52 C 120 49 129 51 134 57 C 133 64 125 68 117 66 C 112 63 110 58 112 52 Z'],
    industrial:['M 97 61 C 104 58 114 60 119 66 C 118 73 110 76 102 73 C 98 70 96 66 97 61 Z'],
    sea:{
      lines:[
        'M 3 12 C 22 7 39 13 57 9 S 92 6 110 11 S 137 8 148 14',
        'M 1 88 C 20 83 35 91 53 88 S 91 88 108 93 S 136 91 149 86',
        'M 6 23 C 14 19 22 20 29 17 M 5 28 C 14 24 21 25 28 22',
        'M 122 15 C 132 12 140 15 147 20 M 124 19 C 133 16 141 19 147 24'
      ],
      islands:[
        'M 8 73 C 11 69 17 69 19 73 C 18 77 13 79 9 77 Z',
        'M 136 72 C 139 68 145 69 146 73 C 144 77 139 78 136 76 Z'
      ],
      labels:[
        {text:'WESTERN SEA',x:8,y:17,anchor:'start'},
        {text:'SOUTHERN SEA',x:107,y:96,anchor:'middle'}
      ]
    },
    regions:[
      {text:'WESTERN COAST',x:30,y:69},
      {text:'NORTH WOODS',x:52,y:22},
      {text:'CENTRAL LOWLAND',x:82,y:46},
      {text:'IRON COUNTRY',x:111,y:61},
      {text:'SOUTHERN FARMLAND',x:75,y:77},
      {text:'EASTERN GRAIN PLAIN',x:126,y:49}
    ]
  };

  const NS='vector-effect="non-scaling-stroke"';
  function nsAttr(){ return ' '+NS; }
  function paths(cls,list,scaled){
    return list.map(d=>'<path class="'+cls+'" d="'+d+'"'+(scaled?'':nsAttr())+'></path>').join('');
  }
  function patternDefs(){
    return '<defs aria-hidden="true">'
      +'<pattern id="lf-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#b0977c" stroke-width="0.28"/></pattern>'
      +'<pattern id="lf-furrow" width="3.4" height="2.6" patternUnits="userSpaceOnUse"><path d="M0 1.3 H3.4" stroke="#c9c083" stroke-width="0.32" fill="none"/><path d="M0 2.5 H3.4" stroke="#d3cb92" stroke-width="0.22" fill="none"/></pattern>'
      +'<pattern id="lf-trees" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.55" fill="#a9c2a4"/><circle cx="2.5" cy="2.3" r="0.45" fill="#b3cab0"/></pattern>'
      +'<pattern id="lf-orchard" width="2.6" height="2.6" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r="0.42" fill="#b7cfa2"/></pattern>'
      +'</defs>';
  }

  /* ---- national SVG builders (string output only) ---- */
  function seaDetailsMarkup(includeLabels){
    const labels=includeLabels
      ?TERRAIN.sea.labels.map(l=>'<text class="map-sea-label" x="'+l.x+'" y="'+transformY(null,l.y)+'" text-anchor="'+l.anchor+'">'+l.text+'</text>').join('')
      :'';
    return '<g class="map-sea-details" aria-hidden="true"><path class="map-shore" d="'+TERRAIN.shore+'"'+nsAttr()+'></path>'+paths('map-sea-line',TERRAIN.sea.lines)+paths('map-sea-island',TERRAIN.sea.islands)+labels+'</g>';
  }
  function greeneryMarkup(){
    return '<g class="map-greenery" aria-hidden="true">'+paths('map-forest',TERRAIN.forests)+paths('map-meadow',TERRAIN.meadows)+paths('map-wetland',TERRAIN.wetlands)+paths('map-industrial',TERRAIN.industrial)+'</g>';
  }
  function nationalGeographyMarkup(layout){
    const inner='<path class="map-border" d="'+TERRAIN.border+'"'+nsAttr()+'></path>'
      +seaDetailsMarkup(!(layout&&layout.tall))
      +greeneryMarkup()
      +'<path class="map-river-main" d="'+TERRAIN.rivers.main+'"'+nsAttr()+'></path>'
      +paths('map-river',TERRAIN.rivers.branches)
      +paths('map-river-small',TERRAIN.rivers.small)
      +paths('map-minor-road',TERRAIN.minorRoads);
    const transform=geoTransform(layout);
    return patternDefs()+'<g'+(transform?' transform="'+transform+'"':'')+'>'+inner+'</g>';
  }
  function regionLabelsMarkup(layout,tier){
    const y=v=>transformY(layout,v);
    const all=TERRAIN.regions;
    const list=(tier>=1)?all:all.slice(1,4);
    return '<g class="map-region-labels" aria-hidden="true">'
      +list.map(r=>'<text x="'+r.x+'" y="'+y(r.y)+'">'+r.text+'</text>').join('')+'</g>';
  }
  function seaLabelsMarkup(layout){
    if(!(layout&&layout.tall)) return '';
    const y=v=>transformY(layout,v);
    return '<g class="map-sea-details" aria-hidden="true">'
      +TERRAIN.sea.labels.map(l=>'<text class="map-sea-label" x="'+l.x+'" y="'+y(l.y)+'" text-anchor="'+l.anchor+'">'+l.text+'</text>').join('')+'</g>';
  }
  function routePath(a,b,index,layout){
    const ay=transformY(layout,a.y), by=transformY(layout,b.y);
    const dx=b.x-a.x, dy=by-ay, len=Math.max(1,Math.sqrt(dx*dx+dy*dy));
    const bend=(index%2?2.4:-2.4);
    const cx=(a.x+b.x)/2+(-dy/len*bend), cy=(ay+by)/2+(dx/len*bend);
    return 'M '+a.x+' '+ay+' Q '+cx+' '+cy+' '+b.x+' '+by;
  }
  function routeMidPoint(a,b,index,layout){
    const ay=transformY(layout,a.y), by=transformY(layout,b.y);
    const dx=b.x-a.x, dy=by-ay, len=Math.max(1,Math.sqrt(dx*dx+dy*dy));
    const bend=(index%2?2.4:-2.4);
    return {x:(a.x+b.x)/2+(-dy/len*bend),y:(ay+by)/2+(dx/len*bend)};
  }

  /* ======================= LABEL LAYOUT ENGINE ========================
     Deterministic collision-aware placement. Items are processed highest
     priority first (ties broken by id ascending); each tries a fixed
     sequence of anchor offsets around its anchor circle, then leader-line
     offsets, and commits the first rectangle that neither leaves the
     viewport nor intersects an occupied rectangle (previously placed labels
     plus the reserved circles). If every candidate collides, the candidate
     with the fewest overlapping rectangles wins (earliest index on ties)
     and the placement is flagged overlap:true.
     --------------------------------------------------------------------- */
  function estimateTextSize(text,options){
    const fontSize=num(options&&options.fontSize,3);
    const charW=num(options&&options.charW,fontSize*0.66);
    return {w:String(text).length*charW,h:fontSize*1.3};
  }
  function rectsIntersect(a,b){
    return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
  }
  function labelRect(item,cand,size){
    let x=item.x+cand.dx;
    if(cand.anchor==='end') x-=size.w;
    else if(cand.anchor==='middle') x-=size.w/2;
    return {x,y:item.y+cand.dy-size.h*0.78,w:size.w,h:size.h};
  }
  function labelCandidates(item,fontSize){
    const r=num(item.r,1.4), off=r+1.1, f=fontSize;
    return [
      {anchor:'start',dx:off,dy:f*0.35},
      {anchor:'end',dx:-off,dy:f*0.35},
      {anchor:'middle',dx:0,dy:-(off+f*0.45)},
      {anchor:'middle',dx:0,dy:off+f*1.05},
      {anchor:'start',dx:off*0.8,dy:-off*0.8},
      {anchor:'end',dx:-off*0.8,dy:-off*0.8},
      {anchor:'start',dx:off*0.8,dy:off*1.6},
      {anchor:'end',dx:-off*0.8,dy:off*1.6},
      {anchor:'start',dx:off+f*2.2,dy:f*0.35,leader:true},
      {anchor:'end',dx:-(off+f*2.2),dy:f*0.35,leader:true},
      {anchor:'middle',dx:0,dy:-(off+f*2.4),leader:true},
      {anchor:'middle',dx:0,dy:off+f*3,leader:true}
    ];
  }
  function layoutLabels(items,options){
    const fontSize=num(options&&options.fontSize,3);
    const margin=num(options&&options.margin,0.5);
    const width=num(options&&options.width,NATIONAL_VIEWBOX.width);
    const height=num(options&&options.height,NATIONAL_VIEWBOX.height);
    const reserved=(options&&Array.isArray(options.dots)?options.dots:[]).map(d=>{
      const r=num(d.r,1.4);
      return {x:num(d.x,0)-r,y:num(d.y,0)-r,w:r*2,h:r*2};
    });
    const ordered=items.slice().sort((a,b)=>{
      const pa=num(a.priority,0), pb=num(b.priority,0);
      if(pa!==pb) return pb-pa;
      return String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0;
    });
    const occupied=reserved.slice();
    const placements={}, order=[];
    let overlaps=0;
    ordered.forEach(item=>{
      const size=estimateTextSize(item.text,options);
      const cands=labelCandidates(item,fontSize);
      let chosen=-1, overlapCount=Infinity, flagged=false;
      const evaluated=cands.map(cand=>{
        const rect=labelRect(item,cand,size);
        const outside=rect.x<margin||rect.y<margin||rect.x+rect.w>width-margin||rect.y+rect.h>height-margin;
        let hits=outside?1:0;
        for(let i=0;i<occupied.length;i++) if(rectsIntersect(rect,occupied[i])) hits++;
        return {cand,rect,hits,outside};
      });
      for(let i=0;i<evaluated.length;i++){
        if(evaluated[i].hits===0){ chosen=i; break; }
      }
      if(chosen<0){
        for(let i=0;i<evaluated.length;i++){
          if(evaluated[i].hits<overlapCount){ overlapCount=evaluated[i].hits; chosen=i; }
        }
        if(chosen<0) chosen=0;
        flagged=true; overlaps++;
      }
      const pick=evaluated[chosen];
      placements[item.id]={x:item.x+pick.cand.dx,y:item.y+pick.cand.dy,anchor:pick.cand.anchor,leader:!!pick.cand.leader,overlap:flagged,rect:pick.rect};
      occupied.push(pick.rect);
      order.push(String(item.id));
    });
    return {placements,order,overlaps,fontSize,width,height,reserved};
  }
  function labelLeaderPath(item,placement,radius){
    if(!placement||!placement.leader) return '';
    const r=num(radius,1.4);
    const ex=clamp(item.x,placement.rect.x,placement.rect.x+placement.rect.w);
    const ey=clamp(item.y,placement.rect.y,placement.rect.y+placement.rect.h);
    const dx=ex-item.x, dy=ey-item.y, len=Math.max(0.001,Math.sqrt(dx*dx+dy*dy));
    return 'M '+(item.x+dx/len*r)+' '+(item.y+dy/len*r)+' L '+ex+' '+ey;
  }

  /* ======================= SETTLEMENT PLANS ===========================
     Fourteen authored municipal survey sheets. Each plan carries:
       slots/default  canonical POI footprints keyed by building-type anchor
                      (same type vocabulary as inferBuildingType in state.js)
       districts      named district rectangles matching the canonical
                      district list in state.js
       landUse        filled parcels: urban/farmland/meadow/gardens/estate/
                      industrial/yard/institutional/orchard/harbor/forest,
                      optional texture ('hatch'|'furrow'|'trees'|'orchard')
       waterways      open-water polygons (kind:'water') and line work
                      ('river'|'stream'|'coast'|'quay')
       roads          this settlement's own primary streets
       minorRoads     lanes and service ways
       railways       {d, spur} - main lines and sidings
       bridges        crossing structures over water/rail corridors
       relief         contour/elevation line work
       fabric         non-interactive background footprint zones
                      ({x,y,w,h,density,gap,size}) generated deterministically

     All geometry lives on the 100x82 sheet. Canonical slots are identical to
     the reviewed map-1 layouts; everything else is new presentation layer.
     --------------------------------------------------------------------- */
  const TYPE_ORDER=['bureau','civic','transport','clinic','school','market','worship','residence','workplace','public'];
  const SETTLEMENT_PLANS={
    branec:{
      motif:'dense capital: administrative core, broad avenues, Workers Ring, central terminus',
      slots:{
        bureau:[{x:36,y:8,w:14,h:10},{x:52,y:8,w:13,h:9},{x:44,y:20,w:12,h:9}],
        transport:[{x:8,y:34,w:16,h:10}],
        residence:[{x:70,y:56,w:15,h:10},{x:33,y:62,w:14,h:9}],
        clinic:[{x:70,y:8,w:12,h:9}],
        market:[{x:8,y:8,w:14,h:10}],
        school:[{x:8,y:56,w:13,h:9}],
        public:[{x:55,y:36,w:11,h:8}]
      },
      default:[{x:74,y:34,w:12,h:9},{x:24,y:44,w:12,h:9}],
      districts:[
        {name:'Registry Quarter',x:30,y:4,w:38,h:30},
        {name:'Old Market',x:3,y:4,w:26,h:40},
        {name:'Workers\u2019 Ring',x:58,y:46,w:39,h:32},
        {name:'North Offices',x:62,y:4,w:35,h:34}
      ],
      landUse:[
        {kind:'urban',d:'M30 34 H66 V44 H30 Z'},
        {kind:'urban',d:'M4 46 H28 V54 H4 Z'},
        {kind:'gardens',texture:'trees',d:'M31 50 C38 47 47 48 51 51 C50 56 42 59 35 58 C31 56 30 53 31 50 Z'},
        {kind:'urban',d:'M70 21 H95 V30 H70 Z'}
      ],
      waterways:[],
      railways:[
        {d:'M 2 58 C 10 57 16 53 16 46'},
        {d:'M 98 74 C 84 71 74 62 72 50 C 71 44 75 38 81 34'},
        {d:'M 16 46 V 42',spur:true}
      ],
      roads:[
        'M 2 40 H 98',
        'M 50 2 V 78',
        'M 30 2 V 44',
        'M 68 2 V 46',
        'M 2 68 C 14 66 22 63 33 62',
        'M 85 2 V 78'
      ],
      minorRoads:[
        'M 6 14 H 26','M 6 22 H 26','M 6 30 H 26',
        'M 34 12 H 62','M 34 26 H 62','M 72 12 H 94','M 72 26 H 94',
        'M 60 52 H 94','M 60 62 H 94','M 60 72 H 94',
        'M 36 68 H 58'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:31,y:35,w:34,h:9,density:.92,gap:2.4,size:1.7},
        {x:5,y:47,w:22,h:7,density:.85,gap:2.4,size:1.6},
        {x:61,y:47,w:34,h:29,density:.88,gap:2.6,size:1.8},
        {x:71,y:31,w:23,h:8,density:.82,gap:2.6,size:1.6},
        {x:34,y:47,w:22,h:13,density:.78,gap:2.8,size:1.7},
        {x:5,y:5,w:24,h:8,density:.7,gap:3,size:1.5}
      ]
    },
    veskar:{
      motif:'salt-wet port: harbor basin and quays beneath terraced waterfront streets',
      slots:{
        civic:[{x:40,y:8,w:14,h:10}],
        workplace:[{x:30,y:56,w:18,h:8}],
        transport:[{x:8,y:34,w:15,h:9}],
        residence:[{x:8,y:8,w:13,h:9},{x:60,y:34,w:14,h:9},{x:74,y:8,w:12,h:9}],
        clinic:[{x:58,y:8,w:12,h:9}],
        market:[{x:74,y:34,w:13,h:9}],
        school:[{x:24,y:20,w:12,h:9}],
        bureau:[{x:42,y:34,w:13,h:9}],
        public:[{x:56,y:20,w:11,h:8}]
      },
      default:[{x:8,y:52,w:12,h:9},{x:74,y:52,w:12,h:9}],
      districts:[
        {name:'Old Docks',x:20,y:44,w:40,h:22},
        {name:'Customs Ward',x:34,y:4,w:40,h:28},
        {name:'Fishermen\u2019s Row',x:3,y:4,w:26,h:42},
        {name:'Salt Market',x:56,y:28,w:41,h:26}
      ],
      landUse:[
        {kind:'harbor',d:'M2 66 H98 V80 H2 Z'},
        {kind:'yard',texture:'hatch',d:'M22 48 H58 V64 H22 Z'},
        {kind:'urban',d:'M60 44 H86 V52 H60 Z'}
      ],
      waterways:[
        {kind:'water',d:'M2 66 H98 V80 H2 Z'},
        {kind:'coast',d:'M 2 66 C 20 65 40 67 60 66 S 88 65 98 66'},
        {kind:'quay',d:'M 2 65.2 H 98'},
        {kind:'quay',d:'M 27 66 V 76 M 40 66 V 79 M 53 66 V 75 M 84 66 V 77'}
      ],
      railways:[],
      roads:[
        'M 2 30 H 98',
        'M 20 2 V 64',
        'M 40 18 V 64',
        'M 58 2 V 64',
        'M 78 2 V 64',
        'M 2 46 C 12 44 20 42 30 40',
        'M 90 32 V 64'
      ],
      minorRoads:[
        'M 8 14 H 18','M 8 22 H 18','M 8 40 H 18',
        'M 44 24 H 54','M 62 12 H 70','M 78 20 H 86',
        'M 24 50 H 56','M 24 58 H 56',
        'M 62 44 H 84'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:23,y:47,w:34,h:16,density:.8,gap:3,size:2},
        {x:61,y:44,w:24,h:7,density:.75,gap:3,size:1.8},
        {x:5,y:6,w:12,h:36,density:.6,gap:3,size:1.5},
        {x:60,y:6,w:34,h:8,density:.6,gap:3.2,size:1.6}
      ]
    },
    eisenmark:{
      motif:'iron city: foundry complex, rail sidings, barracks and company rows',
      slots:{
        workplace:[{x:64,y:8,w:20,h:12}],
        civic:[{x:36,y:8,w:14,h:10},{x:36,y:34,w:13,h:9}],
        transport:[{x:8,y:34,w:15,h:9}],
        residence:[{x:8,y:8,w:14,h:10}],
        clinic:[{x:64,y:36,w:12,h:9}],
        market:[{x:52,y:56,w:13,h:9},{x:68,y:56,w:12,h:9}],
        school:[{x:22,y:56,w:13,h:9}],
        public:[{x:36,y:56,w:11,h:8}]
      },
      default:[{x:8,y:72,w:13,h:8}],
      districts:[
        {name:'Foundry Ward',x:54,y:4,w:43,h:30},
        {name:'Barracks',x:54,y:46,w:43,h:32},
        {name:'Company Row',x:3,y:4,w:30,h:28},
        {name:'Ash Market',x:30,y:46,w:38,h:32}
      ],
      landUse:[
        {kind:'industrial',texture:'hatch',d:'M56 4 H97 V22 H56 Z'},
        {kind:'industrial',texture:'hatch',d:'M56 25 H78 V32 H56 Z'},
        {kind:'yard',texture:'hatch',d:'M6 44 H30 V54 H6 Z'},
        {kind:'industrial',texture:'hatch',d:'M80 41 H97 V52 H80 Z'},
        {kind:'urban',d:'M6 61 H30 V76 H6 Z'}
      ],
      waterways:[],
      railways:[
        {d:'M 2 40 C 20 39 40 38 98 36'},
        {d:'M 40 37 C 52 34 60 29 64 21'},
        {d:'M 56 12 H 97',spur:true},
        {d:'M 56 17 H 92',spur:true},
        {d:'M 60 37 V 52',spur:true}
      ],
      roads:[
        'M 2 30 H 98',
        'M 32 2 V 78',
        'M 52 2 V 78',
        'M 2 52 H 52',
        'M 8 2 V 30',
        'M 62 44 V 78'
      ],
      minorRoads:[
        'M 10 14 H 28','M 10 22 H 28',
        'M 56 27 H 94','M 80 27 V 40',
        'M 36 62 H 50','M 54 62 H 94','M 54 70 H 94',
        'M 24 56 H 34'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:57,y:5,w:39,h:15,density:.85,gap:3.4,size:2.4},
        {x:57,y:26,w:19,h:5,density:.8,gap:3,size:2},
        {x:7,y:62,w:22,h:13,density:.85,gap:2.6,size:1.7},
        {x:55,y:64,w:37,h:12,density:.72,gap:3,size:1.8},
        {x:81,y:42,w:15,h:9,density:.8,gap:2.8,size:2}
      ]
    },
    kostrin:{
      motif:'colleges and chapels on the hill above the hospital ward, gardens to the south',
      slots:{
        school:[{x:8,y:8,w:17,h:11},{x:8,y:24,w:13,h:9}],
        bureau:[{x:56,y:8,w:13,h:9},{x:72,y:24,w:12,h:9}],
        transport:[{x:8,y:60,w:15,h:9}],
        residence:[{x:72,y:8,w:13,h:9}],
        clinic:[{x:32,y:32,w:18,h:12}],
        market:[{x:56,y:48,w:12,h:9}],
        worship:[{x:30,y:8,w:12,h:9}],
        public:[{x:56,y:24,w:11,h:8}]
      },
      default:[{x:72,y:60,w:12,h:9},{x:30,y:60,w:12,h:9}],
      districts:[
        {name:'College Hill',x:3,y:4,w:26,h:34},
        {name:'Hospital Ward',x:26,y:26,w:30,h:24},
        {name:'Chapel District',x:26,y:4,w:24,h:22},
        {name:'South Gardens',x:48,y:40,w:49,h:38}
      ],
      landUse:[
        {kind:'institutional',texture:'trees',d:'M4 4 H26 V38 H4 Z'},
        {kind:'gardens',texture:'trees',d:'M50 42 H94 V60 H50 Z'},
        {kind:'gardens',texture:'trees',d:'M52 62 H76 V78 H52 Z'},
        {kind:'gardens',d:'M32 6 H48 V22 H32 Z'}
      ],
      waterways:[],
      railways:[],
      roads:[
        'M 2 44 H 98',
        'M 28 2 V 78',
        'M 54 2 V 78',
        'M 78 2 V 44',
        'M 2 64 H 26',
        'M 28 52 C 40 50 48 50 56 52'
      ],
      minorRoads:[
        'M 6 16 H 26','M 6 30 H 26',
        'M 32 12 H 48','M 32 20 H 48',
        'M 60 12 H 86','M 60 30 H 84',
        'M 60 44 H 94','M 60 68 H 90',
        'M 32 66 H 48'
      ],
      bridges:[],
      relief:['M 4 40 C 12 36 20 37 26 41'],
      fabric:[
        {x:6,y:6,w:18,h:28,density:.55,gap:3.4,size:1.9},
        {x:33,y:8,w:14,h:10,density:.5,gap:3.4,size:1.7},
        {x:62,y:8,w:22,h:6,density:.5,gap:3.4,size:1.7},
        {x:33,y:46,w:18,h:12,density:.5,gap:3.2,size:1.8},
        {x:62,y:64,w:28,h:12,density:.45,gap:3.6,size:1.7}
      ]
    },
    rudava:{
      motif:'the timetable city: junction, freight yards, platforms and railway rows',
      slots:{
        transport:[{x:28,y:8,w:18,h:11},{x:8,y:24,w:22,h:12},{x:52,y:24,w:14,h:9},{x:52,y:8,w:14,h:9},{x:8,y:42,w:14,h:9}],
        civic:[{x:52,y:40,w:13,h:9}],
        market:[{x:70,y:8,w:13,h:9}],
        school:[{x:70,y:24,w:12,h:9}],
        bureau:[{x:70,y:40,w:13,h:9}],
        public:[{x:30,y:60,w:12,h:9}]
      },
      default:[{x:52,y:60,w:13,h:9},{x:70,y:60,w:12,h:9}],
      districts:[
        {name:'Junction Ward',x:44,y:4,w:30,h:30},
        {name:'Freight Yards',x:3,y:20,w:30,h:22},
        {name:'Railway Homes',x:48,y:36,w:24,h:22},
        {name:'East Barracks',x:66,y:4,w:31,h:30}
      ],
      landUse:[
        {kind:'yard',texture:'hatch',d:'M4 22 H32 V40 H4 Z'},
        {kind:'yard',texture:'hatch',d:'M46 4 H64 V20 H46 Z'},
        {kind:'urban',d:'M48 50 H70 V62 H48 Z'},
        {kind:'urban',d:'M4 55 H26 V76 H4 Z'}
      ],
      waterways:[],
      railways:[
        {d:'M 2 16 C 24 15 44 13 98 11'},
        {d:'M 2 32 C 20 31 36 28 52 26 C 70 24 84 22 98 20'},
        {d:'M 50 12 C 50 17 50 21 50 26'},
        {d:'M 6 25 H 30',spur:true},
        {d:'M 6 28 H 30',spur:true},
        {d:'M 6 31 H 30',spur:true},
        {d:'M 6 34 H 30',spur:true},
        {d:'M 46 8 H 64',spur:true},
        {d:'M 46 11 H 64',spur:true},
        {d:'M 50 26 C 58 34 60 45 58 58',spur:true}
      ],
      roads:[
        'M 2 47 C 24 45 44 45 98 43',
        'M 24 2 C 26 20 26 40 24 78',
        'M 66 2 V 78',
        'M 2 68 H 98',
        'M 46 2 V 20'
      ],
      minorRoads:[
        'M 30 14 H 44','M 52 15 H 64','M 72 14 H 82',
        'M 34 29 H 44','M 68 28 H 82',
        'M 52 46 H 64','M 52 55 H 64',
        'M 8 51 H 20',
        'M 30 69 H 44','M 74 68 H 84'
      ],
      bridges:[
        {x:22,y:12,w:4,h:7},{x:22,y:29,w:4,h:5},{x:64,y:8,w:4,h:6}
      ],
      relief:[],
      fabric:[
        {x:6,y:56,w:18,h:17,density:.85,gap:2.6,size:1.7},
        {x:49,y:51,w:20,h:10,density:.8,gap:2.8,size:1.7},
        {x:68,y:46,w:26,h:14,density:.6,gap:3,size:1.8},
        {x:74,y:6,w:8,h:16,density:.6,gap:3,size:1.6}
      ]
    },
    dobraven:{
      motif:'old county town: crooked lanes around the square, river road below, estates east',
      slots:{
        civic:[{x:38,y:26,w:16,h:12},{x:8,y:8,w:13,h:9},{x:56,y:8,w:12,h:9}],
        bureau:[{x:38,y:8,w:14,h:10}],
        transport:[{x:8,y:42,w:15,h:9}],
        residence:[{x:60,y:60,w:14,h:9}],
        market:[{x:20,y:26,w:13,h:9}],
        school:[{x:8,y:60,w:13,h:9}],
        worship:[{x:38,y:60,w:12,h:9}],
        public:[{x:58,y:26,w:11,h:8}]
      },
      default:[{x:56,y:42,w:12,h:9},{x:74,y:26,w:10,h:8}],
      districts:[
        {name:'County Square',x:18,y:20,w:40,h:24},
        {name:'Old Estates',x:52,y:48,w:45,h:30},
        {name:'River Road',x:3,y:28,w:22,h:32},
        {name:'Lower Town',x:3,y:52,w:48,h:26}
      ],
      landUse:[
        {kind:'estate',texture:'trees',d:'M54 50 H96 V78 H54 Z'},
        {kind:'water',d:'M0 30 C 4 40 4 52 0 64 L0 30 Z'},
        {kind:'urban',d:'M20 22 C 30 20 44 20 52 22 L52 42 C 40 44 28 44 20 42 Z'}
      ],
      waterways:[
        {kind:'river',d:'M 3 2 C 7 14 6 24 4 34 C 2 44 3 56 5 66 C 6 73 5 77 4 80'}
      ],
      railways:[],
      roads:[
        'M 10 2 C 16 14 20 22 26 30 C 34 40 44 46 56 50',
        'M 8 47 C 20 45 34 45 50 47 C 66 49 82 47 98 45',
        'M 27 30 C 31 40 31 52 27 62 C 25 70 25 76 27 80',
        'M 56 50 C 62 58 66 66 66 78',
        'M 50 12 C 60 14 72 14 84 12',
        'M 8 24 C 12 30 14 36 15 44'
      ],
      minorRoads:[
        'M 20 31 H 34','M 22 39 H 36',
        'M 38 45 H 52','M 60 22 H 74',
        'M 8 62 H 22','M 40 67 H 52',
        'M 72 57 H 88'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:22,y:44,w:24,h:12,density:.7,gap:2.8,size:1.6},
        {x:56,y:52,w:36,h:8,density:.5,gap:3.4,size:1.9},
        {x:6,y:8,w:16,h:18,density:.55,gap:3,size:1.5},
        {x:58,y:8,w:26,h:8,density:.5,gap:3.2,size:1.6}
      ]
    },
    krasnava:{
      motif:'village green at the crossroads, strip fields beyond, mill on the stream',
      slots:{
        civic:[{x:40,y:10,w:14,h:9}],
        residence:[{x:8,y:26,w:14,h:9},{x:64,y:26,w:13,h:9}],
        clinic:[{x:60,y:10,w:11,h:8}],
        school:[{x:8,y:10,w:13,h:9}],
        market:[{x:26,y:26,w:12,h:9}],
        workplace:[{x:26,y:44,w:13,h:9}],
        worship:[{x:44,y:44,w:11,h:8}],
        bureau:[{x:62,y:44,w:10,h:8}],
        public:[{x:8,y:44,w:11,h:8}]
      },
      default:[{x:62,y:58,w:11,h:7},{x:8,y:58,w:11,h:7}],
      districts:[
        {name:'Village Green',x:22,y:8,w:36,h:32},
        {name:'North Fields',x:3,y:4,w:94,h:34},
        {name:'Mill Road',x:20,y:38,w:40,h:26}
      ],
      landUse:[
        {kind:'farmland',texture:'furrow',d:'M3 4 H21 V38 H3 Z'},
        {kind:'farmland',texture:'furrow',d:'M60 4 H97 V19 H60 Z'},
        {kind:'farmland',texture:'furrow',d:'M77 21 H97 V37 H77 Z'},
        {kind:'farmland',texture:'furrow',d:'M3 42 H19 V78 H3 Z'},
        {kind:'farmland',texture:'furrow',d:'M60 56 H97 V78 H60 Z'},
        {kind:'meadow',d:'M25 41 H55 V53 H25 Z'},
        {kind:'orchard',texture:'orchard',d:'M44 58 H58 V70 H44 Z'}
      ],
      waterways:[
        {kind:'stream',d:'M 2 70 C 20 68 36 72 52 70 S 84 68 98 70'}
      ],
      railways:[],
      roads:[
        'M 2 20 C 20 19 40 18 98 16',
        'M 24 2 C 26 20 26 40 24 62 C 23 70 23 76 24 80',
        'M 58 2 C 60 18 60 34 58 52 C 57 64 57 72 58 80',
        'M 24 62 C 36 60 46 60 58 62'
      ],
      minorRoads:[
        'M 8 33 H 20','M 65 33 H 75',
        'M 30 49 H 42','M 8 49 H 18','M 62 49 H 70',
        'M 34 12 H 52'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:27,y:22,w:26,h:13,density:.35,gap:3.8,size:1.3},
        {x:8,y:6,w:13,h:16,density:.3,gap:4,size:1.2},
        {x:62,y:6,w:14,h:12,density:.3,gap:4,size:1.2},
        {x:62,y:59,w:30,h:14,density:.25,gap:4.4,size:1.4}
      ]
    },
    brezin:{
      motif:'forest village: clearings strung along the timber road under broad woodland',
      slots:{
        residence:[{x:8,y:8,w:13,h:9},{x:70,y:44,w:12,h:9}],
        civic:[{x:26,y:8,w:14,h:10}],
        clinic:[{x:8,y:24,w:12,h:9}],
        school:[{x:44,y:8,w:12,h:9}],
        workplace:[{x:26,y:24,w:18,h:11}],
        transport:[{x:62,y:8,w:13,h:9}],
        market:[{x:48,y:42,w:12,h:9}],
        bureau:[{x:26,y:44,w:11,h:8}],
        public:[{x:8,y:44,w:11,h:8}]
      },
      default:[{x:62,y:60,w:12,h:9},{x:8,y:60,w:12,h:8}],
      districts:[
        {name:'Lower Road',x:3,y:38,w:30,h:32},
        {name:'Timber Yard',x:20,y:18,w:32,h:22},
        {name:'Hill Houses',x:58,y:34,w:39,h:32}
      ],
      landUse:[
        {kind:'forest',texture:'trees',d:'M3 3 H21 V21 H3 Z'},
        {kind:'forest',texture:'trees',d:'M42 3 H74 V20 H42 Z'},
        {kind:'forest',texture:'trees',d:'M80 3 H97 V30 H80 Z'},
        {kind:'forest',texture:'trees',d:'M3 56 H20 V79 H3 Z'},
        {kind:'forest',texture:'trees',d:'M44 56 H66 V79 H44 Z'},
        {kind:'forest',texture:'trees',d:'M84 56 H97 V79 H84 Z'},
        {kind:'meadow',d:'M24 54 H42 V64 H24 Z'}
      ],
      waterways:[],
      railways:[],
      roads:[
        'M 2 50 C 18 48 34 46 52 42 C 68 39 84 36 98 33',
        'M 33 2 C 31 12 30 20 33 30 C 35 38 34 46 32 54',
        'M 68 2 C 67 14 67 26 69 38',
        'M 32 62 C 44 60 56 60 68 62'
      ],
      minorRoads:[
        'M 8 18 H 20','M 48 14 H 56','M 66 12 H 73',
        'M 12 28 H 20','M 48 46 H 58','M 72 48 H 82',
        'M 12 62 H 20'
      ],
      bridges:[],
      relief:[
        'M 60 76 C 66 70 74 66 82 66 C 90 66 95 70 96 74',
        'M 64 72 C 70 67 77 64 83 65 C 89 66 93 69 94 72',
        'M 68 68 C 73 65 78 63 83 64'
      ],
      fabric:[
        {x:9,y:9,w:10,h:6,density:.45,gap:3.4,size:1.2},
        {x:28,y:37,w:14,h:5,density:.5,gap:3.4,size:1.3},
        {x:72,y:55,w:8,h:14,density:.35,gap:3.8,size:1.2},
        {x:46,y:57,w:16,h:8,density:.3,gap:4,size:1.2}
      ]
    },
    lindava:{
      motif:'market town: hall square and Bell Quarter inside, grain fields without',
      slots:{
        civic:[{x:34,y:22,w:18,h:12},{x:8,y:8,w:13,h:9}],
        residence:[{x:60,y:8,w:14,h:9},{x:60,y:26,w:14,h:9}],
        clinic:[{x:8,y:26,w:12,h:9}],
        school:[{x:8,y:44,w:13,h:9}],
        market:[{x:36,y:44,w:14,h:9}],
        worship:[{x:36,y:8,w:13,h:9}],
        public:[{x:60,y:44,w:11,h:8}],
        transport:[{x:8,y:62,w:15,h:9}]
      },
      default:[{x:36,y:62,w:12,h:8},{x:60,y:60,w:12,h:8}],
      districts:[
        {name:'Market Row',x:28,y:18,w:34,h:30},
        {name:'Bell Quarter',x:28,y:4,w:34,h:18},
        {name:'West Fields',x:3,y:4,w:22,h:56}
      ],
      landUse:[
        {kind:'urban',d:'M30 36 H56 V44 H30 Z'},
        {kind:'farmland',texture:'furrow',d:'M3 4 H21 V60 H3 Z'},
        {kind:'farmland',texture:'furrow',d:'M62 62 H97 V79 H62 Z'},
        {kind:'meadow',d:'M62 44 H96 V60 H62 Z'},
        {kind:'gardens',texture:'trees',d:'M30 4 H56 V18 H30 Z'}
      ],
      waterways:[],
      railways:[],
      roads:[
        'M 2 40 H 98',
        'M 26 2 V 78',
        'M 58 2 V 78',
        'M 30 22 C 38 20 48 20 56 22',
        'M 2 68 H 26',
        'M 58 56 C 70 54 82 54 98 56'
      ],
      minorRoads:[
        'M 30 12 H 56','M 30 30 H 56','M 62 12 H 92','M 62 30 H 92',
        'M 8 14 H 21','M 8 32 H 21','M 8 50 H 21',
        'M 36 48 H 50','M 62 48 H 92','M 30 62 H 56'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:31,y:37,w:23,h:6,density:.75,gap:2.6,size:1.5},
        {x:32,y:6,w:22,h:10,density:.7,gap:2.8,size:1.4},
        {x:63,y:6,w:26,h:18,density:.65,gap:3,size:1.5},
        {x:5,y:6,w:13,h:50,density:.4,gap:3.6,size:1.3},
        {x:64,y:64,w:28,h:12,density:.35,gap:4,size:1.4}
      ]
    },
    sundervik:{
      motif:'fishing town: harbor steps on the northern sea, nets ashore, signal hill above',
      slots:{
        residence:[{x:8,y:18,w:14,h:9}],
        transport:[{x:26,y:16,w:16,h:10},{x:70,y:16,w:13,h:9}],
        clinic:[{x:8,y:34,w:12,h:9}],
        school:[{x:26,y:34,w:13,h:9}],
        market:[{x:46,y:34,w:11,h:9}],
        civic:[{x:64,y:34,w:12,h:9}],
        worship:[{x:8,y:52,w:12,h:9}],
        bureau:[{x:46,y:16,w:11,h:8}],
        public:[{x:46,y:52,w:11,h:8}]
      },
      default:[{x:64,y:52,w:12,h:9},{x:26,y:52,w:12,h:9}],
      districts:[
        {name:'Harbor Steps',x:4,y:4,w:38,h:22},
        {name:'Netmakers\u2019 Row',x:22,y:26,w:38,h:20},
        {name:'Signal Hill',x:60,y:4,w:37,h:34}
      ],
      landUse:[
        {kind:'harbor',d:'M2 2 H98 V13 H2 Z'},
        {kind:'yard',texture:'hatch',d:'M24 27 H44 V36 H24 Z'},
        {kind:'meadow',d:'M62 42 H96 V60 H62 Z'},
        {kind:'urban',d:'M24 44 H42 V52 H24 Z'}
      ],
      waterways:[
        {kind:'water',d:'M2 2 H98 V13 H2 Z'},
        {kind:'coast',d:'M 2 13 C 20 12 40 14 60 13 S 88 12 98 13'},
        {kind:'quay',d:'M 2 13.6 H 98'},
        {kind:'quay',d:'M 10 13.6 V 17 M 13 13.6 V 17.6 M 16 13.6 V 18.2 M 19 13.6 V 17.6 M 22 13.6 V 17'}
      ],
      railways:[],
      roads:[
        'M 2 30 H 98',
        'M 24 13 C 25 26 25 44 24 78',
        'M 60 13 C 61 24 61 34 60 46',
        'M 2 46 H 98',
        'M 84 13 V 46'
      ],
      minorRoads:[
        'M 8 22 H 20','M 28 20 H 40','M 48 20 H 56','M 72 20 H 81',
        'M 8 40 H 20','M 28 41 H 38','M 48 41 H 56','M 64 40 H 76',
        'M 28 52 H 42','M 48 52 H 56','M 64 52 H 76'
      ],
      bridges:[],
      relief:[
        'M 62 44 C 68 38 76 34 84 34 C 91 34 96 38 97 43',
        'M 66 41 C 71 37 78 35 84 36 C 89 37 93 40 94 43'
      ],
      fabric:[
        {x:25,y:28,w:18,h:8,density:.7,gap:2.6,size:1.4},
        {x:25,y:45,w:16,h:6,density:.6,gap:3,size:1.4},
        {x:49,y:45,w:6,h:6,density:.6,gap:3,size:1.3},
        {x:65,y:53,w:26,h:8,density:.4,gap:3.6,size:1.4},
        {x:5,y:20,w:16,h:8,density:.5,gap:3.2,size:1.3}
      ]
    },
    oberhain:{
      motif:'former estate village: lawns and chapel lane cut by the military road',
      slots:{
        residence:[{x:38,y:10,w:20,h:14}],
        worship:[{x:8,y:10,w:13,h:9},{x:8,y:28,w:12,h:9}],
        civic:[{x:64,y:10,w:12,h:9}],
        clinic:[{x:64,y:28,w:11,h:8}],
        school:[{x:26,y:34,w:13,h:9}],
        market:[{x:44,y:34,w:12,h:9}],
        transport:[{x:8,y:48,w:14,h:9}],
        bureau:[{x:64,y:48,w:10,h:8}],
        public:[{x:30,y:60,w:12,h:9}]
      },
      default:[{x:64,y:64,w:12,h:8},{x:48,y:60,w:11,h:8}],
      districts:[
        {name:'Upper Hain',x:30,y:4,w:36,h:26},
        {name:'Chapel Lane',x:3,y:4,w:24,h:36},
        {name:'South Yards',x:56,y:4,w:41,h:26}
      ],
      landUse:[
        {kind:'estate',texture:'trees',d:'M32 4 H62 V30 H32 Z'},
        {kind:'estate',texture:'trees',d:'M34 30 H58 V44 H34 Z'},
        {kind:'institutional',d:'M60 6 H78 V24 H60 Z'},
        {kind:'yard',texture:'hatch',d:'M80 6 H97 V24 H80 Z'},
        {kind:'farmland',texture:'furrow',d:'M46 46 H97 V60 H46 Z'}
      ],
      waterways:[],
      railways:[],
      roads:[
        'M 2 78 C 24 64 48 48 70 34 C 80 28 90 24 98 22',
        'M 14 2 C 15 14 15 24 14 34 C 13 44 13 54 15 64',
        'M 14 34 C 24 36 34 36 44 34 C 56 32 68 32 80 34',
        'M 44 34 C 46 44 46 54 44 62',
        'M 60 24 C 62 34 62 44 60 52'
      ],
      minorRoads:[
        'M 8 16 H 21','M 8 33 H 20',
        'M 26 38 H 39','M 46 39 H 56',
        'M 64 33 H 74','M 66 48 H 74',
        'M 32 65 H 42','M 50 64 H 59'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:36,y:31,w:18,h:10,density:.4,gap:3.6,size:1.3},
        {x:48,y:47,w:44,h:11,density:.3,gap:4,size:1.4},
        {x:5,y:56,w:22,h:8,density:.35,gap:3.8,size:1.3},
        {x:82,y:8,w:13,h:14,density:.5,gap:3,size:1.6}
      ]
    },
    marec:{
      motif:'county and grain town: offices row above the granaries, Low Road housing',
      slots:{
        civic:[{x:8,y:8,w:16,h:10},{x:28,y:8,w:15,h:10},{x:8,y:26,w:14,h:9},{x:47,y:26,w:13,h:9}],
        bureau:[{x:47,y:8,w:13,h:9},{x:64,y:26,w:11,h:8}],
        residence:[{x:66,y:8,w:14,h:9}],
        clinic:[{x:26,y:26,w:13,h:9}],
        transport:[{x:26,y:46,w:15,h:9}],
        public:[{x:47,y:46,w:11,h:8}]
      },
      default:[{x:8,y:46,w:13,h:8},{x:66,y:46,w:11,h:8}],
      districts:[
        {name:'County Offices',x:3,y:4,w:60,h:22},
        {name:'Grain Market',x:3,y:22,w:60,h:22},
        {name:'Low Road',x:3,y:40,w:60,h:38}
      ],
      landUse:[
        {kind:'institutional',d:'M4 4 H60 V20 H4 Z'},
        {kind:'yard',texture:'hatch',d:'M4 42 H22 V52 H4 Z'},
        {kind:'farmland',texture:'furrow',d:'M64 42 H97 V78 H64 Z'},
        {kind:'urban',d:'M24 58 H60 V76 H24 Z'}
      ],
      waterways:[],
      railways:[
        {d:'M 2 56 C 16 55 22 52 26 48'},
        {d:'M 26 48 C 40 46 60 46 98 47'},
        {d:'M 41 46 V 52',spur:true}
      ],
      roads:[
        'M 2 22 H 98',
        'M 2 40 H 98',
        'M 24 2 V 78',
        'M 62 2 V 78',
        'M 84 2 V 78'
      ],
      minorRoads:[
        'M 8 14 H 21','M 30 14 H 42','M 48 14 H 60','M 66 14 H 82',
        'M 8 31 H 21','M 28 31 H 42','M 48 31 H 58','M 66 31 H 74',
        'M 8 48 H 20','M 44 48 H 56','M 66 48 H 80',
        'M 28 64 H 58','M 8 64 H 20'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:25,y:59,w:33,h:15,density:.8,gap:2.8,size:1.6},
        {x:5,y:43,w:16,h:8,density:.7,gap:3,size:1.8},
        {x:44,y:56,w:14,h:8,density:.6,gap:3.2,size:1.6},
        {x:66,y:44,w:28,h:10,density:.35,gap:4,size:1.5}
      ]
    },
    kamenor:{
      motif:'river-crossing town: the broad river, its bridge, quays and converging ways',
      slots:{
        civic:[{x:34,y:42,w:17,h:11},{x:26,y:8,w:13,h:9}],
        residence:[{x:60,y:44,w:13,h:9},{x:26,y:56,w:14,h:9}],
        clinic:[{x:60,y:8,w:12,h:9}],
        school:[{x:8,y:8,w:13,h:9}],
        workplace:[{x:44,y:12,w:14,h:10}],
        worship:[{x:8,y:44,w:12,h:9}],
        bureau:[{x:64,y:19,w:10,h:7}],
        public:[{x:62,y:60,w:11,h:8}]
      },
      default:[{x:8,y:64,w:12,h:8},{x:80,y:52,w:10,h:8}],
      districts:[
        {name:'Bridge Ward',x:28,y:24,w:34,h:32},
        {name:'Mill Bank',x:20,y:4,w:44,h:22},
        {name:'Old Quays',x:3,y:40,w:26,h:38}
      ],
      landUse:[
        {kind:'water',d:'M0 27 C 18 25 40 29 58 27 S 88 25 100 28 L100 41 C 82 43 60 39 42 41 S 12 43 0 40 Z'},
        {kind:'meadow',d:'M3 56 H22 V78 H3 Z'},
        {kind:'urban',d:'M30 55 H56 V66 H30 Z'}
      ],
      waterways:[
        {kind:'river',d:'M 0 33 C 18 31 40 35 58 33 S 88 31 100 34'},
        {kind:'river',d:'M 0 35 C 18 33 40 37 58 35 S 88 33 100 36'},
        {kind:'stream',d:'M 51 22 C 51 26 50 29 50 32'},
        {kind:'quay',d:'M 4 41.5 H 30'},
        {kind:'quay',d:'M 52 40.5 H 96'},
        {kind:'quay',d:'M 8 26.5 H 30'}
      ],
      railways:[],
      roads:[
        'M 42 2 V 24',
        'M 42 44 C 41 56 41 68 42 80',
        'M 2 47 C 14 46 26 45 40 44',
        'M 42 46 C 56 45 72 45 98 46',
        'M 2 14 C 14 13 22 12 32 12',
        'M 46 12 C 60 11 76 11 98 12',
        'M 12 2 C 13 10 13 18 12 26'
      ],
      minorRoads:[
        'M 8 14 H 20','M 60 14 H 70',
        'M 8 49 H 19','M 62 49 H 72',
        'M 28 61 H 38','M 62 65 H 72',
        'M 66 22 H 73'
      ],
      bridges:[
        {x:37,y:26,w:9,h:15}
      ],
      relief:[],
      fabric:[
        {x:30,y:56,w:24,h:8,density:.6,gap:2.8,size:1.4},
        {x:4,y:58,w:18,h:16,density:.4,gap:3.6,size:1.3},
        {x:62,y:44,w:26,h:8,density:.5,gap:3.2,size:1.4},
        {x:6,y:6,w:16,h:8,density:.4,gap:3.4,size:1.3}
      ]
    },
    svetlin:{
      motif:'monastery village: walled close and clinic road, gardens and farms around',
      slots:{
        worship:[{x:34,y:8,w:20,h:14},{x:8,y:8,w:13,h:9}],
        clinic:[{x:8,y:26,w:12,h:9},{x:62,y:26,w:12,h:9}],
        residence:[{x:62,y:8,w:13,h:9},{x:34,y:34,w:12,h:9}],
        school:[{x:8,y:44,w:13,h:9}],
        market:[{x:62,y:44,w:12,h:9}],
        bureau:[{x:26,y:26,w:11,h:8}],
        public:[{x:34,y:56,w:12,h:9}]
      },
      default:[{x:62,y:60,w:12,h:8},{x:8,y:60,w:12,h:8}],
      districts:[
        {name:'Monastery Close',x:28,y:2,w:32,h:24},
        {name:'Clinic Road',x:3,y:22,w:94,h:16},
        {name:'East Gardens',x:56,y:38,w:41,h:40}
      ],
      landUse:[
        {kind:'institutional',texture:'trees',d:'M30 3 H58 V25 H30 Z'},
        {kind:'gardens',texture:'trees',d:'M32 26 H56 V34 H32 Z'},
        {kind:'farmland',texture:'furrow',d:'M58 40 H97 V60 H58 Z'},
        {kind:'farmland',texture:'furrow',d:'M58 62 H97 V79 H58 Z'},
        {kind:'meadow',d:'M3 56 H30 V79 H3 Z'},
        {kind:'orchard',texture:'orchard',d:'M34 66 H54 V78 H34 Z'}
      ],
      waterways:[],
      railways:[],
      roads:[
        'M 2 30 H 98',
        'M 22 2 C 23 16 23 30 22 44 C 21 56 21 68 22 80',
        'M 58 2 C 59 14 59 24 58 34 C 57 48 57 64 58 80',
        'M 22 52 C 32 50 44 50 56 52'
      ],
      minorRoads:[
        'M 8 13 H 21','M 62 13 H 74',
        'M 26 34 H 34','M 46 34 H 58',
        'M 8 49 H 21','M 62 49 H 74',
        'M 26 62 H 34','M 46 62 H 58'
      ],
      bridges:[],
      relief:[],
      fabric:[
        {x:5,y:6,w:14,h:16,density:.35,gap:3.8,size:1.2},
        {x:62,y:6,w:12,h:6,density:.35,gap:3.8,size:1.2},
        {x:60,y:64,w:32,h:12,density:.3,gap:4.2,size:1.4},
        {x:6,y:64,w:14,h:12,density:.25,gap:4.2,size:1.2}
      ]
    }
  };
  function settlementPlan(id){ return Object.prototype.hasOwnProperty.call(SETTLEMENT_PLANS,id)?SETTLEMENT_PLANS[id]:null; }
  function legacyRect(i){
    return {x:12+(i%5)*18+(Math.floor(i/5)%2)*4,y:15+Math.floor(i/5)*31,w:10+(i%3)*2,h:8+(i%2)*2};
  }
  function placeBuildings(buildings,plan){
    const list=Array.isArray(buildings)?buildings:[];
    if(!plan){
      return list.map((b,i)=>Object.assign({},b,legacyRect(i)));
    }
    const queues={};
    TYPE_ORDER.forEach(type=>{ queues[type]=(plan.slots&&plan.slots[type]?plan.slots[type]:[]).slice(); });
    const fallback=(plan.default||[]).slice();
    return list.map((b,i)=>{
      const queue=queues[b.type];
      const rect=(queue&&queue.length)?queue.shift():(fallback.length?fallback.shift():legacyRect(i));
      return Object.assign({},b,rect);
    });
  }

  /* ---- plan geometry builders (string output only) ---- */
  function districtsMarkup(plan){
    if(!plan||!plan.districts||!plan.districts.length) return '';
    return '<g class="plan-districts" aria-hidden="true">'+plan.districts.map(d=>{
      const lx=clamp(d.x+d.w/2,d.x+6,d.x+d.w-6), ly=clamp(d.y+d.h/2,d.y+5,d.y+d.h-3);
      return '<rect class="plan-district-area" x="'+d.x+'" y="'+d.y+'" width="'+d.w+'" height="'+d.h+'" rx="1.4"></rect>'
        +'<rect class="plan-district-boundary" x="'+d.x+'" y="'+d.y+'" width="'+d.w+'" height="'+d.h+'" rx="1.4"'+nsAttr()+'></rect>'
        +'<text class="plan-district-label" x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'">'+d.name.toUpperCase()+'</text>';
    }).join('')+'</g>';
  }
  const LANDUSE_FILL={urban:'#e3e0cd',farmland:'#eae6c4',meadow:'#e0e7c7',gardens:'#dbe4cf',estate:'#dde6d3',industrial:'#ddd8ca',yard:'#ded9c9',institutional:'#e2ddce',orchard:'#e2e8c9',harbor:'#cfe0e4',forest:'#cbdcc9'};
  function landUseMarkup(plan){
    if(!plan||!plan.landUse||!plan.landUse.length) return '';
    return '<g class="plan-landuse" aria-hidden="true">'+plan.landUse.map(p=>{
      const cls=LANDUSE_FILL[p.kind]?'lu-'+p.kind:'lu-meadow';
      const tex=p.texture?'<path class="lu-texture lu-tex-'+p.texture+'" d="'+p.d+'"'+nsAttr()+'></path>':'';
      return '<path class="'+cls+'" d="'+p.d+'"></path>'+tex;
    }).join('')+'</g>';
  }
  const WATERWAY_CLASS={water:'plan-water-area',river:'plan-river-line',stream:'plan-stream-line',coast:'plan-coast-line',quay:'plan-quay-line'};
  function waterwaysMarkup(plan){
    if(!plan||!plan.waterways||!plan.waterways.length) return '';
    return '<g class="plan-waterways" aria-hidden="true">'+plan.waterways.map(w=>{
      const cls=WATERWAY_CLASS[w.kind]||'plan-river-line';
      return '<path class="'+cls+'" d="'+w.d+'"'+(w.kind==='water'?'':nsAttr())+'></path>';
    }).join('')+'</g>';
  }
  function railwaysMarkup(plan){
    if(!plan||!plan.railways||!plan.railways.length) return '';
    return '<g class="plan-railways" aria-hidden="true">'+plan.railways.map(r=>{
      const d=typeof r==='string'?r:r.d, spur=!!(r&&r.spur);
      return '<path class="plan-rail-casing" d="'+d+'"'+nsAttr()+'></path>'
        +'<path class="plan-rail'+(spur?' spur':'')+'" d="'+d+'"'+nsAttr()+'></path>';
    }).join('')+'</g>';
  }
  function planRoadsMarkup(plan){
    if(!plan) return '';
    return '<g class="plan-streets">'
      +paths('plan-road',plan.roads||[])
      +paths('plan-road minor',(plan.minorRoads||[]).filter(d=>typeof d==='string'))
      +'</g>';
  }
  function bridgesMarkup(plan){
    if(!plan||!plan.bridges||!plan.bridges.length) return '';
    return '<g class="plan-bridges" aria-hidden="true">'+plan.bridges.map(b=>
      '<rect class="plan-bridge" x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx=".6"></rect>'
    ).join('')+'</g>';
  }
  function reliefMarkup(plan){
    if(!plan||!plan.relief||!plan.relief.length) return '';
    return '<g class="plan-relief" aria-hidden="true">'+paths('plan-contour',plan.relief)+'</g>';
  }
  function fabricBlocks(plan,id){
    if(!plan||!plan.fabric||!plan.fabric.length) return [];
    const rnd=seeded(hashSeed(id||'karsen'));
    const out=[];
    plan.fabric.forEach(zone=>{
      const gap=num(zone.gap,3), size=num(zone.size,1.6), dens=clamp(num(zone.density,.5),0,1);
      for(let y=zone.y;y<=zone.y+zone.h-size;y+=gap){
        for(let x=zone.x;x<=zone.x+zone.w-size;x+=gap){
          const keep=rnd();
          const jw=size*(0.7+rnd()*0.6), jh=size*(0.65+rnd()*0.7);
          const ox=rnd()*0.8, oy=rnd()*0.8;
          if(keep<dens){
            out.push({x:+(x+ox).toFixed(2),y:+(y+oy).toFixed(2),w:+jw.toFixed(2),h:+jh.toFixed(2)});
          }
        }
      }
    });
    return out;
  }
  function fabricMarkup(plan,id){
    const blocks=fabricBlocks(plan,id);
    if(!blocks.length) return '';
    return '<g class="plan-fabric" aria-hidden="true">'+blocks.map(b=>
      '<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx=".25"></rect>'
    ).join('')+'</g>';
  }
  function settlementBaseMarkup(plan,id){
    if(!plan) return '';
    return districtsMarkup(plan)
      +landUseMarkup(plan)
      +waterwaysMarkup(plan)
      +reliefMarkup(plan)
      +fabricMarkup(plan,id)
      +railwaysMarkup(plan)
      +planRoadsMarkup(plan)
      +bridgesMarkup(plan);
  }

  /* ---- POI cartographic symbols (presentation only, pointer-events none) ---- */
  function starPath(cx,cy,R,r){
    let p='';
    for(let i=0;i<10;i++){
      const a=-Math.PI/2+i*Math.PI/5, rad=i%2?r:R;
      p+=(i?'L ':'M ')+(cx+Math.cos(a)*rad).toFixed(2)+' '+(cy+Math.sin(a)*rad).toFixed(2)+' ';
    }
    return p+'Z';
  }
  function poiSymbolMarkup(type,cx,cy,s){
    const k=num(s,1.1);
    let inner='';
    if(type==='transport'){
      inner='<circle cx="'+cx+'" cy="'+cy+'" r="'+(k*0.85)+'" class="sym-fill"/><circle cx="'+cx+'" cy="'+cy+'" r="'+(k*0.3)+'" class="sym-core"/>';
    }else if(type==='bureau'){
      inner='<path d="'+starPath(cx,cy,k,k*0.45)+'" class="sym-fill"/>';
    }else if(type==='civic'){
      inner='<path d="M '+(cx-k)+' '+(cy+k*0.6)+' L '+cx+' '+(cy-k*0.8)+' L '+(cx+k)+' '+(cy+k*0.6)+' Z" class="sym-line"/>'
        +'<path d="M '+(cx-k*0.8)+' '+(cy+k*0.9)+' H '+(cx+k*0.8)+'" class="sym-line"/>';
    }else if(type==='clinic'){
      inner='<path d="M '+cx+' '+(cy-k)+' V '+(cy+k)+' M '+(cx-k)+' '+cy+' H '+(cx+k)+'" class="sym-heavy"/>';
    }else if(type==='school'){
      inner='<path d="M '+(cx-k*0.7)+' '+(cy+k)+' V '+(cy-k*0.8)+'" class="sym-line"/>'
        +'<path d="M '+(cx-k*0.7)+' '+(cy-k*0.8)+' L '+(cx+k*0.9)+' '+(cy-k*0.3)+' L '+(cx-k*0.7)+' '+(cy+k*0.2)+' Z" class="sym-fill"/>';
    }else if(type==='market'){
      inner='<path d="M '+cx+' '+(cy-k*0.9)+' V '+(cy+k*0.5)+'" class="sym-line"/>'
        +'<path d="M '+(cx-k)+' '+(cy-k*0.5)+' H '+(cx+k)+'" class="sym-line"/>'
        +'<circle cx="'+(cx-k*0.75)+'" cy="'+(cy-k*0.05)+'" r="'+(k*0.32)+'" class="sym-line"/>'
        +'<circle cx="'+(cx+k*0.75)+'" cy="'+(cy-k*0.05)+'" r="'+(k*0.32)+'" class="sym-line"/>';
    }else if(type==='worship'){
      inner='<path d="M '+cx+' '+(cy-k)+' V '+(cy+k)+'" class="sym-heavy"/>'
        +'<path d="M '+(cx-k*0.6)+' '+(cy-k*0.25)+' H '+(cx+k*0.6)+'" class="sym-heavy"/>';
    }else if(type==='workplace'){
      inner='<path d="M '+(cx-k)+' '+(cy+k*0.7)+' V '+(cy-k*0.1)+' L '+(cx-k*0.3)+' '+(cy-k*0.55)+' L '+(cx-k*0.3)+' '+(cy-k*0.1)+' L '+cx+' '+(cy-k*0.55)+' L '+cx+' '+(cy-k*0.1)+' L '+(cx+k*0.7)+' '+(cy-k*0.55)+' V '+(cy+k*0.7)+' Z" class="sym-line"/>';
    }else if(type==='residence'){
      inner='<path d="M '+(cx-k)+' '+(cy+k*0.7)+' V '+(cy-k*0.1)+' L '+cx+' '+(cy-k*0.9)+' L '+(cx+k)+' '+(cy-k*0.1)+' V '+(cy+k*0.7)+' Z" class="sym-line"/>';
    }else{
      inner='<circle cx="'+cx+'" cy="'+cy+'" r="'+(k*0.75)+'" class="sym-line"/><circle cx="'+cx+'" cy="'+cy+'" r="'+(k*0.22)+'" class="sym-fill"/>';
    }
    return '<g class="map-poi poi-'+type+'" aria-hidden="true" pointer-events="none">'+inner+'</g>';
  }

  /* ---- cartography furniture: scale bar and illustrated legends ---- */
  function scaleBarMarkup(kind){
    const cfg=kind==='settlement'
      ?{label:'500 FEET',note:'MUNICIPAL SURVEY - SCALE OF SHEET'}
      :{label:'100 KILOMETERS',note:'PROVISIONAL SURVEY - SCALE OF SHEET'};
    return '<div class="map-scalebar" aria-hidden="true"><span class="sb-bar"><i></i><i></i><i></i><i></i></span><b>'+cfg.label+'</b><em>'+cfg.note+'</em></div>';
  }
  function legendSwatch(kind){
    const open='<svg viewBox="0 0 20 12" class="lg-svg">';
    const map={
      capital:open+'<circle cx="10" cy="6" r="4" class="lg-capital"/><circle cx="10" cy="6" r="1.5" class="lg-capital-core"/></svg>',
      city:open+'<circle cx="10" cy="6" r="3.4" class="lg-city"/></svg>',
      town:open+'<circle cx="10" cy="6" r="2.6" class="lg-town"/></svg>',
      village:open+'<circle cx="10" cy="6" r="2" class="lg-village"/></svg>',
      rail:open+'<path d="M1 6 H19" class="lg-rail"/></svg>',
      road:open+'<path d="M1 6 H19" class="lg-road"/></svg>',
      minor:open+'<path d="M1 6 H19" class="lg-minor"/></svg>',
      river:open+'<path d="M1 6 C6 4 10 8 19 5" class="lg-river"/></svg>',
      forest:open+'<rect x="3" y="2" width="14" height="8" rx="1.5" class="lg-forest"/></svg>',
      farmland:open+'<rect x="3" y="2" width="14" height="8" rx="1.5" class="lg-farmland"/></svg>',
      industrial:open+'<rect x="3" y="2" width="14" height="8" rx="1.5" class="lg-industrial"/></svg>',
      urban:open+'<rect x="3" y="2" width="14" height="8" rx="1.5" class="lg-urban"/></svg>',
      district:open+'<rect x="3" y="2" width="14" height="8" rx="1.5" class="lg-district"/></svg>',
      route:open+'<path d="M1 6 H19" class="lg-route"/></svg>',
      selectedroute:open+'<path d="M1 6 H19" class="lg-route-selected"/></svg>'
    };
    return map[kind]||open+'</svg>';
  }
  function keyRow(kind,label){
    return '<span class="key-row">'+legendSwatch(kind)+'<i>'+label+'</i></span>';
  }
  function nationalLegendMarkup(){
    return '<div class="map-key" data-map-key>'
      +'<button class="map-key-toggle" data-map-key-toggle aria-expanded="false">MAP KEY</button>'
      +'<div class="key-grid">'
      +keyRow('capital','capital')+keyRow('city','city')+keyRow('town','town')+keyRow('village','village')
      +keyRow('rail','railway')+keyRow('road','primary road')+keyRow('minor','country lane')
      +keyRow('river','river')+keyRow('selectedroute','selected route')
      +keyRow('forest','woodland')+keyRow('farmland','farmland')+keyRow('industrial','industry')
      +keyRow('urban','built blocks')+keyRow('district','district bounds')
      +'</div></div>';
  }
  function settlementLegendMarkup(){
    return '<div class="map-key" data-map-key>'
      +'<button class="map-key-toggle" data-map-key-toggle aria-expanded="false">MAP KEY</button>'
      +'<div class="key-grid poi-keys">'
      +'<span class="key-row">'+poiSymbolMarkup('transport',10,6,4)+'<i>station / depot</i></span>'
      +'<span class="key-row">'+poiSymbolMarkup('bureau',10,6,4)+'<i>bureau / registry</i></span>'
      +'<span class="key-row">'+poiSymbolMarkup('civic',10,6,4)+'<i>civic / county</i></span>'
      +'<span class="key-row">'+poiSymbolMarkup('clinic',10,6,4)+'<i>hospital / clinic</i></span>'
      +'<span class="key-row">'+poiSymbolMarkup('market',10,6,4)+'<i>market / store</i></span>'
      +'<span class="key-row">'+poiSymbolMarkup('school',10,6,4)+'<i>school / college</i></span>'
      +'<span class="key-row">'+poiSymbolMarkup('worship',10,6,4)+'<i>chapel / parish</i></span>'
      +'<span class="key-row">'+poiSymbolMarkup('workplace',10,6,4)+'<i>works / mill</i></span>'
      +'<span class="key-row">'+poiSymbolMarkup('residence',10,6,4)+'<i>housing</i></span>'
      +'</div></div>';
  }



  return {
    VERSION,NATIONAL_VIEWBOX,SETTLEMENT_VIEWBOX,NATIONAL_ZOOM,SETTLEMENT_ZOOM,ZOOM_CONFIG,
    createCamera,clampCamera,zoomAtPoint,panBy,fitBounds,
    nationalTier,nationalKindVisible,settlementTier,poiPriority,poiVisible,poiLabelItems,
    nationalLayout,transformY,geoTransform,
    TERRAIN,nationalGeographyMarkup,regionLabelsMarkup,seaLabelsMarkup,routePath,routeMidPoint,patternDefs,
    estimateTextSize,rectsIntersect,layoutLabels,labelLeaderPath,
    TYPE_ORDER,SETTLEMENT_PLANS,settlementPlan,placeBuildings,legacyRect,
    districtsMarkup,landUseMarkup,waterwaysMarkup,railwaysMarkup,planRoadsMarkup,bridgesMarkup,
    reliefMarkup,fabricBlocks,fabricMarkup,poiSymbolMarkup,settlementBaseMarkup,
    scaleBarMarkup,legendSwatch,nationalLegendMarkup,settlementLegendMarkup
  };
})();
