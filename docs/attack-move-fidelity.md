# Attack-move target replacement and damage events

Blizzard's [Unit Control guide](https://news.blizzard.com/en-us/article/4552957/game-guide-unit-control), under “Focused Fire,” contrasts an explicit target's pursuit with Attack-Move attacking the next closest enemy when an opponent retreats. The prototype previously kept every valid equal-ranked incumbent, even outside weapon range with another enemy already in range.

AttackMove and Patrol now choose the nearest equal-ranked in-range alternative when their incumbent is out of range. Explicit Attack and idle pursuit retain their target, and an in-range incumbent remains stable. An admitted windup retains its catalog range slop. Hidden opponents, targets inside minimum range, and lower-priority opponents remain ineligible for this replacement. Without an in-range alternative, existing long pursuit remains intact, consistent with the controlled native traces documented in [native-autonomous-observations.md](native-autonomous-observations.md).

This is a bounded guide-backed improvement, not a claim to reproduce the engine's full arbitration. Patrol shares the prototype's AttackMove acquisition path; its exact native replacement rules and scan timing have not been independently measured. Existing acquisition cadence, weapon phases, cooldowns, and order metadata remain intact.

`createCombat` accepts an optional `onDamage(source, target, actualAmount)` callback. It runs after an actual hit updates target HP, damage-source telemetry, kill count, and effects. `actualAmount` is armor-adjusted HP lost, clamped to pre-hit remaining HP for a fatal hit. Delayed missiles report at impact; splash reports each damaged unit, including allies. No callback occurs for cancelled windups or invalid targets. Existing callers can omit it.

Validation: `node tests/attack_move_fidelity.mjs` checks route preservation, retreater replacement, stable/manual targets, priority and visibility exclusions, admitted shots, real damage phases, fatal amounts, missile timing, and allied splash.
