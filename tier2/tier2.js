// tier2.js
import { db, auth } from '../shared/firebase-config.js';
import { ref, set, get, onValue, update, off } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

const questionBank = [
  "What trait do you admire most in someone you love?",
  "What's the most spontaneous thing you've ever done?",
  "What's a small thing that always makes you smile?",
  "If you could relive one day, which would it be?",
  "What's something you're still healing from?",
  "What's a compliment you've never forgotten?",
  "What do you think people notice first about you?",
  "What's a fear you've overcome?",
  "What's one thing you'd never compromise on?",
  "How do you define success?",
  "What's something you're looking forward to?",
  "What's a tradition you hope to continue or start?",
  "What do you value most in a friendship?",
  "What's a moment you're proud of but don't talk about often?",
  "What's something that feels like home to you?",
  "What's a risk you're glad you took?",
  "What's one thing you wish you could tell your younger self?",
  "What kind of legacy do you want to leave?",
  "What's something that always grounds you when life feels chaotic?",
  "What's a dream you've had for as long as you can remember?"
];

let questions = [];

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
  let matchID = localStorage.getItem('woobieMatchID');
  let localWoobieUsername = localStorage.getItem('woobieUsername');

  // Fallback to database if localStorage is empty
  if (!matchID || !localWoobieUsername) {
    get(ref(db, `users/${currentUserId}/currentMatch`))
      .then(snap => {
        const matchData = snap.val();
        if (!matchData || !matchData.matchID || !matchData.username) {
          alert("No match found. Please restart.");
          window.location.href = '/name-picker/index.html';
          return;
        }
        matchID = matchData.matchID;
        localWoobieUsername = matchData.username;
        localStorage.setItem('woobieMatchID', matchID);
        localStorage.setItem('woobieUsername', localWoobieUsername);

        // Re-run the main logic with fetched data
        initializeTier2(currentUserId, matchID, localWoobieUsername);
      })
      .catch(err => {
        console.error("Error fetching match data:", err);
        alert("Error loading session. Please try again.");
      });
    return;
  }

  initializeTier2(currentUserId, matchID, localWoobieUsername);
});

async function initializeTier2(currentUserId, matchID, localWoobieUsername) {
  console.log(`[Tier2 INIT] MatchID: ${matchID}, UserID: ${currentUserId}, WoobieName: ${localWoobieUsername}`);

  // Fisher-Yates shuffle algorithm for true randomization
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Load or generate randomized questions for this match
  const tier2QuestionsRef = ref(db, `matches/${matchID}/tier2Questions`);
  const matchUsersRef = ref(db, `matches/${matchID}/users`);

  try {
    const questionsSnap = await get(tier2QuestionsRef);
    if (questionsSnap.exists()) {
      questions = questionsSnap.val();
      console.log("Loaded tier2 questions from database");
    } else {
      // Determine which user should generate questions (lexicographically first UID)
      const usersSnap = await get(matchUsersRef);
      const userUIDs = Object.keys(usersSnap.val() || {});
      const shouldGenerate = userUIDs.length > 0 && userUIDs.sort()[0] === currentUserId;

      if (shouldGenerate) {
        // This user is responsible for generating questions
        const shuffled = shuffleArray(questionBank);
        questions = shuffled.slice(0, 12);
        await set(tier2QuestionsRef, questions);
        console.log("Generated new randomized questions for tier2:", matchID);
      } else {
        // Wait for the other user to generate questions
        console.log("Waiting for partner to generate tier2 questions...");
        let attempts = 0;
        while (attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const retrySnap = await get(tier2QuestionsRef);
          if (retrySnap.exists()) {
            questions = retrySnap.val();
            console.log("Loaded tier2 questions after waiting");
            break;
          }
          attempts++;
        }
        if (questions.length === 0) {
          console.warn("Timeout waiting for questions, using fallback");
          questions = questionBank.slice(0, 12);
        }
      }
    }
  } catch (error) {
    console.error("Error loading tier2 questions:", error);
    questions = questionBank.slice(0, 12);
  }

  // Update user's current stage
  const userMatchProgressRef = ref(db, `users/${currentUserId}/currentMatch`);
  update(userMatchProgressRef, { stage: 'tier2' });

  // Database references using UID as keys
  const userAnswersRef = ref(db, `matches/${matchID}/tier2/${currentUserId}`);
  const allTier2AnswersRef = ref(db, `matches/${matchID}/tier2`);
  const tier2RewardsRef = ref(db, `matches/${matchID}/tier2Rewards`);
  const draftRef = ref(db, `matches/${matchID}/tier2Drafts/${currentUserId}`);

  // Check if user has already submitted answers
  try {
    const existingAnswersSnap = await get(userAnswersRef);
    if (existingAnswersSnap.exists()) {
      // User has already answered, redirect to send page
      console.log("[Tier2] User has already submitted answers, redirecting to send page");
      window.location.href = '/tier2/send.html';
      return;
    }
  } catch (err) {
    console.error("Error checking existing answers:", err);
  }

  // Load partial answers from database (survives logout and works cross-device)
  try {
    const draftSnap = await get(draftRef);
    if (draftSnap.exists()) {
      const draftData = draftSnap.val();
      answers = draftData.answers || [];
      currentIndex = draftData.currentIndex || 0;
      console.log('[Tier2] Loaded partial draft from database:', {
        answerCount: answers.length,
        currentIndex: currentIndex
      });
    } else {
      console.log('[Tier2] No draft found in database, starting fresh');
    }
  } catch (err) {
    console.error('Error loading tier2 draft from database:', err);
  }

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
    const draft = {
      answers: answers,
      currentIndex: currentIndex,
      lastSaved: Date.now()
    };
    // Save to database (survives logout and works cross-device)
    set(draftRef, draft)
      .then(() => {
        console.log('[Tier2] Saved draft to database:', {
          answerCount: answers.length,
          currentIndex: currentIndex
        });
      })
      .catch(err => {
        console.error('[Tier2] Error saving draft to database:', err);
      });
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

      // Clear the draft from database since it's now fully submitted
      await set(draftRef, null);
      console.log("Tier2 draft cleared from database");

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
}