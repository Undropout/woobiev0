// chat/script.js
import { db, storage } from '../shared/firebase-config.js';
import { ref as dbRef, push, onChildAdded, get, child } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const username = localStorage.getItem('woobieUsername');
const matchID = localStorage.getItem('woobieMatchID');
const chatRef = dbRef(db, `matches/${matchID}/chat`);
const colorMode = localStorage.getItem('woobieMode') || 'normal'; // fixed key

const imageInput = document.getElementById('image-upload');
const previewCanvas = document.getElementById('chat-preview-canvas');
const altInput = document.getElementById('chat-image-alt');
const thresholdSlider = document.getElementById('chat-threshold');
const contrastSlider = document.getElementById('chat-contrast');
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

let ctx = null;
let originalImage = null;
let currentColor = '#33ff33';

if (previewCanvas) {
  ctx = previewCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
}

if (thresholdSlider && contrastSlider && previewCanvas && ctx) {
  thresholdSlider.oninput = updateCanvas;
  contrastSlider.oninput = updateCanvas;

  colorButtons.forEach(btn => {
    btn.onclick = () => {
      currentColor = btn.dataset.color;
      updateCanvas();
    };
  });

  closeModalBtns.forEach(btn => {
    btn.onclick = () => {
      modal.style.display = 'none';
      imageInput.value = '';
      altInput.value = '';
      originalImage = null;
    };
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
    targetCanvas.width = 128;
    targetCanvas.height = 128;
    const targetCtx = targetCanvas.getContext('2d');
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.drawImage(previewCanvas, 0, 0, 128, 128);

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
}

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
  const isMine = msg.sender === username;
  const isSystem = msg.sender === 'system';
  const isEmoji = msg.format === 'text' && /^::[^\s]{1,4}::$/.test(msg.value.trim());

  let color = '#33ff33';
  if (isSystem) color = '#00ffff';
  else if (isEmoji) color = '#ff66ff';
  else if (!isMine) color = '#ffcc33';

  const premiumModes = ['prismatic', 'neon', 'cosmic'];
  const modeClass = isMine && premiumModes.includes(colorMode) ? `woobie-${colorMode}` : '';

  if (msg.format === 'text') {
    div.innerHTML = `<span class="${modeClass}"><strong>${msg.sender}</strong> [${time}]: ${msg.value}</span>`;
  } else if (msg.format === 'image') {
    div.innerHTML = `<span class="${modeClass}"><strong>${msg.sender}</strong> [${time}]:</span><br><img src="${msg.url}" alt="${msg.alt}" class="chat-img" style="cursor: zoom-in; max-width:128px; max-height:128px; width:auto; height:auto;" />`;
    const imgEl = div.querySelector('img');
    imgEl.onclick = () => showZoomSimple(imgEl);
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

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

function showZoomSimple(imgElement) {
  modalImg.src = imgElement.src;
  modalImg.alt = imgElement.alt || '';
  modalImg.style.maxWidth = '512px';
  modalImg.style.maxHeight = '512px';
  imageZoomModal.style.display = 'flex';
  imageZoomModal.onclick = () => {
    imageZoomModal.style.display = 'none';
  };
}

window.insertEmote = symbol => {
  messageInput.value += symbol;
  messageInput.focus();
};

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

      const fullRef = dbRef(db, `matches/${matchID}/chat`);
      const snapshot = await get(fullRef);
      if (!snapshot.exists()) return;
      const chatData = snapshot.val();
      const chatDiv = document.createElement('div');
      chatDiv.innerHTML = '<details open><summary>💬 Chat History</summary>';
      Object.values(chatData).forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleString();
        const isMine = msg.sender === username;
        const premiumModes = ['prismatic', 'neon', 'cosmic'];
        const modeClass = isMine && premiumModes.includes(colorMode) ? `woobie-${colorMode}` : '';
        if (msg.format === 'text') {
          chatDiv.innerHTML += `<p class="${modeClass}"><strong>${msg.sender}</strong> [${time}]: ${msg.value}</p>`;
        } else if (msg.format === 'image') {
          chatDiv.innerHTML += `<p class="${modeClass}"><strong>${msg.sender}</strong> [${time}]:<br><img src="${msg.url}" alt="${msg.alt}" style="max-width:128px; image-rendering: pixelated;"></p>`;
        }
      });
      chatDiv.innerHTML += '</details>';
      historyContent.appendChild(chatDiv);

    } catch (err) {
      console.error(err);
      historyContent.innerHTML = '<p>Error loading history.</p>';
    }
  };

  closeHistoryBtn.onclick = () => {
    historyModal.style.display = 'none';
  };
}
