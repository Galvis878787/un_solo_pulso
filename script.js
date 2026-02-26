document.addEventListener('DOMContentLoaded', () => {
  // ====== Parámetros del proyecto (ajústalos si lo deseas) ======
  const TARGET_COUNT = 2;                            // meta de pulsaciones
  const VIDEO_URL    = 'https://youtu.be/G5AiWQqD9H4';// tu video (formato corto recomendado)
  const PROJECT_ID   = 'proyecto-2';                  // cambia el ID para "reiniciar" sin borrar datos

  // ====== Toma de referencias del DOM ======
  const counterEl     = document.getElementById('counter');
  const statusEl      = document.getElementById('status');
  const pulseBtn      = document.getElementById('pulseBtn');
  const videoSection  = document.getElementById('videoSection');
  const videoLink     = document.getElementById('videoLink');
  const shareLink     = document.getElementById('shareLink');
  const targetCountEl = document.getElementById('target-count'); // opcional

  // Overlay / Countdown / Video (NUEVO)
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

  // ====== Estado local para evitar doble clic desde el mismo dispositivo ======
  const localKey = `clicked_${PROJECT_ID}`;
  const alreadyClicked = () => localStorage.getItem(localKey) === '1';
  const markClicked    = () => localStorage.setItem(localKey, '1');

  // ====== Suscripción en tiempo real al contador ======
  countRef.on('value', (snap) => {
    const val = snap.exists() ? snap.val() : 0;
    if (counterEl) counterEl.textContent = String(val);
    updateStatus(val);
  });

  // ====== Cuenta regresiva / reproducción ======
  let playbackStarted = false; // evita disparos múltiples
  let countdownTimer  = null;

  function updateStatus(val){
    if (!statusEl) return;

    if (val >= TARGET_COUNT){
      if (playbackStarted) return; // no repetir
      playbackStarted = true;

      openOverlay();
      startCountdown(5); // 5→0 y luego reproducir
    } else {
      const remaining = TARGET_COUNT - val;
      statusEl.textContent = `Faltan ${remaining} pulsaciones para desbloquear el video.`;
      if (videoSection) videoSection.classList.add('hidden');
    }
  }

  function startCountdown(from){
    if (!countdownNumEl || !countdownWrap){
      // fallback: si no existe el contenedor, reproducimos
      startVideo();
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
    requestFullScreen(videoOverlay);
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

    if (countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }
  }
  if (closeVideo){
    closeVideo.addEventListener('click', closeOverlayFn);
  }

  // ====== Lógica del botón ======
  if (pulseBtn) {
    pulseBtn.addEventListener('click', async () => {
      if (!statusEl) return;

      if (alreadyClicked()){
        statusEl.textContent = 'Gracias 🙌 Ya registraste tu apoyo desde este dispositivo.';
        return;
      }

      const cid = getClientId();

      try {
        await clicksRef.child(cid).set(true);                       // 1) marca por dispositivo
        await countRef.transaction((current) => (current === null ? 1 : current + 1)); // 2) +1
        markClicked();
      } catch (e){
        console.error(e);
        alert('Ocurrió un error al registrar tu pulsación. Intenta de nuevo.');
      }
    });
  }

  function getClientId(){
    const key = `cid_${PROJECT_ID}`;
    let cid = localStorage.getItem(key);
    if (!cid){
      cid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, cid);
    }
    return cid;
  }

  // ====== Compartir enlace ======
  if (shareLink){
    shareLink.addEventListener('click', (e)=>{
      e.preventDefault();
      const url = window.location.href;
      if (navigator.share){
        navigator.share({ title:'Un solo pulso', text:'Ayúdanos a llegar a la meta', url });
      } else {
        navigator.clipboard.writeText(url);
        alert('Enlace copiado al portapapeles');
      }
    });
  }

  // ====== Utilidades ======
  function getYouTubeId(url){
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be'))   return u.pathname.replace('/', '');
      if (u.searchParams.get('v'))           return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1];
    } catch(_) {}
    return url;
  }

  async function requestFullScreen(el){
    try {
      if (!el) return;
      if (el.requestFullscreen)           await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen)     el.msRequestFullscreen();
    } catch(_){ /* Si falla, mantenemos overlay visible como fallback */ }
  }
});