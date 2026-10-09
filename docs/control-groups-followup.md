# Control groups and subgroup study

The previous control path treated any modified number as group assignment and inspected `event.key`. In an actual US browser keyboard event, Shift+1 produces `!`, so append and steal combinations could miss the number handler entirely. Assignment, recall and UI display also used different interpretations of member eligibility. This pass moves those decisions into `dist/control-groups.js`, keeps stable entity IDs in stored groups, and tests keyboard parsing independently of the renderer.

## Evidence and limits

[Blizzard's SC2 UI protocol](https://github.com/Blizzard/s2client-proto/blob/00025054b5d2769626ca6ab5b2c54249486e1577/s2clientprotocol/ui.proto) defines five distinct `ActionControlGroup.ControlGroupAction` operations: Recall, Set, Append, SetAndSteal and AppendAndSteal. Its comments associate them with number, Control+number, Shift+number, Control+Alt+number and Shift+Alt+number. Steal removes the **currently selected** units from other groups; append-and-steal should therefore leave units that were already in the destination group in any other groups they belonged to.

The [official Special Control guide](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control) confirms 0–9 assignment, quick double-tap camera centering, Shift append and Tab cycling between production building types in a mixed group. It supplies no numeric double-tap threshold. The browser retains its existing 350 ms interval; this is a local input setting, not a measured SC2 engine value.

[Pinned build 74071 Core GameStrings](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/enus.sc2data/LocalizedData/GameStrings.txt) documents group button left-click recall, right-click set and Alt+right-click set-and-steal, including assignable empty buttons. It also documents a Mac option to use Command instead of Control. The prototype accepts Meta as a Control alias without exposing that option. Its existing Alt+number shortcut is retained for compatibility; the API comments specifically describe Control+Alt. Unsupported Control+Shift combinations are ignored instead of guessing whether they should append or overwrite.

Death pruning, hidden cargo preservation and empty-group recall were not established by a native UI recording during this pass. The implementation keeps the stored IDs of live owned members while they are loaded or hidden inside a refinery, but excludes those inaccessible members from selection, new assignment and recall until they emerge. It discards dead, missing, enemy and planned entities and leaves the current selection intact when no members can be recalled. Stored groups do not record the last active subgroup, because subgroup recall persistence is also unverified.

[The native gas follow-up](native-worker-gas-followup.md) provides narrower command evidence from SC2 `4.10.0.75689`: known-tag explicit Gather submitted during hidden extraction returned Error, while Smart/Move/Stop/Hold returned NotSupported, without observed execution or a changed exit time. The host now rejects hidden-worker commands instead of allowing instant interruption. This historical API fixture does **not** prove all native UI, retained-selection or control-group behavior; those edge cases still need comparison. The worker's internal release path remains necessary for death, destruction and administrative cancellation.

## Integration

| Export | Purpose |
| --- | --- |
| `controlGroupDigit(event)` | Parse physical Digit0–9 so Shift punctuation does not break bindings; accept code-less numeral events. |
| `controlGroupOperation(event)` | Convert keyboard modifiers into one explicit operation, or null for unsupported combinations. |
| `controlGroupButtonOperation(event)` | Convert actual left/right mouse buttons into source-backed recall/set/steal actions. |
| `assignControlGroup(groups, digit, selection, entities, operation)` | Return a fresh group map; preserve existing live hidden IDs while excluding them from new assignment, reject stale entity objects after a reset, apply set/append/steal semantics. |
| `pruneControlGroups(groups, entities)` | Return a fresh map that removes dead or missing IDs without losing live cargo. |
| `groupMembers(groups, digit, entities, {selectableOnly})` | Resolve live members in subgroup-priority order; optionally exclude transport cargo and hidden gas workers until emergence. |
| `sortedSelection`, `subgroupTypes`, `cycleSubgroup` | Use stable priority and entity-ID ordering; cycle forward/backward without changing the selected population. |
| `createGroupRecallTracker({windowMs})` | Track successive recalls; cancel or reset after intervening actions to prevent stale camera jumps. |

The caller owns selection, camera centering, ten group buttons, preventing the browser context menu and cancelling the recall tracker when commands or other selection gestures intervene. Runtime tests must exercise the actual keyboard and group buttons, because module tests alone would not catch a missed input-handler integration.

## Verification

`tests/control_groups_followup.mjs` contains 39 checks covering physical modified digits, all five operations, direct group button operations, set/append/steal overlaps, team/death/reset eligibility, load/unload membership, retained gas-worker IDs with hidden workers excluded from selection and assignment, empty and invalid assignment, stable subgroup ordering, reverse Tab, and interrupted/delayed double-tap recall. These verify the prototype's declared policies; they do not certify native timing, native camera centering geometry, shared ally selections, maximum selection sizes or user-customized hotkey profiles.

`tests/control_groups_input.py` retains the prior Marine selection when recalling a group whose gas worker is inaccessible, verifies that actual Move input leaves that worker extracting, and checks that gas emergence restores recall through the original group. `tests/worker_controls.py` verifies direct hidden Move rejection, completion of extraction with earned cargo, and accepted Move after emergence with cargo preserved.

`tests/control_groups_input.py` exercises actual browser keys and group buttons. Its double-tap fixture records trusted keyboard event timestamps and handler camera positions. Two separate Playwright `press` calls initially yielded a measured 554.4 ms interval in headless software WebGL, correctly missing the 350 ms window. The fixture now submits both gestures in one `keyboard.type('88', delay=0)` batch. If the measured rendered input interval still exceeds the window, it verifies that the camera stays in place, briefly suppresses only renderer drawing and repeats the genuine keyboard gestures to isolate the handler. The centering assertion still requires two trusted events less than 350 ms apart and the camera at the selected unit's position. A run using that fallback verifies input routing and camera behavior; it does not verify double-tap latency while rendering in this environment.

An earlier diagnostic integration run passed 26 browser checks. Its rendered pair arrived 1066.4 ms apart with both camera positions at x=1200; the input-isolated pair arrived 76.8 ms apart with positions x=1200 then x=980, matching the selected Marine. Other browser suites overlapped this diagnostic run, so the slow rendered result is environment/load evidence rather than an isolated rendering benchmark. No runtime window or centering behavior was changed to make the test pass. This earlier count predates the hidden-gas accessibility correction and is not a verification total for the current tests.
