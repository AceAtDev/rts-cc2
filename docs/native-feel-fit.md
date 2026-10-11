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
