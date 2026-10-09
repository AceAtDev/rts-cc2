// Bounded observations from SC2 4.10.0.75689, plus general solver regressions.
// Optional --trace-dir validates local native captures without publishing them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createMovement,reserveDestinations} from '../dist/movement.js';
import {createNavigation} from '../dist/navigation.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';

const dt=1/22.4,world={w:4000,h:4000};
function fixture(type,length,angle=0){
  const e={...PROFILES[type],id:1,type,team:0,hp:45,x:1000,y:1000,
    vx:0,vy:0,angle,order:{kind:'move',x:1000+Math.cos(angle)*length*SCALE,
      y:1000+Math.sin(angle)*length*SCALE}};
  const movement=createMovement({entities:()=>[e],world,clear:()=>true,
    openPoint:()=>true,path:()=>[],navVersion:()=>0});
  return{e,movement};
}
function trace(type,length,angle=0){
  const {e,movement}=fixture(type,length,angle),out=[];
  for(let loop=1;loop<=1000;loop++){
    movement.begin();const complete=movement.move(e,e.order,dt,0);
    out.push({loop,x:e.x,y:e.y,dx:(e.x-1000)/SCALE,dy:(e.y-1000)/SCALE,complete});
    if(complete)break;
  }
  assert(out.at(-1).complete,`${type}, length ${length} did not finish`);
  return out;
}
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
const observations=[
  ['marine',10,72,73],['marauder',10,72,73],['reaper',10,43,44],['hellion',10,38,39],
  ['worker',1,20,21],['worker',2,24,25],['worker',5,44,45],
  ['worker',10,73,74],['worker',20,129,130],
];

check('Nine observed isolated native trajectories reach exact points before clearing orders',()=>{
  for(const [type,length,arrivalLoop,completeLoop] of observations){
    const out=trace(type,length),arrival=out.find(frame=>Math.abs(frame.dx-length)<1e-10);
    assert.equal(arrival.loop,arrivalLoop,`${type}, ${length} GU arrival`);
    assert.equal(out.at(-1).loop,completeLoop,`${type}, ${length} GU completion`);
    assert.equal(arrival.complete,false);assert.equal(out.at(-1).x,1000+length*SCALE);
  }
});
check('SCV longitudinal braking uses forward acceleration instead of lateral acceleration',()=>{
  const out=trace('worker',10),delta=frame=>frame.dx-(out[frame.loop-2]?.dx||0);
  assert.equal(delta(out[0]),.009765625);
  assert.equal(delta(out[56]),.17578125);
  assert.equal(delta(out[57]),.166015625);
  assert.equal(delta(out[58]),.15625);
  assert.equal(out[65].dx,9.66796875);
  assert.equal(out[71].dx,9.990234375);
});
check('Short SCV moves reaccelerate when the discrete stopping ramp would undershoot',()=>{
  for(const [length,loop,before,after] of [[1,19,.01953125,.029296875],[5,39,.078125,.087890625]]){
    const out=trace('worker',length);
    const delta=i=>out[i-1].dx-(out[i-2]?.dx||0);
    assert.equal(delta(loop-1),before);assert.equal(delta(loop),after);
  }
});
check('Point endpoints remain exact without overshoot across lengths and directions',()=>{
  for(const type of Object.keys(PROFILES))for(const length of [.0001,.01,.1,.5,1,2,5,10,20]){
    for(const angle of [0,Math.PI/4,Math.PI,-Math.PI/3]){
      const out=trace(type,length,angle),expected={x:1000+Math.cos(angle)*length*SCALE,
        y:1000+Math.sin(angle)*length*SCALE};
      for(const frame of out){
        const progress=frame.dx*Math.cos(angle)+frame.dy*Math.sin(angle);
        assert(progress<=length+1e-10);assert(Number.isFinite(frame.x)&&Number.isFinite(frame.y));
      }
      assert.equal(out.at(-1).x,expected.x);assert.equal(out.at(-1).y,expected.y);
    }
  }
});
check('Reserved arrivals preserve placement and their existing crowd tolerance',()=>{
  const {e,movement}=fixture('marine',10);
  e.x=e.order.x-35;e.order.arrival={x:e.order.x,y:e.order.y+30};e.order.arrivalRadius=35;
  let complete=false;
  for(let i=0;i<100&&!complete;i++){movement.begin();complete=movement.move(e,e.order,dt,0);}
  assert(complete);assert(Math.hypot(e.x-e.order.arrival.x,e.y-e.order.arrival.y)<=4);
  assert.deepEqual(e.order.arrival,{x:1280,y:1030});assert.equal(e.pointBrake,null);
});
check('Combat pursuit retains its explicit interaction range without point braking',()=>{
  const {e,movement}=fixture('worker',10),enemy={hp:45,r:10.5,x:1200,y:1000};
  let complete=false;
  for(let i=0;i<100&&!complete;i++){movement.begin();complete=movement.move(e,enemy,dt,32);}
  assert(complete);assert(e.x<enemy.x);assert(Math.abs(enemy.x-e.x-32)<=1);
  assert.equal(e.pointBrake,null);
});
check('A replacement Move discards the previous endpoint braking state',()=>{
  const {e,movement}=fixture('worker',10);
  for(let i=0;i<60;i++){movement.begin();movement.move(e,e.order,dt,0);}
  const before=e.vx,oldOrder=e.order;assert(e.pointBrake.active);
  e.order={kind:'move',x:e.x+20*SCALE,y:e.y};movement.begin();movement.move(e,e.order,dt,0);
  assert(e.vx>before);assert.equal(e.pointBrake.order,e.order);
  assert.notEqual(e.pointBrake.order,oldOrder);assert.equal(e.pointBrake.active,false);
});
check('Reserved 24-unit packs finish around a rock without microscopic slot convergence',()=>{
  for(const step of [1/60,dt]){
    const units=Array.from({length:24},(_,i)=>({...PROFILES.marine,id:i+1,type:'marine',team:0,
      hp:45,x:670+i%6*23,y:570+Math.floor(i/6)*24,vx:0,vy:0,angle:0,
      arrived:false,arrivalBatch:1,order:{kind:'move',x:1140,y:700,batch:1}}));
    const nav=createNavigation({world,obstacles:()=>[{x:870,y:690,r:98}]});
    const movement=createMovement({entities:()=>units,world,clear:nav.clear,
      openPoint:nav.open,path:nav.path,navVersion:()=>nav.version});
    for(const e of units)Object.assign(e,nav.project(e,e.r));
    reserveDestinations(units.map(u=>({u,o:u.order})),{x:1140,y:700},nav.project);
    for(let tick=0;tick<Math.ceil(12/step);tick++){
      movement.begin();
      for(const e of units)if(e.order&&movement.move(e,e.order,step,0)){
        e.order=null;e.arrived=true;e.vx=e.vy=0;
      }
      movement.begin();for(let pass=0;pass<3;pass++)movement.collision();
    }
    assert(units.filter(e=>!e.order).length>=22);
    for(let i=0;i<units.length;i++){
      assert(nav.open(units[i],units[i].r));
      for(let j=i+1;j<units.length;j++)assert(Math.hypot(units[i].x-units[j].x,units[i].y-units[j].y)>=17);
    }
  }
});

const argument=process.argv.indexOf('--trace-dir');
if(argument>=0){
  const directory=process.argv[argument+1];assert(directory,'--trace-dir requires a directory');
  check('Local native captures match every relative position and completion loop',()=>{
    for(const [type,length] of observations){
      const nativeName=type==='worker'?'scv':type;
      const rows=fs.readFileSync(path.join(directory,`${nativeName}-move${length}.jsonl`),'utf8')
        .trim().split('\n').map(line=>JSON.parse(line));
      const metadata=rows.find(row=>row.kind==='metadata');
      assert.equal(metadata.game_version,'4.10.0.75689');assert.equal(metadata.loops_per_second,22.4);
      const frames=rows.filter(row=>row.kind==='frame'),origin=frames[0].units.unit,out=trace(type,length);
      let maxError=0;
      for(const frame of out){
        const observed=frames.find(row=>row.loop===frame.loop).units.unit;
        maxError=Math.max(maxError,Math.abs(frame.dx-(observed.x-origin.x)),
          Math.abs(frame.dy-(observed.y-origin.y)));
        assert.equal(frame.complete,!observed.orders.length);
      }
      assert(maxError<1e-10,`${type}, ${length} GU max error ${maxError}`);
    }
  });
}
console.log(`${checks} native arrival fidelity checks passed.`);
