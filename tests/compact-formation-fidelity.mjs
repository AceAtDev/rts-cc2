// Native SC2 4.10 order-point observations and custom fallback regressions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reserveDestinations,createMovement,COMPACT_FORMATION_EXTENT} from '../dist/movement.js';
import {PROFILES,SCALE} from '../dist/unit-profiles.js';

const goal={x:1200,y:1000},open=p=>({...p});
const mover=(x,y,type='marine',kind='move')=>({u:{...PROFILES[type],id:1,type,
  hp:45,team:0,x,y,vx:0,vy:0,angle:0},o:{kind,batch:1,...goal}});
const grid=(columns,rows,spacing,kind='move')=>Array.from({length:columns*rows},(_,i)=>{
  const m=mover(300+i%columns*spacing*SCALE,600+Math.floor(i/columns)*spacing*SCALE,'marine',kind);
  m.u.id=i+1;return m;
});
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};

check('Compact Move and AttackMove preserve each offset as an immediate per-unit goal',()=>{
  for(const kind of ['move','attackMove']){
    const movers=grid(6,4,1,kind),center={x:370,y:642};reserveDestinations(movers,goal,open);
    for(const m of movers){
      assert.equal(m.o.formation,'preserved');
      assert.equal(m.o.x,goal.x+m.u.x-center.x);assert.equal(m.o.y,goal.y+m.u.y-center.y);
      assert.deepEqual(m.o.arrival,{x:m.o.x,y:m.o.y});assert.deepEqual(m.o.groupGoal,goal);
    }
  }
});
check('Six-game-unit extent includes mobile radii and its boundary is inclusive',()=>{
  assert.equal(COMPACT_FORMATION_EXTENT,6*SCALE);
  for(const [type,preserved,collapsed] of [['marine',5.25,5.26],['marauder',4.875,5.25],['tank',4.25,5.25]]){
    for(const [distance,expected] of [[preserved,'preserved'],[collapsed,'packed']]){
      const movers=[mover(300,600,type),mover(300+distance*SCALE,600,type)];
      reserveDestinations(movers,goal,open);assert.equal(movers[0].o.formation,expected);
    }
  }
});
check('Formation extent uses both axes rather than a Euclidean radius',()=>{
  const movers=[mover(300,600),mover(300+4*SCALE,600+4*SCALE)];
  assert(Math.hypot(4,4)>5.25);reserveDestinations(movers,goal,open);
  assert.equal(movers[0].o.formation,'preserved');
  assert.equal(movers[0].o.x,goal.x-2*SCALE);assert.equal(movers[0].o.y,goal.y-2*SCALE);
});
check('Skewed formations translate about mean unit centers rather than bounding-box midpoint',()=>{
  const movers=[0,1,4].map(x=>mover(300+x*SCALE,600));reserveDestinations(movers,goal,open);
  for(let i=0;i<movers.length;i++)assert(Math.abs(movers[i].o.x-(goal.x+([0,1,4][i]-5/3)*SCALE))<1e-10);
  assert(Math.abs(movers[0].o.x-(goal.x-2*SCALE))>1);
});
check('Dense compact layouts preserve offsets without an arbitrary unit-count cutoff',()=>{
  for(const movers of [grid(6,4,.8),grid(5,5,.8)]){
    reserveDestinations(movers,goal,open);assert(movers.every(m=>m.o.formation==='preserved'));
  }
});
check('Wide and spread layouts retain the existing packed-arrival fallback',()=>{
  for(const movers of [grid(8,6,1),grid(6,4,1.2),[mover(300,600),mover(900,600)]]){
    reserveDestinations(movers,goal,open);
    for(const m of movers){assert.equal(m.o.formation,'packed');assert.equal(m.o.x,goal.x);assert.equal(m.o.y,goal.y);}
    const slots=new Set(movers.map(m=>`${m.o.arrival.x},${m.o.arrival.y}`));assert.equal(slots.size,movers.length);
  }
});
check('Obstructed translated slots safely fall back instead of distorting preserved offsets',()=>{
  const movers=[mover(300,600),mover(328,600)];
  reserveDestinations(movers,goal,p=>p.x<goal.x?{x:p.x-20,y:p.y}:p);
  assert(movers.every(m=>m.o.formation==='packed'));assert(movers.every(m=>m.o.x===goal.x));
});
check('Overlapping footprints fall back rather than making impossible per-unit goals',()=>{
  const movers=[mover(300,600),mover(301,600)];reserveDestinations(movers,goal,open);
  assert(movers.every(m=>m.o.formation==='packed'));
  assert(Math.hypot(movers[0].o.arrival.x-movers[1].o.arrival.x,
    movers[0].o.arrival.y-movers[1].o.arrival.y)>21);
});
check('Offset goals preserve the shape from the first movement update',()=>{
  const movers=grid(6,4,1);reserveDestinations(movers,goal,open);
  const units=movers.map(m=>{m.u.order=m.o;return m.u;});
  const movement=createMovement({entities:()=>units,world:{w:3000,h:3000},clear:()=>true,
    openPoint:()=>true,path:()=>[],navVersion:()=>0});
  const before=units.map(e=>({x:e.x,y:e.y}));
  for(let i=0;i<10;i++){movement.begin();for(const e of units)movement.move(e,e.order,1/22.4,0);}
  const translation={x:units[0].x-before[0].x,y:units[0].y-before[0].y};
  units.forEach((e,i)=>{assert(Math.abs(e.x-before[i].x-translation.x)<1e-9);
    assert(Math.abs(e.y-before[i].y-translation.y)<1e-9);});
});
check('Loose compact packs finish at exact observed centers while contact packs retain tolerance',()=>{
  const movers=grid(6,4,1),destination={x:748,y:656};
  reserveDestinations(movers,destination,open);assert(movers.every(m=>m.o.exactFormation));
  const units=movers.map(m=>{m.u.order=m.o;return m.u;});
  const movement=createMovement({entities:()=>units,world:{w:3000,h:3000},clear:()=>true,
    openPoint:()=>true,path:()=>[],navVersion:()=>0});
  let completed=null;
  for(let loop=1;loop<=120;loop++){
    movement.begin();for(const e of units)if(e.order&&movement.move(e,e.order,1/22.4,0)){
      e.order=null;e.vx=e.vy=0;
    }
    if(units.every(e=>!e.order)){completed=loop;break;}
  }
  assert.equal(completed,98);
  movers.forEach(m=>{assert.equal(m.u.x,m.o.x);assert.equal(m.u.y,m.o.y);});
  const dense=grid(6,4,.8);reserveDestinations(dense,destination,open);
  assert(dense.every(m=>m.o.formation==='preserved'&&!m.o.exactFormation));
});

const argument=process.argv.indexOf('--trace-dir');
if(argument>=0){
  const directory=process.argv[argument+1];assert(directory,'--trace-dir requires a directory');
  check('Native formation probes agree on every initial per-unit order point',()=>{
    const nativeTypes={Marine:'marine',Marauder:'marauder',SiegeTank:'tank'};
    let compared=0,maxError=0;
    for(const filename of fs.readdirSync(directory).filter(name=>name.endsWith('.jsonl'))){
      const rows=fs.readFileSync(path.join(directory,filename),'utf8').trim().split('\n').map(line=>JSON.parse(line));
      const metadata=rows.find(row=>row.kind==='metadata');assert.equal(metadata.game_version,'4.10.0.75689');
      const frames=rows.filter(row=>row.kind==='frame'),command=rows.find(row=>row.kind==='command');
      assert([16,23].includes(command.ability));
      const initial=frames.find(row=>row.loop===0),first=frames.find(row=>row.loop===1);
      const click={x:command.point[0]*SCALE,y:command.point[1]*SCALE};
      const labels=command.units;
      const movers=labels.map((label,i)=>{
        const observed=initial.units[label],m=mover(observed.x*SCALE,observed.y*SCALE,nativeTypes[observed.type],
          command.ability===23?'attackMove':'move');
        m.u.id=i+1;m.u.r=observed.radius*SCALE;m.o.x=click.x;m.o.y=click.y;return m;
      });
      reserveDestinations(movers,click,open);
      movers.forEach((m,i)=>{
        const observed=first.units[labels[i]].orders[0].target_world_space_pos;
        const error=Math.max(Math.abs(m.o.x/SCALE-observed.x),Math.abs(m.o.y/SCALE-observed.y));
        maxError=Math.max(maxError,error);assert(error<=1/4096+1e-6,`${filename}: order point error ${error}`);
      });
      compared++;
    }
    assert(compared>=20);console.log(JSON.stringify({nativeFixtures:compared,maxOrderPointErrorGU:maxError}));
  });
}
const crowdArgument=process.argv.indexOf('--crowd-trace');
if(crowdArgument>=0){
  const filename=process.argv[crowdArgument+1];assert(filename,'--crowd-trace requires a file');
  check('Native loose 24-unit formation agrees on final centers and loop98 completion',()=>{
    const rows=fs.readFileSync(filename,'utf8').trim().split('\n').map(line=>JSON.parse(line));
    const metadata=rows.find(row=>row.kind==='metadata');assert.equal(metadata.game_version,'4.10.0.75689');
    const frames=rows.filter(row=>row.kind==='frame'),initial=frames[0],command=rows.find(row=>row.kind==='command');
    const labels=command.units;assert.equal(labels.length,24);
    const click={x:command.point[0]*SCALE,y:command.point[1]*SCALE};
    const movers=labels.map((label,i)=>{const observed=initial.units[label],m=mover(observed.x*SCALE,observed.y*SCALE);
      m.u.id=i+1;m.o.x=click.x;m.o.y=click.y;return m;});
    reserveDestinations(movers,click,open);assert(movers.every(m=>m.o.exactFormation));
    const units=movers.map(m=>{m.u.order=m.o;return m.u;});
    const movement=createMovement({entities:()=>units,world:{w:3000,h:3000},clear:()=>true,
      openPoint:()=>true,path:()=>[],navVersion:()=>0});
    let completed=null,maxPositionError=0;
    for(let loop=1;loop<=120;loop++){
      movement.begin();for(const e of units)if(e.order&&movement.move(e,e.order,1/22.4,0)){
        e.order=null;e.vx=e.vy=0;
      }
      const observed=frames.find(frame=>frame.loop===loop);
      if(observed)units.forEach((e,i)=>{const actual=observed.units[labels[i]];
        maxPositionError=Math.max(maxPositionError,Math.abs(e.x/SCALE-actual.x),Math.abs(e.y/SCALE-actual.y));
        assert.equal(!e.order,!actual.orders.length);
      });
      if(completed===null&&units.every(e=>!e.order))completed=loop;
    }
    assert.equal(completed,98);const settled=frames.find(frame=>frame.loop===98);
    units.forEach((e,i)=>{assert.equal(e.x/SCALE,settled.units[labels[i]].x);assert.equal(e.y/SCALE,settled.units[labels[i]].y);});
    // Native diagonal velocity is quantized; this comparison claims exact
    // destinations/order timing and explicitly bounds the transit discrepancy.
    assert(maxPositionError<.02);console.log(JSON.stringify({nativeCrowdCompletion:completed,maxPositionErrorGU:maxPositionError}));
  });
}
console.log(`${checks} compact formation fidelity checks passed.`);
