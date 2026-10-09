# Idle pursuit origin and return behavior

Follow-up date: 2026-10-09. This is a separate combat-controller change after the allied-assistance pass. It distinguishes unsolicited idle engagement from a player's explicit Attack, Move, Hold, Attack Move or Patrol intent.

## Native observations

The capture owner used two Participant players, client `4.10.0.75689`, 22.4 Hz stepping and disabled fog. The measured cases and limitations are recorded in [native autonomous observations](native-autonomous-observations.md). Native maps and raw traces remain outside the public repository.

An idle Marine starting at `(36,42)` acquires an enemy at `(42,42)`. The target begins retreating toward `(72,42)` after its loop-8 Move executes on loop 9. The Marine still retains that target at approximately `9.9199` units of separation on loop 140. At loop 171, the Marine is at `x=57.796875`, about `21.796875` game units from its acquisition origin, drops the target and returns to `(36,42)` by loop 326. Personal nine-unit vision distance is therefore not a valid unconditional target-retention cutoff when the target remains observable.

In a separate idle case, the acquired target is removed at loop 80. It is absent by loop 83, and the Marine at `x=44.859375` has begun its return to the original point. The Marine reaches `(36,42)` by loop 146. This directly supports remembering an acquisition origin and returning after an idle engagement ends.

Attack Move and Patrol behave differently with the same retreating target. They continue past 21 units of displacement, pursue and kill the target near Marine `x≈70.786`, then resume the original destination `(60,42)`. Those contexts should not inherit the idle leash or become a new idle mission.

The pinned [Core GameData](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/GameData.xml) exposes AcquireMovementLimit 21, AcquireLeashRadius 21 and AcquireLeashResetRadius 5. The observed `21.796875` cutoff could involve radii, loop stepping or another rule; the captures do not uniquely determine that calculation. Existing return captures contain no other nearby enemy and no incoming damage, so target reacquisition and retaliation during return are also unmeasured. The implementation does not invent a five-unit reset rule.

## Implemented policy

An offensive mobile unit with no explicit order remembers its position when it first acquires a combat target. When the target dies or becomes invalid, it returns toward that position. A visible target is retained beyond personal vision distance. A conservative custom displacement limit of 21 game units uses the catalog movement value to end distant idle pursuit. This intentionally does not claim the native `21.796875` observed boundary has been reproduced exactly.

Attack Move and Patrol retain actually visible acquired targets beyond personal vision and beyond the idle displacement limit. Their existing original destinations, patrol origin and Shift queues remain intact, so the ordinary order executor resumes the route after combat. Manual Attack, explicit Move, Hold, Siege, buildings and defensive idle workers do not create an offensive idle-anchor mission.

New player orders, Stop/Hold overrides, order completion and reset clear the old mission. Stop can then create a fresh acquisition origin at its new position if it finds another enemy. No gameplay metadata is stored in a replacement explicit order, so the controller cannot consume or overwrite a queued command to return home.

The custom return-state interruption policy is modest: the unit may defend inside its weapon range, but it does not begin another distant chase while returning. The original anchor survives that defensive engagement. This prevents repeated chase/return oscillation without asserting unmeasured native reacquisition semantics. A fully returned unit clears the mission and resumes ordinary acquisition. Return arrival uses the custom movement solver's one-world-unit tolerance, rather than claiming exact native endpoint equality.

Automatic target loss to fog also causes an idle return, without consulting hidden live coordinates. That is an explicit visibility-safe prototype policy; the new native no-fog captures do not establish how the client handles this fog-loss case. Manual targeted Attack keeps its separate last-seen intent handling.

## Verification

`node tests/idle_anchor_fidelity.mjs` passes 14 isolated checks covering both teams, target death, retained visible targets beyond personal vision, the custom movement cutoff, Attack Move/Patrol context and queue preservation, explicit manual/Move/Hold overrides, defensive workers, bounded return defense, fog safety, a fresh Stop origin and reset.

The existing automatic-combat 33, attack-phase 15, order-fidelity 20 and unit-AI 19 checks also pass. One older order test that required a visible target to be dropped solely for exceeding personal vision was corrected to match the new native evidence. Browser integration remains necessary for actual navigation, fog, explicit-order activation and collision. Exact native cutoff arithmetic, return interruption rules and fog transitions remain unverified.
