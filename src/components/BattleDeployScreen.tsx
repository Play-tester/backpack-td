import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BATTLE_H, BATTLE_W, LANE_CX, LANE_W, isZigzagWave, ZIGZAG_WAYPOINTS, TRIPLE_LANE_XS, isTripleLaneWave, DIAMOND_PATH_A, DIAMOND_PATH_B, isDiamondWave, FUNNEL_PATH_A, FUNNEL_PATH_B, isFunnelWave, LONG_BATTLE_H, EXT_ZIGZAG_WAYPOINTS, isExtZigzagWave, isLongWave, type DeployedTower } from '../battle/types'
import { KIND_RANGE, ballistaRange } from '../battle/engine'
import { getItemImage } from '../lib/items'
import type { Buffs } from '../lib/levelup'
import { shapeDims, type Item, type ItemSize, type PlacedItem } from '../types'
import BackpackMiniView from './BackpackMiniView'
import './BattleDeployScreen.css'

// ── Predefined slot positions ─────────────────────────────────────────────
interface TowerSlot { id: string; x: number; y: number }

// Single center lane (x=195): old slots x=85/305 (gap 110) → 50% closer → x=140/250 (gap 55).
const SLOTS_3: TowerSlot[] = [
  { id: 's1', x: 140, y: 125 },
  { id: 's2', x: 250, y: 250 },
  { id: 's3', x: 140, y: 375 },
  { id: 's4', x: 250, y: 125 },
  { id: 's5', x: 250, y: 375 },
  { id: 's6', x: 140, y: 250 },  // left-center fill
  { id: 's7', x: 250, y: 458 },  // right bottom
]

const SLOTS_5: TowerSlot[] = [
  { id: 's1', x: 140, y: 83  },
  { id: 's2', x: 250, y: 167 },
  { id: 's3', x: 140, y: 250 },
  { id: 's4', x: 250, y: 333 },
  { id: 's5', x: 140, y: 417 },
  { id: 's6', x: 250, y: 83  },
  { id: 's7', x: 140, y: 333 },
  { id: 's8', x: 250, y: 417 },  // right mid-bottom mirror
  { id: 's9', x: 140, y: 167 },  // left mid-upper mirror
]

// Zigzag (battle_2.png): LEFT x=155, RIGHT x=225, turn1 y=165, turn2 y=335.
// Old safe x=67/313 (88px from path center) → 50% closer → x=111/269 (44px from path center).
const SLOTS_ZIGZAG: TowerSlot[] = [
  { id: 's1', x: 269, y: 83  },  // right — top section
  { id: 's2', x: 111, y: 250 },  // left — middle section
  { id: 's3', x: 269, y: 250 },  // right — middle section
  { id: 's4', x: 111, y: 415 },  // left — bottom section
  { id: 's5', x: 269, y: 415 },  // right — bottom section
  { id: 's6', x: 111, y: 83  },  // left — top section
  { id: 's7', x: 269, y: 165 },  // right at turn1
  { id: 's8', x: 111, y: 335 },  // left at turn2
  { id: 's9', x: 269, y: 335 },  // right at turn2
]

// Triple-lane (battle_3.png): lanes at x=80, 195, 310 (width 52). Gaps centred at x=137 and x=253.
// Gap is only 57px wide — can't move closer without overlapping a lane. Keep midpoints; add 2 more rows.
const SLOTS_TRIPLELANE: TowerSlot[] = [
  { id: 's1', x: 138, y: 83  },
  { id: 's2', x: 253, y: 83  },
  { id: 's3', x: 138, y: 250 },
  { id: 's4', x: 253, y: 250 },
  { id: 's5', x: 138, y: 417 },
  { id: 's6', x: 253, y: 417 },
  { id: 's7', x: 253, y: 165 },
  { id: 's8', x: 138, y: 335 },
  { id: 's9', x: 138, y: 165 },  // left gap mid-upper
  { id: 's10',x: 253, y: 335 },  // right gap mid-lower
]

// Diamond (battle_4.png): center path at x=195 (y<60 and y>430); arms peak at x=45/335 at y=230.
// 50% closer to nearest path. Left arm at y=150→x≈116, y=350→x≈135. Right arm mirrors.
// Center path at y=30→x=195 (gap was 135 → now 67). Center at y=460 similarly.
const SLOTS_DIAMOND: TowerSlot[] = [
  { id: 's1', x: 128, y: 30  },  // left side above split (67px from center path)
  { id: 's2', x: 195, y: 245 },  // center inside diamond — equidistant from both arms
  { id: 's3', x: 262, y: 460 },  // right side below merge (67px from center path)
  { id: 's4', x: 68,  y: 150 },  // left outer, upper arm (48px from left arm path)
  { id: 's5', x: 322, y: 150 },  // right outer, upper arm (48px from right arm path)
  { id: 's6', x: 78,  y: 350 },  // left outer, lower arm (57px from left arm path)
  { id: 's7', x: 312, y: 350 },  // right outer, lower arm (57px from right arm path)
  { id: 's8', x: 262, y: 30  },  // right side above split (mirror of s1)
  { id: 's9', x: 128, y: 460 },  // left side below merge (mirror of s3)
]

// Funnel (battle_5.png): left x=110, right x=280 (y<300), converge to x=195 at y=534.
// 50% closer to nearest path. Above y=300: outer slots moved from x=40/350 to x=75/315.
// Below y=300: paths converging, outer slots brought in proportionally.
const SLOTS_FUNNEL: TowerSlot[] = [
  { id: 's1', x: 195, y: 80  },  // center between lanes (85px from each — stay put)
  { id: 's2', x: 75,  y: 200 },  // left — 35px from left path
  { id: 's3', x: 315, y: 200 },  // right — 35px from right path
  { id: 's4', x: 99,  y: 430 },  // left — 58px from converging left path at y=430
  { id: 's5', x: 291, y: 430 },  // right — 58px from converging right path at y=430
  { id: 's6', x: 195, y: 250 },  // center between lanes — safe above convergence
  { id: 's7', x: 75,  y: 320 },  // left near convergence — covers transition
  { id: 's8', x: 315, y: 320 },  // right near convergence — covers transition
  { id: 's9', x: 195, y: 150 },  // center upper — fires into both lanes from between
]

// Extended zigzag (battle_2.png scaled to 750px): LEFT=155, RIGHT=225, turn1 y=248, turn2 y=503.
// 50% closer: old x=67/313 (88px from path center) → x=111/269 (44px from path center).
const SLOTS_EXT_ZIGZAG: TowerSlot[] = [
  { id: 's1',  x: 111, y: 120 },  // left — top section
  { id: 's2',  x: 269, y: 120 },  // right — top section
  { id: 's3',  x: 111, y: 375 },  // left — middle section
  { id: 's4',  x: 269, y: 375 },  // right — middle section
  { id: 's5',  x: 111, y: 503 },  // left — at turn2
  { id: 's6',  x: 269, y: 503 },  // right — at turn2
  { id: 's7',  x: 111, y: 630 },  // left — lower section
  { id: 's8',  x: 269, y: 630 },  // right — lower section
  { id: 's9',  x: 111, y: 248 },  // left at turn1
  { id: 's10', x: 269, y: 248 },  // right at turn1
  { id: 's11', x: 111, y: 60  },  // left — very top (entry stretch)
  { id: 's12', x: 269, y: 60  },  // right — very top (entry stretch)
]

// ── Path segments for the prep-phase SVG overlay ──────────────────────────
// Returns an array of polyline point-sets (one per path) for the given wave.
function pathSegments(wave: number): [number, number][][] {
  const H = isLongWave(wave) ? LONG_BATTLE_H : BATTLE_H
  if (isExtZigzagWave(wave))  return [EXT_ZIGZAG_WAYPOINTS as [number, number][]]
  if (isZigzagWave(wave))     return [ZIGZAG_WAYPOINTS    as [number, number][]]
  if (isTripleLaneWave(wave)) return TRIPLE_LANE_XS.map(x => [[x, -34], [x, H + 34]] as [number, number][])
  if (isDiamondWave(wave))    return [DIAMOND_PATH_A, DIAMOND_PATH_B]
  if (isFunnelWave(wave))     return [FUNNEL_PATH_A, FUNNEL_PATH_B]
  return [[[LANE_CX, -34], [LANE_CX, H + 34]]]
}

// ── Visual nudge: shift a frost tower's image away from the nearest path ──
// Slot position (hitbox, range circle) stays unchanged; only the drawn image moves.
function getPathNudge(slot: TowerSlot, wave: number, nudgePx = 20): { dx: number; dy: number } {
  const segs = pathSegments(wave)
  let bestDist = Infinity, bestNx = slot.x, bestNy = slot.y
  for (const pts of segs) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
      const sdx = x1 - x0, sdy = y1 - y0
      const len2 = sdx * sdx + sdy * sdy
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((slot.x - x0) * sdx + (slot.y - y0) * sdy) / len2)) : 0
      const nx = x0 + t * sdx, ny = y0 + t * sdy
      const dist = Math.hypot(slot.x - nx, slot.y - ny)
      if (dist < bestDist) { bestDist = dist; bestNx = nx; bestNy = ny }
    }
  }
  if (bestDist < 1) return { dx: 0, dy: 0 }
  const scale = nudgePx / bestDist
  return {
    dx: Math.round((slot.x - bestNx) * scale),
    dy: Math.round((slot.y - bestNy) * scale),
  }
}

function getSlots(wave: number): TowerSlot[] {
  if (isExtZigzagWave(wave))  return SLOTS_EXT_ZIGZAG
  if (isFunnelWave(wave))     return SLOTS_FUNNEL
  if (isDiamondWave(wave))    return SLOTS_DIAMOND
  if (isTripleLaneWave(wave)) return SLOTS_TRIPLELANE
  if (isZigzagWave(wave))     return SLOTS_ZIGZAG
  return wave <= 3 ? SLOTS_3 : SLOTS_5
}

// ── Drag state ────────────────────────────────────────────────────────────
interface DragState {
  item:        Item
  fromSlotId:  string | null
  mouseX:      number
  mouseY:      number
}

// ── Props ─────────────────────────────────────────────────────────────────
interface Props {
  placedItems:      Map<string, PlacedItem>
  buffs:            Buffs
  wave:             number
  gridRows:         number
  gridCols:         number
  onLaunch:         (towers: DeployedTower[]) => void
  onBack:           () => void
  onDeployChange?:  (hasDeployedTowers: boolean) => void
  arenaOverlay?:    React.ReactNode   // rendered inside deploy-arena as absolute overlay
}

export default function BattleDeployScreen({ placedItems, buffs, wave, gridRows, gridCols, onLaunch, onBack, onDeployChange, arenaOverlay }: Props) {
  const militaryItems = Array.from(placedItems.values())
    .filter(p => p.item.def.category === 'military')
    .map(p => p.item)

  const slots = getSlots(wave)
  const [slotItems, setSlotItems] = useState<Record<string, Item>>({})
  const [drag,      setDrag]      = useState<DragState | null>(null)

  // ── Notify parent when deployment status changes ───────────────────────
  useEffect(() => {
    onDeployChange?.(Object.keys(slotItems).length > 0)
  }, [slotItems, onDeployChange])

  // ── Arena scale — fills flex: 2 container while keeping coordinate space ──
  const arenaRef = useRef<HTMLDivElement>(null)
  const [arenaScale, setArenaScale] = useState(1)
  useEffect(() => {
    const el = arenaRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setArenaScale(entry.contentRect.height / BATTLE_H)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Global pointer tracking ────────────────────────────────────────────
  useEffect(() => {
    if (!drag) return
    const currentDrag = drag   // capture for use inside callbacks

    function onMove(e: PointerEvent) {
      setDrag(d => d ? { ...d, mouseX: e.clientX, mouseY: e.clientY } : null)
    }

    function onUp(e: PointerEvent) {
      const targetSlotId = findSlotUnderPoint(e.clientX, e.clientY)

      if (targetSlotId) {
        setSlotItems(prev => {
          const next = { ...prev }
          const existingInTarget = next[targetSlotId]
          if (currentDrag.fromSlotId) {
            if (existingInTarget) {
              next[currentDrag.fromSlotId] = existingInTarget
            } else {
              delete next[currentDrag.fromSlotId]
            }
          }
          next[targetSlotId] = currentDrag.item
          return next
        })
      } else if (currentDrag.fromSlotId) {
        setSlotItems(prev => {
          const next = { ...prev }
          delete next[currentDrag.fromSlotId!]
          return next
        })
      }
      setDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }
  }, [drag])

  function startBenchDrag(e: React.PointerEvent, item: Item) {
    e.preventDefault()
    setDrag({ item, fromSlotId: null, mouseX: e.clientX, mouseY: e.clientY })
  }

  function startSlotDrag(e: React.PointerEvent, item: Item, slotId: string) {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ item, fromSlotId: slotId, mouseX: e.clientX, mouseY: e.clientY })
  }

  const filledCount  = Object.keys(slotItems).length
  const usedIds      = new Set(Object.values(slotItems).map(i => i.id))
  const canLaunch    = militaryItems.length === 0 || filledCount > 0
  const draggingId   = drag?.item.id

  function handleLaunch() {
    const towers: DeployedTower[] = slots
      .filter(s => slotItems[s.id])
      .map(s => ({ item: slotItems[s.id], x: s.x, y: s.y }))
    onLaunch(towers)
  }

  const benchLabel = filledCount === slots.length
    ? `All towers placed (${filledCount}/${slots.length})`
    : militaryItems.length === 0
      ? 'No military units in backpack'
      : `Drag towers to slots (${filledCount}/${slots.length} placed)`

  return (
    <div className="deploy-screen">
      <button className="deploy-back" onClick={onBack}>← Back to Shop</button>

      {/* ── Arena (scales to fill flex: 2 space; inner coords stay in BATTLE_W×BATTLE_H) ── */}
      <div
        ref={arenaRef}
        className={`deploy-arena${
          isExtZigzagWave(wave)  ? ' extzigzag'  :
          isFunnelWave(wave)     ? ' funnel'      :
          isDiamondWave(wave)    ? ' diamond'     :
          isTripleLaneWave(wave) ? ' triplelane'  :
          isZigzagWave(wave)     ? ' zigzag'      : ''}`}
        style={{ overflowY: isLongWave(wave) ? 'auto' : undefined }}
      >
        {/* Inner div: fixed BATTLE coord space, CSS-scaled to fill the flex container */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: BATTLE_W, height: isLongWave(wave) ? LONG_BATTLE_H : BATTLE_H,
          transformOrigin: 'top left',
          transform: `scaleY(${arenaScale})`,
          ...(isLongWave(wave) ? { backgroundImage: "url('/battle_2.png')", backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' } : {}),
        }}>
        {/* Path overlay — same 3-layer dirt road as battle canvas, at 50% opacity */}
        {pathSegments(wave).map((pts, i) => {
          const H = isLongWave(wave) ? LONG_BATTLE_H : BATTLE_H
          const joined = pts.map(([x, y]) => `${x},${y}`).join(' ')
          return (
            <svg key={i} style={{ position: 'absolute', inset: 0, width: BATTLE_W, height: H, overflow: 'visible', pointerEvents: 'none' }}>
              <polyline points={joined} fill="none" stroke="#2e1a06" strokeWidth={LANE_W}        strokeOpacity={0.35} strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={joined} fill="none" stroke="#4a2e10" strokeWidth={LANE_W * 0.72} strokeOpacity={0.34} strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={joined} fill="none" stroke="#5e3c18" strokeWidth={LANE_W * 0.38} strokeOpacity={0.30} strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={joined} fill="none" stroke="#7a5228" strokeWidth={LANE_W * 0.14} strokeOpacity={0.17} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )
        })}
        <div
          className="arena-spawn-label"
          style={(isZigzagWave(wave) || isExtZigzagWave(wave)) ? { left: 155, transform: 'none' } : {}}
        >▼ Enemies spawn here</div>

        {slots.map(slot => {
          const item = slotItems[slot.id]
          const isDraggingFromHere = item && draggingId === item.id
          const BASE = 44
          const { rows: sRows, cols: sCols } = item
            ? shapeDims(item.def.size as ItemSize)
            : { rows: 1, cols: 1 }
          const slotW = sCols * BASE
          const slotH = sRows * BASE
          const isFrost = item?.def.kind === 'frost'
          const nudge = isFrost ? getPathNudge(slot, wave) : { dx: 0, dy: 0 }
          return (
            <div
              key={slot.id}
              className={`deploy-slot${item ? ' slot-filled' : ' slot-empty'}`}
              data-slot-id={slot.id}
              style={{ left: slot.x - slotW / 2, top: slot.y - slotH / 2, width: slotW, height: slotH }}
            >
              {item && (
                <div
                  className={`slot-tower${isDraggingFromHere ? ' is-dragging' : ''}`}
                  style={{ background: item.def.color, width: slotW, height: slotH,
                    ...(isFrost && (nudge.dx || nudge.dy) ? { transform: `translate(${nudge.dx}px, ${nudge.dy}px)` } : {}) }}
                  onPointerDown={e => startSlotDrag(e, item, slot.id)}
                >
                  {getItemImage(item)
                    ? <img src={getItemImage(item)} alt={item.def.label} className="slot-tower-img" draggable={false} />
                    : <span className="arena-tower-label">{item.def.label.slice(0, 3).toUpperCase()}</span>
                  }
                  {item.tier >= 2 && <span className="arena-tower-tier">{item.tier}</span>}
                </div>
              )}
            </div>
          )
        })}

        {/* Range circles — rendered after slots so they appear on top */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 10 }}>
          {slots.map(slot => {
            const item = slotItems[slot.id]
            if (!item) return null
            const baseRange = item.def.kind === 'ballista' ? ballistaRange(item.tier) : (KIND_RANGE[item.def.kind] ?? 115)
            const rangePx = Math.round(baseRange * (buffs?.rangeBonus ?? 1))
            const isLantern = item.def.kind === 'lantern'
            return (
              <circle
                key={slot.id}
                cx={slot.x} cy={slot.y} r={rangePx}
                style={{
                  fill: isLantern ? 'rgba(251,191,36,0.08)' : 'none',
                  stroke: isLantern ? '#fbbf24' : '#646464',
                  strokeOpacity: 0.9,
                  strokeWidth: 3,
                  strokeDasharray: '5 5',
                }}
              />
            )
          })}
        </svg>
        </div>{/* end inner positioning div */}
        {arenaOverlay}
      </div>

      {/* ── Lower section: bench + launch button ── */}
      <div className="deploy-lower">
      <div className="deploy-bench">
        <span className="bench-section-label">{benchLabel}</span>
        <BackpackMiniView
          placedItems={placedItems}
          deployedIds={usedIds}
          draggingId={draggingId}
          onStartDrag={startBenchDrag}
          gridRows={gridRows}
          gridCols={gridCols}
        />
      </div>

      {/* ── Launch button ── */}
      <button
        className={`btn-launch${canLaunch ? '' : ' disabled'}`}
        onClick={canLaunch ? handleLaunch : undefined}
      >
        ⚔ Launch Wave
        {militaryItems.length > 0 && (
          <span className="launch-count"> ({filledCount}/{slots.length})</span>
        )}
      </button>
      </div>{/* end deploy-lower */}

      {/* ── Floating ghost while dragging ── */}
      {drag && createPortal(
        <div
          className="deploy-ghost"
          style={{ left: drag.mouseX - 22, top: drag.mouseY - 22, background: drag.item.def.color }}
        >
          {getItemImage(drag.item)
            ? <img src={getItemImage(drag.item)} alt="" className="slot-tower-img" draggable={false} />
            : <span className="arena-tower-label">{drag.item.def.label.slice(0, 3).toUpperCase()}</span>
          }
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────
function findSlotUnderPoint(cx: number, cy: number): string | null {
  const els = document.querySelectorAll<HTMLElement>('[data-slot-id]')
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom)
      return el.dataset.slotId ?? null
  }
  return null
}
