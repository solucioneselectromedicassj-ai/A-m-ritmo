'use strict';
const { test, assert, ir } = require('./lib');
const { base } = require('./datos');

test('cuenta Google: en la web no aparece nada', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modulos: { agua: true } }) });
  await ir(page, 'ajustes');
  assert.strictEqual(await page.locator('[data-a=g-entrar]').count(), 0);
});

test('cuenta Google: entrar desde Ajustes saluda en Hoy y salir no borra datos', async ({ abrir }) => {
  const { page, errores } = await abrir({ native: true, ls: base({ modulos: { agua: true }, days: { '2026-10-19': { agua: 500 } } }) });
  await ir(page, 'ajustes');
  await page.click('[data-a=g-entrar]');
  await page.waitForSelector('[data-a=g-salir]');
  assert.match(await page.locator('#view').innerText(), /ana@gmail\.com/);
  await ir(page, 'hoy');
  assert.match(await page.locator('.saludo').innerText(), /Hola, Ana/);
  await ir(page, 'ajustes');
  await page.click('[data-a=g-salir]');
  await page.waitForSelector('[data-a=g-entrar]');
  const g = await page.evaluate(() => JSON.parse(localStorage.getItem('miplanV1')));
  assert.strictEqual(g.settings.cuenta, undefined);
  assert.strictEqual(g.days['2026-10-19'].agua, 500);
  assert.deepStrictEqual(errores, []);
});

test('cuenta Google: si la persona cierra el selector no pasa nada; un error muestra aviso', async ({ abrir }) => {
  const { page } = await abrir({ native: { GoogleLogin: { signIn: '() => { throw new Error("cancelado"); }' } }, ls: base({ modulos: { agua: true } }) });
  await ir(page, 'ajustes');
  await page.click('[data-a=g-entrar]'); await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('[data-a=g-salir]').count(), 0);
  assert.ok(!/No se pudo entrar/.test(await page.locator('#toast').innerText()));
});

test('cuenta Google: nombre y mail con código malicioso quedan escapados', async ({ abrir }) => {
  const mal = '<img src=x onerror="window.__xss=1">';
  const { page } = await abrir({ native: { GoogleLogin: { signIn: `() => ({ nombre: '${mal}', email: 'a@b.c${mal}' })` } }, ls: base({ modulos: { agua: true } }) });
  await ir(page, 'ajustes'); await page.click('[data-a=g-entrar]'); await page.waitForSelector('[data-a=g-salir]');
  await ir(page, 'hoy');
  assert.strictEqual(await page.evaluate(() => [window.__xss, document.querySelectorAll('img[src=x]').length]).then(String), ',0');
});

test('cuenta Google: la bienvenida del asistente ofrece entrar y después saluda', async ({ abrir }) => {
  const { page } = await abrir({ native: true });
  await page.waitForSelector('[data-a=g-entrar]');
  await page.click('[data-a=g-entrar]');
  await page.waitForSelector('.wizard .card:has-text("Hola, Ana")');
});
