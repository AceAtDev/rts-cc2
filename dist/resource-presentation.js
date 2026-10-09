import {GRID,surface,segmentBlocked} from './geometry.js';

// The catalog's 750 is a depletion ALERT threshold, not a proven mesh boundary.
export const MINERAL_DEPLETION_ALERT=750;
export const MINERAL_VISUAL_VARIANTS=4;
const MINERAL_DEFAULT_CAPACITY=1800,MINERAL_SEARCH_RADIUS=8*GRID;

// Actor groups A/B/C/D are native; capacity-relative division/boundaries are
// inferred pending native-client measurement. Capacity must survive harvesting.
export function mineralVisualState(node){
  const amount=Number(node?.amount);
  if(!Number.isFinite(amount)||amount<=0)return -1;
  const capacity=Number.isFinite(node.capacity)&&node.capacity>0?node.capacity:MINERAL_DEFAULT_CAPACITY;
  return Math.min(MINERAL_VISUAL_VARIANTS-1,Math.floor(amount/capacity*MINERAL_VISUAL_VARIANTS));
}

const alive=e=>!!e&&e.hp>0;
const groundedBase=e=>alive(e)&&e.type==='core'&&e.ready&&!e.planned&&!e.flying;
const squaredDistance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const mineralLive=n=>!!n&&n.amount>0&&(n.hp===undefined||n.hp>0);
const vertices=shape=>shape.footprint.map(([x,y])=>({x:shape.x+x,y:shape.y+y}));
function footprintDistance(a,b){
  if(!a.footprint&&!b.footprint)return Math.max(0,Math.sqrt(squaredDistance(a,b))-(a.r||0)-(b.r||0));
  if(!a.footprint)return Math.max(0,surface(a,b).distance-(a.r||0));
  if(!b.footprint)return Math.max(0,surface(b,a).distance-(b.r||0));
  const av=vertices(a),bv=vertices(b);
  // Crossed polygon edges can overlap even when neither contains a vertex.
  for(let i=0;i<av.length;i++)if(segmentBlocked(av[i],av[(i+1)%av.length],0,b))return 0;
  return Math.max(0,Math.min(...av.map(p=>surface(p,b).distance),...bv.map(p=>surface(p,a).distance)));
}
function mineralOwner(node,bases){
  let owner=null,best=Infinity;
  for(const base of bases){
    const d=squaredDistance(base,node);
    if(d<best||d===best&&(base.id??Infinity)<(owner?.id??Infinity)){owner=base;best=d;}
  }
  if(!owner)return null;
  // Both footprints matter: snapping/overlap avoidance spreads the opening's
  // outer mineral centers beyond 230. Native radius known; policy inferred.
  const d=footprintDistance(owner,node);
  return d<=MINERAL_SEARCH_RADIUS?owner:null;
}
function assignment(worker){
  const order=worker.order;
  if(order?.kind==='mine'||order?.kind==='gas')return order;
  if(order?.kind==='return'&&worker.carry>0&&['mine','gas'].includes(order.resume?.kind))return order.resume;
  return null;
}
const returning=w=>w.carry>0&&(w.order?.kind==='return'||['home','waitReturn'].includes(w.order?.phase));
const status=(count,ideal)=>({count,ideal,label:`Workers: ${count}/${ideal}`});

// Presentation only: never modifies assignments, harvesting, queues or pathing.
export function workerStatus(building,entities,minerals){
  if(!alive(building)||!building.ready||building.planned||building.flying)return null;
  const workers=entities.filter(w=>alive(w)&&w.type==='worker'&&w.team===building.team&&!w.loadedIn);
  if(building.type==='refinery'){
    const hasGas=building.geyser?.amount===undefined||building.geyser.amount>0;
    const count=workers.filter(w=>assignment(w)?.kind==='gas'&&assignment(w).target===building&&(hasGas||returning(w))).length;
    return status(count,hasGas?3:0);
  }
  if(building.type!=='core')return null;
  const bases=entities.filter(e=>groundedBase(e)&&e.team===building.team);
  const owners=new Map(minerals.map(n=>[n,mineralOwner(n,bases)]));
  const ideal=2*minerals.filter(n=>mineralLive(n)&&owners.get(n)===building).length;
  const count=workers.filter(w=>{
    const order=assignment(w);
    return order?.kind==='mine'&&owners.get(order.node)===building&&
      (mineralLive(order.node)||returning(w)&&(order.node.hp===undefined||order.node.hp>0));
  }).length;
  return status(count,ideal);
}
