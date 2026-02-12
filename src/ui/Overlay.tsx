import React, { useEffect, useRef, useState } from 'react'

type Props = {
  view: 'third' | 'first'
  onToggleView: () => void
  playerState: { x: number; z: number; health: number; wanted: number; ammo: number }
  inCar: boolean
  carState: { speed: number; gear: number; rpm: number; damage: number; traction: number; headlightsOn: boolean }
  roomCode: string
  remoteCount: number
  onJoinRoom: (code: string) => void
  onCreateRoom: () => void
  playerName: string
  onChangePlayerName: (name: string) => void
  firebaseError?: string | null
}

export default function Overlay({
  view,
  onToggleView,
  playerState,
  inCar,
  carState,
  roomCode,
  remoteCount,
  onJoinRoom,
  onCreateRoom,
  playerName,
  onChangePlayerName,
  firebaseError,
}: Props) {
  const mapSize = 160
  const mapScale = 6 // world units to map pixels (bigger world -> scale)
  const centerX = mapSize / 2 + playerState.x / mapScale
  const centerY = mapSize / 2 + playerState.z / mapScale
  const speedKmh = Math.max(0, Math.abs(carState.speed) * 3.6)
  const healthPct = Math.max(0, Math.min(1, playerState.health / 100))
  const armorPct = 0
  const cash = 1200 + playerState.ammo * 15 + playerState.wanted * 250
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneApp, setPhoneApp] = useState<'apps' | 'code'>('apps')
  const [code, setCode] = useState('')
  const [roomInput, setRoomInput] = useState(roomCode)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => {
    setRoomInput(roomCode)
  }, [roomCode])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k !== 't') return
      setPhoneOpen((v) => !v)
      setPhoneApp('apps')
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2000)
  }

  const addDigit = (d: string) => {
    setCode((c) => (c.length >= 6 ? c : c + d))
  }

  const submitCode = () => {
    if (code === '7997') {
      showToast('Kod kabul edildi')
      setCode('')
      setPhoneOpen(false)
      setPhoneApp('apps')
      return
    }
    showToast('Kod yanlış')
  }

  const joinRoom = () => {
    if (!roomInput.trim()) {
      showToast('Room code gir')
      return
    }
    onJoinRoom(roomInput)
    showToast(`Room: ${roomInput.toUpperCase()}`)
  }

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      showToast('Room code kopyalandi')
    } catch {
      showToast('Kopyalama basarisiz')
    }
  }

  return (
    <div className="hud">
      {toast && <div className="hud-toast">{toast}</div>}
      <div className="hud-top">
        <div className="hud-top-left">
          <button className="hud-btn" onClick={onToggleView}>
            Görünüm: {view === 'third' ? '3.kişi' : '1.kişi'}
          </button>
          <div className="hud-room">
            <div className="hud-room-line">ROOM {roomCode}</div>
            <div className="hud-room-line">{remoteCount + 1} oyuncu</div>
            <div className={`hud-room-line ${firebaseError ? 'err' : 'ok'}`}>
              {firebaseError ? `Firebase: ${firebaseError}` : 'Firebase: bagli'}
            </div>
            <div className="hud-room-row">
              <input
                className="hud-room-input"
                value={playerName}
                onChange={(e) => onChangePlayerName(e.target.value)}
                placeholder="Isim"
                maxLength={16}
              />
            </div>
            <div className="hud-room-row">
              <input
                className="hud-room-input"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Room code"
                maxLength={8}
              />
              <button className="hud-btn" onClick={joinRoom}>
                Katil
              </button>
            </div>
            <div className="hud-room-row">
              <button className="hud-btn" onClick={onCreateRoom}>
                Yeni
              </button>
              <button className="hud-btn" onClick={copyRoom}>
                Kopyala
              </button>
            </div>
          </div>
        </div>
        <div className="hud-top-right">
          <div className="hud-cash">${cash.toLocaleString('en-US')}</div>
          <div className="hud-stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={`star-${i}`} className={i < playerState.wanted ? 'star on' : 'star'}>
                ★
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="hud-bottom">
        <div className="hud-left">
          <div className="hud-map">
            <div className="hud-map-inner" style={{ width: mapSize, height: mapSize }}>
              <div
                className="hud-map-dot"
                style={{ left: `${centerX}px`, top: `${centerY}px` }}
              />
            </div>
          </div>
          <div className="hud-bars">
            <div className="hud-bar">
              <div className="hud-bar-fill health" style={{ width: `${Math.round(healthPct * 100)}%` }} />
            </div>
            <div className="hud-bar">
              <div className="hud-bar-fill armor" style={{ width: `${Math.round(armorPct * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="hud-right">
          {!inCar && (
            <div className="hud-weapon">
              <div className="hud-weapon-name">Pistol</div>
              <div className="hud-ammo">
                {playerState.ammo} / 120
              </div>
            </div>
          )}
          {inCar && (
            <div className="hud-car">
              <div className="hud-speed">{Math.round(speedKmh)}</div>
              <div className="hud-speed-label">KM/H</div>
              <div className="hud-gear">{carState.gear === 0 ? 'R' : carState.gear}</div>
              <div className="hud-lights">{carState.headlightsOn ? 'FAR AÇIK' : 'FAR KAPALI'}</div>
            </div>
          )}
        </div>
      </div>

      {phoneOpen && (
        <div className="hud-phone">
          <div className="hud-phone-header">
            <div className="hud-phone-title">Telefon</div>
            <button className="hud-phone-close" onClick={() => setPhoneOpen(false)}>
              ✕
            </button>
          </div>

          {phoneApp === 'apps' && (
            <div className="hud-phone-apps">
              <button className="hud-phone-app" onClick={() => setPhoneApp('code')}>
                <div className="app-icon">#</div>
                <div className="app-label">Kod Uyg.</div>
              </button>
              <div className="hud-phone-app">
                <div className="app-icon">MAP</div>
                <div className="app-label">Harita</div>
              </div>
              <div className="hud-phone-app">
                <div className="app-icon">MUS</div>
                <div className="app-label">Müzik</div>
              </div>
              <div className="hud-phone-app">
                <div className="app-icon">MSG</div>
                <div className="app-label">Mesaj</div>
              </div>
            </div>
          )}

          {phoneApp === 'code' && (
            <div className="hud-phone-code">
              <div className="hud-phone-row">
                <button className="hud-phone-back" onClick={() => setPhoneApp('apps')}>
                  ← Uygulamalar
                </button>
              </div>
              <div className="hud-phone-display">{code || '----'}</div>
              <div className="hud-phone-keypad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
                  <button key={d} className="hud-phone-key" onClick={() => addDigit(d)}>
                    {d}
                  </button>
                ))}
                <button className="hud-phone-key alt" onClick={() => setCode('')}>
                  Sil
                </button>
                <button className="hud-phone-key ok" onClick={submitCode}>
                  OK
                </button>
              </div>
              <div className="hud-phone-hint">Kod: 7997</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
