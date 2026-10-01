// Ocha v2 — Suite de contrat du stockage
//
// Cas que TOUTE implémentation de store/contract.js doit passer : la version en mémoire
// (tests/store/memory.test.js, dans Node) et la version IndexedDB (tâche 12, dans le
// navigateur). Ce fichier n'utilise donc ni `node:test` ni `node:assert` : chaque cas est une
// fonction asynchrone qui lève une erreur en cas d'échec.
//
// Usage :
//   for (const c of STORE_CONTRACT_CASES) {
//     if (c.needs === 'failures' && !harness.canFail) continue;
//     await c.run(await makeHarness());
//   }
//
// Un harnais fournit :
//   store                    le stockage à tester, vide
//   canFail                  true si les pannes peuvent être déclenchées
//   failNextCommit(kind)     prochaine transaction d'écriture en échec (si canFail)
//   setUnavailable(flag)     stockage indisponible ou non (si canFail)

import { STORE_NAMES, STORE_DEFINITIONS, StorageError } from '../../src/store/contract.js';
import { SCHEMA_VERSION } from '../../src/store/schema.js';

// ── Vérifications minimales, sans dépendance ────────────────────────────────

function fail(message) {
  throw new Error(message);
}

function same(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) fail(`${message}\n  obtenu  : ${a}\n  attendu : ${e}`);
}

async function rejects(promiseOrFn, predicate, message) {
  try {
    await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn);
  } catch (error) {
    if (predicate && !predicate(error)) fail(`${message} : erreur inattendue (${error && error.name}: ${error && error.message})`);
    return error;
  }
  fail(`${message} : aucune erreur levée`);
}

const isStorageError = (kind) => (e) => e instanceof StorageError && e.kind === kind;

// Un enregistrement minimal pour chaque magasin, avec sa clé au bon champ.
function sample(storeName, key, extra = {}) {
  return { [STORE_DEFINITIONS[storeName].keyPath]: key, ...extra };
}

async function snapshotAll(store) {
  const out = {};
  for (const name of STORE_NAMES) out[name] = await store.getAll(name);
  return out;
}

// ── Cas ─────────────────────────────────────────────────────────────────────

export const STORE_CONTRACT_CASES = [
  {
    name: 'un stockage neuf : 8 magasins vides, meta avec la version du schéma et l\'identifiant d\'installation',
    async run({ store }) {
      for (const name of STORE_NAMES.filter((n) => n !== 'meta')) {
        same(await store.getAll(name), [], `magasin ${name}`);
      }
      const meta = await store.getAll('meta');
      same(meta.map((r) => r.key), ['installationId', 'schemaVersion'], 'clés de meta');
      same((await store.get('meta', 'schemaVersion')).value, SCHEMA_VERSION, 'version du schéma');
      const { value: installationId } = await store.get('meta', 'installationId');
      if (typeof installationId !== 'string' || installationId === '') fail('identifiant d\'installation vide');
    }
  },
  {
    name: 'chaque magasin enregistre et relit par sa clé (9.2)',
    async run({ store }) {
      for (const name of STORE_NAMES) {
        await store.transaction([name], (tx) => tx.put(name, sample(name, 'k1', { v: 1 })));
        same(await store.get(name, 'k1'), sample(name, 'k1', { v: 1 }), `magasin ${name}`);
      }
    }
  },
  {
    name: 'une clé absente renvoie undefined',
    async run({ store }) {
      same(await store.get('elements', 'absent'), undefined, 'get sur clé absente');
    }
  },
  {
    name: 'put remplace un enregistrement existant',
    async run({ store }) {
      await store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a', v: 1 }));
      await store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a', v: 2 }));
      same(await store.getAll('elements'), [{ id: 'a', v: 2 }], 'remplacement');
    }
  },
  {
    name: 'delete supprime ; supprimer une clé absente ne lève pas d\'erreur',
    async run({ store }) {
      await store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a' }));
      await store.transaction(['elements'], async (tx) => {
        await tx.delete('elements', 'a');
        await tx.delete('elements', 'absent');
      });
      same(await store.getAll('elements'), [], 'après suppression');
    }
  },
  {
    name: 'getAll renvoie les enregistrements triés par clé',
    async run({ store }) {
      await store.transaction(['elements'], async (tx) => {
        for (const id of ['水', 'n5_v_2', 'kana_あ', 'n5_g_10', 'n5_g_8']) await tx.put('elements', { id });
      });
      same((await store.getAll('elements')).map((r) => r.id),
        ['kana_あ', 'n5_g_10', 'n5_g_8', 'n5_v_2', '水'], 'ordre des clés');
    }
  },
  {
    name: 'les enregistrements sont copiés à l\'écriture et à la lecture',
    async run({ store }) {
      const written = { id: 'a', srs: { interval: 1 } };
      await store.transaction(['elements'], (tx) => tx.put('elements', written));
      written.srs.interval = 99;
      const read = await store.get('elements', 'a');
      same(read.srs.interval, 1, 'modifier l\'objet écrit ne change pas le stockage');
      read.srs.interval = 42;
      same((await store.get('elements', 'a')).srs.interval, 1,
        'modifier l\'objet lu ne change pas le stockage');
    }
  },
  {
    name: 'mauvaise utilisation : magasin inconnu, clé absente ou invalide, valeur non copiable',
    async run({ store }) {
      await rejects(store.get('inconnu', 'a'), (e) => e instanceof TypeError, 'get sur magasin inconnu');
      await rejects(store.get('elements', ''), (e) => e instanceof TypeError, 'clé vide');
      await rejects(store.transaction([], () => {}), (e) => e instanceof TypeError, 'transaction sans magasin');
      await rejects(store.transaction(['elements'], (tx) => tx.put('elements', { v: 1 })),
        (e) => e instanceof TypeError, 'enregistrement sans clé');
      await rejects(store.transaction(['elements'], (tx) => tx.put('elements', { id: 7 })),
        (e) => e instanceof TypeError, 'clé non textuelle');
      await rejects(store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a', f() {} })),
        null, 'valeur non copiable');
      same(await store.getAll('elements'), [], 'rien n\'a été écrit');
    }
  },
  {
    // Partie 9 · 9.3 : tout ou rien
    name: 'une transaction sur plusieurs magasins écrit tout ensemble',
    async run({ store }) {
      await store.transaction(['events', 'elements', 'weaknesses', 'sessions'], async (tx) => {
        await tx.put('events', { id: 'evt_1', at: '2026-10-01T10:00:00Z' });
        await tx.put('elements', { id: 'n5_v_1' });
        await tx.put('weaknesses', { id: 'n5_v_1', consecutiveFails: 1 });
        await tx.put('sessions', { id: 'current', position: 2 });
      });
      same((await store.getAll('events')).length, 1, 'events');
      same((await store.getAll('elements')).length, 1, 'elements');
      same((await store.getAll('weaknesses')).length, 1, 'weaknesses');
      same((await store.getAll('sessions')).length, 1, 'sessions');
    }
  },
  {
    // Partie 9 · 9.3 : tout ou rien
    name: 'une erreur dans la transaction annule toutes ses écritures, dans tous les magasins',
    async run({ store }) {
      await store.transaction(['elements'], (tx) => tx.put('elements', { id: 'avant', v: 1 }));
      const before = await snapshotAll(store);
      const boom = new Error('boom');
      const caught = await rejects(store.transaction(['events', 'elements'], async (tx) => {
        await tx.put('events', { id: 'evt_1', at: '2026-10-01T10:00:00Z' });
        await tx.put('elements', { id: 'avant', v: 2 });
        await tx.delete('elements', 'avant');
        throw boom;
      }), null, 'erreur propagée');
      same(caught === boom, true, 'la transaction rejette avec l\'erreur de `work` elle-même');
      same(await snapshotAll(store), before, 'état inchangé');
    }
  },
  {
    // Partie 9 · 9.3 : tout ou rien
    name: 'accéder à un magasin hors de la transaction l\'annule entièrement',
    async run({ store }) {
      await rejects(store.transaction(['events'], async (tx) => {
        await tx.put('events', { id: 'evt_1', at: '2026-10-01T10:00:00Z' });
        await tx.put('elements', { id: 'a' });
      }), (e) => e instanceof TypeError, 'magasin hors portée');
      same(await store.getAll('events'), [], 'events non écrit');
      same(await store.getAll('elements'), [], 'elements non écrit');
    }
  },
  {
    name: 'une transaction voit ses propres écritures et suppressions',
    async run({ store }) {
      await store.transaction(['elements'], (tx) => tx.put('elements', { id: 'b' }));
      await store.transaction(['elements'], async (tx) => {
        await tx.put('elements', { id: 'a', v: 1 });
        same(await tx.get('elements', 'a'), { id: 'a', v: 1 }, 'lecture de sa propre écriture');
        await tx.delete('elements', 'b');
        same(await tx.get('elements', 'b'), undefined, 'lecture de sa propre suppression');
        same((await tx.getAll('elements')).map((r) => r.id), ['a'], 'getAll dans la transaction');
      });
    }
  },
  {
    name: 'la transaction renvoie le résultat de `work` ; `tx` est inutilisable après la fin',
    async run({ store }) {
      let kept;
      const result = await store.transaction(['elements'], async (tx) => {
        kept = tx;
        await tx.put('elements', { id: 'a' });
        return 'ok';
      });
      same(result, 'ok', 'résultat');
      await rejects(kept.put('elements', { id: 'b' }), (e) => e instanceof TypeError, 'tx après la fin');
      same((await store.getAll('elements')).map((r) => r.id), ['a'], 'aucune écriture tardive');
    }
  },
  {
    name: 'getAllByIndex sur la date des événements : bornes incluses, ordre par date',
    async run({ store }) {
      await store.transaction(['events'], async (tx) => {
        await tx.put('events', { id: 'evt_c', at: '2026-10-03T08:00:00Z' });
        await tx.put('events', { id: 'evt_a', at: '2026-10-01T08:00:00Z' });
        await tx.put('events', { id: 'evt_b', at: '2026-10-02T08:00:00Z' });
        await tx.put('events', { id: 'evt_b2', at: '2026-10-02T08:00:00Z' });
      });
      const ids = (rows) => rows.map((r) => r.id);
      same(ids(await store.getAllByIndex('events', 'at')),
        ['evt_a', 'evt_b', 'evt_b2', 'evt_c'], 'sans borne');
      same(ids(await store.getAllByIndex('events', 'at', { lower: '2026-10-02T08:00:00Z' })),
        ['evt_b', 'evt_b2', 'evt_c'], 'borne basse incluse');
      same(ids(await store.getAllByIndex('events', 'at', { upper: '2026-10-02T08:00:00Z' })),
        ['evt_a', 'evt_b', 'evt_b2'], 'borne haute incluse');
      await rejects(store.getAllByIndex('events', 'inconnu'), (e) => e instanceof TypeError, 'index inconnu');
      await rejects(store.getAllByIndex('elements', 'at'), (e) => e instanceof TypeError, 'index d\'un autre magasin');
    }
  },
  {
    // Partie 9 · 9.3 : traitement un par un
    name: 'les transactions s\'exécutent une par une, dans l\'ordre d\'appel',
    async run({ store }) {
      await store.transaction(['meta'], (tx) => tx.put('meta', { key: 'compteur', n: 0 }));
      const order = [];
      const increment = (label) => store.transaction(['meta'], async (tx) => {
        const rec = await tx.get('meta', 'compteur');
        order.push(label);
        await tx.put('meta', { key: 'compteur', n: rec.n + 1 });
      });
      await Promise.all([increment('1'), increment('2'), increment('3')]);
      same((await store.get('meta', 'compteur')).n, 3, 'aucune écriture perdue');
      same(order, ['1', '2', '3'], 'ordre d\'appel');
    }
  },
  {
    // Partie 9 · 9.3. IndexedDB peut faire tourner en parallèle deux transactions sur des
    // magasins différents ; le contrat, lui, les exécute une par une.
    name: 'des transactions sur des magasins différents se terminent aussi dans l\'ordre d\'appel',
    async run({ store }) {
      const done = [];
      const long = store.transaction(['events'], async (tx) => {
        for (let i = 0; i < 30; i++) await tx.put('events', { id: `evt_${i}`, at: '2026-10-01T08:00:00.000Z' });
      }).then(() => done.push('longue'));
      const short = store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a' }))
        .then(() => done.push('courte'));
      await Promise.all([long, short]);
      same(done, ['longue', 'courte'], 'ordre de fin');
    }
  },
  {
    name: 'une transaction en échec n\'empêche pas les suivantes',
    async run({ store }) {
      const first = store.transaction(['elements'], async () => { throw new Error('boom'); });
      const second = store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a' }));
      await rejects(first, null, 'première transaction');
      await second;
      same((await store.getAll('elements')).length, 1, 'seconde transaction écrite');
    }
  },

  // ── Pannes du stockage (9.4) ──

  {
    needs: 'failures',
    name: 'échec à l\'enregistrement (quota) : StorageError, rien n\'est écrit, la suite fonctionne',
    async run({ store, failNextCommit }) {
      await store.transaction(['elements'], (tx) => tx.put('elements', { id: 'avant' }));
      const before = await snapshotAll(store);
      failNextCommit('quota');
      await rejects(store.transaction(['events', 'elements'], async (tx) => {
        await tx.put('events', { id: 'evt_1', at: '2026-10-01T10:00:00Z' });
        await tx.put('elements', { id: 'n5_v_1' });
      }), isStorageError('quota'), 'quota');
      same(await snapshotAll(store), before, 'état inchangé');
      await store.transaction(['elements'], (tx) => tx.put('elements', { id: 'apres' }));
      same((await store.getAll('elements')).map((r) => r.id), ['apres', 'avant'], 'écriture suivante');
    }
  },
  {
    needs: 'failures',
    name: 'transaction annulée par le stockage : StorageError « aborted », rien n\'est écrit',
    async run({ store, failNextCommit }) {
      failNextCommit('aborted');
      await rejects(store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a' })),
        isStorageError('aborted'), 'aborted');
      same(await store.getAll('elements'), [], 'rien n\'est écrit');
    }
  },
  {
    needs: 'failures',
    name: 'stockage indisponible : lectures et écritures échouent, les données reviennent ensuite',
    async run({ store, setUnavailable }) {
      await store.transaction(['elements'], (tx) => tx.put('elements', { id: 'a' }));
      setUnavailable(true);
      await rejects(store.get('elements', 'a'), isStorageError('unavailable'), 'lecture');
      await rejects(store.getAll('elements'), isStorageError('unavailable'), 'lecture de tout');
      await rejects(store.transaction(['elements'], (tx) => tx.put('elements', { id: 'b' })),
        isStorageError('unavailable'), 'écriture');
      setUnavailable(false);
      same((await store.getAll('elements')).map((r) => r.id), ['a'], 'données conservées, rien d\'ajouté');
    }
  }
];
