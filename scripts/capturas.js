// Genera el material gráfico de la ficha de Google Play en store/ (capturas 1080x1920 con DATOS DE EJEMPLO INVENTADOS,
// imagen destacada 1024x500 e ícono 512). Uso: node scripts/capturas.js
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');
const RAIZ = path.join(__dirname, '..'), OUT = path.join(RAIZ, 'store', 'imagenes');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOY = new Date(2026, 10, 10, 12, 0, 0); // martes 10/11/2026

function demo() {
  const days = {}, reg = { m_presion: [], m_peso: [] };
  for (let i = 0; i < 28; i++) {
    const d = new Date(HOY); d.setDate(d.getDate() - i); const k = ymd(d), esHoy = i === 0;
    days[k] = { pasos: esHoy ? 5120 : 4800 + ((i * 937) % 4200), agua: esHoy ? 1250 : 1500 + ((i * 311) % 800), ej: { e1: 30, e2: 2, e3: 2 } };
    if (esHoy) { days[k].ej = { e1: 30 }; days[k].comida = { i1: true, i2: true }; }
    else if (i % 3) days[k].comida = { i1: true, i2: i % 2 === 0, i3: i % 4 === 0 };
    if (i % 3 === 0) reg.m_presion.push({ fecha: k, hora: '08:30', sis: 118 + ((i * 7) % 14), dia: 74 + ((i * 5) % 9), pul: 66 + (i % 8) });
    if (i % 7 === 0) reg.m_peso.push({ fecha: k, kg: Math.round((78.4 - i * 0.07) * 10) / 10 });
  }
  return {
    v: 1, listo: true, modo: 'avisos', modulos: { ejercicio: true, pasos: true, agua: true, actividad: true, comida: true, medidas: true },
    settings: { creado: '2026-09-01', metaPasos: 8000, metaAgua: 2000, aeroMeta: 150, vaso: 250, recAgua: true, recMin: 120, aguaDesde: '08:00', aguaHasta: '20:00', color: 'coral', avisoAceptado: Date.now(), anunciosDemo: false, ultimoRespaldo: Date.now(), informe: { periodo: 90, excluir: {} }, cuenta: { nombre: 'Ana', email: 'ana@ejemplo.com', desde: 1 } },
    ejercicios: [{ id: 'e1', n: 'Giros de cadera', tipo: 'reps', meta: 30, fig: 'giros', nota: 'Círculos amplios pero suaves.' }, { id: 'e2', n: 'Puente de glúteos', tipo: 'series', series: 2, reps: 8, fig: 'puente', nota: '' }, { id: 'e3', n: 'Plancha en rodillas', tipo: 'tiempo', series: 2, seg: 15, fig: 'plancha', nota: '' }],
    sesiones: [{ id: 's1', n: 'Rutina de la mañana', dias: [0, 1, 2, 3, 4, 5, 6], hora: '09:00', ej: ['e1', 'e2', 'e3'] }],
    medidas: [
      { id: 'm_presion', tipo: 'presion', n: 'Presión arterial', campos: [{ k: 'sis', n: 'Máxima (sistólica)', u: 'mmHg', r: [50, 300], min: null, max: 135 }, { k: 'dia', n: 'Mínima (diastólica)', u: 'mmHg', r: [30, 200], min: null, max: 85 }, { k: 'pul', n: 'Pulso', u: 'lpm', r: [25, 250], opc: true, min: null, max: null }], repetirMeses: null, recordarHora: '' },
      { id: 'm_peso', tipo: 'peso', n: 'Peso', campos: [{ k: 'kg', n: 'Peso', u: 'kg', r: [20, 400], dec: 1, min: 70, max: 80 }], repetirMeses: null, recordarHora: '' }],
    registros: reg, days, comida: { items: [{ id: 'i1', n: 'Fruta' }, { id: 'i2', n: 'Verduras' }, { id: 'i3', n: 'Pescado', obj: { t: 'min', d: 6 } }], contadores: [] },
    aero: [{ fecha: ymd(new Date(2026, 10, 9)), min: 35, tipo: 'Caminata' }, { fecha: ymd(new Date(2026, 10, 7)), min: 45, tipo: 'Bicicleta' }, { fecha: ymd(new Date(2026, 10, 4)), min: 30, tipo: 'Natación' }], molestias: {}, recordatorios: [], recup: {}, cerrados: {}
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+$/, '/index.html')); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await br.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, bypassCSP: true });
  const page = await ctx.newPage();
  await page.addInitScript(([f, estado]) => {
    window.__sinSplash = true;
    const R = Date, base = R.parse(f), t0 = R.now();
    window.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(base + (R.now() - t0)); } static now() { return base + (R.now() - t0); } };
    if (!localStorage.getItem('__s')) { localStorage.setItem('__s', '1'); localStorage.setItem('miplanV1', estado); }
  }, [HOY.toISOString().slice(0, 19), JSON.stringify(demo())]);
  await page.goto(url); await page.waitForTimeout(600);
  const ir = async t => { await page.evaluate(t => document.querySelector(`#nav [data-tab="${t}"], #nav [data-t="${t}"]`)?.click(), t); await page.waitForTimeout(500); };
  const foto = async (n, antes, texto) => { if (antes) await antes(); await page.evaluate(() => window.scrollTo(0, 0)); if (texto) { await page.getByText(texto).first().evaluate(e => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -70)); } await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log(n); };
  await foto('1-hoy', () => ir('hoy'));
  await foto('2-ejercicio', () => ir('ejercicio'), 'Rutina de la mañana');
  await foto('3-pasos', async () => { await ir('habitos'); await page.evaluate(() => document.querySelector('[data-a="sub-h"][data-v="pasos"]')?.click()); await page.waitForTimeout(300); }, 'Tu evolución de pasos');
  await foto('4-alimentacion', async () => { await page.evaluate(() => document.querySelector('[data-a="sub-h"][data-v="comida"]')?.click()); await page.waitForTimeout(300); });
  await foto('5-medidas', () => ir('medidas'), 'Evolución');
  await foto('6-ajustes', () => ir('ajustes'));
  // Imagen destacada 1024x500
  const p2 = await br.newPage({ viewport: { width: 1024, height: 500 } });
  const logo = fs.readFileSync(path.join(RAIZ, 'icon.svg'), 'utf8');
  await p2.setContent(`<body style="margin:0;width:1024px;height:500px;background:linear-gradient(120deg,#ff9a3d,#f0485a 55%,#7c3aed);font-family:system-ui,Segoe UI,Arial,sans-serif;color:#fff;display:flex;align-items:center;padding:0 70px;box-sizing:border-box;gap:50px"><div style="width:210px;height:210px;flex:none;filter:drop-shadow(0 12px 30px rgba(0,0,0,.28))">${logo.replace('<svg', '<svg width="210" height="210"')}</div><div><div style="font-size:84px;font-weight:800;letter-spacing:-2px;line-height:1">A Mi Ritmo</div><div style="font-size:38px;margin-top:16px;opacity:.95">Tu plan de hábitos de salud,<br>a tu manera.</div><div style="font-size:24px;margin-top:22px;opacity:.85">Ejercicio · pasos · agua · alimentación · mediciones</div></div></body>`);
  await p2.screenshot({ path: path.join(OUT, 'imagen-destacada-1024x500.png') });
  fs.copyFileSync(path.join(RAIZ, 'icon-512.png'), path.join(OUT, 'icono-512.png'));
  await br.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
