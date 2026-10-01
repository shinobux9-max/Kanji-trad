// Ocha v2 — Journal : résumé quotidien et compaction
//
// Partie 3, 3.8 ; partie 9, 9.2 (magasins `events` et `daily`). Fonctions PURES : le
// traitement central (record.js) les appelle dans ses transactions.
//
// Deux niveaux de conservation :
//   1. le DÉTAIL des événements (magasin `events`) : 30 derniers jours, 5 000 événements au
//      plus ; au-delà, les plus anciens sont supprimés par la compaction ;
//   2. le RÉSUMÉ QUOTIDIEN (magasin `daily`), conservé sans limite.
//
// Le résumé d'un jour est tenu à jour à CHAQUE événement enregistré, dans la même transaction
// que l'événement. La compaction n'a donc rien à résumer : elle ne fait que supprimer du
// détail déjà résumé, et aucun jour n'est jamais sans résumé.
//
// La compaction ne touche JAMAIS au jour en cours, même au-delà du plafond de 5 000
// (décision du 2026-10-01 : le budget quotidien se calcule sur le détail du jour).
//
// L'état d'apprentissage ne dépend pas du journal (3.8) : compacter ne change aucun état (C5).

import { GUIDED_CONFIG } from '../config.js';
import { localDayKey, addCalendarDays, toDate } from './dates.js';

const NO_EXERCISE_TYPE = 'none'; // réponse sans type d'exercice déclaré dans son contexte

/**
 * Résumé vide d'un jour.
 * @param {string} date  AAAA-MM-JJ
 */
export function emptyDailySummary(date) {
  return {
    date,
    answers: {},              // [mode][exerciseType] → { correct, incorrect }
    reviews: { 0: 0, 1: 0, 2: 0, 3: 0 }, // révisions SRS par note (Oublié … Facile)
    activitiesCompleted: 0,   // ACTIVITY_COMPLETED
    activitySeconds: 0,       // durées des activités terminées
    sessionMinutes: 0,        // durées des sessions guidées terminées ou abandonnées
    introduced: {}            // [type] → éléments qui ont quitté Nouveau ce jour (budget, 4.4)
  };
}

/**
 * Ajoute un événement enregistré au résumé de son jour. Renvoie un NOUVEAU résumé ; le
 * résumé reçu n'est pas modifié.
 *
 * @param {object|undefined} summary  résumé actuel du jour de l'événement (absent : vide)
 * @param {object} event              événement validé
 * @param {{type: string}[]} [leftNew] éléments que cet événement a fait quitter l'état Nouveau
 *                                     (budget.js, elementsLeavingNew)
 */
export function addToDailySummary(summary, event, leftNew = []) {
  const next = structuredClone(summary || emptyDailySummary(localDayKey(event.at)));
  const { payload, context } = event;

  next.introduced ??= {};
  for (const { type } of leftNew) next.introduced[type] = (next.introduced[type] || 0) + 1;

  switch (event.type) {
    case 'QUESTION_ANSWERED': {
      const mode = context.mode;
      const exerciseType = context.exerciseType || NO_EXERCISE_TYPE;
      next.answers[mode] ??= {};
      next.answers[mode][exerciseType] ??= { correct: 0, incorrect: 0 };
      next.answers[mode][exerciseType][payload.correct ? 'correct' : 'incorrect'] += 1;
      break;
    }
    case 'REVIEW_GRADED':
      next.reviews[payload.quality] += 1;
      break;
    case 'ACTIVITY_COMPLETED':
      next.activitiesCompleted += 1;
      next.activitySeconds += payload.durationSeconds;
      break;
    case 'SESSION_COMPLETED':
    case 'SESSION_ABANDONED':
      next.sessionMinutes += payload.actualMinutes;
      break;
    default:
      break; // les autres événements ne figurent pas dans le résumé
  }
  return next;
}

/**
 * Événements du détail à supprimer.
 *
 * Sont conservés : tous les événements du jour en cours, puis, parmi les autres, ceux des
 * `detailDays` derniers jours (jour en cours compris), dans la limite de `maxDetailedEvents`
 * au total, les plus récents d'abord.
 *
 * @param {object[]} events  événements du détail (au moins `id` et `at`)
 * @param {string|Date} now
 * @param {object} config
 * @returns {string[]}       identifiants à supprimer
 */
export function planCompaction(events, now, config = GUIDED_CONFIG) {
  const { detailDays, maxDetailedEvents } = config.journal;
  const today = localDayKey(now);
  const oldestKeptDay = localDayKey(addCalendarDays(toDate(now), -(detailDays - 1)));

  // Du plus récent au plus ancien (même ordre que l'index `at`, inversé).
  const sorted = [...events].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : (a.id < b.id ? 1 : -1)));
  const todayCount = sorted.filter((e) => localDayKey(e.at) === today).length;
  let room = Math.max(0, maxDetailedEvents - todayCount);

  const toDelete = [];
  for (const event of sorted) {
    const day = localDayKey(event.at);
    if (day === today) continue;               // jamais le jour en cours
    if (day > today) continue;                 // date future (horloge déréglée) : conservée
    if (day < oldestKeptDay || room === 0) toDelete.push(event.id);
    else room -= 1;
  }
  return toDelete;
}
