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
  function layout(items, bounds, obstacles=[]) {
    const placed=[];
    items.slice().sort((a,b)=>(b.priority||0)-(a.priority||0)||String(a.id).localeCompare(String(b.id))).forEach(item=>{
      if(item.x<bounds.x||item.x>bounds.x+bounds.w||item.y<bounds.y||item.y>bounds.y+bounds.h)return;
      const candidates=[],r=item.r||3;
      for(const gap of [8,18,32])for(const dy of [0,-item.h-6,item.h+6]) {
        candidates.push({x:item.x+r+gap,y:item.y-item.h/2+dy,w:item.w,h:item.h});
        candidates.push({x:item.x-r-gap-item.w,y:item.y-item.h/2+dy,w:item.w,h:item.h});
      }
      candidates.push({x:item.x-item.w/2,y:item.y-r-item.h-8,w:item.w,h:item.h},{x:item.x-item.w/2,y:item.y+r+8,w:item.w,h:item.h});
      for(const box of candidates) {
        if(box.x<bounds.x||box.y<bounds.y||box.x+box.w>bounds.x+bounds.w||box.y+box.h>bounds.y+bounds.h)continue;
        if(placed.some(p=>overlap(box,p.box)))continue;
        if(obstacles.some(p=>Math.hypot(Math.max(box.x-p.x,0,p.x-box.x-box.w),Math.max(box.y-p.y,0,p.y-box.y-box.h))<(p.r||3)+3))continue;
        const end={x:Math.max(box.x,Math.min(box.x+box.w,item.x)),y:Math.max(box.y,Math.min(box.y+box.h,item.y))};
        const distance=Math.hypot(end.x-item.x,end.y-item.y);
        const start={x:item.x+(end.x-item.x)*r/distance,y:item.y+(end.y-item.y)*r/distance};
        if(distance-r>70)continue;
        if(placed.some(p=>throughBox(start,end,p.box)||throughBox(p.start,p.end,box)||intersects(start,end,p.start,p.end)))continue;
        if(obstacles.some(p=>p.id!==item.id&&throughBox(start,end,{x:p.x-(p.r||3),y:p.y-(p.r||3),w:2*(p.r||3),h:2*(p.r||3)})))continue;
        placed.push({id:item.id,box,start,end});break;
      }
    });
    return placed;
  }
  global.SceneLabelLayout={layout,intersects,throughBox,overlap};
})(globalThis);
