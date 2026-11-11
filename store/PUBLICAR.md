# Cómo publicar A Mi Ritmo en Google Play

## Estado
- ✅ Seguridad: CSP, copia automática de Android desactivada, opción de avisos sin detalles en pantalla bloqueada.
- ✅ Política de privacidad: texto en la app (Ajustes y bienvenida) y página `docs/privacidad.html`.
- ✅ Workflow "AAB firmado para Play Store" y script para crear la clave.
- ✅ Material de la ficha en `store/` (textos, declaraciones, imágenes).
- ⏳ Falta que hagas vos: cuenta de desarrollador, clave de release, URL pública de la política, credenciales de Google Cloud, revisión profesional de los ejercicios.

## 1. Cuenta de desarrollador de Google Play
play.google.com/console → crear cuenta (pago único aprox. 25 USD, verificación de identidad). Las cuentas personales nuevas suelen necesitar una **prueba cerrada** con testers durante unos 14 días antes de pasar a producción: confirmá el requisito vigente en Play Console.

## 2. Clave de subida (una sola vez, en tu computadora)
```
bash scripts/crear-clave-release.sh
```
Guardá el `.jks` y las contraseñas en dos lugares (gestor de contraseñas + copia aparte). Nunca lo subas al repo (`.gitignore` ya lo bloquea). Con **Play App Signing** (lo propone Play al crear la app), Google guarda la clave final y vos solo firmás con la de subida; si la perdés se puede pedir un reseteo, pero es un trámite.

## 3. Secretos en GitHub
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `RELEASE_KEYSTORE_B64` = salida de `base64 -w0 clave-subida-amiritmo.jks`
- `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`

## 4. Generar el .aab
Actions → "AAB firmado para Play Store" → Run workflow (poné la versión, p. ej. 1.0.0). Corre las pruebas, compila y deja `a-mi-ritmo-aab` como artifact (bajalo y subilo a Play Console). El `versionCode` sube solo en cada corrida. El log muestra la huella SHA-1 de la clave de subida.

## 5. Login con Google en producción
En Google Cloud Console → Credenciales, además del cliente Android de debug, crear otros dos de tipo Android para `ar.amiritmo.app`: uno con la huella SHA-1 de la **clave de subida** y otro con la del **certificado de firma de la app** que muestra Play Console (Integridad de la app → Firma de la app).

## 6. Política de privacidad (URL pública obligatoria)
Archivo: `docs/privacidad.html` (se regenera con `node scripts/build-politica.js` a partir de `politica.js`). Opciones para tener una URL:
- **GitHub Pages**: Settings → Pages → rama principal, carpeta `/docs` → URL `https://<usuario>.github.io/A-m-ritmo/privacidad.html` (requiere que `docs/` esté en la rama principal).
- **Vercel o Netlify**: desplegar la carpeta `docs/` como sitio estático.
Pegá esa URL en Play Console (Contenido de la app → Política de privacidad) y en la ficha.

## 7. Ficha, imágenes y declaraciones
Usá `store/ficha.md`, `store/imagenes/` y `store/declaraciones.md`. Para regenerar las capturas: `node scripts/capturas.js`.

## 8. Decisiones que quedan en tu mano
- **Anuncios**: la franja de ejemplo está encendida por defecto. Si publicás sin anuncios, apagala por defecto antes del release (un cambio chico) para no mostrar un "espacio publicitario" falso. Con AdMob real hay que actualizar política, Data safety y pedir consentimiento.
- **Revisión profesional** de los ejercicios de ejemplo (kinesiólogo/profesor de educación física) antes de salir de la prueba cerrada.
- **Nombre**: verificar que "A Mi Ritmo" esté libre en Play y como marca.
