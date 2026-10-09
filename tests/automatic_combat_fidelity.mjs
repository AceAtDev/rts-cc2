// Native-supported helper response and attack recovery, plus policy safeguards.
import assert from 'node:assert/strict';
import {createCombat} from '../dist/combat.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';
const DT=1/22.4;
const unit=(id,type,team,x)=>({...PROFILES[type],id,type,team,x,y:42*SCALE,
  hp:1000,maxhp:1000,damage:PROFILES[type].weapon.damage,kills:0,cooldown:0,
  angle:0,turretAngle:0,vx:0,vy:0,vision:9*SCALE,hold:false,order:null,orders:[]});
const make=(units)=>{
  let time=0,loop=0;const moves=[],shots=[];
  const combat=createCombat({entities:()=>units,visible:(e,t)=>!t.hidden,clock:()=>time,
    research:()=>[{},{}],shots:()=>shots,move:(e,t,dt,range)=>{moves.push({id:e.id,loop,target:t});e.vx=e.speed;return false;}});
  return {combat,moves,shots,get loop(){return loop;},
    step(n=1,flush=true){for(let i=0;i<n;i++){time+=DT;loop++;combat.begin(DT);for(const e of units)combat.engage(e,DT);if(flush)combat.flushHelp(DT);}},
    advance(seconds){time+=seconds;},setLoop(n){loop=n;}};
};
const assistance=(team=0)=>{
  const helper=unit(1,'marine',team,36*SCALE),victim=unit(2,'worker',team,40*SCALE),attacker=unit(3,'marine',1-team,44*SCALE);
  victim.hold=true;victim.response='Flee';victim.acquireLevel='Defensive';attacker.angle=Math.PI;attacker.order={kind:'attack',target:victim};
  const h=make([helper,victim,attacker]);return {...h,h,helper,victim,attacker};
};
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
for(const team of [0,1])check(`Team ${team} idle Marine assists a damaged ally outside ordinary enemy scan on loop 2`,()=>{
  const {h,helper,victim,attacker}=assistance(team);h.step();assert.equal(helper.combatTarget,null);h.step();
  assert(victim.hp<1000);assert.equal(helper.combatTarget,attacker);
  assert.deepEqual(h.moves.filter(m=>m.id===helper.id).map(m=>m.loop),[2]);
});
check('Stop exposes the same idle helper response',()=>{
  const {h,helper,attacker}=assistance();h.combat.cancel(helper);helper.order=null;h.step(2);assert.equal(helper.combatTarget,attacker);
});
check('Hold does not leave position to assist a distant ally',()=>{
  const {h,helper}=assistance();helper.hold=true;h.step(10);assert.equal(helper.combatTarget,null);
  assert.equal(h.moves.filter(m=>m.id===helper.id).length,0);
});
check('Current helper-center bound excludes calls beyond the imported four-unit radius',()=>{
  const {h,helper}=assistance();helper.x=35.99*SCALE;h.step(2);assert.equal(helper.combatTarget,null);
});
for(const kind of ['move','follow','land','flee','mine','gas','return','build','repair'])check(`${kind} intent is not interrupted by an ally call`,()=>{
  const {h,helper,attacker}=assistance();const order=helper.order={kind,x:30*SCALE,y:42*SCALE,target:attacker};
  h.step(2);assert.equal(helper.order,order);assert.equal(helper.combatTarget,null);
  assert.equal(h.moves.filter(m=>m.id===helper.id).length,0);
});
check('Manual Attack remains authoritative during ally assistance',()=>{
  const {h,helper,attacker}=assistance();const chosen=unit(4,'marine',1,38*SCALE);
  helper.order={kind:'attack',target:chosen};h.step(2);assert.equal(helper.combatTarget,chosen);assert.notEqual(helper.combatTarget,attacker);
});
check('Defensive Flee workers do not pursue an ally call',()=>{
  const {h,helper}=assistance();helper.response='Flee';helper.acquireLevel='Defensive';h.step(2);assert.equal(helper.combatTarget,null);
});
check('Hidden attackers cannot be acquired through help notifications',()=>{
  const {h,helper,attacker}=assistance();h.step(2,false);attacker.hidden=true;h.combat.flushHelp(DT);
  assert.equal(helper.combatTarget,null);assert.equal(h.moves.filter(m=>m.id===helper.id).length,0);
});
check('flushHelp is idempotent and never advances an existing windup or cooldown twice',()=>{
  const {h,helper}=assistance();h.step(2,false);const cd=helper.cooldown;
  assert.equal(h.combat.flushHelp(DT).length,1);assert.equal(h.combat.flushHelp(DT).length,0);
  assert.equal(helper.cooldown,cd);assert.equal(helper.windup,null);assert.equal(helper.visualShotSerial,undefined);
  assert.equal(h.moves.filter(m=>m.id===helper.id).length,1);
});
check('A travelling attack-move helper receives assistance without a second movement in the same loop',()=>{
  const {h,helper}=assistance();helper.order={kind:'attackMove',x:50*SCALE,y:42*SCALE};helper.vx=helper.speed;
  h.step(2);assert.equal(h.moves.filter(m=>m.id===helper.id).length,0);
  h.step();assert.equal(h.moves.filter(m=>m.id===helper.id).length,1);
});
check('A helper processed after damage reacts normally without requiring flush',()=>{
  const helper=unit(1,'marine',0,36*SCALE),victim=unit(2,'worker',0,40*SCALE),attacker=unit(3,'marine',1,44*SCALE);
  victim.hold=true;victim.response='Flee';attacker.angle=Math.PI;attacker.order={kind:'attack',target:victim};
  const h=make([attacker,helper,victim]);h.step(2,false);assert.equal(helper.combatTarget,attacker);
  assert.equal(h.moves.filter(m=>m.id===helper.id).length,1);assert.equal(h.combat.flushHelp(DT).length,0);
});
check('Repeated hits throttle calls by the catalog two-Normal-second period',()=>{
  const {h,helper,attacker,victim}=assistance();h.step(2);const call=helper.combatHelp;
  h.combat.cancel(helper);helper.order={kind:'move',x:20*SCALE,y:42*SCALE};attacker.cooldown=0;h.step(2);
  assert.equal(helper.combatHelp,null);assert(victim.hp<=988);assert(call);
  h.advance(2/1.4);attacker.cooldown=0;h.step(2);assert(helper.combatHelp);assert.notEqual(helper.combatHelp,call);
});
check('Cancel and reset clear pending assistance without stale later pursuit',()=>{
  const {h,helper,attacker}=assistance();h.step(2,false);h.combat.cancel(helper);h.combat.flushHelp(DT);assert.equal(helper.combatTarget,null);
  attacker.cooldown=0;h.advance(2/1.4);h.step(2,false);assert(helper.combatHelp);h.combat.reset();
  assert.equal(helper.combatHelp,null);assert.equal(h.combat.flushHelp(DT).length,0);
});
check('Real damage stores a fixed origin snapshot for visibility-safe worker Flee',()=>{
  const {h,victim,attacker}=assistance();h.step(2);assert.deepEqual(victim.lastDamageSourcePosition,{x:44*SCALE,y:42*SCALE});
  attacker.x=55*SCALE;attacker.hidden=true;assert.equal(victim.lastDamageSourcePosition.x,44*SCALE);
});
check('Missile damage remembers launch origin rather than reading its hidden source new position',()=>{
  const source=unit(1,'marauder',1,500),victim=unit(2,'worker',0,612);source.order={kind:'attack',target:victim};
  victim.hold=true;victim.response='Flee';const h=make([source,victim]);h.step();source.x=800;source.hidden=true;
  h.step(5);assert(victim.hp<1000);assert.deepEqual(victim.lastDamageSourcePosition,{x:500,y:42*SCALE});
});
check('Automatic pursuit waits the observed Marine recovery boundary instead of auto-kiting',()=>{
  const source=unit(1,'marine',0,37*SCALE),target=unit(2,'marine',1,42.313*SCALE);target.damage=0;source.order={kind:'attack',target};
  const h=make([source,target]);h.step(2);assert.equal(source.visualShotSerial,1);h.step(6);target.x=43*SCALE;
  h.step(5);assert.equal(h.moves.length,0);h.step();assert.equal(h.moves[0].loop,14);
});
console.log(`${checks} automatic combat fidelity checks passed.`);
