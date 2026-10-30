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
  // el intervalo 18/10 10:15 → 19/10 11:45 (+200) cruza la medianoche: 765 min activos ayer y 285 hoy → 146 / 54
  assert.strictEqual(S.days['2026-10-18'].pasos, 446); assert.strictEqual(S.days['2026-10-19'].pasos, 114);
  await irHab(page); await page.click('#view details summary'); await page.click('[data-a=bg-toggle]');
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
  await page.click('[data-a=sub-eva][data-v=trimestre]');                      // por semana: ahí vale la meta semanal
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

test('alimentación: elegir qué anotar (varias sugerencias a la vez), sumar lo propio y marcar lo que comió hoy', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: con({ comida: true }) });
  await irHab(page); assert.match(await texto(page), /¿Qué comés cada día\?/);
  await page.click('[data-a=com-sug][data-v="0"]'); await page.click('[data-a=com-sug][data-v="1"]');
  assert.match(await texto(page), /¿Qué comés cada día\?/, 'elegir una no cierra la pantalla: se pueden elegir varias');
  await page.click('[data-a=com-sug][data-v="1"]');   // la desmarca
  await page.click('[data-a=com-sug-ok]');
  await page.click('[data-a=com-sugs]'); assert.strictEqual(await page.locator('#modal input[value="Fruta"]').count(), 0, 'ya agregada: no se ofrece de nuevo');
  await page.check('#modal input[value="Pescado"]'); await page.click('#modal button[type=submit]');
  const S = await estado(page); assert.deepStrictEqual(S.comida.items.map(i => i.n), ['Fruta', 'Pescado']);
  await page.click(`[data-a=com-t][data-id="${S.comida.items[0].id}"]`);
  assert.deepStrictEqual((await estado(page)).days['2026-10-19'].comida, { [S.comida.items[0].id]: true }); assert.match(await texto(page), /Este mes anotaste comidas 1 de 19 días/);
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
  assert.match(t, /Pasos 1234/); assert.match(t, /Comidas anotadas hoy 1/); assert.doesNotMatch(t, /Agua|Actividad|Ejercicio de hoy/);
});


test('pasos (Android): lo caminado a la noche no se cuenta como pasos del día siguiente', async ({ abrir }) => {
  // Última lectura ayer 21:00 (contador 1000); el teléfono no leyó de noche; hoy a las 07:30 hay 500 pasos más: 2 h de actividad ayer y 30 min hoy.
  const t0 = Date.parse('2026-10-18T21:00:00'), t1 = Date.parse('2026-10-19T07:30:00');
  const nat = lecturas => ({ StepCounter: { isAvailable: '() => ({available:true})', hasPermission: '() => ({granted:true})', drain: `() => ({readings:[{t:${t1},c:1500,b:0}]})`, read: '() => ({counter:1500,bootTime:0})', startBackground: '() => ({})' } });
  const { page } = await abrir({ ls: con({ pasos: true }, { sensor: { last: 1000, t: t0 } }), native: nat(), fecha: '2026-10-19T07:31:00' });
  await page.waitForTimeout(300);
  const S = await estado(page);
  assert.strictEqual(S.days['2026-10-18'].pasos, 400, 'la tarde-noche de ayer queda en ayer');
  assert.strictEqual(S.days['2026-10-19'].pasos, 100, 'a la mañana solo se ven los de la mañana');
  await irHab(page); assert.strictEqual(await page.innerText('#pasosNum'), '100');
});

test('pasos (Android): un intervalo solo de madrugada o de varios días no rompe ni duplica', async ({ abrir }) => {
  // 23:30 → 06:50: todo de noche → se reparte por tiempo (30 min ayer, 410 min hoy)
  const t0 = Date.parse('2026-10-18T23:30:00'), t1 = Date.parse('2026-10-19T06:50:00');
  let a = await abrir({ ls: con({ pasos: true }, { sensor: { last: 0, t: t0 } }), fecha: '2026-10-19T06:51:00', native: { StepCounter: { isAvailable: '() => ({available:true})', hasPermission: '() => ({granted:true})', drain: `() => ({readings:[{t:${t1},c:440,b:0}]})`, read: '() => ({counter:440,bootTime:0})', startBackground: '() => ({})' } } });
  await a.page.waitForTimeout(300);
  let S = await estado(a.page); assert.strictEqual((S.days['2026-10-18'].pasos || 0) + S.days['2026-10-19'].pasos, 440, 'no se pierde ni se duplica ningún paso');
  assert.strictEqual(S.days['2026-10-18'].pasos, 30);
  // 3 días sin abrir la app: se reparte entre los tres días y la suma coincide
  const u = Date.parse('2026-10-16T20:00:00');
  a = await abrir({ ls: con({ pasos: true }, { sensor: { last: 0, t: u } }), native: { StepCounter: { isAvailable: '() => ({available:true})', hasPermission: '() => ({granted:true})', drain: '() => ({readings:[]})', read: '() => ({counter:3000,bootTime:0})', startBackground: '() => ({})' } } });
  await a.page.waitForTimeout(300);
  S = await estado(a.page); const suma = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'].reduce((x, k) => x + ((S.days[k] || {}).pasos || 0), 0);
  assert.strictEqual(suma, 3000); assert.ok(S.days['2026-10-17'].pasos > 0 && S.days['2026-10-19'].pasos > 0);
});

const natPasos = (extra = {}) => ({ StepCounter: Object.assign({ isAvailable: '() => ({available:true})', hasPermission: `() => ({granted: localStorage.getItem('__perm') === '1'})`, ensurePermission: `() => { localStorage.setItem('__perm', '1'); return {granted:true}; }`, drain: '() => ({readings:[]})', read: '() => ({counter:500,bootTime:0})', startBackground: '() => ({})' }, extra) });

test('pasos (Android): al abrir pide el permiso solo, queda activo y no vuelve a pedirlo', async ({ abrir }) => {
  const { page } = await abrir({ ls: con({ pasos: true }), native: natPasos() });
  await page.waitForTimeout(500);
  const ll = await page.evaluate(() => window.__llamadas.map(x => x[1]));
  assert.ok(ll.includes('ensurePermission'), 'pide el permiso sin que la persona toque un botón'); assert.ok(ll.includes('startBackground'), 'el segundo plano queda activo por defecto');
  assert.match(await texto(page), /Contador activo · última lectura/);
  assert.strictEqual(await page.locator('[data-a=sensor-sync]:visible').count(), 0, 'no hay botón de activar: ya está funcionando');
  await irHab(page); assert.match(await texto(page), /Los pasos se cuentan solos, también con la app cerrada/);
  await page.evaluate(() => { window.__llamadas.length = 0; }); await page.reload(); await page.waitForFunction(() => window.SA); await page.waitForTimeout(400);
  assert.ok(!(await page.evaluate(() => window.__llamadas.map(x => x[1]))).includes('ensurePermission'), 'ya tiene el permiso');
});

test('pasos (Android): si no dan el permiso se ve el aviso con botón "Activar" y deja de insistir a la 2.ª vez', async ({ abrir }) => {
  const nat = natPasos({ ensurePermission: '() => ({granted:false})', hasPermission: '() => ({granted:false})' });
  const { page } = await abrir({ ls: con({ pasos: true }), native: nat });
  await page.waitForTimeout(400);
  assert.match(await texto(page), /No diste el permiso/); assert.strictEqual(await page.locator('[data-a=sensor-sync]:visible').count(), 1);
  assert.strictEqual((await estado(page)).settings.pasosRechazos, 1);
  await page.reload(); await page.waitForFunction(() => window.SA); await page.waitForTimeout(400);
  assert.strictEqual((await estado(page)).settings.pasosRechazos, 2);
  await page.evaluate(() => { window.__llamadas.length = 0; }); await page.reload(); await page.waitForFunction(() => window.SA); await page.waitForTimeout(400);
  assert.ok(!(await page.evaluate(() => window.__llamadas.map(x => x[1]))).includes('ensurePermission'), 'a la tercera apertura ya no insiste');
  await page.click('[data-a=sensor-sync]'); await page.waitForTimeout(300);
  assert.ok((await page.evaluate(() => window.__llamadas.map(x => x[1]))).includes('ensurePermission'), 'el botón vuelve a pedirlo');
});

test('evolución de pasos: semana, mes, trimestre y año con promedio por día y meta', async ({ abrir }) => {
  const dias = { '2026-10-19': { pasos: 9000 }, '2026-10-18': { pasos: 7000 }, '2026-10-17': { pasos: 8000 }, '2026-10-05': { pasos: 4000 }, '2026-09-20': { pasos: 6000 } };
  const { page, errores } = await abrir({ ls: con({ pasos: true }, { days: dias, settings: { creado: '2026-09-01', metaPasos: 8000 } }) });
  await irHab(page);
  let t = await texto(page);
  assert.match(t, /Tu evolución de pasos/); assert.match(t, /Promedio: 8000 pasos por día en los últimos 7 días \(3 días con registro\)\. Mejor día: 9000\. Llegaste a la meta en 2 días\./);
  assert.strictEqual(await page.locator('svg.chart rect.barra').count(), 7); assert.match(await page.locator('svg.chart').textContent(), /Meta 8000/);
  for (const [v, n, rx] of [['mes', 4, /últimas 4 semanas \(4 días con registro\)/], ['trimestre', 13, /últimas 13 semanas \(5 días/], ['anio', 12, /últimos 12 meses \(5 días/]]) {
    await page.click(`[data-a=sub-evp][data-v=${v}]`); assert.match(await texto(page), rx, v); assert.strictEqual(await page.locator('svg.chart rect.barra').count(), n, v);
  }
  assert.deepStrictEqual(errores, []);
});

test('evolución de pasos: sin registros no muestra gráfico; no cuenta días anteriores al inicio', async ({ abrir }) => {
  const { page } = await abrir({ ls: con({ pasos: true }, { days: { '2026-09-01': { pasos: 5000 } }, settings: { creado: '2026-10-01' } }) });
  await irHab(page); assert.match(await texto(page), /Todavía no hay pasos registrados en los últimos 7 días/); assert.strictEqual(await page.locator('svg.chart').count(), 0);
});

test('evolución de actividad: minutos por día, por semana (con meta) y por mes', async ({ abrir }) => {
  const aero = [{ fecha: '2026-10-19', min: 30 }, { fecha: '2026-10-19', min: 20 }, { fecha: '2026-10-13', min: 150 }, { fecha: '2026-09-25', min: 90 }];
  const { page } = await abrir({ ls: con({ actividad: true }, { aero, settings: { creado: '2026-09-01', aeroMeta: 150 } }) });
  await irHab(page);
  assert.match(await texto(page), /Total: 200 min en los últimos 7 días/); assert.strictEqual(await page.locator('svg.chart rect.barra').count(), 7);
  await page.click('[data-a=sub-eva][data-v=mes]'); assert.match(await texto(page), /Total: 290 min en las últimas 4 semanas · promedio 73 min por semana\. Meta semanal: 150 min\./);
  await page.click('[data-a=sub-eva][data-v=anio]'); assert.match(await texto(page), /Total: 290 min en los últimos 12 meses/); assert.doesNotMatch(await page.locator('svg.chart').textContent(), /Meta/);
});
