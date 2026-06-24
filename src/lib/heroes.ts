// ── Hero definitions ──────────────────────────────────────────────────────

export type HeroKind = 'knight' | 'ranger' | 'mage'

export interface HeroAbility {
  name:        string
  description: string
  cooldown:    number   // seconds between auto-triggers
}

export interface HeroDef {
  kind:          HeroKind
  name:          string
  icon:          string
  description:   string
  bio:           string    // lore paragraph shown in hero info popup
  hp:            number    // base HP
  damage:        number    // base damage per attack
  attackSpeed:   number    // attacks/s
  attackRange:   number    // px radius
  speed:         number    // px/s — matches tank enemy (50px/s)
  shardsToUnlock: number   // shards needed to unlock (tier 1)
  ability:       HeroAbility   // tier 1 ability (always active once unlocked)
  ability2?:     HeroAbility   // tier 3 unlock
  ability3?:     HeroAbility   // tier 6 unlock
}

// ── Shard tier thresholds ─────────────────────────────────────────────────
// Cumulative shard totals at which each tier is reached
export interface ShardTier {
  tier:        number
  shardsTotal: number   // cumulative shards required
  label:       string   // short description shown in UI
  hpMult:      number   // HP multiplier (1.0 = no change)
  dmgMult:     number   // damage multiplier
  newAbility:  2 | 3 | null   // which ability slot unlocks at this tier
  newSkin:     boolean  // true if this tier unlocks alternate skin
}

export const SHARD_TIERS: ShardTier[] = [
  { tier: 1, shardsTotal: 10,  label: 'Unlock',          hpMult: 1.0, dmgMult: 1.0, newAbility: null, newSkin: false },
  { tier: 2, shardsTotal: 25,  label: '+20% HP & DMG',   hpMult: 1.2, dmgMult: 1.2, newAbility: null, newSkin: false },
  { tier: 3, shardsTotal: 50,  label: '2nd Ability',     hpMult: 1.2, dmgMult: 1.2, newAbility: 2,    newSkin: false },
  { tier: 4, shardsTotal: 70,  label: 'New Skin',        hpMult: 1.2, dmgMult: 1.2, newAbility: null, newSkin: true  },
  { tier: 5, shardsTotal: 95,  label: '+20% HP & DMG',   hpMult: 1.44,dmgMult: 1.44,newAbility: null, newSkin: true  },
  { tier: 6, shardsTotal: 125, label: '3rd Ability',     hpMult: 1.44,dmgMult: 1.44,newAbility: 3,    newSkin: true  },
]

/** Current tier (1-6) based on total shards. 0 = not yet unlocked. */
export function getHeroTier(shards: number): number {
  if (shards < SHARD_TIERS[0].shardsTotal) return 0
  let tier = 1
  for (const t of SHARD_TIERS) {
    if (shards >= t.shardsTotal) tier = t.tier
  }
  return tier
}

/** Effective HP and damage after applying tier multipliers */
export function getEffectiveStats(def: HeroDef, shards: number): { hp: number; damage: number } {
  const tier = getHeroTier(shards)
  if (tier === 0) return { hp: def.hp, damage: def.damage }
  const t = SHARD_TIERS[tier - 1]
  return {
    hp:     Math.round(def.hp     * t.hpMult),
    damage: Math.round(def.damage * t.dmgMult),
  }
}

/** Which abilities are active for a hero at their current shard count */
export function getActiveAbilities(def: HeroDef, shards: number): HeroAbility[] {
  const tier = getHeroTier(shards)
  const abilities: HeroAbility[] = []
  if (tier >= 1) abilities.push(def.ability)
  if (tier >= 3 && def.ability2) abilities.push(def.ability2)
  if (tier >= 6 && def.ability3) abilities.push(def.ability3)
  return abilities
}

export const HERO_DEFS: Record<HeroKind, HeroDef> = {
  knight: {
    kind:          'knight',
    name:          'Týr',
    icon:          '⚔️',
    description:   'Melee tank who charges up the path and stuns nearby enemies',
    bio:           'God of single combat and sacrifice. Týr marches straight into the enemy horde, shield raised, buying precious seconds for the towers to fire. He has faced Fenrir itself and did not flinch. His Shield Bash sends attackers sprawling — order imposed on chaos by sheer force of will.',
    hp:            300,
    damage:        40,
    attackSpeed:   1.0,
    attackRange:   40,
    speed:         50,
    shardsToUnlock: 10,
    ability: {
      name:        'Shield Bash',
      description: 'Stuns all enemies within 60px for 4s',
      cooldown:    5,
    },
    ability2: {
      name:        'War Cry',
      description: 'Boosts all tower attack speed by 30% for 4s',
      cooldown:    12,
    },
    ability3: {
      name:        'Berserker',
      description: 'Týr deals triple damage and takes no damage for 6s',
      cooldown:    20,
    },
  },
  ranger: {
    kind:          'ranger',
    name:          'Ullr',
    icon:          '🏹',
    description:   'Ranged fighter who shoots enemies along the path',
    bio:           'God of the hunt and the bow. Ullr learned to track before he could speak and has never missed a mark. Her arrows find gaps in armour that no tower projectile can reach. When outnumbered she looses a Volley that blankets the whole lane — a brief storm of fletched shafts that leaves the path clear.',
    hp:            180,
    damage:        25,
    attackSpeed:   1.5,
    attackRange:   130,
    speed:         50,
    shardsToUnlock: 10,
    ability: {
      name:        'Volley',
      description: 'Fires arrows hitting all enemies within 130px',
      cooldown:    5,
    },
    ability2: {
      name:        'Marked Shot',
      description: 'Marks the strongest enemy — towers deal double damage to it for 5s',
      cooldown:    14,
    },
    ability3: {
      name:        'Tempest Arrow',
      description: 'Fires a piercing arrow through the full path, hitting every enemy for 3× damage',
      cooldown:    18,
    },
  },
  mage: {
    kind:          'mage',
    name:          'Skaði',
    icon:          '🧙',
    description:   'AoE spellcaster who freezes all enemies on screen',
    bio:           'Goddess of winter and the mountain cold. Skaði negotiated her own terms with the gods and answers to no one. Frail in appearance, devastating in effect — a single Frost Nova from her staff locks every enemy on the field in ice simultaneously, turning a losing battle into a killing ground.',
    hp:            140,
    damage:        20,
    attackSpeed:   0.8,
    attackRange:   160,
    speed:         50,
    shardsToUnlock: 10,
    ability: {
      name:        'Frost Nova',
      description: 'Freezes all enemies on screen for 2s',
      cooldown:    5,
    },
    ability2: {
      name:        'Blizzard',
      description: 'Summons a blizzard that deals damage and slows all enemies for 6s',
      cooldown:    16,
    },
    ability3: {
      name:        'Glacial Tomb',
      description: 'Encases the 3 strongest enemies in ice, removing them from the field for 5s',
      cooldown:    22,
    },
  },
}

export const ALL_HEROES: HeroDef[] = Object.values(HERO_DEFS)

// ── Hero instance (runtime state) ─────────────────────────────────────────

export interface HeroState {
  kind:          HeroKind
  x:             number
  y:             number
  hp:            number
  maxHp:         number
  abilityCooldown: number   // seconds until next auto-ability
  attackCooldown:  number   // seconds until next attack
  stunTimer:     number     // seconds remaining stunned
  dead:          boolean
}

export function createHeroState(kind: HeroKind, battleH: number): HeroState {
  const def = HERO_DEFS[kind]
  return {
    kind,
    x:               195,          // centre of battle canvas
    y:               battleH - 40, // start at bottom (castle)
    hp:              def.hp,
    maxHp:           def.hp,
    abilityCooldown: 0,
    attackCooldown:  0,
    stunTimer:       0,
    dead:            false,
  }
}

// ── Shard progress ────────────────────────────────────────────────────────

export interface HeroProgress {
  shards:   number
  unlocked: boolean
}

export type HeroProgressMap = Record<HeroKind, HeroProgress>

export function getInitialHeroProgress(): HeroProgressMap {
  return {
    knight: { shards: 0, unlocked: false },
    ranger: { shards: 0, unlocked: false },
    mage:   { shards: 0, unlocked: false },
  }
}

/** Award shards and auto-unlock when threshold reached */
export function awardShards(
  progress: HeroProgressMap,
  kind: HeroKind,
  count: number,
): HeroProgressMap {
  const prev = progress[kind]
  const newShards = prev.shards + count
  const unlocked = prev.unlocked || newShards >= SHARD_TIERS[0].shardsTotal
  return { ...progress, [kind]: { shards: newShards, unlocked } }
}

/** Returns true if any hero has at least 1 shard */
export function hasAnyShards(progress: HeroProgressMap): boolean {
  return Object.values(progress).some(p => p.shards > 0)
}

// Unlock order — Knight first, then Ranger, then Mage
const HERO_UNLOCK_ORDER: HeroKind[] = ['knight', 'ranger', 'mage']

/**
 * Pick which hero receives a shard drop.
 * The earliest locked hero gets 70% of the weight; the others share the rest.
 * Once all heroes are unlocked every hero gets equal weight (overflow shards).
 */
export function pickShardDrop(progress: HeroProgressMap): HeroKind {
  // Find the first hero in unlock order that isn't unlocked yet
  const priorityHero = HERO_UNLOCK_ORDER.find(k => !progress[k].unlocked)

  if (!priorityHero) {
    // All unlocked — equal chance (overflow shards, future use)
    return HERO_UNLOCK_ORDER[Math.floor(Math.random() * HERO_UNLOCK_ORDER.length)]
  }

  // 70% chance for priority hero, 30% split among the rest
  const others = HERO_UNLOCK_ORDER.filter(k => k !== priorityHero)
  const roll = Math.random()
  if (roll < 0.70) return priorityHero
  // pick randomly from the other two
  return others[Math.floor(Math.random() * others.length)]
}
