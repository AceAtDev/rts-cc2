import * as THREE from './vendor/three.module.js';

// Actor-section durations from Liberty AbilData.xml, build 74071. The catalog
// uses Normal seconds; the game runs at Faster (1.4). Curves and procedural
// replacement geometry are ours, not extracted Blizzard animation tracks.
export const BUILDING_ANIMATION_TIMING=Object.freeze({
 depot:1.3/1.4,lift:1.5/1.4,landDelay:.5/1.4,land:1.5/1.4,extract:1.981/1.4,damageThink:.5/1.4,
});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const TAU=Math.PI*2;
export function buildingDamageTier(e){
 if(!e.ready||e.hp<=0)return 0;
 const life=e.hp/e.maxhp;return life<.333?3:life<.5?2:life<.666?1:0;
}

function register(group,part){group.userData.animationParts.add(part);return part}
function stageFor(mesh,height){
 mesh.geometry.computeBoundingBox();
 const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
 if(box.max.y<=Math.min(16,height*.22))return 0;
 if(box.max.y<=height*.57)return 1;
 if(box.max.y<=height*.85)return 2;
 return 3;
}

/** Call after authoring geometry, before mergeStatic, before ring/shadow. */
export function attachBuildingAnimation(view,group,e){
 if(!e.building||group.userData.buildingAnimation)return;
 group.userData.animationParts??=new Set();
 const body=register(group,new THREE.Group());body.name='building-body';
 const height=e.type==='core'?78:e.type==='barracks'?78:e.type==='factory'?80:e.type==='relay'?33:60;
 const stages=Array.from({length:4},(_,i)=>{const p=new THREE.Group();p.name='construction-stage-'+i;return p});
 const articulated=[group.userData.radar,group.userData.turret].filter(Boolean);
 group.updateMatrixWorld(true);
 const original=[];
 group.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==group;p=p.parent)if(articulated.includes(p))return;original.push(o)});
 group.add(body);for(const p of stages)body.add(p);
 // Keep original local geometry and transforms. Flattening only static pieces
 // gives construction layers without shrinking the footprint or pick target.
 for(const mesh of original)stages[stageFor(mesh,height)].attach(mesh);
 for(const p of articulated)body.attach(p);
 for(const p of [...group.children])if(p!==body&&p.children.length===0&&!p.isMesh)group.remove(p);

 const width=(e.placeWidth||3)*28,depth=(e.placeHeight||3)*28;
 const scaffold=register(group,new THREE.Group());scaffold.name='construction-scaffold';group.add(scaffold);
 const sx=width*.48,sz=depth*.48;
 for(const x of [-sx,sx])for(const z of [-sz,sz]){
  view.rod(scaffold,[x,2,z],[x,height*.8,z],1,0x747d7b);
  view.part(scaffold,5,2,5,x,2,z,0x323a3c);
 }
 for(const z of [-sz,sz])view.rod(scaffold,[-sx,height*.8,z],[sx,height*.8,z],1,0x747d7b);
 for(const x of [-sx,sx])view.rod(scaffold,[x,height*.8,-sz],[x,height*.8,sz],1,0x747d7b);
 const gantry=register(group,new THREE.Group());gantry.name='construction-gantry';group.add(gantry);
 view.rod(gantry,[-sx,0,0],[sx,0,0],1.2,0x545e60);
 const welder=view.part(gantry,6,4,5,0,-2,0,0xd1b76f);
 const weld=new THREE.Mesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshBasicMaterial({color:0xa9edff,transparent:true,opacity:.9,depthWrite:false}));
 weld.name='construction-weld';weld.scale.setScalar(2);gantry.add(weld);

 const engines=register(group,new THREE.Group());engines.name='building-thrusters';body.add(engines);
 const plumes=new THREE.Group();plumes.name='thruster-plumes';engines.add(plumes);
 const enginePositions=e.type==='core'?Array.from({length:6},(_,i)=>[Math.cos(i*TAU/6)*40,Math.sin(i*TAU/6)*40]):[[-width*.27,-depth*.27],[width*.27,-depth*.27],[-width*.27,depth*.27],[width*.27,depth*.27]];
 const exhaustMaterial=new THREE.MeshBasicMaterial({color:0xffce72,transparent:true,opacity:.64,depthWrite:false});
 for(const [x,z] of enginePositions){
  const nozzle=view.cylinder(3,3.5,3,0x252d31,8);nozzle.position.set(x,1,z);engines.add(nozzle);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(2.5,8,8),exhaustMaterial);flame.rotation.z=Math.PI;flame.position.set(x,-3,z);flame.name='thruster-plume';plumes.add(flame);
 }

 // Existing engineering-bay fan blades already have the correct location.
 const fan=new THREE.Group();fan.position.set(15,50,12);let hasFan=false;
 if(e.type==='engineering'||e.type==='eng')for(const mesh of original){const p=mesh.geometry.parameters;if(p?.width===21&&p?.height===1&&p?.depth===3){if(!hasFan){body.add(fan);body.updateMatrixWorld(true)}fan.attach(mesh);hasFan=true}}
 if(hasFan)register(group,fan);
 const pumps=[];
 if(e.type==='refinery')for(const mesh of original){const p=mesh.geometry.parameters;if(p?.height===5&&p?.radiusTop===10&&p?.radiusBottom===11){body.attach(mesh);register(group,mesh);pumps.push({mesh,y:mesh.position.y})}}
 const activity=register(group,new THREE.Group());activity.name='building-work-indicator';body.add(activity);
 const activityMaterial=new THREE.MeshBasicMaterial({color:0xeed7a1,transparent:true,opacity:0,depthWrite:false});
 if(['core','barracks','factory','techlab','reactor','engineering'].includes(e.type)){
  const strip=new THREE.Mesh(new THREE.BoxGeometry(e.type==='core'?15:12,1.2,1),activityMaterial);strip.position.set(0,e.type==='core'?29:25,depth*.37);activity.add(strip);
 }
 const damage=register(group,new THREE.Group());damage.name='building-damage';body.add(damage);
 const smokeMaterial=new THREE.MeshBasicMaterial({color:0x292b28,transparent:true,opacity:.22,depthWrite:false});
 for(let i=0;i<4;i++){const smoke=new THREE.Mesh(new THREE.SphereGeometry(1,7,5),smokeMaterial);smoke.name='damage-smoke';damage.add(smoke)}
 const fireMaterial=new THREE.MeshBasicMaterial({color:0xffa146,transparent:true,opacity:.7,depthWrite:false});
 for(let i=0;i<2;i++){const fire=new THREE.Mesh(new THREE.ConeGeometry(2.2,8,5),fireMaterial);fire.position.set(-width*.2+i*width*.35,height*.55,depth*.16);damage.add(fire)}

 const state={body,stages,scaffold,gantry,welder,weld,engines,plumes,fan:hasFan?fan:null,fanPhase:0,pumps,activity,activityMaterial,damage,height,width,depth,
  flying:!!e.flying,lowered:!!e.lowered,lift:e.flying?80:0,depot:e.lowered?1:0,
  flightTransition:null,depotTransition:null,time:null,production:0,active:false,damageTier:0,damageNext:0};
 group.userData.buildingAnimation=state;
 // mergeStatic must respect these groups. Body contains separate construction
 // layers and articulated parts, so merge its static layer children individually.
 for(const stage of stages)view.mergeStatic(stage);
 view.mergeStatic(scaffold);view.mergeStatic(gantry,new Set([welder,weld]));
 view.mergeStatic(engines,new Set([plumes]));view.mergeStatic(plumes);
 if(state.fan)view.mergeStatic(state.fan);
 updateBuildingAnimation(group,e,{dt:0,time:0});
 return state;
}

/** Does not move the entity, alter collisions, or change the building root. */
export function updateBuildingAnimation(group,e,{dt=0,time=0}={}){
 const s=group.userData.buildingAnimation;if(!s)return null;
 dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
 // A paused simulation keeps its actor pose rather than continuing mechanical
 // loops. Test callers may advance time explicitly without a renderer.
 const elapsed=s.time===null?dt:clamp(time-s.time,0,.1);s.time=time;
 if(s.flying!==!!e.flying){s.flying=!!e.flying;s.flightTransition={from:s.lift,to:e.flying?80:0,t:0,delay:e.flying?0:BUILDING_ANIMATION_TIMING.landDelay,duration:e.flying?BUILDING_ANIMATION_TIMING.lift:BUILDING_ANIMATION_TIMING.land};}
 if(s.flightTransition){const t=s.flightTransition;t.t+=elapsed;const p=clamp((t.t-t.delay)/t.duration);s.lift=t.from+(t.to-t.from)*smooth(p);if(p===1)s.flightTransition=null;}
 if(s.lowered!==!!e.lowered){s.lowered=!!e.lowered;s.depotTransition={from:s.depot,to:e.lowered?1:0,t:0};}
 if(s.depotTransition){const t=s.depotTransition;t.t+=elapsed;const p=clamp(t.t/BUILDING_ANIMATION_TIMING.depot);s.depot=t.from+(t.to-t.from)*smooth(p);if(p===1)s.depotTransition=null;}
 s.body.position.y=s.lift;
 const ghost=!Object.hasOwn(e,'ready'),ready=ghost||e.ready;
 const progress=ready?1:clamp(e.progress||0),thresholds=[0,.17,.43,.72];
 for(let i=0;i<4;i++){
  const stage=s.stages[i],p=ready?1:smooth((progress-thresholds[i])/.17);
  stage.visible=ready||i===0&&!e.planned||p>0;stage.scale.y=i===0?1:.65+.35*p;
  // A lowered Depot keeps its foundation at ground level while only the upper
  // structure retracts. Its highest plating becomes a flush, passable lid.
  stage.position.y=e.type==='relay'&&i>0?-25*s.depot:0;
 }
 const constructing=!ready&&!e.planned;
 s.scaffold.visible=s.gantry.visible=constructing;
 s.scaffold.scale.y=.22+.78*progress;
 s.gantry.position.y=s.height*.8*(.22+.78*progress);
 const builder=e.builder,working=constructing&&builder?.hp>0&&builder.order?.kind==='build'&&builder.order?.target===e;
 s.weld.visible=working&&Math.sin(time*31+e.id)>-.15;
 const workX=builder?clamp(builder.x-e.x,-s.width*.35,s.width*.35):Math.sin(time*.7)*s.width*.25;
 s.welder.position.x=workX;s.weld.position.set(workX,-5,0);
 s.active=!!(e.ready&&!e.flying&&(e.queue?.some(q=>q.started)||e.research));
 s.production+=elapsed*(s.active?1:0);
 s.fanPhase+=elapsed*(s.active?3.1:1.25);if(s.fan){s.fan.visible=ready||progress>.72;s.fan.rotation.y=s.fanPhase;}
 s.activity.visible=s.active;s.activityMaterial.opacity=s.active?.28+.15*Math.sin(time*3.2):0;
 const extracting=!!(ready&&!ghost&&e.type==='refinery'&&e.harvester?.hp>0&&e.harvester.insideRefinery===e);
 for(let i=0;i<s.pumps.length;i++){const p=s.pumps[i];p.mesh.visible=ready||progress>.43;p.mesh.position.y=p.y+(extracting?Math.sin(time*TAU/BUILDING_ANIMATION_TIMING.extract+i*TAU/3)*.9:0);}
 if(group.userData.radar){group.userData.radar.visible=ready||progress>.72;group.userData.radar.rotation.y=time*.7;}
 s.engines.visible=!!(e.ready&&(e.flying||s.lift>.1));
 s.plumes.scale.y=.92+.08*Math.sin(time*37+e.id);
 if(time>=s.damageNext){s.damageTier=buildingDamageTier(e);s.damageNext=time+BUILDING_ANIMATION_TIMING.damageThink;}
 s.damage.visible=!!(e.ready&&!ghost&&e.hp>0&&s.damageTier);
 const critical=s.damageTier===3;
 s.damage.children.forEach((part,i)=>{
  if(i<4){part.visible=s.damageTier>1||i<2;const p=(time*.3+i*.25+e.id*.13)%1;part.position.set(-s.width*.2+i%2*s.width*.25,s.height*.55+p*22,s.depth*.12+Math.sin(i*4+p)*4);part.scale.setScalar((s.damageTier===1?1:2)+p*(s.damageTier===1?4:6));}
  else{part.visible=critical;part.scale.y=.7+.3*Math.sin(time*17+i*2);}
 });
 return {lift:s.lift,height:s.height+s.lift-(e.type==='relay'?25*s.depot:0),shadowOpacity:clamp(1-s.lift/130,.3,1),flying:e.flying};
}
