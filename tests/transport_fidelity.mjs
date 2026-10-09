import assert from 'node:assert/strict';
import {createTransport,TRANSPORT} from '../dist/transport.js';
let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++;console.log('PASS',name);};
const fixture=()=>{
 const center={type:'core',id:10,team:0,x:500,y:500,r:70,hp:1500,ready:true,orders:[]},entities=[center];let contact=false,boarded=[];
 const worker=(id,x=700)=>{const w={type:'worker',id,team:0,x,y:500,r:10.5,hp:45,carry:5,orders:[],order:null};entities.push(w);return w;};
 const issue=(w,o)=>{w.order=o;w.orders=[];return true;},stop=w=>{w.order=null;w.orders=[];w.vx=w.vy=0;},complete=w=>{w.order=w.orders.shift()||null;};
 const api=createTransport({entities:()=>entities,issue,stop,complete,move:(w,c)=>{if(contact){w.x=c.x+c.r+w.r+20;return true;}return false;},openPoint:()=>true,project:p=>p,onBoard:w=>boarded.push(w)});
 return{center,entities,worker,api,get boarded(){return boarded},contact:v=>contact=v};
};
{
 const f=fixture(),workers=Array.from({length:8},(_,i)=>f.worker(i+1,610+i*15));
 check('Load requests only the five available passenger slots',f.api.load(f.center)&&f.center.boarding.length===5&&workers.slice(5).every(w=>!w.order));
 check('Load is an approach order rather than instant hiding',workers.slice(0,5).every(w=>w.order?.kind==='board'&&!w.loadedIn));
 check('Repeated Load cannot reserve excess slots',!f.api.load(f.center)&&f.center.boarding.length===5);
 check('Outside contact workers stay visible',f.api.updateWorker(workers[0],1/22.4)==='approach'&&!workers[0].loadedIn);
 f.contact(true);check('Contact admission hides the passenger exactly once',f.api.updateWorker(workers[0],1/22.4)==='loaded'&&f.center.loaded.length===1&&f.boarded.length===1);
 check('Boarding preserves earned cargo and the worker object',workers[0].carry===5&&f.center.loaded[0]===workers[0]);
 workers[1].order={kind:'move',x:900,y:500};f.api.reconcile(f.center);check('Interrupted boarding releases its capacity reservation',f.center.boarding.length===3&&f.api.candidates(f.center).length===1);
}
{
 const f=fixture(),builder=f.worker(1,600),gas=f.worker(2,610),enemy=f.worker(3,620),dead=f.worker(4,630),far=f.worker(5,1000),idle=f.worker(6,640);
 builder.order={kind:'build'};gas.insideRefinery={};enemy.team=1;dead.hp=0;
 check('Load skips builders gas occupants enemies dead and out-of-search workers',f.api.load(f.center)&&f.center.boarding.length===1&&f.center.boarding[0]===idle);
 f.center.flying=true;check('Lifting preserves approaching passenger reservations',idle.order?.kind==='board'&&f.center.boarding.length===1);f.center.morph='orbital';f.api.updateWorker(idle,1/22.4);check('An incompatible morphed target cancels pending boarding cleanly',!idle.order&&!idle.loadedIn);
}
{
 const f=fixture();f.contact(true);const workers=Array.from({length:5},(_,i)=>f.worker(i+1,600+i*10));f.api.load(f.center);for(const w of workers)f.api.updateWorker(w,1/22.4);
 f.center.flying=true;check('Flying Command Center can unload living workers',f.api.unload(f.center,workers[0])&&f.center.loaded.length===4&&!workers[0].loadedIn);f.center.flying=false;
 check('Unload clears every passenger with distinct exterior exits',f.api.unload(f.center)&&f.center.loaded.length===0&&workers.every(w=>!w.loadedIn)&&workers.every((w,i)=>workers.slice(i+1).every(v=>Math.hypot(w.x-v.x,w.y-v.y)>=w.r+v.r+.5)));
 check('Unload synchronizes render interpolation and leaves cargo intact',workers.every(w=>w.x===w.px&&w.y===w.py&&w.carry===5));
}
{
 const f=fixture();f.contact(true);const w=f.worker(1,600);f.api.load(f.center);f.api.updateWorker(w,1/22.4);f.center.hp=0;f.api.destroyed(f.center);check('Grounded transport destruction releases a living passenger',w.hp===45&&!w.loadedIn);
 const g=fixture();g.contact(true);const p=g.worker(1,600);g.api.load(g.center);g.api.updateWorker(p,1/22.4);g.center.flying=true;g.center.hp=0;g.api.destroyed(g.center);check('Destroyed flying transport kills its passenger',p.hp===0&&!p.loadedIn);
}
check('Capacity search and contact use separate catalog values',TRANSPORT.capacity===5&&TRANSPORT.searchRadius===224&&TRANSPORT.range===28);
console.log(`${checks} transport checks passed`);
