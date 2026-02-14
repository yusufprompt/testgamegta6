import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { Group, Vector3 } from 'three'

type KeyMap = { [key: string]: boolean }

export type CarState = {
  x: number
  y: number
  z: number
  yaw: number
  speed: number
  gear: number
  rpm: number
  damage: number
  traction: number
  headlightsOn: boolean
}

export type Collider = {
  x: number
  z: number
  w: number
  d: number
}

type Props = {
  active: boolean
  view: 'third' | 'first'
  onUpdate: (s: CarState) => void
  colliders: Collider[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  spawnAt?: { x: number; y: number; z: number; yaw?: number } | null
  dynamicCollidersRef?: React.MutableRefObject<Collider[]>
  mode?: 'local' | 'remote'
  remoteState?: Partial<CarState> & { x: number; y?: number; z: number; yaw: number; headlightsOn?: boolean }
}

export default function Car({
  active,
  view,
  onUpdate,
  colliders,
  bounds,
  spawnAt,
  dynamicCollidersRef,
  mode = 'local',
  remoteState,
}: Props) {
  const ref = useRef<Group | null>(null)
  const { camera } = useThree()
  const remoteTargetPos = useRef(new Vector3(6, 0.75, -6))
  const remoteTargetYaw = useRef(0)
  const keys = useRef<KeyMap>({})
  const [gear, setGear] = useState(1)
  const [headlightsOn, setHeadlightsOn] = useState(true)
  const speed = useRef(0)
  const yaw = useRef(0)
  const damage = useRef(0)

  const gearRatios = useMemo(() => [3.1, 3.0, 2.2, 1.6, 1.25, 1.0, 0.82], [])
  const finalDrive = 3.4
  const wheelRadius = 0.36
  const maxRpm = 9000
  const idleRpm = 900
  const enginePower = 36
  const brakePower = 34
  const drag = 0.02
  const rolling = 0.28
  const carScale = 1.2
  const carHalfW = 1.3 * carScale
  const carHalfD = 2.6 * carScale

  useEffect(() => {
    if (mode !== 'local') return
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      keys.current[k] = true
      if (!e.repeat) {
        if (active && k === 'r') setGear((g) => Math.min(6, g + 1))
        if (active && k === 'f') setGear((g) => Math.max(0, g - 1))
        if (active && k === 'h') setHeadlightsOn((v) => !v)
      }
    }
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [active, mode])

  useEffect(() => {
    if (mode !== 'remote' || !ref.current || !remoteState) return
    remoteTargetPos.current.set(remoteState.x, remoteState.y ?? 0.75, remoteState.z)
    remoteTargetYaw.current = remoteState.yaw
    speed.current = 0
  }, [mode, remoteState])

  useFrame((_, delta) => {
    if (!ref.current) return
    if (mode === 'remote') {
      if (!remoteState) return
      remoteTargetPos.current.set(remoteState.x, remoteState.y ?? 0.75, remoteState.z)
      remoteTargetYaw.current = remoteState.yaw
      ref.current.position.lerp(remoteTargetPos.current, 0.4)
      const diff = ((remoteTargetYaw.current - yaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      yaw.current += diff * 0.36
      ref.current.rotation.set(0, yaw.current, 0)
      return
    }

    const forward = new Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current))
    const right = new Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current))

    const throttle = active && (keys.current['w'] || keys.current['arrowup']) ? 1 : 0
    const brake = active && (keys.current['s'] || keys.current['arrowdown']) ? 1 : 0
    // fix inverted A/D
    const steerInput =
      (active && (keys.current['a'] || keys.current['arrowleft']) ? 1 : 0) +
      (active && (keys.current['d'] || keys.current['arrowright']) ? -1 : 0)
    const handbrake = active && keys.current[' '] ? 1 : 0

    const ratio = gearRatios[Math.max(0, Math.min(gear, gearRatios.length - 1))]
    const direction = gear === 0 ? -1 : 1
    const engineForce = throttle * enginePower * ratio * direction
    const brakeSign = speed.current === 0 ? 1 : Math.sign(speed.current)
    const brakeForce = brakePower * brake * brakeSign

    const accel =
      engineForce -
      brakeForce -
      drag * speed.current * Math.abs(speed.current) -
      rolling * speed.current
    speed.current += accel * delta

    if (handbrake && Math.abs(speed.current) > 0.5) {
      speed.current *= 0.985
    }

    if (!active) {
      speed.current *= 0.99
    }

    const speedAbs = Math.abs(speed.current)
    const steerFactor = 1 / (1 + speedAbs * 0.08)
    yaw.current += steerInput * steerFactor * delta * 1.7 * (speedAbs > 0.2 ? Math.sign(speed.current) : 1)

    ref.current.position.add(forward.clone().multiplyScalar(speed.current * delta))
    ref.current.rotation.set(0, yaw.current, 0)

    // simple collision response (AABB vs car box)
    const pos = ref.current.position
    let collided = false
    const resolveCollision = (c: Collider) => {
      const halfW = c.w / 2 + carHalfW
      const halfD = c.d / 2 + carHalfD
      const dx = pos.x - c.x
      const dz = pos.z - c.z
      if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
        const penX = halfW - Math.abs(dx)
        const penZ = halfD - Math.abs(dz)
        if (penX < penZ) {
          pos.x += (dx === 0 ? 1 : Math.sign(dx)) * penX
        } else {
          pos.z += (dz === 0 ? 1 : Math.sign(dz)) * penZ
        }
        collided = true
      }
    }

    for (const c of colliders) resolveCollision(c)
    if (dynamicCollidersRef?.current) {
      for (const c of dynamicCollidersRef.current) resolveCollision(c)
    }

    // world bounds
    const minX = bounds.minX + carHalfW
    const maxX = bounds.maxX - carHalfW
    const minZ = bounds.minZ + carHalfD
    const maxZ = bounds.maxZ - carHalfD
    if (pos.x < minX) {
      pos.x = minX
      collided = true
    } else if (pos.x > maxX) {
      pos.x = maxX
      collided = true
    }
    if (pos.z < minZ) {
      pos.z = minZ
      collided = true
    } else if (pos.z > maxZ) {
      pos.z = maxZ
      collided = true
    }

    if (collided) {
      const impact = Math.min(1, Math.abs(speed.current) / 18)
      damage.current = Math.min(1, damage.current + impact * 0.22)
      speed.current *= -0.25
      if (Math.abs(speed.current) < 0.8) speed.current = 0
    }

    const wheelRpm = (speedAbs / (2 * Math.PI * wheelRadius)) * 60
    const rpm = Math.min(maxRpm, Math.max(idleRpm, wheelRpm * ratio * finalDrive))
    const traction = Math.max(0, 1 - Math.min(1, speedAbs / 45) * Math.abs(steerInput) * 0.6)

    // auto shift for forward gears
    if (active && gear > 0) {
      if (rpm > 7800 && gear < 6) setGear((g) => Math.min(6, g + 1))
      if (rpm < 2200 && gear > 1) setGear((g) => Math.max(1, g - 1))
    }

    onUpdate({
      x: ref.current.position.x,
      y: ref.current.position.y,
      z: ref.current.position.z,
      yaw: yaw.current,
      speed: speed.current,
      gear,
      rpm,
      damage: damage.current,
      traction,
      headlightsOn,
    })

    if (active) {
      if (view === 'third') {
        const desired = ref.current.position.clone()
        desired.add(forward.clone().multiplyScalar(-8))
        desired.y = ref.current.position.y + 3.2
        camera.position.lerp(desired, 0.12)
        camera.lookAt(ref.current.position.x, ref.current.position.y + 1.2, ref.current.position.z)
      } else {
        const desired = ref.current.position.clone()
        desired.add(right.clone().multiplyScalar(0.3))
        desired.y = ref.current.position.y + 1.2
        camera.position.lerp(desired, 0.28)
        const lookPoint = ref.current.position.clone().add(forward.clone().multiplyScalar(20))
        camera.lookAt(lookPoint)
      }
    }
  })

  useEffect(() => {
    if (mode !== 'local') return
    if (!spawnAt || !ref.current) return
    ref.current.position.set(spawnAt.x, spawnAt.y, spawnAt.z)
    if (typeof spawnAt.yaw === 'number') yaw.current = spawnAt.yaw
    speed.current = 0
    damage.current = Math.max(0, damage.current - 0.2)
  }, [mode, spawnAt])

  const wheelPositions: Array<[number, number, number]> = [
    [1.2, -0.15, 2.0],
    [-1.2, -0.15, 2.0],
    [1.2, -0.15, -2.2],
    [-1.2, -0.15, -2.2],
  ]

  const archLumps: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [
    { pos: [1.05, 0.1, 2.0], size: [0.95, 0.36, 0.95] },
    { pos: [-1.05, 0.1, 2.0], size: [0.95, 0.36, 0.95] },
    { pos: [1.05, 0.1, -2.2], size: [1.05, 0.4, 1.05] },
    { pos: [-1.05, 0.1, -2.2], size: [1.05, 0.4, 1.05] },
  ]

  return (
    <group ref={ref} position={[6, 0.75, -6]} scale={[carScale, carScale, carScale]}>
      {/* main blue shell */}
      <RoundedBox args={[2.5, 0.46, 5.9]} radius={0.22} smoothness={8} castShadow position={[0, 0.18, 0]}>
        <meshPhysicalMaterial
          color="#2b6fdc"
          clearcoat={0.98}
          clearcoatRoughness={0.05}
          roughness={0.18}
          metalness={0.22}
        />
      </RoundedBox>
      {/* hood line */}
      <RoundedBox args={[2.2, 0.26, 2.0]} radius={0.12} smoothness={6} castShadow position={[0, 0.3, 1.7]}>
        <meshPhysicalMaterial color="#2b6fdc" clearcoat={0.95} roughness={0.2} metalness={0.2} />
      </RoundedBox>
      {/* rear black shell */}
      <RoundedBox args={[2.6, 0.42, 2.6]} radius={0.18} smoothness={6} castShadow position={[0, 0.28, -1.85]}>
        <meshPhysicalMaterial color="#0a0c10" clearcoat={0.55} roughness={0.55} metalness={0.12} />
      </RoundedBox>
      {/* roof/cabin */}
      <RoundedBox args={[1.65, 0.28, 1.9]} radius={0.12} smoothness={6} castShadow position={[0, 0.6, -0.25]}>
        <meshPhysicalMaterial color="#0c0f14" clearcoat={0.9} roughness={0.35} metalness={0.1} />
      </RoundedBox>
      {/* front nose */}
      <RoundedBox args={[1.8, 0.28, 1.45]} radius={0.12} smoothness={6} castShadow position={[0, 0.24, 2.3]}>
        <meshPhysicalMaterial color="#2b6fdc" clearcoat={0.95} roughness={0.2} metalness={0.18} />
      </RoundedBox>
      {/* wheel arches */}
      {archLumps.map((a, i) => (
        <RoundedBox key={`arch-${i}`} args={a.size} radius={0.18} smoothness={6} castShadow position={a.pos}>
          <meshPhysicalMaterial color="#2b6fdc" clearcoat={0.9} roughness={0.25} />
        </RoundedBox>
      ))}

      {/* side skirts */}
      <RoundedBox args={[0.26, 0.16, 4.3]} radius={0.08} smoothness={4} castShadow position={[1.26, -0.18, -0.1]}>
        <meshStandardMaterial color="#10141a" />
      </RoundedBox>
      <RoundedBox args={[0.26, 0.16, 4.3]} radius={0.08} smoothness={4} castShadow position={[-1.26, -0.18, -0.1]}>
        <meshStandardMaterial color="#10141a" />
      </RoundedBox>

      {/* horseshoe grille */}
      <mesh castShadow position={[0, 0.12, 2.65]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.58, 0.07, 16, 50, Math.PI * 1.4]} />
        <meshStandardMaterial color="#c7d0d8" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0, 0.02, 2.7]}>
        <boxGeometry args={[0.85, 0.55, 0.22]} />
        <meshStandardMaterial color="#0f1319" />
      </mesh>

      {/* blue door arc accent */}
      <mesh castShadow position={[-1.18, 0.18, -0.45]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.08, 0.06, 14, 50, Math.PI * 1.25]} />
        <meshStandardMaterial color="#0f141a" />
      </mesh>

      {/* windows */}
      <RoundedBox args={[0.8, 0.22, 1.3]} radius={0.08} smoothness={6} castShadow position={[0.42, 0.62, -0.25]} rotation={[0, 0.05, 0]}>
        <meshPhysicalMaterial color="#0b0f14" transparent opacity={0.55} roughness={0.08} metalness={0.2} />
      </RoundedBox>
      <RoundedBox args={[0.8, 0.22, 1.3]} radius={0.08} smoothness={6} castShadow position={[-0.42, 0.62, -0.25]} rotation={[0, -0.05, 0]}>
        <meshPhysicalMaterial color="#0b0f14" transparent opacity={0.55} roughness={0.08} metalness={0.2} />
      </RoundedBox>

      {/* headlights */}
      <group position={[0.9, 0.24, 2.35]}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.12, 0.55]} />
          <meshStandardMaterial color="#0c0f14" />
        </mesh>
        {[-0.16, 0, 0.16].map((x, i) => (
          <mesh key={`hl-r-${i}`} position={[x, 0.01, 0.05]}>
            <boxGeometry args={[0.12, 0.04, 0.45]} />
            <meshStandardMaterial
              color="#e6eef6"
              emissive="#9bc4ff"
              emissiveIntensity={(mode === 'remote' ? remoteState?.headlightsOn : headlightsOn) ? 0.9 : 0.15}
            />
          </mesh>
        ))}
      </group>
      <group position={[-0.9, 0.24, 2.35]}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.12, 0.55]} />
          <meshStandardMaterial color="#0c0f14" />
        </mesh>
        {[-0.16, 0, 0.16].map((x, i) => (
          <mesh key={`hl-l-${i}`} position={[x, 0.01, 0.05]}>
            <boxGeometry args={[0.12, 0.04, 0.45]} />
            <meshStandardMaterial
              color="#e6eef6"
              emissive="#9bc4ff"
              emissiveIntensity={(mode === 'remote' ? remoteState?.headlightsOn : headlightsOn) ? 0.9 : 0.15}
            />
          </mesh>
        ))}
      </group>

      {/* front splitter */}
      <mesh castShadow position={[0, 0.02, 2.9]}>
        <boxGeometry args={[2.3, 0.06, 0.7]} />
        <meshStandardMaterial color="#0b0e12" />
      </mesh>

      {/* side intakes */}
      <mesh castShadow position={[1.24, 0.08, -0.9]}>
        <boxGeometry args={[0.12, 0.32, 1.2]} />
        <meshStandardMaterial color="#12161c" />
      </mesh>
      <mesh castShadow position={[-1.24, 0.08, -0.9]}>
        <boxGeometry args={[0.12, 0.32, 1.2]} />
        <meshStandardMaterial color="#12161c" />
      </mesh>

      {wheelPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.5, 0.16, 16, 40]} />
            <meshStandardMaterial color="#0d0f12" roughness={0.85} />
          </mesh>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.33, 0.33, 0.24, 24]} />
            <meshStandardMaterial color="#c4cbd3" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.24, 16]} />
            <meshStandardMaterial color="#1a1f26" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.25, 0.25, 0.05, 20]} />
            <meshStandardMaterial color="#8a929b" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* rear wing lip */}
      <mesh castShadow position={[0, 0.32, -2.55]}>
        <boxGeometry args={[2.05, 0.08, 0.5]} />
        <meshStandardMaterial color="#0e1116" />
      </mesh>

      {/* rear lights */}
      <mesh castShadow position={[0.7, 0.22, -2.55]}>
        <boxGeometry args={[0.55, 0.12, 0.08]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff1c1c" emissiveIntensity={0.4} />
      </mesh>
      <mesh castShadow position={[-0.7, 0.22, -2.55]}>
        <boxGeometry args={[0.55, 0.12, 0.08]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff1c1c" emissiveIntensity={0.4} />
      </mesh>

      {/* headlight glow */}
      <pointLight
        position={[0.9, 0.25, 2.7]}
        intensity={(mode === 'remote' ? remoteState?.headlightsOn : headlightsOn) ? 1.4 : 0}
        distance={10}
        color="#a8c8ff"
      />
      <pointLight
        position={[-0.9, 0.25, 2.7]}
        intensity={(mode === 'remote' ? remoteState?.headlightsOn : headlightsOn) ? 1.4 : 0}
        distance={10}
        color="#a8c8ff"
      />
    </group>
  )
}
