# SC2 game-loop and gameplay research

Audit date: 2026-10-09. Initial runtime snapshot: `838431ee42f214ce349f130277606e6907be319f`. This is a read-only audit of the browser simulation and public engine interfaces, not a native-client comparison. No native executable or trajectories were used.

## What the published interface establishes

[Blizzard's protocol documentation](https://github.com/Blizzard/s2client-proto/blob/master/docs/protocol.md#game-speed) explicitly describes a **fixed simulation step**, calls its unit a **GameLoop**, and specifies **22.4 loops per real second at Faster**. One Faster loop therefore lasts approximately 44.643 ms. Non-realtime stepping advances only after all players issue a Step request. It does not imply that the game normally advances whenever a rendered frame arrives.

[The protocol schema](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/sc2api.proto) separately exposes `RequestStep.count`, `Observation.game_loop`, and the loop on which an action executed. [Raw unit commands](https://github.com/Blizzard/s2client-proto/blob/master/s2clientprotocol/raw.proto) contain the command's selected unit tags, target, and `queue_command`. Raw observations expose own-unit orders, weapon cooldown, engaged target, facing, position, and resources. These fields support a future loop-by-loop comparison; they do not reveal the engine's entire internal event pipeline or mouse-input latency.

[Blizzard's randomness documentation](https://github.com/Blizzard/s2client-proto/blob/master/docs/protocol.md#randomness) explicitly says that unit update order is randomized and that Marine shot delays have slight randomness. The simulation is deterministic for the same random seed. This rules out treating a permanently ascending unit-ID combat update as an exact implementation. It also rules out using unseeded `Math.random()` as a satisfactory replacement.

[DeepMind's environment guide](https://github.com/google-deepmind/pysc2/blob/master/docs/environment.md#game-and-action-speed) describes interpolated intermediate render frames. Its targeting section describes scan range, threats that can return fire, assistance, and nearest-target tie breaking. These are useful explanations from an engine integration project, not an extracted implementation of the native target scorer. Its claim of approximately -1 to +2 loop weapon jitter is secondary evidence; the exact distribution and per-weapon application need native traces or further extracted data.

## Current loop

`game.js` currently runs an authoritative `1/60` second simulation. Imported catalog durations have already been converted from Normal to Faster real seconds, and movement speed/acceleration have already been scaled. Changing the step must **not** apply an additional 1.4 multiplier.

The current update pipeline is:

1. Advance clock; rebuild visibility; reset movement/planner budget; update cooldowns, regeneration, bursts, and projectiles.
2. Save previous actor positions/facing for interpolation.
3. Iterate the live entity array in insertion order. Advance production/research/construction, apply worker phases, perform auto-repair/fleeing and combat, then movement.
4. Run three overlap passes, remove dead entities, handle victory, age short-lived effects, and periodically run enemy macro/HUD.
5. Render interpolated previous/current positions and facing on `requestAnimationFrame`.

The distinction between simulation and rendering is already present and worth preserving. Its exact phase order, 60 Hz authority, fixed acquisition timer, crowd steering, and projectile integration remain custom policy.

## Highest-impact findings

| Finding | Evidence in this implementation | Correction and verification |
| --- | --- | --- |
| Construction erases combat damage | Worker construction and automatic add-on construction assign `hp=maxhp` at completion. Automatic construction also takes `max(currentHp, progress-derivedHp)` on every tick. A 99%-complete Depot with 100 accumulated damage goes from 296.4 HP to 400 instead of 300. | Add only the actual newly completed progress's HP contribution. Preserve damage on completion; do not overwrite HP with max. Test ordinary construction, auto-build, final partial step, damage during the final step, and halted/resumed work. Native `CAbilBuildable.VitalStartFactor.Life=.1` backs the starting fraction; preservation is the intended gameplay correction, not a claim about native floating-point rounding. |
| Long frames silently remove game time | `frame()` clamps every elapsed interval to `.1`. A 300 ms interval contributes only 100 ms to production, weapons, workers, and the match clock; 200 ms disappears. | Keep bounded work per rendered frame while retaining unprocessed simulation debt, or use an explicitly documented pause policy for long/background suspensions. Clamp interpolation to its valid interval while catching up. Verify a stall cannot permanently change the time-to-completion or simulation sequence. |
| Fixed insertion order biases lethal exchanges | A standalone reproduction using actual `createCombat` and Marine profiles starts two facing Marines at 6 HP, 50 world units apart. Ten 60 Hz steps leave unit 1 alive when iteration is `[1,2]`, unit 2 alive when it is `[2,1]`. | Introduce an explicitly seeded update scheduler only as a labeled replacement policy, or defer native-order parity. Test repeatability per seed and that array order does not permanently favor one team. Do not claim the replacement PRNG/permutation is Blizzard's. |
| Production changes the live iteration cohort | `spawn()` appends a trained unit while `for (const e of entities)` is still iterating. The newborn can move, acquire, or fire on its birth update, depending on producer order. It receives behavior after the cooldown/burst snapshot phase has already run. | Define a stable cohort or defer activation until the next step. This removes inconsistent scheduling; exact native newborn activation still requires observation. Test opposite producer iteration order, newborn rally, and immediate attack opportunities. |
| Win condition differs from melee | A team immediately loses when its final `core` dies even with Barracks, Depot, Refinery, or add-ons alive. `finish()` explicitly reports Command Center destruction. | For a melee study, use remaining physically present defeat-preventing structures, including airborne structures. A queued placement plan is not a completed physical actor. Native UnitData contains `PreventDefeat` on many structures/add-ons; the engine's melee options are exposed separately from base destruction. Test last town hall vs remaining grounded/flying structures, planned-only structures, and simultaneous elimination. |
| Visibility and entity decisions use mixed times | Visibility is rebuilt before movement; later units see positions already changed by earlier units while the visibility grid remains from the start of the step. | Establish and document a stable tick visibility policy. Refresh presentation visibility after simulation work if needed; do not invent an exact native phase order from the protocol. Test entering/leaving fog and that hidden targets' live coordinates are never chased. |
| End-of-match can process extra same-frame updates | The bounded accumulator loop checks `running` only before entering the loop. `finish()` can set `running=false` inside a tick, after which remaining iterations still execute. | Stop the frame's simulation loop immediately once the match ends. Test no extra income, damage, or training after the result is determined. |

Construction catalog reference: [pinned Core AbilData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AbilData.xml). Structure defeat flags: [pinned Liberty UnitData](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/UnitData.xml). Melee option declarations: [pinned native Galaxy declarations](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/TriggerLibs/natives.galaxy). These are historical extracted data, not current-client engine source.

## Whether to switch authority to 22.4 Hz now

The numeric native rate is directly documented, so changing to 22.4 Hz is a justified fidelity direction. Native captures are not necessary to know that 60 Hz differs. A one-line replacement is nevertheless insufficient: worker phase transitions, windups, burst intervals, turn integration, collision/yield amounts, production activation, and planner service all depend on the step size.

If this pass changes authority, make it a separate working change with a clock module, integer loop counter, retained simulation debt, stable update cohort, and render interpolation. Re-run worker economy, attack-cancel/kiting, crowd passage, routing latency, and actual keyboard/pointer QA at the live rate. Preserve immediate selection, cursor, placement previews, and order acknowledgement; avoid adding unrelated artificial input delay. A 22.4 Hz simulation can still render smoothly at 60/120 Hz.

If the pass prioritizes control groups and unit decisions without budgeting those checks, retain 60 Hz explicitly for now and fix the concrete gameplay defects independently. Claiming native loop parity before such a migration would be inaccurate. Claiming perfect native controls after the migration would still be inaccurate without engine and human-input captures.

## Unit intelligence boundaries

More useful unit AI should first honor command intent: Move ignores combat; explicit Attack persists on the commanded target while valid; Hold fires without chasing; Attack Move and Patrol scan/pursue/resume; harvesting/construction/repair retain their phase and queued successor. Smarter targeting must not overwrite queued orders, expose hidden enemy state, or insert automatic kiting/siege behavior that the native default unit does not perform.

Opponent strategy is a separate layer: resource budgeting, production, supply, gathering, scouting, defense, and attack decisions should issue ordinary orders through the same executor used by the player. A stronger scripted opponent is a prototype improvement; it is not native Blizzard AI. Avoid presenting tactical difficulty as a measurement of input smoothness.

Native comparison procedure and capture tool limits remain in [native-control-comparison.md](native-control-comparison.md). In particular, action-loop observations must accompany trajectories, while a separate recording must verify mouse selection, control-group modifiers, subgroup command cards, and perceived response.
