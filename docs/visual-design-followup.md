# Visual reference pass — 2026-10-09

The earlier block meshes and oversized HUD did not reproduce the native Terran presentation. This pass uses primary references to correct structure and readability while keeping asset and behavioral differences explicit.

## References and resulting changes

- [Blizzard Terran gameplay screenshot](https://us.media.blizzard.com/sc2/media/screenshots/guide/terran/terran-liftoff02.jpg): stepped console outline, lower center information panel, raised map and command shoulders, square command hit regions, compact resources and menus.
- [Extracted Core camera catalog](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/CameraData.xml): replace orthographic projection with perspective; vertical field of view 27.8 degrees and pitch 56 degrees. Current default distance remains calibrated to the prototype viewport; the native distance and five distance/pitch zoom stops are not yet used by input.
- [Blizzard mapmaking guidance](https://news.blizzard.com/en-gb/article/20097658/mapmaking-best-practices-in-art-and-performance): prioritize unit visibility, restrained colors and unobstructed playable terrain. Replaced distracting terrain variation with quieter multiscale shading and a procedural normal map.
- [SC2 rendering presentation by Blizzard engineers](https://www.realtimerendering.com/advances/s2008/SIGGRAPH2008%20-%20StarCraftII.pdf): normals, specular response and ambient occlusion inform beveled armor, material contrast and contact shadows. This is an implementation interpretation, not their rendering engine.

## Implementation and checks

Command Center now has a lower radial hull, landing assemblies, front ramp and dorsal equipment. Production structures have distinct silhouettes. Tanks use tracks, Hellions wheels; SCVs use articulated tool arms, Marines and Marauders differentiated armor. Resource carriers visibly distinguish gas from minerals. Selection circles are thinner and remain above terrain when Depots lower.

Original green wireframe SVGs replace icons for Command Center, SCV and Marine. Oxanium is locally bundled with its OFL notice as an approximation of the native console typeface. Frame textures, wireframes, models, terrain and animations are custom; native models and animated portrait footage are not shipped. Other wireframes and most portraits still use command icons.

Material batching reduced the base scene from 232 to 92 draw calls, at approximately 22,000 triangles. Reset now releases stale mineral meshes. Actual mesh selection, command targeting, stepped-HUD visibility and desktop/mobile bounds are covered by browser checks. Software-WebGL timings do not establish production hardware performance or visual equivalence.

## Definition of fidelity still unmet

Matching screenshot layout is only one part of the requested full clone. Authentic model geometry, texture detail, animation, portrait footage, lighting, terrain/ramp behavior, full tech trees and native human-input/control traces remain missing. The prototype is more recognizable but is not an exact SC2 recreation. See `native-control-comparison.md` for the comparison procedure.
