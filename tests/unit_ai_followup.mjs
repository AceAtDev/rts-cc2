// Reference-backed order semantics and bounded custom retaliation policy.
// These regressions do not establish native-client trajectory equivalence.
import assert from 'node:assert/strict';
import {createCombat} from '../dist/combat.js';
import {PROFILES,SIEGE_WEAPON,SCALE} from '../dist/unit-profiles.js';

let checks=0;
function check(name,fn){fn();checks++;console.log('PASS',name);}
const unit=(id,x,team=0,type='marine')=>({...PROFILES[type],id,type,x,y:500,team,
  hp:1000,maxhp:1000,damage:PROFILES[type].weapon.damage,cooldown:0,backswing:0,
  angle:0,turretAngle:0,vx:0,vy:0,kills:0,hold:false,vision:9*SCALE,
  order:null,orders:[]});
const make=(units)=>{
  let now=0;const moves=[],events=[];
  const combat=createCombat({entities:()=>units,visible:(e,t)=>!t.hidden,
    move:(e,t,dt,range)=>{moves.push({e,t,range});e.vx=30;return false;},
    research:()=>[{},{}],shots:()=>events,clock:()=>now});
  return {combat,moves,events,step(e,dt=1/60){now+=dt;combat.begin(dt);return combat.engage(e,dt);},
    hurt(e,attacker){e.lastAttacker=attacker;e.lastDamageAt=now+.001;}};
};

check('Idle infantry retaliates against visible fire outside ordinary scan',()=>{
  const a=unit(1,500),b=unit(2,720,1),h=make([a,b]);h.hurt(a,b);
  assert(h.step(a));assert.equal(a.combatTarget,b);assert.equal(h.moves.length,1);
});
check('Response target stays acquired while closing beyond ordinary scan',()=>{
  const a=unit(1,500),b=unit(2,720,1),h=make([a,b]);h.hurt(a,b);
  for(let i=0;i<20;i++){h.step(a);assert.equal(a.combatTarget,b);}
});
check('Retaliation never chases a hidden attacker or its live coordinates',()=>{
  const a=unit(1,500),b=unit(2,720,1),h=make([a,b]);h.hurt(a,b);h.step(a);
  b.hidden=true;b.x=740;assert.equal(h.step(a),false);assert.equal(a.combatTarget,null);
  assert.equal(h.moves.length,1);
});
check('Response pursuit is bounded by vision rather than unlimited last-attacker chase',()=>{
  const a=unit(1,500),b=unit(2,800,1),h=make([a,b]);h.hurt(a,b);
  assert.equal(h.step(a),false);assert.equal(h.moves.length,0);
});
check('Attack-move and patrol retain their destinations during retaliation',()=>{
  for(const kind of ['attackMove','patrol']){
    const a=unit(1,500),b=unit(2,720,1),h=make([a,b]);
    const order=a.order={kind,x:1000,y:500,origin:{x:500,y:500},out:true};
    const next={kind:'move',x:1200,y:500};a.orders=[next];h.hurt(a,b);h.step(a);
    assert.equal(a.combatTarget,b);assert.equal(a.order,order);assert.deepEqual(a.orders,[next]);
    b.hidden=true;assert.equal(h.step(a),false);assert.equal(a.order,order);
  }
});
check('Move, Follow, Land and Flee suppress response and cancel a pending windup',()=>{
  for(const kind of ['move','follow','land','flee']){
    const a=unit(1,500),b=unit(2,600,1),h=make([a,b]);
    a.order={kind,target:b};a.windup={target:b,remaining:.1};h.hurt(a,b);
    assert.equal(h.step(a),false);assert.equal(a.combatTarget,null);assert.equal(a.windup,null);
    a.order=null;b.x=720;assert.equal(h.step(a),false); // No stale damage response.
    assert.equal(h.moves.length,0);
  }
});
check('Hold does not retaliate beyond weapon range',()=>{
  const a=unit(1,500),b=unit(2,720,1),h=make([a,b]);a.hold=true;h.hurt(a,b);
  assert.equal(h.step(a),false);assert.equal(h.moves.length,0);
});
check('An anchored explicit attack zeroes velocity without pursuing',()=>{
  for(const flag of ['hold','sieged','building']){
    const a=unit(1,500),b=unit(2,1200,1),h=make([a,b]);a[flag]=true;
    a.order={kind:'attack',target:b};a.vx=30;a.vy=15;h.step(a);
    assert.equal(a.vx,0);assert.equal(a.vy,0);assert.equal(h.moves.length,0);
  }
});
check('Defensive/Flee SCVs do not acquire retaliation pursuit',()=>{
  const a=unit(1,500,0,'worker'),b=unit(2,600,1),h=make([a,b]);
  a.acquireLevel='Defensive';a.response='Flee';h.hurt(a,b);
  assert.equal(h.step(a),false);assert.equal(h.moves.length,0);
});
check('Equal-priority attacker never steals a valid existing combat target',()=>{
  const a=unit(1,500),current=unit(2,600,1),attacker=unit(3,720,1),h=make([a,current,attacker]);
  a.combatTarget=current;h.hurt(a,attacker);h.step(a);assert.equal(a.combatTarget,current);
});
check('Military retaliation can replace a low-priority structure',()=>{
  const a=unit(1,500),structure={...unit(2,620,1),building:true,damage:0},attacker=unit(3,720,1);
  const h=make([a,structure,attacker]);a.combatTarget=structure;h.hurt(a,attacker);h.step(a);
  assert.equal(a.combatTarget,attacker);
});
check('Manual target remains authoritative even when another unit attacks',()=>{
  const a=unit(1,500),chosen=unit(2,600,1),attacker=unit(3,720,1),h=make([a,chosen,attacker]);
  a.order={kind:'attack',target:chosen};h.hurt(a,attacker);h.step(a);assert.equal(a.combatTarget,chosen);
});
check('Manual target lost to fog uses its last visible point rather than a hidden position',()=>{
  const a=unit(1,500),b=unit(2,720,1),h=make([a,b]);a.order={kind:'attack',target:b};h.step(a);
  b.hidden=true;b.x=1100;h.step(a);assert.deepEqual(a.order,{kind:'attackMove',x:720,y:500,lastSeen:{x:720,y:500}});
  assert.equal(h.moves.length,1);
});
check('Cancel clears response target while preserving cooldown and shot telemetry',()=>{
  const a=unit(1,500),b=unit(2,720,1),h=make([a,b]);h.hurt(a,b);h.step(a);
  a.cooldown=.4;a.visualShotSerial=3;h.combat.cancel(a);
  assert.equal(a.combatResponseTarget,null);assert.equal(a.cooldown,.4);assert.equal(a.visualShotSerial,3);
  assert.equal(h.step(a),false);
});

const siegeShot=(radius,{building=false,lowered=false,type='marine'}={})=>{
  const a=unit(1,500,0,'tank');a.sieged=true;a.weapon=SIEGE_WEAPON;
  const t={...unit(2,650,1),r:radius,building,lowered,type};
  const nearby=unit(3,650,0);nearby.y=510;
  const h=make([a,t,nearby]);a.order={kind:'attack',target:t};
  for(let i=0;i<20;i++)h.step(a);
  return {a,t,nearby,h};
};
check('Lowered Depot directs Siege shot into native splash branch',()=>{
  const {nearby}=siegeShot(1.25*SCALE,{building:true,lowered:true,type:'relay'});assert(nearby.hp<1000);
});
check('Raised Depot at radius boundary uses directed damage without adjacent splash',()=>{
  const {t,nearby}=siegeShot(1.25*SCALE,{building:true,type:'relay'});assert(t.hp<1000);assert.equal(nearby.hp,1000);
});
check('Small add-on structure uses radius-based splash rather than blanket structure exclusion',()=>{
  const {nearby}=siegeShot(SCALE,{building:true,type:'techlab'});assert(nearby.hp<1000);
});
check('Large-radius mobile target uses directed branch rather than blanket mobile splash',()=>{
  const {nearby}=siegeShot(1.5*SCALE);assert.equal(nearby.hp,1000);
});
check('Valid shots still emit telemetry exactly once per actual firing event',()=>{
  const {a,h}=siegeShot(.375*SCALE);assert.equal(a.visualShotSerial,1);
  assert(h.events.some(s=>s.tank));assert(a.cooldown>0);
});
console.log(`${checks} unit AI follow-up checks passed.`);
