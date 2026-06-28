import React, { createContext, useContext, useRef, useState } from 'react'
import type { Item } from '../types'

export interface ActiveDrag {
  source: 'backpack' | 'reserves'
  item: Item
  sourceId: string        // itemId (backpack) or reservesSlotId (reserves)
  grabOffsetX: number     // px offset within item where user grabbed
  grabOffsetY: number
  mouseX: number          // current viewport coordinates
  mouseY: number
}

interface DragCtx {
  activeDrag: ActiveDrag | null
  startDrag: (drag: ActiveDrag) => void
}

const DragContext = createContext<DragCtx | null>(null)

interface Props {
  children: React.ReactNode
  onDrop: (drag: ActiveDrag, mouseX: number, mouseY: number) => void
}

export function DragProvider({ children, onDrop }: Props) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  // Keep refs so pointer handlers always read the freshest values
  const activeDragRef = useRef<ActiveDrag | null>(null)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop
  activeDragRef.current = activeDrag

  // Register global pointer handlers once — covers mouse, touch, and stylus
  const listenersRef = useRef(false)
  if (!listenersRef.current) {
    listenersRef.current = true

    const onPointerMove = (e: PointerEvent) => {
      if (!activeDragRef.current) return
      setActiveDrag(d => d ? { ...d, mouseX: e.clientX, mouseY: e.clientY } : null)
    }

    const onPointerUp = (e: PointerEvent) => {
      const snapshot = activeDragRef.current
      setActiveDrag(null)
      if (snapshot) onDropRef.current(snapshot, e.clientX, e.clientY)
    }

    const onPointerCancel = () => {
      setActiveDrag(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup',   onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
  }

  return (
    <DragContext.Provider value={{ activeDrag, startDrag: setActiveDrag }}>
      {children}
    </DragContext.Provider>
  )
}

export function useDrag() {
  const ctx = useContext(DragContext)
  if (!ctx) throw new Error('useDrag must be inside DragProvider')
  return ctx
}
