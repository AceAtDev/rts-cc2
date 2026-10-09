import assert from 'node:assert/strict';
import {createWorkers,HARVEST} from '../dist/workers.js';

// Derived native 4.10 phase facts; private executable/map/traces stay outside
// the repository. At Faster, one hidden extraction lasts32 simulation loops.
let checks=0;
function check(name,test){test();checks++;console.log('PASS',name);}
function fixture(){
  const core={type:'core',team:0,hp:1500,ready:true,x:0,y:0,r:70};
  const refinery={type:'refinery',team:0,hp:500,ready:true,x:180,y:0,r:35,geyser:{amount:2250}};
  const actors=[core,refinery],payments=[],moves=[];let workers;
  const complete=e=>{workers.release(e);e.order=e.orders.shift()||null;if(e.order)workers.accept(e,e.order);};
  workers=createWorkers({entities:()=>actors,minerals:()=>[],complete,
    issue:(e,o)=>{e.order={...o};workers.accept(e,e.order);},
    move:(e,target)=>{moves.push(target);return true;},pay:(...v)=>payments.push(v),invalidateNav:()=>{}});
  const scv=()=>{const e={type:'worker',team:0,hp:45,x:160,y:0,r:10,speed:110,angle:0,turnRate:20,orders:[],carry:0};actors.push(e);e.order={kind:'gas',target:refinery};workers.accept(e,e.order);return e;};
  return {core,refinery,actors,payments,moves,workers,scv,dt:1/22.4};
}
check('Gas enters one hidden service slot and exits with4gas after32 Faster loops',()=>{
  const f=fixture(),e=f.scv();f.workers.update(e,0);assert.equal(e.insideRefinery,f.refinery);
  for(let i=0;i<31;i++)f.workers.update(e,f.dt);
  assert.equal(e.carry,0);assert.equal(e.insideRefinery,f.refinery);
  const status=f.workers.update(e,f.dt);assert.equal(status,'resumed');assert.equal(e.carry,4);assert.equal(e.carryGas,true);
  assert.equal(e.insideRefinery,null);assert.equal(f.refinery.geyser.amount,2246);assert.equal(e.order.phase,'home');assert.equal(e.returnWait,0);
});
check('QueuedMove promotes on gas emergence before return, retaining4gas',()=>{
  const f=fixture(),e=f.scv();e.orders.push({kind:'move',x:300,y:100});f.workers.update(e,0);
  const result=f.workers.update(e,HARVEST.gasTime);assert.equal(result,'promoted');assert.equal(e.order.kind,'move');assert.equal(e.carry,4);assert.equal(e.carryGas,true);
  assert.equal(f.moves.includes(f.core),false);assert.deepEqual(f.payments,[]);assert.equal(f.refinery.harvester,null);
});
check('QueuedReturn explicitly deposits gas once before its queuedMove successor',()=>{
  const f=fixture(),e=f.scv();e.orders.push({kind:'return'},{kind:'move',x:300,y:100});f.workers.update(e,0);f.workers.update(e,HARVEST.gasTime);
  assert.equal(e.order.kind,'return');assert.equal(e.carry,4);assert.deepEqual(f.payments,[]);
  f.workers.update(e,0);assert.equal(e.order.kind,'move');assert.equal(e.carry,0);assert.deepEqual(f.payments,[[0,0,-4]]);
});
check('Threegas workers shareone exclusive slot and a released slot startsnext worker',()=>{
  const f=fixture(),first=f.scv(),second=f.scv(),third=f.scv();f.workers.update(first,0);f.workers.update(second,0);f.workers.update(third,0);
  assert.equal(first.insideRefinery,f.refinery);assert.equal(second.insideRefinery,null);assert.equal(third.insideRefinery,null);
  f.workers.update(first,HARVEST.gasTime);f.workers.update(second,0);f.workers.update(third,0);
  assert.equal(second.insideRefinery,f.refinery);assert.equal(third.insideRefinery,null);assert.equal(f.refinery.harvester,second);
});
check('Normal gas emergence exposes same-step returndispatch and later depositresumesGather',()=>{
  const f=fixture(),e=f.scv();f.workers.update(e,0);assert.equal(f.workers.update(e,HARVEST.gasTime),'resumed');
  assert.equal(f.workers.update(e,0),'resumed');assert.equal(e.order.kind,'gas');assert.equal(e.order.phase,'out');assert.deepEqual(f.payments,[[0,0,-4]]);
  f.workers.update(e,0);assert.equal(e.insideRefinery,f.refinery);assert.equal(e.carry,0);
});
check('Gas without a drop-off still extracts and retainscargo until a grounded home appears',()=>{
  const f=fixture(),e=f.scv();f.actors.splice(0,1);f.workers.update(e,0);f.workers.update(e,HARVEST.gasTime);f.workers.update(e,f.dt);
  assert.equal(e.carry,4);assert.equal(e.order.phase,'home');assert.deepEqual(f.payments,[]);
  f.actors.push(f.core);f.workers.update(e,0);assert.equal(e.carry,0);assert.deepEqual(f.payments,[[0,0,-4]]);
});
console.log(`${checks} native gas phase checks passed`);
