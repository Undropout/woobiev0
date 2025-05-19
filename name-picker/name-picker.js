// name-generator.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBuSQkpBwmggXK38mzmUxiClweWiKxD5bI",
  authDomain: "woobiedinobear.firebaseapp.com",
  databaseURL: "https://woobiedinobear-default-rtdb.firebaseio.com",
  projectId: "woobiedinobear",
  storageBucket: "woobiedinobear.appspot.com",
  messagingSenderId: "642703845433",
  appId: "1:642703845433:web:56be57a1da63e1ecbd85e8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- IMPORT YOUR FULL ARRAYS HERE ---
import {
  baseAdjectives,
  prismaticAdjectives,
  neonAdjectives,
  cosmicAdjectives,
  baseColors,
  baseColorHex,
  prismaticColors,
  prismaticColorHex,
  prismaticEmojis,
  neonColors,
  neonColorHex,
  cosmicColors,
  cosmicColorHex,
  baseAnimals,
  baseAnimalEmojis,
  mythicalAnimals,
  mythicalAnimalEmojis,
  cosmicPrefixes,
  cosmicPrefixEmojis
} from './name-parts.js';

const modeButtons = document.querySelectorAll('[data-mode]');
const nameOptions = document.getElementById('name-options');
const selectedNameP = document.getElementById('selected-name');
let currentMode = 'normal';
let currentNames = [];
let selected = null;

function invertColor(hex) {
  return '#' + (0xFFFFFF ^ parseInt(hex.substring(1), 16)).toString(16).padStart(6, '0');
}

function getRandomNameSet() {
  let adjectives, colors, colorHex, animals, emojis, extraEmojis;

  switch (currentMode) {
    case 'prismatic':
      adjectives = [...baseAdjectives, ...prismaticAdjectives];
      colors = prismaticColors;
      colorHex = prismaticColorHex;
      animals = [...baseAnimals, ...mythicalAnimals];
      emojis = [...baseAnimalEmojis, ...mythicalAnimalEmojis];
      extraEmojis = prismaticEmojis;
      break;
    case 'neon':
      adjectives = [...baseAdjectives, ...neonAdjectives];
      colors = [...baseColors, ...neonColors];
      colorHex = [...baseColorHex, ...neonColorHex];
      animals = [...baseAnimals, ...mythicalAnimals];
      emojis = [...baseAnimalEmojis, ...mythicalAnimalEmojis];
      break;
    case 'cosmic':
      adjectives = [...baseAdjectives, ...cosmicAdjectives];
      colors = [...baseColors, ...cosmicColors];
      colorHex = [...baseColorHex, ...cosmicColorHex];
      animals = baseAnimals.map(a => `${cosmicPrefixes[Math.floor(Math.random() * cosmicPrefixes.length)]}${a}`);
      emojis = baseAnimalEmojis.map(e => `${cosmicPrefixEmojis[Math.floor(Math.random() * cosmicPrefixEmojis.length)]}${e}`);
      break;
    default:
      adjectives = baseAdjectives;
      colors = baseColors;
      colorHex = baseColorHex;
      animals = baseAnimals;
      emojis = baseAnimalEmojis;
  }

  return { adjectives, colors, colorHex, animals, emojis, extraEmojis };
}

function generateNames() {
  nameOptions.innerHTML = '';
  currentNames = [];
  const { adjectives, colors, colorHex, animals, emojis, extraEmojis } = getRandomNameSet();

  while (currentNames.length < 3) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const colIndex = Math.floor(Math.random() * colors.length);
    const col = colors[colIndex];
    const aniIndex = Math.floor(Math.random() * animals.length);
    const ani = animals[aniIndex];
    const emoji = emojis[aniIndex];
    const extra = extraEmojis ? extraEmojis[colIndex] : '';

    const label = `${adj} ${col} ${ani} ${extra}${emoji}`;
    if (!currentNames.find(n => n.label === label)) {
      currentNames.push({ label, emoji });
      const btn = document.createElement('button');
      btn.className = `woobie-button woobie-${currentMode}`;
      btn.innerHTML = `<strong>${label}</strong>`;
      btn.onclick = () => {
        selected = { label, emoji };
        selectedNameP.innerHTML = `You picked: <strong>${label}</strong>`;
        selectedNameP.className = `woobie-${currentMode}`;
        document.querySelectorAll('#name-options .woobie-button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      nameOptions.appendChild(btn);
    }
  }
}

modeButtons.forEach(btn => {
  btn.onclick = () => {
    currentMode = btn.dataset.mode;
    document.body.className = `${currentMode}-mode`;
    selectedNameP.className = '';
    generateNames();
  };
});

document.getElementById('reroll').onclick = generateNames;

document.getElementById('confirm').onclick = async () => {
  if (!selected) {
    alert("Please pick a name.");
    return;
  }

  const username = selected.label;
  const emoji = selected.emoji;

  localStorage.setItem('woobieUsername', username);
  localStorage.setItem('woobieEmoji', emoji);
  localStorage.setItem('woobieMode', currentMode);

  const queueRef = ref(db, 'queue');
  const queueSnap = await get(queueRef);

  let matchID = `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (!queueSnap.exists()) {
    await set(queueRef, { userA: username, matchID });
    await set(ref(db, `matches/${matchID}/users`), [username]);
    localStorage.setItem('woobieMatchID', matchID);
    window.location.href = '/interests-dealbreakers/index.html';
  } else {
    const data = queueSnap.val();
    const partner = data.userA;
    matchID = data.matchID;

    await set(ref(db, `matches/${matchID}/users`), [partner, username]);
    await set(queueRef, null);
    localStorage.setItem('woobieMatchID', matchID);
    window.location.href = '/interests-dealbreakers/index.html';
  }
};

generateNames();
