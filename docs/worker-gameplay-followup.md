# Worker gameplay and automatic continuation

Audit date: 2026-10-09. This pass follows each SCV's active order through travel, resource ownership, extraction, cargo return, deposit, queued orders, and automatic reacquisition. The implementation changes are bounded to `dist/workers.js`; they do not add a strategic opponent policy or certify native trajectories.

## Reference evidence

The numeric source is the extracted SC2 catalog at [Talv commit 1921f856b0443d4cbd366c472cd7984fa6a224d1](https://github.com/Talv/sc2-data/tree/1921f856b0443d4cbd366c472cd7984fa6a224d1), using the existing Core → Liberty → Swarm → Void multiplayer inheritance. These are pinned snapshot facts, not a claim that every present patch matches the snapshot.

| Source | Relevant evidence | Runtime consequence |
| --- | --- | --- |
| [Core abilities](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AbilData.xml), `CAbilHarvest` | `AcquireRadius=10`; Minerals are automatically acquired; Gather and Return apply to selection | Bound local automatic mineral replacement; preserve explicit distant commands |
| [Core behaviors](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/BehaviorData.xml), `CBehaviorResource` | No shared `ReturnDelay` override | Do not invent a resource-independent mineral delay |
| [Liberty behaviors](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/BehaviorData.xml), `MineralFieldMinerals` | `HarvestTime=2.786`, `HarvestAmount=5`, `ReturnDelay=.5`, `RemoveWhenEmpty` | Keep mineral extraction and its existing delay unchanged |
| Same file, `HarvestableVespeneGeyserGas` | `HarvestTime=1.981`, `HarvestAmount=4`, `HideHarvesters`, `RequiredAlliance=Control`; no mineral `ReturnDelay` | Extraction uses its own duration; only active gas harvesters are hidden |
| [Blizzard Special Control](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control) | Shift queues successive orders | Deposit promotes the queued next order before automatic resumption |
| [Blizzard 5.0.14 notes](https://news.blizzard.com/en-us/article/24162754/starcraft-ii-5-0-14-patch-notes) | Distinguishes workers waiting for gas-building construction | Keep waiting gas orders without reserving a harvest slot |

The Normal-to-Faster conversion remains `1.4`. Coordinates remain 28 world units per game unit. No income multiplier, harvest amount, movement acceleration, build duration, or mineral extraction time changed.

## Corrected behavior

Gas previously added `.5 / 1.4` seconds after `1.981 / 1.4` extraction, using the mineral-only delay for every resource. Gas now uses its own zero extra return delay. Its extraction duration is approximately 1.415 seconds; the old duration was approximately 1.772 seconds. This corrects an underperforming gas cycle rather than applying an artificial economy bonus. Travel still determines the rest of each trip.

Once a mineral field was exhausted, automatic reassignment previously searched the entire map. A worker could walk to a remote or enemy-side expansion simply because some minerals remained anywhere. Reassignment now searches the 10-unit neighborhood of its exhausted field and completes the order if no local field remains. Explicit Gather commands to distant fields still work. The radius value comes from the ability catalog; centering reacquisition on the last field is an inferred local-cluster policy because the extracted data does not reveal the engine's search implementation.

The availability-only mineral search previously fell back to the preferred field even when that field was owned by another harvester. It now returns no available field and leaves the SCV waiting. A null check protects the movement comparison. A waiting worker can take ownership when the current harvester leaves, or switch to another nearby available field when the existing travel-versus-wait heuristic favors that field.

## Verified existing continuation behavior

The added isolated scenarios check that one SCV owns a resource at a time; waiting gas workers remain visible; a move interruption exits the Refinery and releases ownership; unfinished gas waits without extracting; and dead-harvester locks are recovered. They also check partial final loads, exact deposit amounts, cargo preservation when Gather changes destination, clicked-base Return destinations, and queued movement taking precedence over saved harvesting. These tests call the real worker module with controlled movement and payment collaborators. They do not exercise browser input, terrain routing, or rendering; the existing worker and gameplay browser suites cover those integrations separately.

Run `node tests/worker_gameplay_followup.mjs` for 17 checks.

## Open native comparison points

Core `CAbilHarvest` marks `WaitToReturn` uninterruptible. The prototype still combines mineral extraction and waiting into one phase; it does not yet reproduce the native internal phase boundary, phase-specific command deferral, or carry-icon timing. Do not infer exact micro timing from the passing aggregate-duration test.

The native client must also settle the exact search center, tie-breaks and load-balancing policy; the SCV's behavior when every drop-off lifts or dies; stuck-worker recovery; facing/interaction position search; automatic flee; construction relocation; and the priority of repair versus cargo return on a damaged Command Center. The existing early cancellation when no grounded drop-off exists remains unchanged because catalog data alone does not establish the intended native continuation. Gas and mineral return travel, collision suppression, and hidden-worker interruption trajectories remain simulation approximations.
