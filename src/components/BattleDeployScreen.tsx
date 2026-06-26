import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BATTLE_H, BATTLE_W, LANE_CX, LANE_W, isZigzagWave, ZIGZAG_WAYPOINTS, TRIPLE_LANE_XS, isTripleLaneWave, DIAMOND_PATH_A, DIAMOND_PATH_B, isDiamondWave, FUNNEL_PATH_A, FUNNEL_PATH_B, isFunnelWave, LONG_BATTLE_H, EXT_ZIGZAG_WAYPOINTS, isExtZigzagWave, isLongWave, type DeployedTower } from '../battle/types'
import { KIND_RANGE } from '../battle/engine'
import { getItemImage } from '../lib/items'
import type { Buffs } from '../lib/levelup'
import { shapeDims, type Item, type ItemSize, type PlacedItem } from '../types'
import BackpackMiniView from './BackpackMiniView'
import './BattleDeployScreen.css'

// ── Predefined slot positions ─────────────────────────────────────────────
interface TowerSlot { id: string; x: number; y: number }

const SLOTS_3: TowerSlot[] = [
  { id: 's1', x: 85,  y: 125 },
  { id: 's2', x: 305, y: 250 },
  { id: 's3', x: 85,  y: 375 },
  { id: 's4', x: 305, y: 125 },  // right-top — symmetrical cover
  { id: 's5', x: 305, y: 375 },  // right-bottom — symmetrical cover
]

const SLOTS_5: TowerSlot[] = [
  { id: 's1', x: 85,  y: 83  },
  { id: 's2', x: 305, y: 167 },
  { id: 's3', x: 85,  y: 250 },
  { id: 's4', x: 305, y: 333 },
  { id: 's5', x: 85,  y: 417 },
  { id: 's6', x: 305, y: 83  },  // right-top — fills symmetry gap
  { id: 's7', x: 85,  y: 333 },  // left lower-mid — fills left-side gap
]

// Zigzag (battle_2.png): LEFT x=155, RIGHT x=225, turn1 y=165, turn2 y=335.
// Left strip x=129–181; right strip x=199–251.
// Safe adjacent positions: x=107 (22px from left strip edge), x=273 (22px from right strip edge).
const SLOTS_ZIGZAG: TowerSlot[] = [
  { id: 's1', x: 273, y: 83  },  // right of right strip — covers top right path
  { id: 's2', x: 107, y: 250 },  // left of left strip — covers middle left path
  { id: 's3', x: 273, y: 250 },  // right of right strip — flanks both top & bottom right segments
  { id: 's4', x: 107, y: 415 },  // left side — covers bottom section from left
  { id: 's5', x: 273, y: 415 },  // right of right strip — covers bottom right path
  { id: 's6', x: 107, y: 83  },  // left-top — covers path before first turn from left
  { id: 's7', x: 273, y: 165 },  // right at turn1 — maximises coverage at the bend
]

// Triple-lane (battle_3.png): lanes at x=80, 195, 310 (width 52). Gaps centered at x=137 and x=253.
const SLOTS_TRIPLELANE: TowerSlot[] = [
  { id: 's1', x: 138, y: 83  },
  { id: 's2', x: 253, y: 83  },
  { id: 's3', x: 138, y: 250 },
  { id: 's4', x: 253, y: 250 },
  { id: 's5', x: 138, y: 417 },
  { id: 's6', x: 253, y: 417 },
  { id: 's7', x: 253, y: 165 },  // right gap — mid-upper, cross-covers centre & right lanes
  { id: 's8', x: 138, y: 335 },  // left gap — mid-lower, cross-covers left & centre lanes
]

// Diamond (battle_4.png): paths measured from image.
// Splits at y≈60, left arm peaks at x≈45 y≈230, right arm at x≈335 y≈230, merges at y≈430.
const SLOTS_DIAMOND: TowerSlot[] = [
  { id: 's1', x: 195, y: 30  },  // center-top (above split)
  { id: 's2', x: 195, y: 250 },  // center inside diamond (between the two arms)
  { id: 's3', x: 195, y: 460 },  // center-bottom (below merge)
  { id: 's4', x: 20,  y: 150 },  // far-left outer, upper arm
  { id: 's5', x: 370, y: 150 },  // far-right outer, upper arm
  { id: 's6', x: 20,  y: 350 },  // far-left outer, lower arm
  { id: 's7', x: 370, y: 350 },  // far-right outer, lower arm
]

// Funnel (battle_5.png): left x=110, right x=280, converge to center at y=300.
const SLOTS_FUNNEL: TowerSlot[] = [
  { id: 's1', x: 195, y: 80  },  // center-top, between lanes
  { id: 's2', x: 40,  y: 200 },  // left-outer
  { id: 's3', x: 350, y: 200 },  // right-outer
  { id: 's4', x: 40,  y: 400 },  // left-outer, below convergence
  { id: 's5', x: 350, y: 400 },  // right-outer, below convergence
  { id: 's6', x: 195, y: 250 },  // center between lanes — fires into both paths simultaneously
  { id: 's7', x: 195, y: 430 },  // center below convergence — dominates the merged lane
]

// Extended zigzag (battle_2.png scaled to 750px): LEFT=155, RIGHT=225, turn1 y=248, turn2 y=503.
// Left strip x=129–181; right strip x=199–251.
// Safe adjacent positions: x=107 (left side) and x=273 (right side).
const SLOTS_EXT_ZIGZAG: TowerSlot[] = [
  { id: 's1', x: 107, y: 120 },  // left side — top section
  { id: 's2', x: 273, y: 120 },  // right side — covers top right strip
  { id: 's3', x: 107, y: 375 },  // left of left strip — covers middle left segment
  { id: 's4', x: 273, y: 375 },  // right of right strip — flanks middle section
  { id: 's5', x: 107, y: 503 },  // left side — at turn2, covers transition
  { id: 's6', x: 273, y: 503 },  // right side — at turn2
  { id: 's7', x: 107, y: 630 },  // left side — covers lower right strip from left
  { id: 's8', x: 273, y: 630 },  // right of right strip — covers bottom section
  { id: 's9', x: 195, y: 248 },  // center at turn1 — covers both strips at the bend
  { id: 's10',x: 195, y: 503 },  // center at turn2 — covers both strips at the bend
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
                  style={{ background: item.def.color, width: slotW, height: slotH }}
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
            const baseRange = KIND_RANGE[item.def.kind] ?? 115
            const rangePx = Math.round(baseRange * (buffs?.rangeBonus ?? 1))
            return (
              <circle
                key={slot.id}
                cx={slot.x} cy={slot.y} r={rangePx}
                style={{ fill: 'none', stroke: '#646464', strokeOpacity: 0.9, strokeWidth: 3, strokeDasharray: '5 5' }}
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
