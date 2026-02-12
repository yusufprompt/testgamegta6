import React, { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CanvasTexture, Group, Vector3 } from 'three'

type KeyMap = { [key: string]: boolean }

type Props = {
  view: 'third' | 'first'
  onUpdate: (s: { x: number; z: number; yaw: number; health: number; wanted: number; ammo: number }) => void
  active: boolean
  spawnAt?: [number, number, number] | null
}

function makeStripTexture(color: string, color2: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = color2
  for (let i = 0; i < 8; i++) ctx.fillRect((i % 2) * 32, i * 8, 32, 8)
  return new CanvasTexture(canvas)
}

export default function Player({ view, onUpdate, active, spawnAt }: Props) {
  const ref = useRef<Group | null>(null)
  const visualRef = useRef<Group | null>(null)
  const { camera } = useThree()
  const speed = 6
  const keys = useRef<KeyMap>({})
  const [health, setHealth] = useState(100)
  const [wanted, setWanted] = useState(0)
  const [ammo, setAmmo] = useState(30)
  const [projectiles, setProjectiles] = useState<Array<any>>([])
  const playerTexture = useRef<CanvasTexture | null>(null)

  useEffect(() => {
    playerTexture.current = makeStripTexture('#ff5555', '#aa2222')
  }, [])

  useEffect(() => {
    if (!active) return
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      keys.current[k] = true
      if (k === ' ' || k === 'spacebar') {
        // fire: use the player's world forward direction (robust) and spawn slightly ahead+above
        if (ammo > 0) {
          setAmmo((a) => a - 1)
          if (ref.current) {
            const dir = new Vector3()
            ref.current.getWorldDirection(dir)
            dir.y = 0
            dir.normalize()
            // ensure forward is not zero
            if (dir.lengthSq() === 0) dir.set(0, 0, -1)
            const spawnPos = ref.current.position.clone().add(dir.clone().multiplyScalar(1.6))
            spawnPos.y += 1.0
            const velocity = dir.clone().multiplyScalar(28)
            setProjectiles((p) => [...p, { pos: spawnPos, vel: velocity, t: 0 }])
            setWanted((w) => Math.min(5, w + 1))
          }
        }
      }
    }
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [ammo, active])

  useEffect(() => {
    if (spawnAt && ref.current) {
      ref.current.position.set(spawnAt[0], spawnAt[1], spawnAt[2])
    }
  }, [spawnAt])

  useFrame((state, delta) => {
    if (!ref.current || !active) return
    // movement relative to camera forward (so W moves toward camera forward)
    const dir = new Vector3()
    if (keys.current['w'] || keys.current['arrowup']) dir.z += 1
    if (keys.current['s'] || keys.current['arrowdown']) dir.z -= 1
    if (keys.current['a'] || keys.current['arrowleft']) dir.x -= 1
    if (keys.current['d'] || keys.current['arrowright']) dir.x += 1

    const moving = dir.lengthSq() > 0
    if (moving) {
      dir.normalize()
      // rotate direction by camera yaw so controls feel natural (forward = camera forward)
      const camDir = new Vector3()
      camera.getWorldDirection(camDir)
      camDir.y = 0
      camDir.normalize()
      const camRight = new Vector3().crossVectors(new Vector3(0, 1, 0), camDir).normalize()
      const move = new Vector3()
      // forward = camera forward, left/right = camera right
      move.addScaledVector(camDir, dir.z)
      // fix inverted A/D: move left when A, right when D
      move.addScaledVector(camRight, -dir.x)
      move.normalize()
      move.multiplyScalar(speed * delta)
      ref.current.position.add(move)
      // smooth face movement direction (slower head turn)
      const desiredYaw = Math.atan2(move.x, move.z)
      const currentYaw = ref.current.rotation.y
      const diff = ((desiredYaw - currentYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      ref.current.rotation.y = currentYaw + diff * 0.08
    }

    if (visualRef.current) {
      const bob = Math.sin(state.clock.elapsedTime * (moving ? 10 : 2.5)) * (moving ? 0.05 : 0.02)
      visualRef.current.position.y = bob
    }

    // update projectiles
    setProjectiles((ps) =>
      ps
        .map((p) => ({ pos: p.pos.add(p.vel.clone().multiplyScalar(delta)), vel: p.vel, t: p.t + delta }))
        .filter((p) => p.t < 3)
    )

    // send state up for UI
    onUpdate({
      x: ref.current.position.x,
      z: ref.current.position.z,
      yaw: ref.current.rotation.y,
      health,
      wanted,
      ammo,
    })

    // Camera follow: smooth third/first person
    try {
      const forward = new Vector3()
      ref.current.getWorldDirection(forward)
      forward.y = 0
      forward.normalize()

      if (view === 'third') {
        const desired = ref.current.position.clone()
        // place camera behind player along forward vector (closer & a bit higher)
        desired.add(forward.clone().multiplyScalar(-6))
        desired.y = ref.current.position.y + 3
        camera.position.lerp(desired, 0.18)
        camera.lookAt(ref.current.position.x, ref.current.position.y + 1.2, ref.current.position.z)
      } else {
        // first-person: camera at head height, quick follow
        const desired = ref.current.position.clone()
        desired.y = ref.current.position.y + 1.7
        camera.position.lerp(desired, 0.6)
        const lookPoint = ref.current.position.clone().add(forward.clone().multiplyScalar(10))
        camera.lookAt(lookPoint)
      }
    } catch (e) {
      /* ignore camera errors */
    }
  })

  return (
    <group>
      <group ref={ref} position={[0, 1, 0]} visible={active}>
        <group ref={visualRef}>
          <mesh castShadow>
            <capsuleGeometry args={[0.35, 0.9, 8, 12]} />
            <meshStandardMaterial map={playerTexture.current || undefined} color="#d9534f" />
          </mesh>
          <mesh castShadow position={[0, 0.75, 0]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color="#f2c9a0" />
          </mesh>
          <mesh castShadow position={[0, 0.3, 0]}>
            <boxGeometry args={[0.75, 0.22, 0.4]} />
            <meshStandardMaterial color="#1f2a33" />
          </mesh>
          <mesh castShadow position={[0.45, 0.2, 0]}>
            <boxGeometry args={[0.14, 0.48, 0.14]} />
            <meshStandardMaterial color="#d9534f" />
          </mesh>
          <mesh castShadow position={[-0.45, 0.2, 0]}>
            <boxGeometry args={[0.14, 0.48, 0.14]} />
            <meshStandardMaterial color="#d9534f" />
          </mesh>
          <mesh castShadow position={[0.18, -0.48, 0]}>
            <boxGeometry args={[0.18, 0.55, 0.18]} />
            <meshStandardMaterial color="#2b3644" />
          </mesh>
          <mesh castShadow position={[-0.18, -0.48, 0]}>
            <boxGeometry args={[0.18, 0.55, 0.18]} />
            <meshStandardMaterial color="#2b3644" />
          </mesh>
        </group>
      </group>

      {active &&
        projectiles.map((p, i) => (
          <mesh key={i} position={p.pos.toArray()}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#ff0" />
          </mesh>
        ))}
    </group>
  )
}
