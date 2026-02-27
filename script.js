document.addEventListener('DOMContentLoaded', () => {

  // ====== Parámetros del proyecto ======
  const TARGET_COUNT = 3;                               // meta temporal para pruebas
  const VIDEO_URL    = 'https://youtu.be/G5AiWQqD9H4';  // tu video
  const PROJECT_ID   = 'proyecto-102';                   // ID de campaña

  // ====== Tiempos ======
  const COUNTDOWN_START = 5;        // 5 → 1
  const DELAY_BEFORE_AUTOPLAY = 4000; // ms (4 s) para que el usuario pueda ampliar/activar sonido

  // ====== Referencias del DOM ======
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

  // ====== Estado INICIAL SEGURO ======
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

  // ====== Anti multi-clic básico ======
  const localKey = `clicked_${PROJECT_ID}`;
  const alreadyClicked = () => localStorage.getItem(localKey) === '1';
  const markClicked    = () => localStorage.setItem(localKey, '1');

  // ====== Realtime + detección de transición (para UI) ======
  let lastVal = null;
  let playbackStarted = false; // evita dobles disparos
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

      // Si llegó por realtime pero además este ciclo cruzó la meta
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

  // ====== Cuenta regresiva → mostrar video (pausado) → esperar 4s → reproducir en silencio ======
  function startCountdownThenShowVideo(){
    // 1) Asegurar estados de UI
    if (pulseBtn) pulseBtn.disabled = true;
    videoFrameWrap.classList.add('hidden');
    countdownWrap.classList.remove('hidden');

    // 2) Contador 5→1
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

        // 3) Mostrar el video sin reproducción (autoplay=0), con API habilitada
        const ytId   = getYouTubeId(VIDEO_URL);
        const origin = encodeURIComponent(window.location.origin);
        const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=0&controls=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${origin}`;
        videoFrame.src = embedUrl;
        videoFrameWrap.classList.remove('hidden');

        // 4) Esperar 4s para que el usuario pueda ampliar pantalla y activar sonido
        autoplayTimer = setTimeout(() => {
          try {
            // Iniciar en silencio para cumplir políticas de autoplay
            videoFrame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "mute", args: [] }), "*");
            videoFrame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
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
    // Cancelar timers si existen
    if (countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }
    if (autoplayTimer){ clearTimeout(autoplayTimer); autoplayTimer = null; }

    // Detener y ocultar video
    try {
      videoFrame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "stopVideo", args: [] }), "*");
    } catch(_) {}
    videoFrame.src = '';
    videoFrameWrap.classList.add('hidden');

    // Cerrar overlay y restaurar estado
    videoOverlay.classList.add('hidden');
    document.body.classList.remove('noscroll');
    playbackStarted = false;
    if (pulseBtn) pulseBtn.disabled = false;
  }

  if (closeVideo) closeVideo.addEventListener('click', closeOverlayFn);

  // ====== Botón principal ======
  pulseBtn.addEventListener('click', async () => {
    if (!statusEl) return;

    if (alreadyClicked()){
      statusEl.textContent = 'Gracias 🙌 Ya registraste tu apoyo desde este dispositivo.';
      return;
    }

    pulseBtn.disabled = true;

    try {
      // Tomamos el valor previo
      const beforeSnap = await countRef.once('value');
      const beforeVal  = beforeSnap.exists() ? beforeSnap.val() : 0;

      // Transacción para sumar +1 y conocer el valor final
      await countRef.transaction(
        current => (current === null ? 1 : current + 1),
        async (error, committed, afterSnap) => {
          pulseBtn.disabled = false;

          if (error || !committed || !afterSnap) return;

          const afterVal = afterSnap.val();
          const crossed  = beforeVal < TARGET_COUNT && afterVal >= TARGET_COUNT;

          // Si ESTE clic cruzó la meta: countdown → mostrar video (pausado) → 4s → reproducir
          if (crossed && !playbackStarted){
            playbackStarted = true;
            openOverlay();
            startCountdownThenShowVideo();
          }
        }
      );

      // Marca por dispositivo
      const cid = getClientId();
      await clicksRef.child(cid).set(true);
      markClicked();

    } catch (e){
      console.error(e);
      pulseBtn.disabled = false;
      alert('Ocurrió un error al registrar tu pulsación. Intenta de nuevo.');
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