# Attack warnings and transmission recall

The demo previously changed unit life without emitting an under-attack warning. Its `notify()` also inserted every error into location history using the current camera as a fallback. Space could therefore jump to an arbitrary camera position after a failed command instead of the last actual unit transmission. This module separates display-only errors from location-bearing game events and supplies bounded damage warnings for integration by the main game.

## Primary evidence

Sources were fetched on 2026-10-09:

- [Blizzard Special Control](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control), “Last Transmission”: Space centers the last transmission location; repeated presses cycle up to eight transmissions. Its examples include “We're under attack!” and “Building complete.”
- [Blizzard Simplified Controls](https://news.blizzard.com/en-us/article/6640645/game-guide-simplified-controls) describes Space as cycling recent warnings/transmissions.
- [Pinned Core AlertData](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/AlertData.xml) supplies separate `AttackTown` and `AttackUnit` peripherals and voice channels, a red attack ping, and display-disabled `Error`/`TrainError` alerts. The `Attack` parent sets Life and OverlapDuration to 15, OverlapLocalRadius to 15, local count to 1 and global count to 2. The default Alert sets PingTime to 6 and the Combine flag.
- [Pinned Liberty AlertData](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/AlertData.xml) links Terran forces/base attack warnings to distinct sound assets. The prototype does not bundle those audio clips.

The pinned catalogs are historical extracted game data. Their UI time domain and whether overlap limits combine across sibling alert IDs are not established by these files alone. This module explicitly interprets the values as **custom simulation-second policy**: fifteen-second overlap windows, a fifteen-game-unit radius, two active distant attack clusters, and six-second pulses. It does not multiply or divide those UI fields by Faster and claim exact native timing. Superseding a nearby forces warning with a base warning is also a custom policy choice.

## Behavior and API

`createAlerts({clock, team=0, policy={}})` returns:

- `transmit(text, point, {kind='notification', ping=false})`: stores a finite coordinate snapshot and resets recall to newest. Missing points are rejected rather than replaced with camera coordinates. History retains at most eighty rows by default.
- `error(text)`: creates a display-only notice without adding a camera target or changing recall position.
- `onDamage(source, target, amount)`: accepts actual positive hostile damage to the local team, including a fatal hit or a missile from a source that has since died. It returns a new forces/base notice, a superseding base notice, or `null` for suppressed repeats. Friendly damage and damage to enemy units do not produce local attack warnings.
- `recall()`: cycles the newest eight location-bearing transmissions, preserving snapshot coordinates when units later move or die.
- `history()` and `pings()`: return copies for UI rendering; expired pulses disappear while historical camera targets remain available. Active attack suppression and pulses survive eviction by other notifications.
- `reset()`: clears history, overlap state, pulses and recall position between games.

The module stores no entity references. Coalesced ordinary hits update count/time metadata without replaying the visible warning each weapon impact. It does not extend the overlap window indefinitely, so a sustained fight can emit another warning after the window expires. A base hit can supersede a nearby forces warning without creating another row and snapshots the affected own structure's observed location. Errors and generic completion notifications do not consume the attack cluster limit.

The root integration owns actual damage admission, notification display/audio, minimap pulse drawing and the Space camera action. It must invoke `onDamage` after armor and real damage are resolved, use the returned notice directly rather than inserting a second transmission, and keep Scanner Sweep gameplay state outside this presentation history.

## Verification

`node tests/alerts_followup.mjs` passes 33 isolated checks covering finite/snapshotted locations, display-only errors, eight-event recall, bounded history, real/fatal/late-missile impacts, own-team filtering, local/global overlap, sustained damage, base supersession, ping expiry, eviction pressure and reset. These tests establish the module contract. The browser integration checks real combat callbacks, pulses and Space navigation. Native alert timing still requires direct comparison.
