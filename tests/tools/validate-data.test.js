// Tests de tools/validate-data.mjs
// Lancement : npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { validateData, VALIDATED_LEVELS } from '../../tools/validate-data.mjs';

// ── Jeu de données minimal et valide ──

const R = (k, r) => `<ruby>${k}<rt>${r}</rt></ruby>`;

function baseData() {
  const word = (id, w, extra = {}) => ({
    id, level: 'N5', word: w, reading: 'よみ', romaji: 'yomi',
    meanings: { primary: 'sens' }, type: 'nom', group: 'nom', category: 'nourriture', kanji_list: [], ...extra
  });
  return {
    'n5/vocab.json': [word('n5_v_1', '水'), word('n5_v_2', '食べる', { group: 'ru', type: 'verbe' })],
    'n5/grammar.json': [
      { id: 'n5_g_1', item: 'です', pattern: '[Nom] + です' },
      { id: 'n5_g_2', item: 'か', requires: { grammar: ['n5_g_1'] } }
    ],
    'n5/kanji.json': { level: 'N5', count: 1, chars: ['水'] },
    'kanji_jouyou_fr.json': { 食: {} },
    'registres.json': [{ id: 'poli' }, { id: 'familier' }],
    'expressions.json': [{ id: 'ex_1', variants: [{ register: 'poli', japanese: 'ありがとうございます', romaji: 'arigatou gozaimasu' }] }],
    'vocab-hors-jlpt.json': [],
    'lieux.json': [{ id: 'konbini', vocab_categories: ['nourriture'] }],
    'onboarding.json': [],
    'n5/missions.json': [{
      id: 'n5_m_1', place: 'konbini',
      requires: { grammar: ['n5_g_1'] },
      teaches: { vocab: ['n5_v_1'], expression: ['ex_1'] },
      characters: [{ id: 'moi' }],
      dialogue: [{
        speaker: 'moi', japanese: `${R('水', 'みず')}です。`, romaji: 'mizu desu.', french: "C'est de l'eau.",
        register: 'poli', refs: [{ text: '水', vocab: 'n5_v_1' }], grammar: ['n5_g_1']
      }],
      exercises: [{ id: 'n5_m_1_q1', type: 'choice', target: { vocab: ['n5_v_1'] }, choices: ['a', 'b'], answer: 0 }]
    }],
    'n5/lectures.json': [{
      id: 'n5_l_1', type: 'histoire', place: null,
      requires: { grammar: ['n5_g_1'] }, teaches: { vocab: ['n5_v_1'] },
      blocks: [{ kind: 'paragraph', lines: [{ japanese: 'みずです。', romaji: 'mizu desu.', french: 'Eau.', register: 'poli' }] }],
      questions: [{ id: 'n5_l_1_q1', target: { vocab: ['n5_v_1'] }, choices: ['a', 'b'], answer: 1, line_ref: [0, 0] }]
    }]
  };
}

function withData(files, fn) {
  const root = mkdtempSync(join(tmpdir(), 'ocha-data-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = join(root, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content));
    }
    return fn(validateData(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const codes = (list) => list.map((x) => x.code);
const modify = (fn) => { const d = baseData(); fn(d); return d; };

// ── Tests ──

test('le périmètre validé est explicite', () => {
  assert.deepEqual(VALIDATED_LEVELS, ['n5']);
});

test('un jeu de données valide ne produit aucune erreur', () => {
  withData(baseData(), (r) => {
    assert.deepEqual(r.errors, []);
  });
});

test('JSON invalide et fichier obligatoire absent', () => {
  withData(modify((d) => { d['n5/grammar.json'] = '{ pas du json'; delete d['n5/kanji.json']; }), (r) => {
    assert.ok(codes(r.errors).includes('json-invalide'));
    assert.ok(codes(r.errors).includes('fichier-absent'));
  });
});

test('référence vers un identifiant inexistant (partie 2, 2.7)', () => {
  withData(modify((d) => { d['n5/missions.json'][0].requires.grammar.push('n5_g_99'); }), (r) => {
    assert.ok(r.errors.some((e) => e.code === 'ref-inexistante' && e.message.includes('n5_g_99')));
  });
});

test('élément à la fois exigé et enseigné', () => {
  withData(modify((d) => { d['n5/missions.json'][0].teaches.grammar = ['n5_g_1']; }), (r) => {
    assert.ok(codes(r.errors).includes('requires-et-teaches'));
  });
});

test('un kana ne peut pas être exigé', () => {
  withData(modify((d) => { d['n5/missions.json'][0].requires.kana = ['kana_あ']; }), (r) => {
    assert.ok(codes(r.errors).includes('kana-exige'));
  });
});

test('question sans identifiant, sans cible, ou ciblant hors de l\'activité', () => {
  withData(modify((d) => {
    const ex = d['n5/missions.json'][0].exercises;
    ex.push({ type: 'choice', target: { vocab: ['n5_v_1'] } });
    ex.push({ id: 'n5_m_1_q3' });
    ex.push({ id: 'n5_m_1_q4', target: { vocab: ['n5_v_2'] } });
  }), (r) => {
    const c = codes(r.errors);
    assert.ok(c.includes('question-sans-id'));
    assert.ok(c.includes('question-sans-cible'));
    assert.ok(c.includes('cible-hors-activite'));
  });
});

test('identifiant de question en double', () => {
  withData(modify((d) => { d['n5/lectures.json'][0].questions[0].id = 'n5_m_1_q1'; }), (r) => {
    assert.ok(codes(r.errors).includes('id-duplique'));
  });
});

test('cycle de prérequis et leçon qui s\'exige elle-même', () => {
  withData(modify((d) => {
    d['n5/grammar.json'][0].requires = { grammar: ['n5_g_2'] };
    d['n5/grammar.json'].push({ id: 'n5_g_3', requires: { grammar: ['n5_g_3'] } });
  }), (r) => {
    const c = codes(r.errors);
    assert.ok(c.includes('cycle'));
    assert.ok(c.includes('prerequis-soi-meme'));
  });
});

test('le requires d\'une leçon ne contient que de la grammaire', () => {
  withData(modify((d) => { d['n5/grammar.json'][1].requires.vocab = ['n5_v_1']; }), (r) => {
    assert.ok(codes(r.errors).includes('cle-inconnue'));
  });
});

test('addendum A1 : pattern est un texte, construction un objet', () => {
  withData(modify((d) => {
    d['n5/grammar.json'][0].pattern = { form: 'verb_te' };
    d['n5/grammar.json'][1].construction = { form: 'verb_te' };
  }), (r) => {
    assert.equal(r.errors.filter((e) => e.code === 'format').length, 2);
  });
});

test('le texte d\'une référence doit apparaître dans la phrase', () => {
  withData(modify((d) => { d['n5/missions.json'][0].dialogue[0].refs[0].text = 'お茶'; }), (r) => {
    assert.ok(codes(r.errors).includes('ref-texte-absent'));
  });
});

test('registre, personnage et lieu inconnus', () => {
  withData(modify((d) => {
    const m = d['n5/missions.json'][0];
    m.dialogue[0].register = 'soutenu';
    m.dialogue[0].speaker = 'caissier';
    m.place = 'gare';
  }), (r) => {
    const c = codes(r.errors);
    assert.ok(c.includes('registre-inconnu'));
    assert.ok(c.includes('personnage-inconnu'));
    assert.ok(c.includes('lieu-inconnu'));
  });
});

test('sounds_textbook exige natural_romaji', () => {
  withData(modify((d) => {
    d['n5/missions.json'][0].dialogue[0].sounds_textbook = [{ japanese: 'a', romaji: 'a', why: 'x', natural: 'b' }];
  }), (r) => {
    assert.ok(r.errors.some((e) => e.code === 'champ-manquant' && e.message.includes('natural_romaji')));
  });
});

test('line_ref qui ne désigne aucune ligne', () => {
  withData(modify((d) => { d['n5/lectures.json'][0].questions[0].line_ref = [3, 0]; }), (r) => {
    assert.ok(codes(r.errors).includes('line-ref-invalide'));
  });
});

test('vocabulaire : champ manquant, doublon, lecture en romaji', () => {
  withData(modify((d) => {
    const v = d['n5/vocab.json'];
    delete v[0].type;
    v[1].reading = 'taberu';
    v.push({ ...v[0], type: 'nom' });
  }), (r) => {
    const c = codes(r.errors);
    assert.ok(c.includes('champ-manquant'));
    assert.ok(c.includes('lecture-romaji'));
    assert.ok(c.includes('id-duplique'));
  });
});

test('avertissements : teaches trop long, macron, group inconnu, suru', () => {
  withData(modify((d) => {
    const v = d['n5/vocab.json'];
    for (let i = 3; i <= 11; i++) v.push({ ...v[0], id: `n5_v_${i}` });
    d['n5/missions.json'][0].teaches.vocab = v.map((w) => w.id);
    v[0].romaji = 'mizū';
    v[0].group = 'nom_commun';
    v[1].group = 'suru';
  }), (r) => {
    const c = codes(r.warnings);
    assert.ok(c.includes('teaches-trop-long'));
    assert.ok(c.includes('romaji-macron'));
    assert.ok(c.includes('group-inconnu'));
    assert.ok(c.includes('suru-sans-suru'));
    assert.deepEqual(r.errors, []);
  });
});

test('catégories isolées ou en double', () => {
  withData(modify((d) => {
    const v = d['n5/vocab.json'];
    v[0].category = 'personnes_famille';
    v[1].category = 'famille_personnes';
  }), (r) => {
    const c = codes(r.warnings);
    assert.ok(c.includes('categorie-doublon'));
    assert.ok(c.includes('categorie-isolee'));
  });
});

test('les niveaux hors périmètre sont lus mais pas validés', () => {
  withData(modify((d) => {
    d['n4/vocab.json'] = [{ id: 'n4_v_1', reading: 'latin', group: 'noun' }];
    d['n4/grammar.json'] = [{ id: 'n4_g_potential' }];
    d['n5/missions.json'][0].requires.grammar.push('n4_g_potential');
  }), (r) => {
    assert.deepEqual(r.errors, []);
    assert.ok(codes(r.warnings).includes('niveau-superieur'));
  });
});

test('mapping.json et curriculum ne sont pas lus', () => {
  withData(modify((d) => {
    d['mapping.json'] = '{ invalide';
    d['curriculum/n5.json'] = '{ invalide';
  }), (r) => {
    assert.deepEqual(r.errors, []);
  });
});

test("unicité des identifiants entre fichiers (même espace d'identifiants)", () => {
  withData(modify((d) => {
    d['n4/vocab.json'] = [{ id: 'n5_v_1' }];
    d['n4/grammar.json'] = [{ id: 'n5_g_1' }];
  }), (r) => {
    const dups = r.errors.filter((e) => e.code === 'id-duplique-global');
    assert.equal(dups.length, 2);
    assert.ok(dups.some((e) => e.message.includes('n5/vocab.json')));
  });
});

test('un mot hors JLPT placé dans le vocabulaire N5 est signalé', () => {
  withData(modify((d) => {
    d['vocab-hors-jlpt.json'] = [{ ...d['n5/vocab.json'][0], id: 'hj_v_1' }];
    d['n5/vocab.json'].push({ ...d['n5/vocab.json'][0], id: 'hj_v_1' });
  }), (r) => {
    const c = codes(r.errors);
    assert.ok(c.includes('id-duplique-global'));
    assert.ok(c.includes('prefixe-id'));
  });
});

test('kanji_list : une entrée = exactement un kanji', () => {
  withData(modify((d) => { d['n5/vocab.json'][0].kanji_list = ['風呂']; }), (r) => {
    assert.ok(codes(r.errors).includes('kanji-list-format'));
    assert.ok(!codes(r.warnings).includes('kanji-inconnu'));
  });
});
