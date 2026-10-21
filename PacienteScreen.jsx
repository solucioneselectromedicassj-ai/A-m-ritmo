import React, { useState } from 'react'
import { useClinic } from '../hooks/useClinic'
import { useAppointments } from '../hooks/useAppointments'
import { getAvailableDays, formatDate } from '../utils/slots'
import { supabase } from '../lib/supabase'
import { openWhatsApp, msgConfirmacion } from '../utils/whatsapp'

const TODAY = new Date().toISOString().slice(0, 10)

export default function PacienteScreen({ session, onLogout }) {
  const { clinic, professionals, loading } = useClinic(session.clinicCode)
  const { appointments, addAppointment } = useAppointments(session.clinicId)
  const [view, setView] = useState('search')   // search | book | status
  const [search, setSearch] = useState('')
  const [myAppt, setMyAppt] = useState(null)
  const [bookStep, setBookStep] = useState(0)
  const [sel, setSel] = useState({ proId: '', dateStr: '', time: '' })
  const [form, setForm] = useState({ name: '', phone: '', dni: '', notes: '' })
  const [done, setDone] = useState(false)

  if (loading) return <div className="p-8 text-center">Cargando…</div>

  // Buscar mi turno por nombre o teléfono
  function doSearch() {
    const q = search.toLowerCase().trim()
    const found = appointments.find(a =>
      a.date === TODAY &&
      (a.patient_name.toLowerCase().includes(q) || a.patient_phone.includes(q))
    )
    setMyAppt(found || null)
    setView('status')
  }

  // Posición en la cola
  function myQueuePos(appt) {
    const proQueue = appointments.filter(a =>
      a.professional_id === appt.professional_id &&
      a.date === TODAY &&
      ['arrived','in_progress'].includes(a.status)
    ).sort((a,b) => a.time.localeCompare(b.time))
    const idx = proQueue.findIndex(a => a.id === appt.id)
    return idx === -1 ? null : idx + 1
  }

  const selectedPro = professionals.find(p => p.id === sel.proId)
  const availableDays = selectedPro
    ? getAvailableDays(selectedPro, appointments)
    : []

  async function confirmBook() {
    if (!form.name || !sel.proId || !sel.dateStr || !sel.time) return
    const { data, error } = await addAppointment({
      professional_id: sel.proId,
      patient_name: form.name,
      patient_phone: form.phone,
      patient_dni: form.dni,
      date: sel.dateStr,
      time: sel.time,
      notes: form.notes,
      is_first: bookStep === 99,  // flag especial si se eligió "primera consulta"
      status: 'scheduled',
      slot_min: selectedPro?.schedules?.[0]?.slot_min || 30
    })
    if (!error && form.phone && selectedPro) {
      openWhatsApp(form.phone, msgConfirmacion({
        patientName: form.name,
        professionalName: selectedPro.name,
        date: formatDate(sel.dateStr),
        time: sel.time,
        requirements: selectedPro.requirements
      }))
    }
    setDone(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-bold">{clinic?.name}</div>
          <div className="text-xs opacity-80">Portal paciente</div>
        </div>
        <button onClick={onLogout} className="text-xs opacity-80">Salir</button>
      </header>

      <div className="flex border-b bg-white">
        {['search','book'].map(t => (
          <button key={t} onClick={() => { setView(t); setDone(false) }}
            className={`flex-1 py-3 text-sm font-medium ${view===t ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>
            {t === 'search' ? '🔍 Mi turno de hoy' : '📅 Reservar turno'}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-md mx-auto">

        {/* ── BUSCAR MI TURNO ── */}
        {(view === 'search' || view === 'status') && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="Tu nombre o teléfono"
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()} />
              <button onClick={doSearch}
                className="bg-brand-600 text-white px-4 rounded-lg text-sm">Buscar</button>
            </div>

            {view === 'status' && !myAppt && (
              <div className="text-center text-gray-400 py-8">No encontramos tu turno de hoy.</div>
            )}

            {view === 'status' && myAppt && (() => {
              const pro = professionals.find(p => p.id === myAppt.professional_id)
              const pos = myQueuePos(myAppt)
              return (
                <div className="bg-white rounded-xl shadow p-5 space-y-3">
                  <div className="text-xl font-bold">{myAppt.patient_name}</div>
                  <div className="text-sm text-gray-500">{pro?.name} · {myAppt.time}</div>
                  {myAppt.status === 'scheduled' && (
                    <div className="bg-blue-50 text-blue-700 rounded-lg px-4 py-3 text-sm">
                      ⏳ Aún no llegaste. Presentate en recepción.
                    </div>
                  )}
                  {myAppt.status === 'arrived' && pos !== null && (
                    <div className="bg-yellow-50 text-yellow-800 rounded-lg px-4 py-3">
                      <div className="text-2xl font-bold">{pos === 1 ? '¡Sos el próximo!' : `Faltan ${pos - 1} personas`}</div>
                      <div className="text-sm mt-1">Posición en sala: {pos}</div>
                    </div>
                  )}
                  {myAppt.status === 'in_progress' && (
                    <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 font-semibold">
                      🟢 ¡Te están llamando! Entrá al consultorio.
                    </div>
                  )}
                  {myAppt.status === 'done' && (
                    <div className="bg-gray-100 text-gray-600 rounded-lg px-4 py-3">✅ Turno atendido. ¡Hasta pronto!</div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── RESERVAR TURNO ── */}
        {view === 'book' && !done && (
          <div className="space-y-4">
            {/* Paso 0 — elegir profesional */}
            {bookStep === 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-700">¿Con quién querés turno?</h2>
                {professionals.map(p => (
                  <button key={p.id} onClick={() => { setSel(s => ({...s, proId: p.id})); setBookStep(1) }}
                    className="w-full text-left bg-white rounded-xl p-4 shadow-sm border-2 border-transparent hover:border-brand-400">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-400">{p.specialty}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Paso 1 — tipo de turno */}
            {bookStep === 1 && selectedPro && (
              <div className="space-y-3">
                <button onClick={() => setBookStep(0)} className="text-sm text-brand-600">← Volver</button>
                <h2 className="font-semibold">¿Es tu primera consulta?</h2>
                <button onClick={() => setBookStep(99)}
                  className="w-full bg-purple-50 border-2 border-purple-200 rounded-xl p-4 text-left hover:border-purple-400">
                  <div className="font-medium text-purple-700">Sí, es primera vez 🌟</div>
                  <div className="text-sm text-gray-400">
                    {selectedPro.first_consult_min} minutos · se buscarán días disponibles
                  </div>
                </button>
                <button onClick={() => setBookStep(2)}
                  className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 text-left hover:border-brand-400">
                  <div className="font-medium">No, ya soy paciente</div>
                  <div className="text-sm text-gray-400">Turno estándar</div>
                </button>
              </div>
            )}

            {/* Paso 2/99 — elegir día */}
            {(bookStep === 2 || bookStep === 99) && (
              <div className="space-y-3">
                <button onClick={() => setBookStep(1)} className="text-sm text-brand-600">← Volver</button>
                <h2 className="font-semibold">Elegí un día</h2>
                {availableDays.length === 0 && (
                  <p className="text-gray-400 text-sm">Sin disponibilidad en los próximos 14 días.</p>
                )}
                {availableDays.map(day => (
                  <button key={day.dateStr}
                    onClick={() => { setSel(s => ({...s, dateStr: day.dateStr, time: ''})); setBookStep(bookStep + 10) }}
                    className="w-full text-left bg-white rounded-xl p-4 shadow-sm border-2 border-transparent hover:border-brand-400">
                    <div className="font-medium">{formatDate(day.dateStr)}</div>
                    <div className="text-sm text-gray-400">{day.slots.length} horarios disponibles</div>
                  </button>
                ))}
              </div>
            )}

            {/* Paso elegir horario */}
            {(bookStep === 12 || bookStep === 109) && sel.dateStr && (
              <div className="space-y-3">
                <button onClick={() => setBookStep(bookStep - 10)} className="text-sm text-brand-600">← Volver</button>
                <h2 className="font-semibold">Elegí un horario</h2>
                <div className="grid grid-cols-3 gap-2">
                  {availableDays.find(d => d.dateStr === sel.dateStr)?.slots.map(t => (
                    <button key={t}
                      onClick={() => { setSel(s => ({...s, time: t})); setBookStep(bookStep + 10) }}
                      className={`py-2 rounded-lg text-sm border-2 ${sel.time === t ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Paso datos personales */}
            {(bookStep === 22 || bookStep === 119) && sel.time && (
              <div className="space-y-3">
                <button onClick={() => setBookStep(bookStep - 10)} className="text-sm text-brand-600">← Volver</button>
                <h2 className="font-semibold">Tus datos</h2>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre completo *"
                  value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Teléfono (WhatsApp)"
                  value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="DNI"
                  value={form.dni} onChange={e => setForm(f => ({...f, dni: e.target.value}))} />
                {selectedPro?.requirements && (
                  <div className="bg-yellow-50 text-yellow-800 text-sm rounded-lg p-3">
                    📋 {selectedPro.requirements}
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="font-medium">{selectedPro?.name}</div>
                  <div>{formatDate(sel.dateStr)} a las {sel.time}</div>
                </div>
                <button onClick={confirmBook} disabled={!form.name}
                  className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50">
                  Confirmar turno
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'book' && done && (
          <div className="text-center py-12 space-y-4">
            <div className="text-5xl">✅</div>
            <div className="text-xl font-bold text-green-700">¡Turno reservado!</div>
            <p className="text-gray-500 text-sm">Si dejaste tu WhatsApp, recibirás la confirmación.</p>
            <button onClick={() => { setDone(false); setBookStep(0); setSel({proId:'',dateStr:'',time:''}); setForm({name:'',phone:'',dni:'',notes:''}) }}
              className="bg-brand-600 text-white px-6 py-2 rounded-lg">
              Reservar otro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
