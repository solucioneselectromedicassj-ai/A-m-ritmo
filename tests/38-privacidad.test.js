'use strict';
const { test, assert, ir } = require('./lib');
const { base, EJ, MED } = require('./datos');

const plan = s => base({ modo: 'recordatorios', modulos: { ejercicio: true, medidas: true }, settings: Object.assign({ creado: '2026-10-01' }, s),
  ejercicios: [EJ('e1', 'Giros', 'reps')], sesiones: [{ id: 's1', n: 'Rutina de espalda', dias: [1, 3, 5], hora: '07:30', ej: ['e1'] }], medidas: [MED('presion', { recordarHora: '09:15' })] });
const programadas = async page => { const ll = await page.evaluate(() => window.__llamadas); const s = ll.filter(x => x[1] === 'schedule').pop(); return s ? JSON.parse(s[2])[0].notifications : []; };

test('avisos privados: por defecto muestran el detalle; al activar la opción no dicen nada de salud', async ({ abrir }) => {
  const { page } = await abrir({ native: true, ls: plan({}) });
  await page.waitForTimeout(300);
  let l = await programadas(page);
  assert.ok(l.some(n => /espalda/.test(n.title)), 'sin la opción se ve el nombre de la rutina');
  await ir(page, 'ajustes');
  await page.evaluate(() => window.__llamadas.length = 0);
  await page.check('[data-a=aviso-privado]'); await page.waitForTimeout(300);
  l = await programadas(page);
  assert.ok(l.length > 0);
  assert.ok(l.every(n => n.title === '🔔 A Mi Ritmo' && /Tenés un aviso/.test(n.body)), JSON.stringify(l.map(n => n.title)));
  assert.ok(l.every(n => !/espalda|Presión/i.test(n.title + n.body)));
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('miplanV1')).settings.avisoPrivado), true);
});

test('avisos privados: en la web no aparece la opción', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan({}) });
  await ir(page, 'ajustes');
  assert.strictEqual(await page.locator('[data-a=aviso-privado]').count(), 0);
});

test('seguridad: la página tiene política CSP y la app corre sin violaciones', async ({ abrir }) => {
  const { page, errores } = await abrir({ csp: true, ls: plan({}) });
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
  assert.match(csp, /script-src 'self'/); assert.match(csp, /object-src 'none'/);
  for (const t of ['hoy', 'ejercicio', 'medidas', 'ajustes']) await ir(page, t);
  assert.deepStrictEqual(errores.filter(e => /Content Security Policy|Refused/i.test(e)), []);
});

test('seguridad: un manejador inline inyectado no se ejecuta (CSP)', async ({ abrir }) => {
  const { page } = await abrir({ csp: true, ls: plan({}) });
  const r = await page.evaluate(async () => { const d = document.createElement('div'); d.innerHTML = '<img src=x onerror="window.__csp=1">'; document.body.appendChild(d); await new Promise(r => setTimeout(r, 200)); return window.__csp; });
  assert.strictEqual(r, undefined);
});

test('política de privacidad: se abre desde Ajustes y desde la bienvenida, tiene todas las secciones y se cierra', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: plan({}) });
  await ir(page, 'ajustes');
  await page.click('[data-a=politica]');
  const t = await page.locator('#modal').innerText();
  for (const x of ['Política de privacidad de A Mi Ritmo', 'solo en tu teléfono', 'Health Connect', 'Ley 25.326', 'No es un equipo médico']) assert.ok(t.includes(x), 'falta: ' + x);
  await page.click('#modal [data-a=modal-cancel]');
  assert.strictEqual(await page.locator('#modal').isHidden(), true);
  const n = await abrir({});
  await n.page.waitForSelector('[data-a=politica]');
  await n.page.click('[data-a=politica]');
  assert.ok((await n.page.locator('#modal').innerText()).includes('Qué datos usa la app'));
  assert.deepStrictEqual(errores, []);
});

test('política de privacidad: la página pública docs/privacidad.html sale de la misma fuente', async () => {
  const fs = require('fs'), P = require('../politica.js');
  require('child_process').execFileSync('node', ['scripts/build-politica.js']);
  const h = fs.readFileSync('docs/privacidad.html', 'utf8');
  assert.ok(h.includes(P.actualizada));
  P.secciones.forEach(([t]) => assert.ok(h.includes(t.replace(/&/g, '&amp;'))));
});
