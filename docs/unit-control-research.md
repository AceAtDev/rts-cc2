# Unit control: reference facts and implementation gaps

This prototype is not an exact SC2 clone. Controls need behavioral comparison against a running SC2 client, not just matching icons or passing our own tests.

## Evidence

- [Blizzard basic unit controls](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls): Move suppresses engagement; Stop permits engagement; Hold does not pursue; Patrol engages along its route.
- [James Anhalt's GDC 2011 navigation presentation](https://www.gdcvault.com/play/1014514/AI-Navigation-It-s-Not): inspected the public presentation's SC2 segment and demonstration frames around 3, 7, 9, 10, 12, 13, 14, and 16 minutes. It separates planning, steering, and collisions. Static path meshes use terrain and building footprints; mobile units are handled separately. Avoidance considers nearby footprints along the viewing direction, coordinates passing sides, and checks walls. Moving and stationary allies have different push behavior. Our navigation remains a custom approximation; this source does not establish that our solver matches Blizzard's.
- [Talv's extracted catalog](https://github.com/Talv/sc2-data/tree/1921f856b0443d4cbd366c472cd7984fa6a224d1): build 74071, May 2019. Inspected Core, Liberty, Swarm, Void, and multiplayer overrides for units, weapons, effects, regeneration, missile movers, and morphs. Catalog inheritance matters: an older base entry alone gives incorrect Reaper health, bonuses, and Tank damage.
- [BurnySc2's extracted multiplayer data](https://github.com/BurnySc2/sc2-techtree/blob/edcefaff7073732dbd7de63906f9224128148592/data/data.json): June 2025 snapshot. Cross-checked unit speed, radius, health, weapon period, attack count, damage, attributes, and bonuses. Its build-time fields were not used as seconds because those fields mix representations.

These snapshots are not proof of every current patch value. Production and research durations have not received the same data import as movement and weapons.

## Numeric reference

Catalog time uses Normal speed; real-time Faster uses a 1.4 multiplier. The prototype uses 28 world units per catalog distance unit. Acceleration scales with the square of the time multiplier. The exported profiles live in `dist/unit-profiles.js`.

| Unit | Faster speed (game units/s) | Radius (game units) | Normal acceleration | Weapon period at Faster (s) | Damage point at Faster (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| SCV | 3.9375 | .375 | 2.5 | 1.07143 | .11929 |
| Marine | 3.15 | .375 | 1000 | .61489 | .03571 |
| Marauder | 3.15 | .5625 | 1000 | 1.07143 | 0 |
| Reaper | 5.25 | .375 | 1000 | .78578 | 0 |
| Hellion | 5.95 | .625 | 1000 | 1.78571 | .17857 |
| Siege Tank | 3.15 | .875 | 1000 | .74289 | .11929 |
| Tank, sieged | 0 | .875 | — | 2.14286 | .11929 |

Other inspected facts: Marauder and mobile Tank have an Armored bonus; Hellion is Light despite being Mechanical and has a Light bonus. Reaper uses two 4-damage hits, separated by .122 Normal seconds; armor applies to each hit. Regeneration is 2 Normal HP/s after 10 Normal seconds without damage. Marauder missiles use a 20 Normal units/s maximum speed. Hellion flame searches along a line. Siege has a 2-unit minimum range and splash tiers of .4687, .7812, and 1.25 units with fractions 1, .5, and .25, including allied ground units.

## Changes made

The old engine chose the nearest target every tick, fired instantly, gave all units nearly identical movement, enforced rectangular destination slots, and sometimes moved directly toward obstacles when a wall-clock path budget expired. It also applied its collision weights backward, so moving units yielded excessively to idle allies.

The revised engine has persistent targets, explicit target overrides, cancelable windup, cooldown independent of orders, cancelable recovery, Reaper burst hits, traveling Marauder missiles, flame-line damage, splash tiers, regeneration, and independent turret facing. Fog visibility is computed for both teams on simulation ticks.

Movement uses unit profiles, immediate infantry reversals, local avoidance, sideways yielding from idle allies, and anchored Hold/Siege units. Groups share usable route corridors while retaining individual speeds. Arrival reservations compact the destination into a disc rather than enforcing a rectangular march. A deterministic four-request fallback queue replaces the machine-speed-dependent path budget; no valid route means wait, not walk through an obstacle. Clicks inside obstacles project to nearby open ground.

## Verification

`tests/unit_micro.py` checks damage-point cancellation, cooldown preservation, repeated attack orders, stable target retention, explicit target switching, footprint range, Move/Hold/Stop, projectile travel, attribute bonuses, separate Reaper hits, regeneration, flame geometry, friendly siege splash, minimum range, reversals, and idle yielding. Existing tests exercise real mouse/keyboard paths, queues, economy, construction, group routing, spacing, and 120-unit repeated commands. The final run passed 41 micro/behavior checks, the control/economy suite, and 15 mouse/keyboard checks. A 120-unit stress run measured 2.77 ms mean, 5 ms P95, and 14.6 ms maximum simulation steps in Chromium with software WebGL. These timings describe this environment, not an FPS guarantee or measured SC2 equivalence.

## Remaining fidelity work

- Replace the grid planner with a terrain navigation mesh, including ramps, cliffs, disconnected regions, and Reaper jumps. Building path contours and separate placement squares now use the extracted catalog.
- Compare crowd motion, arrival packing, lateral acceleration, turns, attack acquisition priorities, pursuit distance, range slop, and attack arcs against SC2 recordings. Those policies are custom approximations, not catalog-derived algorithms.
- Validate morph timing against the current client. Deployment currently uses section durations from the 2019 catalog, without its random delay.
- Import missile acceleration, weapon delay randomness, exact effect targeting and splash rules, animation events, and fractional tick semantics. This engine quantizes damage points to a 60 Hz tick and approximates missile flight at maximum speed.
- Add Concussive Shells research, Reaper grenade/jumps, the remaining units, races, abilities, upgrades, and a full opponent AI. Current enemy macro is a limited scripted opening; unit combat shares the same order executor as the player.
- Replace custom world models, terrain, console chrome, and sounds with faithful authorized assets. The original game is far more visually detailed.

## Building-placement follow-up

The Liberty Footprint catalog supplies the chamfered 2×2, 3×3 and 5×5 path contours. Selection radius, blocked path contour, and placement square are separate fields. Placement uses one-unit cells (28 world units), even-size centers on integer coordinates, and odd-size centers on half coordinates. Barracks/Factory add-on pads are two cells square at an offset of 2.5 units horizontally and .5 vertically. A lowered Depot remains occupied for placement while opening its ground path. Refineries use the rounded geyser-built contour. The Command Center mineral exclusion mask currently uses a conservative rectangular approximation of the catalog NearResources mask; its rounded halo corners remain a fidelity gap.

`tests/building_grid.py` verifies 17 placement and pathing cases plus the actual rendered grid-snapped ghost. The navigation grid is now half a game unit with actual unit radii, preventing radius rounding from closing a one-cell Marine gap. This remains a grid planner rather than SC2's navigation mesh.
