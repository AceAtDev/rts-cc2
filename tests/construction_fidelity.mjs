import assert from 'node:assert/strict';
import {createConstruction,activeConstructionTarget,ignoreConstructionCollision,CONSTRUCTION_DELAY} from '../dist/construction.js';
import {createMovement} from '../dist/movement.js';
import {createCombat} from '../dist/combat.js';
import {createNavigation} from '../dist/navigation.js';
import {bounds,surface} from '../dist/geometry.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';
const DT=1/22.4,world={w:2000,h:2000};
const worker=(id=1)=>({...PROFILES.worker,id,type:'worker',team:0,hp:45,x:361.3,y:400,
  vx:0,vy:0,angle:0,kills:0,cooldown:0,damage:5,orders:[]});
const building=()=>({id:2,type:'relay',building:true,team:0,hp:40,maxhp:400,progress:0,planned:true,ready:false,
  x:400,y:400,r:35,footprint:[[-28,-28],[28,-28],[28,28],[-28,28]]});
function fixture({arrival=true,blocked=false,seed=0}={}) {
  let time=0,block=blocked;const e=worker(),b=building(),calls=[];e.order={kind:'build',target:b};
  const nav=createNavigation({world,obstacles:()=>[{...b,entity:b,bounds:bounds(b)}]});
  const clear=(from,to,r,ignore)=>{calls.push(ignore);return !block&&nav.clear(from,to,r,ignore);};
  const construction=createConstruction({move:()=>arrival,clear,clock:()=>time,seed});
  return {e,b,construction,calls,setBlocked(value){block=value;},get time(){return time;},step(n=1){let result;for(let i=0;i<n;i++){time+=DT;result=construction.update(e,DT);}return result;}};
}
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
check('Travel to the build site retains ordinary unit collision and does not start service timing',()=>{
  const h=fixture({arrival:false});assert.equal(h.step(),'approach');assert.equal(activeConstructionTarget(h.e),null);
  assert.equal(ignoreConstructionCollision(h.e,worker(3)),false);assert.equal(h.e.construction.nextMoveAt,undefined);
});
check('First contact starts working with a bounded modern delay and leaves progress root-owned',()=>{
  const h=fixture();assert.equal(h.step(),'working');assert.equal(activeConstructionTarget(h.e),h.b);
  assert(h.e.construction.nextMoveAt-h.time>=CONSTRUCTION_DELAY.min);
  assert(h.e.construction.nextMoveAt-h.time<=CONSTRUCTION_DELAY.max);
  assert.equal(h.b.planned,true);assert.equal(h.b.progress,0);assert.equal(h.b.builder,h.e);
});
check('Relocation actually crosses the construction footprint and preserves the Build order',()=>{
  const h=fixture(),order=h.e.order;h.step();const first={x:h.e.x,y:h.e.y};let entered=false,moved=false;
  for(let i=0;i<300;i++){assert.equal(h.step(),'working');entered||=surface(h.e,h.b).distance<h.e.r;moved||=Math.hypot(h.e.x-first.x,h.e.y-first.y)>h.e.r;}
  assert(moved);assert(entered);assert.equal(h.e.order,order);assert(h.calls.length);assert(h.calls.every(b=>b===h.b));
});
check('Worker and target identity deterministically reproduce positions and delays',()=>{
  const a=fixture(),b=fixture();a.step(350);b.step(350);
  assert.equal(a.e.x,b.e.x);assert.equal(a.e.y,b.e.y);assert.equal(a.e.construction.seed,b.e.construction.seed);
  assert.equal(a.e.construction.nextMoveAt,b.e.construction.nextMoveAt);
});
check('Blocked relocation does not teleport through terrain or freeze construction progress permission',()=>{
  const h=fixture({blocked:true});h.step();const p={x:h.e.x,y:h.e.y};assert.equal(h.step(300),'working');
  assert.equal(h.e.x,p.x);assert.equal(h.e.y,p.y);assert.equal(h.e.construction.point,null);
  assert(h.e.construction.nextMoveAt>h.time);assert.equal(h.e.vx,0);
});
check('An obstacle appearing during relocation aborts the service leg safely',()=>{
  const h=fixture();h.step();while(!h.e.construction.point)h.step();
  const p={x:h.e.x,y:h.e.y};h.setBlocked(true);h.step();
  assert.equal(h.e.construction.point,null);assert.equal(h.e.x,p.x);assert.equal(h.e.y,p.y);assert.equal(h.e.vx,0);
});
check('Only an exact active Build service order disables ally and enemy body collision',()=>{
  const h=fixture();h.step();const enemy=worker(3);enemy.team=1;
  assert(ignoreConstructionCollision(h.e,enemy));assert(ignoreConstructionCollision(enemy,h.e));
  h.e.order={kind:'move',x:500,y:400};assert.equal(activeConstructionTarget(h.e),null);
  assert.equal(ignoreConstructionCollision(h.e,enemy),false);assert.equal(h.step(),'invalid');assert.equal(h.b.builder,null);
});
check('Pair solving and held-unit final contacts respect service collision suppression and restore after cancel',()=>{
  const h=fixture();h.step();const body=worker(3);body.type='marine';body.hold=true;body.x=h.e.x;body.y=h.e.y;
  const movement=createMovement({entities:()=>[h.e,body],world,clear:()=>true,openPoint:()=>true,path:()=>[],navVersion:()=>0});
  const p={x:h.e.x,y:h.e.y};movement.begin();movement.collision();assert.equal(h.e.x,p.x);assert.equal(h.e.y,p.y);
  h.construction.release(h.e);movement.begin();movement.collision();assert(Math.hypot(h.e.x-body.x,h.e.y-body.y)>=h.e.r+body.r);
});
check('Queued orders remain pending throughout service and are untouched by release',()=>{
  const h=fixture(),next={kind:'move',x:600,y:500};h.e.orders=[next];h.step(180);
  assert.equal(h.e.order.kind,'build');assert.deepEqual(h.e.orders,[next]);h.construction.release(h.e);assert.deepEqual(h.e.orders,[next]);
});
for(const state of ['ready','deadTarget','deadWorker','loaded'])check(`${state} immediately restores ordinary collision and ends the service`,()=>{
  const h=fixture();h.step();if(state==='ready')h.b.ready=true;
  else if(state==='deadTarget')h.b.hp=0;else if(state==='deadWorker')h.e.hp=0;else h.e.loadedIn={};
  assert.equal(activeConstructionTarget(h.e),null);assert.equal(h.step(),state==='ready'?'complete':'invalid');assert.equal(h.e.construction,null);
});
check('A live builder cannot be displaced by another worker, but a halted build can be resumed',()=>{
  const h=fixture(),other=worker(3);other.order={kind:'build',target:h.b};h.b.builder=other;
  const order=h.e.order,next={kind:'mine',node:{x:200,y:400}};h.e.orders=[next];
  assert.equal(h.step(),'waiting');assert.equal(h.b.builder,other);assert.equal(h.e.order,order);
  assert.deepEqual(h.e.orders,[next]);assert.equal(activeConstructionTarget(h.e),null);other.order=null;
  assert.equal(h.step(),'working');assert.equal(h.b.builder,h.e);
});
check('An occupied Build completes only after the other builder finishes, without claiming ownership',()=>{
  const h=fixture(),other=worker(3);other.order={kind:'build',target:h.b};h.b.builder=other;
  h.step(20);assert.equal(h.e.construction.phase,'waiting');assert.equal(h.b.builder,other);
  h.b.ready=true;assert.equal(h.step(),'complete');assert.equal(h.e.construction,null);assert.equal(h.b.builder,other);
});
check('Changing the Build target releases the old owner and begins the new approach',()=>{
  const h=fixture();h.step();const previous=h.b,next={...building(),id:4,x:600};h.e.order={kind:'build',target:next};
  assert.equal(h.step(),'working');assert.equal(previous.builder,null);assert.equal(activeConstructionTarget(h.e),next);
});
check('Explicit melee attack identity survives a construction target crossing its building footprint',()=>{
  const h=fixture();h.step();h.e.x=h.b.x;h.e.y=h.b.y;
  const attacker=worker(3);attacker.team=1;attacker.x=300;attacker.order={kind:'attack',target:h.e};
  const order=attacker.order,attempts=[];let time=0;
  const combat=createCombat({entities:()=>[attacker,h.e],visible:()=>true,research:()=>[{},{}],shots:()=>[],clock:()=>time,
    move:(e,target)=>{attempts.push(target);return false;}});
  for(let i=0;i<20;i++){time+=DT;combat.begin(DT);combat.engage(attacker,DT);}
  assert.equal(attacker.order,order);assert.equal(attacker.combatTarget,h.e);assert(attempts.every(t=>t===h.e));
  h.e.x=350;time+=DT;combat.begin(DT);combat.engage(attacker,DT);assert.equal(attacker.order,order);assert.equal(attempts.at(-1),h.e);
});
console.log(`${checks} construction fidelity checks passed.`);
