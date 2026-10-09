# Pursuit keeps the combat destination

[Blizzard's basic unit control guide](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls) describes Attack Move as engaging enemies encountered along the route. [James Anhalt's SC2 navigation presentation](https://www.gdcvault.com/play/1014514/AI-Navigation-It-s-Not) distinguishes path planning, local steering and mobile collision. These establish the intended control behavior and architectural context. They do not specify our grid, arrival reservations, or planner refresh thresholds.

Two concrete problems in `dist/movement.js` violated that behavior:

1. Combat passed the actual enemy to `move`, but the executor could replace it with the underlying attack-move order's reserved formation slot. It could also reuse that order's march corridor during pursuit. The unit then moved toward a slot or along a detour belonging to its march destination instead of approaching the enemy. Reservation and supplied-corridor use now require the destination to be the actual order object.
2. Pursuit recomputed an approach endpoint from the unit and target every update. Each planning-cell change could cancel an unfinished search. With a moving enemy, a real 16-node-per-update planner reproduced 200 updates without any movement or completed route. Pending pursuit searches now finish against a stable destination snapshot. A completed corridor updates its last leg when that connection remains terrain-clear; a valid existing corridor can continue while replacement planning runs. Order identity, target identity and navigation version invalidate pending snapshots.

The same moving-enemy fixture now moves on 173 of 200 updates, completes routes and does not cancel searches because the target crosses cells. It remains outside obstacles and respects the 16-node budget. Directly reachable targets still use their current location each update; the snapshot applies only to blocked paths. No pursuit distance, unit speed, attack range or native collision flag was invented to obtain this result.

`node tests/movement_pursuit_fidelity.mjs` checks the real navigation module at 22.4 Hz: formation-slot isolation, ordinary arrival reservation preservation, march-corridor isolation, moving-target planning progress, stationary-target pursuit, immediate order replacement and target identity replacement. Existing native-rate and movement follow-up suites remain applicable.

The local solver remains custom. Crowd passing, destination packing, target motion prediction, ramps, cliffs and native pathing trajectory comparisons still need further work. Finishing a bounded snapshot search corrects starvation; it is not a claim that SC2 internally uses the same search policy.
