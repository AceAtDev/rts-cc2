// Native aligned cold-start phase facts; custom repeat admission policy.
import assert from 'node:assert/strict';
import {createCombat} from '../dist/combat.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';
const DT=1/22.4;
const make=(type)=>{
  const p=PROFILES[type];let now=0,loop=0;
  const a={...p,id:1,type,team:0,x:500,y:500,hp:1000,maxhp:1000,
    damage:p.weapon.damage,kills:0,angle:0,turretAngle:0,cooldown:0,backswing:0,
    vx:0,vy:0,vision:10*SCALE,hold:false,orders:[]};
  const t={id:2,type:'marine',team:1,x:500+(type==='worker'?.7998:4)*SCALE,y:500,
    r:.375*SCALE,hp:10000,maxhp:10000,attributes:[],cooldown:0,kills:0};
  a.order={kind:'attack',target:t};const shots=[],moves=[];
  const combat=createCombat({entities:()=>[a,t],visible:()=>true,clock:()=>now,
    research:()=>[{},{}],shots:()=>shots,move:(...args)=>{moves.push(args);return false;}});
  combat.acceptOrder(a);
  return {a,t,combat,shots,moves,get loop(){return loop;},
    step(n=1){for(let i=0;i<n;i++){loop++;now+=DT;combat.begin(DT);combat.engage(a,DT);}}};
};
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
for(const [type,first] of [['marine',2],['worker',4]]){
  check(`Aligned ${type} cold start fires first on loop ${first}`,()=>{
    const h=make(type);h.step();assert(h.a.windup);assert.equal(h.a.windup.remaining,PROFILES[type].weapon.point);
    h.step(first-2);assert.equal(h.t.hp,10000);h.step();assert(h.t.hp<10000);
    assert.equal(h.a.visualShotSerial,1);assert.equal(h.loop,first);
  });
  for(let cancelAt=0;cancelAt<first;cancelAt++){
    check(`${type} Move on loop ${cancelAt} cancels its pending first shot`,()=>{
      const h=make(type);h.step(cancelAt);h.combat.cancel(h.a);h.a.order={kind:'move',x:400,y:500};
      h.step(first+2);assert.equal(h.t.hp,10000);assert.equal(h.a.visualShotSerial,undefined);assert.equal(h.a.windup,null);
    });
  }
  check(`${type} Move after first impact preserves damage and cooldown`,()=>{
    const h=make(type);h.step(first);const hp=h.t.hp,cooldown=h.a.cooldown;
    assert(cooldown>0);h.combat.cancel(h.a);h.a.order={kind:'move',x:400,y:500};
    assert.equal(h.a.cooldown,cooldown);h.step();assert.equal(h.t.hp,hp);
    assert(Math.abs(h.a.cooldown-(cooldown-DT))<1e-8);
  });
  check(`${type} repeat admission preserves quantized catalog base cadence at 22.4 Hz`,()=>{
    const h=make(type),impacts=[];let serial=0;
    for(let i=0;i<80;i++){h.step();if((h.a.visualShotSerial||0)!==serial){serial=h.a.visualShotSerial;impacts.push(h.loop);}}
    const interval=Math.ceil(PROFILES[type].weapon.period/DT-1e-8);
    assert(impacts.length>=3);assert.equal(impacts[0],first);
    for(let i=1;i<impacts.length;i++)assert.equal(impacts[i]-impacts[i-1],interval,JSON.stringify(impacts));
    console.log(JSON.stringify({type,impacts,baseInterval:interval}));
  });
}
for(const type of ['marauder','reaper']){
  check(`${type} zero-point weapon fires immediately on its first eligible loop`,()=>{
    const h=make(type);h.step();assert.equal(h.a.visualShotSerial,1);assert.equal(h.a.windup,null);assert(h.a.cooldown>0);
  });
}
check('Reissuing the same explicit target does not reset an existing positive damage point',()=>{
  const h=make('worker');h.step(2);const phase=h.a.windup;
  h.a.order={kind:'attack',target:h.t};h.combat.acceptOrder(h.a);h.step(2);
  assert.equal(h.a.visualShotSerial,1);assert.equal(h.loop,4);assert.equal(h.a.windup,null);assert(phase.remaining<=0);
});
console.log(`${checks} attack phase fidelity checks passed.`);
