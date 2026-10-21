# TurnoClínica — contexto para Claude Code

Sistema de gestión de turnos para clínicas pequeñas (psicología, odontología, medicina general).

## Stack
- Vite + React 18
- Supabase (Postgres + realtime subscriptions)
- Tailwind CSS 3

## Arquitectura
```
src/
  App.jsx                 — router de roles
  screens/
    LandingScreen.jsx     — selector de rol + login por código de clínica
    SecretariaScreen.jsx  — sala de espera, registro de llegada, llamar paciente
    ProfesionalScreen.jsx — agenda diaria, consulta activa, timer, cascade
    PacienteScreen.jsx    — búsqueda de turno, reserva con primera consulta
    DisplayScreen.jsx     — pantalla kiosk de sala de espera
    AdminScreen.jsx       — ABM profesionales y horarios
  hooks/
    useClinic.js          — carga clínica + profesionales con schedules
    useAppointments.js    — CRUD turnos + realtime + cascadeShift
  utils/
    slots.js              — getSlots, getFirstConsultSlots, getAvailableDays
    whatsapp.js           — constructores de mensajes WA + openWhatsApp
  lib/
    supabase.js           — cliente Supabase
supabase/migrations/
  001_initial.sql         — schema completo + RLS + datos DEMO
```

## Roles y acceso
| Rol         | Acceso                                    | PIN              |
|-------------|-------------------------------------------|------------------|
| paciente    | sin PIN, sólo código de clínica           | —                |
| display     | sin PIN, pantalla pública                 | —                |
| secretaria  | PIN "1234" (cambiar en producción)        | hardcoded        |
| profesional | PIN individual por profesional (en DB)    | campo `pin`      |
| admin       | PIN "0000" (cambiar en producción)        | hardcoded        |

En producción reemplazar los PINs hardcoded por columnas en la tabla `clinics`.

## Lógica clave
- **Primera consulta**: `getFirstConsultSlots()` verifica que haya N minutos consecutivos libres, no solo que el slot esté libre.
- **Cascade shift**: cuando el profesional extiende una consulta, `cascadeShift()` corre todos los turnos siguientes del mismo profesional en ese día.
- **Realtime**: `useAppointments` suscribe al canal `appointments:{clinicId}:{date}` — cualquier cambio en la DB se refleja en todas las pantallas sin recargar.
- **Multi-tenant**: los datos están aislados por `clinic_id` (UUID). El código de clínica (ej. "DEMO") es solo para lookup inicial.

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar con las credenciales de Supabase:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Pendiente / próximos pasos
- [ ] PINs de secretaría y admin en tabla `clinics` (no hardcoded)
- [ ] Reprogramar/cancelar turno desde SecretariaScreen
- [ ] Bloqueo de días (ausencias del profesional)
- [ ] Recordatorios automáticos día anterior (Supabase Edge Function)
- [ ] Lista de espera para cuando no hay turnos libres
- [ ] Reporte diario por profesional
- [ ] Historial de consultas por paciente
- [ ] Crear nueva clínica desde AdminScreen (ahora solo por SQL)

## Datos DEMO
La migración `001_initial.sql` inserta la clínica `DEMO`.
Para agregar profesionales demo con turnos de prueba, ejecutar:
```sql
-- Ver migrations/001_initial.sql para el schema
-- Insertar profesional de prueba:
INSERT INTO professionals (clinic_id, name, specialty, room, pin, first_consult_min, use_timer)
SELECT id, 'Dra. García', 'Psicología', 'Consultorio 1', '1111', 90, true
FROM clinics WHERE code = 'DEMO';
```
