import {GRID,surface} from './geometry.js';
// Search setting is catalog-backed; contact padding is local solver tolerance.
export const REPAIR_AUTO={searchRadius:7*GRID,contactPadding:1.2};
export const repairContact=(w,t)=>surface(w,t).distance<=w.r+REPAIR_AUTO.contactPadding;
export function repairAutocastIntent(worker,entities,{affordable=()=>true}={}){
 const o=worker.order;
 if(!worker.repairAuto||worker.type!=='worker'||worker.hp<=0||worker.loadedIn||worker.insideRefinery||o&&o.kind!=='patrol')return null;
 const list=entities.filter(t=>t!==worker&&t.team===worker.team&&t.hp>0&&t.ready&&!t.planned&&!t.loadedIn&&!t.insideRefinery&&(t.building||t.mechanical)&&t.hp<t.maxhp&&
  Math.hypot(t.x-worker.x,t.y-worker.y)<REPAIR_AUTO.searchRadius&&(!worker.hold||repairContact(worker,t))&&affordable(t));
 list.sort((a,b)=>Math.hypot(a.x-worker.x,a.y-worker.y)-Math.hypot(b.x-worker.x,b.y-worker.y)||a.id-b.id);
 if(!list.length)return null;
 return{kind:'repair',target:list[0],autocast:true,resumeHold:!!worker.hold,
  resume:worker.hold?null:o?{...o}:{kind:'move',x:worker.x,y:worker.y,repairReturn:true}};
}
