import {surface} from './geometry.js';
import {SIEGE_WEAPON,FASTER,SCALE,turnTowards} from './unit-profiles.js';

export function createCombat({entities,visible,move,research,shots,clock}) {
  let missiles=[],processedThisLoop=new Set(),idleThisLoop=new Set(),helpThisLoop=new Set();
  // Core CGame defaults; exact native arbitration/phase ordering is separate.
  const helpRadius=4*SCALE,helpPeriod=2/FASTER,idleMovementLimit=21*SCALE;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const weapon=e=>e.sieged?SIEGE_WEAPON:e.weapon||{range:e.range,scan:e.range,minimum:0,period:e.cool,point:.12,backswing:.25,damage:e.damage,turret:true};
  const valid=(e,t,w)=>!!t&&t.hp>0&&(t.team!==e.team||e.order?.kind==='attack'&&e.order.target===t&&t!==e)&&!t.planned&&!t.loadedIn&&!t.insideRefinery&&(!t.flying||w.air)&&visible(e,t);
  const observed=(e,t)=>!!t&&(t.team===e.team||visible(e,t));
  // Range is measured between footprints, not the two unit centers.
  const inRange=(e,t,w,slop=0)=>surface(e,t).distance-e.r<=w.range+slop&&(!w.minimum||surface(e,t).distance-e.r>=w.minimum);
  const priority=t=>t.attackTargetPriority??(t.building?(t.damage?20:11):20);
  const armed=t=>!!(t.weapon?.damage??t.damage);
  function cancel(e) {e.windup=null;e.burst=null;e.backswing=0;e.combatTarget=null;e.combatResponseTarget=null;e.combatAnchor=null;e.combatReturning=false;e.attackTargetMemory=null;e.attackLastSeen=null;e.combatHelp=null;e.consumedCombatHelp=null;e.combatHelpApproachAt=undefined;e.acquireTime=0;e.lastAcquireResponseAt=e.lastDamageAt??-Infinity;idleThisLoop.delete(e);}
  function acceptOrder(e) {
    const o=e.order;
    // Capture intent at input acceptance, before a simulation loop can hide it.
    if(o?.kind==='attack'&&valid(e,o.target,weapon(e)))e.attackLastSeen={x:o.target.x,y:o.target.y};
  }
  function damage(e,t,w,fraction=1,origin=e) {
    if(t.hp<=0)return;
    const upgrades=research()[e.team]||{},defense=research()[t.team]||{};
    let amount=w.damage;
    for(const [attr,bonus] of Object.entries(w.bonus||{}))if(t.attributes?.includes(attr))amount+=bonus;
    if(upgrades.weapons&&['marine','marauder','reaper'].includes(e.type))amount+=e.type==='marauder'&&t.attributes?.includes('Armored')?2:1;
    const armor=(t.armor||0)+(defense.armor&&['marine','marauder','reaper'].includes(t.type)?1:0);
    t.hp-=Math.max(.5,amount*fraction-armor);t.lastDamageAt=clock();t.lastAttacker=e;t.lastDamageSourcePosition={x:origin.x,y:origin.y};
    if(e.team!==t.team&&clock()-(t.lastCombatHelpAt??-Infinity)>=helpPeriod) {
      t.lastCombatHelpAt=clock();const call={attacker:e,at:clock()};
      for(const ally of entities())if(ally!==t&&ally.team===t.team&&ally.hp>0&&ally.damage&&
        !ally.loadedIn&&!ally.insideRefinery&&!ally.planned&&!ally.flying&&surface(ally,t).distance-ally.r<=helpRadius) {
        ally.combatHelp=call;helpThisLoop.add(ally);
      }
    }
    if(t.hp<=0)e.kills++;
    if(e.type==='marauder'&&upgrades.concussiveResearch&&!t.building&&!t.attributes?.includes('Massive'))t.slow=1.5/FASTER;
  }
  function impact(e,t,w,point,origin=e) {
    if(w.line) {
      const a=Math.atan2(point.y-e.y,point.x-e.x),ux=Math.cos(a),uy=Math.sin(a);
      for(const u of entities())if(u.hp>0&&(u.team!==e.team||u===t)&&!u.flying&&!u.loadedIn&&!u.insideRefinery&&!u.planned) {
        const dx=u.x-e.x,dy=u.y-e.y,along=dx*ux+dy*uy,across=Math.abs(dx*uy-dy*ux);
        if(along>=0&&along<=w.line+u.r&&across<=w.lineRadius+u.r)damage(e,u,w,1,origin);
      }
      shots().push({x:e.x,y:e.y,tx:e.x+ux*w.line,ty:e.y+uy*w.line,flame:true,life:.23});
    } else {
      damage(e,t,w,1,origin);
      // CrucioShockCannonSwitch selects Blast below a 1.25 catalog radius,
      // with an explicit lowered-Depot exception; larger targets are Directed.
      const splashTarget=t.r<1.25*SCALE||(t.type==='relay'&&t.lowered);
      if(w.splash&&splashTarget)for(const u of entities())if(u!==t&&u!==e&&u.hp>0&&!u.flying&&!u.loadedIn&&!u.insideRefinery&&!u.planned) {
        const band=w.splash.find(([radius])=>dist(u,point)<=radius);
        if(band)damage(e,u,w,band[1],origin); // Siege splash includes friendly ground units.
      }
    }
  }
  function fire(e,t,w) {
    e.visualShotSerial=(e.visualShotSerial||0)+1;e.visualShotAt=clock();
    e.cooldown=w.period/(e.stim?1.5:1);e.backswing=w.backswing/(e.stim?1.5:1);
    const point={x:t.x,y:t.y};
    if(w.missileSpeed)missiles.push({source:e,target:t,weapon:w,x:e.x,y:e.y,origin:{x:e.x,y:e.y}});
    else impact(e,t,w,point);
    if(!w.line&&!w.missileSpeed)shots().push({x:e.x,y:e.y,tx:t.x,ty:t.y,tank:e.type==='tank',life:.12});
    if(w.burst>1)e.burst={target:t,weapon:w,left:w.burst-1,time:w.burstInterval};
  }
  function begin(dt) {
    processedThisLoop=new Set();idleThisLoop=new Set();helpThisLoop=new Set();
    for(const e of entities()) {
      e.cooldown=Math.max(0,e.cooldown-dt);e.backswing=Math.max(0,(e.backswing||0)-dt);e.slow=Math.max(0,(e.slow||0)-dt);
      if(e.type==='reaper'&&e.hp>0&&clock()-(e.lastDamageAt??-Infinity)>=10/FASTER)e.hp=Math.min(e.maxhp,e.hp+2*FASTER*dt);
      if(e.burst) {
        const b=e.burst;b.time-=dt;
        if(b.time<=0) {
          if(valid(e,b.target,b.weapon)&&inRange(e,b.target,b.weapon,SCALE)) {
            e.visualShotSerial=(e.visualShotSerial||0)+1;e.visualShotAt=clock();
            impact(e,b.target,b.weapon,{x:b.target.x,y:b.target.y});
            shots().push({x:e.x,y:e.y,tx:b.target.x,ty:b.target.y,life:.12});
          }
          e.burst=null;
        }
      }
    }
    for(const m of missiles) {
      if(m.target.hp<=0)continue;
      const d=dist(m,m.target),step=m.weapon.missileSpeed*dt;
      if(d<=step){impact(m.source,m.target,m.weapon,{x:m.target.x,y:m.target.y},m.origin);m.done=true;}
      else{m.x+=(m.target.x-m.x)/d*step;m.y+=(m.target.y-m.y)/d*step;}
      shots().push({x:m.x,y:m.y,tx:m.x+3,ty:m.y+3,missile:true,life:dt*1.5});
    }
    missiles=missiles.filter(m=>!m.done&&m.target.hp>0);
  }
  function assistance(e,w,o,target,defensive) {
    const call=e.combatHelp;
    if(!call||call===e.consumedCombatHelp)return target;
    e.consumedCombatHelp=call;
    if((e.response??'Acquire')!=='Acquire'||o?.kind==='attack'||
      ['move','follow','land','flee','mine','gas','return','build','repair'].includes(o?.kind))return target;
    const attacker=call.attacker;
    if(valid(e,attacker,w)&&surface(e,attacker).distance-e.r<=Math.max(w.scan,w.range,e.vision||0)&&
      (!(e.hold||e.sieged||defensive)||inRange(e,attacker,w))&&
      (!target||priority(attacker)>priority(target)||priority(attacker)===priority(target)&&armed(attacker)&&!armed(target))) {
      e.combatResponseTarget=attacker;e.combatHelpApproachAt=call.at;return attacker;
    }
    return target;
  }
  function engage(e,dt) {
    processedThisLoop.add(e);idleThisLoop.delete(e);
    if(!e.damage||e.flying||e.transform)return false;
    const w=weapon(e);let o=e.order;
    if(o?.kind==='attackMove'&&e.attackTargetMemory&&
      (valid(e,e.attackTargetMemory,w)||(observed(e,e.attackTargetMemory)&&e.attackTargetMemory.hp<=0))) {
      const {x,y,...intent}=o;
      o=e.order={...intent,kind:'attack',target:e.attackTargetMemory};e.attackTargetMemory=null;
    }
    const manual=o?.kind==='attack',defensive=e.acquireLevel==='Defensive'&&!['attackMove','patrol'].includes(o?.kind);
    const idleAuto=!o&&!e.hold&&!e.sieged&&!e.building&&!defensive;
    if(idleAuto&&e.combatAnchor&&dist(e,e.combatAnchor)>idleMovementLimit)e.combatReturning=true;
    let rangeOnly=e.hold||e.sieged||e.building||defensive||idleAuto&&e.combatReturning;
    const newDamage=e.lastDamageAt>(e.lastAcquireResponseAt??-Infinity);
    e.lastAcquireResponseAt=e.lastDamageAt??-Infinity;
    if(['move','follow','land','flee'].includes(o?.kind)){e.combatTarget=null;e.combatResponseTarget=null;e.windup=null;e.consumedCombatHelp=e.combatHelp;return false;}
    let target=manual?o.target:e.combatTarget;
    const windupSlop=t=>e.windup?.target===t?(w.rangeSlop||0):0;
    const responseRange=Math.max(w.scan,w.range,e.vision||0);
    // Native AttackMove/Patrol retain a team-visible acquired target beyond
    // personal vision distance. Idle pursuit instead belongs to its origin.
    if(!valid(e,target,w)||(!manual&&rangeOnly&&!inRange(e,target,w,windupSlop(target))))target=null;
    if(!target&&e.combatTarget&&idleAuto&&e.combatAnchor){e.combatReturning=true;rangeOnly=true;}
    if(e.combatResponseTarget!==target)e.combatResponseTarget=null;
    // Catalog weapon damage requests Acquire response. Retaliation uses only a
    // visible attacker, bounded by vision; its precise native leash is unknown.
    // Existing equally important attacks remain stable. Move/Follow/Flee never
    // retaliate, and Hold/Siege/Defensive acquisition still requires range.
    const attacker=e.lastAttacker;
    if(!manual&&newDamage&&(e.response??'Acquire')==='Acquire'&&valid(e,attacker,w)&&
      surface(e,attacker).distance-e.r<=responseRange&&
      (!rangeOnly||inRange(e,attacker,w))&&
      (!target||priority(attacker)>priority(target))) {
      target=attacker;e.combatResponseTarget=attacker;
    }
    target=assistance(e,w,o,target,rangeOnly);
    e.acquireTime=(e.acquireTime||0)-dt;
    if(!manual&&(e.acquireTime<=0||!target)) {
      e.acquireTime=.1;
      let best=target;
      for(const t of entities())if(valid(e,t,w)&&surface(e,t).distance-e.r<=Math.max(w.scan,w.range)&&surface(e,t).distance-e.r>=w.minimum) {
        if(rangeOnly&&!inRange(e,t,w))continue;
        // Keep an equally important target. A newly closer unit never steals
        // an existing valid attack. Threat priority can supersede a structure.
        if(!best||priority(t)>priority(best)||!target&&priority(t)===priority(best)&&surface(e,t).distance<surface(e,best).distance)best=t;
      }
      target=best;
    }
    if(manual&&!valid(e,target,w)) {
      e.windup=null;e.combatTarget=null;
      // Dead explicit targets complete in the order executor; do not invent a
      // new attack-move objective or interfere with a queued successor.
      if(observed(e,o.target)&&o.target.hp<=0){e.attackTargetMemory=null;return false;}
      // Do not read a hidden enemy's live coordinates to chase it through fog.
      if(e.attackLastSeen) {
        const {target:lostTarget,...intent}=o;
        // Retain identity without inspecting unseen life state. Hidden death
        // must not change last-seen pursuit or expose information through it.
        e.attackTargetMemory=lostTarget||null;
        e.order={...intent,kind:'attackMove',...e.attackLastSeen};
      }
      return false;
    }
    if(manual&&target)e.attackLastSeen={x:target.x,y:target.y};
    e.combatTarget=target;if(e.combatResponseTarget!==target)e.combatResponseTarget=null;
    if(target&&idleAuto&&!e.combatAnchor)e.combatAnchor={x:e.x,y:e.y};
    if(!target){
      e.windup=null;
      if(idleAuto&&e.combatReturning&&e.combatAnchor) {
        // Return interruption is a conservative custom policy: defend inside
        // weapon range, never begin another distant chase before reaching home.
        if(dist(e,e.combatAnchor)<=1||move(e,e.combatAnchor,dt,0)) {
          e.combatAnchor=null;e.combatReturning=false;e.vx=e.vy=0;
        }else return true;
      }
      if(!o&&!e.hold&&!e.sieged&&Math.hypot(e.vx||0,e.vy||0)<1e-8)idleThisLoop.add(e);return false;
    }
    if(!inRange(e,target,w,windupSlop(target))) {
      e.windup=null;
      // Controlled native assistance assigns a target on the damage loop,
      // then begins approach on the following normal loop, in either order.
      if(e.combatHelpApproachAt===clock()){e.vx=e.vy=0;return true;}
      if(e.backswing>0){e.vx=e.vy=0;return true;}
      if(!e.hold&&!e.sieged&&!e.building)move(e,target,dt,w.range+e.r+target.r-1);
      else e.vx=e.vy=0;
      return true;
    }
    e.vx=e.vy=0;
    const facing=Math.atan2(target.y-e.y,target.x-e.x),rate=w.turret?(e.type==='hellion'?999.8437:360)*Math.PI/180*FASTER:e.turnRate;
    if(w.turret)e.turretAngle=turnTowards(e.turretAngle??e.angle,facing,rate||20,dt);
    else e.angle=turnTowards(e.angle,facing,rate||20,dt);
    const angle=w.turret?e.turretAngle:e.angle,error=Math.abs(Math.atan2(Math.sin(facing-angle),Math.cos(facing-angle)));
    if(error>.12)return true;
    const point=w.point/(e.stim?1.5:1);
    // A positive damage point begins on this loop; no earlier elapsed time
    // belongs to that new phase. Repeat admission includes this creation loop
    // so delaying its first decrement does not stretch the catalog cooldown.
    let created=false;
    if(!e.windup&&e.cooldown<=point+(point>0?dt:0)+1e-8){e.windup={target,remaining:point};created=true;}
    if(e.windup) {
      if(e.windup.target!==target){e.windup=null;return true;}
      if(!created||point<=0)e.windup.remaining-=dt;
      if(e.windup.remaining<=1e-8&&e.cooldown<=1e-8) {
        e.windup=null;fire(e,target,w);
      }
    }
    return true;
  }
  function flushHelp(dt) {
    const reacted=[];
    // Assign help targets for already-processed idle units. Approach begins on
    // their next normal loop; never replay engage/cooldown/attack/movement.
    for(const e of helpThisLoop)if(processedThisLoop.has(e)&&idleThisLoop.has(e)&&e.hp>0&&!e.order&&
      !e.hold&&!e.sieged&&!e.loadedIn&&!e.insideRefinery&&!e.flying&&!e.transform&&!e.combatTarget) {
      const w=weapon(e),target=assistance(e,w,null,null,e.acquireLevel==='Defensive');
      if(!target)continue;
      e.combatTarget=target;idleThisLoop.delete(e);reacted.push(e);
      if(!e.building&&e.acquireLevel!=='Defensive'&&!e.combatAnchor)e.combatAnchor={x:e.x,y:e.y};
      e.vx=e.vy=0;
    }
    helpThisLoop.clear();return reacted;
  }
  function reset(){missiles=[];processedThisLoop.clear();idleThisLoop.clear();helpThisLoop.clear();for(const e of entities()){e.combatAnchor=null;e.combatReturning=false;e.combatHelp=null;e.consumedCombatHelp=null;e.combatHelpApproachAt=undefined;e.lastCombatHelpAt=undefined;}}
  return {begin,engage,flushHelp,cancel,acceptOrder,weapon,inRange,reset};
}
