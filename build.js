// Genera dist/casa-al-dia.html: un único archivo con todo incluido.
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const html = src('index.html')
  .replace('/*STYLE*/', () => src('styles.css'))
  .replace('/*VENDOR*/', () => '/* @zxing/library 0.23.0 — Apache License 2.0 — https://github.com/zxing-js/library */\n' + src('vendor/zxing.min.js'))
  .replace('/*LOGIC*/', () => src('logic.js'))
  .replace('/*APP*/', () => src('app.js'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'casa-al-dia.html'), html);
// Copia para alojamientos web (Netlify, GitHub Pages), que sirven index.html
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
console.log('dist/casa-al-dia.html', Math.round(html.length / 1024) + ' KB');
