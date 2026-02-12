import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { CatmullRomCurve3, Group, Vector3 } from 'three'
import { Collider } from '../vehicle/Car'

type WalkerConfig = {
  path: Vector3[]
  speed: number
  offset: number
  color: string
}

type CarConfig = {
  path: Vector3[]
  speed: number
  offset: number
  color: string
}

type NPCsProps = {
  collidersRef?: React.MutableRefObject<Collider[]>
}

type ColliderSetter = (index: number, c: Collider) => void

function NPCWalker({ path, speed, offset, color, index, setCollider }: WalkerConfig & { index: number; setCollider: ColliderSetter }) {
  const ref = useRef<Group | null>(null)
  const leftArm = useRef<Group | null>(null)
  const rightArm = useRef<Group | null>(null)
  const leftLeg = useRef<Group | null>(null)
  const rightLeg = useRef<Group | null>(null)
  const curve = useMemo(() => new CatmullRomCurve3(path, true, 'catmullrom', 0.4), [path])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.elapsedTime * speed + offset) % 1
    const pos = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    ref.current.position.set(pos.x, 0, pos.z)
    ref.current.rotation.y = Math.atan2(tan.x, tan.z)

    const walk = Math.sin(clock.elapsedTime * 6 + offset * 10)
    const swing = walk * 0.6
    if (leftArm.current) leftArm.current.rotation.x = swing
    if (rightArm.current) rightArm.current.rotation.x = -swing
    if (leftLeg.current) leftLeg.current.rotation.x = -swing
    if (rightLeg.current) rightLeg.current.rotation.x = swing

    setCollider(index, { x: pos.x, z: pos.z, w: 0.8, d: 0.8 })
  })

  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.95, 0]}>
        <capsuleGeometry args={[0.28, 0.9, 6, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#f1c27d" />
      </mesh>
      <group ref={leftArm} position={[-0.3, 1.1, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.3, 1.1, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      <group ref={leftLeg} position={[-0.15, 0.4, 0]}>
        <mesh castShadow position={[0, -0.3, 0]}>
          <boxGeometry args={[0.16, 0.55, 0.16]} />
          <meshStandardMaterial color="#2b3644" />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.15, 0.4, 0]}>
        <mesh castShadow position={[0, -0.3, 0]}>
          <boxGeometry args={[0.16, 0.55, 0.16]} />
          <meshStandardMaterial color="#2b3644" />
        </mesh>
      </group>
    </group>
  )
}

function NPCCar({ path, speed, offset, color, index, setCollider }: CarConfig & { index: number; setCollider: ColliderSetter }) {
  const ref = useRef<Group | null>(null)
  const curve = useMemo(() => new CatmullRomCurve3(path, true, 'catmullrom', 0.4), [path])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.elapsedTime * speed + offset) % 1
    const pos = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    ref.current.position.set(pos.x, 0.4, pos.z)
    ref.current.rotation.y = Math.atan2(tan.x, tan.z)
    setCollider(index, { x: pos.x, z: pos.z, w: 2.4, d: 4.6 })
  })

  return (
    <group ref={ref}>
      <RoundedBox args={[2.2, 0.45, 4.2]} radius={0.12} smoothness={4} castShadow>
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </RoundedBox>
      <RoundedBox args={[1.4, 0.35, 1.6]} radius={0.1} smoothness={4} castShadow position={[0, 0.35, -0.2]}>
        <meshStandardMaterial color="#151a20" />
      </RoundedBox>
      {[
        [0.9, -0.2, 1.4],
        [-0.9, -0.2, 1.4],
        [0.9, -0.2, -1.4],
        [-0.9, -0.2, -1.4],
      ].map((pos, i) => (
        <mesh key={`npc-car-wheel-${i}`} castShadow position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.2, 16]} />
          <meshStandardMaterial color="#0f1115" />
        </mesh>
      ))}
    </group>
  )
}

export default function NPCs({ collidersRef }: NPCsProps) {
  const internalRef = useRef<Collider[]>([])
  const targetRef = collidersRef ?? internalRef

  const walkerPaths = useMemo(() => {
    return [
      [
        new Vector3(-240, 0, -240),
        new Vector3(240, 0, -240),
        new Vector3(240, 0, 240),
        new Vector3(-240, 0, 240),
      ],
      [
        new Vector3(-720, 0, -120),
        new Vector3(-120, 0, -120),
        new Vector3(-120, 0, 120),
        new Vector3(-720, 0, 120),
      ],
      [
        new Vector3(120, 0, -720),
        new Vector3(720, 0, -720),
        new Vector3(720, 0, -120),
        new Vector3(120, 0, -120),
      ],
      [
        new Vector3(-900, 0, 420),
        new Vector3(-240, 0, 420),
        new Vector3(-240, 0, 900),
        new Vector3(-900, 0, 900),
      ],
    ]
  }, [])

  const carPaths = useMemo(() => {
    return [
      [
        new Vector3(-900, 0, -600),
        new Vector3(900, 0, -600),
        new Vector3(900, 0, -300),
        new Vector3(-900, 0, -300),
      ],
      [
        new Vector3(-600, 0, 300),
        new Vector3(600, 0, 300),
        new Vector3(600, 0, 600),
        new Vector3(-600, 0, 600),
      ],
      [
        new Vector3(-300, 0, -900),
        new Vector3(300, 0, -900),
        new Vector3(300, 0, -300),
        new Vector3(-300, 0, -300),
      ],
    ]
  }, [])

  const walkers: WalkerConfig[] = useMemo(() => {
    const colors = ['#2d6cdf', '#3b9d7a', '#a64f3b', '#7a4fb8', '#c79a2f', '#2f8fa6']
    const items: WalkerConfig[] = []
    for (let i = 0; i < 10; i++) {
      const path = walkerPaths[i % walkerPaths.length]
      items.push({
        path,
        speed: 0.02 + (i % 3) * 0.006,
        offset: i * 0.09,
        color: colors[i % colors.length],
      })
    }
    return items
  }, [walkerPaths])

  const cars: CarConfig[] = useMemo(() => {
    const colors = ['#2b6fdc', '#df3b3b', '#2fa67b', '#c79a2f']
    const items: CarConfig[] = []
    for (let i = 0; i < 6; i++) {
      const path = carPaths[i % carPaths.length]
      items.push({
        path,
        speed: 0.035 + (i % 3) * 0.008,
        offset: i * 0.12,
        color: colors[i % colors.length],
      })
    }
    return items
  }, [carPaths])

  const setCollider: ColliderSetter = (index, c) => {
    targetRef.current[index] = c
  }

  return (
    <group>
      {walkers.map((n, i) => (
        <NPCWalker key={`npc-${i}`} {...n} index={i} setCollider={setCollider} />
      ))}
      {cars.map((n, i) => (
        <NPCCar key={`npc-car-${i}`} {...n} index={i + walkers.length} setCollider={setCollider} />
      ))}
    </group>
  )
}
