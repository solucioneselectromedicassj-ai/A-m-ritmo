'use strict';
const fs = require('fs');
const path = require('path');
const { test, assert, estado, ir, texto } = require('./lib');
const { base, EJ, MED, TODOS } = require('./datos');

const RAIZ = path.join(__dirname, '..');
const completo = () => base({
  modo: 'avisos', modulos: TODOS, settings: { creado: '2026-10-01', metaPasos: 8000, metaAgua: 2000, aeroMeta: 150 },
  ejercicios: [EJ('e1', 'Giros de cadera con un nombre bastante largo para probar el ancho', 'reps'), EJ('e2', 'Puente', 'series'), EJ('e3', 'Plancha', 'tiempo')],
  sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '08:00', ej: ['e1', 'e2', 'e3'] }],
  medidas: [MED('presion'), MED('peso'), MED('colesterol')],
  registros: { m_presion: [{ fecha: '2026-10-17', sis: 128, dia: 82 }, { fecha: '2026-10-18', sis: 130, dia: 84 }], m_peso: [{ fecha: '2026-10-10', kg: 80 }, { fecha: '2026-10-18', kg: 79.5 }], m_colesterol: [{ fecha: '2026-06-10', ldl: 179 }, { fecha: '2026-10-01', ldl: 130 }] },
  days: { '2026-10-18': { pasos: 6000, agua: 1500, comida: { i1: true } }, '2026-10-19': { ej: { e1: 5 } } }, aero: [{ fecha: '2026-10-12', min: 40 }],
  comida: { items: [{ id: 'i1', n: 'Sin frituras' }], contadores: [{ id: 'c1', n: 'Pescado', meta: 2 }] }
});
const TABS = ['hoy', 'ejercicio', 'medidas', 'habitos', 'ajustes'];

async function revisar(page, donde) {
  const r = await page.evaluate(() => {
    const chicos = [...document.querySelectorAll('button, input:not([type=hidden]):not([hidden]), select, textarea, a')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.height && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden' && e.type !== 'file'; })
      .map(e => { const b = e.getBoundingClientRect(); const l = e.type === 'checkbox' && e.closest('label') ? e.closest('label').getBoundingClientRect() : b; return { t: (e.innerText || e.id || e.name || e.tagName).slice(0, 30), w: Math.round(l.width), h: Math.round(l.height) }; })
      .filter(x => x.h < 44 || x.w < 44);
    return { chicos, ancho: document.documentElement.scrollWidth, vp: window.innerWidth };
  });
  assert.deepStrictEqual(r.chicos, [], `${donde}: elementos táctiles menores a 44 px`);
  assert.ok(r.ancho <= r.vp, `${donde}: desborde horizontal (${r.ancho} > ${r.vp})`);
}

test('44 px y sin desborde a 360 px en cada pestaña', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: completo() });
  for (const t of TABS) { await ir(page, t); await revisar(page, t); }
  assert.deepStrictEqual(errores, []);
});

test('44 px y sin desborde en subpestañas de Hábitos y vistas de detalle', async ({ abrir }) => {
  const { page } = await abrir({ ls: completo() });
  await ir(page, 'habitos');
  for (const b of await page.$$eval('#view .seg button', bs => bs.map((_, i) => i))) { await page.locator('#view .seg button').nth(b).click(); await revisar(page, 'hábitos ' + b); }
  await ir(page, 'medidas');
  for (const b of await page.$$eval('#view .seg button', bs => bs.map((_, i) => i))) { await page.locator('#view .seg button').nth(b).click(); await revisar(page, 'medida ' + b); }
});

test('44 px y sin desborde en las pantallas con plan vacío y en el asistente', async ({ abrir }) => {
  let a = await abrir({ ls: base({ modulos: TODOS }) });
  for (const t of TABS) { await ir(a.page, t); await revisar(a.page, 'vacío ' + t); }
  a = await abrir();
  for (let i = 0; i < 7; i++) {
    await revisar(a.page, 'asistente paso ' + i);
    const sig = a.page.locator('#view [data-a^=wiz]').filter({ hasText: /Empezar|Siguiente|Seguir|Listo/ }).first();
    if (!(await sig.count())) break; await sig.click();
  }
});

test('modales: 44 px, sin desborde, se cierran con Escape, con cancelar y con el fondo', async ({ abrir }) => {
  const { page } = await abrir({ ls: completo() });
  await ir(page, 'ajustes');
  await page.click('[data-a=ej-nuevo]'); assert.ok(await page.isVisible('#modal')); await revisar(page, 'modal ejercicio');
  await page.keyboard.press('Escape'); assert.ok(await page.isHidden('#modal'));
  await page.click('[data-a=med-nueva]'); await revisar(page, 'modal medición');
  await page.click('[data-a=modal-cancel]'); assert.ok(await page.isHidden('#modal'));
  await page.click('[data-a=plan-bib]'); await revisar(page, 'modal biblioteca');
  await page.mouse.click(2, 2); assert.ok(await page.isHidden('#modal'), 'tocar el fondo cierra');
});

test('modal: un campo obligatorio vacío muestra el error y no guarda', async ({ abrir }) => {
  const { page } = await abrir({ ls: completo() });
  await ir(page, 'ajustes'); const n = (await estado(page)).ejercicios.length;
  await page.click('[data-a=ej-nuevo]'); await page.click('#modal button[type=submit]');
  assert.ok(await page.isVisible('#modal')); assert.strictEqual((await estado(page)).ejercicios.length, n);
});

test('service worker: CACHE propio y ASSETS alineados con build-web y con los archivos reales', async () => {
  const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8'), bw = fs.readFileSync(path.join(RAIZ, 'scripts/build-web.js'), 'utf8');
  assert.match(sw, /const CACHE\s*=\s*'miplan-v1'/);
  const assets = eval(sw.match(/const ASSETS = (\[.*?\]);/)[1]).filter(x => x !== './');
  const build = eval(bw.match(/const FILES = (\[.*?\]);/)[1]).filter(x => x !== 'sw.js');
  assert.deepStrictEqual(assets.slice().sort(), build.slice().sort());
  assets.forEach(f => assert.ok(fs.existsSync(path.join(RAIZ, f)), f + ' no existe'));
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  (html.match(/(?:src|href)="([^"#]+)"/g) || []).map(x => x.replace(/^(src|href)="|"$/g, '')).filter(x => !/^https?:/.test(x)).forEach(f => assert.ok(assets.includes(f), f + ' falta en ASSETS'));
});

test('sin conexión: tras la primera carga, la app abre desde el service worker', async ({ abrir }) => {
  const { page, ctx } = await abrir({ ls: completo() });
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(500);
  await ctx.setOffline(true); await page.reload(); await page.waitForFunction(() => window.SA);
  assert.match(await texto(page, 'body'), /Hoy/);
});

test('manifest e íconos', async () => {
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
  assert.strictEqual(m.name, 'Mi Plan'); assert.strictEqual(m.display, 'standalone'); assert.match(m.lang, /^es/);
  m.icons.forEach(i => assert.ok(fs.existsSync(path.join(RAIZ, i.src)), i.src));
});

test('XSS: textos con HTML no se ejecutan en ninguna pantalla', async ({ abrir }) => {
  const malo = '<img src=x onerror="window.__xss=1">';
  const d = JSON.parse(completo().miplanV1);
  d.ejercicios[0].n = malo; d.ejercicios[0].nota = malo; d.sesiones[0].n = malo; d.medidas[0].n = malo; d.medidas[0].campos[0].n = malo; d.medidas[0].campos[0].u = malo;
  d.comida.items[0].n = malo; d.comida.contadores[0].n = malo; d.settings.notas = malo; d.aero[0].tipo = malo;
  const { page, errores } = await abrir({ ls: { miplanV1: JSON.stringify(d) } });
  for (const t of TABS) { await ir(page, t); await page.waitForTimeout(80); }
  await ir(page, 'ejercicio'); await page.click('#view [data-a=ej-abrir]').catch(() => { });
  assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
  assert.strictEqual(await page.locator('#view img[src=x], #modal img[src=x]').count(), 0);
  assert.deepStrictEqual(errores.filter(e => !/Failed to load resource/.test(e)), []);
});
