import React, { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './scene/World'
import RenderSettings from './scene/RenderSettings'
import Overlay from './ui/Overlay'
import MobileControls from './ui/MobileControls'
import { useFirebaseMultiplayer } from './multiplayer/useFirebaseMultiplayer'

function normalizeRoomCode(input: string, fallback = '') {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.slice(0, 8) || fallback
}

function randomRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function initialPlayerName() {
  const saved = window.localStorage.getItem('player_name')
  if (saved && saved.trim()) return saved.slice(0, 16)
  return `Oyuncu${Math.floor(Math.random() * 900 + 100)}`
}

export default function App() {
  const [view, setView] = useState<'third' | 'first'>('third')
  const [playerName, setPlayerName] = useState(initialPlayerName)
  const [playerState, setPlayerState] = useState({ x: 0, z: 0, yaw: 0, health: 100, wanted: 0, ammo: 30 })
  const [inCar, setInCar] = useState(false)
  const [carState, setCarState] = useState({ speed: 0, gear: 1, rpm: 900, damage: 0, traction: 1, headlightsOn: true })
  const [roomCode, setRoomCode] = useState(() => {
    const hash = window.location.hash
    const fromHash = hash.startsWith('#room=') ? hash.slice(6) : ''
    return normalizeRoomCode(fromHash, 'ROOM1')
  })
  const { remotePlayers, cars, tryEnterCar, leaveCar, pushCarState, chatMessages, sendChatMessage, firebaseError } =
    useFirebaseMultiplayer(
      {
        name: playerName,
        ...playerState,
        inCar,
      },
      roomCode
    )

  useEffect(() => {
    window.location.hash = `room=${roomCode}`
  }, [roomCode])

  useEffect(() => {
    setInCar(false)
  }, [roomCode])

  useEffect(() => {
    window.localStorage.setItem('player_name', playerName)
  }, [playerName])

  return (
    <>
      <Canvas shadows camera={{ position: [0, 5, 10], fov: 60 }}>
        <color attach="background" args={[0.6, 0.8, 1]} />
        <fog attach="fog" args={['#b7d1e3', 40, 700]} />
        <ambientLight intensity={0.4} />
        <RenderSettings />
        <Suspense fallback={null}>
          <World
            view={view}
            inCar={inCar}
            onInCarChange={setInCar}
            onPlayerUpdate={(s) => setPlayerState(s)}
            onCarUpdate={(s) => {
              setCarState(s)
              if (inCar) {
                setPlayerState((prev) => ({ ...prev, x: s.x, z: s.z, yaw: s.yaw }))
              }
            }}
            remotePlayers={remotePlayers}
            cars={cars}
            onTryEnterCar={tryEnterCar}
            onLeaveCar={leaveCar}
            onCarSync={pushCarState}
          />
        </Suspense>
      </Canvas>
      <Overlay
        view={view}
        onToggleView={() => setView((v) => (v === 'third' ? 'first' : 'third'))}
        playerState={playerState}
        inCar={inCar}
        carState={carState}
        roomCode={roomCode}
        remoteCount={remotePlayers.length}
        onJoinRoom={(nextCode) => setRoomCode(normalizeRoomCode(nextCode, roomCode))}
        onCreateRoom={() => setRoomCode(randomRoomCode())}
        playerName={playerName}
        onChangePlayerName={(nextName) => setPlayerName(nextName.slice(0, 16))}
        firebaseError={firebaseError}
        chatMessages={chatMessages}
        onSendChat={sendChatMessage}
      />
      <MobileControls />
    </>
  )
}
