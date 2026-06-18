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
import Shop from './components/Shop'
import { type ActiveDrag, DragProvider, useDrag } from './context/DragContext'
import { canPlace, checkMerge, createGrid, getItemCells, moveItem, placeItem, removeItem } from './lib/grid'
import { getScaledGold, mergeItems } from './lib/items'
import {
  INSTANT_UPGRADES, computeBuffs, mergeBuffs, applyBasePerk,
  pickThreeUpgrades, pickThreeBasePerks, manaForNextLevel, xpForNextBaseLevel,
  DEFAULT_BUFFS,
  type BuffGrant, type Buffs, type Upgrade, type BasePerk,
} from './lib/levelup'
import { generateShop, getSellPrice, type ShopSlot } from './lib/shop'
import { GRID_COLS, GRID_ROWS, MAX_GRID_COLS, MAX_GRID_ROWS, SHAPE_OFFSETS, type GridState, type Item, type ItemSize, type PlacedItem } from './types'
import { getInitialTutorialState, getStepConfig, type TutorialState } from './lib/tutorial'
import TutorialOverlay from './components/TutorialOverlay'
import NarrativeScreen from './components/NarrativeScreen'
import BottomNav, { type Tab } from './components/BottomNav'
import BaseScreen from './components/BaseScreen'
import AcademyScreen from './components/AcademyScreen'
import { SPELL_DEFS, type SpellKind } from './lib/spells'

// ── Local types ────────────────────────────────────────────────────────────
type GamePhase = 'narrative' | 'trade' | 'battle-prep' | 'battle'

interface RoundResult {
  won: boolean
  kills: number; escaped: number
  killGold: number; baseGold: number; ecoGold: number
  manaEarned: number; xpEarned: number; brokenLabels: string[]
  showTutorialHints?: boolean
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
  const [phase, setPhase]             = useState<GamePhase>('narrative')
  const [gold, setGold]               = useState(STARTING_GOLD)
  const [mana, setMana]               = useState(0)
  const [level, setLevel]             = useState(1)
  const [xp, setXp]                   = useState(0)
  const [baseLevel, setBaseLevel]     = useState(1)
  const [permBuffs, setPermBuffs]     = useState<Buffs>(DEFAULT_BUFFS)
  const [buffGrants, setBuffGrants]   = useState<BuffGrant[]>([])
  const [pendingBaseLevel, setPendingBaseLevel] = useState<PendingBaseLevel | null>(null)
  const [unlockedCells, setUnlockedCells] = useState(BASE_GRID_CELLS)  // 6 initially
  const [gridCols, setGridCols]       = useState(GRID_COLS)
  const [gridRows, setGridRows]       = useState(GRID_ROWS)
  const [grid, setGrid]               = useState<GridState>(createGrid)
  const [placedItems, setPlacedItems] = useState<Map<string, PlacedItem>>(new Map)
  const [tutorial, setTutorial]       = useState<TutorialState>(getInitialTutorialState)
  const tutorialConfig = getStepConfig(tutorial.currentStep)
  const [shopSlots, setShopSlots]     = useState(() =>
    generateShop(3, 1, tutorialConfig?.forceShopItems)  // 3 items per reroll
  )
  const [shopSize, setShopSize]       = useState(3)
  const [rerollCost, setRerollCost]   = useState(1)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [showResultPopup, setShowResultPopup] = useState(false)
  const [pendingLvlUp, setPendingLvlUp] = useState<PendingLevelUp | null>(null)
  const [deployedTowers, setDeployedTowers] = useState<DeployedTower[]>([])
  const [hasDeployedInPrep, setHasDeployedInPrep] = useState(false)
  const [wave, setWave] = useState(1)
  const [activeTab, setActiveTab]           = useState<Tab>('battle')
  const [pickedBasePerks, setPickedBasePerks] = useState<BasePerk[]>([])
  const [unlockedSpells, setUnlockedSpells] = useState<SpellKind[]>([])
  const [showSellHint, setShowSellHint]     = useState(false)
  const [showFrostHint, setShowFrostHint]   = useState(false)
  const hasSeenFrost = useRef(false)
  const buffs = mergeBuffs(permBuffs, computeBuffs(buffGrants))
  const hasAcademy = [...placedItems.values()].some(p => p.item.def.kind === 'academy')

  // ── Background music ───────────────────────────────────────────────────────
  const audioRef       = useRef<HTMLAudioElement | null>(null)  // main / explore music
  const battleAudioRef = useRef<HTMLAudioElement | null>(null)  // battle music
  const [musicVolume, setMusicVolume] = useState(50)

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
          if (drag.source === 'shop') {
            const slot = shopSlots.find(s => s.id === drag.sourceId)
            if (slot && !slot.sold && gold >= slot.cost) {
              setShopSlots(prev => prev.map(s => s.id === slot.id ? { ...s, sold: true } : s))
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
      const slot = shopSlots.find(s => s.id === drag.sourceId)
      if (!slot || slot.sold || gold < slot.cost) return
      if (!canPlace(grid, drag.item, snapRow, snapCol, undefined, unlockedCells)) return
      try {
        const g = placeItem(grid, drag.item, snapRow, snapCol)
        const p = new Map(placedItems)
        p.set(drag.item.id, { item: drag.item, row: snapRow, col: snapCol })
        setGrid(g); setPlacedItems(p)
        setShopSlots(prev => prev.map(s => s.id === slot.id ? { ...s, sold: true } : s))
        setGold(v => v - slot.cost)

        // Tutorial: advance when player places item from shop
        if (tutorial.active && tutorial.currentStep === 'place_and_buy') {
          setTutorial({ active: true, currentStep: 'deploy_and_watch' })
        }
        // Tutorial: advance to info-icon step when player places shop item during introduce_shop
        if (tutorial.active && tutorial.currentStep === 'introduce_shop' && drag.item.def.kind === 'shop') {
          setTutorial({ active: true, currentStep: 'introduce_info_icon' })
        }
      } catch { /* invalid */ }
    }
  }, [grid, placedItems, shopSlots, gold, tutorial])

  // ── Battle end ─────────────────────────────────────────────────────────────
  function handleBattleEnd(result: BattleResult) {
    const won = result.escaped <= 1

    // 1. Durability loss + remove broken items (only on win)
    const newPlaced = new Map(placedItems)
    let   newGrid   = grid
    const brokenLabels: string[] = []

    if (won) {
      for (const [id, placed] of placedItems) {
        if (placed.item.def.category !== 'military') continue
        const newDur = (placed.item.durability ?? 1) - 1
        if (newDur <= 0) {
          brokenLabels.push(placed.item.def.label + (placed.item.tier >= 2 ? ` ${placed.item.tier}` : ''))
          newGrid = removeItem(newGrid, id)
          newPlaced.delete(id)
        } else {
          newPlaced.set(id, { ...placed, item: { ...placed.item, durability: newDur } })
        }
      }
    }

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
    const totalGoldEarned = Math.max(1, result.goldEarned + ecoGold + baseGold)
    setGold(g => g + totalGoldEarned)

    // 3. Mana → castle support (temporary buffs, reduced by 50% on loss)
    const gainedMana = won ? result.manaEarned : Math.floor(result.manaEarned * 0.5)
    let newMana      = mana + gainedMana
    let newLevel     = level

    while (newMana >= manaForNextLevel(newLevel)) {
      newMana -= manaForNextLevel(newLevel)
      newLevel++
    }
    setMana(newMana)

    if (newLevel > level) {
      setLevel(newLevel)
      setPendingLvlUp({ toLevel: newLevel, choices: pickThreeUpgrades() })
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
      setPendingBaseLevel({ toLevel: newBaseLevel, choices: pickThreeBasePerks(newBaseLevel, isGridMaxed) })
    }

    // 4. Tick down temporary buff grants (regardless of win/loss)
    setBuffGrants(prev =>
      prev.map(g => ({ ...g, wavesLeft: g.wavesLeft - 1 })).filter(g => g.wavesLeft > 0)
    )

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

    const rr: RoundResult = { won, kills: result.kills, escaped: result.escaped,
      killGold: displayKillGold, baseGold: displayBaseGold, ecoGold: displayEcoGold,
      manaEarned: gainedMana, xpEarned: gainedXp, brokenLabels, showTutorialHints }
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
      nextTutorialStep = 'introduce_durability'
      setTutorial({ active: true, currentStep: 'introduce_durability' })
    } else if (tutorial.active && tutorial.currentStep === 'introduce_durability') {
      nextTutorialStep = 'complete'
      setTutorial({ active: false, currentStep: 'complete' })
    }

    const nextWave = won ? wave + 1 : wave
    const nextTutorialConfig = getStepConfig(nextTutorialStep)
    const shopForceItems = (!won && wave === 2) ? ['frost', 'frost', 'frost', 'frost'] : nextTutorialConfig?.forceShopItems
    const newSlots = generateShop(shopSize, nextWave, shopForceItems)
    setShopSlots(newSlots)
    setRerollCost(1)
    if (won) setWave(nextWave)
    if (won && wave === 4) setShowSellHint(true)
    if (!hasSeenFrost.current && newSlots.some(s => s.item.def.kind === 'frost')) {
      hasSeenFrost.current = true
      setShowFrostHint(true)
    }
    // phase stays 'battle' until player dismisses popup
  }

  function handleResultContinue() {
    setShowResultPopup(false)
    setPhase('trade')
  }

  // ── Re-roll shop ──────────────────────────────────────────────────────────
  function handleReroll() {
    // Disabled during tutorial
    if (tutorialConfig && !tutorialConfig.allowReroll) return
    if (gold < rerollCost) return
    setGold(g => g - rerollCost)
    setRerollCost(c => Math.ceil(c * 1.5))
    const rerolledSlots = generateShop(shopSize, wave, tutorialConfig?.forceShopItems)
    setShopSlots(rerolledSlots)
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
      if (upgrade.kind === 'forged_steel') {
        setPlacedItems(prev => {
          const next = new Map(prev)
          for (const [id, placed] of prev) {
            if (placed.item.def.category === 'military') {
              const maxDur = (placed.item.def.maxDurability ?? 3) + 1
              next.set(id, { ...placed, item: { ...placed.item, durability: maxDur } })
            }
          }
          return next
        })
      }
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
      const newSize = shopSize + 1
      setShopSize(newSize)
      const expandedSlots = generateShop(newSize, wave, tutorialConfig?.forceShopItems)
      setShopSlots(expandedSlots)
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

  if (phase === 'narrative') {
    return (
      <div className="game-container">
        <NarrativeScreen onComplete={() => setPhase('trade')} />
      </div>
    )
  }

  if (phase === 'battle-prep') {
    const showDeployInstruction = tutorial.active && tutorial.currentStep === 'deploy_and_watch' && !hasDeployedInPrep
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
      />
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
        <BottomNav activeTab="base" hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0} onTabChange={setActiveTab} />
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
        <BottomNav activeTab="academy" hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0} onTabChange={setActiveTab} />
      </div>
    )
  }

  // ── Battle tab (default trade UI) ─────────────────────────────────────────
  return (
    <DragProvider onDrop={handleDrop}>
      <TradeUI
        gold={gold} mana={mana} manaNeeded={manaNeeded} level={level} wave={wave}
        xp={xp} xpNeeded={xpNeeded} baseLevel={baseLevel}
        grid={grid} placedItems={placedItems} shopSlots={shopSlots}
        gridRef={gridRef} roundResult={roundResult} buffGrants={buffGrants}
        pendingLvlUp={pendingLvlUp} pendingBaseLevel={pendingBaseLevel} rerollCost={rerollCost}
        cellSize={cellSize} onCellSizeChange={setCellSize}
        gridCols={gridCols} gridRows={gridRows} unlockedCells={unlockedCells}
        tutorialConfig={tutorialConfig}
        activeTab={activeTab} onTabChange={setActiveTab} hasAcademy={hasAcademy} hasBasePerks={pickedBasePerks.length > 0}
        showSellHint={showSellHint} onDismissSellHint={() => setShowSellHint(false)}
        showFrostHint={showFrostHint} onDismissFrostHint={() => setShowFrostHint(false)}
        musicVolume={musicVolume} onMusicVolumeChange={setMusicVolume}
        onInfoIconTap={() => {
          if (tutorial.active && tutorial.currentStep === 'introduce_info_icon') {
            setTutorial({ active: true, currentStep: 'introduce_durability' })
          }
        }}
        onStartBattle={() => {
          setRoundResult(null)
          setHasDeployedInPrep(false)
          setPhase('battle-prep')
        }}
        onPickUpgrade={applyUpgrade}
        onPickBasePerk={applyBasePerkChoice}
        onReroll={handleReroll}
        onSellItem={handleSellItem}
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
  grid, placedItems, shopSlots,
  gridRef, roundResult, buffGrants, pendingLvlUp, pendingBaseLevel, rerollCost,
  cellSize, onCellSizeChange, gridCols, gridRows, unlockedCells, tutorialConfig,
  activeTab, onTabChange, hasAcademy, hasBasePerks,
  showSellHint, onDismissSellHint,
  showFrostHint, onDismissFrostHint,
  musicVolume, onMusicVolumeChange,
  onInfoIconTap,
  onStartBattle, onPickUpgrade, onPickBasePerk, onReroll, onSellItem,
}: {
  gold: number; mana: number; manaNeeded: number; level: number; wave: number
  xp: number; xpNeeded: number; baseLevel: number
  grid: GridState; placedItems: Map<string, PlacedItem>
  shopSlots: ShopSlot[]; gridRef: React.RefObject<HTMLDivElement | null>
  roundResult: RoundResult | null; buffGrants: BuffGrant[]
  pendingLvlUp: PendingLevelUp | null; pendingBaseLevel: PendingBaseLevel | null; rerollCost: number
  cellSize: number; onCellSizeChange: (cs: number) => void
  gridCols: number; gridRows: number; unlockedCells: number
  tutorialConfig: ReturnType<typeof getStepConfig>
  activeTab: Tab; onTabChange: (t: Tab) => void; hasAcademy: boolean; hasBasePerks: boolean
  showSellHint: boolean; onDismissSellHint: () => void
  showFrostHint: boolean; onDismissFrostHint: () => void
  musicVolume: number; onMusicVolumeChange: (v: number) => void
  onInfoIconTap?: () => void
  onStartBattle: () => void
  onPickUpgrade: (u: Upgrade) => void
  onPickBasePerk: (p: BasePerk) => void
  onReroll: () => void
  onSellItem: (itemId: string) => void
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
          <span className="resource">
            <span className="resource-icon">🏰</span>
            <span className="mana-bar-wrap">
              <span className="mana-bar-fill" style={{ width: `${(mana / manaNeeded) * 100}%` }} />
            </span>
            <span className="mana-text">{mana}/{manaNeeded}</span>
          </span>
          <span className="resource">
            <span className="resource-label">Base.<strong>{baseLevel}</strong></span>
            <span className="xp-bar-wrap">
              <span className="xp-bar-fill" style={{ width: `${(xp / xpNeeded) * 100}%` }} />
            </span>
            <span className="xp-text">{xp}/{xpNeeded}</span>
          </span>
        </div>
      </header>

      {buffGrants.length > 0 && (
        <div className="buffs-bar">
          {buffGrants.map((g, i) => (
            <span key={i} className="buff-chip">
              {g.upgrade.icon} {g.upgrade.title} <span className="buff-waves">({g.wavesLeft})</span>
            </span>
          ))}
        </div>
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
      </section>

      <section className={`zone shop-zone${tutorialConfig?.highlightShop ? ' tutorial-highlight' : ''}`}>
        <div className="zone-label">Shop</div>
        <Shop
          slots={shopSlots} gold={gold} rerollCost={rerollCost}
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

      {pendingLvlUp && (
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

      <BottomNav activeTab={activeTab} hasAcademy={hasAcademy} hasBasePerks={hasBasePerks} onTabChange={onTabChange} />

      {/* ── Sell confirmation modal ── */}
      {pendingSell && (
        <div className="settings-backdrop" onClick={() => setPendingSell(null)}>
          <div className="sell-confirm-panel" onClick={e => e.stopPropagation()}>
            <div className="sell-confirm-icon">{pendingSell.item.def.image
              ? <img src={pendingSell.item.def.image} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
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
}) {
  const pendingSpellRef = useRef<{ kind: string; x: number; y: number } | null>(null)
  const battleWrapperRef = useRef<HTMLDivElement>(null)

  const [spellDrag, setSpellDrag] = useState<{ kind: SpellKind; clientX: number; clientY: number } | null>(null)
  const [cooldowns, setCooldowns] = useState<Partial<Record<SpellKind, number>>>({})

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
