# Gameplay audit: failures outside the existing regressions

Audit date: 2026-10-09. Runtime inspected at public repository commit `a9adfe9`; line numbers below refer to that snapshot and will move as fixes land. Browser reproductions used Chromium with software WebGL, a local static server, `/?debug`, paused rendering, and explicit 60 Hz simulation steps. They establish prototype failures, not native-client equivalence.

## Ranked actionable findings

| Priority | Failure and code location | Observed prototype behavior | Native evidence and recommended check |
| --- | --- | --- | --- |
| P0 | Worker static collision radius, `unit-profiles.js:15`, `navigation.js:49`, `movement.js:52` | Worker uses `.375` for terrain collision, mobile separation and weapon footprint. | [Live 5.0.13 notes](https://news.blizzard.com/en-gb/article/24078322/starcraft-ii-5-0-13-patch-notes) separately reduce worker inner radius to `.3125` while retaining the ordinary radius. Import separate inner radius, use it for static routing/contact and keep separation/combat radius distinct. Test a gap between `.625` and `.75` game units: worker passes, Marine does not. |
| P0 | Shift Return Cargo interrupts construction, `game.js:84` | `action('cargo', true)` replaces a Build order with Return and leaves an empty queue. | [Special Control](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control) specifies successive Shift orders; catalog `CAbilHarvest` Return sends to selection. Test Build → Shift+C → Shift Gather; construction must finish first and resources must deposit before mining. |
| P0 | Right-click resource drop-off absent, `game.js:104` | Cargo-carrying SCV right-clicking a healthy Command Center receives Follow. | `CommandCenter.ResourceDropOff` enables all resource types; Harvest has Return command. The expected smart return is a high-confidence gameplay requirement, but priority relative to repair on a damaged town hall needs native-client capture. Test healthy clicked CC, damaged CC, flying CC, and two grounded CCs; do not silently replace the clicked destination with nearest CC. |
| P0 | Unfinished Refinery smart action and multiple builders, `game.js:104,127`, `workers.js:37` | All SCVs right-clicking an unfinished Refinery receive Build. Explicit Gather immediately aborts Gas if it is not ready. Two SCVs advanced a Depot to `.290476` after 200 ticks against a single-builder upper bound `.158730`. | [Live 5.0.14 notes](https://news.blizzard.com/en-us/article/24162754/starcraft-ii-5-0-14-patch-notes) explicitly distinguish workers waiting for gas construction. `TerranBuild` is PeonMaintained with one Construction mover. Preserve one builder, allow waiting gas workers, and validate the exact second-SCV action against client. Test three SCVs assigned to unfinished gas: one construction rate, workers remain tasked, all gather after completion. |
| P1 | Transported workers disappear from supply, `game.js:20-21` | CC Load stores five workers in cargo and supply falls from 12 to 7. | Worker catalog Food is unchanged by CommandCenterTransport; transport holds existing units rather than refunding supply. Count all living unit food, independently of selectable/visible ownership lists. Test loading/unloading at supply cap cannot free production capacity. |
| P1 | Repair autocast cannot interrupt Patrol, `game.js:130` | Patrolling repair-autocast SCV left a nearby wounded Depot at 100 HP after 600 ticks. | [Basic Unit Controls](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls) explicitly describes autocast repair while patrolling. Suspend and restore Patrol rather than flushing its route/queue. Test repairs between patrol endpoints, repair target destroyed, no resources, and resumption. |
| P1 | SCV repairs itself; repair speed conflates construction time, `game.js:104,128` | Explicit Repair with clicked self accepts `{kind:'repair',target:self}`. Mobile mechanical targets use an arbitrary 30-second fallback. | `Repair.TargetFilters` excludes Self and UnderConstruction. `CEffectCreateHealer Repair` uses target RepairTime and a .25 resource-cost factor. Reject self and import RepairTime separately. Test one SCV cannot self-repair, two SCVs can repair one another, damaged Hellion/Tank/SCV use their catalog repair durations. |
| P1 | Mixed army/producer selection loses rally side effect, `game.js:106` | Selecting Marine+CC, then right-clicking ground, moves Marine but preserves old CC rally object. | Blizzard [Special Control](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control) documents rally updates with army+production selection. Exact rally destination in a mixed attack requires native confirmation: guide mentions current army location, not necessarily the clicked target. Test grouped army+producer input using recorded native actions before selecting a policy. |
| P1 | Selection subgroup order follows incoming array, `game.js:28,190` | Selecting `[worker,tank]` activates Worker; reversing the list activates Tank. | Unit catalog has SubgroupPriority and SiegeTank aliases. Sort by the chosen patch's subgroup priorities; preserve the active subgroup through control-group recall where native behavior permits. Tests should vary box direction/entity spawn order and expect the same command-card subgroup. |
| P2 | F1 changes camera too early, `game.js:168` | Every single idle-worker selection centers immediately and cycles workers. | [Simplified Controls](https://news.blizzard.com/en-us/article/6640645/game-guide-simplified-controls) distinguishes initial selection from another F1 press to center. Capture repeat timing/cycling against native and test camera stays fixed on first press. |

## Catalog facts for implementation

Snapshot: [Talv extracted catalog, commit 1921f856](https://github.com/Talv/sc2-data/tree/1921f856b0443d4cbd366c472cd7984fa6a224d1), with Liberty, Swarm and Void multiplayer inheritance. Local files live in `/workspace/scratch/sc2-reference/xml`.

| Unit | Final snapshot SubgroupPriority | Normal RepairTime |
| --- | ---: | ---: |
| Marine | 78 | 20; biological, not an SCV repair target |
| Marauder | 76 | 25; biological, not an SCV repair target |
| Siege Tank / Siege Tank Sieged | 74, same subgroup alias | 45 |
| Reaper | 70 | 20; biological, not an SCV repair target |
| Hellion | 66 | 30 |
| SCV | 58 | 16.667 |
| Command Center | 32 | 100 |
| Supply Depot | 26 | 30 |
| Barracks | 24 | 65 |
| Factory | 22 | 60 |
| Engineering Bay | 18 | 35 |
| Tech Lab | 2 | 25 |
| Reactor | 1 | 50 |
| Refinery | 1 | 30 |

RepairTime must be converted from Normal to Faster once. SCV repair filters require Mechanical+Visible and exclude Self, Enemy, Missile, UnderConstruction, Dead and Hidden. The auto-acquire range is seven game units, while the implementation uses 130 world units (4.64 game units). The Construction mover/PeonDisableCollision is part of native TerranBuild; a stationary worker permanently outside the building is an approximation. Live 5.0.14 changed the builder's random relocation interval to 4.64–6.07 real seconds, which our simulation does not model.

The 2019 priorities are verified snapshot values, not a claim about every present patch. [5.0.16 notes](https://news.blizzard.com/en-us/article/24259080/starcraft-ii-5-0-16-patch-notes) changed Terran subgroup ordering and grouped Marine+Marauder priority. [Live 5.0.17](https://news.blizzard.com/en-gb/article/24309308/starcraft-ii-5-0-17-patch-notes) rolls back most balance changes but does not enumerate subgroup reversal. The latest-client subgroup policy therefore needs fresh catalog or client verification. Its economy returns to 12 starting workers, 1800/900 minerals, 2250 per geyser and Command Center 400 minerals/15 supply, matching the prototype's economy baseline.

## Build payment and cancellation evidence

Core CAbilBuild sets the started refund fraction to .75. [SC2Mapster's authored Build field documentation](https://sc2mapster.wiki.gg/wiki/Data/Abilities/Build) describes a full refund during placement. These support retaining upfront payment and distinguishing unstarted cancellation from a started building; they do not by themselves settle every queued payment moment. Do not change resource payment to worker arrival based solely on analogy to another RTS. Native captures should cover three queued buildings, insufficient later resources, cancel before arrival, blocked arrival, builder death, and handoff to another SCV. The prototype currently kills/refunds every planned target belonging to a worker when its order is overwritten, even if another worker has been pointed at that same plan.

## Attack details that require better comparison

The current crowd solver guarantees neither native contact trajectories nor identical group arrival. All group slots use the largest selected unit's diameter, so a single Tank increases spacing for every Marine; every member owns an individual hex slot. Native mixed-radius packing and short rapid reversals should be compared with recorded cursor actions, unit centers and frame times rather than endpoint-only tests.

Do not remove `combat.js`'s building-target splash suppression without tracing the native effect graph: CrucioShockCannonSwitch chooses Directed for large-radius targets, and explicitly chooses Blast for lowered Supply Depots. The current blanket `!target.building` loses the lowered-Depot exception; a targeted lowered-Depot test is appropriate, but assuming every building target should splash would itself be an inaccurate fix. TargetRadiusSmall/TargetRadiusLarge validators are still needed for exact threshold import.

Return Cargo resume behavior remains partially inferred. A Return → Shift Move reproduction eventually reached Move, so the initial audit concern that it *permanently* skipped the queue was incorrect. Code inspection shows resumed harvesting takes precedence over queued orders and may add a further trip when the saved order was outbound. Compare first deposit timing and subsequent order promotion against native, then test it; do not call eventual arrival enough.

## Runnable baseline reproduction pattern

Use an existing local QA server with Chromium/Playwright. Open `/?debug`, call `g.reset(); g.start(); g.running=false; g.aiEnabled=false`, remove enemy entities, stop ordinary workers, and call `g.invalidateNav()`. Step only via `g.update(1/60)`.

Representative failures on the audited snapshot:

```js
const g = __game;
const scv = g.entities.find(e => e.type === 'worker');
const cc = g.entities.find(e => e.type === 'core');
scv.carry = 5;
g.selected = [scv];
g.running = true;
g.command(cc.x, cc.y, false, false, null, {entity: cc});
g.running = false;
console.log(scv.order.kind); // observed: follow

// Reset before each independent case.
g.selected = [cc];
const before = g.used();
g.running = true;
g.action('load');
g.running = false;
console.log(before, g.used(), cc.loaded.length); // observed: 12, 7, 5
```

Tests must also use real mouse/keyboard input for Return Cargo, Shift+C and mixed selection. Debug orders alone bypass command-card availability, subgroup routing, pointer picking and modifier state. Passing the resulting regressions will verify these named semantics, not establish absolute SC2 control perfection.
