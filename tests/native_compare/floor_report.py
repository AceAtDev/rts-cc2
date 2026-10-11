"""Score fixtures against SC2's own noise floor.

For every fixture `name` with a nudged native twin `jit_name` (all start
positions moved by 0.01), the floor is the native-vs-native mean error. A
fixture passes when the browser error is at most max(1.25 * floor, 0.15).

Usage: python3 floor_report.py [--port 8000] [--native DIR] [--out DIR] [--seeds 1474,1,2]
Browser errors are averaged over the listed weapon random-delay seeds.
"""
import argparse, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from compare_feel import metrics, load  # noqa: E402
from feel_check import score  # noqa: E402


def floor(native_dir, name):
    a, b = load(Path(native_dir)/f'{name}.json'), load(Path(native_dir)/f'jit_{name}.json')
    mapping = dict(zip([m['tag'] for m in b['units']], [m['tag'] for m in a['units']]))
    for f in b['frames']:
        f['units'] = {mapping.get(k, k): v for k, v in f['units'].items()}
    b['units'] = a['units']
    return metrics(a, b)['mean_err']


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8000)
    p.add_argument('--native', default='/home/user/native-sc2/traces')
    p.add_argument('--out', default='/home/user/native-sc2/browser')
    p.add_argument('--seeds', default='1474')
    a = p.parse_args()
    names = sorted(f.stem[4:] for f in Path(a.native).glob('jit_*.json') if (Path(a.native)/f'{f.stem[4:]}.json').exists())
    names = [n for n in names if not n.startswith('jit_')]
    seeds = [int(s) for s in a.seeds.split(',')]
    errs = {n: 0.0 for n in names}
    for seed in seeds:
        rows = score(a, names, a.out, {'WEAPON.seed': seed})
        for n in names:
            errs[n] += rows[n]['mean_err']/len(seeds) if n in rows else float('nan')
    passed = 0
    print(f"{'fixture':30} {'floor':>7} {'target':>7} {'browser':>8}  result")
    for n in names:
        fl = floor(a.native, n); target = max(1.25*fl, .15); ok = errs[n] <= target
        passed += ok
        print(f"{n:30} {fl:7.3f} {target:7.3f} {errs[n]:8.3f}  {'PASS' if ok else 'MISS'}")
    print(f'{passed}/{len(names)} fixtures within SC2 noise floor')
