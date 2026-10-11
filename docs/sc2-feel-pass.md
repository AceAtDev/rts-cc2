# SC2 group-feel pass

This pass played the movement lab with a deterministic top-down filmstrip harness and compared it against researched SC2 behavior. It fixed the gaps that most broke the feel of moving and fighting with an army.

## Research baseline

| Fact | Source and confidence |
| --- | --- |
| Ground group spread limit is about 6, air about 8 (`MixedFormationDiameter=6`, `AirFormationDiameter=8`) | Game data 5.0.15 (`core/gamedata.xml`), mirrored at [Ahli/sc2xml](https://github.com/Ahli/sc2xml). The ground interpretation is supported by [TL.net mechanics part 1](https://tl.net/forum/starcraft-2/132171-the-mechanics-of-sc2-part-1). |
| A click inside the selection's own box converges; a click outside it keeps offsets | Consistent community testing: [magic box thread](https://tl.net/forum/starcraft-2/127217-magic-box-in-sc2) and [formations vs magic box](https://tl.net/forum/starcraft-2/169191-the-perception-of-formations-vs-the-magic-box) |
| No speed matching in melee; each unit moves at its own speed | Formation move exists only as an arcade player flag |
| Moving units push idle allies; only idle units are pushable | Blizzard WoL beta Q&A; GDC 2011 "AI Navigation" talk ([summary](https://howtorts.github.io/2014/01/06/pathing-literature-review.html)) |
| Hold Position units and enemies do not get pushed | Widely relied on (wall-ins); no primary document |
| `AlliedPushPriority=1` on Siege Tank, Thor, Ultralisk and Mothership: they push even moving allies | Game data; [5.0.14 notes](https://news.blizzard.com/en-us/article/24162754/starcraft-ii-5-0-14-patch-notes) (Ultralisk change) |
| Arrival chaining: a unit stops when it touches an arrived squadmate | Standard SC2-feel reimplementation ([jdxdev boids for RTS](https://www.jdxdev.com/blog/2021/03/19/boids-for-rts/)); folklore, not primary |
| `AcquireLeashRadius=21`, `AcquireLeashResetRadius=5` | Game data (`core/gamedata.xml`) |

## Measured gaps and changes

| Gap reproduced in the lab | Change |
| --- | --- |
| A spread group sent to a point was assigned hex-ring slots. Units crossed through each other to reach their slots, so a click inside a loose 32-Marine group took 3.8 s to settle into a ragged blob. | Spread groups now converge on the shared point. The leader stops when its body covers the click. Others stop on contact with an arrived squadmate from the same command, or when they stop gaining on the point near it. The same group settles in 0.9 s as one tight clump; a 32-Marine march around a rock settles about 3 s sooner. ([movement.js](../dist/movement.js)) |
| A compact squad clicked inside its own box translated its offsets instead of clumping. | Clicks inside the group's AABB use the convergent arrival. Clicks outside a 6-unit-wide group still preserve the measured offsets. |
| Moving units carried idle allies ahead of them all the way to the destination, and some never arrived. | Idle allies slide across the mover's lane. Each idle unit keeps its chosen side for a short memory, so a passing group parts it one way. The mover is only checked briefly. |
| Units behind a Hold Position block stayed pinned forever. | After 0.25 s pressed against immovable bodies (Hold, Siege, enemies), a unit walks to the nearer edge of that whole cluster, then resumes its route. Held units are never displaced. |
| On attack-move, back ranks queued behind the firing front. Against a holding 16-Marine line, 7 of 24 attackers were in range 2 s into the fight, and 15 after 7 s. | A ranged unit walled off by stationary firing allies takes an open, unreserved spot on its own range arc. Spots are limited to 72° around the target from the approach side, so the army opens into a concave instead of wrapping behind. The same fight reaches 20 in range after 7 s. Ranged spreading is still slower than SC2's. |
| Tanks split overlap evenly with moving infantry. | Siege Tanks carry `alliedPush` and take only 10% of a moving-ally overlap. |
| A leashed unit could not re-acquire until it was exactly home. | It re-acquires once inside the catalog reset radius (5) of its anchor. |

## Tuned constants

These values are prototype policy, not native measurements:

- `ARRIVAL_CONTACT`: contact slack, 3 world units.
- `PACKED_STALL`: stall timeout, 0.5 s.
- `RANGE_SLOT_SPREAD`: maximum arc spread, 0.4π.
- `YIELD_MEMORY`: yield memory, 12 loops.
- `ANCHOR_DETOUR_DELAY`: detour delay, 0.25 s.
- `DETOUR_LOOPS`: detour lifetime, 67 loops.

The contact-arrival bound is twice the packed blob radius plus two unit radii.

## Checks

[`tests/sc2_feel_followup.mjs`](../tests/sc2_feel_followup.mjs) covers:

- magic-box convergence
- clump settling without overlap
- sideways idle yielding
- Hold-block detours with immovable held units
- Tank allied push
- range-arc spots

The compact-formation and autonomous-controller checks now assert the convergent contract instead of the removed slot fallback. These are behavior checks against researched rules; they do not establish native trajectory equivalence.
