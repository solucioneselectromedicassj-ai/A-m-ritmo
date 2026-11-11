#!/usr/bin/env bash
# Crea la clave de subida para Google Play. Correrlo UNA vez, en tu computadora (no en el repo).
# Guardá el archivo .jks y las contraseñas en un gestor de contraseñas y en un segundo lugar (pendrive/nube privada).
set -e
ALIAS="${1:-amiritmo}"
ARCHIVO="${2:-clave-subida-amiritmo.jks}"
keytool -genkeypair -v -keystore "$ARCHIVO" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=A Mi Ritmo, O=SEM Soluciones Electromedicas, L=San Juan, C=AR"
echo
echo "Listo: $ARCHIVO  (alias: $ALIAS)"
echo "Para cargarla como secreto de GitHub (RELEASE_KEYSTORE_B64):"
echo "  base64 -w0 $ARCHIVO"
echo "Huella para Google Cloud (login con Google):"
keytool -list -v -keystore "$ARCHIVO" -alias "$ALIAS" | grep -E "SHA1|SHA256"
