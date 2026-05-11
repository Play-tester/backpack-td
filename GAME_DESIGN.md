# BackpackTD - Game Design Document

## Overview

**BackpackTD** is a portrait-oriented tower defense roguelite game combining inventory management with strategic combat. Players manage a limited backpack grid, purchase and merge towers, and defend against waves of enemies.

- **Platform**: Web (TypeScript + React + Vite)
- **Screen Format**: 390×844px (iPhone 14 portrait)
- **Genre**: Tower Defense + Roguelite + Inventory Management
- **Run**: `npm run dev` in project directory

---

## Core Gameplay Loop

1. **Trade Phase**: Manage inventory, buy items from shop, merge towers
2. **Battle Prep**: Deploy military towers to battle slots
3. **Battle Phase**: Watch towers automatically attack enemies
4. **Results**: Collect rewards, handle broken items, level up
5. **Repeat**: Return to trade phase with new shop and progress

---

## Currency Systems

### Three-Currency Economy

| Currency | Icon | Earn Rate | Purpose |
|----------|------|-----------|---------|
| **Gold** | 💰 | Kills + Income | Purchase items from shop |
| **Mana** | 🏰 (purple bar) | 12 per kill | Unlock Castle Support (temporary buffs) |
| **XP** | Base.N (cyan bar) | 4 per kill | Unlock Base Level Up (permanent perks) |

**XP = 1/3 of Mana rate** → Base level-ups are rarer and more significant

### Gold Income Sources

**On Victory:**
- **Kill Gold**: 3g per enemy killed (varies by enemy type)
- **Base Income**: 5g + buffs (only on wins)
- **Economic Items**: Banks and Markets generate gold

**On Loss:**
- **Kill Gold**: Gold from enemies killed
- **Economic Gold**: 50% of normal income
- **Base Income**: 0g
- **Minimum**: Always at least 1g total

---

## Progression Systems

### Castle Support (Temporary Buffs)

**Triggered by**: Mana bar fills → Castle Support modal appears

**Duration**: All buffs last 3 waves

**Buff Pool** (pick 1 of 3 random):

| Icon | Name | Effect |
|------|------|--------|
| ⚔ | Sharpen Blades | +12.5% damage · 3 waves |
| ⚡ | Rapid Fire | +10% attack speed · 3 waves |
| ◎ | Eagle Eye | +12.5% range · 3 waves |
| 🏛 | Tax Collector | +2g base income · 3 waves |
| 📈 | Market Boom | +20% economic gold · 3 waves |
| 🔨 | Forged Steel | Restore all items to max durability (+1) |
| 💰 | Quick Profit | Gain 15 gold immediately |

**Stacking**: Multiple buffs stack multiplicatively

### Base Level Up (Permanent Perks)

**Triggered by**: XP bar fills → Base Level Up modal appears

**Duration**: Permanent for entire run

**Perk Pool** (pick 1 of 3):

| Icon | Name | Effect |
|------|------|--------|
| 🗡 | Veteran Soldiers | +5% tower damage (permanent) |
| 🥁 | War Drums | +5% attack speed (permanent) |
| 🗼 | Watchtower | +5% tower range (permanent) |
| 💎 | Treasury | +1g base income (permanent) |
| 🛒 | Trade Routes | +10% economic gold (permanent) |
| 📦 | Expand Storage | +1 backpack cell (permanent) |

**Special**: "Expand Storage" is **guaranteed** to appear in first base level-up

**Stacking**: Perks stack multiplicatively (e.g., 3× Veteran Soldiers = 1.05³ = +15.76% damage)

### Progression Curve

**XP Requirements**: `60 × 1.55^(level-1)`
- Level 1→2: 60 XP
- Level 2→3: 93 XP
- Level 3→4: 144 XP
- Level 4→5: 223 XP

**Mana Requirements**: Same as XP curve

---

## Inventory System

### Dynamic Grid System

**Starting Grid**: 2 columns × 3 rows = **6 cells**

**Maximum Grid**: 5 columns × 6 rows = **30 cells**

**Expansion Pattern** (via Expand Storage perk):
- 6 cells → 2×3 (start)
- 7-9 cells → 3×3
- 10-12 cells → 4×3
- 13-16 cells → 4×4
- 17-20 cells → 5×4
- 21-25 cells → 5×5
- 26-30 cells → 5×6 (max)

**Total Progression**: +24 cells through perks

### Item Shapes

Nine different item shapes with varying sizes:

| Shape | Size | Cells | Notes |
|-------|------|-------|-------|
| 1×1 | Square | 1 | Smallest |
| 1×2 | Wide | 2 | 2 cells horizontal |
| 2×1 | Tall | 2 | 2 cells vertical |
| 2×2 | Square | 4 | Large square |
| L | L-shape | 3 | 2×2 bounding box |
| rL | Reverse-L | 3 | 2×2 bounding box |
| T | T-shape | 4 | 2×3 bounding box |
| S | S-shape | 4 | 2×3 bounding box |
| P | P-shape | 5 | 2×3 bounding box (castle) |

**Mechanics**:
- Drag-and-drop placement
- Items can be freely moved within grid
- Items can overlap during drag (shows red preview)
- Merge detection when dragging identical items together

---

## Item System

### Item Categories

**Military** (combat towers):
- Archer
- Cannon
- Frost Tower

**Economic** (gold generation):
- Bank
- Market

### Item Tiers

**No Tier Limit** - Items can be merged infinitely

**Visual Indicators**:
- **Tier 1**: No indicator
- **Tier 2+**: Number badge in bottom-right corner (2, 3, 4...)

**Tier Borders**:
- Tier 1: Default white/transparent
- Tier 2: Gold border (#ffd700)
- Tier 3+: Pink/magenta glowing border (#ff6fff)

### Tier Scaling

#### Economic Items (Bank, Market)

**Formula**: `1.1^(tier-1)` (multiplicative)

| Tier | Multiplier | Gold Boost |
|------|------------|------------|
| 1 | 1.0× | Base |
| 2 | 1.1× | +10% |
| 3 | 1.21× | +21% |
| 4 | 1.331× | +33% |
| 5 | 1.464× | +46% |

#### Military Items (Towers)

**Damage Scaling**:
- T1→T2: +10% (1.0× → 1.1×)
- T2→T3: No change (1.1×)
- T3→T4: +10% (1.1× → 1.21×)
- T4→T5: No change (1.21×)
- T5+: +5% per tier (1.21× → 1.2705× → 1.334×...)

**Range Scaling**:
- T1→T2: No change (1.0×)
- T2→T3: +10% (1.0× → 1.1×)
- T3→T4: No change (1.1×)
- T4→T5: +10% (1.1× → 1.21×)
- T5+: No change (1.21×)

**Attack Speed**: No tier scaling (stays at base value)

### Merging System

**Requirements**:
- Same item type (e.g., Archer + Archer)
- Same tier level (e.g., Tier 2 + Tier 2)
- No maximum tier (infinite merging)

**Method**: Drag one item onto another of same kind/tier

**Result**: New item at +1 tier

**Durability**: Merged item keeps the **better durability** of the two (doesn't reset to max)

---

## Military Items (Towers)

### Archer
- **Shape**: 1×1 (1 cell)
- **Cost**: 3g (T1), 4g (T2), 6g (T3)
- **Color**: Green (#4ade80)
- **Base Damage**: 10
- **Attack Speed**: 2.0 attacks/sec
- **Range**: 3 (115px in battle)
- **Max Durability**: 3
- **Special**: Fast single-target

### Cannon
- **Shape**: P-shape (5 cells, 2×3 bounding box)
- **Cost**: 6g (T1), 9g (T2), 13g (T3)
- **Color**: Orange (#f97316)
- **Base Damage**: 35
- **Attack Speed**: 0.5 attacks/sec
- **Range**: 4 (165px in battle)
- **Max Durability**: 3
- **Special**: **Splash damage** (48px radius)

### Frost Tower
- **Shape**: 1×2 (2 cells wide)
- **Cost**: 4g (T1), 6g (T2), 9g (T3)
- **Color**: Blue (#38bdf8)
- **Base Damage**: 5
- **Attack Speed**: 1.5 attacks/sec
- **Range**: 3 (100px in battle)
- **Max Durability**: 3
- **Special**: **Slows enemies** by 60% for 2.5 seconds

---

## Economic Items

### Bank
- **Shape**: L-shape (3 cells, 2×2 bounding box)
- **Cost**: 5g (T1), 8g (T2), 11g (T3)
- **Color**: Gold (#fbbf24)
- **Gold Per Round**: 5g base
- **Image**: bank_v3.png (no cell borders)
- **Note**: Cannot be deployed to battle

### Market
- **Shape**: S-shape (4 cells, 2×3 bounding box)
- **Cost**: 8g (T1), 12g (T2), 18g (T3)
- **Color**: Purple (#a78bfa)
- **Gold Per Round**: 8g base
- **Note**: Cannot be deployed to battle, harder to place

---

## Durability System

**Applies to**: Military items only (Archer, Cannon, Frost)

**Starting Durability**: 3 hearts (max)

**Durability Loss**:
- **On Win**: -1 durability per item used in battle
- **On Loss**: No durability loss (can retry without penalty)

**Broken Items**:
- Items reaching 0 durability are **permanently removed**
- Shown in battle results popup: "💔 Broke: Archer 2, Cannon"

**Visual Indicator**:
- Health bar at bottom-middle of item (red gradient)
- Shows percentage: full bar = max durability, empty = breaking

**Restoration**:
- **Forged Steel** buff: Restores all items to max durability **+1**
- This is the only way to extend item lifespan

---

## Shop System

### Shop Mechanics

**Shop Slots**: 4 items per wave

**Refresh Timing**:
- New shop after each battle (win or loss)
- Shop advances to next wave on wins only

**Reroll System**:
- **Initial Cost**: 1g
- **Cost Increase**: +50% per reroll (1g → 2g → 3g → 5g...)
- **Reset**: Cost resets to 1g after each battle

### Shop Item Generation

**Item Pool**: All 5 item types (Archer, Cannon, Frost, Bank, Market)

**Tier Distribution**:
- **Waves 1-5**: All tier 1 items
- **Wave 6+**: 30% chance per slot for tier 2 (at 1.5× cost)

**Guaranteed Tower** (Waves 1-5):
- At least one military tower guaranteed in first 5 waves
- Always tier 1

### Item Pricing

**Base Costs**:
- Archer: 3g
- Frost: 4g
- Bank: 5g
- Cannon: 6g
- Market: 8g

**Tier Pricing**: `base_cost × 1.5^(tier-1)`

**Examples**:
- Archer T1: 3g, T2: 4g, T3: 6g
- Cannon T1: 6g, T2: 9g, T3: 13g

### Sell-Back System

**Sell Price**: 90% of purchase cost (rounded down)

**Method**: Click "$" button in upper-left of item

**Examples**:
- Archer T1: Buy 3g → Sell 2g
- Cannon T2: Buy 9g → Sell 8g
- Bank T3: Buy 11g → Sell 9g

---

## Battle System

### Battle Phases

1. **Trade Phase**: Shop and inventory management
2. **Battle Prep Phase**: Deploy towers to slots
3. **Battle Phase**: Auto-combat
4. **Result Phase**: Half-screen popup with stats

### Deployment System

**Battle Slots**:
- **Waves 1-3**: 3 deployment slots
- **Wave 4+**: 5 deployment slots

**Deployment Mechanics**:
- Drag military items from bench to slots
- Can swap items between slots
- Can drag back to bench to undeploy
- Must deploy at least 1 tower to launch

**Slot Positions**: Pre-defined positions on battle lane

### Enemy Types

| Type | HP | Speed | Gold | Notes |
|------|----|----|------|-------|
| Grunt | 90 | 65 px/s | 3g | Standard enemy |
| Runner | 50 | 115 px/s | 2g | Fast but fragile |

### Enemy Scaling

**HP Scaling**: `base_hp × 1.02^(wave-1)` (+2% per wave)

**Wave Progression**:
- Wave 1: 3 Grunts
- Wave 2: 5 Grunts
- Wave 3: 5 Grunts + Runners
- Wave 4: 7 Grunts + Runners
- Wave 5+: Count increases by 2 per wave

**Spawn Timing**:
- Base interval: 1.4 seconds
- Wave 6+: ±30% random jitter on spawn timing

### Battle Results

**Victory Condition**: ≤1 enemy escapes

**Defeat Condition**: >1 enemy escapes

**Result Popup** (half-screen bottom sheet):
- **Win**: Dark blue background
- **Loss**: Dark red background
- **Stats Shown**:
  - Kills vs Escaped
  - Gold earned (breakdown)
  - Mana earned
  - XP earned
  - Broken items (if any)
- **Buttons**:
  - Win: "Continue →"
  - Loss: "Retry"

**Phase Flow**:
- Battle phase continues until popup dismissed
- Popup must be dismissed to return to trade phase
- Wave only advances on victory

---

## Visual Design

### Screen Layout

**Header** (evenly distributed):
```
Gold: N | 🏰 [mana bar] N/N | Base.N [xp bar] N/N
```

**Active Buffs Bar** (below header):
- Shows temporary Castle Support buffs
- Format: `{icon} {name} ({waves_left})`
- Example: "⚔ Sharpen Blades (2)"

**Main Areas**:
- Backpack Zone (top): Grid + Deploy button
- Shop Zone (bottom): 4 item slots + Reroll button

### Color Scheme

**Backpack Zone**:
- Background: backpack_background.png
- Grid cells: `rgba(13, 27, 42, 0.55)` (semi-transparent)
- Border: 2px solid `rgba(30, 58, 95, 0.8)`

**Shop Zone**:
- Background: shop_background.png
- Slot cards: `rgba(10, 20, 40, 0.92)` (nearly opaque)
- Border: 2px solid `#3a6090`

**Progress Bars**:
- Mana: Purple gradient
- XP: Cyan gradient
- Durability: Red gradient (`#f87171` → `#dc2626`)

### Tier Display

**Location**: Bottom-right corner of items

**Styling**:
- Gold badge background (`rgba(255, 215, 0, 0.85)`)
- Black text (`rgba(0, 0, 0, 0.75)`)
- Rounded corners (3px)
- Font: 10px, weight 800

**Shown in**:
- Backpack grid
- Shop slots
- Battle prep (arena + bench)
- Battle phase bench
- Tooltips

---

## Technical Details

### Tech Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Language**: TypeScript (strict mode)
- **Rendering**: Canvas (battle) + DOM (UI)

### Key Files

**Core Systems**:
- `src/App.tsx` - Main game state machine
- `src/lib/levelup.ts` - Progression, buffs, perks
- `src/lib/items.ts` - Item definitions, scaling
- `src/lib/grid.ts` - Grid logic, placement
- `src/lib/shop.ts` - Shop generation, pricing

**Battle System**:
- `src/battle/engine.ts` - Pure battle simulation
- `src/battle/types.ts` - Battle type definitions
- `src/components/BattleCanvas.tsx` - Battle rendering

**UI Components**:
- `src/components/BackpackGrid.tsx` - Main inventory grid
- `src/components/Shop.tsx` - Shop interface
- `src/components/LevelUpModal.tsx` - Buff/perk selection
- `src/components/Tooltip.tsx` - Item info tooltips
- `src/components/BattleDeployScreen.tsx` - Tower deployment

### State Management

**Main State** (in App.tsx):
- `phase`: 'trade' | 'battle-prep' | 'battle'
- `gold`, `mana`, `xp`: Currency amounts
- `level`, `baseLevel`: Progression levels
- `grid`, `placedItems`: Inventory state
- `gridCols`, `gridRows`: Dynamic grid dimensions
- `bonusCells`: Extra cells unlocked
- `permBuffs`: Permanent buffs from base perks
- `buffGrants`: Active temporary buffs (with wave countdown)
- `shopSlots`: Current shop offerings
- `wave`: Current wave number

### Grid System

**Grid State**: `(string | null)[][]`
- 2D array of item IDs
- `null` = empty cell
- Dynamic dimensions based on unlocks

**Placed Items**: `Map<string, PlacedItem>`
- Maps item ID to `{ item, row, col }`
- Anchor position = top-left of item shape

**Validation**:
- Check all cells in bounds
- Check no overlap (except when merging)
- Check cells available for shape

---

## Game Balance

### Starting Resources
- **Gold**: 10g
- **Backpack**: 6 cells (2×3)
- **Shop**: 4 slots, 1g reroll

### Early Game (Waves 1-5)
- Guaranteed military tower in shop
- Only tier 1 items
- Simple enemy compositions
- Build basic economy

### Mid Game (Waves 6-10)
- Tier 2 items appear (30% chance)
- Mixed enemy types
- Faster spawn rates
- Grid expansion becomes important

### Late Game (Wave 11+)
- Higher tier items common
- Enemy HP scaling accelerates
- Permanent perks stack significantly
- Grid optimization crucial

### Economy Balance
- **Starting cash**: 10g (2-3 items)
- **Per-wave income**: ~10-20g (with economy)
- **Loss penalty**: 50% economy, 0 base income, but +1g minimum
- **Reroll cost**: Escalates quickly (discourages spam)
- **Sell penalty**: 10% loss (strategic liquidation)

### Difficulty Curve
- **HP Scaling**: +2% per wave (gentle but compounds)
- **Spawn Jitter**: Adds unpredictability wave 6+
- **Durability Pressure**: Items break, forcing turnover
- **Grid Constraints**: Limited space = tough choices

---

## Strategic Depth

### Key Decisions

**Economy vs Military**:
- Banks/Markets generate gold but take space
- Pure military builds have higher damage but slower growth
- Hybrid builds balance both

**Tier vs Quantity**:
- Merge for powerful single towers
- Keep separate for coverage
- Shape considerations affect placement

**Grid Management**:
- Tetris-like puzzle
- Expand Storage vs combat buffs
- Item shapes create spatial challenges

**Durability Management**:
- When to use Forged Steel buff
- Which towers to replace vs repair
- Loss retry strategy (no durability loss)

**Buff Timing**:
- Temporary buffs last 3 waves
- Plan buff stacking
- Save powerful buffs for hard waves

### Synergies

**Frost + High Damage**: Slow effect amplifies DPS towers

**Market + Trade Routes**: Multiplicative economic scaling

**Veteran Soldiers + Sharpen Blades**: Stacking damage multipliers

**Multiple Banks**: Space-efficient with L-shape

**Splash Damage + Slow**: Cannon + Frost combo

---

## Future Considerations

### Potential Expansions
- New enemy types with abilities
- More tower types (poison, lightning, etc.)
- Boss waves
- Endless mode
- Daily challenges
- Achievements
- Meta-progression between runs

### Balance Levers
- Adjust tier scaling curves
- Tune enemy HP/speed scaling
- Modify buff/perk power levels
- Add/remove items from pools
- Adjust shop prices
- Change durability values

---

## Development Notes

### Design Principles
1. **Clarity**: All mechanics clearly telegraphed
2. **Depth**: Simple rules, complex interactions
3. **Fairness**: No hidden information, RNG is bounded
4. **Progression**: Always making progress, even on losses
5. **Constraint**: Limited space drives interesting choices

### Technical Decisions
- **Pure functions**: Battle engine is deterministic
- **Immutable updates**: Grid operations return new state
- **Component isolation**: Clear responsibility separation
- **Dynamic sizing**: Grid adapts to unlocks
- **Performance**: Canvas for battle, DOM for UI

### Memory System
- Auto-memory tracks architecture decisions
- Feedback captures what works/doesn't
- Project memory logs ongoing work
- Reference points to external resources

---

**Last Updated**: 2026-04-18
**Version**: 1.0
**Status**: Active Development
