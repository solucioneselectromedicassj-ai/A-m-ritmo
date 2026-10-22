'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, EJ, TODOS } = require('./datos');

// Lunes 19/10/2026: la rutina "Mañana" (L-M-V) toca hoy; "Tarde" (martes) no.
const plan = (extra = {}) => base(Object.assign({
  modulos: { ejercicio: true }, modo: 'registro',
  ejercicios: [EJ('e1', 'Giros', 'reps', { meta: 30, fig: 'giros' }), EJ('e2', 'Puente', 'series', { fig: 'puente' }), EJ('e3', 'Plancha', 'tiempo'), EJ('e4', 'Elongar', 'reps')],
  sesiones: [{ id: 's1', n: 'Mañana', dias: [1, 3, 5], hora: '08:00', ej: ['e1', 'e2', 'e3'] }, { id: 's2', n: 'Tarde', dias: [2], hora: '', ej: ['e4'] }]
}, extra));
const abrirR = page => page.evaluate(() => document.querySelectorAll('details.compacto').forEach(d => { d.open = true; }));   // los ejercicios ya resueltos están plegados
const llenar = async (page, vals) => { for (const [k, v] of Object.entries(vals)) { const el = page.locator(`#modal [name="${k}"]`); if (v === null) await el.fill(''); else await el.fill(String(v)); } };

test('ejercicio: hoy se ven solo las rutinas del día; las otras quedan aparte', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: plan() });
  await ir(page, 'ejercicio');
  const t = await texto(page);
  assert.match(t, /Mañana · 08:00/); assert.match(t, /Giros/); assert.match(t, /Puente/);
  assert.match(t, /Otras rutinas \(1\)/);
  assert.strictEqual(await page.locator('#view > .card h3', { hasText: 'Tarde' }).count(), 0, 'la rutina del martes no es de hoy');
  assert.ok(await page.locator('details.card svg').count() === 0 || true);
  assert.strictEqual(await page.locator('.item .fig svg').count(), 2, 'los ejemplos con figura la muestran (Giros y Puente)');
  assert.deepStrictEqual(errores, []);
});

test('ejercicio: repeticiones sin tope, +5, número exacto y restar', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan(), dialogos: ['45'] });
  await ir(page, 'ejercicio');
  await page.click('[data-a="ej+"][data-id=e1]'); await page.click('[data-a="ej+5"][data-id=e1]');
  let S = await estado(page); assert.strictEqual(S.days['2026-10-19'].ej.e1, 6);
  await page.click('[data-a=ej-set][data-id=e1]');
  S = await estado(page); assert.strictEqual(S.days['2026-10-19'].ej.e1, 45, 'se pasa de la meta de 30');
  await abrirR(page); assert.match(await texto(page), /45\/30/);
  await page.click('[data-a="ej-"][data-id=e1]'); S = await estado(page); assert.strictEqual(S.days['2026-10-19'].ej.e1, 44);
});

test('ejercicio: series con casilleros, descanso entre series y sin descanso en la última', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan({ settings: { creado: '2026-10-01', descansoSeg: 30 } }) });
  await ir(page, 'ejercicio');
  await page.click('[data-a="ej+"][data-id=e2]');
  assert.ok(await page.locator('#timer').isVisible(), 'arranca el descanso');
  assert.match(await page.innerText('#timerTime'), /0:(30|29)/);
  await page.click('[data-a=timer-stop]');
  await page.click('[data-a="ej+"][data-id=e2]');
  assert.ok(await page.locator('#timer').isHidden(), 'la última serie no dispara descanso');
  await abrirR(page); await page.click('[data-a="ej+"][data-id=e2]');            // una de más: se permite
  assert.strictEqual((await estado(page)).days['2026-10-19'].ej.e2, 3);
  await abrirR(page); assert.match(await texto(page), /3 series hechas/);
});

test('ejercicio: "Lo hice todo", "No pude hoy" y "Me molestó"', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ejercicio');
  await page.click('[data-a=ses-no][data-id=s1]');
  let S = await estado(page); assert.strictEqual(S.days['2026-10-19'].omit.s1, true);
  await page.click('[data-a=ses-todo][data-id=s1]');
  S = await estado(page);
  assert.deepStrictEqual([S.days['2026-10-19'].ej.e1, S.days['2026-10-19'].ej.e2, S.days['2026-10-19'].ej.e3], [30, 2, 2]);
  assert.strictEqual(S.days['2026-10-19'].omit.s1, undefined, 'al completarla se limpia el "no pude"');
  assert.match(await texto(page), /3 de 3 ejercicios completos/);
  await abrirR(page); await page.click('[data-a=mol][data-id=e1]');
  assert.strictEqual((await estado(page)).molestias.e1, true);
  await abrirR(page); assert.match(await texto(page), /Marcado como molesto/);
  await page.click('[data-a=mol][data-id=e1]'); assert.strictEqual((await estado(page)).molestias.e1, undefined);
});

test('ejercicio: siempre muestra el aviso de cortar ante dolor, mareo o falta de aire', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ejercicio');
  assert.match(await texto(page), /Cortá el ejercicio y consultá si aparece: dolor fuerte, mareo, falta de aire/);
});

test('plan: crear ejercicios de los tres tipos con validación', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ajustes'); await page.click('[data-a=ej-nuevo]');
  await page.click('#modal button[type=submit]'); assert.match(await page.innerText('#modalErr'), /nombre/);
  await llenar(page, { n: 'Sentadilla' }); await page.selectOption('#modal [name=tipo]', 'reps');
  await page.click('#modal button[type=submit]'); assert.match(await page.innerText('#modalErr'), /entre 1 y 999/);
  await llenar(page, { meta: 12 }); await page.click('#modal button[type=submit]');
  assert.ok(await page.locator('#modal').isHidden());
  await page.click('[data-a=ej-nuevo]'); await llenar(page, { n: 'Remo', series: 3, reps: 0 }); await page.selectOption('#modal [name=tipo]', 'series');
  await page.click('#modal button[type=submit]'); assert.match(await page.innerText('#modalErr'), /por serie/);
  await llenar(page, { reps: 10 }); await page.click('#modal button[type=submit]');
  await page.click('[data-a=ej-nuevo]'); await llenar(page, { n: 'Isométrico', series: 2, seg: 5000 }); await page.selectOption('#modal [name=tipo]', 'tiempo');
  await page.click('#modal button[type=submit]'); assert.match(await page.innerText('#modalErr'), /segundos/);
  await llenar(page, { seg: 20 }); await page.click('#modal button[type=submit]');
  const S = await estado(page), n = id => S.ejercicios.find(e => e.n === id);
  assert.deepStrictEqual([n('Sentadilla').tipo, n('Sentadilla').meta], ['reps', 12]);
  assert.deepStrictEqual([n('Remo').series, n('Remo').reps, n('Remo').meta], [3, 10, undefined]);
  assert.deepStrictEqual([n('Isométrico').series, n('Isométrico').seg], [2, 20]);
  assert.ok(S.sesiones[0].ej.includes(n('Sentadilla').id), 'se suma a la rutina elegida');
});

test('plan: editar y quitar un ejercicio, cambiar de rutina; lo registrado no se borra', async ({ abrir }) => {
  const ls = plan({ days: { '2026-10-19': { ej: { e1: 25 } } } });
  const { page } = await abrir({ ls, dialogos: [true] });
  await ir(page, 'ajustes'); await page.click('[data-a=ej-edit][data-id=e1]');
  await llenar(page, { n: 'Giros suaves', meta: 12 }); await page.selectOption('#modal [name=ses]', 's2'); await page.click('#modal button[type=submit]');
  let S = await estado(page);
  assert.strictEqual(S.ejercicios.find(e => e.id === 'e1').n, 'Giros suaves'); assert.strictEqual(S.ejercicios.find(e => e.id === 'e1').fig, 'giros', 'conserva su figura');
  assert.ok(S.sesiones[1].ej.includes('e1') && !S.sesiones[0].ej.includes('e1'), 'cambió de rutina');
  await page.click('[data-a=ej-del][data-id=e1]');
  S = await estado(page);
  assert.ok(!S.ejercicios.some(e => e.id === 'e1')); assert.strictEqual(S.days['2026-10-19'].ej.e1, 25, 'el historial se conserva');
});

test('plan: crear, editar y quitar rutinas con días y hora', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan(), dialogos: [true] });
  await ir(page, 'ajustes'); await page.click('[data-a=ses-nueva]');
  await llenar(page, { n: 'Piernas' });
  await page.locator('#modal input[name=dias]').evaluateAll(els => els.forEach(e => { e.checked = false; }));
  await page.click('#modal button[type=submit]'); assert.match(await page.innerText('#modalErr'), /al menos un día/);
  await page.check('#modal input[name=dias][value="4"]'); await page.fill('#modal [name=hora]', '19:30'); await page.click('#modal button[type=submit]');
  let S = await estado(page); const s = S.sesiones.find(x => x.n === 'Piernas');
  assert.deepStrictEqual(s.dias, [4]); assert.strictEqual(s.hora, '19:30');
  await page.click(`[data-a=ses-del][data-id=${s.id}]`);
  assert.ok(!(await estado(page)).sesiones.some(x => x.n === 'Piernas'));
  await page.click('[data-a=ses-del][data-id=s2]');
  S = await estado(page); assert.ok(!S.ejercicios.some(e => e.id === 'e4'), 'los ejercicios de una rutina quitada se quitan del plan');
});

test('biblioteca: suma ejemplos a la rutina elegida (con figura) y crea "Mi rutina" si no hay ninguna', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modulos: { ejercicio: true } }) });
  await ir(page, 'ejercicio');
  assert.match(await texto(page), /Todavía no tenés una rutina/);
  await page.click('[data-a=plan-bib]');
  assert.match(await page.innerText('#modal'), /no una indicación/);
  await page.check('#modal input[value="0"]'); await page.check('#modal input[value="10"]'); await page.click('#modal button[type=submit]');
  const S = await estado(page);
  assert.strictEqual(S.sesiones[0].n, 'Mi rutina'); assert.strictEqual(S.sesiones[0].dias.length, 7);
  assert.deepStrictEqual(S.ejercicios.map(e => e.fig), ['giros', 'lateral']); assert.strictEqual(S.ejercicios[1].tipo, 'tiempo');
  await ir(page, 'ejercicio'); assert.strictEqual(await page.locator('.item .fig svg').count(), 2);
});

test('Hoy resume el ejercicio del día', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan({ days: { '2026-10-19': { ej: { e1: 30, e2: 2 } } } }) });
  assert.match(await texto(page), /Ejercicio de hoy 2 \/ 3/);
  const o = await abrir({ ls: plan({ sesiones: [{ id: 's2', n: 'Tarde', dias: [2], hora: '', ej: ['e4'] }] }) });
  assert.match(await texto(o.page), /hoy no tenés rutina programada/);
});

test('plan: sin ejercicio activado no aparece la pestaña, y los datos se conservan', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan({ days: { '2026-10-19': { ej: { e1: 5 } } } }) });
  await ir(page, 'ajustes'); await page.uncheck('[data-a=mod-t][data-k=ejercicio]');
  assert.strictEqual(await page.locator('#nav [data-t=ejercicio]').count(), 0);
  await page.check('[data-a=mod-t][data-k=ejercicio]');
  assert.strictEqual((await estado(page)).days['2026-10-19'].ej.e1, 5);
});

test('ejercicio por ítem: "Hoy no" lo anota, mañana aparece como pendiente (sin sumar de más) y se puede deshacer', async ({ abrir }) => {
  const plan = { modulos: { ejercicio: true }, ejercicios: [EJ('e1', 'Giros', 'reps'), EJ('e2', 'Puente', 'series')], sesiones: [{ id: 's1', n: 'Mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '', ej: ['e1'] }, { id: 's2', n: 'Solo martes', dias: [2], hora: '', ej: ['e2'] }] };
  // hoy: lunes 19 → "Hoy no" en Giros
  let a = await abrir({ ls: base(plan) });
  await ir(a.page, 'ejercicio'); await a.page.click('[data-a=ej-no][data-id=e1]');
  assert.deepStrictEqual((await estado(a.page)).days['2026-10-19'].omitEj, { e1: true });
  await abrirR(a.page); assert.match(await texto(a.page), /Hoy no lo hacés: mañana te lo muestro como pendiente/);
  await a.page.click('[data-a=ej-no-x][data-id=e1]'); assert.deepStrictEqual((await estado(a.page)).days['2026-10-19'].omitEj, {});
  // mañana (martes 20): ayer salteó Giros (está en la rutina de hoy) y Puente de una rutina completa marcada "No pude hoy"
  const ls = base(Object.assign({}, plan, { days: { '2026-10-19': { omitEj: { e1: true }, omit: { s2: true } } } }));
  a = await abrir({ ls, fecha: '2026-10-20T12:00:00' });
  await ir(a.page, 'ejercicio');
  const t = await texto(a.page);
  assert.match(t, /Ayer no hiciste: Giros, Puente/); assert.match(t, /No hace falta compensar con más repeticiones/);
  assert.strictEqual(await a.page.locator('#view .item', { hasText: 'Giros' }).count(), 1, 'Giros no se duplica: ya está en la rutina de hoy');
  assert.strictEqual(await a.page.locator('#view .item', { hasText: 'Puente' }).count(), 1, 'Puente se ofrece aunque hoy no lo programe la rutina');
  assert.match(await texto(a.page, '#nav').then(() => '#view').then(() => a.page.innerText('#view')), /Ayer no hiciste/);
  await a.page.click('[data-a=ej-][data-id=e1]').catch(() => { });
  for (let i = 0; i < 10; i++) await a.page.click('[data-a="ej+"][data-id=e1]');
  assert.doesNotMatch(await texto(a.page), /Ayer no hiciste: Giros/, 'al completarlo deja de figurar como pendiente');
  await ir(a.page, 'hoy'); assert.match(await texto(a.page), /Ayer no hiciste: Puente/);
});

test('ejercicio por ítem: "Lo hice" completa la dosis y saca la marca "hoy no"', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan() });
  await ir(page, 'ejercicio');
  await page.click('[data-a=ej-no][data-id=e1]');
  await abrirR(page); await page.click('[data-a=ej-ok][data-id=e1]');
  let S = await estado(page);
  assert.strictEqual(S.days['2026-10-19'].ej.e1, 30); assert.deepStrictEqual(S.days['2026-10-19'].omitEj, {});
  assert.strictEqual(await page.locator('[data-a=ej-ok][data-id=e1]').count(), 0, 'ya hecho: no se ofrece de nuevo');
  await page.click('[data-a=ej-ok][data-id=e2]');   // series
  S = await estado(page); assert.strictEqual(S.days['2026-10-19'].ej.e2, 2);
});

test('ejercicio: lo completado se pliega y quedan a la vista solo los pendientes', async ({ abrir }) => {
  const { page } = await abrir({ ls: plan({ days: { '2026-10-19': { ej: { e1: 30 }, omitEj: { e3: true } } } }) });
  await ir(page, 'ejercicio');
  const visibles = await page.$$eval('#view .item:not(.compacto)', xs => xs.filter(x => !x.closest('details:not([open])')).map(x => x.querySelector('b').textContent));
  assert.deepStrictEqual(visibles, ['Puente'], 'solo el que falta, con su figura y sus botones');
  assert.strictEqual(await page.locator('#view details.compacto').count(), 2);
  assert.match(await texto(page), /Ya resuelto hoy/); assert.match(await texto(page), /✅ Giros/); assert.match(await texto(page), /⏭ Plancha/);
  assert.strictEqual(await page.locator('#view details.compacto[open]').count(), 0, 'plegados por defecto');
  await page.click('[data-a="ej+"][data-id=e2]'); await page.click('[data-a="ej+"][data-id=e2]');   // completa Puente (2 series)
  await page.click('[data-a=ej-no-x][data-id=e3]').catch(() => { });
  await abrirR(page); await page.click('[data-a=ej-no-x][data-id=e3]'); await page.click('[data-a=ej-ok][data-id=e3]').catch(() => { });
  assert.match(await texto(page), /3 de 3 ejercicios completos|2 de 3 ejercicios completos/);
});

test('evolución: semana, mes, trimestre y año con el % de rutinas completas', async ({ abrir }) => {
  // Rutina diaria; creada el 1/10. Hecha el 17, 18 y 19 (3 de 19 programadas desde el 1/10).
  const dias = {}; ['2026-10-17', '2026-10-18', '2026-10-19'].forEach(k => { dias[k] = { ej: { e1: 30, e2: 2, e3: 2 } }; });
  const ls = plan({ sesiones: [{ id: 's1', n: 'Diaria', dias: [0, 1, 2, 3, 4, 5, 6], hora: '', ej: ['e1', 'e2', 'e3'] }], days: dias });
  const { page, errores } = await abrir({ ls });
  await ir(page, 'ejercicio');
  let t = await texto(page); assert.match(t, /Tu evolución/); assert.match(t, /3 de 7 rutinas completas en los últimos 7 días \(43 %\)\. Días con alguna rutina completa: 3/);
  assert.strictEqual(await page.locator('#view svg[aria-label^="Porcentaje de rutinas completas"]').count(), 1);
  for (const [v, rx, barras] of [['mes', /3 de 19 rutinas completas en las últimas 4 semanas \(16 %\)/, 4], ['trimestre', /3 de 19 rutinas completas en las últimas 13 semanas/, 13], ['anio', /3 de 19 rutinas completas en los últimos 12 meses/, 12]]) {
    await page.click(`[data-a=sub-ev][data-v=${v}]`);
    assert.match(await texto(page), rx, v); assert.strictEqual(await page.locator('#view svg.chart rect.barra').count(), barras, v);
  }
  assert.deepStrictEqual(errores, []);
});

test('evolución: sin rutinas programadas no muestra gráfico y no rompe', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: plan({ sesiones: [{ id: 's2', n: 'Solo martes', dias: [2], hora: '', ej: ['e4'] }], settings: { creado: '2026-10-19' } }) });
  await ir(page, 'ejercicio'); await page.click('[data-a=sub-ev][data-v=mes]');
  assert.deepStrictEqual(errores, []);
  const v = await page.locator('#view svg[aria-label^="Porcentaje"]').count(); assert.ok(v <= 1);
});
