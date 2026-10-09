"""Real shared dispatcher: enemy formations and loaded worker recovery."""
import json, shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':800,'height':600}); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/?debug'); page.wait_for_function('window.__game')
 results=page.evaluate('''()=>{
 const g=__game,dt=1/22.4,out=[],check=(name,pass,detail)=>out.push({name,pass:!!pass,detail});
 const tick=n=>{for(let i=0;i<n;i++)g.update(dt)};
 const reset=()=>{g.reset();g.start();g.running=false;g.aiEnabled=false;g.entities.splice(0);g.minerals.splice(0);g.selected=[];g.money=0;g.gas=0;};
 reset();g.spawn('core',0,400,1100);const base=g.spawn('core',1,1200,1100);
 const army=Array.from({length:12},(_,i)=>g.spawn('marine',1,1100+i%4*28,800+Math.floor(i/4)*28));
 const threat=g.spawn('marine',0,1400,1000);g.stop(threat,true);threat.weapon={...threat.weapon,damage:0};threat.hp=threat.maxhp=10000;
 g.invalidateNav();g.update(0);g.opponent.update();
 check('Enemy defense uses one shared batch and unique reserved destinations',Number.isInteger(army[0].order?.batch)&&army.every(u=>u.order?.kind==='attackMove'&&u.order.batch===army[0].order.batch&&u.order.arrival)&&new Set(army.map(u=>u.order.arrival.x+','+u.order.arrival.y)).size===army.length);
 check('Enemy tactical orders preserve the visible threat as shared goal',army.every(u=>(u.order.groupGoal||u.order).x===threat.x&&(u.order.groupGoal||u.order).y===threat.y));
 tick(50);const accepted=army.map(u=>u.order?.acceptedLoop);g.opponent.update();
 check('Unchanged defense policy keeps accepted orders and acquisition intact',army.every((u,i)=>u.order?.acceptedLoop===accepted[i])&&army.some(u=>u.combatTarget===threat||u.windup?.target===threat||u.visualShotSerial>0));
 reset();g.spawn('core',0,700,1100);g.spawn('core',1,1900,400);const refinery=g.spawn('refinery',0,1000,1100);refinery.geyser={amount:2250};
 const w=g.spawn('worker',0,900,1100);w.carry=4;w.carryGas=true;g.issue(w,{kind:'gas',target:refinery});refinery.hp=0;g.invalidateNav();const x=w.x;tick(1);
 check('Refinery loss during a loaded gas return preserves the trip and cargo',w.order?.kind==='gas'&&w.order.phase==='home'&&w.carry===4&&w.x<x);
 tick(100);check('Loaded gas still reaches the surviving Command Center',g.gas===4&&w.carry===0&&w.deliveredTrips===1);
 reset();const old=g.spawn('core',0,1200,1100),fallback=g.spawn('core',0,600,1100);g.spawn('core',1,1900,400);
 const r=g.spawn('worker',0,900,1100);r.carry=5;g.issue(r,{kind:'return',target:old});old.hp=0;g.invalidateNav();const rx=r.x;tick(1);
 check('Return Cargo replaces a destroyed clicked drop-off with a surviving one',r.order?.kind==='return'&&r.carry===5&&r.x<rx);
 tick(150);check('Recovered Return Cargo deposits exactly once',g.money===5&&r.carry===0&&r.deliveredTrips===1&&!r.order);
 for(const team of [0,1])for(const attackerFirst of [false,true]){
  reset();g.spawn('core',0,400,1100);g.spawn('core',1,1900,400);
  let attacker;if(attackerFirst)attacker=g.spawn('marine',1-team,1024,1100);
  const helper=g.spawn('marine',team,800,1100),victim=g.spawn('worker',team,912,1100);g.stop(victim,true);
  if(!attacker)attacker=g.spawn('marine',1-team,1024,1100);
  g.stop(attacker,true);attacker.angle=attacker.pangle=Math.PI;victim.hp=victim.maxhp=10000;g.invalidateNav();
  const hx=helper.x;tick(1);check('Team '+team+' helper stays idle before damage ('+(attackerFirst?'attacker first':'helper first')+')',helper.x===hx&&!helper.combatTarget);
  tick(1);check('Team '+team+' idle helper responds on the damage loop regardless of iteration order',victim.hp<10000&&helper.combatTarget===attacker&&helper.x>hx,{loop:g.simulationLoop,x:helper.x,hp:victim.hp});
  const once=helper.x;g.combat.flushHelp(dt);check('Same-loop help flush cannot advance the helper twice',helper.x===once);
 }
 for(const command of ['hold','move']){
  reset();g.spawn('core',0,400,1100);g.spawn('core',1,1900,400);
  const helper=g.spawn('marine',0,800,1100),victim=g.spawn('worker',0,912,1100),attacker=g.spawn('marine',1,1024,1100);
  g.stop(victim,true);g.stop(attacker,true);victim.hp=victim.maxhp=10000;
  if(command==='hold')g.stop(helper,true);else g.issue(helper,{kind:'move',x:700,y:1100});g.invalidateNav();tick(3);
  check(command+' continues to override nearby ally assistance',!helper.combatTarget&&!helper.windup&&(command==='hold'?helper.x===800:helper.order?.kind==='move'&&helper.x<800));
 }
 reset();g.spawn('core',0,400,1100);g.spawn('core',1,1900,400);
 const idle=g.spawn('worker',0,1200,1100),shooter=g.spawn('marine',1,1340,1100);g.stop(shooter,true);idle.hp=idle.maxhp=10000;g.invalidateNav();tick(2);
 check('Idle SCV records damage origin before deciding to flee',idle.hp<10000&&idle.lastDamageSourcePosition.x===1340);
 shooter.x=500;shooter.y=500;g.update(0);tick(1);
 check('SCV flee uses the recorded origin when the attacker disappears into fog',idle.order?.kind==='flee'&&idle.order.x<1200&&idle.order.y===1100);
 const extractionFixture=()=>{
  reset();g.spawn('core',0,630,1100);g.spawn('core',1,1900,400);
  const node={x:920,y:1100,r:21,placeWidth:2,placeHeight:1,footprint:[[-28,-14],[-28,14],[28,14],[28,-14]],amount:1800,capacity:1800};g.minerals.push(node);
  const w=g.spawn('worker',0,820,1100);g.invalidateNav();g.issue(w,{kind:'mine',node});let limit=100;while(w.order?.phase!=='harvest'&&limit--)tick(1);if(w.order?.phase!=='harvest')throw Error('Extraction fixture never arrived');return{w,node};
 };
 for(const smart of [false,true]){
  const {w,node}=extractionFixture();tick(22);const progress=w.mineTime;g.selected=[w];g.running=true;g.command(node.x,node.y,false,false,smart?null:'gather',{node});g.running=false;
  check((smart?'Smart':'Gather')+' source survives the real command dispatcher',w.order.gatherCommand===(smart?'smart':'gather'));
  check((smart?'Smart restarts':'Gather preserves')+' same-field extraction',smart?w.mineTime===0&&w.order.phase==='out':w.mineTime===progress&&w.order.phase==='harvest'&&node.harvester===w);
  tick(23);check((smart?'Restarted Smart has not earned':'Repeated Gather earns')+' cargo at the original extraction boundary',smart?w.carry===0:w.carry===5&&w.order.phase==='waitReturn');
 }
 let {w:orphan,node}=extractionFixture();const home=g.entities.find(e=>e.type==='core'&&e.team===0);g.spawn('relay',0,500,1300);home.hp=0;tick(45);
 check('Removing the only drop-off does not cancel extraction or earned cargo',orphan.carry===5&&orphan.order?.phase==='waitReturn'&&node.amount===1795);
 tick(8);const waiting={x:orphan.x,y:orphan.y};tick(20);
 check('A loaded orphan waits with its Gather intent instead of discarding cargo',orphan.carry===5&&orphan.order?.kind==='mine'&&orphan.order.phase==='home'&&orphan.x===waiting.x&&orphan.y===waiting.y);
 g.spawn('core',0,630,1100);g.invalidateNav();tick(1);
 check('A new grounded drop-off resumes the pending cargo trip',orphan.carry===5&&orphan.x<waiting.x);
 tick(150);check('Recovered orphan deposits and resumes its mineral cycle',orphan.deliveredTrips>=1&&g.money>=5&&orphan.order?.kind==='mine');
 return out;}''')
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r.get('detail')),flush=True)
 assert all(r['pass'] for r in results),results
 assert not errors,errors
 print(str(len(results))+' autonomous controller integration checks passed; no browser exceptions.')
 b.close()
