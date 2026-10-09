# Worker recovery and resource lifecycle

Audit date: 2026-10-09. This pass follows resource validity and ownership through worker death, transport, changed orders, resource destruction and returning cargo. The measured mineral extraction and wait behavior from [Native SCV harvest phases](native-worker-phases.md) remains unchanged.

## Corrected failures

Automatic mineral searches used only remaining amount to decide whether a field was usable. A destroyed field with retained amount could therefore win the search, including the search used to recover from an invalid current resource. Searches and active Gather now exclude fields whose optional health is nonpositive. Mineral nodes without health metadata remain supported, as in the ordinary map.

If a field became invalid while being actively harvested, reassignment released the old ownership pointer but left the order in its previous `harvest` phase. The next update then discovered the mismatched pointer and only reset travel, delaying the actual approach. Recovery now resets the phase to `out` when it assigns the new field, so the fresh resource receives travel and extraction service normally. No unfinished cargo is created during this handoff.

Availability-only searches previously treated any stored `harvester` pointer as a valid reservation. A dead, transported or no-longer-harvesting SCV could hide an otherwise usable field until another worker happened to service that particular field's cleanup path. Both search and extraction now agree that a valid owner must be alive, outside transport, actively harvesting and holding that resource's ownership pointer. Invalid stored owners are released before acquisition. Living active harvesters continue to reserve their fields exclusively.

Assigning Gas to a Refinery without a linked resource backing could reach extraction and dereference an absent amount object. Such an invalid order now completes safely and promotes the queued next task. Completed refineries backed by live geysers retain the existing gas extraction timing. Waiting on a legitimate unfinished Refinery remains supported.

## Validation and integration

`node tests/worker_recovery.mjs` runs nine isolated scenarios covering dead mineral search, destruction during extraction, no remaining live fields, stale owners, transported owners, invalid gas backing, earned gas after Refinery destruction, and return fallback when a selected Command Center lifts. The existing 37 isolated worker checks still pass, including the native 45-loop extraction, eight-loop mineral wait, early slot release and queued successor carrying cargo.

The gas-destruction and lifted-drop-off scenarios exercise the real worker module but bypass browser input and the host's target-death dispatcher. The host must allow a worker already carrying resources to service its return logic rather than canceling it because its previous Refinery or selected drop-off died. Browser integration tests must cover that dispatch order. These recovery validations establish prototype consistency; they do not independently prove every native resource search or route.

## Native comparison points

Repeated targeted Gather and Smart during extraction, unavailable drop-offs, and destroyed-field automatic search are being compared through the sole native API research owner. Do not invent progress preservation, an automatic escape order, or a global expansion transfer until that evidence exists. Blocked-resource path handling belongs to movement/navigation: an explicit worker target must not silently become a distant economy assignment merely because approach is difficult.
