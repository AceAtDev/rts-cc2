# Native gas, carried Gather and lost resource points

Research date: 2026-10-09. Measurements use native SC2 `4.10.0.75689`, base/data build `75689`, data version `B89B5D6FA7CBF6452E721311BFBC6CB2`, Faster speed, seed 42, and two Participant clients. Each observation follows one simulation loop. Two-client action submission introduces an extra execution loop compared with the earlier single-client mineral trial; travel event loops are fixture-specific. This evidence does not certify the modern client or complete SC2 fidelity.

Only derived state transitions are published. Executables, map files, assets and raw observations remain private, outside the repository.

## Gas extraction and queued commands

The local Command Center is centered at `(39.5,42.5)`, a completed Refinery at `(46.5,42.5)`, and the SCV starts at `(43,42)`. A debug-created completed Refinery has 2250 gas, allowing resource phases to be measured without conflating construction timing.

| Observation loop | Single-SCV gas cycle |
| ---: | --- |
| 2 | Gather 295 approaches the Refinery |
| 23 | SCV disappears from raw unit observations while extracting |
| 55 | SCV reappears with carry buff273; Refinery loses4 gas; Return 296 is active |
| 81 | Player gas increases 4; cargo disappears; Gather resumes |

The hidden extraction lasts32 Faster loops, matching catalog `HarvestTime=1.981 / 1.4` after loop quantization. Gas has no mineral eight-loop return wait. A Move queued before approach becomes active at loop 55, the cargo acquisition/exit boundary, retaining4 gas and making no deposit. The previous prototype promoted this successor only after deposit. `workers.update()` now returns `promoted` at that boundary; normal gas exit returns `resumed` for bounded same-step return dispatch.

Three SCVs assigned to the same Refinery use one exclusive service slot: first inside23–54, second56–87, third89–120. Cargo appears55,88,121. Waiting SCVs remain visible outside. This supports one hidden extractor per Refinery rather than three simultaneous extractors; three workers can saturate the complete travel/service cycle.

Known-tag commands submitted while the worker is hidden are unavailable through this native API fixture: explicit Gather returns Error, and Smart/Move/Stop/Hold return NotSupported, without observed command execution or changed exit timing. This does **not** establish how every native UI or retained selection handles hidden workers. The host rejects inaccessible hidden-worker inputs; the worker module's `release()` remains necessary for death, destruction and administrative order cancellation. No gas extraction reset policy is inferred from these unavailable actions.

Gather and Smart repeated during approach at requested loop 12 both preserve arrival23 and exit55. Reissued after emergence, both produce the carried-Gather behavior below. The measured mineral explicit-Gather-versus-Smart extraction difference remains specific to visible active mineral extraction.

## Gather while already carrying

Gather to a resource with existing cargo visits that resource first. It does not immediately redirect to the nearest drop-off. Explicit Return Cargo continues to visit its selected drop-off directly.

| Fixture | Reissued Gather or Smart | Result |
| --- | --- | --- |
| Gas returning with4 gas | Requested65, execution67 | Reverses toward the Refinery; resource contact/Return 75; deposit101, versus baseline81 |
| Minerals returning with5 minerals | Requested85, execution87 | Reverses toward the clicked field; resource contact/Return 95; deposit122, versus baseline102 |
| Same mineral carrier, different clicked field | Requested85 | Visits the new field; Return 117; deposit155 |

Resource contact with cargo starts neither extraction nor another mineral wait. Return already has its base target in the contact observation. If a Move is queued behind this carried Gather, Move activates at contact instead: mineral 95 or gas 75, preserving cargo with no deposit.

`accept()` now initializes new Gather orders in the outward phase even when carrying. Arrival with cargo promotes a queued successor or starts the home leg without claiming a resource slot, deducting contents, entering gas, earning cargo or starting a wait. Two earlier tests asserted the unsupported deposit-first shortcut; they now verify the measured target-first behavior.

## Lost mineral rally points

Native Command Center rally chains retain a lost mineral target as a Gather point. A produced SCV receives Gather 295 with a world-space point plus the queued next rally Move. This differs from an ordinary lost friendly unit rally target, whose invalid head is removed while its queued ground successor remains.

With no surviving local field, the produced SCV walks to the saved point `(46,42.5)` and promotes the next Move there at loop 308. With another field at `(46,46.5)`, the first produced-worker observation already targets that live field; cargo appears356 and the queued Move starts364 carrying5 minerals.

The host can issue `{kind:'gatherPoint',x,y}`. `workers.js` searches the saved point's local mineral cluster first; a valid field transforms the active order into ordinary mining without dropping queued successors. An empty local cluster retains travel to the saved point and completes only on arrival. A distant expansion cannot silently replace the point. Rechecking newly available local fields during travel is a prototype recovery policy; the exact native polling interval and search weights remain unmeasured.

## Related interaction observations

- Native unit queues retain32 total orders, including the active order. Rally chain thresholds are3→3,4→4,5→4 and6→4 produced-worker orders; the rally cap is4 points in this build. Raw `rally_targets` exposes only the first point, so production orders were inspected to establish the chain.
- Repair autocast can approach a nearby target while Idle or Patrol, preserving a return Move or Patrol behind Repair. Hold repairs only at contact without approaching; Move suppresses acquisition. With zero minerals, explicit Repair is rejected with NotEnoughMinerals and creates no order. Autocast stays idle and acquires a target after minerals become available.
- Grounded Command Center LoadAll launches worker approach without a persistent base order. Shift Load/Unload executes immediately during SCV training; empty UnloadAll is unavailable. Flying Load while idle can move both actors into contact; with a flying Move already active, unqueued LoadAll preserves that Move and launches worker approach, whereas Shift LoadAll queues behind it. Grounded death ejects passengers; flying death kills them. Flying UnloadAll is allowed in this pinned build.
- During the Depot construction fixture, worker motion occurs inside the footprint and building progress continues every moving loop. The separate construction module documents the modern patch's relocation interval; this older client's one trajectory does not establish the modern random timing distribution.

## Validation and sources

`node tests/native_gas_phases.mjs` provides 6 checks; `node tests/native_worker_cargo_points.mjs` provides 7. Existing worker suites retain 52 checks, with their carried-Gather expectations corrected. These 65 isolated checks verify phase transitions, cargo conservation, resource ownership, queue promotion and local resource-point recovery. Browser dispatch, selection, animation and actual path geometry require the host integration suite.

Primary API/protocol references: [Blizzard SC2 API](https://github.com/Blizzard/s2client-api), [raw command and unit protocol](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/raw.proto), and [debug protocol](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/debug.proto). Catalog timing and interaction sources are pinned in [the worker gameplay follow-up](worker-gameplay-followup.md); mineral phases and build metadata are recorded in [native worker phases](native-worker-phases.md). Modern changes must be reconciled separately, including [patch 5.0.14](https://news.blizzard.com/en-us/article/24162754/starcraft-ii-5-0-14-patch-notes).
