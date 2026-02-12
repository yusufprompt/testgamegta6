import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, Mesh, RepeatWrapping, Vector3 } from 'three'
import Player from '../player/Player'
import Car, { CarState, Collider } from '../vehicle/Car'
import NPCs from '../npc/NPCs'
import RemotePlayers from './RemotePlayers'
import { NetCarState, RemotePlayer } from '../multiplayer/useFirebaseMultiplayer'

type Props = {
  view: 'third' | 'first'
  onPlayerUpdate: (s: { x: number; z: number; yaw: number; health: number; wanted: number; ammo: number }) => void
  onCarUpdate: (s: {
    x: number
    z: number
    yaw: number
    speed: number
    gear: number
    rpm: number
    damage: number
    traction: number
    headlightsOn: boolean
  }) => void
  inCar: boolean
  onInCarChange: (v: boolean) => void
  remotePlayers: RemotePlayer[]
  cars: NetCarState[]
  onTryEnterCar: (carId: string) => Promise<boolean>
  onLeaveCar: (carId: string, patch?: Partial<NetCarState>) => Promise<boolean>
  onCarSync: (carId: string, patch: Partial<NetCarState>) => void
}

export default function World({
  view,
  onPlayerUpdate,
  onCarUpdate,
  inCar,
  onInCarChange,
  remotePlayers,
  cars,
  onTryEnterCar,
  onLeaveCar,
  onCarSync,
}: Props) {
  const ENTER_CAR_DISTANCE = 4.6
  const box1 = useRef<Mesh | null>(null)
  const box2 = useRef<Mesh | null>(null)
  const playerPos = useRef(new Vector3(0, 1, 0))
  const [spawnAt, setSpawnAt] = useState<[number, number, number] | null>(null)
  const [drivenCarId, setDrivenCarId] = useState<string | null>(null)
  const [activeCarSpawnAt, setActiveCarSpawnAt] = useState<{ x: number; y: number; z: number; yaw?: number } | null>(null)
  const activeCarStateRef = useRef<CarState | null>(null)

  const grassTex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3a7f5a'
    ctx.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 1200; i++) {
      const x = Math.random() * 128
      const y = Math.random() * 128
      const g = 120 + Math.random() * 80
      ctx.fillStyle = `rgb(${40 + g * 0.2}, ${100 + g * 0.5}, ${50 + g * 0.2})`
      ctx.fillRect(x, y, 2, 2)
    }
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(80, 80)
    return tex
  }, [])

  const roadTex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#2a2d32'
    ctx.fillRect(0, 0, 256, 64)
    for (let i = 0; i < 1200; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 64
      const v = 40 + Math.random() * 50
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`
      ctx.fillRect(x, y, 2, 1)
    }
    ctx.fillStyle = '#d9c36a'
    for (let x = 0; x < 256; x += 32) {
      ctx.fillRect(x, 30, 16, 4)
    }
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(30, 2)
    return tex
  }, [])

  const windowTexA = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#1f2a33'
    ctx.fillRect(0, 0, 128, 256)
    for (let y = 8; y < 256; y += 16) {
      for (let x = 6; x < 128; x += 18) {
        const lit = Math.random() > 0.55
        ctx.fillStyle = lit ? '#9fb7d1' : '#33424f'
        ctx.fillRect(x, y, 8, 10)
      }
    }
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(2, 3)
    return tex
  }, [])

  const windowTexB = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#20262e'
    ctx.fillRect(0, 0, 128, 256)
    for (let y = 10; y < 256; y += 18) {
      for (let x = 8; x < 128; x += 20) {
        const lit = Math.random() > 0.6
        ctx.fillStyle = lit ? '#8fb0cf' : '#2b3642'
        ctx.fillRect(x, y, 9, 12)
      }
    }
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(2, 3)
    return tex
  }, [])

  const blocks = useMemo(() => {
    const items: Array<{ x: number; z: number; w: number; h: number; d: number }> = []
    const step = 240
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue
        const x = i * step + (j % 2) * 20
        const z = j * step + (i % 2) * 20
        const w = 60 + ((i + j + 10) % 3) * 30
        const h = 12 + (Math.abs(i * j) % 5) * 10
        const d = 70 + ((i - j + 10) % 3) * 25
        items.push({ x, z, w, h, d })
      }
    }
    return items
  }, [])

  const towers = useMemo(() => {
    const items: Array<{ x: number; z: number; w: number; h: number; d: number }> = []
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 5; j++) {
        const x = 520 + i * 70
        const z = -320 + j * 80
        const w = 30 + (i % 3) * 8
        const h = 40 + (j % 4) * 18 + i * 2
        items.push({ x, z, w, h, d: 36 })
      }
    }
    return items
  }, [])

  const colliders: Collider[] = useMemo(() => {
    const base: Collider[] = [
      { x: 50, z: -120, w: 20, d: 20 },
      { x: -160, z: 200, w: 30, d: 12 },
      { x: 180, z: 140, w: 46, d: 26 }, // pool
    ]
    return [
      ...base,
      ...blocks.map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d })),
      ...towers.map((t) => ({ x: t.x, z: t.z, w: t.w, d: t.d })),
    ]
  }, [blocks, towers])

  const bounds = useMemo(() => ({ minX: -1200, maxX: 1200, minZ: -1200, maxZ: 1200 }), [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      void (async () => {
        const k = e.key.toLowerCase()
        if (k !== 'e') return
        if (drivenCarId) {
          const live = activeCarStateRef.current
          const fallback = cars.find((c) => c.id === drivenCarId)
          if (!live && !fallback) return
          const yaw = live ? live.yaw : fallback!.yaw
          const baseX = live ? live.x : fallback!.x
          const baseZ = live ? live.z : fallback!.z
          const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
          const exitPos = new Vector3(baseX, 1, baseZ).add(right.multiplyScalar(1.8))
          setSpawnAt([exitPos.x, exitPos.y, exitPos.z])
          try {
            await onLeaveCar(drivenCarId, live ? { ...live } : undefined)
          } catch {
            // keep local flow usable even if network/write fails
          }
          setDrivenCarId(null)
          setActiveCarSpawnAt(null)
          activeCarStateRef.current = null
          onInCarChange(false)
          return
        }

        let nearest: NetCarState | null = null
        let minDist = Infinity
        for (const c of cars) {
          const d = playerPos.current.distanceTo(new Vector3(c.x, 1, c.z))
          if (d < minDist) {
            minDist = d
            nearest = c
          }
        }
        if (!nearest || minDist >= ENTER_CAR_DISTANCE) return
        let ok = false
        try {
          ok = await onTryEnterCar(nearest.id)
        } catch {
          ok = !nearest.driverId
        }
        if (!ok) return
        setDrivenCarId(nearest.id)
        setActiveCarSpawnAt({ x: nearest.x, y: nearest.y, z: nearest.z, yaw: nearest.yaw })
        onInCarChange(true)
      })()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [cars, drivenCarId, onInCarChange, onLeaveCar, onTryEnterCar])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k !== 'b') return
      if (drivenCarId) return
      const spawn = {
        x: playerPos.current.x + 4,
        y: 0.75,
        z: playerPos.current.z,
        yaw: 0,
      }
      const emptyCar = cars.find((c) => !c.driverId)
      if (!emptyCar) return
      onCarSync(emptyCar.id, spawn)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [cars, drivenCarId, onCarSync])

  return (
    <group>
      <directionalLight castShadow position={[12, 18, 8]} intensity={1.2} />
      <hemisphereLight intensity={0.35} color="#cfe8ff" groundColor="#546b5b" />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial map={grassTex} color="#3a7f5a" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* larger map objects (moved outward for bigger map) */}
      <mesh ref={box1} position={[50, 1, -120]} castShadow>
        <boxGeometry args={[20, 8, 20]} />
        <meshStandardMaterial color="#7a7f86" roughness={0.65} metalness={0.1} />
      </mesh>

      <mesh ref={box2} position={[-160, 1, 200]} castShadow>
        <boxGeometry args={[30, 8, 12]} />
        <meshStandardMaterial color="#637a6b" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* more buildings in a simple grid */}
      {blocks.map((b, i) => (
        <mesh key={`block-${i}`} position={[b.x, b.h / 2, b.z]} castShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial
            map={i % 2 === 0 ? windowTexA : windowTexB}
            color={i % 2 === 0 ? '#47525d' : '#3f4f57'}
            roughness={0.45}
            metalness={0.2}
            emissive="#1b2733"
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}

      {/* road grid */}
      {[-900, -600, -300, 0, 300, 600, 900].map((z) => (
        <mesh key={`road-x-${z}`} position={[0, 0.1, z]} receiveShadow>
          <boxGeometry args={[2400, 0.2, 50]} />
          <meshStandardMaterial map={roadTex} color="#2b2f35" roughness={0.95} />
        </mesh>
      ))}
      {[-900, -600, -300, 0, 300, 600, 900].map((x) => (
        <mesh key={`road-z-${x}`} position={[x, 0.1, 0]} receiveShadow>
          <boxGeometry args={[50, 0.2, 2400]} />
          <meshStandardMaterial map={roadTex} color="#2b2f35" roughness={0.95} />
        </mesh>
      ))}

      {/* pool */}
      <group position={[180, 0, 140]}>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[46, 0.2, 26]} />
          <meshStandardMaterial color="#b2b2b2" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[40, 0.1, 20]} />
          <meshPhysicalMaterial
            color="#4bb2ff"
            transparent
            opacity={0.7}
            roughness={0.2}
            metalness={0.0}
            clearcoat={0.9}
            clearcoatRoughness={0.1}
          />
        </mesh>
      </group>

      {/* denser city cluster */}
      {towers.map((t, i) => (
        <mesh key={`tower-${i}`} position={[t.x, t.h / 2, t.z]} castShadow>
          <boxGeometry args={[t.w, t.h, t.d]} />
          <meshStandardMaterial
            map={i % 2 === 0 ? windowTexA : windowTexB}
            color="#3f4852"
            roughness={0.35}
            metalness={0.2}
            emissive="#1a2430"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}

      {/* outer boundaries */}
      <mesh position={[0, 4, -1220]}>
        <boxGeometry args={[2400, 8, 10]} />
        <meshStandardMaterial color="#24282c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 4, 1220]}>
        <boxGeometry args={[2400, 8, 10]} />
        <meshStandardMaterial color="#24282c" roughness={0.9} />
      </mesh>
      <mesh position={[-1220, 4, 0]}>
        <boxGeometry args={[10, 8, 2400]} />
        <meshStandardMaterial color="#24282c" roughness={0.9} />
      </mesh>
      <mesh position={[1220, 4, 0]}>
        <boxGeometry args={[10, 8, 2400]} />
        <meshStandardMaterial color="#24282c" roughness={0.9} />
      </mesh>

      <NPCs />
      <RemotePlayers players={remotePlayers} />

      {cars.map((car) => {
        const isDrivenByLocal = drivenCarId === car.id
        return (
          <Car
            key={car.id}
            view={view}
            active={isDrivenByLocal}
            colliders={colliders}
            bounds={bounds}
            mode={isDrivenByLocal ? 'local' : 'remote'}
            remoteState={car}
            spawnAt={isDrivenByLocal ? activeCarSpawnAt : null}
            onUpdate={(c: CarState) => {
              if (!isDrivenByLocal) return
              activeCarStateRef.current = c
              onCarSync(car.id, c)
              onCarUpdate({
                x: c.x,
                z: c.z,
                yaw: c.yaw,
                speed: c.speed,
                gear: c.gear,
                rpm: c.rpm,
                damage: c.damage,
                traction: c.traction,
                headlightsOn: c.headlightsOn,
              })
            }}
          />
        )
      })}

      <Player
        view={view}
        active={!drivenCarId}
        spawnAt={spawnAt}
        onUpdate={(p) => {
          playerPos.current.set(p.x, 1, p.z)
          onPlayerUpdate(p)
        }}
      />
    </group>
  )
}
