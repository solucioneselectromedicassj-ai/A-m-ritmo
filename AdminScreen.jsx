import React, { useState } from 'react'
import { useClinic } from '../hooks/useClinic'
import { supabase } from '../lib/supabase'

const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const EMPTY_PRO = {
  name: '', specialty: '', room: '', pin: '',
  use_timer: false, first_consult_min: 60,
  requirements: '', reminder_pat: '', reminder_pro: ''
}

export default function AdminScreen({ session, onLogout }) {
  const { clinic, professionals, setProfessionals, loading } = useClinic(session.clinicCode)
  const [tab, setTab] = useState('pros')   // pros | new
  const [editPro, setEditPro] = useState(null)
  const [form, setForm] = useState(EMPTY_PRO)
  const [schedules, setSchedules] = useState([])
  const [msg, setMsg] = useState('')

  if (loading) return <div className="p-8 text-center">Cargando…</div>

  function openNew() {
    setForm(EMPTY_PRO)
    setSchedules([])
    setEditPro(null)
    setTab('new')
  }

  function openEdit(pro) {
    setForm({
      name: pro.name, specialty: pro.specialty, room: pro.room, pin: pro.pin,
      use_timer: pro.use_timer, first_consult_min: pro.first_consult_min,
      requirements: pro.requirements, reminder_pat: pro.reminder_pat, reminder_pro: pro.reminder_pro
    })
    setSchedules(pro.schedules || [])
    setEditPro(pro)
    setTab('new')
  }

  function toggleDay(dow) {
    setSchedules(prev => {
      if (prev.find(s => s.day_of_week === dow)) {
        return prev.filter(s => s.day_of_week !== dow)
      }
      return [...prev, { day_of_week: dow, start_time: '09:00', end_time: '17:00', slot_min: 30 }]
    })
  }

  function updateSched(dow, field, val) {
    setSchedules(prev => prev.map(s => s.day_of_week === dow ? { ...s, [field]: val } : s))
  }

  async function savePro() {
    if (!form.name || !form.specialty) { setMsg('Nombre y especialidad son obligatorios'); return }
    let proId = editPro?.id

    if (editPro) {
      await supabase.from('professionals').update({ ...form }).eq('id', editPro.id)
    } else {
      const { data } = await supabase.from('professionals')
        .insert({ ...form, clinic_id: clinic.id }).select().single()
      proId = data?.id
    }

    if (proId) {
      // Borrar horarios anteriores y reinsertar
      await supabase.from('schedules').delete().eq('professional_id', proId)
      if (schedules.length > 0) {
        await supabase.from('schedules').insert(
          schedules.map(s => ({ ...s, professional_id: proId }))
        )
      }
    }

    setMsg(editPro ? 'Profesional actualizado ✓' : 'Profesional creado ✓')
    setTab('pros')
    setTimeout(() => setMsg(''), 3000)
  }

  async function toggleActive(pro) {
    await supabase.from('professionals').update({ active: !pro.active }).eq('id', pro.id)
    setProfessionals(prev => prev.map(p => p.id === pro.id ? { ...p, active: !pro.active } : p))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-bold">{clinic?.name}</div>
          <div className="text-xs opacity-70">Administrador</div>
        </div>
        <button onClick={onLogout} className="text-xs opacity-70">Salir</button>
      </header>

      <div className="flex border-b bg-white">
        <button onClick={() => setTab('pros')}
          className={`flex-1 py-3 text-sm font-medium ${tab==='pros'?'border-b-2 border-gray-700 text-gray-700':'text-gray-500'}`}>
          👥 Profesionales
        </button>
        <button onClick={openNew}
          className={`flex-1 py-3 text-sm font-medium ${tab==='new'?'border-b-2 border-gray-700 text-gray-700':'text-gray-500'}`}>
          ➕ {editPro ? 'Editar' : 'Nuevo'}
        </button>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {msg && <div className="bg-green-100 text-green-800 rounded-lg px-4 py-2 mb-4 text-sm">{msg}</div>}

        {tab === 'pros' && (
          <div className="space-y-3">
            {professionals.length === 0 && (
              <p className="text-center text-gray-400 py-8">Sin profesionales. Creá el primero.</p>
            )}
            {professionals.map(p => (
              <div key={p.id} className={`bg-white rounded-xl shadow-sm p-4 ${!p.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-gray-400">{p.specialty} · Consultorio {p.room}</div>
                    <div className="text-xs text-gray-300 mt-0.5">
                      {(p.schedules || []).map(s => DAYS[s.day_of_week]).join(', ')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)}
                      className="text-xs bg-gray-100 px-3 py-1.5 rounded-lg">Editar</button>
                    <button onClick={() => toggleActive(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg ${p.active ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {p.active ? 'Deshab.' : 'Habilitar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'new' && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
            <h2 className="font-semibold">{editPro ? 'Editar profesional' : 'Nuevo profesional'}</h2>

            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre completo *"
              value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Especialidad *"
              value={form.specialty} onChange={e => setForm(f => ({...f, specialty: e.target.value}))} />
            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Consultorio"
                value={form.room} onChange={e => setForm(f => ({...f, room: e.target.value}))} />
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="PIN de acceso"
                value={form.pin} onChange={e => setForm(f => ({...f, pin: e.target.value}))} />
            </div>

            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2}
              placeholder="Requisitos para el paciente"
              value={form.requirements} onChange={e => setForm(f => ({...f, requirements: e.target.value}))} />

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.use_timer}
                  onChange={e => setForm(f => ({...f, use_timer: e.target.checked}))} />
                Temporizador
              </label>
              <div className="flex items-center gap-2 text-sm">
                <span>1ª consulta:</span>
                <input type="number" min={30} max={240} step={15} value={form.first_consult_min}
                  onChange={e => setForm(f => ({...f, first_consult_min: Number(e.target.value)}))}
                  className="border rounded px-2 py-1 w-16 text-sm" />
                <span className="text-gray-400">min</span>
              </div>
            </div>

            {/* Horarios */}
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Días de atención</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {DAYS.map((d, i) => (
                  <button key={i} type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm border-2 ${schedules.find(s=>s.day_of_week===i) ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200'}`}>
                    {d}
                  </button>
                ))}
              </div>
              {schedules.sort((a,b)=>a.day_of_week-b.day_of_week).map(s => (
                <div key={s.day_of_week} className="flex items-center gap-2 mb-2 text-sm">
                  <span className="w-8 text-gray-500 font-medium">{DAYS[s.day_of_week]}</span>
                  <input type="time" value={s.start_time} onChange={e => updateSched(s.day_of_week,'start_time',e.target.value)}
                    className="border rounded px-2 py-1" />
                  <span className="text-gray-400">a</span>
                  <input type="time" value={s.end_time} onChange={e => updateSched(s.day_of_week,'end_time',e.target.value)}
                    className="border rounded px-2 py-1" />
                  <select value={s.slot_min} onChange={e => updateSched(s.day_of_week,'slot_min',Number(e.target.value))}
                    className="border rounded px-2 py-1">
                    {[15,20,30,45,60].map(n=><option key={n} value={n}>{n}′</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={savePro}
                className="flex-1 bg-gray-800 text-white py-2.5 rounded-lg font-medium text-sm">
                {editPro ? 'Guardar cambios' : 'Crear profesional'}
              </button>
              <button onClick={() => setTab('pros')}
                className="px-4 border rounded-lg text-sm text-gray-500">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
