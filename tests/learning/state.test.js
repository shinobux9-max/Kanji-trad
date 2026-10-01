// Tests de src/learning/state.js : état calculé (partie 1, 1.2 et 1.4) et invariants (1.8).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState, checkElementFacts, STATES, STATE_ORDER } from '../../src/learning/state.js';
import { gradeReview, QUALITY } from '../../src/learning/srs.js';
import { GUIDED_CONFIG } from '../../src/config.js';

const T0 = '2026-10-01T08:00:00.000Z';
const srsWith = (interval) => ({
  interval, easeFactor: 2.5, repetitions: 3, lastReviewDate: T0, nextReviewDate: T0
});
const facts = (interval) => ({ introducedAt: T0, srs: srsWith(interval) });

test('cinq états, du plus faible au plus fort (partie 1, 1.2 et 1.6)', () => {
  assert.deepEqual([...STATE_ORDER], ['new', 'discovered', 'learning', 'acquired', 'mastered']);
  assert.ok(Object.isFrozen(STATES) && Object.isFrozen(STATE_ORDER));
});

test('Nouveau : aucun fait, ou entrée sans date ni SRS', () => {
  assert.equal(computeState(undefined), STATES.NEW);
  assert.equal(computeState(null), STATES.NEW);
  assert.equal(computeState({}), STATES.NEW);
});

test('Découvert : date d\'introduction sans entrée SRS', () => {
  assert.equal(computeState({ introducedAt: T0 }), STATES.DISCOVERED);
  assert.equal(computeState({ introducedAt: T0, srs: null }), STATES.DISCOVERED);
});

test('En cours, Acquis, Maîtrisé : selon l\'intervalle, seuils 21 et 60 inclus (partie 1, 1.2)', () => {
  const cases = [[0, 'learning'], [1, 'learning'], [20, 'learning'], [21, 'acquired'],
    [59, 'acquired'], [60, 'mastered'], [125, 'mastered']];
  for (const [interval, expected] of cases) {
    assert.equal(computeState(facts(interval)), expected, `intervalle ${interval}`);
  }
});

test('les seuils viennent de la configuration', () => {
  const config = { stateThresholds: { acquiredIntervalDays: 10, masteredIntervalDays: 30 } };
  assert.equal(computeState(facts(9), config), 'learning');
  assert.equal(computeState(facts(10), config), 'acquired');
  assert.equal(computeState(facts(30), config), 'mastered');
});

// Partie 1 · 1.8, invariant 8 : l'état est calculé, jamais lu
test('un champ « état » stocké, l\'origine et la vérification sont ignorés', () => {
  assert.equal(computeState({ state: 'mastered' }), 'new');
  assert.equal(computeState({ introducedAt: T0, status: 'mastered' }), 'discovered');
  assert.equal(computeState({ ...facts(30), origin: 'declared', verified: false }), 'acquired');
  assert.equal(computeState({ ...facts(30), origin: 'tested', verified: true }), 'acquired');
  assert.equal(computeState({ ...facts(5), origin: 'declared' }), 'learning');
});

// Partie 1 · 1.8, invariant 1 : exactement un état
test('toujours exactement un des cinq états, ou une erreur explicite sur une entrée SRS invalide', () => {
  for (const interval of [0, 0.5, 20.9, 21, 59.9, 60, 1e6]) {
    assert.ok(STATE_ORDER.includes(computeState(facts(interval))));
  }
  for (const interval of [-1, NaN, Infinity, '30', undefined]) {
    assert.throws(() => computeState({ introducedAt: T0, srs: { interval } }), TypeError, String(interval));
  }
  assert.throws(() => computeState('水'), TypeError);
});

// Partie 1 · 1.8, invariant 4
test('« Oublié » ramène toujours un élément Acquis ou Maîtrisé à En cours', () => {
  for (const interval of [21, 30, 59, 60, 125, 400]) {
    const after = gradeReview(srsWith(interval), QUALITY.FORGOTTEN, T0);
    assert.equal(computeState({ introducedAt: T0, srs: after }), 'learning', `intervalle ${interval}`);
  }
});

// Partie 1 · 1.8, invariant 5 (côté SRS) ; invariant 9
test('aucune autre note ne fait reculer un élément En cours, Acquis ou Maîtrisé', () => {
  const rank = (f) => STATE_ORDER.indexOf(computeState(f));
  let checked = 0;
  for (let interval = 1; interval <= 200; interval++) {
    for (const repetitions of [1, 2, 3, 6]) {
      for (const easeFactor of [1.3, 2.5, 3.2]) {
        const before = { introducedAt: T0, srs: { ...srsWith(interval), repetitions, easeFactor } };
        // Les cas de début de gradeReview (1re et 2e répétition) ne concernent qu'un élément qui
        // vient de repartir de zéro : ils ne s'appliquent pas à un intervalle déjà élevé.
        if (repetitions < 2 && interval > 3) continue;
        for (const q of [QUALITY.HARD, QUALITY.GOOD, QUALITY.EASY]) {
          const after = { introducedAt: T0, srs: gradeReview(before.srs, q, T0) };
          assert.ok(rank(after) >= rank(before), `intervalle ${interval}, répétitions ${repetitions}, note ${q}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 1000);
});

// Partie 1 · 1.8, invariants 2 et 3
test('checkElementFacts : une entrée conforme ne signale rien', () => {
  assert.deepEqual(checkElementFacts(undefined), []);
  assert.deepEqual(checkElementFacts({}), []);
  assert.deepEqual(checkElementFacts({ introducedAt: T0 }), []);
  assert.deepEqual(checkElementFacts(facts(8)), []);
  // Entrée de déclaration : sans date de dernière révision (décision du 2026-10-01)
  assert.deepEqual(checkElementFacts({ introducedAt: T0, srs: { ...srsWith(30), lastReviewDate: null } }), []);
});

test('checkElementFacts : invariant 3, entrée SRS sans date d\'introduction', () => {
  const problems = checkElementFacts({ srs: srsWith(8) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /invariant 3/);
});

test('checkElementFacts : invariant 2, entrée SRS incomplète ou invalide', () => {
  const broken = { introducedAt: T0,
    srs: { interval: -1, easeFactor: 'x', repetitions: 1.5, nextReviewDate: 'jamais', lastReviewDate: 'hier' } };
  assert.equal(checkElementFacts(broken).length, 5);
  assert.equal(checkElementFacts({ introducedAt: 'hier' }).length, 1);
  assert.equal(checkElementFacts('水').length, 1);
});

test('checkElementFacts et computeState ne modifient pas l\'entrée', () => {
  const f = Object.freeze({ introducedAt: T0, srs: Object.freeze(srsWith(30)) });
  checkElementFacts(f);
  assert.equal(computeState(f), 'acquired');
});

test('GUIDED_CONFIG est utilisé par défaut', () => {
  assert.equal(computeState(facts(GUIDED_CONFIG.stateThresholds.acquiredIntervalDays)), 'acquired');
});

// Partie 3 · 3.7
test('avancement d\'une activité : non commencée, en cours, terminée', async () => {
  const { computeActivityStatus, ACTIVITY_STATUSES } = await import('../../src/learning/state.js');
  assert.deepEqual({ ...ACTIVITY_STATUSES },
    { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETED: 'completed' });
  assert.equal(computeActivityStatus(undefined), 'not_started');
  assert.equal(computeActivityStatus({ id: 'n5_m_1', startedAt: T0, completedAt: null }), 'in_progress');
  assert.equal(computeActivityStatus({ id: 'n5_m_1', startedAt: T0, completedAt: T0 }), 'completed');
});
