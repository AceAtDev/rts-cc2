"""Actual input must ignore invisible actor geometry and visual-only effects.

Run serially with the browser suites. The screen point is discovered from actual
hidden scaffold ray intersections, not a brittle fixed screenshot coordinate.
"""
import json
import shutil
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
                                args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8000/?debug')
    page.wait_for_function('window.__game')
    page.click('#launch')
    page.evaluate('''()=>{
      const g=__game;g.running=false;g.aiEnabled=false;
      g.camera.x=1000;g.camera.y=760;g.view.setCamera(g.camera);
      const c=g.spawn('core',0,1000,760),w=g.spawn('worker',0,700,760);
      g.stop(w);g.selected=[w];g.pickingBuilding=c.id;g.pickingWorker=w.id;
    }''')
    page.wait_for_timeout(80)

    def check(name, okay, detail=None):
        print(('PASS' if okay else 'FAIL'), name, json.dumps(detail))
        assert okay, name

    fixture = page.evaluate('''()=>{
      const g=__game,v=g.view,e=g.entities.find(e=>e.id===g.pickingBuilding),root=v.objects.get(e.id),scaffold=root.userData.buildingAnimation.scaffold;
      v.scene.updateMatrixWorld(true);
      const under=(object,ancestor)=>{for(let p=object;p;p=p.parent)if(p===ancestor)return true;return false;};
      const corners=[];
      for(const x of [-70,70])for(const y of [-70,70])for(const h of [0,80])corners.push(v.project(e.x+x,e.y+y,h));
      const x0=Math.max(20,Math.floor(Math.min(...corners.map(p=>p.x)))-8),x1=Math.min(v.width-20,Math.ceil(Math.max(...corners.map(p=>p.x)))+8);
      const y0=Math.max(35,Math.floor(Math.min(...corners.map(p=>p.y)))-8),y1=Math.min(v.height-350,Math.ceil(Math.max(...corners.map(p=>p.y)))+8);
      for(let y=y0;y<=y1;y+=3)for(let x=x0;x<=x1;x+=3){
        if(document.elementFromPoint(x,y)!==v.canvas)continue;
        const ground=v.ground(x,y);
        // Exclude the game's intentional ground-click selection tolerance.
        if(Math.hypot(ground.x-e.x,ground.y-e.y)<=e.r+15)continue;
        v.ray.setFromCamera({x:x/v.width*2-1,y:1-y/v.height*2},v.camera);
        const raw=v.ray.intersectObjects([root],true),hidden=raw.find(hit=>under(hit.object,scaffold));
        if(!hidden||v.pickVisible([...v.objects.values()],x,y).length)continue;
        return {x,y,ground,scaffoldVisible:scaffold.visible,rawHiddenHit:true,pickableHits:0};
      }
      return null;
    }''')
    check('Fixture finds invisible scaffold geometry over otherwise empty terrain', fixture is not None, fixture)
    check('Completed structure scaffold is hidden', not fixture['scaffoldVisible'])
    check('Visible actor picking excludes the raw hidden scaffold hit', fixture['pickableHits'] == 0)

    page.mouse.move(fixture['x'], fixture['y'])
    page.wait_for_timeout(80)
    check('Hover over hidden scaffold remains empty', page.evaluate('__game.view.hovered===null'))
    page.evaluate('__game.running=true')
    page.mouse.click(fixture['x'], fixture['y'], button='right')
    page.evaluate('__game.running=false')
    order = page.evaluate('''()=>{const w=__game.entities.find(e=>e.id===__game.pickingWorker);return {kind:w.order?.kind,target:w.order?.target?.id}}''')
    check('Right-click through hidden scaffold issues Move rather than a building interaction', order['kind'] == 'move', order)

    point = page.evaluate('''()=>{const e=__game.entities.find(e=>e.id===__game.pickingBuilding);return __game.view.project(e.x,e.y,35)}''')
    page.mouse.move(point['x'], point['y'])
    page.wait_for_timeout(80)
    check('Fixture can hover the real visible building model', page.evaluate('__game.view.hovered?.id===__game.pickingBuilding'))
    hud = page.locator('#actions').bounding_box()
    page.mouse.move(hud['x'] + hud['width']/2, hud['y'] + hud['height']/2)
    page.wait_for_timeout(80)
    check('Leaving the battlefield for the HUD clears hover feedback', page.evaluate('''()=>{const g=__game,mesh=g.view.objects.get(g.pickingBuilding);return g.view.hovered===null&&!mesh.userData.preselection.visible}'''))
    check('Visible actor picking produces no browser exceptions', not errors, errors)
    browser.close()
