# SC2 Control Lab

A browser RTS prototype studying StarCraft II's English Standard Terran controls. It has a 3D battlefield, a playable Terran skirmish, and a unit control lab with 32 Marines and 4 Siege Tanks.

The world models and movement solver are custom. This is an independent fan prototype; full StarCraft II fidelity remains unfinished.

## Run locally

No package install or build step is needed for the game. Serve the static files with Python 3:

```sh
git clone https://github.com/AceAtDev/rts-cc2.git
cd rts-cc2
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open <http://localhost:8000> in a modern browser with WebGL enabled. Choose **Start skirmish** for an opening with 12 SCVs and 50 minerals, or **Unit control lab** to try army movement immediately. Press **F12** for the full control reference.

## Controls

| Input | Action |
| --- | --- |
| Click / drag | Select units |
| Ctrl-click / double-click | Select visible units of the same type |
| Shift-click | Add or remove a unit |
| Right-click | Move, attack, follow, gather, repair, or set a rally point |
| A / M / S / H / P | Attack / Move / Stop / Hold Position / Patrol |
| Shift + command | Append orders and waypoints |
| Ctrl + 0–9 / Shift + 0–9 | Set / add to a control group |
| Alt + 0–9 | Set a group and steal its units from other groups |
| Double-tap a group number | Center the camera on that group |
| Tab / Shift-Tab | Cycle subgroups while preserving the selection |
| F1 / Ctrl-F1 / F2 | Idle worker / all idle workers / army |
| Backspace / Space | Cycle bases / recent notifications |
| Ctrl-F5–F8 / F5–F8 | Save / recall a camera position |
| Arrows / screen edges / middle drag | Pan the camera |
| Scroll / Page Up / Page Down | Zoom |
| SCV: B → S / B → B / V → F | Build Depot / Barracks / Factory |
| Factory: X, then S | Build a Tech Lab, then train a Siege Tank |
| Tank: E / D | Siege / Unsiege |
| Marine: T | Stimpack, after Tech Lab research |

## Implementation

- A 60 Hz simulation and interpolated Three.js rendering.
- Radius-aware A* navigation, cached walkability grids, and a short planning budget per step.
- Nearby-unit avoidance, collision settling, formation assignment, crowd-aware arrivals, and anchored Hold/Siege units.
- Fixed 5 × 3 command-card positions based on researched SC2 references.
- Resource gathering, construction, production queues, rally orders, add-ons, research, lift/land, and an opponent using its own economy.

The implemented unit subset is SCV, Marine, Marauder, Reaper, Hellion, and Siege Tank. Other reference buttons explain their unavailable state in their tooltips. Multiplayer, air combat, a full tech tree, other races, and campaigns remain outside the current implementation.

## Source map

- `dist/game.js`: simulation, orders, selection, controls, economy, and HUD updates.
- `dist/renderer.js`: 3D scene, models, interpolation, and battlefield overlays.
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
python3 tests/movement_stress.py
```

The scripts use a system Chromium executable when available, otherwise Playwright's installed Chromium. Screenshots are written to the ignored `artifacts/` directory.

## Third-party material

StarCraft II button and resource artwork belongs to Blizzard Entertainment. Its source references and preserved notices are in `dist/reference-data.json` and `dist/assets/icons/`. Three.js is bundled with its MIT license in `dist/vendor/THREE-LICENSE.txt`. Those notices apply to their respective third-party materials.
