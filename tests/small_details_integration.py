"""Observed details through production UI, keyboard and the real dispatcher."""
import json,shutil
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1024,'height':768});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game')
 results=page.evaluate('''async()=>{
 const g=__game,out=[],check=(name,pass)=>out.push({name,pass:!!pass}),tick=n=>{for(let i=0;i<n;i++)g.update(1/22.4)};
 const reset=()=>{g.reset();g.start();g.running=false;g.aiEnabled=false;g.entities.splice(0);g.minerals.splice(0);g.money=2000;g.gas=2000;g.selected=[]};
 reset();g.spawn('core',0,300,1100);const bare=g.spawn('barracks',0,600,1100),labbed=g.spawn('barracks',0,900,1100);labbed.addon=g.spawn('techlab',0,1000,1100);g.selected=[bare,labbed];g.running=true;
 check('Grouped Marauder action skips ineligible active Barracks',g.action('marauder')&&labbed.queue.length===1&&bare.queue.length===0);
 check('Grouped command card reports eligible Marauder',!document.querySelector('[data-action="marauder"]').classList.contains('disabled'));
 g.selected=[labbed];g.updateHUD();const button=document.querySelector('#productionQueue button');g.updateHUD();check('Production queue retains the same DOM button across refresh',button===document.querySelector('#productionQueue button'));
 const paid=g.money;button.click();check('Queue click cancels the intended item and refunds once',labbed.queue.length===0&&g.money===paid+100);button.click();check('Stale queue click cannot duplicate a refund',g.money===paid+100);
 g.spawn('core',1,1750,1100);const enemy=g.spawn('barracks',1,1500,1100);g.train('marine',enemy,true);g.selected=[enemy];g.updateHUD();const money=g.money;const enemyButton=document.querySelector('#productionQueue button');check('Enemy production buttons are read only',enemyButton.disabled);enemyButton.click();check('Enemy queue inspection cannot refund player resources',g.money===money&&enemy.queue.length===1);
 const lab2=g.spawn('techlab',0,1200,1100);g.selected=[labbed.addon];check('First Stim research starts',g.action('stimResearch'));g.selected=[lab2];const cost=g.money;check('Second lab cannot pay for duplicate pending Stim research',!g.action('stimResearch')&&g.money===cost&&!lab2.research);g.running=false;
 reset();const scout=g.spawn('marine',0,700,1100),target=g.spawn('marine',1,900,1100);g.update(0);g.issue(scout,{kind:'move',x:750,y:1100});g.issue(scout,{kind:'attack',target},true);const queued=scout.orders[0];check('Queued enemy attack captures accepted observed position',queued.lastSeen.x===900);
 const {orderEndpoint,orderColor}=await import('/order-feedback.js');target.x=1900;target.y=200;g.update(0);const end=orderEndpoint(queued,0,g.isVisible);check('Hidden queued target endpoint uses snapshot',end.x===900&&end.y===1100);
 check('Attack paths use red, Move and Follow green',orderColor(queued)==='#ef5950'&&orderColor({kind:'follow'})==='#63ec65');
 tick(50);check('Queued hidden attack preserves its observed fallback on activation',scout.order?.kind==='attackMove'&&scout.order.x===900);
 reset();const planned=g.spawn('core',0,1100,1100,false,true);g.update(0);check('Planned building grants no scouting vision',!g.isVisible(1100,1100));planned.planned=false;g.update(0);check('Unfinished building sees nearby ground',g.isVisible(1100,1100));check('Unfinished building does not grant full finished sight',!g.isVisible(1350,1100));planned.ready=true;g.update(0);check('Completed building gains its full sight',g.isVisible(1350,1100));
 reset();const repairer=g.spawn('worker',0,900,1100),tank=g.spawn('tank',0,935,1100);tank.hp=tank.maxhp-.01;g.money=.01;g.gas=.01;g.issue(repairer,{kind:'repair',target:tank});tick(1);check('Tiny final repair succeeds with proportional affordable funds',tank.hp===tank.maxhp&&g.money>0&&g.gas>0);
 reset();const victim=g.spawn('core',0,700,1100),attacker=g.spawn('marine',1,780,1100);g.stop(attacker,true);g.invalidateNav();tick(5);check('Real hostile damage emits base attack warning',g.transmissions.history().some(a=>a.kind==='attackTown'));check('Attack warning has a minimap pulse',g.transmissions.pings().length===1);const history=g.transmissions.history().length;g.running=true;g.selected=[victim];g.money=0;g.action('worker');check('Resource error does not displace transmission history',g.transmissions.history().length===history);g.running=false;
 return out;}''')
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],flush=True)
 assert all(r['pass'] for r in results),[r for r in results if not r['pass']]
 # Actual keyboard binding banks and warning navigation.
 page.evaluate('''()=>{__game.reset();__game.start();__game.aiEnabled=false;__game.camera.x=600;__game.camera.y=900;}''')
 page.keyboard.press('Control+F5');page.evaluate('__game.camera.x=1200;__game.camera.y=400');page.keyboard.press('Control+Shift+F5');page.evaluate('__game.camera.x=900');page.keyboard.press('F5');assert page.evaluate('__game.camera.x')==600
 page.keyboard.press('Shift+F5');assert page.evaluate('__game.camera.x')==1200
 page.keyboard.press('End');assert page.evaluate('__game.camera.zoomStep')==4
 page.keyboard.press('Home');assert page.evaluate('__game.camera.zoomStep')==0
 page.evaluate("__game.transmissions.reset();__game.transmissions.transmit('Under attack',{x:1000,y:700},{kind:'attackTown'});__game.transmissions.error('Not enough minerals')")
 page.keyboard.press('Space');assert page.evaluate('__game.camera.x===1000&&__game.camera.y===700')
 assert not errors,errors
 print(str(len(results)+5)+' small-detail integration checks passed; no browser exceptions.')
 page.screenshot(path='/workspace/sc2-control-lab/artifacts/small-details.png')
 b.close()
