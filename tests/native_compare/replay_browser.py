"""Replay native feel traces in the browser simulation from identical initial states.

Usage: python3 replay_browser.py NATIVE_DIR OUT_DIR [fixture ...]
Requires the local server on port 8000 (dist/) and Chromium.
Writes browser traces in the native trace format (native game-unit coordinates).
"""
import json, os, shutil, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

REPLAY = r'''async ([trace,tuning])=>{if(tuning){const mv=await import('./movement.js');for(const [k,v] of Object.entries(tuning)){if(k==='FORCE.targets')continue;const [o,f]=k.split('.');mv[o][f]=v;}}const g=__game,S=28,CX=44,CY=42,BX=1050,BY=700;
const toB=(x,y)=>({x:(x-CX)*S+BX,y:(CY-y)*S+BY}),toN=e=>[(e.x-BX)/S+CX,CY-(e.y-BY)/S];
g.reset();g.start();g.running=false;g.aiEnabled=false;g.revealAll=true;g.entities.splice(0);g.minerals.splice(0);g.rocks.splice(0);g.selected=[];g.invalidateNav();
const TYPE={Marine:'marine',SCV:'worker',Marauder:'marauder',Reaper:'reaper',Hellion:'hellion',SiegeTank:'tank',SiegeTankSieged:'tank',SupplyDepot:'relay'};
const {SIEGE_WEAPON}=await import('./unit-profiles.js');
const f0=trace.frames[0].units,byTag=new Map(),groups={};
// Keep buildings far away so the game does not end: one per team in a corner.
g.spawn('core',0,150,1250);g.spawn('core',1,1950,150);
for(const m of trace.units){const n=f0[m.tag];if(!n&&m.type!=='SupplyDepot')continue;const p=n?toB(n.x,n.y):toB(...m.requested);
 const e=g.spawn(TYPE[m.type],m.owner===1?0:1,p.x,p.y);if(!e.building){e.x=p.x;e.y=p.y;e.px=e.x;e.py=e.y;e.angle=e.pangle=-(n?.facing??0);}
 if(m.hold)g.stop(e,true);
 // Native debug spawn creates an already sieged tank; mirror the completed transform.
 if(m.type==='SiegeTankSieged'){e.sieged=true;e.hold=true;e.turretAngle=e.angle+Math.PI;e.range=SIEGE_WEAPON.range;e.damage=SIEGE_WEAPON.damage;e.cool=SIEGE_WEAPON.period;}if(n){e.hp=n.hp;e.cooldown=(n.cd||0)/22.4;}byTag.set(m.tag,e);(groups[m.group]??=[]).push(e);}
g.invalidateNav();
// Native scans run when game_loop % 8 == unit index % 8 (index = tag >> 18).
// Browser loop L+1+T0 plays native step L -> L+1, whose results the native
// observes at game_loop G0+L+1; the browser acts on them one loop later.
const G0=trace.frames[0].game_loop,T0=g.readState().loop;
if(G0!==undefined)for(const [tag,e] of byTag){const idx=Number(BigInt(tag)>>18n);e.scanPhase=(((G0-idx-1-T0)%8)+8)%8;}
// Older traces lack game_loop: infer the slot from the first target a unit
// takes without having been hit on that loop (a scan, not a retaliation).
else for(const [tag,e] of byTag){const fs=trace.frames;for(let i=1;i<fs.length;i++){const u=fs[i].units[tag],v=fs[i-1].units[tag];
 if(!u||!v)break;if(u.target&&!v.target&&u.hp>=v.hp){e.scanPhase=(((-(fs[i].loop+1+T0))%8)+8)%8;break;}if(v.target)break;}}
// State-matched start: copy each unit's native engaged target.
for(const m of trace.units){const n=f0[m.tag],e=byTag.get(m.tag);if(n?.target&&byTag.has(String(n.target)))e.combatTarget=byTag.get(String(n.target));}
const frames=[],dt=1/22.4;
const fire=([loop,ability,who,where])=>{const units=(Array.isArray(who)?who:[who]).flatMap(k=>groups[k]||[]);
 if(ability==='kill'){for(const u of units)u.hp=0;return;}
 const team=units[0].team;const point=typeof where==='string'?null:toB(where[0],where[1]),target=typeof where==='string'?groups[where][0]:null;
 // Raw point commands never smart-target a unit near the point, so issue
 // the resolved orders through the shared group path (one batch per command).
 const order=u=>target?{kind:ability==='attack'?'attack':'follow',target}:ability==='attack'?{kind:'attackMove',x:point.x,y:point.y}:
  ability==='patrol'?{kind:'patrol',x:point.x,y:point.y,origin:{x:u.x,y:u.y},out:true}:{kind:ability,x:point.x,y:point.y};
 if(ability==='kill'){for(const u of units)u.hp=0;return;}
 g.issueGroup(units.map(u=>({u,o:order(u)})),point||target,false);};
// Debug kills resolve a few loops after the request natively; kill on the
// loop before the victim first disappears from the native observations.
const killLoop=c=>{const victims=(Array.isArray(c[2])?c[2]:[c[2]]).flatMap(k=>trace.units.filter(m=>m.group===k).map(m=>m.tag));
 const gone=trace.frames.find(f=>f.loop>c[0]&&victims.every(t=>!f.units[t]));return gone?gone.loop-1:c[0];};
const byLoop=new Map();for(const c of trace.commands){const l=c[1]==='kill'?killLoop(c):c[0];byLoop.set(l,[...(byLoop.get(l)||[]),c]);}
const snap=()=>{const units={};for(const [tag,e] of byTag){if(e.hp<=0||e.building)continue;const [x,y]=toN(e);
  units[tag]={x,y,r:e.r/S,facing:-e.angle,hp:e.hp,cd:(e.cooldown||0)*22.4,target:e.combatTarget?[...byTag].find(([,v])=>v===e.combatTarget)?.[0]??null:null,
   orders:e.order?[[e.order.kind]]:[],moving:Math.hypot(e.vx,e.vy)/S}}return units};
const loops=trace.frames.length-1;
for(let l=0;l<=loops;l++){frames.push({loop:l,units:snap()});if(l===loops)break;for(const c of byLoop.get(l)||[])fire(c);
 // Diagnostic: FORCE.targets copies each native engaged target every loop,
 // isolating approach/firing movement from acquisition differences.
 if(tuning?.['FORCE.targets'])for(const [tag,e] of byTag){const n=trace.frames[l].units[tag],t=n?.target&&byTag.get(String(n.target));if(e.hp>0&&t&&t.hp>0)e.combatTarget=t;}
 g.update(dt);}
return {fixture:trace.fixture,engine:'browser',units:trace.units,commands:trace.commands,frames};}'''

def align_commands(trace):
    """Fire each browser command on the loop its native order first appears.

    Native raw commands from the two-client lockstep setup surface as orders
    two loops later; the browser applies a command within the same update.
    """
    groups = {}
    for m in trace['units']:
        groups.setdefault(m['group'], []).append(m['tag'])
    aligned = []
    for command in trace['commands']:
        loop, ability, who = command[0], command[1], command[2]
        tags = sum((groups.get(g, []) for g in ([who] if isinstance(who, str) else who)), [])
        fire = loop
        if ability != 'kill':
            for frame in trace['frames']:
                if frame['loop'] <= loop:
                    continue
                prev = trace['frames'][frame['loop']-1]['units']
                if any(t in frame['units'] and t in prev and frame['units'][t]['orders'] != prev[t]['orders'] for t in tags):
                    fire = frame['loop']; break
        aligned.append([fire]+list(command[1:]))
    trace['commands'] = aligned


SUPPORTED = {'Marine', 'SCV', 'Marauder', 'Reaper', 'Hellion', 'SiegeTank', 'SiegeTankSieged', 'SupplyDepot'}

if __name__ == '__main__':
    native, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    names = sys.argv[3:] or sorted(p.stem for p in native.glob('*.json'))
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium',
                                    headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
        page = browser.new_page(); errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:'+os.environ.get('PORT', '8000')+'/?debug'); page.wait_for_function('window.__game')
        for name in names:
            trace = json.loads((native/(name+'.json')).read_text())
            align_commands(trace)
            if any(m['type'] not in SUPPORTED for m in trace['units']):
                print('skipped', name, '(unit type not in the browser subset)'); continue
            result = page.evaluate(REPLAY, [trace, json.loads(os.environ['TUNING']) if os.environ.get('TUNING') else None])
            (out/(name+'.json')).write_text(json.dumps(result))
            print('replayed', name, flush=True)
        if errors:
            print('BROWSER ERRORS', errors)
        browser.close()
