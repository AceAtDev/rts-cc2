import assert from 'node:assert/strict';
import {createGameLoop,SIMULATION_STEP} from '../dist/game-loop.js';
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name)};
check('Display rates produce equal authoritative tick counts',()=>{
 for(const fps of [30,60,120,144]){const loop=createGameLoop();let ticks=0;for(let i=0;i<fps*10;i++)loop.advance(1/fps,()=>ticks++);assert.equal(ticks,224);assert.ok(loop.state.debt<1e-8)}
});
check('A 300 ms stall retains both native whole ticks and fractional time',()=>{
 const loop=createGameLoop();let time=0;const r=loop.advance(.3,dt=>time+=dt);assert.equal(r.steps,6);assert.ok(Math.abs(time+r.debt-.3)<1e-8);assert.ok(r.debt>0);assert.ok(r.alpha>=0&&r.alpha<=1);
});
check('Long frames preserve backlog while bounding native ticks per display frame',()=>{
 const loop=createGameLoop();let ticks=0;const r=loop.advance(SIMULATION_STEP*18,()=>ticks++);assert.equal(r.steps,6);assert.equal(r.alpha,1);loop.advance(0,()=>ticks++);loop.advance(0,()=>ticks++);assert.equal(ticks,18);assert.ok(loop.state.debt<1e-8);
});
check('Backlogged frames never extrapolate beyond the latest unit state',()=>{
 const loop=createGameLoop();const r=loop.advance(2,()=>{});assert.equal(r.steps,6);assert.equal(r.alpha,1);assert.ok(r.debt>1.7);
});
check('Pause clears debt without advancing gameplay',()=>{
 const loop=createGameLoop();let ticks=0;loop.advance(.3,()=>ticks++);loop.advance(1,()=>ticks++,()=>false);assert.equal(ticks,6);assert.equal(loop.state.debt,0);loop.advance(SIMULATION_STEP,()=>ticks++);assert.equal(ticks,7);
});
check('Ending a match during a frame prevents further catch-up ticks',()=>{
 const loop=createGameLoop();let running=true,ticks=0;loop.advance(.3,()=>{ticks++;if(ticks===2)running=false},()=>running);assert.equal(ticks,2);assert.equal(loop.state.debt,0);
});
check('Reset clears phase and schedule counters',()=>{
 const loop=createGameLoop();loop.advance(.03,()=>{});loop.reset();assert.deepEqual(loop.state,{step:SIMULATION_STEP,maxSteps:6,debt:0,totalSteps:0});
});
check('Invalid frame durations never poison the clock',()=>{
 const loop=createGameLoop();for(const d of [NaN,Infinity,-1])loop.advance(d,()=>assert.fail());assert.equal(loop.state.debt,0);
});
console.log(`${checks} game-loop scheduling checks passed; native phase/timing equivalence is not established.`);
