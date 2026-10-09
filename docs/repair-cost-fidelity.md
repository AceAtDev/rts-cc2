# Proportional repair costs

The prototype calculated a nominal repair tick from the target's repair time, charged for that entire amount, then clamped health to maximum. Its final partial tick therefore drained resources for HP it never restored. The same mismatch could prevent an affordable final repair when the player had enough resources for the remaining damage but not for a nominal tick.

`dist/repair.js` exports `quoteRepair(target, requestedHP)`, returning `{hp, minerals, gas}`. The quote first limits HP to actual missing health and then calculates resource cost from that restoration. It does not mutate the target, charge the player, decide eligibility or change repair speed. The caller calculates requested HP using the existing target repair time, checks affordability using the quote, then pays and applies its HP.

The [pinned Liberty Repair effect](https://github.com/Talv/sc2-data/blob/1921f856b0443d4cbd366c472cd7984fa6a224d1/mods/liberty.sc2mod/base.sc2data/GameData/EffectData.xml), `CEffectCreateHealer Repair`, specifies resource drain factors of `.25`. Target repair durations and the existing Normal-to-Faster conversion remain unchanged. Fractional resource values retain the prototype wallet's existing precision; this correction does not certify native integer-display or internal fractional rounding behavior.

For a Tank missing `.01` HP, the old 22.4 Hz tick requested approximately `.24306` HP and charged `.05208` minerals. The corrected quote restores `.01` HP and charges approximately `.00214` minerals, proportional to the actual repair.

`node tests/repair_quote.mjs` runs nine checks covering final partial ticks, low-cash affordability, normal ticks, cumulative restoration cost, two repairers sharing a nearly completed target, full health, mineral-only targets and invalid requests. Browser integration must also verify the caller uses the quote for both affordability and payment.
