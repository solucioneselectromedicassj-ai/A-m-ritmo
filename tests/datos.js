'use strict';
// Datos de partida para las pruebas (la clave de la app nueva es miplanV1).
const MED = (tipo, extra = {}) => {
  const campos = {
    presion: [{ k: 'sis', n: 'Máxima (sistólica)', u: 'mmHg', r: [50, 300] }, { k: 'dia', n: 'Mínima (diastólica)', u: 'mmHg', r: [30, 200] }, { k: 'pul', n: 'Pulso', u: 'lpm', r: [25, 250], opc: true }],
    peso: [{ k: 'kg', n: 'Peso', u: 'kg', r: [20, 400], dec: 1 }],
    colesterol: [{ k: 'ldl', n: 'LDL', u: 'mg/dL', r: [10, 600], opc: true }, { k: 'hdl', n: 'HDL', u: 'mg/dL', r: [5, 200], opc: true }, { k: 'total', n: 'Total', u: 'mg/dL', r: [50, 800], opc: true }, { k: 'tg', n: 'Triglicéridos', u: 'mg/dL', r: [10, 3000], opc: true }],
    propia: [{ k: 'v', n: 'Valor', u: 'cm', r: [-1000000, 1000000], dec: 2 }]
  }[tipo].map(c => Object.assign({ min: null, max: null }, c));
  return Object.assign({ id: 'm_' + tipo, tipo, n: { presion: 'Presión arterial', peso: 'Peso', colesterol: 'Colesterol', propia: 'Cintura' }[tipo], campos, repetirMeses: null, recordarHora: '' }, extra);
};
const EJ = (id, n, tipo, o = {}) => Object.assign({ id, n, tipo }, tipo === 'reps' ? { meta: 10 } : tipo === 'series' ? { series: 2, reps: 8 } : { series: 2, seg: 15 }, o);
const base = (extra = {}) => ({
  miplanV1: JSON.stringify(Object.assign({
    v: 1, listo: true, modo: 'registro', modulos: {}, settings: { creado: '2026-10-01' }, ejercicios: [], sesiones: [], medidas: [],
    registros: {}, days: {}, comida: { items: [], contadores: [] }, aero: [], molestias: {}
  }, extra))
});
const TODOS = { ejercicio: true, pasos: true, agua: true, actividad: true, comida: true, medidas: true };
module.exports = { MED, EJ, base, TODOS };
