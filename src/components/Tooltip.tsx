import { getScaledDamage, getScaledGold, getScaledRange, getEconomicMultiplier, getMilitaryDamageMultiplier, getMilitaryRangeMultiplier } from '../lib/items'
import { SHAPE_OFFSETS, shapeDims, type Item, type ItemSize } from '../types'
import './Tooltip.css'

const SHAPE_LABEL: Record<string, string> = {
  '1x1': '1×1 · 1 cell',
  '1x2': '1×2 wide · 2 cells',
  '2x1': '2×1 tall · 2 cells',
  '2x2': '2×2 square · 4 cells',
  'L':   'L-shape · 3 cells',
  'T':   'T-shape · 4 cells',
  'S':   'S-shape · 4 cells',
}


// ── Tiny shape grid ────────────────────────────────────────────────────────
function MiniShape({ size, color }: { size: ItemSize; color: string }) {
  const { rows, cols } = shapeDims(size)
  const filled = new Set(SHAPE_OFFSETS[size].map(([r, c]) => `${r}-${c}`))
  const S = 12, GAP = 2
  return (
    <div style={{ display: 'grid',
      gridTemplateColumns: `repeat(${cols}, ${S}px)`,
      gridTemplateRows:    `repeat(${rows}, ${S}px)`,
      gap: GAP }} >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <div key={`${r}-${c}`} style={{
            background: filled.has(`${r}-${c}`) ? color : 'transparent',
            border: `1.5px solid ${filled.has(`${r}-${c}`) ? color : 'transparent'}`,
            borderRadius: 2, opacity: filled.has(`${r}-${c}`) ? 0.9 : 0,
          }} />
        ))
      )}
    </div>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────
interface Props {
  item: Item
  x: number    // container-local px
  y: number
}

const TIP_W = 228

export default function Tooltip({ item, x, y }: Props) {
  const { def, tier } = item
  const economicMult = def.category === 'economic' ? getEconomicMultiplier(tier) : 1
  const scaledSpeed = (def.attackSpeed ?? 1).toFixed(2)

  // Position above click; fall back to below if near top
  const left = Math.max(8, Math.min(x - TIP_W / 2, 390 - TIP_W - 8))
  const showBelow = y < 180
  const style = showBelow
    ? { left, top: y + 12 }
    : { left, bottom: 844 - y + 12 }   // anchor to bottom so overflow goes up

  return (
    <div className="tooltip" style={{ ...style, width: TIP_W }}>
      {/* ── Header ── */}
      <div className="tip-header" style={{ borderColor: def.color }}>
        <div className="tip-name-row">
          <span className="tip-name" style={{ color: def.color }}>{def.label}</span>
          {tier >= 2 && <span className="tip-tier-number">{tier}</span>}
        </div>
        <span className="tip-category">
          {def.category === 'military' ? '⚔ Military' : def.category === 'special' ? '🎓 Special' : '💰 Economic'}
        </span>
      </div>

      {/* ── Shape row ── */}
      <div className="tip-shape-row">
        <MiniShape size={def.size as ItemSize} color={def.color} />
        <span className="tip-shape-label">{SHAPE_LABEL[def.size] ?? def.size}</span>
      </div>

      <div className="tip-divider" />

      {/* ── Stats ── */}
      <div className="tip-stats">
        {def.category === 'military' && <>
          <StatRow icon="⚔" label="Damage"
            value={`${getScaledDamage(item)}${tier > 1 ? ` (×${getMilitaryDamageMultiplier(tier).toFixed(2)})` : ''}`} />
          <StatRow icon="⚡" label="Atk speed"    value={`${scaledSpeed}/s`} />
          <StatRow icon="◎" label="Range"
            value={`${getScaledRange(item).toFixed(1)}${tier > 1 ? ` (×${getMilitaryRangeMultiplier(tier).toFixed(2)})` : ''}`} />
          {def.kind === 'cannon' && <Tag>Splash — hits nearby enemies</Tag>}
          {def.kind === 'frost'  && <Tag>Slows enemies by 60%</Tag>}
        </>}
        {def.category === 'economic' && <>
          <StatRow icon="💰" label="Income"
            value={`+${getScaledGold(item)}g per round`} />
          {tier > 1 && (
            <StatRow icon="📈" label="Bonus"
              value={`×${economicMult.toFixed(2)} multiplier`} />
          )}
        </>}
        {def.kind === 'academy' && <Tag>🔮 Unlocks spells</Tag>}
      </div>
    </div>
  )
}

function StatRow({ icon, label, value, valueClass = '' }: {
  icon: string; label: string; value: string; valueClass?: string
}) {
  return (
    <div className="tip-stat-row">
      <span className="tip-stat-icon">{icon}</span>
      <span className="tip-stat-label">{label}</span>
      <span className={`tip-stat-value ${valueClass}`}>{value}</span>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <div className="tip-tag">{children}</div>
}
