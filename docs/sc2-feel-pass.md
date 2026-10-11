# SC2 group-feel pass

> **Superseded in part.** This pass predates the native-client comparison. Where the two disagree, [native-feel-fit.md](native-feel-fit.md) is authoritative. Native traces replaced these rules here: arrival is a whole multiple of the mover's radius set by the squad area on the point (not chaining on touch); idle allies are carried and walk back (not a sideways yield); the leash is 21 + the unit's own diameter; target scans run on an 8-loop per-unit slot.

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
| On attack-move, back ranks queued behind the firing front and stalled (43% of approach loops at zero speed; native 4%). Native 4.10 probes (`a_col3_*`, four headings) show a blocked Marine turning right at full speed along the firing leader and stopping beside it the loop after it enters range; in the 24-vs-16 fights native approachers keep sliding along the line in one direction (95% per-loop persistence), peeling away from their own crowd (72-84% outward), and in-range shooters are never displaced. | Blocked ranged approach now slides along the rim of firing allies and of allies not making way, at full speed, on a side kept for the contact episode and chosen away from the local crowd (right turn on a tie). The last approach step is not trimmed to the range edge. Units firing from inside range are collision anchors; stalled approachers are not. The range-arc slot reservation was removed. Per-loop error vs native: `amove_ball_vs_line` 1.23 to 0.97, `amove_vs_idle_ball` 2.31 to 1.63. |
| Tanks split overlap evenly with moving infantry. | Siege Tanks carry `alliedPush` and take only 10% of a moving-ally overlap. |
| A leashed unit could not re-acquire until it was exactly home. | It re-acquires once inside the catalog reset radius (5) of its anchor. |

## Tuned constants

These values are prototype policy, not native measurements:

- `ARRIVAL_CONTACT`: contact slack, 3 world units.
- `PACKED_STALL`: stall timeout, 0.5 s.
- `ENGAGE`: blocked-approach slide (contact slack 4, make-way 0.4 of speed, crowd radius 42 world units, tie 0.05).
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
- blocked ranged approach turns right along a firing ally into range

The compact-formation and autonomous-controller checks now assert the convergent contract instead of the removed slot fallback. These are behavior checks against researched rules; they do not establish native trajectory equivalence.

## Unit AI pass (native SC2 4.10 traces)

The `c_` fixtures in `tests/native_compare/feel_fixtures.py` cover every implemented unit type. Native traces now record `game_loop`. The browser replay runs with fog revealed, as the native lab does. It copies each unit's scan slot from its native tag.

| Native finding | Evidence | Browser rule |
| --- | --- | --- |
| Idle, Attack-move and chase scans run once every 8 loops, when `game_loop % 8 == (tag >> 18) % 8` | 48/48 lanes in `c_scan_idle`, `c_scan_idle_hellion`, `c_scan_amove` | `scanDue`, with a per-unit `scanPhase` |
| After losing a target, a unit stands until its weapon backswing ends: Marine 12 loops, Siege Tank 8. Cooldown does not gate this. Then it searches once. | `acq_delay_*` (new target exactly 12 loops after the last shot), `patrol_engage`, `c_siege_min` | Replaces the cooldown gate and the 3-loop schedule |
| An idle chaser gives up past AcquireLeashRadius plus its own diameter: 21.75 for Marine/Reaper, 22.25 for Hellion. The walk home is a plain Move with no scanning and no retaliation. | `c_leash_lanes`, `c_leash_lanes_hellion`, `c_leash_chase2` | `leashRadius+2r`; the return no longer re-acquires |
| A chaser whose target is beyond scan range switches to a closer opponent inside scan range | `c_switch_amove`, `c_switch_patrol`, `c_switch_idle`, `c_leash_chase` | `pursuing`/`lost` rule |
| The attack starts in the loop that brings the unit into range. Point-0 weapons fire in that loop. | `c_stop_hit_*`, `c_leash_chase3` | `arrived` path |
| A damaged unit answers on the loop after the damage | `c_stop_hit_*` | `settled` |
| Marauder missiles land `ceil(d/1.25)+1` loops after launch | `c_first_Marauder`, `c_stop_hit_*` | one-loop missile wait |
| The second Reaper hit lands one loop after the first | `c_first_Reaper` | `burstInterval` of 1 loop |
| Siege splash bands are measured to the unit's edge, so the Siege Tank hits allies too | `c_siege_splash` | `dist-u.r` |
| Siege Tank: 90mm Arc 360 fires without turning. The sieged turret starts at body+180 and turns at 360°/s. | `c_first_SiegeTank`, `c_siege_splash` | `arc`, `turretRate`, siege `turretAngle` |
| An SCV hit while it has an order (Move, mining) never flees for that hit later | `c_leash_chase`, `c_amove_retreat` | damage consumed while busy |

Open gaps:

- A Marauder chasing a faster Hellion gives up 13.8–16 from its anchor, always on a scan slot. Neither distance nor time explains it (`c_leash_lanes_marauder`).
- Chase paths and turn speed differences belong to movement code.
- Weapon random delays cannot match native draws.

## Crowd arrival pass (native SC2 4.10 traces)

Fitted against `mixed_move`, `spread48_move`, `march24_far`, `compact6_inside`, `loose32_click_inside`, `b_arr_row8` and their 0.01-nudged noise-floor captures (`jit_*`, `d_jit_b_arr_row8`).

| Native finding | Evidence | Browser rule |
| --- | --- | --- |
| Group-move settles mostly happen on the unit's 8-loop AI slot (the target-scan slot): the order clears on the observed loop where `(game_loop - (tag >> 18)) % 8 == 1` | 41/48 `spread48_move`, 11/14 `mixed_move`, 28/32 `loose32_click_inside`, 36/48 `jit_spread48_move` | `ARRIVAL.slot`, `scanDue` with `ARRIVAL.shift` (the native unit still moves on its settle loop) |
| A squadmate that touches nobody walks onto the exact point; before anyone has arrived, a unit touching a squadmate settles within about 0.62-0.79 of the point | Lead Hellion `d=0.000`; `b_arr_row8` first stop 0.615 (go at 0.912); `compact6_inside` four nearest at 0.39-0.59 on one loop | `ARRIVAL.first` |
| Once squadmates have arrived, units touching a squadmate settle on their slot inside a radius that grows with the arrived area: about 3.4-3.7 game units for far clicks (`mixed_move` Marines 3.41-3.73, late `spread48_move` 3.58-3.70), about `0.5*sqrt(k+1)` for clicks inside the group's box (`loose32` k=4: 1.02-1.04, k=22: 2.36-2.37). Tanks walk closer (no settle at 2.87-3.36). | slot-check envelopes per fixture | `ARRIVAL.first/grow/cap/free/big` |
| Off-slot settles follow about five loops pressed into an arrived squadmate | `march24_far` (six units after exactly 5 loops of contact) | `ARRIVAL.contactTime` |
| A walking squadmate carries an arrived one straight ahead at 15/16 speed; the carried unit does not sidestep | `mixed_move` Hellion chain (0.249 vs 0.2656 per loop) | `ARRIVAL.idleShare=1`, `YIELD.settled=0`; fights keep `fightShare` |
| A unit on a Move order never covers more than its speed in a loop, and a jammed line keeps stepping 0.136-0.141 by sliding sideways | max step 0.1406 in `spread48_move`, `march24_far`, `b_arr_row8` (browser was 0.157) | `COLLISION.stepCap`, `COLLISION.slide` beyond `slideNear` of the point |
| Squadmates converging on one Move point walk straight into each other | `compact6_inside` diagonal paths | `AVOID.squad=0` (Move only) |

Per-loop mean error (game units) before → after, with the native noise floor: `mixed_move` 0.294 → 0.083 (0.076), `compact6_inside` 0.403 → 0.225 (0.263), `spread48_move` 0.286 → 0.287 (0.217), `idle_push` 0.519 → 0.486 (0.431), `march24_far` 0.139 → 0.132 (0.106), `loose32_click_inside` 0.692 → 0.550 (0.729), `b_arr_row8` 0.318 → 0.398 (0.326).

Open gaps:

- No single radius formula fits every fixture: arrived Hellions (area 1.17) already give Marines a 3.2+ radius in `mixed_move`, while 11 arrived Marines (area 1.55) leave `jit_spread48_move` below 2.46.
- A jammed native line drifts as a whole and buckles at interior units (`b_arr_row8` units 2 and 4 in both captures); the browser buckles the second unit from each end. The native order of collision resolution is not modeled.
