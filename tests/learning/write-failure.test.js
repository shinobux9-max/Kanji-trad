// Tests de l'échec d'écriture (partie 9, 9.4 ; lacune L4 de la partie 6) : compaction puis une
// seule nouvelle tentative, file volatile, échec visible, « Réessayer », ordre des événements.

process.env.TZ = 'Europe/Paris';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLearning, RECORD_STATUS } from '../../src/learning/index.js';
import { createMemoryStore } from '../../src/store/memory.js';
import { replay } from './replay.js';

const at = (d, h = 8) => new Date(Date.UTC(2026, 9, 1 + d, h)).toISOString();
let counter = 0;
const W1 = { type: 'vocab', id: 'n5_v_1' };
const W2 = { type: 'vocab', id: 'n5_v_2' };
const answered = (ref, correct, when = at(0)) => ({ id: `evt_${++counter}`, type: 'QUESTION_ANSWERED', at: when,
  context: { mode: 'free', source: 'practice', activityType: 'quiz' }, payload: { questionId: 'q', target: [ref], correct } });
const undone = (declarationId) => ({ id: `evt_${++counter}`, type: 'KNOWLEDGE_DECLARATION_UNDONE', at: at(0),
  context: { mode: 'free', source: 'fiche', activityType: 'declaration' }, payload: { declarationId } });

async function setup({ store = createMemoryStore(), clock = new Date(at(0, 10)) } = {}) {
  const warnings = [];
  const learning = createLearning({ store, now: () => clock, warn: (m, d) => warnings.push({ m, d }) });
  await learning.load();
  const failures = [];
  learning.onWriteFailureChange((f) => failures.push(f));
  const notices = [];
  learning.subscribe((n) => notices.push(n.event.id));
  return { store, learning, warnings, failures, notices };
}
const ids = async (store) => (await store.getAll('events')).map((e) => e.id).sort();

// ── Étapes 2 et 3 : compaction, puis une seule nouvelle tentative ──────────

test('un échec suivi d\'une nouvelle tentative réussie : rien n\'est montré, l\'événement est enregistré', async () => {
  const { store, learning, failures } = await setup();
  store.failNextCommit('quota');
  const e = answered(W1, false);
  assert.equal((await learning.recordLearningEvent(e)).status, RECORD_STATUS.RECORDED);
  assert.deepEqual(await ids(store), [e.id]);
  assert.equal(learning.getWriteFailure(), null);
  assert.deepEqual(failures, []);
});

test('la compaction a lieu avant la nouvelle tentative et libère de la place', async () => {
  const store = createMemoryStore();
  const old = await setup({ store, clock: new Date(at(0, 10)) });
  for (let d = 0; d < 3; d++) await old.learning.recordLearningEvent(answered(W2, true, at(d)));
  // Quarante jours plus tard, même stockage déjà compacté aujourd'hui, puis une écriture qui échoue.
  const { learning } = await setup({ store, clock: new Date(at(40, 10)) });
  await store.transaction(['events'], async (tx) => { for (let d = 0; d < 3; d++) await tx.put('events', { id: `evt_vieux_${d}`, at: at(d) }); });
  store.failNextCommit('quota');
  const e = answered(W1, true, at(40));
  assert.equal((await learning.recordLearningEvent(e)).status, RECORD_STATUS.RECORDED);
  assert.deepEqual(await ids(store), [e.id], 'le détail ancien a été supprimé par la compaction');
});

test('une seule nouvelle tentative : écriture, compaction, nouvelle tentative, puis attente', async () => {
  const { store, learning } = await setup();
  const inner = store.transaction;
  const scopes = [];
  store.transaction = (names, work) => { scopes.push(names.includes('elements') ? 'écriture' : 'compaction'); return inner(names, work); };
  store.setUnavailable(true);
  assert.equal((await learning.recordLearningEvent(answered(W1, false))).status, RECORD_STATUS.PENDING);
  assert.deepEqual(scopes, ['écriture', 'compaction', 'écriture']);
  // Pendant l'échec, un nouvel événement n'est même pas tenté : il attend derrière.
  await learning.recordLearningEvent(answered(W2, false));
  assert.equal(scopes.length, 3);
  store.transaction = inner;
});

// ── Étapes 4 et 5 : file volatile, échec visible, pas de divergence ────────

test('échec persistant : événement en attente, échec visible, état affiché et stockage inchangés', async () => {
  const { store, learning, failures, notices } = await setup();
  await learning.recordLearningEvent(answered(W1, true));
  const snapshot = learning.getSnapshot();
  const stored = await ids(store);

  store.failNextCommit('quota', 3);
  const e = answered(W1, false, at(0, 9));
  const result = await learning.recordLearningEvent(e);
  assert.equal(result.status, RECORD_STATUS.PENDING);
  assert.deepEqual({ ...learning.getWriteFailure() },
    { since: at(0, 10), kind: 'quota', message: 'échec simulé de l\'écriture (quota)', pendingCount: 1 });
  assert.deepEqual(failures.map((f) => f.pendingCount), [1]);
  assert.equal(learning.getSnapshot(), snapshot, 'l\'état affiché ne contient pas l\'événement non enregistré');
  assert.deepEqual(await ids(store), stored);
  assert.equal(notices.length, 1, 'aucune notification pour un événement non enregistré');
});

test('pendant l\'échec, les événements suivants attendent derrière, dans l\'ordre, sans être écrits', async () => {
  const { store, learning, failures } = await setup();
  store.failNextCommit('quota', 3);
  const events = [answered(W1, false), answered(W2, true), answered(W1, true)];
  await learning.recordLearningEvent(events[0]);
  // Le stockage refonctionne, mais rien ne doit passer devant l'événement en attente.
  for (const e of events.slice(1)) {
    assert.equal((await learning.recordLearningEvent(e)).status, RECORD_STATUS.PENDING);
  }
  assert.deepEqual(await ids(store), []);
  assert.equal(learning.getWriteFailure().pendingCount, 3);
  assert.deepEqual(failures.map((f) => f.pendingCount), [1, 2, 3]);
});

test('pendant l\'échec, un événement invalide est toujours rejeté, pas mis en attente', async () => {
  const { store, learning } = await setup();
  store.failNextCommit('quota', 3);
  await learning.recordLearningEvent(answered(W1, false));
  const result = await learning.recordLearningEvent({ ...answered(W1, true), at: 'hier' });
  assert.equal(result.status, RECORD_STATUS.REJECTED);
  assert.equal(learning.getWriteFailure().pendingCount, 1);
});

// ── Étape 6 : « Réessayer » ─────────────────────────────────────────────────

test('Réessayer : la file est enregistrée dans l\'ordre, l\'échec disparaît, l\'état rejoint le rejeu', async () => {
  const { store, learning, failures, notices } = await setup();
  const events = [answered(W1, false, at(0, 8)), answered(W2, true, at(0, 9)), answered(W1, true, at(0, 9))];
  store.failNextCommit('aborted', 3);
  for (const e of events) await learning.recordLearningEvent(e);

  const result = await learning.retry();
  assert.deepEqual(result, { status: 'recovered', recorded: 3, remaining: 0 });
  assert.equal(learning.getWriteFailure(), null);
  assert.equal(failures.at(-1), null);
  assert.deepEqual(notices, events.map((e) => e.id), 'notifications dans l\'ordre d\'émission');
  assert.deepEqual(await ids(store), events.map((e) => e.id).sort());
  const expected = replay(events);
  assert.deepEqual(learning.getSnapshot().elements, expected.elements);
  assert.deepEqual(learning.getSnapshot().weaknesses, expected.weaknesses);
  // Les événements suivants passent directement.
  assert.equal((await learning.recordLearningEvent(answered(W2, false))).status, RECORD_STATUS.RECORDED);
});

test('Réessayer qui échoue encore : rien n\'est perdu, la date de début de l\'échec est conservée', async () => {
  const clock = new Date(at(0, 10));
  const { store, learning } = await setup({ clock });
  store.failNextCommit('quota', 3);
  await learning.recordLearningEvent(answered(W1, false));
  await learning.recordLearningEvent(answered(W2, false));
  const since = learning.getWriteFailure().since;
  assert.equal(since, at(0, 10));
  clock.setTime(Date.parse(at(0, 12))); // deux heures plus tard
  store.setUnavailable(true);
  assert.deepEqual(await learning.retry(), { status: 'still_failing', recorded: 0, remaining: 2 });
  assert.equal(learning.getWriteFailure().kind, 'unavailable');
  assert.equal(learning.getWriteFailure().since, since);
  store.setUnavailable(false);
  assert.deepEqual(await learning.retry(), { status: 'recovered', recorded: 2, remaining: 0 });
});

test('Réessayer partiel : les premiers passent, le reste attend, l\'ordre est conservé', async () => {
  const { store, learning, notices } = await setup();
  const events = [answered(W1, false), answered(W2, false), answered(W1, true)];
  store.failNextCommit('quota', 3);
  for (const e of events) await learning.recordLearningEvent(e);
  // Le 1er passe, le 2e échoue.
  const inner = store.transaction;
  let calls = 0;
  store.transaction = (names, work) => (++calls === 2 ? (store.failNextCommit('quota'), inner(names, work)) : inner(names, work));
  assert.deepEqual(await learning.retry(), { status: 'still_failing', recorded: 1, remaining: 2 });
  store.transaction = inner;
  assert.deepEqual(notices, [events[0].id]);
  assert.deepEqual(await learning.retry(), { status: 'recovered', recorded: 2, remaining: 0 });
  assert.deepEqual(notices, events.map((e) => e.id));
});

test('Réessayer sans échec en cours : sans effet', async () => {
  const { learning } = await setup();
  assert.deepEqual(await learning.retry(), { status: 'ok', recorded: 0, remaining: 0 });
});

test('idempotence : un événement renvoyé pendant l\'échec n\'a d\'effet qu\'une fois après Réessayer', async () => {
  const { store, learning } = await setup();
  const e = answered(W1, false);
  store.failNextCommit('quota', 3);
  await learning.recordLearningEvent(e);
  await learning.recordLearningEvent(e); // double clic, ou nouvelle tentative de l'écran
  assert.deepEqual(await learning.retry(), { status: 'recovered', recorded: 1, remaining: 0 });
  assert.equal(learning.getSnapshot().weaknesses['n5_v_1'].consecutiveFails, 1);
  assert.equal((await store.getAll('events')).length, 1);
});

test('un événement en attente incompatible avec l\'état est écarté à Réessayer, les autres passent', async () => {
  const { store, learning, warnings } = await setup();
  store.failNextCommit('quota', 3);
  await learning.recordLearningEvent(answered(W1, false));
  await learning.recordLearningEvent(undone('dcl_inconnue')); // valide, mais rien à annuler
  await learning.recordLearningEvent(answered(W2, true));
  assert.deepEqual(await learning.retry(), { status: 'recovered', recorded: 2, remaining: 0 });
  assert.ok(warnings.some((w) => /rejeté/.test(w.m)));
  assert.equal((await store.getAll('events')).length, 2);
});

test('la session fournie avec un événement en attente est enregistrée avec lui à Réessayer', async () => {
  const { store, learning } = await setup();
  store.failNextCommit('quota', 3);
  await learning.recordLearningEvent(answered(W1, true), { session: { position: 4 } });
  assert.equal(learning.getSession(), null);
  await learning.retry();
  assert.deepEqual(learning.getSession(), { position: 4 });
  assert.deepEqual((await store.get('sessions', 'current')).value, { position: 4 });
});

test('un événement émis pendant Réessayer est enregistré après la file', async () => {
  const { store, learning, notices } = await setup();
  const first = answered(W1, false);
  store.failNextCommit('quota', 3);
  await learning.recordLearningEvent(first);
  const later = answered(W1, true);
  const [retried, recorded] = await Promise.all([learning.retry(), learning.recordLearningEvent(later)]);
  assert.equal(retried.status, 'recovered');
  assert.equal(recorded.status, RECORD_STATUS.RECORDED);
  assert.deepEqual(notices, [first.id, later.id]);
});

// ── La file ne survit pas à un redémarrage ──────────────────────────────────

test('la file est volatile : après redémarrage, seul ce qui a été confirmé existe', async () => {
  const { store, learning } = await setup();
  const confirmed = answered(W1, true);
  await learning.recordLearningEvent(confirmed);
  store.failNextCommit('quota', 3);
  await learning.recordLearningEvent(answered(W2, false));
  const { learning: restarted } = await setup({ store });
  assert.equal(restarted.getWriteFailure(), null);
  assert.deepEqual(await ids(store), [confirmed.id]);
  assert.deepEqual(Object.keys(restarted.getSnapshot().elements), ['n5_v_1']);
});

// ── Erreurs qui ne viennent pas du stockage ─────────────────────────────────

test('une erreur qui n\'est pas une panne du stockage n\'est pas mise en attente', async () => {
  const store = createMemoryStore();
  const { learning } = await setup({ store });
  const inner = store.transaction;
  let calls = 0;
  store.transaction = () => { calls++; return Promise.reject(new Error('défaut de programmation')); };
  await assert.rejects(learning.recordLearningEvent(answered(W1, true)), /défaut de programmation/);
  store.transaction = inner;
  assert.equal(calls, 1, 'ni compaction ni nouvelle tentative pour une erreur hors stockage');
  assert.equal(learning.getWriteFailure(), null);
});
