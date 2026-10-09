"""Regression scenarios for worker traffic, harvest ownership and interruptions."""
import json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game');page.click('#launch');page.evaluate('__game.running=false')
 results=page.evaluate('''async()=>{
 const g=__game,{HARVEST,mineralWalking}=await import('./workers.js'),out=[],check=(name,ok,detail)=>out.push({name,pass:!!ok,detail}),tick=n=>{for(let i=0;i<n;i++)g.update(1/60)};
 const reset=()=>{g.reset();g.start();g.running=false;g.aiEnabled=false;for(let i=g.entities.length-1;i>=0;i--)if(g.entities[i].team)g.entities.splice(i,1);g.invalidateNav();};
 reset();tick(3000);let ws=g.entities.filter(e=>e.type==='worker');check('Every starting worker completes multiple trips without mineral-line jam',ws.every(w=>w.deliveredTrips>=3),{trips:ws.map(w=>w.deliveredTrips||0),income:g.money-50});
 check('Harvest times use catalog Faster conversion',HARVEST.mineralTime===2.786/1.4&&HARVEST.gasTime===1.981/1.4&&HARVEST.returnDelay===.5/1.4);
 reset();ws=g.entities.filter(e=>e.type==='worker');const node=g.minerals[3];g.selected=ws;g.running=true;g.command(node.x,node.y);g.running=false;check('Explicit group Gather retains the clicked field on acceptance',ws.every(w=>w.order.node===node),{fields:new Set(ws.map(w=>w.order.node)).size});tick(600);check('Workers redistribute locally after reaching a busy clicked field',new Set(ws.filter(w=>w.order?.kind==='mine').map(w=>w.order.node)).size>=6,{fields:new Set(ws.filter(w=>w.order?.kind==='mine').map(w=>w.order.node)).size});
 tick(1800);check('Group gather keeps all workers productive',ws.every(w=>w.deliveredTrips>=2),{trips:ws.map(w=>w.deliveredTrips||0)});
 reset();ws=g.entities.filter(e=>e.type==='worker');for(const w of ws)g.stop(w);const w=ws[0];g.issue(w,{kind:'mine',node:g.minerals[3]});tick(600);check('Gather order enables mineral walking',mineralWalking(w));g.stop(w);if(w.order?.phase==='waitReturn')tick(Math.ceil(w.returnWait*60));check('Stop restores ordinary worker collision and releases resource',!mineralWalking(w)&&!w.harvestResource&&!w.insideRefinery);
 const m=g.spawn('marine',0,700,1040);g.selected=[w,m];g.running=true;g.command(node.x,node.y,false,false,'gather');g.running=false;check('Explicit Gather only affects workers in mixed selection',w.order?.kind==='mine'&&m.order===null);
 g.running=true;g.selected=[m];g.action('move');g.command(1000,1040,false,false,'move');g.action('hold',true);g.running=false;tick(300);check('Queued Hold executes after movement',m.hold&&m.order===null&&m.x>990);
 // A single patch cannot mine multiple cargoes simultaneously.
 reset();ws=g.entities.filter(e=>e.type==='worker');for(const w of ws)g.stop(w);for(const n of g.minerals)n.amount=0;const single=g.minerals[3];single.amount=1800;g.invalidateNav();for(const w of ws.slice(0,3))g.issue(w,{kind:'mine',node:single});let maximum=0;for(let i=0;i<900;i++){g.update(1/60);maximum=Math.max(maximum,ws.filter(w=>w.order?.phase==='harvest').length);}check('One active harvester per mineral field',maximum===1,{maximum});check('Saturated field queues and continues harvesting',ws.slice(0,3).some(w=>w.deliveredTrips>=2));
 // Plans do not block paths until the builder arrives; interrupting refunds them.
 reset();g.money=2000;ws=g.entities.filter(e=>e.type==='worker');g.selected=[ws[0],ws[3]];g.running=true;g.action('relay');const target=g.placementPreview(588,980);let bld=g.place(target.x,target.y);g.running=false;check('Construction chooses closest selected SCV',bld.builder===ws.slice(0,4).filter(w=>[ws[0],ws[3]].includes(w)).sort((a,b)=>Math.hypot(a.x-bld.x,a.y-bld.y)-Math.hypot(b.x-bld.x,b.y-bld.y))[0]);
 check('Distant build order reserves a plan, not a physical obstacle',bld.planned&&g.nav.open({x:bld.x,y:bld.y},10.5));const money=g.money;g.stop(bld.builder);check('Canceling an unstarted plan refunds its cost',bld.hp===0&&g.money===money+bld.cost);
 reset();g.money=2000;w.order=null;const builder=g.entities.find(e=>e.type==='worker');g.selected=[builder];g.running=true;g.action('relay');bld=g.place(588,980);g.running=false;tick(2400);check('Worker reaches plan and finishes physical building',bld.ready&&!bld.planned&&bld.progress===1,{ready:bld.ready,progress:bld.progress});
 // Gas harvesters hide only during mining and still count toward supply.
 reset();for(const w of g.entities.filter(e=>e.type==='worker'))g.stop(w);const gasWorker=g.entities.find(e=>e.type==='worker'),geyser=g.geysers[0],ref=g.spawn('refinery',0,geyser.x,geyser.y);ref.geyser=geyser;g.issue(gasWorker,{kind:'gas',target:ref});let hidden=false;for(let i=0;i<600;i++){g.update(1/60);if(gasWorker.insideRefinery){hidden=true;check('Gas harvester remains counted in supply',g.used()===12);break;}}check('Gas worker enters Refinery',hidden);check('Hidden gas input is rejected without creating an instant exit',!g.issue(gasWorker,{kind:'move',x:650,y:1000})&&gasWorker.insideRefinery===ref);let exit=120;while(gasWorker.insideRefinery&&exit--)g.update(1/60);check('Hidden worker finishes extraction with earned cargo',!gasWorker.insideRefinery&&gasWorker.carry===4);g.issue(gasWorker,{kind:'move',x:650,y:1000});tick(300);check('Move after gas emergence finishes with preserved cargo',gasWorker.order===null&&gasWorker.carry===4);
 return out;
 }''')
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r.get('detail','')))
 assert not errors,errors
 assert all(r['pass'] for r in results),[r for r in results if not r['pass']]
 # Actual right click during placement cancels without issuing a movement order.
 page.evaluate("()=>{__game.reset();__game.start();__game.aiEnabled=false;__game.money=1000;const w=__game.entities.find(e=>e.type==='worker');__game.stop(w);__game.selected=[w];__game.action('relay')}")
 page.mouse.click(900,400,button='right');assert page.evaluate('__game.selected[0].order===null&&document.querySelector("#mode").textContent===""')
 print('PASS Placement right click cancels without moving worker')
 page.evaluate('''()=>{__game.reset();__game.start();__game.aiEnabled=false;__game.running=false;for(let i=0;i<1200;i++)__game.update(1/60)}''');page.wait_for_timeout(100);page.screenshot(path=str(Path('artifacts/worker-traffic.png')));b.close()
