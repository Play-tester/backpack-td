import { getItemImage, getMilitaryDamageMultiplier, getMilitaryRangeMultiplier } from '../lib/items'
import { DEFAULT_BUFFS, type Buffs } from '../lib/levelup'
import { HERO_DEFS, getEffectiveStats, type HeroKind } from '../lib/heroes'
import { getPiercingArrowsResist, type CraftingState } from '../lib/crafting'
import { shapeDims, type ItemSize } from '../types'
import {
  BATTLE_H, LANE_CX, ZIGZAG_WAYPOINTS, isZigzagWave, isLongWave,
  TRIPLE_LANE_XS, isTripleLaneWave,
  DIAMOND_PATH_A, DIAMOND_PATH_B, isDiamondWave,
  FUNNEL_PATH_A, FUNNEL_PATH_B, isFunnelWave,
  EXT_ZIGZAG_WAYPOINTS, isExtZigzagWave,
  type BattleHero, type BattlePhase, type BattleState, type BattleTower, type DeployedTower,
  type Enemy, type EnemyKind, type Projectile,
} from './types'

// ── Crafting state (set per-battle by initBattle) ─────────────────────────
// Module-level so spawnEnemy (called from tickBattle) can read it without threading state.
let _shieldArcherResist = 0.2  // default: 20% damage from archers

// ── Zig-zag path segments ──────────────────────────────────────────────────
interface PSeg { x0: number; y0: number; x1: number; y1: number; len: number }

const ZIGZAG_SEGS: PSeg[] = (() => {
  const segs: PSeg[] = []
  for (let i = 0; i < ZIGZAG_WAYPOINTS.length - 1; i++) {
    const [x0, y0] = ZIGZAG_WAYPOINTS[i]
    const [x1, y1] = ZIGZAG_WAYPOINTS[i + 1]
    segs.push({ x0, y0, x1, y1, len: Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) })
  }
  return segs
})()

const ZIGZAG_TOTAL_LEN = ZIGZAG_SEGS.reduce((s, seg) => s + seg.len, 0)

// ── Diamond path segments ──────────────────────────────────────────────────
function buildSegs(wps: [number, number][]): PSeg[] {
  const segs: PSeg[] = []
  for (let i = 0; i < wps.length - 1; i++) {
    const [x0, y0] = wps[i], [x1, y1] = wps[i + 1]
    segs.push({ x0, y0, x1, y1, len: Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) })
  }
  return segs
}

const DIAMOND_SEGS_A    = buildSegs(DIAMOND_PATH_A)
const DIAMOND_SEGS_B    = buildSegs(DIAMOND_PATH_B)
const DIAMOND_TOTAL_LEN = DIAMOND_SEGS_A.reduce((s, seg) => s + seg.len, 0)

const FUNNEL_SEGS_A    = buildSegs(FUNNEL_PATH_A)
const FUNNEL_SEGS_B    = buildSegs(FUNNEL_PATH_B)
const FUNNEL_TOTAL_LEN = FUNNEL_SEGS_A.reduce((s, seg) => s + seg.len, 0)

// ── Extended zigzag path segments ─────────────────────────────────────────
const EXT_ZIGZAG_SEGS      = buildSegs(EXT_ZIGZAG_WAYPOINTS)
const EXT_ZIGZAG_TOTAL_LEN = EXT_ZIGZAG_SEGS.reduce((s, seg) => s + seg.len, 0)

function posOnExtZigzag(dist: number): [number, number] {
  return posOnSegs(EXT_ZIGZAG_SEGS, dist)
}

function posOnSegs(segs: PSeg[], dist: number): [number, number] {
  if (dist <= 0) {
    const s = segs[0]
    const t = dist / s.len
    return [s.x0 + (s.x1 - s.x0) * t, s.y0 + (s.y1 - s.y0) * t]
  }
  let rem = dist
  for (const seg of segs) {
    if (rem <= seg.len) {
      const t = rem / seg.len
      return [seg.x0 + (seg.x1 - seg.x0) * t, seg.y0 + (seg.y1 - seg.y0) * t]
    }
    rem -= seg.len
  }
  const last = segs[segs.length - 1]
  return [last.x1, last.y1]
}

function posOnDiamondPath(pathId: number, dist: number): [number, number] {
  return posOnSegs(pathId === 0 ? DIAMOND_SEGS_A : DIAMOND_SEGS_B, dist)
}

function posOnFunnelPath(pathId: number, dist: number): [number, number] {
  return posOnSegs(pathId === 0 ? FUNNEL_SEGS_A : FUNNEL_SEGS_B, dist)
}

/** Total path length for each layout — used to start hero at the bottom */
export function getPathTotalLen(wave: number): number {
  if (isExtZigzagWave(wave)) return EXT_ZIGZAG_TOTAL_LEN
  if (isZigzagWave(wave))    return ZIGZAG_TOTAL_LEN
  if (isDiamondWave(wave))   return DIAMOND_TOTAL_LEN
  if (isFunnelWave(wave))    return FUNNEL_TOTAL_LEN
  return BATTLE_H  // straight lane
}

/** Hero x/y position from a pathDist (same coord system as enemies) */
export function heroPos(wave: number, pathDist: number, pathId: number): [number, number] {
  if (isExtZigzagWave(wave)) return posOnExtZigzag(pathDist)
  if (isZigzagWave(wave))    return posOnPath(pathDist)
  if (isDiamondWave(wave))   return posOnDiamondPath(pathId, pathDist)
  if (isFunnelWave(wave))    return posOnFunnelPath(pathId, pathDist)
  // Straight lane — hero walks up the center
  return [LANE_CX, pathDist]
}

/** Compute (x, y) at a given distance along the zig-zag path.
 *  Negative dist extrapolates backwards from the entry segment. */
function posOnPath(dist: number): [number, number] {
  if (dist <= 0) {
    const s = ZIGZAG_SEGS[0]
    const t = dist / s.len   // negative → behind entry
    return [s.x0 + (s.x1 - s.x0) * t, s.y0 + (s.y1 - s.y0) * t]
  }
  let rem = dist
  for (const seg of ZIGZAG_SEGS) {
    if (rem <= seg.len) {
      const t = rem / seg.len
      return [seg.x0 + (seg.x1 - seg.x0) * t, seg.y0 + (seg.y1 - seg.y0) * t]
    }
    rem -= seg.len
  }
  const last = ZIGZAG_SEGS[ZIGZAG_SEGS.length - 1]
  return [last.x1, last.y1]
}

// ── Enemy kind stats ───────────────────────────────────────────────────────
const ENEMY_STATS: Record<EnemyKind, { hp: number; speed: number; gold: number; group?: number }> = {
  grunt:  { hp: 80,  speed: 65,  gold: 1 },  // standard
  runner: { hp: 50,  speed: 115, gold: 1 },  // fast but fragile
  tank:   { hp: 120, speed: 50,  gold: 1 },  // slow, tanky
  swarm:  { hp: 35,  speed: 140, gold: 1, group: 3 },  // tiny, always spawns as a group of 3
  trojan: { hp: 800, speed: 30,  gold: 10 }, // boss — high HP, very slow, releases grunts on death
  shield: { hp: 110, speed: 55,  gold: 2  }, // Celtic shield bearer — absorbs 70% archer damage
}

// Enemies released when the Trojan Horse dies
const TROJAN_RELEASE: EnemyKind[] = ['grunt', 'grunt', 'grunt', 'grunt']

// ── Wave config ────────────────────────────────────────────────────────────
const SPAWN_INTERVAL = 1.4   // seconds between enemies

interface WaveConfig { count: number; kinds: EnemyKind[] }

const WAVE_TABLE: WaveConfig[] = [
  { count: 3, kinds: ['grunt']                          },  // wave 1
  { count: 5, kinds: ['grunt']                          },  // wave 2
  { count: 5, kinds: ['grunt', 'runner']                },  // wave 3
  { count: 7, kinds: ['grunt', 'runner', 'tank']        },  // wave 4 — tank introduced
  { count: 8, kinds: ['grunt', 'runner', 'tank', 'swarm'] },  // wave 5 — swarm introduced
]

function getWaveConfig(wave: number): WaveConfig {
  if (wave === 10) return { count: 1, kinds: ['trojan'] }  // World 1 boss
  if (wave === 20) return { count: 1, kinds: ['trojan'] }  // World 2 boss (placeholder until W2 boss designed)
  if (wave === 30) return { count: 1, kinds: ['trojan'] }  // World 3 boss (placeholder)
  if (wave <= WAVE_TABLE.length) return WAVE_TABLE[wave - 1]
  // waves 6–9: all four base types, +2 per wave
  if (wave <= 10) return { count: 8 + (wave - 5) * 2, kinds: ['grunt', 'runner', 'tank', 'swarm'] }
  // waves 11+: add shield bearer to the mix, +2 per wave
  return { count: 10 + (wave - 11) * 2, kinds: ['grunt', 'runner', 'tank', 'swarm', 'shield'] }
}

/** Build a shuffled spawn sequence with the correct count of each kind */
function buildSpawnQueue(config: WaveConfig): EnemyKind[] {
  const { count, kinds } = config
  const n = kinds.length
  const full = Math.floor(count / n)
  const rem  = count % n

  // Fill with the right amount of each kind (same totals as before)
  const queue: EnemyKind[] = []
  for (let i = 0; i < n; i++) {
    const amount = full + (i < rem ? 1 : 0)
    for (let j = 0; j < amount; j++) queue.push(kinds[i])
  }

  // Fisher-Yates shuffle
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[queue[i], queue[j]] = [queue[j], queue[i]]
  }

  return queue
}

// ── Tower kind stats ───────────────────────────────────────────────────────
export const KIND_RANGE: Record<string, number> = { archer: 80, cannon: 115, frost: 70 }
const KIND_SPLASH: Record<string, number>   = { cannon: 32 }
const KIND_SLOW_DUR: Record<string, number> = { frost: 2.5 }

// ── Projectile speeds (px/s) per tower kind ───────────────────────────────
const PROJ_SPEED: Record<string, number> = {
  archer: 420,
  cannon: 200,
  frost:  320,
}

// ── Factory ────────────────────────────────────────────────────────────────
let _eid = 1
let _pid = 1

/** startDist: distance along path (0 = entry point, negative = off-screen before entry).
 *  laneX:  x position for triple-lane waves.
 *  pathId: 0 = default/left diamond fork, 1 = right diamond fork. */
function spawnEnemy(kind: EnemyKind, wave: number, startDist = 0, laneX?: number, pathId = 0): Enemy {
  const stats = ENEMY_STATS[kind]
  const hp = Math.round(stats.hp * Math.pow(1.02, wave - 1))
  let x: number, y: number
  if (isExtZigzagWave(wave)) {
    ;[x, y] = posOnExtZigzag(startDist)
  } else if (isZigzagWave(wave)) {
    ;[x, y] = posOnPath(startDist)
  } else if (isDiamondWave(wave)) {
    ;[x, y] = posOnDiamondPath(pathId, startDist)
  } else if (isFunnelWave(wave)) {
    ;[x, y] = posOnFunnelPath(pathId, startDist)
  } else {
    x = laneX ?? LANE_CX
    y = -34 + startDist
  }
  const enemy: Enemy = {
    id: `e${_eid++}`,
    kind, x, y, hp, maxHp: hp,
    baseSpeed: stats.speed,
    slowTimer: 0,
    pathDist: startDist,
    pathId,
  }
  if (kind === 'trojan') enemy.spawnsOnDeath = [...TROJAN_RELEASE]
  if (kind === 'shield') enemy.damageResist = { archer: _shieldArcherResist }  // crafting-aware resist
  return enemy
}

export function initBattle(
  deployedTowers: DeployedTower[],
  wave:  number,
  buffs: Buffs = DEFAULT_BUFFS,
  tutorialLimitEnemies?: number,
  heroKind?: HeroKind,
  heroShards?: number,
  craftingState?: CraftingState,
): BattleState {
  // Apply crafting upgrades that affect enemy stats
  _shieldArcherResist = craftingState ? getPiercingArrowsResist(craftingState) : 0.3
  const towers: BattleTower[] = []

  for (const { item, x, y } of deployedTowers) {
    const damageMult = getMilitaryDamageMultiplier(item.tier, item.def.kind)
    const rangeMult  = getMilitaryRangeMultiplier(item.tier)
    const { cols: shapeCols, rows: shapeRows } = shapeDims(item.def.size as ItemSize)
    towers.push({
      id:           item.id,
      kind:         item.def.kind,
      x,
      y,
      damage:       Math.round((item.def.damage ?? 10) * damageMult * buffs.damageBonus),
      attackSpeed:  (item.def.attackSpeed ?? 1) * buffs.speedBonus,
      rangePx:      (KIND_RANGE[item.def.kind] ?? 84) * rangeMult * buffs.rangeBonus,
      cooldown:     0,
      color:        item.def.color,
      image:        getItemImage(item),
      tier:         item.tier,
      shapeCols,
      shapeRows,
      splashRadius: KIND_SPLASH[item.def.kind]   ?? 0,
      slowDuration: KIND_SLOW_DUR[item.def.kind] ?? 0,
      flashTimer:   0,
    })
  }

  let waveConfig = getWaveConfig(wave)
  // Wave 11+: reduce enemy count by 10%
  if (wave >= 11) {
    waveConfig = { ...waveConfig, count: Math.max(1, Math.round(waveConfig.count * 0.9)) }
  }
  // Tutorial: limit enemy count if specified
  if (tutorialLimitEnemies !== undefined) {
    waveConfig = { ...waveConfig, count: Math.min(waveConfig.count, tutorialLimitEnemies) }
  }
  const spawnQueue = buildSpawnQueue(waveConfig)

  // Hero initial state — spawns at bottom of the battlefield (castle bottom)
  let hero: BattleHero | null = null
  if (heroKind) {
    const def = HERO_DEFS[heroKind]
    const effStats = getEffectiveStats(def, heroShards ?? 0)
    const startDist = getPathTotalLen(wave)
    const [hx, hy]  = heroPos(wave, startDist, 0)
    hero = {
      kind:            heroKind,
      x:               hx,
      y:               hy,
      hp:              effStats.hp,
      maxHp:           effStats.hp,
      abilityCooldown: def.ability.cooldown,
      attackCooldown:  0,
      stunTimer:       0,
      dead:            false,
      pathDist:        startDist,
      pathId:          0,
    }
  }

  return {
    wave,
    towers,
    enemies:     [],
    spawnQueue,
    projectiles: [],
    nextSpawnAt: 0.6,
    elapsed:     0,
    phase:       'fighting',
    result:      { kills: 0, escaped: 0, goldEarned: 0, manaEarned: 0, xpEarned: 0, woodEarned: 0 },
    nextLane:        0,
    nextForkPath: 0,
    hero,
  }
}

// ── Hero ability helpers ──────────────────────────────────────────────────
function applyHeroAbility(hero: BattleHero, enemies: Enemy[]): void {
  const def = HERO_DEFS[hero.kind]
  switch (hero.kind) {
    case 'knight':
      // Shield Bash — stun all enemies within 60px for 1.5s
      for (const e of enemies) {
        const dx = e.x - hero.x, dy = e.y - hero.y
        if (Math.sqrt(dx * dx + dy * dy) <= 60) {
          e.slowTimer = Math.max(e.slowTimer, 4) // treat as hard-slow with very low speed
        }
      }
      break
    case 'ranger':
      // Volley — deal ranged damage to all enemies within attackRange
      for (const e of enemies) {
        const dx = e.x - hero.x, dy = e.y - hero.y
        if (Math.sqrt(dx * dx + dy * dy) <= def.attackRange) {
          e.hp -= def.damage * 2  // volley hits harder
        }
      }
      break
    case 'mage':
      // Frost Nova — freeze ALL enemies on screen for 2s
      for (const e of enemies) {
        e.slowTimer = Math.max(e.slowTimer, 2)
      }
      break
  }
}

// ── Tick (pure — returns new state) ───────────────────────────────────────
export function tickBattle(prev: BattleState, dt: number): BattleState {
  if (prev.phase !== 'fighting') return prev

  const enemies    = prev.enemies.map(e => ({ ...e }))
  const towers     = prev.towers.map(t => ({ ...t }))
  const result     = { ...prev.result }
  const spawnQueue = [...prev.spawnQueue]
  let { nextSpawnAt } = prev
  const elapsed = prev.elapsed + dt
  const newProjectiles: Projectile[] = []
  let { nextLane, nextForkPath } = prev

  // ── Spawn ────────────────────────────────────────────────────────────────
  if (spawnQueue.length > 0 && elapsed >= nextSpawnAt) {
    const kind = spawnQueue.shift()!
    const laneX   = isTripleLaneWave(prev.wave) ? TRIPLE_LANE_XS[nextLane % TRIPLE_LANE_XS.length] : undefined
    const usesFork  = isDiamondWave(prev.wave) || isFunnelWave(prev.wave)
    const pathId    = usesFork ? nextForkPath % 2 : 0
    const groupSize = ENEMY_STATS[kind].group ?? 1
    for (let g = 0; g < groupSize; g++) {
      enemies.push(spawnEnemy(kind, prev.wave, -g * 16, laneX, pathId))
    }
    if (isTripleLaneWave(prev.wave)) nextLane++
    if (usesFork)                    nextForkPath++
    const baseInterval = isLongWave(prev.wave) ? 1.0 : SPAWN_INTERVAL
    const interval = prev.wave > 5
      ? baseInterval * (0.7 + Math.random() * 0.6)  // ±30% jitter after wave 5
      : baseInterval
    nextSpawnAt += interval
  }

  // ── Move enemies ─────────────────────────────────────────────────────────
  for (const e of enemies) {
    e.slowTimer = Math.max(0, e.slowTimer - dt)
    const speed = (e.slowTimer > 0 ? e.baseSpeed * 0.4 : e.baseSpeed) * dt
    if (isExtZigzagWave(prev.wave)) {
      e.pathDist += speed
      ;[e.x, e.y] = posOnExtZigzag(e.pathDist)
    } else if (isZigzagWave(prev.wave)) {
      e.pathDist += speed
      ;[e.x, e.y] = posOnPath(e.pathDist)
    } else if (isDiamondWave(prev.wave)) {
      e.pathDist += speed
      ;[e.x, e.y] = posOnDiamondPath(e.pathId, e.pathDist)
    } else if (isFunnelWave(prev.wave)) {
      e.pathDist += speed
      ;[e.x, e.y] = posOnFunnelPath(e.pathId, e.pathDist)
    } else {
      e.y += speed
    }
  }

  // ── Hero tick ────────────────────────────────────────────────────────────
  let hero: BattleHero | null = prev.hero ? { ...prev.hero } : null
  if (hero && !hero.dead) {
    const heroDef = HERO_DEFS[hero.kind]

    // Decrement cooldowns
    hero.abilityCooldown = Math.max(0, hero.abilityCooldown - dt)
    hero.attackCooldown  = Math.max(0, hero.attackCooldown  - dt)
    hero.stunTimer       = Math.max(0, hero.stunTimer - dt)

    // Find the closest enemy within range
    let closestEnemy: Enemy | null = null
    let closestDist = Infinity
    for (const e of enemies) {
      const dx = e.x - hero.x, dy = e.y - hero.y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < closestDist) { closestDist = d; closestEnemy = e }
    }

    const blocked = closestEnemy !== null && closestDist <= heroDef.attackRange

    // Move along the path toward enemies (pathDist decreases = moves toward top)
    if (!blocked) {
      hero.pathDist = Math.max(0, hero.pathDist - heroDef.speed * dt)
      const [hx, hy] = heroPos(prev.wave, hero.pathDist, hero.pathId)
      hero.x = hx
      hero.y = hy
    }

    // Block enemies that have reached the hero — stop them from advancing past
    if (blocked) {
      for (const e of enemies) {
        const dx = e.x - hero.x, dy = e.y - hero.y
        const d  = Math.sqrt(dx * dx + dy * dy)
        if (d <= heroDef.attackRange + 10) {
          e.pathDist = Math.max(0, e.pathDist - heroDef.speed * dt)  // enemy can't advance
        }
      }

      // Hero attacks closest enemy (regular attack)
      if (hero.attackCooldown <= 0 && closestEnemy) {
        closestEnemy.hp    -= heroDef.damage
        hero.attackCooldown = 1 / heroDef.attackSpeed
      }
    }

    // Auto-ability every cooldown seconds
    if (hero.abilityCooldown <= 0) {
      applyHeroAbility(hero, enemies)
      hero.abilityCooldown = heroDef.ability.cooldown
    }

    // Hero takes damage from blocked enemies (each blocked enemy deals 5 dps)
    if (blocked) {
      const blockedCount = enemies.filter(e => {
        const dx = e.x - hero.x, dy = e.y - hero.y
        return Math.sqrt(dx * dx + dy * dy) <= heroDef.attackRange + 10
      }).length
      hero.hp -= blockedCount * 5 * dt
    }

    if (hero.hp <= 0) {
      hero.hp   = 0
      hero.dead = true
    }
  }

  // ── Towers attack ─────────────────────────────────────────────────────────
  for (const tower of towers) {
    tower.cooldown   = Math.max(0, tower.cooldown   - dt)
    tower.flashTimer = Math.max(0, tower.flashTimer - dt)
    if (tower.cooldown > 0) continue

    // Target: enemy furthest along path within range
    let target: Enemy | null = null
    if (isExtZigzagWave(prev.wave) || isZigzagWave(prev.wave)) {
      // 2D distance; priority = furthest along path
      let bestDist = -Infinity
      for (const e of enemies) {
        const dx = e.x - tower.x, dy = e.y - tower.y
        if (Math.sqrt(dx * dx + dy * dy) <= tower.rangePx && e.pathDist > bestDist) {
          target = e; bestDist = e.pathDist
        }
      }
    } else if (isTripleLaneWave(prev.wave) || isDiamondWave(prev.wave) || isFunnelWave(prev.wave)) {
      // 2D distance; priority = highest y (furthest down)
      let bestY = -Infinity
      for (const e of enemies) {
        const dx = e.x - tower.x, dy = e.y - tower.y
        if (Math.sqrt(dx * dx + dy * dy) <= tower.rangePx && e.y > bestY) {
          target = e; bestY = e.y
        }
      }
    } else {
      // Single lane: y-only distance check
      let bestY = -Infinity
      for (const e of enemies) {
        if (Math.abs(e.y - tower.y) <= tower.rangePx && e.y > bestY) {
          target = e; bestY = e.y
        }
      }
    }
    if (!target) continue

    tower.cooldown   = 1 / tower.attackSpeed
    tower.flashTimer = 0.15

    // Spawn projectile — damage applied on arrival, not immediately
    newProjectiles.push({
      id:          `p${_pid++}`,
      x:           tower.x,
      y:           tower.y,
      tx:          target.x,
      ty:          target.y,
      color:       tower.color,
      kind:        tower.kind,
      speed:       PROJ_SPEED[tower.kind] ?? 320,
      targetId:    target.id,
      damage:      tower.damage,
      splashRadius: tower.splashRadius,
    })

    // Slow (frost) — applied immediately on fire (visual: orb travels, slowing begins)
    if (tower.slowDuration > 0) {
      target.slowTimer = Math.max(target.slowTimer, tower.slowDuration)
    }
  }

  // ── Cull dead + escaped ───────────────────────────────────────────────────
  const alive: Enemy[] = []
  for (const e of enemies) {
    if (e.hp <= 0) {
      result.kills++
      result.goldEarned += ENEMY_STATS[e.kind].gold
      result.manaEarned += 6
      result.xpEarned   += 4   // 1/3 of mana
      // Trojan Horse: release grunts at its death position
      if (e.spawnsOnDeath) {
        for (let i = 0; i < e.spawnsOnDeath.length; i++) {
          const released = spawnEnemy(e.spawnsOnDeath[i], prev.wave, e.pathDist - i * 16, undefined, e.pathId)
          released.x = e.x
          released.y = e.y
          alive.push(released)
        }
      }
    } else if (
      isExtZigzagWave(prev.wave) ? e.pathDist >= EXT_ZIGZAG_TOTAL_LEN :
      isZigzagWave(prev.wave)    ? e.pathDist >= ZIGZAG_TOTAL_LEN     :
      isDiamondWave(prev.wave)   ? e.pathDist >= DIAMOND_TOTAL_LEN    :
      isFunnelWave(prev.wave)    ? e.pathDist >= FUNNEL_TOTAL_LEN     :
      e.y > BATTLE_H + 34
    ) {
      result.escaped++
    } else {
      alive.push(e)
    }
  }

  // ── Move projectiles & apply damage on arrival ────────────────────────────
  const projectiles: Projectile[] = []
  for (const p of prev.projectiles) {
    const dx   = p.tx - p.x
    const dy   = p.ty - p.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist <= p.speed * dt) {
      // Projectile reached target — apply damage now
      const hit = alive.find(e => e.id === p.targetId)
      if (hit) {
        const resist = hit.damageResist?.[p.kind] ?? 1
        hit.hp -= Math.round(p.damage * resist)
        if (p.splashRadius > 0) {
          for (const e of alive) {
            if (e.id !== p.targetId && Math.abs(e.y - p.ty) <= p.splashRadius) {
              const splashResist = e.damageResist?.[p.kind] ?? 1
              e.hp -= Math.round(p.damage * 0.5 * splashResist)
            }
          }
        }
      }
      continue   // remove projectile
    }
    const ratio = (p.speed * dt) / dist
    projectiles.push({ ...p, x: p.x + dx * ratio, y: p.y + dy * ratio })
  }
  for (const p of newProjectiles) projectiles.push(p)

  const phase: BattlePhase =
    result.escaped >= 2                           ? 'lost' :
    spawnQueue.length === 0 && alive.length === 0 ? 'won'  : 'fighting'

  return { wave: prev.wave, towers, enemies: alive, projectiles, spawnQueue, nextSpawnAt, elapsed, phase, result, nextLane, nextForkPath, hero }
}

// ── Spell cast ────────────────────────────────────────────────────────────────
const FIREBALL_DAMAGE = 80
const FIREBALL_RADIUS = 80   // px

const FREEZE_DURATION = 4   // seconds

export function applySpell(state: BattleState, kind: string, x: number, y: number): BattleState {
  if (kind === 'freeze') {
    // Freeze all enemies on screen
    const enemies = state.enemies.map(e => ({
      ...e,
      slowTimer: Math.max(e.slowTimer, FREEZE_DURATION),
    }))
    return { ...state, enemies }
  }

  if (kind !== 'fireball') return state

  const result = { ...state.result }
  const alive: Enemy[] = []

  for (const e of state.enemies) {
    const dx = e.x - x
    const dy = e.y - y
    if (Math.sqrt(dx * dx + dy * dy) <= FIREBALL_RADIUS) {
      const newHp = e.hp - Math.round(FIREBALL_DAMAGE * (e.damageResist?.['fireball'] ?? 1))
      if (newHp <= 0) {
        result.kills++
        result.goldEarned += ENEMY_STATS[e.kind].gold
        result.manaEarned += 6
        result.xpEarned   += 4
      } else {
        alive.push({ ...e, hp: newHp })
      }
    } else {
      alive.push(e)
    }
  }

  const phase: BattlePhase =
    state.spawnQueue.length === 0 && alive.length === 0 ? 'won' : 'fighting'

  return { ...state, enemies: alive, result, phase }
}
