# Native-client research setup and license boundary

Checked on 2026-10-09. The user explicitly accepted the applicable agreements with: “I accept the terms for permitted research use.” Installation and native API research may proceed within that scope. Native binaries, map packages, and raw captures remain outside the public repository; no game assets are imported into the browser project.

## Exact sources and terms shown

Blizzard's [official API README](https://github.com/Blizzard/s2client-proto#downloads) links its Linux client/map/replay downloads and says:

> To access the linux packages, map packs and replay packs, you must agree to the AI and Machine Learning License.

> By typing in the password ‘iagreetotheeula’ you agree to be bound by the terms of the AI and Machine Learning License.

The [AI and Machine Learning License](https://blzdistsc2-a.akamaihd.net/AI_AND_MACHINE_LEARNING_LICENSE.html) states:

> IF YOU DO NOT AGREE TO THE TERMS OF THE EULA AND THIS AGREEMENT, YOU ARE NOT PERMITTED TO INSTALL, COPY, OR USE THE SOFTWARE.

Section 1.A states:

> Blizzard grants you a limited, revocable, non-sublicensable license to use the Software for purposes of AI testing, machine learning, and related research only.

Section 1.C.i states:

> no portion of this Agreement shall give you the right to create, distribute, or otherwise exploit unauthorized derivative works of the Software.

Section 1.C.iii authorizes specified generated-data use:

> in connection with AI and machine learning programs for personal or internal use

and also states:

> You may not otherwise use or exploit the Software for any commercial purpose.

The license incorporates the Blizzard EULA and gives this exact link: [http://us.blizzard.com/en-us/company/legal/eula.html](http://us.blizzard.com/en-us/company/legal/eula.html). On the check date that link redirected successfully to [Blizzard End User License Agreement](https://www.blizzard.com/en-us/legal/fba4d00f-c7e4-4883-b8b9-1b4500a402ea/blizzard-end-user-license-agreement), whose page says “LAST REVISED March 21, 2024.” This note quotes the sources; it does not determine whether a particular project or use satisfies their terms.

Acceptance was requested after the exact license and incorporated EULA were provided, and the user's explicit reply authorized installation for permitted research use. This records the user's response and the restricted research scope; it does not expand the agreement's permissions.

## Installed research client and actual observations

An isolated, untracked environment at `/workspace/scratch/native-sc2/.venv` contains `protobuf==3.20.3`, `s2clientprotocol==5.0.15.95299.0`, and `websockets==15.0.1`. Following the explicit acceptance, the official [SC2 4.10 Linux package](https://blzdistsc2-a.akamaihd.net/Linux/SC2.4.10.zip) and [Melee map pack](https://blzdistsc2-a.akamaihd.net/MapPacks/Melee.zip) were downloaded into scratch storage. The package is a historical build, not a current client. The Python protocol package version does not identify the native game version.

The native engine subsequently booted with a loopback-only API listener at `ws://127.0.0.1:5000/sc2api`. Actual `RequestPing` returned game version `4.10.0.75689`, base/data build `75689`, and data version `B89B5D6FA7CBF6452E721311BFBC6CB2`. A controlled, non-realtime raw-interface game on `Flat64.SC2Map`, seed `42`, successfully produced one-loop movement, order, Gather, Patrol, and combat observations. The setup, map hash, bounded findings, and remaining limits are recorded in [native-gameplay-observations.md](native-gameplay-observations.md).

[Blizzard's installation instructions](https://github.com/Blizzard/s2client-proto/blob/master/docs/linux.md) require suitable map data. Its offline Linux engine cannot automatically retrieve missing Battle.net map dependencies. This historical 4.10 client must not be described as current-patch parity or as a guaranteed exact match to the pinned Talv catalog.

Research captures record `RequestPing` game/base/data versions, actual map SHA-256, seed, fixture, action execution loops, and one-loop observations. Actual tags and unit/ability IDs are resolved from the running client. The research runner is separate from the public attachment collector; the latter's syntax checks alone are not evidence that it collected these fixtures. All native binaries, map files, and raw captures remain outside this repository. Headless observations measure movement and orders; they do not verify mouse selection, rendering, or perceived human controls.

## Using an existing licensed local client

An already licensed local installation can supply the endpoint without installing the downloadable package in this workspace. The collector accepts localhost endpoints only. Start that client with an API listener bound to loopback and an explicit unused port, following Blizzard's client documentation; do not expose it publicly. On the documented Linux client these flags are `-listen 127.0.0.1 -port 5000`, with `-dataDir` when the binary is outside its standard data directory.

Create and join a controlled, non-realtime game with `InterfaceOptions.raw` enabled. Keep distant surviving bases, then establish the fixture and distinct native unit labels. The existing collector attaches to an **already joined** game; it does not launch a client, create the map fixture, or accept software terms.

```sh
python tests/native_compare/capture_native.py --help
python tests/native_compare/capture_native.py \
  --endpoint ws://127.0.0.1:5000/sc2api \
  --fixture fixture.json --labels labels.json --output native-trace.jsonl
```

Run those commands in an environment with the protocol dependencies available. If the game runs on another machine, use a local collector on that machine; the workspace's localhost is a different host. Native trajectory comparison and the separate human-input capture requirements are described in [native-control-comparison.md](native-control-comparison.md).
