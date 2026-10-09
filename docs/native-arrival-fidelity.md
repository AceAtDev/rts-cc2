# Isolated point Move arrival compared with SC2

This pass uses a running licensed SC2 client, version **4.10.0.75689**, base/data build 75689, data version `B89B5D6FA7CBF6452E721311BFBC6CB2`. Captures use the official `Flat64.SC2Map`, seed 42, disabled fog, a single isolated unit, API Move ability 16 and one simulation loop per observation. The map SHA-256 is `e699838666a5b27754fc82e97342559186e5edd1ae29b0f2c3aaa711a616107d`. Commands execute at relative loop 0; movement first appears in observation loop 1. The native reference rate is [22.4 Faster loops per real second](https://github.com/Blizzard/s2client-proto/blob/master/docs/protocol.md#game-speed).

The first capture and a repeated capture showed the same isolated 10-game-unit Marine and SCV trajectories. The repeated run additionally tested the other four implemented mobile units and SCV lengths of 1, 2, 5 and 20 game units. Raw client captures remain local and are not distributed in the public repository.

## Correction

The prototype previously stopped ordinary point Move orders roughly 0.107 game units short. It also used SCV lateral acceleration to stop abruptly instead of braking at forward acceleration. A native Marine reaches the exact 10-unit endpoint at loop 72 and clears its order at loop 73. A native SCV reaches it at loop 73 and clears its order at loop 74; its final approach takes longer than the prototype's old arrival at loop 66.

Unreserved ground Move and Attack Move now request an exact point endpoint with `stopAt=0`. Combat, Follow, mineral/gas interaction, construction contact and flying-building distances retain their explicit existing stop ranges. Reserved group arrivals retain their previous three-world-unit stop distance and four-unit completion tolerance; their assigned centers and spacing remain the same. The isolated native evidence does not establish exact center convergence for the custom crowd solver. Endpoint arrival returns incomplete on the movement loop and completes on the following update, matching the observed isolated Move order lifetime.

The [pinned Liberty UnitData catalog](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/UnitData.xml) sets SCV `Acceleration=2.5` and `LateralAcceleration=46`; SCV omits Deceleration, inheriting zero from Core. In the observed straight Move stops, its per-loop displacement decreases by 0.009765625 game units, precisely the forward-acceleration increment. The replacement therefore uses a positive explicit deceleration if supplied, otherwise forward acceleration, for longitudinal point braking.

The inferred stopping policy enters braking at the ordinary physical stopping distance `v² / (2a)`. While already braking, it uses the inclusive discrete stopping ramp `v² / (2a) + v·dt / 2` to decide whether to continue decelerating or accelerate again to cover a shortfall. The last step caps to the exact endpoint. This uses unit acceleration and timestep, with no unit-length lookup or fitted per-scenario constant. Short native SCV moves sometimes accelerate again during their final approach; preserving that behavior avoids stopping short or leaving a long slow tail.

## Bounded comparison

| Isolated Move | Exact endpoint loop | Empty-order loop |
| --- | ---: | ---: |
| Marine, 10 GU | 72 | 73 |
| Marauder, 10 GU | 72 | 73 |
| Reaper, 10 GU | 43 | 44 |
| Hellion, 10 GU | 38 | 39 |
| SCV, 1 GU | 20 | 21 |
| SCV, 2 GU | 24 | 25 |
| SCV, 5 GU | 44 | 45 |
| SCV, 10 GU | 73 | 74 |
| SCV, 20 GU | 129 | 130 |

After the correction, every relative position in these nine traces matches, with zero maximum coordinate error in the recorded straight-line data. This establishes isolated point arrival for these fixtures and this historical version. It does not establish all current-patch movement, steering, collision, reverse motion or browser input latency.

The initial native Tank remained stationary for two loops before moving at the Marine's straight-line speed. Its endpoint loop was 74 and empty-order loop 75. Follow-up east/north/west facing fixtures isolated the omitted turn-before-move flag; see [tank-turn-fidelity.md](tank-turn-fidelity.md). The initial nine arrival comparisons remain separate from that heading-sensitive comparison.

Run `node tests/native-arrival-fidelity.mjs` for eight checks covering the observed arrival summaries, forward braking, short-distance reacceleration, endpoint sweeps across directions and lengths, unchanged reservation placement/tolerance, combat stop-range isolation, replacement orders and 24-unit around-rock completion at both tested timesteps. With local captures available, `node tests/native-arrival-fidelity.mjs --trace-dir /absolute/path/to/traces-repeat1` additionally compares every native relative position and order lifetime. No raw capture is needed by the default test run.

Requiring exact reserved centers initially regressed the existing 24-unit around-rock fixture: only two units completed in 12 seconds while the remainder kept shuffling. The local repulsion and contact solver preserve mobile spacing but do not converge to microscopic slot-center tolerance. Exact completion is therefore scoped to unreserved point orders until native crowd captures justify a broader correction. The original pack completion assertion remains unchanged.
