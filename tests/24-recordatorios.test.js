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
  assert.deepStrictEqual(n.filter(x => x.id >= 3000 && x.id < 3600).map(x => [x.id, x.schedule.on.weekday, x.schedule.on.hour, x.schedule.on.minute]), [[3001, 2, 7, 30], [3003, 4, 7, 30], [3005, 6, 7, 30]]);
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
  assert.deepStrictEqual(ids, [3001, 3003, 3005, 3601, 3603, 3605], 'rutinas + la pregunta de la noche');
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
  assert.match(await page.innerText('#toast'), /Activá las notificaciones de A Mi Ritmo/);
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

test('"Hoy no" en un ejercicio agenda el aviso de mañana con su nombre (solo con recordatorios)', async ({ abrir }) => {
  const a = await abrir({ ls: plan('recordatorios'), native: nativo() });
  await a.page.waitForTimeout(200); await ir(a.page, 'ejercicio'); await a.page.click('[data-a=ej-no][data-id=e1]'); await a.page.waitForTimeout(200);
  const ult = (await llamadas(a.page)).filter(x => x[1] === 'schedule').pop(), n = JSON.parse(ult[2])[0].notifications[0];
  assert.strictEqual(n.id, 3900); assert.match(n.title, /Giros: ayer no lo hiciste/);
  const b = await abrir({ ls: plan('registro'), native: nativo() });
  await b.page.waitForTimeout(200); await ir(b.page, 'ejercicio'); await b.page.click('[data-a=ej-no][data-id=e1]'); await b.page.waitForTimeout(200);
  assert.deepStrictEqual(await programadas(b.page), []);
});

// Lo ya cumplido hoy no vuelve a sonar hoy: el aviso se corre a la próxima vez y sigue repitiéndose.
const prog = async page => { const ll = await llamadas(page); const s = ll.filter(x => x[1] === 'schedule').pop(); return s ? JSON.parse(s[2])[0].notifications : []; };

test('recordatorios: rutina ya hecha hoy → el aviso de hoy no suena (pasa a la semana próxima, repetido)', async ({ abrir }) => {
  const hecho = plan('recordatorios', { days: { '2026-10-19': { ej: { e1: 10 } } } });   // lunes: e1 cumple la meta (10)
  const { page } = await abrir({ ls: hecho, native: nativo() });
  await page.waitForTimeout(300);
  const n = (await prog(page)).find(x => x.id === 3001);   // lunes = 1
  assert.ok(n.schedule.at && !n.schedule.on, 'ya no usa el horario fijo de hoy');
  assert.strictEqual(n.schedule.every, 'week'); assert.strictEqual(n.schedule.repeats, true);
  const f = new Date(n.schedule.at); assert.deepStrictEqual([f.getFullYear(), f.getMonth(), f.getDate(), f.getHours(), f.getMinutes()], [2026, 9, 26, 7, 30]);
  assert.ok((await prog(page)).find(x => x.id === 3003).schedule.on, 'los otros días siguen normales');
});

test('recordatorios: si lo marcás hecho durante el día, se reprograma solo', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('recordatorios'), native: nativo() });
  await page.waitForTimeout(300);
  assert.ok((await prog(page)).find(x => x.id === 3001).schedule.on);
  await ir(page, 'ejercicio'); await page.click('[data-a=ses-todo][data-id=s1]'); await page.waitForTimeout(1900);
  assert.ok((await prog(page)).find(x => x.id === 3001).schedule.at, 'después de "Lo hice todo" el aviso de hoy ya no suena');
});

test('recordatorios: medición ya anotada hoy y agua en la meta no vuelven a avisar hoy', async ({ abrir }) => {
  const ls = plan('recordatorios', { settings: { creado: '2026-10-01', recAgua: true, recMin: 120, aguaDesde: '08:00', aguaHasta: '14:00', vaso: 250, metaAgua: 2000 }, registros: { m_presion: [{ fecha: '2026-10-19', sis: 120, dia: 80 }] }, days: { '2026-10-19': { agua: 2000 } } });
  const { page } = await abrir({ ls, native: nativo() });
  await page.waitForTimeout(300);
  const n = await prog(page);
  const manana = x => x.schedule.at && x.schedule.every === 'day' && new Date(x.schedule.at).getDate() === 20;
  assert.ok(manana(n.find(x => x.id === 2000)), 'presión'); assert.ok(n.filter(x => x.id >= 1000 && x.id < 2000).every(manana), 'agua');
});

test('recordatorios: al otro día vuelve todo al horario normal', async ({ abrir }) => {
  const ls = plan('recordatorios', { days: { '2026-10-19': { ej: { e1: 10 } } } });
  const { page } = await abrir({ ls, native: nativo(), fecha: '2026-10-20T12:00:00' });
  await page.waitForTimeout(300);
  assert.ok((await prog(page)).find(x => x.id === 3003).schedule.on);
});

const aguaPlan = (extra = {}) => plan('recordatorios', Object.assign({ settings: { creado: '2026-10-01', recAgua: true, recMin: 120, aguaDesde: '08:00', aguaHasta: '14:00', vaso: 250 }, modulos: { agua: true } }, extra));

test('agua: los avisos que pasaron quedan como vasos pendientes y cada vaso marcado descuenta uno', async ({ abrir }) => {
  // 12:00 → pasaron los avisos de las 8, 10 y 12 = 3 vasos
  const { page } = await abrir({ ls: aguaPlan() });
  assert.match(await texto(page), /Te quedaron 3 vasos por tomar/);
  await page.click('[data-a="agua+"]'); assert.match(await texto(page), /Te quedaron 2 vasos por tomar/);
  await page.click('[data-a="agua+"]'); assert.match(await texto(page), /Te quedó 1 vaso por tomar/);
  await page.click('[data-a="agua+"]'); assert.doesNotMatch(await texto(page), /por tomar/);
  await ir(page, 'habitos'); assert.doesNotMatch(await texto(page), /por tomar/);
});

test('agua: sin recordatorios (modo solo registro) no hay vasos pendientes', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modo: 'registro', modulos: { agua: true }, settings: { creado: '2026-10-01', recAgua: true, aguaDesde: '08:00', aguaHasta: '14:00', recMin: 120, vaso: 250 } }) });
  assert.doesNotMatch(await texto(page), /por tomar/);
});

test('agua (Android): los avisos no se borran al tocarlos y al marcar un vaso se saca uno solo', async ({ abrir }) => {
  const nat = { LocalNotifications: { getPending: '() => ({notifications:[]})', getDeliveredNotifications: '() => ({notifications:[{id:1001},{id:1000},{id:1002}]})', removeDeliveredNotifications: '() => ({})' } };
  const { page } = await abrir({ ls: aguaPlan(), native: nat });
  await page.waitForTimeout(300);
  const n = (await programadas(page)).filter(x => x.id >= 1000 && x.id < 2000);
  assert.ok(n.length === 3 && n.every(x => x.autoCancel === false), 'tocar un aviso no hace desaparecer a los demás');
  assert.deepStrictEqual(n.map(x => x.body), ['Vaso de 250 ml (aviso de las 08:00)', 'Vaso de 250 ml (aviso de las 10:00)', 'Vaso de 250 ml (aviso de las 12:00)'], 'cada aviso se distingue por su hora');
  await page.click('[data-a="agua+"]'); await page.waitForTimeout(250);
  const ll = await llamadas(page), rm = ll.filter(x => x[1] === 'removeDeliveredNotifications');
  assert.strictEqual(rm.length, 1); assert.deepStrictEqual(JSON.parse(rm[0][2])[0].notifications, [{ id: 1000 }], 'se saca solo el más viejo');
});

test('Probar un aviso ahora: pide el permiso y programa una notificación a los 5 segundos', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('registro'), native: nativo() });
  await ir(page, 'ajustes'); await page.click('[data-a=probar-aviso]'); await page.waitForTimeout(300);
  const ult = (await llamadas(page)).filter(x => x[1] === 'schedule').pop(), n = JSON.parse(ult[2])[0].notifications[0];
  assert.strictEqual(n.id, 9999); assert.match(n.title, /Aviso de prueba/); assert.ok(new Date(n.schedule.at).getTime() - Date.parse('2026-10-19T12:00:00') < 8000);
  const b = await abrir({ ls: plan('registro'), native: { LocalNotifications: { getPending: '() => ({notifications:[]})', checkPermissions: '() => ({display:"denied"})', requestPermissions: '() => ({display:"denied"})' } } });
  await ir(b.page, 'ajustes'); await b.page.click('[data-a=probar-aviso]'); await b.page.waitForTimeout(200);
  assert.match(await b.page.innerText('#toast'), /Android bloqueó las notificaciones/);
});

test('pregunta de la noche: "¿Hiciste tu rutina de hoy?" a la hora elegida y solo en los días con ejercicios', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan('recordatorios', { settings: { creado: '2026-10-01', seguirHora: '20:30' } }), native: nativo() });
  await page.waitForTimeout(300);
  const q = (await prog(page)).filter(x => x.id >= 3600 && x.id < 3700);
  assert.deepStrictEqual(q.map(x => [x.id, x.schedule.on.weekday, x.schedule.on.hour, x.schedule.on.minute]), [[3601, 2, 20, 30], [3603, 4, 20, 30], [3605, 6, 20, 30]]);
  assert.match(q[0].title, /¿Hiciste tu rutina de hoy\?/);
});

test('pregunta de la noche: no suena si hoy ya marcaste todo, y se puede apagar desde Ajustes', async ({ abrir }) => {
  const hecho = plan('recordatorios', { days: { '2026-10-19': { ej: { e1: 10 } } } });
  const a = await abrir({ ls: hecho, native: nativo() });
  await a.page.waitForTimeout(300);
  const lun = (await prog(a.page)).find(x => x.id === 3601);
  assert.ok(lun.schedule.at && lun.schedule.every === 'week', 'hoy ya cumplido: pasa a la semana próxima'); assert.ok((await prog(a.page)).find(x => x.id === 3603).schedule.on);
  const b = await abrir({ ls: plan('recordatorios'), native: nativo() });
  await ir(b.page, 'ajustes'); await b.page.uncheck('[name=seguirOn]'); await b.page.click('form[data-f=metas] button[type=submit]'); await b.page.waitForTimeout(300);
  assert.strictEqual((await estado(b.page)).settings.seguirOn, false);
  assert.ok(!(await prog(b.page)).some(x => x.id >= 3600 && x.id < 3700), 'apagada: no se programa');
  await b.page.check('[name=seguirOn]'); await b.page.fill('#s_seguirHora', '22:15'); await b.page.click('form[data-f=metas] button[type=submit]'); await b.page.waitForTimeout(300);
  const n = (await prog(b.page)).find(x => x.id === 3601); assert.deepStrictEqual([n.schedule.on.hour, n.schedule.on.minute], [22, 15]);
});
