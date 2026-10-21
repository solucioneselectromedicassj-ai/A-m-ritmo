'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base } = require('./datos');

const con = (modulos, extra = {}) => base(Object.assign({ modulos }, extra));
const irHab = async (page, sub) => { await ir(page, 'habitos'); if (sub) await page.click(`[data-a=sub-h][data-v=${sub}]`); };
const MIERCOLES = '2026-10-21T12:00:00';

test('pasos: cargar a mano; sin meta no hay barra y con meta sí', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: con({ pasos: true }) });
  await irHab(page);
  assert.match(await texto(page), /sin meta/); assert.strictEqual(await page.locator('#pasosBar').count(), 0);
  await page.fill('#pasosInput', '3500'); await page.click('[data-a=pasos-add]'); await page.fill('#pasosInput', '1000'); await page.click('[data-a=pasos-add]');
  assert.strictEqual(await page.innerText('#pasosNum'), '4500');
  await page.fill('#pasosInput', '2000'); await page.click('[data-a=pasos-set]'); assert.strictEqual(await page.innerText('#pasosNum'), '2000');
  await page.fill('#pasosInput', '999999'); await page.click('[data-a=pasos-add]'); assert.strictEqual(await page.innerText('#pasosNum'), '2000');
  const c = await abrir({ ls: con({ pasos: true }, { settings: { creado: '2026-10-01', metaPasos: 8000 } }) });
  await irHab(c.page); assert.strictEqual(await c.page.locator('#pasosBar').count(), 1);
  assert.deepStrictEqual(errores, []);
});

test('pasos (Android): el sensor reparte por día, detecta reinicio y el botón detiene el segundo plano', async ({ abrir }) => {
  const ahora = Date.parse('2026-10-19T12:00:00'), ayer = ahora - 26 * 3600e3;
  const ls = con({ pasos: true }, { sensor: { last: 1000, t: ayer - 1000 } });
  const { page } = await abrir({ ls, native: { StepCounter: {
    isAvailable: '() => ({available:true})', hasPermission: '() => ({granted:true})',
    drain: `() => ({readings:[{t:${ayer},c:1100,b:0},{t:${ayer + 900e3},c:1300,b:0},{t:${ahora - 900e3},c:1500,b:0}]})`,
    read: '() => ({counter:1560,bootTime:0})', startBackground: '() => ({})', stopBackground: '() => ({})' } } });
  await page.waitForTimeout(300);
  let S = await estado(page);
  assert.strictEqual(S.days['2026-10-18'].pasos, 300); assert.strictEqual(S.days['2026-10-19'].pasos, 260);
  await irHab(page); await page.click('[data-a=bg-toggle]');
  assert.ok((await page.evaluate(() => window.__llamadas.map(x => x[1]))).includes('stopBackground'));
  assert.strictEqual((await estado(page)).settings.segundoPlano, false);
  // reinicio del teléfono: el contador baja → cuenta desde cero
  const r = await abrir({ ls: con({ pasos: true }, { sensor: { last: 5000, t: ahora - 3600e3 } }), native: { StepCounter: { isAvailable: '() => ({available:true})', hasPermission: '() => ({granted:true})', drain: '() => ({readings:[]})', read: '() => ({counter:80,bootTime:0})', startBackground: '() => ({})' } } });
  await r.page.waitForTimeout(300); assert.strictEqual((await estado(r.page)).days['2026-10-19'].pasos, 80);
});

test('pasos (Android): sin el módulo activado no se lee el sensor', async ({ abrir }) => {
  const { page } = await abrir({ ls: con({ agua: true }), native: { StepCounter: { isAvailable: '() => ({available:true})', hasPermission: '() => ({granted:true})', read: '() => ({counter:5,bootTime:0})' } } });
  await page.waitForTimeout(250);
  assert.ok(!(await page.evaluate(() => window.__llamadas.map(x => x[0]))).includes('StepCounter'));
});

test('agua: vasos, sin meta por defecto, meta opcional y 7 días', async ({ abrir }) => {
  const { page } = await abrir({ ls: con({ agua: true }) });
  await ir(page, 'hoy'); assert.match(await texto(page), /Agua 0 ml$|Agua 0 ml /); assert.doesNotMatch(await texto(page), /0 ml \/ /);
  await page.click('[data-a="agua+"]'); await page.click('[data-a="agua+"]'); await page.click('[data-a="agua-"]');
  assert.strictEqual((await estado(page)).days['2026-10-19'].agua, 250);
  for (let i = 0; i < 3; i++) await page.click('[data-a="agua-"]'); assert.strictEqual((await estado(page)).days['2026-10-19'].agua, 0, 'no baja de cero');
  await irHab(page); assert.strictEqual(await page.locator('svg.chart rect.barra').count(), 7);
  await ir(page, 'ajustes'); await page.fill('#s_metaAgua', '2000'); await page.fill('#s_vaso', '300'); await page.click('form[data-f=metas] button[type=submit]');
  await ir(page, 'hoy'); await page.click('[data-a="agua+"]'); assert.match(await texto(page), /Agua 300 ml \/ 2000 ml/);
});

test('actividad: semana de lunes a domingo, sin meta por defecto, meta propia y promedio', async ({ abrir }) => {
  const aero = [{ fecha: '2026-09-29', min: 100 }, { fecha: '2026-10-06', min: 200 }, { fecha: '2026-10-13', min: 150 }, { fecha: '2026-10-18', min: 60 }, { fecha: '2026-10-19', min: 50 }];
  const { page } = await abrir({ ls: con({ actividad: true }, { aero }) });
  await irHab(page);
  assert.match(await texto(page), /Actividad aeróbica 50 min /); assert.doesNotMatch(await texto(page), /50 min \/ /, 'sin meta no hay barra');
  assert.match(await texto(page), /Promedio semanal: 140 min \(4 semanas con datos\)/);   // (100 + 200 + (150+60) + 50) / 4; el domingo 18 cuenta en la semana del 12/10
  await ir(page, 'ajustes'); await page.fill('#s_aeroMeta', '150'); await page.click('form[data-f=metas] button[type=submit]');
  await irHab(page); assert.match(await texto(page), /Actividad aeróbica 50 min \/ 150 min/); assert.match(await texto(page), /Te faltan 100 min/);
  assert.match(await page.locator('svg.chart').textContent(), /Meta 150/);
});

test('actividad: validaciones y tipo libre escapado', async ({ abrir }) => {
  const { page } = await abrir({ ls: con({ actividad: true }) });
  await irHab(page);
  const guardar = async (f, m, t) => { await page.fill('#aFecha', f); await page.fill('#aMin', String(m)); await page.fill('#aTipo', t || ''); await page.click('form[data-f=aero] button[type=submit]'); };
  await guardar('2026-10-19', 0); await guardar('2026-10-19', 601); await guardar('2026-10-25', 30);
  assert.strictEqual((await estado(page)).aero.length, 0);
  await guardar('2026-10-19', 30, '<img src=x onerror="window.__xss=1">');
  assert.strictEqual((await estado(page)).aero.length, 1); assert.strictEqual(await page.locator('#view img').count(), 0);
  assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
});

test('alimentación: checklist vacío con sugerencias; agregar, marcar y cumplimiento de la semana', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: con({ comida: true }), fecha: MIERCOLES });
  await irHab(page); assert.match(await texto(page), /Tu checklist está vacío/);
  await page.click('[data-a=com-sug][data-v="0"]');
  await page.click('[data-a=com-sugs]'); assert.doesNotMatch(await page.innerText('#modal'), /Verduras en el almuerzo/, 'ya agregada: no se ofrece de nuevo');
  await page.check('#modal input[value="Sin frituras"]'); await page.click('#modal button[type=submit]');
  const S = await estado(page); assert.deepStrictEqual(S.comida.items.map(i => i.n), ['Verduras en el almuerzo', 'Sin frituras']);
  assert.ok(!S.comida.items.some(i => /fruto|chía|semilla/i.test(i.n)), 'ninguna sugerencia incluye frutos secos, chía ni semillas');
  // lunes 2/2, martes 0/2, miércoles 1/2 → 3 de 6 = 50 %
  const [a, b] = S.comida.items.map(i => i.id);
  await page.evaluate(([a, b]) => { const s = window.SA.state(); s.days['2026-10-19'] = { comida: { [a]: true, [b]: true } }; s.days['2026-10-20'] = {}; }, [a, b]);
  await page.click(`[data-a=com-t][data-id="${a}"]`);
  assert.match(await texto(page), /50 %/); assert.match(await texto(page), /3 de 6 casilleros marcados en 3 días/);
  await page.click(`[data-a=com-t][data-id="${a}"]`); assert.match(await texto(page), /33 %/);
  assert.deepStrictEqual(errores, []);
});

test('alimentación: contadores semanales con meta opcional', async ({ abrir }) => {
  const ls = con({ comida: true }, { comida: { items: [{ id: 'i1', n: 'Sin frituras' }], contadores: [{ id: 'c1', n: 'Pescado', meta: 2 }, { id: 'c2', n: 'Fruta', meta: null }] }, days: { '2026-10-19': { cont: { c1: 1 } }, '2026-10-12': { cont: { c1: 3 } } } });
  const { page } = await abrir({ ls, fecha: MIERCOLES });
  await irHab(page);
  assert.match(await texto(page), /Pescado.*Esta semana \(veces\) 1 \/ 2/, 'la semana pasada no cuenta');
  assert.match(await texto(page), /Fruta.*Esta semana \(veces\) 0$|Fruta.*Esta semana \(veces\) 0 /);
  await page.click('[data-a="cont+"][data-id=c1]'); assert.match(await texto(page), /Esta semana \(veces\) 2 \/ 2/);
  for (let i = 0; i < 4; i++) await page.click('[data-a="cont-"][data-id=c1]'); assert.strictEqual((await estado(page)).days['2026-10-21'].cont.c1, 0);
});

test('alimentación: editar el checklist en Ajustes; quitar un ítem no borra las marcas; texto escapado', async ({ abrir }) => {
  const malo = '<img src=x onerror="window.__xss=1"> ' + 'x'.repeat(200);
  const { page } = await abrir({ ls: con({ comida: true }, { comida: { items: [{ id: 'i1', n: 'Avena' }], contadores: [] }, days: { '2026-10-19': { comida: { i1: true } } } }), dialogos: [true] });
  await ir(page, 'ajustes');
  await page.click('[data-a=com-add]'); await page.fill('#modal [name=n]', malo); await page.click('#modal button[type=submit]');
  await page.click('[data-a=ct-nuevo]'); await page.fill('#modal [name=n]', 'Legumbres'); await page.fill('#modal [name=meta]', '3'); await page.click('#modal button[type=submit]');
  await page.click('[data-a=ci-ren][data-id=i1]'); await page.fill('#modal [name=n]', 'Avena o legumbres'); await page.click('#modal button[type=submit]');
  let S = await estado(page);
  assert.strictEqual(S.comida.items[0].n, 'Avena o legumbres'); assert.ok(S.comida.items[1].n.length <= 80 && S.comida.items[1].n.startsWith('<img'));
  assert.deepStrictEqual(S.comida.contadores.map(c => [c.n, c.meta]), [['Legumbres', 3]]);
  await page.click('[data-a=ci-del][data-id=i1]');
  S = await estado(page); assert.strictEqual(S.comida.items.length, 1); assert.deepStrictEqual(S.days['2026-10-19'].comida, { i1: true });
  await irHab(page); assert.strictEqual(await page.locator('#view img').count(), 0); assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
  await ir(page, 'ajustes'); assert.strictEqual(await page.locator('#view img').count(), 0);
});

test('Hoy resume los módulos activados y nada más', async ({ abrir }) => {
  const { page } = await abrir({ ls: con({ pasos: true, comida: true }, { comida: { items: [{ id: 'i1', n: 'A' }, { id: 'i2', n: 'B' }], contadores: [] }, days: { '2026-10-19': { pasos: 1234, comida: { i1: true } } } }) });
  const t = await texto(page);
  assert.match(t, /Pasos 1234/); assert.match(t, /Alimentación de hoy 1 \/ 2/); assert.doesNotMatch(t, /Agua|Actividad|Ejercicio de hoy/);
});
