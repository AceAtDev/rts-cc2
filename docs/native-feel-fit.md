# Native feel fit: movement and built-in unit AI

This pass compares the browser simulation directly against the native SC2 engine. It covers group movement, pushing, blocking, chokes, and the AI every unit runs when nobody controls it. Each comparison starts from the same state. Fitted rules replace guesses wherever the native client disagreed with them.

## Method

| Step | Tool |
| --- | --- |
| Native capture | [`native_lab.py`](../tests/native_compare/native_lab.py) launches two local headless 4.10 clients. They host a fog-free, non-realtime `Flat64` game with two Participant players and no computer controller, seed 42. Fixtures are debug-spawned and commanded through the owning player's client. Every loop's position, facing, health, weapon cooldown, engaged target and orders are recorded. |
| Fixtures | [`feel_fixtures.py`](../tests/native_compare/feel_fixtures.py) holds shared specs for crowds, pushing, blocking, chokes, A-move fights, target choice, acquisition timing, responses, leash and patrol. [`run_native.py`](../tests/native_compare/run_native.py) captures them. |
| Browser replay | [`replay_browser.py`](../tests/native_compare/replay_browser.py) builds the same fixture in an obstacle-free browser arena. It starts from the native loop-0 positions, facing, health, cooldown and engaged targets. Each command fires on the loop its native order first appears; the two-client lockstep adds a loop of latency, which the replay must not count as movement error. |
| Scoring | [`feel_check.py`](../tests/native_compare/feel_check.py) / [`compare_feel.py`](../tests/native_compare/compare_feel.py) report mean per-unit position error per loop (game units), completion loops, survivors and health. They also draw native-over-browser filmstrips and sweep tunables. |

Native binaries, maps and raw traces stay outside the repository under the research license recorded in [native-client-license-boundary.md](native-client-license-boundary.md). The client is the historical 4.10.0.75689 Linux build, not the current retail patch.

## Native rules fitted so far

| Behavior | Native evidence | Browser rule |
| --- | --- | --- |
| Re-acquisition after a kill | Across 16 kill phases, the next target was acquired 0–11 loops after the death. The remaining weapon cooldown at that moment averaged 1.09 loops (range 0–2.45), even with another enemy already in range. | A unit with no target searches only when its cooldown is ≤ 2.5 loops, on a per-unit 3-loop schedule. Browser average: 1.01 loops (range 0–2.2). |
| Weapon cadence | Cooldown reset values vary by about −1…+2 loops. | Catalog `RandomDelayMin/Max` (−0.0625…+0.125 game s) is applied to each shot from a seeded generator. |
| Automatic target choice | With the observer spawned last, a farther Marine beats a closer SCV, whether the SCV is held or idle. Closer Hellion, Marauder, Reaper and Marine targets each beat a farther Marine, and a closer SCV beats a farther SCV. An SCV beats a closer Supply Depot. | Ranking: AttackTargetPriority first, then combat unit over worker or unarmed unit, then distance. 11 of 13 browser choices match; the other two differ only by the first-scan delay of a freshly spawned unit. |
| Command timing | A raw command surfaces as an order two loops later in the lockstep setup. Movement starts on the next loop. | The replay aligns to native order appearance. Single-player timing follows the earlier one-loop measurement in [native-gameplay-observations.md](native-gameplay-observations.md). |
| Spread-group arrival | Units stop near the click with a radius that grows as more units arrive: about 1.33 × unit radius × √(arrived + 1). The first units stop within about 0.55 of the click. Arrived units are shoved afterwards by later arrivals (mean 0.7–1.5 game units), which rounds the blob onto the click. Settled crowds overlap by up to 0.07 game units. | Arrival radius uses the envelope. Contact with an arrived squadmate must persist for 0.2 s before a mover settles. Arrived units are pushed like idle units. |
| Idle allies | Idle units part around a moving squad on both sides and stay near their column. The movers deflect around them. | Plain contact push with the idle ally taking 30% of the overlap (fitted). The earlier sideways-slide rule is off; native data contradicted it. |

## Results

Mean per-loop position error, in game units, over the 23 core fixtures. Lower is better.

| Fixture | First replay | After fit |
| --- | --- | --- |
| headon_pair | 2.534 | 0.022 |
| pair20_converge | 0.292 | 0.019 |
| reverse12 | 0.249 | 0.092 |
| spread48_move | 0.982 | 0.319 |
| march24_far | 0.547 | 0.180 |
| mixed_move | 0.929 | 0.374 |
| idle_push | 1.068 | 0.624 |
| crossing_groups | 2.985 | 1.813 |
| amove_ball_vs_line | 2.048 | 1.182 |
| amove_vs_idle_ball | 2.742 | 2.330 |
| **Total** | **13.53** | **9.58** |

The first replay of `headon_pair` and `crossing_groups` used smart-click targeting, which turned point moves into Follow. The replay now issues raw point orders as native does.

## Pursuit, leash and turning (`e_` fixtures)

Several `c_` chase fixtures run into Flat64 objects the browser arena does not have. Flat64 keeps two start Command Centers per run, on two of (24.5 or 63.5, 22.5 or 61.5), plus mineral lines near its edges. Flee targets at x 78–80 lie outside the playable area (x 12–76, y 10–74), so the native paths bend around minerals. `c_amove_retreat` and `c_patrol_retreat` flee past the browser world (y > 67). The `e_` fixtures repeat these cases in clear lanes and keep their targets inside both worlds. The replay now also continues a plain Move that is already running at loop 0 (an SCV fleeing a hit taken before the trace starts).

| Behavior | Native evidence | Browser rule |
| --- | --- | --- |
| Target-distance drop | Seen in 30 lanes with Marine, Marauder and Siege Tank chasers, under Idle, Attack-move and Patrol. A chaser slower than its target drops it on its 8-loop scan slot. Lanes dropped when the centers were 21.97–22.4 apart and stayed on at 20.9–22.02. Only center distance fits all three radii (edge distance does not fit the tank). | On a scan, a pursued target more than 22 from the chaser (centers, start-of-loop positions) is dropped. Idle units walk home; Attack-move and Patrol resume their order. |
| Scan geometry | The native scan result shows one loop before the browser's scan, and the unit acts one loop later. `e_drop_amove`: no acquisition at 6.66, acquisition at 5.66 (scan range 6.5). `patrol_engage`: acquisition at 5.49 from the Marine's post-move position. | Slot scans measure from everyone's position at the start of the browser loop. |
| Chase after a shot | Marine, Reaper and Hellion take their first chase step 13 loops after the shot loop, whatever the distance. Measured at 5.09–7.76, including 5.52 with range 5. | Stand for the backswing plus one loop. |
| RangeSlop hold | A Marauder (no backswing) stays still through its cooldown until the target is beyond 7 at the start of a loop: stayed at 6.80–6.97, left at 7.04–7.24, range 6, 17 lanes. A Siege Tank released its target at 8.05 (range 7). | Marauder and Siege Tank stand without firing while the target is within range + 1. |
| Approach arrival | `e_patrol_retreat`: a Marine kept walking at 5.006 from a retreating SCV. | The in-range check after a step uses the target's end-of-loop position, projected by velocity if it has not moved yet. |
| Worker flee | The flee is a Move order exactly 5 away from the attacker. It brakes to an exact stop after 44 loops. | Flee orders use exact-point arrival with braking. They no longer stop 0.1 short with no ramp. |
| Turning at speed | An SCV (acceleration 2.5) running west and ordered east moves east at full speed on the next loop. Its facing then turns at the turn rate. | The velocity heading follows the steering at once; only the speed ramps (`STEER.instant`). |

Error per fixture (game units). The noise floor is native against native with every start nudged by 0.01. "Before" is the previous browser rules with the same replay.

| Fixture | Before | After | Floor |
| --- | --- | --- | --- |
| e_drop_* (Marine, Marauder, Siege Tank; Idle, Attack-move, Patrol; 14 fixtures) | 2.1–6.2 | 0.000–0.44 (tanks: random second shot) | 0.120 (e_drop_marauder) |
| e_leash_lanes / _hellion / _marauder / _marine | 0.256 / 0.285 / 0.293 / 0.185 | 0.024 / 0.024 / 0.001 / 0.000 | 0.147 (e_leash_lanes) |
| e_leash_lanes_marauder_eq / _scv | 1.345 / 3.503 | 0.001 / 0.000 | |
| e_switch_idle / _amove / _patrol | 0.825 / 0.042 / 0.140 | 0.034 / 0.008 / 0.009 | 0.330 / 0.193 / 0.163 |
| e_leash_chase3 | 0.232 | 0.003 | 0.380 |
| e_amove_retreat / e_patrol_retreat | 0.230 / 0.327 | 0.049 / 0.043 | 0.117 / 0.261 |
| c_leash_lanes_marauder | 4.079 | 1.588 | 1.102 |
| c_leash_chase2 | 0.126 (0.714 before the replay fix) | 0.052 | 0.231 |
| c_switch_idle / _amove / _patrol | 0.975 / 0.726 / 0.405 | 0.459 / 0.508 / 0.394 | 0.059 / 0.014 / 0.197 |

The remaining `c_` residuals come from the map objects listed above and from per-shot random cooldowns, which the browser cannot reproduce. The 23 core fixtures total 8.23 against 7.81 before. The difference is all in the chaotic `amove_vs_idle_ball`, whose own floor is 1.57. Averaged over four weapon seeds, the core total is 8.13 after and 8.05 before. On the three non-default seeds it is 8.10 after and 8.12 before.
