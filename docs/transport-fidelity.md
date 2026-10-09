# Command Center transport

The normal Command Center now supports Load Nearby SCVs (`O`), Unload All (`D`), passenger count/icons and individual passenger unloading. Orbital Command and Planetary Fortress do not inherit these commands. Boarding preserves the worker object and its carried resources; hidden passengers leave the current selection but retain control-group membership.

## Evidence and implemented behavior

Measurements on native **4.10.0.75689**, Faster, seed 42, with two Participant clients establish the following historical-client behavior. Only derived results are published; research executables, maps, assets and raw observations remain outside this repository.

| Detail | Result and implementation |
| --- | --- |
| Capacity and search | Five workers; an eight-game-unit center-distance search. Approaching workers reserve capacity so repeated Load cannot over-request. |
| Builders | Active construction workers are skipped. This also follows Blizzard's [1.5.0 notes](https://news.blizzard.com/en-gb/article/10054522/patch-1-5-0-now-live). |
| Grounded production | Load starts individual worker approach orders immediately, including during Train and with Shift. Unload likewise executes immediately; no artificial production barrier is introduced. |
| Flying Load | With an existing Move, ordinary Load preserves flight and workers approach the moving structure. Shift Load waits behind that Move before recruiting workers. An idle flying center can approach its requested passenger. |
| Flying Unload | Ordinary Unload ejects at the current position and cancels flight orders. Shift Unload waits behind an existing Move. Empty Unload does not wait for future passengers. |
| Boarding | Workers stay visible while approaching, then board at contact. A generated flying pickup finishes when the last requested passenger boards, promoting queued flight. |
| Unload location | A single grounded passenger exits at the front contact surface. The first flying passenger exits directly under the center when clear. Multiple passengers receive separate legal positions. |
| Destruction | Grounded destruction ejects living passengers; flying destruction kills passengers. Outstanding approaches are canceled. |

The catalog loading range is one game unit beyond the interaction surface. The historical grounded captures last observed workers about 3.90–3.95 game units from the center before hiding; exact native braking/contact geometry is not certified. The prototype uses its footprint surface and local movement solver. Ground-front orientation, obstacle-aware multi-passenger exit searches and emergency fallback are authored policies, rather than an assertion of the native engine's exact exit pattern. Native ground triples occupied a front row; flying triples began at the center with subsequent offsets. The prototype preserves these broad locations while choosing collision-safe exits.

`dist/transport.js` owns capacity reservations, boarding, pickup, unloading and destruction. `dist/game.js` integrates the command cards, actual keyboard commands, queued flying actions, selection, group memory, passenger UI and per-loop cleanup. Cargo buttons cannot unload enemies and are disabled while paused.

## Validation

`node tests/transport_fidelity.mjs` passes 16 checks. `python3 tests/remaining_details_integration.py` exercises real host dispatch and `O`/`D` hotkeys during production, repeated capacity requests, interrupted boarding, cargo preservation, passenger-button unloading, both destruction states, flying pickup, Shift Load/Unload and ordinary flying Unload cancellation. These are part of its 49 passing checks.

Primary references include [Blizzard's building guide](https://news.blizzard.com/en-us/article/4488317/game-guide-buildings), [special controls](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control), and the [SC2 raw protocol](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/raw.proto). Generic queueable Load/Unload guidance does not imply that a grounded Command Center serializes transport behind Train; the historical fixture measured that distinction directly.
