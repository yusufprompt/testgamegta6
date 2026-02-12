import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCBox8JZAcGI98_GdJmenU-jyXZgzxznx0',
  authDomain: 'gta6sigma-993ab.firebaseapp.com',
  projectId: 'gta6sigma-993ab',
  storageBucket: 'gta6sigma-993ab.firebasestorage.app',
  messagingSenderId: '39588309835',
  appId: '1:39588309835:web:73155da01cf0faf24e56ce',
  measurementId: 'G-SX2L51HT2W',
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
