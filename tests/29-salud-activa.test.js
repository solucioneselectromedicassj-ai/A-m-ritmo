'use strict';
const { test, assert, estado, ir, texto, lsGet } = require('./lib');
const { base, TODOS } = require('./datos');

// Copia como la que exporta "Salud Activa" (formato v3), con datos reales de ejemplo.
const ts = (f, h = 9, m = 30) => new Date(`${f}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
const SA = () => ({
  v: 3,
  settings: { pesoObj: 88, pesoTol: 1.5, metaPasos: 8000, metaAgua: 2500, vaso: 250, umbral: 1.3, pSis: 140, pDia: 90, recAgua: true, recMin: 90, notas: 'Control en diciembre', spo2Min: 92, recSpo2: true, horasSpo2: '09:00, 21:00', segundoPlano: true,
    agRutOn: true, agRutDias: [0, 1, 2, 3, 4, 5, 6], agRutHora: '08:00', agCoreOn: true, agCoreDias: [1, 3, 5], agCoreHora: '18:00', seguirOn: true, seguirHora: '21:00', ldlMeta: 100, aeroMeta: 150, pescadoMeta: 2, ultimoRespaldo: 0 },
  days: {
    '2026-10-15': { pasos: 6500, agua: 2000, rutina: { giros: 30, brazos: 10, piernas: 15, aperturas: 15, rodillas: 20, agacharse: 10 }, core: { gato: 2, bird: 2 }, comida: { avena: true, frituras: true }, pescado: 1 },
    '2026-10-17': { pasos: 4000, omitido: true, core: { puente: 1 } },
    '2026-10-18': { pasos: 9000, agua: 2500, rutina: { giros: 45 }, rareza: 'x' }
  },
  peso: [{ fecha: '2026-09-01', kg: 91 }, { fecha: '2026-10-10', kg: 89.4 }],
  presion: [{ ts: ts('2026-10-10'), sis: 142, dia: 88, pul: 70 }, { ts: ts('2026-10-10', 21, 5), sis: 128, dia: 80, pul: null }],
  colesterol: [{ fecha: '2026-06-10', ldl: 179, hdl: 40, total: 260, tg: 200 }, { fecha: '2026-10-01', ldl: 130, total: 230 }],
  spo2: [{ ts: ts('2026-10-12', 21, 0), spo2: 96, pul: 72 }],
  aero: [{ fecha: '2026-10-12', min: 40, tipo: 'Caminata' }, { fecha: '2026-10-14', min: 0, tipo: 'nada' }],
  comida: { items: [{ id: 'avena', n: 'Avena o legumbres' }, { id: 'frituras', n: 'Sin frituras' }, { id: 'propio', n: 'Mi ítem <b>x</b>' }] },
  dolor: { puente: true, giros: true }, plan: { giros: { meta: 40 }, puente: { series: 3, reps: 10 } }, cerrados: { '2026-10-16': true }, recup: { gato: 1 }, sensor: { last: 5, t: 1 }
});
const importar = async (a, datos, dialogos) => {
  await ir(a.page, 'ajustes');
  await a.page.setInputFiles('#fileIn', { name: 'respaldo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(datos)) }); await a.page.waitForTimeout(400);
};

test('Salud Activa → A Mi Ritmo: ejercicios, agenda, metas y límites propios', async ({ abrir }) => {
  const a = await abrir({ ls: base({ modulos: TODOS }), dialogos: [true] });
  await importar(a, SA());
  const S = await estado(a.page);
  assert.strictEqual(S.listo, true); assert.strictEqual(S.modo, 'avisos'); assert.ok(Object.values(S.modulos).every(Boolean));
  assert.strictEqual(S.ejercicios.length, 12);
  const g = S.ejercicios.find(e => e.id === 'r_giros'), p = S.ejercicios.find(e => e.id === 'c_puente'), pl = S.ejercicios.find(e => e.id === 'c_plancha');
  assert.deepStrictEqual([g.tipo, g.meta, g.fig], ['reps', 40, 'giros'], 'respeta la meta propia (40)');
  assert.deepStrictEqual([p.tipo, p.series, p.reps], ['series', 3, 10], 'respeta las series propias');
  assert.deepStrictEqual([pl.tipo, pl.series, pl.seg], ['tiempo', 2, 15]);
  assert.deepStrictEqual(S.sesiones.map(s => [s.id, s.dias.join(''), s.hora]), [['ses_rutina', '0123456', '08:00'], ['ses_core', '135', '18:00']]);
  assert.deepStrictEqual([S.settings.metaPasos, S.settings.metaAgua, S.settings.aeroMeta, S.settings.notas, S.settings.recAgua], [8000, 2500, 150, 'Control en diciembre', true]);
  assert.strictEqual(S.settings.ultimoRespaldo, 0, 'sigue pidiendo un respaldo propio'); assert.strictEqual(S.settings.creado, '2026-06-10');
  const lim = (id, k) => { const c = S.medidas.find(m => m.id === id).campos.find(x => x.k === k); return [c.min, c.max]; };
  assert.deepStrictEqual(lim('m_presion', 'sis'), [null, 139]); assert.deepStrictEqual(lim('m_presion', 'dia'), [null, 89]);
  assert.deepStrictEqual(lim('m_peso', 'kg'), [86.5, 89.5]); assert.deepStrictEqual(lim('m_colesterol', 'ldl'), [null, 100]); assert.deepStrictEqual(lim('m_spo2', 'sat'), [92, null]);
  assert.strictEqual(S.medidas.find(m => m.id === 'm_colesterol').repetirMeses, 2); assert.strictEqual(S.medidas.find(m => m.id === 'm_spo2').recordarHora, '09:00');
  assert.deepStrictEqual(S.molestias, { c_puente: true, r_giros: true });
});

test('Salud Activa → A Mi Ritmo: ningún registro se pierde ni se inventa', async ({ abrir }) => {
  const a = await abrir({ ls: base({ modulos: TODOS }), dialogos: [true] });
  await importar(a, SA());
  const S = await estado(a.page);
  assert.deepStrictEqual(S.registros.m_peso, [{ fecha: '2026-09-01', kg: 91 }, { fecha: '2026-10-10', kg: 89.4 }]);
  assert.deepStrictEqual(S.registros.m_presion, [{ fecha: '2026-10-10', hora: '09:30', sis: 142, dia: 88, pul: 70 }, { fecha: '2026-10-10', hora: '21:05', sis: 128, dia: 80 }], 'las dos tomas del mismo día quedan');
  assert.deepStrictEqual(S.registros.m_colesterol, [{ fecha: '2026-06-10', ldl: 179, hdl: 40, total: 260, tg: 200 }, { fecha: '2026-10-01', ldl: 130, total: 230 }]);
  assert.deepStrictEqual(S.registros.m_spo2, [{ fecha: '2026-10-12', hora: '21:00', sat: 96, pul: 72 }]);
  assert.deepStrictEqual(S.aero, [{ fecha: '2026-10-12', min: 40, tipo: 'Caminata' }], 'el registro de 0 minutos no es un registro');
  assert.deepStrictEqual(S.days['2026-10-15'], { pasos: 6500, agua: 2000, ej: { r_giros: 30, r_brazos: 10, r_piernas: 15, r_aperturas: 15, r_rodillas: 20, r_agacharse: 10, c_gato: 2, c_bird: 2 }, comida: { avena: true, frituras: true }, cont: { c_pescado: 1 } });
  assert.deepStrictEqual(S.days['2026-10-17'], { pasos: 4000, ej: { c_puente: 1 }, omit: { ses_core: true } });
  assert.deepStrictEqual(S.days['2026-10-18'], { pasos: 9000, agua: 2500, ej: { r_giros: 45 } }, 'se pasa de la meta y queda tal cual');
  assert.deepStrictEqual(S.comida.items.map(i => i.id), ['avena', 'frituras', 'propio']); assert.deepStrictEqual(S.comida.contadores, [{ id: 'c_pescado', n: 'Pescado azul', meta: 2 }]);
  assert.strictEqual(S.importado.de, 'Salud Activa'); assert.deepStrictEqual(S.importado.datos.recup, { gato: 1 }, 'la copia original queda íntegra adentro');
  assert.strictEqual(S.importado.datos.days['2026-10-18'].rareza, 'x');
});

test('Salud Activa → A Mi Ritmo: lo anterior queda guardado, la app funciona entera y se puede volver a respaldar', async ({ abrir }) => {
  const previo = base({ modulos: TODOS }).miplanV1;
  const a = await abrir({ ls: { miplanV1: previo }, dialogos: [true] });
  await importar(a, SA());
  assert.strictEqual(await lsGet(a.page, 'miplanV1_antes_importar'), previo);
  assert.match(await a.page.innerText('#toast'), /Copia de Salud Activa importada/);
  for (const t of ['hoy', 'ejercicio', 'medidas', 'habitos', 'ajustes']) { await ir(a.page, t); await a.page.waitForTimeout(60); }
  await ir(a.page, 'medidas'); assert.match(await texto(a.page), /Presión arterial/);
  await ir(a.page, 'ejercicio'); assert.match(await texto(a.page), /Tu evolución/);
  const inf = await a.page.evaluate(() => window.SA.informeCuerpo());
  assert.match(inf.replace(/<[^>]+>/g, ' '), /Colesterol/); assert.ok(inf.includes('Mi ítem') === false || !inf.includes('<b>x</b>'), 'texto escapado');
  assert.deepStrictEqual(a.errores, []);
  // un respaldo de A Mi Ritmo hecho después se vuelve a importar sin pasar por la conversión
  const S1 = await estado(a.page), json = JSON.stringify(S1);
  const b = await abrir({ ls: base({ modulos: TODOS }), dialogos: [true] });
  await importar(b, JSON.parse(json));
  assert.deepStrictEqual((await estado(b.page)).registros, S1.registros);
});

test('Salud Activa → A Mi Ritmo: cancelar no cambia nada, y los datos raros no rompen', async ({ abrir }) => {
  const a = await abrir({ ls: base({ modulos: TODOS, registros: { m_peso: [{ fecha: '2026-10-10', kg: 80 }] }, medidas: [] }), dialogos: [false] });
  await importar(a, SA());
  assert.strictEqual((await estado(a.page)).ejercicios.length, 0);
  const raro = { v: 3, settings: 'x', days: { '2026-10-01': 5, 'malo': { pasos: 1 }, '2026-10-02': { rutina: 'x', core: [], pasos: 'abc', comida: 3 } }, peso: [{ fecha: 5, kg: 'x' }, null], presion: [{ ts: 'x', sis: 1, dia: 2 }], colesterol: 'x', aero: [{}], comida: { items: 'x' }, plan: 3 };
  const b = await abrir({ ls: base({ modulos: TODOS }), dialogos: [true] });
  await importar(b, raro);
  const S = await estado(b.page); assert.strictEqual(S.listo, true); assert.deepStrictEqual(S.registros.m_peso, []); assert.deepStrictEqual(S.days, {});
  for (const t of ['hoy', 'ejercicio', 'medidas', 'habitos', 'ajustes']) { await ir(b.page, t); }
  assert.deepStrictEqual(b.errores, []);
});
