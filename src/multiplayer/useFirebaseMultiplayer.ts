import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
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

export type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAtMs: number
}

const STALE_MS = 15000
const PLAYER_SYNC_MIN_MS = 700
const PLAYER_HEARTBEAT_MS = 5000
const CAR_SYNC_MIN_MS = 220
const CAR_HEARTBEAT_MS = 1500
const CHAT_LISTEN_LIMIT = 60
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [firebaseError, setFirebaseError] = useState<string | null>(null)
  const lastSentRef = useRef(0)
  const lastCarSentRef = useRef<Record<string, number>>({})
  const lastPlayerPayloadRef = useRef<NetPlayerState | null>(null)
  const lastCarPayloadRef = useRef<Record<string, Partial<NetCarState>>>({})
  const quotaBlockedRef = useRef(false)
  const safeName = localState.name.trim() ? localState.name.trim().slice(0, 16) : 'Guest'
  const toErr = (label: string, err: unknown) => {
    if (typeof err === 'object' && err && 'message' in err && typeof err.message === 'string') {
      return `${label}: ${err.message}`
    }
    return `${label}: bilinmeyen hata`
  }
  const isQuotaError = (err: unknown) => {
    if (typeof err !== 'object' || !err) return false
    const maybeCode = 'code' in err && typeof err.code === 'string' ? err.code : ''
    const maybeMsg = 'message' in err && typeof err.message === 'string' ? err.message.toLowerCase() : ''
    return maybeCode === 'resource-exhausted' || maybeMsg.includes('quota exceeded')
  }
  const setWriteErr = (label: string, err: unknown) => {
    if (isQuotaError(err)) {
      quotaBlockedRef.current = true
      setFirebaseError(`${label}: Quota exceeded (Spark limit)`)
      return
    }
    setFirebaseError(toErr(label, err))
  }

  useEffect(() => {
    setRemotePlayers([])
    setCars(DEFAULT_CARS)
    setChatMessages([])
    setFirebaseError(null)
    quotaBlockedRef.current = false
    lastSentRef.current = 0
    lastCarSentRef.current = {}
    lastPlayerPayloadRef.current = null
    lastCarPayloadRef.current = {}
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
    const chatQuery = query(collection(db, 'rooms', roomId, 'cars'), limit(CHAT_LISTEN_LIMIT))
    const unsub = onSnapshot(
      chatQuery,
      (snap) => {
        const rows: ChatMessage[] = []
        snap.forEach((item) => {
          const raw = item.data() as {
            kind?: string
            senderId?: string
            senderName?: string
            text?: string
            createdAt?: Timestamp
          }
          if (raw.kind !== 'chat') return
          if (typeof raw.text !== 'string' || !raw.text.trim()) return
          rows.push({
            id: item.id,
            senderId: typeof raw.senderId === 'string' ? raw.senderId : '',
            senderName: typeof raw.senderName === 'string' && raw.senderName.trim() ? raw.senderName.slice(0, 16) : 'Guest',
            text: raw.text.slice(0, 180),
            createdAtMs: raw.createdAt?.toMillis?.() ?? 0,
          })
        })
        rows.sort((a, b) => a.createdAtMs - b.createdAtMs)
        setChatMessages(rows)
      },
      (err) => setFirebaseError(toErr('Chat listener', err))
    )

    return () => unsub()
  }, [roomId])

  useEffect(() => {
    if (quotaBlockedRef.current) return
    const now = Date.now()
    const prev = lastPlayerPayloadRef.current
    const changed =
      !prev ||
      Math.abs(localState.x - prev.x) > 0.2 ||
      Math.abs(localState.z - prev.z) > 0.2 ||
      Math.abs(localState.yaw - prev.yaw) > 0.1 ||
      localState.health !== prev.health ||
      localState.wanted !== prev.wanted ||
      localState.ammo !== prev.ammo ||
      localState.inCar !== prev.inCar ||
      safeName !== prev.name

    const gap = changed ? PLAYER_SYNC_MIN_MS : PLAYER_HEARTBEAT_MS
    if (now - lastSentRef.current < gap) return

    const playerRef = doc(db, 'rooms', roomId, 'players', clientId)
    void setDoc(
      playerRef,
      {
        ...localState,
        name: safeName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
      .then(() => {
        lastSentRef.current = now
        lastPlayerPayloadRef.current = { ...localState, name: safeName }
      })
      .catch((err) => setWriteErr('Player write', err))
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
    if (quotaBlockedRef.current) return false
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
      setWriteErr('Try enter car', err)
      return false
    }
  }

  const leaveCar = async (carId: string, patch?: Partial<NetCarState>) => {
    if (quotaBlockedRef.current) return false
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
      setWriteErr('Leave car', err)
      return false
    }
  }

  const pushCarState = (carId: string, patch: Partial<NetCarState>) => {
    if (quotaBlockedRef.current) return
    const now = Date.now()
    const lastSent = lastCarSentRef.current[carId] ?? 0
    const prev = lastCarPayloadRef.current[carId]
    const changed =
      !prev ||
      Math.abs((patch.x ?? 0) - (prev.x ?? 0)) > 0.2 ||
      Math.abs((patch.z ?? 0) - (prev.z ?? 0)) > 0.2 ||
      Math.abs((patch.yaw ?? 0) - (prev.yaw ?? 0)) > 0.1 ||
      Math.abs((patch.speed ?? 0) - (prev.speed ?? 0)) > 0.8 ||
      (patch.gear ?? 0) !== (prev.gear ?? 0) ||
      !!patch.headlightsOn !== !!prev.headlightsOn

    const minGap = changed ? CAR_SYNC_MIN_MS : CAR_HEARTBEAT_MS
    if (now - lastSent < minGap) return

    lastCarSentRef.current[carId] = now
    lastCarPayloadRef.current[carId] = { ...patch }

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
    ).catch((err) => setWriteErr('Car write', err))
  }

  const sendChatMessage = async (text: string) => {
    if (quotaBlockedRef.current) return
    const clean = text.trim().slice(0, 180)
    if (!clean) return
    try {
      const col = collection(db, 'rooms', roomId, 'cars')
      await addDoc(col, {
        kind: 'chat',
        senderId: clientId,
        senderName: safeName,
        text: clean,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      setWriteErr('Chat write', err)
    }
  }

  return {
    clientId,
    remotePlayers,
    cars,
    tryEnterCar,
    leaveCar,
    pushCarState,
    chatMessages,
    sendChatMessage,
    firebaseError,
  }
}
