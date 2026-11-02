'use strict';
const { test, assert, estado, ir } = require('./lib');
const { base, EJ } = require('./datos');

const plan = (settings = {}) => base({ modulos: { ejercicio: true }, settings: Object.assign({ creado: '2026-10-01' }, settings), ejercicios: [EJ('e1', 'Giros', 'reps', { fig: 'giros' }), EJ('e2', 'Plancha', 'tiempo', { fig: 'plancha' }), EJ('e3', 'Propio', 'reps')], sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '', ej: ['e1', 'e2', 'e3'] }] });
const op = (page, sel) => page.evaluate(s => parseFloat(getComputedStyle(document.querySelector(s)).opacity), sel);

test('figuras animadas: por defecto una sola figura que alterna entre sus poses; las de una sola pose y los propios quedan quietos', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: plan() });
  await ir(page, 'ejercicio');
  assert.strictEqual(await page.locator('#view .fig.anim').count(), 1, 'solo "Giros" tiene dos poses');
  assert.strictEqual(await page.locator('#view .fig:not(.anim)').count(), 1, 'la plancha (una sola pose) sigue quieta');
  assert.strictEqual(await page.locator('#view .fig.anim .pose').count(), 2);
  assert.match(await page.getAttribute('#view .fig.anim svg', 'aria-label'), /Cadera a la izquierda → Cadera a la derecha/);
  assert.deepStrictEqual(errores, []);
});

test('figuras animadas: el movimiento es real (cambia de pose) y se puede pausar tocándola', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ejercicio');
  const t0 = await op(page, '.fig.anim .p0'); await page.waitForTimeout(1500); const t1 = await op(page, '.fig.anim .p0');
  assert.ok(Math.abs(t0 - t1) > 0.5, `la pose A cambia de opacidad con el tiempo (${t0} → ${t1})`);
  await page.click('.fig-btn'); assert.ok(await page.evaluate(() => document.querySelector('.fig.anim').classList.contains('pausada')));
  const a = await op(page, '.fig.anim .p0'); await page.waitForTimeout(1200); assert.strictEqual(await op(page, '.fig.anim .p0'), a, 'pausada: no se mueve');
  await page.click('.fig-btn'); assert.ok(!(await page.evaluate(() => document.querySelector('.fig.anim').classList.contains('pausada'))));
});

test('figuras: se pueden apagar desde Ajustes (poses una al lado de la otra) y queda guardado', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ajustes'); assert.strictEqual(await page.locator('[data-a=fig-anim]').isChecked(), true);
  await page.uncheck('[data-a=fig-anim]'); assert.strictEqual((await estado(page)).settings.figAnim, false);
  await ir(page, 'ejercicio'); assert.strictEqual(await page.locator('#view .fig.anim').count(), 0);
  assert.strictEqual(await page.locator('#view .fig svg path.ar').count(), 1, 'versión quieta: las dos poses con su flecha');
  await page.reload(); await page.waitForFunction(() => window.SA); await ir(page, 'ejercicio'); assert.strictEqual(await page.locator('#view .fig.anim').count(), 0, 'queda apagado');
});

test('figuras: con "reducir animaciones" del teléfono no se mueven (se ve la primera pose)', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ir(page, 'ejercicio');
  assert.strictEqual(await op(page, '.fig.anim .p0'), 1); assert.strictEqual(await op(page, '.fig.anim .p1'), 0);
  await page.waitForTimeout(1500); assert.strictEqual(await op(page, '.fig.anim .p0'), 1, 'sigue quieta');
});

test('figuras: el botón de pausa mide al menos 44 px y entra en 360 px', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ejercicio');
  const r = await page.evaluate(() => { const b = document.querySelector('.fig-btn').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), ancho: document.documentElement.scrollWidth, vp: window.innerWidth }; });
  assert.ok(r.w >= 44 && r.h >= 44 && r.ancho <= r.vp, JSON.stringify(r));
});
