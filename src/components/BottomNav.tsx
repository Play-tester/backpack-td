import './BottomNav.css'

export type Tab = 'battle' | 'base' | 'heroes' | 'crafting' | 'shop'

interface Props {
  activeTab: Tab
  hasBasePerks: boolean
  hasAcademy: boolean
  hasHeroes: boolean
  hasCrafting: boolean
  heroesTabPulse?: boolean
  craftingTabPulse?: boolean
  onTabChange: (tab: Tab) => void
}

export default function BottomNav({ activeTab, hasBasePerks, hasAcademy: _hasAcademy, hasHeroes, hasCrafting, heroesTabPulse, craftingTabPulse, onTabChange }: Props) {
  const baseUnlocked = hasBasePerks

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-btn${activeTab === 'crafting' ? ' nav-active' : ''}${!hasCrafting ? ' nav-locked' : ''}${craftingTabPulse ? ' nav-pulse' : ''}`}
        onClick={() => hasCrafting && onTabChange('crafting')}
        disabled={!hasCrafting}
      >
        <span className="nav-icon">{hasCrafting ? '⚒️' : '🔒'}</span>
        <span className="nav-label">Crafting</span>
        {craftingTabPulse && <span className="nav-pulse-dot" />}
      </button>
      <button
        className={`nav-btn${activeTab === 'heroes' ? ' nav-active' : ''}${!hasHeroes ? ' nav-locked' : ''}${heroesTabPulse ? ' nav-pulse' : ''}`}
        onClick={() => hasHeroes && onTabChange('heroes')}
        disabled={!hasHeroes}
      >
        <span className="nav-icon"><img src="/Heroes/heroes_nav_icon.png" alt="Heroes" className="nav-heroes-icon" /></span>
        <span className="nav-label">Heroes</span>
        {!hasHeroes && <span className="nav-lock-badge">🔒</span>}
        {heroesTabPulse && <span className="nav-pulse-dot" />}
      </button>
      <button
        className={`nav-btn nav-btn-battle${activeTab === 'battle' ? ' nav-active' : ''}`}
        onClick={() => onTabChange('battle')}
      >
        <span className="nav-icon">⚔</span>
        <span className="nav-label">Battle</span>
      </button>
      <button
        className={`nav-btn${activeTab === 'shop' ? ' nav-active' : ''}`}
        onClick={() => onTabChange('shop')}
      >
        <span className="nav-icon">🏪</span>
        <span className="nav-label">Shop</span>
      </button>
      <button
        className={`nav-btn${activeTab === 'base' ? ' nav-active' : ''}${!baseUnlocked ? ' nav-soft-locked' : ''}`}
        onClick={() => onTabChange('base')}
      >
        <span className="nav-icon">🏰</span>
        <span className="nav-label">Base</span>
        {!baseUnlocked && <span className="nav-lock-badge">🔒</span>}
      </button>
    </nav>
  )
}
