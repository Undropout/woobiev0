// shared/logout.js
import { auth } from './firebase-config.js';
import { signOut } from 'firebase/auth';

const logoutBtn = document.getElementById('logout-button');

if (logoutBtn) {
  logoutBtn.onclick = async () => {
    const confirmLogout = confirm("Are you sure you want to log out? You’ll lose your place unless you're logged in.");
    if (!confirmLogout) return;

    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Firebase sign-out failed:", err);
    }

    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/index.html';
  };
}
