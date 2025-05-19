// tier1a.js
import { db } from '../shared/firebase-config.js';
import { ref, set, onValue } from 'firebase/database';

const questions = [
  "What’s something you're proud of recently?",
  "How would a friend describe you?",
  "What does comfort look like to you?",
  "When do you feel most alive?",
  "What’s a recent thought you can’t shake?",
  "How do you usually show someone you care?"
];

let answers = [];
let currentIndex = 0;

const userID = localStorage.getItem('woobieUsername');
const matchID = localStorage.getItem('woobieMatchID');
const answersRef = ref(db, `matches/${matchID}/tier1a/${userID}`);
const allAnswersRef = ref(db, `matches/${matchID}/tier1a`);

const qNum = document.getElementById('question-number');
const qText = document.getElementById('question-text');
const ansBox = document.getElementById('answer');
const submitBtn = document.getElementById('submit-btn');
const completeDiv = document.getElementById('completion-message');

function showQuestion() {
  if (currentIndex >= questions.length) {
    submitBtn.style.display = 'none';
    qNum.style.display = 'none';
    qText.style.display = 'none';
    ansBox.style.display = 'none';
    completeDiv.style.display = 'block';
    set(answersRef, answers);
    return;
  }
  qNum.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
  qText.textContent = questions[currentIndex];
  ansBox.value = answers[currentIndex]?.value || '';
}

submitBtn.onclick = () => {
  const val = ansBox.value.trim();
  if (!val) return;
  answers[currentIndex] = { format: 'text', value: val };
  currentIndex++;
  showQuestion();
};

onValue(allAnswersRef, snapshot => {
  const all = snapshot.val();
  if (all && Object.keys(all).length >= 2) {
    window.location.href = '../tier1a-review/index.html';
  }
});

showQuestion();
