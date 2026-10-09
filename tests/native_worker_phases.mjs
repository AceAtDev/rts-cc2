import assert from 'node:assert/strict';
import {createWorkers,HARVEST} from '../dist/workers.js';

// Derived phase boundaries from local native 4.10.0.75689 captures. No map,
// executable, native assets, or raw licensed-data traces are embedded here.
const NATIVE={arrival:22,cargo:67,departure:75,nextCargo:113},dt=1/22.4;
let checks=0;
function check(name,test){test();checks++;console.log('PASS',name);}
function fixture(){
  let loop=0,workers;
  const core={type:'core',team:0,hp:1500,ready:true,x:0,y:0,r:70},node={x:100,y:0,r:20,amount:1800};
  const entities=[core],payments=[],returnCalls=[];
  const complete=e=>{workers.release(e);e.order=e.orders.shift()||null;if(e.order)workers.accept(e,e.order);};
  workers=createWorkers({entities:()=>entities,minerals:()=>[node],complete,
    issue:(e,o)=>{e.order={...o};workers.accept(e,e.order);},
    move:(e,target)=>{if(target===core){returnCalls.push(loop);return false;}return loop>=NATIVE.arrival;},
    pay:(...args)=>payments.push(args),invalidateNav:()=>{}});
  const scv=()=>{const e={type:'worker',team:0,hp:45,x:80,y:0,r:10,speed:110,turnRate:20,angle:0,orders:[],carry:0};entities.push(e);e.order={kind:'mine',node};workers.accept(e,e.order);return e;};
  const tick=(...actors)=>{loop++;return actors.map(e=>workers.update(e,dt));};
  const until=(end,...actors)=>{while(loop<end)tick(...actors);};
  return {workers,core,node,entities,payments,returnCalls,scv,tick,until,get loop(){return loop;}};
}
check('Cargo appears 45 loops after native fixture arrival rather than after 53 combined loops',()=>{
  const f=fixture(),e=f.scv();f.until(NATIVE.cargo-1,e);assert.equal(e.carry,0);assert.equal(f.node.amount,1800);
  f.tick(e);assert.equal(e.carry,5);assert.equal(f.node.amount,1795);assert.equal(e.order.phase,'waitReturn');
});
check('Cargo acquisition releases the mineral field before the return delay',()=>{
  const f=fixture(),e=f.scv();f.until(NATIVE.cargo,e);
  assert.equal(f.node.harvester,null);assert.equal(e.harvestResource,null);assert.equal(f.workers.deferring(e),true);assert.equal(f.returnCalls.length,0);
});
check('The SCV remains stationary with cargo for the eight-loop mineral return wait',()=>{
  const f=fixture(),e=f.scv();f.until(NATIVE.departure-1,e);assert.equal(e.carry,5);assert.equal(e.order.phase,'waitReturn');
  assert.equal(f.returnCalls.length,0);f.tick(e);assert.deepEqual(f.returnCalls,[NATIVE.departure]);assert.equal(e.order.phase,'home');
});
check('A waiting SCV starts extraction while the previous harvester still waits with cargo',()=>{
  const f=fixture(),waiting=f.scv(),first=f.scv();f.until(NATIVE.arrival,first,waiting);f.until(NATIVE.cargo,waiting,first);
  // Process the waiting worker before the owner, matching the measured trial's
  // next-owner service on the loop after the first extraction releases it.
  f.tick(waiting,first);assert.equal(waiting.order.phase,'harvest');assert.equal(first.order.phase,'waitReturn');
  f.until(NATIVE.nextCargo-1,waiting,first);assert.equal(waiting.carry,0);f.tick(waiting,first);assert.equal(waiting.carry,5);
});
check('Gather plus queued Move promotes at departure with cargo and no forced deposit',()=>{
  const f=fixture(),e=f.scv();e.orders.push({kind:'move',x:300,y:0});f.until(NATIVE.departure-1,e);
  const [result]=f.tick(e);assert.equal(result,'promoted');assert.equal(e.order.kind,'move');assert.equal(e.carry,5);
  assert.equal(f.returnCalls.length,0);assert.equal(f.payments.length,0);assert.equal(e.deliveredTrips,undefined);
});
check('WaitToReturn reports deferral at both measured Move request boundaries',()=>{
  for(const requested of [67,71]){
    const f=fixture(),e=f.scv();f.until(requested,e);assert.equal(f.workers.deferring(e),true);
    // The command dispatcher queues the accepted replacement during this
    // native uninterruptible phase; root browser tests exercise that API.
    e.orders=[{kind:'move',x:300,y:0}];f.until(74,e);assert.equal(e.order.phase,'waitReturn');
    f.tick(e);assert.equal(e.order.kind,'move');assert.equal(e.carry,5);assert.equal(f.payments.length,0);
  }
});
check('Depleting the final five minerals does not discard the cargo during its wait',()=>{
  const f=fixture(),e=f.scv();f.node.amount=5;f.until(NATIVE.cargo,e);assert.equal(f.node.amount,0);assert.equal(e.carry,5);
  f.until(NATIVE.departure,e);assert.equal(e.order.phase,'home');assert.equal(e.carry,5);assert.deepEqual(f.returnCalls,[75]);
});
check('Wait duration remains the catalog eight Faster loops, with no new economy multiplier',()=>{
  assert.equal(HARVEST.returnDelay/dt,8);assert.equal(HARVEST.mineralAmount,5);assert.equal(Math.ceil(HARVEST.mineralTime/dt),45);
});
console.log(`${checks} native worker phase checks passed`);
