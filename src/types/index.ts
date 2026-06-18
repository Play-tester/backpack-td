// ── Item shapes ────────────────────────────────────────────────────────────
// Each shape is a list of [dRow, dCol] offsets from the anchor cell (top-left)
export type ShapeOffset = [row: number, col: number]

export type ItemSize = '1x1' | '1x2' | '2x1' | '2x2' | 'L' | 'rL' | 'Г' | 'T' | 'S' | 'P'

export const SHAPE_OFFSETS: Record<ItemSize, ShapeOffset[]> = {
  //  ■           1 cell
  '1x1': [[0, 0]],
  //  ■ ■         2 cells wide
  '1x2': [[0, 0], [0, 1]],
  //  ■           2 cells tall
  //  ■
  '2x1': [[0, 0], [1, 0]],
  //  ■ ■         4 cells square
  //  ■ ■
  '2x2': [[0, 0], [0, 1], [1, 0], [1, 1]],
  //  ■ .         L-shape, 3 cells (2×2 bounding box)
  //  ■ ■
  'L':   [[0, 0], [1, 0], [1, 1]],
  //  ■ ■         reverse-L, 3 cells (2×2 bounding box)
  //  . ■
  'rL':  [[0, 0], [0, 1], [1, 1]],
  //  ■ ■         Г-shape, 3 cells (2×2 bounding box)
  //  ■ .
  'Г':   [[0, 0], [0, 1], [1, 0]],
  //  ■ ■ ■       T-shape, 4 cells (2×3 bounding box)
  //  . ■ .
  'T':   [[0, 0], [0, 1], [0, 2], [1, 1]],
  //  . ■ ■       S-shape, 4 cells (2×3 bounding box)
  //  ■ ■ .
  'S':   [[0, 1], [0, 2], [1, 0], [1, 1]],
  //  ■ ■ ■       P-shape, 5 cells (2×3 bounding box)
  //  ■ . ■
  'P':   [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2]],
}

/** Bounding box of any shape, computed from its offsets */
export function shapeDims(size: ItemSize): { rows: number; cols: number } {
  const offsets = SHAPE_OFFSETS[size]
  return {
    rows: Math.max(...offsets.map(([r]) => r)) + 1,
    cols: Math.max(...offsets.map(([, c]) => c)) + 1,
  }
}

// ── Item categories & kinds ────────────────────────────────────────────────
export type ItemCategory = 'military' | 'economic' | 'special'

export type ItemKind =
  | 'archer'   // military – fast, single target
  | 'cannon'   // military – slow, splash
  | 'frost'    // military – slow effect
  | 'bank'     // economic – flat gold per round
  | 'shop'     // economic – small, cheap, earns 1 gold per win
  | 'academy'  // special  – 2×2 building, unlocks spells

// ── Static item definition (the "blueprint") ──────────────────────────────
export interface ItemDef {
  kind: ItemKind
  category: ItemCategory
  size: ItemSize
  label: string
  color: string          // CSS color used for rendering
  image?: string         // optional sprite, e.g. '/archer.png'
  tierImages?: string[]  // optional per-tier sprites, index 0 = T1, overrides image when present
  // military stats
  damage?: number
  attackSpeed?: number   // attacks per second
  range?: number
  maxDurability?: number
  maxTier?: number        // optional hard cap on merging (e.g. 7 for archer)
  // economic stats
  goldPerRound?: number
}

// ── Runtime item instance ──────────────────────────────────────────────────
export const MAX_TIER = 3  // Legacy constant - no longer enforced, items can merge infinitely

export interface Item {
  id: string             // unique instance id
  def: ItemDef
  tier: number           // 1 = base, 2+ = merged (no upper limit)
  durability?: number    // current durability (military only)
}

// ── Grid ───────────────────────────────────────────────────────────────────
export const GRID_COLS = 3
export const GRID_ROWS = 3
export const MAX_GRID_COLS = 6
export const MAX_GRID_ROWS = 8

// grid[row][col] = item id occupying that cell, or null
export type GridState = (string | null)[][]

// placed items map: id → { item, anchorRow, anchorCol }
export interface PlacedItem {
  item: Item
  row: number
  col: number
}
