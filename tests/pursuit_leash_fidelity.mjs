// Native-fitted pursuit rules: target-distance drop, Marauder RangeSlop hold
// and heading changes at full speed (tests/native_compare e_ fixtures).
import assert from 'node:assert/strict';
import {createCombat} from '../dist/combat.js';
import {createMovement} from '../dist/movement.js';
import {createNavigation} from '../dist/navigation.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';
const DT=1/22.4;
const unit=(id,type,team,x,y=42)=>({...PROFILES[type],id,type,team,x:x*SCALE,y:y*SCALE,px:x*SCALE,py:y*SCALE,
  hp:1000,maxhp:1000,damage:PROFILES[type].weapon.damage,kills:0,cooldown:0,
  angle:0,turretAngle:0,vx:0,vy:0,vision:9*SCALE,hold:false,order:null,orders:[],scanPhase:0});
const make=(units)=>{
  let time=0,loop=0;const moves=[];
  const combat=createCombat({entities:()=>units,visible:()=>true,clock:()=>time,research:()=>[{},{}],shots:()=>[],
    move:(e,t,dt)=>{moves.push({id:e.id,loop,target:t});return false;}});
  return {combat,moves,get loop(){return loop;},
    step(n=1){for(let i=0;i<n;i++){time+=DT;loop++;combat.begin(DT);for(const e of units){e.px=e.x;e.py=e.y;}
      for(const e of units)combat.engage(e,DT);combat.flushHelp(DT);}}};
};
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};

for(const [gap,dropped] of [[21.9,false],[22.1,true]])check(`A pursued target ${gap} away (centers) is ${dropped?'dropped':'kept'} on the next scan`,()=>{
  // Native e_drop_*: dropped at 21.97..22.4 between centers, kept at 20.9..22.02.
  const chaser=unit(1,'marauder',0,30),target=unit(2,'hellion',1,30+gap);target.damage=0;
  chaser.combatTarget=target;chaser.combatAnchor={x:24*SCALE,y:42*SCALE};
  const h=make([target,chaser]);h.step(8);
  assert.equal(chaser.combatTarget===target,!dropped);
  if(dropped)assert.equal(chaser.combatReturning,true);
});
check('A Marauder holds after its shot while the target is within range + 1, then chases',()=>{
  // Native e_drop_marauder*: kept at 6.80..6.97, left at 7.04..7.24 (range 6).
  const chaser=unit(1,'marauder',0,30),target=unit(2,'hellion',1,30+.5625+.625+5);target.damage=0;chaser.combatTarget=target;
  const h=make([target,chaser]);h.step(2);assert.ok(chaser.cooldown>0,'fired');
  target.x=(30+.5625+.625+6.9)*SCALE;h.step(3);assert.equal(h.moves.length,0);
  target.x=(30+.5625+.625+7.1)*SCALE;h.step();assert.equal(h.moves.at(-1)?.id,1);
});
check('A Marine with a backswing chases one loop after it ends, beyond plain range',()=>{
  // Native e_switch_amove: chase at 5.52 (range 5), 13 loops after the shot loop.
  const chaser=unit(1,'marine',0,30),target=unit(2,'hellion',1,30+1+4.5);target.damage=0;chaser.combatTarget=target;
  const h=make([target,chaser]);while(!chaser.visualShotSerial&&h.loop<5)h.step();const shot=h.loop;assert.equal(chaser.visualShotSerial,1);
  target.x=(30+1+5.5)*SCALE;h.step(12);assert.equal(h.moves.length,0);h.step();assert.equal(h.moves[0].loop,shot+13);
});
check('A low-acceleration SCV reverses at full speed in one loop',()=>{
  // Native c_switch_idle / e_switch_*: an SCV running west at 0.1758/loop and
  // ordered east moves 0.1757/loop east on the next loop.
  const world={w:2100,h:1400},nav=createNavigation({world,obstacles:()=>[]});
  const scv={...PROFILES.worker,id:1,type:'worker',team:1,x:1000,y:700,hp:45,angle:Math.PI,vx:-PROFILES.worker.speed,vy:0,order:null,orders:[]};
  const movement=createMovement({entities:()=>[scv],world,clear:nav.clear,openPoint:nav.open,path:nav.path,navVersion:()=>nav.version});
  scv.order={kind:'move',x:1600,y:700};movement.begin();movement.move(scv,scv.order,DT,0);
  assert.ok(Math.abs(scv.vx-PROFILES.worker.speed)<1e-6&&Math.abs(scv.vy)<1e-6,`vx ${scv.vx}`);
});
console.log(`${checks} pursuit and leash checks passed.`);
