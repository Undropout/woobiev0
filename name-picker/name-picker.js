// name-picker/name-generator.js
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';

import {
  baseAdjectives, prismaticAdjectives, neonAdjectives, cosmicAdjectives,
  baseColors, baseColorHex, prismaticColors, prismaticColorHex, prismaticEmojis,
  neonColors, neonColorHex, cosmicColors, cosmicColorHex,
  cosmicPrefixes, cosmicPrefixEmojis,
  baseAnimals, baseAnimalEmojis, mythicalAnimals, mythicalAnimalEmojis
} from './name-parts.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);

const existingUsername = localStorage.getItem('woobieUsername');
const existingMatchID = localStorage.getItem('woobieMatchID');
if (existingUsername && existingMatchID) {
  alert("You've already been matched! Redirecting to your chatroom...");
  window.location.href = '/chat/index.html';
}

const modeButtons = document.querySelectorAll('[data-mode]');
const nameOptions = document.getElementById('name-options');
const selectedNameP = document.getElementById('selected-name');
const rerollBtn = document.getElementById('reroll');

const showSavedBtn = document.createElement('button');
showSavedBtn.textContent = '📜 Show Saved Options';
showSavedBtn.className = 'woobie-button';
nameOptions.parentElement.appendChild(showSavedBtn);

const rollsLeft = document.createElement('div');
rollsLeft.style.marginBottom = '1rem';
rollsLeft.style.color = '#33ff33';
rollsLeft.id = 'roll-counter';
nameOptions.parentElement.insertBefore(rollsLeft, nameOptions);

let currentMode = localStorage.getItem('woobieModePref') || 'normal';
let currentNames = [];
let selected = null;
let savedSets = JSON.parse(localStorage.getItem('woobieSavedSets') || '[]');
let rerollCount = parseInt(localStorage.getItem('woobieRerollCount') || '0');
const MAX_REROLLS = 9;
let cooldown = false;

function updateStateStorage() {
  localStorage.setItem('woobieSavedSets', JSON.stringify(savedSets));
  localStorage.setItem('woobieRerollCount', rerollCount.toString());
  localStorage.setItem('woobieModePref', currentMode);
  rollsLeft.textContent = `Rerolls remaining: ${MAX_REROLLS - rerollCount}`;
  rollsLeft.classList.add('flash-roll');
  setTimeout(() => rollsLeft.classList.remove('flash-roll'), 400);
}

function needsGreenBackground(hex) {
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 60;
}

function generateNameSet() {
  let adjectives, colors, colorHex, animals, animalEmojis, extraEmojis;
  switch (currentMode) {
    case 'prismatic':
      adjectives = [...baseAdjectives, ...prismaticAdjectives];
      colors = prismaticColors; colorHex = prismaticColorHex;
      animals = [...baseAnimals, ...mythicalAnimals];
      animalEmojis = [...baseAnimalEmojis, ...mythicalAnimalEmojis];
      extraEmojis = prismaticEmojis; break;
    case 'neon':
      adjectives = [...baseAdjectives, ...neonAdjectives];
      colors = [...baseColors, ...neonColors];
      colorHex = [...baseColorHex, ...neonColorHex];
      animals = [...baseAnimals, ...mythicalAnimals];
      animalEmojis = [...baseAnimalEmojis, ...mythicalAnimalEmojis]; break;
    case 'cosmic':
      adjectives = [...baseAdjectives, ...cosmicAdjectives];
      colors = [...baseColors, ...cosmicColors];
      colorHex = [...baseColorHex, ...cosmicColorHex];
      animals = baseAnimals.map(a => cosmicPrefixes[Math.floor(Math.random() * cosmicPrefixes.length)] + a);
      animalEmojis = baseAnimalEmojis.map(e => cosmicPrefixEmojis[Math.floor(Math.random() * cosmicPrefixEmojis.length)] + e); break;
    default:
      adjectives = baseAdjectives;
      colors = baseColors; colorHex = baseColorHex;
      animals = baseAnimals; animalEmojis = baseAnimalEmojis;
  }

  let names = [];
  while (names.length < 3) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const i = Math.floor(Math.random() * colors.length);
    const col = colors[i], color = colorHex[i];
    const aniIdx = Math.floor(Math.random() * animals.length);
    const ani = animals[aniIdx], emoji = animalEmojis[aniIdx];
    const label = `${adj} ${col} ${ani}`;
    if (!names.find(n => n.label === label)) {
      let fgColor = color;
      let bgColor = currentMode === 'normal' && needsGreenBackground(color) ? '#00ff00' : '#000000';
      names.push({ label, emoji, fg: fgColor, bg: bgColor, mode: currentMode });
    }
  }
  return names;
}

function renderNames(nameSet = null, preserveMode = false) {
  nameOptions.innerHTML = '';
  currentNames = nameSet || generateNameSet();
  currentNames.forEach(n => {
    const btn = document.createElement('button');
    const appliedMode = preserveMode ? n.mode : currentMode;
    btn.className = `woobie-button name-button woobie-${appliedMode}`;
    if (appliedMode === 'cosmic') btn.classList.add('cosmic-pulse');
    btn.innerHTML = `<strong>${n.label} ${n.emoji}</strong>`;
    btn.style.backgroundColor = n.bg;
    btn.style.color = n.fg;
    if (selected && selected.label === n.label) btn.classList.add('selected');
    btn.onclick = () => {
      if (localStorage.getItem('woobieUsername')) {
        alert("You've already confirmed a name.");
        return;
      }
      selected = n;
      selectedNameP.innerHTML = `You picked: <strong>${n.label} ${n.emoji}</strong>`;
      selectedNameP.className = `woobie-${appliedMode}`;
      document.querySelectorAll('.name-button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    nameOptions.appendChild(btn);
  });
}

rerollBtn.onclick = () => {
  if (cooldown || rerollCount >= MAX_REROLLS) {
    alert("You've reached the max rerolls. Pick from your saved ones.");
    return;
  }
  cooldown = true;
  setTimeout(() => (cooldown = false), 600);
  const newSet = generateNameSet();
  savedSets.push(newSet);
  rerollCount++;
  updateStateStorage();
  renderNames(newSet);
};

showSavedBtn.onclick = () => {
  if (localStorage.getItem('woobieUsername')) return;
  const modal = document.createElement('div');
  modal.tabIndex = -1;
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.backgroundColor = 'rgba(0,0,0,0.95)';
  modal.style.zIndex = '9999';
  modal.style.overflowY = 'auto';
  modal.style.padding = '2rem';
  modal.innerHTML = `<h2 style="color:#33ff33">Saved Sets</h2>`;

  savedSets.forEach((set, index) => {
    const group = document.createElement('div');
    group.style.margin = '1rem 0';
    group.style.border = '1px dashed #33ff33';
    group.style.padding = '1rem';
    group.innerHTML = `<strong style="color:#33ff33">Set #${index + 1}</strong>`;

    set.forEach(n => {
      const btn = document.createElement('button');
      btn.className = `woobie-button name-button woobie-${n.mode}`;
      if (n.mode === 'cosmic') btn.classList.add('cosmic-pulse');
      btn.innerHTML = `<strong>${n.label} ${n.emoji}</strong>`;
      btn.style.backgroundColor = n.bg;
      btn.style.color = n.fg;
      btn.style.margin = '0.25rem';
      if (selected && selected.label === n.label) btn.classList.add('selected');
      btn.onclick = () => {
        selected = n;
        selectedNameP.innerHTML = `You picked: <strong>${n.label} ${n.emoji}</strong>`;
        selectedNameP.className = `woobie-${n.mode}`;
        document.body.removeChild(modal);
        renderNames(set, true);
      };
      group.appendChild(btn);
    });
    modal.appendChild(group);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '❌ Close';
  closeBtn.className = 'woobie-button';
  closeBtn.style.marginTop = '1rem';
  closeBtn.onclick = () => document.body.removeChild(modal);
  modal.appendChild(closeBtn);

  document.body.appendChild(modal);
  modal.focus();
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
    }
  });
};

document.getElementById('confirm').onclick = async () => {
  if (!selected) {
    alert('Please pick a name.');
    return;
  }
  const username = `${selected.label} ${selected.emoji}`;
  const emoji = selected.emoji;
  localStorage.setItem('woobieUsername', username);
  localStorage.setItem('woobieEmoji', emoji);
  localStorage.setItem('woobieMode', selected.mode);
  localStorage.removeItem('woobieSavedSets');
  localStorage.removeItem('woobieRerollCount');
  localStorage.removeItem('woobieModePref');

  const queueRef = ref(db, 'queue');
  const queueSnap = await get(queueRef);
  let matchID = `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (!queueSnap.exists()) {
    await set(queueRef, { userA: username, matchID });
    await set(ref(db, `matches/${matchID}/users`), [username]);
    await set(ref(db, `matches/${matchID}/modes/${username}`), { mode: selected.mode });
    localStorage.setItem('woobieMatchID', matchID);
    window.location.href = '/interests-dealbreakers/index.html';
  } else {
    const data = queueSnap.val();
    const partner = data.userA;
    matchID = data.matchID;
    await set(ref(db, `matches/${matchID}/users`), [partner, username]);
    await set(ref(db, `matches/${matchID}/modes/${username}`), { mode: selected.mode });
    await set(queueRef, null);
    localStorage.setItem('woobieMatchID', matchID);
    window.location.href = '/interests-dealbreakers/index.html';
  }
};

modeButtons.forEach(btn => {
  btn.onclick = () => {
    if (cooldown || rerollCount >= MAX_REROLLS) return;
    cooldown = true;
    setTimeout(() => (cooldown = false), 600);
    currentMode = btn.dataset.mode;
    const newSet = generateNameSet();
    savedSets.push(newSet);
    rerollCount++;
    updateStateStorage();
    document.body.className = `${currentMode}-mode`;
    selectedNameP.className = '';
    renderNames(newSet);
  };
});

const firstSet = generateNameSet();
savedSets.unshift(firstSet);
updateStateStorage();
renderNames(firstSet);

const style = document.createElement('style');
style.innerHTML = `
  .flash-roll {
    animation: flashdown 0.4s ease-in-out;
  }
  @keyframes flashdown {
    0% { transform: scale(1.2); color: #00ffff; }
    100% { transform: scale(1); color: #33ff33; }
  }
`;
document.head.appendChild(style);
