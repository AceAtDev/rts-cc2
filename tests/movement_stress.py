from playwright.sync_api import sync_playwright
from pathlib import Path
import shutil

ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
BROWSER = shutil.which("chromium") or shutil.which("chromium-browser")
BROWSER_OPTIONS = {"executable_path": BROWSER} if BROWSER else {}
import json
with sync_playwright() as p:
 b=p.chromium.launch(**BROWSER_OPTIONS,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);pg=b.new_page(viewport={'width':1280,'height':800});pg.goto('http://127.0.0.1:8000/?debug');pg.wait_for_function('window.__game');print(json.dumps(pg.evaluate('''()=>{const g=__game;g.start();for(let i=g.entities.length-1;i>=0;i--)if(g.entities[i].team)g.entities.splice(i,1);for(const u of g.entities.filter(e=>!e.building))g.stop(u,true);const pack=[];for(let i=0;i<120;i++)pack.push(g.spawn('marine',0,570+i%12*24,550+Math.floor(i/12)*24));g.selected=pack;const orders=[[1150,750],[600,970],[1170,1000],[700,600],[1050,800]],timings=[],commandTimes=[];for(const [x,y] of orders){let t=performance.now();g.command(x,y,false,false,'move');commandTimes.push(performance.now()-t);for(let i=0;i<120;i++){t=performance.now();g.update(1/60);timings.push(performance.now()-t)}}g.running=false;timings.sort((a,b)=>a-b);return{units:pack.length,meanMs:timings.reduce((a,b)=>a+b,0)/timings.length,p95Ms:timings[Math.floor(timings.length*.95)],worstMs:timings.at(-1),commandTimes,pageErrors:0}}'''),indent=2));b.close()
