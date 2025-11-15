// tier1a.js
import { db, auth } from '../shared/firebase-config.js';
import { ref, set, get, onValue, update, off } from 'firebase/database'; // Added get, update and off
import { onAuthStateChanged } from 'firebase/auth';

const username = localStorage.getItem('woobieUsername'); // Still used for display
const matchID = localStorage.getItem('woobieMatchID');

if (!username || !matchID) {
  alert("Missing username or match ID");
  window.location.href = '/auth/login.html';
}

// Question bank for Tier 1
const questionBank = [
  "If you could invite anyone in history to dinner, who would you choose and why?",
  "Would you ever want to be famous? If yes, what would you want to be known for?",
  "Do you rehearse conversations before you have them? Why or why not?",
  "Describe your 'perfect' day.",
  "When did you last sing to yourself or to someone else?",
  "If you could have one extraordinary skill or quality tomorrow, what would it be and why?",
  "What's a secret hunch you have about your future?",
  "What are you deeply grateful for right now?",
  "If you could change something about your upbringing, what would it be?",
  "Share a memory from your childhood that shaped who you are today.",
  "What's something important about you that people often misunderstand, that you'd like a future friend to know?",
  "If you could live to age 90, would you rather retain the mind or body of a 30-year-old for your final 60 years?",
  "If you could live in any fictional world, which would you choose and why?",
  "If you could instantly master a musical instrument, which would it be?",
  "If animals could talk, which one do you think you'd get along with best?",
  "What era in history do you feel oddly nostalgic for?",
  "What makes you feel seen?",
  "What's the most generous thing someone has done for you?",
  "How do you show someone you care?",
  "What's your go-to movie or show when you need a pick-me-up?",
  "Do you prefer sunrise or sunset?",
  "What do you do when you want to feel cozy?",
  "Do you believe people are inherently good?",
  "If happiness were a place, what would it look like?",
  "What do you think is humanity's greatest strength?",
  "What's your dream vacation destination, and what would you do there?",
  "What's your most chaotic or impulsive story?",
  "What's a strength of yours that others overlook?",
  "Do you forgive yourself easily?",
  "What kind of environments help you thrive?",
  "What helps you bounce back after a hard day?"
];

let questions = [];

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
      <details>
        <summary><strong>${questions[i]}</strong></summary>
        <p><strong>You:</strong> ${myAnswers[i]?.value || myAnswers[i] || '<em>No answer</em>'}</p>
        <p><strong>Match:</strong> ${theirAnswers[i]?.value || theirAnswers[i] || '<em>No answer</em>'}</p>
      </details>
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
  document.getElementById('vote-no').onclick = () => {
    const confirmEnd = prompt("If you're sure you want to end the match, type 'Goodbye' to confirm.");
    if (confirmEnd?.trim().toLowerCase() === 'goodbye') {
      handleVote(false, currentUserUID);
    }
  };
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
  let currentMatchID = localStorage.getItem('woobieMatchID');
  let localWoobieUsername = localStorage.getItem('woobieUsername');

  // Fallback to database if localStorage is empty
  if (!currentMatchID || !localWoobieUsername) {
    get(ref(db, `users/${currentUserId}/currentMatch`))
      .then(snap => {
        const matchData = snap.val();
        if (!matchData || !matchData.matchID || !matchData.username) {
          alert("No match found. Please restart.");
          window.location.href = '/name-picker/index.html';
          return;
        }
        currentMatchID = matchData.matchID;
        localWoobieUsername = matchData.username;
        localStorage.setItem('woobieMatchID', currentMatchID);
        localStorage.setItem('woobieUsername', localWoobieUsername);

        // Re-run the main logic with fetched data
        initializeTier1a(currentUserId, currentMatchID, localWoobieUsername);
      })
      .catch(err => {
        console.error("Error fetching match data:", err);
        alert("Error loading session. Please try again.");
      });
    return;
  }

  initializeTier1a(currentUserId, currentMatchID, localWoobieUsername);
});

async function initializeTier1a(currentUserId, currentMatchID, localWoobieUsername) {

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
  // We generate 12 questions total: first 6 for tier1a, next 6 for tier1b
  const tier1QuestionsRef = ref(db, `matches/${currentMatchID}/tier1Questions`);
  const matchUsersRef = ref(db, `matches/${currentMatchID}/users`);

  try {
    const questionsSnap = await get(tier1QuestionsRef);
    if (questionsSnap.exists()) {
      // Questions already exist for this match - use first 6 for tier1a
      const allTier1Questions = questionsSnap.val();
      questions = allTier1Questions.slice(0, 6);
      console.log("Loaded existing tier1 questions from database");
    } else {
      // Questions don't exist yet - this user should generate them
      // Always generate if questions don't exist (don't wait for partner)
      console.log("No questions found, generating new randomized questions");
      const shuffled = shuffleArray(questionBank);
      const allTier1Questions = shuffled.slice(0, 12);

      try {
        await set(tier1QuestionsRef, allTier1Questions);
        console.log("Successfully saved tier1 questions to database");
      } catch (setError) {
        console.warn("Failed to save questions to database:", setError);
        // Continue anyway - we still have the questions locally
      }

      questions = allTier1Questions.slice(0, 6);
      console.log("Generated new randomized questions for match:", currentMatchID);
    }
  } catch (error) {
    console.error("Error loading questions:", error);
    // Fallback to randomized questions if there's an error
    const shuffled = shuffleArray(questionBank);
    questions = shuffled.slice(0, 6);
    console.log("Using fallback randomized questions due to error");
  }

  // Final safety check - ensure we always have questions
  if (!questions || questions.length === 0) {
    console.error("CRITICAL: Questions array is empty! Using hardcoded fallback");
    questions = questionBank.slice(0, 6);
  }

  console.log(`[Tier1a] Initialized with ${questions.length} questions:`, questions.map((q, i) => `${i+1}. ${q.substring(0, 50)}...`));

  // Database references using UID as keys
  const userAnswersRef = ref(db, `matches/${currentMatchID}/tier1a/${currentUserId}`);
  const allTier1aAnswersRef = ref(db, `matches/${currentMatchID}/tier1a`);
  const allTier1aVotesRef = ref(db, `matches/${currentMatchID}/tier1aVotes`);
  const draftRef = ref(db, `matches/${currentMatchID}/tier1aDrafts/${currentUserId}`);

  // Check if user has already submitted answers
  try {
    const existingAnswersSnap = await get(userAnswersRef);
    if (existingAnswersSnap.exists()) {
      // User has already answered, hide question block and show completion/review
      questionBlock.style.display = 'none';
      completionMessage.style.display = 'block';

      // Set up listeners to show review when both users have answered
      onValue(allTier1aAnswersRef, snap => {
        const all = snap.val();
        if (all && Object.keys(all).length >= 2) {
          if (all[currentUserId]) {
            revealAnswers(all, currentUserId);
          }
        }
      });

      // Set up vote listener
      onValue(allTier1aVotesRef, snap => {
        const votes = snap.val();
        if (!votes) return;
        const values = Object.values(votes);
        if (values.length < 2) return;

        const bothYes = values.every(v => v === true);

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

      return; // Don't run the rest of the initialization
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
      console.log('[Tier1a] Loaded partial draft from database:', {
        answerCount: answers.length,
        currentIndex: currentIndex
      });
    } else {
      console.log('[Tier1a] No draft found in database, starting fresh');
    }
  } catch (err) {
    console.error('Error loading tier1a draft from database:', err);
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
        console.log('[Tier1a] Saved draft to database:', {
          answerCount: answers.length,
          currentIndex: currentIndex
        });
      })
      .catch(err => {
        console.error('[Tier1a] Error saving draft to database:', err);
      });
  }

  function showQuestion() {
    // Safety check - if no questions somehow, show error
    if (!questions || questions.length === 0) {
      console.error("CRITICAL: showQuestion called but questions array is empty!");
      if (questionBlock) questionBlock.style.display = 'none';
      if (completionMessage) {
        completionMessage.style.display = 'block';
        completionMessage.innerHTML = `
          <h2>Error Loading Questions</h2>
          <p>There was a problem loading the questions. Please refresh the page or contact support.</p>
          <button class="woobie-button" onclick="window.location.reload()">Refresh Page</button>
        `;
      }
      return;
    }

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
        // Clear the draft from database since it's now fully submitted
        return set(draftRef, null);
      })
      .then(() => {
        console.log("Tier1a draft cleared from database");
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
      saveProgress(); // Save to database after each answer
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
}