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

const questions = [
  "What's something you're working on improving?",
  "How do you recharge after a stressful day?",
  "What's a non-negotiable value in your life?",
  "What do you want more of in your future?",
  "What makes you feel heard?",
  "What's a memory you'd share to explain who you are?"
];

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
  const matchID = localStorage.getItem('woobieMatchID');
  const localWoobieUsername = localStorage.getItem('woobieUsername');

  if (!matchID || !localWoobieUsername) {
    alert("Missing critical session data (Match ID or Woobie Name). Please restart.");
    window.location.href = '/name-picker/index.html';
    return;
  }

  console.log(`[Tier1b INIT] MatchID: ${matchID}, UserID: ${currentUserId}, WoobieName: ${localWoobieUsername}`);

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

  let allAnswersListener = null;
  let allLettersListener = null;
  let allVotesListener = null;

  function cleanupListeners() {
    if (allAnswersListener) off(allTier1bAnswersRef, 'value', allAnswersListener);
    if (allLettersListener) off(allTier1bLettersRef, 'value', allLettersListener);
    if (allVotesListener) off(allTier1bVotesRef, 'value', allVotesListener);
  }
  window.addEventListener('beforeunload', cleanupListeners);

  function showQuestion() {
    if (currentIndex >= questions.length) {
      if (questionBlock) questionBlock.style.display = 'none';
      if (completionMessage) completionMessage.style.display = 'block';
      set(userAnswersRef, { answers: localAnswersDraft, woobieName: localWoobieUsername })
        .then(() => {
          console.log("Tier1b answers submitted for user:", currentUserId);
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
      showQuestion();
    };
  }

  function waitForBothAnswers() {
    console.log("[waitForBothAnswers] Setting listener on:", allTier1bAnswersRef.toString());
    if (allAnswersListener) off(allTier1bAnswersRef, 'value', allAnswersListener);

    allAnswersListener = onValue(allTier1bAnswersRef, (snap) => {
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
      showReviewUI(allAnswersData[currentUserId], allAnswersData[partnerUID]);
      off(allTier1bAnswersRef, 'value', allAnswersListener);
      allAnswersListener = null;
    }, (error) => {
        console.error("Error in waitForBothAnswers listener:", error);
    });
  }

  function showReviewUI(myData, partnerData) {
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
        .then(() => waitForLetterReview(letterReviewDiv, voteSectionDiv, myData.woobieName, partnerData.woobieName))
        .catch(err => console.error("Error submitting letter:", err));
    };

    document.getElementById('skip-letter').onclick = () => {
      console.log("[skip-letter] Skipping letter.");
      set(userLetterRef, '')
        .then(() => waitForLetterReview(letterReviewDiv, voteSectionDiv, myData.woobieName, partnerData.woobieName))
        .catch(err => console.error("Error skipping letter:", err));
    };

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

  function waitForLetterReview(letterReviewElement, voteSectionElement, myDisplayName, partnerDisplayName) {
    console.log("[waitForLetterReview] Waiting for both letters...");
    const submitLetterBtn = document.getElementById('submit-letter');
    const skipLetterBtn = document.getElementById('skip-letter');
    if (submitLetterBtn) submitLetterBtn.style.display = 'none';
    if (skipLetterBtn) skipLetterBtn.style.display = 'none';
    
    if (allLettersListener) off(allTier1bLettersRef, 'value', allLettersListener);

    allLettersListener = onValue(allTier1bLettersRef, (snap) => {
      const allLettersData = snap.val();
      console.log("[waitForLetterReview] letters:", allLettersData);
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
});