'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base } = require('./datos');

const irCom = async page => { await ir(page, 'habitos'); };
const rango = (de, a, mes, extra = (k) => true) => { const o = {}; for (let d = de; d <= a; d++) o[`${mes}-${String(d).padStart(2, '0')}`] = extra(d); return o; };
// Items: Fruta, Verduras, Pescado, Frituras. Octubre (hasta el 19): verduras todos los días, fruta 6 días, frituras 2 días, pescado nunca. Septiembre: fruta 10 días.
const items = [{ id: 'fr', n: 'Fruta' }, { id: 've', n: 'Verduras' }, { id: 'pe', n: 'Pescado' }, { id: 'fz', n: 'Frituras' }];
const dias = () => {
  const d = {};
  for (let k = 1; k <= 19; k++) { const f = `2026-10-${String(k).padStart(2, '0')}`; d[f] = { comida: { ve: true } }; if (k <= 6) d[f].comida.fr = true; if (k <= 2) d[f].comida.fz = true; }
  for (let k = 1; k <= 10; k++) d[`2026-09-${String(k).padStart(2, '0')}`] = { comida: { fr: true } };
  return d;
};
const conMes = (extra = {}, fecha) => ({ ls: base(Object.assign({ modulos: { comida: true }, settings: { creado: '2026-09-01' }, comida: { items, contadores: [{ id: 'c1', n: 'Fruta (porciones)', meta: null }] }, days: dias() }, extra)), fecha });
const verMes = async page => { await irCom(page); await page.click('[data-a=sub-com][data-v=mes]'); };

test('Mi mes: cuántos días comió cada cosa, comparado con el mes anterior, y lo que no anotó', async ({ abrir }) => {
  const { page, errores } = await abrir(conMes());
  await verMes(page);
  const t = await texto(page);
  assert.match(t, /Octubre 2026 \(hasta hoy\)/); assert.match(t, /Anotaste comidas 19 de 19 días/);
  const orden = await page.$$eval('#view .mes-fila b', xs => xs.map(x => x.textContent)); assert.deepStrictEqual(orden, ['Verduras', 'Fruta', 'Frituras', 'Pescado'], 'de lo más a lo menos anotado');
  assert.match(t, /Verduras 19 días/); assert.match(t, /Fruta 6 días ▼ −4 vs mes anterior/); assert.match(t, /Pescado 0 días/);
  assert.match(t, /Hasta ahora no anotaste:\s*Pescado\./);
  assert.deepStrictEqual(errores, []);
});

test('Mi mes: objetivos por comida (al menos / como máximo), neutros y con su avance', async ({ abrir }) => {
  const { page } = await abrir(conMes());
  await verMes(page); await page.click('[data-a=com-obj]');
  await page.selectOption('#modal [name=o_fr]', 'min:12'); await page.selectOption('#modal [name=o_fz]', 'max:4'); await page.selectOption('#modal [name=o_ve]', 'min:16');
  await page.click('#modal button[type=submit]');
  const S = await estado(page); assert.deepStrictEqual(S.comida.items.map(i => i.obj || null), [{ t: 'min', d: 12 }, { t: 'min', d: 16 }, null, { t: 'max', d: 4 }]);
  const t = await texto(page);
  assert.match(t, /Objetivo: al menos 12 días — 6 hasta ahora, faltan 6/); assert.match(t, /Objetivo: como máximo 4 días — dentro del límite \(2\)/); assert.match(t, /Objetivo: al menos 16 días — ¡llegaste! \(19\)/);
  await page.click('[data-a=com-obj]'); await page.selectOption('#modal [name=o_fr]', ''); await page.click('#modal button[type=submit]');
  assert.strictEqual((await estado(page)).comida.items[0].obj, undefined, 'sin objetivo lo quita');
});

test('Mi mes: "Mes pasado" muestra el mes cerrado y ofrece los objetivos del mes que entra', async ({ abrir }) => {
  const { page } = await abrir(conMes({ comida: { items: items.map((x, i) => (i === 0 ? Object.assign({}, x, { obj: { t: 'min', d: 12 } }) : x)), contadores: [] } }));
  await verMes(page); await page.click('[data-a=sub-mes][data-v=pasado]');
  const t = await texto(page);
  assert.match(t, /Septiembre 2026/); assert.doesNotMatch(t, /Septiembre 2026 \(hasta hoy\)/); assert.match(t, /Anotaste comidas 10 de 30 días/);
  assert.match(t, /Fruta 10 días/); assert.match(t, /Objetivo: al menos 12 días — 10, quedaste a 2/);
  assert.match(t, /En septiembre no anotaste:\s*Verduras, Pescado, Frituras\./); assert.match(t, /Objetivos de octubre/); assert.match(t, /Entrá al mes nuevo con ganas/);
});

test('Hoy: a fin de mes aparece la tarjeta con el resumen; "Ver mi resumen" lleva a Mi mes y no vuelve; "Más tarde" la oculta por hoy', async ({ abrir }) => {
  const a = await abrir(conMes({}, '2026-10-30T12:00:00'));
  let t = await texto(a.page); assert.match(t, /Se acaba octubre: mirá qué comiste/); assert.match(t, /No anotaste: Pescado/);
  await a.page.click('[data-a=mes-ver]');
  assert.strictEqual((await estado(a.page)).settings.mesComidaVisto, '2026-10'); assert.match(await texto(a.page), /Octubre 2026 \(hasta hoy\)/);
  await ir(a.page, 'hoy'); assert.doesNotMatch(await texto(a.page), /mirá qué comiste/, 'ya lo vio');
  const b = await abrir(conMes({}, '2026-10-31T12:00:00')); await b.page.click('[data-a=mes-luego]'); assert.doesNotMatch(await texto(b.page), /mirá qué comiste/);
  const c = await abrir(conMes({}, '2026-11-02T12:00:00')); t = await texto(c.page); assert.match(t, /Cerró octubre: mirá qué comiste/);
  await c.page.click('[data-a=mes-ver]'); assert.match(await texto(c.page), /Octubre 2026/); assert.doesNotMatch(await texto(c.page), /Octubre 2026 \(hasta hoy\)/, 'abre el mes que cerró');
});

test('Hoy: sin tarjeta a mitad de mes, sin el módulo, sin nada anotado ni sin qué anotar', async ({ abrir }) => {
  assert.doesNotMatch(await texto((await abrir(conMes({}, '2026-10-15T12:00:00'))).page), /mirá qué comiste/);
  assert.doesNotMatch(await texto((await abrir(conMes({ modulos: { agua: true } }, '2026-10-30T12:00:00'))).page), /mirá qué comiste/);
  assert.doesNotMatch(await texto((await abrir(conMes({ days: {} }, '2026-10-30T12:00:00'))).page), /mirá qué comiste/, 'sin registros no hay resumen');
  assert.doesNotMatch(await texto((await abrir(conMes({ comida: { items: [], contadores: [] } }, '2026-10-30T12:00:00'))).page), /mirá qué comiste/);
});

const nativo = { LocalNotifications: { getPending: '() => ({notifications:[]})' } };
const prog = async page => { const s = (await page.evaluate(() => window.__llamadas)).filter(x => x[1] === 'schedule').pop(); return s ? JSON.parse(s[2])[0].notifications : []; };

test('aviso de fin de mes: una notificación el último día a las 20:00; si ya pasó, la del mes siguiente; se puede apagar', async ({ abrir }) => {
  let a = await abrir(Object.assign(conMes({ modo: 'recordatorios' }), { native: nativo })); await a.page.waitForTimeout(300);
  let n = (await prog(a.page)).find(x => x.id === 3800); let f = new Date(n.schedule.at);
  assert.deepStrictEqual([f.getFullYear(), f.getMonth(), f.getDate(), f.getHours(), f.getMinutes()], [2026, 9, 31, 20, 0]); assert.match(n.title, /Cerró octubre: mirá qué comiste/);
  a = await abrir(Object.assign(conMes({ modo: 'recordatorios' }, '2026-10-31T21:00:00'), { native: nativo })); await a.page.waitForTimeout(300);
  f = new Date((await prog(a.page)).find(x => x.id === 3800).schedule.at); assert.deepStrictEqual([f.getMonth(), f.getDate()], [10, 30], 'el 31 a las 21 ya pasó: va el de noviembre');
  a = await abrir(Object.assign(conMes({ modo: 'recordatorios', settings: { creado: '2026-09-01', recMesComida: false } }), { native: nativo })); await a.page.waitForTimeout(300);
  assert.ok(!(await prog(a.page)).some(x => x.id === 3800), 'apagado');
  a = await abrir(Object.assign(conMes({ modo: 'registro' }), { native: nativo })); await a.page.waitForTimeout(300); assert.deepStrictEqual(await prog(a.page), []);
  a = await abrir(Object.assign(conMes({ modo: 'recordatorios', comida: { items: [], contadores: [] } }), { native: nativo })); await a.page.waitForTimeout(300);
  assert.ok(!(await prog(a.page)).some(x => x.id === 3800), 'sin nada para anotar no hay resumen');
});

test('aviso de fin de mes: al tocar la notificación abre el resumen; la casilla de Ajustes lo enciende y apaga', async ({ abrir }) => {
  const a = await abrir(Object.assign(conMes({ modo: 'recordatorios' }, '2026-10-31T21:00:00'), { native: nativo }));
  await a.page.evaluate(() => window.__escuchas.localNotificationActionPerformed({ notification: { id: 3800 } }));
  assert.match(await a.page.innerText('#modal'), /Cerró el mes[\s\S]*resumen de alimentación/); await a.page.click('#modal [data-a=mes-ver]');
  assert.ok(await a.page.isHidden('#modal')); assert.match(await texto(a.page), /Mi mes|Octubre 2026/);
  await ir(a.page, 'ajustes'); assert.strictEqual(await a.page.locator('[name=recMesComida]').isChecked(), true);
  await a.page.uncheck('[name=recMesComida]'); await a.page.click('form[data-f=metas] button[type=submit]');
  assert.strictEqual((await estado(a.page)).settings.recMesComida, false);
});

test('informe: alimentación por mes (días por comida y cantidades), texto escapado', async ({ abrir }) => {
  const malo = '<img src=x onerror="window.__xss=1">';
  const a = await abrir(conMes({ comida: { items: items.concat([{ id: 'x', n: malo }]), contadores: [{ id: 'c1', n: 'Fruta (porciones)', meta: null }] }, days: Object.assign(dias(), { '2026-10-18': { comida: { fr: true }, cont: { c1: 3 } } }) }));
  const inf = await a.page.evaluate(() => window.SA.informeCuerpo()), t = inf.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(t, /Alimentación \(qué anotó, por mes\)/); assert.match(t, /Alimento agosto \(0 de 0 días con registro\) septiembre \(10 de 30 días con registro\) octubre \(19 de 19 días con registro\)/);
  assert.match(t, /Fruta 0 10 7/); assert.match(t, /Verduras 0 0 18/); assert.match(t, /Fruta \(porciones\) \(total\) 0 0 3/);
  assert.ok(!inf.includes('<img src=x'), 'escapado');
});

test('importado de Salud Activa: sus ítems y marcas alimentan el resumen del mes sin perder nada', async ({ abrir }) => {
  const a = await abrir(conMes({ comida: { items: [{ id: 'avena', n: 'Avena o legumbres' }, { id: 'frituras', n: 'Sin frituras' }], contadores: [{ id: 'c_pescado', n: 'Pescado azul', meta: 2 }] }, days: { '2026-10-15': { comida: { avena: true, frituras: true }, cont: { c_pescado: 1 } }, '2026-10-16': { comida: { avena: true } } } }));
  await verMes(a.page); const t = await texto(a.page);
  assert.match(t, /Anotaste comidas 2 de 19 días/); assert.match(t, /Avena o legumbres 2 días/); assert.match(t, /Sin frituras 1 día\b/); assert.match(t, /Pescado azul 1/);
});
