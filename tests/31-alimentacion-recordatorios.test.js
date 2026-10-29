'use strict';
const { test, assert, estado, ir, texto } = require('./lib');
const { base, TODOS } = require('./datos');

const irCom = async page => { await ir(page, 'habitos'); const b = page.locator('#view .seg button', { hasText: 'Alimentación' }); if (await b.count()) await b.click(); };
const conCom = (extra = {}) => base(Object.assign({ modulos: { comida: true }, comida: { items: [{ id: 'i1', n: 'Sin frituras' }], contadores: [] } }, extra));
const llamadas = page => page.evaluate(() => window.__llamadas);
const prog = async page => { const s = (await llamadas(page)).filter(x => x[1] === 'schedule').pop(); return s ? JSON.parse(s[2])[0].notifications : []; };
const nativo = { LocalNotifications: { getPending: '() => ({notifications:[]})' } };

test('alimentación: se puede agregar fruta (y otros) como contador por día con suma semanal', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: conCom() });
  await irCom(page);
  assert.match(await texto(page), /Contar por día/); await page.click('[data-a=ct-sug][data-v="Fruta (porciones)"]');
  let S = await estado(page); assert.deepStrictEqual(S.comida.contadores.map(c => [c.n, c.meta]), [['Fruta (porciones)', null]]);
  assert.strictEqual(await page.locator('[data-a=ct-sug][data-v="Fruta (porciones)"]').count(), 0, 'ya agregada: no se ofrece de nuevo');
  await page.click('[data-a="cont+"]'); await page.click('[data-a="cont+"]');
  S = await estado(page); assert.strictEqual(S.days['2026-10-19'].cont[S.comida.contadores[0].id], 2);
  assert.match(await texto(page), /Fruta \(porciones\)/); assert.deepStrictEqual(errores, []);
});

test('alimentación vacía: también ofrece los contadores sugeridos', async ({ abrir }) => {
  const { page } = await abrir({ ls: base({ modulos: { comida: true } }) });
  await irCom(page); assert.match(await texto(page), /Tu checklist está vacío/); await page.click('[data-a=ct-sug][data-v="Fruta (porciones)"]');
  assert.strictEqual((await estado(page)).comida.contadores.length, 1);
});

test('recordatorios propios: crear desde Alimentación, con validación; el modo "solo registro" se ofrece activar', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: conCom(), dialogos: [true] });
  await irCom(page); await page.click('[data-a=rec-nuevo]');
  await page.click('#modal button[type=submit]'); assert.ok(await page.isVisible('#modal'), 'sin texto no guarda');
  await page.fill('#modal [name=txt]', 'Comer una fruta'); await page.fill('#modal [name=hora]', '16:30');
  await page.uncheck('#modal input[name=dias][value="0"]'); await page.uncheck('#modal input[name=dias][value="6"]');
  await page.click('#modal button[type=submit]');
  const S = await estado(page);
  assert.deepStrictEqual(S.recordatorios.map(r => [r.txt, r.hora, r.dias.join('')]), [['Comer una fruta', '16:30', '12345']]);
  assert.strictEqual(S.modo, 'recordatorios', 'aceptó activar los recordatorios');
  await ir(page, 'ajustes'); assert.match(await texto(page), /Mis recordatorios[\s\S]*Comer una fruta[\s\S]*lun, mar, mié, jue, vie · 16:30/);
  assert.deepStrictEqual(errores, []);
});

test('recordatorios propios: si no activa los recordatorios, queda guardado pero no se programa', async ({ abrir }) => {
  const { page } = await abrir({ ls: conCom(), dialogos: [false], native: nativo });
  await irCom(page); await page.click('[data-a=rec-nuevo]'); await page.fill('#modal [name=txt]', 'Estirar'); await page.fill('#modal [name=hora]', '10:00'); await page.click('#modal button[type=submit]');
  await page.waitForTimeout(300);
  const S = await estado(page); assert.strictEqual(S.modo, 'registro'); assert.strictEqual(S.recordatorios.length, 1);
  assert.deepStrictEqual(await prog(page), []);
});

test('recordatorios propios (Android): se programan por día y hora; editar y quitar los reprograma', async ({ abrir }) => {
  const ls = conCom({ modo: 'recordatorios', recordatorios: [{ id: 'r1', txt: 'Fruta <b>x</b>', hora: '16:30', dias: [1, 3] }] });
  const { page } = await abrir({ ls, native: { LocalNotifications: { getPending: '() => ({notifications:[{id:4001},{id:4003}]})' } }, dialogos: [true] });
  await page.waitForTimeout(300);
  let n = (await prog(page)).filter(x => x.id >= 4000 && x.id < 4100);
  assert.deepStrictEqual(n.map(x => [x.id, x.schedule.on.weekday, x.schedule.on.hour, x.schedule.on.minute]), [[4001, 2, 16, 30], [4003, 4, 16, 30]]); assert.strictEqual(n[0].title, '🔔 Fruta <b>x</b>');
  await ir(page, 'ajustes'); assert.ok(!(await page.innerHTML('#view')).includes('<b>x</b>'), 'texto escapado');
  await page.click('[data-a=rec-edit][data-id=r1]'); await page.fill('#modal [name=hora]', '17:00'); await page.click('#modal button[type=submit]'); await page.waitForTimeout(300);
  n = (await prog(page)).filter(x => x.id >= 4000 && x.id < 4100); assert.deepStrictEqual(n.map(x => x.schedule.on.hour), [17, 17]);
  await page.click('[data-a=rec-del][data-id=r1]'); await page.waitForTimeout(300);
  assert.strictEqual((await estado(page)).recordatorios.length, 0);
  const canc = (await llamadas(page)).filter(x => x[1] === 'cancel').pop(); assert.deepStrictEqual(JSON.parse(canc[2])[0].notifications.map(x => x.id), [4001, 4003], 'se cancelaron los avisos viejos');
});

test('recordatorios propios: datos mal formados no rompen y se conservan los buenos', async ({ abrir }) => {
  const { page, errores } = await abrir({ ls: conCom({ recordatorios: [null, 5, { id: 'r1', txt: 'ok', hora: '09:00', dias: [1] }] }) });
  assert.strictEqual((await estado(page)).recordatorios.length, 1); await ir(page, 'ajustes'); assert.deepStrictEqual(errores, []);
});
