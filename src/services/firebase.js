import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCCWZKc4r6TQBXSwLjfchyTDRhW6nubxUU",
  authDomain: "progresshub-51734.firebaseapp.com",
  projectId: "progresshub-51734",
  storageBucket: "progresshub-51734.firebasestorage.app",
  messagingSenderId: "809688294558",
  appId: "1:809688294558:web:7eb607111265d61f80878f",
  measurementId: "G-Z9FMNKQ0EK"
};

export const firebaseReady = Object.values(firebaseConfig).every(Boolean);

const app = firebaseReady ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
