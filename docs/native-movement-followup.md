# Movement verification at the Faster loop rate

[Blizzard's protocol documentation](https://github.com/Blizzard/s2client-proto/blob/master/docs/protocol.md#game-speed) specifies 22.4 simulation loops per real second at Faster. Movement profiles in `dist/unit-profiles.js` come from the [pinned build 74071 catalog](https://github.com/Talv/sc2-data/tree/1921f856b0443d4cbd366c472cd7984fa6a224d1), with 28 world units per game unit and the Faster time multiplier applied to speed and acceleration. See [unit-control-research.md](unit-control-research.md) for the profile provenance and [game-loop-research.md](game-loop-research.md) for scheduling research.

`node tests/native_movement_followup.mjs` preserves six focused checks at `1 / 22.4` seconds per update:

- Infantry reaches catalog speed on the first movement update; SCV acceleration remains gradual.
- All six ground profiles stop without overshoot or residual velocity across seven short endpoint distances, including coincident destinations.
- SCVs reach an isolated Command Center from 32 approach angles. Contact remains outside the actual polygon by the terrain radius rather than using a circular approximation of the building.
- Moving units separate from stationary hostile units without pushing those hostile units.
- A 120-unit common-goal command starts every mover by tick 2 while respecting the planner's expansion budget and remaining outside terrain obstacles.

All six pass, as do the ten existing `tests/movement_followup.mjs` checks. No movement implementation change was warranted by this investigation. The endpoint tolerance, interaction padding, collision solver, crowd rules and planner are custom policies; passing these checks does not establish native SC2 pathing equivalence.

## Sealed mineral fixture

The initial native-rate cargo-deposit fixture spawned a worker at `mineral.x + 55, mineral.y` for the field centered at `(224, 1246)`. Nearby mineral rectangles centered at `(252, 1218)`, `(280, 1274)` and `(308, 1246)` surround a small open pocket. Each field has a 2×1 game-unit footprint. The worker's spawn projection selected that pocket near `(271.2, 1246)`, and harvesting reached `(263.7, 1246)`.

The worker can harvest from there, but the four rectangles leave no continuous exit for its 8.75-world-unit terrain radius. The navigation planner correctly returns no route; changing Command Center contact faces cannot open the pocket. This failure also exists independently of the simulation frequency. Making the worker escape would require altering the map geometry or moving it through blocking terrain.

The cargo test should start on a reachable outward face and retain its exact five-mineral deposit assertion. Fixture reachability must be checked against the current mineral footprints. This addresses the invalid fixture without adding teleportation or relaxing the income requirement. It also exposes a broader map/spawn limitation: a point can be locally open while belonging to a disconnected pocket; local projection does not guarantee membership in the main walkable region.
