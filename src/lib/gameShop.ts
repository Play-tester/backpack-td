// ── In-game Shop ──────────────────────────────────────────────────────────
// Rewarded-ad limits are tracked in localStorage so they survive refreshes.
// Hard-currency purchases use the in-memory runes balance (no real IAP yet).

export type ShopItemId =
  | 'gold_small' | 'gold_medium' | 'gold_large'
  | 'wood_small' | 'wood_medium' | 'wood_large'
  | 'runes_small'
  | 'chest_small' | 'chest_medium' | 'chest_large'

export interface ShopItem {
  id:          ShopItemId
  label:       string
  description: string
  emoji:       string
  reward:      { gold?: number; wood?: number; runes?: number; chestTier?: 1 | 2 | 3 }
  // Rewarded-ad config
  adKey?:      string   // localStorage key for tracking
  adLimit?:    number   // max uses per window
  adWindowMs?: number   // window duration in ms
  // Hard-currency purchase
  runesCost?:  number
}

// ── Ad-limit helpers ───────────────────────────────────────────────────────
interface AdRecord { timestamps: number[] }

function getRecord(key: string): AdRecord {
  try {
    const raw = localStorage.getItem(`shop_ad_${key}`)
    if (raw) return JSON.parse(raw) as AdRecord
  } catch { /* ignore */ }
  return { timestamps: [] }
}

function saveRecord(key: string, record: AdRecord) {
  try { localStorage.setItem(`shop_ad_${key}`, JSON.stringify(record)) } catch { /* ignore */ }
}

/** How many ad views remain in the current window for this key. */
export function adUsesRemaining(item: ShopItem): number {
  if (!item.adKey || !item.adLimit || !item.adWindowMs) return 0
  const now = Date.now()
  const record = getRecord(item.adKey)
  const recent = record.timestamps.filter(t => now - t < item.adWindowMs!)
  return Math.max(0, item.adLimit - recent.length)
}

/** ms until the oldest ad expires and frees a slot. 0 if slots available. */
export function adCooldownMs(item: ShopItem): number {
  if (!item.adKey || !item.adLimit || !item.adWindowMs) return 0
  if (adUsesRemaining(item) > 0) return 0
  const now = Date.now()
  const record = getRecord(item.adKey)
  const recent = record.timestamps.filter(t => now - t < item.adWindowMs!).sort((a, b) => a - b)
  if (recent.length === 0) return 0
  return (recent[0] + item.adWindowMs!) - now
}

/** Record an ad view for this item. Returns false if limit already hit. */
export function recordAdView(item: ShopItem): boolean {
  if (!item.adKey || !item.adLimit || !item.adWindowMs) return false
  if (adUsesRemaining(item) <= 0) return false
  const now = Date.now()
  const record = getRecord(item.adKey)
  record.timestamps = [...record.timestamps.filter(t => now - t < item.adWindowMs!), now]
  saveRecord(item.adKey, record)
  return true
}

// ── Item catalogue ─────────────────────────────────────────────────────────
const ONE_HOUR = 60 * 60 * 1000
const THREE_HOURS = 3 * ONE_HOUR

export const SHOP_SECTIONS: { label: string; items: ShopItem[] }[] = [
  {
    label: '⚔ Gold',
    items: [
      {
        id: 'gold_small', label: 'Handful of Gold', description: '+30 gold',
        emoji: '🪙', reward: { gold: 30 },
        adKey: 'gold', adLimit: 3, adWindowMs: ONE_HOUR,
      },
      {
        id: 'gold_medium', label: 'Pouch of Gold', description: '+80 gold',
        emoji: '💰', reward: { gold: 80 },
        adKey: 'gold', adLimit: 3, adWindowMs: ONE_HOUR,
      },
      {
        id: 'gold_large', label: 'Chest of Gold', description: '+200 gold',
        emoji: '🏆', reward: { gold: 200 },
        runesCost: 50,
      },
    ],
  },
  {
    label: '🪵 Crafting Resources',
    items: [
      {
        id: 'wood_small', label: 'Bundle of Wood', description: '+10 wood',
        emoji: '🪵', reward: { wood: 10 },
        adKey: 'wood', adLimit: 3, adWindowMs: ONE_HOUR,
      },
      {
        id: 'wood_medium', label: 'Cartload of Wood', description: '+25 wood',
        emoji: '🌲', reward: { wood: 25 },
        adKey: 'wood', adLimit: 3, adWindowMs: ONE_HOUR,
      },
      {
        id: 'wood_large', label: 'Forest Haul', description: '+60 wood',
        emoji: '🌳', reward: { wood: 60 },
        runesCost: 60,
      },
    ],
  },
  {
    label: '💎 Runes',
    items: [
      {
        id: 'runes_small', label: 'Handful of Runes', description: '+10 runes',
        emoji: '💎', reward: { runes: 10 },
        adKey: 'runes', adLimit: 1, adWindowMs: ONE_HOUR,
      },
    ],
  },
  {
    label: '📦 Chests',
    items: [
      {
        id: 'chest_small', label: 'Small Chest', description: 'Gold + Wood surprise',
        emoji: '📦', reward: { chestTier: 1 },
        adKey: 'chest_small', adLimit: 1, adWindowMs: THREE_HOURS,
      },
      {
        id: 'chest_medium', label: 'Medium Chest', description: 'More gold, more wood, hero shard chance',
        emoji: '🎁', reward: { chestTier: 2 },
        runesCost: 80,
      },
      {
        id: 'chest_large', label: 'Large Chest', description: 'Big haul — guaranteed hero shard',
        emoji: '👑', reward: { chestTier: 3 },
        runesCost: 200,
      },
    ],
  },
]

// ── Chest reward tables ────────────────────────────────────────────────────
export interface ChestReward { gold: number; wood: number; runes: number }

export function openChest(tier: 1 | 2 | 3): ChestReward {
  switch (tier) {
    case 1: return {
      gold:  20 + Math.floor(Math.random() * 30),   // 20–50
      wood:  3  + Math.floor(Math.random() * 8),    // 3–10
      runes: 0,
    }
    case 2: return {
      gold:  60 + Math.floor(Math.random() * 60),   // 60–120
      wood:  10 + Math.floor(Math.random() * 15),   // 10–25
      runes: Math.random() < 0.3 ? 5 : 0,           // 30% chance
    }
    case 3: return {
      gold:  150 + Math.floor(Math.random() * 100), // 150–250
      wood:  25  + Math.floor(Math.random() * 25),  // 25–50
      runes: 10  + Math.floor(Math.random() * 10),  // 10–20
    }
  }
}
