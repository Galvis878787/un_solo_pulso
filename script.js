// ====== Parámetros del proyecto ======
const TARGET_COUNT = 100; // cambia si lo deseas
const VIDEO_URL = 'https://youtu.be/dQw4w9WgXcQ'; // <-- reemplaza por tu video real
const PROJECT_ID = 'proyecto-100'; // nombre lógico para separar datos

// ====== UI elements ======
const counterEl = document.getElementById('counter');
const statusEl = document.getElementById('status');
const pulseBtn = document.getElementById('pulseBtn');
const videoSection = document.getElementById('videoSection');
const videoLink = document.getElementById('videoLink');
const targetCountEl = document.getElementById('target-count');
const shareLink = document.getElementById('shareLink');

targetCountEl.textContent = TARGET_COUNT.toString();
videoLink.href = VIDEO_URL;

// ====== Firebase init ======
if (typeof firebaseConfig === 'undefined') {
  alert('⚠️ Falta el archivo config.js con tus credenciales de Firebase. Lee el README.');
}
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const countRef = db.ref(`projects/${PROJECT_ID}/count`);
const clicksRef = db.ref(`projects/${PROJECT_ID}/clicks`);

// ====== Estado local para evitar doble clic del mismo dispositivo ======
const localKey = `clicked_${PROJECT_ID}`;
const alreadyClicked = () => localStorage.getItem(localKey) === '1';
const markClicked = () => localStorage.setItem(localKey, '1');

// ====== Suscribir al valor del contador en tiempo real ======
countRef.on('value', (snap) => {
  const val = snap.exists() ? snap.val() : 0;
  counterEl.textContent = val;
  updateStatus(val);
});

function updateStatus(val){
  if (val >= TARGET_COUNT){
    statusEl.textContent = '¡Meta alcanzada!';
    videoSection.classList.remove('hidden');
  } else {
    const remaining = TARGET_COUNT - val;
    statusEl.textContent = `Faltan ${remaining} pulsaciones para desbloquear el video.`;
    videoSection.classList.add('hidden');
  }
}

// ====== Lógica del botón ======
pulseBtn.addEventListener('click', async () => {
  if (alreadyClicked()){
    statusEl.textContent = 'Gracias 🙌 Ya registraste tu apoyo desde este dispositivo.';
    return;
  }

  // Crear un ID local anónimo para marcar unicidad simple
  const cid = getClientId();

  try {
    // 1) Registrar que este dispositivo ya votó (idempotencia simple)
    await clicksRef.child(cid).set(true);

    // 2) Incrementar contador con transacción
    await countRef.transaction((current) => {
      if (current === null) return 1;
      return current + 1;
    });

    markClicked();
  } catch (e){
    console.error(e);
    alert('Ocurrió un error al registrar tu pulsación. Intenta de nuevo.');
  }
});

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
shareLink.addEventListener('click', (e)=>{
  e.preventDefault();
  const url = window.location.href;
  if (navigator.share){
    navigator.share({title:'Un solo pulso', text:'Ayúdanos a llegar a 100 para desbloquear el video', url});
  } else {
    navigator.clipboard.writeText(url);
    alert('Enlace copiado al portapapeles');
  }
});
