document.addEventListener('DOMContentLoaded', () => {

  // ====== Parámetros del proyecto ======
  const TARGET_COUNT = 3;                               // meta temporal para pruebas
  const VIDEO_URL    = 'https://youtu.be/G5AiWQqD9H4';  // tu video
  const PROJECT_ID   = 'proyecto-101';                   // ID de campaña

  // ====== Reproducción diferida ======
  const DELAY_AUTOPLAY_MS = 9000;                       // 9 segundos antes de iniciar reproducción
  const USE_DELAYED_AUTOPLAY = true;                    // bandera por si quieres revertir luego

  // ====== Referencias del DOM ======
  const counterEl     = document.getElementById('counter');
  const statusEl      = document.getElementById('status');
  const pulseBtn      = document.getElementById('pulseBtn');
  const videoSection  = document.getElementById('videoSection');
  const videoLink     = document.getElementById('videoLink');
  const shareLink     = document.getElementById('shareLink');
  const targetCountEl = document.getElementById('target-count'); // opcional

  // Overlay / Video
  const videoOverlay   = document.getElementById('videoOverlay');
  const closeVideo     = document.getElementById('closeVideo');
  const countdownWrap  = document.getElementById('countdownWrap');   // ya no lo usamos para contar; queda oculto
  const countdownNumEl = document.getElementById('countdownNumber'); // (compat)
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
  let playbackStarted = false;
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

      // Evitar doble disparo si ya lo lanzamos desde el propio clic
      if (shouldOpen && !playbackStarted){
        playbackStarted = true;
        openOverlay();
        showVideoThenAutoPlayDelayed();   // 👈 mostramos inmediatamente y auto‑reproducimos a los 4 s
      }

    } else {
      const remaining = TARGET_COUNT - val;
      statusEl.textContent = `Faltan ${remaining} pulsaciones para desbloquear el video.`;
    }
  }

  // ====== Nuevo flujo: mostrar iframe de inmediato y reproducir tras 4 s ======
  function showVideoThenAutoPlayDelayed(){
    // 1) Cargar el iframe SIN autoplay, con API habilitada (enablejsapi=1) y controles visibles
    const ytId = getYouTubeId(VIDEO_URL);
    const origin = encodeURIComponent(window.location.origin);
    const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=0&controls=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${origin}`;

    videoFrame.src = embedUrl;
    videoFrameWrap.classList.remove('hidden');   // 👈 el video se ve ya, pero detenido
    // (si tenías countdown visible por algún motivo, lo ocultamos)
    if (countdownWrap) countdownWrap.classList.add('hidden');

    // 2) Dar tiempo (4 s) para que el usuario active sonido/FS si quiere
    if (USE_DELAYED_AUTOPLAY){
      // limpiamos por si se dispara doble
      if (autoplayTimer) clearTimeout(autoplayTimer);
      autoplayTimer = setTimeout(() => {
        // 3) Reproducir automáticamente en silencio para cumplir políticas de autoplay
        try {
          // Mutear y reproducir usando la YouTube IFrame API via postMessage
          // doc: https://developers.google.com/youtube/iframe_api_reference (no necesitamos cargar el script; postMessage funciona con enablejsapi=1)
          videoFrame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "mute", args: [] }), "*");
          videoFrame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
        } catch(_) {}

        // 4) Hacemos un intento adicional de fullscreen cuando arranca
        requestFullScreen(videoOverlay).catch(()=>{});
      }, DELAY_AUTOPLAY_MS);
    }
  }

  // ====== Overlay ======
  function openOverlay(){
    videoOverlay.classList.remove('hidden');
    document.body.classList.add('noscroll');
  }

  function closeOverlayFn(){
    if (document.fullscreenElement){
      document.exitFullscreen().catch(()=>{});
    }

    // cancelar autoplay diferido si estaba programado
    if (autoplayTimer){
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }

    videoFrame.src = '';  // detener completamente
    videoOverlay.classList.add('hidden');
    document.body.classList.remove('noscroll');

    playbackStarted = false;
    if (pulseBtn) pulseBtn.disabled = false;
  }

  closeVideo.addEventListener('click', closeOverlayFn);

  // ====== Botón principal ======
  pulseBtn.addEventListener('click', async () => {
    if (!statusEl) return;

    if (alreadyClicked()){
      statusEl.textContent = 'Gracias 🙌 Ya registraste tu apoyo desde este dispositivo.';
      return;
    }

    // Evitar doble‑clic mientras resolvemos
    pulseBtn.disabled = true;

    try {
      // Valor antes del clic
      const beforeSnap = await countRef.once('value');
      const beforeVal  = beforeSnap.exists() ? beforeSnap.val() : 0;

      // Transacción para sumar +1 y saber el valor final
      await countRef.transaction(
        current => (current === null ? 1 : current + 1),
        async (error, committed, afterSnap) => {
          // Rehabilitar el botón pase lo que pase
          pulseBtn.disabled = false;

          if (error || !committed || !afterSnap) return;

          const afterVal = afterSnap.val();
          const crossed  = beforeVal < TARGET_COUNT && afterVal >= TARGET_COUNT;

          // Si ESTE clic cruzó la meta, mostrar video y programar reproducción diferida
          if (crossed && !playbackStarted){
            playbackStarted = true;
            openOverlay();
            showVideoThenAutoPlayDelayed();
          }
        }
      );

      // Registrar marca por dispositivo (idempotencia simple)
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

  async function requestFullScreen(el){
    try {
      if (el?.requestFullscreen) return el.requestFullscreen();
      if (el?.webkitRequestFullscreen) return el.webkitRequestFullscreen(); // iOS Safari
      if (el?.msRequestFullscreen) return el.msRequestFullscreen();
    } catch (e){}
  }

});