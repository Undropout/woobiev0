// send.js - Debug version
import { db, auth } from '../shared/firebase-config.js';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set, get, onValue, off, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

const storage = getStorage();

let ctx = null;
let originalImage = null;
let currentColor = '#33ff33';
let audioBlob = null;
let mediaRecorder = null;
let audioChunks = [];

// Main logic wrapped in onAuthStateChanged
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to participate. Redirecting to login.");
    window.location.href = '/auth/login.html';
    return;
  }

  const currentUserId = user.uid;
  const matchID = localStorage.getItem('woobieMatchID');
  const localWoobieUsername = localStorage.getItem('woobieUsername');

  if (!matchID || !localWoobieUsername) {
    alert("Missing critical session data (Match ID or Woobie Name). Please restart.");
    window.location.href = '/name-picker/index.html';
    return;
  }

  console.log(`[Tier2 Send INIT] MatchID: ${matchID}, UserID: ${currentUserId}, WoobieName: ${localWoobieUsername}`);

  // Debug: Check user's custom claims
  try {
    const idTokenResult = await user.getIdTokenResult(true); // Force refresh
    console.log('User custom claims:', idTokenResult.claims);
    console.log('Match access claims:', idTokenResult.claims.matchAccess);
    console.log('Does user have access to this match?', 
      idTokenResult.claims.matchAccess && 
      idTokenResult.claims.matchAccess.includes(matchID)
    );
  } catch (err) {
    console.error('Error getting ID token:', err);
  }

  // Update user's current stage
  const userMatchProgressRef = dbRef(db, `users/${currentUserId}/currentMatch`);
  update(userMatchProgressRef, { stage: 'tier2-send' });

  // Database references using UID as keys
  const rewardRef = dbRef(db, `matches/${matchID}/tier2Rewards/${currentUserId}`);
  const voteRef = dbRef(db, `matches/${matchID}/tier2Votes/${currentUserId}`);
  const allRewardsRef = dbRef(db, `matches/${matchID}/tier2Rewards`);

  // Get DOM elements
  const imageInput = document.getElementById('image-upload');
  const previewCanvas = document.getElementById('chat-preview-canvas');
  const contrastSlider = document.getElementById('chat-contrast');
  const outputBlack = document.getElementById('output-black');
  const outputWhite = document.getElementById('output-white');
  const altInput = document.getElementById('chat-image-alt');
  const colorButtons = document.querySelectorAll('.color-btn');
  const textInput = document.getElementById('reward-text');
  const audioPreview = document.getElementById('audio-preview');
  const statusMsg = document.getElementById('status-msg');

  const recordBtn = document.getElementById('start-recording');
  const stopBtn = document.getElementById('stop-recording');
  const playBtn = document.getElementById('play-audio');
  const resetBtn = document.getElementById('reset-audio');
  const recordingIndicator = document.getElementById('recording-indicator');
  const submitBtn = document.getElementById('submit-reward');

  // Set up canvas context
  if (previewCanvas) {
    ctx = previewCanvas.getContext('2d', { willReadFrequently: true });
  }

  // Audio recording setup
  if (recordBtn && stopBtn && playBtn && resetBtn && audioPreview && recordingIndicator) {
    recordBtn.onclick = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          audioPreview.src = URL.createObjectURL(audioBlob);
          audioPreview.style.display = 'block';
          playBtn.disabled = false;
          resetBtn.disabled = false;
        };
        mediaRecorder.start();
        recordingIndicator.style.display = 'block';
        recordBtn.disabled = true;
        stopBtn.disabled = false;
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access microphone. Please check your permissions.');
      }
    };

    stopBtn.onclick = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordingIndicator.style.display = 'none';
        recordBtn.disabled = false;
        stopBtn.disabled = true;
      }
    };

    playBtn.onclick = () => {
      if (audioPreview.src) {
        audioPreview.play();
      }
    };

    resetBtn.onclick = () => {
      audioBlob = null;
      audioPreview.src = '';
      audioPreview.style.display = 'none';
      playBtn.disabled = true;
      resetBtn.disabled = true;
    };
  }

  // Color button setup
  if (colorButtons) {
    colorButtons.forEach(btn => {
      btn.onclick = () => {
        currentColor = btn.dataset.color;
        updateCanvas();
      };
    });
  }

  // Slider setup
  [contrastSlider, outputBlack, outputWhite].forEach(slider => {
    if (slider) slider.oninput = updateCanvas;
  });

  // Image upload setup
  if (imageInput) {
    imageInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        const img = new Image();
        img.onload = () => {
          const longEdge = Math.max(img.width, img.height);
          const scale = 128 / longEdge;
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = w;
          resizeCanvas.height = h;
          const resizeCtx = resizeCanvas.getContext('2d');
          resizeCtx.drawImage(img, 0, 0, w, h);

          const resized = new Image();
          resized.onload = () => {
            originalImage = resized;
            if (previewCanvas && ctx) {
              previewCanvas.width = w * 4;
              previewCanvas.height = h * 4;
              ctx.drawImage(originalImage, 0, 0, previewCanvas.width, previewCanvas.height);
              updateCanvas();
            }
          };
          resized.src = resizeCanvas.toDataURL();
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  function updateCanvas() {
    if (!originalImage || !ctx || !previewCanvas) return;
    const { width, height } = previewCanvas;
    ctx.drawImage(originalImage, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const c = contrastSlider ? +contrastSlider.value : 0;
    const ob = outputBlack ? +outputBlack.value : 0;
    const ow = outputWhite ? +outputWhite.value : 255;
    const { r, g, b } = hexToRgb(currentColor);

    for (let i = 0; i < data.length; i += 4) {
      let v = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      v = (((v - 128) * (c / 100 + 1)) + 128);
      v = Math.max(0, Math.min(255, v));
      const scaled = ((v - 0) / 255) * (ow - ob) + ob;
      let level = Math.floor(scaled / 64);
      level = Math.max(0, Math.min(3, level));
      const tint = [0, 85, 170, 255][level];
      data[i] = (tint / 255) * r;
      data[i + 1] = (tint / 255) * g;
      data[i + 2] = (tint / 255) * b;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  if (submitBtn) {
    submitBtn.onclick = async () => {
      if (!statusMsg) return;
      statusMsg.textContent = 'Uploading...';
      statusMsg.style.color = '#33ff33';

      try {
        // Force refresh the token before uploading to ensure latest claims
        await user.getIdToken(true);
        console.log('Token refreshed before upload');

        const uploads = [];
        const rewardData = {
          text: textInput?.value.trim() || null,
          alt: altInput?.value.trim() || '',
          imageURL: null,
          audioURL: null,
          timestamp: Date.now(),
          woobieName: localWoobieUsername
        };

        // Upload audio if present
        if (audioBlob) {
          console.log(`Attempting to upload audio to: tier2/${matchID}/${currentUserId}-audio.webm`);
          const audioRef = sRef(storage, `tier2/${matchID}/${currentUserId}-audio.webm`);
          uploads.push(uploadBytes(audioRef, audioBlob).then(() =>
            getDownloadURL(audioRef).then(url => rewardData.audioURL = url)
          ).catch(err => {
            console.error('Audio upload failed:', err);
            throw err;
          }));
        }

        // Upload image if present
        if (originalImage && previewCanvas && ctx) {
          console.log(`Attempting to upload image to: tier2/${matchID}/${currentUserId}-image.png`);
          const targetCanvas = document.createElement('canvas');
          targetCanvas.width = previewCanvas.width;
          targetCanvas.height = previewCanvas.height;
          const targetCtx = targetCanvas.getContext('2d');
          targetCtx.drawImage(previewCanvas, 0, 0);
          const blob = await new Promise(resolve => targetCanvas.toBlob(resolve, 'image/png'));

          const imageRef = sRef(storage, `tier2/${matchID}/${currentUserId}-image.png`);
          uploads.push(uploadBytes(imageRef, blob).then(() =>
            getDownloadURL(imageRef).then(url => rewardData.imageURL = url)
          ).catch(err => {
            console.error('Image upload failed:', err);
            throw err;
          }));
        }

        // Wait for all uploads to complete
        console.log('Starting uploads...');
        await Promise.all(uploads);
        console.log('All uploads completed successfully');

        // Save reward data to database using UID
        await set(rewardRef, rewardData);
        await set(voteRef, true);

        // Update user stage
        await update(userMatchProgressRef, { stage: 'tier2-reward-sent' });

        statusMsg.textContent = '✅ Reward sent! Redirecting...';
        statusMsg.style.color = '#33ff33';
        setTimeout(() => {
          window.location.href = '/tier2/reveal.html';
        }, 2000);

      } catch (err) {
        console.error('Error submitting reward:', err);
        if (statusMsg) {
          statusMsg.textContent = `❌ Error uploading: ${err.message}`;
          statusMsg.style.color = '#ff6666';
        }
      }
    };
  }

  // Watch for both users to finish and auto-redirect
  onValue(allRewardsRef, snap => {
    const rewards = snap.val();
    if (rewards && Object.keys(rewards).length >= 2) {
      off(allRewardsRef);
      window.location.href = '/tier2/reveal.html';
    }
  });
});