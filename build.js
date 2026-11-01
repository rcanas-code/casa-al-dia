// Genera dist/casa-al-dia.html: un único archivo con todo incluido.
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const html = src('index.html')
  .replace('/*STYLE*/', () => src('styles.css'))
  .replace('/*LOGIC*/', () => src('logic.js'))
  .replace('/*APP*/', () => src('app.js'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'casa-al-dia.html'), html);
console.log('dist/casa-al-dia.html', Math.round(html.length / 1024) + ' KB');
