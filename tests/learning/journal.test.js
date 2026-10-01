// Tests de src/learning/journal.js et de son branchement dans record.js : résumé quotidien,
// compaction (partie 3, 3.8), critère C5 (partie 7).

process.env.TZ = 'Europe/Paris'; // jours locaux de l'appareil

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDailySummary, addToDailySummary, planCompaction } from '../../src/learning/journal.js';
import { localDayKey } from '../../src/learning/dates.js';
import { createLearning, RECORD_STATUS } from '../../src/learning/index.js';
import { createMemoryStore } from '../../src/store/memory.js';
import { GUIDED_CONFIG } from '../../src/config.js';
import { seededRandom } from './replay.js';

const at = (dayOffset, hourUtc = 8) => new Date(Date.UTC(2026, 9, 1 + dayOffset, hourUtc)).toISOString();
let counter = 0;
const W = { type: 'vocab', id: 'n5_v_1' };
const answered = (when, correct, context = { mode: 'free', source: 'practice', activityType: 'quiz', exerciseType: 'qcm' }) => ({
  id: `evt_${++counter}`, type: 'QUESTION_ANSWERED', at: when, context, payload: { questionId: 'q', target: [W], correct }
});
const graded = (when, quality) => ({
  id: `evt_${++counter}`, type: 'REVIEW_GRADED', at: when,
  context: { mode: 'free', source: 'review', activityType: 'srs_review' }, payload: { element: W, quality }
});
const activityDone = (when, seconds) => ({
  id: `evt_${++counter}`, type: 'ACTIVITY_COMPLETED', at: when,
  context: { mode: 'free', source: 'explore', activityType: 'mission' },
  payload: { activityId: 'n5_m_1', activityType: 'mission', durationSeconds: seconds }
});
const sessionEnd = (when, type, minutes) => ({
  id: `evt_${++counter}`, type, at: when, sessionId: 'ses_1', context: { mode: 'guided', source: 'home' },
  payload: type === 'SESSION_COMPLETED' ? { actualMinutes: minutes, completedActivities: [] }
    : { lastActivity: null, actualMinutes: minutes }
});

// ── Jour local ──────────────────────────────────────────────────────────────

test('jour local de l\'appareil : 23 h 30 UTC le 1er octobre est déjà le 2 octobre à Paris', () => {
  assert.equal(localDayKey('2026-10-01T21:59:59Z'), '2026-10-01');
  assert.equal(localDayKey('2026-10-01T22:00:00Z'), '2026-10-02');
  assert.equal(localDayKey('2026-12-31T23:30:00Z'), '2027-01-01');
  assert.throws(() => localDayKey('hier'), TypeError);
});

// ── Résumé quotidien ────────────────────────────────────────────────────────

test('résumé vide d\'un jour', () => {
  assert.deepEqual(emptyDailySummary('2026-10-01'), {
    date: '2026-10-01', answers: {}, reviews: { 0: 0, 1: 0, 2: 0, 3: 0 },
    activitiesCompleted: 0, activitySeconds: 0, sessionMinutes: 0, introduced: {}
  });
});

test('réponses justes et fausses par mode et par type d\'exercice (3.8)', () => {
  let s;
  s = addToDailySummary(s, answered(at(0), true));
  s = addToDailySummary(s, answered(at(0), false));
  s = addToDailySummary(s, answered(at(0), false, { mode: 'guided', source: 'home', activityType: 'lesson', exerciseType: 'cloze' }));
  s = addToDailySummary(s, answered(at(0), true, { mode: 'free', source: 'folder', activityType: 'quiz', folderId: 'fld_1' }));
  assert.deepEqual(s.answers, {
    free: { qcm: { correct: 1, incorrect: 1 }, none: { correct: 1, incorrect: 0 } },
    guided: { cloze: { correct: 0, incorrect: 1 } }
  });
  assert.equal(s.date, '2026-10-01');
});

test('révisions par note, activités terminées, durées des activités et des sessions', () => {
  let s;
  for (const q of [0, 2, 2, 3]) s = addToDailySummary(s, graded(at(0), q));
  s = addToDailySummary(s, activityDone(at(0), 300));
  s = addToDailySummary(s, activityDone(at(0), 120));
  s = addToDailySummary(s, sessionEnd(at(0), 'SESSION_COMPLETED', 13));
  s = addToDailySummary(s, sessionEnd(at(0), 'SESSION_ABANDONED', 4));
  assert.deepEqual(s.reviews, { 0: 1, 1: 0, 2: 2, 3: 1 });
  assert.equal(s.activitiesCompleted, 2);
  assert.equal(s.activitySeconds, 420);
  assert.equal(s.sessionMinutes, 17);
  assert.deepEqual(s.answers, {});
});

test('les autres événements ne figurent pas dans le résumé ; fonction pure', () => {
  const base = Object.freeze(emptyDailySummary('2026-10-01'));
  const intro = { id: 'evt_i', type: 'CONTENT_INTRODUCED', at: at(0),
    context: { mode: 'free', source: 'learn', activityType: 'lesson' }, payload: { element: W } };
  assert.deepEqual(addToDailySummary(base, intro), base);
  const next = addToDailySummary(base, graded(at(0), 2));
  assert.notEqual(next, base);
  assert.equal(base.reviews[2], 0);
});

// ── Plan de compaction ──────────────────────────────────────────────────────

const ev = (id, when) => ({ id, at: when });
const NOW = at(40, 10); // 10 novembre 2026, 11 h à Paris

test('compaction : détail des 30 derniers jours conservé, plus ancien supprimé', () => {
  const events = [ev('a', at(5)), ev('b', at(10)), ev('c', at(11)), ev('d', at(25)), ev('e', at(40, 9))];
  // 30 jours, jour en cours compris : du 12 octobre au 10 novembre.
  assert.equal(localDayKey(at(11)), '2026-10-12');
  assert.deepEqual(planCompaction(events, NOW).sort(), ['a', 'b']);
});

test('compaction : au-delà du plafond, les plus anciens sont supprimés', () => {
  const config = { journal: { detailDays: 30, maxDetailedEvents: 3 } };
  const events = [ev('a', at(35)), ev('b', at(36)), ev('c', at(37)), ev('d', at(38)), ev('e', at(39))];
  assert.deepEqual(planCompaction(events, NOW, config).sort(), ['a', 'b']);
});

// Décision du 2026-10-01
test('compaction : jamais le jour en cours, même au-delà du plafond', () => {
  const config = { journal: { detailDays: 30, maxDetailedEvents: 3 } };
  const today = Array.from({ length: 8 }, (_, i) => ev(`t${i}`, at(40, 1 + i)));
  const events = [ev('old', at(39)), ...today];
  const toDelete = planCompaction(events, NOW, config);
  assert.deepEqual(toDelete, ['old']);
  assert.equal(today.length - toDelete.filter((id) => id.startsWith('t')).length, 8);
});

test('compaction : un événement daté dans le futur est conservé ; journal vide', () => {
  assert.deepEqual(planCompaction([ev('f', at(60))], NOW), []);
  assert.deepEqual(planCompaction([], NOW), []);
  assert.deepEqual({ ...GUIDED_CONFIG.journal }, { detailDays: 30, maxDetailedEvents: 5000 });
});

// ── Branchement dans record.js ──────────────────────────────────────────────

async function setup({ store = createMemoryStore(), clock = () => new Date(at(0)), config } = {}) {
  const warnings = [];
  const learning = createLearning({ store, config, now: clock, warn: (m, d) => warnings.push({ m, d }) });
  await learning.load();
  return { store, learning, warnings };
}

test('le résumé du jour est mis à jour dans la transaction de l\'événement', async () => {
  const { store, learning } = await setup();
  await learning.recordLearningEvent(answered(at(0), false));
  await learning.recordLearningEvent(graded(at(0, 23), 2)); // 23 h UTC : 2 octobre à Paris
  assert.deepEqual((await store.get('daily', '2026-10-01')).answers, { free: { qcm: { correct: 0, incorrect: 1 } } });
  assert.equal((await store.get('daily', '2026-10-02')).reviews[2], 1);
  assert.deepEqual((await learning.getDailySummaries()).map((d) => d.date), ['2026-10-01', '2026-10-02']);
});

test('doublons, événements rejetés et échecs du stockage ne comptent pas dans le résumé', async () => {
  const { store, learning } = await setup();
  const e = answered(at(0), true);
  await learning.recordLearningEvent(e);
  await learning.recordLearningEvent(e);
  await learning.recordLearningEvent({ ...answered(at(0), true), at: 'hier' });
  store.failNextCommit('quota', 3); // écriture, compaction et nouvelle tentative (9.4)
  assert.equal((await learning.recordLearningEvent(answered(at(0), true))).status, RECORD_STATUS.PENDING);
  assert.deepEqual((await store.get('daily', '2026-10-01')).answers.free.qcm, { correct: 1, incorrect: 0 });
});

test('compactJournal : supprime le détail ancien, garde le jour en cours, note la date', async () => {
  let clock = new Date(at(0));
  const { store, learning } = await setup({ clock: () => clock });
  for (const d of [0, 1, 2, 45]) await learning.recordLearningEvent(answered(at(d), true));
  clock = new Date(at(45, 10));
  const { deleted } = await learning.compactJournal();
  assert.equal(deleted, 3);
  assert.deepEqual((await store.getAll('events')).map((e) => e.at), [at(45)]);
  assert.deepEqual(await store.get('meta', 'lastCompaction'), { key: 'lastCompaction', value: clock.toISOString() });
  // Les résumés des jours supprimés restent.
  assert.equal((await learning.getDailySummaries()).length, 4);
});

test('chargement : compaction une fois par jour au plus', async () => {
  let clock = new Date(at(0));
  const store = createMemoryStore();
  const first = await setup({ store, clock: () => clock });
  for (const d of [0, 1]) await first.learning.recordLearningEvent(answered(at(d), true));
  clock = new Date(at(40, 9));
  await setup({ store, clock: () => clock });                 // compacte
  assert.equal((await store.getAll('events')).length, 0);
  const stamp = await store.get('meta', 'lastCompaction');
  await first.learning.recordLearningEvent(answered(at(1), true)); // ancien, ajouté après
  clock = new Date(at(40, 15));
  await setup({ store, clock: () => clock });                 // même jour : pas de compaction
  assert.deepEqual(await store.get('meta', 'lastCompaction'), stamp);
  assert.equal((await store.getAll('events')).length, 1);
});

test('chargement : un échec de compaction est signalé sans empêcher le chargement', async () => {
  const store = createMemoryStore();
  store.failNextCommit('quota');
  const { learning, warnings } = await setup({ store });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].m, /Compaction/);
  assert.equal((await learning.recordLearningEvent(answered(at(0), true))).status, RECORD_STATUS.RECORDED);
});

// ── C5 : purger le journal ne change aucun état ─────────────────────────────

// Partie 7 · C5 ; partie 3 · 3.10, invariant 7
test('C5 : compacter le journal ne change aucun état, ni en mémoire ni au rechargement', async () => {
  const ELEMENTS = [W, { type: 'kanji', id: '水' }, { type: 'grammar', id: 'n5_g_8' }, { type: 'kana', id: 'kana_あ' }];
  for (let seed = 1; seed <= 10; seed++) {
    const rnd = seededRandom(seed);
    const pick = (l) => l[Math.floor(rnd() * l.length)];
    let clock = new Date(at(0));
    const config = { ...GUIDED_CONFIG, journal: { detailDays: 30, maxDetailedEvents: 40 } };
    const { store, learning } = await setup({ clock: () => clock, config });
    let t = Date.UTC(2026, 9, 1, 8);
    const sent = [];
    for (let i = 0; i < 150; i++) {
      t += Math.floor(rnd() * 1.5 * 86400000);
      const when = new Date(t).toISOString();
      const e = rnd() < 0.5
        ? { ...answered(when, rnd() < 0.6), payload: { questionId: 'q', target: [pick(ELEMENTS)], correct: rnd() < 0.6 } }
        : { ...graded(when, Math.floor(rnd() * 4)), payload: { element: pick(ELEMENTS), quality: Math.floor(rnd() * 4) } };
      sent.push(e);
      await learning.recordLearningEvent(e);
    }
    const before = learning.getSnapshot();
    const summariesBefore = await learning.getDailySummaries();
    clock = new Date(t);
    const { deleted } = await learning.compactJournal();
    assert.ok(deleted > 0, `germe ${seed} : la compaction doit avoir supprimé du détail`);
    assert.equal(learning.getSnapshot(), before, 'état en mémoire inchangé');
    const { learning: reloaded } = await setup({ store, clock: () => clock, config });
    assert.deepEqual(reloaded.getSnapshot(), before, 'état rechargé inchangé');
    assert.deepEqual(await learning.getDailySummaries(), summariesBefore, 'résumés inchangés');
    // Les résumés comptent tous les événements, y compris ceux dont le détail est supprimé.
    const total = summariesBefore.reduce((n, d) =>
      n + Object.values(d.reviews).reduce((a, b) => a + b, 0) +
      Object.values(d.answers).flatMap(Object.values).reduce((a, c) => a + c.correct + c.incorrect, 0), 0);
    assert.equal(total, sent.length);
  }
});
