// router.js
import { auth } from './shared/firebase-config.js'; // Import initialized auth
import { onAuthStateChanged } from 'firebase/auth';

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // If not on login/signup page already, redirect to login
      if (
        !window.location.pathname.includes('/auth/login.html') &&
        !window.location.pathname.includes('/auth/signup.html')
      ) {
        window.location.href = '/auth/login.html';
      }
    } else {
      // User is logged in.
      // If they are on the landing page, login, or signup page,
      // redirect them to resume.html to determine their actual stage from DB.
      if (
        window.location.pathname === '/' ||
        window.location.pathname === '/index.html' ||
        window.location.pathname.includes('/auth/login.html') ||
        window.location.pathname.includes('/auth/signup.html')
      ) {
        window.location.href = '/resume.html';
      }
      // For other pages, they should ideally only be reachable
      // after resume.html has correctly routed them.
      // This router's main job is to protect against unauthenticated access
      // and to kickstart the session resumption for logged-in users.
    }
  });
});