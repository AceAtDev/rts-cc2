import * as THREE from './vendor/three.module.js';
import {CAMERA_PROFILE} from './camera-profile.js';
import {VITAL_COLORS,lifeColor,barWidth} from './presentation-profile.js';
import {mineralVisualState,workerStatus} from './resource-presentation.js';
import {attachUnitAnimation,updateUnitAnimation} from './unit-animation.js';
import {attachBuildingAnimation,updateBuildingAnimation} from './building-animation.js';
const TAU=Math.PI*2;
export class Battlefield {
 constructor(canvas,overlay,world,rocks,geysers){
  this.canvas=canvas;this.overlay=overlay;this.oc=overlay.getContext('2d');this.world=world;this.objects=new Map();this.resourceObjects=new Map();this.scenery=[];this.width=innerWidth;this.height=innerHeight;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0x030709);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(CAMERA_PROFILE.fov,innerWidth/innerHeight,CAMERA_PROFILE.near,CAMERA_PROFILE.far);this.ray=new THREE.Raycaster();this.groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.temp=new THREE.Vector3();
  this.scene.add(new THREE.HemisphereLight(0xc4d6e5,0x45403a,1.5));const sun=new THREE.DirectionalLight(0xffead1,2.7);sun.position.set(-350,1100,450);sun.target.position.set(1050,0,700);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-1400,right:1400,top:1100,bottom:-1100,near:1,far:2500});sun.shadow.bias=-.0003;this.scene.add(sun,sun.target);
  this.materials={};this.geometries={};this.batchMaterials={};
  // SC2's terrain supports unit silhouettes: broad material regions, fine grain,
  // subdued contrast. The original noisy atlas visually swallowed the SCVs.
  const terrain=this.terrainTexture(world,rocks),ground=new THREE.Mesh(new THREE.PlaneGeometry(world.w,world.h),new THREE.MeshStandardMaterial({map:terrain.color,normalMap:terrain.normal,normalScale:new THREE.Vector2(.24,.24),roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(world.w/2,-1,world.h/2);ground.receiveShadow=true;this.scene.add(ground);
  this.contactTexture=this.contactShadowTexture();this.armorTexture=this.armorSurfaceTexture();
  for(const [i,r] of rocks.entries()){const g=new THREE.Group();for(let j=0;j<11;j++){const size=r.r*(j<4?.38:.18+(j%4)*.026),m=new THREE.Mesh(new THREE.DodecahedronGeometry(size,0),this.mat(j%3?0x62625a:0x797970,0)),a=j*2.4,spread=j<4?.36:.7;m.position.set(Math.cos(a)*r.r*spread,j<4?size*.52:5,Math.sin(a)*r.r*spread);m.scale.set(1,.42+j%3*.13,.8);m.rotation.set(.15*(j%3),j*1.57+i,.09*(j%2));m.castShadow=m.receiveShadow=true;g.add(m)}this.mergeStatic(g);g.position.set(r.x,0,r.y);this.scene.add(g)}
  for(const g of geysers){const a=new THREE.Group();for(let j=0;j<5;j++){let m=new THREE.Mesh(new THREE.DodecahedronGeometry(16),this.mat(0x474c42));m.position.set(Math.cos(j*TAU/5)*18,7,Math.sin(j*TAU/5)*18);m.scale.y=.7;a.add(m)}const glow=this.cylinder(12,19,3,0x58a66c,12);glow.position.y=3;a.add(glow);a.position.set(g.x,0,g.y);this.scene.add(a)}
  this.fogTexture=new THREE.DataTexture(new Uint8Array(50*34*4),50,34,THREE.RGBAFormat);this.fogTexture.minFilter=THREE.LinearFilter;this.fogTexture.magFilter=THREE.LinearFilter;
  const fog=new THREE.Mesh(new THREE.PlaneGeometry(world.w,world.h),new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,uniforms:{fogMap:{value:this.fogTexture}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D fogMap;varying vec2 vUv;void main(){float f=texture2D(fogMap,vec2(vUv.x,1.0-vUv.y)).r;gl_FragColor=vec4(.006,.012,.013,(1.0-f)*.98);}'}));fog.rotation.x=-Math.PI/2;fog.position.set(world.w/2,10,world.h/2);fog.renderOrder=20;this.scene.add(fog);
  this.ringGeometry=new THREE.RingGeometry(1,1.035,64);this.ringMaterial=new THREE.MeshBasicMaterial({color:0x00fa19,side:THREE.DoubleSide,depthWrite:false});this.redRingMaterial=new THREE.MeshBasicMaterial({color:0xe60000,side:THREE.DoubleSide});this.selectedRingMaterial=new THREE.MeshBasicMaterial({color:0x00a85a,side:THREE.DoubleSide,depthWrite:false});this.preselectionMaterial=new THREE.MeshBasicMaterial({color:0x00fa19,side:THREE.DoubleSide,depthWrite:false,transparent:true,opacity:.75});this.enemyPreselectionMaterial=this.preselectionMaterial.clone();this.enemyPreselectionMaterial.color.setHex(0xe60000);const hoverVertices=[];for(let i=0;i<80;i++){if(i%10>=8)continue;const a=i*TAU/80,b=(i+1)*TAU/80,point=(t,r)=>[Math.cos(t)*r,Math.sin(t)*r,0];hoverVertices.push(...point(a,1.06),...point(b,1.06),...point(b,1.10),...point(a,1.06),...point(b,1.10),...point(a,1.10));}this.preselectionGeometry=new THREE.BufferGeometry();this.preselectionGeometry.setAttribute('position',new THREE.Float32BufferAttribute(hoverVertices,3));this.hovered=null;this.hoverTime=-Infinity;this.previousTime=0;this.resize();
 }
 mergeStatic(group,exclude=new Set()){
  group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map(),remove=[];
  group.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==group;p=p.parent)if(exclude.has(p))return;const original=o.material;if(Array.isArray(original))return;const mergeKey=original.metalness+':'+original.roughness+':'+(original.map?.uuid||'');const m=original.emissive?.getHex()||original.transparent?original:(this.batchMaterials[mergeKey]??=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,map:original.map,metalness:original.metalness,roughness:original.roughness}));const geometry=o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));const data=batches.get(m)||{position:[],normal:[],uv:[],color:[],index:[],count:0};const p=geometry.attributes.position,n=geometry.attributes.normal,u=geometry.attributes.uv;for(let i=0;i<p.count;i++){data.position.push(p.getX(i),p.getY(i),p.getZ(i));data.normal.push(n?n.getX(i):0,n?n.getY(i):1,n?n.getZ(i):0);data.uv.push(u?u.getX(i):0,u?u.getY(i):0);data.color.push(original.color.r,original.color.g,original.color.b)}if(geometry.index)for(const index of geometry.index.array)data.index.push(index+data.count);else for(let i=0;i<p.count;i++)data.index.push(i+data.count);data.count+=p.count;batches.set(m,data);remove.push(o);geometry.dispose()});
  for(const o of remove)o.parent.remove(o);for(const [m,d] of batches){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(d.position,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(d.normal,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(d.uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(d.color,3));geo.setIndex(d.index);const mesh=new THREE.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}
 }
 removeModel(group){this.scene.remove(group);const sharedGeometry=new Set([...Object.values(this.geometries),this.ringGeometry,this.preselectionGeometry]),sharedMaterials=new Set([...Object.values(this.materials),...Object.values(this.batchMaterials),this.ringMaterial,this.redRingMaterial,this.selectedRingMaterial,this.preselectionMaterial,this.enemyPreselectionMaterial]);const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry&&!sharedGeometry.has(o.geometry))geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(!sharedMaterials.has(material))materials.add(material)});for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();}
 mat(color,metal=.4,emissive=0){const key=color+':'+metal+':'+emissive;if(!this.materials[key])this.materials[key]=new THREE.MeshStandardMaterial({color,map:metal>0&&!emissive?this.armorTexture:null,metalness:metal,roughness:metal?.58:1,emissive,emissiveIntensity:1.4});return this.materials[key]}
 box(w,h,d,color,metal=.4){const key=[w,h,d].join();const geo=this.geometries[key]??=(new THREE.BoxGeometry(w,h,d));const m=new THREE.Mesh(geo,this.mat(color,metal));m.castShadow=true;m.receiveShadow=true;return m}
 cylinder(a,b,h,color,n=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(a,b,h,n),this.mat(color));m.castShadow=true;m.receiveShadow=true;return m}
 part(g,w,h,d,x,y,z,color,metal=.4){const m=this.box(w,h,d,color,metal);m.position.set(x,y,z);g.add(m);return m}
 terrainTexture(world,rocks){
  const size=1024,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const context=canvas.getContext('2d'),pixels=context.createImageData(size,size),normal=context.createImageData(size,size),heights=new Float32Array(size*size);
  const hash=(x,y)=>{let n=Math.imul(x+2317,374761393)^Math.imul(y+571,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295};
  const noise=(x,y)=>{let i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;u=u*u*(3-2*u);v=v*v*(3-2*v);return(hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,wx=x/size*world.w,wy=y/size*world.h;let broad=noise(x/150,y/150),mottled=noise(x/42,y/42),grain=noise(x/2.6,y/2.6),fine=hash(x,y);const trail=Math.exp(-Math.pow((wx-450-(world.h-wy)*.74)/100,2));let stone=0;for(const r of rocks)stone=Math.max(stone,Math.exp(-Math.pow(Math.hypot(wx-r.x,wy-r.y)/(r.r*1.8),2)));const light=broad*13+mottled*9+(grain-.5)*8+(fine-.5)*5+trail*12-stone*8;pixels.data.set([70+light,68+light*.94,57+light*.8,255],i*4);heights[i]=grain*.6+fine*.15+mottled*.12;}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,dx=heights[y*size+Math.max(0,x-1)]-heights[y*size+Math.min(size-1,x+1)],dy=heights[Math.max(0,y-1)*size+x]-heights[Math.min(size-1,y+1)*size+x];normal.data.set([128+dx*70,128+dy*70,249,255],i*4)}
  context.putImageData(pixels,0,0);const nc=document.createElement('canvas');nc.width=nc.height=size;nc.getContext('2d').putImageData(normal,0,0);const color=new THREE.CanvasTexture(canvas),bump=new THREE.CanvasTexture(nc);color.colorSpace=THREE.SRGBColorSpace;color.anisotropy=bump.anisotropy=8;return{color,normal:bump};
 }
 armorSurfaceTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),im=c.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){let hash=Math.imul(x+171,374761393)^Math.imul(y+1217,668265263);hash=Math.imul(hash^(hash>>>13),1274126177);const n=((hash^(hash>>>16))>>>0)/4294967295,value=216+n*24+(y%27===0?8:0);im.data.set([value,value,value,255],(y*128+x)*4)}c.putImageData(im,0,0);c.strokeStyle='rgba(255,255,255,.13)';c.lineWidth=.5;for(let i=0;i<27;i++){const x=i*53%128,y=i*31%128;c.beginPath();c.moveTo(x,y);c.lineTo(x+4+i%8,y+1);c.stroke()}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture}
 contactShadowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,4,32,32,32);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(.6,'rgba(0,0,0,.22)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}
 // Cut-corner, beveled armor plates keep the heavy Terran forms from reading as
 // generic cubes. Cached geometry is merged into a handful of material batches.
 armor(g,w,h,d,x,y,z,color,bevel=1){const key='armor:'+w+':'+h+':'+d+':'+bevel;let geo=this.geometries[key];if(!geo){const c=Math.min(w,d)*.13,shape=new THREE.Shape();shape.moveTo(-w/2+c,-d/2);shape.lineTo(w/2-c,-d/2);shape.lineTo(w/2,-d/2+c);shape.lineTo(w/2,d/2-c);shape.lineTo(w/2-c,d/2);shape.lineTo(-w/2+c,d/2);shape.lineTo(-w/2,d/2-c);shape.lineTo(-w/2,-d/2+c);shape.closePath();geo=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.1,h-bevel*2),bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel});geo.rotateX(-Math.PI/2);geo.translate(0,-h/2+bevel,0);this.geometries[key]=geo;}const m=new THREE.Mesh(geo,this.mat(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m}
 rounded(g,x,y,z,sx,sy,sz,color){const key='sphere';const geo=this.geometries[key]??=new THREE.SphereGeometry(1,12,8);const m=new THREE.Mesh(geo,this.mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;g.add(m);return m}
 rod(g,a,b,r,color){const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),m=this.cylinder(r,r,v.length(),color,8);m.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());g.add(m);return m}
 light(g,w,h,d,x,y,z,color=0x90d9e9){const m=this.part(g,w,h,d,x,y,z,0x334955);m.material=this.mat(color,.2,color);return m}
 vent(g,x,y,z,w,d,count=5){this.armor(g,w,2,d,x,y,z,0x262b2e,.35);for(let i=0;i<count;i++)this.part(g,w-2,.7,1,x,y+1.6,z-d/2+2+i*(d-4)/Math.max(1,count-1),0x697477)}
 model(e){const g=new THREE.Group(),blue=e.team?0x9c3130:0x1f528a,trim=e.team?0xd35948:0x397db6,steel=0x7d8585,armor=0x9aa09a,dark=0x30383b,black=0x1b2327,amber=0xc9a34b;g.userData={};
  if(e.building){
   if(e.type==='core'){
    const base=this.cylinder(48,59,13,dark,12);base.position.y=9;g.add(base);
    const hull=this.cylinder(31,51,30,steel,12);hull.position.y=28;g.add(hull);
    for(let j=0;j<6;j++){const a=j*TAU/6,section=new THREE.Group();section.rotation.y=a;
     this.armor(section,29,12,30,0,18,44,dark,1.4);this.armor(section,28,19,28,0,31,37,blue,1.4);
     const slope=this.armor(section,26,5,23,0,44,29,armor,1.2);slope.rotation.x=-.43;
     this.vent(section,0,47,24,17,11,4);this.light(section,19,3,2,0,33,53);
     this.armor(section,27,5,22,0,3,53,dark,1);this.armor(section,18,3,13,0,7,54,steel,.7);
     this.rod(section,[-8,10,48],[-8,25,39],2.8,dark);this.rod(section,[8,10,48],[8,25,39],2.8,dark);
     for(const x of [-11,11])this.part(section,2,1.5,5,x,6,61,amber);
     g.add(section);
    }
    this.armor(g,41,11,40,0,51,0,dark,2);this.armor(g,25,3,27,0,59,-2,blue,1);this.light(g,32,2,2,0,50,21);
    this.armor(g,31,24,12,0,23,49,dark,1);this.part(g,19,15,2,0,21,57,black);this.light(g,20,2,2,0,31,58,0xe3ddab);
    const ramp=this.armor(g,26,2,24,0,5,62,steel,.5);ramp.rotation.x=.17;for(let i=-2;i<=2;i++)this.part(g,3,.5,4,i*4.5,7,73,i%2?amber:dark);
    this.rod(g,[17,52,-10],[17,75,-10],1.2,dark);this.light(g,3,3,3,17,76,-10);this.rod(g,[-40,24,29],[-40,48,29],.7,steel);
    if(e.morph==='orbital'){const radar=new THREE.Group();const dish=new THREE.Mesh(new THREE.SphereGeometry(13,16,8,0,TAU,0,Math.PI/2),this.mat(armor));dish.rotation.z=-.7;dish.position.y=8;radar.add(dish);this.rod(radar,[0,0,0],[0,11,0],2,dark);radar.position.set(-18,62,-7);g.add(radar);g.userData.radar=radar}
    if(e.morph==='planetary'){const t=new THREE.Group();this.armor(t,35,14,29,0,0,0,blue,1);for(let z of [-9,9]){this.rod(t,[12,4,z],[48,4,z],3,steel);this.part(t,9,7,7,48,4,z,dark)}t.position.set(0,67,0);g.add(t);g.userData.turret=t}
   }else if(e.type==='relay'){
    this.armor(g,55,5,55,0,3,0,dark,.9);this.armor(g,47,18,42,0,15,0,steel,1.1);this.armor(g,46,5,41,0,26,0,blue,.8);
    for(let z of [-13,0,13]){this.armor(g,35,2,7,0,30,z,armor,.5);for(let x of [-14,14])this.part(g,3,1,5,x,31.5,z,amber)}
    for(let x of [-21,21]){this.light(g,2,2,22,x,22,0,0x70da87);this.armor(g,5,11,30,x,12,0,dark,.7)}
    this.part(g,25,8,1,0,13,22,dark);for(let j=-2;j<=2;j++)this.part(g,1,7,1,j*4,13,23,steel);
   }else if(e.type==='barracks'){
    for(let x of [-25,25]){
     this.armor(g,25,34,67,x,35,0,blue,1.5);this.armor(g,24,8,68,x,57,0,dark,1.1);this.armor(g,24,10,21,x,65,-24,steel,1.2);this.vent(g,x,71,-24,18,16,5);
     this.light(g,22,3,2,x,29,34,0xe7ddb2);this.light(g,2,3,20,x+Math.sign(x)*13,29,20,0xe7ddb2);
     for(let z of [-26,26]){this.rod(g,[x,0,z],[x,23,z],3.8,steel);const f=this.cylinder(8,11,4,dark,10);f.position.set(x,3,z);g.add(f)}
     for(let z of [-14,0,14])this.part(g,1,20,1,x+Math.sign(x)*13,44,z,trim);
    }
    this.armor(g,22,31,54,0,31,1,dark,1.3);this.armor(g,17,7,34,0,51,0,steel,.8);this.part(g,13,21,2,0,27,29,black);this.light(g,14,2,2,0,39,30,0xe7ddb2);this.armor(g,19,2,14,0,8,33,steel,.5);
    for(let x of [-10,10])this.rod(g,[x,53,-25],[x,76,-25],1.2,dark);
   }else if(e.type==='factory'){
    this.armor(g,80,8,73,0,5,0,dark,1.2);this.armor(g,70,26,59,0,23,0,steel,1.3);this.armor(g,61,6,52,-2,40,-3,blue,1.2);
    this.armor(g,38,16,32,-13,50,-12,armor,1.1);this.vent(g,-13,60,-12,27,20,6);this.armor(g,22,26,27,24,46,-14,dark,1.2);
    for(let x of [18,29]){const pipe=this.cylinder(4,5,24,steel,10);pipe.position.set(x,67,-16);g.add(pipe);this.cylinder(4,4,1,black)}
    this.part(g,35,20,3,-5,22,31,black);for(let x=-19;x<13;x+=5)this.part(g,2,18,1,x,22,33,dark);this.light(g,39,2,2,-5,34,33,0xe8dca4);
    for(let x of [-32,32]){this.armor(g,12,13,32,x,14,23,blue,1);this.armor(g,10,3,30,x,5,23,steel,.7)}
    for(let x of [-15,15])this.part(g,5,1,6,x,12,36,amber);
   }else if(e.type==='engineering'){
    this.armor(g,73,8,67,0,5,0,dark,1.1);this.armor(g,61,24,55,0,22,0,steel,1.2);this.armor(g,60,6,53,0,39,0,blue,1);
    const roof=this.armor(g,43,5,38,-9,45,-7,armor,1.2);roof.rotation.z=-.12;
    const fan=this.cylinder(12,14,4,dark,20);fan.position.set(15,47,12);g.add(fan);for(let i=0;i<4;i++){const p=this.part(g,21,1,3,15,50,12,steel);p.rotation.y=i*Math.PI/4}
    for(let x of [-19,0,19]){this.part(g,9,12,2,x,24,29,dark);this.light(g,6,2,2,x,29,30)}
   }else if(e.type==='techlab'||e.type==='reactor'){
    this.armor(g,50,5,47,0,3,0,dark,1);this.armor(g,41,24,36,0,18,0,steel,1);this.armor(g,37,4,32,0,33,0,blue,.9);
    if(e.type==='reactor')for(let x of [-11,11]){const c=this.cylinder(8,9,28,armor,14);c.position.set(x,43,0);g.add(c);const cap=this.cylinder(8,8,3,blue,14);cap.position.set(x,58,0);g.add(cap);this.light(g,2,19,2,x-8,43,2,0x65cbb9)}
    else{this.armor(g,22,13,24,-5,42,-2,armor,1);this.vent(g,-5,51,-2,15,16,5);this.light(g,22,3,2,0,23,19,0x78deaa)}
   }else if(e.type==='refinery'){
    this.armor(g,77,7,68,0,4,0,dark,1.1);for(let [x,z] of [[-20,-10],[18,-10],[0,19]]){const c=this.cylinder(11,13,34,steel,14);c.position.set(x,29,z);g.add(c);const cap=this.cylinder(10,11,5,blue,14);cap.position.set(x,48,z);g.add(cap);this.rod(g,[x,13,z],[x,7,z+15],2,dark)}
    this.armor(g,48,14,19,0,19,26,blue,1);this.light(g,28,3,2,0,23,37,0x74dca0);this.rod(g,[-20,46,-10],[18,46,-10],2.2,dark);this.rod(g,[18,46,-10],[18,57,-10],2.2,dark);
   }
  }else if(e.type==='tank'){
   for(let z of [-14,14]){this.armor(g,47,11,11,0,8,z,dark,1.3);for(let i=0;i<6;i++){const w=this.cylinder(3.7,3.7,12,steel,10);w.rotation.x=Math.PI/2;w.position.set(-18+i*7,8,z);g.add(w)}this.armor(g,46,3,12,0,15,z,steel,.6)}
   this.armor(g,39,11,27,0,17,0,armor,1);for(let z of [-9,9])this.armor(g,34,3,7,-2,24,z,blue,.6);const turret=new THREE.Group();this.armor(turret,24,10,22,-4,0,0,steel,1);this.armor(turret,19,3,18,-5,7,0,blue,.7);this.rod(turret,[7,2,0],[39,2,0],2.7,dark);this.rod(turret,[11,2,0],[34,2,0],1.9,steel);this.armor(turret,7,6,7,39,2,0,dark,.5);turret.position.y=28;g.add(turret);g.userData.turret=turret;
   for(const sx of [-1,1])for(const sz of [-1,1]){const strut=new THREE.Group();this.rod(strut,[sx*13,7,sz*13],[sx*28,3,sz*25],2.4,steel);this.armor(strut,13,2,10,sx*29,2,sz*25,dark,.5);g.add(strut);strut.visible=!!e.sieged;g.userData.struts??=[];g.userData.struts.push(strut)}
   this.vent(g,-15,25,0,10,12,4);
  }else if(e.type==='hellion'){
   for(let x of [-13,13])for(let z of [-11,11]){const wheel=this.cylinder(6,6,5,dark,12);wheel.rotation.x=Math.PI/2;wheel.position.set(x,6,z);g.add(wheel);const hub=this.cylinder(3,3,5.4,steel,10);hub.rotation.x=Math.PI/2;hub.position.set(x,6,z);g.add(hub)}
   this.armor(g,36,6,18,0,10,0,dark,.8);this.armor(g,18,5,18,10,15,0,blue,.8);this.armor(g,15,5,17,-12,14,0,steel,.6);this.armor(g,13,7,14,-2,18,0,blue,.8);this.part(g,3,5,9,5,19,0,0x41585f);this.rod(g,[-6,18,-8],[-6,25,-8],1,dark);this.rod(g,[-6,25,-8],[5,25,-8],1,dark);this.rod(g,[5,25,-8],[5,17,-8],1,dark);
   const turret=new THREE.Group();this.rod(turret,[0,0,0],[16,0,0],1.7,steel);this.part(turret,4,4,4,17,0,0,dark);turret.position.set(0,25,0);g.add(turret);g.userData.turret=turret;
   for(let z of [-7,7])this.light(g,2,2,3,18,14,z,0xeee4bb);
  }else{
   const worker=e.type==='worker',big=e.type==='marauder',body=new THREE.Group();g.add(body);
   if(worker){
    this.armor(body,11,12,10,-1,15,0,steel,.7);this.armor(body,8,5,9,3,21,0,blue,.5);this.part(body,2,3,6,7,21,0,0x7397a0);this.armor(body,7,10,10,-8,14,0,dark,.6);this.vent(body,-8,20,0,5,7,3);
    for(let z of [-6,6]){this.rounded(body,0,17,z,4,4,3.5,armor);this.armor(body,6,3,7,-2,20,z,blue,.4)}
    const l=new THREE.Group(),r=new THREE.Group();for(let [leg,z] of [[l,-4],[r,4]]){leg.position.set(-1,10,z);this.rod(leg,[0,0,0],[2,-5,0],1.8,dark);this.armor(leg,4,4,4,2,-5,0,steel,.4);this.armor(leg,7,3,5,4,-8,0,dark,.4);body.add(leg)}g.userData.legs=[l,r];
    this.rod(body,[2,17,-7],[7,12,-9],1.8,dark);this.armor(body,5,8,5,8,10,-9,armor,.4);this.rod(body,[8,8,-9],[13,7,-9],1.2,steel);for(let z of [-11,-7])this.part(body,6,1.5,1.5,13,7,z,dark);
    this.rod(body,[2,17,7],[9,13,8],2,steel);this.armor(body,6,5,5,10,13,8,blue,.4);const drill=this.cylinder(1.2,2.5,8,steel,8);drill.rotation.z=-Math.PI/2;drill.position.set(17,13,8);body.add(drill);this.part(body,3,3,3,12,14,8,amber);
    const cargo=new THREE.Group();for(let j=0;j<3;j++){const shard=new THREE.Mesh(new THREE.ConeGeometry(2,7,4),this.mat(0x54c6e9,.2,0x0a4b6a));shard.position.set(-7+j*2,25,0);shard.rotation.z=(j-1)*.35;cargo.add(shard)}const gasCargo=new THREE.Group();for(let j=0;j<2;j++){const can=this.cylinder(2.5,2.5,6,0x577864,8);can.position.set(-6+j*3,25,0);gasCargo.add(can)}gasCargo.visible=false;body.add(cargo,gasCargo);g.userData.cargo=cargo;g.userData.gasCargo=gasCargo;
   }else{
    const s=big?1.27:1;body.scale.setScalar(s);this.rounded(body,0,15,0,6,7,5,blue);this.armor(body,8,4,8,-1,22,0,steel,.6);this.rounded(body,2,23,0,4,4,3.8,blue);this.rounded(body,5,24,0,1.3,1.2,3,0xbf9560);this.armor(body,5,11,8,-6,17,0,dark,.6);
    for(let z of [-7,7]){this.rounded(body,0,18,z,4.5,4.5,4,blue);this.armor(body,6,2,6,0,22,z,trim,.5)}
    const l=new THREE.Group(),r=new THREE.Group();for(let [leg,z] of [[l,-3.4],[r,3.4]]){leg.position.set(0,10,z);this.rounded(leg,0,-2,0,2.5,4,2.6,dark);this.armor(leg,4,4,5,1,-5,0,blue,.4);this.armor(leg,7,3,5,3,-8,0,steel,.4);body.add(leg)}g.userData.legs=[l,r];
    if(big)for(let z of [-8,8]){this.armor(body,7,8,8,5,12,z,blue,.8);this.rod(body,[6,14,z],[15,14,z],2.8,dark);this.rod(body,[10,14,z],[15,14,z],2.1,steel)}
    else{this.rod(body,[1,16,-7],[8,13,-3],1.5,steel);this.rod(body,[1,16,7],[9,13,5],1.5,steel);this.armor(body,15,3,4,12,14,4,dark,.35);this.rod(body,[17,14,4],[23,14,4],.9,steel);this.part(body,5,3,3,11,12,4,steel)}
   }
  }
  if(e.building){const actor=attachBuildingAnimation(this,g,e);for(const part of [actor.damage,actor.plumes,actor.weld])part.userData.noPick=true;}else attachUnitAnimation(this,g,e);for(const cargo of [g.userData.cargo,g.userData.gasCargo].filter(Boolean))this.mergeStatic(cargo);this.mergeStatic(g,new Set([...(g.userData.animationParts||[]),...(g.userData.legs||[]),...(g.userData.struts||[]),g.userData.turret,g.userData.radar,g.userData.cargo,g.userData.gasCargo].filter(Boolean)));
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.contactTexture,transparent:true,depthWrite:false,opacity:e.building?.65:.8}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.3;shadow.scale.setScalar(e.building?e.r*2.1:e.r*3);shadow.userData.noPick=true;g.add(shadow);g.userData.shadow=shadow;
  const ring=new THREE.Mesh(this.ringGeometry,this.ringMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.8;ring.scale.setScalar(e.r+(e.building?2:1));ring.visible=false;ring.userData.noPick=true;g.add(ring);g.userData.ring=ring;const hover=new THREE.Mesh(this.preselectionGeometry,this.preselectionMaterial);hover.name='preselection-ring';hover.rotation.x=-Math.PI/2;hover.position.y=1;hover.scale.setScalar(e.r+(e.building?2:1));hover.visible=false;hover.raycast=()=>{};g.add(hover);g.userData.preselection=hover;g.userData.height=e.building?(e.type==='core'?76:e.type==='barracks'?78:e.type==='factory'?80:55):e.type==='tank'?39:e.type==='marauder'?35:28;this.scene.add(g);return g;
 }
 mineral(n){const g=new THREE.Group();g.userData.resourceLevels=[];
  for(let level=0;level<4;level++){const cluster=new THREE.Group();for(let j=0;j<3+level*2;j++){const height=13+(j*11%17),radius=3.5+(j%3)*1.1,geometry=new THREE.BufferGeometry(),positions=[],seed=n.x*.031+n.y*.017,a=j*2.399+seed,r=Math.sqrt(j+1)*5.3,cx=Math.cos(a)*r,cz=Math.sin(a)*r*.5;
   const base=[],shoulder=[];for(let k=0;k<5;k++){const t=k*TAU/5;base.push([Math.cos(t)*radius,0,Math.sin(t)*radius]);shoulder.push([Math.cos(t+.08)*radius*.77+1,height*.62,Math.sin(t+.08)*radius*.77-.6]);}const tip=[1.5,height,-1.1];for(let k=0;k<5;k++){const next=(k+1)%5;positions.push(...base[k],...base[next],...shoulder[next],...base[k],...shoulder[next],...shoulder[k],...shoulder[k],...shoulder[next],...tip);}geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const crystal=new THREE.Mesh(geometry,this.mat(j%3===0?0x429bc4:j%3===1?0x72c3e7:0x266ba7,.18,0x092a46));crystal.position.set(cx,1,cz);crystal.rotation.set((j%2-.5)*.2,a,(j%3-1)*.15);crystal.castShadow=true;cluster.add(crystal);}
   for(let j=0;j<5;j++){const gravel=new THREE.Mesh(new THREE.DodecahedronGeometry(2+j%2,0),this.mat(0x4c5b60,0));gravel.position.set(-18+j*8,.7,(j%2-.5)*10);gravel.scale.y=.35;cluster.add(gravel)}this.mergeStatic(cluster);cluster.visible=false;g.add(cluster);g.userData.resourceLevels.push(cluster);}
  g.userData.node=n;g.position.set(n.x,0,n.y);this.scene.add(g);return g;}
 resize(){this.width=innerWidth;this.height=innerHeight;this.renderer.setSize(this.width,this.height,false);this.overlay.width=this.width*Math.min(devicePixelRatio,2);this.overlay.height=this.height*Math.min(devicePixelRatio,2);this.oc.setTransform(Math.min(devicePixelRatio,2),0,0,Math.min(devicePixelRatio,2),0,0)}
 setCamera(cam){
  const fieldOfView=CAMERA_PROFILE.fov,pitch=(cam.pitch??56)*Math.PI/180;
  const distance=cam.distance??CAMERA_PROFILE.zoomStops[0].distance,yaw=cam.yaw||0,offset=Math.cos(pitch)*distance;
  this.camera.fov=fieldOfView;this.camera.aspect=this.width/this.height;
  this.camera.position.set(cam.x+Math.sin(yaw)*offset,Math.sin(pitch)*distance,cam.y+Math.cos(yaw)*offset);
  this.camera.lookAt(cam.x,0,cam.y);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
 }
 // Three.js recursive raycasts include invisible descendants. Pick only rendered
 // solid geometry so hidden construction stages and visual effects cannot grab commands.
 pickVisible(roots,x,y){this.scene.updateMatrixWorld(true);this.ray.setFromCamera({x:x/this.width*2-1,y:1-y/this.height*2},this.camera);const meshes=[];for(const root of roots.filter(Boolean))root.traverseVisible(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p.userData.noPick)return;meshes.push(o)});return this.ray.intersectObjects(meshes,false)}
 ground(x,y){this.ray.setFromCamera(new THREE.Vector2(x/this.width*2-1,1-y/this.height*2),this.camera);const p=this.ray.ray.intersectPlane(this.groundPlane,this.temp);return p?{x:p.x,y:p.z}:{x:0,y:0}}
 project(x,y,z=0){this.temp.set(x,z,y).project(this.camera);return{x:(this.temp.x+1)*this.width/2,y:(1-this.temp.y)*this.height/2}}
 render(state,alpha){const now=performance.now(),frameDt=Math.min(.1,(now-this.previousTime)/1000||1/60);this.previousTime=now;const {entities,minerals,selected,cam,visible,seen,drag,pointer,time,placement,validBuild,placementPreview,keys}=state;this.setCamera(cam);const ids=new Set();
  const resourceNodes=new Set(minerals);for(const [node,mesh] of this.resourceObjects)if(!resourceNodes.has(node)){this.removeModel(mesh);this.resourceObjects.delete(node)}
  for(const n of minerals){if(!n.mesh){n.mesh=this.mineral(n);this.resourceObjects.set(n,n.mesh)}const level=mineralVisualState(n);n.mesh.visible=level>=0;n.mesh.scale.setScalar(1);n.mesh.userData.visualState=level;for(let i=0;i<4;i++)n.mesh.userData.resourceLevels[i].visible=i===level}
  for(const e of entities){ids.add(e.id);let mesh=this.objects.get(e.id);const signature=e.type+e.team+(e.morph||'');if(mesh?.userData.signature!==signature||mesh?.userData.entity!==e){if(mesh)this.removeModel(mesh);mesh=this.model(e);mesh.userData.signature=signature;mesh.userData.entity=e;this.objects.set(e.id,mesh)}const cell=Math.min(33,Math.max(0,Math.floor(e.y/42)))*50+Math.min(49,Math.max(0,Math.floor(e.x/42)));mesh.visible=!e.planned&&!e.loadedIn&&!e.insideRefinery&&(e.team===0||visible[cell]===1);if(!mesh.visible)continue;
   const x=e.px+(e.x-e.px)*alpha,y=e.py+(e.y-e.py)*alpha;mesh.position.set(x,0,y);mesh.scale.setScalar(1);const oldAngle=e.pangle??e.angle,angle=oldAngle+Math.atan2(Math.sin(e.angle-oldAngle),Math.cos(e.angle-oldAngle))*alpha;if(!e.building)mesh.rotation.y=-angle;if(mesh.userData.turret){const end=e.turretAngle??e.angle,start=e.pturretAngle??end;mesh.userData.turret.rotation.y=-(start+Math.atan2(Math.sin(end-start),Math.cos(end-start))*alpha)-mesh.rotation.y;}
   const frame={dt:frameDt,time,alpha,x,y};if(e.building)mesh.userData.buildingPose=updateBuildingAnimation(mesh,e,frame);else updateUnitAnimation(mesh,e,frame);
   mesh.userData.ring.visible=selected.includes(e);mesh.userData.ring.position.y=.8;mesh.userData.shadow.position.y=.3;mesh.userData.ring.material=e.team?this.redRingMaterial:e.type===state.activeType?this.ringMaterial:this.selectedRingMaterial;mesh.userData.shadow.visible=true;mesh.userData.shadow.material.opacity=(e.building?.65:.8)*(mesh.userData.buildingPose?.shadowOpacity??1);if(mesh.userData.cargo)mesh.userData.cargo.visible=e.carry>0&&!e.carryGas;if(mesh.userData.gasCargo)mesh.userData.gasCargo.visible=e.carry>0&&!!e.carryGas;
  }for(const [id,m] of this.objects)if(!ids.has(id)){this.removeModel(m);this.objects.delete(id)}
  const data=this.fogTexture.image.data;for(let i=0;i<visible.length;i++){data[i*4]=visible[i]?255:seen[i]?120:0;data[i*4+3]=255}this.fogTexture.needsUpdate=true;
  const grid=placement?placementPreview(pointer.world.x,pointer.world.y):null;
  if(placement){const kind=placement.type,sign=kind+(placement.landing?'land':'');if(this.ghost?.userData.signature!==sign){if(this.ghost)this.removeModel(this.ghost);this.ghost=this.model({...SC2.defs[kind],type:kind,team:0});this.ghost.userData.signature=sign;this.ghost.traverse(o=>{if(o.isMesh&&o!==this.ghost.userData.ring&&o!==this.ghost.userData.shadow){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.4;o.material.depthWrite=false}})}this.ghost.visible=true;if(this.ghost.userData.valid!==grid.valid){this.ghost.userData.valid=grid.valid;this.ghost.traverse(o=>{if(o.isMesh&&o!==this.ghost.userData.ring&&o!==this.ghost.userData.shadow){o.material.vertexColors=false;o.material.color.setHex(grid.valid?0x42ed67:0xf03e51);o.material.emissive?.setHex(grid.valid?0x146b24:0x6b1424);o.material.wireframe=true;o.material.opacity=.55;}})}this.ghost.position.set(grid.x,0,grid.y);this.ghost.userData.ring.visible=true;this.ghost.userData.ring.material=grid.valid?this.ringMaterial:this.redRingMaterial}else if(this.ghost)this.ghost.visible=false;
  const onCanvas=pointer.overCanvas!==false&&pointer.x>=0&&pointer.x<this.width&&pointer.y>=0&&pointer.y<this.height&&document.elementFromPoint(pointer.x,pointer.y)===this.canvas;
  if(!onCanvas)this.hovered=null;else if(now-this.hoverTime>35||this.hoverX!==pointer.x||this.hoverY!==pointer.y){this.hoverTime=now;this.hoverX=pointer.x;this.hoverY=pointer.y;this.scene.updateMatrixWorld(true);this.ray.setFromCamera({x:pointer.x/this.width*2-1,y:1-pointer.y/this.height*2},this.camera);this.hovered=null;for(const h of this.pickVisible([...this.objects.values()],pointer.x,pointer.y)){let m=h.object;while(m&&!m.userData.entity)m=m.parent;if(m){this.hovered=m.userData.entity;break;}}}
  this.canvas.style.cursor=state.mode==='attack'?'crosshair':this.hovered?'crosshair':'default';
  for(const mesh of this.objects.values()){mesh.userData.preselection.visible=mesh.visible&&mesh.userData.entity===this.hovered;mesh.userData.preselection.material=mesh.userData.entity?.team?this.enemyPreselectionMaterial:this.preselectionMaterial;mesh.userData.preselection.rotation.z=time*.5;}
  this.statusBars=new Map();this.workerStatuses=new Map();
  this.renderer.render(this.scene,this.camera);const c=this.oc;c.clearRect(0,0,this.width,this.height);
  if(grid)for(const cell of [...grid.cells,...grid.addonCells]){const ps=[[cell.x0,cell.y0],[cell.x1,cell.y0],[cell.x1,cell.y1],[cell.x0,cell.y1]].map(([x,y])=>this.project(x,y,2));c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=cell.valid?(cell.addon?'#65ce6620':'#61ef5a45'):'#ff3b4c66';c.strokeStyle=cell.valid?'#87fa7799':'#ff627ce6';c.lineWidth=1;c.fill();c.stroke();}
  for(const e of entities){const cell=Math.min(33,Math.max(0,Math.floor(e.y/42)))*50+Math.min(49,Math.max(0,Math.floor(e.x/42)));if(e.planned||e.loadedIn||e.insideRefinery||e.team&&visible[cell]!==1)continue;const p=this.project(e.x,e.y,this.objects.get(e.id)?.userData.buildingPose?.height??this.objects.get(e.id)?.userData.height??35);if(selected.includes(e)||this.hovered===e||keys.has('Alt')||keys.has(e.team?']':'[')||state.healthAlways||e.hp<e.maxhp||!e.ready){const w=barWidth(e.type,this.width),rows=[],drawBar=(ratio,color,kind)=>{const y=p.y+rows.length*7;c.fillStyle='#000';c.fillRect(p.x-w/2-1,y-1,w+2,6);c.fillStyle='#505050';c.fillRect(p.x-w/2,y,w,4);c.fillStyle=color;c.fillRect(p.x-w/2,y,w*Math.max(0,Math.min(1,ratio)),4);c.fillStyle='#0008';for(let j=1;j<8;j++)c.fillRect(p.x-w/2+w*j/8,y,1,4);rows.push({kind,color,ratio,width:w,y});};drawBar(e.hp/e.maxhp,lifeColor(e.hp/e.maxhp),'life');if(!e.ready)drawBar(e.progress,VITAL_COLORS.progress,'progress');else if(e.morph==='orbital')drawBar(e.energy/200,VITAL_COLORS.energy,'energy');this.statusBars.set(e.id,rows);}
   if(selected.includes(e)){const status=workerStatus(e,entities,minerals);if(status){this.workerStatuses.set(e.id,status);c.fillStyle=status.count>status.ideal?'#f5ba64':'#aff0a6';c.font='12px Arial';c.textAlign='center';c.fillText(status.label,p.x,p.y-10);}}

   if(keys.has('Shift')&&selected.includes(e)){let prev=this.project(e.x,e.y,2);c.strokeStyle='#63ec65aa';c.lineWidth=1;for(const order of [e.order,...e.orders]){const dest=order&&(order.target||order.node||order);if(!dest||!Number.isFinite(dest.x))continue;const q=this.project(dest.x,dest.y,2);c.beginPath();c.moveTo(prev.x,prev.y);c.lineTo(q.x,q.y);c.stroke();c.strokeRect(q.x-3,q.y-3,6,6);prev=q}}
   if(e.rally&&selected.includes(e)){const q=this.project(e.rally.x,e.rally.y,2),start=this.project(e.x,e.y,4);c.strokeStyle='#ffd461a0';c.beginPath();c.moveTo(start.x,start.y);c.lineTo(q.x,q.y);c.stroke();c.fillStyle='#ffe36d';c.fillRect(q.x,q.y-18,2,18);c.beginPath();c.moveTo(q.x,q.y-18);c.lineTo(q.x+12,q.y-14);c.lineTo(q.x,q.y-10);c.fill()}
  }
  for(const s of state.shots){const p=this.project(s.x,s.y,18),q=this.project(s.tx,s.ty,18);c.strokeStyle=s.flame?'#ff7929':s.missile?'#fff39c':s.tank?'#ffbb54':'#ffd48c';c.lineWidth=s.flame?5:s.tank?2:1;c.globalAlpha=Math.min(1,s.life/.13);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke()}c.globalAlpha=1;
  for(const m of state.markers){const p=this.project(m.x,m.y,1);c.strokeStyle=m.attack?'#ef5950':'#80f75b';c.lineWidth=1.5;c.beginPath();c.ellipse(p.x,p.y,7+(1-m.life)*17,4+(1-m.life)*10,0,0,TAU);c.stroke()}
  if(drag&&drag.button===0){c.fillStyle='#50dd3915';c.strokeStyle='#70ee5e';c.lineWidth=1;c.fillRect(drag.x,drag.y,pointer.x-drag.x,pointer.y-drag.y);c.strokeRect(drag.x,drag.y,pointer.x-drag.x,pointer.y-drag.y)}
 }
}
