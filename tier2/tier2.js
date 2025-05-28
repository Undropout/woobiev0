// tier2.js
import { db } from '../shared/firebase-config.js';
import { ref, set, get, onValue } from 'firebase/database';

let username = localStorage.getItem('woobieUsername');
let matchID = localStorage.getItem('woobieMatchID');
let answers = [];

const questions = [
  'What’s a moment in your life that changed the way you see the world?',
  'How do you show someone you care about them?',
  'What’s something people often misunderstand about you?',
  'When do you feel most like yourself?',
  'What’s one thing you wish more people asked you about?',
  'What makes you feel seen or understood?',
  'What’s a belief you held strongly that changed over time?',
  'What’s one thing you never get tired of talking about?',
  'When have you felt the most brave?',
  'What do you wish someone had told you earlier in life?',
  'What kind of people do you feel safest around?',
  'What’s something you’ve forgiven yourself for?'
];

function updateQuestion(index) {
  document.getElementById('question-number').textContent = `Question ${index + 1} of ${questions.length}`;
  document.getElementById('question-text').textContent = questions[index];
  document.getElementById('answer').value = answers[index] || '';
}

function saveProgress() {
  localStorage.setItem('tier2Answers', JSON.stringify(answers));
}

async function submitAnswers() {
  const answerRef = ref(db, `matches/${matchID}/tier2/${username}`);
  await set(answerRef, { answers, timestamp: Date.now() });
  checkIfBothFinished();
}

function checkIfBothFinished() {
  const allAnswersRef = ref(db, `matches/${matchID}/tier2`);
  onValue(allAnswersRef, snapshot => {
    const all = snapshot.val() || {};
    if (Object.keys(all).length >= 2) {
      window.location.href = '/tier2/send.html';
    } else {
      document.getElementById('question-block').style.display = 'none';
      document.getElementById('completion-message').style.display = 'block';
    }
  });
}

const stored = JSON.parse(localStorage.getItem('tier2Answers') || '[]');
answers = stored;
let idx = answers.length || 0;

if (idx >= questions.length) {
  submitAnswers();
} else {
  updateQuestion(idx);

  document.getElementById('submit-btn').onclick = () => {
    const input = document.getElementById('answer').value.trim();
    if (!input) return;
    answers[idx] = input;
    saveProgress();
    idx++;

    if (idx < questions.length) {
      updateQuestion(idx);
    } else {
      document.getElementById('question-block').style.display = 'none';
      document.getElementById('completion-message').style.display = 'block';
      submitAnswers();
    }
  };
}

// Watch for both rewards being submitted and redirect to reveal.html if so
const rewardRef = ref(db, `matches/${matchID}/tier2Rewards`);
onValue(rewardRef, snap => {
  const rewards = snap.val();
  if (rewards && Object.keys(rewards).length >= 2) {
    window.location.href = '/tier2/reveal.html';
  }
});
