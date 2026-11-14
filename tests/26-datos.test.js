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
  assert.strictEqual(d.suggestedFilename(), 'a-mi-ritmo-respaldo-2026-10-19.json');
  const j = JSON.parse(require('fs').readFileSync(await d.path(), 'utf8'));
  assert.strictEqual(j.registros.m_peso[0].kg, 80);
  assert.ok((await estado(page)).settings.ultimoRespaldo > 0);
});

test('exportar (Android): se guarda en caché y se abre el menú de compartir', async ({ abrir }) => {
  const { page } = await abrir({ native: true, ls: con() });
  await ir(page, 'ajustes'); await page.click('[data-a=export]'); await page.waitForTimeout(250);
  const ll = await page.evaluate(() => window.__llamadas);
  const w = JSON.parse(ll.find(x => x[1] === 'writeFile')[2])[0];
  assert.strictEqual(w.path, 'a-mi-ritmo-respaldo-2026-10-19.json'); assert.strictEqual(w.directory, 'CACHE'); assert.strictEqual(JSON.parse(w.data).registros.m_peso[0].kg, 80);
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
  assert.match(await page.innerText('#modal'), /no reconozco el formato/); assert.strictEqual((await estado(page)).registros.m_peso[0].kg, 70);
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

test('recordatorio de respaldo: necesita registros, 3 días de uso y 7 sin respaldo; se cierra por hoy', async ({ abrir }) => {
  const hoyT = '#view';
  let a = await abrir({ ls: base({ modulos: TODOS, settings: { creado: '2026-09-01' } }) });
  assert.doesNotMatch(await texto(a.page, hoyT), /Hacé un respaldo/, 'sin registros no se pide');
  a = await abrir({ ls: con({ settings: { creado: '2026-10-18' } }) });
  assert.doesNotMatch(await texto(a.page, hoyT), /Hacé un respaldo/, 'con menos de 3 días de uso no se pide');
  a = await abrir({ ls: con({ settings: { creado: '2026-10-01', ultimoRespaldo: new Date('2026-10-15T12:00:00').getTime() } }) });
  assert.doesNotMatch(await texto(a.page, hoyT), /Hacé un respaldo/, 'con respaldo reciente no se pide');
  a = await abrir({ ls: con({ settings: { creado: '2026-10-01' } }) });
  assert.match(await texto(a.page, hoyT), /Todavía no exportaste ninguno/);
  await a.page.click('[data-a=resp-luego]');
  assert.doesNotMatch(await texto(a.page, hoyT), /Hacé un respaldo/);
  a = await abrir({ ls: con({ settings: { creado: '2026-10-01', ultimoRespaldo: new Date('2026-10-05T12:00:00').getTime() } }) });
  assert.match(await texto(a.page, hoyT), /Hace 14 días que no exportás uno/);
});

const SAJSON = () => JSON.stringify({ v: 3, settings: { pesoObj: 88, pesoTol: 1.5 }, days: { '2026-10-15': { pasos: 6500, agua: 2000 } }, peso: [{ fecha: '2026-10-10', kg: 89.4 }], presion: [], colesterol: [], spo2: [], aero: [], comida: { items: [] }, dolor: {}, plan: {} });

test('importar: el selector de archivos no filtra por tipo (un archivo que pasó por WhatsApp puede llegar como otro tipo)', async ({ abrir }) => {
  const { page } = await abrir({ ls: con() });
  await ir(page, 'ajustes');
  assert.strictEqual(await page.getAttribute('#fileIn', 'accept'), null, 'sin accept: se puede elegir cualquier archivo');
  await page.setInputFiles('#fileIn', { name: 'respaldo (1).json', mimeType: 'application/octet-stream', buffer: Buffer.from(SAJSON()) });
  await page.waitForTimeout(300); // pide confirmación (se acepta sola) y convierte
  assert.strictEqual((await estado(page)).registros.m_peso[0].kg, 89.4);
});

test('importar: "Pegar respaldo" trae lo copiado de Salud Activa (sin pasar por archivos)', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: base({ modulos: TODOS }), dialogos: [true] });
  await ir(page, 'ajustes'); await page.click('[data-a=pegar]');
  await page.click('#modal button[type=submit]'); assert.ok(await page.isVisible('#modal'), 'vacío: no avanza'); assert.match(await page.innerText('#modalErr'), /Pegá el texto/);
  await page.fill('#modal textarea', SAJSON()); await page.click('#modal button[type=submit]'); await page.waitForTimeout(400);
  const S = await estado(page); assert.deepStrictEqual(S.registros.m_peso, [{ fecha: '2026-10-10', kg: 89.4 }]); assert.strictEqual(S.days['2026-10-15'].pasos, 6500);
  assert.match(await page.innerText('#toast'), /Copia de Salud Activa importada/); assert.deepStrictEqual(errores, []);
});

test('importar: cada problema se explica (informe en HTML, texto cualquiera, JSON desconocido)', async ({ abrir }) => {
  const { page } = await abrir({ ls: con(), dialogos: [true] });
  const prueba = async (txt, rx) => { await ir(page, 'ajustes'); await page.click('[data-a=pegar]'); await page.fill('#modal textarea', txt); await page.click('#modal button[type=submit]'); await page.waitForTimeout(250); assert.match(await page.innerText('#modal'), rx, txt.slice(0, 20)); await page.click('#modal [data-a=modal-cancel]'); };
  await prueba('<!doctype html><html><body>Informe</body></html>', /es un informe .* no un respaldo/);
  await prueba('hola, este es mi respaldo', /no tiene el formato de un respaldo/);
  await prueba('{"algo":1}', /no reconozco el formato/);
  await prueba('[1,2,3]', /no es un respaldo/);
  assert.strictEqual((await estado(page)).registros.m_peso[0].kg, 80, 'ningún intento tocó los datos');
});

test('aviso de respaldo: aparece unos segundos, se va solo y no vuelve al día siguiente (recién a los 30 días); en Ajustes queda siempre', async ({ abrir }) => {
  const ls = con({ settings: { creado: '2026-10-01' } });
  const a = await abrir({ ls });
  assert.match(await texto(a.page), /Hacé un respaldo[\s\S]*Todavía no exportaste ninguno/); assert.ok(await a.page.locator('.card.efimera').count() === 1);
  await a.page.waitForTimeout(10600);
  assert.doesNotMatch(await texto(a.page), /Hacé un respaldo/, 'desapareció solo');
  await a.page.reload(); await a.page.waitForFunction(() => window.SA); assert.doesNotMatch(await texto(a.page), /Hacé un respaldo/, 'no vuelve al recargar');
  await ir(a.page, 'ajustes'); assert.match(await texto(a.page), /Último respaldo: nunca/); assert.strictEqual(await a.page.locator('[data-a=export]').count(), 1);
  const manana = await abrir({ ls: await a.page.evaluate(() => ({ miplanV1: localStorage.getItem('miplanV1') })), fecha: '2026-10-20T12:00:00' });
  assert.doesNotMatch(await texto(manana.page), /Hacé un respaldo/, 'al otro día NO vuelve');
  const mes = await abrir({ ls: await a.page.evaluate(() => ({ miplanV1: localStorage.getItem('miplanV1') })), fecha: '2026-11-19T12:00:00' });
  assert.match(await texto(mes.page), /Hacé un respaldo/, 'a los 30 días vuelve a avisar una vez');
});
