import './CraftingScreen.css'
import { CRAFTING_UPGRADES, type CraftingState } from '../lib/crafting'

interface Props {
  gold: number
  wood: number
  wave: number
  craftingState: CraftingState
  onUpgrade: (upgradeId: string) => void
  showVillageGiftPopup?: boolean
  onCloseVillageGift?: () => void
}

export default function CraftingScreen({
  gold, wood, wave, craftingState, onUpgrade,
  showVillageGiftPopup, onCloseVillageGift,
}: Props) {
  return (
    <div className="crafting-root">
      {/* Resource bar */}
      <div className="crafting-resource-bar">
        <div className="crafting-resource">
          <span className="crafting-resource-icon">💰</span>
          <span className="crafting-resource-value">{gold}</span>
        </div>
        <div className="crafting-resource">
          <span className="crafting-resource-icon">🪵</span>
          <span className="crafting-resource-value">{wood}</span>
          <span className="crafting-resource-label">Wood</span>
        </div>
      </div>

      <h2 className="crafting-title">Crafting</h2>
      <p className="crafting-subtitle">Forge upgrades to gain the edge in battle</p>

      <div className="crafting-upgrades">
        {Object.values(CRAFTING_UPGRADES).filter(upg => wave >= (upg.minWave ?? 0)).map(upg => {
          const level = craftingState[upg.id] ?? 0
          const maxed = level >= upg.maxLevel
          const costGold = upg.costGold(level)
          const costMats = upg.costMats(level)
          const woodCost = costMats.wood ?? 0

          const canAfford = gold >= costGold && wood >= woodCost

          const unresearched = level === 0

          // ── Silhouette card for unresearched upgrades ──────────────────────
          if (unresearched) {
            return (
              <div key={upg.id} className="crafting-card crafting-card--silhouette">
                <div className="crafting-card-header">
                  <span className="crafting-card-icon crafting-silhouette-icon">🔒</span>
                  <div className="crafting-card-info">
                    <span className="crafting-silhouette-bar crafting-silhouette-bar--name" />
                    <span className="crafting-silhouette-bar crafting-silhouette-bar--desc" />
                    <span className="crafting-silhouette-bar crafting-silhouette-bar--desc crafting-silhouette-bar--short" />
                  </div>
                </div>
                <button
                  className={`crafting-upgrade-btn ${canAfford ? '' : 'crafting-upgrade-btn--disabled'}`}
                  onClick={() => canAfford && onUpgrade(upg.id)}
                  disabled={!canAfford}
                >
                  <span className="crafting-cost">
                    💰 {costGold}
                    {woodCost > 0 && <> &nbsp; 🪵 {woodCost}</>}
                  </span>
                  <span className="crafting-upgrade-label">Unlock</span>
                </button>
              </div>
            )
          }

          // ── Normal card for researched upgrades ────────────────────────────
          return (
            <div key={upg.id} className={`crafting-card ${maxed ? 'crafting-card--maxed' : ''}`}>
              <div className="crafting-card-header">
                <span className="crafting-card-icon">{upg.icon}</span>
                <div className="crafting-card-info">
                  <span className="crafting-card-name">{upg.name}</span>
                  <span className="crafting-card-desc">{upg.description}</span>
                </div>
              </div>

              {/* Tier pips */}
              <div className="crafting-tier-row">
                {Array.from({ length: upg.maxLevel }).map((_, i) => (
                  <div key={i} className={`crafting-pip ${i < level ? 'crafting-pip--filled' : ''}`} />
                ))}
                <span className="crafting-tier-label">
                  {maxed ? 'MAX' : `Tier ${level + 1} / ${upg.maxLevel}`}
                </span>
              </div>

              {/* Effect */}
              {level > 0 && (
                <div className="crafting-effect">
                  ✓ {upg.effect(level)}
                </div>
              )}

              {/* Upgrade button */}
              {!maxed && (
                <button
                  className={`crafting-upgrade-btn ${canAfford ? '' : 'crafting-upgrade-btn--disabled'}`}
                  onClick={() => canAfford && onUpgrade(upg.id)}
                  disabled={!canAfford}
                >
                  <span className="crafting-cost">
                    💰 {costGold}
                    {woodCost > 0 && <> &nbsp; 🪵 {woodCost}</>}
                  </span>
                  <span className="crafting-upgrade-label">
                    {level === 0 ? 'Craft' : 'Upgrade'}
                  </span>
                </button>
              )}
              {maxed && (
                <div className="crafting-maxed-badge">⚒ Fully Upgraded</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Vikings Village gift popup */}
      {showVillageGiftPopup && (
        <div className="crafting-gift-overlay" onClick={onCloseVillageGift}>
          <div className="crafting-gift-panel" onClick={e => e.stopPropagation()}>
            <div className="crafting-gift-icon">🏘️</div>
            <h3 className="crafting-gift-title">Gift from the Vikings Village</h3>
            <p className="crafting-gift-desc">
              The village carpenters have sent you <strong>9 pieces of Wood</strong> to get you started.
              Earn more Wood by winning battles!
            </p>
            <div className="crafting-gift-amount">
              <span className="crafting-gift-wood">🪵 +9 Wood</span>
            </div>
            <button className="crafting-gift-btn" onClick={onCloseVillageGift}>
              Thank the Village!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
