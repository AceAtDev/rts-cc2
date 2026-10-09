"""Capture flat prototype Move traces; these are never native-client evidence."""
import argparse,hashlib,json,shutil,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--native-directory',type=Path,help='Optional private native fixtures supply actual initial headings, without shifting time');args=parser.parse_args()
headings={}
if args.native_directory:
 for file in args.native_directory.glob('*-move*.jsonl'):
  if file.stem.rsplit('move',1)[-1] not in ['1','2','5','10','20']:continue
  rows=[json.loads(line) for line in file.read_text().splitlines()];frame=next(r for r in rows if r.get('kind')=='frame' and r['loop']==0)
  type_=file.stem.split('-')[0];type_={'scv':'worker','siegetank':'tank'}.get(type_,type_);distance=int(file.stem.rsplit('move',1)[-1]);headings[f'{type_}-{distance}']=frame['units']['unit']['facing']
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':800,'height':600});page.goto('http://127.0.0.1:8000/?debug');page.wait_for_function('window.__game')
 traces=page.evaluate('''headings=>{const g=__game,out=[];for(const [type,distance] of [...[1,2,5,10,20].map(d=>['worker',d]),...['marine','marauder','reaper','hellion','tank'].map(t=>[t,10])]){g.reset();g.start();g.running=false;g.aiEnabled=false;g.entities.splice(0,g.entities.length);g.minerals.splice(0,g.minerals.length);g.invalidateNav();const u=g.spawn(type,0,700,1100),start={x:u.x,y:u.y},frames=[];u.angle=u.pangle=-(headings[type+'-'+distance]??0);g.issue(u,{kind:'move',x:u.x+distance*28,y:u.y});for(let loop=0;loop<=180;loop++){frames.push({loop,x:(u.x-start.x)/28,y:(start.y-u.y)/28,facing:-u.angle,speed:Math.hypot(u.vx,u.vy)/28,order:u.order?.kind??null});if(loop<180)g.update(1/22.4)}out.push({type,distanceGameUnits:distance,frames})}return{engine:'custom-browser-prototype',simulationHz:22.4,acknowledgement:'Immediate issue before frame0; processing begins loop1',facingConvention:'Game radians; prototype world Y points down, facing negated on capture',traces:out}}''',headings);b.close()
root=Path(__file__).resolve().parents[2]
traces['sourceCommit']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
traces['sourceSha256']={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['dist/game.js','dist/movement.js','dist/combat.js','dist/workers.js','dist/unit-profiles.js','dist/game-loop.js']}
args.output.parent.mkdir(parents=True,exist_ok=True)
with args.output.open('x') as f:json.dump(traces,f,indent=2)
for trace in traces['traces']:
 frames=trace['frames'];arrived=next((f['loop'] for f in frames if f['order'] is None),None);print(trace['type'],trace['distanceGameUnits'],json.dumps({'loop1':frames[1],'arrivalLoop':arrived,'final':frames[-1]}))
