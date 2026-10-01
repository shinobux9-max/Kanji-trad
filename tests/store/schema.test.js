// Tests de src/store/schema.js : schéma v1 et migrations numérotées (partie 9, 9.2).
// Les migrations sont jouées sur une fausse base qui enregistre les appels ; la création
// réelle dans IndexedDB est vérifiée dans le navigateur (tests/browser/).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DB_NAME, SCHEMA_VERSION, MIGRATIONS, runMigrations, initialMetaRecords } from '../../src/store/schema.js';
import { STORE_DEFINITIONS, STORE_NAMES } from '../../src/store/contract.js';

function fakeDatabase() {
  const stores = {};
  const db = {
    createObjectStore(name, { keyPath }) {
      if (stores[name]) throw new Error(`magasin ${name} déjà créé`);
      stores[name] = { keyPath, indexes: {}, records: [] };
      return { createIndex(indexName, field, opts) { stores[name].indexes[indexName] = { field, ...opts }; } };
    }
  };
  const transaction = { objectStore: (name) => ({ put: (r) => stores[name].records.push(r) }) };
  return { db, transaction, stores };
}

test('base « ocha », schéma en version 1, migrations numérotées 1, 2, 3… sans trou', () => {
  assert.equal(DB_NAME, 'ocha');
  assert.equal(SCHEMA_VERSION, 1);
  assert.deepEqual(MIGRATIONS.map((m) => m.version), Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1));
});

// Partie 9 · 9.2
test('création (0 → 1) : les 9 magasins, leurs clés, l\'index non unique sur la date des événements', () => {
  const { db, transaction, stores } = fakeDatabase();
  assert.deepEqual(runMigrations(db, transaction, 0, 1, { randomUUID: () => 'inst-1' }), [1]);
  assert.deepEqual(Object.keys(stores).sort(), [...STORE_NAMES].sort());
  for (const name of STORE_NAMES) assert.equal(stores[name].keyPath, STORE_DEFINITIONS[name].keyPath, name);
  assert.deepEqual(stores.events.indexes, { at: { field: 'at', unique: false } });
  for (const name of STORE_NAMES.filter((n) => n !== 'events')) assert.deepEqual(stores[name].indexes, {}, name);
});

test('création : meta reçoit la version du schéma et l\'identifiant d\'installation', () => {
  const { db, transaction, stores } = fakeDatabase();
  runMigrations(db, transaction, 0, 1, { randomUUID: () => 'inst-1' });
  assert.deepEqual(stores.meta.records, [{ key: 'schemaVersion', value: 1 }, { key: 'installationId', value: 'inst-1' }]);
  assert.deepEqual(initialMetaRecords(() => 'x'), [{ key: 'schemaVersion', value: 1 }, { key: 'installationId', value: 'x' }]);
  assert.match(initialMetaRecords()[1].value, /^[0-9a-f-]{36}$/);
});

test('aucune migration quand la base est déjà à jour', () => {
  const { db, transaction, stores } = fakeDatabase();
  assert.deepEqual(runMigrations(db, transaction, 1, 1), []);
  assert.deepEqual(stores, {});
});

test('mise à niveau impossible : retour en arrière, version inconnue du code', () => {
  const { db, transaction } = fakeDatabase();
  assert.throws(() => runMigrations(db, transaction, 2, 1), /impossible/);
  assert.throws(() => runMigrations(db, transaction, 0, SCHEMA_VERSION + 1), /inconnue/);
});
