from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil

ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
BROWSER = shutil.which("chromium") or shutil.which("chromium-browser")
BROWSER_OPTIONS = {"executable_path": BROWSER} if BROWSER else {}
with sync_playwright() as p:
 b=p.chromium.launch(**BROWSER_OPTIONS,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);pg=b.new_page(viewport={'width':1440,'height':900});pg.goto('http://127.0.0.1:8000/?debug');pg.wait_for_function('window.__game');pg.click('#launchLab');pg.wait_for_timeout(100)
 def check(name,v):print(('PASS' if v else 'FAIL'),name);assert v,name
 def unitpos(t):return pg.evaluate(f"()=>{{const u=__game.entities.find(e=>e.team===0&&e.type==='{t}');return __game.view.project(u.x,u.y,18)}}")
 u=unitpos('marine');pg.mouse.click(u['x'],u['y']);check('3D mesh click selects Marine',pg.evaluate("__game.selected.length===1&&__game.selected[0].type==='marine'"))
 pg.keyboard.down('Control');pg.mouse.click(u['x'],u['y']);pg.keyboard.up('Control');check('Ctrl-click selects visible Marines',pg.evaluate("__game.selected.length===32&&__game.selected.every(e=>e.type==='marine')"))
 tank=unitpos('tank');pg.keyboard.down('Shift');pg.mouse.click(tank['x'],tank['y']);pg.keyboard.up('Shift');check('Shift click adds Tank',pg.evaluate('__game.selected.length===33'))
 pg.keyboard.down('Shift');pg.mouse.click(tank['x'],tank['y']);pg.keyboard.up('Shift');check('Shift click removes Tank',pg.evaluate('__game.selected.length===32'))
 pg.keyboard.press('F2');pg.keyboard.press('Tab');check('Tab keeps army and changes active card',pg.evaluate("__game.selected.length===36&&__game.readState().activeType==='tank'"));pg.keyboard.press('e');check('E starts tank deployment',pg.evaluate("__game.selected.filter(e=>e.type==='tank').every(e=>e.transform?.toSiege)"));pg.evaluate('__game.running=false;for(let i=0;i<180;i++)__game.update(1/60)');check('Tank deployment completes',pg.evaluate("__game.selected.filter(e=>e.type==='tank').every(e=>e.sieged)"));pg.evaluate('__game.running=true');pg.keyboard.press('d');check('D starts unsiege',pg.evaluate("__game.selected.filter(e=>e.type==='tank').every(e=>e.transform&&!e.transform.toSiege)"));pg.evaluate('for(let i=0;i<180;i++)__game.update(1/60)');pg.evaluate('__game.running=true')
 pg.keyboard.press('Control+4');pg.keyboard.press('Alt+Shift+5');check('Alt Shift steals and appends group',pg.evaluate('__game.groups["4"].length===0&&__game.groups["5"].length===36'))
 pg.keyboard.press('h');check('Hold affects full mixed selection',pg.evaluate('__game.selected.every(e=>e.hold)'))
 pg.keyboard.press('Shift+Tab');pg.keyboard.press('m');point=pg.evaluate('__game.view.project(1050,850)');pg.mouse.click(point['x'],point['y']);check('M left click issues move to full selection',pg.evaluate('__game.selected.every(e=>e.order?.kind==="move")'))
 mm=pg.locator('#minimap').bounding_box();pg.mouse.click(mm['x']+mm['width']*1500/2100,mm['y']+mm['height']*1300/1400,button='right');check('Minimap right click issues orders',pg.evaluate('__game.selected.every(e=>e.order?.kind==="move")'))
 pg.mouse.click(mm['x']+mm['width']*1300/2100,mm['y']+mm['height']*600/1400);check('Minimap left click pans camera',pg.evaluate('Math.abs(__game.camera.x-1300)<2&&Math.abs(__game.camera.y-600)<2'))
 pg.keyboard.press('Control+F5');pg.keyboard.press('Backspace');pg.keyboard.press('F5');check('Camera location save recall',pg.evaluate('Math.abs(__game.camera.x-1300)<2'))
 pg.evaluate("__game.entities.filter(e=>!e.team&&e.type==='worker').slice(0,3).forEach(e=>__game.stop(e))");pg.keyboard.press('Control+F1');check('Ctrl F1 selects all idle workers',pg.evaluate('__game.selected.length===3&&__game.selected.every(e=>e.type==="worker")'))
 b.close()
