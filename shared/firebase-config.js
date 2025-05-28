import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';


// ✅ Replace with your own Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBuSQkpBwmggXK38mzmUxiClweWiKxD5bI",
  authDomain: "woobiedinobear.firebaseapp.com",
  databaseURL: "https://woobiedinobear-default-rtdb.firebaseio.com",
  projectId: "woobiedinobear",
  storageBucket: "woobiedinobear.firebasestorage.app",
  messagingSenderId: "642703845433",
  appId: "1:642703845433:web:56be57a1da63e1ecbd85e8"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };