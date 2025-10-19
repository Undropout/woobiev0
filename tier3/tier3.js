// tier3.js
import { db, auth } from '../shared/firebase-config.js';
import { ref, set, get, onValue, off } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

// Emoji replacement function for woobiecore aesthetic
function replaceEmojiWithMonochrome(text) {
  return text.replace(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu, (match) => {
    return `<span class="woobie-emoji">${match}</span>`;
  });
}

const questions = [
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

// Wait for authentication before initializing
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to participate. Redirecting to login.");
    window.location.href = '/auth/login.html';
    return;
  }

  const currentUserId = user.uid;
  const matchID = localStorage.getItem('woobieMatchID');
  const username = localStorage.getItem('woobieUsername');

  if (!matchID) {
    alert("Missing Match ID. Please restart.");
    window.location.href = '/name-picker/index.html';
    return;
  }

  // Use UID for database references
  const answersRef = ref(db, `matches/${matchID}/tier3/${currentUserId}`);
  const allAnswersRef = ref(db, `matches/${matchID}/tier3`);
  const voteRef = ref(db, `matches/${matchID}/tier3Votes/${currentUserId}`);
  const allVotesRef = ref(db, `matches/${matchID}/tier3Votes`);

  let answers = JSON.parse(localStorage.getItem('tier3Answers') || '[]');
  let index = answers.length;

  const questionBlock = document.getElementById('question-block');
  const completionMessage = document.getElementById('completion-message');
  const reviewSection = document.getElementById('review-section');
  const voteSection = document.getElementById('vote-section');
  const voteYesBtn = document.getElementById('vote-yes');
  const voteNoBtn = document.getElementById('vote-no');
  const voteWaiting = document.getElementById('vote-waiting');

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
    localStorage.setItem('tier3Answers', JSON.stringify(answers));
    index++;
    showQuestion();
  };

  function submitAnswers() {
    // Include username for display purposes but use UID for database key
    set(answersRef, { 
      answers, 
      timestamp: Date.now(),
      woobieName: username 
    });
    
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

  function renderReview(all) {
    // Find partner by UID (not username)
    const partnerUID = Object.keys(all).find(uid => uid !== currentUserId);
    if (!partnerUID) return;

    let html = '<h3>📘 Tier 3 Answers</h3>';
    questions.forEach((q, i) => {
      html += `
        <details><summary><strong>${q}</strong></summary>
        <p><strong>You:</strong> ${answers[i] || ''}</p>
        <p><strong>Your Match:</strong> ${all[partnerUID].answers[i] || ''}</p>
        </details>`;
    });

    // Apply emoji replacement to the dynamically generated content
    reviewSection.innerHTML = replaceEmojiWithMonochrome(html);
    reviewSection.style.display = 'block';
    voteSection.style.display = 'block';
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

  function waitForVotes() {
    voteYesBtn.style.display = 'none';
    voteNoBtn.style.display = 'none';
    voteWaiting.style.display = 'block';

    onValue(allVotesRef, snap => {
      const votes = snap.val();
      if (!votes || Object.keys(votes).length < 2) return;

      const bothYes = Object.values(votes).every(v => v === true);
      off(allVotesRef);
      window.location.href = bothYes ? '/chat/index.html' : '/goodbye.html';
    });
  }

  // Start the question flow
  showQuestion();
});