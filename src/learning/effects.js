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
// État d'apprentissage :
//   {
//     elements:   { [idÉlément]: { id, introducedAt, origin, verified, srs } },
//     weaknesses: { [idÉlément]: { id, consecutiveFails, totalFails, successStreak,
//                                  lastFailDate, resolvedAt } }
//   }
// Les clés sont les identifiants d'éléments (magasins `elements` et `weaknesses`, 9.2).
//
// Faits d'un élément (partie 1, 1.4 et 1.7) :
//   introducedAt   date d'introduction (Découvert et au-delà)
//   origin         'learned' (appris dans Ocha), 'declared' ou 'tested' ; posée avec l'entrée SRS
//   verified       pour 'declared' et 'tested' seulement : vérification faite
//   srs            entrée SRS (En cours et au-delà)
//
// Cette première partie traite CONTENT_INTRODUCED, QUESTION_ANSWERED et REVIEW_GRADED, ainsi
// que les événements sans effet sur ces faits (SESSION_…, REINFORCEMENT_TRIGGERED). Les
// déclarations et l'avancement des activités viennent à la tâche 7.

import { GUIDED_CONFIG } from '../config.js';
import { toDate, addCalendarDays } from './dates.js';
import { gradeReview, QUALITY } from './srs.js';
import { applyWeaknessFailure, applyWeaknessSuccess } from './weakness.js';

export const ORIGINS = Object.freeze({
  LEARNED: 'learned',   // appris dans Ocha
  DECLARED: 'declared', // déclaré par l'utilisateur
  TESTED: 'tested'      // déduit du test de positionnement
});

/** État d'apprentissage vide : tout élément est Nouveau. */
export function createEmptyLearningState() {
  return { elements: {}, weaknesses: {} };
}

// ── Petits outils de copie ──────────────────────────────────────────────────

// Modifications accumulées pendant le traitement d'un événement ; l'état reçu n'est jamais
// modifié.
function draft(state) {
  const elements = { ...state.elements };
  const weaknesses = { ...state.weaknesses };
  const changed = { elements: new Set(), weaknesses: new Set() };
  return {
    getElement: (id) => elements[id],
    setElement(id, facts) { elements[id] = facts; changed.elements.add(id); },
    getWeakness: (id) => weaknesses[id],
    setWeakness(id, record) { weaknesses[id] = record; changed.weaknesses.add(id); },
    finish: () => ({
      state: { ...state, elements, weaknesses },
      changed: { elements: [...changed.elements], weaknesses: [...changed.weaknesses] }
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

const HANDLERS = {
  CONTENT_INTRODUCED: contentIntroduced,
  QUESTION_ANSWERED: questionAnswered,
  REVIEW_GRADED: reviewGraded,
  // Sans effet sur le suivi, le SRS et les faiblesses (3.4).
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
 * @returns {{ state: object, changed: { elements: string[], weaknesses: string[] } }}
 */
export function applyEvent(state, event, config = GUIDED_CONFIG) {
  const handler = HANDLERS[event.type];
  if (!handler) {
    // ACTIVITY_… et KNOWLEDGE_… : tâche 7.
    throw new Error(`effets de ${event.type} non encore implémentés`);
  }
  const d = draft(state);
  handler(d, event, toDate(event.at), config);
  return d.finish();
}
