import type { BasePerk, Upgrade } from '../lib/levelup'
import './LevelUpModal.css'

type Choice = Upgrade | BasePerk

interface Props {
  variant?: 'castle' | 'base'
  choices: [Choice, Choice, Choice]
  onPick: (choice: Choice) => void
  recommendedKind?: string
}

export default function LevelUpModal({ variant = 'castle', choices, onPick, recommendedKind }: Props) {
  const isBase = variant === 'base'
  return (
    <div className="modal-overlay">
      <div className={`modal${isBase ? ' modal-base' : ''}`}>
        <div className="modal-badge">
          {isBase ? '⚔ BASE LEVEL UP' : '🏰 CASTLE SUPPORT'}
        </div>
        <p className="modal-subtitle">
          {isBase ? 'Choose one permanent improvement' : 'Choose one blessing for your troops'}
        </p>

        <div className="upgrade-list">
          {choices.map(u => {
            const isRecommended = recommendedKind && u.kind === recommendedKind
            return (
              <button
                key={u.kind}
                className={`upgrade-card${isRecommended ? ' recommended' : ''}`}
                onClick={() => onPick(u)}
              >
                <span className="upgrade-icon">{u.icon}</span>
                <div className="upgrade-text">
                  <span className="upgrade-title">{u.title}</span>
                  <span className="upgrade-desc">{u.description}</span>
                </div>
                {isRecommended && <span className="upgrade-rec-badge">Rec.</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
