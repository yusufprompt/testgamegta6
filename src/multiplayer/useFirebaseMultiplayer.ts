import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export type NetPlayerState = {
  name: string
  x: number
  z: number
  yaw: number
  health: number
  wanted: number
  ammo: number
  inCar: boolean
}

export type RemotePlayer = NetPlayerState & {
  id: string
}

export type NetCarState = {
  id: string
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
  driverId: string | null
  driverName: string | null
}

const STALE_MS = 15000
const DEFAULT_CARS: NetCarState[] = [
  {
    id: 'car-1',
    x: 6,
    y: 0.75,
    z: -6,
    yaw: 0,
    speed: 0,
    gear: 1,
    rpm: 900,
    damage: 0,
    traction: 1,
    headlightsOn: true,
    driverId: null,
    driverName: null,
  },
  {
    id: 'car-2',
    x: -14,
    y: 0.75,
    z: 10,
    yaw: Math.PI * 0.2,
    speed: 0,
    gear: 1,
    rpm: 900,
    damage: 0,
    traction: 1,
    headlightsOn: true,
    driverId: null,
    driverName: null,
  },
  {
    id: 'car-3',
    x: 20,
    y: 0.75,
    z: 14,
    yaw: Math.PI * -0.35,
    speed: 0,
    gear: 1,
    rpm: 900,
    damage: 0,
    traction: 1,
    headlightsOn: true,
    driverId: null,
    driverName: null,
  },
  {
    id: 'car-4',
    x: -24,
    y: 0.75,
    z: -18,
    yaw: Math.PI * 0.55,
    speed: 0,
    gear: 1,
    rpm: 900,
    damage: 0,
    traction: 1,
    headlightsOn: true,
    driverId: null,
    driverName: null,
  },
]

export function useFirebaseMultiplayer(localState: NetPlayerState, roomId: string) {
  const clientId = useMemo(
    () => `p-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
    []
  )
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([])
  const [cars, setCars] = useState<NetCarState[]>(DEFAULT_CARS)
  const [firebaseError, setFirebaseError] = useState<string | null>(null)
  const lastSentRef = useRef(0)
  const lastCarSentRef = useRef<Record<string, number>>({})
  const safeName = localState.name.trim() ? localState.name.trim().slice(0, 16) : 'Guest'
  const toErr = (label: string, err: unknown) => {
    if (typeof err === 'object' && err && 'message' in err && typeof err.message === 'string') {
      return `${label}: ${err.message}`
    }
    return `${label}: bilinmeyen hata`
  }

  useEffect(() => {
    setFirebaseError(null)
    for (const car of DEFAULT_CARS) {
      const carRef = doc(db, 'rooms', roomId, 'cars', car.id)
      void setDoc(
        carRef,
        {
          ...car,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => setFirebaseError(toErr('Cars init', err)))
    }
  }, [roomId])

  useEffect(() => {
    const playersCol = collection(db, 'rooms', roomId, 'players')
    const unsub = onSnapshot(
      playersCol,
      (snap) => {
        const now = Date.now()
        const next: RemotePlayer[] = []

        snap.forEach((item) => {
          if (item.id === clientId) return
          const raw = item.data() as Partial<NetPlayerState> & { updatedAt?: Timestamp }
          const updatedAtMs = raw.updatedAt?.toMillis?.() ?? 0
          if (updatedAtMs > 0 && now - updatedAtMs > STALE_MS) return
          if (typeof raw.x !== 'number' || typeof raw.z !== 'number' || typeof raw.yaw !== 'number') return

          next.push({
            id: item.id,
            name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 16) : 'Guest',
            x: raw.x,
            z: raw.z,
            yaw: raw.yaw,
            health: typeof raw.health === 'number' ? raw.health : 100,
            wanted: typeof raw.wanted === 'number' ? raw.wanted : 0,
            ammo: typeof raw.ammo === 'number' ? raw.ammo : 0,
            inCar: !!raw.inCar,
          })
        })

        setRemotePlayers(next)
      },
      (err) => setFirebaseError(toErr('Players listener', err))
    )

    return () => unsub()
  }, [clientId, roomId])

  useEffect(() => {
    const carsCol = collection(db, 'rooms', roomId, 'cars')
    const unsub = onSnapshot(
      carsCol,
      (snap) => {
        const byId = new Map<string, NetCarState>()
        for (const baseCar of DEFAULT_CARS) byId.set(baseCar.id, baseCar)

        snap.forEach((item) => {
          const raw = item.data() as Partial<NetCarState>
          const prev = byId.get(item.id)
          if (!prev) return
          byId.set(item.id, {
            ...prev,
            ...raw,
            id: item.id,
            driverId: typeof raw.driverId === 'string' ? raw.driverId : null,
            driverName: typeof raw.driverName === 'string' ? raw.driverName : null,
          })
        })

        setCars(Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id)))
      },
      (err) => setFirebaseError(toErr('Cars listener', err))
    )

    return () => unsub()
  }, [roomId])

  useEffect(() => {
    const now = Date.now()
    if (now - lastSentRef.current < 90) return
    lastSentRef.current = now

    const playerRef = doc(db, 'rooms', roomId, 'players', clientId)
    void setDoc(
      playerRef,
      {
        ...localState,
        name: safeName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => setFirebaseError(toErr('Player write', err)))
  }, [clientId, localState, roomId, safeName])

  useEffect(() => {
    const playerRef = doc(db, 'rooms', roomId, 'players', clientId)

    const clean = () => {
      void deleteDoc(playerRef).catch(() => {})
    }

    window.addEventListener('beforeunload', clean)
    return () => {
      window.removeEventListener('beforeunload', clean)
      clean()
    }
  }, [clientId, roomId])

  const tryEnterCar = async (carId: string) => {
    try {
      const carRef = doc(db, 'rooms', roomId, 'cars', carId)
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(carRef)
        const raw = snap.exists() ? (snap.data() as Partial<NetCarState> & { updatedAt?: Timestamp }) : undefined
        const updatedAtMs = raw?.updatedAt?.toMillis?.() ?? 0
        const occupiedByOther =
          !!raw?.driverId && raw.driverId !== clientId && (updatedAtMs === 0 || Date.now() - updatedAtMs < STALE_MS)
        if (occupiedByOther) return false

        tx.set(
          carRef,
          {
            driverId: clientId,
            driverName: safeName,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
        return true
      })
    } catch (err) {
      setFirebaseError(toErr('Try enter car', err))
      return false
    }
  }

  const leaveCar = async (carId: string, patch?: Partial<NetCarState>) => {
    try {
      const carRef = doc(db, 'rooms', roomId, 'cars', carId)
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(carRef)
        const raw = snap.exists() ? (snap.data() as Partial<NetCarState>) : undefined
        if (raw?.driverId && raw.driverId !== clientId) return false
        tx.set(
          carRef,
          {
            ...patch,
            driverId: null,
            driverName: null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
        return true
      })
    } catch (err) {
      setFirebaseError(toErr('Leave car', err))
      return false
    }
  }

  const pushCarState = (carId: string, patch: Partial<NetCarState>) => {
    const now = Date.now()
    const lastSent = lastCarSentRef.current[carId] ?? 0
    if (now - lastSent < 80) return
    lastCarSentRef.current[carId] = now

    const carRef = doc(db, 'rooms', roomId, 'cars', carId)
    void setDoc(
      carRef,
      {
        ...patch,
        driverId: clientId,
        driverName: safeName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => setFirebaseError(toErr('Car write', err)))
  }

  return { clientId, remotePlayers, cars, tryEnterCar, leaveCar, pushCarState, firebaseError }
}
