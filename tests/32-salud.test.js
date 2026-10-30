'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, MED, TODOS } = require('./datos');

const T = (f, h = 9, m = 0) => Date.parse(`${f}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
const DATOS = () => ({
  spo2: [{ id: 'a1', t: T('2026-10-18', 21, 5), v: 96.4, pul: 72, origen: 'com.sec.android.app.shealth' }, { id: 'a2', t: T('2026-10-19', 8, 30), v: 94, origen: 'com.xiaomi.wearable' },
    { id: 'mala1', t: T('2026-10-19', 9), v: 12 }, { id: 'mala2', t: 'x', v: 95 }, { id: '', t: T('2026-10-19', 10), v: 95 }, null],
  pulso: [{ id: 'p1', t: T('2026-10-19', 7, 15), v: 61.6, origen: 'com.google.android.apps.fitness' }, { id: 'p2', t: T('2026-10-19', 7, 16), v: 500 }]
});
const nat = (extra = {}) => ({ HealthSync: Object.assign({ isAvailable: '() => ({status:"available"})', hasPermission: `() => ({granted: localStorage.getItem('__hc') === '1'})`, requestPermission: `() => { localStorage.setItem('__hc', '1'); return {granted:true}; }`, leer: `() => (${JSON.stringify(DATOS())})` }, extra) });
const llamadas = page => page.evaluate(() => window.__llamadas.map(x => x[1]));

test('Health Connect: trae saturación y pulso, crea las mediciones que faltan y descarta lo inválido', async ({ abrir }) => {
  const { page, errores } = await abrir({ native: nat(), ls: base({ modulos: TODOS, medidas: [] }) });
  await ir(page, 'ajustes'); await page.click('[data-a=salud-importar]'); await page.waitForTimeout(500);
  const S = await estado(page);
  assert.deepStrictEqual(S.medidas.map(m => m.id).sort(), ['m_pulso', 'm_spo2']);
  assert.deepStrictEqual(S.registros.m_spo2, [{ fecha: '2026-10-18', hora: '21:05', sat: 96, pul: 72, hc: 'a1', origen: 'Samsung Health' }, { fecha: '2026-10-19', hora: '08:30', sat: 94, hc: 'a2', origen: 'Xiaomi' }]);
  assert.deepStrictEqual(S.registros.m_pulso, [{ fecha: '2026-10-19', hora: '07:15', pul: 62, hc: 'p1', origen: 'Google Fit' }]);
  assert.match(await page.innerText('#toast'), /Se sumaron 2 saturaciones y 1 pulso/);
  assert.ok(S.settings.hcUltimo > 0); assert.strictEqual(S.settings.hcAuto, true);
  await ir(page, 'medidas'); assert.match(await texto(page), /Saturación de oxígeno|Pulso/);
  assert.deepStrictEqual(errores, []);
});

test('Health Connect: volver a importar no repite lecturas, y no pisa lo que cargó la persona', async ({ abrir }) => {
  const ls = base({ modulos: TODOS, medidas: [MED('peso')], registros: { m_peso: [{ fecha: '2026-10-10', kg: 80 }] } });
  const { page } = await abrir({ native: nat(), ls });
  await ir(page, 'ajustes'); await page.click('[data-a=salud-importar]'); await page.waitForTimeout(400);
  await page.click('[data-a=salud-importar]'); await page.waitForTimeout(400);
  const S = await estado(page); assert.strictEqual(S.registros.m_spo2.length, 2); assert.strictEqual(S.registros.m_pulso.length, 1);
  assert.deepStrictEqual(S.registros.m_peso, [{ fecha: '2026-10-10', kg: 80 }]); assert.match(await page.innerText('#toast'), /No hay datos nuevos/);
});

test('Health Connect: la primera vez pide el último mes; después desde la última vez (con un día de margen)', async ({ abrir }) => {
  const { page } = await abrir({ native: nat(), ls: base({ modulos: TODOS }) });
  await ir(page, 'ajustes'); await page.click('[data-a=salud-importar]'); await page.waitForTimeout(400);
  let ll = await page.evaluate(() => window.__llamadas.filter(x => x[1] === 'leer').map(x => JSON.parse(x[2])[0]));
  const ahora = Date.parse('2026-10-19T12:00:00'); assert.ok(Math.abs(ll[0].hasta - ahora) < 5000); assert.ok(Math.abs((ll[0].hasta - ll[0].desde) - 30 * 86400e3) < 5000);
  await page.click('[data-a=salud-importar]'); await page.waitForTimeout(400);
  ll = await page.evaluate(() => window.__llamadas.filter(x => x[1] === 'leer').map(x => JSON.parse(x[2])[0]));
  assert.ok(Math.abs((ll[1].hasta - ll[1].desde) - 86400e3) < 5000, 'solo desde ayer');
});

test('Health Connect: sin permiso, sin la app instalada o necesitando actualizar se explica qué hacer', async ({ abrir }) => {
  let a = await abrir({ native: nat({ requestPermission: '() => ({granted:false})' }), ls: base({ modulos: TODOS }) });
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=salud-importar]'); await a.page.waitForTimeout(300);
  assert.match(await a.page.innerText('#toast'), /Faltan permisos/); assert.deepStrictEqual((await estado(a.page)).medidas, []);
  a = await abrir({ native: nat({ isAvailable: '() => ({status:"missing"})' }), ls: base({ modulos: TODOS }) });
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=salud-importar]'); await a.page.waitForTimeout(300); assert.match(await a.page.innerText('#toast'), /Instalá Health Connect/);
  a = await abrir({ native: nat({ isAvailable: '() => ({status:"update"})' }), ls: base({ modulos: TODOS }) });
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=salud-importar]'); await a.page.waitForTimeout(300); assert.match(await a.page.innerText('#toast'), /Actualizá Health Connect/);
  a = await abrir({ native: nat({ leer: '() => { throw new Error("falló"); }' }), ls: base({ modulos: TODOS }) });
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=salud-importar]'); await a.page.waitForTimeout(300); assert.match(await a.page.innerText('#toast'), /No se pudieron traer los datos/);
  assert.strictEqual((await estado(a.page)).settings.hcUltimo, 0, 'si falla no se marca como importado');
});

test('Health Connect: "traer solos" lo hace al abrir sin pedir permisos; apagado no toca nada', async ({ abrir }) => {
  const permiso = nat({ hasPermission: '() => ({granted:true})' });
  let a = await abrir({ native: permiso, ls: base({ modulos: TODOS, settings: { creado: '2026-10-01', hcAuto: true } }) });
  await a.page.waitForTimeout(700); assert.strictEqual((await estado(a.page)).registros.m_spo2.length, 2);
  assert.ok(!(await llamadas(a.page)).includes('requestPermission'), 'en automático nunca pide permisos');
  a = await abrir({ native: permiso, ls: base({ modulos: TODOS, settings: { creado: '2026-10-01', hcAuto: false } }) });
  await a.page.waitForTimeout(700); assert.ok(!(await llamadas(a.page)).includes('leer'));
  a = await abrir({ native: nat(), ls: base({ modulos: TODOS, settings: { creado: '2026-10-01', hcAuto: true } }) });   // sin permiso concedido
  await a.page.waitForTimeout(700); assert.deepStrictEqual((await estado(a.page)).registros, {}); assert.ok(!(await llamadas(a.page)).includes('requestPermission'));
});

test('Health Connect: tildar "traerlos solos" importa en el momento; la tarjeta solo existe en Android', async ({ abrir }) => {
  const a = await abrir({ native: nat({ hasPermission: '() => ({granted:true})' }), ls: base({ modulos: TODOS }) });
  await ir(a.page, 'ajustes'); await a.page.check('[data-a=salud-auto]'); await a.page.waitForTimeout(500);
  assert.strictEqual((await estado(a.page)).settings.hcAuto, true); assert.strictEqual((await estado(a.page)).registros.m_spo2.length, 2);
  const w = await abrir({ ls: base({ modulos: TODOS }) }); await ir(w.page, 'ajustes'); assert.strictEqual(await w.page.locator('[data-a=salud-importar]').count(), 0);
});

test('Health Connect: el informe aclara que hay lecturas de un reloj; el origen se escapa', async ({ abrir }) => {
  const a = await abrir({ native: nat({ leer: `() => ({spo2:[{id:'x1',t:${T('2026-10-19', 8)},v:95,origen:'<img src=x onerror=window.__xss=1>'}],pulso:[]})` }), ls: base({ modulos: TODOS, medidas: [] }) });
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=salud-importar]'); await a.page.waitForTimeout(500);
  const inf = await a.page.evaluate(() => window.SA.informeCuerpo());
  assert.match(inf, /importadas de un reloj o pulsera \(Health Connect\)/);
  for (const t of ['medidas', 'ajustes', 'hoy']) await ir(a.page, t);
  assert.strictEqual(await a.page.evaluate(() => window.__xss), undefined); assert.deepStrictEqual(a.errores, []);
});

test('Health Connect: los datos importados participan de los avisos solo con los límites de la persona', async ({ abrir }) => {
  const spo2 = Object.assign(MED('propia'), { id: 'm_spo2', tipo: 'spo2', n: 'Saturación de oxígeno', campos: [{ k: 'sat', n: 'Saturación', u: '%', r: [50, 100], min: 95, max: null }, { k: 'pul', n: 'Pulso', u: 'lpm', r: [25, 250], opc: true, min: null, max: null }] });
  const a = await abrir({ native: nat(), ls: base({ modo: 'avisos', modulos: TODOS, medidas: [spo2] }) });
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=salud-importar]'); await a.page.waitForTimeout(500);
  await ir(a.page, 'hoy'); assert.match(await texto(a.page), /Saturación de oxígeno[^.]*Saturación 94 % está por debajo del mínimo que definiste \(95\)/);
});
