# Worker recovery and resource lifecycle

Audit date: 2026-10-09. This pass follows resource validity and ownership through worker death, transport, changed orders, resource destruction and returning cargo. The measured mineral extraction and wait behavior from [Native SCV harvest phases](native-worker-phases.md) remains unchanged.

## Corrected failures

Automatic mineral searches used only remaining amount to decide whether a field was usable. A destroyed field with retained amount could therefore win the search, including the search used to recover from an invalid current resource. Searches and active Gather now exclude fields whose optional health is nonpositive. Mineral nodes without health metadata remain supported, as in the ordinary map.

If a field became invalid while being actively harvested, reassignment released the old ownership pointer but left the order in its previous `harvest` phase. The next update then discovered the mismatched pointer and only reset travel, delaying the actual approach. Recovery now resets the phase to `out` when it assigns the new field, so the fresh resource receives travel and extraction service normally. No unfinished cargo is created during this handoff.

Availability-only searches previously treated any stored `harvester` pointer as a valid reservation. A dead, transported or no-longer-harvesting SCV could hide an otherwise usable field until another worker happened to service that particular field's cleanup path. Both search and extraction now agree that a valid owner must be alive, outside transport, actively harvesting and holding that resource's ownership pointer. Invalid stored owners are released before acquisition. Living active harvesters continue to reserve their fields exclusively.

Assigning Gas to a Refinery without a linked resource backing could reach extraction and dereference an absent amount object. Such an invalid order now completes safely and promotes the queued next task. Completed refineries backed by live geysers retain the existing gas extraction timing. Waiting on a legitimate unfinished Refinery remains supported.

## New native command and drop-off evidence

The sole native API research owner captured four additional controlled SCV trials with the same pinned native build `4.10.0.75689`. This batch used two Participant clients, so action execution has an extra submission loop relative to the earlier single-Participant phase trial. Its relative event loops should not be mixed with the earlier loop-67 table when evaluating input latency.

| Native trial | Derived observation | Correction |
| --- | --- | --- |
| Explicit Gather repeated at requested loop 50 | First cargo at 68, preserving the original extraction | Same-field explicit Gather preserves progress and ownership |
| Smart/right-click repeated at requested loop 50 | First cargo at 97, 29 loops later than explicit Gather | Smart retains its native extraction restart; do not merge these command sources |
| Current field killed at 50 with a nearby and a distant live field | Gather targets the nearby field by observation 53, without earning old-field cargo; first new cargo at 132 | Invalid-field recovery releases the old extraction and approaches a living local replacement |
| All friendly drop-offs absent, new Command Center requested at 120 | Cargo earned at 68; Return remains stationary with cargo and no target; new base target appears at 124, deposit at 150, Gather resumes | Gather must not cancel merely because no grounded drop-off exists |

The host annotates explicit G/command-card Gather with `gatherCommand:'gather'` and mineral right-click with `gatherCommand:'smart'`. Direct internal mine orders default to explicit Gather behavior. Preservation applies only to an already-owned, living mineral field with unfinished extraction. A new destination releases the old slot and progress. This pass does not assume the same reissue policy for gas without a native gas trial.

Gather can now approach and extract with every drop-off absent. After its existing eight-loop wait, an SCV carrying minerals keeps its return intent and cargo while stationary. A newly usable grounded base restarts the home leg. Missing bases no longer prematurely clear the uninterruptible wait or activate its queued successor early. The implementation detects base availability each simulation update; the native trial's exact base-spawn acquisition polling interval is not established by one observed delay.

## Validation and integration

`node tests/worker_recovery.mjs` runs 15 isolated scenarios covering dead mineral search, destruction during extraction, no remaining live fields, stale owners, transported owners, invalid gas backing, earned gas after Refinery destruction, lifted return fallback, explicit Gather versus Smart reissue, changed-resource progress, no-home extraction, return resumption and drop-off loss during the cargo wait. The existing 37 isolated worker checks still pass, including the native 45-loop extraction, eight-loop mineral wait, early slot release and queued successor carrying cargo.

The gas-destruction and lifted-drop-off scenarios exercise the real worker module but bypass browser input and the host's target-death dispatcher. The host must allow a worker already carrying resources to service its return logic rather than canceling it because its previous Refinery or selected drop-off died. Browser integration tests must cover that dispatch order. These recovery validations establish prototype consistency; they do not independently prove every native resource search or route.

## Remaining comparison points

[The gas follow-up](native-worker-gas-followup.md) now measures gas queued successors and visible approach/return reissues, and distinguishes inaccessible hidden-worker commands from measured extraction restart behavior. Exact patch search weights, contested-field reassignment, blocked-resource approaches, hidden gas UI input and base-spawn search polling still require further comparisons. Blocked-resource path handling belongs to movement/navigation: an explicit worker target must not silently become a distant economy assignment merely because approach is difficult. No licensed raw observations, executable, map contents or native assets are included in this repository.
