'use strict';
const { test, assert, estado, texto } = require('./lib');
const { base } = require('./datos');

const tabs = async page => (await page.locator('#nav button').allInnerTexts()).map(t => t.replace(/^\S+\s*/, ''));
const mods = (...ks) => Promise.all(ks);

test('primer uso: muestra el asistente, sin navegación y con todo vacío (sin metas ni límites por defecto)', async ({ abrir }) => {
  const { page, errores } = await abrir({});
  const S = await estado(page);
  assert.strictEqual(S.listo, false); assert.strictEqual(S.modo, 'registro');
  assert.deepStrictEqual(S.modulos, { ejercicio: false, pasos: false, agua: false, actividad: false, comida: false, medidas: false });
  ['metaPasos', 'metaAgua', 'aeroMeta'].forEach(k => assert.strictEqual(S.settings[k], null, k));
  ['ejercicios', 'sesiones', 'medidas', 'aero'].forEach(k => assert.deepStrictEqual(S[k], [], k));
  assert.deepStrictEqual(S.registros, {}); assert.deepStrictEqual(S.days, {}); assert.deepStrictEqual(S.comida, { items: [], contadores: [] });
  assert.match(await texto(page), /Bienvenido a A Mi Ritmo/);
  assert.match(await texto(page), /no es un servicio médico/);
  assert.ok(await page.locator('#nav').isHidden(), 'sin barra de navegación durante el asistente');
  assert.deepStrictEqual(errores, []);
});

test('asistente: la barra de navegación muestra solo lo que elegiste', async ({ abrir }) => {
  const { page } = await abrir({});
  await page.click('[data-a=wiz-sig]');
  await page.click('[data-a=wiz-mod][data-k=ejercicio]'); await page.click('[data-a=wiz-mod][data-k=medidas]');
  await page.click('[data-a=wiz-sig]');                       // mediciones
  await page.click('[data-a=wiz-med][data-k=presion]'); await page.click('[data-a=wiz-sig]');
  await page.click('[data-a=wiz-bib][data-k="0"]'); await page.click('[data-a=wiz-sig]');   // ejercicio
  await page.click('[data-a=wiz-modo][data-v=recordatorios]'); await page.click('[data-a=wiz-sig]');
  assert.match(await texto(page), /¡Listo!/);
  await page.click('[data-a=wiz-fin]');
  assert.deepStrictEqual(await tabs(page), ['Hoy', 'Ejercicio', 'Medidas', 'Ajustes']);   // sin Hábitos
  const S = await estado(page);
  assert.strictEqual(S.listo, true); assert.strictEqual(S.modo, 'recordatorios');
  assert.strictEqual(S.medidas.length, 1); assert.strictEqual(S.medidas[0].tipo, 'presion');
  assert.ok(S.medidas[0].campos.every(c => c.min === null && c.max === null), 'sin límites por defecto');
  assert.strictEqual(S.sesiones.length, 1); assert.strictEqual(S.ejercicios.length, 1); assert.strictEqual(S.ejercicios[0].n, 'Giros de cadera');
  assert.deepStrictEqual(S.sesiones[0].ej, [S.ejercicios[0].id]);
});

test('asistente: los pasos cambian según lo elegido (metas solo si hay agua, pasos o actividad)', async ({ abrir }) => {
  const { page } = await abrir({});
  await page.click('[data-a=wiz-sig]');
  assert.match(await texto(page), /Paso 2 de 4/);                       // bienvenida, módulos, modo, listo
  await page.click('[data-a=wiz-mod][data-k=agua]');
  assert.match(await texto(page), /Paso 2 de 5/);                       // + metas
  await page.click('[data-a=wiz-mod][data-k=medidas]'); await page.click('[data-a=wiz-mod][data-k=ejercicio]');
  assert.match(await texto(page), /Paso 2 de 7/);                       // + mediciones + ejercicio
});

test('asistente: las metas son opcionales (vacío = sin meta) y se guardan si las escribís', async ({ abrir }) => {
  const { page } = await abrir({});
  await page.click('[data-a=wiz-sig]');
  for (const k of ['agua', 'pasos', 'actividad']) await page.click(`[data-a=wiz-mod][data-k=${k}]`);
  await page.click('[data-a=wiz-sig]');                                  // modo
  await page.click('[data-a=wiz-sig]');                                  // metas
  await page.fill('#w_metaAgua', '2000'); await page.fill('#w_aeroMeta', '90');
  await page.click('[data-a=wiz-sig]'); await page.click('[data-a=wiz-fin]');
  const S = await estado(page);
  assert.strictEqual(S.settings.metaAgua, 2000); assert.strictEqual(S.settings.aeroMeta, 90); assert.strictEqual(S.settings.metaPasos, null);
});

test('asistente: "Saltar y configurar después" deja la app lista y sin nada activado', async ({ abrir }) => {
  const { page } = await abrir({});
  await page.click('[data-a=wiz-fin]');
  const S = await estado(page);
  assert.strictEqual(S.listo, true); assert.deepStrictEqual(await tabs(page), ['Hoy', 'Ajustes']);
  assert.match(await texto(page), /Todavía no activaste ningún módulo/);
});

test('asistente: se puede volver atrás y lo elegido se conserva', async ({ abrir }) => {
  const { page } = await abrir({});
  await page.click('[data-a=wiz-sig]'); await page.click('[data-a=wiz-mod][data-k=comida]'); await page.click('[data-a=wiz-sig]');
  await page.click('[data-a=wiz-atras]');
  assert.strictEqual(await page.getAttribute('[data-a=wiz-mod][data-k=comida]', 'aria-pressed'), 'true');
});

test('rehacer el asistente no borra los datos', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modulos: { medidas: true }, registros: { m1: [{ fecha: '2026-10-10', ts: 1, kg: 80 }] }, medidas: [{ id: 'm1', tipo: 'peso', n: 'Peso', campos: [{ k: 'kg', n: 'Peso', u: 'kg', r: [20, 400], min: null, max: null }], repetirMeses: null, recordarHora: '' }] }), dialogos: [true] });
  await page.click('#nav [data-t=ajustes]'); await page.click('[data-a=wiz-rehacer]');
  assert.match(await texto(page), /Bienvenido a A Mi Ritmo/);
  await page.click('[data-a=wiz-fin]');
  const S = await estado(page);
  assert.strictEqual(S.registros.m1.length, 1); assert.strictEqual(S.medidas.length, 1); assert.strictEqual(S.modulos.medidas, true, 'lo que ya tenías activado se mantiene');
});
