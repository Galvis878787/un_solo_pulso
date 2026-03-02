document.addEventListener('DOMContentLoaded', () => {

  // ====== Parámetros del proyecto ======
  const TARGET_COUNT = 2;                               // meta temporal para pruebas
  const VIDEO_URL    = 'https://youtu.be/G5AiWQqD9H4';  // tu video (YouTube)
  const PROJECT_ID   = 'proyecto-113';                  // ID de campaña

  // ====== Tiempos ======
  const COUNTDOWN_START = 5;        // 5 → 1 (cuenta regresiva)

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
  const goFullscreenBtn= document.getElementById('goFullscreen');
  const replayBtn      = document.getElementById('replay');

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
  firebase.initializeApp(firebaseConfig);
  const db  = firebase.database();

  const countRef  = db.ref(`projects/${PROJECT_ID}/count`);
  const clicksRef = db.ref(`projects/${PROJECT_ID}/clicks`);

  // ====== Anti multi-clic (una vez por dispositivo) ======
  const localKey = `clicked_${PROJECT_ID}`;
  const alreadyClicked = () => localStorage.getItem(localKey) === '1';
  const markClicked    = () => localStorage.setItem(localKey, '1');

  // ====== Realtime ======
  let lastVal = null;
  let playbackStarted = false;  // control para no disparar dos veces el overlay
  let countdownTimer  = null;

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

  // ====== Cuenta regresiva → video → fullscreen + audio ======
  function startCountdownThenShowVideo(){
    if (pulseBtn) pulseBtn.disabled = true;
    videoFrameWrap.classList.add('hidden');

    countdownWrap.classList.remove('hidden');
    let n = COUNTDOWN_START;
    countdownNumEl.textContent = String(n);

    countdownTimer = setInterval(async () => {
      n--;
      if (n >= 1) {
        countdownNumEl.textContent = String(n);
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;

        // Ocultar contador y mostrar contenedor del video
        countdownWrap.classList.add('hidden');
        videoFrameWrap.classList.remove('hidden');

        // 1) Construir URL del embed de YouTube
        //    Con enablejsapi=1 para controlar via postMessage
        const ytId   = getYouTubeId(VIDEO_URL);
        const origin = encodeURIComponent(window.location.origin);
        // Autoplay (muted) para “enganchar” el reproductor. Luego haremos unmute al entrar en FS.
        const embedUrl =
          `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${origin}`;

        videoFrame.src = embedUrl;

        // 2) Intentar pantalla completa programática SIN gesto del usuario
        let fsOK = false;
        try {
          await enterFullscreen(videoOverlay); // intentamos sobre el overlay (mejor soporte)
          fsOK = true;
        } catch (err) {
          fsOK = false;
          console.warn('Fullscreen automático bloqueado por el navegador:', err);
        }

        // 3) Si estamos en FS, hacemos unmute + play (audio ON)
        if (fsOK) {
          // Pequeño delay para que el player esté listo
          await wait(350);
          ytCommand('unMute');
          ytCommand('setVolume', [100]);
          ytCommand('playVideo');
        } else {
          // 4) Si NO fue posible FS automático, mostramos botón de respaldo
          if (goFullscreenBtn) {
            goFullscreenBtn.style.display = 'inline-flex';
          }
          // El video queda reproduciéndose en silencio hasta que el usuario pida FS.
        }

        if (pulseBtn) pulseBtn.disabled = false;
      }
    }, 1000);
  }

  // ====== Overlay ======
  function openOverlay(){
    videoOverlay.classList.remove('hidden');
    document.body.classList.add('noscroll');
    // Estado UI inicial del overlay
    goFullscreenBtn && (goFullscreenBtn.style.display = 'none');
    videoFrameWrap.classList.add('hidden');
    countdownWrap.classList.remove('hidden');
    stopAndClearIframe(); // por si quedó algo del ciclo anterior
  }

  function closeOverlayFn(){
    if (countdownTimer){ clearInterval(countdownTimer); countdownTimer = null; }

    // Detener video YouTube y limpiar src
    try {
      ytCommand('stopVideo');
    } catch(_) {}
    stopAndClearIframe();

    // Salir de pantalla completa (si aplica)
    try {
      if (document.fullscreenElement) document.exitFullscreen();
    } catch (_) {}

    // Cerrar overlay y restaurar
    videoOverlay.classList.add('hidden');
    document.body.classList.remove('noscroll');
    playbackStarted = false;
    if (pulseBtn) pulseBtn.disabled = false;
  }

  if (closeVideo)  closeVideo.addEventListener('click', closeOverlayFn);
  if (replayBtn)   replayBtn.addEventListener('click', () => { startCountdownThenShowVideo(); });

  // Botón de respaldo: con este GESTO del usuario, habilitamos FS + audio
  if (goFullscreenBtn) {
    goFullscreenBtn.addEventListener('click', async () => {
      try {
        await enterFullscreen(videoOverlay);  // ahora SÍ hay gesto del usuario
        await wait(200);
        ytCommand('unMute');
        ytCommand('setVolume', [100]);
        ytCommand('playVideo');
        goFullscreenBtn.style.display = 'none';
      } catch (err) {
        console.warn('No se pudo entrar en pantalla completa con gesto:', err);
      }
    });
  }

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

  // ====== Compartir (si existe shareLink) ======
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

  function stopAndClearIframe(){
    if (videoFrame) videoFrame.src = '';
  }

  // Comandos YouTube via postMessage (enablejsapi=1)
  function ytCommand(func, args = []){
    if (!videoFrame || !videoFrame.contentWindow) return;
    const msg = JSON.stringify({ event: 'command', func, args });
    videoFrame.contentWindow.postMessage(msg, '*');
  }

  // Fullscreen helpers (overlay es mejor “target” que el iframe)
  function enterFullscreen(el){
    if (el.requestFullscreen)            return el.requestFullscreen();
    if (el.webkitRequestFullscreen)      return el.webkitRequestFullscreen(); // Safari
    if (el.msRequestFullscreen)          return el.msRequestFullscreen();     // IE/Edge heredado
    return Promise.reject(new Error('Fullscreen API no disponible o bloqueada.'));
  }

  function wait(ms){ return new Promise(res => setTimeout(res, ms)); }

});
``