// Perfect-fit viewer with display-mode dropdown (fill, fit, stretch, original, smart).
// Copy this file in place of previous app.js.

const deviceSelect = document.getElementById('deviceSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const fpsSelect = document.getElementById('fpsSelect');
const displayMode = document.getElementById('displayMode');

const startBtn = document.getElementById('startBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const mirrorBtn = document.getElementById('mirrorBtn');
const pipBtn = document.getElementById('pipBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreen');
const statusEl = document.getElementById('status');

const viewer = document.getElementById('viewer');
const video = document.getElementById('video');
const canvas = document.getElementById('captureCanvas');

let currentStream = null;
let mirrored = false;
let manualScale = 1;
let manualOffset = { x: 0, y: 0 };

// small helper for status
function setStatus(txt) { statusEl.textContent = txt || ''; }

// Ensure device labels visible (request minimal permission)
async function ensurePermission() {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (e) {
    // user might deny; enumerateDevices will still return deviceIds but labels may be hidden
    console.debug('Permission for labels not granted:', e);
  }
}

// Populate video input dropdown
async function listDevices() {
  await ensurePermission();
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter(d => d.kind === 'videoinput');
  deviceSelect.innerHTML = '';
  if (inputs.length === 0) {
    const o = document.createElement('option'); o.value = ''; o.text = 'No video input found'; deviceSelect.appendChild(o);
    setStatus('No video inputs detected. Check connection and HDMI source.');
    return;
  }
  inputs.forEach(d => {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.text = d.label || `Camera ${d.deviceId.slice(0,6)}`;
    deviceSelect.appendChild(o);
  });
  setStatus('');
}

// Start stream with chosen device/resolution/fps
async function startStream() {
  if (!deviceSelect.value) { setStatus('Select a device'); return; }

  if (currentStream) currentStream.getTracks().forEach(t => t.stop());

  const [w, h] = resolutionSelect.value.split('x').map(Number);
  const fps = Number(fpsSelect.value || 30);

  const constraints = {
    video: {
      deviceId: { exact: deviceSelect.value },
      width: { ideal: w },
      height: { ideal: h },
      frameRate: { ideal: fps }
    },
    audio: false
  };

  try {
    setStatus('Requesting stream…');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    video.srcObject = stream;
    video.muted = true;
    video.onloadedmetadata = () => {
      video.play().catch(()=>{});
      // reset manual adjustments and compute layout
      manualScale = 1; manualOffset = { x: 0, y: 0 };
      applyDisplayMode();
      setStatus('Streaming');
    };
    const track = stream.getVideoTracks()[0];
    track.onended = () => setStatus('Video track ended — check device/HDMI source.');
  } catch (err) {
    console.error(err);
    setStatus('Failed to start stream: ' + (err && err.message ? err.message : err));
  }
}

// Compute and apply layout according to selected display mode
function applyDisplayMode() {
  const mode = displayMode.value || 'smart';
  // video intrinsic size (fallback to selected resolution if missing)
  const vW = video.videoWidth || parseInt(resolutionSelect.value.split('x')[0]) || 1280;
  const vH = video.videoHeight || parseInt(resolutionSelect.value.split('x')[1]) || 720;
  const viewW = viewer.clientWidth;
  const viewH = viewer.clientHeight;
  if (!viewW || !viewH) return;

  // helper that sizes video element to desired width/height and centers/pans
  function setVideoSize(targetW, targetH) {
    const finalW = Math.round(targetW * manualScale);
    const finalH = Math.round(targetH * manualScale);
    const left = Math.round((viewW - finalW) / 2 + manualOffset.x);
    const top = Math.round((viewH - finalH) / 2 + manualOffset.y);
    video.style.width = finalW + 'px';
    video.style.height = finalH + 'px';
    video.style.left = left + 'px';
    video.style.top = top + 'px';
    video.style.objectFit = 'none'; // we manage sizing manually (except stretch)
    video.style.transform = mirrored ? 'scaleX(-1)' : 'none';
  }

  // choose behavior
  if (mode === 'stretch') {
    // stretch to exactly fit viewer (may distort)
    video.style.left = '0px'; video.style.top = '0px';
    video.style.width = viewW + 'px';
    video.style.height = viewH + 'px';
    video.style.objectFit = 'fill';
    video.style.transform = mirrored ? 'scaleX(-1)' : 'none';
    return;
  }

  if (mode === 'original') {
    // native pixel size, centered
    setVideoSize(vW, vH);
    return;
  }

  const scaleCover = Math.max(viewW / vW, viewH / vH);   // fills viewer (crop)
  const scaleContain = Math.min(viewW / vW, viewH / vH); // fits inside viewer (bars)

  // Smart: choose the one with minimal letterboxing while trying to avoid excessive crop.
  if (mode === 'smart') {
    // If capture aspect is close to viewer aspect, use cover; otherwise prefer fit to avoid excessive crop.
    const videoRatio = vW / vH;
    const viewRatio = viewW / viewH;
    const ratioDiff = Math.abs(videoRatio - viewRatio) / Math.max(videoRatio, viewRatio);
    if (ratioDiff < 0.08) { // similar aspect -> cover
      setVideoSize(vW * scaleCover, vH * scaleCover);
    } else {
      // prefer cover to avoid black bars by default; but if difference is large, prefer fit
      if (ratioDiff < 0.2) setVideoSize(vW * scaleCover, vH * scaleCover);
      else setVideoSize(vW * scaleContain, vH * scaleContain);
    }
    return;
  }

  if (mode === 'fill') {
    setVideoSize(vW * scaleCover, vH * scaleCover);
    return;
  }

  if (mode === 'fit') {
    setVideoSize(vW * scaleContain, vH * scaleContain);
    return;
  }

  // fallback - fill
  setVideoSize(vW * scaleCover, vH * scaleCover);
}

// Reset view adjustments
function resetView() {
  manualScale = 1;
  manualOffset = { x: 0, y: 0 };
  applyDisplayMode();
}

// Mouse/touch interactions: wheel -> zoom, drag -> pan
let dragging = false;
let dragStart = null;

viewer.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const delta = -ev.deltaY * 0.0015;
  manualScale = Math.min(Math.max(0.5, manualScale + delta), 6);
  applyDisplayMode();
}, { passive: false });

viewer.addEventListener('pointerdown', (ev) => {
  dragging = true;
  dragStart = { x: ev.clientX, y: ev.clientY, offX: manualOffset.x, offY: manualOffset.y };
  viewer.setPointerCapture(ev.pointerId);
});
viewer.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  const dx = ev.clientX - dragStart.x;
  const dy = ev.clientY - dragStart.y;
  manualOffset.x = dragStart.offX + dx;
  manualOffset.y = dragStart.offY + dy;
  applyDisplayMode();
});
viewer.addEventListener('pointerup', (ev) => {
  dragging = false;
  try { viewer.releasePointerCapture(ev.pointerId); } catch(_) {}
});

// keyboard shortcuts
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'f' || ev.key === 'F') viewer.requestFullscreen().catch(()=>{});
  else if (ev.key === 'Escape') { if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }
  else if (ev.key === 'm' || ev.key === 'M') { mirrored = !mirrored; applyDisplayMode(); }
  else if (ev.key === 's' || ev.key === 'S') screenshot();
  else if (ev.key === 'r' || ev.key === 'R') resetView();
  else if (ev.key === '1') { displayMode.value = 'fill'; applyDisplayMode(); }
  else if (ev.key === '2') { displayMode.value = 'fit'; applyDisplayMode(); }
  else if (ev.key === '3') { displayMode.value = 'stretch'; applyDisplayMode(); }
  else if (ev.key === '4') { displayMode.value = 'original'; applyDisplayMode(); }
  else if (ev.key === '5') { displayMode.value = 'smart'; applyDisplayMode(); }
});

// Mirror toggle
mirrorBtn.onclick = () => { mirrored = !mirrored; applyDisplayMode(); };

// Fullscreen & exit
fullscreenBtn.onclick = () => viewer.requestFullscreen().catch(()=>{});
exitFullscreenBtn.onclick = () => document.exitFullscreen().catch(()=>{});

// PiP - may fail on some browsers
pipBtn.onclick = () => { try { video.requestPictureInPicture(); } catch(e) { console.debug(e); } };

// Screenshot: capture currently visible viewer rectangle (cropped)
function screenshot() {
  // ensure we have video frame
  const vW = video.videoWidth, vH = video.videoHeight;
  if (!vW || !vH) { setStatus('No video frame to capture'); return; }

  const vidRect = video.getBoundingClientRect();
  const viewRect = viewer.getBoundingClientRect();

  // calculate mapping from displayed video to source pixels
  const dispW = parseFloat(video.style.width);
  const dispH = parseFloat(video.style.height);
  const ratioX = vW / dispW;
  const ratioY = vH / dispH;

  // visible area relative to video
  const sx = Math.max(0, (viewRect.left - vidRect.left) * ratioX);
  const sy = Math.max(0, (viewRect.top - vidRect.top) * ratioY);
  const sw = Math.max(1, Math.min(vW, viewRect.width * ratioX));
  const sh = Math.max(1, Math.min(vH, viewRect.height * ratioY));

  // draw
  canvas.width = Math.round(viewRect.width);
  canvas.height = Math.round(viewRect.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capture-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');

  setStatus('Screenshot saved');
}

// handle display mode change
displayMode.addEventListener('change', applyDisplayMode);

// when video metadata/resolution updates
video.addEventListener('loadedmetadata', applyDisplayMode);
video.addEventListener('resize', applyDisplayMode);

// window resize => recompute
window.addEventListener('resize', applyDisplayMode);

// device hotplug
navigator.mediaDevices.addEventListener('devicechange', async () => {
  const prev = deviceSelect.value;
  await listDevices();
  if (Array.from(deviceSelect.options).some(o => o.value === prev)) deviceSelect.value = prev;
});

// wire buttons
startBtn.onclick = startStream;
screenshotBtn.onclick = screenshot;
resetViewBtn.onclick = resetView;

// init
(async function init() {
  setStatus('Initializing…');
  await listDevices();
  setStatus('');
})();