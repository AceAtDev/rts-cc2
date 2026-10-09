// Pinned Repair effect: restoration drains 25% of the target's resource cost
// per full-life restoration. Timing and repair-target eligibility live outside
// this quote; charge only for HP that this particular repair tick can restore.
export const REPAIR_COST_FACTOR=.25;
export function quoteRepair(target,requestedHP){
  const empty={hp:0,minerals:0,gas:0};
  if(!target||!Number.isFinite(target.maxhp)||target.maxhp<=0||!Number.isFinite(target.hp)||!Number.isFinite(requestedHP)||requestedHP<=0)return empty;
  const hp=Math.min(requestedHP,Math.max(0,target.maxhp-target.hp));
  const fraction=REPAIR_COST_FACTOR*hp/target.maxhp;
  return {hp,minerals:(target.cost||0)*fraction,gas:(target.gas||0)*fraction};
}
