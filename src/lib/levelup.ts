// ── Shared XP curve (used for both Mana and XP — same thresholds) ─────────
export function manaForNextLevel(level: number): number {
  return Math.floor(60 * Math.pow(1.55, level - 1))
}
export const xpForNextBaseLevel = manaForNextLevel
// level 1→2: 60
// level 2→3: 93
// level 3→4: 144
// level 4→5: 223 …

// ── Global buffs ───────────────────────────────────────────────────────────
// Stored in App, passed to battle engine + economy calculations
export interface Buffs {
  damageBonus:      number   // multiplier (1.0 = none)
  speedBonus:       number
  rangeBonus:       number
  extraBaseIncome:  number   // flat gold added to BASE_INCOME each round
  ecoBonus:         number   // multiplier on economic item gold
  killGoldBonus:    number   // multiplier on gold earned from kills
}

export const DEFAULT_BUFFS: Buffs = {
  damageBonus:     1.0,
  speedBonus:      1.0,
  rangeBonus:      1.0,
  extraBaseIncome: 0,
  ecoBonus:        1.0,
  killGoldBonus:   1.0,
}

// ── Upgrade pool ──────────────────────────────────────────────────────────
export type UpgradeKind =
  | 'damage_up'
  | 'speed_up'
  | 'range_up'
  | 'tax_collector'
  | 'market_boom'
  | 'looting_frenzy'
  | 'overclock'
  | 'sniper_mode'
  | 'gold_now'

// Whether the upgrade is a temporary buff (tracked per grant) or instant
export const INSTANT_UPGRADES: Set<UpgradeKind> = new Set(['gold_now'])

export interface Upgrade {
  kind:        UpgradeKind
  title:       string
  description: string
  icon:        string
}

export const ALL_UPGRADES: Upgrade[] = [
  {
    kind: 'damage_up',
    title: 'Sharpen Blades',
    description: 'All towers deal +12.5% damage · lasts 3 waves',
    icon: '⚔',
  },
  {
    kind: 'speed_up',
    title: 'Rapid Fire',
    description: 'All towers attack 10% faster · lasts 3 waves',
    icon: '⚡',
  },
  {
    kind: 'range_up',
    title: 'Eagle Eye',
    description: 'All towers have +12.5% range · lasts 3 waves',
    icon: '◎',
  },
  {
    kind: 'tax_collector',
    title: 'Tax Collector',
    description: 'Base income +2g per battle · lasts 3 waves',
    icon: '🏛',
  },
  {
    kind: 'market_boom',
    title: 'Trade Boom',
    description: 'Economic items produce 20% more gold · lasts 3 waves',
    icon: '📈',
  },
  {
    kind: 'looting_frenzy',
    title: 'Looting Frenzy',
    description: 'Enemies drop +50% gold · lasts 3 waves',
    icon: '💸',
  },
  {
    kind: 'overclock',
    title: 'Overclock',
    description: 'Towers attack 25% faster but deal 25% less damage · lasts 3 waves',
    icon: '⏩',
  },
  {
    kind: 'sniper_mode',
    title: 'Sniper Mode',
    description: 'Towers gain +50% range but attack 15% slower · lasts 3 waves',
    icon: '🎯',
  },
  {
    kind: 'gold_now',
    title: 'Quick Profit',
    description: 'Gain 15 gold immediately',
    icon: '💰',
  },
]

export function pickThreeUpgrades(): [Upgrade, Upgrade, Upgrade] {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5)
  return [shuffled[0], shuffled[1], shuffled[2]]
}

// ── Temporary buff grants ─────────────────────────────────────────────────
export interface BuffGrant {
  upgrade:   Upgrade
  wavesLeft: number
}

export function computeBuffs(grants: BuffGrant[]): Buffs {
  const b = { ...DEFAULT_BUFFS }
  for (const { upgrade } of grants) {
    switch (upgrade.kind) {
      case 'damage_up':      b.damageBonus     *= 1.125; break
      case 'speed_up':       b.speedBonus      *= 1.10;  break
      case 'range_up':       b.rangeBonus      *= 1.125; break
      case 'tax_collector':  b.extraBaseIncome += 2;     break
      case 'market_boom':    b.ecoBonus        *= 1.20;  break
      case 'looting_frenzy': b.killGoldBonus   *= 1.50;  break
      case 'overclock':      b.speedBonus      *= 1.25;  b.damageBonus *= 0.75; break
      case 'sniper_mode':    b.rangeBonus      *= 1.50;  b.speedBonus  *= 0.85; break
    }
  }
  return b
}

// ── Base perks (permanent, from XP level-ups) ─────────────────────────────
export type BasePerkKind =
  | 'perm_damage'
  | 'perm_speed'
  | 'perm_range'
  | 'perm_income'
  | 'perm_eco'
  | 'unlock_cell'
  | 'expand_shop'

export interface BasePerk {
  kind:        BasePerkKind
  title:       string
  description: string
  icon:        string
}

export const ALL_BASE_PERKS: BasePerk[] = [
  {
    kind: 'perm_damage',
    title: 'Veteran Soldiers',
    description: '+5% tower damage (permanent)',
    icon: '🗡',
  },
  {
    kind: 'perm_speed',
    title: 'War Drums',
    description: '+5% attack speed (permanent)',
    icon: '🥁',
  },
  {
    kind: 'perm_range',
    title: 'Watchtower',
    description: '+5% tower range (permanent)',
    icon: '🗼',
  },
  {
    kind: 'perm_income',
    title: 'Treasury',
    description: '+5g base income per battle (permanent)',
    icon: '💎',
  },
  {
    kind: 'perm_eco',
    title: 'Trade Routes',
    description: '+10% economic gold (permanent)',
    icon: '🛒',
  },
  {
    kind: 'unlock_cell',
    title: 'Expand Storage',
    description: 'Unlock 1 new cell in backpack (permanent)',
    icon: '📦',
  },
  {
    kind: 'expand_shop',
    title: 'Market Stall',
    description: 'Add 1 extra item to the Shop each reroll, up to 6 (permanent)',
    icon: '🏪',
  },
]

export function pickThreeBasePerks(toLevel: number, isGridMaxed: boolean = false, isShopMaxed: boolean = false): [BasePerk, BasePerk, BasePerk] {
  // Filter out perks that are no longer available
  const availablePerks = ALL_BASE_PERKS.filter(p => {
    if (p.kind === 'unlock_cell' && isGridMaxed) return false
    if (p.kind === 'expand_shop' && isShopMaxed) return false
    return true
  })

  // First 3 base level-ups (toLevel 2, 3, 4): always include "Expand Backpack" (unlock_cell)
  // so the player always has the option to grow their grid early on.
  if (toLevel <= 4 && !isGridMaxed) {
    const unlockPerk = ALL_BASE_PERKS.find(p => p.kind === 'unlock_cell')!
    const others = availablePerks.filter(p => p.kind !== 'unlock_cell')
      .sort(() => Math.random() - 0.5)
    return [unlockPerk, others[0], others[1]]
  }

  // Later levels: random perks from available pool
  const shuffled = [...availablePerks].sort(() => Math.random() - 0.5)
  return [shuffled[0], shuffled[1], shuffled[2]]
}

export function applyBasePerk(perks: Buffs, kind: BasePerkKind): Buffs {
  switch (kind) {
    case 'perm_damage': return { ...perks, damageBonus:     perks.damageBonus     * 1.05 }
    case 'perm_speed':  return { ...perks, speedBonus:      perks.speedBonus      * 1.05 }
    case 'perm_range':  return { ...perks, rangeBonus:      perks.rangeBonus      * 1.05 }
    case 'perm_income': return { ...perks, extraBaseIncome: perks.extraBaseIncome + 5    }
    case 'perm_eco':    return { ...perks, ecoBonus:        perks.ecoBonus        * 1.10 }
    default:            return perks
  }
}

// Combine permanent base perks with temporary castle-support buffs
export function mergeBuffs(perm: Buffs, temp: Buffs): Buffs {
  return {
    damageBonus:     perm.damageBonus     * temp.damageBonus,
    speedBonus:      perm.speedBonus      * temp.speedBonus,
    rangeBonus:      perm.rangeBonus      * temp.rangeBonus,
    extraBaseIncome: perm.extraBaseIncome + temp.extraBaseIncome,
    ecoBonus:        perm.ecoBonus        * temp.ecoBonus,
    killGoldBonus:   perm.killGoldBonus   * temp.killGoldBonus,
  }
}
