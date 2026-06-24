export type SpellKind = 'fireball' | 'freeze'

export interface SpellDef {
  kind: SpellKind
  name: string
  description: string
  icon: string
  cooldown: number     // seconds between casts
  unlockCost: number   // gold cost to unlock in Academy (level 1)
}

export const SPELL_DEFS: Record<SpellKind, SpellDef> = {
  fireball: {
    kind: 'fireball',
    name: 'Fire Ball',
    description: 'Launches a fireball that deals 80 damage to all enemies in a splash radius.',
    icon: '🔥',
    cooldown: 10,
    unlockCost: 50,
  },
  freeze: {
    kind: 'freeze',
    name: 'Freeze',
    description: 'Freezes all enemies on screen for 4 seconds.',
    icon: '❄️',
    cooldown: 18,
    unlockCost: 60,
  },
}

export const ALL_SPELLS: SpellDef[] = Object.values(SPELL_DEFS)
