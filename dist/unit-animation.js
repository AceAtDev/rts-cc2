import * as THREE from './vendor/three.module.js';
import {surface} from './geometry.js';

// These are authored replacement curves, not extracted SC2 animation clips.
// Blizzard Art Tools' Walk/MoveSpeed and split-body rules are described in
// docs/unit-animation-fidelity.md. State and distance, never a global clock,
// drive the locomotion track; weapon fire drives a separate upper-body track.
const TAU=Math.PI*2, clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n)};
const approach=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));
const basePose=o=>({position:o.position.clone(),rotation:o.rotation.clone(),scale:o.scale.clone()});
function joint(parent,parts,pivot){
 const g=new THREE.Group();g.position.set(...pivot);parent.add(g);
 // attach preserves the authored placement, including the parent's scale.
 parent.updateMatrixWorld(true);for(const p of parts)g.attach(p);return g;
}
function collect(parent,predicate){return parent.children.filter(o=>o.isMesh&&predicate(o));}
function remember(state,key,obj){if(obj){state[key]=obj;state.poses.set(obj,basePose(obj));}return obj;}
function workSparks(view,body){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(18),3));
 const material=new THREE.PointsMaterial({color:0xffd57a,size:1.1,sizeAttenuation:true,transparent:true,opacity:.8,depthWrite:false});
 const sparks=new THREE.Points(geometry,material);sparks.position.set(19,12,8);sparks.visible=false;body.add(sparks);return sparks;
}
export function attachUnitAnimation(view,group,entity){
 if(entity.building)return null;
 const state={phase:0,distance:0,lastX:null,lastY:null,lastTime:null,lastCooldown:entity.cooldown||0,recoil:0,offRecoil:0,shotCount:0,lastShotSerial:entity.visualShotSerial||0,walkBlend:0,workBlend:0,workTime:0,wasWorking:false,workDelay:0,poses:new Map(),wheels:[],knees:[]};
 group.userData.unitAnimation=state;
 const parts=group.userData.animationParts??=new Set();
 const register=(key,obj)=>{if(!obj)return null;remember(state,key,obj);parts.add(obj);return obj;};
 const body=(group.userData.legs||[])[0]?.parent;
 if(body){
  register('body',body);state.legs=group.userData.legs;
  for(const leg of state.legs){
   parts.add(leg);state.poses.set(leg,basePose(leg));
   const knee=joint(leg,collect(leg,o=>o.position.y<=-4),[1,-4,0]);
   state.knees.push(knee);state.poses.set(knee,basePose(knee));parts.add(knee);
   view.mergeStatic(knee);view.mergeStatic(leg,new Set([knee]));
  }
  if(entity.type==='worker'){
   // Drill and claw are independent tracks; shoulders stay on the torso.
   register('tool',joint(body,collect(body,o=>o.position.x>=5&&o.position.z>=6&&o.position.y<=15),[2,17,7]));
   register('claw',joint(body,collect(body,o=>o.position.x>=4&&o.position.z<=-6&&o.position.y<=15),[2,17,-7]));
   const drill=state.tool.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o.position.x>11);
   if(drill){state.drill=drill;state.drillBase=basePose(drill);parts.add(drill);}
   state.sparks=workSparks(view,body);
  }else if(entity.type==='marauder'){
   register('weapon',joint(body,collect(body,o=>o.position.x>=4&&o.position.z<0&&o.position.y<=16),[1,17,-7]));
   register('offWeapon',joint(body,collect(body,o=>o.position.x>=4&&o.position.z>0&&o.position.y<=16),[1,17,7]));
  }else if(entity.type==='reaper'){
   // The previous Reaper reused the Marine rifle. Replace it with the paired
   // forearm/pistol silhouette and a compact back-mounted thruster assembly.
   for(const mesh of collect(body,o=>o.position.x>=4&&o.position.y<=16))body.remove(mesh);
   const steel=0x7d8585,dark=0x30383b,blue=entity.team?0x9c3130:0x1f528a;
   for(const [name,z] of [['weapon',-7],['offWeapon',7]]){
    const arm=new THREE.Group();arm.position.set(1,17,z);body.add(arm);
    view.rod(arm,[0,0,0],[5,-4,0],1.4,steel);view.armor(arm,5,5,4,5,-4,0,blue,.4);
    view.armor(arm,10,3,3,10,-3,0,dark,.3);view.part(arm,2,3,3,15,-3,0,steel);register(name,arm);
   }
   for(const z of [-3,3]){view.rod(body,[-8,11,z],[-8,22,z],1.8,dark);view.armor(body,4,5,4,-8,13,z,steel,.4);}
  }else{
   register('weapon',joint(body,collect(body,o=>o.position.x>=4&&o.position.y<=16),[1,17,0]));
  }
  for(const p of [state.tool,state.claw,state.weapon,state.offWeapon].filter(Boolean))view.mergeStatic(p,new Set(state.drill?[state.drill]:[]));
  view.mergeStatic(body,new Set([...state.legs,state.tool,state.claw,state.weapon,state.offWeapon,group.userData.cargo,group.userData.gasCargo,state.sparks].filter(Boolean)));
 }
 if(entity.type==='tank'){
  const turret=group.userData.turret;register('turret',turret);
  register('barrel',joint(turret,collect(turret,o=>o.position.x>=7),[7,2,0]));
  view.mergeStatic(state.barrel);view.mergeStatic(turret,new Set([state.barrel]));
  state.struts=group.userData.struts||[];
  for(const strut of state.struts){parts.add(strut);state.poses.set(strut,basePose(strut));view.mergeStatic(strut);}
  state.siege=entity.sieged?1:0;
 }
 if(entity.type==='hellion'){
  // Wheel cylinder axes are local Z after the existing geometry transform.
  for(const x of [-13,13])for(const z of [-11,11]){
   const wheel=joint(group,collect(group,o=>Math.abs(o.position.x-x)<.01&&Math.abs(o.position.z-z)<.01&&Math.abs(o.position.y-6)<.01),[x,6,z]);
   state.wheels.push(wheel);parts.add(wheel);state.poses.set(wheel,basePose(wheel));view.mergeStatic(wheel);
  }
  register('turret',group.userData.turret);if(state.turret)view.mergeStatic(state.turret);
 }
 return state;
}
export function updateUnitAnimation(group,entity,{dt=1/60,time=0,x=entity.x,y=entity.y}={}){
 const s=group.userData.unitAnimation;if(!s)return null;
 // Simulation pause freezes action tracks, even while camera rendering continues.
 const elapsed=s.lastTime===null?0:Math.max(0,time-s.lastTime);s.lastTime=time;
 dt=Math.min(.1,Math.max(0,dt));const actionDt=Math.min(.1,elapsed);
 const traveled=s.lastX===null?0:Math.hypot(x-s.lastX,y-s.lastY);s.lastX=x;s.lastY=y;
 // Hidden/replaced actors and debug teleports must not spin their limbs wildly.
 const distance=traveled>Math.max(35,(entity.speed||0)*.25)?0:traveled;
 s.distance+=distance;const stride={worker:29,marine:32,marauder:36,reaper:37}[entity.type]||32;s.phase=(s.phase+distance/stride*TAU)%TAU;
 const moving=distance>.015&&elapsed>0&&!entity.transform;
 s.walkBlend=approach(s.walkBlend,moving?1:0,moving?22:28,actionDt);
 const cooldown=entity.cooldown||0;
 const shotEvents=entity.visualShotSerial===undefined?(cooldown>s.lastCooldown+1e-5?1:0):Math.max(0,entity.visualShotSerial-s.lastShotSerial);
 if(entity.visualShotSerial!==undefined)s.lastShotSerial=entity.visualShotSerial;
 for(let i=0;i<Math.min(shotEvents,4);i++){s.shotCount++;if(['marauder','reaper'].includes(entity.type)&&s.shotCount%2===0)s.offRecoil=1;else s.recoil=1;}
 if(moving&&['marine','marauder','reaper'].includes(entity.type))s.recoil=s.offRecoil=0;
 s.lastCooldown=cooldown;s.recoil=Math.max(0,s.recoil-actionDt/(entity.type==='tank'?.24:.14));s.offRecoil=Math.max(0,s.offRecoil-actionDt/.14);
 const o=entity.order,mining=entity.type==='worker'&&o?.kind==='mine'&&o.phase==='harvest',working=entity.type==='worker'&&(mining||(['build','repair'].includes(o?.kind)&&Math.hypot(entity.vx||0,entity.vy||0)<1&&!moving&&o.target&&o.target.hp>0&&!o.target.planned&&surface(entity,o.target).distance<=entity.r+8));
 if(working&&!s.wasWorking)s.workDelay=((entity.id||1)*.137%1)*.3/1.4;s.wasWorking=working;
 s.workDelay=Math.max(0,s.workDelay-actionDt);const activeWork=working&&s.workDelay<=0;
 s.workBlend=approach(s.workBlend,activeWork?1:0,22,actionDt);if(activeWork)s.workTime+=actionDt;else if(s.workBlend<.01)s.workTime=0;
 if(s.legs){
  const swing=Math.sin(s.phase),amplitude=entity.type==='worker'?.4:entity.type==='marauder'?.38:.48;
  for(let i=0;i<2;i++){
   const leg=s.legs[i],pose=s.poses.get(leg),phase=s.phase+i*Math.PI,step=Math.sin(phase),lift=Math.max(0,Math.cos(phase));
   leg.rotation.z=pose.rotation.z+step*amplitude*s.walkBlend;
   leg.position.y=pose.position.y+lift*.65*s.walkBlend;
   const knee=s.knees[i],kp=s.poses.get(knee);knee.rotation.z=kp.rotation.z-lift*.45*s.walkBlend;
  }
  const body=s.body,p=s.poses.get(body);body.position.y=p.position.y+Math.abs(swing)*.45*s.walkBlend;
  body.rotation.z=p.rotation.z-.065*s.walkBlend-(entity.type==='worker'?.018*Math.sin(s.workTime*24)*s.workBlend:0);
  if(s.tool){const p=s.poses.get(s.tool);s.tool.rotation.z=p.rotation.z-.11*s.workBlend+Math.sin(s.workTime*23)*.06*s.workBlend;s.tool.position.x=p.position.x+Math.sin(s.workTime*23)*.3*s.workBlend+s.recoil*1.1;
   if(s.drill)s.drill.rotation.x=s.drillBase.rotation.x+s.workTime*42*s.workBlend+s.recoil*2;
  }
  if(s.claw){const p=s.poses.get(s.claw);s.claw.rotation.z=p.rotation.z+.065*s.workBlend-Math.sin(s.phase)*.055*s.walkBlend;}
  if(s.sparks){s.sparks.visible=activeWork&&s.workBlend>.35||s.recoil>.1;s.sparks.material.color.setHex(mining?0x8ce5ff:0xffd57a);const positions=s.sparks.geometry.attributes.position;for(let i=0;i<6;i++){const phase=((s.workTime+(s.recoil?1-s.recoil:0)*.14)*7+i*.173)%1;positions.setXYZ(i,phase*(2+i%3),Math.sin(i*2.1)*phase*3-phase*phase*3,Math.cos(i*1.9)*phase*3);}positions.needsUpdate=true;}
  for(const [i,w] of [s.weapon,s.offWeapon].filter(Boolean).entries()){const p=s.poses.get(w),recoil=i===1?s.offRecoil:s.recoil;w.position.x=p.position.x-recoil*(entity.type==='marauder'?1.9:1.3);w.rotation.z=p.rotation.z+recoil*.075-Math.sin(s.phase)*.025*s.walkBlend;}
 }
 for(const wheel of s.wheels)wheel.rotation.z=s.poses.get(wheel).rotation.z-s.distance/6;
 if(s.struts){
  const transform=entity.transform;let fraction=entity.sieged?1:0;
  if(transform){const progress=1-clamp(transform.time/transform.total);fraction=transform.toSiege?progress:1-progress;}
  s.siege=smooth(fraction);
  for(const strut of s.struts){const p=s.poses.get(strut);strut.visible=s.siege>.001;strut.scale.set(p.scale.x*(.25+.75*s.siege),p.scale.y,p.scale.z*(.25+.75*s.siege));strut.position.y=p.position.y+(1-s.siege)*5;}
  const tp=s.poses.get(s.turret);s.turret.position.y=tp.position.y+s.siege*4;
  s.barrel.rotation.z=s.siege*.085;s.barrel.position.x=s.poses.get(s.barrel).position.x-s.recoil*(entity.sieged?5.5:2.5);
 }
 return {distance:s.distance,phase:s.phase,walkBlend:s.walkBlend,working,workBlend:s.workBlend,recoil:s.recoil,offRecoil:s.offRecoil,siege:s.siege??0};
}
