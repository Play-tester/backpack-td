import { useState } from 'react'
import './NarrativeScreen.css'

export interface NarrativeSlide {
  image: string
  lines: string[]
}

const DEFAULT_SLIDES: NarrativeSlide[] = [
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
]

interface Props {
  onComplete: () => void
  slides?: NarrativeSlide[]
}

export default function NarrativeScreen({ onComplete, slides = DEFAULT_SLIDES }: Props) {
  const [index, setIndex] = useState(0)

  function advance() {
    if (index < slides.length - 1) {
      setIndex(i => i + 1)
    } else {
      onComplete()
    }
  }

  const slide = slides[index]
  const isLast = index === slides.length - 1

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
            {slides.map((_, i) => (
              <span key={i} className={`narrative-dot${i === index ? ' active' : ''}`} />
            ))}
          </div>
          <span className="narrative-hint">{isLast ? 'Begin →' : 'Tap to continue'}</span>
        </div>
      </div>
    </div>
  )
}
