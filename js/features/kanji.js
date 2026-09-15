/**
 * js/features/kanji.js
 * Logique métier + DOM Kanji — catégories, séries, lectures, mastery, dossiers/favoris,
 * fiche détail complète (openDetail/closeDetail), grilles/listes (ancienne navigation par
 * grade ET navigation JLPT moderne).
 *
 * REVÉRIFIÉ INTÉGRALEMENT (48 exports, ligne par ligne contre le monolithe) lors du chantier
 * de bascule finale vers ESM — ce fichier avait été porté par une session antérieure au
 * handoff écrit, jamais repassé au crible comme les autres fichiers ensuite. Les 48 fonctions
 * correspondent exactement au monolithe (aucune divergence fonctionnelle trouvée) ; seuls
 * plusieurs commentaires ⚠️/RAPPEL périmés ont été corrigés (ils disaient "pas encore porté"
 * pour des fonctions — strokes.js, quiz.js, ui/dashboard.js — qui le sont maintenant, faute de
 * mise à jour au fil des sessions suivantes).
 *
 * CE FICHIER EST COMPLET pour ce qu'il peut être sans features non portées. Deux fonctions
 * ont été VOLONTAIREMENT DÉPLACÉES vers features/strokes.js et features/quiz.js plutôt que
 * laissées ici, pour éviter des cycles d'import :
 * - replayAnimation()/launchDetailTrace() -> features/strokes.js (déclenchent le tracé)
 * - startFolderQuiz() -> features/quiz.js (déclenche showQuizModeModal)
 *
 * ENCORE MANQUANT (dépend d'un système jamais porté, hors périmètre de ce fichier — voir
 * HANDOFF.md, "Système de sélection de révision par catégorie") :
 * - displayKanjiListFromHome() appelle loadJLPTCategory() (routeur cross-feature
 *   showCategoryDirect/loadJLPTCategory) — voir avertissement inline à cet endroit.
 * - Le bouton "Réviser" de displayKanjiList() appelle showKanjiReviewModeSelector()
 *   (onclick), toujours pas portée nulle part.
 *
 * CORRECTIONS apportées par rapport à l'ancien stub :
 * - getKanjiByChar() : kanjiMap associe caractère -> INDEX dans kanjiDb (kanjiMap.set(char, i)),
 *   jamais l'objet kanji directement. L'ancien stub retournait l'index brut.
 * - filterKanjiByLevel/renderKanjiGrid/searchKanji de l'ancien stub utilisaient un champ
 *   `k.jlpt` qui n'existe pas sur les objets kanji réels (le niveau se calcule via
 *   getJLPTLevel(k.grade)) — RETIRÉS ici plutôt que laissés cassés ; à refaire correctement
 *   dans la passe DOM avec le bon calcul de niveau.
 */

import { state } from '../core/state.js';
import { getFoldersData, setStorageItem, STORAGE_KEYS, getItemStatus, trackItem } from '../core/storage.js';
import { getLevelVocabData, ensureExemplesLoaded, getKanjiLevelExamples } from '../core/data-loader.js';
import { ALL_JLPT_LEVELS } from '../core/constants.js';
import { pushModalState } from '../core/navigation.js';
import { kanaToRomaji } from '../core/data-loader.js';
import { countDueItems, buildDueQueue } from '../learning/srs.js';
import { isBulkSelected, refreshMasteryUI } from '../ui/common.js';
// NOTE : le fichier réel de ce projet s'appelle strokes.js (avec un "s"), alors que
// l'arborescence cible communiquée liste "stroke.js" (singulier) — divergence de nommage à
// clarifier/renommer un jour, mais je pointe vers le fichier qui existe réellement.
// (plus d'import depuis strokes.js — voir kanjiDataLoader défini plus bas dans ce fichier)

/* ══════════════════════════════════════════════════
   QUIZ OVERRIDES — Lectures prioritaires
   Consultés en premier par getBestReading() avant d'utiliser les données de
   kanji_jouyou_fr.json. Couvrent les kanji courants mal interprétés. Copié tel quel du
   monolithe (section "QUIZ OVERRIDES — Lectures prioritaires" en tête de kanji.js) — utilisé
   aussi par le futur test oral (features/oral.js, isResultCorrect/normalizeOralResult, pas
   encore porté), qui devra l'importer d'ici plutôt que dupliquer la table.
══════════════════════════════════════════════════ */
export const quizOverrides = {
    // --- CHIFFRES & COMPTAGE (Déjà faits, je complète) ---
    "一":"いち","二":"に","三":"さん","四":"よん","五":"ご",
    "六":"ろく","七":"なな","八":"はち","九":"きゅう","十":"じゅう",
    "百":"ひゃく","千":"せん","万":"まん","円":"えん",

    // --- TEMPS & NATURE (Lectures les plus usuelles) ---
    "日":"にち","月":"がつ","年":"ねん","時":"じ","分":"ふん","週":"しゅう","今":"いま",
    "火":"ひ","水":"みず","木":"き","金":"かね","土":"つち",
    "天":"てん","気":"き","雨":"あめ","雪":"ゆき","風":"かぜ","空":"そら",

    // --- HUMAINS & CORPS ---
    "人":"ひと","子":"こ","女":"おんな","男":"おとこ","父":"ちち","母":"はは",
    "私":"わたし","友":"とも","体":"からだ","目":"め","耳":"みみ","口":"くち",
    "手":"て","足":"あし","心":"こころ","力":"ちから",

    // --- DIRECTIONS & POSITIONS ---
    "上":"うえ","下":"した","左":"ひだり","右":"みぎ","中":"なか","外":"そと",
    "北":"きた","南":"みなみ","東":"ひがし","西":"にし","前":"まえ","後":"うしろ",
    "間":"あいだ","近":"ちかい","遠":"とおい",

    // --- VERBES (Forme dictionnaire complète) ---
    "食":"たべる","飲":"のむ","行":"いく","来":"くる","見":"みる","聞":"きく",
    "書":"かく","言":"いう","話":"はなす","読":"よむ","買":"かう","売":"うる",
    "立":"たつ","歩":"あるく","走":"はしる","持":"もつ","待":"まつ","作":"つくる",
    "休":"やすむ","会":"あう","知":"しる","思":"おもう","切":"きる",

    // --- ADJECTIFS ---
    "大":"おおきい","小":"ちいさい","高":"たかい","長":"ながい","白":"しろい",
    "赤":"あかい","青":"あおい","黒":"くろい","安":"やすい","新":"あたらしい",
    "古":"ふるい","多":"おおい","少":"すくない","早":"はやい",

    // --- ÉDUCATION & SOCIÉTÉ ---
    "学":"まなぶ", "校":"こう", "先":"さき", "生":"せい", "文":"ぶん",
    "字":"じ", "本":"ほん", "名":"なまえ", "正":"ただしい", "立":"たつ",
    "社":"しゃ", "員":"いん", "工":"こう", "場":"ばしょ", "国":"くに",

    // --- NATURE & ÉLÉMENTS AVANCÉS ---
    "海":"うみ", "地":"ち", "野":"の", "山":"やま", "川":"かわ",
    "石":"いし", "花":"はな", "竹":"たけ", "草":"くさ", "虫":"むし",
    "鳥":"とり", "魚":"さかな", "肉":"にく", "茶":"ちゃ", "米":"こめ",

    // --- VIE QUOTIDIENNE ---
    "家":"いえ", "族":"ぞく", "兄":"あに", "姉":"あね", "弟":"おとうと",
    "妹":"いもうと", "自":"みずから", "店":"みせ", "色":"いろ", "物":"もの",
    "服":"ふく", "犬":"いぬ", "猫":"ねこ", "牛":"うし", "馬":"うま",

    // --- MOUVEMENT & ÉTAT ---
    "入":"はいる", "出":"でる", "開":"あける", "閉":"しめる", "始":"はじまる",
    "終":"おわる", "使":"つかう", "動":"うごく", "止":"とまる", "考":"かんがえる",
    "急":"いそぐ", "決":"きめる", "送":"おくる", "待":"まつ", "借":"かりる",

    // --- QUALITÉS & SENS ---
    "好":"すき", "嫌":"きらい", "楽":"たのしい", "苦":"くるしい", "暗":"くらい",
    "明":"あかるい", "重":"おもい", "軽":"かるい", "広":"ひろい", "早":"はやい",
    "遅":"おそい", "強":"つよい", "弱":"よわい", "寒":"さむい", "暑":"あつい",

    // --- VILLE & VOYAGE ---
    "町":"まち", "村":"むら", "京":"きょう", "都":"と", "道":"みち",
    "駅":"えき", "車":"くるま", "自":"じ", "転":"てん", "船":"ふね",
    "旅":"たび", "荷":"に", "図":"ず", "書":"しょ", "館":"かん"
};

/* ══════════════════════════════════════════════════
   DÉFINITIONS DE CATÉGORIES (grade -> catégorie d'affichage)
══════════════════════════════════════════════════ */
export const CAT_DEFS = [
    { id:"p1",  label:"Primaire 1", color:"#3ecf8e", short:"小1" },
    { id:"p2",  label:"Primaire 2", color:"#3ecf8e", short:"小2" },
    { id:"p3",  label:"Primaire 3", color:"#3ecf8e", short:"小3" },
    { id:"p4",  label:"Primaire 4", color:"#3ecf8e", short:"小4" },
    { id:"p5",  label:"Primaire 5", color:"#3ecf8e", short:"小5" },
    { id:"p6",  label:"Primaire 6", color:"#3ecf8e", short:"小6" },
    { id:"c1",  label:"Collège 1",  color:"#6c7bff", short:"中1" },
    { id:"c2",  label:"Collège 2",  color:"#6c7bff", short:"中2" },
    { id:"c3",  label:"Collège 3",  color:"#6c7bff", short:"中3" },
    { id:"hyo", label:"Hyōgaigai", color:"#e07b54", short:"表外" },
];

const SERIES_SIZE = 20; // conservé pour référence — pas utilisé directement par buildSeries()
                          // (qui utilise MIN=10/MAX=20 en dur, voir plus bas), gardé car présent
                          // tel quel dans le monolithe (déclaré mais seule constante MAX est utilisée)

/* ══════════════════════════════════════════════════
   CONSTRUCTION DES STRUCTURES DE DONNÉES
   Mute state.categories / state.seriesMap directement (Map, donc pas de réassignation de
   binding nécessaire — .clear()/.set() suffisent, cohérent avec l'original).
══════════════════════════════════════════════════ */
export function buildCategories() {
    const kanjiDb = state.data.kanjiDb;
    const pBuckets = { "1":[], "2":[], "3":[], "4":[], "5":[], "6":[] };
    const collegeIdx = [], hyoIdx = [];

    kanjiDb.forEach((k, i) => {
        const c = String(k.grade ?? '').trim();
        if (pBuckets[c])       pBuckets[c].push(i);
        else if (c === '8')    collegeIdx.push(i);
        else                   hyoIdx.push(i);      // null, '', ou toute autre valeur
    });

    // Division du collège en 3 parts égales (par ordre d'apparition dans le JSON)
    const n = collegeIdx.length;
    const cut1 = Math.floor(n / 3), cut2 = Math.floor(2 * n / 3);
    const collegeParts = [
        collegeIdx.slice(0, cut1),
        collegeIdx.slice(cut1, cut2),
        collegeIdx.slice(cut2)
    ];

    state.categories.clear();
    CAT_DEFS.forEach(def => {
        let indices;
        const num = def.id[1];
        if      (def.id.startsWith('p')) indices = pBuckets[num] || [];
        else if (def.id === 'c1')        indices = collegeParts[0];
        else if (def.id === 'c2')        indices = collegeParts[1];
        else if (def.id === 'c3')        indices = collegeParts[2];
        else                             indices = hyoIdx;
        state.categories.set(def.id, { ...def, indices });
    });
}

export function buildSeries() {
    state.seriesMap.clear();
    const MIN = 10, MAX = 20;
    for (const [catId, cat] of state.categories) {
        const { indices } = cat;
        if (!indices.length) continue;

        const chunks = [];
        for (let i = 0; i < indices.length; i += MAX) {
            chunks.push(indices.slice(i, i + MAX));
        }

        if (chunks.length >= 2 && chunks[chunks.length - 1].length < MIN) {
            const last = chunks.pop();
            chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(last);
        }

        let offset = 0;
        chunks.forEach((chunk, i) => {
            const start = offset + 1;
            const end   = offset + chunk.length;
            const sid   = `${catId}_s${i + 1}`;
            state.seriesMap.set(sid, {
                id:    sid,
                catId,
                label: `Série ${i + 1}`,
                range: `${start}–${end}`,
                start,
                end,
                indices: chunk
            });
            offset += chunk.length;
        });
    }
}

/* ══════════════════════════════════════════════════
   UTILITAIRES
══════════════════════════════════════════════════ */
// Résoudre des indices -> objets kanji (lecture seule, pas de copie)
export function resolveKanjis(indices) {
    return indices.map(i => state.data.kanjiDb[i]);
}

// kanjiMap associe caractère -> INDEX dans kanjiDb, jamais l'objet directement (voir
// correction en en-tête de fichier). Retourne null si le caractère est inconnu.
export function getKanjiByChar(char) {
    const idx = state.data.kanjiMap.get(char);
    return idx !== undefined ? state.data.kanjiDb[idx] : null;
}

// Grade brut (classe scolaire japonaise) -> niveau JLPT (1 à 5). Équivalent EXACT de
// getJLPTLevel(grade) du monolithe.
export function getJLPTLevel(grade) {
    if (!grade) return null;
    const g = parseInt(grade);
    if (g >= 1 && g <= 2) return 5; // N5
    if (g === 3) return 4; // N4
    if (g === 4 || g === 5) return 3; // N3
    if (g === 6 || g === 8) return 2; // N2 (y compris collège)
    return 1; // N1 (rare/avancé)
}

/* ══════════════════════════════════════════════════
   LOGIQUE "MEILLEUR MATCH" — lectures ON/KUN
══════════════════════════════════════════════════ */

/**
 * Algorithme :
 * 1. Extraire les racines WK (kun d'abord, puis on). Les entrées préfixées par "!" sont
 *    prioritaires.
 * 2. Pour chaque racine WK : chercher dans k.kun une entrée qui COMMENCE par cette racine.
 * 3. Si aucun match kun, tenter avec on + wk_on.
 * 4. Fallback : first kun nettoyé, puis first on.
 * Équivalent EXACT de getBestReading(k) du monolithe — consulte quizOverrides en priorité
 * absolue, exactement comme l'original (plus de paramètre injecté ici : quizOverrides est
 * une vraie dépendance de ce module, pas un cas à contourner).
 */
export function getBestReading(k) {
    if (quizOverrides[k.char]) {
        return quizOverrides[k.char];
    }

    const clean = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();

    const wkRoots = (arr) => {
        const priority = arr.filter(r => r.startsWith('!')).map(r => clean(r));
        const normal   = arr.filter(r => !r.startsWith('!')).map(r => clean(r));
        return [...priority, ...normal].filter(Boolean);
    };

    const findMatch = (readings, root) =>
        readings.find(r => clean(r).startsWith(root));

    for (const root of wkRoots(k.wk_kun || [])) {
        const match = findMatch(k.kun, root);
        if (match) return clean(match);
    }

    for (const root of wkRoots(k.wk_on || [])) {
        const match = findMatch(k.on, root);
        if (match) return clean(match);
    }

    const allWk = [...wkRoots(k.wk_kun || []), ...wkRoots(k.wk_on || [])];
    if (allWk.length > 0) return allWk[0];

    if (k.kun && k.kun.length) return clean(k.kun[0]);
    if (k.on && k.on.length)   return clean(k.on[0]);
    return '?';
}

// Toutes les lectures valides pour comparaison vocale (nettoyées + romaji). Équivalent EXACT
// de getAllValidReadings(k) du monolithe, kanaToRomaji importé depuis core/data-loader.js
// (déplacé depuis features/kana.js en cours de chantier, voir en-tête de ce fichier) plutôt
// qu'un paramètre injecté.
export function getAllValidReadings(k) {
    const clean = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();
    const set = new Set();
    set.add(getBestReading(k));
    k.kun.forEach(r => { const c = clean(r); if (c) set.add(c); });
    k.on.forEach(r  => { const c = clean(r); if (c) set.add(c); });
    [...set].forEach(r => { const ro = kanaToRomaji(r); if (ro !== r) set.add(ro); });
    return [...set].filter(Boolean);
}

/**
 * Génère du HTML : chips ON/KUN pour l'affichage quiz/détail. Fonction pure (aucun accès DOM,
 * retourne une chaîne) — conservée ici plutôt que ui/cards.js car spécifique aux lectures
 * kanji et consommée uniquement par des écrans kanji (quiz, détail, révision).
 */
export function buildReadingChips(k, { maxOn = 4, maxKun = 4, showBadge = true, chipStyle = '' } = {}) {
    const clean = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();
    const seen  = new Set();

    const onChips = (k.on || [])
        .map(clean).filter(r => r && !seen.has(r) && seen.add(r))
        .slice(0, maxOn)
        .map(r => `<span class="quiz-reading-chip on-chip" style="display:inline-flex;flex-direction:column;align-items:center;${chipStyle}">
            ${showBadge ? '<span style="font-size:0.4375rem;opacity:0.65;line-height:1;margin-bottom:1px;font-weight:800;letter-spacing:.5px">ON</span>' : ''}
            <span class="chip-text" style="white-space:nowrap">${r}</span>
        </span>`).join('');

    const kunChips = (k.kun || [])
        .map(clean).filter(r => r && !seen.has(r) && seen.add(r))
        .slice(0, maxKun)
        .map(r => `<span class="quiz-reading-chip kun-chip" style="display:inline-flex;flex-direction:column;align-items:center;${chipStyle}">
            ${showBadge ? '<span style="font-size:0.4375rem;opacity:0.65;line-height:1;margin-bottom:1px;font-weight:800;letter-spacing:.5px">KUN</span>' : ''}
            <span class="chip-text" style="white-space:nowrap">${r}</span>
        </span>`).join('');

    if (!onChips && !kunChips) {
        const best = getBestReading(k);
        return `<span class="quiz-reading-chip on-chip" ${chipStyle ? `style="${chipStyle}"` : ''}>
            <span class="chip-text">${best}</span>
        </span>`;
    }
    return onChips + kunChips;
}

// Label de réponse quiz : "Sens • meilleure lecture" (tronqué si besoin)
export function choiceLabel(k) {
    const sens = k.meanings.filter(m => !m.toLowerCase().includes('radical'))[0] || k.meanings[0] || '?';
    const read = getBestReading(k);
    const full = read && read !== '?' ? `${sens} • ${read}` : sens;
    return full.length > 26 ? full.slice(0, 24) + '…' : full;
}

// Fisher-Yates sur un tableau d'indices (in-place, retourne le même tableau). Copie fidèle du
// shuffleIndices() du monolithe (distinct de shuffleArray() dans learning/srs.js, qui copie le
// tableau avant de le mélanger — les deux existent séparément dans l'original, préservé tel quel).
// EXPORTÉE : startQuiz() (features/quiz.js) appelle exactement la même fonction dans
// l'original (un seul shuffleIndices, utilisé à plusieurs endroits du même fichier source).
export function shuffleIndices(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Tirage aléatoire de N leurres : priorité au pool fourni (même série/catégorie), puis
// kanjiDb global en fallback. Équivalent EXACT de pickDecoyIndices() du monolithe.
export function pickDecoyIndices(excludeIdx, correctMeaning, count, preferredPool) {
    const kanjiDb = state.data.kanjiDb;
    const result = [], tried = new Set([excludeIdx]);

    if (preferredPool && preferredPool.length > count + 1) {
        const shuffled = shuffleIndices([...preferredPool]);
        for (const i of shuffled) {
            if (result.length >= count) break;
            if (tried.has(i)) continue;
            tried.add(i);
            const k = kanjiDb[i];
            if (!k?.meanings[0] || k.meanings[0] === correctMeaning) continue;
            result.push(i);
        }
    }

    let attempts = 0;
    while (result.length < count && attempts < 300) {
        const i = Math.floor(Math.random() * kanjiDb.length);
        attempts++;
        if (tried.has(i)) continue;
        tried.add(i);
        const k = kanjiDb[i];
        if (!k?.meanings[0] || k.meanings[0] === correctMeaning) continue;
        result.push(i);
    }
    return result;
}

/* ══════════════════════════════════════════════════
   MASTERY LEGACY (scores quiz/tracé) — SYSTÈME DISTINCT du tracking SRS
   ─────────────────────────────────────────────────
   Clés localStorage dynamiques 'quiz_<char>' / 'trace_<char>', écrites par
   renderQuizResults()/renderStrokeQuizResults() (features/quiz.js et features/strokes.js,
   tous deux désormais portés). Volontairement PAS dans STORAGE_KEYS (core/storage.js) car ce sont des
   clés par caractère, pas une clé fixe unique — accès direct comme dans le monolithe.
══════════════════════════════════════════════════ */
export function getKanjiMastery(kanjiChar) {
    const quizScore = parseInt(localStorage.getItem(`quiz_${kanjiChar}`) || '0');
    const traceScore = parseInt(localStorage.getItem(`trace_${kanjiChar}`) || '0');
    if (quizScore === 0 && traceScore === 0) return 0;
    return Math.round((quizScore + traceScore) / 2);
}

/* ══════════════════════════════════════════════════
   SYSTÈME DE DOSSIERS / FAVORIS
   Structure : { "Animaux": ["猫","犬"], ... } — voir getFoldersData() (core/storage.js) pour
   l'accès brut. Toute la logique métier (ajout/retrait/renommage/suppression) est ici.
══════════════════════════════════════════════════ */
function saveFolders(folders) {
    setStorageItem(STORAGE_KEYS.FOLDERS, folders);
}

export function loadFolders() {
    return getFoldersData();
}

export function isKanjiInAnyFolder(char) {
    const f = loadFolders();
    return Object.values(f).some(arr => arr.includes(char));
}

export function getFoldersContaining(char) {
    const f = loadFolders();
    return Object.keys(f).filter(name => f[name].includes(char));
}

export function addKanjiToFolder(char, folderName) {
    const f = loadFolders();
    if (!f[folderName]) f[folderName] = [];
    if (!f[folderName].includes(char)) f[folderName].push(char);
    saveFolders(f);
}

export function removeKanjiFromFolder(char, folderName) {
    const f = loadFolders();
    if (f[folderName]) {
        f[folderName] = f[folderName].filter(c => c !== char);
        if (f[folderName].length === 0) delete f[folderName];
    }
    saveFolders(f);
}

export function renameFolder(oldName, newName) {
    if (!newName || oldName === newName) return false;
    const f = loadFolders();
    if (!f[oldName]) return false;
    if (f[newName]) return false; // doublon
    f[newName] = f[oldName];
    delete f[oldName];
    saveFolders(f);
    return true;
}

export function deleteFolder(name) {
    const f = loadFolders();
    delete f[name];
    saveFolders(f);
}

// getDetailTrackingId/refreshMasteryUI/toggleDetailMastery ont été déplacées vers
// ui/common.js (import ci-dessus) : elles sont génériques (kanji OU kana, même #detail-view).
// Note (mise à jour après le déplacement de kanaToRomaji, voir HANDOFF.md) : kanji.js
// n'importe plus rien depuis features/kana.js désormais — le cycle qui justifiait à
// l'origine ce déplacement vers ui/common.js n'existe donc plus sur ce chemin précis, mais
// le placement reste pertinent (fonctions génériques, pas spécifiques à kanji) et n'a pas
// été annulé pour éviter un remaniement inutile.

/* ══════════════════════════════════════════════════
   BOUTON ⭐ DANS LA FICHE (dossiers)
══════════════════════════════════════════════════ */
export function updateSaveBtnState(char) {
    const btn  = document.getElementById('btn-save-kanji');
    const icon = document.getElementById('save-icon');
    if (!btn || !icon) return;
    const saved = isKanjiInAnyFolder(char);
    icon.textContent = saved ? '★' : '⭐';
    btn.classList.toggle('saved', saved);
    btn.title = saved ? 'Enregistré — cliquer pour modifier' : 'Enregistrer dans un dossier';
}

/* ══════════════════════════════════════════════════
   MODAL DOSSIERS (#folder-modal)
   ─────────────────────────────────────────────────
   _fmChar : état transitoire propre à ce modal (le kanji en cours d'édition), gardé en état
   de module (pas dans core/state.js) — comportement identique au monolithe (simple `let`
   au niveau du fichier), portée volontairement locale.
   RAPPEL : ces fonctions sont encore appelées depuis des onclick="..." inline dans le HTML
   généré ci-dessous (toggleFmNewRow, toggleKanjiInFolder) — elles devront être exposées sur
   window par app.js pour rester cliquables, comme toutes les fonctions dans ce cas (voir
   risque n°1 déjà signalé plusieurs fois dans ce chantier).
══════════════════════════════════════════════════ */
let _fmChar = null;

export function openFolderModal(char) {
    if (!char) return;
    _fmChar = char;
    document.getElementById('fm-kanji-label').textContent = `Kanji : ${char}`;
    document.getElementById('fm-new-inp').value = '';
    renderFolderModalList(char);
    document.getElementById('folder-modal').classList.add('open');
}

export function closeFolderModal() {
    document.getElementById('folder-modal').classList.remove('open');
    _fmChar = null;
}

export function renderFolderModalList(char) {
    const f       = loadFolders();
    const names   = Object.keys(f);
    const inList  = getFoldersContaining(char);
    const list    = document.getElementById('fm-folder-list');

    let html = '';

    html += `<div class="fm-item" onclick="toggleFmNewRow()">
        <span class="fm-item-icon">➕</span>
        <span class="fm-item-name" style="color:var(--accent)">Créer un nouveau dossier</span>
    </div>`;

    if (names.length === 0) {
        html += `<div style="padding:20px;text-align:center;color:var(--gray);font-size:0.8125rem">
            Aucun dossier encore créé</div>`;
    } else {
        names.forEach(name => {
            const isIn  = inList.includes(name);
            const count = f[name].length;
            html += `<div class="fm-item" onclick="toggleKanjiInFolder('${char.replace(/'/g,"\\'")}','${name.replace(/'/g,"\\'")}')">
                <span class="fm-item-icon">📁</span>
                <span class="fm-item-name">${name}</span>
                <span class="fm-item-count">${count} kanji</span>
                <span class="fm-item-check">${isIn ? '✔' : ''}</span>
            </div>`;
        });
    }

    list.innerHTML = html;
}

export function toggleKanjiInFolder(char, folderName) {
    const inList = getFoldersContaining(char);
    if (inList.includes(folderName)) {
        removeKanjiFromFolder(char, folderName);
    } else {
        addKanjiToFolder(char, folderName);
    }
    renderFolderModalList(char);
    updateSaveBtnState(char);
}

export function toggleFmNewRow() {
    const row = document.getElementById('fm-new-row');
    const inp = document.getElementById('fm-new-inp');
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? '' : 'none';
    if (isHidden) setTimeout(() => inp.focus(), 50);
}

export function confirmNewFolder() {
    const inp  = document.getElementById('fm-new-inp');
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    if (!_fmChar) return;

    addKanjiToFolder(_fmChar, name);
    inp.value = '';
    document.getElementById('fm-new-row').style.display = 'none';
    renderFolderModalList(_fmChar);
    updateSaveBtnState(_fmChar);
}

/* ══════════════════════════════════════════════════
   PAGE "MES DOSSIERS"
   ─────────────────────────────────────────────────
   NOTE : le HTML généré ci-dessous référence onclick="openKanjiFromChar(...)" et
   onclick="startFolderQuiz(...)" — toutes deux désormais réellement définies (la première
   plus bas dans ce même fichier, la seconde dans features/quiz.js) et exposées sur window
   par app.js.
══════════════════════════════════════════════════ */
export function navFolders() {
    document.getElementById('page-title').innerText = '📁 Mes Dossiers';
    renderFoldersPage();
}

export function renderFoldersPage() {
    const main    = document.getElementById('main-content');
    const folders = loadFolders();
    const names   = Object.keys(folders);

    main.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'folders-wrap';

    if (names.length === 0) {
        wrap.innerHTML = `<div class="folder-empty">
            <div class="folder-empty-icon">📂</div>
            <div class="folder-empty-text">Aucun dossier créé.<br>
            Ouvrez une fiche kanji et appuyez sur ⭐ pour commencer.</div>
        </div>`;
        main.appendChild(wrap);
        return;
    }

    wrap.innerHTML = `<button onclick="promptCreateEmptyFolder()"
        style="width:100%;padding:12px;margin-bottom:16px;background:none;border:1px dashed var(--accent);border-radius:10px;color:var(--accent);font-size:0.8125rem;cursor:pointer;font-family:inherit;">
        ➕ Créer un dossier vide
    </button>`;

    names.forEach(name => {
        const kanjis = folders[name];
        const card   = document.createElement('div');
        card.className = 'folder-card';

        const kanjiChips = kanjis.map(c =>
            `<span class="folder-kanji-chip" onclick="event.stopPropagation();openKanjiFromChar('${c}')"
                title="${getKanjiMeaning(c)}">${c}</span>`
        ).join('');

        const safeN = name.replace(/'/g,"\\'");
        card.innerHTML = `
            <div class="folder-card-header">
                <span class="folder-card-icon">📁</span>
                <span class="folder-card-name">${name}</span>
                <span class="folder-card-count">${kanjis.length} kanji</span>
            </div>
            <div class="folder-card-kanjis">${kanjiChips || '<span style="color:var(--gray);font-size:0.75rem">Dossier vide</span>'}</div>
            <div class="folder-card-actions">
                <button class="folder-action-btn" onclick="promptRenameFolder('${safeN}')">✏ Renommer</button>
                <button class="folder-action-btn" onclick="startFolderQuiz('${safeN}')">⚡ Quiz</button>
                <button class="folder-action-btn danger" onclick="promptDeleteFolder('${safeN}')">🗑 Supprimer</button>
            </div>`;

        wrap.appendChild(card);
    });

    main.appendChild(wrap);
}

// NOTE : recherche linéaire (kanjiDb.find), pas via kanjiMap — reproduit tel quel le
// monolithe (getKanjiByChar existe et serait O(1), mais l'original n'utilise pas cette
// fonction ici ; je ne "corrige" pas ce choix, conformément à la consigne de préserver le
// comportement existant même quand une autre implémentation semblerait plus efficace).
export function getKanjiMeaning(char) {
    const k = state.data.kanjiDb.find(k => k.char === char);
    if (!k) return char;
    return k.meanings.filter(m => !m.toLowerCase().includes('radical'))[0] || k.meanings[0] || '';
}

export function promptCreateEmptyFolder() {
    const name = prompt('Nom du nouveau dossier :');
    if (!name || !name.trim()) return;
    const f = loadFolders();
    if (!f[name.trim()]) { f[name.trim()] = []; saveFolders(f); }
    renderFoldersPage();
}

export function promptRenameFolder(oldName) {
    const newName = prompt(`Renommer "${oldName}" en :`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    if (!renameFolder(oldName, newName.trim())) {
        alert('Un dossier avec ce nom existe déjà.');
        return;
    }
    renderFoldersPage();
}

export function promptDeleteFolder(name) {
    if (!confirm(`Supprimer le dossier "${name}" ?\nLes kanjis ne seront pas supprimés, seulement le dossier.`)) return;
    deleteFolder(name);
    renderFoldersPage();
}

// startFolderQuiz(folderName) vit finalement dans features/quiz.js (pas ici) : elle appelle
// showQuizModeModal(), et l'avoir mise ici aurait recréé un cycle kanji.js<->quiz.js.
export function openKanjiFromChar(char) {
    const idx = state.data.kanjiMap.get(char);
    if (idx === undefined) return;
    openDetail(state.data.kanjiDb[idx]);
}

/* ══════════════════════════════════════════════════
   FICHE DÉTAIL KANJI — openDetail / closeDetail
   ─────────────────────────────────────────────────
   RAPPEL : window.currentKanjiForStroke est déjà un vrai global dans le monolithe (pas une
   variable `let` locale) — préservé tel quel ici (pas déplacé vers core/state.js), car c'est
   le mécanisme exact utilisé par launchDetailTrace() pour survivre à la fermeture du modal.
══════════════════════════════════════════════════ */
export function openDetail(kanji) {
    pushModalState('kanji-detail');

    state.currentType = 'kanji';
    state.currentChar = kanji.char;
    window.currentKanjiForStroke = kanji.char;

    // Si kanji n'a pas toutes ses propriétés, chercher dans kanjiDb
    if (!kanji.meanings) {
        const fullKanji = state.data.kanjiDb.find(k => k.char === kanji.char);
        if (fullKanji) {
            kanji = fullKanji;
        }
    }

    // Chercher la catégorie (ancienne navigation) — peut être undefined avec JLPT
    const cat = [...state.categories.values()].find(c => c.indices.includes(state.data.kanjiMap.get(kanji.char)));

    const detailView = document.getElementById('detail-view');
    detailView.style.display = 'flex';
    detailView.querySelector('.detail-content').scrollTop = 0;

    document.getElementById('detail-char-title').innerText = kanji.char;

    // 1. Sens nettoyés
    const cleanMeanings = kanji.meanings.filter(m => !m.toLowerCase().includes('radical'));
    document.getElementById('d-meaning').innerText = cleanMeanings.length > 0 ? cleanMeanings.join(' · ') : (kanji.meanings[0] || '–');

    // 2. Reset feedback oral
    document.getElementById('voice-feedback').textContent = '';
    document.getElementById('voice-feedback').style.color = 'var(--gray)';

    // 3. Stats
    let levelDisplay = '–';
    if (state.currentJLPTLevel && state.jlptMapping) {
        levelDisplay = state.jlptMapping.levels[state.currentJLPTLevel].label;
    } else if (cat) {
        levelDisplay = cat.short;
    }
    document.getElementById('d-level').innerText = levelDisplay;
    const dLevelWord = document.getElementById('d-level-word');
    if (dLevelWord) dLevelWord.style.display = '';
    document.getElementById('d-strokes').innerText = kanji.strokes;
    document.getElementById('d-romaji').innerText  = kanji.romaji || '–';

    // Maîtrise (système unifié, partagé avec vocab/grammaire)
    refreshMasteryUI();

    // 4. Lectures ON / KUN
    document.getElementById('section-on').style.display  = kanji.on.length  ? '' : 'none';
    document.getElementById('section-kun').style.display = kanji.kun.length ? '' : 'none';
    document.getElementById('d-on').innerHTML  = kanji.on.map(r  => `<span class="tag tag-on"  style="font-size:0.875rem;padding:4px 10px">${r}</span>`).join('');
    document.getElementById('d-kun').innerHTML = kanji.kun.map(r => `<span class="tag tag-kun" style="font-size:0.875rem;padding:4px 10px">${r}</span>`).join('');

    // 5. Boutons : montrer les boutons kanji
    document.getElementById('btn-oral-test').style.display = '';
    const dqb = document.getElementById('detail-quiz-btn');
    if (dqb) dqb.style.display = '';
    const bsk = document.getElementById('btn-save-kanji');
    if (bsk) bsk.style.display = '';
    updateSaveBtnState(kanji.char);

    // 6. HanziWriter
    document.getElementById('kana-writer-svg').style.display     = 'none';
    document.getElementById('writer-spinner').style.display      = 'none';
    document.getElementById('kanji-writer-target').style.display = 'block';
    document.getElementById('kanji-writer-target').innerHTML     = '';

    state.writer = HanziWriter.create('kanji-writer-target', kanji.char, {
        width: 160, height: 160, padding: 14,
        strokeColor: '#00c9a7',
        outlineColor: '#88899E',
        charColor:    '#88899E',
        drawingColor: '#00c9a7',
        showOutline: true,
        charDataLoader: kanjiDataLoader
    });
    state.writer.animateCharacter();

    // 7. Stroke guide (async) — les exemples s'affichent dans tous les cas, même si le fetch
    // KanjiVG échoue (catch sur le reject de la promesse)
    renderStrokeGuide(kanji.char)
        .then(() => renderExemples(kanji.char))
        .catch(() => renderExemples(kanji.char))
        .finally(() => renderLinkedVocab(kanji.char));
}

export function closeDetail() {
    document.getElementById('detail-view').style.display = 'none';
    state.kanaAnimTimeouts.forEach(clearTimeout);
    state.kanaAnimTimeouts = [];
    if (state.fetchCtrl) { state.fetchCtrl.abort(); state.fetchCtrl = null; }

    const exContainer = document.getElementById('exemples-container');
    if (exContainer) exContainer.innerHTML = '';
}

/* ══════════════════════════════════════════════════
   GUIDE DE TRACÉ (KanjiVG) — grille de mini-SVGs, un par trait
══════════════════════════════════════════════════ */
export async function renderStrokeGuide(char) {
    const row   = document.getElementById('stroke-guide-grid');
    const title = document.getElementById('stroke-guide-title');
    if (!row) return;

    row.innerHTML = '';
    if (title) title.style.display = 'none';

    try {
        const cp  = char.codePointAt(0).toString(16).padStart(5,'0');
        const res = await fetch(`https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${cp}.svg`);
        if (!res.ok) throw new Error(res.status);

        const doc      = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
        const vb       = doc.querySelector('svg')?.getAttribute('viewBox') || '0 0 109 109';
        const allPaths = [...doc.querySelectorAll('path')].map(p => p.getAttribute('d'));
        if (!allPaths.length) throw new Error('no paths');

        const NS = 'http://www.w3.org/2000/svg';

        if (title) title.style.display = '';

        for (let i = 0; i < allPaths.length; i++) {
            const cell = document.createElement('div');
            cell.className = 'stroke-guide-cell';

            const svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('viewBox', vb);

            for (let j = 0; j < i; j++) {
                const p = document.createElementNS(NS, 'path');
                p.setAttribute('d', allPaths[j]);
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', '#3a3a55');
                p.setAttribute('stroke-width', '3.5');
                p.setAttribute('stroke-linecap', 'round');
                p.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(p);
            }

            const cur = document.createElementNS(NS, 'path');
            cur.setAttribute('d', allPaths[i]);
            cur.setAttribute('fill', 'none');
            cur.setAttribute('stroke', '#00c9a7');
            cur.setAttribute('stroke-width', '4');
            cur.setAttribute('stroke-linecap', 'round');
            cur.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(cur);

            cell.appendChild(svg);

            const num = document.createElement('span');
            num.className = 'stroke-guide-num';
            num.textContent = i + 1;
            cell.appendChild(num);

            row.appendChild(cell);
        }

        document.getElementById('d-strokes').innerText = allPaths.length;

    } catch (e) {
        row.innerHTML = '';
        if (title) title.style.display = 'none';
        console.warn('Stroke guide indisponible pour', char, e.message);
    }
}

/* ══════════════════════════════════════════════════
   EXEMPLES DE PHRASES — 3 sources en cascade :
   1. exemplesByLevel[niveau courant].kanji[char] (via getKanjiLevelExamples, déjà chargé)
   2. state.exemplesDb[char] (legacy, bootstrap — pas encore alimenté, voir core/state.js)
   3. chargement à la volée de exemplesByLevel[niveau] si rien trouvé encore (ensureExemplesLoaded)
══════════════════════════════════════════════════ */
export async function renderExemples(char) {
    const container = document.getElementById('exemples-container');
    if (!container) return;
    container.innerHTML = '';

    let liste = null;

    if (state.currentJLPTLevel) {
        liste = getKanjiLevelExamples(state.currentJLPTLevel, char);
    }

    if (!liste && state.exemplesDb && state.exemplesDb[char]) {
        liste = state.exemplesDb[char];
    }

    if (!liste && state.currentJLPTLevel) {
        await ensureExemplesLoaded(state.currentJLPTLevel);
        liste = getKanjiLevelExamples(state.currentJLPTLevel, char);
    }

    if (!liste || liste.length === 0) {
        container.innerHTML = `
            <div style="font-size:0.5625rem;color:var(--gray);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:12px">Exemples et Lectures</div>
            <div style="color:var(--gray);font-size:0.8125rem;text-align:center;padding:20px;border:1px dashed var(--border);border-radius:10px;">Aucun exemple disponible</div>`;
        return;
    }

    // Format actuel : { japanese, romaji, french, highlight? }. Repli sur l'ancien format
    // { jp, ka, ro, fr } si jamais une entrée n'a pas encore été migrée.
    const items = liste.map(ex => {
        const jp = ex.japanese || ex.jp || '';
        const romaji = ex.romaji || ex.ro || '';
        const fr = ex.french || ex.fr || '';
        const target = Array.isArray(ex.highlight) ? ex.highlight[0] : ex.highlight;
        const jpHtml = target
            ? jp.replace(new RegExp(`(${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'), '<span class="highlight-grammar">$1</span>')
            : jp;
        const plainText = stripRubyForSpeech(jp).replace(/'/g, "\\'");
        const romajiLine = romaji
            ? `<div style="font-size:0.78rem;color:var(--accent);margin-bottom:4px;font-family:monospace;opacity:0.8">${romaji}</div>`
            : '';
        return `<div onclick="speakSentence('${plainText}')"
            style="position:relative;background:rgba(255,255,255,0.03);padding:14px 40px 14px 14px;border-radius:10px;margin-bottom:10px;cursor:pointer;border-left:3px solid var(--accent);transition:background 0.15s"
            onmouseenter="this.style.background='rgba(255,255,255,0.06)'"
            onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
            <span style="position:absolute;top:12px;right:12px;font-size:1rem;opacity:0.7">🔊</span>
            <div style="font-size:1.1rem;color:#fff;margin-bottom:5px;line-height:1.4">${jpHtml}</div>
            ${romajiLine}
            <div style="font-size:0.88rem;color:#a0a0b0;line-height:1.4">${fr}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="font-size:0.5625rem;color:var(--gray);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:12px">Exemples et Lectures</div>
        ${items}`;
}

/* ══════════════════════════════════════════════════
   MOTS DE VOCABULAIRE UTILISANT CE KANJI (lien symétrique)
   Cherche d'abord dans le niveau du kanji lui-même, puis élargit aux autres niveaux.
══════════════════════════════════════════════════ */
export async function renderLinkedVocab(char) {
    const title = document.getElementById('linked-vocab-title');
    const container = document.getElementById('linked-vocab-container');
    if (!title || !container) return;

    const k = state.data.kanjiDb.find(x => x.char === char);
    const level = k ? getJLPTLevel(k.grade) : null;
    const levelId = level ? `n${level}` : null;
    const levelsToSearch = levelId ? [levelId, ...ALL_JLPT_LEVELS.filter(l => l !== levelId)] : ALL_JLPT_LEVELS;

    let matches = [];
    for (const lv of levelsToSearch) {
        const vd = await getLevelVocabData(lv);
        if (vd && vd.data) {
            const hits = vd.data.filter(w => Array.isArray(w.kanji_list) && w.kanji_list.includes(char));
            matches.push(...hits.map(w => ({ ...w, _level: lv })));
        }
        if (matches.length >= 8) break;
    }
    matches = matches.slice(0, 8);

    if (matches.length === 0) {
        title.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    title.style.display = '';
    container.innerHTML = matches.map(w => {
        const meaning = (w.meanings && (w.meanings.primary || w.meanings)) || '';
        return `
        <div class="linked-vocab-chip" onclick="openVocabFromSearch('${w.id}','${w._level}')">
            <span class="linked-vocab-word">${w.word}</span>
            <span class="linked-vocab-meaning">${meaning}</span>
        </div>`;
    }).join('');
}

/* ══════════════════════════════════════════════════
   PAGE CATÉGORIE (ancienne navigation par grade)
   ─────────────────────────────────────────────────
   showDashboard() (ui/dashboard.js) et showQuizModeModal() (features/quiz.js), référencées
   ci-dessous via des onclick="...", sont toutes deux désormais réellement portées et
   exposées sur window par app.js.
══════════════════════════════════════════════════ */
export function loadCategory(catId, isBack = false) {
    const cat = state.categories.get(catId);
    if (!cat) return;

    if (!isBack) history.pushState({ view: 'category', id: catId }, '');

    state.currentCatId = catId;
    document.getElementById('page-title').innerText = cat.label;
    const catSeries = [...state.seriesMap.values()].filter(s => s.catId === catId);

    const seriesCards = catSeries.map(ser => {
        const firstKanji = state.data.kanjiDb[ser.indices[0]]?.char ?? '？';
        return `<div class="series-card" onclick="loadSeriesPage('${ser.id}')" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:15px;">
                <div class="series-card-kanji">${firstKanji}</div>
                <div class="series-card-body">
                    <div class="series-card-num" style="font-weight:bold;">${ser.label}</div>
                    <div style="font-size:0.75rem; color:var(--gray);">${ser.indices.length} Kanji</div>
                </div>
            </div>
                <div style="color:var(--gray); font-size:0.875rem;">❯</div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('main-content').innerHTML = `
        <button class="back-btn-top" onclick="showDashboard()" style="display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); color: var(--gray); padding: 8px 12px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; cursor: pointer; margin-bottom: 20px;">
            ← ACCUEIL
        </button>
        <div class="grade-overview">
            <div class="grade-hero">
                <div class="grade-hero-top">
                    <div class="grade-hero-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.short}</div>
                    <div class="grade-hero-info">
                        <h2>${cat.label}</h2>
                        <p>${cat.indices.length} kanji · ${catSeries.length} séries</p>
                    </div>
                </div>
                <button class="grade-quiz-btn" onclick="showQuizModeModal('category','${catId}')">⚡ Quiz — Choisir un mode</button>
            </div>
            <div class="section-cards-title">Séries</div>
            <div class="series-grid">${seriesCards}</div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   PAGE SÉRIE (avec bouton retour)
══════════════════════════════════════════════════ */
export function loadSeriesPage(seriesId, isBack = false) {
    const ser = state.seriesMap.get(seriesId);
    if (!ser) return;

    if (!isBack) history.pushState({ view: 'series', id: seriesId }, '');

    const cat = state.categories.get(ser.catId);
    document.getElementById('page-title').innerText = `${cat.label} · ${ser.label}`;

    document.getElementById('main-content').innerHTML = `
        <button class="back-btn-top" onclick="loadCategory('${ser.catId}')" style="display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); color: var(--gray); padding: 8px 12px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; cursor: pointer; margin-bottom: 20px;">
            ← LISTE DES SÉRIES
        </button>
        <div class="list-header">
            <div>
                <div style="font-size:0.875rem;font-weight:bold">${ser.label}</div>
                <div class="list-header-info">${cat.label} · ${ser.range} (${ser.indices.length} kanji)</div>
            </div>
            <button class="list-quiz-btn" onclick="showQuizModeModal('series','${seriesId}')">Quiz ▶</button>
        </div>
        <div id="series-kanji-list"></div>`;

    const list = document.getElementById('series-kanji-list');
    resolveKanjis(ser.indices).forEach(k => list.appendChild(makeKanjiRow(k)));
}

export function makeKanjiRow(k) {
    const row = document.createElement('div');
    row.className = 'kanji-row';
    row.onclick = () => openDetail(k);
    row.innerHTML = `
        <div class="kanji-char-large">${k.char}</div>
        <div class="kanji-info-main">
            <div class="tag-container">
                ${k.on.slice(0,3).map(r => `<span class="tag tag-on">${r}</span>`).join('')}
                ${k.kun.slice(0,2).map(r => `<span class="tag tag-kun">${r.split('.')[0]}</span>`).join('')}
            </div>
            <div style="font-size:0.8125rem;color:var(--gray)">${k.meanings[0] || ''}</div>
        </div>
        <div class="kanji-row-stroke">${k.strokes}t</div>`;
    return row;
}

/* ══════════════════════════════════════════════════
   GRILLE KANJI PAR NIVEAU JLPT (navigation moderne, distincte de loadCategory/
   loadSeriesPage qui restent l'ancienne navigation par grade)
   ─────────────────────────────────────────────────
   RAPPEL : handleListItemClick, enterBulkSelectMode, toggleCategoryMasteryLive et
   showKanjiReviewModeSelector sont référencées uniquement via des onclick="..." dans le HTML
   généré ci-dessous (forward-refs résolues via window au clic, pas des imports directs ici).
   showKanjiReviewModeSelector (features/quiz.js ou une future feature "révision") n'est pas
   encore portée — le bouton "Réviser" restera inerte jusque-là.
══════════════════════════════════════════════════ */
export function displayKanjiList(levelId, data, isBack = false) {
    const container = document.getElementById('category-content');
    if (!data.chars || !Array.isArray(data.chars)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }

    if (!isBack) history.pushState({ view: 'kanji-list' }, '');

    state.kanjiHomeData = { levelId, chars: data.chars };
    state.currentLevelId = levelId;

    const dueCount = countDueItems(data.chars.map(c => ({ id: c })));

    const grid = data.chars.map(char => {
        const kanjiData = state.data.kanjiDb.find(k => k.char === char);
        if (!kanjiData) return '';
        const isMastered = getItemStatus(char) === 'mastered';
        return `<div class="kanji-grid-cell ${isBulkSelected(char) ? 'bulk-selected' : ''}" onclick="handleListItemClick(this, '${char}', () => openDetail({char:'${char}'}))" style="position:relative;">
            ${isMastered ? '<span class="mastered-check">✔</span>' : ''}
            <div class="kgc-char">${char}</div>
            <div class="kgc-meaning">${kanjiData.meanings[0] || '–'}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="display:flex;gap:8px">
            <button class="vocab-review-cta" style="flex:1" onclick="showKanjiReviewModeSelector()">
                🔁 Réviser${dueCount > 0 ? ` <span class="vocab-review-badge">${dueCount}</span>` : ''}
            </button>
            ${!state.bulkSelectMode ? `<button class="bulk-select-toggle-btn" onclick="enterBulkSelectMode(refreshKanjiList)">☑ Sélectionner</button>` : ''}
        </div>
        ${state.bulkSelectMode ? `
        <label class="bulk-cat-row-standalone">
            <input type="checkbox" class="bulk-cat-checkbox" onclick='toggleCategoryMasteryLive(this, ${JSON.stringify(data.chars)})' ${data.chars.every(c => getItemStatus(c) === 'mastered') ? 'checked' : ''}>
            <span>Tout ce niveau</span>
        </label>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;margin-top:12px">
            ${grid}
        </div>`;
}

// ⚠️ ATTENTION, différent des forward-refs onclick="..." ailleurs dans ce fichier (inertes
// tant qu'on ne clique pas) : loadJLPTCategory() ci-dessous est un VRAI appel JS, pas une
// chaîne HTML — si cette fonction est invoquée avant que loadJLPTCategory (routeur
// cross-feature showCategoryDirect/loadJLPTCategory, distribue vers displayKanjiList/
// displayVocabList/showGrammarHome selon la catégorie, hors périmètre de features/kanji.js)
// ne soit porté, ça lève une ReferenceError immédiate. Ne pas appeler tant que ce n'est pas fait.
// Équivalent du onclick="displayKanjiList('${levelId}', {chars: kanjiHomeData.chars}, true)"
// du monolithe (bouton "Sélectionner") — bug trouvé et corrigé lors de la revérification
// finale : kanjiHomeData référencé en bare, copié tel quel du monolithe où c'était une
// vraie globale, ne fonctionnait pas en ESM. Même correction que dans vocabulary.js/grammar.js.
export function refreshKanjiList() {
    if (!state.kanjiHomeData) return;
    displayKanjiList(state.kanjiHomeData.levelId, { chars: state.kanjiHomeData.chars }, true);
}

export function displayKanjiListFromHome() {
    if (state.kanjiHomeData) loadJLPTCategory(state.kanjiHomeData.levelId, 'kanji', true);
}

export function getDueKanjiChars() {
    const chars = state.kanjiHomeData?.chars || [];
    return buildDueQueue(chars.map(c => ({ id: c }))).map(item => item.id);
}

/* ══════════════════════════════════════════════════
   stripRubyForSpeech — déplacée depuis features/oral.js
   ─────────────────────────────────────────────────
   Utilisée par kanji (renderExemples ci-dessus) ET vocab ET grammaire (boutons 🔊 des
   exemples) — pas spécifique à l'oral. Gardée ici plutôt que dans oral.js pour éviter un
   cycle d'import (oral.js a besoin d'importer getAllValidReadings/quizOverrides d'ici pour
   isResultCorrect/normalizeOralResult). Équivalent EXACT de stripRubyForSpeech(html) du
   monolithe — comportement identique, seul son emplacement dans l'arborescence change.
══════════════════════════════════════════════════ */
export function stripRubyForSpeech(html) {
    if (!html) return '';
    return html
        .replace(/<rt>.*?<\/rt>/g, '')   // retire la lecture entière (balise + contenu)
        .replace(/<\/?ruby>/g, '')       // retire juste les balises ruby, garde le kanji
        .replace(/<[^>]+>/g, '')         // filet de sécurité pour toute autre balise
        .trim();
}

/* ══════════════════════════════════════════════════
   kanjiDataLoader — déplacée depuis features/strokes.js
   ─────────────────────────────────────────────────
   Aucune dépendance propre (juste des fetch), mais strokes.js a maintenant besoin
   d'importer shuffleIndices/buildReadingChips DEPUIS kanji.js (pour le vrai startStrokeQuiz).
   La garder dans strokes.js aurait créé un cycle (kanji.js <-> strokes.js) puisque kanji.js
   en a besoin pour openDetail(). Déplacée ici : strokes.js importe maintenant tout depuis
   kanji.js dans un seul sens, sans retour. Comportement identique, seul l'emplacement change.
   Équivalent EXACT de kanjiDataLoader(char, onLoad, onError) du monolithe.
══════════════════════════════════════════════════ */
export function kanjiDataLoader(char, onLoad, onError) {
    const cdn = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${char}.json`;
    const gh  = `https://raw.githubusercontent.com/chanind/hanzi-writer-data-jp/master/data/${char}.json`;
    fetch(gh)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(onLoad)
        .catch(() =>
            fetch(cdn)
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(onLoad)
                .catch(() => { if (typeof onError === 'function') onError(); })
        );
}
