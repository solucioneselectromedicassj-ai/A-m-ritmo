// Utilidades de slots de tiempo — migradas del HTML original

/** "08:30" → minutos desde medianoche */
export function toMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/** minutos → "08:30" */
export function fromMin(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Genera todos los slots entre startTime y endTime con paso slotMin.
 * @returns {string[]}  ej. ["08:00","08:30","09:00",…]
 */
export function getSlots(startTime, endTime, slotMin) {
  const slots = []
  let cur = toMin(startTime)
  const end = toMin(endTime)
  while (cur < end) {
    slots.push(fromMin(cur))
    cur += slotMin
  }
  return slots
}

/**
 * Filtra slots donde hay al menos `neededMin` minutos consecutivos libres.
 * @param {object} sch       - { startTime, endTime, slotMin }
 * @param {string[]} taken   - array de horarios ya ocupados ("HH:MM")
 * @param {number} neededMin - duración requerida en minutos
 */
export function getFirstConsultSlots(sch, taken, neededMin) {
  const allSlots = getSlots(sch.startTime, sch.endTime, parseInt(sch.slotMin))
  return allSlots.filter(slot => {
    const start = toMin(slot)
    const end = start + neededMin
    if (end > toMin(sch.endTime)) return false
    return !taken.some(t => {
      const ts = toMin(t)
      return ts >= start && ts < end
    })
  })
}

/**
 * Devuelve los próximos `days` días que tienen slots disponibles
 * para una primera consulta.
 * @param {object} professional  - { schedules: [], firstConsultMin }
 * @param {object[]} allAppts    - todos los appointments cargados
 * @param {number} days          - ventana en días (default 14)
 */
export function getAvailableDays(professional, allAppts, days = 14) {
  const result = []
  const today = new Date()

  for (let i = 1; i <= days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dow = d.getDay()                         // 0=Dom…6=Sáb
    const dateStr = d.toISOString().slice(0, 10)  // "2024-03-15"

    const sch = (professional.schedules || []).find(s => s.day_of_week === dow)
    if (!sch) continue

    const taken = allAppts
      .filter(a => a.professional_id === professional.id && a.date === dateStr
                   && !['cancelled', 'no_show'].includes(a.status))
      .map(a => a.time)

    const slots = getFirstConsultSlots(sch, taken, professional.first_consult_min)
    if (slots.length > 0) {
      result.push({ dateStr, slots, dow })
    }
  }
  return result
}

/** Nombres de días en español */
export const DOW_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

/** Formatea una fecha "2024-03-15" como "Viernes 15/03" */
export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `${DOW_NAMES[dow]} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`
}
