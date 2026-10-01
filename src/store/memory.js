// Ocha v2 — Stockage en mémoire
//
// Implémentation du contrat de store/contract.js, sans navigateur, pour les tests
// (partie 9, 9.8). Elle reproduit les garanties d'IndexedDB : transactions tout ou rien sur
// plusieurs magasins, exécution une par une, copies à l'écriture et à la lecture.
//
// Pour tester l'échec d'écriture (9.4), on peut déclencher une panne à la demande :
//   failNextCommit(kind, count)  les `count` prochaines transactions d'écriture échouent
//                                au moment d'enregistrer (rien n'est écrit) ;
//   setUnavailable(true|false)   toute opération échoue tant que le stockage est
//                                indisponible ; les données déjà enregistrées sont conservées.
//
// Un stockage neuf contient, comme la base IndexedDB à sa création, les enregistrements
// `meta` initiaux de schema.js (version du schéma, identifiant d'installation).

import {
  STORE_NAMES, STORAGE_ERROR_KINDS, StorageError,
  assertStoreName, normalizeScope, assertKey, keyOf, indexField, normalizeRange, compareKeys
} from './contract.js';
import { initialMetaRecords } from './schema.js';

const DELETED = Symbol('deleted');

export function createMemoryStore({ randomUUID } = {}) {
  const data = new Map(STORE_NAMES.map((name) => [name, new Map()]));
  for (const record of initialMetaRecords(randomUUID)) data.get('meta').set(record.key, record);
  const pendingFailures = [];
  let unavailable = false;
  let queue = Promise.resolve();

  // File d'exécution : une opération à la fois, dans l'ordre d'appel, qu'elle réussisse
  // ou non.
  function enqueue(job) {
    const run = queue.then(job, job);
    queue = run.catch(() => {});
    return run;
  }

  function run(storeNames, work, { readOnly }) {
    return enqueue(async () => {
      const scope = normalizeScope(storeNames);
      if (typeof work !== 'function') throw new TypeError('transaction : fonction attendue');
      if (unavailable) throw new StorageError('unavailable', 'stockage indisponible');

      const staging = new Map(scope.map((name) => [name, new Map()]));
      let open = true;

      const check = (storeName) => {
        if (!open) throw new TypeError('transaction terminée');
        assertStoreName(storeName);
        if (!staging.has(storeName)) {
          throw new TypeError(`magasin « ${storeName} » hors de la transaction`);
        }
      };

      // Vue de la transaction : données enregistrées, recouvertes par ses propres écritures.
      const view = (storeName) => {
        const merged = new Map(data.get(storeName));
        for (const [key, value] of staging.get(storeName)) {
          if (value === DELETED) merged.delete(key);
          else merged.set(key, value);
        }
        return merged;
      };

      const tx = {
        async get(storeName, key) {
          check(storeName);
          assertKey(key);
          const value = view(storeName).get(key);
          return value === undefined ? undefined : structuredClone(value);
        },
        async getAll(storeName) {
          check(storeName);
          return [...view(storeName).entries()]
            .sort(([a], [b]) => compareKeys(a, b))
            .map(([, value]) => structuredClone(value));
        },
        async getAllByIndex(storeName, indexName, range) {
          check(storeName);
          const field = indexField(storeName, indexName);
          const { lower, upper } = normalizeRange(range);
          return [...view(storeName).entries()]
            .filter(([, value]) => typeof value[field] === 'string' && value[field] !== '')
            .filter(([, value]) => (lower === undefined || value[field] >= lower) &&
                                   (upper === undefined || value[field] <= upper))
            .sort(([ka, a], [kb, b]) => compareKeys(a[field], b[field]) || compareKeys(ka, kb))
            .map(([, value]) => structuredClone(value));
        },
        async put(storeName, value) {
          check(storeName);
          if (readOnly) throw new TypeError('écriture interdite en lecture seule');
          const key = keyOf(storeName, value);
          staging.get(storeName).set(key, structuredClone(value));
        },
        async delete(storeName, key) {
          check(storeName);
          if (readOnly) throw new TypeError('écriture interdite en lecture seule');
          assertKey(key);
          staging.get(storeName).set(key, DELETED);
        }
      };

      let result;
      try {
        result = await work(tx);
      } finally {
        open = false;
      }

      if (readOnly) return result;

      if (pendingFailures.length > 0) {
        const kind = pendingFailures.shift();
        throw new StorageError(kind, `échec simulé de l'écriture (${kind})`);
      }

      // Enregistrement : toutes les écritures ensemble, après la fin de `work`.
      for (const [storeName, writes] of staging) {
        const target = data.get(storeName);
        for (const [key, value] of writes) {
          if (value === DELETED) target.delete(key);
          else target.set(key, value);
        }
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

    // ── Pannes à la demande (tests de 9.4) ──
    failNextCommit(kind = 'quota', count = 1) {
      if (!STORAGE_ERROR_KINDS.includes(kind)) {
        throw new TypeError(`type d'échec de stockage inconnu : ${String(kind)}`);
      }
      if (!Number.isInteger(count) || count < 1) {
        throw new TypeError('nombre d\'échecs invalide : entier ≥ 1 attendu');
      }
      for (let i = 0; i < count; i++) pendingFailures.push(kind);
    },
    setUnavailable(flag) {
      unavailable = Boolean(flag);
    }
  };
}
