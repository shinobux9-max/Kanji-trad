// Ocha v2 — Vérification des couches
//
// Vérifie les règles de REGLES-CONSTRUCTION.md, section 4 :
//   1. chaque fichier de src/ n'importe que ce que sa couche a le droit d'importer ;
//   2. aucun accès aux API du navigateur (document, window, navigator, localStorage,
//      indexedDB) hors de src/ui/, src/store/ et src/app.js ;
//   3. IndexedDB seulement dans src/store/, localStorage seulement dans src/store/settings.js.
//
// Le script analyse le code réel : les commentaires et le contenu des chaînes sont ignorés,
// et seuls les vrais accès sont signalés (« reviewWindowDays » n'est pas une violation).
//
// Usage : node tools/check-layers.mjs
// Sortie : liste des violations, code de sortie 1 s'il y en a, 0 sinon.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Règles ──────────────────────────────────────────────────────────────────

// Couches que chaque couche peut importer (REGLES-CONSTRUCTION.md, §4).
// « store/settings » désigne le seul fichier src/store/settings.js.
export const ALLOWED_IMPORTS = {
  config:    [],
  content:   ['config'],
  store:     ['config'],
  learning:  ['content', 'store', 'config'],
  exercises: ['content', 'learning', 'config'],
  engine:    ['content', 'learning', 'exercises', 'config'],
  ui:        ['engine', 'exercises', 'learning', 'content', 'config', 'store/settings'],
  // src/app.js (démarrage) : mêmes droits que l'interface.
  app:       ['ui', 'engine', 'exercises', 'learning', 'content', 'config', 'store/settings']
};

// Couches autorisées à accéder aux API du navigateur.
const BROWSER_LAYERS = new Set(['ui', 'store', 'app']);

const BROWSER_GLOBALS = ['document', 'window', 'navigator', 'localStorage', 'indexedDB'];

// ── Identification de la couche d'un fichier ────────────────────────────────

// Retourne la couche d'un chemin relatif à src/ (séparateurs « / »), ou null.
export function layerOf(relPath) {
  if (relPath === 'config.js') return 'config';
  if (relPath === 'app.js') return 'app';
  const first = relPath.split('/')[0];
  if (first === 'store' && relPath === 'store/settings.js') return 'store/settings';
  return ALLOWED_IMPORTS[first] ? first : null;
}

// Couche « de base » pour les droits propres au fichier (store/settings reste store).
function baseLayer(layer) {
  return layer === 'store/settings' ? 'store' : layer;
}

// ── Analyse lexicale minimale ───────────────────────────────────────────────
//
// Produit deux versions du code, de même longueur et avec les mêmes sauts de ligne
// (les numéros de ligne restent justes) :
//   - noComments : commentaires effacés, chaînes conservées (pour lire les imports) ;
//   - codeOnly   : commentaires ET contenu des chaînes effacés (pour chercher les accès).
// Les expressions ${…} des gabarits sont conservées comme du code.

const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

export function lex(source) {
  const n = source.length;
  const noComments = source.split('');
  const codeOnly = source.split('');
  const blank = (arr, i) => { if (arr[i] !== '\n' && arr[i] !== '\r') arr[i] = ' '; };

  const templateDepth = []; // pile des profondeurs d'accolades des ${…} ouverts
  let braceDepth = 0;
  let i = 0;

  const lastSignificant = (pos) => {
    let j = pos - 1;
    while (j >= 0 && /\s/.test(codeOnly[j])) j--;
    if (j < 0) return { ch: '', word: '' };
    const ch = codeOnly[j];
    let k = j;
    while (k >= 0 && /[\w$]/.test(codeOnly[k])) k--;
    return { ch, word: codeOnly.slice(k + 1, j + 1).join('') };
  };

  const readString = (quote) => {
    // i est sur la quote ouvrante
    i++;
    while (i < n && source[i] !== quote) {
      if (source[i] === '\\') { blank(codeOnly, i); i++; }
      if (i < n) blank(codeOnly, i);
      if (source[i] === '\n') break; // chaîne non fermée : on s'arrête à la ligne
      i++;
    }
    i++; // quote fermante
  };

  const readTemplateChunk = () => {
    // lit le texte d'un gabarit jusqu'à « ` » (fin) ou « ${ » (expression)
    while (i < n) {
      const c = source[i];
      if (c === '\\') { blank(codeOnly, i); i++; blank(codeOnly, i); i++; continue; }
      if (c === '`') { i++; return 'end'; }
      if (c === '$' && source[i + 1] === '{') { i += 2; return 'expr'; }
      blank(codeOnly, i);
      i++;
    }
    return 'end';
  };

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') { blank(noComments, i); blank(codeOnly, i); i++; }
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (; i < stop; i++) { blank(noComments, i); blank(codeOnly, i); }
      continue;
    }
    if (c === '\'' || c === '"') { readString(c); continue; }
    if (c === '`') {
      i++;
      if (readTemplateChunk() === 'expr') templateDepth.push(braceDepth);
      continue;
    }
    if (c === '{') { braceDepth++; i++; continue; }
    if (c === '}') {
      if (templateDepth.length && templateDepth[templateDepth.length - 1] === braceDepth) {
        templateDepth.pop();
        i++;
        if (readTemplateChunk() === 'expr') templateDepth.push(braceDepth);
        continue;
      }
      braceDepth--;
      i++;
      continue;
    }
    if (c === '/') {
      const { ch, word } = lastSignificant(i);
      const isRegex = ch === '' || REGEX_PRECEDERS.has(ch) || REGEX_KEYWORDS.has(word);
      if (isRegex) {
        i++;
        let inClass = false;
        while (i < n && source[i] !== '\n') {
          const r = source[i];
          if (r === '\\') { blank(codeOnly, i); i++; blank(codeOnly, i); i++; continue; }
          if (r === '[') inClass = true;
          else if (r === ']') inClass = false;
          else if (r === '/' && !inClass) break;
          blank(codeOnly, i);
          i++;
        }
        i++;
        continue;
      }
    }
    i++;
  }

  return { noComments: noComments.join(''), codeOnly: codeOnly.join('') };
}

// ── Extraction des imports et des accès ─────────────────────────────────────

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

export function findImports(noComments) {
  const found = [];
  const staticRe = /(?<![\w$.])(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?(['"])([^'"\n]+)\1/g;
  const dynamicRe = /(?<![\w$.])import\s*\(\s*([^)]*)\)/g;
  let m;
  while ((m = staticRe.exec(noComments))) {
    found.push({ specifier: m[2], line: lineOf(noComments, m.index), dynamic: false });
  }
  while ((m = dynamicRe.exec(noComments))) {
    const arg = m[1].trim();
    const literal = arg.match(/^(['"])([^'"]+)\1$/);
    found.push({
      specifier: literal ? literal[2] : null,
      raw: arg,
      line: lineOf(noComments, m.index),
      dynamic: true
    });
  }
  return found;
}

export function findBrowserAccesses(codeOnly) {
  const found = [];
  const names = BROWSER_GLOBALS.join('|');
  const direct = new RegExp(`(?<![\\w$.])(${names})\\s*(?:\\.|\\[|\\()`, 'g');
  const viaGlobal = new RegExp(`(?<![\\w$.])(?:globalThis|self)\\s*\\.\\s*(${names})\\b`, 'g');
  let m;
  while ((m = direct.exec(codeOnly))) found.push({ name: m[1], line: lineOf(codeOnly, m.index) });
  while ((m = viaGlobal.exec(codeOnly))) found.push({ name: m[1], line: lineOf(codeOnly, m.index) });
  return found;
}

// ── Vérification d'un fichier ───────────────────────────────────────────────

// srcDir : chemin absolu de src/ ; filePath : chemin absolu du fichier.
export function checkFile(srcDir, filePath, source) {
  const violations = [];
  const rel = relative(srcDir, filePath).split(sep).join('/');
  const layer = layerOf(rel);
  const report = (line, message) => violations.push({ file: `src/${rel}`, line, message });

  if (!layer) {
    report(1, `fichier hors des couches connues (src/${rel})`);
    return violations;
  }

  const { noComments, codeOnly } = lex(source);
  const allowed = ALLOWED_IMPORTS[baseLayer(layer)];

  for (const imp of findImports(noComments)) {
    if (imp.specifier === null) {
      report(imp.line, `import dynamique non vérifiable : import(${imp.raw})`);
      continue;
    }
    if (!imp.specifier.startsWith('.')) {
      report(imp.line, `import externe interdit : "${imp.specifier}" (aucune dépendance autorisée)`);
      continue;
    }
    const target = resolve(dirname(filePath), imp.specifier);
    const targetRel = relative(srcDir, target).split(sep).join('/');
    if (targetRel.startsWith('..')) {
      report(imp.line, `import hors de src/ : "${imp.specifier}"`);
      continue;
    }
    const targetLayer = layerOf(targetRel);
    if (!targetLayer) {
      report(imp.line, `import vers un fichier hors des couches connues : "${imp.specifier}"`);
      continue;
    }
    // Un fichier peut toujours importer un fichier de sa propre couche.
    if (baseLayer(targetLayer) === baseLayer(layer)) continue;
    const ok = allowed.includes(targetLayer) ||
      (targetLayer === 'store/settings' && allowed.includes('store'));
    if (!ok) {
      report(imp.line, `la couche « ${baseLayer(layer)} » ne peut pas importer « ${targetLayer} » ("${imp.specifier}")`);
    }
  }

  for (const acc of findBrowserAccesses(codeOnly)) {
    const base = baseLayer(layer);
    if (!BROWSER_LAYERS.has(base)) {
      report(acc.line, `accès à « ${acc.name} » interdit dans la couche « ${base} » (sans navigateur)`);
      continue;
    }
    if (acc.name === 'indexedDB' && base !== 'store') {
      report(acc.line, `IndexedDB n'est autorisé que dans src/store/`);
    }
    if (acc.name === 'localStorage' && layer !== 'store/settings') {
      report(acc.line, `localStorage n'est autorisé que dans src/store/settings.js`);
    }
  }

  return violations;
}

// ── Parcours du projet ──────────────────────────────────────────────────────

function listJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listJsFiles(full));
    else if (/\.(m?js)$/.test(name)) out.push(full);
  }
  return out;
}

export function checkProject(rootDir) {
  const srcDir = join(rootDir, 'src');
  const files = listJsFiles(srcDir);
  const violations = files.flatMap((f) => checkFile(srcDir, f, readFileSync(f, 'utf8')));
  return { files: files.length, violations };
}

// ── Exécution en ligne de commande ──────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { files, violations } = checkProject(root);
  if (violations.length === 0) {
    console.log(`check-layers : OK (${files} fichier(s) vérifié(s), aucune violation)`);
    process.exit(0);
  }
  for (const v of violations) console.log(`${v.file}:${v.line}  ${v.message}`);
  console.log(`\ncheck-layers : ${violations.length} violation(s) dans ${files} fichier(s)`);
  process.exit(1);
}
