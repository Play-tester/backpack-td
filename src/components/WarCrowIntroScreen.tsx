import './ShieldBearerIntroScreen.css'
import './WarCrowIntroScreen.css'

interface Props {
  onClose: () => void
}

export default function WarCrowIntroScreen({ onClose }: Props) {
  return (
    <div className="sb-intro-overlay" onClick={onClose}>
      <div className="sb-intro-panel" onClick={e => e.stopPropagation()}>

        <div className="sb-intro-header">
          <span className="sb-intro-tag wc-intro-tag">New Enemy</span>
          <h2 className="sb-intro-title">War Crow</h2>
        </div>

        {/* Sprite preview — crow sheet is 887×1774, frames stacked vertically */}
        <div className="sb-intro-sprite-wrap wc-intro-sprite-wrap">
          <img src="/crow_a.png" alt="War Crow" className="sb-intro-sprite wc-intro-sprite" />
        </div>

        <p className="sb-intro-desc">
          War Crows soar above the battlefield, <strong>ignoring all ground paths</strong>.
          Archer, Cannon and Frost towers cannot reach them — but ranged heroes,
          Academy skills, and the <strong>Ballista</strong> can bring them down.
        </p>

        <div className="sb-intro-stats">
          <div className="sb-intro-stat">
            <span className="sb-intro-stat-label">Movement</span>
            <span className="sb-intro-stat-value sb-intro-stat-value--danger">Aerial — ignores paths</span>
          </div>
          <div className="sb-intro-stat">
            <span className="sb-intro-stat-label">Can hit</span>
            <span className="sb-intro-stat-value sb-intro-stat-value--good">Ballista · Heroes · Skills</span>
          </div>
        </div>

        <div className="sb-intro-tip">
          💡 Tip: Research the <strong>Ballista Tower</strong> in the Crafting tab —
          it deals full damage to aerial enemies and 50% to ground.
          Ullr and Skaði also target crows automatically.
        </div>

        <button className="sb-intro-btn" onClick={onClose}>
          Got it — Research Ballista →
        </button>

      </div>
    </div>
  )
}
