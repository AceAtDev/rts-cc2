"""Actual browser Tank executor: observed stationary headings and moving reversal."""
import json,shutil
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':800,'height':600});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game')
 results=page.evaluate('''()=>{const g=__game,dt=1/22.4,out=[],fixture=angle=>{g.reset();g.start();g.running=false;g.aiEnabled=false;g.entities.splice(0);g.minerals.splice(0);g.selected=[];g.invalidateNav();const u=g.spawn('tank',0,700,1100);u.angle=u.pangle=angle;g.issue(u,{kind:'move',x:980,y:1100});return u};
 for(const [name,angle,first,done] of [['east',0,1,73],['north',Math.PI/2,2,74],['west',Math.PI,4,76]]){const u=fixture(angle);let moved=null,cleared=null;for(let loop=1;loop<=80;loop++){g.update(dt);if(moved===null&&u.x>700)moved=loop;if(cleared===null&&!u.order)cleared=loop}out.push({name:name+'-facing Tank movement starts and completes on measured native loops',pass:moved===first&&cleared===done&&u.x===980&&u.y===1100,detail:{moved,cleared,x:u.x,y:u.y}})}
 const u=fixture(0);for(let i=0;i<10;i++)g.update(dt);const x=u.x;g.issue(u,{kind:'move',x:500,y:1100});let held=true;for(let i=0;i<3;i++){g.update(dt);held&&=u.x===x}g.update(dt);out.push({name:'Moving Tank stops for three reversal loops and resumes on the fourth',pass:held&&u.x<x,detail:{held,before:x,after:u.x}});return out;}''')
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r['detail']),flush=True)
 assert all(r['pass'] for r in results),results;assert not errors,errors;print(str(len(results))+' Tank turn integration checks passed; no browser exceptions.');b.close()
