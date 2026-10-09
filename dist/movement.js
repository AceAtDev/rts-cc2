import {ignoreWorkerCollision} from './workers.js';
import {contactPoint} from './geometry.js';
import {turnTowards} from './unit-profiles.js';

// Custom local crowd solver, not Blizzard's navigation implementation.
export function createMovement({entities,world,clear,openPoint,path,navVersion}) {
  let cells=new Map(), requests=0;
  const length=(x,y)=>Math.hypot(x,y);
  const dist=(a,b)=>length(a.x-b.x,a.y-b.y);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function begin() {
    requests=0;cells=new Map();
    for(const e of entities()) if(!e.building&&!e.loadedIn&&!e.insideRefinery&&e.hp>0&&!e.flying) {
      const key=Math.floor(e.x/56)+','+Math.floor(e.y/56);
      if(!cells.has(key))cells.set(key,[]);cells.get(key).push(e);
    }
  }
  function neighbors(e) {
    const out=[],x=Math.floor(e.x/56),y=Math.floor(e.y/56);
    for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)out.push(...(cells.get(xx+','+yy)||[]));
    return out;
  }
  function move(e,point,dt,stopAt=3) {
    if(e.sieged||e.transform||e.loadedIn)return false;
    // The destination is shared during travel; individual footprint reservations
    // are used only on approach. Mixed-speed units retain their own speed.
    const reservation=e.order?.arrival;
    let p=reservation&&dist(e,point)<(e.order.arrivalRadius||0)+65?reservation:point;
    if(p.footprint&&stopAt>5){
      const target=p,padding=Math.max(e.r+.1,stopAt-p.r),version=navVersion();
      if(e.interaction?.target!==target||e.interaction.version!==version||e.interaction.padding!==padding||e.interaction.x!==target.x||e.interaction.y!==target.y){
        let goal=contactPoint(e,target,padding);
        if(!openPoint(goal,e.r)){
          let best=null,cost=Infinity;
          for(let i=0;i<32;i++){
            const a=i*Math.PI/16,probe={x:target.x+Math.cos(a)*(target.r+padding+60),y:target.y+Math.sin(a)*(target.r+padding+60)},q=contactPoint(probe,target,padding);
            if(!openPoint(q,e.r))continue;
            const score=dist(e,q)+(clear(e,q,e.r)?0:target.r);
            if(score<cost){cost=score;best=q;}
          }
          if(best)goal=best;
        }
        e.interaction={target,goal,version,padding,x:target.x,y:target.y};
      }
      p=e.interaction.goal;stopAt=1;
    }
    const d=dist(e,p),tolerance=stopAt+1;
    if(d<=tolerance){e.vx=e.vy=0;e.nav=null;return true;}
    let goal=p;
    if(stopAt>5){const k=(d-stopAt)/d;goal={x:e.x+(p.x-e.x)*k,y:e.y+(p.y-e.y)*k};}
    let dest=goal;
    if(!e.flying&&!clear(e,goal,e.r)) {
      const key=Math.round(goal.x/14)+','+Math.round(goal.y/14)+','+navVersion();
      if(!e.nav||e.navKey!==key) {
        let shared=null;
        const corridor=e.order?.corridor;
        if(corridor?.length&&e.order.corridorVersion===navVersion()) {
          const entry=corridor.findIndex(p=>clear(e,p,e.r));
          if(entry>=0){shared=corridor.slice(entry).map(p=>({...p}));const before=shared[shared.length-2]||e;if(clear(before,goal,e.r))shared[shared.length-1]={...goal};else shared=null;}
        }
        if(shared){e.nav=shared;e.navKey=key;}
        else if(requests<4){
          requests++;e.nav=path(e,goal);e.navKey=key;
          // An open contact point can lie in a sealed pocket between fields.
          // Select a reachable face instead of retrying that pocket forever.
          if(!e.nav.length&&e.interaction?.target===point){
            const target=point,candidates=[];
            for(let i=0;i<32;i++){
              const angle=i*Math.PI/16,probe={x:target.x+Math.cos(angle)*(target.r+e.interaction.padding+60),y:target.y+Math.sin(angle)*(target.r+e.interaction.padding+60)},q=contactPoint(probe,target,e.interaction.padding);
              if(openPoint(q,e.r))candidates.push(q);
            }
            candidates.sort((a,b)=>dist(e,a)-dist(e,b));
            for(const q of candidates){const route=path(e,q);if(route.length){e.interaction.goal=q;e.nav=route;e.navKey=null;return false;}}
          }
        }
        else {e.vx=e.vy=0;return false;}
      }
      if(!e.nav?.length){e.vx=e.vy=0;return false;}
      while(e.nav.length>1&&dist(e,e.nav[0])<8)e.nav.shift();
      for(let i=e.nav.length-1;i>0;i--)if(clear(e,e.nav[i],e.r)){e.nav.splice(0,i);break;}
      dest=e.nav[0];
    }
    let dx=dest.x-e.x,dy=dest.y-e.y,len=length(dx,dy);
    if(len<.001){e.nav=null;return false;}
    const speed=e.speed*(e.stim?1.5:1)*(e.slow? .5:1);
    let vx=dx/len*speed,vy=dy/len*speed;
    const ux=vx/speed,uy=vy/speed;
    if(!e.flying)for(const b of neighbors(e)) {
      if(b===e||b.hp<=0||b.insideRefinery||ignoreWorkerCollision(e,b))continue;
      const bx=b.x-e.x,by=b.y-e.y,dd=length(bx,by),gap=e.r+b.r+.5;
      if(dd<.001)continue;
      const forward=bx*ux+by*uy,cross=bx*uy-by*ux;
      const settled=b.arrived&&b.arrivalBatch&&b.arrivalBatch===e.arrivalBatch&&!b.order;
      const anchored=b.hold||b.sieged||b.team!==e.team;
      const bv=length(b.vx||0,b.vy||0),sameDirection=bv>3&&((b.vx*ux+b.vy*uy)/bv)>.75;
      if(!anchored&&!b.order&&!b.combatTarget&&forward>0&&forward<gap+speed*.4&&Math.abs(cross)<gap+2) {
        const side=Math.abs(cross)>1?(cross>=0?-1:1):(b.id%2?1:-1);
        const yieldStep=speed*(settled?.15:.8)*dt;
        const yieldPoint={x:b.x-uy*side*yieldStep,y:b.y+ux*side*yieldStep};
        if(openPoint(yieldPoint,b.r)){b.x=yieldPoint.x;b.y=yieldPoint.y;}
      }
      // Anticipate crossing traffic and anchored units. Ordinary idle allies
      // can yield through the contact solver, so they do not become walls.
      if(forward>0&&forward<gap+speed*.32&&Math.abs(cross)<gap+2&&(!sameDirection&&(anchored||bv>3))) {
        const side=Math.abs(cross)>1?(cross>=0?1:-1):1;
        const force=speed*.85*(1-Math.abs(cross)/(gap+2))*clamp((gap+speed*.32-forward)/(speed*.32),0,1);
        vx+=-uy*side*force;vy+=ux*side*force;
      }
      if(dd<gap+3) {
        const force=speed*.5*clamp((gap+3-dd)/(gap+3),0,1);
        vx-=bx/dd*force;vy-=by/dd*force;
      }
    }
    const vl=length(vx,vy);if(vl>speed){vx*=speed/vl;vy*=speed/vl;}
    // Brake within this frame, rather than applying a long exponential arrival
    // tail. This also prevents a fast unit overshooting a queued waypoint.
    const remaining=Math.max(0,d-stopAt),limit=remaining/dt;
    const desired=length(vx,vy);if(desired>limit){vx*=limit/desired;vy*=limit/desired;}
    const oldSpeed=length(e.vx,e.vy),newSpeed=length(vx,vy);
    const accel=(newSpeed>oldSpeed?e.acceleration:e.lateralAcceleration)||100000;
    const reversing=vx*e.vx+vy*e.vy<0&&e.acceleration>10000;
    const change=length(vx-e.vx,vy-e.vy),blend=reversing?1:Math.min(1,accel*dt/(change||1));
    e.vx+=(vx-e.vx)*blend;e.vy+=(vy-e.vy)*blend;
    let next={x:clamp(e.x+e.vx*dt,e.r,world.w-e.r),y:clamp(e.y+e.vy*dt,e.r,world.h-e.r)};
    if(!e.flying&&!clear(e,next,e.r)) {
      const sx={x:next.x,y:e.y},sy={x:e.x,y:next.y};
      if(clear(e,sx,e.r)){next=sx;e.vy=0;}
      else if(clear(e,sy,e.r)){next=sy;e.vx=0;}
      else {next={x:e.x,y:e.y};e.vx=e.vy=0;e.nav=null;}
    }
    const advanced=dist(e,next);
    e.stuck=advanced<.05?(e.stuck||0)+dt:0;
    if(e.stuck>.6){e.nav=null;e.navKey=null;e.stuck=0;}
    e.x=next.x;e.y=next.y;
    if(length(e.vx,e.vy)>1)e.angle=turnTowards(e.angle,Math.atan2(e.vy,e.vx),e.turnRate||20,dt);
    return false;
  }
  function collision() {
    for(const a of entities())if(!a.building&&!a.loadedIn&&!a.flying&&a.hp>0)for(const b of neighbors(a)) {
      if(b.id<=a.id||b.hp<=0||b.insideRefinery||ignoreWorkerCollision(a,b))continue;
      let dx=a.x-b.x,dy=a.y-b.y,d=length(dx,dy),gap=a.r+b.r+.5;
      if(d>=gap)continue;
      if(d<.001){dx=a.id%2?.01:-.01;dy=.007;d=length(dx,dy);}
      const sameBatch=a.arrivalBatch&&a.arrivalBatch===b.arrivalBatch;
      const anchorA=a.hold||a.sieged||a.transform,anchorB=b.hold||b.sieged||b.transform;
      if(anchorA&&anchorB)continue;
      const movingA=length(a.vx,a.vy)>3,movingB=length(b.vx,b.vy)>3;
      const wa=anchorA?0:anchorB?1:!movingA&&movingB?(sameBatch?.6:.85):!movingB&&movingA?(sameBatch?.4:.15):.5;
      const overlap=(gap-d)*.95;
      for(const [e,f,sign] of [[a,wa,1],[b,1-wa,-1]]) {
        const p={x:clamp(e.x+dx/d*overlap*f*sign,e.r,world.w-e.r),y:clamp(e.y+dy/d*overlap*f*sign,e.r,world.h-e.r)};
        if(openPoint(p,e.r)){e.x=p.x;e.y=p.y;}
      }
    }
  }
  return {begin,neighbors,move,collision};
}

// Compact hexagonal landing positions prevent overlapping footprints without
// forcing a march formation. This is our arrival policy, not an SC2 data field.
export function reserveDestinations(movers,point,reachable) {
  if(movers.length<2)return;
  const spacing=Math.max(...movers.map(m=>m.u.r*2+.75)),slots=[{...point}];
  for(let ring=1;slots.length<movers.length;ring++) {
    for(let side=0;side<6;side++)for(let step=0;step<ring&&slots.length<movers.length;step++) {
      const a=side*Math.PI/3,b=(side+1)*Math.PI/3,t=step/ring;
      slots.push({x:point.x+spacing*ring*(Math.cos(a)*(1-t)+Math.cos(b)*t),y:point.y+spacing*ring*(Math.sin(a)*(1-t)+Math.sin(b)*t)});
    }
  }
  const radius=Math.max(...slots.map(s=>Math.hypot(s.x-point.x,s.y-point.y)));
  for(const m of [...movers].sort((a,b)=>Math.hypot(a.u.x-point.x,a.u.y-point.y)-Math.hypot(b.u.x-point.x,b.u.y-point.y))) {
    let best=0;
    for(let i=1;i<slots.length;i++)if(Math.hypot(m.u.x-slots[i].x,m.u.y-slots[i].y)<Math.hypot(m.u.x-slots[best].x,m.u.y-slots[best].y))best=i;
    m.o.arrival=reachable(slots.splice(best,1)[0],m.u.r);m.o.arrivalRadius=radius;
  }
}
