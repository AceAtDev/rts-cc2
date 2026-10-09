"""Named failures from the SC2 source audit, including real modifier input.
Passing these checks verifies these semantics, not native client equivalence.
"""
import json, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':900}); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game')
 results=page.evaluate('''async()=>{
 const g=__game,{createNavigation}=await import('./navigation.js'),out=[],check=(name,ok,detail)=>out.push({name,pass:!!ok,detail}),tick=n=>{for(let i=0;i<n;i++)g.update(1/60)};
 const reset=()=>{g.reset();g.start();g.running=false;g.aiEnabled=false;for(let i=g.entities.length-1;i>=0;i--)if(g.entities[i].team)g.entities.splice(i,1);for(const w of g.entities.filter(e=>e.type==='worker'))g.stop(w);g.money=10000;g.gas=10000;g.invalidateNav()};
 const command=(u,target,kind=null)=>{g.selected=[u];g.running=true;g.command(target.x,target.y,false,false,kind,{entity:target});g.running=false};
 reset();let w=g.entities.find(e=>e.type==='worker'),cc=g.entities.find(e=>e.type==='core');w.carry=5;g.issue(w,{kind:'mine',node:g.minerals[3]});command(w,cc);check('Smart drop-off takes Return Cargo before Follow',w.order?.kind==='return'&&w.order.target===cc);const before=g.money;tick(180);check('Smart return deposits cargo and resumes harvesting',g.money>=before+5&&w.deliveredTrips>=1&&w.order?.kind==='mine');
 reset();w=g.entities.find(e=>e.type==='worker');cc=g.entities.find(e=>e.type==='core');w.carry=5;cc.hp-=100;command(w,cc);check('Carrying worker smart-click on damaged CC returns cargo',w.order?.kind==='return');
 reset();w=g.entities.find(e=>e.type==='worker');cc=g.spawn('core',0,850,1050);w.carry=5;command(w,cc);check('Return destination retains specifically clicked Command Center',w.order.target===cc);const start=g.money;tick(600);check('Explicit drop-off completes at chosen CC',w.carry===0&&g.money===start+5&&Math.hypot(w.x-cc.x,w.y-cc.y)<cc.r+30);
 reset();cc=g.entities.find(e=>e.type==='core');g.selected=[cc];g.running=true;const supply=g.used();g.action('load');g.running=false;for(let i=0;i<160&&cc.loaded.length<5;i++)g.update(1/22.4);check('Loaded SCVs retain their supply',cc.loaded.length===5&&g.used()===supply);g.running=true;g.action('unload');g.running=false;check('Unloading does not add duplicate supply',g.used()===supply);
 reset();w=g.entities.find(e=>e.type==='worker');w.hp=10;command(w,w,'repair');check('Explicit Repair rejects self',w.order===null);let bld=g.spawn('relay',0,750,1100,false);command(w,bld,'repair');check('Repair rejects unfinished construction',w.order===null);
 const other=g.spawn('worker',0,650,1000);other.hp=1;command(w,other,'repair');check('SCVs can repair another SCV',w.order?.target===other);check('Target RepairTime is distinct from arbitrary fallback',Math.abs(other.repairTime-16.667/1.4)<1e-9);
 reset();w=g.spawn('worker',0,650,1000);const tank=g.spawn('tank',0,690,1000);tank.hp=tank.maxhp-30;g.issue(w,{kind:'repair',target:tank});tick(120);check('Mechanical-unit repair restores health at catalog target rate',tank.hp>tank.maxhp-30&&tank.repairTime===45/1.4);
 reset();w=g.spawn('worker',0,650,1000);const damaged=g.spawn('relay',0,730,1000);damaged.hp=damaged.maxhp-5;w.repairAuto=true;g.issue(w,{kind:'patrol',x:950,y:1000,origin:{x:w.x,y:w.y},out:true});g.issue(w,{kind:'move',x:950,y:1100},true);tick(1);check('Repair autocast suspends Patrol',w.order?.kind==='repair'&&w.order.resume?.kind==='patrol');tick(360);check('Autocast repairs then restores Patrol and its queue',damaged.hp===damaged.maxhp&&w.order?.kind==='patrol'&&w.orders[0]?.kind==='move');
 reset();w=g.spawn('worker',0,650,1000);bld=g.spawn('relay',0,730,1000);bld.hp=1;w.repairAuto=true;g.issue(w,{kind:'patrol',x:950,y:1000,origin:{x:w.x,y:w.y},out:true});tick(1);bld.hp=0;tick(1);check('Destroyed autocast target restores suspended Patrol',w.order?.kind==='patrol');
 reset();w=g.spawn('worker',0,650,1000);const repairTarget=g.spawn('relay',0,730,1000);repairTarget.hp=repairTarget.maxhp-5;w.repairAuto=true;g.issue(w,{kind:'patrol',x:950,y:1000,origin:{x:w.x,y:w.y},out:true});const queuedPlan=g.spawn('relay',0,950,1100,false,true);queuedPlan.builder=w;g.issue(w,{kind:'build',target:queuedPlan},true);const wallet=g.money;tick(360);check('Autocast interruption preserves queued construction reservation',queuedPlan.hp>0&&queuedPlan.planned&&w.order?.kind==='patrol'&&w.orders[0]?.target===queuedPlan&&g.money<=wallet);
 const buildProgress=extra=>{reset();const b=g.spawn('relay',0,730,1000,false),a=g.spawn('worker',0,680,1000);b.builder=a;g.issue(a,{kind:'build',target:b});if(extra){const c=g.spawn('worker',0,780,1000);g.issue(c,{kind:'build',target:b})}tick(240);return b.progress};const one=buildProgress(false),two=buildProgress(true);check('Extra SCV cannot accelerate maintained Terran construction',Math.abs(one-two)<1e-9,{one,two});
 reset();bld=g.spawn('relay',0,730,1000,false);w=g.spawn('worker',0,680,1000);bld.builder=w;g.issue(w,{kind:'build',target:bld});tick(120);const prior=bld.progress;g.stop(w);const replacement=g.spawn('worker',0,780,1000);g.issue(replacement,{kind:'build',target:bld});tick(120);check('A replacement SCV takes over halted construction',bld.builder===replacement&&bld.progress>prior);
 reset();const geyser=g.geysers[1],ref=g.spawn('refinery',0,geyser.x,geyser.y,false);ref.geyser=geyser;w=g.spawn('worker',0,680,1150);command(w,ref);tick(120);check('SCV smart-click waits for unfinished gas instead of building or idling',w.order?.kind==='gas'&&!ref.ready&&ref.progress===0&&!w.insideRefinery);ref.ready=true;ref.progress=1;ref.hp=ref.maxhp;tick(300);check('Waiting SCV starts gathering once Refinery completes',w.deliveredTrips>=1||!!w.insideRefinery);
 reset();w=g.entities.find(e=>e.type==='worker');const marine=g.spawn('marine',0,750,1000),t=g.spawn('tank',0,800,1000);g.selected=[w,t,marine];const forward=g.readState().activeType;g.selected=[marine,t,w];check('Subgroup priority is independent of incoming selection order',forward==='marine'&&g.readState().activeType==='marine'&&g.selected[1]===t);g.selected=[w,t];check('Tank subgroup precedes SCV',g.readState().activeType==='tank');
 reset();cc=g.entities.find(e=>e.type==='core');const m=g.spawn('marine',0,750,1000),enemy=g.spawn('marine',1,860,1000);tick(1);g.selected=[cc,m];g.running=true;g.command(enemy.x,enemy.y,false,false,null,{entity:enemy});g.running=false;check('Mixed army and producer click keeps army attack',m.order?.kind==='attack'&&m.order.target===enemy);check('Mixed right-click attack rallies producer to current army location',cc.rally.kind==='move'&&cc.rally.x===m.x&&cc.rally.y===m.y);
 const nav=createNavigation({world:{w:400,h:400},obstacles:()=>[{x:200,y:80,r:111},{x:200,y:320,r:111}]});check('SCV inner terrain radius passes 18-pixel gap',nav.clear({x:100,y:200},{x:300,y:200},8.75));check('Marine terrain radius is blocked by same gap',!nav.clear({x:100,y:200},{x:300,y:200},10.5));check('Worker unit-separation radius remains .375',w.r===.375*28&&w.innerRadius===.3125*28);
 return out;
 }''')
 for r in results:print(('PASS' if r['pass'] else 'FAIL'),r['name'],json.dumps(r.get('detail','')))
 assert all(r['pass'] for r in results),[r for r in results if not r['pass']]
 # Shift+C must traverse the actual keyboard/card routing, not just a debug call.
 page.evaluate('''()=>{const g=__game;g.reset();g.start();g.aiEnabled=false;g.running=false;g.money=10000;for(const w of g.entities.filter(e=>e.type==='worker'))g.stop(w);const w=g.spawn('worker',0,650,1000),b=g.spawn('relay',0,730,1000,false);w.carry=5;b.builder=w;g.issue(w,{kind:'build',target:b});g.selected=[w];g.running=true}''')
 page.keyboard.press('Shift+c');page.evaluate('__game.running=false')
 assert page.evaluate("__game.selected[0].order.kind==='build'&&__game.selected[0].orders[0]?.kind==='return'")
 print('PASS Actual Shift+C queues cargo behind construction')
 page.evaluate('''()=>{const g=__game;for(let i=0;i<1800;i++)g.update(1/60)}''')
 assert page.evaluate('__game.selected[0].carry===0&&__game.selected[0].deliveredTrips>=1')
 print('PASS Queued cargo deposits after construction completes')
 page.evaluate('''()=>{const g=__game;g.reset();g.start();g.running=false;g.aiEnabled=false;g.entities.filter(e=>e.type==='worker'&&!e.team).forEach(w=>g.stop(w));g.selected=[];g.camera.x=1000;g.camera.y=700;g.running=true}''')
 page.keyboard.press('F1');page.evaluate('__game.running=false')
 assert page.evaluate('__game.selected.length===1&&__game.camera.x===1000&&__game.camera.y===700')
 print('PASS First F1 selects an idle worker without changing camera')
 selected=page.evaluate('__game.selected[0].id');page.evaluate('__game.running=true');page.keyboard.press('F1');page.evaluate('__game.running=false')
 assert page.evaluate(f'__game.selected[0].id==={selected}&&Math.abs(__game.camera.x-__game.selected[0].x)<.01')
 print('PASS Second F1 centers the selected idle worker')
 assert not errors,errors
 b.close()
