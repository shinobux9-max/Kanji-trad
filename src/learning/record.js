// Ocha v2 — Traitement central : recordLearningEvent
//
// Partie 3, 3.9 ; partie 9, 9.3 et 9.5. Le SEUL chemin par lequel l'état d'apprentissage
// change : aucun autre module n'écrit le suivi, le SRS, les faiblesses, les déclarations,
// l'avancement ni la session en cours.
//
//   recordLearningEvent(event, { session })
//     1. valider     events.js (type, contexte, charge utile, éléments existants)
//     2. calculer    effects.js, sur l'état en mémoire, sans le modifier
//     3. persister   UNE transaction : événement + faits modifiés + résumé du jour + session,
//                    ensemble ; un événement déjà enregistré (même identifiant) n'a aucun effet
//     4. réussite    le nouvel état remplace l'état en mémoire ; les abonnés sont notifiés
//        échec       l'état en mémoire est inchangé
//
// Les événements sont traités un par un, dans l'ordre d'appel (file interne).
//
// Le journal est compacté une fois par jour, au chargement (journal.js ; 3.8).
//
// Ce fichier ne traite pas encore : le budget (tâche 10), la reprise après un échec
// d'écriture (tâche 11). En cas d'échec du stockage, la promesse est rejetée avec l'erreur du
// stockage.

import { GUIDED_CONFIG } from '../config.js';
import { validateEvent } from './events.js';
import { applyEvent, createEmptyLearningState } from './effects.js';
import { addToDailySummary, planCompaction } from './journal.js';
import { localDayKey } from './dates.js';

// Magasins de l'état en mémoire, chargés au démarrage et écrits par les effets.
const FACT_STORES = ['elements', 'weaknesses', 'declarations', 'activities'];
const SESSION_KEY = 'current';
const LAST_COMPACTION_KEY = 'lastCompaction';

export const RECORD_STATUS = Object.freeze({
  RECORDED: 'recorded',   // enregistré, effets appliqués
  DUPLICATE: 'duplicate', // identifiant déjà enregistré : aucun effet (idempotence)
  REJECTED: 'rejected'    // événement invalide ou incompatible avec l'état : rien n'est écrit
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * Crée le traitement central, branché sur un stockage (store/contract.js).
 *
 * @param {object} options
 * @param {object} options.store             stockage (IndexedDB dans l'app, mémoire en test)
 * @param {object} [options.config]          configuration (GUIDED_CONFIG par défaut)
 * @param {(ref) => boolean} [options.elementExists]       éléments existants (contenu, étape 2)
 * @param {(level) => object[]} [options.elementsOfScope]  éléments d'un niveau (contenu)
 * @param {(message: string, detail: any) => void} [options.warn]  signalement d'un événement
 *                                           rejeté (console.warn par défaut, 3.9)
 * @param {() => Date} [options.now]         horloge, pour la compaction seulement (les effets
 *                                           d'un événement utilisent sa date `at`)
 */
export function createLearning({
  store,
  config = GUIDED_CONFIG,
  elementExists,
  elementsOfScope,
  warn = (message, detail) => console.warn(message, detail),
  now = () => new Date()
}) {
  if (!store) throw new TypeError('createLearning : stockage requis');

  let state = null;     // état d'apprentissage en mémoire (gelé)
  let session = null;   // session en cours, opaque pour learning (étape 4)
  let queue = Promise.resolve();
  const listeners = new Set();

  // File interne : un événement à la fois, dans l'ordre d'appel (9.3).
  function enqueue(job) {
    const run = queue.then(job, job);
    queue = run.catch(() => {});
    return run;
  }

  function requireLoaded() {
    if (!state) throw new Error('état d\'apprentissage non chargé : appeler load() d\'abord');
  }

  // Compaction du journal (3.8) : une transaction sur le détail et la date de compaction.
  async function compact() {
    const at = now();
    return store.transaction(['events', 'meta'], async (tx) => {
      const events = await tx.getAllByIndex('events', 'at');
      const toDelete = planCompaction(events, at, config);
      for (const id of toDelete) await tx.delete('events', id);
      await tx.put('meta', { key: LAST_COMPACTION_KEY, value: at.toISOString() });
      return { deleted: toDelete.length };
    });
  }

  /**
   * Charge l'état depuis le stockage (démarrage, 9.5), puis compacte le journal si ce n'est
   * pas encore fait aujourd'hui. Un échec de la compaction est signalé sans bloquer le
   * chargement : l'état ne dépend pas du journal.
   */
  function load() {
    return enqueue(async () => {
      const loaded = createEmptyLearningState();
      for (const name of FACT_STORES) {
        for (const record of await store.getAll(name)) loaded[name][record.id] = record;
      }
      const current = await store.get('sessions', SESSION_KEY);
      state = deepFreeze(loaded);
      session = current ? deepFreeze(current.value) : null;

      const last = await store.get('meta', LAST_COMPACTION_KEY);
      if (!last || localDayKey(last.value) !== localDayKey(now())) {
        try {
          await compact();
        } catch (error) {
          warn('Compaction du journal impossible', error);
        }
      }
    });
  }

  async function process(event, options) {
    requireLoaded();

    const problems = validateEvent(event, { elementExists });
    if (problems.length > 0) {
      warn('Événement rejeté', { event, problems });
      return { status: RECORD_STATUS.REJECTED, problems };
    }

    const hasSession = Object.hasOwn(options, 'session');
    let rejection = null;

    const outcome = await store.transaction(
      ['events', ...FACT_STORES, 'daily', 'sessions'],
      async (tx) => {
        // Idempotence : un même événement n'a d'effet qu'une fois (9.3).
        if (await tx.get('events', event.id)) return { duplicate: true };

        let result;
        try {
          result = applyEvent(state, event, config, { elementsOfScope });
        } catch (error) {
          // Événement incompatible avec l'état (déclaration inconnue…) : rien n'est écrit.
          rejection = error;
          throw error;
        }

        await tx.put('events', event);
        for (const name of FACT_STORES) {
          for (const id of result.changed[name]) {
            const record = result.state[name][id];
            if (record === undefined) await tx.delete(name, id);
            else await tx.put(name, record);
          }
        }
        // Résumé du jour de l'événement, tenu à jour à chaque événement (3.8).
        const day = localDayKey(event.at);
        await tx.put('daily', addToDailySummary(await tx.get('daily', day), event));
        if (hasSession) {
          if (options.session === null || options.session === undefined) {
            await tx.delete('sessions', SESSION_KEY);
          } else {
            await tx.put('sessions', { id: SESSION_KEY, value: options.session });
          }
        }
        return { duplicate: false, result };
      }
    ).catch((error) => {
      if (error === rejection) return { rejected: error };
      throw error; // échec du stockage : l'état en mémoire reste inchangé
    });

    if (outcome.rejected) {
      const problemsFromState = [outcome.rejected.message];
      warn('Événement rejeté', { event, problems: problemsFromState });
      return { status: RECORD_STATUS.REJECTED, problems: problemsFromState };
    }
    if (outcome.duplicate) return { status: RECORD_STATUS.DUPLICATE };

    // Réussite : le nouvel état devient l'état en mémoire (9.3, étape 4).
    const { result } = outcome;
    for (const name of FACT_STORES) {
      for (const id of result.changed[name]) deepFreeze(result.state[name][id]);
    }
    state = deepFreeze(result.state);
    if (hasSession) session = options.session == null ? null : deepFreeze(structuredClone(options.session));

    const notice = { event, changed: result.changed };
    for (const listener of listeners) {
      try {
        listener(notice);
      } catch (error) {
        warn('Erreur d\'un abonné', error);
      }
    }
    return { status: RECORD_STATUS.RECORDED, changed: result.changed };
  }

  return {
    load,

    /**
     * Enregistre un événement pédagogique. Toujours attendre (await) la promesse avant toute
     * transition d'interface qui dépend de son succès (REGLES-CONSTRUCTION.md, §6).
     *
     * @param {object} event
     * @param {object} [options]
     * @param {object|null} [options.session]  session en cours à enregistrer dans la même
     *        transaction ; null pour l'effacer ; absent pour ne pas y toucher
     * @returns {Promise<{status: string, problems?: string[], changed?: object}>}
     *          rejetée avec l'erreur du stockage si l'écriture échoue
     */
    recordLearningEvent(event, options = {}) {
      return enqueue(() => process(event, options));
    },

    /** Instantané en lecture seule de l'état d'apprentissage (gelé). */
    getSnapshot() {
      requireLoaded();
      return state;
    },

    /**
     * Compacte le journal maintenant (3.8). Utilisée aussi, à la tâche 11, pour libérer de
     * la place après un échec d'écriture.
     * @returns {Promise<{deleted: number}>}
     */
    compactJournal() {
      return enqueue(() => { requireLoaded(); return compact(); });
    },

    /**
     * Résumés quotidiens enregistrés, du plus ancien au plus récent (régularité,
     * statistiques). Lecture seule.
     * @returns {Promise<object[]>}
     */
    getDailySummaries() {
      return enqueue(() => { requireLoaded(); return store.getAll('daily'); });
    },

    /** Session en cours enregistrée, ou null. */
    getSession() {
      requireLoaded();
      return session;
    },

    /**
     * S'abonne aux événements enregistrés. Renvoie la fonction de désabonnement.
     * @param {(notice: {event: object, changed: object}) => void} listener
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
