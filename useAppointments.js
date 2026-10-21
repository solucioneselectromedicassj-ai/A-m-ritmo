import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Carga turnos de una clínica para una fecha dada (o todas las fechas).
 * Se suscribe a cambios en tiempo real para sincronizar entre dispositivos.
 *
 * @param {string} clinicId  - UUID de la clínica
 * @param {string} date      - "2024-03-15" o null para todos
 */
export function useAppointments(clinicId, date = null) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!clinicId) return
    setLoading(true)

    let query = supabase
      .from('appointments')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('date')
      .order('time')

    if (date) query = query.eq('date', date)

    const { data } = await query
    setAppointments(data || [])
    setLoading(false)
  }, [clinicId, date])

  useEffect(() => {
    fetch()

    if (!clinicId) return

    // Suscripción realtime — sincroniza sala de espera entre dispositivos
    const channel = supabase
      .channel(`appointments:${clinicId}:${date || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `clinic_id=eq.${clinicId}`
        },
        () => fetch()   // refetch completo al recibir cualquier cambio
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [clinicId, date, fetch])

  // ── Mutaciones ──────────────────────────────────────────────────────────────

  async function addAppointment(appt) {
    const { data, error } = await supabase
      .from('appointments')
      .insert({ ...appt, clinic_id: clinicId })
      .select()
      .single()
    if (!error) setAppointments(prev => [...prev, data])
    return { data, error }
  }

  async function updateAppointment(id, changes) {
    const { data, error } = await supabase
      .from('appointments')
      .update(changes)
      .eq('id', id)
      .select()
      .single()
    if (!error) setAppointments(prev => prev.map(a => a.id === id ? data : a))
    return { data, error }
  }

  async function removeAppointment(id) {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
    if (!error) setAppointments(prev => prev.filter(a => a.id !== id))
    return { error }
  }

  /**
   * Cascade: cuando se extiende una consulta, corre todos los turnos
   * posteriores del mismo profesional en el mismo día.
   */
  async function cascadeShift(professionalId, apptDate, afterTime, extraMin) {
    const toShift = appointments.filter(a =>
      a.professional_id === professionalId &&
      a.date === apptDate &&
      a.time > afterTime &&
      !['done', 'cancelled', 'no_show'].includes(a.status)
    )
    for (const a of toShift) {
      const [h, m] = a.time.split(':').map(Number)
      const newMin = h * 60 + m + extraMin
      const newTime = `${String(Math.floor(newMin/60)).padStart(2,'0')}:${String(newMin%60).padStart(2,'0')}`
      await updateAppointment(a.id, {
        time: newTime,
        shifted: (a.shifted || 0) + extraMin
      })
    }
  }

  return {
    appointments,
    loading,
    refetch: fetch,
    addAppointment,
    updateAppointment,
    removeAppointment,
    cascadeShift
  }
}
