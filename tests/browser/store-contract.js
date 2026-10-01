// Ocha v2 — Tests du stockage IndexedDB dans le navigateur (partie 9, 9.8 ; tâche 12).
//
// Joue la suite de contrat commune contre openIndexedDbStore, puis des vérifications propres
// à IndexedDB et un C3 de bout en bout avec learning. Résultats affichés dans la page et
// exposés dans window.__results (pour un lancement automatisé).

import { STORE_CONTRACT_CASES } from '../store/contract-cases.js';
import { openIndexedDbStore } from '../../src/store/indexeddb.js';
import { createLearning, computeState } from '../../src/learning/index.js';

let n = 0;
const deleteDatabase = (name) => new Promise((resolve) => {
  const req = indexedDB.deleteDatabase(name);
  req.onsuccess = req.onerror = req.onblocked = () => resolve();
});

async function withDatabase(fn) {
  const name = `ocha-test-${Date.now()}-${++n}`;
  const opened = [];
  const open = async () => { const s = await openIndexedDbStore({ name }); opened.push(s); return s; };
  try {
    await fn(open);
  } finally {
    for (const s of opened) s.close();
    await deleteDatabase(name);
  }
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const EXTRA_CASES = [
  {
    name: 'IndexedDB : les données survivent à la fermeture et à la réouverture ; meta n\'est pas recréé',
    run: () => withDatabase(async (open) => {
      const first = await open();
      const { value: installationId } = await first.get('meta', 'installationId');
      await first.transaction(['elements', 'events'], async (tx) => {
        await tx.put('elements', { id: '水', srs: { interval: 8 } });
        await tx.put('events', { id: 'evt_1', at: '2026-10-01T08:00:00.000Z' });
      });
      first.close();
      const second = await open();
      check((await second.get('elements', '水')).srs.interval === 8, 'élément perdu');
      check((await second.getAllByIndex('events', 'at')).length === 1, 'événement perdu');
      check((await second.get('meta', 'installationId')).value === installationId, 'identifiant d\'installation changé');
      check((await second.getAll('meta')).length === 2, 'meta recréé');
    })
  },
  {
    name: 'IndexedDB : une transaction annulée ne laisse rien après réouverture',
    run: () => withDatabase(async (open) => {
      const first = await open();
      let failed = false;
      try {
        await first.transaction(['elements', 'weaknesses'], async (tx) => {
          await tx.put('elements', { id: 'n5_v_1' });
          await tx.put('weaknesses', { id: 'n5_v_1', consecutiveFails: 1 });
          throw new Error('boom');
        });
      } catch { failed = true; }
      check(failed, 'la transaction aurait dû échouer');
      first.close();
      const second = await open();
      check((await second.getAll('elements')).length === 0, 'élément écrit malgré l\'annulation');
      check((await second.getAll('weaknesses')).length === 0, 'faiblesse écrite malgré l\'annulation');
    })
  },
  {
    // Partie 7 · C3, sur la vraie IndexedDB
    name: 'C3 sur IndexedDB : learning recharge exactement l\'état qu\'il affichait',
    run: () => withDatabase(async (open) => {
      const now = () => new Date('2026-10-01T10:00:00.000Z');
      const learning = createLearning({ store: await open(), now, warn: () => {} });
      await learning.load();
      const W = { type: 'vocab', id: 'n5_v_1' };
      let i = 0;
      const ev = (type, payload, context) => ({ id: `evt_${++i}`, type, at: `2026-10-01T08:00:${String(i).padStart(2, '0')}.000Z`, context, payload });
      const quiz = { mode: 'free', source: 'practice', activityType: 'quiz' };
      const review = { mode: 'free', source: 'review', activityType: 'srs_review' };
      const events = [
        ev('CONTENT_INTRODUCED', { element: W }, { mode: 'free', source: 'learn', activityType: 'lesson' }),
        ev('QUESTION_ANSWERED', { questionId: 'q', target: [W], correct: false }, quiz),
        ev('REVIEW_GRADED', { element: W, quality: 2 }, review),
        ev('KNOWLEDGE_DECLARED', { elements: [{ type: 'kanji', id: '水' }], origin: 'declared', declarationId: 'dcl_1' },
          { mode: 'free', source: 'fiche', activityType: 'declaration' })
      ];
      for (const e of events) {
        const r = await learning.recordLearningEvent(e, { session: { position: i } });
        check(r.status === 'recorded', `${e.type} : ${r.status}`);
      }
      check((await learning.recordLearningEvent(events[1])).status === 'duplicate', 'doublon non détecté');
      const shown = learning.getSnapshot();
      const reloaded = createLearning({ store: await open(), now, warn: () => {} });
      await reloaded.load();
      check(JSON.stringify(reloaded.getSnapshot()) === JSON.stringify(shown), 'état rechargé différent');
      check(computeState(reloaded.getSnapshot().elements['水']) === 'acquired', 'déclaration perdue');
      check(reloaded.getSession().position === 4, 'session perdue');
      check((await reloaded.getNewContentBudget(10)).used === 1, 'budget du jour faux');
    })
  }
];

async function main() {
  const list = document.getElementById('results');
  const results = [];
  const cases = [
    ...STORE_CONTRACT_CASES.filter((c) => c.needs !== 'failures').map((c) => ({
      name: c.name,
      run: () => withDatabase(async (open) => c.run({ store: await open(), canFail: false }))
    })),
    ...EXTRA_CASES
  ];
  for (const c of cases) {
    const li = document.createElement('li');
    try {
      await c.run();
      li.className = 'ok';
      li.textContent = c.name;
      results.push({ name: c.name, ok: true });
    } catch (error) {
      li.className = 'ko';
      li.textContent = `${c.name}\n${error && error.message}`;
      results.push({ name: c.name, ok: false, error: String(error && error.message) });
    }
    list.append(li);
  }
  const failed = results.filter((r) => !r.ok).length;
  const skipped = STORE_CONTRACT_CASES.filter((c) => c.needs === 'failures').length;
  document.getElementById('summary').textContent =
    `${results.length - failed} / ${results.length} réussis` +
    (failed ? ` — ${failed} ÉCHEC(S)` : '') +
    ` (${skipped} cas de pannes simulées non applicables à IndexedDB)`;
  window.__results = { results, failed, skipped };
}

main();
