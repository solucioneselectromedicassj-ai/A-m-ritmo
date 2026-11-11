# Declaraciones de Play Console — respuestas sugeridas

> Son sugerencias basadas en lo que la app hace HOY. Play Console cambia sus formularios: leé cada pregunta y respondé lo que corresponda. Si la app cambia (p. ej. anuncios reales, sincronización), hay que rehacerlas.

## Acceso a la app
Toda la funcionalidad está disponible sin cuenta ni credenciales. El ingreso con Google es opcional.

## Anuncios
- "¿Contiene anuncios?" → **No** (hoy la franja "Espacio publicitario" es solo de ejemplo). Si se activa AdMob: **Sí**, y rehacer Seguridad de los datos y la política.
- IMPORTANTE: la franja de ejemplo está activa por defecto (`settings.anunciosDemo`). Para publicar sin anuncios conviene dejarla apagada por defecto (decisión pendiente, ver `PUBLICAR.md`).

## Público objetivo
Mayores de 18 años (la app no está dirigida a menores de 13). No marcar "atrae a niños".

## Clasificación de contenido (cuestionario IARC)
Categoría: utilidad/referencia. Sin violencia, sexo, lenguaje, drogas, apuestas ni contenido generado por usuarios compartido. Resultado esperado: apta para todos.

## Seguridad de los datos (Data safety)
- Datos recopilados y enviados fuera del dispositivo: **ninguno** (todo queda en el teléfono; no hay servidor ni analítica ni SDK de terceros salvo el inicio de sesión opcional de Google).
- Compartición con terceros: **ninguna**.
- Inicio de sesión con Google (opcional): la app lee nombre y correo solo para mostrarlos en el teléfono. Si Play Console te exige declararlo, declará "Información personal → Nombre y Dirección de correo", **recopilado**, **opcional**, finalidad "Funcionalidad de la app", **no compartido**.
- Cifrado en tránsito: no aplica (no se transmiten datos). Solicitud de borrado: los datos se borran desde la app ("Borrar todo") o desinstalando.
- URL de la política de privacidad: la de `docs/privacidad.html` publicada.

## Aplicaciones de salud (Health apps declaration)
- Funciones: seguimiento de actividad y estado físico, registro de nutrición/hábitos, registro de mediciones ingresadas por el usuario, lectura opcional de datos de Health Connect.
- Funciones médicas/clínicas: **ninguna** (no diagnostica, no recomienda tratamientos, no es dispositivo médico). La app incluye el descargo en su pantalla de inicio, en Ajustes y en la ficha.

## Permisos
- `ACTIVITY_RECOGNITION`: contar pasos con el sensor del teléfono (opcional, el módulo de pasos).
- `POST_NOTIFICATIONS`: recordatorios que la persona configura.
- `READ_OXYGEN_SATURATION`, `READ_HEART_RATE` (Health Connect, solo lectura): traer saturación y pulso del reloj si la persona lo activa. Se usan solo para mostrar y para el informe; no se comparten ni se usan para anuncios.
- `INTERNET`: viene del esqueleto de Capacitor; la app no envía datos de salud a ningún servidor.
- Health Connect: la app tiene la pantalla de "por qué pedimos estos permisos" (`PermisosSaludActivity`) y enlaza la política de privacidad.

## Declaración de tipo de servicio / alarmas
La app usa notificaciones locales programadas; si Play pregunta por alarmas exactas o servicios en primer plano, la respuesta es que no declara `SCHEDULE_EXACT_ALARM` ni servicios en primer plano (el sensor de pasos usa WorkManager).
