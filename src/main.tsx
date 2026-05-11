import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const GAME_W = 390
const GAME_H = 844

function ScaledGame() {
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H)
  )

  useEffect(() => {
    function update() {
      setScale(Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H))
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        width: GAME_W,
        height: GAME_H,
        flexShrink: 0,
      }}>
        <App />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScaledGame />
  </StrictMode>,
)
