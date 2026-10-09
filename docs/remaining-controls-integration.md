# Closing the six control gaps

This pass implements all six gaps listed in the October small-details audit, throughout the simulation, command dispatcher, keyboard controls and displayed feedback.

| Gap | Completed behavior | Evidence and limits |
| --- | --- | --- |
| Command Center transport | Capacity-limited SCV approach/boarding, ground/flying Load and Unload, queued flying actions, passenger UI, group memory and destruction outcomes | [Transport comparison](transport-fidelity.md) |
| Construction-worker motion | Periodic service movement through the current footprint while construction continues; ordinary approach collisions, Halt/resume and one builder; occupied sequential Build waits and permits takeover | [Construction comparison](construction-fidelity.md) |
| Gas commands and queues | One hidden extractor per Refinery; prequeued orders activate at emergence with earned cargo; hidden inputs are rejected; repeated visible Gather/Smart and carried Gather retain measured phase distinctions | [Native gas and cargo observations](native-worker-gas-followup.md) |
| Repair autocast | Idle return, Patrol restoration, contact-only held repair, funded acquisition, exhaustion/completion transitions and Smart fallback | [Repair comparison](repair-autocast-fidelity.md) |
| Rally lifecycle and feedback | Full world/minimap chains; live friendly endpoints; lost unit cleanup; lost mineral Gather-at-point; all resource links converted for combat births | [Queue/rally comparison](order-queue-rally-followup.md) |
| Queue limits | Thirty-two unit orders and four rally targets, distinct overflow messages, no false success marker, partial-cohort admission and paid-placement preflight | [Queue/rally comparison](order-queue-rally-followup.md) |

New native trials also exposed carried-Gather contact behavior and repair exhaustion/held-queue errors; those corrections ship in the same integration. Worker cargo survives both transport and queued resource interruptions. Inaccessible gas workers/passengers retain remembered group IDs and become recallable after exit, while live selection excludes them.

The research client was historical SC2 4.10.0.75689. Current documented construction changes use Blizzard's 5.0.14 and 5.0.16 notes. These sources establish specific behavior; they do not make the custom steering, construction RNG, actor models, contact tolerances or opponent strategy the SC2 engine. Full races, tech trees, air combat and multiplayer remain outside the implemented Terran subset.

## Checks

All 31 isolated suites pass: 515 checks including construction, transport, repair contexts, gas/cargo boundaries, queue admission, control groups, steering, combat, economy and animation. The new remaining-details host suite passes 49 checks and construction integration passes 26. The remaining-details suite includes actual hotkeys and passenger-button clicks, exception monitoring, transactional placement rejection, hidden-gas command rejection, moving/fog-safe rally feedback and queue promotion.

All 13 browser suites pass, totaling 350 checks: remaining details49, construction26, autonomous controllers50, gameplay31, native-rate gameplay30, earlier small details26, unit intent23, placement18, attack controls15, native worker phases19, general input15, control-group input27 and worker controls21. These cover the existing player and enemy controller, worker economy, native-rate loop, control groups, attacks, placement, input and earlier small-detail controls. Test captures and logs are local ignored artifacts. Native research maps, executables and raw traces remain private and are not shipped with the game.
