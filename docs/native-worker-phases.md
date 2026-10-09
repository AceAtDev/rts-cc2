# Native SCV harvest phases

Measured on 2026-10-09 with the locally installed native SC2 API client, version `4.10.0.75689`, base/data build `75689`, data version `B89B5D6FA7CBF6452E721311BFBC6CB2`. Trials use seed 42, a flat melee map, a controlled local SCV/mineral/Command Center arrangement, and observations after every native game loop. These findings apply to that pinned native build; they do not certify current-client parity or every crowded mineral-line trajectory.

Only derived behavior is recorded here. Licensed executable, map contents, assets, and raw capture data remain outside the public repository.

## Full-cycle observations

The controlled fixture requests targeted Gather at relative loop 0. The SCV starts at `(43,42)`, the mineral field at `(46,42.5)`, and the grounded local Command Center is centered at `(39.5,42.5)`. Native API reports SCV radius `.375`, mineral radius `1.125`, and Command Center radius `2.75`. Positions and timings depend on this arrangement; extraction/wait phase boundaries can be isolated from travel.

| Relative loop | Native observation |
| ---: | --- |
| 1 | Targeted Gather ability 295 is active; approach begins |
| 22 | First stationary observation at the mineral interaction position |
| 67 | Mineral contents decrease by five; carry buff 271 appears; active order becomes Return 296 with no target |
| 67–74 | SCV remains stationary while holding cargo |
| 75 | Return 296 gains its Command Center target and first return movement appears |
| 101 | Player minerals increase by five, cargo buff disappears, Gather 295 resumes, and outward movement begins in this same observation |

The extraction boundary occurs 45 loops after the first stationary observation. At Faster, catalog mineral `HarvestTime=2.786 / 1.4` quantizes to 45 loops, while `ReturnDelay=.5 / 1.4` is exactly eight loops. Cargo belongs to the worker during those eight loops. The previous combined timer postponed cargo and resource deduction until after the wait, which erased this observable phase distinction.

In the two-SCV trial both arrive by loop 22. One earns cargo at loop 67 and departs at 75; the waiting SCV earns its cargo at loop 113. The 46-loop extraction handoff proves that the mineral slot becomes available at cargo acquisition, allowing the second worker to extract while the first is still in its return wait. Keeping ownership for all 53 extraction-plus-wait loops was incorrect.

## Command and queue observations

| Trial | Observed behavior |
| --- | --- |
| Gather followed immediately by queued Move | At 67 the active order is Return 296 with Move still queued; at 75 Move activates and moves with five carried minerals; no deposit occurs |
| Unqueued Move requested at cargo loop 67 | Accepted immediately, appears behind Return 296 in observation 68; movement waits until 75 and retains cargo |
| Unqueued Move requested at wait loop 71 | Accepted immediately, appears behind Return 296 in observation 72; movement still begins at 75 with cargo |
| Stop requested at 71 | Deferred behind Return through 74; orders clear at 75, leaving the SCV stationary with cargo |
| Hold Position requested at 71 | Deferred behind Return through 74; Hold ability 18 becomes active at 75, stationary with cargo |
| Return Cargo requested at 71 | Request succeeds but creates no new observed order; existing Return wait continues, departure occurs at 75, and deposit at 101 |

Queued Gather successors therefore activate after the mineral cargo wait **before a deposit**. The earlier prototype's requirement to complete one paid trip first was wrong. The Return Cargo observation concerns a redundant command during an existing return wait; it does not establish a universal policy for Return commands with other queued successors.

## Runtime corrections

`workers.js` now separates `harvest`, `waitReturn`, and `home` phases. Extraction grants cargo, deducts the field and releases its owner immediately. Mineral cargo waits eight Faster loops; a queued successor then starts carrying that cargo, or the normal home leg begins when no successor exists. An exhausted final field does not cancel cargo during the wait.

`workers.deferring(e)` identifies an SCV's uninterruptible cargo wait for the input dispatcher. The dispatcher must preserve that active phase and queue accepted replacement orders during it. Stop and Hold follow the measured same rule. `workers.update()` returns `promoted` for a queued order and `resumed` for an ordinary post-deposit outward leg so the host can service the new state in the same simulation step, with a bounded continuation count.

`node tests/native_worker_phases.mjs` provides eight checks derived from these measured phase boundaries, including slot release, cargo timing, next-worker extraction, queued Move before deposit and wait deferral. Controlled movement collaborators isolate phase logic from map navigation. Actual browser input, same-step movement dispatch, rendering, and group recall require the integration suite; these isolated tests do not claim full native trace agreement.

## Remaining comparisons

[Worker recovery](worker-recovery.md) adds native measurements of repeated Gather versus Smart, no-home cargo continuation, new-base resumption and destroyed-field reacquisition. [The gas follow-up](native-worker-gas-followup.md) adds measured gas extraction, queue promotion, carried Gather and lost mineral rally points. Native approach geometry, mineral contact placement, crowded worker order service, exact drop-off-loss detection and automatic patch-search weights still need separate measurements. The public SCV catalog and available native build also predate the modern worker inner-radius patch. Do not replace current inner radius with this older engine's ordinary radius merely because the native trace reports `.375`.
