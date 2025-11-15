// name-picker/name-generator.js - FIXED: No emoji color override
import { db, auth } from '../shared/firebase-config.js';
import { ref, get, update, set } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

import {
  baseAdjectives, prismaticAdjectives, neonAdjectives, cosmicAdjectives,
  baseColors, baseColorHex, prismaticColors, prismaticColorHex,
  neonColors, neonColorHex, cosmicColors, cosmicColorHex,
  cosmicPrefixes, cosmicPrefixEmojis,
  baseAnimals, baseAnimalEmojis, mythicalAnimals, mythicalAnimalEmojis,
} from './name-parts.js';

let currentUserId = null;

// REMOVED: simpleEmojiGlow function - let CSS handle emoji styling

// Check Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    console.log("User is logged in on name-picker:", currentUserId);

    try {
      const userProfileSnap = await get(ref(db, `users/${currentUserId}`));
      if (userProfileSnap.exists()) {
        const userData = userProfileSnap.val();

        if (userData.username && userData.stage &&
            userData.stage !== 'name-picker' &&
            userData.stage !== 'collect_preferences'
        ) {
          console.log(`User ${currentUserId} has existing Woobie name and is past name-picking (stage: ${userData.stage}). Redirecting to resume...`);
          window.location.href = '/resume.html';
          return;
        }
      }
    } catch (error) {
      console.error("Error checking existing user stage in name-picker:", error);
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

// UI setup code
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
}

const rollsLeft = document.createElement('div');
rollsLeft.style.marginBottom = '1rem';
rollsLeft.style.color = '#33ff33';
rollsLeft.id = 'roll-counter';
if (nameOptions && nameOptions.parentElement) {
    nameOptions.parentElement.insertBefore(rollsLeft, nameOptions);
}

let currentMode = localStorage.getItem('woobieModePref') || 'normal';
let currentNames = [];
let selected = null;
let savedSets = JSON.parse(localStorage.getItem('woobieSavedSets') || '[]');
let rerollCount = parseInt(localStorage.getItem('woobieRerollCount') || '0');
const MAX_REROLLS = 9;
let cooldown = false;

console.log('[Name-Picker] Initial state:', {
  rerollCount,
  savedSetsLength: savedSets.length,
  rerollsRemaining: MAX_REROLLS - rerollCount
});

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
    default:
      adjectivesToUse = baseAdjectives;
      colorsToUse = baseColors; colorHexToUse = baseColorHex;
      animalsToUse = baseAnimals; animalEmojisToUse = baseAnimalEmojis;
  }

  const names = [];
  const usedLabels = new Set();
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
    
    // FIXED: Just set raw HTML - let CSS and HTML script handle emoji styling
    btn.innerHTML = `<strong>${nameObj.label} ${nameObj.emoji}</strong>`;
    
    // Apply color styling for text, but DON'T override emoji colors
    if (appliedMode === 'normal') {
      btn.style.backgroundColor = nameObj.bg;
      btn.style.color = nameObj.fg;
    } else {
      if (nameObj.bg !== '#000000') {
        btn.style.backgroundColor = nameObj.bg;
      }
    }

    if (selected && selected.label === nameObj.label && selected.emoji === nameObj.emoji) {
        btn.classList.add('selected');
    }

    btn.onclick = () => {
      selected = nameObj;
      if (selectedNameP) {
        // FIXED: Just set raw HTML here too
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
        console.log('[Reroll Button] Clicked. Current rerollCount:', rerollCount, 'Max:', MAX_REROLLS);

        // Check cooldown first
        if (cooldown) {
            console.log('[Reroll Button] BLOCKED - cooldown active');
            return; // Just ignore the click, don't show an alert
        }

        // Check max rerolls
        if (rerollCount >= MAX_REROLLS) {
            console.log('[Reroll Button] BLOCKED - max rerolls reached');
            alert("You've reached the max rerolls. Pick from your saved ones or confirm a name.");
            return;
        }

        cooldown = true;
        setTimeout(() => { cooldown = false; }, 600);
        const newSet = generateNameSet();
        if (savedSets.length >= 20) savedSets.shift();
        savedSets.push(newSet);
        rerollCount++;
        console.log('[Reroll Button] Incremented rerollCount to:', rerollCount);
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
                    
                    // FIXED: Raw HTML, no color override
                    btn.innerHTML = `<strong>${nameObj.label} ${nameObj.emoji}</strong>`;
                    
                    if (nameObj.mode === 'normal') {
                      btn.style.backgroundColor = nameObj.bg;
                      btn.style.color = nameObj.fg;
                    } else {
                      if (nameObj.bg !== '#000000') {
                        btn.style.backgroundColor = nameObj.bg;
                      }
                    }
                    
                    btn.style.margin = '0.25rem';
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
            const newMode = btn.dataset.mode;

            console.log('[Mode Switch] Clicked mode:', newMode, 'Current mode:', currentMode);

            // If clicking the same mode, do nothing
            if (newMode === currentMode) {
                console.log('[Mode Switch] Same mode clicked, ignoring');
                return;
            }

            // Mode switching doesn't count as a reroll, just regenerate names with new style
            cooldown = true;
            setTimeout(() => { cooldown = false; }, 600);

            currentMode = newMode;
            document.body.className = `${currentMode}-mode`;
            if(selectedNameP) selectedNameP.className = `woobie-${currentMode}`;

            // Generate new set with the new mode but don't increment reroll counter
            const newSet = generateNameSet();
            if (savedSets.length >= 20) savedSets.shift();
            savedSets.push(newSet);
            console.log('[Mode Switch] Generated new set. rerollCount still:', rerollCount, 'savedSets.length:', savedSets.length);
            updateStateStorage();
            renderNames(newSet);
            selected = null;
            if(selectedNameP) selectedNameP.innerHTML = "";
        };
    });
}

// Initial name generation and state update
if (document.getElementById('name-options')) {
    if (savedSets.length === 0) {
        const initialSet = generateNameSet();
        if (initialSet.length > 0) {
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

// Confirm button logic - shows referral section
if (confirmButton) {
  confirmButton.onclick = () => {
    if (!selected) {
      alert('Please pick a name.');
      return;
    }

    // Hide name selection UI
    if (nameOptions) nameOptions.style.display = 'none';
    if (rerollBtn) rerollBtn.parentElement.style.display = 'none';
    if (showSavedBtn) showSavedBtn.style.display = 'none';
    if (confirmButton) confirmButton.parentElement.style.display = 'none';
    if (rollsLeft) rollsLeft.style.display = 'none';

    const modeButtonsContainer = document.getElementById('mode-buttons');
    if (modeButtonsContainer) modeButtonsContainer.style.display = 'none';

    // Update selected name message
    if (selectedNameP) {
      selectedNameP.style.fontSize = '1.5rem';
      selectedNameP.style.marginBottom = '2rem';
    }

    // Show referral section and continue button
    const referralSection = document.getElementById('referral-section');
    if (referralSection) {
      referralSection.style.display = 'block';
      referralSection.style.opacity = '1'; // Make it fully visible
      referralSection.style.borderColor = '#33ff33'; // Make border brighter
    }

    const continueBtn = document.getElementById('continue-main-btn');
    if (continueBtn) continueBtn.style.display = 'block';
  };
}

// Referral Code Functionality
function generateReferralCode() {
  const colors = ['purple', 'cosmic', 'stellar', 'neon', 'prismatic', 'amber', 'emerald', 'sapphire'];
  const adjectives = ['quirky', 'bold', 'cheerful', 'lazy', 'witty', 'brave', 'curious', 'gentle'];
  const animals = ['dolphin', 'unicorn', 'dragon', 'phoenix', 'tiger', 'panda', 'koala', 'owl'];

  const color = colors[Math.floor(Math.random() * colors.length)];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];

  return `${color}-${adjective}-${animal}`;
}

// Generate Code button
const generateCodeBtn = document.getElementById('generate-code-btn');
const codeResult = document.getElementById('code-result');
const generatedCodeP = document.getElementById('generated-code');
const copyCodeBtn = document.getElementById('copy-code-btn');
const proceedWithCodeBtn = document.getElementById('proceed-with-code-btn');

if (generateCodeBtn) {
  generateCodeBtn.onclick = async () => {
    if (!currentUserId || !selected) {
      alert('Please select a name first.');
      return;
    }

    const code = generateReferralCode();
    const woobieName = `${selected.label} ${selected.emoji}`;

    try {
      // Save referral code to database
      const codeRef = ref(db, `referralCodes/${code}`);
      await set(codeRef, {
        code: code,
        createdBy: currentUserId,
        createdAt: Date.now(),
        username: woobieName,
        mode: selected.mode,
        emoji: selected.emoji,
        used: false,
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
      });

      // Save referral info to user profile
      const userRef = ref(db, `users/${currentUserId}`);
      await update(userRef, {
        referralCodeID: code,
        referralMode: 'waiting'
      });

      // Show the code
      if (generatedCodeP) generatedCodeP.textContent = code;
      if (codeResult) codeResult.style.display = 'block';
      if (generateCodeBtn) generateCodeBtn.style.display = 'none';
      const enterCodeBtn = document.getElementById('enter-code-btn');
      if (enterCodeBtn) enterCodeBtn.style.display = 'none';

      console.log(`Referral code generated: ${code}`);
    } catch (error) {
      console.error('Error generating referral code:', error);
      alert('Could not generate code. Please try again.');
    }
  };
}

// Copy Code button
if (copyCodeBtn) {
  copyCodeBtn.onclick = () => {
    const code = generatedCodeP?.textContent;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        copyCodeBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          copyCodeBtn.textContent = '📋 Copy Code';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy code. Please copy manually: ' + code);
      });
    }
  };
}

// Proceed with code button (after generating)
if (proceedWithCodeBtn) {
  proceedWithCodeBtn.onclick = () => {
    // Just proceed to continue button - code is already saved
    const details = document.querySelector('#referral-section details');
    if (details) details.open = false;
  };
}

// Enter Code button
const enterCodeBtn = document.getElementById('enter-code-btn');
const codeEntry = document.getElementById('code-entry');
const validateCodeBtn = document.getElementById('validate-code-btn');
const cancelEntryBtn = document.getElementById('cancel-entry-btn');
const friendCodeInput = document.getElementById('friend-code-input');
const validationMessage = document.getElementById('validation-message');

if (enterCodeBtn) {
  enterCodeBtn.onclick = () => {
    if (codeEntry) codeEntry.style.display = 'block';
    if (generateCodeBtn) generateCodeBtn.style.display = 'none';
    if (enterCodeBtn) enterCodeBtn.style.display = 'none';
  };
}

if (cancelEntryBtn) {
  cancelEntryBtn.onclick = () => {
    if (codeEntry) codeEntry.style.display = 'none';
    if (generateCodeBtn) generateCodeBtn.style.display = 'inline-block';
    if (enterCodeBtn) enterCodeBtn.style.display = 'inline-block';
    if (friendCodeInput) friendCodeInput.value = '';
    if (validationMessage) validationMessage.textContent = '';
  };
}

if (validateCodeBtn) {
  validateCodeBtn.onclick = async () => {
    const code = friendCodeInput?.value.trim().toLowerCase();

    if (!code) {
      if (validationMessage) validationMessage.textContent = '⚠️ Please enter a code';
      validationMessage.style.color = '#ff6666';
      return;
    }

    if (!currentUserId || !selected) {
      alert('Please select a name first.');
      return;
    }

    try {
      // Check if code exists
      const codeRef = ref(db, `referralCodes/${code}`);
      const codeSnap = await get(codeRef);

      if (!codeSnap.exists()) {
        if (validationMessage) {
          validationMessage.textContent = '❌ Invalid code';
          validationMessage.style.color = '#ff6666';
        }
        return;
      }

      const codeData = codeSnap.val();

      // Check if code is their own
      if (codeData.createdBy === currentUserId) {
        if (validationMessage) {
          validationMessage.textContent = '⚠️ You cannot use your own code';
          validationMessage.style.color = '#ff6666';
        }
        return;
      }

      // Check if already used
      if (codeData.used) {
        if (validationMessage) {
          validationMessage.textContent = '❌ This code has already been used';
          validationMessage.style.color = '#ff6666';
        }
        return;
      }

      // Check if expired
      if (codeData.expiresAt && codeData.expiresAt < Date.now()) {
        if (validationMessage) {
          validationMessage.textContent = '❌ This code has expired';
          validationMessage.style.color = '#ff6666';
        }
        return;
      }

      // Valid code! Mark as used and save to user
      await update(codeRef, {
        used: true,
        usedBy: currentUserId,
        usedAt: Date.now()
      });

      const userRef = ref(db, `users/${currentUserId}`);
      await update(userRef, {
        referralCodeID: code,
        referralMode: 'claiming'
      });

      if (validationMessage) {
        validationMessage.textContent = `✅ Code validated! You'll match with ${codeData.username}`;
        validationMessage.style.color = '#33ff33';
      }

      // Hide the form after success
      setTimeout(() => {
        if (codeEntry) codeEntry.style.display = 'none';
        const details = document.querySelector('#referral-section details');
        if (details) details.open = false;
      }, 2000);

    } catch (error) {
      console.error('Error validating code:', error);
      if (validationMessage) {
        validationMessage.textContent = '❌ Error validating code. Please try again.';
        validationMessage.style.color = '#ff6666';
      }
    }
  };
}

// Continue button logic - saves name and proceeds
const continueBtn = document.getElementById('continue-main-btn');
if (continueBtn) {
  continueBtn.onclick = async () => {
    if (!selected) {
      alert('Please pick a name first.');
      return;
    }

    if (!currentUserId) {
      alert('Authentication error. Please ensure you are logged in and refresh.');
      return;
    }

    const woobieName = `${selected.label} ${selected.emoji}`;

    localStorage.setItem('woobieUsername', woobieName);
    localStorage.setItem('woobieEmoji', selected.emoji);
    localStorage.setItem('woobieMode', selected.mode);
    localStorage.setItem('woobieUID', currentUserId);

    localStorage.removeItem('woobieSavedSets');
    localStorage.removeItem('woobieRerollCount');
    localStorage.removeItem('woobieModePref');

    const userProfileRef = ref(db, `users/${currentUserId}`);
    try {
      await update(userProfileRef, {
        username: woobieName,
        stage: 'interests-dealbreakers',
        currentMatch: {
            username: woobieName,
            stage: 'interests-dealbreakers',
        }
      });
      console.log(`User profile updated for ${currentUserId}. WoobieName: ${woobieName}. Next stage: interests-dealbreakers.`);
    } catch (error) {
      console.error("Error updating user profile with Woobie name and stage:", error);
      alert("Could not save your name choice. Please try again.");
      return;
    }

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