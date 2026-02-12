import React from 'react'
import { Text } from '@react-three/drei'
import { RemotePlayer } from '../multiplayer/useFirebaseMultiplayer'

type Props = {
  players: RemotePlayer[]
}

export default function RemotePlayers({ players }: Props) {
  return (
    <group>
      {players.map((p) => (
        <group key={p.id} position={[p.x, 1, p.z]} rotation={[0, p.yaw, 0]}>
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
      ))}
    </group>
  )
}
