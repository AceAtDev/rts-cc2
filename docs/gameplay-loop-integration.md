# Gameplay loop, control groups and unit decisions

The live browser now runs authoritative gameplay at **22.4 loops per second**, the Faster rate documented in [Blizzard's protocol guide](https://github.com/Blizzard/s2client-proto/blob/master/docs/protocol.md). Rendering and camera/selection feedback remain independent. This replaces the previous 60 Hz schedule; it does not reproduce Blizzard's proprietary phase order or seeded randomness.

## Scheduling and gameplay consistency

`game-loop.js` keeps elapsed simulation debt, services at most six loops per display frame, and caps interpolation at the newest authoritative pose while catching up. A 300 ms frame no longer discards 200 ms of game time. Pause/resume resets the wall-clock origin and debt; ending the match prevents additional catch-up updates. An integer loop counter and debug-only order acknowledgement/processing counters expose when input enters gameplay without adding artificial delay.

Queued Move and Attack Move destinations receive the same reachable-point projection as immediate orders. This prevents an obstructed waypoint from indefinitely holding later commands after the route planner reaches its reachable endpoint. Changes to terrain after acceptance remain a separate routing policy.

Each update uses a stable unit cohort: units produced during that update receive their rally immediately and begin executing it on the next update. Visibility refreshes after movement, collision and removal so presentation and opponent decisions receive the completed update's positions. Construction adds only the HP associated with actual progress, preserving damage when workers or automatic add-ons finish. Losing the final Command Center leaves the match active if another actual structure survives; unfinished and flying structures count, planned placement ghosts do not.

These are explicit prototype phase choices. Native randomized unit order, simultaneous events, shot jitter, sub-loop effects and map-rule variations remain separate comparison tasks. See [game-loop research](game-loop-research.md), including its reproduced deterministic lethal-exchange bias.

## Control-group input and HUD

[Blizzard's UI protocol](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/ui.proto) exposes Recall, Set, Append, SetAndSteal and AppendAndSteal. The extracted Core GameStrings tooltip documents left-click recall, right-click assignment and Alt+right-click assignment/steal. All ten buttons remain present and retain their DOM identity during HUD updates. Narrow screens use a separate row above the console so those buttons keep usable widths; that responsive arrangement is a prototype adaptation.

Keyboard handling reads physical `Digit` codes, so Shift+1 remains group 1 when the browser reports `!`. Death removes stale IDs; stored transport membership survives until unload. Gas workers remain recallable and can immediately leave extraction through a normal order. Empty recalls preserve the current selection. Group assignment, ordinary selection, commands and subgroup changes interrupt a double-tap candidate. Tab and Shift+Tab preserve the selected units, including an empty-selection guard.

The 350 ms window, empty recall and cargo-access policies are not measured native equivalents. Alt-alone stealing and Meta/Ctrl support retain this project's aliases; unverified Ctrl+Shift combinations are inert. [Control-group research](control-groups-followup.md) records version boundaries and these limits.

## Unit and opponent AI

[Per-unit combat](unit-ai-followup.md) responds to visible incoming fire without overwriting an Attack Move or Patrol route. Explicit Move still suppresses combat; Hold does not pursue. Valid equal-priority and manual targets remain authoritative. Lost targets use the last observed point rather than hidden live coordinates. Response pursuit is vision-bounded; its exact native leash is not known. Siege impact now follows the extracted radius 1.25 switch and lowered-Depot exception instead of excluding every structure from splash.

[Workers](worker-gameplay-followup.md) use the gas-specific harvest duration without the mineral-only ReturnDelay. Depleted mineral fields acquire locally, and availability-only searches do not return a busy fallback. AcquireRadius is extracted; field-centered search origin and complete native WaitToReturn interruption policy remain unverified.

[Opponent strategy](opponent-ai-followup.md) uses the same paid production, prerequisites, placement, add-on space and order executor as the player. It maintains a local economy, plans supply, rallies reinforcements to a staging point, scouts the map, defends observed threats and issues gathered attack waves. Hidden enemy information is stored as last-seen coordinates; unseen live positions and deaths do not leak into decisions. Repeated policy updates preserve an unchanged combat order. Timers, composition and difficulty are original policy rather than Blizzard's AI scripts.

## Validation

The complete pass verifies 306 explicit browser checks across fifteen suites and 188 isolated checks. Isolated scheduling, group, worker, combat, opponent and movement tests check meaningful state transitions and invariants. `control_groups_input.py` uses actual keyboard and group-button input, including punctuation-bearing Shift+Digit1, stealing, hidden gas interruption, cargo recall and double taps. `gameplay_loop_integration.py` covers order acknowledgement, newborn cohorts, damaged construction, defeat, completed-loop vision and paid opponent play. `native_loop_gameplay.py` exercises all six implemented units, harvesting, production, routing and 120-unit crowds using 1/22.4-second updates. Legacy tests retaining explicit 1/60 diagnostic updates remain compatibility regressions, not evidence of the live schedule.

The native-rate cargo fixture initially spawned a worker inside a sealed mineral pocket. It now begins in the Command Center's reachable component and retains the exact gathered/deposited amount assertion. [Movement notes](native-movement-followup.md) document why teleporting or weakening that assertion would conceal an invalid fixture.

A serial 120-unit, five-command, 600-step stress exercise uses the live 22.4 Hz interval: mean update 2.411 ms, P95 3.7ms, maximum 25.2 ms, command acceptance 1.1–4.2 ms and zero invalid positions. These measure simulation work. The actual-input group fixture needed briefly isolated drawing to deliver two trusted events within 350 ms; its rendered pair exceeded the window under overlapping software GPU load. Positive centering verifies input routing, not rendered latency.

No native-client input/trajectory capture has been collected. Passing these checks does not establish exact native unit intelligence, update phases or perceived control smoothness. The [native comparison procedure](native-control-comparison.md) remains necessary.
