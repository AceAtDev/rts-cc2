import assert from 'node:assert/strict';
import {createWorkers,HARVEST} from '../dist/workers.js';

let checks=0;
function check(name,test){test();checks++;console.log('PASS',name);}
function fixture(){
  const home={type:'core',team:0,hp:1500,ready:true,x:0,y:0,r:70};
  const clicked={x:100,y:0,r:20,amount:1800},nearby={x:140,y:40,r:20,amount:1800};
  const all=[home],nodes=[clicked,nearby],payments=[],moves=[];
  let workers;
  const complete=e=>{workers.release(e);e.order=e.orders.shift()||null;if(e.order)workers.accept(e,e.order);};
  const issue=(e,o)=>{e.order={...o};e.orders=[];workers.accept(e,e.order);};
  workers=createWorkers({entities:()=>all,minerals:()=>nodes,complete,issue,
    move:(e,t)=>{moves.push(t);return true;},pay:(...args)=>payments.push(args),invalidateNav:()=>{}});
  function scv(){const e={type:'worker',team:0,hp:45,x:80,y:0,r:10,speed:110,turnRate:20,angle:0,orders:[],carry:0};all.push(e);return e;}
  function crowd(){for(let i=0;i<5;i++){const e=scv();issue(e,{kind:'mine',node:clicked});}}
  return {home,clicked,nearby,all,nodes,payments,moves,workers,complete,issue,scv,crowd};
}
check('A clicked field remains the accepted target even when nearby fields are less assigned',()=>{
  const f=fixture();f.crowd();const e=f.scv();f.issue(e,{kind:'mine',node:f.clicked});
  assert.equal(e.order.node,f.clicked);assert.equal(e.order.phase,'out');assert.equal(f.moves.length,0);
});
check('Automatic economy assignments opt into load balancing explicitly',()=>{
  const f=fixture();f.crowd();const e=f.scv();f.issue(e,{kind:'mine',node:f.clicked,autoAcquire:true});assert.equal(e.order.node,f.nearby);
});
check('Explicit queued Gather preserves its target when activated after movement',()=>{
  const f=fixture();f.crowd();const e=f.scv();f.issue(e,{kind:'move',x:50,y:50});e.orders.push({kind:'mine',node:f.clicked});
  f.complete(e);assert.equal(e.order.node,f.clicked);assert.equal(e.order.phase,'out');
});
check('Carried cargo returns before visiting the exact newly clicked field',()=>{
  const f=fixture();f.crowd();const e=f.scv();e.carry=5;f.issue(e,{kind:'mine',node:f.clicked});
  assert.equal(e.order.node,f.clicked);assert.equal(e.order.phase,'home');f.workers.update(e,0);
  assert.equal(f.moves.at(-1),f.home);assert.equal(e.order.node,f.clicked);assert.equal(e.order.phase,'out');
  f.workers.update(e,0);assert.equal(f.moves.at(-1),f.clicked);assert.equal(e.harvestResource,f.clicked);
});
check('Return Cargo resumes the saved explicit mineral identity without redistributing it',()=>{
  const f=fixture();f.crowd();const e=f.scv();e.carry=5;
  f.issue(e,{kind:'return',resume:{kind:'mine',node:f.clicked}});f.workers.update(e,0);
  assert.equal(e.order.node,f.clicked);assert.equal(e.carry,0);assert.equal(e.deliveredTrips,1);
});
check('Busy-field arrival may reacquire, but input acceptance does not silently change the click',()=>{
  const f=fixture(),owner=f.scv(),e=f.scv();f.issue(owner,{kind:'mine',node:f.clicked});f.workers.update(owner,0);
  f.issue(e,{kind:'mine',node:f.clicked});assert.equal(e.order.node,f.clicked);f.workers.update(e,0);
  assert.equal(f.moves.at(-1),f.clicked);assert.equal(e.order.node,f.nearby);assert.equal(e.harvestResource,null);
  f.workers.update(e,0);assert.equal(e.harvestResource,f.nearby);
});
check('A free clicked field is mined even when its assignment count is high',()=>{
  const f=fixture();f.crowd();const e=f.scv();f.issue(e,{kind:'mine',node:f.clicked});f.workers.update(e,0);
  assert.equal(e.harvestResource,f.clicked);assert.equal(f.clicked.harvester,e);assert.equal(f.nearby.harvester,undefined);
});
check('Empty Return completes without travel, deposit accounting, or payment',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'return'});f.workers.update(e,0);
  assert.equal(e.order,null);assert.equal(e.deliveredTrips,undefined);assert.equal(f.moves.length,0);assert.equal(f.payments.length,0);
});
check('Gather then queued Return explicitly deposits once before queued Move',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'mine',node:f.clicked});e.orders.push({kind:'return'},{kind:'move',x:300,y:0});
  f.workers.update(e,0);f.workers.update(e,HARVEST.mineralTime);f.workers.update(e,HARVEST.returnDelay);
  assert.equal(e.order.kind,'return');const movementCount=f.moves.length;f.workers.update(e,0);
  assert.equal(e.order.kind,'move');assert.equal(e.deliveredTrips,1);assert.equal(f.moves.length,movementCount+1);assert.deepEqual(f.payments,[[0,-5,0]]);
});
check('Empty Return restores saved Gather without requiring a drop-off to exist',()=>{
  const f=fixture(),e=f.scv();f.all.splice(0,1);f.issue(e,{kind:'return',resume:{kind:'mine',node:f.clicked}});f.workers.update(e,0);
  assert.equal(e.order.kind,'mine');assert.equal(e.order.node,f.clicked);assert.equal(f.payments.length,0);
});
check('Interrupting unfinished extraction releases ownership without inventing earned resources',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'mine',node:f.clicked});f.workers.update(e,0);f.workers.update(e,HARVEST.mineralTime/2);
  f.issue(e,{kind:'move',x:300,y:0});assert.equal(e.carry,0);assert.equal(e.mineTime,0);assert.equal(f.clicked.amount,1800);assert.equal(f.clicked.harvester,null);
});
check('Interrupting an earned return trip keeps the cargo until a later explicit return',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'mine',node:f.clicked});f.workers.update(e,0);f.workers.update(e,HARVEST.mineralTime+HARVEST.returnDelay);
  f.issue(e,{kind:'move',x:300,y:0});assert.equal(e.carry,5);assert.equal(f.payments.length,0);
  f.issue(e,{kind:'return'});f.workers.update(e,0);assert.equal(e.carry,0);assert.deepEqual(f.payments,[[0,-5,0]]);
});
console.log(`${checks} worker intent checks passed`);
