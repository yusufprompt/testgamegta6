import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { RemotePlayer } from '../multiplayer/useFirebaseMultiplayer'
import { Group, Vector3 } from 'three'

type Props = {
  players: RemotePlayer[]
}

function RemoteAvatar({ p }: { p: RemotePlayer }) {
  const ref = useRef<Group | null>(null)
  const targetPos = useRef(new Vector3(p.x, 1, p.z))
  const yaw = useRef(p.yaw)
  const targetYaw = useRef(p.yaw)

  useEffect(() => {
    targetPos.current.set(p.x, 1, p.z)
    targetYaw.current = p.yaw
  }, [p.x, p.z, p.yaw])

  useFrame(() => {
    if (!ref.current) return
    ref.current.position.lerp(targetPos.current, 0.33)
    const diff = ((targetYaw.current - yaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    yaw.current += diff * 0.32
    ref.current.rotation.set(0, yaw.current, 0)
  })

  return (
    <group ref={ref} position={[p.x, 1, p.z]} rotation={[0, p.yaw, 0]}>
      <Text position={[0, 1.35, 0]} fontSize={0.28} color="#ffffff" anchorX="center" anchorY="middle">
        {p.name}
      </Text>
      <mesh castShadow>
        <capsuleGeometry args={[0.35, 0.9, 8, 12]} />
        <meshStandardMaterial color={p.inCar ? '#5d6d7e' : '#2ecc71'} />
      </mesh>
      <mesh castShadow position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#f2c9a0" />
      </mesh>
    </group>
  )
}

export default function RemotePlayers({ players }: Props) {
  return (
    <group>
      {players.map((p) => (
        <RemoteAvatar key={p.id} p={p} />
      ))}
    </group>
  )
}
