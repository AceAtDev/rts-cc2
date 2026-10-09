// Blizzard documents Faster as22.4 authoritative loops/s. Render interpolation
// is independent; this does not reproduce the proprietary internal phase order.
export const SIMULATION_HZ=22.4;
export const SIMULATION_STEP=1/SIMULATION_HZ;
export function createGameLoop({step=SIMULATION_STEP,maxSteps=6}={}){
 if(!(step>0)||!Number.isFinite(step)||!Number.isInteger(maxSteps)||maxSteps<1)throw new RangeError('Invalid simulation schedule');
 let debt=0,totalSteps=0;
 const clear=()=>{debt=0};
 return {
  advance(elapsed,update,canRun=()=>true){
   if(!canRun()){clear();return {steps:0,alpha:1,debt:0}}
   if(Number.isFinite(elapsed)&&elapsed>0)debt+=elapsed;
   let steps=0;
   while(debt+step*1e-9>=step&&steps<maxSteps&&canRun()){
    update(step);debt=Math.max(0,debt-step);steps++;totalSteps++;
   }
   if(!canRun())clear();
   return {steps,alpha:Math.min(1,debt/step),debt};
  },
  clear,reset(){clear();totalSteps=0},
  get alpha(){return Math.min(1,debt/step)},
  get state(){return {step,maxSteps,debt,totalSteps}},
 };
}
