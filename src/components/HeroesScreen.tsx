import { useState } from 'react'
import { ALL_HEROES, HERO_DEFS, type HeroKind, type HeroProgressMap } from '../lib/heroes'
import './HeroesScreen.css'

const HERO_PORTRAITS: Record<HeroKind, string> = {
  knight: '/Heroes/tyr_portrait.png',
  ranger: '/Heroes/ullr_portrait.png',
  mage:   '/Heroes/skadi_portrait.png',
}
const SHARD_ICON = '/Heroes/shard_crystal.png'

interface Props {
  heroProgress: HeroProgressMap
}

export default function HeroesScreen({ heroProgress }: Props) {
  const [tappedKind, setTappedKind]   = useState<HeroKind | null>(null)
  const [popupKind,  setPopupKind]    = useState<HeroKind | null>(null)

  function handleCardTap(kind: HeroKind) {
    setTappedKind(prev => prev === kind ? null : kind)
  }

  function handleInfoTap(kind: HeroKind, e: React.MouseEvent) {
    e.stopPropagation()
    setPopupKind(kind)
    setTappedKind(null)
  }

  const popupDef      = popupKind ? HERO_DEFS[popupKind]     : null
  const popupProgress = popupKind ? heroProgress[popupKind]  : null

  return (
    <div className="heroes-screen">
      <h2 className="heroes-title">Heroes</h2>
      <p className="heroes-subtitle">Collect shards to unlock powerful allies</p>

      <div className="heroes-grid">
        {ALL_HEROES.map(def => {
          const prog     = heroProgress[def.kind]
          const tapped   = tappedKind === def.kind
          const hasShard = prog.shards > 0
          const unlocked = prog.unlocked
          const portrait = HERO_PORTRAITS[def.kind]

          return (
            <div
              key={def.kind}
              className={`hero-card${unlocked ? ' hero-card--unlocked' : hasShard ? ' hero-card--seen' : ' hero-card--unknown'}${tapped ? ' hero-card--tapped' : ''}`}
              onClick={() => handleCardTap(def.kind)}
            >
              {/* Hero portrait */}
              <div className="hero-card-portrait">
                {unlocked ? (
                  <img src={portrait} alt={def.name} className="hero-card-img" />
                ) : hasShard ? (
                  <img src={portrait} alt={def.name} className="hero-card-img hero-card-img--silhouette" />
                ) : (
                  <span className="hero-card-unknown">?</span>
                )}
              </div>

              {/* Name */}
              <div className="hero-card-name">
                {hasShard || unlocked ? def.name : '???'}
              </div>

              {/* Shard progress bar */}
              <div className="hero-card-shards">
                <div className="shard-bar-track">
                  <div
                    className="shard-bar-fill"
                    style={{ width: `${Math.min(100, (prog.shards / def.shardsToUnlock) * 100)}%` }}
                  />
                </div>
                <span className="shard-bar-label">
                  {unlocked
                    ? '✓ Unlocked'
                    : <><img src={SHARD_ICON} alt="" className="shard-label-icon" />{prog.shards} / {def.shardsToUnlock}</>
                  }
                </span>
              </div>

              {/* Info button — appears on tap */}
              {tapped && (hasShard || unlocked) && (
                <button
                  className="hero-card-info-btn"
                  onClick={e => handleInfoTap(def.kind, e)}
                >
                  Info
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Hero info popup ── */}
      {popupDef && popupProgress && (
        <div className="hero-popup-overlay" onClick={() => setPopupKind(null)}>
          <div className="hero-popup" onClick={e => e.stopPropagation()}>
            <button className="hero-popup-close" onClick={() => setPopupKind(null)}>✕</button>

            {/* Big portrait */}
            <div className="hero-popup-portrait">
              <img
                src={HERO_PORTRAITS[popupDef.kind]}
                alt={popupDef.name}
                className={`hero-popup-img${!popupProgress.unlocked ? ' hero-popup-img--silhouette' : ''}`}
              />
            </div>

            <h3 className="hero-popup-name">{popupDef.name}</h3>
            <p  className="hero-popup-bio">{popupDef.bio}</p>

            {/* Stats */}
            <div className="hero-popup-stats">
              <HeroStat label="HP"         value={popupDef.hp} />
              <HeroStat label="Damage"     value={popupDef.damage} />
              <HeroStat label="Atk Speed"  value={`${popupDef.attackSpeed}/s`} />
              <HeroStat label="Range"      value={popupDef.attackRange === 40 ? 'Melee' : `${popupDef.attackRange}px`} />
              <HeroStat label="Move Speed" value={`${popupDef.speed}px/s`} />
            </div>

            {/* Ability */}
            <div className="hero-popup-ability">
              <span className="ability-label">Ability · {popupDef.ability.name}</span>
              <span className="ability-desc">{popupDef.ability.description}</span>
              <span className="ability-cd">Cooldown: {popupDef.ability.cooldown}s</span>
            </div>

            {/* Shard progress */}
            <div className="hero-popup-shards">
              <div className="shard-bar-track shard-bar-track--large">
                <div
                  className="shard-bar-fill"
                  style={{ width: `${Math.min(100, (popupProgress.shards / popupDef.shardsToUnlock) * 100)}%` }}
                />
              </div>
              <span className="shard-bar-label">
                {popupProgress.unlocked
                  ? '✓ Unlocked'
                  : <><img src={SHARD_ICON} alt="" className="shard-label-icon" />{popupProgress.shards} / {popupDef.shardsToUnlock} shards to unlock</>
                }
              </span>
            </div>

            {/* Upgrade button (placeholder) */}
            <button
              className={`hero-popup-upgrade${!popupProgress.unlocked ? ' hero-popup-upgrade--locked' : ''}`}
              disabled={!popupProgress.unlocked}
            >
              {popupProgress.unlocked
                ? '⬆ Upgrade'
                : <><img src={SHARD_ICON} alt="" className="shard-label-icon" />{popupProgress.shards}/{popupDef.shardsToUnlock} shards</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="hero-stat">
      <span className="hero-stat-label">{label}</span>
      <span className="hero-stat-value">{value}</span>
    </div>
  )
}
