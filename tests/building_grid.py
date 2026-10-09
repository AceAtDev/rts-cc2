"""Placement, collision footprint and narrow-gap browser regressions."""
from pathlib import Path
import shutil,json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game');page.click('#launch');page.evaluate('__game.running=false')
 results=page.evaluate('''async()=>{
 const geo=await import('./geometry.js'),{createNavigation}=await import('./navigation.js'),{createPlacement}=await import('./placement.js'),defs=SC2.defs,out=[];
 const check=(name,ok,detail)=>out.push({name,pass:!!ok,detail});
 check('Even footprint centers on integer map cells',geo.snapPlacement({x:101,y:99},2).x===112);
 check('Odd footprint centers on half map cells',geo.snapPlacement({x:101,y:99},3).x===98);
 const es=[],ms=[],gs=[],p=createPlacement({defs,entities:()=>es,minerals:()=>ms,geysers:()=>gs,rocks:[],world:{w:1000,h:1000},visible:()=>true});
 for(const [type,cells] of [['relay',4],['barracks',9],['core',25]])check(type+' uses catalog placement cell count',p.preview(type,{x:300,y:300}).cells.length===cells);
 let depot={...defs.relay,type:'relay',x:280,y:280,hp:400,lowered:true};es.push(depot);
 check('Lowered Depot still occupies placement cells',!p.valid('relay',depot));
 check('Adjacent cell-aligned Depot placement allowed',p.valid('relay',{x:336,y:280}));
 const corner={x:depot.x+27,y:depot.y+27};check('Pathing contour chamfers placement square corners',geo.surface(corner,depot).distance>0&&geo.rectangleOverlap({x0:corner.x-1,x1:corner.x+1,y0:corner.y-1,y1:corner.y+1},geo.bounds(depot,true)));
 es.length=0;const prod={...defs.barracks,x:294,y:294,hp:1000};es.push(prod);const pad=geo.addonPosition(prod);
 check('Add-on pad uses catalog cell offset',pad.x===364&&pad.y===308&&p.valid('techlab',pad));
 es.push({...depot,x:364,y:308});check('Blocked add-on pad blocks add-on',!p.valid('techlab',pad));es.length=0;es.push({...depot,x:364,y:308});let preview=p.preview('barracks',prod);check('Producer allowed with obstructed optional add-on pad',preview.valid&&preview.addonCells.some(c=>!c.valid));
 es.length=0;ms.push({x:448,y:434,r:21,placeWidth:2,placeHeight:1,amount:1800});check('Command Center observes mineral exclusion zone',!p.valid('core',{x:350,y:434}));check('Depot can build closer to resources',p.valid('relay',{x:350,y:434}));
 const walls=[{...defs.barracks,x:294,y:294},{...defs.barracks,x:294,y:406}];const nav=createNavigation({world:{w:700,h:700},obstacles:()=>walls}),a={x:180,y:350,r:10.5},end={x:450,y:350};
 check('Marine fits a one-cell corridor',nav.clear(a,end,a.r));check('Tank does not fit the same corridor',!nav.clear(a,end,21));let route=nav.path({...a,r:21},end);check('Larger unit routes around narrow corridor',route.length>2&&route.some(q=>Math.abs(q.y-350)>40),{length:route.length});
 const g=__game;g.aiEnabled=false;g.money=1000;g.running=true;g.selected=[g.entities.find(e=>e.type==='worker')];g.action('relay');const real=g.placementPreview(700,1150);check('Game placement uses grid-snapped coordinates',real.x%28===0&&real.y%28===0&&real.cells.length===4);g.running=false;
 return out;
 }''')
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r.get('detail','')))
 assert not errors,errors
 assert all(r['pass'] for r in results),[r for r in results if not r['pass']]
 # Render the actual ghost and cell overlay, then inspect it as a separate artifact.
 page.evaluate("()=>{__game.running=true;__game.aiEnabled=false;__game.selected=[__game.entities.find(e=>e.type==='worker')];__game.action('relay')}")
 screen=page.evaluate('__game.view.project(700,1150)');page.mouse.move(screen['x'],screen['y']);page.wait_for_timeout(100)
 ghost=page.evaluate('({x:__game.view.ghost.position.x,y:__game.view.ghost.position.z})');assert ghost['x']%28==0 and ghost['y']%28==0,ghost
 page.screenshot(path=str(Path('artifacts/building-grid.png')));b.close()
