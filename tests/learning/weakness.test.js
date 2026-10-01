// Tests de src/learning/weakness.js : faiblesses progressives (partie 3, 3.5) et priorité
// reprise de l'ancienne app.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWeaknessFailure, applyWeaknessSuccess, isWeaknessActive, computeWeaknessPriority
} from '../../src/learning/weakness.js';
import { GUIDED_CONFIG } from '../../src/config.js';

const day = (n) => new Date(Date.UTC(2026, 9, 1 + n, 8)).toISOString(); // J+n à 08:00 UTC

// Rejoue une suite de « F » (échec) et « R » (réussite), un jour par réponse.
function play(sequence, record = null, config = GUIDED_CONFIG) {
  [...sequence].forEach((c, i) => {
    record = c === 'F' ? applyWeaknessFailure(record, day(i))
                       : applyWeaknessSuccess(record, day(i), config);
  });
  return record;
}

// ── Tableau 3.5 ─────────────────────────────────────────────────────────────

test('un premier échec crée une faiblesse active', () => {
  assert.deepEqual(applyWeaknessFailure(null, day(0)), {
    consecutiveFails: 1, totalFails: 1, successStreak: 0, lastFailDate: day(0), resolvedAt: null
  });
  assert.equal(isWeaknessActive(applyWeaknessFailure(undefined, day(0))), true);
});

test('une réussite sur un élément sans faiblesse ne crée rien (comme l\'ancien code)', () => {
  assert.equal(applyWeaknessSuccess(null, day(0)), null);
  assert.equal(applyWeaknessSuccess(undefined, day(0)), null);
});

test('échec : consécutifs +1, total +1, dernier échec daté, série de réussites remise à 0', () => {
  const r = play('FRRF');
  assert.equal(r.consecutiveFails, 1);  // 1 → 0 → 0 → 1
  assert.equal(r.totalFails, 2);
  assert.equal(r.successStreak, 0);
  assert.equal(r.lastFailDate, day(3));
});

test('réussite : consécutifs −1 (minimum 0), série +1 ; la faiblesse diminue sans disparaître', () => {
  const r = play('FFFR');
  assert.equal(r.consecutiveFails, 2);
  assert.equal(r.successStreak, 1);
  assert.equal(r.totalFails, 3);
  assert.equal(isWeaknessActive(r), true);
  assert.equal(play('FR').consecutiveFails, 0);
  assert.equal(play('FRR').consecutiveFails, 0);
});

test('résolution : 0 échec consécutif ET 3 réussites d\'affilée → inactive, entrée conservée', () => {
  const r = play('FRRR');
  assert.equal(isWeaknessActive(r), false);
  assert.equal(r.resolvedAt, day(3));
  assert.equal(r.totalFails, 1);
  assert.equal(r.lastFailDate, day(0));
  assert.equal(isWeaknessActive(play('FRR')), true);
});

test('trois réussites ne suffisent pas s\'il reste des échecs consécutifs', () => {
  const r = play('FFFFRRR'); // consécutifs 4 → 1 après trois réussites
  assert.equal(r.consecutiveFails, 1);
  assert.equal(isWeaknessActive(r), true);
  const r2 = play('R', r, GUIDED_CONFIG); // 4e réussite : 0 consécutif, série de 4
  assert.equal(r2.consecutiveFails, 0);
  assert.equal(isWeaknessActive(r2), false);
});

test('un raté trois fois et un raté une fois restent distincts après résolution (3.5)', () => {
  const thrice = play('FFFRRR');
  const once = play('FRRR');
  assert.equal(isWeaknessActive(thrice), false);
  assert.equal(isWeaknessActive(once), false);
  assert.equal(thrice.totalFails, 3);
  assert.equal(once.totalFails, 1);
});

test('un échec réactive une faiblesse inactive ; le total s\'accumule', () => {
  const r = play('F', play('FRRR'));
  assert.equal(isWeaknessActive(r), true);
  assert.equal(r.resolvedAt, null);
  assert.equal(r.consecutiveFails, 1);
  assert.equal(r.totalFails, 2);
  assert.equal(r.successStreak, 0);
});

test('une réussite sur une faiblesse inactive la laisse inactive, avec sa date de résolution', () => {
  const resolved = play('FRRR');
  const r = applyWeaknessSuccess(resolved, day(10));
  assert.equal(isWeaknessActive(r), false);
  assert.equal(r.resolvedAt, resolved.resolvedAt);
  assert.equal(r.consecutiveFails, 0);
});

test('le seuil de résolution vient de la configuration', () => {
  const config = { ...GUIDED_CONFIG, weaknessResolveStreak: 1 };
  assert.equal(isWeaknessActive(play('FR', null, config)), false);
  assert.equal(GUIDED_CONFIG.weaknessResolveStreak, 3);
});

test('fonctions pures : l\'entrée n\'est pas modifiée, ses autres champs sont conservés', () => {
  const record = Object.freeze({ id: 'n5_v_1', consecutiveFails: 2, totalFails: 2,
    successStreak: 0, lastFailDate: day(0), resolvedAt: null });
  const failed = applyWeaknessFailure(record, day(1));
  const succeeded = applyWeaknessSuccess(record, day(1));
  assert.equal(failed.id, 'n5_v_1');
  assert.equal(succeeded.id, 'n5_v_1');
  assert.equal(record.consecutiveFails, 2);
});

test('date invalide refusée', () => {
  assert.throws(() => applyWeaknessFailure(null, 'demain'), TypeError);
  assert.throws(() => applyWeaknessSuccess(play('F'), undefined), TypeError);
  assert.throws(() => computeWeaknessPriority(play('F'), 42), TypeError);
});

// ── Priorité : reprise à l'identique ────────────────────────────────────────

// Copie de computeWeaknessPriority dans l'ancienne app (js/weakness.js), constantes en dur,
// Date.now() remplacé par la date reçue.
function legacyPriority(rec, nowMs) {
  const daysSince = (nowMs - new Date(rec.lastFailDate).getTime()) / 86400000;
  const recencyFactor = Math.max(0, 1 - daysSince / 14);
  return (rec.consecutiveFails || 0) * 5 + (rec.totalFails || 0) * 1 + recencyFactor * 8;
}

test('computeWeaknessPriority donne exactement le calcul de l\'ancien code', () => {
  let checked = 0;
  for (let consecutiveFails = 0; consecutiveFails <= 6; consecutiveFails++) {
    for (let totalFails = consecutiveFails; totalFails <= 10; totalFails++) {
      for (const hoursAgo of [0, 1, 12, 24, 72, 24 * 7, 24 * 13.5, 24 * 14, 24 * 30]) {
        const now = new Date(Date.UTC(2026, 9, 20, 8));
        const rec = { consecutiveFails, totalFails,
          lastFailDate: new Date(now.getTime() - hoursAgo * 3600000).toISOString() };
        assert.equal(computeWeaknessPriority(rec, now), legacyPriority(rec, now.getTime()));
        checked++;
      }
    }
  }
  assert.ok(checked > 400);
});

test('les constantes de GUIDED_CONFIG.weaknessPriority sont celles de l\'ancien code', () => {
  assert.deepEqual(GUIDED_CONFIG.weaknessPriority,
    { consecutiveFailWeight: 5, totalFailWeight: 1, recencyWeight: 8, recencyWindowDays: 14 });
  assert.ok(Object.isFrozen(GUIDED_CONFIG.weaknessPriority));
});

test('la priorité baisse progressivement avec les réussites (3.5)', () => {
  const now = day(5);
  const priorities = ['FFF', 'FFFR', 'FFFRR'].map((s) => computeWeaknessPriority(play(s), now));
  assert.ok(priorities[0] > priorities[1] && priorities[1] > priorities[2], priorities.join(' > '));
});
