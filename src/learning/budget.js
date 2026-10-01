// Ocha v2 — Budget quotidien de nouveautés
//
// Partie 4, 4.4 (budget quotidien) ; critère S10 (partie 7) ; décisions du 2026-09-29
// (10 nouveautés par jour, kana exclus) et du 2026-10-01 (jour local de l'appareil).
//
// Ce qui consomme le budget : un élément qui QUITTE L'ÉTAT NOUVEAU, vers Découvert
// (CONTENT_INTRODUCED) ou directement vers En cours (première réponse évaluée), QUEL QUE SOIT
// L'ÉCRAN. Ne le consomment pas : les kana (leur propre plafond, kanaNewPerSession), les
// déclarations et le test de positionnement.
//
// Le fait « cet élément vient de quitter Nouveau » est établi au moment de l'événement, en
// comparant l'état avant et après ses effets, puis compté dans le résumé du jour (journal,
// 3.8), dans la même transaction. Le budget du jour se lit ensuite dans ce résumé : il ne
// dépend ni de la compaction du détail ni d'un rejeu.
//
// Le budget ne LIMITE que les propositions du mode guidé (4.4) : learning compte, le moteur
// (étape 4) décide. Le plafond (« Nouveautés par jour ») est un réglage de l'utilisateur, reçu
// en argument.

import { computeState, STATES } from './state.js';

// Types d'éléments qui consomment le budget de contenu (4.4) ; les kana en sont exclus.
export const BUDGET_TYPES = Object.freeze(['grammar', 'vocab', 'kanji', 'expression']);

// Événements qui ne consomment jamais le budget (4.4 : « une déclaration de niveau ou un test
// ne consomment pas le budget »).
const NOT_COUNTED = new Set(['KNOWLEDGE_DECLARED', 'KNOWLEDGE_DECLARATION_UNDONE']);

// Toutes les références d'éléments d'un événement, déclarations comprises : c'est la règle
// NOT_COUNTED, et non l'absence de référence, qui écarte les déclarations du budget.
function eventRefs(event) {
  const { payload } = event;
  if (payload.element) return [payload.element];
  if (payload.target) return payload.target;
  if (payload.elements) return payload.elements;
  return [];
}

/**
 * Éléments qui viennent de quitter l'état Nouveau sous l'effet d'un événement d'apprentissage.
 * Kana compris (le résumé les compte à part) ; déclarations exclues.
 *
 * @param {object} before   état d'apprentissage avant l'événement
 * @param {object} after    état d'apprentissage après
 * @param {object} event
 * @returns {{type: string, id: string}[]}
 */
export function elementsLeavingNew(before, after, event) {
  if (NOT_COUNTED.has(event.type)) return [];
  return eventRefs(event).filter(({ id }) =>
    computeState(before.elements[id]) === STATES.NEW &&
    computeState(after.elements[id]) !== STATES.NEW);
}

/**
 * Nouveautés de contenu déjà prises un jour donné, d'après son résumé (kana exclus).
 * @param {object|undefined} summary  résumé du jour (journal.js)
 */
export function newContentCount(summary) {
  if (!summary || !summary.introduced) return 0;
  return BUDGET_TYPES.reduce((n, type) => n + (summary.introduced[type] || 0), 0);
}

/**
 * État du budget pour un jour.
 * @param {object|undefined} summary  résumé du jour
 * @param {number} limit              réglage « Nouveautés par jour »
 * @returns {{ used: number, limit: number, remaining: number }}
 */
export function budgetStatus(summary, limit) {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new TypeError(`budget quotidien invalide : ${String(limit)} (entier ≥ 0 attendu)`);
  }
  const used = newContentCount(summary);
  return { used, limit, remaining: Math.max(0, limit - used) };
}
