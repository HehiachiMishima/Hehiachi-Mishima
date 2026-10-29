// Calcula los hashes CSP ('sha256-...') de cada <script> inline del
// index.html compilado (p. ej. el que inyecta el inlining de CSS critico
// de Angular/beasties) y los escribe en una linea, listos para script-src.
// Uso: node csp-hashes.mjs <index.html> <salida.txt>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
  console.error('uso: node csp-hashes.mjs <index.html> <salida.txt>');
  process.exit(2);
}

const html = readFileSync(entrada, 'utf8');
const hashes = new Set();
// <script ...>contenido</script> sin atributo src.
for (const m of html.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  if (m[1].length === 0) continue;
  hashes.add(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
}

writeFileSync(salida, [...hashes].join(' '));
console.log(`csp-hashes: ${hashes.size} script(s) inline -> ${[...hashes].join(' ') || '(ninguno)'}`);
