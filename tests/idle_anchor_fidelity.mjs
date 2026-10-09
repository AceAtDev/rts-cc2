// Native context/return facts; conservative custom cutoff and return arbitration.
import assert from 'node:assert/strict';
import {createCombat} from '../dist/combat.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';
const DT=1/22.4;
const unit=(id,team,x,type='marine')=>({...PROFILES[type],id,type,team,x,y:500,hp:1000,maxhp:1000,
  damage:PROFILES[type].weapon.damage,kills:0,cooldown:2,angle:0,turretAngle:0,
  vision:9*SCALE,vx:0,vy:0,hold:false,order:null,orders:[]});
const make=(units)=>{
  let now=0;const moves=[];
  const combat=createCombat({entities:()=>units,visible:(e,t)=>!t.hidden,clock:()=>now,research:()=>[{},{}],shots:()=>[],
    move:(e,t,dt,stopAt)=>{
      moves.push({e,t,stopAt});const dx=t.x-e.x,dy=t.y-e.y,d=Math.hypot(dx,dy);
      if(d<=stopAt+1){e.vx=e.vy=0;return true;}
      const advance=Math.min(e.speed*dt,Math.max(0,d-stopAt));e.x+=dx/d*advance;e.y+=dy/d*advance;
      e.vx=dx/d*e.speed;e.vy=dy/d*e.speed;return false;
    }});
  return {combat,moves,step(e,n=1){for(let i=0;i<n;i++){now+=DT;combat.begin(DT);combat.engage(e,DT);combat.flushHelp(DT);}}};
};
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
for(const team of [0,1])check(`Team ${team} idle acquisition remembers its origin and returns after target death`,()=>{
  const a=unit(1,team,500),t=unit(2,1-team,660),h=make([a,t]);h.step(a);
  assert.deepEqual(a.combatAnchor,{x:500,y:500});a.x=760;t.x=900;h.step(a);t.hp=0;
  h.step(a);assert(a.combatReturning);assert(a.x<760);h.step(a,100);
  assert(Math.abs(a.x-500)<=1);assert.equal(a.combatAnchor,null);assert.equal(a.combatReturning,false);assert.equal(a.order,null);
});
check('An idle acquired target remains pursued beyond personal vision when actually visible',()=>{
  const a=unit(1,0,500),t=unit(2,1,660),h=make([a,t]);h.step(a);t.x=820;
  h.step(a);assert.equal(a.combatTarget,t);assert(a.x>500);assert.equal(a.combatReturning,undefined);
});
check('Idle distant pursuit switches to return after the explicit custom 21-unit displacement limit',()=>{
  const a=unit(1,0,500),t=unit(2,1,660),h=make([a,t]);h.step(a);
  a.x=500+21.01*SCALE;t.x=a.x+10*SCALE;const at=a.x;h.step(a);
  assert.equal(a.combatTarget,null);assert(a.combatReturning);assert(a.x<at);assert.equal(h.moves.at(-1).t,a.combatAnchor);
});
for(const kind of ['attackMove','patrol'])check(`${kind} pursuit is retained beyond personal vision and idle displacement cutoff`,()=>{
  const a=unit(1,0,500),t=unit(2,1,660),h=make([a,t]);a.order={kind,x:1800,y:500,origin:{x:500,y:500},out:true};
  const order=a.order,next={kind:'move',x:400,y:500};a.orders=[next];h.step(a);
  a.x=1150;t.x=1480;h.step(a);assert.equal(a.combatTarget,t);assert.equal(a.order,order);assert.deepEqual(a.orders,[next]);
  assert.equal(a.combatAnchor,undefined);assert(a.x>1150);
  t.hp=0;h.step(a);assert.equal(a.combatTarget,null);assert.equal(a.order,order);assert.equal(a.combatReturning,undefined);
});
check('Manual Attack never creates an idle anchor or inherits its movement limit',()=>{
  const a=unit(1,0,500),t=unit(2,1,1200),h=make([a,t]);a.order={kind:'attack',target:t};h.combat.acceptOrder(a);
  h.step(a);a.x=1150;t.x=1450;h.step(a);assert.equal(a.combatTarget,t);assert.equal(a.combatAnchor,undefined);
});
check('Move and Hold overrides clear the former idle anchor',()=>{
  for(const hold of [false,true]){
    const a=unit(1,0,500),t=unit(2,1,660),h=make([a,t]);h.step(a);a.x=800;t.hp=0;h.step(a);assert(a.combatReturning);
    h.combat.cancel(a);a.hold=hold;a.order=hold?null:{kind:'move',x:1100,y:500};const at=a.x;h.step(a);
    assert.equal(a.combatAnchor,null);assert.equal(a.combatReturning,false);assert.equal(a.x,at);
  }
});
check('Defensive idle workers do not create an offensive anchor/return mission',()=>{
  const a=unit(1,0,500,'worker'),t=unit(2,1,521),h=make([a,t]);a.acquireLevel='Defensive';a.response='Flee';
  h.step(a);assert.equal(a.combatTarget,t);assert.equal(a.combatAnchor,undefined);t.hp=0;h.step(a);assert.equal(a.combatReturning,undefined);
});
check('Custom return policy declines a fresh enemy outside weapon range',()=>{
  const a=unit(1,0,500),t=unit(2,1,660),units=[a,t],h=make(units);h.step(a);a.x=850;t.hp=0;
  const nearby=unit(3,1,1020);units.push(nearby);h.step(a);const x=a.x;h.step(a);assert.equal(a.combatTarget,null);assert(a.x<x);
});
check('Custom return policy permits in-range defense, then resumes the same anchor',()=>{
  const a=unit(1,0,500),t=unit(2,1,660),units=[a,t],h=make(units);h.step(a);a.x=850;t.hp=0;h.step(a);
  const threat=unit(3,1,a.x+100);units.push(threat);h.step(a);assert.equal(a.combatTarget,threat);
  assert.deepEqual(a.combatAnchor,{x:500,y:500});const x=a.x;threat.hp=0;h.step(a);assert(a.x<x);
});
check('Fog loss returns idle units without reading the hidden target new location',()=>{
  const a=unit(1,0,500),t=unit(2,1,660),h=make([a,t]);h.step(a);a.x=800;t.hidden=true;t.x=1800;h.step(a);
  assert.equal(a.combatTarget,null);assert.equal(h.moves.at(-1).t,a.combatAnchor);assert(a.x<800);
});
check('Stop establishes a fresh origin rather than returning to the canceled mission',()=>{
  const a=unit(1,0,500),t=unit(2,1,660),h=make([a,t]);h.step(a);a.x=800;h.combat.cancel(a);a.order=null;t.x=960;
  h.step(a);assert.deepEqual(a.combatAnchor,{x:800,y:500});
});
check('Reset clears return missions and origins',()=>{
  const a=unit(1,0,500),t=unit(2,1,660),h=make([a,t]);h.step(a);a.x=800;t.hp=0;h.step(a);
  h.combat.reset();assert.equal(a.combatAnchor,null);assert.equal(a.combatReturning,false);
});
console.log(`${checks} idle anchor fidelity checks passed.`);
