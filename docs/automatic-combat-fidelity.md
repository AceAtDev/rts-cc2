# Automatic unit decisions and allied assistance

Study and implementation date: 2026-10-09. This pass corrects shared per-unit combat decisions for both players and the opponent. It does not add automatic kiting, ability micro or undocumented health-based target optimization.

## Evidence

The primary [Core effect catalog](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/EffectData.xml), weapon damage `DU_WEAP`, enables `ResponseFlags Acquire`, `ResponseFlags Flee`, and `SearchFlags CallForHelp`. The [Core GameData](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/GameData.xml), default CGame, supplies:

| Field | Pinned catalog value | Treatment |
| --- | ---: | --- |
| CallForHelpRadius | 4 game units | Imported call radius; center-versus-footprint edge remains a bounded comparison item. |
| CallForHelpPeriod | 2 Normal seconds | Converted once to `2/1.4` real seconds at Faster. |
| AcquireLeashRadius | 21 game units | Recorded, not blindly applied without engine-semantic evidence. |
| AcquireLeashResetRadius | 5 game units | Recorded; reset behavior still requires comparison. |
| AcquireMovementLimit | 21 game units | Recorded; movement-limit semantics remain unresolved. |
| AttackRevealTime | 3 Normal seconds | Recorded; complete native reveal behavior is not implemented here. |

Liberty, Swarm, Void and their multiplayer GameData files did not override these fields in the pinned snapshot. These 2019 catalog values are not a claim about every current patch.

The native capture owner, using client `4.10.0.75689`, seed 42 and 22.4 Hz loop stepping, ran the helper scenario with fog disabled: idle helper Marine at `(36,42)`, held allied victim SCV at `(40,42)`, enemy Marine at `(44,42)` explicitly attacking the victim. The victim first takes damage on loop 2. Idle and Stop helpers acquire the enemy and begin moving on the same loop, even though the attacker starts eight game units from the helper, outside ordinary scan. The attacker first takes helper damage on loop 20. A Hold helper remains stationary and unengaged through 100 loops. These results support assistance rather than only personally damaged-unit retaliation. Native traces stay outside the repository.

Separate native scan cases show idle/Stop Marine beginning pursuit of an enemy SCV at six game units while seven game units produces no acquisition over 50 loops; Hold at six does not pursue. These agree with the existing scan-plus-footprint distinction. Enemy global AI can override issued enemy commands in these captures, so uncontrolled enemy default behavior and target-priority conclusions require stronger isolation.

An existing moving-target trace supports the normal recovery wait: Marine fires on loop 2, the target's footprint gap crosses weapon range on loop 9, and Marine first moves on loop 14. That is 12 loops after impact, matching `.75` Normal seconds of backswing at Faster. Removing that wait would add automatic micro absent from this measured case.

## Implemented behavior

Actual hostile damage broadcasts a bounded call to nearby living allied armed entities. Calls are throttled per victim by the imported period. Idle and Stop units with Acquire response can acquire the visible attacker outside ordinary scan. Both teams use the same logic. Existing equal-priority combat targets remain stable; explicit manual Attack and Move/Follow/Flee/work intent keep priority. Hold, Siege and defensive acquisition retain firing-range restrictions. Defensive Flee workers do not turn into offensive helpers.

The current call boundary uses helper-to-victim center distance of four game units. That matches the captured positive case at four; whether the native edge includes radii is still under targeted comparison. The global effect's radius-offset flags cannot alone establish the precise help-search interpretation. Target pursuit still uses the existing explicit custom visibility/vision policy rather than claiming the newly found 21-unit leash numbers define the whole algorithm.

`combat.flushHelp(dt)` handles the entity-update ordering problem: a helper may already have spent its loop idle when a later entity applies damage. Root calls this once after per-entity updates and before collision. It assigns the new target and permits one approach movement only for already-processed truly idle units. It does not run engage, cooldown, windup, or firing again; travelling units cannot advance twice. Helpers processed after damage consume the call during their regular update. Repeated flush calls are idempotent. This narrow reaction pass matches the native same-loop idle helper response without replaying a unit's complete update.

Real damage also stores `lastDamageSourcePosition`. Instant shots record their origin immediately; missile impacts retain their launch origin rather than reading the launcher's later hidden position. Worker Flee integration can use that immutable observation when the attacker is no longer visible. Existing mining/construction flee semantics are unchanged.

## Verification and limits

`node tests/automatic_combat_fidelity.mjs` passes 25 checks covering same-loop idle assistance for both teams and both entity orderings, Stop/Hold, the current radius policy, explicit intent preservation, defensive workers, fog, idempotent flush, no double movement, throttling/reset, immutable instant/missile origins and the observed recovery boundary. Root's browser integration reports 23 additional passing checks across assistance, fog-safe worker flee and opponent/worker integration.

The prior attack-phase 15, order-fidelity 20 and unit-AI 19 isolated checks also pass. Exact help-search edges, broader target arbitration, attack-move/patrol leash behavior, attack reveal, native random weapon delay and moving-target damage-point phases remain comparison work.
