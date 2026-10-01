// Ocha v2 — État pédagogique calculé
//
// Partie 1 (1.2, 1.4, 1.8). L'état d'un élément n'est JAMAIS stocké : il se déduit des faits
// persistés. Ce fichier contient le seul calcul de l'état ; les écrans et le moteur demandent
// l'état, ils ne le recalculent pas (REGLES-CONSTRUCTION.md, §4).
//
// Faits utilisés (entrée de suivi d'un élément, partie 1, 1.7) :
//   introducedAt   date d'introduction : distingue Nouveau de Découvert
//   srs            entrée SRS : à partir d'En cours ; son intervalle donne le niveau
//
// Règle générale, la même pour tous les éléments, quelle que soit leur origine (décision du
// 2026-10-01 : aucune règle « déclaré = Acquis ») :
//
//   pas d'entrée SRS, pas de date d'introduction   → Nouveau      (new)
//   pas d'entrée SRS, date d'introduction           → Découvert    (discovered)
//   intervalle < 21 jours                           → En cours     (learning)
//   21 ≤ intervalle < 60 jours                      → Acquis       (acquired)
//   intervalle ≥ 60 jours                           → Maîtrisé     (mastered)
//
// Les seuils viennent de GUIDED_CONFIG.stateThresholds. Tout autre champ de l'entrée (un
// éventuel champ « état », l'origine, la vérification) est ignoré par le calcul.

import { GUIDED_CONFIG } from '../config.js';

export const STATES = Object.freeze({
  NEW: 'new',
  DISCOVERED: 'discovered',
  LEARNING: 'learning',
  ACQUIRED: 'acquired',
  MASTERED: 'mastered'
});

// Du plus faible au plus fort (partie 1, 1.2).
export const STATE_ORDER = Object.freeze([
  STATES.NEW, STATES.DISCOVERED, STATES.LEARNING, STATES.ACQUIRED, STATES.MASTERED
]);

/**
 * État d'un élément à partir de ses faits.
 *
 * @param {object|undefined} facts  entrée de suivi ; absente pour un élément jamais touché
 * @param {object} config           configuration (GUIDED_CONFIG par défaut)
 * @returns {string}                l'un des cinq identifiants de STATES
 */
export function computeState(facts, config = GUIDED_CONFIG) {
  if (facts === undefined || facts === null) return STATES.NEW;
  if (typeof facts !== 'object') throw new TypeError('entrée de suivi invalide : objet attendu');

  const { srs } = facts;
  if (srs === undefined || srs === null) {
    return facts.introducedAt ? STATES.DISCOVERED : STATES.NEW;
  }

  const { interval } = srs;
  if (typeof interval !== 'number' || !Number.isFinite(interval) || interval < 0) {
    throw new TypeError(`entrée SRS invalide : intervalle ${String(interval)}`);
  }
  const { acquiredIntervalDays, masteredIntervalDays } = config.stateThresholds;
  if (interval >= masteredIntervalDays) return STATES.MASTERED;
  if (interval >= acquiredIntervalDays) return STATES.ACQUIRED;
  return STATES.LEARNING;
}

const isIsoDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

/**
 * Vérifie qu'une entrée de suivi respecte les invariants de la partie 1 (1.8) qui portent sur
 * les faits eux-mêmes. Renvoie la liste des écarts (vide si tout va bien). Ne modifie rien.
 *
 * Invariants vérifiés ici :
 *   2. un élément En cours, Acquis ou Maîtrisé a une entrée SRS complète ;
 *   3. un élément Découvert ou au-delà a une date d'introduction.
 * Les invariants 1 et 8 sont garantis par computeState (un seul état, toujours calculé) ;
 * les autres portent sur les événements (tâches 6 et 7).
 *
 * @param {object|undefined} facts
 * @returns {string[]}
 */
export function checkElementFacts(facts) {
  if (facts === undefined || facts === null) return [];
  if (typeof facts !== 'object') return ['entrée de suivi : objet attendu'];

  const problems = [];
  const { introducedAt, srs } = facts;

  if (introducedAt !== undefined && introducedAt !== null && !isIsoDate(introducedAt)) {
    problems.push('date d\'introduction invalide');
  }

  if (srs !== undefined && srs !== null) {
    if (!introducedAt) problems.push('entrée SRS sans date d\'introduction (invariant 3)');
    const { interval, easeFactor, repetitions, lastReviewDate, nextReviewDate } = srs;
    if (typeof interval !== 'number' || !Number.isFinite(interval) || interval < 0) {
      problems.push('entrée SRS : intervalle invalide (invariant 2)');
    }
    if (typeof easeFactor !== 'number' || !Number.isFinite(easeFactor)) {
      problems.push('entrée SRS : facilité invalide (invariant 2)');
    }
    if (!Number.isInteger(repetitions) || repetitions < 0) {
      problems.push('entrée SRS : répétitions invalides (invariant 2)');
    }
    if (!isIsoDate(nextReviewDate)) {
      problems.push('entrée SRS : échéance invalide (invariant 2)');
    }
    // Vide pour une entrée créée par une déclaration (décision du 2026-10-01).
    if (lastReviewDate !== null && lastReviewDate !== undefined && !isIsoDate(lastReviewDate)) {
      problems.push('entrée SRS : date de dernière révision invalide');
    }
  }

  return problems;
}
