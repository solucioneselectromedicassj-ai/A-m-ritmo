'use strict';
/* A Mi Ritmo — PWA sin dependencias. Los datos viven solo en este dispositivo (localStorage). */
(function () {
  const KEY = 'miplanV1';
  const VERSION = 1; // versión del formato de datos guardados
  const APP_V = '0.1.0';
  // App Android (Capacitor): sensor de pasos y recordatorios nativos. En el navegador queda la versión web.
  const CAP = window.Capacitor;
  const NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
  // En la app Android el puente nativo expone los plugins en Capacitor.Plugins (no hay bundler).
  const plug = name => (NATIVE && CAP.Plugins && CAP.Plugins[name]) || null;
  const $ = (s, r = document) => r.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoy = () => ymd(new Date());
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIA_L = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
  const fechaLocal = f => new Date(f + 'T12:00:00');
  const tsFecha = f => fechaLocal(f).getTime();
  const fmtFecha = f => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}`; };
  const fmtDMA = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const fmtDia = d => `${d.getDate()}/${d.getMonth() + 1}`;
  const lunesDe = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }; // semana de lunes a domingo
  const claveSemana = d => ymd(lunesDe(d));
  const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  // Suma meses a 'AAAA-MM-DD' sin desbordar (31/12 + 2 meses = 28/02, no 03/03).
  const sumarMeses = (f, n) => {
    const [y, m, d] = f.split('-').map(Number), t = new Date(y, m - 1 + n, 1, 12), ult = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d, ult)); return t;
  };
  const pctCambio = (nuevo, ant) => (ant ? (nuevo - ant) / ant * 100 : null);
  const fmtPct = p => (p === null ? '—' : `${p > 0.05 ? '▲' : p < -0.05 ? '▼' : '='} ${Math.abs(p).toFixed(1).replace('.', ',')} %`);
  const mmss = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;
  const fmtNum = (v, dec) => (dec ? Number(v).toFixed(dec).replace('.', ',') : String(v).replace('.', ','));

  /* ---------- Contenido configurable ---------- */
  // Mediciones disponibles. Los umbrales (min/max) NO vienen cargados: los define cada persona o su profesional.
  const CATALOGO = {
    presion: { n: 'Presión arterial', ic: '🩺', campos: [
      { k: 'sis', n: 'Máxima (sistólica)', u: 'mmHg', r: [50, 300] }, { k: 'dia', n: 'Mínima (diastólica)', u: 'mmHg', r: [30, 200] }, { k: 'pul', n: 'Pulso', u: 'lpm', r: [25, 250], opc: true }] },
    peso: { n: 'Peso', ic: '⚖️', campos: [{ k: 'kg', n: 'Peso', u: 'kg', r: [20, 400], dec: 1 }] },
    colesterol: { n: 'Colesterol', ic: '🩸', analisis: true, campos: [
      { k: 'ldl', n: 'LDL', u: 'mg/dL', r: [10, 600], opc: true }, { k: 'hdl', n: 'HDL', u: 'mg/dL', r: [5, 200], opc: true },
      { k: 'total', n: 'Total', u: 'mg/dL', r: [50, 800], opc: true }, { k: 'tg', n: 'Triglicéridos', u: 'mg/dL', r: [10, 3000], opc: true }] },
    spo2: { n: 'Saturación de oxígeno', ic: '🫁', campos: [{ k: 'sat', n: 'Saturación', u: '%', r: [50, 100] }, { k: 'pul', n: 'Pulso', u: 'lpm', r: [25, 250], opc: true }] },
    pulso: { n: 'Pulso', ic: '💓', campos: [{ k: 'pul', n: 'Pulso', u: 'lpm', r: [25, 250] }] },
    glucosa: { n: 'Glucosa', ic: '🍬', campos: [{ k: 'g', n: 'Glucosa', u: 'mg/dL', r: [10, 900] }] },
    propia: { n: 'Otra medición', ic: '📏', campos: [{ k: 'v', n: 'Valor', u: '', r: [-1000000, 1000000], dec: 2 }] }
  };
  // Ejercicios de ejemplo (suaves, sin carga). Son ejemplos, no indicaciones: cada persona los ajusta con su profesional.
  const BIBLIOTECA = [
    { fig: 'giros', n: 'Giros de cadera', tipo: 'reps', meta: 30, nota: 'Círculos amplios pero suaves.' },
    { fig: 'brazos', n: 'Estiramiento de brazos a los costados', tipo: 'reps', meta: 10, nota: 'Respirá con normalidad, sin aguantar el aire.' },
    { fig: 'piernas', n: 'Flexiones de piernas', tipo: 'reps', meta: 15, nota: 'Rodillas alineadas con la punta de los pies.' },
    { fig: 'aperturas', n: 'Aperturas de brazos y espalda', tipo: 'reps', meta: 15, nota: 'Abrí el pecho llevando los omóplatos hacia atrás.' },
    { fig: 'rodillas', n: 'Levantamiento de rodillas', tipo: 'reps', meta: 20, nota: 'Torso erguido, ritmo cómodo.' },
    { fig: 'agacharse', n: 'Agacharse (arriba y abajo)', tipo: 'reps', meta: 10, nota: 'Doblá caderas y rodillas con la espalda recta.' },
    { fig: 'gato', n: 'Gato-camello', tipo: 'series', series: 2, reps: 8, nota: 'En cuatro apoyos, despacio y solo hasta donde no moleste.' },
    { fig: 'bird', n: 'Bird-dog (brazo y pierna opuestos)', tipo: 'series', series: 2, reps: 6, nota: 'Estirá brazo y pierna contrarios, con la pelvis quieta.' },
    { fig: 'deadbug', n: 'Dead bug', tipo: 'series', series: 2, reps: 6, nota: 'Boca arriba, zona lumbar apoyada.' },
    { fig: 'puente', n: 'Puente de glúteos', tipo: 'series', series: 2, reps: 8, nota: 'Subí la cadera apretando glúteos.' },
    { fig: 'lateral', n: 'Plancha lateral (rodillas apoyadas)', tipo: 'tiempo', series: 2, seg: 15, nota: 'Cuerpo en línea. Respirá, no aguantes el aire.' },
    { fig: 'plancha', n: 'Plancha corta', tipo: 'tiempo', series: 2, seg: 15, nota: 'Podés apoyar las rodillas.' }
  ];
  const GRUPOS_BIB = { general: { n: 'Rutina general', dias: [0, 1, 2, 3, 4, 5, 6], titulo: 'De pie' }, espalda: { n: 'Espalda y core', dias: [1, 3, 5], titulo: 'Espalda y core' } };
  const grupoBib = b => (['gato', 'bird', 'deadbug', 'puente', 'lateral', 'plancha'].includes(b.fig) ? 'espalda' : 'general');
  // Cada grupo va a su propia rutina (con sus días y horario): se reutiliza la que ya tenga ese nombre.
  function rutinaDeGrupo(g) {
    const G = GRUPOS_BIB[g]; let se = S.sesiones.find(x => x.n === G.n);
    if (!se) { se = { id: uid('s'), n: G.n, dias: G.dias.slice(), hora: '', ej: [] }; S.sesiones.push(se); }
    return se;
  }
  // ¿Esta rutina mezcla ejercicios de espalda/core (de la biblioteca) con otros? Se ofrece separarlos para elegir sus propios días y horario.
  const esEjEspalda = e => !!e && grupoBib({ fig: e.fig }) === 'espalda';
  const mezclaEspalda = se => { const l = ejDeSesion(se); return l.some(esEjEspalda) && l.some(e => !esEjEspalda(e)); };
  const agregarEjemplo = (b, se) => { const e = { id: uid('e'), fig: b.fig, n: b.n, tipo: b.tipo, nota: b.nota }; ['meta', 'series', 'reps', 'seg'].forEach(k => { if (b[k] != null) e[k] = b[k]; }); S.ejercicios.push(e); se.ej.push(e.id); };
  const CONTADORES_SUG = ['Fruta (porciones)', 'Pescado', 'Verduras (porciones)', 'Legumbres'];
  const SUGERENCIAS_COMIDA = ['Verduras en el almuerzo', 'Verduras en la cena', 'Sin frituras', 'Sin gaseosas ni jugos azucarados', 'Fruta del día', 'Legumbres o cereales integrales'];
  /* Colores de la app (solo apariencia). Cada uno: [claro: pri, soft, c1], [oscuro: pri, soft, texto sobre pri, c1] */
  const COLORES = {
    coral: ['Coral', null],
    azul: ['Azul', ['#1d4ed8', '#e4ebff', '#c2410c'], ['#7aa2ff', '#1b2748', '#0b1530', '#fb923c']],
    verde: ['Verde', ['#0f766e', '#e3f3f0', '#c2410c'], ['#2dd4bf', '#12302b', '#04201c', '#fb923c']],
    violeta: ['Violeta', ['#6d28d9', '#efe7ff', '#c2410c'], ['#b79cff', '#261b48', '#170b36', '#fb923c']],
    naranja: ['Naranja', ['#c2410c', '#ffe9dc', '#1d4ed8'], ['#fb923c', '#3a2112', '#2a1103', '#7aa2ff']],
    rosa: ['Rosa', ['#be185d', '#fde7f1', '#0f766e'], ['#f472b6', '#3a1727', '#2e0a1b', '#2dd4bf']],
    gris: ['Gris', ['#374151', '#e8ebf0', '#c2410c'], ['#cbd5e1', '#232b3b', '#0f172a', '#fb923c']]
  };
  function aplicarColor() {
    const k = COLORES[S.settings.color] ? S.settings.color : 'coral', c = COLORES[k];
    let st = document.getElementById('tema'); if (!st) { st = document.createElement('style'); st.id = 'tema'; document.head.appendChild(st); }
    st.textContent = c[1] ? `:root{--pri:${c[1][0]};--c0:${c[1][0]};--soft:${c[1][1]};--c1:${c[1][2]}}@media (prefers-color-scheme:dark){:root{--pri:${c[2][0]};--c0:${c[2][0]};--soft:${c[2][1]};--pri-fg:${c[2][2]};--c1:${c[2][3]}}}` : '';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', c[1] ? c[1][0] : '#d63f1f');
  }
  const MODOS = [
    ['registro', 'Solo registro', 'Anotás tus avances y nada más: sin recordatorios ni avisos.'],
    ['recordatorios', 'Registro y recordatorios', 'Además te avisa a las horas que elijas (rutina, agua, mediciones).'],
    ['avisos', 'Registro, recordatorios y avisos', 'Además te avisa si una medición queda fuera del rango que vos (o tu profesional) definiste.']
  ];
  const MODULOS = [['ejercicio', '🏋️', 'Ejercicio', 'Rutinas y ejercicios a tu medida'], ['pasos', '👣', 'Pasos', 'Contador y gráfico semanal'], ['agua', '💧', 'Agua', 'Vasos del día y recordatorio'],
    ['actividad', '🚴', 'Actividad aeróbica', 'Minutos por semana'], ['comida', '🥗', 'Alimentación', 'Checklist diario editable'], ['medidas', '📈', 'Mediciones de salud', 'Presión, peso, análisis y más']];

  /* ---------- Estado, migración y respaldo ---------- */
  const DEFAULTS = () => ({
    v: VERSION, listo: false, modo: 'registro',
    modulos: { ejercicio: false, pasos: false, agua: false, actividad: false, comida: false, medidas: false },
    settings: { metaPasos: null, metaAgua: null, vaso: 250, aeroMeta: null, descansoSeg: 45, recAgua: false, hcUltimo: 0, hcAuto: false, avisoAceptado: 0, recPasos: false, recPasosHora: '20:00', seguirOn: true, seguirHora: '21:00', pasosRechazos: 0, recMin: 90, aguaDesde: '08:00', aguaHasta: '22:00', segundoPlano: true, umbral: 1.3,
      ultimoRespaldo: 0, respaldoPospuesto: '', creado: '', color: 'coral', informe: { periodo: 90, excluir: {} } },
    ejercicios: [], sesiones: [], medidas: [], registros: {}, days: {}, comida: { items: [], contadores: [] }, aero: [], molestias: {}, recup: {}, cerrados: {}, recordatorios: [], sensor: null
  });
  const CONOCIDAS = ['v', 'listo', 'modo', 'modulos', 'settings', 'ejercicios', 'sesiones', 'medidas', 'registros', 'days', 'comida', 'aero', 'molestias', 'recup', 'cerrados', 'recordatorios', 'sensor'];
  const esObjeto = x => x && typeof x === 'object' && !Array.isArray(x);
  const guardarCopia = (clave, texto, pisar) => { try { if (pisar || localStorage.getItem(clave) === null) localStorage.setItem(clave, texto); } catch (e) { /* sin espacio */ } };

  /* Carga tolerante y con migración: solo agrega campos nuevos, nunca borra lo guardado.
     - Antes de migrar a un formato más nuevo se deja una copia intacta (miplanV1_antes_vN).
     - Si los datos están corruptos se conserva el texto original (miplanV1_corrupto) en vez de pisarlo.
     - Las claves desconocidas (por ejemplo de una versión más nueva) se conservan. */
  function load() {
    const d = DEFAULTS();
    let raw = null, r = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* almacenamiento bloqueado */ }
    if (raw) { try { r = JSON.parse(raw); } catch (e) { guardarCopia(KEY + '_corrupto', raw); } }
    if (esObjeto(r)) {
      const vOld = Number.isFinite(r.v) ? r.v : 0;
      if (vOld < VERSION) guardarCopia(`${KEY}_antes_v${VERSION}`, raw);
      Object.keys(r).forEach(k => { if (!CONOCIDAS.includes(k)) d[k] = r[k]; });
      if (typeof r.listo === 'boolean') d.listo = r.listo;
      if (MODOS.some(m => m[0] === r.modo)) d.modo = r.modo;
      if (esObjeto(r.modulos)) Object.keys(d.modulos).forEach(k => { if (typeof r.modulos[k] === 'boolean') d.modulos[k] = r.modulos[k]; });
      if (esObjeto(r.settings)) { Object.assign(d.settings, r.settings); if (!esObjeto(d.settings.informe)) d.settings.informe = DEFAULTS().settings.informe; if (!esObjeto(d.settings.informe.excluir)) d.settings.informe.excluir = {}; }
      ['ejercicios', 'sesiones', 'medidas', 'aero', 'recordatorios'].forEach(k => { if (Array.isArray(r[k])) d[k] = r[k].filter(esObjeto); });
      ['registros', 'days', 'molestias', 'recup', 'cerrados'].forEach(k => { if (esObjeto(r[k])) d[k] = r[k]; });
      if (esObjeto(r.comida)) d.comida = { items: Array.isArray(r.comida.items) ? r.comida.items.filter(x => esObjeto(x) && x.id && x.n) : [], contadores: Array.isArray(r.comida.contadores) ? r.comida.contadores.filter(x => esObjeto(x) && x.id && x.n) : [] };
      if (esObjeto(r.sensor) && Number.isFinite(r.sensor.last)) d.sensor = { last: r.sensor.last, t: r.sensor.t || 0 };
      d.v = Math.max(VERSION, vOld);
    }
    if (!d.settings.creado) d.settings.creado = ymd(new Date());
    return d;
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar en este dispositivo'); } }
  let saveT = null;
  const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 1500); };

  const peek = (d = hoy()) => S.days[d] || {};
  const day = (d = hoy()) => S.days[d] || (S.days[d] = {});
  const mod = k => !!S.modulos[k];
  const conAvisos = () => S.modo === 'avisos';
  const conRecordatorios = () => S.modo !== 'registro';

  const hayDatos = () => Object.values(S.registros).some(l => Array.isArray(l) && l.length) || S.aero.length > 0 || S.ejercicios.length > 0 || S.medidas.length > 0 ||
    Object.values(S.days).some(x => x && (x.pasos || x.agua || x.ej || x.comida || x.cont));
  // Hay algo registrado (no alcanza con haber configurado el plan): recién ahí tiene sentido pedir un respaldo.
  const hayRegistros = () => Object.values(S.registros).some(l => Array.isArray(l) && l.length) || S.aero.length > 0 || Object.values(S.days).some(x => x && (x.pasos || x.agua || x.ej || x.comida || x.cont));
  const diasDeUso = () => Math.floor((fechaLocal(hoy()) - fechaLocal(S.settings.creado || hoy())) / 864e5);
  const diasSinRespaldo = () => (S.settings.ultimoRespaldo ? Math.floor((Date.now() - S.settings.ultimoRespaldo) / 864e5) : Infinity);
  const marcarRespaldo = () => { S.settings.ultimoRespaldo = Date.now(); S.settings.respaldoPospuesto = ''; save(); };

  /* ---------- Utilidades de interfaz ---------- */
  let toastT = null;
  function toast(msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
  }
  // Barra de progreso. Sin meta (null) solo muestra el valor: la app no inventa metas.
  const meter = (label, val, max, unit) => {
    const u = unit ? ' ' + unit : '';
    if (!(max > 0)) return `<div class="meter"><div class="meter-top"><span>${esc(label)}</span><b>${val}${u}</b></div></div>`;
    const p = Math.min(100, Math.round(val / max * 100));
    return `<div class="meter"><div class="meter-top"><span>${esc(label)}</span><b>${val}${u} / ${max}${u}</b></div><div class="bar"><i style="width:${p}%"></i></div></div>`;
  };
  const delBtn = (k, i) => `<button data-a="del" data-k="${esc(k)}" data-i="${i}" aria-label="Borrar registro">🗑</button>`;
  const segBtns = (lista, actual, accion) => `<div class="seg">${lista.map(([k, n]) => `<button data-a="${accion}" data-v="${esc(k)}" class="${actual === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`;

  // Gráfico de líneas. o.band = [min,max] zona sombreada; o.lines = [{v,label}] líneas de referencia (metas/umbrales).
  function chart(series, o = {}) {
    const W = 320, H = 150, L = 38, R = 8, T = 10, B = 22;
    const vals = [], times = [];
    series.forEach(s => s.pts.forEach(q => { vals.push(q.v); times.push(q.t); }));
    if (!vals.length) return '<p class="muted">Todavía no hay datos para graficar.</p>';
    if (o.band) vals.push(o.band[0], o.band[1]);
    (o.lines || []).forEach(l => vals.push(l.v));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    const m = (hi - lo) * 0.12; lo -= m; hi += m;
    const t0 = Math.min(...times), t1 = Math.max(...times);
    const X = t => L + (t1 === t0 ? (W - L - R) / 2 : (t - t0) / (t1 - t0) * (W - L - R));
    const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const dec = o.dec ?? 0;
    const fd = t => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}`; };
    let g = '';
    if (o.band) g += `<rect x="${L}" y="${Y(o.band[1]).toFixed(1)}" width="${W - L - R}" height="${(Y(o.band[0]) - Y(o.band[1])).toFixed(1)}" class="band"/>`;
    g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" class="axis"/><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" class="axis"/>`;
    g += `<text x="${L - 4}" y="${T + 6}" class="tick" text-anchor="end">${hi.toFixed(dec)}</text><text x="${L - 4}" y="${H - B}" class="tick" text-anchor="end">${lo.toFixed(dec)}</text>`;
    g += `<text x="${L}" y="${H - 6}" class="tick">${fd(t0)}</text>`;
    if (t1 !== t0) g += `<text x="${W - R}" y="${H - 6}" class="tick" text-anchor="end">${fd(t1)}</text>`;
    (o.lines || []).forEach(l => { g += `<line x1="${L}" y1="${Y(l.v).toFixed(1)}" x2="${W - R}" y2="${Y(l.v).toFixed(1)}" class="goal"/><text x="${W - R}" y="${(Y(l.v) - 4).toFixed(1)}" class="tick goalTxt" text-anchor="end">${esc(l.label)}</text>`; });
    series.forEach((s, i) => {
      const pts = s.pts.slice().sort((a, b) => a.t - b.t);
      const path = pts.map((q, j) => `${j ? 'L' : 'M'}${X(q.t).toFixed(1)} ${Y(q.v).toFixed(1)}`).join('');
      g += `<path d="${path}" class="line s${i}"/>` + pts.map(q => `<circle cx="${X(q.t).toFixed(1)}" cy="${Y(q.v).toFixed(1)}" r="3" class="dot s${i}"/>`).join('');
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(o.label || 'Gráfico')}">${g}</svg>`;
  }
  // Barras (una por semana o por día) con línea de meta opcional. items: [{l: etiqueta, v: valor}]
  function barras(items, meta, label) {
    const W = 320, H = 150, L = 34, R = 6, T = 14, B = 24, n = items.length;
    const hi = Math.max(meta || 0, ...items.map(q => q.v), 1) * 1.15, Y = v => T + (1 - v / hi) * (H - T - B);
    const bw = (W - L - R) / n, w = bw * 0.62;
    let g = `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" class="axis"/><line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" class="axis"/><text x="${L - 4}" y="${T + 4}" class="tick" text-anchor="end">${Math.round(hi)}</text><text x="${L - 4}" y="${H - B}" class="tick" text-anchor="end">0</text>`;
    items.forEach((q, i) => {
      const x = L + i * bw + (bw - w) / 2;
      g += `<rect x="${x.toFixed(1)}" y="${Y(q.v).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, H - B - Y(q.v)).toFixed(1)}" class="barra ${meta && q.v >= meta ? 'cumple' : ''}"/>`;
      g += `<text x="${(x + w / 2).toFixed(1)}" y="${(Y(q.v) - 3).toFixed(1)}" class="tick" text-anchor="middle">${q.v}</text><text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" class="tick" text-anchor="middle">${esc(q.l)}</text>`;
    });
    if (meta) g += `<line x1="${L}" y1="${Y(meta).toFixed(1)}" x2="${W - R}" y2="${Y(meta).toFixed(1)}" class="goal"/><text x="${W - R}" y="${(Y(meta) - 3).toFixed(1)}" class="tick goalTxt" text-anchor="end">Meta ${meta}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)}">${g}</svg>`;
  }

  /* ---------- Temporizador de descanso ---------- */
  let tInt = null, tEnd = 0;
  function beep() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2;
      o.start(); o.stop(ctx.currentTime + 0.35);
    } catch (e) { /* sin audio */ }
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* sin vibración */ }
  }
  function tick() {
    const left = Math.max(0, Math.ceil((tEnd - Date.now()) / 1000));
    $('#timerTime').textContent = mmss(left);
    if (left <= 0) { clearInterval(tInt); beep(); toast('¡Tiempo!'); setTimeout(() => { if (Date.now() >= tEnd) $('#timer').hidden = true; }, 2500); }
  }
  function startTimer(sec, label) { clearInterval(tInt); tEnd = Date.now() + sec * 1000; $('#timer').hidden = false; $('#timerLabel').textContent = label; tick(); tInt = setInterval(tick, 250); }
  function stopTimer() { clearInterval(tInt); tEnd = 0; $('#timer').hidden = true; }

  /* ---------- Ventana de edición (formularios reutilizables) ---------- */
  // campos: [{k, t: 'text'|'number'|'select'|'time'|'dias'|'check'|'checks', l, v, ph, opts: [[valor, texto]], req, min, max, ayuda}]
  // onOk(valores) devuelve un texto de error para dejar la ventana abierta, o nada para cerrarla.
  let modalCb = null, modalCampos = [];
  function abrirModal(titulo, campos, onOk, texto) {
    modalCb = onOk; modalCampos = campos;
    const campo = c => {
      const id = 'm_' + c.k, l = c.l ? `<label for="${id}">${esc(c.l)}</label>` : '';
      const ay = c.ayuda ? `<small>${esc(c.ayuda)}</small>` : '';
      if (c.t === 'select') return `${l}<select id="${id}" name="${c.k}">${c.opts.map(([v, tx]) => `<option value="${esc(v)}" ${String(c.v) === String(v) ? 'selected' : ''}>${esc(tx)}</option>`).join('')}</select>${ay}`;
      if (c.t === 'dias') return `<label>${esc(c.l)}</label><div class="dias">${ORDEN_DIAS.map(n => `<label><input type="checkbox" name="${c.k}" value="${n}" ${(c.v || []).includes(n) ? 'checked' : ''}>${DIA_L[n]}</label>`).join('')}</div>${ay}`;
      if (c.t === 'check') return `<label class="chk"><input type="checkbox" name="${c.k}" ${c.v ? 'checked' : ''}>${esc(c.l)}</label>${ay}`;
      if (c.t === 'checks') return `<label>${esc(c.l)}</label>${c.opts.map(([v, tx]) => `<label class="chk"><input type="checkbox" name="${c.k}" value="${esc(v)}" ${(c.v || []).includes(v) ? 'checked' : ''}>${esc(tx)}</label>`).join('')}${ay}`;
      const tipo = c.t === 'number' ? 'type="number" inputmode="decimal" step="any"' : c.t === 'time' ? 'type="time"' : 'type="text" maxlength="80"';
      return `${l}<input id="${id}" name="${c.k}" ${tipo} value="${esc(c.v == null ? '' : c.v)}" placeholder="${esc(c.ph || '')}">${ay}`;
    };
    $('#modal').innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><h3>${esc(titulo)}</h3>${texto ? `<p class="muted">${esc(texto)}</p>` : ''}
      <form data-f="modal">${campos.map(campo).join('')}<p id="modalErr" class="warnTxt" role="alert"></p>
      <div class="row" style="margin-top:10px"><button type="button" class="ghost grow" data-a="modal-cancel">Cancelar</button><button class="pri grow" type="submit">Guardar</button></div></form></div>`;
    $('#modal').hidden = false;
    const p = $('#modal input:not([type=checkbox]), #modal select'); if (p) p.focus();
  }
  function cerrarModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; modalCb = null; }
  function valoresModal(form) {
    const fd = new FormData(form), v = {};
    modalCampos.forEach(c => {
      if (c.t === 'number') { const x = String(fd.get(c.k) || '').trim(); v[c.k] = x === '' ? null : num(x); }
      else if (c.t === 'dias') v[c.k] = fd.getAll(c.k).map(Number).filter(n => n >= 0 && n <= 6);
      else if (c.t === 'checks') v[c.k] = fd.getAll(c.k);
      else if (c.t === 'check') v[c.k] = fd.get(c.k) === 'on';
      else v[c.k] = String(fd.get(c.k) == null ? '' : fd.get(c.k)).replace(/\s+/g, ' ').trim().slice(0, 80);
    });
    return v;
  }

  /* ---------- Lógica del plan: ejercicios y sesiones ---------- */
  const ejPorId = id => S.ejercicios.find(e => e.id === id);
  const sesPorId = id => S.sesiones.find(s => s.id === id);
  const metaEj = e => (e.tipo === 'reps' ? (e.meta || 0) : (e.series || 0));
  const dosisEj = e => (e.tipo === 'reps' ? `${e.meta} repeticiones` : e.tipo === 'tiempo' ? `${e.series} × ${e.seg} s` : `${e.series} × ${e.reps}`);
  const progEj = (e, f = hoy()) => (peek(f).ej || {})[e.id] || 0;
  const ejDeSesion = s => (s.ej || []).map(ejPorId).filter(Boolean);
  const sesionesDelDia = f => S.sesiones.filter(s => (s.dias || []).includes(f.getDay()));
  const sesionHecha = (s, k) => { const l = ejDeSesion(s); return l.length > 0 && l.every(e => progEj(e, k) >= metaEj(e)); };
  const fmtDiasSes = ds => (ds.length === 7 ? 'todos los días' : ORDEN_DIAS.filter(n => ds.includes(n)).map(n => DIAS[n].slice(0, 3)).join(', '));

  /* ---------- Lógica de mediciones ---------- */
  const medPorId = id => S.medidas.find(m => m.id === id);
  const regsOrd = m => (S.registros[m.id] || []).map((r, i) => ({ ...r, i })).filter(r => typeof r.fecha === 'string').sort((a, b) => b.fecha.localeCompare(a.fecha) || b.i - a.i); // más nuevo primero
  const anterior = (rows, idx, k) => { for (let j = idx + 1; j < rows.length; j++) if (rows[j][k] != null) return rows[j]; return null; };
  const variacion = (rows, idx, k) => { const a = anterior(rows, idx, k); return a ? pctCambio(rows[idx][k], a[k]) : null; };
  const fueraDeRango = (c, v) => (c.min != null && v < c.min ? 'min' : c.max != null && v > c.max ? 'max' : null);
  // Avisos (solo en modo "avisos"): el último registro contra los límites que definió la persona. Nunca hay límites por defecto.
  function avisosMedida(m) {
    const u = regsOrd(m)[0]; if (!u) return [];
    return m.campos.filter(c => u[c.k] != null && fueraDeRango(c, u[c.k])).map(c => {
      const dir = fueraDeRango(c, u[c.k]);
      return `${m.n} (${fmtFecha(u.fecha)}): ${c.n} ${fmtNum(u[c.k], c.dec)}${c.u ? ' ' + c.u : ''} está ${dir === 'min' ? 'por debajo del mínimo' : 'por encima del máximo'} que definiste (${fmtNum(dir === 'min' ? c.min : c.max, c.dec)}).`;
    });
  }
  // Fecha sugerida para repetir un análisis: N meses después del último registro. Se muestra 14 días antes.
  function proximaFecha(m) {
    if (!(m.repetirMeses > 0)) return null;
    const u = regsOrd(m)[0]; if (!u) return null;
    const desde = sumarMeses(u.fecha, m.repetirMeses), h = fechaLocal(hoy()), dias = Math.round((desde - h) / 864e5);
    return { u, desde, dias, avisar: dias <= 14 };
  }
  const AVISO_APP_ABIERTA = 'Este aviso solo aparece cuando abrís la app.';

  /* ---------- Lógica de hábitos ---------- */
  const marcasDia = (f = hoy()) => peek(f).comida || {};
  const contDia = (id, f = hoy()) => (peek(f).cont || {})[id] || 0;
  const minSemana = clave => S.aero.reduce((a, r) => a + (r && Number.isFinite(r.min) && typeof r.fecha === 'string' && claveSemana(fechaLocal(r.fecha)) === clave ? r.min : 0), 0);
  function semanasAero(n) {
    const l = lunesDe(new Date());
    return Array.from({ length: n }, (_, i) => { const x = sumarDias(l, -7 * (n - 1 - i)), k = ymd(x); return { k, x, min: minSemana(k) }; });
  }
  function promedioAero(n = 8) {
    const ws = semanasAero(n), i0 = ws.findIndex(w => w.min > 0); if (i0 < 0) return null;
    const u = ws.slice(i0); return { semanas: u.length, prom: Math.round(u.reduce((a, w) => a + w.min, 0) / u.length) };
  }
  // Cumplimiento del checklist en la semana que empieza en `lunes`, contando solo los días ya transcurridos (un día sin marcar cuenta como no cumplido).
  function cumplimientoSemana(lunes) {
    const items = S.comida.items; let dias = 0, ok = 0; const cont = {};
    S.comida.contadores.forEach(c => { cont[c.id] = 0; });
    for (let i = 0; i < 7; i++) {
      const x = sumarDias(lunes, i), k = ymd(x); if (k > hoy()) break;
      dias++; const m = marcasDia(k); ok += items.filter(it => m[it.id]).length;
      S.comida.contadores.forEach(c => { cont[c.id] += contDia(c.id, k); });
    }
    const tot = dias * items.length;
    return { dias, ok, tot, pct: tot ? Math.round(ok / tot * 100) : null, cont };
  }
  const limpiar = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 80);

  /* ---------- Vistas ---------- */
  let tab = 'hoy', subH = null, subM = null, subEv = 'semana', subEvP = 'semana', subEvA = 'semana', wiz = null;
  const selCampo = {};
  const tabsActivas = () => {
    const t = [['hoy', '🏠', 'Hoy']];
    if (mod('ejercicio')) t.push(['ejercicio', '🏋️', 'Ejercicio']);
    if (mod('medidas')) t.push(['medidas', '📈', 'Medidas']);
    if (['pasos', 'agua', 'actividad', 'comida'].some(mod)) t.push(['habitos', '🥗', 'Hábitos']);
    t.push(['ajustes', '⚙️', 'Ajustes']);
    return t;
  };
  function renderNav() {
    const nav = $('#nav'); nav.hidden = !S.listo;
    nav.innerHTML = S.listo ? tabsActivas().map(([k, ic, n]) => `<button data-a="tab" data-t="${k}" ${tab === k ? 'aria-current="page"' : ''}><span>${ic}</span>${n}</button>`).join('') : '';
  }
  function render() {
    if (!S.listo) { $('#view').innerHTML = viewAsistente(); }
    else {
      if (!tabsActivas().some(t => t[0] === tab)) tab = 'hoy';
      $('#view').innerHTML = ({ hoy: viewHoy, ejercicio: viewEjercicio, medidas: viewMedidas, habitos: viewHabitos, ajustes: viewAjustes })[tab]();
    }
    renderNav();
    const n = new Date(); $('#topDate').textContent = `${n.getDate()}/${n.getMonth() + 1}`;
  }
  function go(t) { tab = t; render(); window.scrollTo(0, 0); }
  const changed = () => { consumirRecup(); save(); render(); if (NATIVE) reprogramarSiCambio(); };
  const AVISO_TXT = 'A Mi Ritmo es una ayuda personal para llevar tus hábitos. No reemplaza las indicaciones de tu médico ni de otros profesionales de la salud, y no diagnostica ni indica tratamientos. Las metas y los límites los definís vos, idealmente con tu profesional. Si te sentís mal, buscá atención médica.';
  const tarjetaAviso = () => (S.settings.avisoAceptado ? '' : `<div class="card warn"><b>Antes de empezar</b><p>${esc(AVISO_TXT)}</p><div class="row"><button class="pri grow" data-a="aviso-ok">Entendí y acepto</button></div></div>`);
  const AVISO_PIE = '<p class="foot">Ayuda personal para llevar tus hábitos: no reemplaza las indicaciones de tu médico ni de otros profesionales de la salud. Si te sentís mal, buscá atención médica.</p>';

  function tarjetaRespaldo() {
    const s = S.settings;
    if (!hayRegistros() || diasDeUso() < 3 || diasSinRespaldo() < 7 || s.respaldoPospuesto === hoy()) return '';
    return `<div class="card warn"><b>💾 Hacé un respaldo de tus datos</b><p>${s.ultimoRespaldo ? 'Hace ' + diasSinRespaldo() + ' días que no exportás un respaldo.' : 'Todavía no exportaste ningún respaldo.'} Tus datos viven solo en este teléfono: si lo perdés o desinstalás la app, se pierden.</p><div class="row"><button class="pri grow" data-a="export">Exportar respaldo</button><button class="ghost grow" data-a="resp-luego">Más tarde</button></div></div>`;
  }
  function tarjetasAvisos() {
    let h = '';
    if (mod('medidas')) {
      S.medidas.forEach(m => {
        if (conAvisos()) { const a = avisosMedida(m); if (a.length) h += `<div class="card warn"><b>${esc(m.n)}: fuera del rango que definiste</b>${a.map(t => `<p>${esc(t)}</p>`).join('')}<small>Repetí la medición con calma y comentalo con tu profesional si se repite.</small></div>`; }
        const p = proximaFecha(m);
        if (p && p.avisar) h += `<div class="card warn"><b>🗓 ${esc(m.n)}: toca repetir</b><p>${p.dias > 0 ? (p.dias === 1 ? 'Falta 1 día' : `Faltan ${p.dias} días`) + ' para la fecha que elegiste' : 'Ya es la fecha que elegiste'} (${fmtDMA(p.desde)}), ${m.repetirMeses} mes${m.repetirMeses === 1 ? '' : 'es'} después del último registro.</p><small>${AVISO_APP_ABIERTA}</small></div>`;
      });
    }
    return h;
  }

  /* Rutinas de hoy en el dashboard: se habilitan a su hora; cada ejercicio desaparece al hacerlo (o al decir "hoy no") y quedan los pendientes. */
  let abiertasHoy = new Set(), abiertosEj = new Set();
  const rutinaHabilitada = se => { const n = new Date(); return !horaOk(se.hora) || minAviso(se.hora) <= n.getHours() * 60 + n.getMinutes() || abiertasHoy.has(se.id); };
  const firmaHabil = () => (mod('ejercicio') ? sesionesDelDia(new Date()).map(se => (rutinaHabilitada(se) ? '1' : '0')).join('') : '');
  function tarjetasRutinasHoy() {
    if (!mod('ejercicio')) return '';
    const k = hoy(), omitE = peek(k).omitEj || {};
    return sesionesDelDia(new Date()).filter(se => ejDeSesion(se).length).map(se => {
      const ejs = ejDeSesion(se), hechos = ejs.filter(e => progEj(e, k) >= metaEj(e)), saltados = ejs.filter(e => !hechos.includes(e) && omitE[e.id]), pend = ejs.filter(e => !hechos.includes(e) && !saltados.includes(e)), id = esc(se.id);
      const titulo = `${esc(se.n)}${se.hora ? ' · ' + esc(se.hora) : ''}`;
      if (!pend.length) return saltados.length ? `<div class="card"><b>${titulo}</b><p class="muted">Resuelta: ${hechos.length} hecho${hechos.length === 1 ? '' : 's'} y ${saltados.length} para otro día.</p></div>` : '';   // completa: el resumen ya lo dice (✅), sin tarjeta repetida
      if (!rutinaHabilitada(se)) return `<div class="card"><h3>🏋️ ${titulo}</h3><p class="muted">Se habilita a las ${esc(se.hora)}. ${pend.length} ejercicio${pend.length === 1 ? '' : 's'} para hoy.</p><button class="ghost mini" data-a="hoy-abrir" data-id="${id}">Empezar antes</button></div>`;
      return `<div class="card"><h3>🏋️ ${titulo}</h3><p class="muted">${hechos.length + saltados.length} de ${ejs.length} resueltos. Tocá ✅ en cada uno cuando lo hagas.</p>
        ${pend.map(e => `<div class="fila-ej"><div class="grow"><b>${esc(e.n)}</b><small>${esc(dosisEj(e))}</small>${avisoRecup(e)}</div><button class="pri mini" data-a="ej-ok" data-id="${esc(e.id)}" aria-label="Lo hice: ${esc(e.n)}">✅ Lo hice</button><button class="ghost mini" data-a="ej-no" data-id="${esc(e.id)}">Hoy no</button></div><details class="mas"><summary>Cómo hacerlo / contar</summary>${ejCard(e, k)}</details>`).join('')}
        <div class="row" style="margin-top:10px"><button class="pri grow" data-a="ses-todo" data-id="${id}">✅ Lo hice todo</button><button class="ghost grow" data-a="ses-no" data-id="${id}">❌ No pude hoy</button></div></div>`;
    }).join('');
  }
  // Estado del contador de pasos a la vista (Android): activo, o qué falta para que cuente.
  function estadoPasos() {
    if (!NATIVE) return '';
    if (sensor.on) return `<small>👣 Contador activo${sensor.last ? ' · última lectura ' + pad(new Date(sensor.last).getHours()) + ':' + pad(new Date(sensor.last).getMinutes()) : ''}</small>`;
    return `<div class="row" style="margin-top:6px"><small class="grow warnTxt">${esc(sensor.msg || 'El contador de pasos todavía no está activo.')}</small><button class="pri mini" data-a="sensor-sync">Activar</button></div>`;
  }
  function viewHoy() {
    const now = new Date(), k = hoy(), d = peek(), s = S.settings, filas = [];
    if (mod('ejercicio')) {
      const ses = sesionesDelDia(now), ejs = ses.flatMap(ejDeSesion), hechos = ejs.filter(e => progEj(e, k) >= metaEj(e)).length;
      filas.push(ejs.length ? meter('Ejercicio de hoy' + (hechos === ejs.length ? ' ✅ ¡completo!' : ''), hechos, ejs.length) : '<small>Ejercicio: hoy no tenés rutina programada.</small>');
    }
    if (mod('pasos')) filas.push(meter('Pasos', d.pasos || 0, s.metaPasos) + estadoPasos());
    if (mod('agua')) filas.push(meter('Agua', d.agua || 0, s.metaAgua, 'ml'));
    if (mod('actividad')) filas.push(meter('Actividad de la semana', minSemana(claveSemana(now)), s.aeroMeta, 'min'));
    if (mod('comida')) filas.push(meter('Alimentación de hoy', S.comida.items.filter(it => marcasDia()[it.id]).length, S.comida.items.length));
    return `<h2>${DIAS[now.getDay()]} ${now.getDate()} de ${MESES[now.getMonth()]}</h2>${tarjetaAviso()}${tarjetaRespaldo()}${tarjetasAvisos()}
    ${tarjetaPendientes(false)}
    <div class="card"><h3>Resumen del día</h3>${filas.join('') || '<p class="muted">Todavía no activaste ningún módulo. Hacelo en Ajustes.</p>'}</div>
    ${tarjetasRutinasHoy()}
    ${tarjetaAguaPend()}
    ${mod('agua') ? `<div class="card"><h3>Agua</h3><div class="row"><button class="ghost grow" data-a="agua-">− ${s.vaso} ml</button><button class="pri grow" data-a="agua+">+ vaso (${s.vaso} ml)</button></div></div>` : ''}
    ${mod('ejercicio') ? `<div class="card"><button class="ghost" style="width:100%" data-a="tab" data-t="ejercicio">Ver todo mi ejercicio y mi evolución</button></div>` : ''}
    ${AVISO_PIE}`;
  }

  /* Pendientes de la semana: lo que no se hizo en los últimos 7 días. "Repartir" lo suma como recuperación (como máximo 1 unidad extra por
     ejercicio y por día, y hasta 3 acumuladas: pensado para no cargar de más); "Dejarlo así" lo da por cerrado. */
  const MAX_RECUP = 3;
  const unidadExtra = e => (e.tipo === 'reps' ? Math.max(1, Math.round((e.meta || 0) * 0.2)) : 1);
  const textoExtra = e => (e.tipo === 'reps' ? `${unidadExtra(e)} repeticiones más` : '1 serie más');
  const recupHoy = e => Math.min(MAX_RECUP, (S.recup || {})[e.id] || 0) > 0 && !(peek().recupHecha || {})[e.id];
  const avisoRecup = e => (recupHoy(e) ? `<small class="okTxt">Recuperás una pendiente: si querés, sumá ${textoExtra(e)} (opcional).</small>` : '');
  function faltasSemana() {
    const out = [], hoyD = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = sumarDias(hoyD, -i), k = ymd(d); if (k < (S.settings.creado || '0000-00-00')) continue;
      sesionesDelDia(d).forEach(se => ejDeSesion(se).forEach(e => { if (progEj(e, k) < metaEj(e) && !(S.cerrados || {})[k + '|' + e.id] && !out.some(x => x.k === k && x.e.id === e.id)) out.push({ k, e }); }));
    }
    return out.filter(x => progEj(x.e, hoy()) < metaEj(x.e));
  }
  function consumirRecup() { // al completar la unidad extra del día, se descuenta una pendiente (una vez por día y ejercicio)
    S.ejercicios.forEach(e => { if (recupHoy(e) && progEj(e) >= metaEj(e) + unidadExtra(e)) { S.recup[e.id] = Math.max(0, (S.recup[e.id] || 0) - 1); const d = day(); d.recupHecha = d.recupHecha || {}; d.recupHecha[e.id] = true; } });
  }
  function tarjetaPendientes(conTarjetas) {
    if (!mod('ejercicio')) return '';
    const fal = faltasSemana(); if (!fal.length) return '';
    const ids = [...new Set(fal.map(x => x.e.id))], p = ids.map(ejPorId), ay = ymd(sumarDias(new Date(), -1)), soloAyer = fal.every(x => x.k === ay);
    const hoyIds = new Set(sesionesDelDia(new Date()).flatMap(ejDeSesion).map(e => e.id));
    return `<div class="card warn"><b>${soloAyer ? 'Ayer no hiciste' : 'Te quedaron pendientes esta semana'}: ${p.map(e => esc(e.n)).join(', ')}</b><p>Hoy podés hacerlos si te sentís bien, con la dosis de siempre. Si querés, repartí lo pendiente en los próximos días: como máximo una serie (o una pequeña ronda) extra por ejercicio y por día.</p>
      <div class="row"><button class="pri grow" data-a="rec-repartir">Repartir en la semana</button><button class="ghost grow" data-a="rec-dejar">Dejarlo así</button></div></div>${conTarjetas ? p.filter(e => !hoyIds.has(e.id)).map(e => ejCard(e)).join('') : ''}`;
  }
  function ejCard(e, f = hoy()) {
    const c = progEj(e, f), meta = metaEj(e), mol = S.molestias[e.id], id = esc(e.id), no = !!(peek(f).omitEj || {})[e.id];
    const fig = e.fig && window.FIG ? window.FIG(e.fig) : '';
    let ctl;
    if (e.tipo === 'reps') {
      ctl = `<div class="stepper"><button data-a="ej-" data-id="${id}" aria-label="Una menos">−</button><button class="cnt" data-a="ej-set" data-id="${id}" aria-label="Escribir cuántas hiciste">${c}/${meta}</button><button data-a="ej+" data-id="${id}" aria-label="Una más">+</button><button class="ghost mini" data-a="ej+5" data-id="${id}">+5</button></div><small>Tocá el número para escribir cuántas hiciste. Podés pasarte de la meta.</small>`;
    } else {
      const chips = Array.from({ length: Math.max(meta, c) }, (_, i) => `<span class="chip ${i < c ? 'on' : ''} ${i >= meta ? 'extra' : ''}"></span>`).join('');
      ctl = `<div class="chips">${chips}<small style="align-self:center;margin-left:6px">${c} serie${c === 1 ? '' : 's'} hecha${c === 1 ? '' : 's'}</small></div>
        <div class="item-actions"><button class="pri mini" data-a="ej+" data-id="${id}">Serie hecha</button><button class="ghost mini" data-a="ej-" data-id="${id}" aria-label="Una menos">−</button>${e.tipo === 'tiempo' ? `<button class="ghost mini" data-a="timer" data-s="${e.seg}" data-l="${esc(e.n)}">⏱ ${e.seg} s</button>` : ''}</div>`;
    }
    return `<div class="item ${c >= meta && meta > 0 ? 'done' : ''} ${mol ? 'pain' : ''}">
      <div class="item-main"><b>${esc(e.n)}</b>${fig}<small>${esc(dosisEj(e))}${e.nota ? ' — ' + esc(e.nota) : ''}</small>${avisoRecup(e)}${mol ? '<small class="warnTxt">⚠ Marcado como molesto: salteálo o hacelo más suave, y consultalo con tu profesional.</small>' : ''}</div>
      ${ctl}${no ? `<small class="warnTxt">Hoy no lo hacés${conRecordatorios() ? ': mañana te lo recuerdo' : ': mañana te lo muestro como pendiente'}.</small>` : ''}
      <div class="item-actions" style="margin-top:6px">${c >= meta && meta > 0 ? '' : `<button class="pri mini" data-a="ej-ok" data-id="${id}">✅ Lo hice</button>`}<button class="ghost mini" data-a="mol" data-id="${id}">${mol ? 'Quitar marca' : 'Me molestó'}</button>${no ? `<button class="ghost mini" data-a="ej-no-x" data-id="${id}">Deshacer "hoy no"</button>` : (c >= meta && meta > 0 ? '' : `<button class="ghost mini" data-a="ej-no" data-id="${id}">Hoy no</button>`)}</div></div>`;
  }
  function sesionBloque(s, f) {
    const k = ymd(f), ejs = ejDeSesion(s), omitE = peek(k).omitEj || {}, omit = (peek(k).omit || {})[s.id];
    const hechosL = ejs.filter(e => progEj(e, k) >= metaEj(e)), saltL = ejs.filter(e => progEj(e, k) < metaEj(e) && omitE[e.id]), pendL = ejs.filter(e => !hechosL.includes(e) && !saltL.includes(e));
    // Lo que ya está hecho (o salteado) se compacta y queda abajo: arriba solo lo que falta.
    const compacto = (e, marca, txt) => `<details class="item compacto ${marca === '✅' ? 'done' : ''}" data-eid="${esc(e.id)}" ${abiertosEj.has(e.id) ? 'open' : ''}><summary>${marca} ${esc(e.n)}<small>${txt}</small></summary>${ejCard(e, k)}</details>`;
    return `<div class="card ${sesionHecha(s, k) ? 'ok' : ''}"><h3>${esc(s.n)}${s.hora ? ' · ' + esc(s.hora) : ''}</h3>
      <p>${hechosL.length} de ${ejs.length} ejercicios completos.${omit ? ' <span class="warnTxt">Marcaste que hoy no pudiste.</span>' : ''}${ejs.length && sesionHecha(s, k) ? ' <span class="okTxt">¡Rutina completa! 🎉</span>' : ''}</p>
      <div class="row"><button class="pri grow" data-a="ses-todo" data-id="${esc(s.id)}">✅ Lo hice todo</button><button class="ghost grow" data-a="ses-no" data-id="${esc(s.id)}">❌ No pude hoy</button></div>
      <div class="row" style="margin-top:8px"><span class="muted grow">${esc(fmtDiasSes(s.dias || []))}${s.hora ? ' · ' + esc(s.hora) : ' · sin horario'}</span><button class="ghost mini" data-a="ses-edit" data-id="${esc(s.id)}">📅 Días y horario</button></div></div>
      ${pendL.map(e => ejCard(e, k)).join('')}
      ${hechosL.length || saltL.length ? `<h3 class="sub">${pendL.length ? 'Ya resuelto hoy' : 'Hecho hoy'}</h3>${hechosL.map(e => compacto(e, '✅', esc(dosisEj(e)))).join('')}${saltL.map(e => compacto(e, '⏭', 'hoy no')).join('')}` : ''}
      ${ejs.length ? '' : '<p class="muted">Esta rutina todavía no tiene ejercicios. Agregalos en Ajustes.</p>'}`;
  }
  /* Evolución: % de las rutinas programadas que se completaron, por día (semana), por semana (mes, trimestre) o por mes (año). */
  function evolucion(per) {
    const hoyD = new Date(), desdeApp = S.settings.creado ? fechaLocal(S.settings.creado) : sumarDias(hoyD, -400);
    const medir = (ini, fin) => { let prog = 0, hechas = 0, dias = 0; for (let d = ini; d <= fin; d = sumarDias(d, 1)) { if (d < sumarDias(desdeApp, 0) && ymd(d) < ymd(desdeApp)) continue; let alguna = false; sesionesDelDia(d).forEach(se => { if (ejDeSesion(se).length) { prog++; if (sesionHecha(se, ymd(d))) { hechas++; alguna = true; } } }); if (alguna) dias++; } return { prog, hechas, dias }; };
    const items = []; let tot = { prog: 0, hechas: 0, dias: 0 };
    const sumar = r => { tot.prog += r.prog; tot.hechas += r.hechas; tot.dias += r.dias; };
    const pct = r => (r.prog ? Math.round(r.hechas / r.prog * 100) : 0);
    if (per === 'semana') for (let i = 6; i >= 0; i--) { const d = sumarDias(hoyD, -i), r = medir(d, d); sumar(r); items.push({ l: DIAS[d.getDay()].slice(0, 3), v: pct(r) }); }
    else if (per === 'mes' || per === 'trimestre') for (let i = (per === 'mes' ? 4 : 13) - 1; i >= 0; i--) { const fin = sumarDias(hoyD, -7 * i), ini = sumarDias(fin, -6), r = medir(ini, fin); sumar(r); items.push({ l: `${ini.getDate()}/${ini.getMonth() + 1}`, v: pct(r) }); }
    else for (let i = 11; i >= 0; i--) { const ini = new Date(hoyD.getFullYear(), hoyD.getMonth() - i, 1), fin = i === 0 ? hoyD : new Date(ini.getFullYear(), ini.getMonth() + 1, 0), r = medir(ini, fin); sumar(r); items.push({ l: MESES[ini.getMonth()].slice(0, 3), v: pct(r) }); }
    return { items, tot, pct: pct(tot) };
  }
  function tarjetaEvolucion() {
    if (!S.sesiones.length) return '';
    const per = ['semana', 'mes', 'trimestre', 'anio'].includes(subEv) ? subEv : 'semana', ev = evolucion(per);
    const txt = { semana: 'los últimos 7 días', mes: 'las últimas 4 semanas', trimestre: 'las últimas 13 semanas', anio: 'los últimos 12 meses' }[per];
    return `<div class="card"><h3>Tu evolución</h3>${segBtns([['semana', 'Semana'], ['mes', 'Mes'], ['trimestre', 'Trimestre'], ['anio', 'Año']], per, 'sub-ev')}
      ${ev.tot.prog ? `<p><b>${ev.tot.hechas} de ${ev.tot.prog}</b> rutinas completas en ${txt} (${ev.pct} %). Días con alguna rutina completa: ${ev.tot.dias}.</p>${barras(ev.items, 100, 'Porcentaje de rutinas completas, ' + txt)}<small>Cada barra es el % de las rutinas programadas que completaste${per === 'semana' ? ' ese día' : per === 'anio' ? ' ese mes' : ' esa semana (empieza el día indicado)'}.</small>` : `<p class="muted">Todavía no hay rutinas programadas en ${txt}.</p>`}</div>`;
  }
  function viewEjercicio() {
    const now = new Date(), hoyS = sesionesDelDia(now), otras = S.sesiones.filter(s => !hoyS.includes(s));
    if (!S.sesiones.length) return `<h2>Ejercicio</h2><div class="card"><h3>Todavía no tenés una rutina</h3><p>Armala a tu medida: elegí ejemplos de la biblioteca o creá tus propios ejercicios, con las repeticiones y los días que quieras.</p><div class="row"><button class="pri grow" data-a="plan-bib">Elegir de la biblioteca</button><button class="ghost grow" data-a="ej-nuevo">Crear un ejercicio</button></div></div>${AVISO_PIE}`;
    return `<h2>Ejercicio</h2>
    <div class="card warn"><b>Cortá el ejercicio y consultá si aparece:</b><p>dolor fuerte, mareo, falta de aire, hormigueo u otra sensación rara. Los ejercicios de ejemplo son suaves, pero cada cuerpo es distinto: consultá con tu profesional.</p></div>
    ${tarjetaPendientes(true)}
    ${hoyS.length ? hoyS.map(s => sesionBloque(s, now)).join('') : '<div class="card"><b>Hoy no tenés rutina programada.</b></div>'}
    ${otras.length ? `<details class="card"><summary>Otras rutinas (${otras.length})</summary>${otras.map(s => `<div class="row sp"><p class="muted">${esc(s.n)} · ${esc(fmtDiasSes(s.dias || []))}${s.hora ? ' · ' + esc(s.hora) : ''}</p><button class="ghost mini" data-a="ses-edit" data-id="${esc(s.id)}">📅 Días y horario</button></div>${ejDeSesion(s).map(e => ejCard(e)).join('')}`).join('')}</details>` : ''}
    ${tarjetaEvolucion()}
    <div class="card"><button class="ghost" style="width:100%" data-a="tab" data-t="ajustes">Editar mi plan de ejercicio</button></div>${AVISO_PIE}`;
  }

  /* ---------- Mediciones ---------- */
  function viewMedidas() {
    if (!S.medidas.length) return `<h2>Medidas</h2><div class="card"><h3>Todavía no elegiste mediciones</h3><p>Podés llevar presión, peso, análisis de laboratorio, saturación, glucosa u otra medición propia. Los límites los definís vos o tu profesional.</p><button class="pri" data-a="med-nueva">Agregar una medición</button></div>`;
    if (!medPorId(subM)) subM = S.medidas[0].id;
    return `<h2>Medidas</h2>${segBtns(S.medidas.map(x => [x.id, x.n]), subM, 'sub-m')}${vistaMedida(medPorId(subM))}`;
  }
  const fmtReg = (m, r, rows, idx) => m.campos.filter(c => r[c.k] != null).map(c => `${esc(c.n)} ${fmtNum(r[c.k], c.dec)}${anterior(rows, idx, c.k) ? ' (' + fmtPct(variacion(rows, idx, c.k)) + ')' : ''}`).join(' · ');
  function vistaMedida(m) {
    const rows = regsOrd(m), campos = m.campos;
    const conDatos = campos.filter(c => rows.some(r => r[c.k] != null));
    if (!campos.some(c => c.k === selCampo[m.id])) selCampo[m.id] = (conDatos[0] || campos[0]).k;
    const ck = selCampo[m.id], c = campos.find(x => x.k === ck);
    const campoIn = x => `<div><label for="r_${esc(x.k)}">${esc(x.n)}${x.u ? ' (' + esc(x.u) + ')' : ''}</label><input id="r_${esc(x.k)}" name="${esc(x.k)}" type="number" inputmode="decimal" step="any" ${x.opc ? '' : 'required'}></div>`;
    const filas = conDatos.map(x => {
      const idx = rows.findIndex(r => r[x.k] != null), a = anterior(rows, idx, x.k);
      return `<tr><td>${esc(x.n)}</td><td><b>${fmtNum(rows[idx][x.k], x.dec)}</b></td><td>${a ? fmtNum(a[x.k], x.dec) : '—'}</td><td>${a ? fmtPct(variacion(rows, idx, x.k)) : '—'}</td></tr>`;
    }).join('');
    const hayLim = campos.some(x => x.min != null || x.max != null);
    const band = c.min != null && c.max != null ? [c.min, c.max] : null;
    const lines = band ? [] : [c.min != null ? { v: c.min, label: 'Mín ' + fmtNum(c.min, c.dec) } : null, c.max != null ? { v: c.max, label: 'Máx ' + fmtNum(c.max, c.dec) } : null].filter(Boolean);
    const p = proximaFecha(m);
    return `${conAvisos() ? avisosMedida(m).map(t => `<div class="card warn"><b>Fuera del rango que definiste</b><p>${esc(t)}</p></div>`).join('') : ''}
    <div class="card"><h3>Registrar ${esc(m.n)}</h3>
      <form data-f="reg" data-id="${esc(m.id)}"><label for="rFecha">Fecha</label><input id="rFecha" name="fecha" type="date" value="${hoy()}" max="${hoy()}" required>
        <div class="grid2">${campos.map(campoIn).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="pri grow" type="submit">Guardar</button></div></form>
      <small>${campos.every(x => x.opc) ? 'Podés cargar solo algunos valores. ' : ''}Si ya hay un registro de esa fecha, se completa con lo nuevo.</small>
      <div class="row" style="margin-top:8px"><button class="ghost grow" data-a="med-conf" data-id="${esc(m.id)}">Configurar esta medición</button></div></div>
    ${filas ? `<div class="card"><h3>Cambio respecto del registro anterior</h3><table class="tabla"><tr><th>Valor</th><th>Último</th><th>Anterior</th><th>Cambio</th></tr>${filas}</table></div>` : ''}
    <div class="card"><h3>Evolución</h3>${campos.length > 1 ? segBtns(campos.map(x => [x.k, x.n]), ck, 'sub-c') : ''}
      ${chart([{ name: c.n, pts: rows.filter(r => r[ck] != null).slice(0, 20).map(r => ({ t: tsFecha(r.fecha), v: r[ck] })) }], { label: 'Evolución de ' + c.n, band, lines, dec: c.dec || 0 })}
      ${hayLim ? `<small>Las líneas muestran los límites que definiste${conAvisos() ? '' : ' (los avisos están desactivados en tu modo de uso)'}.</small>` : '<small>Sin límites definidos. Si querés verlos en el gráfico o recibir avisos, definilos en "Configurar" con tu profesional.</small>'}
      <ul class="list">${rows.slice(0, 10).map((r, idx) => `<li><span>${fmtFecha(r.fecha)} · ${fmtReg(m, r, rows, idx)}</span>${delBtn('reg:' + m.id, r.i)}</li>`).join('')}</ul></div>
    ${p ? `<div class="card"><b>Próxima medición sugerida</b><p>${fmtDMA(p.desde)} (${m.repetirMeses} mes${m.repetirMeses === 1 ? '' : 'es'} después del último registro).</p><small>${AVISO_APP_ABIERTA}</small></div>` : ''}`;
  }

  /* ---------- Hábitos ---------- */
  function viewHabitos() {
    const subs = [['pasos', 'Pasos'], ['agua', 'Agua'], ['actividad', 'Actividad'], ['comida', 'Alimentación']].filter(([k]) => mod(k));
    if (!subs.some(x => x[0] === subH)) subH = subs[0][0];
    return `<h2>Hábitos</h2>${subs.length > 1 ? segBtns(subs, subH, 'sub-h') : ''}${({ pasos: subPasos, agua: subAgua, actividad: subActividad, comida: subComida })[subH]()}${AVISO_PIE}`;
  }
  function diasBarras(getter) {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => { const x = sumarDias(now, i - 6); return { l: DIAS[x.getDay()].slice(0, 3), v: getter(ymd(x)) }; });
  }
  /* Evolución de un valor diario (pasos, minutos de actividad) por semana (por día), mes y trimestre (por semana) y año (por mes). */
  const PERIODOS = [['semana', 'Semana'], ['mes', 'Mes'], ['trimestre', 'Trimestre'], ['anio', 'Año']];
  const TXT_PERIODO = { semana: 'los últimos 7 días', mes: 'las últimas 4 semanas', trimestre: 'las últimas 13 semanas', anio: 'los últimos 12 meses' };
  function evolucionDiaria(per, getter, modo) { // modo 'prom' (promedio de los días con registro) o 'suma'
    const hoyD = new Date(), desde = S.settings.creado || '0000-00-00', tramos = [];
    if (per === 'semana') for (let i = 6; i >= 0; i--) { const d = sumarDias(hoyD, -i); tramos.push([d, d, DIAS[d.getDay()].slice(0, 3)]); }
    else if (per === 'mes' || per === 'trimestre') for (let i = (per === 'mes' ? 4 : 13) - 1; i >= 0; i--) { const fin = sumarDias(hoyD, -7 * i), ini = sumarDias(fin, -6); tramos.push([ini, fin, `${ini.getDate()}/${ini.getMonth() + 1}`]); }
    else for (let i = 11; i >= 0; i--) { const ini = new Date(hoyD.getFullYear(), hoyD.getMonth() - i, 1), fin = i === 0 ? hoyD : new Date(ini.getFullYear(), ini.getMonth() + 1, 0); tramos.push([ini, fin, MESES[ini.getMonth()].slice(0, 3)]); }
    const tot = { sum: 0, con: 0, dias: 0, max: 0, vals: [] };
    const items = tramos.map(([ini, fin, l]) => {
      let sum = 0, con = 0, dias = 0;
      for (let d = ini; d <= fin; d = sumarDias(d, 1)) { const k = ymd(d); if (k < desde) continue; dias++; const v = getter(k) || 0; sum += v; if (v > 0) { con++; tot.vals.push(v); tot.max = Math.max(tot.max, v); } }
      tot.sum += sum; tot.con += con; tot.dias += dias;
      return { l, v: modo === 'prom' ? (con ? Math.round(sum / con) : 0) : sum };
    });
    return { items, tot };
  }
  const pasosDe = k => peek(k).pasos || 0;
  function tarjetaEvolucionPasos() {
    const per = PERIODOS.some(p => p[0] === subEvP) ? subEvP : 'semana', ev = evolucionDiaria(per, pasosDe, 'prom'), meta = S.settings.metaPasos, t = ev.tot;
    const alcanzo = meta ? t.vals.filter(v => v >= meta).length : null;
    return `<div class="card"><h3>Tu evolución de pasos</h3>${segBtns(PERIODOS, per, 'sub-evp')}
      ${t.con ? `<p>Promedio: <b>${Math.round(t.sum / t.con)} pasos por día</b> en ${TXT_PERIODO[per]} (${t.con} día${t.con === 1 ? '' : 's'} con registro). Mejor día: ${t.max}.${meta ? ` Llegaste a la meta en ${alcanzo} día${alcanzo === 1 ? '' : 's'}.` : ''}</p>${barras(ev.items, meta, 'Pasos por día (promedio), ' + TXT_PERIODO[per])}<small>${per === 'semana' ? 'Cada barra es un día.' : per === 'anio' ? 'Cada barra es el promedio diario de un mes.' : 'Cada barra es el promedio diario de una semana (empieza el día indicado).'}</small>` : `<p class="muted">Todavía no hay pasos registrados en ${TXT_PERIODO[per]}.</p>`}</div>`;
  }
  function tarjetaEvolucionAero() {
    const per = PERIODOS.some(p => p[0] === subEvA) ? subEvA : 'semana', mapa = {}; S.aero.forEach(r => { if (r && typeof r.fecha === 'string') mapa[r.fecha] = (mapa[r.fecha] || 0) + (r.min || 0); });
    const ev = evolucionDiaria(per, k => mapa[k] || 0, 'suma'), t = ev.tot, meta = S.settings.aeroMeta, semanas = Math.max(1, t.dias / 7);
    return `<div class="card"><h3>Tu evolución de actividad</h3>${segBtns(PERIODOS, per, 'sub-eva')}
      ${t.sum ? `<p>Total: <b>${t.sum} min</b> en ${TXT_PERIODO[per]}${per === 'semana' ? '' : ` · promedio ${Math.round(t.sum / semanas)} min por semana`}.${meta && per !== 'semana' && per !== 'anio' ? ` Meta semanal: ${meta} min.` : ''}</p>${barras(ev.items, per === 'mes' || per === 'trimestre' ? meta : null, 'Minutos de actividad, ' + TXT_PERIODO[per])}<small>${per === 'semana' ? 'Cada barra es un día.' : per === 'anio' ? 'Cada barra es el total de un mes.' : 'Cada barra es el total de una semana (empieza el día indicado).'}</small>` : `<p class="muted">Todavía no hay actividad registrada en ${TXT_PERIODO[per]}.</p>`}</div>`;
  }
  function subPasos() {
    const d = peek(), s = S.settings;
    const sens = NATIVE ? `<div class="card"><h3>Pasos automáticos</h3>
      <p>${sensor.on ? `Los pasos se cuentan solos, también con la app cerrada. Última lectura: ${pad(new Date(sensor.last).getHours())}:${pad(new Date(sensor.last).getMinutes())}.` : esc(sensor.msg || 'Tocá el botón y aceptá el permiso de actividad física: después se cuentan solos.')}</p>
      ${sensor.on ? '' : '<div class="row"><button class="pri grow" data-a="sensor-sync">Activar contador de pasos</button></div>'}
      <details style="margin-top:8px"><summary style="min-height:44px;display:flex;align-items:center">Opciones</summary>
      ${sensor.on ? '<div class="row"><button class="ghost grow" data-a="sensor-sync">Actualizar ahora</button></div>' : ''}
      <div class="row" style="margin-top:8px"><button class="${s.segundoPlano ? 'dang' : 'pri'} grow" data-a="bg-toggle">${s.segundoPlano ? 'Detener actualización en segundo plano' : 'Reanudar actualización en segundo plano'}</button></div>
      <small>Segundo plano: ${s.segundoPlano ? 'activo, anota los pasos cada ~15 min aunque la app esté cerrada' : 'detenido; los pasos se suman cuando abrís la app'}. Si el teléfono se pone lento, detenelo desde acá.</small></details></div>` : '';
    return `<div class="card"><div class="big" id="pasosNum">${d.pasos || 0}</div>
      <p class="muted" style="text-align:center">${s.metaPasos ? `meta: ${s.metaPasos} pasos` : 'sin meta (podés fijarla en Ajustes)'}</p>
      ${s.metaPasos ? `<div class="bar"><i id="pasosBar" style="width:${Math.min(100, Math.round((d.pasos || 0) / s.metaPasos * 100))}%"></i></div>` : ''}
      ${NATIVE ? '' : `<div class="row" style="margin-top:12px"><button class="${step.on ? 'dang' : 'pri'} grow" data-a="motion">${step.on ? 'Detener conteo' : 'Contar pasos ahora'}</button></div><small>${step.on ? 'Contando con el acelerómetro. Dejá la pantalla encendida y el teléfono en el bolsillo.' : 'El navegador solo cuenta mientras la app está abierta y la pantalla encendida.'}</small>`}</div>
    ${sens}
    <div class="card"><h3>Cargar pasos a mano</h3><small>Útil para copiar el total de otra app o de tu pulsera.</small>
      <label for="pasosInput">Cantidad</label><input id="pasosInput" type="number" inputmode="numeric" min="0" max="100000" placeholder="Ej: 3500">
      <div class="row" style="margin-top:8px"><button class="ghost grow" data-a="pasos-add">Sumar</button><button class="ghost grow" data-a="pasos-set">Fijar total del día</button></div></div>
    ${tarjetaEvolucionPasos()}`;
  }
  function subAgua() {
    const d = peek(), s = S.settings;
    return `${tarjetaAguaPend()}<div class="card"><h3>Agua de hoy</h3>${meter('Tomado', d.agua || 0, s.metaAgua, 'ml')}
      <div class="row" style="margin-top:10px"><button class="ghost grow" data-a="agua-">− ${s.vaso} ml</button><button class="pri grow" data-a="agua+">+ vaso (${s.vaso} ml)</button></div>
      <small>${s.metaAgua ? '' : 'Todavía no definiste una meta: fijala en Ajustes con tu profesional. '}La cantidad de líquido que te conviene la define tu médico.</small></div>
    <div class="card"><h3>Últimos 7 días (ml)</h3>${barras(diasBarras(k => peek(k).agua || 0), s.metaAgua, 'Agua de los últimos 7 días')}</div>`;
  }
  function subActividad() {
    const meta = S.settings.aeroMeta, ws = semanasAero(8), ahora = ws[ws.length - 1], prom = promedioAero();
    const recientes = S.aero.map((r, i) => ({ ...r, i })).filter(r => typeof r.fecha === 'string').sort((a, b) => b.fecha.localeCompare(a.fecha) || b.i - a.i).slice(0, 8);
    return `<div class="card"><h3>Esta semana</h3>${meter('Actividad aeróbica', ahora.min, meta, 'min')}
      ${meta ? (ahora.min >= meta ? '<p class="okTxt">¡Meta de la semana cumplida!</p>' : `<small>Te faltan ${meta - ahora.min} min para la meta (lunes a domingo).</small>`) : '<small>Sin meta: podés fijarla en Ajustes.</small>'}</div>
    <div class="card"><h3>Registrar actividad</h3>
      <form data-f="aero"><div class="grid2"><div><label for="aFecha">Fecha</label><input id="aFecha" name="fecha" type="date" value="${hoy()}" max="${hoy()}" required></div><div><label for="aMin">Minutos</label><input id="aMin" name="min" type="number" inputmode="numeric" min="1" max="600" required></div></div>
      <label for="aTipo">Tipo</label><input id="aTipo" name="tipo" type="text" maxlength="40" placeholder="Ej: caminata, bici, natación">
      <div class="row" style="margin-top:10px"><button class="pri grow" type="submit">Guardar</button></div></form>
      <small>Los pasos del día no reemplazan estos minutos. Consultá con tu profesional qué intensidad es adecuada para vos.</small></div>
    ${tarjetaEvolucionAero()}
    <div class="card"><h3>Mis últimos registros</h3>${prom ? `<small>Promedio semanal: <b>${prom.prom} min</b> (${prom.semanas} semana${prom.semanas === 1 ? '' : 's'} con datos).</small>` : '<small>Todavía no hay registros.</small>'}
      <ul class="list">${recientes.map(r => `<li><span>${fmtFecha(r.fecha)} · <b>${r.min} min</b>${r.tipo ? ' · ' + esc(r.tipo) : ''}</span>${delBtn('aero', r.i)}</li>`).join('')}</ul></div>`;
  }
  let sugSel = new Set();
  function subComida() {
    const items = S.comida.items, m = marcasDia(), c = cumplimientoSemana(lunesDe(new Date())), hechos = items.filter(it => m[it.id]).length;
    if (!items.length && !S.comida.contadores.length) return `<div class="card"><h3>Tu checklist está vacío</h3><p>Armalo con lo que quieras seguir cada día. Tocá una sugerencia o agregá la tuya.</p>${SUGERENCIAS_COMIDA.map((t, i) => `<button class="chk-it ${sugSel.has(i) ? 'on' : ''}" data-a="com-sug" data-v="${i}" aria-pressed="${sugSel.has(i) ? 'true' : 'false'}"><span>${sugSel.has(i) ? '✅' : '⬜'}</span>${esc(t)}</button>`).join('')}<div class="row"><button class="pri grow" data-a="com-sug-ok" ${sugSel.size ? '' : 'disabled'}>Agregar ${sugSel.size ? 'las ' + sugSel.size + ' elegidas' : 'las elegidas'}</button><button class="ghost grow" data-a="com-add">Agregar ítem propio</button></div><h3 class="sub">O contá por día (se suma en la semana)</h3><div class="row">${CONTADORES_SUG.map(n => `<button class="ghost mini" data-a="ct-sug" data-v="${esc(n)}">➕ ${esc(n)}</button>`).join('')}</div><small>Tocá todas las que quieras. Son ejemplos: elegí lo que te indicó tu profesional.</small></div>`;
    return `<div class="card"><h3>Hoy</h3>${items.map(it => `<button class="chk-it ${m[it.id] ? 'on' : ''}" data-a="com-t" data-id="${esc(it.id)}" aria-pressed="${m[it.id] ? 'true' : 'false'}"><span>${m[it.id] ? '✅' : '⬜'}</span>${esc(it.n)}</button>`).join('') || '<p class="muted">Sin ítems diarios.</p>'}
      <small>Marcá cada ítem si lo cumpliste hoy (${hechos} de ${items.length}).</small></div>
    ${S.comida.contadores.map(ct => `<div class="card"><h3>${esc(ct.n)}</h3><div class="stepper"><button data-a="cont-" data-id="${esc(ct.id)}" aria-label="Una menos">−</button><span>${contDia(ct.id)}</span><button data-a="cont+" data-id="${esc(ct.id)}" aria-label="Una más">+</button></div>${meter('Esta semana (veces)', c.cont[ct.id] || 0, ct.meta)}</div>`).join('')}
    ${items.length ? `<div class="card"><h3>Cumplimiento de la semana</h3>${c.pct === null ? '<p class="muted">Sin datos todavía.</p>' : `<div class="big">${c.pct} %</div><div class="bar"><i style="width:${c.pct}%"></i></div><small>${c.ok} de ${c.tot} casilleros marcados en ${c.dias} día${c.dias === 1 ? '' : 's'} (lunes a hoy).</small>`}</div>` : ''}
    <div class="card"><div class="row"><button class="ghost grow" data-a="com-add">Agregar ítem</button><button class="ghost grow" data-a="com-sugs">Sugerencias</button></div>
      ${CONTADORES_SUG.filter(n => !S.comida.contadores.some(x => x.n === n)).length ? `<h3 class="sub">Contar por día (se suma en la semana)</h3><div class="row">${CONTADORES_SUG.filter(n => !S.comida.contadores.some(x => x.n === n)).map(n => `<button class="ghost mini" data-a="ct-sug" data-v="${esc(n)}">➕ ${esc(n)}</button>`).join('')}<button class="ghost mini" data-a="ct-nuevo">➕ Otro</button></div>` : '<div class="row" style="margin-top:8px"><button class="ghost mini" data-a="ct-nuevo">➕ Otro contador</button></div>'}
      <div class="row" style="margin-top:8px"><button class="ghost grow" data-a="rec-nuevo">🔔 Que me recuerde algo</button></div>
      <small>También podés renombrar o quitar ítems en Ajustes → Alimentación.</small></div>`;
  }

  /* ---------- Ajustes ---------- */
  const horaOk = x => /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
  function viewAjustes() {
    const s = S.settings;
    const campoNum = (n, l, v, ph, extra = '') => `<div><label for="s_${n}">${l}</label><input id="s_${n}" name="${n}" type="number" inputmode="decimal" step="any" value="${v == null ? '' : v}" placeholder="${esc(ph || '')}" ${extra}></div>`;
    const modo = `<div class="card"><h3>Modo de uso</h3>${MODOS.map(([k, n, t]) => `<button class="opcion ${S.modo === k ? 'on' : ''}" data-a="modo" data-v="${k}" aria-pressed="${S.modo === k ? 'true' : 'false'}"><b>${n}</b><small>${t}</small></button>`).join('')}${NATIVE ? '<div class="row" style="margin-top:8px"><button class="ghost grow" data-a="probar-aviso">🔔 Probar un aviso ahora</button></div>' : ''}${NATIVE ? '' : '<small>Los recordatorios con la app cerrada funcionan en la app Android.</small>'}</div>`;
    const colorCard = `<div class="card"><h3>Color de la app</h3><div class="colores">${Object.keys(COLORES).map(k => `<button class="color ${(COLORES[s.color] ? s.color : 'coral') === k ? 'on' : ''}" data-a="color" data-v="${k}" aria-pressed="${(COLORES[s.color] ? s.color : 'coral') === k ? 'true' : 'false'}"><i class="sw sw-${k}"></i>${COLORES[k][0]}</button>`).join('')}</div></div>`;
    const mods = `<div class="card"><h3>Qué querés seguir</h3>${MODULOS.map(([k, ic, n]) => `<label class="chk"><input type="checkbox" data-a="mod-t" data-k="${k}" ${mod(k) ? 'checked' : ''}>${ic} ${n}</label>`).join('')}<small>Si desactivás algo, lo que cargaste se conserva.</small></div>`;
    const metas = `<form data-f="metas" class="card"><h3>Metas y recordatorios</h3><small>Todas son opcionales y las definís vos (con tu profesional, si corresponde). Dejá vacío para no tener meta.</small>
      ${mod('agua') ? `<div class="grid2">${campoNum('metaAgua', 'Meta de agua (ml/día)', s.metaAgua, 'Ej: 2000')}${campoNum('vaso', 'Tamaño del vaso (ml)', s.vaso, '', 'required min="1"')}</div>
        <label class="chk"><input type="checkbox" name="recAgua" ${s.recAgua ? 'checked' : ''}>Recordarme tomar agua${conRecordatorios() ? '' : ' (activá un modo con recordatorios)'}</label>
        <div class="grid2">${campoNum('recMin', 'Cada cuántos minutos', s.recMin, '', 'required min="15"')}<div></div></div>
        <div class="grid2"><div><label for="s_aguaDesde">Desde</label><input id="s_aguaDesde" name="aguaDesde" type="time" value="${esc(s.aguaDesde)}" required></div><div><label for="s_aguaHasta">Hasta</label><input id="s_aguaHasta" name="aguaHasta" type="time" value="${esc(s.aguaHasta)}" required></div></div>` : ''}
      ${mod('pasos') ? campoNum('metaPasos', 'Meta de pasos por día', s.metaPasos, 'Ej: 8000') + `<label class="chk"><input type="checkbox" name="recPasos" ${s.recPasos === true ? 'checked' : ''}>Avisarme a la noche cómo voy con los pasos (opcional: se cuentan solos)${conRecordatorios() ? '' : ' (activá un modo con recordatorios)'}</label><label for="s_recPasosHora">Hora del aviso de pasos</label><input id="s_recPasosHora" name="recPasosHora" type="time" value="${esc(s.recPasosHora || '20:00')}" required><small>No suena si ya llegaste a tu meta.</small>` : ''}
      ${mod('actividad') ? campoNum('aeroMeta', 'Meta de actividad aeróbica (min por semana)', s.aeroMeta, 'Ej: 150') : ''}
      ${mod('ejercicio') ? campoNum('descansoSeg', 'Descanso entre series (segundos)', s.descansoSeg, '', 'required min="5"') : ''}
      ${mod('ejercicio') ? `<label class="chk"><input type="checkbox" name="seguirOn" ${s.seguirOn !== false ? 'checked' : ''}>Preguntarme a la noche si hice mi rutina${conRecordatorios() ? '' : ' (activá un modo con recordatorios)'}</label><label for="s_seguirHora">Hora de la pregunta</label><input id="s_seguirHora" name="seguirHora" type="time" value="${esc(s.seguirHora || '21:00')}" required><small>No suena si ya marcaste todo. Lo que quede pendiente lo podés repartir en la semana.</small>` : ''}
      <label for="s_notas">Notas e indicaciones de mi profesional (van al informe)</label><textarea id="s_notas" name="notas" maxlength="1000" placeholder="Ej: lo que te indicó tu médico o kinesiólogo">${esc(s.notas || '')}</textarea>
      <div class="row" style="margin-top:10px"><button class="pri grow" type="submit">Guardar</button></div></form>`;
    const plan = !mod('ejercicio') ? '' : `<div class="card"><h3>Mi plan de ejercicio</h3><small>Armalo como te indicó tu profesional: rutinas con sus días y ejercicios con sus repeticiones.</small>
      ${S.sesiones.map(se => `<div class="sesion"><div class="row sp"><b>${esc(se.n)}</b><span class="muted">${esc(fmtDiasSes(se.dias || []))}${se.hora ? ' · ' + esc(se.hora) : ''}</span></div>
        <ul class="list">${ejDeSesion(se).map(e => `<li><span>${esc(e.n)}<small>${esc(dosisEj(e))}</small></span><span class="row"><button class="ghost mini" data-a="ej-edit" data-id="${esc(e.id)}">Editar</button><button class="dang mini" data-a="ej-del" data-id="${esc(e.id)}">Quitar</button></span></li>`).join('') || '<li class="muted">Sin ejercicios</li>'}</ul>
        ${mezclaEspalda(se) ? `<div class="row" style="margin-bottom:6px"><button class="pri mini grow" data-a="ses-separar" data-id="${esc(se.id)}">Separar espalda y core en su propia rutina</button></div>` : ''}
        <div class="row"><button class="ghost mini" data-a="ses-edit" data-id="${esc(se.id)}">Editar rutina</button><button class="dang mini" data-a="ses-del" data-id="${esc(se.id)}">Quitar rutina</button></div></div>`).join('')}
      <div class="row" style="margin-top:8px"><button class="pri grow" data-a="ej-nuevo">Nuevo ejercicio</button><button class="ghost grow" data-a="plan-bib">Desde la biblioteca</button></div>
      <div class="row" style="margin-top:8px"><button class="ghost grow" data-a="ses-nueva">Nueva rutina</button></div></div>`;
    const meds = !mod('medidas') ? '' : `<div class="card"><h3>Mis mediciones</h3><small>Los límites, los avisos y cada cuánto repetir los definís en "Configurar".</small>
      <ul class="list">${S.medidas.map(m => `<li><span>${CATALOGO[m.tipo] ? CATALOGO[m.tipo].ic : '📏'} ${esc(m.n)}</span><span class="row"><button class="ghost mini" data-a="med-conf" data-id="${esc(m.id)}">Configurar</button><button class="dang mini" data-a="med-del" data-id="${esc(m.id)}">Quitar</button></span></li>`).join('') || '<li class="muted">Todavía ninguna</li>'}</ul>
      <div class="row"><button class="pri grow" data-a="med-nueva">Agregar medición</button></div></div>`;
    const com = !mod('comida') ? '' : `<div class="card"><h3>Alimentación</h3><small>Tu checklist diario y tus contadores semanales.</small>
      <ul class="list">${S.comida.items.map(it => `<li><span>${esc(it.n)}</span><span class="row"><button class="ghost mini" data-a="ci-ren" data-id="${esc(it.id)}">Renombrar</button><button class="dang mini" data-a="ci-del" data-id="${esc(it.id)}">Quitar</button></span></li>`).join('') || '<li class="muted">Sin ítems diarios</li>'}</ul>
      <ul class="list">${S.comida.contadores.map(c => `<li><span>${esc(c.n)}<small>meta semanal: ${c.meta || 'sin meta'}</small></span><span class="row"><button class="ghost mini" data-a="ct-edit" data-id="${esc(c.id)}">Editar</button><button class="dang mini" data-a="ct-del" data-id="${esc(c.id)}">Quitar</button></span></li>`).join('')}</ul>
      <div class="row"><button class="pri grow" data-a="com-add">Agregar ítem</button><button class="ghost grow" data-a="ct-nuevo">Contador semanal</button></div>
      <div class="row" style="margin-top:8px"><button class="ghost grow" data-a="com-sugs">Ver sugerencias</button></div></div>`;
    const inf = s.informe, secciones = [['ejercicio', 'Ejercicio'], ['pasos', 'Pasos'], ['agua', 'Agua'], ['actividad', 'Actividad aeróbica'], ['comida', 'Alimentación']].filter(([k]) => mod(k)).concat(mod('medidas') ? S.medidas.map(m => ['medida:' + m.id, m.n]) : []);
    const informe = `<div class="card"><h3>Informe para mi médico</h3><small>Elegí qué incluir y de qué período. Lo armás cuando lo necesites y lo compartís o imprimís.</small>
      <label for="inf_periodo">Período</label><select id="inf_periodo">${[[30, 'Últimos 30 días'], [90, 'Últimos 90 días'], [180, 'Últimos 6 meses'], [365, 'Último año'], [0, 'Todo lo registrado']].map(([v, t]) => `<option value="${v}" ${inf.periodo === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      ${secciones.map(([k, n]) => `<label class="chk"><input type="checkbox" class="inf-inc" value="${esc(k)}" ${inf.excluir[k] ? '' : 'checked'}>${esc(n)}</label>`).join('') || '<p class="muted">Activá módulos para poder incluirlos.</p>'}
      <div class="row" style="margin-top:8px"><button class="pri grow" data-a="informe">Armar y compartir informe</button></div></div>`;
    const datos = `<div class="card"><h3>Mis datos</h3>
      <p class="muted">Todo se guarda solo en este teléfono: no hay cuentas ni servidores. Hacé copias de seguridad. Último respaldo: <b>${s.ultimoRespaldo ? fmtFecha(ymd(new Date(s.ultimoRespaldo))) : 'nunca'}</b>.</p>
      <div class="row"><button class="pri grow" data-a="export">Exportar respaldo (JSON)</button><button class="ghost grow" data-a="copiar">Copiar respaldo</button></div>
      <div class="row" style="margin-top:8px"><button class="ghost grow" data-a="import">Importar respaldo</button><button class="dang grow" data-a="borrar">Borrar todo</button></div>
      <small>"Importar respaldo" también acepta el respaldo de Salud Activa: lo convierte y no pierde nada.</small>
      <input id="fileIn" type="file" accept="application/json,.json" hidden></div>
    <div class="card ${s.avisoAceptado ? '' : 'warn'}"><h3>Aviso importante</h3><p>${esc(AVISO_TXT)}</p>${s.avisoAceptado ? `<small>Lo aceptaste el ${fmtFecha(ymd(new Date(s.avisoAceptado)))}.</small>` : '<div class="row"><button class="pri grow" data-a="aviso-ok">Entendí y acepto</button></div>'}</div>
    <div class="card"><h3>Acerca de A Mi Ritmo</h3><p>Versión ${APP_V}${NATIVE ? ' (Android)' : ''}. A Mi Ritmo no es un servicio médico: no diagnostica ni indica tratamientos. Las metas y los límites de salud los definís vos, idealmente con tu médico o profesional.</p>
      <div class="row"><button class="ghost grow" data-a="wiz-rehacer">Rehacer el asistente inicial</button></div></div>`;
    const recs = `<div class="card"><h3>Mis recordatorios</h3><small>Lo que quieras que te recuerde: una fruta, la medicación, estirar… Funcionan con los modos que incluyen recordatorios.</small>
      <ul class="list">${S.recordatorios.map(r => `<li><span>🔔 ${esc(r.txt)}<small>${esc(fmtDiasSes(r.dias || []))} · ${esc(r.hora)}</small></span><span class="row"><button class="ghost mini" data-a="rec-edit" data-id="${esc(r.id)}">Editar</button><button class="dang mini" data-a="rec-del" data-id="${esc(r.id)}">Quitar</button></span></li>`).join('') || '<li class="muted">Todavía ninguno</li>'}</ul>
      <div class="row"><button class="pri grow" data-a="rec-nuevo">Agregar recordatorio</button></div></div>`;
    const salud = !NATIVE ? '' : `<div class="card"><h3>Datos de tu reloj o pulsera</h3><small>Si tu reloj o pulsera guarda la saturación y el pulso en Health Connect (Samsung Health, Google Fit, Xiaomi…), podés traerlos acá. Solo se leen esos dos datos; no se modifica nada.</small>
      <div class="row" style="margin-top:8px"><button class="pri grow" data-a="salud-importar">Traer saturación y pulso</button></div>
      <label class="chk"><input type="checkbox" data-a="salud-auto" ${s.hcAuto ? 'checked' : ''}>Traerlos solos al abrir la app</label>
      <small>${s.hcUltimo ? 'Última vez: ' + fmtFecha(ymd(new Date(s.hcUltimo))) + ' ' + pad(new Date(s.hcUltimo).getHours()) + ':' + pad(new Date(s.hcUltimo).getMinutes()) + '.' : 'Todavía no trajiste nada.'} La primera vez trae el último mes. Son lecturas de un reloj: no reemplazan un saturómetro ni la consulta con tu médico.</small></div>`;
    return `<h2>Ajustes</h2>${modo}${mods}${colorCard}${metas}${plan}${meds}${com}${recs}${salud}${informe}${datos}`;
  }

  /* ---------- Asistente inicial ---------- */
  function wizInit() { return wiz || (wiz = { paso: 0, mods: Object.assign({}, S.modulos), meds: {}, bib: {}, modo: S.modo || 'registro' }); }
  function wizPasos() {
    wizInit(); const p = ['bienvenida', 'modulos'];
    if (wiz.mods.medidas) p.push('mediciones');
    if (wiz.mods.ejercicio) p.push('ejercicio');
    p.push('modo');
    if (wiz.mods.agua || wiz.mods.pasos || wiz.mods.actividad) p.push('metas');
    p.push('listo'); return p;
  }
  function viewAsistente() {
    const ps = wizPasos(), i = Math.min(wiz.paso, ps.length - 1), p = ps[i], s = S.settings;
    const campoNum = (n, l, v, ph) => `<div><label for="w_${n}">${l}</label><input id="w_${n}" name="${n}" type="number" inputmode="decimal" step="any" value="${v == null ? '' : v}" placeholder="${esc(ph)}"></div>`;
    let cuerpo = '';
    if (p === 'bienvenida') cuerpo = `<h2>Bienvenido a A Mi Ritmo</h2><p>Es una libreta para armar <b>tu propio plan de hábitos de salud</b> y anotar tus avances. Vos elegís qué seguir, cuánto y con qué límites. Lo que cargues queda en tu teléfono.</p>
      <div class="card warn"><b>Importante</b><p>A Mi Ritmo no es un servicio médico: no diagnostica ni indica tratamientos. Las metas y los límites de salud los definís vos, idealmente con tu médico o profesional.</p></div>`;
    if (p === 'modulos') cuerpo = `<h2>¿Qué querés seguir?</h2><p class="muted">Elegí lo que te sirva. Podés cambiarlo cuando quieras.</p>${MODULOS.map(([k, ic, n, t]) => `<button class="chk-it ${wiz.mods[k] ? 'on' : ''}" data-a="wiz-mod" data-k="${k}" aria-pressed="${wiz.mods[k] ? 'true' : 'false'}"><span>${wiz.mods[k] ? '✅' : '⬜'}</span><span class="tx"><b>${ic} ${n}</b><small>${t}</small></span></button>`).join('')}`;
    if (p === 'mediciones') cuerpo = `<h2>¿Qué querés medir?</h2><p class="muted">Después podés poner tus propios límites en cada una (opcional).</p>${Object.keys(CATALOGO).map(k => `<button class="chk-it ${wiz.meds[k] ? 'on' : ''}" data-a="wiz-med" data-k="${k}" aria-pressed="${wiz.meds[k] ? 'true' : 'false'}"><span>${wiz.meds[k] ? '✅' : '⬜'}</span>${CATALOGO[k].ic} ${esc(CATALOGO[k].n)}</button>`).join('')}`;
    if (p === 'ejercicio') cuerpo = `<h2>Tu rutina de ejercicio</h2><p class="muted">Elegí ejemplos para empezar o salteá este paso y creá tus propios ejercicios después. Son ejemplos suaves, <b>no una indicación</b>: consultalos con tu profesional.</p><p class="muted">Los de espalda y core van en una rutina aparte, para que elijas sus propios días y horario (en Ajustes → Mi plan de ejercicio).</p>${BIBLIOTECA.map((b, n) => `${n === 0 || grupoBib(b) !== grupoBib(BIBLIOTECA[n - 1]) ? `<h3 class="sub">${GRUPOS_BIB[grupoBib(b)].titulo}</h3>` : ''}<button class="chk-it ${wiz.bib[n] ? 'on' : ''}" data-a="wiz-bib" data-k="${n}" aria-pressed="${wiz.bib[n] ? 'true' : 'false'}"><span>${wiz.bib[n] ? '✅' : '⬜'}</span><span class="tx"><b>${esc(b.n)}</b><small>${esc(dosisEj(b))}</small></span></button>`).join('')}`;
    if (p === 'modo') cuerpo = `<h2>¿Cómo querés usarla?</h2>${MODOS.map(([k, n, t]) => `<button class="opcion ${wiz.modo === k ? 'on' : ''}" data-a="wiz-modo" data-v="${k}" aria-pressed="${wiz.modo === k ? 'true' : 'false'}"><b>${n}</b><small>${t}</small></button>`).join('')}`;
    if (p === 'metas') cuerpo = `<h2>Tus metas (opcional)</h2><p class="muted">Dejá vacío lo que no quieras fijar. Si no sabés qué poner, consultalo con tu profesional.</p><form data-f="wizmetas">
      ${wiz.mods.agua ? campoNum('metaAgua', 'Agua por día (ml)', s.metaAgua, 'Ej: 2000') : ''}${wiz.mods.pasos ? campoNum('metaPasos', 'Pasos por día', s.metaPasos, 'Ej: 8000') : ''}${wiz.mods.actividad ? campoNum('aeroMeta', 'Actividad aeróbica (min por semana)', s.aeroMeta, 'Ej: 150') : ''}</form>`;
    if (p === 'listo') {
      const act = MODULOS.filter(([k]) => wiz.mods[k]).map(([, ic, n]) => `${ic} ${n}`);
      cuerpo = `<h2>¡Listo!</h2><div class="card"><p>${act.length ? 'Vas a seguir: <b>' + act.join(', ') + '</b>.' : 'No elegiste nada para seguir todavía: podés activarlo cuando quieras en Ajustes.'}</p><p>Modo: <b>${esc(MODOS.find(m => m[0] === wiz.modo)[1])}</b>.</p></div><p class="muted">Todo se puede cambiar después en Ajustes.</p>`;
    }
    return `<div class="wizard"><small>Paso ${i + 1} de ${ps.length}</small><div class="bar"><i style="width:${Math.round((i + 1) / ps.length * 100)}%"></i></div>${cuerpo}
      <div class="row" style="margin-top:14px">${i > 0 ? '<button class="ghost grow" data-a="wiz-atras">Atrás</button>' : ''}${p === 'listo' ? '<button class="pri grow" data-a="wiz-fin">Empezar</button>' : '<button class="pri grow" data-a="wiz-sig">Siguiente</button>'}</div>
      ${p === 'listo' ? '' : '<div class="row" style="margin-top:8px"><button class="ghost grow" data-a="wiz-fin">Saltar y configurar después</button></div>'}</div>`;
  }

  /* ---------- Pasos: acelerómetro (web) y sensor del teléfono (Android) ---------- */
  const conTiempo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('tiempo agotado')), ms))]);
  const refreshPasos = () => { if (tab === 'habitos' || tab === 'hoy') render(); };
  const step = { on: false, filt: 9.8, above: false, last: 0, wake: null };
  function detectStep(m, t) {
    step.filt = step.filt * 0.92 + m * 0.08;
    const d = m - step.filt, thr = S.settings.umbral;
    if (!step.above && d > thr && t - step.last > 300) { step.above = true; step.last = t; return true; }
    if (step.above && d < thr * 0.4) step.above = false;
    return false;
  }
  function onMotion(e) {
    const a = e.accelerationIncludingGravity; if (!a) return;
    const m = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    if (detectStep(m, Date.now())) { day().pasos = (day().pasos || 0) + 1; saveSoon(); const el = $('#pasosNum'); if (el) el.textContent = day().pasos; }
  }
  async function toggleMotion() {
    if (step.on) { window.removeEventListener('devicemotion', onMotion); step.on = false; try { step.wake && step.wake.release(); } catch (e) { /* nada */ } step.wake = null; save(); render(); return; }
    if (typeof window.DeviceMotionEvent === 'undefined') { toast('Este dispositivo no tiene acelerómetro accesible'); return; }
    try { if (typeof window.DeviceMotionEvent.requestPermission === 'function') { const r = await window.DeviceMotionEvent.requestPermission(); if (r !== 'granted') { toast('Permiso de movimiento denegado'); return; } } } catch (e) { toast('No se pudo pedir el permiso de movimiento'); return; }
    window.addEventListener('devicemotion', onMotion); step.on = true;
    try { if (navigator.wakeLock) step.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* opcional */ }
    render();
  }
  // El hardware cuenta los pasos todo el día, con la app cerrada. Al abrirla se suma la diferencia desde la última lectura.
  const sensor = { on: false, msg: 'Tocá "Activar contador de pasos" para empezar.', last: 0 };
  function acreditar(l) { // l = {t: hora, c: contador, b: arranque del teléfono}; suma la diferencia al día de esa hora
    if (S.sensor && l.t < S.sensor.t) return;
    let delta;
    if (!S.sensor) { const m0 = new Date(l.t); m0.setHours(0, 0, 0, 0); delta = l.b >= m0.getTime() - 60000 ? l.c : 0; } // si el teléfono se encendió ese día, todo lo contado es de ese día
    else delta = l.c >= S.sensor.last ? l.c - S.sensor.last : l.c; // si bajó, el teléfono se reinició
    const antes = S.sensor ? S.sensor.t : null;
    S.sensor = { last: l.c, t: l.t };
    if (!(delta > 0 && delta < 60000)) return;
    const parte = antes && antes < l.t ? repartirPasos(antes, l.t, delta) : { [ymd(new Date(l.t))]: delta };
    Object.keys(parte).forEach(k => { if (parte[k] > 0) { const d = day(k); d.pasos = (d.pasos || 0) + parte[k]; } });
  }
  /* Si entre dos lecturas se cruzó la medianoche (el teléfono estuvo sin lecturas de noche), los pasos no son todos del día nuevo:
     se reparten según las horas "de actividad" (7 a 23) de cada día dentro del intervalo; si todo el intervalo es de noche, según el tiempo. */
  function repartirPasos(t0, t1, delta) {
    const ini = new Date(t0); ini.setHours(0, 0, 0, 0);
    const dias = []; for (let d = ini; d.getTime() <= t1 && dias.length < 9; d = sumarDias(d, 1)) dias.push(d);
    if (dias.length < 2 || dias.length > 8) return { [ymd(new Date(t1))]: delta };
    const h = (d, x) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), x).getTime(), sol = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    let w = dias.map(d => sol(t0, t1, h(d, 7), h(d, 23)));
    if (!w.some(x => x > 0)) w = dias.map(d => sol(t0, t1, h(d, 0), h(d, 24)));
    const tot = w.reduce((a, b) => a + b, 0), out = {}; let dado = 0, acum = 0;
    dias.forEach((d, i) => { acum += w[i]; const hasta = i === dias.length - 1 ? delta : Math.round(delta * acum / tot); out[ymd(d)] = hasta - dado; dado = hasta; });
    return out;
  }
  async function aplicarSegundoPlano(P) { try { if (S.settings.segundoPlano) await P.startBackground(); else await P.stopBackground(); } catch (e) { /* sin segundo plano */ } }
  async function syncSensor(pedir) {
    if (!NATIVE || !mod('pasos')) return;
    const P = plug('StepCounter');
    if (!P) { sensor.msg = 'Esta versión de la app no tiene el contador de pasos.'; return refreshPasos(); }
    try {
      if (!(await conTiempo(P.isAvailable(), 10000)).available) { sensor.on = false; sensor.msg = 'Este teléfono no tiene sensor contador de pasos. Podés cargar los pasos a mano.'; return refreshPasos(); }
      let g = (await conTiempo(P.hasPermission(), 10000)).granted;
      if (!g && pedir) { sensor.msg = 'Pidiendo permiso de actividad física…'; refreshPasos(); g = (await conTiempo(P.ensurePermission(), 120000)).granted; }
      if (!g && pedir) { S.settings.pasosRechazos = (S.settings.pasosRechazos || 0) + 1; save(); }
      if (g) { S.settings.pasosRechazos = 0; }
      if (!g) { sensor.on = false; sensor.msg = pedir ? 'No diste el permiso. Activalo en Ajustes del teléfono → Apps → A Mi Ritmo → Permisos → Actividad física.' : 'Tocá "Activar contador de pasos" para empezar.'; return refreshPasos(); }
      let lecturas = [];
      try { lecturas = ((await conTiempo(P.drain(), 10000)).readings || []).filter(l => l && Number.isFinite(l.t) && Number.isFinite(l.c)); } catch (e) { /* sin lecturas en segundo plano */ }
      const r = await conTiempo(P.read(), 15000);
      lecturas.push({ t: Date.now(), c: Math.round(r.counter), b: r.bootTime });
      lecturas.sort((a, b) => a.t - b.t).forEach(acreditar);
      await aplicarSegundoPlano(P);
      sensor.on = true; sensor.last = Date.now(); sensor.msg = '';
      save(); refreshPasos();
    } catch (e) { sensor.on = false; sensor.msg = `No se pudo leer el contador de pasos (${esc((e && (e.message || e)) || 'error')}).`; refreshPasos(); }
  }
  // Con el módulo de pasos activado, la app pide sola el permiso de actividad física al abrirse hasta que lo den
  // (si lo rechazan dos veces deja de insistir: queda el botón en Hoy y en Hábitos).
  async function iniciarPasos() {
    if (!NATIVE || !mod('pasos')) return;
    await syncSensor((S.settings.pasosRechazos || 0) < 2);
  }
  async function toggleSegundoPlano() {
    S.settings.segundoPlano = !S.settings.segundoPlano; save();
    const P = plug('StepCounter'); if (P) await aplicarSegundoPlano(P);
    toast(S.settings.segundoPlano ? 'Actualización en segundo plano activada' : 'Actualización en segundo plano detenida'); render();
  }

  /* ---------- Respaldo ---------- */
  async function compartirArchivo(nombre, texto, titulo, dialogo) {
    const F = plug('Filesystem'), Sh = plug('Share');
    const r = await F.writeFile({ path: nombre, data: texto, directory: 'CACHE', encoding: 'utf8' }); // en el APK no hay descargas del navegador: se guarda en la caché y se abre el menú de compartir
    await Sh.share({ title: titulo, text: titulo, files: [r.uri], dialogTitle: dialogo });
  }
  async function exportar() {
    const json = JSON.stringify(S, null, 2), nombre = `a-mi-ritmo-respaldo-${hoy()}.json`;
    try {
      if (NATIVE && plug('Filesystem') && plug('Share')) { await compartirArchivo(nombre, json, 'Respaldo de A Mi Ritmo', 'Guardar el respaldo en…'); marcarRespaldo(); toast('Elegí dónde guardarlo: Drive, correo o WhatsApp'); }
      else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); marcarRespaldo(); toast('Respaldo exportado');
      }
      render();
    } catch (e) { toast('No se pudo exportar. Probá "Copiar respaldo".'); }
  }
  async function copiarRespaldo() {
    try { await navigator.clipboard.writeText(JSON.stringify(S, null, 2)); marcarRespaldo(); toast('Respaldo copiado: pegalo en una nota o en un mensaje a vos mismo'); render(); } catch (e) { toast('No se pudo copiar'); }
  }
  /* ---------- Importar el respaldo de "Salud Activa" (la app personal anterior) ---------- */
  /* ---------- Traer saturación y pulso de un reloj o pulsera (Health Connect, Android) ---------- */
  const ORIGEN_SALUD = { 'com.sec.android.app.shealth': 'Samsung Health', 'com.google.android.apps.fitness': 'Google Fit', 'com.google.android.apps.healthdata': 'Health Connect', 'com.xiaomi.wearable': 'Xiaomi', 'com.huawei.health': 'Huawei Health', 'com.fitbit.FitbitMobile': 'Fitbit', 'com.garmin.android.apps.connectmobile': 'Garmin' };
  // r = { spo2: [{id, t, v, pul?, origen}], pulso: [{id, t, v, origen}] }; no repite lecturas ya traídas (se reconocen por su id) ni inventa nada.
  function fusionarSalud(r) {
    const out = { spo2: 0, pulso: 0, repetidos: 0, invalidos: 0 };
    const asegurar = tipo => {
      let m = S.medidas.find(x => x.tipo === tipo);
      if (!m) { m = nuevaMedida(tipo); m.id = 'm_' + tipo; if (S.medidas.some(x => x.id === m.id)) m.id = uid('m'); S.medidas.push(m); S.modulos.medidas = true; }
      return S.registros[m.id] = S.registros[m.id] || [];
    };
    const hora = t => `${pad(new Date(t).getHours())}:${pad(new Date(t).getMinutes())}`, nombre = o => ORIGEN_SALUD[o] || String(o || 'Health Connect').slice(0, 40);
    const num = x => (x === null || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
    const lista = (arr, tipo, armar) => (Array.isArray(arr) ? arr : []).forEach(x => {
      if (!esObjeto(x) || !x.id || !Number.isFinite(x.t)) { out.invalidos++; return; }
      const q = armar(x); if (!q) { out.invalidos++; return; }
      const regs = asegurar(tipo);
      if (regs.some(y => y && y.hc === String(x.id))) { out.repetidos++; return; }
      regs.push(Object.assign({ fecha: ymd(new Date(x.t)), hora: hora(x.t) }, q, { hc: String(x.id), origen: nombre(x.origen) })); out[tipo === 'spo2' ? 'spo2' : 'pulso']++;
    });
    lista(r && r.spo2, 'spo2', x => { const v = num(x.v); if (!(v >= 50 && v <= 100)) return null; const p = num(x.pul); return Object.assign({ sat: Math.round(v) }, p >= 25 && p <= 250 ? { pul: Math.round(p) } : {}); });
    lista(r && r.pulso, 'pulso', x => { const v = num(x.v); return v >= 25 && v <= 250 ? { pul: Math.round(v) } : null; });
    return out;
  }
  let importandoSalud = false;
  async function importarSalud(manual) {
    const P = plug('HealthSync'); if (!P) return manual && toast('Esto funciona solo en la app de Android.');
    if (importandoSalud) return; importandoSalud = true;
    try {
      const est = (await conTiempo(P.isAvailable(), 10000)).status;
      if (est !== 'available') { if (manual) toast(est === 'update' ? 'Actualizá Health Connect desde Play Store y probá de nuevo.' : 'Instalá Health Connect desde Play Store (es gratis) para traer los datos de tu reloj.'); return; }
      let p = await conTiempo(P.hasPermission(), 15000);
      if (!p.granted && manual) p = await conTiempo(P.requestPermission(), 180000);
      if (!p.granted) { if (manual) toast('Faltan permisos: en Health Connect permití a A Mi Ritmo leer saturación y pulso.'); return; }
      const hasta = Date.now(), desde = S.settings.hcUltimo ? S.settings.hcUltimo - 86400e3 : hasta - 30 * 86400e3;   // la primera vez trae el último mes
      const r = await conTiempo(P.leer({ desde, hasta }), 60000), n = fusionarSalud(r);
      S.settings.hcUltimo = hasta; if (manual) S.settings.hcAuto = true;
      changed();
      if (manual) toast(n.spo2 + n.pulso ? `Se sumaron ${n.spo2} ${n.spo2 === 1 ? 'saturación' : 'saturaciones'} y ${n.pulso} pulso${n.pulso === 1 ? '' : 's'}.` : (n.repetidos ? 'No hay datos nuevos desde la última vez.' : 'No encontré datos de saturación ni de pulso en tu reloj. Revisá que lo guarde en Health Connect.'));
    } catch (e) { if (manual) toast('No se pudieron traer los datos: ' + esc((e && (e.message || e)) || 'error')); }
    finally { importandoSalud = false; }
  }
  const SA_RUTINA = [['giros', 'Giros de cadera', 30, 'Círculos amplios pero suaves, sin forzar la zona lumbar.'], ['brazos', 'Estiramiento de brazos a los costados', 10, 'Respirá con normalidad, sin aguantar el aire.'], ['piernas', 'Flexiones de piernas', 15, 'Rodillas alineadas con la punta de los pies.'],
    ['aperturas', 'Aperturas de brazos y espalda', 15, 'Abrí el pecho llevando los omóplatos hacia atrás, sin arquear la zona lumbar.'], ['rodillas', 'Levantamiento de rodillas', 20, 'Torso erguido, ritmo cómodo.'], ['agacharse', 'Agacharse (arriba y abajo)', 10, 'Doblá caderas y rodillas con la espalda recta; no dobles la cintura.']];
  const SA_CORE = [['gato', 'Gato-camello', 2, 8, 0, 'En cuatro apoyos, redondeá y arqueá la espalda despacio, solo hasta donde no duela.'], ['bird', 'Bird-dog (brazo y pierna opuestos)', 2, 6, 0, 'Estirá brazo y pierna contrarios, mantené 3-5 s con la pelvis quieta.'],
    ['deadbug', 'Dead bug', 2, 6, 0, 'Boca arriba, zona lumbar apoyada; bajá brazo y pierna contrarios sin despegarla.'], ['puente', 'Puente de glúteos', 2, 8, 0, 'Subí la cadera apretando glúteos; no arquees la zona lumbar al subir.'],
    ['lateral', 'Plancha lateral (rodillas apoyadas)', 2, 0, 15, 'Cuerpo en línea, hombro sobre el codo. Respirá, no aguantes el aire.'], ['plancha', 'Plancha corta', 2, 0, 15, 'Podés apoyar las rodillas. Abdomen firme, sin hundir la cintura.']];
  const esCopiaSaludActiva = r => esObjeto(r) && esObjeto(r.days) && !Array.isArray(r.medidas) && ['peso', 'presion', 'colesterol', 'spo2', 'aero'].some(k => Array.isArray(r[k]));
  function desdeSaludActiva(r) {
    const d = DEFAULTS(), o = esObjeto(r.settings) ? r.settings : {}, num = x => (Number.isFinite(Number(x)) && x !== null && x !== '' ? Number(x) : null);
    const lista = k => (Array.isArray(r[k]) ? r[k].filter(esObjeto) : []), plan = esObjeto(r.plan) ? r.plan : {};
    const fechaDeTs = ts => (Number.isFinite(ts) ? ymd(new Date(ts)) : null), horaDeTs = ts => (Number.isFinite(ts) ? `${pad(new Date(ts).getHours())}:${pad(new Date(ts).getMinutes())}` : '');
    d.listo = true; d.modo = 'avisos'; Object.keys(d.modulos).forEach(k => { d.modulos[k] = true; });
    // ejercicios (ids con prefijo para que los registros diarios sigan apuntando a cada uno)
    SA_RUTINA.forEach(([id, n, meta, tip]) => { const p = esObjeto(plan[id]) ? plan[id] : {}; d.ejercicios.push({ id: 'r_' + id, n, tipo: 'reps', meta: num(p.meta) > 0 ? num(p.meta) : meta, nota: tip, fig: id }); });
    SA_CORE.forEach(([id, n, ser, reps, seg, tip]) => { const p = esObjeto(plan[id]) ? plan[id] : {}, series = num(p.series) > 0 ? num(p.series) : ser;
      d.ejercicios.push(seg ? { id: 'c_' + id, n, tipo: 'tiempo', series, seg: num(p.seg) > 0 ? num(p.seg) : seg, nota: tip, fig: id } : { id: 'c_' + id, n, tipo: 'series', series, reps: num(p.reps) > 0 ? num(p.reps) : reps, nota: tip, fig: id }); });
    const dias = (x, def) => (Array.isArray(x) ? x.filter(v => Number.isInteger(v) && v >= 0 && v <= 6) : def);
    d.sesiones = [{ id: 'ses_rutina', n: 'Rutina matutina', dias: dias(o.agRutDias, [0, 1, 2, 3, 4, 5, 6]), hora: o.agRutOn !== false && horaOk(o.agRutHora) ? o.agRutHora : '', ej: SA_RUTINA.map(x => 'r_' + x[0]) },
      { id: 'ses_core', n: 'Espalda y core', dias: dias(o.agCoreDias, [1, 3, 5]), hora: o.agCoreOn !== false && horaOk(o.agCoreHora) ? o.agCoreHora : '', ej: SA_CORE.map(x => 'c_' + x[0]) }];
    if (esObjeto(r.dolor)) Object.keys(r.dolor).forEach(id => { if (r.dolor[id]) d.molestias[SA_RUTINA.some(x => x[0] === id) ? 'r_' + id : 'c_' + id] = true; });
    // mediciones y sus límites (los que ya tenías configurados)
    const med = (tipo, ajustar) => { const m = nuevaMedida(tipo); m.id = 'm_' + tipo; ajustar(m); d.medidas.push(m); return m; };
    const lim = (m, k, mn, mx) => { const c = m.campos.find(x => x.k === k); if (c) { c.min = mn; c.max = mx; } };
    med('presion', m => lim(m, 'sis', null, num(o.pSis) > 1 ? num(o.pSis) - 1 : null) || lim(m, 'dia', null, num(o.pDia) > 1 ? num(o.pDia) - 1 : null));   // Salud Activa avisaba desde el umbral (≥); acá el límite es "por encima de"
    med('peso', m => { if (num(o.pesoObj) != null && num(o.pesoTol) != null) lim(m, 'kg', Math.round((o.pesoObj - o.pesoTol) * 10) / 10, Math.round((o.pesoObj + o.pesoTol) * 10) / 10); });
    med('colesterol', m => { lim(m, 'ldl', null, num(o.ldlMeta)); m.repetirMeses = 2; });
    med('spo2', m => { lim(m, 'sat', num(o.spo2Min), null); if (o.recSpo2 && typeof o.horasSpo2 === 'string') { const h = o.horasSpo2.split(',')[0].trim(); if (horaOk(h)) m.recordarHora = h; } });
    const reg = (id, arr) => { d.registros[id] = arr; };
    reg('m_presion', lista('presion').map(x => { const f = fechaDeTs(x.ts); return f ? Object.assign({ fecha: f, hora: horaDeTs(x.ts), sis: num(x.sis), dia: num(x.dia) }, num(x.pul) != null ? { pul: num(x.pul) } : {}) : null; }).filter(x => x && x.sis != null && x.dia != null));
    reg('m_peso', lista('peso').filter(x => typeof x.fecha === 'string' && num(x.kg) != null).map(x => ({ fecha: x.fecha, kg: num(x.kg) })));
    reg('m_colesterol', lista('colesterol').filter(x => typeof x.fecha === 'string').map(x => { const q = { fecha: x.fecha }; ['ldl', 'hdl', 'total', 'tg'].forEach(k => { if (num(x[k]) != null) q[k] = num(x[k]); }); return q; }));
    reg('m_spo2', lista('spo2').map(x => { const f = fechaDeTs(x.ts); return f && num(x.spo2) != null ? Object.assign({ fecha: f, hora: horaDeTs(x.ts), sat: num(x.spo2) }, num(x.pul) != null ? { pul: num(x.pul) } : {}) : null; }).filter(Boolean));
    d.aero = lista('aero').filter(x => typeof x.fecha === 'string' && num(x.min) > 0).map(x => ({ fecha: x.fecha, min: num(x.min), tipo: typeof x.tipo === 'string' ? x.tipo.slice(0, 40) : '' }));
    // alimentación
    const items = esObjeto(r.comida) && Array.isArray(r.comida.items) ? r.comida.items.filter(x => esObjeto(x) && x.id && x.n) : [];
    d.comida = { items, contadores: [{ id: 'c_pescado', n: 'Pescado azul', meta: num(o.pescadoMeta) > 0 ? num(o.pescadoMeta) : 2 }] };
    // días
    Object.keys(r.days).forEach(k => {
      const x = r.days[k]; if (!esObjeto(x) || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      const y = {}, ej = {};
      if (num(x.pasos) != null) y.pasos = num(x.pasos); if (num(x.agua) != null) y.agua = num(x.agua);
      if (esObjeto(x.rutina)) Object.keys(x.rutina).forEach(id => { if (num(x.rutina[id]) != null) ej['r_' + id] = num(x.rutina[id]); });
      if (esObjeto(x.core)) Object.keys(x.core).forEach(id => { if (num(x.core[id]) != null) ej['c_' + id] = num(x.core[id]); });
      if (Object.keys(ej).length) y.ej = ej;
      if (x.omitido) y.omit = { ses_core: true };
      if (esObjeto(x.comida) && Object.keys(x.comida).length) y.comida = x.comida;
      if (num(x.pescado) > 0) y.cont = { c_pescado: num(x.pescado) };
      if (Object.keys(y).length) d.days[k] = y;
    });
    // ajustes
    const S2 = d.settings;
    ['metaPasos', 'metaAgua', 'vaso', 'aeroMeta'].forEach(k => { if (num(o[k]) > 0) S2[k] = num(o[k]); });
    S2.recAgua = !!o.recAgua; if (num(o.recMin) >= 15) S2.recMin = num(o.recMin); S2.segundoPlano = o.segundoPlano !== false;
    if (typeof o.notas === 'string') S2.notas = o.notas.slice(0, 2000);
    const fechas = Object.keys(d.days).concat(d.registros.m_peso.map(x => x.fecha), d.registros.m_presion.map(x => x.fecha), d.registros.m_colesterol.map(x => x.fecha), d.aero.map(x => x.fecha)).sort();
    S2.creado = fechas[0] || ymd(new Date()); S2.ultimoRespaldo = 0;
    d.importado = { de: 'Salud Activa', fecha: Date.now(), datos: r };   // copia íntegra de lo que se importó, por las dudas
    return d;
  }
  function importar(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const r = JSON.parse(rd.result);
        const deSA = esCopiaSaludActiva(r);
        if (!deSA && (!esObjeto(r) || !esObjeto(r.days) || !Array.isArray(r.medidas))) throw new Error('formato');
        if (!confirm(deSA ? 'Es una copia de Salud Activa. Se convierte a A Mi Ritmo (tu rutina, espalda, presión, peso, colesterol, saturación, actividad y alimentación) y reemplaza los datos actuales de A Mi Ritmo. Tu copia original queda guardada adentro. ¿Continuar?' : 'Esto reemplaza los datos actuales por los de la copia. ¿Continuar?')) return;
        try { const actual = localStorage.getItem(KEY); if (actual) guardarCopia(KEY + '_antes_importar', actual, true); } catch (e) { /* nada */ } // por si se importó el archivo equivocado
        localStorage.setItem(KEY, JSON.stringify(deSA ? desdeSaludActiva(r) : r)); S = load(); save(); wiz = null; if (deSA) tab = 'hoy'; setupReminders(); changed(); toast(deSA ? 'Copia de Salud Activa importada' : 'Copia importada');
      } catch (e) { toast('El archivo no es una copia válida'); }
    };
    rd.readAsText(file);
  }
  function borrarTodo() {
    if (hayDatos() && confirm('Antes de borrar: ¿querés exportar un respaldo? Aceptá para exportarlo (no se borra nada todavía).')) { exportar(); return; }
    if (!confirm('Se borran TODOS tus datos de este dispositivo y no se pueden recuperar. ¿Seguro?')) return;
    if (!confirm('Última confirmación: ¿borrar todo?')) return;
    S = DEFAULTS(); wiz = null; tab = 'hoy'; setupReminders(); changed(); toast('Datos borrados');
  }

  /* ---------- Informe para el médico ---------- */
  function informeCuerpo() {
    const s = S.settings, inf = s.informe, per = inf.periodo, now = new Date();
    const desde = per ? ymd(sumarDias(now, -per)) : '0000-00-00', inc = k => !inf.excluir[k];
    const dias = [];
    { const ini = per ? sumarDias(now, -per) : (Object.keys(S.days).sort()[0] ? fechaLocal(Object.keys(S.days).sort()[0]) : now); for (let d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()); ymd(d) <= hoy() && dias.length < 800; d = sumarDias(d, 1)) dias.push(ymd(d)); }
    const tabla = (cab, filas) => `<table><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${filas.map(f => `<tr>${f.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cab.length}">Sin registros</td></tr>`}</table>`;
    const prom = arr => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    let h = `<h1>Informe de salud — ${fmtFecha(hoy())}</h1><p>Período: ${per ? 'últimos ' + per + ' días' : 'todo lo registrado'}. Registros hechos por la propia persona con la app A Mi Ritmo.</p>`;
    if ((s.notas || '').trim()) h += `<h3>Indicaciones de mi profesional (anotadas por mí)</h3><p>${esc(s.notas).replace(/\n/g, '<br>')}</p>`;
    if (mod('medidas')) S.medidas.filter(m => inc('medida:' + m.id)).forEach(m => {
      const rows = regsOrd(m).filter(r => r.fecha >= desde), todas = regsOrd(m);
      const lim = m.campos.filter(c => c.min != null || c.max != null).map(c => `${c.n}: ${c.min != null ? 'mín. ' + fmtNum(c.min, c.dec) : ''}${c.min != null && c.max != null ? ' / ' : ''}${c.max != null ? 'máx. ' + fmtNum(c.max, c.dec) : ''}`);
      h += `<h3>${esc(m.n)}</h3><p>${lim.length ? 'Límites definidos por la persona o su profesional — ' + esc(lim.join('; ')) + '.' : 'Sin límites definidos.'}</p>`;
      h += tabla(['Fecha'].concat(m.campos.map(c => c.n + (c.u ? ' (' + c.u + ')' : ''))), rows.slice(0, 20).map(r => { const idx = todas.findIndex(x => x.i === r.i); return [fmtFecha(r.fecha)].concat(m.campos.map(c => (r[c.k] == null ? '-' : fmtNum(r[c.k], c.dec) + (anterior(todas, idx, c.k) ? ' (' + fmtPct(variacion(todas, idx, c.k)) + ')' : '')))); }));
      h += '<p class="peque">Entre paréntesis: variación porcentual contra el registro anterior de ese valor.</p>';
      m.campos.filter(c => rows.filter(r => r[c.k] != null).length >= 2).slice(0, 4).forEach(c => {
        const band = c.min != null && c.max != null ? [c.min, c.max] : null, lines = band ? [] : [c.min != null ? { v: c.min, label: 'Mín ' + fmtNum(c.min, c.dec) } : null, c.max != null ? { v: c.max, label: 'Máx ' + fmtNum(c.max, c.dec) } : null].filter(Boolean);
        h += chart([{ name: c.n, pts: rows.filter(r => r[c.k] != null).slice(0, 30).map(r => ({ t: tsFecha(r.fecha), v: r[c.k] })) }], { label: 'Evolución de ' + c.n + ' (' + m.n + ')', band, lines, dec: c.dec || 0 });
      });
    });
    if (mod('medidas') && S.medidas.some(m => (S.registros[m.id] || []).some(r => r && r.hc))) h += '<p class="peque">Algunas lecturas de saturación o pulso fueron importadas de un reloj o pulsera (Health Connect): son estimaciones y no reemplazan un saturómetro.</p>';
    if (mod('ejercicio') && inc('ejercicio')) {
      let prog = 0, hechas = 0;
      dias.forEach(k => sesionesDelDia(fechaLocal(k)).forEach(se => { if (ejDeSesion(se).length) { prog++; if (sesionHecha(se, k)) hechas++; } }));
      h += `<h3>Ejercicio</h3><p>Plan: ${S.sesiones.map(se => `${esc(se.n)} (${esc(fmtDiasSes(se.dias || []))}): ${ejDeSesion(se).map(e => esc(e.n) + ' ' + esc(dosisEj(e))).join('; ') || 'sin ejercicios'}`).join(' · ') || 'sin plan'}.</p><p>Rutinas completas: <b>${hechas}</b> de ${prog} programadas en el período${prog ? ' (' + Math.round(hechas / prog * 100) + ' %)' : ''}.</p>`;
    }
    if (mod('pasos') && inc('pasos')) { const v = dias.map(k => peek(k).pasos).filter(x => x > 0); h += `<h3>Pasos</h3><p>${v.length ? `Promedio de ${prom(v)} pasos por día (${v.length} días con registro)${s.metaPasos ? ', meta ' + s.metaPasos : ''}.` : 'Sin registros.'}</p>`; }
    if (mod('agua') && inc('agua')) { const v = dias.map(k => peek(k).agua).filter(x => x > 0); h += `<h3>Agua</h3><p>${v.length ? `Promedio de ${prom(v)} ml por día (${v.length} días con registro)${s.metaAgua ? ', meta ' + s.metaAgua + ' ml' : ''}.` : 'Sin registros.'}</p>`; }
    if (mod('actividad') && inc('actividad')) { const a = promedioAero(); h += `<h3>Actividad aeróbica</h3><p>${a ? `Promedio semanal: <b>${a.prom} min</b> (${a.semanas} semanas con registros)${s.aeroMeta ? ', meta ' + s.aeroMeta + ' min' : ''}.` : 'Sin registros.'}</p>${tabla(['Semana del', 'Minutos'], semanasAero(8).reverse().map(w => [fmtFecha(w.k), w.min]))}`; }
    if (mod('comida') && inc('comida')) {
      h += `<h3>Alimentación (checklist)</h3><p>Ítems: ${S.comida.items.map(it => esc(it.n)).join('; ') || 'ninguno'}.</p>${tabla(['Semana', 'Cumplimiento'].concat(S.comida.contadores.map(c => c.n)), [3, 2, 1, 0].map(n => { const l = sumarDias(lunesDe(now), -7 * n), c = cumplimientoSemana(l); return [`Semana del ${fmtDia(l)}`, c.pct === null ? '-' : c.pct + ' %'].concat(S.comida.contadores.map(ct => String(c.cont[ct.id] || 0) + (ct.meta ? ' de ' + ct.meta : ''))); }))}`;
    }
    return h + '<p class="peque">Este informe resume registros hechos por el usuario; no reemplaza estudios ni indicaciones médicas.</p>';
  }
  const ESTILO_INFORME = 'body{font:14px/1.4 system-ui,sans-serif;color:#000;max-width:720px;margin:16px auto;padding:0 12px}h1{font-size:20px}h3{margin:16px 0 4px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #888;padding:4px 6px;text-align:left}.peque{font-size:11px;color:#444}.chart{width:100%;max-width:520px;height:auto}.axis{stroke:#888}.tick{fill:#444;font-size:9px}.line{fill:none;stroke-width:2;stroke:#1d4ed8}.dot{fill:#1d4ed8}.goal{stroke:#c2410c;stroke-width:1.5;stroke-dasharray:5 3}.goalTxt{fill:#c2410c}.band{fill:#e4ebff}';
  async function informe() {
    const s = S.settings.informe, per = Number($('#inf_periodo') ? $('#inf_periodo').value : s.periodo);
    s.periodo = [0, 30, 90, 180, 365].includes(per) ? per : 90;
    if (document.querySelector('.inf-inc')) { s.excluir = {}; document.querySelectorAll('.inf-inc').forEach(c => { if (!c.checked) s.excluir[c.value] = true; }); }
    save();
    const cuerpo = informeCuerpo();
    if (NATIVE && plug('Filesystem') && plug('Share')) {
      try { await compartirArchivo(`informe-salud-${hoy()}.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe de salud</title><style>${ESTILO_INFORME}</style></head><body>${cuerpo}</body></html>`, 'Informe de salud (abrilo con el navegador para imprimirlo o guardarlo como PDF)', 'Enviar el informe a…'); }
      catch (e) { toast('No se pudo preparar el informe'); }
      return;
    }
    $('#informe').innerHTML = cuerpo; document.body.classList.add('printing');
    window.onafterprint = () => document.body.classList.remove('printing');
    try { window.print(); } catch (e) { document.body.classList.remove('printing'); }
  }

  /* ---------- Edición del plan (ventanas) ---------- */
  const TIPOS_EJ = [['reps', 'Repeticiones (un total)'], ['series', 'Series × repeticiones'], ['tiempo', 'Series × segundos']];
  const sesionOpts = () => S.sesiones.map(s => [s.id, s.n]);
  function asegurarSesion(id) {
    let s = id && sesPorId(id);
    if (!s) { s = S.sesiones[0]; }
    if (!s) { s = { id: uid('s'), n: 'Mi rutina', dias: ORDEN_DIAS.slice(), hora: '', ej: [] }; S.sesiones.push(s); }
    return s;
  }
  function modalEjercicio(e) {
    const ses = e ? S.sesiones.find(s => (s.ej || []).includes(e.id)) : null;
    const campos = [
      { k: 'n', t: 'text', l: 'Nombre del ejercicio', v: e ? e.n : '', req: true },
      { k: 'tipo', t: 'select', l: '¿Cómo se mide?', v: e ? e.tipo : 'reps', opts: TIPOS_EJ },
      { k: 'meta', t: 'number', l: 'Repeticiones en total (si es "Repeticiones")', v: e ? e.meta : '', min: 1 },
      { k: 'series', t: 'number', l: 'Series (si es "Series × …")', v: e ? e.series : '', min: 1 },
      { k: 'reps', t: 'number', l: 'Repeticiones por serie', v: e ? e.reps : '', min: 1 },
      { k: 'seg', t: 'number', l: 'Segundos por serie', v: e ? e.seg : '', min: 1 },
      { k: 'nota', t: 'text', l: 'Nota (opcional)', v: e ? e.nota : '', ph: 'Ej: despacio, sin aguantar el aire' }
    ];
    if (S.sesiones.length) campos.push({ k: 'ses', t: 'select', l: 'Rutina', v: ses ? ses.id : S.sesiones[0].id, opts: sesionOpts() });
    abrirModal(e ? 'Editar ejercicio' : 'Nuevo ejercicio', campos, v => {
      if (!v.n) return 'Poné un nombre.';
      const o = { id: e ? e.id : uid('e'), fig: e && e.fig, n: v.n, tipo: v.tipo, nota: v.nota };
      if (v.tipo === 'reps') { if (!(v.meta >= 1 && v.meta <= 999)) return 'Las repeticiones deben estar entre 1 y 999.'; o.meta = Math.round(v.meta); }
      else {
        if (!(v.series >= 1 && v.series <= 20)) return 'Las series deben estar entre 1 y 20.'; o.series = Math.round(v.series);
        if (v.tipo === 'series') { if (!(v.reps >= 1 && v.reps <= 999)) return 'Las repeticiones por serie deben estar entre 1 y 999.'; o.reps = Math.round(v.reps); }
        else { if (!(v.seg >= 1 && v.seg <= 3600)) return 'Los segundos deben estar entre 1 y 3600.'; o.seg = Math.round(v.seg); }
      }
      if (!o.fig) delete o.fig;
      if (e) { const i = S.ejercicios.findIndex(x => x.id === e.id); S.ejercicios[i] = o; S.sesiones.forEach(s => { s.ej = (s.ej || []).filter(x => x !== e.id); }); } else S.ejercicios.push(o);
      asegurarSesion(v.ses).ej.push(o.id);
      return undefined;
    });
  }
  function modalSesion(s) {
    abrirModal(s ? 'Editar rutina' : 'Nueva rutina', [
      { k: 'n', t: 'text', l: 'Nombre de la rutina', v: s ? s.n : '', req: true, ph: 'Ej: Mañana, Espalda, Piernas' },
      { k: 'dias', t: 'dias', l: 'Días', v: s ? s.dias : [1, 3, 5] },
      { k: 'hora', t: 'time', l: 'Hora del recordatorio (opcional)', v: s ? s.hora : '', ayuda: 'Solo avisa si tu modo de uso incluye recordatorios.' }
    ], v => {
      if (!v.n) return 'Poné un nombre.';
      if (!v.dias.length) return 'Elegí al menos un día.';
      if (v.hora && !horaOk(v.hora)) return 'La hora no es válida.';
      if (s) { s.n = v.n; s.dias = v.dias; s.hora = v.hora; } else S.sesiones.push({ id: uid('s'), n: v.n, dias: v.dias, hora: v.hora, ej: [] });
      setupReminders(); return undefined;
    });
  }
  function modalBiblioteca() {
    const campos = [{ k: 'sel', t: 'checks', l: 'Elegí los ejemplos que quieras sumar', v: [], opts: BIBLIOTECA.map((b, i) => [String(i), `${grupoBib(b) === 'espalda' ? 'Espalda · ' : ''}${b.n} — ${dosisEj(b)}`]) },
      { k: 'ses', t: 'select', l: 'Sumarlos a', v: '__auto', opts: [['__auto', 'Ordenar solo: general / espalda y core (recomendado)']].concat(sesionOpts()) }];
    abrirModal('Ejercicios de ejemplo', campos, v => {
      if (!v.sel.length) return 'Elegí al menos uno.';
      const antes = S.sesiones.length, nuevas = [];
      v.sel.map(Number).forEach(i => { const b = BIBLIOTECA[i]; if (!b) return; agregarEjemplo(b, v.ses === '__auto' ? rutinaDeGrupo(grupoBib(b)) : asegurarSesion(v.ses)); });
      S.sesiones.slice(antes).forEach(se => nuevas.push(`"${se.n}" (${fmtDiasSes(se.dias)})`));
      if (nuevas.length) setTimeout(() => toast(`Armé ${nuevas.join(' y ')}. Cambiá días y horario con "Editar rutina".`), 50);
      return undefined;
    }, 'Son ejemplos suaves, no una indicación: consultalos con tu profesional.');
  }
  const nuevaMedida = (tipo, nombre) => ({ id: uid('m'), tipo, n: nombre || CATALOGO[tipo].n, campos: CATALOGO[tipo].campos.map(c => Object.assign({}, c, { min: null, max: null })), repetirMeses: null, recordarHora: '' });
  function modalMedidaNueva() {
    abrirModal('Agregar medición', [
      { k: 'tipo', t: 'select', l: 'Qué querés medir', v: 'presion', opts: Object.keys(CATALOGO).map(k => [k, CATALOGO[k].n]) },
      { k: 'n', t: 'text', l: 'Nombre (solo para "Otra medición")', v: '', ph: 'Ej: Perímetro de cintura' },
      { k: 'u', t: 'text', l: 'Unidad (solo para "Otra medición")', v: '', ph: 'Ej: cm' }
    ], v => {
      if (!CATALOGO[v.tipo]) return 'Elegí una medición.';
      if (v.tipo === 'propia' && !v.n) return 'Poné un nombre para tu medición.';
      const m = nuevaMedida(v.tipo, v.tipo === 'propia' ? v.n : ''); if (v.tipo === 'propia') m.campos[0].u = v.u.slice(0, 12);
      S.medidas.push(m); subM = m.id; return undefined;
    });
  }
  function modalMedidaConf(m) {
    const campos = [{ k: 'n', t: 'text', l: 'Nombre', v: m.n, req: true }];
    if (m.tipo === 'propia') campos.push({ k: 'u', t: 'text', l: 'Unidad', v: m.campos[0].u });
    m.campos.forEach(c => { campos.push({ k: 'min_' + c.k, t: 'number', l: `${c.n}: mínimo${c.u ? ' (' + c.u + ')' : ''}`, v: c.min }); campos.push({ k: 'max_' + c.k, t: 'number', l: `${c.n}: máximo${c.u ? ' (' + c.u + ')' : ''}`, v: c.max }); });
    campos.push({ k: 'rep', t: 'number', l: 'Repetir cada (meses) — opcional', v: m.repetirMeses, min: 1, ayuda: 'Te muestra la fecha sugerida 14 días antes (solo con la app abierta).' });
    campos.push({ k: 'hora', t: 'time', l: 'Recordatorio diario para medirte (opcional)', v: m.recordarHora, ayuda: 'Solo si tu modo de uso incluye recordatorios.' });
    abrirModal('Configurar ' + m.n, campos, v => {
      if (!v.n) return 'Poné un nombre.';
      for (const c of m.campos) { const a = v['min_' + c.k], b = v['max_' + c.k]; if (a != null && b != null && a > b) return `En "${c.n}", el mínimo no puede ser mayor que el máximo.`; }
      if (v.rep != null && !(v.rep >= 1 && v.rep <= 36)) return 'Repetir cada: entre 1 y 36 meses.';
      if (v.hora && !horaOk(v.hora)) return 'La hora no es válida.';
      m.n = v.n; if (m.tipo === 'propia') m.campos[0].u = v.u.slice(0, 12);
      m.campos.forEach(c => { c.min = v['min_' + c.k]; c.max = v['max_' + c.k]; });
      m.repetirMeses = v.rep == null ? null : Math.round(v.rep); m.recordarHora = v.hora; setupReminders(); return undefined;
    }, 'Los límites son opcionales. Si los ponés, los define tu profesional, no la app.');
  }
  function modalTexto(titulo, etiqueta, valor, onOk) {
    abrirModal(titulo, [{ k: 'n', t: 'text', l: etiqueta, v: valor, req: true }], v => (v.n ? onOk(v.n) : 'Escribí un texto.'));
  }
  // Recordatorios propios: lo que la persona quiera que le recuerde, a la hora y los días que elija.
  function modalRecordatorio(r) {
    abrirModal(r ? 'Editar recordatorio' : 'Nuevo recordatorio', [
      { k: 'txt', t: 'text', l: 'Qué querés que te recuerde', v: r ? r.txt : '', req: true, ph: 'Ej: Comer una fruta, tomar la medicación, estirar' },
      { k: 'hora', t: 'time', l: 'A qué hora', v: r ? r.hora : '', req: true },
      { k: 'dias', t: 'dias', l: 'Qué días', v: r ? r.dias : [0, 1, 2, 3, 4, 5, 6] }
    ], v => {
      v.txt = limpiar(v.txt).slice(0, 80);
      if (!v.txt) return 'Escribí qué querés que te recuerde.';
      if (!horaOk(v.hora)) return 'Elegí una hora válida.';
      if (!v.dias.length) return 'Elegí al menos un día.';
      if (r) { r.txt = v.txt; r.hora = v.hora; r.dias = v.dias; } else S.recordatorios.push({ id: uid('r'), txt: v.txt, hora: v.hora, dias: v.dias });
      if (S.modo === 'registro' && confirm('Para que suene, tu modo de uso tiene que incluir recordatorios. ¿Lo activo ahora?')) S.modo = 'recordatorios';
      setupReminders(); return undefined;
    }, 'En el celular (app Android) suena aunque la app esté cerrada.');
  }
  function modalContador(c) {
    abrirModal(c ? 'Editar contador semanal' : 'Nuevo contador semanal', [
      { k: 'n', t: 'text', l: 'Qué contás', v: c ? c.n : '', req: true, ph: 'Ej: Pescado, Legumbres, Fruta' },
      { k: 'meta', t: 'number', l: 'Meta por semana (opcional)', v: c ? c.meta : null, min: 1 }
    ], v => {
      if (!v.n) return 'Poné un nombre.';
      if (v.meta != null && !(v.meta >= 1 && v.meta <= 99)) return 'La meta debe estar entre 1 y 99.';
      if (c) { c.n = v.n; c.meta = v.meta == null ? null : Math.round(v.meta); } else S.comida.contadores.push({ id: uid('c'), n: v.n, meta: v.meta == null ? null : Math.round(v.meta) });
      return undefined;
    });
  }
  function modalSugerencias() {
    const libres = SUGERENCIAS_COMIDA.filter(t => !S.comida.items.some(i => i.n === t));
    if (!libres.length) return toast('Ya agregaste todas las sugerencias');
    abrirModal('Sugerencias para tu checklist', [{ k: 'sel', t: 'checks', l: 'Elegí las que quieras', v: [], opts: libres.map(t => [t, t]) }], v => { v.sel.forEach(t => S.comida.items.push({ id: uid('i'), n: limpiar(t) })); return undefined; }, 'Son ejemplos: elegí lo que te indicó tu profesional.');
  }

  /* ---------- Acciones ---------- */
  const setEj = (id, f) => { const d = day(); d.ej = d.ej || {}; d.ej[id] = Math.max(0, Math.min(9999, f(d.ej[id] || 0))); };
  const nombreEj = id => (ejPorId(id) || {}).n || '';
  document.addEventListener('click', e => {
    if (e.target.id === 'modal') return cerrarModal();
    const dt = e.target.closest('details.compacto'); // el ejercicio plegado que estás usando queda abierto aunque se vuelva a dibujar la pantalla
    if (dt && dt.dataset.eid) { if (e.target.closest('summary')) { if (dt.open) abiertosEj.delete(dt.dataset.eid); else abiertosEj.add(dt.dataset.eid); } else abiertosEj.add(dt.dataset.eid); }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, id = b.dataset.id, k = b.dataset.k;
    switch (a) {
      case 'tab': go(b.dataset.t); break;
      case 'rec-repartir': { const f = faltasSemana(); f.forEach(({ k, e }) => { S.recup[e.id] = Math.min(MAX_RECUP, (S.recup[e.id] || 0) + 1); S.cerrados[k + '|' + e.id] = true; }); changed(); toast(f.length ? 'Listo: te los voy sumando de a uno en tus próximas rutinas' : 'No había nada pendiente'); break; }
      case 'rec-dejar': faltasSemana().forEach(({ k, e }) => { S.cerrados[k + '|' + e.id] = true; }); changed(); break;
      case 'aviso-ok': S.settings.avisoAceptado = Date.now(); changed(); toast('Gracias. Lo podés releer en Ajustes.'); break;
      case 'hoy-abrir': abiertasHoy.add(id); render(); break;
      case 'sub-evp': subEvP = b.dataset.v; render(); break;
      case 'sub-eva': subEvA = b.dataset.v; render(); break;
      case 'sub-ev': subEv = b.dataset.v; render(); break;
      case 'sub-h': subH = b.dataset.v; render(); break;
      case 'sub-m': subM = b.dataset.v; render(); break;
      case 'sub-c': selCampo[subM] = b.dataset.v; render(); break;
      case 'modal-cancel': cerrarModal(); break;
      // ejercicio
      case 'ej+': { const ej = ejPorId(id); setEj(id, n => n + 1); changed(); if (ej && ej.tipo !== 'reps' && progEj(ej) < metaEj(ej)) startTimer(S.settings.descansoSeg || 45, 'Descanso'); break; }
      case 'ej+5': setEj(id, n => n + 5); changed(); break;
      case 'ej-': setEj(id, n => n - 1); changed(); break;
      case 'ej-set': { const r = window.prompt('¿Cuántas hiciste?', String(progEj(ejPorId(id) || {}))); if (r !== null) { const v = Math.round(num(r)); if (v >= 0 && v <= 9999) { setEj(id, () => v); changed(); } else toast('Número no válido'); } break; }
      case 'ej-ok': { const e = ejPorId(id); if (e) { setEj(id, n => Math.max(n, metaEj(e))); const d = day(); if (d.omitEj) delete d.omitEj[id]; changed(); toast('¡Bien! Ejercicio hecho'); } break; }
      case 'ej-no': { const d = day(); d.omitEj = d.omitEj || {}; d.omitEj[id] = true; changed(); recordarManana(S.sesiones.find(x => (x.ej || []).includes(id)), nombreEj(id)); toast(conRecordatorios() ? 'Anotado. Mañana te lo recuerdo' : 'Anotado. Mañana lo vas a ver como pendiente'); break; }
      case 'ej-no-x': { const d = day(); if (d.omitEj) delete d.omitEj[id]; changed(); break; }
      case 'mol': { if (S.molestias[id]) delete S.molestias[id]; else S.molestias[id] = true; changed(); break; }
      case 'ses-todo': { const s = sesPorId(id), d = day(); d.ej = d.ej || {}; ejDeSesion(s).forEach(ej => { d.ej[ej.id] = Math.max(d.ej[ej.id] || 0, metaEj(ej)); }); if (d.omit) delete d.omit[id]; changed(); toast('¡Bien! Rutina completa'); break; }
      case 'ses-no': { const d = day(); d.omit = d.omit || {}; d.omit[id] = true; changed(); recordarManana(sesPorId(id)); toast(conRecordatorios() ? 'Listo, mañana te lo recuerdo' : 'Anotado'); break; }
      case 'timer': startTimer(parseInt(b.dataset.s, 10) || 15, b.dataset.l || 'Temporizador'); break;
      case 'timer-stop': stopTimer(); break;
      case 'ej-nuevo': modalEjercicio(null); break;
      case 'ej-edit': modalEjercicio(ejPorId(id)); break;
      case 'ej-del': if (ejPorId(id) && confirm(`¿Quitar "${nombreEj(id)}" de tu plan? Lo que registraste no se borra.`)) { S.ejercicios = S.ejercicios.filter(x => x.id !== id); S.sesiones.forEach(s => { s.ej = (s.ej || []).filter(x => x !== id); }); changed(); } break;
      case 'ses-separar': { const se = sesPorId(id); if (!se) break; const dest = rutinaDeGrupo('espalda'), mover = ejDeSesion(se).filter(esEjEspalda).map(e => e.id); se.ej = se.ej.filter(x => !mover.includes(x)); mover.forEach(x => { if (!dest.ej.includes(x)) dest.ej.push(x); }); setupReminders(); changed(); toast(`Listo: "${dest.n}" es una rutina aparte. Elegí sus días y horario con "Editar rutina".`); break; }
      case 'ses-nueva': modalSesion(null); break;
      case 'ses-edit': modalSesion(sesPorId(id)); break;
      case 'ses-del': { const s = sesPorId(id); if (s && confirm(`¿Quitar la rutina "${s.n}"? Los ejercicios que tiene también se quitan del plan.`)) { S.ejercicios = S.ejercicios.filter(x => !(s.ej || []).includes(x.id)); S.sesiones = S.sesiones.filter(x => x.id !== id); setupReminders(); changed(); } break; }
      case 'plan-bib': modalBiblioteca(); break;
      // mediciones
      case 'med-nueva': modalMedidaNueva(); break;
      case 'med-conf': modalMedidaConf(medPorId(id)); break;
      case 'med-del': { const m = medPorId(id); if (m && confirm(`¿Quitar "${m.n}" y TODOS sus registros? No se puede deshacer (si dudás, exportá un respaldo antes).`)) { S.medidas = S.medidas.filter(x => x.id !== id); delete S.registros[id]; setupReminders(); changed(); } break; }
      // hábitos
      case 'agua+': { const d = day(); d.agua = (d.agua || 0) + S.settings.vaso; changed(); sacarAvisoAgua(); break; }
      case 'agua-': { const d = day(); d.agua = Math.max(0, (d.agua || 0) - S.settings.vaso); changed(); break; }
      case 'motion': toggleMotion(); break;
      case 'sensor-sync': S.settings.pasosRechazos = 0; syncSensor(true); break;
      case 'probar-aviso': probarAviso(); break;
      case 'salud-importar': importarSalud(true); break;
      case 'bg-toggle': toggleSegundoPlano(); break;
      case 'pasos-add': case 'pasos-set': {
        const n = Math.round(num($('#pasosInput').value));
        if (!(n >= 0) || n > 100000) { toast('Ingresá una cantidad válida'); break; }
        const d = day(); d.pasos = a === 'pasos-add' ? (d.pasos || 0) + n : n; changed(); break;
      }
      case 'com-t': { const d = day(); d.comida = d.comida || {}; if (d.comida[id]) delete d.comida[id]; else d.comida[id] = true; changed(); break; }
      case 'com-sug': { const i = Number(b.dataset.v); if (sugSel.has(i)) sugSel.delete(i); else sugSel.add(i); render(); break; }
      case 'com-sug-ok': { [...sugSel].sort((a, b2) => a - b2).forEach(i => { const t = SUGERENCIAS_COMIDA[i]; if (t) S.comida.items.push({ id: uid('i'), n: limpiar(t) }); }); sugSel = new Set(); changed(); toast('Agregadas. Podés sumar más con "Agregar ítem"'); break; }
      case 'com-add': modalTexto('Nuevo ítem del checklist', 'Qué querés cumplir cada día', '', n => { S.comida.items.push({ id: uid('i'), n: limpiar(n) }); }); break;
      case 'com-sugs': modalSugerencias(); break;
      case 'ci-ren': { const it = S.comida.items.find(x => x.id === id); if (it) modalTexto('Renombrar ítem', 'Nuevo nombre', it.n, n => { it.n = limpiar(n); }); break; }
      case 'ci-del': { const i = S.comida.items.findIndex(x => x.id === id); if (i >= 0 && confirm(`¿Quitar "${S.comida.items[i].n}" del checklist? Los días ya marcados no se borran.`)) { S.comida.items.splice(i, 1); changed(); } break; }
      case 'ct-nuevo': modalContador(null); break;
      case 'ct-sug': if (b.dataset.v && !S.comida.contadores.some(x => x.n === b.dataset.v)) { S.comida.contadores.push({ id: uid('c'), n: b.dataset.v, meta: null }); changed(); toast('Agregado. Si querés una meta semanal, tocá Editar en Ajustes → Alimentación.'); } break;
      case 'rec-nuevo': modalRecordatorio(null); break;
      case 'rec-edit': modalRecordatorio(S.recordatorios.find(x => x.id === id)); break;
      case 'rec-del': { const i = S.recordatorios.findIndex(x => x.id === id); if (i >= 0 && confirm(`¿Quitar el recordatorio "${S.recordatorios[i].txt}"?`)) { S.recordatorios.splice(i, 1); setupReminders(); changed(); } break; }
      case 'ct-edit': modalContador(S.comida.contadores.find(x => x.id === id)); break;
      case 'ct-del': { const i = S.comida.contadores.findIndex(x => x.id === id); if (i >= 0 && confirm(`¿Quitar "${S.comida.contadores[i].n}"?`)) { S.comida.contadores.splice(i, 1); changed(); } break; }
      case 'cont+': { const d = day(); d.cont = d.cont || {}; d.cont[id] = Math.min(99, (d.cont[id] || 0) + 1); changed(); break; }
      case 'cont-': { const d = day(); d.cont = d.cont || {}; d.cont[id] = Math.max(0, (d.cont[id] || 0) - 1); changed(); break; }
      // ajustes
      case 'color': S.settings.color = b.dataset.v; aplicarColor(); changed(); break;
      case 'modo': S.modo = b.dataset.v; setupReminders(); changed(); break;
      case 'informe': informe(); break;
      case 'export': exportar(); break;
      case 'copiar': copiarRespaldo(); break;
      case 'import': $('#fileIn').click(); break;
      case 'borrar': borrarTodo(); break;
      case 'resp-luego': S.settings.respaldoPospuesto = hoy(); changed(); break;
      case 'del': {
        const kk = b.dataset.k, i = parseInt(b.dataset.i, 10), lista = kk.startsWith('reg:') ? S.registros[kk.slice(4)] : kk === 'aero' ? S.aero : null;
        if (Array.isArray(lista) && i >= 0 && i < lista.length && confirm('¿Borrar este registro?')) { lista.splice(i, 1); changed(); }
        break;
      }
      // asistente
      case 'wiz-mod': wizInit(); wiz.mods[k] = !wiz.mods[k]; render(); break;
      case 'wiz-med': wizInit(); wiz.meds[k] = !wiz.meds[k]; render(); break;
      case 'wiz-bib': wizInit(); wiz.bib[k] = !wiz.bib[k]; render(); break;
      case 'wiz-modo': wizInit(); wiz.modo = b.dataset.v; render(); break;
      case 'wiz-sig': leerWizMetas(); wiz.paso++; render(); window.scrollTo(0, 0); break;
      case 'wiz-atras': leerWizMetas(); wiz.paso = Math.max(0, wiz.paso - 1); render(); window.scrollTo(0, 0); break;
      case 'wiz-fin': terminarAsistente(); break;
      case 'wiz-rehacer': if (confirm('Se abre el asistente inicial. Tus datos no se borran. ¿Seguir?')) { wiz = { paso: 0, mods: Object.assign({}, S.modulos), meds: {}, bib: {}, modo: S.modo }; S.listo = false; save(); render(); window.scrollTo(0, 0); } break;
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) cerrarModal(); });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'fileIn' && t.files[0]) importar(t.files[0]);
    if (t.dataset && t.dataset.a === 'salud-auto') { S.settings.hcAuto = t.checked; save(); if (t.checked) importarSalud(true); }
    if (t.dataset && t.dataset.a === 'mod-t') { S.modulos[t.dataset.k] = t.checked; save(); setupReminders(); render(); if (t.dataset.k === 'pasos' && t.checked) iniciarPasos(); }
  });

  function leerWizMetas() {
    if (!wiz) return;
    ['metaAgua', 'metaPasos', 'aeroMeta'].forEach(n => { const el = $('#w_' + n); if (!el) return; const v = String(el.value).trim(); S.settings[n] = v === '' ? null : (num(v) > 0 ? Math.round(num(v)) : S.settings[n]); });
  }
  function terminarAsistente() {
    wizInit(); leerWizMetas();
    S.modulos = Object.assign({}, S.modulos, wiz.mods); S.modo = wiz.modo;
    Object.keys(wiz.meds).filter(t => wiz.meds[t] && CATALOGO[t]).forEach(t => { if (!S.medidas.some(m => m.tipo === t && t !== 'propia')) S.medidas.push(nuevaMedida(t, t === 'propia' ? 'Mi medición' : '')); });
    const sel = BIBLIOTECA.filter((b, i) => wiz.bib[i]);
    sel.forEach(b => agregarEjemplo(b, rutinaDeGrupo(grupoBib(b))));
    S.listo = true; wiz = null; tab = 'hoy'; save(); setupReminders(); render(); window.scrollTo(0, 0); iniciarPasos();
    if (mod('pasos')) syncSensor(false);
  }

  /* ---------- Formularios ---------- */
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-f]'); if (!f) return;
    e.preventDefault();
    const fd = new FormData(f), kind = f.dataset.f, g = n => num(fd.get(n));
    const opt = n => { const v = fd.get(n); return v === null || String(v).trim() === '' ? null : num(v); };
    if (kind === 'modal') {
      if (!modalCb) return;
      const err = modalCb(valoresModal(f));
      if (typeof err === 'string') { $('#modalErr').textContent = err; return; }
      cerrarModal(); changed(); toast('Guardado');
    } else if (kind === 'wizmetas') {
      leerWizMetas(); wiz.paso++; render();
    } else if (kind === 'reg') {
      const m = medPorId(f.dataset.id); if (!m) return;
      const fecha = String(fd.get('fecha') || ''), r = {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return toast('Revisá la fecha');
      if (fecha > hoy()) return toast('La fecha no puede ser futura');
      for (const c of m.campos) {
        const v = opt(c.k); if (v === null) { if (!c.opc) return toast(`Falta: ${c.n}`); continue; }
        if (!(v >= c.r[0] && v <= c.r[1])) return toast(`Revisá ${c.n}: debería estar entre ${c.r[0]} y ${c.r[1]}`);
        r[c.k] = v;
      }
      if (!Object.keys(r).length) return toast('Cargá al menos un valor');
      const lista = S.registros[m.id] = S.registros[m.id] || [], previo = lista.find(x => x.fecha === fecha);
      if (previo) Object.assign(previo, r); else lista.push(Object.assign({ fecha, ts: Date.now() }, r));
      changed(); const p = proximaFecha(m);
      toast(previo ? 'Registro de esa fecha actualizado' : (p ? `Guardado. Repetilo hacia el ${fmtDMA(p.desde)}` : 'Guardado'));
    } else if (kind === 'aero') {
      const fecha = String(fd.get('fecha') || ''), min = g('min'), tipo = limpiar(fd.get('tipo')).slice(0, 40);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return toast('Revisá la fecha');
      if (fecha > hoy()) return toast('La fecha no puede ser futura');
      if (!(min >= 1 && min <= 600)) return toast('Los minutos deben estar entre 1 y 600');
      S.aero.push({ fecha, min: Math.round(min), tipo }); changed(); toast('Actividad guardada');
    } else if (kind === 'metas') {
      const s = S.settings, n = {};
      ['metaAgua', 'metaPasos', 'aeroMeta'].forEach(k => { if (f.elements[k]) { const v = opt(k); if (v !== null && !(v > 0)) n.err = 'Las metas deben ser mayores que cero (o dejalas vacías).'; n[k] = v === null ? null : Math.round(v); } });
      if (f.elements.vaso) { const v = g('vaso'); if (!(v > 0 && v <= 2000)) n.err = 'El vaso debe estar entre 1 y 2000 ml.'; n.vaso = Math.round(v); }
      if (f.elements.recMin) { const v = g('recMin'); if (!(v >= 15 && v <= 720)) n.err = 'El recordatorio de agua va de 15 a 720 minutos.'; n.recMin = Math.round(v); }
      if (f.elements.descansoSeg) { const v = g('descansoSeg'); if (!(v >= 5 && v <= 600)) n.err = 'El descanso va de 5 a 600 segundos.'; n.descansoSeg = Math.round(v); }
      if (f.elements.recPasosHora && !horaOk(String(fd.get('recPasosHora')))) n.err = 'Revisá la hora del aviso de pasos.';
      if (f.elements.seguirHora && !horaOk(String(fd.get('seguirHora')))) n.err = 'Revisá la hora de la pregunta de la noche.';
      if (f.elements.aguaDesde && !(horaOk(String(fd.get('aguaDesde'))) && horaOk(String(fd.get('aguaHasta'))))) n.err = 'Revisá las horas del recordatorio de agua.';
      if (n.err) return toast(n.err);
      if (f.elements.recPasos) { s.recPasos = fd.get('recPasos') === 'on'; s.recPasosHora = String(fd.get('recPasosHora')); }
      if (f.elements.seguirOn) { s.seguirOn = fd.get('seguirOn') === 'on'; s.seguirHora = String(fd.get('seguirHora')); }
      Object.assign(s, n); s.notas = String(fd.get('notas') || '').slice(0, 1000); if (f.elements.recAgua) { s.recAgua = fd.get('recAgua') === 'on'; s.aguaDesde = String(fd.get('aguaDesde')); s.aguaHasta = String(fd.get('aguaHasta')); }
      setupReminders(); changed(); toast('Ajustes guardados');
    }
  });

  /* ---------- Recordatorios ---------- */
  let recT = null, lastRec = Date.now();
  /* Agua: cada aviso de hoy que ya pasó es un vaso "por tomar"; cada vaso marcado descuenta uno (no desaparecen todos juntos). */
  const minAviso = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  function pendientesAgua() {
    const s = S.settings; if (!(mod('agua') && conRecordatorios() && s.recAgua && horaOk(s.aguaDesde) && horaOk(s.aguaHasta))) return 0;
    const n = new Date(), ahoraMin = n.getHours() * 60 + n.getMinutes(); let pasados = 0;
    for (let m = minAviso(s.aguaDesde), i = 0; m < minAviso(s.aguaHasta) && i < 60; m += Math.max(15, s.recMin), i++) if (m <= ahoraMin) pasados++;
    return Math.max(0, pasados - Math.floor((peek().agua || 0) / s.vaso));
  }
  const tarjetaAguaPend = () => { const p = pendientesAgua(); return p ? `<div class="card warn"><b>💧 ${p === 1 ? 'Te quedó 1 vaso' : 'Te quedaron ' + p + ' vasos'} por tomar</b><p>Son los avisos de hoy que todavía no marcaste. Cada vez que marcás un vaso baja uno.</p></div>` : ''; };
  async function sacarAvisoAgua() { // en Android, al marcar un vaso se saca de la barra UNA notificación de agua (la más vieja)
    const N = plug('LocalNotifications'); if (!N || !N.getDeliveredNotifications) return;
    try { const l = ((await N.getDeliveredNotifications()).notifications || []).filter(x => x.id >= 1000 && x.id < 2000).sort((a, b) => a.id - b.id); if (l.length) await N.removeDeliveredNotifications({ notifications: [{ id: l[0].id }] }); } catch (e) { /* nada */ }
  }
  /* Lo que ya se cumplió hoy: su recordatorio de hoy no debe sonar (se mueve a la próxima vez). */
  const medidaHoy = m => (S.registros[m.id] || []).some(r => r && r.fecha === hoy());
  const pasosCumplidos = () => !!(S.settings.metaPasos && (peek().pasos || 0) >= S.settings.metaPasos);
  const aguaCumplida = () => !!(S.settings.metaAgua && (peek().agua || 0) >= S.settings.metaAgua);
  const sesionCumplidaHoy = se => sesionHecha(se, hoy()) || !!(peek().omit || {})[se.id] || (ejDeSesion(se).length > 0 && ejDeSesion(se).every(e => progEj(e) >= metaEj(e) || (peek().omitEj || {})[e.id]));
  const firmaCumplidos = () => [aguaCumplida() ? 'A' : '-', pasosCumplidos() ? 'P' : '-', S.medidas.map(m => (medidaHoy(m) ? '1' : '0')).join(''), S.sesiones.map(se => (sesionCumplidaHoy(se) ? '1' : '0')).join(''), hoy()].join('|');
  let firmaProg = null, progT = null;
  function reprogramarSiCambio() {
    if (!conRecordatorios() || firmaCumplidos() === firmaProg) return;
    clearTimeout(progT); progT = setTimeout(scheduleNative, 1500);
  }
  async function scheduleNative() {
    const N = plug('LocalNotifications'); if (!N) return;
    try {
      const pend = await N.getPending();
      const viejas = pend.notifications.filter(n => n.id !== 3900); // 3900 = aviso de "mañana" (se conserva)
      if (viejas.length) await N.cancel({ notifications: viejas.map(n => ({ id: n.id })) });
      firmaProg = firmaCumplidos();
      const s = S.settings, list = [], ahora = new Date();
      // Si ya se cumplió hoy, el aviso arranca mañana (o la semana que viene) y sigue repitiéndose igual.
      const proximo = (hh, mm, dias) => new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + dias, hh, mm, 0);
      const diario = (id, hora, title, body, hecho, extra) => { const [hh, mm] = hora.split(':').map(Number); list.push({ id, title, body, channelId: 'recordatorios', ...extra, schedule: hecho ? { at: proximo(hh, mm, 1), repeats: true, every: 'day', allowWhileIdle: true } : { on: { hour: hh, minute: mm }, allowWhileIdle: true } }); };
      if (conRecordatorios()) {
        if (mod('agua') && s.recAgua && horaOk(s.aguaDesde) && horaOk(s.aguaHasta)) {
          const mn = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; }; let i = 0;
          for (let m = mn(s.aguaDesde); m < mn(s.aguaHasta) && i < 60; m += Math.max(15, s.recMin)) { diario(1000 + i++, `${pad(Math.floor(m / 60))}:${pad(m % 60)}`, '💧 Hora de tomar agua', `Vaso de ${s.vaso} ml (aviso de las ${pad(Math.floor(m / 60))}:${pad(m % 60)})`, aguaCumplida(), { autoCancel: false }); }
        }
        if (mod('medidas')) S.medidas.slice(0, 50).forEach((m, i) => { if (m.recordarHora && horaOk(m.recordarHora)) diario(2000 + i, m.recordarHora, `${m.n}: hora de medir`, 'Anotá el valor en A Mi Ritmo.', medidaHoy(m)); });
        if (mod('ejercicio')) S.sesiones.slice(0, 80).forEach((se, i) => { if (se.hora && horaOk(se.hora)) (se.dias || []).forEach(d => { const [hh, mm] = se.hora.split(':').map(Number); list.push({ id: 3000 + i * 10 + d, title: `🏋️ ${se.n}`, body: 'Es hora de tu rutina. Después marcá lo que hiciste.', channelId: 'recordatorios', schedule: d === ahora.getDay() && sesionCumplidaHoy(se) ? { at: proximo(hh, mm, 7), repeats: true, every: 'week', allowWhileIdle: true } : { on: { weekday: d + 1, hour: hh, minute: mm }, allowWhileIdle: true } }); }); });
      }
      if (conRecordatorios()) S.recordatorios.slice(0, 50).forEach((r, i) => { if (horaOk(r.hora)) { const [rh, rm] = r.hora.split(':').map(Number); (r.dias || []).forEach(d => list.push({ id: 4000 + i * 10 + d, title: `🔔 ${r.txt}`, body: 'Recordatorio de A Mi Ritmo.', channelId: 'recordatorios', schedule: { on: { weekday: d + 1, hour: rh, minute: rm }, allowWhileIdle: true } })); } });
      if (conRecordatorios() && mod('pasos') && s.recPasos === true && horaOk(s.recPasosHora)) diario(3700, s.recPasosHora, '👣 ¿Cómo van tus pasos de hoy?', s.metaPasos ? `Tu meta es de ${s.metaPasos} pasos. Abrí A Mi Ritmo para ver cuántos llevás.` : 'Abrí A Mi Ritmo para ver cuántos llevás hoy.', pasosCumplidos());
      if (conRecordatorios() && mod('ejercicio') && s.seguirOn !== false && horaOk(s.seguirHora)) {
        const [sh, sm] = s.seguirHora.split(':').map(Number), resueltas = sesionesDelDia(ahora).filter(se => ejDeSesion(se).length).every(sesionCumplidaHoy);
        for (let d = 0; d < 7; d++) if (S.sesiones.some(se => (se.dias || []).includes(d) && ejDeSesion(se).length)) list.push({ id: 3600 + d, title: '🏋️ ¿Hiciste tu rutina de hoy?', body: 'Abrí A Mi Ritmo y marcá lo que hiciste, o tocá "No pude hoy". Lo pendiente lo podés repartir en la semana.', channelId: 'recordatorios', schedule: d === ahora.getDay() && resueltas ? { at: proximo(sh, sm, 7), repeats: true, every: 'week', allowWhileIdle: true } : { on: { weekday: d + 1, hour: sh, minute: sm }, allowWhileIdle: true } });
      }
      if (!list.length) return;
      let perm = await N.checkPermissions();
      if (perm.display !== 'granted') perm = await N.requestPermissions();
      if (perm.display !== 'granted') { toast('Activá las notificaciones de A Mi Ritmo en los ajustes del teléfono'); return; }
      try { await N.createChannel({ id: 'recordatorios', name: 'Recordatorios', importance: 4, vibration: true }); } catch (e) { /* ya existe */ }
      await N.schedule({ notifications: list });
    } catch (e) { toast('No se pudieron programar los recordatorios'); }
  }
  // Aviso de prueba: pide el permiso y manda una notificación en 5 segundos, para saber si los avisos funcionan en este teléfono.
  async function probarAviso() {
    const N = plug('LocalNotifications'); if (!N) return toast('Los avisos con la app cerrada funcionan solo en la app de Android.');
    try {
      let perm = await N.checkPermissions(); if (perm.display !== 'granted') perm = await N.requestPermissions();
      if (perm.display !== 'granted') return toast('Android bloqueó las notificaciones: activalas en Ajustes del teléfono → Apps → A Mi Ritmo → Notificaciones.');
      try { await N.createChannel({ id: 'recordatorios', name: 'Recordatorios', importance: 4, vibration: true }); } catch (e) { /* ya existe */ }
      await N.schedule({ notifications: [{ id: 9999, title: '🔔 Aviso de prueba', body: 'Si ves esto, los recordatorios de A Mi Ritmo funcionan.', channelId: 'recordatorios', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
      toast('Listo: en 5 segundos tiene que llegar un aviso. Cerrá la app para verlo mejor.');
    } catch (e) { toast('No se pudo programar el aviso de prueba'); }
  }
  // Aviso único para mañana (se usa con "No pude hoy").
  async function recordarManana(se, ej) {
    const N = plug('LocalNotifications'); if (!N || !conRecordatorios()) return;
    try {
      const [hh, mm] = (se && horaOk(se.hora) ? se.hora : '09:00').split(':').map(Number), n = new Date();
      await N.schedule({ notifications: [{ id: 3900, title: ej ? `🏋️ ${ej}: ayer no lo hiciste` : `🏋️ ${se ? se.n : 'Tu rutina'}: ayer no pudiste`, body: 'Hoy podés retomar si te sentís bien, sin sumar de más.', channelId: 'recordatorios', schedule: { at: new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, hh, mm, 0), allowWhileIdle: true } }] });
    } catch (e) { /* sin permiso de notificaciones */ }
  }
  function notificarWeb(title, body) {
    toast(title);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, { body, icon: 'icon-192.png', tag: title }); } catch (e) { /* nada */ }
  }
  function setupReminders() {
    clearInterval(recT); lastRec = Date.now();
    if (NATIVE) { scheduleNative(); return; }
    if (!(conRecordatorios() && mod('agua') && S.settings.recAgua)) return;
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { /* nada */ } }
    recT = setInterval(() => {
      const h = new Date().getHours(), s = S.settings, hh = Number((s.aguaDesde || '08:00').split(':')[0]), hf = Number((s.aguaHasta || '22:00').split(':')[0]);
      if (h >= hh && h < hf && Date.now() - lastRec >= s.recMin * 60000) { lastRec = Date.now(); notificarWeb('💧 Hora de tomar agua', `Vaso de ${s.vaso} ml`); }
    }, 60000);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else if (NATIVE) { syncSensor(false); if (S.settings.hcAuto && Date.now() - (S.settings.hcUltimo || 0) > 30 * 60000) importarSalud(false); } });
  window.addEventListener('pagehide', save);
  let sigHabil = firmaHabil();
  setInterval(() => { const f = firmaHabil(); if (f !== sigHabil) { sigHabil = f; if (tab === 'hoy' && !wiz) render(); } }, 30000);   // al llegar la hora de una rutina, su tarjeta se habilita sola

  // Bienvenida animada con el aviso: se lee unos segundos y se va sola (o al tocarla); después entra el dashboard.
  function iniciarBienvenida() {
    const sp = $('#splash'); if (!sp) return;
    if (window.__sinSplash) { sp.remove(); return; }
    let ido = false; const t0 = Date.now();
    const salir = () => { if (ido) return; ido = true; sp.classList.add('fuera'); document.body.classList.add('entrando'); setTimeout(() => sp.remove(), 650); setTimeout(() => document.body.classList.remove('entrando'), 2000); };
    sp.addEventListener('click', () => { if (Date.now() - t0 > 900) salir(); });
    setTimeout(salir, 3800);
  }
  // Android dibuja la app detrás de la barra de estado: se lee su alto (MainActivity lo expone) para que el título no quede tapado.
  function leerInsets() { try { if (window.AndroidInsets) document.documentElement.style.setProperty('--inset-top', Number(window.AndroidInsets.top()) + 'px'); } catch (e) { /* sin datos: queda el mínimo del CSS */ } }
  if (NATIVE) { document.body.classList.add('nativo'); leerInsets(); [300, 1200, 3000].forEach(t => setTimeout(leerInsets, t)); window.addEventListener('resize', leerInsets); }
  aplicarColor();
  iniciarBienvenida();
  render();
  if (NATIVE) { iniciarPasos().then(() => setupReminders(), () => setupReminders()).then(() => { if (S.settings.hcAuto) importarSalud(false); }); setInterval(() => syncSensor(false), 5 * 60000); } else setupReminders();
  if (NATIVE) { /* arriba */ }
  else if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });

  // Ganchos para pruebas automáticas.
  window.SA = { fusionarSalud, importarSalud, leerInsets, state: () => S, render, go, chart, informeCuerpo, detectStep, step };
})();
