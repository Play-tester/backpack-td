import './ShieldBearerIntroScreen.css'

interface Props {
  onClose: () => void
}

export default function ShieldBearerIntroScreen({ onClose }: Props) {
  return (
    <div className="sb-intro-overlay" onClick={onClose}>
      <div className="sb-intro-panel" onClick={e => e.stopPropagation()}>

        <div className="sb-intro-header">
          <span className="sb-intro-tag">New Enemy</span>
          <h2 className="sb-intro-title">Shield Bearer</h2>
        </div>

        {/* Sprite preview */}
        <div className="sb-intro-sprite-wrap">
          <img src="/shield_bearer_a.png" alt="Shield Bearer" className="sb-intro-sprite" />
        </div>

        <p className="sb-intro-desc">
          Celtic Shield Bearers have entered the battlefield. Their massive round shields
          absorb most arrow damage — <strong>archer towers deal only 20% damage</strong> against them.
        </p>

        {/* Stat pills */}
        <div className="sb-intro-stats">
          <div className="sb-intro-stat">
            <span className="sb-intro-stat-label">Armor</span>
            <span className="sb-intro-stat-value sb-intro-stat-value--danger">-80% Arrow DMG</span>
          </div>
          <div className="sb-intro-stat">
            <span className="sb-intro-stat-label">Weakness</span>
            <span className="sb-intro-stat-value sb-intro-stat-value--good">Cannon · Frost</span>
          </div>
        </div>

        <div className="sb-intro-tip">
          💡 Tip: Use Cannon or Frost towers — or craft <strong>Piercing Arrows</strong> to
          cut through their shields.
        </div>

        <button className="sb-intro-btn" onClick={onClose}>
          Got it — Show me Crafting →
        </button>
      </div>
    </div>
  )
}
