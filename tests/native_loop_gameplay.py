"""Gameplay regressions at the documented SC2 Faster simulation frequency.

Run against the existing local server. These check gameplay at 22.4 Hz;
they do not compare proprietary native scheduling, RNG, or human input traces.
"""
import json
import shutil
from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    browser_path = shutil.which("chromium") or shutil.which("chromium-browser")
    options = {"executable_path": browser_path} if browser_path else {}
    browser = playwright.chromium.launch(
        **options,
        headless=True,
        args=["--no-sandbox", "--enable-unsafe-swiftshader"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8000/?debug")
    page.wait_for_function("window.__game")
    results = page.evaluate("""async () => {
      const g=__game, {SIMULATION_STEP,createGameLoop}=await import('./game-loop.js');
      const {HARVEST}=await import('./workers.js');
      const dt=1/22.4, out=[];
      const check=(name,pass,detail={})=>out.push({name,pass:!!pass,detail});
      const tick=n=>{for(let i=0;i<n;i++)g.update(dt)};
      const seconds=n=>tick(Math.ceil(n/dt));
      const until=(predicate,limit=1000)=>{
        let ticks=0;
        while(!predicate()&&ticks<limit){g.update(dt);ticks++}
        return {met:!!predicate(),ticks};
      };
      const reset=(retainWorkers=false)=>{
        g.reset();g.start();g.running=false;g.aiEnabled=false;
        for(let i=g.entities.length-1;i>=0;i--){
          const e=g.entities[i];
          if(!e.building&&!retainWorkers)g.entities.splice(i,1);
          else if(!e.building&&e.team)g.stop(e,true);
        }
        g.money=10000;g.gas=10000;g.invalidateNav();
      };
      const dummy=(type,x,y,hp=1000)=>{
        const e=g.spawn(type,1,x,y);e.hp=e.maxhp=hp;e.damage=0;g.stop(e,true);return e;
      };
      const command=(units,x,y,kind='move')=>{
        g.selected=units;g.running=true;g.command(x,y,false,false,kind);g.running=false;
      };

      reset();const loop=createGameLoop();
      const timeBefore=g.time;
      let elapsed=0;
      for(let i=0;i<60;i++){loop.advance(1/60,step=>g.update(step));elapsed+=1/60;}
      check('Live scheduling uses 22.4 Faster loops while accepting 60 Hz display intervals',
        Math.abs(SIMULATION_STEP-dt)<1e-12&&Math.abs(g.time-22*dt)<1e-8&&
        Math.abs(g.time+loop.state.debt-elapsed)<1e-8,
        {step:SIMULATION_STEP,time:g.time,debt:loop.state.debt,timeBefore});

      reset();let marine=g.spawn('marine',0,700,1040);
      let worker=g.spawn('worker',0,700,1140);
      g.issue(marine,{kind:'move',x:1000,y:1040});
      g.issue(worker,{kind:'move',x:1000,y:1140});tick(1);
      check('Infantry moves at Faster speed on its first native-rate update',
        Math.abs(marine.x-700-88.2*dt)<1e-7,{x:marine.x,vx:marine.vx});
      check('Worker acceleration remains gradual at the native-rate step',
        worker.vx>0&&worker.vx<worker.speed/4,{vx:worker.vx,speed:worker.speed});
      const forward=marine.x;g.issue(marine,{kind:'move',x:600,y:1040});tick(1);
      check('Reversing infantry responds on the next native-rate update',
        marine.x<forward&&marine.vx<0,{x:marine.x,vx:marine.vx});

      reset();marine=g.spawn('marine',0,700,1040);
      let target=dummy('marine',870,1040);g.stop(marine,true);seconds(1);
      check('Hold retains its position when a target is just beyond weapon range',
        marine.x===700&&marine.y===1040&&target.hp===1000,{x:marine.x,hp:target.hp});
      g.issue(marine,{kind:'move',x:1000,y:1040});seconds(2);
      check('Explicit Move passes enemies without automatic attack',target.hp===1000);

      reset();marine=g.spawn('marine',0,700,1040);target=dummy('marine',800,1040);
      g.issue(marine,{kind:'attack',target});g.issue(marine,{kind:'move',x:600,y:1040});tick(8);
      check('Replacing a Marine attack before its simulation update cancels the shot',target.hp===1000);
      reset();marine=g.spawn('marine',0,700,1040);target=dummy('marine',800,1040);
      g.issue(marine,{kind:'attack',target});until(()=>target.hp<1000,20);
      const firstShotTime=g.time, firstHp=target.hp, cooldown=marine.cooldown;
      g.issue(marine,{kind:'move',x:695,y:1040});tick(1);
      check('Moving after a Marine shot preserves the existing weapon period',
        cooldown>0&&marine.cooldown>0&&Math.abs(marine.cooldown-(cooldown-dt))<1e-7,
        {cooldown,after:marine.cooldown});
      g.issue(marine,{kind:'attack',target});
      tick(Math.max(0,Math.floor(marine.weapon.period/dt)-3));
      const heldPeriod=target.hp===firstHp;
      const resumed=until(()=>target.hp<firstHp,10), interval=g.time-firstShotTime;
      check('Repeated Marine commands cannot fire twice inside the weapon period',
        heldPeriod&&resumed.met&&interval>=marine.weapon.period-1e-8&&
        interval<=marine.weapon.period+2*dt+1e-8,
        {interval,period:marine.weapon.period,hp:target.hp});

      reset();worker=g.spawn('worker',0,700,1040);target=dummy('marine',722,1040);
      g.issue(worker,{kind:'attack',target});tick(1);
      const workerPending=!!worker.windup&&target.hp===1000;
      g.issue(worker,{kind:'move',x:600,y:1040});tick(6);
      check('SCV melee windup remains cancelable across native-rate updates',
        workerPending&&target.hp===1000,{hp:target.hp});

      reset();let marauder=g.spawn('marauder',0,700,1040);target=dummy('marine',800,1040);
      g.issue(marauder,{kind:'attack',target});tick(1);
      check('Marauder damage waits for grenade flight at the native rate',target.hp===1000);
      g.issue(marauder,{kind:'move',x:600,y:1040});const grenade=until(()=>target.hp<1000,20);
      check('A launched Marauder grenade still lands after its source moves',
        grenade.met&&target.hp===990,{hp:target.hp});

      reset();let reaper=g.spawn('reaper',0,700,1040);target=dummy('marauder',800,1040,125);
      g.issue(reaper,{kind:'attack',target});tick(1);
      const pistolOne=target.hp===122;tick(2);
      check('Reaper pistols remain separate armor-adjusted hits at the native rate',
        pistolOne&&target.hp===119,{hp:target.hp});

      reset();let hellion=g.spawn('hellion',0,700,1040);target=dummy('marine',800,1040,45);
      g.issue(hellion,{kind:'attack',target});tick(1);
      const flamePending=!!hellion.windup&&target.hp===45;
      g.issue(hellion,{kind:'move',x:600,y:1040});tick(8);
      check('Hellion windup can be canceled before its damage point',flamePending&&target.hp===45);
      reset();hellion=g.spawn('hellion',0,700,1040);target=dummy('marine',800,1040,45);
      const behind=dummy('marine',850,1040,45), offLine=dummy('marine',850,1085,45);
      g.issue(hellion,{kind:'attack',target});until(()=>target.hp<45,20);
      check('Hellion flame retains its line and Light bonus at the native rate',
        target.hp===31&&behind.hp===31&&offLine.hp===45,
        {hp:[target.hp,behind.hp,offLine.hp]});

      reset();let tank=g.spawn('tank',0,700,1040);target=dummy('marine',800,1040);
      g.issue(tank,{kind:'attack',target});tick(1);
      const tankPending=!!tank.windup&&target.hp===1000;
      g.issue(tank,{kind:'move',x:600,y:1040});tick(8);
      check('Tank-mode shot is canceled by movement during its windup',tankPending&&target.hp===1000);
      reset();tank=g.spawn('tank',0,700,1040);tank.sieged=true;tank.hold=true;tank.damage=40;
      target=dummy('marine',740,1040);seconds(2);
      check('Siege minimum range still rejects nearby targets at the native rate',target.hp===1000);

      reset();const mineral=g.minerals[3],mineralHome=g.entities.find(e=>e.type==='core'&&!e.team);worker=g.spawn('worker',0,mineralHome.x+100,mineralHome.y);
      g.issue(worker,{kind:'mine',node:mineral});const reachedMineral=until(()=>worker.order?.phase==='harvest',200);
      const mineralStart=g.time;let simultaneous=0;
      const mineralHarvest=until(()=>{
        simultaneous=Math.max(simultaneous,g.entities.filter(e=>e.harvestResource===worker.order?.node).length);
        return worker.carry>0;
      },100);
      const mineralElapsed=g.time-mineralStart, mineralDuration=HARVEST.mineralTime+HARVEST.returnDelay;
      check('Mineral harvesting uses Faster real time with at most one tick of quantization',
        reachedMineral.met&&mineralHarvest.met&&worker.carry===5&&
        mineralElapsed>=mineralDuration-1e-8&&mineralElapsed<=mineralDuration+dt+1e-8,
        {elapsed:mineralElapsed,duration:mineralDuration,cargo:worker.carry});
      check('A mineral field has one active harvest owner at the native rate',simultaneous===1);
      const mineralWallet=g.money;const delivered=until(()=>worker.deliveredTrips>=1,300);
      check('Mineral cargo deposits exactly its gathered amount',
        delivered.met&&g.money===mineralWallet+5&&worker.carry===0,{money:g.money});

      reset();const geyser=g.geysers[0],refinery=g.spawn('refinery',0,geyser.x,geyser.y);
      refinery.geyser=geyser;worker=g.spawn('worker',0,geyser.x+75,geyser.y);
      g.issue(worker,{kind:'gas',target:refinery});const enteredGas=until(()=>worker.order?.phase==='harvest',200);
      const hidden=worker.insideRefinery===refinery, gasStart=g.time;
      const gasHarvest=until(()=>worker.carry>0,100),gasElapsed=g.time-gasStart;
      const gasDuration=HARVEST.gasTime+HARVEST.gasReturnDelay;
      check('Gas harvesting uses Faster real time with at most one tick of quantization',
        enteredGas.met&&gasHarvest.met&&worker.carry===4&&worker.carryGas&&
        gasElapsed>=gasDuration-1e-8&&gasElapsed<=gasDuration+dt+1e-8,
        {elapsed:gasElapsed,duration:gasDuration,cargo:worker.carry});
      check('Gas workers are hidden only during extraction and release the harvest slot',
        hidden&&!worker.insideRefinery&&!worker.harvestResource&&!refinery.harvester);
      const gasWallet=g.gas;const gasDelivered=until(()=>worker.deliveredTrips>=1,400);
      check('Gas cargo deposits exactly its gathered amount',
        gasDelivered.met&&g.gas===gasWallet+4&&worker.carry===0,{gas:g.gas});

      reset(true);seconds(50);
      const startingWorkers=g.entities.filter(e=>!e.team&&e.type==='worker');
      check('All twelve opening workers complete multiple trips under native-rate scheduling',
        startingWorkers.length===12&&startingWorkers.every(e=>e.deliveredTrips>=3),
        {trips:startingWorkers.map(e=>e.deliveredTrips||0)});

      reset();const depot=g.spawn('relay',0,730,1000,false);
      worker=g.spawn('worker',0,680,1000);depot.builder=worker;
      g.issue(worker,{kind:'build',target:depot});until(()=>depot.progress>0,200);
      const constructionStart=g.time-dt;until(()=>depot.progress>.3,300);depot.hp-=80;
      const completed=until(()=>depot.ready,1000), constructionElapsed=g.time-constructionStart;
      check('Construction completes within native-tick quantization while preserving damage',
        completed.met&&constructionElapsed>=depot.build-1e-8&&constructionElapsed<=depot.build+dt+1e-8&&
        Math.abs(depot.hp-(depot.maxhp-80))<1e-6,
        {elapsed:constructionElapsed,duration:depot.build,hp:depot.hp});

      reset();const barracks=g.spawn('barracks',0,730,1000);
      g.running=true;const trained=g.train('marine',barracks);g.running=false;
      const trainingStart=g.time,production=until(()=>g.entities.some(e=>!e.team&&e.type==='marine'),1000);
      const trainingElapsed=g.time-trainingStart;
      check('Unit production honors real build duration at native-rate boundaries',
        trained&&production.met&&trainingElapsed>=SC2.defs.marine.train-1e-8&&
        trainingElapsed<=SC2.defs.marine.train+dt+1e-8,
        {elapsed:trainingElapsed,duration:SC2.defs.marine.train});
      const home=g.entities.find(e=>!e.team&&e.type==='core');
      g.running=true;const workerTrained=g.train('worker',home);g.running=false;
      const newborn=until(()=>g.entities.some(e=>!e.team&&e.type==='worker'),1000);
      const rallied=g.entities.find(e=>!e.team&&e.type==='worker');
      check('A newly produced SCV receives its producer resource rally at the native rate',
        workerTrained&&newborn.met&&rallied.order?.kind==='mine'&&!!rallied.order.node);

      reset();const routed=[];
      for(let i=0;i<24;i++)routed.push(g.spawn('marine',0,670+i%6*24,570+Math.floor(i/6)*24));
      command(routed,1140,700);seconds(16);
      check('A commanded squad routes around the central rock at the native rate',
        routed.filter(e=>!e.order).length>=22&&routed.every(e=>g.nav.open(e,e.r)),
        {arrived:routed.filter(e=>!e.order).length});
      reset();const crowd=[];
      for(let i=0;i<120;i++)crowd.push(g.spawn('marine',0,580+i%12*24,940+Math.floor(i/12)*24));
      command(crowd,1050,1200);seconds(25);
      check('A 120-unit command retains finite reachable placement at the native rate',
        crowd.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.vx)&&
          Number.isFinite(e.vy)&&g.nav.open(e,e.r))&&crowd.filter(e=>!e.order).length>=80,
        {arrived:crowd.filter(e=>!e.order).length,total:crowd.length});
      const anchored=crowd[0],anchor={x:anchored.x,y:anchored.y};g.stop(anchored,true);
      command(crowd.slice(1),1180,1200);seconds(5);
      check('Native-rate crowd motion leaves a Hold unit anchored',
        Math.hypot(anchored.x-anchor.x,anchored.y-anchor.y)<1e-8);
      return out;
    }""")
    for result in results:
        print(
            "PASS" if result["pass"] else "FAIL",
            result["name"],
            json.dumps(result.get("detail", {})),
        )
    assert not errors, errors
    assert all(result["pass"] for result in results), [
        result for result in results if not result["pass"]
    ]
    print(f"{len(results)} native-rate gameplay checks passed; no browser exceptions.")
    browser.close()
