// Tests de src/learning/dates.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDate } from '../../src/learning/dates.js';

test('toDate accepte une chaîne ISO ou une Date, et renvoie une copie', () => {
  const d = new Date('2026-10-01T08:00:00Z');
  const copy = toDate(d);
  assert.equal(copy.toISOString(), '2026-10-01T08:00:00.000Z');
  assert.notEqual(copy, d);
  assert.equal(toDate('2026-10-01T08:00:00Z').toISOString(), '2026-10-01T08:00:00.000Z');
});

test('toDate refuse ce qui n\'est pas une date', () => {
  for (const v of [undefined, null, 0, Date.parse('2026-10-01'), 'demain', new Date('x')]) {
    assert.throws(() => toDate(v), TypeError, String(v));
  }
});
