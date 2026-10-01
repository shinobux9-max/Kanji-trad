// Ocha v2 — Contrat de stockage de l'état pédagogique
//
// Partie 9 · 9.2 (magasins de la base `ocha`), 9.3 (atomicité), 9.4 (échec d'écriture), 9.8
// (deux implémentations : mémoire pour les tests, IndexedDB pour l'app).
//
// Ce fichier définit CE QUE toute implémentation de stockage doit faire, et fournit les
// vérifications communes, pour que la version en mémoire (store/memory.js) et la version
// IndexedDB (tâche 12) se comportent à l'identique. Il ne contient aucune logique
// pédagogique : le stockage range des enregistrements, il ne les interprète pas.
//
// ── Interface d'un stockage ─────────────────────────────────────────────────
//
// Toutes les méthodes renvoient une promesse.
//
//   get(storeName, key)                     → l'enregistrement, ou undefined
//   getAll(storeName)                       → tous les enregistrements, triés par clé
//   getAllByIndex(storeName, index, range)  → enregistrements dont la valeur d'index est
//                                             dans range = { lower?, upper? } (bornes
//                                             incluses), triés par valeur d'index puis par clé
//   transaction(storeNames, work)           → résultat de work(tx)
//
// `tx` offre get, getAll, getAllByIndex, put(storeName, value) et delete(storeName, key),
// limités aux magasins déclarés dans storeNames.
//
// Garanties (9.3) :
//   - tout ou rien : si `work` lève une erreur, ou si l'écriture finale échoue, AUCUNE
//     écriture de la transaction n'est conservée, dans aucun magasin ;
//   - une transaction voit ses propres écritures (y compris les suppressions) ;
//   - les transactions s'exécutent une par une, dans l'ordre d'appel ;
//   - les enregistrements sont copiés à l'écriture et à la lecture : modifier un objet lu
//     ou écrit ne modifie jamais le contenu stocké.
//
// Règle d'usage : `work` n'attend (await) que les opérations de `tx`. Attendre autre chose
// (réseau, minuterie) ferait clore la transaction par IndexedDB avant la fin.
//
// Erreurs :
//   - mauvaise utilisation (magasin inconnu ou hors de la transaction, clé absente ou
//     invalide, valeur non copiable) : TypeError ou erreur de copie, la transaction est
//     annulée ;
//   - échec du stockage lui-même : StorageError, avec un `kind` (9.4) :
//       'quota'        quota dépassé
//       'aborted'      transaction annulée par le stockage
//       'unavailable'  stockage indisponible
//
// Les clés sont des chaînes non vides.

// ── Magasins (9.2) ──────────────────────────────────────────────────────────
//
// keyPath : champ de l'enregistrement qui porte sa clé.
// indexes : nom de l'index → champ indexé.

export const STORE_DEFINITIONS = Object.freeze({
  elements:     Object.freeze({ keyPath: 'id',   indexes: Object.freeze({}) }),          // identifiant d'élément
  weaknesses:   Object.freeze({ keyPath: 'id',   indexes: Object.freeze({}) }),          // identifiant d'élément
  events:       Object.freeze({ keyPath: 'id',   indexes: Object.freeze({ at: 'at' }) }), // identifiant d'événement ; index sur la date
  daily:        Object.freeze({ keyPath: 'date', indexes: Object.freeze({}) }),          // AAAA-MM-JJ
  activities:   Object.freeze({ keyPath: 'id',   indexes: Object.freeze({}) }),          // identifiant d'activité
  sessions:     Object.freeze({ keyPath: 'id',   indexes: Object.freeze({}) }),          // 'current'
  declarations: Object.freeze({ keyPath: 'id',   indexes: Object.freeze({}) }),          // identifiant de déclaration
  folders:      Object.freeze({ keyPath: 'id',   indexes: Object.freeze({}) }),          // identifiant de dossier
  meta:         Object.freeze({ keyPath: 'key',  indexes: Object.freeze({}) })           // clé
});

export const STORE_NAMES = Object.freeze(Object.keys(STORE_DEFINITIONS));

// ── Erreurs du stockage (9.4) ───────────────────────────────────────────────

export const STORAGE_ERROR_KINDS = Object.freeze(['quota', 'aborted', 'unavailable']);

export class StorageError extends Error {
  constructor(kind, message, options = undefined) {
    if (!STORAGE_ERROR_KINDS.includes(kind)) {
      throw new TypeError(`type d'échec de stockage inconnu : ${String(kind)}`);
    }
    super(message || `échec du stockage (${kind})`, options);
    this.name = 'StorageError';
    this.kind = kind;
  }
}

export function isStorageError(error) {
  return error instanceof StorageError;
}

// ── Vérifications communes aux implémentations ──────────────────────────────

export function assertStoreName(storeName) {
  if (!Object.hasOwn(STORE_DEFINITIONS, storeName)) {
    throw new TypeError(`magasin inconnu : ${String(storeName)}`);
  }
}

// Liste des magasins d'une transaction : non vide, connus, sans doublon.
export function normalizeScope(storeNames) {
  if (!Array.isArray(storeNames) || storeNames.length === 0) {
    throw new TypeError('une transaction doit déclarer au moins un magasin');
  }
  storeNames.forEach(assertStoreName);
  return [...new Set(storeNames)];
}

export function assertKey(key) {
  if (typeof key !== 'string' || key === '') {
    throw new TypeError(`clé invalide : ${String(key)} (chaîne non vide attendue)`);
  }
}

// Clé d'un enregistrement à écrire, lue dans son champ keyPath.
export function keyOf(storeName, value) {
  assertStoreName(storeName);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`enregistrement invalide pour « ${storeName} » : objet attendu`);
  }
  const { keyPath } = STORE_DEFINITIONS[storeName];
  const key = value[keyPath];
  if (typeof key !== 'string' || key === '') {
    throw new TypeError(`enregistrement de « ${storeName} » sans clé « ${keyPath} » valide`);
  }
  return key;
}

// Champ indexé d'un index déclaré.
export function indexField(storeName, indexName) {
  assertStoreName(storeName);
  const { indexes } = STORE_DEFINITIONS[storeName];
  if (!Object.hasOwn(indexes, indexName)) {
    throw new TypeError(`index inconnu « ${String(indexName)} » sur « ${storeName} »`);
  }
  return indexes[indexName];
}

export function normalizeRange(range = {}) {
  if (range === null || typeof range !== 'object') {
    throw new TypeError('intervalle invalide : objet { lower, upper } attendu');
  }
  const { lower, upper } = range;
  if (lower !== undefined) assertKey(lower);
  if (upper !== undefined) assertKey(upper);
  return { lower, upper };
}

// Ordre des clés : celui d'IndexedDB pour des chaînes (unités de code UTF-16).
export function compareKeys(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
