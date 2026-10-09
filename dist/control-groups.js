// SC2 exposes these five operations in Blizzard's s2clientprotocol/ui.proto.
// Keyboard aliases and the double-tap interval are browser policy, not native measurements.
export const CONTROL_GROUP_OPERATIONS=Object.freeze(['recall','set','append','setAndSteal','appendAndSteal']);
const validDigit=digit=>/^[0-9]$/.test(String(digit));
const liveOwned=(unit,team)=>unit&&unit.team===team&&unit.hp>0&&!unit.planned;
// Keep remembered IDs while gas extraction or transport makes a worker
// inaccessible. Recall/assignment resumes when its actor becomes controllable.
const selectable=unit=>!unit.loadedIn&&!unit.insideRefinery;

export function controlGroupDigit(event){
  // event.key is "!" for Shift+1 on a US keyboard. The physical digit survives modifiers.
  const physical=/^Digit([0-9])$/.exec(event.code||'');
  if(physical)return physical[1];
  // Programmatic/accessibility events can omit code; do not map unrelated key codes.
  return validDigit(event.key)?String(event.key):null;
}

export function controlGroupOperation(event){
  const control=Boolean(event.ctrlKey||event.metaKey),shift=Boolean(event.shiftKey),alt=Boolean(event.altKey);
  // No verified binding for Ctrl+Shift(+Alt); do not silently append or overwrite a group.
  if(control&&shift)return null;
  if(alt)return shift?'appendAndSteal':'setAndSteal';
  if(control)return 'set';
  if(shift)return 'append';
  return 'recall';
}

export function controlGroupButtonOperation(event){
  // Pinned Core GameStrings: left selects, right sets, Alt+right sets and steals.
  if(event.button===0)return 'recall';
  if(event.button===2)return event.altKey?'setAndSteal':'set';
  return null;
}

export function sortedSelection(units){
  const ids=new Set();
  return units.filter(unit=>unit&&unit.hp>0&&!ids.has(unit.id)&&ids.add(unit.id))
    .sort((a,b)=>(b.subgroupPriority||0)-(a.subgroupPriority||0)||a.id-b.id);
}

export function subgroupTypes(units){return [...new Set(sortedSelection(units).map(unit=>unit.type))];}

export function cycleSubgroup(units,activeType,direction=1){
  const types=subgroupTypes(units);
  if(!types.length)return null;
  const index=types.indexOf(activeType);
  if(index<0)return direction<0?types.at(-1):types[0];
  return types[(index+(direction<0?-1:1)+types.length)%types.length];
}

export function pruneControlGroups(groups,entities,{team=0}={}){
  const live=new Set(entities.filter(unit=>liveOwned(unit,team)).map(unit=>unit.id));
  const result={};
  for(const [digit,ids] of Object.entries(groups))if(validDigit(digit))result[digit]=[...new Set(ids)].filter(id=>live.has(id));
  return result;
}

export function groupMembers(groups,digit,entities,{team=0,selectableOnly=false}={}){
  const ids=new Set(groups[digit]||[]);
  return sortedSelection(entities.filter(unit=>ids.has(unit.id)&&liveOwned(unit,team)&&(!selectableOnly||selectable(unit))));
}

export function assignControlGroup(groups,digit,selection,entities,operation,{team=0}={}){
  if(!validDigit(digit)||!CONTROL_GROUP_OPERATIONS.includes(operation)||operation==='recall')return groups;
  const result=pruneControlGroups(groups,entities,{team});
  const live=new Map(entities.filter(unit=>liveOwned(unit,team)).map(unit=>[unit.id,unit]));
  const ids=sortedSelection(selection).filter(unit=>live.get(unit.id)===unit&&selectable(unit)).map(unit=>unit.id);
  const append=operation==='append'||operation==='appendAndSteal';
  result[digit]=append?[...new Set([...(result[digit]||[]),...ids])]:ids;
  if(operation.endsWith('AndSteal')){
    const taken=new Set(ids);
    for(const key of Object.keys(result))if(key!==String(digit))result[key]=result[key].filter(id=>!taken.has(id));
  }
  return result;
}

export function createGroupRecallTracker({windowMs=350}={}){
  let lastDigit=null,lastAt=-Infinity;
  const cancel=()=>{lastDigit=null;lastAt=-Infinity;};
  return {
    recall(digit,now,canCenter=true){
      if(!validDigit(digit)||!Number.isFinite(now)||!canCenter){cancel();return false;}
      const center=lastDigit===String(digit)&&now>=lastAt&&now-lastAt<windowMs;
      lastDigit=String(digit);lastAt=now;
      return center;
    },
    cancel,
    reset:cancel,
  };
}
