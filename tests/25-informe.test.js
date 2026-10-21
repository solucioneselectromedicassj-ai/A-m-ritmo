'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, EJ, MED, TODOS } = require('./datos');

const lim = (m, k, o) => Object.assign({}, m, { campos: m.campos.map(c => (c.k === k ? Object.assign({}, c, o) : c)) });
const completo = (extra = {}) => base(Object.assign({
  modulos: TODOS, settings: { creado: '2026-10-01', metaPasos: 8000, metaAgua: 2000, aeroMeta: 150, notas: 'Control en diciembre <b>x</b>', informe: { periodo: 0, excluir: {} } },
  ejercicios: [EJ('e1', 'Giros', 'reps', { meta: 30 })], sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '', ej: ['e1'] }],
  medidas: [lim(MED('colesterol'), 'ldl', { max: 100 }), MED('presion')],
  registros: { m_colesterol: [{ fecha: '2026-06-10', ldl: 179, hdl: 40, total: 260, tg: 200 }, { fecha: '2026-10-01', ldl: 130, hdl: 45, total: 230, tg: 150 }], m_presion: [{ fecha: '2026-10-18', sis: 128, dia: 82 }] },
  days: { '2026-10-19': { ej: { e1: 30 }, pasos: 6000, agua: 1500, comida: { i1: true } }, '2026-10-18': { ej: { e1: 10 }, pasos: 8000, agua: 2500 }, '2026-10-17': { pasos: 10000 } },
  aero: [{ fecha: '2026-10-12', min: 150 }, { fecha: '2026-10-19', min: 50 }], comida: { items: [{ id: 'i1', n: 'Sin frituras' }, { id: 'i2', n: 'Verduras' }], contadores: [{ id: 'c1', n: 'Pescado', meta: 2 }] }
}, extra));
const cuerpo = async page => (await page.evaluate(() => window.SA.informeCuerpo()));
const plano = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('informe: incluye mediciones con variación y límites, ejercicio, pasos, agua, actividad y alimentación', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: completo() });
  const h = await cuerpo(page), t = plano(h);
  assert.match(t, /Colesterol Límites definidos por la persona o su profesional — LDL: máx\. 100\./);
  assert.match(t, /01\/10\/2026 130 \(▼ 27,4 %\) 45 \(▲ 12,5 %\) 230 \(▼ 11,5 %\) 150 \(▼ 25,0 %\)/);
  assert.match(t, /10\/06\/2026 179 40 260 200/);
  assert.match(h, /<svg[^>]*aria-label="Evolución de LDL \(Colesterol\)"/); assert.match(h, /class="goal"/);
  assert.match(t, /Presión arterial Sin límites definidos\./);
  assert.match(t, /Rutinas completas: 1 de \d+ programadas en el período/);
  assert.match(t, /Promedio de 8000 pasos por día \(3 días con registro\), meta 8000/);
  assert.match(t, /Promedio de 2000 ml por día \(2 días con registro\), meta 2000 ml/);
  assert.match(t, /Promedio semanal: 100 min \(2 semanas con registros\), meta 150 min/);
  assert.match(t, /Semana del 19\/10 50 %/);
  assert.ok(h.includes('Control en diciembre &lt;b&gt;x&lt;/b&gt;'), 'las notas se escapan');
  assert.deepStrictEqual(errores, []);
});

test('informe: sin límites no dibuja líneas; con datos vacíos no falla', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: base({ modulos: TODOS, medidas: [MED('peso')] }) });
  const h = await cuerpo(page), t = plano(h);
  assert.match(t, /Sin límites definidos/); assert.match(t, /Sin registros/); assert.doesNotMatch(h, /class="goal"/);
  assert.deepStrictEqual(errores, []);
});

test('informe: se elige el período y qué incluir, y queda guardado', async ({ abrir }) => {
  const { page } = await abrir({ ls: completo() });
  await ir(page, 'ajustes');
  await page.selectOption('#inf_periodo', '30'); await page.uncheck('.inf-inc[value=pasos]'); await page.uncheck('.inf-inc[value="medida:m_presion"]');
  await page.evaluate(() => { window.print = () => { window.__impreso = document.querySelector('#informe').innerHTML; }; });
  await page.click('[data-a=informe]');
  const h = await page.evaluate(() => window.__impreso), t = plano(h);
  assert.match(t, /Período: últimos 30 días/); assert.doesNotMatch(t, /Promedio de 8000 pasos/); assert.doesNotMatch(t, /Presión arterial/);
  assert.match(t, /Colesterol/); assert.match(t, /Agua/);
  const S = await estado(page); assert.strictEqual(S.settings.informe.periodo, 30); assert.deepStrictEqual(S.settings.informe.excluir, { pasos: true, 'medida:m_presion': true });
  await page.reload(); await page.waitForFunction(() => window.SA); await ir(page, 'ajustes');
  assert.strictEqual(await page.inputValue('#inf_periodo'), '30'); assert.strictEqual(await page.locator('.inf-inc[value=pasos]').isChecked(), false);
});

test('informe: el período filtra los registros', async ({ abrir }) => {
  const { page } = await abrir({ ls: completo({ settings: { creado: '2026-10-01', informe: { periodo: 30, excluir: {} } } }) });
  const t = plano(await cuerpo(page));
  assert.doesNotMatch(t, /10\/06\/2026/, 'el análisis de junio queda fuera de los últimos 30 días');
  const todo = plano(await (await abrir({ ls: completo({ settings: { creado: '2026-10-01', informe: { periodo: 0, excluir: {} } } }) })).page.evaluate(() => window.SA.informeCuerpo()));
  assert.match(todo, /10\/06\/2026/); assert.match(todo, /Período: todo lo registrado/);
});

test('informe (Android): se comparte como HTML autónomo; en la web se imprime', async ({ abrir }) => {
  const { page } = await abrir({ native: true, ls: completo() });
  await ir(page, 'ajustes'); await page.click('[data-a=informe]'); await page.waitForTimeout(250);
  const ll = await page.evaluate(() => window.__llamadas.filter(x => x[0] === 'Filesystem' || x[0] === 'Share'));
  const w = JSON.parse(ll.find(x => x[1] === 'writeFile')[2])[0];
  assert.strictEqual(w.path, 'informe-salud-2026-10-19.html'); assert.match(w.data, /^<!doctype html>/); assert.match(w.data, /<style>/); assert.match(w.data, /Evolución de LDL/);
  assert.ok(ll.find(x => x[1] === 'share'));
});

test('informe: nombres con HTML se escapan en todas las secciones', async ({ abrir }) => {
  const malo = '<img src=x onerror="window.__xss=1">';
  const { page } = await abrir({ ls: completo({ medidas: [MED('peso', { n: malo })], sesiones: [{ id: 's1', n: malo, dias: [1], hora: '', ej: ['e1'] }], comida: { items: [{ id: 'i1', n: malo }], contadores: [{ id: 'c1', n: malo, meta: 1 }] }, ejercicios: [EJ('e1', malo, 'reps')] }) });
  const h = await cuerpo(page);
  assert.ok(!h.includes('<img src=x'), 'nada sin escapar'); assert.ok(h.includes('&lt;img src=x'));
});
