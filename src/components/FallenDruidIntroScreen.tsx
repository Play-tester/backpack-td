import './ShieldBearerIntroScreen.css'
import './FallenDruidIntroScreen.css'

interface Props {
  onClose: () => void
}

export default function FallenDruidIntroScreen({ onClose }: Props) {
  return (
    <div className="sb-intro-overlay" onClick={onClose}>
      <div className="sb-intro-panel" onClick={e => e.stopPropagation()}>

        <div className="sb-intro-header">
          <span className="sb-intro-tag fd-intro-tag">New Enemy</span>
          <h2 className="sb-intro-title">Fallen Druid</h2>
        </div>

        {/* Sprite preview — druid sheet is 1774×887, frames horizontal */}
        <div className="sb-intro-sprite-wrap fd-intro-sprite-wrap">
          <img src="/druid_a.png" alt="Fallen Druid" className="sb-intro-sprite fd-intro-sprite" />
        </div>

        <p className="sb-intro-desc">
          Fallen Druids shift between the mortal and spirit worlds.
          Every few seconds they <strong>phase out</strong> — becoming immune
          to all damage for a brief moment. Plan around their cycle or
          pin them visible with a <strong>Lantern Tower</strong>.
        </p>

        <div className="sb-intro-stats">
          <div className="sb-intro-stat">
            <span className="sb-intro-stat-label">Ability</span>
            <span className="sb-intro-stat-value sb-intro-stat-value--danger">Phases out — immune 1s / 3s</span>
          </div>
          <div className="sb-intro-stat">
            <span className="sb-intro-stat-label">Counter</span>
            <span className="sb-intro-stat-value sb-intro-stat-value--good">Lantern Tower</span>
          </div>
        </div>

        <div className="sb-intro-tip">
          💡 Tip: Research the <strong>Lantern Tower</strong> in the Crafting tab.
          It pins Druids visible within its radius — and makes all nearby
          enemies take more damage from your towers.
        </div>

        <button className="sb-intro-btn" onClick={onClose}>
          Got it — Research Lantern →
        </button>

      </div>
    </div>
  )
}
