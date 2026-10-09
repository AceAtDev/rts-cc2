import assert from 'node:assert/strict';
import {createWorkers,HARVEST,mineralWalking} from '../dist/workers.js';

let checks=0;
function check(name,test){test();checks++;console.log('PASS',name);}
function fixture(){
  const core={type:'core',team:0,hp:1500,ready:true,x:0,y:0,r:70};
  const node={x:100,y:0,r:20,amount:1800};
  const gas={type:'refinery',team:0,hp:500,ready:true,x:100,y:80,r:25,geyser:{amount:2250}};
  const all=[core,gas],nodes=[node],paid=[],moves=[];
  let workers,invalidations=0;
  const complete=e=>{workers.release(e);e.order=e.orders.shift()||null;if(e.order)workers.accept(e,e.order);};
  const issue=(e,o)=>{e.order={...o};e.orders=[];workers.accept(e,e.order);};
  workers=createWorkers({entities:()=>all,minerals:()=>nodes,complete,issue,
    move:(e,t,dt,range)=>{moves.push(t);return true;},
    pay:(...args)=>paid.push(args),invalidateNav:()=>invalidations++});
  function scv(){const e={type:'worker',team:0,hp:45,x:80,y:0,r:10,speed:110,turnRate:20,angle:0,orders:[],carry:0};all.push(e);return e;}
  return {workers,core,node,gas,all,nodes,paid,moves,scv,issue,complete,get invalidations(){return invalidations;}};
}

check('Gas has its own zero return delay; mineral catalog delay is unchanged',()=>{
  assert.equal(HARVEST.mineralTime,2.786/1.4);assert.equal(HARVEST.gasTime,1.981/1.4);
  assert.equal(HARVEST.returnDelay,.5/1.4);assert.equal(HARVEST.gasReturnDelay,0);assert.equal(HARVEST.acquireRadius,280);
});
check('Mineral cargo is earned at extraction and held during its distinct return delay',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'mine',node:f.node});f.workers.update(e,0);
  f.workers.update(e,HARVEST.mineralTime);assert.equal(e.carry,5);assert.equal(f.node.harvester,null);assert.equal(e.order.phase,'waitReturn');
  f.workers.update(e,HARVEST.returnDelay/2);assert.equal(e.order.phase,'waitReturn');assert.equal(e.carry,5);
  f.workers.update(e,HARVEST.returnDelay/2);assert.equal(e.carry,0);assert.equal(e.order.phase,'out');
});
check('Gas extraction releases cargo at gas HarvestTime without mineral delay',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'gas',target:f.gas});f.workers.update(e,0);
  assert.equal(e.insideRefinery,f.gas);f.workers.update(e,HARVEST.gasTime-1e-5);assert.equal(e.carry,0);
  f.workers.update(e,1e-5);assert.equal(e.carry,4);assert.equal(e.carryGas,true);assert.equal(f.gas.geyser.amount,2246);
  assert.equal(e.insideRefinery,null);assert.equal(f.gas.harvester,null);
});
check('One worker owns each mineral field while other assigned SCVs wait',()=>{
  const f=fixture(),a=f.scv(),b=f.scv();for(const e of [a,b])f.issue(e,{kind:'mine',node:f.node});
  f.workers.update(a,0);f.workers.update(b,0);assert.equal(f.node.harvester,a);assert.equal(b.harvestResource,null);
  f.workers.update(a,HARVEST.mineralTime+HARVEST.returnDelay);f.workers.update(b,0);assert.equal(f.node.harvester,b);
});
check('Availability-only search never falls back to a busy preferred field',()=>{
  const f=fixture(),a=f.scv(),b=f.scv();f.issue(a,{kind:'mine',node:f.node});f.workers.update(a,0);
  assert.equal(f.workers.patch(b,f.node,true),null);assert.equal(f.workers.patch(a,f.node,true),f.node);
});
check('A locked gas building serializes extraction without hiding waiting SCVs',()=>{
  const f=fixture(),a=f.scv(),b=f.scv();for(const e of [a,b])f.issue(e,{kind:'gas',target:f.gas});
  f.workers.update(a,0);f.workers.update(b,0);assert.equal(a.insideRefinery,f.gas);assert.equal(b.insideRefinery,null);
  f.workers.update(a,HARVEST.gasTime);f.workers.update(b,0);assert.equal(b.insideRefinery,f.gas);
});
check('Administrative order replacement exits gas and releases the extraction lock',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'gas',target:f.gas});f.workers.update(e,0);
  f.issue(e,{kind:'move',x:200,y:200});assert.equal(e.insideRefinery,null);assert.equal(f.gas.harvester,null);assert.equal(e.mineTime,0);assert.equal(mineralWalking(e),false);
});
check('Workers assigned unfinished gas wait without consuming a resource slot',()=>{
  const f=fixture(),e=f.scv();f.gas.ready=false;f.issue(e,{kind:'gas',target:f.gas});f.workers.update(e,10);
  assert.equal(e.order.kind,'gas');assert.equal(e.order.phase,'out');assert.equal(e.insideRefinery,null);assert.equal(f.gas.harvester,undefined);assert.equal(f.gas.geyser.amount,2250);
  f.gas.ready=true;f.workers.update(e,0);assert.equal(e.insideRefinery,f.gas);
});
check('A queued Move follows the cargo wait before depositing or starting another mining cycle',()=>{
  const f=fixture(),e=f.scv();f.issue(e,{kind:'mine',node:f.node});e.orders.push({kind:'move',x:200,y:0});
  f.workers.update(e,0);f.workers.update(e,HARVEST.mineralTime);f.workers.update(e,HARVEST.returnDelay);
  assert.equal(e.order.kind,'move');assert.equal(e.carry,5);assert.deepEqual(f.paid,[]);assert.equal(e.deliveredTrips,undefined);
});
check('Explicit Return deposits at its clicked grounded base and resumes mining',()=>{
  const f=fixture(),e=f.scv(),other={...f.core,x:250};f.all.push(other);e.carry=5;
  f.issue(e,{kind:'return',target:other,resume:{kind:'mine',node:f.node}});f.workers.update(e,0);
  assert.equal(f.moves.at(-1),other);assert.equal(e.order.kind,'mine');assert.equal(e.order.phase,'out');assert.equal(e.deliveredTrips,1);
});
check('Return queued movement takes precedence over saved harvesting',()=>{
  const f=fixture(),e=f.scv();e.carry=4;e.carryGas=true;f.issue(e,{kind:'return',resume:{kind:'gas',target:f.gas}});
  e.orders.push({kind:'move',x:300,y:0});f.workers.update(e,0);assert.equal(e.order.kind,'move');assert.deepEqual(f.paid,[[0,0,-4]]);
});
check('Gathering while carrying visits the new gas destination before returning cargo',()=>{
  const f=fixture(),e=f.scv();e.carry=5;f.issue(e,{kind:'gas',target:f.gas});assert.equal(e.order.phase,'out');
  f.workers.update(e,0);assert.equal(e.order.kind,'gas');assert.equal(e.order.target,f.gas);assert.equal(e.order.phase,'home');assert.equal(e.carry,5);assert.equal(e.insideRefinery,null);
  f.workers.update(e,0);assert.equal(e.order.phase,'out');assert.equal(e.carry,0);
});
check('A final partial mineral load never overdraws or disappears before deposit',()=>{
  const f=fixture(),e=f.scv();f.node.amount=3;f.issue(e,{kind:'mine',node:f.node});f.workers.update(e,0);
  f.workers.update(e,HARVEST.mineralTime+HARVEST.returnDelay);assert.equal(e.carry,3);assert.equal(f.node.amount,0);assert.equal(f.invalidations,1);
  f.workers.update(e,HARVEST.returnDelay);assert.deepEqual(f.paid,[[0,-3,0]]);f.workers.update(e,0);assert.equal(e.order,null);
});
check('A depleted field reassigns within the local acquire radius',()=>{
  const f=fixture(),e=f.scv(),next={x:250,y:0,r:20,amount:900};f.nodes.push(next);f.issue(e,{kind:'mine',node:f.node});f.node.amount=0;
  f.workers.update(e,0);assert.equal(e.order.node,next);assert.equal(e.harvestResource,next);
});
check('A finished mineral line does not send workers across the entire map',()=>{
  const f=fixture(),e=f.scv(),distant={x:900,y:0,r:20,amount:1800};f.nodes.push(distant);f.issue(e,{kind:'mine',node:f.node});f.node.amount=0;
  f.workers.update(e,0);assert.equal(e.order,null);assert.equal(distant.harvester,undefined);
});
check('Explicitly targeting a distant field remains allowed',()=>{
  const f=fixture(),e=f.scv(),distant={x:900,y:0,r:20,amount:1800};f.nodes.push(distant);f.issue(e,{kind:'mine',node:distant});
  assert.equal(e.order.node,distant);f.workers.update(e,0);assert.equal(e.harvestResource,distant);
});
check('A dead harvester lock is recovered by the next assigned worker',()=>{
  const f=fixture(),a=f.scv(),b=f.scv();f.issue(a,{kind:'mine',node:f.node});f.workers.update(a,0);a.hp=0;
  f.issue(b,{kind:'mine',node:f.node});f.workers.update(b,0);assert.equal(f.node.harvester,b);assert.equal(b.harvestResource,f.node);
});
console.log(`${checks} worker gameplay checks passed`);
