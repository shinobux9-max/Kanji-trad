// Tests de src/learning/srs.js : non-régression de gradeReview et getDaysOverdue, repris de
// l'ancienne app (stratégie de reconstruction §3.2, liste de contrôle : intervalles obtenus
// après Oublié, Difficile, Bien, Facile à chaque répétition).

// Fuseau fixé pour que les tests de dates soient identiques sur toutes les machines. Chaque
// fichier de test tourne dans son propre processus : ce réglage ne touche que ce fichier.
process.env.TZ = 'Europe/Paris';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeReview, getDaysOverdue, QUALITY } from '../../src/learning/srs.js';
import { GUIDED_CONFIG } from '../../src/config.js';

// ── Oracle : l'ancien calcul, recopié tel quel ──────────────────────────────
//
// Copie du calcul de gradeReview dans l'ancienne app (js/srs.js), constantes en dur comme à
// l'origine, sans lecture ni écriture du stockage. Les tests comparent la reprise à cette
// copie : si une constante de GUIDED_CONFIG.srsAlgorithm s'écartait de l'ancien code, ils
// échoueraient.
function legacyGrade(existingOrNull, quality, now) {
  const existing = existingOrNull || { interval: 0, easeFactor: 2.5, repetitions: 0 };
  let { interval, easeFactor, repetitions } = existing;
  if (quality === 0) {
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    repetitions += 1;
    if (quality === 1) {
      interval = repetitions === 1 ? 1 : Math.round(interval * 1.2);
      easeFactor = Math.max(1.3, easeFactor - 0.15);
    } else if (quality === 2) {
      interval = repetitions === 1 ? 1 : (repetitions === 2 ? 3 : Math.round(interval * easeFactor));
    } else {
      interval = repetitions === 1 ? 2 : (repetitions === 2 ? 4 : Math.round(interval * easeFactor * 1.3));
      easeFactor += 0.15;
    }
  }
  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  return { interval, easeFactor, repetitions,
    lastReviewDate: now.toISOString(), nextReviewDate: nextReviewDate.toISOString() };
}

const T0 = '2026-10-01T08:00:00.000Z'; // 10 h à Paris

// ── Liste de contrôle ───────────────────────────────────────────────────────

test('« Bien » à chaque fois : intervalles 1, 3, 8, 20, 50, 125 (partie 1, 1.2)', () => {
  let srs = null;
  const intervals = [];
  for (let i = 0; i < 6; i++) {
    srs = gradeReview(srs, QUALITY.GOOD, T0);
    intervals.push(srs.interval);
  }
  assert.deepEqual(intervals, [1, 3, 8, 20, 50, 125]);
});

test('chaque note à chaque répétition, depuis une entrée en cours (facilité 2,5)', () => {
  // Entrées de départ : 0 à 4 répétitions réussies avec « Bien ».
  const starts = [null];
  for (let i = 0; i < 4; i++) starts.push(gradeReview(starts[i], QUALITY.GOOD, T0));
  const table = starts.map((s) => [0, 1, 2, 3].map((q) => {
    const r = gradeReview(s, q, T0);
    return [r.interval, r.repetitions, Number(r.easeFactor.toFixed(2))];
  }));
  assert.deepEqual(table, [
    // Oublié       Difficile        Bien           Facile
    [[1, 0, 2.3], [1, 1, 2.35],   [1, 1, 2.5],   [2, 1, 2.65]],   // sans historique
    [[1, 0, 2.3], [1, 2, 2.35],   [3, 2, 2.5],   [4, 2, 2.65]],   // intervalle 1, 1 répétition
    [[1, 0, 2.3], [4, 3, 2.35],   [8, 3, 2.5],   [10, 3, 2.65]],  // intervalle 3, 2 répétitions
    [[1, 0, 2.3], [10, 4, 2.35],  [20, 4, 2.5],  [26, 4, 2.65]],  // intervalle 8, 3 répétitions
    [[1, 0, 2.3], [24, 5, 2.35],  [50, 5, 2.5],  [65, 5, 2.65]]   // intervalle 20, 4 répétitions
  ]);
});

test('la facilité ne descend jamais sous 1,3', () => {
  let srs = null;
  for (let i = 0; i < 20; i++) srs = gradeReview(srs, QUALITY.FORGOTTEN, T0);
  assert.equal(srs.easeFactor, 1.3);
  for (let i = 0; i < 20; i++) srs = gradeReview(srs, QUALITY.HARD, T0);
  assert.equal(srs.easeFactor, 1.3);
});

test('« Oublié » remet toujours les répétitions à 0 et l\'intervalle à 1 (partie 1, 1.2)', () => {
  let srs = null;
  for (let i = 0; i < 6; i++) srs = gradeReview(srs, QUALITY.EASY, T0);
  assert.ok(srs.interval >= 60);
  const after = gradeReview(srs, QUALITY.FORGOTTEN, T0);
  assert.equal(after.interval, 1);
  assert.equal(after.repetitions, 0);
});

test('toutes les suites de 7 notes donnent exactement le calcul de l\'ancien code', () => {
  const now = new Date(T0);
  let count = 0;
  const walk = (mine, legacy, depth) => {
    if (depth === 7) return;
    for (const q of [0, 1, 2, 3]) {
      const a = gradeReview(mine, q, T0);
      const b = legacyGrade(legacy, q, now);
      assert.deepEqual(a, b);
      count++;
      walk(a, b, depth + 1);
    }
  };
  walk(null, null, 0);
  assert.equal(count, 21844); // 4 + 4² + … + 4⁷
});

test('les constantes de GUIDED_CONFIG.srsAlgorithm sont celles de l\'ancien code', () => {
  assert.deepEqual(GUIDED_CONFIG.srsAlgorithm, {
    initialEaseFactor: 2.5,
    minEaseFactor: 1.3,
    forgotten: { interval: 1, easePenalty: 0.2 },
    hard: { firstInterval: 1, multiplier: 1.2, easePenalty: 0.15 },
    good: { firstInterval: 1, secondInterval: 3 },
    easy: { firstInterval: 2, secondInterval: 4, multiplier: 1.3, easeBonus: 0.15 }
  });
  assert.ok(Object.isFrozen(GUIDED_CONFIG.srsAlgorithm.easy));
});

// ── Dates ───────────────────────────────────────────────────────────────────

test('dates : dernière révision = maintenant ; échéance = jours calendaires, même heure locale', () => {
  const r = gradeReview(null, QUALITY.GOOD, T0);
  assert.equal(r.lastReviewDate, T0);
  assert.equal(r.nextReviewDate, '2026-10-02T08:00:00.000Z');
  // 30 jours plus tard, après le passage à l'heure d'hiver (25 octobre) : toujours 10 h à
  // Paris, donc 09:00 UTC (comportement de setDate dans l'ancien code).
  const srs = { interval: 12, easeFactor: 2.5, repetitions: 3 };
  const r2 = gradeReview(srs, QUALITY.GOOD, T0);
  assert.equal(r2.interval, 30);
  assert.equal(r2.nextReviewDate, '2026-10-31T09:00:00.000Z');
});

test('accepte une Date ou une chaîne ISO, et refuse le reste', () => {
  assert.deepEqual(gradeReview(null, 2, new Date(T0)), gradeReview(null, 2, T0));
  assert.throws(() => gradeReview(null, 2, Date.parse(T0)), TypeError);
  assert.throws(() => gradeReview(null, 2, 'pas une date'), TypeError);
  assert.throws(() => gradeReview(null, 2), TypeError);
});

// ── Pureté ──────────────────────────────────────────────────────────────────

test('fonction pure : entrée non modifiée, même entrée → même résultat', () => {
  const srs = Object.freeze({ interval: 8, easeFactor: 2.5, repetitions: 3,
    lastReviewDate: T0, nextReviewDate: T0 });
  const a = gradeReview(srs, QUALITY.EASY, T0);
  const b = gradeReview(srs, QUALITY.EASY, T0);
  assert.deepEqual(a, b);
  assert.notEqual(a, srs);
});

test('note invalide refusée', () => {
  for (const q of [-1, 4, 1.5, '2', null, undefined]) {
    assert.throws(() => gradeReview(null, q, T0), TypeError, String(q));
  }
});

// ── getDaysOverdue ──────────────────────────────────────────────────────────

test('getDaysOverdue : 0 sans entrée, retard en jours décimaux sinon', () => {
  const srs = { nextReviewDate: '2026-10-01T08:00:00.000Z' };
  assert.equal(getDaysOverdue(null, T0), 0);
  assert.equal(getDaysOverdue(srs, '2026-10-03T08:00:00.000Z'), 2);
  assert.equal(getDaysOverdue(srs, '2026-10-01T20:00:00.000Z'), 0.5);
  assert.equal(getDaysOverdue(srs, T0), 0);
});

test('getDaysOverdue : négatif avant l\'échéance, comme l\'ancien code', () => {
  const srs = { nextReviewDate: '2026-10-04T08:00:00.000Z' };
  assert.equal(getDaysOverdue(srs, T0), -3);
});

test('getDaysOverdue refuse une date invalide', () => {
  assert.throws(() => getDaysOverdue(null, 'demain'), TypeError);
});
