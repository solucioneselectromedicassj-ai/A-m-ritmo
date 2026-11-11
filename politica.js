/* Política de privacidad de A Mi Ritmo. Única fuente: la usa la app (Ajustes → Política de privacidad)
   y `node scripts/build-politica.js` la convierte en docs/privacidad.html (la URL que pide Google Play). */
(function (g) {
  const P = {
    titulo: 'Política de privacidad de A Mi Ritmo',
    actualizada: '11 de noviembre de 2026',
    contacto: 'solucioneselectromedicassj@gmail.com',
    secciones: [
      ['Quién es el responsable', ['A Mi Ritmo es desarrollada por SEM Soluciones Electromédicas (San Juan, Argentina). Para cualquier consulta sobre esta política escribinos a solucioneselectromedicassj@gmail.com.']],
      ['Qué datos usa la app', [
        'Lo que vos cargás: tus ejercicios y rutinas, tus mediciones de salud (por ejemplo presión, peso, colesterol, saturación u otras que elijas), pasos, agua, comidas, actividad, notas y los límites o metas que definís.',
        'Los pasos que cuenta el sensor de tu teléfono, si activás ese módulo.',
        'Si lo activás vos, la saturación de oxígeno y el pulso que guarda tu reloj o pulsera en Health Connect (solo lectura).',
        'Si entrás con tu cuenta de Google (es opcional): tu nombre y tu correo, solo para saludarte y mostrarlos en Ajustes.'
      ]],
      ['Dónde se guardan: solo en tu teléfono', [
        'Todos tus datos se guardan únicamente en tu dispositivo. A Mi Ritmo no tiene servidores propios: no recibimos, no copiamos ni vemos tus datos de salud.',
        'La app no usa herramientas de analítica ni de seguimiento y hoy no muestra publicidad de terceros. El espacio de anuncios que puede verse es solo de ejemplo y no se conecta a ningún servicio. Si en el futuro se incorporan anuncios reales, actualizaremos esta política antes y te lo vamos a informar.'
      ]],
      ['Permisos que pide y para qué', [
        'Actividad física: para contar tus pasos con el sensor del teléfono.',
        'Notificaciones: para tus recordatorios (agua, rutinas, mediciones, avisos propios). Si querés, podés activar que no muestren detalles en la pantalla de bloqueo (Ajustes → Privacidad de los avisos).',
        'Health Connect (solo lectura de saturación de oxígeno y pulso): únicamente si elegís traer datos de tu reloj. Podés quitar el permiso cuando quieras desde Health Connect. Esos datos se usan solo para mostrártelos en la app y en tus informes; no se usan para publicidad ni se venden ni se comparten con terceros.',
        'Cuenta de Google (opcional): el ingreso lo procesa Google según su propia política de privacidad. A Mi Ritmo solo recibe tu nombre y tu correo.'
      ]],
      ['Con quién se comparten', [
        'Con nadie. Los datos solo salen del teléfono si vos lo decidís: al exportar un respaldo o un informe y enviarlo por la aplicación que elijas (WhatsApp, correo, etc.). Desde ese momento rige la política de esa aplicación.'
      ]],
      ['Copias de seguridad', [
        'La copia automática de Android está desactivada para esta app, así que tus datos no se suben solos a la nube de Google. Para no perderlos si cambiás de teléfono, usá "Exportar" en Ajustes → Mis datos y guardá el archivo donde prefieras.'
      ]],
      ['Cuánto tiempo se conservan y cómo borrarlos', [
        'Se conservan en tu teléfono hasta que los borres. Podés borrar todo desde Ajustes → Mis datos → "Borrar todo", o desinstalando la app. Para cerrar tu cuenta de Google dentro de la app, usá "Salir de la cuenta" en Ajustes.'
      ]],
      ['Tus derechos', [
        'Como tus datos están solo en tu dispositivo, vos los controlás: podés verlos, corregirlos, exportarlos y borrarlos desde la app en cualquier momento (Ley 25.326 de Protección de Datos Personales de la República Argentina). La Agencia de Acceso a la Información Pública es el órgano de control de esa ley.'
      ]],
      ['Menores de edad', [
        'La app no está dirigida a menores de 13 años.'
      ]],
      ['Importante sobre la salud', [
        'A Mi Ritmo es una ayuda personal para llevar tus hábitos. No es un equipo médico ni un servicio médico, no diagnostica ni indica tratamientos y no reemplaza las indicaciones de tu médico o de otros profesionales de la salud.'
      ]],
      ['Cambios en esta política', [
        'Si cambiamos algo, publicaremos la nueva versión con su fecha de actualización dentro de la app y en el enlace de la ficha de Google Play.'
      ]]
    ]
  };
  g.POLITICA = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
