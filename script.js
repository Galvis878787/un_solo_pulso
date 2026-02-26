document.addEventListener('DOMContentLoaded', () => {
  // ====== Parámetros del proyecto ======
  const TARGET_COUNT = 2;                             // meta de pulsaciones (para probar rápido)
  const VIDEO_URL    = 'https://youtu.be/G5AiWQqD9H4'; // tu video
  const PROJECT_ID   = 'proyecto-4';                  // cambia para “reiniciar” sin borrar

  // ====== DOM ======
  const counterEl     = document.getElementById('counter');
  const statusEl      = document.getElementById('status');
  const pulseBtn      = document.getElementById('pulseBtn');
  const videoSection  = document.getElementById('videoSection');
  const videoLink     = document.getElementById('videoLink');
  const shareLink     = document.getElementById('shareLink');
  const targetCountEl = document.getElementById('target-count'); // opcional

  // Overlay / Countdown / Video
  const videoOverlay   = document.getElementById('videoOverlay');
  const closeVideo     = document.getElementById('closeVideo');
  const countdownWrap  = document.getElementById('countdownWrap');
  const countdownNumEl = document.getElementById('countdownNumber');
  const videoFrameWrap = document.getElementById('videoFrameWrap');
  const videoFrame     = document.getElementById('videoFrame');

  if (targetCountEl) targetCountEl.textContent = TARGET_COUNT.toString();
  if (videoLink)     videoLink.href = VIDEO_URL;

  // ====== Firebase init ======
  if (typeof firebaseConfig === 'undefined') {
    console.error('⚠️ No se encontró firebaseConfig. Verifica config.js y su orden de carga.');
    return;
  }
  const app = firebase.initializeApp(firebaseConfig);
  const db  = firebase.database();

  const countRef  = db.ref(`projects/${PROJECT_ID}/count`);
  const clicksRef = db.ref(`projects/${PROJECT_ID}/clicks`);

  // ====== Anti multi-clic básico ======
  const localKey = `clicked_${PROJECT_ID}`;
  const alreadyClicked = () => localStorage.getItem(localKey) === '1';
  const markClicked    = () => localStorage.setItem(localKey, '1');

  // ====== Realtime ======
  countRef.on('value', (snap) => {
    const val = snap.exists() ? snap.val() : 0;
    if (counterEl) counterEl.textContent = String(val);
    updateStatus(val);
  });

  // ====== Countdown / reproducción ======
  let playbackStarted = false;
  let countdownTimer  = null;

  function updateStatus(val){
    if (!statusEl) return;

    if (val >= TARGET_COUNT){
      if (playbackStarted) return;
      playbackStarted = true;

      // Mostrar overlay + countdown
      openOverlay();
      startCountdown(5); // 5 → 0
    } else {
      const remaining = TARGET_COUNT - val;
      statusEl.textContent = `Faltan ${remaining} pulsaciones para desbloquear el video.`;
      if (videoSection) videoSection.classList.add('hidden');
    }
  }

  function startCountdown(from){
    // Deshabilitar botón durante la cuenta regresiva
    if (pulseBtn) pulseBtn.disabled = true;

    if (!countdownNumEl || !countdownWrap){
      startVideo(); // fallback si no existe el contenedor
      return;
    }
    let n = from;
    countdownWrap.classList.remove('hidden');
    videoFrameWrap.classList.add('hidden');
    countdownNumEl.textContent = String(n);

    countdownTimer = setInterval(()=>{
      n -= 1;
      if (n >= 0) countdownNumEl.textContent = String(n);
      if (n < 0){
        clearInterval(countdownTimer);
        countdownTimer = null;
        countdownWrap.classList.add('hidden');
        startVideo();
      }
    }, 1000);
  }

  function startVideo(){
    if (!videoFrame || !videoFrameWrap) return;

    const ytId     = getYouTubeId(VIDEO_URL);
    const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
    videoFrame.src = embedUrl;

    videoFrameWrap.classList.remove('hidden');

    // Intentar pantalla completa automáticamente (puede fallar si el navegador lo bloquea)
    requestFullScreen(videoOverlay).catch(()=>{ /* fallback: overlay visible */ });

    // Rehabilitar el botón (por si luego cierran el overlay)
    if (pulseBtn) pulseBtn.disabled = false;
  }

  function openOverlay(){
    if (videoOverlay){
      videoOverlay.classList.remove('hidden');
      document.body.classList.add('noscroll');
    }
  }

  function closeOverlayFn(){
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(()=>{});
    }
    if (videoFrame) videoFrame.src = ''; // detener
    if (videoOverlay) videoOverlay.classList.add('hidden');
    document.body.classList.remove('noscroll');

    // Re‑habilitar SIEMPRE el botón al cerrar el overlay
    if (pulseBtn) pulseBtn.disabled = false;

    // Si cerraron durante countdown
    if (countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }

    // Permitir volver a iniciar si se vuelve a alcanzar la meta en otra campaña
    playbackStarted = false;
  }

  if (closeVideo){
    closeVideo.addEventListener('click', closeOverlayFn);
  }

  // ====== Botón principal ======
  if (pulseBtn) {
    pulseBtn.addEventListener('click', async () => {
      if (!statusEl) return;

      if (alreadyClicked()){
        statusEl.textContent = 'Gracias 🙌 Ya registraste tu apoyo desde este dispositivo.';
        return;
      }

      const cid = getClientId();

      try {
        await clicksRef.child(cid).set(true);                                   // 1) marca por dispositivo
        await countRef.transaction((current) => (current === null ? 1 : current + 1)); // 2) +1
        markClicked();
      } catch (e){
        console.error(e);