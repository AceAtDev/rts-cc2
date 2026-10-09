# Unit animation fidelity pass

This adds event-driven articulation to the generated Terran models. It is a
replacement rig and authored set of curves, not Blizzard's original animation
clips. Passing these checks establishes state synchronization and determinism;
it does not establish a visual match to native SC2.

## Primary references read

Blizzard's [Art Tools announcement](https://news.blizzard.com/en-us/article/12444476/patch-2-1-art-tools)
identifies the official tools and source examples. The mirrored documentation is
Blizzard-authored documentation, rather than an inference from a fan animation:

- [Animation tutorial](https://mapster.talv.space/star-tools/Tutorial_BasicAnimation.html):
  bone/linked geometry rigs; short blended Walk and Turn tracks; MoveSpeed and
  foot-lock preview; Attack retriggered by the weapon interval and interruptible.
- [Split-body tutorial](https://mapster.talv.space/star-tools/Tutorial_SplitbodyAnimation.html):
  lower-body and upper-body tracks can play separately, with track priorities.
- [Animation names](https://mapster.talv.space/star-tools/Appendix_AnimationNames.html):
  Work for mining/channeling, distinct Stand and Walk, ordered construction
  brackets, and independent tracks for continuous model details.

The existing primary catalog mirror, supplied by the reference-audit agent, is
[`ActorData.xml`](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/ActorData.xml).
Its Liberty SCV actor starts Gather/Repair/Build work from channel events, uses
0–0.3 timer delays before non-looping Work clips, and clears work on channel stop.
The Marauder actor alternates left/right launcher clips on grenade launches and
clears both during Walk. Marine and Marauder actor WalkAnimMoveSpeed is 2.25.
These establish the original event rules; they are a May 2019 build 74071 catalog snapshot
and do not establish every current multiplayer animation override.

## Implemented behavior

- SCV, Marine, Marauder and Reaper: actual rendered traveled distance advances
  the stride. Stopping does not keep feet moving because a global sine clock
  continues. Upper and lower legs have separate pivots; torso motion is confined
  to movement rather than an unrelated idle bob.
- SCV: mining requires the harvest phase. Build/repair requires a live target
  within the actual polygon footprint reach. Walking to a job does not start
  the drill or sparks. Work starts after an actor-specific stagger bounded by
  the historical delay, then clears when the channel stops. Claw and drill have
  their own pivots; actual Fusion Cutter shots also thrust/spin the tool briefly. Mineral/gas cargo groups remain independent.
- Combat: explicit shot telemetry increments inside combat.fire at impact/launch
  and at a valid burst impact, so only those events start recoil. Cooldown decay and windup do not retrigger it.
  Marauder grenade launches alternate the two arms. Infantry movement clears
  the upper-body attack pose. Legs and upper weapon tracks remain separate.
- Reaper: the Marine rifle silhouette is replaced with paired pistols and a
  compact thruster silhouette. The second pistol recoils only when an actual second
  burst impact emits shot telemetry, including cancellation/invalid-target cases.
- Siege Tank: stabilizers interpolate across the existing transform timer;
  unsiege reverses the same pose. Turret elevation and barrel recoil remain
  independent of chassis motion. The gameplay transform duration is preserved.
- Hellion: wheel rotation advances by traveled distance divided by wheel radius.
- Pause: work, recoil, and blending freeze when simulation time stops, even if
  the render loop continues for the camera.

## Integration contract

`attachUnitAnimation(view, group, entity)` runs before model batching.
`group.userData.animationParts` is a Set of dynamic parents which the outer
static merge must exclude. The module batches rigid pieces inside each joint;
a second unconditional leg merge would flatten the knees and is forbidden.
`updateUnitAnimation(group, entity, {dt, time, alpha, x, y})` runs after actor
placement, using the same interpolated x/y as the renderer. Old global-clock
leg swing and instantaneous strut visibility updates must be removed.
The renderer retains its picking entity, turret facing, ring, shadow and cargo
logic. No simulation order, selection radius or movement coordinate is changed.

## Validation and remaining limits

`node tests/unit_animation_fidelity.mjs` checks distance invariance across frame
rates, stopped and paused tracks, job cancellation, hierarchy survival through
static batching, alternating launches, movement interruption, and continuous
siege/unsiege endpoints. The checks use the actual Three.js geometry helpers and
do not require a WebGL context. Root performs integrated browser inspection.

The joint angles, stride lengths, blend rates, drill speed, spark paths and
siege mechanism geometry are authored approximations. They have not been
measured from native clips. Native M3 bones/tracks, exact foot locking, turn
variants, posture variants, muzzle sockets, complete death sequences, voices,
jetpack cliff jumps and full weapon effects remain missing. Native comparison remains necessary before claiming exact animation fidelity.
