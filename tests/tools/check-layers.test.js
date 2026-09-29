// Tests de tools/check-layers.mjs
// Lancement : npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkFile, checkProject, layerOf, lex } from '../../tools/check-layers.mjs';

const SRC = join(tmpdir(), 'ocha-fake', 'src');
const check = (rel, code) => checkFile(SRC, join(SRC, ...rel.split('/')), code);

// ── Couches ──

test('identifie la couche de chaque fichier', () => {
  assert.equal(layerOf('config.js'), 'config');
  assert.equal(layerOf('app.js'), 'app');
  assert.equal(layerOf('learning/events.js'), 'learning');
  assert.equal(layerOf('store/settings.js'), 'store/settings');
  assert.equal(layerOf('store/db.js'), 'store');
  assert.equal(layerOf('autre/x.js'), null);
});

// ── Imports ──

test('autorise les imports prévus par le tableau', () => {
  assert.deepEqual(check('learning/events.js', `import { A } from '../store/db.js';\nimport { C } from '../config.js';`), []);
  assert.deepEqual(check('engine/compose.js', `import { x } from '../exercises/gen.js';`), []);
  assert.deepEqual(check('ui/home.js', `import { get } from '../store/settings.js';`), []);
});

test("autorise un import à l'intérieur d'une même couche", () => {
  assert.deepEqual(check('learning/a.js', `import { b } from './b.js';`), []);
});

test("interdit à l'interface d'importer le stockage (hors paramètres)", () => {
  const v = check('ui/home.js', `import { open } from '../store/db.js';`);
  assert.equal(v.length, 1);
  assert.match(v[0].message, /ne peut pas importer « store »/);
});

test('interdit au moteur et au contenu les imports non prévus', () => {
  assert.equal(check('engine/x.js', `import { s } from '../store/db.js';`).length, 1);
  assert.equal(check('content/x.js', `import { l } from '../learning/y.js';`).length, 1);
  assert.equal(check('exercises/x.js', `import { u } from '../ui/z.js';`).length, 1);
});

test('lit les imports sur plusieurs lignes, les ré-exports et les imports dynamiques', () => {
  const code = `import {\n  a,\n  b as c\n} from '../ui/x.js';\nexport { d } from '../ui/y.js';\nconst m = await import('../ui/z.js');`;
  const v = check('learning/x.js', code);
  assert.equal(v.length, 3);
  assert.deepEqual(v.map((x) => x.line), [1, 5, 6]);
});

test('signale un import dynamique non vérifiable', () => {
  const v = check('learning/x.js', 'const m = await import(chemin);');
  assert.equal(v.length, 1);
  assert.match(v[0].message, /non vérifiable/);
});

test('interdit les dépendances externes', () => {
  const v = check('learning/x.js', `import lodash from 'lodash';`);
  assert.equal(v.length, 1);
  assert.match(v[0].message, /externe/);
});

test('ignore les imports écrits dans un commentaire', () => {
  assert.deepEqual(check('learning/x.js', `// import { a } from '../ui/x.js';\n/* import '../ui/y.js' */`), []);
});

test("app.js a les mêmes droits d'import que l'interface", () => {
  assert.deepEqual(check('app.js', `import { render } from './ui/home.js';`), []);
  assert.deepEqual(check('app.js', `import { get } from './store/settings.js';`), []);
  const v = check('app.js', `import { open } from './store/db.js';`);
  assert.equal(v.length, 1);
  assert.match(v[0].message, /ne peut pas importer « store »/);
});

// ── Accès au navigateur ──

test("interdit l'accès au navigateur hors de ui, store et app", () => {
  const v = check('engine/x.js', 'const w = window.innerWidth;\ndocument.title = "a";');
  assert.equal(v.length, 2);
  assert.deepEqual(v.map((x) => x.line), [1, 2]);
});

test('autorise le navigateur dans ui et app', () => {
  assert.deepEqual(check('ui/x.js', 'document.body.append(el);'), []);
  assert.deepEqual(check('app.js', "navigator.serviceWorker.register('sw.js');"), []);
});

test('ne signale pas les faux positifs', () => {
  const code = [
    'const reviewWindowDays = 7;',
    'const o = { window: 1 }; o.window.x = 2;',
    '// window.alert("commentaire")',
    'const s = "document.title";',
    'const t = `localStorage.getItem`;',
    'const r = /window\\./;'
  ].join('\n');
  assert.deepEqual(check('learning/x.js', code), []);
});

test("détecte l'accès dans une expression de gabarit", () => {
  const v = check('engine/x.js', 'const t = `taille : ${window.innerWidth}`;');
  assert.equal(v.length, 1);
});

test('détecte globalThis.localStorage', () => {
  assert.equal(check('learning/x.js', 'globalThis.localStorage.clear();').length, 1);
});

test("n'autorise IndexedDB que dans store", () => {
  assert.deepEqual(check('store/db.js', "indexedDB.open('ocha');"), []);
  const v = check('ui/x.js', "indexedDB.open('ocha');");
  assert.equal(v.length, 1);
  assert.match(v[0].message, /src\/store/);
});

test("n'autorise localStorage que dans store/settings.js", () => {
  assert.deepEqual(check('store/settings.js', "localStorage.getItem('ocha_settings');"), []);
  assert.equal(check('store/db.js', "localStorage.getItem('x');").length, 1);
  assert.equal(check('ui/x.js', "localStorage.getItem('x');").length, 1);
});

// ── Analyse lexicale ──

test("l'analyse lexicale conserve la longueur et les sauts de ligne", () => {
  const src = "const a = 'x'; // c\n/* b\n c */ const t = `a${b}c`;";
  const { noComments, codeOnly } = lex(src);
  assert.equal(noComments.length, src.length);
  assert.equal(codeOnly.length, src.length);
  assert.equal(codeOnly.split('\n').length, src.split('\n').length);
});

// ── Projet complet ──

test('parcourt un projet et signale un fichier hors couche', () => {
  const root = mkdtempSync(join(tmpdir(), 'ocha-layers-'));
  try {
    mkdirSync(join(root, 'src', 'learning'), { recursive: true });
    mkdirSync(join(root, 'src', 'divers'), { recursive: true });
    writeFileSync(join(root, 'src', 'config.js'), 'export const C = {};');
    writeFileSync(join(root, 'src', 'learning', 'a.js'), "import { C } from '../config.js';");
    writeFileSync(join(root, 'src', 'divers', 'b.js'), 'export const x = 1;');
    const { files, violations } = checkProject(root);
    assert.equal(files, 3);
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /hors des couches connues/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
