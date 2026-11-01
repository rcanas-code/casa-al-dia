// Prueba del escáner: foto con código EAN-13 → lectura → propuesta (Open Food Facts SIMULADO) → guardar → localizar en precios.
const { chromium, devices } = require('playwright');
const bwip = require('bwip-js');
const URL = process.argv[2] || 'http://localhost:8765/casa-al-dia.html';
const results = []; const check = (n, c) => results.push((c ? 'OK   ' : 'FALLO') + ' ' + n);
(async () => {
  const code = '4006381333931';
  const png = await bwip.toBuffer({ bcid: 'ean13', text: code, scale: 4, height: 18, includetext: true, paddingwidth: 30, paddingheight: 30, backgroundcolor: 'FFFFFF' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  let offCalls = 0;
  await page.route('https://world.openfoodfacts.org/**', (route) => {
    offCalls++;
    const notFound = route.request().url().includes('96385074');
    route.fulfill({ status: notFound ? 404 : 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(notFound ? { status: 0 } : { status: 1, product: { product_name_es: 'Rotulador de prueba', brands: 'MarcaX, Otra', quantity: '750 ml' } }) });
  });
  await page.goto(URL); await page.waitForSelector('#view > *');
  await page.click('[data-tab=productos]'); await page.click('#fab');
  await page.setInputFiles('#barcode-input', { name: 'codigo.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('[data-act=off-apply]', { timeout: 15000 });
  check('lee el código de la foto', (await page.inputValue('form[data-form=product] [name=barcode]')) === code);
  check('consulta Open Food Facts (simulado)', offCalls === 1);
  check('no rellena nada sin confirmar', (await page.inputValue('form[data-form=product] [name=name]')) === '');
  await page.click('[data-act=off-apply]');
  check('rellena nombre, marca y contenido al confirmar', (await page.inputValue('[name=name]')) === 'Rotulador de prueba' && (await page.inputValue('[name=brand]')) === 'MarcaX' && (await page.inputValue('[name=size]')) === '750' && (await page.inputValue('[name=unit]')) === 'ml');
  await page.click('form[data-form=product] button[type=submit]');
  await page.waitForSelector('text=Código de barras: ' + code);
  await page.click('[data-act=close-sheet]');
  // Mismo código en un producto nuevo → avisa de que ya existe
  await page.click('#fab');
  await page.setInputFiles('#barcode-input', { name: 'codigo.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#barcode-result :text("ya lo tienes")', { timeout: 15000 });
  check('detecta producto ya registrado con ese código', true);
  await page.click('[data-act=close-sheet]');
  // En precios: escanear localiza el producto
  await page.click('[data-tab=compra]'); await page.click('.btns [data-act=price-new]');
  await page.setInputFiles('#barcode-input', { name: 'codigo.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#barcode-result :text("Escribe el precio")', { timeout: 15000 });
  const sel = await page.$eval('form[data-form=price] [name=productId]', (e) => e.options[e.selectedIndex].text);
  check('en precios selecciona el producto escaneado', sel.startsWith('Rotulador de prueba'));
  // Imagen sin código → mensaje claro
  const blank = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; c.getContext('2d').fillRect(0, 0, 10, 10); return c.toDataURL('image/png').split(',')[1]; });
  await page.setInputFiles('#barcode-input', { name: 'nada.png', mimeType: 'image/png', buffer: Buffer.from(blank, 'base64') });
  await page.waitForSelector('#barcode-result .form-error', { timeout: 15000 });
  check('foto sin código: mensaje claro, sin inventar', (await page.textContent('#barcode-result')).includes('No se ha podido leer'));
  // Código no encontrado en OFF (EAN-8)
  await page.click('[data-act=close-sheet]'); await page.click('[data-tab=productos]'); await page.click('#fab');
  const png8 = await bwip.toBuffer({ bcid: 'ean8', text: '9638507', scale: 4, height: 18, paddingwidth: 30, paddingheight: 30, backgroundcolor: 'FFFFFF' });
  await page.setInputFiles('#barcode-input', { name: 'c8.png', mimeType: 'image/png', buffer: png8 });
  await page.waitForSelector('#barcode-result :text("No aparece en Open Food Facts")', { timeout: 15000 });
  check('código no encontrado: pide rellenar a mano', (await page.inputValue('[name=barcode]')) === '96385074');
  // Sin conexión a OFF → aviso
  await page.unroute('https://world.openfoodfacts.org/**');
  await page.route('https://world.openfoodfacts.org/**', (r) => r.abort());
  await page.click('[data-act=close-sheet]'); await page.click('#fab');
  await page.setInputFiles('#barcode-input', { name: 'c8.png', mimeType: 'image/png', buffer: png8 });
  await page.waitForSelector('#barcode-result :text("no se ha podido consultar")', { timeout: 15000 });
  check('sin conexión: avisa y deja rellenar a mano', true);
  check('sin errores de JavaScript', errors.length === 0); if (errors.length) console.log(errors);
  console.log(results.join('\n')); await browser.close();
  process.exit(results.some((r) => r.startsWith('FALLO')) ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.error(e.message); process.exit(1); });
