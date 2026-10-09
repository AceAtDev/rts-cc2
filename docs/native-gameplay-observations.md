# Historical native gameplay observations

On 2026-10-09, a licensed, headless StarCraft II Linux client produced actual raw-API observations for movement, command intent, queued Patrol, and bounded combat fixtures. These observations are independent of the browser's own regression expectations. They cover one historical client and controlled fixtures; they do not certify a full clone, current-patch behavior, human input feel, rendering, or all unit AI.

## Client and fixture provenance

| Field | Recorded value |
| --- | --- |
| Official client package | [SC2.4.10.zip](https://blzdistsc2-a.akamaihd.net/Linux/SC2.4.10.zip) |
| `RequestPing.game_version` | `4.10.0.75689` |
| Base / data build | `75689` / `75689` |
| Data version | `B89B5D6FA7CBF6452E721311BFBC6CB2` |
| Map source | Official [Melee map pack](https://blzdistsc2-a.akamaihd.net/MapPacks/Melee.zip), `Flat64.SC2Map` |
| Map display name | `Simple Test Map 64x64` |
| Map SHA-256 | `e699838666a5b27754fc82e97342559186e5edd1ae29b0f2c3aaa711a616107d` |
| Playable area | `(12,10)` through `(76,74)` |
| Random seed | `42` |
| Game setup | Non-realtime; raw interface; fog disabled; Terran participant and Very Easy Terran computer |
| Observation interval | One native game loop; elapsed Faster time represented as loops / `22.4` |

The game remains paused between explicit API steps. The runner issues raw commands, records API action results and reported execution loops, then samples each loop. Successful action results are necessary but do not by themselves prove movement or damage. Initial positions, facing, order state, and cooldown are recorded rather than assumed. No time shift is applied to improve comparisons.

Fixtures use a clear central lane, retain surviving bases, remove unwanted owned mobile units, and debug-create the measured units. Neutral debug creation uses owner `0`; the observed neutral units report owner `16`. Runtime unit/ability IDs and actual target tags are obtained from the running client. Debug-created placement can move a unit away from its requested position, especially in close-contact fixtures, so conclusions use observed positions. A one-unit eastward Move followed by settled orders and quiet loops provides orientation preparation where specified. Combat timing trials additionally aim at the stationary target, Stop, and wait for zero cooldown before the measured command.

All binaries, maps, and raw JSONL observations remain in private scratch storage outside the public repository. The license sources and explicit acceptance are recorded in [native-client-license-boundary.md](native-client-license-boundary.md). SDK version `5.0.15.95299.0` is a protocol-package version, not the native engine version. The running build is not guaranteed to match the separately pinned Talv data snapshot.

## Isolated point movement

Six unit types received an eastward, ten-game-unit Move. Each reached the exact requested point. The order cleared on the following sampled loop:

| Unit | First translating loop displacement | First observation with completed Move |
| --- | --- | --- |
| Marine | `0.140625` game units | Loop `73` |
| Marauder | `0.140625` game units | Loop `73` |
| SCV | `0.009765625` game units | Loop `74` |
| Reaper | `0.234375` game units | Loop `44` |
| Hellion | `0.265625` game units | Loop `39` |
| Siege Tank, unprepared facing | No translation for the first two loops | Loop `75` |

The SCV accelerates and slows before arriving. Near the ten-unit goal, its successive remaining distances include `0.078125`, `0.0390625`, `0.009765625`, and `0`. Its one-, two-, five-, and twenty-unit Moves cleared on loops `21`, `25`, `45`, and `130`. These short and long fixtures distinguish stopping behavior from a single endpoint adjustment.

Two repeats of the initial fourteen-fixture sequence, with the same seed and setup, produced zero observed position differences at corresponding loops for every recorded label. That establishes repeatability for this sequence, not a general claim about combat randomness or all native scenarios. The corresponding nine isolated browser movement comparisons and their scope are documented in [native-arrival-fidelity.md](native-arrival-fidelity.md).

### Tank facing and translation

Three further ten-unit eastward Tank Moves separate translation from initial turning:

| Prepared direction | Observed initial facing | First translating loop | Completed Move |
| --- | --- | --- | --- |
| East | `6.28270149` radians | `1` | `73` |
| North | `1.56982851` radians | `2` | `74` |
| West | `3.14207649` radians | `4` | `76` |

The north-facing Tank remains stationary while its first loop changes facing to approximately `0.78467226`. The west-facing Tank remains stationary for three loops while turning by approximately `0.78515625` radians per loop. Translation then proceeds at `0.140625` game units per loop and ends at the exact point. This explains the unprepared Tank's discrepancy with an east-facing prototype fixture. These measurements do not establish every unit's turn-versus-movement policy.

A moving Tank reversal confirms that this turn behavior also applies when a new command reverses ongoing travel. After ten eastward movement loops, the opposite Move executes at loop `10`; translation stops on loops `11`–`13`, facing changes by approximately forty-five degrees per loop, and westward translation begins on loop `14`.

## Shared command and formation

A single raw Move command containing twenty-four Marine tags targeted one shared point. The Marines began in a six-column, four-row grid with spacing one game unit. On the first observation, the native engine exposed distinct per-unit Move target positions. The final grid retained that spacing and translated its center to the shared command point; every Move cleared by loop `98`, and all remained idle through loop `300`.

A twelve-Marine fixture also received distinct per-unit targets and completed by loop `105`. One initial debug-created actor had a recorded placement displacement, so its grid was not perfectly regular. These observations establish that this native group command preserves offsets rather than requiring every actor to occupy the click coordinate. They do not identify the native rules for distant selections, mixed radii, chokepoints, formation compression, or crowded reassignment.

Further controlled cases show that preservation has limits:

| Selection | First observed Move targets | First loop with every Move cleared |
| --- | --- | --- |
| Two Marines twenty game units apart | Both target the shared click | `116` |
| Twenty-four Marines, six by four, spacing `0.8` | Distinct targets preserve translated offsets | `73` |
| Forty-eight Marines, eight by six, spacing `1` | All target the shared click | `77` |

The collapsed groups settle around the click rather than every actor reaching it: final two-Marine separation is approximately `0.7939453` game units; the forty-eight-Marine crowd has a much broader extent. Dense twenty-four-unit destinations are individually reached, within native coordinate quantization. Further probes below separate extent from count. At loop `298`, one actor in each dense twenty-four- and forty-eight-unit case exposes a Move to its current position again, without subsequent displacement. Their completion result therefore describes the first clearing of the issued orders, not permanent absence of all future native orders.

### Compact-formation boundary and center

Two-loop probes inspect the native per-unit order points immediately after a shared Move twenty game units east. Horizontal and vertical Marine pairs preserve offsets at separation four, and collapse to the shared click at separations six, eight, and ten. More precise horizontal probes give:

| Pair type | Observed radius per actor | Center separation that preserves offsets | Tested larger separation that collapses |
| --- | --- | --- | --- |
| Marine | `0.375` | `5.25` | `5.260009765625` |
| Marauder | `0.5625` | `4.875` | `5.25` |
| Siege Tank | `0.875` | `4.25` | `5.25` |

Each preserved boundary case has total horizontal footprint extent six game units after including both radii. A diagonal Marine pair with horizontal and vertical spans four preserves offsets even though its Euclidean separation is approximately `5.65685425`. A twenty-four-unit grid with horizontal center span six collapses, whereas the same count with span five preserves. These observations fit a compact-ground-formation condition in which the maximum width or height of the radius-inclusive, axis-aligned selection bounds is at most six game units. They do not prove the proprietary implementation, all selection categories, or all terrain/fallback rules.

A deliberately skewed three-Marine selection at horizontal coordinates `32`, `33`, and `36` targeting `54` receives native order destinations `52.333496`, `53.333496`, and `56.333496`. This distinguishes translation around the arithmetic mean of actor centers from translation around the bounding-box midpoint. Native coordinates quantize the translation; an unquantized mean gives slightly different low-order values, so this finding does not assert bit-exact arithmetic equivalence.

One compact twenty-four-Marine Attack Move probe, with no enemy interaction during the two sampled loops, produces the same translated offsets as Move. The first observed Attack orders expose twenty-four distinct destinations centered on the shared command point. This measures initial march goals; it does not establish acquisition, pursuit, or resumption behavior during combat.

## Command intent

- **Move targeting a friendly unit:** a Marine received Move with the SCV's actual target tag. When the SCV received a later eastward Move, the Marine retained the Move target tag and followed the changed target position throughout the forty-loop capture.
- **Queued Patrol:** a Marine received Move to a point ten units east, followed by queued Patrol another ten units east. Its later Patrol cycles returned toward the completed Move endpoint, not its position when the queued command was issued. The captured return/outbound range over the later cycles was approximately `42.125` through `51.96875`; the original position was `32`. Observation continued for four hundred loops.
- **Explicit Gather:** the SCV's observed harvest order retained the exact selected MineralField tag through eighty loops. The runtime Gather action ID was `3666`; the observed SCV harvest order ID was `295`. A Smart command to a mineral likewise became the harvest order on the first loop and retained that resource tag through thirty loops. This supports preserving explicit resource intent during approach; it does not measure every mining, return, saturation, or depletion phase.

### Mineral extraction, return wait, and command successors

Two additional four-hundred-loop fixtures use one local MineralField and grounded Command Center, first with one SCV and then with two targeting the same field. Actual observed centers are Command Center `(39.5,42.5)`, mineral `(46,42.5)`, and first worker `(43,42)`. Each frame records both the base and field, player minerals, resource contents, worker cargo buffs, positions, and orders.

In the single-worker case, the first cargo buff appears and the field loses five minerals on loop `67`. The worker remains stationary with cargo through loop `74`; its first return movement occurs on loop `75`. The observed order during that wait is SCV return `296`, initially without a target tag. The return movement then names the local Command Center. On loop `101`, the cargo buff disappears, player minerals increase by five, the harvest target is restored, and outward movement starts immediately. This fixture has no stationary delay at the depot.

With two workers, the first cargo appears on loop `67` and the other worker's cargo on loop `113`, forty-six loops later. The first worker's return wait has not prevented the next extraction from beginning. This supports releasing the field's extraction slot at cargo creation rather than holding it through the return wait. It does not determine all native resource-lock internals or general saturation behavior.

Three further fixtures establish how command successors interact with that wait:

- Unqueued Move issued immediately after observing first cargo on loop `67` is accepted at that loop and appears behind return-wait order `296`. It remains deferred through loop `74` and starts on loop `75`, with cargo preserved.
- Unqueued Move issued during the wait on loop `71` has the same activation boundary, loop `75`, and preserves cargo.
- Move queued after Gather at loop `0` likewise becomes the active order on loop `75`, after extraction and its wait, before any deposit. The worker carries the minerals to the Move endpoint.

These observations verify an uninterruptible post-extraction wait for the measured commands and a queued Gather successor that can execute before returning cargo. They do not establish behavior for every command type, gas, depletion, destruction of the resource/base, or all mining geometry.

Stop and Hold issued during the wait on loop `71` are also observed as successors behind `296` through loop `74`. On loop `75`, Stop leaves no active order and Hold becomes the active hold order; both workers remain stationary with cargo and do not deposit during the remaining capture. ReturnCargo issued during that wait is accepted but produces no additional executed-action observation or successor order; the existing wait, return, deposit, and resumed Gather proceed unchanged. That redundant-command result does not establish a general rule for ReturnCargo in other phases.

## Bounded combat timing and pursuit

Combat fixtures explicitly Attack a stationary or deliberately moved friendly-owned target. Native API commands permit this, and it prevents opponent acquisition or autonomous target orders from confounding the measurements. These tests measure the attacker command and weapon behavior; they do not establish enemy acquisition scoring, vision, assistance, leash behavior, or opponent AI.

For an aimed Marine with zero initial cooldown and a stationary Marauder four game units away, the first health loss occurred on loop `2`. Issuing Move on loop `0` or `1` prevented that hit. Issuing Move after observing loop `2` or `3` left that first hit intact. Attack, Move after loop `2`, then Attack after loop `3` produced hits on loops `2`, `17`, and `32`: movement did not erase the weapon cooldown in this fixture.

For an aimed SCV with zero initial cooldown and a stationary Marine approximately `0.7998047` game units away, the first health loss occurred on loop `4`. Move after loop `1`, `2`, or `3` prevented it; Move after loop `4` retained it. The clean repeated-attack fixture produced hits on loops `4`, `28`, `53`, and `79`. A separate close-placement fixture drifted off the original lane and required approach before striking; it is not treated as the aligned timing baseline.

The aimed Marine's repeated hits occurred on loops `2`, `17`, `33`, `47`, `62`, `77`, and `90`. Another preparation sequence produced `2`, `16`, `31`, `45`, `60`, `74`, and `87`. Observed intervals vary, so these traces do not support forcing one exact integer cadence or claiming the browser reproduces native weapon jitter. First-hit and cancellation observations establish the measured boundary without revealing proprietary internal update phases.

Marine and SCV Attack commands also retained their explicitly chosen tags while pursuing deliberately moving targets. The Marine fired initially, chased after the target left range, and fired again after closing. The SCV closed its moving target and then struck repeatedly. This verifies bounded manual pursuit and target retention, not general combat AI equivalence.

## Remaining comparison work

The strongest measured agreement is isolated point displacement and order lifetime. Tank facing, shared-goal formation, first-hit timing, cancellation, and these single-field worker phases now provide concrete additional native comparisons. General worker cycles and gas, heterogeneous crowds, narrow passages, attack acquisition, terrain visibility, control-group modifiers, mouse selection, command-card behavior, and renderer/animation fidelity still require separate evidence. Headless raw API output cannot certify perceived input smoothness or the complete SC2 interface.
