import { useDrag } from '../context/DragContext'
import type { ShopSlot } from '../lib/shop'
import { SHAPE_OFFSETS, shapeDims, type Item, type ItemSize } from '../types'
import { CELL_SIZE, getSizeDims } from './BackpackGrid'
import './Shop.css'

const MINI_CELL = 20   // px per mini-grid cell
const MINI_GAP  = 3    // px gap between cells

// ── Mini shape preview ─────────────────────────────────────────────────────
function ShapePreview({ size, color, sold, image }: { size: ItemSize; color: string; sold: boolean; image?: string }) {
  const { rows, cols } = shapeDims(size)
  const offsets = SHAPE_OFFSETS[size]
  const filledSet = new Set(offsets.map(([r, c]) => `${r}-${c}`))

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        className="shape-preview"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${MINI_CELL}px)`,
          gridTemplateRows:    `repeat(${rows}, ${MINI_CELL}px)`,
          gap: MINI_GAP,
        }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const filled = filledSet.has(`${r}-${c}`)
            return (
              <div
                key={`${r}-${c}`}
                className="shape-cell"
                style={{
                  background:  sold || !filled ? 'transparent' : color,
                  borderColor: sold ? '#333' : filled ? color : 'transparent',
                  opacity:     sold ? 0.35 : 1,
                }}
              />
            )
          })
        )}
      </div>
      {image && !sold && (
        <img
          src={image} alt="" draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain', pointerEvents: 'none',
            borderRadius: 3,
          }}
        />
      )}
    </div>
  )
}

// ── Shop ───────────────────────────────────────────────────────────────────
interface Props {
  slots:          ShopSlot[]
  gold:           number
  rerollCost:     number
  onReroll:       () => void
  onSlotClick?:   (item: Item, viewportX: number, viewportY: number) => void
  cellSize?:      number
  disableReroll?: boolean
}

export default function Shop({ slots, gold, rerollCost, onReroll, onSlotClick, cellSize = CELL_SIZE, disableReroll = false }: Props) {
  const { activeDrag, startDrag } = useDrag()

  // Cap at 8 items; wrap to 2 rows when more than 4
  const visibleSlots = slots.slice(0, 8)
  const gridCols     = Math.min(visibleSlots.length, 4)

  function handlePointerDown(e: React.PointerEvent, slot: ShopSlot) {
    e.preventDefault()
    if (slot.sold || gold < slot.cost) return
    const { rows, cols } = getSizeDims(slot.item.def.size as ItemSize)
    startDrag({
      source: 'shop',
      item: slot.item,
      sourceId: slot.id,
      grabOffsetX: (cols * cellSize) / 2,
      grabOffsetY: (rows * cellSize) / 2,
      mouseX: e.clientX,
      mouseY: e.clientY,
    })
  }

  const canReroll = gold >= rerollCost && !disableReroll

  return (
    <div className="shop-inner">
    <div className="shop-slots" style={{ gridTemplateColumns: `repeat(${gridCols}, auto)` }}>
      {visibleSlots.map(slot => {
        const canAfford  = gold >= slot.cost
        const isDragging = activeDrag?.sourceId === slot.id
        return (
          <div
            key={slot.id}
            className={[
              'shop-slot',
              slot.sold               ? 'sold'        : '',
              !canAfford && !slot.sold ? 'cant-afford' : '',
              isDragging              ? 'is-dragging'  : '',
            ].join(' ')}
            onPointerDown={e => handlePointerDown(e, slot)}
            style={{ touchAction: 'none' }}
          >
            {!slot.sold && onSlotClick && (
              <button
                className="slot-info-btn"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onSlotClick(slot.item, e.clientX, e.clientY) }}
              >i</button>
            )}
            {/* ── Shape grid ── */}
            <div className="slot-shape-area">
              {slot.sold
                ? <span className="slot-sold">SOLD</span>
                : <ShapePreview
                    size={slot.item.def.size as ItemSize}
                    color={slot.item.def.color}
                    sold={false}
                    image={slot.item.def.image}
                  />
              }
              {/* Tier number badge */}
              {!slot.sold && slot.item.tier >= 2 && (
                <span className="slot-tier-badge">{slot.item.tier}</span>
              )}
            </div>

            {/* ── Name + cost ── */}
            <span className="slot-name">{slot.item.def.label}</span>
            <span className={`slot-cost ${!canAfford && !slot.sold ? 'too-expensive' : ''}`}>
              {slot.cost}g
            </span>
          </div>
        )
      })}
    </div>

    <button
      className={`btn-reroll${canReroll ? '' : ' disabled'}`}
      onClick={canReroll ? onReroll : undefined}
      disabled={disableReroll}
    >
      ↺ Re-roll <span className="reroll-cost">{rerollCost}g</span>
    </button>
    </div>
  )
}
