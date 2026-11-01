# Casa al día — instrucciones para Claude

Usuario: Raúl Cañas (pocos conocimientos técnicos, usa Mac e iPhone). Responder en español, directo y sencillo. Si algo es ambiguo, preguntar. Presentar opciones con ventajas cuando haya varias.

## Qué es
Web app personal (un único HTML, sin dependencias en ejecución) para productos del hogar, precios por tienda, lista de compra y renovaciones. Ver README.md para funciones, pendientes (versión B) y visión futura.

## Dónde está publicada
- Página privada de claude.ai (artifact): slug `c7fff795-8f56-4481-a6e6-b8b9f0143fa1`, URL https://claude.ai/artifact/RhRADjNsfwwsEduc5UWWmW. Capacidad declarada: `downloads`.
- Republicar: `node build.js` y luego publish_files con `dist/casa-al-dia.html` como `index.html` (slug + base_version actual de get_artifact).
- Netlify: preparado (`netlify.toml`, publica `dist/`), aún no conectado. Supabase (datos compartidos con Mónica): pendiente.

## Estructura
- `src/logic.js`: cálculos puros (fechas Europe/Madrid como 'AAAA-MM-DD', dinero en céntimos, unidades, previsión, cesta, renovaciones, ICS, respaldo, códigos de barras).
- `src/app.js`: interfaz y almacenamiento IndexedDB. `src/styles.css`, `src/index.html` (plantilla), `src/vendor/zxing.min.js` (lector de códigos, Apache-2.0).
- `build.js` → `dist/casa-al-dia.html` y `dist/index.html`.

## Pruebas (ejecutar antes de publicar)
```bash
node --test test/*.test.js
python3 -m http.server 8765 --directory dist   # en segundo plano
NODE_PATH=$(npm root -g):./node_modules node test/e2e.js
NODE_PATH=$(npm root -g):./node_modules node test/e2e-barcode.js   # requiere npm install (bwip-js)
```

## Reglas del usuario
- No simular funciones ni declarar verificaciones no hechas. No afirmar pruebas en iPhone real.
- No inventar datos (precios, plazos de cancelación, datos de fotos). Lo leído de fotos o bases externas siempre se confirma antes de guardar.
- Datos de demo marcados `demo: true`; nunca subir datos reales.
- No conectar cuentas ni contratar servicios sin pedirlo.
