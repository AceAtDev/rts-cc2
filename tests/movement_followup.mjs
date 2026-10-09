// Behavioral regressions for the custom solver; native equivalence is separate.
import assert from 'node:assert/strict';
import {createMovement} from '../dist/movement.js';
import {createNavigation} from '../dist/navigation.js';

const world={w:2100,h:1400};
const unit=(id,x,y,team=0)=>({id,type:'marine',x,y,team,r:10.5,hp:45,
  speed:88.2,vx:0,vy:0,angle:0,acceleration:54880,lateralAcceleration:2528,
  turnRate:24,order:{kind:'move'}});
const make=(units,obstacles=[])=>{
  const nav=createNavigation({world,obstacles:()=>obstacles});
  const movement=createMovement({entities:()=>units,world,clear:nav.clear,
    openPoint:nav.open,path:nav.path,navVersion:()=>nav.version});
  return{nav,movement};
};
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS',name);}

check('Stationary enemies are not pushed by a moving attacker, in either ID order',()=>{
  for(const flipped of [false,true]){
    const moving=unit(flipped?2:1,500,500),enemy=unit(flipped?1:2,519,500,1);
    moving.vx=88.2;enemy.order=null;
    const {movement}=make([moving,enemy]);movement.begin();movement.collision();
    assert.equal(enemy.x,519);assert.equal(enemy.y,500);assert(moving.x<499);
  }
});
check('Moving enemies separate instead of behaving as stationary anchors',()=>{
  const a=unit(1,500,500),b=unit(2,519,500,1);a.vx=88.2;b.vx=-88.2;
  const {movement}=make([a,b]);movement.begin();movement.collision();
  assert(a.x<500&&b.x>519);
});
check('An idle ally fifty pixels ahead does not sidestep remotely',()=>{
  const a=unit(1,500,500),b=unit(2,550,500);b.order=null;
  const {movement}=make([a,b]);movement.begin();movement.move(a,{x:800,y:500},1/60);
  assert.equal(b.x,550);assert.equal(b.y,500);assert(a.x>500);
});
check('An idle ally can yield at physical contact',()=>{
  const a=unit(1,500,500),b=unit(2,520,500);b.order=null;
  const {movement}=make([a,b]);movement.begin();movement.move(a,{x:800,y:500},1/60);
  assert(Math.hypot(b.x-520,b.y-500)>0);
});
check('Hold anchors remain stationary during overlap separation',()=>{
  const a=unit(1,500,500),b=unit(2,519,500);a.vx=88.2;b.hold=true;b.order=null;
  const {movement}=make([a,b]);movement.begin();movement.collision();assert.equal(b.x,519);
});
check('120 independent common-goal movers respond without the old 29-tick tail',()=>{
  const units=Array.from({length:120},(_,i)=>unit(i+1,100+i%12*18,100+Math.floor(i/12)*22));
  const {nav,movement}=make(units,[{x:500,y:300,r:130}]);
  const first=Array(120).fill(null);let maxNodes=0;
  for(let tick=0;tick<12;tick++){
    movement.begin();
    for(let i=0;i<units.length;i++){
      movement.move(units[i],{x:950,y:300},1/60);
      if(first[i]===null&&Math.hypot(units[i].vx,units[i].vy)>0)first[i]=tick;
      assert(nav.open(units[i],units[i].r));
    }
    maxNodes=Math.max(maxNodes,nav.planning.expanded);
    assert(nav.planning.expanded<=nav.planning.nodeBudget);
  }
  assert(first.every(t=>t!==null&&t<=2),JSON.stringify(first));
  assert(nav.planning.completed<=3);assert(nav.planning.sharedHits>=100);
  console.log(JSON.stringify({units:120,lastMovementTick:Math.max(...first),maxExpandedNodes:maxNodes}));
});
check('Superseded orders cancel their queued search before consuming more work',()=>{
  const e=unit(1,100,300),{nav}=make([e],[{x:500,y:300,r:130}]);nav.planning.nodeBudget=1;
  nav.path.begin();assert.equal(nav.path.request(e,{x:950,y:300}),null);
  e.order={kind:'move',x:100,y:600};nav.path.begin();
  assert(nav.planning.cancelled>=1);assert.equal(nav.planning.pending,0);
  const route=nav.path.request(e,{x:100,y:600});assert(route?.length);
  assert.equal(nav.planning.expanded,0);
});
check('Independent goals receive bounded fair progress despite reversed call order',()=>{
  const units=[unit(1,100,250),unit(2,100,300),unit(3,100,350)],goals=[{x:950,y:250},{x:950,y:300},{x:950,y:350}];
  const {nav}=make(units,[{x:500,y:300,r:130}]);nav.planning.nodeBudget=32;
  const ready=Array(3).fill(null),completedAt=[];
  for(let tick=0;tick<1000&&!ready.every(Boolean);tick++){
    nav.path.begin();const order=tick%2?[2,1,0]:[0,1,2];
    for(const i of order)if(!ready[i]){
      const route=nav.path.request(units[i],goals[i]);
      if(route!==null){assert(route.length);ready[i]=route;completedAt[i]=tick;}
    }
    assert(nav.planning.expanded<=32);
  }
  assert(ready.every(Boolean),JSON.stringify(nav.planning));
  for(let i=0;i<ready.length;i++){
    let previous=units[i];for(const point of ready[i]){assert(nav.clear(previous,point,units[i].r));previous=point;}
  }
  console.log(JSON.stringify({completedAtTicks:completedAt,nodeBudget:32}));
});
check('Terrain radius stays independent from the worker mobile collision radius',()=>{
  const worker={...unit(1,300,500),type:'worker',innerRadius:8.75};
  const {nav}=make([worker],[{x:400,y:470,r:20},{x:400,y:530,r:20}]);
  assert(nav.clear(worker,{x:500,y:500},worker.innerRadius));
  assert(!nav.clear(worker,{x:500,y:500},worker.r));
  const route=nav.path(worker,{x:500,y:500});assert.equal(route.length,1);
});
check('An open but enclosed contact cell fails immediately instead of exploring the map',()=>{
  const e=unit(1,100,700),goal={x:700,y:700},obstacles=[];
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)if(x||y)obstacles.push({x:goal.x+x*28,y:goal.y+y*28,r:14});
  const {nav}=make([e],obstacles);assert(nav.open(goal,e.r));
  nav.path.begin();assert.deepEqual(nav.path.request(e,goal),[]);
  assert.equal(nav.planning.expanded,0);assert.equal(nav.planning.pending,0);
});
console.log(`${checks} movement follow-up checks passed.`);
