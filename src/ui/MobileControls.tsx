import React, { useEffect, useMemo, useRef } from 'react'

type HoldButtonProps = {
  label: string
  keyValue: string
  className?: string
}

type TapButtonProps = {
  label: string
  keyValue: string
  className?: string
}

function dispatchKey(type: 'keydown' | 'keyup', key: string) {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }))
}

export default function MobileControls() {
  const activeKeys = useRef<Set<string>>(new Set())
  const showControls = useMemo(() => {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
  }, [])

  const press = (key: string) => {
    if (activeKeys.current.has(key)) return
    activeKeys.current.add(key)
    dispatchKey('keydown', key)
  }

  const release = (key: string) => {
    if (!activeKeys.current.has(key)) return
    activeKeys.current.delete(key)
    dispatchKey('keyup', key)
  }

  const releaseAll = () => {
    const keys = Array.from(activeKeys.current)
    for (const key of keys) release(key)
  }

  useEffect(() => {
    window.addEventListener('blur', releaseAll)
    window.addEventListener('pointercancel', releaseAll)
    window.addEventListener('pointerup', releaseAll)
    const onVisibility = () => {
      if (document.hidden) releaseAll()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('blur', releaseAll)
      window.removeEventListener('pointercancel', releaseAll)
      window.removeEventListener('pointerup', releaseAll)
      document.removeEventListener('visibilitychange', onVisibility)
      releaseAll()
    }
  }, [])

  const HoldButton = ({ label, keyValue, className }: HoldButtonProps) => (
    <button
      className={`mc-btn ${className ?? ''}`.trim()}
      onPointerDown={(e) => {
        e.preventDefault()
        press(keyValue)
      }}
      onPointerUp={(e) => {
        e.preventDefault()
        release(keyValue)
      }}
      onPointerLeave={() => release(keyValue)}
    >
      {label}
    </button>
  )

  const TapButton = ({ label, keyValue, className }: TapButtonProps) => (
    <button
      className={`mc-btn ${className ?? ''}`.trim()}
      onPointerDown={(e) => {
        e.preventDefault()
        dispatchKey('keydown', keyValue)
        window.setTimeout(() => dispatchKey('keyup', keyValue), 45)
      }}
    >
      {label}
    </button>
  )

  if (!showControls) return null

  return (
    <div className="mobile-controls">
      <div className="mobile-move">
        <HoldButton label="W" keyValue="w" className="up" />
        <HoldButton label="A" keyValue="a" className="left" />
        <HoldButton label="S" keyValue="s" className="down" />
        <HoldButton label="D" keyValue="d" className="right" />
      </div>

      <div className="mobile-actions">
        <TapButton label="E Bin/In" keyValue="e" />
        <HoldButton label="Ates/Fren" keyValue=" " />
        <TapButton label="Vites +" keyValue="r" />
        <TapButton label="Vites -" keyValue="f" />
        <TapButton label="Far" keyValue="h" />
        <TapButton label="Telefon" keyValue="t" />
      </div>
    </div>
  )
}
