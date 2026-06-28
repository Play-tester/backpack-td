import type { SpellKind } from '../lib/spells'
import { ALL_SPELLS } from '../lib/spells'
import './AcademyScreen.css'

interface Props {
  hasAcademy: boolean
  unlockedSpells: SpellKind[]
  gold: number
  wave: number
  onUnlockSpell: (kind: SpellKind) => void
}

export default function AcademyScreen({ hasAcademy, unlockedSpells, gold, wave, onUnlockSpell }: Props) {
  return (
    <div className="academy-screen">
      <h2 className="academy-title">Academy</h2>

      {!hasAcademy && (
        <div className="academy-no-building">
          <div className="academy-lock-icon">🎓</div>
          <div className="academy-lock-msg">
            {wave < 8 ? (
              <>
                Academy building becomes available in the Reserves from{' '}
                <strong>Wave 8</strong>.<br />
                Purchase and place it in your backpack to unlock spells.
              </>
            ) : (
              <>
                Purchase an <strong>Academy</strong> building from the Reserves
                and place it in your backpack to unlock spells.
              </>
            )}
          </div>
        </div>
      )}

      <div className="academy-subtitle">
        {hasAcademy ? 'Unlock spells to use during battle' : 'Spells require Academy in backpack'}
      </div>

      <div className={`academy-spells${!hasAcademy ? ' academy-spells--locked' : ''}`}>
        {ALL_SPELLS.map(spell => {
          const unlocked  = hasAcademy && unlockedSpells.includes(spell.kind)
          const canAfford = gold >= spell.unlockCost
          return (
            <div key={spell.kind} className={`spell-card${unlocked ? ' spell-unlocked' : ''}`}>
              <div className="spell-icon">{spell.icon}</div>
              <div className="spell-info">
                <div className="spell-name">{spell.name}</div>
                <div className="spell-desc">{spell.description}</div>
                <div className="spell-mana">⏱ {spell.cooldown}s cooldown</div>
              </div>
              <div className="spell-action">
                {unlocked ? (
                  <div className="spell-unlocked-badge">✓</div>
                ) : (
                  <button
                    className={`spell-unlock-btn${!canAfford || !hasAcademy ? ' spell-unlock-btn--dim' : ''}`}
                    onClick={() => hasAcademy && canAfford && onUnlockSpell(spell.kind)}
                    disabled={!hasAcademy || !canAfford}
                  >
                    {spell.unlockCost}g
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
