// script.js
import { db, storage } from '../shared/firebase-config.js';
import { ref as dbRef, push, onChildAdded, get, child, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const username = localStorage.getItem('woobieUsername');
const matchID = localStorage.getItem('woobieMatchID');
const chatRef = dbRef(db, `matches/${matchID}/chat`);
const colorMode = localStorage.getItem('woobieMode') || 'normal';

if (!username || !matchID) {
  alert("You must complete matching before entering chat.");
  window.location.href = "/index.html";
}

const imageInput = document.getElementById('image-upload');
const previewCanvas = document.getElementById('chat-preview-canvas');
const contrastSlider = document.getElementById('chat-contrast');
const outputBlack = document.getElementById('output-black');
const outputWhite = document.getElementById('output-white');
const altInput = document.getElementById('chat-image-alt');
const colorButtons = document.querySelectorAll('.color-btn');
const modal = document.getElementById('image-adjust-modal');
const closeModalBtns = [
  document.getElementById('chat-cancel-upload'),
  ...document.querySelectorAll('.close-adjust')
];
const sendBtn = document.getElementById('chat-send-upload');
const messageInput = document.getElementById('message');
const messagesDiv = document.getElementById('messages');
const sendTextBtn = document.getElementById('send-btn');
const imageZoomModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const historyBtn = document.getElementById('history-btn');
const historyModal = document.getElementById('history-modal');
const historyContent = document.getElementById('history-content');
const closeHistoryBtn = document.getElementById('close-history');

let ctx = previewCanvas.getContext('2d');
let originalImage = null;
let currentColor = '#33ff33';
const modeMap = {};
modeMap[username] = colorMode;

const lockRef = dbRef(db, `matches/${matchID}/locked`);
get(lockRef).then(snap => {
  if (!snap.exists()) set(lockRef, true);
});

get(dbRef(db, `matches/${matchID}/modes`)).then(snapshot => {
  const data = snapshot.val() || {};
  for (const [name, { mode }] of Object.entries(data)) {
    modeMap[name] = mode || 'normal';
  }
});

function addCosmicSparkles(element) {
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.className = 'trail-sparkle';
    s.textContent = '✨';
    s.style.position = 'absolute';
    s.style.top = `${Math.random() * 100 - 30}%`;
    s.style.left = `${Math.random() * 100 - 30}%`;
    s.style.animationDelay = `${Math.random() * 2}s`;
    element.appendChild(s);
  }
}

colorButtons.forEach(btn => {
  btn.onclick = () => {
    currentColor = btn.dataset.color;
    updateCanvas();
  };
});

[contrastSlider, outputBlack, outputWhite].forEach(slider => {
  slider.oninput = updateCanvas;
});

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
        ctx.drawImage(originalImage, 0, 0, previewCanvas.width, previewCanvas.height);
        modal.style.display = 'block';
        updateCanvas();
      };
      resized.src = resizeCanvas.toDataURL();
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
};

sendBtn.onclick = () => {
  const altText = altInput.value.trim();
  if (!altText) return alert("Please add alt text");

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = previewCanvas.width;
  targetCanvas.height = previewCanvas.height;
  const targetCtx = targetCanvas.getContext('2d');
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(previewCanvas, 0, 0);

  targetCanvas.toBlob(async blob => {
    const path = `chat/${matchID}/${Date.now()}.png`;
    const imgRef = storageRef(storage, path);
    await uploadBytes(imgRef, blob);
    const url = await getDownloadURL(imgRef);
    push(chatRef, {
      sender: username,
      format: 'image',
      url,
      alt: altText,
      timestamp: Date.now()
    });
    modal.style.display = 'none';
    altInput.value = '';
    imageInput.value = '';
  }, 'image/png');
};

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

function showZoomSimple(imgElement) {
  modalImg.src = imgElement.src;
  modalImg.alt = imgElement.alt || '';
  modalImg.style.maxWidth = '384px';
  modalImg.style.maxHeight = '384px';
  imageZoomModal.style.display = 'flex';
  imageZoomModal.onclick = () => {
    imageZoomModal.style.display = 'none';
  };
}

window.insertEmote = symbol => {
  messageInput.value += symbol;
  messageInput.focus();
};

if (sendTextBtn && messageInput) {
  sendTextBtn.onclick = sendMessage;
  messageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function sendMessage() {
  const text = messageInput.value.trim();
  if (text) {
    push(chatRef, {
      sender: username,
      format: 'text',
      value: text,
      timestamp: Date.now()
    });
    messageInput.value = '';
  }
}

onChildAdded(chatRef, snap => {
  const msg = snap.val();
  const div = document.createElement('div');
  div.className = 'message';

  const time = new Date(msg.timestamp).toLocaleString();
  const sender = msg.sender;
  const senderMode = modeMap[sender] || 'normal';
  const modeClass = `woobie-${senderMode}`;

  if (msg.format === 'text') {
    div.innerHTML = `<strong class="${modeClass}">${sender}</strong> [${time}]: ${msg.value}`;
  } else if (msg.format === 'image') {
    div.innerHTML = `<strong class="${modeClass}">${sender}</strong> [${time}]:<br><img src="${msg.url}" alt="${msg.alt}" class="chat-img" style="cursor: zoom-in; max-width:128px; height:auto;" />`;
    const imgEl = div.querySelector('img');
    imgEl.onclick = () => showZoomSimple(imgEl);
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  if (senderMode === 'cosmic') {
    const el = div.querySelector(`.${modeClass}`);
    if (el) addCosmicSparkles(el);
  }
});

if (historyBtn && historyModal && closeHistoryBtn) {
  historyModal.style.display = 'none';

  historyBtn.onclick = async () => {
    historyModal.style.display = 'flex';
    historyContent.innerHTML = '<div style="color:#33ff33;font-family:monospace"><h3>Loading full history...</h3></div>';

    try {
      const iframe = document.createElement('iframe');
      iframe.src = '/shared/history.html';
      iframe.style.width = '100%';
      iframe.style.height = '80vh';
      iframe.style.border = '1px solid #33ff33';
      iframe.style.backgroundColor = 'black';
      historyContent.innerHTML = '';
      historyContent.appendChild(iframe);
    } catch (err) {
      console.error(err);
      historyContent.innerHTML = '<p>Error loading history.</p>';
    }
  };

  closeHistoryBtn.onclick = () => {
    historyModal.style.display = 'none';
  };
}
