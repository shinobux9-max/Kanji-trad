// Tests de src/store/contract.js : définition des magasins (partie 9, 9.2) et erreurs de
// stockage (9.4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORE_DEFINITIONS, STORE_NAMES, STORAGE_ERROR_KINDS, StorageError, isStorageError,
  normalizeScope, keyOf, indexField, normalizeRange, compareKeys
} from '../../src/store/contract.js';

// Partie 9 · 9.2
test('les 9 magasins de la base ocha, avec leur clé', () => {
  assert.deepEqual(
    Object.fromEntries(STORE_NAMES.map((n) => [n, STORE_DEFINITIONS[n].keyPath])),
    {
      elements: 'id', weaknesses: 'id', events: 'id', daily: 'date', activities: 'id',
      sessions: 'id', declarations: 'id', folders: 'id', meta: 'key'
    }
  );
});

// Partie 9 · 9.2
test('seul le magasin events a un index, sur la date', () => {
  for (const name of STORE_NAMES) {
    const expected = name === 'events' ? { at: 'at' } : {};
    assert.deepEqual({ ...STORE_DEFINITIONS[name].indexes }, expected, name);
  }
});

test('les définitions sont immuables', () => {
  assert.ok(Object.isFrozen(STORE_DEFINITIONS));
  assert.ok(Object.isFrozen(STORE_DEFINITIONS.events));
  assert.ok(Object.isFrozen(STORE_DEFINITIONS.events.indexes));
});

// Partie 9 · 9.4
test('StorageError : trois types d\'échec, et rien d\'autre', () => {
  assert.deepEqual([...STORAGE_ERROR_KINDS], ['quota', 'aborted', 'unavailable']);
  for (const kind of STORAGE_ERROR_KINDS) {
    const e = new StorageError(kind);
    assert.equal(e.kind, kind);
    assert.equal(e.name, 'StorageError');
    assert.ok(isStorageError(e));
    assert.ok(e instanceof Error);
  }
  assert.throws(() => new StorageError('autre'), TypeError);
  assert.equal(isStorageError(new Error('x')), false);
});

test('normalizeScope : non vide, magasins connus, sans doublon', () => {
  assert.deepEqual(normalizeScope(['events', 'elements', 'events']), ['events', 'elements']);
  assert.throws(() => normalizeScope([]), TypeError);
  assert.throws(() => normalizeScope('events'), TypeError);
  assert.throws(() => normalizeScope(['events', 'inconnu']), TypeError);
});

test('keyOf lit la clé dans le champ du magasin', () => {
  assert.equal(keyOf('elements', { id: '水' }), '水');
  assert.equal(keyOf('daily', { date: '2026-10-01' }), '2026-10-01');
  assert.equal(keyOf('meta', { key: 'schemaVersion' }), 'schemaVersion');
  assert.throws(() => keyOf('daily', { id: '2026-10-01' }), TypeError);
  assert.throws(() => keyOf('elements', { id: '' }), TypeError);
  assert.throws(() => keyOf('elements', null), TypeError);
  assert.throws(() => keyOf('elements', [{ id: 'a' }]), TypeError);
});

test('indexField et normalizeRange', () => {
  assert.equal(indexField('events', 'at'), 'at');
  assert.throws(() => indexField('events', 'date'), TypeError);
  assert.throws(() => indexField('elements', 'at'), TypeError);
  assert.deepEqual(normalizeRange(), { lower: undefined, upper: undefined });
  assert.deepEqual(normalizeRange({ lower: 'a' }), { lower: 'a', upper: undefined });
  assert.throws(() => normalizeRange({ lower: 3 }), TypeError);
  assert.throws(() => normalizeRange(null), TypeError);
});

test('compareKeys suit l\'ordre des chaînes', () => {
  assert.deepEqual(['水', 'n5_v_2', 'kana_あ', 'n5_g_10'].sort(compareKeys),
    ['kana_あ', 'n5_g_10', 'n5_v_2', '水']);
});
