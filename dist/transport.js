import {GRID,surface,contactPoint} from './geometry.js';
import {terrainRadius} from './unit-profiles.js';

// Catalog geometry. Lifecycle/search boundaries are checked against retained
// native research and documented separately from authored local navigation.
export const TRANSPORT={capacity:5,searchRadius:8*GRID,range:GRID,unloadRange:3*GRID};
export function createTransport({entities,issue,complete,stop,move,openPoint,project,onBoard=()=>{}}){
 const validCenter=c=>c?.hp>0&&c.type==='core'&&c.ready&&!c.morph;
 function reconcile(c){
  c.loaded=(c.loaded||[]).filter(w=>w.hp>0&&w.loadedIn===c);
  c.boarding=(c.boarding||[]).filter(w=>w.hp>0&&!w.loadedIn&&(w.order?.kind==='board'&&w.order.target===c||(w.orders||[]).some(o=>o.kind==='board'&&o.target===c)));
 }
 function candidates(c){
  reconcile(c);const slots=TRANSPORT.capacity-c.loaded.length-c.boarding.length;
  return entities().filter(w=>w.hp>0&&w.team===c.team&&w.type==='worker'&&!w.loadedIn&&!w.insideRefinery&&w.order?.kind!=='build'&&w.order?.kind!=='board'&&
   !c.boarding.includes(w)&&Math.hypot(w.x-c.x,w.y-c.y)<=TRANSPORT.searchRadius)
   .sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y)||a.id-b.id).slice(0,Math.max(0,slots));
 }
 function release(w){if(w.order?.kind==='board'&&w.order.target){const c=w.order.target;c.boarding=(c.boarding||[]).filter(p=>p!==w);}}
 function load(c){
  if(!validCenter(c))return false;
  const list=candidates(c);for(const w of list){if(issue(w,{kind:'board',target:c})!==false)(c.boarding??=[]).push(w);}
  if(c.flying&&!c.order&&c.boarding?.length)issue(c,{kind:'pickup',target:c.boarding[0]});return list.length>0;
 }
 function updateCenter(c,dt){
  const o=c.order;if(!o)return null;
  if(o.kind==='loadNearby'){load(c);complete(c);if(c.flying&&!c.order&&c.boarding?.length)issue(c,{kind:'pickup',target:c.boarding[0]});return 'requested';}
  if(o.kind==='unloadAll'){const hadCargo=!!c.loaded?.length,result=unload(c);complete(c);return hadCargo&&!result?'blocked':'unloaded';}
  if(o.kind==='pickup'){
   reconcile(c);if(!c.boarding.length){complete(c);return 'complete';}
   if(!c.boarding.includes(o.target))o.target=c.boarding[0];
   move(c,o.target,dt,c.r+o.target.r+TRANSPORT.range);return 'approach';
  }
  return null;
 }
 function updateWorker(w,dt){
  const c=w.order?.target;if(!validCenter(c)){release(w);complete(w);return 'invalid';}
  reconcile(c);if(c.loaded.length>=TRANSPORT.capacity){release(w);complete(w);return 'full';}
  if(!move(w,c,dt,c.r+w.r+TRANSPORT.range))return 'approach';
  // The worker must really have reached loading range, not merely a projected
  // unreachable interaction endpoint beside another obstacle.
  if(surface(w,c).distance-w.r>TRANSPORT.range+2)return 'approach';
  release(w);stop(w);w.loadedIn=c;c.loaded.push(w);if(c.order?.kind==='pickup'){reconcile(c);if(!c.boarding.length)complete(c);else c.order.target=c.boarding[0];}onBoard(w,c);return 'loaded';
 }
 function exitPoint(c,w,placed=[]){
  const r=terrainRadius(w),bodies=entities().filter(b=>b!==w&&b!==c&&b.hp>0&&!b.loadedIn&&!b.insideRefinery&&!b.flying);
  const clearBodies=p=>bodies.every(b=>b.building?surface(p,b).distance>=r:Math.hypot(p.x-b.x,p.y-b.y)>=w.r+b.r+.5)&&placed.every(b=>Math.hypot(p.x-b.x,p.y-b.y)>=w.r+b.r+.5);
  for(let ring=0;ring<5;ring++)for(let i=0;i<32;i++){
   const angle=Math.PI/2+i*Math.PI/16,radius=Math.min(TRANSPORT.unloadRange,ring*(w.r*2+.5)),p=c.flying||c.hp<=0?{x:c.x+Math.cos(angle)*radius,y:c.y+Math.sin(angle)*radius}:contactPoint({x:c.x+Math.cos(angle)*(c.r+200),y:c.y+Math.sin(angle)*(c.r+200)},c,w.r+ring*GRID/2);
   if(openPoint(p,r,c)&&clearBodies(p))return p;
  }
  return null;
 }
 function unload(c,only=null){
  reconcile(c);const placed=[];let changed=false;
  for(const w of [...c.loaded]){
   if(only&&w!==only)continue;const p=exitPoint(c,w,placed);if(!p)continue;
   w.loadedIn=null;stop(w);Object.assign(w,{x:p.x,y:p.y,px:p.x,py:p.y,vx:0,vy:0});placed.push(w);changed=true;
   c.loaded=c.loaded.filter(p=>p!==w);
  }
  return changed;
 }
 function destroyed(c){
  reconcile(c);for(const w of [...c.loaded])if(c.flying){w.loadedIn=null;w.hp=0;}else{
   const p=exitPoint(c,w);w.loadedIn=null;stop(w);const q=p||project(c,terrainRadius(w),c);Object.assign(w,{x:q.x,y:q.y,px:q.x,py:q.y});
  }
  c.loaded=[];
  for(const w of [...c.boarding]){release(w);complete(w);}c.boarding=[];
 }
 return{candidates,load,unload,updateCenter,updateWorker,release,reconcile,destroyed,exitPoint};
}
