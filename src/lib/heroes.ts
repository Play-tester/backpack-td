// ── Hero definitions ──────────────────────────────────────────────────────

export type HeroKind = 'knight' | 'ranger' | 'mage'

export interface HeroDef {
  kind:          HeroKind
  name:          string
  icon:          string
  description:   string
  hp:            number    // base HP
  damage:        number    // base damage per attack
  attackSpeed:   number    // attacks/s
  attackRange:   number    // px radius
  speed:         number    // px/s — matches tank enemy (50px/s)
  shardsToUnlock: number   // shards needed to unlock
  ability: {
    name:        string
    description: string
    cooldown:    number    // seconds between auto-triggers
  }
}

export const HERO_DEFS: Record<HeroKind, HeroDef> = {
  knight: {
    kind:          'knight',
    name:          'Knight',
    icon:          '⚔️',
    description:   'Melee tank who charges up the path and stuns nearby enemies',
    hp:            300,
    damage:        40,
    attackSpeed:   1.0,
    attackRange:   40,    // melee
    speed:         50,    // same as tank enemy
    shardsToUnlock: 10,
    ability: {
      name:        'Shield Bash',
      description: 'Stuns all enemies within 60px for 1.5s',
      cooldown:    5,
    },
  },
  ranger: {
    kind:          'ranger',
    name:          'Ranger',
    icon:          '🏹',
    description:   'Ranged fighter who shoots enemies along the path',
    hp:            180,
    damage:        25,
    attackSpeed:   1.5,
    attackRange:   130,   // ranged
    speed:         50,
    shardsToUnlock: 10,
    ability: {
      name:        'Volley',
      description: 'Fires 5 arrows hitting all enemies within 130px',
      cooldown:    5,
    },
  },
  mage: {
    kind:          'mage',
    name:          'Mage',
    icon:          '🧙',
    description:   'AoE spellcaster who freezes all enemies on screen',
    hp:            140,
    damage:        20,
    attackSpeed:   0.8,
    attackRange:   160,   // long range
    speed:         50,
    shardsToUnlock: 10,
    ability: {
      name:        'Frost Nova',
      description: 'Freezes all enemies on screen for 2s',
      cooldown:    5,
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
    knight: { shards: 10, unlocked: true },   // TODO: lock behind shard system
    ranger: { shards: 10, unlocked: true },
    mage:   { shards: 10, unlocked: true },
  }
}
