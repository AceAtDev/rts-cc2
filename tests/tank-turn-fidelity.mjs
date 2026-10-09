// Native SC2 4.10 stationary-facing fixtures plus order integration regressions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createMovement} from '../dist/movement.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';

const dt=1/22.4,world={w:3000,h:3000};
const fixture=(type='tank',angle=0)=>{
  const e={...PROFILES[type],id:1,type,team:0,hp:150,x:1000,y:1000,vx:0,vy:0,
    angle,order:{kind:'move',x:1280,y:1000}};
  const movement=createMovement({entities:()=>[e],world,clear:()=>true,
    openPoint:()=>true,path:()=>[],navVersion:()=>0});
  return{e,movement};
};
const angularDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function trace(angle){
  const {e,movement}=fixture('tank',angle),out=[];
  for(let loop=1;loop<150;loop++){
    movement.begin();const complete=movement.move(e,e.order,dt,0);
    out.push({loop,dx:(e.x-1000)/SCALE,angle:e.angle,complete});
    if(complete)break;
  }
  return out;
}
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};

check('Tank profiles separate stationary turning from moving turning',()=>{
  assert.equal(PROFILES.tank.turnBeforeMove,true);
  assert.equal(PROFILES.tank.stationaryTurnRate,720*Math.PI/180*1.4);
  assert.equal(PROFILES.tank.turnRate,360*Math.PI/180*1.4);
});
check('Stationary Tank east, north and west starts match native 1, 2 and 4 loop observations',()=>{
  for(const [angle,start,complete] of [[0,1,73],[Math.PI/2,2,74],[Math.PI,4,76]]){
    const out=trace(angle);assert.equal(out.find(frame=>frame.dx>0).loop,start);
    assert.equal(out.at(-1).loop,complete);assert.equal(out.at(-1).dx,10);
    assert.equal(out[start-1].dx,.140625);
  }
});
check('Turn-gated Tanks translate on the alignment loop rather than adding another delay',()=>{
  const {e,movement}=fixture('tank',Math.PI/2);
  movement.begin();movement.move(e,e.order,dt,0);assert.equal(e.x,1000);
  assert(angularDistance(e.angle,Math.PI/4)<1e-12);
  movement.begin();movement.move(e,e.order,dt,0);assert(e.x>1000);
  assert(angularDistance(e.angle,0)<1e-12);
});
check('A new perpendicular waypoint makes a Tank face that waypoint before advancing',()=>{
  const {e,movement}=fixture();movement.begin();movement.move(e,e.order,dt,0);
  const origin={x:e.x,y:e.y};e.order={kind:'move',x:e.x,y:e.y+280};e.nav=null;
  movement.begin();movement.move(e,e.order,dt,0);
  assert.equal(e.x,origin.x);assert.equal(e.y,origin.y);
  movement.begin();movement.move(e,e.order,dt,0);assert(e.y>origin.y);
});
check('Combat pursuit uses the same Tank body turn gate without replacing its target',()=>{
  const {e,movement}=fixture('tank',Math.PI/2),enemy={hp:45,r:10.5,x:1450,y:1000};
  e.order={kind:'attack',target:enemy};e.combatTarget=enemy;
  const stop=e.weapon.range+e.r+enemy.r-1;
  movement.begin();movement.move(e,enemy,dt,stop);assert.equal(e.x,1000);
  movement.begin();movement.move(e,enemy,dt,stop);assert(e.x>1000);
  assert.equal(e.order.target,enemy);assert.equal(e.combatTarget,enemy);
});
check('Infantry facing changes do not introduce a Tank-style translation gate',()=>{
  for(const type of ['marine','marauder','reaper'])for(const angle of [Math.PI/2,Math.PI]){
    const {e,movement}=fixture(type,angle);movement.begin();movement.move(e,e.order,dt,0);
    assert(Math.abs(e.x-1000-e.speed*dt)<1e-10);assert.equal(e.y,1000);
  }
});
check('A moving Tank reversal stops for three turn updates and resumes on the fourth',()=>{
  const {e,movement}=fixture();
  for(let i=0;i<10;i++){movement.begin();movement.move(e,e.order,dt,0);}
  const before={x:e.x,y:e.y};e.order={kind:'move',x:720,y:1000};e.nav=null;
  for(let i=0;i<3;i++){
    movement.begin();movement.move(e,e.order,dt,0);
    assert.equal(e.x,before.x);assert.equal(e.y,before.y);assert.equal(e.vx,0);
  }
  movement.begin();movement.move(e,e.order,dt,0);assert.equal(before.x-e.x,.140625*SCALE);
});

const argument=process.argv.indexOf('--trace-dir');
if(argument>=0){
  const directory=process.argv[argument+1];assert(directory,'--trace-dir requires a directory');
  check('Native Tank facing captures match every relative position and order lifetime',()=>{
    for(const name of ['tank-east-aligned','tank-north-facing','tank-west-facing']){
      const rows=fs.readFileSync(path.join(directory,`${name}.jsonl`),'utf8')
        .trim().split('\n').map(line=>JSON.parse(line));
      const metadata=rows.find(row=>row.kind==='metadata');
      assert.equal(metadata.game_version,'4.10.0.75689');assert.equal(metadata.loops_per_second,22.4);
      const frames=rows.filter(row=>row.kind==='frame'),origin=frames[0].units.unit;
      for(const frame of trace(origin.facing)){
        const observed=frames.find(row=>row.loop===frame.loop).units.unit;
        assert.equal(frame.dx,observed.x-origin.x);
        assert.equal(frame.complete,!observed.orders.length);
        assert(angularDistance(frame.angle,observed.facing)<.001);
      }
    }
  });
}
const reversalArgument=process.argv.indexOf('--reversal-trace');
if(reversalArgument>=0){
  const filename=process.argv[reversalArgument+1];assert(filename,'--reversal-trace requires a file');
  check('Native moving Tank reversal matches relative positions and order lifetime',()=>{
    const rows=fs.readFileSync(filename,'utf8').trim().split('\n').map(line=>JSON.parse(line));
    const metadata=rows.find(row=>row.kind==='metadata');assert.equal(metadata.game_version,'4.10.0.75689');
    const frames=rows.filter(row=>row.kind==='frame'),origin=frames[0].units.unit;
    const {e,movement}=fixture('tank',origin.facing);
    for(const frame of frames.slice(1)){
      if(frame.loop===11){e.order={kind:'move',x:720,y:1000};e.nav=null;}
      movement.begin();const complete=movement.move(e,e.order,dt,0),observed=frame.units.unit;
      assert.equal((e.x-1000)/SCALE,observed.x-origin.x);
      assert.equal(complete,!observed.orders.length);
    }
  });
}
console.log(`${checks} Tank turn fidelity checks passed.`);
