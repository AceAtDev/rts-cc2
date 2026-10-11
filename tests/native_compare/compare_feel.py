"""Compare native and browser feel traces: metrics plus side-by-side filmstrips.

Usage: python3 compare_feel.py NATIVE_DIR BROWSER_DIR OUT_DIR [fixture ...]
"""
import json, math, sys
from pathlib import Path

COLORS = {1: (110, 190, 255), 2: (255, 95, 95)}


def load(path):
    return json.loads(Path(path).read_text())


def done_loop(trace, tag, native):
    """First loop after which the unit has no order for the rest of the trace (None if never)."""
    last = None
    for f in trace['frames']:
        u = f['units'].get(tag)
        if u is None:
            continue
        busy = bool(u['orders']) and not (native and all(o[0] in (18,) for o in u['orders']))
        if busy:
            last = None
        elif last is None:
            last = f['loop']
    return last


def metrics(native, browser):
    tags = [m['tag'] for m in native['units'] if m['type'] != 'SupplyDepot']
    errs, finals = [], []
    for nf, bf in zip(native['frames'], browser['frames']):
        e = [math.dist((nf['units'][t]['x'], nf['units'][t]['y']), (bf['units'][t]['x'], bf['units'][t]['y']))
             for t in tags if t in nf['units'] and t in bf['units']]
        errs.append(sum(e)/len(e) if e else 0)
    nl, bl = native['frames'][-1]['units'], browser['frames'][-1]['units']
    finals = [math.dist((nl[t]['x'], nl[t]['y']), (bl[t]['x'], bl[t]['y'])) for t in tags if t in nl and t in bl]
    nd = [done_loop(native, t, True) for t in tags]
    bd = [done_loop(browser, t, False) for t in tags]
    hp = lambda tr, owner: sum(u['hp'] for t, u in tr['frames'][-1]['units'].items()
                               if any(m['tag'] == t and m['owner'] == owner for m in tr['units']))
    return {'mean_err': round(sum(errs)/len(errs), 3), 'max_mean_err': round(max(errs), 3),
            'final_err': round(sum(finals)/max(1, len(finals)), 3),
            'native_done': max((d for d in nd if d is not None), default=None), 'native_never': nd.count(None),
            'browser_done': max((d for d in bd if d is not None), default=None), 'browser_never': bd.count(None),
            'alive': [len(nl), len(bl)], 'hp1': [round(hp(native, 1)), round(hp(browser, 1))],
            'hp2': [round(hp(native, 2)), round(hp(browser, 2))]}


def filmstrip(native, browser, out, snaps=8):
    from PIL import Image, ImageDraw
    tags = [m['tag'] for m in native['units']]
    owner = {m['tag']: m['owner'] for m in native['units']}
    radius = {m['tag']: 0.375 for m in native['units']}
    for f in native['frames']:
        for t, u in f['units'].items():
            radius[t] = u.get('r') or radius[t]
    pts = [(u['x'], u['y']) for tr in (native, browser) for f in tr['frames'] for u in f['units'].values()]
    x0, x1 = min(p[0] for p in pts)-1.5, max(p[0] for p in pts)+1.5
    y0, y1 = min(p[1] for p in pts)-1.5, max(p[1] for p in pts)+1.5
    W = 300; scale = W/(x1-x0); H = int((y1-y0)*scale)+18
    loops = len(native['frames'])-1
    picks = sorted({round(loops*i/(snaps-1)) for i in range(snaps)})
    img = Image.new('RGB', (W*len(picks), 2*H+4), (17, 17, 17)); d = ImageDraw.Draw(img)
    depots = [m for m in native['units'] if m['type'] == 'SupplyDepot']
    for row, tr in enumerate((native, browser)):
        for col, loop in enumerate(picks):
            ox, oy = col*W, row*(H+4)
            d.rectangle([ox+1, oy+18, ox+W-2, oy+H-1], fill=(29, 34, 40))
            d.text((ox+4, oy+3), f"{'NATIVE' if row == 0 else 'BROWSER'} loop {loop} ({loop/22.4:.2f}s)", fill=(220, 220, 220))
            P = lambda x, y: (ox+(x-x0)*scale, oy+18+(y1-y)*scale)
            for m in depots:
                a, b = P(m['requested'][0]-1, m['requested'][1]+1); c, e = P(m['requested'][0]+1, m['requested'][1]-1)
                d.rectangle([a, b, c, e], fill=(85, 85, 85))
            for f in tr['frames'][max(0, loop-30):loop+1:3]:
                for t, u in f['units'].items():
                    a, b = P(u['x'], u['y']); col_ = COLORS.get(owner.get(t), (200, 200, 200))
                    d.point((a, b), fill=tuple(c//3 for c in col_))
            for t, u in tr['frames'][loop]['units'].items():
                if owner.get(t) is None:
                    continue
                a, b = P(u['x'], u['y']); r = radius[t]*scale; c = COLORS[owner[t]]
                if not u['orders']:
                    c = (120, 240, 120) if owner[t] == 1 else c
                d.ellipse([a-r, b-r, a+r, b+r], outline=c)
                d.line([a, b, a+math.cos(u['facing'])*r*1.4, b-math.sin(u['facing'])*r*1.4], fill=c)
                if u.get('target'):
                    d.rectangle([a-1, b-1, a+1, b+1], fill=(255, 170, 0))
    img.save(out)


if __name__ == '__main__':
    nd, bd, od = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]); od.mkdir(parents=True, exist_ok=True)
    names = sys.argv[4:] or sorted(p.stem for p in bd.glob('*.json'))
    for name in names:
        n, b = load(nd/(name+'.json')), load(bd/(name+'.json'))
        print(name.ljust(22), json.dumps(metrics(n, b)), flush=True)
        filmstrip(n, b, od/(name+'.png'))
