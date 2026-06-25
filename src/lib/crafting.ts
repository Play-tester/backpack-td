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
    costGold:    (level) => [20, 35, 50][level] ?? 50,
    costMats:    (level) => ({ wood: [10, 15, 20][level] ?? 20 }),
    effect:      (level) => {
      const dmg = [40, 60, 80][level - 1] ?? 80
      return `Archer arrows deal ${dmg}% damage to Shield Bearers`
    },
  },
}

export const ALL_CRAFTING_UPGRADES = Object.values(CRAFTING_UPGRADES)

export type CraftingState = Record<string, number>  // upgradeId → current level

export function getInitialCraftingState(): CraftingState {
  return {}
}

/** Returns the archer damage multiplier vs shield bearer based on piercing arrows level.
 *  Level 0: 20%  (base, shield absorbs 80%)
 *  Level 1: 40%  (shield absorbs 60%)
 *  Level 2: 60%  (shield absorbs 40%)
 *  Level 3: 80%  (shield absorbs 20%)
 */
export function getPiercingArrowsResist(craftingState: CraftingState): number {
  const level = craftingState['piercing_arrows'] ?? 0
  return [0.2, 0.4, 0.6, 0.8][level] ?? 0.8
}
