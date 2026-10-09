// Real planner/collision regressions. Native trajectory equivalence requires
// recorded comparisons with the client; these catch concrete order violations.
import assert from 'node:assert/strict';
import {createMovement} from '../dist/movement.js';
import {createNavigation} from '../dist/navigation.js';
import {PROFILES} from '../dist/unit-profiles.js';

const world={w:1800,h:1600},dt=1/22.4;
const marine=(x=200,y=600)=>({...PROFILES.marine,id:1,type:'marine',team:0,
  hp:45,x,y,vx:0,vy:0,angle:0,order:{kind:'attack'}});
const target=(x=950,y=400)=>({id:2,type:'marine',team:1,hp:45,r:10.5,x,y});
const setup=(e,obstacles=[])=>{
  const nav=createNavigation({world,obstacles:()=>obstacles});
  const movement=createMovement({entities:()=>[e],world,clear:nav.clear,
    openPoint:nav.open,path:nav.path,navVersion:()=>nav.version});
  return{nav,movement};
};
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};

check('Attack-move arrival reservations cannot replace an enemy pursuit destination',()=>{
  const e=marine(500,500),enemy=target(560,500),{movement}=setup(e);
  e.order={kind:'attackMove',x:500,y:800,arrival:{x:500,y:800},arrivalRadius:150};
  e.combatTarget=enemy;movement.begin();movement.move(e,enemy,dt,44);
  assert(e.x>500);assert(Math.abs(e.y-500)<1e-9);
});
check('Arrival reservations still apply when executing the actual move order',()=>{
  const e=marine(540,500),{movement}=setup(e);
  e.order={kind:'move',x:600,y:500,arrival:{x:600,y:530},arrivalRadius:30};
  movement.begin();movement.move(e,e.order,dt);
  assert(e.x>540&&e.y>500);
});
check('Attack-move march corridors cannot steer combat pursuit down the wrong side',()=>{
  const e=marine(),enemy=target(),{nav,movement}=setup(e,[{x:600,y:600,r:200}]);
  e.order={kind:'attackMove',x:950,y:1000,corridorVersion:nav.version,
    corridor:[{x:200,y:1000},{x:950,y:1000},{x:950,y:450},{x:950,y:400}]};
  let firstMoved=false;
  for(let i=0;i<100&&!firstMoved;i++){
    movement.begin();movement.move(e,enemy,dt,e.weapon.range+e.r+enemy.r-1);
    firstMoved=Math.hypot(e.vx,e.vy)>0;
  }
  assert(firstMoved);assert(e.y<600);assert(nav.planning.completed>=1);
});
check('Moving targets cannot starve a bounded pursuit planner by changing cells',()=>{
  const e=marine(),enemy=target(),{nav,movement}=setup(e,[{x:600,y:600,r:200}]);
  e.order.target=enemy;nav.planning.nodeBudget=16;
  let movingTicks=0,firstMovement=null;
  for(let i=0;i<200;i++){
    enemy.y+=2;movement.begin();
    movement.move(e,enemy,dt,e.weapon.range+e.r+enemy.r-1);
    if(Math.hypot(e.vx,e.vy)>0){movingTicks++;firstMovement??=i;}
    assert(nav.planning.expanded<=16);assert(nav.open(e,e.r));
  }
  assert(firstMovement!==null&&firstMovement<50);
  assert(movingTicks>150);assert(e.x>750);assert(nav.planning.completed>=1);
  assert.equal(nav.planning.cancelled,0);
});
check('Stationary-target pursuit retains a usable route as range endpoints shift',()=>{
  const e=marine(),enemy=target(),{nav,movement}=setup(e,[{x:600,y:600,r:200}]);
  e.order.target=enemy;nav.planning.nodeBudget=16;let reached=false;
  const stop=e.weapon.range+e.r+enemy.r-1;
  for(let i=0;i<500&&!reached;i++){
    movement.begin();reached=movement.move(e,enemy,dt,stop);assert(nav.open(e,e.r));
  }
  assert(reached);assert(Math.hypot(e.x-enemy.x,e.y-enemy.y)<=stop+1);
  assert.equal(nav.planning.cancelled,0);
});
check('Replacing the order abandons its pending pursuit snapshot immediately',()=>{
  const e=marine(),enemy=target(),{nav,movement}=setup(e,[{x:600,y:600,r:200}]);
  e.order.target=enemy;nav.planning.nodeBudget=1;movement.begin();movement.move(e,enemy,dt,160);
  assert.equal(e.movementRequest.target,enemy);
  e.order={kind:'move',x:200,y:900};e.nav=null;movement.begin();movement.move(e,e.order,dt);
  assert.equal(e.movementRequest,null);assert(e.y>600);assert(nav.planning.cancelled>=1);
});
check('Changing target identity replaces its pending pursuit snapshot',()=>{
  const e=marine(),enemy=target(),other=target(950,800),{nav,movement}=setup(e,[{x:600,y:600,r:200}]);
  nav.planning.nodeBudget=1;movement.begin();movement.move(e,enemy,dt,160);
  assert.equal(e.movementRequest.target,enemy);
  movement.begin();movement.move(e,other,dt,160);
  assert.equal(e.movementRequest.target,other);assert(nav.planning.cancelled>=1);
});
console.log(`${checks} movement pursuit fidelity checks passed.`);
