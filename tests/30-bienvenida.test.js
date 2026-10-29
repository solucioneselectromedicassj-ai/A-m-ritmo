'use strict';
const { test, assert, ir, texto } = require('./lib');
const { base, TODOS } = require('./datos');

test('bienvenida: aparece con el logo, se va sola a los segundos y deja ver el dashboard', async ({ abrir }) => {
  const { page, errores } = await abrir({ splash: true, ls: base({ modulos: TODOS }) });
  assert.ok(await page.isVisible('#splash'));
  const t = await page.innerText('#splash'); assert.match(t, /A Mi Ritmo/); assert.match(t, /Tu plan, a tu manera/); assert.match(t, /Tocá para continuar/);
  assert.doesNotMatch(t, /médico/, 'el aviso legal ya no está en la bienvenida: va adentro, con "Entendí y acepto"');
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
  assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.sp-lema')).opacity), '1');
});

test('sin la bienvenida (pruebas) la app queda usable de inmediato', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modulos: TODOS }) });
  assert.strictEqual(await page.locator('#splash').count(), 0); await ir(page, 'ajustes');
});

test('aviso importante: tarjeta en Hoy hasta aceptarlo; queda en Ajustes con la fecha', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modulos: TODOS }) });
  assert.match(await texto(page), /Antes de empezar[\s\S]*No reemplaza las indicaciones de tu médico[\s\S]*Entendí y acepto/);
  await ir(page, 'ajustes'); assert.match(await texto(page), /Aviso importante/); assert.strictEqual(await page.locator('[data-a=aviso-ok]').count(), 1);
  await page.click('[data-a=aviso-ok]');
  assert.ok((await page.evaluate(() => window.SA.state().settings.avisoAceptado)) > 0);
  assert.match(await texto(page), /Lo aceptaste el 19\/10\/2026/); assert.strictEqual(await page.locator('[data-a=aviso-ok]').count(), 0);
  await ir(page, 'hoy'); assert.doesNotMatch(await texto(page), /Antes de empezar/);
  await page.reload(); await page.waitForFunction(() => window.SA); assert.doesNotMatch(await texto(page), /Antes de empezar/, 'queda guardado');
  assert.match(await texto(page), /no reemplaza las indicaciones de tu médico/, 'el pie con el aviso sigue en cada pantalla');
});

test('Android: el título deja lugar a la barra de estado (alto leído de MainActivity, con mínimo de respaldo)', async ({ abrir }) => {
  const { page } = await abrir({ native: true, ls: base({ modulos: TODOS }) });
  assert.ok(await page.evaluate(() => document.body.classList.contains('nativo')));
  const pad = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.top')).paddingTop));
  assert.ok((await pad()) >= 36, 'sin datos del sistema igual queda un mínimo (28 + 8)');
  await page.evaluate(() => { window.AndroidInsets = { top: () => 52 }; window.SA.leerInsets(); });
  assert.ok((await pad()) >= 60, 'con la altura real (52) + margen');
  const web = await abrir({ ls: base({ modulos: TODOS }) });
  assert.ok(!(await web.page.evaluate(() => document.body.classList.contains('nativo'))), 'en la web no cambia nada');
});
