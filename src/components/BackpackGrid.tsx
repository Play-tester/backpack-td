import { useMemo } from 'react'
import { useDrag } from '../context/DragContext'
import { canPlace, checkMerge, getItemCells, removeItem } from '../lib/grid'
import { getItemImage } from '../lib/items'
import { getSellPrice } from '../lib/shop'
import {
  GRID_COLS, SHAPE_OFFSETS, shapeDims,
  type GridState, type Item, type ItemSize, type PlacedItem,
} from '../types'
import './BackpackGrid.css'

export const CELL_SIZE = 56 // default/reference size in px

/** Bounding-box dims for any shape — exported for Shop & App */
export function getSizeDims(size: ItemSize) { return shapeDims(size) }

type CellHighlight = 'valid' | 'invalid' | 'merge' | 'swap'
type GhostType     = 'valid' | 'invalid' | 'merge' | 'swap'

interface Props {
  grid:             GridState
  placedItems:      Map<string, PlacedItem>
  gridRef:          React.RefObject<HTMLDivElement | null>
  onItemClick?:     (item: Item, viewportX: number, viewportY: number) => void
  onSellItem?:      (itemId: string) => void
  cellSize?:        number
  gridCols?:        number
  unlockedCells?:   number
  highlightInfoBtn?: boolean
  highlightSell?:   boolean
}

export default function BackpackGrid({ grid, placedItems, gridRef, onItemClick, onSellItem, cellSize: cellSizeProp, gridCols: gridColsProp, unlockedCells, highlightInfoBtn, highlightSell }: Props) {
  const { activeDrag, startDrag } = useDrag()
  const CS = cellSizeProp ?? CELL_SIZE
  const cols = gridColsProp ?? GRID_COLS
  const BORDER = 3  // matches .backpack-grid border width (3px)
  const gridRows = grid.length

  // Helper to check if a cell is unlocked
  const isCellUnlocked = (row: number, col: number): boolean => {
    if (!unlockedCells) return true  // If not specified, all cells unlocked
    const cellIndex = row * cols + col
    return cellIndex < unlockedCells
  }

  // ── Snap target ───────────────────────────────────────────────────────────
  const snapTarget = useMemo((): [number, number] | null => {
    if (!activeDrag) return null
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return null
    // Convert viewport coords to game-space coords
    const gameW = cols * CS + BORDER * 2
    const scale = rect.width / gameW
    const lx = (activeDrag.mouseX - rect.left) / scale
    const ly = (activeDrag.mouseY - rect.top)  / scale
    if (lx < 0 || lx > gameW || ly < 0 || ly > grid.length * CS + BORDER * 2) return null

    let row = Math.floor((ly - activeDrag.grabOffsetY) / CS)
    let col = Math.floor((lx - activeDrag.grabOffsetX) / CS)

    // Clamp anchor so the entire item stays within grid bounds
    const offsets = SHAPE_OFFSETS[activeDrag.item.def.size as ItemSize]
    const maxDr = Math.max(...offsets.map(([dr]) => dr))
    const maxDc = Math.max(...offsets.map(([, dc]) => dc))
    row = Math.max(0, Math.min(row, gridRows - 1 - maxDr))
    col = Math.max(0, Math.min(col, cols    - 1 - maxDc))

    // Clamp further so no cell lands on a locked cell
    if (unlockedCells !== undefined) {
      // Push row up until all cells are within unlocked region
      while (row > 0) {
        const cells = offsets.map(([dr, dc]) => [row + dr, col + dc] as [number, number])
        const allUnlocked = cells.every(([r, c]) => r * cols + c < unlockedCells)
        if (allUnlocked) break
        row--
      }
      // Push col left until all cells are within unlocked region
      while (col > 0) {
        const cells = offsets.map(([dr, dc]) => [row + dr, col + dc] as [number, number])
        const allUnlocked = cells.every(([r, c]) => r * cols + c < unlockedCells)
        if (allUnlocked) break
        col--
      }
    }

    return [row, col]
  }, [activeDrag, gridRef, CS, cols, grid.length, gridRows, unlockedCells])

  // ── Drag intent at snap ───────────────────────────────────────────────────
  const dragIntent = useMemo((): GhostType | null => {
    if (!activeDrag || !snapTarget) return null
    const [row, col] = snapTarget
    const excl = activeDrag.source === 'backpack' ? activeDrag.sourceId : undefined
    if (canPlace(grid, activeDrag.item, row, col, excl, unlockedCells)) return 'valid'
    const mid = checkMerge(grid, activeDrag.item, row, col, excl)
    if (mid) {
      const t = placedItems.get(mid)
      if (t && t.item.def.kind === activeDrag.item.def.kind &&
          t.item.tier === activeDrag.item.tier)
        return 'merge'
    }
    // Check swap (backpack→backpack only)
    if (activeDrag.source === 'backpack') {
      const sourcePlaced = placedItems.get(activeDrag.sourceId)
      if (sourcePlaced) {
        const cells = getItemCells(activeDrag.item, row, col)
        const occupants = new Set<string>()
        for (const [r, c] of cells) {
          const id = grid[r]?.[c]
          if (id && id !== activeDrag.sourceId) occupants.add(id)
        }
        if (occupants.size === 1) {
          const otherId = [...occupants][0]
          const otherPlaced = placedItems.get(otherId)
          if (otherPlaced) {
            let g = removeItem(grid, activeDrag.sourceId)
            g = removeItem(g, otherId)
            const aFits = canPlace(g, activeDrag.item, row, col, undefined, unlockedCells)
            const bFits = canPlace(g, otherPlaced.item, sourcePlaced.row, sourcePlaced.col, undefined, unlockedCells)
            if (aFits && bFits) return 'swap'
          }
        }
      }
    }
    return 'invalid'
  }, [activeDrag, snapTarget, grid, placedItems, unlockedCells])

  // ── Cell highlight map ────────────────────────────────────────────────────
  const highlightMap = useMemo((): Map<string, CellHighlight> => {
    if (!activeDrag || !snapTarget || !dragIntent) return new Map()
    const [row, col] = snapTarget
    const map = new Map<string, CellHighlight>()
    for (const [r, c] of getItemCells(activeDrag.item, row, col)) {
      if (r >= 0 && r < grid.length && c >= 0 && c < cols)
        map.set(`${r}-${c}`, dragIntent)
    }
    return map
  }, [activeDrag, snapTarget, dragIntent, grid, cols])

  // ── Start drag from backpack ───────────────────────────────────────────────
  function onItemPointerDown(e: React.PointerEvent, placed: PlacedItem) {
    e.preventDefault()
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    // rect is in viewport (scaled) coords; divide by scale to get game-space coords
    const gameW = cols * CS + BORDER * 2
    const scale = rect.width / gameW
    const localX = (e.clientX - rect.left) / scale
    const localY = (e.clientY - rect.top)  / scale
    startDrag({
      source:      'backpack',
      item:        placed.item,
      sourceId:    placed.item.id,
      grabOffsetX: localX - placed.col * CS,
      grabOffsetY: localY - placed.row * CS,
      mouseX:      e.clientX,
      mouseY:      e.clientY,
    })
  }
  const W = cols * CS + BORDER * 2
  const H = gridRows * CS + BORDER * 2

  return (
    <div ref={gridRef} className="backpack-grid" style={{ width: W, height: H }}>

      {/* ── Cell layer ── */}
      {Array.from({ length: gridRows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const hl = highlightMap.get(`${r}-${c}`)
          const locked = !isCellUnlocked(r, c)
          return (
            <div
              key={`${r}-${c}`}
              className={`grid-cell${hl ? ` cell-${hl}` : ''}${locked ? ' cell-locked' : ''}`}
              style={{ width: CS, height: CS }}
            />
          )
        })
      )}

      {/* ── Placed items ── */}
      {Array.from(placedItems.values()).map(placed =>
        <PlacedItemView
          key={placed.item.id}
          placed={placed}
          isDragging={activeDrag?.source === 'backpack' && activeDrag.sourceId === placed.item.id}
          onPointerDown={onItemPointerDown}
          onClick={onItemClick}
          onSell={onSellItem}
          cellSize={CS}
          highlightInfoBtn={highlightInfoBtn}
          highlightSell={highlightSell}
        />
      )}

      {/* ── Snap ghost ── */}
      {activeDrag && snapTarget && dragIntent && (() => {
        const [snapRow, snapCol] = snapTarget
        const offsets = SHAPE_OFFSETS[activeDrag.item.def.size as ItemSize]
        return offsets.map(([dr, dc]) => (
          <div
            key={`ghost-${dr}-${dc}`}
            className={`ghost-cell ghost-${dragIntent}`}
            style={{
              left:       (snapCol + dc) * CS,
              top:        (snapRow + dr) * CS,
              width:      CS,
              height:     CS,
              background: activeDrag.item.def.color,
            }}
          />
        ))
      })()}
    </div>
  )
}

// ── Placed item rendered as individual shape cells ─────────────────────────
function PlacedItemView({
  placed, isDragging, onPointerDown, onClick, onSell, cellSize, highlightInfoBtn, highlightSell,
}: {
  placed:           PlacedItem
  isDragging:       boolean
  cellSize:         number
  onPointerDown:    (e: React.PointerEvent, placed: PlacedItem) => void
  onClick?:         (item: Item, vx: number, vy: number) => void
  onSell?:          (itemId: string) => void
  highlightInfoBtn?: boolean
  highlightSell?:   boolean
}) {
  const CS = cellSize
  const { item, row, col } = placed
  const offsets        = SHAPE_OFFSETS[item.def.size as ItemSize]
  const { rows, cols } = shapeDims(item.def.size as ItemSize)
  // Tier 1: nothing, Tier 2+: number in bottom-right
  const tierDisplay = item.tier >= 2 ? item.tier.toString() : ''

  return (
    <div
      className={`item-group${isDragging ? ' is-dragging' : ''}`}
      style={{
        left:          col  * CS,
        top:           row  * CS,
        width:         cols * CS,
        height:        rows * CS,
        touchAction:   'none',
        pointerEvents: 'none',
      }}
    >
      {/* One coloured div per shape cell — each captures pointer events independently */}
      {offsets.map(([dr, dc]) => (
        <div
          key={`${dr}-${dc}`}
          className={`item-cell ${item.tier === 2 ? 'tier-2' : item.tier >= 3 ? 'tier-high' : ''}`}
          style={{
            left:          dc * CS + 3,
            top:           dr * CS + 3,
            width:         CS - 6,
            height:        CS - 6,
            pointerEvents: 'auto',
            ...(getItemImage(item) ? { border: 'none', boxShadow: 'none' } : { background: item.def.color }),
          }}
          onPointerDown={e => onPointerDown(e, placed)}
        />
      ))}

      {/* Single image spanning the full bounding box — simpler and correct for all shapes */}
      {getItemImage(item) && (
        <img
          src={getItemImage(item)} alt="" draggable={false}
          style={{
            position:      'absolute',
            inset:         item.def.kind === 'bank'   ? undefined :
                           item.def.kind === 'cannon' ? 0 : 3,
            left:          item.def.kind === 'bank'   ? 3 : undefined,
            bottom:        item.def.kind === 'bank'   ? 3 : undefined,
            width:         item.def.kind === 'bank'   ? '84%' :
                           item.def.kind === 'cannon' ? cols * CS : cols * CS - 6,
            height:        item.def.kind === 'bank'   ? '84%' :
                           item.def.kind === 'cannon' ? rows * CS : rows * CS - 6,
            objectFit:     'contain',
            borderRadius:  5,
            pointerEvents: 'none',
            zIndex:        1,
          }}
        />
      )}

      {/* Label + meta centred in bounding box */}
      <div className="item-label-box">
        {!getItemImage(item) && <span className="item-label">{item.def.label}</span>}
      </div>


      {/* Tier number in bottom-right */}
      {tierDisplay && (
        <span className="item-tier-number">{tierDisplay}</span>
      )}

      {/* Info button */}
      {onClick && (
        <button
          className={`item-info-btn${highlightInfoBtn ? ' item-info-btn--highlight' : ''}`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onClick(item, e.clientX, e.clientY) }}
        >i</button>
      )}

      {/* Sell button */}
      {onSell && (
        <button
          className={`item-sell-btn${highlightSell ? ' item-sell-btn--highlight' : ''}`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onSell(item.id) }}
          title={`Sell for ${getSellPrice(item.def.kind, item.tier)}g`}
        >$</button>
      )}
    </div>
  )
}
