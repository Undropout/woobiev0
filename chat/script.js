// script.js - Fixed version with woobiecore emoji treatment
import { db, storage, auth } from '../shared/firebase-config.js';
import { ref as dbRef, push, onChildAdded, get, child, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';

// Wait for authentication before initializing
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to participate. Redirecting to login.");
    window.location.href = '/auth/login.html';
    return;
  }

  const currentUserId = user.uid;

  // Always fetch from database - never rely on localStorage
  const snap = await get(dbRef(db, `users/${currentUserId}/currentMatch`));
  const matchData = snap.val();

  console.log("[Chat] currentMatch data from database:", matchData);

  if (!matchData || !matchData.matchID || !matchData.username) {
    console.error("[Chat] Missing matchID or username in currentMatch:", matchData);
    alert("You must complete matching before entering chat.");
    window.location.href = "/name-picker/index.html";
    return;
  }

  const matchID = matchData.matchID;
  const username = matchData.username;
  console.log("[Chat] Initialized with matchID:", matchID, "username:", username);

  const chatRef = dbRef(db, `matches/${matchID}/chat`);
  const colorMode = localStorage.getItem('woobieMode') || 'normal';

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

  let ctx = null;
  if (previewCanvas) {
    ctx = previewCanvas.getContext('2d', { willReadFrequently: true });
  }
  let originalImage = null;
  let currentColor = '#33ff33';
  const modeMap = {};
  modeMap[username] = colorMode;

  // Emoji replacement function for woobiecore aesthetic
  function replaceEmojiWithMonochrome(text) {
    return text.replace(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu, (match) => {
      return `<span class="woobie-emoji">${match}</span>`;
    });
  }

  try {
    console.log('Checking user token claims...');
    let idTokenResult = await user.getIdTokenResult(false); // Check current token first
    console.log('Current token claims:', idTokenResult.claims);
    console.log('Current match access:', idTokenResult.claims.matchAccess);
    
    // If no matchAccess or current match not included, force refresh
    if (!idTokenResult.claims.matchAccess || !idTokenResult.claims.matchAccess.includes(matchID)) {
      console.log('Match access missing or incomplete. Forcing token refresh...');
      idTokenResult = await user.getIdTokenResult(true); // Force refresh
      console.log('Refreshed token claims:', idTokenResult.claims);
      console.log('Refreshed match access:', idTokenResult.claims.matchAccess);
    }
    
    console.log('Does user have access to this match?', 
      idTokenResult.claims.matchAccess && 
      idTokenResult.claims.matchAccess.includes(matchID)
    );
    
    // If still no access after refresh, there's a bigger problem
    if (!idTokenResult.claims.matchAccess || !idTokenResult.claims.matchAccess.includes(matchID)) {
      console.error('User still lacks access to match after token refresh. Backend issue?');
      alert('Authentication issue. Please try refreshing the page or logging out and back in.');
      return;
    }
  } catch (err) {
    console.error('Error getting ID token:', err);
    alert('Authentication error. Please try refreshing the page.');
    return;
  }

  get(dbRef(db, `matches/${matchID}/modes`)).then(snapshot => {
    const data = snapshot.val() || {};
    // The modes are stored with UIDs as keys, but we need to map them to usernames
    // First, get the users data to map UIDs to usernames
    return get(dbRef(db, `matches/${matchID}/users`));
  }).then(usersSnapshot => {
    const usersData = usersSnapshot.val() || {};
    // Now get the modes data
    return get(dbRef(db, `matches/${matchID}/modes`)).then(modesSnapshot => {
      const modesData = modesSnapshot.val() || {};
      
      // Map UIDs to usernames and then set the modes
      for (const [uid, woobieName] of Object.entries(usersData)) {
        if (modesData[uid] && modesData[uid].mode) {
          modeMap[woobieName] = modesData[uid].mode;
          console.log(`Set mode for ${woobieName}: ${modesData[uid].mode}`);
        }
      }
      
      console.log('Final modeMap:', modeMap);
    });
  }).catch(err => {
    console.error('Error loading modes:', err);
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
      // Apply emoji treatment to sparkles
      s.innerHTML = replaceEmojiWithMonochrome(s.textContent);
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
      try {
        // Force refresh token before upload
        await user.getIdToken(true);
        console.log('Token refreshed before upload');
        
        // Debug the blob properties
        console.log('Blob size:', blob.size, 'bytes');
        console.log('Blob type:', blob.type);
        console.log('Size limit check (512KB):', blob.size < 512 * 1024, '(should be true)');
        
        const filename = `${Date.now()}.png`;
        const path = `chat/${matchID}/${filename}`;
        console.log('Uploading to path:', path);
        console.log('Current user ID:', currentUserId);
        console.log('Match ID:', matchID);
        
        const imgRef = storageRef(storage, path);
        await uploadBytes(imgRef, blob);
        const url = await getDownloadURL(imgRef);
        
        // Include both senderUID and sender for database rules
        push(chatRef, {
          senderUID: currentUserId,  // Required by database rules
          sender: username,          // For display
          format: 'image',
          url,
          alt: altText,
          timestamp: Date.now()
        });
        
        modal.style.display = 'none';
        altInput.value = '';
        imageInput.value = '';
      } catch (err) {
        console.error('Image upload failed:', err);
        alert('Failed to upload image. Please try again.');
      }
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
      // Include both senderUID and sender for database rules
      push(chatRef, {
        senderUID: currentUserId,  // Required by database rules
        sender: username,          // For display
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
      // Apply emoji replacement to text messages
      const processedText = replaceEmojiWithMonochrome(msg.value);
      div.innerHTML = `<strong class="${modeClass}">${sender}</strong> [${time}]: ${processedText}`;
    } else if (msg.format === 'image') {
      // Apply emoji replacement to alt text of images if needed
      const processedAlt = replaceEmojiWithMonochrome(msg.alt);
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

  // Close modal handlers
  closeModalBtns.forEach(btn => {
    if (btn) {
      btn.onclick = () => {
        modal.style.display = 'none';
        altInput.value = '';
        imageInput.value = '';
      };
    }
  });
});