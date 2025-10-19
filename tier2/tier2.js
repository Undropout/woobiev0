// tier2.js
import { db, auth } from '../shared/firebase-config.js';
import { ref, set, get, onValue, update, off } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

const questions = [
  "What's a moment in your life that changed the way you see the world?",
  "How do you show someone you care about them?",
  "What's something people often misunderstand about you?",
  "When do you feel most like yourself?",
  "What's one thing you wish more people asked you about?",
  "What makes you feel seen or understood?",
  "What's a belief you held strongly that changed over time?",
  "What's one thing you never get tired of talking about?",
  "When have you felt the most brave?",
  "What do you wish someone had told you earlier in life?",
  "What kind of people do you feel safest around?",
  "What's something you've forgiven yourself for?"
];

let answers = [];
let currentIndex = 0;

// Main logic wrapped in onAuthStateChanged
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("You must be logged in to participate. Redirecting to login.");
    window.location.href = '/auth/login.html';
    return;
  }

  const currentUserId = user.uid;
  const matchID = localStorage.getItem('woobieMatchID');
  const localWoobieUsername = localStorage.getItem('woobieUsername');

  if (!matchID || !localWoobieUsername) {
    alert("Missing critical session data (Match ID or Woobie Name). Please restart.");
    window.location.href = '/name-picker/index.html';
    return;
  }

  console.log(`[Tier2 INIT] MatchID: ${matchID}, UserID: ${currentUserId}, WoobieName: ${localWoobieUsername}`);

  // Update user's current stage
  const userMatchProgressRef = ref(db, `users/${currentUserId}/currentMatch`);
  update(userMatchProgressRef, { stage: 'tier2' });

  // Database references using UID as keys
  const userAnswersRef = ref(db, `matches/${matchID}/tier2/${currentUserId}`);
  const allTier2AnswersRef = ref(db, `matches/${matchID}/tier2`);
  const tier2RewardsRef = ref(db, `matches/${matchID}/tier2Rewards`);

  // Load saved progress from localStorage
  const stored = JSON.parse(localStorage.getItem('tier2Answers') || '[]');
  answers = stored;
  currentIndex = answers.length || 0;

  function updateQuestion(index) {
    if (document.getElementById('question-number')) {
      document.getElementById('question-number').textContent = `Question ${index + 1} of ${questions.length}`;
    }
    if (document.getElementById('question-text')) {
      document.getElementById('question-text').textContent = questions[index];
    }
    if (document.getElementById('answer')) {
      document.getElementById('answer').value = answers[index] || '';
    }
  }

  function saveProgress() {
    localStorage.setItem('tier2Answers', JSON.stringify(answers));
  }

  async function submitAnswers() {
    try {
      // Save answers under the user's UID with metadata
      await set(userAnswersRef, { 
        answers, 
        woobieName: localWoobieUsername,
        timestamp: Date.now() 
      });
      console.log("Tier2 answers submitted successfully");
      
      // Update stage
      await update(userMatchProgressRef, { stage: 'tier2-answers-submitted' });
      
      checkIfBothFinished();
    } catch (err) {
      console.error("Error saving tier2 answers:", err);
      alert("Failed to save answers. Please try again.");
    }
  }

  function checkIfBothFinished() {
    onValue(allTier2AnswersRef, snapshot => {
      const all = snapshot.val() || {};
      if (Object.keys(all).length >= 2) {
        // Both users have submitted answers
        off(allTier2AnswersRef); // Clean up listener
        window.location.href = '/tier2/send.html';
      } else {
        // Still waiting for partner
        if (document.getElementById('question-block')) {
          document.getElementById('question-block').style.display = 'none';
        }
        if (document.getElementById('completion-message')) {
          document.getElementById('completion-message').style.display = 'block';
        }
      }
    });
  }

  // Check if already completed
  if (currentIndex >= questions.length) {
    submitAnswers();
  } else {
    // Start question flow
    updateQuestion(currentIndex);

    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.onclick = () => {
        const answerInput = document.getElementById('answer');
        if (!answerInput) return;
        
        const input = answerInput.value.trim();
        if (!input) return;
        
        answers[currentIndex] = input;
        saveProgress();
        currentIndex++;

        if (currentIndex < questions.length) {
          updateQuestion(currentIndex);
        } else {
          if (document.getElementById('question-block')) {
            document.getElementById('question-block').style.display = 'none';
          }
          if (document.getElementById('completion-message')) {
            document.getElementById('completion-message').style.display = 'block';
          }
          submitAnswers();
        }
      };
    }
  }

  // Watch for rewards completion and auto-redirect
  onValue(tier2RewardsRef, snap => {
    const rewards = snap.val();
    if (rewards && Object.keys(rewards).length >= 2) {
      off(tier2RewardsRef); // Clean up listener
      window.location.href = '/tier2/reveal.html';
    }
  });
});