import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const ROLES = [
  { id: 'paciente',    label: '🙋 Soy paciente',      desc: 'Ver mis turnos y estado de espera' },
  { id: 'secretaria',  label: '🗂 Soy secretaria',     desc: 'Gestionar llegadas y cola de espera' },
  { id: 'profesional', label: '🩺 Soy profesional',    desc: 'Ver agenda y atender pacientes' },
  { id: 'display',     label: '📺 Pantalla de espera', desc: 'Pantalla pública del consultorio' },
  { id: 'admin',       label: '⚙️ Administrador',      desc: 'Gestionar clínica y profesionales' },
]

export default function LandingScreen({ onLogin }) {
  const [step, setStep] = useState('role')      // role | code | pin
  const [role, setRole] = useState(null)
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [proId, setProId] = useState('')
  const [professionals, setProfessionals] = useState([])
  const [clinic, setClinic] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCodeSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: err } = await supabase
      .from('clinics')
      .select('id, code, name')
      .eq('code', code.toUpperCase().trim())
      .eq('active', true)
      .single()

    setLoading(false)
    if (err || !data) { setError('Código de clínica no encontrado'); return }

    setClinic(data)

    if (role === 'paciente' || role === 'display') {
      onLogin({ role, clinicCode: data.code, clinicId: data.id })
      return
    }

    if (role === 'profesional') {
      // Cargar lista para elegir quién es
      const { data: pros } = await supabase
        .from('professionals')
        .select('id, name, specialty, pin')
        .eq('clinic_id', data.id)
        .eq('active', true)
        .order('name')
      setProfessionals(pros || [])
    }

    setStep('pin')
  }

  async function handlePinSubmit(e) {
    e.preventDefault()
    setError('')

    if (role === 'admin') {
      // PIN admin global — en producción esto debería ser más seguro
      if (pin !== '0000') { setError('PIN incorrecto'); return }
      onLogin({ role, clinicCode: clinic.code, clinicId: clinic.id })
      return
    }

    if (role === 'secretaria') {
      // PIN de secretaría almacenado en la clínica (futuro) o fijo
      if (pin !== '1234') { setError('PIN incorrecto'); return }
      onLogin({ role, clinicCode: clinic.code, clinicId: clinic.id })
      return
    }

    if (role === 'profesional') {
      const pro = professionals.find(p => p.id === proId)
      if (!pro) { setError('Seleccioná un profesional'); return }
      if (pro.pin !== pin) { setError('PIN incorrecto'); return }
      onLogin({ role, clinicCode: clinic.code, clinicId: clinic.id, professionalId: proId })
      return
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-brand-700 text-center mb-1">TurnoClínica</h1>
        <p className="text-center text-gray-500 text-sm mb-8">Sistema de gestión de turnos</p>

        {step === 'role' && (
          <div className="space-y-3">
            <p className="font-medium text-gray-700 mb-4">¿Quién sos?</p>
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setStep('code') }}
                className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-colors"
              >
                <div className="font-medium">{r.label}</div>
                <div className="text-sm text-gray-500">{r.desc}</div>
              </button>
            ))}
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <button type="button" onClick={() => setStep('role')} className="text-sm text-brand-600 mb-2">← Volver</button>
            <p className="font-medium text-gray-700">Código de clínica</p>
            <input
              autoFocus
              className="w-full border-2 rounded-lg px-4 py-3 text-lg tracking-widest uppercase focus:outline-none focus:border-brand-500"
              placeholder="ej. DEMO"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-brand-600 text-white rounded-lg py-3 font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Verificando…' : 'Continuar'}
            </button>
          </form>
        )}

        {step === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <button type="button" onClick={() => setStep('code')} className="text-sm text-brand-600 mb-2">← Volver</button>
            <p className="font-medium text-gray-700">
              {role === 'profesional' ? 'Seleccioná tu nombre' : 'Ingresá tu PIN'}
            </p>

            {role === 'profesional' && (
              <select
                className="w-full border-2 rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500"
                value={proId}
                onChange={e => setProId(e.target.value)}
              >
                <option value="">— Seleccioná —</option>
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.name} · {p.specialty}</option>
                ))}
              </select>
            )}

            <input
              autoFocus
              type="password"
              className="w-full border-2 rounded-lg px-4 py-3 text-lg tracking-widest focus:outline-none focus:border-brand-500"
              placeholder="PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={!pin}
              className="w-full bg-brand-600 text-white rounded-lg py-3 font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              Ingresar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
