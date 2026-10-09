# Native aligned attack phase comparison

Study date: 2026-10-09. The native capture agent ran actual client commands with successful results and exact requested loop stepping. Raw maps, catalog extraction and client traces remain outside the repository. This document records the bounded findings relevant to combat.js, not a claim that the whole executor matches the client.

## Aligned cold starts

The usable captures begin with zero weapon cooldown and heading `6.28270149`, effectively aligned with the target. Marine's target is four game units away. The clean SCV repeat capture uses the reported `.7998047` separation from a Marine; the separate off-lane SCV capture that chased before hitting is excluded.

| Unit | First observed native hit | Move cancels before impact | Move preserves completed impact |
| --- | ---: | --- | --- |
| Marine | Loop 2 | At loop 0 or 1 | At loop 2 or 3 |
| SCV | Loop 4 | At loop 1, 2 or 3 | At loop 4 |

The prototype previously created a positive damage-point phase and immediately subtracted the elapsed duration of the same processing loop. It therefore fired the aligned Marine on loop 1 and the SCV on loop 3. Newly created positive phases now keep their full damage-point duration on that loop and begin elapsed-time processing on the following loop. Zero-point weapons still fire on their first eligible loop.

Explicit Move cancels a pending phase; after impact it preserves both applied damage and remaining cooldown. Reissuing the same explicit target preserves its existing phase. These behaviors matter for manual stutter-step timing and prevent a repeated command from creating another shot.

## Repeat admission and remaining jitter

Positive-point pre-windup admission includes one creation-loop allowance: `cooldown <= damagePoint + dt`. Actual firing still requires cooldown zero. This custom discrete scheduling preserves the quantized catalog base cadence while avoiding an additional repeat-loop delay caused solely by the new creation-phase rule. It is not a reconstruction of native random scheduling.

The isolated prototype fires Marine at loops `2,16,30,44,58,72` and SCV at `4,28,52,76`. The native aligned period captures report Marine `2,17,33,47,62,77,90` and SCV `4,28,53,79`. Therefore the cold-start phase matches these measured cases, while repeat jitter remains different. A native Marine cancellation after impact followed by reattack also preserves the original cooldown, with hits at `2,17,32`.

The pinned [Core WeaponData](https://raw.githubusercontent.com/Talv/sc2-data/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/core.sc2mod/base.sc2data/GameData/WeaponData.xml) legacy defaults include `RandomDelayMin=-0.0625` and `RandomDelayMax=0.125` Normal seconds. Importing those numbers alone would not establish the current client's random distribution, seeded scheduling, phase order or exact repeat cadence. Random weapon delay is deliberately still listed as a fidelity gap.

## Verification

`node tests/attack_phase_fidelity.mjs` passes 15 isolated checks: aligned first hits, every tested pre-impact cancellation boundary, post-impact cooldown preservation, base repeat cadence, immediate zero-point weapons and same-target phase persistence. The 20 order-fidelity and 19 AI checks also pass after the phase correction.

`tests/attack_phase_integration.py` also passes eight checks through the real browser order executor at 22.4 Hz: the two cold-start boundaries, no early impact, Move before impact, and post-impact Move/reattack with preserved cooldown. Range-slop browser fixtures now use native-rate loops to retain the measured first-shot phase. Mouse/keyboard reproduction remains a separate input comparison. Additional native cases are needed for moving targets, turns, range-slop, Stim, bursts and projectiles before extending these conclusions to those phases.
