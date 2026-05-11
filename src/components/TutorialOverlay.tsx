import { type TutorialStepConfig } from '../lib/tutorial'
import './TutorialOverlay.css'

interface Props {
  config: TutorialStepConfig
  battle?: boolean
}

export default function TutorialOverlay({ config, battle }: Props) {
  if (!config.instruction) return null

  return (
    <div className={`tutorial-overlay${battle ? ' tutorial-overlay--battle' : ''}`}>
      <div className="tutorial-instruction">
        {config.instruction}
      </div>
    </div>
  )
}
