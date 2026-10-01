// Ocha v2 — Effets pédagogiques des événements
//
// Partie 3, 3.4 : ce que signifie chaque événement pour le suivi des éléments, le SRS et les
// faiblesses, QUEL QUE SOIT l'écran qui l'émet (3.1, invariant 6 de 3.10).
//
// applyEvent est une fonction PURE : elle reçoit l'état d'apprentissage et un événement déjà
// validé (events.js), et renvoie un NOUVEL état, sans modifier celui reçu, ainsi que la liste
// de ce qui a changé. L'enregistrement (une transaction) est fait par recordLearningEvent
// (tâche 8).
//
// État d'apprentissage (une clé par magasin de 9.2) :
//   {
//     elements:     { [idÉlément]: { id, introducedAt, origin, verified, srs } },
//     weaknesses:   { [idÉlément]: { id, consecutiveFails, totalFails, successStreak,
//                                    lastFailDate, resolvedAt } },
//     declarations: { [idDéclaration]: { id, at, origin, scope | elements, previous,
//                                        undoneAt } },
//     activities:   { [idActivité]: { id, startedAt, completedAt } }
//   }
// Un élément absent de `elements` est Nouveau. Quand l'annulation d'une déclaration ramène
// un élément à « aucun fait », son entrée disparaît de `elements` : la liste `changed` le
// mentionne, et l'enregistrement devra alors la supprimer du magasin.
//
// Faits d'un élément (partie 1, 1.4 et 1.7) :
//   introducedAt   date d'introduction (Découvert et au-delà)
//   origin         'learned' (appris dans Ocha), 'declared' ou 'tested' ; posée avec l'entrée SRS
//   verified       pour 'declared' et 'tested' seulement : vérification faite
//   srs            entrée SRS (En cours et au-delà)
//
// Les 12 types d'événements sont traités ; SESSION_…, ACTIVITY_SKIPPED et
// REINFORCEMENT_TRIGGERED n'ont aucun effet sur l'état (ils ne servent qu'au journal).

import { GUIDED_CONFIG } from '../config.js';
import { toDate, addCalendarDays } from './dates.js';
import { gradeReview, QUALITY } from './srs.js';
import { applyWeaknessFailure, applyWeaknessSuccess } from './weakness.js';
import { computeState, STATES } from './state.js';

export const ORIGINS = Object.freeze({
  LEARNED: 'learned',   // appris dans Ocha
  DECLARED: 'declared', // déclaré par l'utilisateur
  TESTED: 'tested'      // déduit du test de positionnement
});

// Niveaux d'une déclaration, du plus bas au plus haut : déclarer un niveau déclare aussi
// tous ceux qui le précèdent, kana compris (partie 1, 1.5).
export const DECLARATION_SCOPE_ORDER = Object.freeze(['kana', 'n5', 'n4', 'n3', 'n2', 'n1']);

/** État d'apprentissage vide : tout élément est Nouveau. */
export function createEmptyLearningState() {
  return { elements: {}, weaknesses: {}, declarations: {}, activities: {} };
}

// ── Petits outils de copie ──────────────────────────────────────────────────

// Modifications accumulées pendant le traitement d'un événement ; l'état reçu n'est jamais
// modifié.
const STORES = ['elements', 'weaknesses', 'declarations', 'activities'];

function draft(state) {
  const copies = Object.fromEntries(STORES.map((k) => [k, { ...(state[k] || {}) }]));
  const changed = Object.fromEntries(STORES.map((k) => [k, new Set()]));
  const getter = (k) => (id) => copies[k][id];
  const setter = (k) => (id, value) => {
    if (value === undefined) delete copies[k][id];
    else copies[k][id] = value;
    changed[k].add(id);
  };
  return {
    getElement: getter('elements'),
    setElement: setter('elements'),
    getWeakness: getter('weaknesses'),
    setWeakness: setter('weaknesses'),
    getDeclaration: getter('declarations'),
    setDeclaration: setter('declarations'),
    getActivity: getter('activities'),
    setActivity: setter('activities'),
    finish: () => ({
      state: { ...state, ...copies },
      changed: Object.fromEntries(STORES.map((k) => [k, [...changed[k]]]))
    })
  };
}

// Entrée SRS initiale d'une première évaluation (3.4) : première vérification à J+1, sans
// révision réelle (donc sans date de dernière révision, comme pour une déclaration).
function initialSrsEntry(at, config) {
  return {
    interval: config.firstCheckDelayDays,
    easeFactor: config.srsAlgorithm.initialEaseFactor,
    repetitions: 0,
    lastReviewDate: null,
    nextReviewDate: addCalendarDays(at, config.firstCheckDelayDays).toISOString()
  };
}

function updateWeakness(d, id, failed, at) {
  const current = d.getWeakness(id);
  if (failed) {
    d.setWeakness(id, { ...applyWeaknessFailure(current, at), id });
  } else {
    const next = applyWeaknessSuccess(current, at);
    if (next) d.setWeakness(id, next); // une réussite sans faiblesse ne crée rien
  }
}

// ── Effets de chaque type ───────────────────────────────────────────────────

function contentIntroduced(d, event, at) {
  const { id } = event.payload.element;
  const facts = d.getElement(id);
  // Nouveau → Découvert ; sans effet si l'élément a déjà une date d'introduction.
  if (facts && facts.introducedAt) return;
  d.setElement(id, { ...facts, id, introducedAt: at.toISOString() });
}

function questionAnswered(d, event, at, config) {
  // Test de positionnement : réponses journalisées, sans aucun effet (3.4, invariant 5).
  if (event.context.activityType === 'placement') return;

  for (const { id } of event.payload.target) {
    const facts = d.getElement(id);
    // Première évaluation (Nouveau ou Découvert) : → En cours, juste ou fausse.
    if (!facts || !facts.srs) {
      d.setElement(id, {
        ...facts,
        id,
        introducedAt: (facts && facts.introducedAt) || at.toISOString(),
        origin: ORIGINS.LEARNED,
        srs: initialSrsEntry(at, config)
      });
    }
    // Hors création, une réponse ne touche jamais le SRS (invariants 2 et 4 de 3.10).
    updateWeakness(d, id, !event.payload.correct, at);
  }
}

function reviewGraded(d, event, at, config) {
  const { id } = event.payload.element;
  const { quality } = event.payload;
  const facts = d.getElement(id) || { id };

  const next = {
    ...facts,
    id,
    srs: gradeReview(facts.srs || null, quality, at, config)
  };
  // Un élément noté sans être passé par une présentation ni une question entre en En cours
  // comme à une première évaluation.
  if (!facts.introducedAt) next.introducedAt = at.toISOString();
  if (!facts.origin) next.origin = ORIGINS.LEARNED;
  // Vérification d'un élément déclaré ou testé, quelle que soit la note (3.4).
  if ((facts.origin === ORIGINS.DECLARED || facts.origin === ORIGINS.TESTED) && !facts.verified) {
    next.verified = true;
  }
  d.setElement(id, next);

  // Faiblesse : Oublié → augmente ; Bien ou Facile → diminue ; Difficile → inchangée.
  if (quality === QUALITY.FORGOTTEN) updateWeakness(d, id, true, at);
  else if (quality === QUALITY.GOOD || quality === QUALITY.EASY) updateWeakness(d, id, false, at);
}

// ── Déclarations (partie 1, 1.3 et 1.5 ; partie 3, 3.4) ─────────────────────

// Empreinte stable d'un identifiant (FNV-1a 32 bits sur ses unités UTF-16).
function stableHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Délai de la première vérification d'un élément déclaré : entre min et max jours (bornes
 * incluses), réparti de façon déterministe à partir de la date de la déclaration et d'une
 * empreinte stable de l'identifiant de l'élément (partie 1, 1.3). Un même élément tombe
 * toujours au même délai pour une même déclaration.
 *
 * @param {string} elementId
 * @param {string|Date} declaredAt  date de la déclaration (`at` de l'événement)
 * @param {object} config
 */
export function declarationDelayDays(elementId, declaredAt, config = GUIDED_CONFIG) {
  const { min, max } = config.declaredVerificationWindowDays;
  const key = `${toDate(declaredAt).toISOString()}|${elementId}`;
  return min + (stableHash(key) % (max - min + 1));
}

// Faits d'un élément après une déclaration (décision du 2026-10-01) : intervalle = délai de
// vérification, 3 répétitions, facilité initiale, aucune date de dernière révision.
function declaredFacts(previous, id, at, origin, config) {
  const delay = declarationDelayDays(id, at, config);
  return {
    ...previous,
    id,
    introducedAt: (previous && previous.introducedAt) || at.toISOString(),
    origin,
    verified: false,
    srs: {
      interval: delay,
      easeFactor: config.srsAlgorithm.initialEaseFactor,
      repetitions: 3,
      lastReviewDate: null,
      nextReviewDate: addCalendarDays(at, delay).toISOString()
    }
  };
}

const isKnown = (facts) => {
  const s = computeState(facts);
  return s === STATES.ACQUIRED || s === STATES.MASTERED;
};

function declarationTargets(event, deps) {
  const { elements, scope } = event.payload;
  if (elements) return elements;
  if (typeof deps.elementsOfScope !== 'function') {
    throw new Error('déclaration par niveau : fonction elementsOfScope non fournie');
  }
  const upTo = DECLARATION_SCOPE_ORDER.indexOf(scope);
  return DECLARATION_SCOPE_ORDER.slice(0, upTo + 1).flatMap((level) => deps.elementsOfScope(level));
}

function knowledgeDeclared(d, event, at, config, deps) {
  const { declarationId, origin, scope, elements } = event.payload;
  if (d.getDeclaration(declarationId)) {
    throw new Error(`déclaration déjà enregistrée : ${declarationId}`);
  }
  const previous = {};
  for (const { id } of declarationTargets(event, deps)) {
    if (Object.hasOwn(previous, id)) continue;
    const facts = d.getElement(id);
    // Une déclaration ne fait jamais reculer : Acquis et Maîtrisé ne sont pas touchés.
    if (isKnown(facts)) continue;
    previous[id] = facts === undefined ? null : facts;
    d.setElement(id, declaredFacts(facts, id, at, origin, config));
  }
  // Trace pour l'annulation ; le niveau choisi est conservé même s'il n'a aucun contenu.
  d.setDeclaration(declarationId, {
    id: declarationId,
    at: at.toISOString(),
    origin,
    ...(scope !== undefined ? { scope } : { elements }),
    previous,
    undoneAt: null
  });
}

// Égalité de valeur, indépendante de l'ordre des champs.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}
function sameFacts(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function knowledgeDeclarationUndone(d, event, at, config) {
  const { declarationId } = event.payload;
  const declaration = d.getDeclaration(declarationId);
  if (!declaration) throw new Error(`déclaration inconnue : ${declarationId}`);
  if (declaration.undoneAt) return; // déjà annulée : rien à faire

  const declaredAt = toDate(declaration.at);
  for (const [id, before] of Object.entries(declaration.previous)) {
    // On ne rétablit un élément que s'il est encore exactement tel que la déclaration l'a
    // laissé. Un élément révisé depuis (vérifié) ou modifié par une autre déclaration garde
    // ses faits actuels : ses révisions réelles priment (3.4).
    const written = declaredFacts(before === null ? undefined : before, id, declaredAt,
      declaration.origin, config);
    if (!sameFacts(d.getElement(id), written)) continue;
    d.setElement(id, before === null ? undefined : before);
  }
  d.setDeclaration(declarationId, { ...declaration, undoneAt: at.toISOString() });
}

// ── Avancement des activités (partie 3, 3.7) ────────────────────────────────
//
// Faits : date du premier démarrage, date de la première fin. L'avancement (non commencée,
// en cours, terminée) se calcule à partir d'eux (state.js). L'étape atteinte d'une mission
// en cours est enregistrée avec la session (magasin `sessions`), pas ici.

function activityStarted(d, event, at) {
  const { activityId } = event.payload;
  const record = d.getActivity(activityId);
  if (record && record.startedAt) return;
  d.setActivity(activityId, { completedAt: null, ...record, id: activityId, startedAt: at.toISOString() });
}

function activityCompleted(d, event, at) {
  const { activityId } = event.payload;
  const record = d.getActivity(activityId);
  if (record && record.completedAt) return;
  d.setActivity(activityId, {
    id: activityId,
    startedAt: (record && record.startedAt) || at.toISOString(),
    completedAt: at.toISOString()
  });
}

const HANDLERS = {
  CONTENT_INTRODUCED: contentIntroduced,
  QUESTION_ANSWERED: questionAnswered,
  REVIEW_GRADED: reviewGraded,
  KNOWLEDGE_DECLARED: knowledgeDeclared,
  KNOWLEDGE_DECLARATION_UNDONE: knowledgeDeclarationUndone,
  ACTIVITY_STARTED: activityStarted,
  ACTIVITY_COMPLETED: activityCompleted,
  // Sans effet sur l'état : ils ne servent qu'au journal (3.4 ; une étape passée compte pour
  // la rotation du moteur, partie 4, 4.7, qui la lit dans le journal).
  ACTIVITY_SKIPPED: () => {},
  SESSION_STARTED: () => {},
  SESSION_COMPLETED: () => {},
  SESSION_ABANDONED: () => {},
  REINFORCEMENT_TRIGGERED: () => {}
};

/**
 * Applique un événement VALIDE à l'état d'apprentissage.
 *
 * @param {object} state   état actuel (non modifié)
 * @param {object} event   événement validé par validateEvent
 * @param {object} config  configuration (GUIDED_CONFIG par défaut)
 * @param {object} deps
 * @param {(level: string) => {type: string, id: string}[]} [deps.elementsOfScope]
 *        éléments d'UN niveau (`kana`, `n5`…), pour une déclaration par niveau. Fournie par
 *        le contenu (étape 2) ; un faux catalogue dans les tests.
 * @returns {{ state: object, changed: { elements: string[], weaknesses: string[],
 *             declarations: string[], activities: string[] } }}
 *          une erreur est levée si l'événement est incompatible avec l'état (déclaration
 *          inconnue à annuler, identifiant de déclaration déjà utilisé)
 */
export function applyEvent(state, event, config = GUIDED_CONFIG, deps = {}) {
  const handler = HANDLERS[event.type];
  if (!handler) throw new Error(`type d'événement non géré : ${event.type}`);
  const d = draft(state);
  handler(d, event, toDate(event.at), config, deps);
  return d.finish();
}
