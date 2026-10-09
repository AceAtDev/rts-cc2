"""Construction phases through the browser's production command dispatcher."""
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
        args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8000/?debug')
    page.wait_for_function('window.__game')
    results = page.evaluate('''async()=>{
      const g=__game,{surface}=await import('/geometry.js'),{activeConstructionTarget}=await import('/construction.js');
      const out=[],check=(name,pass,detail)=>out.push({name,pass:!!pass,detail}),tick=(n=1)=>{for(let i=0;i<n;i++)g.update(1/22.4)};
      const reset=()=>{g.reset();g.start();g.running=false;g.aiEnabled=false;g.entities.splice(0);g.selected=[];g.money=2000;g.gas=2000;
        const home=g.spawn('core',0,300,1100);g.spawn('core',1,1820,350);const worker=g.spawn('worker',0,700,1100);
        g.invalidateNav();g.update(0);return {worker,home,node:g.minerals[0]};};
      const place=worker=>{g.selected=[worker];g.running=true;const accepted=g.action('relay'),preview=g.placementPreview(840,1100),building=g.place(preview.x,preview.y);g.running=false;
        if(!accepted||!building)throw Error('Fixture cannot place Depot: '+JSON.stringify(preview));return building;};
      const smart=(worker,building)=>{g.selected=[worker];g.running=true;const result=g.command(building.x,building.y,false,false,null,{entity:building});g.running=false;return result;};
      const inside=(worker,building)=>{for(let i=0;i<400;i++){tick();if(activeConstructionTarget(worker)&&surface(worker,building).distance<-1)return true;}return false;};

      let {worker,home,node}=reset(),building=place(worker);g.selected=[worker];g.running=true;
      const queued=g.command(node.x,node.y,false,true,null,{node});g.running=false;
      check('Real placement reserves a plan and Shift-Smart queues mining',building.planned&&worker.order?.kind==='build'&&queued&&worker.orders[0]?.kind==='mine');
      let contacted=false,relocated=false,progressWhileMoving=false,initial=null,completed=false,promoted=false;
      for(let i=0;i<1300;i++){
        const before=building.progress;tick();
        if(activeConstructionTarget(worker)){contacted=true;initial??={x:worker.x,y:worker.y};
          relocated||=Math.hypot(worker.x-initial.x,worker.y-initial.y)>worker.r;
          progressWhileMoving||=Math.hypot(worker.vx,worker.vy)>1&&building.progress>before;}
        if(building.ready){completed=true;promoted||=['mine','return'].includes(worker.order?.kind);}
      }
      check('Contact activates the physical building and construction service',contacted&&!building.planned);
      check('Construction worker visibly relocates while progress continues',relocated&&progressWhileMoving,{relocated,progressWhileMoving});
      check('Completion promotes the queued mine order without service collision residue',completed&&promoted&&!worker.construction&&!activeConstructionTarget(worker));
      check('Queued mining delivers cargo after construction completes',(worker.deliveredTrips||0)>=1,{trips:worker.deliveredTrips});
      check('Completion emits a real building transmission',g.transmissions.history().some(a=>a.text===building.name+' complete'));

      ({worker}=reset());building=place(worker);const reachedInside=inside(worker,building),progress=building.progress;
      check('Service relocation enters the owned building footprint',reachedInside);
      g.selected=[worker];g.running=true;const halted=g.action('halt');g.running=false;
      check('Halt clears Build service ownership and keeps the unfinished building',halted&&!worker.order&&!worker.construction&&building.hp>0&&!building.ready&&!building.builder);
      let maxStep=0;for(let i=0;i<50;i++){const x=worker.x,y=worker.y;tick();maxStep=Math.max(maxStep,Math.hypot(worker.x-x,worker.y-y));}
      check('Halted worker exits the footprint within bounded ordinary movement',surface(worker,building).distance>=worker.innerRadius-1e-5&&maxStep<=worker.speed/22.4+1e-4,{surface:surface(worker,building).distance,maxStep});
      check('Halt pauses construction progress',building.progress===progress);
      check('Smart resumes the unfinished building through the dispatcher',smart(worker,building)&&worker.order?.kind==='build');
      tick(800);check('Resumed construction completes and restores collision',building.ready&&!worker.construction&&!activeConstructionTarget(worker));

      ({worker}=reset());building=place(worker);const plannedFunds=g.money;g.selected=[building];g.running=true;g.action('cancel');g.running=false;tick();
      check('Cancel before contact refunds full cost and removes the plan',g.money===plannedFunds+building.cost&&!g.entities.includes(building)&&!worker.order&&!worker.construction);
      ({worker}=reset());building=place(worker);for(let i=0;i<200&&building.planned;i++)tick();const startedFunds=g.money;
      g.selected=[building];g.running=true;g.action('cancel');g.running=false;tick();
      check('Cancel after contact refunds seventy-five percent and releases the builder',g.money===startedFunds+building.cost*.75&&!g.entities.includes(building)&&!worker.order&&!worker.construction);

      ({worker}=reset());building=place(worker);inside(worker,building);const partial=building.progress;worker.hp=0;tick();
      check('SCV death releases construction ownership without deleting the building',!g.entities.includes(worker)&&building.hp>0&&!building.ready&&!building.builder);
      const replacement=g.spawn('worker',0,700,1100);g.update(0);const resumed=smart(replacement,building);tick(800);
      check('Another SCV Smart-resumes and finishes the partially built structure',resumed&&building.ready&&building.progress===1&&partial>0&&!replacement.construction);

      ({worker,node}=reset());building=place(worker);for(let i=0;i<200&&building.planned;i++)tick();
      let waiting=g.spawn('worker',0,700,1060);g.selected=[waiting];g.running=true;
      g.command(740,1060,false,false,'move');g.command(building.x,building.y,false,true,null,{entity:building});
      g.command(building.x,building.y,false,true,null,{entity:building});g.command(node.x,node.y,false,true,null,{node});g.running=false;
      tick(100);
      check('Sequential Shift-Build orders on an occupied structure retain Build and mining successors',waiting.order?.kind==='build'&&waiting.construction?.phase==='waiting'&&waiting.orders.length===2&&waiting.orders[0].kind==='build'&&waiting.orders[1].kind==='mine');
      check('Waiting builder keeps ordinary collision and does not displace the current owner',building.builder===worker&&!activeConstructionTarget(waiting)&&surface(waiting,building).distance>=waiting.innerRadius-1e-4);
      const beforeWait=building.progress;tick(10);
      check('Occupied waiter cannot double construction progress',Math.abs(building.progress-beforeWait-10/22.4/building.build)<1e-8);
      tick(1100);
      check('Only completion promotes occupied sequential Build orders into mining',building.ready&&!waiting.construction&&(waiting.deliveredTrips||0)>0&&waiting.orders.length===0);

      for(const interruption of ['halt','death']) {
        ({worker,node}=reset());building=place(worker);for(let i=0;i<200&&building.planned;i++)tick();
        waiting=g.spawn('worker',0,700,1060);smart(waiting,building);g.selected=[waiting];g.running=true;
        g.command(node.x,node.y,false,true,null,{node});g.running=false;tick(80);
        if(interruption==='halt'){g.selected=[worker];g.running=true;g.action('halt');g.running=false;}else worker.hp=0;
        tick(15);check('Occupied waiter takes over after owner '+interruption+' without dropping queued mining',building.builder===waiting&&activeConstructionTarget(waiting)&&waiting.orders[0]?.kind==='mine');
        tick(1000);check('Takeover after owner '+interruption+' finishes then mines',building.ready&&!waiting.construction&&(waiting.deliveredTrips||0)>0);
      }

      ({worker}=reset());worker.hp=worker.maxhp=1000;building=place(worker);const entered=inside(worker,building);
      const attacker=g.spawn('worker',1,building.x-80,building.y);attacker.hp=attacker.maxhp=1000;g.issue(attacker,{kind:'attack',target:worker});
      const attack=attacker.order;let retained=true,insideFrames=0,approaches=0;
      for(let i=0;i<120;i++){tick();retained&&=attacker.order===attack&&attacker.order.target===worker;
        if(activeConstructionTarget(worker)&&surface(worker,building).distance<0)insideFrames++;
        if(Math.hypot(attacker.vx,attacker.vy)>1)approaches++;}
      check('Enemy melee retains explicit Attack identity through building-footprint relocation',entered&&insideFrames>0&&retained,{insideFrames,approaches});
      const priorShot=attacker.visualShotSerial||0;for(let i=0;i<700&&!building.ready;i++)tick();tick(150);
      check('Melee resumes real damage after construction worker exits the completed structure',building.ready&&attacker.order===attack&&attacker.visualShotSerial>priorShot,{ready:building.ready,priorShot,shots:attacker.visualShotSerial});
      g.selected=[building,worker];g.camera.x=building.x;g.camera.y=building.y;g.updateHUD();
      return out;
    }''')
    for result in results:
        print(('PASS' if result['pass'] else 'FAIL'), result['name'],
              json.dumps(result.get('detail', '')), flush=True)
    assert not errors, errors
    assert all(result['pass'] for result in results), [result for result in results if not result['pass']]
    artifact = Path(__file__).resolve().parents[1] / 'artifacts' / 'construction-integration.png'
    artifact.parent.mkdir(exist_ok=True)
    page.screenshot(path=str(artifact))
    print(f'{len(results)} construction browser integration checks passed; no browser exceptions.')
    browser.close()
