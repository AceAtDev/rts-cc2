# Shared autonomous controller integration

This pass addresses concrete control and basic-unit failures, rather than increasing the opponent's difficulty. The player and opponent use the same combat, worker, movement and group-order executors. Native findings are recorded in [native-autonomous-observations.md](native-autonomous-observations.md), from historical SC2 4.10 with two controlled Participant players. Binaries, maps and raw observations remain outside this repository.

## Changes and evidence

| Failure | Result | Evidence boundary |
| --- | --- | --- |
| Nearby idle units ignored an attacked ally outside ordinary scan | Footprint-inclusive assistance acquires on the damage loop and approaches on the next loop | Controlled native Marine/SCV fixtures, mirrored owners and inclusive radius edge |
| Idle chase and attack-move shared a distance cutoff | Idle acquisition has an origin and return behavior; Attack Move/Patrol retain visible pursuit and resume their order | Native behaviors verified; exact idle movement boundary and return interruption policy remain bounded approximations |
| Workers treated repeated Gather and Smart alike | Explicit same-field Gather preserves extraction; mineral right-click restarts it | Native repeated-command trials distinguish first cargo at 68 versus 97 |
| No drop-off canceled harvesting | Workers extract, retain cargo/return intent, then resume when a grounded base appears | Native no-home and new-base trial; exact acquisition polling not reproduced |
| Dead fields and stale owners trapped workers | Resource search excludes dead nodes and recovers invalid ownership; loaded trips survive resource/drop-off loss | Native nearby-field recovery plus lifecycle regressions |
| Rear melee units pushed without reaching a target | Post-collision progress triggers local contact recovery; a full surround waits and reuses vacancies | Custom crowd policy, verified in real-module and browser scenarios |
| Tanks repeatedly stopped for small avoidance corrections | New orders start stationary alignment; ongoing steering continues movement | Original isolated native turning trajectories retained; crowded steering remains custom |
| Opponent tactical orders bypassed group spacing and reset attacks | Shared cohort dispatch, stable staging slots and preserved active combat | Shared browser executor and opponent policy regressions; strategy remains custom |

The native damaged-worker trial also confirms keeping Gather/Return active under fire, while idle/Stop SCVs flee and Hold stays anchored. The shared executor preserves those contexts. Flee uses a recorded damage origin when the attacker disappears into fog. Manual commands remain authoritative throughout assistance, chase and local contact recovery.

## Validation

`tests/autonomous_controller_integration.py` exercises the live browser executor on both teams: assistance phase and iteration order, manual overrides, fog-safe flee, tactical spacing, real Gather-versus-Smart dispatch, destroyed resources/drop-offs, orphan cargo, full melee surrounds, Tank steering, idle return and march resumption. Each twelve-SCV surround produces seven contributing attackers in the measured fixture; rear units settle while front units continue firing. This is a prototype regression result, not a native surround comparison.

The existing control, input, worker, micro, attack, order-intent, native-loop, worker-phase, formation, Tank-turn, economy, control-group, click and placement browser suites also pass. Every isolated module under `tests/*.mjs` is checked. Historical native Tank east/north/west and moving-reversal captures still match each compared relative position and order lifetime.

A serial 120-Marine, five-command, 600-step simulation stress at 22.4 Hz with strategic AI disabled measured mean 3.726 ms, P95 8.2 ms and maximum 36.5 ms per update, command times 1.1–8.1 ms, and no invalid positions. The per-step budget is about 44.643 ms. These timings measure simulation work in headless Chromium with software WebGL; they do not establish rendered human-input latency, all-device performance or exact SC2 feel.

The full proprietary crowd solver, fog-loss memory, randomized update phases and weapons, every target scorer, all races and abilities, native actor assets, and Blizzard's opponent scripts remain outside this implementation. Improvements and passing regressions are not a claim of absolute SC2 parity.
