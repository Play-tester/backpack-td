import { useState } from 'react'
import './NarrativeScreen.css'

const SLIDES = [
  {
    image: '/narrative_1.png',
    lines: [
      'Your village is under siege.',
      'Waves of enemies are approaching.',
    ],
  },
  {
    image: '/narrative_2.png',
    lines: [
      'You have only what you can carry—and every placement matters.',
      'Space is limited. Choices are not.',
    ],
  },
  {
    image: '/narrative_3.png',
    lines: [
      'Build your strategy… before the enemy arrives.',
    ],
  },
] as const

interface Props {
  onComplete: () => void
}

export default function NarrativeScreen({ onComplete }: Props) {
  const [index, setIndex] = useState(0)

  function advance() {
    if (index < SLIDES.length - 1) {
      setIndex(i => i + 1)
    } else {
      onComplete()
    }
  }

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  return (
    <div className="narrative-screen" onClick={advance}>
      <img key={index} src={slide.image} alt="" className="narrative-img" draggable={false}
        style={index === 0 ? { filter: 'brightness(1.1)' } : undefined} />
      <div className="narrative-overlay">
        <div className="narrative-text">
          {slide.lines.map((line, i) => (
            <p key={i} className={i > 0 ? 'narrative-line narrative-line-sub' : 'narrative-line'}>
              {line}
            </p>
          ))}
        </div>
        <div className="narrative-footer">
          <div className="narrative-dots">
            {SLIDES.map((_, i) => (
              <span key={i} className={`narrative-dot${i === index ? ' active' : ''}`} />
            ))}
          </div>
          <span className="narrative-hint">{isLast ? 'Begin →' : 'Tap to continue'}</span>
        </div>
      </div>
    </div>
  )
}
