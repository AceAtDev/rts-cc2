// SC2 group-feel follow-up: magic-box convergence, contact arrival, idle
// yielding, immovable-body detours, allied push and blocked ranged approach.
import assert from 'node:assert/strict';
import {reserveDestinations,createMovement} from '../dist/movement.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';

const DT=1/22.4,open=p=>({...p});
let id=1,checks=0;
const unit=(type,x,y,extra={})=>({...PROFILES[type],id:id++,type,hp:45,team:0,x,y,vx:0,vy:0,angle:0,order:null,...extra});
const world=units=>createMovement({entities:()=>units,world:{w:3000,h:3000},clear:()=>true,
  openPoint:()=>true,path:()=>[],navVersion:()=>0});
const command=(units,goal,batch=1,kind='move')=>{
  const movers=units.map(u=>({u,o:{kind,batch,...goal}}));reserveDestinations(movers,goal,open);
  for(const m of movers){m.u.order=m.o;m.u.arrivalBatch=batch;}return movers;
};
const run=(units,movement,loops)=>{
  for(let loop=1;loop<=loops;loop++){
    movement.begin();
    for(const e of units)if(e.order&&movement.move(e,e.order,DT,0)){e.order=null;e.arrived=true;e.vx=e.vy=0;}
    movement.collision();
    if(units.every(e=>!e.order||e.hold))return loop;
  }
  return null;
};
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};

check('A click inside a compact group converges instead of translating offsets',()=>{
  const squad=[0,1,2,3].map(i=>unit('marine',600+i%2*40,600+Math.floor(i/2)*40));
  const movers=command(squad,{x:620,y:620});
  assert(movers.every(m=>m.o.formation==='packed'&&m.o.x===620&&m.o.y===620));
  const away=[0,1,2,3].map(i=>unit('marine',600+i%2*40,600+Math.floor(i/2)*40));
  assert(command(away,{x:1200,y:620},2).every(m=>m.o.formation==='preserved'));
});

check('A spread group settles as one clump inside the native arrival envelope',()=>{
  const units=Array.from({length:32},(_,i)=>unit('marine',1500+i%8*40,180+Math.floor(i/8)*40));
  command(units,{x:1640,y:240});
  const settled=run(units,world(units),60);
  assert(settled!==null&&settled<=45,'settled on loop '+settled);
  // Native 4.10 settled crowds overlap by up to ~0.07 game units.
  for(const a of units)for(const b of units)if(a!==b)assert(Math.hypot(a.x-b.x,a.y-b.y)>a.r+b.r-.1*SCALE);
  const radius=units[0].r*Math.sqrt(32/.8)*2+2*units[0].r;
  assert(units.every(u=>Math.hypot(u.x-1640,u.y-240)<=radius));
});

check('Idle allies are displaced by contact rather than carried to the destination',()=>{
  const movers=Array.from({length:6},(_,i)=>unit('marine',300+i%2*22,600+Math.floor(i/2)*22));
  const idle=unit('marine',420,622);const units=[...movers,idle];
  command(movers,{x:800,y:622});const done=run(units,world(units),240);
  assert(done!==null,'movers arrived');
  assert(idle.x<520,'idle ally was not shoved toward the destination');
});

check('Units pressed against a Hold Position block walk around it; held units never move',()=>{
  const held=Array.from({length:6},(_,i)=>unit('marine',500+i%2*22,580+Math.floor(i/2)*22,{hold:true}));
  const movers=Array.from({length:3},(_,i)=>unit('marine',380,580+i*22));
  const before=held.map(h=>({x:h.x,y:h.y}));const units=[...held,...movers];
  command(movers,{x:800,y:602});
  assert(run(units,world(units),200)!==null,'every mover reached the goal side');
  held.forEach((h,i)=>{assert.equal(h.x,before[i].x);assert.equal(h.y,before[i].y);});
  assert(movers.every(m=>m.x>700));
});

check('Siege Tanks push moving allies instead of splitting the overlap',()=>{
  const tank=unit('tank',500,500,{vx:80,vy:0,order:{kind:'move',x:900,y:500}});
  const marine=unit('marine',500+tank.r+5,500,{vx:-80,vy:0,order:{kind:'move',x:100,y:500}});
  const movement=world([tank,marine]);movement.begin();movement.collision();
  assert(Math.abs(tank.x-500)<Math.abs(marine.x-(500+tank.r+5))/4);
});

// Native 4.10 a_col3_e/_w/_n/_s: in a file attacking one held Marine, the
// second Marine is stopped dead-on by the firing leader; in every heading it
// turns right at full speed along the leader's rim and stops beside it as
// soon as it is in range (the former range-arc slot sent the third unit to
// the opposite flank, which native never does).
check('A ranged unit blocked dead-on by a firing ally slides right along it into range',()=>{
  const enemy=unit('marine',900,600,{team:1});
  const reach=PROFILES.marine.weapon.range+2*PROFILES.marine.r-1;
  const front=unit('marine',900-reach,600,{combatTarget:enemy,firingHold:true});
  const back=unit('marine',front.x-2*PROFILES.marine.r-.5,600,{combatTarget:enemy,order:{kind:'attackMove',x:1200,y:600}});
  const units=[enemy,front,back],movement=world(units);
  movement.begin();movement.move(back,enemy,DT,reach);movement.collision();
  // Browser y points down: a native clockwise (right) turn moves +y here.
  assert(back.vy>back.speed*.9&&Math.abs(back.vx)<back.speed*.3,'turns right at full speed');
  let loops=1;
  for(;loops<40&&Math.hypot(back.x-enemy.x,back.y-enemy.y)>reach+1;loops++){movement.begin();movement.move(back,enemy,DT,reach);movement.collision();}
  assert(loops<20,'reaches range while sliding');
  assert.equal(front.x,900-reach);assert.equal(front.y,600);
  assert(Math.hypot(back.x-front.x,back.y-front.y)<2*front.r+8,'stays beside the leader');
});

console.log(checks+' SC2 group-feel checks passed.');
