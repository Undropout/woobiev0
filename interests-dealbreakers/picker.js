import { db } from '../shared/firebase-config.js';
import { ref, get, set } from 'firebase/database';

const interests = [
  "Books", "Gaming", "Music", "Art", "Nature", "Cooking",
  "Fitness", "Travel", "Animals", "Science", "Tech", "Movies"
];

const dealbreakers = [
  "Racism", "Homophobia", "Conspiracies", "Aggression",
  "Unreliability", "Boundary issues"
];

let selectedInterests = new Set();
let selectedDealbreakers = new Set();

const interestContainer = document.getElementById('interest-options');
const dealbreakerContainer = document.getElementById('dealbreaker-options');
const continueBtn = document.getElementById('continue-btn');
const message = document.getElementById('message');

// Render interests
interests.forEach(interest => {
  const btn = document.createElement('button');
  btn.textContent = interest;
  btn.className = 'woobie-button';
  btn.onclick = () => toggleSelect(btn, selectedInterests, 6);
  interestContainer.appendChild(btn);
});

// Render dealbreakers
dealbreakers.forEach(flag => {
  const btn = document.createElement('button');
  btn.textContent = flag;
  btn.className = 'woobie-button';
  btn.onclick = () => toggleSelect(btn, selectedDealbreakers, 3);
  dealbreakerContainer.appendChild(btn);
});

function toggleSelect(button, set, max) {
  const label = button.textContent;
  if (set.has(label)) {
    set.delete(label);
    button.classList.remove('selected');
  } else if (set.size < max) {
    set.add(label);
    button.classList.add('selected');
  }
}

continueBtn.onclick = async () => {
  if (selectedInterests.size < 3) {
    message.textContent = 'Please pick at least 3 interests.';
    return;
  }

  // Save answers
  localStorage.setItem('woobieInterests', JSON.stringify([...selectedInterests]));
  localStorage.setItem('woobieDealbreakers', JSON.stringify([...selectedDealbreakers]));

  // Get or create user ID
  let userID = localStorage.getItem('woobieUsername');
  if (!userID) {
    userID = prompt("Pick a short username (used only to label your answers):");
    if (!userID) return alert("Username is required.");
    localStorage.setItem('woobieUsername', userID);
  }

  // Get or create match ID
  let matchID = localStorage.getItem('woobieMatchID');
  if (!matchID) {
    matchID = prompt("Enter your match code (or make one up and share it):");
    if (!matchID) return alert("Match ID is required.");
    localStorage.setItem('woobieMatchID', matchID);
  }

  // Store presence for debugging/visibility
  const userMetaRef = ref(db, `matches/${matchID}/meta/${userID}`);
  await set(userMetaRef, {
    joinedAt: Date.now(),
    interests: [...selectedInterests],
    dealbreakers: [...selectedDealbreakers]
  });

  window.location.href = "/bio/index.html";
};
