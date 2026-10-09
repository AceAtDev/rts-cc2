// Numeric facts from the multiplayer catalog; see reference-data.json for snapshots.
// SC2 catalog distances are game units and times are Normal speed. This world
// uses 28 world units per game unit and runs at Faster (1.4x) in real seconds.
export const SCALE = 28, FASTER = 1.4;
const profile = (speed, radius, acceleration, lateral, turn, attributes, weapon) => ({
  speed: speed * SCALE * FASTER, r: radius * SCALE,
  acceleration: acceleration * SCALE * FASTER * FASTER,
  lateralAcceleration: lateral * SCALE * FASTER * FASTER,
  turnRate: turn * Math.PI / 180 * FASTER, attributes,
  weapon: { ...weapon, range: weapon.range * SCALE,
    scan: weapon.scan * SCALE, minimum: (weapon.minimum || 0) * SCALE,
    period: weapon.period / FASTER, point: weapon.point / FASTER,
    backswing: weapon.backswing / FASTER,rangeSlop:SCALE },
});
export const PROFILES = {
  worker: profile(2.8125,.375,2.5,46,999.8437,['Light','Biological','Mechanical'],
    {range:.2,scan:5,period:1.5,point:.167,backswing:.5,damage:5}),
  marine: profile(2.25,.375,1000,46.0625,999.8437,['Light','Biological'],
    {range:5,scan:5.5,period:.86083984375,point:.05,backswing:.75,damage:6,air:true}),
  marauder: profile(2.25,.5625,1000,69.125,999.8437,['Armored','Biological'],
    {range:6,scan:6.5,period:1.5,point:0,backswing:0,damage:10,bonus:{Armored:10},missileSpeed:20*SCALE*FASTER}),
  reaper: profile(3.75,.375,1000,46.0625,999.8437,['Light','Biological'],
    {range:5,scan:5.5,period:1.10009765625,point:0,backswing:.75,damage:4,burst:2,burstInterval:.122/FASTER}),
  hellion: profile(4.25,.625,1000,46,720,['Light','Mechanical'],
    {range:5,scan:5.5,period:2.5,point:.25,backswing:.75,damage:8,bonus:{Light:6},line:6.5*SCALE,lineRadius:.15*SCALE,turret:true}),
  tank: profile(2.25,.875,1000,64,360,['Armored','Mechanical'],
    {range:7,scan:7.5,period:1.0400390625,point:.167,backswing:.5,damage:15,bonus:{Armored:10},turret:true}),
};
export const SIEGE_WEAPON = {range:13*SCALE,scan:13*SCALE,minimum:2*SCALE,
  period:3/FASTER,point:.167/FASTER,backswing:.5/FASTER,damage:40,
  bonus:{Armored:30},rangeSlop:SCALE,turret:true,splash:[ [.4687*SCALE,1],[.7812*SCALE,.5],[1.25*SCALE,.25] ]};
export function applyProfiles(defs) {
  for (const [type,p] of Object.entries(PROFILES)) Object.assign(defs[type],p,
    {range:p.weapon.range,damage:p.weapon.damage*(p.weapon.burst||1),cool:p.weapon.period,
      vision:{worker:8,marine:9,marauder:10,reaper:9,hellion:10,tank:11}[type]*SCALE});
  defs.worker.acquireLevel='Defensive';defs.worker.response='Flee';
  for(const d of Object.values(defs)) if(d.building) d.attributes=['Armored','Mechanical','Structure'];
}
export function turnTowards(angle,goal,rate,dt) {
  const delta=Math.atan2(Math.sin(goal-angle),Math.cos(goal-angle));
  return angle+Math.max(-rate*dt,Math.min(rate*dt,delta));
}
