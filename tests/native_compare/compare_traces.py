"""Report differences between a native reference and a browser JSONL trace.

Matching metadata and equal-time samples are required. There is deliberately no
automatic 'SC2-equivalent' pass flag: measurements need native repeatability
baselines, field coverage, and explicit acceptance criteria first.
"""
import argparse
import json
import math
from pathlib import Path


def read_trace(path):
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    headers = [row for row in rows if row.get('kind') == 'metadata']
    if len(headers) != 1:
        raise ValueError('Exactly one metadata row is required: '+str(path))
    frames = [row for row in rows if row.get('kind') == 'frame']
    if not frames or any(not math.isfinite(frame['seconds']) for frame in frames):
        raise ValueError('Finite frame times are required: '+str(path))
    if any(b['seconds'] <= a['seconds'] for a, b in zip(frames, frames[1:])):
        raise ValueError('Frame times must increase strictly: '+str(path))
    return headers[0], frames


def compare(reference, candidate):
    native_meta, native_frames = read_trace(reference)
    browser_meta, browser_frames = read_trace(candidate)
    if native_meta.get('engine') != 'native-sc2-api':
        raise ValueError('Reference must be a native-sc2-api capture.')
    if browser_meta.get('engine') != 'browser-prototype':
        raise ValueError('Candidate must be a browser-prototype capture.')
    for field in ('fixture_sha256', 'scenario', 'map_sha256'):
        if not native_meta.get(field) or native_meta[field] != browser_meta.get(field):
            raise ValueError('Mismatched or missing fixture metadata: '+field)
    # Sample browser state at the SAME requested times. Interpolating across
    # deaths or command boundaries could hide important divergences.
    if len(native_frames) != len(browser_frames):
        raise ValueError('Capture both engines at the same sample count.')
    distances, health_errors, cooldown_errors = [], [], []
    missing, first_movement = [], {'native': {}, 'browser': {}}
    initial = {'native': native_frames[0]['units'], 'browser': browser_frames[0]['units']}
    per_unit = {}
    for native, browser in zip(native_frames, browser_frames):
        if abs(native['seconds']-browser['seconds']) > 1e-7:
            raise ValueError('Unequal sample times; do not silently time-warp traces.')
        all_labels = set(native['units']) | set(browser['units'])
        for label in sorted(all_labels):
            n, b = native['units'].get(label), browser['units'].get(label)
            if n is None or b is None:
                missing.append({'seconds': native['seconds'], 'unit': label,
                                'missing_from': 'native' if n is None else 'browser'})
                continue
            distance = math.hypot(n['x']-b['x'], n['y']-b['y'])
            if not math.isfinite(distance):
                raise ValueError('Unit positions must be finite.')
            distances.append(distance)
            per_unit.setdefault(label, []).append(distance)
            if 'health' in n and 'health' in b:
                health_errors.append(abs(n['health']-b['health']))
            # Cooldown units must already be normalized by capture adapters.
            if 'cooldown_seconds' in n and 'cooldown_seconds' in b:
                cooldown_errors.append(abs(n['cooldown_seconds']-b['cooldown_seconds']))
            for engine, row in (('native', n), ('browser', b)):
                start = initial[engine].get(label)
                if start and label not in first_movement[engine] and math.hypot(
                        row['x']-start['x'], row['y']-start['y']) > .01:
                    first_movement[engine][label] = native['seconds']
    if not distances:
        raise ValueError('No common unit-position samples.')
    ordered = sorted(distances)
    return {'scenario': native_meta['scenario'], 'native_build': native_meta.get('base_build'),
            'sample_times': len(native_frames), 'unit_samples': len(distances),
            'position_units': 'SC2 world units',
            'mean_position_error': sum(distances)/len(distances),
            'p95_position_error': ordered[min(len(ordered)-1, math.ceil(len(ordered)*.95)-1)],
            'maximum_position_error': max(distances),
            'maximum_health_error': max(health_errors, default=None),
            'maximum_cooldown_seconds_error': max(cooldown_errors, default=None),
            'missing_samples': missing,
            'first_movement_seconds': first_movement,
            'per_unit_maximum_position_error': {label: max(values) for label, values in per_unit.items()},
            'verdict': 'measurement only; native repeatability and acceptance limits required'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference', type=Path)
    parser.add_argument('candidate', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(compare(args.reference, args.candidate), indent=2))
    except (ValueError, KeyError, TypeError) as error:
        raise SystemExit('Invalid comparison: '+str(error))
