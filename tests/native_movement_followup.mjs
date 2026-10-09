// Movement regressions at SC2's documented Faster frequency. These verify our
// solver, not equivalence with Blizzard's proprietary pathing implementation.
import assert from 'node:assert/strict';
import {createMovement} from '../dist/movement.js';
import {createNavigation} from '../dist/navigation.js';
import {applyFootprints,surface} from '../dist/geometry.js';
import {PROFILES} from '../dist/unit-profiles.js';

const dt=1/22.4,world={w:2100,h:1600};
const unit=(type,x,y)=>({...PROFILES[type],type,id:1,x,y,hp:45,team:0,
  order:{kind:'move'},vx:0,vy:0,angle:0});
const make=(units,obstacles=[])=>{
  const nav=createNavigation({world,obstacles:()=>obstacles});
  const movement=createMovement({entities:()=>units,world,clear:nav.clear,
    openPoint:nav.open,path:nav.path,navVersion:()=>nav.version});
  return{nav,movement};
};
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};

check('Native-rate infantry accelerates immediately at its catalog speed',()=>{
  const e=unit('marine',700,1000),{movement}=make([e]);
  movement.begin();movement.move(e,{x:1000,y:1000},dt);
  assert(Math.abs(e.x-700-e.speed*dt)<1e-9);
});
check('Native-rate SCV acceleration follows its gradual catalog profile',()=>{
  const e=unit('worker',700,1000),{movement}=make([e]);
  movement.begin();movement.move(e,{x:1000,y:1000},dt);
  assert(Math.abs(e.vx-e.acceleration*dt)<1e-9);assert(e.vx<e.speed);
});
check('All ground profiles stop at short endpoints without overshoot or velocity tails',()=>{
  for(const type of Object.keys(PROFILES))for(const separation of [0,4,5,6,10,21,55]){
    const e=unit(type,700,1000),target={x:700+separation,y:1000},{movement}=make([e]);
    e.vx=e.speed;let reached=false;
    for(let i=0;i<200&&!reached;i++){
      movement.begin();reached=movement.move(e,target,dt);
      assert(e.x<=target.x+1e-7);assert(Number.isFinite(e.x));
    }
    assert(reached,`${type} ${separation}`);assert.equal(e.vx,0);assert.equal(e.vy,0);
  }
});
check('All SCV approach faces reach the actual Command Center polygon contact',()=>{
  const defs=Object.fromEntries(['core','relay','barracks','factory','engineering',
    'refinery','techlab','reactor'].map(type=>[type,{}]));
  applyFootprints(defs);const home={...defs.core,x:700,y:1000};
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16,e=unit('worker',home.x+Math.cos(a)*230,home.y+Math.sin(a)*230);
    e.innerRadius=8.75;const {nav,movement}=make([e],[home]);let reached=false;
    for(let k=0;k<300&&!reached;k++){
      movement.begin();reached=movement.move(e,home,dt,home.r+e.r+.2);
      assert(nav.open(e,e.innerRadius));
    }
    assert(reached,`face ${i}`);const gap=surface(e,home).distance;
    assert(gap>=e.innerRadius-1e-6&&gap<=e.r+2.3,`gap ${gap}`);
  }
});
check('Mobile collision separation keeps stationary hostile units anchored at native cadence',()=>{
  const a=unit('marine',700,1000),b=unit('marine',719,1000);
  b.id=2;b.team=1;b.order=null;a.vx=a.speed;
  const {movement}=make([a,b]);movement.begin();movement.collision();
  assert.equal(b.x,719);assert.equal(b.y,1000);assert(a.x<700);
});
check('120 common-goal movers receive budgeted paths without leaving terrain at native cadence',()=>{
  const units=Array.from({length:120},(_,i)=>({...unit('marine',
    100+i%12*18,100+Math.floor(i/12)*22),id:i+1}));
  const {nav,movement}=make(units,[{x:500,y:300,r:130}]),first=Array(120).fill(null);
  for(let tick=0;tick<12;tick++){
    movement.begin();
    units.forEach((e,i)=>{
      movement.move(e,{x:950,y:300},dt);
      if(first[i]===null&&Math.hypot(e.vx,e.vy)>0)first[i]=tick;
      assert(nav.open(e,e.r));
    });
    assert(nav.planning.expanded<=nav.planning.nodeBudget);
  }
  assert(first.every(t=>t!==null&&t<=2),JSON.stringify(first));
});
console.log(`${checks} focused native-rate movement checks passed.`);
