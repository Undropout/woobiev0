// tier1b.js
import { db, auth } from '../shared/firebase-config.js';
import { ref, set, onValue, get, update, off } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

// Emoji replacement function for woobiecore aesthetic
function replaceEmojiWithMonochrome(text) {
  return text.replace(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu, (match) => {
    return `<span class="woobie-emoji">${match}</span>`;
  });
}

// Question bank for Tier 1 (same as tier1a - we'll use questions 6-11)
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

let localAnswersDraft = [];
let currentIndex = 0;

const questionBlock = document.getElementById('question-block');
const questionNumber = document.getElementById('question-number');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer');
const submitBtn = document.getElementById('submit-btn');
const completionMessage = document.getElementById('completion-message');

const reviewDiv = document.getElementById('tier1b-review');
if (reviewDiv.parentElement && document.getElementById('tier1b-review-wrapper')) {
    document.getElementById('tier1b-review-wrapper').remove();
}
const reviewWrapper = document.createElement('div');
reviewWrapper.id = 'tier1b-review-wrapper';
reviewDiv.appendChild(reviewWrapper);

// Main logic wrapped in onAuthStateChanged
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("You must be logged in to continue. Redirecting to login...");
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
        initializeTier1b(currentUserId, matchID, localWoobieUsername);
      })
      .catch(err => {
        console.error("Error fetching match data:", err);
        alert("Error loading session. Please try again.");
      });
    return;
  }

  initializeTier1b(currentUserId, matchID, localWoobieUsername);
});

async function initializeTier1b(currentUserId, matchID, localWoobieUsername) {
  console.log(`[Tier1b INIT] MatchID: ${matchID}, UserID: ${currentUserId}, WoobieName: ${localWoobieUsername}`);

  // Load questions from tier1Questions (questions 6-11 for tier1b)
  const tier1QuestionsRef = ref(db, `matches/${matchID}/tier1Questions`);
  try {
    const questionsSnap = await get(tier1QuestionsRef);
    if (questionsSnap.exists()) {
      const allTier1Questions = questionsSnap.val();
      questions = allTier1Questions.slice(6, 12);
      console.log("Loaded tier1b questions from database");
    } else {
      console.warn("No tier1 questions found, using fallback");
      questions = questionBank.slice(6, 12);
    }
  } catch (error) {
    console.error("Error loading tier1b questions:", error);
    questions = questionBank.slice(6, 12);
  }

  const userMatchProgressRef = ref(db, `users/${currentUserId}/currentMatch`);
  update(userMatchProgressRef, { stage: 'tier1b' });

  set(ref(db, `matches/${matchID}/meta/${currentUserId}`), {
    stage: "tier1b",
    joinedAt: Date.now(),
    woobieName: localWoobieUsername
  });

  const userAnswersRef = ref(db, `matches/${matchID}/tier1b/${currentUserId}`);
  const allTier1bAnswersRef = ref(db, `matches/${matchID}/tier1b`);
  const userLetterRef = ref(db, `matches/${matchID}/tier1bLetters/${currentUserId}`);
  const allTier1bLettersRef = ref(db, `matches/${matchID}/tier1bLetters`);
  const userVoteRef = ref(db, `matches/${matchID}/tier1bVotes/${currentUserId}`);
  const allTier1bVotesRef = ref(db, `matches/${matchID}/tier1bVotes`);

  // Declare listener variables at the top so they're available in all code paths
  let allAnswersListener = null;
  let allLettersListener = null;
  let allVotesListener = null;

  function cleanupListeners() {
    if (allAnswersListener) off(allTier1bAnswersRef, 'value', allAnswersListener);
    if (allLettersListener) off(allTier1bLettersRef, 'value', allLettersListener);
    if (allVotesListener) off(allTier1bVotesRef, 'value', allVotesListener);
  }
  window.addEventListener('beforeunload', cleanupListeners);

  // Check if user has already submitted answers
  try {
    const existingAnswersSnap = await get(userAnswersRef);
    if (existingAnswersSnap.exists()) {
      // User has already answered, skip questions and go to review/waiting
      console.log("[Tier1b] User has already submitted answers, skipping to review");
      if (questionBlock) questionBlock.style.display = 'none';
      if (completionMessage) completionMessage.style.display = 'block';

      // Check if BOTH users have answered already
      const allAnswersSnap = await get(allTier1bAnswersRef);
      const allAnswersData = allAnswersSnap.val();

      if (allAnswersData && Object.keys(allAnswersData).length >= 2) {
        // Both users already answered, go directly to review
        const partnerUID = Object.keys(allAnswersData).find(uidKey => uidKey !== currentUserId);
        if (partnerUID && allAnswersData[currentUserId] && allAnswersData[partnerUID]) {
          console.log("[Tier1b] Both answers exist, showing review immediately");
          completionMessage.style.display = 'none';
          showReviewUI(allAnswersData[currentUserId], allAnswersData[partnerUID]);
        } else {
          // Wait for partner to finish
          waitForBothAnswers();
        }
      } else {
        // Wait for partner to finish
        waitForBothAnswers();
      }

      return; // Don't run the rest of the initialization
    }
  } catch (err) {
    console.error("Error checking existing answers:", err);
  }

  // Load partial answers from database (survives logout and works cross-device)
  const draftRef = ref(db, `matches/${matchID}/tier1bDrafts/${currentUserId}`);
  try {
    const draftSnap = await get(draftRef);
    if (draftSnap.exists()) {
      const draftData = draftSnap.val();
      localAnswersDraft = draftData.answers || [];
      currentIndex = draftData.currentIndex || 0;
      console.log('[Tier1b] Loaded partial draft from database:', {
        answerCount: localAnswersDraft.length,
        currentIndex: currentIndex
      });
    } else {
      console.log('[Tier1b] No draft found in database, starting fresh');
    }
  } catch (err) {
    console.error('Error loading tier1b draft from database:', err);
  }

  function saveProgress() {
    const draft = {
      answers: localAnswersDraft,
      currentIndex: currentIndex,
      lastSaved: Date.now()
    };
    // Save to database (survives logout and works cross-device)
    set(draftRef, draft)
      .then(() => {
        console.log('[Tier1b] Saved draft to database:', {
          answerCount: localAnswersDraft.length,
          currentIndex: currentIndex
        });
      })
      .catch(err => {
        console.error('[Tier1b] Error saving draft to database:', err);
      });
  }

  function showQuestion() {
    if (currentIndex >= questions.length) {
      if (questionBlock) questionBlock.style.display = 'none';
      if (completionMessage) completionMessage.style.display = 'block';
      set(userAnswersRef, { answers: localAnswersDraft, woobieName: localWoobieUsername })
        .then(() => {
          console.log("Tier1b answers submitted for user:", currentUserId);
          // Clear the draft from database since it's now fully submitted
          return set(draftRef, null);
        })
        .then(() => {
          console.log("Tier1b draft cleared from database");
        })
        .catch(err => console.error("Error saving tier1b answers:", err));
      waitForBothAnswers();
      return;
    }
    if (questionNumber) questionNumber.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
    if (questionText) questionText.textContent = questions[currentIndex];
    if (answerInput) answerInput.value = localAnswersDraft[currentIndex]?.value || '';
  }

  if (submitBtn) {
    submitBtn.onclick = () => {
      if (!answerInput) return;
      const val = answerInput.value.trim();
      if (!val) return;
      localAnswersDraft[currentIndex] = { question: questions[currentIndex], value: val, format: 'text' };
      currentIndex++;
      saveProgress(); // Save to localStorage after each answer
      showQuestion();
    };
  }

  function waitForBothAnswers() {
    console.log("[waitForBothAnswers] Setting listener on:", allTier1bAnswersRef.toString());
    if (allAnswersListener) off(allTier1bAnswersRef, 'value', allAnswersListener);

    allAnswersListener = onValue(allTier1bAnswersRef, async (snap) => {
      const allAnswersData = snap.val();
      console.log("[waitForBothAnswers] All answers data:", allAnswersData);
      if (!allAnswersData || Object.keys(allAnswersData).length < 2) {
        if (completionMessage) completionMessage.style.display = 'block';
        return;
      }

      const partnerUID = Object.keys(allAnswersData).find(uidKey => uidKey !== currentUserId);
      if (!partnerUID || !allAnswersData[currentUserId] || !allAnswersData[partnerUID]) {
        if (completionMessage) completionMessage.style.display = 'block';
        return;
      }
      if (completionMessage) completionMessage.style.display = 'none';
      await showReviewUI(allAnswersData[currentUserId], allAnswersData[partnerUID]);
      off(allTier1bAnswersRef, 'value', allAnswersListener);
      allAnswersListener = null;
    }, (error) => {
        console.error("Error in waitForBothAnswers listener:", error);
    });
  }

  // Helper function to attach vote button handlers
  function attachVoteHandlers() {
    console.log("[attachVoteHandlers] Attaching vote button click handlers");
    document.getElementById('vote-yes').onclick = () => {
      console.log("[vote-yes] Voted YES for user:", currentUserId);
      set(userVoteRef, true)
        .then(waitForMutualVote)
        .catch(err => console.error("Error voting yes:", err));
    };

    document.getElementById('vote-no').onclick = () => {
      console.log("[vote-no] Voted NO for user:", currentUserId);
      const confirmEnd = prompt("If you're sure you want to end the match, type 'Goodbye' to confirm.");
      if (confirmEnd?.trim().toLowerCase() === 'goodbye') {
        set(userVoteRef, false)
          .then(waitForMutualVote)
          .catch(err => console.error("Error voting no:", err));
      }
    };
  }

  async function showReviewUI(myData, partnerData) {
    console.log("[showReviewUI] Showing Q&A and letter UI");
    const myDisplayName = myData.woobieName || localWoobieUsername || "You";
    const partnerDisplayName = partnerData.woobieName || "Your Match";

    // Apply emoji replacement to the review header
    reviewWrapper.innerHTML = replaceEmojiWithMonochrome('<h2>📘 Review Answers</h2>');

    for (let i = 0; i < questions.length; i++) {
      reviewWrapper.innerHTML += `
        <details><summary><strong>${questions[i]}</strong></summary>
        <p><strong>${myDisplayName}:</strong> ${myData.answers[i]?.value || '<em>No answer</em>'}</p>
        <p><strong>${partnerDisplayName}:</strong> ${partnerData.answers[i]?.value || '<em>No answer</em>'}</p>
        </details>`;
    }

    // Check if user has already submitted a letter
    const existingLetterSnap = await get(userLetterRef);
    const letterAlreadySubmitted = existingLetterSnap.exists();

    console.log("[showReviewUI] Letter already submitted?", letterAlreadySubmitted);

    // Create the message section with emoji replacement
    const messageSection = `
      <h2>💌 Send a Message (Optional)</h2>
      <textarea id="letter-input" rows="6" placeholder="Max 250 words..."></textarea>
      <p id="letter-count">0 / 250 words</p>
      <p id="letter-message" style="color:#ff6666;"></p>
      <button id="submit-letter" class="woobie-button">Send →</button>
      <button id="skip-letter" class="woobie-button">Skip</button>
      <div id="letter-review" style="margin-top:2rem;"></div>
      <div id="vote-section" style="display:none;">
        <h2>Do you want to continue to Tier 2?</h2>
        <button id="vote-yes" class="woobie-button">👍 Yes</button>
        <button id="vote-no" class="woobie-button">👎 No</button>
        <p id="vote-waiting" style="display:none;">Waiting for your match's vote...</p>
      </div>
    `;

    reviewWrapper.innerHTML += replaceEmojiWithMonochrome(messageSection);

    const letterInput = document.getElementById('letter-input');
    const letterCount = document.getElementById('letter-count');
    const letterMsg = document.getElementById('letter-message');
    const letterReviewDiv = document.getElementById('letter-review');
    const voteSectionDiv = document.getElementById('vote-section');

    // If letter was already submitted, skip the input UI and go to waiting/voting
    if (letterAlreadySubmitted) {
      console.log("[showReviewUI] Letter already submitted, skipping input UI");
      const submitLetterBtn = document.getElementById('submit-letter');
      const skipLetterBtn = document.getElementById('skip-letter');
      if (submitLetterBtn) submitLetterBtn.style.display = 'none';
      if (skipLetterBtn) skipLetterBtn.style.display = 'none';
      if (letterInput) letterInput.style.display = 'none';
      if (letterCount) letterCount.style.display = 'none';

      // Attach vote handlers before going to letter review
      attachVoteHandlers();

      // Go straight to waiting for both letters
      await waitForLetterReview(letterReviewDiv, voteSectionDiv, myDisplayName, partnerDisplayName);
      return;
    }

    if(letterInput) letterInput.oninput = () => {
      const words = letterInput.value.trim().split(/\s+/).filter(Boolean);
      if(letterCount) letterCount.textContent = `${words.length} / 250 words`;
    };

    document.getElementById('submit-letter').onclick = () => {
      if (!letterInput || !letterMsg) return;
      const text = letterInput.value.trim();
      const words = text.split(/\s+/).filter(Boolean);
      const repeated = /(.)\1{20,}/.test(text);
      if (words.length > 250 || repeated) {
        letterMsg.textContent = 'Please keep your message under 250 words and avoid excessive repeated characters.';
        return;
      }
      letterMsg.textContent = '';
      console.log("[submit-letter] Submitting letter:", text);
      set(userLetterRef, text)
        .then(() => {
          attachVoteHandlers();
          return waitForLetterReview(letterReviewDiv, voteSectionDiv, myData.woobieName, partnerData.woobieName);
        })
        .catch(err => console.error("Error submitting letter:", err));
    };

    document.getElementById('skip-letter').onclick = () => {
      console.log("[skip-letter] Skipping letter.");
      set(userLetterRef, '')
        .then(() => {
          attachVoteHandlers();
          return waitForLetterReview(letterReviewDiv, voteSectionDiv, myData.woobieName, partnerData.woobieName);
        })
        .catch(err => console.error("Error skipping letter:", err));
    };

    // Attach vote handlers for the initial flow (when letter hasn't been submitted yet)
    attachVoteHandlers();
  }

  async function waitForLetterReview(letterReviewElement, voteSectionElement, myDisplayName, partnerDisplayName) {
    console.log("[waitForLetterReview] Checking for both letters...");
    const submitLetterBtn = document.getElementById('submit-letter');
    const skipLetterBtn = document.getElementById('skip-letter');
    if (submitLetterBtn) submitLetterBtn.style.display = 'none';
    if (skipLetterBtn) skipLetterBtn.style.display = 'none';

    // First, check if both letters already exist
    try {
      const allLettersSnap = await get(allTier1bLettersRef);
      const allLettersData = allLettersSnap.val();
      console.log("[waitForLetterReview] Initial check - letters:", allLettersData);

      if (allLettersData && Object.keys(allLettersData).length >= 2) {
        const partnerUID = Object.keys(allLettersData).find(uidKey => uidKey !== currentUserId);
        if (partnerUID && allLettersData[partnerUID] !== undefined && allLettersData[currentUserId] !== undefined) {
          // Both letters exist, show them immediately
          console.log("[waitForLetterReview] Both letters already exist, showing review");
          const letterReviewHTML = `
            <h3>💌 Direct Messages</h3>
            <details open><summary>What ${myDisplayName} wrote</summary><p>${allLettersData[currentUserId] || '(You chose not to send a message.)'}</p></details>
            <details open><summary>What ${partnerDisplayName} wrote</summary><p>${allLettersData[partnerUID] || '(Your match chose not to send a message.)'}</p></details>
          `;

          letterReviewElement.innerHTML = replaceEmojiWithMonochrome(letterReviewHTML);
          voteSectionElement.style.display = 'block';
          return; // Don't set up listener
        }
      }
    } catch (err) {
      console.error("[waitForLetterReview] Error checking letters:", err);
    }

    // If we get here, both letters don't exist yet, so set up listener
    console.log("[waitForLetterReview] Waiting for partner's letter...");
    if (allLettersListener) off(allTier1bLettersRef, 'value', allLettersListener);

    allLettersListener = onValue(allTier1bLettersRef, (snap) => {
      const allLettersData = snap.val();
      console.log("[waitForLetterReview] Listener fired - letters:", allLettersData);
      if (!allLettersData || Object.keys(allLettersData).length < 2) return;

      const partnerUID = Object.keys(allLettersData).find(uidKey => uidKey !== currentUserId);
      if(!partnerUID || allLettersData[partnerUID] === undefined || allLettersData[currentUserId] === undefined) return;

      // Apply emoji replacement to the letter review section
      const letterReviewHTML = `
        <h3>💌 Direct Messages</h3>
        <details open><summary>What ${myDisplayName} wrote</summary><p>${allLettersData[currentUserId] || '(You chose not to send a message.)'}</p></details>
        <details open><summary>What ${partnerDisplayName} wrote</summary><p>${allLettersData[partnerUID] || '(Your match chose not to send a message.)'}</p></details>
      `;

      letterReviewElement.innerHTML = replaceEmojiWithMonochrome(letterReviewHTML);
      voteSectionElement.style.display = 'block';
      off(allTier1bLettersRef, 'value', allLettersListener);
      allLettersListener = null;
    }, (error) => {
        console.error("Error in waitForLetterReview listener:", error);
    });
  }

  function waitForMutualVote() {
    console.log("[waitForMutualVote] Waiting for both votes...");
    const voteYesBtn = document.getElementById('vote-yes');
    const voteNoBtn = document.getElementById('vote-no');
    const voteWaitingP = document.getElementById('vote-waiting');

    if(voteYesBtn) voteYesBtn.style.display = 'none';
    if(voteNoBtn) voteNoBtn.style.display = 'none';
    if(voteWaitingP) voteWaitingP.style.display = 'block';

    if (allVotesListener) off(allTier1bVotesRef, 'value', allVotesListener);
    
    allVotesListener = onValue(allTier1bVotesRef, (snap) => {
      const votesData = snap.val();
      console.log("[waitForMutualVote] votes:", votesData);
      if (!votesData || Object.keys(votesData).length < 2) return;

      cleanupListeners();

      const bothYes = Object.values(votesData).every(v => v === true);
      const userMatchProgressRefOnVote = ref(db, `users/${currentUserId}/currentMatch`);

      if (bothYes) {
        update(userMatchProgressRefOnVote, { stage: 'tier2' });
        window.location.href = '/tier2/index.html';
      } else {
        update(userMatchProgressRefOnVote, { stage: 'goodbye-tier1b' });
        window.location.href = '/goodbye.html';
      }
    }, (error) => {
        console.error("Error in waitForMutualVote listener:", error);
    });
  }

  showQuestion();
}