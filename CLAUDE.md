# A Mi Ritmo

> Nombre interno anterior: "Mi Plan". Por eso la clave de localStorage sigue siendo `miplanV1` (no cambiarla: sería perder datos). applicationId: `ar.amiritmo.app` (definitivo una vez publicada).

App configurable (PWA + APK Android con Capacitor) para que cada persona arme **su propio plan** de ejercicio, mediciones y hábitos, lo registre y, si quiere, se lo muestre a su profesional de la salud.
Nace de "Salud Activa" (app personal en `/appgym`), pero **no comparte datos ni claves con ella** y no trae ningún registro cargado.
Idioma de la interfaz: español rioplatense (voseo). Todo funciona sin conexión.

## Idea del producto
- Nada viene prendido: un asistente inicial (`viewAsistente`) deja elegir **qué seguir** (módulos), **qué mediciones** (presión, peso, colesterol, saturación, glucosa o una propia), **qué ejercicios** (biblioteca de ejemplos o propios, con repeticiones/series/segundos y días) y el **modo**.
- Módulos (`S.modulos`): ejercicio, pasos, agua, actividad, comida, medidas.
- Modos (`S.modo`):
  - `registro`: solo registra, **sin recordatorios ni avisos**.
  - `recordatorios`: registra y programa notificaciones (agua, mediciones con hora, rutinas con hora).
  - `avisos`: lo anterior + avisa cuando un valor queda fuera de los límites que la persona definió.
- Informe para el profesional: período y secciones elegibles, tablas con variación %, gráficos con los límites, adherencia; en la web se imprime, en el APK se comparte como `.html` autónomo.

## Reglas de diseño (importante: es una app de salud usada por terceros)
- **No hardcodear metas ni umbrales clínicos.** Todo límite (`campo.min/max`, metas de pasos/agua/actividad) arranca en `null` y lo fija la persona o su profesional. Los avisos solo existen con modo `avisos` y usan únicamente esos límites.
- **No diagnosticar, no dar dosis, no recomendar tratamientos.** Los ejercicios de `BIBLIOTECA` son ejemplos suaves y sin carga; antes de publicar en tienda deben revisarse con un profesional. Todo ejercicio nuevo: espalda neutra, sin saltos ni esfuerzos máximos.
- Mantener el pie `AVISO_PIE` ("ayuda personal, no reemplaza indicaciones médicas") y que el informe aclare que son registros hechos por la propia persona.
- Las sugerencias de alimentación (`SUGERENCIAS_COMIDA`) son ejemplos para elegir; nunca se agregan solas.
- Botones táctiles ≥ 44 px (hay prueba) y sin desborde a 360 px.
- Escapar siempre texto del usuario con `esc()` antes de ir a `innerHTML` (hay prueba de XSS en todas las pantallas y en el informe).
- Datos sensibles de salud: todo queda **solo en el dispositivo** (localStorage). No agregar red/analítica/sincronización sin política de privacidad y consentimiento (Ley 25.326 en Argentina; Google Play exige declaración de datos de salud).

## Estructura
```
index.html      shell + navegación dinámica (#nav) + modal (#modal)
styles.css      tema claro/oscuro, mobile first
app.js          toda la lógica (IIFE, sin dependencias)
figuras.js      ilustraciones SVG de ejercicios (window.FIG(id)); un ejercicio de la biblioteca necesita su pose aquí
sw.js           service worker (cache-first), CACHE = 'amiritmo-vN'
manifest.json, icon.svg, icon-192.png, icon-512.png
tests/          Playwright + Chromium: `npm test`
capacitor.config.json, package.json, scripts/build-web.js   empaquetado Android
android/        proyecto Capacitor (appId ar.amiritmo.app), StepCounterPlugin + StepWorker (sensor de pasos en segundo plano)
.github/workflows/android.yml   compila el APK y lo publica como prerelease `apk-latest`
```

## Datos (`localStorage`, clave `miplanV1`, `VERSION` = 1)
```
{ v, listo, modo, modulos:{ejercicio,pasos,agua,actividad,comida,medidas},
  settings:{ metaPasos, metaAgua, aeroMeta, vaso, descansoSeg, aguaDesde, aguaHasta, recAgua, recMin, segundoPlano, pasosRechazos,
            recPasos, recPasosHora, seguirOn, seguirHora,
            notas, color (coral|azul|verde|violeta|naranja|rosa|gris), ultimoRespaldo, respaldoPospuesto, creado, informe:{periodo, excluir:{}} },
  ejercicios:[{id,n,tipo:'reps'|'series'|'tiempo',meta|series,reps|seg,nota?,fig?}],
  sesiones:[{id,n,dias:[0-6],hora,ej:[ids]}],
  medidas:[{id,tipo,n,campos:[{k,n,u,r,opc,dec,min,max}],repetirMeses,recordarHora}],
  registros:{ medidaId:[{fecha,…valores}] },          // un registro por fecha: cargar la misma fecha lo completa
  days:{ 'YYYY-MM-DD':{pasos,agua,ej:{id:n},omit:{sesId},omitEj:{id:true},comida:{id},cont:{id}} },
  comida:{items:[{id,n}],contadores:[{id,n,meta}]}, aero:[{fecha,min,tipo}], molestias:{},
  recup:{ejId:n}, cerrados:{'YYYY-MM-DD|ejId':true}, recordatorios:[{id,txt,hora,dias:[0-6]}], sensor }
```
- **Nunca se pierden datos**: `load()` solo agrega campos, conserva claves desconocidas, deja copia intacta `miplanV1_antes_vN` si el formato es más viejo, conserva JSON corrupto en `miplanV1_corrupto` y guarda lo anterior en `miplanV1_antes_importar` al importar.
- Si se cambia el formato: subir `VERSION`, migración aditiva y prueba con datos del formato anterior (`tests/26-datos.test.js`).
- Respaldo: exportar (APK: caché + compartir; web: descarga), copiar, importar, recordatorio en Hoy (hay registros + ≥3 días de uso + ≥7 días sin respaldo), "Borrar todo" con oferta de exportar y doble confirmación.

## Recordatorios (Android)
`setupReminders()` / `scheduleNative` solo programan si el modo no es `registro`. Ids: 1000+ agua, 2000+i mediciones con hora, 3000+i*10+día rutinas con hora (weekday = día+1), 3600+día pregunta de la noche, 3700 pasos del día, 4000+i*10+día recordatorios propios, 9999 prueba, 3900 aviso de "mañana" tras "No pude hoy" (se preserva al reprogramar). Lo que ya se cumplió hoy (rutina hecha u omitida, medición anotada, agua en la meta) **no vuelve a avisar hoy**: su aviso pasa a `at` = próxima vez con `repeats`/`every` (`reprogramarSiCambio` re-agenda al cambiar el estado). Sin permiso de notificaciones se avisa y no se programa. En la web solo hay recordatorio de agua con la app abierta.

## Cómo correrlo y probarlo
```
python3 -m http.server 8080      # abrir http://localhost:8080
npm install && npm test          # node --check + tests/run.js (filtro: node tests/run.js "texto")
npm run sync                     # copia a www/ y sincroniza android/
```
Las pruebas usan fecha simulada (lunes 19/10/2026) y simulan los plugins de Capacitor (`window.__llamadas`). Toda novedad debe traer su prueba. Si se suman archivos web: agregarlos a `scripts/build-web.js` y `sw.js` (ASSETS) y subir `CACHE`.

## Android / publicación
- CI: GitHub → Actions → "APK Android" → release `apk-latest` (APK debug firmado con `android/app/debug.keystore` fijo para poder actualizar encima).
- **Pendiente antes de Play Store**: definir nombre/marca y `applicationId` definitivo (hoy `ar.amiritmo.app`, no se puede cambiar una vez publicada), firma propia (keystore de release guardado aparte), cuenta de desarrollador, política de privacidad, declaración de datos/salud, revisión profesional de la biblioteca de ejercicios, íconos y capturas, y cumplir los requisitos de pruebas cerradas que Google exija a cuentas personales.

## Comportamientos pensados para gente que no configura nada
- **Pasos (Android)**: en cada apertura, con el módulo activo, se pide solo el permiso de actividad física (`iniciarPasos`) y después el de notificaciones (en orden, para que Android no pise un diálogo con otro); si lo rechazan 2 veces (`settings.pasosRechazos`) deja de insistir y queda un botón "Activar" en Hoy y Hábitos. El estado ("Contador activo · última lectura") se ve en Hoy. El segundo plano queda activo por defecto; lo demás está bajo "Opciones". Ajustes tiene "🔔 Probar un aviso ahora".
- **Ejercicio por ítem**: "Hoy no" (`days[k].omitEj`) o "No pude hoy" de la rutina entera. En Hoy cada rutina se **habilita a su hora** (`tarjetasRutinasHoy`) y cada ejercicio desaparece al marcarlo.
- **Pendientes de la semana** (`faltasSemana`, últimos 7 días desde `settings.creado`): tarjeta "Ayer no hiciste / Te quedaron pendientes" con **Repartir en la semana** (suma a `S.recup[id]`, tope 3; se ofrece como máximo UNA unidad extra opcional por ejercicio y por día: 1 serie, o 20 % de las repeticiones; se descuenta al hacerla, `consumirRecup`) o **Dejarlo así** (`S.cerrados`). Nunca se obliga a compensar (lesión lumbar). Pregunta de la noche opcional (`seguirOn`/`seguirHora`, ids 3600+día) que no suena si ya está todo marcado; avisos 3900 al decir "No pude hoy".
- **Checklist de alimentación vacío**: las sugerencias se eligen de a varias y se agregan juntas.
- **Agua pendiente**: cada aviso de agua de hoy que ya pasó cuenta como vaso por tomar (`pendientesAgua`, tarjeta en Hoy y Agua); cada "+ vaso" descuenta uno. En Android los avisos de agua no se auto-cancelan al tocarlos (`autoCancel:false`), llevan su hora en el texto y "+ vaso" saca de la barra solo la notificación más vieja (`sacarAvisoAgua`).
- **Ejercicio, lo hecho se pliega**: en cada rutina del día, los ejercicios completos (✅) o salteados (⏭) pasan a filas plegables (`details.compacto`) debajo de "Hecho hoy"; arriba quedan solo los pendientes con su figura. Al final de la pestaña, "Tu evolución" (`evolucion()`): % de rutinas programadas completadas por día (semana), por semana (mes: 4, trimestre: 13) o por mes (año: 12); no cuenta días anteriores a `settings.creado`.
- **Importar desde Salud Activa** (la app personal anterior): "Importar respaldo" detecta el JSON de Salud Activa (`esCopiaSaludActiva`) y lo convierte (`desdeSaludActiva`): ejercicios con ids `r_*`/`c_*`, dos rutinas con su agenda, mediciones `m_presion|peso|colesterol|spo2` con los límites que ya tenía la persona (presión: "por encima de" = umbral−1 porque allá avisaba con ≥; peso: objetivo ± tolerancia; LDL: meta; saturación: mínimo), todas las tomas del día (con `hora`), actividad, checklist y contador de pescado (`c_pescado`). La copia original completa queda en `importado` y lo anterior en `miplanV1_antes_importar`. No importa el sensor de pasos (evita contar doble).
- **Rutinas por grupo**: los ejemplos de la biblioteca tienen grupo (`grupoBib`): general (de pie, todos los días) y espalda y core (lun/mié/vie). El asistente y "Desde la biblioteca" los ordenan solos en dos rutinas (`rutinaDeGrupo`, reutiliza la que ya tenga ese nombre); cada rutina tiene su propio botón "📅 Días y horario" en la pestaña Ejercicio. Si una rutina mezcla espalda con otros ejercicios, Ajustes ofrece "Separar espalda y core en su propia rutina".
- **Pasos que cruzan la medianoche** (`repartirPasos`): si entre dos lecturas del sensor pasó la medianoche (sin lecturas de noche por Doze/ahorro de batería), lo contado se reparte entre los días según las horas de actividad (7–23) de cada uno; si todo el intervalo es de noche, según el tiempo. Antes iba entero al día nuevo y a la mañana se veían pasos de la noche anterior. Intervalos de más de 7 días van al día de la última lectura.

## Identidad visual
- Ícono nuevo (degradé de atardecer naranja→rosa→violeta con un pulso que termina en un punto: "mi ritmo"); `icon.svg`, `icon-*.png` y todos los `mipmap-*`/`splash.png` de Android se generan de ese SVG (render con Playwright). Color por defecto **coral** (el azul quedó como opción).
- Bienvenida animada (`#splash`, `iniciarBienvenida`): logo que dibuja el pulso + el aviso "no reemplaza indicaciones médicas"; se va sola a los ~5,6 s o al tocarla (pasado 0,9 s) y el dashboard entra escalonado (`body.entrando`). Respeta `prefers-reduced-motion`. Las pruebas la desactivan con `window.__sinSplash` (solo `tests/30-bienvenida.test.js` la usa).
- Estética: tarjetas redondeadas con sombra suave, botones con degradé (`--pri`→`--g2`), navegación inferior flotante tipo píldora. Variables en `:root` de `styles.css` (la paleta elegida en Ajustes las pisa desde `aplicarColor`).
- **Evolución de pasos y actividad** (`evolucionDiaria`): Semana (por día), Mes y Trimestre (por semana: 4 y 13) y Año (por mes). Pasos: promedio de los días con registro y días que llegó a la meta; actividad: total de minutos y promedio semanal. Aviso diario de pasos **opcional y apagado por defecto** (`recPasos`/`recPasosHora`, id 3700; los pasos se cuentan solos): no suena si ya llegó a la meta.
- **Alimentación**: contadores sugeridos por día con suma semanal (fruta, pescado, verduras, legumbres: `CONTADORES_SUG`). **Recordatorios propios** (`S.recordatorios`, `modalRecordatorio`): texto + hora + días; en modo "solo registro" ofrece activar los recordatorios.
- Un ejercicio plegado que se está usando queda abierto al volver a dibujar la pantalla (`abiertosEj`).
