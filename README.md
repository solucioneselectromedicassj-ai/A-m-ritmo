# TurnoClínica

Sistema de gestión de turnos para clínicas pequeñas — psicología, odontología, medicina general.

## Setup rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Crear proyecto en Supabase
1. Ir a [supabase.com](https://supabase.com) → New project
2. En el SQL Editor, ejecutar el contenido de `supabase/migrations/001_initial.sql`

### 3. Variables de entorno
```bash
cp .env.example .env.local
```
Completar con la URL y la `anon key` de tu proyecto (Settings → API en Supabase).

### 4. Correr en desarrollo
```bash
npm run dev
```

---

## Credenciales DEMO

| Rol          | Código clínica | PIN    |
|--------------|----------------|--------|
| Paciente     | DEMO           | —      |
| Pantalla     | DEMO           | —      |
| Secretaría   | DEMO           | 1234   |
| Profesional  | DEMO           | PIN individual del profesional |
| Admin        | DEMO           | 0000   |

> Primero crear al menos un profesional desde el rol Admin antes de usar Secretaría o Profesional.

---

## Roles

### 🙋 Paciente
- Busca su turno del día por nombre o teléfono
- Ve su posición en la cola de espera
- Reserva nuevo turno (turno estándar o primera consulta)
- Recibe confirmación por WhatsApp

### 🗂 Secretaría
- Ve la sala de espera en tiempo real
- Registra la llegada del paciente
- Llama al paciente (envía WA automático)
- Agrega turnos de última hora

### 🩺 Profesional
- Ve su agenda del día
- Llama al siguiente paciente
- Timer manual durante la consulta
- Extiende la consulta → corre turnos siguientes automáticamente
- Configura duración de primera consulta y timer

### 📺 Pantalla (Display)
- Vista kiosk para sala de espera
- Muestra quién está siendo llamado (parpadeante)
- Lista de pacientes en espera
- Se actualiza en tiempo real

### ⚙️ Admin
- Crea y edita profesionales
- Configura horarios por día (días, horario, duración de slot)
- Habilita/deshabilita profesionales

---

## Primera consulta

Cuando un paciente selecciona "primera vez", el sistema busca días con un bloque **continuo** disponible igual a `first_consult_min` del profesional (configurable desde 30 a 240 min). Así se garantiza que el slot no quede partido por otros turnos.

## Sincronización en tiempo real

Gracias a las suscripciones de Supabase Realtime, todos los dispositivos conectados a la misma clínica ven los cambios al instante — sin necesidad de recargar la página.
