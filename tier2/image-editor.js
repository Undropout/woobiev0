// tier1b.js
import { db } from '../shared/firebase-config.js';
import { ref, set, onValue, get } from 'firebase/database';

let matchID = localStorage.getItem('woobieMatchID');
let myName = localStorage.getItem('woobieUsername');
let myBio = localStorage.getItem('woobieBio');

if (!matchID) {
  matchID = prompt("Missing match ID — please enter your match ID:");
  localStorage.setItem('woobieMatchID', matchID);
}

if (!myName) {
  myName = prompt("Missing username — please enter your username:");
  localStorage.setItem('woobieUsername', myName);
}

set(ref(db, `matches/${matchID}/meta/${myName}`), {
  stage: "tier1b",
  joinedAt: Date.now()
});

const answersRef = ref(db, `matches/${matchID}/tier1b/${myName}`);
const allAnswersRef = ref(db, `matches/${matchID}/tier1b`);
const letterRef = ref(db, `matches/${matchID}/tier1bLetters/${myName}`);
const allLettersRef = ref(db, `matches/${matchID}/tier1bLetters`);
const bioRef = ref(db, `matches/${matchID}/bios/${myName}`);
const allBiosRef = ref(db, `matches/${matchID}/bios`);
const voteRef = ref(db, `matches/${matchID}/tier1bVotes/${myName}`);
const allVotesRef = ref(db, `matches/${matchID}/tier1bVotes`);

const questions = [
  "What's something you're working on improving?",
  "How do you recharge after a stressful day?",
  "What's a non-negotiable value in your life?",
  "What do you want more of in your future?",
  "What makes you feel heard?",
  "What's a memory you'd share to explain who you are?"
];

let answers = [];
let currentIndex = 0;

const questionBlock = document.getElementById('question-block');
const questionNumber = document.getElementById('question-number');
const questionText = document.getElementById('question-text');
const answerInput = document.getElementById('answer');
const submitBtn = document.getElementById('submit-btn');
const completionMessage = document.getElementById('completion-message');
const messageBlock = document.getElementById('message-block');
const letterInput = document.getElementById('letter-input');
const letterCount = document.getElementById('letter-count');
const letterMsg = document.getElementById('letter-message');

function showQuestion() {
  if (currentIndex >= questions.length) {
    questionBlock.style.display = 'none';
    completionMessage.style.display = 'block';
    set(answersRef, answers);
    checkIfBothFinished();
    return;
  }

  questionNumber.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
  questionText.textContent = questions[currentIndex];
  answerInput.value = answers[currentIndex]?.value || '';
}

submitBtn.onclick = () => {
  const val = answerInput.value.trim();
  if (!val) return;
  answers[currentIndex] = { format: 'text', value: val };
  currentIndex++;
  showQuestion();
};

if (myBio) set(bioRef, myBio);

function checkIfBothFinished() {
  get(allAnswersRef).then(snap => {
    const all = snap.val();
    if (all && Object.keys(all).length >= 2) {
      completionMessage.style.display = 'none';
      messageBlock.style.display = 'block';
    }
  });
}

letterInput.oninput = () => {
  const words = letterInput.value.trim().split(/\s+/).filter(Boolean);
  letterCount.textContent = `${words.length} / 250 words`;
};

document.getElementById('submit-letter').onclick = () => {
  const text = letterInput.value.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const repeated = /(.)\1{20,}/.test(text);
  if (words.length > 250 || repeated) {
    letterMsg.textContent = 'Please keep your message under 250 words with no repeated spam characters.';
    return;
  }
  set(letterRef, text);
  set(voteRef, true);
  waitForMutualVote();
};

document.getElementById('skip-letter').onclick = () => {
  set(letterRef, '');
  set(voteRef, true);
  waitForMutualVote();
};

function waitForMutualVote() {
  onValue(allVotesRef, snap => {
    const votes = snap.val();
    if (!votes || Object.keys(votes).length < 2) return;
    if (Object.values(votes).every(v => v === true)) {
      window.location.href = '/tier2/index.html';
    } else {
      messageBlock.innerHTML = '<h2>Unfortunately, your match wasn\'t ready to continue. 😔</h2>';
    }
  });
}

showQuestion();
