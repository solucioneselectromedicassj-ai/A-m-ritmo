import React, { useState } from 'react'
import { useClinic } from '../hooks/useClinic'
import { useAppointments } from '../hooks/useAppointments'
import { openWhatsApp, msgConfirmacion, msgProximo } from '../utils/whatsapp'
import { formatDate } from '../utils/slots'

const TODAY = new Date().toISOString().slice(0, 10)

const STATUS_LABEL = {
  scheduled:   '📅 Programado',
  arrived:     '🟡 En sala',
  in_progress: '🟢 En consulta',
  done:        '✅ Atendido',
  cancelled:   '❌ Cancelado',
  no_show:     '🚫 No se presentó',
}

export default function SecretariaScreen({ session, onLogout }) {
  const { clinic, professionals, loading: cLoading } = useClinic(session.clinicCode)
  const { appointments, updateAppointment, addAppointment } = useAppointments(session.clinicId, TODAY)
  const [tab, setTab] = useState('queue')   // queue | book
  const [form, setForm] = useState({ patientName: '', patientPhone: '', patientDni: '', professionalId: '', time: '', notes: '', isWalkIn: false, isFirst: false })
  const [msg, setMsg] = useState('')

  if (cLoading) return <div className="p-8 text-center">Cargando…</div>

  const queue = appointments
    .filter(a => ['scheduled','arrived','in_progress'].includes(a.status))
    .sort((a, b) => a.time.localeCompare(b.time))

  async function markArrived(appt) {
    await updateAppointment(appt.id, { status: 'arrived', arrived_at: new Date().toISOString() })
  }

  async function callNext(appt) {
    await updateAppointment(appt.id, { status: 'in_progress', called_at: new Date().toISOString() })
    if (appt.patient_phone) {
      const pro = professionals.find(p => p.id === appt.professional_id)
      openWhatsApp(appt.patient_phone, msgProximo({ patientName: appt.patient_name, room: pro?.room }))
    }
  }

  async function bookWalkIn(e) {
    e.preventDefault()
    if (!form.patientName || !form.professionalId || !form.time) { setMsg('Completá nombre, profesional y hora'); return }
    const pro = professionals.find(p => p.id === form.professionalId)
    const slotMin = pro ? (pro.schedules?.[0]?.slot_min || 30) : 30
    const { error } = await addAppointment({
      professional_id: form.professionalId,
      patient_name: form.patientName,
      patient_phone: form.patientPhone,
      patient_dni: form.patientDni,
      date: TODAY,
      time: form.time,
      slot_min: slotMin,
      notes: form.notes,
      is_walk_in: form.isWalkIn,
      is_first: form.isFirst,
      status: 'scheduled'
    })
    if (error) { setMsg('Error al guardar'); return }
    if (form.patientPhone && pro) {
      openWhatsApp(form.patientPhone, msgConfirmacion({
        patientName: form.patientName,
        professionalName: pro.name,
        date: formatDate(TODAY),
        time: form.time,
        requirements: pro.requirements
      }))
    }
    setForm({ patientName:'', patientPhone:'', patientDni:'', professionalId:'', time:'', notes:'', isWalkIn:false, isFirst:false })
    setMsg('Turno registrado ✓')
    setTab('queue')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-bold">{clinic?.name}</div>
          <div className="text-xs opacity-80">Secretaría · {formatDate(TODAY)}</div>
        </div>
        <button onClick={onLogout} className="text-xs opacity-80 hover:opacity-100">Salir</button>
      </header>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        {['queue','book'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium ${tab===t ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>
            {t === 'queue' ? '🏠 Sala de espera' : '➕ Nuevo turno'}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {msg && <div className="bg-green-100 text-green-800 rounded-lg px-4 py-2 mb-4 text-sm">{msg}</div>}

        {tab === 'queue' && (
          <div className="space-y-3">
            {queue.length === 0 && (
              <p className="text-center text-gray-400 py-12">No hay pacientes en espera</p>
            )}
            {queue.map(a => {
              const pro = professionals.find(p => p.id === a.professional_id)
              return (
                <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{a.patient_name}</div>
                      <div className="text-sm text-gray-500">{a.time} · {pro?.name}</div>
                      {a.is_first && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">1ª consulta</span>}
                      {a.is_walk_in && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full ml-1">Sin turno</span>}
                    </div>
                    <span className="text-xs text-gray-400">{STATUS_LABEL[a.status]}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {a.status === 'scheduled' && (
                      <button onClick={() => markArrived(a)}
                        className="bg-yellow-400 text-white px-3 py-1.5 rounded-lg text-sm">
                        Llegó
                      </button>
                    )}
                    {a.status === 'arrived' && (
                      <button onClick={() => callNext(a)}
                        className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm">
                        Llamar 🔔
                      </button>
                    )}
                    {a.patient_phone && (
                      <button onClick={() => openWhatsApp(a.patient_phone, msgProximo({ patientName: a.patient_name, room: pro?.room }))}
                        className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-sm">
                        WhatsApp
                      </button>
                    )}
                    <button onClick={() => updateAppointment(a.id, { status: 'no_show' })}
                      className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm">
                      No vino
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'book' && (
          <form onSubmit={bookWalkIn} className="bg-white rounded-xl shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-gray-700">Agregar turno de hoy</h2>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre del paciente *"
              value={form.patientName} onChange={e => setForm(f => ({...f, patientName: e.target.value}))} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Teléfono (WhatsApp)"
              value={form.patientPhone} onChange={e => setForm(f => ({...f, patientPhone: e.target.value}))} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="DNI"
              value={form.patientDni} onChange={e => setForm(f => ({...f, patientDni: e.target.value}))} />
            <select className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.professionalId} onChange={e => setForm(f => ({...f, professionalId: e.target.value}))}>
              <option value="">— Profesional *</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name} · {p.specialty}</option>)}
            </select>
            <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} />
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Notas"
              value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isWalkIn} onChange={e => setForm(f => ({...f, isWalkIn: e.target.checked}))} />
                Sin turno previo
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isFirst} onChange={e => setForm(f => ({...f, isFirst: e.target.checked}))} />
                Primera consulta
              </label>
            </div>
            <button type="submit" className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium">
              Registrar turno
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
