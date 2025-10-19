// tier1a.js
import { db, auth } from '../shared/firebase-config.js';
import { ref, set, onValue, update, off } from 'firebase/database'; // Added update and off
import { onAuthStateChanged } from 'firebase/auth';

const username = localStorage.getItem('woobieUsername'); // Still used for display
const matchID = localStorage.getItem('woobieMatchID');

if (!username || !matchID) {
  alert("Missing username or match ID");
  window.location.href = '/auth/login.html';
}

const questions = [
  "What's something you're proud of recently?",
  "How would a friend describe you?",
  "What does comfort look like to you?",
  "When do you feel most alive?",
  "What's a recent thought you can't shake?",
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

function revealAnswers(all, currentUserUID) {
  const partnerUID = Object.keys(all).find(uidKey => uidKey !== currentUserUID);
  if (!partnerUID) {
    console.log("Waiting for partner's answers...");
    completionMessage.style.display = 'block';
    return;
  }
  completionMessage.style.display = 'none';

  const mine = all[currentUserUID];
  const theirs = all[partnerUID];

  if (!mine || !theirs) {
    console.error("Own or partner's answers missing, though both UIDs are present.");
    return;
  }

  // Handle both old format (direct arrays) and new format (objects with answers property)
  const myAnswers = Array.isArray(mine) ? mine : (mine.answers || []);
  const theirAnswers = Array.isArray(theirs) ? theirs : (theirs.answers || []);

  reviewDiv.style.display = 'block';
  reviewDiv.innerHTML = `<h2>Your Answers vs Your Match's</h2>`;
  
  for (let i = 0; i < questions.length; i++) {
    reviewDiv.innerHTML += `
      <div class="qa-block" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #333;">
        <p><strong>Q${i + 1}:</strong> ${questions[i]}</p>
        <p><strong>You:</strong> ${myAnswers[i]?.value || myAnswers[i] || '<em>No answer</em>'}</p>
        <p><strong>Match:</strong> ${theirAnswers[i]?.value || theirAnswers[i] || '<em>No answer</em>'}</p>
      </div>
    `;
  }

  reviewDiv.innerHTML += `
    <div style="margin-top: 2rem; text-align: center;">
      <button id="vote-yes" class="woobie-button">👍 Continue</button>
      <button id="vote-no" class="woobie-button">👎 No thanks</button>
      <p id="vote-waiting" style="display:none; color:#33ff33;">Waiting for your match's vote...</p>
    </div>
  `;

  document.getElementById('vote-yes').onclick = () => handleVote(true, currentUserUID);
  document.getElementById('vote-no').onclick = () => handleVote(false, currentUserUID);
}

function handleVote(value, currentUserUID) {
  const userVoteRef = ref(db, `matches/${matchID}/tier1aVotes/${currentUserUID}`);
  set(userVoteRef, value);
  document.getElementById('vote-yes').style.display = 'none';
  document.getElementById('vote-no').style.display = 'none';
  document.getElementById('vote-waiting').style.display = 'block';
}

// Main logic wrapped in onAuthStateChanged
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("You must be logged in to participate. Redirecting to login.");
    window.location.href = '/auth/login.html';
    return;
  }

  const currentUserId = user.uid;
  const currentMatchID = localStorage.getItem('woobieMatchID');
  const localWoobieUsername = localStorage.getItem('woobieUsername');

  if (!localWoobieUsername || !currentMatchID) {
    alert("Critical session data (Woobie name or Match ID) is missing. Please restart.");
    window.location.href = '/name-picker/index.html';
    return;
  }
  
  // Database references using UID as keys
  const userAnswersRef = ref(db, `matches/${currentMatchID}/tier1a/${currentUserId}`);
  const allTier1aAnswersRef = ref(db, `matches/${currentMatchID}/tier1a`);
  const allTier1aVotesRef = ref(db, `matches/${currentMatchID}/tier1aVotes`);

  function showQuestion() {
    if (currentIndex >= questions.length) {
      questionBlock.style.display = 'none';
      completionMessage.style.display = 'block';
      
      // Save answers under the user's UID with metadata
      set(userAnswersRef, { 
        answers, 
        woobieName: localWoobieUsername,
        timestamp: Date.now()
      })
      .then(() => {
        console.log("Tier1a answers saved successfully");
        // Update user's stage
        const userMatchProgressRef = ref(db, `users/${currentUserId}/currentMatch`);
        return update(userMatchProgressRef, { stage: 'tier1a-answers-submitted' });
      })
      .catch(err => console.error("Error saving tier1a answers:", err));
      return;
    }
    
    if (questionNumber) questionNumber.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
    if (questionText) questionText.textContent = questions[currentIndex];
    if (answerInput) answerInput.value = answers[currentIndex]?.value || '';
  }
  
  // Set up submit button handler
  if (submitBtn) {
    submitBtn.onclick = () => {
      if (!answerInput) return;
      const value = answerInput.value.trim();
      if (!value) return;
      
      answers[currentIndex] = { 
        question: questions[currentIndex], 
        value: value, 
        format: 'text' 
      };
      currentIndex++;
      showQuestion();
    };
  }

  // Listen for when both users have submitted answers
  onValue(allTier1aAnswersRef, snap => {
    const all = snap.val();
    if (all && Object.keys(all).length >= 2) {
      // Ensure current user's answers are present before revealing
      if (all[currentUserId]) {
        revealAnswers(all, currentUserId);
      } else {
        // Current user hasn't submitted yet, but partner has. Keep waiting.
        if (completionMessage) completionMessage.style.display = 'block';
      }
    } else if (all && Object.keys(all).length === 1 && all[currentUserId]) {
      // Only my answers are in, waiting for partner.
      if (completionMessage) completionMessage.style.display = 'block';
    }
  });

  // Listen for votes
  onValue(allTier1aVotesRef, snap => {
    const votes = snap.val();
    if (!votes) return;
    const values = Object.values(votes);
    if (values.length < 2) return;

    const bothYes = values.every(v => v === true);
    
    // Clean up listeners before navigating
    off(allTier1aVotesRef);
    off(allTier1aAnswersRef);

    const userMatchProgressRef = ref(db, `users/${currentUserId}/currentMatch`);
    if (bothYes) {
      update(userMatchProgressRef, { stage: 'tier1a-bios-revealed' })
        .then(() => {
          window.location.href = '/tier1a/reveal-bios.html';
        });
    } else {
      update(userMatchProgressRef, { stage: 'tier1a-vote-no' })
        .then(() => {
          window.location.href = '/goodbye.html';
        });
    }
  });

  // Start the question flow
  showQuestion();
});