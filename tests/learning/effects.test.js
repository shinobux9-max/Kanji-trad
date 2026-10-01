// Tests de src/learning/effects.js, première partie : CONTENT_INTRODUCED, QUESTION_ANSWERED,
// REVIEW_GRADED (partie 3, 3.4) ; critères S6, S7, C1, C4 (partie 7) ; invariants de 1.8 et
// 3.10.

process.env.TZ = 'Europe/Paris'; // échéances en jours calendaires locaux (voir srs.test.js)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, createEmptyLearningState, ORIGINS } from '../../src/learning/effects.js';
import { validateEvent, CONTEXT_VALUES } from '../../src/learning/events.js';
import { computeState, checkElementFacts, STATE_ORDER } from '../../src/learning/state.js';
import { isWeaknessActive } from '../../src/learning/weakness.js';
import { replay, seededRandom } from './replay.js';

// ── Fabrique d'événements valides ───────────────────────────────────────────

let counter = 0;
const day = (n, h = 8) => new Date(Date.UTC(2026, 9, 1 + n, h)).toISOString();
const R = {
  wa: { type: 'grammar', id: 'n5_g_8' },
  mizu: { type: 'kanji', id: '水' },
  word: { type: 'vocab', id: 'n5_v_117' },
  a: { type: 'kana', id: 'kana_あ' },
  ex: { type: 'expression', id: 'ex_3' }
};
const PRACTICE = { mode: 'free', source: 'practice', activityType: 'quiz', exerciseType: 'qcm' };
const REVIEW = { mode: 'free', source: 'review', activityType: 'srs_review', exerciseType: 'flashcard' };

const ev = (type, at, payload, context, extra = {}) => {
  const e = { id: `evt_${++counter}`, type, at, context, payload, ...extra };
  const problems = validateEvent(e);
  assert.deepEqual(problems, [], `événement de test invalide : ${JSON.stringify(e)}`);
  return e;
};
const introduced = (ref, at = day(0)) =>
  ev('CONTENT_INTRODUCED', at, { element: ref }, { mode: 'free', source: 'learn', activityType: 'lesson' });
const answered = (refs, correct, at = day(0), context = PRACTICE) =>
  ev('QUESTION_ANSWERED', at, { questionId: 'q1', target: [].concat(refs), correct }, context);
const graded = (ref, quality, at = day(0), context = REVIEW) =>
  ev('REVIEW_GRADED', at, { element: ref, quality }, context);

const stateOf = (s, ref) => computeState(s.elements[ref.id]);

function deepFreeze(o) {
  if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
  return o;
}

// ── Synthèse de 3.4, ligne par ligne ────────────────────────────────────────

test('présentation : Nouveau → Découvert, sans SRS ni faiblesse', () => {
  const s = replay([introduced(R.wa, day(0))]);
  assert.equal(stateOf(s, R.wa), 'discovered');
  assert.deepEqual(s.elements[R.wa.id], { id: 'n5_g_8', introducedAt: day(0) });
  assert.deepEqual(s.weaknesses, {});
});

test('une seconde présentation ne change rien', () => {
  const first = replay([introduced(R.wa, day(0))]);
  const { state, changed } = applyEvent(first, introduced(R.wa, day(3)));
  assert.deepEqual(state.elements, first.elements);
  assert.deepEqual(changed, { elements: [], weaknesses: [] });
});

test('première évaluation juste : → En cours, origine learned, SRS créé à J+1, pas de faiblesse', () => {
  const s = replay([introduced(R.word, day(0)), answered(R.word, true, day(2))]);
  assert.equal(stateOf(s, R.word), 'learning');
  assert.deepEqual(s.elements[R.word.id], {
    id: 'n5_v_117', introducedAt: day(0), origin: ORIGINS.LEARNED,
    srs: { interval: 1, easeFactor: 2.5, repetitions: 0, lastReviewDate: null, nextReviewDate: day(3) }
  });
  assert.deepEqual(s.weaknesses, {});
});

test('première évaluation fausse : → En cours, SRS créé à J+1, faiblesse créée', () => {
  const s = replay([answered(R.word, false, day(0))]);
  assert.equal(stateOf(s, R.word), 'learning');
  assert.equal(s.elements[R.word.id].introducedAt, day(0)); // directement depuis Nouveau
  assert.equal(s.elements[R.word.id].srs.nextReviewDate, day(1));
  assert.equal(s.weaknesses[R.word.id].consecutiveFails, 1);
  assert.equal(s.weaknesses[R.word.id].id, 'n5_v_117');
});

test('réponse hors révision SRS : état et SRS inchangés, seule la faiblesse bouge', () => {
  const start = replay([answered(R.word, false, day(0)), graded(R.word, 2, day(1)), graded(R.word, 2, day(2))]);
  const srsBefore = start.elements[R.word.id].srs;
  const wrong = replay([answered(R.word, false, day(5))], { initial: start });
  // Les deux « Bien » ont ramené les échecs consécutifs de 1 à 0 (série de 2 réussites).
  assert.equal(start.weaknesses[R.word.id].consecutiveFails, 0);
  assert.deepEqual(wrong.elements[R.word.id].srs, srsBefore);
  assert.equal(computeState(wrong.elements[R.word.id]), computeState(start.elements[R.word.id]));
  assert.equal(wrong.weaknesses[R.word.id].consecutiveFails, 1);
  assert.equal(wrong.weaknesses[R.word.id].totalFails, 2);
  const right = replay([answered(R.word, true, day(5))], { initial: start });
  assert.deepEqual(right.elements[R.word.id].srs, srsBefore);
  assert.equal(right.weaknesses[R.word.id].successStreak, 3);
  assert.equal(isWeaknessActive(right.weaknesses[R.word.id]), false); // 3e réussite : résolue
});

test('révision SRS : gradeReview ; Bien/Facile diminuent la faiblesse, Difficile la laisse, Oublié l\'augmente', () => {
  const start = replay([answered(R.mizu, false, day(0)), answered(R.mizu, false, day(0))]); // 2 échecs
  const after = (q) => replay([graded(R.mizu, q, day(1))], { initial: start });
  assert.equal(after(0).weaknesses[R.mizu.id].consecutiveFails, 3);
  assert.equal(after(1).weaknesses[R.mizu.id].consecutiveFails, 2);
  assert.equal(after(2).weaknesses[R.mizu.id].consecutiveFails, 1);
  assert.equal(after(3).weaknesses[R.mizu.id].consecutiveFails, 1);
  assert.equal(after(2).elements[R.mizu.id].srs.repetitions, 1);
  assert.equal(after(2).elements[R.mizu.id].srs.lastReviewDate, day(1));
});

test('révision SRS « Oublié » : un élément Acquis ou Maîtrisé redevient En cours (1.8, invariant 4)', () => {
  let s = replay([answered(R.mizu, true, day(0))]);
  for (let i = 1; i <= 6; i++) s = replay([graded(R.mizu, 2, day(i))], { initial: s });
  assert.equal(stateOf(s, R.mizu), 'mastered');
  s = replay([graded(R.mizu, 0, day(10))], { initial: s });
  assert.equal(stateOf(s, R.mizu), 'learning');
});

test('test de positionnement : réponses sans aucun effet (3.4 ; 3.10, invariant 5)', () => {
  const placement = { mode: 'free', source: 'onboarding', activityType: 'placement', exerciseType: 'qcm' };
  const { state, changed } = applyEvent(createEmptyLearningState(), answered([R.word, R.wa], false, day(0), placement));
  assert.deepEqual(state, createEmptyLearningState());
  assert.deepEqual(changed, { elements: [], weaknesses: [] });
});

test('une question à plusieurs cibles fait évoluer chacune', () => {
  const s = replay([answered([R.wa, R.word], false, day(0))]);
  assert.equal(stateOf(s, R.wa), 'learning');
  assert.equal(stateOf(s, R.word), 'learning');
  assert.equal(Object.keys(s.weaknesses).length, 2);
});

test('les kana suivent la même échelle (1.8, invariant 10)', () => {
  const s = replay([introduced(R.a, day(0)), answered(R.a, true, day(0))]);
  assert.equal(stateOf(s, R.a), 'learning');
});

test('vérification d\'un élément déclaré : marqué vérifié à la première révision, quelle que soit la note', () => {
  const declared = { id: 'n5_v_117', introducedAt: day(0), origin: ORIGINS.DECLARED, verified: false,
    srs: { interval: 30, easeFactor: 2.5, repetitions: 3, lastReviewDate: null, nextReviewDate: day(30) } };
  for (const q of [0, 1, 2, 3]) {
    const s = replay([graded(R.word, q, day(30))], { initial: { elements: { [R.word.id]: declared }, weaknesses: {} } });
    assert.equal(s.elements[R.word.id].verified, true, `note ${q}`);
    assert.equal(s.elements[R.word.id].origin, ORIGINS.DECLARED);
  }
  // Une réponse de pratique ne vaut pas vérification.
  const s = replay([answered(R.word, true, day(30))], { initial: { elements: { [R.word.id]: declared }, weaknesses: {} } });
  assert.equal(s.elements[R.word.id].verified, false);
});

test('une révision d\'un élément sans entrée SRS le fait entrer en En cours (origine learned)', () => {
  const s = replay([graded(R.ex, 2, day(0))]);
  assert.equal(stateOf(s, R.ex), 'learning');
  assert.equal(s.elements[R.ex.id].origin, ORIGINS.LEARNED);
  assert.equal(s.elements[R.ex.id].introducedAt, day(0));
});

test('événements sans effet : sessions et renforcement (3.4)', () => {
  const start = replay([answered(R.word, false, day(0))]);
  const session = ev('SESSION_STARTED', day(1), { sessionType: 'short', plannedMinutes: 5, plan: [] },
    { mode: 'guided', source: 'home' }, { sessionId: 'ses_1' });
  const reinforcement = ev('REINFORCEMENT_TRIGGERED', day(1), { element: R.word, reason: 'error', sourceActivity: null },
    { mode: 'guided', source: 'home', activityType: 'quiz' }, { sessionId: 'ses_1' });
  for (const e of [session, reinforcement]) {
    const { state, changed } = applyEvent(start, e);
    assert.deepEqual(state, start);
    assert.deepEqual(changed, { elements: [], weaknesses: [] });
  }
});

test('ACTIVITY_… et KNOWLEDGE_… : refusés tant que la tâche 7 ne les traite pas', () => {
  const e = ev('KNOWLEDGE_DECLARED', day(0), { scope: 'n5', origin: 'declared', declarationId: 'd1' },
    { mode: 'free', source: 'onboarding', activityType: 'declaration' });
  assert.throws(() => applyEvent(createEmptyLearningState(), e), /non encore implémentés/);
});

test('fonction pure : l\'état reçu n\'est pas modifié ; « changed » liste ce qui a bougé', () => {
  const start = deepFreeze(replay([answered(R.word, false, day(0))]));
  const { state, changed } = applyEvent(start, graded(R.word, 2, day(1)));
  assert.notEqual(state, start);
  assert.deepEqual(changed, { elements: ['n5_v_117'], weaknesses: ['n5_v_117'] });
  assert.equal(start.elements[R.word.id].srs.repetitions, 0);
});

// ── C1 : même effet quel que soit l'écran ───────────────────────────────────

// Partie 7 · C1 ; partie 3 · 3.10, invariants 6 et 10
test('C1 : une même réponse a le même effet depuis le mode guidé, Pratiquer, un dossier, quel que soit l\'exercice', () => {
  const start = replay([introduced(R.wa, day(0)), answered(R.wa, false, day(0))]);
  const contexts = [
    { mode: 'guided', source: 'home', activityType: 'lesson', exerciseType: 'cloze' },
    { mode: 'free', source: 'practice', activityType: 'quiz', exerciseType: 'qcm' },
    { mode: 'free', source: 'folder', activityType: 'quiz', folderId: 'fld_1', exerciseType: 'self_report' },
    { mode: 'free', source: 'explore', activityType: 'mission', activityId: 'n5_m_1', exerciseType: 'naturalness' },
    { mode: 'free', source: 'practice', activityType: 'speaking', exerciseType: 'speaking' },
    { mode: 'free', source: 'practice', activityType: 'writing', exerciseType: 'writing' }
  ];
  for (const correct of [true, false]) {
    const results = contexts.map((c, i) => {
      const extra = c.mode === 'guided' ? { sessionId: 'ses_1' } : {};
      return applyEvent(start, ev('QUESTION_ANSWERED', day(1), { questionId: 'q', target: [R.wa], correct }, c, extra));
    });
    for (const r of results.slice(1)) assert.deepEqual(r, results[0], `correct = ${correct}`);
  }
  // Même chose pour une révision SRS lancée depuis Réviser ou depuis le mode guidé.
  const fromReview = applyEvent(start, graded(R.wa, 2, day(1)));
  const fromGuided = applyEvent(start, ev('REVIEW_GRADED', day(1), { element: R.wa, quality: 2 },
    { mode: 'guided', source: 'home', activityType: 'srs_review' }, { sessionId: 'ses_1' }));
  assert.deepEqual(fromGuided, fromReview);
});

// ── C4 : une révision, un seul événement ────────────────────────────────────

// Partie 7 · C4 (côté traitement) ; partie 3 · 3.10, invariant 9. Le comptage des événements
// émis par l'écran de révision sera vérifié avec l'interface (étape 5).
test('C4 : REVIEW_GRADED porte à lui seul SRS et faiblesse ; une carte ratée compte un seul échec', () => {
  const start = replay([answered(R.mizu, true, day(0))]);
  const { state, changed } = applyEvent(start, graded(R.mizu, 0, day(1)));
  assert.deepEqual(changed, { elements: ['水'], weaknesses: ['水'] });
  assert.equal(state.weaknesses[R.mizu.id].consecutiveFails, 1);
  assert.equal(state.weaknesses[R.mizu.id].totalFails, 1);
  assert.equal(state.elements[R.mizu.id].srs.repetitions, 0);
});

// ── S6 et S7 : rejeu de journaux aléatoires ─────────────────────────────────

function randomJournal(seed, length) {
  const rnd = seededRandom(seed);
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const refs = Object.values(R);
  const events = [];
  let t = Date.UTC(2026, 9, 1, 8);
  for (let i = 0; i < length; i++) {
    t += Math.floor(rnd() * 3 * 86400000);
    const at = new Date(t).toISOString();
    const r = rnd();
    if (r < 0.15) events.push(introduced(pick(refs), at));
    else if (r < 0.45) {
      const ctx = rnd() < 0.1
        ? { mode: 'free', source: 'onboarding', activityType: 'placement' }
        : { ...PRACTICE, source: pick(['practice', 'folder', 'explore', 'learn']),
            exerciseType: pick(CONTEXT_VALUES.exerciseType) };
      if (ctx.source === 'folder') ctx.folderId = 'fld_1';
      events.push(answered(rnd() < 0.2 ? [pick(refs), pick(refs)].filter((x, j, a) => a.indexOf(x) === j) : pick(refs),
        rnd() < 0.6, at, ctx));
    } else if (r < 0.9) events.push(graded(pick(refs), Math.floor(rnd() * 4), at));
    else events.push(ev('REINFORCEMENT_TRIGGERED', at, { element: pick(refs), reason: 'error', sourceActivity: null },
      { mode: 'guided', source: 'home', activityType: 'quiz' }, { sessionId: 'ses_1' }));
  }
  return events;
}

// Partie 7 · S6 ; partie 3 · 3.10, invariant 2
test('S6 : aucun intervalle SRS ne change hors REVIEW_GRADED, sauf à la création', () => {
  let steps = 0;
  for (let seed = 1; seed <= 40; seed++) {
    replay(randomJournal(seed, 120), {
      onStep(before, after, event) {
        steps++;
        for (const [id, facts] of Object.entries(after.elements)) {
          const prev = before.elements[id];
          if (JSON.stringify(prev?.srs) === JSON.stringify(facts.srs)) continue;
          const creation = !prev || !prev.srs;
          assert.ok(event.type === 'REVIEW_GRADED' || creation,
            `germe ${seed} : SRS de ${id} modifié par ${event.type}`);
        }
      }
    });
  }
  assert.equal(steps, 4800);
});

// Partie 7 · S7 ; partie 1 · 1.8, invariants 4, 5 et 9
test('S7 : aucun élément ne recule, sauf par « Oublié »', () => {
  for (let seed = 1; seed <= 40; seed++) {
    replay(randomJournal(seed, 120), {
      onStep(before, after, event) {
        for (const id of Object.keys(after.elements)) {
          const was = STATE_ORDER.indexOf(computeState(before.elements[id]));
          const now = STATE_ORDER.indexOf(computeState(after.elements[id]));
          if (now < was) {
            assert.ok(event.type === 'REVIEW_GRADED' && event.payload.quality === 0,
              `germe ${seed} : ${id} recule par ${event.type}`);
          }
        }
      }
    });
  }
});

// Partie 1 · 1.8, invariants 2 et 3
test('après rejeu, toutes les entrées respectent les invariants des faits', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = replay(randomJournal(seed, 120));
    for (const facts of Object.values(s.elements)) {
      assert.deepEqual(checkElementFacts(facts), [], `germe ${seed} : ${facts.id}`);
    }
    for (const [id, w] of Object.entries(s.weaknesses)) {
      assert.equal(w.id, id);
      assert.ok(w.consecutiveFails >= 0 && w.totalFails >= w.consecutiveFails);
      assert.equal(typeof isWeaknessActive(w), 'boolean');
    }
  }
});
