// preferences.js
import { db, auth } from '../shared/firebase-config.js';
import { ref, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

// ... (get genderInput, lookingForInput from form) ...

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const currentUserId = user.uid;
    await update(ref(db, `users/${currentUserId}/profileDetails`), {
      gender: genderInput,
      lookingForGender: lookingForInput // can be an array if multi-select
    });
    // Update main user stage
    await update(ref(db, `users/${currentUserId}/currentMatch`), { // Or users/{uid}/stage
        stage: 'interests-dealbreakers' // Next step
    });
    window.location.href = '/interests-dealbreakers/index.html';
  } else { /* redirect to login */ }
});