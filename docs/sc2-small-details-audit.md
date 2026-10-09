# Small details audit — 9 October 2026

This audit compares the implemented Terran subset with Blizzard's control guides and pinned SC2 catalog data. It is not a claim of full engine parity. Catalog evidence identifies settings; it does not prove proprietary runtime arbitration or timing. Native research from earlier passes uses the historical 4.10 client, while current patch notes can describe newer behavior.

## Earlier detail fixes

| Detail | Demo gap found | Result |
| --- | --- | --- |
| Attack-move target handoff | Equal-priority retreating target stayed locked despite an available target in weapon range. | AttackMove/Patrol can substitute the nearest equally ranked in-range enemy when the incumbent is out of range. Manual focus and pursuit without alternatives remain intact. |
| Queued enemy intent | Observed target position was captured only when the queued command activated. Shift lines could read live hidden coordinates. | Capture a position at acceptance; active orders update it while visible. World/minimap paths use the observed snapshot in fog. |
| Command feedback | Explicit Move targeting an enemy showed an attack marker; every queued path was green. | Markers follow accepted order type. Attack paths are red; Move paths green, including minimap paths while Shift is held. |
| Attack transmissions | Damage emitted no warning; errors occupied Space's location history. | Hostile own-team damage emits base/forces warnings with bounded minimap pulses. Space cycles eight location snapshots; errors remain notices. Throttle timing is a documented custom policy. |
| Multi-building production | Shortest queue was chosen before checking eligibility; active bare Barracks blocked another selected Barracks with a Tech Lab. | Eligibility is checked before queue length; command card and tooltip use the same availability. Native best-producer weighting is not reproduced. |
| Research prerequisites | Two labs could charge for the same pending team upgrade. | Pending team research blocks duplicate purchase; cancellation makes it available again. |
| Production cancellation | HUD recreated queue buttons repeatedly; stale clicks could refund twice, and enemy queues were actionable. | Stable item-bound buttons, one refund per live item, enemy queue read-only. This fixes a demo input defect rather than proving native DOM-equivalent behavior. |
| Repair final tick | Resource drain used nominal HP even when only a tiny amount of damage remained. | Clamp restored HP before charging the quarter-cost fraction. Native fractional resource rounding remains unmeasured. |
| Camera locations | Shift bank was ignored; Home/End were absent. | Independent two banks of four locations and zoom endpoint bindings. |
| Construction sight/noise | Planned structures granted vision, unfinished structures had finished sight; each trained SCV emitted a readiness transmission. | Planned ghosts grant no vision; constructing structures use catalog sight4. Worker readiness no longer fills transmission history. |

## Six previously missing gaps resolved

These were implementation gaps in the earlier audit. The follow-up implements and checks their control transitions; historical native observations and current construction patch notes establish the comparison boundaries below.

| Detail | Implemented result and evidence |
| --- | --- |
| Command Center loading | Five-capacity reservations, visible worker approach/contact, cargo-preserving boarding, passenger buttons and grounded/flying destruction outcomes replace instant hiding. Grounded Load/Unload, including Shift, execute immediately during Train; production is not a transport-order barrier. Shift Load/Unload wait behind an existing flying Move. Native 4.10 supports these distinctions; approach and multi-passenger exit geometry remain authored. See [transport comparison](transport-fidelity.md) and [transport module](../dist/transport.js). |
| Construction-worker motion | Ordinary collision during approach, then periodic service movement through the current building footprint while progress continues; Halt/death/replacement clear ownership. An additional queued builder waits with successors intact and can take over. Historical 4.10 supports interior movement and continuous progress; the implemented 4.64–6.07-second relocation bounds and sequential-Build fix come from patches 5.0.14/5.0.16. RNG, service trajectories and takeover geometry remain prototype policies. See [construction comparison](construction-fidelity.md) and [construction module](../dist/construction.js). |
| Gas successors and repeated input | Queued successors activate on gas emergence with earned cargo, before deposit. Repeated visible approach Gather/Smart preserves extraction timing; known-tag hidden-worker commands were unavailable in native 4.10 and are rejected by the host rather than assigned an invented reset rule. Gather with existing cargo visits the resource first, then returns or promotes its successor at contact. See [native gas/cargo observations](native-worker-gas-followup.md) and [worker module](../dist/workers.js). |
| Repair autocast contexts | Idle and Patrol can approach and restore their interrupted context; Hold repairs only at contact, and Move suppresses acquisition. Acquisition requires funds; manual unfunded Repair is rejected, Smart falls back to Follow, and exhausted manual Repair promotes its successor without silently restarting. These transitions have native 4.10 observations; contact tolerances and candidate tie-breaking remain authored. See [repair context comparison](repair-autocast-fidelity.md) and [intent module](../dist/repair-autocast.js). |
| Rally target loss/feedback | Full selected-owner world/minimap chains follow friendly moving targets. Known-lost ordinary targets are pruned while valid successors survive; lost minerals retain Gather-at-point and local resource recovery. Every resource link converts to Move for combat births. Catalog flags and native 4.10 observations establish the lost-unit/resource distinction; recovery polling/search weights remain prototype policies. See [queue/rally comparison](order-queue-rally-followup.md) and [queue module](../dist/order-queues.js). |
| Unit/rally queue bounds | Admission now limits unit queues to 32 total orders including the active order, and rally chains to four total targets. Distinct overflow notices, accepted-cohort feedback and preflight before paid placement prevent false success and lost resources. Native 4.10 Marine and Command Center threshold trials establish these limits; current-build and producer-specific variants remain unmeasured. Production's five slots are a separate rule. See [queue/rally comparison](order-queue-rally-followup.md) and [queue module](../dist/order-queues.js). |

## Remaining fidelity work

| Detail | Evidence and remaining work |
| --- | --- |
| Native geometry and current-client behavior | Exact crowd steering, transport contact/exit placement, construction trajectories and RNG, repair rounding/tie-breaking, and resource-point polling need further comparisons. Historical 4.10 transitions do not certify the modern engine. |
| Broader fidelity | Native crowd steering, full enemy strategy, complete races/abilities, authored models, audio and animation remain distinct from SC2. These fixes do not certify identical smoothness. |

## Sources

- [Blizzard Unit Control](https://news.blizzard.com/en-us/article/4552957/game-guide-unit-control): focus fire, retreating targets, attack-move and target queues.
- [Blizzard Simplified Controls](https://news.blizzard.com/en-us/article/6640645/game-guide-simplified-controls): attack-warning navigation, selection, command and camera controls.
- [Blizzard Special Control](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control): eight recent transmissions, bounded queues, queued loading/unloading and selection helpers.
- [Blizzard Basic Unit Controls](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls): move/follow and repair autocast during Patrol.
- [Blizzard Buildings](https://news.blizzard.com/en-us/article/4488317/game-guide-buildings): resource and unit-target rallies.
- [Blizzard patch5.0.14](https://news.blizzard.com/en-us/article/24162754/starcraft-ii-5-0-14-patch-notes): construction worker relocation timing.
- [Blizzard patch5.0.16](https://news.blizzard.com/en-us/article/24259080/starcraft-ii-5-0-16-patch-notes): queued construction on occupied structures and melee order retention during footprint passage.
- [Pinned Core ability catalog](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AbilData.xml): attack/move feedback colors, Train BestUnit, transport defaults.
- [Pinned Core game catalog](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/GameData.xml): UnitSightRangeUnderConstruction4.
- [Pinned Core alerts](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AlertData.xml): distinct attack warnings, pulses, overlap settings, hidden worker completion and separate errors.
- [Pinned Core hotkeys](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/enus.sc2data/LocalizedData/GameHotkeys.txt): both camera-location banks and zoom endpoints.
- [Pinned Core unit catalog](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/UnitData.xml): ClearRallyOnTargetLost.
- [Pinned Liberty requirements](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/RequirementData.xml) and [nodes](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/RequirementNodeData.xml): queued-or-better team upgrade exclusion.

Worker details, exact fields, uncertainty and sources are expanded in [worker-interaction-audit.md](worker-interaction-audit.md). Scoped implementation notes: [attack-move](attack-move-fidelity.md), [repair costs](repair-cost-fidelity.md), [alerts](alert-feedback-followup.md), and [six-gap integration](remaining-controls-integration.md).

## Validation

The completed six-gap follow-up passes 49 [remaining-details browser integration checks](../tests/remaining_details_integration.py) and 26 [construction integration checks](../tests/construction_integration.py). These exercise real dispatch, Load/Unload hotkeys during production, passenger clicks, paid-placement rollback, hidden-gas rejection, repair restoration, rally feedback, construction ownership and queued execution. The [integration report](remaining-controls-integration.md) records the isolated-suite and regression results. Browser tests use headless Chromium/software WebGL; they do not measure human-perceived input latency or certify native parity.
