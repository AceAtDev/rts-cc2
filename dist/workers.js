import {FASTER,SCALE,turnTowards} from './unit-profiles.js';

// Times/amounts are inherited from the resource behavior catalog at Faster.
export const HARVEST={mineralTime:2.786/FASTER,gasTime:1.981/FASTER,returnDelay:.5/FASTER,gasReturnDelay:0,mineralAmount:5,gasAmount:4,acquireRadius:10*SCALE};
export const mineralWalking=e=>e.type==='worker'&&['mine','gas','return','gatherPoint'].includes(e.order?.kind);
export const ignoreWorkerCollision=(a,b)=>(mineralWalking(a)&&(!b.alwaysCheckCollision||mineralWalking(b)))||(mineralWalking(b)&&(!a.alwaysCheckCollision||mineralWalking(a)));
export function createWorkers({entities,minerals,move,complete,issue,pay,invalidateNav}){
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const liveMineral=n=>!!n&&n.amount>0&&(n.hp===undefined||n.hp>0);
  const owner=n=>{const w=n.harvester;return w?.hp>0&&!w.loadedIn&&w.harvestResource===n&&w.order?.phase==='harvest'?w:null;};
  function release(e){
    const resource=e.harvestResource;if(resource?.harvester===e)resource.harvester=null;
    e.harvestResource=null;e.insideRefinery=null;e.mineTime=0;e.returnWait=0;
  }
  const load=(n,e)=>entities().filter(w=>w!==e&&w.hp>0&&w.type==='worker'&&w.order?.kind==='mine'&&w.order.node===n).length;
  function patch(e,preferred=null,availableOnly=false){
    const choices=minerals().filter(n=>liveMineral(n)&&(!preferred||distance(n,preferred)<=HARVEST.acquireRadius)&&(!availableOnly||!owner(n)||owner(n)===e));
    if(!choices.length)return null;
    // Automatic acquisition searches a local cluster. An explicit Gather
    // target is preserved by accept() until arrival or resource exhaustion.
    const origin=preferred||e;
    return choices.reduce((a,b)=>{const score=n=>distance(n,origin)+Math.max(0,load(n,e)-1)*180+load(n,e)*24;return !a||score(b)<score(a)?b:a;},null);
  }
  function accept(e,order){
    // Native explicit Gather to the active field preserves extraction, whereas
    // reissuing Smart/right-click starts a fresh extraction. The host retains
    // the command source instead of merging both inputs into the same policy.
    if(order.kind==='mine'&&order.gatherCommand!=='smart'&&liveMineral(order.node)&&
       e.harvestResource===order.node&&order.node.harvester===e&&!e.carry&&!e.loadedIn){order.phase='harvest';return;}
    release(e);if(order.kind==='mine'&&order.node&&order.autoAcquire)order.node=patch(e,order.node);if(['mine','gas','gatherPoint'].includes(order.kind)){order.phase='out';e.mineTime=0;}
  }
  function finishReturn(e,o){const resume=o.resume,queued=e.orders.length;complete(e);if(!queued&&resume)issue(e,{...resume,phase:'out'});return e.order?'promoted':undefined;}
  const deferring=e=>e.type==='worker'&&e.order?.phase==='waitReturn'&&e.returnWait>1e-8;
  function deposit(e,home,o){
    e.deliveredTrips=(e.deliveredTrips||0)+1;pay(e.team,e.carryGas?0:-e.carry,e.carryGas?-e.carry:0);e.carry=0;e.carryGas=false;
    if(o.kind==='return')return finishReturn(e,o);
    if(e.orders.length){complete(e);return 'promoted';}
    o.phase='out';e.nav=null;return 'resumed';
  }
  function update(e,dt){
    const o=e.order;
    if(o.kind==='gatherPoint'){
      // Lost mineral rally targets retain a Gather point. A live local field
      // is acquired immediately; an empty local line is visited before this
      // order completes. Neither case searches a distant global economy.
      const node=patch(e,{x:o.x,y:o.y});
      if(node){o.kind='mine';o.node=node;o.phase='out';e.nav=null;return 'resumed';}
      if(!move(e,{x:o.x,y:o.y,r:0},dt,0))return;
      complete(e);return e.order?'promoted':undefined;
    }
    // A queued Return may become active after the preceding gather trip has
    // already deposited. It must not create a second empty trip or payment.
    if(o.kind==='return'&&!e.carry){release(e);return finishReturn(e,o);}
    const homes=entities().filter(b=>b.team===e.team&&b.type==='core'&&b.ready&&!b.flying&&b.hp>0);const home=o.kind==='return'&&homes.includes(o.target)?o.target:homes.reduce((a,b)=>!a||distance(e,b)<distance(e,a)?b:a,null);
    let resource=o.kind==='mine'?o.node:o.target;
    if(o.phase==='waitReturn'){
      e.vx=e.vy=0;e.returnWait=Math.max(0,e.returnWait-dt);
      if(e.returnWait>1e-8)return;
      // Gather's queued successor starts after the cargo wait, before deposit.
      // It can therefore deliberately carry minerals into a Move/Build order.
      if(e.orders.length){complete(e);return 'promoted';}
      o.phase='home';e.nav=null;
    }
    if(o.kind==='return'||o.phase==='home'){
      // Native SCVs can harvest with every drop-off absent. Keep their cargo
      // and return intent stationary until a grounded drop-off becomes usable.
      if(!home){e.vx=e.vy=0;return;}
      release(e);if(move(e,home,dt,home.r+e.r+.2))return deposit(e,home,o);return;
    }
    // Keep reacquisition local to the depleted field. A distant expansion must
    // not silently replace a finished mineral line merely because it exists.
    if(o.kind==='mine'&&!liveMineral(resource)){release(e);resource=o.node=patch(e,resource||e);o.phase='out';e.nav=null;if(!resource){complete(e);return;}}
    if(o.kind==='gas'&&(!resource||resource.hp<=0||!resource.geyser||resource.geyser.amount<=0)){release(e);complete(e);return;}
    if(o.kind==='gas'&&!resource.ready){release(e);move(e,resource,dt,resource.r+e.r+.2);return;}
    if(resource.harvester&&!owner(resource))resource.harvester=null;
    if(o.phase==='harvest'){
      if(e.harvestResource!==resource){o.phase='out';return;}
      e.vx=e.vy=0;e.angle=turnTowards(e.angle,Math.atan2(resource.y-e.y,resource.x-e.x),e.turnRate,dt);e.mineTime+=dt;
      const duration=o.kind==='mine'?HARVEST.mineralTime:HARVEST.gasTime;
      if(e.mineTime+1e-8>=duration){
        const available=o.kind==='mine'?resource:resource.geyser;
        e.carry=Math.min(o.kind==='mine'?HARVEST.mineralAmount:HARVEST.gasAmount,available.amount);e.carryGas=o.kind==='gas';available.amount-=e.carry;
        // Native SCV earns cargo and releases the field after 45 Faster loops,
        // then waits eight loops with cargo before beginning mineral return.
        // Waiting workers can acquire the field during that return delay.
        release(e);e.returnWait=o.kind==='mine'?HARVEST.returnDelay:HARVEST.gasReturnDelay;
        o.phase=e.returnWait>0?'waitReturn':'home';e.nav=null;if(available.amount<=0)invalidateNav();
        // Gas has no mineral cargo wait. Native queued successors activate
        // as the SCV emerges with gas, before any automatic return/deposit.
        if(o.kind==='gas'){
          if(e.orders.length){complete(e);return 'promoted';}
          return 'resumed';
        }
      }
      return;
    }
    if(move(e,resource,dt,resource.r+e.r+.2)){
      // Native Gather with existing cargo still visits its resource target.
      // Once there it returns that cargo without a second extraction or wait.
      if(e.carry){
        if(e.orders.length){complete(e);return 'promoted';}
        o.phase='home';e.nav=null;return 'resumed';
      }
      if(resource.harvester&&resource.harvester!==e){
        e.vx=e.vy=0;
        if(o.kind==='mine'){
          const remaining=HARVEST.mineralTime-resource.harvester.mineTime;
          if(remaining>.45){const next=patch(e,resource,true);if(next&&next!==resource&&distance(e,next)/e.speed+.15<remaining){o.node=next;e.nav=null;}}
        }
        return;
      }
      resource.harvester=e;e.harvestResource=resource;e.mineTime=0;o.phase='harvest';
      e.angle=turnTowards(e.angle,Math.atan2(resource.y-e.y,resource.x-e.x),e.turnRate,dt);
      if(o.kind==='gas')e.insideRefinery=resource;
    }
  }
  return{release,accept,update,patch,deferring};
}
