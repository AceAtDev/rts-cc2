import assert from 'node:assert/strict';
import {mineralVisualState,workerStatus,MINERAL_DEPLETION_ALERT,MINERAL_VISUAL_VARIANTS} from '../dist/resource-presentation.js';
import {applyFootprints,snapPlacement} from '../dist/geometry.js';

let checks=0;
function check(name,run){run();checks++;console.log('PASS',name);}
const core=(id,x,team=0)=>({id,type:'core',team,x,y:0,hp:1500,ready:true,r:70});
const patch=(x,amount=1800)=>({x,y:0,r:21,amount,capacity:1800,footprint:[[-28,-14],[-28,14],[28,14],[28,-14]]});
const worker=(id,order,extra={})=>({id,type:'worker',team:0,hp:45,x:0,y:0,order,...extra});
const a=core(1,0),b=core(2,400),enemy=core(3,1200,1);
const m1=patch(-230),m2=patch(200),m3=patch(600),mEnemy=patch(1180);
const gas={id:4,type:'refinery',team:0,hp:500,ready:true,x:80,y:100,geyser:{amount:2250}};
const minerals=[m1,m2,m3,mEnemy],buildings=[a,b,enemy,gas];

check('Catalog alert threshold remains separate from four visual groups',()=>{
  assert.equal(MINERAL_DEPLETION_ALERT,750);assert.equal(MINERAL_VISUAL_VARIANTS,4);
  assert.equal(mineralVisualState({amount:750,capacity:1800}),1);
});
check('Capacity metadata distinguishes a full small field from a half-mined large one',()=>{
  assert.equal(mineralVisualState({amount:900,capacity:900}),3);
  assert.equal(mineralVisualState({amount:900,capacity:1800}),2);
});
check('Crystal states change discretely at the documented inferred quarter boundaries',()=>{
  for(const [amount,state] of [[1800,3],[1400,3],[1350,3],[1349,2],[900,2],[899,1],[450,1],[449,0],[1,0],[0,-1],[-5,-1]])
    assert.equal(mineralVisualState({amount,capacity:1800}),state,`amount=${amount}`);
});
check('An invalid or empty mineral field has no rendered crystal state',()=>{
  assert.equal(mineralVisualState(null),-1);assert.equal(mineralVisualState({amount:NaN}),-1);
  assert.equal(mineralVisualState({amount:1800}),3);
});
check('Surface-aware eight-unit search includes initial mineral centers at 230',()=>{
  assert.deepEqual(workerStatus(a,buildings,[m1]),{count:0,ideal:2,label:'Workers: 0/2'});
  assert.equal(workerStatus(a,buildings,[patch(-350)]).ideal,0);
});
check('Both footprints contribute to the inferred search while an off-radius field stays excluded',()=>{
  assert.equal(workerStatus(a,buildings,[patch(-300)]).ideal,2);
  assert.equal(workerStatus(a,buildings,[patch(-350)]).ideal,0);
});
check('Actual snapped opening associates all eight mineral fields and twelve SCVs per base',()=>{
  const defs=Object.fromEntries(['core','relay','barracks','factory','engineering','refinery','techlab','reactor'].map(type=>[type,{}]));applyFootprints(defs);
  const start=[{...core(1,0),...defs.core,...snapPlacement({x:360,y:1030},5)},{...core(2,0,1),...defs.core,...snapPlacement({x:1770,y:300},5)}];
  const nodes=[];
  for(const base of start)for(let i=0;i<8;i++){
    const angle=(base.team?-.75:2.25)+(i-3.5)*.15;
    const p=snapPlacement({x:base.x+Math.cos(angle)*230,y:base.y+Math.sin(angle)*230},2,1);
    while(nodes.some(n=>Math.abs(n.x-p.x)<56&&Math.abs(n.y-p.y)<28))p.y+=base.team?-28:28;
    nodes.push({...patch(p.x,i%2?900:1800),...p,capacity:i%2?900:1800});
  }
  const units=[];
  for(const base of start){
    const fields=nodes.filter(n=>Math.hypot(n.x-base.x,n.y-base.y)<300);
    assert.equal(fields.length,8);
    for(let i=0;i<12;i++)units.push(worker(10+units.length,{kind:'mine',node:fields[i%8],phase:'out'},{team:base.team}));
  }
  for(const base of start)assert.deepEqual(workerStatus(base,[...start,...units],nodes),{count:12,ideal:16,label:'Workers: 12/16'});
});
check('Overlapping bases share fields deterministically without double-counting ideal capacity',()=>{
  const left=workerStatus(a,buildings,minerals),right=workerStatus(b,[b,a,enemy,gas],minerals);
  assert.equal(left.ideal,4);assert.equal(right.ideal,2);
});
check('Mineral workers stay associated with their field rather than their position near another base',()=>{
  const mining=worker(5,{kind:'mine',node:m1,phase:'home'},{x:400,carry:5});
  assert.equal(workerStatus(a,[...buildings,mining],minerals).count,1);
  assert.equal(workerStatus(b,[...buildings,mining],minerals).count,0);
});
check('Gas harvest and gas cargo returns contribute only to their particular Refinery',()=>{
  const otherGas={...gas,id:8,geyser:{amount:2250}},inside=worker(5,{kind:'gas',target:gas,phase:'harvest'},{insideRefinery:gas});
  const returningGas=worker(6,{kind:'return',target:a,resume:{kind:'gas',target:gas}},{carry:4,carryGas:true});
  const elsewhere=worker(7,{kind:'gas',target:otherGas,phase:'out'}),all=[...buildings,otherGas,inside,returningGas,elsewhere];
  assert.equal(workerStatus(gas,all,minerals).count,2);assert.equal(workerStatus(otherGas,all,minerals).count,1);
  assert.equal(workerStatus(a,all,minerals).count,0);assert.equal(workerStatus(gas,all,minerals).ideal,3);
});
check('Explicit Return Cargo preserves the mineral assignment saved for resumption',()=>{
  const back=worker(5,{kind:'return',target:b,resume:{kind:'mine',node:m1}},{carry:5});
  assert.equal(workerStatus(a,[...buildings,back],minerals).count,1);
  assert.equal(workerStatus(b,[...buildings,back],minerals).count,0);
});
check('Dead, loaded, idle and merely future-queued workers are not assigned harvesters',()=>{
  const order={kind:'mine',node:m1};
  const excluded=[worker(5,order,{hp:0}),worker(6,order,{loadedIn:a}),worker(7,null,{carry:5}),worker(8,{kind:'build',target:a},{orders:[order]}),worker(9,order,{team:1})];
  assert.equal(workerStatus(a,[...buildings,...excluded],minerals).count,0);
});
check('Depleted and dying fields lose ideal capacity while a final healthy-field cargo trip remains counted',()=>{
  const exhausted=patch(-180,0),dead=patch(-200,1800);dead.hp=0;
  const lastTrip=worker(5,{kind:'mine',node:exhausted,phase:'home'},{carry:5}),waiting=worker(6,{kind:'mine',node:exhausted,phase:'out'}),deadTrip=worker(7,{kind:'mine',node:dead,phase:'home'},{carry:5});
  assert.deepEqual(workerStatus(a,[...buildings,lastTrip,waiting,deadTrip],[exhausted,dead]),{count:1,ideal:0,label:'Workers: 1/0'});
});
check('Empty gas loses ideal capacity but a last returning gas cargo remains attributed',()=>{
  const depleted={...gas,geyser:{amount:0}},back=worker(5,{kind:'return',target:a,resume:{kind:'gas',target:depleted}},{carry:4,carryGas:true}),waiting=worker(6,{kind:'gas',target:depleted,phase:'out'});
  assert.deepEqual(workerStatus(depleted,[...buildings,depleted,back,waiting],minerals),{count:1,ideal:0,label:'Workers: 1/0'});
});
check('Flying, planned, unfinished and dead structures have no worker label',()=>{
  for(const building of [a,gas])for(const extra of [{flying:true},{planned:true},{ready:false},{hp:0}])
    assert.equal(workerStatus({...building,...extra},buildings,minerals),null);
  assert.equal(workerStatus({...a,type:'barracks'},buildings,minerals),null);
});
check('Raising a base removes it from live mineral association instead of retaining a duplicate ideal',()=>{
  const floating={...a,flying:true},near=core(10,-160);
  assert.equal(workerStatus(near,[floating,near],[m1]).ideal,2);
  assert.equal(workerStatus(floating,[floating,near],[m1]),null);
});
console.log(`Passed ${checks} resource-presentation fidelity checks. Native visual boundaries and harvester search equivalence remain unverified.`);
