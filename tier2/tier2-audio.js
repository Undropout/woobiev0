export function injectAudioControls(audioPreview) {
    if (!audioPreview) return;
  
    const startBtn = document.createElement('button');
    const stopBtn = document.createElement('button');
    const playBtn = document.createElement('button');
    const rerecordBtn = document.createElement('button');
    const recordingIndicator = document.createElement('div');
    const effectToggleLabel = document.createElement('label');
    const effectToggle = document.createElement('input');
  
    startBtn.textContent = '🎙️ Start Recording';
    stopBtn.textContent = '⏹️ Stop';
    playBtn.textContent = '▶️ Play';
    rerecordBtn.textContent = '🔁 Re-record';
    recordingIndicator.textContent = '● Recording...';
    recordingIndicator.style.display = 'none';
    recordingIndicator.style.color = '#ff4444';
    recordingIndicator.style.fontWeight = 'bold';
    recordingIndicator.style.animation = 'blink 1s infinite';
    recordingIndicator.style.width = '100%';
    recordingIndicator.style.textAlign = 'center';
    recordingIndicator.style.margin = '0.5rem auto';
  
    const style = document.createElement('style');
    style.textContent = `@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`;
    document.head.appendChild(style);
  
    [startBtn, stopBtn, playBtn, rerecordBtn].forEach(btn => {
      btn.style.margin = '0.5rem';
      btn.style.border = '2px solid #33ff33';
      btn.style.background = 'black';
      btn.style.color = '#33ff33';
      btn.style.fontFamily = 'Atkinson Hyperlegible';
      btn.style.cursor = 'pointer';
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-pressed', 'false');
    });
  
    effectToggle.type = 'checkbox';
    effectToggle.checked = true;
    effectToggle.id = 'audio-effect-toggle';
    effectToggle.style.marginLeft = '0.5rem';
  
    effectToggleLabel.textContent = ' Vintage Audio Style';
    effectToggleLabel.setAttribute('for', 'audio-effect-toggle');
    effectToggleLabel.style.color = '#33ff33';
    effectToggleLabel.style.marginTop = '1rem';
    effectToggleLabel.style.fontFamily = 'Atkinson Hyperlegible';
    effectToggleLabel.prepend(effectToggle);
  
    stopBtn.disabled = true;
    playBtn.disabled = true;
    rerecordBtn.disabled = true;
  
    const audioControls = document.createElement('div');
    audioControls.id = 'audio-controls';
    audioControls.style.display = 'flex';
    audioControls.style.flexDirection = 'column';
    audioControls.style.alignItems = 'center';
    audioControls.style.marginBottom = '1rem';
  
    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.flexWrap = 'wrap';
    buttonRow.style.justifyContent = 'center';
  
    buttonRow.appendChild(startBtn);
    buttonRow.appendChild(stopBtn);
    buttonRow.appendChild(playBtn);
    buttonRow.appendChild(rerecordBtn);
    audioControls.appendChild(recordingIndicator);
    audioControls.appendChild(buttonRow);
    audioControls.appendChild(effectToggleLabel);
    audioPreview.parentNode.insertBefore(audioControls, audioPreview.nextSibling);
  
    let mediaRecorder, chunks = [], audioBlob = null;
    let recordingTimeout;
  
    async function applyVintageEffect(blob) {
      if (!effectToggle.checked) return blob;
  
      const audioContext = new AudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
  
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.8;
  
      const biquadFilter = audioContext.createBiquadFilter();
      biquadFilter.type = 'lowshelf';
      biquadFilter.frequency.setValueAtTime(1000, audioContext.currentTime);
      biquadFilter.gain.setValueAtTime(-10, audioContext.currentTime);
  
      const crackleBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
      const crackle = crackleBuffer.getChannelData(0);
      for (let i = 0; i < crackle.length; i++) {
        if (Math.random() < 0.002) crackle[i] = (Math.random() * 2 - 1) * 0.25;
      }
      const crackleSource = audioContext.createBufferSource();
      crackleSource.buffer = crackleBuffer;
  
      const dest = audioContext.createMediaStreamDestination();
      source.connect(biquadFilter).connect(gainNode).connect(dest);
      crackleSource.connect(dest);
      source.start();
      crackleSource.start();
  
      return new Promise(resolve => {
        const recorder = new MediaRecorder(dest.stream);
        const recordedChunks = [];
        recorder.ondataavailable = e => recordedChunks.push(e.data);
        recorder.onstop = () => {
          const newBlob = new Blob(recordedChunks, { type: 'audio/webm' });
          resolve(newBlob);
        };
        recorder.start();
        setTimeout(() => {
          recorder.stop();
          audioContext.close();
        }, audioBuffer.duration * 1000);
      });
    }
  
    startBtn.onclick = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
  
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(chunks, { type: 'audio/webm' });
        const processedBlob = await applyVintageEffect(rawBlob);
        audioBlob = processedBlob;
  
        const url = URL.createObjectURL(audioBlob);
        audioPreview.src = url;
        audioPreview.style.display = 'block';
        playBtn.disabled = false;
        rerecordBtn.disabled = false;
        recordingIndicator.style.display = 'none';
      };
  
      mediaRecorder.start();
      startBtn.disabled = true;
      stopBtn.disabled = false;
      recordingIndicator.style.display = 'block';
  
      recordingTimeout = setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          alert("Recording stopped after 2 minutes to conserve memory. You're doing great 💚");
        }
      }, 120000);
    };
  
    stopBtn.onclick = () => {
      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
        clearTimeout(recordingTimeout);
        stopBtn.disabled = true;
      }
    };
  
    playBtn.onclick = () => {
      audioPreview.play();
    };
  
    rerecordBtn.onclick = () => {
      audioPreview.src = '';
      audioPreview.style.display = 'none';
      audioBlob = null;
      startBtn.disabled = false;
      playBtn.disabled = true;
      rerecordBtn.disabled = true;
    };
  
    window.getFinalAudioBlob = () => audioBlob;
  }
  