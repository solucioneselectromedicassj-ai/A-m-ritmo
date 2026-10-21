'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, EJ, MED, TODOS } = require('./datos');

// Un plan con agua, ejercicio con hora y una medición con recordatorio.
const plan = (modo, extra = {}) => base(Object.assign({
  modo, modulos: { agua: true, ejercicio: true, medidas: true }, settings: { creado: '2026-10-01', recAgua: true, recMin: 120, aguaDesde: '08:00', aguaHasta: '14:00', vaso: 250 },
  ejercicios: [EJ('e1', 'Giros', 'reps')], sesiones: [{ id: 's1', n: 'Mañana', dias: [1, 3, 5], hora: '07:30', ej: ['e1'] }, { id: 's2', n: 'Sin hora', dias: [2], hora: '', ej: [] }],
  medidas: [MED('presion', { recordarHora: '09:15' }), MED('peso')]
}, extra));
const llamadas = page => page.evaluate(() => window.__llamadas);
const programadas = async page => { const ll = await llamadas(page); const s = ll.find(x => x[1] === 'schedule'); return s ? JSON.parse(s[2])[0].notifications : []; };
const nativo = (pend = '[]') => ({ LocalNotifications: { getPending: `() => ({notifications:${pend}})` } });

test('modo "solo registro": nunca se programa ningún recordatorio, aunque haya horas cargadas', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('registro'), native: nativo() });
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await programadas(page), []);
});

test('modo "recordatorios": agua, medición y rutinas con hora (y solo lo activado)', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('recordatorios'), native: nativo() });
  await page.waitForTimeout(300);
  const n = await programadas(page), ids = n.map(x => x.id);
  // agua: 08:00, 10:00, 12:00 (cada 120 min hasta las 14:00, sin incluirla)
  assert.deepStrictEqual(n.filter(x => x.id >= 1000 && x.id < 2000).map(x => [x.id, x.schedule.on.hour]), [[1000, 8], [1001, 10], [1002, 12]]);
  assert.deepStrictEqual(n.find(x => x.id === 2000).schedule.on, { hour: 9, minute: 15 });
  assert.match(n.find(x => x.id === 2000).title, /Presión arterial: hora de medir/);
  // rutina "Mañana" lun/mié/vie 07:30 → weekday 2, 4, 6 (domingo = 1)
  assert.deepStrictEqual(n.filter(x => x.id >= 3000).map(x => [x.id, x.schedule.on.weekday, x.schedule.on.hour, x.schedule.on.minute]), [[3001, 2, 7, 30], [3003, 4, 7, 30], [3005, 6, 7, 30]]);
  assert.ok(!ids.includes(2001), 'la medición sin hora no recuerda');
  assert.ok(!n.some(x => /Sin hora/.test(x.title)), 'la rutina sin hora no recuerda');
});

test('modo "avisos" también programa recordatorios', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('avisos'), native: nativo() });
  await page.waitForTimeout(300); assert.ok((await programadas(page)).length >= 6);
});

test('los módulos desactivados no recuerdan y se cancelan los viejos (conservando el aviso de "mañana")', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('recordatorios', { modulos: { ejercicio: true } }), native: nativo('[{"id":3900},{"id":1000},{"id":2000}]') });
  await page.waitForTimeout(300);
  const ll = await llamadas(page);
  assert.deepStrictEqual(JSON.parse(ll.find(x => x[1] === 'cancel')[2])[0].notifications.map(n => n.id).sort(), [1000, 2000]);
  const ids = (await programadas(page)).map(x => x.id);
  assert.deepStrictEqual(ids, [3001, 3003, 3005]);
});

test('cambiar el modo en Ajustes reprograma', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('registro'), native: nativo() });
  await page.waitForTimeout(200); await ir(page, 'ajustes');
  await page.click('[data-a=modo][data-v=recordatorios]'); await page.waitForTimeout(300);
  assert.ok((await programadas(page)).length > 0);
  await page.evaluate(() => { window.__llamadas.length = 0; });
  await page.click('[data-a=modo][data-v=registro]'); await page.waitForTimeout(300);
  assert.deepStrictEqual(await programadas(page), [], 'al volver a "solo registro" no se programa nada');
  assert.ok((await llamadas(page)).some(x => x[1] === 'getPending'));
});

test('"No pude hoy" agenda un aviso para mañana solo si el modo tiene recordatorios', async ({ abrir }) => {
  const a = await abrir({ ls: plan('recordatorios'), native: nativo() });
  await a.page.waitForTimeout(200); await ir(a.page, 'ejercicio'); await a.page.click('[data-a=ses-no][data-id=s1]'); await a.page.waitForTimeout(200);
  const ult = (await llamadas(a.page)).filter(x => x[1] === 'schedule').pop(), n = JSON.parse(ult[2])[0].notifications[0];
  assert.strictEqual(n.id, 3900); assert.match(n.title, /Mañana: ayer no pudiste/);
  assert.strictEqual(new Date(n.schedule.at).getDate(), 20); assert.strictEqual(new Date(n.schedule.at).getHours(), 7);
  const b = await abrir({ ls: plan('registro'), native: nativo() });
  await b.page.waitForTimeout(200); await ir(b.page, 'ejercicio'); await b.page.click('[data-a=ses-no][data-id=s1]'); await b.page.waitForTimeout(200);
  assert.deepStrictEqual(await programadas(b.page), []);
});

test('sin permiso de notificaciones: se avisa y no se programa', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('recordatorios'), native: { LocalNotifications: { getPending: '() => ({notifications:[]})', checkPermissions: '() => ({display:"denied"})', requestPermissions: '() => ({display:"denied"})' } } });
  await page.waitForTimeout(300);
  assert.match(await page.innerText('#toast'), /Activá las notificaciones de Mi Plan/);
  assert.deepStrictEqual(await programadas(page), []);
});

test('ajustes de agua: horario y frecuencia validados', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('recordatorios') });
  await ir(page, 'ajustes');
  await page.fill('#s_recMin', '5'); await page.click('form[data-f=metas] button[type=submit]');
  assert.strictEqual((await estado(page)).settings.recMin, 120, 'la frecuencia mínima es de 15 minutos');
  await page.fill('#s_recMin', '60'); await page.fill('#s_aguaDesde', '07:00'); await page.click('form[data-f=metas] button[type=submit]');
  const s = (await estado(page)).settings; assert.deepStrictEqual([s.recMin, s.aguaDesde], [60, '07:00']);
});
