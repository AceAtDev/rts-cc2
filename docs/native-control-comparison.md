# Measuring controls against the native game

The regression suites check the prototype against explicit expectations. Licensed native SC2 4.10 captures now independently measure isolated point movement, targeted Gather, Move-to-unit and queued Patrol. Ten straight Move fixtures using recorded native initial headings match every recorded relative position and order-clear loop; see [native arrival](native-arrival-fidelity.md). These bounded observations do not establish full unit behavior, current-patch parity, human input feel or visual fidelity.

## Feasible source of native trajectories

Blizzard's [SC2 client protocol](https://github.com/Blizzard/s2client-proto/blob/master/docs/protocol.md)
exposes a WebSocket API for the retail Windows/Mac clients and separate Linux
clients. A non-realtime game can be advanced one simulation loop at a time.
[The protocol definition](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/sc2api.proto)
provides `RequestStep.count`, observation `game_loop`, executed-action loops,
seeded game setup, and version metadata through `RequestPing`. This permits
commands and observations on a reproducible simulation schedule.

[Raw observations](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/raw.proto)
include exact unit positions, facing, radius, own-unit orders, weapon cooldown,
engaged target, buffs, and resource contents. They also supply pathing,
placement, terrain height and visibility images. Enemy orders/cooldowns are
not fully populated, so use a controlled opponent or a second participating
client when those fields matter.

Blizzard's [debug protocol](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/debug.proto)
can create/remove units and change selected unit values in a local test game.
Use an empty, controlled map with distant bases so the match does not end.
Spawn fixture units, observe the actual tags and initial positions, then issue
commands by label. Do not assume a spawn request preserves an obstructed
coordinate exactly.

The initial environment inspection had no native executable, maps, replays, PySC2, or
client protocol Python package. The official [Linux package instructions](https://github.com/Blizzard/s2client-proto)
require acceptance of a separate AI and Machine Learning License. No game
package was downloaded or license accepted during that initial research. The later
[unit-intent pass](unit-intent-integration.md) installed the historical 4.10 research client after explicit acceptance and collected native API observations;
its setup and scope are recorded in [native client research](native-client-license-boundary.md). An existing
licensed retail installation is another capture route. A historical Linux
build must be labeled by build/data version; it cannot establish current-patch
equivalence.

Parsing replay events without running the engine is insufficient. Blizzard's
[replay parser documentation](https://github.com/Blizzard/s2protocol)
states that tracker position events are periodic, approximate, limited in
size, and include only combat-active units. Worker trajectories would be
missing. API replay playback needs matching versions and map dependencies;
the [Linux documentation](https://github.com/Blizzard/s2client-proto/blob/master/docs/linux.md)
explains that its offline build does not download missing Battle.net assets.

## Simulation, rendering and targeting are different comparisons

DeepMind's [environment design documentation](https://github.com/google-deepmind/pysc2/blob/master/docs/environment.md)
describes discrete simulation with interpolated rendered frames. It also
describes threat/return-fire/assistance priorities before nearest-target
tie-breaking, plus weapon and update-order randomness. Its
[environment implementation](https://github.com/google-deepmind/pysc2/blob/master/pysc2/env/sc2_env.py)
sets Faster realtime loop duration to `1 / 22.4` seconds. The earlier prototype instead
uses `1 / 60` simulation steps. Imported per-second numbers do not remove that
event-timing difference.

Compare native states at actual game-loop boundaries. Separately record
pointer/keyboard events, command acknowledgement, the first changed rendered
frame, camera transform, zoom, monitor resolution and frame pacing. API raw
commands bypass important mouse-selection and command-card behavior. A raw
trajectory match alone cannot verify that the human controls feel identical.

## Small capture tools

`tests/native_compare/capture_native.py` attaches to an already joined local
non-realtime native client. It does not install or launch the game, create the
fixture, or accept a game license. It requests one-loop steps and records
native coordinates and command execution observations. The wire code follows
the published protocol but has not been validated against a native client here.

The fixture is JSON with `scenario`, `map_sha256`, `loops`,
`loops_per_second`, and `commands`. Commands have relative `loop`, actual
`ability_id`, stable unit `units` labels, optional `queued`, and either
`point: [x,y]` or a `target` label. A separate labels JSON maps stable labels
to actual native tags. Resolve IDs from the running client's data/stable IDs,
rather than guessing them from our button names. Terrain and initial-state
equivalence remain caller responsibilities; the collector explicitly records
that it has not verified the provided map hash.

```sh
python tests/native_compare/capture_native.py --help
python tests/native_compare/compare_traces.py native.jsonl browser.jsonl
node tests/native_compare/solver_diagnostics.mjs
```

The comparator requires the same fixture/map metadata, stable labels, SC2
world units and sample times. A browser capture adapter still needs to replay
the common fixture, convert our 28-pixel world scale and inverted Y axis,
and record at the native sample boundaries. Cooldown comparisons require both
adapters to emit `cooldown_seconds`; native raw cooldown should not silently
be treated as browser seconds. Report mean/P95/max position differences,
missing-unit samples, health differences and first movement times. There is
deliberately no automatic equivalence verdict.

## Isolated point-Move adapter

`capture_prototype_move.py` records the actual browser executor at 22.4 Hz, converts its 28-world-unit scale, and stores the source commit plus runtime file hashes. It captures SCV distances 1/2/5/10/20 and all five other implemented units at 10 game units, on a clear lane. Default starts face east; optional `--native-directory` uses each captured native initial heading, converted to the prototype's inverted world-Y orientation. `compare_point_moves.py` compares relative displacement and order-clear loops with the private native fixture files; native initial facing stays as captured and time is never shifted to improve agreement. These scalar fixtures do not assert whole-map or renderer equivalence. Using different initial headings exposes the Tank's turn delay in the report; using the recorded heading permits the like-for-like point-movement comparison.

```sh
python3 tests/native_compare/capture_prototype_move.py --output /absolute/path/prototype-moves.json --native-directory /absolute/path/native-traces
python3 tests/native_compare/compare_point_moves.py --native-directory /absolute/path/native-traces --prototype /absolute/path/prototype-moves.json
```

Raw captures and installed client/map assets stay outside the public repository.

## Fixture matrix and review gates

| Fixture | Native observations needed | Main failure measured |
| --- | --- | --- |
| One SCV/Marine/Tank, start/stop/reverse | Position, facing, command loop | Acceleration, braking, turn delay |
| 12 and 120 Marines, repeated shared destination | Trajectories and final footprint distribution | Group spread, arrival loops, command lag |
| Opposing streams through a one/two-unit gap | Trajectories, static path grid | Hallway dance, wall clearance, starvation |
| Moving unit against idle/Hold allied/enemy blockers | Both positions and orders | Wrong pushing and anchoring |
| 12 SCVs on one/eight mineral fields | Trips, positions, buffs, resources, commands | Mineral walking, split, waiting, return phase |
| Marine kite and 12-SCV melee surround | Damage/cooldown/target/order trajectories | Acquisition, slop, windup cancel, surrounds |
| Depot/Barracks/CC placement and interruption | Placement grid, placeholders, resource totals | Snapping, payment timing, worker construction |
| Actual mouse/keyboard reproduction | Screen video plus API state | Selection, targeting, queue and camera feel |

First repeat each native fixture under the same seed and version to measure its
own variation. Store the map hash, setup, unit label mapping, commands and
captured traces. Compare the browser to that distribution without shifting
time to improve a score. Review synchronized trajectory overlays and videos
as well as scalar metrics. Acceptance limits must be chosen explicitly from
observed native repeatability and interaction requirements. The isolated point-Move comparisons report observed coordinate and order-lifetime differences directly. Acceptance limits for crowds, combat, mining and human input have not been established.

## Reproduced issues in our solver

At the pre-follow-up implementation `a9adfe9`, the standalone diagnostic measured policies
without Three.js, browser frame pacing, or A* CPU cost:

- A moving Marine overlapping an idle enemy by 2.5 world pixels shifts the
  enemy 2.01875 pixels and itself .35625 pixels in one collision pass. Steering
  marks enemy units anchored, but the final collision solver ignores team.
- An idle ally 50 pixels ahead moves sideways 1.176 pixels during one tick,
  while the moving Marine advances 1.47 pixels. This happens well before the
  21.5-pixel collision distance. It looks like telekinetic cooperation; native
  timing/amount still needs a reference capture.
- 120 independent blocked-route requests start over ticks 0–29, causing up to
  .48333 seconds of delay purely from the four-request limit. Entity-list
  order determines which units respond first.
- Twelve Marines receive fixed approach slots extending 43.5 pixels from the
  click. These reservations are invented policy, and can require lateral
  corrections rather than shared-goal arrival. The diagnostic records their
  extent; it does not assert what native final positions should be.

James Anhalt's [GDC navigation presentation](https://www.gdcvault.com/play/1014514/AI-Navigation-It-s-Not)
separates static planning, local steering and collisions. The publicly
inspected steering/collision slides describe ignoring eligible neighbors,
choosing the closest usable gap, checking the chosen side against walls,
coordinating passing direction, and distinguishing friendly/enemy and
moving/stationary pushing. The implementation's fixed side/parity heuristics,
independent repulsion, wall-axis fallback and team-blind overlap solver do
not implement those policies fully. The talk describes design mechanisms,
not sufficient numeric parameters to reproduce the native engine exactly.

## A bounded planner that does not delay units by their IDs

Replace the per-tick four-complete-search limit with persistent search jobs.
Key jobs by current order revision, goal, radius and navigation version;
cancel obsolete requests when a new order supersedes them. Cache routes or
reverse goal search trees for units sharing a destination and radius.

Give jobs incremental A* node expansion quotas, with a deterministic total
budget per simulation step. Service them round-robin, retaining progress
across ticks. Every newly commanded cohort receives a first service pass,
with a small per-job cap so one inaccessible goal cannot monopolize work.
Units with a still-valid old route may continue only when that motion respects
the replacement command's intent; they must not keep moving away from a new
goal. Add queue age, expanded nodes, cache hits, stale cancellations and
command-to-first-movement latency to QA output. This bounds expensive work
without repeatedly favoring the earliest entity IDs.

Do not replace the request count with an arbitrary wall-clock cutoff: that
would make behavior vary with host contention. Static planning and local
steering must also stay separate, so a valid static route does not become a
rigid group formation or a license to push enemy units.

## Implemented follow-up

The reviewed custom solver now distinguishes static-terrain radius from mobile separation. Stationary opposing units no longer yield to an approaching enemy through the ally push rule; idle allied sidestepping waits until imminent contact. Fallback A* work is incremental and cancelable by order identity/navigation version, with round-robin job service, verified shared-goal corridor reuse, and a fixed expansion budget. Open but isolated mineral contact cells are rejected before a whole-map search.

These fix reproduced prototype defects. Shared-goal and scheduler regression measurements are synthetic and must not be labeled native SC2 trajectories. Unreachable goals, narrow gates, different-radius packs, click-spam frame time and actual native captures remain meaningful comparison cases.

The diagnostic figures above record the earlier snapshot. Re-running the scripts uses the current solver; its contact measurements therefore change after the fixes. The fake-path diagnostic retains the legacy synchronous fallback for isolation, while `tests/movement_followup.mjs` exercises the actual incremental planner.

The 2026-10-09 follow-up checks start all 120 same-goal movers across ticks 0–1, with a maximum of 721 expanded nodes in the fixture. Ten isolated movement regressions pass. In a separate 120-unit/600-step browser exercise, mean update time was 2.48 ms, P95 4.5 ms, maximum 67.2 ms, and command acceptance 1.2–6.2 ms; no invalid positions were observed. These measurements use software WebGL and include frame-budget outliers. They do not certify native smoothness. The 1024-node quota bounds A* expansions; projection, walkability-grid generation, connector and corridor checks remain outside that quota.

The gameplay-loop follow-up now schedules the live browser at 22.4 Hz, with retained simulation debt and interpolated rendering. Legacy `update(1/60)` regression helpers still test compatibility at their explicit diagnostic step; `tests/native_loop_gameplay.py` and `tests/native_movement_followup.mjs` exercise 22.4 Hz gameplay. Matching the documented loop scalar does not establish internal phase order, native seeded randomness or input/trajectory parity.
