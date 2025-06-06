// name-picker/name-generator.js
import { db, auth } from '../shared/firebase-config.js'; // Using shared Firebase config
import { ref, get, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

import {
  baseAdjectives, prismaticAdjectives, neonAdjectives, cosmicAdjectives,
  baseColors, baseColorHex, prismaticColors, prismaticColorHex,
  neonColors, neonColorHex, cosmicColors, cosmicColorHex,
  cosmicPrefixes, cosmicPrefixEmojis,
  baseAnimals, baseAnimalEmojis, mythicalAnimals, mythicalAnimalEmojis,
} from './name-parts.js';

let currentUserId = null;

// Check Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    console.log("User is logged in on name-picker:", currentUserId);

    // Check if user already has a WoobieName and is past this initial name-picking stage
    try {
      const userProfileSnap = await get(ref(db, `users/${currentUserId}`));
      if (userProfileSnap.exists()) {
        const userData = userProfileSnap.val();
        // If they have a Woobie name AND their stage is beyond 'name-picker' or 'collect_preferences'
        // they should be routed by resume.html
        if (userData.username && userData.stage &&
            userData.stage !== 'name-picker' &&
            userData.stage !== 'collect_preferences' // Assuming 'collect_preferences' is next
        ) {
          console.log(`User ${currentUserId} has existing Woobie name and is past name-picking (stage: ${userData.stage}). Redirecting to resume...`);
          window.location.href = '/resume.html';
          return; // Prevent further execution on this page
        }
      }
    } catch (error) {
      console.error("Error checking existing user stage in name-picker:", error);
      // Proceed, resume.html might handle it if there's an issue
    }

    if (document.getElementById('confirm')) {
        document.getElementById('confirm').disabled = false;
    }
    if (document.getElementById('reroll')) {
        document.getElementById('reroll').disabled = false;
    }
  } else {
    console.log("No user logged in on name-picker. Redirecting to login.");
    window.location.href = '/auth/login.html';
  }
});

// --- UI setup code (from your provided version, with minor null checks) ---
const modeButtons = document.querySelectorAll('[data-mode]');
const nameOptions = document.getElementById('name-options');
const selectedNameP = document.getElementById('selected-name');
const rerollBtn = document.getElementById('reroll');
const confirmButton = document.getElementById('confirm');

const showSavedBtn = document.createElement('button');
showSavedBtn.textContent = '📜 Show Saved Options';
showSavedBtn.className = 'woobie-button';
if (nameOptions && nameOptions.parentElement) {
    nameOptions.parentElement.appendChild(showSavedBtn);
} else {
    console.warn("name-options parent element not found for showSavedBtn.");
}

const rollsLeft = document.createElement('div');
rollsLeft.style.marginBottom = '1rem';
rollsLeft.style.color = '#33ff33';
rollsLeft.id = 'roll-counter';
if (nameOptions && nameOptions.parentElement) {
    nameOptions.parentElement.insertBefore(rollsLeft, nameOptions);
} else {
    console.warn("name-options parent element not found for rollsLeft.");
}

let currentMode = localStorage.getItem('woobieModePref') || 'normal';
let currentNames = [];
let selected = null;
let savedSets = JSON.parse(localStorage.getItem('woobieSavedSets') || '[]');
let rerollCount = parseInt(localStorage.getItem('woobieRerollCount') || '0');
const MAX_REROLLS = 9;
let cooldown = false;

if (confirmButton) confirmButton.disabled = true;
if (rerollBtn) rerollBtn.disabled = true;


function updateStateStorage() {
  localStorage.setItem('woobieSavedSets', JSON.stringify(savedSets));
  localStorage.setItem('woobieRerollCount', rerollCount.toString());
  localStorage.setItem('woobieModePref', currentMode);
  if (rollsLeft) {
    rollsLeft.textContent = `Rerolls remaining: ${MAX_REROLLS - rerollCount}`;
    rollsLeft.classList.add('flash-roll');
    setTimeout(() => rollsLeft.classList.remove('flash-roll'), 400);
  }
}

function needsGreenBackground(hex) {
  if (!hex || typeof hex !== 'string' || hex.charAt(0) !== '#') return false;
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 60;
}

function generateNameSet() {
  let adjectivesToUse, colorsToUse, colorHexToUse, animalsToUse, animalEmojisToUse;
  switch (currentMode) {
    case 'prismatic':
      adjectivesToUse = [...baseAdjectives, ...prismaticAdjectives];
      colorsToUse = prismaticColors; colorHexToUse = prismaticColorHex;
      animalsToUse = [...baseAnimals, ...mythicalAnimals];
      animalEmojisToUse = [...baseAnimalEmojis, ...mythicalAnimalEmojis];
      break;
    case 'neon':
      adjectivesToUse = [...baseAdjectives, ...neonAdjectives];
      colorsToUse = [...baseColors, ...neonColors];
      colorHexToUse = [...baseColorHex, ...neonColorHex];
      animalsToUse = [...baseAnimals, ...mythicalAnimals];
      animalEmojisToUse = [...baseAnimalEmojis, ...mythicalAnimalEmojis];
      break;
    case 'cosmic':
      adjectivesToUse = [...baseAdjectives, ...cosmicAdjectives];
      colorsToUse = [...baseColors, ...cosmicColors];
      colorHexToUse = [...baseColorHex, ...cosmicColorHex];
      animalsToUse = baseAnimals.map((a) => cosmicPrefixes[Math.floor(Math.random() * cosmicPrefixes.length)] + a);
      animalEmojisToUse = baseAnimalEmojis.map((e) => cosmicPrefixEmojis[Math.floor(Math.random() * cosmicPrefixEmojis.length)] + e);
      break;
    default: // normal mode
      adjectivesToUse = baseAdjectives;
      colorsToUse = baseColors; colorHexToUse = baseColorHex;
      animalsToUse = baseAnimals; animalEmojisToUse = baseAnimalEmojis;
  }

  const names = [];
  const usedLabels = new Set();
  // Add a check to prevent infinite loop if all combinations are exhausted (unlikely with these parts)
  let attemptLimit = 100; 
  while (names.length < 3 && attemptLimit > 0) {
    const adj = adjectivesToUse[Math.floor(Math.random() * adjectivesToUse.length)];
    const colorIndex = Math.floor(Math.random() * colorsToUse.length);
    const colName = colorsToUse[colorIndex];
    const colorValue = colorHexToUse[colorIndex];
    const animalIndex = Math.floor(Math.random() * animalsToUse.length);
    const ani = animalsToUse[animalIndex];
    const emoji = animalEmojisToUse[animalIndex];
    const label = `${adj} ${colName} ${ani}`;

    if (!usedLabels.has(label)) {
      usedLabels.add(label);
      const fgColor = colorValue;
      const bgColor = currentMode === 'normal' && needsGreenBackground(colorValue) ? '#00ff00' : '#000000';
      names.push({label, emoji, fg: fgColor, bg: bgColor, mode: currentMode});
    }
    attemptLimit--;
  }
  if(attemptLimit === 0) console.warn("Could not generate 3 unique names.");
  return names;
}

function renderNames(nameSetToRender = null, preserveModeOnClick = false) {
  if (!nameOptions) {
    console.error("nameOptions element not found for rendering names.");
    return;
  }
  nameOptions.innerHTML = '';
  currentNames = nameSetToRender || generateNameSet();

  currentNames.forEach((nameObj) => {
    const btn = document.createElement('button');
    const appliedMode = preserveModeOnClick ? nameObj.mode : currentMode;
    btn.className = `woobie-button name-button woobie-${appliedMode}`;
    if (appliedMode === 'cosmic') btn.classList.add('cosmic-pulse');
    btn.innerHTML = `<strong>${nameObj.label} ${nameObj.emoji}</strong>`;
    btn.style.backgroundColor = nameObj.bg;
    btn.style.color = nameObj.fg;

    if (selected && selected.label === nameObj.label && selected.emoji === nameObj.emoji) {
        btn.classList.add('selected');
    }

    btn.onclick = () => {
      selected = nameObj;
      if (selectedNameP) {
        selectedNameP.innerHTML = `You picked: <strong>${nameObj.label} ${nameObj.emoji}</strong>`;
        selectedNameP.className = `woobie-${appliedMode}`;
      }
      document.querySelectorAll('.name-button').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    nameOptions.appendChild(btn);
  });
}

if (rerollBtn) {
    rerollBtn.onclick = () => {
        if (cooldown || rerollCount >= MAX_REROLLS) {
            alert("You've reached the max rerolls. Pick from your saved ones or confirm a name.");
            return;
        }
        cooldown = true;
        setTimeout(() => { cooldown = false; }, 600);
        const newSet = generateNameSet();
        if (savedSets.length >= 20) savedSets.shift(); 
        savedSets.push(newSet);
        rerollCount++;
        updateStateStorage();
        renderNames(newSet);
        selected = null; 
        if(selectedNameP) selectedNameP.innerHTML = "";
    };
}

if (showSavedBtn) {
    showSavedBtn.onclick = () => {
        const modal = document.createElement('div');
        modal.tabIndex = -1;
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); z-index:9999; overflow-y:auto; padding:2rem; display:flex; flex-direction:column; align-items:center; justify-content:center;';
        modal.innerHTML = `<div style="background:#121212; border:1px solid #33ff33; padding:2rem; border-radius:5px; max-height:80vh; overflow-y:auto; width: 90%; max-width: 600px;"><h2 style="color:#33ff33; text-align:center;">Saved Sets</h2><div id="modal-sets-container" style="max-height: 60vh; overflow-y: auto;"></div><button id="close-saved-modal" class="woobie-button" style="margin-top:1rem;">❌ Close</button></div>`;
        document.body.appendChild(modal);
        const modalSetsContainer = document.getElementById('modal-sets-container');

        if (savedSets.length === 0 && modalSetsContainer) {
            modalSetsContainer.innerHTML = "<p style='color:#999;'>No sets saved yet. Reroll to save name options!</p>";
        } else if (modalSetsContainer) {
            savedSets.forEach((set, index) => {
                const group = document.createElement('div');
                group.style.margin = '1rem 0'; group.style.border = '1px dashed #33ff33'; group.style.padding = '1rem';
                const firstModeInSet = set[0]?.mode || currentMode;
                group.innerHTML = `<strong style="color:#33ff33">Set #${index + 1} (Mode: ${firstModeInSet})</strong>`;
                set.forEach((nameObj) => {
                    const btn = document.createElement('button');
                    btn.className = `woobie-button name-button woobie-${nameObj.mode}`;
                    if (nameObj.mode === 'cosmic') btn.classList.add('cosmic-pulse');
                    btn.innerHTML = `<strong>${nameObj.label} ${nameObj.emoji}</strong>`;
                    btn.style.backgroundColor = nameObj.bg; btn.style.color = nameObj.fg; btn.style.margin = '0.25rem';
                    if (selected && selected.label === nameObj.label && selected.emoji === nameObj.emoji) {
                        btn.classList.add('selected');
                    }
                    btn.onclick = () => {
                        selected = nameObj;
                        currentMode = nameObj.mode;
                        document.body.className = `${currentMode}-mode`;
                        if (selectedNameP) {
                            selectedNameP.innerHTML = `You picked: <strong>${nameObj.label} ${nameObj.emoji}</strong>`;
                            selectedNameP.className = `woobie-${nameObj.mode}`;
                        }
                        document.querySelectorAll('.name-button').forEach((b) => b.classList.remove('selected'));
                        renderNames(set, true);
                        const mainButtons = nameOptions ? nameOptions.querySelectorAll('.name-button') : [];
                        mainButtons.forEach(mainBtn => {
                            if (mainBtn.innerHTML.includes(nameObj.label) && mainBtn.innerHTML.includes(nameObj.emoji)) {
                                mainBtn.classList.add('selected');
                            }
                        });
                        document.body.removeChild(modal);
                    };
                    group.appendChild(btn);
                });
                modalSetsContainer.appendChild(group);
            });
        }
        const closeButton = document.getElementById('close-saved-modal');
        if (closeButton) {
            closeButton.onclick = () => document.body.removeChild(modal);
        }
        modal.focus();
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
            }
        });
    };
}

if (modeButtons) {
    modeButtons.forEach((btn) => {
        btn.onclick = () => {
            if (cooldown || rerollCount >= MAX_REROLLS) {
                 alert("Max rerolls reached. Please choose from saved options or confirm a name.");
                 return;
            }
            cooldown = true;
            setTimeout(() => { cooldown = false; }, 600);

            currentMode = btn.dataset.mode;
            document.body.className = `${currentMode}-mode`;
            if(selectedNameP) selectedNameP.className = `woobie-${currentMode}`;

            const newSet = generateNameSet();
            if (savedSets.length >= 20) savedSets.shift();
            savedSets.push(newSet);
            rerollCount++;
            updateStateStorage();
            renderNames(newSet);
            selected = null;
            if(selectedNameP) selectedNameP.innerHTML = "";
        };
    });
}

// Initial name generation and state update
if (document.getElementById('name-options')) { // Ensure nameOptions exists
    if (savedSets.length === 0) {
        const initialSet = generateNameSet();
        if (initialSet.length > 0) { // Only add if names were generated
            savedSets.unshift(initialSet);
            updateStateStorage();
            renderNames(initialSet);
        }
    } else {
        const lastSet = savedSets[savedSets.length - 1];
        if (lastSet && lastSet[0]) {
            currentMode = lastSet[0].mode;
            document.body.className = `${currentMode}-mode`;
            if(selectedNameP) selectedNameP.className = `woobie-${currentMode}`;
        }
        updateStateStorage();
        renderNames(lastSet, true);
    }
}


// --- CONFIRM BUTTON LOGIC (NEW SIMPLIFIED ROLE) ---
if (confirmButton) {
  confirmButton.onclick = async () => {
    if (!selected) {
      alert('Please pick a name.');
      return;
    }

    if (!currentUserId) {
      alert('Authentication error. Please ensure you are logged in and refresh.');
      return;
    }

    const woobieName = `${selected.label} ${selected.emoji}`;

    // 1. Save chosen Woobie name and essential display details to localStorage
    // These will be picked up by the next page (interests-dealbreakers.html) to help build the queue entry.
    localStorage.setItem('woobieUsername', woobieName); // This is the Woobie display name
    localStorage.setItem('woobieEmoji', selected.emoji);
    localStorage.setItem('woobieMode', selected.mode);
    localStorage.setItem('woobieUID', currentUserId); // Actual Firebase UID

    // 2. Clear name picker specific localStorage items used for drafting names
    localStorage.removeItem('woobieSavedSets');
    localStorage.removeItem('woobieRerollCount');
    localStorage.removeItem('woobieModePref');

    // 3. Update the user's main profile in /users/{uid} with the chosen Woobie name.
    // Also, set their stage to indicate the next step in the flow.
    const userProfileRef = ref(db, `users/${currentUserId}`);
    try {
      await update(userProfileRef, {
        username: woobieName, // Set/update their chosen Woobie name in their main user profile
        // Update the stage to 'collect_preferences' or directly to 'interests_dealbreakers_pending'
        // if interests/dealbreakers page also handles gender preferences.
        // Let's assume 'interests-dealbreakers' is the next step where ALL preferences are set before queueing.
        stage: 'interests-dealbreakers', // This will be used by resume.html
        currentMatch: { // Initialize or update currentMatch object
            username: woobieName, // WoobieName specific to this matching attempt/session
            stage: 'interests-dealbreakers', // Stage within the matching flow
            // matchID will be set when they actually enter the queue or a match is formed.
        }
      });
      console.log(`User profile updated for ${currentUserId}. WoobieName: ${woobieName}. Next stage: interests-dealbreakers.`);
    } catch (error) {
      console.error("Error updating user profile with Woobie name and stage:", error);
      alert("Could not save your name choice. Please try again.");
      return; // Stop if profile update fails
    }

    // 4. Redirect to the next page where preferences (gender, interests, dealbreakers) are collected
    // This page will now be responsible for gathering all data and then adding the user to the queue.
    window.location.href = '/interests-dealbreakers/index.html';
  };
}

// Cosmetic style for flash animation
const dynamicStyle = document.createElement('style');
dynamicStyle.innerHTML = `
  .flash-roll { animation: flashdown 0.4s ease-in-out; }
  @keyframes flashdown { 0% { transform: scale(1.2); color: #00ffff; } 100% { transform: scale(1); color: #33ff33; } }
`;
if (document.head) {
    document.head.appendChild(dynamicStyle);
}