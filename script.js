document.addEventListener('DOMContentLoaded', () => {

  // ====== Parámetros del proyecto ======
  const TARGET_COUNT = 3;                               // meta temporal para pruebas
  const VIDEO_URL    = 'https://youtu.be/G5AiWQqD9H4';  // tu video
  const PROJECT_ID   = 'proyecto-98';                   // ID de campaña

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
  let playbackStarted = false;
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

      // Evitar doble disparo si ya lo lanzamos desde el propio clic
      if (shouldOpen && !playbackStarted){
        playbackStarted = true;
        openOverlay();
        startCountdown(5);
      }

    } else {
      const remaining = TARGET_COUNT - val;
      statusEl.textContent = `Faltan ${remaining} pulsaciones para desbloquear el video.`;
    }
  }

  // ====== Cuenta regresiva ======
  function startCountdown(from){
    if (pulseBtn) pulseBtn.disabled = true;

    let n = from;
    countdownWrap.classList.remove('hidden');
    videoFrameWrap.classList.add('hidden');
    countdownNumEl.textContent = String(n);

    countdownTimer = setInterval(()=>{
      n--;
      if (n >= 0) countdownNumEl.textContent = String(n);

      if (n < 0){
        clearInterval(countdownTimer);
        countdownWrap.classList.add('hidden');
        startVideo();
      }
    }, 1000);
  }

  // ====== Reproducir video ======
  function startVideo(){
    const ytId = getYouTubeId(VIDEO_URL);
    const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;

    videoFrame.src = embedUrl;
    videoFrameWrap.classList.remove('hidden');

    // Intento de fullscreen al iniciar el video (tercer intento)
    requestFullScreen(videoOverlay).catch(()=>{});

    if (pulseBtn) pulseBtn.disabled = false;
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

    videoFrame.src = '';
    videoOverlay.classList.add('hidden');
    document.body.classList.remove('noscroll');

    if (countdownTimer){
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    playbackStarted = false;
    if (pulseBtn) pulseBtn.disabled = false;
  }

  closeVideo.addEventListener('click', closeOverlayFn);

  // ====== Botón principal ======
  pulseBtn.addEventListener('click', async () => {
    if (!statusEl) return;

    // Intento de fullscreen DENTRO del gesto del usuario (primer intento)
    tryFullscreenOnUserGesture();

    if (alreadyClicked()){
      statusEl.textContent = 'Gracias 🙌 Ya registraste tu apoyo desde este dispositivo.';
      return;
    }

    // Evitar doble-clic mientras resolvemos
    pulseBtn.disabled = true;

    try {
      // Valor antes del clic
      const beforeSnap = await countRef.once('value');
      const beforeVal  = beforeSnap.exists() ? beforeSnap.val() : 0;

      // Transacción para sumar +1 y saber el valor final
      await countRef.transaction(
        current => (current === null ? 1 : current + 1),
        async (error, committed, afterSnap) => {
          // Pase lo que pase, re-habilitamos el botón
          pulseBtn.disabled = false;

          if (error || !committed || !afterSnap) return;

          const afterVal = afterSnap.val();
          const crossed  = beforeVal < TARGET_COUNT && afterVal >= TARGET_COUNT;

          // Si ESTE clic cruzó la meta, disparamos overlay + countdown aquí mismo
          if (crossed && !playbackStarted){
            playbackStarted = true;
            openOverlay();

            // Intento adicional de FS, aún cercano al gesto del usuario
            await requestFullScreen(videoOverlay).catch(()=>{});

            startCountdown(5);
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

  // Pide FS dentro del gesto (primer intento)
  function tryFullscreenOnUserGesture(){
    if (document.fullscreenElement) return;
    const el = videoOverlay || document.documentElement;
    try{
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    }catch(_){}
  }

  // Helper de FS (usado en overlay y al iniciar video)
  async function requestFullScreen(el){
    try {
      if (el.requestFullscreen) return el.requestFullscreen();
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
      if (el.msRequestFullscreen) return el.msRequestFullscreen();
    } catch (e){}
  }

});