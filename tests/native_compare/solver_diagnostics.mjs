// Isolated measurements of our solver. These are NOT native SC2 references.
import {createMovement,reserveDestinations} from '../../dist/movement.js';

const unit=(id,x,y,team=0)=>({id,x,y,team,r:10.5,hp:45,speed:88.2,
  vx:0,vy:0,angle:0,acceleration:54880,lateralAcceleration:2528,turnRate:24});
const solve=(a,clear=()=>true)=>createMovement({entities:()=>a,
  world:{w:3000,h:3000},clear,openPoint:()=>true,
  path:(e,p)=>[{x:p.x,y:p.y}],navVersion:()=>1});

const moving=unit(1,500,500),enemy=unit(2,519,500,1);
moving.vx=88.2;
let motion=solve([moving,enemy]);motion.begin();motion.collision();
const enemyPush={movingDisplacement:500-moving.x,enemyDisplacement:enemy.x-519};

const leader=unit(1,500,500),idle=unit(2,550,500);
leader.order={kind:'move'};
motion=solve([leader,idle]);motion.begin();motion.move(leader,{x:800,y:500},1/60);
const earlyYield={initialCenterDistance:50,
  idleDisplacement:Math.hypot(idle.x-550,idle.y-500),
  movingDisplacement:Math.hypot(leader.x-500,leader.y-500)};

const pack=Array.from({length:120},(_,i)=>unit(i+1,100+i%12*40,100+Math.floor(i/12)*40));
// The fake wall requires a route request; short actual steps remain clear.
// This isolates scheduler latency from A* CPU costs and geometry.
motion=solve(pack,(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<15);
const first=Array(pack.length).fill(null);
for(let tick=0;tick<40;tick++){
  motion.begin();
  for(let i=0;i<pack.length;i++){
    motion.move(pack[i],{x:1800,y:1600},1/60);
    if(first[i]===null&&Math.hypot(pack[i].vx,pack[i].vy)>0)first[i]=tick;
  }
}
const started=first.filter(v=>v!==null);
const routeScheduling={backend:'legacy synchronous path stub (not the incremental navigator)',units:pack.length,started:started.length,
  firstTick:Math.min(...started),lastTick:Math.max(...started),
  maximumDelaySeconds:Math.max(...started)/60,first16:first.slice(0,16)};

const group=Array.from({length:12},(_,i)=>({u:unit(i+1,500,400+i*23),o:{kind:'move'}}));
reserveDestinations(group,{x:1000,y:500},p=>p);
const arrivalReservations={units:group.length,
  farthestReservationFromClick:Math.max(...group.map(v=>Math.hypot(v.o.arrival.x-1000,v.o.arrival.y-500)))};

console.log(JSON.stringify({engine:'custom-solver-diagnostic',units:'world pixels',
  enemyPush,earlyYield,routeScheduling,arrivalReservations},null,2));
