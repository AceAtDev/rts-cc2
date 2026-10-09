# Per-unit combat AI follow-up

Study and implementation date: 2026-10-09. Scope is each unit's combat order executor, shared by player and opponent. Opponent macro, production, economy, navigation and the native simulation loop are separate systems. These changes make bounded corrections; passing the custom-engine regressions does not establish identical SC2 behavior.

## Evidence inspected

Primary catalog snapshot: Talv extracted build 74071, commit [`1921f856b0443d4cbd366c472cd7984fa6a224d1`](https://github.com/Talv/sc2-data/tree/1921f856b0443d4cbd366c472cd7984fa6a224d1). Local source copies are in `/workspace/scratch/sc2-reference/xml`, with validator copies in `/workspace/scratch/sc2-reference`.

| Source | Verified fact | Implementation consequence |
| --- | --- | --- |
| [Core UnitData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/UnitData.xml), default CUnit | Default acquisition is Offensive, damage response is Acquire. | Idle military units can respond to an attacker rather than indefinitely ignoring visible fire just outside scan. |
| [Core EffectData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/EffectData.xml), CEffectDamage `DU_WEAP` | Weapon damage enables Acquire and Flee response, and CallForHelp search. | Actual damage now alerts nearby allied helpers, using separately inspected Core GameData values and native helper-response captures. |
| [Core GameData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/GameData.xml), default CGame | CallForHelpRadius is 4; CallForHelpPeriod is 2 Normal seconds. | Import radius-inclusive surface range and convert the period to Faster once; controlled native captures confirm the two-.375-radius edge at center separation 4.75. |
| [Liberty UnitData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/UnitData.xml), SCV | Defensive acquisition, Flee response. | Retaliation pursuit does not silently turn idle SCVs into offensive combat units. Existing worker flee and task handling stay separate. |
| [Liberty ValidatorData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/ValidatorData.xml), TargetRadiusSmall/Large | Small is radius below 1.25; large is radius greater than or equal to 1.25. | Siege blast/direct routing uses the actual catalog radius boundary. |
| [Liberty multiplayer EffectData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/libertymulti.sc2mod/base.sc2data/GameData/EffectData.xml) and [Void multiplayer EffectData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/voidmulti.sc2mod/base.sc2data/GameData/EffectData.xml), CrucioShockCannonSwitch | Small targets use blast, large targets directed damage; a lowered Supply Depot explicitly uses blast. | Remove blanket structure splash exclusion while preserving the directed branch for large-radius targets. |
| [Blizzard basic unit controls](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls) | Move ignores enemies along the route; Stop permits engagement; Hold does not pursue; Patrol engages enemies. | Preserve explicit orders and patrol endpoints while temporary combat acquisition runs. |

## Changed behavior

Military units with Acquire response consider the unit that actually damaged them. A visible attacker beyond normal scan can become a temporary combat target. The pursuit is bounded by the larger of the unit's vision and existing weapon scan/range; a hidden attacker cannot be chased using live coordinates. Attack-move and patrol keep their original order, destination, patrol origin and queued commands throughout the engagement. Losing that temporary target returns control to the existing order executor.

The global catalog exposes acquire leash numbers, but the exact engine interpretation, target arbitration and acquisition cadence remain unresolved. The vision bound is an explicit custom policy. Equally important valid targets remain stable; a higher-priority military attacker may supersede a low-priority structure. No automatic kiting, focus-fire reassignment, target-health optimization or ability micro is added to player units.

Move, Follow, Land and Flee suppress retaliation and consume damage response telemetry so earlier attacks do not create a delayed chase after the movement order ends. Manual Attack keeps its chosen target. Hold, Siege and defensive acquisition only respond inside weapon range; an explicit unreachable attack zeroes inherited velocity when pursuit is forbidden. Issuing or completing an order clears response-target state without resetting weapon cooldown or inventing a shot event.

Siege impact now selects blast by radius below 1.25 game units or by the lowered-Depot exception. This allows a shot at a small add-on to splash, prevents an oversized mobile target from wrongly causing splash, and preserves the raised-Depot boundary's directed branch. Existing splash tiers, friendly-ground damage, armor, cooldown, damage point and actual-shot telemetry remain intact.

## Verification

`node tests/unit_ai_followup.mjs` passes 19 isolated checks covering retaliation, retention, fog, vision bound, order/queue preservation, all explicit movement suppressions, Hold, anchored velocity, defensive workers, target priority stability, manual overrides, last-seen coordinates, cooldown preservation, the native Siege effect branches and shot telemetry.

The browser micro/attack suites remain necessary integration checks because game.js owns order completion, worker flee, fog visibility and collision. The later [automatic combat pass](automatic-combat-fidelity.md) adds native-supported idle/Stop ally assistance and damage-origin snapshots, with 33 additional isolated checks. Native-client comparison remains necessary for broader response timing, pursuit trajectories, noncircular call-radius edges, weapon arc interpretation and random weapon delay.
