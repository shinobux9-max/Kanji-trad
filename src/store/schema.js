// Ocha v2 — Schéma de la base `ocha` et migrations
//
// Partie 9, 9.2 (« Versionnage ») : le schéma porte un numéro de version dès la v1. Toute
// évolution passe par une migration numérotée, exécutée à l'ouverture de la base
// (`upgradeneeded`). Aujourd'hui, la seule migration est la création initiale.
//
// Les magasins, leurs clés et leurs index sont définis UNE fois, dans contract.js. Ce fichier
// dit comment les créer, et quels enregistrements `meta` existent dès la création ; la
// version en mémoire (memory.js) part des mêmes enregistrements, pour qu'un stockage neuf
// soit identique dans les deux implémentations.

import { STORE_DEFINITIONS, STORE_NAMES } from './contract.js';

export const DB_NAME = 'ocha';
export const SCHEMA_VERSION = 1;

// Enregistrements `meta` posés à la création de la base (9.2 : version du schéma, identifiant
// d'installation ; la date de dernière compaction est écrite par learning).
export function initialMetaRecords(randomUUID = () => globalThis.crypto.randomUUID()) {
  return [
    { key: 'schemaVersion', value: SCHEMA_VERSION },
    { key: 'installationId', value: randomUUID() }
  ];
}

/**
 * Migrations numérotées, dans l'ordre. Chacune reçoit la base en cours de mise à niveau
 * (createObjectStore…) et la transaction de mise à niveau (pour écrire dans `meta`).
 * Ajouter une version : ajouter une entrée { version: n + 1, migrate }, augmenter
 * SCHEMA_VERSION, et mettre `schemaVersion` à jour dans `meta`.
 */
export const MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    description: 'création des 9 magasins (9.2) et des enregistrements meta initiaux',
    migrate(db, transaction, { randomUUID } = {}) {
      for (const name of STORE_NAMES) {
        const { keyPath, indexes } = STORE_DEFINITIONS[name];
        const objectStore = db.createObjectStore(name, { keyPath });
        for (const [indexName, field] of Object.entries(indexes)) {
          objectStore.createIndex(indexName, field, { unique: false });
        }
      }
      const meta = transaction.objectStore('meta');
      for (const record of initialMetaRecords(randomUUID)) meta.put(record);
    }
  })
]);

/**
 * Applique les migrations nécessaires pour passer de oldVersion à newVersion.
 * @returns {number[]} versions appliquées
 */
export function runMigrations(db, transaction, oldVersion, newVersion, options = {}) {
  if (!Number.isInteger(oldVersion) || !Number.isInteger(newVersion) || newVersion < oldVersion) {
    throw new Error(`mise à niveau impossible : de la version ${oldVersion} à ${newVersion}`);
  }
  if (newVersion > SCHEMA_VERSION) {
    throw new Error(`version ${newVersion} inconnue (version du code : ${SCHEMA_VERSION})`);
  }
  const applied = [];
  for (const migration of MIGRATIONS) {
    if (migration.version > oldVersion && migration.version <= newVersion) {
      migration.migrate(db, transaction, options);
      applied.push(migration.version);
    }
  }
  return applied;
}
