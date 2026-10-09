# Control groups and subgroup study

The previous control path treated any modified number as group assignment and inspected `event.key`. In an actual US browser keyboard event, Shift+1 produces `!`, so append and steal combinations could miss the number handler entirely. Assignment, recall and UI display also used different interpretations of member eligibility. This pass moves those decisions into `dist/control-groups.js`, keeps stable entity IDs in stored groups, and tests keyboard parsing independently of the renderer.

## Evidence and limits

[Blizzard's SC2 UI protocol](https://github.com/Blizzard/s2client-proto/blob/00025054b5d2769626ca6ab5b2c54249486e1577/s2clientprotocol/ui.proto) defines five distinct `ActionControlGroup.ControlGroupAction` operations: Recall, Set, Append, SetAndSteal and AppendAndSteal. Its comments associate them with number, Control+number, Shift+number, Control+Alt+number and Shift+Alt+number. Steal removes the **currently selected** units from other groups; append-and-steal should therefore leave units that were already in the destination group in any other groups they belonged to.

The [official Special Control guide](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control) confirms 0–9 assignment, quick double-tap camera centering, Shift append and Tab cycling between production building types in a mixed group. It supplies no numeric double-tap threshold. The browser retains its existing 350 ms interval; this is a local input setting, not a measured SC2 engine value.

[Pinned build 74071 Core GameStrings](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/enus.sc2data/LocalizedData/GameStrings.txt) documents group button left-click recall, right-click set and Alt+right-click set-and-steal, including assignable empty buttons. It also documents a Mac option to use Command instead of Control. The prototype accepts Meta as a Control alias without exposing that option. Its existing Alt+number shortcut is retained for compatibility; the API comments specifically describe Control+Alt. Unsupported Control+Shift combinations are ignored instead of guessing whether they should append or overwrite.

Death pruning, hidden cargo preservation and empty-group recall were not established by a native-client recording during this pass. The implementation uses a conservative policy: keep the IDs of live owned members while they are loaded or hidden inside a refinery; exclude transport cargo from active selection until unloaded; discard dead, missing, enemy and planned entities; and leave the current selection intact when no members can be recalled. Harvesting gas workers remain recallable and assignable while their actors are hidden, preserving the prototype's established ability to interrupt their worker orders immediately. That is a compatibility policy, not a newly verified native-client rule. These policies need client/replay comparison before being described as exact parity. Stored groups do not record the last active subgroup, because subgroup recall persistence is also unverified.

## Integration

| Export | Purpose |
| --- | --- |
| `controlGroupDigit(event)` | Parse physical Digit0–9 so Shift punctuation does not break bindings; accept code-less numeral events. |
| `controlGroupOperation(event)` | Convert keyboard modifiers into one explicit operation, or null for unsupported combinations. |
| `controlGroupButtonOperation(event)` | Convert actual left/right mouse buttons into source-backed recall/set/steal actions. |
| `assignControlGroup(groups, digit, selection, entities, operation)` | Return a fresh group map; preserve live hidden IDs, reject stale entity objects after a reset, apply set/append/steal semantics. |
| `pruneControlGroups(groups, entities)` | Return a fresh map that removes dead or missing IDs without losing live cargo. |
| `groupMembers(groups, digit, entities, {selectableOnly})` | Resolve live members in subgroup-priority order; optionally exclude transport cargo while retaining hidden gas workers. |
| `sortedSelection`, `subgroupTypes`, `cycleSubgroup` | Use stable priority and entity-ID ordering; cycle forward/backward without changing the selected population. |
| `createGroupRecallTracker({windowMs})` | Track successive recalls; cancel or reset after intervening actions to prevent stale camera jumps. |

The caller owns selection, camera centering, ten group buttons, preventing the browser context menu and cancelling the recall tracker when commands or other selection gestures intervene. Runtime tests must exercise the actual keyboard and group buttons, because module tests alone would not catch a missed input-handler integration.

## Verification

`node tests/control_groups_followup.mjs` passes 39 checks covering physical modified digits, all five operations, direct group button operations, set/append/steal overlaps, team/death/reset eligibility, load/unload membership, gas-worker recall and assignment during hidden harvest, empty and invalid assignment, stable subgroup ordering, reverse Tab, and interrupted/delayed double-tap recall. These verify the prototype's declared policies; they do not certify native timing, native camera centering geometry, shared ally selections, maximum selection sizes or user-customized hotkey profiles.
