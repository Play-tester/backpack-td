// ── Crafting system ────────────────────────────────────────────────────────

export type CraftingMaterial = 'wood'

export interface CraftingUpgrade {
  id:          string
  name:        string
  description: string
  icon:        string
  maxLevel:    number
  costGold:    (level: number) => number
  costMats:    (level: number) => Partial<Record<CraftingMaterial, number>>
  effect:      (level: number) => string   // human-readable effect per level
}

export const CRAFTING_UPGRADES: Record<string, CraftingUpgrade> = {
  piercing_arrows: {
    id:          'piercing_arrows',
    name:        'Piercing Arrows',
    description: 'Archer tower arrows pierce enemy shields, partially ignoring their armor resistance.',
    icon:        '🏹',
    maxLevel:    3,
    costGold:    () => 20,
    costMats:    () => ({ wood: 10 }),
    effect:      (level) => {
      const ignore = level * 30  // 30% per level
      return `Archer arrows ignore ${ignore}% of shield armor`
    },
  },
}

export const ALL_CRAFTING_UPGRADES = Object.values(CRAFTING_UPGRADES)

export type CraftingState = Record<string, number>  // upgradeId → current level

export function getInitialCraftingState(): CraftingState {
  return {}
}

/** Returns the archer damage multiplier vs shield bearer based on piercing arrows level */
export function getPiercingArrowsResist(craftingState: CraftingState): number {
  const level = craftingState['piercing_arrows'] ?? 0
  if (level === 0) return 0.3   // base: 30% damage (70% absorbed)
  const ignorePercent = level * 0.3   // 30% ignored per level
  const absorbPercent = Math.max(0, 0.7 - ignorePercent)
  return 1 - absorbPercent   // effective damage multiplier
}
