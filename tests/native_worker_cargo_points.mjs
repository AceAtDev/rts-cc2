import assert from 'node:assert/strict';
import {createWorkers,HARVEST,mineralWalking} from '../dist/workers.js';

let checks=0;
function check(name,test){test();checks++;console.log('PASS',name);}
function fixture(){
  const home={type:'core',team:0,hp:1500,ready:true,x:0,y:0,r:70};
  const mineral={x:180,y:0,r:20,amount:1800},gas={type:'refinery',team:0,hp:500,ready:true,x:220,y:30,r:35,geyser:{amount:2250}};
  const actors=[home,gas],nodes=[mineral],moves=[],payments=[];let reached=false,workers;
  const complete=e=>{workers.release(e);e.order=e.orders.shift()||null;if(e.order)workers.accept(e,e.order);};
  const issue=(e,o)=>{e.order={...o};workers.accept(e,e.order);};
  workers=createWorkers({entities:()=>actors,minerals:()=>nodes,complete,issue,
    move:(e,t,dt,stop)=>{moves.push({target:t,stop});return reached;},pay:(...v)=>payments.push(v),invalidateNav:()=>{}});
  const scv=()=>{const e={type:'worker',team:0,hp:45,x:150,y:0,r:10,speed:110,angle:0,turnRate:20,orders:[],carry:0};actors.push(e);return e;};
  return {home,mineral,gas,actors,nodes,moves,payments,workers,scv,issue,setReached:v=>{reached=v;}};
}
check('Both resource types visit their clicked target with cargo before direct return',()=>{
  for(const kind of ['mine','gas']){
    const f=fixture(),e=f.scv(),target=kind==='mine'?f.mineral:f.gas;e.carry=kind==='mine'?5:4;e.carryGas=kind==='gas';
    f.issue(e,kind==='mine'?{kind,node:target}:{kind,target});f.workers.update(e,1/22.4);
    assert.equal(f.moves.at(-1).target,target);assert.equal(e.order.phase,'out');assert.equal(f.payments.length,0);
    f.setReached(true);assert.equal(f.workers.update(e,1/22.4),'resumed');assert.equal(e.order.phase,'home');assert.equal(e.returnWait,0);assert.equal(e.harvestResource,null);
    assert.equal(f.mineral.amount,1800);assert.equal(f.gas.geyser.amount,2250);assert.equal(e.insideRefinery,null);
    f.workers.update(e,0);assert.equal(f.moves.at(-1).target,f.home);assert.equal(f.payments.length,1);
  }
});
check('Carried Gather with queuedMove promotes at resource contact without paying or extracting',()=>{
  for(const kind of ['mine','gas']){
    const f=fixture(),e=f.scv();e.carry=kind==='mine'?5:4;e.carryGas=kind==='gas';f.issue(e,kind==='mine'?{kind,node:f.mineral}:{kind,target:f.gas});
    e.orders.push({kind:'move',x:300,y:100});f.workers.update(e,0);assert.equal(e.order.kind,kind);
    f.setReached(true);assert.equal(f.workers.update(e,0),'promoted');assert.equal(e.order.kind,'move');assert.equal(e.carry,kind==='mine'?5:4);
    assert.equal(f.payments.length,0);assert.equal(f.mineral.amount,1800);assert.equal(f.gas.geyser.amount,2250);
  }
});
check('ExplicitReturn still visits its drop-off directly rather than its saved gathering destination',()=>{
  const f=fixture(),e=f.scv();e.carry=5;f.issue(e,{kind:'return',resume:{kind:'mine',node:f.mineral}});f.workers.update(e,0);
  assert.equal(f.moves.at(-1).target,f.home);assert.equal(f.moves.some(m=>m.target===f.mineral),false);
});
check('Empty Gather point walks to the savedpoint and promotes only on arrival',()=>{
  const f=fixture(),e=f.scv();f.nodes.length=0;f.issue(e,{kind:'gatherPoint',x:180,y:0});e.orders.push({kind:'move',x:300,y:100});
  assert.equal(mineralWalking(e),true);f.workers.update(e,0);assert.equal(e.order.kind,'gatherPoint');assert.deepEqual(f.moves.at(-1),{target:{x:180,y:0,r:0},stop:0});
  f.setReached(true);assert.equal(f.workers.update(e,0),'promoted');assert.equal(e.order.kind,'move');assert.equal(f.payments.length,0);
});
check('A live field near the saved Gather point is acquired before walking through emptyspace',()=>{
  const f=fixture(),e=f.scv();e.x=-500;f.issue(e,{kind:'gatherPoint',x:180,y:40});e.orders.push({kind:'move',x:300,y:100});
  assert.equal(f.workers.update(e,0),'resumed');assert.equal(e.order.kind,'mine');assert.equal(e.order.node,f.mineral);assert.equal(f.moves.length,0);assert.equal(e.orders.length,1);
  f.setReached(true);f.workers.update(e,0);assert.equal(e.harvestResource,f.mineral);
  f.workers.update(e,HARVEST.mineralTime);f.workers.update(e,HARVEST.returnDelay);assert.equal(e.order.kind,'move');assert.equal(e.carry,5);
});
check('A distant expansion cannot replace a lost mineral rally point',()=>{
  const f=fixture(),e=f.scv();f.mineral.x=1000;f.issue(e,{kind:'gatherPoint',x:180,y:0});f.workers.update(e,0);
  assert.equal(e.order.kind,'gatherPoint');assert.equal(f.moves.at(-1).target.x,180);f.setReached(true);f.workers.update(e,0);assert.equal(e.order,null);
});
check('A newly available nearbyfield can be acquired while approaching a Gather point',()=>{
  const f=fixture(),e=f.scv(),node=f.nodes.pop();f.issue(e,{kind:'gatherPoint',x:180,y:0});f.workers.update(e,0);assert.equal(e.order.kind,'gatherPoint');
  f.nodes.push(node);assert.equal(f.workers.update(e,0),'resumed');assert.equal(e.order.node,node);
});
console.log(`${checks} native cargo/point checks passed`);
