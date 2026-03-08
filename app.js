// Auto-fill viewer: sizes the <video> element so it ALWAYS COVERS the viewer area (center-crop).
// Replace the previous app.js with this file.

const deviceSelect = document.getElementById('deviceSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const fpsSelect = document.getElementById('fpsSelect');
const startBtn = document.getElementById('startBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const video = document.getElementById('video');
const viewer = document.getElementById('viewer');
const statusEl = document.getElementById('status');
const mirrorBtn = document.getElementById('mirrorBtn');
const pipBtn = document.getElementById('pipBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreen');
const captureCanvas = document.getElementById('captureCanvas');

let currentStream = null;
let mirrored = false;
let manualScale = 1;   // extra manual zoom (1 = no extra zoom)
let manualOffset = { x: 0, y: 0 }; // pixel offsets for panning

// Utility: update status text
function setStatus(text) {
  statusEl.textContent = text || '';
}

// List devices, but ensure permission is requested first so labels are available.
async function enumerateDevicesWithPermission() {
  try {
    // Try to obtain permission silently - use minimal constraint
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (e) {
    // If user denies, device labels might remain hidden; still proceed
    console.debug('Permission request failed or blocked:', e);
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter(d => d.kind === 'videoinput');
  deviceSelect.innerHTML = '';

  if (videoInputs.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.text = 'No video input found';
    deviceSelect.appendChild(opt);
    setStatus('No video inputs detected. Make sure capture card has active HDMI signal and is connected.');
    return;
  }

  videoInputs.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    // label may be empty unless user granted permissions
    opt.text = d.label || `Video Device (${d.deviceId.slice(0,6)})`;
    deviceSelect.appendChild(opt);
  });

  setStatus('');
}

// Start camera stream with chosen constraints
async function startStream() {
  if (!deviceSelect.value) {
    setStatus('Select a device first.');
    return;
  }

  // Stop previous stream
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }

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
    setStatus('Requesting video stream...');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    video.srcObject = stream;

    // Unmute if you want audio, but we keep muted by default
    video.muted = true;

    // when metadata arrives, compute layout
    video.onloadedmetadata = () => {
      video.play().catch(()=>{}); // ensure playing
      coverVideoToViewer();       // position & size video for perfect cover
      setStatus('Streaming');
    };

    // reconnect handling: if track ends, show message
    const track = stream.getVideoTracks()[0];
    track.onended = () => {
      setStatus('Video track ended. Check capture device or HDMI source.');
    };

  } catch (err) {
    console.error(err);
    setStatus('Failed to start stream: ' + (err && err.message ? err.message : err));
  }
}

// Core: size and position the <video> element so it covers the viewer area
function coverVideoToViewer() {
  // If video isn't ready, try later
  const vW = video.videoWidth || parseInt(resolutionSelect.value.split('x')[0]) || 1280;
  const vH = video.videoHeight || parseInt(resolutionSelect.value.split('x')[1]) || 720;

  const viewW = viewer.clientWidth;
  const viewH = viewer.clientHeight;

  if (viewW === 0 || viewH === 0) return;

  // scale to cover: scale = max(viewW / vW, viewH / vH)
  const scale = Math.max(viewW / vW, viewH / vH) * manualScale;

  const finalW = Math.ceil(vW * scale);
  const finalH = Math.ceil(vH * scale);

  // center the video in viewer and apply manual pan offsets (in px)
  const left = Math.round((viewW - finalW) / 2 + manualOffset.x);
  const top = Math.round((viewH - finalH) / 2 + manualOffset.y);

  // apply layout
  video.style.width = finalW + 'px';
  video.style.height = finalH + 'px';
  video.style.left = left + 'px';
  video.style.top = top + 'px';

  // mirror
  video.style.transform = mirrored ? 'scaleX(-1)' : 'none';
}

// Reset view adjustments
function resetView() {
  manualScale = 1;
  manualOffset = { x: 0, y: 0 };
  coverVideoToViewer();
}

// Basic interactions: mouse wheel zoom, drag to pan
let dragging = false;
let dragStart = null;
viewer.addEventListener('wheel', (ev) => {
  // Ctrl + wheel for zoom, otherwise pass through
  ev.preventDefault();
  // zoom sensitivity
  const delta = -ev.deltaY * 0.0015;
  manualScale = Math.min(Math.max(0.5, manualScale + delta), 5);
  coverVideoToViewer();
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
  coverVideoToViewer();
});

viewer.addEventListener('pointerup', (ev) => {
  dragging = false;
  try { viewer.releasePointerCapture(ev.pointerId); } catch (_) {}
});

// window resize & fullscreen changes -> recompute layout
window.addEventListener('resize', coverVideoToViewer);
document.addEventListener('fullscreenchange', () => {
  // if we entered fullscreen, ensure topBar reveals when pointer at top
  coverVideoToViewer();
});

// keyboard shortcuts
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'f' || ev.key === 'F') {
    viewer.requestFullscreen().catch(()=>{});
  } else if (ev.key === 'm' || ev.key === 'M') {
    toggleMirror();
  } else if (ev.key === 'p' || ev.key === 'P') {
    try { video.requestPictureInPicture(); } catch(e) {}
  } else if (ev.key === 's' || ev.key === 'S') {
    screenshot();
  } else if (ev.key === 'r' || ev.key === 'R') {
    resetView();
  } else if (ev.key === 'Escape') {
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  }
});

// mirror toggle
function toggleMirror() {
  mirrored = !mirrored;
  coverVideoToViewer();
}

// screenshot: use visible video frame as currently displayed (cropped)
function screenshot() {
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (!vW || !vH) {
    setStatus('No video frame available for screenshot');
    return;
  }

  // Compute how the video maps to the viewer so we can capture exactly the visible area
  // We know video.style.left/top/width/height set by coverVideoToViewer
  const videoRect = video.getBoundingClientRect();
  const viewerRect = viewer.getBoundingClientRect();

  // Ratio between the displayed video pixel and original video pixels
  const displayW = parseFloat(video.style.width);
  const displayH = parseFloat(video.style.height);
  const ratioX = vW / displayW;
  const ratioY = vH / displayH;

  // we want to capture the area visible inside viewer (viewerRect relative to videoRect)
  const sx = Math.max(0, (viewerRect.left - videoRect.left) * ratioX);
  const sy = Math.max(0, (viewerRect.top - videoRect.top) * ratioY);
  const sw = Math.min(vW, viewerRect.width * ratioX);
  const sh = Math.min(vH, viewerRect.height * ratioY);

  // draw to canvas at viewer size
  captureCanvas.width = Math.round(viewerRect.width);
  captureCanvas.height = Math.round(viewerRect.height);
  const ctx = captureCanvas.getContext('2d');

  // drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, captureCanvas.width, captureCanvas.height);

  captureCanvas.toBlob((blob) => {
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

// Attach UI controls
startBtn.onclick = startStream;
fullscreenBtn.onclick = () => viewer.requestFullscreen().catch(()=>{});
mirrorBtn.onclick = toggleMirror;
pipBtn.onclick = () => video.requestPictureInPicture().catch(()=>{});
screenshotBtn.onclick = screenshot;
resetViewBtn.onclick = resetView;
exitFullscreenBtn.onclick = () => document.exitFullscreen().catch(()=>{});

// Recompute cover when video metadata changes (resolution/fps)
video.addEventListener('loadedmetadata', coverVideoToViewer);
video.addEventListener('resize', coverVideoToViewer);

// device change (hotplug)
navigator.mediaDevices.addEventListener('devicechange', async () => {
  // re-enumerate but keep selected device if possible
  const prev = deviceSelect.value;
  await enumerateDevicesWithPermission();
  if (Array.from(deviceSelect.options).some(o => o.value === prev)) {
    deviceSelect.value = prev;
  }
});

// initial load
(async function init() {
  setStatus('Initializing…');
  await enumerateDevicesWithPermission();
  setStatus('');
  // auto-start first device if present? (we'll wait for user start)
})();
