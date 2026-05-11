// ── Tutorial System ────────────────────────────────────────────────────────

export type TutorialStep =
  | 'place_and_buy'
  | 'deploy_and_watch'
  | 'merge_and_expand'
  | 'introduce_economy'
  | 'introduce_shop'
  | 'introduce_info_icon'
  | 'introduce_durability'
  | 'complete'

export interface TutorialState {
  active: boolean
  currentStep: TutorialStep | null
}

export interface TutorialStepConfig {
  step: TutorialStep
  wave: number
  instruction: string
  highlightShop: boolean
  highlightBackpack: boolean
  highlightBattleBtn: boolean
  highlightInfoBtn: boolean
  allowReroll: boolean
  allowMerge: boolean
  allowEconomy: boolean
  forceShopItems?: string[]  // Force specific items in shop (by kind)
  limitEnemies?: number      // Limit enemy count for this step
}

export const TUTORIAL_STEPS: Record<TutorialStep, TutorialStepConfig> = {
  place_and_buy: {
    step: 'place_and_buy',
    wave: 1,
    instruction: '👉 Drag this tower into your backpack',
    highlightShop: true,
    highlightBackpack: true,
    highlightBattleBtn: false,
    highlightInfoBtn: false,
    allowReroll: false,
    allowMerge: false,
    allowEconomy: false,
    forceShopItems: ['archer'],
  },
  deploy_and_watch: {
    step: 'deploy_and_watch',
    wave: 1,
    instruction: 'Deploy your tower and defend the base',
    highlightShop: false,
    highlightBackpack: false,
    highlightBattleBtn: true,
    highlightInfoBtn: false,
    allowReroll: false,
    allowMerge: false,
    allowEconomy: false,
    limitEnemies: 2,
  },
  merge_and_expand: {
    step: 'merge_and_expand',
    wave: 2,
    instruction: '👉 Drag identical towers together to merge them',
    highlightShop: true,
    highlightBackpack: true,
    highlightBattleBtn: false,
    highlightInfoBtn: false,
    allowReroll: false,
    allowMerge: true,
    allowEconomy: false,
    forceShopItems: ['archer', 'archer'],
  },
  introduce_economy: {
    step: 'introduce_economy',
    wave: 3,
    instruction: '👉 Deploy your towers for the next wave',
    highlightShop: false,
    highlightBackpack: false,
    highlightBattleBtn: true,
    highlightInfoBtn: false,
    allowReroll: false,
    allowMerge: true,
    allowEconomy: false,
  },
  introduce_shop: {
    step: 'introduce_shop',
    wave: 4,
    instruction: '👉 Shops give gold each round, but take space',
    highlightShop: true,
    highlightBackpack: true,
    highlightBattleBtn: false,
    highlightInfoBtn: false,
    allowReroll: false,
    allowMerge: true,
    allowEconomy: true,
    forceShopItems: ['shop', 'archer'],
  },
  introduce_info_icon: {
    step: 'introduce_info_icon',
    wave: 4,
    instruction: '👉 Tap "i" on any item to read its description',
    highlightShop: false,
    highlightBackpack: true,
    highlightBattleBtn: false,
    highlightInfoBtn: true,
    allowReroll: false,
    allowMerge: true,
    allowEconomy: true,
  },
  introduce_durability: {
    step: 'introduce_durability',
    wave: 5,
    instruction: '👉 Military towers have 3 Wins durability (bar beneath them)',
    highlightShop: false,
    highlightBackpack: false,
    highlightBattleBtn: true,
    highlightInfoBtn: false,
    allowReroll: false,
    allowMerge: true,
    allowEconomy: true,
    forceShopItems: ['archer'],
  },
  complete: {
    step: 'complete',
    wave: 5,
    instruction: '',
    highlightShop: false,
    highlightBackpack: false,
    highlightBattleBtn: false,
    highlightInfoBtn: false,
    allowReroll: true,
    allowMerge: true,
    allowEconomy: true,
  },
}

export function getStepConfig(step: TutorialStep | null): TutorialStepConfig | null {
  if (!step) return null
  return TUTORIAL_STEPS[step]
}

export function getInitialTutorialState(): TutorialState {
  return {
    active: true,
    currentStep: 'place_and_buy',
  }
}
