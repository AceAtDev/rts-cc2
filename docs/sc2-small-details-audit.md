# Small details audit — 9 October 2026

This audit compares the implemented Terran subset with Blizzard's control guides and pinned SC2 catalog data. It is not a claim of full engine parity. Catalog evidence identifies settings; it does not prove proprietary runtime arbitration or timing. Native research from earlier passes uses the historical 4.10 client, while current patch notes can describe newer behavior.

## Fixed in this pass

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

## Still missing or requiring measurements

| Detail | Evidence and remaining work |
| --- | --- |
| Command Center loading | Current implementation hides nearby workers instantly. Catalog search8/range1 and queueable Load/Unload require approach/contact and Shift scheduling work; geometry needs native capture. |
| Construction-worker motion | Building workers remain at one contact position with ordinary collision. Catalog Construction mover/PeonDisableCollision and patch5.0.14 relocation behavior merit their own measured pass. |
| Gas successors and repeated input | Explicit Gather and Smart gas commands reset progress alike; successors wait for deposit. Mineral behavior was measured earlier, but gas must be captured separately. |
| Repair autocast contexts | Hold can allow a repair pursuit. Patrol autocast is documented; Hold/Move/starvation policy is unmeasured. |
| Rally target loss/feedback | Dead target rallies are not cleared. Flag endpoints are click positions and queued rally routes are not fully displayed. Catalog ClearRallyOnTargetLost identifies a real follow-up. |
| Unit/rally queue bounds | Both remain unlimited. Blizzard documents bounded queues and a full-queue error; this audit did not establish the numeric runtime limit. Production's five slots are a separate rule. |
| Broader fidelity | Native crowd steering, full enemy strategy, complete races/abilities, authored models, audio and animation remain distinct from SC2. These fixes do not certify identical smoothness. |

## Sources

- [Blizzard Unit Control](https://news.blizzard.com/en-us/article/4552957/game-guide-unit-control): focus fire, retreating targets, attack-move and target queues.
- [Blizzard Simplified Controls](https://news.blizzard.com/en-us/article/6640645/game-guide-simplified-controls): attack-warning navigation, selection, command and camera controls.
- [Blizzard Special Control](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control): eight recent transmissions, bounded queues, queued loading/unloading and selection helpers.
- [Blizzard Basic Unit Controls](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls): move/follow and repair autocast during Patrol.
- [Blizzard Buildings](https://news.blizzard.com/en-us/article/4488317/game-guide-buildings): resource and unit-target rallies.
- [Blizzard patch5.0.14](https://news.blizzard.com/en-us/article/24162754/starcraft-ii-5-0-14-patch-notes): construction worker relocation timing.
- [Pinned Core ability catalog](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AbilData.xml): attack/move feedback colors, Train BestUnit, transport defaults.
- [Pinned Core game catalog](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/GameData.xml): UnitSightRangeUnderConstruction4.
- [Pinned Core alerts](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AlertData.xml): distinct attack warnings, pulses, overlap settings, hidden worker completion and separate errors.
- [Pinned Core hotkeys](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/enus.sc2data/LocalizedData/GameHotkeys.txt): both camera-location banks and zoom endpoints.
- [Pinned Core unit catalog](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/UnitData.xml): ClearRallyOnTargetLost.
- [Pinned Liberty requirements](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/RequirementData.xml) and [nodes](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/RequirementNodeData.xml): queued-or-better team upgrade exclusion.

Worker details, exact fields, uncertainty and sources are expanded in [worker-interaction-audit.md](worker-interaction-audit.md). Scoped implementation notes: [attack-move](attack-move-fidelity.md), [repair](repair-cost-fidelity.md), [alerts](alert-feedback-followup.md).

## Validation

26 new browser integration checks exercise the real dispatcher, production DOM and keyboard bindings. All25 isolated modules pass (417 checks). Existing autonomous50, gameplay31 and input15 browser checks also pass:122 browser checks in this pass. Browser tests use headless Chromium/software WebGL; they do not measure human-perceived input latency or certify native parity.
