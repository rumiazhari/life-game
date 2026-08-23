'use strict';
/* ================= MAP SYSTEM ===========================================
   DOM-free module behind the Karsen map screens. Pure data and math only:
   no document/window/$ access, no random, no World/S coupling.

   NATIONAL MAP
   - single 150x100 survey sheet, camera profile NATIONAL_ZOOM (1..5)
   - authored terrain data, deterministic label collision engine

   SETTLEMENT MAPS (large navigable world space)
   - every settlement owns an authored plan with explicit bounds in map
     units: villages roughly 900x720, towns 1500x1150, cities up to
     3000x2200. Nothing is stretched from a smaller diagram.
   - morphology is Central-European inspired and street-driven: authored
     road skeletons carry corridor recipes and deterministic generators
     derive individual building footprints along the streets (frontage
     rows, courtyard infill, village plots with barns, industrial sheds).
     Same inputs always produce byte-identical output (seeded PRNG).
   - canonical gameplay buildings are NOT abstract gameplay rectangles:
     each plan authors ten landmark footprints which the scene binds to
     the canonical records (${id}-b1..b10) via visualBuildingForCanonicalId.
     Ordinary fabric is presentation-only.
   - districts are authored polygons; canonical landmarks must lie inside
     their canonical district (tested via ray-casting).
   - annotations (labels/icons/street names) belong to their entities:
     anchors come from entity geometry, positions from the deterministic
     declutter engine, rendering is counter-scaled so text and icons keep
     approximately constant screen size while the map itself scales.

   Canonical gameplay authority remains in js/state.js (KARSEN_SETTLEMENTS,
   KARSEN_ROUTES, travelCost, routeBetween, World.map). This module owns
   presentation geometry only and never mutates game records.
   ========================================================================= */
const MapSystem=(function(){
  const VERSION='map-3';
  const NATIONAL_VIEWBOX={width:150,height:100};

  const NATIONAL_ZOOM={min:1,max:5};
  const ZOOM_CONFIG={national:NATIONAL_ZOOM};

  /* ---- small numeric helpers ---- */
  function clamp(v,a,b){ return v<a?a:v>b?b:v; }
  function num(v,fallback){ const n=typeof v==='number'?v:parseFloat(v); return isFinite(n)?n:fallback; }

  /* ---- deterministic PRNG (no Math.random anywhere) ---- */
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

  /* ---- gesture decision helpers (pure; UI owns event plumbing) ---- */
  const GESTURE={DRAG_PX:5,DOUBLE_MS:340,DOUBLE_DIST:30};
  function classifyGesture(dx,dy){
    return Math.hypot(num(dx,0),num(dy,0))<=GESTURE.DRAG_PX?'tap':'drag';
  }
  function isDoubleTap(now,pos,last){
    if(!last) return false;
    if(now-num(last.t,0)>GESTURE.DOUBLE_MS) return false;
    return Math.hypot(num(pos.x,0)-num(last.x,0),num(pos.y,0)-num(last.y,0))<=GESTURE.DOUBLE_DIST;
  }

  /* ======================= CAMERA MATH ================================ */
  function createCamera(){ return {x:0,y:0,scale:1}; }
  function axisLimits(extent,scale){
    return {lo:Math.min(0,extent-extent*scale),hi:Math.max(0,extent-extent*scale)};
  }
  function clampCamera(camera,view,zoom){
    const lim=zoom||NATIONAL_ZOOM;
    const min=num(lim.min,1), max=num(lim.max,NATIONAL_ZOOM.max);
    const scale=clamp(num(camera.scale,min),min,max);
    const width=num(view&&view.width,NATIONAL_VIEWBOX.width);
    const height=num(view&&view.height,NATIONAL_VIEWBOX.height);
    const lx=axisLimits(width,scale), ly=axisLimits(height,scale);
    return {scale,x:clamp(num(camera.x,0),lx.lo,lx.hi),y:clamp(num(camera.y,0),ly.lo,ly.hi)};
  }
  function zoomAtPoint(camera,px,py,targetScale,view,zoom){
    const lim=zoom||NATIONAL_ZOOM;
    const scale=clamp(num(targetScale,camera.scale),num(lim.min,1),num(lim.max,NATIONAL_ZOOM.max));
    const k=scale/(num(camera.scale,1)||1);
    const next={scale,x:px-(px-num(camera.x,0))*k,y:py-(py-num(camera.y,0))*k};
    return view?clampCamera(next,view,zoom):next;
  }
  function panBy(camera,dx,dy,view,zoom){
    const next={scale:num(camera.scale,(zoom||NATIONAL_ZOOM).min),x:num(camera.x,0)+num(dx,0),y:num(camera.y,0)+num(dy,0)};
    return view?clampCamera(next,view,zoom):next;
  }
  function fitBounds(bounds,view,pad,zoom){
    const lim=zoom||NATIONAL_ZOOM;
    const width=num(view&&view.width,NATIONAL_VIEWBOX.width);
    const height=num(view&&view.height,NATIONAL_VIEWBOX.height);
    const m=num(pad,0);
    const bw=Math.max(num(bounds&&bounds.w,0)+m*2,0.001), bh=Math.max(num(bounds&&bounds.h,0)+m*2,0.001);
    const scale=clamp(Math.min(width/bw,height/bh),num(lim.min,1),num(lim.max,NATIONAL_ZOOM.max));
    const cx=num(bounds&&bounds.x,0)+num(bounds&&bounds.w,0)/2, cy=num(bounds&&bounds.y,0)+num(bounds&&bounds.h,0)/2;
    return clampCamera({scale,x:width/2-cx*scale,y:height/2-cy*scale},view,zoom);
  }
  function centerOn(camera,px,py,targetScale,view,zoom){
    const lim=zoom||NATIONAL_ZOOM;
    const scale=clamp(num(targetScale,camera.scale),num(lim.min,1),num(lim.max,NATIONAL_ZOOM.max));
    return clampCamera({scale,x:num(view&&view.width,100)/2-px*scale,y:num(view&&view.height,100)/2-py*scale},view,zoom);
  }
  function viewCenterWorld(camera,view){
    return {x:(num(view&&view.width,100)/2-camera.x)/camera.scale,y:(num(view&&view.height,100)/2-camera.y)/camera.scale};
  }
  function viewRectWorld(camera,view,margin){
    const m=num(margin,0);
    const w=num(view&&view.width,100),h=num(view&&view.height,100);
    const x0=(0-camera.x)/camera.scale, y0=(0-camera.y)/camera.scale;
    const x1=(w-camera.x)/camera.scale, y1=(h-camera.y)/camera.scale;
    const mx=(x1-x0)*m, my=(y1-y0)*m;
    return {x:x0-mx,y:y0-my,w:(x1-x0)+mx*2,h:(y1-y0)+my*2};
  }

  /* ======================= GEOMETRY UTILITIES ========================= */
  function rectPoly(cx,cy,w,h,angle){
    const a=num(angle,0), ca=Math.cos(a), sa=Math.sin(a), hw=w/2, hh=h/2;
    return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(p=>[
      +(cx+p[0]*ca-p[1]*sa).toFixed(1),+(cy+p[0]*sa+p[1]*ca).toFixed(1)]);
  }
  function polyCentroid(poly){
    let x=0,y=0;
    poly.forEach(p=>{x+=p[0];y+=p[1];});
    return {x:x/poly.length,y:y/poly.length};
  }
  function pointInPolygon(px,py,poly){
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
      if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
    }
    return inside;
  }
  function segmentsCross(p1,p2,p3,p4){
    function orient(ax,ay,bx,by,cx,cy){
      return (bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    }
    const d1=orient(p3[0],p3[1],p4[0],p4[1],p1[0],p1[1]);
    const d2=orient(p3[0],p3[1],p4[0],p4[1],p2[0],p2[1]);
    const d3=orient(p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]);
    const d4=orient(p1[0],p1[1],p2[0],p2[1],p4[0],p4[1]);
    return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0));
  }
  function polysIntersect(a,b){
    for(let i=0;i<a.length;i++) if(pointInPolygon(a[i][0],a[i][1],b)) return true;
    for(let i=0;i<b.length;i++) if(pointInPolygon(b[i][0],b[i][1],a)) return true;
    for(let i=0;i<a.length;i++){
      const a2=a[(i+1)%a.length];
      for(let j=0;j<b.length;j++){
        const b2=b[(j+1)%b.length];
        if(segmentsCross(a[i],a2,b[j],b2)) return true;
      }
    }
    return false;
  }
  function polyPath(poly){
    return 'M '+poly.map(p=>p[0]+' '+p[1]).join(' L ')+' Z';
  }
  function linePath(pts){
    return 'M '+pts.map(p=>p[0]+' '+p[1]).join(' L ');
  }
  function segmentsOf(pts){
    const out=[];
    for(let i=0;i<pts.length-1;i++){
      const ax=pts[i][0],ay=pts[i][1],bx=pts[i+1][0],by=pts[i+1][1];
      const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
      if(len>1) out.push({ax,ay,bx,by,len,angle:Math.atan2(dy,dx)});
    }
    return out;
  }

  /* ======================= MORPHOLOGY GENERATORS ======================
     Deterministic street-driven building generation.

     Generators emit candidate footprints into a `place` callback which
     validates them against a SpatialGrid (existing fabric + canonical
     landmarks), road carriageways, open water and protected open land.
     Rejected candidates never reach the map, so ordinary buildings cannot
     materially overlap each other or the streets they front.

     generatePerimeterBlock builds dense Central-European perimeter blocks:
     individual buildings along every block edge facing outward, interior
     left open as a courtyard, optional rear workshops on the courtyard
     ring and passage gaps in the frontage.
     --------------------------------------------------------------------- */
  function generateCorridor(seg,params,rnd,place){
    const dirX=Math.cos(seg.angle), dirY=Math.sin(seg.angle);
    const perpX=-dirY, perpY=dirX;
    const interval=num(params.interval,26), setback=num(params.setback,5);
    const depth=num(params.depth,9), density=clamp(num(params.density,.9),0,1);
    const wMin=num(params.wMin,7), wMax=num(params.wMax,13);
    const cls=params.class||'urban';
    let d=interval*(0.35+rnd()*0.4);
    const sides=params.sides==='both'?['left','right']:[params.sides||'both'];
    let guard=0;
    while(d<seg.len&&guard++<400){
      const w=Math.min(wMin+rnd()*(wMax-wMin),seg.len-d+interval);
      if(rnd()<density){
        sides.forEach(side=>{
          const sign=side==='left'?1:-1;
          const off=setback+depth/2;
          place(rectPoly(
            seg.ax+dirX*d+dirX*w/2+perpX*sign*off,
            seg.ay+dirY*d+dirY*w/2+perpY*sign*off,
            w,depth*(0.85+rnd()*0.3),seg.angle),cls,false);
        });
        if(params.back){
          sides.forEach(side=>{
            if(rnd()>=params.back) return;
            const sign=side==='left'?1:-1;
            const off2=setback+depth+num(params.backGap,7)+(params.backDepth||depth*0.8)/2;
            place(rectPoly(
              seg.ax+dirX*d+dirX*w*rnd()*0.5+perpX*sign*off2,
              seg.ay+dirY*d+dirY*w*rnd()*0.5+perpY*sign*off2,
              w*(0.45+rnd()*0.35),(params.backDepth||depth*0.8)*(0.8+rnd()*0.4),
              seg.angle+rnd()*0.6-0.3),cls,true);
          });
        }
        d+=w+interval*(0.5+rnd()*0.9);
      } else {
        d+=interval*(0.5+rnd());
      }
    }
  }
  function generateShedGrid(spec,rnd,place){
    const cols=num(spec.cols,3), rows=num(spec.rows,2);
    const w=num(spec.w,22), h=num(spec.h,11), gap=num(spec.gap,7);
    const a=num(spec.angle,0);
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const cx=spec.x+c*(w+gap)*Math.cos(a)-r*(h+gap)*Math.sin(a)+rnd()*2;
      const cy=spec.y+c*(w+gap)*Math.sin(a)+r*(h+gap)*Math.cos(a)+rnd()*2;
      place(rectPoly(cx,cy,w*(0.85+rnd()*0.3),h,a),spec.class||'industrial',false);
    }
  }
  function generatePerimeterBlock(spec,rnd,place){
    const pts=spec.polygon;
    const cls=spec.class||'expansion';
    const depth=num(spec.frontageDepth,11);
    const targetW=num(spec.subdivision,26);
    const gapProb=clamp(num(spec.gap,0.08),0,1);
    const setback=num(spec.setback,2);
    const cen=polyCentroid(pts);
    for(let i=0;i<pts.length;i++){
      const a=pts[i], b=pts[(i+1)%pts.length];
      const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
      if(len<10) continue;
      const ux=dx/len, uy=dy/len, nx=-uy, ny=ux;
      const mx=(a[0]+b[0])/2-cen.x, my=(a[1]+b[1])/2-cen.y;
      const sign=(mx*nx+my*ny)>=0?1:-1;
      const n=Math.max(1,Math.round(len/targetW));
      for(let j=0;j<n;j++){
        if(rnd()<gapProb) continue;
        const t0=(j+rnd()*0.12)/n, t1=((j+1)-rnd()*0.12)/n;
        const w=len*(t1-t0);
        if(w<6) continue;
        const off=setback+depth/2;
        place(rectPoly(
          a[0]+dx*t0+ux*w/2+nx*sign*off,
          a[1]+dy*t0+uy*w/2+ny*sign*off,
          w*0.96,depth*(0.85+rnd()*0.3),Math.atan2(dy,dx)),cls,false);
      }
    }
    /* rear workshops on the courtyard ring - the courtyard itself stays open */
    const rear=clamp(num(spec.rear,0.25),0,1);
    const inset=clamp(num(spec.courtyardInset,.55),0.2,0.85);
    if(rear>0){
      for(let i=0;i<pts.length;i++){
        if(rnd()>=rear) continue;
        const a=pts[i], b=pts[(i+1)%pts.length];
        const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
        if(len<24) continue;
        const t=0.3+rnd()*0.4;
        /* sit on the courtyard ring: inset of the way from center to edge */
        const ex=a[0]+dx*t, ey=a[1]+dy*t;
        const wx=cen.x+(ex-cen.x)*inset;
        const wy=cen.y+(ey-cen.y)*inset;
        place(rectPoly(wx,wy,len*0.14+rnd()*8,7+rnd()*4,Math.atan2(dy,dx)),cls,true);
      }
    }
  }

  /* ---- spatial index for collision rejection ---- */
  function SpatialGrid(cell){
    this.cellSize=num(cell,64);
    this.cells=new Map();
  }
  SpatialGrid.prototype.key=function(cx,cy){ return cx+':'+cy; };
  SpatialGrid.prototype.insert=function(item,poly){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    poly.forEach(p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);});
    item.bbox=[minX,minY,maxX,maxY];
    const c=this.cellSize;
    for(let gx=Math.floor(minX/c);gx<=Math.floor(maxX/c);gx++)
      for(let gy=Math.floor(minY/c);gy<=Math.floor(maxY/c);gy++){
        const k=this.key(gx,gy);
        if(!this.cells.has(k)) this.cells.set(k,[]);
        this.cells.get(k).push(item);
      }
  };
  SpatialGrid.prototype.query=function(poly){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    poly.forEach(p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);});
    const c=this.cellSize, seen=new Set(), out=[];
    for(let gx=Math.floor(minX/c);gx<=Math.floor(maxX/c);gx++)
      for(let gy=Math.floor(minY/c);gy<=Math.floor(maxY/c);gy++){
        const list=this.cells.get(this.key(gx,gy));
        if(!list) continue;
        list.forEach(item=>{
          const b=item.bbox;
          if(b[2]<minX||b[0]>maxX||b[3]<minY||b[1]>maxY) return;
          if(!seen.has(item)){seen.add(item);out.push(item);}
        });
      }
    return out;
  };

  /* ---- screen↔viewBox conversion with letterboxing (xMidYMid meet) ---- */
  function viewboxPoint(px,py,rect,view){
    const vw=num(view&&view.width,100), vh=num(view&&view.height,100);
    const rw=num(rect&&rect.width,vw), rh=num(rect&&rect.height,vh);
    const scale=Math.min(rw/vw,rh/vh)||1;
    const dx=(rw-vw*scale)/2, dy=(rh-vh*scale)/2;
    return {x:(num(px,0)-num(rect&&rect.left,0)-dx)/scale,y:(num(py,0)-num(rect&&rect.top,0)-dy)/scale};
  }

  /* ---- annotation counter-scale: k = unit / cameraScale, so the pair
     (camera scale × annotation scale) stays constant across zooms ---- */
  function annotationScaleFactor(unit,cameraScale){
    return num(unit,50)/Math.max(num(cameraScale,1),0.0001);
  }

  /* ======================= PORTRAIT LAYOUT (national) ================= */
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

  const NS='vector-effect="non-scaling-stroke"';
  function nsAttr(){ return ' '+NS; }
  function paths(cls,list){
    return list.map(d=>'<path class="'+cls+'" d="'+d+'"'+nsAttr()+'></path>').join('');
  }
  function patternDefs(){
    return '<defs aria-hidden="true">'
      +'<pattern id="lf-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#b0977c" stroke-width="0.28"/></pattern>'
      +'<pattern id="lf-furrow" width="3.4" height="2.6" patternUnits="userSpaceOnUse"><path d="M0 1.3 H3.4" stroke="#c9c083" stroke-width="0.32" fill="none"/><path d="M0 2.5 H3.4" stroke="#d3cb92" stroke-width="0.22" fill="none"/></pattern>'
      +'<pattern id="lf-trees" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.55" fill="#a9c2a4"/><circle cx="2.5" cy="2.3" r="0.45" fill="#b3cab0"/></pattern>'
      +'<pattern id="lf-orchard" width="2.6" height="2.6" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r="0.42" fill="#b7cfa2"/></pattern>'
      +'</defs>';
  }

  /* ======================= LABEL LAYOUT ENGINE ========================
     Unchanged deterministic collision-aware placement. Anchors always come
     from entity geometry; candidates are offsets around the anchor circle
     with leader-line fallback; occupied rectangles start from reserved
     entities (dots) plus previously committed labels.
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
      {anchor:'middle',dx:0,dy:off+f*3,leader:true},
      {anchor:'start',dx:off+f*1.4,dy:-f*1.6,leader:true},
      {anchor:'end',dx:-(off+f*1.4),dy:-f*1.6,leader:true},
      {anchor:'start',dx:off+f*1.4,dy:f*2.2,leader:true},
      {anchor:'end',dx:-(off+f*1.4),dy:f*2.2,leader:true}
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

  /* ======================= NATIONAL TIERS & TERRAIN =================== */
  function nationalTier(scale){ return num(scale,1)>=3.2?2:num(scale,1)>=1.7?1:0; }
  function nationalKindVisible(kind,tier){ return kind==='city'?true:kind==='town'?tier>=1:tier>=2; }
  /* Settlement tiers are relative to each sheet's own zoom range: tier 2
     only near maximum magnification, tier 1 once meaningfully zoomed in. */
  function settlementTier(scale,zoom){
    const max=num(zoom&&zoom.max,14), s=num(scale,1);
    return s>=max*0.45?2:s>=max*0.16?1:0;
  }
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


  /* ======================= SETTLEMENT PLANS ===========================
     Authored large-scale municipal sheets in map units (villages ~900x720,
     towns ~1500x1150, cities up to 2800x2100). Morphology is Central-
     European and street-driven:

       roads      named skeleton polylines; the city exists BETWEEN them
       corridors  per-road generation recipes -> individual street-facing
                  footprints (+ optional courtyard/back rows)
       yards      aligned shed/factory/granary grids (rail, industry)
       landmarks  the ten canonical gameplay buildings as real footprints,
                  each bound to ${id}-${ref} and its canonical district
       districts  named polygons matching the canonical district list
       railways / waterways / landUse  dividing geography

     Ordinary fabric never spawns inside landmark footprints (exclusion
     zones) and is clipped to the sheet bounds. All generation is seeded
     and deterministic per settlement id.
     --------------------------------------------------------------------- */
  const SETTLEMENT_PLANS={
    branec:{
      motif:'dense Austro-Hungarian capital: irregular old market core, government avenues, perimeter-block expansion, workers\u2019 ring, rail terminus',
      bounds:{w:2800,h:2100},
      zoomMax:22,
      districts:[
        {name:'Old Market',pts:[[240,500],[830,420],[910,1010],[770,1530],[320,1490],[230,960]]},
        {name:'Registry Quarter',pts:[[900,420],[1660,550],[1730,1190],[980,1250],[900,1010]]},
        {name:'North Offices',pts:[[1660,310],[2570,470],[2510,1160],[1770,1190],[1730,560]]},
        {name:'Workers\u2019 Ring',pts:[[290,1490],[1090,1370],[1910,1410],[2570,1510],[2490,2030],[370,2070]]}
      ],
      roads:[
        {id:'registry-avenue',name:'Registry Avenue',cls:'primary',pts:[[800,760],[1080,792],[1360,820],[1660,840],[1980,860],[2300,882],[2600,900]]},
        {id:'old-market-st',name:'Old Market Street',cls:'secondary',pts:[[430,330],[500,560],[520,760],[480,980],[470,1130],[520,1370],[560,1570]]},
        {id:'north-avenue',name:'North Offices Avenue',cls:'primary',pts:[[1730,420],[1930,498],[2150,570],[2350,650],[2540,720]]},
        {id:'workers-ring-road',name:'Workers\u2019 Ring Road',cls:'primary',pts:[[350,1670],[700,1622],[1010,1580],[1370,1602],[1710,1630],[2050,1682],[2390,1710],[2670,1650]]},
        {id:'station-road',name:'Station Road',cls:'primary',pts:[[1290,2050],[1312,1810],[1330,1560],[1356,1330],[1370,1120],[1392,1000],[1400,880]]},
        {id:'cross-street',name:'Cross Street',cls:'secondary',pts:[[230,1070],[520,1012],[900,1036],[1300,1058],[1770,1050],[2200,1076],[2570,1090]]},
        {id:'old-ring',name:'Old Ring',cls:'secondary',pts:[[290,1440],[520,1320],[760,1235],[1010,1180]]},
        {id:'northeast-radial',name:'Northeast Radial',cls:'secondary',pts:[[1500,600],[1720,512],[1930,452],[2140,392],[2330,330]]},
        {id:'east-boulevard',name:'East Boulevard',cls:'primary',pts:[[2560,1090],[2600,1260],[2580,1420],[2500,1620],[2430,1700]]},
        {id:'butchers-walk',name:'Butchers\u2019 Walk',cls:'secondary',pts:[[560,1570],[700,1500],[830,1470],[1010,1590]]},
        {id:'chandler-lane',name:'Chandler Lane',cls:'lane',pts:[[610,530],[720,562],[870,600]]},
        {id:'parchment-row',name:'Parchment Row',cls:'lane',pts:[[1480,590],[1610,622],[1750,650]]},
        {id:'ring-cross',name:'Ring Crossing',cls:'secondary',pts:[[1000,1590],[1022,1380],[1035,1170]]},
        {id:'east-ring',name:'East Ring Street',cls:'secondary',pts:[[2390,1700],[2402,1450],[2408,1180]]},
        {id:'west-steps',name:'West Steps',cls:'lane',pts:[[290,900],[360,1060],[430,1190]]},
        {id:'north-lane',name:'North Lane',cls:'lane',pts:[[2010,290],[2026,570],[2040,830]]},
        {id:'mint-street',name:'Mint Street',cls:'secondary',pts:[[950,460],[962,740],[975,1000]]},
        {id:'terminus-forecourt',name:'Terminus Forecourt',cls:'secondary',pts:[[1140,1830],[1320,1836],[1520,1842]]}
      ],
      blocks:[
        {id:'branec-old-01',district:'Old Market',class:'core',polygon:[[560,600],[905,622],[888,940],[545,928]],frontageDepth:12,subdivision:21,gap:.06,courtyardInset:.58,rear:.35,setback:3},
        {id:'branec-old-02',district:'Old Market',class:'core',polygon:[[300,640],[520,620],[505,900],[285,915]],frontageDepth:11,subdivision:20,gap:.08,courtyardInset:.55,rear:.3,setback:3},
        {id:'branec-old-03',district:'Old Market',class:'core',polygon:[[575,1090],[900,1075],[890,1330],[595,1345]],frontageDepth:11,subdivision:21,gap:.07,courtyardInset:.56,rear:.32,setback:3},
        {id:'branec-reg-01',district:'Registry Quarter',class:'expansion',polygon:[[1010,852],[1640,872],[1630,1012],[1020,995]],frontageDepth:13,subdivision:30,gap:.1,courtyardInset:.62,rear:.22,setback:5},
        {id:'branec-reg-02',district:'Registry Quarter',class:'expansion',polygon:[[1040,1085],[1560,1100],[1548,1330],[1055,1315]],frontageDepth:12,subdivision:27,gap:.09,courtyardInset:.6,rear:.25,setback:5},
        {id:'branec-north-01',district:'North Offices',class:'expansion',polygon:[[1780,485],[2440,565],[2420,855],[1795,795]],frontageDepth:12,subdivision:33,gap:.12,courtyardInset:.64,rear:.18,setback:6},
        {id:'branec-ring-01',district:'Workers\u2019 Ring',class:'ring',polygon:[[440,1720],[950,1652],[975,1826],[478,1888]],frontageDepth:10,subdivision:24,gap:.07,courtyardInset:.52,rear:.42,setback:3},
        {id:'branec-ring-02',district:'Workers\u2019 Ring',class:'ring',polygon:[[1110,1688],[1640,1698],[1662,1856],[1130,1846]],frontageDepth:10,subdivision:24,gap:.07,courtyardInset:.52,rear:.42,setback:3},
        {id:'branec-east-01',district:'North Offices',class:'expansion',polygon:[[1460,1150],[2090,1168],[2072,1420],[1478,1402]],frontageDepth:12,subdivision:29,gap:.09,courtyardInset:.6,rear:.28,setback:5},
        {id:'branec-east-02',district:'Workers\u2019 Ring',class:'ring',polygon:[[1510,1480],[1990,1520],[1958,1760],[1492,1722]],frontageDepth:10,subdivision:25,gap:.08,courtyardInset:.54,rear:.38,setback:4}
      ],
      railways:[
        {pts:[[0,1800],[520,1860],[1010,1930],[1225,1980]]},
        {pts:[[1225,1980],[1275,1988]],spur:true},
        {pts:[[2800,1540],[2310,1580],[1810,1630]]},
        {pts:[[1810,1630],[1775,1790]],spur:true}
      ],
      waterways:[],
      landUse:[
        {kind:'gardens',texture:'trees',pts:[[1560,1180],[1800,1210],[1790,1400],[1570,1380]]},
        {kind:'urban',pts:[[1120,1180],[1320,1200],[1310,1500],[1130,1480]]},
        {kind:'industrial',texture:'hatch',pts:[[1850,1650],[2280,1690],[2250,1950],[1830,1910]]},
        {kind:'urban',pts:[[420,1180],[640,1150],[660,1440],[450,1460]]}
      ],
      landmarks:[
        {ref:'b1',kind:'bureau',x:1180,y:700,w:48,h:26,district:'Registry Quarter'},
        {ref:'b2',kind:'bureau',x:2060,y:770,w:42,h:24,a:0.09,district:'North Offices'},
        {ref:'b3',kind:'transport',x:1200,y:1898,w:96,h:30,district:'Workers\u2019 Ring'},
        {ref:'b4',kind:'residence',x:830,y:1740,w:36,h:20,district:'Workers\u2019 Ring'},
        {ref:'b5',kind:'clinic',x:650,y:870,w:32,h:20,district:'Old Market'},
        {ref:'b6',kind:'market',x:565,y:700,w:46,h:26,district:'Old Market'},
        {ref:'b7',kind:'school',x:710,y:1290,w:36,h:22,district:'Old Market'},
        {ref:'b8',kind:'bureau',x:1470,y:910,w:38,h:22,district:'Registry Quarter'},
        {ref:'b9',kind:'worship',x:865,y:1090,w:30,h:26,district:'Old Market'},
        {ref:'b10',kind:'public',x:1565,y:1690,w:26,h:18,district:'Workers\u2019 Ring'}
      ],
      corridors:[
        {road:'registry-avenue',sides:'both',interval:24,setback:8,depth:11,wMin:9,wMax:15,density:.95,back:.42,class:'expansion'},
        {road:'old-market-st',sides:'both',interval:20,setback:5,depth:10,wMin:8,wMax:13,density:.97,back:.5,class:'core'},
        {road:'north-avenue',sides:'both',interval:26,setback:8,depth:11,wMin:10,wMax:16,density:.93,back:.38,class:'expansion'},
        {road:'workers-ring-road',sides:'both',interval:22,setback:6,depth:10,wMin:9,wMax:14,density:.94,back:.55,class:'ring'},
        {road:'station-road',sides:'both',interval:23,setback:6,depth:10,wMin:8,wMax:13,density:.94,back:.45,class:'expansion'},
        {road:'cross-street',sides:'both',interval:23,setback:6,depth:10,wMin:8,wMax:13,density:.93,back:.4,class:'expansion'},
        {road:'mint-street',sides:'both',interval:21,setback:5,depth:9,wMin:8,wMax:12,density:.96,back:.48,class:'core'},
        {road:'chandler-lane',sides:'both',interval:27,setback:4,depth:8,wMin:6,wMax:10,density:.85,back:.3,class:'core'},
        {road:'parchment-row',sides:'both',interval:27,setback:4,depth:8,wMin:6,wMax:10,density:.85,back:.3,class:'core'},
        {road:'ring-cross',sides:'both',interval:24,setback:5,depth:9,wMin:7,wMax:11,density:.92,back:.42,class:'ring'},
        {road:'east-ring',sides:'both',interval:24,setback:5,depth:9,wMin:7,wMax:11,density:.9,back:.4,class:'ring'},
        {road:'west-steps',sides:'left',interval:29,setback:4,depth:8,wMin:6,wMax:9,density:.82,back:.28,class:'core'},
        {road:'north-lane',sides:'both',interval:29,setback:5,depth:9,wMin:7,wMax:10,density:.84,back:.35,class:'expansion'},
        {road:'old-ring',sides:'both',interval:25,setback:5,depth:9,wMin:8,wMax:12,density:.9,back:.4,class:'core'},
        {road:'northeast-radial',sides:'both',interval:27,setback:7,depth:11,wMin:9,wMax:14,density:.9,back:.32,class:'expansion'},
        {road:'east-boulevard',sides:'both',interval:26,setback:8,depth:11,wMin:9,wMax:14,density:.9,back:.35,class:'expansion'},
        {road:'butchers-walk',sides:'both',interval:26,setback:4,depth:9,wMin:7,wMax:10,density:.88,back:.35,class:'core'},
        {road:'terminus-forecourt',sides:'right',interval:27,setback:5,depth:9,wMin:7,wMax:11,density:.88,back:.28,class:'ring'}
      ],
      yards:[
        {x:1950,y:1760,w:52,h:16,rows:2,cols:3,gap:12,class:'industrial',angle:.04},
        {x:1180,y:1560,w:30,h:12,rows:1,cols:3,gap:10,class:'urban',angle:-.06}
      ]
    },
    veskar:{
      motif:'historic salt port: harbor basin and quays, warehouse rows, narrow waterfront streets climbing to the customs ward',
      bounds:{w:2400,h:1900},
      zoomMax:22,
      districts:[
        {name:'Fishermen\u2019s Row',pts:[[80,180],[700,140],[760,900],[620,1300],[160,1260]]},
        {name:'Customs Ward',pts:[[760,140],[1620,180],[1660,820],[800,860],[760,900]]},
        {name:'Salt Market',pts:[[1660,240],[2320,300],[2280,1000],[1700,940],[1660,820]]},
        {name:'Old Docks',pts:[[160,1280],[1500,1240],[1960,1300],[1900,1560],[240,1580]]}
      ],
      roads:[
        {id:'customs-street',name:'Customs Street',cls:'primary',pts:[[180,880],[900,840],[1700,860],[2300,900]]},
        {id:'harbor-terrace',name:'Harbor Terrace',cls:'primary',pts:[[200,1240],[1000,1200],[1900,1260]]},
        {id:'quay-road',name:'Customs Quay',cls:'primary',pts:[[220,1520],[900,1490],[1600,1510],[1880,1500]]},
        {id:'salt-market-st',name:'Salt Market Street',cls:'primary',pts:[[1700,300],[1780,700],[1740,1180]]},
        {id:'fishermen-row',name:'Fishermen\u2019s Row',cls:'secondary',pts:[[240,320],[420,700],[380,1180]]},
        {id:'netwalk',name:'Netwalk',cls:'lane',pts:[[520,340],[600,760],[560,1180]]},
        {id:'ward-cross',name:'Ward Cross',cls:'secondary',pts:[[820,300],[880,800]]},
        {id:'warehouse-row',name:'Warehouse Row',cls:'secondary',pts:[[980,1240],[1020,1500]]},
        {id:'signal-stairs',name:'Signal Stairs',cls:'lane',pts:[[1900,900],[1930,1240]]},
        {id:'north-cliff',name:'North Cliff Road',cls:'secondary',pts:[[200,220],[900,180],[1650,220],[2300,260]]},
        {id:'basin-curve',name:'Basin Curve',cls:'secondary',pts:[[960,1180],[1180,1140],[1400,1150],[1620,1190]]},
        {id:'customs-diagonal',name:'Customs Diagonal',cls:'secondary',pts:[[1000,320],[1240,520],[1420,720]]},
        {id:'salt-passage',name:'Salt Passage',cls:'lane',pts:[[1980,420],[2012,700],[1992,940]]}
      ],
      blocks:[
        {id:'veskar-customs-01',district:'Customs Ward',class:'expansion',polygon:[[880,340],[1360,320],[1380,620],[900,640]],frontageDepth:12,subdivision:28,gap:.09,courtyardInset:.6,rear:.25,setback:5},
        {id:'veskar-salt-01',district:'Salt Market',class:'expansion',polygon:[[1760,380],[2200,400],[2180,780],[1745,750]],frontageDepth:11,subdivision:27,gap:.08,courtyardInset:.58,rear:.3,setback:5},
        {id:'veskar-fish-01',district:'Fishermen\u2019s Row',class:'core',polygon:[[240,420],[520,395],[545,760],[265,785]],frontageDepth:10,subdivision:20,gap:.06,courtyardInset:.52,rear:.42,setback:2},
        {id:'veskar-docks-01',district:'Old Docks',class:'industrial',polygon:[[300,1300],[860,1275],[875,1440],[315,1460]],frontageDepth:13,subdivision:32,gap:.1,courtyardInset:.55,rear:.2,setback:3},
        {id:'veskar-docks-02',district:'Old Docks',class:'industrial',polygon:[[1420,1280],[1820,1290],[1810,1450],[1430,1440]],frontageDepth:13,subdivision:30,gap:.1,courtyardInset:.55,rear:.2,setback:3},
        {id:'veskar-ward-02',district:'Customs Ward',class:'expansion',polygon:[[900,900],[1340,880],[1355,1130],[915,1150]],frontageDepth:11,subdivision:26,gap:.08,courtyardInset:.58,rear:.3,setback:5}
      ],
      railways:[],
      waterways:[
        {kind:'water',pts:[[0,1560],[2400,1500],[2400,1900],[0,1900]]},
        {kind:'coast',pts:[[0,1560],[600,1545],[1200,1520],[1800,1505],[2400,1500]]},
        {kind:'quay',pts:[[220,1500],[900,1470],[1600,1490],[1900,1480]]},
        {kind:'basin',pts:[[980,1500],[1380,1490],[1400,1720],[1000,1730]]},
        {kind:'quay',pts:[[1010,1610],[1180,1608],[1340,1612]]},
        {kind:'pier',pts:[[1080,1500],[1088,1700]]},
        {kind:'pier',pts:[[1260,1496],[1268,1706]]}
      ],
      landUse:[
        {kind:'yard',texture:'hatch',pts:[[1020,1280],[1360,1260],[1380,1460],[1040,1470]]},
        {kind:'urban',pts:[[820,940],[1300,900],[1330,1180],[850,1200]]},
        {kind:'urban',pts:[[300,760],[560,730],[580,1140],[330,1160]]}
      ],
      landmarks:[
        {ref:'b1',kind:'civic',x:1060,y:660,w:52,h:28,district:'Customs Ward'},
        {ref:'b2',kind:'workplace',x:1120,y:1350,w:76,h:24,district:'Old Docks'},
        {ref:'b3',kind:'transport',x:420,y:1010,w:56,h:24,a:.05,district:'Fishermen\u2019s Row'},
        {ref:'b4',kind:'residence',x:330,y:520,w:30,h:18,district:'Fishermen\u2019s Row'},
        {ref:'b5',kind:'clinic',x:1240,y:420,w:30,h:20,district:'Customs Ward'},
        {ref:'b6',kind:'market',x:1880,y:560,w:42,h:24,district:'Salt Market'},
        {ref:'b7',kind:'school',x:600,y:880,w:30,h:20,district:'Fishermen\u2019s Row'},
        {ref:'b8',kind:'bureau',x:1420,y:700,w:36,h:22,district:'Customs Ward'},
        {ref:'b9',kind:'public',x:860,y:740,w:26,h:18,district:'Customs Ward'},
        {ref:'b10',kind:'residence',x:1500,y:1330,w:34,h:20,district:'Old Docks'}
      ],
      corridors:[
        {road:'customs-street',sides:'both',interval:27,setback:7,depth:11,wMin:9,wMax:15,density:.92,back:.35,class:'expansion'},
        {road:'harbor-terrace',sides:'both',interval:26,setback:6,depth:10,wMin:9,wMax:14,density:.92,back:.3,class:'expansion'},
        {road:'quay-road',sides:'right',interval:34,setback:5,depth:12,wMin:12,wMax:20,density:.9,back:0,class:'industrial'},
        {road:'salt-market-st',sides:'both',interval:28,setback:6,depth:10,wMin:9,wMax:13,density:.9,back:.3,class:'expansion'},
        {road:'fishermen-row',sides:'both',interval:24,setback:5,depth:9,wMin:7,wMax:11,density:.95,back:.5,class:'core'},
        {road:'netwalk',sides:'left',interval:26,setback:4,depth:8,wMin:6,wMax:9,density:.85,back:.3,class:'core'},
        {road:'ward-cross',sides:'both',interval:28,setback:5,depth:9,wMin:7,wMax:11,density:.88,back:.3,class:'core'},
        {road:'warehouse-row',sides:'both',interval:30,setback:4,depth:10,wMin:9,wMax:13,density:.85,back:.2,class:'industrial'},
        {road:'north-cliff',sides:'both',interval:30,setback:6,depth:10,wMin:9,wMax:14,density:.88,back:.3,class:'expansion'},
        {road:'signal-stairs',sides:'right',interval:34,setback:4,depth:8,wMin:6,wMax:9,density:.7,back:0,class:'expansion'}
      ],
      yards:[
        {x:1080,y:1300,w:44,h:14,rows:2,cols:3,gap:9,class:'industrial',angle:-.01},
        {x:300,y:1330,w:36,h:13,rows:1,cols:3,gap:11,class:'industrial',angle:.02}
      ]
    },
    eisenmark:{
      motif:'iron city: vast foundry complexes and sidings east, worker perimeter blocks and company rows west',
      bounds:{w:2500,h:1950},
      zoomMax:22,
      districts:[
        {name:'Company Row',pts:[[90,160],[820,140],[860,900],[700,1240],[140,1200]]},
        {name:'Foundry Ward',pts:[[1300,120],[2380,180],[2340,1000],[1360,960],[1300,600]]},
        {name:'Ash Market',pts:[[700,1280],[1560,1240],[1620,1820],[760,1860]]},
        {name:'Barracks',pts:[[1620,1100],[2380,1140],[2340,1820],[1660,1840]]}
      ],
      roads:[
        {id:'iron-avenue',name:'Iron Avenue',cls:'primary',pts:[[160,1180],[900,1120],[1600,1080],[2360,1060]]},
        {id:'company-row',name:'Company Row',cls:'secondary',pts:[[300,240],[380,700],[340,1150]]},
        {id:'foundry-road',name:'Foundry Road',cls:'primary',pts:[[900,420],[1500,380],[2100,420],[2360,460]]},
        {id:'smelter-street',name:'Smelter Street',cls:'secondary',pts:[[1420,300],[1460,700],[1420,1060]]},
        {id:'barracks-road',name:'Barracks Road',cls:'primary',pts:[[1700,1180],[1780,1500],[1740,1820]]},
        {id:'ash-market-st',name:'Ash Market Street',cls:'secondary',pts:[[820,1300],[880,1600],[840,1840]]},
        {id:'station-road',name:'Station Road',cls:'primary',pts:[[420,1560],[700,1300],[980,1180],[1240,1120]]},
        {id:'slag-lane',name:'Slag Lane',cls:'lane',pts:[[1120,600],[1360,640]]},
        {id:'colliers-row',name:'Colliers Row',cls:'secondary',pts:[[520,520],[760,560]]},
        {id:'gate-street',name:'Foundry Gate Street',cls:'secondary',pts:[[1300,180],[1340,600],[1310,1000]]},
        {id:'east-service',name:'East Service Road',cls:'lane',pts:[[2100,500],[2160,1000]]},
        {id:'slag-curve',name:'Slag Curve',cls:'secondary',pts:[[900,700],[1080,760],[1240,860],[1330,980]]},
        {id:'colliers-diagonal',name:'Colliers Diagonal',cls:'secondary',pts:[[420,300],[640,480],[800,660]]},
        {id:'barracks-cross',name:'Barracks Cross',cls:'lane',pts:[[1900,1180],[1930,1420],[1900,1680]]}
      ],
      blocks:[
        {id:'eisenmark-foundry-01',district:'Foundry Ward',class:'industrial',polygon:[[1560,620],[2240,650],[2215,920],[1545,890]],frontageDepth:14,subdivision:36,gap:.12,courtyardInset:.55,rear:.18,setback:5},
        {id:'eisenmark-row-01',district:'Company Row',class:'ring',polygon:[[160,320],[720,300],[745,620],[185,645]],frontageDepth:10,subdivision:23,gap:.07,courtyardInset:.52,rear:.42,setback:3},
        {id:'eisenmark-row-02',district:'Company Row',class:'ring',polygon:[[180,700],[600,685],[620,1060],[205,1075]],frontageDepth:10,subdivision:23,gap:.08,courtyardInset:.52,rear:.4,setback:3},
        {id:'eisenmark-ash-01',district:'Ash Market',class:'ring',polygon:[[950,1320],[1380,1300],[1400,1740],[970,1760]],frontageDepth:10,subdivision:24,gap:.08,courtyardInset:.54,rear:.38,setback:3},
        {id:'eisenmark-barracks-01',district:'Barracks',class:'expansion',polygon:[[1780,1200],[2280,1230],[2250,1620],[1760,1590]],frontageDepth:11,subdivision:30,gap:.1,courtyardInset:.6,rear:.25,setback:5},
        {id:'eisenmark-station-01',district:'Ash Market',class:'expansion',polygon:[[520,1360],[880,1345],[895,1520],[535,1535]],frontageDepth:11,subdivision:26,gap:.09,courtyardInset:.58,rear:.3,setback:4}
      ],
      railways:[
        {pts:[[0,1380],[600,1330],[1300,1290],[2500,1240]]},
        {pts:[[1300,1290],[1560,1240],[1700,1100]],spur:true},
        {pts:[[1700,1100],[1980,1060],[2200,1020]],spur:true},
        {pts:[[1560,500],[1900,540],[2300,600]],spur:true},
        {pts:[[600,1330],[560,1480]],spur:true}
      ],
      waterways:[],
      landUse:[
        {kind:'industrial',texture:'hatch',pts:[[1560,240],[2320,300],[2280,940],[1540,900]]},
        {kind:'industrial',texture:'hatch',pts:[[1840,1160],[2300,1200],[2270,1560],[1820,1520]]},
        {kind:'yard',texture:'hatch',pts:[[380,1240],[700,1210],[720,1400],[400,1430]]},
        {kind:'urban',pts:[[180,600],[620,570],[640,1100],[200,1130]]},
        {kind:'urban',pts:[[940,1300],[1400,1270],[1420,1760],[960,1790]]}
      ],
      landmarks:[
        {ref:'b1',kind:'workplace',x:1700,y:420,w:96,h:34,district:'Foundry Ward'},
        {ref:'b2',kind:'civic',x:1420,y:280,w:42,h:24,district:'Foundry Ward'},
        {ref:'b3',kind:'transport',x:750,y:1310,w:60,h:26,district:'Ash Market'},
        {ref:'b4',kind:'residence',x:420,y:420,w:34,h:20,district:'Company Row'},
        {ref:'b5',kind:'clinic',x:1800,y:820,w:34,h:22,district:'Foundry Ward'},
        {ref:'b6',kind:'market',x:1160,y:1420,w:40,h:24,district:'Ash Market'},
        {ref:'b7',kind:'school',x:560,y:880,w:32,h:20,district:'Company Row'},
        {ref:'b8',kind:'market',x:1960,y:1320,w:38,h:22,district:'Barracks'},
        {ref:'b9',kind:'civic',x:720,y:960,w:38,h:24,district:'Company Row'},
        {ref:'b10',kind:'public',x:1020,y:1560,w:26,h:18,district:'Ash Market'}
      ],
      corridors:[
        {road:'iron-avenue',sides:'both',interval:29,setback:8,depth:11,wMin:9,wMax:15,density:.92,back:.35,class:'expansion'},
        {road:'company-row',sides:'both',interval:26,setback:6,depth:10,wMin:9,wMax:13,density:.93,back:.5,class:'ring'},
        {road:'foundry-road',sides:'both',interval:34,setback:9,depth:13,wMin:12,wMax:20,density:.88,back:.15,class:'industrial'},
        {road:'smelter-street',sides:'both',interval:29,setback:6,depth:10,wMin:8,wMax:13,density:.9,back:.3,class:'expansion'},
        {road:'barracks-road',sides:'both',interval:28,setback:7,depth:10,wMin:9,wMax:14,density:.9,back:.35,class:'ring'},
        {road:'ash-market-st',sides:'both',interval:27,setback:6,depth:10,wMin:8,wMax:13,density:.9,back:.4,class:'ring'},
        {road:'station-road',sides:'both',interval:28,setback:6,depth:10,wMin:8,wMax:13,density:.9,back:.3,class:'expansion'},
        {road:'colliers-row',sides:'both',interval:27,setback:5,depth:9,wMin:8,wMax:11,density:.9,back:.4,class:'ring'},
        {road:'gate-street',sides:'both',interval:30,setback:6,depth:10,wMin:8,wMax:12,density:.88,back:.3,class:'expansion'},
        {road:'slag-lane',sides:'both',interval:32,setback:4,depth:8,wMin:6,wMax:9,density:.75,back:.2,class:'core'},
        {road:'east-service',sides:'left',interval:36,setback:5,depth:10,wMin:9,wMax:13,density:.8,back:0,class:'industrial'}
      ],
      yards:[
        {x:1620,y:560,w:64,h:18,rows:3,cols:4,gap:14,class:'industrial',angle:.03},
        {x:1880,y:1220,w:54,h:16,rows:2,cols:3,gap:13,class:'military',angle:-.02},
        {x:420,y:1300,w:40,h:14,rows:2,cols:2,gap:11,class:'industrial',angle:.02}
      ]
    },
    kostrin:{
      motif:'institutional city: college hill and chapels above, hospital ward at the crossing, gardens to the south',
      bounds:{w:2200,h:1750},
      zoomMax:21,
      districts:[
        {name:'College Hill',pts:[[80,140],[700,120],[760,760],[620,1080],[140,1040]]},
        {name:'Chapel District',pts:[[760,120],[1420,140],[1460,620],[820,640],[760,760]]},
        {name:'Hospital Ward',pts:[[640,760],[1480,720],[1540,1180],[700,1220],[620,1080]]},
        {name:'South Gardens',pts:[[240,1240],[1900,1200],[1960,1660],[300,1690]]}
      ],
      roads:[
        {id:'college-hill',name:'College Hill Road',cls:'secondary',pts:[[220,240],[400,560],[360,980]]},
        {id:'processional',name:'Processional Avenue',cls:'primary',pts:[[120,1140],[800,1100],[1500,1120],[2080,1140]]},
        {id:'chapels-walk',name:'Chapels Walk',cls:'secondary',pts:[[840,220],[900,480],[860,760]]},
        {id:'hospital-way',name:'Hospital Way',cls:'primary',pts:[[700,860],[1120,880],[1520,900]]},
        {id:'garden-road',name:'Garden Road',cls:'secondary',pts:[[300,1400],[900,1370],[1500,1390],[1980,1410]]},
        {id:'south-lane',name:'South Lane',cls:'lane',pts:[[500,1660],[1100,1630],[1700,1650]]},
        {id:'station-branch',name:'Station Branch',cls:'secondary',pts:[[260,1420],[300,1240],[380,1120]]},
        {id:'chapter-street',name:'Chapter Street',cls:'secondary',pts:[[1180,200],[1220,560],[1180,840]]},
        {id:'cloister-lane',name:'Cloister Lane',cls:'lane',pts:[[420,700],[640,730]]},
        {id:'ward-lane',name:'Ward Lane',cls:'lane',pts:[[940,900],[958,1010],[960,1120]]},
        {id:'garden-diagonal',name:'Garden Diagonal',cls:'secondary',pts:[[560,1180],[820,1260],[1080,1320],[1340,1360]]},
        {id:'chapter-curve',name:'Chapter Curve',cls:'secondary',pts:[[1000,240],[1100,340],[1160,460],[1180,580]]}
      ],
      blocks:[
        {id:'kostrin-college-01',district:'College Hill',class:'core',polygon:[[150,220],[540,200],[570,520],[180,545]],frontageDepth:11,subdivision:25,gap:.08,courtyardInset:.6,rear:.28,setback:4},
        {id:'kostrin-hospital-01',district:'Hospital Ward',class:'expansion',polygon:[[700,780],[1040,795],[1030,1020],[715,1000]],frontageDepth:12,subdivision:29,gap:.09,courtyardInset:.62,rear:.22,setback:5},
        {id:'kostrin-gardens-01',district:'South Gardens',class:'expansion',polygon:[[320,1300],[820,1280],[835,1560],[335,1580]],frontageDepth:11,subdivision:28,gap:.1,courtyardInset:.6,rear:.26,setback:5},
        {id:'kostrin-chapel-01',district:'Chapel District',class:'core',polygon:[[880,160],[1340,175],[1355,420],[895,400]],frontageDepth:11,subdivision:24,gap:.08,courtyardInset:.58,rear:.32,setback:4},
        {id:'kostrin-ward-02',district:'Hospital Ward',class:'core',polygon:[[1060,930],[1420,945],[1432,1140],[1072,1125]],frontageDepth:10,subdivision:23,gap:.07,courtyardInset:.55,rear:.34,setback:3}
      ],
      railways:[],
      waterways:[],
      landUse:[
        {kind:'institutional',texture:'trees',pts:[[120,160],[620,140],[660,700],[180,740]]},
        {kind:'gardens',texture:'trees',pts:[[1560,760],[2020,780],[2000,1120],[1580,1100]]},
        {kind:'gardens',texture:'trees',pts:[[820,1240],[1240,1220],[1260,1560],[840,1580]]},
        {kind:'gardens',pts:[[880,180],[1380,200],[1400,540],[900,560]]}
      ],
      landmarks:[
        {ref:'b1',kind:'school',x:280,y:340,w:58,h:32,a:.04,district:'College Hill'},
        {ref:'b2',kind:'bureau',x:1260,y:300,w:38,h:24,district:'Chapel District'},
        {ref:'b3',kind:'transport',x:330,y:1300,w:56,h:26,a:-.07,district:'South Gardens'},
        {ref:'b4',kind:'residence',x:1320,y:430,w:34,h:20,district:'Chapel District'},
        {ref:'b5',kind:'clinic',x:900,y:940,w:74,h:34,district:'Hospital Ward'},
        {ref:'b6',kind:'market',x:1300,y:1240,w:36,h:22,district:'South Gardens'},
        {ref:'b7',kind:'school',x:480,y:800,w:34,h:22,district:'College Hill'},
        {ref:'b8',kind:'bureau',x:1400,y:800,w:34,h:22,district:'Hospital Ward'},
        {ref:'b9',kind:'worship',x:1000,y:340,w:30,h:26,district:'Chapel District'},
        {ref:'b10',kind:'public',x:1420,y:1000,w:26,h:18,district:'Hospital Ward'}
      ],
      corridors:[
        {road:'processional',sides:'both',interval:31,setback:8,depth:11,wMin:9,wMax:15,density:.88,back:.3,class:'expansion'},
        {road:'college-hill',sides:'both',interval:33,setback:7,depth:10,wMin:8,wMax:12,density:.82,back:.35,class:'core'},
        {road:'chapels-walk',sides:'both',interval:32,setback:6,depth:9,wMin:8,wMax:12,density:.85,back:.3,class:'core'},
        {road:'hospital-way',sides:'both',interval:30,setback:7,depth:10,wMin:9,wMax:13,density:.88,back:.25,class:'expansion'},
        {road:'garden-road',sides:'both',interval:34,setback:7,depth:10,wMin:8,wMax:12,density:.8,back:.25,class:'expansion'},
        {road:'chapter-street',sides:'both',interval:31,setback:6,depth:9,wMin:8,wMax:11,density:.85,back:.3,class:'core'},
        {road:'station-branch',sides:'both',interval:33,setback:6,depth:9,wMin:7,wMax:11,density:.8,back:.3,class:'expansion'},
        {road:'cloister-lane',sides:'both',interval:34,setback:4,depth:8,wMin:6,wMax:9,density:.72,back:.2,class:'core'},
        {road:'ward-lane',sides:'both',interval:34,setback:4,depth:8,wMin:6,wMax:9,density:.75,back:.2,class:'expansion'},
        {road:'south-lane',sides:'both',interval:38,setback:6,depth:9,wMin:7,wMax:10,density:.6,back:.15,class:'rural'}
      ]
    },
    rudava:{
      motif:'railway city: twin main lines and a great freight yard carve the districts apart',
      bounds:{w:2300,h:1800},
      zoomMax:22,
      districts:[
        {name:'Junction Ward',pts:[[980,140],[1720,120],[1780,820],[1060,860],[980,600]]},
        {name:'Freight Yards',pts:[[80,420],[900,380],[960,900],[140,940]]},
        {name:'Railway Homes',pts:[[980,900],[1660,880],[1720,1420],[1040,1460],[980,1200]]},
        {name:'East Barracks',pts:[[1760,200],[2220,240],[2180,900],[1800,860]]}
      ],
      roads:[
        {id:'platform-road',name:'Platform Road',cls:'primary',pts:[[140,300],[700,270],[1000,280],[1300,320]]},
        {id:'junction-avenue',name:'Junction Avenue',cls:'primary',pts:[[1060,180],[1140,560],[1180,900],[1220,1300],[1260,1680]]},
        {id:'freight-road',name:'Freight Road',cls:'secondary',pts:[[120,760],[500,720],[880,700]]},
        {id:'homes-street',name:'Railway Homes Street',cls:'secondary',pts:[[1040,1020],[1400,1000],[1680,1020]]},
        {id:'barracks-avenue',name:'Barracks Avenue',cls:'secondary',pts:[[1820,300],[1900,600],[1860,880]]},
        {id:'crossing-road',name:'Crossing Road',cls:'primary',pts:[[100,1180],[700,1140],[1300,1160],[2200,1200]]},
        {id:'station-approach',name:'Station Approach',cls:'secondary',pts:[[640,270],[680,120],[720,60]]},
        {id:'yard-lane',name:'Yard Lane',cls:'lane',pts:[[200,520],[420,500],[660,480]]},
        {id:'east-lane',name:'East Lane',cls:'lane',pts:[[1960,340],[1990,820]]},
        {id:'homes-cross',name:'Homes Crossing',cls:'lane',pts:[[1300,1000],[1330,1400]]},
        {id:'junction-curve',name:'Junction Curve',cls:'secondary',pts:[[1060,700],[1240,730],[1420,760],[1600,820]]},
        {id:'barracks-diagonal',name:'Barracks Diagonal',cls:'secondary',pts:[[1820,300],[1960,520],[2040,740]]}
      ],
      blocks:[
        {id:'rudava-homes-01',district:'Railway Homes',class:'ring',polygon:[[1080,1040],[1560,1020],[1590,1380],[1105,1400]],frontageDepth:10,subdivision:23,gap:.07,courtyardInset:.52,rear:.45,setback:3},
        {id:'rudava-junction-01',district:'Junction Ward',class:'expansion',polygon:[[1180,470],[1660,450],[1690,720],[1205,740]],frontageDepth:12,subdivision:28,gap:.09,courtyardInset:.6,rear:.28,setback:5},
        {id:'rudava-freight-01',district:'Freight Yards',class:'industrial',polygon:[[170,680],[800,650],[825,880],[195,905]],frontageDepth:13,subdivision:34,gap:.11,courtyardInset:.55,rear:.2,setback:3},
        {id:'rudava-barracks-01',district:'East Barracks',class:'expansion',polygon:[[1830,340],[2140,360],[2120,820],[1800,800]],frontageDepth:11,subdivision:29,gap:.1,courtyardInset:.6,rear:.25,setback:5},
        {id:'rudava-cross-01',district:'Railway Homes',class:'ring',polygon:[[1090,1480],[1520,1460],[1540,1680],[1110,1700]],frontageDepth:10,subdivision:24,gap:.08,courtyardInset:.54,rear:.38,setback:3},
        {id:'rudava-platform-01',district:'Junction Ward',class:'expansion',polygon:[[240,180],[900,150],[915,330],[255,355]],frontageDepth:11,subdivision:27,gap:.09,courtyardInset:.58,rear:.3,setback:4}
      ],
      railways:[
        {pts:[[0,420],[500,395],[1050,360],[1600,320],[2300,280]]},
        {pts:[[0,880],[450,850],[950,820],[1500,780],[2300,740]]},
        {pts:[[1050,360],[1080,560],[1105,800]],spur:true},
        {pts:[[150,470],[760,440]],spur:true},
        {pts:[[150,520],[700,495]],spur:true},
        {pts:[[150,570],[660,548]],spur:true},
        {pts:[[150,620],[620,600]],spur:true},
        {pts:[[1180,900],[1400,880],[1650,860]],spur:true},
        {pts:[[1900,600],[2050,560],[2150,540]],spur:true}
      ],
      waterways:[],
      landUse:[
        {kind:'yard',texture:'hatch',pts:[[120,440],[880,410],[920,860],[160,890]]},
        {kind:'yard',texture:'hatch',pts:[[1080,180],[1420,170],[1450,330],[1110,340]]},
        {kind:'urban',pts:[[1080,940],[1620,920],[1650,1380],[1110,1400]]},
        {kind:'urban',pts:[[140,980],[620,960],[640,1420],[160,1440]]},
        {kind:'institutional',pts:[[1800,260],[2160,280],[2130,760],[1820,740]]}
      ],
      bridges:[
        {x:560,y:398,w:26,h:34},{x:600,y:842,w:26,h:26},{x:1180,y:842,w:26,h:30},{x:1870,y:742,w:26,h:30}
      ],
      landmarks:[
        {ref:'b1',kind:'civic',x:1180,y:640,w:40,h:24,district:'Junction Ward'},
        {ref:'b2',kind:'transport',x:1100,y:390,w:76,h:28,district:'Junction Ward'},
        {ref:'b3',kind:'transport',x:300,y:760,w:88,h:30,a:-.03,district:'Freight Yards'},
        {ref:'b4',kind:'transport',x:1240,y:960,w:40,h:22,district:'Railway Homes'},
        {ref:'b5',kind:'transport',x:760,y:790,w:42,h:22,a:.04,district:'Freight Yards'},
        {ref:'b6',kind:'market',x:1520,y:1120,w:36,h:22,district:'Railway Homes'},
        {ref:'b7',kind:'school',x:1900,y:420,w:34,h:22,district:'East Barracks'},
        {ref:'b8',kind:'bureau',x:1600,y:760,w:38,h:22,district:'Junction Ward'},
        {ref:'b9',kind:'transport',x:1055,y:1235,w:40,h:20,a:.03,district:'Railway Homes'},
        {ref:'b10',kind:'public',x:690,y:850,w:26,h:18,district:'Freight Yards'}
      ],
      corridors:[
        {road:'junction-avenue',sides:'both',interval:28,setback:7,depth:10,wMin:9,wMax:14,density:.9,back:.35,class:'expansion'},
        {road:'platform-road',sides:'both',interval:29,setback:7,depth:10,wMin:9,wMax:14,density:.88,back:.3,class:'expansion'},
        {road:'crossing-road',sides:'both',interval:29,setback:7,depth:10,wMin:9,wMax:14,density:.88,back:.3,class:'expansion'},
        {road:'homes-street',sides:'both',interval:26,setback:6,depth:9,wMin:8,wMax:12,density:.92,back:.5,class:'ring'},
        {road:'freight-road',sides:'left',interval:32,setback:6,depth:10,wMin:9,wMax:13,density:.85,back:.2,class:'industrial'},
        {road:'barracks-avenue',sides:'both',interval:30,setback:7,depth:10,wMin:9,wMax:13,density:.87,back:.3,class:'ring'},
        {road:'station-approach',sides:'both',interval:30,setback:5,depth:9,wMin:7,wMax:11,density:.85,back:.2,class:'core'},
        {road:'yard-lane',sides:'right',interval:34,setback:4,depth:9,wMin:7,wMax:10,density:.75,back:0,class:'industrial'},
        {road:'east-lane',sides:'both',interval:33,setback:5,depth:9,wMin:7,wMax:10,density:.78,back:.25,class:'expansion'},
        {road:'homes-cross',sides:'both',interval:31,setback:5,depth:9,wMin:7,wMax:10,density:.85,back:.35,class:'ring'}
      ],
      yards:[
        {x:220,y:640,w:58,h:16,rows:2,cols:4,gap:12,class:'industrial',angle:-.03},
        {x:1420,y:940,w:44,h:14,rows:2,cols:3,gap:11,class:'industrial',angle:.02},
        {x:1920,y:660,w:44,h:15,rows:2,cols:3,gap:12,class:'military',angle:0}
      ]
    },
    dobraven:{
      motif:'old county town: crooked lanes around the county square, river road west, estates east',
      bounds:{w:1500,h:1150},
      zoomMax:16,
      districts:[
        {name:'County Square',pts:[[420,380],[900,340],[960,700],[480,740]]},
        {name:'River Road',pts:[[80,300],[360,280],[400,720],[340,1020],[90,1000]]},
        {name:'Old Estates',pts:[[980,640],[1440,600],[1480,1080],[1020,1100]]},
        {name:'Lower Town',pts:[[160,740],[940,720],[980,1080],[200,1100]]}
      ],
      roads:[
        {id:'square-west',name:'County Square West',cls:'primary',pts:[[380,520],[700,500],[940,520]]},
        {id:'square-east',name:'County Square East',cls:'primary',pts:[[960,560],[1180,580],[1420,570]]},
        {id:'river-road',name:'River Road',cls:'secondary',pts:[[220,120],[260,480],[240,840],[270,1120]]},
        {id:'lower-street',name:'Lower Street',cls:'secondary',pts:[[220,860],[560,840],[900,850],[1240,870]]},
        {id:'estate-lane',name:'Estate Lane',cls:'lane',pts:[[1040,720],[1100,900],[1140,1060]]},
        {id:'chapel-walk',name:'Chapel Walk',cls:'lane',pts:[[700,740],[730,900]]},
        {id:'north-gate',name:'North Gate Street',cls:'secondary',pts:[[560,120],[600,360],[640,500]]},
        {id:'mill-bridge',name:'Mill Bridge Lane',cls:'lane',pts:[[120,560],[320,540]]},
        {id:'old-row',name:'Old Row',cls:'lane',pts:[[430,600],[700,615]]}
      ],
      railways:[],
      waterways:[
        {kind:'water',pts:[[0,180],[130,200],[170,520],[140,840],[170,1050],[0,1070]]},
        {kind:'river',pts:[[60,140],[110,400],[95,700],[115,980],[85,1130]]},
        {kind:'quay',pts:[[175,300],[165,560],[180,820]]}
      ],
      landUse:[
        {kind:'estate',texture:'trees',pts:[[1000,740],[1460,700],[1490,1060],[1040,1080]]},
        {kind:'urban',pts:[[440,540],[900,520],[930,700],[460,720]]},
        {kind:'meadow',pts:[[380,880],[620,870],[630,1060],[400,1070]]}
      ],
      landmarks:[
        {ref:'b1',kind:'civic',x:600,y:430,w:52,h:28,district:'County Square'},
        {ref:'b2',kind:'bureau',x:1160,y:800,w:38,h:22,district:'Old Estates'},
        {ref:'b3',kind:'transport',x:330,y:600,w:44,h:22,district:'River Road'},
        {ref:'b4',kind:'residence',x:520,y:930,w:34,h:19,district:'Lower Town'},
        {ref:'b5',kind:'clinic',x:820,y:600,w:32,h:20,district:'County Square'},
        {ref:'b6',kind:'market',x:760,y:470,w:42,h:24,district:'County Square'},
        {ref:'b7',kind:'school',x:340,y:940,w:34,h:20,district:'Lower Town'},
        {ref:'b8',kind:'civic',x:850,y:465,w:36,h:21,district:'County Square'},
        {ref:'b9',kind:'worship',x:1240,y:920,w:30,h:26,district:'Old Estates'},
        {ref:'b10',kind:'public',x:760,y:920,w:26,h:18,district:'Lower Town'}
      ],
      corridors:[
        {road:'square-west',sides:'both',interval:25,setback:6,depth:10,wMin:8,wMax:13,density:.94,back:.4,class:'core'},
        {road:'square-east',sides:'both',interval:31,setback:8,depth:11,wMin:9,wMax:14,density:.82,back:.2,class:'rural'},
        {road:'river-road',sides:'right',interval:27,setback:6,depth:10,wMin:8,wMax:12,density:.88,back:.35,class:'core'},
        {road:'lower-street',sides:'both',interval:26,setback:6,depth:9,wMin:8,wMax:12,density:.92,back:.45,class:'ring'},
        {road:'estate-lane',sides:'both',interval:44,setback:9,depth:11,wMin:11,wMax:16,density:.55,back:.1,class:'rural'},
        {road:'north-gate',sides:'both',interval:28,setback:6,depth:10,wMin:8,wMax:12,density:.88,back:.35,class:'core'},
        {road:'chapel-walk',sides:'left',interval:33,setback:4,depth:8,wMin:6,wMax:9,density:.75,back:.2,class:'core'},
        {road:'old-row',sides:'both',interval:29,setback:4,depth:8,wMin:6,wMax:10,density:.85,back:.25,class:'core'}
      ]
    },
    lindava:{
      motif:'market town: hall square with radiating streets, tight Bell Quarter, open west fields',
      bounds:{w:1550,h:1200},
      zoomMax:16,
      districts:[
        {name:'Market Row',pts:[[480,420],[1080,380],[1140,860],[520,900]]},
        {name:'Bell Quarter',pts:[[500,140],[1120,120],[1160,400],[540,420]]},
        {name:'West Fields',pts:[[90,160],[420,140],[460,1000],[120,1040]]}
      ],
      roads:[
        {id:'market-square-n',name:'Market Row North',cls:'primary',pts:[[520,520],[820,500],[1120,520]]},
        {id:'market-square-s',name:'Market Row South',cls:'primary',pts:[[540,760],[840,740],[1140,760]]},
        {id:'high-street',name:'High Street',cls:'primary',pts:[[820,180],[840,520],[830,900],[850,1140]]},
        {id:'bell-lane',name:'Bell Lane',cls:'secondary',pts:[[560,220],[740,260],[940,240],[1100,280]]},
        {id:'fields-road',name:'West Fields Road',cls:'secondary',pts:[[200,240],[260,600],[230,980]]},
        {id:'coach-yard-rd',name:'Coach Yard Road',cls:'secondary',pts:[[300,1020],[620,1000],[940,1010]]},
        {id:'grain-lane',name:'Grain Lane',cls:'lane',pts:[[980,560],[1010,740]]},
        {id:'kiosk-row',name:'Kiosk Row',cls:'lane',pts:[[540,620],[760,610]]}
      ],
      railways:[],
      waterways:[],
      landUse:[
        {kind:'farmland',texture:'furrow',pts:[[100,180],[400,160],[440,980],[130,1000]]},
        {kind:'farmland',texture:'furrow',pts:[[1180,880],[1500,860],[1510,1160],[1200,1170]]},
        {kind:'meadow',pts:[[1180,440],[1500,420],[1510,840],[1200,860]]},
        {kind:'urban',pts:[[520,540],[1120,520],[1140,840],[540,860]]},
        {kind:'gardens',texture:'trees',pts:[[540,160],[1100,140],[1130,380],[560,400]]}
      ],
      landmarks:[
        {ref:'b1',kind:'civic',x:680,y:600,w:54,h:30,district:'Market Row'},
        {ref:'b2',kind:'residence',x:900,y:290,w:34,h:20,district:'Bell Quarter'},
        {ref:'b3',kind:'residence',x:250,y:520,w:34,h:20,a:.05,district:'West Fields'},
        {ref:'b4',kind:'clinic',x:960,y:620,w:32,h:20,district:'Market Row'},
        {ref:'b5',kind:'school',x:600,y:800,w:34,h:21,district:'Market Row'},
        {ref:'b6',kind:'market',x:980,y:760,w:40,h:24,district:'Market Row'},
        {ref:'b7',kind:'worship',x:800,y:330,w:30,h:26,district:'Bell Quarter'},
        {ref:'b8',kind:'civic',x:520,y:690,w:30,h:18,district:'Market Row'},
        {ref:'b9',kind:'public',x:1040,y:340,w:26,h:18,district:'Bell Quarter'},
        {ref:'b10',kind:'transport',x:300,y:900,w:48,h:22,a:-.03,district:'West Fields'}
      ],
      corridors:[
        {road:'market-square-n',sides:'both',interval:25,setback:6,depth:10,wMin:8,wMax:13,density:.95,back:.4,class:'core'},
        {road:'market-square-s',sides:'both',interval:26,setback:6,depth:10,wMin:8,wMax:13,density:.93,back:.4,class:'core'},
        {road:'high-street',sides:'both',interval:25,setback:6,depth:10,wMin:8,wMax:13,density:.94,back:.4,class:'core'},
        {road:'bell-lane',sides:'both',interval:24,setback:5,depth:9,wMin:7,wMax:11,density:.96,back:.45,class:'core'},
        {road:'fields-road',sides:'right',interval:34,setback:6,depth:10,wMin:8,wMax:12,density:.75,back:.35,class:'rural'},
        {road:'coach-yard-rd',sides:'both',interval:31,setback:6,depth:10,wMin:8,wMax:12,density:.82,back:.3,class:'ring'},
        {road:'grain-lane',sides:'both',interval:30,setback:4,depth:8,wMin:6,wMax:9,density:.8,back:.2,class:'core'},
        {road:'kiosk-row',sides:'both',interval:30,setback:4,depth:8,wMin:6,wMax:9,density:.82,back:.25,class:'core'}
      ]
    },
    marec:{
      motif:'county and grain town: offices row above the granaries and depot, Low Road housing below',
      bounds:{w:1450,h:1120},
      zoomMax:16,
      districts:[
        {name:'County Offices',pts:[[120,120],[1000,100],[1040,420],[160,440]]},
        {name:'Grain Market',pts:[[120,440],[1000,420],[1040,720],[160,740]]},
        {name:'Low Road',pts:[[120,740],[1000,720],[1040,1060],[160,1080]]}
      ],
      roads:[
        {id:'county-row',name:'County Row',cls:'primary',pts:[[160,260],[600,240],[1000,260]]},
        {id:'grain-street',name:'Grain Street',cls:'primary',pts:[[160,560],[600,540],[1000,560]]},
        {id:'low-road',name:'Low Road',cls:'secondary',pts:[[160,880],[600,860],[1000,880]]},
        {id:'cross-lane',name:'Cross Lane',cls:'secondary',pts:[[420,140],[450,420],[470,700],[490,1040]]},
        {id:'depot-lane',name:'Depot Lane',cls:'lane',pts:[[560,700],[590,840]]},
        {id:'east-lane',name:'East Lane',cls:'lane',pts:[[800,280],[820,680]]}
      ],
      railways:[
        {pts:[[0,760],[400,745],[900,735],[1450,725]]},
        {pts:[[590,745],[620,690]],spur:true}
      ],
      waterways:[],
      landUse:[
        {kind:'institutional',pts:[[140,140],[980,120],[1000,400],[160,420]]},
        {kind:'yard',texture:'hatch',pts:[[640,560],[980,550],[990,700],[650,710]]},
        {kind:'urban',pts:[[160,780],[560,765],[570,1040],[180,1050]]},
        {kind:'farmland',texture:'furrow',pts:[[1060,140],[1420,130],[1430,1040],[1080,1050]]}
      ],
      landmarks:[
        {ref:'b1',kind:'civic',x:300,y:300,w:56,h:28,district:'County Offices'},
        {ref:'b2',kind:'civic',x:660,y:500,w:52,h:28,district:'Grain Market'},
        {ref:'b3',kind:'residence',x:300,y:940,w:36,h:20,district:'Low Road'},
        {ref:'b4',kind:'clinic',x:520,y:600,w:32,h:20,district:'Grain Market'},
        {ref:'b5',kind:'school',x:520,y:310,w:36,h:21,district:'County Offices'},
        {ref:'b6',kind:'bureau',x:800,y:320,w:38,h:22,district:'County Offices'},
        {ref:'b7',kind:'civic',x:650,y:315,w:32,h:22,district:'County Offices'},
        {ref:'b8',kind:'transport',x:700,y:640,w:52,h:24,a:.02,district:'Grain Market'},
        {ref:'b9',kind:'bureau',x:180,y:330,w:36,h:21,district:'County Offices'},
        {ref:'b10',kind:'public',x:760,y:930,w:26,h:18,district:'Low Road'}
      ],
      corridors:[
        {road:'county-row',sides:'both',interval:28,setback:7,depth:10,wMin:9,wMax:14,density:.9,back:.3,class:'expansion'},
        {road:'grain-street',sides:'both',interval:27,setback:6,depth:10,wMin:9,wMax:14,density:.91,back:.35,class:'expansion'},
        {road:'low-road',sides:'both',interval:27,setback:6,depth:9,wMin:8,wMax:12,density:.92,back:.5,class:'ring'},
        {road:'cross-lane',sides:'both',interval:29,setback:5,depth:9,wMin:7,wMax:11,density:.87,back:.3,class:'core'},
        {road:'depot-lane',sides:'right',interval:32,setback:4,depth:8,wMin:6,wMax:9,density:.8,back:.15,class:'industrial'},
        {road:'east-lane',sides:'both',interval:33,setback:5,depth:9,wMin:7,wMax:10,density:.78,back:.25,class:'expansion'}
      ],
      yards:[
        {x:700,y:590,w:46,h:14,rows:2,cols:3,gap:10,class:'industrial',angle:.01}
      ]
    },
    kamenor:{
      motif:'river town: every street answers the broad river and its bridge',
      bounds:{w:1500,h:1150},
      zoomMax:16,
      districts:[
        {name:'Bridge Ward',pts:[[520,440],[1060,420],[1120,820],[560,840]]},
        {name:'Mill Bank',pts:[[300,100],[1180,80],[1220,420],[340,440]]},
        {name:'Old Quays',pts:[[120,560],[500,540],[540,1060],[160,1080]]}
      ],
      roads:[
        {id:'bridge-north',name:'Bridge Approach North',cls:'primary',pts:[[720,80],[740,300],[750,440]]},
        {id:'bridge-south',name:'Bridge Approach South',cls:'primary',pts:[[760,660],[770,880],[780,1120]]},
        {id:'quay-north',name:'North Quay',cls:'secondary',pts:[[180,400],[520,395],[900,385],[1300,390]]},
        {id:'quay-south',name:'Customs Quay',cls:'secondary',pts:[[200,700],[520,705],[900,695],[1340,700]]},
        {id:'mill-bank',name:'Mill Bank Road',cls:'secondary',pts:[[350,180],[540,220],[760,240]]},
        {id:'ferry-lane',name:'Ferry Lane',cls:'lane',pts:[[260,700],[280,880],[300,1040]]},
        {id:'ward-cross',name:'Ward Cross',cls:'secondary',pts:[[540,780],[900,770],[1180,780]]},
        {id:'school-lane',name:'School Lane',cls:'lane',pts:[[420,140],[440,340]]},
        {id:'east-bank',name:'East Bank Road',cls:'secondary',pts:[[1000,100],[1030,340],[1040,420]]}
      ],
      railways:[],
      waterways:[
        {kind:'water',pts:[[0,470],[300,460],[600,472],[900,458],[1200,470],[1500,460],[1500,620],[1200,630],[900,618],[600,632],[300,620],[0,630]]},
        {kind:'river',pts:[[0,505],[300,498],[600,508],[900,495],[1200,505],[1500,498]]},
        {kind:'river',pts:[[0,585],[300,578],[600,588],[900,575],[1200,585],[1500,578]]},
        {kind:'stream',pts:[[830,240],[838,320],[842,455]]},
        {kind:'quay',pts:[[200,688],[500,692],[900,683],[1330,688]]},
        {kind:'quay',pts:[[190,412],[500,408],[880,398],[1290,402]]},
        {kind:'pier',pts:[[240,632],[232,700]]}
      ],
      landUse:[
        {kind:'meadow',pts:[[140,740],[420,730],[430,1040],[160,1050]]},
        {kind:'urban',pts:[[560,720],[1060,700],[1080,960],[580,980]]},
        {kind:'urban',pts:[[340,140],[1000,120],[1030,360],[370,380]]}
      ],
      bridges:[
        {x:700,y:455,w:34,h:170}
      ],
      landmarks:[
        {ref:'b1',kind:'civic',x:800,y:720,w:54,h:28,district:'Bridge Ward'},
        {ref:'b2',kind:'residence',x:560,y:280,w:34,h:20,district:'Mill Bank'},
        {ref:'b3',kind:'residence',x:280,y:800,w:38,h:22,a:.06,district:'Old Quays'},
        {ref:'b4',kind:'clinic',x:1060,y:280,w:32,h:20,district:'Mill Bank'},
        {ref:'b5',kind:'school',x:460,y:210,w:34,h:21,district:'Mill Bank'},
        {ref:'b6',kind:'workplace',x:900,y:180,w:52,h:26,district:'Mill Bank'},
        {ref:'b7',kind:'civic',x:340,y:740,w:32,h:19,district:'Old Quays'},
        {ref:'b8',kind:'worship',x:420,y:900,w:28,h:25,district:'Old Quays'},
        {ref:'b9',kind:'bureau',x:640,y:740,w:28,h:17,district:'Bridge Ward'},
        {ref:'b10',kind:'public',x:955,y:755,w:26,h:18,district:'Bridge Ward'}
      ],
      corridors:[
        {road:'bridge-north',sides:'both',interval:27,setback:6,depth:10,wMin:8,wMax:13,density:.92,back:.35,class:'core'},
        {road:'bridge-south',sides:'both',interval:27,setback:6,depth:10,wMin:8,wMax:13,density:.92,back:.35,class:'core'},
        {road:'quay-north',sides:'both',interval:28,setback:6,depth:10,wMin:9,wMax:14,density:.9,back:.3,class:'expansion'},
        {road:'quay-south',sides:'both',interval:28,setback:6,depth:10,wMin:9,wMax:14,density:.9,back:.3,class:'expansion'},
        {road:'mill-bank',sides:'both',interval:29,setback:6,depth:10,wMin:9,wMax:13,density:.89,back:.3,class:'expansion'},
        {road:'ward-cross',sides:'both',interval:28,setback:6,depth:9,wMin:8,wMax:12,density:.9,back:.35,class:'core'},
        {road:'ferry-lane',sides:'left',interval:33,setback:4,depth:8,wMin:6,wMax:9,density:.78,back:.2,class:'rural'},
        {road:'school-lane',sides:'both',interval:32,setback:4,depth:8,wMin:6,wMax:9,density:.8,back:.2,class:'core'},
        {road:'east-bank',sides:'both',interval:31,setback:5,depth:9,wMin:7,wMax:11,density:.84,back:.25,class:'expansion'}
      ]
    },
    sundervik:{
      motif:'fishing town: harbor steps cut into the northern sea wall, net yards ashore, signal hill above',
      bounds:{w:1400,h:1100},
      zoomMax:16,
      districts:[
        {name:'Harbor Steps',pts:[[80,140],[620,120],[660,420],[120,440]]},
        {name:'Netmakers\u2019 Row',pts:[[200,460],[860,440],[900,760],[240,780]]},
        {name:'Signal Hill',pts:[[880,140],[1320,160],[1300,720],[920,700],[900,420]]}
      ],
      roads:[
        {id:'shore-street',name:'Shore Street',cls:'primary',pts:[[100,400],[500,385],[900,375],[1320,380]]},
        {id:'harbor-steps',name:'Harbor Steps',cls:'secondary',pts:[[240,140],[260,240],[280,330]]},
        {id:'net-row',name:'Netmakers\u2019 Row',cls:'secondary',pts:[[280,520],[600,505],[880,510]]},
        {id:'hill-road',name:'Signal Hill Road',cls:'secondary',pts:[[980,180],[1020,420],[1000,660]]},
        {id:'inland-track',name:'Inland Track',cls:'lane',pts:[[140,700],[500,690],[860,700],[1240,715]]},
        {id:'salt-lane',name:'Salt Lane',cls:'lane',pts:[[380,240],[400,380]]},
        {id:'chapel-lane',name:'Chapel Lane',cls:'lane',pts:[[320,560],[340,690]]}
      ],
      railways:[],
      waterways:[
        {kind:'water',pts:[[0,0],[1400,0],[1400,110],[1000,120],[600,132],[250,140],[0,135]]},
        {kind:'coast',pts:[[0,138],[250,142],[600,134],[1000,122],[1400,112]]},
        {kind:'quay',pts:[[60,146],[300,152],[560,142],[860,130]]},
        {kind:'steps',pts:[[250,148],[262,176],[276,204],[290,232]]},
        {kind:'pier',pts:[[430,136],[438,196]]}
      ],
      landUse:[
        {kind:'yard',texture:'hatch',pts:[[300,430],[540,420],[550,500],[310,510]]},
        {kind:'meadow',pts:[[940,440],[1290,430],[1280,640],[960,650]]},
        {kind:'urban',pts:[[300,560],[560,550],[570,690],[320,700]]}
      ],
      relief:[
        'M 940 660 C 990 600 1060 560 1130 555 C 1210 550 1270 590 1290 640',
        'M 980 630 C 1020 585 1080 555 1140 552 C 1200 550 1250 580 1265 620'
      ],
      landmarks:[
        {ref:'b1',kind:'residence',x:330,y:300,w:34,h:20,district:'Harbor Steps'},
        {ref:'b2',kind:'transport',x:400,y:460,w:48,h:22,district:'Netmakers\u2019 Row'},
        {ref:'b3',kind:'transport',x:1060,y:300,w:44,h:22,a:.05,district:'Signal Hill'},
        {ref:'b4',kind:'clinic',x:640,y:560,w:30,h:19,district:'Netmakers\u2019 Row'},
        {ref:'b5',kind:'school',x:560,y:620,w:32,h:20,district:'Netmakers\u2019 Row'},
        {ref:'b6',kind:'market',x:180,y:300,w:32,h:20,district:'Harbor Steps'},
        {ref:'b7',kind:'civic',x:1180,y:480,w:34,h:21,district:'Signal Hill'},
        {ref:'b8',kind:'worship',x:420,y:640,w:26,h:23,district:'Netmakers\u2019 Row'},
        {ref:'b9',kind:'bureau',x:470,y:300,w:26,h:16,district:'Harbor Steps'},
        {ref:'b10',kind:'public',x:1060,y:600,w:26,h:18,district:'Signal Hill'}
      ],
      corridors:[
        {road:'shore-street',sides:'both',interval:28,setback:6,depth:10,wMin:8,wMax:13,density:.9,back:.3,class:'expansion'},
        {road:'harbor-steps',sides:'right',interval:30,setback:5,depth:9,wMin:7,wMax:11,density:.85,back:.25,class:'core'},
        {road:'net-row',sides:'both',interval:27,setback:6,depth:9,wMin:8,wMax:12,density:.92,back:.45,class:'ring'},
        {road:'hill-road',sides:'both',interval:31,setback:6,depth:10,wMin:8,wMax:12,density:.84,back:.25,class:'expansion'},
        {road:'inland-track',sides:'both',interval:36,setback:6,depth:9,wMin:7,wMax:11,density:.62,back:.2,class:'rural'},
        {road:'salt-lane',sides:'both',interval:32,setback:4,depth:8,wMin:6,wMax:9,density:.78,back:.2,class:'core'},
        {road:'chapel-lane',sides:'left',interval:33,setback:4,depth:8,wMin:6,wMax:8,density:.72,back:.15,class:'ring'}
      ],
      yards:[
        {x:330,y:440,w:36,h:12,rows:2,cols:3,gap:9,class:'industrial',angle:.01}
      ]
    },
    krasnava:{
      motif:'linear agricultural village: long houses facing the road, narrow plots and barns behind, green at the heart',
      protectedLand:['gardens','green'],
      bounds:{w:950,h:750},
      zoomMax:13,
      districts:[
        {name:'Village Green',pts:[[300,240],[640,225],[660,430],[320,450]]},
        {name:'North Fields',pts:[[60,40],[890,30],[900,220],[80,235]]},
        {name:'Mill Road',pts:[[240,450],[680,435],[700,700],[260,715]]}
      ],
      roads:[
        {id:'main-road',name:'Village Main Road',cls:'primary',pts:[[50,330],[300,322],[650,315],[900,308]]},
        {id:'green-cross',name:'Green Crossing',cls:'secondary',pts:[[470,60],[478,240],[485,470],[492,700]]},
        {id:'mill-road',name:'Mill Road',cls:'secondary',pts:[[300,530],[470,522],[660,515]]},
        {id:'field-lane',name:'Field Lane',cls:'lane',pts:[[130,120],[145,300],[155,470]]},
        {id:'orchard-lane',name:'Orchard Lane',cls:'lane',pts:[[700,120],[712,300],[720,460]]}
      ],
      railways:[],
      waterways:[
        {kind:'stream',pts:[[0,640],[200,632],[420,645],[650,630],[950,638]]}
      ],
      landUse:[
        {kind:'farmland',texture:'furrow',pts:[[40,40],[440,32],[450,215],[60,228]]},
        {kind:'farmland',texture:'furrow',pts:[[520,36],[910,28],[920,210],[530,218]]},
        {kind:'farmland',texture:'furrow',pts:[[40,470],[240,462],[250,720],[60,730]]},
        {kind:'farmland',texture:'furrow',pts:[[540,478],[930,468],[940,720],[560,728]]},
        {kind:'green',d:null,pts:[[330,300],[620,290],[630,410],[340,420]]},
        {kind:'orchard',texture:'orchard',pts:[[540,530],[660,525],[668,610],[548,616]]}
      ],
      landmarks:[
        {ref:'b1',kind:'civic',x:400,y:300,w:34,h:20,district:'Village Green'},
        {ref:'b2',kind:'residence',x:170,y:130,w:30,h:18,a:.04,district:'North Fields'},
        {ref:'b3',kind:'residence',x:560,y:560,w:28,h:17,district:'Mill Road'},
        {ref:'b4',kind:'clinic',x:560,y:340,w:26,h:17,district:'Village Green'},
        {ref:'b5',kind:'school',x:340,y:390,w:30,h:18,district:'Village Green'},
        {ref:'b6',kind:'market',x:620,y:390,w:28,h:18,district:'Village Green'},
        {ref:'b7',kind:'workplace',x:420,y:600,w:38,h:22,district:'Mill Road'},
        {ref:'b8',kind:'worship',x:480,y:350,w:24,h:22,district:'Village Green'},
        {ref:'b9',kind:'bureau',x:600,y:300,w:20,h:14,district:'Village Green'},
        {ref:'b10',kind:'public',x:340,y:560,w:24,h:16,district:'Mill Road'}
      ],
      corridors:[
        {road:'main-road',sides:'both',interval:34,setback:5,depth:10,wMin:9,wMax:14,density:.94,back:.6,class:'village'},
        {road:'green-cross',sides:'both',interval:36,setback:5,depth:9,wMin:8,wMax:12,density:.85,back:.5,class:'village'},
        {road:'mill-road',sides:'both',interval:37,setback:5,depth:9,wMin:8,wMax:12,density:.86,back:.5,class:'village'},
        {road:'field-lane',sides:'right',interval:40,setback:4,depth:8,wMin:6,wMax:9,density:.7,back:.3,class:'village'},
        {road:'orchard-lane',sides:'left',interval:42,setback:4,depth:8,wMin:6,wMax:9,density:.68,back:.3,class:'village'}
      ]
    },
    brezin:{
      motif:'forest village: clearings strung along the timber road under broad woodland and low hills',
      protectedLand:['gardens','green'],
      bounds:{w:1000,h:800},
      zoomMax:13,
      districts:[
        {name:'Lower Road',pts:[[60,420],[420,400],[460,720],[100,740]]},
        {name:'Timber Yard',pts:[[300,180],[700,160],[740,400],[340,420]]},
        {name:'Hill Houses',pts:[[620,420],[940,400],[960,740],[640,760]]}
      ],
      roads:[
        {id:'timber-road',name:'Timber Road',cls:'primary',pts:[[40,600],[260,520],[520,420],[780,330],[970,270]]},
        {id:'yard-road',name:'Yard Road',cls:'secondary',pts:[[380,240],[420,360],[450,470]]},
        {id:'hill-lane',name:'Hill Lane',cls:'lane',pts:[[680,430],[720,560],[750,700]]},
        {id:'church-path',name:'Church Path',cls:'lane',pts:[[180,470],[200,590]]}
      ],
      railways:[],
      waterways:[],
      landUse:[
        {kind:'forest',texture:'trees',pts:[[30,40],[340,30],[360,220],[60,240]]},
        {kind:'forest',texture:'trees',pts:[[480,30],[780,20],[800,180],[500,200]]},
        {kind:'forest',texture:'trees',pts:[[820,60],[970,55],[975,260],[840,270]]},
        {kind:'forest',texture:'trees',pts:[[30,700],[240,690],[250,780],[50,790]]},
        {kind:'forest',texture:'trees',pts:[[470,700],[640,690],[650,780],[480,790]]},
        {kind:'forest',texture:'trees',pts:[[800,560],[970,550],[975,780],[815,790]]},
        {kind:'meadow',pts:[[240,560],[420,545],[430,660],[255,670]]}
      ],
      relief:[
        'M 640 760 C 700 700 780 660 850 660 C 910 660 950 690 962 730',
        'M 676 726 C 724 678 792 650 848 650 C 898 650 934 674 944 706'
      ],
      landmarks:[
        {ref:'b1',kind:'residence',x:150,y:530,w:30,h:18,district:'Lower Road'},
        {ref:'b2',kind:'civic',x:470,y:290,w:38,h:22,district:'Timber Yard'},
        {ref:'b3',kind:'residence',x:790,y:560,w:30,h:18,a:.08,district:'Hill Houses'},
        {ref:'b4',kind:'clinic',x:250,y:620,w:28,h:18,district:'Lower Road'},
        {ref:'b5',kind:'school',x:340,y:660,w:30,h:18,district:'Lower Road'},
        {ref:'b6',kind:'workplace',x:560,y:380,w:52,h:26,district:'Timber Yard'},
        {ref:'b7',kind:'transport',x:800,y:480,w:34,h:18,a:.1,district:'Hill Houses'},
        {ref:'b8',kind:'market',x:590,y:340,w:28,h:17,district:'Timber Yard'},
        {ref:'b9',kind:'bureau',x:200,y:680,w:22,h:14,district:'Lower Road'},
        {ref:'b10',kind:'public',x:720,y:640,w:24,h:16,district:'Hill Houses'}
      ],
      corridors:[
        {road:'timber-road',sides:'both',interval:38,setback:5,depth:9,wMin:8,wMax:12,density:.8,back:.4,class:'village'},
        {road:'yard-road',sides:'both',interval:36,setback:5,depth:9,wMin:8,wMax:11,density:.8,back:.3,class:'village'},
        {road:'hill-lane',sides:'both',interval:40,setback:4,depth:8,wMin:6,wMax:9,density:.7,back:.3,class:'village'},
        {road:'church-path',sides:'left',interval:42,setback:4,depth:7,wMin:5,wMax:8,density:.65,back:.2,class:'village'}
      ]
    },
    svetlin:{
      motif:'monastery village: walled close and clinic road at the heart, gardens and fields around',
      protectedLand:['gardens','institutional'],
      bounds:{w:900,h:720},
      zoomMax:13,
      districts:[
        {name:'Monastery Close',pts:[[220,60],[600,50],[620,300],[240,320]]},
        {name:'Clinic Road',pts:[[60,300],[840,280],[860,440],[80,460]]},
        {name:'East Gardens',pts:[[480,460],[860,440],[880,690],[500,700]]}
      ],
      roads:[
        {id:'clinic-road',name:'Clinic Road',cls:'primary',pts:[[40,380],[300,370],[600,360],[860,352]]},
        {id:'close-lane',name:'Close Lane',cls:'secondary',pts:[[260,120],[280,240],[290,360]]},
        {id:'pilgrim-lane',name:'Pilgrim Lane',cls:'lane',pts:[[420,120],[430,240],[438,360]]},
        {id:'gardens-lane',name:'Gardens Lane',cls:'lane',pts:[[540,440],[560,580],[575,700]]},
        {id:'shrine-path',name:'Shrine Path',cls:'lane',pts:[[340,300],[355,380]]}
      ],
      railways:[],
      waterways:[],
      landUse:[
        {kind:'institutional',texture:'trees',pts:[[240,70],[590,60],[605,280],[255,295]]},
        {kind:'gardens',texture:'trees',pts:[[320,300],[560,290],[570,360],[330,368]]},
        {kind:'farmland',texture:'furrow',pts:[[490,470],[870,455],[880,690],[510,700]]},
        {kind:'meadow',pts:[[60,470],[300,460],[310,690],[80,700]]},
        {kind:'orchard',texture:'orchard',pts:[[330,470],[460,465],[465,570],[340,578]]}
      ],
      landmarks:[
        {ref:'b1',kind:'worship',x:340,y:120,w:64,h:34,district:'Monastery Close'},
        {ref:'b2',kind:'clinic',x:180,y:390,w:34,h:20,district:'Clinic Road'},
        {ref:'b3',kind:'residence',x:660,y:520,w:32,h:19,a:.05,district:'East Gardens'},
        {ref:'b4',kind:'clinic',x:620,y:390,w:32,h:20,district:'Clinic Road'},
        {ref:'b5',kind:'school',x:300,y:420,w:30,h:18,district:'Clinic Road'},
        {ref:'b6',kind:'market',x:520,y:200,w:26,h:17,district:'Monastery Close'},
        {ref:'b7',kind:'residence',x:470,y:300,w:28,h:17,district:'Monastery Close'},
        {ref:'b8',kind:'bureau',x:400,y:395,w:28,h:16,district:'Clinic Road'},
        {ref:'b9',kind:'worship',x:250,y:250,w:22,h:20,district:'Monastery Close'},
        {ref:'b10',kind:'public',x:640,y:620,w:24,h:16,district:'East Gardens'}
      ],
      corridors:[
        {road:'clinic-road',sides:'both',interval:35,setback:5,depth:9,wMin:8,wMax:12,density:.85,back:.35,class:'village'},
        {road:'close-lane',sides:'right',interval:37,setback:4,depth:8,wMin:6,wMax:9,density:.72,back:.25,class:'village'},
        {road:'pilgrim-lane',sides:'both',interval:38,setback:4,depth:8,wMin:6,wMax:9,density:.7,back:.25,class:'village'},
        {road:'gardens-lane',sides:'left',interval:40,setback:4,depth:8,wMin:6,wMax:8,density:.6,back:.2,class:'village'},
        {road:'shrine-path',sides:'right',interval:44,setback:4,depth:7,wMin:5,wMax:8,density:.6,back:0,class:'village'}
      ]
    },
    oberhain:{
      motif:'estate village: lawns and chapel lane strung along the old military road',
      protectedLand:['gardens','green','estate'],
      bounds:{w:900,h:720},
      zoomMax:13,
      districts:[
        {name:'Upper Hain',pts:[[280,80],[640,60],[660,300],[320,320]]},
        {name:'Chapel Lane',pts:[[60,60],[280,60],[340,430],[400,510],[350,565],[110,450]]},
        {name:'South Yards',pts:[[340,340],[840,320],[860,660],[380,680]]}
      ],
      roads:[
        {id:'military-road',name:'Military Road',cls:'primary',pts:[[0,660],[200,560],[420,430],[650,300],[900,190]]},
        {id:'estate-drive',name:'Estate Drive',cls:'secondary',pts:[[420,120],[440,240],[455,380]]},
        {id:'chapel-lane',name:'Chapel Lane',cls:'secondary',pts:[[150,120],[170,260],[185,420],[205,560]]},
        {id:'yards-lane',name:'Yards Lane',cls:'lane',pts:[[600,380],[620,520],[640,660]]},
        {id:'garden-wall',name:'Garden Wall Walk',cls:'lane',pts:[[300,300],[460,290],[620,300]]}
      ],
      railways:[],
      waterways:[],
      landUse:[
        {kind:'estate',texture:'trees',pts:[[300,90],[640,70],[660,290],[330,310]]},
        {kind:'estate',texture:'trees',pts:[[480,300],[660,290],[670,400],[490,410]]},
        {kind:'yard',texture:'hatch',pts:[[680,340],[850,330],[860,470],[695,480]]},
        {kind:'farmland',texture:'furrow',pts:[[380,500],[660,490],[670,680],[395,690]]}
      ],
      landmarks:[
        {ref:'b1',kind:'residence',x:430,y:150,w:56,h:28,district:'Upper Hain'},
        {ref:'b2',kind:'worship',x:190,y:180,w:28,h:24,district:'Chapel Lane'},
        {ref:'b3',kind:'civic',x:700,y:380,w:34,h:20,district:'South Yards'},
        {ref:'b4',kind:'clinic',x:560,y:430,w:30,h:19,district:'South Yards'},
        {ref:'b5',kind:'school',x:480,y:520,w:32,h:19,district:'South Yards'},
        {ref:'b6',kind:'market',x:720,y:500,w:30,h:18,district:'South Yards'},
        {ref:'b7',kind:'worship',x:210,y:330,w:26,h:23,district:'Chapel Lane'},
        {ref:'b8',kind:'transport',x:330,y:490,w:36,h:18,a:-.5,district:'Chapel Lane'},
        {ref:'b9',kind:'bureau',x:640,y:560,w:24,h:15,district:'South Yards'},
        {ref:'b10',kind:'public',x:540,y:250,w:24,h:16,district:'Upper Hain'}
      ],
      corridors:[
        {road:'military-road',sides:'both',interval:42,setback:5,depth:9,wMin:8,wMax:12,density:.7,back:.3,class:'village'},
        {road:'estate-drive',sides:'both',interval:44,setback:5,depth:9,wMin:7,wMax:11,density:.62,back:.2,class:'village'},
        {road:'chapel-lane',sides:'both',interval:40,setback:4,depth:8,wMin:6,wMax:9,density:.72,back:.25,class:'village'},
        {road:'yards-lane',sides:'both',interval:41,setback:4,depth:8,wMin:6,wMax:9,density:.68,back:.25,class:'village'},
        {road:'garden-wall',sides:'left',interval:46,setback:4,depth:7,wMin:5,wMax:8,density:.55,back:0,class:'village'}
      ]
    }
  };



  /* ======================= SETTLEMENT SCENE BUILDER ====================
     Deterministic expansion of an authored plan into a full scene: landmark
     footprints bound to canonical ids, generated street frontage and yards,
     cached so repeated renders never regenerate.
     --------------------------------------------------------------------- */
  const POI_PRIORITY={transport:9,bureau:8,civic:8,clinic:7,market:6,school:5,worship:4,workplace:3,residence:2,public:1};
  const POI_TIER_FLOOR=[6,3,1];
  function poiPriority(type){ return POI_PRIORITY[type]||1; }
  const sceneCache=new Map();
  function settlementPlan(id){ return Object.prototype.hasOwnProperty.call(SETTLEMENT_PLANS,id)?SETTLEMENT_PLANS[id]:null; }
  function buildScene(id){
    const p=SETTLEMENT_PLANS[id];
    const rnd=seeded(hashSeed('scene:'+id));
    const visuals=[];
    const canonical={};
    const grid=new SpatialGrid(64);

    /* protected open land: ordinary fabric may not fill these unless the
       plan overrides the list (e.g. villages allow barns deep in fields) */
    const DEFAULT_PROTECTED=['gardens','green','meadow','estate','orchard','institutional','farmland'];
    const protectedKinds=p.protectedLand||DEFAULT_PROTECTED;
    const PROTECTED={};
    protectedKinds.forEach(k=>{PROTECTED[k]=1;});
    const openLand=(p.landUse||[]).filter(l=>PROTECTED[l.kind]);
    /* open water polygons */
    const waterAreas=(p.waterways||[]).filter(w=>w.kind==='water'||w.kind==='basin');
    /* road carriageways: reject only what sits well inside the roadway -
       frontage buildings are meant to hug the street edge */
    const ROAD_HALFWIDTH={primary:16,secondary:11,lane:7};
    const roadSegs=[];
    (p.roads||[]).forEach(r=>{
      const hw=ROAD_HALFWIDTH[r.cls]||9;
      segmentsOf(r.pts).forEach(seg=>{seg.hw=hw;roadSegs.push(seg);});
    });
    function distToSeg(px,py,s){
      const dx=s.bx-s.ax, dy=s.by-s.ay;
      const t=clamp(((px-s.ax)*dx+(py-s.ay)*dy)/(s.len*s.len||1),0,1);
      return Math.hypot(px-(s.ax+dx*t),py-(s.ay+dy*t));
    }
    function nearRoad(px,py){
      for(let i=0;i<roadSegs.length;i++){
        const s=roadSegs[i];
        if(Math.abs(px-(s.ax+s.bx)/2)>s.len/2+s.hw+6) continue;
        if(distToSeg(px,py,s)<s.hw*0.3) return true;
      }
      return false;
    }
    function inPolyList(list,x,y){
      for(let i=0;i<list.length;i++) if(pointInPolygon(x,y,list[i].pts||list[i])) return true;
      return false;
    }

    /* canonical landmarks first - everything else must respect them */
    (p.landmarks||[]).forEach(lm=>{
      const poly=rectPoly(lm.x,lm.y,lm.w,lm.h,num(lm.a,0));
      const v={id:id+'-'+lm.ref,poly,hitPoly:rectPoly(lm.x,lm.y,lm.w+18,lm.h+18,num(lm.a,0)),
        kind:lm.kind,minor:false,canonicalBuildingId:id+'-'+lm.ref,
        district:lm.district,cx:lm.x,cy:lm.y,w:lm.w,h:lm.h,a:num(lm.a,0),fabricClass:'landmark'};
      v.bbox=polyBBox(poly);
      visuals.push(v);
      grid.insert({poly:v.poly},v.poly);
      canonical[v.canonicalBuildingId]=v;
    });

    let fabricIndex=0;
    function polyBBox(poly){
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      poly.forEach(pt=>{minX=Math.min(minX,pt[0]);maxX=Math.max(maxX,pt[0]);minY=Math.min(minY,pt[1]);maxY=Math.max(maxY,pt[1]);});
      return [minX,minY,maxX,maxY];
    }
    const blockPolys=(p.blocks||[]).map(b=>b.polygon);
    /* fromCorridor: ordinary street fabric may not invade an authored
       perimeter block - the block owns its own interior and edges. */
    function place(poly,cls,minor,fromCorridor){
      const c=polyCentroid(poly);
      if(c.x<2||c.y<2||c.x>p.bounds.w-2||c.y>p.bounds.h-2) return false;
      if(fromCorridor&&blockPolys.some(bp=>pointInPolygon(c.x,c.y,bp))) return false;
      if(nearRoad(c.x,c.y)) return false;
      if(inPolyList(openLand,c.x,c.y)) return false;
      if(inPolyList(waterAreas,c.x,c.y)) return false;
      const nearby=grid.query(poly);
      for(let i=0;i<nearby.length;i++) if(polysIntersect(poly,nearby[i].poly)) return false;
      fabricIndex++;
      const v={id:id+'-vb-'+String(fabricIndex).padStart(5,'0'),poly,kind:cls,minor,
        canonicalBuildingId:null,cx:+c.x.toFixed(1),cy:+c.y.toFixed(1),fabricClass:cls};
      v.bbox=polyBBox(poly);
      visuals.push(v);
      grid.insert({poly},poly);
      return true;
    }

    (p.blocks||[]).forEach(b=>generatePerimeterBlock(b,rnd,function(poly,cls,minor){
      return place(poly,cls,minor,false);
    }));
    const roadById={};
    (p.roads||[]).forEach(r=>{ roadById[r.id]=r; });
    (p.corridors||[]).forEach(c=>{
      const road=roadById[c.road];
      if(!road) return;
      segmentsOf(road.pts).forEach(seg=>generateCorridor(seg,c,rnd,function(poly,cls,minor){
        return place(poly,cls,minor,true);
      }));
    });
    (p.yards||[]).forEach(y=>generateShedGrid(y,rnd,function(poly,cls,minor){
      return place(poly,cls,minor,true);
    }));

    /* street name labels; angle normalized so text never reads upside-down */
    const streetLabels=[];
    (p.roads||[]).forEach(r=>{
      if(!r.name||r.cls==='lane') return;
      const segs=segmentsOf(r.pts);
      if(!segs.length) return;
      const longest=segs.reduce((m,s)=>s.len>m.len?s:m,segs[0]);
      let deg=longest.angle*180/Math.PI;
      while(deg>90)deg-=180;
      while(deg<-90)deg+=180;
      streetLabels.push({id:'st-'+r.id,text:r.name,cls:r.cls,
        x:(longest.ax+longest.bx)/2,y:(longest.ay+longest.by)/2,angle:longest.angle,deg});
    });
    return {
      id,bounds:p.bounds,motif:p.motif,
      districts:p.districts||[],roads:p.roads||[],waterways:p.waterways||[],railways:p.railways||[],
      landUse:p.landUse||[],bridges:p.bridges||[],blocks:p.blocks||[],
      visuals,canonical,streetLabels
    };
  }
  function settlementScene(id){
    if(!sceneCache.has(id)) sceneCache.set(id,buildScene(id));
    return sceneCache.get(id);
  }
  function settlementZoomConfig(id){
    const p=settlementPlan(id);
    return p?{min:1,max:num(p.zoomMax,14)}:{min:1,max:14};
  }
  function visualBuildingForCanonicalId(settlementId,canonicalBuildingId){
    const scene=settlementScene(settlementId);
    return scene.canonical[canonicalBuildingId]||null;
  }

  /* ---- settlement geometry markup ---- */
  const LANDUSE_FILL={urban:'#e3e0cd',farmland:'#eae6c4',meadow:'#e0e7c7',gardens:'#dbe4cf',estate:'#dde6d3',
    industrial:'#ddd8ca',yard:'#ded9c9',institutional:'#e2ddce',orchard:'#e2e8c9',harbor:'#cfe0e4',
    forest:'#cbdcc9',green:'#dfe8c2'};
  function waterwaysMarkup(list){
    return '<g class="plan-waterways" aria-hidden="true">'+list.map(w=>{
      if(w.kind==='water'||w.kind==='basin') return '<path class="plan-water-area" d="'+polyPath(w.pts)+'"></path>';
      const cls={river:'plan-river-line',stream:'plan-stream-line',coast:'plan-coast-line',
        quay:'plan-quay-line',pier:'plan-quay-line',steps:'plan-steps-line'}[w.kind]||'plan-river-line';
      return '<path class="'+cls+'" d="'+linePath(w.pts)+'"'+nsAttr()+'></path>';
    }).join('')+'</g>';
  }
  function railwaysMarkup(list){
    return '<g class="plan-railways" aria-hidden="true">'+list.map(r=>{
      const d=linePath(r.pts), spur=!!r.spur;
      return '<path class="plan-rail-casing" d="'+d+'"'+nsAttr()+'></path>'
        +'<path class="plan-rail'+(spur?' spur':'')+'" d="'+d+'"'+nsAttr()+'></path>';
    }).join('')+'</g>';
  }
  function roadsMarkup(list){
    return '<g class="plan-streets">'+list.map(r=>{
      const cls=r.cls==='primary'?'plan-road':r.cls==='lane'?'plan-road lane':'plan-road secondary';
      return '<path class="'+cls+'" data-road-id="'+r.id+'" d="'+linePath(r.pts)+'"></path>';
    }).join('')+'</g>';
  }
  function districtsMarkup(list){
    return '<g class="plan-districts" aria-hidden="true">'+list.map(d=>
      '<path class="plan-district-area" d="'+polyPath(d.pts)+'"></path>'
      +'<path class="plan-district-boundary" d="'+polyPath(d.pts)+'"'+nsAttr()+'></path>'
    ).join('')+'</g>';
  }
  function landUseMarkup(list){
    return '<g class="plan-landuse" aria-hidden="true">'+list.map(p=>{
      const cls='lu-'+(LANDUSE_FILL[p.kind]?p.kind:'meadow');
      const tex=p.texture?'<path class="lu-texture lu-tex-'+p.texture+'" d="'+polyPath(p.pts)+'"></path>':'';
      return '<path class="'+cls+'" d="'+polyPath(p.pts)+'"></path>'+tex;
    }).join('')+'</g>';
  }
  function bridgesMarkup(list){
    if(!list.length) return '';
    return '<g class="plan-bridges" aria-hidden="true">'+list.map(b=>
      '<rect class="plan-bridge" x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx="2"></rect>').join('')+'</g>';
  }
  function fabricMarkup(visuals){
    const groups={};
    visuals.forEach(v=>{
      if(v.canonicalBuildingId) return;
      const key=v.fabricClass||v.kind||'urban';
      groups[key]=(groups[key]||'')+polyPath(v.poly)+' ';
    });
    return '<g class="plan-fabric" aria-hidden="true">'+Object.keys(groups).map(k=>
      '<path class="fabric-'+k+'" d="'+groups[k].trim()+'"></path>').join('')+'</g>';
  }
  function reliefMarkup(scene){
    const plan=SETTLEMENT_PLANS[scene.id];
    if(!plan.relief||!plan.relief.length) return '';
    return '<g class="plan-relief" aria-hidden="true">'+paths('plan-contour',plan.relief)+'</g>';
  }
  function settlementBaseMarkup(scene){
    return '<rect class="settlement-ground" x="0" y="0" width="'+scene.bounds.w+'" height="'+scene.bounds.h+'"></rect>'
      +patternDefs()
      +districtsMarkup(scene.districts)
      +landUseMarkup(scene.landUse)
      +waterwaysMarkup(scene.waterways)
      +reliefMarkup(scene)
      +railwaysMarkup(scene.railways)
      +roadsMarkup(scene.roads)
      +bridgesMarkup(scene.bridges)
      +fabricMarkup(scene.visuals);
  }

  /* ---- POI cartographic symbols (presentation only) ---- */
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
      inner='<circle r="'+(k*0.85)+'" class="sym-fill"/><circle r="'+(k*0.32)+'" class="sym-core"/>';
    }else if(type==='bureau'){
      inner='<path d="'+starPath(0,0,k,k*0.45)+'" class="sym-fill"/>';
    }else if(type==='civic'){
      inner='<path d="M '+(-k)+' '+(k*0.6)+' L 0 '+(-k*0.8)+' L '+k+' '+(k*0.6)+' Z" class="sym-line"/>'
        +'<path d="M '+(-k*0.8)+' '+(k*0.95)+' H '+(k*0.8)+'" class="sym-line"/>';
    }else if(type==='clinic'){
      inner='<path d="M 0 '+(-k)+' V '+k+' M '+(-k)+' 0 H '+k+'" class="sym-heavy"/>';
    }else if(type==='school'){
      inner='<path d="M '+(-k*0.7)+' '+k+' V '+(-k*0.8)+'" class="sym-line"/>'
        +'<path d="M '+(-k*0.7)+' '+(-k*0.8)+' L '+(k*0.9)+' '+(-k*0.3)+' L '+(-k*0.7)+' '+(k*0.2)+' Z" class="sym-fill"/>';
    }else if(type==='market'){
      inner='<path d="M 0 '+(-k*0.9)+' V '+(k*0.5)+'" class="sym-line"/>'
        +'<path d="M '+(-k)+' '+(-k*0.5)+' H '+k+'" class="sym-line"/>'
        +'<circle cx="'+(-k*0.75)+'" cy="'+(-k*0.05)+'" r="'+(k*0.3)+'" class="sym-line"/>'
        +'<circle cx="'+(k*0.75)+'" cy="'+(-k*0.05)+'" r="'+(k*0.3)+'" class="sym-line"/>';
    }else if(type==='worship'){
      inner='<path d="M 0 '+(-k)+' V '+k+'" class="sym-heavy"/><path d="M '+(-k*0.6)+' '+(-k*0.25)+' H '+(k*0.6)+'" class="sym-heavy"/>';
    }else if(type==='workplace'){
      inner='<path d="M '+(-k)+' '+(k*0.7)+' V '+(-k*0.1)+' L '+(-k*0.3)+' '+(-k*0.55)+' L '+(-k*0.3)+' '+(-k*0.1)+' L 0 '+(-k*0.55)+' L 0 '+(-k*0.1)+' L '+(k*0.7)+' '+(-k*0.55)+' V '+(k*0.7)+' Z" class="sym-line"/>';
    }else if(type==='residence'){
      inner='<path d="M '+(-k)+' '+(k*0.7)+' V '+(-k*0.1)+' L 0 '+(-k*0.9)+' L '+k+' '+(-k*0.1)+' V '+(k*0.7)+' Z" class="sym-line"/>';
    }else{
      inner='<circle r="'+(k*0.75)+'" class="sym-line"/><circle r="'+(k*0.22)+'" class="sym-fill"/>';
    }
    return '<g class="map-poi poi-'+type+'" aria-hidden="true" pointer-events="none">'+inner+'</g>';
  }

  /* ======================= ANNOTATION SYSTEM ==========================
     Labels belong to their entities. Anchors come from entity geometry,
     candidates/collision run in view space against the current camera, and
     results are emitted back into world coordinates inside counter-scaled
     groups so text and icons keep approximately constant screen size while
     the map pans under them. Viewport culling keeps off-screen labels out
     of the collision pool entirely.
     --------------------------------------------------------------------- */
  function annotationItems(scene,camera,view,tier,names,selectedId,currentId){
    const s=num(camera.scale,1), U=scene.bounds.h/42;
    const rect=viewRectWorld(camera,view,.15);
    const floor=POI_TIER_FLOOR[clamp(num(tier,2),0,2)];
    const font=U*0.4, charW=font*0.6;
    const inView=(x,y)=>x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h;
    const items=[], reserved=[];
    const padX=view.width*0.35, padY=view.height*0.25;
    Object.keys(scene.canonical).forEach(cid=>{
      const v=scene.canonical[cid];
      const forced=cid===selectedId||cid===currentId;
      if(!inView(v.cx,v.cy)&&!forced) return;
      const pr=poiPriority(v.kind);
      if(!forced&&pr<floor) return;
      const rad=Math.max(num(v.w,10),num(v.h,10))*0.16*s+font*0.45;
      reserved.push({x:v.cx*s+camera.x+padX,y:v.cy*s+camera.y+padY,r:rad});
      items.push({id:cid,world:{x:v.cx,y:v.cy},x:v.cx*s+camera.x+padX,y:v.cy*s+camera.y+padY,
        text:names[cid]||cid,priority:pr+(forced?100:0),r:rad,annoKind:'poi',symbol:v.kind,
        forced,footprint:v});
    });
    scene.streetLabels.forEach(sl=>{
      /* Street names appear only at useful zooms: primaries once the user
         has zoomed into the sheet, secondaries only at deep detail. */
      if(sl.cls==='primary'&&s<0.7) return;
      if(sl.cls!=='primary'&&(tier<2||s<1.2)) return;
      if(!inView(sl.x,sl.y)) return;
      items.push({id:sl.id,world:{x:sl.x,y:sl.y},x:sl.x*s+camera.x+padX,y:sl.y*s+camera.y+padY,
        text:sl.text,priority:1.2,r:font*0.5,annoKind:'street',angle:sl.angle,deg:sl.deg,cls:sl.cls,forced:false});
    });
    const layout=layoutLabels(items,{width:view.width+padX*2,height:view.height+padY*2,dots:reserved,
      fontSize:font,charW:charW,margin:font*0.3});
    const labels=[];
    items.forEach(item=>{
      const p=layout.placements[item.id];
      if(!p) return;
      labels.push({
        id:item.id,text:item.text,annoKind:item.annoKind,symbol:item.symbol,angle:item.angle||0,deg:item.deg||0,
        anchor:{x:item.world.x,y:item.world.y},
        pos:{x:(p.x-padX-camera.x)/s,y:(p.y-padY-camera.y)/s},
        leader:item.leader?{from:{x:item.world.x,y:item.world.y},to:{x:(p.x-padX-camera.x)/s,y:(p.y-padY-camera.y)/s}}:null,
        emphasized:item.forced,cls:item.cls,overlap:p.overlap
      });
    });
    const districtLabels=scene.districts.filter(d=>{
      const c=polyCentroid(d.pts);
      return inView(c.x,c.y);
    }).map(d=>({name:d.name,centroid:polyCentroid(d.pts)}));
    return {labels,districtLabels,overlaps:layout.overlaps,unit:U,scale:s,font};
  }

  /* ---- cartography furniture ---- */
  function scaleBarMarkup(kind){
    const cfg=kind==='settlement'
      ?{label:'200 METERS',note:'MUNICIPAL SURVEY - SCALE OF SHEET AT 1X'}
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
    VERSION,NATIONAL_VIEWBOX,NATIONAL_ZOOM,ZOOM_CONFIG,GESTURE,
    createCamera,clampCamera,zoomAtPoint,panBy,fitBounds,centerOn,viewCenterWorld,viewRectWorld,
    classifyGesture,isDoubleTap,
    rectPoly,polyCentroid,pointInPolygon,polysIntersect,polyPath,linePath,segmentsOf,
    SpatialGrid,generatePerimeterBlock,viewboxPoint,annotationScaleFactor,
    estimateTextSize,rectsIntersect,layoutLabels,labelLeaderPath,seeded,hashSeed,
    nationalLayout,transformY,geoTransform,TERRAIN,nationalGeographyMarkup,regionLabelsMarkup,
    seaLabelsMarkup,routePath,routeMidPoint,nationalTier,nationalKindVisible,settlementTier,patternDefs,
    SETTLEMENT_PLANS,settlementPlan,settlementScene,settlementZoomConfig,
    visualBuildingForCanonicalId,annotationItems,settlementBaseMarkup,
    poiSymbolMarkup,scaleBarMarkup,nationalLegendMarkup,settlementLegendMarkup,legendSwatch,
    generateCorridor,generateShedGrid
  };
})();
