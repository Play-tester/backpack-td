import {
  GRID_COLS,
  GRID_ROWS,
  SHAPE_OFFSETS,
  type GridState,
  type Item,
  type PlacedItem,
  type ShapeOffset,
} from '../types'

// ── Factory ────────────────────────────────────────────────────────────────
export function createGrid(rows: number = GRID_ROWS, cols: number = GRID_COLS): GridState {
  return Array.from({ length: rows }, () => Array(cols).fill(null))
}

// ── Shape helpers ──────────────────────────────────────────────────────────

/** All absolute [row, col] cells an item occupies when anchored at (anchorRow, anchorCol) */
export function getItemCells(
  item: Item,
  anchorRow: number,
  anchorCol: number,
): ShapeOffset[] {
  return SHAPE_OFFSETS[item.def.size].map(
    ([dr, dc]) => [anchorRow + dr, anchorCol + dc],
  )
}

/** True if every cell is inside the grid bounds */
function inBounds(cells: ShapeOffset[], grid: GridState): boolean {
  const gridRows = grid.length
  const gridCols = grid[0]?.length ?? 0
  return cells.every(
    ([r, c]) => r >= 0 && r < gridRows && c >= 0 && c < gridCols,
  )
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Returns true if the item can be placed at (anchorRow, anchorCol).
 * Pass excludeId to ignore an item already on the grid (e.g. when moving it).
 * Pass unlockedCells to validate against locked cells.
 */
export function canPlace(
  grid: GridState,
  item: Item,
  anchorRow: number,
  anchorCol: number,
  excludeId?: string,
  unlockedCells?: number,
): boolean {
  const cells = getItemCells(item, anchorRow, anchorCol)
  if (!inBounds(cells, grid)) return false

  const gridCols = grid[0]?.length ?? 0

  return cells.every(([r, c]) => {
    // Check if cell is unlocked
    if (unlockedCells !== undefined) {
      const cellIndex = r * gridCols + c
      if (cellIndex >= unlockedCells) return false  // Cell is locked
    }

    const occupant = grid[r][c]
    return occupant === null || occupant === excludeId
  })
}

// ── Mutations (return new grid – no mutation) ──────────────────────────────

/** Place item on grid; throws if placement is invalid */
export function placeItem(
  grid: GridState,
  item: Item,
  anchorRow: number,
  anchorCol: number,
): GridState {
  if (!canPlace(grid, item, anchorRow, anchorCol)) {
    throw new Error(`Cannot place ${item.id} at (${anchorRow}, ${anchorCol})`)
  }
  const next = grid.map(row => [...row])
  for (const [r, c] of getItemCells(item, anchorRow, anchorCol)) {
    next[r][c] = item.id
  }
  return next
}

/** Remove all cells belonging to itemId, return new grid */
export function removeItem(grid: GridState, itemId: string): GridState {
  return grid.map(row => row.map(cell => (cell === itemId ? null : cell)))
}

/** Move an item already on the grid to a new anchor position */
export function moveItem(
  grid: GridState,
  item: Item,
  newRow: number,
  newCol: number,
): GridState {
  const cleared = removeItem(grid, item.id)
  return placeItem(cleared, item, newRow, newCol)
}

// ── Merge detection ────────────────────────────────────────────────────────

/**
 * If all cells the item would occupy are taken by exactly ONE other item,
 * returns that item's id (merge candidate). Otherwise returns null.
 * Pass excludeId to ignore the item being moved (backpack→backpack).
 * Pass unlockedCells to validate against locked cells.
 */
export function checkMerge(
  grid: GridState,
  item: Item,
  anchorRow: number,
  anchorCol: number,
  excludeId?: string,
  unlockedCells?: number,
): string | null {
  const cells = getItemCells(item, anchorRow, anchorCol)
  if (!inBounds(cells, grid)) return null

  const gridCols = grid[0]?.length ?? 0

  // Check all cells are unlocked
  if (unlockedCells !== undefined) {
    for (const [r, c] of cells) {
      const cellIndex = r * gridCols + c
      if (cellIndex >= unlockedCells) return null  // Cell is locked, can't merge
    }
  }

  const occupants = new Set<string>()
  for (const [r, c] of cells) {
    const cell = grid[r][c]
    if (cell === null || cell === excludeId) return null // empty cell → not a merge
    occupants.add(cell)
  }

  if (occupants.size !== 1) return null // overlaps >1 item → not a merge
  return [...occupants][0]
}

// ── Query helpers ──────────────────────────────────────────────────────────

/** Collect all placed items from grid + items map */
export function getPlacedItems(
  _grid: GridState,
  itemsMap: Map<string, PlacedItem>,
): PlacedItem[] {
  return Array.from(itemsMap.values())
}

/** Find the anchor position of an item id on the grid */
export function findAnchor(
  grid: GridState,
  itemId: string,
): [number, number] | null {
  for (let r = 0; r < grid.length; r++) {
    const cols = grid[r]?.length ?? 0
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === itemId) return [r, c]
    }
  }
  return null
}
