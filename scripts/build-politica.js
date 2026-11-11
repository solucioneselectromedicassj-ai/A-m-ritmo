// Genera docs/privacidad.html (página pública para la ficha de Google Play) desde politica.js.
const fs = require('fs');
const P = require('../politica.js');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cuerpo = P.secciones.map(([t, ps]) => `<h2>${esc(t)}</h2>\n${ps.map(p => `<p>${esc(p)}</p>`).join('\n')}`).join('\n');
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/privacidad.html', `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(P.titulo)}</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:20px 16px;color:#1d1d1f}h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:1.6em}small{color:#666}@media(prefers-color-scheme:dark){body{background:#151515;color:#eee}small{color:#aaa}}</style></head>
<body><h1>${esc(P.titulo)}</h1><small>Última actualización: ${esc(P.actualizada)}</small>
${cuerpo}
<p><small>Contacto: <a href="mailto:${esc(P.contacto)}">${esc(P.contacto)}</a></small></p></body></html>
`);
console.log('docs/privacidad.html generado');
