// Ocha v2 — Validation des données
//
// Vérifie les fichiers de data/ selon le document de conception :
//   - partie 2, section 2.7 (validation du graphe) et addendum 2.10 (formes, group) ;
//   - addendum A1 (champ `construction`) ;
//   - docs/conception/GUIDE-CONTENU.md (format des phrases, romaji, questions).
//
// Deux niveaux de gravité (partie 2, 2.7) :
//   - erreur        : le contenu ne peut pas être livré (code de sortie 1) ;
//   - avertissement : signalé, sans bloquer.
//
// Usage : node tools/validate-data.mjs
//
// Ce script lit les données, il ne les modifie jamais.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDED_CONFIG } from '../src/config.js';

// ── Périmètre ───────────────────────────────────────────────────────────────

// Niveaux dont la STRUCTURE est validée. Les niveaux N4 à N1 sont hors périmètre : leurs
// données sont encore dans l'ancien format (identifiants, `group`, exemples, romaji) et
// doivent d'abord être migrées au format v2 (voir ETAT-ACTUEL.md, points ouverts).
// Pour valider un nouveau niveau après sa migration : l'ajouter ici, ex. ['n5', 'n4'].
export const VALIDATED_LEVELS = ['n5'];

// Tous les niveaux existants sont LUS pour construire l'index des identifiants, afin qu'une
// référence vers un niveau supérieur soit reconnue (et signalée comme telle).
const ALL_LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];

// Emplacements provisoires : l'ancienne app charge encore ces fichiers ici. Ils seront
// déplacés à l'étape 5 (concepts vers data/<niveau>/concepts.json).
const conceptsPath = (lvl) => join('concepts', `${lvl}.json`);

// Fichiers de data/ que le validateur ne lit pas (ancienne app uniquement, voir ETAT-ACTUEL.md).
export const IGNORED_FILES = ['mapping.json', join('curriculum', 'n5.json')];

// ── Valeurs connues ─────────────────────────────────────────────────────────

// `group` du vocabulaire (addendum 2.10) : catégories qui se conjuguent…
const CONJUGABLE_GROUPS = ['ru', 'u', 'irrégulier', 'suru', 'i', 'na', 'nom'];
// …et catégories qui ne se conjuguent pas (décision du 2026-09-30, ETAT-ACTUEL.md).
const OTHER_GROUPS = ['adverbe', 'pronom', 'interrogatif', 'démonstratif', 'conjonction',
  'temps', 'quantité', 'interjection'];
export const KNOWN_GROUPS = new Set([...CONJUGABLE_GROUPS, ...OTHER_GROUPS]);

const REF_KEYS = ['grammar', 'vocab', 'kanji', 'kana', 'expression']; // partie 2, 2.3
const MACRON = /[āīūēōĀĪŪĒŌ]/;                                         // GUIDE-CONTENU, §2
const LATIN = /[A-Za-z]/;
const stripRuby = (s) => String(s).replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, '$1');
const isKana = (c) => /^[\u3041-\u3096\u30A1-\u30FA\u30FC]$/.test(c);

// ── Collecte des problèmes ──────────────────────────────────────────────────

class Report {
  constructor() { this.errors = []; this.warnings = []; }
  error(code, where, message) { this.errors.push({ code, where, message }); }
  warn(code, where, message) { this.warnings.push({ code, where, message }); }
}

// ── Lecture des fichiers ────────────────────────────────────────────────────

function loadJson(dataDir, rel, report, { required = false } = {}) {
  const full = join(dataDir, rel);
  if (!existsSync(full)) {
    if (required) report.error('fichier-absent', rel, 'fichier obligatoire introuvable');
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    report.error('json-invalide', rel, `JSON invalide : ${e.message}`);
    return undefined;
  }
}

// ── Index des identifiants ──────────────────────────────────────────────────

function buildIndex(dataDir, report) {
  const index = {
    grammar: new Map(), vocab: new Map(), kanji: new Set(), expression: new Map(),
    registers: new Set(), places: new Set(), categories: new Map()
  };
  const levelOfId = (id) => (id.match(/^(n[1-5])_/) || [])[1] || null;
  index.levelOfId = levelOfId;

  // Unicité des identifiants ENTRE fichiers, par espace d'identifiants (vocab, grammar,
  // expression). Les espaces ne peuvent pas se chevaucher : leurs préfixes diffèrent
  // (partie 2, 2.3). Un doublon À L'INTÉRIEUR d'un fichier est signalé par la validation de
  // ce fichier (niveaux validés seulement).
  const sources = { vocab: new Map(), grammar: new Map(), expression: new Map() };
  const register = (space, item, file) => {
    if (!item || typeof item.id !== 'string') return;
    const first = sources[space].get(item.id);
    if (first && first !== file) {
      report.error('id-duplique-global', file, `identifiant « ${item.id} » déjà défini dans ${first}`);
      return; // la première définition est conservée
    }
    if (!first) sources[space].set(item.id, file);
    if (!index[space].has(item.id)) index[space].set(item.id, item);
  };

  for (const lvl of ALL_LEVELS) {
    const vocabFile = `${lvl}/vocab.json`;
    const vocab = loadJson(dataDir, join(lvl, 'vocab.json'), new Report());
    if (Array.isArray(vocab)) for (const w of vocab) register('vocab', w, vocabFile);
    const grammarFile = `${lvl}/grammar.json`;
    const grammar = loadJson(dataDir, join(lvl, 'grammar.json'), new Report());
    if (Array.isArray(grammar)) for (const g of grammar) register('grammar', g, grammarFile);
    const kanji = loadJson(dataDir, join(lvl, 'kanji.json'), new Report());
    if (kanji && Array.isArray(kanji.chars)) kanji.chars.forEach((c) => index.kanji.add(c));
  }
  const dict = loadJson(dataDir, 'kanji_jouyou_fr.json', report);
  if (dict && typeof dict === 'object') Object.keys(dict).forEach((c) => index.kanji.add(c));

  const hj = loadJson(dataDir, 'vocab-hors-jlpt.json', report);
  if (Array.isArray(hj)) for (const w of hj) register('vocab', w, 'vocab-hors-jlpt.json');

  const expressions = loadJson(dataDir, 'expressions.json', report);
  if (Array.isArray(expressions)) for (const e of expressions) register('expression', e, 'expressions.json');

  const registres = loadJson(dataDir, 'registres.json', report);
  if (Array.isArray(registres)) registres.forEach((r) => r && r.id && index.registers.add(r.id));

  const lieux = loadJson(dataDir, 'lieux.json', report);
  if (Array.isArray(lieux)) lieux.forEach((l) => l && l.id && index.places.add(l.id));

  // Catégories : seulement celles des niveaux validés et des mots hors JLPT (les niveaux hors
  // périmètre ont encore leurs anciennes catégories).
  for (const w of index.vocab.values()) {
    const inScope = w.id.startsWith('hj_') || VALIDATED_LEVELS.includes(levelOfId(w.id));
    if (inScope && w.category) index.categories.set(w.category, (index.categories.get(w.category) || 0) + 1);
  }
  return { index, files: { hj, expressions, registres, lieux } };
}

// Vérifie qu'un élément référencé existe. type : clé de REF_KEYS.
function exists(index, type, id) {
  switch (type) {
    case 'grammar': return index.grammar.has(id);
    case 'vocab': return index.vocab.has(id);
    case 'expression': return index.expression.has(id);
    case 'kanji': return index.kanji.has(id);
    case 'kana': return typeof id === 'string' && id.startsWith('kana_') && isKana(id.slice(5));
    default: return false;
  }
}

// Vérifie un objet de références groupées par type ({ grammar: [...], vocab: [...] }).
function checkRefGroup(index, report, where, group, label, { allowedKeys = REF_KEYS } = {}) {
  const refs = [];
  if (group === undefined) return refs;
  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    report.error('format', where, `« ${label} » doit être un objet groupé par type`);
    return refs;
  }
  for (const [key, ids] of Object.entries(group)) {
    if (!allowedKeys.includes(key)) {
      report.error('cle-inconnue', where, `« ${label} » : clé « ${key} » non autorisée (${allowedKeys.join(', ')})`);
      continue;
    }
    if (!Array.isArray(ids)) { report.error('format', where, `« ${label}.${key} » doit être une liste`); continue; }
    for (const id of ids) {
      if (!exists(index, key, id)) report.error('ref-inexistante', where, `« ${label}.${key} » : identifiant inexistant « ${id} »`);
      refs.push({ type: key, id });
    }
  }
  return refs;
}

const keyOf = (r) => `${r.type}:${r.id}`;

// ── Phrases (format commun, GUIDE-CONTENU §5) ───────────────────────────────

function checkSentence(index, report, where, s, { characters = null } = {}) {
  if (!s || typeof s !== 'object') { report.error('format', where, 'phrase absente ou invalide'); return; }
  for (const f of ['japanese', 'romaji', 'french', 'register']) {
    if (typeof s[f] !== 'string' || s[f] === '') report.error('champ-manquant', where, `champ « ${f} » manquant`);
  }
  if (s.register && !index.registers.has(s.register)) report.error('registre-inconnu', where, `registre inconnu « ${s.register} »`);
  if (typeof s.romaji === 'string' && MACRON.test(s.romaji)) report.warn('romaji-macron', where, `romaji avec macron : « ${s.romaji} »`);
  if (s.speaker !== undefined && characters && !characters.has(s.speaker)) {
    report.error('personnage-inconnu', where, `« speaker » inconnu : « ${s.speaker} »`);
  }
  const plain = stripRuby(s.japanese || '');
  for (const r of s.refs || []) {
    if (!r || typeof r.text !== 'string') { report.error('format', where, 'référence sans « text »'); continue; }
    if (!plain.includes(r.text)) report.error('ref-texte-absent', where, `le texte « ${r.text} » n'apparaît pas dans la phrase`);
    const type = r.vocab ? 'vocab' : r.expression ? 'expression' : null;
    if (!type) { report.error('format', where, `référence « ${r.text} » sans « vocab » ni « expression »`); continue; }
    if (!exists(index, type, r[type])) report.error('ref-inexistante', where, `référence « ${r.text} » : ${type} inexistant « ${r[type]} »`);
  }
  for (const g of s.grammar || []) {
    if (!index.grammar.has(g)) report.error('ref-inexistante', where, `grammaire inexistante « ${g} »`);
  }
  for (const [i, tb] of (s.sounds_textbook || []).entries()) {
    for (const f of ['japanese', 'romaji', 'why', 'natural', 'natural_romaji']) {
      if (typeof tb?.[f] !== 'string' || tb[f] === '') report.error('champ-manquant', `${where} · sounds_textbook[${i}]`, `champ « ${f} » manquant`);
    }
    if (tb?.natural_romaji && MACRON.test(tb.natural_romaji)) report.warn('romaji-macron', `${where} · sounds_textbook[${i}]`, 'romaji avec macron');
  }
}

// ── Activités (missions, lectures) : requires, teaches, questions ───────────

function checkActivity(index, report, where, act, level) {
  const req = checkRefGroup(index, report, where, act.requires, 'requires');
  const teach = checkRefGroup(index, report, where, act.teaches, 'teaches');
  const reqKeys = new Set(req.map(keyOf));
  for (const t of teach) {
    if (reqKeys.has(keyOf(t))) report.error('requires-et-teaches', where, `« ${t.id} » est à la fois exigé et enseigné`);
  }
  for (const r of req) {
    if (r.type === 'kana') report.error('kana-exige', where, `un kana ne peut pas être exigé (« ${r.id} »)`);
  }
  if (teach.length > GUIDED_CONFIG.maxTaughtElements) {
    report.warn('teaches-trop-long', where, `« teaches » contient ${teach.length} éléments (plus de ${GUIDED_CONFIG.maxTaughtElements})`);
  }
  if (act.requires === undefined && act.teaches === undefined) {
    report.warn('sans-relations', where, 'ni « requires » ni « teaches »');
  }
  for (const r of req) {
    if (r.type !== 'grammar') continue;
    const rl = index.levelOfId(r.id);
    if (rl && level && rl < level) report.warn('niveau-superieur', where, `exige « ${r.id} », d'un niveau supérieur`);
  }
  return new Set([...reqKeys, ...teach.map(keyOf)]);
}

function checkQuestions(index, report, where, questions, activityId, allowed, seenIds) {
  for (const [i, q] of (questions || []).entries()) {
    const qWhere = `${where} · question ${i + 1}`;
    if (!q || typeof q !== 'object') { report.error('format', qWhere, 'question invalide'); continue; }
    if (typeof q.id !== 'string' || q.id === '') {
      report.error('question-sans-id', qWhere, 'question rédigée sans identifiant');
    } else {
      if (seenIds.has(q.id)) report.error('id-duplique', qWhere, `identifiant de question en double « ${q.id} »`);
      seenIds.add(q.id);
      if (!q.id.startsWith(`${activityId}_`)) report.warn('question-id-prefixe', qWhere, `l'identifiant devrait commencer par « ${activityId}_ »`);
    }
    if (q.target === undefined) {
      report.error('question-sans-cible', qWhere, 'question sans « target »');
    } else {
      const targets = checkRefGroup(index, report, qWhere, q.target, 'target');
      for (const t of targets) {
        if (!allowed.has(keyOf(t))) report.error('cible-hors-activite', qWhere, `la cible « ${t.id} » n'est ni enseignée ni exigée par l'activité`);
      }
    }
    if (Array.isArray(q.choices) && Number.isInteger(q.answer) && (q.answer < 0 || q.answer >= q.choices.length)) {
      report.error('reponse-invalide', qWhere, `« answer » (${q.answer}) hors des choix`);
    }
  }
}

// ── Grammaire ───────────────────────────────────────────────────────────────

function checkGrammar(index, report, lvl, grammar) {
  const where0 = `${lvl}/grammar.json`;
  const ids = new Set();
  let withoutRequires = 0;
  for (const g of grammar) {
    const where = `${where0} · ${g?.id ?? '?'}`;
    if (!g || typeof g.id !== 'string') { report.error('format', where0, 'leçon sans identifiant'); continue; }
    if (ids.has(g.id)) report.error('id-duplique', where, 'identifiant en double');
    ids.add(g.id);
    if (!g.id.startsWith(`${lvl}_g_`)) report.error('prefixe-id', where, `l'identifiant devrait commencer par « ${lvl}_g_ »`);
    if (g.requires === undefined) withoutRequires++;
    const req = checkRefGroup(index, report, where, g.requires, 'requires', { allowedKeys: ['grammar'] });
    if (req.some((r) => r.id === g.id)) report.error('prerequis-soi-meme', where, 'la leçon se déclare elle-même comme prérequis');
    if (g.pattern !== undefined && typeof g.pattern !== 'string') {
      report.error('format', where, '« pattern » est le motif d\'affichage, en texte (addendum A1)');
    }
    if (g.construction !== undefined) {
      const c = g.construction;
      if (!c || typeof c.form !== 'string' || typeof c.suffix !== 'string') {
        report.error('format', where, '« construction » doit contenir « form » et « suffix » (addendum A1)');
      }
    }
    if (g.forms !== undefined && (!Array.isArray(g.forms) || g.forms.some((f) => typeof f !== 'string'))) {
      report.error('format', where, '« forms » doit être une liste d\'identifiants de formes');
    }
  }
  if (withoutRequires > 0) {
    report.warn('lecon-sans-requires', where0, `${withoutRequires} leçon(s) sans « requires » : l'ordre de référence s'applique (partie 2, 2.6)`);
  }
  checkGrammarCycles(report, grammar, where0);
}

function checkGrammarCycles(report, grammar, where) {
  const deps = new Map(grammar.filter((g) => g && g.id).map((g) => [g.id, (g.requires && g.requires.grammar) || []]));
  const state = new Map(); // 1 = en cours, 2 = terminé
  const visit = (id, path) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      report.error('cycle', where, `cycle de prérequis : ${[...path.slice(path.indexOf(id)), id].join(' → ')}`);
      return;
    }
    state.set(id, 1);
    for (const d of deps.get(id) || []) if (deps.has(d)) visit(d, [...path, id]);
    state.set(id, 2);
  };
  for (const id of deps.keys()) visit(id, []);
}

// ── Vocabulaire ─────────────────────────────────────────────────────────────

function checkVocab(index, report, where0, vocab, prefix) {
  const ids = new Set();
  const unknownGroups = new Map();
  for (const w of vocab) {
    const where = `${where0} · ${w?.id ?? '?'}`;
    if (!w || typeof w.id !== 'string') { report.error('format', where0, 'mot sans identifiant'); continue; }
    if (ids.has(w.id)) report.error('id-duplique', where, 'identifiant en double');
    ids.add(w.id);
    if (!w.id.startsWith(prefix)) report.error('prefixe-id', where, `l'identifiant devrait commencer par « ${prefix} »`);
    for (const f of ['word', 'reading', 'romaji', 'type', 'group', 'category']) {
      if (typeof w[f] !== 'string' || w[f] === '') report.error('champ-manquant', where, `champ « ${f} » manquant`);
    }
    if (!w.meanings || typeof w.meanings.primary !== 'string') report.error('champ-manquant', where, 'champ « meanings.primary » manquant');
    if (typeof w.reading === 'string' && LATIN.test(w.reading)) report.error('lecture-romaji', where, `lecture en caractères latins : « ${w.reading} »`);
    if (typeof w.romaji === 'string' && MACRON.test(w.romaji)) report.warn('romaji-macron', where, `romaji avec macron : « ${w.romaji} »`);
    if (typeof w.group === 'string' && w.group !== '' && !KNOWN_GROUPS.has(w.group)) {
      unknownGroups.set(w.group, [...(unknownGroups.get(w.group) || []), w.id]);
    }
    if (w.group === 'suru' && typeof w.word === 'string' && !w.word.endsWith('する')) {
      report.warn('suru-sans-suru', where, `group « suru » mais le mot « ${w.word} » ne se termine pas par する`);
    }
    for (const k of w.kanji_list || []) {
      if (typeof k !== 'string' || [...k].length !== 1) {
        report.error('kanji-list-format', where, `« kanji_list » : chaque entrée doit être un seul kanji (« ${k} »)`);
      } else if (!index.kanji.has(k)) {
        report.warn('kanji-inconnu', where, `kanji « ${k} » absent des listes de kanji`);
      }
    }
  }
  for (const [g, list] of unknownGroups) {
    report.warn('group-inconnu', where0, `« group » inconnu « ${g} » (${list.length} mot(s), ex. ${list.slice(0, 3).join(', ')})`);
  }
}

function checkCategories(index, report) {
  const cats = [...index.categories.keys()];
  for (const c of cats) {
    if (index.categories.get(c) === 1) report.warn('categorie-isolee', 'vocabulaire', `catégorie « ${c} » utilisée par un seul mot (faute de frappe ?)`);
  }
  const norm = (c) => c.split('_').sort().join('_');
  const seen = new Map();
  for (const c of cats) {
    const n = norm(c);
    if (seen.has(n) && seen.get(n) !== c) report.warn('categorie-doublon', 'vocabulaire', `catégories « ${seen.get(n)} » et « ${c} » semblent identiques`);
    else seen.set(n, c);
  }
}

// ── Fichiers de contenu v2 ──────────────────────────────────────────────────

function characterSet(act) {
  return new Set((act.characters || []).map((c) => c && c.id).filter(Boolean));
}

function checkMissions(index, report, lvl, missions, questionIds) {
  const where0 = `${lvl}/missions.json`;
  const ids = new Set();
  for (const m of missions) {
    const where = `${where0} · ${m?.id ?? '?'}`;
    if (!m || typeof m.id !== 'string') { report.error('format', where0, 'mission sans identifiant'); continue; }
    if (ids.has(m.id)) report.error('id-duplique', where, 'identifiant en double');
    ids.add(m.id);
    if (!index.places.has(m.place)) report.error('lieu-inconnu', where, `lieu inconnu « ${m.place} »`);
    const allowed = checkActivity(index, report, where, m, lvl);
    const chars = characterSet(m);
    (m.dialogue || []).forEach((s, i) => checkSentence(index, report, `${where} · dialogue ${i + 1}`, s, { characters: chars }));
    checkQuestions(index, report, where, m.exercises, m.id, allowed, questionIds);
  }
}

function checkLectures(index, report, lvl, lectures, questionIds) {
  const where0 = `${lvl}/lectures.json`;
  const ids = new Set();
  for (const l of lectures) {
    const where = `${where0} · ${l?.id ?? '?'}`;
    if (!l || typeof l.id !== 'string') { report.error('format', where0, 'lecture sans identifiant'); continue; }
    if (ids.has(l.id)) report.error('id-duplique', where, 'identifiant en double');
    ids.add(l.id);
    if (!['histoire', 'dialogue', 'carnet', 'lettre'].includes(l.type)) report.error('format', where, `type inconnu « ${l.type} »`);
    if (l.place !== undefined && l.place !== null && !index.places.has(l.place)) report.error('lieu-inconnu', where, `lieu inconnu « ${l.place} »`);
    const allowed = checkActivity(index, report, where, l, lvl);
    const chars = characterSet(l);
    const blocks = l.blocks || [];
    blocks.forEach((b, bi) => {
      const bWhere = `${where} · bloc ${bi + 1}`;
      if (Array.isArray(b.lines)) b.lines.forEach((s, li) => checkSentence(index, report, `${bWhere} · ligne ${li + 1}`, s, { characters: chars }));
      else checkSentence(index, report, bWhere, b, { characters: chars });
    });
    for (const [qi, q] of (l.questions || []).entries()) {
      const ref = q && q.line_ref;
      if (!Array.isArray(ref)) continue;
      const block = blocks[ref[0]];
      const ok = block && (ref.length === 1 || (Array.isArray(block.lines) && block.lines[ref[1]]));
      if (!ok) report.error('line-ref-invalide', `${where} · question ${qi + 1}`, `« line_ref » ${JSON.stringify(ref)} ne désigne aucune ligne`);
    }
    checkQuestions(index, report, where, l.questions, l.id, allowed, questionIds);
  }
}

function checkExpressions(index, report, expressions) {
  const where0 = 'expressions.json';
  const ids = new Set();
  for (const e of expressions) {
    const where = `${where0} · ${e?.id ?? '?'}`;
    if (!e || typeof e.id !== 'string') { report.error('format', where0, 'expression sans identifiant'); continue; }
    if (ids.has(e.id)) report.error('id-duplique', where, 'identifiant en double');
    ids.add(e.id);
    if (!e.id.startsWith('ex_')) report.error('prefixe-id', where, "l'identifiant devrait commencer par « ex_ »");
    for (const [i, v] of (e.variants || []).entries()) {
      if (!index.registers.has(v?.register)) report.error('registre-inconnu', `${where} · variante ${i + 1}`, `registre inconnu « ${v?.register} »`);
      if (typeof v?.romaji === 'string' && MACRON.test(v.romaji)) report.warn('romaji-macron', `${where} · variante ${i + 1}`, 'romaji avec macron');
    }
    for (const p of e.places || []) if (!index.places.has(p)) report.error('lieu-inconnu', where, `lieu inconnu « ${p} »`);
    for (const r of e.related || []) if (!index.expression.has(r)) report.error('ref-inexistante', where, `expression liée inexistante « ${r} »`);
    if (e.refs) checkRefGroup(index, report, where, e.refs, 'refs');
    (e.examples || []).forEach((s, i) => checkSentence(index, report, `${where} · exemple ${i + 1}`, s));
    (e.responses || []).forEach((s, i) => {
      if (s?.register && !index.registers.has(s.register)) report.error('registre-inconnu', `${where} · réponse ${i + 1}`, `registre inconnu « ${s.register} »`);
    });
  }
}

function checkLieux(index, report, lieux) {
  for (const l of lieux) {
    for (const c of l?.vocab_categories || []) {
      if (!index.categories.has(c)) report.warn('categorie-inconnue', `lieux.json · ${l.id}`, `catégorie de vocabulaire inconnue « ${c} »`);
    }
  }
}

function checkParticles(index, report, lvl, particles) {
  for (const [i, p] of particles.entries()) {
    if (p?.grammar_id && !index.grammar.has(p.grammar_id)) {
      report.error('ref-inexistante', `${lvl}/particles.json · ${p.particle ?? i + 1}`, `leçon inexistante « ${p.grammar_id} »`);
    }
  }
}

// ── Point d'entrée ──────────────────────────────────────────────────────────

export function validateData(dataDir) {
  const report = new Report();
  const { index, files } = buildIndex(dataDir, report);

  for (const lvl of VALIDATED_LEVELS) {
    const vocab = loadJson(dataDir, join(lvl, 'vocab.json'), report, { required: true });
    const grammar = loadJson(dataDir, join(lvl, 'grammar.json'), report, { required: true });
    loadJson(dataDir, join(lvl, 'kanji.json'), report, { required: true });
    loadJson(dataDir, join(lvl, 'exemples.json'), report);
    loadJson(dataDir, conceptsPath(lvl), report);
    if (Array.isArray(vocab)) checkVocab(index, report, `${lvl}/vocab.json`, vocab, `${lvl}_v_`);
    if (Array.isArray(grammar)) checkGrammar(index, report, lvl, grammar);

    const questionIds = new Set();
    const missions = loadJson(dataDir, join(lvl, 'missions.json'), report);
    if (Array.isArray(missions)) checkMissions(index, report, lvl, missions, questionIds);
    const lectures = loadJson(dataDir, join(lvl, 'lectures.json'), report);
    if (Array.isArray(lectures)) checkLectures(index, report, lvl, lectures, questionIds);
    const particles = loadJson(dataDir, join(lvl, 'particles.json'), report);
    if (Array.isArray(particles)) checkParticles(index, report, lvl, particles);
  }

  if (Array.isArray(files.hj)) checkVocab(index, report, 'vocab-hors-jlpt.json', files.hj, 'hj_v_');
  if (Array.isArray(files.expressions)) checkExpressions(index, report, files.expressions);
  if (Array.isArray(files.lieux)) checkLieux(index, report, files.lieux);
  loadJson(dataDir, 'onboarding.json', report);
  checkCategories(index, report);

  return report;
}

// ── Exécution en ligne de commande ──────────────────────────────────────────

function printGrouped(title, items) {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length})`);
  const byCode = new Map();
  for (const it of items) byCode.set(it.code, [...(byCode.get(it.code) || []), it]);
  for (const [code, list] of byCode) {
    console.log(`\n  [${code}] ${list.length}`);
    for (const it of list.slice(0, 10)) console.log(`    ${it.where} : ${it.message}`);
    if (list.length > 10) console.log(`    … et ${list.length - 10} autre(s)`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dataDir = join(root, 'data');
  if (!existsSync(dataDir) || !readdirSync(dataDir).length) {
    console.log('validate-data : dossier data/ introuvable ou vide');
    process.exit(1);
  }
  const { errors, warnings } = validateData(dataDir);
  console.log(`validate-data : niveaux validés ${VALIDATED_LEVELS.join(', ')} + fichiers communs`);
  printGrouped('ERREURS', errors);
  printGrouped('AVERTISSEMENTS', warnings);
  console.log(`\nvalidate-data : ${errors.length} erreur(s), ${warnings.length} avertissement(s)`);
  process.exit(errors.length ? 1 : 0);
}
