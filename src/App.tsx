import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import { BATTLE_W, BATTLE_H, isZigzagWave, isTripleLaneWave, isDiamondWave, isFunnelWave, isExtZigzagWave } from './battle/types'
import type { BattleResult, DeployedTower } from './battle/types'
import BackpackGrid, { CELL_SIZE } from './components/BackpackGrid'
import BackpackMiniView from './components/BackpackMiniView'
import BattleCanvas from './components/BattleCanvas'
import BattleDeployScreen from './components/BattleDeployScreen'
import LevelUpModal from './components/LevelUpModal'
import Tooltip from './components/Tooltip'
import Reserves from './components/Reserves'
import { type ActiveDrag, DragProvider, useDrag } from './context/DragContext'
import { canPlace, checkMerge, createGrid, getItemCells, moveItem, placeItem, removeItem } from './lib/grid'
import { getItemImage, getScaledGold, mergeItems } from './lib/items'
import {
  INSTANT_UPGRADES, computeBuffs, mergeBuffs, applyBasePerk,
  pickThreeUpgrades, pickThreeBasePerks, manaForNextLevel, xpForNextBaseLevel,
  DEFAULT_BUFFS,
  type BuffGrant, type Buffs, type Upgrade, type BasePerk,
} from './lib/levelup'
import { generateReserves, getSellPrice, type ReservesSlot } from './lib/reserves'
import { GRID_COLS, GRID_ROWS, MAX_GRID_COLS, MAX_GRID_ROWS, SHAPE_OFFSETS, type GridState, type Item, type ItemSize, type PlacedItem } from './types'
import { getInitialTutorialState, getStepConfig, type TutorialState } from './lib/tutorial'
import TutorialOverlay from './components/TutorialOverlay'
import NarrativeScreen, { type NarrativeSlide } from './components/NarrativeScreen'
import World1CompleteScreen from './components/World1CompleteScreen'
import WorldMapScreen from './components/WorldMapScreen'
import BottomNav, { type Tab } from './components/BottomNav'
import BaseScreen from './components/BaseScreen'
import AcademyScreen from './components/AcademyScreen'
import { SPELL_DEFS, type SpellKind } from './lib/spells'
import { HERO_DEFS, getInitialHeroProgress, hasAnyShards, awardShards, pickShardDrop, type HeroKind, type HeroProgressMap } from './lib/heroes'
import HeroesScreen from './components/HeroesScreen'
import { saveGame, loadGame, clearSave, placedItemsToArray, arrayToPlacedItems, type SaveData } from './lib/save'
import { CRAFTING_UPGRADES, getInitialCraftingState, isBallistaUnlocked, isLanternUnlocked, type CraftingState } from './lib/crafting'
import ShieldBearerIntroScreen from './components/ShieldBearerIntroScreen'
import WarCrowIntroScreen from './components/WarCrowIntroScreen'
import FallenDruidIntroScreen from './components/FallenDruidIntroScreen'
import CraftingScreen from './components/CraftingScreen'
import GameShop from './components/GameShop'

// ── Local types ────────────────────────────────────────────────────────────
type GamePhase = 'narrative' | 'trade' | 'battle-prep' | 'battle' | 'world1-complete' | 'world-map' | 'world2-narrative'

const WORLD2_SLIDES: NarrativeSlide[] = [
  {
    image: '/narrative_world2_1.png',
    lines: [
      'The Viking tribes have united.',
      'Under one banner, one purpose — defend what was won.',
    ],
  },
  {
    image: '/narrative_world2_2.png',
    lines: [
      'But across the hills, the Celtic Kingdom stirs.',
      'Their warriors are already at the gate.',
    ],
  },
]

interface RoundResult {
  won: boolean
  kills: number; escaped: number
  killGold: number; baseGold: number; ecoGold: number
  manaEarned: number; xpEarned: number; brokenLabels: string[]
  showTutorialHints?: boolean
  shardDrop?: HeroKind   // set when a shard was awarded this wave
  shardCount?: number
  woodEarned?: number
}

interface PendingLevelUp {
  toLevel: number
  choices: ReturnType<typeof pickThreeUpgrades>
}

interface PendingBaseLevel {
  toLevel: number
  choices: ReturnType<typeof pickThreeBasePerks>
}

const BASE_INCOME   = 3
const STARTING_GOLD = 20
const BASE_GRID_CELLS = 9  // 3×3 starting grid

// ── Feature flags ──────────────────────────────────────────────────────────
const CASTLE_BUFFS_ENABLED = false  // Temporary: mana bar + castle level-up buffs disabled

// Calculate optimal grid dimensions for a given cell count
function calculateGridDimensions(totalCells: number): { cols: number; rows: number } {
  const cappedCells = Math.min(totalCells, MAX_GRID_COLS * MAX_GRID_ROWS)

  // Start from base dimensions
  let cols = GRID_COLS
  let rows = GRID_ROWS

  // Expand to fit cells, prioritizing balanced growth
  while (cols * rows < cappedCells) {
    // Expand columns first if we haven't hit the max
    if (cols < MAX_GRID_COLS && (cols <= rows || rows >= MAX_GRID_ROWS)) {
      cols++
    } else if (rows < MAX_GRID_ROWS) {
      rows++
    } else {
      break  // Hit max dimensions
    }
  }

  return { cols, rows }
}


// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Load save once at boot ─────────────────────────────────────────────────
  const savedGame = loadGame()

  const [phase, setPhase]             = useState<GamePhase>(savedGame ? 'trade' : 'narrative')
  const [gold, setGold]               = useState(savedGame?.gold          ?? STARTING_GOLD)
  const [mana, setMana]               = useState(savedGame?.mana          ?? 0)
  const [level, setLevel]             = useState(savedGame?.level         ?? 1)
  const [xp, setXp]                   = useState(savedGame?.xp            ?? 0)
  const [baseLevel, setBaseLevel]     = useState(savedGame?.baseLevel     ?? 1)
  const [permBuffs, setPermBuffs]     = useState<Buffs>(savedGame?.permBuffs     ?? DEFAULT_BUFFS)
  const [buffGrants, setBuffGrants]   = useState<BuffGrant[]>(savedGame?.buffGrants ?? [])
  const [pendingBaseLevel, setPendingBaseLevel] = useState<PendingBaseLevel | null>(null)
  const [unlockedCells, setUnlockedCells] = useState(savedGame?.unlockedCells ?? BASE_GRID_CELLS)
  const [gridCols, setGridCols]       = useState(savedGame?.gridCols      ?? GRID_COLS)
  const [gridRows, setGridRows]       = useState(savedGame?.gridRows      ?? GRID_ROWS)
  const [grid, setGrid]               = useState<GridState>(savedGame?.grid ?? createGrid())
  const [placedItems, setPlacedItems] = useState<Map<string, PlacedItem>>(
    savedGame ? arrayToPlacedItems(savedGame.placedItems) : new Map()
  )
  const [tutorial, setTutorial]       = useState<TutorialState>(savedGame?.tutorial ?? getInitialTutorialState())
  const tutorialConfig = getStepConfig(tutorial.currentStep)
  const [reservesSlots, setReservesSlots]     = useState(() =>
    savedGame?.reservesSlots ?? generateReserves(3, 1, tutorialConfig?.forceShopItems)
  )
  const [reservesSize, setReservesSize]       = useState(savedGame?.reservesSize      ?? 3)
  const [rerollCost, setRerollCost]   = useState(savedGame?.rerollCost    ?? 1)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [showResultPopup, setShowResultPopup] = useState(false)
  const [pendingLvlUp, setPendingLvlUp] = useState<PendingLevelUp | null>(null)
  const [deployedTowers, setDeployedTowers] = useState<DeployedTower[]>([])
  const [hasDeployedInPrep, setHasDeployedInPrep] = useState(false)
  const [wave, setWave]               = useState(savedGame?.wave          ?? 1)
  const [activeTab, setActiveTab]     = useState<Tab>('battle')
  const [pickedBasePerks, setPickedBasePerks] = useState<BasePerk[]>(savedGame?.pickedBasePerks ?? [])
  const [unlockedSpells, setUnlockedSpells]   = useState<SpellKind[]>(savedGame?.unlockedSpells ?? [])
  const [showSellHint, setShowSellHint]       = useState(false)
  const [heroProgress, setHeroProgress]       = useState<HeroProgressMap>(savedGame?.heroProgress ?? getInitialHeroProgress())
  const [selectedHero, setSelectedHero]       = useState<HeroKind | null>(null)
  const [heroMenuOpen, setHeroMenuOpen]       = useState(false)
  const [showFrostHint, setShowFrostHint]     = useState(false)
  const [showShardHint, setShowShardHint]     = useState(false)
  const [showHeroesTabHint, setShowHeroesTabHint] = useState(false)
  const hasSeenShard = useRef(savedGame?.hasSeenShard ?? false)
  const hasSeenFrost = useRef(savedGame?.hasSeenFrost ?? false)
  // Show World 1 complete screen only once — when the player first beats wave 10
  const hasSeenWorld1Complete = useRef(savedGame ? (savedGame.wave > 10) : false)
  const buffs = mergeBuffs(permBuffs, computeBuffs(buffGrants))
  const hasAcademy = [...placedItems.values()].some(p => p.item.def.kind === 'academy')

  // ── Crafting state ─────────────────────────────────────────────────────────
  const [wood, setWood]                             = useState(savedGame?.wood ?? 0)
  const [runes, setRunes]                           = useState(savedGame?.runes ?? 0)
  const [showGameShop, setShowGameShop]             = useState(false)
  const [craftingState, setCraftingState]           = useState<CraftingState>(savedGame?.craftingState ?? getInitialCraftingState())
  const [craftingUnlocked, setCraftingUnlocked]     = useState(savedGame?.craftingUnlocked ?? false)
  const [showShieldIntro, setShowShieldIntro]       = useState(false)
  const [showWarCrowIntro, setShowWarCrowIntro]     = useState(false)
  const [showDruidIntro, setShowDruidIntro]         = useState(false)
  const [showVillageGift, setShowVillageGift]       = useState(false)
  const pendingShieldIntro  = useRef(false)
  const pendingWarCrowIntro  = useRef(false)
  const pendingDruidIntro    = useRef(false)
  const hasSeenShieldIntro   = useRef(savedGame?.hasSeenShieldIntro  ?? false)
  const hasSeenWarCrowIntro  = useRef(savedGame?.hasSeenWarCrowIntro ?? false)
  const hasSeenDruidIntro    = useRef(savedGame?.hasSeenDruidIntro   ?? false)
  const hasSeenVillageGift  = useRef(savedGame?.hasSeenVillageWoodGift ?? false)

  // ── Background music ───────────────────────────────────────────────────────
  const audioRef       = useRef<HTMLAudioElement | null>(null)  // main / explore music
  const battleAudioRef = useRef<HTMLAudioElement | null>(null)  // battle music
  const [musicVolume, setMusicVolume] = useState(savedGame?.musicVolume ?? 50)

  // ── Auto-save whenever persistent state changes ────────────────────────────
  useEffect(() => {
    const data: SaveData = {
      wave, gold, mana, level, xp, baseLevel,
      permBuffs, buffGrants,
      unlockedCells, gridCols, gridRows,
      grid,
      placedItems: placedItemsToArray(placedItems),
      tutorial,
      reservesSlots, reservesSize, rerollCost,
      pickedBasePerks, unlockedSpells,
      heroProgress,
      musicVolume,
      hasSeenShard: hasSeenShard.current,
      hasSeenFrost: hasSeenFrost.current,
      wood,
      runes,
      craftingState,
      craftingUnlocked,
      hasSeenShieldIntro: hasSeenShieldIntro.current,
      hasSeenWarCrowIntro: hasSeenWarCrowIntro.current,
      hasSeenDruidIntro:   hasSeenDruidIntro.current,
      hasSeenVillageWoodGift: hasSeenVillageGift.current,
    }
    saveGame(data)
  }, [wave, gold, mana, level, xp, baseLevel,
      permBuffs, buffGrants,
      unlockedCells, gridCols, gridRows,
      grid, placedItems,
      tutorial,
      reservesSlots, reservesSize, rerollCost,
      pickedBasePerks, unlockedSpells,
      heroProgress,
      musicVolume,
      wood, craftingState, craftingUnlocked,
  ])

  // Init both audio tracks once
  useEffect(() => {
    const main   = new Audio('/music.mp3')
    const battle = new Audio('/battle_music.mp3')
    main.loop   = true;  main.volume   = 0.5
    battle.loop = true;  battle.volume = 0.5
    audioRef.current       = main
    battleAudioRef.current = battle
    main.play().catch(() => {
      // Autoplay blocked — resume on first user interaction
      const resume = () => { main.play(); document.removeEventListener('pointerdown', resume) }
      document.addEventListener('pointerdown', resume)
    })
    return () => {
      main.pause();   main.src   = ''
      battle.pause(); battle.src = ''
    }
  }, [])

  // Swap tracks when entering / leaving battle phase
  useEffect(() => {
    const main   = audioRef.current
    const battle = battleAudioRef.current
    if (!main || !battle) return
    if (phase === 'battle') {
      main.pause()
      const dur = battle.duration
      battle.currentTime = dur && isFinite(dur) ? Math.random() * dur : 0
      battle.play().catch(() => {})
    } else {
      battle.pause()
      main.play().catch(() => {})
    }
  }, [phase])

  // Keep volume in sync across both tracks
  useEffect(() => {
    const vol = musicVolume / 100
    if (audioRef.current)       audioRef.current.volume       = vol
    if (battleAudioRef.current) battleAudioRef.current.volume = vol
  }, [musicVolume])

  // Pause music when tab/app is hidden (phone locked, switched app, etc.)
  useEffect(() => {
    function onVisibilityChange() {
      const main   = audioRef.current
      const battle = battleAudioRef.current
      if (document.hidden) {
        main?.pause()
        battle?.pause()
      } else {
        // Resume whichever track should be playing
        if (phase === 'battle') battle?.play().catch(() => {})
        else                    main?.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [phase])

  const [cellSize, setCellSize] = useState(CELL_SIZE)
  const cellSizeRef = useRef(CELL_SIZE)
  cellSizeRef.current = cellSize
  const gridColsRef = useRef(GRID_COLS)
  gridColsRef.current = gridCols
  const gridRef = useRef<HTMLDivElement>(null)

  // ── Drop handler ───────────────────────────────────────────────────────────
  const handleDrop = useCallback((drag: ActiveDrag, mouseX: number, mouseY: number) => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    // rect is in viewport (scaled) coords; divide by scale to get game-space coords
    const CS = cellSizeRef.current
    const gameW = gridColsRef.current * CS + 4  // 4 = BORDER * 2
    const scale = rect.width / gameW
    const localX = (mouseX - rect.left) / scale
    const localY = (mouseY - rect.top)  / scale
    if (mouseX < rect.left || mouseX > rect.right || mouseY < rect.top || mouseY > rect.bottom) return

    const snapCol   = Math.floor((localX - drag.grabOffsetX) / CS)
    const snapRow   = Math.floor((localY - drag.grabOffsetY) / CS)
    const excludeId = drag.source === 'backpack' ? drag.sourceId : undefined

    // Merge? (disabled during tutorial)
    if (!tutorialConfig || tutorialConfig.allowMerge) {
      const mergeId = checkMerge(grid, drag.item, snapRow, snapCol, excludeId, unlockedCells)
      if (mergeId) {
        const target = placedItems.get(mergeId)
        if (target && target.item.def.kind === drag.item.def.kind &&
            target.item.tier === drag.item.tier &&
            drag.item.def.kind !== 'academy') {
          const merged = mergeItems(drag.item, target.item)
          if (!merged) return
          let g = removeItem(grid, mergeId)
          if (excludeId) g = removeItem(g, excludeId)
          g = placeItem(g, merged, target.row, target.col)
          const p = new Map(placedItems)
          p.delete(mergeId); if (excludeId) p.delete(excludeId)
          p.set(merged.id, { item: merged, row: target.row, col: target.col })
          setGrid(g); setPlacedItems(p)
          if (drag.source === 'reserves') {
            const slot = reservesSlots.find(s => s.id === drag.sourceId)
            if (slot && !slot.sold && gold >= slot.cost) {
              setReservesSlots(prev => prev.map(s => s.id === slot.id ? { ...s, sold: true } : s))
              setGold(v => v - slot.cost)
            }
          }

          // Tutorial: advance from merge_and_expand to introduce_economy after merge
          if (tutorial.active && tutorial.currentStep === 'merge_and_expand') {
            setTutorial({ active: true, currentStep: 'introduce_economy' })
          }

          return
        }
      }
    }

    // Normal move / buy
    if (drag.source === 'backpack') {
      const placed = placedItems.get(drag.sourceId)
      if (!placed) return
      if (canPlace(grid, placed.item, snapRow, snapCol, drag.sourceId, unlockedCells)) {
        try {
          const g = moveItem(grid, placed.item, snapRow, snapCol)
          const p = new Map(placedItems)
          p.set(drag.sourceId, { item: placed.item, row: snapRow, col: snapCol })
          setGrid(g); setPlacedItems(p)
        } catch { /* invalid */ }
      } else {
        // Try swap: target cells must be occupied by exactly one other item,
        // and both items must fit in each other's old positions.
        const cells = getItemCells(placed.item, snapRow, snapCol)
        const occupants = new Set<string>()
        for (const [r, c] of cells) {
          const id = grid[r]?.[c]
          if (id && id !== drag.sourceId) occupants.add(id)
        }
        if (occupants.size === 1) {
          const otherId = [...occupants][0]
          const otherPlaced = placedItems.get(otherId)
          if (otherPlaced) {
            let g = removeItem(grid, drag.sourceId)
            g = removeItem(g, otherId)
            if (
              canPlace(g, placed.item, snapRow, snapCol, undefined, unlockedCells) &&
              canPlace(g, otherPlaced.item, placed.row, placed.col, undefined, unlockedCells)
            ) {
              g = placeItem(g, placed.item, snapRow, snapCol)
              g = placeItem(g, otherPlaced.item, placed.row, placed.col)
              const p = new Map(placedItems)
              p.set(drag.sourceId, { item: placed.item, row: snapRow, col: snapCol })
              p.set(otherId, { item: otherPlaced.item, row: placed.row, col: placed.col })
              setGrid(g); setPlacedItems(p)
            }
          }
        }
      }
    } else {
      const slot = reservesSlots.find(s => s.id === drag.sourceId)
      if (!slot || slot.sold || gold < slot.cost) return
      if (!canPlace(grid, drag.item, snapRow, snapCol, undefined, unlockedCells)) return
      try {
        const g = placeItem(grid, drag.item, snapRow, snapCol)
        const p = new Map(placedItems)
        p.set(drag.item.id, { item: drag.item, row: snapRow, col: snapCol })
        setGrid(g); setPlacedItems(p)
        setReservesSlots(prev => prev.map(s => s.id === slot.id ? { ...s, sold: true } : s))
        setGold(v => v - slot.cost)

        // Tutorial: advance when player places item from shop
        if (tutorial.active && tutorial.currentStep === 'place_and_buy') {
          setTutorial({ active: true, currentStep: 'deploy_and_watch' })
        }
        // Tutorial: advance to info-icon step when player places market item during introduce_shop
        if (tutorial.active && tutorial.currentStep === 'introduce_shop' && drag.item.def.kind === 'market') {
          setTutorial({ active: true, currentStep: 'introduce_info_icon' })
        }
      } catch { /* invalid */ }
    }
  }, [grid, placedItems, reservesSlots, gold, tutorial])

  // ── Battle end ─────────────────────────────────────────────────────────────
  function handleBattleEnd(result: BattleResult) {
    const won = result.escaped <= 1

    // 1. No durability system — towers don't break
    const newPlaced = new Map(placedItems)
    const newGrid   = grid
    const brokenLabels: string[] = []

    setGrid(newGrid)
    setPlacedItems(newPlaced)

    // 2. Gold income — only full rewards on a win, but always at least 1 gold
    let ecoGold  = 0
    let baseGold = 0
    const ecoMult = won ? 1 : 0.5
    baseGold = won ? BASE_INCOME + buffs.extraBaseIncome : 1
    const bankCount = [...placedItems.values()].filter(p => p.item.def.kind === 'bank').length
    const bankAura = 1 + bankCount * 0.1
    for (const { item } of placedItems.values()) {
      if (item.def.category === 'economic') {
        const aura = item.def.kind === 'bank' ? 1 : bankAura
        ecoGold += Math.round(getScaledGold(item) * buffs.ecoBonus * ecoMult * aura)
      }
    }
    const killGold = Math.round(result.goldEarned * buffs.killGoldBonus)
    const totalGoldEarned = Math.max(1, killGold + ecoGold + baseGold)
    setGold(g => g + totalGoldEarned)

    // 3. Mana → castle support (temporary buffs, reduced by 50% on loss)
    //    CASTLE_BUFFS_ENABLED = false: skip mana gain and castle level-ups entirely
    const gainedMana = CASTLE_BUFFS_ENABLED
      ? (won ? result.manaEarned : Math.floor(result.manaEarned * 0.5))
      : 0
    let newMana  = CASTLE_BUFFS_ENABLED ? mana + gainedMana : mana
    let newLevel = level

    if (CASTLE_BUFFS_ENABLED) {
      while (newMana >= manaForNextLevel(newLevel)) {
        newMana -= manaForNextLevel(newLevel)
        newLevel++
      }
      setMana(newMana)
      if (newLevel > level) {
        setLevel(newLevel)
        setPendingLvlUp({ toLevel: newLevel, choices: pickThreeUpgrades() })
      }
    }

    // 4. XP → base level up (permanent buffs, reduced by 50% on loss)
    const gainedXp = won ? result.xpEarned : Math.floor(result.xpEarned * 0.5)
    let newXp       = xp + gainedXp
    let newBaseLevel = baseLevel

    while (newXp >= xpForNextBaseLevel(newBaseLevel)) {
      newXp -= xpForNextBaseLevel(newBaseLevel)
      newBaseLevel++
    }
    setXp(newXp)

    if (newBaseLevel > baseLevel) {
      setBaseLevel(newBaseLevel)
      const isGridMaxed = gridCols >= MAX_GRID_COLS && gridRows >= MAX_GRID_ROWS
      const isReservesMaxed = reservesSize >= 6
      setPendingBaseLevel({ toLevel: newBaseLevel, choices: pickThreeBasePerks(newBaseLevel, isGridMaxed, isReservesMaxed) })
    }

    // 4. Tick down temporary buff grants (regardless of win/loss)
    if (CASTLE_BUFFS_ENABLED) {
      setBuffGrants(prev =>
        prev.map(g => ({ ...g, wavesLeft: g.wavesLeft - 1 })).filter(g => g.wavesLeft > 0)
      )
    }

    // 5. Popup result; shop + wave only advance on a win
    // Adjust gold values if total was less than 1 (guaranteed minimum)
    const unadjustedTotal = result.goldEarned + ecoGold + baseGold
    let displayKillGold = result.goldEarned
    let displayBaseGold = baseGold
    let displayEcoGold = ecoGold
    if (unadjustedTotal < 1) {
      // Distribute the minimum 1 gold to killGold for display
      displayKillGold = 1
      displayBaseGold = 0
      displayEcoGold = 0
    }

    // Tutorial: check if we need to show tutorial hints BEFORE completing
    const showTutorialHints = tutorial.active && tutorial.currentStep === 'deploy_and_watch'

    // Award shards only from wave 5 onward
    let shardDrop: HeroKind | undefined
    let shardCount: number | undefined
    if (won && wave >= 5 && !tutorial.active) {
      shardCount = wave === 5 ? 1 : (Math.random() < 0.5 ? 1 : 2)
      shardDrop = pickShardDrop(heroProgress)
      setHeroProgress(prev => awardShards(prev, shardDrop!, shardCount!))
      // First-ever shard — show the tutorial hint
      if (!hasSeenShard.current) {
        hasSeenShard.current = true
        setShowShardHint(true)
      }
    }

    // 6. Wood earning — 2 wood per win from wave 11+
    let woodEarned = 0
    if (won && wave >= 11) {
      woodEarned = 2
      setWood(w => w + woodEarned)
    }
    // First time player plays wave 11 (win or lose) — unlock crafting and queue shield intro
    if (wave === 11 && !hasSeenShieldIntro.current) {
      hasSeenShieldIntro.current = true
      setCraftingUnlocked(true)
      pendingShieldIntro.current = true
    }
    // First time player plays wave 13 (win or lose) — queue War Crow intro
    if (wave === 13 && !hasSeenWarCrowIntro.current) {
      hasSeenWarCrowIntro.current = true
      pendingWarCrowIntro.current = true
    }
    // First time player plays wave 17 (win or lose) — queue Fallen Druid intro
    if (wave === 17 && !hasSeenDruidIntro.current) {
      hasSeenDruidIntro.current = true
      pendingDruidIntro.current = true
    }

    const rr: RoundResult = { won, kills: result.kills, escaped: result.escaped,
      killGold: displayKillGold, baseGold: displayBaseGold, ecoGold: displayEcoGold,
      manaEarned: gainedMana, xpEarned: gainedXp, brokenLabels, showTutorialHints, shardDrop, shardCount,
      woodEarned }
    setRoundResult(rr)
    setShowResultPopup(true)

    // Tutorial: advance tutorial step after battle
    let nextTutorialStep = tutorial.currentStep
    if (showTutorialHints) {
      nextTutorialStep = 'merge_and_expand'
      setTutorial({ active: true, currentStep: 'merge_and_expand' })
    } else if (tutorial.active && tutorial.currentStep === 'introduce_economy' && won) {
      nextTutorialStep = 'introduce_shop'
      setTutorial({ active: true, currentStep: 'introduce_shop' })
    } else if (tutorial.active && tutorial.currentStep === 'introduce_info_icon' && won) {
      nextTutorialStep = 'complete'
      setTutorial({ active: false, currentStep: 'complete' })
    }

    const nextWave = won ? wave + 1 : wave
    const nextTutorialConfig = getStepConfig(nextTutorialStep)
    const shopForceItems = (!won && wave === 2) ? ['frost', 'frost', 'frost', 'frost'] : nextTutorialConfig?.forceShopItems
    const newSlots = generateReserves(reservesSize, nextWave, shopForceItems, isBallistaUnlocked(craftingState), isLanternUnlocked(craftingState))
    setReservesSlots(newSlots)
    setRerollCost(1)
    if (won) setWave(nextWave)
    if (won && wave === 5) setShowSellHint(true)
    if (!hasSeenFrost.current && newSlots.some(s => s.item.def.kind === 'frost')) {
      hasSeenFrost.current = true
      setShowFrostHint(true)
    }
    // phase stays 'battle' until player dismisses popup
  }

  function handleResultContinue() {
    setShowResultPopup(false)
    // Show shield bearer intro before going to trade (only first time)
    if (pendingShieldIntro.current) {
      pendingShieldIntro.current = false
      setShowShieldIntro(true)
      return
    }
    // Show War Crow intro before going to trade (only first time)
    if (pendingWarCrowIntro.current) {
      pendingWarCrowIntro.current = false
      setShowWarCrowIntro(true)
      return
    }
    // Show Fallen Druid intro before going to trade (only first time)
    if (pendingDruidIntro.current) {
      pendingDruidIntro.current = false
      setShowDruidIntro(true)
      return
    }
    // Wave 10 win = World 1 complete — show screen only the first time
    if (wave > 10 && !hasSeenWorld1Complete.current) {
      hasSeenWorld1Complete.current = true
      setPhase('world1-complete')
    } else {
      setPhase('trade')
    }
  }

  function handleShieldIntroClose() {
    setShowShieldIntro(false)
    // Give village gift wood (9 pieces, first open of crafting)
    if (!hasSeenVillageGift.current) {
      setWood(w => w + 9)
      hasSeenVillageGift.current = true
      setShowVillageGift(true)
    }
    setActiveTab('crafting')
    setPhase('trade')
  }

  function handleWarCrowIntroClose() {
    setShowWarCrowIntro(false)
    setActiveTab('crafting')
    setPhase('trade')
  }

  function handleDruidIntroClose() {
    setShowDruidIntro(false)
    setActiveTab('crafting')
    setPhase('trade')
  }

  // ── Crafting upgrade ───────────────────────────────────────────────────────
  function handleCraftingUpgrade(upgradeId: string) {
    const upg = CRAFTING_UPGRADES[upgradeId as keyof typeof CRAFTING_UPGRADES]
    if (!upg) return
    const level = craftingState[upgradeId] ?? 0
    if (level >= upg.maxLevel) return
    const costGold = upg.costGold(level)
    const costMats = upg.costMats(level)
    const woodCost = costMats.wood ?? 0
    if (gold < costGold || wood < woodCost) return
    setGold(g => g - costGold)
    setWood(w => w - woodCost)
    const newCraftingState = { ...craftingState, [upgradeId]: level + 1 }
    setCraftingState(newCraftingState)
    // Refresh shop immediately when a tower unlock is researched so it can appear
    const justUnlockedBallista = upgradeId === 'ballista_research' && wave >= 13
    const justUnlockedLantern  = upgradeId === 'lantern_research'  && wave >= 17
    if (justUnlockedBallista || justUnlockedLantern) {
      setReservesSlots(generateReserves(reservesSize, wave, undefined,
        isBallistaUnlocked(newCraftingState),
        isLanternUnlocked(newCraftingState),
      ))
    }
  }

  // ── Re-roll shop ──────────────────────────────────────────────────────────
  function handleReroll() {
    // Disabled during tutorial
    if (tutorialConfig && !tutorialConfig.allowReroll) return
    if (gold < rerollCost) return
    setGold(g => g - rerollCost)
    setRerollCost(c => Math.ceil(c * 1.5))
    const rerolledSlots = generateReserves(reservesSize, wave, tutorialConfig?.forceShopItems, isBallistaUnlocked(craftingState), isLanternUnlocked(craftingState))
    setReservesSlots(rerolledSlots)
    if (!hasSeenFrost.current && rerolledSlots.some(s => s.item.def.kind === 'frost')) {
      hasSeenFrost.current = true
      setShowFrostHint(true)
    }
  }

  // ── Sell item back ─────────────────────────────────────────────────────────
  function handleSellItem(itemId: string) {
    const placed = placedItems.get(itemId)
    if (!placed) return
    const sellPrice = getSellPrice(placed.item.def.kind, placed.item.tier)
    const newGrid = removeItem(grid, itemId)
    const newPlaced = new Map(placedItems)
    newPlaced.delete(itemId)
    setGrid(newGrid)
    setPlacedItems(newPlaced)
    setGold(g => g + sellPrice)
  }

  // ── Apply upgrade ─────────────────────────────────────────────────────────
  function applyUpgrade(upgrade: Upgrade) {
    if (INSTANT_UPGRADES.has(upgrade.kind)) {
      // One-time effects
      if (upgrade.kind === 'gold_now') setGold(g => g + 15)
    } else {
      // Temporary buff — lasts 3 waves
      setBuffGrants(prev => [...prev, { upgrade, wavesLeft: 3 }])
    }

    setPendingLvlUp(null)
  }

  // ── Unlock spell in Academy ───────────────────────────────────────────────
  function handleUnlockSpell(kind: SpellKind) {
    const def = SPELL_DEFS[kind]
    if (gold < def.unlockCost || unlockedSpells.includes(kind)) return
    setGold(g => g - def.unlockCost)
    setUnlockedSpells(prev => [...prev, kind])
  }

  // ── Apply base perk (permanent) ───────────────────────────────────────────
  function applyBasePerkChoice(perk: BasePerk) {
    setPickedBasePerks(prev => [...prev, perk])

    if (perk.kind === 'expand_shop') {
      const newSize = reservesSize + 1
      setReservesSize(newSize)
      const expandedSlots = generateReserves(newSize, wave, tutorialConfig?.forceShopItems, isBallistaUnlocked(craftingState), isLanternUnlocked(craftingState))
      setReservesSlots(expandedSlots)
      if (!hasSeenFrost.current && expandedSlots.some(s => s.item.def.kind === 'frost')) {
        hasSeenFrost.current = true
        setShowFrostHint(true)
      }
      setPendingBaseLevel(null)
      return
    }

    if (perk.kind === 'unlock_cell') {
      // Unlock 1 additional cell
      const newUnlockedCells = unlockedCells + 1
      const maxCells = MAX_GRID_COLS * MAX_GRID_ROWS

      // Check if we've hit the max
      if (newUnlockedCells > maxCells) {
        // Already at max, don't expand
        setPendingBaseLevel(null)
        return
      }

      const { cols: newCols, rows: newRows } = calculateGridDimensions(newUnlockedCells)

      // Expand grid if dimensions changed
      if (newCols !== gridCols || newRows !== gridRows) {
        setGrid(prevGrid => {
          const newGrid: GridState = []
          for (let r = 0; r < newRows; r++) {
            newGrid[r] = []
            for (let c = 0; c < newCols; c++) {
              newGrid[r][c] = prevGrid[r]?.[c] ?? null
            }
          }
          return newGrid
        })
        setGridCols(newCols)
        setGridRows(newRows)
      }

      setUnlockedCells(newUnlockedCells)
    } else {
      setPermBuffs(prev => applyBasePerk(prev, perk.kind))
    }
    setPendingBaseLevel(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const manaNeeded   = manaForNextLevel(level)
  const xpNeeded     = xpForNextBaseLevel(baseLevel)

  // Shield Bearer intro overlay (shown after wave 11 win, before crafting tab)
  if (showShieldIntro) {
    return (
      <div className="game-container">
        <ShieldBearerIntroScreen onClose={handleShieldIntroClose} />
      </div>
    )
  }

  if (showWarCrowIntro) {
    return (
      <div className="game-container">
        <WarCrowIntroScreen onClose={handleWarCrowIntroClose} />
      </div>
    )
  }

  if (showDruidIntro) {
    return (
      <div className="game-container">
        <FallenDruidIntroScreen onClose={handleDruidIntroClose} />
      </div>
    )
  }

  if (phase === 'narrative') {
    return (
      <div className="game-container">
        <NarrativeScreen onComplete={() => setPhase('trade')} />
      </div>
    )
  }

  if (phase === 'world1-complete') {
    return (
      <div className="game-container">
        <World1CompleteScreen onContinue={() => setPhase('world-map')} />
      </div>
    )
  }

  if (phase === 'world-map') {
    return (
      <div className="game-container">
        <WorldMapScreen
          world1Completed={wave > 10}
          onSelectWorld1={() => setPhase('trade')}
          onSelectWorld2={() => setPhase('world2-narrative')}
        />
      </div>
    )
  }

  if (phase === 'world2-narrative') {
    return (
      <div className="game-container">
        <NarrativeScreen
          slides={WORLD2_SLIDES}
          onComplete={() => setPhase('trade')}
        />
      </div>
    )
  }

  if (phase === 'battle-prep') {
    const showDeployInstruction = tutorial.active && tutorial.currentStep === 'deploy_and_watch' && !hasDeployedInPrep
    const unlockedHeroKinds = (Object.keys(heroProgress) as HeroKind[]).filter(k => heroProgress[k].unlocked)
    const currentDef = selectedHero ? HERO_DEFS[selectedHero] : null

    // Pulse the hero picker if heroes are available but none selected yet
    const heroPickerPulse = unlockedHeroKinds.length > 0 && !selectedHero

    const heroPicker = unlockedHeroKinds.length > 0 ? (
      <div className="hero-bar">
        <button
          className={`hero-toggle-btn${heroPickerPulse ? ' nav-pulse' : ''}`}
          onClick={() => setHeroMenuOpen(o => !o)}
        >
          <span className="hero-btn-icon">{currentDef?.icon ?? '⚔️'}</span>
          <span className="hero-btn-label">{currentDef ? currentDef.name : 'Hero'}</span>
          <span className="hero-btn-caret">{heroMenuOpen ? '▲' : '▼'}</span>
        </button>
        {heroMenuOpen && (
          <div className="hero-dropdown">
            {unlockedHeroKinds.map(kind => {
              const def = HERO_DEFS[kind]
              return (
                <button
                  key={kind}
                  className={`hero-dropdown-item${selectedHero === kind ? ' hero-dropdown-item--active' : ''}`}
                  onClick={() => { setSelectedHero(kind); setHeroMenuOpen(false) }}
                >
                  <span className="hero-item-icon">{def.icon}</span>
                  <span className="hero-item-info">
                    <span className="hero-item-name">{def.name}</span>
                    <span className="hero-item-desc">{def.description}</span>
                  </span>
                </button>
              )
            })}
            {selectedHero && (
              <button
                className="hero-dropdown-clear"
                onClick={() => { setSelectedHero(null); setHeroMenuOpen(false) }}
              >
                No hero this wave
              </button>
            )}
          </div>
        )}
      </div>
    ) : null

    return (
      <div className="game-container">
        <BattleDeployScreen
          placedItems={placedItems}
          buffs={buffs}
          wave={wave}
          gridRows={gridRows}
          gridCols={gridCols}
          onBack={() => setPhase('trade')}
          onLaunch={towers => {
            setDeployedTowers(towers)
            setPhase('battle')
          }}
          onDeployChange={setHasDeployedInPrep}
          arenaOverlay={heroPicker}
        />
        {showDeployInstruction && (
          <TutorialOverlay config={{ ...tutorialConfig!, instruction: 'Drag your tower and defend the base' }} battle />
        )}
      </div>
    )
  }

  if (phase === 'battle') {
    const deployedIds = new Set(deployedTowers.map(t => t.item.id))
    return (
      <BattlePhaseUI
        gold={gold} xp={xp} xpNeeded={xpNeeded} baseLevel={baseLevel}
        wave={wave} buffs={buffs}
        deployedTowers={deployedTowers} deployedIds={deployedIds}
        placedItems={placedItems} gridRows={gridRows} gridCols={gridCols}
        hasAcademy={hasAcademy} unlockedSpells={unlockedSpells}
        tutorialConfig={tutorialConfig}
        showResultPopup={showResultPopup} roundResult={roundResult}
        onBattleEnd={handleBattleEnd}
        onResultContinue={handleResultContinue}
        heroProgress={heroProgress}
        selectedHero={selectedHero}
        onSelectHero={setSelectedHero}
        craftingState={craftingState}
      />
    )
  }

  // ── Game Shop (full-screen, same level as other tabs) ────────────────────
  if (showGameShop) {
    return (
      <div className="game-container" style={{ display: 'flex', flexDirection: 'column' }}>
        <GameShop
          gold={gold} wood={wood} runes={runes}
          onClose={() => setShowGameShop(false)}
          onEarn={reward => {
            if (reward.gold)  setGold(g  => g  + (reward.gold  ?? 0))
            if (reward.wood)  setWood(w  => w  + (reward.wood  ?? 0))
            if (reward.runes) setRunes(r => r  + (reward.runes ?? 0))
          }}
        />
        <BottomNav activeTab={activeTab} hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0} hasHeroes={hasAnyShards(heroProgress)} hasCrafting={craftingUnlocked} onTabChange={tab => { setShowGameShop(false); setActiveTab(tab) }} />
      </div>
    )
  }

  // ── Base tab ───────────────────────────────────────────────────────────────
  if (activeTab === 'base') {
    return (
      <div className="game-container">
        <BaseScreen
          baseLevel={baseLevel} xp={xp} xpNeeded={xpNeeded}
          permBuffs={permBuffs} pickedBasePerks={pickedBasePerks}
        />
        <BottomNav activeTab="base" hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0} hasHeroes={hasAnyShards(heroProgress)} hasCrafting={craftingUnlocked} onTabChange={setActiveTab} />
      </div>
    )
  }

  // ── Academy tab ────────────────────────────────────────────────────────────
  if (activeTab === 'academy') {
    return (
      <div className="game-container">
        <AcademyScreen
          hasAcademy={hasAcademy}
          unlockedSpells={unlockedSpells}
          gold={gold}
          wave={wave}
          onUnlockSpell={handleUnlockSpell}
        />
        <BottomNav activeTab="academy" hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0} hasHeroes={hasAnyShards(heroProgress)} hasCrafting={craftingUnlocked} onTabChange={setActiveTab} />
      </div>
    )
  }

  // ── Heroes tab ────────────────────────────────────────────────────────────
  if (activeTab === 'heroes') {
    return (
      <div className="game-container">
        <HeroesScreen heroProgress={heroProgress} />
        <BottomNav activeTab="heroes" hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0} hasHeroes={hasAnyShards(heroProgress)} hasCrafting={craftingUnlocked} onTabChange={setActiveTab} />
      </div>
    )
  }

  // ── Crafting tab ──────────────────────────────────────────────────────────
  if (activeTab === 'crafting') {
    return (
      <div className="game-container" style={{ display: 'flex', flexDirection: 'column' }}>
        <CraftingScreen
          gold={gold}
          wood={wood}
          wave={wave}
          craftingState={craftingState}
          onUpgrade={handleCraftingUpgrade}
          showVillageGiftPopup={showVillageGift}
          onCloseVillageGift={() => setShowVillageGift(false)}
        />
        <BottomNav activeTab="crafting" hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0} hasHeroes={hasAnyShards(heroProgress)} hasCrafting={craftingUnlocked} onTabChange={setActiveTab} />
      </div>
    )
  }

  // ── Battle tab (default trade UI) ─────────────────────────────────────────
  return (
    <DragProvider onDrop={handleDrop}>
      <TradeUI
        gold={gold} mana={mana} manaNeeded={manaNeeded} level={level} wave={wave}
        xp={xp} xpNeeded={xpNeeded} baseLevel={baseLevel}
        grid={grid} placedItems={placedItems} reservesSlots={reservesSlots}
        gridRef={gridRef} roundResult={roundResult} buffGrants={buffGrants}
        pendingLvlUp={pendingLvlUp} pendingBaseLevel={pendingBaseLevel} rerollCost={rerollCost}
        cellSize={cellSize} onCellSizeChange={setCellSize}
        gridCols={gridCols} gridRows={gridRows} unlockedCells={unlockedCells}
        tutorialConfig={tutorialConfig}
        activeTab={activeTab} onTabChange={setActiveTab} hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0} hasHeroes={hasAnyShards(heroProgress)} hasCrafting={craftingUnlocked} heroProgress={heroProgress}
        showSellHint={showSellHint} onDismissSellHint={() => setShowSellHint(false)}
        showFrostHint={showFrostHint} onDismissFrostHint={() => setShowFrostHint(false)}
        showShardHint={showShardHint} onDismissShardHint={() => { setShowShardHint(false); setShowHeroesTabHint(true) }}
        showHeroesTabHint={showHeroesTabHint} onDismissHeroesTabHint={() => setShowHeroesTabHint(false)}
        musicVolume={musicVolume} onMusicVolumeChange={setMusicVolume}
        onInfoIconTap={() => {
          if (tutorial.active && tutorial.currentStep === 'introduce_info_icon') {
            setTutorial({ active: false, currentStep: 'complete' })
          }
        }}
        runes={runes}
        onOpenShop={() => setShowGameShop(true)}
        onStartBattle={() => {
          setRoundResult(null)
          setHasDeployedInPrep(false)
          setPhase('battle-prep')
        }}
        onPickUpgrade={applyUpgrade}
        onPickBasePerk={applyBasePerkChoice}
        onReroll={handleReroll}
        onSellItem={handleSellItem}
        onCheatGold={() => setGold(g => g + 100)}
        onCheatWave={w => setWave(w)}
      />
    </DragProvider>
  )
}

// ── Tooltip state ─────────────────────────────────────────────────────────
interface TooltipState { item: Item; x: number; y: number }

// ── Trade UI ───────────────────────────────────────────────────────────────
function TradeUI({
  gold, mana, manaNeeded, level: _level, wave,
  xp, xpNeeded, baseLevel,
  grid, placedItems, reservesSlots,
  gridRef, roundResult, buffGrants, pendingLvlUp, pendingBaseLevel, rerollCost,
  cellSize, onCellSizeChange, gridCols, gridRows, unlockedCells, tutorialConfig,
  activeTab, onTabChange, hasAcademy, hasBasePerks, hasHeroes, hasCrafting, heroProgress: _heroProgress,
  showSellHint, onDismissSellHint,
  showFrostHint, onDismissFrostHint,
  showShardHint, onDismissShardHint,
  showHeroesTabHint, onDismissHeroesTabHint,
  musicVolume, onMusicVolumeChange,
  onInfoIconTap,
  runes: _runes, onOpenShop,
  onStartBattle, onPickUpgrade, onPickBasePerk, onReroll, onSellItem,
  onCheatGold, onCheatWave,
}: {
  gold: number; mana: number; manaNeeded: number; level: number; wave: number
  xp: number; xpNeeded: number; baseLevel: number
  grid: GridState; placedItems: Map<string, PlacedItem>
  reservesSlots: ReservesSlot[]; gridRef: React.RefObject<HTMLDivElement | null>
  roundResult: RoundResult | null; buffGrants: BuffGrant[]
  pendingLvlUp: PendingLevelUp | null; pendingBaseLevel: PendingBaseLevel | null; rerollCost: number
  cellSize: number; onCellSizeChange: (cs: number) => void
  gridCols: number; gridRows: number; unlockedCells: number
  tutorialConfig: ReturnType<typeof getStepConfig>
  activeTab: Tab; onTabChange: (t: Tab) => void; hasAcademy: boolean; hasBasePerks: boolean; hasHeroes: boolean; hasCrafting: boolean; heroProgress: HeroProgressMap
  showSellHint: boolean; onDismissSellHint: () => void
  showFrostHint: boolean; onDismissFrostHint: () => void
  showShardHint: boolean; onDismissShardHint: () => void
  showHeroesTabHint: boolean; onDismissHeroesTabHint: () => void
  musicVolume: number; onMusicVolumeChange: (v: number) => void
  onInfoIconTap?: () => void
  runes: number
  onOpenShop: () => void
  onStartBattle: () => void
  onPickUpgrade: (u: Upgrade) => void
  onPickBasePerk: (p: BasePerk) => void
  onReroll: () => void
  onSellItem: (itemId: string) => void
  onCheatGold: () => void
  onCheatWave: (w: number) => void
}) {
  const { activeDrag } = useDrag()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingSell, setPendingSell]   = useState<PlacedItem | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gridAreaRef  = useRef<HTMLDivElement>(null)

  // ── Measure available grid area and compute cell size ─────────────────────
  const onCellSizeChangeRef = useRef(onCellSizeChange)
  onCellSizeChangeRef.current = onCellSizeChange
  useEffect(() => {
    const el = gridAreaRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const border = 6  // 3px border × 2 sides on .backpack-grid
      const cs = Math.max(20, Math.floor(Math.min(
        (width  - border) / gridCols,
        (height - border) / gridRows,
      )))
      onCellSizeChangeRef.current(cs)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [gridCols, gridRows])

  function showTooltip(item: Item, viewportX: number, viewportY: number) {
    // Convert viewport → container-local coords
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ item, x: viewportX - rect.left, y: viewportY - rect.top })
    onInfoIconTap?.()
  }

  function hideTooltip() { setTooltip(null) }

  // Dismiss tooltip when a drag starts
  if (activeDrag && tooltip) setTooltip(null)

  const floatGhostCells = activeDrag
    ? SHAPE_OFFSETS[activeDrag.item.def.size as ItemSize].map(([dr, dc]) => ({
        left:  activeDrag.mouseX - activeDrag.grabOffsetX + dc * cellSize,
        top:   activeDrag.mouseY - activeDrag.grabOffsetY + dr * cellSize,
        color: activeDrag.item.def.color,
        key:   `${dr}-${dc}`,
      }))
    : null

  // Active buff grants for display

  return (
    <div ref={containerRef} className="game-container">
      <header className="game-header">
        <div className="resources">
          <span className="resource">
            <span className="resource-label">Gold</span>
            <strong>{gold}</strong>
          </span>
          {CASTLE_BUFFS_ENABLED && (
          <span className="resource">
            <span className="resource-icon">🏰</span>
            <span className="mana-bar-wrap">
              <span className="mana-bar-fill" style={{ width: `${(mana / manaNeeded) * 100}%` }} />
            </span>
            <span className="mana-text">{mana}/{manaNeeded}</span>
          </span>
          )}
          <span className="resource">
            <span className="resource-label">Base.<strong>{baseLevel}</strong></span>
            <span className="xp-bar-wrap">
              <span className="xp-bar-fill" style={{ width: `${(xp / xpNeeded) * 100}%` }} />
            </span>
            <span className="xp-text">{xp}/{xpNeeded}</span>
          </span>
        </div>
      </header>

      {CASTLE_BUFFS_ENABLED && buffGrants.length > 0 && (
        <div className="buffs-bar">
          {buffGrants.map((g, i) => (
            <span key={i} className="buff-chip">
              {g.upgrade.icon} {g.upgrade.title} <span className="buff-waves">({g.wavesLeft})</span>
            </span>
          ))}
        </div>
      )}

      {wave >= 5 && (
        <button className="btn-shop-open" onClick={onOpenShop} aria-label="Open Shop">
          <img src="/Heroes/shop_icon.png" alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        </button>
      )}

      <section className={`zone backpack-zone${tutorialConfig?.highlightBackpack ? ' tutorial-highlight' : ''}`}>
        <div className="zone-header-row">
          <div className="zone-label">Backpack</div>
          <button className="settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">⚙</button>
        </div>
        <div ref={gridAreaRef} className="backpack-grid-area">
          <BackpackGrid
            grid={grid} placedItems={placedItems} gridRef={gridRef}
            onItemClick={showTooltip}
            onSellItem={itemId => {
              const p = placedItems.get(itemId)
              if (p) setPendingSell(p)
            }}
            cellSize={cellSize}
            gridCols={gridCols} unlockedCells={unlockedCells}
            highlightInfoBtn={!!tutorialConfig?.highlightInfoBtn}
            highlightSell={showSellHint}
          />
        </div>
        <div className="battle-btn-row">
          <button
            className={`btn-battle${tutorialConfig?.highlightBattleBtn ? ' tutorial-highlight-btn' : ''}`}
            onClick={onStartBattle}
          >
            {roundResult?.won === false
              ? `↺ Retry Wave ${wave}`
              : tutorialConfig?.highlightBattleBtn
              ? `👉 Start Wave ${wave}`
              : `⚔ Start Wave ${wave}`}
          </button>
        </div>
      </section>

      <section className={`zone reserves-zone${tutorialConfig?.highlightShop ? ' tutorial-highlight' : ''}`}>
        <div className="zone-label">Reserves</div>
        <Reserves
          slots={reservesSlots} gold={gold} rerollCost={rerollCost}
          onReroll={onReroll} onSlotClick={showTooltip} cellSize={cellSize}
          disableReroll={tutorialConfig ? !tutorialConfig.allowReroll : false}
        />
      </section>

      {floatGhostCells && createPortal(
        floatGhostCells.map(cell => (
          <div key={cell.key} className="drag-ghost-float"
            style={{ left: cell.left, top: cell.top, background: cell.color,
                     width: cellSize - 6, height: cellSize - 6 }} />
        )),
        document.body
      )}

      {/* ── Tooltip ── */}
      {tooltip && <>
        <div className="tooltip-backdrop" onClick={hideTooltip} />
        <Tooltip item={tooltip.item} x={tooltip.x} y={tooltip.y} />
      </>}

      {CASTLE_BUFFS_ENABLED && pendingLvlUp && (
        <LevelUpModal
          variant="castle"
          choices={pendingLvlUp.choices}
          onPick={c => onPickUpgrade(c as Upgrade)}
        />
      )}
      {!pendingLvlUp && pendingBaseLevel && (
        <LevelUpModal
          variant="base"
          choices={pendingBaseLevel.choices}
          onPick={c => onPickBasePerk(c as BasePerk)}
          recommendedKind={pendingBaseLevel.toLevel === 2 ? 'unlock_cell' : undefined}
        />
      )}

      {tutorialConfig && !showFrostHint && !showSellHint && <TutorialOverlay config={tutorialConfig} />}

      {showSellHint && (
        <div className="sell-hint-overlay" onClick={onDismissSellHint}>
          <div className="tutorial-instruction">
            Sell unwanted items from your backpack back to the store. $ sign on item
          </div>
        </div>
      )}

      {showFrostHint && (
        <div className="sell-hint-overlay" onClick={onDismissFrostHint}>
          <div className="tutorial-instruction">
            ❄ Frost Tower can slow down your enemies and deal small damage
          </div>
        </div>
      )}

      {/* ── Shard tutorial hint ── */}
      {showShardHint && (
        <div className="shard-hint-overlay" onClick={onDismissShardHint}>
          <div className="shard-hint-panel" onClick={e => e.stopPropagation()}>
            <img src="/Heroes/shard_crystal.png" alt="shard" className="shard-hint-crystal" />
            <h3 className="shard-hint-title">Hero Shard!</h3>
            <p className="shard-hint-body">
              You earned a <strong>Hero Shard</strong>! Collect enough shards to unlock
              a powerful Hero who fights alongside your towers on the battlefield.
            </p>
            <p className="shard-hint-body">
              You'll earn shards after each wave — keep winning to unlock your first Hero!
            </p>
            <button className="shard-hint-btn" onClick={onDismissShardHint}>
              Got it!
            </button>
          </div>
        </div>
      )}

      <BottomNav
        activeTab={activeTab}
        hasAcademy={hasAcademy}
        hasBasePerks={hasBasePerks}
        hasHeroes={hasHeroes}
        hasCrafting={hasCrafting}
        heroesTabPulse={showHeroesTabHint}
        onTabChange={tab => {
          if (tab === 'heroes' && showHeroesTabHint) onDismissHeroesTabHint()
          onTabChange(tab)
        }}
      />

      {/* ── Sell confirmation modal ── */}
      {pendingSell && (
        <div className="settings-backdrop" onClick={() => setPendingSell(null)}>
          <div className="sell-confirm-panel" onClick={e => e.stopPropagation()}>
            <div className="sell-confirm-icon">{getItemImage(pendingSell.item)
              ? <img src={getItemImage(pendingSell.item)} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
              : <span style={{ fontSize: 40 }}>📦</span>
            }</div>
            <div className="sell-confirm-title">Sell {pendingSell.item.def.label}?</div>
            <div className="sell-confirm-price">
              You'll receive <strong>{getSellPrice(pendingSell.item.def.kind, pendingSell.item.tier)}g</strong>
            </div>
            <div className="sell-confirm-btns">
              <button className="sell-confirm-btn sell-confirm-btn--cancel" onClick={() => setPendingSell(null)}>
                Cancel
              </button>
              <button className="sell-confirm-btn sell-confirm-btn--confirm" onClick={() => {
                onSellItem(pendingSell.item.id)
                setPendingSell(null)
              }}>
                Sell
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <div className="settings-backdrop" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
            <div className="settings-title">Settings</div>
            <div className="settings-row">
              <span className="settings-label">🎵 Music</span>
              <div className="settings-slider-wrap">
                <input
                  type="range" min={0} max={100} value={musicVolume}
                  className="settings-slider"
                  style={{ ['--val' as string]: `${musicVolume}%` }}
                  onChange={e => onMusicVolumeChange(Number(e.target.value))}
                />
                <span className="settings-slider-val">{musicVolume}</span>
              </div>
            </div>

            {/* ── DEV TOOLS (temporary) ── */}
            <div className="settings-dev-section">
              <div className="settings-dev-label">🛠 Dev Tools</div>
              <div className="settings-dev-row">
                <button className="settings-dev-btn" onClick={onCheatGold}>
                  💰 +100 Gold
                </button>
              </div>
              <div className="settings-dev-row">
                <span className="settings-dev-hint">Jump to wave:</span>
                <select
                  className="settings-dev-select"
                  value={wave}
                  onChange={e => { onCheatWave(Number(e.target.value)); setShowSettings(false) }}
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Wave {w}</option>
                  ))}
                </select>
              </div>
              <div className="settings-dev-row">
                <button
                  className="settings-reset"
                  style={{ width: '100%' }}
                  onClick={() => {
                    if (confirm('Reset all progress and restart from wave 1?')) {
                      clearSave()
                      window.location.reload()
                    }
                  }}
                >
                  🗑 Reset Progress
                </button>
              </div>
            </div>
            <button className="settings-close" onClick={() => setShowSettings(false)}>✕ Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Battle phase UI ────────────────────────────────────────────────────────
function BattlePhaseUI({
  gold: _gold, xp: _xp, xpNeeded: _xpNeeded, baseLevel: _baseLevel, wave, buffs,
  deployedTowers, deployedIds, placedItems, gridRows, gridCols,
  hasAcademy, unlockedSpells,
  tutorialConfig, showResultPopup, roundResult,
  onBattleEnd, onResultContinue,
  heroProgress: _heroProgress, selectedHero, onSelectHero: _onSelectHero,
  craftingState,
}: {
  gold: number; xp: number; xpNeeded: number; baseLevel: number
  wave: number; buffs: ReturnType<typeof mergeBuffs>
  deployedTowers: DeployedTower[]; deployedIds: Set<string>
  placedItems: Map<string, PlacedItem>; gridRows: number; gridCols: number
  hasAcademy: boolean; unlockedSpells: SpellKind[]
  tutorialConfig: ReturnType<typeof getStepConfig>
  showResultPopup: boolean; roundResult: RoundResult | null
  onBattleEnd: (r: BattleResult) => void
  onResultContinue: () => void
  heroProgress: HeroProgressMap
  selectedHero: HeroKind | null
  onSelectHero: (kind: HeroKind | null) => void
  craftingState?: CraftingState
}) {
  const pendingSpellRef = useRef<{ kind: string; x: number; y: number } | null>(null)
  const pendingHeroRef  = useRef<HeroKind | null>(null)
  const battleWrapperRef = useRef<HTMLDivElement>(null)

  const [spellDrag, setSpellDrag] = useState<{ kind: SpellKind; clientX: number; clientY: number } | null>(null)
  const [cooldowns, setCooldowns] = useState<Partial<Record<SpellKind, number>>>({})
  const [heroDead, _setHeroDead]    = useState(false)
  const [heroDeployed, setHeroDeployed] = useState(false)

  // Cooldown countdown — tick every second
  useEffect(() => {
    const id = setInterval(() => {
      setCooldowns(prev => {
        const next = { ...prev }
        let changed = false
        for (const k of Object.keys(next) as SpellKind[]) {
          if ((next[k] ?? 0) > 0) { next[k] = Math.max(0, next[k]! - 1); changed = true }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function handleSpellPointerDown(e: React.PointerEvent, kind: SpellKind) {
    if ((cooldowns[kind] ?? 0) > 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setSpellDrag({ kind, clientX: e.clientX, clientY: e.clientY })
  }
  function handleSpellPointerMove(e: React.PointerEvent) {
    if (!spellDrag) return
    setSpellDrag(prev => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null)
  }
  function handleSpellPointerUp(e: React.PointerEvent) {
    if (!spellDrag) return
    const wrapEl = battleWrapperRef.current
    if (wrapEl) {
      const rect = wrapEl.getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom) {
        const canvasX = (e.clientX - rect.left) * (BATTLE_W / rect.width)
        const canvasY = (e.clientY - rect.top)  * (BATTLE_H / rect.height)
        pendingSpellRef.current = { kind: spellDrag.kind, x: canvasX, y: canvasY }
        setCooldowns(prev => ({ ...prev, [spellDrag.kind]: SPELL_DEFS[spellDrag.kind].cooldown }))
      }
    }
    setSpellDrag(null)
  }

  const availableSpells = hasAcademy
    ? unlockedSpells.map(k => SPELL_DEFS[k])
    : []

  function handleDeployHero() {
    if (!selectedHero || heroDeployed) return
    pendingHeroRef.current = selectedHero
    setHeroDeployed(true)
  }

  return (
    <div className="game-container">
      <div
        ref={battleWrapperRef}
        className={`battle-wrapper${
          isExtZigzagWave(wave)  ? ' battle-wrapper--extzigzag'  :
          isFunnelWave(wave)     ? ' battle-wrapper--funnel'      :
          isDiamondWave(wave)    ? ' battle-wrapper--diamond'     :
          isTripleLaneWave(wave) ? ' battle-wrapper--triplelane'  :
          isZigzagWave(wave)     ? ' battle-wrapper--alt'         : ''}`}
        onPointerMove={handleSpellPointerMove}
        onPointerUp={handleSpellPointerUp}
        style={{ position: 'relative', flex: '2 1 0', minHeight: 0 }}
      >
        <BattleCanvas
          deployedTowers={deployedTowers}
          wave={wave}
          buffs={buffs}
          onBattleEnd={onBattleEnd}
          tutorialLimitEnemies={tutorialConfig?.limitEnemies}
          pendingSpellRef={pendingSpellRef}
          pendingHeroRef={pendingHeroRef}
          heroShards={selectedHero ? _heroProgress[selectedHero].shards : 0}
          craftingState={craftingState}
        />

        {/* Spell bar — bottom-left corner of battle canvas */}
        {availableSpells.length > 0 && (
          <div className="spell-bar">
            {availableSpells.map(spell => {
              const cd = cooldowns[spell.kind] ?? 0
              return (
                <div
                  key={spell.kind}
                  className={`spell-btn${cd > 0 ? ' spell-btn--cooling' : ''}`}
                  onPointerDown={e => handleSpellPointerDown(e, spell.kind)}
                  style={{ touchAction: 'none', userSelect: 'none' }}
                >
                  <span className="spell-btn-icon">{spell.icon}</span>
                  {cd > 0 && <span className="spell-btn-cd">{cd}</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* Hero deploy button — bottom-left corner, only if a hero was selected in prep */}
        {selectedHero && (
          <div className="hero-bar">
            <button
              className={`hero-toggle-btn${heroDeployed ? ' hero-deployed' : ''}`}
              onClick={handleDeployHero}
              disabled={heroDeployed}
            >
              <span className="hero-btn-icon">
                {heroDead ? '💀' : HERO_DEFS[selectedHero].icon}
              </span>
              <span className="hero-btn-label">
                {heroDeployed ? (heroDead ? 'Fallen' : 'In Battle') : `Deploy ${HERO_DEFS[selectedHero].name}`}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="battle-lower">
        <div className="deploy-bench">
          <span className="bench-section-label">Backpack</span>
          <BackpackMiniView placedItems={placedItems} deployedIds={deployedIds} gridRows={gridRows} gridCols={gridCols} />
        </div>
      </div>

      {/* Drag ghost */}
      {spellDrag && createPortal(
        <div className="spell-drag-ghost" style={{ left: spellDrag.clientX - 24, top: spellDrag.clientY - 24 }}>
          {SPELL_DEFS[spellDrag.kind].icon}
        </div>,
        document.body
      )}

      {showResultPopup && roundResult && (
        <ResultPopup
          result={roundResult}
          onContinue={onResultContinue}
          showTutorialHints={roundResult.showTutorialHints}
        />
      )}
    </div>
  )
}

// ── Result popup ───────────────────────────────────────────────────────────
function ResultPopup({ result: r, onContinue, showTutorialHints = false }: {
  result: RoundResult
  onContinue: () => void
  showTutorialHints?: boolean
}) {
  const totalGold = r.killGold + r.baseGold + r.ecoGold
  const heroDef = r.shardDrop ? HERO_DEFS[r.shardDrop] : null
  return (
    <div className="result-popup-overlay">
      <div className={`result-popup ${r.won ? 'popup-win' : 'popup-lose'}`}>
        <div className={`popup-verdict ${r.won ? 'verdict-win' : 'verdict-lose'}`}>
          {r.won ? '✓ CLEARED' : '✗ FAILED'}
        </div>

        <div className="popup-stats">
          <div className="popup-stat">
            <span className="popup-stat-value">⚔ {r.kills}</span>
            <span className="popup-stat-label">kills</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat-value dim">{r.escaped}</span>
            <span className="popup-stat-label">escaped</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat-value gold">+{totalGold}g</span>
            <span className="popup-stat-label">gold</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat-value mana">+{r.manaEarned}</span>
            <span className="popup-stat-label">mana</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat-value xp">+{r.xpEarned}</span>
            <span className="popup-stat-label">xp</span>
          </div>
        </div>

        <div className="popup-breakdown">
          {r.won
            ? <>base +{r.baseGold}g · kills +{r.killGold}g{r.ecoGold > 0 && <> · economy +{r.ecoGold}g</>}</>
            : <span className="popup-retry">economy ½ (+{r.ecoGold}g) · retry to advance</span>
          }
        </div>

        {heroDef && (
          <div className="popup-shard-row">
            <img src="/Heroes/shard_crystal.png" alt="shard" className="popup-shard-crystal" />
            <span className="popup-shard-text">
              +{r.shardCount ?? 1} <strong>{heroDef.name} Shard{(r.shardCount ?? 1) > 1 ? 's' : ''}</strong>
            </span>
            <span className="popup-shard-icon">{heroDef.icon}</span>
          </div>
        )}

        {(r.woodEarned ?? 0) > 0 && (
          <div className="popup-shard-row">
            <span style={{ fontSize: 20 }}>🪵</span>
            <span className="popup-shard-text">+{r.woodEarned} <strong>Wood</strong></span>
          </div>
        )}

        {showTutorialHints && (
          <div className="popup-tutorial-hints">
            <div className="tutorial-hint">
              <span className="hint-icon">💡</span>
              <span className="hint-text"><strong>XP</strong> = Base level ups (permanent)</span>
            </div>
            <div className="tutorial-hint">
              <span className="hint-icon">💡</span>
              <span className="hint-text"><strong>Gold</strong> = Buy items in shop</span>
            </div>
          </div>
        )}

        {r.brokenLabels.length > 0 && (
          <div className="popup-broken">💔 Broke: {r.brokenLabels.join(', ')}</div>
        )}

        <button className="btn-continue" onClick={onContinue}>
          {r.won ? 'Continue →' : 'Retry'}
        </button>
      </div>
    </div>
  )
}
