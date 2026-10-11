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

# --- engagement geometry probes (blocked ranged approach) -------------------
# Three Marines in a file attack-move at one held Marine: the second and third
# are blocked by the firing leader. Four headings expose the side preference.
FIXTURES['a_col3_e'] = dict(loops=110, units=[('m', 'Marine', 1, line(36, 42, 3, -.8, 0)), ('e', 'Marine', 2, [[46, 42]], 'hold')],
                            commands=[(0, 'attack', 'm', (56, 42))])
FIXTURES['a_col3_w'] = dict(loops=110, units=[('m', 'Marine', 1, line(52, 42, 3, .8, 0)), ('e', 'Marine', 2, [[42, 42]], 'hold')],
                            commands=[(0, 'attack', 'm', (32, 42))])
FIXTURES['a_col3_n'] = dict(loops=110, units=[('m', 'Marine', 1, line(44, 36, 3, 0, -.8)), ('e', 'Marine', 2, [[44, 46]], 'hold')],
                            commands=[(0, 'attack', 'm', (44, 56))])
FIXTURES['a_col3_s'] = dict(loops=110, units=[('m', 'Marine', 1, line(44, 48, 3, 0, .8)), ('e', 'Marine', 2, [[44, 38]], 'hold')],
                            commands=[(0, 'attack', 'm', (44, 28))])
# A held allied wall (not firing: target out of its range) between one
# attack-moving Marine and a held enemy: how it walks around to a firing spot.
FIXTURES['a_wall_amove'] = dict(loops=140, units=[('w', 'Marine', 1, line(40, 40.4, 5, 0, .8), 'hold'),
                                                  ('m', 'Marine', 1, [[37, 42]]), ('e', 'Marine', 2, [[46, 42]], 'hold')],
                                commands=[(0, 'attack', 'm', (56, 42))])
FIXTURES['a_wall_amove_off'] = dict(loops=140, units=[('w', 'Marine', 1, line(40, 40.4, 5, 0, .8), 'hold'),
                                                      ('m', 'Marine', 1, [[37, 42.5]]), ('e', 'Marine', 2, [[46, 42]], 'hold')],
                                    commands=[(0, 'attack', 'm', (56, 42))])

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

# --- per-type unit AI coverage (c_ prefix) -----------------------------------
# Radii: Marine/Reaper/SCV .375, Marauder .5625, Hellion .625, Siege Tank .875.
TYPES_AI = ('Marine', 'Marauder', 'Reaper', 'Hellion', 'SiegeTank', 'SiegeTankSieged')
for kind in TYPES_AI:
    # Idle acquisition distance and first shot: an enemy SCV walks past.
    FIXTURES['c_idle_acq_'+kind] = dict(loops=200, units=[('s', 'SCV', 2, [[54, 43.6]]), ('u', kind, 1, [[36, 42]])],
                                        commands=[(2, 'move', 's', (20, 43.6))])
    # First-shot timing against a stationary target already in range.
    FIXTURES['c_first_'+kind] = dict(loops=90, units=[('s', 'SCV', 2, [[40+(4.5 if kind == 'SiegeTankSieged' else 3.5), 42]], 'hold'),
                                                      ('u', kind, 1, [[40, 42]])], commands=[])
# Idle unit hit from beyond its own range: Stop (idle) versus Hold.
HIT_FROM = {'Marine': ('Marauder', 6.8), 'Reaper': ('Marauder', 6.8), 'Hellion': ('Marauder', 7.0),
            'Marauder': ('SiegeTankSieged', 10.0), 'SiegeTank': ('SiegeTankSieged', 11.0)}
for kind, (attacker, gap) in HIT_FROM.items():
    for hold in (False, True):
        FIXTURES[('c_hold_hit_' if hold else 'c_stop_hit_')+kind] = dict(
            loops=120, units=[('u', kind, 1, [[40, 42]])+(('hold',) if hold else ()), ('e', attacker, 2, [[40+gap, 42]], 'hold')],
            commands=[(2, 'attack', 'e', 'u')])
# Attack-move / Patrol target that retreats out of range.
FIXTURES['c_amove_retreat'] = dict(loops=260, units=[('m', 'Marine', 1, [[34, 42]]), ('s', 'SCV', 2, [[43, 44.5]])],
                                   commands=[(0, 'attack', 'm', (56, 42)), (22, 'move', 's', (46, 60))])
FIXTURES['c_patrol_retreat'] = dict(loops=320, units=[('m', 'Marine', 1, [[34, 42]]), ('s', 'SCV', 2, [[43, 44.5]])],
                                    commands=[(0, 'patrol', 'm', (52, 42)), (22, 'move', 's', (46, 60))])
# Patrol past several stationary enemies.
FIXTURES['c_patrol_multi'] = dict(loops=420, units=[('m', 'Marine', 1, [[30, 42]]),
                                                    ('e', 'SCV', 2, [[38, 45], [44, 39.2], [50, 45.2]], 'hold')],
                                  commands=[(0, 'patrol', 'm', (56, 42))])
# Help: an ally is attacked by an enemy outside the helper's own scan range.
FIXTURES['c_amove_help'] = dict(loops=220, units=[('a', 'Marine', 1, [[30, 42]]), ('b', 'Marine', 1, [[40, 44]]),
                                                  ('e', 'Marauder', 2, [[40, 50.6]], 'hold')],
                                commands=[(0, 'attack', 'a', (58, 42)), (60, 'attack', 'e', 'b')])
FIXTURES['c_idle_help'] = dict(loops=200, units=[('a', 'Marine', 1, [[36.5, 44]]), ('b', 'Marine', 1, [[40, 44]]),
                                                 ('e', 'Marauder', 2, [[40, 50.6]], 'hold')],
                               commands=[(4, 'attack', 'e', 'b')])
# Hellion line splash through a row of SCVs.
FIXTURES['c_hellion_line'] = dict(loops=70, units=[('s', 'SCV', 2, [[44.6, 42], [45.6, 42.3], [46.6, 41.7], [47.8, 42],
                                                                    [45.6, 43.4], [49.3, 42]], 'hold'),
                                                   ('h', 'Hellion', 1, [[40, 42]])], commands=[])
# Sieged Tank: a target inside the minimum range, two candidates outside it.
FIXTURES['c_siege_min'] = dict(loops=160, units=[('n', 'SCV', 2, [[41.6, 42]], 'hold'), ('m', 'Marine', 2, [[49, 42.5]], 'hold'),
                                                 ('f', 'Marine', 2, [[52, 39]], 'hold'), ('t', 'SiegeTankSieged', 1, [[40, 42]])],
                               commands=[])
# Sieged Tank splash with a friendly unit next to the target.
FIXTURES['c_siege_splash'] = dict(loops=120, units=[('e', 'Marine', 2, [[47, 42]], 'hold'), ('f', 'Marine', 1, [[47.5, 42.6]], 'hold'),
                                                    ('g', 'SCV', 2, [[46.6, 41.3]], 'hold'), ('t', 'SiegeTankSieged', 1, [[36, 42]])],
                                  commands=[])
# Idle chase of a fleeing target, leash/return and re-acquisition on the way home.
FIXTURES['c_leash_chase'] = dict(loops=420, units=[('m', 'Marine', 1, [[36, 42]]), ('s', 'SCV', 2, [[40.5, 42]]),
                                                   ('z', 'SCV', 2, [[40, 47.2]], 'hold')],
                                 commands=[(10, 'move', 's', (62, 42))])
FIXTURES['c_leash_chase2'] = dict(loops=440, units=[('m', 'Marine', 1, [[36, 42]]), ('s', 'SCV', 2, [[40.5, 42]]),
                                                    ('z', 'SCV', 2, [[46, 52]], 'hold')],
                                  commands=[(10, 'move', 's', (62, 42)), (170, 'move', 'z', (46, 45.4))])
# Scan scheduling: eight separated lanes whose enemies enter range one loop
# apart. Each lane has its own groups so commands stay parallel to the lane.
# Lanes stay inside the browser world (native y 17..67).
LANES = [round(18+6.8*i, 1) for i in range(8)]


def lanes(enemy, ours, enemy_x, our_x, dy, step, hold=False):
    return ([('s%d' % i, enemy, 2, [[enemy_x+step*i, y+dy]]) + (('hold',) if hold else ()) for i, y in enumerate(LANES)] +
            [('m%d' % i, ours, 1, [[our_x, y]]) for i, y in enumerate(LANES)])


FIXTURES['c_scan_idle'] = dict(loops=70, units=lanes('SCV', 'Marine', 39, 30, 1.6, .176),
                               commands=[(2, 'move', 's%d' % i, (10, y+1.6)) for i, y in enumerate(LANES)])
FIXTURES['c_scan_idle_hellion'] = dict(loops=70, units=lanes('SCV', 'Hellion', 39, 30, 1.6, .176),
                                       commands=[(2, 'move', 's%d' % i, (10, y+1.6)) for i, y in enumerate(LANES)])
FIXTURES['c_scan_amove'] = dict(loops=110, units=lanes('SCV', 'Marine', 36, 24, 1.5, .1406, hold=True),
                                commands=[(0, 'attack', 'm%d' % i, (60, y)) for i, y in enumerate(LANES)])


def approach_then_flee(turn):
    # Each enemy walks toward its lane's chaser, then runs east (no contact
    # before the first recorded loop).
    return ([(2, 'move', 's%d' % i, (10, y)) for i, y in enumerate(LANES)] +
            [(turn, 'move', 's%d' % i, (80, y)) for i, y in enumerate(LANES)])


# Leash distance: chasers of three radii follow a faster or equally fast target.
FIXTURES['c_leash_lanes'] = dict(loops=230, units=lanes('Hellion', 'Reaper', 34, 24, 0, .117),
                                 commands=approach_then_flee(22))
FIXTURES['c_leash_lanes_hellion'] = dict(loops=230, units=lanes('Hellion', 'Hellion', 34, 24, 0, .133),
                                         commands=approach_then_flee(24))
FIXTURES['c_leash_lanes_marauder'] = dict(loops=300, units=lanes('Hellion', 'Marauder', 34, 24, 0, .07),
                                          commands=approach_then_flee(22))
# Chase/leash without any engagement before the first recorded loop: the SCV
# walks into range, turns and runs; a second SCV steps into the return path.
FIXTURES['c_leash_chase3'] = dict(loops=420, units=[('m', 'Marine', 1, [[30, 42]]), ('s', 'SCV', 2, [[38, 42.8]]),
                                                    ('z', 'SCV', 2, [[44, 52]], 'hold')],
                                  commands=[(2, 'move', 's', (20, 42.8)), (30, 'move', 's', (78, 42.8)),
                                            (200, 'move', 'z', (44, 45.4))])
# Pursuit switching: a second SCV 5.25 (inside scan, outside weapon range)
# from the chaser's path while its first target runs away.
for order in ('attack', 'patrol', None):
    key = {'attack': 'amove', 'patrol': 'patrol', None: 'idle'}[order]
    FIXTURES['c_switch_'+key] = dict(
        loops=200, units=[('m', 'Marine', 1, [[30, 42]]), ('s', 'SCV', 2, [[38, 42.8]]), ('z', 'SCV', 2, [[47, 48]], 'hold')],
        commands=([(0, order, 'm', (70, 42))] if order else [(2, 'move', 's', (20, 42.8))]) +
                 [(30 if not order else 26, 'move', 's', (78, 42.8))])
# Attack-move against a target that runs away and flees again when hit
# (kept inside the browser world).
FIXTURES['c_amove_retreat2'] = dict(loops=240, units=[('m', 'Marine', 1, [[30, 42]]), ('s', 'SCV', 2, [[39, 44.5]])],
                                    commands=[(0, 'attack', 'm', (70, 42)), (22, 'move', 's', (66, 52))])
FIXTURES['c_leash_reaper'] = dict(loops=420, units=[('m', 'Reaper', 1, [[30, 42]]), ('s', 'Hellion', 2, [[34.5, 42]])],
                                  commands=[(10, 'move', 's', (62, 42))])

# --- crowd mechanics probes (b_): idle pushes, crossing traffic, arrival -------
# Mover vs one idle Marine at lateral offsets: contact distance r1+r2-1/16, the
# idle body is carried and walks back (Move order) once pushed past 3 units.
for off in (0, .2, .4, .6):
    FIXTURES[f'b_push_idle_{int(off*10)}'] = dict(loops=150, units=[('m', 'Marine', 1, [[36, 42]]), ('i', 'Marine', 1, [[40, 42+off]])],
                                                  commands=[(0, 'move', 'm', (50, 42))])
FIXTURES['b_push_idle_line'] = dict(loops=150, units=[('m', 'Marine', 1, [[36, 42]]), ('i', 'Marine', 1, line(40, 42, 3, .8, 0))],
                                    commands=[(0, 'move', 'm', (50, 42))])
for off in (.2, .4):
    FIXTURES[f'b_headon_off{int(off*10)}'] = dict(loops=90, units=[('a', 'Marine', 1, [[38, 42]]), ('b', 'Marine', 1, [[46, 42+off]])],
                                                 commands=[(0, 'move', 'a', (46, 42)), (0, 'move', 'b', (38, 42+off))])
FIXTURES['b_cross90'] = dict(loops=110, units=[('a', 'Marine', 1, [[36, 42]]), ('b', 'Marine', 1, [[43, 35]])],
                             commands=[(0, 'move', 'a', (50, 42)), (0, 'move', 'b', (43, 49))])
FIXTURES['b_one_vs_group'] = dict(loops=150, units=[('a', 'Marine', 1, [[36, 42]]), ('b', 'Marine', 1, grid(50, 40.8, 2, 4, .8))],
                                  commands=[(0, 'move', 'a', (54, 42)), (0, 'move', 'b', (34, 42))])
FIXTURES['b_one_vs_idle_group'] = dict(loops=150, units=[('a', 'Marine', 1, [[36, 42.2]]), ('b', 'Marine', 1, grid(42, 40.8, 2, 4, .8))],
                                       commands=[(0, 'move', 'a', (50, 42.2))])
FIXTURES['b_arr_row8'] = dict(loops=150, units=[('m', 'Marine', 1, line(30, 38.5, 8, 0, 1.0))], commands=[(0, 'move', 'm', (44, 42))])
FIXTURES['b_arr_grid16'] = dict(loops=170, units=[('m', 'Marine', 1, grid(28, 40, 4, 4, 1.2))], commands=[(0, 'move', 'm', (46, 42))])

# Chaos floor: the same fixtures with every requested position nudged by 0.01.
import copy as _copy
for _name in ['crossing_groups', 'amove_ball_vs_line', 'amove_vs_idle_ball', 'loose32_click_inside', 'idle_push',
              'spread48_move', 'compact6_inside', 'mixed_move', 'march24_far']:
    _spec = _copy.deepcopy(FIXTURES[_name])
    _spec['units'] = [(g[0], g[1], g[2], [[p[0]+.01, p[1]+.01] for p in g[3]]) + tuple(g[4:]) for g in _spec['units']]
    FIXTURES['jit_'+_name] = _spec

# Agent D: noise floor for the row arrival probe (same 0.01 nudge as jit_).
_spec = _copy.deepcopy(FIXTURES['b_arr_row8'])
_spec['units'] = [(g[0], g[1], g[2], [[p[0]+.01, p[1]+.01] for p in g[3]]) + tuple(g[4:]) for g in _spec['units']]
FIXTURES['d_jit_b_arr_row8'] = _spec
# --- pursuit / leash probes (e_) ----------------------------------------------
# Flat64 keeps two start Command Centers, placed per run on two of
# (24.5|63.5, 22.5|61.5), plus mineral lines near the map edges (y < 23,
# y > 61, x < 18, x > 70). The outer c_ lanes (y 18, 24.8, 58.8, 65.6) and Move
# targets at x 10/80 run into them natively (paths bend, an idle unit next to
# an enemy Command Center attacks it); the browser world (x 6.5..81.5,
# y 17..67) has none of them. These lanes and targets keep clear.
LANES_E = [32, 38.5, 45, 51.5]


def lanes_e(enemy, ours, enemy_x, our_x, dy, step, hold=False):
    return ([('s%d' % i, enemy, 2, [[enemy_x+step*i, y+dy]]) + (('hold',) if hold else ()) for i, y in enumerate(LANES_E)] +
            [('m%d' % i, ours, 1, [[our_x, y]]) for i, y in enumerate(LANES_E)])


def flee_e(turn, west=27, east=66):
    return ([(2, 'move', 's%d' % i, (west, y)) for i, y in enumerate(LANES_E)] +
            [(turn, 'move', 's%d' % i, (east, y)) for i, y in enumerate(LANES_E)])


def order_e(loop, ability, point_x=22):
    return [(loop, ability, 'm%d' % i, (point_x, y)) for i, y in enumerate(LANES_E)]


FIXTURES['e_leash_lanes'] = dict(loops=230, units=lanes_e('Hellion', 'Reaper', 40, 30, 0, .117), commands=flee_e(22))
FIXTURES['e_leash_lanes_hellion'] = dict(loops=230, units=lanes_e('Hellion', 'Hellion', 40, 30, 0, .133), commands=flee_e(24))
FIXTURES['e_leash_lanes_marauder'] = dict(loops=300, units=lanes_e('Hellion', 'Marauder', 40, 30, 0, .07), commands=flee_e(22))
# Same speeds as the Marauder case (2.25 chasing 4.25) with Marine weapon data.
FIXTURES['e_leash_lanes_marine'] = dict(loops=300, units=lanes_e('Hellion', 'Marine', 40, 30, 0, .07), commands=flee_e(22))
# Marauder chasing a slightly faster SCV (2.8125) and an equally fast Marauder.
FIXTURES['e_leash_lanes_marauder_scv'] = dict(loops=420, units=lanes_e('SCV', 'Marauder', 39, 30, 0, .09), commands=flee_e(22))
FIXTURES['e_leash_lanes_marauder_eq'] = dict(loops=420, units=lanes_e('Marauder', 'Marauder', 39.5, 30, 0, .09), commands=flee_e(24))
# Attack-move / Patrol pursuit of a faster target: orders point away (west)
# from the flee direction, so a chase is a pure detour from the order.
FIXTURES['e_amove_lanes_marauder'] = dict(loops=320, units=lanes_e('Hellion', 'Marauder', 40, 30, 0, .07),
                                          commands=order_e(8, 'attack') + flee_e(22))
FIXTURES['e_patrol_lanes_marauder'] = dict(loops=320, units=lanes_e('Hellion', 'Marauder', 40, 30, 0, .07),
                                           commands=order_e(8, 'patrol') + flee_e(22))
FIXTURES['e_amove_lanes_eq'] = dict(loops=420, units=lanes_e('Marauder', 'Marauder', 39.5, 30, 0, .09),
                                    commands=order_e(8, 'attack') + flee_e(24))
# Retreat fixtures kept inside the browser world (c_amove_retreat/c_patrol_retreat
# flee past native y 67 after the first hits).
FIXTURES['e_amove_retreat'] = dict(loops=260, units=[('m', 'Marine', 1, [[34, 42]]), ('s', 'SCV', 2, [[43, 44.5]])],
                                   commands=[(0, 'attack', 'm', (56, 42)), (22, 'move', 's', (46, 52))])
FIXTURES['e_patrol_retreat'] = dict(loops=320, units=[('m', 'Marine', 1, [[34, 42]]), ('s', 'SCV', 2, [[43, 44.5]])],
                                    commands=[(0, 'patrol', 'm', (52, 42)), (22, 'move', 's', (46, 48))])
# Target-distance drop: the Hellion keeps running until the slower chaser is
# more than 21 behind (three clear lanes; chasers start at x 24).
LANES_D = [35, 41.75, 48.5]


def drop_e(ours, extra=(), step=.07, turn=22, enemy='Hellion', x0=34):
    # Attack-move/Patrol orders point west at x 19; only lanes 38.5 and 45
    # reach it without walking around the geysers at (20.5, 34.5|48.5).
    lanes_ = [38.5, 45] if extra else LANES_D
    units = ([('s%d' % i, enemy, 2, [[x0+step*i, y]]) for i, y in enumerate(lanes_)] +
             [('m%d' % i, ours, 1, [[24, y]]) for i, y in enumerate(lanes_)])
    commands = ([(2, 'move', 's%d' % i, (27, y)) for i, y in enumerate(lanes_)] +
                [(turn, 'move', 's%d' % i, (69, y)) for i, y in enumerate(lanes_)])
    commands += [(loop, ability, 'm%d' % i, (19, y)) for loop, ability in extra for i, y in enumerate(lanes_)]
    return dict(loops=300, units=units, commands=commands)


FIXTURES['e_drop_marauder'] = drop_e('Marauder')
FIXTURES['e_drop_marine'] = drop_e('Marine')
FIXTURES['e_drop_marauder2'] = drop_e('Marauder', step=.11, turn=23)
FIXTURES['e_drop_amove'] = drop_e('Marauder', extra=[(8, 'attack')])
FIXTURES['e_drop_patrol'] = drop_e('Marauder', extra=[(8, 'patrol')])
FIXTURES['e_drop_amove_marine'] = drop_e('Marine', extra=[(8, 'attack')])
# Radii probes for the drop distance (edge or center): Siege Tank (r .875)
# chasing Hellions; Attack-moving Marines chasing Reapers (r .375).
FIXTURES['e_drop_tank'] = drop_e('SiegeTank', x0=35)
FIXTURES['e_drop_tank2'] = drop_e('SiegeTank', x0=35, step=.13, turn=23)
FIXTURES['e_drop_rr'] = drop_e('Marine', extra=[(8, 'attack')], enemy='Reaper', x0=33)
FIXTURES['e_drop_rr2'] = drop_e('Marine', extra=[(8, 'attack')], enemy='Reaper', x0=33, step=.19, turn=23)
FIXTURES['e_drop_tank3'] = drop_e('SiegeTank', x0=35.2, step=.21, turn=22)
FIXTURES['e_drop_tank4'] = drop_e('SiegeTank', x0=34.9, step=.29, turn=24)
FIXTURES['e_drop_tank5'] = drop_e('SiegeTank', x0=35.1, step=.05, turn=23)
FIXTURES['e_drop_amove2'] = drop_e('Marauder', extra=[(8, 'attack')], step=.13, turn=23)
FIXTURES['e_drop_patrol2'] = drop_e('Marauder', extra=[(8, 'patrol')], step=.13, turn=23)

# Noise floors for the pursuit/leash fixtures (same nudge as the jit_ block).
for _name in ['c_leash_lanes_marauder', 'c_patrol_retreat', 'c_leash_lanes', 'c_leash_lanes_hellion', 'c_switch_idle',
              'c_leash_chase3', 'c_switch_amove', 'c_leash_chase2', 'c_amove_retreat', 'c_switch_patrol',
              'e_amove_retreat', 'e_patrol_retreat', 'e_drop_marauder', 'e_leash_lanes']:
    _spec = _copy.deepcopy(FIXTURES[_name])
    _spec['units'] = [(g[0], g[1], g[2], [[p[0]+.01, p[1]+.01] for p in g[3]]) + tuple(g[4:]) for g in _spec['units']]
    FIXTURES['jit_'+_name] = _spec
# c_switch_*/c_leash_chase3 with the fleeing SCV stopping at x 66: its run to
# (78, 42.8) bends around the x 72 mineral line natively (heading 4 degrees).
for order in ('attack', 'patrol', None):
    key = {'attack': 'amove', 'patrol': 'patrol', None: 'idle'}[order]
    FIXTURES['e_switch_'+key] = dict(
        loops=200, units=[('m', 'Marine', 1, [[30, 42]]), ('s', 'SCV', 2, [[38, 42.8]]), ('z', 'SCV', 2, [[47, 48]], 'hold')],
        commands=([(0, order, 'm', (70, 42))] if order else [(2, 'move', 's', (20, 42.8))]) +
                 [(30 if not order else 26, 'move', 's', (66, 42.8))])
FIXTURES['e_leash_chase3'] = dict(loops=420, units=[('m', 'Marine', 1, [[30, 42]]), ('s', 'SCV', 2, [[38, 42.8]]),
                                                    ('z', 'SCV', 2, [[44, 52]], 'hold')],
                                  commands=[(2, 'move', 's', (20, 42.8)), (30, 'move', 's', (66, 42.8)),
                                            (200, 'move', 'z', (44, 45.4))])
for _name in ['e_switch_amove', 'e_switch_patrol', 'e_switch_idle', 'e_leash_chase3']:
    _spec = _copy.deepcopy(FIXTURES[_name])
    _spec['units'] = [(g[0], g[1], g[2], [[p[0]+.01, p[1]+.01] for p in g[3]]) + tuple(g[4:]) for g in _spec['units']]
    FIXTURES['jit_'+_name] = _spec
# Explicit Attack order on a target that runs: chase start after the shot.
FIXTURES['e_manual_chase'] = dict(loops=120, units=[('s%d' % i, 'Hellion', 2, [[34+.07*i, y]]) for i, y in enumerate(LANES_D)] +
                                  [('m%d' % i, 'Marine', 1, [[29.5, y]]) for i, y in enumerate(LANES_D)],
                                  commands=[(0, 'attack', 'm%d' % i, 's%d' % i) for i in range(3)] +
                                           [(4, 'move', 's%d' % i, (69, y)) for i, y in enumerate(LANES_D)])

# --- held-out validation set (f_) ---------------------------------------------
# Scenarios not used for any fit: mixed types, crossing traffic, depots, kiting,
# Stop versus Hold, patrol, shift-queued waypoints. All inside the clear centre
# of Flat64 (x 26..62, y 30..54). A fifth command element 'queued' appends.
FIXTURES['f_mixed_depot_choke'] = dict(loops=240, units=[
    ('m', 'Marine', 1, grid(33, 40, 3, 2, 1.0)), ('r', 'Marauder', 1, line(31, 39.5, 3, 0, 1.4)),
    ('h', 'Hellion', 1, line(35.5, 39.5, 2, 0, 1.6)),
    ('d', 'SupplyDepot', 1, [[44, 35], [44, 37], [44, 39], [44, 44], [44, 46], [44, 48]])],
    commands=[(0, 'move', ['m', 'r', 'h'], (54, 41.5))])
FIXTURES['f_cross45'] = dict(loops=200, units=[('a', 'Marine', 1, grid(30, 32, 3, 2, 1.0)),
                                               ('b', 'Marauder', 1, grid(31, 44, 2, 2, 1.3))],
                             commands=[(0, 'move', 'a', (52, 54)), (0, 'move', 'b', (60, 44.6))])
FIXTURES['f_marauder_amove_hellions'] = dict(loops=200, units=[('m', 'Marauder', 1, grid(32, 40, 2, 2, 1.4)),
                                                               ('e', 'Hellion', 2, line(46, 39.5, 4, 0, 1.5))],
                                             commands=[(0, 'attack', 'm', (58, 42))])
FIXTURES['f_hellion_runby'] = dict(loops=160, units=[('h', 'Hellion', 1, line(30, 40.5, 3, 0, 1.5)),
                                                     ('e', 'Marine', 2, grid(43, 39.5, 2, 3, 1.6))],
                                   commands=[(0, 'move', 'h', (60, 42))])
FIXTURES['f_reaper_kite'] = dict(loops=170, units=[('r', 'Reaper', 1, [[38, 41.2], [38, 42.8]]),
                                                   ('e', 'Marine', 2, line(45.5, 40.8, 3, 0, 1.2))],
                                 commands=[(0, 'attack', 'r', 'e'), (30, 'move', 'r', (31, 42)), (58, 'attack', 'r', 'e'),
                                           (92, 'move', 'r', (29, 42)), (120, 'attack', 'r', 'e')])
FIXTURES['f_stop_vs_hold'] = dict(loops=170, units=[('s', 'Marine', 1, line(33, 37.4, 3, 0, .8)),
                                                    ('h', 'Marine', 1, line(33, 45.4, 3, 0, .8)),
                                                    ('e', 'Marauder', 2, [[43, 38.2], [43, 46.2]], 'hold')],
                                  commands=[(0, 'move', ['s', 'h'], (60, 42)), (14, 'stop', 's', None), (14, 'hold', 'h', None)])
# f_stop_vs_hold never came under fire (the Marauders stood 8 away); in this
# corrected twin the held Marauders reach both groups (range 6 + radii 0.94).
FIXTURES['f_stop_vs_hold2'] = dict(loops=220, units=[('s', 'Marine', 1, line(33, 37.4, 3, 0, .8)),
                                                     ('h', 'Marine', 1, line(33, 45.4, 3, 0, .8)),
                                                     ('e', 'Marauder', 2, [[41.6, 38.2], [41.6, 46.2]], 'hold')],
                                   commands=[(0, 'move', ['s', 'h'], (60, 42)), (14, 'stop', 's', None), (14, 'hold', 'h', None)])
FIXTURES['f_patrol_pair_cross'] =dict(loops=220, units=[('m', 'Marine', 1, [[32, 41], [32, 42.6]]),
                                                         ('s', 'SCV', 2, [[45, 52], [46.2, 52.6]])],
                                       commands=[(0, 'patrol', 'm', (56, 42)), (0, 'move', 's', (45.6, 30))])
FIXTURES['f_tank_marine_amove'] = dict(loops=200, units=[('t', 'SiegeTank', 1, [[30, 40], [30, 43.6]]),
                                                         ('m', 'Marine', 1, grid(33, 40, 3, 2, 1.0)),
                                                         ('e', 'Marine', 2, line(50, 39.5, 6, 0, 1.0), 'hold')],
                                       commands=[(0, 'attack', ['t', 'm'], (58, 42))])
FIXTURES['f_shift_waypoints'] = dict(loops=230, units=[('m', 'Marine', 1, grid(32, 40, 4, 2, 1.0))],
                                     commands=[(0, 'move', 'm', (44, 33)), (0, 'move', 'm', (54, 42), 'queued'),
                                               (0, 'move', 'm', (44, 51), 'queued')])
FIXTURES['f_reverse_mixed'] = dict(loops=150, units=[('m', 'Marine', 1, grid(38, 41, 3, 2, 1.0)),
                                                     ('r', 'Marauder', 1, line(36, 40.8, 2, 0, 1.6))],
                                   commands=[(0, 'move', ['m', 'r'], (58, 48)), (28, 'move', ['m', 'r'], (30, 35))])
FIXTURES['f_depot_pocket'] = dict(loops=200, units=[('m', 'Marine', 1, grid(33, 40, 3, 2, 1.0)),
                                                    ('d', 'SupplyDepot', 1, [[50, 38], [50, 40], [50, 42], [50, 44], [50, 46],
                                                                             [48, 38], [46, 38], [48, 46], [46, 46]])],
                                  commands=[(0, 'move', 'm', (47.5, 42))])
FIXTURES['f_mixed_push_idle'] = dict(loops=180, units=[('m', 'Marine', 1, grid(32, 40.5, 2, 2, .9)),
                                                       ('w', 'SCV', 1, grid(31, 43, 2, 1, .9)),
                                                       ('i', 'Marauder', 1, grid(40, 39.8, 2, 3, 1.25))],
                                       commands=[(0, 'move', ['m', 'w'], (54, 42))])
# Shift-queued waypoint probes (b_ prefix: mechanics probes, not held out).
FIXTURES['b_queue_hellion'] = dict(loops=200, units=[('h', 'Hellion', 1, line(32, 40, 3, 0, 1.5))],
                                   commands=[(0, 'move', 'h', (44, 34)), (0, 'move', 'h', (54, 44), 'queued'),
                                             (0, 'move', 'h', (40, 50), 'queued')])
FIXTURES['b_queue_scv'] = dict(loops=200, units=[('s', 'SCV', 1, [[32, 42]])],
                               commands=[(0, 'move', 's', (40, 36)), (0, 'move', 's', (50, 44), 'queued'),
                                         (0, 'move', 's', (40, 48), 'queued')])
FIXTURES['b_queue_amove'] = dict(loops=200, units=[('m', 'Marine', 1, [[32, 42]]), ('r', 'Marauder', 1, [[32, 46]])],
                                 commands=[(0, 'attack', 'm', (40, 36)), (0, 'attack', 'm', (50, 44), 'queued'),
                                           (0, 'move', 'r', (40, 50)), (0, 'move', 'r', (50, 46), 'queued')])
FIXTURES['b_queue_patrol'] = dict(loops=260, units=[('m', 'Marine', 1, [[32, 42]])],
                                  commands=[(0, 'move', 'm', (40, 36)), (0, 'patrol', 'm', (50, 44), 'queued')])
for _name in [k for k in FIXTURES if k.startswith('f_')]:
    _spec = _copy.deepcopy(FIXTURES[_name])
    _spec['units'] = [(g[0], g[1], g[2], [[p[0]+.01, p[1]+.01] for p in g[3]]) + tuple(g[4:]) for g in _spec['units']]
    FIXTURES['jit_'+_name] = _spec
