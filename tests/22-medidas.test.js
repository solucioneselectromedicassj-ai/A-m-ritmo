'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, MED } = require('./datos');

const conMed = (tipos, extra = {}) => base(Object.assign({ modulos: { medidas: true }, medidas: tipos.map(t => (typeof t === 'string' ? MED(t) : t)) }, extra));
const llenar = async (page, vals) => { for (const [k, v] of Object.entries(vals)) await page.fill(`#modal [name="${k}"]`, v === null ? '' : String(v)); };
const guardarReg = page => page.click('form[data-f=reg] button[type=submit]');
const toast = page => page.innerText('#toast');
const regs = async (page, id) => (await estado(page)).registros[id] || [];

test('mediciones: agregar desde el catálogo (sin límites), incluida una propia con nombre y unidad', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: base({ modulos: { medidas: true } }) });
  await ir(page, 'medidas'); assert.match(await texto(page), /Todavía no elegiste mediciones/);
  await page.click('[data-a=med-nueva]'); await page.selectOption('#modal [name=tipo]', 'glucosa'); await page.click('#modal button[type=submit]');
  await ir(page, 'ajustes'); await page.click('[data-a=med-nueva]'); await page.selectOption('#modal [name=tipo]', 'propia');
  await page.click('#modal button[type=submit]'); assert.match(await page.innerText('#modalErr'), /nombre/);
  await llenar(page, { n: 'Perímetro de cintura', u: 'cm' }); await page.click('#modal button[type=submit]');
  const S = await estado(page);
  assert.deepStrictEqual(S.medidas.map(m => m.n), ['Glucosa', 'Perímetro de cintura']);
  assert.ok(S.medidas.every(m => m.campos.every(c => c.min === null && c.max === null)), 'ningún límite viene cargado');
  assert.strictEqual(S.medidas[1].campos[0].u, 'cm');
  assert.deepStrictEqual(errores, []);
});

test('registro: requeridos, rango, fecha futura, valores opcionales y mezcla por fecha', async ({ abrir }) => {
  const { page } = await abrir({ ls: conMed(['presion', 'colesterol']) });
  await ir(page, 'medidas');
  await page.fill('#r_sis', '120'); await guardarReg(page);
  assert.strictEqual((await regs(page, 'm_presion')).length, 0, 'falta la mínima: no se guarda');
  assert.strictEqual(await page.locator('#r_dia:invalid').count(), 1, 'el campo obligatorio se marca');
  await page.fill('#r_dia', '20'); await guardarReg(page); assert.match(await toast(page), /Revisá Mínima.*entre 30 y 200/);
  await page.fill('#r_dia', '80'); await page.fill('#rFecha', '2026-12-25'); await guardarReg(page);
  assert.strictEqual(await page.locator('#rFecha:invalid').count(), 1, 'una fecha futura se rechaza');
  assert.strictEqual((await regs(page, 'm_presion')).length, 0, 'nada inválido se guardó');
  await page.fill('#rFecha', '2026-10-18'); await guardarReg(page);
  const primero = await regs(page, 'm_presion'); assert.deepStrictEqual(JSON.stringify(primero.map(r => [r.fecha, r.sis, r.dia, r.pul])), JSON.stringify([['2026-10-18', 120, 80, null]]));
  await page.fill('#rFecha', '2026-10-18'); await page.fill('#r_dia', '80'); await page.fill('#r_pul', '70'); await page.fill('#r_sis', '125'); await guardarReg(page);
  const r = await regs(page, 'm_presion'); assert.strictEqual(r.length, 1, 'la misma fecha se completa'); assert.deepStrictEqual([r[0].sis, r[0].pul], [125, 70]);
  // colesterol: todos opcionales, pero al menos uno
  await page.click('[data-a=sub-m][data-v=m_colesterol]');
  await guardarReg(page); assert.match(await toast(page), /al menos un valor/);
  await page.fill('#r_tg', '160'); await guardarReg(page);
  assert.strictEqual((await regs(page, 'm_colesterol'))[0].tg, 160);
});

test('registro: variación porcentual contra el registro anterior de cada valor', async ({ abrir }) => {
  const registros = { m_colesterol: [{ fecha: '2026-06-10', total: 260, ldl: 179, hdl: 40, tg: 200 }, { fecha: '2026-08-10', ldl: 150 }, { fecha: '2026-10-01', total: 230, ldl: 130, hdl: 45 }] };
  const { page } = await abrir({ ls: conMed(['colesterol'], { registros }) });
  await ir(page, 'medidas');
  const t = await texto(page);
  assert.match(t, /LDL 130 150 ▼ 13,3 %/); assert.match(t, /HDL 45 40 ▲ 12,5 %/); assert.match(t, /Total 230 260 ▼ 11,5 %/); assert.match(t, /Triglicéridos 200 — —/);
  assert.match(t, /01\/10\/2026 · LDL 130 \(▼ 13,3 %\) · HDL 45 \(▲ 12,5 %\) · Total 230 \(▼ 11,5 %\)/);
  assert.match(t, /10\/06\/2026 · LDL 179 · HDL 40 · Total 260 · Triglicéridos 200/);
});

test('gráfico: sin límites no hay líneas; con mín y máx se sombrea; con uno solo, línea', async ({ abrir }) => {
  const registros = { m_peso: [{ fecha: '2026-10-01', kg: 90 }, { fecha: '2026-10-10', kg: 88.5 }] };
  const { page } = await abrir({ ls: conMed(['peso'], { registros }) });
  await ir(page, 'medidas');
  assert.strictEqual(await page.locator('svg.chart .goal, svg.chart .band').count(), 0);
  assert.match(await texto(page), /Sin límites definidos/);
  const dos = await abrir({ ls: conMed([MED('peso', { campos: MED('peso').campos.map(c => Object.assign({}, c, { min: 85, max: 95 })) })], { registros }) });
  await ir(dos.page, 'medidas'); assert.strictEqual(await dos.page.locator('svg.chart .band').count(), 1); assert.strictEqual(await dos.page.locator('svg.chart .goal').count(), 0);
  const uno = await abrir({ ls: conMed([MED('peso', { campos: MED('peso').campos.map(c => Object.assign({}, c, { max: 95 })) })], { registros }) });
  await ir(uno.page, 'medidas'); assert.strictEqual(await uno.page.locator('svg.chart .goal').count(), 1);
  assert.match(await uno.page.locator('svg.chart').textContent(), /Máx 95/);
});

test('modos: solo en "avisos" se alerta, y solo con límites que definió la persona', async ({ abrir }) => {
  const conLim = MED('presion', { campos: MED('presion').campos.map(c => (c.k === 'sis' ? Object.assign({}, c, { max: 130 }) : c)) });
  const registros = { m_presion: [{ fecha: '2026-10-18', sis: 150, dia: 90 }] };
  for (const [modo, alerta] of [['registro', false], ['recordatorios', false], ['avisos', true]]) {
    const { page } = await abrir({ ls: conMed([conLim], { modo, registros }) });
    const h = await texto(page), m = (await ir(page, 'medidas'), await texto(page));
    assert.strictEqual(/por encima del máximo que definiste \(130\)/.test(h), alerta, 'Hoy en modo ' + modo);
    assert.strictEqual(/por encima del máximo que definiste \(130\)/.test(m), alerta, 'Medidas en modo ' + modo);
  }
  // sin límites cargados, ni siquiera en "avisos" hay alertas (la app no inventa umbrales)
  const sin = await abrir({ ls: conMed(['presion'], { modo: 'avisos', registros: { m_presion: [{ fecha: '2026-10-18', sis: 210, dia: 130 }] } }) });
  assert.doesNotMatch(await texto(sin.page), /fuera del rango|por encima|por debajo/);
});

test('avisos: miran el último registro, por debajo del mínimo y respetan unidades', async ({ abrir }) => {
  const med = MED('presion', { campos: MED('presion').campos.map(c => (c.k === 'dia' ? Object.assign({}, c, { min: 60 }) : c)) });
  const reg = { m_presion: [{ fecha: '2026-10-01', sis: 120, dia: 50 }, { fecha: '2026-10-18', sis: 120, dia: 75 }] };
  const a = await abrir({ ls: conMed([med], { modo: 'avisos', registros: reg }) });
  assert.doesNotMatch(await texto(a.page), /por debajo/, 'el registro viejo fuera de rango ya no alerta');
  reg.m_presion.push({ fecha: '2026-10-19', sis: 120, dia: 55 });
  const b = await abrir({ ls: conMed([med], { modo: 'avisos', registros: reg }) });
  assert.match(await texto(b.page), /Mínima \(diastólica\) 55 mmHg está por debajo del mínimo que definiste \(60\)/);
});

test('configurar: límites con validación, repetición y recordatorio', async ({ abrir }) => {
  const { page } = await abrir({ ls: conMed(['presion']) });
  await ir(page, 'ajustes'); await page.click('[data-a=med-conf][data-id=m_presion]');
  await llenar(page, { min_sis: 140, max_sis: 100 }); await page.click('#modal button[type=submit]');
  assert.match(await page.innerText('#modalErr'), /mínimo no puede ser mayor/);
  await llenar(page, { min_sis: 90, max_sis: 140, rep: 99 }); await page.click('#modal button[type=submit]'); assert.match(await page.innerText('#modalErr'), /1 y 36 meses/);
  await llenar(page, { rep: 3, n: 'Mi presión' }); await page.fill('#modal [name=hora]', '09:30'); await page.click('#modal button[type=submit]');
  const m = (await estado(page)).medidas[0];
  assert.deepStrictEqual([m.n, m.campos[0].min, m.campos[0].max, m.campos[1].min, m.repetirMeses, m.recordarHora], ['Mi presión', 90, 140, null, 3, '09:30']);
  // se pueden volver a borrar los límites
  await page.click('[data-a=med-conf][data-id=m_presion]'); await llenar(page, { min_sis: null, max_sis: null, rep: null }); await page.fill('#modal [name=hora]', ''); await page.click('#modal button[type=submit]');
  const n = (await estado(page)).medidas[0]; assert.deepStrictEqual([n.campos[0].min, n.campos[0].max, n.repetirMeses, n.recordarHora], [null, null, null, '']);
});

test('próxima medición: se avisa desde 14 días antes (14 sí, 15 no), singular y sin meses desbordados', async ({ abrir }) => {
  const med = MED('colesterol', { repetirMeses: 2 });
  const con = (fecha, hoyISO) => ({ ls: conMed([med], { registros: { m_colesterol: [{ fecha, ldl: 150 }] } }), fecha: hoyISO || '2026-10-19T12:00:00' });
  let x = await abrir(con('2026-09-02'));                         // 02/09 + 2 meses = 02/11 → faltan 14
  assert.match(await texto(x.page), /Faltan 14 días para la fecha que elegiste \(02\/11\/2026\)/);
  assert.match(await texto(x.page), /Este aviso solo aparece cuando abrís la app\./);
  x = await abrir(con('2026-09-03'));                             // faltan 15
  assert.doesNotMatch(await texto(x.page), /toca repetir/);
  x = await abrir(con('2026-09-05', '2026-11-04T12:00:00'));      // falta 1
  assert.match(await texto(x.page), /Falta 1 día para la fecha/);
  x = await abrir(con('2026-08-10'));                             // ya pasó la fecha
  assert.match(await texto(x.page), /Ya es la fecha que elegiste \(10\/10\/2026\), 2 meses después/);
  x = await abrir(con('2026-12-31', '2026-12-31T12:00:00'));      // 31/12 + 2 meses = 28/02
  await ir(x.page, 'medidas'); assert.match(await texto(x.page), /28\/02\/2027 \(2 meses después/);
  x = await abrir(con('2027-12-31', '2027-12-31T12:00:00'));      // bisiesto
  await ir(x.page, 'medidas'); assert.match(await texto(x.page), /29\/02\/2028/);
  // sin "repetir cada": nada
  const sin = await abrir({ ls: conMed(['colesterol'], { registros: { m_colesterol: [{ fecha: '2026-08-10', ldl: 150 }] } }) });
  assert.doesNotMatch(await texto(sin.page), /toca repetir/);
});

test('mediciones: borrar un registro y quitar una medición (con sus registros)', async ({ abrir }) => {
  const { page } = await abrir({ ls: conMed(['peso'], { registros: { m_peso: [{ fecha: '2026-10-01', kg: 90 }, { fecha: '2026-10-02', kg: 89 }] } }), dialogos: [true, true] });
  await ir(page, 'medidas'); await page.click('[data-a=del]');
  assert.strictEqual((await regs(page, 'm_peso')).length, 1);
  await ir(page, 'ajustes'); await page.click('[data-a=med-del][data-id=m_peso]');
  const S = await estado(page); assert.strictEqual(S.medidas.length, 0); assert.strictEqual(S.registros.m_peso, undefined);
});

test('mediciones: nombres y unidades con HTML se escapan', async ({ abrir }) => {
  const malo = '<img src=x onerror="window.__xss=1">';
  const med = MED('propia', { n: malo }); med.campos[0].u = '<b>u</b>';
  const { page } = await abrir({ ls: conMed([med], { modo: 'avisos', registros: { m_propia: [{ fecha: '2026-10-18', v: 5 }] } }) });
  for (const t of ['hoy', 'medidas', 'ajustes']) { await ir(page, t); assert.strictEqual(await page.locator('#view img').count(), 0, t); }
  assert.strictEqual(await page.evaluate(() => window.__xss), undefined);
  assert.match(await texto(page), /<img src=x/);
});
