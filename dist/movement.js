import {ignoreWorkerCollision} from './workers.js';
import {ignoreConstructionCollision} from './construction.js';
import {contactPoint,segmentBlocked} from './geometry.js';
import {turnTowards,terrainRadius,SCALE} from './unit-profiles.js';
import {scanDue} from './combat.js';

// Custom local crowd solver, not Blizzard's navigation implementation.
export function createMovement({entities,world,clear,openPoint,path,navVersion,loop=null}) {
  let cells=new Map(), starts=new Map(), requests=0, frame=0, pass=0;
  const arrivals=new Map(); // command batch -> {count, area: sum r^2} of units that completed it
  const settle=(e,batch)=>{const k=arrivals.get(batch)||{count:0,area:0};arrivals.set(batch,{count:k.count+1,area:k.area+e.r*e.r});};
  const length=(x,y)=>Math.hypot(x,y);
  const dist=(a,b)=>length(a.x-b.x,a.y-b.y);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function begin() {
    requests=0;frame++;pass=0;cells=new Map();starts=new Map();path.begin?.();
    for(const e of entities()) if(!e.building&&!e.loadedIn&&!e.insideRefinery&&e.hp>0&&!e.flying) {
      const key=Math.floor(e.x/56)+','+Math.floor(e.y/56);
      starts.set(e,{x:e.x,y:e.y});
      if(!cells.has(key))cells.set(key,[]);cells.get(key).push(e);
    }
  }
  function neighbors(e) {
    const out=[],x=Math.floor(e.x/56),y=Math.floor(e.y/56);
    for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)out.push(...(cells.get(xx+','+yy)||[]));
    return out;
  }
  function availableContact(e,target,radius){
    const startAngle=Math.atan2(e.y-target.y,e.x-target.x);
    const bodies=entities().filter(b=>b!==e&&b!==target&&b.hp>0&&!b.building&&!b.loadedIn&&!b.insideRefinery&&!b.flying&&
      !ignoreWorkerCollision(e,b)&&!ignoreConstructionCollision(e,b)&&dist(b,target)<=radius+e.r+b.r+.5);
    let best=null,cost=Infinity;
    for(let i=0;i<64;i++){
      const angle=startAngle+i*Math.PI/32,q={x:target.x+Math.cos(angle)*radius,y:target.y+Math.sin(angle)*radius};
      if(!openPoint(q,terrainRadius(e)))continue;
      let occupied=false;
      for(const b of bodies){
        const reservation=b.pursuitState?.target===target&&b.pursuitState.order===b.order&&b.pursuitState.angle!==undefined&&dist(b,target)<=b.pursuitState.radius+2;
        const p=reservation?{x:target.x+Math.cos(b.pursuitState.angle)*b.pursuitState.radius,y:target.y+Math.sin(b.pursuitState.angle)*b.pursuitState.radius}:b;
        if(dist(q,p)<e.r+b.r+.5){occupied=true;break;}
      }
      if(occupied)continue;
      const delta=Math.abs(Math.atan2(Math.sin(angle-startAngle),Math.cos(angle-startAngle)));
      const score=dist(e,q)+(segmentBlocked(e,q,e.r+.5,target)?radius*delta:0);
      if(score<cost){cost=score;best=angle;}
    }
    return best;
  }
  // Idle allies step sideways out of a mover's lane rather than being shoved
  // ahead of it. The chosen side is sticky for a moment so a unit inside a
  // passing group keeps parting one way instead of oscillating between lanes.
  const yieldable=(m,b)=>b.team===m.team&&!b.order&&!b.combatTarget&&!b.hold&&!b.sieged&&!b.transform&&!b.building&&
    !(b.arrivalBatch&&b.arrivalBatch===m.arrivalBatch)&&length(b.vx||0,b.vy||0)<3;
  // Native 4.10: an idle unit displaced by a unit outside its own arrival batch
  // remembers where it stood (orders then show a Move back to that exact point).
  const homeless=b=>!b.order&&!b.combatTarget&&!b.hold&&!b.sieged&&!b.building&&!b.flying;
  function displaced(b,by){
    if(!b.pushHome&&homeless(b)&&!(b.arrivalBatch&&b.arrivalBatch===by?.arrivalBatch))b.pushHome={x:b.x,y:b.y,loops:0};
  }
  // Returns the remembered point once the push warrants walking back: beyond
  // PUSH_RETURN.far at once, otherwise on each PUSH_RETURN.period-loop check.
  function pushReturn(e){
    const h=e.pushHome;if(!h)return null;
    if(!homeless(e)){e.pushHome=null;return null;}
    h.loops++;const d=dist(e,h);
    if(d>PUSH_RETURN.far*SCALE||h.loops%PUSH_RETURN.period===0&&d>PUSH_RETURN.near*SCALE){e.pushHome=null;return {x:h.x,y:h.y};}
    return null;
  }
  function yieldDirection(m,b){
    const v=length(m.vx||0,m.vy||0);if(v<3)return null;
    const ux=m.vx/v,uy=m.vy/v,kept=b.yielding;
    if(kept&&frame-kept.frame<=YIELD.memory&&Math.abs(kept.x*ux+kept.y*uy)<.5){kept.frame=frame;return kept;}
    const cross=(b.x-m.x)*uy-(b.y-m.y)*ux,side=Math.abs(cross)>1?(cross>=0?-1:1):(b.id%2?1:-1);
    return b.yielding={x:-uy*side,y:ux*side,frame};
  }
  function planDetour(e,first,ux,uy,point){
    const immovable=b=>b.hp>0&&!b.building&&!b.flying&&!b.loadedIn&&!b.insideRefinery&&(b.hold||b.sieged||b.team!==e.team);
    const cluster=[first],seen=new Set(cluster);
    for(let i=0;i<cluster.length&&cluster.length<64;i++)for(const c of entities())
      if(!seen.has(c)&&c!==e&&c!==point&&immovable(c)&&dist(c,cluster[i])<c.r+cluster[i].r+2*e.r+1){seen.add(c);cluster.push(c);}
    let lo=Infinity,hi=-Infinity,near=Infinity,far=-Infinity;
    for(const c of cluster){
      const lateral=(c.x-e.x)*-uy+(c.y-e.y)*ux,forward=(c.x-e.x)*ux+(c.y-e.y)*uy;
      lo=Math.min(lo,lateral-c.r);hi=Math.max(hi,lateral+c.r);near=Math.min(near,forward-c.r);far=Math.max(far,forward+c.r);
    }
    const along=Math.max(0,(near+far)/2),sides=[lo-e.r-2,hi+e.r+2].sort((a,b)=>Math.abs(a)-Math.abs(b));
    for(const offset of sides){
      const q={x:e.x+ux*along-uy*offset,y:e.y+uy*along+ux*offset};
      if(openPoint(q,terrainRadius(e)))return{...q,order:e.order,point,until:frame+DETOUR_LOOPS};
    }
    return null;
  }
  // Units firing from inside weapon range (and Hold/Siege) never yield.
  const shooting=b=>b.hp>0&&!b.building&&!b.flying&&!b.loadedIn&&!b.insideRefinery&&(b.firingHold||b.hold||b.sieged);
  // Native contact slide (4.10 a_col3_* probes): an approaching attacker
  // pressed against a firing ally, or against one not making way along its
  // heading, keeps full speed along that body's rim instead of stalling
  // (native approachers stall 4% of loops). The rim side is kept for the
  // whole contact episode (95% persistent per loop natively) and starts away
  // from the attacker's own crowd (72-84% outward); dead-on, with no crowd
  // to leave, the turn is right/clockwise as in all four a_col3 headings.
  function slide(e,ux,uy,goal){
    const near=neighbors(e).filter(b=>b!==e&&b.team===e.team&&b.hp>0&&!b.flying&&dist(e,b)<e.r+b.r+ENGAGE.contact&&
      (shooting(b)||((b.vx||0)*ux+(b.vy||0)*uy)<e.speed*ENGAGE.makeWay));
    if(e.slideGoal!==goal){e.slideGoal=goal;e.slideSide=0;}
    if(!near.length){e.slideSide=0;return{x:ux,y:uy};}
    for(let pass=0;pass<4;pass++){
      let hit=null,depth=1e-6;
      for(const b of near){const into=(ux*(b.x-e.x)+uy*(b.y-e.y))/(dist(e,b)||1);if(into>depth){depth=into;hit=b;}}
      if(!hit)break;
      const dd=dist(e,hit)||1,nx=(hit.x-e.x)/dd,ny=(hit.y-e.y)/dd;
      if(!e.slideSide){
        let cx=0,cy=0,k=0,t=ny*ux-nx*uy;
        for(const b of neighbors(e))if(b!==e&&b.team===e.team&&b.hp>0&&dist(e,b)<ENGAGE.crowd){cx+=b.x;cy+=b.y;k++;}
        if(k){cx=cx/k-e.x;cy=cy/k-e.y;t=(cy*ux-cx*uy)/(length(cx,cy)||1);}
        e.slideSide=Math.abs(t)<ENGAGE.tie?1:-Math.sign(t);
      }
      // Browser y points down, so a native clockwise turn is +90 degrees here.
      ux=-ny*e.slideSide;uy=nx*e.slideSide;
    }
    return{x:ux,y:uy};
  }
  function move(e,point,dt,stopAt=3) {
    if(e.sieged||e.transform||e.loadedIn)return false;
    // Native 4.10 crowds (spread48_move, march24_far, b_arr_row8): a unit on
    // a Move order never covers more than its own speed in a loop, however
    // hard squadmates press it; collision() clamps the loop's displacement.
    if(!e.flying&&point===e.order&&e.order?.kind==='move')
      e.moveFrom={x:e.x,y:e.y,frame,order:e.order,dt,far:dist(e,point)>COLLISION.slideNear*SCALE,max:e.speed*(e.stim?1.5:1)*(e.slow?.5:1)*dt*COLLISION.stepCap};
    const radius=terrainRadius(e);
    // The destination is shared during travel; individual footprint reservations
    // are used only on approach. Mixed-speed units retain their own speed.
    // A combat pursuit may temporarily interrupt an attack-move order. Its
    // formation slot belongs to the order destination, never to the target.
    const reservation=point===e.order?e.order?.arrival:null;
    // Isolated native captures establish exact single-point arrival. Reserved
    // contact slots retain the existing tolerance. Offset slots outside the
    // repulsion halo can finish exactly without demanding impossible centers.
    if(stopAt===0&&reservation&&!e.order.exactFormation)stopAt=3;
    let p=reservation&&dist(e,point)<(e.order.arrivalRadius||0)+65?reservation:point;
    const combatPursuit=point===e.combatTarget&&point.hp>0&&!point.footprint&&!point.flying&&stopAt<e.r+point.r+2*e.r;
    if(combatPursuit){
      if(e.pursuitState?.target!==point||e.pursuitState.order!==e.order)e.pursuitState={target:point,order:e.order,stalled:0,wait:0};
      const state=e.pursuitState;
      // Contact recovery is local. A receding target outside this neighborhood
      // is ordinary pursuit, even when relative distance cannot decrease.
      if(dist(e,point)>stopAt+4*e.r+e.speed*.32){state.angle=undefined;state.best=undefined;state.stalled=0;}
      const progressGoal=state.angle===undefined?point:{x:point.x+Math.cos(state.angle)*stopAt,y:point.y+Math.sin(state.angle)*stopAt};
      const remainingContact=dist(e,progressGoal);
      if(state.best===undefined||remainingContact<state.best-.5){state.best=remainingContact;state.stalled=0;}
      else state.stalled+=dt;
      state.radius=stopAt;state.wait=Math.max(0,state.wait-dt);
      if(state.stalled>.6&&state.wait<=0){
        const angle=availableContact(e,point,stopAt);
        state.wait=.2;
        if(angle!==null){state.angle=angle;state.stalled=0;state.best=undefined;}
        else{e.vx=e.vy=0;return false;}
      }else if(state.stalled>.6&&state.wait>0){e.vx=e.vy=0;return false;}
      if(state.angle!==undefined){
        p={x:point.x+Math.cos(state.angle)*stopAt,y:point.y+Math.sin(state.angle)*stopAt};
        // Use a clear annular leg rather than cutting through the chased unit
        // to reach a vacant face on its opposite side.
        const firingBlockers=entities().filter(b=>b!==e&&b!==point&&b.hp>0&&b.team===e.team&&b.combatTarget&&length(b.vx||0,b.vy||0)<3&&
          dist(b,point)<stopAt+e.r+b.r+.5+e.speed*.32);
        if(segmentBlocked(e,p,e.r+.5,point)||firingBlockers.some(b=>segmentBlocked(e,p,e.r+.5,b))){
          const start=Math.atan2(e.y-point.y,e.x-point.x),delta=Math.atan2(Math.sin(state.angle-start),Math.cos(state.angle-start));
          const angle=start+Math.sign(delta)*Math.min(Math.abs(delta),Math.PI/6);
          const outerRadius=(stopAt+e.r+Math.max(e.r,...firingBlockers.map(b=>b.r))+.5)/Math.cos(Math.PI/12);
          p={x:point.x+Math.cos(angle)*outerRadius,y:point.y+Math.sin(angle)*outerRadius};
        }
        stopAt=0;
      }
    }else e.pursuitState=null;
    // Ranged approach: blocked attackers slide along allies (see slide()).
    const rangedPursuit=point===e.combatTarget&&point.hp>0&&!point.footprint&&!point.flying&&!combatPursuit&&stopAt>e.r+point.r;
    const exactPoint=stopAt===0&&!e.flying&&point===e.order&&['move','attackMove','flee'].includes(e.order?.kind);
    if(!exactPoint)e.pointBrake=null;
    if(p.footprint&&stopAt>5){
      const target=p,padding=Math.max(e.r+.1,stopAt-p.r),version=navVersion();
      if(e.interaction?.target!==target||e.interaction.version!==version||e.interaction.padding!==padding||e.interaction.x!==target.x||e.interaction.y!==target.y){
        let goal=contactPoint(e,target,padding);
        if(!openPoint(goal,radius)){
          let best=null,cost=Infinity;
          for(let i=0;i<32;i++){
            const a=i*Math.PI/16,probe={x:target.x+Math.cos(a)*(target.r+padding+60),y:target.y+Math.sin(a)*(target.r+padding+60)},q=contactPoint(probe,target,padding);
            if(!openPoint(q,radius))continue;
            const score=dist(e,q)+(clear(e,q,radius)?0:target.r);
            if(score<cost){cost=score;best=q;}
          }
          if(best)goal=best;
        }
        e.interaction={target,goal,version,padding,x:target.x,y:target.y};
      }
      p=e.interaction.goal;stopAt=1;
    }
    const d=dist(e,p),tolerance=exactPoint?1e-6:stopAt+1;
    const packed=point===e.order&&e.order?.formation==='packed'&&e.order.batch!==undefined&&!e.flying;
    // A packed leader can come to rest a hair short of the point after braking.
    if(d<=tolerance||packed&&d<.5){e.vx=e.vy=0;e.nav=null;e.movementRequest=null;e.pointBrake=null;
      if(point===e.order)e.arrivedBatch=e.order.batch;if(packed)settle(e,e.order.batch);return true;}
    // Native 4.10 group arrival (b_arr_row8, mixed_move, spread48_move,
    // march24_far, loose32/compact6 click-inside; see ARRIVAL):
    // - a squadmate touching nobody walks onto the exact point;
    // - before anyone has arrived, a unit touching a squadmate within
    //   ARRIVAL.first of the point settles at once (the four nearest of a
    //   click inside a compact box settle together ~0.5 out);
    // - afterwards a unit touching a squadmate settles on its 8-loop AI slot
    //   (the scan slot: 88% of native settles) inside a radius that grows with
    //   the arrived squad area up to ARRIVAL.cap game units;
    // - off-slot, a unit pressed into an arrived squadmate settles after
    //   ARRIVAL.contactTime (march24_far settles mostly off-slot this way).
    if(packed){
      const batch=e.order.batch,{count:arrived,area}=arrivals.get(batch)||{count:0,area:0};
      const done=()=>{e.vx=e.vy=0;e.nav=null;e.movementRequest=null;e.pointBrake=null;e.arrivedBatch=batch;e.packedStall=null;
        settle(e,batch);return true;};
      let mates=0,arrivedMate=false;
      for(const b of neighbors(e)){
        if(b===e||b.team!==e.team||b.hp<=0||b.flying)continue;
        const still=b.arrivedBatch===batch&&!b.order,mate=still||b.order?.batch===batch;
        if(!mate||dist(e,b)>e.r+b.r+ARRIVAL.touch)continue;
        mates++;if(still)arrivedMate=true;
      }
      const G=SCALE,own=ARRIVAL.big*Math.max(0,e.r/G-.375);
      // A click inside the group's box grows the radius with the squad area
      // that has arrived including this unit (loose32: ~0.5*sqrt(k+1)).
      let radius=(e.order.inside?Math.min(ARRIVAL.free*Math.sqrt(area+e.r*e.r)/G,ARRIVAL.cap):
        Math.min(ARRIVAL.first+ARRIVAL.grow*Math.sqrt(area)/G,ARRIVAL.cap))-own;
      if(!arrived)radius=Math.min(radius,ARRIVAL.first);
      const inRadius=d<=radius*G;
      if(!arrived&&mates&&inRadius)return done();
      if(arrived&&mates&&inRadius&&(!ARRIVAL.slot||scanDue(e,(loop?loop():frame>>1)+ARRIVAL.shift)))return done();
      if(inRadius&&arrived){
        if(e.packedStall?.order!==e.order)e.packedStall={order:e.order,best:d,time:0};
        if(d<e.packedStall.best-1){e.packedStall.best=d;e.packedStall.time=0;}else if((e.packedStall.time+=dt)>=ARRIVAL.stall)return done();
        e.packedContact=arrivedMate?(e.packedContact||0)+dt:0;
        if(arrivedMate&&e.packedContact>=ARRIVAL.contactTime-1e-9)return done();
      }else e.packedContact=0;
    }
    let goal=p;
    if(stopAt>5){const k=(d-stopAt)/d;goal={x:e.x+(p.x-e.x)*k,y:e.y+(p.y-e.y)*k};}
    let dest=goal;
    const version=navVersion(),movingTarget=point!==e.order&&point.hp!==undefined&&!point.footprint;
    if(e.movementRequest&&(e.movementRequest.order!==e.order||e.movementRequest.target!==point||e.movementRequest.version!==version))e.movementRequest=null;
    if(!e.flying&&!clear(e,goal,radius)) {
      let key=Math.round(goal.x/14)+','+Math.round(goal.y/14)+','+version;
      // Retarget the final clear leg without discarding a usable corridor each
      // time a chased unit crosses a planning cell.
      if(movingTarget&&e.nav?.length&&e.navTarget===point&&e.navOrder===e.order&&e.navVersion===version){
        const before=e.nav[e.nav.length-2]||e;
        if(clear(before,goal,radius)){e.nav[e.nav.length-1]={...goal};e.navKey=key;}
      }
      if(!e.nav||e.navKey!==key) {
        let shared=null;
        const corridor=point===e.order?e.order?.corridor:null;
        if(corridor?.length&&e.order.corridorVersion===navVersion()) {
          const entry=corridor.findIndex(p=>clear(e,p,radius));
          if(entry>=0){shared=corridor.slice(entry).map(p=>({...p}));const before=shared[shared.length-2]||e;if(clear(before,goal,radius))shared[shared.length-1]={...goal};else shared=null;}
        }
        if(shared){e.nav=shared;e.navKey=key;e.navTarget=point;e.navOrder=e.order;e.navVersion=version;}
        else if(path.request||requests<4){
          // Finish one bounded search to a snapshot before accepting a new
          // moving-target endpoint. Otherwise target motion can cancel every
          // frontier before any route is produced, leaving the pursuer idle.
          let requestGoal=goal;
          if(movingTarget){
            e.movementRequest??={order:e.order,target:point,version,goal:{...goal},key};
            requestGoal=e.movementRequest.goal;key=e.movementRequest.key;
          }
          requests++;const route=path.request?path.request(e,requestGoal):path(e,requestGoal);
          if(route===null){
            if(!e.nav?.length||e.navVersion!==version||e.navOrder!==e.order||e.navTarget!==point){e.vx=e.vy=0;return false;}
          }else{
            e.movementRequest=null;e.nav=route;e.navKey=key;
            e.navTarget=point;e.navOrder=e.order;e.navVersion=version;
          }
          // An open contact point can lie in a sealed pocket between fields.
          // Select a reachable face instead of retrying that pocket forever.
          if(!e.nav.length&&e.interaction?.target===point){
            const target=point,candidates=[];
            for(let i=0;i<32;i++){
              const angle=i*Math.PI/16,probe={x:target.x+Math.cos(angle)*(target.r+e.interaction.padding+60),y:target.y+Math.sin(angle)*(target.r+e.interaction.padding+60)},q=contactPoint(probe,target,e.interaction.padding);
              if(openPoint(q,radius))candidates.push(q);
            }
            candidates.sort((a,b)=>dist(e,a)-dist(e,b));
            // Try one alternate face per service attempt. Searching all 32
            // candidates synchronously bypassed the movement planning budget.
            const q=candidates[(e.interaction.faceTry||0)%candidates.length];
            if(q){e.interaction.faceTry=(e.interaction.faceTry||0)+1;e.interaction.goal=q;e.nav=null;e.navKey=null;return false;}
          }
        }
        else {e.vx=e.vy=0;return false;}
      }
      if(!e.nav?.length){e.vx=e.vy=0;return false;}
      while(e.nav.length>1&&dist(e,e.nav[0])<8)e.nav.shift();
      for(let i=e.nav.length-1;i>0;i--)if(clear(e,e.nav[i],radius)){e.nav.splice(0,i);break;}
      dest=e.nav[0];
    }else e.movementRequest=null;
    if(e.detour&&(frame>e.detour.until||dist(e,e.detour)<e.r||e.detour.order!==e.order||e.detour.point!==point))e.detour=null;
    if(e.detour&&!e.flying)dest=e.detour;
    let dx=dest.x-e.x,dy=dest.y-e.y,len=length(dx,dy);
    if(len<.001){e.nav=null;return false;}
    if(rangedPursuit&&!e.flying){const q=slide(e,dx/len,dy/len,point);dx=q.x*len;dy=q.y*len;}
    if(e.turnBeforeMove&&!e.flying){
      // A new command/target begins stationary alignment. Once that intent is
      // underway, local steering uses the moving turn rate instead of stopping
      // again for the small heading correction produced by every crowd frame.
      if(e.turnGate?.order!==e.order||e.turnGate.point!==point)e.turnGate={order:e.order,point,active:true};
      const heading=Math.atan2(dy,dx),error=Math.atan2(Math.sin(heading-e.angle),Math.cos(heading-e.angle));
      if(e.turnGate.active&&Math.abs(error)>1e-6){
        e.vx=e.vy=0;
        e.angle=turnTowards(e.angle,heading,e.stationaryTurnRate||e.turnRate||20,dt);
        const remainingAngle=Math.atan2(Math.sin(heading-e.angle),Math.cos(heading-e.angle));
        if(Math.abs(remainingAngle)>1e-6)return false;
      }
      e.turnGate.active=false;
    }
    const speed=e.speed*(e.stim?1.5:1)*(e.slow? .5:1);
    let vx=dx/len*speed,vy=dy/len*speed;
    const ux=vx/speed,uy=vy/speed;
    let wall=null;
    if(!e.flying)for(const b of neighbors(e)) {
      if(b===e||b.hp<=0||b.insideRefinery||ignoreWorkerCollision(e,b)||ignoreConstructionCollision(e,b))continue;
      const formationPeers=point===e.order&&e.order?.formation==='preserved'&&b.order?.formation==='preserved'&&
        e.order.batch!==undefined&&e.order.batch===b.order.batch&&e.team===b.team&&!e.combatTarget&&!b.combatTarget;
      const aPosition=formationPeers?(starts.get(e)||e):e,bPosition=formationPeers?(starts.get(b)||b):b;
      const bx=bPosition.x-aPosition.x,by=bPosition.y-aPosition.y,dd=length(bx,by),gap=e.r+b.r+.5;
      if(dd<.001)continue;
      const forward=bx*ux+by*uy,cross=bx*uy-by*ux;
      const settled=b.arrived&&b.arrivalBatch&&b.arrivalBatch===e.arrivalBatch&&!b.order;
      const anchored=b.hold||b.sieged||b.team!==e.team,pursuit=b===e.combatTarget;
      const bv=length(b.vx||0,b.vy||0),sameDirection=bv>3&&((b.vx*ux+b.vy*uy)/bv)>.75;
      if(anchored&&!pursuit&&b!==point&&!b.building&&forward>0&&forward<gap+3&&Math.abs(cross)<gap)wall=b;
      if(!anchored&&!b.order&&!b.combatTarget&&forward>0&&forward<gap+Math.min(3,speed*dt*2)&&dd<gap+2&&Math.abs(cross)<gap) {
        const side=Math.abs(cross)>1?(cross>=0?-1:1):(b.id%2?1:-1),lane=!settled&&YIELD.lateral&&yieldable(e,b)?yieldDirection(e,b):null;
        const yieldStep=speed*(settled?YIELD.settled:YIELD.preStep)*dt;
        const yieldPoint=lane?{x:b.x+lane.x*yieldStep,y:b.y+lane.y*yieldStep}:{x:b.x-uy*side*yieldStep,y:b.y+ux*side*yieldStep};
        if(openPoint(yieldPoint,terrainRadius(b))){displaced(b,e);b.x=yieldPoint.x;b.y=yieldPoint.y;}
      }
      // Anticipate crossing traffic and anchored units. Ordinary idle allies
      // can yield through the contact solver, so they do not become walls.
      // Moving traffic is judged at its predicted closest approach (native
      // b_cross90: both Marines swing right and pass behind/ahead, not apart).
      let ahead=forward,side=cross;
      // Units fighting or approaching a target keep the A-move slide fit, which
      // predicted avoidance distorts (amove fixtures +0.7 combined).
      if(AVOID.predict&&bv>3&&!e.combatTarget&&!['attackMove','attack','patrol'].includes(e.order?.kind)){const wx=ux*speed-b.vx,wy=uy*speed-b.vy,w=length(wx,wy);
        if(w>1){const t=(bx*wx+by*wy)/(w*w);ahead=t*w;side=(bx-wx*t)*uy-(by-wy*t)*ux;}}
      // Native squads converging on one Move point walk straight into each
      // other (compact6_inside, b_arr_row8): no swerving between squadmates.
      const squad=!AVOID.squad&&e.order?.kind==='move'&&e.order.batch!==undefined&&b.order?.batch===e.order.batch&&point===e.order;
      if(!pursuit&&!squad&&ahead>0&&ahead<gap+speed*.32&&Math.abs(side)<gap+2&&(!sameDirection&&(anchored||bv>3||b.combatTarget))) {
        const force=speed*.85*(1-Math.abs(side)/(gap+2))*clamp((gap+speed*.32-ahead)/(speed*.32),0,1);
        side=Math.abs(side)>1?(side>=0?1:-1):1;
        vx+=-uy*side*force;vy+=ux*side*force;
      }
      const spacing=squad?AVOID.squadSpacing:1;
      if(spacing>0&&dd<gap+3) {
        const force=speed*.5*spacing*clamp((gap+3-dd)/(gap+3),0,1);
        vx-=bx/dd*force;vy-=by/dd*force;
      }
    }
    // Pressed against units that never yield (Hold, Siege, enemies): after a
    // short contact, walk to the nearer edge of that whole body cluster.
    e.anchorBlock=wall&&!e.detour?(e.anchorBlock||0)+dt:0;
    if(wall&&!e.detour&&e.anchorBlock>=ANCHOR_DETOUR_DELAY){e.anchorBlock=0;e.detour=planDetour(e,wall,ux,uy,point);}
    const vl=length(vx,vy);if(vl>speed){vx*=speed/vl;vy*=speed/vl;}
    // Native 4.10 isolated Move traces show exact point endpoints and SCV
    // longitudinal braking at forward acceleration, not lateral acceleration.
    // The half-step exit margin is the inclusive discrete stopping ramp. It
    // prevents repeated acceleration/deceleration switches near an endpoint.
    // Native ranged approach does not trim its last step to the range edge:
    // the unit stops on the first loop that begins inside weapon range.
    const remaining=Math.max(0,d-stopAt),limit=rangedPursuit?Infinity:remaining/dt;
    const oldSpeed=length(e.vx,e.vy),deceleration=e.deceleration>0?e.deceleration:e.acceleration||100000;
    let pointBraking=false;
    if(exactPoint){
      if(e.pointBrake?.order!==e.order||e.pointBrake.x!==p.x||e.pointBrake.y!==p.y)e.pointBrake={order:e.order,x:p.x,y:p.y,active:false};
      const finalLeg=dist(dest,goal)<.001;
      const stoppingDistance=oldSpeed*oldSpeed/(2*deceleration)+(e.pointBrake.active?oldSpeed*dt/2:0);
      // A queued point successor means the unit walks through (game.js).
      const queued=['move','attackMove','patrol'].includes(e.orders?.[0]?.kind);
      pointBraking=e.pointBrake.active=finalLeg&&!queued&&remaining<stoppingDistance;
      if(pointBraking){
        const wanted=Math.max(0,oldSpeed-deceleration*dt),desired=length(vx,vy);
        if(desired>wanted){vx*=wanted/desired;vy*=wanted/desired;}
      }
    }
    const desired=length(vx,vy);if(desired>limit){vx*=limit/desired;vy*=limit/desired;}
    const newSpeed=length(vx,vy);
    const accel=(pointBraking?deceleration:newSpeed>oldSpeed?e.acceleration:e.lateralAcceleration)||100000;
    if(STEER.instant&&newSpeed>1e-9){
      // Native c_switch_*: an SCV (acceleration 2.5) running west at full
      // speed and ordered east moves east at full speed on the next loop;
      // the facing turns afterwards at the turn rate. Heading follows the
      // steering immediately; only the speed ramps (acceleration up,
      // braking/lateral down).
      const speedNow=newSpeed>oldSpeed?Math.min(newSpeed,oldSpeed+accel*dt):Math.max(newSpeed,oldSpeed-accel*dt);
      e.vx=vx/newSpeed*speedNow;e.vy=vy/newSpeed*speedNow;
    }else{
      const reversing=vx*e.vx+vy*e.vy<0&&e.acceleration>10000;
      const change=length(vx-e.vx,vy-e.vy),blend=reversing?1:Math.min(1,accel*dt/(change||1));
      e.vx+=(vx-e.vx)*blend;e.vy+=(vy-e.vy)*blend;
    }
    let next={x:clamp(e.x+e.vx*dt,e.r,world.w-e.r),y:clamp(e.y+e.vy*dt,e.r,world.h-e.r)};
    if(exactPoint&&dist(dest,goal)<.001&&(e.vx*dx+e.vy*dy)/len*dt>=len&&clear(e,goal,radius)){
      next={...goal};e.vx=(next.x-e.x)/dt;e.vy=(next.y-e.y)/dt;
    }
    if(!e.flying&&!clear(e,next,radius)) {
      const sx={x:next.x,y:e.y},sy={x:e.x,y:next.y};
      if(clear(e,sx,radius)){next=sx;e.vy=0;}
      else if(clear(e,sy,radius)){next=sy;e.vx=0;}
      else {next={x:e.x,y:e.y};e.vx=e.vy=0;e.nav=null;}
    }
    const advanced=dist(e,next);
    e.stuck=advanced<.05?(e.stuck||0)+dt:0;
    if(e.stuck>.6){e.nav=null;e.navKey=null;e.stuck=0;}
    e.x=next.x;e.y=next.y;
    if(length(e.vx,e.vy)>1)e.angle=turnTowards(e.angle,Math.atan2(e.vy,e.vx),e.turnRate||20,dt);
    return false;
  }
  // Fights keep the custom spacing the A-move/concave solver is tuned to.
  const fighting=u=>u.combatTarget||u.order?.kind==='attack'||u.order?.kind==='attackMove'||u.order?.kind==='patrol';
  const contactGap=(a,b)=>COLLISION.combat!==null&&(fighting(a)||fighting(b))?COLLISION.combat:COLLISION.gap;
  function collision() {
    for(const a of entities())if(!a.building&&!a.loadedIn&&!a.flying&&a.hp>0)for(const b of neighbors(a)) {
      if(b.id<=a.id||b.hp<=0||b.insideRefinery||ignoreWorkerCollision(a,b)||ignoreConstructionCollision(a,b))continue;
      let dx=a.x-b.x,dy=a.y-b.y,d=length(dx,dy),gap=a.r+b.r+contactGap(a,b);
      if(d>=gap)continue;
      if(d<.001){dx=a.id%2?.01:-.01;dy=.007;d=length(dx,dy);}
      const sameBatch=a.arrivalBatch&&a.arrivalBatch===b.arrivalBatch;
      // An idle unit shoved this loop passes the shove down a chain (native
      // b_push_idle_line: a Marine carries three in a row at ~15/16 speed).
      const movingA=length(a.vx,a.vy)>3||a.pushedAt===frame,movingB=length(b.vx,b.vy)>3||b.pushedAt===frame;
      const enemy=a.team!==b.team;
      const anchorA=a.hold||a.sieged||a.transform||(!movingA&&movingB&&(enemy||a.firingHold));
      const anchorB=b.hold||b.sieged||b.transform||(!movingB&&movingA&&(enemy||b.firingHold));
      if(anchorA&&anchorB)continue;
      // Native Move squads carry an arrived squadmate whole (mixed_move Hellion
      // chain); fights keep the A-move tuned share.
      const share=fighting(a)||fighting(b)?ARRIVAL.fightShare:ARRIVAL.idleShare;
      let wa=anchorA?0:anchorB?1:!movingA&&movingB?(sameBatch?share:YIELD.share):!movingB&&movingA?(sameBatch?1-share:1-YIELD.share):.5;
      // AlliedPushPriority units (Siege Tank) shove even moving allies aside.
      if(!enemy&&!anchorA&&!anchorB&&movingA&&movingB&&a.alliedPush!==b.alliedPush)wa=a.alliedPush?.1:.9;
      const overlap=(gap-d)*.95;
      const [mover,idle]=movingA&&!movingB&&a.order&&yieldable(a,b)?[a,b]:movingB&&!movingA&&b.order&&yieldable(b,a)?[b,a]:[];
      const lane=mover&&YIELD.lateral&&yieldDirection(mover,idle);
      if(lane){
        // The idle ally slides across the lane; the mover only gives back the
        // normal share so it is briefly checked, not stopped, while it parts.
        const sign=mover===a?1:-1,p={x:clamp(idle.x+lane.x*overlap,idle.r,world.w-idle.r),y:clamp(idle.y+lane.y*overlap,idle.r,world.h-idle.r)};
        const q={x:clamp(mover.x+dx/d*overlap*.3*sign,mover.r,world.w-mover.r),y:clamp(mover.y+dy/d*overlap*.3*sign,mover.r,world.h-mover.r)};
        if(openPoint(p,terrainRadius(idle))){displaced(idle,mover);idle.pushedAt=frame;idle.x=p.x;idle.y=p.y;}
        if(openPoint(q,terrainRadius(mover))){mover.x=q.x;mover.y=q.y;}
        continue;
      }
      for(const [e,f,sign,o] of [[a,wa,1,b],[b,1-wa,-1,a]]) {
        const p={x:clamp(e.x+dx/d*overlap*f*sign,e.r,world.w-e.r),y:clamp(e.y+dy/d*overlap*f*sign,e.r,world.h-e.r)};
        if(f>0&&openPoint(p,terrainRadius(e))){if(length(o.vx||0,o.vy||0)>3||o.pushedAt===frame){displaced(e,o);if(!e.order&&length(e.vx||0,e.vy||0)<=3)e.pushedAt=frame;}e.x=p.x;e.y=p.y;}
      }
    }
    pass++;
    if(COLLISION.stepCap)for(const e of entities()){
      const m=e.moveFrom;if(!m||m.frame!==frame-1||m.order!==e.order||e.hp<=0)continue;
      const dx=e.x-m.x,dy=e.y-m.y,l=length(dx,dy);
      // A squadmate shoved sideways keeps its walking speed along the shove
      // (native b_arr_row8: a jammed line still steps 0.136-0.141 per loop),
      // rather than losing the blocked component; the last pass only clamps.
      const want=Math.min(m.max,length(e.vx||0,e.vy||0)*m.dt);
      const target=l>m.max?m.max:COLLISION.slide&&m.far&&pass<3&&l>1e-3&&l<want?l+(want-l)*COLLISION.slide:l;
      if(target!==l){const q={x:m.x+dx/l*target,y:m.y+dy/l*target};if(openPoint(q,terrainRadius(e))){e.x=q.x;e.y=q.y;}}
    }
    // Friendly pair settling can push an earlier unit back into a held/sieged
    // body after that pair was already processed. Resolve immutable contacts
    // last so the result of a collision pass respects those physical anchors.
    for(const a of entities())if(!a.building&&!a.loadedIn&&!a.insideRefinery&&!a.flying&&a.hp>0&&!(a.hold||a.sieged||a.transform)){
      for(const b of neighbors(a)){
        if(b===a||b.hp<=0||b.insideRefinery||!(b.hold||b.sieged||b.transform)||ignoreWorkerCollision(a,b)||ignoreConstructionCollision(a,b))continue;
        let dx=a.x-b.x,dy=a.y-b.y,d=length(dx,dy);const gap=a.r+b.r+contactGap(a,b);
        if(d>=gap)continue;
        if(d<.001){dx=a.id%2?.01:-.01;dy=.007;d=length(dx,dy);}
        const p={x:clamp(b.x+dx/d*gap,a.r,world.w-a.r),y:clamp(b.y+dy/d*gap,a.r,world.h-a.r)};
        if(openPoint(p,terrainRadius(a))){a.x=p.x;a.y=p.y;}
      }
    }
  }
  // Batch serials restart with a new game, so their arrival counts must too.
  const reset=()=>arrivals.clear();
  return {begin,neighbors,move,collision,pushReturn,reset};
}

// Native 4.10 ground Move/AttackMove probes preserve mean-centered offsets when the full
// footprint AABB fits in 6 game units on both axes. This is an observed rule,
// not a claim about every current-patch formation condition.
export const COMPACT_FORMATION_EXTENT=6*SCALE;
// Group arrival tuning, fitted to native 4.10 crowd traces (radii in game
// units, see move()):
// touch: world-unit slack for touching a squadmate;
// first/grow/cap: settle radius = min(first + grow*sqrt(arrived sum r^2),
// cap); free: click inside the group's box: free*sqrt(arrived sum r^2 + r^2);
// big: radius reduction per game unit of own radius above a Marine's;
// slot: settle only on the unit's 8-loop scan slot; shift = -1 loop, as the
// native unit still moves on the loop it settles;
// stall/contactTime: off-slot settling after that long without progress or
// pressed into an arrived squadmate;
// idleShare/fightShare: overlap share an arrived squadmate takes when a mover
// hits it (Move / attack-move or fighting).
export const ARRIVAL={touch:1,first:.75,grow:2.5,cap:3,free:1.25,big:2,slot:1,shift:7,stall:.5,contactTime:.6,idleShare:1,fightShare:.6};
// Blocked ranged approach (slide()): contact = world-unit slack that counts as
// touching; makeWay = fraction of our speed an ally must move along our
// heading to not block; crowd = radius (world) of the crowd we peel away
// from; tie = lateral share below which the side is a tie (turn right).
export const ENGAGE={contact:4,makeWay:.4,crowd:42,tie:.05};
// Native 4.10 bodies in contact settle at r1+r2-1/16 game units (pushed idle
// pairs, settled crowds, Marine/Tank/Hellion mixes all measure -0.0615..-0.0625).
// combat: world-unit gap kept while either body fights (A-move concave tuning).
// stepCap: a Move-order unit's displacement per loop is capped at stepCap x
// its speed (native max step 0.1406 for Marines in every crowd trace);
// slide: share of the blocked step a shoved unit regains along the shove
// while farther than slideNear game units from its point.
export const COLLISION={gap:-.0625*SCALE,combat:.5,stepCap:1,slide:1,slideNear:1.5};
// Pushed idle units walk back (native idle_push, b_push_idle_*): a displacement
// past `far` game units orders the return at once; otherwise a check every
// `period` loops after the first push returns units displaced past `near`.
export const PUSH_RETURN={far:3,near:.5,period:32};
// Moving traffic is anticipated at its predicted closest approach (1) rather
// than at its current lateral offset (0). squad: 1 also swerves around
// squadmates of the same Move command; squadSpacing scales their spacing push.
export const AVOID={predict:1,squad:0,squadSpacing:1};
// Velocity heading follows steering at once (see move()); 0 restores vector blending.
export const STEER={instant:1};
// Idle-ally yielding: lateral (sticky sideways slide) or plain contact push;
// share is the overlap fraction an idle ally takes from a mover (native
// b_push_idle_0: the idle body is carried, the mover keeps 15/16 speed);
// preStep scales an anticipatory sidestep (native shows none); settled
// scales the sidestep of an arrived squadmate (native carries it straight);
// memory is the sticky-side lifetime (loops).
export const YIELD={lateral:false,share:1,preStep:0,settled:0,memory:12};
// Seconds pressed against immovable bodies before walking around them, and
// the movement loops a chosen detour stays valid.
export const ANCHOR_DETOUR_DELAY=.25,DETOUR_LOOPS=67;
// Spread or obstructed layouts retain the custom compact landing fallback.
export function reserveDestinations(movers,point,reachable) {
  if(movers.length<2)return;
  let inside=false;
  if(movers.every(m=>['move','attackMove','patrol'].includes(m.o.kind)&&!m.u.building&&!m.u.flying&&!m.u.sieged&&!m.u.transform)){
    const x0=Math.min(...movers.map(m=>m.u.x-m.u.r)),x1=Math.max(...movers.map(m=>m.u.x+m.u.r));
    const y0=Math.min(...movers.map(m=>m.u.y-m.u.r)),y1=Math.max(...movers.map(m=>m.u.y+m.u.r));
    // A click inside the group's own box converges instead of translating:
    // that is the standard way to clump a small squad (magic box rule).
    inside=point.x>=x0&&point.x<=x1&&point.y>=y0&&point.y<=y1;
    if(!inside&&Math.max(x1-x0,y1-y0)<=COMPACT_FORMATION_EXTENT+1e-6){
      const center={x:movers.reduce((sum,m)=>sum+m.u.x,0)/movers.length,
        y:movers.reduce((sum,m)=>sum+m.u.y,0)/movers.length};
      const slots=movers.map(m=>({x:point.x+m.u.x-center.x,y:point.y+m.u.y-center.y}));
      let valid=slots.every((p,i)=>{const q=reachable(p,terrainRadius(movers[i].u));return Math.hypot(p.x-q.x,p.y-q.y)<.01;});
      for(let i=0;i<slots.length&&valid;i++)for(let j=i+1;j<slots.length;j++){
        if(Math.hypot(slots[i].x-slots[j].x,slots[i].y-slots[j].y)<movers[i].u.r+movers[j].u.r+.5-1e-6){valid=false;break;}
      }
      if(valid){
        const radius=Math.max(...slots.map(s=>Math.hypot(s.x-point.x,s.y-point.y)));
        let exact=true;
        for(let i=0;i<slots.length&&exact;i++)for(let j=i+1;j<slots.length;j++){
          if(Math.hypot(slots[i].x-slots[j].x,slots[i].y-slots[j].y)<movers[i].u.r+movers[j].u.r+3.5){exact=false;break;}
        }
        movers.forEach((m,i)=>{
          // Native f_patrol_pair_cross: a compact Patrol group keeps the same
          // mean-centred offsets (order points shifted by each unit's offset).
          if(m.o.kind==='patrol'){m.o.x=slots[i].x;m.o.y=slots[i].y;return;}
          m.o.x=slots[i].x;m.o.y=slots[i].y;m.o.arrival={...slots[i]};m.o.arrivalRadius=radius;
          m.o.formation='preserved';m.o.groupGoal={...point};m.o.exactFormation=exact;
        });
        return;
      }
    }
  }
  // Spread groups converge on the shared point; arrival is resolved by contact
  // with arrived squadmates in move(). The radius only bounds where contact
  // arrival may happen, so a unit passing an arrived mate far away keeps going.
  const blob=Math.sqrt(movers.reduce((sum,m)=>sum+m.u.r*m.u.r,0)/.8),largest=Math.max(...movers.map(m=>m.u.r));
  for(const m of movers){
    if(m.o.kind==='patrol')continue;
    delete m.o.arrival;m.o.arrivalRadius=0;m.o.formation='packed';m.o.exactFormation=false;m.o.inside=inside;
    m.o.groupSize=movers.length;m.o.groupRadius=2*blob+2*largest;
  }
}
