import { useEffect, useRef, useState } from 'react'
import { getItemImage } from '../lib/items'
import { GRID_COLS, GRID_ROWS, SHAPE_OFFSETS, shapeDims, type Item, type ItemSize, type PlacedItem } from '../types'

interface Props {
  placedItems:  Map<string, PlacedItem>
  deployedIds?: Set<string>              // dimmed (already on battle map)
  draggingId?:  string
  onStartDrag?: (e: React.PointerEvent, item: Item) => void
  gridRows?:    number                   // Dynamic grid rows (defaults to 3)
  gridCols?:    number                   // Dynamic grid cols (defaults to 2)
}

export default function BackpackMiniView({ placedItems, deployedIds = new Set(), draggingId, onStartDrag, gridRows = GRID_ROWS, gridCols = GRID_COLS }: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [cs, setCs] = useState(50)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const BORDER = 4
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const next = Math.max(20, Math.floor(Math.min(
        (width  - BORDER) / gridCols,
        (height - BORDER) / gridRows,
      )))
      setCs(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [gridRows, gridCols])

  const W = gridCols * cs + 4
  const H = gridRows * cs + 4

  return (
    <div ref={areaRef} className="bench-grid-area">
      <div className="bench-backpack-grid" style={{ width: W, height: H }}>

        {/* Background cells */}
        {Array.from({ length: gridRows }, (_, r) =>
          Array.from({ length: gridCols }, (_, c) => (
            <div key={`${r}-${c}`} className="bench-bg-cell" style={{ width: cs, height: cs }} />
          ))
        )}

        {/* Placed items */}
        {Array.from(placedItems.values()).map(({ item, row, col }) => {
          const isMilitary     = item.def.category === 'military'
          const isDeployed     = deployedIds.has(item.id)
          const isDraggingThis = draggingId === item.id
          const offsets        = SHAPE_OFFSETS[item.def.size as ItemSize]
          const { rows: ir, cols: ic } = shapeDims(item.def.size as ItemSize)
          const draggable = isMilitary && !isDeployed && !!onStartDrag

          return (
            <div
              key={item.id}
              style={{
                position:      'absolute',
                left:          col * cs,
                top:           row * cs,
                width:         ic  * cs,
                height:        ir  * cs,
                opacity:       isDraggingThis ? 0.25 : isDeployed ? 0.45 : 1,
                touchAction:   'none',
                userSelect:    'none',
                pointerEvents: 'none',
              }}
            >
              {offsets.map(([dr, dc]) => (
                <div
                  key={`${dr}-${dc}`}
                  style={{
                    position:      'absolute',
                    left:          dc * cs + 2,
                    top:           dr * cs + 2,
                    width:         cs - 4,
                    height:        cs - 4,
                    borderRadius:  4,
                    border:        isMilitary ? '1.5px solid rgba(255,255,255,0.18)' : 'none',
                    filter:        !isMilitary ? 'grayscale(1) brightness(0.45)' : undefined,
                    cursor:        draggable ? 'grab' : 'default',
                    pointerEvents: 'auto',
                    ...(!getItemImage(item) ? { background: item.def.color } : {}),
                  }}
                  onPointerDown={draggable ? e => onStartDrag!(e, item) : undefined}
                />
              ))}
              {getItemImage(item) && (
                <img
                  src={getItemImage(item)} alt="" draggable={false}
                  style={{
                    position:      'absolute',
                    inset:         2,
                    width:         ic * cs - 4,
                    height:        ir * cs - 4,
                    objectFit:     'contain',
                    borderRadius:  4,
                    pointerEvents: 'none',
                    filter:        !isMilitary ? 'grayscale(1) brightness(0.45)' : undefined,
                    zIndex:        1,
                    // Clip L-shape to its 3 occupied cells, leaving top-right corner empty
                    clipPath:      item.def.size === 'L'
                      ? 'polygon(0% 0%, 50% 0%, 50% 50%, 100% 50%, 100% 100%, 0% 100%)'
                      : undefined,
                  }}
                />
              )}
              {/* Tier number in bottom-right */}
              {item.tier >= 2 && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    fontSize: Math.max(8, cs * 0.18),
                    fontWeight: 800,
                    color: 'rgba(0, 0, 0, 0.75)',
                    background: 'rgba(255, 215, 0, 0.85)',
                    border: '1px solid rgba(0, 0, 0, 0.3)',
                    borderRadius: 2,
                    padding: '1px 3px',
                    lineHeight: 1,
                    textShadow: '0 1px 1px rgba(255, 255, 255, 0.3)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                >
                  {item.tier}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
