'use strict';
const { test, assert, ir } = require('./lib');
const { base, TODOS } = require('./datos');

test('bienvenida: aparece con el aviso, se va sola a los segundos y deja ver el dashboard', async ({ abrir }) => {
  const { page, errores } = await abrir({ splash: true, ls: base({ modulos: TODOS }) });
  assert.ok(await page.isVisible('#splash'));
  const t = await page.innerText('#splash'); assert.match(t, /A Mi Ritmo/); assert.match(t, /No reemplaza las indicaciones de tu médico/);
  assert.match(t, /Tocá para continuar/);
  await page.waitForSelector('#splash.fuera', { timeout: 9000 });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 3000 });
  assert.ok(await page.isVisible('#view h2'), 'el dashboard queda a la vista');
  assert.deepStrictEqual(errores, []);
});

test('bienvenida: tocarla (pasado un instante) la cierra; antes no, para que se llegue a leer', async ({ abrir }) => {
  const { page } = await abrir({ splash: true, ls: base({ modulos: TODOS }) });
  await page.click('#splash'); assert.ok(!(await page.evaluate(() => document.querySelector('#splash').classList.contains('fuera'))), 'un toque inmediato no la cierra');
  await page.waitForTimeout(1000); await page.click('#splash');
  await page.waitForSelector('#splash', { state: 'detached', timeout: 3000 });
});

test('bienvenida: con "reducir animaciones" el texto se ve completo sin esperar', async ({ abrir }) => {
  const { page } = await abrir({ splash: true, ls: base({ modulos: TODOS }) });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.sp-aviso')).opacity), '1');
});

test('sin la bienvenida (pruebas) la app queda usable de inmediato', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modulos: TODOS }) });
  assert.strictEqual(await page.locator('#splash').count(), 0); await ir(page, 'ajustes');
});
