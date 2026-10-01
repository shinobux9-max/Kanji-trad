// Ocha v2 — Stockage IndexedDB
//
// Implémentation du contrat de store/contract.js pour l'app (partie 9, 9.2 à 9.4). Elle doit
// se comporter EXACTEMENT comme la version en mémoire (memory.js) : même suite de contrat
// (tests/store/contract-cases.js), jouée dans le navigateur (tests/browser/).
//
// Pour garder une seule sémantique :
//   - les erreurs d'usage sont détectées par les vérifications communes de contract.js,
//     AVANT tout appel à IndexedDB (mêmes TypeError que la version en mémoire) ;
//   - toutes les opérations passent par une file : une à la fois, dans l'ordre d'appel ;
//   - les échecs du stockage deviennent des StorageError ('quota', 'aborted', 'unavailable').
//
// Rappel du contrat : `work` n'attend que les opérations de `tx`. Attendre autre chose ferait
// clore la transaction par IndexedDB avant la fin.

import {
  StorageError, assertStoreName, normalizeScope, assertKey, keyOf, indexField, normalizeRange
} from './contract.js';
import { DB_NAME, SCHEMA_VERSION, runMigrations } from './schema.js';

// Erreur DOM d'IndexedDB → StorageError (9.4).
export function toStorageError(error) {
  if (error instanceof StorageError) return error;
  const name = error && error.name;
  if (name === 'QuotaExceededError') return new StorageError('quota', 'quota de stockage dépassé', { cause: error });
  if (name === 'InvalidStateError' || name === 'UnknownError' || name === 'NotFoundError') {
    return new StorageError('unavailable', 'stockage indisponible', { cause: error });
  }
  return new StorageError('aborted', `transaction annulée par le stockage${name ? ` (${name})` : ''}`, { cause: error });
}

const request = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/**
 * Ouvre (ou crée) la base et renvoie un stockage conforme au contrat.
 *
 * @param {object} [options]
 * @param {IDBFactory} [options.indexedDB]  globalThis.indexedDB par défaut
 * @param {string} [options.name]           'ocha' par défaut (autre nom pour les tests)
 * @param {() => string} [options.randomUUID]  identifiant d'installation à la création
 * @returns {Promise<object>}  stockage ; plus `close()` (non prévue par le contrat)
 */
export async function openIndexedDbStore({
  indexedDB = globalThis.indexedDB, name = DB_NAME, randomUUID
} = {}) {
  if (!indexedDB) throw new StorageError('unavailable', 'IndexedDB non disponible');

  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const open = indexedDB.open(name, SCHEMA_VERSION);
      open.onupgradeneeded = (event) => {
        try {
          runMigrations(open.result, open.transaction, event.oldVersion, event.newVersion ?? SCHEMA_VERSION,
            { randomUUID });
        } catch (error) {
          open.transaction.abort();
          reject(error);
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new StorageError('unavailable', 'base bloquée par un autre onglet'));
    });
  } catch (error) {
    throw error instanceof StorageError ? error : new StorageError('unavailable', 'ouverture impossible', { cause: error });
  }

  let closed = false;
  // Une autre page veut mettre la base à niveau : on la libère ; les opérations suivantes
  // échoueront avec « unavailable » (rechargement nécessaire).
  db.onversionchange = () => { db.close(); closed = true; };

  let queue = Promise.resolve();
  function enqueue(job) {
    const run = queue.then(job, job);
    queue = run.catch(() => {});
    return run;
  }

  function run(storeNames, work, { readOnly }) {
    return enqueue(async () => {
      const scope = normalizeScope(storeNames);
      if (typeof work !== 'function') throw new TypeError('transaction : fonction attendue');
      if (closed) throw new StorageError('unavailable', 'stockage fermé');

      let idbTx;
      try {
        idbTx = db.transaction(scope, readOnly ? 'readonly' : 'readwrite');
      } catch (error) {
        throw toStorageError(error);
      }
      const done = new Promise((resolve, reject) => {
        idbTx.oncomplete = () => resolve();
        // Une requête en erreur annule la transaction (action par défaut d'IndexedDB, à ne
        // surtout pas empêcher) : on le constate ici.
        idbTx.onabort = () => reject(idbTx.error);
      });
      done.catch(() => {}); // évite un rejet non suivi si `work` échoue d'abord

      let open = true;
      const check = (storeName) => {
        if (!open) throw new TypeError('transaction terminée');
        assertStoreName(storeName);
        if (!scope.includes(storeName)) {
          throw new TypeError(`magasin « ${storeName} » hors de la transaction`);
        }
        return idbTx.objectStore(storeName);
      };

      const tx = {
        async get(storeName, key) {
          const os = check(storeName);
          assertKey(key);
          return request(os.get(key));
        },
        async getAll(storeName) {
          return request(check(storeName).getAll());
        },
        async getAllByIndex(storeName, indexName, range) {
          const os = check(storeName);
          const field = indexField(storeName, indexName);
          const { lower, upper } = normalizeRange(range);
          const KeyRange = globalThis.IDBKeyRange;
          const keyRange = lower !== undefined && upper !== undefined ? KeyRange.bound(lower, upper)
            : lower !== undefined ? KeyRange.lowerBound(lower)
              : upper !== undefined ? KeyRange.upperBound(upper) : undefined;
          const rows = await request(os.index(indexName).getAll(keyRange));
          // Même règle que la version en mémoire : seules les valeurs d'index textuelles non
          // vides comptent.
          return rows.filter((row) => typeof row[field] === 'string' && row[field] !== '');
        },
        async put(storeName, value) {
          const os = check(storeName);
          if (readOnly) throw new TypeError('écriture interdite en lecture seule');
          keyOf(storeName, value);
          await request(os.put(value));
        },
        async delete(storeName, key) {
          const os = check(storeName);
          if (readOnly) throw new TypeError('écriture interdite en lecture seule');
          assertKey(key);
          await request(os.delete(key));
        }
      };

      let result;
      try {
        result = await work(tx);
      } catch (error) {
        open = false;
        try { idbTx.abort(); } catch { /* déjà terminée */ }
        await done.catch(() => {});
        throw error; // erreur de `work` : la transaction est annulée, rien n'est écrit
      }
      open = false;

      try {
        await done;
      } catch (error) {
        throw toStorageError(error); // échec du stockage à l'enregistrement
      }
      return result;
    });
  }

  return {
    get: (storeName, key) => run([storeName], (tx) => tx.get(storeName, key), { readOnly: true }),
    getAll: (storeName) => run([storeName], (tx) => tx.getAll(storeName), { readOnly: true }),
    getAllByIndex: (storeName, indexName, range) =>
      run([storeName], (tx) => tx.getAllByIndex(storeName, indexName, range), { readOnly: true }),
    transaction: (storeNames, work) => run(storeNames, work, { readOnly: false }),

    /** Ferme la base (tests, changement de version). */
    close() {
      closed = true;
      db.close();
    }
  };
}
