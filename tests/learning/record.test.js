// Tests de src/learning/record.js : recordLearningEvent (partie 3, 3.9 ; partie 9, 9.3 et
// 9.5) ; critères C3 (partie 7) et idempotence, ordre, atomicité.

process.env.TZ = 'Europe/Paris';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLearning, RECORD_STATUS, computeState } from '../../src/learning/index.js';
import { createMemoryStore } from '../../src/store/memory.js';
import { StorageError } from '../../src/store/contract.js';
import { replay, seededRandom } from './replay.js';

// ── Outils ──────────────────────────────────────────────────────────────────

const CATALOG = {
  kana: [{ type: 'kana', id: 'kana_あ' }],
  n5: [{ type: 'vocab', id: 'n5_v_1' }, { type: 'vocab', id: 'n5_v_2' }, { type: 'kanji', id: '水' },
    { type: 'grammar', id: 'n5_g_8' }],
  n4: [], n3: [], n2: [], n1: []
};
const ALL = Object.values(CATALOG).flat();
const elementExists = (ref) => ALL.some((r) => r.type === ref.type && r.id === ref.id);
const elementsOfScope = (level) => CATALOG[level];

async function setup(store = createMemoryStore()) {
  const warnings = [];
  // Horloge fixée : la compaction faite au chargement ne dépend pas du jour où l'on lance les
  // tests.
  const learning = createLearning({ store, elementExists, elementsOfScope,
    warn: (message, detail) => warnings.push({ message, detail }),
    now: () => new Date(Date.UTC(2026, 9, 1, 8)) });
  await learning.load();
  return { store, learning, warnings };
}

let counter = 0;
const day = (n) => new Date(Date.UTC(2026, 9, 1 + n, 8)).toISOString();
const W1 = { type: 'vocab', id: 'n5_v_1' };
const W2 = { type: 'vocab', id: 'n5_v_2' };
const answered = (ref, correct, at = day(0), id = `evt_${++counter}`) => ({
  id, type: 'QUESTION_ANSWERED', at,
  context: { mode: 'free', source: 'practice', activityType: 'quiz', exerciseType: 'qcm' },
  payload: { questionId: 'q1', target: [ref], correct }
});
const graded = (ref, quality, at = day(0)) => ({
  id: `evt_${++counter}`, type: 'REVIEW_GRADED', at,
  context: { mode: 'free', source: 'review', activityType: 'srs_review' },
  payload: { element: ref, quality }
});
const declared = (scope, declarationId, at = day(0)) => ({
  id: `evt_${++counter}`, type: 'KNOWLEDGE_DECLARED', at,
  context: { mode: 'free', source: 'onboarding', activityType: 'declaration' },
  payload: { scope, origin: 'declared', declarationId }
});
const undone = (declarationId, at = day(1)) => ({
  id: `evt_${++counter}`, type: 'KNOWLEDGE_DECLARATION_UNDONE', at,
  context: { mode: 'free', source: 'settings', activityType: 'declaration' },
  payload: { declarationId }
});
const sessionStarted = (at = day(0)) => ({
  id: `evt_${++counter}`, type: 'SESSION_STARTED', at, sessionId: 'ses_1',
  context: { mode: 'guided', source: 'home' },
  payload: { sessionType: 'normal', plannedMinutes: 12, plan: [] }
});

const persisted = async (store, name) => Object.fromEntries((await store.getAll(name)).map((r) => [r.id, r]));

// ── Chargement ──────────────────────────────────────────────────────────────

test('chargement d\'un stockage vide : tout est Nouveau, aucune session', async () => {
  const { learning } = await setup();
  assert.deepEqual(learning.getSnapshot(), { elements: {}, weaknesses: {}, declarations: {}, activities: {} });
  assert.equal(learning.getSession(), null);
});

test('avant load() : lecture et enregistrement refusés', async () => {
  const learning = createLearning({ store: createMemoryStore() });
  assert.throws(() => learning.getSnapshot(), /non chargé/);
  await assert.rejects(learning.recordLearningEvent(answered(W1, true)), /non chargé/);
});

// ── Enregistrement ──────────────────────────────────────────────────────────

test('un événement valide : effets en mémoire, événement et faits persistés, puis notification', async () => {
  const { store, learning } = await setup();
  const notices = [];
  learning.subscribe((n) => notices.push(n));
  const event = answered(W1, false);
  const result = await learning.recordLearningEvent(event);

  assert.equal(result.status, RECORD_STATUS.RECORDED);
  assert.deepEqual(result.changed.elements, ['n5_v_1']);
  assert.equal(computeState(learning.getSnapshot().elements['n5_v_1']), 'learning');
  // À la résolution de la promesse, tout est déjà enregistré (9.3 : attendre la confirmation).
  assert.deepEqual((await store.get('events', event.id)), event);
  assert.deepEqual(await persisted(store, 'elements'), learning.getSnapshot().elements);
  assert.deepEqual(await persisted(store, 'weaknesses'), learning.getSnapshot().weaknesses);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].event, event);
});

// Partie 3 · 3.9 : « un événement invalide est rejeté et signalé en console »
test('un événement invalide est rejeté, signalé, et rien n\'est écrit', async () => {
  const { store, learning, warnings } = await setup();
  const notices = [];
  learning.subscribe((n) => notices.push(n));
  const bad = { ...answered(W1, true), at: 'hier' };
  const result = await learning.recordLearningEvent(bad);
  assert.equal(result.status, RECORD_STATUS.REJECTED);
  assert.ok(result.problems.some((p) => /^at/.test(p)));
  assert.equal(warnings.length, 1);
  assert.deepEqual(await store.getAll('events'), []);
  assert.equal(notices.length, 0);
});

test('un élément inexistant est rejeté (validation avec le contenu)', async () => {
  const { store, learning } = await setup();
  const result = await learning.recordLearningEvent(answered({ type: 'vocab', id: 'n5_v_999' }, true));
  assert.equal(result.status, RECORD_STATUS.REJECTED);
  assert.deepEqual(result.problems, ['élément inexistant : vocab n5_v_999']);
  assert.deepEqual(await store.getAll('elements'), []);
});

test('un événement incompatible avec l\'état est rejeté sans rien écrire', async () => {
  const { store, learning, warnings } = await setup();
  const result = await learning.recordLearningEvent(undone('dcl_inconnue'));
  assert.equal(result.status, RECORD_STATUS.REJECTED);
  assert.match(result.problems[0], /inconnue/);
  assert.equal(warnings.length, 1);
  assert.deepEqual(await store.getAll('events'), []);
});

// ── Idempotence et ordre (9.3) ──────────────────────────────────────────────

test('idempotence : un même événement envoyé deux fois n\'a d\'effet qu\'une fois', async () => {
  const { store, learning } = await setup();
  const event = answered(W1, false);
  const first = await learning.recordLearningEvent(event);
  const second = await learning.recordLearningEvent(structuredClone(event));
  assert.equal(first.status, RECORD_STATUS.RECORDED);
  assert.equal(second.status, RECORD_STATUS.DUPLICATE);
  assert.equal(learning.getSnapshot().weaknesses['n5_v_1'].consecutiveFails, 1);
  assert.equal((await store.getAll('events')).length, 1);
});

test('idempotence : double clic (deux envois simultanés)', async () => {
  const { store, learning } = await setup();
  const event = answered(W1, false);
  const results = await Promise.all([learning.recordLearningEvent(event), learning.recordLearningEvent(event)]);
  assert.deepEqual(results.map((r) => r.status), ['recorded', 'duplicate']);
  assert.equal((await store.get('weaknesses', 'n5_v_1')).consecutiveFails, 1);
});

test('idempotence : vaut aussi après un redémarrage', async () => {
  const { store, learning } = await setup();
  const event = answered(W1, false);
  await learning.recordLearningEvent(event);
  const { learning: again } = await setup(store);
  assert.equal((await again.recordLearningEvent(event)).status, RECORD_STATUS.DUPLICATE);
  assert.equal(again.getSnapshot().weaknesses['n5_v_1'].consecutiveFails, 1);
});

test('idempotence : une déclaration renvoyée est un doublon, pas une erreur', async () => {
  const { learning } = await setup();
  const event = declared('n5', 'dcl_1');
  await learning.recordLearningEvent(event);
  assert.equal((await learning.recordLearningEvent(event)).status, RECORD_STATUS.DUPLICATE);
});

test('ordre : des événements envoyés sans attendre sont traités un par un, dans l\'ordre', async () => {
  const { learning } = await setup();
  const events = [answered(W1, false, day(0)), answered(W1, true, day(0)), answered(W1, false, day(1)),
    graded(W1, 2, day(2)), answered(W2, true, day(2))];
  const notices = [];
  learning.subscribe((n) => notices.push(n.event.id));
  const results = await Promise.all(events.map((e) => learning.recordLearningEvent(e)));
  assert.ok(results.every((r) => r.status === RECORD_STATUS.RECORDED));
  assert.deepEqual(notices, events.map((e) => e.id));
  const expected = replay(events);
  assert.deepEqual(learning.getSnapshot().elements, expected.elements);
  assert.deepEqual(learning.getSnapshot().weaknesses, expected.weaknesses);
});

// La confirmation d'une transaction IndexedDB arrive par un événement ultérieur : on simule un
// stockage qui confirme en retard, une fois l'écriture faite.
function slowCommitStore() {
  const inner = createMemoryStore();
  return {
    ...inner,
    async transaction(names, work) {
      const result = await inner.transaction(names, work);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return result;
    }
  };
}

// Partie 9 · 9.3 : « les événements sont traités un par un […] pour qu'aucun effet n'en
// écrase un autre »
test('file interne : chaque événement part de l\'état laissé par le précédent, même si la confirmation tarde', async () => {
  const { learning } = await setup(slowCommitStore());
  const events = [answered(W1, false, day(0)), answered(W1, false, day(0)), answered(W1, false, day(0))];
  await Promise.all(events.map((e) => learning.recordLearningEvent(e)));
  assert.equal(learning.getSnapshot().weaknesses['n5_v_1'].consecutiveFails, 3, 'aucun effet perdu');
  assert.equal(learning.getSnapshot().weaknesses['n5_v_1'].totalFails, 3);
});

// ── Atomicité et échec du stockage (9.3) ────────────────────────────────────

test('échec du stockage : promesse rejetée, état en mémoire et stockage inchangés, pas de notification', async () => {
  const { store, learning } = await setup();
  await learning.recordLearningEvent(answered(W1, false));
  const snapshot = learning.getSnapshot();
  const before = { events: await store.getAll('events'), elements: await store.getAll('elements') };
  const notices = [];
  learning.subscribe((n) => notices.push(n));

  store.failNextCommit('quota');
  await assert.rejects(learning.recordLearningEvent(graded(W1, 0, day(1)), { session: { step: 2 } }),
    (e) => e instanceof StorageError && e.kind === 'quota');
  assert.equal(learning.getSnapshot(), snapshot);
  assert.equal(learning.getSession(), null);
  assert.deepEqual({ events: await store.getAll('events'), elements: await store.getAll('elements') }, before);
  assert.deepEqual(await store.getAll('sessions'), []);
  assert.equal(notices.length, 0);

  // L'événement suivant passe normalement.
  assert.equal((await learning.recordLearningEvent(graded(W1, 2, day(2)))).status, RECORD_STATUS.RECORDED);
});

test('un même événement peut être renvoyé après un échec du stockage', async () => {
  const { store, learning } = await setup();
  const event = answered(W1, false);
  store.failNextCommit('aborted');
  await assert.rejects(learning.recordLearningEvent(event));
  assert.equal((await learning.recordLearningEvent(event)).status, RECORD_STATUS.RECORDED);
  assert.equal(learning.getSnapshot().weaknesses['n5_v_1'].consecutiveFails, 1);
});

// ── Session dans la même transaction (9.5) ──────────────────────────────────

test('session : enregistrée avec l\'événement, relue au chargement, effacée par null, intacte si absente', async () => {
  const { store, learning } = await setup();
  const plan = { position: 1, blocks: ['review', 'new'] };
  await learning.recordLearningEvent(sessionStarted(day(0)), { session: plan });
  assert.deepEqual(learning.getSession(), plan);
  assert.deepEqual(await store.get('sessions', 'current'), { id: 'current', value: plan });

  await learning.recordLearningEvent(answered(W1, true, day(0)));
  assert.deepEqual(learning.getSession(), plan, 'sans option, la session ne change pas');

  const { learning: reloaded } = await setup(store);
  assert.deepEqual(reloaded.getSession(), plan);

  await learning.recordLearningEvent(answered(W2, true, day(0)), { session: null });
  assert.equal(learning.getSession(), null);
  assert.equal(await store.get('sessions', 'current'), undefined);
});

test('session : un événement rejeté ou en double ne la modifie pas', async () => {
  const { store, learning } = await setup();
  const event = answered(W1, true);
  await learning.recordLearningEvent(event, { session: { position: 1 } });
  await learning.recordLearningEvent(event, { session: { position: 2 } });
  await learning.recordLearningEvent({ ...answered(W1, true), at: 'hier' }, { session: { position: 3 } });
  assert.deepEqual(learning.getSession(), { position: 1 });
  assert.deepEqual((await store.get('sessions', 'current')).value, { position: 1 });
});

// ── Déclarations et suppression d'un fait ───────────────────────────────────

test('annulation : un élément sans faits avant la déclaration est supprimé du stockage', async () => {
  const { store, learning } = await setup();
  await learning.recordLearningEvent(declared('n5', 'dcl_1', day(0)));
  assert.equal((await store.getAll('elements')).length, 5);
  await learning.recordLearningEvent(undone('dcl_1', day(1)));
  assert.deepEqual(await store.getAll('elements'), []);
  assert.deepEqual(learning.getSnapshot().elements, {});
  assert.equal((await store.get('declarations', 'dcl_1')).undoneAt, day(1));
});

// ── Instantané ──────────────────────────────────────────────────────────────

test('l\'instantané est gelé : un écran ne peut pas modifier l\'état', async () => {
  const { learning } = await setup();
  await learning.recordLearningEvent(answered(W1, false), { session: { position: 1 } });
  const snap = learning.getSnapshot();
  assert.ok(Object.isFrozen(snap) && Object.isFrozen(snap.elements) && Object.isFrozen(snap.elements['n5_v_1'].srs));
  assert.throws(() => { 'use strict'; snap.elements['n5_v_1'].srs.interval = 99; }, TypeError);
  assert.ok(Object.isFrozen(learning.getSession()));
});

test('un abonné qui lève une erreur n\'empêche ni l\'enregistrement ni les autres abonnés', async () => {
  const { learning, warnings } = await setup();
  const seen = [];
  learning.subscribe(() => { throw new Error('écran cassé'); });
  learning.subscribe((n) => seen.push(n.event.id));
  const unsubscribe = learning.subscribe(() => seen.push('désabonné'));
  unsubscribe();
  const event = answered(W1, true);
  assert.equal((await learning.recordLearningEvent(event)).status, RECORD_STATUS.RECORDED);
  assert.deepEqual(seen, [event.id]);
  assert.equal(warnings.length, 1);
});

// ── C3 : l'état recalculé depuis les faits persistés est celui affiché ──────

function randomEvents(seed, length) {
  const rnd = seededRandom(seed);
  const pick = (l) => l[Math.floor(rnd() * l.length)];
  const out = [];
  const decls = [];
  let t = Date.UTC(2026, 9, 1, 8);
  for (let i = 0; i < length; i++) {
    t += Math.floor(rnd() * 3 * 86400000);
    const at = new Date(t).toISOString();
    const r = rnd();
    if (r < 0.35) out.push(answered(pick(ALL), rnd() < 0.6, at));
    else if (r < 0.8) out.push(graded(pick(ALL), Math.floor(rnd() * 4), at));
    else if (r < 0.9) { const id = `dcl_${seed}_${i}`; decls.push(id); out.push(declared(pick(['kana', 'n5']), id, at)); }
    else if (decls.length) out.push(undone(pick(decls), at));
  }
  return out;
}

// Partie 7 · C3
test('C3 : après rechargement, l\'état recalculé depuis le stockage est identique à celui affiché', async () => {
  for (let seed = 1; seed <= 15; seed++) {
    const { store, learning } = await setup();
    const events = randomEvents(seed, 80);
    for (const e of events) await learning.recordLearningEvent(e);
    // Quelques doublons et événements invalides au milieu : sans effet.
    await learning.recordLearningEvent(events[0]);
    await learning.recordLearningEvent({ ...events[1], id: 'evt_x', at: 'hier' });

    const shown = learning.getSnapshot();
    const { learning: reloaded } = await setup(store);
    const fromStore = reloaded.getSnapshot();
    assert.deepEqual(fromStore, shown, `germe ${seed}`);
    for (const ref of ALL) {
      assert.equal(computeState(fromStore.elements[ref.id]), computeState(shown.elements[ref.id]));
    }
    // Et identique au rejeu pur des mêmes événements.
    const expected = replay(events, { deps: { elementsOfScope } });
    assert.deepEqual(JSON.parse(JSON.stringify(shown)), JSON.parse(JSON.stringify(expected)), `germe ${seed}`);
  }
});
