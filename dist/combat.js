import {surface} from './geometry.js';
import {SIEGE_WEAPON,FASTER,SCALE,turnTowards} from './unit-profiles.js';

// Weapon random delay bounds in game seconds (CWeaponLegacy defaults).
export const RANDOM_DELAY=[-.0625,.125],WEAPON_SEED=0x5c2;
// Native c_scan_idle/c_scan_idle_hellion/c_scan_amove (24 lanes, absolute
// game loops): idle, Attack-move and chase target scans run once every 8
// loops, on the loop where game_loop % 8 equals the unit index % 8.
export const SCAN_PERIOD=8;
export const scanDue=(e,loop)=>((loop+(e.scanPhase??(e.id|0)))%SCAN_PERIOD+SCAN_PERIOD)%SCAN_PERIOD===0;
export function createCombat({entities,visible,move,research,shots,clock,onDamage}) {
  let missiles=[],processedThisLoop=new Set(),idleThisLoop=new Set(),helpThisLoop=new Set();
  // Core CGame defaults; exact native arbitration/phase ordering is separate.
  // Native c_leash_lanes(_hellion)/c_leash_chase2: an idle chaser gives up
  // once it is more than AcquireLeashRadius (21) plus its own diameter from
  // where it acquired: Marine/Reaper (r .375) drop past 21.75 (seen at
  // 21.76-21.88, never at 21.52-21.66), Hellion (r .625) past 22.25 (seen at
  // 22.28-22.39, never at 22.01-22.13).
  const helpRadius=4*SCALE,helpPeriod=2/FASTER,leashRadius=21*SCALE;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  // CWeaponLegacy RandomDelayMin/Max (-0.0625..0.125 game s) lengthen or
  // shorten each cooldown; a seeded generator keeps simulations reproducible.
  let seed=WEAPON_SEED;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const weapon=e=>e.sieged?SIEGE_WEAPON:e.weapon||{range:e.range,scan:e.range,minimum:0,period:e.cool,point:.12,backswing:.25,damage:e.damage,turret:true};
  const valid=(e,t,w)=>!!t&&t.hp>0&&(t.team!==e.team||e.order?.kind==='attack'&&e.order.target===t&&t!==e)&&!t.planned&&!t.loadedIn&&!t.insideRefinery&&(!t.flying||w.air)&&visible(e,t);
  const observed=(e,t)=>!!t&&(t.team===e.team||visible(e,t));
  // Range is measured between footprints, not the two unit centers.
  const inRange=(e,t,w,slop=0)=>surface(e,t).distance-e.r<=w.range+slop&&(!w.minimum||surface(e,t).distance-e.r>=w.minimum);
  const priority=t=>t.attackTargetPriority??(t.building?(t.damage?20:11):20);
  const armed=t=>!!(t.weapon?.damage??t.damage);
  // Native acquisition: among equal AttackTargetPriority, combat units are
  // preferred over workers and unarmed units before distance is considered.
  const threat=t=>armed(t)&&t.type!=='worker'&&!t.building;
  const rank=t=>priority(t)*2+(threat(t)?1:0);
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
    const hpBefore=t.hp;
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
    onDamage?.(e,t,Math.min(hpBefore,hpBefore-t.hp));
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
        // Native c_siege_splash: a friendly Marine 0.78 from the impact (edge
        // 0.405) took the full 40, so bands are measured to the unit's edge.
        const band=w.splash.find(([radius])=>dist(u,point)-u.r<=radius);
        if(band)damage(e,u,w,band[1],origin); // Siege splash includes friendly ground units.
      }
    }
  }
  function fire(e,t,w) {
    e.visualShotSerial=(e.visualShotSerial||0)+1;e.visualShotAt=clock();
    const jitter=w.randomDelay===false?0:(RANDOM_DELAY[0]+random()*(RANDOM_DELAY[1]-RANDOM_DELAY[0]))/FASTER;
    e.cooldown=Math.max(0,w.period/(e.stim?1.5:1)+jitter);e.backswing=w.backswing/(e.stim?1.5:1);
    e.lastAttackAt=clock();e.lastBackswing=e.backswing;
    const point={x:t.x,y:t.y};
    // Native c_first_Marauder/c_stop_hit_*: impact lands ceil(d/1.25)+1 loops
    // after launch, so a missile starts travelling one loop after creation.
    if(w.missileSpeed)missiles.push({source:e,target:t,weapon:w,x:e.x,y:e.y,origin:{x:e.x,y:e.y},wait:1});
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
      if(m.wait>0){m.wait--;continue;}
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
    if(idleAuto&&e.combatAnchor&&!e.combatReturning&&dist(e,e.combatAnchor)>leashRadius+2*e.r)e.combatReturning=true;
    let rangeOnly=e.hold||e.sieged||e.building||defensive;
    // Native c_stop_hit_*: the damaged unit takes its attacker as target in
    // the damage loop and starts acting on the next loop, so damage dealt
    // during this loop is answered on the following one.
    const settled=(e.lastDamageAt??-Infinity)<clock()-1e-9;
    const newDamage=settled&&e.lastDamageAt>(e.lastAcquireResponseAt??-Infinity);
    if(settled)e.lastAcquireResponseAt=e.lastDamageAt??-Infinity;
    // Native c_leash_chase2: the way home is a plain Move (order 16). The
    // Marine walked past an enemy SCV 3.4 from its path and neither scans nor
    // answers damage until it is back at its anchor.
    if(idleAuto&&e.combatReturning) {
      e.windup=null;e.combatTarget=null;e.combatResponseTarget=null;e.lostTargetScan=false;e.consumedCombatHelp=e.combatHelp;
      if(e.combatAnchor&&!(dist(e,e.combatAnchor)<=1||move(e,e.combatAnchor,dt,0)))return true;
      e.combatAnchor=null;e.combatReturning=false;e.vx=e.vy=0;
    }
    if(['move','follow','land','flee'].includes(o?.kind)){e.combatTarget=null;e.combatResponseTarget=null;e.windup=null;e.consumedCombatHelp=e.combatHelp;return false;}
    let target=manual?o.target:e.combatTarget;
    const windupSlop=t=>e.windup?.target===t?(w.rangeSlop||0):0;
    const responseRange=Math.max(w.scan,w.range,e.vision||0);
    // Native AttackMove/Patrol retain a team-visible acquired target beyond
    // personal vision distance. Idle pursuit instead belongs to its origin.
    if(!valid(e,target,w)||(!manual&&rangeOnly&&!inRange(e,target,w,windupSlop(target))))target=null;
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
    // Native acq_delay_00..15, patrol_engage, c_siege_min, c_first_*: after a
    // target is lost the unit stays in its attack until the weapon backswing
    // ends (Marine 12 loops, Siege Tank 8, after the damage loop), whatever
    // the cooldown. The next search is seen one loop after the backswing; the
    // unit stands still until then and only resumes its order (Patrol route,
    // idle return) in the loop that search finds nothing.
    if(target)e.lostTargetScan=false;else if(e.combatTarget&&!valid(e,e.combatTarget,w))e.lostTargetScan=true;
    const recovering=!target&&e.lostTargetScan&&clock()-(e.lastAttackAt??-Infinity)<(e.lastBackswing||0)+dt-1e-6;
    if(recovering&&!manual){e.windup=null;e.vx=e.vy=0;return true;}
    // The post-backswing search is immediate; every other search waits for
    // the unit's 8-loop scan slot.
    const immediate=!target&&e.lostTargetScan;
    // Its reach for idle units is unmeasured; keep the former conservative
    // in-weapon-range rule before the walk home.
    if(immediate&&idleAuto&&e.combatAnchor)rangeOnly=true;
    if(!manual&&(immediate||scanDue(e,Math.round(clock()*22.4)))) {
      e.lostTargetScan=false;
      let best=target;
      // Native c_switch_amove/_patrol/_idle and c_leash_chase: a unit chasing
      // an automatic target out of weapon range switches, on its scan slot, to
      // an equally ranked opponent inside scan range (5.25 from the path,
      // outside weapon range) that is closer, or to one already in weapon
      // range. Admitted windups and explicit focus fire are kept. While the
      // current target is still inside scan range only in-weapon-range
      // opponents replace it (keeps the measured crowd fights unchanged).
      const pursuing=target&&!inRange(e,target,w,windupSlop(target));
      const lost=pursuing&&surface(e,target).distance-e.r>Math.max(w.scan,w.range);
      for(const t of entities())if(valid(e,t,w)&&surface(e,t).distance-e.r<=Math.max(w.scan,w.range)&&surface(e,t).distance-e.r>=w.minimum) {
        if(rangeOnly&&!inRange(e,t,w))continue;
        const closer=!best||surface(e,t).distance<surface(e,best).distance;
        if(!best||rank(t)>rank(best)||rank(t)===rank(best)&&
          (!target&&closer||pursuing&&(lost&&closer||inRange(e,t,w)&&(!inRange(e,best,w)||closer))))best=t;
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
    if(manual&&target)o.lastSeen=e.attackLastSeen={x:target.x,y:target.y};
    e.combatTarget=target;if(e.combatResponseTarget!==target)e.combatResponseTarget=null;
    if(target&&idleAuto&&!e.combatAnchor)e.combatAnchor={x:e.x,y:e.y};
    if(!target){
      e.windup=null;
      // Native leash_reacquire/c_leash_chase: an idle unit whose target is gone
      // (and whose post-backswing search found nothing) walks back home.
      if(idleAuto&&e.combatAnchor) {
        e.combatReturning=true;
        if(dist(e,e.combatAnchor)<=1||move(e,e.combatAnchor,dt,0)) {
          e.combatAnchor=null;e.combatReturning=false;e.vx=e.vy=0;
        }else return true;
      }
      if(!o&&!e.hold&&!e.sieged&&Math.hypot(e.vx||0,e.vy||0)<1e-8)idleThisLoop.add(e);return false;
    }
    let arrived=false;
    if(!inRange(e,target,w,windupSlop(target))) {
      e.windup=null;
      // Controlled native assistance assigns a target on the damage loop,
      // then begins approach on the following normal loop, in either order.
      if(e.combatHelpApproachAt===clock()){e.vx=e.vy=0;return true;}
      if(e.backswing>0){e.vx=e.vy=0;return true;}
      if(e.hold||e.sieged||e.building){e.vx=e.vy=0;return true;}
      move(e,target,dt,w.range+e.r+target.r-1);
      // Native c_stop_hit_* and c_leash_chase3: the attack starts in the loop
      // whose movement brings the unit into range. Reaper/Marauder (point 0)
      // fire in that loop; Marine (.05) one loop and Hellion (.25) four loops
      // later.
      if(!inRange(e,target,w))return true;
      arrived=true;
    }
    if(!arrived)e.vx=e.vy=0;
    const facing=Math.atan2(target.y-e.y,target.x-e.x),rate=w.turret?(w.turretRate??360)*Math.PI/180*FASTER:e.turnRate;
    if(w.turret)e.turretAngle=turnTowards(e.turretAngle??e.angle,facing,rate||20,dt);
    else if(!arrived)e.angle=turnTowards(e.angle,facing,rate||20,dt);
    const angle=w.turret?e.turretAngle:e.angle,error=Math.abs(Math.atan2(Math.sin(facing-angle),Math.cos(facing-angle)));
    if(error>.12&&!(w.arc>=360))return true;
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
  function reset(){missiles=[];seed=WEAPON_SEED;processedThisLoop.clear();idleThisLoop.clear();helpThisLoop.clear();for(const e of entities()){e.combatAnchor=null;e.combatReturning=false;e.combatHelp=null;e.consumedCombatHelp=null;e.combatHelpApproachAt=undefined;e.lastCombatHelpAt=undefined;}}
  return {begin,engage,flushHelp,cancel,acceptOrder,weapon,inRange,reset};
}
