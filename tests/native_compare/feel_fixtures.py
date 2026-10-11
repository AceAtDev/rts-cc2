"""Shared movement and unit-AI fixtures for native capture and browser replay.

Coordinates are native game units on Flat64. Each fixture lists unit groups
(label prefix, type, owner, points, optional hold) and commands at relative
loops. Commands name the issuing owner implicitly through their units.
"""


def grid(x0, y0, columns, rows, spacing, dy=None):
    dy = spacing if dy is None else dy
    return [[x0+i % columns*spacing, y0+i//columns*dy] for i in range(columns*rows)]


def line(x0, y0, count, dx, dy):
    return [[x0+i*dx, y0+i*dy] for i in range(count)]


C = (44, 42)  # Flat64 lane center
FIXTURES = {
    # --- group movement and arrival -------------------------------------
    'spread48_move': dict(loops=180, units=[('m', 'Marine', 1, grid(28, 39, 8, 6, 1.0))],
                          commands=[(0, 'move', 'm', (52, 42))]),
    'loose32_click_inside': dict(loops=120, units=[('m', 'Marine', 1, grid(36, 40, 8, 4, 1.43))],
                                 commands=[(0, 'move', 'm', (36+3.5*1.43, 40+1.5*1.43))]),
    'pair20_converge': dict(loops=160, units=[('m', 'Marine', 1, [[30, 42], [30, 52]])],
                            commands=[(0, 'move', 'm', (52, 47))]),
    'compact6_inside': dict(loops=80, units=[('m', 'Marine', 1, grid(40, 40, 3, 2, 1.43))],
                            commands=[(0, 'move', 'm', (40+1.43+.715, 40+.715))]),
    'march24_far': dict(loops=260, units=[('m', 'Marine', 1, grid(24, 37, 6, 4, 1.6))],
                        commands=[(0, 'move', 'm', (60, 46))]),
    'mixed_move': dict(loops=200, units=[('m', 'Marine', 1, grid(26, 44, 4, 2, 1.0)),
                                         ('t', 'SiegeTank', 1, line(27, 41, 3, 2.0, 0)),
                                         ('h', 'Hellion', 1, line(27, 38.5, 3, 1.6, 0))],
                       commands=[(0, 'move', ['m', 't', 'h'], (56, 42))]),
    'reverse12': dict(loops=110, units=[('m', 'Marine', 1, grid(38, 40, 4, 3, .8))],
                      commands=[(0, 'move', 'm', (56, 41)), (22, 'move', 'm', (30, 41)), (36, 'move', 'm', (56, 41))]),
    # --- pushing and blocking ---------------------------------------------
    'idle_push': dict(loops=160, units=[('m', 'Marine', 1, grid(34, 41, 2, 3, .8)),
                                        ('i', 'Marine', 1, grid(40, 40.4, 2, 5, .8, .86))],
                      commands=[(0, 'move', 'm', (50, 41.8))]),
    'hold_wall': dict(loops=200, units=[('m', 'Marine', 1, line(34, 41, 3, 0, .8)),
                                        ('w', 'Marine', 1, grid(39, 40.6, 2, 3, .8), 'hold')],
                      commands=[(0, 'move', 'm', (50, 41.8))]),
    'enemy_block': dict(loops=200, units=[('m', 'Marine', 1, line(34, 41, 3, 0, .8)),
                                          ('e', 'SCV', 2, grid(39, 40.6, 2, 3, .8), 'hold')],
                        commands=[(0, 'move', 'm', (50, 41.8))]),
    'tank_push': dict(loops=90, units=[('t', 'SiegeTank', 1, [[38, 42]]), ('m', 'Marine', 1, [[44, 42.2]])],
                      commands=[(0, 'move', 't', (50, 42)), (0, 'move', 'm', (32, 42.2))]),
    'headon_pair': dict(loops=90, units=[('a', 'Marine', 1, [[38, 42]]), ('b', 'Marine', 1, [[46, 42]])],
                        commands=[(0, 'move', 'a', (46, 42)), (0, 'move', 'b', (38, 42))]),
    'crossing_groups': dict(loops=150, units=[('a', 'Marine', 1, grid(34, 40.8, 2, 4, .8)),
                                              ('b', 'Marine', 1, grid(52, 40.8, 2, 4, .8))],
                            commands=[(0, 'move', 'a', (54, 42)), (0, 'move', 'b', (34, 42))]),
    'depot_choke': dict(loops=260, units=[('m', 'Marine', 1, grid(30, 39, 6, 4, 1.0)),
                                          ('d', 'SupplyDepot', 1, [[40, 37], [40, 39], [40, 45], [40, 47]])],
                        commands=[(0, 'move', 'm', (50, 42))]),
    # --- built-in unit AI ---------------------------------------------------
    'amove_ball_vs_line': dict(loops=200, units=[('m', 'Marine', 1, grid(30, 40, 6, 4, .8)),
                                                 ('e', 'Marine', 2, grid(44, 38.5, 2, 8, .8), 'hold')],
                               commands=[(0, 'attack', 'm', (54, 41.6))]),
    'amove_vs_idle_ball': dict(loops=220, units=[('m', 'Marine', 1, grid(30, 40, 6, 4, .8)),
                                                 ('e', 'Marine', 2, grid(46, 40.4, 4, 4, .8))],
                               commands=[(0, 'attack', 'm', (56, 41.6))]),
    'target_priority': dict(loops=120, units=[('m', 'Marine', 1, [[40, 42]]),
                                              ('w', 'SCV', 2, [[43.5, 42]], 'hold'), ('e', 'Marine', 2, [[44.6, 43]], 'hold')],
                            commands=[]),
    'retarget_on_death': dict(loops=200, units=[('m', 'Marine', 1, grid(40, 41.2, 2, 2, .8)),
                                                ('e', 'Marine', 2, line(44.5, 40.4, 4, 0, 1.0), 'hold')],
                              commands=[]),
    'stop_response': dict(loops=120, units=[('m', 'Marine', 1, [[40, 42]]), ('e', 'Marauder', 2, [[45.6, 42]], 'hold')],
                          commands=[(2, 'attack', 'e', 'm')]),
    'hold_response': dict(loops=120, units=[('m', 'Marine', 1, [[40, 42]], 'hold'), ('e', 'Marauder', 2, [[45.6, 42]], 'hold')],
                          commands=[(2, 'attack', 'e', 'm')]),
    'leash_reacquire': dict(loops=420, units=[('m', 'Marine', 1, [[36, 42]]), ('s', 'SCV', 2, [[41.5, 42]]),
                                              ('z', 'SCV', 2, [[33, 46.5]], 'hold')],
                            commands=[(8, 'move', 's', (74, 42))]),
    'amove_scan_stop': dict(loops=120, units=[('m', 'Marine', 1, [[34, 42]]), ('e', 'Marine', 2, [[46, 42]], 'hold')],
                            commands=[(0, 'attack', 'm', (54, 42))]),
    'patrol_engage': dict(loops=260, units=[('m', 'Marine', 1, [[34, 42]]), ('e', 'SCV', 2, [[42, 45]], 'hold')],
                          commands=[(0, 'patrol', 'm', (48, 42))]),
}

# Acquisition timing: kill the current target at different loop phases.
for k in range(16):
    FIXTURES[f'acq_delay_{k:02d}'] = dict(loops=70, units=[('m', 'Marine', 1, [[40, 42]]), ('a', 'SCV', 2, [[43, 42]], 'hold'),
                                                     ('b', 'SCV', 2, [[43, 43.6]], 'hold')],
                                          commands=[(20+k, 'kill', 'a', None)])

# Automatic target choice: one idle Marine, a closer and a farther candidate.
PRIORITY_PAIRS = {
    'scv_vs_marine_held': (('SCV', 'hold'), ('Marine', 'hold')),
    'scv_idle_vs_marine': (('SCV', None), ('Marine', 'hold')),
    'zergling_vs_marine': (('Zergling', 'hold'), ('Marine', 'hold')),
    'marauder_vs_marine': (('Marauder', 'hold'), ('Marine', 'hold')),
    'hellion_vs_marine': (('Hellion', 'hold'), ('Marine', 'hold')),
    'depot_vs_scv': (('SupplyDepot', None), ('SCV', 'hold')),
    'marine_vs_marine': (('Marine', 'hold'), ('Marine', 'hold')),
    'scv_vs_scv': (('SCV', 'hold'), ('SCV', 'hold')),
}
for key, ((near, near_hold), (far, far_hold)) in PRIORITY_PAIRS.items():
    FIXTURES['prio_'+key] = dict(loops=30, units=[('m', 'Marine', 1, [[40, 42]]),
        ('n', near, 2, [[43.4 if near != 'SupplyDepot' else 43.6, 42]]) + ((near_hold,) if near_hold else ()),
        ('f', far, 2, [[44.4, 44]]) + ((far_hold,) if far_hold else ())], commands=[])
PRIORITY_PAIRS2 = {
    'hellion_vs_marauder': (('Hellion', 'hold'), ('Marauder', 'hold')),
    'hellion_vs_zergling': (('Hellion', 'hold'), ('Zergling', 'hold')),
    'marine_vs_hellion': (('Marine', 'hold'), ('Hellion', 'hold')),
    'hellion_vs_hellion': (('Hellion', 'hold'), ('Hellion', 'hold')),
    'reaper_vs_marine': (('Reaper', 'hold'), ('Marine', 'hold')),
    'tank_vs_marine': (('SiegeTank', 'hold'), ('Marine', 'hold')),
}
for key, ((near, near_hold), (far, far_hold)) in PRIORITY_PAIRS2.items():
    FIXTURES['prio_'+key] = dict(loops=30, units=[('m', 'Marine', 1, [[40, 42]]),
        ('n', near, 2, [[43.4, 42]], near_hold), ('f', far, 2, [[44.4, 44]], far_hold)], commands=[])
FIXTURES['prio_attacking_scv_vs_marine'] = dict(loops=40, units=[('m', 'Marine', 1, [[40, 42]], 'hold'),
    ('n', 'SCV', 2, [[41.2, 42]]), ('f', 'Marine', 2, [[44.4, 44]], 'hold')], commands=[(0, 'attack', 'n', 'm')])
# Spawn the observing Marine last so its first scan sees every candidate.
for key in [k for k in FIXTURES if k.startswith('prio_')]:
    spec = FIXTURES[key]
    spec['units'] = [g for g in spec['units'] if g[0] != 'm'] + [g for g in spec['units'] if g[0] == 'm']
