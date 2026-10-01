// Partie 7 · C2 : « toute modification du suivi passe par recordLearningEvent ».
//
// Vérification statique : en dehors de src/learning/, aucun fichier n'importe un module
// interne de learning ; seule la surface publique src/learning/index.js est importable, et
// elle n'expose aucune fonction d'écriture (gradeReview, applyWeakness…, applyEvent).
// L'analyse des imports est celle de tools/check-layers.mjs (code réel, commentaires ignorés).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lex, findImports } from '../../tools/check-layers.mjs';
import * as surface from '../../src/learning/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');

// Imports d'un fichier qui visent un module interne de learning. Renvoie les violations.
export function internalLearningImports(srcDir, filePath, source) {
  const rel = relative(srcDir, filePath).split(sep).join('/');
  if (rel.startsWith('learning/')) return [];
  const violations = [];
  for (const imp of findImports(lex(source).noComments)) {
    if (!imp.specifier || !imp.specifier.startsWith('.')) continue;
    const target = relative(srcDir, resolve(dirname(filePath), imp.specifier)).split(sep).join('/');
    if (target.startsWith('learning/') && target !== 'learning/index.js') {
      violations.push(`${rel}:${imp.line} importe ${target} (passer par learning/index.js)`);
    }
  }
  return violations;
}

function listJs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listJs(full) : /\.m?js$/.test(name) ? [full] : [];
  });
}

test('C2 : aucun fichier hors de learning n\'importe un module interne de learning', () => {
  const violations = listJs(SRC).flatMap((f) => internalLearningImports(SRC, f, readFileSync(f, 'utf8')));
  assert.deepEqual(violations, []);
});

test('C2 : la vérification détecte un import interne, et seulement lui', () => {
  const file = join(SRC, 'engine', 'compose.js');
  assert.deepEqual(internalLearningImports(SRC, file, "import { gradeReview } from '../learning/srs.js';"),
    ['engine/compose.js:1 importe learning/srs.js (passer par learning/index.js)']);
  assert.deepEqual(internalLearningImports(SRC, file,
    "import { applyEvent } from '../learning/effects.js';\nexport * from '../learning/weakness.js';").length, 2);
  assert.deepEqual(internalLearningImports(SRC, file, "import { computeState } from '../learning/index.js';"), []);
  assert.deepEqual(internalLearningImports(SRC, file, "// import { x } from '../learning/srs.js';"), []);
  assert.deepEqual(internalLearningImports(SRC, join(SRC, 'learning', 'record.js'),
    "import { applyEvent } from './effects.js';"), []);
});

test('C2 : la surface publique n\'expose aucune fonction d\'écriture', () => {
  for (const name of ['gradeReview', 'applyWeaknessFailure', 'applyWeaknessSuccess', 'applyEvent',
    'createEmptyLearningState', 'declarationDelayDays']) {
    assert.equal(Object.hasOwn(surface, name), false, name);
  }
  assert.equal(typeof surface.createLearning, 'function');
});
