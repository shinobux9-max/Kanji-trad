// Tests de src/store/memory.js : suite de contrat commune (tests/store/contract-cases.js),
// puis comportements propres aux pannes simulées (partie 9, 9.4 et 9.8).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../../src/store/memory.js';
import { StorageError } from '../../src/store/contract.js';
import { STORE_CONTRACT_CASES } from './contract-cases.js';

function makeHarness() {
  const store = createMemoryStore();
  return {
    store,
    canFail: true,
    failNextCommit: (kind) => store.failNextCommit(kind),
    setUnavailable: (flag) => store.setUnavailable(flag)
  };
}

describe('contrat de stockage — version en mémoire', () => {
  for (const c of STORE_CONTRACT_CASES) {
    test(c.name, () => c.run(makeHarness()));
  }
});

describe('pannes simulées', () => {
  test('failNextCommit(kind, count) fait échouer exactement `count` écritures', async () => {
    const store = createMemoryStore();
    store.failNextCommit('quota', 2);
    const write = (id) => store.transaction(['elements'], (tx) => tx.put('elements', { id }));
    await assert.rejects(write('a'), (e) => e instanceof StorageError && e.kind === 'quota');
    await assert.rejects(write('b'), (e) => e instanceof StorageError && e.kind === 'quota');
    await write('c');
    assert.deepEqual((await store.getAll('elements')).map((r) => r.id), ['c']);
  });

  test('une lecture ne consomme pas une panne d\'écriture prévue', async () => {
    const store = createMemoryStore();
    store.failNextCommit('aborted');
    assert.equal(await store.get('elements', 'a'), undefined);
    await assert.rejects(store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a' })),
      (e) => e instanceof StorageError && e.kind === 'aborted');
  });

  test('une erreur de `work` ne consomme pas une panne prévue', async () => {
    const store = createMemoryStore();
    store.failNextCommit('quota');
    await assert.rejects(store.transaction(['elements'], () => { throw new Error('boom'); }), /boom/);
    await assert.rejects(store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a' })),
      (e) => e instanceof StorageError && e.kind === 'quota');
  });

  test('arguments de panne invalides', () => {
    const store = createMemoryStore();
    assert.throws(() => store.failNextCommit('autre'), TypeError);
    assert.throws(() => store.failNextCommit('quota', 0), TypeError);
  });
});

test('deux stockages en mémoire sont indépendants', async () => {
  const a = createMemoryStore();
  const b = createMemoryStore();
  await a.transaction(['elements'], (tx) => tx.put('elements', { id: 'x' }));
  assert.deepEqual(await b.getAll('elements'), []);
});
