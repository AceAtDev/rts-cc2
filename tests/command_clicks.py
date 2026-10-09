"""Real mouse and keyboard command targeting, cancellation, and Shift queues."""
import shutil
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);pg=b.new_page(viewport={'width':1440,'height':900});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto('http://127.0.0.1:8000/?debug');pg.wait_for_function('window.__game');pg.click('#launch');pg.evaluate('''()=>{const g=__game;g.aiEnabled=false;g.running=false;g.camera.x=600;g.camera.y=1000;g.view.setCamera(g.camera);const m=g.spawn('marine',0,600,1000),t=g.spawn('tank',1,740,1000);t.damage=0;g.stop(t,true);g.selected=[m];g.update(0);g.running=true;window.testUnit=m;window.testEnemy=t;}''');pg.wait_for_timeout(100)
 def check(name,expr):
  result=pg.evaluate(expr);print(('PASS' if result else 'FAIL'),name);assert result,name
 target=pg.evaluate('__game.view.project(testEnemy.x,testEnemy.y,30)');pg.mouse.click(target['x'],target['y'],button='right');check('Right clicking enemy model issues attack on clicked unit','testUnit.order?.kind==="attack"&&testUnit.order.target===testEnemy')
 pg.keyboard.press('m');pg.mouse.click(target['x'],target['y'],button='right');check('Right click cancels target mode without changing existing order','__game.mode===null&&testUnit.order?.target===testEnemy')
 pg.keyboard.press('m');point=pg.evaluate('__game.view.project(900,1040)');pg.mouse.click(point['x'],point['y']);pg.keyboard.press('Shift+s');check('Actual Shift S queues Stop behind Move','testUnit.order?.kind==="move"&&testUnit.orders[0]?.kind==="stop"')
 pg.evaluate('''()=>{testEnemy.hp=0;__game.running=false;for(let i=0;i<240;i++)__game.update(1/60)}''');check('Queued Stop executes at destination','testUnit.order===null&&!testUnit.hold&&testUnit.x>890')
 # Aim at crystal geometry rather than relying on a distance-to-ground guess.
 pg.evaluate('''()=>{const g=__game;g.reset();g.start();g.aiEnabled=false;g.camera.x=300;g.camera.y=1100;const w=g.entities.find(e=>e.type==='worker');g.stop(w);g.selected=[w];window.testWorker=w;window.testPatch=g.minerals[1];}''');pg.wait_for_timeout(100);target=pg.evaluate('__game.view.project(testPatch.x,testPatch.y,22)');pg.mouse.click(target['x'],target['y'],button='right');check('Clicking mineral crystal geometry issues Gather','testWorker.order?.kind==="mine"')
 pg.keyboard.press('b');pg.keyboard.press('s');pg.keyboard.press('Escape');check('Escape cancels building placement','document.querySelector("#mode").textContent===""')
 assert not errors,errors;b.close()
