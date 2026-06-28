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

const AD_VIDEO_ID = 'j964S-ku_P0'
const AD_DURATION_S = 57  // length of the Short in seconds

// Resolves true when the user has watched enough, false if they closed early
function showRewardedAd(): Promise<boolean> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,0.92);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:12px;
    `

    const iframe = document.createElement('iframe')
    iframe.src = `https://www.youtube.com/embed/${AD_VIDEO_ID}?autoplay=1&controls=0&rel=0&modestbranding=1&enablejsapi=1`
    iframe.allow = 'autoplay; fullscreen'
    iframe.style.cssText = 'width:360px;height:640px;border:none;border-radius:12px;'

    const bar = document.createElement('div')
    bar.style.cssText = 'color:#f5e6c0;font-family:sans-serif;font-size:14px;'
    bar.textContent = `Watch to earn reward…`

    const skipBtn = document.createElement('button')
    skipBtn.textContent = 'Skip (no reward)'
    skipBtn.style.cssText = `
      margin-top:4px;padding:8px 20px;
      background:transparent;border:2px solid #888;color:#aaa;
      border-radius:8px;font-size:13px;cursor:pointer;
    `

    overlay.append(iframe, bar, skipBtn)
    document.body.appendChild(overlay)

    let elapsed = 0
    let rewarded = false
    const tick = setInterval(() => {
      elapsed++
      const remaining = Math.max(0, AD_DURATION_S - elapsed)
      if (elapsed >= AD_DURATION_S) {
        rewarded = true
        bar.textContent = '✅ Reward earned!'
        skipBtn.textContent = 'Close'
        skipBtn.style.color = '#f5e6c0'
        skipBtn.style.borderColor = '#f5e6c0'
        clearInterval(tick)
        // Auto-close after 1s
        setTimeout(() => { document.body.removeChild(overlay); resolve(true) }, 1000)
      } else {
        bar.textContent = `Watch to earn reward… ${remaining}s`
      }
    }, 1000)

    skipBtn.onclick = () => {
      clearInterval(tick)
      document.body.removeChild(overlay)
      resolve(rewarded)
    }
  })
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
    setLoading(null)
    const rewarded = await showRewardedAd()
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
