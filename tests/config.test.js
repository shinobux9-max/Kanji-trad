// Tests de src/config.js : cohérence des paramètres entre eux. Un réglage futur qui rendrait
// deux paramètres incompatibles doit être refusé ici plutôt que de casser un invariant en
// silence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDED_CONFIG } from '../src/config.js';

const { stateThresholds: t, declaredVerificationWindowDays: w } = GUIDED_CONFIG;

test('seuils d\'état : 0 < Acquis < Maîtrisé (partie 1, 1.2)', () => {
  assert.ok(t.acquiredIntervalDays > 0);
  assert.ok(t.acquiredIntervalDays < t.masteredIntervalDays);
});

// Décision du 2026-10-01 : l'état d'un élément déclaré se calcule par les règles générales.
test('un élément déclaré est Acquis : fenêtre de vérification ≥ seuil d\'Acquis (partie 3, 3.4)', () => {
  assert.ok(w.min >= t.acquiredIntervalDays,
    `declaredVerificationWindowDays.min (${w.min}) < acquiredIntervalDays (${t.acquiredIntervalDays})`);
});

test('un élément déclaré n\'est pas Maîtrisé : fenêtre de vérification < seuil de Maîtrisé', () => {
  assert.ok(w.max < t.masteredIntervalDays,
    `declaredVerificationWindowDays.max (${w.max}) ≥ masteredIntervalDays (${t.masteredIntervalDays})`);
});

test('fenêtre de vérification non vide, en jours entiers', () => {
  assert.ok(Number.isInteger(w.min) && Number.isInteger(w.max));
  assert.ok(w.min <= w.max);
});

test('la configuration est immuable', () => {
  assert.ok(Object.isFrozen(GUIDED_CONFIG));
  assert.ok(Object.isFrozen(GUIDED_CONFIG.stateThresholds));
  assert.throws(() => { 'use strict'; GUIDED_CONFIG.stateThresholds.acquiredIntervalDays = 1; }, TypeError);
});
