// tier3.js
import { db } from '../shared/firebase-config.js';
import { ref, set, get } from 'firebase/database';

let matchID = localStorage.getItem('woobieMatchID');
let userID = localStorage.getItem('woobieUsername');

if (!matchID || !userID) {
  alert('Missing match ID or username.');
  throw new Error('Missing match ID or username');
}

const questions = [
  'What’s a belief you held strongly that changed over time?',
  'What’s one thing you never get tired of talking about?',
  'When have you felt the most brave?',
  'How do you handle emotional pain?',
  'What do you wish someone had told you earlier in life?',
  'What kind of people do you feel safest around?',
  'What’s something you’re currently working through internally?',
  'When do you feel most vulnerable, and why?',
  'What’s a memory that always brings you comfort?',
  'If your younger self met you now, what would they say?',
  'What’s a truth you’ve learned the hard way?',
  'What’s something you’ve forgiven yourself for?'
];

let answers = JSON.parse(localStorage.getItem('tier3Answers') || '[]');
let currentIndex = answers.length;

const questionBlock = document.getElementById('question-block');
const questionNumber = document.getElementById('question-number');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer');
const submitBtn = document.getElementById('submit-btn');
const completionMessage = document.getElementById('completion-message');
const reviewSection = document.getElementById('review-section');

function updateQuestion(index) {
  questionNumber.textContent = `Question ${index + 1} of ${questions.length}`;
  questionText.textContent = questions[index];
  answerInput.value = answers[index] || '';
}

function saveProgress() {
  localStorage.setItem('tier3Answers', JSON.stringify(answers));
}

async function submitAnswers() {
  const tier3Ref = ref(db, `matches/${matchID}/tier3/${userID}`);
  await set(tier3Ref, {
    answers,
    timestamp: Date.now()
  });
  checkIfBothFinished();
}

async function checkIfBothFinished() {
  const snapshot = await get(ref(db, `matches/${matchID}/tier3`));
  const entries = snapshot.val() || {};

  if (Object.keys(entries).length >= 2) {
    showReview(entries);
  } else {
    questionBlock.style.display = 'none';
    document.getElementById('waiting-message').style.display = 'block';
  }
}

function showReview(data) {
  const partnerID = Object.keys(data).find(id => id !== userID);
  const mine = data[userID].answers;
  const theirs = data[partnerID].answers;

  reviewSection.innerHTML = '<h2>Review Answers</h2>';
  questions.forEach((q, i) => {
    reviewSection.innerHTML += `
      <div class="qa-pair">
        <p><strong>Q${i + 1}:</strong> ${q}</p>
        <p><strong>You:</strong> ${mine[i] || ''}</p>
        <p><strong>Match:</strong> ${theirs[i] || ''}</p>
        <hr>
      </div>
    `;
  });

  reviewSection.innerHTML += `
    <button id="vote-yes" class="woobie-button">👍 Enter Chatroom</button>
    <button id="vote-no" class="woobie-button">👎 Not Ready</button>
  `;
  reviewSection.style.display = 'block';

  document.getElementById('vote-yes').onclick = () => submitVote(true);
  document.getElementById('vote-no').onclick = () => submitVote(false);
}

async function submitVote(value) {
  await set(ref(db, `matches/${matchID}/tier3Votes/${userID}`), value);
  waitForMutualVote();
}

async function waitForMutualVote() {
  const snapshot = await get(ref(db, `matches/${matchID}/tier3Votes`));
  const votes = snapshot.val() || {};

  if (Object.keys(votes).length >= 2) {
    const allYes = Object.values(votes).every(v => v === true);
    if (allYes) {
      window.location.href = '/chat/index.html';
    } else {
      reviewSection.innerHTML = '<h2>Unfortunately, your match wasn\'t ready to continue. 😔</h2>';
    }
  } else {
    reviewSection.innerHTML = '<h2>Waiting for your match to vote...</h2>';
    setTimeout(waitForMutualVote, 4000);
  }
}

// INIT
if (currentIndex >= questions.length) {
  submitAnswers();
} else {
  updateQuestion(currentIndex);

  submitBtn.onclick = () => {
    const input = answerInput.value.trim();
    if (!input) return;
    answers[currentIndex] = input;
    saveProgress();
    currentIndex++;

    if (currentIndex < questions.length) {
      updateQuestion(currentIndex);
    } else {
      questionBlock.style.display = 'none';
      completionMessage.style.display = 'block';
      submitAnswers();
    }
  };
}
