// tier1a.js
import { db } from '../shared/firebase-config.js'; // Needs auth
import { ref, set, onValue } from 'firebase/database';
// Needs to import auth and onAuthStateChanged from firebase/auth

const username = localStorage.getItem('woobieUsername'); // Problematic for DB keys
const matchID = localStorage.getItem('woobieMatchID');

if (!username || !matchID) {
  alert("Missing username or match ID");
  window.location.href = '/index.html'; // Should be /auth/login.html or /resume.html
}

// These refs need to use UID
const answersRef = ref(db, `matches/${matchID}/tier1a/${username}`);
const allAnswersRef = ref(db, `matches/${matchID}/tier1a`);
const voteRef = ref(db, `matches/${matchID}/tier1aVotes/${username}`);
const allVotesRef = ref(db, `matches/${matchID}/tier1aVotes`);

const questions = [
  "What’s something you're proud of recently?",
  "How would a friend describe you?",
  "What does comfort look like to you?",
  "When do you feel most alive?",
  "What’s a recent thought you can’t shake?",
  "How do you usually show someone you care?"
];

let answers = [];
let currentIndex = 0;

const questionBlock = document.getElementById('question-block');
const questionNumber = document.getElementById('question-number');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer');
const submitBtn = document.getElementById('submit-btn');
const completionMessage = document.getElementById('completion-message');
const reviewDiv = document.getElementById('review');

function showQuestion() {
  if (currentIndex >= questions.length) {
    questionBlock.style.display = 'none';
    completionMessage.style.display = 'block';
    // 'answersRef' needs to be UID-keyed
    set(answersRef, answers)
      .then(() => {
        // Optionally dispatch the tier1aComplete event here
        // window.dispatchEvent(new CustomEvent("tier1aComplete"));
        // However, the onValue(allAnswersRef, ...) listener will also trigger revealAnswers
        // which might be a better place if revealAnswers implies completion of this stage part.
      })
      .catch(err => console.error("Error saving tier1a answers:", err));
    return;
  }
  questionNumber.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
  questionText.textContent = questions[currentIndex];
  answerInput.value = answers[currentIndex]?.value || '';
}

submitBtn.onclick = () => {
  const value = answerInput.value.trim();
  if (!value) return;
  answers[currentIndex] = { format: 'text', value, question: questions[currentIndex] }; // Store question text too
  currentIndex++;
  showQuestion();
};

function revealAnswers(all, currentUserUID) { // Pass currentUserUID
  // Partner logic needs to use UID
  const partnerUID = Object.keys(all).find(uidKey => uidKey !== currentUserUID);
  if (!partnerUID) {
    console.log("Waiting for partner's answers...");
    completionMessage.style.display = 'block'; // Keep showing waiting message
    return;
  }
  completionMessage.style.display = 'none'; // Hide waiting once partner is found

  const mine = all[currentUserUID];
  const theirs = all[partnerUID];

  if (!mine || !theirs) {
    console.error("Own or partner's answers missing, though both UIDs are present.");
    return;
  }


  reviewDiv.style.display = 'block';
  reviewDiv.innerHTML = `<h2>Your Answers vs Your Match's</h2>`;
  // Assuming 'mine' and 'theirs' are arrays of answer objects
  // The questions array is already available globally in this script.
  for (let i = 0; i < questions.length; i++) {
    reviewDiv.innerHTML += `
      <div class="qa-block">
        <p><strong>Q${i + 1}:</strong> ${questions[i]}</p>
        <p><strong>You:</strong> ${mine[i]?.value || '<em>No answer</em>'}</p>
        <p><strong>Match:</strong> ${theirs[i]?.value || '<em>No answer</em>'}</p>
      </div>
    `;
  }

  reviewDiv.innerHTML += `
    <button id="vote-yes" class="woobie-button">👍 Continue</button>
    <button id="vote-no" class="woobie-button">👎 No thanks</button>
    <p id="vote-waiting" style="display:none;">Waiting for your match's vote...</p>
  `;

  document.getElementById('vote-yes').onclick = () => handleVote(true, currentUserUID); // Pass UID
  document.getElementById('vote-no').onclick = () => handleVote(false, currentUserUID); // Pass UID
}

function handleVote(value, currentUserUID) { // Pass UID
  // voteRef needs to be UID-keyed
  const userVoteRef = ref(db, `matches/${matchID}/tier1aVotes/${currentUserUID}`);
  set(userVoteRef, value);
  document.getElementById('vote-yes').style.display = 'none';
  document.getElementById('vote-no').style.display = 'none';
  document.getElementById('vote-waiting').style.display = 'block';
}

// --- This whole script needs to be wrapped in onAuthStateChanged ---
import { auth } from '../shared/firebase-config.js'; // Ensure auth is imported
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
  if (user) {
    const currentUserId = user.uid;
    // Update global/module-scoped matchID if it's not already set,
    // or re-fetch from localStorage to ensure it's fresh for this authenticated session.
    // It's better if matchID is also confirmed/retrieved from user's DB profile if possible.
    // For now, we'll rely on localStorage but ensure it's checked after auth.
    const currentMatchID = localStorage.getItem('woobieMatchID');
    const localWoobieUsername = localStorage.getItem('woobieUsername'); // For display or data values, not keys

    if (!localWoobieUsername || !currentMatchID) {
      alert("Critical session data (Woobie name or Match ID) is missing. Please restart.");
      window.location.href = '/name-picker/index.html'; // Or /resume.html
      return;
    }
    
    // Re-define refs with UID
    const userAnswersRef = ref(db, `matches/${currentMatchID}/tier1a/${currentUserId}`);
    const allTier1aAnswersRef = ref(db, `matches/${currentMatchID}/tier1a`); // Stays the same
    // voteRef is defined inside handleVote now, using currentUserId
    const allTier1aVotesRef = ref(db, `matches/${currentMatchID}/tier1aVotes`); // Stays the same

    // Overwrite the global answersRef to be user-specific for the set() operation.
    // This is a bit hacky; ideally, pass userAnswersRef to showQuestion or use it directly in set().
    // For simplicity in this refactor, we'll assume showQuestion will use this updated ref.
    // A cleaner way would be to pass userAnswersRef to showQuestion.
    // Let's modify showQuestion and submitBtn.onclick to use userAnswersRef.

    function showQuestion_UID(userSpecificAnswersRef) { // Modified to accept the correct ref
        if (currentIndex >= questions.length) {
            questionBlock.style.display = 'none';
            completionMessage.style.display = 'block';
            // Set answers under the user's UID
            // Store the WoobieName as a property if needed for display by partner
            set(userSpecificAnswersRef, { answers, woobieName: localWoobieUsername })
                .then(() => {
                    // This is a good place to update the stage in the main user profile
                    // as they've completed submitting answers for this tier.
                    const userMatchProgressRef = ref(db, `users/${currentUserId}/currentMatch`);
                    update(userMatchProgressRef, { stage: 'tier1a-answers-submitted' }); // New specific stage
                })
                .catch(err => console.error("Error saving tier1a answers:", err));
            // The onValue listener for allTier1aAnswersRef will handle reveal
            return;
        }
        questionNumber.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
        questionText.textContent = questions[currentIndex];
        answerInput.value = answers[currentIndex]?.value || ''; // 'answers' is local draft
    }
    
    // Update the global submitBtn.onclick to call the new showQuestion_UID
    // This is still a bit messy due to global `answers` and `currentIndex`.
    // A class or more functional approach would be cleaner.
    submitBtn.onclick = () => {
        const value = answerInput.value.trim();
        if (!value) return;
        answers[currentIndex] = { question: questions[currentIndex], value: value, format: 'text' };
        currentIndex++;
        showQuestion_UID(userAnswersRef); // Call the UID-aware function
    };


    onValue(allTier1aAnswersRef, snap => {
      const all = snap.val();
      if (all && Object.keys(all).length >= 2) {
        // Ensure current user's answers are also present before revealing
        if (all[currentUserId]) {
            revealAnswers(all, currentUserId); // Pass currentUserId
        } else {
            // Current user hasn't submitted yet, but partner has. Keep waiting.
            completionMessage.style.display = 'block';
        }
      } else if (all && Object.keys(all).length === 1 && all[currentUserId]) {
        // Only my answers are in, waiting for partner.
        completionMessage.style.display = 'block';
      }
    });

    onValue(allTier1aVotesRef, snap => {
      const votes = snap.val();
      if (!votes) return;
      const values = Object.values(votes);
      if (values.length < 2) return;

      const bothYes = values.every(v => v === true);
      // Stop listening to prevent multiple navigations
      off(allTier1aVotesRef);
      off(allTier1aAnswersRef); // Also good to clean up this listener

      const userMatchProgressRef = ref(db, `users/${currentUserId}/currentMatch`);
      if (bothYes) {
        update(userMatchProgressRef, { stage: 'tier1a-vote-yes' }); // Or 'reveal-bios'
        window.location.href = '/tier1a/reveal-bios.html';
      } else {
        update(userMatchProgressRef, { stage: 'tier1a-vote-no' }); // Or 'goodbye'
        window.location.href = '/goodbye.html';
      }
    });

    showQuestion_UID(userAnswersRef); // Initial call

  } else {
    // User is not logged in
    alert("You must be logged in to participate. Redirecting to login.");
    window.location.href = '/auth/login.html';
  }
});