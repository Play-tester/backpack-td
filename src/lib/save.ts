// ── Persistence ────────────────────────────────────────────────────────────
// All meaningful run state is serialised to localStorage under SAVE_KEY.
// Transient UI state (popups, drag, phase) is NOT saved.

import { DEFAULT_BUFFS, type Buffs, type BuffGrant } from './levelup'
import { getInitialHeroProgress, type HeroProgressMap } from './heroes'
import { getInitialTutorialState, type TutorialState } from './tutorial'
import { getInitialCraftingState, type CraftingState } from './crafting'
import { createGrid } from './grid'
import { GRID_COLS, GRID_ROWS } from '../types/index'
import { generateReserves } from './reserves'
import type { GridState, PlacedItem } from '../types/index'
import type { ReservesSlot } from './reserves'
import type { SpellKind } from './spells'
import type { BasePerk } from './levelup'

const SAVE_KEY = 'backpacktd_save_v1'

// ── Serialisable snapshot ──────────────────────────────────────────────────
export interface SaveData {
  wave:          number
  gold:          number
  mana:          number
  level:         number
  xp:            number
  baseLevel:     number
  permBuffs:     Buffs
  buffGrants:    BuffGrant[]
  unlockedCells: number
  gridCols:      number
  gridRows:      number
  grid:          GridState
  placedItems:   [string, PlacedItem][]   // Map → array for JSON
  tutorial:      TutorialState
  reservesSlots: ReservesSlot[]
  reservesSize:  number
  rerollCost:    number
  pickedBasePerks: BasePerk[]
  unlockedSpells:  SpellKind[]
  heroProgress:    HeroProgressMap
  musicVolume:     number
  hasSeenShard:    boolean
  hasSeenFrost:    boolean
  wood:            number
  craftingState:   CraftingState
  craftingUnlocked: boolean
  hasSeenShieldIntro: boolean
  hasSeenWarCrowIntro: boolean
  hasSeenDruidIntro: boolean
  hasSeenVillageWoodGift: boolean
}

export function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    // storage full or unavailable — silently ignore
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SaveData>
    // Basic version guard — if required fields are missing, discard save
    if (typeof parsed.wave !== 'number') return null
    return parsed as SaveData
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}

// ── Default fresh-run state ────────────────────────────────────────────────
export function getDefaultSave(startingGold: number, reservesSize: number): SaveData {
  return {
    wave:          1,
    gold:          startingGold,
    mana:          0,
    level:         1,
    xp:            0,
    baseLevel:     1,
    permBuffs:     DEFAULT_BUFFS,
    buffGrants:    [],
    unlockedCells: 9,
    gridCols:      GRID_COLS,
    gridRows:      GRID_ROWS,
    grid:          createGrid(),
    placedItems:   [],
    tutorial:      getInitialTutorialState(),
    reservesSlots: generateReserves(reservesSize, 1),
    reservesSize,
    rerollCost:    1,
    pickedBasePerks: [],
    unlockedSpells:  [],
    heroProgress:    getInitialHeroProgress(),
    musicVolume:     50,
    hasSeenShard:    false,
    hasSeenFrost:    false,
    wood:            0,
    craftingState:   getInitialCraftingState(),
    craftingUnlocked: false,
    hasSeenShieldIntro: false,
    hasSeenWarCrowIntro: false,
    hasSeenDruidIntro:   false,
    hasSeenVillageWoodGift: false,
  }
}

// ── Helpers for Map ↔ array round-trips ───────────────────────────────────
export function placedItemsToArray(map: Map<string, PlacedItem>): [string, PlacedItem][] {
  return Array.from(map.entries())
}

export function arrayToPlacedItems(arr: [string, PlacedItem][]): Map<string, PlacedItem> {
  // Re-hydrate ItemDef references — the parsed JSON loses prototype methods
  // so we only need plain objects, which is all PlacedItem uses.
  return new Map(arr)
}
