"""Integrated console, model lifecycle and real selection/drop-off checks."""
import json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game');page.click('#launch');page.evaluate('__game.running=false;__game.aiEnabled=false;for(let i=0;i<1200;i++)__game.update(1/60)');page.wait_for_timeout(100)
 def check(name,ok,detail=None):print(('PASS' if ok else 'FAIL'),name,json.dumps(detail));assert ok,name
 layout=page.evaluate('''()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{width:r.width,height:r.height,bottom:r.bottom}};return{buttons:[...document.querySelectorAll('#actions button')].map(b=>{const r=b.getBoundingClientRect();return{width:r.width,height:r.height}}),panels:[...document.querySelectorAll('.console>section')].map(b=>b.getBoundingClientRect().bottom),overflow:document.documentElement.scrollWidth>innerWidth,camera:{perspective:__game.view.camera.isPerspectiveCamera,fov:__game.view.camera.fov}}}''')
 check('Command cells have square rendered hit regions',all(abs(x['width']-x['height'])<1 for x in layout['buttons']),layout['buttons'][0]);check('All desktop console panels fit the viewport',all(abs(y-900)<1 for y in layout['panels']));check('No horizontal page overflow',not layout['overflow']);check('Camera is perspective with catalog field of view',layout['camera']['perspective'] and abs(layout['camera']['fov']-27.8)<.00001);check('Idle-worker shortcut hides when workers are assigned',page.locator('#workers').is_hidden())
 Path('artifacts').mkdir(exist_ok=True);page.screenshot(path='artifacts/integrated-opening.png')
 # Reset must release old mineral meshes rather than accumulating detached resources.
 counts=[]
 for _ in range(3):
  page.evaluate('__game.reset();__game.start();__game.running=false');page.wait_for_timeout(100);counts.append(page.evaluate('__game.view.scene.children.length'))
 check('Repeated scenario reset keeps scene object count stable',len(set(counts))==1,counts)
 # Model-ray picking must reach Return Cargo through actual right-click input.
 page.evaluate('''()=>{const g=__game;g.aiEnabled=false;for(const w of g.entities.filter(e=>e.type==='worker'))g.stop(w);const w=g.spawn('worker',0,650,1040);w.carry=5;g.selected=[w];g.running=true}''');page.wait_for_timeout(50)
 cc=page.evaluate("()=>{const c=__game.entities.find(e=>!e.team&&e.type==='core');return __game.view.project(c.x,c.y,35)}");page.mouse.click(cc['x'],cc['y'],button='right');page.evaluate('__game.running=false');check('Actual Command Center model click issues cargo return',page.evaluate("__game.selected[0].order?.kind==='return'"),page.evaluate("({kind:__game.selected[0].order?.kind,carry:__game.selected[0].carry,delivered:__game.selected[0].deliveredTrips})"))
 # Same-type selection excludes units physically hidden by the stepped console.
 page.evaluate('''()=>{const g=__game;g.reset();g.start();g.running=false;g.aiEnabled=false;g.camera.x=1000;g.camera.y=700;g.view.setCamera(g.camera);const a=g.view.ground(700,350),b=g.view.ground(500,830);g.spawn('marine',0,a.x,a.y);g.spawn('marine',0,b.x,b.y);g.selected=[]}''');page.wait_for_timeout(100)
 marines=page.evaluate("__game.entities.filter(e=>e.type==='marine').map(e=>({id:e.id,...__game.view.project(e.x,e.y,18)}))");check('Selection fixture places second Marine behind console',marines[1]['y']>720,marines);page.evaluate('__game.running=true');page.keyboard.down('Control');page.mouse.click(marines[0]['x'],marines[0]['y']);page.keyboard.up('Control');page.evaluate('__game.running=false');check('Ctrl-click selects only same-type units visible above actual console',page.evaluate('__game.selected.length===1'))
 page.evaluate('__game.startDrill("movement");__game.running=false');page.wait_for_timeout(100);page.screenshot(path='artifacts/integrated-army.png')
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);page.screenshot(path='artifacts/integrated-mobile.png');mobile=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth>innerWidth,panels:[...document.querySelectorAll('.console>section')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().bottom)})''');check('Mobile console stays inside viewport without horizontal overflow',not mobile['overflow'] and all(abs(y-844)<1 for y in mobile['panels']),mobile)
 check('Integrated render has no browser page errors',not errors,errors);b.close()
