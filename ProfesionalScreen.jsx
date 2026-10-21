import React, { useState, useEffect, useRef } from 'react'
import { useClinic } from '../hooks/useClinic'
import { useAppointments } from '../hooks/useAppointments'
import { supabase } from '../lib/supabase'
import { formatDate, toMin, fromMin } from '../utils/slots'

const TODAY = new Date().toISOString().slice(0, 10)

export default function ProfesionalScreen({ session, onLogout }) {
  const { clinic, professionals } = useClinic(session.clinicCode)
  const professional = professionals.find(p => p.id === session.professionalId)
  const { appointments, updateAppointment, cascadeShift } = useAppointments(session.clinicId, TODAY)

  const [tab, setTab] = useState('today')   // today | agenda | config
  const [inAttn, setInAttn] = useState(null)
  const [timerSec, setTimerSec] = useState(0)
  const [timerOn, setTimerOn] = useState(false)
  const [extMin, setExtMin] = useState(15)
  const timerRef = useRef(null)

  const myAppts = appointments
    .filter(a => a.professional_id === session.professionalId)
    .sort((a, b) => a.time.localeCompare(b.time))

  const waitingForMe = myAppts.filter(a => a.status === 'arrived')
  const inProgress   = myAppts.find(a => a.status === 'in_progress')

  // Timer
  useEffect(() => {
    if (timerOn) {
      timerRef.current = setInterval(() => setTimerSec(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerOn])

  function fmtTimer(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  }

  async function callPatient(appt) {
    await updateAppointment(appt.id, { status: 'in_progress', called_at: new Date().toISOString() })
    setInAttn(appt)
    setTimerSec(0)
    setTimerOn(false)
  }

  async function finishConsult() {
    if (!inAttn) return
    await updateAppointment(inAttn.id, { status: 'done', finished_at: new Date().toISOString() })
    setInAttn(null)
    setTimerOn(false)
    setTimerSec(0)
  }

  async function extendConsult() {
    if (!inAttn) return
    await cascadeShift(session.professionalId, TODAY, inAttn.time, extMin)
  }

  if (!professional) return <div className="p-8 text-center">Cargando…</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand-700 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-bold">{professional.name}</div>
          <div className="text-xs opacity-80">{professional.specialty} · {formatDate(TODAY)}</div>
        </div>
        <button onClick={onLogout} className="text-xs opacity-80">Salir</button>
      </header>

      <div className="flex border-b bg-white">
        {['today','agenda','config'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-medium ${tab===t ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>
            {t === 'today' ? '🏥 Hoy' : t === 'agenda' ? '📅 Agenda' : '⚙️ Config'}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">

        {tab === 'today' && (
          <>
            {/* Consulta activa */}
            {inAttn && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-green-800">En consulta</div>
                    <div className="text-lg font-semibold">{inAttn.patient_name}</div>
                  </div>
                  {professional.use_timer && (
                    <div className="text-right">
                      <div className="font-mono text-2xl text-green-700">{fmtTimer(timerSec)}</div>
                      <button onClick={() => setTimerOn(t => !t)}
                        className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-lg mt-1">
                        {timerOn ? 'Pausar' : 'Iniciar'} timer
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={finishConsult}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
                    ✅ Finalizar
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={extendConsult}
                      className="bg-yellow-400 text-white px-3 py-2 rounded-lg text-sm">
                      +{extMin} min
                    </button>
                    <select value={extMin} onChange={e => setExtMin(Number(e.target.value))}
                      className="border rounded px-2 py-2 text-sm">
                      {[5,10,15,20,30].map(n => <option key={n} value={n}>{n} min</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* En espera */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">
                Esperando ({waitingForMe.length})
              </h2>
              {waitingForMe.length === 0 && !inAttn && (
                <p className="text-gray-400 text-sm text-center py-6">Nadie en espera</p>
              )}
              {waitingForMe.map(a => (
                <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.patient_name}</div>
                    <div className="text-sm text-gray-400">{a.time}
                      {a.is_first && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">1ª consulta</span>}
                    </div>
                  </div>
                  {!inAttn && (
                    <button onClick={() => callPatient(a)}
                      className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm">
                      Llamar
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Programados */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">Programados hoy</h2>
              {myAppts.filter(a => a.status === 'scheduled').map(a => (
                <div key={a.id} className="bg-white rounded-xl p-3 mb-2 flex items-center gap-3 text-sm opacity-70">
                  <span className="font-mono text-gray-400">{a.time}</span>
                  <span>{a.patient_name}</span>
                  {a.is_first && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">1ª consulta</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'agenda' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-700">Agenda completa</h2>
            {myAppts.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Sin turnos hoy</p>}
            {myAppts.map(a => (
              <div key={a.id} className={`bg-white rounded-xl p-4 text-sm shadow-sm ${a.status === 'done' ? 'opacity-50' : ''}`}>
                <div className="flex justify-between">
                  <span className="font-semibold">{a.time} — {a.patient_name}</span>
                  <span className="text-gray-400">{a.status}</span>
                </div>
                {a.notes && <div className="text-gray-500 mt-1">{a.notes}</div>}
                {a.shifted > 0 && <div className="text-orange-500 text-xs mt-1">+{a.shifted} min corrido</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'config' && (
          <ConfigPanel professional={professional} clinicId={session.clinicId} />
        )}
      </div>
    </div>
  )
}

function ConfigPanel({ professional, clinicId }) {
  const [useTimer, setUseTimer] = useState(professional.use_timer)
  const [firstMin, setFirstMin] = useState(professional.first_consult_min)
  const [saved, setSaved] = useState(false)

  async function save() {
    await supabase.from('professionals').update({
      use_timer: useTimer,
      first_consult_min: firstMin
    }).eq('id', professional.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-5">
      <h2 className="font-semibold">Mis preferencias</h2>

      <label className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Temporizador por turno</div>
          <div className="text-xs text-gray-400">Cuenta el tiempo durante cada consulta</div>
        </div>
        <input type="checkbox" checked={useTimer} onChange={e => setUseTimer(e.target.checked)}
          className="w-5 h-5 accent-brand-600" />
      </label>

      <div>
        <div className="font-medium text-sm mb-1">Duración primera consulta</div>
        <div className="flex items-center gap-2">
          <input type="number" min={30} max={240} step={15} value={firstMin}
            onChange={e => setFirstMin(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 w-24 text-sm" />
          <span className="text-gray-500 text-sm">minutos</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          El sistema buscará días con este bloque libre para reservar.
        </p>
      </div>

      <button onClick={save}
        className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium text-sm">
        {saved ? '✓ Guardado' : 'Guardar cambios'}
      </button>
    </div>
  )
}
