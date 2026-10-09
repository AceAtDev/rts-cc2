import {FASTER,SCALE,turnTowards} from './unit-profiles.js';

// Times/amounts are inherited from the resource behavior catalog at Faster.
export const HARVEST={mineralTime:2.786/FASTER,gasTime:1.981/FASTER,returnDelay:.5/FASTER,gasReturnDelay:0,mineralAmount:5,gasAmount:4,acquireRadius:10*SCALE};
export const mineralWalking=e=>e.type==='worker'&&['mine','gas','return'].includes(e.order?.kind);
export const ignoreWorkerCollision=(a,b)=>(mineralWalking(a)&&(!b.alwaysCheckCollision||mineralWalking(b)))||(mineralWalking(b)&&(!a.alwaysCheckCollision||mineralWalking(a)));
export function createWorkers({entities,minerals,move,complete,issue,pay,invalidateNav}){
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function release(e){
    const resource=e.harvestResource;if(resource?.harvester===e)resource.harvester=null;
    e.harvestResource=null;e.insideRefinery=null;e.mineTime=0;
  }
  const load=(n,e)=>entities().filter(w=>w!==e&&w.hp>0&&w.type==='worker'&&w.order?.kind==='mine'&&w.order.node===n).length;
  function patch(e,preferred=null,availableOnly=false){
    const choices=minerals().filter(n=>n.amount>0&&(!preferred||distance(n,preferred)<=HARVEST.acquireRadius)&&(!availableOnly||!n.harvester||n.harvester===e));
    if(!choices.length)return null;
    // A clicked field anchors the local resource cluster. Two workers per field
    // is the catalog ideal, not a forced single-file army formation.
    const origin=preferred||e;
    return choices.reduce((a,b)=>{const score=n=>distance(n,origin)+Math.max(0,load(n,e)-1)*180+load(n,e)*24;return !a||score(b)<score(a)?b:a;},null);
  }
  function accept(e,order){release(e);if(order.kind==='mine'&&order.node)order.node=patch(e,order.node);if(['mine','gas'].includes(order.kind)){order.phase=e.carry?'home':'out';e.mineTime=0;}}
  function deposit(e,home,o){
    e.deliveredTrips=(e.deliveredTrips||0)+1;pay(e.team,e.carryGas?0:-e.carry,e.carryGas?-e.carry:0);e.carry=0;e.carryGas=false;
    if(o.kind==='return'){const resume=o.resume,queued=e.orders.length;complete(e);if(!queued&&resume)issue(e,{...resume,phase:'out'});return;}
    if(e.orders.length){complete(e);return;}
    o.phase='out';e.nav=null;
  }
  function update(e,dt){
    const o=e.order,homes=entities().filter(b=>b.team===e.team&&b.type==='core'&&b.ready&&!b.flying&&b.hp>0);const home=o.kind==='return'&&homes.includes(o.target)?o.target:homes.reduce((a,b)=>!a||distance(e,b)<distance(e,a)?b:a,null);
    if(!home){release(e);complete(e);return;}
    let resource=o.kind==='mine'?o.node:o.target;
    if(o.kind==='return'||o.phase==='home'){
      release(e);if(move(e,home,dt,home.r+e.r+.2))deposit(e,home,o);return;
    }
    // Keep reacquisition local to the depleted field. A distant expansion must
    // not silently replace a finished mineral line merely because it exists.
    if(o.kind==='mine'&&(!resource||resource.amount<=0)){release(e);resource=o.node=patch(e,resource||e);e.nav=null;if(!resource){complete(e);return;}}
    if(o.kind==='gas'&&(!resource||resource.hp<=0||resource.geyser?.amount<=0)){release(e);complete(e);return;}
    if(o.kind==='gas'&&!resource.ready){release(e);move(e,resource,dt,resource.r+e.r+.2);return;}
    if(resource.harvester&&(resource.harvester.hp<=0||resource.harvester.harvestResource!==resource))resource.harvester=null;
    if(o.phase==='harvest'){
      if(e.harvestResource!==resource){o.phase='out';return;}
      e.vx=e.vy=0;e.angle=turnTowards(e.angle,Math.atan2(resource.y-e.y,resource.x-e.x),e.turnRate,dt);e.mineTime+=dt;
      const duration=o.kind==='mine'?HARVEST.mineralTime+HARVEST.returnDelay:HARVEST.gasTime+HARVEST.gasReturnDelay;
      if(e.mineTime+1e-8>=duration){
        const available=o.kind==='mine'?resource:resource.geyser;
        e.carry=Math.min(o.kind==='mine'?HARVEST.mineralAmount:HARVEST.gasAmount,available.amount);e.carryGas=o.kind==='gas';available.amount-=e.carry;
        release(e);o.phase='home';e.nav=null;if(available.amount<=0)invalidateNav();
      }
      return;
    }
    if(move(e,resource,dt,resource.r+e.r+.2)){
      if(resource.harvester&&resource.harvester!==e){
        e.vx=e.vy=0;
        if(o.kind==='mine'){
          const remaining=HARVEST.mineralTime+HARVEST.returnDelay-resource.harvester.mineTime;
          if(remaining>.45){const next=patch(e,resource,true);if(next&&next!==resource&&distance(e,next)/e.speed+.15<remaining){o.node=next;e.nav=null;}}
        }
        return;
      }
      resource.harvester=e;e.harvestResource=resource;e.mineTime=0;o.phase='harvest';
      e.angle=turnTowards(e.angle,Math.atan2(resource.y-e.y,resource.x-e.x),e.turnRate,dt);
      if(o.kind==='gas')e.insideRefinery=resource;
    }
  }
  return{release,accept,update,patch};
}
