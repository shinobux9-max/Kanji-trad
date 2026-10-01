// Tests de src/store/indexeddb.js exécutables dans Node, sans IndexedDB : traduction des
// erreurs et absence d'IndexedDB. Le contrat complet est vérifié dans le navigateur
// (tests/browser/store-contract.html), avec la même suite que la version en mémoire.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openIndexedDbStore, toStorageError } from '../../src/store/indexeddb.js';
import { StorageError } from '../../src/store/contract.js';

const domError = (name) => Object.assign(new Error(name), { name });

// Partie 9 · 9.4
test('erreurs d\'IndexedDB traduites en StorageError : quota, indisponible, annulée', () => {
  assert.equal(toStorageError(domError('QuotaExceededError')).kind, 'quota');
  for (const name of ['InvalidStateError', 'UnknownError', 'NotFoundError']) {
    assert.equal(toStorageError(domError(name)).kind, 'unavailable', name);
  }
  for (const name of ['AbortError', 'TransactionInactiveError', 'ConstraintError']) {
    assert.equal(toStorageError(domError(name)).kind, 'aborted', name);
  }
  assert.equal(toStorageError(null).kind, 'aborted');
  const original = domError('QuotaExceededError');
  assert.equal(toStorageError(original).cause, original);
  const already = new StorageError('unavailable');
  assert.equal(toStorageError(already), already);
});

test('sans IndexedDB : ouverture refusée avec « unavailable »', async () => {
  await assert.rejects(openIndexedDbStore({ indexedDB: null }),
    (e) => e instanceof StorageError && e.kind === 'unavailable');
});

test('ouverture en échec : « unavailable »', async () => {
  const failing = { open() {
    const req = {};
    queueMicrotask(() => { req.error = domError('UnknownError'); req.onerror(); });
    return req;
  } };
  await assert.rejects(openIndexedDbStore({ indexedDB: failing }),
    (e) => e instanceof StorageError && e.kind === 'unavailable');
});
