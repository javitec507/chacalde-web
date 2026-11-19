# chacalde.com

Sitio de los **Disque Consultorios Chacalde**: la persona escribe su nombre y obtiene su *Certificado de No Incapacidad* (contenido de humor, sin validez) en PDF y en fotos del consultorio (post 4:5 e historia 9:16). Todo se genera en el navegador; el nombre no se envía a ningún servidor.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

`Dockerfile` construye con Vite y corre `server/server.mjs` (Node, sin dependencias) como usuario `node`, en el puerto 80. El servidor:

- sirve `dist/` desde memoria (Brotli/gzip, ETag) con cabeceras de seguridad (CSP, HSTS, X-Frame-Options, nosniff…);
- cuenta de forma anónima visitas, certificados, PDF, impresiones, fotos, ZIP y compartidos (`POST /api/e`), por hora, en `/data/metrics.json`;
- muestra el panel de métricas en una ruta secreta (`ADMIN_PATH`, nunca `/admin`): usuarios con contraseña, CSV e imagen 9:16 para compartir.

En Coolify: *Build pack* = Dockerfile, puerto 80, almacenamiento persistente montado en `/data` y las variables `ADMIN_PATH` (ruta secreta del panel: `/` + 10 a 63 minúsculas, números o guiones), `ADMIN_PASSWORD` (12+ caracteres) y, opcional, `ADMIN_USER` (usuario del dueño, por defecto `admin`). Sin ruta o sin contraseña no hay panel; el sitio y el conteo siguen funcionando. Desde el panel, el dueño crea usuarios de solo lectura (contraseña generada, guardada con scrypt en `/data/users.json`).

No se guardan nombres, IP ni cookies de visitantes. Las visitas repetidas de un mismo navegador en 30 minutos cuentan una vez y cada navegador suma como máximo 20 eventos de un mismo tipo cada 10 minutos.

## Estructura

- `src/components/Certificate.jsx` – la nota (816×528 px = media carta).
- `src/lib/generate.js` – fotos (nombre en perspectiva sobre `public/scenes/*.jpg`), historias 9:16, PDF (`public/template.pdf` + nombre con pdf-lib) y ZIP.
- `src/data/scenes.json` – esquinas de la nota en cada foto.
- `src/lib/track.js` – envía el nombre de la acción (`visit`, `cert`, `pdf`…) al contador; nada sobre la persona.
- `server/` – servidor, contador (`metrics.mjs`) y panel (`admin.mjs`).
- `src/components/reactbits/` – componentes de [React Bits](https://reactbits.dev) (licencia en `LICENSE-react-bits.md`).
