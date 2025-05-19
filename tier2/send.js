// send.js
import { db, storage } from '../shared/firebase-config.js';
import { ref as dbRef, set } from 'firebase/database';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';

let username = localStorage.getItem('woobieUsername');
let matchID = localStorage.getItem('woobieMatchID');

const textInput = document.getElementById('reward-text');
const imageInput = document.getElementById('image-upload');
const previewCanvas = document.getElementById('preview-canvas');
const ctx = previewCanvas.getContext('2d');
const thresholdSlider = document.getElementById('threshold');
const contrastSlider = document.getElementById('contrast');
const colorButtons = document.querySelectorAll('.color-btn');
const altInput = document.getElementById('image-alt');
const editor = document.getElementById('image-editor');
const statusMsg = document.getElementById('status-msg');

let originalImage = null;
let currentColor = '#33ff33';
let audioBlob = null;
let mediaRecorder = null;
let audioChunks = [];

colorButtons.forEach(btn => {
  btn.onclick = () => {
    currentColor = btn.dataset.color;
    updateCanvas();
  };
});

thresholdSlider.oninput = updateCanvas;
contrastSlider.oninput = updateCanvas;

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
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(originalImage, 0, 0, previewCanvas.width, previewCanvas.height);
        editor.style.display = 'block';
        updateCanvas();
      };
      resized.src = resizeCanvas.toDataURL();
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
};

function updateCanvas() {
  if (!originalImage || !ctx) return;
  const { width, height } = previewCanvas;
  ctx.drawImage(originalImage, 0, 0, width, height);
  let imageData = ctx.getImageData(0, 0, width, height);
  let data = imageData.data;
  const t = +thresholdSlider.value;
  const c = +contrastSlider.value;
  const { r, g, b } = hexToRgb(currentColor);

  for (let i = 0; i < data.length; i += 4) {
    let v = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    v = (((v - 128) * (c / 100 + 1)) + 128);
    const isOn = v > t;
    data[i] = isOn ? r : 0;
    data[i + 1] = isOn ? g : 0;
    data[i + 2] = isOn ? b : 0;
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

const startBtn = document.getElementById('start-recording');
const stopBtn = document.getElementById('stop-recording');
const playBtn = document.getElementById('play-audio');
const resetBtn = document.getElementById('reset-audio');
const previewAudio = document.getElementById('audio-preview');
const lofiToggle = document.getElementById('lofi-toggle');
const recordingMsg = document.createElement('p');
recordingMsg.textContent = '🎙️ RECORDING IN PROGRESS...';
recordingMsg.style.color = '#ff66ff';
recordingMsg.style.animation = 'flash 1s infinite';
recordingMsg.id = 'recording-status';

startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = () => {
    audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    previewAudio.src = URL.createObjectURL(audioBlob);
    previewAudio.style.display = 'block';
    playBtn.disabled = false;
    resetBtn.disabled = false;
    const old = document.getElementById('recording-status');
    if (old) old.remove();
  };
  mediaRecorder.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  submitBtn.parentNode.insertBefore(recordingMsg, submitBtn);
};

stopBtn.onclick = () => {
  mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

playBtn.onclick = () => {
  previewAudio.play();
};

resetBtn.onclick = () => {
  audioBlob = null;
  previewAudio.src = '';
  previewAudio.style.display = 'none';
  playBtn.disabled = true;
  resetBtn.disabled = true;
};

const submitBtn = document.getElementById('submit-reward');
submitBtn.onclick = async () => {
  statusMsg.textContent = 'Uploading...';
  const rewardRef = dbRef(db, `matches/${matchID}/tier2Rewards/${username}`);
  const uploads = [];

  const text = textInput.value.trim();
  let audioURL = null;
  let imageURL = null;

  if (audioBlob) {
    const audioRef = sRef(storage, `tier2/${matchID}-${username}-audio.webm`);
    const audioBuf = lofiToggle.checked ? await applyLofi(audioBlob) : audioBlob;
    uploads.push(uploadBytes(audioRef, audioBuf).then(() => getDownloadURL(audioRef).then(url => audioURL = url)));
  }

  if (originalImage) {
    const alt = altInput.value.trim();
    const imgRef = sRef(storage, `tier2/${matchID}-${username}-image.png`);
    const blob = await new Promise(res => previewCanvas.toBlob(res, 'image/png'));
    uploads.push(uploadBytes(imgRef, blob).then(() => getDownloadURL(imgRef).then(url => imageURL = url)));
  }

  await Promise.all(uploads);

  await set(rewardRef, {
    text: text || null,
    imageURL: imageURL || null,
    audioURL: audioURL || null,
    alt: altInput.value.trim() || '',
    timestamp: Date.now()
  });

  statusMsg.textContent = '✅ Reward sent!';
  submitBtn.disabled = true;
};

async function applyLofi(blob) {
  const context = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await context.decodeAudioData(arrayBuffer);
  const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  const src = offline.createBufferSource();
  src.buffer = buffer;
  const biquad = offline.createBiquadFilter();
  biquad.type = 'lowpass';
  biquad.frequency.value = 3000;

  src.connect(biquad);
  biquad.connect(offline.destination);
  src.start();

  const rendered = await offline.startRendering();
  const finalCtx = new OfflineAudioContext(rendered.numberOfChannels, rendered.length, rendered.sampleRate);
  const outSrc = finalCtx.createBufferSource();
  outSrc.buffer = rendered;
  outSrc.connect(finalCtx.destination);
  outSrc.start();

  const result = await finalCtx.startRendering();
  return bufferToBlob(result);
}

function bufferToBlob(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2;
  const bufferData = new ArrayBuffer(44 + length);
  const view = new DataView(bufferData);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeStr(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
  view.setUint16(32, buffer.numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample * 32767, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

const style = document.createElement('style');
style.textContent = `
@keyframes flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}`;
document.head.appendChild(style);
