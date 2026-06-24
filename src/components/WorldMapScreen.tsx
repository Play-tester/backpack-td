import './WorldMapScreen.css'

interface Props {
  world1Completed: boolean
  onSelectWorld1:  () => void
  onSelectWorld2:  () => void
}

const WORLDS = [
  {
    id: 1,
    name: 'Vikings Invasion',
    subtitle: 'Waves 1–10',
    icon: '⚔️',
    theme: 'viking',
    description: 'Unite the Viking tribes and repel the first wave of invaders. Face the Trojan Horse at wave 10.',
  },
  {
    id: 2,
    name: 'Celtic Kingdom',
    subtitle: 'Waves 11–20',
    icon: '🏰',
    theme: 'celtic',
    description: 'The Celts have breached the hills. A new enemy, new towers, new threats await.',
  },
]

export default function WorldMapScreen({ world1Completed, onSelectWorld1, onSelectWorld2 }: Props) {
  return (
    <div className="wmap-screen">
      <div className="wmap-header">
        <h1 className="wmap-title">Choose World</h1>
        <p className="wmap-subtitle">Your legend continues</p>
      </div>

      <div className="wmap-worlds">
        {/* World 1 */}
        <div className="wmap-card wmap-card--viking wmap-card--done" onClick={onSelectWorld1}>
          <div className="wmap-card-badge">✓ Complete</div>
          <div className="wmap-card-icon">{WORLDS[0].icon}</div>
          <div className="wmap-card-info">
            <span className="wmap-card-subtitle">{WORLDS[0].subtitle}</span>
            <h2 className="wmap-card-name">{WORLDS[0].name}</h2>
            <p className="wmap-card-desc">{WORLDS[0].description}</p>
          </div>
          <div className="wmap-card-stars">★★★</div>
          <button className="wmap-card-btn wmap-card-btn--replay">Replay</button>
        </div>

        {/* World 2 */}
        <div
          className={`wmap-card wmap-card--celtic${world1Completed ? '' : ' wmap-card--locked'}`}
          onClick={world1Completed ? onSelectWorld2 : undefined}
        >
          {!world1Completed && (
            <div className="wmap-card-lock">🔒</div>
          )}
          {world1Completed && (
            <div className="wmap-card-badge wmap-card-badge--new">New!</div>
          )}
          <div className="wmap-card-icon">{WORLDS[1].icon}</div>
          <div className="wmap-card-info">
            <span className="wmap-card-subtitle">{WORLDS[1].subtitle}</span>
            <h2 className="wmap-card-name">{WORLDS[1].name}</h2>
            <p className="wmap-card-desc">
              {world1Completed
                ? WORLDS[1].description
                : 'Complete Vikings Invasion to unlock.'}
            </p>
          </div>
          {world1Completed && (
            <button className="wmap-card-btn wmap-card-btn--start">Begin →</button>
          )}
        </div>
      </div>
    </div>
  )
}
