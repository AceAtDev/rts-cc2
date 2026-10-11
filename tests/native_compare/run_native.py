"""Capture tests/native_compare/feel_fixtures.py in the native client.

Usage: python3 run_native.py OUTDIR [fixture ...]
Traces (JSON) are written outside the repository; see native_lab.py.
"""
import json, sys, time
from pathlib import Path
from native_lab import NativeLab
from feel_fixtures import FIXTURES

SETTLE = 1  # loop after spawning/holding before relative loop 0 (state is copied by replay)


def run(lab, name, spec, outdir):
    lab.clear()
    groups, meta = {}, []
    for group in spec['units']:
        label, kind, owner, points = group[:4]
        tags = lab.spawn(kind, owner, points)
        groups[label] = tags
        for i, t in enumerate(tags):
            meta.append({'tag': str(t), 'label': f'{label}{i}', 'group': label, 'type': kind, 'owner': owner,
                         'requested': points[i], 'hold': len(group) > 4 and group[4] == 'hold'})
        if len(group) > 4 and group[4] == 'hold':
            lab.command('hold', tags)
    lab.step(SETTLE)
    resolve = lambda ref: sum((groups[g] for g in ([ref] if isinstance(ref, str) else ref)), [])
    schedule = {}
    for loop, ability, who, where in spec['commands']:
        def fire(ability=ability, who=who, where=where):
            tags = resolve(who)
            if ability == 'kill':
                from s2clientprotocol import debug_pb2 as dbg
                lab.debug([dbg.DebugCommand(kill_unit=dbg.DebugKillUnit(tag=tags))])
            elif isinstance(where, str):
                lab.command(ability, tags, target=groups[where][0])
            else:
                lab.command(ability, tags, point=where)
        schedule.setdefault(loop, []).append(fire)
    tags = [int(m['tag']) for m in meta]
    frames = lab.record(spec['loops'], tags, {k: (lambda fs=v: [f() for f in fs]) for k, v in schedule.items()})
    trace = {'fixture': name, 'version': lab.ping.game_version, 'data_version': lab.ping.data_version,
             'map': lab.info.map_name, 'units': meta, 'commands': spec['commands'], 'frames': frames}
    Path(outdir, name+'.json').write_text(json.dumps(trace))
    return trace


if __name__ == '__main__':
    outdir = Path(sys.argv[1]); outdir.mkdir(parents=True, exist_ok=True)
    names = sys.argv[2:] or list(FIXTURES)
    lab = NativeLab()
    try:
        print('native', lab.ping.game_version, flush=True)
        for name in names:
            started = time.time()
            trace = run(lab, name, FIXTURES[name], outdir)
            last = trace['frames'][-1]['units']
            print(f'{name}: {len(trace["units"])} units, {len(trace["frames"])} frames, '
                  f'alive {len(last)}, {time.time()-started:.1f}s', flush=True)
    finally:
        lab.close()
