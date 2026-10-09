# SC2 Control Lab

A browser RTS prototype studying StarCraft II's English Standard Terran controls. It has a 3D battlefield, a playable Terran skirmish, and six selectable unit-control drills.

The world models and movement solver are custom. This is an independent fan prototype; full StarCraft II fidelity remains unfinished.

## Run locally

No package install or build step is needed for the game. Serve the static files with Python 3:

```sh
git clone https://github.com/AceAtDev/rts-cc2.git
cd rts-cc2
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open <http://localhost:8000> in a modern browser with WebGL enabled. Choose **Start skirmish** for an opening with 12 SCVs and 50 minerals, or **Unit control lab** to try army movement immediately. Choose a drill for army routing, Marine micro, Hellion lines, siege positioning, Reaper skirmishing, or Marauder projectiles. Press **F12** for the full control reference.

## Controls

| Input | Action |
| --- | --- |
| Click / drag | Select units |
| Ctrl-click / double-click | Select visible units of the same type |
| Shift-click | Add or remove a unit |
| Right-click | Move, attack, follow, gather, repair, or set a rally point |
| A / M / S / H / P | Attack / Move (or Follow a clicked unit) / Stop / Hold Position / Patrol |
| Shift + command | Append orders and waypoints |
| Ctrl + 0–9 / Shift + 0–9 | Set / add to a control group |
| Ctrl+Alt + 0–9 / Alt+Shift + 0–9 | Set-and-steal / append-and-steal group members |
| Group button: click / right-click / Alt-right-click | Recall / set / set-and-steal |
| Double-tap a group number | Center the camera on that group |
| Tab / Shift-Tab | Cycle subgroups while preserving the selection |
| F1 / Ctrl-F1 / F2 | Idle worker / all idle workers / army |
| Backspace / Space | Cycle bases / recent notifications |
| Ctrl-F5–F8 / F5–F8 | Save / recall camera position; add Shift for the second bank |
| Home / End | Farthest / closest zoom stop |
| Arrows / screen edges / middle drag | Pan the camera |
| Scroll / Page Up / Page Down | Five player distance/pitch zoom stops |
| Hold Insert / Delete | Temporarily rotate camera left / right |
| Hold Alt / [ / ] | All / friendly / enemy overhead vital bars |
| SCV: B → S / B → B / V → F | Build Depot / Barracks / Factory |
| Factory: X, then S | Build a Tech Lab, then train a Siege Tank |
| Tank: E / D | Siege / Unsiege |
| Marine: T | Stimpack, after Tech Lab research |

## Implementation

- A documented 22.4 Hz Faster simulation schedule with retained backlog and interpolated Three.js rendering.
- Radius-aware A* navigation, shared route corridors, cached walkability grids, and bounded incremental fallback searches.
- Per-unit movement profiles, immediate infantry reversals, local avoidance, sideways idle yielding, compact arrivals, and anchored Hold/Siege units.
- Explicit worker targets, fog-safe Follow/Attack intent, pursuit isolated from march slots, and stable moving-target planning.
- Persistent combat targets, visible-attacker response, explicit Move/Hold preservation, cancelable windup, cooldowns, projectiles, Reaper bursts/regeneration, flame lines, and radius-dependent Siege splash.
- Physical number-key groups, all ten assignable HUD slots, right-click assignment/stealing, cargo memory, controllable gas harvesters, and interrupted double-tap handling.
- A paid opponent economy with local harvesting, supply planning, legal construction, scouting, gathering, defense and fog-safe attack orders.
- Damage-preserving construction and defeat only after the player loses every actual structure.
- Stepped Terran console with square 5 × 3 command cells, original green selection wireframes, and a locally bundled console font.
- Perspective camera with catalog field of view, fixed world distance, five distance/pitch stops, and temporary camera rotation.
- Distance-driven articulated walking, separate work/weapon tracks, shot-driven recoil, Tank stabilizer deployment, and SCV tools.
- Full-footprint construction stages, smooth Depot retraction and building lift/land, extraction pumps, production activity, and damage effects.
- Distinct hover/selection rings, active subgroup colors, damage-colored vitals/wireframes, independent construction/energy bars, mineral/gas saturation labels, and discrete mineral meshes.
- Grid-snapped building placement, per-cell validity and add-on pads, catalog path contours, lowered-Depot pathing, and separate placement occupancy.
- Worker mineral walking, exclusive harvesting, smart local splitting, gas entrance/exit and waiting, queued cargo return, one maintained construction worker, repair autocast during Patrol, and nearest-builder selection.
- Resource gathering, construction, production queues, rally orders, add-ons, research, lift/land, and an opponent using its own economy.

The implemented unit subset is SCV, Marine, Marauder, Reaper, Hellion, and Siege Tank. Other reference buttons explain their unavailable state in their tooltips. Multiplayer, air combat, a full tech tree, other races, and campaigns remain outside the current implementation.

## Source map

- `dist/game.js`: simulation integration, orders, selection, controls, economy, and HUD updates.
- `dist/game-loop.js`: authoritative Faster schedule, bounded catch-up, interpolation phase and pause/reset.
- `dist/control-groups.js`: group operations, physical key handling, membership and double-tap tracking.
- `dist/opponent-ai.js`: fair paid-economy opponent policy and fog-safe squad decisions.
- `docs/compact-formation-fidelity.md`: native extent/mean-center probes and shape-preserving movement.
- `docs/native-gameplay-observations.md`: actual historical native-client provenance and measured movement, formation, mining and combat boundaries.
- `docs/native-worker-phases.md`, `docs/attack-phase-fidelity.md`, `docs/tank-turn-fidelity.md`: measured worker/weapon/turn phases and their remaining limits.
- `docs/native-arrival-fidelity.md`: measured point arrival and SCV braking against nine native fixtures.
- `docs/unit-intent-integration.md`: command, worker, pursuit corrections and native comparison boundaries.
- `docs/gameplay-loop-integration.md`: gameplay changes, native-rate validation and remaining engine differences.
- `dist/unit-profiles.js`: extracted movement and weapon numbers with Faster-speed conversion.
- `dist/movement.js`: route following, crowd steering, destination reservations, and collisions.
- `dist/geometry.js`, `dist/placement.js`, `dist/navigation.js`: footprints, placement cells, interaction surfaces and static pathing.
- `dist/workers.js`: harvest ownership, timings, resource splitting, return trips and interruptions.
- `dist/combat.js`: acquisition, weapon phases, projectiles, damage, and regeneration.
- `docs/unit-control-research.md`: evidence, implementation reasoning, and fidelity gaps.
- `docs/gameplay-audit-followup.md`, `docs/visual-design-followup.md`: reproduced failures and reference-driven changes.
- `docs/native-control-comparison.md`, `tests/native_compare/`: native capture/comparison procedure and browser adapter; historical 4.10 captures now measure isolated movement and order behavior.
- `docs/native-autonomous-observations.md`: controlled two-player native unit-response and worker lifecycle observations.
- `docs/automatic-combat-fidelity.md`, `docs/movement-contact-fidelity.md`, `docs/worker-recovery.md`: assistance, crowded contact, Tank steering and worker command distinctions, with measured facts separated from custom policies.
- `dist/renderer.js`: 3D scene, visible-geometry picking, models, interpolation, and battlefield overlays.
- `dist/camera-profile.js`, `dist/presentation-profile.js`: catalog camera stops and vital palettes.
- `dist/unit-animation.js`, `dist/building-animation.js`: authored state-driven actor rigs and transitions.
- `dist/resource-presentation.js`: discrete mineral states and separate mineral/gas worker labels.
- `docs/fidelity-integration.md`: current presentation evidence, checks, and native comparison limits.
- `dist/native-data.js`: Terran unit definitions and Standard command cards.
- `dist/reference-data.json`: research sources, screenshot references, asset provenance, and known differences.
- `tests/`: browser control checks, input checks, and movement stress exercises.

## Browser checks

The scripts require Python Playwright, a Chromium executable, and the local server on port 8000. Openings, queues, research requirements, mixed selections, obstacle routing, collision spacing, rapid reversals, and minimap controls have been exercised in Chromium.

```sh
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
python3 tests/browser_controls.py
python3 tests/browser_input.py
python3 tests/unit_micro.py
python3 tests/unit_intent_integration.py
node tests/worker_intent_followup.mjs
node tests/worker_recovery.mjs
node tests/automatic_combat_fidelity.mjs
node tests/idle_anchor_fidelity.mjs
node tests/movement-contact-fidelity.mjs
python3 tests/autonomous_controller_integration.py
node tests/unit_order_fidelity.mjs
node tests/movement_pursuit_fidelity.mjs
python3 tests/worker_controls.py
python3 tests/building_grid.py
python3 tests/attack_controls.py
python3 tests/command_clicks.py
python3 tests/gameplay_followup.py
python3 tests/visual_followup.py
python3 tests/presentation_fidelity.py
python3 tests/animation_integration.py
python3 tests/visible_actor_picking.py
node tests/unit_animation_fidelity.mjs
node tests/building_animation_fidelity.mjs
node tests/resource_presentation_fidelity.mjs
node tests/game_loop_followup.mjs
node tests/control_groups_followup.mjs
node tests/unit_ai_followup.mjs
node tests/worker_gameplay_followup.mjs
node tests/opponent_ai_followup.mjs
node tests/native_movement_followup.mjs
node tests/native-arrival-fidelity.mjs
node tests/tank-turn-fidelity.mjs
node tests/attack_phase_fidelity.mjs
node tests/native_worker_phases.mjs
node tests/compact-formation-fidelity.mjs
python3 tests/control_groups_input.py
python3 tests/gameplay_loop_integration.py
python3 tests/native_loop_gameplay.py
python3 tests/native_worker_integration.py
python3 tests/attack_phase_integration.py
python3 tests/tank_turn_integration.py
python3 tests/formation_integration.py
node tests/movement_followup.mjs
python3 tests/movement_stress.py
```

The scripts use a system Chromium executable when available, otherwise Playwright's installed Chromium. Screenshots are written to the ignored `artifacts/` directory.

## Third-party material

StarCraft II button and resource artwork belongs to Blizzard Entertainment. Its source references and preserved notices are in `dist/reference-data.json` and `dist/assets/icons/`. Three.js is bundled with its MIT license in `dist/vendor/THREE-LICENSE.txt`. Those notices apply to their respective third-party materials. Oxanium is bundled with its OFL license in `dist/assets/hud/OFL.txt`.

The worker/placement follow-up adds `tests/building_grid.py`, `tests/worker_controls.py`, `tests/attack_controls.py`, and `tests/command_clicks.py`. These cover footprint grids, resource interruptions, mining traffic, construction plans, melee pursuit, shot range slop, and actual command targeting. Passing them does not establish exact SC2 control fidelity; native-client comparison remains required.

Small control details and sourced remaining gaps: [October audit](docs/sc2-small-details-audit.md).
