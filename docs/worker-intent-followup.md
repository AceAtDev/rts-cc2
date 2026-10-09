# Worker intent and order transitions

Audit date: 2026-10-09. This pass distinguishes the mineral unit the player commands from the resource a worker later acquires autonomously. It also follows cargo through queued Gather, Return, Move, and interruption transitions.

## Evidence and limits

[Blizzard's raw command protocol](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/raw.proto), `ActionRawUnitCommand`, distinguishes `target_unit_tag` from a position target and includes `queue_command`. A targeted harvest command therefore carries a specific resource identity; it is not just a request to mine somewhere in a nearby cluster. [Blizzard Special Control](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control) describes Shift's successive order queue.

[Pinned Core Harvest ability](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AbilData.xml) has `AcquireRadius=10`, `ResourceAcquire[Minerals]=1`, and `UninterruptibleArray[WaitToReturn]=1`. [Pinned Liberty resource behaviors](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/BehaviorData.xml) separately specify mineral extraction and its return delay.

The protocol establishes command identity; it does not establish the exact native engine loop on which a busy-field retarget occurs. This implementation preserves the explicit target on acceptance and permits its existing local search after actual arrival finds the field occupied, or after depletion. Exact native arrival search, assignment tie-breaks and queued Gather completion remain comparison points requiring a running client. Passing these regressions proves the named prototype behaviors, not native equivalence.

## Corrections

`workers.accept()` previously replaced every accepted mineral node with the result of a load-scored local search. Selecting a worker and right-clicking a free field with several assigned workers could silently make it walk toward a different field immediately, even before it encountered an occupied resource. Queued Gather activation and Return Cargo resumption performed the same replacement. Acceptance now preserves the commanded node. A free targeted field can be acquired regardless of assignment counts elsewhere; an actually occupied field can still trigger local travel-versus-wait reassignment.

Non-player economy assignments can opt into initial load balancing with `{kind:'mine', node, autoAcquire:true}`. Ordinary player Gather orders, queued Gather orders, and saved explicit Gather resumes omit this flag. Existing opening assignments are already distributed across named fields and do not require it. Strategic opponent allocation and rally policies should decide whether to opt in rather than treating every targeted command as an economy heuristic.

The prior implementation had another bug when its deposit-first queue policy activated an already-empty Return Cargo. An empty Return moved toward the drop-off, called payment with zero amounts, and incremented `deliveredTrips` again. Empty Return now completes immediately and promotes its queued successor or saved harvest resume. It does not travel, pay, or record a phantom trip. This also permits an empty queued Return to finish when no drop-off currently exists; actual carried-cargo behavior with absent drop-offs remains unchanged.

After the measured uninterruptible cargo wait, earned cargo remains attached to the worker when movement interrupts the return leg. A later Return deposits it once. Interrupting an unfinished extraction releases the resource lock without inventing cargo. Changing Gather while already carrying deposits that cargo before approaching the newly commanded resource, keeping the new resource identity through that transition.

## Validation

`node tests/worker_intent_followup.mjs` runs 12 isolated scenarios using the real worker module and controlled movement/payment collaborators. It checks accepted target identity under high assignment counts, explicit-versus-automatic assignment, queued activation, saved resumption, cargo-first destination changes, actual busy-field arrival, empty returns, phantom-trip prevention, and interruptions before and after cargo is earned. The preceding `node tests/worker_gameplay_followup.mjs` still passes its 17 extraction, ownership, deposit and depletion scenarios.

Browser worker regressions must now distinguish input acceptance from later autonomous arrival behavior. The old assertion that a group has already been split immediately after a single resource click checked the removed silent target replacement. Check the accepted target first, then step actual approach/arrival and inspect distribution and trip completion.

## Native phase follow-up

Subsequent native-client capture resolved the cargo and queue boundary described as unknown in the initial audit. See [Native SCV harvest phases](native-worker-phases.md): cargo appears after extraction, the mineral slot releases immediately, an eight-loop uninterruptible wait follows, and a queued Move starts with cargo before any deposit. Tests now assert those measured boundaries. Subsequent [worker recovery](worker-recovery.md) capture also distinguished repeated explicit Gather (preserves extraction) from Smart/right-click (restarts it), and established no-home cargo continuation. Exact patch search and modern-client trajectories remain open comparisons.
