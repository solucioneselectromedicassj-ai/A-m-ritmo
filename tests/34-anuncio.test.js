'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, EJ, MED, TODOS } = require('./datos');

const plan = () => base({ modulos: TODOS, ejercicios: [EJ('e1', 'Giros', 'reps')], sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '', ej: ['e1'] }], medidas: [MED('presion')], settings: { creado: '2026-10-01' } });
const lugares = page => page.$$eval('#view .anuncio', xs => xs.map(x => x.dataset.lugar));
const sub = (page, n) => page.locator('#view .seg').first().locator('button').nth(n).click();

test('anuncio de ejemplo: solo en Ajustes y en las pantallas de Evolución, rotulado "Publicidad"', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: plan() });
  await ir(page, 'ajustes'); assert.deepStrictEqual(await lugares(page), ['ajustes']); assert.match(await texto(page), /PUBLICIDAD · EJEMPLO|Publicidad · ejemplo/i);
  await ir(page, 'ejercicio'); assert.deepStrictEqual(await lugares(page), ['evolucion-ejercicio']);
  await ir(page, 'habitos'); await sub(page, 0); assert.deepStrictEqual(await lugares(page), ['evolucion-pasos']);
  await sub(page, 2); assert.deepStrictEqual(await lugares(page), ['evolucion-actividad']);
  assert.deepStrictEqual(errores, []);
});

test('anuncio de ejemplo: nunca en Hoy, mediciones, agua, alimentación, el asistente ni los avisos', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  assert.deepStrictEqual(await lugares(page), [], 'Hoy');
  await ir(page, 'medidas'); assert.deepStrictEqual(await lugares(page), [], 'Medidas');
  await ir(page, 'habitos'); await sub(page, 1); assert.deepStrictEqual(await lugares(page), [], 'Agua'); await sub(page, 3); assert.deepStrictEqual(await lugares(page), [], 'Alimentación');
  assert.strictEqual(await page.locator('#modal .anuncio, .card.warn .anuncio, .rapido .anuncio').count(), 0);
  const nuevo = await abrir({}); assert.strictEqual(await nuevo.page.locator('.anuncio').count(), 0, 'asistente inicial');
});

test('anuncio de ejemplo: se puede apagar desde Ajustes y queda guardado; no tapa botones ni desborda', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ejercicio');
  const r = await page.evaluate(() => { const a = document.querySelector('.anuncio').getBoundingClientRect(); return { w: Math.round(a.width), vp: window.innerWidth, ancho: document.documentElement.scrollWidth, interactivos: document.querySelectorAll('.anuncio button, .anuncio a, .anuncio input').length }; });
  assert.ok(r.w <= r.vp && r.ancho <= r.vp, 'sin desborde'); assert.strictEqual(r.interactivos, 0, 'sin botones ni links (sin toques por error)');
  await ir(page, 'ajustes'); await page.uncheck('[data-a=anuncios-demo]');
  assert.strictEqual((await estado(page)).settings.anunciosDemo, false); assert.strictEqual(await page.locator('.anuncio').count(), 0);
  await page.reload(); await page.waitForFunction(() => window.SA); await ir(page, 'ejercicio'); assert.strictEqual(await page.locator('.anuncio').count(), 0, 'queda apagado');
});
