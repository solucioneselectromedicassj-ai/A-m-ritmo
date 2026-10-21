// Constructores de mensajes de WhatsApp

/**
 * Abre WhatsApp con un mensaje pre-escrito para el número dado.
 * El número debe incluir código de país sin "+": ej. "5492644123456"
 */
export function openWhatsApp(phone, message) {
  if (!phone) return
  const clean = phone.replace(/\D/g, '')
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

/** Confirmación de turno al paciente */
export function msgConfirmacion({ patientName, professionalName, date, time, requirements }) {
  return `Hola ${patientName} 👋
Tu turno ha sido confirmado:
🩺 ${professionalName}
📅 ${date} a las ${time}
${requirements ? `\n📋 Recordá traer: ${requirements}` : ''}
¡Hasta pronto!`
}

/** Recordatorio del día anterior */
export function msgRecordatorio({ patientName, professionalName, date, time }) {
  return `Hola ${patientName} 👋
Te recordamos que mañana tenés turno:
🩺 ${professionalName}
📅 ${date} a las ${time}
Confirmá tu asistencia o avisanos si no podés ir.`
}

/** Aviso "sos el próximo" */
export function msgProximo({ patientName, room }) {
  return `Hola ${patientName} 🔔
¡Sos el próximo paciente!
Dirigite al ${room || 'consultorio'}, te están esperando.`
}

/** Aviso de llegada al profesional */
export function msgLlegadaParaPro({ patientName, professionalName }) {
  return `📢 ${patientName} llegó y está esperando su turno.
— Sistema TurnoClínica`
}

/** Recordatorio al profesional */
export function msgRecordatorioPro({ professionalName, patientName, time, notes }) {
  return `📅 Próximo turno — ${time}
Paciente: ${patientName}
${notes ? `Notas: ${notes}` : ''}
— TurnoClínica`
}
