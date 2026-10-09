import assert from 'node:assert/strict';
import {quoteRepair,REPAIR_COST_FACTOR} from '../dist/repair.js';

let checks=0;
function check(name,test){test();checks++;console.log('PASS',name);}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
const tank=(hp=175)=>({maxhp:175,hp,cost:150,gas:125});
const dt=1/22.4,requestedHP=175/(45/1.4)*dt;

check('A Tank with one-hundredth HP missing pays for that restoration rather than a full nominal tick',()=>{
  const t=tank(174.99),q=quoteRepair(t,requestedHP);
  close(q.hp,.01);close(q.minerals,150*.25*.01/175);close(q.gas,125*.25*.01/175);
  assert.ok(q.minerals<150*.25*requestedHP/175);assert.equal(t.hp,174.99);
});
check('A final tiny repair is affordable when cash covers actual restoration but not the nominal tick',()=>{
  const cash={minerals:.01,gas:.01},q=quoteRepair(tank(174.99),requestedHP);
  assert.ok(cash.minerals>=q.minerals&&cash.gas>=q.gas);
  assert.ok(cash.minerals<150*.25*requestedHP/175);
});
check('Ordinary incomplete ticks preserve the existing repair rate and resource ratio',()=>{
  const q=quoteRepair(tank(100),requestedHP);close(q.hp,requestedHP);
  close(q.minerals,150*.25*requestedHP/175);close(q.gas,125*.25*requestedHP/175);
});
check('Repairing a whole missing-life fraction across many ticks costs exactly that fraction of quarter cost',()=>{
  const t=tank(1),start=t.hp;let minerals=0,gas=0,ticks=0;
  while(t.hp<t.maxhp){const q=quoteRepair(t,requestedHP);assert.ok(q.hp>0);t.hp+=q.hp;minerals+=q.minerals;gas+=q.gas;assert.ok(++ticks<1000);}
  close(minerals,150*.25*(175-start)/175);close(gas,125*.25*(175-start)/175);assert.equal(t.hp,175);
});
check('Two repairers in one loop charge only the damage remaining when each is serviced',()=>{
  const t=tank(174.7),first=quoteRepair(t,requestedHP);t.hp+=first.hp;
  const second=quoteRepair(t,requestedHP);assert.ok(second.hp<requestedHP);t.hp+=second.hp;
  close(first.hp+second.hp,.3);close(first.minerals+second.minerals,150*.25*.3/175);
  close(first.gas+second.gas,125*.25*.3/175);assert.equal(t.hp,175);
});
check('Full-health and over-full targets incur no restoration or resource drain',()=>{
  for(const hp of [175,180])assert.deepEqual(quoteRepair(tank(hp),requestedHP),{hp:0,minerals:0,gas:0});
});
check('Mineral-only mechanical targets do not acquire a gas charge',()=>{
  const q=quoteRepair({maxhp:90,hp:45,cost:100},100);assert.deepEqual(q,{hp:45,minerals:12.5,gas:0});
});
check('Paused, negative and invalid quotes cannot drain resources or produce NaN values',()=>{
  for(const amount of [0,-1,NaN,Infinity])assert.deepEqual(quoteRepair(tank(100),amount),{hp:0,minerals:0,gas:0});
  for(const target of [null,{maxhp:0,hp:0},{maxhp:NaN,hp:0},{maxhp:175,hp:NaN}])assert.deepEqual(quoteRepair(target,1),{hp:0,minerals:0,gas:0});
});
check('The cost factor remains the pinned quarter factor without rounding resource fractions',()=>{
  assert.equal(REPAIR_COST_FACTOR,.25);const q=quoteRepair(tank(174.99),requestedHP);
  assert.ok(q.minerals>0&&q.minerals<1);assert.ok(q.gas>0&&q.gas<1);
});
console.log(`${checks} repair quote checks passed`);
