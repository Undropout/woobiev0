// waiting.js (for waiting.html)
import { db, auth } from '../shared/firebase-config.js';
import { ref, onValue, update, off } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

const statusMessageEl = document.getElementById('statusMessage');
const matchIdDisplayEl = document.getElementById('matchIdDisplay');

let currentUserId = null;
let userCurrentMatchListener = null; // Listener for /users/{uid}/currentMatch
let initialPotentialMatchID = null; // The matchID this user's client was initially associated with

// Ensure DOM elements exist
if (!statusMessageEl || !matchIdDisplayEl) {
    console.error("Essential DOM elements (statusMessage or matchIdDisplay) not found on waiting.html. Script may not function as expected.");
    // You might want to display an error to the user here or halt.
}

function cleanupListeners() {
    if (userCurrentMatchListener && currentUserId) {
        off(ref(db, `users/${currentUserId}/currentMatch`), 'value', userCurrentMatchListener);
        console.log("Detached userCurrentMatchListener for user:", currentUserId);
        userCurrentMatchListener = null;
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        initialPotentialMatchID = localStorage.getItem('woobieMatchID');

        if (matchIdDisplayEl) {
            if (initialPotentialMatchID) {
                matchIdDisplayEl.textContent = initialPotentialMatchID;
            } else {
                matchIdDisplayEl.textContent = "ID not found from previous step.";
                console.warn("Initial potentialMatchID not found in localStorage on waiting page for user:", currentUserId);
            }
        }
        
        if (!currentUserId) {
            console.error("Critical error: User authenticated but UID is null on waiting page.");
            if(statusMessageEl) statusMessageEl.textContent = "Authentication error. Please try logging in again.";
            // No setTimeout for redirect here, as auth state might be resolving.
            // If it persists, user will be stuck or other scripts might redirect.
            return;
        }

        console.log(`Waiting page: User ${currentUserId} is logged in. Initial potential matchID from localStorage: ${initialPotentialMatchID}`);
        if(statusMessageEl) statusMessageEl.textContent = 'Looking for a Woobie friend for you... Please wait.';

        const userCurrentMatchDataRef = ref(db, `users/${currentUserId}/currentMatch`);

        // Cleanup previous listener before attaching a new one (e.g., if this auth state changes multiple times)
        if (userCurrentMatchListener) {
            off(userCurrentMatchDataRef, 'value', userCurrentMatchListener);
        }

        userCurrentMatchListener = onValue(userCurrentMatchDataRef, async (snapshot) => {
            const currentMatchData = snapshot.val();

            if (currentMatchData && currentMatchData.stage && currentMatchData.matchID) {
                console.log("Waiting page: Update received on user's currentMatch node:", currentMatchData);
                const stageFromDB = currentMatchData.stage;
                const finalMatchIDFromDB = currentMatchData.matchID;

                // The Cloud Function (advancedMatchmaker) should set the stage to 'bio'
                // after a successful match and all other DB updates.
                if (stageFromDB === 'bio' || stageFromDB.startsWith('tier') || stageFromDB === 'chatroom') {
                    console.log(`Match confirmed by stage update to '${stageFromDB}'. Final Match ID: ${finalMatchIDFromDB}`);
                    
                    cleanupListeners(); // Detach this listener

                    try {
                        if (auth.currentUser) {
                            await auth.currentUser.getIdToken(true); // Force refresh ID token
                            console.log("ID token refreshed, custom claims should be available for user:", currentUserId);
                        } else {
                            throw new Error("User session lost before token refresh on waiting page.");
                        }
                    } catch (tokenError) {
                        console.error("Error refreshing ID token for user:", currentUserId, tokenError);
                        // Proceed with redirect, but storage access reliant on claims might fail.
                    }

                    // Update localStorage with the definite finalMatchID from the database
                    localStorage.setItem('woobieMatchID', finalMatchIDFromDB);
                    if (matchIdDisplayEl) matchIdDisplayEl.textContent = `${finalMatchIDFromDB} (MATCHED!)`;
                    if (statusMessageEl) statusMessageEl.textContent = `Match found! Proceeding to ${stageFromDB}...`;
                    
                    // Determine next page based on the stage set by the Cloud Function.
                    // In the new flow, after matching, the next step is 'bio'.
                    let nextPage = '/bio/index.html';
                    if (stageFromDB === 'bio') {
                        nextPage = '/bio/index.html';
                    } else if (stageFromDB.startsWith('tier')) {
                        // Example: if stage is 'tier1a', redirect to '/tier1a/index.html'
                        // This part depends on how your stageToPath map is defined elsewhere or if you want to define it here.
                        // For now, we assume CF sets to 'bio' first.
                        const stageToPath = {
                            'tier1a': '/tier1a/index.html',
                            'tier1b': '/tier1b/index.html',
                            'tier2': '/tier2/index.html',
                            'tier2-complete': '/tier2/send.html',
                            'tier2-reveal': '/tier2/reveal.html',
                            'tier3': '/tier3/index.html',
                            'chatroom': '/chat/index.html'
                        };
                        nextPage = stageToPath[stageFromDB] || '/bio/index.html'; // Fallback to bio
                    } else if (stageFromDB === 'chatroom') {
                        nextPage = '/chat/index.html';
                    }
                    
                    console.log(`Redirecting to: ${nextPage}`);
                    window.location.href = nextPage;

                } else if (stageFromDB === 'waiting_in_queue') {
                    console.log(`Still waiting. Current stage in DB: ${stageFromDB}. Potential MatchID: ${finalMatchIDFromDB || initialPotentialMatchID}`);
                    if (matchIdDisplayEl && (finalMatchIDFromDB || initialPotentialMatchID)) {
                        matchIdDisplayEl.textContent = finalMatchIDFromDB || initialPotentialMatchID;
                    }
                } else {
                     console.log(`Current stage is '${stageFromDB}'. Not yet the stage for proceeding past waiting. MatchID: ${finalMatchIDFromDB || initialPotentialMatchID}`);
                }
            } else {
                console.log("Waiting page: currentMatch data, or its stage/matchID, is missing in user's profile for user:", currentUserId, "(Snapshot data: ", currentMatchData, ")");
                if(statusMessageEl) statusMessageEl.textContent = "Waiting for session details to be fully initialized...";
            }
        }, (error) => {
            console.error("Error listening to user's currentMatch node on waiting page:", error);
            if(statusMessageEl) statusMessageEl.textContent = "Error connecting to session updates. Please check connection or try again.";
        });

        // Ensure listener is cleaned up if the page is left for any reason
        window.addEventListener('beforeunload', cleanupListeners);

    } else {
        // User is not logged in
        console.log("Waiting page: User not logged in, redirecting to login.");
        if(statusMessageEl) statusMessageEl.textContent = "Not logged in. Redirecting...";
        setTimeout(() => { window.location.href = '/auth/login.html'; }, 2000);
    }
});