import assert from 'node:assert/strict';
import {createCombat} from '../dist/combat.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';
const DT=1/22.4;
const unit=(id,team,x,type='marine')=>({...PROFILES[type],id,type,team,x:x*SCALE,y:42*SCALE,
  hp:1000,maxhp:1000,damage:team?0:PROFILES[type].weapon.damage,kills:0,cooldown:0,
  angle:0,turretAngle:0,vx:0,vy:0,vision:9*SCALE,order:null,orders:[]});
function make(units,callback) {
  let time=0;const moves=[],shots=[],damage=[];
  const combat=createCombat({entities:()=>units,visible:(e,t)=>!t.hidden,clock:()=>time,
    research:()=>[{},{}],shots:()=>shots,move:(e,t)=>{moves.push(t);return false;},
    onDamage:callback===false?undefined:(e,t,amount)=>{damage.push({source:e,target:t,amount,hp:t.hp,kills:e.kills});}});
  return {combat,moves,shots,damage,step(n=1){for(let i=0;i<n;i++){time+=DT;combat.begin(DT);for(const e of units)combat.engage(e,DT);}}};
}
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
for(const kind of ['attackMove','patrol']) {
  check(`${kind} replaces an out-of-range retreater with the nearest equal-ranked in-range opponent`,()=>{
    const source=unit(1,0,40),retreater=unit(2,1,47),far=unit(3,1,45),near=unit(4,1,43);
    const order=source.order={kind,x:60*SCALE,y:42*SCALE,origin:{x:40*SCALE,y:42*SCALE},out:true};
    source.combatTarget=retreater;const h=make([source,retreater,far,near]);h.step(2);
    assert.equal(source.combatTarget,near);assert.equal(source.order,order);
    assert.equal(near.hp,994);assert.equal(retreater.hp,1000);assert.equal(h.moves.length,0);
  });
  check(`${kind} retains a far visible retreater when no in-range alternative exists`,()=>{
    const source=unit(1,0,40),retreater=unit(2,1,60),other=unit(3,1,46);
    source.order={kind,x:60*SCALE,y:42*SCALE};source.combatTarget=retreater;
    const h=make([source,retreater,other]);h.step();assert.equal(source.combatTarget,retreater);
    assert.deepEqual(h.moves,[retreater]);
  });
  check(`${kind} keeps an in-range incumbent despite a closer equal-ranked opponent`,()=>{
    const source=unit(1,0,40),incumbent=unit(2,1,45),near=unit(3,1,43);
    source.order={kind,x:60*SCALE,y:42*SCALE};source.combatTarget=incumbent;
    const h=make([source,incumbent,near]);h.step(2);assert.equal(source.combatTarget,incumbent);assert.equal(incumbent.hp,994);
  });
}
check('Manual focus fire and idle pursuit retain their out-of-range equal-ranked target',()=>{
  for(const kind of ['attack',null]) {
    const source=unit(1,0,40),retreater=unit(2,1,47),near=unit(3,1,43);
    source.order=kind?{kind,target:retreater}:null;source.combatTarget=retreater;
    const h=make([source,retreater,near]);h.step();assert.equal(source.combatTarget,retreater);assert.deepEqual(h.moves,[retreater]);
  }
});
check('A closer lower-ranked target does not displace a retreating higher-ranked target',()=>{
  const source=unit(1,0,40),retreater=unit(2,1,47),near=unit(3,1,43);retreater.attackTargetPriority=30;
  source.order={kind:'attackMove',x:60*SCALE,y:42*SCALE};source.combatTarget=retreater;
  const h=make([source,retreater,near]);h.step();assert.equal(source.combatTarget,retreater);
});
check('Hidden and minimum-range alternatives cannot displace the incumbent',()=>{
  const source=unit(1,0,40),retreater=unit(2,1,47),hidden=unit(3,1,43),tooClose=unit(4,1,41);
  source.weapon={...source.weapon,minimum:2*SCALE};hidden.hidden=true;
  source.order={kind:'attackMove',x:60*SCALE,y:42*SCALE};source.combatTarget=retreater;
  const h=make([source,retreater,hidden,tooClose]);h.step();assert.equal(source.combatTarget,retreater);
});
check('An admitted windup keeps its range-slop target rather than cancelling a pending shot',()=>{
  const source=unit(1,0,40),incumbent=unit(2,1,45),near=unit(3,1,43);
  source.order={kind:'attackMove',x:60*SCALE,y:42*SCALE};source.combatTarget=incumbent;
  const h=make([source,incumbent,near]);h.step();assert(source.windup);incumbent.x=46*SCALE;
  source.acquireTime=0;h.step();assert.equal(source.combatTarget,incumbent);assert.equal(incumbent.hp,994);
});
check('Move suppresses acquisition and damage callbacks even with a nearby enemy',()=>{
  const source=unit(1,0,40),target=unit(2,1,43);source.order={kind:'move',x:60*SCALE,y:42*SCALE};
  const h=make([source,target]);h.step(20);assert.equal(source.combatTarget,null);assert.equal(h.damage.length,0);
});
check('Damage callback receives armor-adjusted HP loss only when a real shot lands',()=>{
  const source=unit(1,0,40),target=unit(2,1,43);target.armor=2;source.order={kind:'attack',target};
  const h=make([source,target]);h.step();assert.equal(h.damage.length,0);h.step();
  assert.deepEqual(h.damage,[{source,target,amount:4,hp:996,kills:0}]);
});
check('Fatal damage callback clamps HP loss and observes applied death and kill state',()=>{
  const source=unit(1,0,40),target=unit(2,1,43);target.hp=3;source.order={kind:'attack',target};
  const h=make([source,target]);h.step(3);assert.equal(h.damage.length,1);
  assert.deepEqual(h.damage[0],{source,target,amount:3,hp:-3,kills:1});
});
check('Delayed missile callback occurs at impact with bonus damage, not at launch',()=>{
  const source=unit(1,0,40,'marauder'),target=unit(2,1,44,'marauder');target.armor=1;
  source.order={kind:'attack',target};const h=make([source,target]);h.step();assert.equal(h.damage.length,0);
  h.step(4);assert.equal(h.damage.length,1);assert.equal(h.damage[0].amount,19);assert.equal(target.hp,981);
});
check('Splash reports each actual allied/enemy hit, including fatal allied damage',()=>{
  const source=unit(1,0,40,'tank'),target=unit(2,1,45),ally=unit(3,0,45.2);ally.damage=0;ally.hp=3;
  source.sieged=true;source.order={kind:'attack',target};const h=make([source,target,ally]);h.step(4);
  assert.equal(h.damage.length,2);assert.equal(h.damage.find(d=>d.target===target).amount,40);
  assert.equal(h.damage.find(d=>d.target===ally).amount,3);
});
check('Existing callers without an onDamage callback retain shot behavior',()=>{
  const source=unit(1,0,40),target=unit(2,1,43);source.order={kind:'attack',target};
  const h=make([source,target],false);h.step(2);assert.equal(target.hp,994);assert.equal(source.visualShotSerial,1);
});
console.log(`${checks} attack-move fidelity checks passed.`);
