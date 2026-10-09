// Actor-pose regressions for replacement models. These do not certify native
// M3 animation curves, rendering equivalence, or gameplay morph timing.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {Battlefield} from '../dist/renderer.js';
import {attachBuildingAnimation,updateBuildingAnimation,buildingDamageTier,BUILDING_ANIMATION_TIMING as TIMING} from '../dist/building-animation.js';

let checks=0;
function check(name,fn){fn();checks++;console.log('PASS',name)}
function fixture(type='barracks',extra={}){
 const view=Object.create(Battlefield.prototype);Object.assign(view,{materials:{},geometries:{},batchMaterials:{},armorTexture:null});
 const group=new THREE.Group();group.userData={};
 view.part(group,74,6,70,0,3,0,0x414a4c);view.part(group,60,20,55,0,23,0,0x7c8584);
 view.part(group,45,6,40,0,type==='relay'?28:55,0,0x265b83);
 const entity={id:8,type,building:true,ready:true,progress:1,hp:1000,maxhp:1000,
  team:0,x:500,y:500,placeWidth:type==='relay'?2:3,placeHeight:type==='relay'?2:3,queue:[],...extra};
 const state=attachBuildingAnimation(view,group,entity);
 return{view,group,entity,state,time:0};
}
function advance(f,seconds,step=1/60){let remaining=seconds;while(remaining>1e-10){const dt=Math.min(step,remaining);f.time+=dt;updateBuildingAnimation(f.group,f.entity,{dt,time:f.time});remaining-=dt;}}

check('Construction exposes foundation and frame stages without shrinking root footprint',()=>{
 const f=fixture('barracks',{ready:false,progress:.1});
 assert(f.state.scaffold.visible);assert(f.state.stages[0].visible);assert(!f.state.stages[3].visible);
 assert.equal(f.group.scale.x,1);assert.equal(f.group.scale.z,1);assert.equal(f.group.position.y,0);
 f.entity.progress=.6;advance(f,.2);assert(f.state.stages[2].visible);assert(!f.state.stages[3].visible);
 f.entity.ready=true;advance(f,.1);assert(f.state.stages.every(p=>p.visible&&p.scale.y===1));assert(!f.state.scaffold.visible);
});
check('Welding stops when the builder halts and never leaks to placement ghosts',()=>{
 const f=fixture('barracks',{ready:false,progress:.4});
 f.entity.builder={hp:45,x:470,y:500,order:{kind:'build',target:f.entity}};
 updateBuildingAnimation(f.group,f.entity,{dt:0,time:0});assert(f.state.weld.visible);
 f.entity.builder.order=null;advance(f,.1);assert(!f.state.weld.visible);
 delete f.entity.ready;updateBuildingAnimation(f.group,f.entity,{dt:0,time:f.time});
 assert(f.state.stages.every(p=>p.visible&&p.scale.y===1));assert(!f.state.scaffold.visible);assert(!f.state.damage.visible);assert(!f.state.engines.visible);
});
check('Depot retracts upper structure over catalog actor duration; foundation and root remain fixed',()=>{
 const f=fixture('relay');f.entity.lowered=true;advance(f,TIMING.depot/2);
 assert(Math.abs(f.state.depot-.5)<1e-8);assert.equal(f.state.stages[0].position.y,0);assert.equal(f.group.position.y,0);
 advance(f,TIMING.depot/2);assert(Math.abs(f.state.depot-1)<1e-8);assert.equal(f.state.stages[3].position.y,-25);
 f.entity.lowered=false;advance(f,TIMING.depot);assert(Math.abs(f.state.depot)<1e-8);
});
check('Reversing a Depot command begins from the displayed pose without teleporting',()=>{
 const f=fixture('relay');f.entity.lowered=true;advance(f,.3);const before=f.state.depot;
 f.entity.lowered=false;updateBuildingAnimation(f.group,f.entity,{dt:0,time:f.time});assert.equal(f.state.depot,before);
 advance(f,.15);assert(f.state.depot<before&&f.state.depot>0);
});
check('Liftoff reaches steady altitude; landing observes catalog delay and ground pose',()=>{
 const f=fixture();f.entity.flying=true;advance(f,TIMING.lift/2);assert(Math.abs(f.state.lift-40)<1e-8);
 advance(f,TIMING.lift/2);assert(Math.abs(f.state.lift-80)<1e-8);assert(f.state.engines.visible);
 advance(f,2);assert.equal(f.state.body.position.y,80);assert.equal(f.group.position.y,0);
 f.entity.flying=false;advance(f,TIMING.landDelay);assert.equal(f.state.lift,80);
 advance(f,TIMING.land);assert(Math.abs(f.state.lift)<1e-8);assert(!f.state.engines.visible);
});
check('30 and 120 Hz rendering converge to the same actor pose',()=>{
 const a=fixture(),b=fixture();a.entity.flying=b.entity.flying=true;
 advance(a,.8,1/30);advance(b,.8,1/120);assert(Math.abs(a.state.lift-b.state.lift)<1e-8);
});
check('Pausing simulation time freezes liftoff and mechanical animation',()=>{
 const f=fixture();f.entity.flying=true;advance(f,.3);const lift=f.state.lift;
 for(let i=0;i<50;i++)updateBuildingAnimation(f.group,f.entity,{dt:1/60,time:f.time});assert.equal(f.state.lift,lift);
});
check('Production effect distinguishes active work from a supply-blocked queue',()=>{
 const f=fixture();f.entity.queue=[{started:false}];advance(f,.1);assert(!f.state.activity.visible);
 f.entity.queue[0].started=true;advance(f,.1);assert(f.state.activity.visible&&f.state.activityMaterial.opacity>0);
 f.entity.flying=true;advance(f,.1);assert(!f.state.activity.visible);
});
check('Dynamic body, crane, work effect, and damage groups survive root mesh batching',()=>{
 const f=fixture();f.view.mergeStatic(f.group,f.group.userData.animationParts);
 for(const p of [f.state.body,f.state.gantry,f.state.damage,f.state.activity])assert(p.parent);
 f.entity.flying=true;advance(f,.5);assert(f.state.body.position.y>0);
});
check('Damage effects track native state-monitor cadence and ignore unfinished buildings',()=>{
 const f=fixture('factory',{hp:200});advance(f,.1);assert(f.state.damage.visible);
 f.entity.hp=1000;advance(f,TIMING.damageThink);assert(!f.state.damage.visible);
 f.entity.hp=100;f.entity.ready=false;advance(f,.1);assert(!f.state.damage.visible);
});
check('Damage-state thresholds use exact native .666, .5 and .333 boundaries',()=>{
 const e={ready:true,maxhp:1000};
 for(const [hp,tier] of [[666,0],[665.99,1],[500,1],[499.99,2],[333,2],[332.99,3]])assert.equal(buildingDamageTier({...e,hp}),tier);
 assert.equal(buildingDamageTier({...e,hp:1,ready:false}),0);assert.equal(buildingDamageTier({...e,hp:0}),0);
});
console.log(`${checks} building animation actor-pose checks passed; native animation equivalence remains unverified.`);
