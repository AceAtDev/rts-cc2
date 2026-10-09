// Regressions for the custom contact solver. These are not native trajectory claims.
import assert from 'node:assert/strict';
import {createMovement} from '../dist/movement.js';
import {createNavigation} from '../dist/navigation.js';
import {createCombat} from '../dist/combat.js';
import {PROFILES} from '../dist/unit-profiles.js';

const dt=1/22.4,world={w:2100,h:1400},distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function pack(far=false){
  let clock=0;
  const target={...PROFILES.marine,id:100,type:'marine',team:1,hp:100000,maxhp:100000,
    armor:0,x:far?1000:870,y:far?700:1040,vx:0,vy:0,angle:Math.PI,hold:true,damage:0};
  const units=Array.from({length:12},(_,i)=>({...PROFILES.worker,id:i+1,type:'worker',team:0,
    hp:45,maxhp:45,armor:0,x:far?600+i%3*25:690+i%4*25,
    y:far?650+Math.floor(i/3)*28:980+Math.floor(i/4)*25,vx:0,vy:0,angle:0,
    order:{kind:'attack',target},orders:[],cooldown:0,damage:5}));
  const entities=[...units,target],nav=createNavigation({world,obstacles:()=>[]});
  const movement=createMovement({entities:()=>entities,world,clear:nav.clear,openPoint:nav.open,
    path:nav.path,navVersion:()=>nav.version});
  const combat=createCombat({entities:()=>entities,visible:()=>true,move:movement.move,
    research:()=>[{},{}],shots:()=>[],clock:()=>clock});
  const contributors=new Set();
  function tick(count){for(let i=0;i<count;i++){
    clock+=dt;movement.begin();combat.begin(dt);
    for(const e of units)if(e.hp>0){combat.engage(e,dt);if(e.cooldown>0)contributors.add(e.id);}
    movement.begin();for(let pass=0;pass<3;pass++)movement.collision();
  }}
  return{units,target,movement,contributors,tick};
}
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS',name);}

check('Twelve explicit SCV attackers find at least six legal melee contacts from two approaches',()=>{
  for(const far of [false,true]){
    const f=pack(far);f.tick(500);
    assert(f.contributors.size>=6,`contributors=${f.contributors.size}`);
    assert(f.target.hp<99500);
    for(const e of f.units){assert(distance(e,f.target)>=e.r+f.target.r+.49);assert.equal(e.order.target,f.target);}
    for(let i=0;i<f.units.length;i++)for(let j=i+1;j<f.units.length;j++)assert(distance(f.units[i],f.units[j])>21.4);
  }
});
check('A full surround settles instead of rear attackers pushing firing allies or circling forever',()=>{
  const f=pack();f.tick(350);
  const positions=f.units.map(e=>({x:e.x,y:e.y})),hp=f.target.hp;
  f.tick(100);assert(f.target.hp<hp);
  assert(f.units.every((e,i)=>distance(e,positions[i])<.25));
  assert(f.units.every(e=>Math.hypot(e.vx,e.vy)<1));
});
check('Waiting melee attackers occupy contact space released by a dead front attacker',()=>{
  const f=pack();f.tick(300);const prior=new Set(f.contributors);
  const front=f.units.filter(e=>e.cooldown>0);assert(front.length>=6);
  front[0].hp=0;front[1].hp=0;f.tick(250);
  assert([...f.contributors].some(id=>!prior.has(id)));
});
check('Direct Move immediately abandons a stalled contact recovery',()=>{
  const f=pack();f.tick(300);const e=f.units.find(e=>e.pursuitState&&e.cooldown===0);assert(e);
  const origin={x:e.x,y:e.y};e.combatTarget=null;e.order={kind:'move',x:e.x-200,y:e.y-100};
  f.movement.begin();f.movement.move(e,e.order,dt,0);
  assert.equal(e.pursuitState,null);assert(distance(e,origin)>0);
});
check('A target leaving a full surround resumes ordinary pursuit immediately',()=>{
  const f=pack();f.tick(300);const waiting=f.units.filter(e=>e.pursuitState&&e.cooldown===0);
  assert(waiting.length>0);const positions=waiting.map(e=>({x:e.x,y:e.y}));
  f.target.x+=180;f.tick(1);
  assert(waiting.every((e,i)=>distance(e,positions[i])>0));
  assert(waiting.every(e=>e.pursuitState.angle===undefined));
});
check('Ranged pursuit never replaces its range endpoint with a melee contact slot',()=>{
  const e={...PROFILES.marine,id:1,type:'marine',team:0,hp:45,x:500,y:500,vx:0,vy:0,angle:0};
  const target={...PROFILES.marine,id:2,type:'marine',team:1,hp:45,x:900,y:500};
  e.order={kind:'attack',target};e.combatTarget=target;
  const movement=createMovement({entities:()=>[e,target],world,clear:()=>true,
    openPoint:()=>true,path:()=>[],navVersion:()=>0});
  for(let i=0;i<100;i++){movement.begin();movement.move(e,target,dt,e.weapon.range+e.r+target.r-1);}
  assert.equal(e.pursuitState,null);assert(distance(e,target)>e.r+target.r+100);
});
check('Final collision projection prevents later friendly settling from reentering held bodies',()=>{
  const target={...PROFILES.marine,id:2,hp:45,team:1,x:500,y:500,vx:0,vy:0,hold:true};
  const a={...PROFILES.marine,id:1,hp:45,team:0,x:480,y:500,vx:88.2,vy:0};
  const b={...PROFILES.marine,id:3,hp:45,team:0,x:460,y:500,vx:88.2,vy:0};
  const movement=createMovement({entities:()=>[a,target,b],world,clear:()=>true,
    openPoint:()=>true,path:()=>[],navVersion:()=>0});
  movement.begin();movement.collision();
  assert.equal(target.x,500);assert(distance(a,target)>=21.5-1e-9);
});
check('An aligned Tank steers around a held ally without restarting stationary alignment every frame',()=>{
  const e={...PROFILES.tank,id:1,type:'tank',team:0,hp:150,x:500,y:500,vx:0,vy:0,angle:0,
    order:{kind:'move',x:900,y:500}};
  const ally={...PROFILES.marine,id:2,team:0,hp:45,x:600,y:500,vx:0,vy:0,hold:true};
  const movement=createMovement({entities:()=>[e,ally],world,clear:()=>true,
    openPoint:()=>true,path:()=>[],navVersion:()=>0});
  let stationary=0;
  for(let i=0;i<150;i++){
    movement.begin();const origin={x:e.x,y:e.y};const complete=movement.move(e,e.order,dt,0);
    if(complete)break;
    movement.begin();movement.collision();
    if(distance(e,origin)<1e-6)stationary++;
    assert(distance(e,ally)>=e.r+ally.r+.5-1e-6);
  }
  assert(e.x>800,`Tank remained at ${e.x},${e.y}`);assert(stationary<5,`stopped ${stationary} frames`);
});
console.log(`${checks} movement contact fidelity checks passed.`);
