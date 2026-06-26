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
// Path half-width 26px + frost clearance 62px = 88px min from path center.
// Left safe ≤ x=67; right safe ≥ x=313.
const SLOTS_ZIGZAG: TowerSlot[] = [
  { id: 's1', x: 313, y: 83  },  // right outer — covers top right strip
  { id: 's2', x: 67,  y: 250 },  // left outer — covers middle left strip
  { id: 's3', x: 313, y: 250 },  // right outer — flanks both top & bottom right segments
  { id: 's4', x: 67,  y: 415 },  // left outer — covers bottom-left strip
  { id: 's5', x: 313, y: 415 },  // right outer — covers bottom-right strip
  { id: 's6', x: 67,  y: 83  },  // left outer-top — covers path before first turn
  { id: 's7', x: 313, y: 165 },  // right outer at turn1 — maximises coverage at the bend
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

// Diamond (battle_4.png): center path y<60 and y>430 at x=195; arms at x=45 (left) and x=335 (right) at y=230.
// Center (x=195) is only safe inside the diamond (y=60–430) where it's 150px from each arm.
// Slots s1/s3 moved off center path to outer sides.
const SLOTS_DIAMOND: TowerSlot[] = [
  { id: 's1', x: 60,  y: 30  },  // left outer — above split, flanks the entry path
  { id: 's2', x: 195, y: 245 },  // center inside diamond (150px from each arm)
  { id: 's3', x: 330, y: 460 },  // right outer — below merge, flanks the exit path
  { id: 's4', x: 20,  y: 150 },  // far-left outer, upper arm
  { id: 's5', x: 370, y: 150 },  // far-right outer, upper arm
  { id: 's6', x: 20,  y: 350 },  // far-left outer, lower arm
  { id: 's7', x: 370, y: 350 },  // far-right outer, lower arm
]

// Funnel (battle_5.png): left x=110, right x=280, converge to center (x=195) at y=300–534.
// Above y=300: center (x=195) is 85px from each lane — safe (>62). Below y=300 paths converge, center unsafe.
// s7 replaced with outer-side slot below convergence to avoid the merged lane.
const SLOTS_FUNNEL: TowerSlot[] = [
  { id: 's1', x: 195, y: 80  },  // center-top, between lanes (85px from each — safe)
  { id: 's2', x: 40,  y: 200 },  // left-outer
  { id: 's3', x: 350, y: 200 },  // right-outer
  { id: 's4', x: 40,  y: 430 },  // left-outer, below convergence
  { id: 's5', x: 350, y: 430 },  // right-outer, below convergence
  { id: 's6', x: 195, y: 250 },  // center between lanes — fires into both paths simultaneously (safe above convergence)
  { id: 's7', x: 40,  y: 320 },  // left outer near convergence point — covers merged stream
]

// Extended zigzag (battle_2.png scaled to 750px): LEFT=155, RIGHT=225, turn1 y=248, turn2 y=503.
// Path half-width 26px + frost clearance 62px = 88px min from path center.
// Left safe ≤ x=67; right safe ≥ x=313.
// Turns are horizontal segments: avoid placing slots ON the horizontal strip at turn y-values.
const SLOTS_EXT_ZIGZAG: TowerSlot[] = [
  { id: 's1',  x: 67,  y: 120 },  // left outer — top section
  { id: 's2',  x: 313, y: 120 },  // right outer — covers top right strip
  { id: 's3',  x: 67,  y: 375 },  // left outer — covers middle left segment
  { id: 's4',  x: 313, y: 375 },  // right outer — flanks middle section
  { id: 's5',  x: 67,  y: 503 },  // left outer — at turn2 height
  { id: 's6',  x: 313, y: 503 },  // right outer — at turn2 height
  { id: 's7',  x: 67,  y: 630 },  // left outer — lower section
  { id: 's8',  x: 313, y: 630 },  // right outer — lower section
  { id: 's9',  x: 67,  y: 248 },  // left outer at turn1 — flanks the horizontal bend from outside
  { id: 's10', x: 313, y: 248 },  // right outer at turn1 — flanks the horizontal bend from outside
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
