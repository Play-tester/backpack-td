import type { Item } from '../types'

export const BATTLE_W = 390
export const BATTLE_H = 500
export const LANE_CX  = 195   // lane centre x
export const LANE_W   = 52

// ── Zig-zag path (waves 5–9) ────────────────────────────────────────────────
export const ZIGZAG_LEFT_X  = 155
export const ZIGZAG_RIGHT_X = 225
export const ZIGZAG_TURN1_Y = 165
export const ZIGZAG_TURN2_Y = 335
export const ZIGZAG_ENTRY_Y = -34
export const ZIGZAG_EXIT_Y  = 534   // BATTLE_H + 34

export const ZIGZAG_WAYPOINTS: [number, number][] = [
  [ZIGZAG_RIGHT_X, ZIGZAG_ENTRY_Y],
  [ZIGZAG_RIGHT_X, ZIGZAG_TURN1_Y],
  [ZIGZAG_LEFT_X,  ZIGZAG_TURN1_Y],
  [ZIGZAG_LEFT_X,  ZIGZAG_TURN2_Y],
  [ZIGZAG_RIGHT_X, ZIGZAG_TURN2_Y],
  [ZIGZAG_RIGHT_X, ZIGZAG_EXIT_Y],
]

export function isZigzagWave(wave: number): boolean {
  return wave >= 5 && wave <= 9
}

// ── Triple-lane layout (waves 10–11) ────────────────────────────────────────
export const TRIPLE_LANE_XS = [80, 195, 310] as const

export function isTripleLaneWave(wave: number): boolean {
  return wave >= 10 && wave <= 11
}

// ── Diamond split-merge path (waves 12–13) ──────────────────────────────────
export const DIAMOND_PATH_A: [number, number][] = [  // left fork
  [195, -34],
  [90,  120],
  [90,  380],
  [195, 534],
]
export const DIAMOND_PATH_B: [number, number][] = [  // right fork
  [195, -34],
  [300, 120],
  [300, 380],
  [195, 534],
]

export function isDiamondWave(wave: number): boolean {
  return wave >= 12 && wave <= 13
}

// ── Funnel converging path (waves 14–15) ────────────────────────────────────
export const FUNNEL_PATH_A: [number, number][] = [  // left lane
  [110, -34],
  [110, 300],
  [195, 534],
]
export const FUNNEL_PATH_B: [number, number][] = [  // right lane
  [280, -34],
  [280, 300],
  [195, 534],
]

export function isFunnelWave(wave: number): boolean {
  return wave >= 14 && wave <= 15
}

// ── Long-map base flag (waves 16+) ───────────────────────────────────────────
export const LONG_BATTLE_H = 750   // 50% taller than BATTLE_H

export function isLongWave(wave: number): boolean {
  return wave >= 16
}

// ── Extended zigzag (waves 16+): same S-curve as battle_2.png, scaled to 750px ───
export const EXT_ZZ_LEFT_X  = 155
export const EXT_ZZ_RIGHT_X = 225
export const EXT_ZZ_TURN1_Y = 248   // 165 * 1.5
export const EXT_ZZ_TURN2_Y = 503   // 335 * 1.5
export const EXT_ZZ_ENTRY_Y = -34
export const EXT_ZZ_EXIT_Y  = 784   // LONG_BATTLE_H + 34

export const EXT_ZIGZAG_WAYPOINTS: [number, number][] = [
  [EXT_ZZ_RIGHT_X, EXT_ZZ_ENTRY_Y],
  [EXT_ZZ_RIGHT_X, EXT_ZZ_TURN1_Y],
  [EXT_ZZ_LEFT_X,  EXT_ZZ_TURN1_Y],
  [EXT_ZZ_LEFT_X,  EXT_ZZ_TURN2_Y],
  [EXT_ZZ_RIGHT_X, EXT_ZZ_TURN2_Y],
  [EXT_ZZ_RIGHT_X, EXT_ZZ_EXIT_Y ],
]

export function isExtZigzagWave(wave: number): boolean {
  return wave >= 16 && wave <= 20
}

export type BattlePhase = 'fighting' | 'won' | 'lost'

export type EnemyKind = 'grunt' | 'runner' | 'tank' | 'swarm'

/** A tower the player has manually placed onto the battle arena */
export interface DeployedTower {
  item: Item
  x: number   // centre-x in battle canvas px
  y: number   // centre-y in battle canvas px
}

export interface Enemy {
  id: string
  kind: EnemyKind
  x: number
  y: number
  hp: number
  maxHp: number
  baseSpeed: number   // px/s
  slowTimer: number   // seconds of slow remaining
  pathDist: number    // distance traveled along path (0 = entry point; negative = off-screen)
  pathId:   number    // which path the enemy follows (0 = default/left, 1 = right diamond fork)
}

export interface BattleTower {
  id: string
  kind: string
  x: number
  y: number
  damage: number
  attackSpeed: number  // attacks/s
  rangePx: number
  cooldown: number     // s until next attack
  color: string
  image?: string
  tier: number
  shapeCols: number    // bounding-box columns (for display size)
  shapeRows: number    // bounding-box rows    (for display size)
  splashRadius: number // 0 = no splash
  slowDuration: number // 0 = no slow
  flashTimer: number   // brief highlight when firing
}

export interface Projectile {
  id:          string
  x:           number   // current position
  y:           number
  tx:          number   // target position (fixed at fire time)
  ty:          number
  color:       string
  kind:        string   // tower kind, for visual style
  speed:       number   // px/s
  targetId:    string   // enemy to damage on arrival
  damage:      number
  splashRadius: number  // 0 = no splash
}

export interface BattleResult {
  kills: number
  escaped: number
  goldEarned: number
  manaEarned: number
  xpEarned: number     // = floor(manaEarned / 3)
}

export interface BattleState {
  wave: number
  towers: BattleTower[]
  enemies: Enemy[]
  projectiles: Projectile[]
  spawnQueue: EnemyKind[]  // pre-built sequence; shift one per spawn
  nextSpawnAt: number      // elapsed time when next enemy appears
  elapsed: number
  phase: BattlePhase
  result: BattleResult
  nextLane:     number   // cycles through lanes for triple-lane waves
  nextForkPath: number   // alternates 0/1 for any two-fork layout (diamond, funnel…)
}
