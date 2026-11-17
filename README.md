# chacalde.com

Sitio de los **Disque Consultorios Chacalde**: la persona escribe su nombre y obtiene su *Certificado de No Incapacidad* (contenido de humor, sin validez) en PDF y en fotos del consultorio (post 4:5 e historia 9:16). Todo se genera en el navegador; el nombre no se envía a ningún servidor.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

`Dockerfile` construye con Vite y sirve `dist/` con nginx (puerto 80). En Coolify: *Build pack* = Dockerfile, puerto expuesto 80.

## Estructura

- `src/components/Certificate.jsx` – la nota (816×528 px = media carta).
- `src/lib/generate.js` – fotos (nombre en perspectiva sobre `public/scenes/*.jpg`), historias 9:16, PDF (`public/template.pdf` + nombre con pdf-lib) y ZIP.
- `src/data/scenes.json` – esquinas de la nota en cada foto.
- `src/components/reactbits/` – componentes de [React Bits](https://reactbits.dev) (licencia en `LICENSE-react-bits.md`).
