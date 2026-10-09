# Fidelity reference audit — 2026-10-09

This audit inspected the build at `eeb9cca` and its saved desktop screenshots. Recommendations describe that baseline; other agents are implementing changes concurrently. It is a reference audit, not certification that this browser implementation matches a running SC2 client.

## Evidence and version boundaries

The numeric actor and camera findings come from [Talv's extracted build 74071 catalog, pinned to May 2019](https://github.com/Talv/sc2-data/tree/1921f856b0443d4cbd366c472cd7984fa6a224d1). These are primary game-data extractions, but they are not a current-client dump. The [live 5.0.17 notes](https://news.blizzard.com/en-us/article/24309308/starcraft-ii-5-0-17-patch-notes) confirm the current economy baseline: 12 starting workers, 1,800/900 mineral patches, 2,250 gas, and a 400-mineral Command Center providing 15 supply. That patch does not verify all inherited art/camera fields.

The [Blizzard Terran lift-off screenshot](https://us.media.blizzard.com/sc2/media/screenshots/guide/terran/terran-liftoff02.jpg) is useful for silhouettes, materials, and the Terran console. It is an older replay image, not proof of today's Standard hotkeys or multiplayer balance. Local `scv-hud.png` also shows an injured SCV's red wireframe and the mineral line, but its provenance is secondary; use it as corroboration rather than numeric authority.

## Highest-priority corrections

### 1. Use native camera distance and player zoom stops

The baseline keeps camera distance proportional to viewport height, calibrated through `cam.z`. At a 900-pixel-high viewport and `z=1.4`, it is approximately 46.4 game units from its target. That changes the amount of world visible when resolution changes. It also allows zooming farther out than the normal player camera and keeps pitch constant when zooming in.

[Core CameraData.xml](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/CameraData.xml) supplies these player stops:

| Stop | Distance, game units | Pitch, degrees |
| --- | ---: | ---: |
| Default | 34 | 56 |
| 1 | 30 | 52 |
| 2 | 26 | 48 |
| 3 | 22 | 44 |
| Closest | 18 | 40 |

Field of view is 27.8 degrees. Observer distances 44 and 54 are separate entries; do not make them standard player zoom-out stops. The [official control guide](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control) documents wheel and Page Up/Page Down zoom, temporary Insert/Delete rotation, and separate friendly/enemy health-bar keys.

**FOV ambiguity resolved as far as available primary evidence permits:** the Editor's Camera Actions tutorial and one API tooltip say horizontal framing is the default. However, its [Map Properties tutorial](https://s2editor-guides.readthedocs.io/New_Tutorials/01_Introduction/008_Map_Properties/) and [first-person camera lesson](https://s2editor-guides.readthedocs.io/New_Tutorials/07_Lessons/089_Set_Up_a_First_Person_Camera/) both say default vertical. More decisively, [the pinned EditorStrings](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/enus.sc2data/LocalizedData/Editor/EditorStrings.txt) describe the Horizontal FOV flag as switching away from vertical, and identify that flag as disqualifying a map from Melee. Therefore retain a vertical 27.8-degree interpretation for melee; do not invent a 4:3 conversion from the conflicting tooltip. Native measurements still need to confirm projection and edge behavior.

### 2. Restore distinct selection and hover feedback

At baseline, selection has one thin green/red ring, hovering has no dashed ring, and the browser pointer supplies most cursor feedback. These omit native distinctions that make a crowded army easier to control.

The [Editor selection tutorial](https://s2editor-guides.readthedocs.io/New_Tutorials/03_Trigger_Editor/048_Unit_Selection_Events/) distinguishes a dashed hover circle from the solid selected circle; both coexist on a selected hovered unit. Ownership determines green/yellow/red, and hover changes the cursor to a targeting reticle. The [Core actor catalog](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/ActorData.xml) provides eight preselection segments at 80% solid and alpha .75, with rotation speed .5. Local selection is one solid segment.

The [Core UI catalog](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/GameUIData.xml) also distinguishes the active subgroup's bright green `(0,250,25)` from other selected units' darker green `(0,168,90)`. Current rings flatten that difference. Add contextual cursors and hover feedback using the same actual-mesh hit target as commands, excluding entities hidden by fog or HUD panels. Preserve unit-surface interaction semantics separately from those visual indicators.

### 3. Make health, construction, and energy legible independently

The baseline always paints friendly overhead life green and enemy life red, gives every mobile unit the same bar width, and replaces HP with a yellow progress bar during construction. HUD wireframes also stay green when the selected unit is almost dead.

Core actors encode an eight-entry life palette, with adjacent duplicate entries yielding four bands: red `(208,34,0)`, orange `(229,129,0)`, yellow `(229,221,0)`, green `(22,229,0)`. UI wireframes have a corresponding damage palette. These are the normal non-team-colored presentation; native SC2 also exposes a team-colored life-bar option, so a team palette should be a setting rather than the sole assumed presentation. Progress is cyan `(0,200,200)` and energy purple `(150,40,220)`. An unfinished building can be damaged: show life and progress separately.

The [Liberty actor catalog](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/ActorData.xml) supplies different widths:

| Actor | BarWidth |
| --- | ---: |
| Marine / Reaper | 36 |
| SCV | 42 |
| Marauder | 50 |
| Hellion, inherited default | 60 |
| Tank, either mode | 102 |
| Supply Depot | 80 |
| Refinery | 120 |
| Engineering Bay | 135 |
| Barracks / Factory | 160 |
| Command Center | 200 |

Do not treat these as literal CSS pixels at every resolution: actors also have `BarDistance=34`, per-unit offsets, and native projection behavior. The ratios themselves are documented and improve over the baseline's two universal widths, 32 and 66. Preserve the distinction between HUD logical dimensions, game distance units, and model-space height.

### 4. Correct worker status and mineral depletion visuals

The current Command Center label counts both mineral and gas orders within 15 world-game units, always against `/16`. This counts gas workers in the mineral line and cannot describe a depleted or overlapping base correctly. Native Command Center actors carry a mineral-specific harvester label and `SearchRadius=8`; the Refinery has a separate vespene label. Flying Command Centers explicitly hide worker counts.

Associate workers with their resource, including the return trip; assign nearby mineral patches to a grounded base, exclude gas workers from its mineral total, and derive ideal capacity from live patches. A blind center-distance check at eight units would fail this custom map: starting mineral centers are at 8.214 units. The native search may include unit surfaces, so its exact algorithm requires measurement; do not claim nearest-base assignment is the original engine.

Mineral actor events apply four discrete animation groups A/B/C/D when resource behavior levels change. The underlying behavior uses a depletion threshold of 750 and four variations. Current continuous scale shrink, `.6+.4*amount/900`, has no such provenance and shrinks the crystals' contact impression even though their obstacle footprint remains unchanged. Replace it with explicit resource visual states; keep physical footprints independent. Exact thresholds-to-M3 visual tracks remain unavailable.

### 5. Drive animation from real actions

The baseline oscillates legs from a common time sine and enlarges every unfinished structure from 30% to 100% scale. That reads as toy growth, not Terran construction. Native actors instead have ordered construction stages, work events, mode transitions, production activity, and damage states. The construction footprint remains present at full size while its geometry is built.

SCV actors repeatedly start non-looping Work after a randomized 0–.3 Normal-second delay while harvesting, repairing, or constructing, and cancel it when the channel stops. Marine movement and weapon-ready/attack events are distinct. Marauder launch events alternate the left and right arm, clearing attack work on movement. Tanks use an independent turret and mode-change animation; idle locomotion should not continue indefinitely after stopping. Native M3 clips, attachment positions, and clip durations are absent, so a procedural implementation can match state meaning without claiming exact native tracks.

For building damage effects, the [Liberty validators](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/ValidatorData.xml) verify light smoke at `.5 <= life < .666`, heavy smoke at `.333 <= life < .5`, and fire below `.333`. These decimal cutoffs are literal catalog values. Under-construction and dead buildings are excluded. The Terran flame state monitor checks every .5 Normal seconds. Visual flame eligibility is not by itself proof of the burn-damage behavior's exact tick policy.

## Larger remaining presentation gaps

The official screenshot has layered armor, authored surface detail, rounded structural shells, richer crystal geometry, localized ambient shading, and unit portraits. Current original low-poly models, flat team-colored materials, icon portraits, and simple terrain remain visibly different even after animation improves. Changing zoom or adding decorative smoke cannot supply missing authored geometry and texture detail.

[Blizzard's map-art guidance](https://news.blizzard.com/en-gb/article/20097658/mapmaking-best-practices-in-art-and-performance) prioritizes readable units, restrained color, unobstructed gameplay areas, clear paths, visible terrain levels, and textures that ground props. The current flat field has no cliffs, ramps, or deliberate route landmarks. Adding actual terrain levels requires synchronized pathing, vision, unit elevation, camera height handling, and Reaper traversal; decorative cliff meshes alone would misrepresent gameplay.

## Review criteria for the integrated pass

Review default and closest zoom at the same aspect ratio as references, then resize without changing camera distance. Capture construction at multiple stages, halt/resume, damaged incomplete and complete buildings, worker outbound/gather/return, stopped and moving infantry, alternate Marauder attacks, and Tank deployment. Compare screenshots and short sequences, not only isolated starting frames. Verify life colors at quarter boundaries, independent progress/energy, contextual hover and cursor states, and saturation across two bases and depleted patches.

These checks can reproduce specific regressions and expose animation-state mistakes. Exact silhouette, native clip timing, visual identity, and input/trajectory equivalence remain separate comparison tasks requiring authorized native assets or a running reference client.
