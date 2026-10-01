// Étape 1 · tâche 13 — Scénario de bout en bout sur le stockage en mémoire.
//
// Près de trois mois d'utilisation, uniquement par la surface publique de learning et le
// stockage : déclaration de niveau, leçon dans une session guidée, pratique libre, test de
// positionnement, révisions SRS jusqu'à la maîtrise, « Je le connais déjà » et son
// annulation, échec d'écriture et reprise, compaction au chargement, budget de chaque jour.
//
// Après CHAQUE événement : invariants des faits (1.8), S6 et S7 (avec les seules exceptions
// prévues), cohérence de l'état affiché. À plusieurs moments et à la fin : rechargement
// depuis le stockage (C3), résumés et budget. Aucune logique nouvelle : ce fichier ne fait
// qu'utiliser ce que les tâches 1 à 12 ont construit.

process.env.TZ = 'Europe/Paris';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLearning, RECORD_STATUS, computeState, computeActivityStatus, isWeaknessActive,
  STATE_ORDER, createEventId
} from '../../src/learning/index.js';
import { checkElementFacts } from '../../src/learning/state.js';
import { createMemoryStore } from '../../src/store/memory.js';
import { DEFAULT_USER_SETTINGS } from '../../src/config.js';

// ── Contenu factice (l'étape 2 fournira le vrai) ────────────────────────────

const CATALOG = {
  kana: ['kana_あ', 'kana_い', 'kana_う'].map((id) => ({ type: 'kana', id })),
  n5: [{ type: 'grammar', id: 'n5_g_8' }, { type: 'kanji', id: '水' },
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'vocab', id: `n5_v_${i + 1}` }))],
  n4: [], n3: [], n2: [], n1: []
};
const ALL = Object.values(CATALOG).flat();
const elementExists = (r) => ALL.some((x) => x.type === r.type && x.id === r.id);
const elementsOfScope = (level) => CATALOG[level];
const ref = (id) => ALL.find((r) => r.id === id);
const LIMIT = DEFAULT_USER_SETTINGS.dailyNewBudget;

// ── Contextes ───────────────────────────────────────────────────────────────

const GUIDED_LESSON = { mode: 'guided', source: 'home', activityType: 'lesson', activityId: 'n5_g_8' };
const PRACTICE = { mode: 'free', source: 'practice', activityType: 'quiz', exerciseType: 'qcm' };
const REVIEW = { mode: 'free', source: 'review', activityType: 'srs_review', exerciseType: 'flashcard' };
const FICHE = { mode: 'free', source: 'fiche', activityType: 'declaration' };
const ONBOARDING = { mode: 'free', source: 'onboarding', activityType: 'declaration' };
const PLACEMENT = { mode: 'free', source: 'onboarding', activityType: 'placement', exerciseType: 'qcm' };

test('étape 1 de bout en bout : trois mois d\'apprentissage, invariants vérifiés à chaque événement', async () => {
  const store = createMemoryStore();
  const clock = { now: new Date(Date.UTC(2026, 9, 1, 7)) }; // 1er octobre, 9 h à Paris
  const setDay = (day, hour = 9) => {
    clock.now = new Date(Date.UTC(2026, 9, 1 + day, hour - 2)); // heure de Paris (été)
    if (clock.now >= new Date(Date.UTC(2026, 9, 25, 1))) clock.now = new Date(clock.now.getTime() + 3600000);
  };
  const open = async () => {
    const l = createLearning({ store, elementExists, elementsOfScope, now: () => clock.now, warn: () => {} });
    await l.load();
    return l;
  };
  let learning = await open();
  const stats = { recorded: 0, answers: 0, reviews: 0 };

  // ── Vérifications après chaque événement ──
  function checkStep(before, after, event) {
    for (const facts of Object.values(after.elements)) {
      assert.deepEqual(checkElementFacts(facts), [], `${event.type} : faits de ${facts.id}`);
    }
    for (const r of ALL) {
      const was = computeState(before.elements[r.id]);
      const now = computeState(after.elements[r.id]);
      assert.ok(STATE_ORDER.includes(now));
      // S7 : pas de recul, sauf « Oublié » et l'annulation d'une déclaration.
      if (STATE_ORDER.indexOf(now) < STATE_ORDER.indexOf(was)) {
        assert.ok((event.type === 'REVIEW_GRADED' && event.payload.quality === 0) ||
          event.type === 'KNOWLEDGE_DECLARATION_UNDONE', `S7 : ${r.id} recule par ${event.type}`);
      }
      // S6 : un intervalle ne change que par REVIEW_GRADED, création, déclaration ou annulation.
      const a = before.elements[r.id]?.srs;
      const b = after.elements[r.id]?.srs;
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        assert.ok(!a || ['REVIEW_GRADED', 'KNOWLEDGE_DECLARED', 'KNOWLEDGE_DECLARATION_UNDONE'].includes(event.type),
          `S6 : SRS de ${r.id} modifié par ${event.type}`);
      }
    }
  }

  let seq = 0;
  async function send(type, payload, context, { expect = RECORD_STATUS.RECORDED, session, sessionId } = {}) {
    seq += 1;
    const event = { id: createEventId(), type, at: new Date(clock.now.getTime() + seq * 1000).toISOString(),
      context, payload, ...(sessionId ? { sessionId } : {}) };
    const before = learning.getSnapshot();
    const result = await learning.recordLearningEvent(event, session === undefined ? {} : { session });
    assert.equal(result.status, expect, `${type} : ${JSON.stringify(result.problems || result.failure || '')}`);
    if (result.status === RECORD_STATUS.RECORDED) {
      stats.recorded += 1;
      if (type === 'QUESTION_ANSWERED') stats.answers += 1;
      if (type === 'REVIEW_GRADED') stats.reviews += 1;
      checkStep(before, learning.getSnapshot(), event);
    } else {
      assert.equal(learning.getSnapshot(), before, `${type} non enregistré : état inchangé`);
    }
    return { event, result };
  }
  const st = (id) => computeState(learning.getSnapshot().elements[id]);
  const budget = async () => (await learning.getNewContentBudget(LIMIT)).used;

  async function reloadAndCompare(label) {
    const shown = learning.getSnapshot();
    const session = learning.getSession();
    learning = await open();
    assert.deepEqual(learning.getSnapshot(), shown, `C3 (${label}) : état rechargé`);
    assert.deepEqual(learning.getSession(), session, `C3 (${label}) : session rechargée`);
  }

  // ═══ Jour 0 — premier lancement ═══════════════════════════════════════════
  assert.equal(typeof (await store.get('meta', 'installationId')).value, 'string');

  // Un kana présenté (bloc Kana), puis « Ce que je connais déjà : Kana ».
  await send('CONTENT_INTRODUCED', { element: ref('kana_あ') },
    { mode: 'free', source: 'learn', activityType: 'lesson' });
  assert.equal(st('kana_あ'), 'discovered');
  assert.equal(await budget(), 0, 'un kana ne consomme pas le budget de contenu');
  await send('KNOWLEDGE_DECLARED', { scope: 'kana', origin: 'declared', declarationId: 'dcl_kana' }, ONBOARDING);
  for (const k of CATALOG.kana) assert.equal(st(k.id), 'acquired');
  assert.equal(await budget(), 0, 'une déclaration ne consomme pas le budget');

  // Session guidée : une leçon de grammaire et deux mots.
  const S = 'ses_jour0';
  await send('SESSION_STARTED', { sessionType: 'normal', plannedMinutes: 12, plan: ['lesson'] },
    { mode: 'guided', source: 'home' }, { sessionId: S, session: { id: S, position: 0 } });
  await send('ACTIVITY_STARTED', { activityId: 'n5_g_8', activityType: 'lesson' }, GUIDED_LESSON, { sessionId: S });
  for (const id of ['n5_g_8', 'n5_v_1', 'n5_v_2']) {
    await send('CONTENT_INTRODUCED', { element: ref(id) }, GUIDED_LESSON, { sessionId: S });
  }
  assert.equal(st('n5_g_8'), 'discovered');
  assert.equal(await budget(), 3);
  await send('QUESTION_ANSWERED', { questionId: 'gen:cloze:n5_g_8:ex1', target: [ref('n5_g_8')], correct: false, answer: 'が' },
    { ...GUIDED_LESSON, exerciseType: 'cloze' }, { sessionId: S, session: { id: S, position: 1 } });
  await send('QUESTION_ANSWERED', { questionId: 'gen:cloze:n5_g_8:ex2', target: [ref('n5_g_8')], correct: true },
    { ...GUIDED_LESSON, exerciseType: 'cloze' }, { sessionId: S });
  assert.equal(st('n5_g_8'), 'learning');
  assert.equal(await budget(), 3, 'Découvert → En cours ne recompte pas');
  await send('ACTIVITY_COMPLETED', { activityId: 'n5_g_8', activityType: 'lesson', durationSeconds: 240 },
    GUIDED_LESSON, { sessionId: S });
  await send('SESSION_COMPLETED', { actualMinutes: 11, completedActivities: ['n5_g_8'] },
    { mode: 'guided', source: 'home' }, { sessionId: S, session: null });
  assert.equal(learning.getSession(), null);
  assert.equal(computeActivityStatus(learning.getSnapshot().activities.n5_g_8), 'completed');

  // Pratique libre : un mot nouveau, raté ; la réponse part deux fois (double clic).
  const { event: missed } = await send('QUESTION_ANSWERED',
    { questionId: 'gen:meaning:n5_v_3:a', target: [ref('n5_v_3')], correct: false }, PRACTICE);
  assert.equal((await learning.recordLearningEvent(missed)).status, RECORD_STATUS.DUPLICATE);
  assert.equal(learning.getSnapshot().weaknesses.n5_v_3.consecutiveFails, 1, 'le doublon n\'a pas d\'effet');
  assert.equal(st('n5_v_3'), 'learning');
  assert.equal(await budget(), 4, 'les nouveautés hors du mode guidé comptent (S10)');

  // Test de positionnement : réponses sans effet.
  await send('QUESTION_ANSWERED', { questionId: 'placement_q1', target: [ref('n5_v_9')], correct: false }, PLACEMENT);
  assert.equal(st('n5_v_9'), 'new');

  // Événements refusés : invalide, élément inexistant, REVIEW_GRADED hors révision.
  await send('QUESTION_ANSWERED', { questionId: 'q', target: [{ type: 'vocab', id: 'n5_v_404' }], correct: true },
    PRACTICE, { expect: RECORD_STATUS.REJECTED });
  await send('REVIEW_GRADED', { element: ref('n5_v_1'), quality: 2 }, PRACTICE, { expect: RECORD_STATUS.REJECTED });

  await reloadAndCompare('fin du jour 0');

  // ═══ Jour 1 — révisions, puis échec d'écriture ════════════════════════════
  setDay(1);
  assert.equal(await budget(), 0, 'nouveau jour, nouveau budget');
  await send('REVIEW_GRADED', { element: ref('n5_g_8'), quality: 2 }, REVIEW);
  await send('REVIEW_GRADED', { element: ref('n5_v_3'), quality: 0 }, REVIEW);
  const weakV3 = learning.getSnapshot().weaknesses.n5_v_3;
  assert.equal(weakV3.consecutiveFails, 2);
  assert.ok(isWeaknessActive(weakV3));

  // Le stockage échoue (écriture, compaction, nouvelle tentative) : réponse en attente.
  store.failNextCommit('quota', 3);
  const pendingAnswer = await send('QUESTION_ANSWERED',
    { questionId: 'gen:meaning:n5_v_3:b', target: [ref('n5_v_3')], correct: true }, PRACTICE,
    { expect: RECORD_STATUS.PENDING });
  // Une seconde réponse attend derrière, même si le stockage refonctionne.
  await send('QUESTION_ANSWERED', { questionId: 'gen:meaning:n5_v_3:c', target: [ref('n5_v_3')], correct: true },
    PRACTICE, { expect: RECORD_STATUS.PENDING });
  assert.equal(learning.getWriteFailure().pendingCount, 2);
  assert.equal(await store.get('events', pendingAnswer.event.id), undefined);
  // « Réessayer »
  const before = learning.getSnapshot();
  assert.deepEqual(await learning.retry(), { status: 'recovered', recorded: 2, remaining: 0 });
  stats.recorded += 2; stats.answers += 2;
  assert.equal(learning.getWriteFailure(), null);
  assert.equal(learning.getSnapshot().weaknesses.n5_v_3.consecutiveFails, 0);
  assert.notEqual(learning.getSnapshot(), before);

  // ═══ Jour 2 — « Je le connais déjà », puis annulation le lendemain ════════
  setDay(2);
  await send('KNOWLEDGE_DECLARED', { elements: [ref('水')], origin: 'declared', declarationId: 'dcl_mizu' }, FICHE);
  assert.equal(st('水'), 'acquired');
  setDay(3);
  await send('KNOWLEDGE_DECLARATION_UNDONE', { declarationId: 'dcl_mizu' }, FICHE);
  assert.equal(st('水'), 'new');
  assert.equal(learning.getSnapshot().elements['水'], undefined);
  assert.equal(await budget(), 0);

  // ═══ Jours suivants — réviser n5_g_8 à chaque échéance jusqu'à la maîtrise ═
  let reloads = 0;
  for (let guard = 0; st('n5_g_8') !== 'mastered' && guard < 10; guard++) {
    const due = new Date(learning.getSnapshot().elements.n5_g_8.srs.nextReviewDate);
    clock.now = new Date(due.getTime() + 3600000);
    learning = await open(); // un lancement par jour de révision : compaction quotidienne
    reloads += 1;
    await send('REVIEW_GRADED', { element: ref('n5_g_8'), quality: 2 }, REVIEW);
    assert.equal(await budget(), 0, 'réviser ne consomme pas le budget');
  }
  assert.equal(st('n5_g_8'), 'mastered');
  assert.ok(reloads >= 4);

  // « Ce que je connais déjà : N5 », puis annulation : un élément maîtrisé n'est pas touché,
  // les autres retrouvent exactement leurs faits.
  const beforeN5 = learning.getSnapshot();
  await send('KNOWLEDGE_DECLARED', { scope: 'n5', origin: 'declared', declarationId: 'dcl_n5' }, ONBOARDING);
  assert.equal(learning.getSnapshot().elements.n5_g_8, beforeN5.elements.n5_g_8, 'maîtrisé : non touché');
  for (const id of ['n5_v_1', 'n5_v_3', 'n5_v_9', '水']) assert.equal(st(id), 'acquired', id);
  assert.equal(await budget(), 0);
  // Une vraie révision entre la déclaration et son annulation : elle doit primer.
  await send('REVIEW_GRADED', { element: ref('n5_v_3'), quality: 0 }, REVIEW);
  const reviewedV3 = learning.getSnapshot().elements.n5_v_3;
  assert.equal(reviewedV3.verified, true);
  await send('KNOWLEDGE_DECLARATION_UNDONE', { declarationId: 'dcl_n5' }, ONBOARDING);
  const { n5_v_3: keptV3, ...others } = learning.getSnapshot().elements;
  const { n5_v_3: _oldV3, ...othersBefore } = beforeN5.elements;
  assert.deepEqual(others, othersBefore, 'annulation : retour exact des éléments non révisés');
  assert.equal(keptV3, reviewedV3, 'annulation : l\'élément révisé garde sa révision');
  assert.ok(clock.now > new Date(Date.UTC(2026, 11, 1)), 'plus de deux mois écoulés');

  // ═══ Fin — état attendu, journal, rechargement ════════════════════════════
  const snap = learning.getSnapshot();
  const expected = {
    kana_あ: 'acquired', kana_い: 'acquired', kana_う: 'acquired', // déclarés, jamais révisés
    n5_g_8: 'mastered', n5_v_1: 'discovered', n5_v_2: 'discovered', n5_v_3: 'learning',
    水: 'new', n5_v_9: 'new', n5_v_4: 'new'
  };
  for (const [id, state] of Object.entries(expected)) assert.equal(st(id), state, id);
  assert.equal(snap.elements.kana_あ.origin, 'declared');
  assert.equal(snap.elements.kana_あ.verified, false);
  assert.equal(snap.elements.n5_g_8.origin, 'learned');
  assert.equal(snap.declarations.dcl_mizu.undoneAt !== null, true);
  assert.equal(snap.declarations.dcl_kana.undoneAt, null);

  // Journal : le détail ancien a été compacté, les résumés comptent tout.
  const events = await store.getAll('events');
  assert.ok(events.length < stats.recorded, 'la compaction a supprimé du détail ancien');
  const summaries = await learning.getDailySummaries();
  const answers = summaries.reduce((n, d) => n + Object.values(d.answers).flatMap(Object.values)
    .reduce((a, c) => a + c.correct + c.incorrect, 0), 0);
  const reviews = summaries.reduce((n, d) => n + Object.values(d.reviews).reduce((a, b) => a + b, 0), 0);
  assert.equal(answers, stats.answers, 'résumés : toutes les réponses (positionnement compris)');
  assert.equal(reviews, stats.reviews, 'résumés : toutes les révisions');
  const day0 = summaries.find((d) => d.date === '2026-10-01');
  assert.deepEqual(day0.introduced, { kana: 1, grammar: 1, vocab: 3 });
  assert.equal(day0.activitiesCompleted, 1);
  assert.equal(day0.sessionMinutes, 11);

  // C3 final, puis C5 : une compaction de plus ne change rien.
  await reloadAndCompare('fin du scénario');
  const beforeCompaction = learning.getSnapshot();
  await learning.compactJournal();
  assert.equal(learning.getSnapshot(), beforeCompaction);
  await reloadAndCompare('après compaction');
});
