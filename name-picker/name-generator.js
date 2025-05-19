// name-picker/name-generator.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';

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
  cosmicPrefixes,
  cosmicPrefixEmojis,
  baseAnimals,
  baseAnimalEmojis,
  mythicalAnimals,
  mythicalAnimalEmojis
} from './name-parts.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBuSQkpBwmggXK38mzmUxiClweWiKxD5bI',
  authDomain: 'woobiedinobear.firebaseapp.com',
  databaseURL: 'https://woobiedinobear-default-rtdb.firebaseio.com',
  projectId: 'woobiedinobear',
  storageBucket: 'woobiedinobear.appspot.com',
  messagingSenderId: '642703845433',
  appId: '1:642703845433:web:56be57a1da63e1ecbd85e8'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function invertColor(hex) {
  return '#' + ('000000' + (0xFFFFFF ^ parseInt(hex.slice(1), 16)).toString(16)).slice(-6);
}

function needsGreenBackground(hex) {
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness < 60;
}

const modeButtons = document.querySelectorAll('[data-mode]');
const nameOptions = document.getElementById('name-options');
const selectedNameP = document.getElementById('selected-name');
let currentMode = 'normal';
let currentNames = [];
let selected = null;

function generateNameSet() {
  let adjectives, colors, colorHex, animals, animalEmojis, extraEmojis;
  switch (currentMode) {
    case 'prismatic':
      adjectives = [...baseAdjectives, ...prismaticAdjectives];
      colors = prismaticColors;
      colorHex = prismaticColorHex;
      animals = [...baseAnimals, ...mythicalAnimals];
      animalEmojis = [...baseAnimalEmojis, ...mythicalAnimalEmojis];
      extraEmojis = prismaticEmojis;
      break;
    case 'neon':
      adjectives = [...baseAdjectives, ...neonAdjectives];
      colors = [...baseColors, ...neonColors];
      colorHex = [...baseColorHex, ...neonColorHex];
      animals = [...baseAnimals, ...mythicalAnimals];
      animalEmojis = [...baseAnimalEmojis, ...mythicalAnimalEmojis];
      break;
    case 'cosmic':
      adjectives = [...baseAdjectives, ...cosmicAdjectives];
      colors = [...baseColors, ...cosmicColors];
      colorHex = [...baseColorHex, ...cosmicColorHex];
      animals = baseAnimals.map(a => cosmicPrefixes[Math.floor(Math.random() * cosmicPrefixes.length)] + a);
      animalEmojis = baseAnimalEmojis.map(e => cosmicPrefixEmojis[Math.floor(Math.random() * cosmicPrefixEmojis.length)] + e);
      break;
    default:
      adjectives = baseAdjectives;
      colors = baseColors;
      colorHex = baseColorHex;
      animals = baseAnimals;
      animalEmojis = baseAnimalEmojis;
  }

  let names = [];
  while (names.length < 3) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const i = Math.floor(Math.random() * colors.length);
    const col = colors[i];
    const color = colorHex[i];
    const aniIdx = Math.floor(Math.random() * animals.length);
    const ani = animals[aniIdx];
    const emoji = animalEmojis[aniIdx];
    const label = `${adj} ${col} ${ani}`;
    if (!names.find(n => n.label === label)) {
      let fgColor = color;
      let bgColor = currentMode === 'normal' && needsGreenBackground(color) ? '#00ff00' : '#000000';
      names.push({ label, emoji, fg: fgColor, bg: bgColor });
    }
  }
  return names;
}

function renderNames() {
  nameOptions.innerHTML = '';
  currentNames = generateNameSet();
  currentNames.forEach(n => {
    const btn = document.createElement('button');
    btn.className = `woobie-button name-button woobie-${currentMode}`;
    if (currentMode === 'cosmic') {
      btn.classList.add('cosmic-pulse');
    }
    btn.innerHTML = `<strong>${n.label} ${n.emoji}</strong>`;
    btn.style.backgroundColor = n.bg;
    btn.style.color = n.fg;
    btn.onclick = () => {
      selected = n;
      selectedNameP.innerHTML = `You picked: <strong>${n.label} ${n.emoji}</strong>`;
      selectedNameP.className = `woobie-${currentMode}`;
      document.querySelectorAll('.name-button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    nameOptions.appendChild(btn);
  });
}

modeButtons.forEach(btn => {
  btn.onclick = () => {
    currentMode = btn.dataset.mode;
    document.body.className = `${currentMode}-mode`;
    selectedNameP.className = '';
    renderNames();
  };
});

document.getElementById('reroll').onclick = renderNames;

document.getElementById('confirm').onclick = async () => {
  if (!selected) {
    alert('Please pick a name.');
    return;
  }
  const username = `${selected.label} ${selected.emoji}`;
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

renderNames();
