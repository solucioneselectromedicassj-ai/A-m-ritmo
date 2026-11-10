'use strict';
const { test, assert, ir } = require('./lib');

const P = `"'><img src=x onerror="window.__xss=1"><svg onload="window.__xss=2"></svg><script>window.__xss=3</script>`;
const esFecha = s => /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{2}:\d{2}$/.test(s);
// Reemplaza cada string (salvo fechas/horas) y, en la variante 2, también cada número, por el texto malicioso.
const envenenar = (x, numeros) => {
  if (typeof x === 'string') return esFecha(x) ? x : P;
  if (typeof x === 'number') return numeros ? P : x;
  if (Array.isArray(x)) return x.map(v => envenenar(v, numeros));
  if (x && typeof x === 'object') { const o = {}; Object.keys(x).forEach(k => { o[k] = envenenar(x[k], numeros); }); return o; }
  return x;
};
const ESTADO = () => ({
  v: 1, listo: true, modo: 'avisos', modulos: { ejercicio: true, pasos: true, agua: true, actividad: true, comida: true, medidas: true },
  settings: { creado: '2026-09-01', metaPasos: 8000, metaAgua: 2000, aeroMeta: 150, vaso: 250, recAgua: true, recMin: 90, aguaDesde: '08:00', aguaHasta: '22:00', notas: 'x', color: 'coral', informe: { periodo: 90, excluir: {} }, avisoAceptado: 1, hcUltimo: 1, hcAuto: false, ultimoRespaldo: 1, cuenta: { nombre: 'x', email: 'x', desde: 1 } },
  ejercicios: [{ id: 'e1', n: 'Giros', tipo: 'reps', meta: 30, nota: 'n', fig: 'giros' }, { id: 'e2', n: 'Puente', tipo: 'series', series: 2, reps: 8, nota: 'n', fig: 'puente' }, { id: 'e3', n: 'Plancha', tipo: 'tiempo', series: 2, seg: 15, nota: 'n', fig: 'plancha' }],
  sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '08:00', ej: ['e1', 'e2', 'e3'] }],
  medidas: [
    { id: 'm_presion', tipo: 'presion', n: 'Presión', campos: [{ k: 'sis', n: 'Máxima', u: 'mmHg', r: [50, 300], min: null, max: 130 }, { k: 'dia', n: 'Mínima', u: 'mmHg', r: [30, 200], min: null, max: 85 }, { k: 'pul', n: 'Pulso', u: 'lpm', r: [25, 250], opc: true, min: null, max: null }], repetirMeses: 2, recordarHora: '09:00' },
    { id: 'm_peso', tipo: 'peso', n: 'Peso', campos: [{ k: 'kg', n: 'Peso', u: 'kg', r: [20, 400], dec: 1, min: 70, max: 90 }], repetirMeses: null, recordarHora: '' },
    { id: 'm_spo2', tipo: 'spo2', n: 'Saturación', campos: [{ k: 'sat', n: 'Saturación', u: '%', r: [50, 100], min: 95, max: null }, { k: 'pul', n: 'Pulso', u: 'lpm', r: [25, 250], opc: true, min: null, max: null }], repetirMeses: null, recordarHora: '' }],
  registros: {
    m_presion: [{ fecha: '2026-11-10', hora: '09:10', sis: 150, dia: 95, pul: 70, origen: 'o', hc: 'h1' }, { fecha: '2026-10-10', sis: 120, dia: 80 }],
    m_peso: [{ fecha: '2026-10-10', kg: 80 }, { fecha: '2026-11-10', kg: 79 }],
    m_spo2: [{ fecha: '2026-11-10', hora: '08:00', sat: 90, pul: 70, origen: 'Samsung', hc: 'h2' }, { fecha: '2026-10-10', sat: 96 }] },
  days: { '2026-11-10': { pasos: 5000, agua: 1500, ej: { e1: 30, e2: 1 }, omit: { s1: true }, omitEj: { e3: true }, comida: { i1: true }, cont: { c1: 2 }, recupHecha: { e1: true } }, '2026-11-09': { pasos: 7000, agua: 2000, ej: { e1: 10 }, comida: { i1: true, i2: true } } },
  comida: { items: [{ id: 'i1', n: 'Fruta', obj: { t: 'min', d: 12 } }, { id: 'i2', n: 'Pescado', obj: { t: 'max', d: 4 } }], contadores: [{ id: 'c1', n: 'Fruta (porciones)', meta: 3 }] },
  aero: [{ fecha: '2026-11-08', min: 40, tipo: 'Caminata' }], molestias: { e1: true }, recup: { e1: 2 }, cerrados: { '2026-11-08|e1': true },
  recordatorios: [{ id: 'r1', txt: 'Fruta', hora: '16:00', dias: [1, 3] }], sensor: { last: 100, t: 1 },
  importado: { de: 'Salud Activa', fecha: 1, datos: { z: 'q' } }
});
const veneno = (variante, nativo) => async ({ abrir }) => {
  const E = envenenar(ESTADO(), variante === 2);
  // los campos que la app compara por valor exacto se conservan para que recorra todas las pantallas
  Object.assign(E, { v: 1, listo: true, modo: 'avisos', modulos: ESTADO().modulos });
  E.settings = Object.assign({}, E.settings, { creado: '2026-09-01', color: 'coral', avisoAceptado: 1, informe: { periodo: 90, excluir: {} }, aguaDesde: '08:00', aguaHasta: '22:00', recAgua: true, metaPasos: variante === 2 ? P : 8000 });
  E.ejercicios.forEach((e, i) => { e.id = 'e' + (i + 1); e.tipo = ['reps', 'series', 'tiempo'][i]; e.fig = ['giros', 'puente', 'plancha'][i]; });
  E.sesiones.forEach(s => { s.id = 's1'; s.ej = ['e1', 'e2', 'e3']; s.dias = [0, 1, 2, 3, 4, 5, 6]; s.hora = '08:00'; });
  E.medidas.forEach((m, i) => { m.id = ['m_presion', 'm_peso', 'm_spo2'][i]; m.tipo = ['presion', 'peso', 'spo2'][i]; m.campos.forEach((c, j) => { c.k = ESTADO().medidas[i].campos[j].k; }); });
  E.comida.items.forEach((x, i) => { x.id = 'i' + (i + 1); }); E.comida.contadores[0].id = 'c1'; E.recordatorios[0].id = 'r1';
  const { page, errores } = await abrir({ ls: { miplanV1: JSON.stringify(E) }, native: nativo ? true : undefined, fecha: '2026-11-10T12:00:00' });
  await page.addInitScript(() => { window.__xss = undefined; });
  const revisar = async (donde) => {
    const r = await page.evaluate(() => {
      const raros = [];
      document.querySelectorAll('*').forEach(el => { for (const a of el.attributes) if (/^on/i.test(a.name)) raros.push(el.tagName + '[' + a.name + ']'); if (el.tagName === 'SCRIPT' && !el.src && el.textContent.includes('__xss')) raros.push('SCRIPT'); });
      return { xss: window.__xss, imgs: document.querySelectorAll('img[src="x"]').length, raros: raros.slice(0, 5) };
    });
    assert.deepStrictEqual(r, { xss: undefined, imgs: 0, raros: [] }, 'XSS en ' + donde);
  };
  const tabs = ['hoy', 'ejercicio', 'medidas', 'habitos', 'ajustes'];
  for (const t of tabs) {
    await ir(page, t); await page.waitForTimeout(60); await revisar(t);
    // sub-pestañas y detalles
    for (const sel of ['#view .seg button', '#view details > summary']) {
      const n = await page.locator(sel).count();
      for (let i = 0; i < Math.min(n, 6); i++) { await page.locator(sel).nth(i).click({ force: true, timeout: 2000 }).catch(() => { }); await page.waitForTimeout(40); await revisar(`${t} ${sel} ${i}`); }
    }
  }
  // ventanas con datos precargados y el informe (se arma con innerHTML al imprimir)
  await ir(page, 'ajustes');
  for (const a of ['ej-edit', 'ses-edit', 'med-conf', 'rec-edit', 'ct-edit', 'ci-ren']) {
    const b = page.locator(`[data-a=${a}]`).first(); if (await b.count()) { await b.click({ force: true }).catch(() => { }); await page.waitForTimeout(60); await revisar('modal ' + a); await page.keyboard.press('Escape'); await page.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.hidden) { m.hidden = true; m.innerHTML = ''; } }); }
  }
  await page.evaluate(() => { document.querySelector('#informe').innerHTML = window.SA.informeCuerpo(); }); await revisar('informe');
  for (const id of [1000, 2000, 3001, 3601, 3700, 3800, 3900, 4001]) { await page.evaluate(i => window.SA.alTocarAviso(i), id).catch(() => { }); await revisar('aviso rápido ' + id); await page.evaluate(() => { const m = document.querySelector('#modal'); m.hidden = true; m.innerHTML = ''; }); }
  assert.deepStrictEqual(errores.filter(e => !/Failed to load resource/.test(e)), [], 'errores de consola');
};
test('auditoría XSS: todos los textos con código malicioso, en toda la app', veneno(1, false));
test('auditoría XSS: también los números reemplazados por código malicioso (datos importados hostiles)', veneno(2, false));
test('auditoría XSS: igual en la versión Android', veneno(1, true));
