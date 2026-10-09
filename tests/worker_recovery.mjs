import assert from 'node:assert/strict';
import {createWorkers,HARVEST} from '../dist/workers.js';

let checks=0;
function check(name,test){test();checks++;console.log('PASS',name);}
function fixture(){
  const home={type:'core',team:0,hp:1500,ready:true,x:0,y:0,r:70};
  const node={x:100,y:0,r:20,amount:1800},next={x:200,y:0,r:20,amount:1800};
  const gas={type:'refinery',team:0,hp:500,ready:true,x:100,y:100,r:25,geyser:{amount:2250}};
  const all=[home,gas],nodes=[node,next],payments=[],moves=[];let workers;
  const complete=e=>{workers.release(e);e.order=e.orders.shift()||null;if(e.order)workers.accept(e,e.order);};
  const issue=(e,o)=>{e.order={...o};workers.accept(e,e.order);};
  workers=createWorkers({entities:()=>all,minerals:()=>nodes,complete,issue,
    move:(e,t)=>{moves.push(t);return true;},pay:(...args)=>payments.push(args),invalidateNav:()=>{}});
  const scv=()=>{const e={type:'worker',team:0,hp:45,x:80,y:0,r:10,speed:110,turnRate:20,angle:0,orders:[],carry:0};all.push(e);return e;};
  return {workers,home,node,next,gas,all,nodes,payments,moves,scv,issue};
}
check('Destroyed mineral fields cannot win automatic reassignment despite remaining amount',()=>{
  const f=fixture(),e=f.scv();f.node.hp=0;assert.equal(f.workers.patch(e,f.node),f.next);
});
check('Destroying an actively harvested mineral releases its lock and acquires a living neighbor',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'mine',node:f.node});f.workers.update(e,0);f.workers.update(e,HARVEST.mineralTime/2);
  f.node.hp=0;f.workers.update(e,0);assert.equal(e.order.node,f.next);assert.equal(f.node.harvester,null);assert.equal(e.harvestResource,f.next);assert.equal(e.carry,0);
});
check('No living local field completes gathering and promotes its queued successor',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'mine',node:f.node});f.node.hp=0;f.next.hp=0;e.orders.push({kind:'move',x:300,y:0});
  f.workers.update(e,0);assert.equal(e.order.kind,'move');assert.equal(e.carry,0);assert.equal(f.payments.length,0);
});
check('A dead extraction owner does not hide a usable field from availability search',()=>{
  const f=fixture(),owner=f.scv(),e=f.scv();f.issue(owner,{kind:'mine',node:f.node});f.workers.update(owner,0);owner.hp=0;
  assert.equal(f.workers.patch(e,f.node,true),f.node);f.issue(e,{kind:'mine',node:f.node});f.workers.update(e,0);assert.equal(f.node.harvester,e);
});
check('A transported worker does not retain a field ownership reservation',()=>{
  const f=fixture(),owner=f.scv(),e=f.scv();f.issue(owner,{kind:'mine',node:f.node});f.workers.update(owner,0);owner.loadedIn=f.home;
  assert.equal(f.workers.patch(e,f.node,true),f.node);f.issue(e,{kind:'mine',node:f.node});f.workers.update(e,0);assert.equal(f.node.harvester,e);
});
check('An owner whose active phase is no longer extraction is recovered without waiting its old timer',()=>{
  const f=fixture(),owner=f.scv(),e=f.scv();f.issue(owner,{kind:'mine',node:f.node});f.workers.update(owner,0);owner.order={kind:'move',x:300,y:0};
  assert.equal(f.workers.patch(e,f.node,true),f.node);f.issue(e,{kind:'mine',node:f.node});f.workers.update(e,0);assert.equal(f.node.harvester,e);
});
check('A Refinery without a resource backing cannot trap or crash a assigned SCV',()=>{
  const f=fixture(),e=f.scv();delete f.gas.geyser;f.issue(e,{kind:'gas',target:f.gas});e.orders.push({kind:'move',x:300,y:0});
  f.workers.update(e,0);assert.equal(e.order.kind,'move');assert.equal(e.insideRefinery,null);assert.equal(f.moves.length,0);
});
check('Destroying the Refinery after extraction does not discard already earned gas',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'gas',target:f.gas});f.workers.update(e,0);f.workers.update(e,HARVEST.gasTime);f.gas.hp=0;
  f.workers.update(e,0);assert.equal(e.carry,0);assert.equal(e.deliveredTrips,1);assert.deepEqual(f.payments,[[0,0,-4]]);assert.equal(e.insideRefinery,null);
});
check('Lifting an explicitly selected return base falls back to a surviving grounded base',()=>{
  const f=fixture(),e=f.scv(),selected={...f.home,x:250,flying:true};f.all.push(selected);e.carry=5;f.issue(e,{kind:'return',target:selected});
  f.workers.update(e,0);assert.equal(f.moves.at(-1),f.home);assert.deepEqual(f.payments,[[0,-5,0]]);
});
console.log(`${checks} worker recovery checks passed`);
