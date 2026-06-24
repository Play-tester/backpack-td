// ── Hero definitions ──────────────────────────────────────────────────────

export type HeroKind = 'knight' | 'ranger' | 'mage'

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
    name:          'Týr',
    icon:          '⚔️',
    description:   'Melee tank who charges up the path and stuns nearby enemies',
    bio:           'God of single combat and sacrifice. Týr marches straight into the enemy horde, shield raised, buying precious seconds for the towers to fire. He has faced Fenrir itself and did not flinch. His Shield Bash sends attackers sprawling — order imposed on chaos by sheer force of will.',
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
    name:          'Ullr',
    icon:          '🏹',
    description:   'Ranged fighter who shoots enemies along the path',
    bio:           'God of the hunt and the bow. Ullr learned to track before he could speak and has never missed a mark. Her arrows find gaps in armour that no tower projectile can reach. When outnumbered she looses a Volley that blankets the whole lane — a brief storm of fletched shafts that leaves the path clear.',
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
    name:          'Skaði',
    icon:          '🧙',
    description:   'AoE spellcaster who freezes all enemies on screen',
    bio:           'Goddess of winter and the mountain cold. Skaði negotiated her own terms with the gods and answers to no one. Frail in appearance, devastating in effect — a single Frost Nova from her staff locks every enemy on the field in ice simultaneously, turning a losing battle into a killing ground.',
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
  const def = HERO_DEFS[kind]
  const unlocked = prev.unlocked || newShards >= def.shardsToUnlock
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
