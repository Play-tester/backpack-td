import type { Buffs, BasePerk } from '../lib/levelup'
import './BaseScreen.css'

interface Props {
  baseLevel: number
  xp: number
  xpNeeded: number
  permBuffs: Buffs
  pickedBasePerks: BasePerk[]
}

export default function BaseScreen({ baseLevel, xp, xpNeeded, permBuffs, pickedBasePerks }: Props) {
  const dmgPct = Math.round((permBuffs.damageBonus - 1) * 100)
  const spdPct = Math.round((permBuffs.speedBonus - 1) * 100)
  const rngPct = Math.round((permBuffs.rangeBonus - 1) * 100)
  const ecoPct = Math.round((permBuffs.ecoBonus - 1) * 100)

  const hasAnyBonus = dmgPct > 0 || spdPct > 0 || rngPct > 0 || permBuffs.extraBaseIncome > 0 || ecoPct > 0

  return (
    <div className="base-screen">
      <h2 className="base-title">Base</h2>

      <div className="base-level-row">
        <div className="base-lv-badge">Lv.{baseLevel}</div>
        <div className="base-xp-track">
          <div className="base-xp-fill" style={{ width: `${(xp / xpNeeded) * 100}%` }} />
        </div>
        <div className="base-xp-text">{xp}/{xpNeeded} xp</div>
      </div>

      <div className="base-section">
        <div className="base-section-label">Permanent Bonuses</div>
        {hasAnyBonus ? (
          <div className="base-stats-grid">
            {dmgPct > 0 && (
              <div className="base-stat">
                <span className="base-stat-icon">⚔</span>
                <span className="base-stat-name">Damage</span>
                <span className="base-stat-val">+{dmgPct}%</span>
              </div>
            )}
            {spdPct > 0 && (
              <div className="base-stat">
                <span className="base-stat-icon">⚡</span>
                <span className="base-stat-name">Speed</span>
                <span className="base-stat-val">+{spdPct}%</span>
              </div>
            )}
            {rngPct > 0 && (
              <div className="base-stat">
                <span className="base-stat-icon">◎</span>
                <span className="base-stat-name">Range</span>
                <span className="base-stat-val">+{rngPct}%</span>
              </div>
            )}
            {permBuffs.extraBaseIncome > 0 && (
              <div className="base-stat">
                <span className="base-stat-icon">💎</span>
                <span className="base-stat-name">Income</span>
                <span className="base-stat-val">+{permBuffs.extraBaseIncome}g</span>
              </div>
            )}
            {ecoPct > 0 && (
              <div className="base-stat">
                <span className="base-stat-icon">🛒</span>
                <span className="base-stat-name">Economy</span>
                <span className="base-stat-val">+{ecoPct}%</span>
              </div>
            )}
          </div>
        ) : (
          <div className="base-no-bonuses">No bonuses yet — gain XP by winning battles</div>
        )}
      </div>

      {pickedBasePerks.length > 0 && (
        <div className="base-section">
          <div className="base-section-label">Applied Perks ({pickedBasePerks.length})</div>
          <div className="base-perks-list">
            {pickedBasePerks.map((perk, i) => (
              <div key={i} className="base-perk-row">
                <span className="base-perk-icon">{perk.icon}</span>
                <span className="base-perk-name">{perk.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pickedBasePerks.length === 0 && (
        <div className="base-empty">
          <div className="base-empty-icon">🏰</div>
          <div className="base-empty-text">
            Win battles to earn XP and unlock permanent perks for your kingdom
          </div>
        </div>
      )}
    </div>
  )
}
