'use strict';
const { test, assert, estado, ir, texto, lsGet } = require('./lib');
const { base, EJ, MED, TODOS } = require('./datos');

const K = 'miplanV1';
const con = (extra = {}) => base(Object.assign({ modulos: TODOS, medidas: [MED('peso')], registros: { m_peso: [{ fecha: '2026-10-10', kg: 80 }] }, days: { '2026-10-18': { agua: 1500 } } }, extra));

test('migración: datos sin versión se conservan, se agregan campos nuevos y queda copia intacta', async ({ abrir }) => {
  const viejo = JSON.stringify({ medidas: [MED('peso')], registros: { m_peso: [{ fecha: '2026-10-10', kg: 80 }] }, days: { '2026-10-18': { agua: 1500 } }, algoFuturo: { x: 1 }, settings: { vaso: 300 } });
  const { page, errores } = await abrir({ ls: { [K]: viejo } });
  const S = await estado(page);
  assert.strictEqual(S.v, 1); assert.strictEqual(S.settings.vaso, 300); assert.deepStrictEqual(S.registros.m_peso, [{ fecha: '2026-10-10', kg: 80 }]);
  assert.strictEqual(S.days['2026-10-18'].agua, 1500); assert.deepStrictEqual(S.algoFuturo, { x: 1 }, 'las claves desconocidas se conservan');
  assert.strictEqual(S.settings.informe.periodo, 90); assert.ok(S.comida && Array.isArray(S.comida.items));
  assert.strictEqual(await lsGet(page, K + '_antes_v1'), viejo, 'copia intacta previa a la migración');
  assert.deepStrictEqual(errores, []);
});

test('migración: la copia previa no se pisa en cargas siguientes', async ({ abrir }) => {
  const viejo = JSON.stringify({ medidas: [], registros: {}, days: { '2026-10-01': { agua: 1 } } });
  const { page } = await abrir({ ls: { [K]: viejo } });
  await page.evaluate(() => { window.SA.state().days['2026-10-02'] = { agua: 2 }; });
  await page.reload(); await page.waitForFunction(() => window.SA);
  assert.strictEqual(await lsGet(page, K + '_antes_v1'), viejo);
});

test('datos corruptos: se conserva el texto original y la app arranca vacía sin romperse', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: { [K]: '{"v":1,"days":{' } });
  assert.strictEqual(await lsGet(page, K + '_corrupto'), '{"v":1,"days":{');
  assert.strictEqual((await estado(page)).listo, false);
  assert.deepStrictEqual(errores, []);
});

test('datos con tipos equivocados no rompen la carga', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: { [K]: JSON.stringify({ v: 1, listo: true, modulos: [], settings: 5, ejercicios: 'x', medidas: [null, 3, MED('peso')], registros: [], days: 'x', comida: { items: 'x' }, aero: {} }) } });
  const S = await estado(page);
  assert.strictEqual(S.medidas.length, 1); assert.deepStrictEqual(S.comida, { items: [], contadores: [] }); assert.deepStrictEqual(S.ejercicios, []);
  for (const t of ['hoy', 'ajustes']) { await ir(page, t).catch(() => { }); }
  assert.deepStrictEqual(errores, []);
});

test('exportar (web): descarga el JSON con todo y marca el respaldo', async ({ abrir }) => {
  const { page } = await abrir({ ls: con() });
  await ir(page, 'ajustes');
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-a=export]')]);
  assert.strictEqual(d.suggestedFilename(), 'mi-plan-respaldo-2026-10-19.json');
  const j = JSON.parse(require('fs').readFileSync(await d.path(), 'utf8'));
  assert.strictEqual(j.registros.m_peso[0].kg, 80);
  assert.ok((await estado(page)).settings.ultimoRespaldo > 0);
});

test('exportar (Android): se guarda en caché y se abre el menú de compartir', async ({ abrir }) => {
  const { page } = await abrir({ native: true, ls: con() });
  await ir(page, 'ajustes'); await page.click('[data-a=export]'); await page.waitForTimeout(250);
  const ll = await page.evaluate(() => window.__llamadas);
  const w = JSON.parse(ll.find(x => x[1] === 'writeFile')[2])[0];
  assert.strictEqual(w.path, 'mi-plan-respaldo-2026-10-19.json'); assert.strictEqual(w.directory, 'CACHE'); assert.strictEqual(JSON.parse(w.data).registros.m_peso[0].kg, 80);
  assert.ok(ll.find(x => x[1] === 'share')); assert.ok((await estado(page)).settings.ultimoRespaldo > 0);
});

test('exportar (Android): si falla no se marca como hecho y se ofrece copiar', async ({ abrir }) => {
  const { page } = await abrir({ native: { Filesystem: { writeFile: '() => { throw new Error("sin espacio"); }' } }, ls: con() });
  await ir(page, 'ajustes'); await page.click('[data-a=export]'); await page.waitForTimeout(250);
  assert.match(await page.innerText('#toast'), /No se pudo exportar/); assert.strictEqual((await estado(page)).settings.ultimoRespaldo, 0);
});

test('copiar respaldo: deja el JSON en el portapapeles', async ({ abrir }) => {
  const { page } = await abrir({ ls: con() });
  await ir(page, 'ajustes'); await page.click('[data-a=copiar]'); await page.waitForTimeout(200);
  assert.strictEqual(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).registros.m_peso[0].kg, 80);
});

test('importar: reemplaza los datos, deja copia de lo anterior y rechaza archivos inválidos', async ({ abrir }) => {
  const { page } = await abrir({ ls: con() });
  await ir(page, 'ajustes');
  const antes = await lsGet(page, K);
  const otro = JSON.stringify({ v: 1, listo: true, modo: 'registro', modulos: TODOS, medidas: [MED('peso')], registros: { m_peso: [{ fecha: '2026-09-01', kg: 70 }] }, days: {} });
  await page.setInputFiles('#fileIn', { name: 'r.json', mimeType: 'application/json', buffer: Buffer.from(otro) }); await page.waitForTimeout(300);
  assert.strictEqual((await estado(page)).registros.m_peso[0].kg, 70);
  assert.strictEqual(await lsGet(page, K + '_antes_importar'), antes);
  await page.setInputFiles('#fileIn', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hola":1}') }); await page.waitForTimeout(300);
  assert.match(await page.innerText('#toast'), /no es una copia válida/); assert.strictEqual((await estado(page)).registros.m_peso[0].kg, 70);
});

test('importar: cancelar la confirmación no cambia nada', async ({ abrir }) => {
  const { page } = await abrir({ ls: con(), dialogos: [false] });
  await ir(page, 'ajustes');
  await page.setInputFiles('#fileIn', { name: 'r.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ days: {}, medidas: [] })) }); await page.waitForTimeout(300);
  assert.strictEqual((await estado(page)).registros.m_peso[0].kg, 80);
});

test('borrar todo: ofrece exportar y pide doble confirmación', async ({ abrir }) => {
  let a = await abrir({ ls: con(), dialogos: [false, false] });   // no exportar, no confirmar
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=borrar]'); await a.page.waitForTimeout(150);
  assert.strictEqual((await estado(a.page)).registros.m_peso.length, 1, 'con la primera confirmación negada no se borra');
  a = await abrir({ ls: con(), dialogos: [false, true, false] });  // segunda sí, última no
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=borrar]'); await a.page.waitForTimeout(150);
  assert.strictEqual((await estado(a.page)).registros.m_peso.length, 1, 'sin la última confirmación no se borra');
  a = await abrir({ ls: con(), dialogos: [false, true, true] });
  await ir(a.page, 'ajustes'); await a.page.click('[data-a=borrar]'); await a.page.waitForTimeout(250);
  const S = await estado(a.page); assert.deepStrictEqual(S.registros, {}); assert.strictEqual(S.listo, false);
});

test('borrar todo: si se acepta exportar, no borra nada todavía', async ({ abrir }) => {
  const { page } = await abrir({ ls: con(), dialogos: [true] });
  await ir(page, 'ajustes');
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-a=borrar]')]);
  assert.match(d.suggestedFilename(), /respaldo/); assert.strictEqual((await estado(page)).registros.m_peso.length, 1);
});

test('recordatorio de respaldo: necesita registros, 3 días de uso y 7 sin respaldo; se pospone por hoy', async ({ abrir }) => {
  const hoyT = '#view';
  let a = await abrir({ ls: base({ modulos: TODOS, settings: { creado: '2026-09-01' } }) });
  assert.doesNotMatch(await texto(a.page, hoyT), /Hacé un respaldo/, 'sin registros no se pide');
  a = await abrir({ ls: con({ settings: { creado: '2026-10-18' } }) });
  assert.doesNotMatch(await texto(a.page, hoyT), /Hacé un respaldo/, 'con menos de 3 días de uso no se pide');
  a = await abrir({ ls: con({ settings: { creado: '2026-10-01', ultimoRespaldo: new Date('2026-10-15T12:00:00').getTime() } }) });
  assert.doesNotMatch(await texto(a.page, hoyT), /Hacé un respaldo/, 'con respaldo reciente no se pide');
  a = await abrir({ ls: con({ settings: { creado: '2026-10-01' } }) });
  assert.match(await texto(a.page, hoyT), /Todavía no exportaste ningún respaldo/);
  await a.page.click('[data-a=resp-luego]');
  assert.doesNotMatch(await texto(a.page, hoyT), /Hacé un respaldo/);
  a = await abrir({ ls: con({ settings: { creado: '2026-10-01', ultimoRespaldo: new Date('2026-10-05T12:00:00').getTime() } }) });
  assert.match(await texto(a.page, hoyT), /Hace 14 días que no exportás un respaldo/);
});
