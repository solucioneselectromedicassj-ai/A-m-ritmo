-- TurnoClínica — schema inicial
-- Ejecutar en Supabase SQL Editor o con `supabase db push`

-- ─── Clínicas ────────────────────────────────────────────────────────────────
create table if not exists clinics (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- ej. "DEMO", "PSI01"
  name        text not null,
  address     text,
  phone       text,
  logo_url    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── Profesionales ───────────────────────────────────────────────────────────
create table if not exists professionals (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references clinics(id) on delete cascade,
  name               text not null,
  specialty          text not null default '',
  room               text not null default '',
  pin                text not null default '',          -- PIN de acceso al rol
  use_timer          boolean not null default false,    -- temporizador por turno
  first_consult_min  int not null default 60,           -- duración primera consulta
  requirements       text not null default '',          -- texto libre para el paciente
  reminder_pat       text not null default '',          -- recordatorio para paciente
  reminder_pro       text not null default '',          -- recordatorio para profesional
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- Horarios semanales del profesional (un registro por día configurado)
create table if not exists schedules (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professionals(id) on delete cascade,
  day_of_week      int not null check (day_of_week between 0 and 6), -- 0=Dom, 1=Lun…
  start_time       text not null,   -- "08:00"
  end_time         text not null,   -- "17:00"
  slot_min         int not null default 30,
  created_at       timestamptz not null default now(),
  unique (professional_id, day_of_week)
);

-- ─── Turnos ──────────────────────────────────────────────────────────────────
create table if not exists appointments (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  professional_id  uuid not null references professionals(id) on delete cascade,
  patient_name     text not null,
  patient_phone    text not null default '',
  patient_dni      text not null default '',
  date             text not null,   -- "2024-03-15"
  time             text not null,   -- "09:30"
  slot_min         int not null default 30,
  notes            text not null default '',
  -- tipos especiales
  is_walk_in       boolean not null default false,
  is_first         boolean not null default false,  -- primera consulta
  -- estado del turno
  status           text not null default 'scheduled'
                   check (status in ('scheduled','arrived','in_progress','done','cancelled','no_show')),
  arrived_at       timestamptz,
  called_at        timestamptz,
  finished_at      timestamptz,
  shifted          int not null default 0,   -- minutos corridos por cascade
  created_at       timestamptz not null default now()
);

-- Índices de consulta frecuente
create index if not exists appointments_clinic_date
  on appointments (clinic_id, date);
create index if not exists appointments_professional_date
  on appointments (professional_id, date);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Por ahora las políticas son permisivas (anon puede todo).
-- Cuando agregues autenticación real, restringir por clinic_id.

alter table clinics       enable row level security;
alter table professionals enable row level security;
alter table schedules     enable row level security;
alter table appointments  enable row level security;

-- Políticas permisivas para la fase MVP (código de clínica como "auth")
create policy "anon_clinics_all"       on clinics       for all using (true) with check (true);
create policy "anon_professionals_all" on professionals for all using (true) with check (true);
create policy "anon_schedules_all"     on schedules     for all using (true) with check (true);
create policy "anon_appointments_all"  on appointments  for all using (true) with check (true);

-- ─── Datos DEMO ───────────────────────────────────────────────────────────────
insert into clinics (code, name, address, phone) values
  ('DEMO', 'Clínica Demo TurnoClínica', 'Av. Ejemplo 123', '2644000000')
on conflict (code) do nothing;
