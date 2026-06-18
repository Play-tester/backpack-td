import { useDrag } from '../context/DragContext'
import { SHOP_COLS, SHOP_ROWS, type ShopSlot } from '../lib/shop'
import { SHAPE_OFFSETS, shapeDims, type Item, type ItemSize } from '../types'
import { CELL_SIZE, getSizeDims } from './BackpackGrid'
import './Shop.css'

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

const SHOP_CELL = 44   // px per shop grid cell

export default function Shop({ slots, gold, rerollCost, onReroll, onSlotClick, cellSize = CELL_SIZE, disableReroll = false }: Props) {
  const { activeDrag, startDrag } = useDrag()

  // Build a set of occupied cells → slot id, for rendering
  // For each slot, compute the absolute cells it covers
  function slotCells(slot: ShopSlot): string[] {
    const offsets = SHAPE_OFFSETS[slot.item.def.size as ItemSize]
    return offsets.map(([dr, dc]) => `${slot.gridRow + dr}-${slot.gridCol + dc}`)
  }

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

  // Build lookup: cellKey → slot (the slot whose anchor is responsible for that cell)
  const cellToSlot = new Map<string, ShopSlot>()
  slots.forEach(slot => {
    slotCells(slot).forEach(key => cellToSlot.set(key, slot))
  })

  // For each slot, we render one absolutely-positioned item overlay on the grid
  return (
    <div className="shop-inner">
      {/* Grid container */}
      <div
        className="shop-grid"
        style={{
          width:  SHOP_COLS * SHOP_CELL + (SHOP_COLS - 1) * 3,
          height: SHOP_ROWS * SHOP_CELL + (SHOP_ROWS - 1) * 3,
          display: 'grid',
          gridTemplateColumns: `repeat(${SHOP_COLS}, ${SHOP_CELL}px)`,
          gridTemplateRows:    `repeat(${SHOP_ROWS}, ${SHOP_CELL}px)`,
          gap: 3,
          position: 'relative',
        }}
      >
        {/* Empty grid cells */}
        {Array.from({ length: SHOP_ROWS }, (_, r) =>
          Array.from({ length: SHOP_COLS }, (_, c) => {
            const key  = `${r}-${c}`
            const slot = cellToSlot.get(key)
            return (
              <div
                key={key}
                className={`shop-grid-cell${slot && !slot.sold ? ' occupied' : ''}${slot && slot.sold ? ' sold-cell' : ''}`}
              />
            )
          })
        )}

        {/* Item overlays — one per slot, positioned absolutely on the grid */}
        {slots.map(slot => {
          const { rows, cols } = shapeDims(slot.item.def.size as ItemSize)
          const offsets        = SHAPE_OFFSETS[slot.item.def.size as ItemSize]
          const canAfford      = gold >= slot.cost
          const isDragging     = activeDrag?.sourceId === slot.id

          // Pixel position of anchor
          const left = slot.gridCol * (SHOP_CELL + 3)
          const top  = slot.gridRow * (SHOP_CELL + 3)
          // Bounding box size (rows × cols of the shape's bounding rectangle)
          const width  = cols * SHOP_CELL + (cols - 1) * 3
          const height = rows * SHOP_CELL + (rows - 1) * 3

          return (
            <div
              key={slot.id}
              className={[
                'shop-item-overlay',
                slot.sold               ? 'sold'        : '',
                !canAfford && !slot.sold ? 'cant-afford' : '',
                isDragging              ? 'is-dragging'  : '',
              ].join(' ')}
              style={{ left, top, width, height, position: 'absolute' }}
              onPointerDown={e => handlePointerDown(e, slot)}
            >
              {/* Shape cells mask (non-rectangular shapes) */}
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                viewBox={`0 0 ${width} ${height}`}
              >
                {offsets.map(([dr, dc]) => (
                  <rect
                    key={`${dr}-${dc}`}
                    x={dc * (SHOP_CELL + 3)}
                    y={dr * (SHOP_CELL + 3)}
                    width={SHOP_CELL}
                    height={SHOP_CELL}
                    rx={6}
                    fill={slot.sold ? '#c0a878' : slot.item.def.color}
                    opacity={slot.sold ? 0.3 : canAfford ? 0.85 : 0.45}
                  />
                ))}
              </svg>

              {/* Tower image */}
              {slot.item.def.image && !slot.sold && (
                <img
                  src={slot.item.def.image} alt="" draggable={false}
                  style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'contain', pointerEvents: 'none',
                    opacity: canAfford ? 1 : 0.5,
                    padding: 4,
                  }}
                />
              )}

              {/* SOLD label */}
              {slot.sold && (
                <span className="shop-sold-label">SOLD</span>
              )}

              {/* Tier badge */}
              {!slot.sold && slot.item.tier >= 2 && (
                <span className="shop-tier-badge">{slot.item.tier}</span>
              )}

              {/* Cost badge */}
              {!slot.sold && (
                <span className={`shop-cost-badge${!canAfford ? ' too-expensive' : ''}`}>
                  {slot.cost}g
                </span>
              )}

              {/* Info button */}
              {!slot.sold && onSlotClick && (
                <button
                  className="slot-info-btn"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onSlotClick(slot.item, e.clientX, e.clientY) }}
                >i</button>
              )}
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
