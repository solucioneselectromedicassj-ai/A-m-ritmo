'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, EJ, MED, TODOS } = require('./datos');

const plan = (extra = {}) => base(Object.assign({ modulos: TODOS, ejercicios: [EJ('e1', 'Giros', 'reps')], sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '', ej: ['e1'] }], medidas: [MED('presion')], settings: { creado: '2026-10-01' } }, extra));
const visible = page => page.evaluate(() => { const a = document.querySelector('#anuncio'); return !!a && !a.hidden && a.getBoundingClientRect().height > 0; });

test('anuncio de ejemplo: franja fija arriba de la navegación, rotulada, en todas las pestañas', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: plan() });
  for (const t of ['hoy', 'ejercicio', 'medidas', 'habitos', 'ajustes']) { await ir(page, t); assert.ok(await visible(page), t); }
  const t = await page.innerText('#anuncio'); assert.match(t, /Espacio publicitario/i); assert.match(t, /pendiente de aprobación/);
  assert.deepStrictEqual(errores, []);
});

test('anuncio de ejemplo: queda sobre la navegación sin taparla ni tapar el contenido, y sin botones', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  const r = await page.evaluate(() => { const a = document.querySelector('#anuncio').getBoundingClientRect(), n = document.querySelector('#nav').getBoundingClientRect(); return { sobreNav: a.bottom <= n.top, sepNav: Math.round(n.top - a.bottom), ancho: document.documentElement.scrollWidth, vp: window.innerWidth, interactivos: document.querySelectorAll('#anuncio button, #anuncio a, #anuncio input').length, pad: parseFloat(getComputedStyle(document.body).paddingBottom), alto: Math.round(a.height), bajo: window.innerHeight - a.top }; });
  assert.ok(r.sobreNav && r.sepNav >= 6, 'separado de la navegación (' + r.sepNav + ' px)'); assert.ok(r.ancho <= r.vp, 'sin desborde'); assert.strictEqual(r.interactivos, 0, 'sin botones ni links');
  assert.ok(r.pad >= r.bajo, 'el contenido llega hasta arriba de la franja (padding ' + r.pad + ' ≥ ' + r.bajo + ')');
  // al final de la pantalla el último contenido se ve entero, no queda bajo la franja
  await ir(page, 'ajustes'); await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const libre = await page.evaluate(() => { const f = document.querySelector('#view').lastElementChild.getBoundingClientRect(), a = document.querySelector('#anuncio').getBoundingClientRect(); return f.bottom <= a.top + 1; });
  assert.ok(libre, 'el último contenido de la pantalla queda arriba de la franja');
});

test('anuncio de ejemplo: no aparece en el asistente inicial ni con una ventana/aviso abierto encima', async ({ abrir }) => {
  const nuevo = await abrir({}); assert.ok(!(await visible(nuevo.page)), 'asistente'); assert.ok(!(await nuevo.page.evaluate(() => document.body.classList.contains('con-anuncio'))));
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ajustes'); await page.click('[data-a=ej-nuevo]');
  const z = await page.evaluate(() => ({ modal: parseInt(getComputedStyle(document.querySelector('#modal')).zIndex || '0', 10), anuncio: parseInt(getComputedStyle(document.querySelector('#anuncio')).zIndex, 10) }));
  assert.ok(z.modal > z.anuncio, 'la ventana queda por encima de la franja');
});

test('anuncio de ejemplo: el temporizador de descanso queda por encima de la franja', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan({ ejercicios: [EJ('e2', 'Puente', 'series')], sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '', ej: ['e2'] }] }) });
  await ir(page, 'ejercicio'); await page.click('[data-a="ej+"][data-id=e2]');
  const r = await page.evaluate(() => ({ t: document.querySelector('#timer').getBoundingClientRect(), a: document.querySelector('#anuncio').getBoundingClientRect() }));
  assert.ok(r.t.bottom <= r.a.top + 1, 'el temporizador no se superpone con la franja');
});

test('anuncio de ejemplo: se puede apagar desde Ajustes y queda guardado', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ajustes'); assert.match(await texto(page), /Anuncios[\s\S]*Mostrar el espacio de anuncios de ejemplo/);
  await page.uncheck('[data-a=anuncios-demo]');
  assert.strictEqual((await estado(page)).settings.anunciosDemo, false); assert.ok(!(await visible(page))); assert.ok(!(await page.evaluate(() => document.body.classList.contains('con-anuncio'))));
  await page.reload(); await page.waitForFunction(() => window.SA); assert.ok(!(await visible(page)), 'queda apagado');
  await ir(page, 'ajustes'); await page.check('[data-a=anuncios-demo]'); assert.ok(await visible(page));
});
