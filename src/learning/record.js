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
// Le budget quotidien de nouveautés se lit dans le résumé du jour (budget.js ; 4.4).
//
// Échec d'écriture (9.4) : compaction immédiate puis UNE nouvelle tentative ; si elle échoue
// encore, l'événement attend dans une file VOLATILE (en mémoire, perdue si l'app se ferme),
// l'échec devient visible (getWriteFailure, onWriteFailureChange) et tout événement suivant
// rejoint la file, dans l'ordre. retry() réenregistre la file. Aucune autre persistance
// n'est utilisée : elle créerait une seconde source de vérité.

import { GUIDED_CONFIG } from '../config.js';
import { validateEvent } from './events.js';
import { applyEvent, createEmptyLearningState } from './effects.js';
import { addToDailySummary, planCompaction } from './journal.js';
import { elementsLeavingNew, budgetStatus } from './budget.js';
import { localDayKey } from './dates.js';
import { isStorageError } from '../store/contract.js';

// Magasins de l'état en mémoire, chargés au démarrage et écrits par les effets.
const FACT_STORES = ['elements', 'weaknesses', 'declarations', 'activities'];
const SESSION_KEY = 'current';
const LAST_COMPACTION_KEY = 'lastCompaction';

export const RECORD_STATUS = Object.freeze({
  RECORDED: 'recorded',   // enregistré, effets appliqués
  DUPLICATE: 'duplicate', // identifiant déjà enregistré : aucun effet (idempotence)
  REJECTED: 'rejected',   // événement invalide ou incompatible avec l'état : rien n'est écrit
  PENDING: 'pending'      // non enregistré : le stockage a échoué, l'événement attend en
                          // mémoire (9.4) ; l'écran met en pause les exercices évalués
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
  const failureListeners = new Set();
  let failure = null;   // échec d'écriture en cours (9.4), ou null
  const pending = [];   // file volatile : { event, options }, dans l'ordre d'émission

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

  // ── Une tentative d'écriture ──────────────────────────────────────────────
  //
  // Calcule les effets sur l'état en mémoire et les enregistre en UNE transaction. Renvoie
  // { duplicate } ou { rejected } ou { result } ; lève l'erreur du stockage en cas d'échec,
  // sans rien avoir écrit ni modifié en mémoire.
  async function attempt(event, options) {
    const hasSession = Object.hasOwn(options, 'session');
    let rejection = null;

    return store.transaction(
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
        // Résumé du jour de l'événement, tenu à jour à chaque événement (3.8), avec les
        // éléments qu'il a fait quitter l'état Nouveau (budget, 4.4).
        const day = localDayKey(event.at);
        const leftNew = elementsLeavingNew(state, result.state, event);
        await tx.put('daily', addToDailySummary(await tx.get('daily', day), event, leftNew));
        if (hasSession) {
          if (options.session === null || options.session === undefined) {
            await tx.delete('sessions', SESSION_KEY);
          } else {
            await tx.put('sessions', { id: SESSION_KEY, value: options.session });
          }
        }
        return { result };
      }
    ).catch((error) => {
      if (error === rejection) return { rejected: error };
      throw error; // échec du stockage : rien n'est écrit, l'état en mémoire reste inchangé
    });
  }

  function rejectWith(event, problems) {
    warn('Événement rejeté', { event, problems });
    return { status: RECORD_STATUS.REJECTED, problems };
  }

  // Applique en mémoire le résultat d'une tentative réussie (9.3, étape 4) et notifie.
  function settle(event, options, outcome) {
    if (outcome.rejected) return rejectWith(event, [outcome.rejected.message]);
    if (outcome.duplicate) return { status: RECORD_STATUS.DUPLICATE };

    const { result } = outcome;
    for (const name of FACT_STORES) {
      for (const id of result.changed[name]) deepFreeze(result.state[name][id]);
    }
    state = deepFreeze(result.state);
    if (Object.hasOwn(options, 'session')) {
      session = options.session == null ? null : deepFreeze(structuredClone(options.session));
    }

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

  // ── Échec d'écriture (9.4) ────────────────────────────────────────────────

  function failureSnapshot() {
    return failure && Object.freeze({ ...failure, pendingCount: pending.length });
  }

  function notifyFailure() {
    const snapshot = failureSnapshot();
    for (const listener of failureListeners) {
      try {
        listener(snapshot);
      } catch (error) {
        warn('Erreur d\'un abonné', error);
      }
    }
  }

  function setFailure(error) {
    failure = {
      since: failure ? failure.since : now().toISOString(),
      kind: error.kind,
      message: error.message
    };
    notifyFailure();
  }

  function keepPending(event, options, error) {
    pending.push({ event, options });
    setFailure(error);
    return { status: RECORD_STATUS.PENDING, failure: failureSnapshot() };
  }

  async function process(event, options) {
    requireLoaded();

    const problems = validateEvent(event, { elementExists });
    if (problems.length > 0) return rejectWith(event, problems);

    // Pendant un échec, rien ne doit passer devant les événements en attente : le nouvel
    // événement les rejoint, dans l'ordre (9.4).
    if (failure) {
      pending.push({ event, options });
      notifyFailure();
      return { status: RECORD_STATUS.PENDING, failure: failureSnapshot() };
    }

    let outcome;
    try {
      outcome = await attempt(event, options);
    } catch (error) {
      if (!isStorageError(error)) throw error;
      // 9.4, étape 2 : compaction immédiate du journal, puis UNE nouvelle tentative.
      try {
        await compact();
      } catch (compactionError) {
        warn('Compaction du journal impossible', compactionError);
      }
      try {
        outcome = await attempt(event, options);
      } catch (secondError) {
        if (!isStorageError(secondError)) throw secondError;
        // 9.4, étape 4 : l'événement attend en mémoire ; l'échec devient visible.
        return keepPending(event, options, secondError);
      }
    }
    return settle(event, options, outcome);
  }

  // 9.4, étape 6 : « Réessayer ». La file est enregistrée dans l'ordre ; l'idempotence évite
  // les doublons. On s'arrête au premier échec : le reste attend.
  async function retryPending() {
    requireLoaded();
    if (!failure) return { status: 'ok', recorded: 0, remaining: 0 };
    let recorded = 0;
    while (pending.length > 0) {
      const { event, options } = pending[0];
      let outcome;
      try {
        outcome = await attempt(event, options);
      } catch (error) {
        if (!isStorageError(error)) throw error;
        setFailure(error);
        return { status: 'still_failing', recorded, remaining: pending.length };
      }
      pending.shift();
      if (settle(event, options, outcome).status === RECORD_STATUS.RECORDED) recorded += 1;
    }
    failure = null;
    notifyFailure();
    return { status: 'recovered', recorded, remaining: 0 };
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
     * @returns {Promise<{status: string, problems?: string[], changed?: object,
     *          failure?: object}>}  `recorded` seulement si l'événement est enregistré ;
     *          `pending` s'il attend en mémoire après un échec du stockage (9.4)
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

    /**
     * Budget de nouveautés du jour (jour local de `now`), à revérifier par le moteur à la
     * composition, à la reprise et avant chaque bloc de nouveauté (4.4, 4.7 ; S10).
     *
     * @param {number} dailyNewBudget  réglage « Nouveautés par jour » de l'utilisateur
     * @returns {Promise<{ date: string, used: number, limit: number, remaining: number }>}
     */
    getNewContentBudget(dailyNewBudget) {
      return enqueue(async () => {
        requireLoaded();
        const date = localDayKey(now());
        return { date, ...budgetStatus(await store.get('daily', date), dailyNewBudget) };
      });
    },

    /**
     * Échec d'écriture en cours (9.4), ou null :
     * { since, kind, message, pendingCount } — kind : 'quota', 'aborted' ou 'unavailable'.
     */
    getWriteFailure() {
      return failureSnapshot();
    },

    /**
     * S'abonne aux changements de l'échec d'écriture (apparition, nouvel événement en
     * attente, disparition : null). Renvoie la fonction de désabonnement.
     */
    onWriteFailureChange(listener) {
      failureListeners.add(listener);
      return () => failureListeners.delete(listener);
    },

    /**
     * Réessaie d'enregistrer les événements en attente, dans l'ordre (bouton « Réessayer »).
     * @returns {Promise<{status: 'ok'|'recovered'|'still_failing', recorded: number,
     *          remaining: number}>}
     */
    retry() {
      return enqueue(() => retryPending());
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
