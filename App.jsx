import React, { useState } from 'react'
import LandingScreen from './screens/LandingScreen'
import SecretariaScreen from './screens/SecretariaScreen'
import ProfesionalScreen from './screens/ProfesionalScreen'
import PacienteScreen from './screens/PacienteScreen'
import DisplayScreen from './screens/DisplayScreen'
import AdminScreen from './screens/AdminScreen'

/**
 * Roles disponibles.
 * session = { role, clinicCode, clinicId, professionalId? }
 */
export default function App() {
  const [session, setSession] = useState(null)

  function handleLogin(sess) {
    setSession(sess)
  }

  function handleLogout() {
    setSession(null)
  }

  if (!session) {
    return <LandingScreen onLogin={handleLogin} />
  }

  const props = { session, onLogout: handleLogout }

  switch (session.role) {
    case 'secretaria': return <SecretariaScreen {...props} />
    case 'profesional': return <ProfesionalScreen {...props} />
    case 'paciente':    return <PacienteScreen    {...props} />
    case 'display':     return <DisplayScreen     {...props} />
    case 'admin':       return <AdminScreen        {...props} />
    default:            return <LandingScreen onLogin={handleLogin} />
  }
}
