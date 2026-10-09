# Run with the static server on 127.0.0.1:8000 and Python Playwright installed.
from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil

ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
BROWSER = shutil.which("chromium") or shutil.which("chromium-browser")
BROWSER_OPTIONS = {"executable_path": BROWSER} if BROWSER else {}
import json
with sync_playwright() as p:
 b=p.chromium.launch(**BROWSER_OPTIONS,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':900});errors=[];failreq=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failreq.append(r.url) if r.status>=400 else None)
 page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game');page.click('#launch');page.evaluate('__game.running=false')
 results=page.evaluate('''() => {
 const g=__game,out=[];const check=(name,v,detail='')=>out.push({name,pass:!!v,detail});const advance=s=>{for(let i=0;i<Math.round(s*60);i++)g.update(1/60)};
 const isolate=()=>{g.reset();g.start();g.running=false;for(let i=g.entities.length-1;i>=0;i--)if(g.entities[i].team)g.entities.splice(i,1);};
 check('12 workers, 50 minerals, 15 supply',g.money===50&&g.used()===12&&g.capacity()===15);
 advance(22);check('Workers mine and return resources',g.money>50,{money:g.money,workers:g.entities.filter(e=>e.type==='worker').map(e=>[e.x,e.y,e.carry])});
 isolate();g.running=true;g.money=1000;g.gas=1000;const w=g.entities.find(e=>e.type==='worker');g.selected=[w];
 check('SCV fixed command slots',SC2.card(w)[3]==='patrol'&&SC2.card(w)[4]==='attack'&&SC2.card(w)[10]==='basic'&&SC2.card(w)[11]==='advanced');
 g.action('basic');check('Depot uses B then S at cell 3',SC2.card(w,g.buildMenu)[2]==='relay'&&SC2.actions.relay.key==='S');g.action('cancel');
 check('Barracks requires Depot',!!g.availability(SC2.actions.barracks,w));g.spawn('relay',0,560,1210);check('Factory requires Barracks',!!g.availability(SC2.actions.factory,w));g.spawn('barracks',0,630,1110);g.action('advanced');check('Factory advanced slot/key',SC2.card(w,g.buildMenu)[5]==='factory'&&SC2.actions.factory.key==='F');
 const f=g.spawn('factory',0,900,1200);g.selected=[f];check('Tank hotkey S, fourth top cell',SC2.card(f)[3]==='tank'&&SC2.actions.tank.key==='S');check('Tank requires attached Tech Lab',!g.train('tank'));g.action('techlab');advance(19);check('Attached Tech Lab finishes',f.addon?.ready);check('Tank queues with Tech Lab',g.train('tank'));advance(33);const tank=g.entities.find(e=>e.type==='tank'&&!e.team);check('Tank trained',!!tank);g.selected=[tank];g.action('siege');check('Siege fixed slots',tank.sieged&&SC2.card(tank)[11]==='unsiege'&&!SC2.card(tank)[0]);g.action('unsiege');check('Unsiege restores movement',!tank.sieged);
 const marine=g.spawn('marine',0,750,1050);g.selected=[marine];check('Stim locked before research',!g.action('stim')&&marine.hp===45);const lab=g.spawn('techlab',0,680,1170);lab.parent=g.entities.find(e=>e.type==='barracks');g.selected=[lab];g.action('stimResearch');advance(101);g.selected=[marine];g.action('stim');check('Researched Stim costs 10 life',marine.hp===35&&marine.stim>0);
 // Isolate movement from gathering and AI. Hold other units so the test measures stable obstacles.
 isolate();for(const u of g.entities.filter(e=>!e.building))g.stop(u,true);g.running=true;
 const m=g.spawn('marine',0,700,1040);g.selected=[m];g.command(900,1040,false,false,'move');const x=m.x;advance(1/60);check('Command affects next 60 Hz tick',m.x>x,{travel:m.x-x});
 g.command(950,1040,false,true,'move');g.command(1000,1040,false,true,'move');check('Shift appends waypoints',m.orders.length===2);advance(8);check('Queued orders complete',m.order===null&&Math.hypot(m.x-1000,m.y-1040)<8,{x:m.x,y:m.y,order:m.order,queued:m.orders.length});
 const before={x:m.x,y:m.y};advance(3);check('Arrived unit does not jitter',Math.hypot(m.x-before.x,m.y-before.y)<.01);
 g.command(1080,1040,false,false,'patrol');advance(1.8);check('Patrol returns to origin',m.order?.kind==='patrol'&&m.order.out===false,{x:m.x,order:m.order});
 g.stop(m,true);const anchor={x:m.x,y:m.y};const foe=g.spawn('marine',1,m.x+190,m.y);g.stop(foe,true);advance(1);check('Hold does not chase',Math.hypot(m.x-anchor.x,m.y-anchor.y)<.01);g.stop(m,false);advance(.6);check('Stop allows automatic pursuit',Math.hypot(m.x-anchor.x,m.y-anchor.y)>5);foe.hp=0;advance(.1);
 const wounded=g.spawn('marine',0,700,1100);wounded.hp=20;g.selected=[g.entities.find(e=>e.type==='worker')];g.command(wounded.x,wounded.y,false,false,'repair');check('SCV cannot repair Marine',g.selected[0].order?.kind!=='repair');
 isolate();for(const u of g.entities.filter(e=>!e.building))g.stop(u,true);g.running=true;const pack=[];for(let i=0;i<24;i++)pack.push(g.spawn('marine',0,670+i%6*23,570+Math.floor(i/6)*24));g.selected=pack;g.command(1140,700,false,false,'move');advance(12);const arrived=pack.filter(u=>!u.order).length,blocked=pack.filter(u=>Math.hypot(u.x-870,u.y-690)<108).length;let minGap=Infinity;for(let i=0;i<pack.length;i++)for(let j=i+1;j<pack.length;j++)minGap=Math.min(minGap,Math.hypot(pack[i].x-pack[j].x,pack[i].y-pack[j].y));check('24-unit group routes around rock',arrived>=22&&!blocked,{arrived,blocked,minGap,locations:pack.map(e=>[Math.round(e.x),Math.round(e.y),e.order?.kind])});check('Group maintains collision spacing',minGap>=17,{minGap});
 const hold=pack[0];g.stop(hold,true);const holdAt={x:hold.x,y:hold.y};g.selected=pack.slice(1);g.command(1250,800,false,false,'move');advance(4);check('Moving formation does not displace Hold unit',Math.hypot(hold.x-holdAt.x,hold.y-holdAt.y)<.01);
 return out;
}''')
 assert not errors, errors
 assert not failreq, failreq
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r.get('detail','')))
 assert all(r['pass'] for r in results), [r for r in results if not r['pass']]
 print('PAGE ERRORS',errors,'FAILED REQUESTS',failreq)
 # Exercise actual keyboard paths, not only the debug API.
 page.evaluate('''()=>{__game.reset();__game.start();__game.money=2000;__game.gas=2000;__game.selected=[__game.entities.find(e=>e.type==='worker')]}''');page.keyboard.press('b');page.keyboard.press('s');print('BS',page.evaluate("document.querySelector('#mode').textContent"));page.keyboard.press('Escape');page.keyboard.press('Escape');page.keyboard.press('Control+1');page.keyboard.press('Shift+2');page.keyboard.press('Alt+3');print('GROUPS',page.evaluate('__game.groups'));page.evaluate('''()=>{const m=__game.spawn('marine',0,720,900);__game.selected=[__game.entities.find(e=>e.type==='worker'),m]}''');page.keyboard.press('Tab');print('TAB',page.evaluate('({n:__game.selected.length,type:__game.readState().activeType})'))
 page.screenshot(path=str(ARTIFACTS / "controls.png"));page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500);print('MOBILE OVERFLOW',page.evaluate('document.documentElement.scrollWidth>innerWidth'));page.screenshot(path=str(ARTIFACTS / "mobile.png"));b.close()
