import './World1CompleteScreen.css'

interface Props {
  onContinue: () => void
}

export default function World1CompleteScreen({ onContinue }: Props) {
  return (
    <div className="w1c-screen">
      {/* Background glow */}
      <div className="w1c-bg" />

      <div className="w1c-content">
        {/* Badge */}
        <div className="w1c-badge">⚔️</div>

        {/* World label */}
        <p className="w1c-world-label">World 1 Complete</p>

        {/* Title */}
        <h1 className="w1c-title">Vikings Invasion</h1>

        {/* Divider */}
        <div className="w1c-divider" />

        {/* Flavour text */}
        <p className="w1c-flavour">
          The Trojan Horse has fallen. Your village stands.<br />
          The Viking tribes are united — and ready for what comes next.
        </p>

        {/* Stars */}
        <div className="w1c-stars">
          <span className="w1c-star w1c-star--lit">★</span>
          <span className="w1c-star w1c-star--lit">★</span>
          <span className="w1c-star w1c-star--lit">★</span>
        </div>

        {/* CTA */}
        <button className="w1c-btn" onClick={onContinue}>
          Choose Your Next World →
        </button>
      </div>
    </div>
  )
}
