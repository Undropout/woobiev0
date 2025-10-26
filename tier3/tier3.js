// tier3.js
import { db, auth } from '../shared/firebase-config.js';
import { ref, set, get, onValue, off, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

// Emoji replacement function for woobiecore aesthetic
function replaceEmojiWithMonochrome(text) {
  return text.replace(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu, (match) => {
    return `<span class="woobie-emoji">${match}</span>`;
  });
}

const questionBank = [
  "What makes you feel close to someone?",
  "What does emotional intimacy look like to you?",
  "What's a friendship you're proud of?",
  "Who in your life do you wish you talked to more?",
  "How do you want to be remembered?",
  "What do you hope people say about you when you're not around?",
  "What does 'home' mean to you?",
  "When do you feel most loved?",
  "What's a romantic gesture you secretly love?",
  "What's your love language, and how do you express it?",
  "How do you know when you're falling for someone?",
  "Have you ever had a crush that changed how you see people?",
  "What's something you've learned from past relationships?",
  "Do you believe in soulmates?",
  "What does a healthy relationship look like to you?",
  "What's a photo you wish you had taken?",
  "Do you have any little rituals that bring you peace?",
  "If you could guarantee one thing for your future, what would it be?",
  "What's a compliment you've always wanted to receive?",
  "What's something you already find yourself appreciating about me?",
  "Finish this sentence: 'I wish I had someone with whom I could share...'",
  "Share an embarrassing or awkward moment in your life that you'd feel comfortable sharing with a friend.",
  "When did you last cry—alone or with someone else—and how do you feel about sharing it?",
  "If your home were on fire, and your loved ones and pets were safe, what's one thing you'd try to save, and why?",
  "Is there anything you consider too serious to joke about?",
  "If you couldn't communicate with anyone ever again, what's one thing you'd deeply regret never having said?",
  "Based on our conversation so far, what's something you like or appreciate about me? (Be honest!)",
  "Complete this sentence three times: 'We both seem to be...'",
  "If we became close friends, what's something important you'd want me to understand about you?",
  "What's one thing you'd genuinely enjoy doing together if we were friends?",
  "What's a quality you admire about how we've interacted with each other so far?",
  "Share a personal problem you feel comfortable asking me advice about—and tell me how you'd like me to respond (advice, reflection, support?).",
  "What's a belief you held strongly that changed over time?",
  "What's one thing you never get tired of talking about?",
  "When have you felt the most brave?",
  "How do you handle emotional pain?",
  "What do you wish someone had told you earlier in life?",
  "What kind of people do you feel safest around?",
  "What's something you're currently working through internally?",
  "When do you feel most vulnerable, and why?",
  "What's a memory that always brings you comfort?",
  "If your younger self met you now, what would they say?",
  "What's a truth you've learned the hard way?",
  "What's something you've forgiven yourself for?"
];

let questions = [];

// Wait for authentication before initializing
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to participate. Redirecting to login.");
    window.location.href = '/auth/login.html';
    return;
  }

  const currentUserId = user.uid;
  let matchID = localStorage.getItem('woobieMatchID');
  let username = localStorage.getItem('woobieUsername');

  // Fallback to database if localStorage is empty
  if (!matchID || !username) {
    const { update } = await import('firebase/database');
    const snap = await get(ref(db, `users/${currentUserId}/currentMatch`));
    const matchData = snap.val();
    if (!matchData || !matchData.matchID || !matchData.username) {
      alert("No match found. Please restart.");
      window.location.href = '/name-picker/index.html';
      return;
    }
    matchID = matchData.matchID;
    username = matchData.username;
    localStorage.setItem('woobieMatchID', matchID);
    localStorage.setItem('woobieUsername', username);
  }

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
  const tier3QuestionsRef = ref(db, `matches/${matchID}/tier3Questions`);
  const matchUsersRef = ref(db, `matches/${matchID}/users`);

  try {
    const questionsSnap = await get(tier3QuestionsRef);
    if (questionsSnap.exists()) {
      questions = questionsSnap.val();
      console.log("Loaded tier3 questions from database");
    } else {
      // Determine which user should generate questions (lexicographically first UID)
      const usersSnap = await get(matchUsersRef);
      const userUIDs = Object.keys(usersSnap.val() || {});
      const shouldGenerate = userUIDs.length > 0 && userUIDs.sort()[0] === currentUserId;

      if (shouldGenerate) {
        // This user is responsible for generating questions
        const shuffled = shuffleArray(questionBank);
        questions = shuffled.slice(0, 12);
        await set(tier3QuestionsRef, questions);
        console.log("Generated new randomized questions for tier3:", matchID);
      } else {
        // Wait for the other user to generate questions
        console.log("Waiting for partner to generate tier3 questions...");
        let attempts = 0;
        while (attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const retrySnap = await get(tier3QuestionsRef);
          if (retrySnap.exists()) {
            questions = retrySnap.val();
            console.log("Loaded tier3 questions after waiting");
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
    console.error("Error loading tier3 questions:", error);
    questions = questionBank.slice(0, 12);
  }

  // Use UID for database references
  const answersRef = ref(db, `matches/${matchID}/tier3/${currentUserId}`);
  const allAnswersRef = ref(db, `matches/${matchID}/tier3`);
  const voteRef = ref(db, `matches/${matchID}/tier3Votes/${currentUserId}`);
  const allVotesRef = ref(db, `matches/${matchID}/tier3Votes`);
  const draftRef = ref(db, `matches/${matchID}/tier3Drafts/${currentUserId}`);

  // Get DOM elements at the top so they're available in all code paths
  const questionBlock = document.getElementById('question-block');
  const completionMessage = document.getElementById('completion-message');
  const reviewSection = document.getElementById('review-section');
  const voteSection = document.getElementById('vote-section');
  const voteYesBtn = document.getElementById('vote-yes');
  const voteNoBtn = document.getElementById('vote-no');
  const voteWaiting = document.getElementById('vote-waiting');

  // Attach vote handlers at the top so they work in all code paths (including resume)
  function waitForVotes() {
    voteYesBtn.style.display = 'none';
    voteNoBtn.style.display = 'none';
    voteWaiting.style.display = 'block';

    onValue(allVotesRef, snap => {
      const votes = snap.val();
      if (!votes || Object.keys(votes).length < 2) return;

      const bothYes = Object.values(votes).every(v => v === true);
      off(allVotesRef);

      // Update BOTH stage locations before redirecting
      const userMatchProgressRef = ref(db, `users/${currentUserId}/currentMatch`);
      const userRef = ref(db, `users/${currentUserId}`);

      if (bothYes) {
        // Update both currentMatch/stage and top-level stage
        Promise.all([
          update(userMatchProgressRef, { stage: 'chatroom' }),
          update(userRef, { stage: 'chatroom' })
        ]).then(() => {
          window.location.href = '/chat/index.html';
        });
      } else {
        Promise.all([
          update(userMatchProgressRef, { stage: 'goodbye-tier3' }),
          update(userRef, { stage: 'goodbye-tier3' })
        ]).then(() => {
          window.location.href = '/goodbye.html';
        });
      }
    });
  }

  voteYesBtn.onclick = () => {
    set(voteRef, true).then(waitForVotes);
  };

  voteNoBtn.onclick = () => {
    const confirmEnd = prompt("If you're sure you want to end the match, type 'Goodbye' and press OK.");
    if (confirmEnd?.trim().toLowerCase() === "goodbye") {
      set(voteRef, false).then(waitForVotes);
    }
  };

  // Declare answer tracking variables at the top so they're available in all code paths
  let answers = [];
  let index = 0;

  // Check if user has already submitted answers
  const existingAnswersSnap = await get(answersRef);
  if (existingAnswersSnap.exists()) {
    // User has already answered, skip to review/vote
    console.log("[Tier3] User has already submitted answers, checking for partner");
    questionBlock.style.display = 'none';
    completionMessage.style.display = 'block';

    // Check if both users have answered
    const allAnswersSnap = await get(allAnswersRef);
    const allData = allAnswersSnap.val();
    if (allData && Object.keys(allData).length >= 2) {
      completionMessage.style.display = 'none';
      showReview(allData);

      // Check if user has already voted
      const existingVoteSnap = await get(voteRef);
      if (existingVoteSnap.exists()) {
        console.log("[Tier3] User has already voted, showing waiting message");
        waitForVotes();
      }
    } else {
      waitForPartner();
    }
    return;
  }

  // Load partial answers from database
  const draftSnap = await get(draftRef);
  if (draftSnap.exists()) {
    const draftData = draftSnap.val();
    answers = draftData.answers || [];
    index = draftData.currentIndex || 0;
    console.log('[Tier3] Loaded partial draft from database:', {
      answerCount: answers.length,
      currentIndex: index
    });
  } else {
    console.log('[Tier3] No draft found in database, starting fresh');
  }

  // Inject fallback waiting message if needed
  let waitingMsg = document.getElementById('waiting-message');
  if (!waitingMsg) {
    waitingMsg = document.createElement('div');
    waitingMsg.id = 'waiting-message';
    waitingMsg.innerHTML = '<p>Waiting for your match to finish answering...</p>';
    waitingMsg.style.color = '#33ff33';
    waitingMsg.style.textAlign = 'center';
    waitingMsg.style.marginTop = '2rem';
    waitingMsg.style.display = 'none';
    questionBlock.parentNode.appendChild(waitingMsg);
  }

  function saveProgress() {
    const draft = {
      answers: answers,
      currentIndex: index,
      lastSaved: Date.now()
    };
    set(draftRef, draft)
      .then(() => {
        console.log('[Tier3] Saved draft to database:', {
          answerCount: answers.length,
          currentIndex: index
        });
      })
      .catch(err => {
        console.error('[Tier3] Error saving draft to database:', err);
      });
  }

  function showQuestion() {
    if (index >= questions.length) {
      questionBlock.style.display = 'none';
      completionMessage.style.display = 'block';
      submitAnswers();
      return;
    }

    document.getElementById('question-number').textContent = `Question ${index + 1} of ${questions.length}`;
    document.getElementById('question-text').textContent = questions[index];
    document.getElementById('answer').value = answers[index] || '';
  }

  document.getElementById('submit-btn').onclick = () => {
    const val = document.getElementById('answer').value.trim();
    if (!val) return;
    answers[index] = val;
    saveProgress();
    index++;
    showQuestion();
  };

  async function submitAnswers() {
    // Include username for display purposes but use UID for database key
    await set(answersRef, {
      answers,
      timestamp: Date.now(),
      woobieName: username
    });

    // Clear the draft from database since it's now fully submitted
    await set(draftRef, null);
    console.log("Tier3 draft cleared from database");

    onValue(allAnswersRef, snap => {
      const all = snap.val();
      if (all && Object.keys(all).length >= 2) {
        completionMessage.style.display = 'none';
        waitingMsg.style.display = 'none';
        renderReview(all);
      } else {
        questionBlock.style.display = 'none';
        completionMessage.style.display = 'none';
        waitingMsg.style.display = 'block';
      }
    });
  }

  function showReview(allData) {
    renderReview(allData);
  }

  function waitForPartner() {
    questionBlock.style.display = 'none';
    completionMessage.style.display = 'block';

    onValue(allAnswersRef, snap => {
      const all = snap.val();
      if (all && Object.keys(all).length >= 2) {
        completionMessage.style.display = 'none';
        off(allAnswersRef);
        renderReview(all);
      }
    });
  }

  function renderReview(all) {
    // Find partner by UID (not username)
    const partnerUID = Object.keys(all).find(uid => uid !== currentUserId);
    if (!partnerUID) return;

    // Get user's answers from database if not in memory
    const myAnswers = answers.length > 0 ? answers : (all[currentUserId]?.answers || []);

    let html = '<h3>📘 Tier 3 Answers</h3>';
    questions.forEach((q, i) => {
      html += `
        <details><summary><strong>${q}</strong></summary>
        <p><strong>You:</strong> ${myAnswers[i] || ''}</p>
        <p><strong>Your Match:</strong> ${all[partnerUID].answers[i] || ''}</p>
        </details>`;
    });

    // Apply emoji replacement to the dynamically generated content
    reviewSection.innerHTML = replaceEmojiWithMonochrome(html);
    reviewSection.style.display = 'block';
    voteSection.style.display = 'block';
  }

  // Start the question flow
  showQuestion();
});