// Petit serveur de fichiers statiques pour les tests dans le navigateur (aucune dépendance).
// Un navigateur refuse de charger des modules ESM depuis file:// : il faut passer par http.
//
// Usage, depuis la racine du dépôt :
//   node tests/browser/serve.mjs
// puis ouvrir http://localhost:8123/tests/browser/store-contract.html

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.PORT) || 8123;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('introuvable');
  }
}).listen(PORT, () => {
  console.log(`Tests navigateur : http://localhost:${PORT}/tests/browser/store-contract.html`);
});
