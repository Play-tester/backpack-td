import './BottomNav.css'

export type Tab = 'battle' | 'base' | 'academy'

interface Props {
  activeTab: Tab
  hasBasePerks: boolean
  hasAcademy: boolean
  onTabChange: (tab: Tab) => void
}

export default function BottomNav({ activeTab, hasBasePerks, hasAcademy, onTabChange }: Props) {
  const baseUnlocked    = hasBasePerks
  const academyUnlocked = hasAcademy

  return (
    <nav className="bottom-nav">
      <button className="nav-btn nav-locked" disabled>
        <span className="nav-icon">🔒</span>
        <span className="nav-label">Crafting</span>
      </button>
      <button className="nav-btn nav-locked" disabled>
        <span className="nav-icon">🔒</span>
        <span className="nav-label">Heroes</span>
      </button>
      <button
        className={`nav-btn nav-btn-battle${activeTab === 'battle' ? ' nav-active' : ''}`}
        onClick={() => onTabChange('battle')}
      >
        <span className="nav-icon">⚔</span>
        <span className="nav-label">Battle</span>
      </button>
      <button
        className={`nav-btn${activeTab === 'academy' ? ' nav-active' : ''}${!academyUnlocked ? ' nav-soft-locked' : ''}`}
        onClick={() => onTabChange('academy')}
      >
        <span className="nav-icon">🎓</span>
        <span className="nav-label">Academy</span>
        {!academyUnlocked && <span className="nav-lock-badge">🔒</span>}
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
