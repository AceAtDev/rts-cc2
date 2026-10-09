"""Pursuit, worker acquisition and attack-point interruption scenarios."""
import json,shutil
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game');page.click('#launch');page.evaluate('__game.running=false')
 results=page.evaluate('''async()=>{
 const g=__game,{mineralWalking}=await import('./workers.js'),out=[],check=(name,ok,detail)=>out.push({name,pass:!!ok,detail}),tick=n=>{for(let i=0;i<n;i++)g.update(1/60)};
 const setup=()=>{g.reset();g.start();g.running=false;g.aiEnabled=false;for(let i=g.entities.length-1;i>=0;i--)if(!g.entities[i].building)g.entities.splice(i,1);g.invalidateNav();};
 const dummy=(type,x,y,hp=1000)=>{const e=g.spawn(type,1,x,y);e.hp=e.maxhp=hp;e.damage=0;g.stop(e,true);return e;};
 setup();let w=g.spawn('worker',0,700,1040),target=dummy('marine',800,1040);tick(180);check('Idle SCV does not aggressively chase a nearby enemy',w.x===700&&w.y===1040&&target.hp===1000,{at:[w.x,w.y],hp:target.hp});
 g.issue(w,{kind:'attack',target});tick(180);check('Explicit SCV attack closes to melee and deals damage',target.hp<1000&&w.x>740,{at:[w.x,w.y],hp:target.hp});
 setup();w=g.spawn('worker',0,700,1040);target=dummy('marine',810,1040);g.issue(w,{kind:'attackMove',x:1000,y:1040});tick(30);const first=w.combatTarget;let stable=true;for(let i=0;i<30;i++){g.update(1/60);stable&&=w.combatTarget===first;}check('SCV attack-move retains acquired target while closing',first===target&&stable);tick(120);check('SCV attack-move can engage outside its melee range',target.hp<1000);
 setup();let m=g.spawn('marine',0,700,1040);target=dummy('marine',850,1040);g.issue(m,{kind:'attack',target});tick(1);target.x=872;tick(2);check('Started Marine shot tolerates catalog range slop',target.hp===994,{hp:target.hp});
 setup();m=g.spawn('marine',0,700,1040);target=dummy('marine',850,1040);g.issue(m,{kind:'attack',target});tick(1);target.x=920;tick(2);check('Moving beyond attack range slop cancels pending hit',target.hp===1000);
 setup();w=g.spawn('worker',0,700,1040);target=dummy('marine',810,1040);target.speed=65;target.hold=false;g.issue(target,{kind:'move',x:1050,y:1040});g.issue(w,{kind:'attack',target});tick(360);check('SCV pursuit catches a slower fleeing target',target.hp<1000,{worker:[w.x,w.y],target:[target.x,target.y],hp:target.hp});
 setup();w=g.spawn('worker',0,700,1040);target=g.spawn('marine',1,800,1040);g.stop(target,true);tick(20);check('Idle SCV responds to incoming fire by fleeing',w.order?.kind==='flee'&&w.x<700,{x:w.x,order:w.order?.kind});g.issue(w,{kind:'attack',target});tick(1);check('Explicit order interrupts automatic worker flee',w.order?.kind==='attack');
 setup();w=g.spawn('worker',0,700,1040);g.issue(w,{kind:'mine',node:g.minerals[3]});target=dummy('marine',820,1040);g.issue(w,{kind:'attack',target});check('Attacking SCV exits mineral-walk collision mode',!mineralWalking(w));tick(240);check('Former harvester executes attack rather than returning to mining',w.order?.kind==='attack'&&target.hp<1000);
 setup();const pack=[];for(let i=0;i<12;i++)pack.push(g.spawn('worker',0,690+i%4*25,980+Math.floor(i/4)*25));target=dummy('marine',870,1040,10000);for(const u of pack)g.issue(u,{kind:'attack',target});const contributors=new Set();for(let i=0;i<600;i++){g.update(1/60);for(const u of pack)if(u.cooldown>0)contributors.add(u.id);}let min=Infinity;for(let i=0;i<pack.length;i++)for(let j=i+1;j<pack.length;j++)min=Math.min(min,Math.hypot(pack[i].x-pack[j].x,pack[i].y-pack[j].y));check('SCV attack group reaches a target from multiple contact positions',contributors.size>=5,{contributors:contributors.size,hp:target.hp});check('Attacking workers keep ordinary collision spacing',min>18,{min});
 setup();m=g.spawn('marine',0,700,1040);target=dummy('relay',880,1040);g.issue(m,{kind:'attack',target});tick(60);check('Attacks use building contour rather than selection circle',target.hp<1000&&m.x<780,{x:m.x,hp:target.hp});
 setup();m=g.spawn('marine',0,700,1040);const ally=g.spawn('marine',0,800,1040);g.stop(ally,true);g.selected=[m];g.running=true;g.command(ally.x,ally.y,false,false,'attack');g.running=false;tick(4);check('Explicit A-target can attack a friendly unit',ally.hp===39&&m.order?.target===ally,{hp:ally.hp});
 return out;
 }''')
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r.get('detail','')))
 assert not errors,errors
 assert all(r['pass'] for r in results),[r for r in results if not r['pass']]
 print(f'{len(results)} attack control checks passed.');b.close()
