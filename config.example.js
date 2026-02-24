// Copia este archivo como config.js y pega tus credenciales de Firebase
// NUNCA publiques claves sensibles en repositorios públicos si no deseas exponer tu proyecto.
// Para este caso (Realtime Database + reglas), las credenciales del SDK web son públicas por diseño, 
// pero protege tu base con reglas (ver rules.json) y considera restringir dominios en Firebase Hosting si lo usas.

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
