// Ocha v2 — Dates dans la couche learning
//
// Les fonctions de learning ne lisent jamais l'horloge : elles reçoivent la date en argument
// (en pratique, `at` de l'événement, décision du 2026-10-01). Ce fichier vérifie cet argument
// de la même façon partout.

/**
 * Convertit une date reçue en argument en objet Date (copie).
 * @param {string|Date} value  chaîne ISO 8601 ou Date
 * @returns {Date}
 */
export function toDate(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new TypeError('date invalide : chaîne ISO ou Date attendue');
  }
  const date = new Date(value instanceof Date ? value.getTime() : value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`date invalide : ${String(value)}`);
  return date;
}
