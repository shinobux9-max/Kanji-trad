/**
 * js/core/data-loader.js
 * Chargement des données JSON PAR NIVEAU JLPT (data/{levelId}/vocab.json,
 * grammar.json, kanji.json, exemples.json) — reproduit fonction par fonction la
 * logique de chargement/cache du monolithe kanji.js.
 *
 * REMPLACE l'ancien stub (loadJsonData/loadKanjiData/loadVocabData/loadGrammarData) :
 * ce dernier supposait des fichiers globaux data/vocab.json / data/grammar.json qui
 * n'existent pas dans la vraie structure du projet (chaque niveau a ses propres
 * fichiers sous data/{levelId}/). Rien de réel n'en dépendait, il a donc été retiré
 * plutôt que conservé à côté (une API fausse qui ne charge rien est pire qu'absente).
 *
 * NON INCLUS ICI (à porter dans une étape ultérieure, orchestration app.js) :
 * le chargement de kanji_jouyou_fr.json -> kanjiDb/kanjiMap, et data/mapping.json
 * (jlptMapping) — ce sont des bootstraps uniques faits dans init(), pas des loaders
 * par niveau réutilisés en boucle comme ceux ci-dessous.
 */

import { registerCacheInvalidator, getTrackingData } from './storage.js';
import { ALL_JLPT_LEVELS } from './constants.js';

/* ══════════════════════════════════════════════════
   UTILITAIRE DE SÉCURITÉ — flattenIfNested
   ─────────────────────────────────────────────────
   Aplatit défensivement une liste imbriquée par erreur — piège classique quand un lot de
   leçons/mots collé depuis un LLM est inséré comme UN SEUL élément (une liste imbriquée) au
   lieu d'être éclaté dans le tableau principal. Déjà rencontré sur N5 puis N4 dans ce projet.
══════════════════════════════════════════════════ */
export function flattenIfNested(arr) {
    if (!Array.isArray(arr)) return arr;
    const hasNested = arr.some(x => Array.isArray(x));
    if (!hasNested) return arr;
    const flat = [];
    for (const x of arr) {
        if (Array.isArray(x)) flat.push(...x);
        else flat.push(x);
    }
    console.warn(`⚠️ Structure imbriquée détectée et aplatie automatiquement (${arr.length} → ${flat.length} éléments)`);
    return flat;
}

/* ══════════════════════════════════════════════════
   EXEMPLES SUPPLÉMENTAIRES (data/{levelId}/exemples.json)
   Chargé une seule fois par niveau, partagé par kanji/vocab/grammaire.
══════════════════════════════════════════════════ */
const exemplesByLevel = {};
const exemplesLoadPromises = {}; // évite les doubles fetch en cas d'appels concurrents

export async function ensureExemplesLoaded(levelId) {
    if (!levelId) return null;
    if (exemplesByLevel[levelId]) return exemplesByLevel[levelId];
    if (exemplesLoadPromises[levelId]) return exemplesLoadPromises[levelId];
    exemplesLoadPromises[levelId] = (async () => {
        try {
            const res = await fetch(`./data/${levelId}/exemples.json`, { cache: 'no-store' });
            if (res.ok) {
                exemplesByLevel[levelId] = await res.json();
            }
        } catch (e) {
            console.warn(`Impossible de charger exemples pour ${levelId}:`, e);
        }
        return exemplesByLevel[levelId] || null;
    })();
    return exemplesLoadPromises[levelId];
}

// Exemples supplémentaires pour un mot de vocabulaire, au-delà de celui déjà présent sur sa
// fiche (word.example). Ne déclenche JAMAIS de fetch : suppose que ensureExemplesLoaded(levelId)
// a déjà été appelé (comportement identique au monolithe).
export function getVocabExtraExamples(levelId, wordId) {
    const data = levelId && exemplesByLevel[levelId];
    return (data && data.vocab && data.vocab[wordId]) || [];
}

// Même principe pour une leçon de grammaire, au-delà des exemples déjà présents dans
// lesson.examples.
export function getGrammarExtraExamples(levelId, lessonId) {
    const data = levelId && exemplesByLevel[levelId];
    return (data && data.grammar && data.grammar[lessonId]) || [];
}

// Différent des deux ci-dessus : un kanji n'a AUCUN exemple embarqué sur son propre objet
// (contrairement au vocab/grammaire) — exemplesByLevel[levelId].kanji[char] est ici la source
// PRINCIPALE des exemples, pas un supplément. Retourne null (pas []) si absent, pour que
// renderExemples() puisse distinguer "pas d'exemples pour ce niveau" et retomber sur
// state.exemplesDb (legacy) exactement comme le fait le monolithe.
export function getKanjiLevelExamples(levelId, char) {
    const data = levelId && exemplesByLevel[levelId];
    return (data && data.kanji && data.kanji[char]) || null;
}

/* ══════════════════════════════════════════════════
   VOCABULAIRE PAR NIVEAU (data/{levelId}/vocab.json)
══════════════════════════════════════════════════ */
const vocabDataCache = {};

export async function getLevelVocabData(levelId) {
    if (levelId in vocabDataCache) return vocabDataCache[levelId];

    try {
        const res = await fetch(`./data/${levelId}/vocab.json`, { cache: 'no-store' });
        if (!res.ok) { vocabDataCache[levelId] = null; return null; }
        const data = flattenIfNested(await res.json());

        // IMPORTANT : ici on ATTEND le chargement des exemples (contrairement à
        // getLevelGrammarData ci-dessous) — le vocab en a besoin immédiatement pour générer
        // l'exercice "trou à combler". Ne pas retirer ce await par souci de symétrie.
        await ensureExemplesLoaded(levelId);

        vocabDataCache[levelId] = { data, examples: exemplesByLevel[levelId] || null };
    } catch (e) {
        vocabDataCache[levelId] = null;
    }
    return vocabDataCache[levelId];
}

/* ══════════════════════════════════════════════════
   GRAMMAIRE PAR NIVEAU (data/{levelId}/grammar.json)
══════════════════════════════════════════════════ */
const grammarDataCache = {};

export async function getLevelGrammarData(levelId) {
    if (levelId in grammarDataCache) return grammarDataCache[levelId];
    try {
        const res = await fetch(`./data/${levelId}/grammar.json`, { cache: 'no-store' });
        grammarDataCache[levelId] = res.ok ? { data: flattenIfNested(await res.json()) } : null;
    } catch (e) {
        grammarDataCache[levelId] = null;
    }
    // IMPORTANT : PAS de await ici (fire-and-forget), contrairement à getLevelVocabData —
    // simple préchargement en tâche de fond pour que les exemples soient déjà en cache au
    // moment où le quiz ou la fiche détail grammaire en ont besoin. Ne pas ajouter await : ça
    // ralentirait chaque navigation grammaire sans bénéfice (elle ne bloque sur rien ici).
    ensureExemplesLoaded(levelId);
    return grammarDataCache[levelId];
}

/**
 * Équivalent EXACT de findLessonByIdSync(lessonId) du monolithe — recherche SYNCHRONE dans
 * le cache déjà chargé (grammarDataCache, privé à ce module), jamais de fetch. Retourne null
 * si le niveau n'a jamais été chargé via getLevelGrammarData() au préalable. Ajoutée ici
 * (pas dans features/grammar.js) car elle a besoin d'un accès direct au cache privé — même
 * raison que kanaGroups/getKanaFlatList sont ici plutôt que dans features/kana.js.
 */
/**
 * Équivalent EXACT de getLevelConceptsData(levelId) du monolithe — data/concepts/{levelId}.json
 * (introductions/rappels/points de vigilance pédagogiques du Learning Path, jamais notés au
 * SRS). Ajoutée ici (pas dans learning/learning-path.js) : même famille que
 * getLevelVocabData/getLevelGrammarData ci-dessus, tout le chargement JSON par niveau reste
 * centralisé dans ce fichier.
 */
let conceptsDataCache = {};
export async function getLevelConceptsData(levelId) {
    if (levelId in conceptsDataCache) return conceptsDataCache[levelId];
    try {
        const res = await fetch(`./data/concepts/${levelId}.json`, { cache: 'no-store' });
        conceptsDataCache[levelId] = res.ok ? await res.json() : null;
    } catch (e) {
        conceptsDataCache[levelId] = null;
    }
    return conceptsDataCache[levelId];
}

// Précharge la grammaire de tous les niveaux JLPT en arrière-plan (fire-and-forget, appelé
// une fois au démarrage par app.js) — permet ensuite des recherches SYNCHRONES via
// findLessonByIdSync()/findLessonByItemSync(), utile pour le système de renvoi "voir" entre
// leçons qui doit fonctionner dans des contextes de rendu synchrones.
export function preloadAllGrammarLevels() {
    ALL_JLPT_LEVELS.forEach(level => { getLevelGrammarData(level); });
}

export function findLessonByIdSync(lessonId) {
    if (!lessonId) return null;
    const level = lessonId.split('_')[0];
    const cached = grammarDataCache[level];
    if (!cached || !cached.data) return null;
    return cached.data.find(l => l.id === lessonId) || null;
}

/**
 * Équivalent EXACT de findLessonByItemSync(itemText) du monolithe — cherche une leçon par son
 * item exact (ou première forme avant "/"), tous niveaux déjà préchargés confondus. Même
 * raison de placement que findLessonByIdSync ci-dessus.
 */
export function findLessonByItemSync(itemText) {
    if (!itemText) return null;
    for (const level of ALL_JLPT_LEVELS) {
        const cached = grammarDataCache[level];
        if (!cached || !cached.data) continue;
        const found = cached.data.find(l => {
            const first = (l.item || '').split('/')[0].trim();
            return first === itemText || l.item === itemText;
        });
        if (found) return found;
    }
    return null;
}

/* ══════════════════════════════════════════════════
   CARACTÈRES KANJI PAR NIVEAU (data/{levelId}/kanji.json -> { chars: [...] })
══════════════════════════════════════════════════ */
const kanjiCharsCache = {};

export async function getLevelKanjiChars(levelId) {
    if (levelId in kanjiCharsCache) return kanjiCharsCache[levelId];
    try {
        const res = await fetch(`./data/${levelId}/kanji.json`, { cache: 'no-store' });
        if (!res.ok) { kanjiCharsCache[levelId] = null; return null; }
        const data = await res.json();
        kanjiCharsCache[levelId] = Array.isArray(data.chars) ? flattenIfNested(data.chars) : null;
    } catch (e) {
        kanjiCharsCache[levelId] = null;
    }
    return kanjiCharsCache[levelId];
}

/* ══════════════════════════════════════════════════
   STATS VOCAB/GRAMMAIRE PAR NIVEAU (pour les écrans "Niveaux")
   ─────────────────────────────────────────────────
   Cache invalidé à chaque changement de statut de maîtrise (trackItem), via le registre
   d'invalidation exposé par core/storage.js — remplace l'accès direct du monolithe à
   `levelStatsCache` depuis trackItem(), pour éviter un cycle storage.js <-> data-loader.js.
══════════════════════════════════════════════════ */
const levelStatsCache = {};
registerCacheInvalidator(() => {
    for (const key in levelStatsCache) delete levelStatsCache[key];
});

export async function getLevelVocabGrammarStats(levelId) {
    if (levelStatsCache[levelId]) return levelStatsCache[levelId];

    const tracking = getTrackingData();
    const stats = { vocabTotal: 0, vocabMastered: 0, grammarTotal: 0, grammarMastered: 0 };

    const vd = await getLevelVocabData(levelId);
    if (vd && vd.data) {
        stats.vocabTotal = vd.data.length;
        stats.vocabMastered = vd.data.filter(w => tracking[w.id]?.status === 'mastered').length;
    }

    // Note : fetch direct ici (pas via getLevelGrammarData), exactement comme dans le
    // monolithe — volontairement pas de flattenIfNested ni de cache long terme sur cette
    // partie brute, seul le résultat agrégé (stats) est mis en cache via levelStatsCache.
    try {
        const res = await fetch(`./data/${levelId}/grammar.json`, { cache: 'no-store' });
        if (res.ok) {
            const grammar = await res.json();
            stats.grammarTotal = grammar.length;
            stats.grammarMastered = grammar.filter(l => tracking[l.id]?.status === 'mastered').length;
        }
    } catch (e) { /* niveau pas encore disponible, on garde 0 */ }

    levelStatsCache[levelId] = stats;
    return stats;
}

/* ══════════════════════════════════════════════════
   ROMANISATION KANA — KANA_TO_ROMAJI + kanaToRomaji
   ─────────────────────────────────────────────────
   Déplacées depuis features/kana.js pour la MÊME raison que kanaGroups ci-dessus, mais
   découverte en cours de route (pas anticipée dans le plan initial du HANDOFF) : kanji.js
   importe kanaToRomaji depuis kana.js, et strokes.js importe depuis kanji.js — si kana.js
   importait strokes.js (prévu pour le futur tracé kana), ça créerait un cycle transitif
   kana -> strokes -> kanji -> kana. En sortant kanaToRomaji de kana.js, ce risque disparaît :
   kanji.js l'importe maintenant d'ici, jamais de kana.js.
══════════════════════════════════════════════════ */
export const KANA_TO_ROMAJI = {"あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko","さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to","な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho","ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo","ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","を":"wo","ん":"n","が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo","だ":"da","ぢ":"di","づ":"du","で":"de","ど":"do","ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo","ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po","ア":"a","イ":"i","ウ":"u","エ":"e","オ":"o","カ":"ka","キ":"ki","ク":"ku","ケ":"ke","コ":"ko","サ":"sa","シ":"shi","ス":"su","セ":"se","ソ":"so","タ":"ta","チ":"chi","ツ":"tsu","テ":"te","ト":"to","ナ":"na","ニ":"ni","ヌ":"nu","ネ":"ne","ノ":"no","ハ":"ha","ヒ":"hi","フ":"fu","ヘ":"he","ホ":"ho","マ":"ma","ミ":"mi","ム":"mu","メ":"me","モ":"mo","ヤ":"ya","ユ":"yu","ヨ":"yo","ラ":"ra","リ":"ri","ル":"ru","レ":"re","ロ":"ro","ワ":"wa","ヲ":"wo","ン":"n"};
export function kanaToRomaji(str) { return [...str].map(c => KANA_TO_ROMAJI[c] || c).join(''); }

const SMALL_Y_TO_ROMAJI = { "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ャ": "ya", "ュ": "yu", "ョ": "yo" };
// Ces bases perdent le "y" dans la combinaison yōon (しょ -> sho, pas shyo)
const YOON_NO_Y_BASES = new Set(['し', 'じ', 'ち', 'ぢ', 'シ', 'ジ', 'チ', 'ヂ']);

/**
 * Équivalent EXACT de kanaToRomajiPrecise(str) du monolithe (ligne ~1518) — contrairement à
 * kanaToRomaji ci-dessus (plus basique), gère la gémination (っ double la consonne suivante),
 * l'allongement katakana (ー répète la voyelle précédente) et les combinaisons yōon (きゃ ->
 * kya, pas ki+ya). Utilisée pour l'item des fiches grammaire (jamais pour du texte contenant
 * du kanji, voir getItemRomaji ci-dessous). Ajoutée ici lors du chantier features/grammar.js
 * (dépendance découverte en lisant showLessonReferencePopup/buildConfusionBoxHtml) — même
 * emplacement que KANA_TO_ROMAJI dont elle dépend directement.
 */
export function kanaToRomajiPrecise(str) {
    const chars = [...str];
    let result = '';
    let i = 0;
    while (i < chars.length) {
        const c = chars[i];
        if (c === 'っ' || c === 'ッ') {
            const nextRomaji = KANA_TO_ROMAJI[chars[i + 1]];
            if (nextRomaji && /^[bcdfghjklmnpqrstvwz]/.test(nextRomaji)) result += nextRomaji[0];
            i++; continue;
        }
        if (c === 'ー') {
            const lastVowel = result.slice(-1);
            if ('aiueo'.includes(lastVowel)) result += lastVowel;
            i++; continue;
        }
        if (c === 'ん' || c === 'ン') { result += 'n'; i++; continue; }
        const next = chars[i + 1];
        if (next && SMALL_Y_TO_ROMAJI[next] && KANA_TO_ROMAJI[c]) {
            const base = KANA_TO_ROMAJI[c].slice(0, -1);
            const yPart = YOON_NO_Y_BASES.has(c) ? SMALL_Y_TO_ROMAJI[next].slice(1) : SMALL_Y_TO_ROMAJI[next];
            result += base + yPart;
            i += 2; continue;
        }
        result += KANA_TO_ROMAJI[c] || c;
        i++;
    }
    return result;
}

function hasKanjiChar(str) { return /[\u4e00-\u9faf]/.test(str); }

/**
 * Équivalent EXACT de getItemRomaji(item, explicitRomaji) du monolithe — romaji de l'item
 * d'une leçon de grammaire : utilise item_romaji si le champ existe, sinon génère
 * automatiquement pour les items en kana pur. Vide si ni l'un ni l'autre n'est disponible.
 */
export function getItemRomaji(item, explicitRomaji) {
    if (explicitRomaji) return explicitRomaji;
    if (!item) return '';
    const first = item.split('/')[0].trim().replace(/^〜/, '');
    if (!first || hasKanjiChar(first)) return '';
    return kanaToRomajiPrecise(first);
}

/* ══════════════════════════════════════════════════
   DONNÉES KANA (hiragana/katakana) — kanaGroups + getKanaFlatList
   ─────────────────────────────────────────────────
   Déplacées depuis features/kana.js (HANDOFF.md "PROCHAINE ÉTAPE") : learning/srs.js a
   besoin de getKanaFlatList() pour buildReviewQueue(), et features/kana.js aura bientôt
   besoin d'importer learning/srs.js (révision flashcard + tracé kana à venir) — les garder
   dans features/kana.js aurait créé un cycle direct srs.js <-> kana.js. Même raison que
   getLevelVocabData/getLevelGrammarData sont ici plutôt que dans une feature : empêcher
   learning/ de dépendre de features/.
   features/kana.js réimporte kanaGroups DEPUIS ICI pour son propre usage (rendu grille).
══════════════════════════════════════════════════ */
const hiraganaBase = [
    [{c:'あ',r:'a'},{c:'い',r:'i'},{c:'う',r:'u'},{c:'え',r:'e'},{c:'お',r:'o'}],
    [{c:'か',r:'ka'},{c:'き',r:'ki'},{c:'く',r:'ku'},{c:'け',r:'ke'},{c:'こ',r:'ko'}],
    [{c:'さ',r:'sa'},{c:'し',r:'shi'},{c:'す',r:'su'},{c:'せ',r:'se'},{c:'そ',r:'so'}],
    [{c:'た',r:'ta'},{c:'ち',r:'chi'},{c:'つ',r:'tsu'},{c:'て',r:'te'},{c:'と',r:'to'}],
    [{c:'な',r:'na'},{c:'に',r:'ni'},{c:'ぬ',r:'nu'},{c:'ね',r:'ne'},{c:'の',r:'no'}],
    [{c:'は',r:'ha'},{c:'ひ',r:'hi'},{c:'ふ',r:'fu'},{c:'へ',r:'he'},{c:'ほ',r:'ho'}],
    [{c:'ま',r:'ma'},{c:'み',r:'mi'},{c:'む',r:'mu'},{c:'め',r:'me'},{c:'も',r:'mo'}],
    [{c:'や',r:'ya'},null,{c:'ゆ',r:'yu'},null,{c:'よ',r:'yo'}],
    [{c:'ら',r:'ra'},{c:'り',r:'ri'},{c:'る',r:'ru'},{c:'れ',r:'re'},{c:'ろ',r:'ro'}],
    [{c:'わ',r:'wa'},null,null,null,{c:'を',r:'wo'}],
    [{c:'ん',r:'n'},null,null,null,null]
];
const katakanaBase = [
    [{c:'ア',r:'a'},{c:'イ',r:'i'},{c:'ウ',r:'u'},{c:'エ',r:'e'},{c:'オ',r:'o'}],
    [{c:'カ',r:'ka'},{c:'キ',r:'ki'},{c:'ク',r:'ku'},{c:'ケ',r:'ke'},{c:'コ',r:'ko'}],
    [{c:'サ',r:'sa'},{c:'シ',r:'shi'},{c:'ス',r:'su'},{c:'セ',r:'se'},{c:'ソ',r:'so'}],
    [{c:'タ',r:'ta'},{c:'チ',r:'chi'},{c:'ツ',r:'tsu'},{c:'テ',r:'te'},{c:'ト',r:'to'}],
    [{c:'ナ',r:'na'},{c:'ニ',r:'ni'},{c:'ヌ',r:'nu'},{c:'ネ',r:'ne'},{c:'ノ',r:'no'}],
    [{c:'ハ',r:'ha'},{c:'ヒ',r:'hi'},{c:'フ',r:'fu'},{c:'ヘ',r:'he'},{c:'ホ',r:'ho'}],
    [{c:'マ',r:'ma'},{c:'ミ',r:'mi'},{c:'ム',r:'mu'},{c:'メ',r:'me'},{c:'モ',r:'mo'}],
    [{c:'ヤ',r:'ya'},null,{c:'ユ',r:'yu'},null,{c:'ヨ',r:'yo'}],
    [{c:'ラ',r:'ra'},{c:'リ',r:'ri'},{c:'ル',r:'ru'},{c:'レ',r:'re'},{c:'ロ',r:'ro'}],
    [{c:'ワ',r:'wa'},null,null,null,{c:'ヲ',r:'wo'}],
    [{c:'ン',r:'n'},null,null,null,null]
];
const hiraganaDakuten = [
    [{c:'が',r:'ga'},{c:'ぎ',r:'gi'},{c:'ぐ',r:'gu'},{c:'げ',r:'ge'},{c:'ご',r:'go'}],
    [{c:'ざ',r:'za'},{c:'じ',r:'ji'},{c:'ず',r:'zu'},{c:'ぜ',r:'ze'},{c:'ぞ',r:'zo'}],
    [{c:'だ',r:'da'},{c:'ぢ',r:'di'},{c:'づ',r:'du'},{c:'で',r:'de'},{c:'ど',r:'do'}],
    [{c:'ば',r:'ba'},{c:'び',r:'bi'},{c:'ぶ',r:'bu'},{c:'べ',r:'be'},{c:'ぼ',r:'bo'}]
];
const katakanaDakuten = [
    [{c:'ガ',r:'ga'},{c:'ギ',r:'gi'},{c:'グ',r:'gu'},{c:'ゲ',r:'ge'},{c:'ゴ',r:'go'}],
    [{c:'ザ',r:'za'},{c:'ジ',r:'ji'},{c:'ズ',r:'zu'},{c:'ゼ',r:'ze'},{c:'ゾ',r:'zo'}],
    [{c:'ダ',r:'da'},{c:'ヂ',r:'di'},{c:'ヅ',r:'du'},{c:'デ',r:'de'},{c:'ド',r:'do'}],
    [{c:'バ',r:'ba'},{c:'ビ',r:'bi'},{c:'ブ',r:'bu'},{c:'ベ',r:'be'},{c:'ボ',r:'bo'}]
];
const hiraganaHandakuten = [[{c:'ぱ',r:'pa'},{c:'ぴ',r:'pi'},{c:'ぷ',r:'pu'},{c:'ぺ',r:'pe'},{c:'ぽ',r:'po'}]];
const katakanaHandakuten = [[{c:'パ',r:'pa'},{c:'ピ',r:'pi'},{c:'プ',r:'pu'},{c:'ペ',r:'pe'},{c:'ポ',r:'po'}]];
const hiraganaSokuon = [[{c:'っ',r:'–'},null,null,null,null]];
const katakanaSokuon = [[{c:'ッ',r:'–'},null,null,null,null]];
const hiraganaYoon = [
    [{c:'きゃ',r:'kya'},{c:'きゅ',r:'kyu'},{c:'きょ',r:'kyo'},null,null],
    [{c:'しゃ',r:'sha'},{c:'しゅ',r:'shu'},{c:'しょ',r:'sho'},null,null],
    [{c:'ちゃ',r:'cha'},{c:'ちゅ',r:'chu'},{c:'ちょ',r:'cho'},null,null],
    [{c:'にゃ',r:'nya'},{c:'にゅ',r:'nyu'},{c:'にょ',r:'nyo'},null,null],
    [{c:'ひゃ',r:'hya'},{c:'ひゅ',r:'hyu'},{c:'ひょ',r:'hyo'},null,null],
    [{c:'みゃ',r:'mya'},{c:'みゅ',r:'myu'},{c:'みょ',r:'myo'},null,null],
    [{c:'りゃ',r:'rya'},{c:'りゅ',r:'ryu'},{c:'りょ',r:'ryo'},null,null],
    [{c:'ぎゃ',r:'gya'},{c:'ぎゅ',r:'gyu'},{c:'ぎょ',r:'gyo'},null,null],
    [{c:'じゃ',r:'ja'}, {c:'じゅ',r:'ju'}, {c:'じょ',r:'jo'}, null,null],
    [{c:'びゃ',r:'bya'},{c:'びゅ',r:'byu'},{c:'びょ',r:'byo'},null,null],
    [{c:'ぴゃ',r:'pya'},{c:'ぴゅ',r:'pyu'},{c:'ぴょ',r:'pyo'},null,null]
];
const katakanaYoon = [
    [{c:'キャ',r:'kya'},{c:'キュ',r:'kyu'},{c:'キョ',r:'kyo'},null,null],
    [{c:'シャ',r:'sha'},{c:'シュ',r:'shu'},{c:'ショ',r:'sho'},null,null],
    [{c:'チャ',r:'cha'},{c:'チュ',r:'chu'},{c:'チョ',r:'cho'},null,null],
    [{c:'ニャ',r:'nya'},{c:'ニュ',r:'nyu'},{c:'ニョ',r:'nyo'},null,null],
    [{c:'ヒャ',r:'hya'},{c:'ヒュ',r:'hyu'},{c:'ヒョ',r:'hyo'},null,null],
    [{c:'ミャ',r:'mya'},{c:'ミュ',r:'myu'},{c:'ミョ',r:'myo'},null,null],
    [{c:'リャ',r:'rya'},{c:'リュ',r:'ryu'},{c:'リョ',r:'ryo'},null,null],
    [{c:'ギャ',r:'gya'},{c:'ギュ',r:'gyu'},{c:'ギョ',r:'gyo'},null,null],
    [{c:'ジャ',r:'ja'}, {c:'ジュ',r:'ju'}, {c:'ジョ',r:'jo'}, null,null],
    [{c:'ビャ',r:'bya'},{c:'ビュ',r:'byu'},{c:'ビョ',r:'byo'},null,null],
    [{c:'ピャ',r:'pya'},{c:'ピュ',r:'pyu'},{c:'ピョ',r:'pyo'},null,null]
];

// Assemblage final — identique à kanaGroups du monolithe.
export const kanaGroups = {
    hira: [
        {title:null,            rows:hiraganaBase},
        {title:'Dakuten ゛',    rows:hiraganaDakuten},
        {title:'Handakuten ゜', rows:hiraganaHandakuten},
        {title:'Sokuon 促音',   rows:hiraganaSokuon},
        {title:'Yoon 拗音',     rows:hiraganaYoon}
    ],
    kata: [
        {title:null,            rows:katakanaBase},
        {title:'Dakuten ゛',    rows:katakanaDakuten},
        {title:'Handakuten ゜', rows:katakanaHandakuten},
        {title:'Sokuon 促音',   rows:katakanaSokuon},
        {title:'Yoon 拗音',     rows:katakanaYoon}
    ]
};

/**
 * Équivalent EXACT de getKanaFlatList(script) du monolithe.
 * script : 'hira' | 'kata' | 'both'.
 * id au format 'kana_' + caractère — format consommé tel quel par trackItem()/gradeReview()
 * (core/storage.js, learning/srs.js) : NE PAS changer ce préfixe, des entrées localStorage
 * existantes des utilisateurs y sont déjà indexées.
 */
export function getKanaFlatList(script) {
    const scripts = script === 'both' ? ['hira', 'kata'] : [script];
    const list = [];
    scripts.forEach(s => {
        (kanaGroups[s] || []).forEach(group => {
            group.rows.forEach(row => {
                row.forEach(kana => {
                    if (kana) list.push({ id: `kana_${kana.c}`, char: kana.c, romaji: kana.r });
                });
            });
        });
    });
    return list;
}
