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
  minWave?:    number                      // hide this card until wave >= minWave
}

export const CRAFTING_UPGRADES: Record<string, CraftingUpgrade> = {
  ballista_research: {
    id:          'ballista_research',
    name:        'Ballista Tower',
    description: 'Unlock the Ballista — a powerful siege weapon that excels against aerial enemies. Once researched, Ballistas appear in the shop.',
    icon:        '🏹',
    maxLevel:    1,
    costGold:    (_level) => 30,
    costMats:    (_level) => ({ wood: 30 }),
    effect:      (_level) => 'Ballista appears in the shop (full dmg vs aerial, 50% vs ground)',
    minWave:     11,
  },
  lantern_research: {
    id:          'lantern_research',
    name:        'Lantern Tower',
    description: 'Unlock the Lantern Tower — a mystical beacon that pins Fallen Druids visible and amplifies damage dealt to nearby enemies.',
    icon:        '🏮',
    maxLevel:    1,
    costGold:    (_level) => 25,
    costMats:    (_level) => ({ wood: 20 }),
    effect:      (_level) => 'Lantern Tower appears in the shop. Enemies in its radius take +10% more damage.',
    minWave:     17,
  },
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
export function isBallistaUnlocked(craftingState: CraftingState): boolean {
  return (craftingState['ballista_research'] ?? 0) >= 1
}

export function isLanternUnlocked(craftingState: CraftingState): boolean {
  return (craftingState['lantern_research'] ?? 0) >= 1
}

/** Damage amplifier applied to enemies inside a lantern's radius (per lantern tier).
 *  T1: +10%, T2: +13%, T3: +16%, T4: +20%, T5: +25%, T6: +30%, T7: +40%
 */
export const LANTERN_DEBUFF_BY_TIER = [0.10, 0.13, 0.16, 0.20, 0.25, 0.30, 0.40]

export function getPiercingArrowsResist(craftingState: CraftingState): number {
  const level = craftingState['piercing_arrows'] ?? 0
  return [0.2, 0.4, 0.6, 0.8][level] ?? 0.8
}
