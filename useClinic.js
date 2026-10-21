import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Carga la clínica por su código (ej. "DEMO") y los profesionales activos.
 * También suscribe a cambios en tiempo real en appointments.
 */
export function useClinic(clinicCode) {
  const [clinic, setClinic] = useState(null)
  const [professionals, setProfessionals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!clinicCode) return

    async function load() {
      setLoading(true)
      setError(null)

      // Buscar clínica
      const { data: clinicData, error: clinicErr } = await supabase
        .from('clinics')
        .select('*')
        .eq('code', clinicCode.toUpperCase())
        .eq('active', true)
        .single()

      if (clinicErr || !clinicData) {
        setError('Código de clínica no encontrado')
        setLoading(false)
        return
      }
      setClinic(clinicData)

      // Cargar profesionales con sus horarios
      const { data: pros, error: prosErr } = await supabase
        .from('professionals')
        .select('*, schedules(*)')
        .eq('clinic_id', clinicData.id)
        .eq('active', true)
        .order('name')

      if (!prosErr) setProfessionals(pros || [])
      setLoading(false)
    }

    load()
  }, [clinicCode])

  return { clinic, professionals, setProfessionals, loading, error }
}
