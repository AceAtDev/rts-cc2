import {SIEGE_WEAPON,FASTER,SCALE,turnTowards} from './unit-profiles.js';

export function createCombat({entities,visible,move,research,shots,clock}) {
  let missiles=[];
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const weapon=e=>e.sieged?SIEGE_WEAPON:e.weapon||{range:e.range,scan:e.range,minimum:0,period:e.cool,point:.12,backswing:.25,damage:e.damage,turret:true};
  const valid=(e,t,w)=>!!t&&t.hp>0&&t.team!==e.team&&!t.loadedIn&&(!t.flying||w.air)&&visible(e,t);
  // Range is measured between footprints, not the two unit centers.
  const inRange=(e,t,w,slop=0)=>dist(e,t)<=w.range+e.r+t.r+slop&&(!w.minimum||dist(e,t)>=w.minimum+e.r+t.r);
  const priority=t=>t.building?(t.damage?20:11):20;
  function cancel(e) {e.windup=null;e.burst=null;e.backswing=0;e.combatTarget=null;e.attackLastSeen=null;e.acquireTime=0;}
  function damage(e,t,w,fraction=1) {
    if(t.hp<=0)return;
    const upgrades=research()[e.team]||{},defense=research()[t.team]||{};
    let amount=w.damage;
    for(const [attr,bonus] of Object.entries(w.bonus||{}))if(t.attributes?.includes(attr))amount+=bonus;
    if(upgrades.weapons&&['marine','marauder','reaper'].includes(e.type))amount+=e.type==='marauder'&&t.attributes?.includes('Armored')?2:1;
    const armor=(t.armor||0)+(defense.armor&&['marine','marauder','reaper'].includes(t.type)?1:0);
    t.hp-=Math.max(.5,amount*fraction-armor);t.lastDamageAt=clock();
    if(t.hp<=0)e.kills++;
    if(e.type==='marauder'&&upgrades.concussiveResearch&&!t.building&&!t.attributes?.includes('Massive'))t.slow=1.5/FASTER;
  }
  function impact(e,t,w,point) {
    if(w.line) {
      const a=Math.atan2(point.y-e.y,point.x-e.x),ux=Math.cos(a),uy=Math.sin(a);
      for(const u of entities())if(u.hp>0&&u.team!==e.team&&!u.flying&&!u.loadedIn) {
        const dx=u.x-e.x,dy=u.y-e.y,along=dx*ux+dy*uy,across=Math.abs(dx*uy-dy*ux);
        if(along>=0&&along<=w.line+u.r&&across<=w.lineRadius+u.r)damage(e,u,w);
      }
      shots().push({x:e.x,y:e.y,tx:e.x+ux*w.line,ty:e.y+uy*w.line,flame:true,life:.23});
    } else {
      damage(e,t,w);
      if(w.splash&&!t.building)for(const u of entities())if(u!==t&&u!==e&&u.hp>0&&!u.flying&&!u.loadedIn) {
        const band=w.splash.find(([radius])=>dist(u,point)<=radius);
        if(band)damage(e,u,w,band[1]); // Siege splash includes friendly ground units.
      }
    }
  }
  function fire(e,t,w) {
    e.cooldown=w.period/(e.stim?1.5:1);e.backswing=w.backswing/(e.stim?1.5:1);
    const point={x:t.x,y:t.y};
    if(w.missileSpeed)missiles.push({source:e,target:t,weapon:w,x:e.x,y:e.y});
    else impact(e,t,w,point);
    if(!w.line&&!w.missileSpeed)shots().push({x:e.x,y:e.y,tx:t.x,ty:t.y,tank:e.type==='tank',life:.12});
    if(w.burst>1)e.burst={target:t,weapon:w,left:w.burst-1,time:w.burstInterval};
  }
  function begin(dt) {
    for(const e of entities()) {
      e.cooldown=Math.max(0,e.cooldown-dt);e.backswing=Math.max(0,(e.backswing||0)-dt);e.slow=Math.max(0,(e.slow||0)-dt);
      if(e.type==='reaper'&&e.hp>0&&clock()-(e.lastDamageAt??-Infinity)>=10/FASTER)e.hp=Math.min(e.maxhp,e.hp+2*FASTER*dt);
      if(e.burst) {
        const b=e.burst;b.time-=dt;
        if(b.time<=0) {
          if(valid(e,b.target,b.weapon)&&inRange(e,b.target,b.weapon,SCALE)) {
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
      if(d<=step){impact(m.source,m.target,m.weapon,{x:m.target.x,y:m.target.y});m.done=true;}
      else{m.x+=(m.target.x-m.x)/d*step;m.y+=(m.target.y-m.y)/d*step;}
      shots().push({x:m.x,y:m.y,tx:m.x+3,ty:m.y+3,missile:true,life:dt*1.5});
    }
    missiles=missiles.filter(m=>!m.done&&m.target.hp>0);
  }
  function engage(e,dt) {
    if(!e.damage||e.flying||e.transform)return false;
    const w=weapon(e),o=e.order,manual=o?.kind==='attack';
    if(['move','follow','land'].includes(o?.kind)){e.combatTarget=null;return false;}
    let target=manual?o.target:e.combatTarget;
    if(!valid(e,target,w)||(!manual&&(!inRange(e,target,w,SCALE)||(e.hold||e.sieged)&&!inRange(e,target,w))))target=null;
    e.acquireTime=(e.acquireTime||0)-dt;
    if(!manual&&(e.acquireTime<=0||!target)) {
      e.acquireTime=.1;
      let best=target;
      for(const t of entities())if(valid(e,t,w)&&dist(e,t)<=Math.max(w.scan,w.range)+e.r+t.r&&dist(e,t)>=w.minimum+e.r+t.r) {
        if((e.hold||e.sieged)&&!inRange(e,t,w))continue;
        // Keep an equally important target. A newly closer unit never steals
        // an existing valid attack. Threat priority can supersede a structure.
        if(!best||priority(t)>priority(best)||!target&&priority(t)===priority(best)&&dist(e,t)<dist(e,best))best=t;
      }
      target=best;
    }
    if(manual&&!valid(e,target,w)) {
      e.windup=null;e.combatTarget=null;
      // Do not read a hidden enemy's live coordinates to chase it through fog.
      if(e.attackLastSeen)e.order={kind:'attackMove',...e.attackLastSeen};
      return false;
    }
    if(manual&&target)e.attackLastSeen={x:target.x,y:target.y};
    e.combatTarget=target;
    if(!target){e.windup=null;return false;}
    if(!inRange(e,target,w)) {
      e.windup=null;
      if(e.backswing>0){e.vx=e.vy=0;return true;}
      if(!e.hold&&!e.sieged&&!e.building)move(e,target,dt,w.range+e.r+target.r-1);
      return true;
    }
    e.vx=e.vy=0;
    const facing=Math.atan2(target.y-e.y,target.x-e.x),rate=w.turret?(e.type==='hellion'?999.8437:360)*Math.PI/180*FASTER:e.turnRate;
    if(w.turret)e.turretAngle=turnTowards(e.turretAngle??e.angle,facing,rate||20,dt);
    else e.angle=turnTowards(e.angle,facing,rate||20,dt);
    const angle=w.turret?e.turretAngle:e.angle,error=Math.abs(Math.atan2(Math.sin(facing-angle),Math.cos(facing-angle)));
    if(error>.12)return true;
    const point=w.point/(e.stim?1.5:1);
    if(!e.windup&&e.cooldown<=point+1e-8)e.windup={target,remaining:point};
    if(e.windup) {
      if(e.windup.target!==target){e.windup=null;return true;}
      e.windup.remaining-=dt;
      if(e.windup.remaining<=1e-8&&e.cooldown<=1e-8) {
        e.windup=null;fire(e,target,w);
      }
    }
    return true;
  }
  return {begin,engage,cancel,weapon,inRange,reset:()=>{missiles=[];}};
}
