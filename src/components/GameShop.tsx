import { useEffect, useState } from 'react'
import './GameShop.css'
import {
  SHOP_SECTIONS, adUsesRemaining, adCooldownMs, recordAdView, openChest,
  type ShopItem, type ChestReward, type ShopItemId,
} from '../lib/gameShop'

interface Props {
  gold:    number
  wood:    number
  runes:   number
  onClose: () => void
  onEarn:  (reward: { gold?: number; wood?: number; runes?: number }) => void
}

function fmtCooldown(ms: number): string {
  if (ms <= 0) return ''
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function simulateRewardedAd(): Promise<boolean> {
  return new Promise(resolve => setTimeout(() => resolve(true), 800))
}

export default function GameShop({ gold, wood, runes, onClose, onEarn }: Props) {
  const [, setTick]           = useState(0)
  const [loading, setLoading] = useState<ShopItemId | null>(null)
  const [chestResult, setChestResult] = useState<ChestReward | null>(null)

  // Tick every second to keep countdowns live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  async function handleAdItem(item: ShopItem) {
    if (loading) return
    if (adUsesRemaining(item) <= 0) return
    setLoading(item.id)
    const rewarded = await simulateRewardedAd()
    setLoading(null)
    if (!rewarded) return
    recordAdView(item)
    if (item.reward.chestTier) {
      const result = openChest(item.reward.chestTier)
      setChestResult(result)
      onEarn(result)
    } else {
      onEarn(item.reward)
    }
  }

  function handleBuyItem(item: ShopItem) {
    if (!item.runesCost) return
    if (runes < item.runesCost) return
    onEarn({ runes: -item.runesCost })
    if (item.reward.chestTier) {
      const result = openChest(item.reward.chestTier)
      setChestResult(result)
      onEarn(result)
    } else {
      onEarn(item.reward)
    }
  }

  return (
    <div className="gshop-root">

      {/* Header */}
      <div className="gshop-header">
        <h2 className="gshop-title">🏪 Shop</h2>
        <button className="gshop-close" onClick={onClose}>✕</button>
      </div>

      {/* Resource bar */}
      <div className="gshop-resources">
        <div className="gshop-res"><span>🪙</span><strong>{gold}</strong></div>
        <div className="gshop-res"><span>🪵</span><strong>{wood}</strong></div>
        <div className="gshop-res"><span>💎</span><strong>{runes}</strong></div>
      </div>

      {/* Scrollable body — all sections stacked */}
      <div className="gshop-scroll">
        {SHOP_SECTIONS.map((section, si) => (
          <div key={si}>
            <div className="gshop-section-label">{section.label}</div>
            <div className="gshop-items">
              {section.items.map(item => {
                const remaining  = adUsesRemaining(item)
                const cooldownMs = adCooldownMs(item)
                const isLoading  = loading === item.id
                const hasAd      = !!item.adKey
                const hasBuy     = !!item.runesCost
                const canAd      = hasAd && remaining > 0
                const canBuy     = hasBuy && runes >= item.runesCost!

                return (
                  <div key={item.id} className="gshop-item">
                    <div className="gshop-item-emoji">{item.emoji}</div>
                    <div className="gshop-item-label">{item.label}</div>
                    <div className="gshop-item-desc">{item.description}</div>

                    {hasAd && (
                      <button
                        className={`gshop-btn gshop-btn--ad${!canAd ? ' gshop-btn--disabled' : ''}`}
                        onClick={() => canAd && handleAdItem(item)}
                        disabled={!canAd || !!loading}
                      >
                        {isLoading ? '⏳…' : canAd
                          ? `▶ Ad (${remaining} left)`
                          : cooldownMs > 0
                            ? `⏱ ${fmtCooldown(cooldownMs)}`
                            : 'Limit reached'}
                      </button>
                    )}

                    {hasBuy && (
                      <button
                        className={`gshop-btn gshop-btn--buy${!canBuy ? ' gshop-btn--disabled' : ''}`}
                        onClick={() => canBuy && handleBuyItem(item)}
                        disabled={!canBuy}
                      >
                        💎 {item.runesCost}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Chest result popup */}
      {chestResult && (
        <div className="gshop-chest-result" onClick={() => setChestResult(null)}>
          <div className="gshop-chest-panel" onClick={e => e.stopPropagation()}>
            <div className="gshop-chest-title">📦 Chest Opened!</div>
            <div className="gshop-chest-rewards">
              {chestResult.gold  > 0 && <div className="gshop-chest-row">🪙 <strong>+{chestResult.gold}</strong> Gold</div>}
              {chestResult.wood  > 0 && <div className="gshop-chest-row">🪵 <strong>+{chestResult.wood}</strong> Wood</div>}
              {chestResult.runes > 0 && <div className="gshop-chest-row">💎 <strong>+{chestResult.runes}</strong> Runes</div>}
            </div>
            <button className="gshop-chest-btn" onClick={() => setChestResult(null)}>Nice!</button>
          </div>
        </div>
      )}
    </div>
  )
}
