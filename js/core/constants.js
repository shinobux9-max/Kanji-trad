/**
 * js/core/constants.js
 * Constantes réellement globales et partagées par plusieurs modules.
 * Ne PAS y déplacer une constante spécifique à une seule fonctionnalité —
 * elle doit rester dans son module (voir consigne du refactoring).
 */

// Niveaux JLPT disponibles, dans l'ordre utilisé partout dans l'app (niveaux.json, sélecteurs,
// boucles de préchargement, etc.)
export const ALL_JLPT_LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];

// Scripts kana disponibles (utilisé par buildReviewQueue, l'entraînement libre, les pickers)
export const ALL_KANA_SCRIPTS = ['hira', 'kata'];
