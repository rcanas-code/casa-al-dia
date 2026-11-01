/* Casa al día — lógica pura (sin DOM). Se prueba con `node --test`. */
(function (root) {
  'use strict';
  var TZ = 'Europe/Madrid';

  // ---------- Fechas (cadenas 'AAAA-MM-DD', sin horas para evitar desplazamientos) ----------
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO(now) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(now || new Date());
  }
  function isISODate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
  }
  function toDayNum(s) { var p = s.split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
  function fromDayNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
  function addDays(s, n) { return fromDayNum(toDayNum(s) + n); }
  /** Días desde a hasta b (b - a). */
  function diffDays(a, b) { return toDayNum(b) - toDayNum(a); }
  function daysInMonth(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }
  /** Suma meses respetando el día de referencia (31 ene + 1 mes = 28/29 feb; luego vuelve a 31 mar). */
  function addMonths(s, n, anchorDay) {
    var p = s.split('-').map(Number);
    var t = (p[1] - 1) + n;
    var y = p[0] + Math.floor(t / 12);
    var m0 = ((t % 12) + 12) % 12;
    var day = Math.min(anchorDay || p[2], daysInMonth(y, m0));
    return y + '-' + pad(m0 + 1) + '-' + pad(day);
  }
  var FREQ_MONTHS = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
  /** Siguiente cobro según frecuencia; null si la frecuencia no es periódica. */
  function nextChargeDate(date, freq, anchorDay) {
    if (!isISODate(date)) return null;
    if (freq === 'semanal') return addDays(date, 7);
    var m = FREQ_MONTHS[freq];
    if (!m) return null;
    return addMonths(date, m, anchorDay);
  }
  /** Coste anual estimado en céntimos (no son cargos reales). */
  function annualCostCents(amountCents, freq) {
    if (!Number.isInteger(amountCents)) return null;
    if (freq === 'semanal') return amountCents * 52;
    var m = FREQ_MONTHS[freq];
    if (!m) return null;
    return amountCents * (12 / m);
  }
  function formatDate(s) {
    if (!isISODate(s)) return '—';
    var p = s.split('-').map(Number);
    var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return p[2] + ' ' + meses[p[1] - 1] + ' ' + p[0];
  }
  function relDays(n) {
    if (n === 0) return 'hoy';
    if (n === 1) return 'mañana';
    if (n === -1) return 'ayer';
    return n > 0 ? 'en ' + n + ' días' : 'hace ' + (-n) + ' días';
  }

  // ---------- Números y dinero (céntimos enteros) ----------
  /** Convierte '1,5' / '1.5' en número >= 0. Devuelve null si no es válido. */
  function parseNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
    if (typeof v !== 'string') return null;
    var s = v.trim().replace(/\s/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  /** '12,95 €' -> 1295. Sin coma flotante: se trabaja con la cadena. */
  function parseMoney(v) {
    if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
    if (typeof v !== 'string') return null;
    var s = v.trim().replace(/[\s€]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    var m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
    if (!m) return null;
    return parseInt(m[1], 10) * 100 + (m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0);
  }
  function formatMoney(cents, currency) {
    if (!Number.isFinite(cents)) return '—';
    try {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency || 'EUR' }).format(Math.round(cents) / 100);
    } catch (e) {
      return (Math.round(cents) / 100).toFixed(2).replace('.', ',') + ' ' + (currency || '');
    }
  }
  function centsToInput(c) { return Number.isInteger(c) ? (c / 100).toFixed(2).replace('.', ',') : ''; }
  function fmtNum(n, max) {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: max == null ? 2 : max }).format(n);
  }

  // ---------- Unidades ----------
  var UNITS = {
    g: { dim: 'masa', f: 1, label: 'g' },
    kg: { dim: 'masa', f: 1000, label: 'kg' },
    ml: { dim: 'volumen', f: 1, label: 'ml' },
    l: { dim: 'volumen', f: 1000, label: 'l' },
    ud: { dim: 'unidades', f: 1, label: 'ud.' }
  };
  function unitDim(u) { return UNITS[u] ? UNITS[u].dim : null; }
  function compatible(a, b) { return !!(UNITS[a] && UNITS[b] && UNITS[a].dim === UNITS[b].dim); }
  /** A unidad base: g, ml o ud. */
  function toBase(q, u) { return UNITS[u] && Number.isFinite(q) ? q * UNITS[u].f : null; }
  function validSize(size, unit) { return Number.isFinite(size) && size > 0 && !!UNITS[unit]; }
  function sizeLabel(size, unit) { return validSize(size, unit) ? fmtNum(size, 3) + ' ' + UNITS[unit].label : '—'; }
  /** Precio por kg, l o unidad en céntimos (número sin redondear). */
  function unitPriceCents(priceCents, size, unit) {
    if (!Number.isInteger(priceCents) || !validSize(size, unit)) return null;
    var base = toBase(size, unit);
    return UNITS[unit].dim === 'unidades' ? priceCents / base : priceCents * 1000 / base;
  }
  function unitPriceLabel(unit) {
    var d = unitDim(unit);
    return d === 'masa' ? '/kg' : d === 'volumen' ? '/l' : d === 'unidades' ? '/ud.' : '';
  }
  function formatBase(base, dim) {
    if (!Number.isFinite(base)) return '—';
    if (dim === 'masa') return base >= 1000 ? fmtNum(base / 1000, 2) + ' kg' : fmtNum(base, 0) + ' g';
    if (dim === 'volumen') return base >= 1000 ? fmtNum(base / 1000, 2) + ' l' : fmtNum(base, 0) + ' ml';
    return fmtNum(base, 2) + ' ud.';
  }

  // ---------- Existencias y previsión ----------
  /**
   * stock = { mode: 'none'|'qty'|'days', remaining, remUnit, daily, useUnit, asOf, days, from, reserves }
   * - qty: cantidad restante del envase abierto en la fecha asOf y consumo diario.
   * - days: "lo que tengo me dura X días" desde la fecha from.
   * Los envases de reserva (cerrados) se guardan aparte en reserves.
   */
  function estimate(product, today) {
    var s = (product && product.stock) || {};
    var reserves = Number.isInteger(s.reserves) && s.reserves > 0 ? s.reserves : 0;
    if (s.mode === 'qty') {
      var missing = [];
      if (!Number.isFinite(s.remaining) || s.remaining < 0 || !UNITS[s.remUnit]) missing.push('cantidad restante');
      if (!Number.isFinite(s.daily) || s.daily < 0 || !UNITS[s.useUnit]) missing.push('consumo diario');
      if (!isISODate(s.asOf)) missing.push('fecha');
      if (missing.length) return { status: 'incomplete', reason: 'Falta: ' + missing.join(', '), reserves: reserves };
      if (!compatible(s.remUnit, s.useUnit)) return { status: 'incomplete', reason: 'Unidades incompatibles entre cantidad y consumo', reserves: reserves };
      if (s.daily === 0) return { status: 'noUse', reason: 'Consumo diario 0: no se puede estimar', reserves: reserves };
      var remBase = toBase(s.remaining, s.remUnit);
      var dailyBase = toBase(s.daily, s.useUnit);
      var dim = unitDim(s.remUnit);
      var elapsed = Math.max(0, diffDays(s.asOf, today));
      var nowBase = Math.max(0, remBase - dailyBase * elapsed);
      var openEnd = addDays(s.asOf, Math.floor(remBase / dailyBase + 1e-9));
      var totalEnd = openEnd, reservesCounted = false;
      if (reserves > 0 && validSize(product.size, product.unit) && compatible(product.unit, s.remUnit)) {
        var resBase = reserves * toBase(product.size, product.unit);
        totalEnd = addDays(s.asOf, Math.floor((remBase + resBase) / dailyBase + 1e-9));
        reservesCounted = true;
      }
      return {
        status: 'ok', mode: 'qty', openEnd: openEnd, endDate: totalEnd,
        daysLeft: diffDays(today, totalEnd), openDaysLeft: diffDays(today, openEnd),
        nowLabel: formatBase(nowBase, dim), reserves: reserves, reservesCounted: reservesCounted
      };
    }
    if (s.mode === 'days') {
      if (!Number.isFinite(s.days) || s.days < 0 || !isISODate(s.from)) {
        return { status: 'incomplete', reason: 'Falta: número de días o fecha de inicio', reserves: reserves };
      }
      var end = addDays(s.from, Math.floor(s.days));
      return {
        status: 'ok', mode: 'days', openEnd: end, endDate: end, daysLeft: diffDays(today, end),
        openDaysLeft: diffDays(today, end), reserves: reserves, reservesCounted: false
      };
    }
    return { status: 'none', reserves: reserves };
  }
  /** Nivel de aviso: 'out' (estimado agotado), 'soon' (dentro del margen), 'ok' o null. */
  function stockAlert(est, warnDays) {
    if (!est || est.status !== 'ok') return null;
    if (est.daysLeft < 0) return 'out';
    if (est.daysLeft <= warnDays) return 'soon';
    return 'ok';
  }
  /** Registrar compra: solo suma envases de reserva. No toca el envase abierto. */
  function applyPurchase(product, packs) {
    if (!Number.isInteger(packs) || packs <= 0) throw new Error('Número de envases no válido');
    var s = Object.assign({}, product.stock || { mode: 'none' });
    s.reserves = (Number.isInteger(s.reserves) ? s.reserves : 0) + packs;
    return Object.assign({}, product, { stock: s });
  }
  /** Empezar un envase: usa uno de reserva (si hay y se indica) y reinicia la previsión del abierto. */
  function startPack(product, today, opts) {
    opts = opts || {};
    var s = Object.assign({}, product.stock || { mode: 'none' });
    var reserves = Number.isInteger(s.reserves) ? s.reserves : 0;
    if (opts.fromReserve && reserves > 0) s.reserves = reserves - 1;
    if (s.mode === 'qty') {
      if (!validSize(product.size, product.unit)) throw new Error('El producto no tiene contenido del envase');
      s.remaining = product.size; s.remUnit = product.unit; s.asOf = today;
      if (!UNITS[s.useUnit]) s.useUnit = product.unit;
    } else if (s.mode === 'days') {
      if (Number.isFinite(opts.days) && opts.days >= 0) s.days = opts.days;
      s.from = today;
    }
    return Object.assign({}, product, { stock: s });
  }

  // ---------- Precios y lista de compra ----------
  /** Último precio por tienda y formato (se conserva el historial completo aparte). */
  function latestPrices(prices, productId) {
    var map = {};
    (prices || []).forEach(function (p) {
      if (p.productId !== productId || !Number.isInteger(p.priceCents) || !validSize(p.size, p.unit)) return;
      var key = p.storeId + '|' + toBase(p.size, p.unit) + '|' + unitDim(p.unit);
      var cur = map[key];
      if (!cur || p.date > cur.date || (p.date === cur.date && (p.createdAt || 0) > (cur.createdAt || 0))) map[key] = p;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  /** Cantidad necesaria en unidad base, o null si no se puede saber. */
  function needBase(item, product) {
    var n = item.amount;
    if (!Number.isFinite(n) || n <= 0) return null;
    if (item.needType === 'packs') {
      if (!product || !validSize(product.size, product.unit)) return null;
      return { base: n * toBase(product.size, product.unit), dim: unitDim(product.unit) };
    }
    if (item.needType === 'qty' && UNITS[item.unit]) return { base: toBase(n, item.unit), dim: unitDim(item.unit) };
    return null;
  }
  /**
   * Mejor opción entre los precios registrados: menor desembolso comprando envases completos
   * de un mismo formato en una tienda. Empate: menos sobrante, luego precio más reciente.
   */
  function bestOption(item, product, prices) {
    if (!product) return { status: 'manual' };
    var need = needBase(item, product);
    if (!need) return { status: 'noQty' };
    var all = latestPrices(prices, product.id);
    if (!all.length) return { status: 'noPrice' };
    var cands = all.filter(function (p) { return unitDim(p.unit) === need.dim; }).map(function (p) {
      var packBase = toBase(p.size, p.unit);
      var packs = Math.ceil(need.base / packBase - 1e-9);
      return {
        price: p, packs: packs, costCents: packs * p.priceCents,
        excessBase: packs * packBase - need.base, dim: need.dim,
        unitPrice: unitPriceCents(p.priceCents, p.size, p.unit)
      };
    });
    if (!cands.length) return { status: 'incompatible' };
    cands.sort(function (a, b) {
      return a.costCents - b.costCents || a.excessBase - b.excessBase || (a.price.date < b.price.date ? 1 : -1);
    });
    return { status: 'ok', best: cands[0], options: cands, need: need };
  }
  /** Agrupa por tienda la mejor opción de cada artículo pendiente. */
  function basket(items, productsById, prices) {
    var groups = {}, missing = [], total = 0, count = 0;
    items.filter(function (i) { return !i.bought; }).forEach(function (i) {
      var r = bestOption(i, i.productId ? productsById[i.productId] : null, prices);
      if (r.status !== 'ok') { missing.push({ item: i, status: r.status }); return; }
      var sid = r.best.price.storeId;
      if (!groups[sid]) groups[sid] = { storeId: sid, lines: [], subtotal: 0 };
      groups[sid].lines.push({ item: i, option: r.best });
      groups[sid].subtotal += r.best.costCents;
      total += r.best.costCents; count++;
    });
    return {
      groups: Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.subtotal - a.subtotal; }),
      total: total, calculable: count, missing: missing, partial: missing.length > 0
    };
  }
  /** Busca un artículo pendiente del mismo producto (o mismo nombre manual) para evitar duplicados. */
  function findDuplicate(items, candidate) {
    var name = (candidate.name || '').trim().toLowerCase();
    return (items || []).find(function (i) {
      if (i.bought || i.id === candidate.id) return false;
      if (candidate.productId) return i.productId === candidate.productId;
      return !i.productId && (i.name || '').trim().toLowerCase() === name && name !== '';
    }) || null;
  }

  // ---------- Renovaciones ----------
  var STATUSES = {
    revisar: 'Pendiente de revisar', mantener: 'Mantener', negociar: 'Negociar',
    cancel_solicitada: 'Cancelación solicitada', cancel_confirmada: 'Cancelación confirmada'
  };
  /** Avisos de una renovación. No cambia ningún estado. */
  function renewalAlerts(r, today) {
    var out = [];
    if (!r || r.archived || r.status === 'cancel_confirmada') return out;
    if (r.status !== 'mantener' && isISODate(r.cancelDeadline)) {
      var d = diffDays(today, r.cancelDeadline);
      var lead = Number.isInteger(r.alertDeadlineDays) ? r.alertDeadlineDays : 15;
      if (d < 0) out.push({ kind: 'deadline', level: 'past', days: d, date: r.cancelDeadline });
      else if (d <= lead) out.push({ kind: 'deadline', level: d <= 3 ? 'urgent' : 'soon', days: d, date: r.cancelDeadline });
    }
    if (isISODate(r.nextCharge)) {
      var c = diffDays(today, r.nextCharge);
      var leadC = Number.isInteger(r.alertChargeDays) ? r.alertChargeDays : 3;
      if (c < 0) out.push({ kind: 'charge', level: 'past', days: c, date: r.nextCharge });
      else if (c <= leadC) out.push({ kind: 'charge', level: c <= 1 ? 'urgent' : 'soon', days: c, date: r.nextCharge });
    }
    return out;
  }
  function renewalIncomplete(r) {
    var f = [];
    if (!isISODate(r.cancelDeadline) && r.status !== 'cancel_confirmada') f.push('fecha límite para cancelar');
    if (!r.autoRenew || r.autoRenew === 'desconocida') f.push('renovación automática');
    if (!isISODate(r.nextCharge) && r.status !== 'cancel_confirmada') f.push('próximo cobro');
    if (!Number.isInteger(r.amountCents)) f.push('importe');
    return f;
  }

  // ---------- Calendario (.ics) ----------
  function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, function (m) { return '\\' + m; }); }
  function icsFold(line) {
    var out = [], cur = '';
    Array.from(line).forEach(function (ch) {
      if (new TextEncoder().encode(cur + ch).length > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch;
    });
    out.push(cur);
    return out.join('\r\n');
  }
  function icsTrigger(daysBefore) {
    // Evento de día completo: el aviso suena a las 9:00 del día correspondiente.
    if (daysBefore <= 0) return 'PT9H';
    return '-P' + (daysBefore - 1) + 'DT15H';
  }
  function buildICS(renewals, stampDate) {
    var stamp = (stampDate || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Casa al dia//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    function ev(uid, date, summary, desc, daysBefore) {
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@casa-al-dia', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(date, 1).replace(/-/g, ''),
        'SUMMARY:' + icsEscape(summary), 'DESCRIPTION:' + icsEscape(desc),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(summary), 'TRIGGER:' + icsTrigger(daysBefore), 'END:VALARM',
        'END:VEVENT');
    }
    (renewals || []).forEach(function (r) {
      if (r.archived || r.status === 'cancel_confirmada') return;
      var info = [r.provider, r.notes, r.url].filter(Boolean).join('\n');
      if (isISODate(r.cancelDeadline)) ev(r.id + '-limite', r.cancelDeadline, 'Límite cancelar/modificar: ' + r.name, info, Number.isInteger(r.alertDeadlineDays) ? r.alertDeadlineDays : 15);
      if (isISODate(r.nextCharge)) ev(r.id + '-cobro-' + r.nextCharge, r.nextCharge, 'Cobro: ' + r.name + (Number.isInteger(r.amountCents) ? ' (' + formatMoney(r.amountCents, r.currency) + ')' : ''), info, Number.isInteger(r.alertChargeDays) ? r.alertChargeDays : 3);
    });
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }

  // ---------- Respaldo ----------
  var COLLECTIONS = ['products', 'stores', 'prices', 'list', 'renewals', 'purchases'];
  /** Valida un respaldo. Devuelve { ok, errors, counts }. */
  function validateBackup(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ['El archivo no contiene un respaldo válido.'] };
    if (obj.app !== 'casa-al-dia') errors.push('El archivo no es un respaldo de Casa al día.');
    if (typeof obj.version !== 'number' || obj.version > 1) errors.push('Versión de respaldo no compatible.');
    var data = obj.data || {};
    var counts = {};
    COLLECTIONS.forEach(function (c) {
      if (data[c] === undefined) { counts[c] = 0; return; }
      if (!Array.isArray(data[c])) { errors.push('La sección "' + c + '" no es una lista.'); return; }
      var bad = data[c].filter(function (x) { return !x || typeof x !== 'object' || typeof x.id !== 'string'; });
      if (bad.length) errors.push('La sección "' + c + '" tiene ' + bad.length + ' registros sin identificador.');
      counts[c] = data[c].length;
    });
    if (Array.isArray(data.products)) data.products.forEach(function (p) { if (p && typeof p.name !== 'string') errors.push('Hay un producto sin nombre.'); });
    if (Array.isArray(data.renewals)) data.renewals.forEach(function (r) { if (r && typeof r.name !== 'string') errors.push('Hay una renovación sin nombre.'); });
    var photos = obj.photos || {};
    if (typeof photos !== 'object' || Array.isArray(photos)) errors.push('Las fotos no tienen el formato esperado.');
    else Object.keys(photos).forEach(function (k) {
      if (typeof photos[k] !== 'string' || photos[k].indexOf('data:image/') !== 0) errors.push('La foto ' + k + ' no es una imagen válida.');
    });
    counts.photos = typeof photos === 'object' ? Object.keys(photos).length : 0;
    return { ok: errors.length === 0, errors: errors.slice(0, 8), counts: counts };
  }

  var api = {
    TZ: TZ, todayISO: todayISO, isISODate: isISODate, addDays: addDays, diffDays: diffDays, addMonths: addMonths,
    nextChargeDate: nextChargeDate, annualCostCents: annualCostCents, formatDate: formatDate, relDays: relDays,
    parseNum: parseNum, parseMoney: parseMoney, formatMoney: formatMoney, centsToInput: centsToInput, fmtNum: fmtNum,
    UNITS: UNITS, unitDim: unitDim, compatible: compatible, toBase: toBase, validSize: validSize, sizeLabel: sizeLabel,
    unitPriceCents: unitPriceCents, unitPriceLabel: unitPriceLabel, formatBase: formatBase,
    estimate: estimate, stockAlert: stockAlert, applyPurchase: applyPurchase, startPack: startPack,
    latestPrices: latestPrices, needBase: needBase, bestOption: bestOption, basket: basket, findDuplicate: findDuplicate,
    STATUSES: STATUSES, renewalAlerts: renewalAlerts, renewalIncomplete: renewalIncomplete,
    buildICS: buildICS, COLLECTIONS: COLLECTIONS, validateBackup: validateBackup
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Logic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
