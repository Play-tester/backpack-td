import { type Item, type ItemDef, type ItemKind } from '../types'

// ── Blueprints ─────────────────────────────────────────────────────────────
export const ITEM_DEFS: Record<ItemKind, ItemDef> = {
  archer: {
    kind: 'archer',
    category: 'military',
    size: '1x1',
    label: 'Archer',
    color: '#4ade80',
    image: '/archer_tower.png',
    tierImages: [
      '/archer_tower_T1.png', // T1
      '/archer_tower_T2.png', // T2
      '/archer_tower_T3.png', // T3
      '/archer_tower_T4.png', // T4
      '/archer_tower_T5.png', // T5
      '/archer_tower_T6.png', // T6
      '/archer_tower_T7.png', // T7
    ],
    damage: 10,
    attackSpeed: 2,
    range: 3,
    maxDurability: 3,
    maxTier: 7,
  },
  cannon: {
    kind: 'cannon',
    category: 'military',
    size: '2x1',           // 2 cells tall
    label: 'Cannon',
    color: '#f97316',
    image: '/cannon_tower.png',
    tierImages: [
      '/cannon_tower_T1.png', // T1
      '/cannon_tower_T2.png', // T2
      '/cannon_tower_T3.png', // T3
      '/cannon_tower_T4.png', // T4
      '/cannon_tower_T5.png', // T5
      '/cannon_tower_T6.png', // T6
      '/cannon_tower_T7.png', // T7
    ],
    damage: 35,
    attackSpeed: 0.5,
    range: 4,
    maxDurability: 3,
    maxTier: 7,
  },
  frost: {
    kind: 'frost',
    category: 'military',
    size: '1x2',           // 2 cells wide — simple, cheap
    label: 'Frost',
    color: '#38bdf8',
    image: '/frost_tower.png',
    tierImages: [
      '/frost_tower_T1.png', // T1
      '/frost_tower_T2.png', // T2
      '/frost_tower_T3.png', // T3
      '/frost_tower_T4.png', // T4
      '/frost_tower_T5.png', // T5
      '/frost_tower_T6.png', // T6
      '/frost_tower_T7.png', // T7
    ],
    damage: 5,
    attackSpeed: 1.1,
    range: 3,
    maxDurability: 3,
    maxTier: 7,
  },
  bank: {
    kind: 'bank',
    category: 'economic',
    size: 'Г',             // Г-shape: 3 cells (2×2 bounding box) — both top + bottom-left
    label: 'Bank',
    color: '#fbbf24',
    image: '/bank.png',
    goldPerRound: 4,
  },
  shop: {
    kind: 'shop',
    category: 'economic',
    size: '1x1',           // 1 cell — small and cheap
    label: 'Shop',
    color: '#a78bfa',
    image: '/shop.png',
    goldPerRound: 1,
  },
  academy: {
    kind: 'academy',
    category: 'special',
    size: '2x2',           // 2×2 building — unlocks spells
    label: 'Academy',
    color: '#c084fc',
    image: '/academy.png',
  },
}

// ── Stat scaling per tier ─────────────────────────────────────────────────
// Economic items: +10% per tier (multiplicative)
// tier 1 = ×1.0, tier 2 = ×1.1, tier 3 = ×1.21, ...
export function getEconomicMultiplier(tier: number): number {
  return Math.pow(1.1, tier - 1)
}

// Military damage scaling — per kind:
// archer: +40% per tier · cannon/frost: +50% per tier
const DAMAGE_RATE: Partial<Record<string, number>> = {
  archer: 1.40,
  cannon: 1.50,
  frost:  1.50,
}

export function getMilitaryDamageMultiplier(tier: number, kind?: string): number {
  const rate = (kind ? DAMAGE_RATE[kind] : undefined) ?? 1.50
  return Math.pow(rate, tier - 1)
}

// Military range scaling:
// T1→T2: no range change, T2→T3: +10% range, T3→T4: no range change, T4→T5: +10% range, T5+: no change
export function getMilitaryRangeMultiplier(tier: number): number {
  if (tier <= 2) return 1.0
  if (tier === 3 || tier === 4) return 1.1
  // tier >= 5
  return 1.21  // 1.1 × 1.1
}

export function getScaledDamage(item: Item): number {
  const base = item.def.damage ?? 0
  return Math.round(base * getMilitaryDamageMultiplier(item.tier, item.def.kind))
}

export function getScaledRange(item: Item): number {
  const base = item.def.range ?? 0
  return base * getMilitaryRangeMultiplier(item.tier)
}

const BANK_GOLD = [4, 8, 16, 32, 64, 100]  // tier 1–6, capped at 100g

export function getScaledGold(item: Item): number {
  if (item.def.kind === 'shop') {
    // Doubles each tier, capped at tier 7 (64g)
    return Math.pow(2, Math.min(item.tier, 7) - 1)
  }
  if (item.def.kind === 'bank') {
    return BANK_GOLD[Math.min(item.tier, 6) - 1]
  }
  const base = item.def.goldPerRound ?? 0
  return Math.round(base * getEconomicMultiplier(item.tier))
}

/** Returns the correct image path for an item at its current tier. */
export function getItemImage(item: Item): string | undefined {
  const { tierImages, image } = item.def
  if (tierImages && tierImages.length >= item.tier) {
    return tierImages[item.tier - 1]
  }
  return image
}

// ── Instance factory ───────────────────────────────────────────────────────
let _nextId = 1

export function createItem(kind: ItemKind, tier = 1): Item {
  const def = ITEM_DEFS[kind]
  return {
    id: `item_${_nextId++}`,
    def,
    tier,
    durability: def.maxDurability,
  }
}

/** Merge two same-kind same-tier items → one tier+1 item (no tier limit) */
export function mergeItems(a: Item, b: Item): Item | null {
  if (a.def.kind !== b.def.kind) return null
  if (a.tier !== b.tier) return null
  // Respect per-kind tier cap if defined
  if (a.def.maxTier !== undefined && a.tier >= a.def.maxTier) return null
  const merged = createItem(a.def.kind, a.tier + 1)
  // Preserve the better durability instead of resetting to max
  if (a.durability !== undefined && b.durability !== undefined)
    merged.durability = Math.max(a.durability, b.durability)
  return merged
}
