import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {Battlefield} from '../dist/renderer.js';
import {attachUnitAnimation,updateUnitAnimation} from '../dist/unit-animation.js';

// Real renderer geometry helpers, with no WebGL context required. The hierarchy
// fixture expresses the public articulation contract, rather than numeric poses.
const view=Object.create(Battlefield.prototype);Object.assign(view,{materials:{},geometries:{},batchMaterials:{},armorTexture:null});
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
function infantry(type='marine'){
 const entity={id:1,type,x:0,y:0,vx:0,vy:0,speed:110,r:10.5,cooldown:0};
 const g=new THREE.Group(),body=new THREE.Group();g.add(body);const legs=[];
 for(const z of [-4,4]){const leg=new THREE.Group();leg.position.set(0,10,z);body.add(leg);view.armor(leg,4,4,4,1,-2,0,0x123456,.3);view.armor(leg,4,4,4,1,-5,0,0x123456,.3);view.armor(leg,7,3,5,3,-8,0,0x123456,.3);legs.push(leg);}
 g.userData.legs=legs;
 view.armor(body,11,12,10,0,15,0,0x123456,.3);
 for(const z of [-8,8])view.armor(body,7,5,5,10,13,z,0x123456,.3);
 const cargo=new THREE.Group();body.add(cargo);g.userData.cargo=cargo;
 attachUnitAnimation(view,g,entity);return {entity,g,body};
}
const tick=(f,time,x=0,y=0,dt=1/60)=>updateUnitAnimation(f.g,f.entity,{time,x,y,dt});
const bounds=o=>{o.updateMatrixWorld(true);return new THREE.Box3().setFromObject(o);};
{
 const f=infantry();check(f.g.userData.animationParts.has(f.body),'torso registered as dynamic');
 check(f.g.userData.unitAnimation.knees.length===2,'lower legs articulate separately');
 const before=bounds(f.g);view.mergeStatic(f.g,f.g.userData.animationParts);const after=bounds(f.g);
 check(before.min.distanceTo(after.min)<1e-4&&before.max.distanceTo(after.max)<1e-4,'static merge preserves authored shape and dynamic groups');
 tick(f,0);const a=tick(f,.1,8),phase=a.phase;const b=tick(f,1,8);check(b.phase===phase,'stationary frame does not advance walk phase');
 for(let i=0;i<60;i++)tick(f,1+i/60,8);check(f.g.userData.unitAnimation.walkBlend<1e-6,'idle actor settles out of locomotion');
 check(f.g.userData.legs.every(l=>Math.abs(l.rotation.z)<1e-6),'idle feet settle without global time swing');
}
{
 const a=infantry(),b=infantry();tick(a,0);tick(b,0);
 for(let i=1;i<=30;i++)tick(a,i/30,i*90/30,0,1/30);
 for(let i=1;i<=120;i++)tick(b,i/120,i*90/120,0,1/120);
 const sa=a.g.userData.unitAnimation,sb=b.g.userData.unitAnimation;
 check(Math.abs(sa.phase-sb.phase)<1e-10,'30 Hz and 120 Hz advance equal stride for equal traveled distance');
 check(Math.abs(sa.distance-90)<1e-10&&Math.abs(sb.distance-90)<1e-10,'stride driven by actual distance');
 const phase=sa.phase;tick(a,2,10000);check(sa.phase===phase,'debug teleport does not drive gait');
}
{
 const f=infantry('worker');f.entity.order={kind:'mine',phase:'out'};tick(f,0);tick(f,.1);check(!f.g.userData.unitAnimation.sparks.visible,'worker walking to minerals has no tool effect');
 f.entity.order.phase='harvest';for(let i=1;i<20;i++)tick(f,.1+i/60);
 const s=f.g.userData.unitAnimation;check(s.sparks.visible&&s.workBlend>.9,'harvest channel activates tool track and sparks');
 const pose=s.tool.rotation.z;tick(f,.1+19/60);check(s.tool.rotation.z===pose,'paused simulation freezes work pose');
 f.entity.order=null;for(let i=1;i<30;i++)tick(f,1+i/60);check(!s.sparks.visible&&s.workBlend<.001,'cancelled mining clears tool effect and settles arms');
 f.entity.visualShotSerial=1;tick(f,1.5);check(s.sparks.visible&&s.tool.position.x>s.poses.get(s.tool).position.x,'actual Fusion Cutter fire thrusts and lights the worker tool');
}
{
 const f=infantry('worker');f.entity.x=205;f.entity.y=100;
 const target={x:100,y:100,r:10,hp:100,maxhp:200,building:true,ready:true,footprint:[[-100,-20],[100,-20],[100,20],[-100,20]]};
 f.entity.order={kind:'repair',target};tick(f,0,205,100);const pose=tick(f,.1,205,100);
 check(pose.working,'repair at polygon edge works beyond building selection circle');
 target.planned=true;check(!tick(f,.2,205,100).working,'unstarted building plan cannot trigger work effect');
 target.planned=false;f.entity.x=240;check(!tick(f,.3,240,100).working,'distant repair target cannot trigger work effect');
}
{
 const f=infantry('marauder');tick(f,0);f.entity.cooldown=1;tick(f,.01);const s=f.g.userData.unitAnimation;
 check(s.recoil>0&&s.offRecoil===0,'first confirmed shot recoils one launcher');
 f.entity.cooldown=0;tick(f,.5);f.entity.cooldown=1;tick(f,.51);check(s.offRecoil>0,'next shot alternates launcher');
 tick(f,.52,1);check(s.recoil===0&&s.offRecoil===0,'movement cancels infantry attack track');
 f.entity.cooldown=.5;tick(f,.54,2);check(s.recoil===0&&s.offRecoil===0,'cooldown decay alone does not retrigger recoil');
}
{
 const f=infantry('reaper');f.entity.visualShotSerial=0;tick(f,0);
 f.entity.visualShotSerial=1;f.entity.cooldown=1;f.entity.burst={target:{hp:40}};tick(f,.01);
 const s=f.g.userData.unitAnimation;check(s.recoil>0&&s.offRecoil===0,'Reaper first shot uses explicit launch telemetry');
 f.entity.burst=null;tick(f,.02);check(s.offRecoil===0,'cancelled burst does not fake a second shot');
 f.entity.visualShotSerial=2;tick(f,.08);check(s.offRecoil>0,'actual second burst event recoils the other pistol');
 f.entity.cooldown=2;tick(f,.1);check(s.shotCount===2,'explicit telemetry supersedes cooldown heuristic');
}
{
 const entity={type:'tank',id:3,x:0,y:0,r:24.5,speed:88,cooldown:0,sieged:false},g=new THREE.Group(),turret=new THREE.Group();turret.position.y=28;g.add(turret);view.rod(turret,[7,2,0],[39,2,0],2,0x123456);g.userData.turret=turret;g.userData.struts=[];
 for(const x of [-1,1]){const s=new THREE.Group();view.armor(s,12,2,10,x*28,2,25,0x123456,.3);g.add(s);g.userData.struts.push(s);}
 attachUnitAnimation(view,g,entity);const f={entity,g};tick(f,0);check(g.userData.struts.every(s=>!s.visible),'tank starts with stowed stabilizers');
 entity.transform={toSiege:true,total:3,time:1.5};const half=tick(f,1);check(half.siege===.5&&g.userData.struts.every(s=>s.visible),'deploy stabilizers interpolate at half transform');
 entity.transform=null;entity.sieged=true;const end=tick(f,3);check(end.siege===1&&turret.position.y===32,'siege settles at full stance');
 entity.transform={toSiege:false,total:2,time:1};check(tick(f,4).siege===.5,'unsiege reverses the same continuous pose');
 entity.transform=null;entity.sieged=false;check(tick(f,5).siege===0,'unsieged returns to stowed stance');
}
console.log(`${checks} unit animation checks passed.`);
