// Ocha v2 — Algorithme SRS
//
// Repris de l'ancienne app (js/srs.js, stratégie de reconstruction §3.2) : même calcul, mais
// en fonctions PURES. Elles ne lisent ni n'écrivent rien : elles reçoivent l'entrée SRS et la
// date, et renvoient un résultat. L'enregistrement, les faiblesses et le journal sont des
// effets d'événement (partie 3), traités ailleurs.
//
// Ce fichier ne contient que l'algorithme (décision du 2026-10-01) :
//   - gradeReview : calcul d'une révision réelle notée (REVIEW_GRADED, partie 3, 3.4) ;
//   - getDaysOverdue : retard d'une entrée par rapport à son échéance.
// La CRÉATION d'une entrée (J+1 à la première évaluation, 21 à 45 jours à une déclaration)
// est un effet d'événement, et n'est pas ici.
//
// Format d'une entrée SRS (inchangé, partie 1, 1.7) :
//   { interval, easeFactor, repetitions, lastReviewDate, nextReviewDate }
// les dates en ISO 8601.
//
// Différences avec l'ancien code, toutes sans effet sur le calcul :
//   - les constantes viennent de GUIDED_CONFIG.srsAlgorithm ;
//   - la date est reçue en argument (`now`), au lieu d'être lue sur l'horloge ;
//   - gradeReview n'enregistre plus rien, ne met plus à jour les statistiques ni les
//     faiblesses (partie 3, 3.9 : ce sont des effets du traitement central).

import { GUIDED_CONFIG } from '../config.js';
import { toDate, addCalendarDays } from './dates.js';

export const QUALITY = Object.freeze({
  FORGOTTEN: 0, // Oublié (ancien « Encore »)
  HARD: 1,      // Difficile
  GOOD: 2,      // Bien
  EASY: 3       // Facile
});

const MS_PER_DAY = 86400000;

/**
 * Calcule l'entrée SRS après une révision notée.
 *
 * @param {object|null} srs     entrée actuelle ; absente : entrée de départ de l'ancien code
 *                              (intervalle 0, facilité initiale, 0 répétition)
 * @param {number} quality      0 Oublié, 1 Difficile, 2 Bien, 3 Facile
 * @param {string|Date} now     date de la révision (en pratique, `at` de l'événement)
 * @param {object} config       configuration (GUIDED_CONFIG par défaut)
 * @returns {object}            nouvelle entrée SRS ; l'entrée reçue n'est pas modifiée
 */
export function gradeReview(srs, quality, now, config = GUIDED_CONFIG) {
  if (![0, 1, 2, 3].includes(quality)) {
    throw new TypeError(`note invalide : ${String(quality)} (0, 1, 2 ou 3 attendu)`);
  }
  const date = toDate(now);
  const p = config.srsAlgorithm;

  const existing = srs || { interval: 0, easeFactor: p.initialEaseFactor, repetitions: 0 };
  let { interval, easeFactor, repetitions } = existing;

  if (quality === QUALITY.FORGOTTEN) {
    repetitions = 0;
    interval = p.forgotten.interval;
    easeFactor = Math.max(p.minEaseFactor, easeFactor - p.forgotten.easePenalty);
  } else {
    repetitions += 1;
    if (quality === QUALITY.HARD) {
      interval = repetitions === 1 ? p.hard.firstInterval : Math.round(interval * p.hard.multiplier);
      easeFactor = Math.max(p.minEaseFactor, easeFactor - p.hard.easePenalty);
    } else if (quality === QUALITY.GOOD) {
      interval = repetitions === 1 ? p.good.firstInterval
        : (repetitions === 2 ? p.good.secondInterval : Math.round(interval * easeFactor));
    } else {
      interval = repetitions === 1 ? p.easy.firstInterval
        : (repetitions === 2 ? p.easy.secondInterval : Math.round(interval * easeFactor * p.easy.multiplier));
      easeFactor += p.easy.easeBonus;
    }
  }

  // Échéance : `interval` jours CALENDAIRES plus tard, à la même heure locale (comme
  // l'ancien code, qui utilisait setDate).
  const nextReviewDate = addCalendarDays(date, interval);

  return {
    interval,
    easeFactor,
    repetitions,
    lastReviewDate: date.toISOString(),
    nextReviewDate: nextReviewDate.toISOString()
  };
}

/**
 * Retard d'une entrée par rapport à son échéance, en jours (décimaux).
 * Sans entrée : 0. Comme l'ancien code, la valeur est NÉGATIVE si l'échéance n'est pas
 * encore atteinte (l'ancien commentaire annonçait 0 dans ce cas, mais le code ne le faisait
 * pas ; voir le rapport de la tâche 2).
 *
 * @param {object|null} srs
 * @param {string|Date} now
 */
export function getDaysOverdue(srs, now) {
  const date = toDate(now);
  if (!srs) return 0;
  return (date.getTime() - new Date(srs.nextReviewDate).getTime()) / MS_PER_DAY;
}
