# Mi Plan

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
sw.js           service worker (cache-first), CACHE = 'miplan-vN'
manifest.json, icon.svg, icon-192.png, icon-512.png
tests/          Playwright + Chromium: `npm test`
capacitor.config.json, package.json, scripts/build-web.js   empaquetado Android
android/        proyecto Capacitor (appId ar.miplan.app), StepCounterPlugin + StepWorker (sensor de pasos en segundo plano)
.github/workflows/android.yml   compila el APK y lo publica como prerelease `apk-latest`
```

## Datos (`localStorage`, clave `miplanV1`, `VERSION` = 1)
```
{ v, listo, modo, modulos:{ejercicio,pasos,agua,actividad,comida,medidas},
  settings:{ metaPasos, metaAgua, aeroMeta, vaso, descansoSeg, aguaDesde, aguaHasta, recAgua, recMin, segundoPlano,
            notas, color (azul|verde|violeta|naranja|rosa|gris), ultimoRespaldo, respaldoPospuesto, creado, informe:{periodo, excluir:{}} },
  ejercicios:[{id,n,tipo:'reps'|'series'|'tiempo',meta|series,reps|seg,nota?,fig?}],
  sesiones:[{id,n,dias:[0-6],hora,ej:[ids]}],
  medidas:[{id,tipo,n,campos:[{k,n,u,r,opc,dec,min,max}],repetirMeses,recordarHora}],
  registros:{ medidaId:[{fecha,…valores}] },          // un registro por fecha: cargar la misma fecha lo completa
  days:{ 'YYYY-MM-DD':{pasos,agua,ej:{id:n},omit:{sesId},comida:{id},cont:{id}} },
  comida:{items:[{id,n}],contadores:[{id,n,meta}]}, aero:[{fecha,min,tipo}], molestias:{}, sensor }
```
- **Nunca se pierden datos**: `load()` solo agrega campos, conserva claves desconocidas, deja copia intacta `miplanV1_antes_vN` si el formato es más viejo, conserva JSON corrupto en `miplanV1_corrupto` y guarda lo anterior en `miplanV1_antes_importar` al importar.
- Si se cambia el formato: subir `VERSION`, migración aditiva y prueba con datos del formato anterior (`tests/26-datos.test.js`).
- Respaldo: exportar (APK: caché + compartir; web: descarga), copiar, importar, recordatorio en Hoy (hay registros + ≥3 días de uso + ≥7 días sin respaldo), "Borrar todo" con oferta de exportar y doble confirmación.

## Recordatorios (Android)
`setupReminders()` / `scheduleNative` solo programan si el modo no es `registro`. Ids: 1000+ agua, 2000+i mediciones con hora, 3000+i*10+día rutinas con hora (weekday = día+1), 3900 aviso de "mañana" tras "No pude hoy" (se preserva al reprogramar). Sin permiso de notificaciones se avisa y no se programa. En la web solo hay recordatorio de agua con la app abierta.

## Cómo correrlo y probarlo
```
python3 -m http.server 8080      # abrir http://localhost:8080
npm install && npm test          # node --check + tests/run.js (filtro: node tests/run.js "texto")
npm run sync                     # copia a www/ y sincroniza android/
```
Las pruebas usan fecha simulada (lunes 19/10/2026) y simulan los plugins de Capacitor (`window.__llamadas`). Toda novedad debe traer su prueba. Si se suman archivos web: agregarlos a `scripts/build-web.js` y `sw.js` (ASSETS) y subir `CACHE`.

## Android / publicación
- CI: GitHub → Actions → "APK Android" → release `apk-latest` (APK debug firmado con `android/app/debug.keystore` fijo para poder actualizar encima).
- **Pendiente antes de Play Store**: definir nombre/marca y `applicationId` definitivo (hoy `ar.miplan.app`, no se puede cambiar una vez publicada), firma propia (keystore de release guardado aparte), cuenta de desarrollador, política de privacidad, declaración de datos/salud, revisión profesional de la biblioteca de ejercicios, íconos y capturas, y cumplir los requisitos de pruebas cerradas que Google exija a cuentas personales.
