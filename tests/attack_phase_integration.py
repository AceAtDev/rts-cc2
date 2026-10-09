"""Real 22.4-Hz order executor: observed cold-start impact and cancellation."""
import json,shutil
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':800,'height':600});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game')
 results=page.evaluate('''()=>{const g=__game,dt=1/22.4,out=[],check=(name,pass,detail)=>out.push({name,pass:!!pass,detail});
 const fixture=type=>{g.reset();g.start();g.running=false;g.aiEnabled=false;g.entities.splice(0);g.minerals.splice(0);g.selected=[];g.invalidateNav();const a=g.spawn(type,0,700,1100),t=g.spawn('marine',1,700+(type==='worker'?.7998:4)*28,1100);t.damage=0;t.hp=t.maxhp=1000;g.stop(t,true);a.angle=0;a.turretAngle=0;g.update(0);g.issue(a,{kind:'attack',target:t});return{a,t}};
 const step=n=>{for(let i=0;i<n;i++)g.update(dt)};
 for(const [type,first] of [['marine',2],['worker',4]]){let {a,t}=fixture(type);step(first-1);check(type+' positive windup has no early impact',t.hp===1000&&!!a.windup,{hp:t.hp,remaining:a.windup?.remaining});step(1);check(type+' cold-start impact occurs on native observed loop '+first,t.hp<1000&&a.visualShotSerial===1,{hp:t.hp,serial:a.visualShotSerial});
 ({a,t}=fixture(type));step(first-1);g.issue(a,{kind:'move',x:600,y:1100});step(first+2);check(type+' Move before impact cancels its first shot',t.hp===1000&&!a.visualShotSerial&&!a.windup,{hp:t.hp});
 ({a,t}=fixture(type));step(first);const hp=t.hp,cd=a.cooldown;g.issue(a,{kind:'move',x:600,y:1100});step(1);g.issue(a,{kind:'attack',target:t});step(3);check(type+' post-impact Move and reattack preserve the cooldown',t.hp===hp&&a.cooldown>0&&a.cooldown<cd&&a.visualShotSerial===1,{hp:t.hp,cooldown:a.cooldown,initialCooldown:cd});}
 return out;}''')
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r['detail']),flush=True)
 assert all(r['pass'] for r in results),results;assert not errors,errors;print(str(len(results))+' attack phase integration checks passed; no browser exceptions.');b.close()
