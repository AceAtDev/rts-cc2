# Historical native autonomous-unit observations

Actual SC2 raw-API captures on 2026-10-09 measured assistance, worker command repetition and recovery, worker reactions to damage, and acquired-target pursuit. The strongest new evidence uses two Participant players controlled by separate local clients, with no computer strategic or tactical controller. These are bounded historical observations; they do not establish current-patch parity, complete unit AI, human input feel, or the full SC2 interface.

## Provenance and method

| Field | Recorded value |
| --- | --- |
| Actual game version | `4.10.0.75689` |
| Base / data build | `75689` / `75689` |
| Data version | `B89B5D6FA7CBF6452E721311BFBC6CB2` |
| Map | Official `Flat64.SC2Map`, display name `Simple Test Map 64x64` |
| Map SHA-256 | `e699838666a5b27754fc82e97342559186e5edd1ae29b0f2c3aaa711a616107d` |
| Random seed | `42` |
| Authoritative setup | Non-realtime, raw interface, fog disabled, two Terran Participant players |
| Local control | Separate loopback API endpoints, player IDs `1` and `2` |
| Sampling | Every game loop; Faster elapsed time represented as loops / `22.4` |

Both clients step together. Each player's own-side raw observations supply its units' orders, cooldowns, and engaged-target tags; the research runner merges those observations by tag while preserving the primary player's alliance classification. Actual positions, facing, health, order state, resource contents, cargo buffs, command results, and action execution loops are recorded. Labels refer to actual native tags, not guessed tag values.

The two-Participant API setup exposes a one-loop delay between submitted commands and the reported execution loop in the measured commands. For example, initial Gather requested at relative loop `0` reports execution loop `1`, and repeated Smart requested at `50` reports execution loop `51`. The observations retain those timings. They do not measure human input latency or justify shifting native trajectories to fit the browser.

Fixtures use debug creation/removal to establish controlled actors and retain buildings to keep the match active. Normal damage, health, weapons, and cooldowns remain active; no damage suppression or cooldown-reset cheat is used. Enemy Hold and explicit Attack/Move commands are issued through that player's actual client. Local structures/resources created for a worker fixture are removed before later combat fixtures so they do not obstruct the lane. The no-home worker fixture retains a Supply Depot while removing every friendly townhall, then creates a new local Command Center.

An earlier exploratory batch used a Very Easy computer and `control_enemy`. Its helper response was positive, but held enemy Marines could receive computer movement overrides. That batch is not used to establish opponent default-unit parity or cold target-priority rules. The two-Participant captures remove that controller confound. Permission and package sources are recorded in [native-client-license-boundary.md](native-client-license-boundary.md); binaries, maps, and raw captures remain outside the public repository.

## Ally assistance, radius, and current target

A Marine helper begins outside ordinary acquisition range of an enemy Marine. A nearby friendly SCV is held in place, and the opposing player explicitly commands the enemy Marine to attack that SCV. The helper receives no Attack command and takes no personal damage before responding.

The helper's engaged-target tag becomes the attacker on the same sampled loop as the victim's first health loss. Its first translation occurs on the following sampled loop in the two-Participant fixtures. A mirrored fixture with player `2` owning the helper and victim produces the same assistance behavior, independently of a computer controller. A separate owner-`2` idle Marine also autonomously acquires and damages a held player-`1` SCV.

Measured helper/victim radii are both `0.375` game units. Center distances `4`, `4.010009765625`, `4.375`, and `4.75` all produce assistance; distance `5` does not. A perpendicular arrangement keeps the attacker within sight but outside ordinary acquisition range and confirms assistance at `4.75`, with no assistance at `4.760009765625` or `5` over sixty loops. These observations fit the catalog help radius `4` plus both actors' radii, with an inclusive boundary at `4.75` for these actors. They do not measure every mixed-radius combination or the help-period schedule.

With an established automatic target, the helper replaces an unarmed Overlord target to assist against the Marine attacker. When its established target is another armed Marine, it keeps that target throughout the sixty-loop observation rather than switching to the ally's attacker. This distinguishes assistance from unconditional retargeting. It does not reconstruct the full proprietary target scorer, all priority ties, or every retaliation condition.

## Repeating worker commands

The worker approaches one explicitly selected MineralField near a grounded Command Center. The same selected node is commanded again during extraction at relative loop `50`:

| Repeated action | Observed first cargo | Observed result |
| --- | --- | --- |
| Explicit Gather, runtime ID `3666` | Loop `68` | Progress is preserved; no additional executed-action observation appears for the redundant command |
| Smart, runtime ID `1` | Loop `97` | Repeated action executes at `51`; extraction restarts and cargo is delayed |

Both action requests return Success. The worker remains at the same field, so the difference is not travel to another node. The Smart result supports preserving native distinctions between an explicit Gather command and a repeated right-click Smart command; it does not justify deduplicating both indiscriminately. Mining after the repeat, cargo, field contents, drop-off, and player mineral changes remain observed through loop `180`.

## Resource loss and missing drop-off

During extraction, debug removal of the selected mineral is requested at loop `50`. The worker automatically changes its harvest order to the nearby live field by loop `53`, then extracts and returns cargo. A farther live field is also present, so this establishes a nearby recovery choice in this geometry; it does not establish the exact reacquisition radius or general saturation scorer.

With every friendly townhall absent, the worker still approaches the selected mineral and obtains cargo on loop `68`. It remains at the field with the return order `296` and no target tag instead of discarding its task or cargo. A local Command Center is requested at loop `120`; the worker's return order names that new base by loop `124`, and deposit occurs on loop `150`, restoring its harvest order afterward. This measures retention and reactivation when a suitable drop-off appears, not every destruction or construction case.

## Workers under fire

An idle SCV attacked by an opposing Marine receives an automatic Move exactly five game units away: from `(43,42)` toward `(43,37)`. A stopped SCV does the same. After arrival and renewed damage, another five-unit escape occurs. The worker has no engaged attack target during those movements. A held SCV remains at `(43,42)` while taking damage.

A worker already harvesting when the attacker receives its Attack command at loop `50` preserves its task. It completes cargo creation at `68`, returns and deposits at `102`, and resumes Gather while its health falls from `45` to `3` over the one-hundred-sixty-loop capture. No flee or retaliatory attack replaces its Gather/Return orders. These results support task-sensitive worker reactions rather than applying idle escape behavior to every damaged worker. They do not cover repair, construction, gas, every attacker type, or grouped worker defense.

## Acquired-target pursuit and return

A Marine at `(36,42)` automatically acquires an SCV initially at `(42,42)`. The opposing player commands the SCV to retreat toward `(72,42)` at loop `8`, reported as execution loop `9`. Fog is disabled, so the target remains visible while separating from the Marine.

The idle Marine retains the target beyond ordinary scan range and beyond a nine-game-unit separation: the measured gap is approximately `9.919921875` at loop `140`. At loop `171`, the Marine reaches `(57.796875,42)`, drops the engaged target, and returns toward its acquisition position `(36,42)`. It arrives there and becomes idle by loop `326`. Its maximum displacement from that position is approximately `21.796875` game units. This is compatible with a catalog movement boundary near `21` plus radius/step effects, but the trace does not uniquely prove the internal threshold calculation.

A second idle fixture removes the acquired target at loop `80`. The target is absent and the Marine's return order is active by loop `83`, from `(44.859375,42)`; the Marine returns to `(36,42)` by loop `146`. These cases directly establish return to an acquisition position after an idle engagement ends. There are no other nearby enemies during those returns, so reacquisition, retaliation during return, and the catalog reset-radius semantics are unmeasured.

Attack Move and Patrol differ in the same retreat setup. Both retain the acquired target past twenty-one game units of displacement, pursue and kill it near Marine position `x≈70.786`, then resume their original march/patrol destination `(60,42)`. They are still returning toward that destination at loop `420`. The target's final retreat and post-arrival escape interact with the map's pathing, so those trajectories are not an unobstructed point-movement benchmark.

These observations reject an unconditional nine-unit distance drop for an acquired target that is actually visible. They support separate idle engagement return behavior from Attack Move/Patrol pursuit. They do not establish fog-enabled loss-of-sight rules, reveal permissions, hidden-target pursuit, every leash condition, or an exact implementation of the catalog's reset radius.

## Scope of the evidence

The captures establish meaningful behavioral triggers and distinguish several command contexts. They do not show that the browser already matches every trajectory or that all autonomous decisions should use one rule. Native command-phase timing, ordinary target priority, vision loss, mixed-unit crowds, return interruptions, mining geometry, tactical opponent planning, and human controls still require their own validation. Prototype regression tests and derived policies should remain labeled separately from native observations.
