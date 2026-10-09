# Compact groups retain their offsets

The old destination allocator always replaced group geometry with custom hexagonal landing slots. Units first marched toward a shared point and then switched to their assigned slot on approach. This could make a compact squad weave across itself near the destination even when no obstacle required rearranging it.

Native SC2 4.10.0.75689 captures now provide bounded evidence for a different initial order policy. On Flat64, one shared Move command gives compact units distinct translated point goals immediately. A compact Attack Move probe gives the same initial translated goals. Regular and dense 24-Marine layouts retain their original offsets. A skewed three-Marine layout at x=32/33/36 translates about the mean center, rather than its bounding-box midpoint.

The observed compactness boundary includes the circular mobile footprint radii and is axis-aligned:

| Pair | Preserved center span | Full footprint width | Collapsed center span |
| --- | ---: | ---: | ---: |
| Marine, radius .375 GU | 5.25 GU | 6 GU | 5.26 GU |
| Marauder, radius .5625 GU | 4.875 GU | 6 GU | 5.25 GU |
| Tank, radius .875 GU | 4.25 GU | 6 GU | 5.25 GU |

A Marine pair separated by four game units on each axis preserves offsets, despite its larger Euclidean distance. This supports a maximum axis-aligned footprint extent of six game units, rather than a radial distance or a unit-count cutoff. This rule is inferred from these historical native fixtures; it is not a claim that all native formation conditions or current patches are covered.

`reserveDestinations` now preserves the mean-centered geometry for compact ground Move and Attack Move groups. Each accepted order receives its translated `x/y` goal immediately, so it steers toward its own native-style destination from the first update. `groupGoal` retains the original shared click for command intent and future shared routing. Combat pursuit still uses the actual enemy rather than a march slot; completing combat can resume the unit's assigned march goal.

The allocator retains the existing packed-arrival fallback for wide formations, overlapping footprints, flying/building selections, morphing or sieged units, or translated goals that terrain projection would change. That safety fallback and its hexagonal packing remain custom. Dense/contact reservations retain their existing completion tolerance, preventing the observed crowd-shuffling regression. Preserved slots whose pair distances exceed the mobile radii plus 3.5 world units can finish exactly; this is a custom safety condition outside the local repulsion halo, not a native formation threshold.

Preserved peers use their movement-step start positions for local avoidance. Otherwise, sequential updates let later movers see earlier peers already advanced and react to contacts that would not exist after parallel motion. Actual overlap separation and interactions with other groups or combat targets remain in use. The isolated one-game-unit-spaced 24-Marine native fixture now has the same exact final centers and clears every order on loop 98. Its continuous diagonal transit differs by up to 0.01419 game units from the recorded native positions, so full trajectory equivalence is not claimed.

Native goal coordinates include fixed-point quantization. The continuous mean translation differs by less than 1/4096 game unit in the captured skewed case. Goal comparisons bound that error rather than adding an unverified global quantization rule.

`node tests/compact-formation-fidelity.mjs` runs ten checks covering immediate Move/Attack Move goals, the radius-aware boundary, diagonal geometry, mean-centered skew, dense groups, wide-layout fallback, blocked and overlapping goals, parallel movement from the first update, and bounded exact completion. Optional `--trace-dir /absolute/path/to/traces-formation-threshold` compares every initial per-unit point goal across 25 local native fixtures without distributing raw captures. Optional `--crowd-trace /absolute/path/to/marine24-shared-goal.jsonl` compares final positions/order timing and reports the bounded transit difference. The existing 24-unit around-rock browser assertion remains unchanged.
