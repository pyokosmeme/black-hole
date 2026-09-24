/* Screen-space labels: bounded boxes, short leaders, no crossed callouts.
 *
 * Two entry points share one geometry test:
 *  - layout(items,bounds,obstacles) solves a single frame (legacy callers).
 *  - createTracker() keeps labels attached to moving 3D anchors. A label keeps
 *    its slot (side and gap, measured from the anchor) for as long as that slot
 *    stays valid, so it moves rigidly with its object while the camera orbits.
 *    Only an invalid slot triggers a new search; the painted box then slides to
 *    the new slot in anchor-relative space, and a label with no room fades out
 *    instead of teleporting. When the camera rests, one tidy-up pass may move a
 *    label to a clearly better slot. */
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
  function boxHitsArcs(box,arcs,anchor,slack=0) {
    for(const arc of arcs){
      const R=arc.r+3-slack;
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
      // Opaque hulls grant a shallow rim-hug only for the anchor's own disc:
      // a box may bite a few px into its own hull/marker so labels sit tight
      // against the outline, but may never drive deep across the surface.
      if(own){
        const depth=R-Math.hypot(arc.x-cx,arc.y-cy);
        if(depth<=Math.max(6,arc.r*.18))continue;
        return true;
      }
      return true;
    }
    return false;
  }
  const anchorOf = item => ({x:item.anchorX==null?item.x:item.anchorX,y:item.anchorY==null?item.y:item.anchorY});
  // Leader endpoints for a box: from the anchor's visible rim to the nearest
  // point of the box. An anchor inside an opaque disc (marker center, hull
  // interior from this angle) starts at the smallest containing disc's rim so
  // the callout emerges from the visible edge; inside translucent glow the
  // body's own radius is used instead.
  function leaderFor(item,anchor,box,arcs) {
    const r=item.r||3;
    const end={x:Math.max(box.x,Math.min(box.x+box.w,anchor.x)),y:Math.max(box.y,Math.min(box.y+box.h,anchor.y))};
    const distance=Math.max(.001,Math.hypot(end.x-anchor.x,end.y-anchor.y));
    let start={x:anchor.x+(end.x-anchor.x)*r/distance,y:anchor.y+(end.y-anchor.y)*r/distance};
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
    // `from` is where the painted line begins. Callers that draw the leader
    // from a point on the surface (item.leaderFromAnchor, e.g. a dot on a
    // ship hull) get crossing tests on that whole painted segment; length
    // and disc tests still use the visible run from the rim.
    return {start,end,distance,from:item.leaderFromAnchor?anchor:start};
  }
  // Candidate slots are descriptors, not pixels: side + gap measured from the
  // anchor's current rim. Re-evaluating a descriptor on the next frame keeps
  // the label at the same place relative to its (moving, growing) object.
  function candidateSlots(item,arcs,anchor) {
    // preferCenter: the caller already computed an ideal box centered on
    // (x,y), e.g. a hull callout pushed radially outside the silhouette.
    const slots=item.preferCenter?[{k:'C'}]:[];
    const gaps=item.maxLeader>70?[8,18,32,52,80,120,170,240]:[8,18,32,52];
    for(const gap of gaps)for(const v of [0,-1,1]){slots.push({k:'R',gap,v});slots.push({k:'L',gap,v});}
    slots.push({k:'T'},{k:'B'});
    // A ring of extra slots just past the nearest obstacle disc when the
    // anchor is crowded against it (route hubs, hull noses), so dense knot
    // views still find placement outside the tangle.
    const knot=nearestKnot(arcs,anchor);
    if(knot&&Math.hypot(anchor.x-knot.x,anchor.y-knot.y)-knot.r<20){
      // Knot slots are polar about the disc: a fixed bearing and a gap past
      // its rim, so a parked name rides the rim as the disc moves and grows.
      // The bearing is fixed when the slot is chosen; deriving it from the
      // anchor each frame swung it wildly once an off-screen anchor was
      // clamped to the frame edge.
      const out=Math.atan2(anchor.y-knot.y,anchor.x-knot.x);
      for(const dr of [10,26,48])for(const da of [-.6,-.3,0,.3,.6])slots.push({k:'K',knot:knot.id==null?null:knot.id,dr,a:out+da});
    }
    return slots;
  }
  function nearestKnot(arcs,anchor) {
    let knot=null,knotGap=Infinity;
    for(const arc of arcs){const gap=Math.hypot(anchor.x-arc.x,anchor.y-arc.y)-arc.r;if(gap<knotGap){knotGap=gap;knot=arc;}}
    return knot;
  }
  function slotBox(item,slot,anchor,arcs) {
    const r=item.r||3,w=item.w,h=item.h;
    if(slot.k==='C')return {x:item.x-w/2,y:item.y-h/2,w,h};
    if(slot.k==='R')return {x:item.x+r+slot.gap,y:item.y-h/2+slot.v*(h+6),w,h};
    if(slot.k==='L')return {x:item.x-r-slot.gap-w,y:item.y-h/2+slot.v*(h+6),w,h};
    if(slot.k==='T')return {x:item.x-w/2,y:item.y-r-h-8,w,h};
    if(slot.k==='B')return {x:item.x-w/2,y:item.y+r+8,w,h};
    const knot=slot.knot!=null?arcs.find(arc=>arc.id===slot.knot):nearestKnot(arcs,anchor);
    if(!knot)return null;
    const rr=knot.r+slot.dr;
    return {x:knot.x+Math.cos(slot.a)*rr-w/2,y:knot.y+Math.sin(slot.a)*rr-h/2,w,h};
  }
  const sameSlot = (a,b) => a.k===b.k&&a.gap===b.gap&&a.v===b.v&&a.knot===b.knot&&a.dr===b.dr&&a.a===b.a;
  const slotSide = (slot,box,anchor) => slot.k!=='K'?slot.k:(box&&box.x+box.w/2>=anchor.x?'R':'L');
  // Every rule a painted label must satisfy against the scene and the labels
  // already placed this frame. Returns leader geometry, or null if invalid.
  // `slack` (px) is hysteresis for a label that already holds this slot: it
  // may keep a slightly tighter clearance than a new placement needs, so it
  // does not flip back and forth at the exact edge of a conflict.
  function evaluate(item,box,anchor,ctx,slack=0) {
    const {bounds,placed,obstacles,arcs,rects}=ctx;
    if(box.x<bounds.x-slack||box.y<bounds.y-slack||box.x+box.w>bounds.x+bounds.w+slack||box.y+box.h>bounds.y+bounds.h+slack)return null;
    if(placed.some(p=>overlap(box,p.box,Math.max(0,4-slack))))return null;
    // Overlay panels (legend, map controls, headings) are rect:1 obstacles.
    if(rects.some(q=>overlap(box,q,Math.max(0,3-slack))))return null;
    // Legacy square hit-test: point obstacles only. Arc discs are handled
    // exactly by boxHitsArcs below.
    if(obstacles.some(p=>!p.arc&&!p.rect&&Math.hypot(Math.max(box.x-p.x,0,p.x-box.x-box.w),Math.max(box.y-p.y,0,p.y-box.y-box.h))<(p.r||3)+3-slack))return null;
    if(arcs.length&&boxHitsArcs(box,arcs,anchor,slack))return null;
    const {start,end,distance,from}=leaderFor(item,anchor,box,arcs);
    if(Math.hypot(end.x-start.x,end.y-start.y)>(item.maxLeader||70)+slack*4)return null;
    if(placed.some(p=>throughBox(from,end,p.box)||throughBox(p.from,p.end,box)||intersects(from,end,p.from,p.end)))return null;
    if(rects.some(q=>throughBox(from,end,q)))return null;
    // Square leader test covers point obstacles only; arc discs are handled
    // exactly by leaderHitsArcs. Testing a large disc's bounding square here
    // would reject leaders that never touch the circle.
    if(!item.ignoreLeaderObstacles&&obstacles.some(p=>!p.arc&&!p.rect&&p.id!==item.id&&throughBox(start,end,{x:p.x-(p.r||3),y:p.y-(p.r||3),w:2*(p.r||3),h:2*(p.r||3)})))return null;
    if(!item.ignoreArcLeaders&&leaderHitsArcs(start,end,arcs,anchor))return null;
    return {start,end,distance,from};
  }
  // A label whose anchor drifted just outside the padded bounds (a big hull
  // disc, a marker at the frame edge) still deserves placement: clamp it into
  // view instead of dropping the name entirely. Returns false to skip.
  function fitAnchor(item,bounds) {
    if(item.x>=bounds.x&&item.x<=bounds.x+bounds.w&&item.y>=bounds.y&&item.y<=bounds.y+bounds.h)return true;
    if(item.clampAnchor===false||item.anchorX==null)return false;
    item.anchorX=Math.max(bounds.x+2,Math.min(bounds.x+bounds.w-2,item.anchorX));
    item.anchorY=Math.max(bounds.y+2,Math.min(bounds.y+bounds.h-2,item.anchorY));
    item.x=item.anchorX;item.y=item.anchorY;
    return true;
  }
  function centerBias(item,box,bounds) {
    return item.centerBias?Math.hypot(box.x+box.w/2-(bounds.x+bounds.w/2),box.y+box.h/2-(bounds.y+bounds.h/2)):0;
  }
  function layout(items,bounds,obstacles=[]) {
    const placed=[],arcs=obstacles.filter(p=>p.arc&&p.r>0),rects=obstacles.filter(p=>p.rect),ctx={bounds,placed,obstacles,arcs,rects};
    items.slice().sort((a,b)=>(b.priority||0)-(a.priority||0)||String(a.id).localeCompare(String(b.id))).forEach(item=>{
      if(!fitAnchor(item,bounds))return;
      const anchor=anchorOf(item);
      const boxes=[];
      if(item.previous)boxes.push({x:item.previous.x,y:item.previous.y,w:item.w,h:item.h});
      candidateSlots(item,arcs,anchor).forEach(slot=>boxes.push(slotBox(item,slot,anchor,arcs)));
      let best=null;
      for(const box of boxes){
        const ev=box&&evaluate(item,box,anchor,ctx);if(!ev)continue;
        const moved=item.previous?Math.hypot(box.x-item.previous.x,box.y-item.previous.y):0;
        const score=ev.distance+moved*.45+centerBias(item,box,bounds);
        if(!best||score<best.score)best={box,start:ev.start,end:ev.end,from:ev.from,score};
      }
      if(best)placed.push({id:item.id,box:best.box,start:best.start,end:best.end,from:best.from});
    });
    return placed;
  }

  function createTracker(options) {
    const opts=Object.assign({
      settleMs:260,    // camera rest before the tidy-up pass
      spring:20,       // rad/s; critically damped slide to a new slot (~0.2s)
      fadeInMs:120, fadeOutMs:80,
      retryMs:280,     // a label that lost its room waits before re-trying mid-motion
      switchMargin:20, // tidy-up only moves a label for a clearly shorter leader
      sideMargin:12,   // prefer staying on the same side of the object
      motionEps:.35,
      keepSlack:3,     // hysteresis (px) before a held slot counts as blocked
      jumpPx:10,       // a held slot moving further than this in a frame slides
      minLeader:5      // shorter leaders read as stubs; the label touches its object
    },options||{});
    const reduced=global.matchMedia?global.matchMedia('(prefers-reduced-motion: reduce)'):null;
    const state=new Map();
    let lastTime=null,lastMotion=-Infinity,settled=true;
    function update(items,bounds,obstacles=[],now) {
      now=now==null?performance.now():now;
      const instant=reduced&&reduced.matches;
      const dt=lastTime==null?16:Math.max(0,Math.min(100,now-lastTime));lastTime=now;
      const arcs=obstacles.filter(p=>p.arc&&p.r>0),rects=obstacles.filter(p=>p.rect),placed=[],ctx={bounds,placed,obstacles,arcs,rects};
      let moving=false;
      for(const item of items){
        const s=state.get(item.id),a=anchorOf(item);
        if(s&&s.anchor&&(Math.abs(a.x-s.anchor.x)>opts.motionEps||Math.abs(a.y-s.anchor.y)>opts.motionEps))moving=true;
      }
      if(moving){lastMotion=now;settled=false;}
      const tidy=!settled&&now-lastMotion>=opts.settleMs;
      // Placement order: explicit tier (selection first), then labels already
      // on screen in the order they appeared, then newcomers by priority. A
      // depth- or priority-ordered pass let two visible neighbours trade the
      // same gap back and forth as their depth order flipped mid-orbit.
      const rank=item=>{const s=state.get(item.id);return s&&s.shown?s.since:Infinity;};
      const order=items.slice().sort((a,b)=>(b.tier||0)-(a.tier||0)||rank(a)-rank(b)||(b.priority||0)-(a.priority||0)||String(a.id).localeCompare(String(b.id)));
      const targets=new Map();
      for(const item of order){
        let s=state.get(item.id);
        if(!s){s={slot:null,shown:false,since:Infinity,alpha:0,off:null,v:null,anchor:null,hiddenAt:-Infinity};state.set(item.id,s);}
        // hold: the caller lost this label's anchor (e.g. the part turned out
        // of view); fade it out where it stands instead of re-placing it.
        const fits=!item.hold&&fitAnchor(item,bounds);
        const anchor=anchorOf(item);
        s.anchor=anchor;
        let choice=null,current=null;
        if(fits&&s.slot&&s.shown){
          const box=slotBox(item,s.slot,anchor,arcs),ev=box&&evaluate(item,box,anchor,ctx,opts.keepSlack);
          current=box;
          if(ev)choice={slot:s.slot,box,ev,score:ev.distance+centerBias(item,box,bounds)};
        }
        const waiting=!s.shown&&moving&&now-s.hiddenAt<opts.retryMs;
        if(fits&&!waiting&&(!choice||tidy)){
          const side=s.slot&&slotSide(s.slot,current,anchor);
          let best=null;
          for(const slot of candidateSlots(item,arcs,anchor)){
            const box=slotBox(item,slot,anchor,arcs),ev=box&&evaluate(item,box,anchor,ctx);if(!ev)continue;
            let score=ev.distance+centerBias(item,box,bounds);
            if(side&&slotSide(slot,box,anchor)!==side)score+=opts.sideMargin;
            if(!best||score<best.score)best={slot,box,ev,score};
          }
          if(best&&(!choice||best.score<choice.score-opts.switchMargin))choice=best;
        }
        if(choice){
          placed.push({id:item.id,box:choice.box,start:choice.ev.start,end:choice.ev.end,from:choice.ev.from});
          if(s.slot&&!sameSlot(s.slot,choice.slot))s.retarget=true;
          s.slot=choice.slot;
          // A label appearing from nothing starts at its slot; one already on
          // screen slides there from wherever it is painted.
          if(!s.shown&&(s.alpha<.05||!s.off)){s.off=null;s.retarget=false;}
          if(!s.shown)s.since=now;
          s.shown=true;
          targets.set(item.id,{x:choice.box.x-anchor.x,y:choice.box.y-anchor.y});
        } else if(s.shown){s.shown=false;s.since=Infinity;s.hiddenAt=now;}
      }
      if(tidy)settled=true;
      // A label on an unchanged slot is painted exactly at that slot, so it is
      // rigidly attached to its object (and its rim) through orbit and zoom.
      // A slot change leaves a residual offset that decays on an exact
      // critically damped spring: velocity stays continuous, so a slide that
      // starts or retargets mid-orbit never kicks the label.
      const t=dt/1000,w=opts.spring,decay=Math.exp(-w*t);
      let animating=!settled;
      const labels=[];
      for(const item of items){
        const s=state.get(item.id),target=targets.get(item.id),anchor=s.anchor;
        if(target){
          // Teleport guard: a held slot whose geometry leaps in one frame
          // (a caller's preferred box flipping sides, a knot disc swapping)
          // is animated like a slot change instead of being painted there.
          if(s.target&&!s.retarget&&Math.hypot(target.x-s.target.x,target.y-s.target.y)>opts.jumpPx)s.retarget=true;
          s.target=target;
          if(!s.off||instant){s.d={x:0,y:0};s.v={x:0,y:0};}
          else if(s.retarget){s.d={x:s.off.x-target.x,y:s.off.y-target.y};s.v=s.v||{x:0,y:0};}
          s.retarget=false;
          const d=s.d||(s.d={x:0,y:0}),v=s.v||(s.v={x:0,y:0});
          if(Math.abs(d.x)<.3&&Math.abs(d.y)<.3&&Math.abs(v.x)<6&&Math.abs(v.y)<6){d.x=d.y=v.x=v.y=0;}
          else{
            const cx=v.x+w*d.x,cy=v.y+w*d.y;
            d.x=(d.x+cx*t)*decay;d.y=(d.y+cy*t)*decay;
            v.x=(v.x-w*cx*t)*decay;v.y=(v.y-w*cy*t)*decay;
            animating=true;
          }
          s.off={x:target.x+d.x,y:target.y+d.y};
        }
        const want=s.shown?1:0,tau=s.shown?opts.fadeInMs:opts.fadeOutMs;
        const fade=instant?1:1-Math.exp(-dt/tau);
        if(Math.abs(want-s.alpha)<.02)s.alpha=want;else{s.alpha+=(want-s.alpha)*fade;animating=true;}
        if(!s.off||s.alpha<=.01){labels.push({id:item.id,item,visible:false,placed:false});continue;}
        const box={x:anchor.x+s.off.x,y:anchor.y+s.off.y,w:item.w,h:item.h};
        const line=leaderFor(item,anchor,box,arcs);
        const leader=Math.hypot(line.end.x-line.start.x,line.end.y-line.start.y)>=opts.minLeader?{x1:line.from.x,y1:line.from.y,x2:line.end.x,y2:line.end.y}:null;
        labels.push({id:item.id,item,visible:true,placed:s.shown,slot:s.slot,x:box.x,y:box.y,w:box.w,h:box.h,alpha:s.alpha,anchor,leader});
      }
      // Forget labels that were not offered this frame (culled, labels off,
      // view changed); they fade in fresh when they return.
      const offered=new Set(items.map(item=>item.id));
      for(const id of [...state.keys()])if(!offered.has(id))state.delete(id);
      return {labels,animating};
    }
    return {update,reset:()=>{state.clear();lastTime=null;lastMotion=-Infinity;settled=true;}};
  }

  // Visible overlay elements (legend, controls, headings) as rect obstacles
  // in `host` coordinates, so labels never slide underneath map chrome.
  function overlayRects(host,elements) {
    const origin=host.getBoundingClientRect(),rects=[];
    elements.forEach(el=>{
      if(!el||el.hidden)return;
      const r=el.getBoundingClientRect();
      if(r.width<1||r.height<1)return;
      rects.push({rect:1,x:r.left-origin.left,y:r.top-origin.top,w:r.width,h:r.height});
    });
    return rects;
  }

  global.SceneLabelLayout={layout,createTracker,overlayRects,intersects,throughBox,overlap};
})(globalThis);
