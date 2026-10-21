'use strict';
const { test, assert, estado, ir } = require('./lib');
const { base, TODOS } = require('./datos');
const pri = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pri').trim());

test('color: por defecto azul; elegir otro cambia la app, se guarda y sobrevive a recargar', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: base({ modulos: TODOS }) });
  assert.strictEqual(await pri(page), '#1d4ed8');
  await ir(page, 'ajustes'); await page.click('[data-a=color][data-v=verde]');
  assert.strictEqual(await pri(page), '#0f766e'); assert.strictEqual((await estado(page)).settings.color, 'verde');
  assert.strictEqual(await page.getAttribute('meta[name=theme-color]', 'content'), '#0f766e');
  assert.strictEqual(await page.getAttribute('[data-a=color][data-v=verde]', 'aria-pressed'), 'true');
  await page.reload(); await page.waitForFunction(() => window.SA);
  assert.strictEqual(await pri(page), '#0f766e');
  await ir(page, 'ajustes'); await page.click('[data-a=color][data-v=azul]');
  assert.strictEqual(await pri(page), '#1d4ed8');
  assert.deepStrictEqual(errores, []);
});

test('color: un valor desconocido guardado cae en azul sin romper', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: base({ modulos: TODOS, settings: { creado: '2026-10-01', color: 'fucsia' } }) });
  assert.strictEqual(await pri(page), '#1d4ed8'); assert.deepStrictEqual(errores, []);
});

test('color: modo oscuro usa la variante oscura', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modulos: TODOS, settings: { creado: '2026-10-01', color: 'violeta' } }) });
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.strictEqual(await pri(page), '#b79cff');
});
