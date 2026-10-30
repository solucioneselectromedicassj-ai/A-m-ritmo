'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, EJ, MED } = require('./datos');

const plan = (extra = {}) => base(Object.assign({
  modo: 'recordatorios', modulos: { agua: true, ejercicio: true, medidas: true, pasos: true }, settings: { creado: '2026-10-01', vaso: 250, recAgua: true, recMin: 120, aguaDesde: '08:00', aguaHasta: '22:00', metaPasos: 8000 },
  ejercicios: [EJ('e1', 'Giros', 'reps')], sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '08:00', ej: ['e1'] }], medidas: [MED('presion', { recordarHora: '09:00' })],
  recordatorios: [{ id: 'r1', txt: 'Comer fruta <b>x</b>', hora: '16:00', dias: [1] }], days: { '2026-10-19': { pasos: 3000 } }
}, extra));
const nativo = { LocalNotifications: { getPending: '() => ({notifications:[]})' } };
const tocar = (page, id) => page.evaluate(i => window.__escuchas.localNotificationActionPerformed({ notification: { id: i } }), id);

test('al tocar el aviso de agua aparece un aviso rápido; "Tomé un vaso" suma uno, cierra y sigue la app', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: plan(), native: nativo });
  await page.waitForTimeout(300); await tocar(page, 1000);
  assert.ok(await page.isVisible('#modal .rapido')); assert.match(await page.innerText('#modal'), /Hora de tomar agua[\s\S]*Te quedaron 3 vasos por tomar/);
  await page.click('#modal [data-a="agua+"]');
  assert.ok(await page.isHidden('#modal')); assert.strictEqual((await estado(page)).days['2026-10-19'].agua, 250);
  await tocar(page, 1001); await page.click('#modal [data-a=modal-cancel]'); assert.ok(await page.isHidden('#modal')); assert.strictEqual((await estado(page)).days['2026-10-19'].agua, 250, '"Después" no suma');
  assert.deepStrictEqual(errores, []);
});

test('aviso rápido de una medición: "Anotar ahora" lleva directo a esa medición', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan(), native: nativo });
  await tocar(page, 2000); assert.match(await page.innerText('#modal'), /Presión arterial: hora de medir/);
  await page.click('#modal [data-a=ir-medida]'); assert.ok(await page.isHidden('#modal'));
  assert.strictEqual(await page.locator('#nav [data-t=medidas][aria-current=page]').count(), 1); assert.match(await texto(page), /Presión arterial/);
});

test('aviso rápido de la rutina y de la pregunta de la noche: llevan a Hoy con los pendientes abiertos', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan(), native: nativo });
  await ir(page, 'ajustes'); await tocar(page, 3001);
  assert.match(await page.innerText('#modal'), /Mañana[\s\S]*Es hora de tu rutina/);
  await page.click('#modal [data-a=tab]');
  assert.strictEqual(await page.locator('#nav [data-t=hoy][aria-current=page]').count(), 1); assert.strictEqual(await page.locator('#view details.agrupa[open]').count(), 1, 'los pendientes ya están abiertos');
  assert.ok(await page.isVisible('[data-a=ej-ok][data-id=e1]'));
  await ir(page, 'ajustes'); await tocar(page, 3601); assert.match(await page.innerText('#modal'), /¿Hiciste tu rutina de hoy\?/);
});

test('aviso rápido de pasos, recordatorio propio (texto escapado) y avisos desconocidos o sin datos', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: plan(), native: nativo });
  await tocar(page, 3700); assert.match(await page.innerText('#modal'), /Llevás 3000 de 8000 pasos/); await page.click('#modal [data-a=ir-pasos]');
  assert.strictEqual(await page.locator('#nav [data-t=habitos][aria-current=page]').count(), 1); assert.match(await texto(page), /Tu evolución de pasos/);
  await tocar(page, 4010); assert.ok(!(await page.innerHTML('#modal')).includes('<b>x</b>'), 'texto escapado');
  await tocar(page, 4001); assert.match(await page.innerText('#modal'), /Comer fruta/); await page.click('#modal [data-a=modal-cancel]');
  for (const id of [9999, 5, 2500, 3550, 1000000, null, undefined]) await tocar(page, id).catch(() => { });
  assert.deepStrictEqual(errores, []);
});

test('el aviso rápido no aparece durante el asistente inicial ni si el módulo está apagado', async ({ abrir }) => {
  const a = await abrir({ native: nativo }); await tocar(a.page, 1000); assert.ok(await a.page.isHidden('#modal'));
  const b = await abrir({ ls: plan({ modulos: { ejercicio: true } }), native: nativo }); await tocar(b.page, 1000); assert.ok(await b.page.isHidden('#modal'), 'sin el módulo de agua no hay nada que mostrar');
});
