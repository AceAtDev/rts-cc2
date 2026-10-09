import {GRID} from './geometry.js';

// Catalog-informed limits, expressed here in simulation seconds. Native UI
// time-domain conversion and overlap grouping have not been established.
export const ALERT_POLICY=Object.freeze({historyLimit:80,recallLimit:8,
  attackWindow:15,attackRadius:15*GRID,attackGlobalLimit:2,pingDuration:6});

export function createAlerts({clock,team=0,policy={}}){
  const config={...ALERT_POLICY,...policy};
  let entries=[],attacks=[],nextId=1,recallIndex=0;
  const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:p.y}:null;
  const copy=e=>({...e});
  function transmit(text,p,{kind='notification',ping=false}={}){
    const location=point(p),message=String(text??'').trim();
    if(!location||!message||kind==='error')return null;
    const now=clock(),entry={id:nextId++,kind,text:message,at:now,...location,
      pingUntil:ping?now+config.pingDuration:0};
    entries.unshift(entry);entries.length=Math.min(entries.length,config.historyLimit);recallIndex=0;
    return copy(entry);
  }
  function error(text){
    const message=String(text??'').trim();
    return message?{kind:'error',text:message,at:clock()}:null;
  }
  function onDamage(source,target,amount){
    if(!source||!target||target.team!==team||source.team===team||!Number.isFinite(source.team)||
      !Number.isFinite(amount)||amount<=0||!point(target))return null;
    const now=clock();attacks=attacks.filter(e=>e.attackUntil>now);const active=attacks;
    const nearby=active.filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<=config.attackRadius)
      .sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))[0];
    const town=!!target.building,kind=town?'attackTown':'attackUnit',text=town?'Our base is under attack!':'Our forces are under attack!';
    if(nearby){
      nearby.hits++;nearby.lastDamageAt=now;
      // A base hit can supersede a nearby unit warning without adding a row.
      // It snapshots this observed own structure; it never keeps an entity.
      if(town&&nearby.kind!=='attackTown'){
        Object.assign(nearby,{kind,text,x:target.x,y:target.y,unitId:target.id,
          sourceId:source.id,pingUntil:Math.max(nearby.pingUntil,now+config.pingDuration)});
        if(!entries.includes(nearby)){entries.unshift(nearby);entries.length=Math.min(entries.length,config.historyLimit);recallIndex=0;}
        return copy(nearby);
      }
      return null;
    }
    if(active.length>=config.attackGlobalLimit)return null;
    const snapshot=transmit(text,target,{kind,ping:true});
    if(!snapshot)return null;
    const entry=entries[0];Object.assign(entry,{unitId:target.id,sourceId:source.id,
      hits:1,lastDamageAt:now,attackUntil:now+config.attackWindow});
    attacks.push(entry);
    return copy(entry);
  }
  function recall(){
    const recent=entries.slice(0,config.recallLimit);if(!recent.length)return null;
    const entry=recent[recallIndex%recent.length];recallIndex=(recallIndex+1)%recent.length;
    return copy(entry);
  }
  return{transmit,error,onDamage,recall,
    history:()=>entries.map(copy),pings:()=>{const now=clock(),seen=new Set();return [...entries,...attacks].filter(e=>{if(e.pingUntil<=now||seen.has(e.id))return false;seen.add(e.id);return true;}).map(copy);},
    reset:()=>{entries=[];attacks=[];nextId=1;recallIndex=0;}};
}
