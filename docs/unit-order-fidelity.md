# Combat orders, target persistence and pursuit

Follow-up study: 2026-10-09. This pass examines per-unit command intent, rather than opponent strategic decisions. Sources are Blizzard's official control guide and pinned build-74071 extracted catalogs. The native client is unavailable; custom bounds and planner behavior remain explicit approximations.

## Native behavior supported by primary sources

The [Blizzard Basic Unit Controls guide](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls), inspected again during this pass, says:

> If you select an enemy unit, your unit will move towards and attack the targeted enemy until it or the enemy dies (or until you issue another command).

> All the units you've ordered to attack it will stop moving when the enemy unit is killed.

This supports completing manual Attack when the target dies. It does not support inventing a new aggressive objective at the corpse or replacing queued Shift commands with another attack-move. Existing game.js target-death completion is retained.

The same guide says Move ignores enemies even when attacked, Hold does not pursue, Stop allows pursuit, and Patrol resumes its route after combat. The [pinned Liberty in-game Move tooltip](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/enus.sc2data/LocalizedData/GameStrings.txt), `Button/Tooltip/Move`, supplies a detail absent from the prose guide:

> Orders selected units to move to the target area or follow the target unit. Moving units will not engage enemies.

The integration should therefore distinguish M-click ground from M-click a unit. Following an enemy still needs visibility-safe last-seen behavior; the tooltip does not establish a precise native follow offset or fog timeout.

The [Core attack ability](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AbilData.xml) excludes Hidden, Dead and Invulnerable automatic targets. [Core WeaponData](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/WeaponData.xml) requires visible targets and supplies RangeSlop. These fields do not reveal the native target scoring algorithm or pursuit leash.

## Corrected failures

An explicit target can disappear between input acceptance and its first simulation loop. Previously no last-visible position had been recorded, leaving Attack stuck without a safe destination. `combat.acceptOrder(e)` now records the target while it is actually visible at acceptance. Root calls it when activating a newly accepted order or a Shift successor.

On later visibility loss, the fallback keeps accepted/started loop metadata and batch intent, moves to the last visible point, and preserves the existing Shift queue. It removes the live target pointer from the fallback order so Shift waypoint rendering cannot reveal hidden coordinates. The explicit target is remembered separately; reappearance restores that target preference instead of silently converting the original targeted Attack into arbitrary attack-move targeting. Hidden target death does not alter the fallback or discard the remembered identity. When death is observed, the explicit completion intent returns to the order executor; friendly deaths are known independently of enemy fog. Stop, Move and order completion clear this memory. This last-seen and reacquisition policy is a custom visibility-safe implementation of persistent manual intent; exact native transitions still need a capture.

The integration refreshes its local order reference after combat returns control. That allows last-seen movement in the same simulation loop rather than one extra stationary loop caused by a stale `const o`.

Automatic acquisition and automatic pursuit now have separate boundaries. An unseen-before enemy still must enter ordinary scan; a visible acquired target can be retained while closing beyond scan-plus-range-slop. Retention uses the current documented vision bound to avoid repeatedly dropping and reacquiring enemies near scan. Hold, Siege and defensive workers still require firing range. This bound is custom, not an imported native leash.

Initial equally important candidates are compared by footprint contact distance, matching the footprint geometry used for weapon range. Existing equally important targets stay stable, and an optional explicit `attackTargetPriority` field overrides the supported-unit fallback values. No undocumented threat weighting or low-health focus-fire algorithm is claimed.

## Pursuit integration findings

Movement's march reservation and march corridor used to apply to pursuit calls as well as the attack-move destination. A pursuing unit could therefore move toward its reserved final slot instead of its enemy. The movement owner restricts these to `point === e.order`.

Movement also recomputed a radial stop-at goal from the attacker's changing position, canceling pending searches even when the enemy stayed still. The movement owner adds stable pending-goal snapshots and retains usable corridors during replacement planning. Combat continues passing the actual target object, retaining target-aware crowd avoidance and live range checks. These are custom solver fixes, not Blizzard navigation code.

Normal automatic attack recovery remains intact. A newly issued explicit Move cancels backswing while preserving cooldown; there is no blanket removal of automatic attack backswing. The later [automatic combat pass](automatic-combat-fidelity.md) verifies one native recovery boundary and adds observed idle/Stop ally assistance. Native attack-arc interpretation, random delay, broader assistance edges and exact pursuit trajectories remain open comparison work.

## Verification

`node tests/unit_order_fidelity.mjs` passes 20 checks covering vanish-before-first-loop, visibility-safe acceptance, metadata and queue preservation, absence of hidden Shift waypoint coordinates, explicit-target restoration, cancellation, visible versus hidden target death, own-unit death, scan versus retention boundaries, Hold, footprint target choice, catalog priority override, stable targets, explicit Move suppression and backswing/cooldown behavior.

The 19 prior `tests/unit_ai_followup.mjs` checks also pass. Game.js integration needs browser checks for acceptance hooks, same-loop fallback movement, queue promotion and M-click unit targeting. Endpoint and isolated checks do not establish native-client smoothness.
