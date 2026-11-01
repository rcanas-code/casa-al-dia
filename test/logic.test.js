const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/logic.js');

const T = '2026-11-01';

test('fechas: zona Europe/Madrid y sin desplazamientos', () => {
  // 23:30 UTC del 31-dic es ya 1-ene en Madrid
  assert.equal(L.todayISO(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
  assert.equal(L.addDays('2026-03-28', 2), '2026-03-30'); // cambio de hora
  assert.equal(L.diffDays('2026-10-24', '2026-10-26'), 2);
  assert.equal(L.isISODate('2026-02-30'), false);
});

test('meses de distinta duración y bisiestos', () => {
  assert.equal(L.nextChargeDate('2026-01-31', 'mensual', 31), '2026-02-28');
  assert.equal(L.nextChargeDate('2026-02-28', 'mensual', 31), '2026-03-31');
  assert.equal(L.nextChargeDate('2028-01-31', 'mensual', 31), '2028-02-29');
  assert.equal(L.nextChargeDate('2028-02-29', 'anual', 29), '2029-02-28');
  assert.equal(L.nextChargeDate('2026-11-01', 'otro'), null);
});

test('dinero sin errores de coma flotante', () => {
  assert.equal(L.parseMoney('12,95'), 1295);
  assert.equal(L.parseMoney('0.1'), 10);
  assert.equal(L.parseMoney('1.234,5'), 123450);
  assert.equal(L.parseMoney('-3'), null);
  assert.equal(L.parseMoney('1,999'), null);
  assert.equal(L.parseMoney('0,10') + L.parseMoney('0,20'), 30);
});

test('duración por cantidad y consumo diario, con conversión de unidades', () => {
  const p = { size: 12, unit: 'kg', stock: { mode: 'qty', remaining: 3, remUnit: 'kg', daily: 300, useUnit: 'g', asOf: T, reserves: 0 } };
  const e = L.estimate(p, T);
  assert.equal(e.status, 'ok');
  assert.equal(e.endDate, '2026-11-11'); // 3000 g / 300 g = 10 días
  assert.equal(e.daysLeft, 10);
  assert.equal(L.stockAlert(e, 7), 'ok');
  assert.equal(L.stockAlert(L.estimate(p, '2026-11-05'), 7), 'soon');
  assert.equal(L.stockAlert(L.estimate(p, '2026-11-12'), 7), 'out');
});

test('duración por días desde una fecha', () => {
  const p = { stock: { mode: 'days', days: 20, from: '2026-10-20' } };
  const e = L.estimate(p, T);
  assert.equal(e.endDate, '2026-11-09');
  assert.equal(e.daysLeft, 8);
});

test('consumo cero, datos incompletos y unidades incompatibles no inventan fechas', () => {
  const base = { mode: 'qty', remaining: 1, remUnit: 'l', asOf: T };
  assert.equal(L.estimate({ stock: { ...base, daily: 0, useUnit: 'ml' } }, T).status, 'noUse');
  assert.equal(L.estimate({ stock: { ...base, useUnit: 'ml' } }, T).status, 'incomplete');
  assert.equal(L.estimate({ stock: { ...base, daily: 5, useUnit: 'g' } }, T).status, 'incomplete');
  assert.equal(L.estimate({ stock: { mode: 'days', days: 10 } }, T).status, 'incomplete');
  assert.equal(L.estimate({}, T).status, 'none');
  assert.equal(L.stockAlert(L.estimate({}, T), 7), null);
});

test('compra de reserva no reinicia el envase abierto', () => {
  const p = { size: 12, unit: 'kg', stock: { mode: 'qty', remaining: 2, remUnit: 'kg', daily: 250, useUnit: 'g', asOf: '2026-10-30', reserves: 0 } };
  const after = L.applyPurchase(p, 1);
  assert.equal(after.stock.remaining, 2);
  assert.equal(after.stock.asOf, '2026-10-30');
  assert.equal(after.stock.reserves, 1);
  const e = L.estimate(after, T);
  assert.equal(e.openEnd, '2026-11-07'); // envase abierto sin cambios
  assert.equal(e.endDate, '2026-12-25'); // 14000 g / 250 = 56 días
  assert.throws(() => L.applyPurchase(p, 0));
  // Empezar envase: consume una reserva y reinicia el abierto
  const opened = L.startPack(after, T, { fromReserve: true });
  assert.equal(opened.stock.reserves, 0);
  assert.equal(opened.stock.remaining, 12);
  assert.equal(opened.stock.asOf, T);
});

test('precio unitario con g/ml y comparación de envases completos', () => {
  assert.equal(L.unitPriceCents(450, 500, 'g'), 900); // 9,00 €/kg
  assert.equal(L.unitPriceCents(199, 1500, 'ml'), 199 * 1000 / 1500);
  assert.equal(L.unitPriceCents(360, 12, 'ud'), 30);
  const product = { id: 'p1', size: 1, unit: 'kg' };
  const prices = [
    { id: 'a', productId: 'p1', storeId: 's1', priceCents: 4000, size: 12, unit: 'kg', date: '2026-10-01' }, // 3,33 €/kg
    { id: 'b', productId: 'p1', storeId: 's2', priceCents: 1200, size: 3, unit: 'kg', date: '2026-10-02' }, // 4 €/kg
    { id: 'c', productId: 'p1', storeId: 's2', priceCents: 99, size: 1, unit: 'l', date: '2026-10-02' } // incompatible
  ];
  // Necesito 3 kg: el saco de 12 kg es más barato por kilo pero supone más desembolso
  const r = L.bestOption({ needType: 'qty', amount: 3, unit: 'kg' }, product, prices);
  assert.equal(r.best.price.id, 'b');
  assert.equal(r.best.costCents, 1200);
  assert.equal(r.options.length, 2);
  // Necesito 10 kg: 1 saco de 12 kg (40 €) < 4 bolsas de 3 kg (48 €)
  assert.equal(L.bestOption({ needType: 'qty', amount: 10, unit: 'kg' }, product, prices).best.price.id, 'a');
  assert.equal(L.bestOption({ needType: 'qty', amount: 1, unit: 'l' }, product, prices).best.price.id, 'c');
  assert.equal(L.bestOption({ needType: 'qty', amount: 2, unit: 'ud' }, product, prices).status, 'incompatible');
});

test('se usa el último precio por tienda y formato, conservando historial', () => {
  const prices = [
    { productId: 'p', storeId: 's', priceCents: 500, size: 1, unit: 'kg', date: '2026-09-01' },
    { productId: 'p', storeId: 's', priceCents: 650, size: 1000, unit: 'g', date: '2026-10-01' }
  ];
  const latest = L.latestPrices(prices, 'p');
  assert.equal(latest.length, 1);
  assert.equal(latest[0].priceCents, 650);
});

test('lista sin duplicados', () => {
  const items = [{ id: '1', productId: 'p1' }, { id: '2', name: 'Pan' }, { id: '3', productId: 'p2', bought: true }];
  assert.equal(L.findDuplicate(items, { productId: 'p1' }).id, '1');
  assert.equal(L.findDuplicate(items, { name: ' pan ' }).id, '2');
  assert.equal(L.findDuplicate(items, { productId: 'p2' }), null); // ya comprado
});

test('cesta parcialmente calculable', () => {
  const products = { p1: { id: 'p1', size: 1, unit: 'kg' }, p2: { id: 'p2', size: 6, unit: 'ud' } };
  const prices = [
    { productId: 'p1', storeId: 's1', priceCents: 199, size: 1, unit: 'kg', date: T },
    { productId: 'p1', storeId: 's2', priceCents: 219, size: 1, unit: 'kg', date: T }
  ];
  const items = [
    { id: 'i1', productId: 'p1', needType: 'packs', amount: 2 },
    { id: 'i2', productId: 'p2', needType: 'packs', amount: 1 }, // sin precios
    { id: 'i3', name: 'Pilas', needType: 'qty' }, // manual
    { id: 'i4', productId: 'p1', needType: 'qty' }, // sin cantidad
    { id: 'i5', productId: 'p1', needType: 'packs', amount: 1, bought: true }
  ];
  const b = L.basket(items, products, prices);
  assert.equal(b.total, 398);
  assert.equal(b.partial, true);
  assert.equal(b.missing.length, 3);
  assert.equal(b.groups.length, 1);
  assert.equal(b.groups[0].storeId, 's1');
});

test('cobro mensual con renovación anual y aviso previo a fecha límite', () => {
  const r = { id: 'r', name: 'Seguro', status: 'revisar', frequency: 'mensual', amountCents: 2350,
    nextCharge: '2026-11-03', renewalDate: '2027-03-01', cancelDeadline: '2026-11-10', alertDeadlineDays: 15, alertChargeDays: 3, autoRenew: 'si' };
  const a = L.renewalAlerts(r, T);
  assert.deepEqual(a.map(x => x.kind).sort(), ['charge', 'deadline']);
  assert.equal(L.annualCostCents(2350, 'mensual'), 28200);
  // El cobro mensual avanza mes a mes; la renovación anual no se toca
  assert.equal(L.nextChargeDate(r.nextCharge, r.frequency, 3), '2026-12-03');
  // Fuera del margen no avisa
  assert.equal(L.renewalAlerts({ ...r, cancelDeadline: '2026-12-31', nextCharge: '2026-12-31' }, T).length, 0);
  // Fecha pasada: aviso "pasado", sin cambiar estado
  const past = L.renewalAlerts({ ...r, cancelDeadline: '2026-10-30' }, T).find(x => x.kind === 'deadline');
  assert.equal(past.level, 'past');
  assert.equal(r.status, 'revisar');
});

test('cancelación solicitada sigue avisando; confirmada no', () => {
  const r = { id: 'r', name: 'X', status: 'cancel_solicitada', nextCharge: '2026-11-02', alertChargeDays: 3 };
  assert.equal(L.renewalAlerts(r, T).length, 1);
  assert.equal(L.renewalAlerts({ ...r, status: 'cancel_confirmada' }, T).length, 0);
  assert.ok(L.renewalIncomplete({ name: 'X', status: 'revisar' }).includes('fecha límite para cancelar'));
});

test('ICS con recordatorio y líneas válidas', () => {
  const ics = L.buildICS([{ id: 'r1', name: 'Gimnasio, cuota', cancelDeadline: '2026-11-20', alertDeadlineDays: 7, nextCharge: '2026-12-01', amountCents: 3990, currency: 'EUR' }], new Date('2026-11-01T10:00:00Z'));
  assert.match(ics, /DTSTART;VALUE=DATE:20261120/);
  assert.match(ics, /TRIGGER:-P6DT15H/);
  assert.match(ics, /SUMMARY:Límite cancelar\/modificar: Gimnasio\\, cuota/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  ics.split('\r\n').forEach(l => assert.ok(Buffer.byteLength(l) <= 75, l));
});

test('validación de respaldo', () => {
  assert.equal(L.validateBackup({ app: 'otra' }).ok, false);
  assert.equal(L.validateBackup({ app: 'casa-al-dia', version: 1, data: { products: 'x' } }).ok, false);
  assert.equal(L.validateBackup({ app: 'casa-al-dia', version: 1, data: { products: [{ id: 'a', name: 'A' }] }, photos: { f: 'javascript:x' } }).ok, false);
  const ok = L.validateBackup({ app: 'casa-al-dia', version: 1, data: { products: [{ id: 'a', name: 'A' }] }, photos: { f: 'data:image/jpeg;base64,AA' } });
  assert.equal(ok.ok, true);
  assert.equal(ok.counts.products, 1);
});

test('códigos de barras: dígito de control', () => {
  assert.equal(L.cleanBarcode('4 006381 333931'), '4006381333931'); // espacios ignorados
  assert.equal(L.cleanBarcode('4006381333931'), '4006381333931'); // EAN-13 válido
  assert.equal(L.cleanBarcode('4006381333932'), null); // control incorrecto
  assert.equal(L.cleanBarcode('96385074'), '96385074'); // EAN-8
  assert.equal(L.cleanBarcode('123'), null);
});

test('Open Food Facts: solo usa datos presentes, sin inventar', () => {
  assert.deepEqual(L.parseQuantityText('1,5 L'), { size: 1.5, unit: 'l' });
  assert.deepEqual(L.parseQuantityText('33 cl'), { size: 330, unit: 'ml' });
  assert.deepEqual(L.parseQuantityText('500 g'), { size: 500, unit: 'g' });
  assert.equal(L.parseQuantityText('6 x 1 l'), null);
  assert.equal(L.parseQuantityText('aprox. mucho'), null);
  const r = L.parseOFF({ status: 1, product: { product_name_es: 'Leche entera', brands: 'Hacendado, Mercadona', quantity: '1 l' } });
  assert.deepEqual({ ...r, quantityText: undefined }, { name: 'Leche entera', brand: 'Hacendado', size: 1, unit: 'l', quantityText: undefined });
  const r2 = L.parseOFF({ status: 1, product: { product_name: 'Galletas', quantity: '4 x 200 g', product_quantity: 800, product_quantity_unit: 'g' } });
  assert.equal(r2.size, 800);
  assert.equal(L.parseOFF({ status: 1, product: { quantity: '6 x 1 l' } }), null);
  assert.equal(L.parseOFF({ status: 0 }), null);
});
