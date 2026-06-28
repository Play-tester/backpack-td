import { useEffect, useRef } from 'react'
import { initBattle, tickBattle, applySpell, getPathTotalLen, heroPos } from '../battle/engine'
import type { CraftingState } from '../lib/crafting'
import {
  BATTLE_H, BATTLE_W, LANE_CX, LANE_W,
  LONG_BATTLE_H, isLongWave,
  ZIGZAG_WAYPOINTS, isZigzagWave,
  TRIPLE_LANE_XS, isTripleLaneWave,
  DIAMOND_PATH_A, DIAMOND_PATH_B, isDiamondWave,
  FUNNEL_PATH_A, FUNNEL_PATH_B, isFunnelWave,
  EXT_ZIGZAG_WAYPOINTS, isExtZigzagWave,
  type BattleHero, type BattleResult, type BattleState, type BattleTower, type DeployedTower, type Enemy, type Projectile,
} from '../battle/types'
import { DEFAULT_BUFFS, type Buffs } from '../lib/levelup'
import { HERO_DEFS, getEffectiveStats, type HeroKind } from '../lib/heroes'
import './BattleCanvas.css'

// ── Preload hero battle sprites ──────────────────────────────────────────────
function loadImg(src: string): HTMLImageElement {
  const img = new Image()
  img.src = src
  return img
}
const HERO_SPRITES: Record<HeroKind, HTMLImageElement> = {
  knight: loadImg('/Heroes/tyr_battle_sprite.png'),
  ranger: loadImg('/Heroes/ullr_battle_sprite.png'),
  mage:   loadImg('/Heroes/skadi_battle_sprite.png'),
}

interface PendingSpell { kind: string; x: number; y: number }
interface SplashEffect { x: number; y: number; radius: number; maxRadius: number; timer: number }

interface Props {
  deployedTowers: DeployedTower[]
  wave:  number
  buffs?: Buffs
  onBattleEnd: (result: BattleResult) => void
  tutorialLimitEnemies?: number
  pendingSpellRef?: React.MutableRefObject<PendingSpell | null>
  pendingHeroRef?: React.MutableRefObject<HeroKind | null>
  heroShards?: number   // current shard count for the selected hero — drives stat scaling
  craftingState?: CraftingState
}

// ── Path drawing ────────────────────────────────────────────────────────────
function drawPath(ctx: CanvasRenderingContext2D, wave: number) {
  const H = isLongWave(wave) ? LONG_BATTLE_H : BATTLE_H

  function strokePolyline(points: [number, number][], width: number, color: string, alpha = 1) {
    ctx.save()
    ctx.globalAlpha  = alpha
    ctx.strokeStyle  = color
    ctx.lineWidth    = width
    ctx.lineCap      = 'round'
    ctx.lineJoin     = 'round'
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
    ctx.stroke()
    ctx.restore()
  }

  // Three-layer dirt road: dark edge → mid earth → pale center (75% transparent)
  function drawRoad(points: [number, number][]) {
    strokePolyline(points, LANE_W,        '#2e1a06', 0.35)  // dark earth border
    strokePolyline(points, LANE_W * 0.72, '#4a2e10', 0.34)  // mid dirt
    strokePolyline(points, LANE_W * 0.38, '#5e3c18', 0.30)  // lighter worn center
    strokePolyline(points, LANE_W * 0.14, '#7a5228', 0.17)  // faint highlight
  }

  if (isExtZigzagWave(wave)) {
    drawRoad(EXT_ZIGZAG_WAYPOINTS as [number, number][])
  } else if (isDiamondWave(wave)) {
    drawRoad(DIAMOND_PATH_A)
    drawRoad(DIAMOND_PATH_B)
  } else if (isFunnelWave(wave)) {
    drawRoad(FUNNEL_PATH_A)
    drawRoad(FUNNEL_PATH_B)
  } else if (isTripleLaneWave(wave)) {
    for (const x of TRIPLE_LANE_XS) {
      drawRoad([[x, -34], [x, H + 34]])
    }
  } else if (isZigzagWave(wave)) {
    drawRoad(ZIGZAG_WAYPOINTS as [number, number][])
  } else {
    // Single lane (waves 1–4)
    drawRoad([[LANE_CX, -34], [LANE_CX, H + 34]])
  }
}

// ── Hero drawing ─────────────────────────────────────────────────────────────
const HERO_SIZE = 52   // sprite draw size (px)

function drawHero(ctx: CanvasRenderingContext2D, hero: BattleHero) {
  if (hero.dead) return
  const def    = HERO_DEFS[hero.kind]
  const sprite = HERO_SPRITES[hero.kind]
  const hw     = HERO_SIZE / 2

  // Soft glow behind sprite
  ctx.save()
  ctx.shadowColor = hero.kind === 'knight' ? '#fbbf24'
    : hero.kind === 'ranger' ? '#4ade80'
    : '#818cf8'
  ctx.shadowBlur = 18
  if (sprite.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, hero.x - hw, hero.y - hw, HERO_SIZE, HERO_SIZE)
  } else {
    // Fallback circle while sprite loads
    ctx.fillStyle = hero.kind === 'knight' ? '#b45309'
      : hero.kind === 'ranger' ? '#15803d' : '#4338ca'
    ctx.beginPath()
    ctx.arc(hero.x, hero.y, 18, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0
  ctx.restore()

  // Draw sprite without glow (clean pass on top)
  if (sprite.complete && sprite.naturalWidth > 0) {
    ctx.drawImage(sprite, hero.x - hw, hero.y - hw, HERO_SIZE, HERO_SIZE)
  }

  // HP bar
  const barW = HERO_SIZE + 4
  const barX = hero.x - barW / 2
  const barY = hero.y - hw - 8
  ctx.fillStyle = '#0d1b2a'
  ctx.fillRect(barX, barY, barW, 5)
  const pct = Math.max(0, hero.hp / hero.maxHp)
  ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#f87171'
  ctx.fillRect(barX, barY, barW * pct, 5)

  // Name label
  ctx.save()
  ctx.font = 'bold 9px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#fff'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 4
  ctx.fillText(def.name, hero.x, barY - 1)
  ctx.restore()
}

// ── Canvas draw ─────────────────────────────────────────────────────────────
function draw(ctx: CanvasRenderingContext2D, state: BattleState, splashEffects: SplashEffect[], cannonHitEffects: SplashEffect[], freezeFlash = 0) {
  const H = isLongWave(state.wave) ? LONG_BATTLE_H : BATTLE_H

  // Transparent canvas — background image from parent div shows through
  ctx.clearRect(0, 0, BATTLE_W, H)

  // ── Path (drawn first, behind everything) ──────────────────────────────────
  drawPath(ctx, state.wave)

  // ── Towers ─────────────────────────────────────────────────────────────────
  for (const t of state.towers) {
    drawTower(ctx, t)
  }

  // ── Projectiles ────────────────────────────────────────────────────────────
  for (const p of state.projectiles) {
    drawProjectile(ctx, p)
  }

  // ── Enemies ────────────────────────────────────────────────────────────────
  for (const e of state.enemies) {
    drawEnemy(ctx, e, state.elapsed)
  }

  // ── Hero ───────────────────────────────────────────────────────────────────
  if (state.hero && !state.hero.dead) {
    drawHero(ctx, state.hero)
  }

  // ── Splash effects (fireball) ──────────────────────────────────────────────
  for (const fx of splashEffects) {
    const progress = 1 - fx.timer / 0.5   // 0 → 1 over 0.5s
    const alpha    = 1 - progress
    const r        = fx.radius * progress + fx.maxRadius * (1 - progress) * 0.2
    ctx.save()
    ctx.globalAlpha = alpha * 0.7
    ctx.fillStyle   = '#ff6b00'
    ctx.beginPath()
    ctx.arc(fx.x, fx.y, fx.maxRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth   = 3
    ctx.beginPath()
    ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // ── Cannon hit effects ─────────────────────────────────────────────────────
  for (const fx of cannonHitEffects) {
    const progress = 1 - fx.timer / 0.3   // 0 → 1 over 0.3s
    const alpha    = 1 - progress
    const r        = fx.maxRadius * progress
    ctx.save()
    ctx.globalAlpha = alpha * 0.85
    ctx.fillStyle   = '#ff4400'
    ctx.beginPath()
    ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth   = 2
    ctx.beginPath()
    ctx.arc(fx.x, fx.y, r * 0.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // ── Boss HP bar (drawn at top when trojan is on field) ─────────────────────
  const trojan = state.enemies.find(e => e.kind === 'trojan')
  if (trojan) {
    const barW = 200, barH = 12
    const barX = BATTLE_W / 2 - barW / 2
    const barY = 44
    const pct  = Math.max(0, trojan.hp / trojan.maxHp)
    // Dark pill background
    ctx.save()
    ctx.fillStyle = 'rgba(8,18,36,0.85)'
    ctx.beginPath()
    ;(ctx as any).roundRect(barX - 6, barY - 20, barW + 12, barH + 26, 8)
    ctx.fill()
    // Label
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#ffd700'
    ctx.fillText('☠ TROJAN HORSE', BATTLE_W / 2, barY - 2)
    // HP track
    ctx.fillStyle = '#1a0a00'
    ctx.beginPath()
    ;(ctx as any).roundRect(barX, barY, barW, barH, 4)
    ctx.fill()
    // HP fill
    const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY)
    grad.addColorStop(0, '#ef4444')
    grad.addColorStop(0.5, '#f97316')
    grad.addColorStop(1, '#fbbf24')
    ctx.fillStyle = grad
    ctx.beginPath()
    ;(ctx as any).roundRect(barX, barY, barW * pct, barH, 4)
    ctx.fill()
    // HP text
    ctx.font = '9px monospace'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.ceil(trojan.hp)} / ${trojan.maxHp}`, BATTLE_W / 2, barY + barH / 2)
    ctx.restore()
  }

  // ── Freeze flash overlay ──────────────────────────────────────────────────
  if (freezeFlash > 0) {
    const alpha = freezeFlash * 0.35
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#7dd3fc'
    ctx.fillRect(0, 0, BATTLE_W, H)
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // Wave progress text — centered on lane, above enemy spawn point
  const done  = state.result.kills + state.result.escaped
  const total = done + state.enemies.length + state.spawnQueue.length
  const line1 = `Wave ${state.wave}: ${total} enemies`
  const line2 = `${total - done} remaining`
  const cx = BATTLE_W / 2
  ctx.save()
  ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const w1 = ctx.measureText(line1).width
  ctx.font = '11px monospace'
  const w2 = ctx.measureText(line2).width
  const pillW = Math.max(w1, w2) + 20
  const pillH = 36
  ctx.fillStyle = 'rgba(8, 18, 36, 0.78)'
  ctx.beginPath()
  ;(ctx as any).roundRect(cx - pillW / 2, 0, pillW, pillH, 8)
  ctx.fill()
  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(line1, cx, 4)
  ctx.font = '11px monospace'
  ctx.fillStyle = 'rgba(180, 210, 255, 0.85)'
  ctx.fillText(line2, cx, 19)
  ctx.restore()
}

function drawTower(ctx: CanvasRenderingContext2D, t: BattleTower) {
  const BASE  = 44  // matches deploy-screen BASE

  const dw = t.shapeCols * BASE
  const dh = t.shapeRows * BASE

  const x0 = t.x - dw / 2
  const y0 = t.y - dh / 2

  const img = t.image ? getCachedImage(t.image) : null

  // Range circle — amber for lantern (reveal radius), grey for combat towers
  ctx.save()
  if (t.revealRadius > 0) {
    // Lantern: draw reveal radius as warm amber glow ring
    ctx.strokeStyle = 'rgba(251,191,36,0.85)'
    ctx.lineWidth = 3
    ctx.setLineDash([6, 4])
    ctx.shadowColor = '#fbbf24'
    ctx.shadowBlur  = 6
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.revealRadius, 0, Math.PI * 2)
    ctx.stroke()
    // Soft fill inside
    ctx.globalAlpha = 0.06
    ctx.fillStyle = '#fde68a'
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.revealRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  } else {
    ctx.strokeStyle = 'rgba(100,100,100,0.9)'
    ctx.lineWidth = 3
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.rangePx, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.restore()

  // Image or text label
  if (img) {
    const SCALE = t.kind === 'cannon' ? 1.5 : 1.3
    const maxW = dw * SCALE
    const maxH = dh * SCALE
    const aspect = img.naturalWidth / img.naturalHeight
    let imgW = maxW
    let imgH = imgW / aspect
    if (imgH > maxH) { imgH = maxH; imgW = imgH * aspect }
    const imgX = t.x - imgW / 2
    const imgY = t.y - imgH / 2
    ctx.drawImage(img, imgX, imgY, imgW, imgH)
  } else {
    // No image: draw solid colour background so the text label is readable
    ctx.fillStyle = t.color
    ctx.fillRect(x0, y0, dw, dh)
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.font = 'bold 8px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(t.kind.substring(0, 3).toUpperCase(), t.x, t.y)
  }

  // Tier badge (bottom-right corner)
  if (t.tier >= 2) {
    const badgeText = `${t.tier}`
    const bx = x0 + dw - 4
    const by = y0 + dh - 4
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = t.tier >= 3 ? '#ff6fff' : '#ffd700'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 6
    ctx.fillText(badgeText, bx, by)
    ctx.shadowBlur = 0
  }
}

// ── Enemy sprite sheets ─────────────────────────────────────────────────────
// All sheets: vertical strip, 4 frames, each frame is a square (W = H/4)
const FRAME_COUNT = 4
const ANIM_FPS    = 10  // frames per second for walk cycle (was 6 — smoother animation)

interface EnemySheet {
  src:    string
  frameW: number   // width of one frame in the source image
  frameH: number   // height of one frame in the source image
  drawW:  number   // rendered width on canvas  (px)
  drawH:  number   // rendered height on canvas (px)
}

const ENEMY_SHEETS: Record<string, EnemySheet> = {
  // All sheets: 887×1774px, 4 frames, each frame 887×443px (2:1 ratio)
  grunt:  { src: '/normal_grunt_move.png', frameW: 887, frameH: 443, drawW: 56, drawH: 28 },
  runner: { src: '/runner_a.png',          frameW: 887, frameH: 443, drawW: 46, drawH: 23 },
  tank:   { src: '/tank_a.png',            frameW: 887, frameH: 443, drawW: 70, drawH: 35 },
  swarm:  { src: '/swarm_a.png',           frameW: 887, frameH: 443, drawW: 36, drawH: 18 },
  trojan: { src: '/trojan_a.png',          frameW: 887, frameH: 443, drawW: 90, drawH: 45 },
  shield: { src: '/shield_bearer_a.png',   frameW: 887, frameH: 443, drawW: 58, drawH: 29 },
  crow:   { src: '/crow_a.png',            frameW: 887, frameH: 443, drawW: 44, drawH: 22 },
  druid:  { src: '/druid_a.png',           frameW: 887, frameH: 443, drawW: 52, drawH: 26 },
}

function drawTrojan(ctx: CanvasRenderingContext2D, e: Enemy) {
  // Large wooden cart body
  const BW = 72, BH = 48
  const x0 = e.x - BW / 2
  const y0 = e.y - BH / 2

  // Wheel radius
  const WR = 12
  const wheelY = y0 + BH - 2

  ctx.save()

  // Wheels
  ctx.fillStyle = '#3b1f00'
  ctx.strokeStyle = '#7c5230'
  ctx.lineWidth = 3
  for (const wx of [x0 + 14, x0 + BW - 14]) {
    ctx.beginPath()
    ctx.arc(wx, wheelY, WR, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // Spokes
    ctx.strokeStyle = '#a0703a'
    ctx.lineWidth = 2
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      ctx.beginPath()
      ctx.moveTo(wx, wheelY)
      ctx.lineTo(wx + Math.cos(a) * (WR - 2), wheelY + Math.sin(a) * (WR - 2))
      ctx.stroke()
    }
    ctx.strokeStyle = '#7c5230'
    ctx.lineWidth = 3
  }

  // Main cart body
  ctx.fillStyle = '#8b5e3c'
  ctx.strokeStyle = '#5c3d1e'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ;(ctx as any).roundRect(x0, y0, BW, BH - 10, 6)
  ctx.fill()
  ctx.stroke()

  // Wood plank lines
  ctx.strokeStyle = '#7a4f28'
  ctx.lineWidth = 1
  for (let i = 1; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(x0 + 4, y0 + (BH - 10) * i / 3)
    ctx.lineTo(x0 + BW - 4, y0 + (BH - 10) * i / 3)
    ctx.stroke()
  }

  // TROJAN label
  ctx.font = 'bold 8px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffe8c0'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 3
  ctx.fillText('TROJAN', e.x, y0 + (BH - 10) / 2)
  ctx.shadowBlur = 0

  ctx.restore()
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, elapsed: number) {
  // Trojan Horse — use sprite sheet if loaded, else procedural cart
  if (e.kind === 'trojan') {
    const sheet = ENEMY_SHEETS['trojan']
    const EW = sheet.drawW, EH = sheet.drawH
    const x0 = e.x - EW / 2
    const y0 = e.y - EH / 2
    const img = getCachedImage(sheet.src)
    if (img) {
      const phaseOffset = (parseInt(e.id.replace(/\D/g, ''), 10) % FRAME_COUNT) / ANIM_FPS
      const frame = Math.floor((elapsed + phaseOffset) * ANIM_FPS) % FRAME_COUNT
      const sy = frame * sheet.frameH
      ctx.drawImage(img, 0, sy, sheet.frameW, sheet.frameH, x0, y0, EW, EH)
    } else {
      drawTrojan(ctx, e)
    }
    // HP bar above sprite
    ctx.fillStyle = '#0d1b2a'
    ctx.fillRect(x0, y0 - 8, EW, 5)
    const pct = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = pct > 0.5 ? '#f87171' : pct > 0.25 ? '#fbbf24' : '#ef4444'
    ctx.fillRect(x0, y0 - 8, EW * pct, 5)
    if (e.slowTimer > 0) {
      ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillText('❄', e.x, e.y)
    }
    return
  }

  // ── Druid: ghost rendering when phased ───────────────────────────────────
  if (e.kind === 'druid' && e.phased) {
    const sheet = ENEMY_SHEETS['druid']
    const EW = sheet?.drawW ?? 52, EH = sheet?.drawH ?? 26
    const x0 = e.x - EW / 2, y0 = e.y - EH / 2
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.shadowColor = '#c4b5fd'
    ctx.shadowBlur  = 14
    if (sheet) {
      const img = getCachedImage(sheet.src)
      if (img) {
        const phaseOffset = (parseInt(e.id.replace(/\D/g, ''), 10) % FRAME_COUNT) / ANIM_FPS
        const frame = Math.floor((elapsed + phaseOffset) * ANIM_FPS) % FRAME_COUNT
        ctx.drawImage(img, 0, frame * sheet.frameH, sheet.frameW, sheet.frameH, x0, y0, EW, EH)
      } else {
        ctx.fillStyle = '#a78bfa'
        ctx.beginPath(); (ctx as any).roundRect(x0, y0, EW, EH, 4); ctx.fill()
      }
    }
    ctx.restore()
    // Show a faint HP bar so player knows it exists
    ctx.globalAlpha = 0.4
    ctx.fillStyle = '#0d1b2a'; ctx.fillRect(x0, y0 - 7, EW, 4)
    const pct = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#f87171'
    ctx.fillRect(x0, y0 - 7, EW * pct, 4)
    ctx.globalAlpha = 1
    return
  }

  // ── Aerial crow: draw ground shadow, then sprite elevated above it ────────
  if (e.aerial) {
    const sheet = ENEMY_SHEETS['crow']
    const EW = sheet?.drawW ?? 44, EH = sheet?.drawH ?? 22
    const ELEVATION = 22  // px above the y position (visual height above ground)
    const drawX = e.x - EW / 2
    const drawY = e.y - EH / 2 - ELEVATION
    // Ground shadow — dark ellipse below
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(e.x, e.y, EW * 0.4, EH * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    // Sprite (or colored rect fallback)
    if (sheet) {
      const img = getCachedImage(sheet.src)
      if (img) {
        const phaseOffset = (parseInt(e.id.replace(/\D/g, ''), 10) % FRAME_COUNT) / ANIM_FPS
        const frame = Math.floor((elapsed + phaseOffset) * ANIM_FPS) % FRAME_COUNT
        ctx.drawImage(img, 0, frame * sheet.frameH, sheet.frameW, sheet.frameH, drawX, drawY, EW, EH)
      } else {
        ctx.fillStyle = '#1e1b4b'
        ctx.beginPath()
        ;(ctx as any).roundRect(drawX, drawY, EW, EH, 4)
        ctx.fill()
      }
    }
    // HP bar above sprite
    ctx.fillStyle = '#0d1b2a'
    ctx.fillRect(drawX, drawY - 7, EW, 4)
    const pct = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#f87171'
    ctx.fillRect(drawX, drawY - 7, EW * pct, 4)
    // Aerial indicator
    ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3
    ctx.fillText('🪶', e.x, drawY - 7)
    ctx.shadowBlur = 0
    return
  }

  const sheet   = ENEMY_SHEETS[e.kind]
  const slowed  = e.slowTimer > 0
  const baseColor = ENEMY_COLOR[e.kind] ?? '#ef4444'

  const EW = sheet?.drawW ?? 36
  const EH = sheet?.drawH ?? 36
  const x0 = e.x - EW / 2
  const y0 = e.y - EH / 2

  // Body — animated sprite sheet with colored-rect fallback
  if (sheet) {
    const img = getCachedImage(sheet.src)
    if (img) {
      // Phase offset per enemy so groups don't animate in lockstep
      const phaseOffset = (parseInt(e.id.replace(/\D/g, ''), 10) % FRAME_COUNT) / ANIM_FPS
      const frame = Math.floor((elapsed + phaseOffset) * ANIM_FPS) % FRAME_COUNT
      const sy    = frame * sheet.frameH
      ctx.drawImage(img, 0, sy, sheet.frameW, sheet.frameH, x0, y0, EW, EH)
    } else {
      ctx.fillStyle = baseColor
      ctx.beginPath()
      ;(ctx as any).roundRect(x0, y0, EW, EH, 4)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = baseColor
    ctx.beginPath()
    ;(ctx as any).roundRect(x0, y0, EW, EH, 4)
    ctx.fill()
  }

  // HP bar background
  ctx.fillStyle = '#0d1b2a'
  ctx.fillRect(x0, y0 - 7, EW, 4)

  // HP bar fill
  const pct = Math.max(0, e.hp / e.maxHp)
  ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#f87171'
  ctx.fillRect(x0, y0 - 7, EW * pct, 4)

  // Slow indicator
  if (slowed) {
    ctx.font = '7px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText('❄', e.x, e.y)
  }

  // Druid phase indicator — ghost icon when visible but about to phase
  if (e.kind === 'druid') {
    ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3
    ctx.fillText('👻', e.x, y0 - 7)
    ctx.shadowBlur = 0
  }

  // Shield resistance indicator — small shield icon above HP bar
  if (e.kind === 'shield') {
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 3
    ctx.fillText('🛡', e.x, y0 - 7)
    ctx.shadowBlur = 0
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  const dx   = p.tx - p.x
  const dy   = p.ty - p.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  ctx.save()

  if (p.kind === 'archer') {
    const img = getCachedImage('/arrow_p.png')
    if (img && dist > 0) {
      const angle = Math.atan2(dy, dx)
      ctx.translate(p.x, p.y)
      ctx.rotate(angle)
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur  = 4
      ctx.drawImage(img, -22, -7, 44, 14)
    } else if (dist > 0) {
      // Fallback: line
      const nx = dx / dist
      const ny = dy / dist
      const len = 14
      ctx.strokeStyle = '#fff'
      ctx.lineWidth   = 2
      ctx.lineCap     = 'round'
      ctx.shadowColor = p.color
      ctx.shadowBlur  = 6
      ctx.beginPath()
      ctx.moveTo(p.x - nx * len, p.y - ny * len)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
  } else if (p.kind === 'cannon') {
    const img = getCachedImage('/cannon_ball_p.png')
    if (img) {
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur  = 6
      ctx.drawImage(img, p.x - 12, p.y - 12, 24, 24)
    } else {
      ctx.fillStyle   = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur  = 14
      ctx.beginPath()
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (p.kind === 'ballista') {
    // Ballista bolt — long dark bolt with feather fletching feel
    if (dist > 0) {
      const angle = Math.atan2(dy, dx)
      ctx.translate(p.x, p.y)
      ctx.rotate(angle)
      ctx.shadowColor = 'rgba(92,40,14,0.9)'
      ctx.shadowBlur  = 6
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth   = 3
      ctx.lineCap     = 'round'
      ctx.beginPath()
      ctx.moveTo(-18, 0)
      ctx.lineTo(8, 0)
      ctx.stroke()
      // Tip
      ctx.fillStyle = '#1c0a00'
      ctx.beginPath()
      ctx.moveTo(8, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3)
      ctx.closePath()
      ctx.fill()
    }
  } else if (p.kind === 'frost') {
    const img = getCachedImage('/frost_orb_p.png')
    if (img) {
      ctx.shadowColor = 'rgba(56,189,248,0.5)'
      ctx.shadowBlur  = 8
      ctx.drawImage(img, p.x - 11, p.y - 11, 22, 22)
    } else {
      ctx.fillStyle   = '#7dd3fc'
      ctx.shadowColor = '#38bdf8'
      ctx.shadowBlur  = 12
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.fillStyle   = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur  = 8
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

// ── Component ───────────────────────────────────────────────────────────────
// ── Image cache for canvas drawing ─────────────────────────────────────────
const imgCache = new Map<string, HTMLImageElement | 'loading'>()
function getCachedImage(src: string): HTMLImageElement | null {
  const entry = imgCache.get(src)
  if (entry === 'loading') return null
  if (entry) return entry
  imgCache.set(src, 'loading')
  const img = new Image()
  img.onload = () => imgCache.set(src, img)
  img.src = src
  return null
}

// Enemy colours by kind
const ENEMY_COLOR: Record<string, string> = {
  grunt:  '#ef4444',   // red
  runner: '#f97316',   // orange
  tank:   '#7c3aed',   // purple — big and slow
  swarm:  '#facc15',   // yellow — tiny and fast
  trojan: '#8b5e3c',   // wooden brown
  shield: '#16a34a',   // Celtic green
  crow:   '#1e1b4b',   // dark indigo — ominous war crow
  druid:  '#a78bfa',   // pale violet — ghostly druid
}

export default function BattleCanvas({ deployedTowers, wave, buffs = DEFAULT_BUFFS, onBattleEnd, tutorialLimitEnemies, pendingSpellRef, pendingHeroRef, heroShards = 0, craftingState }: Props) {
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const scrollRef       = useRef<HTMLDivElement>(null)
  const stateRef        = useRef<BattleState>(initBattle(deployedTowers, wave, buffs, tutorialLimitEnemies, undefined, heroShards, craftingState))
  const callbackRef     = useRef(onBattleEnd)
  callbackRef.current   = onBattleEnd
  const splashEffects     = useRef<SplashEffect[]>([])
  const cannonHitEffects  = useRef<SplashEffect[]>([])
  const freezeTimer       = useRef<number>(0)   // seconds remaining on freeze flash

  const long = isLongWave(wave)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    let rafId: number
    let lastTime: number | null = null

    function loop(time: number) {
      const dt = Math.min((lastTime != null ? time - lastTime : 0) / 1000, 0.1)
      lastTime = time

      // Apply any queued spell cast
      if (pendingSpellRef?.current) {
        const { kind, x, y } = pendingSpellRef.current
        pendingSpellRef.current = null
        stateRef.current = applySpell(stateRef.current, kind, x, y)
        if (kind === 'freeze') {
          freezeTimer.current = 0.6   // blue flash duration
        } else {
          splashEffects.current.push({ x, y, radius: 0, maxRadius: 80, timer: 0.5 })
        }
      }

      // Apply hero deployment
      if (pendingHeroRef?.current && !stateRef.current.hero) {
        const heroKind = pendingHeroRef.current
        pendingHeroRef.current = null
        const def = HERO_DEFS[heroKind]
        const effStats = getEffectiveStats(def, heroShards)
        // Start hero at bottom of path
        const startDist = getPathTotalLen(wave)
        const [hx, hy] = heroPos(wave, startDist, 0)
        const heroState: BattleHero = {
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
        stateRef.current = { ...stateRef.current, hero: heroState }
      }

      const prevProjectiles = stateRef.current.projectiles
      stateRef.current = tickBattle(stateRef.current, dt)

      // Detect cannon projectile hits and spawn impact VFX
      const currProjIds = new Set(stateRef.current.projectiles.map(p => p.id))
      for (const p of prevProjectiles) {
        if (p.kind === 'cannon' && !currProjIds.has(p.id)) {
          cannonHitEffects.current.push({ x: p.tx, y: p.ty, radius: 0, maxRadius: 24, timer: 0.3 })
        }
      }

      // Tick splash effects
      splashEffects.current = splashEffects.current
        .map(fx => ({ ...fx, timer: fx.timer - dt, radius: fx.radius + (fx.maxRadius / 0.5) * dt }))
        .filter(fx => fx.timer > 0)

      // Tick cannon hit effects
      cannonHitEffects.current = cannonHitEffects.current
        .map(fx => ({ ...fx, timer: fx.timer - dt }))
        .filter(fx => fx.timer > 0)

      freezeTimer.current = Math.max(0, freezeTimer.current - dt)
      draw(ctx, stateRef.current, splashEffects.current, cannonHitEffects.current, freezeTimer.current)

      // Auto-scroll: keep frontmost enemy centred in the viewport
      if (long && scrollRef.current && stateRef.current.enemies.length > 0) {
        const front = stateRef.current.enemies.reduce((best, e) =>
          e.pathDist > best.pathDist ? e : best
        )
        const target = Math.max(0, Math.min(front.y - BATTLE_H / 2, LONG_BATTLE_H - BATTLE_H))
        scrollRef.current.scrollTop = target
      }

      if (stateRef.current.phase === 'fighting') {
        rafId = requestAnimationFrame(loop)
      } else {
        callbackRef.current(stateRef.current.result)
      }
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, []) // runs once on mount

  if (long) {
    return (
      <div ref={scrollRef} className="battle-canvas battle-canvas-scroll">
        <canvas ref={canvasRef} width={BATTLE_W} height={LONG_BATTLE_H} />
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="battle-canvas"
      width={BATTLE_W}
      height={BATTLE_H}
    />
  )
}
