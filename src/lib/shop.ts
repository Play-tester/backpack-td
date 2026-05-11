import { createItem } from './items'
import type { Item, ItemKind } from '../types'

export const ITEM_COSTS: Record<ItemKind, number> = {
  archer: 3,
  cannon: 6,
  frost: 4,
  bank: 5,
  shop: 4,
  academy: 20,
}

export interface ShopSlot {
  id: string
  item: Item
  cost: number
  sold: boolean
}

let _shopId = 1
const ALL_KINDS:      ItemKind[] = ['archer', 'cannon', 'frost', 'bank', 'shop']
const MILITARY_KINDS: ItemKind[] = ['archer', 'cannon', 'frost']

/** Purchase cost for an item of a given kind and tier */
export function getItemCost(kind: ItemKind, tier: number): number {
  return Math.round(ITEM_COSTS[kind] * Math.pow(2.1, tier - 1))
}

/** Sell-back price (90% of purchase cost) */
export function getSellPrice(kind: ItemKind, tier: number): number {
  return Math.floor(getItemCost(kind, tier) * 0.9)
}

// ── Tier availability ──────────────────────────────────────────────────────
// Tier 2: wave 6 · Tier 3: wave 9 · Tier 4: wave 12 · Tier 5: wave 15
// Tier 6: wave 18 · Tier 7: wave 21   (new tier every 3 waves)
function maxTierForWave(wave: number): number {
  if (wave >= 21) return 7
  if (wave >= 18) return 6
  if (wave >= 15) return 5
  if (wave >= 12) return 4
  if (wave >= 9)  return 3
  if (wave >= 6)  return 2
  return 1
}

// ── Tier probability weights ───────────────────────────────────────────────
// Index 0 = tier 1, index N-1 = highest available tier.
//
// max 1  →  T1:100%
// max 2  →  T1:70%  T2:30%
// max 3  →  each 33.3%
// max 4  →  T1:30%  T2–T4 share 70% equally
// max 5  →  T1:15%  T2–T5 share 85% equally
// max 6  →  T1:1%   T2–T6 share 99% equally
// max 7  →  T1:0%   T2:5%  T3:5%  T4–T7 share 90% equally
function tierWeights(max: number): number[] {
  switch (max) {
    case 1: return [100]
    case 2: return [70, 30]
    case 3: return [100/3, 100/3, 100/3]
    case 4: return [30, 70/3, 70/3, 70/3]
    case 5: return [15, 85/4, 85/4, 85/4, 85/4]
    case 6: return [1,  99/5, 99/5, 99/5, 99/5, 99/5]
    default: return [0, 5, 5, 90/4, 90/4, 90/4, 90/4]  // max 7
  }
}

function pickTier(wave: number): number {
  const max = maxTierForWave(wave)
  const w   = tierWeights(max)
  let rand  = Math.random() * w.reduce((s, v) => s + v, 0)
  for (let i = 0; i < w.length; i++) {
    rand -= w[i]
    if (rand <= 0) return i + 1
  }
  return max
}

export function generateShop(count = 4, wave = 1, tutorialForceItems?: string[]): ShopSlot[] {
  function makeSlot(kind: ItemKind, tier = 1): ShopSlot {
    return { id: `shop_${_shopId++}`, item: createItem(kind, tier), cost: getItemCost(kind, tier), sold: false }
  }

  // Tutorial mode: force specific items at tier 1
  if (tutorialForceItems && tutorialForceItems.length > 0) {
    return tutorialForceItems.map(kind => makeSlot(kind as ItemKind, 1))
  }

  const slots = Array.from({ length: count }, () => {
    const kind = ALL_KINDS[Math.floor(Math.random() * ALL_KINDS.length)]
    return makeSlot(kind, pickTier(wave))
  })

  // First 5 waves: guarantee at least one military tower (always tier 1)
  if (wave <= 5 && !slots.some(s => (MILITARY_KINDS as string[]).includes(s.item.def.kind))) {
    const replaceIdx   = Math.floor(Math.random() * slots.length)
    const militaryKind = MILITARY_KINDS[Math.floor(Math.random() * MILITARY_KINDS.length)]
    slots[replaceIdx]  = makeSlot(militaryKind, 1)
  }

  // Wave 10+: 35% chance to include an Academy slot (always tier 1, fixed cost)
  if (wave >= 10 && !slots.some(s => s.item.def.kind === 'academy') && Math.random() < 0.35) {
    slots[slots.length - 1] = makeSlot('academy', 1)
  }

  return slots
}
