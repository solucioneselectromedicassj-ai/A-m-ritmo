import React from 'react'
import { useClinic } from '../hooks/useClinic'
import { useAppointments } from '../hooks/useAppointments'

const TODAY = new Date().toISOString().slice(0, 10)

export default function DisplayScreen({ session }) {
  const { clinic, professionals } = useClinic(session.clinicCode)
  const { appointments } = useAppointments(session.clinicId, TODAY)

  const waiting = appointments
    .filter(a => ['arrived', 'in_progress'].includes(a.status))
    .sort((a, b) => a.time.localeCompare(b.time))

  const calling = waiting.filter(a => a.status === 'in_progress')

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-brand-700 px-8 py-5 flex items-center justify-between">
        <div className="text-2xl font-bold">{clinic?.name || 'TurnoClínica'}</div>
        <div className="text-sm opacity-70">
          {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="flex-1 p-8">
        {/* Llamando */}
        {calling.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-green-400 mb-4 tracking-wide">🔊 LLAMANDO</h2>
            <div className="grid gap-4">
              {calling.map(a => {
                const pro = professionals.find(p => p.id === a.professional_id)
                return (
                  <div key={a.id} className="bg-green-900 border border-green-500 rounded-2xl px-8 py-6 flex items-center justify-between animate-pulse">
                    <div className="text-3xl font-bold">{a.patient_name}</div>
                    <div className="text-right">
                      <div className="text-green-300 text-lg">{pro?.name}</div>
                      <div className="text-green-400 text-sm">{pro?.room}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* En espera */}
        <div>
          <h2 className="text-lg font-semibold text-gray-400 mb-4 tracking-wide">
            EN SALA DE ESPERA ({waiting.filter(a => a.status === 'arrived').length})
          </h2>
          <div className="grid gap-3">
            {waiting.filter(a => a.status === 'arrived').map((a, i) => {
              const pro = professionals.find(p => p.id === a.professional_id)
              return (
                <div key={a.id} className="bg-gray-800 rounded-xl px-6 py-4 flex items-center gap-6">
                  <div className="text-gray-500 text-xl font-mono w-8">{i + 1}</div>
                  <div className="flex-1 text-xl font-medium">{a.patient_name}</div>
                  <div className="text-gray-400 text-sm text-right">
                    <div>{pro?.name}</div>
                    <div>{a.time}</div>
                  </div>
                </div>
              )
            })}
            {waiting.filter(a => a.status === 'arrived').length === 0 && (
              <div className="text-center text-gray-600 py-12 text-lg">
                No hay pacientes en espera en este momento
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
