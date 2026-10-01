// Ocha v2 — Surface publique de la couche learning
//
// Les autres couches (engine, exercises, ui, app.js) n'importent learning QUE par ce fichier
// (décision du 2026-10-01, critère C2 de la partie 7). Il expose :
//   - le traitement central (createLearning → recordLearningEvent), seul chemin d'écriture ;
//   - ce qui sert à construire un événement valide ;
//   - des fonctions de LECTURE (calcul d'état, d'avancement, de priorité, de retard).
//
// Il n'expose volontairement AUCUNE fonction qui modifie des faits hors du traitement
// central : ni gradeReview, ni applyWeaknessFailure / applyWeaknessSuccess, ni applyEvent.

export { createLearning, RECORD_STATUS } from './record.js';
export { createEventId, validateEvent, EVENT_TYPES, CONTEXT_VALUES, REF_TYPES } from './events.js';
export {
  computeState, STATES, STATE_ORDER, computeActivityStatus, ACTIVITY_STATUSES
} from './state.js';
export { isWeaknessActive, computeWeaknessPriority } from './weakness.js';
export { getDaysOverdue, QUALITY } from './srs.js';
export { ORIGINS, DECLARATION_SCOPE_ORDER } from './effects.js';
