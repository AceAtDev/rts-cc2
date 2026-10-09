import {surface} from './geometry.js';
import {terrainRadius,turnTowards} from './unit-profiles.js';

// Modern 5.0.14 real-second delay bounds. Geometry/RNG are prototype policies.
export const CONSTRUCTION_DELAY={min:4.64,max:6.07};
export function activeConstructionTarget(worker) {
  const s=worker?.construction,b=s?.target;
  return worker?.type==='worker'&&worker.hp>0&&!worker.loadedIn&&!worker.insideRefinery&&!worker.flying&&s?.phase==='working'&&worker.order===s.order&&
    worker.order?.kind==='build'&&worker.order.target===b&&b?.hp>0&&!b.ready&&b.builder===worker?b:null;
}
export const ignoreConstructionCollision=(a,b)=>!!(activeConstructionTarget(a)||activeConstructionTarget(b));

export function createConstruction({move,clear,clock,seed=0}) {
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function random(s) {
    let n=s.seed;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n>>>0;
    return s.seed/4294967296;
  }
  const wait=s=>CONSTRUCTION_DELAY.min+random(s)*(CONSTRUCTION_DELAY.max-CONSTRUCTION_DELAY.min);
  function release(worker) {
    const s=worker.construction;
    if(!s)return;
    if(s.target.builder===worker&&!s.target.ready)s.target.builder=null;
    worker.construction=null;worker.vx=worker.vy=0;
  }
  function choosePoint(worker,s) {
    const b=s.target,poly=b.footprint;
    // Bounded perimeter sampling prevents placement next to terrain or another
    // building from selecting an unreachable relocation through that obstacle.
    const start=random(s);
    for(let i=0;i<24;i++) {
      const p=(start+i/24)%1;let point;
      if(poly?.length) {
        const edge=p*poly.length,j=Math.floor(edge),f=edge-j;
        const a=poly[j],c=poly[(j+1)%poly.length];
        point={x:b.x+a[0]+(c[0]-a[0])*f,y:b.y+a[1]+(c[1]-a[1])*f};
        const contact=surface(point,b);
        point.x+=contact.nx*.2;point.y+=contact.ny*.2;
      } else point={x:b.x+Math.cos(p*Math.PI*2)*b.r,y:b.y+Math.sin(p*Math.PI*2)*b.r};
      if(distance(worker,point)>worker.r*2&&clear(worker,point,terrainRadius(worker),b))return point;
    }
    return null;
  }
  function relocate(worker,s,dt) {
    const goal=s.point,d=distance(worker,goal);
    if(d<=.2) {
      worker.x=goal.x;worker.y=goal.y;worker.vx=worker.vy=0;s.point=null;s.nextMoveAt=clock()+wait(s);return;
    }
    const wanted=Math.min(worker.speed,d/Math.max(dt,1e-8)),vx=(goal.x-worker.x)/d*wanted,vy=(goal.y-worker.y)/d*wanted;
    const change=Math.hypot(vx-(worker.vx||0),vy-(worker.vy||0));
    const blend=Math.min(1,(worker.acceleration||100000)*dt/(change||1));
    worker.vx=(worker.vx||0)+(vx-(worker.vx||0))*blend;worker.vy=(worker.vy||0)+(vy-(worker.vy||0))*blend;
    const speed=Math.hypot(worker.vx,worker.vy),step=Math.min(d,speed*dt);
    // Each step revalidates terrain. Only the current construction footprint is
    // ignored; an obstacle appearing on the service leg stops that relocation.
    const next={x:worker.x+worker.vx/(speed||1)*step,y:worker.y+worker.vy/(speed||1)*step};
    if(clear(worker,next,terrainRadius(worker),s.target)) {
      worker.x=next.x;worker.y=next.y;
      if(step>0)worker.angle=turnTowards(worker.angle,Math.atan2(worker.vy,worker.vx),worker.turnRate||20,dt);
    } else {worker.vx=worker.vy=0;s.point=null;s.nextMoveAt=clock()+wait(s);}
  }
  function update(worker,dt) {
    const order=worker.order,b=order?.target;
    if(worker.type!=='worker'||worker.hp<=0||worker.loadedIn||worker.insideRefinery||worker.flying||order?.kind!=='build'||!b?.building||b.hp<=0||b.team!==worker.team) {release(worker);return 'invalid';}
    if(b.ready){release(worker);return 'complete';}
    if(worker.construction?.order!==order||worker.construction.target!==b) {
      release(worker);worker.construction={order,target:b,phase:'approach',seed:((worker.id*73856093)^(b.id*19349663)^seed)>>>0||1};
    }
    const s=worker.construction;
    if(b.builder&&b.builder!==worker&&b.builder.hp>0&&b.builder.order?.kind==='build'&&b.builder.order.target===b) {
      // Modern notes guarantee sequential queue acceptance, not execution
      // timing. Conservatively retain the order at ordinary exterior contact
      // until completion or the existing owner yields; never double progress.
      s.phase='waiting';s.point=null;move(worker,b,dt,b.r+worker.r+.2);return 'waiting';
    }
    if(s.phase==='waiting')s.phase='approach';
    b.builder=worker;
    if(s.phase==='approach') {
      if(!move(worker,b,dt,b.r+worker.r+.2))return 'approach';
      s.phase='working';s.nextMoveAt=clock()+wait(s);worker.vx=worker.vy=0;
    }
    if(s.point)relocate(worker,s,dt);
    else if(clock()>=s.nextMoveAt) {
      s.point=choosePoint(worker,s);
      if(s.point)relocate(worker,s,dt);else s.nextMoveAt=clock()+wait(s);
    } else worker.angle=turnTowards(worker.angle,Math.atan2(b.y-worker.y,b.x-worker.x),worker.turnRate||20,dt);
    return 'working';
  }
  return {update,release};
}
