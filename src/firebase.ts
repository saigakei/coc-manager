import { initializeApp } from "firebase/app"
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyA1bUNgrdXU5SNEcBcMTqBkTwzTUAfJi7I",
  authDomain: "cocsearch-ead84.firebaseapp.com",
  projectId: "cocsearch-ead84",
  storageBucket: "cocsearch-ead84.firebasestorage.app",
  messagingSenderId: "850134081516",
  appId: "1:850134081516:web:8587a52fbecae4e8a72ac9",
  measurementId: "G-146JETTN3Y"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

setPersistence(auth, browserLocalPersistence)

export const db = getFirestore(app)
export const dbCloud = getFirestore(app)