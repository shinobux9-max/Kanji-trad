// Tests de src/learning/effects.js, deuxième partie : KNOWLEDGE_DECLARED et son annulation
// (partie 1, 1.3 et 1.5 ; partie 3, 3.4), avancement des activités (3.7) ; critères S6 et S7
// sur des journaux contenant des déclarations.

process.env.TZ = 'Europe/Paris';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEvent, createEmptyLearningState, declarationDelayDays, DECLARATION_SCOPE_ORDER, ORIGINS
} from '../../src/learning/effects.js';
import { validateEvent } from '../../src/learning/events.js';
import { computeState, checkElementFacts, computeActivityStatus, STATE_ORDER } from '../../src/learning/state.js';
import { GUIDED_CONFIG } from '../../src/config.js';
import { replay, seededRandom } from './replay.js';

// ── Faux catalogue et fabrique d'événements ─────────────────────────────────

const CATALOG = {
  kana: ['kana_あ', 'kana_い'].map((id) => ({ type: 'kana', id })),
  n5: [{ type: 'vocab', id: 'n5_v_1' }, { type: 'vocab', id: 'n5_v_2' }, { type: 'grammar', id: 'n5_g_1' },
    { type: 'kanji', id: '水' }],
  n4: [{ type: 'vocab', id: 'n4_v_1' }, { type: 'kanji', id: '働' }],
  n3: [], n2: [], n1: []
};
const deps = { elementsOfScope: (level) => CATALOG[level] };

let counter = 0;
const day = (n) => new Date(Date.UTC(2026, 9, 1 + n, 8)).toISOString();
const ev = (type, at, payload, context, extra = {}) => {
  const e = { id: `evt_${++counter}`, type, at, context, payload, ...extra };
  assert.deepEqual(validateEvent(e), [], JSON.stringify(e));
  return e;
};
const DECL = { mode: 'free', source: 'onboarding', activityType: 'declaration' };
const declareScope = (scope, id, at = day(0), origin = 'declared') =>
  ev('KNOWLEDGE_DECLARED', at, { scope, origin, declarationId: id }, DECL);
const declareElements = (refs, id, at = day(0), origin = 'declared') =>
  ev('KNOWLEDGE_DECLARED', at, { elements: refs, origin, declarationId: id }, { ...DECL, source: 'fiche' });
const undo = (id, at = day(1)) =>
  ev('KNOWLEDGE_DECLARATION_UNDONE', at, { declarationId: id }, { ...DECL, source: 'fiche' });
const answered = (ref, correct, at) => ev('QUESTION_ANSWERED', at, { questionId: 'q', target: [ref], correct },
  { mode: 'free', source: 'practice', activityType: 'quiz' });
const graded = (ref, quality, at) => ev('REVIEW_GRADED', at, { element: ref, quality },
  { mode: 'free', source: 'review', activityType: 'srs_review' });
const introduced = (ref, at) => ev('CONTENT_INTRODUCED', at, { element: ref },
  { mode: 'free', source: 'learn', activityType: 'lesson' });

const W1 = { type: 'vocab', id: 'n5_v_1' };
const W2 = { type: 'vocab', id: 'n5_v_2' };
const st = (s, id) => computeState(s.elements[id]);
const run = (events, initial) => replay(events, { deps, initial });

// ── Délai de vérification ───────────────────────────────────────────────────

test('délai de vérification : entre 21 et 45 jours, réparti sans pic pour une déclaration (1.3)', () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `n5_v_${i}`);
  const delays = ids.map((id) => declarationDelayDays(id, day(0)));
  assert.ok(delays.every((d) => d >= 21 && d <= 45 && Number.isInteger(d)));
  assert.equal(new Set(delays).size, 25, 'toute la fenêtre est utilisée');
  // Répartition : aucun jour ne reçoit plus du double de la moyenne (pas de pic).
  const counts = {};
  delays.forEach((d) => { counts[d] = (counts[d] || 0) + 1; });
  assert.ok(Math.max(...Object.values(counts)) < 2 * (2000 / 25));
  assert.equal(declarationDelayDays('水', day(0), { declaredVerificationWindowDays: { min: 30, max: 30 } }), 30);
});

test('délai de vérification : même élément et même déclaration → même délai, à chaque calcul (1.3)', () => {
  const ids = Array.from({ length: 200 }, (_, i) => `n5_v_${i}`);
  for (const at of [day(0), day(7), new Date(day(7))]) {
    assert.deepEqual(ids.map((id) => declarationDelayDays(id, at)), ids.map((id) => declarationDelayDays(id, at)));
  }
  assert.equal(declarationDelayDays('水', day(7)), declarationDelayDays('水', new Date(day(7))));
  // Même élément, même date de déclaration : même entrée SRS dans deux journaux distincts.
  const a = run([declareElements([W1], 'dcl_a', day(3))]);
  const b = run([declareElements([W1], 'dcl_b', day(3))]);
  assert.deepEqual(a.elements['n5_v_1'], b.elements['n5_v_1']);
});

test('délai de vérification : la date de déclaration participe à la répartition (1.3)', () => {
  // Deux dates peuvent donner le même délai (25 valeurs possibles) : on vérifie seulement que,
  // sur de nombreuses dates, un même élément ne tombe pas toujours au même délai.
  const delays = Array.from({ length: 60 }, (_, i) => declarationDelayDays('n5_v_1', day(i)));
  assert.ok(new Set(delays).size > 1);
  assert.ok(delays.every((d) => d >= 21 && d <= 45));
  assert.throws(() => declarationDelayDays('n5_v_1', 'hier'), TypeError);
});

// ── KNOWLEDGE_DECLARED ──────────────────────────────────────────────────────

test('déclaration : Nouveau, Découvert et En cours → Acquis, origine declared, non vérifié (3.4)', () => {
  const s = run([introduced(W2, day(0)), answered({ type: 'grammar', id: 'n5_g_1' }, false, day(0)),
    declareScope('n5', 'dcl_1', day(2))]);
  for (const id of ['n5_v_1', 'n5_v_2', 'n5_g_1', '水']) {
    assert.equal(st(s, id), 'acquired', id);
    assert.equal(s.elements[id].origin, ORIGINS.DECLARED);
    assert.equal(s.elements[id].verified, false);
  }
  assert.equal(s.elements['n5_v_2'].introducedAt, day(0), 'date d\'introduction conservée');
  assert.equal(s.elements['n5_v_1'].introducedAt, day(2), 'date d\'introduction posée si absente');
});

test('entrée SRS de déclaration : délai, 3 répétitions, facilité 2,5, sans dernière révision (décision)', () => {
  const s = run([declareElements([W1], 'dcl_1', day(0))]);
  const delay = declarationDelayDays('n5_v_1', day(0));
  assert.deepEqual(s.elements['n5_v_1'].srs, {
    interval: delay, easeFactor: 2.5, repetitions: 3, lastReviewDate: null,
    // 10 h à Paris ; à partir du 25 octobre (heure d'hiver), 10 h = 09:00 UTC.
    nextReviewDate: new Date(Date.UTC(2026, 9, 1 + delay, delay >= 24 ? 9 : 8)).toISOString()
  });
  assert.deepEqual(checkElementFacts(s.elements['n5_v_1']), []);
});

test('échéance de déclaration le jour du passage à l\'heure d\'hiver : même heure locale', () => {
  // Un élément dont le délai, pour une déclaration du 1er octobre, tombe le 25 octobre :
  // 10 h à Paris = 09:00 UTC ce jour-là.
  let id;
  for (let i = 0; !id; i++) if (declarationDelayDays(`n5_v_${i}`, day(0)) === 24) id = `n5_v_${i}`;
  const s = run([declareElements([{ type: 'vocab', id }], 'd', day(0))]);
  assert.equal(s.elements[id].srs.nextReviewDate, '2026-10-25T09:00:00.000Z');
});

test('une déclaration ne fait jamais reculer : Acquis et Maîtrisé ne sont pas touchés (1.5)', () => {
  let s = run([answered(W1, true, day(0))]);
  for (let i = 1; i <= 6; i++) s = run([graded(W1, 2, day(i))], s);
  assert.equal(st(s, 'n5_v_1'), 'mastered');
  const before = s.elements['n5_v_1'];
  s = run([declareScope('n5', 'dcl_1', day(10))], s);
  assert.equal(s.elements['n5_v_1'], before);
  assert.equal(s.elements['n5_v_1'].origin, ORIGINS.LEARNED);
  assert.equal(Object.hasOwn(s.declarations.dcl_1.previous, 'n5_v_1'), false);
});

test('niveau déclaré : il inclut tous les niveaux inférieurs, kana compris (1.5)', () => {
  assert.deepEqual([...DECLARATION_SCOPE_ORDER], ['kana', 'n5', 'n4', 'n3', 'n2', 'n1']);
  const ids = (s) => Object.keys(s.elements).sort();
  assert.deepEqual(ids(run([declareScope('kana', 'd')])), ['kana_あ', 'kana_い']);
  assert.deepEqual(ids(run([declareScope('n5', 'd')])), ['kana_あ', 'kana_い', 'n5_g_1', 'n5_v_1', 'n5_v_2', '水']);
  assert.deepEqual(ids(run([declareScope('n4', 'd')])),
    ['kana_あ', 'kana_い', 'n4_v_1', 'n5_g_1', 'n5_v_1', 'n5_v_2', '働', '水']);
});

test('un niveau sans contenu est enregistré, sans autre effet (1.5)', () => {
  // N3 n'ajoute rien à ce que déclarent déjà kana, N5 et N4 ; le niveau choisi est conservé.
  const withLower = run([declareScope('n3', 'd_n3')]);
  assert.deepEqual(Object.keys(withLower.elements).sort(), Object.keys(run([declareScope('n4', 'd')]).elements).sort());
  assert.equal(withLower.declarations.d_n3.scope, 'n3');
  // Sans aucun contenu : aucun élément touché, mais la déclaration est enregistrée.
  const empty = replay([declareScope('n3', 'd2')], { deps: { elementsOfScope: () => [] } });
  assert.deepEqual(empty.elements, {});
  assert.equal(empty.declarations.d2.scope, 'n3');
  assert.deepEqual(empty.declarations.d2.previous, {});
});

test('test de positionnement : origine tested ; les éléments non validés ne changent pas (1.5)', () => {
  const s = run([declareElements([W1, { type: 'kana', id: 'kana_あ' }], 'dcl_test', day(0), 'tested')]);
  assert.equal(s.elements['n5_v_1'].origin, ORIGINS.TESTED);
  assert.equal(st(s, 'kana_あ'), 'acquired');
  assert.equal(st(s, 'kana_い'), 'new');
});

test('trace de la déclaration : faits précédents des seuls éléments modifiés', () => {
  const s = run([introduced(W2, day(0)), declareElements([W1, W2], 'dcl_1', day(1))]);
  assert.deepEqual(s.declarations.dcl_1, {
    id: 'dcl_1', at: day(1), origin: 'declared', elements: [W1, W2],
    previous: { n5_v_1: null, n5_v_2: { id: 'n5_v_2', introducedAt: day(0) } },
    undoneAt: null
  });
});

test('déclaration : faiblesses inchangées ; changed liste éléments et déclaration', () => {
  const start = run([answered(W1, false, day(0))]);
  const { state, changed } = applyEvent(start, declareElements([W1], 'dcl_1', day(1)), undefined, deps);
  assert.deepEqual(state.weaknesses, start.weaknesses);
  assert.deepEqual(changed, { elements: ['n5_v_1'], weaknesses: [], declarations: ['dcl_1'], activities: [] });
});

test('erreurs explicites : identifiant de déclaration déjà utilisé, niveau sans fonction de contenu', () => {
  const s = run([declareElements([W1], 'dcl_1')]);
  assert.throws(() => applyEvent(s, declareElements([W2], 'dcl_1'), undefined, deps), /déjà enregistrée/);
  assert.throws(() => applyEvent(createEmptyLearningState(), declareScope('n5', 'd')), /elementsOfScope/);
});

// Décision du 2026-10-01 : aucune note autre qu'« Oublié » ne fait reculer un élément déclaré.
test('première révision d\'un élément déclaré : aucun recul pour chaque délai de 21 à 45 jours et chaque note', () => {
  const byDelay = new Map();
  for (let i = 0; byDelay.size < 25 && i < 10000; i++) {
    const id = `n5_v_${i}`;
    const delay = declarationDelayDays(id, day(0));
    if (!byDelay.has(delay)) byDelay.set(delay, id);
  }
  assert.equal(byDelay.size, 25);
  for (const [delay, id] of byDelay) {
    const s = run([declareElements([{ type: 'vocab', id }], 'd', day(0))]);
    assert.equal(s.elements[id].srs.interval, delay);
    assert.equal(st(s, id), 'acquired');
    for (const q of [0, 1, 2, 3]) {
      const after = run([graded({ type: 'vocab', id }, q, day(delay))], s);
      const rank = STATE_ORDER.indexOf(st(after, id));
      if (q === 0) assert.equal(st(after, id), 'learning');
      else assert.ok(rank >= STATE_ORDER.indexOf('acquired'), `délai ${delay}, note ${q}`);
      assert.equal(after.elements[id].verified, true);
    }
  }
});

// ── KNOWLEDGE_DECLARATION_UNDONE ────────────────────────────────────────────

test('annulation : les éléments retrouvent leurs faits précédents (1.5, 3.4)', () => {
  const start = run([introduced(W2, day(0)), answered({ type: 'grammar', id: 'n5_g_1' }, true, day(0))]);
  const declared = run([declareScope('n5', 'dcl_1', day(1))], start);
  const undone = run([undo('dcl_1', day(2))], declared);
  assert.deepEqual(undone.elements, start.elements, 'retour exact à l\'état d\'avant');
  assert.equal(st(undone, 'n5_v_1'), 'new');
  assert.equal(st(undone, 'n5_v_2'), 'discovered');
  assert.equal(st(undone, 'n5_g_1'), 'learning');
  assert.equal(undone.declarations.dcl_1.undoneAt, day(2));
});

test('annulation : un élément sans faits avant la déclaration disparaît du suivi', () => {
  const declared = run([declareElements([W1], 'dcl_1', day(0))]);
  const { state, changed } = applyEvent(declared, undo('dcl_1', day(1)), undefined, deps);
  assert.equal(Object.hasOwn(state.elements, 'n5_v_1'), false);
  assert.deepEqual(changed.elements, ['n5_v_1']);
});

test('annulation : un élément révisé depuis garde ses révisions réelles (3.4)', () => {
  const declared = run([declareElements([W1, W2], 'dcl_1', day(0))]);
  const reviewed = run([graded(W1, 0, day(30))], declared);
  const undone = run([undo('dcl_1', day(31))], reviewed);
  assert.deepEqual(undone.elements['n5_v_1'], reviewed.elements['n5_v_1']);
  assert.equal(undone.elements['n5_v_1'].verified, true);
  assert.equal(st(undone, 'n5_v_2'), 'new');
});

test('annulation : un élément repris par une déclaration plus récente n\'est pas rétabli', () => {
  let s = run([declareElements([W1], 'dcl_1', day(0))]);
  s = run([graded(W1, 0, day(25))], s);           // vérifié, redevenu En cours
  s = run([declareElements([W1], 'dcl_2', day(26))], s); // de nouveau déclaré
  const afterUndo1 = run([undo('dcl_1', day(27))], s);
  assert.deepEqual(afterUndo1.elements['n5_v_1'], s.elements['n5_v_1']);
  const afterUndo2 = run([undo('dcl_2', day(28))], afterUndo1);
  assert.equal(st(afterUndo2, 'n5_v_1'), 'learning'); // état d'avant dcl_2
});

test('annulation : une réponse de pratique depuis la déclaration n\'empêche pas le rétablissement', () => {
  // Une réponse hors révision ne modifie pas les faits d'un élément déjà En cours ou plus.
  const declared = run([declareElements([W1], 'dcl_1', day(0))]);
  const practiced = run([answered(W1, false, day(3))], declared);
  assert.deepEqual(practiced.elements['n5_v_1'], declared.elements['n5_v_1']);
  const undone = run([undo('dcl_1', day(4))], practiced);
  assert.equal(st(undone, 'n5_v_1'), 'new');
  assert.ok(undone.weaknesses['n5_v_1'], 'la faiblesse, fait distinct, est conservée');
});

test('annulation : déjà annulée → sans effet ; déclaration inconnue → erreur', () => {
  const s = run([declareElements([W1], 'dcl_1', day(0)), undo('dcl_1', day(1))]);
  const { state, changed } = applyEvent(s, undo('dcl_1', day(2)), undefined, deps);
  assert.equal(state.declarations.dcl_1.undoneAt, day(1));
  assert.deepEqual(changed, { elements: [], weaknesses: [], declarations: [], activities: [] });
  assert.throws(() => applyEvent(s, undo('dcl_x', day(2)), undefined, deps), /inconnue/);
});

// ── Avancement des activités ────────────────────────────────────────────────

const MISSION = { mode: 'free', source: 'explore', activityType: 'mission', activityId: 'n5_m_1' };
const started = (at) => ev('ACTIVITY_STARTED', at, { activityId: 'n5_m_1', activityType: 'mission' }, MISSION);
const completed = (at) => ev('ACTIVITY_COMPLETED', at,
  { activityId: 'n5_m_1', activityType: 'mission', durationSeconds: 300 }, MISSION);
const skipped = (at) => ev('ACTIVITY_SKIPPED', at, { activityId: 'n5_m_1', activityType: 'mission' },
  { ...MISSION, mode: 'guided', source: 'home' }, { sessionId: 'ses_1' });

test('avancement : démarrée → en cours ; terminée → terminée, avec ses dates (3.7)', () => {
  const s1 = run([started(day(0))]);
  assert.equal(computeActivityStatus(s1.activities.n5_m_1), 'in_progress');
  const s2 = run([completed(day(1))], s1);
  assert.deepEqual(s2.activities.n5_m_1, { id: 'n5_m_1', startedAt: day(0), completedAt: day(1) });
  assert.equal(computeActivityStatus(s2.activities.n5_m_1), 'completed');
});

test('avancement : les premières dates sont conservées ; refaire une activité terminée la laisse terminée', () => {
  const s = run([started(day(0)), completed(day(1)), started(day(5)), completed(day(6))]);
  assert.deepEqual(s.activities.n5_m_1, { id: 'n5_m_1', startedAt: day(0), completedAt: day(1) });
  const direct = run([completed(day(2))]);
  assert.deepEqual(direct.activities.n5_m_1, { id: 'n5_m_1', startedAt: day(2), completedAt: day(2) });
});

test('ACTIVITY_SKIPPED et les activités ne touchent ni l\'état des éléments, ni le SRS, ni les faiblesses', () => {
  const start = run([answered(W1, false, day(0))]);
  const { state, changed } = applyEvent(start, skipped(day(1)), undefined, deps);
  assert.deepEqual(state, start);
  assert.deepEqual(changed, { elements: [], weaknesses: [], declarations: [], activities: [] });
  const after = run([started(day(1)), completed(day(2))], start);
  assert.deepEqual(after.elements, start.elements);
  assert.deepEqual(after.weaknesses, start.weaknesses);
});

// ── S6 et S7 avec déclarations ──────────────────────────────────────────────

function randomJournal(seed, length) {
  const rnd = seededRandom(seed);
  const all = Object.values(CATALOG).flat();
  const pick = (l) => l[Math.floor(rnd() * l.length)];
  const events = [];
  const declarationIds = [];
  let t = Date.UTC(2026, 9, 1, 8);
  for (let i = 0; i < length; i++) {
    t += Math.floor(rnd() * 4 * 86400000);
    const at = new Date(t).toISOString();
    const r = rnd();
    if (r < 0.1) events.push(introduced(pick(all), at));
    else if (r < 0.35) events.push(answered(pick(all), rnd() < 0.6, at));
    else if (r < 0.75) events.push(graded(pick(all), Math.floor(rnd() * 4), at));
    else if (r < 0.88) {
      const id = `dcl_${seed}_${i}`;
      declarationIds.push(id);
      events.push(rnd() < 0.5
        ? declareScope(pick(['kana', 'n5', 'n4', 'n3']), id, at, pick(['declared', 'tested']))
        : declareElements([pick(all)], id, at));
    } else if (declarationIds.length) events.push(undo(pick(declarationIds), at));
  }
  return events;
}

// Partie 7 · S6. Exceptions prévues : création de l'entrée SRS (première évaluation ou
// déclaration) et annulation d'une déclaration (rétablissement des faits d'avant).
test('S6 avec déclarations : un intervalle ne change que par REVIEW_GRADED, création, déclaration ou annulation', () => {
  for (let seed = 1; seed <= 30; seed++) {
    replay(randomJournal(seed, 150), { deps, onStep(before, after, event) {
      for (const id of new Set([...Object.keys(before.elements), ...Object.keys(after.elements)])) {
        const a = before.elements[id]?.srs;
        const b = after.elements[id]?.srs;
        if (JSON.stringify(a) === JSON.stringify(b)) continue;
        const allowed = event.type === 'REVIEW_GRADED' || event.type === 'KNOWLEDGE_DECLARED' ||
          event.type === 'KNOWLEDGE_DECLARATION_UNDONE' || !a;
        assert.ok(allowed, `germe ${seed} : ${id} modifié par ${event.type}`);
        if (event.type === 'KNOWLEDGE_DECLARED') {
          assert.ok(!a || ['new', 'discovered', 'learning'].includes(computeState(before.elements[id])));
        }
      }
    } });
  }
});

// Partie 7 · S7 ; partie 1 · 1.8, invariant 5. L'annulation d'une déclaration, qui « rétablit
// l'état précédent » (1.5), est la seule autre exception : voir le rapport de la tâche 7.
test('S7 avec déclarations et tests : aucun recul, sauf « Oublié » et annulation d\'une déclaration', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = replay(randomJournal(seed, 150), { deps, onStep(before, after, event) {
      for (const id of Object.keys(before.elements)) {
        const was = STATE_ORDER.indexOf(computeState(before.elements[id]));
        const now = STATE_ORDER.indexOf(computeState(after.elements[id]));
        if (now >= was) continue;
        const ok = (event.type === 'REVIEW_GRADED' && event.payload.quality === 0) ||
          event.type === 'KNOWLEDGE_DECLARATION_UNDONE';
        assert.ok(ok, `germe ${seed} : ${id} recule par ${event.type}`);
      }
    } });
    for (const facts of Object.values(s.elements)) assert.deepEqual(checkElementFacts(facts), []);
  }
});

test('la fenêtre de vérification est celle de GUIDED_CONFIG', () => {
  assert.deepEqual({ ...GUIDED_CONFIG.declaredVerificationWindowDays }, { min: 21, max: 45 });
});
