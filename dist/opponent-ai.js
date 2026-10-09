import {GRID} from './geometry.js';

// This is a fair, bounded policy for this map/subset, not Blizzard's AI script.
export function createOpponentAI({team=1,defs,entities,minerals,geysers,clock,
  visible,used,capacity,wallet,placement,build,train,addon,issue,issueGroup,world}){
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const alive=e=>e.hp>0&&!e.loadedIn;
  const assigned=w=>w.order?.kind==='return'?w.order.resume:w.order;
  let memories=new Map(),commands=new Map(),gatherSlots=new Map(),wave=null,lastWave=-Infinity,
    scoutId=null,scoutStep=0,nextScout=0,defendUntil=0,defensePoint=null,lastBuild=new Map(),mode='gather';
  const clampPoint=p=>({x:Math.max(2*GRID,Math.min(world.w-2*GRID,p.x)),y:Math.max(2*GRID,Math.min(world.h-2*GRID,p.y))});
  function reset(){memories.clear();commands.clear();gatherSlots.clear();lastBuild.clear();wave=null;lastWave=-Infinity;scoutId=null;scoutStep=0;nextScout=0;defendUntil=0;defensePoint=null;mode='gather';}
  function observe(all,now){
    const seen=all.filter(e=>e.team!==team&&alive(e)&&visible(team,e));
    for(const e of seen)memories.set(e.id,{id:e.id,type:e.type,building:!!e.building,x:e.x,y:e.y,at:now});
    const seenIds=new Set(seen.map(e=>e.id));
    for(const [id,m] of memories)if((!m.building&&now-m.at>12)||(visible(team,m)&&!seenIds.has(id)))memories.delete(id);
    return seen;
  }
  function intent(e,p,role){
    if(e.sieged||e.transform)return null;
    const previous=commands.get(e.id),same=previous?.role===role&&distance(previous,p)<GRID;
    // Keep existing acquisition, windup and pursuit intact between policy ticks.
    if(same&&(e.order||distance(e,previous.arrival||p)<GRID*1.5))return null;
    const target=e.combatTarget||e.windup?.target;
    if(previous?.role===role&&target?.hp>0&&target.team!==team&&visible(team,target))return null;
    return{kind:'attackMove',x:p.x,y:p.y};
  }
  function record(e,p,role){
    const o=e.order,arrival=o?.arrival||(o&&Number.isFinite(o.x)&&Number.isFinite(o.y)?{x:o.x,y:o.y}:p);
    commands.set(e.id,{x:p.x,y:p.y,role,arrival:{x:arrival.x,y:arrival.y}});
  }
  function command(e,p,role){const o=intent(e,p,role);if(o){issue(e,o);record(e,p,role);}}
  function commandGroup(units,p,role){
    const entries=units.map(u=>({u,o:intent(u,p,role)})).filter(entry=>entry.o);
    if(!entries.length)return;
    // Match the player's shared goal, arrival reservations and routing admission.
    if(issueGroup)issueGroup(entries,{x:p.x,y:p.y});else for(const {u,o} of entries)issue(u,o);
    for(const {u} of entries)record(u,p,role);
  }
  function gatherPoint(e,stage){
    if(!gatherSlots.has(e.id)){
      const usedSlots=new Set(gatherSlots.values());let index=0;while(usedSlots.has(index))index++;
      gatherSlots.set(e.id,index);
    }
    let index=gatherSlots.get(e.id);
    if(!index)return{...stage};
    index--;for(let ring=1;ring<=10;ring++)for(let y=-ring;y<=ring;y++)for(let x=-ring;x<=ring;x++)if(Math.max(Math.abs(x),Math.abs(y))===ring){
      if(index--===0)return clampPoint({x:stage.x+x*2*GRID,y:stage.y+y*2*GRID});
    }
    return{...stage};
  }
  function propose(type,base,now,preferred=null){
    const d=defs[type],cash=wallet(team);
    if(!d||cash.minerals<d.cost||cash.gas<(d.gas||0)||now-(lastBuild.get(type)??-Infinity)<2)return null;
    lastBuild.set(type,now);
    const producer=['barracks','factory'].includes(type);
    const origin=preferred||clampPoint({x:base.x+(type==='relay'?5: type==='factory'?3:-5)*GRID,y:base.y+(type==='relay'?-3:6)*GRID});
    // At most 49 candidates per proposal; no unrestricted map search.
    const offsets=[{x:0,y:0}];
    if(!preferred)for(let r=1;r<=3;r++)for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(Math.max(Math.abs(x),Math.abs(y))===r)offsets.push({x:x*2*GRID,y:y*2*GRID});
    for(const offset of offsets){
      const p=placement(type,{x:origin.x+offset.x,y:origin.y+offset.y});
      if(!p?.valid||producer&&p.addonCells?.some(c=>!c.valid))continue;
      const result=build(type,p);if(result)return result;
      // Valid placement but rejected cost/prerequisite/builder: retry next tick.
      break;
    }
    return null;
  }
  function update(){
    const now=clock(),all=entities(),own=all.filter(e=>e.team===team&&alive(e)),bases=own.filter(e=>e.type==='core'&&e.ready&&!e.flying&&!e.planned);
    const seen=observe(all,now);if(!bases.length)return;
    const base=bases[0],workers=own.filter(e=>e.type==='worker'),army=own.filter(e=>!e.building&&e.type!=='worker');
    const localFields=minerals().filter(n=>n.amount>0&&bases.some(b=>distance(n,b)<14*GRID));
    const localGas=geysers().filter(g=>g.amount>0&&bases.some(b=>distance(g,b)<14*GRID));
    const refineries=own.filter(e=>e.type==='refinery'&&e.ready&&!e.flying&&localGas.includes(e.geyser)&&e.geyser.amount>0);
    const fieldLoads=new Map(localFields.map(n=>[n,0]));
    for(const w of workers){const o=assigned(w);if(o?.kind==='mine'&&fieldLoads.has(o.node))fieldLoads.set(o.node,fieldLoads.get(o.node)+1);}
    function fieldFor(w){return localFields.reduce((best,n)=>{const score=p=>(fieldLoads.get(p)||0)*5*GRID+distance(w,p);return !best||score(n)<score(best)?n:best;},null);}
    function mine(w){const node=fieldFor(w);if(!node)return;issue(w,{kind:'mine',node,phase:'out'});fieldLoads.set(node,(fieldLoads.get(node)||0)+1);}
    for(const refinery of refineries){
      const assignedGas=workers.filter(w=>{const o=assigned(w);return o?.kind==='gas'&&o.target===refinery;});
      const candidates=workers.filter(w=>!w.order||assigned(w)?.kind==='mine').sort((a,b)=>distance(a,refinery)-distance(b,refinery)||a.id-b.id);
      for(const w of candidates.slice(0,Math.max(0,3-assignedGas.length))){const old=assigned(w);if(old?.node&&fieldLoads.has(old.node))fieldLoads.set(old.node,Math.max(0,fieldLoads.get(old.node)-1));issue(w,{kind:'gas',target:refinery,phase:'out'});}
    }
    for(const w of workers){
      const o=assigned(w),foreign=o?.kind==='mine'&&!localFields.includes(o.node),deadGas=o?.kind==='gas'&&!refineries.includes(o.target);
      if(!w.order||foreign||deadGas)mine(w);
    }
    // New workers rally to a local cluster, never a global nearest field.
    for(const b of bases){const node=localFields.filter(n=>distance(n,b)<14*GRID).sort((a,c)=>(fieldLoads.get(a)||0)-(fieldLoads.get(c)||0)||distance(a,b)-distance(c,b))[0];if(node)b.rally={kind:'mine',node,x:node.x,y:node.y};else b.rally=null;}
    const towards={x:world.w/2-base.x,y:world.h/2-base.y},len=Math.max(1,Math.hypot(towards.x,towards.y)),stage=clampPoint({x:base.x+towards.x/len*7*GRID,y:base.y+towards.y/len*7*GRID});
    const producers=own.filter(e=>['barracks','factory'].includes(e.type)&&e.ready&&!e.flying);
    for(const b of producers)b.rally={kind:'attackMove',...stage};
    const pendingSupply=own.filter(e=>e.type==='relay'&&!e.ready).reduce((sum,e)=>sum+(e.cap||8),0);
    const queuedSupply=own.reduce((sum,e)=>sum+(e.queue||[]).filter(q=>!q.started).reduce((n,q)=>n+(defs[q.type]?.supply||0),0),0);
    if(capacity(team)<200&&capacity(team)+pendingSupply-used(team)-queuedSupply<Math.max(4,producers.length*2+1))propose('relay',base,now);
    const targetWorkers=localFields.length*2+refineries.length*3;
    if(workers.length<targetWorkers&&!(base.queue||[]).length&&used(team)<capacity(team))train('worker',base);
    if(!own.some(e=>e.type==='barracks'))propose('barracks',base,now);
    if(now>70&&!own.some(e=>e.type==='refinery')){const g=localGas.find(g=>!own.some(e=>e.type==='refinery'&&e.geyser===g));if(g)propose('refinery',base,now,g);}
    if(now>120&&!own.some(e=>e.type==='factory'))propose('factory',base,now);
    const fact=producers.find(e=>e.type==='factory');
    if(fact&&!fact.addon&&!(fact.queue||[]).length)addon(fact,'techlab');
    for(const b of producers)if((b.queue||[]).length<1){if(b.type==='barracks')train('marine',b);else if(b.addon?.ready&&b.addon.type==='techlab')train('tank',b);}
    const liveIds=new Set(own.map(e=>e.id));for(const id of commands.keys())if(!liveIds.has(id))commands.delete(id);
    for(const id of gatherSlots.keys())if(!liveIds.has(id))gatherSlots.delete(id);
    if(!liveIds.has(scoutId))scoutId=null;
    const threats=seen.filter(e=>!e.building&&bases.some(b=>distance(e,b)<15*GRID)&&
      (e.type!=='worker'||own.some(u=>u.lastAttacker===e&&now-(u.lastDamageAt??-Infinity)<2)));
    if(threats.length){
      defendUntil=now+6;wave=null;scoutId=null;mode='defend';const target=threats.reduce((a,e)=>!a||distance(e,base)<distance(a,base)?e:a,null);
      defensePoint={x:target.x,y:target.y};commandGroup(army,defensePoint,'defend');return;
    }
    if(now<defendUntil){mode='defend';if(defensePoint)commandGroup(army,defensePoint,'defend');return;}
    const knownTarget=[...memories.values()].filter(m=>m.building).sort((a,b)=>(a.type==='core'?-1:0)-(b.type==='core'?-1:0)||distance(a,base)-distance(b,base))[0];
    if(knownTarget)scoutId=null;
    if(wave){
      const members=army.filter(e=>wave.ids.has(e.id));
      if(members.length<Math.ceil(wave.initial/2)||members.every(e=>distance(e,wave.target)<4*GRID&&!e.order)){wave=null;lastWave=now;}
      else {mode='attack';commandGroup(members,wave.target,'attack');}
    }
    const reserves=army.filter(e=>!wave?.ids.has(e.id));
    const staged=reserves.filter(e=>distance(e,commands.get(e.id)?.role==='gather'?commands.get(e.id).arrival:gatherPoint(e,stage))<3*GRID);
    if(!wave&&knownTarget&&reserves.length>=8&&now-lastWave>45&&staged.length>=Math.ceil(reserves.length*.75)){
      wave={ids:new Set(reserves.map(e=>e.id)),initial:reserves.length,target:{x:knownTarget.x,y:knownTarget.y}};lastWave=now;scoutId=null;mode='attack';
      commandGroup(reserves,wave.target,'attack');return;
    }
    if(!knownTarget&&!wave&&army.length>=3&&now>=nextScout){
      const existing=army.find(e=>e.id===scoutId),scout=existing||army.find(e=>e.type==='reaper')||army[0];
      const previous=commands.get(scout.id);
      if(existing&&!scout.order&&previous?.role==='scout'&&distance(scout,previous.arrival)<GRID*1.5)scoutStep++;
      else if(!existing)scoutStep=0;
      scoutId=scout.id;nextScout=now+20;
      // This two-spawn map's opposite start is map knowledge, not live entity knowledge.
      const circuit=[{x:world.w-base.x,y:world.h-base.y},...[ [.25,.25],[.75,.75],[.25,.75],[.75,.25] ].map(([x,y])=>({x:x*world.w,y:y*world.h})).filter(p=>distance(p,base)>14*GRID)];
      command(scout,clampPoint(circuit[scoutStep%circuit.length]),'scout');
    }
    if(!wave)mode='gather';
    for(const e of reserves)if(e.id!==scoutId)command(e,gatherPoint(e,stage),'gather');
  }
  return{update,reset,state:()=>({mode,knownEnemies:[...memories.values()].map(m=>({...m})),waveSize:wave?.ids.size||0,scoutId})};
}
