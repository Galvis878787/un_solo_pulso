document.addEventListener('DOMContentLoaded', () => {
  // ====== Parámetros del proyecto (ajústalos si lo deseas) ======
  const TARGET_COUNT = 10;                           // meta de pulsaciones
  const VIDEO_URL    = 'https://youtu.be/G5AiWQqD9H4'; // tu video (formato corto recomendado)
  const PROJECT_ID   = 'proyecto-1';             // cambia el ID para "reiniciar" sin borrar datos

  // ====== Toma de referencias del DOM (ya existen porque esperamos a DOMContentLoaded) ======
  const counterEl     = document.getElementById('counter');
  const statusEl      = document.getElementById('status');
  const pulseBtn      = document.getElementById('pulseBtn');
  const videoSection  = document.getElementById('videoSection');
  const videoLink     = document.getElementById('videoLink');
  const shareLink     = document.getElementById('shareLink');
  const targetCountEl = document.getElementById('target-count'); // si no existe en tu HTML, no pasa nada

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

  function updateStatus(val){
    if (!statusEl) return;

    if (val >= TARGET_COUNT){
      // Redirección automática al video
      window.location.href = VIDEO_URL;

      // Si prefieres desbloquear un botón en lugar de redirigir:
      // statusEl.textContent = '¡Meta alcanzada!';
      // if (videoSection) videoSection.classList.remove('hidden');
      // return;
    } else {
      const remaining = TARGET_COUNT - val;
      statusEl.textContent = `Faltan ${remaining} pulsaciones para desbloquear el video.`;
      if (videoSection) videoSection.classList.add('hidden');
    }
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
        // 1) Registrar marca por dispositivo (idempotencia simple)
        await clicksRef.child(cid).set(true);

        // 2) Incrementar contador con transacción
        await countRef.transaction((current) => (current === null ? 1 : current + 1));

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
});