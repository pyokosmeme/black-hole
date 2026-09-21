/* Screen-space labels: bounded boxes, short leaders, no crossed callouts. */
(function (global) {
  'use strict';
  const overlap = (a,b,p=4) => a.x < b.x+b.w+p && a.x+a.w+p > b.x && a.y < b.y+b.h+p && a.y+a.h+p > b.y;
  const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  function intersects(a,b,c,d) {
    const eps=.001;
    if(Math.max(a.x,b.x)+eps<Math.min(c.x,d.x)||Math.max(c.x,d.x)+eps<Math.min(a.x,b.x)||Math.max(a.y,b.y)+eps<Math.min(c.y,d.y)||Math.max(c.y,d.y)+eps<Math.min(a.y,b.y))return false;
    return cross(a,b,c)*cross(a,b,d)<=eps && cross(c,d,a)*cross(c,d,b)<=eps;
  }
  function throughBox(a,b,box) {
    const p=[{x:box.x-2,y:box.y-2},{x:box.x+box.w+2,y:box.y-2},{x:box.x+box.w+2,y:box.y+box.h+2},{x:box.x-2,y:box.y+box.h+2}];
    return p.some((v,i)=>intersects(a,b,v,p[(i+1)%4]));
  }
  // Scene discs (hulls, route knots, glow) that boxes must clear and leaders
  // must not pierce. Obstacles with arc:1 describe filled circles rather than
  // hit-test squares; ghost:1 discs (translucent glow) repel boxes but let
  // leader lines pass.
  // Leader vs discs. A disc that contains the anchor is the anchor's own
  // hull/knot: the callout may leave it, but only toward the same side the
  // anchor sits on, so a label can never land on the far side of the thing
  // it is pointing at. Every other disc must not be touched at all.
  function leaderHitsArcs(start,end,arcs,anchor) {
    for(const arc of arcs){
      if(arc.ghost)continue;
      const R=arc.r+2;
      const dAnchor=Math.hypot(anchor.x-arc.x,anchor.y-arc.y);
      if(dAnchor<=arc.r+2){
        const ex=end.x-arc.x,ey=end.y-arc.y,ax=anchor.x-arc.x,ay=anchor.y-arc.y;
        if(ex*ax+ey*ay<-arc.r*arc.r*.5)return true;
        continue;
      }
      if(Math.max(start.x,end.x)<arc.x-R||Math.min(start.x,end.x)>arc.x+R||Math.max(start.y,end.y)<arc.y-R||Math.min(start.y,end.y)>arc.y+R)continue;
      const steps=Math.max(4,Math.ceil(Math.hypot(end.x-start.x,end.y-start.y)/6));
      for(let i=0;i<=steps;i++){
        const px=start.x+(end.x-start.x)*i/steps,py=start.y+(end.y-start.y)*i/steps;
        if(Math.hypot(px-arc.x,py-arc.y)<R)return true;
      }
    }
    return false;
  }
  // Exact box-vs-disc test. The anchor's own disc is exempt when the box
  // merely overlaps its rim from the anchor's side, so hull labels can hug
  // their hull; the box may never cover the disc's center.
  function boxHitsArcs(box,arcs,anchor) {
    for(const arc of arcs){
      const R=arc.r+3;
      const own=Math.hypot(anchor.x-arc.x,anchor.y-arc.y)<=arc.r+2;
      const cx=Math.max(box.x,Math.min(arc.x,box.x+box.w)),cy=Math.max(box.y,Math.min(arc.y,box.y+box.h));
      if(Math.hypot(arc.x-cx,arc.y-cy)>=R)continue;
      // Translucent glow: repel outside boxes, but a body that lives inside
      // the glow (inner planets at close range) still needs a name near
      // itself — treat the glow as its own disc there.
      if(arc.ghost){
        if(Math.hypot(anchor.x-arc.x,anchor.y-arc.y)<=arc.r+2){
          const depth=R-Math.hypot(arc.x-cx,arc.y-cy);
          if(depth<=Math.max(6,arc.r*.18))continue;
        }
        return true;
      }
      // Opaque hulls grant a shallow rim-hug only for the anchor's own disc.
      if(own){
        // Shallow rim-hug only: a box may bite a few px into its own
        // hull/marker disc so labels sit tight against the outline, but it
        // may never drive deep across the surface.
        const depth=R-Math.hypot(arc.x-cx,arc.y-cy);
        if(depth<=Math.max(6,arc.r*.18))return false;
        return true;
      }
      return true;
    }
    return false;
  }
  function layout(items, bounds, obstacles=[]) {
    const placed=[];
    const arcs=obstacles.filter(p=>p.arc&&p.r>0);
    const homeX=bounds.x+bounds.w/2,homeY=bounds.y+bounds.h/2;
    items.slice().sort((a,b)=>(b.priority||0)-(a.priority||0)||String(a.id).localeCompare(String(b.id))).forEach(item=>{
      // A label whose anchor drifted just outside the padded bounds (a big
      // hull disc, a marker at the frame edge) still deserves placement:
      // clamp it into view instead of dropping the name entirely.
      if(item.x<bounds.x||item.x>bounds.x+bounds.w||item.y<bounds.y||item.y>bounds.y+bounds.h){
        if(item.clampAnchor!==false&&item.anchorX!=null){
          item.anchorX=Math.max(bounds.x+2,Math.min(bounds.x+bounds.w-2,item.anchorX));
          item.anchorY=Math.max(bounds.y+2,Math.min(bounds.y+bounds.h-2,item.anchorY));
          item.x=item.anchorX;item.y=item.anchorY;
        } else return;
      }
      const candidates=[],r=item.r||3;
      const anchor={x:item.anchorX==null?item.x:item.anchorX,y:item.anchorY==null?item.y:item.anchorY};
      // Keep a viable prior location in the candidate set. This makes a slow
      // orbit feel continuous instead of flipping a label between sides every
      // time a neighbour moves by a pixel.
      if(item.previous)candidates.push({x:item.previous.x,y:item.previous.y,w:item.w,h:item.h});
      const gaps=item.maxLeader>70?[8,18,32,52,80,120,170,240]:[8,18,32,52];
      for(const gap of gaps)for(const dy of [0,-item.h-6,item.h+6]) {
        candidates.push({x:item.x+r+gap,y:item.y-item.h/2+dy,w:item.w,h:item.h});
        candidates.push({x:item.x-r-gap-item.w,y:item.y-item.h/2+dy,w:item.w,h:item.h});
      }
      candidates.push({x:item.x-item.w/2,y:item.y-r-item.h-8,w:item.w,h:item.h},{x:item.x-item.w/2,y:item.y+r+8,w:item.w,h:item.h});
      // Push a ring of extra candidates just past the nearest obstacle disc
      // when the anchor is crowded against it (route hubs, hull noses), so
      // dense knot views still find placement outside the tangle.
      let knot=null,knotGap=Infinity;
      for(const arc of arcs){const gap=Math.hypot(anchor.x-arc.x,anchor.y-arc.y)-arc.r;if(gap<knotGap){knotGap=gap;knot=arc;}}
      if(knot&&knotGap<20){
        const out=Math.atan2(anchor.y-knot.y,anchor.x-knot.x);
        for(const rr of [knot.r+10,knot.r+26,knot.r+48])for(const da of [-.6,-.3,0,.3,.6]){
          const a2=out+da;
          candidates.push({x:knot.x+Math.cos(a2)*rr-item.w/2,y:knot.y+Math.sin(a2)*rr-item.h/2,w:item.w,h:item.h});
        }
      }
      const viable=[];
      for(const box of candidates) {
        if(box.x<bounds.x||box.y<bounds.y||box.x+box.w>bounds.x+bounds.w||box.y+box.h>bounds.y+bounds.h)continue;
        if(placed.some(p=>overlap(box,p.box)))continue;
        // Legacy square hit-test: point obstacles only. Arc discs are
        // handled exactly by boxHitsArcs below.
        if(obstacles.some(p=>!p.arc&&Math.hypot(Math.max(box.x-p.x,0,p.x-box.x-box.w),Math.max(box.y-p.y,0,p.y-box.y-box.h))<(p.r||3)+3))continue;
        // Arc obstacles: filled scene discs (hulls, glow knots) must not
        // sit under label boxes either — except the anchor's own disc,
        // which boxes may hug on the near side.
        if(arcs.length&&boxHitsArcs(box,arcs,anchor))continue;
        const end={x:Math.max(box.x,Math.min(box.x+box.w,anchor.x)),y:Math.max(box.y,Math.min(box.y+box.h,anchor.y))};
        const distance=Math.max(.001,Math.hypot(end.x-anchor.x,end.y-anchor.y));
        let start={x:anchor.x+(end.x-anchor.x)*r/distance,y:anchor.y+(end.y-anchor.y)*r/distance};
        // An anchor inside an arc disc (marker center, hull interior from
        // this angle, or deep inside a translucent glow) draws its leader
        // from the smallest containing disc's rim outward, so the callout
        // emerges from the visible edge instead of doubling back through
        // the interior. maxLeader then bounds the leader the user actually
        // sees (rim to box), not the interior run — except inside ghost
        // glow, where a label near its body beats leader purity.
        if(arcs.length){
          let rim=null,inGhost=false;
          for(const arc of arcs){
            if(Math.hypot(anchor.x-arc.x,anchor.y-arc.y)<=arc.r+2){
              if(arc.ghost)inGhost=true;
              if(!rim||arc.r<rim.r)rim=arc;
            }
          }
          if(rim&&!inGhost){
            const vx=end.x-rim.x,vy=end.y-rim.y,vl=Math.hypot(vx,vy)||1;
            start={x:rim.x+vx/vl*rim.r,y:rim.y+vy/vl*rim.r};
          }
        }
        if(Math.hypot(end.x-start.x,end.y-start.y)>(item.maxLeader||70))continue;
        if(placed.some(p=>throughBox(start,end,p.box)||throughBox(p.start,p.end,box)||intersects(start,end,p.start,p.end)))continue;
        // Square leader test covers point obstacles only; arc discs are
        // handled exactly by leaderHitsArcs below. Testing a large disc's
        // bounding square here would reject leaders that never touch the
        // circle and starve labels anchored just inside big glow discs.
        if(!item.ignoreLeaderObstacles&&obstacles.some(p=>!p.arc&&p.id!==item.id&&throughBox(start,end,{x:p.x-(p.r||3),y:p.y-(p.r||3),w:2*(p.r||3),h:2*(p.r||3)})))continue;
        // Leaders must not pierce hull discs / route knots either. The
        // anchor's own disc allows an exit toward its own side only.
        // (ignoreArcLeaders lets a caller keep the legacy square-leader
        // test disabled while still enforcing disc clearance.)
        if(!item.ignoreArcLeaders&&leaderHitsArcs(start,end,arcs,anchor))continue;
        const previous=item.previous?Math.hypot(box.x-item.previous.x,box.y-item.previous.y):0;
        const centerBias=item.centerBias?Math.hypot(box.x+box.w/2-homeX,box.y+box.h/2-homeY):0;
        viable.push({box,start,end,score:distance+previous*.45+centerBias});
      }
      if(viable.length){
        viable.sort((a,b)=>a.score-b.score);
        const best=viable[0];
        placed.push({id:item.id,box:best.box,start:best.start,end:best.end});
      }
    });
    return placed;
  }
  global.SceneLabelLayout={layout,intersects,throughBox,overlap};
})(globalThis);
