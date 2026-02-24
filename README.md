# Proyecto "Un solo pulso" · Botón verde con contador y desbloqueo de video (Firebase + GitHub Pages)

Este proyecto crea una **página web** con un **botón verde** que incrementa un **contador** global en **Firebase Realtime Database**. 
Cuando el contador llega a **100** (o la meta que definas), **se desbloquea un video** (link configurable). 
La página puede alojarse **gratis** en **GitHub Pages** y el contador funciona con el **plan gratuito** de Firebase.

---

## 🚀 Características
- Botón verde con diseño responsive.
- Contador en tiempo real.
- Prevención básica de doble clic por dispositivo (localStorage).
- Umbral configurable (`TARGET_COUNT`).
- Enlace de video configurable (`VIDEO_URL`).
- Compartir por Web Share API o copiar al portapapeles.

> **Nota:** La prevención de doble clic por dispositivo es solo **disuasiva**. No evita que un usuario avanzado manipule el contador. Para campañas públicas, considera añadir verificación de identidad o rate limiting con Cloud Functions.

---

## 🧩 Estructura
```
qr_button_project/
├─ index.html
├─ style.css
├─ script.js
├─ config.example.js   ← copiar/renombrar a config.js con tus claves de Firebase
├─ rules.json          ← reglas de seguridad para Realtime Database
└─ README.md
```

---

## 🛠️ Paso a paso

### 1) Crear un proyecto en Firebase
1. Ve a https://console.firebase.google.com y crea un **Proyecto**.
2. Agrega una **app web** (icono `</>`), copia las **credenciales** del SDK Web.
3. Entra a **Realtime Database** → **Crear base de datos** → Ubicación → **Siguiente** → Modo bloqueado.
4. Abre **Reglas** y pega el contenido de `rules.json`. Guarda.

> Las reglas incluidas permiten:
> - Leer el contador públicamente.
> - Escribir solo incrementos atómicos + registrar un marcador por dispositivo (idempotencia simple).

### 2) Configurar credenciales
- Copia `config.example.js` como `config.js`.
- Pega tus credenciales de Firebase en `config.js`.

### 3) Ajustar parámetros
- Edita en `script.js`:
  - `TARGET_COUNT` (por defecto 100)
  - `VIDEO_URL` (URL de YouTube, Vimeo o archivo propio)
  - `PROJECT_ID` (nombre lógico del proyecto)

### 4) Probar en local
- Abre `index.html` en tu navegador.
- Verifica que el contador se muestra y que puedes presionar el botón.

> Si ves el aviso "Falta el archivo config.js", asegúrate de haber creado `config.js` con tus credenciales.

### 5) Publicar gratis en GitHub Pages
1. Crea un repositorio en GitHub, por ejemplo `un-solo-pulso`.
2. Sube los archivos de la carpeta `qr_button_project`.
3. En el repo: **Settings → Pages → Source: Deploy from a branch** → selecciona `main` y carpeta `/`.
4. Espera el despliegue. Obtendrás una URL del tipo `https://tuusuario.github.io/un-solo-pulso/`.

### 6) Generar el QR
- Usa cualquier generador de QR **gratuito** apuntando a la URL de GitHub Pages.
- Ejemplos: https://goqr.me/ o https://www.qr-code-generator.com/

> Consejo: prueba el QR con distintos móviles para validar que abre bien la página.

---

## 🔐 Seguridad y buenas prácticas
- **No expongas** otras rutas de la base: las reglas de `rules.json` limitan la escritura a incrementos válidos.
- Usa un `PROJECT_ID` diferente por campaña.
- Si necesitas **unidades únicas** (personas únicas), considera:
  - Registro con Google/Apple (Auth) y contar por `uid`.
  - Validación de servidor con Cloud Functions.

---

## 🧪 Personalización
- Cambia colores en `style.css`.
- Cambia textos en `index.html`.
- Si quieres **abrir el video automáticamente** al alcanzar la meta, añade:

```js
if (val >= TARGET_COUNT){
  window.location.href = VIDEO_URL;
}
```

(dentro de `updateStatus`, reemplazando la lógica de mostrar la sección de video).

---

## ❓FAQ
**¿Es gratis?** Sí: GitHub Pages y Firebase (plan Spark) bastan para este caso.

**¿Cuenta personas o clics?** Cuenta **presiones**. Se incluye una prevención básica por dispositivo; para conteo "de personas" real se requiere autenticación.

**¿Puedo cambiar la meta de 100?** Sí, edita `TARGET_COUNT`.

**¿Puedo usar un video privado?** Sí: enlaza Google Drive/Vimeo con permisos de visualización adecuados.

---

## 📄 Licencia
MIT. Úsalo, modifícalo y compártelo.
