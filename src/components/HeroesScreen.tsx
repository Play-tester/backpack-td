import { useState } from 'react'
import { ALL_HEROES, HERO_DEFS, SHARD_TIERS, getHeroTier, getActiveAbilities, type HeroKind, type HeroProgressMap } from '../lib/heroes'
import './HeroesScreen.css'

const HERO_PORTRAITS: Record<HeroKind, string> = {
  knight: '/Heroes/tyr_portrait.png',
  ranger: '/Heroes/ullr_portrait.png',
  mage:   '/Heroes/skadi_portrait.png',
}
const SHARD_ICON = '/Heroes/shard_crystal.png'

// Labels for tier milestone dots
const TIER_LABELS = ['Unlock', '+Stats', 'Ability 2', 'Skin', '+Stats', 'Ability 3']

interface Props {
  heroProgress: HeroProgressMap
}

export default function HeroesScreen({ heroProgress }: Props) {
  const [tappedKind, setTappedKind] = useState<HeroKind | null>(null)
  const [popupKind,  setPopupKind]  = useState<HeroKind | null>(null)

  function handleCardTap(kind: HeroKind) {
    setTappedKind(prev => prev === kind ? null : kind)
  }

  function handleInfoTap(kind: HeroKind, e: React.MouseEvent) {
    e.stopPropagation()
    setPopupKind(kind)
    setTappedKind(null)
  }

  const popupDef      = popupKind ? HERO_DEFS[popupKind]    : null
  const popupProgress = popupKind ? heroProgress[popupKind] : null

  return (
    <div className="heroes-screen">
      <h2 className="heroes-title">Heroes</h2>
      <p className="heroes-subtitle">Collect shards to unlock and upgrade powerful allies</p>

      <div className="heroes-grid">
        {ALL_HEROES.map(def => {
          const prog     = heroProgress[def.kind]
          const tapped   = tappedKind === def.kind
          const hasShard = prog.shards > 0
          const unlocked = prog.unlocked
          const tier     = getHeroTier(prog.shards)
          const portrait = HERO_PORTRAITS[def.kind]

          // Next tier info
          const nextTier = SHARD_TIERS.find(t => t.tier > tier)
          const prevTotal  = tier === 0 ? 0 : SHARD_TIERS[tier - 1].shardsTotal
          const nextTotal  = nextTier ? nextTier.shardsTotal : SHARD_TIERS[SHARD_TIERS.length - 1].shardsTotal
          const segShards  = prog.shards - prevTotal
          const segNeeded  = nextTotal - prevTotal
          const pct        = nextTier ? Math.min(1, segShards / segNeeded) : 1

          return (
            <div
              key={def.kind}
              className={`hero-card${unlocked ? ' hero-card--unlocked' : hasShard ? ' hero-card--seen' : ' hero-card--unknown'}${tapped && (hasShard || unlocked) ? ' hero-card--tapped' : ''}`}
              onClick={() => handleCardTap(def.kind)}
            >
              {/* Tier badge */}
              {tier > 0 && (
                <div className="hero-tier-badge">T{tier}</div>
              )}

              {/* Portrait */}
              <div className="hero-card-portrait">
                {hasShard || unlocked ? (
                  <img src={portrait} alt={def.name} className="hero-card-img" />
                ) : (
                  <span className="hero-card-unknown">?</span>
                )}
              </div>

              {/* Name */}
              <div className="hero-card-name">
                {hasShard || unlocked ? def.name : '???'}
              </div>

              {/* Shard progress */}
              <div className="hero-card-shards">
                <div className="shard-bar-track">
                  <div className="shard-bar-fill" style={{ width: `${pct * 100}%` }} />
                </div>
                <span className="shard-bar-label">
                  {!hasShard && !unlocked
                    ? <><img src={SHARD_ICON} alt="" className="shard-label-icon" />0 / 10</>
                    : nextTier
                      ? <><img src={SHARD_ICON} alt="" className="shard-label-icon" />{prog.shards} / {nextTier.shardsTotal} · {nextTier.label}</>
                      : '★ Max Tier'
                  }
                </span>
              </div>

              {/* Info button */}
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
                className="hero-popup-img"
              />
            </div>

            <h3 className="hero-popup-name">{popupDef.name}</h3>
            <p  className="hero-popup-bio">{popupDef.bio}</p>

            {/* ── Tier milestone track ── */}
            <TierTrack shards={popupProgress.shards} />

            {/* Stats (show effective values) */}
            {(() => {
              const tier = getHeroTier(popupProgress.shards)
              const t = tier > 0 ? SHARD_TIERS[tier - 1] : null
              const hpMult  = t?.hpMult  ?? 1
              const dmgMult = t?.dmgMult ?? 1
              return (
                <div className="hero-popup-stats">
                  <HeroStat label="HP"         value={Math.round(popupDef.hp     * hpMult)}  boosted={hpMult  > 1} />
                  <HeroStat label="Damage"     value={Math.round(popupDef.damage * dmgMult)} boosted={dmgMult > 1} />
                  <HeroStat label="Atk Speed"  value={`${popupDef.attackSpeed}/s`} />
                  <HeroStat label="Range"      value={popupDef.attackRange === 40 ? 'Melee' : `${popupDef.attackRange}px`} />
                  <HeroStat label="Move Speed" value={`${popupDef.speed}px/s`} />
                </div>
              )
            })()}

            {/* Active abilities */}
            <div className="hero-popup-abilities">
              {getActiveAbilities(popupDef, popupProgress.shards).map((ab, i) => (
                <div key={i} className={`hero-popup-ability${i === 0 ? '' : ' hero-popup-ability--bonus'}`}>
                  <span className="ability-label">
                    {i === 0 ? 'Ability' : i === 1 ? '2nd Ability ✦' : '3rd Ability ✦✦'} · {ab.name}
                  </span>
                  <span className="ability-desc">{ab.description}</span>
                  <span className="ability-cd">Cooldown: {ab.cooldown}s</span>
                </div>
              ))}

              {/* Locked upcoming abilities */}
              {getHeroTier(popupProgress.shards) < 3 && popupDef.ability2 && (
                <div className="hero-popup-ability hero-popup-ability--locked">
                  <span className="ability-label">🔒 2nd Ability · {popupDef.ability2.name}</span>
                  <span className="ability-desc">{popupDef.ability2.description}</span>
                  <span className="ability-cd">Unlocks at {SHARD_TIERS[2].shardsTotal} shards</span>
                </div>
              )}
              {getHeroTier(popupProgress.shards) < 6 && popupDef.ability3 && (
                <div className="hero-popup-ability hero-popup-ability--locked">
                  <span className="ability-label">🔒 3rd Ability · {popupDef.ability3.name}</span>
                  <span className="ability-desc">{popupDef.ability3.description}</span>
                  <span className="ability-cd">Unlocks at {SHARD_TIERS[5].shardsTotal} shards</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tier milestone track ───────────────────────────────────────────────────
function TierTrack({ shards }: { shards: number }) {
  const currentTier = getHeroTier(shards)
  const maxShards   = SHARD_TIERS[SHARD_TIERS.length - 1].shardsTotal

  return (
    <div className="tier-track-wrap">
      <div className="tier-track-bar-row">
        <div className="tier-track-bar">
          <div
            className="tier-track-bar-fill"
            style={{ width: `${Math.min(1, shards / maxShards) * 100}%` }}
          />
          {/* Milestone dots */}
          {SHARD_TIERS.map(t => (
            <div
              key={t.tier}
              className={`tier-dot${shards >= t.shardsTotal ? ' tier-dot--done' : ''}`}
              style={{ left: `${(t.shardsTotal / maxShards) * 100}%` }}
            />
          ))}
        </div>
      </div>
      {/* Tier label row */}
      <div className="tier-labels-row">
        {SHARD_TIERS.map((t, i) => (
          <div
            key={t.tier}
            className={`tier-label${shards >= t.shardsTotal ? ' tier-label--done' : currentTier === t.tier - 1 ? ' tier-label--next' : ''}`}
            style={{ left: `${(t.shardsTotal / maxShards) * 100}%` }}
          >
            {TIER_LABELS[i]}
            <span className="tier-label-shards">{t.shardsTotal}</span>
          </div>
        ))}
      </div>
      <div className="tier-shard-count">
        <img src={SHARD_ICON} alt="" className="shard-label-icon" /> {shards} / {maxShards} shards
      </div>
    </div>
  )
}

function HeroStat({ label, value, boosted }: { label: string; value: string | number; boosted?: boolean }) {
  return (
    <div className="hero-stat">
      <span className="hero-stat-label">{label}</span>
      <span className={`hero-stat-value${boosted ? ' hero-stat-value--boosted' : ''}`}>{value}</span>
    </div>
  )
}
