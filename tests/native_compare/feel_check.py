"""Replay native feel traces in the browser and score them against native.

Usage:
  python3 feel_check.py [--port 8000] [--native DIR] [--out DIR] [--images DIR]
                        [--tune JSON] [--sweep JSON] [fixture ...]

--tune  JSON object of module tunables, e.g. '{"ARRIVAL.spread":1.5}'.
--sweep JSON object of lists; every combination is scored and ranked.
Fixtures default to every native trace whose unit types the browser supports.
Lower mean_err (game units, averaged over units and loops) is better.
"""
import argparse, itertools, json, os, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compare_feel import metrics, load, filmstrip  # noqa: E402


def replay(args, names, out, tune=None):
    env = dict(os.environ, PORT=str(args.port))
    if tune:
        env['TUNING'] = json.dumps(tune)
    run = subprocess.run([sys.executable, str(HERE/'replay_browser.py'), args.native, str(out)]+names,
                         env=env, capture_output=True, text=True)
    if 'Error' in run.stdout+run.stderr:
        print(run.stdout[-2000:], run.stderr[-2000:])
    return {n: load(Path(out)/(n+'.json')) for n in names if (Path(out)/(n+'.json')).exists()}


def score(args, names, out, tune=None, images=None):
    browser = replay(args, names, out, tune)
    rows = {}
    for n, b in browser.items():
        native = load(Path(args.native)/(n+'.json'))
        rows[n] = metrics(native, b)
        if images:
            Path(images).mkdir(parents=True, exist_ok=True)
            filmstrip(native, b, Path(images)/(n+'.png'))
    return rows


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8000)
    p.add_argument('--native', default='/home/user/native-sc2/traces')
    p.add_argument('--out', default='/home/user/native-sc2/browser')
    p.add_argument('--images', default=None)
    p.add_argument('--tune', default=None)
    p.add_argument('--sweep', default=None)
    p.add_argument('fixtures', nargs='*')
    a = p.parse_args()
    names = a.fixtures or sorted(f.stem for f in Path(a.native).glob('*.json'))
    if a.sweep:
        grid = json.loads(a.sweep); base = json.loads(a.tune) if a.tune else {}
        results = []
        for combo in itertools.product(*grid.values()):
            tune = {**base, **dict(zip(grid, combo))}
            rows = score(a, names, a.out, tune)
            total = sum(r['mean_err'] for r in rows.values())
            results.append((total, tune, {n: r['mean_err'] for n, r in rows.items()}))
            print(round(total, 3), json.dumps(tune), flush=True)
        results.sort(key=lambda r: r[0])
        print('BEST', json.dumps(results[0]))
    else:
        rows = score(a, names, a.out, json.loads(a.tune) if a.tune else None, a.images)
        for n, m in rows.items():
            print(f"{n:28} err {m['mean_err']:6.3f} max {m['max_mean_err']:6.3f} fin {m['final_err']:6.3f} "
                  f"done n/b {m['native_done']}/{m['browser_done']} alive {m['alive']} hp1 {m['hp1']} hp2 {m['hp2']}")
        print('TOTAL mean err', round(sum(m['mean_err'] for m in rows.values()), 3), 'over', len(rows))
