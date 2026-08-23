'use strict';
/* ================= MAP SYSTEM ===========================================
   DOM-free module behind the Karsen map screens. Pure data and math only:
   no document/window/$ access, no random, no World/S coupling.

   Contents:
   - camera math        createCamera / zoomAtPoint / clampCamera / panBy /
                        fitBounds (translation is applied by ui.js as
                        translate(x y) scale(s) on #mapPlane)
   - portrait layout    nationalLayout / transformY / geoTransform
   - national terrain   TERRAIN data + SVG string builders
   - label layout       layoutLabels collision engine (deterministic,
                        priority-ordered, leader-line fallback)
   - settlement plans   SETTLEMENT_PLANS (14 lore-authored plans keyed by
                        building-type anchors) + placeBuildings resolution

   Presentation-only: nothing here owns persistent state, so there is no
   migration surface; geometry produced by placeBuildings() is derived on
   demand from the authoritative building records in js/state.js and never
   mutates them.
   ========================================================================= */
const MapSystem=(function(){
  const VERSION='map-1';
  const ZOOM_MIN=1, ZOOM_MAX=2.2;
  const NATIONAL_VIEWBOX={width:150,height:100};
  const SETTLEMENT_VIEWBOX={width:100,height:82};

  /* ---- small numeric helpers ---- */
  function clamp(v,a,b){ return v<a?a:v>b?b:v; }
  function num(v,fallback){ const n=typeof v==='number'?v:parseFloat(v); return isFinite(n)?n:fallback; }

  /* ======================= CAMERA MATH ================================ */
  function createCamera(){ return {x:0,y:0,scale:1}; }
  function axisLimits(extent,scale){
    const lo=Math.min(0,extent-extent*scale), hi=Math.max(0,extent-extent*scale);
    return {lo,hi};
  }
  function clampCamera(camera,view){
    const scale=clamp(num(camera.scale,ZOOM_MIN),ZOOM_MIN,ZOOM_MAX);
    const width=num(view&&view.width,NATIONAL_VIEWBOX.width);
    const height=num(view&&view.height,NATIONAL_VIEWBOX.height);
    const lx=axisLimits(width,scale), ly=axisLimits(height,scale);
    return {scale,x:clamp(num(camera.x,0),lx.lo,lx.hi),y:clamp(num(camera.y,0),ly.lo,ly.hi)};
  }
  function zoomAtPoint(camera,px,py,targetScale,view){
    const scale=clamp(num(targetScale,camera.scale),ZOOM_MIN,ZOOM_MAX);
    const k=scale/(num(camera.scale,1)||1);
    const next={scale,x:px-(px-num(camera.x,0))*k,y:py-(py-num(camera.y,0))*k};
    return view?clampCamera(next,view):next;
  }
  function panBy(camera,dx,dy,view){
    const next={scale:num(camera.scale,ZOOM_MIN),x:num(camera.x,0)+num(dx,0),y:num(camera.y,0)+num(dy,0)};
    return view?clampCamera(next,view):next;
  }
  function fitBounds(bounds,view,pad){
    const width=num(view&&view.width,NATIONAL_VIEWBOX.width);
    const height=num(view&&view.height,NATIONAL_VIEWBOX.height);
    const m=num(pad,0);
    const bw=Math.max(num(bounds&&bounds.w,0)+m*2,0.001), bh=Math.max(num(bounds&&bounds.h,0)+m*2,0.001);
    const scale=clamp(Math.min(width/bw,height/bh),ZOOM_MIN,ZOOM_MAX);
    const cx=num(bounds&&bounds.x,0)+num(bounds&&bounds.w,0)/2, cy=num(bounds&&bounds.y,0)+num(bounds&&bounds.h,0)/2;
    return clampCamera({scale,x:width/2-cx*scale,y:height/2-cy*scale},view);
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

  /* ---- national SVG builders (string output only) ---- */
  function paths(cls,list){
    return list.map(d=>'<path class="'+cls+'" d="'+d+'"></path>').join('');
  }
  function seaDetailsMarkup(includeLabels){
    const labels=includeLabels
      ?TERRAIN.sea.labels.map(l=>'<text class="map-sea-label" x="'+l.x+'" y="'+transformY(null,l.y)+'" text-anchor="'+l.anchor+'">'+l.text+'</text>').join('')
      :'';
    return '<g class="map-sea-details" aria-hidden="true"><path class="map-shore" d="'+TERRAIN.shore+'"></path>'+paths('map-sea-line',TERRAIN.sea.lines)+paths('map-sea-island',TERRAIN.sea.islands)+labels+'</g>';
  }
  function greeneryMarkup(){
    return '<g class="map-greenery" aria-hidden="true">'+paths('map-forest',TERRAIN.forests)+paths('map-meadow',TERRAIN.meadows)+paths('map-wetland',TERRAIN.wetlands)+paths('map-industrial',TERRAIN.industrial)+'</g>';
  }
  function nationalGeographyMarkup(layout){
    const inner='<path class="map-border" d="'+TERRAIN.border+'"></path>'
      +seaDetailsMarkup(!(layout&&layout.tall))
      +greeneryMarkup()
      +'<path class="map-river-main" d="'+TERRAIN.rivers.main+'"></path>'
      +paths('map-river',TERRAIN.rivers.branches)
      +paths('map-river-small',TERRAIN.rivers.small)
      +paths('map-minor-road',TERRAIN.minorRoads);
    const transform=geoTransform(layout);
    return '<g'+(transform?' transform="'+transform+'"':'')+'>'+inner+'</g>';
  }
  function regionLabelsMarkup(layout){
    const y=v=>transformY(layout,v);
    return '<g class="map-region-labels" aria-hidden="true">'
      +TERRAIN.regions.map(r=>'<text x="'+r.x+'" y="'+y(r.y)+'">'+r.text+'</text>').join('')+'</g>';
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

  /* ======================= LABEL LAYOUT ENGINE ========================
     Deterministic collision-aware placement. Items are processed highest
     priority first (ties broken by id ascending); each tries a fixed
     sequence of anchor offsets around its dot, then leader-line offsets,
     and commits the first rectangle that neither leaves the viewBox nor
     intersects an occupied rectangle (previously placed labels plus the
     reserved dot rectangles). If every candidate collides, the candidate
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
      let chosen=-1, overlapCount=Infinity, leader=false, flagged=false;
      const evaluated=cands.map((cand,ci)=>{
        const rect=labelRect(item,cand,size);
        const outside=rect.x<margin||rect.y<margin||rect.x+rect.w>width-margin||rect.y+rect.h>height-margin;
        let hits=outside?1:0;
        for(let i=0;i<occupied.length;i++) if(rectsIntersect(rect,occupied[i])) hits++;
        return {ci,cand,rect,hits,outside};
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
     Fourteen lore-authored ground plans. Each plan's `slots` table is
     keyed by building-type anchor (the same type vocabulary produced by
     inferBuildingType in js/state.js); `default` holds spare plots for
     any building whose type queue runs dry; `water` draws streams/harbor
     edges beneath the buildings. Coordinates live on the 100x82
     settlement sheet and never overlap.
     --------------------------------------------------------------------- */
  const TYPE_ORDER=['bureau','civic','transport','clinic','school','market','worship','residence','workplace','public'];
  const SETTLEMENT_PLANS={
    branec:{
      motif:'capital grid around the Registry plaza',
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
      water:[]
    },
    veskar:{
      motif:'terraces stepping down to the harbor wall',
      slots:{
        civic:[{x:40,y:8,w:14,h:10}],
        workplace:[{x:30,y:60,w:18,h:9}],
        transport:[{x:8,y:34,w:15,h:9}],
        residence:[{x:8,y:8,w:13,h:9},{x:60,y:34,w:14,h:9},{x:74,y:8,w:12,h:9}],
        clinic:[{x:58,y:8,w:12,h:9}],
        market:[{x:74,y:34,w:13,h:9}],
        school:[{x:24,y:20,w:12,h:9}],
        bureau:[{x:42,y:34,w:13,h:9}],
        public:[{x:56,y:20,w:11,h:8}]
      },
      default:[{x:8,y:52,w:12,h:9},{x:74,y:52,w:12,h:9}],
      water:['M 2 76 C 20 74 40 78 60 76 S 88 74 98 77']
    },
    eisenmark:{
      motif:'foundry ring with company rows',
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
      water:[]
    },
    kostrin:{
      motif:'college hill above the hospital ward',
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
      water:[]
    },
    rudava:{
      motif:'platforms and freight spurs',
      slots:{
        transport:[{x:28,y:8,w:18,h:11},{x:8,y:24,w:22,h:12},{x:52,y:24,w:14,h:9},{x:52,y:8,w:14,h:9},{x:8,y:42,w:14,h:9}],
        civic:[{x:52,y:40,w:13,h:9}],
        market:[{x:70,y:8,w:13,h:9}],
        school:[{x:70,y:24,w:12,h:9}],
        bureau:[{x:70,y:40,w:13,h:9}],
        public:[{x:30,y:60,w:12,h:9}]
      },
      default:[{x:52,y:60,w:13,h:9},{x:70,y:60,w:12,h:9}],
      water:[]
    },
    dobraven:{
      motif:'county square ringed by old stones',
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
      water:[]
    },
    krasnava:{
      motif:'green at the crossroads, fields beyond',
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
      water:['M 2 68 C 24 66 44 70 66 68 S 90 66 98 68']
    },
    brezin:{
      motif:'clearings strung along the timber road',
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
      water:[]
    },
    lindava:{
      motif:'market cross with bell tower',
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
      water:[]
    },
    sundervik:{
      motif:'steps from the harbor to the signal hill',
      slots:{
        residence:[{x:8,y:16,w:14,h:9}],
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
      water:['M 2 7 C 24 5 48 9 72 7 S 92 5 98 7']
    },
    oberhain:{
      motif:'estate lawns cut by the military road',
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
      water:[]
    },
    marec:{
      motif:'county offices facing the grain square',
      slots:{
        civic:[{x:8,y:8,w:16,h:10},{x:28,y:8,w:15,h:10},{x:8,y:26,w:14,h:9},{x:47,y:26,w:13,h:9}],
        bureau:[{x:47,y:8,w:13,h:9},{x:64,y:26,w:11,h:8}],
        residence:[{x:66,y:8,w:14,h:9}],
        clinic:[{x:26,y:26,w:13,h:9}],
        transport:[{x:26,y:46,w:15,h:9}],
        public:[{x:47,y:46,w:11,h:8}]
      },
      default:[{x:8,y:46,w:13,h:8},{x:66,y:46,w:11,h:8}],
      water:[]
    },
    kamenor:{
      motif:'bridge head, mill race, ferry slip',
      slots:{
        civic:[{x:34,y:40,w:17,h:11},{x:26,y:8,w:13,h:9}],
        residence:[{x:60,y:44,w:13,h:9},{x:26,y:56,w:14,h:9}],
        clinic:[{x:60,y:8,w:12,h:9}],
        school:[{x:8,y:8,w:13,h:9}],
        workplace:[{x:44,y:14,w:14,h:10}],
        worship:[{x:8,y:44,w:12,h:9}],
        bureau:[{x:64,y:26,w:10,h:8}],
        public:[{x:62,y:60,w:11,h:8}]
      },
      default:[{x:8,y:64,w:12,h:8},{x:80,y:52,w:10,h:8}],
      water:['M 2 32 C 22 36 42 30 62 35 S 90 41 98 37']
    },
    svetlin:{
      motif:'monastery close with pilgrim lanes',
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
      water:[]
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
  function settlementWaterMarkup(plan){
    if(!plan||!plan.water||!plan.water.length) return '';
    return paths('map-river',plan.water);
  }

  return {
    VERSION, ZOOM_MIN, ZOOM_MAX, NATIONAL_VIEWBOX, SETTLEMENT_VIEWBOX,
    createCamera, clampCamera, zoomAtPoint, panBy, fitBounds,
    nationalLayout, transformY, geoTransform,
    TERRAIN, nationalGeographyMarkup, regionLabelsMarkup, seaLabelsMarkup, routePath,
    estimateTextSize, rectsIntersect, layoutLabels, labelLeaderPath,
    TYPE_ORDER, SETTLEMENT_PLANS, settlementPlan, placeBuildings, settlementWaterMarkup, legacyRect
  };
})();
