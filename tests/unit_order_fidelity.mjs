// Order intent, visibility and acquisition regressions, not native traces.
import assert from 'node:assert/strict';
import {createCombat} from '../dist/combat.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';
const unit=(id,x,team=0,type='marine')=>({...PROFILES[type],id,type,x,y:500,team,
  hp:1000,maxhp:1000,damage:PROFILES[type].weapon.damage,cooldown:0,backswing:0,
  angle:0,turretAngle:0,vx:0,vy:0,kills:0,hold:false,vision:9*SCALE,
  order:null,orders:[]});
const make=(units)=>{
  let now=0;const moves=[],shots=[];
  const combat=createCombat({entities:()=>units,visible:(e,t)=>!t.hidden,
    move:(e,t,dt,range)=>{moves.push({e,t,range});return false;},
    research:()=>[{},{}],shots:()=>shots,clock:()=>now});
  return {combat,moves,shots,step(e,dt=1/22.4){now+=dt;combat.begin(dt);return combat.engage(e,dt);}};
};
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};

check('An accepted visible target can vanish before its first loop without stranding Attack',()=>{
  const a=unit(1,500),b=unit(2,700,1),h=make([a,b]);a.order={kind:'attack',target:b};
  h.combat.acceptOrder(a);b.hidden=true;b.x=1100;h.step(a);
  assert.equal(a.order.kind,'attackMove');assert.equal(a.order.x,700);assert.equal(a.order.y,500);
});
check('Order acceptance never snapshots a target already hidden',()=>{
  const a=unit(1,500),b=unit(2,700,1),h=make([a,b]);b.hidden=true;a.order={kind:'attack',target:b};
  h.combat.acceptOrder(a);assert.equal(a.attackLastSeen,undefined);
});
check('Activation preserves an accepted queued last-seen seed when its target is now hidden',()=>{
  const a=unit(1,500),b=unit(2,1100,1),h=make([a,b]);b.hidden=true;
  a.order={kind:'attack',target:b,lastSeen:{x:700,y:500}};a.attackLastSeen={...a.order.lastSeen};
  h.combat.acceptOrder(a);h.step(a);assert.equal(a.order.kind,'attackMove');assert.equal(a.order.x,700);
  assert.deepEqual(a.order.lastSeen,{x:700,y:500});
});
check('Active manual attacks refresh their order endpoint only while the target is visible',()=>{
  const a=unit(1,500),b=unit(2,700,1),h=make([a,b]);a.order={kind:'attack',target:b,lastSeen:{x:660,y:500}};
  h.step(a);assert.deepEqual(a.order.lastSeen,{x:700,y:500});b.x=730;h.step(a);
  assert.deepEqual(a.order.lastSeen,{x:730,y:500});b.hidden=true;b.x=1100;h.step(a);
  assert.deepEqual(a.order.lastSeen,{x:730,y:500});assert.equal(a.order.x,730);
});
check('Fog fallback preserves command-loop metadata and the queued successor',()=>{
  const a=unit(1,500),b=unit(2,700,1),h=make([a,b]);
  a.order={kind:'attack',target:b,acceptedLoop:42,startedLoop:43,batch:8};
  const next={kind:'move',x:400,y:500};a.orders=[next];h.combat.acceptOrder(a);b.hidden=true;h.step(a);
  assert.equal(a.order.acceptedLoop,42);assert.equal(a.order.startedLoop,43);assert.equal(a.order.batch,8);
  assert.deepEqual(a.orders,[next]);
});
check('Fog fallback has no live target reference for Shift waypoint rendering',()=>{
  const a=unit(1,500),b=unit(2,700,1),h=make([a,b]);a.order={kind:'attack',target:b};
  h.combat.acceptOrder(a);b.hidden=true;h.step(a);b.x=1200;
  assert(!Object.hasOwn(a.order,'target'));assert.equal(a.order.x,700);assert.equal(a.attackTargetMemory,b);
});
check('Reappearing explicit target overrides a nearer automatic opportunity',()=>{
  const a=unit(1,500),b=unit(2,660,1),nearer=unit(3,610,1),h=make([a,b,nearer]);
  a.order={kind:'attack',target:b,acceptedLoop:42};h.combat.acceptOrder(a);b.hidden=true;h.step(a);
  h.step(a);assert.equal(a.combatTarget,nearer);b.hidden=false;h.step(a);
  assert.equal(a.order.kind,'attack');assert.equal(a.order.target,b);assert.equal(a.combatTarget,b);
  assert.equal(a.order.acceptedLoop,42);assert.equal(a.attackTargetMemory,null);
});
check('Canceling the fallback clears target memory instead of restoring it during a new move',()=>{
  const a=unit(1,500),b=unit(2,660,1),h=make([a,b]);a.order={kind:'attack',target:b};
  h.combat.acceptOrder(a);b.hidden=true;h.step(a);h.combat.cancel(a);a.order={kind:'move',x:400,y:500};
  b.hidden=false;assert.equal(h.step(a),false);assert.equal(a.order.kind,'move');assert.equal(a.attackTargetMemory,null);
});
check('Dead explicit target is never converted into a new aggressive objective by combat',()=>{
  const a=unit(1,500),b=unit(2,660,1),h=make([a,b]);a.order={kind:'attack',target:b};
  h.combat.acceptOrder(a);b.hp=0;h.step(a);assert.equal(a.attackTargetMemory,null);assert.equal(a.order.kind,'attack');
  // game.js completes dead target orders before engage, promoting Shift queue.
});
check('Unseen target death before the first loop produces the same last-seen fallback as survival',()=>{
  const states=[];
  for(const hp of [1000,0]){
    const a=unit(1,500),b=unit(2,700,1),h=make([a,b]);a.order={kind:'attack',target:b,acceptedLoop:42};
    h.combat.acceptOrder(a);b.hidden=true;b.x=1100;b.hp=hp;h.step(a);
    states.push({...a.order});assert.equal(a.attackTargetMemory,b);
  }
  assert.deepEqual(states[0],states[1]);assert.equal(states[0].kind,'attackMove');assert.equal(states[0].x,700);
});
check('A target dying after fallback stays remembered while its death remains unseen',()=>{
  const a=unit(1,500),b=unit(2,700,1),h=make([a,b]);a.order={kind:'attack',target:b};
  h.combat.acceptOrder(a);b.hidden=true;h.step(a);const fallback=a.order;b.hp=0;
  for(let i=0;i<5;i++)h.step(a);assert.equal(a.order,fallback);assert.equal(a.attackTargetMemory,b);
});
check('An observed dead remembered target restores explicit completion intent for the order executor',()=>{
  const a=unit(1,500),b=unit(2,700,1),h=make([a,b]);a.order={kind:'attack',target:b,acceptedLoop:42};
  h.combat.acceptOrder(a);b.hidden=true;h.step(a);b.hp=0;b.hidden=false;assert.equal(h.step(a),false);
  assert.equal(a.order.kind,'attack');assert.equal(a.order.target,b);assert.equal(a.order.acceptedLoop,42);
  assert.equal(a.attackTargetMemory,null);assert.equal(h.moves.length,0);
});
check('Friendly target death is known even outside the enemy-visibility callback',()=>{
  const a=unit(1,500),b=unit(2,700,0),h=make([a,b]);a.order={kind:'attack',target:b};
  h.combat.acceptOrder(a);b.hidden=true;b.hp=0;assert.equal(h.step(a),false);
  assert.equal(a.order.kind,'attack');assert.equal(a.order.target,b);assert.equal(a.attackTargetMemory,null);
});
check('An acquired automatic target remains stable beyond the scan-plus-slop boundary',()=>{
  const a=unit(1,500),b=unit(2,660,1),h=make([a,b]);a.order={kind:'attackMove',x:1100,y:500};
  a.cooldown=2;h.step(a);assert.equal(a.combatTarget,b);b.x=730;
  for(let i=0;i<20;i++){h.step(a);assert.equal(a.combatTarget,b);}
  assert(h.moves.length>=20);
});
check('Visible automatic pursuit retains its target beyond personal vision distance',()=>{
  const a=unit(1,500),b=unit(2,660,1),h=make([a,b]);h.step(a);b.x=800;
  assert.equal(h.step(a),true);assert.equal(a.combatTarget,b);b.hidden=true;
  assert.equal(h.step(a),false);assert.equal(a.combatTarget,null);
});
check('Acquisition scan remains strict for enemies never previously acquired',()=>{
  const a=unit(1,500),b=unit(2,730,1),h=make([a,b]);
  assert.equal(h.step(a),false);assert.equal(a.combatTarget,null);
});
check('Hold releases an acquired target as soon as firing range and windup slop expire',()=>{
  const a=unit(1,500),b=unit(2,650,1),h=make([a,b]);a.hold=true;h.step(a);b.x=730;
  assert.equal(h.step(a),false);assert.equal(h.moves.length,0);
});
check('Equal-priority initial targets are ranked by footprint contact distance',()=>{
  const a=unit(1,500),small=unit(2,620,1),large=unit(3,625,1,'tank'),h=make([a,small,large]);
  h.step(a);assert.equal(a.combatTarget,large);
});
check('An explicit target-priority catalog field overrides coarse type fallback',()=>{
  const a=unit(1,500),near=unit(2,600,1),important=unit(3,650,1),h=make([a,near,important]);
  near.attackTargetPriority=11;important.attackTargetPriority=20;h.step(a);assert.equal(a.combatTarget,important);
});
check('Equal-priority closer enemies do not steal an established target during pursuit',()=>{
  const a=unit(1,500),original=unit(2,660,1),h=make([a,original]);h.step(a);
  original.x=730;const nearer=unit(3,600,1);h.step(a);assert.equal(a.combatTarget,original);
});
check('Explicit Move suppresses target reacquisition even inside firing range',()=>{
  const a=unit(1,500),b=unit(2,600,1),h=make([a,b]);a.order={kind:'move',x:1000,y:500};
  for(let i=0;i<10;i++)assert.equal(h.step(a),false);assert.equal(b.hp,1000);
});
check('An explicit Move cancels backswing without resetting weapon cooldown',()=>{
  const a=unit(1,500),b=unit(2,600,1),h=make([a,b]);a.order={kind:'attack',target:b};h.step(a);h.step(a);
  const cooldown=a.cooldown;assert(cooldown>0);assert(a.backswing>0);h.combat.cancel(a);
  a.order={kind:'move',x:400,y:500};assert.equal(a.backswing,0);assert.equal(a.cooldown,cooldown);
  assert.equal(h.step(a),false);
});
console.log(`${checks} unit order fidelity checks passed.`);
