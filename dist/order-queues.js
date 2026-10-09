// Admission is a pure preflight: rejected orders must not spend/refund resources,
// cancel combat, mutate a worker's uninterruptible phase, or spawn a build plan.
export const ORDER_QUEUE_FULL='Cannot queue additional orders';
export const RALLY_QUEUE_FULL='Cannot queue additional rally points';
// Native 4.10 observation: one active Move plus 31 Shift Move successors.
export const UNIT_ORDER_LIMIT=32;
// Native 4.10 produced-SCV observations: four Command Center rally targets.
export const RALLY_ORDER_LIMIT=4;
const capacity=limit=>{if(!Number.isInteger(limit)||limit<1)throw new RangeError('A verified positive queue limit is required');return limit;};

export function orderQueueCount(unit,{countsActive=true}={}){
  // Native automatic Repair exposes its return Move/Hold/Patrol successor.
  // Our controller stores that successor on the active intent instead.
  const implicit=unit.order?.kind==='repair'&&(unit.order.resume||unit.order.resumeHold)?1:0;
  return(unit.orders||[]).length+implicit+(countsActive&&unit.order?1:0);
}

export function queueAdmission(unit,{append=false,deferring=false,limit=UNIT_ORDER_LIMIT,countsActive=true}={}){
  capacity(limit);
  const mode=append&&unit.order?'append':deferring?'defer':'replace';
  const count=orderQueueCount(unit,{countsActive});
  const nextCount=mode==='append'?count+1:mode==='defer'?1+(countsActive&&unit.order?1:0):(countsActive?1:0);
  const accepted=mode==='replace'||nextCount<=limit;
  return{accepted,mode,count,nextCount,reason:accepted?'':ORDER_QUEUE_FULL};
}

export function rallyAdmission(building,order,{append=false,limit=RALLY_ORDER_LIMIT,visible}={}){
  capacity(limit);
  const existing=building.rally?[building.rally,...building.rallyOrders||[]]:[];
  if(append&&existing.length>=limit)return{accepted:false,reason:RALLY_QUEUE_FULL};
  const accepted={...order,lastSeen:order.lastSeen?{...order.lastSeen}:undefined};
  // A target rally follows the target while observed. Preserve a snapshot for
  // unusual hidden-target callers; actual player rallies target own entities.
  const target=accepted.target||accepted.node;
  if(target&&(target.team===building.team||visible?.(target.x,target.y)))accepted.lastSeen={x:target.x,y:target.y};
  else if(Number.isFinite(accepted.x)&&Number.isFinite(accepted.y))accepted.lastSeen={x:accepted.x,y:accepted.y};
  const chain=append?[...existing,accepted]:[accepted];
  return{accepted:true,reason:'',rally:chain[0],rallyOrders:chain.slice(1)};
}

export function cleanRally(building,{entities,minerals,visible}={}){
  const existing=building.rally?[building.rally,...building.rallyOrders||[]]:[];
  let changed=false;
  const keepPoint=t=>({kind:'move',x:t.x,y:t.y});
  const clean=order=>{
    if(order.target){
      const t=order.target,known=t.team===building.team||visible?.(t.x,t.y);
      if(known&&(t.hp<=0||entities&&!entities.includes(t))){
        changed=true;return t.clearRallyOnTargetLost===false||t.clearRallyOnTargetLost===0?keepPoint(t):null;
      }
    }
    if(order.node&&visible?.(order.node.x,order.node.y)&&(order.node.amount<=0||minerals&&!minerals.includes(order.node))){
      // MineralFieldDefault overrides ClearRallyOnTargetLost to 0: retain
      // the known resource location instead of sending new units to nowhere.
      changed=true;return{kind:'gatherPoint',x:order.node.x,y:order.node.y};
    }
    return order;
  };
  const chain=existing.map(clean).filter(Boolean);
  return{changed,rally:chain[0]||null,rallyOrders:chain.slice(1)};
}

export function rallyEndpoints(building,{visible}={}){
  const chain=building.rally?[building.rally,...building.rallyOrders||[]]:[];
  return chain.map(order=>{
    const target=order.target||order.node;
    let p=order;
    if(target){
      const known=target.team===building.team||visible?.(target.x,target.y);
      p=known?target:order.lastSeen||order;
    }
    return Number.isFinite(p.x)&&Number.isFinite(p.y)?{kind:order.kind,x:p.x,y:p.y}:null;
  }).filter(Boolean);
}

export function spawnRallyOrders(unit,building,{visible}={}){
  const chain=building.rally?[building.rally,...building.rallyOrders||[]]:[];
  return chain.map(order=>{
    if(unit.type!=='worker'&&['mine','gas','gatherPoint'].includes(order.kind)){
      const endpoint=rallyEndpoints({...building,rally:order,rallyOrders:[]},{visible})[0];
      return endpoint?{kind:'move',x:endpoint.x,y:endpoint.y}:null;
    }
    return{...order,phase:'out',lastSeen:order.lastSeen?{...order.lastSeen}:undefined};
  }).filter(Boolean);
}
