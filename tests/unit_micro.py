"""Behavior regressions for controls and unit mechanics, not screenshot similarity."""
from pathlib import Path
import json, shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
 browser_path=shutil.which('chromium') or shutil.which('chromium-browser')
 b=p.chromium.launch(**({'executable_path':browser_path} if browser_path else {}),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game');page.click('#launch');page.evaluate('__game.running=false')
 results=page.evaluate('''() => {
 const g=__game,out=[],dt=1/60;
 const check=(name,ok,detail)=>out.push({name,pass:!!ok,detail});
 const tick=n=>{for(let i=0;i<n;i++)g.update(dt)};const nativeTick=n=>{for(let i=0;i<n;i++)g.update(1/22.4)};const command=(x,y)=>{g.running=true;g.command(x,y,false,false,'move');g.running=false;};
 const setup=()=>{g.reset();g.start();g.running=false;g.aiEnabled=false;for(let i=g.entities.length-1;i>=0;i--)if(!g.entities[i].building)g.entities.splice(i,1);};
 const dummy=(type,x,y,hp=1000)=>{const t=g.spawn(type,1,x,y);t.hp=t.maxhp=hp;t.damage=0;g.stop(t,true);return t;};
 setup();let m=g.spawn('marine',0,700,1040),w=g.spawn('worker',0,700,1140);
 g.issue(m,{kind:'move',x:1000,y:1040});g.issue(w,{kind:'move',x:1000,y:1140});tick(1);
 check('Infantry reach catalog speed on first tick',Math.abs(m.vx-88.2)<1e-6,{vx:m.vx});
 check('SCV accelerates gradually',w.vx>0&&w.vx<5,{vx:w.vx});
 tick(59);check('Marine covers Faster-speed distance in one second',Math.abs(m.x-788.2)<.01,{x:m.x});
 const x=m.x;g.issue(m,{kind:'move',x:600,y:1040});tick(1);check('Reversal responds on next tick',m.x<x&&m.vx<0,{vx:m.vx});
 setup();m=g.spawn('marine',0,700,1040);let t=dummy('marine',800,1040);
 g.issue(m,{kind:'attack',target:t});nativeTick(1);check('Marine does not fire before damage point',t.hp===1000&&!!m.windup);
 g.issue(m,{kind:'move',x:600,y:1040});nativeTick(12);check('Move cancels pending Marine shot',t.hp===1000);
 setup();m=g.spawn('marine',0,700,1040);t=dummy('marine',800,1040);g.issue(m,{kind:'attack',target:t});nativeTick(1);g.issue(m,{kind:'attack',target:t});nativeTick(1);
 check('Reissuing same target preserves windup',t.hp===994,{hp:t.hp});
 const cd=m.cooldown;g.issue(m,{kind:'move',x:680,y:1040});nativeTick(1);check('Moving after firing preserves cooldown',Math.abs(m.cooldown-(cd-1/22.4))<1e-8&&m.cooldown>0,{cd:m.cooldown});
 g.issue(m,{kind:'attack',target:t});nativeTick(5);check('Stutter commands cannot manufacture extra shots',t.hp===994,{hp:t.hp});nativeTick(10);check('Weapon resumes after its period',t.hp===988,{hp:t.hp});
 setup();m=g.spawn('marine',0,700,1040);t=dummy('marine',810,1040);tick(4);let nearer=dummy('marine',780,1080);tick(8);
 check('Closer equal-priority unit does not steal target',m.combatTarget===t);
 g.issue(m,{kind:'attack',target:nearer});tick(1);check('Explicit target overrides automatic target',m.combatTarget===nearer);
 setup();m=g.spawn('marine',0,700,1040);t=dummy('marine',860,1040);g.stop(m,true);tick(8);check('Weapon range includes both footprints',t.hp===994&&m.x===700,{hp:t.hp,x:m.x});
 setup();m=g.spawn('marine',0,700,1040);t=dummy('marine',870,1040);g.stop(m,true);tick(8);check('Hold does not pursue beyond range',m.x===700&&t.hp===1000);g.stop(m);tick(12);check('Stop can acquire just outside firing range',m.x>700&&t.hp<1000,{x:m.x,hp:t.hp});
 setup();m=g.spawn('marine',0,700,1040);t=dummy('marine',800,1040);g.issue(m,{kind:'move',x:1000,y:1040});tick(30);check('Move never automatically fires while passing enemies',t.hp===1000);
 setup();m=g.spawn('marauder',0,700,1040);t=dummy('hellion',800,1040,90);t.armor=5;g.issue(m,{kind:'attack',target:t});tick(1);check('Marauder grenade has flight time',t.hp===90);tick(10);check('Armored bonus uses attribute, not armor number',t.hp===85,{hp:t.hp});
 setup();m=g.spawn('reaper',0,700,1040);t=dummy('marauder',800,1040,125);g.issue(m,{kind:'attack',target:t});tick(1);check('Reaper first pistol hit applies armor independently',t.hp===122,{hp:t.hp});tick(6);check('Reaper second pistol hit is a separate delayed hit',t.hp===119,{hp:t.hp});
 g.issue(m,{kind:'move',x:600,y:1040});m.hp=20;m.lastDamageAt=g.time;tick(360);check('Reaper regen waits after taking damage',m.hp===20);tick(90);check('Reaper regenerates after catalog delay',m.hp>20&&m.hp<23,{hp:m.hp});
 setup();m=g.spawn('hellion',0,700,1040);t=dummy('marine',800,1040,45);let behind=dummy('marine',850,1040,45),off=dummy('marine',850,1085,45);g.issue(m,{kind:'attack',target:t});tick(14);
 check('Hellion flame damages multiple units along its line',t.hp===31&&behind.hp===31&&off.hp===45,{hp:[t.hp,behind.hp,off.hp]});
 setup();m=g.spawn('tank',0,700,1040);m.sieged=true;m.hold=true;m.damage=40;t=dummy('marine',900,1040,45);let friend=g.spawn('marine',0,910,1040);friend.damage=0;g.stop(friend,true);g.issue(m,{kind:'attack',target:t});tick(12);
 check('Siege splash includes friendly ground units',t.hp===5&&friend.hp===5,{hp:[t.hp,friend.hp]});
 setup();m=g.spawn('tank',0,700,1040);m.sieged=true;m.hold=true;m.damage=40;t=dummy('marine',740,1040);tick(60);check('Siege minimum range prevents close shots',t.hp===1000);
 setup();const held=g.spawn('marine',0,800,1040);g.stop(held,true);m=g.spawn('marine',0,700,1040);g.issue(m,{kind:'move',x:950,y:1040});tick(240);check('Hold unit remains anchored as traffic passes',held.x===800&&held.y===1040&&!m.order,{at:[m.x,m.y]});
 setup();const idle=g.spawn('marine',0,800,1040);m=g.spawn('marine',0,700,1040);g.issue(m,{kind:'move',x:950,y:1040});tick(240);check('Idle ally yields instead of jamming a move',!m.order&&Math.hypot(idle.x-800,idle.y-1040)>1,{at:[m.x,m.y,idle.x,idle.y]});
 setup();m=g.spawn('marine',0,700,1040);t=dummy('marine',800,1040);g.issue(m,{kind:'attackMove',x:1000,y:1040});tick(3);t.hp=0;tick(180);check('Attack-move resumes original destination after combat',m.x>900,{x:m.x});
 setup();m=g.spawn('marine',0,700,1040);t=dummy('marine',800,1040);g.issue(m,{kind:'attack',target:t});tick(3);t.x=1400;tick(1);check('Losing vision pursues last observed point',m.order?.kind==='attackMove'&&m.order.x===800,{order:m.order?.kind,x:m.order?.x});
 setup();m=g.spawn('tank',0,700,1040);m.sieged=true;m.hold=true;m.damage=40;t=dummy('marine',1070,1040);tick(60);check('Siege needs a spotter beyond its own vision',t.hp===1000,{hp:t.hp});const spotter=g.spawn('marine',0,850,1120);spotter.damage=0;g.stop(spotter,true);tick(12);check('Allied vision enables siege fire',t.hp===960,{hp:t.hp});
 setup();m=g.spawn('marine',0,700,1040);let fast=g.spawn('hellion',0,700,1140);g.selected=[m,fast];command(1050,1040);tick(60);check('Mixed group retains faster Hellion speed',fast.x>m.x+40,{x:[m.x,fast.x]});
 setup();m=g.spawn('marine',0,700,1040);g.issue(m,{kind:'move',x:870,y:690});tick(600);check('Click inside rock projects to reachable ground',!m.order&&Math.hypot(m.x-870,m.y-690)>=98+SC2.defs.marine.r-.1,{at:[m.x,m.y]});
 const replay=()=>{setup();const pack=[];for(let i=0;i<24;i++)pack.push(g.spawn('marine',0,670+i%6*24,570+Math.floor(i/6)*24));g.selected=pack;command(1140,700);tick(180);command(680,1000);tick(300);return pack.map(u=>[u.x,u.y,u.vx,u.vy,u.order?.kind]);};
 const a=replay(),b=replay();check('Replay actually executes route commands',a.some(u=>u[1]>850));check('Repeated simulation is independent of wall-clock timing',JSON.stringify(a)===JSON.stringify(b));
 for(const key of ['movement','micro','hellion','tank','reaper','marauder']){g.startDrill(key);g.running=false;check('Playable '+key+' drill starts',g.selected.length>0&&!document.querySelector('#drillInfo').hidden&&!g.aiEnabled);}
 return out;
}''')
 for r in results: print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r.get('detail','')))
 assert not errors,errors
 assert all(r['pass'] for r in results),[r for r in results if not r['pass']]
 print(f'{len(results)} micro and unit-mechanics checks passed; no browser exceptions.')
 b.close()
