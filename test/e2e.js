// Prueba de recorrido en Chromium con tamaño de iPhone. Uso: node test/e2e.js [url]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = process.argv[2] || 'http://localhost:8765/casa-al-dia.html';
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function check(name, cond) { results.push((cond ? 'OK   ' : 'FALLO') + ' ' + name); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: false });
  const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__casa.S)));

  await page.goto(URL);
  await page.waitForSelector('.section-title');
  await shot('01-hoy');
  let s = await S();
  check('demo cargada al primer arranque', s.products.length === 4 && s.renewals.length === 3);
  check('Hoy muestra urgentes y semana', (await page.textContent('#view')).includes('Próximos 7 días'));
  check('Hoy muestra cancelación pendiente de confirmar', (await page.textContent('#view')).includes('Plataforma de vídeo (demo)'));

  // Producto nuevo con foto
  await page.click('[data-tab=productos]');
  await shot('02-productos');
  await page.click('#fab');
  await page.fill('form[data-form=product] [name=name]', 'Pienso real Ginger');
  await page.fill('form[data-form=product] [name=brand]', 'MiMarca');
  await page.fill('form[data-form=product] [name=category]', 'Mascotas');
  await page.fill('form[data-form=product] [name=size]', '3');
  await page.selectOption('form[data-form=product] [name=unit]', 'kg');
  // imagen de prueba generada (PNG 1600x1200)
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const g = c.getContext('2d'); g.fillStyle = '#c84'; g.fillRect(0, 0, 1600, 1200); g.fillStyle = '#fff'; g.fillRect(200, 200, 400, 400); return c.toDataURL('image/png').split(',')[1]; });
  await page.setInputFiles('#photo-input', { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForSelector('#photo-preview img');
  await page.click('form[data-form=product] button[type=submit]');
  await page.waitForSelector('text=Registrar compra');
  await shot('03-producto-detalle');
  s = await S();
  const real = s.products.find((p) => p.name === 'Pienso real Ginger');
  check('producto real creado sin marca demo', real && !real.demo);
  const photoLen = await page.evaluate((id) => (window.__casa.photos[id] || '').length, real.photoId);
  check('foto comprimida a JPEG (<200 KB)', photoLen > 0 && photoLen < 200000 && (await page.evaluate((id) => window.__casa.photos[id].startsWith('data:image/jpeg'), real.photoId)));

  // Corregir existencias: cantidad y consumo
  await page.click('[data-act=stock-correct]');
  await page.click('label:has(input[name=mode][value=qty])');
  await page.fill('[name=remaining]', '2,5');
  await page.selectOption('[name=remUnit]', 'kg');
  await page.fill('[name=daily]', '250');
  await page.selectOption('[name=useUnit]', 'g');
  await page.click('form[data-form=stock] button[type=submit]');
  await page.waitForSelector('.estimate');
  check('previsión 2,5 kg / 250 g = 10 días', (await page.textContent('.estimate')).includes('Días restantes estimados: 10'));
  // Error de unidades incompatibles
  await page.click('[data-act=stock-correct]');
  await page.selectOption('[name=useUnit]', 'ml');
  await page.click('form[data-form=stock] button[type=submit]');
  check('rechaza unidades incompatibles', (await page.textContent('.form-error')).includes('no son compatibles'));
  await page.selectOption('[name=useUnit]', 'g');
  await page.click('form[data-form=stock] button[type=submit]');
  await page.waitForSelector('.estimate');

  // Registrar compra de reserva: no reinicia
  await page.click('[data-act=stock-purchase]');
  await page.fill('[name=packs]', '1');
  await page.click('form[data-form=purchase] button[type=submit]');
  await page.waitForSelector('text=Envases de reserva (cerrados)');
  s = await S();
  let rp = s.products.find((p) => p.id === real.id);
  check('compra suma 1 reserva y no reinicia el abierto', rp.stock.reserves === 1 && rp.stock.remaining === 2.5);
  check('compra registrada una sola vez', s.purchases.filter((x) => x.productId === real.id).length === 1);

  // Precios seguidos manteniendo tienda
  await page.click('[data-act=price-new][data-id]');
  await page.selectOption('form[data-form=price] [name=storeId]', '__new');
  await page.fill('[name=newStore]', 'Mercado Real');
  await page.fill('form[data-form=price] [name=price]', '12,90');
  await page.click('button[value=again]');
  await page.waitForFunction(() => { const f = document.querySelector('form[data-form=price]'); return f && f.price.value === ''; });
  const keptStore = await page.$eval('form[data-form=price] [name=storeId]', (e) => e.options[e.selectedIndex].text);
  check('mantiene la tienda tras «Guardar y añadir otro»', keptStore === 'Mercado Real');
  await page.selectOption('form[data-form=price] [name=productId]', real.id);
  await page.fill('form[data-form=price] [name=size]', '12');
  await page.fill('form[data-form=price] [name=price]', '39,90');
  check('muestra precio unitario', (await page.textContent('#unit-preview')).includes('3,33'));
  await page.click('form[data-form=price] button[value=close]');
  await page.waitForTimeout(300);

  // Lista: añadir y duplicado
  await page.click('[data-tab=compra]');
  await page.click('#fab');
  await page.selectOption('form[data-form=list] [name=productId]', real.id);
  await page.click('label:has(input[name=needType][value=qty])');
  await page.fill('form[data-form=list] [name=amount]', '3');
  await page.selectOption('form[data-form=list] [name=unit]', 'kg');
  await page.click('form[data-form=list] button[type=submit]');
  await page.waitForTimeout(300);
  await page.click('#fab');
  await page.selectOption('form[data-form=list] [name=productId]', real.id);
  await page.fill('form[data-form=list] [name=amount]', '2');
  await page.click('form[data-form=list] button[type=submit]');
  await page.waitForSelector('#dialog:not([hidden])');
  check('detecta duplicado y ofrece actualizar', (await page.textContent('#dialog-box')).includes('ya está en la lista'));
  await page.click('#dialog-box button:has-text("Sustituir cantidad")');
  await page.waitForTimeout(300);
  s = await S();
  const items = s.list.filter((i) => i.productId === real.id);
  check('sin duplicados en la lista', items.length === 1 && items[0].needType === 'packs' && items[0].amount === 2);
  const txt = await page.textContent('#view');
  check('mejor opción: 2×3 kg = 25,80 € (no el saco de 12 kg)', txt.includes('25,80'));
  check('total parcial por artículo sin precio', txt.includes('Total parcial'));
  await shot('04-compra');

  // Marcar comprado → registrar compra (una sola vez)
  const itemId = items[0].id;
  await page.click(`[data-act=list-toggle][data-id="${itemId}"]`);
  await page.click('#dialog-box button:has-text("Registrar compra")');
  await page.waitForSelector('form[data-form=purchase]');
  check('propone 2 envases desde la lista', (await page.inputValue('[name=packs]')) === '2');
  await page.click('form[data-form=purchase] button[type=submit]');
  await page.waitForTimeout(300);
  await page.click('[data-act=close-sheet]');
  await page.click('details.card summary');
  await page.click(`[data-act=list-untoggle][data-id="${itemId}"]`);
  await page.waitForTimeout(200);
  await page.click(`[data-act=list-toggle][data-id="${itemId}"]`);
  await page.waitForTimeout(300);
  s = await S();
  rp = s.products.find((p) => p.id === real.id);
  check('volver a marcar no suma dos veces la compra', rp.stock.reserves === 3 && s.purchases.filter((x) => x.productId === real.id).length === 2);

  // Renovación real
  await page.click('[data-tab=renovaciones]');
  await shot('05-renovaciones');
  await page.click('#fab');
  await page.fill('form[data-form=renewal] [name=name]', 'Seguro coche real');
  await page.fill('form[data-form=renewal] [name=amount]', '35,50');
  const t = await page.evaluate(() => window.__casa.L.todayISO());
  const plus = (n) => page.evaluate(([d, n]) => window.__casa.L.addDays(d, n), [t, n]);
  await page.fill('form[data-form=renewal] [name=nextCharge]', await plus(2));
  await page.click('form[data-form=renewal] button[type=submit]');
  await page.waitForSelector('text=Estado (lo cambias tú)');
  check('sin fecha límite muestra «Pendiente de comprobar»', (await page.textContent('#sheet-panel')).includes('Pendiente de comprobar'));
  await page.check('input[data-act=renewal-status][value=cancel_solicitada]');
  await page.waitForTimeout(300);
  s = await S();
  check('estado cancelación solicitada (no confirmada)', s.renewals.find((r) => r.name === 'Seguro coche real').status === 'cancel_solicitada');
  await shot('06-renovacion-detalle');
  await page.click('[data-act=close-sheet]');

  // Persistencia tras recargar
  await page.reload();
  await page.waitForSelector('#view > *');
  s = await S();
  check('persistencia tras recargar', s.products.some((p) => p.name === 'Pienso real Ginger') && s.renewals.some((r) => r.name === 'Seguro coche real'));
  check('foto persiste tras recargar', (await page.evaluate((id) => !!window.__casa.photos[id], real.photoId)));
  await page.click('[data-tab=hoy]');
  check('Hoy lista la cancelación solicitada real', (await page.textContent('#view')).includes('Seguro coche real'));

  // Respaldo: exportar
  await page.click('[data-act=settings]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=export]')]);
  const backupPath = path.join(OUT, 'respaldo.json');
  await dl.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  check('respaldo incluye datos y fotos', backup.app === 'casa-al-dia' && backup.data.products.length === 5 && Object.keys(backup.photos).length === 1);
  await page.click('[data-act=close-sheet]');

  // Borrar demo sin tocar reales
  await page.click('.banner [data-act=demo-clear]');
  await page.click('#dialog-box button:has-text("Borrar demostración")');
  await page.waitForTimeout(400);
  s = await S();
  check('borrar demo conserva reales', s.products.length === 1 && s.products[0].name === 'Pienso real Ginger' && s.renewals.length === 1 && s.stores.length === 1 && s.prices.length === 2);

  // Importar archivo inválido
  await page.click('[data-act=settings]');
  await page.setInputFiles('#import-input', { name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"otra"}') });
  await page.waitForSelector('#dialog:not([hidden])');
  check('rechaza respaldo inválido sin cambiar nada', (await page.textContent('#dialog-box')).includes('No se puede importar'));
  await page.click('#dialog-box button');
  // Importar respaldo válido (con demo) → confirmación → sustituye
  await page.setInputFiles('#import-input', backupPath);
  await page.waitForSelector('#dialog:not([hidden])');
  check('pide confirmación antes de sustituir', (await page.textContent('#dialog-box')).includes('Se sustituirán'));
  await page.click('#dialog-box button:has-text("Sustituir mis datos")');
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForSelector('#view > *');
  s = await S();
  check('importación restaura datos y foto', s.products.length === 5 && (await page.evaluate((id) => !!window.__casa.photos[id], real.photoId)));

  // ICS (fuera de claude.ai)
  await page.click('[data-tab=renovaciones]');
  await page.click('[data-act=ics]');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=ics-download]')]);
  const icsPath = path.join(OUT, 'renovaciones.ics');
  await dl2.saveAs(icsPath);
  const ics = fs.readFileSync(icsPath, 'utf8');
  check('ics generado con eventos y alarmas', ics.includes('BEGIN:VEVENT') && ics.includes('BEGIN:VALARM'));
  await page.click('[data-act=close-sheet]');

  // Desbordamiento horizontal en pantalla de iPhone
  for (const tab of ['hoy', 'productos', 'compra', 'renovaciones']) {
    await page.click(`[data-tab=${tab}]`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check('sin desbordamiento horizontal en ' + tab, !over);
  }
  await page.click('[data-tab=hoy]');
  await shot('07-hoy-final');
  check('sin errores de JavaScript', errors.length === 0);
  if (errors.length) console.log(errors);
  console.log(results.join('\n'));
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FALLO')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e); process.exit(1); });
