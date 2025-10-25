import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';


// ✅ Replace with your own Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA6KtUmx5yKqN63V9j-FUTdG_JuhVi6N3A",
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

// Connect to emulators if running locally
// Set VITE_USE_EMULATORS=true in your environment or URL query param ?useEmulators=true
const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true' ||
                     window.location.hostname === 'localhost' && window.location.search.includes('useEmulators=true');

if (useEmulators) {
  console.log('🔧 Using Firebase Emulators');
  connectDatabaseEmulator(db, 'localhost', 9000);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectStorageEmulator(storage, 'localhost', 9199);
}

export { db, auth, storage };