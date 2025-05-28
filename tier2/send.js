// send.js
import { db } from '../shared/firebase-config.js';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set, get, onValue, off } from 'firebase/database';

const storage = getStorage();

const username = localStorage.getItem('woobieUsername');
const matchID = localStorage.getItem('woobieMatchID');
const rewardRef = dbRef(db, `matches/${matchID}/tier2Rewards/${username}`);
const voteRef = dbRef(db, `matches/${matchID}/tier2Votes/${username}`);
const allRewardsRef = dbRef(db, `matches/${matchID}/tier2Rewards`);

const imageInput = document.getElementById('image-upload');
const previewCanvas = document.getElementById('chat-preview-canvas');
const contrastSlider = document.getElementById('chat-contrast');
const outputBlack = document.getElementById('output-black');
const outputWhite = document.getElementById('output-white');
const altInput = document.getElementById('chat-image-alt');
const colorButtons = document.querySelectorAll('.color-btn');
const sendBtn = document.getElementById('chat-send-upload');
const textInput = document.getElementById('reward-text');
const audioPreview = document.getElementById('audio-preview');
const statusMsg = document.getElementById('status-msg');

let ctx = previewCanvas?.getContext('2d') || null;
let originalImage = null;
let currentColor = '#33ff33';
let audioBlob = null;

let mediaRecorder = null;
let audioChunks = [];

const recordBtn = document.getElementById('start-recording');
const stopBtn = document.getElementById('stop-recording');
const playBtn = document.getElementById('play-audio');
const resetBtn = document.getElementById('reset-audio');
const recordingIndicator = document.getElementById('recording-indicator');
const submitBtn = document.getElementById('submit-reward');

if (recordBtn && stopBtn && playBtn && resetBtn && audioPreview && recordingIndicator) {
  recordBtn.onclick = async () => {
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
  };

  stopBtn.onclick = () => {
    mediaRecorder?.stop();
    recordingIndicator.style.display = 'none';
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  };

  playBtn.onclick = () => {
    audioPreview.play();
  };

  resetBtn.onclick = () => {
    audioBlob = null;
    audioPreview.src = '';
    audioPreview.style.display = 'none';
    playBtn.disabled = true;
    resetBtn.disabled = true;
  };
}

colorButtons.forEach(btn => {
  btn.onclick = () => {
    currentColor = btn.dataset.color;
    updateCanvas();
  };
});

[contrastSlider, outputBlack, outputWhite].forEach(slider => {
  if (slider) slider.oninput = updateCanvas;
});

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
          previewCanvas.width = w * 4;
          previewCanvas.height = h * 4;
          ctx?.drawImage(originalImage, 0, 0, previewCanvas.width, previewCanvas.height);
          updateCanvas();
        };
        resized.src = resizeCanvas.toDataURL();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  };
}

function updateCanvas() {
  if (!originalImage || !ctx) return;
  const { width, height } = previewCanvas;
  ctx.drawImage(originalImage, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const c = +contrastSlider.value;
  const ob = +outputBlack.value;
  const ow = +outputWhite.value;
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

if (sendBtn) {
  sendBtn.onclick = () => {
    alert('Image ready. Click "Finalize & Send All" to complete submission.');
  };
}

if (submitBtn) {
  submitBtn.onclick = async () => {
    if (!statusMsg) return;
    statusMsg.textContent = 'Uploading...';

    const uploads = [];
    const rewardData = {
      text: textInput?.value.trim() || null,
      alt: altInput?.value.trim() || '',
      imageURL: null,
      audioURL: null,
      timestamp: Date.now()
    };

    if (audioBlob) {
      const audioRef = sRef(storage, `tier2/${matchID}-${username}-audio.webm`);
      uploads.push(uploadBytes(audioRef, audioBlob).then(() =>
        getDownloadURL(audioRef).then(url => rewardData.audioURL = url)
      ));
    }

    if (originalImage) {
      const targetCanvas = document.createElement('canvas');
      targetCanvas.width = previewCanvas.width;
      targetCanvas.height = previewCanvas.height;
      const targetCtx = targetCanvas.getContext('2d');
      targetCtx.drawImage(previewCanvas, 0, 0);
      const blob = await new Promise(resolve => targetCanvas.toBlob(resolve, 'image/png'));

      const imageRef = sRef(storage, `tier2/${matchID}-${username}-image.png`);
      uploads.push(uploadBytes(imageRef, blob).then(() =>
        getDownloadURL(imageRef).then(url => rewardData.imageURL = url)
      ));
    }

    await Promise.all(uploads);
    await set(rewardRef, rewardData);
    await set(voteRef, true);

    statusMsg.textContent = '✅ Reward sent! Redirecting...';
    setTimeout(() => {
      window.location.href = '/tier2/reveal.html';
    }, 2000);
  };

  // Watch for both users to finish and auto-redirect
  onValue(allRewardsRef, snap => {
    const rewards = snap.val();
    if (rewards && Object.keys(rewards).length >= 2) {
      off(allRewardsRef);
      window.location.href = '/tier2/reveal.html';
    }
  });
}
