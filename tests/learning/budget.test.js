// Tests de src/learning/budget.js et de son branchement : budget quotidien de nouveautés
// (partie 4, 4.4), base du critère S10 (partie 7 ; le respect du budget par le moteur guidé
// sera testé à l'étape 4).

process.env.TZ = 'Europe/Paris';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elementsLeavingNew, newContentCount, budgetStatus, BUDGET_TYPES } from '../../src/learning/budget.js';
import { applyEvent, createEmptyLearningState } from '../../src/learning/effects.js';
import { createLearning, RECORD_STATUS } from '../../src/learning/index.js';
import { createMemoryStore } from '../../src/store/memory.js';
import { DEFAULT_USER_SETTINGS, GUIDED_CONFIG } from '../../src/config.js';

const at = (d, h = 8) => new Date(Date.UTC(2026, 9, 1 + d, h)).toISOString();
let counter = 0;
const id = () => `evt_${++counter}`;
const vocab = (n) => ({ type: 'vocab', id: `n5_v_${n}` });
const KANA = { type: 'kana', id: 'kana_あ' };
const MIZU = { type: 'kanji', id: '水' };
const LESSON = { type: 'grammar', id: 'n5_g_8' };
const EX = { type: 'expression', id: 'ex_3' };

const introduced = (ref, when = at(0), ctx = { mode: 'free', source: 'learn', activityType: 'lesson' }, extra = {}) =>
  ({ id: id(), type: 'CONTENT_INTRODUCED', at: when, context: ctx, payload: { element: ref }, ...extra });
const answered = (refs, correct, when = at(0), ctx = { mode: 'free', source: 'practice', activityType: 'quiz' }) =>
  ({ id: id(), type: 'QUESTION_ANSWERED', at: when, context: ctx, payload: { questionId: 'q', target: [].concat(refs), correct } });
const graded = (ref, q, when = at(0)) => ({ id: id(), type: 'REVIEW_GRADED', at: when,
  context: { mode: 'free', source: 'review', activityType: 'srs_review' }, payload: { element: ref, quality: q } });
const declared = (refs, declarationId, when = at(0), origin = 'declared') => ({ id: id(), type: 'KNOWLEDGE_DECLARED', at: when,
  context: { mode: 'free', source: 'fiche', activityType: 'declaration' }, payload: { elements: refs, origin, declarationId } });
const undone = (declarationId, when = at(0)) => ({ id: id(), type: 'KNOWLEDGE_DECLARATION_UNDONE', at: when,
  context: { mode: 'free', source: 'fiche', activityType: 'declaration' }, payload: { declarationId } });

const leaving = (state, event) => elementsLeavingNew(state, applyEvent(state, event).state, event).map((r) => r.id);
const empty = createEmptyLearningState();

// ── Qui quitte Nouveau ──────────────────────────────────────────────────────

test('présentation d\'un élément Nouveau : il quitte Nouveau ; déjà Découvert : non', () => {
  assert.deepEqual(leaving(empty, introduced(vocab(1))), ['n5_v_1']);
  const discovered = applyEvent(empty, introduced(vocab(1))).state;
  assert.deepEqual(leaving(discovered, introduced(vocab(1))), []);
});

test('première réponse évaluée sur un élément Nouveau : il quitte Nouveau ; Découvert → En cours : non', () => {
  assert.deepEqual(leaving(empty, answered(vocab(1), false)), ['n5_v_1']);
  const discovered = applyEvent(empty, introduced(vocab(1))).state;
  assert.deepEqual(leaving(discovered, answered(vocab(1), true)), [], 'déjà compté à la présentation');
  assert.deepEqual(leaving(empty, answered([vocab(1), MIZU, KANA], true)), ['n5_v_1', '水', 'kana_あ']);
});

test('première note SRS sur un élément Nouveau : il quitte Nouveau', () => {
  assert.deepEqual(leaving(empty, graded(EX, 2)), ['ex_3']);
});

test('ne quittent pas Nouveau au sens du budget : test de positionnement, déclaration, annulation', () => {
  const placement = answered(vocab(1), true, at(0), { mode: 'free', source: 'onboarding', activityType: 'placement' });
  assert.deepEqual(leaving(empty, placement), []);
  assert.deepEqual(leaving(empty, declared([vocab(1), vocab(2)], 'd1')), []);
  const afterDecl = applyEvent(empty, declared([vocab(1)], 'd1')).state;
  assert.deepEqual(leaving(afterDecl, undone('d1')), []);
});

// ── Comptage ────────────────────────────────────────────────────────────────

test('types qui consomment le budget : grammaire, vocabulaire, kanji, expressions ; pas les kana (O1)', () => {
  assert.deepEqual([...BUDGET_TYPES], ['grammar', 'vocab', 'kanji', 'expression']);
  assert.equal(newContentCount({ introduced: { vocab: 3, kanji: 1, grammar: 1, expression: 2, kana: 5 } }), 7);
  assert.equal(newContentCount(undefined), 0);
  assert.equal(newContentCount({}), 0);
});

test('budgetStatus : utilisé, plafond, restant (jamais négatif)', () => {
  assert.deepEqual(budgetStatus({ introduced: { vocab: 4 } }, 10), { used: 4, limit: 10, remaining: 6 });
  assert.deepEqual(budgetStatus({ introduced: { vocab: 30 } }, 10), { used: 30, limit: 10, remaining: 0 });
  assert.deepEqual(budgetStatus(undefined, 0), { used: 0, limit: 0, remaining: 0 });
  for (const bad of [-1, 2.5, '10', undefined]) assert.throws(() => budgetStatus(undefined, bad), TypeError);
});

// ── À travers recordLearningEvent ───────────────────────────────────────────

async function setup(clockRef = { now: new Date(at(0, 10)) }, store = createMemoryStore(), config) {
  const learning = createLearning({ store, config, now: () => clockRef.now, warn: () => {} });
  await learning.load();
  return { learning, store, clockRef };
}
const LIMIT = DEFAULT_USER_SETTINGS.dailyNewBudget; // 10

// Partie 7 · S10 (cas cité : nouveautés prises dans Pratiquer pendant une session interrompue)
test('S10 (base) : les nouveautés prises hors du mode guidé comptent dans le budget du jour', async () => {
  const { learning } = await setup();
  const guided = { mode: 'guided', source: 'home', activityType: 'lesson' };
  await learning.recordLearningEvent(introduced(vocab(1), at(0, 8), guided, { sessionId: 'ses_1' }));
  await learning.recordLearningEvent(introduced(vocab(2), at(0, 8), guided, { sessionId: 'ses_1' }));
  assert.deepEqual(await learning.getNewContentBudget(LIMIT), { date: '2026-10-01', used: 2, limit: 10, remaining: 8 });
  // Session interrompue ; l'utilisateur découvre 30 mots dans Pratiquer.
  for (let n = 10; n < 40; n++) await learning.recordLearningEvent(answered(vocab(n), n % 2 === 0, at(0, 9)));
  assert.deepEqual(await learning.getNewContentBudget(LIMIT), { date: '2026-10-01', used: 32, limit: 10, remaining: 0 });
});

test('kana, déclarations et test de positionnement ne consomment pas le budget', async () => {
  const { learning, store } = await setup();
  await learning.recordLearningEvent(introduced(KANA));
  await learning.recordLearningEvent(answered({ type: 'kana', id: 'kana_い' }, true));
  await learning.recordLearningEvent(declared([vocab(1), vocab(2), MIZU], 'd1'));
  await learning.recordLearningEvent(answered(vocab(3), true, at(0),
    { mode: 'free', source: 'onboarding', activityType: 'placement' }));
  // Un élément déclaré (Acquis) n'est plus Nouveau : le pratiquer ne consomme rien.
  await learning.recordLearningEvent(answered(vocab(1), false));
  assert.equal((await learning.getNewContentBudget(LIMIT)).used, 0);
  assert.deepEqual((await store.get('daily', '2026-10-01')).introduced, { kana: 2 });
});

test('un élément compte une seule fois, qu\'il soit présenté puis pratiqué, ou envoyé en double', async () => {
  const { learning } = await setup();
  const e = introduced(LESSON);
  await learning.recordLearningEvent(e);
  await learning.recordLearningEvent(e);                       // doublon
  await learning.recordLearningEvent(introduced(LESSON));      // seconde présentation
  await learning.recordLearningEvent(answered(LESSON, true));  // Découvert → En cours
  await learning.recordLearningEvent(graded(LESSON, 2));
  await learning.recordLearningEvent({ ...introduced(EX), at: 'hier' }); // rejeté
  assert.equal((await learning.getNewContentBudget(LIMIT)).used, 1);
});

test('le budget est celui du jour local : il repart de zéro le lendemain', async () => {
  const clockRef = { now: new Date(at(0, 21)) };              // 23 h à Paris, 1er octobre
  const { learning } = await setup(clockRef);
  await learning.recordLearningEvent(introduced(vocab(1), at(0, 21)));
  await learning.recordLearningEvent(introduced(vocab(2), at(0, 22)));   // minuit à Paris : 2 octobre
  assert.deepEqual(await learning.getNewContentBudget(LIMIT), { date: '2026-10-01', used: 1, limit: 10, remaining: 9 });
  // 0 h 30 à Paris le 2 octobre, mais encore le 1er octobre en UTC : c'est le jour local qui compte.
  clockRef.now = new Date(Date.UTC(2026, 9, 1, 22, 30));
  assert.deepEqual(await learning.getNewContentBudget(LIMIT), { date: '2026-10-02', used: 1, limit: 10, remaining: 9 });
  clockRef.now = new Date(at(1, 8));
  assert.deepEqual(await learning.getNewContentBudget(LIMIT), { date: '2026-10-02', used: 1, limit: 10, remaining: 9 });
  clockRef.now = new Date(at(2, 8));
  assert.equal((await learning.getNewContentBudget(LIMIT)).used, 0);
});

test('la compaction du journal ne change pas le budget du jour', async () => {
  const clockRef = { now: new Date(at(40, 10)) };
  const config = { ...GUIDED_CONFIG, journal: { detailDays: 30, maxDetailedEvents: 2 } };
  const { learning } = await setup(clockRef, createMemoryStore(), config);
  for (let n = 1; n <= 6; n++) await learning.recordLearningEvent(introduced(vocab(n), at(40, 8)));
  await learning.recordLearningEvent(introduced(vocab(99), at(2)));
  const before = await learning.getNewContentBudget(LIMIT);
  await learning.compactJournal();
  assert.deepEqual(await learning.getNewContentBudget(LIMIT), before);
  assert.equal(before.used, 6);
});

test('un élément ramené à Nouveau par l\'annulation d\'une déclaration compte s\'il est ensuite présenté', async () => {
  const { learning } = await setup();
  await learning.recordLearningEvent(declared([vocab(1)], 'd1'));
  await learning.recordLearningEvent(undone('d1'));
  assert.equal((await learning.getNewContentBudget(LIMIT)).used, 0);
  await learning.recordLearningEvent(introduced(vocab(1)));
  assert.equal((await learning.getNewContentBudget(LIMIT)).used, 1);
});

test('getNewContentBudget refuse un plafond invalide ; le stockage n\'est pas touché par la lecture', async () => {
  const { learning, store } = await setup();
  await assert.rejects(learning.getNewContentBudget(-3), TypeError);
  assert.deepEqual(await store.getAll('daily'), []);
  assert.equal((await learning.recordLearningEvent(introduced(vocab(1)))).status, RECORD_STATUS.RECORDED);
});
