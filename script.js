document.addEventListener('DOMContentLoaded', () => {

  // ====== Parámetros del proyecto ======
  const TARGET_COUNT = 3;                               // meta temporal para pruebas
  const VIDEO_URL    = 'https://youtu.be/G5AiWQqD9H4';  // tu video
  const PROJECT_ID   = 'proyecto-104';                   // ID de campaña

  // ====== Tiempos ======
  const COUNTDOWN_START = 5;                  // 5 → 1
  const DELAY_BEFORE_AUTOPLAY = 4000;         // 4 segundos

  // ====== Referencias del DOM ======
  const counterEl     = document.getElementById('counter');
  const statusEl      = document.getElementById('status');
  const pulseBtn      = document.getElementById('pulseBtn');
  const videoSection  = document.getElementById('videoSection');
  const videoLink     = document.getElementById('videoLink');
  const shareLink     = document.getElementById('shareLink');
  const targetCountEl = document.getElementById('target-count');

  const videoOverlay   = document.getElementById('videoOverlay');
  const closeVideo     = document.getElementById('closeVideo');
  const countdownWrap  = document.getElementById('countdownWrap');
  const countdownNumEl = document.getElementById('countdownNumber');
  const videoFrameWrap = document.getElementById('videoFrameWrap');
  const videoFrame     = document.getElementById('videoFrame');

  // ====== Estado inicial seguro ======
  if (videoOverlay) videoOverlay.classList.add('hidden');
  document.body.classList.remove('noscroll');
  if (targetCountEl) targetCountEl.textContent = String(TARGET_COUNT);
  if (videoLink)     videoLink.href = VIDEO_URL;

  // ====== Firebase init ======
  if (typeof firebaseConfig === 'undefined') {
    console.error('⚠️ No se encontró firebaseConfig. Verifica config.js');
    return;
  }
  const app = firebase.initializeApp(firebaseConfig);
  const db  = firebase.database();

  const countRef  = db.ref(`projects/${PROJECT_ID}/count`);
  const clicksRef = db.ref(`projects/${PROJECT_ID}/clicks`);

  // ====== Anti multi-clic ======
  const localKey = `clicked_${PROJECT_ID}`;
  const alreadyClicked = () => localStorage.getItem(localKey) === '1';
  const markClicked    = () => localStorage.setItem(localKey, '1');

  // ====== Realtime ======
  let lastVal = null;
  let playbackStarted = false;
  let countdownTimer  = null;
  let autoplayTimer   = null;

  countRef.on('value', (snap) => {
    const val = snap.exists() ? snap.val() : 0;
    if (counterEl) counterEl.textContent = String(val);

    const crossed = lastVal !== null && lastVal < TARGET_COUNT && val >= TARGET_COUNT;
    updateStatus(val, crossed);

    lastVal = val;
  });

  function updateStatus(val, shouldOpen){
    if (!statusEl) return;

    if (val >= TARGET_COUNT){
      statusEl.textContent = '¡Meta alcanzada! 🎉';

      if (shouldOpen && !playbackStarted){
        playbackStarted = true;
        openOverlay();
        startCountdownThenShowVideo();
      }

    } else {
      const remaining = TARGET_COUNT - val;
      statusEl.textContent = `Faltan ${remaining} pulsaciones para desbloquear el video.`;
    }
  }

  // ====== Cuenta regresiva → video pausado → delay → autoplay ======
  function startCountdownThenShowVideo(){
    if (pulseBtn) pulseBtn.disabled = true;
    videoFrameWrap.classList.add('hidden');

    countdownWrap.classList.remove('hidden');
    let n = COUNTDOWN_START;
    countdownNumEl.textContent = String(n);

    countdownTimer = setInterval(() => {
      n--;
      if (n >= 1) {
        countdownNumEl.textContent = String(n);
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        countdownWrap.classList.add('hidden');

        // ====== Mostrar video pausado ======
        const ytId   = getYouTubeId(VIDEO_URL);
        const origin = encodeURIComponent(window.location.origin);
        const embedUrl = 
          `https://www.youtube.com/embed/${ytId}?autoplay=0&controls=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${origin}`;

        videoFrame.src = embedUrl;
        videoFrameWrap.classList.remove('hidden');

        // ====== Esperar 4 segundos → reproducir automáticamente ======
        autoplayTimer = setTimeout(() => {
          try {
            // Mute obligatorio para autoplay en móviles
            videoFrame.contentWindow?.postMessage(JSON.stringify({ 
              event: "command", func: "mute", args: [] 
            }), "*");

            videoFrame.contentWindow?.postMessage(JSON.stringify({ 
              event: "command", func: "playVideo", args: [] 
            }), "*");
          } catch(_) {}

          // ====== Intento de fullscreen automático ======
          try {
            if (videoOverlay.requestFullscreen){
              videoOverlay.requestFullscreen();
            } else if (videoOverlay.webkitRequestFullscreen){
              videoOverlay.webkitRequestFullscreen(); // Safari
            } else if (videoOverlay.msRequestFullscreen){
              videoOverlay.msRequestFullscreen();
            }
          } catch(_) {}

          if (pulseBtn) pulseBtn.disabled = false;

        }, DELAY_BEFORE_AUTOPLAY);
      }

    }, 1000);
  }

  // ====== Overlay ======
  function openOverlay(){
    videoOverlay.classList.remove('hidden');
    document.body.classList.add('noscroll');
  }

  function closeOverlayFn(){
    if (countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }
    if (autoplayTimer){ clearTimeout(autoplayTimer); autoplayTimer = null; }

    try {
      videoFrame.contentWindow?.postMessage(JSON.stringify({ 
        event: "command", func: "stopVideo", args: [] 
      }), "*");
    } catch(_) {}

    videoFrame.src = '';
    videoFrameWrap.classList.add('hidden');

    videoOverlay.classList.add('hidden');
    document.body.classList.remove('noscroll');
    playbackStarted = false;

    if (pulseBtn) pulseBtn.disabled = false;
  }

  if (closeVideo) closeVideo.addEventListener('click', closeOverlayFn);

  // ====== Botón principal ======
  pulseBtn.addEventListener('click', async () => {
    if (alreadyClicked()){
      statusEl.textContent = 'Gracias 🙌 Ya registraste tu apoyo desde este dispositivo.';
      return;
    }

    pulseBtn.disabled = true;

    try {
      const beforeSnap = await countRef.once('value');
      const beforeVal  = beforeSnap.exists() ? beforeSnap.val() : 0;

      await countRef.transaction(
        current => (current === null ? 1 : current + 1),
        async (error, committed, afterSnap) => {
          pulseBtn.disabled = false;

          if (error || !committed || !afterSnap) return;

          const afterVal = afterSnap.val();
          const crossed  = beforeVal < TARGET_COUNT && afterVal >= TARGET_COUNT;

          if (crossed && !playbackStarted){
            playbackStarted = true;
            openOverlay();
            startCountdownThenShowVideo();
          }
        }
      );

      const cid = getClientId();
      await clicksRef.child(cid).set(true);
      markClicked();

    } catch (e){
      console.error(e);
      pulseBtn.disabled = false;
      alert('Ocurrió un error al registrar tu pulsación.');
    }
  });

  // ====== Compartir ======
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
    } catch(e){}
    return url;
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

});